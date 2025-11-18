// WebPhone Service - Singleton SIP.js implementation
import { UserAgent, Registerer, Session, Inviter, SessionState, Invitation } from 'sip.js';
import { create } from 'zustand';

// WebPhone state store
interface Call {
  id: string;
  direction: 'inbound' | 'outbound';
  phoneNumber: string;
  displayName?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'ringing' | 'answered' | 'ended' | 'missed';
  session?: Session;
}

interface CallLog extends Call {
  recordingUrl?: string;
}

interface WebPhoneState {
  // Connection state
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  connectionError?: string;
  
  // User configuration
  sipExtension?: string;
  sipPassword?: string;
  sipDomain: string;
  wssServer: string;
  
  // Current call
  currentCall?: Call;
  isCallActive: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  isRecording: boolean;
  doNotDisturb: boolean;
  callWaitingEnabled: boolean;
  
  // Call history
  callHistory: CallLog[];
  
  // UI state
  dialpadVisible: boolean;
  incomingCallVisible: boolean;
  
  // Audio elements
  localAudioElement?: HTMLAudioElement;
  remoteAudioElement?: HTMLAudioElement;
  
  // Actions
  setConnectionStatus: (status: WebPhoneState['connectionStatus'], error?: string) => void;
  setSipCredentials: (extension: string, password: string) => void;
  setWssServer: (server: string) => void;
  setCurrentCall: (call?: Call) => void;
  setCallStatus: (status: Call['status']) => void;
  setMuted: (muted: boolean) => void;
  setOnHold: (hold: boolean) => void;
  setIsRecording: (recording: boolean) => void;
  setDoNotDisturb: (dnd: boolean) => void;
  setCallWaitingEnabled: (enabled: boolean) => void;
  addCallToHistory: (call: CallLog) => void;
  toggleDialpad: () => void;
  setIncomingCallVisible: (visible: boolean) => void;
  setAudioElements: (local: HTMLAudioElement, remote: HTMLAudioElement) => void;
  clearCallHistory: () => void;
}

export const useWebPhoneStore = create<WebPhoneState>((set, get) => ({
  // Initial state
  isConnected: false,
  connectionStatus: 'disconnected',
  sipDomain: 'pbx.curbe.io',
  wssServer: 'wss://pbx.curbe.io:8089/ws',
  isCallActive: false,
  isMuted: false,
  isOnHold: false,
  isRecording: false,
  doNotDisturb: localStorage.getItem('webphone_dnd') === '1',
  callWaitingEnabled: localStorage.getItem('webphone_call_waiting') !== '0',
  callHistory: JSON.parse(localStorage.getItem('webphone_call_history') || '[]').map((call: any) => ({
    ...call,
    startTime: call.startTime ? new Date(call.startTime) : undefined,
    endTime: call.endTime ? new Date(call.endTime) : undefined,
  })),
  dialpadVisible: false,
  incomingCallVisible: false,
  
  // Actions
  setConnectionStatus: (status, error) => set({ 
    connectionStatus: status, 
    connectionError: error,
    isConnected: status === 'connected'
  }),
  
  setSipCredentials: (extension, password) => set({ 
    sipExtension: extension, 
    sipPassword: password 
  }),
  
  setWssServer: (server: string) => set({ wssServer: server }),
  
  setCurrentCall: (call) => set({ 
    currentCall: call,
    isCallActive: !!call 
  }),
  
  setCallStatus: (status) => set(state => ({
    currentCall: state.currentCall ? { ...state.currentCall, status } : undefined
  })),
  
  setMuted: (muted) => set({ isMuted: muted }),
  setOnHold: (hold) => set({ isOnHold: hold }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setDoNotDisturb: (dnd) => set({ doNotDisturb: dnd }),
  setCallWaitingEnabled: (enabled) => set({ callWaitingEnabled: enabled }),
  
  addCallToHistory: (call) => set(state => {
    // Remove non-serializable fields (session has circular references)
    const { session, ...serializableCall } = call;
    const newHistory = [serializableCall, ...state.callHistory].slice(0, 100); // Keep last 100 calls
    localStorage.setItem('webphone_call_history', JSON.stringify(newHistory));
    return { callHistory: newHistory };
  }),
  
  toggleDialpad: () => set(state => ({ dialpadVisible: !state.dialpadVisible })),
  setIncomingCallVisible: (visible) => set({ incomingCallVisible: visible }),
  
  setAudioElements: (local, remote) => set({ 
    localAudioElement: local, 
    remoteAudioElement: remote 
  }),
  
  clearCallHistory: () => {
    localStorage.removeItem('webphone_call_history');
    set({ callHistory: [] });
  }
}));

// WebPhone Manager Class
class WebPhoneManager {
  private static instance: WebPhoneManager;
  private userAgent?: UserAgent;
  private registerer?: Registerer;
  private currentSession?: Session;
  private reconnectInterval?: NodeJS.Timeout;
  private audioContext?: AudioContext;
  private ringtoneOscillator?: OscillatorNode;
  private ringtoneGain?: GainNode;
  private ringbackOscillator?: OscillatorNode;
  private ringbackGain?: GainNode;
  
  private constructor() {
    // Private constructor for singleton
    this.initializeAudio();
  }
  
  public static getInstance(): WebPhoneManager {
    if (!WebPhoneManager.instance) {
      WebPhoneManager.instance = new WebPhoneManager();
      // Store instance globally for persistence
      (window as any).__webphoneManager = WebPhoneManager.instance;
    }
    return WebPhoneManager.instance;
  }
  
  private initializeAudio() {
    // Create Web Audio Context for synthetic ringtones
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  private playRingtone() {
    if (!this.audioContext) return;
    
    // Stop any existing ringtone
    this.stopRingtone();
    
    // Create iPhone-style ringtone (two-tone 1000Hz + 1320Hz)
    const oscillator1 = this.audioContext.createOscillator();
    const oscillator2 = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator1.type = 'sine';
    oscillator1.frequency.value = 1000;
    oscillator2.type = 'sine';
    oscillator2.frequency.value = 1320;
    
    gainNode.gain.value = 0.3; // Volume at 30%
    
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator1.start();
    oscillator2.start();
    
    this.ringtoneOscillator = oscillator1;
    this.ringtoneGain = gainNode;
    
    console.log('[Ringtone] 🔔 Playing ringtone');
  }
  
  private stopRingtone() {
    if (this.ringtoneOscillator) {
      try {
        this.ringtoneOscillator.stop();
        this.ringtoneOscillator.disconnect();
      } catch (e) {
        // Ignore errors from already stopped oscillators
      }
      this.ringtoneOscillator = undefined;
    }
    if (this.ringtoneGain) {
      this.ringtoneGain.disconnect();
      this.ringtoneGain = undefined;
    }
    console.log('[Ringtone] 🔇 Stopping ringtone');
  }
  
  private playRingbackTone() {
    if (!this.audioContext) return;
    
    // Stop any existing ringback
    this.stopRingbackTone();
    
    // US/Canada ringback tone (440Hz + 480Hz)
    const oscillator1 = this.audioContext.createOscillator();
    const oscillator2 = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator1.type = 'sine';
    oscillator1.frequency.value = 440;
    oscillator2.type = 'sine';
    oscillator2.frequency.value = 480;
    
    gainNode.gain.value = 0.2; // Volume at 20%
    
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator1.start();
    oscillator2.start();
    
    this.ringbackOscillator = oscillator1;
    this.ringbackGain = gainNode;
    
    console.log('[Ringback] 📞 Playing ringback tone');
  }
  
  private stopRingbackTone() {
    if (this.ringbackOscillator) {
      try {
        this.ringbackOscillator.stop();
        this.ringbackOscillator.disconnect();
      } catch (e) {
        // Ignore errors from already stopped oscillators
      }
      this.ringbackOscillator = undefined;
    }
    if (this.ringbackGain) {
      this.ringbackGain.disconnect();
      this.ringbackGain = undefined;
    }
    console.log('[Ringback] 🔇 Stopping ringback tone');
  }
  
  public async initialize(extension: string, password: string, server?: string): Promise<void> {
    const store = useWebPhoneStore.getState();
    
    // Update server if provided (for storage, not used for connection)
    if (server) {
      store.setWssServer(server);
    }
    
    // Don't reinitialize if already connected with same credentials
    if (this.userAgent && store.isConnected && 
        store.sipExtension === extension && 
        store.sipPassword === password &&
        (!server || store.wssServer === server)) {
      console.log('[WebPhone] Already connected with same credentials');
      return;
    }
    
    store.setConnectionStatus('connecting');
    store.setSipCredentials(extension, password);
    
    try {
      // Disconnect existing connection if any
      if (this.userAgent) {
        await this.disconnect();
      }
      
      // DIRECT CONNECTION to Asterisk WSS (no proxy)
      // Connect directly from browser to pbx1.curbe.io
      const pbxServer = server || store.wssServer || 'wss://pbx1.curbe.io:8089/ws';
      
      // Create SIP configuration  
      const uriString = `sip:${extension}@${store.sipDomain}`;
      const transportOptions = {
        server: pbxServer, // Direct connection to Asterisk
        connectionTimeout: 10,
        keepAliveInterval: 30,
        traceSip: true
      };
      
      console.log('[WebPhone] Initializing with config:', {
        uri: uriString,
        directPBX: pbxServer,
        username: extension
      });
      
      // Create User Agent with STUN/TURN servers for WebRTC NAT traversal
      // Using Curbe's private TURN server for reliable connectivity
      this.userAgent = new UserAgent({
        uri: UserAgent.makeURI(uriString)!,
        transportOptions,
        authorizationUsername: extension,
        authorizationPassword: password,
        displayName: extension,
        sessionDescriptionHandlerFactoryOptions: {
          peerConnectionOptions: {
            iceServers: [
              {
                urls: 'stun:95.111.237.201:3478'
              },
              {
                urls: 'turn:95.111.237.201:3478',
                username: 'javier',
                credential: 'superpass123'
              }
            ],
            iceTransportPolicy: 'all'
          }
        },
        delegate: {
          onInvite: this.handleIncomingCall.bind(this),
          onConnect: () => {
            console.log('[WebPhone] ✅ Connected to WebSocket proxy successfully');
            store.setConnectionStatus('connected');
            this.startReconnectMonitor();
          },
          onDisconnect: (error?: Error) => {
            console.error('[WebPhone] ❌ Disconnected from WebSocket proxy', {
              error: error?.message,
              stack: error?.stack
            });
            store.setConnectionStatus('disconnected', error?.message);
          }
        }
      });
      
      // Start the User Agent
      console.log('[WebPhone] Starting UserAgent...');
      await this.userAgent.start();
      console.log('[WebPhone] UserAgent started, attempting registration...');
      
      // Create and send registration
      this.registerer = new Registerer(this.userAgent, {
        expires: 300
      });
      
      // Add registration state change listener
      this.registerer.stateChange.addListener((newState) => {
        console.log('[WebPhone] Registration state changed:', newState);
        if (newState === 'Registered') {
          console.log('[WebPhone] ✅ Successfully registered to Asterisk');
          store.setConnectionStatus('connected');
        }
      });
      
      await this.registerer.register();
      console.log('[WebPhone] Registration request sent');
      
    } catch (error: any) {
      console.error('[WebPhone] ❌ Initialization failed:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        error: error
      });
      store.setConnectionStatus('error', error.message);
      throw error;
    }
  }
  
  private handleIncomingCall(invitation: Invitation) {
    const store = useWebPhoneStore.getState();
    
    // Extract caller info
    const callerNumber = invitation.remoteIdentity.uri.user || 'Unknown';
    const callerName = invitation.remoteIdentity.displayName || callerNumber;
    
    console.log('[WebPhone] 📞 Incoming call from:', callerNumber);
    
    // Check DND and Call Waiting BEFORE creating call object
    if (!this.shouldAcceptIncomingCall()) {
      console.log('[WebPhone] Auto-rejecting incoming call');
      invitation.reject().catch((error) => {
        console.error('[WebPhone] Error rejecting call:', error);
      });
      return;
    }
    
    // BROWSER-PHONE PATTERN: Attach session delegate for instant audio
    this.attachSessionDescriptionHandler(invitation, false);
    
    // Create call object
    const call: Call = {
      id: Math.random().toString(36).substr(2, 9),
      direction: 'inbound',
      phoneNumber: callerNumber,
      displayName: callerName,
      startTime: new Date(),
      status: 'ringing',
      session: invitation
    };
    
    store.setCurrentCall(call);
    store.setIncomingCallVisible(true);
    
    // Play ringtone
    this.playRingtone();
    
    // Handle session state changes
    invitation.stateChange.addListener((state) => {
      console.log('[WebPhone] Incoming call state:', state);
      switch (state) {
        case SessionState.Terminated:
          this.endCall();
          break;
        case SessionState.Established:
          console.log('[WebPhone] Call established');
          store.setCallStatus('answered');
          this.stopRingtone();
          break;
      }
    });
    
    // Auto-reject after 30 seconds
    setTimeout(() => {
      if (store.currentCall?.status === 'ringing') {
        this.rejectCall();
      }
    }, 30000);
  }
  
  public async makeCall(phoneNumber: string): Promise<void> {
    if (!this.userAgent) {
      throw new Error('WebPhone not initialized');
    }
    
    const store = useWebPhoneStore.getState();
    
    // Format number
    const formattedNumber = phoneNumber.replace(/\D/g, '');
    const uriString = `sip:${formattedNumber}@${store.sipDomain}`;
    const targetURI = UserAgent.makeURI(uriString);
    
    if (!targetURI) {
      throw new Error('Invalid phone number');
    }
    
    try {
      // Request microphone permission before making call
      console.log('[WebPhone] Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      console.log('[WebPhone] Microphone permission granted');
      
      // Create inviter with audio constraints
      const inviter = new Inviter(this.userAgent, targetURI, {
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          }
        }
      });
      
      // BROWSER-PHONE PATTERN: Attach session delegate for instant audio
      this.attachSessionDescriptionHandler(inviter, false);
      
      // Create call object
      const call: Call = {
        id: Math.random().toString(36).substr(2, 9),
        direction: 'outbound',
        phoneNumber: formattedNumber,
        startTime: new Date(),
        status: 'ringing',
        session: inviter
      };
      
      store.setCurrentCall(call);
      this.currentSession = inviter;
      
      // Handle session state changes
      inviter.stateChange.addListener((state) => {
        console.log('[WebPhone] Outbound call state:', state);
        switch (state) {
          case SessionState.Establishing:
            // Play ringback tone when ringing
            console.log('[WebPhone] Call ringing, playing ringback tone');
            this.playRingbackTone();
            break;
          case SessionState.Established:
            console.log('[WebPhone] Call answered, stopping ringback tone');
            this.stopRingbackTone();
            store.setCallStatus('answered');
            break;
          case SessionState.Terminated:
            this.stopRingbackTone();
            this.endCall();
            break;
        }
      });
      
      // Send the invite
      await inviter.invite({
        requestDelegate: {
          onAccept: () => console.log('[WebPhone] Call accepted'),
          onReject: () => {
            console.log('[WebPhone] Call rejected');
            this.endCall();
          }
        }
      });
    } catch (error) {
      console.error('[WebPhone] Failed to make call:', error);
      this.endCall();
      throw error;
    }
  }
  
  public async answerCall(): Promise<void> {
    const store = useWebPhoneStore.getState();
    const session = store.currentCall?.session as Invitation;
    
    if (!session) return;
    
    this.stopRingtone();
    store.setIncomingCallVisible(false);
    
    try {
      this.currentSession = session;
      
      // Browser-Phone pattern: Just accept - the SessionDescriptionHandler-created event listener
      // already configured ontrack for instant audio when handleIncomingCall() was called
      console.log('[WebPhone] Accepting call with instant audio...');
      await session.accept({
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          }
        }
      });
      
      console.log('[WebPhone] ✅ Call accepted - audio connected instantly via event listener');
    } catch (error) {
      console.error('[WebPhone] Failed to answer call:', error);
      this.endCall();
    }
  }
  
  public async rejectCall(): Promise<void> {
    const store = useWebPhoneStore.getState();
    const session = store.currentCall?.session as Invitation;
    
    if (!session) return;
    
    this.stopRingtone();
    store.setIncomingCallVisible(false);
    
    try {
      await session.reject();
    } catch (error) {
      console.error('[WebPhone] Failed to reject call:', error);
    }
    
    this.endCall();
  }
  
  public async hangupCall(): Promise<void> {
    if (!this.currentSession) return;
    
    try {
      if (this.currentSession.state === SessionState.Established) {
        await this.currentSession.bye();
      } else {
        // For non-established calls, check if it's an Inviter and cancel
        if (this.currentSession instanceof Inviter) {
          await this.currentSession.cancel();
        } else {
          // For Invitation, use reject
          await (this.currentSession as Invitation).reject();
        }
      }
    } catch (error) {
      console.error('[WebPhone] Failed to hangup call:', error);
    }
    
    this.endCall();
  }
  
  public toggleMute(): void {
    const store = useWebPhoneStore.getState();
    const pc = (this.currentSession as any)?.sessionDescriptionHandler?.peerConnection;
    
    if (pc) {
      const localStream = pc.getLocalStreams()[0];
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = store.isMuted;
          store.setMuted(!store.isMuted);
        }
      }
    }
  }
  
  public toggleHold(): void {
    const store = useWebPhoneStore.getState();
    
    if (!this.currentSession) return;
    
    // Note: SIP.js doesn't have built-in hold/unhold methods
    // This would require SDP renegotiation which is complex
    // For now, we'll just toggle the state and mute audio
    console.log('[WebPhone] Hold/unhold requires SDP renegotiation - using mute instead');
    
    const pc = (this.currentSession as any)?.sessionDescriptionHandler?.peerConnection;
    if (pc) {
      const localStream = pc.getLocalStreams()[0];
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = store.isOnHold; // Toggle based on current hold state
          store.setOnHold(!store.isOnHold);
        }
      }
    }
  }
  
  public sendDTMF(digit: string): void {
    if (!this.currentSession || this.currentSession.state !== SessionState.Established) {
      return;
    }
    
    (this.currentSession as any).sessionDescriptionHandler?.sendDtmf(digit);
  }
  
  // ============================================================================
  // BROWSER-PHONE FUNCTIONS - Hold/Mute/Transfer
  // ============================================================================
  
  public async holdCall(): Promise<void> {
    const store = useWebPhoneStore.getState();
    const session = this.currentSession;
    
    if (!session || session.state !== SessionState.Established) {
      console.warn('[WebPhone] Cannot hold - no active call');
      return;
    }
    
    if (store.isOnHold) {
      console.log('[WebPhone] Call is already on hold');
      return;
    }
    
    console.log('[WebPhone] Putting call on hold');
    
    const options = {
      requestDelegate: {
        onAccept: () => {
          const sdh = (session as any).sessionDescriptionHandler;
          if (sdh && sdh.peerConnection) {
            const pc = sdh.peerConnection;
            
            // Disable all inbound tracks
            pc.getReceivers().forEach((receiver: RTCRtpReceiver) => {
              if (receiver.track) {
                receiver.track.enabled = false;
              }
            });
            
            // Disable all outbound tracks
            pc.getSenders().forEach((sender: RTCRtpSender) => {
              if (sender.track) {
                sender.track.enabled = false;
              }
            });
          }
          
          store.setOnHold(true);
          console.log('[WebPhone] ✅ Call is on hold');
        },
        onReject: () => {
          console.warn('[WebPhone] Failed to put call on hold');
          store.setOnHold(false);
        }
      },
      sessionDescriptionHandlerOptions: {
        hold: true
      }
    };
    
    try {
      await (session as any).invite(options);
    } catch (error) {
      console.error('[WebPhone] Error putting call on hold:', error);
      store.setOnHold(false);
    }
  }
  
  public async unholdCall(): Promise<void> {
    const store = useWebPhoneStore.getState();
    const session = this.currentSession;
    
    if (!session || session.state !== SessionState.Established) {
      console.warn('[WebPhone] Cannot unhold - no active call');
      return;
    }
    
    if (!store.isOnHold) {
      console.log('[WebPhone] Call is not on hold');
      return;
    }
    
    console.log('[WebPhone] Taking call off hold');
    
    const options = {
      requestDelegate: {
        onAccept: () => {
          const sdh = (session as any).sessionDescriptionHandler;
          if (sdh && sdh.peerConnection) {
            const pc = sdh.peerConnection;
            
            // Enable all inbound tracks
            pc.getReceivers().forEach((receiver: RTCRtpReceiver) => {
              if (receiver.track) {
                receiver.track.enabled = true;
              }
            });
            
            // Enable all outbound tracks
            pc.getSenders().forEach((sender: RTCRtpSender) => {
              if (sender.track) {
                sender.track.enabled = true;
              }
            });
          }
          
          store.setOnHold(false);
          console.log('[WebPhone] ✅ Call is off hold');
        },
        onReject: () => {
          console.warn('[WebPhone] Failed to take call off hold');
          store.setOnHold(true);
        }
      },
      sessionDescriptionHandlerOptions: {
        hold: false
      }
    };
    
    try {
      await (session as any).invite(options);
    } catch (error) {
      console.error('[WebPhone] Error taking call off hold:', error);
      store.setOnHold(true);
    }
  }
  
  public muteCall(): void {
    const store = useWebPhoneStore.getState();
    const session = this.currentSession;
    
    if (!session || session.state !== SessionState.Established) {
      console.warn('[WebPhone] Cannot mute - no active call');
      return;
    }
    
    const sdh = (session as any).sessionDescriptionHandler;
    if (!sdh || !sdh.peerConnection) {
      console.warn('[WebPhone] No peer connection available');
      return;
    }
    
    console.log('[WebPhone] Muting microphone');
    
    const pc = sdh.peerConnection;
    pc.getSenders().forEach((sender: RTCRtpSender) => {
      if (sender.track && sender.track.kind === 'audio') {
        console.log('[WebPhone] Muting audio track:', sender.track.label);
        sender.track.enabled = false;
      }
    });
    
    store.setMuted(true);
    console.log('[WebPhone] ✅ Microphone muted');
  }
  
  public unmuteCall(): void {
    const store = useWebPhoneStore.getState();
    const session = this.currentSession;
    
    if (!session || session.state !== SessionState.Established) {
      console.warn('[WebPhone] Cannot unmute - no active call');
      return;
    }
    
    const sdh = (session as any).sessionDescriptionHandler;
    if (!sdh || !sdh.peerConnection) {
      console.warn('[WebPhone] No peer connection available');
      return;
    }
    
    console.log('[WebPhone] Unmuting microphone');
    
    const pc = sdh.peerConnection;
    pc.getSenders().forEach((sender: RTCRtpSender) => {
      if (sender.track && sender.track.kind === 'audio') {
        console.log('[WebPhone] Unmuting audio track:', sender.track.label);
        sender.track.enabled = true;
      }
    });
    
    store.setMuted(false);
    console.log('[WebPhone] ✅ Microphone unmuted');
  }
  
  // ============================================================================
  // TRANSFER FUNCTIONS - Blind & Attended Transfer
  // ============================================================================
  
  public async blindTransfer(targetNumber: string): Promise<void> {
    const session = this.currentSession;
    
    if (!session || session.state !== SessionState.Established) {
      console.warn('[WebPhone] Cannot transfer - no active call');
      return;
    }
    
    if (!targetNumber || targetNumber.trim() === '') {
      console.warn('[WebPhone] Cannot transfer - no target number provided');
      return;
    }
    
    console.log('[WebPhone] Initiating blind transfer to:', targetNumber);
    
    const store = useWebPhoneStore.getState();
    const targetUriString = `sip:${targetNumber.replace(/#/g, '%23')}@${store.sipDomain}`;
    const targetUri = UserAgent.makeURI(targetUriString);
    
    if (!targetUri) {
      console.error('[WebPhone] Invalid target URI for blind transfer');
      return;
    }
    
    const referOptions = {
      requestDelegate: {
        onAccept: () => {
          console.log('[WebPhone] ✅ Blind transfer accepted');
          // End the current call after successful transfer
          this.hangupCall();
        },
        onReject: () => {
          console.warn('[WebPhone] ❌ Blind transfer rejected');
        }
      }
    };
    
    try {
      // CRITICAL FIX: Pass URI object (not string) to refer() method
      // This matches Browser-Phone implementation pattern
      await (session as any).refer(targetUri, referOptions);
      console.log('[WebPhone] Blind transfer initiated successfully');
    } catch (error) {
      console.error('[WebPhone] Error initiating blind transfer:', error);
    }
  }
  
  public async attendedTransfer(targetNumber: string): Promise<void> {
    const session = this.currentSession;
    
    if (!session || session.state !== SessionState.Established) {
      console.warn('[WebPhone] Cannot transfer - no active call');
      return;
    }
    
    if (!targetNumber || targetNumber.trim() === '') {
      console.warn('[WebPhone] Cannot transfer - no target number provided');
      return;
    }
    
    console.log('[WebPhone] Initiating attended transfer to:', targetNumber);
    
    // Put current call on hold first
    await this.holdCall();
    
    // Make a new call to the transfer target
    const store = useWebPhoneStore.getState();
    const targetUri = UserAgent.makeURI(`sip:${targetNumber}@${store.sipDomain}`);
    
    if (!targetUri) {
      console.error('[WebPhone] Invalid target number for attended transfer');
      await this.unholdCall();
      return;
    }
    
    const inviteOptions = {
      sessionDescriptionHandlerOptions: {
        constraints: {
          audio: true,
          video: false
        }
      }
    };
    
    try {
      const inviter = new Inviter(this.userAgent!, targetUri, inviteOptions);
      
      // BROWSER-PHONE PATTERN: Attach session delegate for instant audio
      this.attachSessionDescriptionHandler(inviter, false);
      
      // Handle transfer target hanging up before transfer completes
      // Merge with existing delegate to preserve onSessionDescriptionHandler
      inviter.delegate = {
        ...inviter.delegate,
        onBye: () => {
          console.log('[WebPhone] Transfer target hung up before transfer completed');
          this.unholdCall();
        }
      };
      
      // Send the invite
      await inviter.invite();
      
      // When transfer session is established, complete the transfer
      inviter.stateChange.addListener((state: SessionState) => {
        if (state === SessionState.Established) {
          console.log('[WebPhone] Transfer target answered, completing attended transfer');
          
          // Use REFER to complete attended transfer
          const referOptions = {
            requestDelegate: {
              onAccept: () => {
                console.log('[WebPhone] ✅ Attended transfer accepted by server');
                // Add small delay to ensure transfer completes on server
                setTimeout(() => {
                  console.log('[WebPhone] Hanging up original call after transfer completion');
                  this.hangupCall();
                  inviter.bye();
                }, 500);
              },
              onReject: () => {
                console.warn('[WebPhone] ❌ Attended transfer rejected by server');
                // Resume original call
                this.unholdCall();
                inviter.bye();
              }
            }
          };
          
          // CRITICAL FIX: Pass the inviter session object (not URI) to refer() method
          // This matches Browser-Phone implementation pattern for attended transfer
          // The session object contains the Replaces header needed for attended transfer
          (session as any).refer(inviter, referOptions);
        } else if (state === SessionState.Terminated) {
          // Consultation leg failed before establishing - resume original call
          console.warn('[WebPhone] Transfer target failed/rejected, resuming original call');
          this.unholdCall();
        }
      });
      
    } catch (error) {
      console.error('[WebPhone] Error initiating attended transfer:', error);
      // Resume original call on error
      await this.unholdCall();
    }
  }
  
  // ============================================================================
  // RECORDING FUNCTIONS - Call Recording
  // ============================================================================
  
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  
  public startRecording(): void {
    const store = useWebPhoneStore.getState();
    const session = this.currentSession;
    
    if (!session || session.state !== SessionState.Established) {
      console.warn('[WebPhone] Cannot record - no active call');
      return;
    }
    
    const sdh = (session as any).sessionDescriptionHandler;
    if (!sdh || !sdh.peerConnection) {
      console.warn('[WebPhone] No peer connection available for recording');
      return;
    }
    
    console.log('[WebPhone] Starting call recording');
    
    const pc = sdh.peerConnection;
    const recordingStream = new MediaStream();
    
    // Add all audio tracks (both local and remote)
    pc.getSenders().forEach((sender: RTCRtpSender) => {
      if (sender.track && sender.track.kind === 'audio') {
        console.log('[WebPhone] Adding local audio track to recording');
        recordingStream.addTrack(sender.track);
      }
    });
    
    pc.getReceivers().forEach((receiver: RTCRtpReceiver) => {
      if (receiver.track && receiver.track.kind === 'audio') {
        console.log('[WebPhone] Adding remote audio track to recording');
        recordingStream.addTrack(receiver.track);
      }
    });
    
    if (recordingStream.getAudioTracks().length === 0) {
      console.error('[WebPhone] No audio tracks available for recording');
      return;
    }
    
    // Create MediaRecorder
    try {
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(recordingStream, {
        mimeType: 'audio/webm'
      });
      
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        console.log('[WebPhone] Recording stopped, saving file');
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `call-recording-${timestamp}.webm`;
        
        // Download the recording
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('[WebPhone] ✅ Recording saved:', filename);
        store.setIsRecording(false);
      };
      
      this.mediaRecorder.start();
      store.setIsRecording(true);
      console.log('[WebPhone] ✅ Recording started');
      
    } catch (error) {
      console.error('[WebPhone] Error starting recording:', error);
    }
  }
  
  public stopRecording(): void {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      console.warn('[WebPhone] No active recording to stop');
      return;
    }
    
    console.log('[WebPhone] Stopping call recording');
    this.mediaRecorder.stop();
  }
  
  // ============================================================================
  // DND & CALL WAITING - Feature Toggles
  // ============================================================================
  
  public toggleDoNotDisturb(): void {
    const store = useWebPhoneStore.getState();
    const newDndState = !store.doNotDisturb;
    
    store.setDoNotDisturb(newDndState);
    localStorage.setItem('webphone_dnd', newDndState ? '1' : '0');
    
    console.log('[WebPhone] Do Not Disturb:', newDndState ? 'ENABLED' : 'DISABLED');
  }
  
  public toggleCallWaiting(): void {
    const store = useWebPhoneStore.getState();
    const newState = !store.callWaitingEnabled;
    
    store.setCallWaitingEnabled(newState);
    localStorage.setItem('webphone_call_waiting', newState ? '1' : '0');
    
    console.log('[WebPhone] Call Waiting:', newState ? 'ENABLED' : 'DISABLED');
  }
  
  private shouldAcceptIncomingCall(): boolean {
    const store = useWebPhoneStore.getState();
    
    // Check DND
    if (store.doNotDisturb) {
      console.log('[WebPhone] Rejecting call - Do Not Disturb is enabled');
      return false;
    }
    
    // Check Call Waiting
    if (store.currentCall && !store.callWaitingEnabled) {
      console.log('[WebPhone] Rejecting call - Call Waiting is disabled and call is active');
      return false;
    }
    
    return true;
  }

  // BROWSER-PHONE PATTERN: Helper to attach SessionDescriptionHandler and setup audio
  private attachSessionDescriptionHandler(session: Session, includeVideo: boolean = false): void {
    console.log('[WebPhone] Attaching SessionDescriptionHandler delegate (Browser-Phone pattern)');
    
    // Browser-Phone pattern: Use delegate.onSessionDescriptionHandler
    session.delegate = {
      ...session.delegate,
      onSessionDescriptionHandler: (sdh: any, provisional: boolean) => {
        console.log('[WebPhone] onSessionDescriptionHandler fired, provisional:', provisional);
        
        if (sdh && sdh.peerConnection) {
          const pc = sdh.peerConnection as RTCPeerConnection;
          
          // Browser-Phone pattern: Attach ontrack directly to peerConnection
          pc.ontrack = (event: RTCTrackEvent) => {
            console.log('[WebPhone] 🎵 ontrack fired - setting up media streams');
            this.onTrackAddedEvent(session, includeVideo);
          };
          
          // ICE connection logging
          pc.oniceconnectionstatechange = () => {
            console.log('[WebPhone] ICE state:', pc.iceConnectionState);
          };
          
          console.log('[WebPhone] ✅ peerConnection.ontrack configured');
        } else {
          console.warn('[WebPhone] onSessionDescriptionHandler fired without peerConnection');
        }
      }
    };
  }

  // BROWSER-PHONE PATTERN: Handle track added event and setup media
  private onTrackAddedEvent(session: Session, includeVideo: boolean): void {
    console.log('[WebPhone] onTrackAddedEvent - rebuilding media streams from transceivers');
    
    const sdh = (session as any).sessionDescriptionHandler;
    if (!sdh || !sdh.peerConnection) {
      console.error('[WebPhone] No peerConnection available');
      return;
    }
    
    const pc = sdh.peerConnection as RTCPeerConnection;
    
    // Browser-Phone pattern: Create MediaStreams
    const remoteAudioStream = new MediaStream();
    const remoteVideoStream = new MediaStream();
    
    // Browser-Phone pattern: Use getTransceivers to collect tracks
    pc.getTransceivers().forEach((transceiver) => {
      const receiver = transceiver.receiver;
      if (receiver.track) {
        if (receiver.track.kind === 'audio') {
          console.log('[WebPhone] Adding remote audio track');
          remoteAudioStream.addTrack(receiver.track);
        }
        if (includeVideo && receiver.track.kind === 'video') {
          console.log('[WebPhone] Adding remote video track');
          remoteVideoStream.addTrack(receiver.track);
        }
      }
    });
    
    // Attach audio if we have tracks
    if (remoteAudioStream.getAudioTracks().length >= 1) {
      // Get fresh store state to avoid stale closure
      const currentStore = useWebPhoneStore.getState();
      const remoteAudio = currentStore.remoteAudioElement;
      
      if (!remoteAudio) {
        console.error('[WebPhone] ❌ Remote audio element not available');
        return;
      }
      
      console.log('[WebPhone] 🔊 Assigning remote audio stream');
      remoteAudio.srcObject = remoteAudioStream;
      
      // Browser-Phone pattern: Use onloadedmetadata to play
      remoteAudio.onloadedmetadata = () => {
        console.log('[WebPhone] Audio metadata loaded, playing...');
        remoteAudio.play()
          .then(() => console.log('[WebPhone] ✅ REMOTE AUDIO PLAYING'))
          .catch((error) => console.error('[WebPhone] Audio play error:', error));
      };
    } else {
      console.warn('[WebPhone] ⚠️ No audio tracks found in stream');
    }
  }
  
  private endCall() {
    const store = useWebPhoneStore.getState();
    const call = store.currentCall;
    
    console.log('[WebPhone] 🧹 Starting full call cleanup (teardown)');
    
    if (call) {
      // Determine final status based on current status and call direction
      let finalStatus: Call['status'] = 'ended';
      
      if (call.status === 'answered') {
        // Preserve answered status for completed calls
        finalStatus = 'answered';
      } else if (call.status === 'ringing') {
        // Only mark INBOUND ringing calls as missed
        // Outbound calls that ring but aren't answered should be 'ended', not 'missed'
        finalStatus = call.direction === 'inbound' ? 'missed' : 'ended';
      } else {
        // For any other status (missed, ended), preserve or default to ended
        finalStatus = call.status === 'missed' ? 'missed' : 'ended';
      }
      
      // Add to history
      const callLog: CallLog = {
        ...call,
        endTime: new Date(),
        duration: Math.floor((new Date().getTime() - call.startTime.getTime()) / 1000),
        status: finalStatus
      };
      store.addCallToHistory(callLog);
    }
    
    // CRITICAL: Clean up SIP session and media resources (Browser-Phone pattern)
    if (this.currentSession) {
      const session = this.currentSession;
      
      // Step 1: Stop all media tracks (microphone, speakers)
      try {
        const sdh = (session as any).sessionDescriptionHandler;
        if (sdh?.peerConnection) {
          const pc = sdh.peerConnection;
          
          // Stop all audio senders (microphone tracks)
          pc.getSenders().forEach((sender: RTCRtpSender) => {
            if (sender.track && sender.track.kind === 'audio') {
              console.log('[WebPhone] 🛑 Stopping sender track:', sender.track.id);
              sender.track.stop();
            }
          });
          
          // Stop all audio receivers (remote audio tracks)
          pc.getReceivers().forEach((receiver: RTCRtpReceiver) => {
            if (receiver.track && receiver.track.kind === 'audio') {
              console.log('[WebPhone] 🛑 Stopping receiver track:', receiver.track.id);
              receiver.track.stop();
            }
          });
          
          console.log('[WebPhone] ✅ All media tracks stopped');
        }
      } catch (error) {
        console.error('[WebPhone] ❌ Error stopping media tracks:', error);
      }
      
      // Step 2: Clear remote audio element
      if (store.remoteAudioElement) {
        store.remoteAudioElement.pause();
        store.remoteAudioElement.srcObject = null;
        console.log('[WebPhone] ✅ Remote audio element cleared');
      }
      
      // Step 3: Dispose of the session
      try {
        if ((session as any).dispose) {
          (session as any).dispose();
          console.log('[WebPhone] ✅ Session disposed');
        }
      } catch (error) {
        console.error('[WebPhone] ⚠️  Error disposing session:', error);
      }
    }
    
    // Step 4: Stop ringtones
    this.stopRingtone();
    this.stopRingbackTone();
    console.log('[WebPhone] ✅ Ringtones stopped');
    
    // Step 5: Clear session reference
    this.currentSession = undefined;
    
    // Step 6: Reset all call state
    store.setCurrentCall(undefined);
    store.setIncomingCallVisible(false);
    store.setMuted(false);
    store.setOnHold(false);
    
    console.log('[WebPhone] ✅ Call cleanup complete - ready for next call');
  }
  
  private startReconnectMonitor() {
    // Clear existing interval
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    
    // Monitor connection every 5 seconds
    this.reconnectInterval = setInterval(() => {
      const store = useWebPhoneStore.getState();
      
      if (!this.userAgent?.isConnected() && store.sipExtension && store.sipPassword) {
        console.log('[WebPhone] Connection lost, attempting reconnect...');
        this.initialize(store.sipExtension, store.sipPassword);
      }
    }, 5000);
  }
  
  public async disconnect(): Promise<void> {
    const store = useWebPhoneStore.getState();
    
    // Clear reconnect interval
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = undefined;
    }
    
    // Unregister if registered
    if (this.registerer) {
      try {
        await this.registerer.unregister();
      } catch (error) {
        console.error('[WebPhone] Failed to unregister:', error);
      }
    }
    
    // Stop user agent
    if (this.userAgent) {
      try {
        await this.userAgent.stop();
      } catch (error) {
        console.error('[WebPhone] Failed to stop user agent:', error);
      }
      this.userAgent = undefined;
    }
    
    store.setConnectionStatus('disconnected');
  }
  
  // ============================================================================
  // GETTERS - State access methods
  // ============================================================================
  
  public getDoNotDisturb(): boolean {
    return useWebPhoneStore.getState().doNotDisturb;
  }
  
  public getCallWaiting(): boolean {
    return useWebPhoneStore.getState().callWaitingEnabled;
  }
}

// Export singleton instance
export const webPhone = WebPhoneManager.getInstance();

// Persist WebPhone instance globally
if (typeof window !== 'undefined') {
  (window as any).webPhone = webPhone;
}