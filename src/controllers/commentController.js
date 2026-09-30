const { validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const Blog = require('../models/Blog');

// Create comment on a blog
const createComment = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const blogId = req.params.id || req.body.blogId || req.body.postId;
    const { content, message } = req.body;
    const commentBody = content || message;

    if (!commentBody) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    const comment = await Comment.create({
      blog: blog._id,
      user: req.user._id,
      userName: req.user.name,
      content: commentBody,
      status: 'approved', // Auto-approved for verified authenticated users
    });

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};

// Get comments for a specific blog
const getCommentsForBlog = async (req, res, next) => {
  try {
    const blogId = req.params.id;
    const userRole = req.user ? (req.user.role || '').toLowerCase() : '';
    const filter = { blog: blogId };

    // Readers only see approved comments; Admin and Editor see all
    if (userRole !== 'admin' && userRole !== 'editor') {
      filter.status = 'approved';
    }

    const comments = await Comment.find(filter)
      .populate('user', 'name role')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    next(error);
  }
};

// Get all comments for moderation queue (Admin & Editor)
const getAllComments = async (req, res, next) => {
  try {
    const { status, blogId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (blogId) filter.blog = blogId;

    const comments = await Comment.find(filter)
      .populate('user', 'name email role')
      .populate('blog', 'title')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    next(error);
  }
};

// Moderate comment status (Admin & Editor only)
const moderateComment = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['approved', 'pending', 'spam'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid moderation status. Must be approved, pending, or spam',
      });
    }

    const comment = await Comment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    res.json({ message: `Comment status updated to ${status}`, comment });
  } catch (error) {
    next(error);
  }
};

// Delete comment (Author or Admin)
const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const userRole = (req.user.role || 'reader').toLowerCase();
    const isOwner = comment.user.toString() === req.user._id.toString();
    const isAdmin = userRole === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You are not allowed to delete this comment' });
    }

    await Comment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createComment,
  getCommentsForBlog,
  getAllComments,
  moderateComment,
  deleteComment,
};
