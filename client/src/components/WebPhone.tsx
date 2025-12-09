import { useState, useEffect } from 'react';
import { useTelnyxPhone } from '../hooks/useTelnyxPhone';
import { Phone, MicOff, Pause, X, ArrowRight, Grip, Minimize2, User, RotateCcw } from 'lucide-react';

const ControlButton = ({ icon, label, onClick, active, className = '' }: any) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
      active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    } ${className}`}
    data-testid={`webphone-control-${label.toLowerCase()}`}
  >
    <div className="mb-1">{icon}</div>
    <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
  </button>
);

export const WebPhone = () => {
  const {
    sessionStatus, incomingCall, activeCall, isMuted, isOnHold,
    answerCall, rejectCall, hangupCall, toggleMute, toggleHold, sendDTMF, transferCall, makeCall, reconnect
  } = useTelnyxPhone();

  const [isOpen, setIsOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [view, setView] = useState<'dialpad' | 'transfer' | 'dtmf'>('dialpad');
  const [callDuration, setCallDuration] = useState(0);
  const [isAnswering, setIsAnswering] = useState(false);

  useEffect(() => {
    if (incomingCall || activeCall) setIsOpen(true);
  }, [incomingCall, activeCall]);

  // Reset isAnswering when call becomes active or ends
  useEffect(() => {
    if (activeCall) {
      setIsAnswering(false);
    }
    if (!incomingCall && !activeCall) {
      setIsAnswering(false);
    }
  }, [activeCall, incomingCall]);

  const handleAnswer = () => {
    setIsAnswering(true);
    answerCall();
  };

  useEffect(() => {
    let interval: any;
    if (activeCall) {
      interval = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [activeCall]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const getRemoteNumber = () => {
    if (activeCall) {
      return (activeCall as any).options?.remoteCallerNumber || 
             (activeCall as any).remoteCallerNumber || 
             'Unknown';
    }
    if (incomingCall) {
      return (incomingCall as any).options?.remoteCallerNumber || 
             (incomingCall as any).remoteCallerNumber || 
             'Unknown';
    }
    return '';
  };

  const getCallerName = () => {
    if (incomingCall) {
      return (incomingCall as any).options?.callerName || 
             (incomingCall as any).callerName || 
             'Unknown';
    }
    return 'Unknown';
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 z-50 ${
          sessionStatus === 'registered' ? 'bg-indigo-600' : 'bg-gray-400'
        } ${incomingCall ? 'animate-bounce bg-green-500' : ''}`}
        data-testid="webphone-fab"
      >
        <Phone className="text-white" size={28} />
        <span className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
          sessionStatus === 'registered' ? 'bg-green-400' : 'bg-red-500'
        }`} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[340px] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl rounded-3xl border border-white/20 dark:border-gray-700/50 overflow-hidden z-50 flex flex-col transition-all duration-300 ease-out font-sans" data-testid="webphone-panel">
      
      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex justify-between items-center text-white shadow-lg">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${sessionStatus === 'registered' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-xs font-semibold tracking-wider opacity-90">
            {sessionStatus === 'registered' ? 'CURBE VOICE' : sessionStatus === 'connecting' ? 'CONNECTING...' : 'OFFLINE'}
          </span>
          {sessionStatus === 'error' && (
            <button onClick={reconnect} className="ml-2 p-1 hover:bg-white/20 rounded-full" data-testid="webphone-reconnect">
              <RotateCcw size={12} />
            </button>
          )}
        </div>
        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors" data-testid="webphone-minimize">
          <Minimize2 size={16} />
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div className="p-6 flex-1 bg-gray-50/50 dark:bg-gray-800/50 min-h-[400px] flex flex-col relative">
        
        {/* INCOMING CALL OVERLAY */}
        {incomingCall && !activeCall && (
          <div className="absolute inset-0 bg-gray-900/95 z-20 flex flex-col items-center justify-center text-white backdrop-blur-sm p-6 rounded-b-3xl" data-testid="webphone-incoming-overlay">
            <div className={`w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mb-4 ${isAnswering ? '' : 'animate-pulse'}`}>
              <User size={48} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-bold mb-1">{getCallerName()}</h3>
            <p className="text-gray-400 mb-2 font-mono">{getRemoteNumber()}</p>
            
            {isAnswering ? (
              /* Show connecting state after user clicks Answer */
              <div className="flex flex-col items-center gap-4 mt-4">
                <div className="flex items-center gap-2 text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Connecting...</span>
                </div>
                <p className="text-xs text-gray-500">Please wait while call connects</p>
              </div>
            ) : (
              /* Show Answer/Reject buttons */
              <div className="flex gap-8 w-full justify-center mt-6">
                <button onClick={rejectCall} className="flex flex-col items-center gap-2 group" data-testid="webphone-reject">
                  <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-hover:bg-red-600 transition-all group-active:scale-95">
                    <X size={28} />
                  </div>
                  <span className="text-xs font-medium">Reject</span>
                </button>
                <button onClick={handleAnswer} className="flex flex-col items-center gap-2 group" data-testid="webphone-answer">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg group-hover:bg-green-600 transition-all group-active:scale-95 animate-bounce">
                    <Phone size={28} />
                  </div>
                  <span className="text-xs font-medium">Answer</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ACTIVE CALL */}
        {activeCall ? (
          <div className="flex flex-col h-full items-center" data-testid="webphone-active-call">
            <div className="mt-4 mb-8 text-center">
              <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/50 rounded-full mx-auto flex items-center justify-center mb-3 text-indigo-600 dark:text-indigo-400 shadow-inner">
                <User size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 font-mono">{getRemoteNumber()}</h3>
              <p className="text-indigo-600 dark:text-indigo-400 font-mono text-sm bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full inline-block mt-1">
                {formatTime(callDuration)}
              </p>
              {isOnHold && <span className="block text-xs text-yellow-600 font-bold mt-2 animate-pulse">ON HOLD</span>}
            </div>

            {/* CALL CONTROLS */}
            {view === 'dialpad' && (
              <div className="grid grid-cols-3 gap-4 w-full max-w-[240px] mb-auto">
                <ControlButton 
                  icon={<MicOff size={24} />} 
                  label="Mute" 
                  active={isMuted} 
                  onClick={toggleMute} 
                />
                <ControlButton 
                  icon={<Grip size={24} />} 
                  label="Keypad" 
                  onClick={() => setView('dtmf')} 
                />
                <ControlButton 
                  icon={<Pause size={24} />} 
                  label="Hold" 
                  active={isOnHold} 
                  onClick={toggleHold} 
                />
                <ControlButton 
                  icon={<ArrowRight size={24} />} 
                  label="Transfer" 
                  onClick={() => setView('transfer')} 
                  className="col-span-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                />
              </div>
            )}

            {/* DTMF KEYPAD */}
            {view === 'dtmf' && (
              <div className="w-full mb-auto bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700" data-testid="webphone-dtmf-panel">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[1,2,3,4,5,6,7,8,9,'*',0,'#'].map(key => (
                    <button 
                      key={key}
                      onClick={() => sendDTMF(String(key))}
                      className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-lg font-medium text-gray-700 dark:text-gray-200 mx-auto transition-colors active:bg-gray-300"
                      data-testid={`webphone-dtmf-${key}`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <button onClick={() => setView('dialpad')} className="text-sm text-gray-500 w-full hover:text-gray-800 dark:hover:text-gray-200 py-2">
                  Back
                </button>
              </div>
            )}

            {/* TRANSFER VIEW */}
            {view === 'transfer' && (
              <div className="w-full mb-auto bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700" data-testid="webphone-transfer-panel">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Transfer to...</h4>
                <input 
                  autoFocus
                  className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-lg mb-3 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800 dark:text-gray-100"
                  placeholder="Extension or Number"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      transferCall(e.currentTarget.value);
                      setView('dialpad');
                    }
                  }}
                  data-testid="webphone-transfer-input"
                />
                <button onClick={() => setView('dialpad')} className="text-sm text-gray-500 w-full hover:text-gray-800 dark:hover:text-gray-200 py-2">
                  Cancel
                </button>
              </div>
            )}

            <button 
              onClick={hangupCall} 
              className="w-full mt-4 bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-red-200 dark:shadow-red-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              data-testid="webphone-hangup"
            >
              <Phone size={20} className="rotate-[135deg]" />
              HANG UP
            </button>
          </div>
        ) : (
          
          /* DIALPAD (IDLE) */
          <div className="flex flex-col h-full" data-testid="webphone-dialpad">
            <input 
              className="text-3xl font-light text-center bg-transparent border-none focus:ring-0 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 mb-6 py-4 outline-none"
              placeholder="Enter number..."
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value)}
              data-testid="webphone-dial-input"
            />
            
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[1,2,3,4,5,6,7,8,9,'*',0,'#'].map(key => (
                <button 
                  key={key}
                  onClick={() => setDialNumber(prev => prev + key)}
                  className="h-14 w-14 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-xl font-medium text-gray-700 dark:text-gray-200 mx-auto transition-colors active:bg-gray-300 dark:active:bg-gray-500"
                  data-testid={`webphone-key-${key}`}
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="flex justify-center gap-4 mt-auto">
              <button 
                onClick={() => setDialNumber(prev => prev.slice(0, -1))}
                className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 flex items-center justify-center transition-colors"
                data-testid="webphone-backspace"
              >
                <X size={20} />
              </button>
              <button 
                onClick={() => makeCall(dialNumber)} 
                disabled={!dialNumber || sessionStatus !== 'registered'}
                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-200 dark:shadow-green-900/20 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                data-testid="webphone-call"
              >
                <Phone size={28} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebPhone;
