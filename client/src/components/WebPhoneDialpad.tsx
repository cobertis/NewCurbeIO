import { useState } from 'react';
import { Phone } from 'lucide-react';
import { useWebPhoneStore, webPhone } from '@/services/webphone';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function WebPhoneDialpad() {
  const [dialNumber, setDialNumber] = useState('');
  const dialpadVisible = useWebPhoneStore(state => state.dialpadVisible);
  const currentCall = useWebPhoneStore(state => state.currentCall);
  const toggleDialpad = useWebPhoneStore(state => state.toggleDialpad);
  
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  const letters = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ', '', '+', ''];
  
  const handleDial = (digit: string) => {
    setDialNumber(prev => prev + digit);
    if (currentCall?.status === 'answered') {
      webPhone.sendDTMF(digit);
    }
  };
  
  const handleCall = async () => {
    if (!dialNumber) return;
    try {
      await webPhone.makeCall(dialNumber);
      setDialNumber('');
      toggleDialpad();
    } catch (error) {
      console.error('Failed to make call:', error);
    }
  };
  
  return (
    <Dialog open={dialpadVisible} onOpenChange={toggleDialpad}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <div className="p-4">
          <div className="mb-6">
            <input
              type="text"
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white text-2xl text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter number..."
              data-testid="input-dial-number"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-3 mb-6">
            {digits.map((digit, index) => (
              <button
                key={digit}
                onClick={() => handleDial(digit)}
                className="aspect-square bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 rounded-xl flex flex-col items-center justify-center transition-all transform active:scale-95"
                data-testid={`button-dialpad-${digit}`}
              >
                <span className="text-3xl text-white font-light">{digit}</span>
                {letters[index] && (
                  <span className="text-xs text-slate-400">{letters[index]}</span>
                )}
              </button>
            ))}
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={() => setDialNumber(prev => prev.slice(0, -1))}
              variant="outline"
              className="flex-1 bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50"
              data-testid="button-backspace"
            >
              Backspace
            </Button>
            <Button
              onClick={handleCall}
              className="flex-1 bg-green-600 text-white hover:bg-green-700"
              disabled={!dialNumber}
              data-testid="button-make-call"
            >
              <Phone className="h-4 w-4 mr-2" />
              Call
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
