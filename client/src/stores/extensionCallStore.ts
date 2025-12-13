import { create } from 'zustand';

export interface OnlineExtension {
  extensionId: string;
  extension: string;
  displayName: string;
  status: "available" | "busy";
}

export interface IncomingExtCall {
  callId: string;
  callerExtension: string;
  callerDisplayName: string;
  sdpOffer: string;
}

export interface CurrentExtCall {
  callId: string;
  remoteExtension: string;
  remoteDisplayName: string;
  state: "calling" | "ringing" | "connected";
  startTime: Date;
  answerTime?: Date;
}

export interface QueueCall {
  queueCallId: string;
  callControlId: string;
  queueId: string;
  callerNumber: string;
}

interface ExtensionCallState {
  wsConnection: WebSocket | null;
  connectionStatus: "disconnected" | "connecting" | "connected";
  myExtension: string | null;
  myDisplayName: string;
  onlineExtensions: OnlineExtension[];
  currentExtCall: CurrentExtCall | null;
  incomingExtCall: IncomingExtCall | null;
  queueCall: QueueCall | null;
  isMuted: boolean;
  
  setWsConnection: (ws: WebSocket | null) => void;
  setConnectionStatus: (status: "disconnected" | "connecting" | "connected") => void;
  setMyExtension: (ext: string | null) => void;
  setMyDisplayName: (name: string) => void;
  setOnlineExtensions: (extensions: OnlineExtension[]) => void;
  setCurrentExtCall: (call: CurrentExtCall | null) => void;
  setIncomingExtCall: (call: IncomingExtCall | null) => void;
  setQueueCall: (call: QueueCall | null) => void;
  setIsMuted: (muted: boolean) => void;
  updateCallState: (state: "calling" | "ringing" | "connected") => void;
  reset: () => void;
}

const initialState = {
  wsConnection: null,
  connectionStatus: "disconnected" as const,
  myExtension: null,
  myDisplayName: "",
  onlineExtensions: [],
  currentExtCall: null,
  incomingExtCall: null,
  queueCall: null,
  isMuted: false,
};

export const useExtensionCallStore = create<ExtensionCallState>((set) => ({
  ...initialState,
  
  setWsConnection: (ws) => set({ wsConnection: ws }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setMyExtension: (ext) => set({ myExtension: ext }),
  setMyDisplayName: (name) => set({ myDisplayName: name }),
  setOnlineExtensions: (extensions) => set({ onlineExtensions: extensions }),
  setCurrentExtCall: (call) => set({ currentExtCall: call }),
  setIncomingExtCall: (call) => set({ incomingExtCall: call }),
  setQueueCall: (call) => set({ queueCall: call }),
  setIsMuted: (muted) => set({ isMuted: muted }),
  updateCallState: (state) => set((s) => {
    if (!s.currentExtCall) return s;
    return {
      currentExtCall: {
        ...s.currentExtCall,
        state,
        answerTime: state === "connected" ? new Date() : s.currentExtCall.answerTime,
      }
    };
  }),
  reset: () => set(initialState),
}));
