const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  port: process.env.PORT || 3000,
  dataDir: path.join(__dirname, '..', 'data'),
  flightsFile: path.join(__dirname, '..', 'data', 'flights.json'),
  logsDir: path.join(__dirname, '..', 'data', 'logs'),
  azure: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    key: process.env.AZURE_OPENAI_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT
  },
  nodeEnv: process.env.NODE_ENV || 'development'
};
