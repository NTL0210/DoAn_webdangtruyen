const express = require('express');
const {
  upsertHistory,
  getMyHistory,
  deleteHistoryItem,
} = require('../controllers/readingHistory.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// All reading history endpoints require authentication.
router.post('/history/:postId', protect, upsertHistory);
router.get('/history/me', protect, getMyHistory);
router.delete('/history/:postId', protect, deleteHistoryItem);

module.exports = router;