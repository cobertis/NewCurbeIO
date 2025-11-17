import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebPhoneStore, webPhone } from '@/services/webphone';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import type { User as UserType } from '@shared/schema';

export function WebPhoneFloatingButton() {
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  
  const connectionStatus = useWebPhoneStore(state => state.connectionStatus);
  const currentCall = useWebPhoneStore(state => state.currentCall);
  const setAudioElements = useWebPhoneStore(state => state.setAudioElements);
  const setSipCredentials = useWebPhoneStore(state => state.setSipCredentials);
  const setWssServer = useWebPhoneStore(state => state.setWssServer);
  const toggleDialpad = useWebPhoneStore(state => state.toggleDialpad);
  
  const { data: sessionData } = useQuery<{ user: UserType }>({
    queryKey: ["/api/session"],
  });
  
  const user = sessionData?.user;
  
  // Auto-initialize WebPhone when user has saved credentials
  useEffect(() => {
    console.log('[WebPhone] Auto-init check:', {
      hasUser: !!user,
      sipEnabled: user?.sipEnabled,
      hasExtension: !!user?.sipExtension,
      hasPassword: !!user?.sipPassword,
      server: user?.sipServer
    });
    
    if (user?.sipEnabled && user?.sipExtension && user?.sipPassword) {
      console.log('[WebPhone] Starting auto-initialization...');
      
      setSipCredentials(user.sipExtension, user.sipPassword);
      if (user.sipServer) {
        setWssServer(user.sipServer);
      }
      
      webPhone.initialize(user.sipExtension, user.sipPassword, user.sipServer || undefined)
        .then(() => {
          console.log('[WebPhone] Auto-initialized successfully');
        })
        .catch((error) => {
          console.error('[WebPhone] Auto-initialization failed:', error);
        });
    }
  }, [user?.sipEnabled, user?.sipExtension, user?.sipPassword, user?.sipServer, setSipCredentials, setWssServer]);
  
  // Initialize audio elements
  useEffect(() => {
    if (remoteAudioRef.current && localAudioRef.current) {
      setAudioElements(localAudioRef.current, remoteAudioRef.current);
    }
  }, [setAudioElements]);
  
  const isConnected = connectionStatus === 'connected';
  const isInCall = !!currentCall;
  
  const handleClick = () => {
    toggleDialpad();
  };
  
  return (
    <>
      {/* Hidden audio elements */}
      <audio ref={remoteAudioRef} autoPlay />
      <audio ref={localAudioRef} autoPlay muted />
      
      {/* Floating button */}
      <Button
        onClick={handleClick}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
          "transition-all duration-200 hover:scale-110",
          isInCall ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
        )}
        data-testid="button-webphone-float"
      >
        {isInCall ? (
          <PhoneOff className="h-6 w-6 text-white" />
        ) : (
          <Phone className="h-6 w-6 text-white" />
        )}
        
        {/* Connection status indicator */}
        <div className={cn(
          "absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white",
          isConnected ? "bg-green-500" : "bg-red-500"
        )} />
      </Button>
    </>
  );
}
