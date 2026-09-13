const router = require('express').Router();
const { getMyTickets, getAll, getTicketById, create, reply, updateStatus, deleteTicket } = require('../controllers/ticketController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/my', protect, getMyTickets);
router.get('/', protect, adminOnly, getAll);
router.get('/:id', protect, getTicketById);
router.post('/', protect, create);
router.post('/:id/reply', protect, reply);
router.put('/:id/status', protect, adminOnly, updateStatus);
router.delete('/:id', protect, adminOnly, deleteTicket);

module.exports = router;
