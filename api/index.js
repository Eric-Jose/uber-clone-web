// Vercel Node.js Function entrypoint for the PreçoFixo17 backend.
// The Express app keeps its existing /api/* routes; Vercel forwards them here.
const { app } = require('../backend/server');

module.exports = app;
