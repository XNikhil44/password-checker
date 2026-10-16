const { send } = require('../lib/security');

// GET /api/health: tells the frontend whether AI advice is configured.
module.exports = (req, res) => {
  send(res, 200, { ok: true, ai: Boolean(process.env.GEMINI_API_KEY) });
};
