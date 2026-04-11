import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { getCurrentUser, isAuthenticated, logout, patchCurrentUser, queueForcedBanState, subscribeToCurrentUserChange } from './services/authService';
import { connectNotificationSocket, disconnectNotificationSocket, subscribeToAccountState } from './services/notificationService';
import { routeModuleLoaders, scheduleRoutePrefetch } from './services/routePrefetch';
import { SmoothCursor } from './components/SmoothCursor';
import { NotificationToastLayer } from './components/notifications/NotificationToastLayer';
import { SessionNoticeLayer } from './components/notifications/SessionNoticeLayer';
import { AppLayout } from './components/layout/AppLayout';
import { emitSessionNotice } from './services/sessionNoticeService';

const SplashScreen = lazy(routeModuleLoaders.splash);
const LoginPage = lazy(routeModuleLoaders.login);
const RegisterPage = lazy(routeModuleLoaders.register);
const ForgotPasswordPage = lazy(routeModuleLoaders.forgotPassword);
const MoMoReturnPage = lazy(routeModuleLoaders.momoReturn);
const HomePage = lazy(routeModuleLoaders.home);
const StoriesPage = lazy(routeModuleLoaders.stories);
const ArtworksPage = lazy(routeModuleLoaders.artworks);
const MembershipPostsPage = lazy(routeModuleLoaders.memberships);
const SearchPage = lazy(routeModuleLoaders.search);
const CreateStoryPage = lazy(routeModuleLoaders.createStory);
const CreateArtworkPage = lazy(routeModuleLoaders.createArtwork);
const StoryPage = lazy(routeModuleLoaders.story);
const ArtworkPage = lazy(routeModuleLoaders.artwork);
const ProfilePage = lazy(routeModuleLoaders.profile);
const PremiumPage = lazy(routeModuleLoaders.premium);
const ArtistMembershipPage = lazy(routeModuleLoaders.artistMembership);
const NotificationPage = lazy(routeModuleLoaders.notifications);
const RemovedContentPage = lazy(routeModuleLoaders.postUnavailable);
const AdminPage = lazy(routeModuleLoaders.admin);
const SavedPage = lazy(routeModuleLoaders.saved);

function RouteFallback() {
  return (
    <div className="panel flex min-h-72 items-center justify-center">
      <LoadingSpinner label="Loading page..." />
    </div>
  );
}

// Protected Route component
function ProtectedRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" />;
}

function AdminRoute({ children, user }) {
  return user?.role === 'admin' ? children : <Navigate to="/home" replace />;
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());

  useEffect(() => subscribeToCurrentUserChange(setCurrentUser), []);

  const isRestrictionActive = (user) => {
    if (!user?.postingRestrictedUntil) {
      return false;
    }

    const restrictionEnd = new Date(user.postingRestrictedUntil);
    return !Number.isNaN(restrictionEnd.getTime()) && restrictionEnd > new Date();
  };

  useEffect(() => {
    if (isAuthenticated()) {
      connectNotificationSocket();
    }

    return () => {
      disconnectNotificationSocket();
    };
  }, []);

  useEffect(() => subscribeToAccountState((payload) => {
    if (!payload?.user) {
      return;
    }

    const previousUser = getCurrentUser();
    const previousRole = previousUser?.role || 'user';
    const nextRole = payload.user.role || 'user';
    const previousRestrictionActive = isRestrictionActive(previousUser);
    const nextRestrictionActive = isRestrictionActive(payload.user);

    if (payload.user.accountStatus === 'permanently-banned') {
      queueForcedBanState({
        ...payload,
        userId: payload.user._id || payload.user.id,
        username: payload.user.username,
        email: payload.user.email,
        permanentBanReason: payload.permanentBanReason || payload.user.permanentBanReason,
        permanentlyBannedAt: payload.permanentlyBannedAt || payload.user.permanentlyBannedAt
      });
      logout();

      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }

      return;
    }

    if (previousRole !== nextRole) {
      emitSessionNotice({
        id: `role-change:${payload.user._id}:${nextRole}`,
        tone: nextRole === 'admin' ? 'admin' : 'warning',
        title: nextRole === 'admin' ? 'Admin access granted' : 'Admin access removed',
        message: nextRole === 'admin'
          ? 'Your account has been upgraded to admin. Moderation tools are now available.'
          : 'Your account is no longer using admin access. The moderation area has been hidden.'
      });
    }

    if (!previousRestrictionActive && nextRestrictionActive) {
      emitSessionNotice({
        id: `posting-restriction:${payload.user._id}:${payload.user.postingRestrictedUntil}`,
        tone: 'warning',
        title: 'Posting restricted',
        message: `Your publishing access is locked until ${new Date(payload.user.postingRestrictedUntil).toLocaleString()}. Reason: ${payload.user.postingRestrictionReason || 'Policy violation.'}`
      });
    }

    if (previousRestrictionActive && !nextRestrictionActive) {
      emitSessionNotice({
        id: `posting-restriction-cleared:${payload.user._id}:${Date.now()}`,
        tone: 'success',
        title: 'Posting restriction lifted',
        message: 'Your account can publish again. You do not need to refresh the page.'
      });
    }

    patchCurrentUser(payload.user);
  }), []);

  useEffect(() => {
    const likelyRoutes = ['/home', '/stories', '/artworks', '/memberships', '/search'];

    if (isAuthenticated()) {
      likelyRoutes.push('/profile');
    }

    if (currentUser?.role === 'admin') {
      likelyRoutes.push('/admin');
    }

    return scheduleRoutePrefetch(likelyRoutes);
  }, [currentUser?.role]);

  return (
    <Router>
      <SmoothCursor />
      <NotificationToastLayer />
      <SessionNoticeLayer />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Splash Screen */}
          <Route path="/splash" element={<SplashScreen />} />
          
          {/* Redirect root based on auth status */}
          <Route path="/" element={isAuthenticated() ? <Navigate to="/home" replace /> : <Navigate to="/splash" replace />} />

          {/* Auth pages */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/payment/momo/return" element={<MoMoReturnPage />} />

          {/* Protected pages with AppLayout */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/stories" element={<StoriesPage />} />
            <Route path="/artworks" element={<ArtworksPage />} />
            <Route path="/memberships" element={<MembershipPostsPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/notifications" element={<NotificationPage />} />
            <Route path="/post-unavailable" element={<RemovedContentPage />} />
            <Route path="/create-story" element={<CreateStoryPage />} />
            <Route path="/create-artwork" element={<CreateArtworkPage />} />
            <Route path="/premium" element={<PremiumPage />} />
            <Route path="/membership/:artistId" element={<ArtistMembershipPage />} />
            <Route path="/story/:id" element={<StoryPage />} />
            <Route path="/story/:id/edit" element={<CreateStoryPage />} />
            <Route path="/artwork/:id" element={<ArtworkPage />} />
            <Route path="/artwork/:id/edit" element={<CreateArtworkPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/:id" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminRoute user={currentUser}><AdminPage /></AdminRoute>} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
