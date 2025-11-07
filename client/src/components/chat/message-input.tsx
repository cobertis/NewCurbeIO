import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Send, X } from "lucide-react";
import { EmojiPicker } from "./emoji-picker";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSendMessage: (message: string, mediaFile?: File) => void;
  disabled?: boolean;
  onMarkAsRead?: () => void;
  initialMessage?: string;
}

export function MessageInput({ onSendMessage, disabled = false, onMarkAsRead, initialMessage }: MessageInputProps) {
  const [message, setMessage] = useState(initialMessage || "");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update message when initialMessage changes
  useEffect(() => {
    if (initialMessage) {
      setMessage(initialMessage);
      // Focus the input after a short delay
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [initialMessage]);

  const handleSend = () => {
    if ((!message.trim() && !mediaFile) || disabled) return;

    onSendMessage(message.trim(), mediaFile || undefined);
    setMessage("");
    setMediaFile(null);
    setMediaPreview(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      alert("Only images and videos are supported");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    setMediaFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newMessage = message.slice(0, start) + emoji + message.slice(end);
    
    setMessage(newMessage);
    
    setTimeout(() => {
      input.selectionStart = input.selectionEnd = start + emoji.length;
      input.focus();
    }, 0);
  };

  return (
    <div className="p-3 flex-shrink-0" data-testid="message-input-container">
      {mediaPreview && (
        <div className="mb-2 relative inline-block" data-testid="media-preview">
          <img
            src={mediaPreview}
            alt="Preview"
            className="max-w-[200px] max-h-[200px] rounded-lg border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={handleRemoveMedia}
            data-testid="button-remove-media"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-file"
      />

      <div className="flex items-center gap-2 bg-muted/40 dark:bg-muted/20 rounded-full px-3 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0 rounded-full hover:bg-muted/60"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          data-testid="button-attach"
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
        </Button>

        <EmojiPicker onEmojiSelect={handleEmojiSelect} />

        <Input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => onMarkAsRead?.()}
          placeholder="Escribe un mensaje"
          className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto p-0 text-sm placeholder:text-muted-foreground"
          disabled={disabled}
          data-testid="input-message"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 flex-shrink-0 rounded-full hover:bg-muted/60",
            (!message.trim() && !mediaFile) && "opacity-50"
          )}
          onClick={handleSend}
          disabled={(!message.trim() && !mediaFile) || disabled}
          data-testid="button-send"
        >
          <Send className="h-4 w-4 text-primary" />
        </Button>
      </div>
    </div>
  );
}
