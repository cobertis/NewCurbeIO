import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [EmojiPicker, setEmojiPicker] = useState<any>(null);

  useEffect(() => {
    const loadEmojiPicker = async () => {
      try {
        const emojiMartReact = await import("@emoji-mart/react");
        const data = await import("@emoji-mart/data");
        
        const PickerComponent = (emojiMartReact as any).default || emojiMartReact;
        
        setEmojiPicker(() => (props: any) => (
          <PickerComponent data={data.default} {...props} />
        ));
      } catch (error) {
        console.error("Failed to load emoji picker:", error);
      }
    };

    if (open && !EmojiPicker) {
      loadEmojiPicker();
    }
  }, [open, EmojiPicker]);

  const handleEmojiSelect = (emoji: any) => {
    onEmojiSelect(emoji.native);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          data-testid="button-emoji"
        >
          <Smile className="h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 border-0" align="end">
        {EmojiPicker ? (
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            theme="light"
            previewPosition="none"
            skinTonePosition="none"
          />
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading emoji picker...
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
