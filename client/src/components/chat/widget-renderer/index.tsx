import { useRef, useEffect } from "react";
import type { WidgetConfig } from "@shared/widget-config";
import { WidgetHeader } from "./WidgetHeader";
import { WidgetChannelList } from "./WidgetChannelList";
import { WidgetFooter } from "./WidgetFooter";
import { applyWidgetTheme } from "./theme-utils";

interface WidgetRendererProps {
  config: WidgetConfig;
  mode: "preview" | "embed";
  onClose?: () => void;
  onChannelClick?: (channel: string) => void;
}

export function WidgetRenderer({ config, mode, onClose, onChannelClick }: WidgetRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyWidgetTheme(containerRef.current, config.theme);
  }, [config.theme]);

  return (
    <div
      ref={containerRef}
      className="rounded-2xl overflow-hidden shadow-lg bg-white dark:bg-slate-900"
      data-testid="widget-renderer"
      data-mode={mode}
    >
      <WidgetHeader config={config} onClose={onClose} />

      <div className="p-5">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
            {config.welcomeTitle}
          </h3>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
            {config.welcomeMessage}
          </h3>
        </div>

        <WidgetChannelList config={config} onChannelClick={onChannelClick} />

        <WidgetFooter config={config} />
      </div>
    </div>
  );
}

export { WidgetHeader } from "./WidgetHeader";
export { WidgetChannelList } from "./WidgetChannelList";
export { WidgetFooter } from "./WidgetFooter";
export { applyWidgetTheme, getHeaderStyle, getIconColor } from "./theme-utils";
