import { useState, useCallback, useEffect, useMemo } from "react";
import { Switch, Route, useLocation, Link, Redirect } from "wouter";
import { queryClient, getCompanyQueryOptions, apiRequest } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ProtectedRoute } from "@/components/protected-route";

// Component to block agents from accessing certain routes (like Billing)
function AgentBlockedRoute({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: sessionData } = useQuery<{ user: User }>({ queryKey: ["/api/session"] });
  
  if (sessionData?.user?.role === "agent") {
    setLocation("/");
    return null;
  }
  
  return <>{children}</>;
}
import { UploadAvatarDialog } from "@/components/upload-avatar-dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, User as UserIcon, Settings as SettingsIcon, LogOut, LogIn, Plus, BarChart3, ChevronDown, ChevronLeft, MessageSquare, Sun, Mail, UserPlus, Check, CheckCircle, AlertTriangle, AlertCircle, Info, Globe, Search, CreditCard, Shield, FileText, DollarSign, Phone, PhoneMissed, Share2, Star, ClipboardList, Clock, Megaphone, MessageCircle, Users as UsersIcon, Gift, Layout, Wallet, Inbox, CalendarDays, ListTodo, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { formatDistanceToNow } from "date-fns";
import { WebPhoneFloatingWindow } from '@/components/WebPhoneFloatingWindow';
import { whatsAppCallService } from '@/services/whatsapp-call-service';
import { webPhone, useWebPhoneStore } from "@/services/webphone";
import { useTelnyxStore, telnyxWebRTC } from "@/services/telnyx-webrtc";
import { useExtensionCall } from "@/hooks/useExtensionCall";
import type { User } from "@shared/schema";
import defaultLogo from "@assets/logo no fondo_1760457183587.png";
import Login from "@/pages/login";
import Register from "@/pages/register";
import VerifyOTP from "@/pages/verify-otp";
import ActivateAccount from "@/pages/activate-account";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Onboarding from "@/pages/onboarding";
import Dashboard from "@/pages/dashboard";
import Analytics from "@/pages/analytics";
import Users from "@/pages/users";
import UserDetail from "@/pages/user-detail";
import Companies from "@/pages/companies";
import CompanyDetail from "@/pages/company-detail";
import Plans from "@/pages/plans";
import Features from "@/pages/features";
import PulseAiSettings from "@/pages/pulse-ai-settings";
import Invoices from "@/pages/invoices";
import Settings from "@/pages/settings";
import AuditLogs from "@/pages/audit-logs";
import Support from "@/pages/support";
import Contacts from "@/pages/contacts";
import Blacklist from "@/pages/blacklist";
import Campaigns from "@/pages/campaigns";
import CampaignStats from "@/pages/campaign-stats";
import SmsCampaignStats from "@/pages/sms-campaign-stats";
import IncomingSms from "@/pages/incoming-sms";
import SystemAlerts from "@/pages/system-alerts";
import SystemSettings from "@/pages/system-settings";
import SuperAdminRecordingMedia from "@/pages/SuperAdminRecordingMedia";
import Unsubscribe from "@/pages/unsubscribe";
import DataDeletionPage from "@/pages/data-deletion";
import Billing from "@/pages/billing";
import PlanSelection from "@/pages/plan-selection";
import Tickets from "@/pages/tickets";
import EmailConfiguration from "@/pages/email-configuration";
import BirthdayImages from "@/pages/birthday-images";
import Quotes from "@/pages/quotes";
import Policies from "@/pages/policies";
import MarketplacePlans from "@/pages/marketplace-plans";
import PolicyPrintPage from "@/pages/policy-print";
import PublicConsentPage from "@/pages/public-consent";
import Calendar from "@/pages/calendar";
import AppointmentSettings from "@/pages/appointment-settings";
import Referrals from "@/pages/referrals";
import LandingPageBuilder from "@/pages/landing-page";
import PublicLandingPage from "@/pages/public-landing-page";
import SmsMmsPage from "@/pages/sms-mms";
import InboxPage from "@/pages/inbox";
import EmailMarketingPage from "@/pages/email-marketing";
import Leads from "@/pages/leads";
import Tasks from "@/pages/tasks";
import PhoneSystem from "@/pages/phone-system";
import IMessagePage from "@/pages/imessage";
import ImessageCampaigns from "@/pages/imessage-campaigns";
import ImessageCampaignDetail from "@/pages/imessage-campaign-detail";
import NotificationsPage from "@/pages/notifications";
import WalletAnalyticsPage from "@/pages/wallet-analytics";
import GettingStarted from "@/pages/getting-started";
import ComplianceChooseNumber from "@/pages/compliance-choose-number";
import ComplianceInfo from "@/pages/compliance-info";
import ComplianceBrand from "@/pages/compliance-brand";
import ComplianceCampaign from "@/pages/compliance-campaign";
import ComplianceReview from "@/pages/compliance-review";
import ComplianceSuccess from "@/pages/compliance-success";
import SmsVoice from "@/pages/sms-voice";
import SmsVoiceNumbers from "@/pages/integrations/sms-voice-numbers";
import SmsVoiceTollFree from "@/pages/integrations/sms-voice-toll-free";
import SmsVoice10dlc from "@/pages/integrations/sms-voice-10dlc";
import SmsVoiceSenderSettings from "@/pages/integrations/sms-voice-sender-settings";
import EmailSettings from "@/pages/email-settings";
import EmailIntegration from "@/pages/email-integration";
import EmailIntegrationFlow from "@/pages/email-integration-flow";
import SmsVoiceVirtualPbx from "@/pages/integrations/sms-voice-virtual-pbx";
import SmsVoiceCpaas from "@/pages/integrations/sms-voice-cpaas";
import FacebookIntegration from "@/pages/integrations/facebook";
import FacebookFlow from "@/pages/integrations/facebook-flow";
import FacebookPageComponent from "@/pages/integrations/facebook-page";
import WhatsAppFlow from "@/pages/integrations/whatsapp-flow";
import WhatsAppPage from "@/pages/integrations/whatsapp";
import WhatsAppTemplatesPage from "@/pages/integrations/whatsapp-templates";
import InstagramPage from "@/pages/integrations/instagram-page";
import InstagramFlow from "@/pages/integrations/instagram-flow";
import TelegramPage from "@/pages/integrations/telegram-page";
import TelegramFlow from "@/pages/integrations/telegram-flow";
import NotFound from "@/pages/not-found";
import { IntercomProvider } from "@/components/intercom/IntercomProvider";
import { AuthProvider } from "@/hooks/use-auth";
import { WalletTopupDialog } from "@/components/wallet-topup-dialog";

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "4rem",
    "--sidebar-width-icon": "4rem",
  };

  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [timezoneDialogOpen, setTimezoneDialogOpen] = useState(false);
  const [uploadAvatarOpen, setUploadAvatarOpen] = useState(false);
  const [walletTopupOpen, setWalletTopupOpen] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState<string>("");
  
  // WebPhone state for floating button
  const toggleDialpad = useWebPhoneStore(state => state.toggleDialpad);
  const dialpadVisible = useWebPhoneStore(state => state.dialpadVisible);
  const sipConnectionStatus = useWebPhoneStore(state => state.connectionStatus);
  const currentCall = useWebPhoneStore(state => state.currentCall);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Telnyx state
  const telnyxConnectionStatus = useTelnyxStore(state => state.connectionStatus);
  const telnyxCurrentCall = useTelnyxStore(state => state.currentCall);
  
  // Extension calling state
  const { connectionStatus: extConnectionStatus, myExtension: extMyExtension, connect: connectExtension } = useExtensionCall();
  
  // Query for Telnyx phone numbers
  const { data: telnyxNumbersData } = useQuery<{ numbers: any[] }>({
    queryKey: ['/api/telnyx/my-numbers'],
  });
  const hasTelnyxNumber = (telnyxNumbersData?.numbers?.length || 0) > 0;
  
  // Effective connection status - use extension, Telnyx, or SIP (whichever is connected)
  const connectionStatus = extConnectionStatus === 'connected' ? 'connected'
    : hasTelnyxNumber ? telnyxConnectionStatus 
    : sipConnectionStatus;
  const effectiveCall = telnyxCurrentCall || currentCall;

  // Session query - highest priority, needed for WebPhone
  const { data: userData } = useQuery<{ user: User & { walletBalance?: string; walletCurrency?: string } }>({
    queryKey: ["/api/session"],
    staleTime: 0, // Always fresh
    refetchOnMount: true,
  });

  const user = userData?.user;
  
  // Get wallet balance from session (available immediately on load)
  const sessionBalance = user?.walletBalance ? parseFloat(user.walletBalance) : 0;
  
  // PRIORITY 1: Initialize WebPhone FIRST when user has SIP credentials
  useEffect(() => {
    if (user?.sipEnabled && user?.sipExtension && user?.sipPassword) {
      console.log('[WebPhone] Priority initialization starting...');
      const sipServer = user.sipServer || 'wss://pbx.curbe.io:8089/ws';
      webPhone.initialize(user.sipExtension, user.sipPassword, sipServer).catch(error => {
        console.error('[WebPhone] Failed to initialize:', error);
        toast({
          title: "WebPhone Error",
          description: "Failed to connect to phone system",
          variant: "destructive",
          duration: 5000,
        });
      });
    } else if (!user?.sipEnabled && useWebPhoneStore.getState().isConnected) {
      webPhone.disconnect();
    }
  }, [user?.sipEnabled, user?.sipExtension, user?.sipPassword, user?.sipServer]);

  // Pre-warm ICE on login for faster call connection
  // SDK prefetchIceCandidates handles most of this, but we also warm up early
  useEffect(() => {
    if (hasTelnyxNumber && user) {
      console.log('[Telnyx WebRTC] SDK prefetchIceCandidates enabled for faster ICE gathering');
    }
  }, [hasTelnyxNumber, user]);

  const { data: notificationsData, isLoading: isLoadingNotifications, isError: isErrorNotifications } = useQuery<{ notifications: any[] }>({
    queryKey: ["/api/notifications"],
  });

  
  // Query for Phone System access - only owners can see the Phone System tab
  const { data: phoneSystemAccessData } = useQuery<{ hasAccess: boolean; isOwner: boolean; reason: string }>({
    queryKey: ['/api/telnyx/phone-system-access'],
    enabled: !!user,
  });
  const hasPhoneSystemAccess = phoneSystemAccessData?.hasAccess || false;

  // Query for iMessage access - check if user's company has iMessage enabled
  const { data: imessageAccessData } = useQuery<{ hasAccess: boolean; reason?: string }>({
    queryKey: ['/api/imessage/access'],
    enabled: !!user,
  });
  const hasImessageAccess = imessageAccessData?.hasAccess || false;

  // Query for wallet balance (phone credits) - uses session balance as initial, refetches for updates
  const { data: walletBalanceData } = useQuery<{ balance: string; currency: string }>({
    queryKey: ['/api/wallet/balance'],
    enabled: !!user && !!user.companyId,
    refetchInterval: 60000, // Refetch every minute for real-time updates after calls
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
  // Use session balance immediately, then live balance once fetched
  const phoneBalance = walletBalanceData?.balance ? parseFloat(walletBalanceData.balance) : sessionBalance;

  // Query for user phone status - check if user can make calls
  const { data: userPhoneStatusData } = useQuery<{ hasAssignedNumber: boolean; canMakeCalls: boolean; reason: string; message?: string; phoneNumber?: string; hasPbxExtension?: boolean; pbxExtension?: string }>({
    queryKey: ['/api/telnyx/user-phone-status'],
    enabled: !!user,
  });
  // User can make calls if they have a Telnyx number OR have an extension assigned (from server, not WebSocket)
  const hasPbxExtension = userPhoneStatusData?.hasPbxExtension || false;
  const canMakeCalls = userPhoneStatusData?.canMakeCalls || false;
  const noPhoneMessage = userPhoneStatusData?.message || 'Contact your account manager to get a phone number assigned.';

  // Effective connection status that considers if user can make calls (including extension users)
  const effectiveConnectionStatus = canMakeCalls 
    ? (extConnectionStatus === 'connected' ? 'connected' : connectionStatus)
    : 'disconnected';

  // Auto-connect extension WebSocket when user has a PBX extension
  useEffect(() => {
    if (hasPbxExtension && extConnectionStatus === 'disconnected') {
      console.log('[Extension] Auto-connecting WebSocket for PBX extension user');
      connectExtension();
    }
  }, [hasPbxExtension, extConnectionStatus, connectExtension]);


  // Fetch company data for all users with a companyId
  const { data: companyData, isLoading: isLoadingCompany, isFetched: isCompanyFetched } = useQuery<{ company: any }>({
    ...getCompanyQueryOptions(user?.companyId || undefined),
  });
  
  // Compute logo: use session logo immediately (white-label support), fallback to company data or default
  const displayLogo = useMemo(() => {
    // Case 1: User not loaded yet - show nothing (still authenticating)
    if (!user) return null;
    
    // Case 2: User has no company - show default
    if (!user.companyId) return defaultLogo;
    
    // Case 3: Use logo from session (available immediately after login) - WHITE LABEL PRIORITY
    if ((user as any).companyLogo) return (user as any).companyLogo;
    
    // Case 4: Fallback to company data logo if available
    if (companyData?.company?.logo) return companyData.company.logo;
    
    // Case 5: No custom logo - show default
    return defaultLogo;
  }, [user, user?.companyId, (user as any)?.companyLogo, companyData?.company?.logo]);

  const userInitial = user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";
  const userName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user?.email || "User";
  
  // Show role + company name for non-superadmin users
  const roleText = user?.role === "superadmin" 
    ? "Super Admin" 
    : user?.role === "admin" 
      ? "Admin"
      : "Agent";
  
  // For agents: "Agent - Company Name", for admins: "Admin • Company Name", for superadmins: just "Super Admin"
  const userSubtitle = user?.role === "superadmin" 
    ? roleText 
    : companyData?.company?.name 
      ? user?.role === "agent" 
        ? `Agent - ${companyData.company.name}`
        : `${roleText} • ${companyData.company.name}`
      : roleText;
  
  const notifications = notificationsData?.notifications || [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  // Play notification sound - pleasant double beep
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // First beep
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
      gain1.gain.setValueAtTime(0, audioContext.currentTime);
      gain1.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      
      osc1.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.15);
      
      // Second beep (slightly higher)
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.1); // G5
      gain2.gain.setValueAtTime(0, audioContext.currentTime + 0.1);
      gain2.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      osc2.start(audioContext.currentTime + 0.1);
      osc2.stop(audioContext.currentTime + 0.3);

      // Clean up
      setTimeout(() => {
        audioContext.close();
      }, 400);
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }, []);

  // WebSocket listener for real-time notification updates
  const handleWebSocketMessage = useCallback((message: any) => {
    // Defense in depth: Verify tenant scope for events with companyId
    const isRelevantToCurrentUser = (eventCompanyId?: string) => {
      if (!eventCompanyId) return true; // Global events
      if (user?.role === 'superadmin') return true; // Superadmins see all
      return user?.companyId === eventCompanyId; // Same tenant
    };

    if (message.type === 'conversation_update') {
      // When conversation state changes, invalidate related queries
      // Note: Sound is handled by specific message events (new_message, telnyx_message) not here
      // to avoid playing sound for heartbeats and other non-message updates
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/unread-count"] });
    } else if (message.type === 'new_message' || message.type === 'telnyx_message') {
      // Play sound only for actual new incoming messages
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      playNotificationSound();
    } else if (message.type === 'notification_update') {
      // When a broadcast notification is sent, update notifications in real-time
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      // Also invalidate quotes and policies in case it's an agent assignment notification
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policies/stats"] });
      // Invalidate all consents queries (for consent_signed notifications)
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key.length >= 3 && key[0] === '/api/policies' && key[2] === 'consents';
      }});
      // Play sound when new notification arrives
      playNotificationSound();
    } else if (message.type === 'subscription_update') {
      // Verify tenant scope before processing
      if (!isRelevantToCurrentUser(message.companyId)) {
        console.warn('[WEBSOCKET] Ignoring subscription_update for different tenant');
        return;
      }
      // When a subscription is updated via Stripe webhook, refresh subscription data
      const companyId = message.companyId;
      console.log('[WEBSOCKET] Subscription updated for company:', companyId);
      // Invalidate subscription queries for the specific company
      queryClient.invalidateQueries({ queryKey: ["/api/subscription", companyId] });
      // Also invalidate billing-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
    } else if (message.type === 'company_update') {
      // Verify tenant scope before processing
      if (!isRelevantToCurrentUser(message.companyId)) {
        console.warn('[WEBSOCKET] Ignoring company_update for different tenant');
        return;
      }
      // When company data is updated, refresh company-related queries
      const companyId = message.companyId;
      console.log('[WEBSOCKET] Company updated:', companyId);
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/company"] });
    } else if (message.type === 'user_update') {
      // Verify tenant scope before processing
      if (!isRelevantToCurrentUser(message.companyId)) {
        console.warn('[WEBSOCKET] Ignoring user_update for different tenant');
        return;
      }
      // When user data is updated, refresh user-related queries
      const userId = message.userId;
      const companyId = message.companyId;
      console.log('[WEBSOCKET] User updated:', userId);
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
    } else if (message.type === 'data_invalidation') {
      // Verify tenant scope before processing
      if (message.companyId && !isRelevantToCurrentUser(message.companyId)) {
        console.warn('[WEBSOCKET] Ignoring data_invalidation for different tenant');
        return;
      }
      // Generic data invalidation for any query keys
      const queryKeys = message.queryKeys as string[];
      console.log('[WEBSOCKET] Invalidating queries:', queryKeys.join(', '));
      queryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    } else if (message.type === 'telnyx_number_assigned') {
      // A phone number was assigned to this user - refresh queries and auto-init WebRTC
      console.log('[WEBSOCKET] Telnyx number assigned:', message.phoneNumber);
      
      // Invalidate session and phone number queries to fetch new assignment
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/my-numbers"] });
      
      // Show notification to user
      toast({
        title: "Phone Number Assigned",
        description: `You have been assigned ${message.phoneNumber}. Your phone is now ready to use.`,
      });
      
      // Play notification sound
      playNotificationSound();
    } else if (message.type === 'telnyx_number_unassigned') {
      // Phone number was unassigned from this user - disconnect WebRTC
      console.log('[WEBSOCKET] Telnyx number unassigned:', message.phoneNumber);
      
      // Invalidate queries to reflect the change
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/my-numbers"] });
      
      // Show notification to user
      toast({
        title: "Phone Number Unassigned",
        description: `The phone number ${message.phoneNumber} has been reassigned. Your phone will disconnect.`,
        variant: "destructive",
      });
    } else if (message.type === 'wallet_updated') {
      // Wallet balance changed (call charged, SMS sent, top-up, etc.)
      console.log('[WEBSOCKET] Wallet updated');
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
    } else if (message.type === 'new_call_log') {
      // New call log created or updated
      console.log('[WEBSOCKET] New call log');
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
    }
  }, [playNotificationSound, user]);

  useWebSocket(handleWebSocketMessage);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications/read-all", {
        method: "PATCH",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  // Agent availability status
  const { data: availabilityData } = useQuery<{ status: string }>({
    queryKey: ["/api/users/availability-status"],
  });

  // Sync availability status to Telnyx store when data loads
  useEffect(() => {
    if (availabilityData?.status) {
      useTelnyxStore.getState().setAgentAvailabilityStatus(availabilityData.status as "online" | "busy" | "offline");
    }
  }, [availabilityData?.status]);

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", "/api/users/availability-status", { status });
      return res;
    },
    onSuccess: async (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/availability-status"] });
      useTelnyxStore.getState().setAgentAvailabilityStatus(status as "online" | "busy" | "offline");
      
      // When going online, ensure WebRTC is connected
      if (status === "online") {
        const { telnyxWebRTC } = await import("@/services/telnyx-webrtc");
        await telnyxWebRTC.ensureConnected();
      }
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "bg-green-500";
      case "busy": return "bg-yellow-500";
      case "offline": return "bg-red-500";
      default: return "bg-gray-400";
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        // Clear all query cache
        queryClient.clear();
        // Clear company logo cache
        localStorage.removeItem('company_logo');
        // Force hard reload to login page
        window.location.href = "/login";
      } else {
        toast({
          variant: "destructive",
          title: "Logout failed",
          description: "Unable to logout. Please try again.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to logout. Please try again.",
      });
    }
  };

  // Initialize timezone when user data loads - always sync with user's timezone
  useEffect(() => {
    // Always sync selectedTimezone with user.timezone (even if empty)
    // This ensures the state persists correctly across page reloads
    setSelectedTimezone(user?.timezone || "");
  }, [user?.timezone]);

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update user timezone
  const handleTimezoneUpdate = async () => {
    if (!selectedTimezone) return;
    
    try {
      const response = await fetch("/api/users/timezone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: selectedTimezone }),
      });

      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: ["/api/session"] });
        await queryClient.refetchQueries({ queryKey: ["/api/session"] });
        setTimezoneDialogOpen(false);
        toast({
          title: "Timezone updated",
          description: "Your timezone preference has been saved.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Update failed",
          description: "Unable to update timezone. Please try again.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update timezone. Please try again.",
      });
    }
  };

  // Build navigation items - Phone System only visible to owner (checked via hasPhoneSystemAccess)
  // Note: Calendar, Customers, Leads, Tasks are now in the sidebar
  const baseAdminItems = [
    { title: "Dashboard", url: "/dashboard" },
  ];
  
  const navigationItems = user?.role === 'superadmin' 
    ? [
        { title: "Dashboard", url: "/dashboard" },
        { title: "Companies", url: "/companies" },
        { title: "Users", url: "/users" },
        { title: "Plans", url: "/plans" },
        { title: "Features", url: "/features" },
        { title: "Pulse AI", url: "/pulse-ai" },
        { title: "Invoices", url: "/invoices" },
        { title: "Tickets", url: "/tickets" },
        { title: "Audit Logs", url: "/audit-logs" },
        { title: "Alerts", url: "/system-alerts" },
        { title: "Settings", url: "/settings" },
      ]
    : baseAdminItems;

  const circularButtonClass = "h-10 w-10 rounded-full bg-white/90 dark:bg-gray-800/70 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all duration-200";

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      {/* CSS Grid Layout: Col 1 = Sidebar (full height), Col 2 = Header + Content */}
      <div className="grid grid-cols-[4rem,1fr] h-screen w-full bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Sidebar - Column 1 - Full height from top to bottom */}
        <div className="row-span-full pl-4 flex flex-col items-center py-4 space-y-3">
          {/* Curbe Logo - Full width */}
          <Link href="/dashboard" className="w-full flex justify-center mb-2">
            <img 
              src="/curbe-icon.png" 
              alt="Curbe" 
              className="w-12 h-12 object-contain cursor-pointer hover:scale-105 transition-transform"
              data-testid="sidebar-logo"
            />
          </Link>

          {/* Core Navigation Icons */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation("/calendar")}
                data-testid="sidebar-button-calendar"
                className={circularButtonClass}
              >
                <CalendarDays className="h-[18px] w-[18px] text-violet-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Calendar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation("/customers")}
                data-testid="sidebar-button-customers"
                className={circularButtonClass}
              >
                <UsersIcon className="h-[18px] w-[18px] text-emerald-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Customers</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation("/leads")}
                data-testid="sidebar-button-leads"
                className={circularButtonClass}
              >
                <Target className="h-[18px] w-[18px] text-orange-500" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Leads</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation("/tasks")}
                data-testid="sidebar-button-tasks"
                className={circularButtonClass}
              >
                <ListTodo className="h-[18px] w-[18px] text-cyan-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Tasks</TooltipContent>
          </Tooltip>

          {/* Communications Icons */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation("/inbox")}
                data-testid="sidebar-button-inbox"
                className={circularButtonClass}
              >
                <Inbox className="h-[18px] w-[18px] text-sky-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Inbox</TooltipContent>
          </Tooltip>

          {/* Marketing Icons */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation("/campaigns")}
                data-testid="sidebar-button-campaigns"
                className={circularButtonClass}
              >
                <Megaphone className="h-[18px] w-[18px] text-red-500" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Campaigns</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation("/contacts")}
                data-testid="sidebar-button-contacts"
                className={circularButtonClass}
              >
                <UsersIcon className="h-[18px] w-[18px] text-blue-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Contacts</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation("/referrals")}
                data-testid="sidebar-button-referrals"
                className={circularButtonClass}
              >
                <Gift className="h-[18px] w-[18px] text-pink-500" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Referrals</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation("/landing-page")}
                data-testid="sidebar-button-landing-page"
                className={circularButtonClass}
              >
                <Layout className="h-[18px] w-[18px] text-indigo-500" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Landing Page</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation("/wallet-analytics")}
                data-testid="sidebar-button-wallet"
                className={circularButtonClass}
              >
                <Wallet className="h-[18px] w-[18px] text-amber-600" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Wallet Passes</TooltipContent>
          </Tooltip>

          {/* Spacer to push bottom icons down */}
          <div className="flex-1" />

          {/* Bottom Icons */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => setNotificationsOpen(true)}
                data-testid="sidebar-button-notifications" 
                className={cn(circularButtonClass, "relative")}
              >
                <Bell className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">{unreadCount > 9 ? '!' : unreadCount}</span>
                  </div>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Notifications</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation("/settings/notifications")}
                data-testid="sidebar-button-history"
                className={circularButtonClass}
              >
                <Clock className="h-[18px] w-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">History</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLocation("/settings")}
                data-testid="sidebar-button-settings"
                className={circularButtonClass}
              >
                <SettingsIcon className="h-[18px] w-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Settings</TooltipContent>
          </Tooltip>

          {/* User Avatar with Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="relative focus:outline-none"
                data-testid="sidebar-button-avatar"
              >
                <Avatar className="h-9 w-9 cursor-pointer hover:scale-105 transition-transform">
                  <AvatarImage src={user?.avatar || undefined} alt={userName} />
                  <AvatarFallback className="bg-amber-100 text-amber-700 text-sm font-semibold">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <span 
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800 z-10",
                    getStatusColor(availabilityData?.status || "offline")
                  )}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-72 p-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-0 shadow-xl rounded-xl">
              {/* User Info Header */}
              <div className="flex items-center gap-3 mb-3">
                <Avatar 
                  className="h-12 w-12 cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setUploadAvatarOpen(true)}
                  data-testid="sidebar-avatar-upload-trigger"
                >
                  <AvatarImage src={user?.avatar || undefined} alt={userName} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0">
                    {userSubtitle}
                  </Badge>
                </div>
              </div>
              
              <DropdownMenuSeparator className="my-2" />
              
              {/* Availability Status */}
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                Availability
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => updateAvailabilityMutation.mutate("online")}
                data-testid="sidebar-menu-status-online"
                className="py-2 px-3 cursor-pointer rounded-md"
              >
                <span className="h-3 w-3 rounded-full bg-green-500 mr-3" />
                <span className="text-sm font-medium flex-1">Online</span>
                {availabilityData?.status === "online" && <Check className="h-4 w-4 text-green-500" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updateAvailabilityMutation.mutate("busy")}
                data-testid="sidebar-menu-status-busy"
                className="py-2 px-3 cursor-pointer rounded-md"
              >
                <span className="h-3 w-3 rounded-full bg-yellow-500 mr-3" />
                <span className="text-sm font-medium flex-1">Busy</span>
                {availabilityData?.status === "busy" && <Check className="h-4 w-4 text-yellow-500" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updateAvailabilityMutation.mutate("offline")}
                data-testid="sidebar-menu-status-offline"
                className="py-2 px-3 cursor-pointer rounded-md"
              >
                <span className="h-3 w-3 rounded-full bg-red-500 mr-3" />
                <span className="text-sm font-medium flex-1">Offline</span>
                {availabilityData?.status === "offline" && <Check className="h-4 w-4 text-red-500" />}
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="my-2" />
              
              <div className="space-y-0.5">
                <DropdownMenuItem 
                  onClick={() => setLocation("/settings/billing")}
                  data-testid="sidebar-menu-billing"
                  className="py-2.5 px-3 cursor-pointer rounded-md"
                >
                  <CreditCard className="mr-3 h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Billing</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setTimezoneDialogOpen(true)}
                  data-testid="sidebar-menu-timezone"
                  className="py-2.5 px-3 cursor-pointer rounded-md"
                >
                  <Globe className="mr-3 h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Timezone</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  data-testid="sidebar-menu-logout"
                  className="py-2.5 px-3 cursor-pointer rounded-md text-destructive"
                >
                  <LogOut className="mr-3 h-5 w-5" />
                  <span className="text-sm font-medium">Sign out</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right side - Column 2 - Header + Content stacked vertically */}
        <div className="flex flex-col h-screen">
          {/* Header */}
          <div className="p-4 pb-2">
            <header className="h-14 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 flex items-center px-6">
            {/* Left: Company Logo - Always links to dashboard (SPA navigation) */}
            <div className="flex items-center shrink-0 mr-8 h-10">
              {displayLogo && (
                <Link href="/dashboard" data-testid="logo-link">
                  <img 
                    src={displayLogo} 
                    alt="Logo" 
                    className="h-9 max-w-[140px] object-contain cursor-pointer hover:opacity-80 transition-opacity"
                  />
                </Link>
              )}
            </div>

            {/* Center: Navigation Pills */}
            <nav className="flex-1 flex items-center justify-center gap-2">
              {navigationItems.map((item) => (
                <Link key={item.url} href={item.url}>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={cn(
                      "text-sm font-medium transition-all duration-200 px-4 py-1.5 h-8 rounded-lg",
                      location === item.url 
                        ? "bg-gray-900 text-white shadow-sm hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100" 
                        : "bg-white/80 text-gray-700 shadow-sm border border-gray-200/60 hover:bg-white hover:text-gray-900 hover:border-gray-300 dark:bg-gray-800/80 dark:text-gray-300 dark:border-gray-700/60 dark:hover:bg-gray-700 dark:hover:text-white"
                    )}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    {item.title}
                  </Button>
                </Link>
              ))}
            </nav>

            {/* Right: Action Icons - SugarCRM circular style */}
            <div className="flex items-center gap-3 shrink-0">
              {/* New Policy Button - Quick access */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setLocation("/customers/new")}
                    data-testid="header-button-new-policy"
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-primary hover:bg-primary/90 text-white transition-all duration-200"
                  >
                    <Plus className="h-[18px] w-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>New Policy</TooltipContent>
              </Tooltip>

              {/* Phone Credits Balance - Uses session balance for instant display */}
              <div className="flex items-center gap-2">
                <div 
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => setLocation("/settings/billing?tab=phone")}
                  data-testid="link-phone-balance"
                >
                  <Wallet className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white" data-testid="text-phone-balance">
                    ${phoneBalance.toFixed(2)}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setWalletTopupOpen(true)}
                  className="h-8 text-xs font-medium"
                  data-testid="button-buy-credits"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Buy Credits
                </Button>
              </div>

            </div>
            </header>
          </div>
          
          {/* Content Area */}
          <div className="flex-1 min-h-0 overflow-hidden pr-2 pb-2">
            <main className="h-full overflow-auto p-3">
              {children}
            </main>
          </div>
        </div>
      </div>

      {/* Floating Phone Button - Bottom Right */}
      {(user?.role === 'admin' || user?.role === 'superadmin' || hasPbxExtension) && (
        <button
          onClick={() => {
            if (!canMakeCalls) {
              toast({
                title: "Phone Not Available",
                description: noPhoneMessage,
                variant: "destructive",
                duration: 5000,
              });
              return;
            }
            toggleDialpad();
          }}
          data-testid="floating-button-phone"
          className={cn(
            "fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:scale-110",
            effectiveCall 
              ? "bg-green-500 hover:bg-green-600 text-white ring-4 ring-green-300/50 animate-pulse" 
              : effectiveConnectionStatus === 'connected'
                ? "bg-green-500 hover:bg-green-600 text-white"
                : effectiveConnectionStatus === 'connecting'
                  ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                  : "bg-gray-400 hover:bg-gray-500 text-white"
          )}
        >
          <Phone className="h-5 w-5" />
        </button>
      )}

      {/* WebPhone Floating Window - Visible to admins, superadmins, or users with extensions */}
      {(user?.role === 'admin' || user?.role === 'superadmin' || hasPbxExtension) && <WebPhoneFloatingWindow />}

      {/* WhatsApp Call Handler moved to App level for persistent connection */}

      {/* Timezone Dialog */}
      <Dialog open={timezoneDialogOpen} onOpenChange={setTimezoneDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Your Timezone</DialogTitle>
            <DialogDescription>
              Choose your timezone to display all dates and times correctly throughout the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
              <SelectTrigger data-testid="select-timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">America - USA</div>
                <SelectItem value="America/New_York">(UTC-05:00) EST, New York, Toronto</SelectItem>
                <SelectItem value="America/Chicago">(UTC-06:00) CST, Chicago, Mexico City</SelectItem>
                <SelectItem value="America/Denver">(UTC-07:00) MST, Denver, Phoenix</SelectItem>
                <SelectItem value="America/Los_Angeles">(UTC-08:00) PST, Los Angeles, Vancouver</SelectItem>
                <SelectItem value="America/Anchorage">(UTC-09:00) AKST, Anchorage</SelectItem>
                <SelectItem value="Pacific/Honolulu">(UTC-10:00) HST, Honolulu</SelectItem>
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Central and South America</div>
                <SelectItem value="America/Argentina/Buenos_Aires">(UTC-03:00) ART, Buenos Aires</SelectItem>
                <SelectItem value="America/Sao_Paulo">(UTC-03:00) BRT, São Paulo, Rio de Janeiro</SelectItem>
                <SelectItem value="America/Santiago">(UTC-03:00) CLT, Santiago</SelectItem>
                <SelectItem value="America/Bogota">(UTC-05:00) COT, Bogotá</SelectItem>
                <SelectItem value="America/Lima">(UTC-05:00) PET, Lima</SelectItem>
                <SelectItem value="America/Caracas">(UTC-04:00) AST, Caracas</SelectItem>
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Europe</div>
                <SelectItem value="Europe/London">(UTC+00:00) GMT, London, Dublin</SelectItem>
                <SelectItem value="Europe/Paris">(UTC+01:00) CET, Paris, Madrid, Berlin</SelectItem>
                <SelectItem value="Europe/Istanbul">(UTC+02:00) EET, Istanbul, Athens, Cairo</SelectItem>
                <SelectItem value="Europe/Moscow">(UTC+03:00) MSK, Moscow, Saint Petersburg</SelectItem>
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Africa</div>
                <SelectItem value="Africa/Lagos">(UTC+01:00) WAT, Lagos, Kinshasa</SelectItem>
                <SelectItem value="Africa/Johannesburg">(UTC+02:00) SAST, Johannesburg, Cape Town</SelectItem>
                <SelectItem value="Africa/Nairobi">(UTC+03:00) EAT, Nairobi, Addis Ababa</SelectItem>
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Asia</div>
                <SelectItem value="Asia/Kolkata">(UTC+05:30) IST, Kolkata, New Delhi, Mumbai</SelectItem>
                <SelectItem value="Asia/Jakarta">(UTC+07:00) WIB, Jakarta, Bangkok</SelectItem>
                <SelectItem value="Asia/Shanghai">(UTC+08:00) CST, Shanghai, Beijing, Hong Kong</SelectItem>
                <SelectItem value="Asia/Hong_Kong">(UTC+08:00) HKT, Hong Kong</SelectItem>
                <SelectItem value="Asia/Singapore">(UTC+08:00) SGT, Singapore</SelectItem>
                <SelectItem value="Asia/Tokyo">(UTC+09:00) JST, Tokyo, Osaka</SelectItem>
                <SelectItem value="Asia/Seoul">(UTC+09:00) KST, Seoul</SelectItem>
                <SelectItem value="Asia/Manila">(UTC+08:00) PHT, Manila</SelectItem>
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Australia and Pacific</div>
                <SelectItem value="Australia/Adelaide">(UTC+09:30) ACST, Adelaide, Darwin</SelectItem>
                <SelectItem value="Australia/Sydney">(UTC+10:00) AEST, Sydney, Melbourne</SelectItem>
                <SelectItem value="Pacific/Auckland">(UTC+12:00) NZST, Auckland, Wellington</SelectItem>
                <SelectItem value="Pacific/Chatham">(UTC+12:45) Chatham Islands</SelectItem>
                <SelectItem value="Pacific/Apia">(UTC+13:00) Samoa, Apia</SelectItem>
                <SelectItem value="Pacific/Kiritimati">(UTC+14:00) Line Islands, Kiritimati</SelectItem>
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Middle East</div>
                <SelectItem value="Asia/Riyadh">(UTC+03:00) AST, Riyadh, Kuwait, Baghdad</SelectItem>
                <SelectItem value="Asia/Dubai">(UTC+04:00) GST, Dubai, Abu Dhabi</SelectItem>
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">UTC (Coordinated Universal Time)</div>
                <SelectItem value="UTC">(UTC+00:00) UTC, Greenwich</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setTimezoneDialogOpen(false)}
                data-testid="button-cancel-timezone"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleTimezoneUpdate}
                disabled={!selectedTimezone}
                data-testid="button-save-timezone"
              >
                Save Timezone
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notifications Sidebar */}
      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent side="right" className="w-full sm:w-[560px] p-0 flex flex-col">
          {/* Header */}
          <div className="p-6 space-y-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl font-semibold">Notifications</SheetTitle>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button 
                className="flex-1 h-11 gap-2"
                onClick={() => {
                  setLocation("/settings/notifications");
                  setNotificationsOpen(false);
                }}
                data-testid="button-view-all"
              >
                <Bell className="h-4 w-4" />
                View all
              </Button>
              {unreadCount > 0 && (
                <Button 
                  variant="outline"
                  className="flex-1 h-11 gap-2"
                  onClick={markAllAsRead}
                  data-testid="button-mark-all-read"
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark all as read
                </Button>
              )}
            </div>
          </div>

          {/* Notifications list */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingNotifications ? (
              <div className="flex items-center justify-center py-16" data-testid="notifications-loading">
                <div className="text-center">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              </div>
            ) : isErrorNotifications ? (
              <div className="flex items-center justify-center py-16" data-testid="notifications-error">
                <div className="text-center">
                  <Bell className="h-6 w-6 text-destructive mb-2 mx-auto" />
                  <p className="text-sm text-destructive">Failed to load</p>
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex items-center justify-center py-16" data-testid="notifications-empty">
                <div className="text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/50 mb-2 mx-auto" />
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-1">No new notifications</p>
                </div>
              </div>
            ) : (
              <div>
                {(() => {
                  // Group notifications by date
                  const groupedNotifications: { [key: string]: any[] } = {
                    'Today': [],
                    'Yesterday': [],
                    'Older': []
                  };
                  
                  notifications.forEach((notification: any) => {
                    const date = new Date(notification.createdAt);
                    const now = new Date();
                    const yesterday = new Date(now);
                    yesterday.setDate(yesterday.getDate() - 1);
                    
                    if (date.toDateString() === now.toDateString()) {
                      groupedNotifications['Today'].push(notification);
                    } else if (date.toDateString() === yesterday.toDateString()) {
                      groupedNotifications['Yesterday'].push(notification);
                    } else {
                      groupedNotifications['Older'].push(notification);
                    }
                  });

                  return Object.entries(groupedNotifications)
                    .filter(([_, notifs]) => notifs.length > 0)
                    .map(([dateKey, notifs]) => (
                    <div key={dateKey} className="mb-4">
                      <h3 className="text-xs font-medium text-muted-foreground px-4 py-2">{dateKey}</h3>
                      <div>
                        {notifs.map((notification: any) => {
                          const getNotificationIcon = () => {
                            // Check title first for better detection (handles old and new formats)
                            if (notification.title.toLowerCase().includes('missed call')) return PhoneMissed;
                            if (notification.title.toLowerCase().includes('sms')) return MessageSquare;
                            if (notification.title.toLowerCase().includes('login')) return LogIn;
                            if (notification.title.toLowerCase().includes('email') || notification.title.toLowerCase().includes('campaign')) return Mail;
                            if (notification.title.toLowerCase().includes('user') || notification.title.toLowerCase().includes('subscriber')) return UserPlus;
                            
                            // Then check notification type
                            if (notification.type) {
                              switch (notification.type) {
                                case 'missed_call': return PhoneMissed;
                                case 'sms_received': return MessageSquare;
                                case 'user_login': return LogIn;
                                case 'success': return CheckCircle;
                                case 'warning': return AlertTriangle;
                                case 'error': return AlertCircle;
                                case 'info': return Info;
                              }
                            }
                            return Bell;
                          };
                          
                          const Icon = getNotificationIcon();
                          
                          // Get icon color based on type
                          const getIconColor = () => {
                            // Check title first for better detection (handles old and new formats)
                            if (notification.title.toLowerCase().includes('missed call')) return 'text-red-600 dark:text-red-400';
                            if (notification.title.toLowerCase().includes('sms')) return 'text-blue-600 dark:text-blue-400';
                            if (notification.title.toLowerCase().includes('login')) return 'text-purple-600 dark:text-purple-400';
                            if (notification.title.toLowerCase().includes('email') || notification.title.toLowerCase().includes('campaign')) return 'text-green-600 dark:text-green-400';
                            if (notification.title.toLowerCase().includes('user') || notification.title.toLowerCase().includes('subscriber')) return 'text-indigo-600 dark:text-indigo-400';
                            
                            // Then check notification type
                            if (notification.type) {
                              switch (notification.type) {
                                case 'missed_call': return 'text-red-600 dark:text-red-400';
                                case 'sms_received': return 'text-blue-600 dark:text-blue-400';
                                case 'user_login': return 'text-purple-600 dark:text-purple-400';
                                case 'success': return 'text-green-600 dark:text-green-400';
                                case 'warning': return 'text-orange-600 dark:text-orange-400';
                                case 'error': return 'text-red-600 dark:text-red-400';
                                case 'info': return 'text-blue-600 dark:text-blue-400';
                              }
                            }
                            // Default color for other notifications
                            return 'text-muted-foreground';
                          };
                          
                          // Calculate time ago
                          const getTimeAgo = (date: Date) => {
                            const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
                            const minutes = Math.floor(seconds / 60);
                            const hours = Math.floor(minutes / 60);
                            const days = Math.floor(hours / 24);
                            
                            if (days > 0) return `${days}d ago`;
                            if (hours > 0) return `${hours}h ago`;
                            if (minutes > 0) return `${minutes}min ago`;
                            return 'just now';
                          };
                          
                          const timeAgo = notification.createdAt 
                            ? getTimeAgo(new Date(notification.createdAt))
                            : '';

                          // Format phone number for display (e.g., 13054578187 -> (305) 457-8187)
                          const formatPhone = (phone) => {
                            const digits = phone.replace(/\D/g, '');
                            if (digits.length === 11 && digits.startsWith('1')) {
                              return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
                            }
                            if (digits.length === 10) {
                              return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                            }
                            return phone;
                          };

                          // Extract phone number from text
                          const extractPhone = (text) => {
                            const match = text.match(/\d{10,11}/);
                            return match ? match[0] : null;
                          };

                          // Extract name and message - CLEAN AND CONCISE
                          const getName = () => {
                            const title = notification.title.toLowerCase();
                            const phone = extractPhone(notification.title) || extractPhone(notification.message);
                            
                            // Missed call notifications - just show formatted phone
                            if (title.includes('missed call') || notification.type === 'missed_call') {
                              return phone ? formatPhone(phone) : 'Unknown Caller';
                            }
                            // SMS notifications
                            if (notification.type === 'sms_received' || title.includes('sms from')) {
                              return phone ? formatPhone(phone) : notification.title.replace(/SMS from /i, '');
                            }
                            if (title.includes('sms')) {
                              const parts = notification.message.split(':');
                              return parts[0] ? formatPhone(parts[0]) : 'Unknown';
                            }
                            // Quote notifications
                            if (title.includes('quote')) {
                              return 'New Quote';
                            }
                            return notification.title.replace('New ', '').replace(' Created', '');
                          };

                          const getMessagePreview = () => {
                            const title = notification.title.toLowerCase();
                            
                            // Missed call - short message
                            if (title.includes('missed call') || notification.type === 'missed_call') {
                              if (title.includes('auto-rejected') || notification.message.includes('auto-rejected')) {
                                return 'Missed call - auto rejected';
                              }
                              return 'Missed call';
                            }
                            // SMS notifications
                            if (notification.type === 'sms_received' || title.includes('sms from')) {
                              return notification.message;
                            }
                            if (title.includes('sms')) {
                              const parts = notification.message.split(':');
                              return parts.slice(1).join(':').trim();
                            }
                            // Truncate long messages
                            const msg = notification.message;
                            return msg.length > 80 ? msg.slice(0, 77) + '...' : msg;
                          };

                          return (
                            <div 
                              key={notification.id}
                              onClick={() => {
                                if (!notification.isRead) {
                                  markAsRead(notification.id);
                                }
                                if (notification.link) {
                                  // Close notifications panel first
                                  setNotificationsOpen(false);
                                  // Navigate after a small delay to ensure sheet closes smoothly
                                  setTimeout(() => {
                                    setLocation(notification.link);
                                  }, 100);
                                }
                              }}
                              className="px-4 py-2.5 transition-colors cursor-pointer hover:bg-muted/50"
                              data-testid={`notification-item-${notification.id}`}
                            >
                              <div className="flex gap-3">
                                <div className="shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                                  <Icon className={`h-4 w-4 ${getIconColor()}`} />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-0.5">
                                    <p className="text-sm font-medium break-words">
                                      {getName()}
                                    </p>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-xs text-muted-foreground">
                                        {timeAgo}
                                      </span>
                                      {!notification.isRead && (
                                        <div className="h-1.5 w-1.5 rounded-full bg-destructive"></div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap">
                                    {getMessagePreview()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Upload Avatar Dialog */}
      <UploadAvatarDialog
        open={uploadAvatarOpen}
        onOpenChange={setUploadAvatarOpen}
        currentAvatar={user?.avatar || ""}
        userInitial={userInitial}
      />

      {/* Wallet Top-up Dialog */}
      <WalletTopupDialog
        open={walletTopupOpen}
        onOpenChange={setWalletTopupOpen}
      />
    </SidebarProvider>
  );
}

function Router() {
  const [pwaCheckDone, setPwaCheckDone] = useState(false);

  // PWA Standalone Mode: Redirect to last viewed card when opened from home screen
  // This MUST complete before routes render to prevent "/dashboard" redirect from firing first
  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || 
                         (window.navigator as any).standalone === true;
    const lastCardToken = localStorage.getItem("last_card_token");
    
    if (isStandalone && lastCardToken && window.location.pathname === "/") {
      // Redirect and don't set pwaCheckDone - page will navigate away
      window.location.replace(`/p/${lastCardToken}?src=home`);
      return;
    }
    
    // No PWA redirect needed, allow routes to render
    setPwaCheckDone(true);
  }, []);

  // Block rendering until PWA redirect check is complete
  if (!pwaCheckDone) {
    return null;
  }

  return (
    <Switch>
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/verify-otp" component={VerifyOTP} />
      <Route path="/activate-account" component={ActivateAccount} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/getting-started">
        <ProtectedRoute>
          <DashboardLayout>
            <GettingStarted />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/compliance/choose-number">
        <ProtectedRoute>
          <DashboardLayout>
            <ComplianceChooseNumber />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/compliance/info/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <ComplianceInfo />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/compliance/brand/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <ComplianceBrand />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/compliance/campaign/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <ComplianceCampaign />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/compliance/review/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <ComplianceReview />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/compliance/success/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <ComplianceSuccess />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/analytics">
        <ProtectedRoute>
          <DashboardLayout>
            <Analytics />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/users/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <UserDetail />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/users">
        <ProtectedRoute>
          <DashboardLayout>
            <Users />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/companies/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <CompanyDetail />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/companies">
        <ProtectedRoute>
          <DashboardLayout>
            <Companies />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/plans">
        <ProtectedRoute>
          <DashboardLayout>
            <Plans />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/features">
        <ProtectedRoute>
          <DashboardLayout>
            <Features />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/pulse-ai">
        <ProtectedRoute>
          <DashboardLayout>
            <PulseAiSettings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/pulse-ai">
        <ProtectedRoute>
          <DashboardLayout>
            <PulseAiSettings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/quotes/new">
        <ProtectedRoute>
          <DashboardLayout>
            <Quotes />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/quotes/:id/marketplace-plans">
        <ProtectedRoute>
          <DashboardLayout>
            <MarketplacePlans />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/calendar">
        <ProtectedRoute>
          <DashboardLayout>
            <Calendar />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/calendar/settings">
        <ProtectedRoute>
          <DashboardLayout>
            <AppointmentSettings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/quotes/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <Quotes />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/quotes">
        <ProtectedRoute>
          <DashboardLayout>
            <Quotes />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/customers/new">
        <ProtectedRoute>
          <DashboardLayout>
            <Policies />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/customers/:id/marketplace-plans">
        <ProtectedRoute>
          <DashboardLayout>
            <MarketplacePlans />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/customers/:id/print">
        <ProtectedRoute>
          <PolicyPrintPage />
        </ProtectedRoute>
      </Route>
      <Route path="/customers/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <Policies />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/customers">
        <ProtectedRoute>
          <DashboardLayout>
            <Policies />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/leads">
        <ProtectedRoute>
          <DashboardLayout>
            <Leads />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/contacts">
        <ProtectedRoute>
          <DashboardLayout>
            <Contacts />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/tasks">
        <ProtectedRoute>
          <DashboardLayout>
            <Tasks />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/phone-system">
        <ProtectedRoute>
          <DashboardLayout>
            <PhoneSystem />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/invoices">
        <ProtectedRoute>
          <DashboardLayout>
            <Invoices />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/billing">
        <ProtectedRoute>
          <DashboardLayout>
            <AgentBlockedRoute>
              <Billing />
            </AgentBlockedRoute>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/select-plan">
        <ProtectedRoute>
          <PlanSelection />
        </ProtectedRoute>
      </Route>
      {/* Specific settings routes MUST come before the wildcard */}
      <Route path="/settings/email/flow">
        <ProtectedRoute>
          <DashboardLayout>
            <EmailIntegrationFlow />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/sms-voice/numbers">
        <ProtectedRoute>
          <DashboardLayout>
            <SmsVoiceNumbers />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/sms-voice/toll-free-verification">
        <ProtectedRoute>
          <DashboardLayout>
            <SmsVoiceTollFree />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/sms-voice/10dlc-verification">
        <ProtectedRoute>
          <DashboardLayout>
            <SmsVoice10dlc />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/sms-voice/sender-settings">
        <ProtectedRoute>
          <DashboardLayout>
            <SmsVoiceSenderSettings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/sms-voice/virtual-pbx">
        <ProtectedRoute>
          <DashboardLayout>
            <SmsVoiceVirtualPbx />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/sms-voice/cpaas">
        <ProtectedRoute>
          <DashboardLayout>
            <SmsVoiceCpaas />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/facebook/flow">
        <ProtectedRoute>
          <DashboardLayout>
            <FacebookFlow />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/facebook">
        <ProtectedRoute>
          <DashboardLayout>
            <FacebookPageComponent />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/whatsapp/flow">
        <ProtectedRoute>
          <DashboardLayout>
            <WhatsAppFlow />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/whatsapp/templates/:wabaId">
        <ProtectedRoute>
          <DashboardLayout>
            <WhatsAppTemplatesPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/whatsapp">
        <ProtectedRoute>
          <DashboardLayout>
            <WhatsAppPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/instagram/flow">
        <ProtectedRoute>
          <DashboardLayout>
            <InstagramFlow />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/instagram">
        <ProtectedRoute>
          <DashboardLayout>
            <InstagramPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/telegram/flow">
        <ProtectedRoute>
          <DashboardLayout>
            <TelegramFlow />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/telegram">
        <ProtectedRoute>
          <DashboardLayout>
            <TelegramPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/profile">
        <ProtectedRoute>
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/company">
        <ProtectedRoute>
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/team">
        <ProtectedRoute>
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/security">
        <ProtectedRoute>
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/automations">
        <ProtectedRoute>
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/billing">
        <ProtectedRoute>
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/white-label">
        <ProtectedRoute>
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/notifications">
        <ProtectedRoute>
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/webphone">
        <ProtectedRoute>
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/sms-voice">
        <ProtectedRoute>
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/email">
        <ProtectedRoute>
          <DashboardLayout>
            <EmailIntegration />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/wallet-analytics">
        <ProtectedRoute>
          <DashboardLayout>
            <WalletAnalyticsPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/audit-logs">
        <ProtectedRoute>
          <DashboardLayout>
            <AuditLogs />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/tickets">
        <ProtectedRoute>
          <DashboardLayout>
            <Tickets />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/support">
        <ProtectedRoute>
          <DashboardLayout>
            <Support />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/contacts">
        <ProtectedRoute>
          <DashboardLayout>
            <Contacts />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/blacklist">
        <ProtectedRoute>
          <DashboardLayout>
            <Blacklist />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/referrals">
        <ProtectedRoute>
          <DashboardLayout>
            <Referrals />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/landing-page">
        <ProtectedRoute>
          <DashboardLayout>
            <LandingPageBuilder />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/sms">
        <ProtectedRoute>
          <DashboardLayout>
            <SmsMmsPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/imessage">
        <ProtectedRoute>
          <DashboardLayout>
            <IMessagePage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/imessage-campaigns/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <ImessageCampaignDetail />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/imessage-campaigns">
        <ProtectedRoute>
          <DashboardLayout>
            <ImessageCampaigns />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/email-marketing">
        <ProtectedRoute>
          <DashboardLayout>
            <EmailMarketingPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/campaigns">
        <ProtectedRoute>
          <DashboardLayout>
            <Campaigns />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/campaigns/:id/stats">
        <ProtectedRoute>
          <DashboardLayout>
            <CampaignStats />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/sms-campaigns/:id/stats">
        <ProtectedRoute>
          <DashboardLayout>
            <SmsCampaignStats />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/incoming-sms">
        <ProtectedRoute>
          <DashboardLayout>
            <IncomingSms />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/inbox">
        <ProtectedRoute>
          <DashboardLayout>
            <InboxPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/sms-mms">
        <ProtectedRoute>
          <DashboardLayout>
            <SmsMmsPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/system-alerts">
        <ProtectedRoute>
          <DashboardLayout>
            <SystemAlerts />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/system-settings">
        <ProtectedRoute>
          <DashboardLayout>
            <SystemSettings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/recording-media">
        <ProtectedRoute>
          <DashboardLayout>
            <SuperAdminRecordingMedia />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/email-configuration">
        <ProtectedRoute>
          <DashboardLayout>
            <EmailConfiguration />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/birthday-images">
        <ProtectedRoute>
          <DashboardLayout>
            <BirthdayImages />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/data-deletion" component={DataDeletionPage} />
      <Route path="/l/:slug" component={PublicLandingPage} />
      <Route path="/consent/:token" component={PublicConsentPage} />
      <Route path="/unsubscribe" component={Unsubscribe} />
      <Route path="/:slug" component={PublicLandingPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Global WhatsApp Call Service Initializer - Connects when user is authenticated
function GlobalWhatsAppCallInitializer() {
  const { data: sessionData } = useQuery<{ user: User }>({ 
    queryKey: ["/api/session"],
    staleTime: 0,
  });
  
  useEffect(() => {
    if (sessionData?.user) {
      whatsAppCallService.connect();
    } else {
      whatsAppCallService.disconnect();
    }
    
    return () => {
      whatsAppCallService.disconnect();
    };
  }, [sessionData?.user]);
  
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <IntercomProvider>
            <Toaster />
            <GlobalWhatsAppCallInitializer />
            <Router />
            </IntercomProvider>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
