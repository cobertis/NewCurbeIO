import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBirthdayImageSchema, type BirthdayImage, type InsertBirthdayImage } from "@shared/schema";
import { Plus, Edit, Trash2, ImagePlus, AlertCircle, Image as ImageIcon } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LoadingSpinner } from "@/components/loading-spinner";

export default function BirthdayImagesPage() {
  const { toast } = useToast();
  const [editingImage, setEditingImage] = useState<BirthdayImage | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<BirthdayImage | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: sessionData } = useQuery<{ user: { id: string; email: string; role: string; companyId: string | null } }>({
    queryKey: ["/api/session"],
  });

  const user = sessionData?.user;

  const { data, isLoading } = useQuery<{ images: BirthdayImage[] }>({
    queryKey: ["/api/admin/birthday-images"],
  });

  const images = data?.images || [];

  const createMutation = useMutation({
    mutationFn: async (values: InsertBirthdayImage) => {
      const response = await fetch("/api/admin/birthday-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create birthday image");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/birthday-images"] });
      toast({ 
        title: "Birthday image added successfully",
        duration: 3000,
      });
      setIsDialogOpen(false);
      form.reset();
      setImageFile(null);
      setImagePreview(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to add birthday image", 
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<InsertBirthdayImage> }) => {
      const response = await fetch(`/api/admin/birthday-images/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update birthday image");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/birthday-images"] });
      toast({ 
        title: "Birthday image updated successfully",
        duration: 3000,
      });
      setIsDialogOpen(false);
      setEditingImage(null);
      form.reset();
      setImageFile(null);
      setImagePreview(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update birthday image",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/birthday-images/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete birthday image");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/birthday-images"] });
      toast({ 
        title: "Birthday image deleted successfully",
        duration: 3000,
      });
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to delete birthday image",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
      setDeleteConfirm(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await fetch(`/api/admin/birthday-images/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update birthday image status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/birthday-images"] });
      toast({ 
        title: "Birthday image status updated",
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update status",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const form = useForm<InsertBirthdayImage>({
    resolver: zodResolver(insertBirthdayImageSchema),
    defaultValues: {
      name: "",
      imageUrl: "",
      isActive: true,
    },
  });

  function openCreateDialog() {
    setEditingImage(null);
    form.reset({
      name: "",
      imageUrl: "",
      isActive: true,
    });
    setImageFile(null);
    setImagePreview(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(image: BirthdayImage) {
    setEditingImage(image);
    form.reset({
      name: image.name,
      imageUrl: image.imageUrl,
      isActive: image.isActive,
    });
    setImagePreview(image.imageUrl);
    setIsDialogOpen(true);
  }

  async function onSubmit(values: InsertBirthdayImage) {
    if (editingImage) {
      updateMutation.mutate({ id: editingImage.id, values });
    } else {
      createMutation.mutate(values);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File too large",
          description: "Image must be less than 5MB",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        form.setValue("imageUrl", base64);
      };
      reader.readAsDataURL(file);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading birthday images..." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Birthday Images</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage birthday greeting images for automated birthday messages</p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-add-image" className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Image
        </Button>
      </div>

      {images.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ImagePlus className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No birthday images yet</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">Get started by adding your first birthday image for automated birthday greetings</p>
            <Button onClick={openCreateDialog} data-testid="button-add-first-image">
              <Plus className="mr-2 h-4 w-4" />
              Add Image
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {images.map((image) => (
            <Card key={image.id} data-testid={`card-image-${image.id}`} className="overflow-hidden">
              <div className="relative aspect-video bg-muted">
                {image.imageUrl ? (
                  <img 
                    src={image.imageUrl} 
                    alt={image.name}
                    className="w-full h-full object-cover"
                    data-testid={`img-preview-${image.id}`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <Badge variant={image.isActive ? "default" : "secondary"} data-testid={`badge-status-${image.id}`} className="shadow-sm">
                    {image.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-base leading-tight">{image.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uploaded {new Date(image.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={image.isActive}
                      onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: image.id, isActive: checked })}
                      disabled={toggleActiveMutation.isPending}
                      data-testid={`switch-active-${image.id}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {image.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(image)}
                      data-testid={`button-edit-${image.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeleteConfirm(image)}
                      data-testid={`button-delete-${image.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]" data-testid="dialog-image-form">
          <DialogHeader>
            <DialogTitle>{editingImage ? "Edit Birthday Image" : "Add Birthday Image"}</DialogTitle>
            <DialogDescription>
              {editingImage 
                ? "Update the birthday image details"
                : "Add a new image that users can select for birthday greetings"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Birthday Cake" {...field} data-testid="input-image-name" />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for this birthday image
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          data-testid="input-image-file"
                        />
                        {imagePreview && (
                          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
                            <img 
                              src={imagePreview} 
                              alt="Preview"
                              className="w-full h-full object-cover"
                              data-testid="img-upload-preview"
                            />
                          </div>
                        )}
                        <Input 
                          type="hidden" 
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Upload an image (max 5MB). Supported formats: JPG, PNG, GIF
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Make this image available for users to select
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending || !form.watch("imageUrl")}
                  data-testid="button-submit"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? (editingImage ? "Updating..." : "Adding...")
                    : (editingImage ? "Update Image" : "Add Image")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Birthday Image?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
              Users who had this image selected will need to choose a different one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
