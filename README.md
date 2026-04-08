# WebTruyen

Full-stack social platform for stories and artworks with a React frontend and Node.js/Express backend.

## Overview

This repository contains:

- `backend/` — Node.js + Express API server with MongoDB persistence
- `frontend/` — React + Vite frontend UI for browsing, creating content, and admin moderation

The app supports user registration, content publishing, bookmarks, comments, follows, notifications, moderation, and role-based user access.

## Features

- JWT authentication and protected routes
- Story/artwork creation workflow with draft → pending → approved/rejected moderation
- Public feed with search, tag filtering, sort, and pagination
- Commenting, bookmarking, and follow/unfollow features
- User profiles with publishing and social info
- Admin/moderator dashboard for moderation and user management
- Notification feed and read/unread management
- Reading history tracking

## Tech Stack

- Frontend: React, Vite, React Router, Tailwind CSS
- Backend: Node.js, Express, MongoDB, Mongoose
- Authentication: JSON Web Tokens
- Testing: Vitest

## Repository Layout

```text
backend/
  app.js
  server.js
  config/
  controllers/
  middleware/
  models/
  routes/
  scripts/
  tests/
frontend/
  src/
  index.html
  package.json
```

## Getting Started

### Backend

1. Install backend dependencies

```bash
cd backend
npm install
```

2. Create backend environment file

```bash
cd backend
copy .env.example .env
```

3. Update backend `.env`

Example values:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/webtruyen
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
```

4. Create frontend environment file

```bash
cd ../frontend
copy .env.example .env
```

5. Update frontend `.env`

Example values:

```env
VITE_API_URL=http://localhost:5000
```

6. Run backend server

```bash
cd ../backend
npm run dev
```

5. Run backend tests

```bash
npm test
```

### Frontend

1. Install frontend dependencies

```bash
cd frontend
npm install
```

2. Run frontend development server

```bash
npm run dev
```

3. Build production frontend

```bash
npm run build
```

## Running the App

- Backend API default: `http://localhost:5000`
- Frontend default: `http://localhost:5173`

Make sure the backend is running before using the frontend.

## API Endpoints

### Health

- `GET /health` — health check for server, database, and cache status

### Auth

- `POST /api/auth/register` — register a new user
- `POST /api/auth/login` — login and receive JWT token
- `POST /api/auth/logout` — logout (client-side token discard)
- `POST /api/auth/account-appeals` — submit an account appeal (permanently banned users)

### Content

- `POST /api/stories` — create a story (auth + posting access)
- `POST /api/artworks` — create an artwork (auth + posting access)
- `GET /api/content/search` — search content
- `GET /api/content/feed` — cursor paginated home feed
- `GET /api/content/trending` — trending content list
- `GET /api/content/creators/popular` — popular creator rankings
- `GET /api/content/tags/recommended` — recommended hashtags for authenticated users
- `GET /api/content/tags/trending` — trending hashtag stats
- `GET /api/content/tags` — hashtag directory / search
- `GET /api/content/:id` — get content by ID
- `PUT /api/content/:id` — update content (auth + owner/posting access)
- `POST /api/content/:id/like` — toggle like on content
- `POST /api/content/:id/bookmark` — toggle bookmark on content
- `DELETE /api/content/:id` — soft delete content (auth)

### Comments

- `POST /api/content/:id/comments` — add comment to content (auth)
- `GET /api/content/:id/comments` — fetch comments for content
- `DELETE /api/comments/:id` — delete own comment (auth)

### Reports

- `POST /api/reports` — create a report for inappropriate content (auth)

### Users

- `GET /api/users/search` — search creators
- `GET /api/users/:id` — get public user profile
- `PUT /api/users/profile` — update own profile (auth)
- `PUT /api/users/avatar` — upload/update avatar (auth)
- `GET /api/users/me/history` — get own reading history (auth)
- `GET /api/users/me/bookmarks` — get own bookmarked content (auth)
- `GET /api/users/me/likes` — get own liked content (auth)
- `GET /api/users/me/favorite-tags` — get own favorite hashtags (auth)
- `POST /api/users/me/favorite-tags` — add a favorite hashtag (auth)
- `DELETE /api/users/me/favorite-tags/:tag` — remove a favorite hashtag (auth)
- `POST /api/users/:id/follow` — follow a user (auth)
- `DELETE /api/users/:id/follow` — unfollow a user (auth)
- `GET /api/users/:id/followers` — get a user's followers
- `GET /api/users/:id/following` — get a user's following list
- `POST /api/users/:id/subscribe` — subscribe to an artist (auth)
- `DELETE /api/users/:id/subscribe` — unsubscribe from an artist (auth)
- `GET /api/users/:id/subscription-info` — get artist subscription info
- `GET /api/users/me/subscriptions` — get current user's subscriptions (auth)
- `PUT /api/users/me/subscription-settings` — update subscription settings (auth)

### Notifications

- `GET /api/notifications` — get current user's notifications (auth)
- `PUT /api/notifications/:id/read` — mark notification as read (auth)
- `DELETE /api/notifications/:id` — delete a notification (auth)

### Payments

- `POST /api/payments/momo/subscriptions/:artistId/create` — create a MoMo subscription checkout session (auth)
- `POST /api/payments/momo/premium/create` — create a MoMo premium purchase checkout (auth)
- `POST /api/payments/momo/ipn` — MoMo IPN callback endpoint
- `GET /api/payments/momo/return` — MoMo return/redirect endpoint
- `GET /api/payments/:orderId/status` — get payment status for an order (auth)
- `POST /api/payments/:orderId/confirm-from-return-dev` — dev helper to confirm payment after return (auth)

### Admin / Moderation

- `PUT /api/admin/content/:id/dismiss-reports` — dismiss reports for content (admin)
- `PUT /api/admin/content/:id/ban` — ban reported content (admin)
- `GET /api/admin/reports` — get all reports (admin)
- `GET /api/admin/reports/:contentType/:id` — get detailed report history for content (admin)
- `POST /api/admin/reports/:contentType/:id/open` — open a report incident (admin)
- `PUT /api/admin/reports/:contentType/:id/release` — release an incident (admin)
- `GET /api/admin/users` — list users for moderation (admin)
- `PUT /api/admin/users/:id/ban` — suspend a user for 3 days (admin)
- `PUT /api/admin/users/:id/permanent-ban` — permanently ban a user (admin)
- `PUT /api/admin/users/:id/unban` — unban a user (admin)
- `GET /api/admin/appeals` — get account appeals (admin)
- `PUT /api/admin/appeals/:id/approve` — approve an appeal (admin)
- `PUT /api/admin/appeals/:id/reject` — reject an appeal (admin)

## Backend Scripts

- `npm run dev` — start server with file watch
- `npm start` — run production server
- `npm test` — run Vitest tests
- `npm run db:update` — sync database schema
- `npm run db:sync` — sync database schema and normalize data
- `npm run db:migrate` — sync schema and run backfill scripts
- `npm run backfill:content-search`
- `npm run backfill:user-search`
- `npm run backfill:notification-comments`
- `npm run backfill:notification-content-status`
- `npm run redis:check`

## Notes

- The backend uses role-based access control with `user`, `moderator`, and `admin` roles.
- Some moderation and admin routes require the authenticated user to have elevated privileges.
- Upload fields and limits are enforced by middleware in the backend.

## License

MIT
