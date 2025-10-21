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
          onMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        
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
  }, [onMessage, shouldAttemptConnection]);

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
      }
    };
  }, [connect, shouldAttemptConnection]);

  return wsRef.current;
}
