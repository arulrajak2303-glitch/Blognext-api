const express = require('express');
const { body } = require('express-validator');
const {
  createComment,
  getAllComments,
  moderateComment,
  deleteComment,
} = require('../controllers/commentController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Create comment directly
router.post(
  '/',
  authMiddleware,
  [
    body('blogId').optional().notEmpty().withMessage('Blog ID is required'),
    body('postId').optional().notEmpty().withMessage('Post ID is required'),
  ],
  createComment
);

// Admin/Editor comments list for moderation
router.get('/', authMiddleware, roleMiddleware('Admin', 'Editor'), getAllComments);

// Moderate comment status (Admin & Editor)
router.put(
  '/:id/moderate',
  authMiddleware,
  roleMiddleware('Admin', 'Editor'),
  [body('status').isIn(['approved', 'pending', 'spam']).withMessage('Invalid status')],
  moderateComment
);

// Delete comment (Author or Admin)
router.delete('/:id', authMiddleware, deleteComment);

module.exports = router;
