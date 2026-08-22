require('dotenv').config();
const mongoose = require('mongoose');

const checkAdmins = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    
    // Using a generic schema to find users since I don't want to import the model and deal with paths
    const User = mongoose.model('User', new mongoose.Schema({ email: String, role: String }));
    
    const admins = await User.find({ role: 'admin' });
    console.log('Admin Users:');
    admins.forEach(a => console.log(`- ${a.email}`));
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

checkAdmins();
