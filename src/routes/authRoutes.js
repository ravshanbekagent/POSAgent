const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

router.post('/register', authenticateToken, authorizeRoles('admin'), authController.register);
router.post('/login', authController.login);
router.get('/users', authenticateToken, authorizeRoles('admin'), authController.getUsers);

module.exports = router;
