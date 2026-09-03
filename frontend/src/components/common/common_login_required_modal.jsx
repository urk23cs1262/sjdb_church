import { motion, AnimatePresence } from 'framer-motion';
import { FiLock, FiX } from 'react-icons/fi';
import { useNavigate, useLocation } from 'react-router-dom';

export default function LoginRequiredModal({ isOpen, onClose, targetUrl, actionName = 'continue' }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!isOpen) return null;

  const handleSignIn = () => {
    const destination = targetUrl || (location.pathname + location.search + location.hash);
    sessionStorage.setItem('redirectAfterLogin', destination);
    onClose();
    navigate(`/login?redirect=${encodeURIComponent(destination)}`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-amber-200 text-center space-y-5 relative"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-full hover:bg-gray-100"
          >
            <FiX size={20} />
          </button>

          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-inner">
            <FiLock size={32} />
          </div>

          <div>
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Authentication Needed
            </span>
            <h2 className="text-xl font-display font-bold text-church-royal-blue mt-2">Login Required</h2>
          </div>

          <div className="text-xs text-amber-900 leading-relaxed bg-amber-50/80 p-4 rounded-xl border border-amber-200 text-left">
            Please sign in to continue. After signing in, you'll automatically return to this page and your action will continue.
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSignIn}
              className="btn-gold w-full justify-center py-3 text-sm font-bold shadow-md flex items-center gap-2"
            >
              Sign In →
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
