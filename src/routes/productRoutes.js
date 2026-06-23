const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

router.get('/', authenticateToken, productController.getProducts);
router.post('/', authenticateToken, authorizeRoles('admin', 'warehouse_manager'), productController.createProduct);
router.put('/:id', authenticateToken, authorizeRoles('admin', 'warehouse_manager'), productController.updateProduct);
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'warehouse_manager'), productController.deleteProduct);

module.exports = router;
