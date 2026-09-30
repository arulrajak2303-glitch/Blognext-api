const { validationResult } = require('express-validator');
const { callGemini } = require('../services/geminiService');
const Blog = require('../models/Blog');

const cleanGeneratedText = (text) => {
  if (!text) return '';
  return text
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*[\*\-\+]\s*/gm, '')
    .replace(/\*{1,3}(.+?)\*{1,3}/g, '$1')
    .replace(/[\*_]{2,}/g, '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const inferCategory = (topic) => {
  const normalized = topic.toLowerCase();
  const mapping = [
    { keywords: ['ai', 'technology', 'software', 'programming', 'cloud', 'coding'], category: 'Technology' },
    { keywords: ['learning', 'school', 'education', 'teaching', 'study', 'student'], category: 'Education' },
    { keywords: ['health', 'fitness', 'medicine', 'wellness', 'mental', 'diet'], category: 'Health' },
    { keywords: ['sports', 'football', 'basketball', 'soccer', 'athlete', 'cricket'], category: 'Sports' },
    { keywords: ['lifestyle', 'fashion', 'travel', 'home', 'beauty'], category: 'Lifestyle' },
    { keywords: ['business', 'startup', 'finance', 'economy', 'marketing'], category: 'Business' },
    { keywords: ['travel', 'tourism', 'destination', 'adventure', 'holiday'], category: 'Travel' },
    { keywords: ['money', 'investment', 'stocks', 'banking', 'crypto'], category: 'Finance' },
    { keywords: ['entertainment', 'movies', 'music', 'celebrity', 'gaming'], category: 'Entertainment' },
  ];

  const match = mapping.find((item) => item.keywords.some((keyword) => normalized.includes(keyword)));
  return match ? match.category : 'General';
};

const generateBlog = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { topic, category } = req.body;
    const prompt = `Write a well-structured, engaging blog post about "${topic}". Include a catchy title, a strong introduction, key insights, and a conclusion. Provide the body in clear paragraphs (100-150 words). Avoid markdown headers or asterisks.`;

    const result = await callGemini(prompt);
    const content = cleanGeneratedText(result);
    const title = `Guide to ${topic.charAt(0).toUpperCase() + topic.slice(1)}`;
    const resolvedCategory = category || inferCategory(topic);

    // If caller is authenticated, persist to MongoDB
    if (req.user && req.user._id) {
      const blog = await Blog.create({
        title,
        content,
        category: resolvedCategory,
        author: req.user._id,
        authorName: req.user.name,
        status: 'Published',
      });
      return res.status(201).json(blog);
    }

    // Unauthenticated response
    res.status(200).json({
      title,
      content,
      category: resolvedCategory,
      message: 'AI blog generated successfully',
    });
  } catch (error) {
    console.error('AI Blog Generation Error:', error.message);
    res.status(500).json({
      status: 'error',
      message: `AI blog generation failed: ${error.message}`,
    });
  }
};

const summarizeBlog = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { content } = req.body;
    const prompt = `Summarize the following blog post content in one clear, concise paragraph (under 60 words):\n\n${content}`;
    const summaryText = await callGemini(prompt);

    res.json({
      summary: cleanGeneratedText(summaryText),
    });
  } catch (error) {
    console.error('AI Summarization Error:', error.message);
    res.status(500).json({
      status: 'error',
      message: `AI summarization failed: ${error.message}`,
    });
  }
};

module.exports = {
  generateBlog,
  summarizeBlog,
  cleanGeneratedText,
  inferCategory,
};
