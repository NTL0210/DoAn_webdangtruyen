const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { jwtSecret } = require('../config/env');

let ioInstance = null;

/**
 * Get JWT token from socket handshake.
 * Supports:
 * - socket.handshake.auth.token
 * - Authorization header: Bearer <token>
 */
const extractTokenFromHandshake = (socket) => {
  const authToken = socket.handshake.auth && socket.handshake.auth.token;

  if (authToken) {
    return authToken;
  }

  const authorization = socket.handshake.headers && socket.handshake.headers.authorization;

  if (authorization && authorization.startsWith('Bearer ')) {
    return authorization.split(' ')[1];
  }

  return null;
};

/**
 * Initialize Socket.IO server and JWT auth middleware.
 */
const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
    },
  });

  ioInstance.use(async (socket, next) => {
    try {
      const token = extractTokenFromHandshake(socket);

      if (!token) {
        return next(new Error('Authentication error: token is required.'));
      }

      const decoded = jwt.verify(token, jwtSecret);
      const user = await User.findById(decoded.id).select('_id username');

      if (!user) {
        return next(new Error('Authentication error: user not found.'));
      }

      socket.user = {
        id: String(user._id),
        username: user.username,
      };

      next();
    } catch (error) {
      next(new Error('Authentication error: invalid token.'));
    }
  });

  ioInstance.on('connection', (socket) => {
    // Each user joins their private room: user:<userId>
    const userRoom = `user:${socket.user.id}`;
    socket.join(userRoom);
    console.log(`[socket] user ${socket.user.id} connected and joined room ${userRoom}`);

    socket.on('disconnect', () => {
      console.log(`[socket] user ${socket.user.id} disconnected`);
    });
  });

  return ioInstance;
};

/**
 * Get the Socket.IO instance after initialization.
 */
const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.IO is not initialized.');
  }

  return ioInstance;
};

/**
 * Emit one realtime notification to a specific user room.
 */
const emitNotificationToUser = (userId, payload) => {
  if (!ioInstance || !userId) {
    return;
  }

  ioInstance.to(`user:${userId}`).emit('notification:new', payload);
};

module.exports = {
  initSocket,
  getIO,
  emitNotificationToUser,
};
