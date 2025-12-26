import curbeLogo from "@assets/logo no fondo_1760457183587.png";
import type { WidgetConfig } from "@shared/widget-config";

interface WidgetFooterProps {
  config: WidgetConfig;
}

export function WidgetFooter({ config }: WidgetFooterProps) {
  if (!config.branding.showBranding) {
    return null;
  }

  return (
    <div className="text-center pt-4" data-testid="widget-footer">
      <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
        Powered by{" "}
        <a href="https://curbe.io" target="_blank" rel="noopener noreferrer">
          <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
        </a>
      </p>
    </div>
  );
}
