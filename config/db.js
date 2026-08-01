const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/order_management_db';
    
    // Explicit in-memory mode check (for testing without external database)
    if (process.env.USE_IN_MEMORY_DB === 'true') {
      console.log('⚡ USE_IN_MEMORY_DB=true: Using temporary MongoDB Memory Server (Data will reset on restart)');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      const conn = await mongoose.connect(uri);
      console.log(`✅ Temporary In-Memory MongoDB Connected: ${conn.connection.host}`);
      return conn;
    }

    // Connect persistently to MONGO_URI (MongoDB Atlas / local MongoDB)
    console.log(`📡 Connecting to Persistent MongoDB Database...`);
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000, // 30s timeout for cloud connections
    });
    console.log(`✅ Persistent MongoDB Connected: ${conn.connection.host} / DB: ${conn.connection.name}`);
    return conn;

  } catch (error) {
    console.error(`❌ Persistent Database Connection Failed: ${error.message}`);
    console.error(`Please check your MONGO_URI environment variable and MongoDB Atlas IP access rules (whitelist 0.0.0.0/0).`);
    process.exit(1);
  }
};

module.exports = connectDB;
