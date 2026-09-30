const express = require('express');
const { body } = require('express-validator');
const {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

router.post(
  '/',
  authMiddleware,
  roleMiddleware('Admin', 'Editor'),
  [body('name').notEmpty().withMessage('Category name is required')],
  createCategory
);

router.get('/', getAllCategories);
router.get('/:id', getCategoryById);

router.put('/:id', authMiddleware, roleMiddleware('Admin', 'Editor'), updateCategory);
router.delete('/:id', authMiddleware, roleMiddleware('Admin', 'Editor'), deleteCategory);

module.exports = router;
