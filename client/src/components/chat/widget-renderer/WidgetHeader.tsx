import { ChevronDown, User } from "lucide-react";
import type { WidgetConfig } from "@shared/widget-config";

interface WidgetHeaderProps {
  config: WidgetConfig;
  onClose?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function WidgetHeader({ config, onClose }: WidgetHeaderProps) {
  const teamMembers = config.teamMembers || [];
  const hasTeamMembers = teamMembers.length > 0;

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
          {hasTeamMembers ? (
            teamMembers.slice(0, 3).map((member, i) => (
              <div
                key={i}
                className="w-9 h-9 rounded-full border-2 border-white overflow-hidden shadow-sm flex items-center justify-center bg-slate-200"
                data-testid={`widget-avatar-${i + 1}`}
                title={member.name}
              >
                {member.avatarUrl ? (
                  <img 
                    src={member.avatarUrl} 
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-medium text-slate-600">
                    {getInitials(member.name)}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div
              className="w-9 h-9 rounded-full border-2 border-white overflow-hidden shadow-sm flex items-center justify-center bg-slate-200"
              data-testid="widget-avatar-default"
            >
              <User className="w-5 h-5 text-slate-500" />
            </div>
          )}
        </div>
        <button
          className="p-1.5 hover:bg-slate-100 rounded-full transition-colors z-10"
          onClick={onClose}
          data-testid="widget-close-button"
        >
          <ChevronDown className="h-6 w-6 text-slate-500" />
        </button>
      </div>
    </div>
  );
}
