import { useState } from 'react';
import { useTelnyxPhone } from '../hooks/useTelnyxPhone';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, X, ArrowRight, RotateCcw, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const dialpadButtons = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export const WebPhone = () => {
  const {
    sessionStatus,
    incomingCall,
    activeCall,
    isMuted,
    isOnHold,
    answerCall,
    rejectCall,
    hangupCall,
    toggleMute,
    toggleHold,
    sendDTMF,
    transferCall,
    makeCall,
    reconnect,
  } = useTelnyxPhone();

  const [dialNumber, setDialNumber] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [showDialpad, setShowDialpad] = useState(false);

  const handleDialpadPress = (digit: string) => {
    if (activeCall) {
      sendDTMF(digit);
    } else {
      setDialNumber(prev => prev + digit);
    }
  };

  const handleCall = () => {
    if (dialNumber.length > 0) {
      makeCall(dialNumber);
    }
  };

  const handleTransfer = () => {
    if (transferTarget.length > 0) {
      transferCall(transferTarget);
      setShowTransfer(false);
      setTransferTarget('');
    }
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

  return (
    <div className="w-80 bg-white dark:bg-gray-900 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden" data-testid="webphone-container">
      {/* Header */}
      <div 
        className={cn(
          "p-3 text-white flex justify-between items-center",
          sessionStatus === 'registered' ? 'bg-green-600' : 
          sessionStatus === 'connecting' ? 'bg-yellow-500' : 
          sessionStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
        )}
        data-testid="webphone-header"
      >
        <div className="flex items-center gap-2">
          <Phone size={18} />
          <span className="font-bold">Phone</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase" data-testid="webphone-status">{sessionStatus}</span>
          {sessionStatus === 'error' && (
            <button onClick={reconnect} className="p-1 hover:bg-white/20 rounded" data-testid="webphone-reconnect">
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Incoming Call Screen */}
      {incomingCall && !activeCall && (
        <div className="p-6 text-center animate-pulse bg-indigo-50 dark:bg-indigo-900/30" data-testid="webphone-incoming">
          <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100">Incoming Call</h3>
          <p className="text-xl my-2 font-mono" data-testid="webphone-caller-id">{getRemoteNumber()}</p>
          <div className="flex justify-center gap-4 mt-4">
            <button 
              onClick={answerCall} 
              className="p-4 bg-green-500 rounded-full text-white hover:bg-green-600 transition-colors"
              data-testid="webphone-answer"
            >
              <Phone size={24} />
            </button>
            <button 
              onClick={rejectCall} 
              className="p-4 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
              data-testid="webphone-reject"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}

      {/* Active Call Screen */}
      {activeCall && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800" data-testid="webphone-active-call">
          <div className="text-center mb-4">
            <div className="text-green-600 dark:text-green-400 font-bold mb-1">ON CALL</div>
            <div className="text-2xl font-mono" data-testid="webphone-remote-number">{getRemoteNumber()}</div>
            {isOnHold && (
              <span className="text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded mt-2 inline-block">
                HOLD
              </span>
            )}
          </div>

          {/* Main Controls */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <button 
              onClick={toggleMute} 
              className={cn(
                "p-3 rounded-lg flex flex-col items-center transition-colors",
                isMuted ? 'bg-red-100 dark:bg-red-900/50 text-red-600' : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
              )}
              data-testid="webphone-mute"
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              <span className="text-xs mt-1">Mute</span>
            </button>
            <button 
              onClick={toggleHold} 
              className={cn(
                "p-3 rounded-lg flex flex-col items-center transition-colors",
                isOnHold ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700' : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
              )}
              data-testid="webphone-hold"
            >
              {isOnHold ? <Play size={20} /> : <Pause size={20} />}
              <span className="text-xs mt-1">{isOnHold ? 'Resume' : 'Hold'}</span>
            </button>
            <button 
              onClick={() => setShowDialpad(!showDialpad)} 
              className={cn(
                "p-3 rounded-lg flex flex-col items-center transition-colors",
                showDialpad ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
              )}
              data-testid="webphone-dialpad-toggle"
            >
              <Hash size={20} />
              <span className="text-xs mt-1">DTMF</span>
            </button>
            <button 
              onClick={() => setShowTransfer(!showTransfer)} 
              className="p-3 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg flex flex-col items-center transition-colors"
              data-testid="webphone-transfer-toggle"
            >
              <ArrowRight size={20} />
              <span className="text-xs mt-1">Transfer</span>
            </button>
          </div>

          {/* DTMF Dialpad */}
          {showDialpad && (
            <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-700 rounded" data-testid="webphone-dtmf-pad">
              <div className="grid grid-cols-3 gap-1">
                {dialpadButtons.flat().map((digit) => (
                  <button
                    key={digit}
                    onClick={() => handleDialpadPress(digit)}
                    className="p-2 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded text-lg font-mono transition-colors"
                    data-testid={`webphone-dtmf-${digit}`}
                  >
                    {digit}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Transfer Zone */}
          {showTransfer && (
            <div className="mb-4 p-2 bg-gray-200 dark:bg-gray-700 rounded" data-testid="webphone-transfer-zone">
              <Input 
                type="text" 
                placeholder="Extension or Number" 
                className="w-full mb-2"
                value={transferTarget}
                onChange={e => setTransferTarget(e.target.value)}
                data-testid="webphone-transfer-input"
              />
              <Button 
                onClick={handleTransfer} 
                className="w-full"
                disabled={!transferTarget}
                data-testid="webphone-transfer-confirm"
              >
                Transfer Now
              </Button>
            </div>
          )}

          <button 
            onClick={hangupCall} 
            className="w-full bg-red-600 text-white p-3 rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            data-testid="webphone-hangup"
          >
            <PhoneOff size={20} />
            HANG UP
          </button>
        </div>
      )}

      {/* Dialpad Screen (Idle) */}
      {!activeCall && !incomingCall && (
        <div className="p-4" data-testid="webphone-dialpad">
          <Input 
            type="tel" 
            className="w-full text-2xl p-2 text-center border-b-2 border-indigo-100 dark:border-indigo-900 mb-4 font-mono" 
            placeholder="Enter number..." 
            value={dialNumber}
            onChange={(e) => setDialNumber(e.target.value)}
            data-testid="webphone-dial-input"
          />
          
          {/* Dialpad Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {dialpadButtons.flat().map((digit) => (
              <button
                key={digit}
                onClick={() => handleDialpadPress(digit)}
                className="p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-xl font-mono transition-colors"
                data-testid={`webphone-dial-${digit}`}
              >
                {digit}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setDialNumber(prev => prev.slice(0, -1))}
              className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 p-3 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              data-testid="webphone-backspace"
            >
              ←
            </button>
            <button 
              onClick={handleCall} 
              disabled={sessionStatus !== 'registered' || !dialNumber}
              className="flex-[2] bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              data-testid="webphone-call"
            >
              <Phone size={20} />
              CALL
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebPhone;
