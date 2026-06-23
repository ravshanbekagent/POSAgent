const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

router.get('/', authenticateToken, storeController.getStores);
router.post('/', authenticateToken, authorizeRoles('admin', 'agent'), storeController.createStore);
router.put('/:id', authenticateToken, authorizeRoles('admin', 'agent'), storeController.updateStore);

module.exports = router;
