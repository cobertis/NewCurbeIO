import { X } from "lucide-react";
import type { WidgetConfig } from "@shared/widget-config";
import { getHeaderStyle } from "./theme-utils";

interface WidgetHeaderProps {
  config: WidgetConfig;
  onClose?: () => void;
}

export function WidgetHeader({ config, onClose }: WidgetHeaderProps) {
  const headerStyle = getHeaderStyle(config.theme);

  return (
    <div
      className="px-4 py-3 flex items-center justify-between rounded-xl"
      style={headerStyle}
      data-testid="widget-header"
    >
      <div className="flex items-center">
        {config.branding.customLogo ? (
          <img
            src={config.branding.customLogo}
            alt="Logo"
            className="h-6 object-contain brightness-0 invert"
            data-testid="widget-logo"
          />
        ) : (
          <span className="font-semibold text-white text-lg" data-testid="widget-company-name">
            {config.branding.companyName || "Support"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full bg-white/30 border-2 border-white overflow-hidden"
              data-testid={`widget-avatar-${i}`}
            >
              <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-400" />
            </div>
          ))}
        </div>
        <button
          className="p-1 hover:bg-white/20 rounded-full transition-colors"
          onClick={onClose}
          data-testid="widget-close-button"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </div>
    </div>
  );
}
