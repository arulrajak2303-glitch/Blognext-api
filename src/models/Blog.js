const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      alias: 'name',
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      alias: 'message',
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      default: 'General',
    },
    tags: {
      type: [String],
      default: [],
    },
    photo: {
      type: String,
      default: '',
    },
    likes: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Draft', 'Pending Approval', 'Scheduled', 'Published'],
      default: 'Published',
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      alias: 'userID',
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
blogSchema.index({ title: 'text', content: 'text' });
blogSchema.index({ category: 1 });
blogSchema.index({ status: 1 });
blogSchema.index({ author: 1 });

module.exports = mongoose.model('Blog', blogSchema);
