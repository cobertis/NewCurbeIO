import { createRoot } from "react-dom/client";
import { WidgetEmbedRoot } from "./WidgetEmbedRoot";
import "../index.css";

declare global {
  interface Window {
    __CURBE_WIDGET_ID?: string;
  }
}

const widgetId = window.__CURBE_WIDGET_ID;

if (!widgetId) {
  console.error("[CurbeWidget] No widget ID provided");
} else {
  const root = document.getElementById("curbe-widget-root");
  if (root) {
    createRoot(root).render(<WidgetEmbedRoot widgetId={widgetId} />);
    console.log("[CurbeWidget] Mounted with ID:", widgetId);
  } else {
    console.error("[CurbeWidget] Root element not found");
  }
}
