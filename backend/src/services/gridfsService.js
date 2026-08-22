const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const { Readable } = require('stream');

let bucket = null;

const getBucket = () => {
  if (!bucket) {
    if (!mongoose.connection.db) {
      throw new Error('Database connection not established yet');
    }
    bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads'
    });
  }
  return bucket;
};

/**
 * Upload buffer directly into GridFS
 */
const uploadToGridFS = (buffer, filename, mimetype) => {
  return new Promise((resolve, reject) => {
    try {
      const gridBucket = getBucket();
      const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      const uploadStream = gridBucket.openUploadStream(uniqueFilename, {
        contentType: mimetype,
        metadata: { originalName: filename, uploadDate: new Date() }
      });

      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);

      uploadStream.on('error', (err) => reject(err));
      uploadStream.on('finish', () => {
        resolve({
          fileId: uploadStream.id.toString(),
          filename: uniqueFilename,
          contentType: mimetype,
          size: buffer.length,
          url: `/api/files/${uploadStream.id}`
        });
      });

      readableStream.pipe(uploadStream);
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Download / stream file by ID or filename from GridFS (supports byte ranges)
 */
const getGridFSStream = (idOrFilename, options = {}) => {
  const gridBucket = getBucket();
  
  if (ObjectId.isValid(idOrFilename)) {
    const _id = new ObjectId(idOrFilename);
    return gridBucket.openDownloadStream(_id, options);
  } else {
    return gridBucket.openDownloadStreamByName(idOrFilename, options);
  }
};

/**
 * Find file metadata by ID or filename
 */
const getGridFSFileDoc = async (idOrFilename) => {
  if (!mongoose.connection.db) return null;
  const db = mongoose.connection.db;
  const filesColl = db.collection('uploads.files');

  if (ObjectId.isValid(idOrFilename)) {
    return await filesColl.findOne({ _id: new ObjectId(idOrFilename) });
  } else {
    return await filesColl.findOne({ filename: idOrFilename });
  }
};

/**
 * Delete file from GridFS
 */
const deleteFromGridFS = async (idOrFilename) => {
  try {
    const gridBucket = getBucket();
    const doc = await getGridFSFileDoc(idOrFilename);
    if (doc) {
      await gridBucket.delete(doc._id);
      return true;
    }
    return false;
  } catch (err) {
    console.error('GridFS delete error:', err.message);
    return false;
  }
};

module.exports = {
  uploadToGridFS,
  getGridFSStream,
  getGridFSFileDoc,
  deleteFromGridFS
};
