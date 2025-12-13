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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";
import { 
  Phone, 
  Settings, 
  Users, 
  ListOrdered, 
  Plus, 
  Edit, 
  PhoneIncoming,
  Voicemail,
  Clock,
  Music,
  Mic,
  Upload,
  Play,
  Pause,
  Volume2,
  Languages,
  Star,
  Library,
  FileAudio,
  MoreVertical,
  Trash2
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
  extension: string | null;
  ringStrategy: string;
  ringTimeout: number;
  maxWaitTime: number;
  holdMusicUrl: string | null;
  holdMusicPlaybackMode: string | null;
  status: string;
  adsEnabled: boolean;
  adsIntervalMin: number | null;
  adsIntervalMax: number | null;
}

interface QueueAd {
  id: string;
  queueId: string;
  audioFileId: string;
  displayOrder: number;
  isActive: boolean;
  audioFile: {
    id: string;
    name: string;
    fileUrl: string;
    duration: number | null;
  };
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
  targetIvrId: string | null;
  isActive: boolean;
}

interface PbxIvr {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  extension: string;
  language: string;
  greetingAudioUrl: string | null;
  greetingMediaName: string | null;
  greetingText: string | null;
  useTextToSpeech: boolean;
  ivrTimeout: number;
  maxRetries: number;
  isDefault: boolean;
  isActive: boolean;
}

interface PbxAudioFile {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  notes: string | null;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  duration: number | null;
  mimeType: string | null;
  audioType: string;
  createdAt: string;
  usage: { type: string; name: string; id: string }[];
}

export function PbxSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [showQueueDialog, setShowQueueDialog] = useState(false);
  const [showExtensionDialog, setShowExtensionDialog] = useState(false);
  const [showMenuDialog, setShowMenuDialog] = useState(false);
  const [showIvrDialog, setShowIvrDialog] = useState(false);
  const [showIvrMenuDialog, setShowIvrMenuDialog] = useState(false);
  const [editingQueue, setEditingQueue] = useState<PbxQueue | null>(null);
  const [editingExtension, setEditingExtension] = useState<PbxExtension | null>(null);
  const [editingMenuOption, setEditingMenuOption] = useState<PbxMenuOption | null>(null);
  const [editingIvr, setEditingIvr] = useState<PbxIvr | null>(null);
  const [editingIvrMenuOption, setEditingIvrMenuOption] = useState<PbxMenuOption | null>(null);
  const [selectedIvrId, setSelectedIvrId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showAudioDialog, setShowAudioDialog] = useState(false);
  const [editingAudio, setEditingAudio] = useState<PbxAudioFile | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const libraryAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioLibraryInputRef = useRef<HTMLInputElement>(null);

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

  const { data: ivrs = [], isLoading: ivrsLoading } = useQuery<PbxIvr[]>({
    queryKey: ["/api/pbx/ivrs"],
  });

  const { data: ivrMenuOptions = [] } = useQuery<PbxMenuOption[]>({
    queryKey: [`/api/pbx/ivrs/${selectedIvrId}/menu-options`],
    enabled: !!selectedIvrId,
  });

  const { data: audioFilesData, isLoading: audioFilesLoading } = useQuery<{ audioFiles: PbxAudioFile[] }>({
    queryKey: ["/api/pbx/audio"],
  });
  const audioFiles = audioFilesData?.audioFiles ?? [];

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
    mutationFn: async (data: { id?: string; name: string; description?: string; ringStrategy: string; memberIds?: string[]; holdMusicPlaybackMode?: string; holdMusicAudioIds?: string[] }) => {
      const { memberIds, holdMusicAudioIds, ...queueData } = data;
      let queueId = data.id;
      
      if (data.id) {
        await apiRequest("PATCH", `/api/pbx/queues/${data.id}`, queueData);
      } else {
        const result = await apiRequest("POST", "/api/pbx/queues", queueData);
        queueId = result.id;
      }
      
      if (queueId && memberIds !== undefined) {
        await apiRequest("PUT", `/api/pbx/queues/${queueId}/members/sync`, { memberIds });
      }
      
      if (queueId && holdMusicAudioIds !== undefined) {
        await apiRequest("PUT", `/api/pbx/queues/${queueId}/hold-music/sync`, { audioFileIds: holdMusicAudioIds });
      }
      
      return { queueId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/queues"] });
      if (result.queueId) {
        queryClient.invalidateQueries({ queryKey: [`/api/pbx/queues/${result.queueId}/members`] });
        queryClient.invalidateQueries({ queryKey: [`/api/pbx/queues/${result.queueId}/hold-music`] });
      }
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

  const ivrMutation = useMutation({
    mutationFn: async (data: Partial<PbxIvr> & { id?: string }) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/pbx/ivrs/${data.id}`, data);
      }
      return apiRequest("POST", "/api/pbx/ivrs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/ivrs"] });
      setShowIvrDialog(false);
      setEditingIvr(null);
      toast({ title: "IVR saved", description: "IVR configuration updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteIvrMutation = useMutation({
    mutationFn: async (ivrId: string) => {
      return apiRequest("DELETE", `/api/pbx/ivrs/${ivrId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/ivrs"] });
      if (selectedIvrId) {
        setSelectedIvrId(null);
      }
      toast({ title: "IVR deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const setDefaultIvrMutation = useMutation({
    mutationFn: async (ivrId: string) => {
      return apiRequest("PATCH", `/api/pbx/ivrs/${ivrId}`, { isDefault: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/ivrs"] });
      toast({ title: "Default IVR updated" });
    },
  });

  const ivrMenuOptionMutation = useMutation({
    mutationFn: async (data: any & { ivrId: string }) => {
      const ivrId = data.ivrId || selectedIvrId;
      if (data.id) {
        return apiRequest("PATCH", `/api/pbx/ivrs/${ivrId}/menu-options/${data.id}`, data);
      }
      return apiRequest("POST", `/api/pbx/ivrs/${ivrId}/menu-options`, data);
    },
    onSuccess: (_data, variables) => {
      const ivrId = variables.ivrId || selectedIvrId;
      queryClient.invalidateQueries({ queryKey: [`/api/pbx/ivrs/${ivrId}/menu-options`] });
      setShowIvrMenuDialog(false);
      setEditingIvrMenuOption(null);
      toast({ title: "Menu option saved" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteIvrMenuOptionMutation = useMutation({
    mutationFn: async ({ optionId, ivrId }: { optionId: string; ivrId: string }) => {
      return apiRequest("DELETE", `/api/pbx/ivrs/${ivrId}/menu-options/${optionId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/pbx/ivrs/${variables.ivrId}/menu-options`] });
      toast({ title: "Menu option deleted" });
    },
  });

  const uploadIvrGreetingMutation = useMutation({
    mutationFn: async ({ ivrId, file }: { ivrId: string; file: File }) => {
      const formData = new FormData();
      formData.append('audio', file);
      const response = await fetch(`/api/pbx/ivrs/${ivrId}/upload-greeting`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/ivrs"] });
      toast({ title: "Audio uploaded", description: "IVR greeting audio uploaded successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteIvrGreetingMutation = useMutation({
    mutationFn: async (ivrId: string) => {
      return apiRequest("DELETE", `/api/pbx/ivrs/${ivrId}/greeting`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/ivrs"] });
      toast({ title: "Audio deleted", description: "IVR greeting audio removed." });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const uploadAudioFileMutation = useMutation({
    mutationFn: async (data: { file: File; name: string; description?: string; notes?: string; audioType: string }) => {
      const formData = new FormData();
      formData.append('audio', data.file);
      formData.append('name', data.name);
      if (data.description) formData.append('description', data.description);
      if (data.notes) formData.append('notes', data.notes);
      formData.append('audioType', data.audioType);
      const response = await fetch('/api/pbx/audio', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/audio"] });
      setShowAudioDialog(false);
      toast({ title: "Audio uploaded", description: "Audio file added to library." });
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const updateAudioFileMutation = useMutation({
    mutationFn: async (data: { audioId: string; name?: string; description?: string; notes?: string }) => {
      const { audioId, ...body } = data;
      return apiRequest("PATCH", `/api/pbx/audio/${audioId}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/audio"] });
      setEditingAudio(null);
      toast({ title: "Audio updated", description: "Audio file details saved." });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteAudioFileMutation = useMutation({
    mutationFn: async ({ audioId, force = false }: { audioId: string; force?: boolean }) => {
      return apiRequest("DELETE", `/api/pbx/audio/${audioId}${force ? '?force=true' : ''}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/audio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/queues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pbx/ivrs"] });
      setAudioToDelete(null);
      toast({ title: "Audio deleted", description: "Audio file removed from library." });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const [audioToDelete, setAudioToDelete] = useState<PbxAudioFile | null>(null);

  const toggleLibraryAudioPlayback = (audioFile: PbxAudioFile) => {
    if (playingAudioId === audioFile.id) {
      libraryAudioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (libraryAudioRef.current) {
        libraryAudioRef.current.pause();
      }
      libraryAudioRef.current = new Audio(audioFile.fileUrl);
      libraryAudioRef.current.onended = () => setPlayingAudioId(null);
      libraryAudioRef.current.play();
      setPlayingAudioId(audioFile.id);
    }
  };

  const getAudioTypeLabel = (type: string) => {
    switch (type) {
      case 'greeting': return 'IVR Greeting';
      case 'hold_music': return 'Hold Music';
      case 'announcement': return 'Announcement';
      case 'voicemail_greeting': return 'Voicemail Greeting';
      default: return type;
    }
  };

  const getUsageLabel = (usage: { type: string; name: string }) => {
    switch (usage.type) {
      case 'ivr_greeting': return `IVR: ${usage.name}`;
      case 'queue_hold_music': return `Queue: ${usage.name}`;
      default: return usage.name;
    }
  };

  const handleSettingChange = (key: keyof PbxSettings, value: any) => {
    settingsMutation.mutate({ [key]: value });
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
          <TabsTrigger value="ivrs" data-testid="tab-pbx-ivrs">
            <Languages className="w-4 h-4 mr-2" />
            IVRs
          </TabsTrigger>
          <TabsTrigger value="queues" data-testid="tab-pbx-queues">
            <ListOrdered className="w-4 h-4 mr-2" />
            Queues
          </TabsTrigger>
          <TabsTrigger value="extensions" data-testid="tab-pbx-extensions">
            <Users className="w-4 h-4 mr-2" />
            Extensions
          </TabsTrigger>
          <TabsTrigger value="audio" data-testid="tab-pbx-audio">
            <Library className="w-4 h-4 mr-2" />
            Audio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
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

        <TabsContent value="ivrs" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Languages className="w-5 h-5" />
                  IVR List
                </CardTitle>
                <Button size="sm" onClick={() => { setEditingIvr(null); setShowIvrDialog(true); }} data-testid="button-add-ivr">
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {ivrsLoading ? (
                  <div className="p-6">
                    <LoadingSpinner fullScreen={false} />
                  </div>
                ) : ivrs.length === 0 ? (
                  <div className="text-center py-8 px-4 text-slate-500">
                    <Languages className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No IVRs configured</p>
                    <p className="text-xs mt-1">Create IVRs for different languages or departments</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {ivrs.map((ivr) => (
                      <div
                        key={ivr.id}
                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedIvrId === ivr.id ? 'bg-muted' : ''}`}
                        onClick={() => setSelectedIvrId(ivr.id)}
                        data-testid={`ivr-item-${ivr.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{ivr.name}</span>
                              {ivr.isDefault && (
                                <Badge variant="secondary" className="text-xs">
                                  <Star className="w-3 h-3 mr-1" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="font-mono">Ext. {ivr.extension}</span>
                              <span>{ivr.language}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {!ivr.isDefault && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDefaultIvrMutation.mutate(ivr.id);
                                }}
                                title="Set as default"
                                data-testid={`button-set-default-${ivr.id}`}
                              >
                                <Star className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingIvr(ivr);
                                setShowIvrDialog(true);
                              }}
                              data-testid={`button-edit-ivr-${ivr.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Are you sure you want to delete this IVR?")) {
                                  deleteIvrMutation.mutate(ivr.id);
                                }
                              }}
                              data-testid={`button-delete-ivr-${ivr.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ListOrdered className="w-5 h-5" />
                  {selectedIvrId ? `Menu Options - ${ivrs.find(i => i.id === selectedIvrId)?.name}` : 'Menu Options'}
                </CardTitle>
                {selectedIvrId && (
                  <Button size="sm" onClick={() => { setEditingIvrMenuOption(null); setShowIvrMenuDialog(true); }} data-testid="button-add-ivr-menu-option">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Option
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {!selectedIvrId ? (
                  <div className="text-center py-8 text-slate-500">
                    <Mic className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Select an IVR to manage its menu options</p>
                  </div>
                ) : ivrMenuOptions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Mic className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No menu options for this IVR</p>
                    <p className="text-xs mt-1">Add options like "Press 1 for sales"</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ivrMenuOptions.map((option) => (
                        <TableRow key={option.id}>
                          <TableCell className="font-mono font-bold">{option.digit}</TableCell>
                          <TableCell>{option.label}</TableCell>
                          <TableCell className="capitalize">{option.actionType?.replace("_", " ") || "-"}</TableCell>
                          <TableCell>
                            {option.actionType === "queue" && queues.find(q => q.id === option.targetQueueId)?.name}
                            {option.actionType === "extension" && extensions.find(e => e.id === option.targetExtensionId)?.extension}
                            {option.actionType === "external" && option.targetExternalNumber}
                            {option.actionType === "ivr" && ivrs.find(i => i.id === option.targetIvrId)?.name}
                            {option.actionType === "voicemail" && "Voicemail"}
                            {option.actionType === "hangup" && "Hang Up"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingIvrMenuOption(option);
                                setShowIvrMenuDialog(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteIvrMenuOptionMutation.mutate({ optionId: option.id, ivrId: selectedIvrId! })}
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
          </div>
        </TabsContent>

        <TabsContent value="queues" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Call Queues
              </CardTitle>
              <Button onClick={() => { setEditingQueue(null); setShowQueueDialog(true); }} data-testid="button-add-queue">
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
                      <TableHead>Ext</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Ring Strategy</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queues.map((queue) => (
                      <QueueTableRow
                        key={queue.id}
                        queue={queue}
                        extensions={extensions}
                        onEdit={() => {
                          setEditingQueue(queue);
                          setShowQueueDialog(true);
                        }}
                        onDelete={() => deleteQueueMutation.mutate(queue.id)}
                      />
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

        <TabsContent value="audio" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Library className="w-5 h-5" />
                Audio Library
              </CardTitle>
              <Button onClick={() => setShowAudioDialog(true)} data-testid="button-add-audio">
                <Plus className="w-4 h-4 mr-2" />
                Upload Audio
              </Button>
            </CardHeader>
            <CardContent>
              {audioFilesLoading ? (
                <LoadingSpinner fullScreen={false} />
              ) : audioFiles.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <FileAudio className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No audio files uploaded</p>
                  <p className="text-sm">Upload audio files to use as IVR greetings or hold music</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Play</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Used By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audioFiles.map((audio) => (
                      <TableRow key={audio.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleLibraryAudioPlayback(audio)}
                            data-testid={`button-play-audio-${audio.id}`}
                          >
                            {playingAudioId === audio.id ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">
                          {audio.name}
                          {audio.description && (
                            <p className="text-xs text-muted-foreground">{audio.description}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getAudioTypeLabel(audio.audioType)}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="text-sm text-muted-foreground truncate">{audio.notes || "-"}</p>
                        </TableCell>
                        <TableCell>
                          {audio.usage.length === 0 ? (
                            <span className="text-sm text-muted-foreground">Not in use</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {audio.usage.map((u, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {getUsageLabel(u)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingAudio(audio)}
                            data-testid={`button-edit-audio-${audio.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (audio.usage.length > 0) {
                                setAudioToDelete(audio);
                              } else {
                                deleteAudioFileMutation.mutate({ audioId: audio.id });
                              }
                            }}
                            disabled={deleteAudioFileMutation.isPending}
                            data-testid={`button-delete-audio-${audio.id}`}
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

      <AudioUploadDialog
        open={showAudioDialog}
        onOpenChange={setShowAudioDialog}
        onSubmit={(data) => uploadAudioFileMutation.mutate(data)}
        isPending={uploadAudioFileMutation.isPending}
      />

      <AudioEditDialog
        open={!!editingAudio}
        onOpenChange={(open) => !open && setEditingAudio(null)}
        audio={editingAudio}
        onSubmit={(data) => updateAudioFileMutation.mutate(data)}
        isPending={updateAudioFileMutation.isPending}
      />

      <AlertDialog open={!!audioToDelete} onOpenChange={(open) => !open && setAudioToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Audio File?</AlertDialogTitle>
            <AlertDialogDescription>
              This audio file is currently in use:
              <ul className="mt-2 list-disc list-inside">
                {audioToDelete?.usage.map((u, idx) => (
                  <li key={idx} className="text-sm">{getUsageLabel(u)}</li>
                ))}
              </ul>
              <p className="mt-3 font-medium text-foreground">
                Deleting will remove the audio from these locations. This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => audioToDelete && deleteAudioFileMutation.mutate({ audioId: audioToDelete.id, force: true })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAudioFileMutation.isPending ? "Deleting..." : "Delete Anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QueueDialog
        open={showQueueDialog}
        onOpenChange={setShowQueueDialog}
        queue={editingQueue}
        extensions={extensions}
        audioFiles={audioFiles}
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
        ivrs={ivrs}
        onSubmit={(data) => menuOptionMutation.mutate(data)}
        isPending={menuOptionMutation.isPending}
      />

      <IvrDialog
        open={showIvrDialog}
        onOpenChange={setShowIvrDialog}
        ivr={editingIvr}
        audioFiles={audioFiles}
        onSubmit={(data) => ivrMutation.mutate(data)}
        onUploadGreeting={(ivrId, file) => uploadIvrGreetingMutation.mutate({ ivrId, file })}
        onDeleteGreeting={(ivrId) => deleteIvrGreetingMutation.mutate(ivrId)}
        isPending={ivrMutation.isPending}
        isUploadPending={uploadIvrGreetingMutation.isPending}
        isDeletePending={deleteIvrGreetingMutation.isPending}
      />

      <IvrMenuOptionDialog
        open={showIvrMenuDialog}
        onOpenChange={setShowIvrMenuDialog}
        option={editingIvrMenuOption}
        queues={queues}
        extensions={extensions}
        ivrs={ivrs}
        currentIvrId={selectedIvrId}
        onSubmit={(data) => ivrMenuOptionMutation.mutate({ ...data, ivrId: selectedIvrId })}
        isPending={ivrMenuOptionMutation.isPending}
      />
    </div>
  );
}

interface QueueMember {
  id: string;
  queueId: string;
  userId: string;
  priority: number;
}

function QueueTableRow({
  queue,
  extensions,
  onEdit,
  onDelete,
}: {
  queue: PbxQueue;
  extensions: PbxExtension[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data: members = [] } = useQuery<QueueMember[]>({
    queryKey: [`/api/pbx/queues/${queue.id}/members`],
  });

  const memberExtensions = members
    .map(m => extensions.find(e => e.userId === m.userId))
    .filter(Boolean) as PbxExtension[];

  return (
    <TableRow>
      <TableCell className="font-medium">{queue.name}</TableCell>
      <TableCell className="font-mono">{queue.extension || "-"}</TableCell>
      <TableCell>
        {memberExtensions.length === 0 ? (
          <span className="text-muted-foreground text-sm">None</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {memberExtensions.map((ext) => (
              <Badge key={ext.id} variant="outline" className="text-xs">
                {ext.extension}
              </Badge>
            ))}
          </div>
        )}
      </TableCell>
      <TableCell className="capitalize">{queue.ringStrategy.replace("_", " ")}</TableCell>
      <TableCell>
        <Badge variant={queue.status === "active" ? "default" : "secondary"}>
          {queue.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function QueueDialog({
  open,
  onOpenChange,
  queue,
  extensions,
  audioFiles,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: PbxQueue | null;
  extensions: PbxExtension[];
  audioFiles: PbxAudioFile[];
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [extension, setExtension] = useState("");
  const [ringStrategy, setRingStrategy] = useState("ring_all");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedHoldMusicIds, setSelectedHoldMusicIds] = useState<string[]>([]);
  const [holdMusicPlaybackMode, setHoldMusicPlaybackMode] = useState<string>("sequential");
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [adsIntervalMin, setAdsIntervalMin] = useState(45);
  const [adsIntervalMax, setAdsIntervalMax] = useState(60);
  
  const holdMusicOptions = audioFiles.filter(a => a.audioType === 'hold_music');

  const { data: existingMembers = [] } = useQuery<QueueMember[]>({
    queryKey: [`/api/pbx/queues/${queue?.id}/members`],
    enabled: !!queue?.id,
  });

  const announcementOptions = audioFiles.filter(a => a.audioType === 'announcement');

  const { data: queueAds = [], refetch: refetchAds } = useQuery<QueueAd[]>({
    queryKey: [`/api/pbx/queues/${queue?.id}/ads`],
    enabled: !!queue?.id,
  });

  interface QueueHoldMusic {
    id: string;
    queueId: string;
    audioFileId: string;
    displayOrder: number;
    isActive: boolean;
    audioFile: {
      id: string;
      name: string;
      fileUrl: string;
      duration: number | null;
    };
  }

  const { data: queueHoldMusic = [], refetch: refetchHoldMusic } = useQuery<QueueHoldMusic[]>({
    queryKey: [`/api/pbx/queues/${queue?.id}/hold-music`],
    enabled: !!queue?.id,
  });

  const syncHoldMusicMutation = useMutation({
    mutationFn: async (audioFileIds: string[]) => {
      return apiRequest("PUT", `/api/pbx/queues/${queue?.id}/hold-music/sync`, { audioFileIds });
    },
    onSuccess: () => {
      refetchHoldMusic();
    },
  });

  const addAdMutation = useMutation({
    mutationFn: async (audioFileId: string) => {
      return apiRequest("POST", `/api/pbx/queues/${queue?.id}/ads`, { audioFileId, displayOrder: queueAds.length });
    },
    onSuccess: () => {
      refetchAds();
    },
  });

  const removeAdMutation = useMutation({
    mutationFn: async (adId: string) => {
      return apiRequest("DELETE", `/api/pbx/queues/${queue?.id}/ads/${adId}`);
    },
    onSuccess: () => {
      refetchAds();
    },
  });

  const toggleAdMutation = useMutation({
    mutationFn: async ({ adId, isActive }: { adId: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/pbx/queues/${queue?.id}/ads/${adId}`, { isActive });
    },
    onSuccess: () => {
      refetchAds();
    },
  });

  useEffect(() => {
    if (open) {
      if (queue) {
        setName(queue.name);
        setDescription(queue.description || "");
        setExtension(queue.extension || "");
        setRingStrategy(queue.ringStrategy);
        setHoldMusicPlaybackMode(queue.holdMusicPlaybackMode || "sequential");
        setAdsEnabled(queue.adsEnabled || false);
        setAdsIntervalMin(queue.adsIntervalMin ?? 45);
        setAdsIntervalMax(queue.adsIntervalMax ?? 60);
      } else {
        setName("");
        setDescription("");
        setExtension("");
        setRingStrategy("ring_all");
        setSelectedMemberIds([]);
        setSelectedHoldMusicIds([]);
        setHoldMusicPlaybackMode("sequential");
        setAdsEnabled(false);
        setAdsIntervalMin(45);
        setAdsIntervalMax(60);
      }
    }
  }, [open, queue, audioFiles]);

  useEffect(() => {
    if (open && queue?.id) {
      setSelectedMemberIds(existingMembers.map(m => m.userId));
    } else if (open && !queue?.id) {
      setSelectedMemberIds([]);
    }
  }, [existingMembers, open, queue?.id]);

  useEffect(() => {
    if (open && queue?.id) {
      setSelectedHoldMusicIds(queueHoldMusic.map(hm => hm.audioFileId));
    } else if (open && !queue?.id) {
      setSelectedHoldMusicIds([]);
    }
  }, [queueHoldMusic, open, queue?.id]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setExtension("");
      setRingStrategy("ring_all");
      setSelectedMemberIds([]);
      setSelectedHoldMusicIds([]);
      setHoldMusicPlaybackMode("sequential");
      setAdsEnabled(false);
      setAdsIntervalMin(45);
      setAdsIntervalMax(60);
    }
    onOpenChange(isOpen);
  };

  const toggleHoldMusic = (audioId: string) => {
    setSelectedHoldMusicIds(prev => 
      prev.includes(audioId) 
        ? prev.filter(id => id !== audioId)
        : [...prev, audioId]
    );
  };

  const toggleMember = (userId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{queue ? "Edit Queue" : "Create Queue"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
              <Label>Extension</Label>
              <Input
                value={extension}
                onChange={(e) => setExtension(e.target.value)}
                placeholder="2001"
                data-testid="input-queue-extension"
              />
            </div>
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
          <div className="space-y-2">
            <Label>Queue Members (Extensions)</Label>
            {extensions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No extensions available. Create extensions first.</p>
            ) : (
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {extensions.map((ext) => (
                  <div 
                    key={ext.id} 
                    className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleMember(ext.userId)}
                    data-testid={`checkbox-member-${ext.id}`}
                  >
                    <Checkbox
                      checked={selectedMemberIds.includes(ext.userId)}
                      onCheckedChange={() => toggleMember(ext.userId)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {ext.displayName || `${ext.user.firstName} ${ext.user.lastName}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ext. {ext.extension}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedMemberIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedMemberIds.length} member{selectedMemberIds.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Hold Music</Label>
            {holdMusicOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hold music files available. Upload audio files with type "Hold Music" in the Audio tab.
              </p>
            ) : (
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {holdMusicOptions.map((audio) => (
                  <div 
                    key={audio.id} 
                    className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleHoldMusic(audio.id)}
                    data-testid={`checkbox-holdmusic-${audio.id}`}
                  >
                    <Checkbox
                      checked={selectedHoldMusicIds.includes(audio.id)}
                      onCheckedChange={() => toggleHoldMusic(audio.id)}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Music className="w-4 h-4 text-muted-foreground" />
                      <p className="text-sm font-medium truncate">{audio.name}</p>
                      {audio.duration && (
                        <span className="text-xs text-muted-foreground">
                          ({Math.floor(audio.duration / 60)}:{String(audio.duration % 60).padStart(2, '0')})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedHoldMusicIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedHoldMusicIds.length} track{selectedHoldMusicIds.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          {selectedHoldMusicIds.length > 1 && (
            <div className="space-y-2">
              <Label>Playback Mode</Label>
              <Select value={holdMusicPlaybackMode} onValueChange={setHoldMusicPlaybackMode}>
                <SelectTrigger data-testid="select-holdmusic-playback-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential (play in order)</SelectItem>
                  <SelectItem value="random">Random (shuffle)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          </div>
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Intercalated Advertisements</Label>
                <p className="text-xs text-muted-foreground">
                  Play audio ads between hold music at random intervals
                </p>
              </div>
              <Switch
                checked={adsEnabled}
                onCheckedChange={setAdsEnabled}
                data-testid="switch-ads-enabled"
              />
            </div>
            {adsEnabled && (
              <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Interval (sec)</Label>
                  <Input
                    type="number"
                    value={adsIntervalMin}
                    onChange={(e) => setAdsIntervalMin(parseInt(e.target.value) || 45)}
                    min={15}
                    max={300}
                    data-testid="input-ads-interval-min"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Interval (sec)</Label>
                  <Input
                    type="number"
                    value={adsIntervalMax}
                    onChange={(e) => setAdsIntervalMax(parseInt(e.target.value) || 60)}
                    min={15}
                    max={300}
                    data-testid="input-ads-interval-max"
                  />
                </div>
              </div>
              {queue?.id && (
                <div className="space-y-3 mt-4">
                  <Label>Advertisement Audio Files</Label>
                  {queueAds.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No ads configured. Add audio files below.</p>
                  ) : (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {queueAds.map((ad) => (
                        <div key={ad.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md" data-testid={`ad-item-${ad.id}`}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Switch
                              checked={ad.isActive}
                              onCheckedChange={(checked) => toggleAdMutation.mutate({ adId: ad.id, isActive: checked })}
                              data-testid={`switch-ad-active-${ad.id}`}
                            />
                            <span className="text-sm truncate">{ad.audioFile.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAdMutation.mutate(ad.id)}
                            disabled={removeAdMutation.isPending}
                            data-testid={`button-remove-ad-${ad.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {announcementOptions.length > 0 ? (
                    <Select onValueChange={(audioFileId) => addAdMutation.mutate(audioFileId)}>
                      <SelectTrigger data-testid="select-add-ad">
                        <SelectValue placeholder="Add advertisement audio..." />
                      </SelectTrigger>
                      <SelectContent>
                        {announcementOptions
                          .filter(audio => !queueAds.some(ad => ad.audioFileId === audio.id))
                          .map((audio) => (
                            <SelectItem key={audio.id} value={audio.id}>
                              {audio.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No announcement audio files available. Upload audio files with type "Announcement" in the Audio tab.
                    </p>
                  )}
                </div>
              )}
              {!queue?.id && (
                <p className="text-xs text-muted-foreground mt-2">
                  Save the queue first to add advertisement audio files.
                </p>
              )}
              </>
            )}
          </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSubmit({ 
                id: queue?.id, 
                name, 
                description, 
                extension, 
                ringStrategy, 
                memberIds: selectedMemberIds.filter(id => id),
                holdMusicPlaybackMode: selectedHoldMusicIds.length > 1 ? holdMusicPlaybackMode : "sequential",
                holdMusicAudioIds: selectedHoldMusicIds,
                adsEnabled,
                adsIntervalMin,
                adsIntervalMax 
              });
            }}
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
  ivrs,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option: PbxMenuOption | null;
  queues: PbxQueue[];
  extensions: PbxExtension[];
  ivrs: PbxIvr[];
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [digit, setDigit] = useState("");
  const [label, setLabel] = useState("");
  const [actionType, setActionType] = useState("queue");
  const [targetQueueId, setTargetQueueId] = useState("");
  const [targetExtensionId, setTargetExtensionId] = useState("");
  const [targetExternalNumber, setTargetExternalNumber] = useState("");
  const [targetIvrId, setTargetIvrId] = useState("");

  useEffect(() => {
    if (open) {
      if (option) {
        setDigit(option.digit);
        setLabel(option.label);
        setActionType(option.actionType);
        setTargetQueueId(option.targetQueueId || "");
        setTargetExtensionId(option.targetExtensionId || "");
        setTargetExternalNumber(option.targetExternalNumber || "");
        setTargetIvrId(option.targetIvrId || "");
      } else {
        setDigit("");
        setLabel("");
        setActionType("queue");
        setTargetQueueId("");
        setTargetExtensionId("");
        setTargetExternalNumber("");
        setTargetIvrId("");
      }
    }
  }, [open, option]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setDigit("");
      setLabel("");
      setActionType("queue");
      setTargetQueueId("");
      setTargetExtensionId("");
      setTargetExternalNumber("");
      setTargetIvrId("");
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
                <SelectItem value="ivr">Route to IVR</SelectItem>
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

          {actionType === "ivr" && (
            <div className="space-y-2">
              <Label>Target IVR</Label>
              <Select value={targetIvrId} onValueChange={setTargetIvrId}>
                <SelectTrigger data-testid="select-target-ivr">
                  <SelectValue placeholder="Select IVR" />
                </SelectTrigger>
                <SelectContent>
                  {ivrs.map((ivr) => (
                    <SelectItem key={ivr.id} value={ivr.id}>
                      {ivr.name} ({ivr.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                targetIvrId: actionType === "ivr" ? targetIvrId : null,
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

function IvrDialog({
  open,
  onOpenChange,
  ivr,
  audioFiles,
  onSubmit,
  onUploadGreeting,
  onDeleteGreeting,
  isPending,
  isUploadPending,
  isDeletePending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ivr: PbxIvr | null;
  audioFiles: PbxAudioFile[];
  onSubmit: (data: any) => void;
  onUploadGreeting: (ivrId: string, file: File) => void;
  onDeleteGreeting: (ivrId: string) => void;
  isPending: boolean;
  isUploadPending: boolean;
  isDeletePending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [extension, setExtension] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [useTextToSpeech, setUseTextToSpeech] = useState(true);
  const [greetingText, setGreetingText] = useState("");
  const [ivrTimeout, setIvrTimeout] = useState(10);
  const [maxRetries, setMaxRetries] = useState(3);
  const [audioSource, setAudioSource] = useState<"library" | "upload">("library");
  const [selectedAudioId, setSelectedAudioId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const greetingAudioOptions = audioFiles.filter(a => a.audioType === 'greeting' || a.audioType === 'announcement');

  const { data: nextExtension } = useQuery<{ extension: string }>({
    queryKey: ["/api/pbx/ivrs/next-extension"],
    enabled: open && !ivr,
  });

  useEffect(() => {
    if (open) {
      if (ivr) {
        setName(ivr.name);
        setDescription(ivr.description || "");
        setExtension(ivr.extension);
        setLanguage(ivr.language);
        setUseTextToSpeech(ivr.useTextToSpeech);
        setGreetingText(ivr.greetingText || "");
        setIvrTimeout(ivr.ivrTimeout);
        setMaxRetries(ivr.maxRetries);
        // Check if greeting audio matches a library file
        const matchingAudio = audioFiles.find(a => a.fileUrl === ivr.greetingAudioUrl);
        if (matchingAudio) {
          setAudioSource("library");
          setSelectedAudioId(matchingAudio.id);
        } else if (ivr.greetingAudioUrl) {
          setAudioSource("upload");
          setSelectedAudioId("");
        } else {
          setAudioSource("library");
          setSelectedAudioId("");
        }
      } else {
        setName("");
        setDescription("");
        setExtension(nextExtension?.extension || "");
        setLanguage("en-US");
        setUseTextToSpeech(true);
        setGreetingText("");
        setIvrTimeout(10);
        setMaxRetries(3);
        setAudioSource("library");
        setSelectedAudioId("");
      }
    }
  }, [open, ivr, nextExtension, audioFiles]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setExtension("");
      setLanguage("en-US");
      setUseTextToSpeech(true);
      setGreetingText("");
      setIvrTimeout(10);
      setMaxRetries(3);
      setAudioSource("library");
      setSelectedAudioId("");
    }
    onOpenChange(isOpen);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && ivr?.id) {
      onUploadGreeting(ivr.id, file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{ivr ? "Edit IVR" : "Create IVR"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="English IVR, Spanish IVR"
                data-testid="input-ivr-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Extension</Label>
              <Input
                value={extension}
                onChange={(e) => setExtension(e.target.value)}
                placeholder="1000"
                data-testid="input-ivr-extension"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              data-testid="input-ivr-description"
            />
          </div>

          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger data-testid="select-ivr-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-US">English (US)</SelectItem>
                <SelectItem value="es-ES">Spanish (Spain)</SelectItem>
                <SelectItem value="es-MX">Spanish (Mexico)</SelectItem>
                <SelectItem value="fr-FR">French (France)</SelectItem>
                <SelectItem value="de-DE">German (Germany)</SelectItem>
                <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
              <Label>Greeting Audio</Label>
              <div className="flex gap-2">
                <Button
                  variant={audioSource === "library" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAudioSource("library")}
                  data-testid="button-audio-source-library"
                >
                  <Library className="w-4 h-4 mr-1" />
                  From Library
                </Button>
                {ivr?.id && (
                  <Button
                    variant={audioSource === "upload" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAudioSource("upload")}
                    data-testid="button-audio-source-upload"
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    Upload New
                  </Button>
                )}
              </div>
              
              {audioSource === "library" ? (
                <div className="space-y-2">
                  <Select value={selectedAudioId || "none"} onValueChange={(val) => setSelectedAudioId(val === "none" ? "" : val)}>
                    <SelectTrigger data-testid="select-ivr-greeting-audio">
                      <SelectValue placeholder="Select from library" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {greetingAudioOptions.map((audio) => (
                        <SelectItem key={audio.id} value={audio.id}>
                          <div className="flex items-center gap-2">
                            <Mic className="w-3 h-3 text-muted-foreground" />
                            {audio.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {greetingAudioOptions.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No greeting audio available. Upload audio files with type "IVR Greeting" in the Audio tab.
                    </p>
                  )}
                </div>
              ) : ivr?.id ? (
                <div className="space-y-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".mp3,.wav,audio/mpeg,audio/wav"
                    className="hidden"
                  />
                  {ivr?.greetingAudioUrl && audioSource === "upload" ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                      <div className="flex-1">
                        <p className="text-sm font-medium">Custom audio uploaded</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadPending}
                      >
                        {isUploadPending ? <LoadingSpinner fullScreen={false} /> : <Upload className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDeleteGreeting(ivr.id)}
                        disabled={isDeletePending}
                        className="text-red-500"
                      >
                        {isDeletePending ? <LoadingSpinner fullScreen={false} /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isUploadPending ? (
                        <LoadingSpinner fullScreen={false} />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-sm font-medium">Upload audio</p>
                          <p className="text-xs text-muted-foreground">MP3 or WAV</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Save the IVR first to upload custom audio.</p>
              )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timeout (seconds)</Label>
              <Input
                type="number"
                value={ivrTimeout}
                onChange={(e) => setIvrTimeout(parseInt(e.target.value) || 10)}
                data-testid="input-ivr-timeout"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Retries</Label>
              <Input
                type="number"
                value={maxRetries}
                onChange={(e) => setMaxRetries(parseInt(e.target.value) || 3)}
                data-testid="input-ivr-max-retries"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const selectedAudio = audioFiles.find(a => a.id === selectedAudioId);
              let greetingUrl = null;
              if (audioSource === "library" && selectedAudio) {
                greetingUrl = selectedAudio.fileUrl;
              }
              onSubmit({
                id: ivr?.id,
                name,
                description: description || null,
                extension,
                language,
                useTextToSpeech: false,
                greetingText: null,
                greetingAudioUrl: greetingUrl,
                ivrTimeout,
                maxRetries,
              });
            }}
            disabled={isPending || !name || !extension}
            data-testid="button-save-ivr"
          >
            {isPending ? <LoadingSpinner fullScreen={false} /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IvrMenuOptionDialog({
  open,
  onOpenChange,
  option,
  queues,
  extensions,
  ivrs,
  currentIvrId,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option: PbxMenuOption | null;
  queues: PbxQueue[];
  extensions: PbxExtension[];
  ivrs: PbxIvr[];
  currentIvrId: string | null;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [digit, setDigit] = useState("");
  const [label, setLabel] = useState("");
  const [actionType, setActionType] = useState("queue");
  const [targetQueueId, setTargetQueueId] = useState("");
  const [targetExtensionId, setTargetExtensionId] = useState("");
  const [targetExternalNumber, setTargetExternalNumber] = useState("");
  const [targetIvrId, setTargetIvrId] = useState("");

  useEffect(() => {
    if (open) {
      if (option) {
        setDigit(option.digit);
        setLabel(option.label);
        setActionType(option.actionType);
        setTargetQueueId(option.targetQueueId || "");
        setTargetExtensionId(option.targetExtensionId || "");
        setTargetExternalNumber(option.targetExternalNumber || "");
        setTargetIvrId(option.targetIvrId || "");
      } else {
        setDigit("");
        setLabel("");
        setActionType("queue");
        setTargetQueueId("");
        setTargetExtensionId("");
        setTargetExternalNumber("");
        setTargetIvrId("");
      }
    }
  }, [open, option]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setDigit("");
      setLabel("");
      setActionType("queue");
      setTargetQueueId("");
      setTargetExtensionId("");
      setTargetExternalNumber("");
      setTargetIvrId("");
    }
    onOpenChange(isOpen);
  };

  const availableIvrs = ivrs.filter(i => i.id !== currentIvrId);

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
                data-testid="input-ivr-menu-digit"
              />
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Sales"
                data-testid="input-ivr-menu-label"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger data-testid="select-ivr-menu-action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="queue">Route to Queue</SelectItem>
                <SelectItem value="extension">Route to Extension</SelectItem>
                <SelectItem value="external">Forward to External Number</SelectItem>
                <SelectItem value="ivr">Route to IVR</SelectItem>
                <SelectItem value="voicemail">Go to Voicemail</SelectItem>
                <SelectItem value="hangup">Hang Up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {actionType === "queue" && (
            <div className="space-y-2">
              <Label>Target Queue</Label>
              <Select value={targetQueueId} onValueChange={setTargetQueueId}>
                <SelectTrigger data-testid="select-ivr-target-queue">
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
                <SelectTrigger data-testid="select-ivr-target-extension">
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
                data-testid="input-ivr-external-number"
              />
            </div>
          )}

          {actionType === "ivr" && (
            <div className="space-y-2">
              <Label>Target IVR</Label>
              <Select value={targetIvrId} onValueChange={setTargetIvrId}>
                <SelectTrigger data-testid="select-ivr-target-ivr">
                  <SelectValue placeholder="Select IVR" />
                </SelectTrigger>
                <SelectContent>
                  {availableIvrs.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} ({i.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                targetIvrId: actionType === "ivr" ? targetIvrId : null,
              })
            }
            disabled={isPending || !digit || !label}
            data-testid="button-save-ivr-menu-option"
          >
            {isPending ? <LoadingSpinner fullScreen={false} /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AudioUploadDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { file: File; name: string; description?: string; notes?: string; audioType: string }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [audioType, setAudioType] = useState("greeting");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setNotes("");
      setAudioType("greeting");
      setFile(null);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!name) {
        setName(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleSubmit = () => {
    if (file && name && audioType) {
      onSubmit({ file, name, description: description || undefined, notes: notes || undefined, audioType });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Audio File</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Audio File</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="flex-1"
                data-testid="input-audio-file"
              />
            </div>
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My IVR Greeting"
              data-testid="input-audio-name"
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={audioType} onValueChange={setAudioType}>
              <SelectTrigger data-testid="select-audio-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="greeting">IVR Greeting</SelectItem>
                <SelectItem value="hold_music">Hold Music</SelectItem>
                <SelectItem value="announcement">Announcement</SelectItem>
                <SelectItem value="voicemail_greeting">Voicemail Greeting</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              data-testid="input-audio-description"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this audio file"
              rows={3}
              data-testid="input-audio-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !file || !name || !audioType}
            data-testid="button-upload-audio"
          >
            {isPending ? <LoadingSpinner fullScreen={false} /> : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AudioEditDialog({
  open,
  onOpenChange,
  audio,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audio: PbxAudioFile | null;
  onSubmit: (data: { audioId: string; name?: string; description?: string; notes?: string }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (audio) {
      setName(audio.name);
      setDescription(audio.description || "");
      setNotes(audio.notes || "");
    }
  }, [audio]);

  const handleSubmit = () => {
    if (audio) {
      onSubmit({ 
        audioId: audio.id, 
        name: name || undefined, 
        description: description || undefined, 
        notes: notes || undefined 
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Audio Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-edit-audio-name"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              data-testid="input-edit-audio-description"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes"
              rows={3}
              data-testid="input-edit-audio-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !name}
            data-testid="button-save-audio"
          >
            {isPending ? <LoadingSpinner fullScreen={false} /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
