import { useState, useMemo } from "react";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, UserPlus } from "lucide-react";
import { formatForDisplay } from "@shared/phone";
import type { BulkvsThread } from "@shared/schema";
import defaultAvatar from "@assets/generated_images/Generic_user_avatar_icon_55b842ef.png";

interface NewMessageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threads: BulkvsThread[];
  onSelectThread: (threadId: string) => void;
  onCreateNewThread: (phoneNumber: string) => void;
}

export function NewMessageSheet({
  open,
  onOpenChange,
  threads,
  onSelectThread,
  onCreateNewThread,
}: NewMessageSheetProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Limpiar búsqueda al cerrar
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSearchQuery("");
    }
    onOpenChange(newOpen);
  };

  // Normalizar número de teléfono
  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return "1" + digits;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      return digits;
    }
    return digits;
  };

  // Verificar si el texto es un número de teléfono válido
  const isValidPhoneNumber = (text: string): boolean => {
    const digits = text.replace(/\D/g, "");
    return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
  };

  // Filtrar threads por búsqueda
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) {
      return threads;
    }

    const query = searchQuery.toLowerCase();
    return threads.filter(
      (t) =>
        t.displayName?.toLowerCase().includes(query) ||
        t.externalPhone.includes(searchQuery.replace(/\D/g, ""))
    );
  }, [threads, searchQuery]);

  // Verificar si el número buscado ya existe
  const searchedPhoneNormalized = useMemo(() => {
    if (isValidPhoneNumber(searchQuery)) {
      return normalizePhone(searchQuery);
    }
    return null;
  }, [searchQuery]);

  const phoneAlreadyExists = useMemo(() => {
    if (!searchedPhoneNormalized) return true;
    return threads.some((t) => t.externalPhone === searchedPhoneNormalized);
  }, [searchedPhoneNormalized, threads]);

  const handleSelectExisting = (threadId: string) => {
    onSelectThread(threadId);
    handleOpenChange(false);
  };

  const handleCreateNew = () => {
    if (searchedPhoneNormalized) {
      onCreateNewThread(searchedPhoneNormalized);
      handleOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>New Message</SheetTitle>
        </SheetHeader>

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name or enter phone number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-contacts"
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="p-2">
            {/* Mostrar "Nuevo contacto" si es un número válido que no existe */}
            {searchedPhoneNormalized && !phoneAlreadyExists && (
              <>
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Users not in your contacts
                </div>
                <button
                  onClick={handleCreateNew}
                  className="w-full p-3 rounded-lg flex items-center gap-3 hover:bg-accent transition-colors text-left"
                  data-testid="button-new-contact"
                >
                  <div className="h-12 w-12 flex-shrink-0 rounded-full bg-muted flex items-center justify-center">
                    <UserPlus className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {formatForDisplay(searchedPhoneNormalized)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Start new conversation
                    </p>
                  </div>
                </button>
                <div className="my-2 border-t" />
              </>
            )}

            {/* Lista de contactos existentes */}
            {filteredThreads.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Contacts in Chat
                </div>
                {filteredThreads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => handleSelectExisting(thread.id)}
                    className="w-full p-3 rounded-lg flex items-center gap-3 hover:bg-accent transition-colors text-left"
                    data-testid={`contact-${thread.id}`}
                  >
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarImage src={defaultAvatar} alt="Contact" />
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {thread.displayName || formatForDisplay(thread.externalPhone)}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {thread.lastMessagePreview || "No messages yet"}
                      </p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Estado vacío */}
            {filteredThreads.length === 0 && !searchedPhoneNormalized && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {searchQuery
                  ? "No contacts found"
                  : "No contacts yet. Enter a phone number to start a conversation."}
              </div>
            )}

            {/* Número inválido */}
            {searchQuery && !searchedPhoneNormalized && filteredThreads.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Enter a valid phone number to start a new conversation
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
