require('dotenv').config();
const mongoose = require('mongoose');

const deleteInvalidAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    
    const User = mongoose.model('User', new mongoose.Schema({ email: String, role: String }));
    
    const result = await User.deleteOne({ email: 'admin@sjdb.in' });
    
    if (result.deletedCount > 0) {
      console.log('✅ Invalid admin user (admin@sjdb.in) deleted successfully.');
    } else {
      console.log('❌ No user found with email admin@sjdb.in');
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

deleteInvalidAdmin();
