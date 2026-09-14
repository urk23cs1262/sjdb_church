const Document = require('../models/Document');
const { createNotification, notifyAdmins } = require('../services/notificationService');
const { emitRequestCreated, emitRequestStatusChanged } = require('../services/requestNotificationService');
const User = require('../models/User');
const { sendMail } = require('../config/mailer');
const { sendWhatsApp } = require('../config/twilio');

const getMyDocuments = async (req, res) => {
  try {
    const docs = await Document.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, documents: docs });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query = { _id: id };
    } else {
      const rawHex = id.replace(/^DOC-/i, '');
      query = { _id: { $regex: rawHex + '$', $options: 'i' } };
    }
    const doc = await Document.findOne(query).populate('userId', 'name phone email parishMemberId familyId anbiyam');
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    
    // Authorization check: Admin OR Owner
    const isOwner = doc.userId && (doc.userId._id ? doc.userId._id.toString() : doc.userId.toString()) === req.user._id.toString();
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own requests.' });
    }

    res.json({ success: true, document: doc });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getAllDocuments = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20, id } = req.query;
    const query = {};
    if (id) {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        query._id = id;
      } else {
        query._id = { $regex: id.replace(/^DOC-/i, '') + '$', $options: 'i' };
      }
    } else {
      if (status) query.status = status;
      if (type) query.type = type;
    }
    const total = await Document.countDocuments(query);
    const docs = await Document.find(query).populate('userId', 'name phone email parishMemberId familyId anbiyam').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, total, documents: docs });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const requestDocument = async (req, res) => {
  try {
    const { type, requestDetails } = req.body;
    const doc = await Document.create({ userId: req.user._id, type, requestDetails });
    // Notify user (Async)
    createNotification({ 
      userId: req.user._id, 
      recipient: 'user',
      title: 'Document Request Received ', 
      message: `Your request for ${type.replace('_', ' ')} certificate has been received and is being processed.`, 
      type: 'document', 
      category: 'documents',
      priority: 'low',
      actionUrl: '/dashboard/documents',
      relatedId: doc._id, 
      relatedModel: 'Document',
      channels: ['email'] 
    }).catch(e => console.error('Doc notification error:', e.message));
    
    // Central Admin Request Notification (WhatsApp Bot, Email, Push, In-App)
    emitRequestCreated({
      module: 'document_request',
      request: doc,
      user: req.user,
      req
    });

    res.status(201).json({ success: true, document: doc });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateDocumentStatus = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const previousDoc = await Document.findById(req.params.id);
    if (!previousDoc) {
      return res.status(404).json({ success: false, message: 'Document request not found' });
    }
    const previousStatus = previousDoc.status || 'pending';

    const updateData = { status, adminNote, processedBy: req.user._id, processedAt: new Date() };
    let preparedPdf = null;

    if (req.file) {
      const { uploadToGridFS } = require('../services/gridfsService');
      const { prepareFinalDocumentPdf } = require('../services/documentDeliveryService');

      preparedPdf = await prepareFinalDocumentPdf(req.file, previousDoc.type);
      const fileInfo = await uploadToGridFS(preparedPdf.buffer, preparedPdf.filename, 'application/pdf');
      updateData.uploadedFile = fileInfo.url;
    }

    const doc = await Document.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('userId', 'name phone email parishMemberId familyId anbiyam settings whatsappOptIn');

    if (status === 'approved') {
      const { deliverApprovedDocument } = require('../services/documentDeliveryService');
      deliverApprovedDocument({
        document: doc,
        user: doc.userId,
        finalPdfBuffer: preparedPdf?.buffer,
        filename: preparedPdf?.filename,
        adminNote
      }).catch(e => console.error('[DocumentController] Document delivery error:', e.message));

      emitRequestStatusChanged({
        module: 'document_request',
        request: doc,
        previousStatus,
        newStatus: status,
        user: doc.userId,
        updatedBy: req.user,
        note: adminNote,
        req
      });
    } else {
      createNotification({ 
        userId: doc.userId?._id || doc.userId, 
        recipient: 'user',
        title: `Document Request: ${status === 'processing' ? 'Processing' : 'Status Updated'}`, 
        message: status === 'processing' 
          ? `Your ${doc.type.replace(/_/g, ' ')} certificate request is now being processed by the parish administration.`
          : `Your ${doc.type.replace(/_/g, ' ')} certificate request has been ${status}.${adminNote ? ` Note: ${adminNote}` : ''}`, 
        type: 'document', 
        category: 'documents',
        priority: status === 'rejected' ? 'high' : 'medium',
        actionUrl: `/my-requests/document-requests/DOC-${doc._id.toString().slice(-6).toUpperCase()}`,
        relatedId: doc._id, 
        relatedModel: 'Document',
        channels: ['email', 'whatsapp', 'push', 'inApp'] 
      }).catch(e => console.error('Doc status notification error:', e.message));

      emitRequestStatusChanged({
        module: 'document_request',
        request: doc,
        previousStatus,
        newStatus: status,
        user: doc.userId,
        updatedBy: req.user,
        note: adminNote,
        req
      });
    }

    res.json({ success: true, document: doc });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getMyDocuments, getAllDocuments, getDocumentById, requestDocument, updateDocumentStatus };
