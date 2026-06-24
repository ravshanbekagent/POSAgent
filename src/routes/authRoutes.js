const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

router.post('/register', authenticateToken, authorizeRoles('admin'), authController.register);
router.post('/login', authController.login);
router.get('/users', authenticateToken, authorizeRoles('admin'), authController.getUsers);
router.put('/users/:id', authenticateToken, authorizeRoles('admin'), authController.updateUser);
router.delete('/users/:id', authenticateToken, authorizeRoles('admin'), authController.deleteUser);

module.exports = router;
