const express = require('express');
const router = express.Router();
const visitController = require('../controllers/visitController');
const { authenticateToken } = require('../middlewares/auth');

router.post('/', authenticateToken, visitController.createVisit);
router.get('/', authenticateToken, visitController.getVisits);
router.get('/agent/:agentId', authenticateToken, visitController.getAgentVisits);

module.exports = router;
