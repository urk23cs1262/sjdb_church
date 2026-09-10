const Message = require('../models/Message');
const User = require('../models/User');
const { createNotification } = require('../services/notificationService');
const { sendPushToUser } = require('../services/webPushService');
const { sendMail } = require('../config/mailer');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Admin: Send direct message to a user ─────────────────────────────────────
exports.sendAdminMessage = async (req, res) => {
  try {
    const {
      recipientId,
      subject,
      message,
      priority = 'normal',
      type = 'admin_direct',
      sendEmail = true,
      sendPush = true,
      sendWhatsApp = false
    } = req.body;

    if (!recipientId || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Recipient, subject, and message content are required.' });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient parishioner not found.' });
    }

    const adminSender = req.user;
    const senderName = adminSender?.name ? `${adminSender.name} (Parish Administration)` : 'St. John de Britto Administration';

    // 1. Save in MongoDB
    const newMessage = await Message.create({
      senderId: adminSender?._id || recipientId,
      senderName,
      recipientId: recipient._id,
      subject: subject.trim(),
      message: message.trim(),
      priority,
      type,
      sentViaEmail: !!sendEmail,
      sentViaPush: !!sendPush,
      sentViaWhatsApp: !!sendWhatsApp
    });

    const clientUrl = (process.env.CLIENT_URL || 'https://stjb-church.vercel.app').replace('http://localhost:5173', 'https://stjb-church.vercel.app');
    const messagesUrl = `${clientUrl}/dashboard?tab=messages`;

    // 2. In-App Notification
    createNotification({
      userId: recipient._id,
      recipient: 'user',
      title: `Notice from Parish: ${subject}`,
      message: message.length > 180 ? `${message.slice(0, 180)}...` : message,
      type: 'message',
      category: 'announcements',
      priority: priority === 'urgent' ? 'high' : priority === 'important' ? 'medium' : 'low',
      actionUrl: '/dashboard?tab=messages',
      relatedId: newMessage._id,
      relatedModel: 'Message',
      channels: ['in_app']
    }).catch(err => console.warn('[MessageController] In-app notification error:', err.message));

    // 3. Web Push Notification
    if (sendPush) {
      sendPushToUser(recipient._id, {
        title: `Message: ${subject}`,
        body: message.length > 120 ? `${message.slice(0, 120)}...` : message,
        url: '/dashboard?tab=messages',
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: `sjdb-msg-${newMessage._id}`
      }).catch(err => console.warn('[MessageController] Web push error:', err.message));
    }

    // 4. Email Notification (Option B)
    if (sendEmail && recipient.email) {
      const priorityLabel = priority === 'urgent' ? 'Urgent Notice' : priority === 'important' ? 'Important Notice' : 'Parish Administration Notice';
      const priorityColor = priority === 'urgent' ? '#dc2626' : priority === 'important' ? '#d97706' : '#1e3a8a';
      const priorityBg = priority === 'urgent' ? '#fee2e2' : priority === 'important' ? '#fef3c7' : '#e0e7ff';

      const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(subject)}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 12px 8px !important; }
      .email-card { border-radius: 12px !important; }
      .email-body { padding: 20px 14px !important; }
      .email-header { padding: 25px 15px !important; }
      .btn-responsive { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div class="email-wrapper" style="background-color: #f8fafc; padding: 24px 12px; width: 100%; box-sizing: border-box;">
    <div class="email-card" style="max-width: 580px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; box-sizing: border-box;">
      
      <!-- HEADER -->
      <div class="email-header" style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 30px 20px; text-align: center; color: #ffffff;">
        <div style="width: 75px; height: 75px; background: #ffffff; border-radius: 50%; margin: 0 auto 12px; overflow: hidden; border: 3px solid #fbbf24; box-shadow: 0 4px 14px rgba(0,0,0,0.25);">
          <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
        </div>
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #fbbf24; letter-spacing: 0.5px;">St. John de Britto's Church</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #e2e8f0; font-weight: 500;">புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்</p>
        <div style="display: inline-block; margin-top: 12px; padding: 4px 14px; background: ${priorityBg}; color: ${priorityColor}; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;">
          ${priorityLabel}
        </div>
      </div>

      <!-- BODY -->
      <div class="email-body" style="padding: 26px 20px;">
        <p style="margin: 0 0 6px; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
          From: ${escapeHtml(senderName)}
        </p>
        <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.4;">
          ${escapeHtml(subject)}
        </h2>

        <p style="margin: 0 0 14px; font-size: 14.5px; color: #334155;">
          Dear <strong>${escapeHtml(recipient.name || 'Parishioner')}</strong>,
        </p>

        <!-- MESSAGE BOX -->
        <div style="background-color: #f8fafc; border-left: 4px solid #1e3a8a; padding: 18px; border-radius: 0 12px 12px 0; margin-bottom: 24px; font-size: 14px; line-height: 1.7; color: #1e293b; white-space: pre-line; word-break: break-word;">
${escapeHtml(message)}
        </div>

        <!-- ACTION BUTTON -->
        <div style="text-align: center; margin-bottom: 22px;">
          <a href="${messagesUrl}" class="btn-responsive" style="display: inline-block; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 800; padding: 13px 30px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3); text-align: center;">
            View Messages in Parish Portal →
          </a>
        </div>

        <!-- MEMBER INFO FOOTER -->
        <div style="background-color: #f1f5f9; border-radius: 10px; padding: 12px 14px; font-size: 12px; color: #64748b; line-height: 1.5;">
          <strong>Member Name:</strong> ${escapeHtml(recipient.name)} &bull; <strong>Parish ID:</strong> <span style="font-family: monospace;">${escapeHtml(recipient.parishMemberId || '—')}</span>
        </div>

        <!-- DYNAMIC_BIBLE_VERSE -->
      </div>

      <!-- FOOTER -->
      <div style="background-color: #0f172a; padding: 16px 18px; text-align: center; color: #94a3b8; font-size: 11.5px;">
        <p style="margin: 0; font-weight: 700; color: #f8fafc;">St. John de Britto's Church, Kalayarkoil</p>
        <p style="margin: 4px 0 0; color: #64748b;">Official Parish Communication • <a href="${clientUrl}" style="color: #fbbf24; text-decoration: none;">Website</a></p>
      </div>

    </div>
  </div>
</body>
</html>
      `;

      sendMail({
        to: recipient.email,
        subject: `SJDB Church -  ${subject}`,
        html: emailHtml
      }).catch(err => console.warn('[MessageController] Email sending error:', err.message));
    }

    // 5. WhatsApp Notification (if selected)
    if (sendWhatsApp && recipient.phone) {
      const waMsg = `*St. John de Britto's Church, Kalayarkoil*\n*Message from Administration*\n\nDear *${recipient.name}*,\n\n*Subject:* ${subject}\n\n${message}\n\n*View on Website:*\n${messagesUrl}\n\n_புனித அருளானந்தர் தேவாலயம், காளையார்கோவில்_`;
      require('../bot/whatsapp').sendWhatsAppMessage(recipient.phone, waMsg).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully to parishioner.',
      data: newMessage
    });
  } catch (err) {
    console.error('[MessageController] sendAdminMessage error:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal server error while sending message.' });
  }
};

// ── Admin: Get message thread / history with a user ──────────────────────────
exports.getAdminUserThread = async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await Message.find({ recipientId: userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      messages
    });
  } catch (err) {
    console.error('[MessageController] getAdminUserThread error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin: Delete a message ──────────────────────────────────────────────────
exports.deleteAdminMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Message.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }
    res.json({ success: true, message: 'Message deleted successfully.' });
  } catch (err) {
    console.error('[MessageController] deleteAdminMessage error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── User: Get user's own message inbox ───────────────────────────────────────
exports.getUserMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await Message.countDocuments({ recipientId: userId });
    const unreadCount = await Message.countDocuments({ recipientId: userId, isRead: false });

    const messages = await Message.find({ recipientId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      messages,
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('[MessageController] getUserMessages error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── User: Get unread count ───────────────────────────────────────────────────
exports.getUserUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const unreadCount = await Message.countDocuments({ recipientId: userId, isRead: false });
    res.json({
      success: true,
      unreadCount
    });
  } catch (err) {
    console.error('[MessageController] getUserUnreadCount error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── User: Mark a message as read ─────────────────────────────────────────────
exports.markMessageAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const message = await Message.findOneAndUpdate(
      { _id: id, recipientId: userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    const unreadCount = await Message.countDocuments({ recipientId: userId, isRead: false });

    res.json({
      success: true,
      message,
      unreadCount
    });
  } catch (err) {
    console.error('[MessageController] markMessageAsRead error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── User: Mark all messages as read ──────────────────────────────────────────
exports.markAllMessagesAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await Message.updateMany(
      { recipientId: userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    res.json({
      success: true,
      message: 'All messages marked as read.',
      updatedCount: result.modifiedCount
    });
  } catch (err) {
    console.error('[MessageController] markAllMessagesAsRead error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── User: Delete message ─────────────────────────────────────────────────────
exports.deleteUserMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const deleted = await Message.findOneAndDelete({ _id: id, recipientId: userId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    res.json({ success: true, message: 'Message removed from your inbox.' });
  } catch (err) {
    console.error('[MessageController] deleteUserMessage error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
