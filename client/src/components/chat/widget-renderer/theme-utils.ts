import type { WidgetTheme } from "@shared/widget-config";

export function applyWidgetTheme(containerRef: HTMLDivElement | null, theme: WidgetTheme): void {
  if (!containerRef) return;

  containerRef.style.setProperty("--widget-primary-color", theme.primaryColor);
  containerRef.style.setProperty("--widget-background-color", theme.backgroundColor);
  containerRef.style.setProperty("--widget-text-color", theme.textColor);
  containerRef.style.setProperty("--widget-border-radius", theme.borderRadius);
  containerRef.style.setProperty("--widget-header-background", theme.headerBackground);
  containerRef.style.setProperty("--widget-button-color", theme.buttonColor);
}

export function getHeaderStyle(theme: WidgetTheme): React.CSSProperties {
  return {
    background: theme.headerBackground,
  };
}

export function getIconColor(theme: WidgetTheme): string {
  return theme.primaryColor;
}
