import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, User, Trash2 } from "lucide-react";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset state when dialog opens or current avatar changes
  useEffect(() => {
    if (open) {
      setAvatarUrl(currentAvatar || "");
    }
  }, [open, currentAvatar]);

  const updateAvatarMutation = useMutation({
    mutationFn: async (avatar: string) => {
      const response = await apiRequest("PATCH", "/api/settings/profile", { avatar });
      return response.json();
    },
    onSuccess: (_, avatar) => {
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      toast({
        title: "Success",
        description: avatar ? "Profile photo updated successfully" : "Profile photo removed successfully",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update profile photo",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-upload-avatar">
        <DialogHeader>
          <DialogTitle>Upload Profile Photo</DialogTitle>
          <DialogDescription>
            Enter the URL of your profile photo. Make sure the URL points to a valid image.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl || currentAvatar} alt="Profile photo preview" />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm text-muted-foreground">Preview</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Image URL</label>
            <Input
              placeholder="https://example.com/photo.jpg"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              data-testid="input-avatar-url"
            />
            <p className="text-xs text-muted-foreground">
              Paste the URL of an image from the web
            </p>
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
