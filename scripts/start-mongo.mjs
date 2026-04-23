#!/usr/bin/env node

import { MongoMemoryServer } from 'mongodb-memory-server';

try {
  console.log('🚀 Starting MongoDB in-memory server...');
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  
  console.log('✅ MongoDB is running');
  console.log(`📍 MongoDB URI: ${mongoUri}`);
  
  // Set environment variable for child processes
  process.env.DB_URL = mongoUri;
  
  // Keep the process alive
  console.log('🎯 MongoDB will stay active. Press Ctrl+C to stop.');
  
  process.on('SIGINT', async () => {
    console.log('\n⏹️  Shutting down MongoDB...');
    await mongod.stop();
    console.log('✅ MongoDB stopped');
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n⏹️  Shutting down MongoDB...');
    await mongod.stop();
    console.log('✅ MongoDB stopped');
    process.exit(0);
  });
} catch (error) {
  console.error('❌ Failed to start MongoDB:', error);
  process.exit(1);
}
