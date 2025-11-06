import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { UserPlus, Ban, Trash2, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BulkvsThread, BulkvsMessage } from "@shared/schema";
import defaultAvatar from "@assets/generated_images/Generic_user_avatar_icon_55b842ef.png";

interface ContactDetailsProps {
  thread: BulkvsThread | null;
  messages: BulkvsMessage[];
  onUpdateThread?: (updates: Partial<BulkvsThread>) => void;
  onDeleteThread?: () => void;
  onClose?: () => void;
}

export function ContactDetails({ 
  thread, 
  messages, 
  onUpdateThread, 
  onDeleteThread,
  onClose 
}: ContactDetailsProps) {
  const [newLabel, setNewLabel] = useState("");

  if (!thread) {
    return (
      <Card className="h-full flex items-center justify-center border-l">
        <p className="text-sm text-muted-foreground">Select a conversation to view details</p>
      </Card>
    );
  }

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      const areaCode = cleaned.slice(1, 4);
      const prefix = cleaned.slice(4, 7);
      const line = cleaned.slice(7);
      return `+1 (${areaCode}) ${prefix}-${line}`;
    }
    return phone;
  };

  const handleAddLabel = () => {
    if (!newLabel.trim() || !onUpdateThread) return;
    
    const currentLabels = thread.labels || [];
    if (currentLabels.includes(newLabel.trim())) return;

    onUpdateThread({
      labels: [...currentLabels, newLabel.trim()],
    });
    setNewLabel("");
  };

  const handleRemoveLabel = (label: string) => {
    if (!onUpdateThread) return;
    
    const currentLabels = thread.labels || [];
    onUpdateThread({
      labels: currentLabels.filter(l => l !== label),
    });
  };

  const mediaMessages = messages.filter(m => m.mediaUrl);

  return (
    <Card className="h-full flex flex-col border-l overflow-hidden" data-testid="contact-details">
      <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold">Contact Info</h3>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="md:hidden"
            data-testid="button-close-details"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col items-center text-center">
          <Avatar className="h-24 w-24 mb-3" data-testid="avatar-contact">
            {thread.displayName ? (
              <AvatarFallback className="bg-muted text-muted-foreground text-2xl">
                {getInitials(thread.displayName)}
              </AvatarFallback>
            ) : (
              <AvatarImage src={defaultAvatar} alt="Contact" className="object-cover" />
            )}
          </Avatar>
          <h3 className="font-semibold text-lg" data-testid="text-contact-name">
            {thread.displayName ?? "Unknown Contact"}
          </h3>
          <p className="text-sm text-muted-foreground" data-testid="text-contact-phone">
            {formatPhone(thread.externalPhone)}
          </p>
        </div>

        <Separator />

        <div className="p-4">
          <h4 className="text-sm font-medium mb-3">Labels</h4>
          <div className="flex flex-wrap gap-2 mb-3">
            {(thread.labels || []).map((label) => (
              <Badge
                key={label}
                variant="secondary"
                className="gap-1"
                data-testid={`label-${label}`}
              >
                {label}
                {onUpdateThread && (
                  <button
                    onClick={() => handleRemoveLabel(label)}
                    className="ml-1 hover:text-destructive"
                    data-testid={`button-remove-label-${label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          {onUpdateThread && (
            <div className="flex gap-2">
              <Input
                placeholder="Add label..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddLabel();
                  }
                }}
                data-testid="input-new-label"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleAddLabel}
                disabled={!newLabel.trim()}
                data-testid="button-add-label"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {mediaMessages.length > 0 && (
          <>
            <Separator />
            <div className="p-4">
              <h4 className="text-sm font-medium mb-3">
                Media ({mediaMessages.length})
              </h4>
              <div className="grid grid-cols-3 gap-2" data-testid="media-gallery">
                {mediaMessages.slice(0, 9).map((msg) => (
                  <div
                    key={msg.id}
                    className="aspect-square rounded overflow-hidden bg-muted"
                    data-testid={`media-item-${msg.id}`}
                  >
                    <img
                      src={msg.mediaUrl!}
                      alt="Media"
                      className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer"
                    />
                  </div>
                ))}
              </div>
              {mediaMessages.length > 9 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  +{mediaMessages.length - 9} more
                </p>
              )}
            </div>
          </>
        )}

        <Separator />

        <div className="p-4 space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            data-testid="button-add-contact"
          >
            <UserPlus className="h-4 w-4" />
            Add to Contacts
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-orange-600 hover:text-orange-700"
            data-testid="button-block"
          >
            <Ban className="h-4 w-4" />
            Block Contact
          </Button>
          {onDeleteThread && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              onClick={onDeleteThread}
              data-testid="button-delete"
            >
              <Trash2 className="h-4 w-4" />
              Delete Conversation
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
