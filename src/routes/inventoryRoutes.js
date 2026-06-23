const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

router.post('/assign', authenticateToken, authorizeRoles('admin', 'warehouse_manager'), inventoryController.assignInventory);
router.get('/agent/:agentId', authenticateToken, inventoryController.getAgentInventory);

module.exports = router;
