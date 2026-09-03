const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Gallery = require('./src/models/Gallery');

async function cleanGallery() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/st_john_de_britto';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB...');

    const result = await Gallery.deleteMany({});
    console.log(`Deleted ${result.deletedCount} items from Gallery collection.`);

    await mongoose.disconnect();
    console.log('Disconnected.');
  } catch (err) {
    console.error('Error cleaning gallery:', err);
  }
}

cleanGallery();
