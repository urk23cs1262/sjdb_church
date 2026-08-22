require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function testUserOrder() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sjdb_church');
  
  const users = await User.find({}).select('name parishMemberId createdAt').sort({ createdAt: 1 });
  console.log('=== USERS ORDER (ASCENDING - NEW USERS APPENDED AT LAST) ===\n');
  users.forEach((u, i) => {
    console.log(`${i + 1}. [${u.parishMemberId || 'NO ID'}] ${u.name} (Registered: ${u.createdAt?.toISOString()})`);
  });
  
  process.exit(0);
}

testUserOrder();
