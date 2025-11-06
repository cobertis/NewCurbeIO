import { useState, useMemo } from "react";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, ArrowLeft } from "lucide-react";
import { formatForDisplay } from "@shared/phone";
import type { BulkvsThread, UnifiedContact } from "@shared/schema";
import defaultAvatar from "@assets/generated_images/Generic_user_avatar_icon_55b842ef.png";

interface NewMessageSheetProps {
  threads: BulkvsThread[];
  contacts: UnifiedContact[];
  onSelectThread: (threadId: string) => void;
  onCreateNewThread: (phoneNumber: string) => void;
  onClose: () => void;
}

export function NewMessageSheet({
  threads,
  contacts,
  onSelectThread,
  onCreateNewThread,
  onClose,
}: NewMessageSheetProps) {
  const [searchQuery, setSearchQuery] = useState("");

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

  // Combinar threads y contactos en una sola lista
  const allContacts = useMemo(() => {
    const contactMap = new Map();

    // Primero agregar todos los contactos de la base de datos
    contacts.forEach((contact) => {
      if (contact.phone) {
        const normalizedPhone = normalizePhone(contact.phone);
        if (!contactMap.has(normalizedPhone)) {
          // PRIORITY ORDER: displayName > companyName > firstName+lastName > formatted phone
          const constructedName = [contact.firstName, contact.lastName]
            .filter(Boolean)
            .join(" ");
          const displayName = 
            contact.displayName || 
            contact.companyName || 
            constructedName || 
            formatForDisplay(normalizedPhone);
          
          contactMap.set(normalizedPhone, {
            phone: normalizedPhone,
            displayName: displayName,
            hasThread: false,
            threadId: null,
          });
        }
      }
    });

    // Luego agregar threads (pueden sobrescribir si tienen displayName)
    threads.forEach((thread) => {
      const existing = contactMap.get(thread.externalPhone);
      if (existing) {
        existing.hasThread = true;
        existing.threadId = thread.id;
        if (thread.displayName) {
          existing.displayName = thread.displayName;
        }
      } else {
        contactMap.set(thread.externalPhone, {
          phone: thread.externalPhone,
          displayName: thread.displayName || "",
          hasThread: true,
          threadId: thread.id,
        });
      }
    });

    return Array.from(contactMap.values());
  }, [contacts, threads]);

  // Filtrar contactos por búsqueda
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) {
      return allContacts;
    }

    const query = searchQuery.toLowerCase();
    const searchDigits = searchQuery.replace(/\D/g, "");
    
    return allContacts.filter((c) => {
      const nameMatch = c.displayName?.toLowerCase().includes(query);
      const phoneMatch = c.phone.includes(searchDigits);
      return nameMatch || phoneMatch;
    });
  }, [allContacts, searchQuery]);

  // Verificar si el número buscado ya existe
  const searchedPhoneNormalized = useMemo(() => {
    if (isValidPhoneNumber(searchQuery)) {
      return normalizePhone(searchQuery);
    }
    return null;
  }, [searchQuery]);

  const phoneAlreadyExists = useMemo(() => {
    if (!searchedPhoneNormalized) return true;
    // Verificar si el número ya existe en TODOS los contactos (no solo threads)
    return allContacts.some((c) => c.phone === searchedPhoneNormalized);
  }, [searchedPhoneNormalized, allContacts]);

  const handleSelectContact = (contact: { phone: string; hasThread: boolean; threadId: string | null }) => {
    if (contact.hasThread && contact.threadId) {
      // Ya tiene thread, abrirlo
      onSelectThread(contact.threadId);
    } else {
      // No tiene thread, crear uno nuevo
      onCreateNewThread(contact.phone);
    }
    onClose();
  };

  const handleCreateNew = () => {
    if (searchedPhoneNormalized) {
      onCreateNewThread(searchedPhoneNormalized);
      onClose();
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b space-y-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold">New Message</h2>
        </div>

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

      <ScrollArea className="flex-1">
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

            {/* Lista de todos los contactos */}
            {filteredContacts.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  All Contacts
                </div>
                {filteredContacts.map((contact, index) => (
                  <button
                    key={`${contact.phone}-${index}`}
                    onClick={() => handleSelectContact(contact)}
                    className="w-full p-3 rounded-lg flex items-center gap-3 hover:bg-accent transition-colors text-left"
                    data-testid={`contact-${contact.phone}`}
                  >
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarImage src={defaultAvatar} alt="Contact" />
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {contact.displayName || formatForDisplay(contact.phone)}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {formatForDisplay(contact.phone)}
                      </p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Estado vacío */}
            {filteredContacts.length === 0 && !searchedPhoneNormalized && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {searchQuery
                  ? "No contacts found"
                  : "No contacts yet. Enter a phone number to start a conversation."}
              </div>
            )}

            {/* Número inválido */}
            {searchQuery && !searchedPhoneNormalized && filteredContacts.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Enter a valid phone number to start a new conversation
              </div>
            )}
          </div>
        </ScrollArea>
    </div>
  );
}
