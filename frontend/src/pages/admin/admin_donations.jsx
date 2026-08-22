import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiCheck, FiX } from 'react-icons/fi';
import api from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';

export default function AdminDonations() {
  const [donations, setDonations] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/donations').then(r => setDonations(r.data.donations || [])),
      api.get('/donations/stats').then(r => setStats(r.data.stats || [])),
    ]).finally(() => setLoading(false));
  }, []);

  const verifyDonation = async (id) => {
    try {
      await api.put(`/donations/${id}/verify`);
      setDonations(prev => prev.map(d => d._id === id ? { ...d, isVerified: true, status: 'verified' } : d));
      toast.success('Donation verified');
    } catch { toast.error('Failed'); }
  };

  const rejectDonation = async (id) => {
    try {
      await api.put(`/donations/${id}/reject`);
      setDonations(prev => prev.map(d => d._id === id ? { ...d, isVerified: false, status: 'rejected' } : d));
      toast.success('Donation rejected');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="w-full">
      <div className="p-4 sm:p-6">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-church-royal-blue mb-6">Manage Donations</h1>


        {/* Stats */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map((s, i) => (
              <div key={i} className="glass-card p-4 text-center">
                <p className="text-church-gold font-bold text-xl">₹{s.total?.toLocaleString()}</p>
                <p className="text-gray-500 text-sm capitalize">{s._id}</p>
                <p className="text-gray-400 text-xs">{s.count} donations</p>
              </div>
            ))}
          </div>
        )}

        {loading ? <SectionLoader /> : (
          <div className="glass-card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200  text-xs uppercase text-gray-400">
                  <th className="text-left py-3 px-4">Donor</th>
                  <th className="text-left py-3 px-4">Amount</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Method</th>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d, i) => (
                  <motion.tr key={d._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-gray-50  hover:bg-gold-50  transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-gray-800 ">{d.donorName || d.userId?.name || 'Anonymous'}</td>
                    <td className="py-3 px-4 text-sm font-bold text-church-gold">₹{d.amount?.toLocaleString()}</td>
                    <td className="py-3 px-4"><span className="badge badge-gold capitalize">{d.type}</span></td>
                    <td className="py-3 px-4 text-sm text-gray-500 capitalize">{d.paymentMethod}</td>
                    <td className="py-3 px-4 text-xs text-gray-400">{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${
                        d.status === 'verified' ? 'badge-green' : 
                        d.status === 'rejected' ? 'badge-red' : 
                        'badge-gray'
                      }`}>
                        {d.status || (d.isVerified ? 'verified' : 'pending')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {(!d.status || (d.status !== 'verified' && d.status !== 'rejected')) && (
                        <div className="flex gap-2">
                          <button onClick={() => verifyDonation(d._id)} className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors" title="Verify"><FiCheck /></button>
                          <button onClick={() => rejectDonation(d._id)} className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors" title="Reject"><FiX /></button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
