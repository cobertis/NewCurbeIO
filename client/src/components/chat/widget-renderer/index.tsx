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
      className="rounded-2xl overflow-hidden shadow-lg p-5"
      style={{ backgroundColor: "#edf1ff" }}
      data-testid="widget-renderer"
      data-mode={mode}
    >
      <WidgetHeader config={config} onClose={onClose} />

      <div className="mt-20 mb-6">
        <h3 className="font-bold text-slate-900 leading-tight" style={{ fontSize: "26px" }}>
          {config.welcomeTitle}
        </h3>
      </div>

      <WidgetChannelList config={config} onChannelClick={onChannelClick} />

      <WidgetFooter config={config} />
    </div>
  );
}

export { WidgetHeader } from "./WidgetHeader";
export { WidgetChannelList } from "./WidgetChannelList";
export { WidgetFooter } from "./WidgetFooter";
export { applyWidgetTheme, getHeaderStyle, getIconColor } from "./theme-utils";
