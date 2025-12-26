import { ChevronDown } from "lucide-react";
import type { WidgetConfig } from "@shared/widget-config";

interface WidgetHeaderProps {
  config: WidgetConfig;
  onClose?: () => void;
}

const defaultAvatars = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
];

export function WidgetHeader({ config, onClose }: WidgetHeaderProps) {
  return (
    <div
      className="flex items-center justify-between"
      data-testid="widget-header"
    >
      <div className="flex items-center">
        {config.branding.customLogo ? (
          <img
            src={config.branding.customLogo}
            alt="Logo"
            className="h-7 object-contain"
            data-testid="widget-logo"
          />
        ) : (
          <span className="font-semibold text-slate-900 text-lg" data-testid="widget-company-name">
            {config.branding.companyName || "Support"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {defaultAvatars.map((avatar, i) => (
            <div
              key={i}
              className="w-9 h-9 rounded-full border-2 border-white overflow-hidden shadow-sm"
              data-testid={`widget-avatar-${i + 1}`}
            >
              <img 
                src={avatar} 
                alt={`Team member ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
        <button
          className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
          onClick={onClose}
          data-testid="widget-close-button"
        >
          <ChevronDown className="h-5 w-5 text-slate-500" />
        </button>
      </div>
    </div>
  );
}
