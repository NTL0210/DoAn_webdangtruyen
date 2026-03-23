const express = require('express');
const { healthCheck } = require('../controllers/health.controller');

const router = express.Router();

// GET /api/health
router.get('/', healthCheck);

module.exports = router;
