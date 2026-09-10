const cron = require('node-cron');
const User = require('../models/User');
const { createNotification } = require('./notificationService');

const sendBirthdayWishes = async () => {
  try {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // Find users whose DOB month and day match today
    const birthdayUsers = await User.find({
      $expr: {
        $and: [
          { $eq: [{ $month: "$dob" }, month] },
          { $eq: [{ $dayOfMonth: "$dob" }, day] },
          { $eq: ["$isActive", true] }
        ]
      }
    });

    console.log(` Checking birthdays for ${today.toDateString()}... Found ${birthdayUsers.length} users.`);

    for (const user of birthdayUsers) {
      const title = "Birthday Blessings";
      const message = `Dear ${user.name}, St. John de Britto's Church wishes you a very Happy Birthday! May God bless you with abundant joy, health, and peace on your special day. `;

      // Send via email and SMS
      await createNotification({
        userId: user._id,
        isBroadcast: false,
        title,
        message,
        type: 'general',
        channels: ['email']
      });

      console.log(` Birthday wish sent to ${user.name} (${user.phone})`);
    }
  } catch (err) {
    console.error(' Birthday Service Error:', err.message);
  }
};

// Schedule to run every day at 9:00 AM
cron.schedule('0 9 * * *', () => {
  console.log(' Running daily birthday wishes job...');
  sendBirthdayWishes();
});

// For testing purposes: also run 1 minute after server starts if needed
// setTimeout(sendBirthdayWishes, 60000);

module.exports = { sendBirthdayWishes };
