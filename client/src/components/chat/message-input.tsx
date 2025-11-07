import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update message when initialMessage changes
  useEffect(() => {
    if (initialMessage) {
      setMessage(initialMessage);
      // Focus the textarea after a short delay
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [initialMessage]);

  const handleSend = () => {
    if ((!message.trim() && !mediaFile) || disabled) return;

    onSendMessage(message.trim(), mediaFile || undefined);
    setMessage("");
    setMediaFile(null);
    setMediaPreview(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
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
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newMessage = message.slice(0, start) + emoji + message.slice(end);
    
    setMessage(newMessage);
    
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      textarea.focus();
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

        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => onMarkAsRead?.()}
          placeholder="Escribe un mensaje"
          className="flex-1 min-h-[24px] max-h-[100px] resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 py-1 px-0 text-sm placeholder:text-muted-foreground leading-normal"
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
