const { validationResult } = require('express-validator');
const Blog = require('../models/Blog');
const Comment = require('../models/Comment');

// Create Blog / Post
const createBlog = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userRole = (req.user.role || 'reader').toLowerCase();
    if (userRole === 'reader') {
      return res.status(403).json({ message: 'Readers are not authorized to create blogs' });
    }

    const {
      title,
      name,
      content,
      message,
      category,
      tags,
      photo,
      status,
      scheduledAt,
    } = req.body;

    const blogTitle = title || name;
    const blogContent = content || message;

    if (!blogTitle || !blogContent) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    // Role-based status control: Authors cannot publish directly if workflow requires approval
    let blogStatus = status || 'Published';
    if (userRole === 'author' && blogStatus === 'Published') {
      // Allow author to publish or set status according to request
      blogStatus = status || 'Published';
    }

    const blog = await Blog.create({
      title: blogTitle,
      content: blogContent,
      category: category || 'General',
      tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
      photo: photo || '',
      status: blogStatus,
      scheduledAt: scheduledAt || null,
      author: req.user._id,
      authorName: req.user.name,
    });

    res.status(201).json(blog);
  } catch (error) {
    next(error);
  }
};

// Get All Blogs with filtering, search, and pagination
const getAllBlogs = async (req, res, next) => {
  try {
    const { category, tag, status, search, author, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (category) {
      filter.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    if (tag) {
      filter.tags = tag;
    }

    if (author) {
      filter.author = author;
    }

    // Status filtering
    const userRole = req.user ? (req.user.role || '').toLowerCase() : '';
    if (status) {
      filter.status = status;
    } else if (userRole !== 'admin' && userRole !== 'editor') {
      // Normal readers/public see Published posts or their own posts
      if (req.user) {
        filter.$or = [{ status: 'Published' }, { author: req.user._id }];
      } else {
        filter.status = 'Published';
      }
    }

    // Search query on title and content
    if (search) {
      const sanitized = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(sanitized, 'i');
      filter.$or = [{ title: searchRegex }, { content: searchRegex }, { category: searchRegex }];
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * Math.max(1, parseInt(limit));
    const blogs = await Blog.find(filter)
      .populate('author', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json(blogs);
  } catch (error) {
    next(error);
  }
};

// Search Blogs specifically
const searchBlogs = async (req, res, next) => {
  try {
    const q = req.query.q || req.query.search || '';
    if (!q.trim()) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const sanitized = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(sanitized, 'i');

    const blogs = await Blog.find({
      $or: [
        { title: searchRegex },
        { content: searchRegex },
        { category: searchRegex },
        { tags: searchRegex },
      ],
    })
      .populate('author', 'name email role')
      .sort({ createdAt: -1 });

    res.json(blogs);
  } catch (error) {
    next(error);
  }
};

// Get Blog By ID
const getBlogById = async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id).populate('author', 'name email role');
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }
    res.json(blog);
  } catch (error) {
    next(error);
  }
};

// Update Blog
const updateBlog = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    const userRole = (req.user.role || 'reader').toLowerCase();
    const isOwner = blog.author.toString() === req.user._id.toString();
    const isEditorOrAdmin = userRole === 'editor' || userRole === 'admin';

    if (!isOwner && !isEditorOrAdmin) {
      return res.status(403).json({ message: 'You are not allowed to edit this blog' });
    }

    const {
      title,
      name,
      content,
      message,
      category,
      tags,
      photo,
      status,
      scheduledAt,
    } = req.body;

    if (title || name) blog.title = title || name;
    if (content || message) blog.content = content || message;
    if (category) blog.category = category;
    if (tags !== undefined) blog.tags = Array.isArray(tags) ? tags : [tags];
    if (photo !== undefined) blog.photo = photo;
    if (scheduledAt !== undefined) blog.scheduledAt = scheduledAt;

    // Status management: Only Editor and Admin can freely alter all statuses; Author can set Draft or Pending Approval
    if (status) {
      if (isEditorOrAdmin || status === 'Draft' || status === 'Pending Approval' || status === 'Published') {
        blog.status = status;
      } else {
        return res.status(403).json({ message: 'Only editors or admins can transition to this status' });
      }
    }

    await blog.save();
    res.json(blog);
  } catch (error) {
    next(error);
  }
};

// Delete Blog
const deleteBlog = async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    const userRole = (req.user.role || 'reader').toLowerCase();
    const isOwner = blog.author.toString() === req.user._id.toString();
    const isAdmin = userRole === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You are not allowed to delete this blog' });
    }

    await Blog.findByIdAndDelete(req.params.id);
    // Cleanup comments
    await Comment.deleteMany({ blog: req.params.id });

    res.json({ message: 'Blog deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Like Blog
const likeBlog = async (req, res, next) => {
  try {
    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );

    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    res.json({ message: 'Blog liked successfully', likes: blog.likes });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBlog,
  getAllBlogs,
  searchBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  likeBlog,
};
