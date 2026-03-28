require('dotenv').config();

const http = require('http');

const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');
const { initSocket } = require('./socket/socket');

const startServer = async () => {
  // Connect to MongoDB before accepting any requests
  await connectDB();

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(port, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
  });
};

startServer();
