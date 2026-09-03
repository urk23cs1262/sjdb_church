const router = require('express').Router();
const { getMyDocuments, getAllDocuments, requestDocument, updateDocumentStatus } = require('../controllers/documentController');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/my', protect, getMyDocuments);
router.get('/', protect, adminOnly, getAllDocuments);
router.post('/', protect, requestDocument);
router.put('/:id/status', protect, adminOnly, (req, res, next) => { req.uploadFolder = 'documents'; next(); }, upload.single('file'), updateDocumentStatus);

module.exports = router;
