const { uploadToGridFS, getGridFSStream, getGridFSFileDoc, deleteFromGridFS } = require('../services/gridfsService');
const path = require('path');
const fs = require('fs');

/**
 * Upload single file to GridFS
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileInfo = await uploadToGridFS(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({
      success: true,
      message: 'File uploaded successfully to GridFS',
      file: fileInfo,
      fileId: fileInfo.fileId,
      url: fileInfo.url
    });
  } catch (err) {
    console.error('GridFS Upload Error:', err);
    res.status(500).json({ success: false, message: err.message || 'File upload failed' });
  }
};

/**
 * Stream file from GridFS or fallback to local disk
 */
const getFile = async (req, res) => {
  try {
    const idOrFilename = req.params.id;
    const doc = await getGridFSFileDoc(idOrFilename);

    if (doc) {
      const fileSize = doc.length;
      const range = req.headers.range;

      if (range) {
        // Parse Range header e.g. "bytes=32324-" or "bytes=0-1000"
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        if (isNaN(start) || start >= fileSize || start < 0) {
          return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
        }

        // Bounded chunk window for open-ended requests (e.g. bytes=0-)
        // Prevents proxy/load balancer socket idle timeouts during audio playback
        const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunk window
        let end;
        if (parts[1] && parts[1].trim() !== '') {
          const parsedEnd = parseInt(parts[1], 10);
          end = Math.min(isNaN(parsedEnd) ? fileSize - 1 : parsedEnd, fileSize - 1);
        } else {
          end = Math.min(start + CHUNK_SIZE - 1, fileSize - 1);
        }

        if (end < start) {
          end = start;
        }

        const chunksize = (end - start) + 1;

        res.status(206);
        res.set({
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': doc.contentType || 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
        });

        // GridFS openDownloadStream 'end' is non-inclusive, so pass end + 1
        const stream = getGridFSStream(doc._id, { start, end: end + 1 });

        // Destroy stream if client cancels, seeks, or socket closes
        req.on('close', () => {
          try {
            stream.destroy();
          } catch (_) {}
        });

        stream.on('error', (err) => {
          if (!res.headersSent) {
            res.status(404).json({ success: false, message: 'Stream error' });
          }
        });
        return stream.pipe(res);
      } else {
        const isDownload = req.query.download === 'true';
        const dispositionType = isDownload ? 'attachment' : 'inline';
        const safeName = (doc.filename || 'document.pdf').replace(/["\r\n]/g, '');

        res.set({
          'Content-Type': doc.contentType || 'application/octet-stream',
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Disposition': `${dispositionType}; filename="${safeName}"`
        });

        const stream = getGridFSStream(doc._id);
        stream.on('error', () => {
          if (!res.headersSent) res.status(404).json({ success: false, message: 'Stream error' });
        });
        return stream.pipe(res);
      }
    }

    // Fallback: Check local disk uploads folder for legacy files
    const legacyPath = path.join(__dirname, '../../uploads', idOrFilename);
    if (fs.existsSync(legacyPath)) {
      return res.sendFile(legacyPath);
    }

    res.status(404).json({ success: false, message: 'File not found' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Delete file from GridFS
 */
const deleteFile = async (req, res) => {
  try {
    const success = await deleteFromGridFS(req.params.id);
    if (success) {
      res.json({ success: true, message: 'File deleted from GridFS' });
    } else {
      res.status(404).json({ success: false, message: 'File not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  uploadFile,
  getFile,
  deleteFile
};
