import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Pencil, Palette, MessageSquare, Target, Code, Copy, ExternalLink, Mail, MoreHorizontal, Trash2, Check, ChevronLeft, ChevronRight, Phone, Send, Upload, Image, Smile, Monitor, RefreshCw } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { SettingsLayout } from "@/components/settings-layout";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";

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
    icon: "textmagic" | "chat" | "message";
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
  };
  targeting: {
    countries: "all" | "selected" | "excluded";
    selectedCountries: string[];
    schedule: "always" | "custom";
    pageUrls: "all" | "specific";
    deviceType: "all" | "desktop" | "mobile";
  };
}

const colorOptions = [
  { value: "blue", bg: "bg-blue-500", hex: "#3B82F6" },
  { value: "orange", bg: "bg-orange-500", hex: "#F97316" },
  { value: "green", bg: "bg-green-500", hex: "#22C55E" },
  { value: "red", bg: "bg-red-500", hex: "#EF4444" },
  { value: "teal", bg: "bg-teal-500", hex: "#14B8A6" },
  { value: "indigo", bg: "bg-indigo-500", hex: "#6366F1" },
  { value: "pink", bg: "bg-pink-500", hex: "#EC4899" },
  { value: "rose", bg: "bg-rose-400", hex: "#FB7185" },
];

const iconOptions = [
  { value: "textmagic", label: "Textmagic" },
  { value: "chat", label: "Chat" },
  { value: "message", label: "Message" },
];

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

  const { data: widgetData, isLoading } = useQuery<{ widget: WidgetConfig }>({
    queryKey: ["/api/integrations/chat-widget", widgetId],
    enabled: !!widgetId,
  });

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
      icon: "textmagic",
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
    },
    targeting: {
      countries: "all",
      selectedCountries: [],
      schedule: "always",
      pageUrls: "all",
      deviceType: "all",
    },
  };
  
  const widget = { ...defaultWidget, ...widgetData?.widget, ...localWidget };

  const embedCode = `<script src="https://widgets.curbe.io/messenger-widget-script.js" data-code="${widgetId}" defer=""></script>`;

  const updateLocalWidget = (updates: Partial<WidgetConfig>) => {
    setLocalWidget(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = () => {
    updateMutation.mutate(localWidget);
    setHasUnsavedChanges(false);
    setLocalWidget({});
  };

  const handleDiscardChanges = () => {
    setLocalWidget({});
    setHasUnsavedChanges(false);
  };

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<WidgetConfig>) => {
      return apiRequest("PATCH", `/api/integrations/chat-widget/${widgetId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/chat-widget", widgetId] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/chat-widget", widgetId] });
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

  const currentColor = colorOptions.find(c => c.value === widget.colorTheme) || colorOptions[0];

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
                          <AccordionContent className="pb-4">
                            <div className="space-y-4">
                              <RadioGroup 
                                value={widget.themeType} 
                                onValueChange={(v) => updateLocalWidget({ themeType: v as "gradient" | "solid" | "custom" })} 
                                className="flex gap-4"
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
                              <div className="flex gap-2 flex-wrap">
                                {colorOptions.map((color) => (
                                  <button
                                    key={color.value}
                                    onClick={() => updateLocalWidget({ colorTheme: color.value })}
                                    className={`w-8 h-8 rounded-full ${color.bg} transition-all ${
                                      widget.colorTheme === color.value 
                                        ? "ring-2 ring-offset-2 ring-blue-500" 
                                        : "hover:scale-110"
                                    }`}
                                    data-testid={`button-color-${color.value}`}
                                  />
                                ))}
                              </div>
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
                          <AccordionContent className="pb-4">
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
                                    <Button variant="outline" size="sm">
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
                                  </div>
                                </div>
                              ) : (
                                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center">
                                  <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                                  <p className="text-sm text-slate-500">
                                    Drag image here or <span className="text-blue-600 cursor-pointer">browse...</span>
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
                          <AccordionContent className="pb-4">
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <Switch 
                                  checked={widget.minimizedState?.includeButtonText || false}
                                  onCheckedChange={(checked) => updateLocalWidget({ 
                                    minimizedState: { ...widget.minimizedState, includeButtonText: checked } 
                                  })}
                                />
                                <Label className="text-sm">Include button text</Label>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-xs text-slate-500">Icon</Label>
                                  <Select 
                                    value={widget.minimizedState?.icon || "textmagic"}
                                    onValueChange={(v) => updateLocalWidget({ 
                                      minimizedState: { ...widget.minimizedState, icon: v as "textmagic" | "chat" | "message" } 
                                    })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {iconOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
                                    <SelectTrigger>
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
                                  />
                                  <Label className="text-sm">Eye-catcher message</Label>
                                </div>
                                
                                {widget.minimizedState?.eyeCatcherEnabled && (
                                  <>
                                    <div className="space-y-2">
                                      <Label className="text-xs text-slate-500">Message text *</Label>
                                      <div className="relative">
                                        <Input 
                                          value={widget.minimizedState?.eyeCatcherMessage || ""}
                                          onChange={(e) => updateLocalWidget({ 
                                            minimizedState: { ...widget.minimizedState, eyeCatcherMessage: e.target.value } 
                                          })}
                                        />
                                        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7">
                                          <Smile className="h-4 w-4 text-slate-400" />
                                        </Button>
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
                          <AccordionContent className="pb-4">
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label className="text-xs text-slate-500">Greeting *</Label>
                                <div className="relative">
                                  <Input 
                                    value={widget.welcomeTitle}
                                    onChange={(e) => updateLocalWidget({ welcomeTitle: e.target.value })}
                                  />
                                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7">
                                    <Smile className="h-4 w-4 text-slate-400" />
                                  </Button>
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
                      <div className="space-y-4 pl-12">
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-3">
                            <MessageSquare className="h-5 w-5 text-blue-500" />
                            <div>
                              <p className="text-sm font-medium">Start a live chat</p>
                              <p className="text-xs text-slate-500">Real-time conversation with visitors</p>
                            </div>
                          </div>
                          <Switch 
                            checked={widget.channels.liveChat}
                            onCheckedChange={(checked) => updateMutation.mutate({ channels: { ...widget.channels, liveChat: checked } })}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-3">
                            <Mail className="h-5 w-5 text-orange-500" />
                            <div>
                              <p className="text-sm font-medium">Send an email</p>
                              <p className="text-xs text-slate-500">Let visitors contact you via email</p>
                            </div>
                          </div>
                          <Switch 
                            checked={widget.channels.email}
                            onCheckedChange={(checked) => updateMutation.mutate({ channels: { ...widget.channels, email: checked } })}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-3">
                            <Send className="h-5 w-5 text-green-500" />
                            <div>
                              <p className="text-sm font-medium">Send a text</p>
                              <p className="text-xs text-slate-500">Allow SMS messaging</p>
                            </div>
                          </div>
                          <Switch 
                            checked={widget.channels.sms}
                            onCheckedChange={(checked) => updateMutation.mutate({ channels: { ...widget.channels, sms: checked } })}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-3">
                            <Phone className="h-5 w-5 text-blue-600" />
                            <div>
                              <p className="text-sm font-medium">Call us</p>
                              <p className="text-xs text-slate-500">Voice call option</p>
                            </div>
                          </div>
                          <Switch 
                            checked={widget.channels.phone}
                            onCheckedChange={(checked) => updateMutation.mutate({ channels: { ...widget.channels, phone: checked } })}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-3">
                            <SiWhatsapp className="h-5 w-5 text-green-500" />
                            <div>
                              <p className="text-sm font-medium">Chat on WhatsApp</p>
                              <p className="text-xs text-slate-500">WhatsApp messaging</p>
                            </div>
                          </div>
                          <Switch 
                            checked={widget.channels.whatsapp}
                            onCheckedChange={(checked) => updateMutation.mutate({ channels: { ...widget.channels, whatsapp: checked } })}
                          />
                        </div>
                      </div>
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
                      <div className="space-y-4 pl-12">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Countries</Label>
                          <Select 
                            value={widget.targeting.countries}
                            onValueChange={(v) => updateMutation.mutate({ targeting: { ...widget.targeting, countries: v as "all" | "selected" | "excluded" } })}
                          >
                            <SelectTrigger className="w-full max-w-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All countries</SelectItem>
                              <SelectItem value="selected">Selected countries only</SelectItem>
                              <SelectItem value="excluded">Exclude specific countries</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Schedule</Label>
                          <Select 
                            value={widget.targeting.schedule}
                            onValueChange={(v) => updateMutation.mutate({ targeting: { ...widget.targeting, schedule: v as "always" | "custom" } })}
                          >
                            <SelectTrigger className="w-full max-w-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="always">Always visible</SelectItem>
                              <SelectItem value="custom">Custom schedule</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Device type</Label>
                          <Select 
                            value={widget.targeting.deviceType}
                            onValueChange={(v) => updateMutation.mutate({ targeting: { ...widget.targeting, deviceType: v as "all" | "desktop" | "mobile" } })}
                          >
                            <SelectTrigger className="w-full max-w-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All devices</SelectItem>
                              <SelectItem value="desktop">Desktop only</SelectItem>
                              <SelectItem value="mobile">Mobile only</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
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
                            onClick={() => window.open(`/widget-preview/${widgetId}`, "_blank")}
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

          <div className="w-full lg:w-80 shrink-0">
            <Card className="border-slate-200 dark:border-slate-800 sticky top-6">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Widget preview</h3>
                
                <div 
                  className="rounded-lg overflow-hidden shadow-lg"
                  style={{ 
                    background: widget.themeType === "gradient" 
                      ? `linear-gradient(135deg, ${currentColor.hex}, ${currentColor.hex}dd)` 
                      : currentColor.hex 
                  }}
                >
                  <div className="p-4 text-white">
                    <h4 className="text-lg font-bold">{widget.welcomeTitle}</h4>
                    <p className="text-sm opacity-90 mt-1">{widget.welcomeMessage}</p>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-900 p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">How can we help you today?</p>
                      <div className="border rounded-lg p-3">
                        <p className="text-sm text-slate-400">Type your message here</p>
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full"
                      style={{ backgroundColor: currentColor.hex }}
                    >
                      Start chat
                    </Button>
                    
                    {widget.channels.sms && (
                      <div className="flex items-center justify-between py-2 border-t">
                        <div className="flex items-center gap-2">
                          <Send className="h-4 w-4 text-slate-500" />
                          <span className="text-sm text-slate-700 dark:text-slate-300">Send a text</span>
                        </div>
                        <ChevronLeft className="h-4 w-4 text-slate-400 rotate-180" />
                      </div>
                    )}
                    
                    {widget.channels.phone && (
                      <div className="flex items-center justify-between py-2 border-t">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-slate-500" />
                          <span className="text-sm text-slate-700 dark:text-slate-300">Call us</span>
                        </div>
                        <ChevronLeft className="h-4 w-4 text-slate-400 rotate-180" />
                      </div>
                    )}
                    
                    <div className="text-center pt-2">
                      <p className="text-xs text-slate-400">Powered by <span className="text-blue-500">Curbe</span></p>
                    </div>
                  </div>
                </div>
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
