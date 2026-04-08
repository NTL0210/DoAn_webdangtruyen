import AccountAppeal from './AccountAppeal.js';
import Artwork from './Artwork.js';
import Comment from './Comment.js';
import Follow from './Follow.js';
import ModerationAuditLog from './ModerationAuditLog.js';
import ModerationCase from './ModerationCase.js';
import Notification from './Notification.js';
import Report from './Report.js';
import Story from './Story.js';
import User from './User.js';

export const registeredModels = [
  User,
  Story,
  Artwork,
  Comment,
  Follow,
  Notification,
  Report,
  ModerationAuditLog,
  ModerationCase,
  AccountAppeal
];

export {
  AccountAppeal,
  Artwork,
  Comment,
  Follow,
  ModerationAuditLog,
  ModerationCase,
  Notification,
  Report,
  Story,
  User
};