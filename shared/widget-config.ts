import type { ChatWidget } from "./schema";

export interface WidgetTheme {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: string;
  headerBackground: string;
  buttonColor: string;
}

export interface WidgetBranding {
  customLogo: string | null;
  companyName: string | null;
  showBranding: boolean;
}

export interface WidgetChannels {
  liveChat: boolean;
  sms: boolean;
  phone: boolean;
  whatsapp: boolean;
  email: boolean;
  telegram: boolean;
  messenger: boolean;
  instagram: boolean;
}

export interface WidgetMinimizedState {
  icon: "chat" | "message" | "phone" | "email";
  buttonText: string;
  borderRadius: number;
  alignTo: "left" | "right";
  sideSpacing: number;
  bottomSpacing: number;
  eyeCatcherEnabled: boolean;
  eyeCatcherMessage: string;
}

export interface LiveChatSettings {
  welcomeScreen?: {
    fieldLabel?: string;
    buttonLabel?: string;
  };
  preChatForm?: {
    title?: string;
    nameFieldEnabled?: boolean;
    nameFieldRequired?: boolean;
    emailFieldEnabled?: boolean;
    emailFieldRequired?: boolean;
    buttonLabel?: string;
  };
  queueSettings?: {
    autoReplyMessage?: string;
    closeAfterMinutes?: number;
    timeoutMessage?: string;
  };
  satisfactionSurvey?: {
    enabled?: boolean;
  };
  offlineMode?: {
    hideChannel?: boolean;
    offlineMessage?: string;
  };
}

export interface CallSettings {
  callUsScreen?: {
    showQRCode?: boolean;
    title?: string;
    description?: string;
    buttonLabel?: string;
  };
  numberSettings?: {
    numberType?: "connected" | "custom";
    selectedConnectedNumber?: string;
    customNumber?: string;
  };
  numbersAndCountries?: {
    entries?: Array<{
      country: string;
      phoneNumber: string;
    }>;
  };
}

export interface WhatsAppSettings {
  welcomeScreen?: {
    channelName?: string;
  };
  messageScreen?: {
    showQRCode?: boolean;
    title?: string;
    description?: string;
    buttonLabel?: string;
  };
  numberSettings?: {
    numberType?: "connected" | "custom";
    customNumber?: string;
  };
}

export interface EmailSettings {
  welcomeScreen?: {
    channelName?: string;
  };
  formFields?: {
    title?: string;
    description?: string;
    nameFieldEnabled?: boolean;
    nameFieldRequired?: boolean;
    emailFieldEnabled?: boolean;
    emailFieldRequired?: boolean;
    messageFieldEnabled?: boolean;
    messageFieldRequired?: boolean;
    buttonLabel?: string;
  };
  successScreen?: {
    title?: string;
    description?: string;
  };
  associatedEmail?: {
    emailType?: "connected" | "custom";
    customEmail?: string;
  };
}

export interface SmsSettings {
  welcomeScreen?: {
    channelName?: string;
  };
  messageScreen?: {
    title?: string;
    description?: string;
    buttonLabel?: string;
    showQRCode?: boolean;
  };
  numberSettings?: {
    numberType?: "connected" | "custom";
    customNumber?: string;
    connectedNumber?: string;
  };
}

export interface MessengerSettings {
  welcomeScreen?: {
    channelName?: string;
  };
  messageUsScreen?: {
    showQRCode?: boolean;
    title?: string;
    description?: string;
    buttonLabel?: string;
  };
  pageConnection?: {
    connectionType?: "connected" | "custom";
    pageId?: string;
    pageName?: string;
    customUrl?: string;
  };
}

export interface InstagramSettings {
  welcomeScreen?: {
    channelName?: string;
  };
  messageUsScreen?: {
    showQRCode?: boolean;
    title?: string;
    description?: string;
    buttonLabel?: string;
  };
  accountConnection?: {
    connectionType?: "connected" | "custom";
    username?: string;
    accountName?: string;
    customUrl?: string;
  };
}

export interface TelegramSettings {
  welcomeScreen?: {
    channelName?: string;
  };
  messageUsScreen?: {
    showQRCode?: boolean;
    title?: string;
    description?: string;
    buttonLabel?: string;
  };
  botConnection?: {
    connectionType?: "connected" | "custom";
    botUsername?: string;
    botName?: string;
    customUrl?: string;
  };
}

export interface TeamMember {
  name: string;
  avatarUrl: string | null;
}

export interface WidgetConfig {
  id: string;
  theme: WidgetTheme;
  branding: WidgetBranding;
  channels: WidgetChannels;
  minimizedState: WidgetMinimizedState;
  welcomeTitle: string;
  welcomeMessage: string;
  liveChatSettings?: LiveChatSettings;
  callSettings?: CallSettings;
  whatsappSettings?: WhatsAppSettings;
  emailSettings?: EmailSettings;
  smsSettings?: SmsSettings;
  messengerSettings?: MessengerSettings;
  instagramSettings?: InstagramSettings;
  telegramSettings?: TelegramSettings;
  channelOrder: string[];
  teamMembers?: TeamMember[];
}

const colorOptions: Record<string, { hex: string; gradientHex: string }> = {
  blue: { hex: "#3B82F6", gradientHex: "linear-gradient(135deg, #60A5FA 0%, #2563EB 50%, #4338CA 100%)" },
  orange: { hex: "#F97316", gradientHex: "linear-gradient(135deg, #FACC15 0%, #F97316 50%, #DC2626 100%)" },
  green: { hex: "#22C55E", gradientHex: "linear-gradient(135deg, #34D399 0%, #22C55E 50%, #0D9488 100%)" },
  red: { hex: "#EF4444", gradientHex: "linear-gradient(135deg, #FB7185 0%, #EF4444 50%, #DB2777 100%)" },
  teal: { hex: "#14B8A6", gradientHex: "linear-gradient(135deg, #22D3EE 0%, #14B8A6 50%, #059669 100%)" },
  indigo: { hex: "#6366F1", gradientHex: "linear-gradient(135deg, #A78BFA 0%, #6366F1 50%, #7C3AED 100%)" },
  pink: { hex: "#EC4899", gradientHex: "linear-gradient(135deg, #E879F9 0%, #EC4899 50%, #E11D48 100%)" },
  rose: { hex: "#FB7185", gradientHex: "linear-gradient(135deg, #F9A8D4 0%, #FB7185 50%, #EF4444 100%)" },
};

function getBackgroundColor(widget: ChatWidget): string {
  const themeType = widget.themeType || "gradient";
  const colorTheme = widget.colorTheme || "blue";
  const customColor = widget.customColor;

  if (themeType === "custom" && customColor) {
    return customColor;
  }

  const colorOption = colorOptions[colorTheme] || colorOptions.blue;
  return themeType === "gradient" ? colorOption.gradientHex : colorOption.hex;
}

function getPrimaryColor(widget: ChatWidget): string {
  const colorTheme = widget.colorTheme || "blue";
  const customColor = widget.customColor;
  const themeType = widget.themeType || "gradient";

  if (themeType === "custom" && customColor) {
    return customColor;
  }

  const colorOption = colorOptions[colorTheme] || colorOptions.blue;
  return colorOption.hex;
}

export function mapChatWidgetToConfig(widget: ChatWidget): WidgetConfig {
  const primaryColor = getPrimaryColor(widget);
  const headerBackground = getBackgroundColor(widget);

  // Handle both array format [{ type: "liveChat", enabled: true }] and object format { liveChat: true }
  const rawChannels = widget.channels;
  let channelsConfig: WidgetChannels;
  
  if (Array.isArray(rawChannels)) {
    // Array format: [{ type: "liveChat", enabled: true }, ...]
    const channels = rawChannels as Array<{ type: string; enabled: boolean }>;
    channelsConfig = {
      liveChat: channels.find(c => c.type === "liveChat")?.enabled ?? false,
      sms: channels.find(c => c.type === "sms")?.enabled ?? false,
      phone: channels.find(c => c.type === "phone")?.enabled ?? false,
      whatsapp: channels.find(c => c.type === "whatsapp")?.enabled ?? false,
      email: channels.find(c => c.type === "email")?.enabled ?? false,
      telegram: channels.find(c => c.type === "telegram")?.enabled ?? false,
      messenger: channels.find(c => c.type === "facebook")?.enabled ?? false,
      instagram: channels.find(c => c.type === "instagram")?.enabled ?? false,
    };
  } else if (rawChannels && typeof rawChannels === 'object') {
    // Object format: { liveChat: true, email: false, ... }
    const channels = rawChannels as Record<string, boolean>;
    channelsConfig = {
      liveChat: channels.liveChat ?? false,
      sms: channels.sms ?? false,
      phone: channels.phone ?? false,
      whatsapp: channels.whatsapp ?? false,
      email: channels.email ?? false,
      telegram: channels.telegram ?? false,
      messenger: channels.facebook ?? false,
      instagram: channels.instagram ?? false,
    };
  } else {
    // Default: all disabled
    channelsConfig = {
      liveChat: false,
      sms: false,
      phone: false,
      whatsapp: false,
      email: false,
      telegram: false,
      messenger: false,
      instagram: false,
    };
  }

  const minimizedStateData = widget.minimizedState as {
    icon?: string;
    buttonText?: string;
    borderRadius?: number;
    alignTo?: string;
    sideSpacing?: number;
    bottomSpacing?: number;
    eyeCatcherEnabled?: boolean;
    eyeCatcherMessage?: string;
  } | null;

  const minimizedState: WidgetMinimizedState = {
    icon: (minimizedStateData?.icon as "chat" | "message" | "phone" | "email") || "chat",
    buttonText: minimizedStateData?.buttonText || "Chat with us",
    borderRadius: minimizedStateData?.borderRadius ?? 50,
    alignTo: (minimizedStateData?.alignTo as "left" | "right") || "right",
    sideSpacing: minimizedStateData?.sideSpacing ?? 20,
    bottomSpacing: minimizedStateData?.bottomSpacing ?? 20,
    eyeCatcherEnabled: minimizedStateData?.eyeCatcherEnabled ?? false,
    eyeCatcherMessage: minimizedStateData?.eyeCatcherMessage || "Hi! How can we help?",
  };

  const brandingData = widget.branding as {
    customLogo?: string | null;
    logoFileName?: string | null;
    logoFileSize?: string | null;
  } | null;

  const branding: WidgetBranding = {
    customLogo: brandingData?.customLogo ?? null,
    companyName: widget.companyName ?? null,
    showBranding: widget.showBranding ?? true,
  };

  const theme: WidgetTheme = {
    primaryColor,
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
    borderRadius: widget.borderRadius || "rounded",
    headerBackground,
    buttonColor: primaryColor,
  };

  return {
    id: widget.id,
    theme,
    branding,
    channels: channelsConfig,
    minimizedState,
    welcomeTitle: widget.welcomeTitle || "Hi there 👋",
    welcomeMessage: widget.welcomeMessage || "How can we help?",
    liveChatSettings: widget.liveChatSettings as LiveChatSettings | undefined,
    callSettings: widget.callSettings as CallSettings | undefined,
    whatsappSettings: widget.whatsappSettings as WhatsAppSettings | undefined,
    emailSettings: widget.emailSettings as EmailSettings | undefined,
    smsSettings: widget.smsSettings as SmsSettings | undefined,
    messengerSettings: widget.messengerSettings as MessengerSettings | undefined,
    instagramSettings: widget.instagramSettings as InstagramSettings | undefined,
    telegramSettings: widget.telegramSettings as TelegramSettings | undefined,
    channelOrder: widget.channelOrder || ["liveChat", "email", "sms", "phone", "whatsapp", "facebook", "instagram", "telegram"],
  };
}
