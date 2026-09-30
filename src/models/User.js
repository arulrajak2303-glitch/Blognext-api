const mongoose = require('mongoose');

const validRoles = ['Admin', 'Editor', 'Author', 'Reader'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    role: {
      type: String,
      enum: {
        values: ['Admin', 'Editor', 'Author', 'Reader', 'admin', 'editor', 'author', 'reader'],
        message: 'Role must be one of Admin, Editor, Author, Reader',
      },
      default: 'Reader',
      set: (val) => {
        if (!val) return 'Reader';
        const formatted = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
        return validRoles.includes(formatted) ? formatted : val;
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
