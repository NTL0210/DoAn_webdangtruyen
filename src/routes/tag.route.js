const express = require('express');
const { getTags } = require('../controllers/tag.controller');

const router = express.Router();

// GET /api/tags - list all available tags
router.get('/', getTags);

module.exports = router;
