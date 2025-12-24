import { useState, useRef, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link, useParams } from "wouter";
import curbeLogo from "@assets/logo no fondo_1760457183587.png";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Palette, MessageSquare, MessageCircle, Target, Code, Copy, ExternalLink, Mail, MoreHorizontal, MoreVertical, Trash2, Check, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Phone, Send, Upload, Image, Smile, Monitor, RefreshCw, GripVertical, Clock, ThumbsUp, ThumbsDown, Power, Settings, FileText, Users, Globe, Link2, X, CheckCircle, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SiFacebook, SiInstagram } from "react-icons/si";
import { SiWhatsapp } from "react-icons/si";
import { SettingsLayout } from "@/components/settings-layout";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";

function QRCodeDisplay({ value, size = 128 }: { value: string; size?: number }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (value) {
      QRCode.toDataURL(value, {
        width: size,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url: string) => setQrDataUrl(url))
        .catch((err: Error) => console.error('QR Code generation error:', err));
    }
  }, [value, size]);

  if (!qrDataUrl) {
    return (
      <div 
        className="bg-slate-100 rounded flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-slate-400">Loading...</span>
      </div>
    );
  }

  return (
    <img 
      src={qrDataUrl} 
      alt="QR Code" 
      width={size} 
      height={size}
      className="rounded"
    />
  );
}

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  
  if (digits.length <= 1) {
    return '+' + digits;
  }
  
  const countryCode = digits.slice(0, 1);
  const remaining = digits.slice(1);
  
  if (remaining.length === 0) {
    return '+' + countryCode;
  } else if (remaining.length <= 3) {
    return '+' + countryCode + ' (' + remaining;
  } else if (remaining.length <= 6) {
    return '+' + countryCode + ' (' + remaining.slice(0, 3) + ') ' + remaining.slice(3);
  } else {
    return '+' + countryCode + ' (' + remaining.slice(0, 3) + ') ' + remaining.slice(3, 6) + '-' + remaining.slice(6, 10);
  }
}

interface WidgetConfig {
  id: string;
  name: string;
  colorTheme: string;
  themeType: "gradient" | "solid" | "custom";
  customColor: string;
  welcomeTitle: string;
  welcomeMessage: string;
  branding: {
    customLogo: string | null;
    logoFileName: string | null;
    logoFileSize: string | null;
  };
  minimizedState: {
    includeButtonText: boolean;
    icon: "chat" | "message" | "phone" | "email";
    buttonText: string;
    borderRadius: number;
    alignTo: "left" | "right";
    sideSpacing: number;
    bottomSpacing: number;
    eyeCatcherEnabled: boolean;
    eyeCatcherMessage: string;
    messageDelay: number;
  };
  channels: {
    liveChat: boolean;
    email: boolean;
    sms: boolean;
    phone: boolean;
    whatsapp: boolean;
    facebook: boolean;
    instagram: boolean;
  };
  channelOrder: string[];
  liveChatSettings: {
    welcomeScreen: {
      fieldLabel: string;
      buttonLabel: string;
    };
    preChatForm: {
      title: string;
      nameFieldEnabled: boolean;
      nameFieldRequired: boolean;
      emailFieldEnabled: boolean;
      emailFieldRequired: boolean;
      buttonLabel: string;
    };
    queueSettings: {
      autoReplyMessage: string;
      closeAfterMinutes: number;
      timeoutMessage: string;
    };
    satisfactionSurvey: {
      enabled: boolean;
    };
    offlineMode: {
      hideChannel: boolean;
      offlineMessage: string;
    };
    additionalSettings: {
      addContactsToList: string;
    };
  };
  callSettings: {
    callUsScreen: {
      showQRCode: boolean;
      title: string;
      description: string;
      buttonLabel: string;
    };
    numberSettings: {
      numberType: "connected" | "custom";
      selectedConnectedNumber: string;
      customNumber: string;
    };
    numbersAndCountries: {
      entries: Array<{
        country: string;
        phoneNumber: string;
      }>;
    };
  };
  whatsappSettings: {
    welcomeScreen: {
      channelName: string;
    };
    messageScreen: {
      showQRCode: boolean;
      title: string;
      description: string;
      buttonLabel: string;
    };
    numberSettings: {
      numberType: "connected" | "custom";
      customNumber: string;
    };
  };
  emailSettings: {
    welcomeScreen: {
      channelName: string;
    };
    formFields: {
      title: string;
      description: string;
      nameFieldEnabled: boolean;
      nameFieldRequired: boolean;
      emailFieldEnabled: boolean;
      emailFieldRequired: boolean;
      messageFieldEnabled: boolean;
      messageFieldRequired: boolean;
      buttonLabel: string;
    };
    successScreen: {
      title: string;
      description: string;
    };
    associatedEmail: {
      emailType: "connected" | "custom";
      customEmail: string;
    };
  };
  smsSettings: {
    welcomeScreen: {
      channelName: string;
    };
    messageScreen: {
      title: string;
      description: string;
      buttonLabel: string;
    };
    numberSettings: {
      numberType: "connected" | "custom";
      customNumber: string;
    };
  };
  messengerSettings: {
    welcomeScreen: {
      channelName: string;
    };
    pageSettings: {
      title: string;
      description: string;
      buttonLabel: string;
    };
    pageConnection: {
      pageId: string;
      pageName: string;
    };
  };
  instagramSettings: {
    welcomeScreen: {
      channelName: string;
    };
    profileSettings: {
      title: string;
      description: string;
      buttonLabel: string;
    };
    accountConnection: {
      username: string;
      accountName: string;
    };
  };
  targeting: {
    countries: "all" | "selected" | "excluded";
    selectedCountries: string[];
    schedule: "always" | "custom";
    timezone: string;
    scheduleEntries: {
      day: string;
      enabled: boolean;
      startTime: string;
      endTime: string;
    }[];
    pageUrls: "all" | "show-specific" | "hide-specific";
    urlRules: {
      condition: "contains" | "equals" | "starts" | "ends";
      value: string;
    }[];
    deviceType: "all" | "desktop" | "mobile";
  };
}

const colorOptions = [
  { value: "blue", bg: "bg-blue-500", gradientBg: "bg-gradient-to-br from-blue-400 via-blue-600 to-indigo-700", hex: "#3B82F6", gradientHex: "linear-gradient(135deg, #60A5FA 0%, #2563EB 50%, #4338CA 100%)" },
  { value: "orange", bg: "bg-orange-500", gradientBg: "bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600", hex: "#F97316", gradientHex: "linear-gradient(135deg, #FACC15 0%, #F97316 50%, #DC2626 100%)" },
  { value: "green", bg: "bg-green-500", gradientBg: "bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600", hex: "#22C55E", gradientHex: "linear-gradient(135deg, #34D399 0%, #22C55E 50%, #0D9488 100%)" },
  { value: "red", bg: "bg-red-500", gradientBg: "bg-gradient-to-br from-rose-400 via-red-500 to-pink-600", hex: "#EF4444", gradientHex: "linear-gradient(135deg, #FB7185 0%, #EF4444 50%, #DB2777 100%)" },
  { value: "teal", bg: "bg-teal-500", gradientBg: "bg-gradient-to-br from-cyan-400 via-teal-500 to-emerald-600", hex: "#14B8A6", gradientHex: "linear-gradient(135deg, #22D3EE 0%, #14B8A6 50%, #059669 100%)" },
  { value: "indigo", bg: "bg-indigo-500", gradientBg: "bg-gradient-to-br from-violet-400 via-indigo-500 to-purple-700", hex: "#6366F1", gradientHex: "linear-gradient(135deg, #A78BFA 0%, #6366F1 50%, #7C3AED 100%)" },
  { value: "pink", bg: "bg-pink-500", gradientBg: "bg-gradient-to-br from-fuchsia-400 via-pink-500 to-rose-600", hex: "#EC4899", gradientHex: "linear-gradient(135deg, #E879F9 0%, #EC4899 50%, #E11D48 100%)" },
  { value: "rose", bg: "bg-rose-400", gradientBg: "bg-gradient-to-br from-pink-300 via-rose-400 to-red-500", hex: "#FB7185", gradientHex: "linear-gradient(135deg, #F9A8D4 0%, #FB7185 50%, #EF4444 100%)" },
];

const iconOptions = [
  { value: "chat", label: "Chat", icon: "chat" },
  { value: "message", label: "Message", icon: "message" },
  { value: "phone", label: "Phone", icon: "phone" },
  { value: "email", label: "Email", icon: "email" },
];

interface ChannelConfig {
  id: string;
  key: keyof WidgetConfig["channels"];
  label: string;
  icon: React.ReactNode;
  iconColor: string;
}

const channelConfigs: ChannelConfig[] = [
  { id: "liveChat", key: "liveChat", label: "Live chat", icon: <MessageSquare className="h-5 w-5" />, iconColor: "text-blue-500" },
  { id: "email", key: "email", label: "Email", icon: <Mail className="h-5 w-5" />, iconColor: "text-orange-500" },
  { id: "sms", key: "sms", label: "Text message", icon: <Send className="h-5 w-5" />, iconColor: "text-green-500" },
  { id: "phone", key: "phone", label: "Call", icon: <Phone className="h-5 w-5" />, iconColor: "text-blue-600" },
  { id: "whatsapp", key: "whatsapp", label: "WhatsApp", icon: <SiWhatsapp className="h-5 w-5" />, iconColor: "text-[#25D366]" },
  { id: "facebook", key: "facebook", label: "Facebook", icon: <SiFacebook className="h-5 w-5" />, iconColor: "text-[#1877F2]" },
  { id: "instagram", key: "instagram", label: "Instagram", icon: <SiInstagram className="h-5 w-5" />, iconColor: "text-[#E4405F]" },
];

interface SortableChannelItemProps {
  channel: ChannelConfig;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  isExpanded: boolean;
  onExpandToggle: () => void;
  liveChatSettings?: WidgetConfig["liveChatSettings"];
  onLiveChatSettingsChange?: (settings: Partial<WidgetConfig["liveChatSettings"]>) => void;
  callSettings?: WidgetConfig["callSettings"];
  onCallSettingsChange?: (settings: Partial<WidgetConfig["callSettings"]>) => void;
  whatsappSettings?: WidgetConfig["whatsappSettings"];
  onWhatsappSettingsChange?: (settings: Partial<WidgetConfig["whatsappSettings"]>) => void;
  emailSettings?: WidgetConfig["emailSettings"];
  onEmailSettingsChange?: (settings: Partial<WidgetConfig["emailSettings"]>) => void;
  smsSettings?: WidgetConfig["smsSettings"];
  onSmsSettingsChange?: (settings: Partial<WidgetConfig["smsSettings"]>) => void;
  companyNumbers?: Array<{ phoneNumber: string; friendlyName?: string; displayName?: string }>;
  messengerSettings?: WidgetConfig["messengerSettings"];
  onMessengerSettingsChange?: (settings: Partial<WidgetConfig["messengerSettings"]>) => void;
  instagramSettings?: WidgetConfig["instagramSettings"];
  onInstagramSettingsChange?: (settings: Partial<WidgetConfig["instagramSettings"]>) => void;
  activeLiveChatSubSection?: LiveChatSubSection;
  onActiveLiveChatSubSectionChange?: (subSection: LiveChatSubSection) => void;
  activeEmailSubSection?: EmailSubSection;
  onActiveEmailSubSectionChange?: (subSection: EmailSubSection) => void;
  activeSmsSubSection?: SmsSubSection;
  onActiveSmsSubSectionChange?: (subSection: SmsSubSection) => void;
}

type LiveChatSubSection = "welcomeScreen" | "preChatForm" | "queueSettings" | "satisfactionSurvey" | "offlineMode" | "additionalSettings" | null;
type CallSubSection = "callUsScreen" | "numberSettings" | "numbersAndCountries" | null;
type WhatsappSubSection = "welcomeScreen" | "messageScreen" | "numberSettings" | null;
type EmailSubSection = "welcomeScreen" | "formFields" | "successScreen" | "associatedEmail" | null;
type SmsSubSection = "welcomeScreen" | "messageScreen" | "numberSettings" | null;
type MessengerSubSection = "welcomeScreen" | "pageSettings" | "pageConnection" | null;
type InstagramSubSection = "welcomeScreen" | "profileSettings" | "accountConnection" | null;

function SortableChannelItem({ 
  channel, 
  enabled, 
  onToggle, 
  isExpanded, 
  onExpandToggle,
  liveChatSettings,
  onLiveChatSettingsChange,
  callSettings,
  onCallSettingsChange,
  whatsappSettings,
  onWhatsappSettingsChange,
  emailSettings,
  onEmailSettingsChange,
  smsSettings,
  onSmsSettingsChange,
  companyNumbers = [],
  messengerSettings,
  onMessengerSettingsChange,
  instagramSettings,
  onInstagramSettingsChange,
  activeLiveChatSubSection,
  onActiveLiveChatSubSectionChange,
  activeEmailSubSection: activeEmailSubSectionProp,
  onActiveEmailSubSectionChange,
  activeSmsSubSection: activeSmsSubSectionProp,
  onActiveSmsSubSectionChange
}: SortableChannelItemProps) {
  const activeSubSection = activeLiveChatSubSection ?? null;
  const setActiveSubSection = (subSection: LiveChatSubSection) => {
    onActiveLiveChatSubSectionChange?.(subSection);
  };
  const activeEmailSubSection = activeEmailSubSectionProp ?? null;
  const setActiveEmailSubSection = (subSection: EmailSubSection) => {
    onActiveEmailSubSectionChange?.(subSection);
  };
  const activeSmsSubSection = activeSmsSubSectionProp ?? null;
  const setActiveSmsSubSection = (subSection: SmsSubSection) => {
    onActiveSmsSubSectionChange?.(subSection);
  };
  const [activeCallSubSection, setActiveCallSubSection] = useState<CallSubSection>(null);
  const [activeWhatsappSubSection, setActiveWhatsappSubSection] = useState<WhatsappSubSection>(null);
  const [activeMessengerSubSection, setActiveMessengerSubSection] = useState<MessengerSubSection>(null);
  const [activeInstagramSubSection, setActiveInstagramSubSection] = useState<InstagramSubSection>(null);

  useEffect(() => {
    if (!isExpanded) {
      onActiveLiveChatSubSectionChange?.(null);
      onActiveEmailSubSectionChange?.(null);
      onActiveSmsSubSectionChange?.(null);
      setActiveCallSubSection(null);
      setActiveWhatsappSubSection(null);
      setActiveMessengerSubSection(null);
      setActiveInstagramSubSection(null);
    }
  }, [isExpanded, onActiveLiveChatSubSectionChange, onActiveEmailSubSectionChange, onActiveSmsSubSectionChange]);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: channel.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const liveChatSubOptions = [
    { id: "welcomeScreen", label: "Welcome screen", icon: <Monitor className="h-4 w-4" /> },
    { id: "preChatForm", label: "Pre-chat form", icon: <FileText className="h-4 w-4" /> },
    { id: "queueSettings", label: "Queue settings", icon: <Clock className="h-4 w-4" /> },
    { id: "satisfactionSurvey", label: "Satisfaction survey", icon: <ThumbsUp className="h-4 w-4" /> },
    { id: "offlineMode", label: "Offline mode", icon: <Power className="h-4 w-4" /> },
    { id: "additionalSettings", label: "Additional settings", icon: <Settings className="h-4 w-4" /> },
  ];

  const callSubOptions = [
    { id: "callUsScreen", label: "Call us screen", icon: <Phone className="h-4 w-4" /> },
    { id: "numberSettings", label: "Phone number", icon: <Phone className="h-4 w-4" /> },
    { id: "numbersAndCountries", label: "Numbers and countries", icon: <Users className="h-4 w-4" /> },
  ];

  const whatsappSubOptions = [
    { id: "welcomeScreen", label: "Welcome screen", icon: <Monitor className="h-4 w-4" /> },
    { id: "messageScreen", label: "Message us on WhatsApp", icon: <MessageSquare className="h-4 w-4" /> },
    { id: "numberSettings", label: "WhatsApp number", icon: <Phone className="h-4 w-4" /> },
  ];

  const emailSubOptions = [
    { id: "welcomeScreen", label: "Welcome screen", icon: <Monitor className="h-4 w-4" /> },
    { id: "formFields", label: "Form fields", icon: <FileText className="h-4 w-4" /> },
    { id: "successScreen", label: "Success screen", icon: <CheckCircle className="h-4 w-4" /> },
    { id: "associatedEmail", label: "Associated email", icon: <Mail className="h-4 w-4" /> },
  ];

  const smsSubOptions = [
    { id: "welcomeScreen", label: "Welcome screen", icon: <Monitor className="h-4 w-4" /> },
    { id: "messageScreen", label: "Message screen", icon: <MessageSquare className="h-4 w-4" /> },
    { id: "numberSettings", label: "SMS number", icon: <Phone className="h-4 w-4" /> },
  ];

  const messengerSubOptions = [
    { id: "welcomeScreen", label: "Welcome screen", icon: <Monitor className="h-4 w-4" /> },
    { id: "pageSettings", label: "Page settings", icon: <FileText className="h-4 w-4" /> },
    { id: "pageConnection", label: "Connect Facebook page", icon: <SiFacebook className="h-4 w-4" /> },
  ];

  const instagramSubOptions = [
    { id: "welcomeScreen", label: "Welcome screen", icon: <Monitor className="h-4 w-4" /> },
    { id: "profileSettings", label: "Profile settings", icon: <FileText className="h-4 w-4" /> },
    { id: "accountConnection", label: "Connect Instagram", icon: <SiInstagram className="h-4 w-4" /> },
  ];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg bg-white dark:bg-slate-900"
    >
      <div className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            data-testid={`drag-handle-${channel.id}`}
          >
            <GripVertical className="h-4 w-4 text-slate-400" />
          </button>
          <div className={channel.iconColor}>{channel.icon}</div>
          <span className="text-sm font-medium">{channel.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch 
            checked={enabled}
            onCheckedChange={onToggle}
            data-testid={`switch-channel-${channel.id}`}
          />
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onExpandToggle();
            }}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            data-testid={`expand-${channel.id}`}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>
        </div>
      </div>
      
      {isExpanded && channel.id === "liveChat" && liveChatSettings && onLiveChatSettingsChange && (
        <div className="border-t px-4 py-3">
          {activeSubSection === null ? (
            <div className="space-y-1">
              {liveChatSubOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => setActiveSubSection(option.id as LiveChatSubSection)}
                  className="w-full flex items-center justify-between py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  data-testid={`button-${option.id}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{option.icon}</span>
                    <span className="text-sm">{option.label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setActiveSubSection(null)}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                data-testid="button-back-to-options"
              >
                <ChevronLeft className="h-4 w-4" />
                {liveChatSubOptions.find(o => o.id === activeSubSection)?.label}
              </button>
              
              {activeSubSection === "welcomeScreen" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Field label *</Label>
                    <Input 
                      value={liveChatSettings.welcomeScreen.fieldLabel}
                      onChange={(e) => onLiveChatSettingsChange({
                        welcomeScreen: { ...liveChatSettings.welcomeScreen, fieldLabel: e.target.value }
                      })}
                      data-testid="input-welcome-field-label"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Button label *</Label>
                    <Input 
                      value={liveChatSettings.welcomeScreen.buttonLabel}
                      onChange={(e) => onLiveChatSettingsChange({
                        welcomeScreen: { ...liveChatSettings.welcomeScreen, buttonLabel: e.target.value }
                      })}
                      data-testid="input-welcome-button-label"
                    />
                  </div>
                </div>
              )}
              
              {activeSubSection === "preChatForm" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Title *</Label>
                    <div className="relative">
                      <Input 
                        value={liveChatSettings.preChatForm.title}
                        onChange={(e) => onLiveChatSettingsChange({
                          preChatForm: { ...liveChatSettings.preChatForm, title: e.target.value }
                        })}
                        data-testid="input-prechat-title"
                      />
                      <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7">
                        <Smile className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Form fields</Label>
                    <p className="text-xs text-slate-400">Your contacts will need to populate the enabled fields before a live chat request is sent to your agents.</p>
                    
                    <div className="space-y-2 mt-3">
                      <div className="flex items-center justify-between py-2 px-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-slate-300" />
                          <span className="text-sm">Name</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              checked={liveChatSettings.preChatForm.nameFieldRequired}
                              onCheckedChange={(checked) => onLiveChatSettingsChange({
                                preChatForm: { ...liveChatSettings.preChatForm, nameFieldRequired: checked as boolean }
                              })}
                              data-testid="checkbox-name-required"
                            />
                            <span className="text-xs text-slate-500">Required</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between py-2 px-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-slate-300" />
                          <span className="text-sm">Email</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              checked={liveChatSettings.preChatForm.emailFieldRequired}
                              onCheckedChange={(checked) => onLiveChatSettingsChange({
                                preChatForm: { ...liveChatSettings.preChatForm, emailFieldRequired: checked as boolean }
                              })}
                              data-testid="checkbox-email-required"
                            />
                            <span className="text-xs text-slate-500">Required</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Button label *</Label>
                    <Input 
                      value={liveChatSettings.preChatForm.buttonLabel}
                      onChange={(e) => onLiveChatSettingsChange({
                        preChatForm: { ...liveChatSettings.preChatForm, buttonLabel: e.target.value }
                      })}
                      data-testid="input-prechat-button-label"
                    />
                  </div>
                </div>
              )}
              
              {activeSubSection === "queueSettings" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Auto-reply message *</Label>
                    <Textarea 
                      value={liveChatSettings.queueSettings.autoReplyMessage}
                      onChange={(e) => onLiveChatSettingsChange({
                        queueSettings: { ...liveChatSettings.queueSettings, autoReplyMessage: e.target.value }
                      })}
                      rows={2}
                      data-testid="textarea-auto-reply"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Close chat automatically after *</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number"
                        className="w-20"
                        value={liveChatSettings.queueSettings.closeAfterMinutes}
                        onChange={(e) => onLiveChatSettingsChange({
                          queueSettings: { ...liveChatSettings.queueSettings, closeAfterMinutes: parseInt(e.target.value) || 5 }
                        })}
                        data-testid="input-close-after-minutes"
                      />
                      <span className="text-sm text-slate-500">minutes of waiting in the queue</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Timeout message *</Label>
                    <Textarea 
                      value={liveChatSettings.queueSettings.timeoutMessage}
                      onChange={(e) => onLiveChatSettingsChange({
                        queueSettings: { ...liveChatSettings.queueSettings, timeoutMessage: e.target.value }
                      })}
                      rows={3}
                      data-testid="textarea-timeout-message"
                    />
                  </div>
                </div>
              )}
              
              {activeSubSection === "satisfactionSurvey" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch 
                      checked={liveChatSettings.satisfactionSurvey.enabled}
                      onCheckedChange={(checked) => onLiveChatSettingsChange({
                        satisfactionSurvey: { enabled: checked }
                      })}
                      data-testid="switch-satisfaction-survey"
                    />
                    <div>
                      <Label className="text-sm font-medium">Show satisfaction survey</Label>
                      <p className="text-xs text-slate-500">After chat is ended, a short survey will be shown to your contact asking feedback about the support help they received.</p>
                    </div>
                  </div>
                </div>
              )}
              
              {activeSubSection === "offlineMode" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch 
                      checked={liveChatSettings.offlineMode.hideChannel}
                      onCheckedChange={(checked) => onLiveChatSettingsChange({
                        offlineMode: { ...liveChatSettings.offlineMode, hideChannel: checked }
                      })}
                      data-testid="switch-hide-channel"
                    />
                    <div>
                      <Label className="text-sm font-medium">Hide live chat channel</Label>
                      <p className="text-xs text-slate-500">If enabled, the live chat channel in the widget will be hidden when all agents are offline. If this is the only channel in the widget, the widget will also be hidden. If disabled, the channel is shown, and visitors can leave a message even when agents are offline.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Offline message</Label>
                    <Textarea 
                      value={liveChatSettings.offlineMode.offlineMessage}
                      onChange={(e) => onLiveChatSettingsChange({
                        offlineMode: { ...liveChatSettings.offlineMode, offlineMessage: e.target.value }
                      })}
                      rows={3}
                      data-testid="textarea-offline-message"
                    />
                  </div>
                </div>
              )}
              
              {activeSubSection === "additionalSettings" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Add contacts to list</Label>
                    <Select 
                      value={liveChatSettings.additionalSettings.addContactsToList || "none"}
                      onValueChange={(v) => onLiveChatSettingsChange({
                        additionalSettings: { addContactsToList: v === "none" ? "" : v }
                      })}
                    >
                      <SelectTrigger data-testid="select-contacts-list">
                        <SelectValue placeholder="Select a list" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No list selected</SelectItem>
                        <SelectItem value="website-visitors">Website Visitors</SelectItem>
                        <SelectItem value="chat-leads">Chat Leads</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">Anyone who fills out the form will be automatically added to the selected list.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {isExpanded && channel.id === "phone" && callSettings && onCallSettingsChange && (
        <div className="border-t px-4 py-3">
          {activeCallSubSection === null ? (
            <div className="space-y-1">
              {callSubOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => setActiveCallSubSection(option.id as CallSubSection)}
                  className="w-full flex items-center justify-between py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  data-testid={`button-call-${option.id}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{option.icon}</span>
                    <span className="text-sm">{option.label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setActiveCallSubSection(null)}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                data-testid="button-back-to-call-options"
              >
                <ChevronLeft className="h-4 w-4" />
                {callSubOptions.find(o => o.id === activeCallSubSection)?.label}
              </button>
              
              {activeCallSubSection === "callUsScreen" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch 
                      checked={callSettings.callUsScreen.showQRCode}
                      onCheckedChange={(checked) => onCallSettingsChange({
                        callUsScreen: { ...callSettings.callUsScreen, showQRCode: checked }
                      })}
                      data-testid="switch-show-qr-code"
                    />
                    <Label className="text-sm font-medium">Show QR code</Label>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Title & description *</Label>
                    <div className="relative">
                      <Input 
                        value={callSettings.callUsScreen.title}
                        onChange={(e) => onCallSettingsChange({
                          callUsScreen: { ...callSettings.callUsScreen, title: e.target.value }
                        })}
                        data-testid="input-call-title"
                      />
                      <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7">
                        <Smile className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Textarea 
                      value={callSettings.callUsScreen.description}
                      onChange={(e) => onCallSettingsChange({
                        callUsScreen: { ...callSettings.callUsScreen, description: e.target.value }
                      })}
                      rows={3}
                      data-testid="textarea-call-description"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Button label *</Label>
                    <Input 
                      value={callSettings.callUsScreen.buttonLabel}
                      onChange={(e) => onCallSettingsChange({
                        callUsScreen: { ...callSettings.callUsScreen, buttonLabel: e.target.value }
                      })}
                      data-testid="input-call-button-label"
                    />
                  </div>
                </div>
              )}
              
              {activeCallSubSection === "numberSettings" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-500">
                      Choose one of your connected phone numbers or enter a custom one. <strong>Please note:</strong> If you use a custom number, inbound calls will not be tracked in the system.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Phone number to display</Label>
                    <Select 
                      value={callSettings.numberSettings?.numberType || "connected"}
                      onValueChange={(v: "connected" | "custom") => onCallSettingsChange({
                        numberSettings: { ...callSettings.numberSettings, numberType: v }
                      })}
                    >
                      <SelectTrigger data-testid="select-call-number-type">
                        <SelectValue placeholder="Select number type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="connected">Use connected number</SelectItem>
                        <SelectItem value="custom">Enter custom number</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {callSettings.numberSettings?.numberType === "connected" && companyNumbers && companyNumbers.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">Select connected number</Label>
                      <Select 
                        value={callSettings.numberSettings.selectedConnectedNumber || ""}
                        onValueChange={(v) => onCallSettingsChange({
                          numberSettings: { ...callSettings.numberSettings, selectedConnectedNumber: v }
                        })}
                      >
                        <SelectTrigger data-testid="select-call-connected-number">
                          <SelectValue placeholder="Select a phone number" />
                        </SelectTrigger>
                        <SelectContent>
                          {companyNumbers.map((num) => (
                            <SelectItem key={num.phoneNumber} value={num.phoneNumber}>
                              {num.displayName || num.friendlyName || num.phoneNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {callSettings.numberSettings?.numberType === "connected" && (!companyNumbers || companyNumbers.length === 0) && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        No connected phone numbers found. Please connect a phone number in Telnyx settings or use a custom number.
                      </p>
                    </div>
                  )}
                  
                  {callSettings.numberSettings?.numberType === "custom" && (
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">Custom phone number</Label>
                      <div className="flex items-center gap-2 px-3 py-2 border rounded-lg">
                        <span className="text-lg">🇺🇸</span>
                        <Input 
                          value={callSettings.numberSettings.customNumber || ""}
                          onChange={(e) => onCallSettingsChange({
                            numberSettings: { ...callSettings.numberSettings, customNumber: e.target.value }
                          })}
                          className="border-0 p-0 focus-visible:ring-0"
                          placeholder="+1 234 567 8900"
                          data-testid="input-call-custom-number"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {activeCallSubSection === "numbersAndCountries" && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Numbers and countries</Label>
                    <p className="text-xs text-slate-500 mt-1">
                      You can show local contact numbers based on the visitor's IP country. Choose one of your connected numbers or enter your own phone number. The <strong>Global</strong> number will be shown if the detected IP country doesn't have a virtual number selected below.
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      <strong>Please note:</strong> If you use a custom number, inbound calls will not be tracked in the system.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 font-medium">
                      <span>Country</span>
                      <span>Phone number to display</span>
                    </div>
                    
                    {callSettings.numbersAndCountries.entries.map((entry, index) => (
                      <div key={index} className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-800">
                          <span className="text-sm">{entry.country}</span>
                        </div>
                        <Select 
                          value={entry.phoneNumber}
                          onValueChange={(v) => {
                            const newEntries = [...callSettings.numbersAndCountries.entries];
                            newEntries[index] = { ...newEntries[index], phoneNumber: v };
                            onCallSettingsChange({
                              numbersAndCountries: { entries: newEntries }
                            });
                          }}
                        >
                          <SelectTrigger data-testid={`select-phone-${index}`}>
                            <SelectValue placeholder="Select a phone number" />
                          </SelectTrigger>
                          <SelectContent>
                            {companyNumbers && companyNumbers.length > 0 ? (
                              <>
                                <div className="text-xs text-slate-500 px-2 py-1 font-medium">Connected numbers</div>
                                {companyNumbers.map((num) => (
                                  <SelectItem key={num.phoneNumber} value={num.phoneNumber}>
                                    {num.displayName || num.friendlyName || num.phoneNumber}
                                  </SelectItem>
                                ))}
                                <div className="text-xs text-slate-500 px-2 py-1 font-medium mt-2">Other</div>
                                <SelectItem value="custom">+ Enter custom number...</SelectItem>
                              </>
                            ) : (
                              <>
                                <div className="text-xs text-slate-500 px-2 py-1">No connected numbers available</div>
                                <SelectItem value="custom">+ Enter custom number...</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      const defaultNumber = companyNumbers && companyNumbers.length > 0 
                        ? companyNumbers[0].phoneNumber 
                        : "";
                      const newEntries = [
                        ...callSettings.numbersAndCountries.entries,
                        { country: "United States", phoneNumber: defaultNumber }
                      ];
                      onCallSettingsChange({
                        numbersAndCountries: { entries: newEntries }
                      });
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    data-testid="button-add-country"
                  >
                    + Add new country
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {isExpanded && channel.id === "whatsapp" && whatsappSettings && onWhatsappSettingsChange && (
        <div className="border-t px-4 py-3">
          {activeWhatsappSubSection === null ? (
            <div className="space-y-1">
              {whatsappSubOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => setActiveWhatsappSubSection(option.id as WhatsappSubSection)}
                  className="w-full flex items-center justify-between py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  data-testid={`button-whatsapp-${option.id}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{option.icon}</span>
                    <span className="text-sm">{option.label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setActiveWhatsappSubSection(null)}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                data-testid="button-back-to-whatsapp-options"
              >
                <ChevronLeft className="h-4 w-4" />
                {whatsappSubOptions.find(o => o.id === activeWhatsappSubSection)?.label}
              </button>
              
              {activeWhatsappSubSection === "welcomeScreen" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Channel name *</Label>
                    <div className="flex items-center gap-2 px-3 py-2 border rounded-lg">
                      <SiWhatsapp className="h-5 w-5 text-[#25D366]" />
                      <Input 
                        value={whatsappSettings.welcomeScreen.channelName}
                        onChange={(e) => onWhatsappSettingsChange({
                          welcomeScreen: { channelName: e.target.value }
                        })}
                        className="border-0 p-0 focus-visible:ring-0"
                        data-testid="input-whatsapp-channel-name"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {activeWhatsappSubSection === "messageScreen" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch 
                      checked={whatsappSettings.messageScreen.showQRCode}
                      onCheckedChange={(checked) => onWhatsappSettingsChange({
                        messageScreen: { ...whatsappSettings.messageScreen, showQRCode: checked }
                      })}
                      data-testid="switch-whatsapp-qr-code"
                    />
                    <Label className="text-sm font-medium">Show QR code</Label>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Title & description *</Label>
                    <div className="relative">
                      <Input 
                        value={whatsappSettings.messageScreen.title}
                        onChange={(e) => onWhatsappSettingsChange({
                          messageScreen: { ...whatsappSettings.messageScreen, title: e.target.value }
                        })}
                        className="pr-8"
                        data-testid="input-whatsapp-title"
                      />
                      <button 
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      >
                        <Smile className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Textarea 
                      value={whatsappSettings.messageScreen.description}
                      onChange={(e) => onWhatsappSettingsChange({
                        messageScreen: { ...whatsappSettings.messageScreen, description: e.target.value }
                      })}
                      rows={3}
                      data-testid="textarea-whatsapp-description"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Button label *</Label>
                    <Input 
                      value={whatsappSettings.messageScreen.buttonLabel}
                      onChange={(e) => onWhatsappSettingsChange({
                        messageScreen: { ...whatsappSettings.messageScreen, buttonLabel: e.target.value }
                      })}
                      data-testid="input-whatsapp-button-label"
                    />
                  </div>
                </div>
              )}
              
              {activeWhatsappSubSection === "numberSettings" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-500">
                      Choose one of your connected WhatsApp numbers or add a custom one. <strong>Please note:</strong> If you use a custom number, inbound messages will not be displayed in Textmagic.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">WhatsApp number to display</Label>
                    <Select 
                      value={whatsappSettings.numberSettings.numberType}
                      onValueChange={(v: "connected" | "custom") => onWhatsappSettingsChange({
                        numberSettings: { ...whatsappSettings.numberSettings, numberType: v }
                      })}
                    >
                      <SelectTrigger data-testid="select-whatsapp-number-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input placeholder="Search" className="mb-2" />
                        </div>
                        <div className="text-xs text-slate-500 px-2 py-1 font-medium">WhatsApp</div>
                        <SelectItem value="connected">- Connect WhatsApp number to Textmagic -</SelectItem>
                        <SelectItem value="custom">+ Display custom number</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {whatsappSettings.numberSettings.numberType === "custom" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-3 py-2 border rounded-lg">
                        <span className="text-lg">🇺🇸</span>
                        <span className="text-slate-400">▼</span>
                        <Input 
                          value={whatsappSettings.numberSettings.customNumber}
                          onChange={(e) => onWhatsappSettingsChange({
                            numberSettings: { ...whatsappSettings.numberSettings, customNumber: e.target.value }
                          })}
                          className="border-0 p-0 focus-visible:ring-0"
                          placeholder="+1 234 567 8900"
                          data-testid="input-whatsapp-custom-number"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {isExpanded && channel.id === "email" && emailSettings && onEmailSettingsChange && (
        <div className="border-t px-4 py-3">
          {activeEmailSubSection === null ? (
            <div className="space-y-1">
              {emailSubOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => setActiveEmailSubSection(option.id as EmailSubSection)}
                  className="w-full flex items-center justify-between py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  data-testid={`button-email-${option.id}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{option.icon}</span>
                    <span className="text-sm">{option.label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setActiveEmailSubSection(null)}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                data-testid="button-back-to-email-options"
              >
                <ChevronLeft className="h-4 w-4" />
                {emailSubOptions.find(o => o.id === activeEmailSubSection)?.label}
              </button>
              
              {activeEmailSubSection === "welcomeScreen" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Channel name *</Label>
                    <div className="flex items-center gap-2 px-3 py-2 border rounded-lg">
                      <Mail className="h-5 w-5 text-slate-500" />
                      <Input 
                        value={emailSettings.welcomeScreen.channelName}
                        onChange={(e) => onEmailSettingsChange({
                          welcomeScreen: { channelName: e.target.value }
                        })}
                        className="border-0 p-0 focus-visible:ring-0"
                        data-testid="input-email-channel-name"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {activeEmailSubSection === "formFields" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Title & description *</Label>
                    <div className="relative">
                      <Input 
                        value={emailSettings.formFields.title}
                        onChange={(e) => onEmailSettingsChange({
                          formFields: { ...emailSettings.formFields, title: e.target.value }
                        })}
                        data-testid="input-email-form-title"
                      />
                      <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7">
                        <Smile className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Textarea 
                      value={emailSettings.formFields.description}
                      onChange={(e) => onEmailSettingsChange({
                        formFields: { ...emailSettings.formFields, description: e.target.value }
                      })}
                      rows={3}
                      data-testid="textarea-email-form-description"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Form fields</Label>
                    <p className="text-xs text-slate-500">Your contacts will need to populate the enabled fields before a live chat request is sent to your agents.</p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-2 px-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-slate-400" />
                          <span className="text-sm">Name</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            checked={emailSettings.formFields.nameFieldRequired}
                            onCheckedChange={(checked) => onEmailSettingsChange({
                              formFields: { ...emailSettings.formFields, nameFieldRequired: !!checked }
                            })}
                            data-testid="checkbox-email-name-required"
                          />
                          <span className="text-xs text-slate-500">Required</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between py-2 px-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-slate-400" />
                          <span className="text-sm">Email</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            checked={emailSettings.formFields.emailFieldRequired}
                            onCheckedChange={(checked) => onEmailSettingsChange({
                              formFields: { ...emailSettings.formFields, emailFieldRequired: !!checked }
                            })}
                            data-testid="checkbox-email-email-required"
                          />
                          <span className="text-xs text-slate-500">Required</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between py-2 px-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-slate-400" />
                          <span className="text-sm">Message</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            checked={emailSettings.formFields.messageFieldRequired}
                            onCheckedChange={(checked) => onEmailSettingsChange({
                              formFields: { ...emailSettings.formFields, messageFieldRequired: !!checked }
                            })}
                            data-testid="checkbox-email-message-required"
                          />
                          <span className="text-xs text-slate-500">Required</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Button label *</Label>
                    <Input 
                      value={emailSettings.formFields.buttonLabel}
                      onChange={(e) => onEmailSettingsChange({
                        formFields: { ...emailSettings.formFields, buttonLabel: e.target.value }
                      })}
                      data-testid="input-email-button-label"
                    />
                  </div>
                </div>
              )}
              
              {activeEmailSubSection === "successScreen" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Title & description *</Label>
                    <div className="relative">
                      <Input 
                        value={emailSettings.successScreen.title}
                        onChange={(e) => onEmailSettingsChange({
                          successScreen: { ...emailSettings.successScreen, title: e.target.value }
                        })}
                        data-testid="input-email-success-title"
                      />
                      <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7">
                        <Smile className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Textarea 
                      value={emailSettings.successScreen.description}
                      onChange={(e) => onEmailSettingsChange({
                        successScreen: { ...emailSettings.successScreen, description: e.target.value }
                      })}
                      rows={3}
                      data-testid="textarea-email-success-description"
                    />
                  </div>
                </div>
              )}
              
              {activeEmailSubSection === "associatedEmail" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Associated email for incoming requests *</Label>
                    <Select 
                      value={emailSettings.associatedEmail.emailType}
                      onValueChange={(v: "connected" | "custom") => onEmailSettingsChange({
                        associatedEmail: { ...emailSettings.associatedEmail, emailType: v }
                      })}
                    >
                      <SelectTrigger data-testid="select-email-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input placeholder="Search" className="mb-2" />
                        </div>
                        <div className="text-xs text-slate-500 px-2 py-1 font-medium">Connected inboxes</div>
                        <SelectItem value="connected">- Connect new inbox -</SelectItem>
                        <SelectItem value="custom">+ Use custom email address</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {emailSettings.associatedEmail.emailType === "custom" && (
                    <div className="space-y-2">
                      <Input 
                        value={emailSettings.associatedEmail.customEmail}
                        onChange={(e) => onEmailSettingsChange({
                          associatedEmail: { ...emailSettings.associatedEmail, customEmail: e.target.value }
                        })}
                        placeholder="email@example.com"
                        data-testid="input-email-custom-address"
                      />
                      <p className="text-xs text-slate-500">Once the form gets submitted by a visitor, an email will be sent to the address specified above.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isExpanded && channel.id === "sms" && smsSettings && onSmsSettingsChange && (
        <div className="border-t px-4 py-3">
          {activeSmsSubSection === null ? (
            <div className="space-y-1">
              {smsSubOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setActiveSmsSubSection(option.id as SmsSubSection)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  data-testid={`sms-option-${option.id}`}
                >
                  <div className="flex items-center gap-3">
                    {option.icon}
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setActiveSmsSubSection(null)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                data-testid="sms-back-button"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>

              {activeSmsSubSection === "welcomeScreen" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Channel name in Welcome screen *</Label>
                    <Input 
                      value={smsSettings.welcomeScreen.channelName}
                      onChange={(e) => onSmsSettingsChange({
                        welcomeScreen: { ...smsSettings.welcomeScreen, channelName: e.target.value }
                      })}
                      data-testid="input-sms-channel-name"
                    />
                  </div>
                </div>
              )}

              {activeSmsSubSection === "messageScreen" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch 
                      checked={smsSettings.messageScreen?.showQRCode ?? true}
                      onCheckedChange={(checked) => onSmsSettingsChange({
                        messageScreen: { ...smsSettings.messageScreen, showQRCode: checked }
                      })}
                      data-testid="switch-sms-qr-code"
                    />
                    <Label className="text-sm font-medium">Show QR code</Label>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Title & description *</Label>
                    <div className="relative">
                      <Input 
                        value={smsSettings.messageScreen.title}
                        onChange={(e) => onSmsSettingsChange({
                          messageScreen: { ...smsSettings.messageScreen, title: e.target.value }
                        })}
                        className="pr-8"
                        data-testid="input-sms-title"
                      />
                      <button 
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      >
                        <Smile className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Textarea 
                      value={smsSettings.messageScreen.description}
                      onChange={(e) => onSmsSettingsChange({
                        messageScreen: { ...smsSettings.messageScreen, description: e.target.value }
                      })}
                      rows={3}
                      data-testid="textarea-sms-description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Button label *</Label>
                    <Input 
                      value={smsSettings.messageScreen.buttonLabel}
                      onChange={(e) => onSmsSettingsChange({
                        messageScreen: { ...smsSettings.messageScreen, buttonLabel: e.target.value }
                      })}
                      data-testid="input-sms-button-label"
                    />
                  </div>
                </div>
              )}

              {activeSmsSubSection === "numberSettings" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">SMS phone number *</Label>
                    <Select 
                      value={smsSettings.numberSettings.numberType}
                      onValueChange={(v: "connected" | "custom") => onSmsSettingsChange({
                        numberSettings: { ...smsSettings.numberSettings, numberType: v }
                      })}
                    >
                      <SelectTrigger data-testid="select-sms-number-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="connected">Use connected number</SelectItem>
                        <SelectItem value="custom">Use custom number</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {smsSettings.numberSettings.numberType === "connected" && companyNumbers.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">Select connected number</Label>
                      <Select 
                        value={smsSettings.numberSettings?.connectedNumber || companyNumbers[0]?.phoneNumber || ""}
                        onValueChange={(v: string) => onSmsSettingsChange({
                          numberSettings: { ...smsSettings.numberSettings, connectedNumber: v }
                        })}
                      >
                        <SelectTrigger data-testid="select-sms-connected-number">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {companyNumbers.map((num) => (
                            <SelectItem key={num.phoneNumber} value={num.phoneNumber}>
                              {num.displayName || num.friendlyName || num.phoneNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {smsSettings.numberSettings.numberType === "connected" && companyNumbers.length === 0 && (
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-center">
                      <p className="text-sm text-slate-500">No connected phone numbers available</p>
                      <p className="text-xs text-slate-400 mt-1">Go to Settings to add a phone number</p>
                    </div>
                  )}
                  {smsSettings.numberSettings.numberType === "custom" && (
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">Custom phone number (international format)</Label>
                      <Input 
                        value={smsSettings.numberSettings?.customNumber || ""}
                        onChange={(e) => {
                          const formatted = formatPhoneNumber(e.target.value);
                          onSmsSettingsChange({
                            numberSettings: { ...smsSettings.numberSettings, customNumber: formatted }
                          });
                        }}
                        placeholder="+1 (305) 360-4444"
                        data-testid="input-sms-custom-number"
                      />
                      <p className="text-xs text-slate-400">Enter the full international number with country code (e.g., +1 for USA)</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isExpanded && channel.id === "facebook" && messengerSettings && onMessengerSettingsChange && (
        <div className="border-t px-4 py-3">
          {activeMessengerSubSection === null ? (
            <div className="space-y-1">
              {messengerSubOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setActiveMessengerSubSection(option.id as MessengerSubSection)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  data-testid={`messenger-option-${option.id}`}
                >
                  <div className="flex items-center gap-3">
                    {option.icon}
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setActiveMessengerSubSection(null)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                data-testid="messenger-back-button"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>

              {activeMessengerSubSection === "welcomeScreen" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Channel name in Welcome screen *</Label>
                    <Input 
                      value={messengerSettings.welcomeScreen.channelName}
                      onChange={(e) => onMessengerSettingsChange({
                        welcomeScreen: { ...messengerSettings.welcomeScreen, channelName: e.target.value }
                      })}
                      data-testid="input-messenger-channel-name"
                    />
                  </div>
                </div>
              )}

              {activeMessengerSubSection === "pageSettings" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Title *</Label>
                    <Input 
                      value={messengerSettings.pageSettings.title}
                      onChange={(e) => onMessengerSettingsChange({
                        pageSettings: { ...messengerSettings.pageSettings, title: e.target.value }
                      })}
                      data-testid="input-messenger-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Description</Label>
                    <Textarea 
                      value={messengerSettings.pageSettings.description}
                      onChange={(e) => onMessengerSettingsChange({
                        pageSettings: { ...messengerSettings.pageSettings, description: e.target.value }
                      })}
                      rows={3}
                      data-testid="textarea-messenger-description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Button label *</Label>
                    <Input 
                      value={messengerSettings.pageSettings.buttonLabel}
                      onChange={(e) => onMessengerSettingsChange({
                        pageSettings: { ...messengerSettings.pageSettings, buttonLabel: e.target.value }
                      })}
                      data-testid="input-messenger-button-label"
                    />
                  </div>
                </div>
              )}

              {activeMessengerSubSection === "pageConnection" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Connected Facebook Page</Label>
                    <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800 text-center">
                      {messengerSettings.pageConnection.pageName ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <SiFacebook className="h-5 w-5 text-[#1877F2]" />
                            <span className="text-sm font-medium">{messengerSettings.pageConnection.pageName}</span>
                          </div>
                          <Button variant="outline" size="sm">Disconnect</Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <SiFacebook className="h-8 w-8 text-[#1877F2] mx-auto" />
                          <p className="text-sm text-slate-500">No Facebook page connected</p>
                          <Button variant="outline" size="sm">Connect Facebook Page</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isExpanded && channel.id === "instagram" && instagramSettings && onInstagramSettingsChange && (
        <div className="border-t px-4 py-3">
          {activeInstagramSubSection === null ? (
            <div className="space-y-1">
              {instagramSubOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setActiveInstagramSubSection(option.id as InstagramSubSection)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  data-testid={`instagram-option-${option.id}`}
                >
                  <div className="flex items-center gap-3">
                    {option.icon}
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setActiveInstagramSubSection(null)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                data-testid="instagram-back-button"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>

              {activeInstagramSubSection === "welcomeScreen" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Channel name in Welcome screen *</Label>
                    <Input 
                      value={instagramSettings.welcomeScreen.channelName}
                      onChange={(e) => onInstagramSettingsChange({
                        welcomeScreen: { ...instagramSettings.welcomeScreen, channelName: e.target.value }
                      })}
                      data-testid="input-instagram-channel-name"
                    />
                  </div>
                </div>
              )}

              {activeInstagramSubSection === "profileSettings" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Title *</Label>
                    <Input 
                      value={instagramSettings.profileSettings.title}
                      onChange={(e) => onInstagramSettingsChange({
                        profileSettings: { ...instagramSettings.profileSettings, title: e.target.value }
                      })}
                      data-testid="input-instagram-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Description</Label>
                    <Textarea 
                      value={instagramSettings.profileSettings.description}
                      onChange={(e) => onInstagramSettingsChange({
                        profileSettings: { ...instagramSettings.profileSettings, description: e.target.value }
                      })}
                      rows={3}
                      data-testid="textarea-instagram-description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Button label *</Label>
                    <Input 
                      value={instagramSettings.profileSettings.buttonLabel}
                      onChange={(e) => onInstagramSettingsChange({
                        profileSettings: { ...instagramSettings.profileSettings, buttonLabel: e.target.value }
                      })}
                      data-testid="input-instagram-button-label"
                    />
                  </div>
                </div>
              )}

              {activeInstagramSubSection === "accountConnection" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Connected Instagram Account</Label>
                    <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800 text-center">
                      {instagramSettings.accountConnection.username ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <SiInstagram className="h-5 w-5 text-[#E4405F]" />
                            <span className="text-sm font-medium">@{instagramSettings.accountConnection.username}</span>
                          </div>
                          <Button variant="outline" size="sm">Disconnect</Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <SiInstagram className="h-8 w-8 text-[#E4405F] mx-auto" />
                          <p className="text-sm text-slate-500">No Instagram account connected</p>
                          <Button variant="outline" size="sm">Connect Instagram</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatWidgetEditPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useParams();
  const widgetId = params.id;
  
  const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<string>("appearance");
  const [appearanceSubAccordion, setAppearanceSubAccordion] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localWidget, setLocalWidget] = useState<Partial<WidgetConfig>>({});
  
  const logoInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: widgetData, isLoading } = useQuery<{ widget: WidgetConfig }>({
    queryKey: [`/api/integrations/chat-widget/${widgetId}`],
    enabled: !!widgetId,
  });

  // Fetch company's connected phone numbers
  const { data: phoneNumbersData } = useQuery<{ numbers: Array<{ phoneNumber: string; friendlyName?: string; displayName?: string }> }>({
    queryKey: ["/api/telnyx/my-numbers"],
  });
  const companyNumbers = phoneNumbersData?.numbers || [];

  const defaultWidget: WidgetConfig = {
    id: widgetId || "",
    name: "My Website",
    colorTheme: "blue",
    themeType: "gradient",
    customColor: "#3B82F6",
    welcomeTitle: "Hi there 👋",
    welcomeMessage: "We are here to assist you with any questions or feedback you may have.",
    branding: {
      customLogo: null,
      logoFileName: null,
      logoFileSize: null,
    },
    minimizedState: {
      includeButtonText: false,
      icon: "chat",
      buttonText: "",
      borderRadius: 40,
      alignTo: "right",
      sideSpacing: 32,
      bottomSpacing: 26,
      eyeCatcherEnabled: false,
      eyeCatcherMessage: "👋 Hello, how can we help?",
      messageDelay: 7,
    },
    channels: {
      liveChat: true,
      email: true,
      sms: true,
      phone: true,
      whatsapp: false,
      facebook: false,
      instagram: false,
    },
    channelOrder: ["liveChat", "email", "sms", "phone", "whatsapp", "facebook", "instagram"],
    liveChatSettings: {
      welcomeScreen: {
        fieldLabel: "How can we help you today?",
        buttonLabel: "Start chat",
      },
      preChatForm: {
        title: "Chat with our agent",
        nameFieldEnabled: true,
        nameFieldRequired: false,
        emailFieldEnabled: true,
        emailFieldRequired: true,
        buttonLabel: "Start chat",
      },
      queueSettings: {
        autoReplyMessage: "Thank you, we have received your request.",
        closeAfterMinutes: 5,
        timeoutMessage: "Sorry, all agents are busy at the moment. We will reply to your email as soon as possible.",
      },
      satisfactionSurvey: {
        enabled: true,
      },
      offlineMode: {
        hideChannel: false,
        offlineMessage: "We have received your request. Unfortunately, all our agents are currently offline. We will reply to your email as soon as possible. Thank you for your patience!",
      },
      additionalSettings: {
        addContactsToList: "",
      },
    },
    callSettings: {
      callUsScreen: {
        showQRCode: true,
        title: "Speak with an agent",
        description: "Have an urgent matter? Please call us, and a dedicated agent will be available to help you.",
        buttonLabel: "Call now",
      },
      numberSettings: {
        numberType: "connected",
        selectedConnectedNumber: "",
        customNumber: "",
      },
      numbersAndCountries: {
        entries: [
          { country: "Default (global)", phoneNumber: "(833) 221-4494" },
        ],
      },
    },
    whatsappSettings: {
      welcomeScreen: {
        channelName: "Chat on WhatsApp",
      },
      messageScreen: {
        showQRCode: true,
        title: "Message us on WhatsApp",
        description: "Click the button below or scan the QR code to send a message to this WhatsApp number.",
        buttonLabel: "Open chat",
      },
      numberSettings: {
        numberType: "custom",
        customNumber: "+17866302522",
      },
    },
    emailSettings: {
      welcomeScreen: {
        channelName: "Send an email",
      },
      formFields: {
        title: "Get response via email",
        description: "Please fill the details below and we will reply to you via email within 72 hours.",
        nameFieldEnabled: true,
        nameFieldRequired: false,
        emailFieldEnabled: true,
        emailFieldRequired: true,
        messageFieldEnabled: true,
        messageFieldRequired: true,
        buttonLabel: "Send email",
      },
      successScreen: {
        title: "We have received your email",
        description: "We will respond to your email shortly.",
      },
      associatedEmail: {
        emailType: "custom",
        customEmail: "hello@cobertisinsurance.com",
      },
    },
    smsSettings: {
      welcomeScreen: {
        channelName: "Text us",
      },
      messageScreen: {
        title: "Send us a text message",
        description: "Click the button below to send us an SMS and we'll respond as soon as possible.",
        buttonLabel: "Send SMS",
      },
      numberSettings: {
        numberType: "connected",
        customNumber: "",
      },
    },
    messengerSettings: {
      welcomeScreen: {
        channelName: "Message on Facebook",
      },
      pageSettings: {
        title: "Message us on Facebook",
        description: "Click the button below to start a conversation on Facebook Messenger.",
        buttonLabel: "Open Messenger",
      },
      pageConnection: {
        pageId: "",
        pageName: "",
      },
    },
    instagramSettings: {
      welcomeScreen: {
        channelName: "Message on Instagram",
      },
      profileSettings: {
        title: "Message us on Instagram",
        description: "Click the button below to send us a direct message on Instagram.",
        buttonLabel: "Open Instagram",
      },
      accountConnection: {
        username: "",
        accountName: "",
      },
    },
    targeting: {
      countries: "all",
      selectedCountries: [],
      schedule: "always",
      timezone: "(UTC -05:00): America/New_York",
      scheduleEntries: [
        { day: "Monday", enabled: true, startTime: "9:00 AM", endTime: "5:00 PM" },
        { day: "Tuesday", enabled: true, startTime: "9:00 AM", endTime: "5:00 PM" },
        { day: "Wednesday", enabled: true, startTime: "9:00 AM", endTime: "5:00 PM" },
        { day: "Thursday", enabled: true, startTime: "9:00 AM", endTime: "5:00 PM" },
        { day: "Friday", enabled: true, startTime: "9:00 AM", endTime: "5:00 PM" },
        { day: "Saturday", enabled: false, startTime: "9:00 AM", endTime: "5:00 PM" },
        { day: "Sunday", enabled: false, startTime: "9:00 AM", endTime: "5:00 PM" },
      ],
      pageUrls: "all",
      urlRules: [{ condition: "contains", value: "" }],
      deviceType: "all",
    },
  };
  
  const widget = { 
    ...defaultWidget, 
    ...widgetData?.widget, 
    ...localWidget,
    targeting: { ...defaultWidget.targeting, ...widgetData?.widget?.targeting, ...localWidget?.targeting },
    branding: { ...defaultWidget.branding, ...widgetData?.widget?.branding, ...localWidget?.branding },
    minimizedState: { ...defaultWidget.minimizedState, ...widgetData?.widget?.minimizedState, ...localWidget?.minimizedState },
    liveChatSettings: { ...defaultWidget.liveChatSettings, ...widgetData?.widget?.liveChatSettings, ...localWidget?.liveChatSettings },
    callSettings: { ...defaultWidget.callSettings, ...widgetData?.widget?.callSettings, ...localWidget?.callSettings },
    whatsappSettings: { ...defaultWidget.whatsappSettings, ...widgetData?.widget?.whatsappSettings, ...localWidget?.whatsappSettings },
    emailSettings: { ...defaultWidget.emailSettings, ...widgetData?.widget?.emailSettings, ...localWidget?.emailSettings },
    smsSettings: { ...defaultWidget.smsSettings, ...widgetData?.widget?.smsSettings, ...localWidget?.smsSettings },
    messengerSettings: { ...defaultWidget.messengerSettings, ...widgetData?.widget?.messengerSettings, ...localWidget?.messengerSettings },
    instagramSettings: { ...defaultWidget.instagramSettings, ...widgetData?.widget?.instagramSettings, ...localWidget?.instagramSettings },
  };

  const embedCode = `<script src="https://widgets.curbe.io/messenger-widget-script.js" data-code="${widgetId}" defer=""></script>`;

  const updateLocalWidget = (updates: Partial<WidgetConfig>) => {
    setLocalWidget(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  const handleLogoUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an image file.",
      });
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
      });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const fileSize = file.size < 1024 
        ? `${file.size} B` 
        : file.size < 1024 * 1024 
          ? `${(file.size / 1024).toFixed(1)} KB` 
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      
      updateLocalWidget({ 
        branding: { 
          ...widget.branding,
          customLogo: base64, 
          logoFileName: file.name, 
          logoFileSize: fileSize 
        } 
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveChanges = () => {
    // Send the complete merged widget state, not just the partial localWidget
    // This ensures deep nested objects like smsSettings.numberSettings are fully preserved
    const fullWidget = {
      ...widget,
      id: undefined, // Remove id from payload as backend strips it anyway
      companyId: undefined,
      createdAt: undefined,
    };
    updateMutation.mutate(fullWidget);
    setHasUnsavedChanges(false);
    setLocalWidget({});
  };

  const handleDiscardChanges = () => {
    setLocalWidget({});
    setHasUnsavedChanges(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const currentOrder = widget.channelOrder || channelConfigs.map(c => c.id);
      const oldIndex = currentOrder.indexOf(active.id as string);
      const newIndex = currentOrder.indexOf(over.id as string);
      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
      updateLocalWidget({ channelOrder: newOrder });
    }
  };

  const handleChannelToggle = (channelKey: keyof WidgetConfig["channels"], enabled: boolean) => {
    updateLocalWidget({ 
      channels: { ...widget.channels, [channelKey]: enabled } 
    });
  };

  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const [activeLiveChatSubSection, setActiveLiveChatSubSection] = useState<"welcomeScreen" | "preChatForm" | "queueSettings" | "satisfactionSurvey" | "offlineMode" | "additionalSettings" | null>(null);
  const [activeEmailSubSection, setActiveEmailSubSection] = useState<"welcomeScreen" | "formFields" | "successScreen" | "associatedEmail" | null>(null);
  const [activeSmsSubSection, setActiveSmsSubSection] = useState<"welcomeScreen" | "messageScreen" | "numberSettings" | null>(null);

  const handleLiveChatSettingsChange = (settings: Partial<WidgetConfig["liveChatSettings"]>) => {
    updateLocalWidget({
      liveChatSettings: {
        ...widget.liveChatSettings,
        ...settings,
        welcomeScreen: {
          ...widget.liveChatSettings?.welcomeScreen,
          ...settings.welcomeScreen,
        },
        preChatForm: {
          ...widget.liveChatSettings?.preChatForm,
          ...settings.preChatForm,
        },
        queueSettings: {
          ...widget.liveChatSettings?.queueSettings,
          ...settings.queueSettings,
        },
        satisfactionSurvey: {
          ...widget.liveChatSettings?.satisfactionSurvey,
          ...settings.satisfactionSurvey,
        },
        offlineMode: {
          ...widget.liveChatSettings?.offlineMode,
          ...settings.offlineMode,
        },
        additionalSettings: {
          ...widget.liveChatSettings?.additionalSettings,
          ...settings.additionalSettings,
        },
      }
    });
  };

  const handleCallSettingsChange = (settings: Partial<WidgetConfig["callSettings"]>) => {
    updateLocalWidget({
      callSettings: {
        ...widget.callSettings,
        ...settings,
        callUsScreen: {
          ...widget.callSettings?.callUsScreen,
          ...settings.callUsScreen,
        },
        numberSettings: {
          ...widget.callSettings?.numberSettings,
          ...settings.numberSettings,
        },
        numbersAndCountries: {
          ...widget.callSettings?.numbersAndCountries,
          ...settings.numbersAndCountries,
        },
      }
    });
  };

  const handleWhatsappSettingsChange = (settings: Partial<WidgetConfig["whatsappSettings"]>) => {
    updateLocalWidget({
      whatsappSettings: {
        ...widget.whatsappSettings,
        ...settings,
        welcomeScreen: {
          ...widget.whatsappSettings?.welcomeScreen,
          ...settings.welcomeScreen,
        },
        messageScreen: {
          ...widget.whatsappSettings?.messageScreen,
          ...settings.messageScreen,
        },
        numberSettings: {
          ...widget.whatsappSettings?.numberSettings,
          ...settings.numberSettings,
        },
      }
    });
  };

  const handleEmailSettingsChange = (settings: Partial<WidgetConfig["emailSettings"]>) => {
    updateLocalWidget({
      emailSettings: {
        ...widget.emailSettings,
        ...settings,
        welcomeScreen: {
          ...widget.emailSettings?.welcomeScreen,
          ...settings.welcomeScreen,
        },
        formFields: {
          ...widget.emailSettings?.formFields,
          ...settings.formFields,
        },
        successScreen: {
          ...widget.emailSettings?.successScreen,
          ...settings.successScreen,
        },
        associatedEmail: {
          ...widget.emailSettings?.associatedEmail,
          ...settings.associatedEmail,
        },
      }
    });
  };

  const handleSmsSettingsChange = (settings: Partial<WidgetConfig["smsSettings"]>) => {
    updateLocalWidget({
      smsSettings: {
        ...widget.smsSettings,
        ...settings,
        welcomeScreen: {
          ...widget.smsSettings?.welcomeScreen,
          ...settings.welcomeScreen,
        },
        messageScreen: {
          ...widget.smsSettings?.messageScreen,
          ...settings.messageScreen,
        },
        numberSettings: {
          ...widget.smsSettings?.numberSettings,
          ...settings.numberSettings,
        },
      }
    });
  };

  const handleMessengerSettingsChange = (settings: Partial<WidgetConfig["messengerSettings"]>) => {
    updateLocalWidget({
      messengerSettings: {
        ...widget.messengerSettings,
        ...settings,
        welcomeScreen: {
          ...widget.messengerSettings?.welcomeScreen,
          ...settings.welcomeScreen,
        },
        pageSettings: {
          ...widget.messengerSettings?.pageSettings,
          ...settings.pageSettings,
        },
        pageConnection: {
          ...widget.messengerSettings?.pageConnection,
          ...settings.pageConnection,
        },
      }
    });
  };

  const handleInstagramSettingsChange = (settings: Partial<WidgetConfig["instagramSettings"]>) => {
    updateLocalWidget({
      instagramSettings: {
        ...widget.instagramSettings,
        ...settings,
        welcomeScreen: {
          ...widget.instagramSettings?.welcomeScreen,
          ...settings.welcomeScreen,
        },
        profileSettings: {
          ...widget.instagramSettings?.profileSettings,
          ...settings.profileSettings,
        },
        accountConnection: {
          ...widget.instagramSettings?.accountConnection,
          ...settings.accountConnection,
        },
      }
    });
  };

  const orderedChannels = (widget.channelOrder || channelConfigs.map(c => c.id))
    .map(id => channelConfigs.find(c => c.id === id))
    .filter((c): c is ChannelConfig => c !== undefined);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<WidgetConfig>) => {
      return apiRequest("PATCH", `/api/integrations/chat-widget/${widgetId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/integrations/chat-widget/${widgetId}`] });
      toast({
        title: "Changes saved",
        description: "Your widget settings have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message || "Failed to save changes.",
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("PATCH", `/api/integrations/chat-widget/${widgetId}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/integrations/chat-widget/${widgetId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/chat-widget/list"] });
      setEditNameDialogOpen(false);
      toast({
        title: "Name updated",
        description: "Your widget name has been changed.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Rename Failed",
        description: error.message || "Failed to rename widget.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/integrations/chat-widget/${widgetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/chat-widget/list"] });
      toast({
        title: "Widget deleted",
        description: "Your chat widget has been deleted.",
      });
      setLocation("/settings/chat-widget");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error.message || "Failed to delete widget.",
      });
    },
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast({
      title: "Copied",
      description: "Embed code copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const currentColorOption = colorOptions.find(c => c.value === widget.colorTheme) || colorOptions[0];
  const currentColor = widget.themeType === "custom" 
    ? { value: "custom", hex: widget.customColor || "#3B82F6", bg: "", gradientHex: widget.customColor || "#3B82F6" }
    : currentColorOption;
  const useGradient = widget.themeType === "gradient";
  const currentBackground = useGradient ? currentColor.gradientHex : currentColor.hex;

  if (isLoading) {
    return (
      <SettingsLayout activeSection="chat-widget">
        <LoadingSpinner />
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout activeSection="chat-widget">
      <div className="space-y-6" data-testid="page-chat-widget-edit">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/settings" className="hover:text-slate-700 dark:hover:text-slate-300">
            Settings
          </Link>
          <span>&gt;</span>
          <Link href="/settings/chat-widget" className="hover:text-slate-700 dark:hover:text-slate-300">
            Chat widget
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-6">
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-blue-500">
                      <MessageSquare className="h-6 w-6 text-white" />
                    </div>
                    <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {widget.name}
                    </h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleCopyCode}
                      data-testid="button-copy-embed"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy embed code
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setNewName(widget.name);
                        setEditNameDialogOpen(true);
                      }}
                      data-testid="button-edit-name"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit name
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="button-more">
                          <MoreHorizontal className="h-4 w-4 mr-2" />
                          More
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => deleteMutation.mutate()}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete widget
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <Accordion 
                  type="single" 
                  collapsible 
                  value={activeAccordion}
                  onValueChange={setActiveAccordion}
                  className="w-full"
                >
                  <AccordionItem value="appearance" className="border-b">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                          <Pencil className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Appearance</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Customize how your website widget will look and feel.</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <Accordion 
                        type="single" 
                        collapsible 
                        value={appearanceSubAccordion}
                        onValueChange={setAppearanceSubAccordion}
                        className="w-full space-y-2"
                      >
                        <AccordionItem value="color-theme" className="border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-3">
                              <Palette className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium">Color theme</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4 pl-7">
                            <div className="space-y-4">
                              <RadioGroup 
                                value={widget.themeType} 
                                onValueChange={(v) => updateLocalWidget({ themeType: v as "gradient" | "solid" | "custom" })} 
                                className="flex gap-6"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="gradient" id="gradient" />
                                  <Label htmlFor="gradient" className="text-sm cursor-pointer">Gradient</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="solid" id="solid" />
                                  <Label htmlFor="solid" className="text-sm cursor-pointer">Solid color</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="custom" id="custom" />
                                  <Label htmlFor="custom" className="text-sm cursor-pointer">Custom</Label>
                                </div>
                              </RadioGroup>
                              {widget.themeType !== "custom" ? (
                                <div className="flex gap-2 flex-wrap">
                                  {colorOptions.map((color) => (
                                    <button
                                      key={color.value}
                                      onClick={() => updateLocalWidget({ colorTheme: color.value })}
                                      className={`w-8 h-8 rounded-full ${widget.themeType === "gradient" ? color.gradientBg : color.bg} transition-all ${
                                        widget.colorTheme === color.value 
                                          ? "ring-2 ring-offset-2 ring-blue-500" 
                                          : "hover:scale-110"
                                      }`}
                                      data-testid={`button-color-${color.value}`}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <div className="relative">
                                    <input
                                      type="color"
                                      value={widget.customColor || "#3B82F6"}
                                      onChange={(e) => updateLocalWidget({ customColor: e.target.value })}
                                      className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
                                      data-testid="input-custom-color"
                                    />
                                  </div>
                                  <Input
                                    value={widget.customColor || "#3B82F6"}
                                    onChange={(e) => updateLocalWidget({ customColor: e.target.value })}
                                    placeholder="#3B82F6"
                                    className="w-32 font-mono text-sm"
                                    data-testid="input-custom-color-hex"
                                  />
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="branding" className="border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-3">
                              <Monitor className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium">Branding</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4 pl-7">
                            <div className="space-y-4">
                              <Label className="text-sm font-medium">Custom logo</Label>
                              {widget.branding?.customLogo ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-3">
                                    <img 
                                      src={widget.branding.customLogo} 
                                      alt="Logo" 
                                      className="w-12 h-12 rounded object-cover"
                                    />
                                    <div>
                                      <p className="text-sm font-medium">{widget.branding.logoFileName}</p>
                                      <p className="text-xs text-slate-500">{widget.branding.logoFileSize}</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => logoInputRef.current?.click()}
                                    >
                                      <RefreshCw className="h-4 w-4 mr-1" />
                                      Replace
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-red-600"
                                      onClick={() => updateLocalWidget({ branding: { customLogo: null, logoFileName: null, logoFileSize: null } })}
                                    >
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      Delete
                                    </Button>
                                    <input
                                      ref={logoInputRef}
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleLogoUpload(file);
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div 
                                  className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                                  onClick={() => logoInputRef.current?.click()}
                                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const file = e.dataTransfer.files[0];
                                    if (file) handleLogoUpload(file);
                                  }}
                                >
                                  <input
                                    ref={logoInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleLogoUpload(file);
                                    }}
                                  />
                                  <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                                  <p className="text-sm text-slate-500">
                                    Drag image here or <span className="text-blue-600">browse...</span>
                                  </p>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="minimized-state" className="border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-3">
                              <MessageSquare className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium">Minimized state</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4 pl-7">
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <Switch 
                                  checked={widget.minimizedState?.includeButtonText || false}
                                  onCheckedChange={(checked) => updateLocalWidget({ 
                                    minimizedState: { ...widget.minimizedState, includeButtonText: checked } 
                                  })}
                                  data-testid="switch-include-button-text"
                                />
                                <Label className="text-sm">Include button text</Label>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-xs text-slate-500">Icon</Label>
                                  <Select 
                                    value={widget.minimizedState?.icon || "chat"}
                                    onValueChange={(v) => updateLocalWidget({ 
                                      minimizedState: { ...widget.minimizedState, icon: v as "chat" | "message" | "phone" | "email" } 
                                    })}
                                  >
                                    <SelectTrigger data-testid="select-minimized-icon">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {iconOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                          <div className="flex items-center gap-2">
                                            {opt.icon === "chat" && <MessageSquare className="h-4 w-4" />}
                                            {opt.icon === "message" && <MessageCircle className="h-4 w-4" />}
                                            {opt.icon === "phone" && <Phone className="h-4 w-4" />}
                                            {opt.icon === "email" && <Mail className="h-4 w-4" />}
                                            <span>{opt.label}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs text-slate-500">Button text</Label>
                                  <Input 
                                    placeholder="Type button text"
                                    value={widget.minimizedState?.buttonText || ""}
                                    onChange={(e) => updateLocalWidget({ 
                                      minimizedState: { ...widget.minimizedState, buttonText: e.target.value } 
                                    })}
                                    data-testid="input-button-text"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs text-slate-500">Border radius</Label>
                                  <div className="flex items-center gap-1">
                                    <Input 
                                      type="number"
                                      value={widget.minimizedState?.borderRadius || 40}
                                      onChange={(e) => updateLocalWidget({ 
                                        minimizedState: { ...widget.minimizedState, borderRadius: parseInt(e.target.value) || 40 } 
                                      })}
                                      data-testid="input-border-radius"
                                    />
                                    <span className="text-xs text-slate-500">px</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-xs text-slate-500">Align to</Label>
                                  <Select 
                                    value={widget.minimizedState?.alignTo || "right"}
                                    onValueChange={(v) => updateLocalWidget({ 
                                      minimizedState: { ...widget.minimizedState, alignTo: v as "left" | "right" } 
                                    })}
                                  >
                                    <SelectTrigger data-testid="select-align-to">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="left">Left</SelectItem>
                                      <SelectItem value="right">Right</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs text-slate-500">Side spacing</Label>
                                  <div className="flex items-center gap-1">
                                    <Input 
                                      type="number"
                                      value={widget.minimizedState?.sideSpacing || 32}
                                      onChange={(e) => updateLocalWidget({ 
                                        minimizedState: { ...widget.minimizedState, sideSpacing: parseInt(e.target.value) || 32 } 
                                      })}
                                      data-testid="input-side-spacing"
                                    />
                                    <span className="text-xs text-slate-500">px</span>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs text-slate-500">Bottom spacing</Label>
                                  <div className="flex items-center gap-1">
                                    <Input 
                                      type="number"
                                      value={widget.minimizedState?.bottomSpacing || 26}
                                      onChange={(e) => updateLocalWidget({ 
                                        minimizedState: { ...widget.minimizedState, bottomSpacing: parseInt(e.target.value) || 26 } 
                                      })}
                                      data-testid="input-bottom-spacing"
                                    />
                                    <span className="text-xs text-slate-500">px</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-3 pt-2">
                                <div className="flex items-center gap-2">
                                  <Switch 
                                    checked={widget.minimizedState?.eyeCatcherEnabled || false}
                                    onCheckedChange={(checked) => updateLocalWidget({ 
                                      minimizedState: { ...widget.minimizedState, eyeCatcherEnabled: checked } 
                                    })}
                                    data-testid="switch-eye-catcher"
                                  />
                                  <Label className="text-sm">Eye-catcher message</Label>
                                </div>
                                
                                {widget.minimizedState?.eyeCatcherEnabled && (
                                  <>
                                    <div className="space-y-2">
                                      <Label className="text-xs text-slate-500">Message text *</Label>
                                      <div className="flex items-center gap-2 w-[40%]">
                                        <div className="relative flex-1">
                                          <Input 
                                            value={widget.minimizedState?.eyeCatcherMessage || ""}
                                            onChange={(e) => updateLocalWidget({ 
                                              minimizedState: { ...widget.minimizedState, eyeCatcherMessage: e.target.value } 
                                            })}
                                            className="pr-9"
                                            data-testid="input-eye-catcher-message"
                                          />
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" data-testid="button-emoji-picker">
                                                <Smile className="h-4 w-4" />
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 z-50" align="end" side="top">
                                              <Picker 
                                                data={data} 
                                                onEmojiSelect={(emoji: { native: string }) => {
                                                  updateLocalWidget({ 
                                                    minimizedState: { 
                                                      ...widget.minimizedState, 
                                                      eyeCatcherMessage: (widget.minimizedState?.eyeCatcherMessage || "") + emoji.native 
                                                    } 
                                                  });
                                                }}
                                                theme="light"
                                                previewPosition="none"
                                                skinTonePosition="none"
                                              />
                                            </PopoverContent>
                                          </Popover>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs text-slate-500">Message delay</Label>
                                      <div className="flex items-center gap-2">
                                        <Input 
                                          type="number"
                                          className="w-20"
                                          value={widget.minimizedState?.messageDelay || 7}
                                          onChange={(e) => updateLocalWidget({ 
                                            minimizedState: { ...widget.minimizedState, messageDelay: parseInt(e.target.value) || 7 } 
                                          })}
                                          data-testid="input-message-delay"
                                        />
                                        <span className="text-sm text-slate-500">seconds</span>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="welcome-screen" className="border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-3">
                              <Monitor className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium">Welcome screen</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4 pl-7">
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label className="text-xs text-slate-500">Greeting *</Label>
                                <div className="flex items-center gap-2 w-[40%]">
                                  <div className="relative flex-1">
                                    <Input 
                                      value={widget.welcomeTitle}
                                      onChange={(e) => updateLocalWidget({ welcomeTitle: e.target.value })}
                                      className="pr-9"
                                    />
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                          <Smile className="h-4 w-4" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0 z-50" align="end" side="top">
                                        <Picker 
                                          data={data} 
                                          onEmojiSelect={(emoji: { native: string }) => {
                                            updateLocalWidget({ welcomeTitle: widget.welcomeTitle + emoji.native });
                                          }}
                                          theme="light"
                                          previewPosition="none"
                                          skinTonePosition="none"
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-xs text-slate-500">Intro *</Label>
                                <Input 
                                  value={widget.welcomeMessage}
                                  onChange={(e) => updateLocalWidget({ welcomeMessage: e.target.value })}
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-xs text-slate-500">Channels</Label>
                                <p className="text-xs text-slate-500">
                                  You will be able to set up all available channels in the next wizard step. This is just a preview of the welcome screen.
                                </p>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="channels" className="border-b">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                          <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Channels</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Set up communication channels available for your visitors.</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={orderedChannels.map(c => c.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {orderedChannels.map((channel) => (
                              <SortableChannelItem
                                key={channel.id}
                                channel={channel}
                                enabled={widget.channels[channel.key]}
                                onToggle={(enabled) => handleChannelToggle(channel.key, enabled)}
                                isExpanded={expandedChannel === channel.id}
                                onExpandToggle={() => setExpandedChannel(expandedChannel === channel.id ? null : channel.id)}
                                liveChatSettings={widget.liveChatSettings}
                                onLiveChatSettingsChange={handleLiveChatSettingsChange}
                                callSettings={widget.callSettings}
                                onCallSettingsChange={handleCallSettingsChange}
                                whatsappSettings={widget.whatsappSettings}
                                onWhatsappSettingsChange={handleWhatsappSettingsChange}
                                emailSettings={widget.emailSettings}
                                onEmailSettingsChange={handleEmailSettingsChange}
                                smsSettings={widget.smsSettings}
                                onSmsSettingsChange={handleSmsSettingsChange}
                                companyNumbers={companyNumbers}
                                messengerSettings={widget.messengerSettings}
                                onMessengerSettingsChange={handleMessengerSettingsChange}
                                instagramSettings={widget.instagramSettings}
                                onInstagramSettingsChange={handleInstagramSettingsChange}
                                activeLiveChatSubSection={activeLiveChatSubSection}
                                onActiveLiveChatSubSectionChange={setActiveLiveChatSubSection}
                                activeEmailSubSection={activeEmailSubSection}
                                onActiveEmailSubSectionChange={setActiveEmailSubSection}
                                activeSmsSubSection={activeSmsSubSection}
                                onActiveSmsSubSectionChange={setActiveSmsSubSection}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="targeting" className="border-b">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                          <Target className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Targeting</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Select the target audience - who should see the widget.</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6">
                      <Accordion type="single" collapsible className="space-y-2">
                        <AccordionItem value="countries" className="border rounded-lg">
                          <AccordionTrigger className="hover:no-underline px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Globe className="h-5 w-5 text-blue-500" />
                              <span className="text-sm font-medium">Countries</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4 pl-11">
                            <div className="space-y-4">
                              <p className="text-sm text-slate-500">Choose countries where to show or hide the widget</p>
                              
                              <RadioGroup 
                                value={widget.targeting?.countries || "all"}
                                onValueChange={(v) => updateLocalWidget({ 
                                  targeting: { ...widget.targeting, countries: v as "all" | "selected" | "excluded", selectedCountries: [] } 
                                })}
                                className="space-y-2"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="all" id="countries-all" />
                                  <Label htmlFor="countries-all" className="text-sm cursor-pointer">Show in all countries</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="selected" id="countries-selected" />
                                  <Label htmlFor="countries-selected" className="text-sm cursor-pointer">Show only in these countries</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="excluded" id="countries-excluded" />
                                  <Label htmlFor="countries-excluded" className="text-sm cursor-pointer">Hide only in these countries</Label>
                                </div>
                              </RadioGroup>
                              
                              {(widget.targeting?.countries === "selected" || widget.targeting?.countries === "excluded") && (
                                <div className="space-y-3">
                                  <Select
                                    onValueChange={(country) => {
                                      if (!(widget.targeting?.selectedCountries || []).includes(country)) {
                                        updateLocalWidget({
                                          targeting: {
                                            ...widget.targeting,
                                            selectedCountries: [...(widget.targeting?.selectedCountries || []), country]
                                          }
                                        });
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="w-full" data-testid="select-country">
                                      <SelectValue placeholder="Enter country name" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <div className="p-2">
                                        <Input placeholder="Enter country name" className="mb-2" />
                                      </div>
                                      {[
                                        { code: "US", name: "United States", flag: "🇺🇸" },
                                        { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
                                        { code: "AU", name: "Australia", flag: "🇦🇺" },
                                        { code: "CA", name: "Canada", flag: "🇨🇦" },
                                        { code: "AF", name: "Afghanistan", flag: "🇦🇫" },
                                        { code: "AL", name: "Albania", flag: "🇦🇱" },
                                        { code: "DZ", name: "Algeria", flag: "🇩🇿" },
                                        { code: "AS", name: "American Samoa", flag: "🇦🇸" },
                                        { code: "AO", name: "Angola", flag: "🇦🇴" },
                                        { code: "AR", name: "Argentina", flag: "🇦🇷" },
                                        { code: "DE", name: "Germany", flag: "🇩🇪" },
                                        { code: "FR", name: "France", flag: "🇫🇷" },
                                        { code: "ES", name: "Spain", flag: "🇪🇸" },
                                        { code: "IT", name: "Italy", flag: "🇮🇹" },
                                        { code: "MX", name: "Mexico", flag: "🇲🇽" },
                                        { code: "BR", name: "Brazil", flag: "🇧🇷" },
                                      ].filter(c => !(widget.targeting?.selectedCountries || []).includes(c.name)).map((country) => (
                                        <SelectItem key={country.code} value={country.name}>
                                          <div className="flex items-center gap-2">
                                            <span>{country.flag}</span>
                                            <span>{country.name}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  
                                  {(widget.targeting?.selectedCountries || []).length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {(widget.targeting?.selectedCountries || []).map((country) => {
                                        const countryData = [
                                          { name: "United States", flag: "🇺🇸" },
                                          { name: "United Kingdom", flag: "🇬🇧" },
                                          { name: "Australia", flag: "🇦🇺" },
                                          { name: "Canada", flag: "🇨🇦" },
                                          { name: "Afghanistan", flag: "🇦🇫" },
                                          { name: "Albania", flag: "🇦🇱" },
                                          { name: "Algeria", flag: "🇩🇿" },
                                          { name: "American Samoa", flag: "🇦🇸" },
                                          { name: "Angola", flag: "🇦🇴" },
                                          { name: "Argentina", flag: "🇦🇷" },
                                          { name: "Germany", flag: "🇩🇪" },
                                          { name: "France", flag: "🇫🇷" },
                                          { name: "Spain", flag: "🇪🇸" },
                                          { name: "Italy", flag: "🇮🇹" },
                                          { name: "Mexico", flag: "🇲🇽" },
                                          { name: "Brazil", flag: "🇧🇷" },
                                        ].find(c => c.name === country);
                                        return (
                                          <div 
                                            key={country}
                                            className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-sm"
                                          >
                                            <span>{countryData?.flag || "🏳️"}</span>
                                            <span>{country}</span>
                                            <button
                                              onClick={() => updateLocalWidget({
                                                targeting: {
                                                  ...widget.targeting,
                                                  selectedCountries: (widget.targeting?.selectedCountries || []).filter(c => c !== country)
                                                }
                                              })}
                                              className="ml-1 text-slate-500 hover:text-slate-700"
                                              data-testid={`button-remove-country-${country}`}
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="schedule" className="border rounded-lg">
                          <AccordionTrigger className="hover:no-underline px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Clock className="h-5 w-5 text-blue-500" />
                              <span className="text-sm font-medium">Schedule</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4 pl-11">
                            <div className="space-y-4">
                              <p className="text-sm text-slate-500">Choose times when the widget should be visible</p>
                              
                              <RadioGroup 
                                value={(widget.targeting?.schedule || "always")}
                                onValueChange={(v) => updateLocalWidget({ 
                                  targeting: { ...widget.targeting, schedule: v as "always" | "custom" } 
                                })}
                                className="space-y-2"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="always" id="schedule-always" />
                                  <Label htmlFor="schedule-always" className="text-sm cursor-pointer">Always</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="custom" id="schedule-custom" />
                                  <Label htmlFor="schedule-custom" className="text-sm cursor-pointer">Custom schedule</Label>
                                </div>
                              </RadioGroup>
                              
                              {(widget.targeting?.schedule || "always") === "custom" && (
                                <div className="space-y-4 mt-4">
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">Timezone</Label>
                                    <Select
                                      value={(widget.targeting?.timezone || "(UTC -05:00): America/New_York")}
                                      onValueChange={(v) => updateLocalWidget({
                                        targeting: { ...widget.targeting, timezone: v }
                                      })}
                                    >
                                      <SelectTrigger className="w-full" data-testid="select-timezone">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="(UTC -05:00): America/New_York">(UTC -05:00): America/New_York</SelectItem>
                                        <SelectItem value="(UTC -06:00): America/Chicago">(UTC -06:00): America/Chicago</SelectItem>
                                        <SelectItem value="(UTC -07:00): America/Denver">(UTC -07:00): America/Denver</SelectItem>
                                        <SelectItem value="(UTC -08:00): America/Los_Angeles">(UTC -08:00): America/Los_Angeles</SelectItem>
                                        <SelectItem value="(UTC +00:00): Europe/London">(UTC +00:00): Europe/London</SelectItem>
                                        <SelectItem value="(UTC +01:00): Europe/Paris">(UTC +01:00): Europe/Paris</SelectItem>
                                        <SelectItem value="(UTC +09:00): Asia/Tokyo">(UTC +09:00): Asia/Tokyo</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <p className="text-xs text-slate-500">
                                      Current date and time in the selected timezone: {new Date().toLocaleString('en-US', { 
                                        weekday: 'long', 
                                        day: 'numeric', 
                                        month: 'short', 
                                        year: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                      })}
                                    </p>
                                  </div>
                                  
                                  <div className="space-y-3">
                                    {(widget.targeting?.scheduleEntries || []).map((entry, index) => (
                                      <div key={entry.day} className="flex items-center gap-3">
                                        <Checkbox
                                          checked={entry.enabled}
                                          onCheckedChange={(checked) => {
                                            const newEntries = [...(widget.targeting?.scheduleEntries || [])];
                                            newEntries[index] = { ...entry, enabled: !!checked };
                                            updateLocalWidget({
                                              targeting: { ...widget.targeting, scheduleEntries: newEntries }
                                            });
                                          }}
                                          data-testid={`checkbox-schedule-${entry.day.toLowerCase()}`}
                                        />
                                        <span className="w-24 text-sm font-medium">{entry.day}</span>
                                        {entry.enabled ? (
                                          <>
                                            <div className="flex items-center gap-2">
                                              <Input
                                                value={entry.startTime}
                                                onChange={(e) => {
                                                  const newEntries = [...(widget.targeting?.scheduleEntries || [])];
                                                  newEntries[index] = { ...entry, startTime: e.target.value };
                                                  updateLocalWidget({
                                                    targeting: { ...widget.targeting, scheduleEntries: newEntries }
                                                  });
                                                }}
                                                className="w-24 text-sm"
                                                data-testid={`input-start-${entry.day.toLowerCase()}`}
                                              />
                                              <Clock className="h-4 w-4 text-slate-400" />
                                            </div>
                                            <span className="text-slate-400">-</span>
                                            <div className="flex items-center gap-2">
                                              <Input
                                                value={entry.endTime}
                                                onChange={(e) => {
                                                  const newEntries = [...(widget.targeting?.scheduleEntries || [])];
                                                  newEntries[index] = { ...entry, endTime: e.target.value };
                                                  updateLocalWidget({
                                                    targeting: { ...widget.targeting, scheduleEntries: newEntries }
                                                  });
                                                }}
                                                className="w-24 text-sm"
                                                data-testid={`input-end-${entry.day.toLowerCase()}`}
                                              />
                                              <Clock className="h-4 w-4 text-slate-400" />
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                              <Plus className="h-4 w-4" />
                                            </Button>
                                          </>
                                        ) : (
                                          <span className="text-sm text-blue-500">Widget hidden</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="page-urls" className="border rounded-lg">
                          <AccordionTrigger className="hover:no-underline px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Link2 className="h-5 w-5 text-blue-500" />
                              <span className="text-sm font-medium">Page URLs</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4 pl-11">
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-sm font-medium mb-1">Domain</h4>
                                <p className="text-sm text-slate-500">The widget will be shown on <span className="font-semibold">any domain</span> where the code is installed.</p>
                              </div>
                              
                              <div className="space-y-3">
                                <h4 className="text-sm font-medium">Page rules</h4>
                                <RadioGroup 
                                  value={(widget.targeting?.pageUrls || "all")}
                                  onValueChange={(v) => updateLocalWidget({ 
                                    targeting: { ...widget.targeting, pageUrls: v as "all" | "show-specific" | "hide-specific" } 
                                  })}
                                  className="space-y-2"
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="all" id="urls-all" />
                                    <Label htmlFor="urls-all" className="text-sm cursor-pointer">Show on all pages</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="show-specific" id="urls-show-specific" />
                                    <Label htmlFor="urls-show-specific" className="text-sm cursor-pointer">Show on specific pages only</Label>
                                  </div>
                                  
                                  {(widget.targeting?.pageUrls || "all") === "show-specific" && (
                                    <div className="ml-6 space-y-3">
                                      {(widget.targeting?.urlRules || []).map((rule, index) => (
                                        <div key={index}>
                                          {index > 0 && (
                                            <div className="text-sm text-slate-500 mb-2">OR</div>
                                          )}
                                          <div className="flex items-center gap-2">
                                            <Select
                                              value={rule.condition}
                                              onValueChange={(v) => {
                                                const newRules = [...(widget.targeting?.urlRules || [])];
                                                newRules[index] = { ...rule, condition: v as "contains" | "equals" | "starts" | "ends" };
                                                updateLocalWidget({
                                                  targeting: { ...widget.targeting, urlRules: newRules }
                                                });
                                              }}
                                            >
                                              <SelectTrigger className="w-36" data-testid={`select-url-condition-${index}`}>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="contains">URL contains</SelectItem>
                                                <SelectItem value="equals">URL equals</SelectItem>
                                                <SelectItem value="starts">URL starts with</SelectItem>
                                                <SelectItem value="ends">URL ends with</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <Input
                                              value={rule.value}
                                              onChange={(e) => {
                                                const newRules = [...(widget.targeting?.urlRules || [])];
                                                newRules[index] = { ...rule, value: e.target.value };
                                                updateLocalWidget({
                                                  targeting: { ...widget.targeting, urlRules: newRules }
                                                });
                                              }}
                                              placeholder={index === 0 ? "/prices" : "https://www.example.com/example-page/"}
                                              className="flex-1"
                                              data-testid={`input-url-value-${index}`}
                                            />
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => {
                                                const newRules = (widget.targeting?.urlRules || []).filter((_, i) => i !== index);
                                                if (newRules.length === 0) {
                                                  newRules.push({ condition: "contains", value: "" });
                                                }
                                                updateLocalWidget({
                                                  targeting: { ...widget.targeting, urlRules: newRules }
                                                });
                                              }}
                                              data-testid={`button-delete-rule-${index}`}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                      <Button
                                        variant="ghost"
                                        className="text-blue-500 h-auto p-0 hover:bg-transparent"
                                        onClick={() => {
                                          updateLocalWidget({
                                            targeting: {
                                              ...widget.targeting,
                                              urlRules: [...(widget.targeting?.urlRules || []), { condition: "contains", value: "" }]
                                            }
                                          });
                                        }}
                                        data-testid="button-add-rule"
                                      >
                                        + Add rule
                                      </Button>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="hide-specific" id="urls-hide-specific" />
                                    <Label htmlFor="urls-hide-specific" className="text-sm cursor-pointer">Hide on specific pages only</Label>
                                  </div>
                                  
                                  {(widget.targeting?.pageUrls || "all") === "hide-specific" && (
                                    <div className="ml-6 space-y-3">
                                      {(widget.targeting?.urlRules || []).map((rule, index) => (
                                        <div key={index}>
                                          {index > 0 && (
                                            <div className="text-sm text-slate-500 mb-2">OR</div>
                                          )}
                                          <div className="flex items-center gap-2">
                                            <Select
                                              value={rule.condition}
                                              onValueChange={(v) => {
                                                const newRules = [...(widget.targeting?.urlRules || [])];
                                                newRules[index] = { ...rule, condition: v as "contains" | "equals" | "starts" | "ends" };
                                                updateLocalWidget({
                                                  targeting: { ...widget.targeting, urlRules: newRules }
                                                });
                                              }}
                                            >
                                              <SelectTrigger className="w-36" data-testid={`select-url-hide-condition-${index}`}>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="contains">URL contains</SelectItem>
                                                <SelectItem value="equals">URL equals</SelectItem>
                                                <SelectItem value="starts">URL starts with</SelectItem>
                                                <SelectItem value="ends">URL ends with</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <Input
                                              value={rule.value}
                                              onChange={(e) => {
                                                const newRules = [...(widget.targeting?.urlRules || [])];
                                                newRules[index] = { ...rule, value: e.target.value };
                                                updateLocalWidget({
                                                  targeting: { ...widget.targeting, urlRules: newRules }
                                                });
                                              }}
                                              placeholder="/checkout"
                                              className="flex-1"
                                              data-testid={`input-url-hide-value-${index}`}
                                            />
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => {
                                                const newRules = (widget.targeting?.urlRules || []).filter((_, i) => i !== index);
                                                if (newRules.length === 0) {
                                                  newRules.push({ condition: "contains", value: "" });
                                                }
                                                updateLocalWidget({
                                                  targeting: { ...widget.targeting, urlRules: newRules }
                                                });
                                              }}
                                              data-testid={`button-delete-hide-rule-${index}`}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                      <Button
                                        variant="ghost"
                                        className="text-blue-500 h-auto p-0 hover:bg-transparent"
                                        onClick={() => {
                                          updateLocalWidget({
                                            targeting: {
                                              ...widget.targeting,
                                              urlRules: [...(widget.targeting?.urlRules || []), { condition: "contains", value: "" }]
                                            }
                                          });
                                        }}
                                        data-testid="button-add-hide-rule"
                                      >
                                        + Add rule
                                      </Button>
                                    </div>
                                  )}
                                </RadioGroup>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="device-type" className="border rounded-lg">
                          <AccordionTrigger className="hover:no-underline px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Monitor className="h-5 w-5 text-blue-500" />
                              <span className="text-sm font-medium">Device type</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-4">
                              <p className="text-sm text-slate-500">Choose which type of visitors should see your widget</p>
                              
                              <RadioGroup 
                                value={(widget.targeting?.deviceType || "all")}
                                onValueChange={(v) => updateLocalWidget({ 
                                  targeting: { ...widget.targeting, deviceType: v as "all" | "desktop" | "mobile" } 
                                })}
                                className="space-y-2"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="all" id="device-all" />
                                  <Label htmlFor="device-all" className="text-sm cursor-pointer">Show on all devices</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="desktop" id="device-desktop" />
                                  <Label htmlFor="device-desktop" className="text-sm cursor-pointer">Desktop devices only</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="mobile" id="device-mobile" />
                                  <Label htmlFor="device-mobile" className="text-sm cursor-pointer">Mobile devices only</Label>
                                </div>
                              </RadioGroup>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="embed-code" className="border-b">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                          <Code className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Embed code</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Embed the online widget into your website.</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6">
                      <div className="space-y-4 pl-12">
                        <div>
                          <h4 className="text-sm font-medium mb-1">Install Curbe code to your website</h4>
                          <p className="text-xs text-slate-500 mb-3">
                            Copy the code below and add it to your website before the closing <code className="text-blue-600">&lt;/body&gt;</code> tag.
                          </p>
                          <div className="relative">
                            <pre className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs overflow-x-auto border">
                              <code className="text-slate-700 dark:text-slate-300">{embedCode}</code>
                            </pre>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleCopyCode}
                            data-testid="button-copy-code"
                          >
                            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                            {copied ? "Copied" : "Copy code"}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setLocation(`/settings/chat-widget/${widgetId}/preview`)}
                            data-testid="button-view-test"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View test page
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            data-testid="button-send-instructions"
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Send instructions
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>

          <div className="w-full lg:w-[520px] shrink-0">
            <Card className="border-slate-200 dark:border-slate-800 sticky top-6">
              <CardContent className="p-6">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-5">Widget preview</h3>
                
                {appearanceSubAccordion === "minimized-state" ? (
                  <div className="relative bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden min-h-[450px]">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM5NDk0OTQiIGZpbGwtb3BhY2l0eT0iMC4wOCI+PHBhdGggZD0iTTAgMGgyMHYyMEgwek0yMCAyMGgyMHYyMEgyMHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
                    
                    <div className="relative h-full p-5 flex flex-col">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-400" />
                          <div className="w-3 h-3 rounded-full bg-yellow-400" />
                          <div className="w-3 h-3 rounded-full bg-green-400" />
                          <div className="flex-1 h-6 bg-slate-200 dark:bg-slate-700 rounded ml-4" />
                        </div>
                        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                        <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="space-y-4 mt-6">
                          <div className="flex gap-3">
                            <div className="w-14 h-14 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="flex-1 h-24 bg-slate-200 dark:bg-slate-700 rounded" />
                          </div>
                          <div className="space-y-2">
                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                          </div>
                          <div className="flex gap-3">
                            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                              <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700 rounded" />
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                              <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div 
                        className="absolute flex flex-col items-end gap-2"
                        style={{ 
                          [widget.minimizedState?.alignTo === "left" ? "left" : "right"]: `${widget.minimizedState?.sideSpacing || 32}px`,
                          bottom: `${widget.minimizedState?.bottomSpacing || 26}px`,
                          alignItems: widget.minimizedState?.alignTo === "left" ? "flex-start" : "flex-end"
                        }}
                      >
                        {widget.minimizedState?.eyeCatcherEnabled && (
                          <div className="bg-white dark:bg-slate-900 shadow-lg rounded-full px-3 py-2 relative flex items-center gap-2 whitespace-nowrap">
                            <span className="text-xs text-slate-700 dark:text-slate-300">
                              {widget.minimizedState?.eyeCatcherMessage || "Hello, how can we help?"}
                            </span>
                            <button className="w-4 h-4 bg-white dark:bg-slate-800 rounded-full shadow flex items-center justify-center flex-shrink-0">
                              <X className="h-2.5 w-2.5 text-slate-400" />
                            </button>
                          </div>
                        )}
                        
                        <div 
                          className="flex items-center gap-2 shadow-xl cursor-pointer transition-transform hover:scale-105"
                          style={{ 
                            background: currentBackground,
                            borderRadius: `${widget.minimizedState?.borderRadius || 40}px`,
                            padding: widget.minimizedState?.includeButtonText ? "14px 22px" : "18px"
                          }}
                        >
                          {widget.minimizedState?.icon === "message" ? (
                            <MessageCircle className="h-7 w-7 text-white" />
                          ) : widget.minimizedState?.icon === "phone" ? (
                            <Phone className="h-7 w-7 text-white" />
                          ) : widget.minimizedState?.icon === "email" ? (
                            <Mail className="h-7 w-7 text-white" />
                          ) : (
                            <MessageSquare className="h-7 w-7 text-white" />
                          )}
                          {widget.minimizedState?.includeButtonText && widget.minimizedState?.buttonText && (
                            <span className="text-white font-medium text-base">{widget.minimizedState.buttonText}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : expandedChannel === "liveChat" && activeLiveChatSubSection === "welcomeScreen" ? (
                  <div className="relative">
                    <div className="rounded-xl overflow-hidden shadow-lg" style={{ background: currentBackground }}>
                      <div className="p-6 text-white">
                        {widget.branding?.customLogo && (
                          <img 
                            src={widget.branding.customLogo} 
                            alt="Logo" 
                            className="h-10 w-auto mb-4 rounded"
                          />
                        )}
                        <h4 className="text-2xl font-bold">{widget.welcomeTitle}</h4>
                        <p className="text-base opacity-90 mt-3">{widget.welcomeMessage}</p>
                      </div>
                      
                      <div className="bg-white dark:bg-slate-900 p-5 space-y-4">
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border-2 border-blue-400 ring-2 ring-blue-100">
                          <h5 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                            How can we help you today?
                          </h5>
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs text-slate-500 font-medium">
                                {widget.liveChatSettings?.welcomeScreen?.fieldLabel || "Message"}
                              </Label>
                              <Textarea placeholder="Type your message here" disabled className="mt-1" rows={3} />
                            </div>
                          </div>
                          <Button className="w-full mt-3" style={{ background: currentBackground }}>
                            {widget.liveChatSettings?.welcomeScreen?.buttonLabel || "Start chat"}
                          </Button>
                        </div>
                        
                        {widget.channels?.sms?.enabled && (
                          <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                              <MessageSquare className="h-5 w-5 text-blue-500" />
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Send a text</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                        
                        {widget.channels?.phone?.enabled && (
                          <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                              <Phone className="h-5 w-5 text-green-500" />
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Call us</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                        
                        <div className="text-center pt-2">
                          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                            Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : expandedChannel === "liveChat" && activeLiveChatSubSection === "queueSettings" ? (
                  <div className="relative">
                    <div className="rounded-xl overflow-hidden shadow-lg">
                      <div className="p-4 text-white flex items-center justify-between" style={{ background: currentBackground }}>
                        <div className="flex items-center gap-2">
                          <ChevronLeft className="h-5 w-5" />
                          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: currentBackground }}>
                            <MessageCircle className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <span className="font-medium">Live chat</span>
                          </div>
                        </div>
                        <MoreVertical className="h-5 w-5" />
                      </div>
                      
                      <div className="bg-slate-100 dark:bg-slate-800 p-4 space-y-3" style={{ minHeight: "280px" }}>
                        <div className="flex justify-end">
                          <div className="bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
                            <p className="text-xs mb-1"><strong>Name:</strong> Patrick Wellner</p>
                            <p className="text-xs mb-1"><strong>Email:</strong> pwellner@gmail.com</p>
                            <p className="text-xs"><strong>Message:</strong> How can I get more info about the pricing?</p>
                            <p className="text-[10px] text-blue-100 text-right mt-1">1:34 pm</p>
                          </div>
                        </div>
                        
                        <div className="flex justify-start">
                          <div className="bg-white dark:bg-slate-700 rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%] shadow-sm">
                            <p className="text-sm text-slate-700 dark:text-slate-200">
                              {widget.liveChatSettings?.queueSettings?.autoReplyMessage || "Thank you, we have received your request."}
                            </p>
                            <p className="text-[10px] text-slate-400 text-right mt-1">1:34 pm</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center py-4">
                          <p className="text-xs text-slate-500">Searching for available agents...</p>
                          <div className="mt-2 animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                        </div>
                      </div>
                      
                      <div className="bg-white dark:bg-slate-900 p-3 border-t flex items-center gap-2">
                        <Input placeholder="Type your message here..." disabled className="flex-1" />
                        <Button size="icon" style={{ background: currentBackground }}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="bg-white dark:bg-slate-900 py-2 text-center border-t">
                        <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                          Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
                        </p>
                      </div>
                    </div>
                  </div>
                ) : expandedChannel === "liveChat" && activeLiveChatSubSection === "satisfactionSurvey" ? (
                  <div className="relative">
                    <div className="rounded-xl overflow-hidden shadow-lg">
                      <div className="p-4 text-white flex items-center justify-between" style={{ background: currentBackground }}>
                        <div className="flex items-center gap-2">
                          <ChevronLeft className="h-5 w-5" />
                          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: currentBackground }}>
                            <MessageCircle className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <span className="font-medium">Live chat</span>
                            <p className="text-xs opacity-75">Chat has ended</p>
                          </div>
                        </div>
                        <MoreVertical className="h-5 w-5" />
                      </div>
                      
                      <div className="bg-slate-100 dark:bg-slate-800 p-4 space-y-3" style={{ minHeight: "200px" }}>
                        <div className="flex justify-end">
                          <div className="bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
                            <p className="text-xs mb-1"><strong>Name:</strong> Patrick Wellner</p>
                            <p className="text-xs mb-1"><strong>Email:</strong> pwellner@gmail.com</p>
                            <p className="text-xs"><strong>Message:</strong> How can I get more info about the pricing?</p>
                            <p className="text-[10px] text-blue-100 text-right mt-1">1:36 pm</p>
                          </div>
                        </div>
                        
                        <div className="flex justify-start">
                          <div className="bg-white dark:bg-slate-700 rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%] shadow-sm">
                            <p className="text-sm text-slate-700 dark:text-slate-200">
                              {widget.liveChatSettings?.queueSettings?.autoReplyMessage || "Thank you, we have received your request."}
                            </p>
                            <p className="text-[10px] text-slate-400 text-right mt-1">1:36 pm</p>
                          </div>
                        </div>
                        
                        <div className="text-center py-1">
                          <span className="text-xs text-slate-500 bg-white dark:bg-slate-700 px-3 py-1 rounded-full">Markus Harris joined chat <span className="text-slate-400">1:36 pm</span></span>
                        </div>
                        
                        <div className="flex justify-start">
                          <div className="bg-white dark:bg-slate-700 rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%] shadow-sm">
                            <p className="text-xs font-medium text-slate-600 mb-1">Markus Harris</p>
                            <p className="text-sm text-slate-700 dark:text-slate-200">Hello Patrick, I can definitely help you with this.</p>
                            <p className="text-[10px] text-slate-400 text-right mt-1">1:36 pm</p>
                          </div>
                        </div>
                      </div>
                      
                      {widget.liveChatSettings?.satisfactionSurvey?.enabled && (
                        <div className="bg-white dark:bg-slate-900 p-4 border-t">
                          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-lg border">
                            <h5 className="font-semibold text-slate-900 dark:text-slate-100 text-center mb-2">How was the help you received?</h5>
                            <p className="text-xs text-slate-500 text-center mb-4">We're always striving to improve and would love your feedback on the experience.</p>
                            <div className="flex justify-center gap-6 mb-3">
                              <button className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center hover:scale-110 transition-transform">
                                <ThumbsUp className="h-7 w-7 text-green-500" />
                              </button>
                              <button className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center hover:scale-110 transition-transform">
                                <ThumbsDown className="h-7 w-7 text-red-500" />
                              </button>
                            </div>
                            <p className="text-xs text-blue-500 text-center cursor-pointer hover:underline">Skip for now</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-white dark:bg-slate-900 py-2 text-center border-t">
                        <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                          Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
                        </p>
                      </div>
                    </div>
                  </div>
                ) : expandedChannel === "liveChat" && activeLiveChatSubSection === "offlineMode" ? (
                  <div className="relative">
                    <div className="rounded-xl overflow-hidden shadow-lg">
                      <div className="p-4 text-white flex items-center justify-between" style={{ background: currentBackground }}>
                        <div className="flex items-center gap-2">
                          <ChevronLeft className="h-5 w-5" />
                          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: currentBackground }}>
                            <MessageCircle className="h-4 w-4 text-white" />
                          </div>
                          <span className="font-medium">Live chat</span>
                        </div>
                      </div>
                      
                      <div className="bg-slate-100 dark:bg-slate-800 p-4 space-y-3" style={{ minHeight: "200px" }}>
                        <div className="flex justify-end">
                          <div className="bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
                            <p className="text-xs mb-1"><strong>Name:</strong> Patrick Wellner</p>
                            <p className="text-xs mb-1"><strong>Email:</strong> pwellner@gmail.com</p>
                            <p className="text-xs"><strong>Message:</strong> How can I get more info about the pricing?</p>
                            <p className="text-[10px] text-blue-100 text-right mt-1">1:36 pm</p>
                          </div>
                        </div>
                        
                        <div className="flex justify-start">
                          <div className="bg-white dark:bg-slate-700 rounded-2xl rounded-tl-sm px-4 py-2 max-w-[85%] shadow-sm">
                            <p className="text-sm text-slate-700 dark:text-slate-200">
                              {widget.liveChatSettings?.offlineMode?.offlineMessage || "We have received your request. Unfortunately, all our agents are currently offline. We will reply to your email as soon as possible. Thank you for your patience!"}
                            </p>
                            <p className="text-[10px] text-slate-400 text-right mt-1">1:36 pm</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white dark:bg-slate-900 p-4 border-t">
                        <Button className="w-full" style={{ background: currentBackground }}>
                          Close this window
                        </Button>
                      </div>
                      
                      <div className="bg-white dark:bg-slate-900 py-2 text-center border-t">
                        <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                          Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
                        </p>
                      </div>
                    </div>
                  </div>
                ) : expandedChannel === "liveChat" && activeLiveChatSubSection === "preChatForm" ? (
                  <div className="relative">
                    <div className="rounded-xl overflow-hidden shadow-lg" style={{ background: currentBackground }}>
                      <div className="p-6 text-white">
                        {widget.branding?.customLogo && (
                          <img 
                            src={widget.branding.customLogo} 
                            alt="Logo" 
                            className="h-10 w-auto mb-4 rounded"
                          />
                        )}
                        <h4 className="text-2xl font-bold">{widget.welcomeTitle}</h4>
                        <p className="text-base opacity-90 mt-3">{widget.welcomeMessage}</p>
                      </div>
                      
                      <div className="bg-white dark:bg-slate-900 p-5 space-y-4">
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                          <h5 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                            {widget.liveChatSettings?.preChatForm?.title || "Chat with our agent"}
                          </h5>
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs text-slate-500">
                                Name {widget.liveChatSettings?.preChatForm?.nameFieldRequired && <span className="text-red-500">*</span>}
                              </Label>
                              <Input placeholder="Enter your full name" disabled className="mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs text-slate-500">
                                Email {widget.liveChatSettings?.preChatForm?.emailFieldRequired && <span className="text-red-500">*</span>}
                              </Label>
                              <Input placeholder="Enter your email address" disabled className="mt-1" />
                            </div>
                          </div>
                          <Button className="w-full mt-3" style={{ background: currentBackground }}>
                            {widget.liveChatSettings?.preChatForm?.buttonLabel || "Start chat"}
                          </Button>
                        </div>
                        
                        <button className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
                          <ChevronLeft className="h-4 w-4" />
                          Select another channel
                        </button>
                        
                        <div className="text-center pt-2">
                          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                            Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : expandedChannel === "liveChat" ? (
                  <div className="relative">
                    <div className="rounded-xl overflow-hidden shadow-lg" style={{ background: currentBackground }}>
                      <div className="p-6 text-white">
                        {widget.branding?.customLogo && (
                          <img 
                            src={widget.branding.customLogo} 
                            alt="Logo" 
                            className="h-10 w-auto mb-4 rounded"
                          />
                        )}
                        <h4 className="text-2xl font-bold">{widget.welcomeTitle}</h4>
                        <p className="text-base opacity-90 mt-3">{widget.welcomeMessage}</p>
                      </div>
                      
                      <div className="bg-white dark:bg-slate-900 p-5 space-y-4">
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                          <h5 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                            How can we help you today?
                          </h5>
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs text-slate-500">
                                {widget.liveChatSettings?.welcomeScreen?.fieldLabel || "Message"}
                              </Label>
                              <Textarea placeholder="Type your message here" disabled className="mt-1" rows={3} />
                            </div>
                          </div>
                          <Button className="w-full mt-3" style={{ background: currentBackground }}>
                            {widget.liveChatSettings?.welcomeScreen?.buttonLabel || "Start chat"}
                          </Button>
                        </div>
                        
                        {widget.channels?.sms?.enabled && (
                          <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                              <MessageSquare className="h-5 w-5 text-blue-500" />
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Send a text</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                        
                        {widget.channels?.phone?.enabled && (
                          <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                              <Phone className="h-5 w-5 text-green-500" />
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Call us</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                        
                        {widget.channels?.whatsapp?.enabled && (
                          <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                              <SiWhatsapp className="h-5 w-5 text-[#25D366]" />
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">WhatsApp</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                        
                        {widget.channels?.email?.enabled && (
                          <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                              <Mail className="h-5 w-5 text-orange-500" />
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Email us</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                        
                        <div className="text-center pt-2">
                          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                            Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : expandedChannel === "phone" ? (
                  <div className="relative">
                    <div className="rounded-xl overflow-hidden shadow-lg">
                      <div className="p-4 text-white" style={{ background: currentBackground }}>
                        <div className="flex items-center gap-2 mb-3">
                          <ChevronLeft className="h-5 w-5" />
                          <Phone className="h-5 w-5" />
                          <span className="font-medium">Call us</span>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-5 space-y-4">
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center">
                          {widget.callSettings?.callUsScreen?.title || "Speak with an agent"}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
                          {widget.callSettings?.callUsScreen?.description || "Have an urgent matter? Please call us, and a dedicated agent will be available to help you."}
                        </p>
                        <div className="text-center">
                          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                            {formatPhoneNumber(
                              widget.callSettings?.numberSettings?.numberType === "custom"
                                ? widget.callSettings?.numberSettings?.customNumber
                                : widget.callSettings?.numberSettings?.selectedConnectedNumber || "+1 833 221 4494"
                            )}
                          </p>
                        </div>
                        <Button className="w-full" style={{ background: currentBackground }}>
                          <Phone className="h-4 w-4 mr-2" />
                          {widget.callSettings?.callUsScreen?.buttonLabel || "Call now"}
                        </Button>
                        {widget.callSettings?.callUsScreen?.showQRCode && (
                          <>
                            <p className="text-xs text-slate-500 text-center mt-2">
                              Call charges and data fees may apply according to your carrier's rates.
                            </p>
                            <div className="flex justify-center py-4">
                              <div className="relative">
                                <div className="absolute -top-1 -left-1 w-5 h-5 border-l-2 border-t-2 border-slate-300 rounded-tl-lg"></div>
                                <div className="absolute -top-1 -right-1 w-5 h-5 border-r-2 border-t-2 border-slate-300 rounded-tr-lg"></div>
                                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-l-2 border-b-2 border-slate-300 rounded-bl-lg"></div>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-r-2 border-b-2 border-slate-300 rounded-br-lg"></div>
                                <div className="p-2">
                                  <QRCodeDisplay 
                                    value={`tel:${(widget.callSettings?.numberSettings?.numberType === "custom"
                                      ? widget.callSettings?.numberSettings?.customNumber
                                      : widget.callSettings?.numberSettings?.selectedConnectedNumber || "+18332214494"
                                    ).replace(/[\s()-]/g, '')}`}
                                    size={160}
                                    logoUrl={curbeLogo}
                                    logoBackgroundColor={colorOptions.find(c => c.value === widget.colorTheme)?.hex || "#3B82F6"}
                                  />
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-slate-500 text-center">Scan QR code for quick dial</p>
                          </>
                        )}
                        <div className="text-center pt-2">
                          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                            Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : expandedChannel === "whatsapp" ? (
                  <div className="relative">
                    <div className="rounded-xl overflow-hidden shadow-lg">
                      <div className="p-4 text-white" style={{ background: currentBackground }}>
                        <div className="flex items-center gap-2">
                          <ChevronLeft className="h-5 w-5" />
                          <SiWhatsapp className="h-5 w-5" />
                          <span className="font-medium">{widget.whatsappSettings?.welcomeScreen?.channelName || "Chat on WhatsApp"}</span>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-5 space-y-4">
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {widget.whatsappSettings?.messageScreen?.title || "Message us on WhatsApp"}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {widget.whatsappSettings?.messageScreen?.description || "Click the button below or scan the QR code to send a message to this WhatsApp number."}
                        </p>
                        <div className="text-center">
                          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                            {formatPhoneNumber(widget.whatsappSettings?.numberSettings?.customNumber || "+1 786 630 2522")}
                          </p>
                        </div>
                        <Button className="w-full" style={{ background: currentBackground }}>
                          {widget.whatsappSettings?.messageScreen?.buttonLabel || "Open chat"}
                        </Button>
                        {widget.whatsappSettings?.messageScreen?.showQRCode && (
                          <>
                            <div className="flex justify-center py-4">
                              <div className="relative">
                                <div className="absolute -top-1 -left-1 w-5 h-5 border-l-2 border-t-2 border-slate-300 rounded-tl-lg"></div>
                                <div className="absolute -top-1 -right-1 w-5 h-5 border-r-2 border-t-2 border-slate-300 rounded-tr-lg"></div>
                                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-l-2 border-b-2 border-slate-300 rounded-bl-lg"></div>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-r-2 border-b-2 border-slate-300 rounded-br-lg"></div>
                                <div className="p-2">
                                  <QRCodeDisplay 
                                    value={`https://wa.me/${widget.whatsappSettings?.numberSettings?.customNumber?.replace(/[\s()+\-]/g, '') || '17866302522'}`}
                                    size={160}
                                  />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white p-1.5 rounded-full border-2" style={{ borderColor: typeof currentBackground === 'string' && currentBackground.startsWith('#') ? currentBackground : '#3B82F6' }}>
                                    <SiWhatsapp className="h-5 w-5" style={{ color: typeof currentBackground === 'string' && currentBackground.startsWith('#') ? currentBackground : '#3B82F6' }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 text-center">Scan QR code to open a chat</p>
                          </>
                        )}
                        <div className="text-center pt-2">
                          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                            Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : expandedChannel === "email" && activeEmailSubSection === "successScreen" ? (
                  <div className="relative">
                    <div className="rounded-xl overflow-hidden shadow-lg">
                      <div className="p-4 text-white" style={{ background: currentBackground }}>
                        <div className="flex items-center gap-2">
                          <ChevronLeft className="h-5 w-5" />
                          <Mail className="h-5 w-5" />
                          <span className="font-medium">{widget.emailSettings?.welcomeScreen?.channelName || "Send an email"}</span>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-6 space-y-4">
                        <div className="flex justify-center py-4">
                          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                            <Check className="h-8 w-8 text-green-500" />
                          </div>
                        </div>
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center">
                          {widget.emailSettings?.successScreen?.title || "We have received your email"}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
                          {widget.emailSettings?.successScreen?.description || "We will respond to your email shortly."}
                        </p>
                        <Button className="w-full" style={{ background: currentBackground }}>
                          Close this window
                        </Button>
                        <button className="w-full text-center text-sm text-blue-500 hover:text-blue-600">
                          Start over
                        </button>
                        <div className="text-center pt-2">
                          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                            Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : expandedChannel === "email" ? (
                  <div className="relative">
                    <div className="rounded-xl overflow-hidden shadow-lg">
                      <div className="p-4 text-white" style={{ background: currentBackground }}>
                        <div className="flex items-center gap-2 mb-3">
                          <ChevronLeft className="h-5 w-5" />
                          <Mail className="h-5 w-5" />
                          <span className="font-medium">{widget.emailSettings?.welcomeScreen?.channelName || "Email"}</span>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-5 space-y-4">
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {widget.emailSettings?.formFields?.title || "Send us an email"}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {widget.emailSettings?.formFields?.description || "Fill out the form below and we'll get back to you."}
                        </p>
                        <div className="space-y-3">
                          {widget.emailSettings?.formFields?.nameFieldEnabled && (
                            <div>
                              <Label className="text-xs text-slate-500">
                                Name {widget.emailSettings?.formFields?.nameFieldEnabled && widget.emailSettings?.formFields?.nameFieldRequired && <span className="text-red-500">*</span>}
                              </Label>
                              <Input placeholder="Your name" disabled className="mt-1" />
                            </div>
                          )}
                          {widget.emailSettings?.formFields?.emailFieldEnabled && (
                            <div>
                              <Label className="text-xs text-slate-500">
                                Email {widget.emailSettings?.formFields?.emailFieldEnabled && widget.emailSettings?.formFields?.emailFieldRequired && <span className="text-red-500">*</span>}
                              </Label>
                              <Input placeholder="your@email.com" disabled className="mt-1" />
                            </div>
                          )}
                          {widget.emailSettings?.formFields?.messageFieldEnabled && (
                            <div>
                              <Label className="text-xs text-slate-500">
                                Message {widget.emailSettings?.formFields?.messageFieldEnabled && widget.emailSettings?.formFields?.messageFieldRequired && <span className="text-red-500">*</span>}
                              </Label>
                              <Textarea placeholder="Your message..." disabled className="mt-1" rows={3} />
                            </div>
                          )}
                        </div>
                        <Button className="w-full" style={{ background: currentBackground }}>
                          {widget.emailSettings?.formFields?.buttonLabel || "Send message"}
                        </Button>
                        <div className="text-center pt-2">
                          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                            Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : expandedChannel === "sms" && activeSmsSubSection === "messageScreen" ? (
                  <div className="relative">
                    <div className="rounded-xl overflow-hidden shadow-lg">
                      <div className="p-4 text-white" style={{ background: currentBackground }}>
                        <div className="flex items-center gap-2">
                          <ChevronLeft className="h-5 w-5" />
                          <MessageSquare className="h-5 w-5" />
                          <span className="font-medium">{widget.smsSettings?.welcomeScreen?.channelName || "Text us"}</span>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-5 space-y-4">
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {widget.smsSettings?.messageScreen?.title || "Send us a text message"}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {widget.smsSettings?.messageScreen?.description || "Click the button below to send us an SMS and we'll respond as soon as possible."}
                        </p>
                        <div className="text-center">
                          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                            {formatPhoneNumber(widget.smsSettings?.numberSettings?.numberType === "custom" 
                              ? (widget.smsSettings?.numberSettings?.customNumber || "+1 833 221 4494")
                              : (widget.smsSettings?.numberSettings?.connectedNumber || companyNumbers[0]?.phoneNumber || "+1 833 221 4494")
                            )}
                          </p>
                        </div>
                        <Button className="w-full" style={{ background: currentBackground }}>
                          {widget.smsSettings?.messageScreen?.buttonLabel || "Send SMS"}
                        </Button>
                        {(widget.smsSettings?.messageScreen?.showQRCode ?? true) && (
                          <>
                            <div className="flex justify-center py-4">
                              <div className="relative">
                                <div className="absolute -top-1 -left-1 w-5 h-5 border-l-2 border-t-2 border-slate-300 rounded-tl-lg"></div>
                                <div className="absolute -top-1 -right-1 w-5 h-5 border-r-2 border-t-2 border-slate-300 rounded-tr-lg"></div>
                                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-l-2 border-b-2 border-slate-300 rounded-bl-lg"></div>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-r-2 border-b-2 border-slate-300 rounded-br-lg"></div>
                                <div className="p-2">
                                  <QRCodeDisplay 
                                    value={`sms:${widget.smsSettings?.numberSettings?.numberType === "custom" 
                                      ? widget.smsSettings?.numberSettings?.customNumber?.replace(/[\s()\-]/g, '') || '+18332214494'
                                      : (widget.smsSettings?.numberSettings?.connectedNumber || companyNumbers[0]?.phoneNumber || '+18332214494').replace(/[\s()\-]/g, '')}`}
                                    size={160}
                                  />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white p-1.5 rounded-full border-2" style={{ borderColor: typeof currentBackground === 'string' && currentBackground.startsWith('#') ? currentBackground : '#3B82F6' }}>
                                    <MessageSquare className="h-5 w-5" style={{ color: typeof currentBackground === 'string' && currentBackground.startsWith('#') ? currentBackground : '#3B82F6' }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 text-center">Scan QR code to send a text</p>
                          </>
                        )}
                        <div className="text-center pt-2">
                          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                            Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : expandedChannel === "sms" ? (
                  <div className="relative">
                    <div className="rounded-xl overflow-hidden shadow-lg">
                      <div className="p-4 text-white" style={{ background: currentBackground }}>
                        <div className="flex items-center gap-2">
                          <ChevronLeft className="h-5 w-5" />
                          <MessageSquare className="h-5 w-5" />
                          <span className="font-medium">{widget.smsSettings?.welcomeScreen?.channelName || "Text us"}</span>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-5 space-y-4">
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {widget.smsSettings?.messageScreen?.title || "Send us a text message"}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {widget.smsSettings?.messageScreen?.description || "Click the button below to send us an SMS and we'll respond as soon as possible."}
                        </p>
                        <div className="text-center">
                          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                            {formatPhoneNumber(widget.smsSettings?.numberSettings?.numberType === "custom" 
                              ? (widget.smsSettings?.numberSettings?.customNumber || "+1 833 221 4494")
                              : (widget.smsSettings?.numberSettings?.connectedNumber || companyNumbers[0]?.phoneNumber || "+1 833 221 4494")
                            )}
                          </p>
                        </div>
                        <Button className="w-full" style={{ background: currentBackground }}>
                          {widget.smsSettings?.messageScreen?.buttonLabel || "Send SMS"}
                        </Button>
                        {(widget.smsSettings?.messageScreen?.showQRCode ?? true) && (
                          <>
                            <div className="flex justify-center py-4">
                              <div className="relative">
                                <div className="absolute -top-1 -left-1 w-5 h-5 border-l-2 border-t-2 border-slate-300 rounded-tl-lg"></div>
                                <div className="absolute -top-1 -right-1 w-5 h-5 border-r-2 border-t-2 border-slate-300 rounded-tr-lg"></div>
                                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-l-2 border-b-2 border-slate-300 rounded-bl-lg"></div>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-r-2 border-b-2 border-slate-300 rounded-br-lg"></div>
                                <div className="p-2">
                                  <QRCodeDisplay 
                                    value={`sms:${widget.smsSettings?.numberSettings?.numberType === "custom" 
                                      ? widget.smsSettings?.numberSettings?.customNumber?.replace(/[\s()\-]/g, '') || '+18332214494'
                                      : (widget.smsSettings?.numberSettings?.connectedNumber || companyNumbers[0]?.phoneNumber || '+18332214494').replace(/[\s()\-]/g, '')}`}
                                    size={160}
                                  />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white p-1.5 rounded-full border-2" style={{ borderColor: typeof currentBackground === 'string' && currentBackground.startsWith('#') ? currentBackground : '#3B82F6' }}>
                                    <MessageSquare className="h-5 w-5" style={{ color: typeof currentBackground === 'string' && currentBackground.startsWith('#') ? currentBackground : '#3B82F6' }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 text-center">Scan QR code to send a text</p>
                          </>
                        )}
                        <div className="text-center pt-2">
                          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                            Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : expandedChannel === "facebook" ? (
                  <div className="relative">
                    <div className="rounded-xl overflow-hidden shadow-lg">
                      <div className="p-4 text-white" style={{ background: currentBackground }}>
                        <div className="flex items-center gap-2 mb-3">
                          <ChevronLeft className="h-5 w-5" />
                          <SiFacebook className="h-5 w-5" />
                          <span className="font-medium">{widget.messengerSettings?.welcomeScreen?.channelName || "Messenger"}</span>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-5 space-y-4">
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {widget.messengerSettings?.pageSettings?.title || "Message us on Facebook"}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {widget.messengerSettings?.pageSettings?.description || "Click the button below to start a Messenger conversation."}
                        </p>
                        <Button className="w-full bg-[#0866FF] hover:bg-[#0756d4]">
                          <SiFacebook className="h-4 w-4 mr-2" />
                          {widget.messengerSettings?.pageSettings?.buttonLabel || "Open Messenger"}
                        </Button>
                        <div className="text-center pt-2">
                          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                            Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : expandedChannel === "instagram" ? (
                  <div className="relative">
                    <div className="rounded-xl overflow-hidden shadow-lg">
                      <div className="p-4 text-white" style={{ background: currentBackground }}>
                        <div className="flex items-center gap-2 mb-3">
                          <ChevronLeft className="h-5 w-5" />
                          <SiInstagram className="h-5 w-5" />
                          <span className="font-medium">{widget.instagramSettings?.welcomeScreen?.channelName || "Instagram"}</span>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-5 space-y-4">
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {widget.instagramSettings?.profileSettings?.title || "Message us on Instagram"}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {widget.instagramSettings?.profileSettings?.description || "Click the button below to send us a direct message."}
                        </p>
                        <Button className="w-full bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90">
                          <SiInstagram className="h-4 w-4 mr-2" />
                          {widget.instagramSettings?.profileSettings?.buttonLabel || "Open Instagram"}
                        </Button>
                        <div className="text-center pt-2">
                          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                            Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div 
                      className="rounded-xl overflow-hidden shadow-lg"
                      style={{ 
                        background: currentBackground
                      }}
                    >
                      <div className="p-6 text-white">
                        {widget.branding?.customLogo && (
                          <img 
                            src={widget.branding.customLogo} 
                            alt="Logo" 
                            className="h-10 w-auto mb-4 rounded"
                          />
                        )}
                        <h4 className="text-2xl font-bold">{widget.welcomeTitle}</h4>
                        <p className="text-base opacity-90 mt-3">{widget.welcomeMessage}</p>
                      </div>
                      
                      <div className="bg-white dark:bg-slate-900 p-5 space-y-4">
                        {widget.channels.liveChat && (
                          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
                            <h5 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                              {widget.liveChatSettings?.preChatForm?.title || "How can we help you today?"}
                            </h5>
                            <Textarea 
                              placeholder="Type your message here" 
                              disabled 
                              className="mb-3 resize-none" 
                              rows={3} 
                            />
                            <Button className="w-full" style={{ background: currentBackground }}>
                              {widget.liveChatSettings?.preChatForm?.buttonLabel || widget.liveChatSettings?.welcomeScreen?.buttonLabel || "Start chat"}
                            </Button>
                          </div>
                        )}
                        
                        {(widget.channelOrder || channelConfigs.map(c => c.id)).filter(channelId => {
                          if (channelId === "liveChat") return false;
                          const channelKey = channelId === "phone" ? "phone" : 
                                            channelId === "email" ? "email" :
                                            channelId === "sms" ? "sms" :
                                            channelId === "whatsapp" ? "whatsapp" :
                                            channelId === "facebook" ? "facebook" :
                                            channelId === "instagram" ? "instagram" : null;
                          return channelKey && widget.channels[channelKey as keyof typeof widget.channels];
                        }).map((channelId) => {
                          const config = channelConfigs.find(c => c.id === channelId);
                          if (!config) return null;
                          
                          const getChannelLabel = () => {
                            switch (channelId) {
                              case "phone": return "Call us";
                              case "whatsapp": return widget.whatsappSettings?.welcomeScreen?.channelName || "WhatsApp";
                              case "email": return widget.emailSettings?.welcomeScreen?.channelName || "Email";
                              case "sms": return widget.smsSettings?.welcomeScreen?.channelName || "Send a text";
                              case "facebook": return widget.messengerSettings?.welcomeScreen?.channelName || "Messenger";
                              case "instagram": return widget.instagramSettings?.welcomeScreen?.channelName || "Instagram";
                              default: return config.label;
                            }
                          };
                          
                          return (
                            <div key={channelId} className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                              <div className="flex items-center gap-3">
                                <span className={config.iconColor}>{config.icon}</span>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{getChannelLabel()}</span>
                              </div>
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            </div>
                          );
                        })}
                        
                        <div className="text-center pt-2">
                          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                            Powered by <a href="https://curbe.io" target="_blank" rel="noopener noreferrer"><img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" /></a>
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div 
                      className="absolute -bottom-16 right-0 flex items-center justify-center rounded-full shadow-xl cursor-pointer"
                      style={{ 
                        background: currentBackground,
                        width: "56px",
                        height: "56px"
                      }}
                    >
                      <ChevronDown className="h-6 w-6 text-white" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={editNameDialogOpen} onOpenChange={setEditNameDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-edit-name">
          <DialogHeader>
            <DialogTitle>Edit widget name</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm font-medium">
                Widget name
              </Label>
              <Input
                id="edit-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                data-testid="input-edit-name"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditNameDialogOpen(false)}
              data-testid="button-cancel-rename"
            >
              Cancel
            </Button>
            <Button
              onClick={() => renameMutation.mutate(newName)}
              disabled={renameMutation.isPending || !newName.trim()}
              data-testid="button-save-name"
            >
              {renameMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hasUnsavedChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-lg z-50">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              You have unsaved changes
            </p>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDiscardChanges}
                data-testid="button-discard-changes"
              >
                Discard
              </Button>
              <Button 
                size="sm" 
                onClick={handleSaveChanges}
                disabled={updateMutation.isPending}
                data-testid="button-save-changes"
              >
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
