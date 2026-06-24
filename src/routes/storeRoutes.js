const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

router.get('/', authenticateToken, storeController.getStores);
router.post('/bulk', authenticateToken, authorizeRoles('admin'), storeController.bulkCreateStores);
router.post('/', authenticateToken, authorizeRoles('admin', 'agent'), storeController.createStore);
router.put('/:id', authenticateToken, authorizeRoles('admin', 'agent'), storeController.updateStore);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), storeController.deleteStore);

module.exports = router;
