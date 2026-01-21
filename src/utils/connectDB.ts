import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGO_URI;
    
    if (!mongoURI) {
      console.error('❌ MONGO_URI is not defined in environment variables');
      console.error('⚠️  Bot will continue running but database features will not work.');
      return;
    }

    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log('✓ MongoDB already connected');
      return;
    }

    // Normalize connection string - use 127.0.0.1 instead of localhost to avoid IPv6 issues
    let normalizedURI = mongoURI;
    if (normalizedURI.includes('localhost')) {
      normalizedURI = normalizedURI.replace('localhost', '127.0.0.1');
      console.log(`[MongoDB] Normalized connection string (localhost -> 127.0.0.1)`);
    }

    // Connection options for better reliability
    const options = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
    };

    console.log(`[MongoDB] Attempting to connect to MongoDB...`);
    await mongoose.connect(normalizedURI, options);
    console.log('✓ MongoDB connected successfully');

    // Handle connection events
    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✓ MongoDB reconnected');
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('closed')) {
        console.error('');
        console.error('⚠️  MongoDB is not running or not accessible!');
        console.error('');
        console.error('To fix this, you can:');
        console.error('1. Start MongoDB with Docker: docker-compose up -d mongodb');
        console.error('2. Or install MongoDB locally and start the service');
        console.error('3. Or use MongoDB Atlas (cloud) and update MONGO_URI in .env');
        console.error('');
        console.error('⚠️  Bot will continue running but database features will not work.');
        console.error('');
      } else {
        console.error('Error details:', error.message);
      }
    }
    
    // Don't throw error - let bot continue running without database
    // This is better for development/testing
  }
};
