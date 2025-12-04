import { useRef, useEffect } from 'react';
import { Phone, PhoneOff, CheckCircle, X } from 'lucide-react';
import { useWebPhoneStore, webPhone } from '@/services/webphone';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPhoneInput } from '@shared/phone';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

function formatCallerNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // If it's 3-4 digits, it's an extension
  if (digits.length >= 3 && digits.length <= 4) {
    return `Ext. ${digits}`;
  }
  
  // Otherwise, format as regular phone number
  return formatPhoneInput(phoneNumber);
}

export function WebPhoneIncomingCall() {
  const incomingCallVisible = useWebPhoneStore(state => state.incomingCallVisible);
  const currentCall = useWebPhoneStore(state => state.currentCall);
  const callerInfo = useWebPhoneStore(state => state.callerInfo);
  const clearCallerInfo = useWebPhoneStore(state => state.clearCallerInfo);
  const ringtoneRef = useRef<HTMLAudioElement>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Play ringtone when incoming call appears
  useEffect(() => {
    if (incomingCallVisible && ringtoneRef.current) {
      console.log('[Ringtone] 🔔 Playing ringtone for incoming call');
      ringtoneRef.current.play().catch(err => {
        console.error('[Ringtone] ❌ Failed to play:', err);
      });
    }
    
    // Stop ringtone when component unmounts or call is answered/declined
    return () => {
      if (ringtoneRef.current) {
        console.log('[Ringtone] 🔇 Stopping ringtone');
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    };
  }, [incomingCallVisible]);
  
  // Handle answer - stop ringtone and navigate to caller's quote/policy
  const handleAnswer = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    webPhone.answerCall();
    
    // Navigate to caller's record if identified
    if (callerInfo?.found && callerInfo.id) {
      const clientName = `${callerInfo.firstName} ${callerInfo.lastName}`.trim();
      const recordType = callerInfo.type === 'quote' ? 'Quote' : 'Policy';
      
      // Navigate after a short delay to allow the call to be answered
      setTimeout(() => {
        if (callerInfo.type === 'quote') {
          setLocation(`/quotes/${callerInfo.id}`);
        } else if (callerInfo.type === 'policy') {
          setLocation(`/customers/${callerInfo.id}`);
        }
        
        // Show toast notification
        toast({
          title: `Opening ${recordType}`,
          description: `${recordType} for ${clientName}`,
        });
        
        // Clear caller info after navigation
        clearCallerInfo();
      }, 500);
    }
  };
  
  // Handle reject - stop ringtone
  const handleReject = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    webPhone.rejectCall();
  };
  
  if (!currentCall || !incomingCallVisible) return null;
  
  return (
    <>
      {/* Hidden ringtone audio element */}
      <audio 
        ref={ringtoneRef} 
        src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" 
        loop 
      />
      
      {/* Compact incoming call notification - top right */}
      <div 
        className="fixed top-20 right-4 w-80 bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 animate-in slide-in-from-top-5 duration-300"
        data-testid="incoming-call-notification"
      >
        <div className="p-4">
          {/* Header with icon and close */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                <Phone className="h-5 w-5 text-green-500" />
              </div>
              <span className="text-xs font-medium text-slate-400">Incoming Call</span>
            </div>
          </div>
          
          {/* Caller info */}
          <div className="mb-4">
            {callerInfo?.found ? (
              <>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {callerInfo.firstName} {callerInfo.lastName}
                </h3>
                <Badge 
                  className="bg-green-600 hover:bg-green-700 text-white text-xs mb-1" 
                  data-testid="badge-caller-identified"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {callerInfo.type === 'quote' ? 'Quote Client' : 'Policy Client'}
                </Badge>
                <p className="text-xs text-slate-400 mt-1">
                  {formatCallerNumber(currentCall.phoneNumber)}
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {currentCall.displayName || "Unknown Caller"}
                </h3>
                <p className="text-xs text-slate-400">
                  {formatCallerNumber(currentCall.phoneNumber)}
                </p>
              </>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleReject}
              className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white text-sm"
              data-testid="button-reject-call"
            >
              <PhoneOff className="h-4 w-4 mr-1" />
              Decline
            </Button>
            <Button
              onClick={handleAnswer}
              className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white text-sm"
              data-testid="button-answer-call"
            >
              <Phone className="h-4 w-4 mr-1" />
              Answer
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
