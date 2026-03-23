require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');

const startServer = async () => {
  // Connect to MongoDB before accepting any requests
  await connectDB();

  app.listen(port, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
  });
};

startServer();
