import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Trash2, ImageIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UploadAvatarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatar?: string;
  userInitial: string;
}

export function UploadAvatarDialog({ open, onOpenChange, currentAvatar, userInitial }: UploadAvatarDialogProps) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatar || "");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset state when dialog opens or current avatar changes
  useEffect(() => {
    if (open) {
      setAvatarUrl(currentAvatar || "");
      setIsDragging(false);
    }
  }, [open, currentAvatar]);

  const updateAvatarMutation = useMutation({
    mutationFn: async (avatar: string) => {
      const result = await apiRequest("PATCH", "/api/settings/profile", { avatar });
      return result;
    },
    onSuccess: (_, avatar) => {
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      toast({
        title: "Success",
        description: avatar ? "Profile photo updated successfully" : "Profile photo removed successfully",
        duration: 3000,
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update profile photo",
        duration: 3000,
      });
    },
  });

  const handleSubmit = () => {
    // Allow empty strings to remove avatar
    updateAvatarMutation.mutate(avatarUrl.trim());
  };

  const handleRemove = () => {
    updateAvatarMutation.mutate("");
  };

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please select an image file (JPG, PNG, GIF, etc.)",
      });
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please select an image smaller than 5MB",
      });
      return;
    }

    // Read file and convert to data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAvatarUrl(result);
    };
    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to read the image file",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-upload-avatar">
        <DialogHeader>
          <DialogTitle>Upload Profile Photo</DialogTitle>
          <DialogDescription>
            Choose an image from your computer to use as your profile photo
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Preview */}
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl || currentAvatar} alt="Profile photo preview" />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm text-muted-foreground">Preview</p>
          </div>

          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleButtonClick}
            className={`
              relative border-2 border-dashed rounded-lg p-6 cursor-pointer
              transition-colors duration-200
              ${isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
              }
            `}
            data-testid="upload-area"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
              data-testid="input-avatar-file"
            />
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="rounded-full bg-primary/10 p-3">
                <ImageIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, GIF up to 5MB
                </p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-avatar"
            >
              Cancel
            </Button>
            {currentAvatar && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemove}
                disabled={updateAvatarMutation.isPending}
                data-testid="button-remove-avatar"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Photo
              </Button>
            )}
          </div>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={updateAvatarMutation.isPending}
            data-testid="button-submit-avatar"
          >
            {updateAvatarMutation.isPending ? "Saving..." : "Save Photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
