import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";
import { 
  Phone, 
  Settings, 
  Users, 
  ListOrdered, 
  Plus, 
  Trash2, 
  Edit, 
  PhoneIncoming,
  Voicemail,
  Clock,
  Music,
  Mic,
  Upload,
  Play,
  Pause,
  Volume2
} from "lucide-react";

interface PbxSettings {
  id: string;
  companyId: string;
  primaryPhoneNumberId: string | null;
  ivrEnabled: boolean;
  ivrExtension: string | null;
  greetingAudioUrl: string | null;
  greetingText: string | null;
  useTextToSpeech: boolean;
  holdMusicUrl: string | null;
  ivrTimeout: number;
  queueTimeout: number;
  ringTimeout: number;
  voicemailEnabled: boolean;
  voicemailGreetingUrl: string | null;
  voicemailEmail: string | null;
  businessHoursEnabled: boolean;
  businessHoursStart: string | null;
  businessHoursEnd: string | null;
  businessHoursTimezone: string | null;
  afterHoursAction: string | null;
  afterHoursForwardNumber: string | null;
}

interface PbxQueue {
  id: string;
  name: string;
  description: string | null;
  ringStrategy: string;
  ringTimeout: number;
  maxWaitTime: number;
  status: string;
}

interface PbxExtension {
  id: string;
  extension: string;
  displayName: string | null;
  userId: string;
  voicemailEnabled: boolean;
  isActive: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface PbxMenuOption {
  id: string;
  digit: string;
  label: string;
  actionType: string;
  targetQueueId: string | null;
  targetExtensionId: string | null;
  targetExternalNumber: string | null;
  isActive: boolean;
}

export function PbxSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [showQueueDialog, setShowQueueDialog] = useState(false);
  const [showExtensionDialog, setShowExtensionDialog] = useState(false);
  const [showMenuDialog, setShowMenuDialog] = useState(false);
  const [editingQueue, setEditingQueue] = useState<PbxQueue | null>(null);
  const [editingExtension, setEditingExtension] = useState<PbxExtension | null>(null);
  const [editingMenuOption, setEditingMenuOption] = useState<PbxMenuOption | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [localIvrExtension, setLocalIvrExtension] = useState("100");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery<PbxSettings>({
    queryKey: ["/api/pbx/settings"],
  });

  const { data: queues = [], isLoading: queuesLoading } = useQuery<PbxQueue[]>({
    queryKey: ["/api/pbx/queues"],
  });

  const { data: extensions = [], isLoading: extensionsLoading } = useQuery<PbxExtension[]>({
    queryKey: ["/api/pbx/extensions"],
  });

  const { data: menuOptions = [] } = useQuery<PbxMenuOption[]>({
    queryKey: ["/api/pbx/menu-options", settings?.id],
    enabled: !!settings?.id,
  });

  const settingsMutation = useMutation({
    mutationFn: async (data: Partial<PbxSettings>) => {
      return apiRequest("POST", "/api/pbx/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/settings"] });
      toast({ title: "Settings saved", description: "PBX settings updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const uploadGreetingMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('audio', file);
      const response = await fetch('/api/pbx/ivr-greeting', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/settings"] });
      toast({ title: "Audio uploaded", description: "IVR greeting audio uploaded successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteGreetingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/pbx/ivr-greeting");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/settings"] });
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      }
      toast({ title: "Audio deleted", description: "IVR greeting audio removed." });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadGreetingMutation.mutate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleAudioPlayback = () => {
    if (!settings?.greetingAudioUrl) return;
    
    if (!audioRef.current) {
      audioRef.current = new Audio(settings.greetingAudioUrl);
      audioRef.current.onended = () => setIsPlayingAudio(false);
    }
    
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const queueMutation = useMutation({
    mutationFn: async (data: { id?: string; name: string; description?: string; ringStrategy: string }) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/pbx/queues/${data.id}`, data);
      }
      return apiRequest("POST", "/api/pbx/queues", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/queues"] });
      setShowQueueDialog(false);
      setEditingQueue(null);
      toast({ title: "Queue saved", description: "Call queue updated successfully." });
    },
  });

  const deleteQueueMutation = useMutation({
    mutationFn: async (queueId: string) => {
      return apiRequest("DELETE", `/api/pbx/queues/${queueId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/queues"] });
      toast({ title: "Queue deleted" });
    },
  });

  const extensionMutation = useMutation({
    mutationFn: async (data: { id?: string; extension: string; userId: string; displayName?: string }) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/pbx/extensions/${data.id}`, data);
      }
      return apiRequest("POST", "/api/pbx/extensions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/extensions"] });
      setShowExtensionDialog(false);
      setEditingExtension(null);
      toast({ title: "Extension saved" });
    },
  });

  const deleteExtensionMutation = useMutation({
    mutationFn: async (extensionId: string) => {
      return apiRequest("DELETE", `/api/pbx/extensions/${extensionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/extensions"] });
      toast({ title: "Extension deleted" });
    },
  });

  const menuOptionMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/pbx/menu-options/${data.id}`, data);
      }
      return apiRequest("POST", "/api/pbx/menu-options", { ...data, pbxSettingsId: settings?.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/menu-options", settings?.id] });
      setShowMenuDialog(false);
      setEditingMenuOption(null);
      toast({ title: "Menu option saved" });
    },
  });

  const deleteMenuOptionMutation = useMutation({
    mutationFn: async (optionId: string) => {
      return apiRequest("DELETE", `/api/pbx/menu-options/${optionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/menu-options", settings?.id] });
      toast({ title: "Menu option deleted" });
    },
  });

  const handleSettingChange = (key: keyof PbxSettings, value: any) => {
    settingsMutation.mutate({ [key]: value });
  };

  // Sync local IVR extension state with server data
  useEffect(() => {
    if (settings?.ivrExtension) {
      setLocalIvrExtension(settings.ivrExtension);
    }
  }, [settings?.ivrExtension]);

  // Handle IVR extension save on blur with validation
  const handleIvrExtensionBlur = () => {
    // Validate: must be a positive integer >= 100
    const parsed = parseInt(localIvrExtension, 10);
    if (isNaN(parsed) || parsed < 100 || localIvrExtension.trim() === '') {
      // Invalid value - restore to server value or default
      setLocalIvrExtension(settings?.ivrExtension || "100");
      return;
    }
    // Only save if value actually changed
    const validValue = parsed.toString();
    if (validValue !== settings?.ivrExtension) {
      handleSettingChange("ivrExtension", validValue);
    }
  };

  if (settingsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">PBX Settings</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Configure your IVR, call queues, and extensions
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="general" data-testid="tab-pbx-general">
            <Settings className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="ivr" data-testid="tab-pbx-ivr">
            <PhoneIncoming className="w-4 h-4 mr-2" />
            IVR Menu
          </TabsTrigger>
          <TabsTrigger value="queues" data-testid="tab-pbx-queues">
            <ListOrdered className="w-4 h-4 mr-2" />
            Queues
          </TabsTrigger>
          <TabsTrigger value="extensions" data-testid="tab-pbx-extensions">
            <Users className="w-4 h-4 mr-2" />
            Extensions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                IVR Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable IVR</Label>
                      <p className="text-sm text-slate-500">Play a greeting and offer menu options to callers</p>
                    </div>
                    <Switch
                      checked={settings?.ivrEnabled || false}
                      onCheckedChange={(checked) => handleSettingChange("ivrEnabled", checked)}
                      data-testid="switch-ivr-enabled"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Use Text-to-Speech</Label>
                      <p className="text-sm text-slate-500">Generate greeting audio from text</p>
                    </div>
                    <Switch
                      checked={settings?.useTextToSpeech || false}
                      onCheckedChange={(checked) => handleSettingChange("useTextToSpeech", checked)}
                      data-testid="switch-use-tts"
                    />
                  </div>
                </div>
              </div>

              {settings?.useTextToSpeech ? (
                <div className="space-y-2">
                  <Label>Greeting Text</Label>
                  <Textarea
                    placeholder="Welcome to our company. Press 1 for sales, press 2 for support, or stay on the line to speak with an operator."
                    value={settings?.greetingText || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTimeout(() => handleSettingChange("greetingText", value), 500);
                    }}
                    data-testid="input-greeting-text"
                    rows={4}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <Label>Greeting Audio</Label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".mp3,.wav,audio/mpeg,audio/wav"
                    className="hidden"
                    data-testid="input-greeting-audio-file"
                  />
                  
                  {settings?.greetingAudioUrl ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleAudioPlayback}
                        className="h-10 w-10 p-0"
                        data-testid="button-play-greeting"
                      >
                        {isPlayingAudio ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">Greeting Audio</p>
                        <p className="text-xs text-muted-foreground">Click to preview</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadGreetingMutation.isPending}
                          data-testid="button-replace-greeting"
                        >
                          {uploadGreetingMutation.isPending ? (
                            <LoadingSpinner fullScreen={false} />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteGreetingMutation.mutate()}
                          disabled={deleteGreetingMutation.isPending}
                          className="text-red-500 hover:text-red-600"
                          data-testid="button-delete-greeting"
                        >
                          {deleteGreetingMutation.isPending ? (
                            <LoadingSpinner fullScreen={false} />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-upload-greeting"
                    >
                      {uploadGreetingMutation.isPending ? (
                        <LoadingSpinner fullScreen={false} />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-sm font-medium text-foreground">Upload greeting audio</p>
                          <p className="text-xs text-muted-foreground mt-1">MP3 or WAV (max 5MB)</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>IVR Extension Number</Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={localIvrExtension}
                  onChange={(e) => setLocalIvrExtension(e.target.value)}
                  onBlur={handleIvrExtensionBlur}
                  data-testid="input-ivr-extension"
                />
                <p className="text-xs text-muted-foreground">
                  User extensions will start from {(parseInt(localIvrExtension, 10) || 100) + 1}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>IVR Timeout (seconds)</Label>
                  <Input
                    type="number"
                    value={settings?.ivrTimeout || 10}
                    onChange={(e) => handleSettingChange("ivrTimeout", parseInt(e.target.value))}
                    data-testid="input-ivr-timeout"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ring Timeout (seconds)</Label>
                  <Input
                    type="number"
                    value={settings?.ringTimeout || 30}
                    onChange={(e) => handleSettingChange("ringTimeout", parseInt(e.target.value))}
                    data-testid="input-ring-timeout"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Voicemail className="w-5 h-5" />
                Voicemail Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Voicemail</Label>
                  <p className="text-sm text-slate-500">Allow callers to leave voicemails when agents are unavailable</p>
                </div>
                <Switch
                  checked={settings?.voicemailEnabled || false}
                  onCheckedChange={(checked) => handleSettingChange("voicemailEnabled", checked)}
                  data-testid="switch-voicemail-enabled"
                />
              </div>

              <div className="space-y-2">
                <Label>Voicemail Notification Email</Label>
                <Input
                  type="email"
                  placeholder="voicemail@company.com"
                  value={settings?.voicemailEmail || ""}
                  onChange={(e) => handleSettingChange("voicemailEmail", e.target.value)}
                  data-testid="input-voicemail-email"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Business Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Business Hours</Label>
                  <p className="text-sm text-slate-500">Route calls differently outside business hours</p>
                </div>
                <Switch
                  checked={settings?.businessHoursEnabled || false}
                  onCheckedChange={(checked) => handleSettingChange("businessHoursEnabled", checked)}
                  data-testid="switch-business-hours"
                />
              </div>

              {settings?.businessHoursEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={settings?.businessHoursStart || "09:00"}
                        onChange={(e) => handleSettingChange("businessHoursStart", e.target.value)}
                        data-testid="input-business-hours-start"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={settings?.businessHoursEnd || "17:00"}
                        onChange={(e) => handleSettingChange("businessHoursEnd", e.target.value)}
                        data-testid="input-business-hours-end"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>After Hours Action</Label>
                    <Select
                      value={settings?.afterHoursAction || "voicemail"}
                      onValueChange={(value) => handleSettingChange("afterHoursAction", value)}
                    >
                      <SelectTrigger data-testid="select-after-hours-action">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="voicemail">Go to Voicemail</SelectItem>
                        <SelectItem value="message">Play Message & Hang Up</SelectItem>
                        <SelectItem value="forward">Forward to Number</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {settings?.afterHoursAction === "forward" && (
                    <div className="space-y-2">
                      <Label>Forward Number</Label>
                      <Input
                        placeholder="+1XXXXXXXXXX"
                        value={settings?.afterHoursForwardNumber || ""}
                        onChange={(e) => handleSettingChange("afterHoursForwardNumber", e.target.value)}
                        data-testid="input-forward-number"
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ivr" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ListOrdered className="w-5 h-5" />
                IVR Menu Options
              </CardTitle>
              <Button onClick={() => setShowMenuDialog(true)} data-testid="button-add-menu-option">
                <Plus className="w-4 h-4 mr-2" />
                Add Option
              </Button>
            </CardHeader>
            <CardContent>
              {menuOptions.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No menu options configured</p>
                  <p className="text-sm">Add options like "Press 1 for sales" to your IVR</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {menuOptions.map((option) => (
                      <TableRow key={option.id}>
                        <TableCell className="font-mono font-bold">{option.digit}</TableCell>
                        <TableCell>{option.label}</TableCell>
                        <TableCell className="capitalize">{option.actionType.replace("_", " ")}</TableCell>
                        <TableCell>
                          {option.actionType === "queue" && queues.find(q => q.id === option.targetQueueId)?.name}
                          {option.actionType === "extension" && extensions.find(e => e.id === option.targetExtensionId)?.extension}
                          {option.actionType === "external" && option.targetExternalNumber}
                          {option.actionType === "voicemail" && "Voicemail"}
                          {option.actionType === "hangup" && "Hang Up"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={option.isActive ? "default" : "secondary"}>
                            {option.isActive ? "Active" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingMenuOption(option);
                              setShowMenuDialog(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMenuOptionMutation.mutate(option.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queues" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Call Queues
              </CardTitle>
              <Button onClick={() => setShowQueueDialog(true)} data-testid="button-add-queue">
                <Plus className="w-4 h-4 mr-2" />
                Add Queue
              </Button>
            </CardHeader>
            <CardContent>
              {queuesLoading ? (
                <LoadingSpinner fullScreen={false} />
              ) : queues.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No call queues configured</p>
                  <p className="text-sm">Create queues to distribute calls among agents</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Ring Strategy</TableHead>
                      <TableHead>Timeout</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queues.map((queue) => (
                      <TableRow key={queue.id}>
                        <TableCell className="font-medium">{queue.name}</TableCell>
                        <TableCell className="capitalize">{queue.ringStrategy.replace("_", " ")}</TableCell>
                        <TableCell>{queue.ringTimeout}s</TableCell>
                        <TableCell>
                          <Badge variant={queue.status === "active" ? "default" : "secondary"}>
                            {queue.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingQueue(queue);
                              setShowQueueDialog(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteQueueMutation.mutate(queue.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extensions" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Extensions
              </CardTitle>
              <Button onClick={() => setShowExtensionDialog(true)} data-testid="button-add-extension">
                <Plus className="w-4 h-4 mr-2" />
                Add Extension
              </Button>
            </CardHeader>
            <CardContent>
              {extensionsLoading ? (
                <LoadingSpinner fullScreen={false} />
              ) : extensions.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No extensions configured</p>
                  <p className="text-sm">Assign extension numbers to users</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Extension</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Voicemail</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extensions.map((ext) => (
                      <TableRow key={ext.id}>
                        <TableCell className="font-mono font-bold">{ext.extension}</TableCell>
                        <TableCell>{ext.displayName || "-"}</TableCell>
                        <TableCell>{ext.user?.firstName} {ext.user?.lastName}</TableCell>
                        <TableCell>
                          <Badge variant={ext.voicemailEnabled ? "default" : "secondary"}>
                            {ext.voicemailEnabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ext.isActive ? "default" : "secondary"}>
                            {ext.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingExtension(ext);
                              setShowExtensionDialog(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteExtensionMutation.mutate(ext.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <QueueDialog
        open={showQueueDialog}
        onOpenChange={setShowQueueDialog}
        queue={editingQueue}
        onSubmit={(data) => queueMutation.mutate(data)}
        isPending={queueMutation.isPending}
      />

      <ExtensionDialog
        open={showExtensionDialog}
        onOpenChange={setShowExtensionDialog}
        extension={editingExtension}
        onSubmit={(data) => extensionMutation.mutate(data)}
        isPending={extensionMutation.isPending}
      />

      <MenuOptionDialog
        open={showMenuDialog}
        onOpenChange={setShowMenuDialog}
        option={editingMenuOption}
        queues={queues}
        extensions={extensions}
        onSubmit={(data) => menuOptionMutation.mutate(data)}
        isPending={menuOptionMutation.isPending}
      />
    </div>
  );
}

function QueueDialog({
  open,
  onOpenChange,
  queue,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: PbxQueue | null;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ringStrategy, setRingStrategy] = useState("ring_all");

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && queue) {
      setName(queue.name);
      setDescription(queue.description || "");
      setRingStrategy(queue.ringStrategy);
    } else if (!isOpen) {
      setName("");
      setDescription("");
      setRingStrategy("ring_all");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{queue ? "Edit Queue" : "Create Queue"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Queue Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sales, Support, etc."
              data-testid="input-queue-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              data-testid="input-queue-description"
            />
          </div>
          <div className="space-y-2">
            <Label>Ring Strategy</Label>
            <Select value={ringStrategy} onValueChange={setRingStrategy}>
              <SelectTrigger data-testid="select-ring-strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ring_all">Ring All</SelectItem>
                <SelectItem value="round_robin">Round Robin</SelectItem>
                <SelectItem value="least_recent">Least Recent</SelectItem>
                <SelectItem value="random">Random</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit({ id: queue?.id, name, description, ringStrategy })}
            disabled={isPending || !name}
            data-testid="button-save-queue"
          >
            {isPending ? <LoadingSpinner fullScreen={false} /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExtensionDialog({
  open,
  onOpenChange,
  extension,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extension: PbxExtension | null;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [ext, setExt] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [userId, setUserId] = useState("");

  const { data: usersData } = useQuery<{ users: any[] }>({
    queryKey: ["/api/users"],
  });
  const users = usersData?.users || [];

  // Sync form state when extension prop changes or dialog opens
  useEffect(() => {
    if (open) {
      if (extension) {
        setExt(extension.extension);
        setDisplayName(extension.displayName || "");
        setUserId(extension.userId);
      } else {
        // Reset form for creating new extension
        setExt("");
        setDisplayName("");
        setUserId("");
      }
    }
  }, [open, extension]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset form when closing
      setExt("");
      setDisplayName("");
      setUserId("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{extension ? "Edit Extension" : "Create Extension"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Extension Number</Label>
            <Input
              value={ext}
              onChange={(e) => setExt(e.target.value)}
              placeholder="101, 102, etc."
              data-testid="input-extension-number"
            />
          </div>
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John's Desk"
              data-testid="input-extension-name"
            />
          </div>
          <div className="space-y-2">
            <Label>User</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger data-testid="select-extension-user">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user: any) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit({ id: extension?.id, extension: ext, displayName, userId })}
            disabled={isPending || !ext || !userId}
            data-testid="button-save-extension"
          >
            {isPending ? <LoadingSpinner fullScreen={false} /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MenuOptionDialog({
  open,
  onOpenChange,
  option,
  queues,
  extensions,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option: PbxMenuOption | null;
  queues: PbxQueue[];
  extensions: PbxExtension[];
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [digit, setDigit] = useState("");
  const [label, setLabel] = useState("");
  const [actionType, setActionType] = useState("queue");
  const [targetQueueId, setTargetQueueId] = useState("");
  const [targetExtensionId, setTargetExtensionId] = useState("");
  const [targetExternalNumber, setTargetExternalNumber] = useState("");

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && option) {
      setDigit(option.digit);
      setLabel(option.label);
      setActionType(option.actionType);
      setTargetQueueId(option.targetQueueId || "");
      setTargetExtensionId(option.targetExtensionId || "");
      setTargetExternalNumber(option.targetExternalNumber || "");
    } else if (!isOpen) {
      setDigit("");
      setLabel("");
      setActionType("queue");
      setTargetQueueId("");
      setTargetExtensionId("");
      setTargetExternalNumber("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{option ? "Edit Menu Option" : "Create Menu Option"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Key (0-9, *, #)</Label>
              <Input
                value={digit}
                onChange={(e) => setDigit(e.target.value)}
                placeholder="1"
                maxLength={1}
                data-testid="input-menu-digit"
              />
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Sales"
                data-testid="input-menu-label"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger data-testid="select-menu-action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="queue">Route to Queue</SelectItem>
                <SelectItem value="extension">Route to Extension</SelectItem>
                <SelectItem value="external">Forward to External Number</SelectItem>
                <SelectItem value="voicemail">Go to Voicemail</SelectItem>
                <SelectItem value="hangup">Hang Up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {actionType === "queue" && (
            <div className="space-y-2">
              <Label>Target Queue</Label>
              <Select value={targetQueueId} onValueChange={setTargetQueueId}>
                <SelectTrigger data-testid="select-target-queue">
                  <SelectValue placeholder="Select queue" />
                </SelectTrigger>
                <SelectContent>
                  {queues.map((queue) => (
                    <SelectItem key={queue.id} value={queue.id}>
                      {queue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === "extension" && (
            <div className="space-y-2">
              <Label>Target Extension</Label>
              <Select value={targetExtensionId} onValueChange={setTargetExtensionId}>
                <SelectTrigger data-testid="select-target-extension">
                  <SelectValue placeholder="Select extension" />
                </SelectTrigger>
                <SelectContent>
                  {extensions.map((ext) => (
                    <SelectItem key={ext.id} value={ext.id}>
                      {ext.extension} - {ext.displayName || ext.user?.firstName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === "external" && (
            <div className="space-y-2">
              <Label>External Number</Label>
              <Input
                value={targetExternalNumber}
                onChange={(e) => setTargetExternalNumber(e.target.value)}
                placeholder="+1XXXXXXXXXX"
                data-testid="input-external-number"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                id: option?.id,
                digit,
                label,
                actionType,
                targetQueueId: actionType === "queue" ? targetQueueId : null,
                targetExtensionId: actionType === "extension" ? targetExtensionId : null,
                targetExternalNumber: actionType === "external" ? targetExternalNumber : null,
              })
            }
            disabled={isPending || !digit || !label}
            data-testid="button-save-menu-option"
          >
            {isPending ? <LoadingSpinner fullScreen={false} /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
