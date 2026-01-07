import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, Trash2, FileAudio, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import type { User } from "@shared/schema";

type SlotKey = "start_en" | "start_es" | "stop_en" | "stop_es" | "voicemail_en" | "hold_en";

interface MediaSlotData {
  id: string;
  type: string;
  language: string;
  audioUrl: string;
  objectPath?: string;
  originalFileName: string;
  uploadedBy: string;
  uploadedAt: string;
  isActive: boolean;
}

interface SlotsResponse {
  slots: {
    start_en: MediaSlotData | null;
    start_es: MediaSlotData | null;
    stop_en: MediaSlotData | null;
    stop_es: MediaSlotData | null;
    voicemail_en: MediaSlotData | null;
    hold_en: MediaSlotData | null;
  };
}

const MEDIA_SLOTS: { key: SlotKey; title: string; description: string; category: string }[] = [
  { key: "start_en", title: "Start Recording (English)", description: "Announcement played when call recording begins (English)", category: "recording" },
  { key: "start_es", title: "Start Recording (Spanish)", description: "Announcement played when call recording begins (Spanish)", category: "recording" },
  { key: "stop_en", title: "Stop Recording (English)", description: "Announcement played when call recording ends (English)", category: "recording" },
  { key: "stop_es", title: "Stop Recording (Spanish)", description: "Announcement played when call recording ends (Spanish)", category: "recording" },
  { key: "voicemail_en", title: "Voicemail Greeting", description: "Greeting played when calls go to voicemail", category: "voicemail" },
  { key: "hold_en", title: "Hold Music", description: "Music played while callers are on hold", category: "hold" },
];

const ACCEPTED_FORMATS = ".mp3,.wav,.ogg,.webm";

export default function SuperAdminRecordingMedia() {
  const { toast } = useToast();
  const fileInputRefs = useRef<{ [key in SlotKey]?: HTMLInputElement | null }>({});
  const [uploadingSlot, setUploadingSlot] = useState<SlotKey | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<SlotKey | null>(null);

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: mediaData, isLoading, refetch, isRefetching } = useQuery<SlotsResponse>({
    queryKey: ["/api/admin/recording-media"],
    enabled: sessionData?.user?.role === "superadmin",
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ slotKey, file }: { slotKey: SlotKey; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const [type, language] = slotKey.split("_");
      formData.append("type", type);
      formData.append("language", language);
      
      const response = await fetch("/api/admin/recording-media", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      return response.json();
    },
    onSuccess: (_, { slotKey }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recording-media"] });
      toast({
        title: "Media Uploaded",
        description: `${getSlotTitle(slotKey)} has been uploaded successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload media file.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setUploadingSlot(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ slotKey, mediaId }: { slotKey: SlotKey; mediaId: string }) => {
      return apiRequest("DELETE", `/api/admin/recording-media/${mediaId}`);
    },
    onSuccess: (_, { slotKey }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recording-media"] });
      toast({
        title: "Media Deleted",
        description: `${getSlotTitle(slotKey)} has been deleted.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete media file.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setDeletingSlot(null);
    },
  });

  const getSlotTitle = (key: SlotKey): string => {
    return MEDIA_SLOTS.find((s) => s.key === key)?.title || key;
  };

  const getMediaForSlot = (key: SlotKey): MediaSlotData | null => {
    if (!mediaData?.slots) return null;
    return mediaData.slots[key] ?? null;
  };

  const handleFileSelect = (slotKey: SlotKey, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingSlot(slotKey);
    uploadMutation.mutate({ slotKey, file });

    if (event.target) {
      event.target.value = "";
    }
  };

  const handleUploadClick = (slotKey: SlotKey) => {
    fileInputRefs.current[slotKey]?.click();
  };

  const handleDelete = (slotKey: SlotKey) => {
    const media = getMediaForSlot(slotKey);
    if (!media) return;
    
    setDeletingSlot(slotKey);
    deleteMutation.mutate({ slotKey, mediaId: media.id });
  };

  if (sessionData?.user?.role !== "superadmin") {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Access denied. Super admin privileges required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading media files..." />;
  }

  const renderSlotCard = (slot: typeof MEDIA_SLOTS[0]) => {
    const media = getMediaForSlot(slot.key);
    const isUploading = uploadingSlot === slot.key;
    const isDeleting = deletingSlot === slot.key;

    return (
      <Card key={slot.key} data-testid={`card-slot-${slot.key}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileAudio className="h-5 w-5 text-muted-foreground" />
            {slot.title}
          </CardTitle>
          <CardDescription>{slot.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            type="file"
            accept={ACCEPTED_FORMATS}
            className="hidden"
            ref={(el) => (fileInputRefs.current[slot.key] = el)}
            onChange={(e) => handleFileSelect(slot.key, e)}
            data-testid={`input-file-${slot.key}`}
          />

          {media ? (
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="font-medium text-sm" data-testid={`text-filename-${slot.key}`}>
                  {media.originalFileName}
                </p>
                <p className="text-xs text-muted-foreground mt-1" data-testid={`text-uploaddate-${slot.key}`}>
                  {media.uploadedAt ? `Uploaded ${format(new Date(media.uploadedAt), "MMM d, yyyy 'at' h:mm a")}` : "Upload date unknown"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUploadClick(slot.key)}
                  disabled={isUploading || isDeleting}
                  data-testid={`button-replace-${slot.key}`}
                >
                  {isUploading ? (
                    <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Replace
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(slot.key)}
                  disabled={isUploading || isDeleting}
                  className="text-destructive hover:text-destructive"
                  data-testid={`button-delete-${slot.key}`}
                >
                  {isDeleting ? (
                    <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 border-2 border-dashed rounded-lg border-muted-foreground/25">
              <FileAudio className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No media file uploaded</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUploadClick(slot.key)}
                disabled={isUploading}
                data-testid={`button-upload-${slot.key}`}
              >
                {isUploading ? (
                  <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Audio File
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Supported: MP3, WAV, OGG, WebM
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const recordingSlots = MEDIA_SLOTS.filter(s => s.category === "recording");
  const voicemailSlots = MEDIA_SLOTS.filter(s => s.category === "voicemail");
  const holdSlots = MEDIA_SLOTS.filter(s => s.category === "hold");

  return (
    <div className="p-4 space-y-4" data-testid="recording-media-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="page-title">
            Call Audio Media
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="page-subtitle">
            Manage audio files for call recording announcements and voicemail greetings
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          data-testid="button-refresh"
        >
          {isRefetching ? (
            <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium mb-4">Recording Announcements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="media-slots-grid-recording">
            {recordingSlots.map(renderSlotCard)}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium mb-4">Voicemail & Hold</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="media-slots-grid-voicemail">
            {voicemailSlots.map(renderSlotCard)}
            {holdSlots.map(renderSlotCard)}
          </div>
        </div>
      </div>
    </div>
  );
}
