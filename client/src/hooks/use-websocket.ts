/**
 * Custom WebSocket hook for real-time chat functionality.
 * 
 * NOTE: If you see `wss://localhost:undefined` errors in browser console,
 * these are from Vite HMR (Hot Module Replacement) client and do NOT affect
 * this chat WebSocket. This hook correctly derives ws(s)://{host}/ws/chat
 * from window.location.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  phoneNumber?: string;
  data?: any;
  companyId?: string;
  userId?: string;
}

export function useWebSocket(
  onMessage: (message: WebSocketMessage) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const shouldReconnectRef = useRef(true);
  const onMessageRef = useRef(onMessage);

  // Update the callback ref on every render without causing reconnection
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // Check if user is authenticated before attempting connection
  const { data: sessionData, isLoading: isLoadingSession } = useQuery<{ user: any }>({
    queryKey: ["/api/session"],
    retry: false,
  });

  const isAuthenticated = !!sessionData?.user;
  const shouldAttemptConnection = isAuthenticated && !isLoadingSession;

  const connect = useCallback(() => {
    if (!shouldReconnectRef.current || !shouldAttemptConnection) {
      return;
    }

    // Don't create a new connection if one already exists and is open/connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/chat`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WebSocket] Connected - server will authenticate using session');
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // Use the ref to call the latest callback without causing reconnection
          onMessageRef.current(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        wsRef.current = null;
        
        // Only reconnect if component is still mounted and user is authenticated
        if (!shouldReconnectRef.current || !shouldAttemptConnection) {
          return;
        }
        
        // Reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (shouldReconnectRef.current && shouldAttemptConnection) {
            console.log(`Reconnecting... (attempt ${reconnectAttempts.current})`);
            connect();
          }
        }, delay);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  }, [shouldAttemptConnection]); // Removed onMessage from dependencies - use ref instead

  useEffect(() => {
    shouldReconnectRef.current = true;
    
    // Only connect if authenticated and session is loaded
    if (shouldAttemptConnection) {
      connect();
    }

    return () => {
      // Mark as unmounted to prevent reconnection
      shouldReconnectRef.current = false;
      
      // Clear any pending reconnection timers
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, shouldAttemptConnection]);

  return wsRef.current;
}
