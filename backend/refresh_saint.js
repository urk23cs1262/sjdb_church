const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { fetchDailySaint, getDailySaint } = require('./src/services/saintService');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/sjdb_church');
  console.log('Connected to DB (sjdb_church). Fetching saint from Vatican News...');
  await fetchDailySaint();
  const saint = getDailySaint();
  console.log('Updated Saint:', saint.saintName);
  console.log('Image:', saint.image);
  await mongoose.disconnect();
}

run();
