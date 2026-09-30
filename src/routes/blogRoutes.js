const express = require('express');
const { body } = require('express-validator');
const {
  createBlog,
  getAllBlogs,
  searchBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  likeBlog,
} = require('../controllers/blogController');
const {
  createComment,
  getCommentsForBlog,
} = require('../controllers/commentController');
const authMiddleware = require('../middleware/authMiddleware');
const { optionalAuthMiddleware } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Search blogs
router.get('/search', optionalAuthMiddleware, searchBlogs);

// Create blog (Admin, Editor, Author)
router.post(
  '/',
  authMiddleware,
  roleMiddleware('Admin', 'Editor', 'Author'),
  [
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('content').optional().notEmpty().withMessage('Content cannot be empty'),
    body('message').optional().notEmpty().withMessage('Message cannot be empty'),
  ],
  createBlog
);

// Get all blogs (filtered & searchable)
router.get('/', optionalAuthMiddleware, getAllBlogs);

// Get single blog by ID
router.get('/:id', optionalAuthMiddleware, getBlogById);

// Update blog (Author, Editor, Admin)
router.put(
  '/:id',
  authMiddleware,
  [
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('content').optional().notEmpty().withMessage('Content cannot be empty'),
    body('message').optional().notEmpty().withMessage('Message cannot be empty'),
  ],
  updateBlog
);

// Delete blog (Author, Admin)
router.delete('/:id', authMiddleware, deleteBlog);

// Like blog
router.post('/:id/like', authMiddleware, likeBlog);

// Blog comments sub-resource
router.post(
  '/:id/comments',
  authMiddleware,
  [
    body('content').optional().notEmpty().withMessage('Comment content cannot be empty'),
    body('message').optional().notEmpty().withMessage('Comment message cannot be empty'),
  ],
  createComment
);

router.get('/:id/comments', optionalAuthMiddleware, getCommentsForBlog);

module.exports = router;
