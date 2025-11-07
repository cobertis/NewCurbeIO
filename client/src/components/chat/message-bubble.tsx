import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import type { BulkvsMessage } from "@shared/schema";
import defaultAvatar from "@assets/generated_images/Generic_user_avatar_icon_55b842ef.png";

interface MessageBubbleProps {
  message: BulkvsMessage;
  isOutbound: boolean;
  showAvatar?: boolean;
  contactName?: string;
}

export function MessageBubble({ message, isOutbound, showAvatar = true, contactName }: MessageBubbleProps) {
  // Format time in 12-hour format with client timezone
  const formatTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'h:mm a'); // e.g., "10:43 p.m."
  };

  const getStatusIcon = () => {
    if (message.direction === "inbound") return null;
    
    switch (message.status) {
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" data-testid="status-sent" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" data-testid="status-delivered" />;
      case "read":
        return <CheckCheck className="h-3 w-3 text-blue-500" data-testid="status-read" />;
      case "failed":
        return <span className="text-xs text-red-500" data-testid="status-failed">Failed</span>;
      default:
        return null;
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isPhoneNumber = (text?: string) => {
    if (!text) return false;
    // Check if text is primarily digits (phone number)
    const digitsOnly = text.replace(/\D/g, "");
    return digitsOnly.length >= 10;
  };

  return (
    <div
      className={cn(
        "flex gap-2 mb-3",
        isOutbound ? "justify-end" : "justify-start"
      )}
      data-testid={`message-${message.id}`}
    >
      {!isOutbound && showAvatar && (
        <Avatar className="h-8 w-8 flex-shrink-0" data-testid="avatar-inbound">
          <AvatarImage src={defaultAvatar} alt="Contact" className="object-cover" />
        </Avatar>
      )}

      <div
        className={cn(
          "max-w-[70%] rounded-lg px-3 py-2",
          isOutbound
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
        data-testid={`bubble-${message.direction}`}
      >
        {message.mediaUrl && (
          <div className="mb-2" data-testid="message-media">
            <img
              src={message.mediaUrl}
              alt="MMS attachment"
              className="rounded max-w-full h-auto"
              loading="lazy"
            />
          </div>
        )}

        {message.body && (
          <p className="text-sm whitespace-pre-wrap break-words" data-testid="message-body">
            {message.body}
          </p>
        )}

        <div
          className={cn(
            "flex items-center justify-end gap-1 mt-1 text-xs",
            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          <span data-testid="message-timestamp">
            {formatTime(message.createdAt)}
          </span>
          {getStatusIcon()}
        </div>
      </div>

      {isOutbound && showAvatar && <div className="w-8" />}
    </div>
  );
}
