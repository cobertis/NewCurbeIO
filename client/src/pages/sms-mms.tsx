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
import { NewMessageSheet } from "@/components/chat/new-message-sheet";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Phone, Settings, RefreshCw, Plus } from "lucide-react";
import type { BulkvsThread, BulkvsMessage, BulkvsPhoneNumber, User, UnifiedContact } from "@shared/schema";
import { formatForDisplay } from "@shared/phone";
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

export default function SmsMmsPage() {
  const { toast } = useToast();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("threads");
  const [provisionModalOpen, setProvisionModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [reactivateConfirmOpen, setReactivateConfirmOpen] = useState(false);
  const [showNewMessageView, setShowNewMessageView] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string>("");

  // Get user's timezone
  const { data: userData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });
  const userTimezone = userData?.user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Get unified contacts
  const { data: contactsData } = useQuery<{ contacts: UnifiedContact[] }>({
    queryKey: ["/api/contacts/unified"],
  });
  const contacts = contactsData?.contacts || [];

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
    enabled: !!selectedThreadId && !selectedThreadId.startsWith('temp-'),
  });

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || null;

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, mediaFile }: { message: string; mediaFile?: File }) => {
      // Skip if this is a temporary thread (handled separately)
      if (selectedThreadId?.startsWith('temp-')) {
        return;
      }
      
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
    onMutate: async ({ message, mediaFile }) => {
      // OPTIMISTIC UPDATE: Add message IMMEDIATELY like WhatsApp
      if (!selectedThread || !activeNumbers[0]) return;

      await queryClient.cancelQueries({ queryKey: ["/api/bulkvs/threads", selectedThreadId, "messages"] });

      const previousMessages = queryClient.getQueryData<BulkvsMessage[]>([
        "/api/bulkvs/threads",
        selectedThreadId,
        "messages",
      ]);

      const optimisticMessage: BulkvsMessage = {
        id: `temp-${Date.now()}`,
        threadId: selectedThread.id,
        direction: "outbound",
        status: "sending",
        from: activeNumbers[0].did,
        to: selectedThread.externalPhone,
        body: message || null,
        mediaUrl: mediaFile ? URL.createObjectURL(mediaFile) : null,
        mediaType: mediaFile?.type || null,
        providerMsgId: null,
        errorCode: null,
        errorMessage: null,
        deliveredAt: null,
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      queryClient.setQueryData<BulkvsMessage[]>(
        ["/api/bulkvs/threads", selectedThreadId, "messages"],
        (old) => [...(old || []), optimisticMessage]
      );

      return { previousMessages };
    },
    onSuccess: () => {
      // Refresh to get the real message from server
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/threads", selectedThreadId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/threads"] });
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["/api/bulkvs/threads", selectedThreadId, "messages"],
          context.previousMessages
        );
      }
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

  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      return apiRequest("DELETE", `/api/bulkvs/threads/${threadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/threads"] });
      setSelectedThreadId(null);
      setMobileView("threads");
      toast({
        title: "Thread deleted",
        description: "Conversation deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete thread",
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

  const handleMarkAsRead = () => {
    if (!selectedThreadId) return;
    
    const thread = threads.find((t) => t.id === selectedThreadId);
    if (thread && thread.unreadCount > 0) {
      markAsReadMutation.mutate(selectedThreadId);
    }
  };

  const handleSendMessage = async (message: string, mediaFile?: File) => {
    // Check if this is a temporary thread
    if (selectedThreadId?.startsWith('temp-')) {
      // For temporary threads, create the thread first by sending the message
      const currentThread = threads.find(t => t.id === selectedThreadId);
      if (!currentThread) return;
      
      try {
        // Send message to create thread
        const formData = new FormData();
        formData.append("to", currentThread.externalPhone);
        formData.append("body", message);
        if (mediaFile) {
          formData.append("media", mediaFile);
        }

        const result = (await apiRequest(
          "POST",
          "/api/bulkvs/messages",
          formData
        )) as { thread: BulkvsThread; message: BulkvsMessage };
        
        // Clear initial message immediately
        setInitialMessage("");
        
        // Remove temporary thread and add real thread
        queryClient.setQueryData<BulkvsThread[]>(
          ["/api/bulkvs/threads"],
          (old) => {
            if (!old) return [result.thread];
            return [result.thread, ...old.filter(t => !t.id.startsWith('temp-'))];
          }
        );
        
        // Invalidate queries FIRST to ensure data is fresh
        await queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/threads"] });
        
        // THEN switch to real thread - this ensures threads list is updated
        setTimeout(() => {
          setSelectedThreadId(result.thread.id);
        }, 100);
        
        toast({
          title: "Message sent",
          description: "Conversation created successfully.",
        });
      } catch (error) {
        toast({
          title: "Failed to send message",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      }
    } else {
      // Normal thread, use existing mutation
      sendMessageMutation.mutate({ message, mediaFile });
      setInitialMessage("");
    }
  };

  const handleCreateNewThread = (phoneNumber: string) => {
    // Buscar si ya existe un thread con este número
    const existingThread = threads.find(
      (t) => t.externalPhone === phoneNumber
    );
    
    if (existingThread) {
      // Si existe, simplemente seleccionarlo
      setSelectedThreadId(existingThread.id);
      setMobileView("messages");
    } else {
      // Buscar el nombre del contacto en la lista de contactos unificados
      const contact = contacts.find(c => c.phone === phoneNumber);
      const displayName = contact 
        ? (contact.firstName && contact.lastName 
            ? `${contact.firstName} ${contact.lastName}`
            : contact.firstName || formatForDisplay(phoneNumber))
        : formatForDisplay(phoneNumber);
      
      // Si no existe, crear un thread temporal
      toast({
        title: "New conversation",
        description: `Starting conversation with ${displayName}`,
      });
      
      const tempThread: BulkvsThread = {
        id: `temp-${Date.now()}`,
        userId: String(userData?.user?.id || ""),
        companyId: String(userData?.user?.companyId || ""),
        phoneNumberId: activeNumbers[0]?.id || "",
        externalPhone: phoneNumber,
        displayName: displayName, // Usar el nombre del contacto si existe
        lastMessageAt: new Date(),
        lastMessagePreview: "",
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        isArchived: false,
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Agregar el thread temporal a la lista
      queryClient.setQueryData<BulkvsThread[]>(
        ["/api/bulkvs/threads"],
        (old) => old ? [tempThread, ...old] : [tempThread]
      );
      
      setSelectedThreadId(tempThread.id);
      setMobileView("messages");
    }
  };

  const handleUpdateThread = (updates: Partial<BulkvsThread>) => {
    updateThreadMutation.mutate(updates);
  };

  const handleDeleteThread = () => {
    if (selectedThreadId) {
      deleteThreadMutation.mutate(selectedThreadId);
    }
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
                {formatForDisplay(cancelledNumber.did)}
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
                  Reactivate {formatForDisplay(cancelledNumber.did)}
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
                  This will reactivate your phone number <strong>{formatForDisplay(cancelledNumber.did)}</strong> and create a new subscription at ${cancelledNumber.monthlyPrice}/month. Billing will start immediately.
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
        <div className="flex items-center justify-center h-full p-4">
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
      <div className="h-full flex overflow-hidden bg-muted/30" data-testid="sms-mms-page">
        <div className="hidden md:grid md:grid-cols-[25%_50%_25%] w-full h-full gap-0">
          <ThreadList
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelectThread={handleSelectThread}
            onSettings={() => setSettingsModalOpen(true)}
            onNewMessage={() => setShowNewMessageView(true)}
            userTimezone={userTimezone}
            showNewMessageView={showNewMessageView}
            contacts={contacts}
            onCreateNewThread={handleCreateNewThread}
            onCloseNewMessage={() => setShowNewMessageView(false)}
          />

        <MessagePanel
          thread={selectedThread}
          messages={messages}
          onSendMessage={handleSendMessage}
          onUpdateThread={handleUpdateThread}
          onDeleteThread={handleDeleteThread}
          isLoading={loadingMessages}
          userTimezone={userTimezone}
          onMarkAsRead={handleMarkAsRead}
          initialMessage={initialMessage}
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
              onNewMessage={() => setShowNewMessageView(true)}
              userTimezone={userTimezone}
              showNewMessageView={showNewMessageView}
              contacts={contacts}
              onCreateNewThread={handleCreateNewThread}
              onCloseNewMessage={() => setShowNewMessageView(false)}
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
              onDeleteThread={handleDeleteThread}
              onBack={handleBackToThreads}
              onShowDetails={handleShowDetails}
              isLoading={loadingMessages}
              userTimezone={userTimezone}
              onMarkAsRead={handleMarkAsRead}
              initialMessage={initialMessage}
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
