import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/context_auth_context';
import { FiX } from 'react-icons/fi';

export default function BirthdayCelebration() {
  const { user, isAuthenticated } = useAuth();
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user?.dob) {
      const today = new Date();
      const birthDate = new Date(user.dob);
      
      const isBirthday = 
        today.getDate() === birthDate.getDate() && 
        today.getMonth() === birthDate.getMonth();

      if (isBirthday) {
        setShowCelebration(true);
        triggerConfetti();
      }
    }
  }, [isAuthenticated, user]);

  const triggerConfetti = () => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 99999 };

    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  if (!showCelebration) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99998] pointer-events-none flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.5, opacity: 0, y: 50 }}
          className="bg-white/90 backdrop-blur-xl border-2 border-church-gold p-8 rounded-[2.5rem] shadow-2xl text-center max-w-sm pointer-events-auto relative"
        >
          <button 
            onClick={() => setShowCelebration(false)}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiX className="text-xl text-gray-500" />
          </button>

          <div className="text-6xl mb-4"></div>
          <h2 className="text-3xl font-display font-bold text-church-royal-blue mb-2">
            Happy Birthday, {user?.name}!
          </h2>
          <p className="text-gray-600 mb-6">
            St. John de Britto's Church wishes you a blessed day and year filled with joy and peace. 
          </p>
          <button
            onClick={() => {
              triggerConfetti();
              setShowCelebration(false);
            }}
            className="btn-gold w-full py-3 text-center cursor-pointer justify-center"
          >
            Thank You!
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
