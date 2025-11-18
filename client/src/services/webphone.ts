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
  callHistory: JSON.parse(localStorage.getItem('webphone_call_history') || '[]'),
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
  private ringtone?: HTMLAudioElement;
  
  private constructor() {
    // Private constructor for singleton
    this.initializeRingtone();
  }
  
  public static getInstance(): WebPhoneManager {
    if (!WebPhoneManager.instance) {
      WebPhoneManager.instance = new WebPhoneManager();
      // Store instance globally for persistence
      (window as any).__webphoneManager = WebPhoneManager.instance;
    }
    return WebPhoneManager.instance;
  }
  
  private initializeRingtone() {
    this.ringtone = new Audio('data:audio/wav;base64,UklGRrQEAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YZAEAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA');
    this.ringtone.loop = true;
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
      
      // Use local WebSocket proxy instead of direct PBX connection
      // This works in both Replit dev and production environments
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const sipProxyUrl = `${protocol}//${host}/ws/sip`;
      
      // Create SIP configuration  
      const uriString = `sip:${extension}@${store.sipDomain}`;
      const transportOptions = {
        server: sipProxyUrl, // Use local proxy instead of direct PBX connection
        connectionTimeout: 10,
        keepAliveInterval: 30,
        traceSip: true
      };
      
      console.log('[WebPhone] Initializing with config:', {
        uri: uriString,
        proxyServer: sipProxyUrl,
        username: extension
      });
      
      // Create User Agent with TURN/STUN servers for WebRTC NAT traversal
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
                urls: [
                  'stun:pbx.curbe.io:3478',
                  'turn:pbx.curbe.io:5349?transport=tcp',
                  'turns:pbx.curbe.io:5349?transport=tcp'
                ],
                username: 'webrtc',
                credential: 'Curbe2025!'
              }
            ]
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
    this.ringtone?.play();
    
    // Handle session state changes
    invitation.stateChange.addListener((state) => {
      switch (state) {
        case SessionState.Terminated:
          this.endCall();
          break;
        case SessionState.Established:
          store.setCallStatus('answered');
          this.ringtone?.pause();
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
        switch (state) {
          case SessionState.Established:
            store.setCallStatus('answered');
            this.setupMediaStreams(inviter);
            break;
          case SessionState.Terminated:
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
    
    this.ringtone?.pause();
    store.setIncomingCallVisible(false);
    
    try {
      // Request microphone permission before accepting
      console.log('[WebPhone] Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      console.log('[WebPhone] Microphone permission granted');
      
      // Setup media streams BEFORE accepting to catch early tracks
      this.setupMediaStreams(session);
      
      // Accept the call with media constraints
      await session.accept({
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          }
        }
      });
      
      this.currentSession = session;
      store.setCallStatus('answered');
      console.log('[WebPhone] Call answered successfully');
    } catch (error) {
      console.error('[WebPhone] Failed to answer call:', error);
      this.endCall();
    }
  }
  
  public async rejectCall(): Promise<void> {
    const store = useWebPhoneStore.getState();
    const session = store.currentCall?.session as Invitation;
    
    if (!session) return;
    
    this.ringtone?.pause();
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
  
  private setupMediaStreams(session: Session) {
    const store = useWebPhoneStore.getState();
    const sdh = (session as any)?.sessionDescriptionHandler;
    const pc: RTCPeerConnection | undefined = sdh?.peerConnection;
    
    if (!pc) {
      console.error('[WebPhone] No peer connection available');
      return;
    }
    
    console.log('[WebPhone] Setting up media streams...');
    
    // Handle remote tracks
    pc.ontrack = (event: RTCTrackEvent) => {
      console.log('[WebPhone] Received remote track:', event.track.kind);
      if (event.track.kind === 'audio' && store.remoteAudioElement) {
        const remoteStream = new MediaStream([event.track]);
        store.remoteAudioElement.srcObject = remoteStream;
        store.remoteAudioElement.play().then(() => {
          console.log('[WebPhone] ✅ Remote audio playing');
        }).catch((error) => {
          console.error('[WebPhone] ❌ Failed to play remote audio:', error);
        });
      }
    };
    
    // Log ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('[WebPhone] ICE connection state:', pc.iceConnectionState);
    };
    
    // Log connection state
    pc.onconnectionstatechange = () => {
      console.log('[WebPhone] Connection state:', pc.connectionState);
    };
    
    // Check if remote stream already exists (for incoming calls)
    const receivers = pc.getReceivers();
    if (receivers.length > 0 && store.remoteAudioElement) {
      const audioReceiver = receivers.find(r => r.track.kind === 'audio');
      if (audioReceiver && audioReceiver.track) {
        console.log('[WebPhone] Setting up existing remote audio track');
        const remoteStream = new MediaStream([audioReceiver.track]);
        store.remoteAudioElement.srcObject = remoteStream;
        store.remoteAudioElement.play().then(() => {
          console.log('[WebPhone] ✅ Remote audio playing (existing track)');
        }).catch((error) => {
          console.error('[WebPhone] ❌ Failed to play remote audio:', error);
        });
      }
    }
  }
  
  private endCall() {
    const store = useWebPhoneStore.getState();
    const call = store.currentCall;
    
    if (call) {
      // Add to history
      const callLog: CallLog = {
        ...call,
        endTime: new Date(),
        duration: Math.floor((new Date().getTime() - call.startTime.getTime()) / 1000),
        status: call.status === 'ringing' ? 'missed' : 'ended'
      };
      store.addCallToHistory(callLog);
    }
    
    // Clean up
    this.currentSession = undefined;
    this.ringtone?.pause();
    store.setCurrentCall(undefined);
    store.setIncomingCallVisible(false);
    store.setMuted(false);
    store.setOnHold(false);
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
}

// Export singleton instance
export const webPhone = WebPhoneManager.getInstance();

// Persist WebPhone instance globally
if (typeof window !== 'undefined') {
  (window as any).webPhone = webPhone;
}