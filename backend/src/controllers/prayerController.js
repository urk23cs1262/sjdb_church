const PrayerRequest = require('../models/PrayerRequest');
const User = require('../models/User');
const { notifyAdmins, createNotification } = require('../services/notificationService');
const { sendMail } = require('../config/mailer');

function sendWA(phone, text) {
  return require('../bot/whatsapp').sendWhatsAppMessage(phone, text).catch(() => {});
}

const getPublic = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = {
      isPublic: true,
      status: 'approved',
      $or: [
        { preferredDate: { $gte: today } },
        { preferredDate: { $exists: false } },
        { preferredDate: null }
      ]
    };

    const prayers = await PrayerRequest.find(query).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, prayers });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = {};
    if (status === 'completed') {
      query.$or = [
        { status: 'completed' },
        { preferredDate: { $lt: today } }
      ];
    } else if (status === 'pending' || status === 'approved' || status === 'rejected') {
      query.status = status;
      query.$or = [
        { preferredDate: { $gte: today } },
        { preferredDate: { $exists: false } },
        { preferredDate: null }
      ];
    } else if (status) {
      query.status = status;
    }

    const prayers = await PrayerRequest.find(query).populate('userId', 'name email phone').sort({ createdAt: -1 });
    res.json({ success: true, prayers });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const create = async (req, res) => {
  try {
    const {
      intention, isPublic, name, email, phone, language, prayerLocation,
      churchLocation, type, preferredDate, preferredTime,
      confessionLocation, contactPhone
    } = req.body;

    const isConfession = prayerLocation === 'confession' || type === 'Confession Request';
    const finalIsPublic = isConfession ? false : Boolean(isPublic);
    const applicantName = name || req.user?.name || 'Anonymous';
    const userEmail = email || req.user?.email;
    const userPhone = contactPhone || phone || req.user?.phone;
    const finalIntention = (intention && String(intention).trim())
      ? String(intention).trim()
      : (isConfession
          ? `Confession Request (Sacrament of Reconciliation)`
          : 'Prayer Intention');

    const prayer = await PrayerRequest.create({
      userId: req.user?._id,
      name: applicantName,
      email: userEmail,
      intention: finalIntention,
      isPublic: finalIsPublic,
      language: language || 'en',
      prayerLocation: prayerLocation || 'personal',
      churchLocation,
      type: type || 'General Prayer Request',
      preferredDate,
      preferredTime,
      confessionLocation,
      contactPhone: userPhone
    });

    const notifTitle = isConfession ? ' New Confession Request' : ' New Prayer Request';
    const clientBaseUrl = (process.env.CLIENT_URL || 'https://st-jb-church.vercel.app').replace('http://localhost:5173', 'https://st-jb-church.vercel.app');
    const userActionUrl = isConfession ? '/dashboard' : '/prayer-requests';

    // 1. Admin In-App Notification (ActionUrl: /admin/prayers)
    createNotification({
      recipient: 'admin',
      title: notifTitle,
      message: `${applicantName} submitted a ${type || 'prayer request'}: "${finalIntention.slice(0, 100)}${finalIntention.length > 100 ? '...' : ''}".`,
      type: 'prayer',
      category: 'prayer',
      priority: 'high',
      actionUrl: '/admin/prayers',
      relatedId: prayer._id,
      relatedModel: 'PrayerRequest',
      channels: []
    }).catch(e => console.error('Prayer in-app admin notification error:', e.message));

    // 2. Email & WhatsApp to Admin alone
    notifyAdmins({
      title: notifTitle,
      message: `A new ${isConfession ? 'private confession request' : 'prayer request'} has been received:\n\n Name: ${applicantName}\n Type: ${type || 'Prayer'}\n Location: ${churchLocation || confessionLocation || (prayerLocation === 'personal' ? 'Home' : prayerLocation === 'church' ? 'Church' : prayerLocation === 'confession' ? 'Confession' : prayerLocation || 'Home')}\n${preferredDate ? ` Preferred Date: ${new Date(preferredDate).toLocaleDateString('en-IN')}\n` : ''}${preferredTime ? ` Preferred Time: ${preferredTime}\n` : ''}${userPhone ? ` Phone: ${userPhone}\n` : ''} Intention: ${finalIntention}\n\nReview & manage in Admin Panel: ${clientBaseUrl}/admin/prayers`
    }).catch(e => console.error('Prayer admin notification error:', e.message));

    // 3. User Notifications (In-App, Email, WhatsApp Bot) -> Submitted
    if (req.user?._id || userEmail || userPhone) {
      // User In-App Notification
      if (req.user?._id) {
        createNotification({
          userId: req.user._id,
          recipient: 'user',
          title: isConfession ? ' Confession Request Submitted' : ' Prayer Request Submitted',
          message: isConfession
            ? 'Your confidential confession request has been submitted to the Parish Priest.'
            : 'Your prayer request has been submitted and sent to the parish for review.',
          type: 'prayer',
          category: 'prayer',
          priority: 'medium',
          actionUrl: userActionUrl,
          relatedId: prayer._id,
          relatedModel: 'PrayerRequest',
          channels: []
        }).catch(e => console.error('User prayer submission notification error:', e.message));
      }

      // User WhatsApp Bot Message
      if (userPhone) {
        sendWA(userPhone, ` *${isConfession ? 'Confession Request Received' : 'Prayer Request Received'}*

Dear ${applicantName},
Your ${isConfession ? 'confidential confession request' : 'prayer intention'} has been submitted successfully to St. John de Britto's Church.

 *Type:* ${type}
 *Intention:* "${finalIntention.slice(0, 100)}${finalIntention.length > 100 ? '...' : ''}"

 *View Prayer Wall:* ${clientBaseUrl}${userActionUrl}

 _St. John de Britto's Church, Kalayarkoil_`);
      }
    }

    res.status(201).json({ success: true, prayer });
  } catch (err) { 
    console.error('Prayer creation error:', err);
    res.status(500).json({ success: false, message: err.message }); 
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const prayer = await PrayerRequest.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate('userId', 'name email phone');
    
    if (prayer) {
      const userObj = prayer.userId;
      const userEmail = userObj?.email || prayer.email;
      const userPhone = prayer.contactPhone || userObj?.phone;
      const isConfession = prayer.type === 'Confession Request';
      const isApproved = status === 'approved';
      const clientBaseUrl = (process.env.CLIENT_URL || 'https://st-jb-church.vercel.app').replace('http://localhost:5173', 'https://st-jb-church.vercel.app');
      const userActionUrl = isConfession ? '/dashboard' : '/prayer-requests';

      // 1. User In-App Notification
      if (userObj?._id) {
        createNotification({
          userId: userObj._id,
          recipient: 'user',
          title: isApproved
            ? (isConfession ? 'Confession Appointment Confirmed' : 'Prayer Request Approved')
            : (isConfession ? 'Confession Request Updated' : 'Prayer Request Update'),
          message: isApproved
            ? (isConfession
                ? 'Your confession request has been accepted by the Parish Priest.'
                : 'Your prayer intention has been approved and placed on the Prayer Wall / Mass Intentions.')
            : (isConfession
                ? 'Your confession request was reviewed by the Parish Priest. Please contact the parish office for alternative timing.'
                : 'Your prayer request update: Thank you for sharing your intention with our parish.'),
          type: 'prayer',
          category: 'prayer',
          priority: 'medium',
          actionUrl: userActionUrl,
          relatedId: prayer._id,
          relatedModel: 'PrayerRequest',
          channels: []
        }).catch(e => console.error('Status update in-app notification error:', e.message));
      }

      // 3. User WhatsApp Bot
      if (userPhone) {
        sendWA(userPhone, `*${prayer.type} Status Update*

Status: *${status.toUpperCase()}*
Intention: "${prayer.intention.slice(0, 100)}"

${isApproved ? 'May God bless you and grant your prayer intentions.' : 'Thank you for reaching out to St. John de Britto\'s Church.'}

*View Prayer Wall:* ${clientBaseUrl}${userActionUrl}

_St. John de Britto's Church, Kalayarkoil_`);
      }
    }

    res.json({ success: true, prayer });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deletePrayer = async (req, res) => {
  try {
    const prayer = await PrayerRequest.findByIdAndDelete(req.params.id);
    if (!prayer) return res.status(404).json({ success: false, message: 'Prayer request not found' });
    res.json({ success: true, message: 'Prayer request permanently deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteAllByStatus = async (req, res) => {
  try {
    const { status } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = {};
    if (status === 'completed') {
      query.$or = [
        { status: 'completed' },
        { preferredDate: { $lt: today } }
      ];
    } else if (status === 'pending' || status === 'approved' || status === 'rejected') {
      query.status = status;
      query.$or = [
        { preferredDate: { $gte: today } },
        { preferredDate: { $exists: false } },
        { preferredDate: null }
      ];
    }
    const result = await PrayerRequest.deleteMany(query);
    res.json({ success: true, message: `Permanently deleted all ${status || 'matching'} prayer requests`, count: result.deletedCount });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const incrementPrayer = async (req, res) => {
  try {
    const prayer = await PrayerRequest.findByIdAndUpdate(req.params.id, { $inc: { prayerCount: 1 } }, { new: true });
    res.json({ success: true, prayer });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getPublic, getAll, create, updateStatus, incrementPrayer, deletePrayer, deleteAllByStatus };
