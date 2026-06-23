const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

router.post('/', authenticateToken, authorizeRoles('agent'), salesController.createSale);
router.get('/agent/:agentId', authenticateToken, salesController.getAgentSales);
router.get('/:id', authenticateToken, salesController.getSaleDetails);

module.exports = router;
