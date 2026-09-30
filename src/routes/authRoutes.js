const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  profile,
  getAllUsers,
  updateUserRole,
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('role')
      .optional()
      .isIn(['Admin', 'Editor', 'Author', 'Reader', 'admin', 'editor', 'author', 'reader'])
      .withMessage('Invalid role'),
  ],
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

router.get('/profile', authMiddleware, profile);

// Admin-only user management routes
router.get('/users', authMiddleware, roleMiddleware('Admin'), getAllUsers);
router.put('/users/:id/role', authMiddleware, roleMiddleware('Admin'), updateUserRole);

module.exports = router;
