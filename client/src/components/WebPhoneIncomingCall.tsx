import { useRef, useEffect } from 'react';
import { Phone, PhoneOff, Volume2, CheckCircle } from 'lucide-react';
import { useWebPhoneStore, webPhone } from '@/services/webphone';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
          setLocation(`/policies/${callerInfo.id}`);
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
  
  if (!currentCall) return null;
  
  return (
    <>
      {/* Hidden ringtone audio element */}
      <audio 
        ref={ringtoneRef} 
        src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" 
        loop 
      />
      
      <Dialog open={incomingCallVisible} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
          <div className="p-6">
            <div className="flex items-center justify-center mb-6">
              <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                <Phone className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div className="text-center mb-8">
              <p className="text-sm text-slate-400 mb-2">Incoming Call</p>
              
              {callerInfo?.found ? (
                <>
                  <h3 className="text-3xl font-semibold text-white mb-2">
                    {callerInfo.firstName} {callerInfo.lastName}
                  </h3>
                  <Badge 
                    className="bg-green-600 hover:bg-green-700 text-white mb-2" 
                    data-testid="badge-caller-identified"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {callerInfo.type === 'quote' ? 'Quote Client' : 'Policy Client'}
                  </Badge>
                  <p className="text-sm text-slate-400">
                    {formatCallerNumber(currentCall.phoneNumber)}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-3xl font-semibold text-white mb-1">
                    {currentCall.displayName || formatCallerNumber(currentCall.phoneNumber)}
                  </h3>
                  {currentCall.displayName && (
                    <p className="text-sm text-slate-400">
                      {formatCallerNumber(currentCall.phoneNumber)}
                    </p>
                  )}
                  {!currentCall.displayName && (
                    <p className="text-sm text-slate-400">Unknown</p>
                  )}
                </>
              )}
            </div>
            
            <div className="flex gap-4">
              <Button
                onClick={handleReject}
                className="flex-1 h-14 bg-red-600 hover:bg-red-700 text-white"
                data-testid="button-reject-call"
              >
                <PhoneOff className="h-5 w-5 mr-2" />
                Decline
              </Button>
              <Button
                onClick={handleAnswer}
                className="flex-1 h-14 bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-answer-call"
              >
                <Phone className="h-5 w-5 mr-2" />
                Answer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
