const express = require('express');
const { body } = require('express-validator');
const {
  createTag,
  getAllTags,
  deleteTag,
} = require('../controllers/tagController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

router.post(
  '/',
  authMiddleware,
  roleMiddleware('Admin', 'Editor', 'Author'),
  [body('name').notEmpty().withMessage('Tag name is required')],
  createTag
);

router.get('/', getAllTags);
router.delete('/:id', authMiddleware, roleMiddleware('Admin', 'Editor'), deleteTag);

module.exports = router;
