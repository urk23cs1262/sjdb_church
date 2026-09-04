const PermissionRequest = require('../models/PermissionRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendMail } = require('../config/mailer');
const { sendWhatsAppMessage, sendWhatsAppToUser } = require('../bot/whatsapp');

// Helper to set nested property by path string e.g. "notifications.eventReminders"
function setNestedPath(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// Admin creates a permission request
exports.createRequest = async (req, res) => {
  try {
    const { userId, reason, requestedChanges } = req.body;
    if (!userId || !reason || !requestedChanges || Object.keys(requestedChanges).length === 0) {
      return res.status(400).json({ message: 'User ID, reason, and requested changes are required.' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    // Cancel/supersede any existing pending permission requests for this user so only ONE active request exists at a time
    await PermissionRequest.updateMany(
      { userId, status: 'pending' },
      { $set: { status: 'superseded' } }
    );
    await Notification.deleteMany({
      userId,
      isRead: false,
      $or: [{ relatedModel: 'PermissionRequest' }, { category: 'permission' }]
    });

    const request = await PermissionRequest.create({
      userId,
      adminId: req.user._id,
      reason,
      requestedChanges,
      status: 'pending'
    });

    // Notify user in-app
    await Notification.create({
      userId,
      title: 'Settings Change Approval Required',
      message: `${req.user.name} requested changes to your settings. Reason: "${reason}". Please review and approve/reject.`,
      type: 'permission',
      category: 'permission',
      actionUrl: `/dashboard/notifications?requestId=${request._id}`,
      relatedId: request._id,
      relatedModel: 'PermissionRequest'
    });

    const clientUrl = process.env.CLIENT_URL?.replace('http://localhost:5173', 'https://stjb-church.vercel.app') || 'https://stjb-church.vercel.app';

    // Send immediate WhatsApp notification to target user via WhatsApp bot (session-aware)
    const changeList = Object.values(requestedChanges).map(d => `• *${d.label}*: ${String(d.old)} ${String(d.new)}`).join('\n');
    const waMsg = ` *Action Required: Settings Permission Request*

Hello *${targetUser.name}*, administrator *${req.user.name}* requested updates to your account settings.

 *Reason:* "${reason}"

 *Proposed Changes:*
${changeList}

 *Review & Approve/Reject on Website:*
${clientUrl}/dashboard/notifications?requestId=${request._id}

 _For your privacy, settings will NOT take effect until you approve._
 _St. John de britto Church, Kalayarkoil_`;

    sendWhatsAppToUser(targetUser, waMsg).catch(err => console.warn('User WA notification error:', err.message));


    // Send immediate detailed email to user if email exists
    if (targetUser.email) {
      const diffCards = Object.entries(requestedChanges).map(([key, diff]) => `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; margin-bottom:10px; text-align:left;">
          <div style="font-weight:700; color:#1e293b; font-size:14px; margin-bottom:6px;">
            ${diff.label}
          </div>
          <div style="font-size:12px; color:#475569; display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
            <span>Current: <strong style="color:#64748b; background:#e2e8f0; padding:2px 6px; border-radius:4px; font-family:monospace;">${String(diff.old)}</strong></span>
            <span style="color:#d4a017; font-weight:bold;">→</span>
            <span>Proposed: <strong style="color:#1e3a8a; background:#dbeafe; padding:2px 6px; border-radius:4px; font-family:monospace;">${String(diff.new)}</strong></span>
          </div>
        </div>
      `).join('');

      const emailHtml = `
<div style="background:#f1f5f9; padding:15px 10px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:550px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 6px 20px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%); padding:28px 18px; text-align:center;">
      <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; overflow:hidden; border:3px solid #fbbf24; background:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.25);">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="margin:0; color:#fbbf24; font-size:22px; font-weight:800;">St. John de britto Church</h1>
      <p style="margin:4px 0 0; color:#ffffff; opacity:0.9; font-size:13px;">Parish Privacy & Governance</p>
    </div>
    <div style="padding:22px 18px;">
      <h2 style="color:#1e3a8a; margin-top:0; font-size:18px; text-align:center;">Settings Approval Required</h2>
      <p style="color:#334155; font-size:14px; line-height:1.5;">Hello <strong>${targetUser.name}</strong>,</p>
      <p style="color:#475569; font-size:13px; line-height:1.5; margin-bottom:18px;">Administrator <strong>${req.user.name}</strong> has submitted a request to update your account settings.</p>
      
      <div style="background:#fffbe6; border-left:4px solid #f59e0b; padding:12px 14px; border-radius:8px; margin-bottom:20px;">
        <p style="margin:0; color:#92400e; font-size:12px; font-weight:700; text-transform:uppercase;">Reason Provided:</p>
        <p style="margin:4px 0 0; color:#78350f; font-size:13px; font-style:italic;">"${reason}"</p>
      </div>

      <h3 style="color:#1e293b; font-size:14px; margin-top:20px; margin-bottom:12px; font-weight:700;">Requested Preference Changes (${Object.keys(requestedChanges).length}):</h3>
      
      ${diffCards}

      <div style="margin-top:25px; text-align:center;">
        <a href="${clientUrl}/dashboard/notifications?requestId=${request._id}" style="background:linear-gradient(135deg, #1e3a8a, #0f172a); color:#fbbf24; font-weight:700; font-size:15px; text-decoration:none; padding:14px 28px; border-radius:12px; display:inline-block; box-shadow:0 4px 14px rgba(30,58,138,0.35); border:1px solid #fbbf24;">
           Review the Permission
        </a>
      </div>

      <p style="color:#94a3b8; font-size:11px; text-align:center; margin-top:20px; line-height:1.5;">
         For your privacy, these settings will <strong>NOT</strong> take effect until you review and approve them in your User Dashboard.
      </p>
    </div>
    <div style="background:#0f172a; padding:16px; text-align:center; color:#94a3b8; font-size:11px;">
      <p style="margin:0;">St. John de britto Church, Kalayarkoil</p>
      <p style="margin:4px 0 0; color:#64748b;">© ${new Date().getFullYear()} St. John de Britto Church. All rights reserved.</p>
    </div>
  </div>
</div>
      `;

      sendMail({
        to: targetUser.email,
        subject: `Account Settings Approval Required — St. John de britto Church`,
        html: emailHtml
      }).then(res => {
        if (res.success) console.log(` Settings approval email dispatched to ${targetUser.email}`);
        else console.warn(` Email skipped/failed for ${targetUser.email}: ${res.error}`);
      }).catch(err => console.error(` Email dispatch error: ${err.message}`));
    }

    res.status(201).json({ message: 'Permission request created successfully', request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Logged-in user gets their pending requests
exports.getUserPendingRequests = async (req, res) => {
  try {
    const requests = await PermissionRequest.find({
      userId: req.user._id,
      status: 'pending'
    }).populate('adminId', 'name email role phone profilePhoto').sort({ createdAt: -1 });

    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Logged-in user responds (Approve/Reject)
exports.respondToRequest = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid response status.' });
    }

    const request = await PermissionRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    if (request.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to respond to this request.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed.' });
    }

    request.status = status;

    if (status === 'approved') {
      request.approvedAt = new Date();
      const user = await User.findById(req.user._id);
      if (user) {
        let settingsCopy = JSON.parse(JSON.stringify(user.settings || {}));

        Object.entries(request.requestedChanges || {}).forEach(([keyPath, diff]) => {
          setNestedPath(settingsCopy, keyPath, diff.new);
        });

        const updateFields = { settings: settingsCopy };
        if (settingsCopy.language) {
          updateFields.preferredLanguage = settingsCopy.language;
        }
        if (settingsCopy.notifications?.whatsapp !== undefined) {
          updateFields.whatsappOptIn = settingsCopy.notifications.whatsapp;
        }

        await User.updateOne(
          { _id: req.user._id },
          { $set: updateFields }
        );
      }


      // Notify Admin in-app
      await Notification.create({
        userId: request.adminId,
        recipient: 'admin',
        title: 'Permission Request Approved',
        message: `${req.user.name} approved your requested settings changes.`,
        type: 'permission',
        category: 'permission',
        relatedId: request._id,
        relatedModel: 'PermissionRequest'
      });
    } else {
      request.rejectedAt = new Date();
      // Notify Admin in-app
      await Notification.create({
        userId: request.adminId,
        recipient: 'admin',
        title: 'Permission Request Rejected',
        message: `${req.user.name} rejected your requested settings changes.`,
        type: 'permission',
        category: 'permission',
        relatedId: request._id,
        relatedModel: 'PermissionRequest'
      });
    }

    await request.save();

    // Automatically update the user's notification title, message, and read state for this permission request
    try {
      const isApproved = status === 'approved';
      await Notification.updateMany(
        {
          userId: req.user._id,
          $or: [
            { relatedId: request._id },
            { relatedModel: 'PermissionRequest' },
            { category: 'permission' }
          ]
        },
        {
          $set: {
            isRead: true,
            title: isApproved ? 'Settings Change Approved' : 'Settings Change Rejected',
            message: isApproved
              ? `You approved the settings changes requested by the administrator.`
              : `You rejected the settings changes requested by the administrator.`
          }
        }
      );
    } catch (e) {
      console.warn('Error updating permission request notification:', e.message);
    }

    // Send WhatsApp & Email notifications to Admin if admin user exists
    try {
      const adminUser = await User.findById(request.adminId);
      const clientUrl = process.env.CLIENT_URL?.replace('http://localhost:5173', 'https://stjb-church.vercel.app') || 'https://stjb-church.vercel.app';
      const isApproved = status === 'approved';

      if (adminUser) {
        const adminWaMsg = `${isApproved ? '' : ''} *Permission Request Response Received*

Hello *${adminUser.name}*, parish member *${req.user.name}* has *${status.toUpperCase()}* your requested settings changes.

 *Rationale:* "${request.reason}"

 *View Requests Log on Website:*
${clientUrl}/admin/users?tab=requests

 _St. John de britto Church, Kalayarkoil_`;

        sendWhatsAppToUser(adminUser, adminWaMsg).catch(err => console.warn('Admin WA error:', err.message));
      }


      if (adminUser?.email) {
        const emailHtml = `
<div style="background:#f1f5f9; padding:20px 12px; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:550px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 6px 20px rgba(0,0,0,0.08); border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%); padding:28px 18px; text-align:center;">
      <div style="width:75px; height:75px; margin:0 auto 12px; border-radius:50%; overflow:hidden; border:3px solid #fbbf24; background:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.25);">
        <img src="cid:sjdb_church_logo" alt="St. John de Britto" style="width:100%; height:100%; object-fit:cover; display:block;" />
      </div>
      <h1 style="margin:0; color:#fbbf24; font-size:22px; font-weight:800;">St. John de britto Church</h1>
      <p style="margin:4px 0 0; color:#ffffff; opacity:0.9; font-size:13px;">Member Settings Governance</p>
    </div>
    <div style="padding:24px 20px;">
      <div style="display:inline-block; background:${isApproved ? '#dcfce7' : '#fee2e2'}; color:${isApproved ? '#15803d' : '#b91c1c'}; border:1px solid ${isApproved ? '#86efac' : '#fca5a5'}; font-size:12px; font-weight:700; padding:4px 12px; border-radius:9999px; text-transform:uppercase; margin-bottom:12px;">
        Request ${status.toUpperCase()}
      </div>
      <h2 style="color:#1e3a8a; margin-top:0; font-size:18px;">Member Response Received</h2>
      <p style="color:#334155; font-size:14px; line-height:1.5;">Hello <strong>${adminUser.name}</strong>,</p>
      <p style="color:#475569; font-size:14px; line-height:1.5;">Member <strong>${req.user.name}</strong> has <strong style="color:${isApproved ? '#15803d' : '#b91c1c'};">${status.toUpperCase()}</strong> your settings change request.</p>
      
      <div style="background:#f8fafc; border-left:4px solid ${isApproved ? '#16a34a' : '#dc2626'}; padding:14px; border-radius:8px; margin:18px 0;">
        <p style="margin:0; color:#475569; font-size:12px; font-weight:700; text-transform:uppercase;">Admin Rationale Provided:</p>
        <p style="margin:4px 0 0; color:#1e293b; font-size:13px; font-style:italic;">"${request.reason}"</p>
        <p style="margin:8px 0 0; color:#64748b; font-size:11px;">Processed: ${new Date().toLocaleString()}</p>
      </div>

      <div style="margin-top:25px; text-align:center;">
        <a href="${clientUrl}/admin/users?tab=requests" style="background:#d4a017; color:#ffffff; font-weight:700; font-size:14px; text-decoration:none; padding:13px 22px; border-radius:12px; display:block; box-shadow:0 4px 12px rgba(212,160,23,0.3);">
          View Permission Requests Log
        </a>
      </div>
    </div>
    <div style="background:#0f172a; padding:16px; text-align:center; color:#94a3b8; font-size:11px;">
      <p style="margin:0;">St. John de britto Church, Kalayarkoil</p>
      <p style="margin:4px 0 0; color:#64748b;">© ${new Date().getFullYear()} St. John de Britto Church. All rights reserved.</p>
    </div>
  </div>
</div>
        `;

        sendMail({
          to: adminUser.email,
          subject: `Permission Request ${status.toUpperCase()} by ${req.user.name}`,
          html: emailHtml
        }).catch(err => console.warn('Admin email error:', err.message));
      }
    } catch (e) {
      console.warn('Admin notification error:', e.message);
    }


    res.json({ message: `Request ${status} successfully`, request });
  } catch (err) {
    console.error(' respondToRequest error:', err);
    res.status(500).json({ message: err.message || 'Internal server error' });
  }
};



// Admin gets all permission requests history
exports.getAdminRequestHistory = async (req, res) => {
  try {
    const requests = await PermissionRequest.find()
      .populate('userId', 'name email phone parishMemberId')
      .populate('adminId', 'name')
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

