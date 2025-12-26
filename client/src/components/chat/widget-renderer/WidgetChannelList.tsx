import { Send, Phone, Mail, ChevronRight, MessageSquare } from "lucide-react";
import { SiWhatsapp, SiFacebook, SiInstagram, SiTelegram } from "react-icons/si";
import type { WidgetConfig } from "@shared/widget-config";
import { getIconColor } from "./theme-utils";

interface WidgetChannelListProps {
  config: WidgetConfig;
  onChannelClick?: (channel: string) => void;
  hideLiveChat?: boolean;
}

interface ChannelConfig {
  id: string;
  key: keyof WidgetConfig["channels"];
  getLabel: (config: WidgetConfig) => string;
  icon: React.ReactNode;
}

const channelConfigs: ChannelConfig[] = [
  {
    id: "liveChat",
    key: "liveChat",
    getLabel: () => "Send us a message",
    icon: <Send className="h-5 w-5" />,
  },
  {
    id: "email",
    key: "email",
    getLabel: (config) => config.emailSettings?.welcomeScreen?.channelName || "Email us",
    icon: <Mail className="h-5 w-5" />,
  },
  {
    id: "sms",
    key: "sms",
    getLabel: (config) => config.smsSettings?.welcomeScreen?.channelName || "Text us",
    icon: <Send className="h-5 w-5" />,
  },
  {
    id: "phone",
    key: "phone",
    getLabel: (config) => config.callSettings?.callUsScreen?.title || "Call us",
    icon: <Phone className="h-5 w-5" />,
  },
  {
    id: "whatsapp",
    key: "whatsapp",
    getLabel: (config) => config.whatsappSettings?.welcomeScreen?.channelName || "Chat on WhatsApp",
    icon: <SiWhatsapp className="h-5 w-5" />,
  },
  {
    id: "facebook",
    key: "messenger",
    getLabel: (config) => config.messengerSettings?.welcomeScreen?.channelName || "Messenger",
    icon: <SiFacebook className="h-5 w-5" />,
  },
  {
    id: "instagram",
    key: "instagram",
    getLabel: (config) => config.instagramSettings?.welcomeScreen?.channelName || "Instagram",
    icon: <SiInstagram className="h-5 w-5" />,
  },
  {
    id: "telegram",
    key: "telegram",
    getLabel: (config) => config.telegramSettings?.welcomeScreen?.channelName || "Chat on Telegram",
    icon: <SiTelegram className="h-5 w-5" />,
  },
];

export function WidgetChannelList({ config, onChannelClick, hideLiveChat = false }: WidgetChannelListProps) {
  const iconColor = getIconColor(config.theme);
  
  const orderedChannels = config.channelOrder
    .map((channelId) => {
      const channelConfig = channelConfigs.find((c) => c.id === channelId);
      if (!channelConfig) return null;
      if (!config.channels[channelConfig.key]) return null;
      return channelConfig;
    })
    .filter((c): c is ChannelConfig => c !== null);

  const liveChatChannel = orderedChannels.find((c) => c.id === "liveChat");
  const otherChannels = orderedChannels.filter((c) => c.id !== "liveChat");

  return (
    <div className="space-y-2" data-testid="widget-channel-list">
      {!hideLiveChat && liveChatChannel && (
        <button
          className="w-full flex items-center justify-between py-4 px-4 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          onClick={() => onChannelClick?.(liveChatChannel.id)}
          data-testid={`widget-channel-${liveChatChannel.id}`}
        >
          <span className="text-base font-medium text-slate-900">
            {liveChatChannel.getLabel(config)}
          </span>
          <Send className="h-5 w-5" style={{ color: iconColor }} />
        </button>
      )}

      {otherChannels.map((channel) => (
        <button
          key={channel.id}
          className="w-full flex items-center gap-3 py-2.5 px-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          onClick={() => onChannelClick?.(channel.id)}
          data-testid={`widget-channel-${channel.id}`}
        >
          <span 
            className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm"
            style={{ color: iconColor }}
          >
            <span className="[&>svg]:h-4 [&>svg]:w-4">{channel.icon}</span>
          </span>
          <span className="flex-1 text-left text-sm font-medium text-slate-900">
            {channel.getLabel(config)}
          </span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>
      ))}
    </div>
  );
}
