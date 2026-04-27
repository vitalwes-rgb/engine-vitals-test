import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Periodically check for updates every hour
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  const close = () => {
    setNeedRefresh(false);
  };

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-[100] max-w-sm w-full"
        >
          <div className="bg-[#1A1A1A] border border-blue-500/30 shadow-2xl rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" />
            
            <button 
              onClick={close} 
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-start gap-4">
              <div className="bg-blue-500/20 p-3 rounded-xl flex-shrink-0">
                <RefreshCw className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Update Available!</h3>
                <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                  A new version of Engine Vitals has been released. Update now for the latest features and diagnostic patches.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => updateServiceWorker(true)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                  >
                    Install Update
                  </button>
                  <button 
                    onClick={close}
                    className="px-4 py-2.5 rounded-xl border border-[#404040] hover:bg-[#262626] text-white font-bold transition-colors"
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
