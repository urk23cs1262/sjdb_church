require('dotenv').config();
const mongoose = require('mongoose');

const fixAdminEmail = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    
    const User = mongoose.model('User', new mongoose.Schema({ email: String, role: String }));
    
    const result = await User.updateOne(
      { email: 'admin@sjdb.in' },
      { $set: { email: 'arndas777@gmail.com' } }
    );
    
    if (result.matchedCount > 0) {
      console.log('✅ Admin email updated from admin@sjdb.in to arndas777@gmail.com');
    } else {
      console.log('❌ No user found with email admin@sjdb.in');
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

fixAdminEmail();
