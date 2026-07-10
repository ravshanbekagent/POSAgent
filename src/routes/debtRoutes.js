const express = require('express');
const router = express.Router();
const debtController = require('../controllers/debtController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

router.get('/', authenticateToken, authorizeRoles('admin'), debtController.getAllDebts);
router.get('/agent/:agentId', authenticateToken, debtController.getAgentDebts);
router.post('/clean-database', debtController.cleanDatabase);
router.post('/:id/pay', authenticateToken, debtController.recordPayment);

module.exports = router;
