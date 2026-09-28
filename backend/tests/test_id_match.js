const mongoose = require('mongoose');
const Document = require('../src/models/Document');
const PrayerRequest = require('../src/models/PrayerRequest');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sjdb_church');
  console.log('Connected to MongoDB');
  
  const anyDoc = await Document.findOne();
  if (anyDoc) {
    const rawHex = anyDoc._id.toString().slice(-6);
    console.log('Testing Document with rawHex:', rawHex);

    // Test 1: Old way (should fail or throw)
    try {
      await Document.findOne({ _id: { $regex: rawHex + '$', $options: 'i' } });
      console.log('Old query succeeded?');
    } catch (e) {
      console.log('Old query failed as expected:', e.message);
    }

    // Test 2: $expr with $regexMatch with cleanHex
    try {
      const cleanHex = rawHex.replace(/[^0-9a-fA-F]/g, '');
      const found = await Document.findOne({
        $expr: {
          $regexMatch: {
            input: { $toString: '$_id' },
            regex: cleanHex + '$',
            options: 'i'
          }
        }
      });
      console.log('Test 2 ($expr regexMatch) succeeded:', found ? found._id.toString() : 'not found');
    } catch (e) {
      console.log('Test 2 failed:', e.message);
    }
  } else {
    console.log('No documents in Document collection');
  }

  const anyPrayer = await PrayerRequest.findOne();
  if (anyPrayer) {
    const rawHex = anyPrayer._id.toString().slice(-6);
    console.log('Testing PrayerRequest with rawHex:', rawHex);
    try {
      const cleanHex = rawHex.replace(/[^0-9a-fA-F]/g, '');
      const found = await PrayerRequest.findOne({
        $expr: {
          $regexMatch: {
            input: { $toString: '$_id' },
            regex: cleanHex + '$',
            options: 'i'
          }
        }
      });
      console.log('Test 2 for Prayer ($expr regexMatch) succeeded:', found ? found._id.toString() : 'not found');
    } catch (e) {
      console.log('Test 2 for Prayer failed:', e.message);
    }
  }

  process.exit(0);
}
run();
