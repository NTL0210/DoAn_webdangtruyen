import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import AccountAppeal from '../../models/AccountAppeal.js';
import Follow from '../../models/Follow.js';
import ModerationAuditLog from '../../models/ModerationAuditLog.js';
import Story from '../../models/Story.js';
import User from '../../models/User.js';
import { approveAccountAppeal, permanentlyBanUser } from '../../controllers/ModerationController.js';
import { getFollowing } from '../../controllers/UserController.js';
import { processExpiredPermanentBanDeletions } from '../../services/permanentBanCleanup.js';

vi.mock('../../websocket/WebSocketManager.js', () => ({
  default: {
    sendNotification: vi.fn().mockResolvedValue(null)
  }
}));

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    }
  };
}

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {
    dbName: 'permanent-ban-workflow'
  });
});

afterEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('permanent ban workflow', () => {
  it('hides creator content and schedules deletion when the account is permanently banned', async () => {
    const admin = await User.create({
      username: 'admin-one',
      email: 'admin-one@example.com',
      password: 'hashed-password',
      role: 'admin'
    });
    const artist = await User.create({
      username: 'artist-one',
      email: 'artist-one@example.com',
      password: 'hashed-password'
    });
    const story = await Story.create({
      title: 'Original work',
      content: 'Published content',
      author: artist._id,
      status: 'approved'
    });

    const req = {
      params: { id: String(artist._id) },
      body: { reason: 'Repeated severe violations' },
      user: { userId: String(admin._id), role: 'admin' }
    };
    const res = createMockResponse();

    await permanentlyBanUser(req, res);

    const bannedArtist = await User.findById(artist._id);
    const hiddenStory = await Story.findById(story._id);
    const auditLog = await ModerationAuditLog.findOne({ actionType: 'permanent-ban' });

    expect(res.statusCode).toBe(200);
    expect(bannedArtist.accountStatus).toBe('permanently-banned');
    expect(res.payload.data.permanentDeletionScheduledFor).toBeTruthy();
    expect(hiddenStory.status).toBe('deleted');
    expect(hiddenStory.hiddenByPermanentBan).toBe(true);
    expect(hiddenStory.statusBeforePermanentBan).toBe('approved');
    expect(auditLog).toBeTruthy();
  });

  it('keeps follow data restorable and shows it again after appeal approval', async () => {
    const admin = await User.create({
      username: 'admin-two',
      email: 'admin-two@example.com',
      password: 'hashed-password',
      role: 'admin'
    });
    const follower = await User.create({
      username: 'reader-one',
      email: 'reader-one@example.com',
      password: 'hashed-password'
    });
    const artist = await User.create({
      username: 'artist-two',
      email: 'artist-two@example.com',
      password: 'hashed-password'
    });
    const story = await Story.create({
      title: 'Returnable work',
      content: 'Visible before ban',
      author: artist._id,
      status: 'approved'
    });

    await Follow.create({
      follower: follower._id,
      following: artist._id
    });

    await permanentlyBanUser({
      params: { id: String(artist._id) },
      body: { reason: 'Permanent account ban' },
      user: { userId: String(admin._id), role: 'admin' }
    }, createMockResponse());

    const hiddenFollowingRes = createMockResponse();
    await getFollowing({ params: { id: String(follower._id) } }, hiddenFollowingRes);

    const appeal = await AccountAppeal.create({
      user: artist._id,
      banReason: 'Permanent account ban',
      bannedAt: new Date(),
      appealReason: 'Please review this decision.',
      status: 'pending'
    });

    const approveRes = createMockResponse();
    await approveAccountAppeal({
      params: { id: String(appeal._id) },
      body: { reason: 'Appeal approved. Account access restored.' },
      user: { userId: String(admin._id), role: 'admin' }
    }, approveRes);

    const restoredFollowingRes = createMockResponse();
    await getFollowing({ params: { id: String(follower._id) } }, restoredFollowingRes);

    const restoredStory = await Story.findById(story._id);

    expect(hiddenFollowingRes.payload.data).toHaveLength(0);
    expect(approveRes.statusCode).toBe(200);
    expect(restoredFollowingRes.payload.data).toHaveLength(1);
    expect(restoredFollowingRes.payload.data[0].username).toBe('artist-two');
    expect(restoredStory.status).toBe('approved');
    expect(restoredStory.hiddenByPermanentBan).toBe(false);
  });

  it('permanently purges expired banned accounts after the 5-day window when no appeal is pending', async () => {
    const expiredArtist = await User.create({
      username: 'expired-artist',
      email: 'expired-artist@example.com',
      password: 'hashed-password',
      accountStatus: 'permanently-banned',
      permanentBanReason: 'Expired grace period',
      permanentlyBannedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    });
    const pendingArtist = await User.create({
      username: 'pending-artist',
      email: 'pending-artist@example.com',
      password: 'hashed-password',
      accountStatus: 'permanently-banned',
      permanentBanReason: 'Pending appeal',
      permanentlyBannedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    });

    const expiredStory = await Story.create({
      title: 'Expired content',
      content: 'Will be purged',
      author: expiredArtist._id,
      status: 'deleted',
      hiddenByPermanentBan: true,
      statusBeforePermanentBan: 'approved'
    });

    await Follow.create({
      follower: pendingArtist._id,
      following: expiredArtist._id
    });

    await AccountAppeal.create({
      user: pendingArtist._id,
      banReason: 'Pending appeal',
      bannedAt: pendingArtist.permanentlyBannedAt,
      appealReason: 'Still under review',
      status: 'pending'
    });

    const result = await processExpiredPermanentBanDeletions(new Date());

    const deletedArtist = await User.findById(expiredArtist._id);
    const survivingArtist = await User.findById(pendingArtist._id);
    const deletedStory = await Story.findById(expiredStory._id);
    const deletedFollow = await Follow.findOne({ following: expiredArtist._id });
    const purgeAuditLog = await ModerationAuditLog.findOne({ actionType: 'account-purged' });

    expect(result.purgedUsers).toBe(1);
    expect(deletedArtist).toBeNull();
    expect(deletedStory).toBeNull();
    expect(deletedFollow).toBeNull();
    expect(survivingArtist).toBeTruthy();
    expect(purgeAuditLog).toBeTruthy();
  });
});