module.exports = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'precofixo17-backend',
    platform: 'vercel',
    timestamp: new Date().toISOString(),
  });
};
