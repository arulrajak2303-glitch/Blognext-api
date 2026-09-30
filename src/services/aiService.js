const { callGemini } = require('./geminiService');

module.exports = {
  callGemini,
  generateBlogContent: callGemini,
  summarizeContent: callGemini,
};
