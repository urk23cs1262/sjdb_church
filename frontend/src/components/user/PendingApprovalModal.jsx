import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiCheck, FiXCircle, FiShield, FiUserCheck, FiCalendar } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';

import { useNotifications } from '../../context/context_notification_context';

export default function PendingApprovalModal({ request, onClose, onResponded }) {
  const [submittingAction, setSubmittingAction] = useState(null);
  const { refetch } = useNotifications();

  if (!request) return null;

  const handleRespond = async (status) => {
    setSubmittingAction(status);
    try {
      await api.put(`/permission-requests/${request._id}/respond`, { status });
      toast.success(status === 'approved' ? 'Settings changes approved and applied!' : 'Settings request rejected.');
      refetch();
      if (onResponded) onResponded(request._id, status);
      onClose();
    } catch {
      toast.error('Failed to process response.');
    } finally {
      setSubmittingAction(null);
    }
  };

  const changesList = Object.entries(request.requestedChanges || {});

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-church-gradient text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 ring-2 ring-church-gold flex items-center justify-center">
              <FiShield className="text-white text-xl" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg">Settings Change Approval Required</h2>
              <p className="text-gold-200 text-xs flex items-center gap-1">
                <FiCalendar /> Requested {new Date(request.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Admin Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-church-royal-blue text-white font-bold flex items-center justify-center flex-shrink-0">
              {request.adminId?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div>
              <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Requested By</p>
              <p className="text-sm font-bold text-gray-800">{request.adminId?.name || 'Parish Administrator'}</p>
              <p className="text-xs text-gray-500">{request.adminId?.email || 'Parish Office'}</p>
            </div>
          </div>

          {/* Rationale */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Reason Provided by Administrator</p>
            <p className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-700 italic">
              "{request.reason}"
            </p>
          </div>

          {/* Requested Changes Diff Table */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Requested Changes ({changesList.length})</p>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-500 uppercase font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">Setting</th>
                    <th className="py-2.5 px-3">Current</th>
                    <th className="py-2.5 px-3">Proposed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {changesList.map(([key, diff]) => (
                    <tr key={key} className="hover:bg-amber-50/50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-gray-800">{diff.label}</td>
                      <td className="py-2.5 px-3 text-gray-500">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-[11px] font-mono">
                          {String(diff.old)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-church-royal-blue">
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[11px] font-mono">
                          {String(diff.new)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Approving will update your personal settings immediately. Rejecting will keep your current preferences unchanged.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={() => handleRespond('rejected')}
            disabled={!!submittingAction}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-100 text-red-700 font-bold text-xs sm:text-sm hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            <FiXCircle /> {submittingAction === 'rejected' ? 'Rejecting...' : 'Reject Request'}
          </button>
          <button
            onClick={() => handleRespond('approved')}
            disabled={!!submittingAction}
            className="btn-gold flex items-center gap-1.5 px-5 py-2.5 text-xs sm:text-sm shadow-gold disabled:opacity-50"
          >
            <FiCheck /> {submittingAction === 'approved' ? 'Approving...' : 'Approve Changes'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
