import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  CheckCircle2,
  Play,
  Mail,
  ExternalLink,
  Calendar,
  Users,
  Settings,
  Globe,
  Plus,
  Trash2,
  MoreVertical,
  ChevronRight,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SettingsLayout } from "@/components/settings-layout";

interface EmailSettings {
  id: string;
  companyId: string;
  sendingDomain: string;
  verificationStatus: string;
  dkimStatus?: string;
  isActive: boolean;
  senders?: Array<{ fromEmail: string; fromName: string; replyToEmail?: string }>;
}

interface EmailSender {
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
}

export default function EmailIntegrationPage({ embedded = false }: { embedded?: boolean }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSender, setEditingSender] = useState<EmailSender | null>(null);
  const [editingSenderIndex, setEditingSenderIndex] = useState<number>(-1);
  const [editForm, setEditForm] = useState({ fromName: "", replyToEmail: "" });
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSenderIndex, setDeletingSenderIndex] = useState<number>(-1);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ fromEmail: "", fromName: "", replyToEmail: "" });

  const { data: settingsResponse, isLoading } = useQuery<{ configured: boolean; settings: EmailSettings | null }>({
    queryKey: ["/api/ses/settings"],
  });

  const settings = settingsResponse?.settings;
  const hasDomainConfigured = !!settings?.sendingDomain;
  const isDomainVerified = 
    settings?.verificationStatus?.toLowerCase() === "success" || 
    settings?.dkimStatus?.toLowerCase() === "success";

  const updateSendersMutation = useMutation({
    mutationFn: async (senders: EmailSender[]) => {
      return apiRequest("POST", "/api/ses/senders", { senders });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ses/settings"] });
      toast({ title: "Success", description: "Sender updated successfully." });
      setEditDialogOpen(false);
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update sender.", variant: "destructive" });
    },
  });

  const handleEditSender = (sender: EmailSender, index: number) => {
    setEditingSender(sender);
    setEditingSenderIndex(index);
    setEditForm({
      fromName: sender.fromName,
      replyToEmail: sender.replyToEmail || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!settings?.senders || editingSenderIndex < 0) return;
    
    const updatedSenders = settings.senders.map((s, i) => 
      i === editingSenderIndex
        ? { ...s, fromName: editForm.fromName, replyToEmail: editForm.replyToEmail }
        : s
    );
    updateSendersMutation.mutate(updatedSenders);
  };

  const handleDeleteSender = (index: number) => {
    setDeletingSenderIndex(index);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!settings?.senders || deletingSenderIndex < 0) return;
    
    const updatedSenders = settings.senders.filter((_, i) => i !== deletingSenderIndex);
    updateSendersMutation.mutate(updatedSenders);
  };

  const handleOpenAddDialog = () => {
    setAddForm({ fromEmail: "", fromName: "", replyToEmail: "" });
    setAddDialogOpen(true);
  };

  const handleAddSender = () => {
    if (!addForm.fromEmail || !addForm.fromName) return;
    
    const newSender: EmailSender = {
      fromEmail: `${addForm.fromEmail}@${settings?.sendingDomain}`,
      fromName: addForm.fromName,
      replyToEmail: addForm.replyToEmail || undefined,
    };
    const updatedSenders = [...(settings?.senders || []), newSender];
    updateSendersMutation.mutate(updatedSenders, {
      onSuccess: () => {
        setAddDialogOpen(false);
        setAddForm({ fromEmail: "", fromName: "", replyToEmail: "" });
      }
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading email settings..." />;
  }

  const dialogs = (
    <>
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit sender</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>"From" email address *</Label>
              <Input
                value={editingSender?.fromEmail || ""}
                disabled
                className="bg-slate-50 dark:bg-slate-800"
              />
              <p className="text-xs text-muted-foreground">
                The recipients will see this email <span className="text-blue-600">{editingSender?.fromEmail}</span> as the "From" address.
              </p>
            </div>

            <div className="space-y-2">
              <Label>"From" name *</Label>
              <Input
                value={editForm.fromName}
                onChange={(e) => setEditForm({ ...editForm, fromName: e.target.value })}
                placeholder="Organization or person name"
                data-testid="input-edit-from-name"
              />
              <p className="text-xs text-muted-foreground">
                This name will be displayed as the sender in email clients.
              </p>
            </div>

            <div className="space-y-2">
              <Label>"Reply-to" email</Label>
              <Input
                value={editForm.replyToEmail}
                onChange={(e) => setEditForm({ ...editForm, replyToEmail: e.target.value })}
                placeholder={editingSender?.fromEmail || "example@domain.com"}
                data-testid="input-edit-reply-to"
              />
              <p className="text-xs text-muted-foreground">
                Email where replies will be sent. If left blank, replies will go to the sender's email address.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Sender preview</Label>
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold">
                  {editForm.fromName.charAt(0).toUpperCase() || "S"}
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {editForm.fromName || "Sender Name"} &lt;{editingSender?.fromEmail}&gt;
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reply to: {editForm.replyToEmail || editingSender?.fromEmail}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateSendersMutation.isPending || !editForm.fromName}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-save-sender"
            >
              {updateSendersMutation.isPending && <LoadingSpinner fullScreen={false} />}
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add new sender</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>"From" email address *</Label>
              <div className="flex">
                <Input
                  value={addForm.fromEmail}
                  onChange={(e) => setAddForm({ ...addForm, fromEmail: e.target.value })}
                  placeholder="example"
                  className="rounded-r-none"
                  data-testid="input-add-from-email"
                />
                <div className="flex items-center px-3 bg-slate-100 dark:bg-slate-800 border border-l-0 border-input rounded-r-md text-sm text-muted-foreground">
                  @{settings?.sendingDomain}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The recipients will see this email <span className="text-blue-600">@{settings?.sendingDomain}</span> as the "From" address.
              </p>
            </div>

            <div className="space-y-2">
              <Label>"From" name *</Label>
              <Input
                value={addForm.fromName}
                onChange={(e) => setAddForm({ ...addForm, fromName: e.target.value })}
                placeholder="Organization or person name"
                data-testid="input-add-from-name"
              />
              <p className="text-xs text-muted-foreground">
                This name will be displayed as the sender in email clients.
              </p>
            </div>

            <div className="space-y-2">
              <Label>"Reply-to" email</Label>
              <Input
                value={addForm.replyToEmail}
                onChange={(e) => setAddForm({ ...addForm, replyToEmail: e.target.value })}
                placeholder="example@company.com"
                data-testid="input-add-reply-to"
              />
              <p className="text-xs text-muted-foreground">
                Email where replies will be sent. If left blank, replies will go to the sender's email address.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Sender preview</Label>
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    @{settings?.sendingDomain}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reply to:
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSender}
              disabled={updateSendersMutation.isPending || !addForm.fromEmail || !addForm.fromName}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-add-sender-confirm"
            >
              {updateSendersMutation.isPending && <LoadingSpinner fullScreen={false} />}
              Add sender
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sender</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sender? This action cannot be undone.
              {deletingSenderIndex >= 0 && settings?.senders?.[deletingSenderIndex] && (
                <span className="block mt-2 font-medium text-slate-900 dark:text-slate-100">
                  {settings.senders[deletingSenderIndex].fromEmail}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-sender"
            >
              {updateSendersMutation.isPending && <LoadingSpinner fullScreen={false} />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (hasDomainConfigured && isDomainVerified) {
    const content = (
      <div className="space-y-6" data-testid="page-email-integration">
        <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-email">
          <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">Settings</Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Email</span>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => setLocation("/settings/email/flow")} 
            data-testid="button-connect-new-domain"
          >
            <Plus className="w-4 h-4 mr-2" />
            Connect new domain
          </Button>
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <span className="font-semibold text-slate-900 dark:text-slate-100">{settings.sendingDomain}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  <CheckCircle2 className="w-3 h-3" />
                  Verified
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleOpenAddDialog}
                  data-testid="button-add-sender"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add sender
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                  data-testid="button-delete-domain"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>

            {settings.senders && settings.senders.length > 0 ? (
              <div>
                <div className="grid grid-cols-[1fr_1fr_1fr_40px] gap-4 px-4 py-3 text-xs font-medium text-muted-foreground bg-slate-50 dark:bg-slate-800/50">
                  <div>Sender email</div>
                  <div>"From" name</div>
                  <div>"Reply-to" email</div>
                  <div></div>
                </div>
                
                {settings.senders.map((sender, index) => (
                  <div 
                    key={index} 
                    className="grid grid-cols-[1fr_1fr_1fr_40px] gap-4 px-4 py-3 text-sm border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    data-testid={`row-sender-${index}`}
                  >
                    <div className="text-slate-900 dark:text-slate-100">{sender.fromEmail}</div>
                    <div className="text-slate-600 dark:text-slate-400">{sender.fromName}</div>
                    <div className="text-slate-600 dark:text-slate-400">{sender.replyToEmail || sender.fromEmail}</div>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`button-sender-menu-${index}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditSender(sender, index)}>
                            <Settings className="w-4 h-4 mr-2" />
                            Edit sender
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteSender(index)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete sender
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No senders configured yet</p>
                <Button 
                  variant="link" 
                  className="mt-2"
                  onClick={handleOpenAddDialog}
                >
                  Add your first sender
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        {dialogs}
      </div>
    );

    if (embedded) {
      return content;
    }
    return (
      <SettingsLayout activeSection="email">
        {content}
      </SettingsLayout>
    );
  }

  if (hasDomainConfigured && !isDomainVerified) {
    const content = (
      <div className="space-y-6" data-testid="page-email-integration">
        <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-email">
          <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">Settings</Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Email</span>
        </div>

        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100" data-testid="text-page-title">Email</h1>
          <p className="text-sm text-muted-foreground">Complete your domain verification to start sending emails</p>
        </div>

        <Card className="border-yellow-200 bg-yellow-50/30 dark:border-yellow-800 dark:bg-yellow-950/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold mb-1">Domain verification pending</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Your domain <strong>{settings?.sendingDomain}</strong> is awaiting DNS verification. Add the required DNS records to complete setup.
                </p>
                <Button 
                  onClick={() => setLocation("/settings/email/flow")}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-continue-setup"
                >
                  Continue Setup
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );

    if (embedded) {
      return content;
    }
    return (
      <SettingsLayout activeSection="email">
        {content}
      </SettingsLayout>
    );
  }

  const content = (
    <div className="space-y-6" data-testid="page-email-integration">
      <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-email">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">Settings</Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Email</span>
      </div>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-3">Get started with email campaigns</h2>
                <p className="text-muted-foreground">
                  Send professional emails in minutes. Share offers, updates, or newsletters and track campaign results in real time.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm">Create emails with a simple editor</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm">Send to thousands of contacts</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm">Track opens, clicks, and unsubscribes</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => setLocation("/settings/email/flow")}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-connect-domain"
                >
                  Connect your domain
                </Button>
                <Button variant="outline" data-testid="button-watch-tutorial">
                  <Play className="w-4 h-4 mr-2" />
                  Watch tutorial
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                To send email campaigns, first connect and verify your domain.
              </p>

              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <ExternalLink className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                      Don't have a domain?
                    </p>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      <a href="#" className="text-blue-600 hover:underline">Get a domain now</a> and start sending emails in minutes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden md:block">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 shadow-lg border">
                <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                    <Mail className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-sm">Email campaign preview</span>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex">
                      <span className="text-muted-foreground w-16">From</span>
                      <span>hello@yourdomain.com</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground w-16">To</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        10,240 contacts
                      </span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground w-16">Subject</span>
                      <span>Don't miss our special offer</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-3 border-t">
                    <Button variant="outline" size="sm" className="text-xs">
                      <Calendar className="w-3 h-3 mr-1" />
                      Schedule
                    </Button>
                    <Button size="sm" className="text-xs bg-green-600 hover:bg-green-700">
                      <Play className="w-3 h-3 mr-1" />
                      Send email
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Email campaigns FAQ</h2>
          <p className="text-sm text-muted-foreground">
            Haven't found what you were looking for? <a href="#" className="text-blue-600 hover:underline">Contact us</a>
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="benefits" className="border rounded-lg bg-white dark:bg-gray-800">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <span className="text-sm font-medium">What are the benefits of email campaigns?</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <p className="text-sm text-muted-foreground">
                Email campaigns help you reach your audience directly, build customer relationships, promote products or services, and track engagement with detailed analytics. They're cost-effective and provide measurable results.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="how-to-start" className="border rounded-lg bg-white dark:bg-gray-800">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <span className="text-sm font-medium">How do I start sending email campaigns?</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <p className="text-sm text-muted-foreground">
                First, connect and verify your sending domain. Then, create sender profiles for your emails. Once verified, you can create campaigns, select your audience, and start sending professional emails.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="verify-domain" className="border rounded-lg bg-white dark:bg-gray-800">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <span className="text-sm font-medium">Why do I need to verify my domain?</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <p className="text-sm text-muted-foreground">
                Domain verification proves you own the domain and improves email deliverability. It helps prevent spam and ensures your emails reach recipients' inboxes instead of spam folders.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="replies" className="border rounded-lg bg-white dark:bg-gray-800">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <span className="text-sm font-medium">Where will my recipients' replies go?</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <p className="text-sm text-muted-foreground">
                Replies go to the email address you specify when creating your sender profile. You can set a custom reply-to address different from your sending address if needed.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }
  return (
    <SettingsLayout activeSection="email">
      {content}
    </SettingsLayout>
  );
}
