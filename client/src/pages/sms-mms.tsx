import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { ThreadList } from "@/components/chat/thread-list";
import { MessagePanel } from "@/components/chat/message-panel";
import { ContactDetails } from "@/components/chat/contact-details";
import { NumberProvisionModal } from "@/components/chat/number-provision-modal";
import { PhoneSettingsModal } from "@/components/chat/phone-settings-modal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Phone, Settings, RefreshCw, Plus } from "lucide-react";
import type { BulkvsThread, BulkvsMessage, BulkvsPhoneNumber } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type MobileView = "threads" | "messages" | "details";

// Format phone number to +1 (XXX) XXX-XXXX
const formatPhoneNumber = (phone: string) => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    const match = cleaned.match(/^1(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
    }
  }
  return phone;
};

export default function SmsMmsPage() {
  const { toast } = useToast();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("threads");
  const [provisionModalOpen, setProvisionModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [reactivateConfirmOpen, setReactivateConfirmOpen] = useState(false);

  useWebSocket((message) => {
    const msg = message as any; // BulkVS-specific message types
    
    if (msg.type === 'bulkvs_message') {
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/threads"] });
      if (selectedThreadId === msg.threadId) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/bulkvs/threads", msg.threadId, "messages"] 
        });
      }
    }
    
    if (msg.type === 'bulkvs_thread_update') {
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/threads"] });
    }
    
    if (msg.type === 'bulkvs_message_status') {
      if (selectedThreadId) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/bulkvs/threads", selectedThreadId, "messages"] 
        });
      }
    }
  });

  const { data: phoneNumbers, isLoading: loadingNumbers } = useQuery<BulkvsPhoneNumber[]>({
    queryKey: ["/api/bulkvs/numbers"],
  });

  // Separate active and cancelled numbers
  const activeNumbers = phoneNumbers?.filter(p => p.status === 'active') || [];
  const cancelledNumbers = phoneNumbers?.filter(p => p.status === 'inactive' && p.billingStatus === 'cancelled') || [];

  const { data: threads = [], isLoading: loadingThreads } = useQuery<BulkvsThread[]>({
    queryKey: ["/api/bulkvs/threads"],
    enabled: activeNumbers.length > 0,
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery<BulkvsMessage[]>({
    queryKey: ["/api/bulkvs/threads", selectedThreadId, "messages"],
    enabled: !!selectedThreadId,
  });

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || null;

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, mediaFile }: { message: string; mediaFile?: File }) => {
      if (!selectedThread || activeNumbers.length === 0) {
        throw new Error("No phone number available");
      }

      const phoneNumber = activeNumbers[0];
      let mediaUrl: string | undefined;

      if (mediaFile) {
        const formData = new FormData();
        formData.append("file", mediaFile);

        const uploadResponse = await fetch("/api/bulkvs/media/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload media");
        }

        const uploadData = await uploadResponse.json();
        mediaUrl = uploadData.url;
      }

      return apiRequest("POST", "/api/bulkvs/messages/send", {
        threadId: selectedThread.id,
        from: phoneNumber.did,
        to: selectedThread.externalPhone,
        body: message || undefined,
        mediaUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/threads", selectedThreadId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/threads"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateThreadMutation = useMutation({
    mutationFn: async (updates: Partial<BulkvsThread>) => {
      if (!selectedThreadId) throw new Error("No thread selected");
      
      return apiRequest("PATCH", `/api/bulkvs/threads/${selectedThreadId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/threads"] });
      toast({
        title: "Thread updated",
        description: "Conversation settings updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update thread",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      return apiRequest("POST", `/api/bulkvs/threads/${threadId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/threads"] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (phoneNumberId: string) => {
      return apiRequest("POST", `/api/bulkvs/numbers/${phoneNumberId}/reactivate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/numbers"] });
      toast({
        title: "Number reactivated",
        description: "Your phone number has been reactivated successfully. You can now start messaging.",
      });
      setReactivateConfirmOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Reactivation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setMobileView("messages");
    
    const thread = threads.find((t) => t.id === threadId);
    if (thread && thread.unreadCount > 0) {
      markAsReadMutation.mutate(threadId);
    }
  };

  const handleSendMessage = (message: string, mediaFile?: File) => {
    sendMessageMutation.mutate({ message, mediaFile });
  };

  const handleUpdateThread = (updates: Partial<BulkvsThread>) => {
    updateThreadMutation.mutate(updates);
  };

  const handleBackToThreads = () => {
    setMobileView("threads");
  };

  const handleShowDetails = () => {
    setMobileView("details");
  };

  const handleCloseDetails = () => {
    setMobileView("messages");
  };

  if (loadingNumbers) {
    return <LoadingSpinner message="Loading phone numbers..." />;
  }

  // Show empty state if no active numbers
  if (activeNumbers.length === 0) {
    // If user has a cancelled number, show reactivation option
    if (cancelledNumbers.length > 0) {
      const cancelledNumber = cancelledNumbers[0];
      return (
        <>
          <div className="flex items-center justify-center h-screen p-4">
            <Card className="max-w-md w-full p-8 text-center" data-testid="empty-phone-state-cancelled">
              <Phone className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-semibold mb-2">Reactivate Your Number</h2>
              <p className="text-muted-foreground mb-2">
                You previously had the number:
              </p>
              <p className="text-lg font-semibold mb-6">
                {formatPhoneNumber(cancelledNumber.did)}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                You can reactivate this number or get a new one to start messaging
              </p>
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => setReactivateConfirmOpen(true)} 
                  data-testid="button-reactivate-number"
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reactivate {formatPhoneNumber(cancelledNumber.did)}
                </Button>
                <Button 
                  onClick={() => setProvisionModalOpen(true)} 
                  data-testid="button-get-new-number"
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Get a New Number
                </Button>
              </div>
            </Card>
          </div>
          <NumberProvisionModal 
            open={provisionModalOpen} 
            onOpenChange={setProvisionModalOpen} 
          />
          <AlertDialog open={reactivateConfirmOpen} onOpenChange={setReactivateConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reactivate Phone Number?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reactivate your phone number <strong>{formatPhoneNumber(cancelledNumber.did)}</strong> and create a new subscription at ${cancelledNumber.monthlyPrice}/month. Billing will start immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => reactivateMutation.mutate(cancelledNumber.id)}
                  disabled={reactivateMutation.isPending}
                  data-testid="button-confirm-reactivate"
                >
                  {reactivateMutation.isPending ? "Reactivating..." : "Reactivate Number"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
    }

    // If no cancelled numbers, show regular empty state (get new number)
    return (
      <>
        <div className="flex items-center justify-center h-screen p-4">
          <Card className="max-w-md w-full p-8 text-center" data-testid="empty-phone-state">
            <Phone className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-semibold mb-2">You don't have a phone number yet</h2>
            <p className="text-muted-foreground mb-6">
              Get a dedicated phone number to start messaging with your clients
            </p>
            <Button onClick={() => setProvisionModalOpen(true)} data-testid="button-get-number">
              Get a Number
            </Button>
          </Card>
        </div>
        <NumberProvisionModal 
          open={provisionModalOpen} 
          onOpenChange={setProvisionModalOpen} 
        />
      </>
    );
  }

  if (loadingThreads) {
    return <LoadingSpinner message="Loading conversations..." />;
  }

  return (
    <>
      <div className="h-screen flex overflow-hidden bg-muted/30" data-testid="sms-mms-page">
        <div className="hidden md:grid md:grid-cols-[25%_50%_25%] w-full h-full gap-0">
          <ThreadList
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelectThread={handleSelectThread}
            onSettings={() => setSettingsModalOpen(true)}
          />

        <MessagePanel
          thread={selectedThread}
          messages={messages}
          onSendMessage={handleSendMessage}
          onUpdateThread={handleUpdateThread}
          isLoading={loadingMessages}
        />

        <ContactDetails
          thread={selectedThread}
          messages={messages}
          onUpdateThread={handleUpdateThread}
        />
      </div>

      <div className="md:hidden flex w-full h-full">
        {mobileView === "threads" && (
          <div className="w-full">
            <ThreadList
              threads={threads}
              selectedThreadId={selectedThreadId}
              onSelectThread={handleSelectThread}
              onSettings={() => setSettingsModalOpen(true)}
            />
          </div>
        )}

        {mobileView === "messages" && (
          <div className="w-full">
            <MessagePanel
              thread={selectedThread}
              messages={messages}
              onSendMessage={handleSendMessage}
              onUpdateThread={handleUpdateThread}
              onBack={handleBackToThreads}
              onShowDetails={handleShowDetails}
              isLoading={loadingMessages}
            />
          </div>
        )}

        {mobileView === "details" && (
          <div className="w-full">
            <ContactDetails
              thread={selectedThread}
              messages={messages}
              onUpdateThread={handleUpdateThread}
              onClose={handleCloseDetails}
            />
          </div>
        )}
      </div>
    </div>
    
    {activeNumbers.length > 0 && (
      <PhoneSettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        phoneNumber={activeNumbers[0]}
      />
    )}
    </>
  );
}
