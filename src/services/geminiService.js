const { GoogleGenerativeAI } = require('@google/generative-ai');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = (promise, ms = 15000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini request timed out after ${ms}ms`)), ms)
    ),
  ]);
};

const callGemini = async (prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }

  const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const candidateModels = [
    preferredModel,
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
  ].filter((m, i, arr) => arr.indexOf(m) === i && !!m);

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const generatePromise = (async () => {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      })();

      const text = await withTimeout(generatePromise, 15000);

      if (text && text.trim()) {
        return text;
      }
    } catch (err) {
      lastError = err;
      const msg = err.message || '';
      console.warn(`Gemini attempt with model ${modelName} notice: ${msg.slice(0, 120)}`);

      if (msg.includes('429') || msg.includes('quota') || msg.includes('503')) {
        await sleep(1500);
      }
    }
  }

  console.error('All Gemini model candidates failed:', lastError ? lastError.message : 'Unknown error');
  throw new Error(`Gemini generation failed: ${lastError ? lastError.message : 'Unable to generate response'}`);
};

module.exports = {
  callGemini,
};