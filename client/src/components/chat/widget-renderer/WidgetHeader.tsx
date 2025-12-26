import { X } from "lucide-react";
import type { WidgetConfig } from "@shared/widget-config";
import { getIconColor } from "./theme-utils";

interface WidgetHeaderProps {
  config: WidgetConfig;
  onClose?: () => void;
}

export function WidgetHeader({ config, onClose }: WidgetHeaderProps) {
  const iconColor = getIconColor(config.theme);
  
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
            className="h-6 object-contain"
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
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full border-2 border-slate-200 overflow-hidden"
              style={{ backgroundColor: iconColor }}
              data-testid={`widget-avatar-${i}`}
            >
              <div className="w-full h-full bg-gradient-to-br from-white/30 to-white/10" />
            </div>
          ))}
        </div>
        <button
          className="p-1 hover:bg-slate-200/50 rounded-full transition-colors"
          onClick={onClose}
          data-testid="widget-close-button"
        >
          <X className="h-5 w-5 text-slate-600" />
        </button>
      </div>
    </div>
  );
}
