import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { WidgetRenderer } from "@/components/chat/widget-renderer";
import { mapChatWidgetToConfig } from "@shared/widget-config";
import { MessageCircle, X } from "lucide-react";

export default function WidgetFramePage() {
  const { id: widgetId } = useParams<{ id: string }>();
  const [isOpen, setIsOpen] = useState(false);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/public/chat-widget', widgetId],
    queryFn: async () => {
      const res = await fetch(`/api/public/chat-widget/${widgetId}`);
      if (!res.ok) throw new Error('Failed to load widget');
      return res.json();
    },
    enabled: !!widgetId,
  });
  
  const parentOrigin = new URLSearchParams(window.location.search).get('origin') || '*';
  
  useEffect(() => {
    const messageType = isOpen ? 'curbe-widget-open' : 'curbe-widget-close';
    window.parent.postMessage({ type: messageType, widgetId }, parentOrigin);
  }, [isOpen, widgetId, parentOrigin]);
  
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'curbe-widget-toggle') {
        setIsOpen(prev => !prev);
      } else if (event.data?.type === 'curbe-widget-open-command') {
        setIsOpen(true);
      } else if (event.data?.type === 'curbe-widget-close-command') {
        setIsOpen(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  useEffect(() => {
    window.parent.postMessage({ type: 'curbe-widget-ready', widgetId }, parentOrigin);
  }, [widgetId, parentOrigin]);
  
  if (isLoading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  
  if (error || !data?.widget) {
    return null;
  }
  
  const widgetConfig = mapChatWidgetToConfig(data.widget);
  const primaryColor = data.widget.primaryColor || '#111';
  const buttonSize = data.widget.buttonSize || 56;
  
  if (!isOpen) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: buttonSize,
            height: buttonSize,
            borderRadius: '50%',
            backgroundColor: primaryColor,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          data-testid="widget-launcher-button"
        >
          <MessageCircle size={24} color="white" />
        </button>
      </div>
    );
  }
  
  return (
    <div style={{ width: '100%', height: '100%', background: 'white', borderRadius: '16px', overflow: 'hidden' }}>
      <WidgetRenderer
        config={widgetConfig}
        mode="embed"
        onClose={() => setIsOpen(false)}
        isOffline={!data.scheduleStatus?.isOnline}
        nextAvailable={data.scheduleStatus?.nextAvailable}
      />
    </div>
  );
}
