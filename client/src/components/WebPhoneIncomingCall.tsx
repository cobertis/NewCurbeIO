import { Phone, PhoneOff, Volume2 } from 'lucide-react';
import { useWebPhoneStore, webPhone } from '@/services/webphone';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatPhoneInput } from '@shared/phone';

export function WebPhoneIncomingCall() {
  const incomingCallVisible = useWebPhoneStore(state => state.incomingCallVisible);
  const currentCall = useWebPhoneStore(state => state.currentCall);
  
  if (!currentCall) return null;
  
  return (
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
            <h3 className="text-3xl font-semibold text-white mb-1">
              {formatPhoneInput(currentCall.phoneNumber)}
            </h3>
            {currentCall.displayName && (
              <p className="text-sm text-slate-400">
                {currentCall.displayName}
              </p>
            )}
          </div>
          
          <div className="flex gap-4">
            <Button
              onClick={() => webPhone.rejectCall()}
              className="flex-1 h-14 bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-reject-call"
            >
              <PhoneOff className="h-5 w-5 mr-2" />
              Decline
            </Button>
            <Button
              onClick={() => webPhone.answerCall()}
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
  );
}
