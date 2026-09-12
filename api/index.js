let app;
let bootError = null;

try {
  app = require('../server').app;
} catch (error) {
  bootError = error;
  console.error('PreçoFixo17 API boot error:', error);
}

if (bootError || !app) {
  module.exports = (req, res) => {
    res.status(500).json({
      error: 'Backend failed to initialize',
      message: bootError?.message || 'Express app was not created',
      name: bootError?.name || 'BootError',
      stack: process.env.NODE_ENV === 'production' ? undefined : bootError?.stack,
    });
  };
} else {
  module.exports = app;
}
