import { useState, useEffect } from 'react';
import { Phone, X } from 'lucide-react';
import { useTelnyxPhone } from '../hooks/useTelnyxPhone';
import WebPhone from './WebPhone';
import { cn } from '@/lib/utils';

export function WebPhoneFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { incomingCall, sessionStatus } = useTelnyxPhone();

  useEffect(() => {
    if (incomingCall) {
      setIsOpen(true);
    }
  }, [incomingCall]);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg transition-all duration-300",
          "hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2",
          isOpen 
            ? "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500" 
            : sessionStatus === 'registered'
              ? "bg-green-600 hover:bg-green-700 text-white focus:ring-green-500"
              : "bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500",
          incomingCall && !isOpen && "animate-pulse ring-4 ring-green-400"
        )}
        data-testid="webphone-floating-button"
      >
        {isOpen ? <X size={24} /> : <Phone size={24} />}
      </button>

      {/* WebPhone Panel */}
      {isOpen && (
        <div 
          className="fixed bottom-24 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300"
          data-testid="webphone-floating-panel"
        >
          <WebPhone />
        </div>
      )}

      {/* Incoming Call Badge */}
      {incomingCall && !isOpen && (
        <div 
          className="fixed bottom-20 right-6 z-50 bg-green-100 dark:bg-green-900 border border-green-500 rounded-lg p-3 shadow-lg animate-bounce"
          data-testid="webphone-incoming-badge"
        >
          <div className="text-sm font-medium text-green-800 dark:text-green-200">
            Incoming Call
          </div>
          <div className="text-xs text-green-600 dark:text-green-300">
            Click to answer
          </div>
        </div>
      )}
    </>
  );
}

export default WebPhoneFloatingButton;
