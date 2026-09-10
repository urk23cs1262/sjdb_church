import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiSearch, FiDollarSign, FiDownload, FiEye, FiMail } from 'react-icons/fi';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import api from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';
import churchLogo from '../../assets/church_extirior.png';

const CATEGORY_NAMES = {
  general: 'General Offering',
  feast: 'Feast Donation',
  building: 'Building Fund',
  candle: 'Candle Offering',
  tithe: 'Tithe Offering',
  special: 'Special Offering',
};

export default function AdminDonations() {
  const [donations, setDonations] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [downloadingId, setDownloadingId] = useState(null);
  const [resendingId, setResendingId] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const modalReceiptRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [donationsRes, statsRes] = await Promise.all([
        api.get('/donations?limit=100'),
        api.get('/donations/stats')
      ]);
      setDonations(donationsRes.data?.donations || []);
      setStats(statsRes.data?.stats || []);
    } catch {
      toast.error('Failed to load donations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const verifyDonation = async (id) => {
    try {
      const res = await api.put(`/donations/${id}/verify`);
      setDonations(prev => prev.map(d => d._id === id ? { ...d, isVerified: true, status: 'verified' } : d));
      toast.success('Donation marked verified and receipt emailed!');
      if (res.data?.donation) {
        setDonations(prev => prev.map(d => d._id === id ? res.data.donation : d));
      }
    } catch { 
      toast.error('Failed to verify donation'); 
    }
  };

  const rejectDonation = async (id) => {
    try {
      await api.put(`/donations/${id}/reject`);
      setDonations(prev => prev.map(d => d._id === id ? { ...d, isVerified: false, status: 'rejected' } : d));
      toast.success('Donation marked rejected');
    } catch { 
      toast.error('Failed to reject donation'); 
    }
  };

  const downloadReceipt = async (donation) => {
    setDownloadingId(donation._id);
    try {
      if (modalReceiptRef.current && selectedReceipt?._id === donation._id) {
        const element = modalReceiptRef.current;
        const canvas = await html2canvas(element, {
          scale: 3,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        pdf.save(`Donation_Receipt_${donation._id.slice(-6).toUpperCase()}.pdf`);
        toast.success('Official receipt downloaded!');
        return;
      }

      const res = await api.get(`/donations/${donation._id}/receipt`);
      if (res.data?.success && res.data.receiptUrl) {
        const baseUrl = api.defaults.baseURL ? api.defaults.baseURL.replace('/api', '') : 'http://localhost:5000';
        const fileUrl = `${baseUrl}${res.data.receiptUrl}`;
        
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = res.data.filename || `Donation_Receipt_${donation._id.slice(-6).toUpperCase()}.pdf`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success('Official receipt downloaded!');
      } else {
        toast.error('Receipt could not be generated.');
      }
    } catch (err) {
      console.error('Download receipt error:', err);
      toast.error('Failed to download receipt.');
    } finally {
      setDownloadingId(null);
    }
  };

  const resendReceipt = async (donation) => {
    setResendingId(donation._id);
    try {
      const res = await api.post(`/donations/${donation._id}/resend-receipt`);
      if (res.data?.success) {
        toast.success(res.data.message || 'Receipt re-sent to donor & admin!');
      } else {
        toast.error(res.data?.message || 'Failed to resend receipt.');
      }
    } catch (err) {
      console.error('Resend receipt error:', err);
      toast.error('Failed to resend receipt email.');
    } finally {
      setResendingId(null);
    }
  };

  const totalCollected = useMemo(() => {
    return donations
      .filter(d => d.status === 'paid' || d.status === 'verified' || d.isVerified)
      .reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [donations]);

  const filteredDonations = useMemo(() => {
    return donations.filter(d => {
      const matchesSearch = 
        !searchTerm ||
        (d.donorName && d.donorName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.email && d.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.phone && d.phone.includes(searchTerm)) ||
        (d.razorpayPaymentId && d.razorpayPaymentId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.transactionId && d.transactionId.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory = categoryFilter === 'all' || d.type === categoryFilter;
      const isPaid = d.status === 'paid' || d.status === 'verified' || d.isVerified;
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'paid' && isPaid) ||
        (statusFilter === 'pending' && !isPaid && d.status !== 'rejected') ||
        (statusFilter === 'rejected' && d.status === 'rejected');

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [donations, searchTerm, categoryFilter, statusFilter]);

  return (
    <div className="w-full">
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-church-royal-blue">Manage Donations</h1>
            <p className="text-xs text-gray-500 mt-0.5">Track online contributions, Razorpay payments, and official donation receipts</p>
          </div>
          <div className="bg-gold-50 border border-gold-200 px-4 py-2 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-church-gold text-white flex items-center justify-center text-xl">
              <FiDollarSign />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500">Total Verified Collected</p>
              <p className="text-lg font-bold text-church-royal-blue">₹{totalCollected.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {stats.map((s, i) => (
              <div key={i} className="glass-card p-4 text-center border border-gray-100 rounded-2xl">
                <p className="text-church-gold font-bold text-lg sm:text-xl">₹{(s.total || 0).toLocaleString()}</p>
                <p className="text-gray-600 text-xs font-semibold capitalize mt-0.5">{CATEGORY_NAMES[s._id] || s._id}</p>
                <p className="text-gray-400 text-[11px] mt-0.5">{s.count} transactions</p>
              </div>
            ))}
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="glass-card p-4 rounded-2xl border border-gray-100 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by donor name, email, phone, or payment ID..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-church-gold/40 focus:border-church-gold bg-gray-50/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold focus:outline-none bg-gray-50/50 text-gray-700"
            >
              <option value="all">All Categories</option>
              <option value="general">General</option>
              <option value="feast">Feast</option>
              <option value="building">Building</option>
              <option value="candle">Candle</option>
            </select>

            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold focus:outline-none bg-gray-50/50 text-gray-700"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid / Verified</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Donations Table */}
        {loading ? <SectionLoader /> : (
          <div className="glass-card overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50/50">
                  <th className="py-3 px-4">Donor Details</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Payment ID / Ref</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDonations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-gray-400 text-sm">
                      No donations found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDonations.map((d, i) => {
                    const isPaid = d.status === 'paid' || d.status === 'verified' || d.isVerified;
                    return (
                      <motion.tr 
                        key={d._id} 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        transition={{ delay: i * 0.02 }}
                        className="hover:bg-gold-50/40 transition-colors text-xs sm:text-sm"
                      >
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-gray-900">{d.donorName || d.userId?.name || 'Anonymous'}</p>
                          {(d.email || d.phone) && (
                            <p className="text-[11px] text-gray-500">{d.email || ''} {d.phone ? `• ${d.phone}` : ''}</p>
                          )}
                          {d.note && (
                            <p className="text-[10px] text-gray-400 italic line-clamp-1 mt-0.5">"{d.note}"</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-church-gold">
                          ₹{d.amount?.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize bg-blue-50 text-church-royal-blue border border-blue-100">
                            {CATEGORY_NAMES[d.type] || d.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600">
                          <div>{d.razorpayPaymentId || d.transactionId || '—'}</div>
                          <div className="text-[10px] text-gray-400 uppercase">{d.razorpayPaymentId ? 'Razorpay (Online)' : (d.paymentMethod || 'UPI')}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-500">
                          {new Date(d.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isPaid ? 'bg-green-100 text-green-700' :
                            d.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {isPaid ? 'Paid' : d.status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* 1. View Receipt Preview Modal */}
                            <button
                              onClick={() => setSelectedReceipt(d)}
                              className="px-2 py-1.5 rounded-lg bg-blue-50 text-church-royal-blue hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                              title="View Official Receipt"
                            >
                              <FiEye className="text-xs" />
                              <span className="hidden sm:inline">View</span>
                            </button>

                            {/* 2. Download Official PDF Receipt */}
                            <button 
                              onClick={() => downloadReceipt(d)}
                              disabled={downloadingId === d._id}
                              className="px-2 py-1.5 rounded-lg bg-gold-50 text-church-gold hover:bg-gold-100 border border-gold-200 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                              title="Download PDF Receipt"
                            >
                              {downloadingId === d._id ? (
                                <div className="w-3 h-3 border-2 border-church-gold border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <FiDownload className="text-xs" />
                              )}
                              <span className="hidden sm:inline">PDF</span>
                            </button>

                            {/* 3. Resend Receipt Email */}
                            <button
                              onClick={() => resendReceipt(d)}
                              disabled={resendingId === d._id}
                              className="px-2 py-1.5 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                              title="Resend Receipt Email"
                            >
                              {resendingId === d._id ? (
                                <div className="w-3 h-3 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <FiMail className="text-xs" />
                              )}
                              <span className="hidden md:inline">Resend</span>
                            </button>

                            {/* 4. Verify & Reject Actions for pending offline donations */}
                            {!isPaid && d.status !== 'rejected' && (
                              <>
                                <button 
                                  onClick={() => verifyDonation(d._id)} 
                                  className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors cursor-pointer" 
                                  title="Mark Verified & Send Email"
                                >
                                  <FiCheck />
                                </button>
                                <button 
                                  onClick={() => rejectDonation(d._id)} 
                                  className="p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors cursor-pointer" 
                                  title="Reject"
                                >
                                  <FiX />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── CLEAN, NORMAL RECEIPT MODAL DIALOG ──────────────────────────────── */}
      <AnimatePresence>
        {selectedReceipt && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden my-auto flex flex-col max-h-[92vh]"
            >
              {/* Clean Top Action Toolbar */}
              <div className="bg-gray-50/80 backdrop-blur-xs px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">Donation Receipt Preview</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadReceipt(selectedReceipt)}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <FiDownload className="text-sm text-church-gold" />
                    <span>Download PDF</span>
                  </button>
                  <button
                    onClick={() => resendReceipt(selectedReceipt)}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <FiMail className="text-sm text-church-royal-blue" />
                    <span>Resend Email</span>
                  </button>
                  <button
                    onClick={() => setSelectedReceipt(null)}
                    className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-base"
                    title="Close"
                  >
                    <FiX />
                  </button>
                </div>
              </div>

              {/* Exact Receipt Document Sheet */}
              <div className="overflow-y-auto p-4 sm:p-8 bg-white flex-1">
                <div 
                  ref={modalReceiptRef}
                  style={{ width: '100%', maxWidth: '700px', margin: 'auto', background: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#222' }}
                >
                  {/* Top Meta Line */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#444', marginBottom: '16px' }}>
                    <div>
                      {new Date(selectedReceipt.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}, {new Date(selectedReceipt.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                      SJBC-{selectedReceipt._id?.slice(-6).toUpperCase()}
                    </div>
                  </div>

                  {/* Header: Church Info & Receipt Title */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e5e5e5', paddingBottom: '14px' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <img src={churchLogo} style={{ width: '60px', height: '60px', objectFit: 'contain' }} alt="Church Logo" />
                      <div style={{ textAlign: 'left' }}>
                        <h1 style={{ margin: 0, fontSize: '22px', color: '#1e3a8a', fontWeight: 'bold' }}>ST. JOHN DE BRITTO'S CHURCH</h1>
                        <h2 style={{ margin: '3px 0', fontSize: '14px', color: '#b8860b', fontWeight: 'normal' }}>புனித அருளானந்தர் தேவாலயம்</h2>
                        <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>Murthi Nagar, Kalayarkoil, Tamil Nadu 630551, India.</p>
                      </div>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#111' }}>Receipt</div>
                  </div>

                  {/* Two Column Details Grid */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', fontSize: '13px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', marginBottom: '8px' }}>
                        <div style={{ width: '130px', fontWeight: 'bold', color: '#333' }}>Receipt No :</div>
                        <div style={{ fontWeight: 'bold', color: '#111' }}>SJBC-{new Date(selectedReceipt.createdAt).getFullYear()}-{selectedReceipt._id?.slice(-6).toUpperCase()}</div>
                      </div>
                      <div style={{ display: 'flex', marginBottom: '8px' }}>
                        <div style={{ width: '130px', fontWeight: 'bold', color: '#333' }}>Name :</div>
                        <div style={{ fontWeight: 'bold', color: '#111' }}>{selectedReceipt.donorName || selectedReceipt.userId?.name || 'N/A'}</div>
                      </div>
                      <div style={{ display: 'flex', marginBottom: '8px' }}>
                        <div style={{ width: '130px', fontWeight: 'bold', color: '#333' }}>Donation Type :</div>
                        <div>{CATEGORY_NAMES[selectedReceipt.type] || selectedReceipt.type}</div>
                      </div>
                      <div style={{ display: 'flex', marginBottom: '8px' }}>
                        <div style={{ width: '130px', fontWeight: 'bold', color: '#333' }}>Purpose :</div>
                        <div>{CATEGORY_NAMES[selectedReceipt.type] || selectedReceipt.type}</div>
                      </div>
                    </div>

                    <div style={{ flex: 1, paddingLeft: '20px' }}>
                      <div style={{ display: 'flex', marginBottom: '8px' }}>
                        <div style={{ width: '130px', fontWeight: 'bold', color: '#333' }}>Receipt Date :</div>
                        <div>{new Date(selectedReceipt.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                      </div>
                      <div style={{ display: 'flex', marginBottom: '8px' }}>
                        <div style={{ width: '130px', fontWeight: 'bold', color: '#333' }}>Total Paid :</div>
                        <div style={{ fontWeight: 'bold', color: '#b8860b' }}>INR. {(selectedReceipt.amount || 0).toFixed(2)}</div>
                      </div>
                      <div style={{ display: 'flex', marginBottom: '8px' }}>
                        <div style={{ width: '130px', fontWeight: 'bold', color: '#333' }}>Payment Method :</div>
                        <div>{selectedReceipt.razorpayPaymentId ? 'Razorpay (Online)' : (selectedReceipt.paymentMethod || 'UPI')}</div>
                      </div>
                      <div style={{ display: 'flex', marginBottom: '8px' }}>
                        <div style={{ width: '130px', fontWeight: 'bold', color: '#333' }}>Payment ID :</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#444' }}>{selectedReceipt.razorpayPaymentId || selectedReceipt.transactionId || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Itemized Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th style={{ background: '#f3f4f6', textAlign: 'left', padding: '10px 14px', border: '1px solid #ddd', fontWeight: 'bold', color: '#111' }}>Donation Description</th>
                        <th style={{ background: '#f3f4f6', textAlign: 'left', padding: '10px 14px', border: '1px solid #ddd', fontWeight: 'bold', color: '#111' }}>Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '12px 14px', border: '1px solid #ddd' }}>{CATEGORY_NAMES[selectedReceipt.type] || selectedReceipt.type}</td>
                        <td style={{ padding: '12px 14px', border: '1px solid #ddd', fontWeight: 'bold', color: '#111' }}>₹{(selectedReceipt.amount || 0).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Message / Intention Box */}
                  <div style={{ marginTop: '20px', border: '1px solid #ddd', padding: '14px', background: '#fafafa', textAlign: 'center', fontSize: '13px' }}>
                    <strong style={{ display: 'block', marginBottom: '6px', color: '#333' }}>Message / Intention :</strong>
                    "{selectedReceipt.note || selectedReceipt.message || 'Prayers for parish and family blessings'}"
                  </div>

                  {/* Thank You & Blessing */}
                  <div style={{ marginTop: '24px', textAlign: 'center', lineHeight: '1.7', fontSize: '13px', color: '#333' }}>
                    Thank you for your generous contribution<br />
                    towards the ministry and mission of<br />
                    <strong>St. John de Britto's Church.</strong><br /><br />
                    May God bless you abundantly.
                  </div>

                  {/* Contact Details */}
                  <div style={{ marginTop: '26px', textAlign: 'center', fontSize: '12px', lineHeight: '1.7', color: '#555' }}>
                    Contact Details :<br />
                    Parish Office Phone : +91 96291 95484 <br />
                    Parish Office Email : arndas777@gmail.com <br />
                    Parish Office Website : www.stjohnchurch.com
                  </div>

                  {/* Footer Statement */}
                  <div style={{ marginTop: '28px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: '#111' }}>
                    Computer Generated Receipt. <span style={{ color: 'red' }}>SIGNATURE NOT REQUIRED</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
