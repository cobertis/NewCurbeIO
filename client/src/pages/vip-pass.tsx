import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Loader2, Plus, Trash2, Save, Smartphone, QrCode, CreditCard, 
  Palette, Settings2, BarChart3, Eye, Download, Bell, Users, RefreshCw, Send, Copy, Link
} from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { format } from "date-fns";

const passFieldSchema = z.object({
  key: z.string().min(1, "Key is required"),
  label: z.string().min(1, "Label is required"),
  value: z.string().min(1, "Value is required"),
});

const vipPassDesignSchema = z.object({
  passName: z.string().min(1, "Pass name is required"),
  passDescription: z.string().min(1, "Description is required"),
  logoText: z.string().min(1, "Logo text is required"),
  backgroundColor: z.string(),
  foregroundColor: z.string(),
  labelColor: z.string(),
  passTypeIdentifier: z.string().optional(),
  teamIdentifier: z.string().optional(),
  barcodeFormat: z.string(),
  barcodeMessage: z.string(),
  primaryFields: z.array(passFieldSchema),
  auxiliaryFields: z.array(passFieldSchema),
  backFields: z.array(passFieldSchema),
});

type VipPassDesignFormData = z.infer<typeof vipPassDesignSchema>;
type PassField = z.infer<typeof passFieldSchema>;

interface VipPassStats {
  totalPasses: number;
  activePasses: number;
  revokedPasses: number;
  registeredDevices: number;
  totalDownloads: number;
  pushSubscriptions: number;
}

interface VipPassInstance {
  id: string;
  serialNumber: string;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  memberId: string | null;
  tierLevel: string;
  status: string;
  downloadCount: number;
  createdAt: string;
  authenticationToken: string;
  pushSubscriptionCount: number;
  pushEnabledAt: string | null;
  notificationCount: number;
}

interface NotificationHistory {
  id: string;
  targetType: string;
  message: string | null;
  sentCount: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
}

const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return `rgb(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)})`;
  }
  return hex;
};

const rgbToHex = (rgb: string): string => {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  if (rgb.startsWith('#')) return rgb;
  return "#000000";
};

const templateVariables = [
  { key: "serialNumber", description: "Unique pass serial number", example: "VIP-ABC123" },
  { key: "memberId", description: "Member ID", example: "M-001234" },
  { key: "recipientName", description: "Recipient's name", example: "John Doe" },
  { key: "tierLevel", description: "VIP tier level", example: "Gold" },
  { key: "companyName", description: "Company name", example: "Your Company" },
];

const replaceTemplateVars = (value: string): string => {
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const variable = templateVariables.find(v => v.key === key);
    return variable?.example || `{{${key}}}`;
  });
};

function PassPreview({ design }: { design: VipPassDesignFormData }) {
  const bgColor = design.backgroundColor?.startsWith('#') ? design.backgroundColor : (design.backgroundColor || '#000000');
  const fgColor = design.foregroundColor?.startsWith('#') ? design.foregroundColor : (design.foregroundColor || '#ffffff');
  const lblColor = design.labelColor?.startsWith('#') ? design.labelColor : (design.labelColor || '#c8c8c8');

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[300px] h-[420px] flex items-center justify-center">
        <div 
          className="absolute inset-0 rounded-3xl opacity-60 blur-xl"
          style={{
            background: `linear-gradient(135deg, ${bgColor}90, #00f2fe40, #4facfe40, #00f2fe40, ${bgColor}90)`,
            animation: 'pulse 3s ease-in-out infinite',
          }}
        />
        
        <div 
          className="relative w-[280px] h-[400px] rounded-3xl overflow-hidden"
          style={{ 
            backgroundColor: bgColor,
            color: fgColor,
            boxShadow: `0 0 30px ${bgColor}80, 0 20px 40px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)`,
          }}
          data-testid="pass-preview"
        >
          <div 
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              background: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.1) 25%, transparent 50%, rgba(255,255,255,0.15) 75%, transparent 100%)',
              backgroundSize: '400% 400%',
              animation: 'shimmer 8s ease-in-out infinite',
            }}
          />
          
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(${fgColor}20 1px, transparent 1px), linear-gradient(90deg, ${fgColor}20 1px, transparent 1px)`,
              backgroundSize: '16px 16px',
            }}
          />
          
          <div 
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: `linear-gradient(90deg, transparent, ${fgColor}60, transparent)` }}
          />
          
          <div className="relative p-5 flex justify-between items-start">
            <div className="flex flex-col gap-0.5">
              <div 
                className="text-xl font-black tracking-[0.15em] uppercase"
                style={{ textShadow: `0 0 15px ${fgColor}40` }}
                data-testid="preview-logo-text"
              >
                {design.logoText || "VIP GOLD"}
              </div>
              <div className="text-[8px] uppercase tracking-[0.25em] font-medium opacity-50">
                Exclusive Access
              </div>
            </div>
            
            <div 
              className="relative w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden"
              style={{ 
                background: `linear-gradient(135deg, ${fgColor}12, ${fgColor}05)`,
                boxShadow: `inset 0 1px 0 ${fgColor}15`,
              }}
            >
              <CreditCard className="h-5 w-5" style={{ color: fgColor }} />
            </div>
          </div>
          
          <div className="px-5 pb-3">
            <div className="relative h-[1px] w-full" style={{ backgroundColor: `${fgColor}15` }}>
              <div 
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: fgColor, boxShadow: `0 0 8px ${fgColor}` }}
              />
              <div 
                className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: fgColor, boxShadow: `0 0 8px ${fgColor}` }}
              />
            </div>
          </div>
          
          <div className="px-5 py-1">
            {design.primaryFields?.length > 0 ? (
              design.primaryFields.map((field, i) => (
                <div key={i} className="mb-3" data-testid={`preview-primary-field-${i}`}>
                  <div 
                    className="text-[9px] uppercase tracking-[0.2em] font-semibold mb-1 flex items-center gap-1.5"
                    style={{ color: lblColor }}
                  >
                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: lblColor }} />
                    {field.label}
                  </div>
                  <div 
                    className="text-2xl font-bold tracking-tight"
                    style={{ textShadow: `0 0 20px ${fgColor}25` }}
                  >
                    {replaceTemplateVars(field.value)}
                  </div>
                </div>
              ))
            ) : (
              <div className="mb-3">
                <div 
                  className="text-[9px] uppercase tracking-[0.2em] font-semibold mb-1 flex items-center gap-1.5"
                  style={{ color: lblColor }}
                >
                  <span className="w-1 h-1 rounded-full" style={{ backgroundColor: lblColor }} />
                  Member ID
                </div>
                <div className="text-2xl font-bold tracking-tight" style={{ textShadow: `0 0 20px ${fgColor}25` }}>
                  VIP-ABC123
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-2 flex gap-3">
            {design.auxiliaryFields?.length > 0 ? (
              design.auxiliaryFields.slice(0, 2).map((field, i) => (
                <div 
                  key={i} 
                  className="flex-1 p-2.5 rounded-lg"
                  style={{ 
                    background: `linear-gradient(135deg, ${fgColor}08, ${fgColor}02)`,
                    border: `1px solid ${fgColor}10`,
                  }}
                  data-testid={`preview-auxiliary-field-${i}`}
                >
                  <div className="text-[7px] uppercase tracking-[0.15em] font-semibold mb-0.5" style={{ color: lblColor }}>
                    {field.label}
                  </div>
                  <div className="text-xs font-semibold tracking-wide">
                    {replaceTemplateVars(field.value)}
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="flex-1 p-2.5 rounded-lg" style={{ background: `linear-gradient(135deg, ${fgColor}08, ${fgColor}02)`, border: `1px solid ${fgColor}10` }}>
                  <div className="text-[7px] uppercase tracking-[0.15em] font-semibold mb-0.5" style={{ color: lblColor }}>Tier</div>
                  <div className="text-xs font-semibold tracking-wide">Gold</div>
                </div>
                <div className="flex-1 p-2.5 rounded-lg" style={{ background: `linear-gradient(135deg, ${fgColor}08, ${fgColor}02)`, border: `1px solid ${fgColor}10` }}>
                  <div className="text-[7px] uppercase tracking-[0.15em] font-semibold mb-0.5" style={{ color: lblColor }}>Name</div>
                  <div className="text-xs font-semibold tracking-wide">John Doe</div>
                </div>
              </>
            )}
          </div>

          <div 
            className="absolute bottom-0 left-0 right-0 p-4 flex flex-col items-center"
            style={{ background: `linear-gradient(to top, rgba(255,255,255,0.98), rgba(255,255,255,0.95))` }}
          >
            <div className="relative">
              <div className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t-2 border-l-2 border-gray-400" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border-t-2 border-r-2 border-gray-400" />
              <div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b-2 border-l-2 border-gray-400" />
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b-2 border-r-2 border-gray-400" />
              
              <div className="w-20 h-20 rounded-lg flex items-center justify-center bg-white" data-testid="preview-barcode">
                {design.barcodeFormat === "PKBarcodeFormatQR" || design.barcodeFormat === "PKBarcodeFormatAztec" ? (
                  <QrCode className="h-14 w-14 text-gray-800" />
                ) : (
                  <BarChart3 className="h-12 w-14 text-gray-800" />
                )}
              </div>
            </div>
            <div className="text-[8px] text-gray-500 mt-2 font-mono tracking-wider uppercase">
              {replaceTemplateVars(design.barcodeMessage || "{{serialNumber}}")}
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes shimmer { 0%, 100% { background-position: 0% 0%; } 50% { background-position: 100% 100%; } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; transform: scale(0.98); } 50% { opacity: 0.7; transform: scale(1); } }
      `}</style>
    </div>
  );
}

function FieldArraySection({ 
  title, name, fields, append, remove, form 
}: { 
  title: string;
  name: "primaryFields" | "auxiliaryFields" | "backFields";
  fields: PassField[];
  append: (value: PassField) => void;
  remove: (index: number) => void;
  form: ReturnType<typeof useForm<VipPassDesignFormData>>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ key: "", label: "", value: "" })} data-testid={`button-add-${name}`}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No fields</p>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <Card key={index} className="p-2" data-testid={`${name}-field-${index}`}>
              <div className="grid grid-cols-3 gap-2">
                <FormField control={form.control} name={`${name}.${index}.key`} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Key</FormLabel>
                    <FormControl><Input {...field} placeholder="key" className="h-8 text-sm" data-testid={`input-${name}-${index}-key`} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name={`${name}.${index}.label`} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Label</FormLabel>
                    <FormControl><Input {...field} placeholder="Label" className="h-8 text-sm" data-testid={`input-${name}-${index}-label`} /></FormControl>
                  </FormItem>
                )} />
                <div className="flex items-end gap-1">
                  <FormField control={form.control} name={`${name}.${index}.value`} render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-xs">Value</FormLabel>
                      <FormControl><Input {...field} placeholder="{{var}}" className="h-8 text-sm" data-testid={`input-${name}-${index}-value`} /></FormControl>
                    </FormItem>
                  )} />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(index)} data-testid={`button-remove-${name}-${index}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VipPassPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("management");
  const [designConfigTab, setDesignConfigTab] = useState("basic");
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
  const [pushMessage, setPushMessage] = useState("");
  const [pushTarget, setPushTarget] = useState<"single" | "all">("all");
  const [newPass, setNewPass] = useState({ recipientName: "", recipientEmail: "", recipientPhone: "", memberId: "", tierLevel: "Gold" });

  const { data: existingDesign, isLoading: designLoading } = useQuery<VipPassDesignFormData>({ queryKey: ["/api/vip-pass/design"] });
  const { data: stats, isLoading: statsLoading } = useQuery<VipPassStats>({ queryKey: ["/api/vip-pass/stats"] });
  const { data: instances, isLoading: instancesLoading } = useQuery<VipPassInstance[]>({ queryKey: ["/api/vip-pass/instances"] });
  const { data: notificationHistory, isLoading: historyLoading } = useQuery<NotificationHistory[]>({ queryKey: ["/api/vip-pass/notifications/history"] });

  const form = useForm<VipPassDesignFormData>({
    resolver: zodResolver(vipPassDesignSchema),
    defaultValues: {
      passName: "VIP Gold Pass", passDescription: "VIP Member Pass", logoText: "VIP GOLD",
      backgroundColor: "#000000", foregroundColor: "#ffffff", labelColor: "#c8c8c8",
      passTypeIdentifier: "", teamIdentifier: "", barcodeFormat: "PKBarcodeFormatQR", barcodeMessage: "{{serialNumber}}",
      primaryFields: [{ key: "member", label: "Member ID", value: "{{memberId}}" }],
      auxiliaryFields: [{ key: "tier", label: "Tier", value: "{{tierLevel}}" }, { key: "name", label: "Name", value: "{{recipientName}}" }],
      backFields: [{ key: "info", label: "VIP Benefits", value: "Priority service\nExclusive updates" }],
    },
  });

  const primaryFieldsArray = useFieldArray({ control: form.control, name: "primaryFields" });
  const auxiliaryFieldsArray = useFieldArray({ control: form.control, name: "auxiliaryFields" });
  const backFieldsArray = useFieldArray({ control: form.control, name: "backFields" });

  useEffect(() => {
    if (existingDesign && Object.keys(existingDesign).length > 0) {
      const formData = {
        ...existingDesign,
        backgroundColor: existingDesign.backgroundColor?.startsWith('rgb') ? rgbToHex(existingDesign.backgroundColor) : (existingDesign.backgroundColor || "#000000"),
        foregroundColor: existingDesign.foregroundColor?.startsWith('rgb') ? rgbToHex(existingDesign.foregroundColor) : (existingDesign.foregroundColor || "#ffffff"),
        labelColor: existingDesign.labelColor?.startsWith('rgb') ? rgbToHex(existingDesign.labelColor) : (existingDesign.labelColor || "#c8c8c8"),
      };
      form.reset(formData);
    }
  }, [existingDesign, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: VipPassDesignFormData) => {
      const submitData = { ...data, backgroundColor: hexToRgb(data.backgroundColor), foregroundColor: hexToRgb(data.foregroundColor), labelColor: hexToRgb(data.labelColor) };
      return await apiRequest("POST", "/api/vip-pass/design", submitData);
    },
    onSuccess: () => { toast({ title: "Design saved" }); queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/design"] }); },
    onError: (error: Error) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const createPassMutation = useMutation({
    mutationFn: async (data: typeof newPass) => await apiRequest("POST", "/api/vip-pass/instances", data),
    onSuccess: () => {
      toast({ title: "Pass Created" });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/instances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/stats"] });
      setIssueDialogOpen(false);
      setNewPass({ recipientName: "", recipientEmail: "", recipientPhone: "", memberId: "", tierLevel: "Gold" });
    },
    onError: (error: Error) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const revokePassMutation = useMutation({
    mutationFn: async (passId: string) => await apiRequest("DELETE", `/api/vip-pass/instances/${passId}`),
    onSuccess: () => {
      toast({ title: "Pass Revoked" });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/instances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/stats"] });
    },
    onError: (error: Error) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const deletePassMutation = useMutation({
    mutationFn: async (passId: string) => await apiRequest("DELETE", `/api/vip-pass/instances/${passId}/permanent`),
    onSuccess: () => {
      toast({ title: "Pass Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/instances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/stats"] });
    },
    onError: (error: Error) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const sendPushMutation = useMutation({
    mutationFn: async ({ passInstanceId, message }: { passInstanceId?: string; message: string }) => {
      return await apiRequest("POST", "/api/vip-pass/notifications/send", { passInstanceId, message });
    },
    onSuccess: (data: any) => {
      toast({ title: "Push Sent", description: `Success: ${data.successCount || 0}, Failed: ${data.failedCount || 0}` });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/notifications/history"] });
      setPushDialogOpen(false);
      setPushMessage("");
    },
    onError: (error: Error) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const watchedValues = form.watch();

  if (designLoading || statsLoading) return <LoadingSpinner message="Loading VIP Pass..." />;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="page-title">VIP Pass</h1>
            <p className="text-muted-foreground">Design and manage Apple Wallet VIP passes for your members</p>
          </div>
          <div className="flex gap-2">
            {activeTab === "designer" && (
              <Button onClick={form.handleSubmit((data) => saveMutation.mutate(data))} disabled={saveMutation.isPending} data-testid="button-save-design">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Design
              </Button>
            )}
            {activeTab === "management" && (
              <>
                <Button variant="outline" onClick={() => { setPushTarget("all"); setPushDialogOpen(true); }} data-testid="button-send-push-all">
                  <Bell className="h-4 w-4 mr-2" /> Send Push
                </Button>
                <Button onClick={() => setIssueDialogOpen(true)} data-testid="button-issue-pass">
                  <Plus className="h-4 w-4 mr-2" /> Issue Pass
                </Button>
              </>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="management" data-testid="tab-management">
              <CreditCard className="h-4 w-4 mr-2" /> Management
            </TabsTrigger>
            <TabsTrigger value="designer" data-testid="tab-designer">
              <Palette className="h-4 w-4 mr-2" /> Designer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="designer" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2"><Settings2 className="h-5 w-5" /> Pass Configuration</CardTitle>
                  <CardDescription>Customize your VIP pass appearance and fields</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form className="space-y-6">
                      <Tabs value={designConfigTab} onValueChange={setDesignConfigTab}>
                        <TabsList className="grid w-full grid-cols-4" data-testid="config-tabs">
                          <TabsTrigger value="basic">Basic</TabsTrigger>
                          <TabsTrigger value="colors">Colors</TabsTrigger>
                          <TabsTrigger value="barcode">Barcode</TabsTrigger>
                          <TabsTrigger value="fields">Fields</TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="space-y-4 pt-4">
                          <FormField control={form.control} name="passName" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pass Name</FormLabel>
                              <FormControl><Input {...field} placeholder="VIP Gold Pass" data-testid="input-pass-name" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="passDescription" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl><Input {...field} placeholder="VIP Member Pass" data-testid="input-pass-description" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="logoText" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Logo Text</FormLabel>
                              <FormControl><Input {...field} placeholder="VIP GOLD" data-testid="input-logo-text" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="passTypeIdentifier" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Pass Type ID</FormLabel>
                                <FormControl><Input {...field} placeholder="pass.com.company.vip" data-testid="input-pass-type-id" /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="teamIdentifier" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Team ID</FormLabel>
                                <FormControl><Input {...field} placeholder="ABCD1234" data-testid="input-team-id" /></FormControl>
                              </FormItem>
                            )} />
                          </div>
                        </TabsContent>

                        <TabsContent value="colors" className="space-y-4 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField control={form.control} name="backgroundColor" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Background</FormLabel>
                                <FormControl>
                                  <div className="flex gap-2">
                                    <Input type="color" {...field} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-background-color" />
                                    <Input value={field.value} onChange={field.onChange} className="flex-1" />
                                  </div>
                                </FormControl>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="foregroundColor" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Text</FormLabel>
                                <FormControl>
                                  <div className="flex gap-2">
                                    <Input type="color" {...field} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-foreground-color" />
                                    <Input value={field.value} onChange={field.onChange} className="flex-1" />
                                  </div>
                                </FormControl>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="labelColor" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Labels</FormLabel>
                                <FormControl>
                                  <div className="flex gap-2">
                                    <Input type="color" {...field} className="w-12 h-10 p-1 cursor-pointer" data-testid="input-label-color" />
                                    <Input value={field.value} onChange={field.onChange} className="flex-1" />
                                  </div>
                                </FormControl>
                              </FormItem>
                            )} />
                          </div>
                        </TabsContent>

                        <TabsContent value="barcode" className="space-y-4 pt-4">
                          <FormField control={form.control} name="barcodeFormat" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Barcode Format</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger data-testid="select-barcode-format"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="PKBarcodeFormatQR">QR Code</SelectItem>
                                  <SelectItem value="PKBarcodeFormatPDF417">PDF417</SelectItem>
                                  <SelectItem value="PKBarcodeFormatAztec">Aztec</SelectItem>
                                  <SelectItem value="PKBarcodeFormatCode128">Code 128</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="barcodeMessage" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Barcode Content</FormLabel>
                              <FormControl><Input {...field} placeholder="{{serialNumber}}" data-testid="input-barcode-message" /></FormControl>
                              <FormDescription>Use template variables like {"{{serialNumber}}"}</FormDescription>
                            </FormItem>
                          )} />
                        </TabsContent>

                        <TabsContent value="fields" className="space-y-6 pt-4">
                          <FieldArraySection title="Primary Fields" name="primaryFields" fields={primaryFieldsArray.fields as PassField[]} append={primaryFieldsArray.append} remove={primaryFieldsArray.remove} form={form} />
                          <Separator />
                          <FieldArraySection title="Auxiliary Fields" name="auxiliaryFields" fields={auxiliaryFieldsArray.fields as PassField[]} append={auxiliaryFieldsArray.append} remove={auxiliaryFieldsArray.remove} form={form} />
                          <Separator />
                          <FieldArraySection title="Back Fields" name="backFields" fields={backFieldsArray.fields as PassField[]} append={backFieldsArray.append} remove={backFieldsArray.remove} form={form} />
                        </TabsContent>
                      </Tabs>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Live Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <PassPreview design={watchedValues} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Template Variables</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="space-y-1.5 text-xs">
                      {templateVariables.map(v => (
                        <div key={v.key} className="flex justify-between">
                          <code className="text-primary">{`{{${v.key}}}`}</code>
                          <span className="text-muted-foreground">{v.example}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="management" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Passes</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalPasses || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Active</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats?.activePasses || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Devices</CardTitle>
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.registeredDevices || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Push Enabled</CardTitle>
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats?.pushSubscriptions || 0}</div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="passes" className="space-y-4">
              <TabsList>
                <TabsTrigger value="passes">Issued Passes</TabsTrigger>
                <TabsTrigger value="history">Notifications</TabsTrigger>
              </TabsList>

              <TabsContent value="passes">
                <Card>
                  <CardContent className="pt-6">
                    {instancesLoading ? (
                      <LoadingSpinner fullScreen={false} />
                    ) : instances && instances.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Serial</TableHead>
                              <TableHead>Recipient</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Push Enabled</TableHead>
                              <TableHead>Notifications</TableHead>
                              <TableHead>Created</TableHead>
                              <TableHead>Public Link</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {instances.map((instance) => (
                              <TableRow key={instance.id}>
                                <TableCell className="font-mono text-sm">{instance.serialNumber}</TableCell>
                                <TableCell>{instance.recipientName || "-"}</TableCell>
                                <TableCell>{instance.recipientEmail || "-"}</TableCell>
                                <TableCell>
                                  <Badge variant={instance.status === "active" ? "default" : "destructive"} className={instance.status === "active" ? "bg-green-500" : ""}>
                                    {instance.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {instance.pushSubscriptionCount > 0 ? (
                                    <div className="text-green-600">
                                      <span className="font-medium">Yes</span>
                                      {instance.pushEnabledAt && (
                                        <div className="text-xs text-muted-foreground">
                                          {format(new Date(instance.pushEnabledAt), "MMM d, yyyy")}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">No</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className={instance.notificationCount > 0 ? "font-medium" : "text-muted-foreground"}>
                                    {instance.notificationCount}
                                  </span>
                                </TableCell>
                                <TableCell>{format(new Date(instance.createdAt), "MMM d, yyyy")}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          onClick={() => {
                                            const publicUrl = `${window.location.origin}/p/${instance.authenticationToken}`;
                                            navigator.clipboard.writeText(publicUrl);
                                            toast({ title: "Link Copied", description: "Public link copied to clipboard" });
                                          }}
                                          disabled={instance.status !== "active"}
                                          data-testid={`button-copy-link-${instance.id}`}
                                        >
                                          <Copy className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Copy public link</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          onClick={() => window.open(`/p/${instance.authenticationToken}`, "_blank")}
                                          disabled={instance.status !== "active"}
                                          data-testid={`button-open-link-${instance.id}`}
                                        >
                                          <Link className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Open public page</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="outline" size="sm" onClick={() => window.open(`/api/vip-pass/instances/${instance.id}/download`, "_blank")}>
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Download .pkpass</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="outline" size="sm" onClick={() => { setSelectedPassId(instance.id); setPushTarget("single"); setPushDialogOpen(true); }} disabled={instance.status !== "active"}>
                                          <Bell className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Send notification</TooltipContent>
                                    </Tooltip>
                                    {instance.status === "active" && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="outline" size="sm" onClick={() => revokePassMutation.mutate(instance.id)} className="text-orange-600">
                                            <RefreshCw className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Revoke pass</TooltipContent>
                                      </Tooltip>
                                    )}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="outline" size="sm" onClick={() => deletePassMutation.mutate(instance.id)} className="text-red-600">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Delete permanently</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No passes issued yet</p>
                        <Button variant="outline" className="mt-4" onClick={() => setIssueDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" /> Issue First Pass
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <Card>
                  <CardContent className="pt-6">
                    {historyLoading ? (
                      <LoadingSpinner fullScreen={false} />
                    ) : notificationHistory && notificationHistory.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Target</TableHead>
                              <TableHead>Message</TableHead>
                              <TableHead>Sent</TableHead>
                              <TableHead>Success</TableHead>
                              <TableHead>Failed</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {notificationHistory.map((n) => (
                              <TableRow key={n.id}>
                                <TableCell>{format(new Date(n.createdAt), "MMM d, HH:mm")}</TableCell>
                                <TableCell><Badge variant="outline">{n.targetType === "single" ? "Single" : "All"}</Badge></TableCell>
                                <TableCell className="max-w-xs truncate">{n.message || "(refresh)"}</TableCell>
                                <TableCell>{n.sentCount}</TableCell>
                                <TableCell className="text-green-600">{n.successCount}</TableCell>
                                <TableCell className="text-red-600">{n.failedCount}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No notifications sent yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Issue New VIP Pass</DialogTitle>
              <DialogDescription>Create a new VIP pass for a member.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Recipient Name</Label>
                <Input placeholder="John Doe" value={newPass.recipientName} onChange={(e) => setNewPass({ ...newPass, recipientName: e.target.value })} data-testid="input-recipient-name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="john@example.com" value={newPass.recipientEmail} onChange={(e) => setNewPass({ ...newPass, recipientEmail: e.target.value })} data-testid="input-recipient-email" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input type="tel" placeholder="+1 (555) 000-0000" value={newPass.recipientPhone} onChange={(e) => setNewPass({ ...newPass, recipientPhone: e.target.value })} data-testid="input-recipient-phone" />
              </div>
              <div className="space-y-2">
                <Label>Member ID</Label>
                <Input placeholder="MEM-12345" value={newPass.memberId} onChange={(e) => setNewPass({ ...newPass, memberId: e.target.value })} data-testid="input-member-id" />
              </div>
              <div className="space-y-2">
                <Label>Tier Level</Label>
                <Select value={newPass.tierLevel} onValueChange={(v) => setNewPass({ ...newPass, tierLevel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gold">Gold</SelectItem>
                    <SelectItem value="Platinum">Platinum</SelectItem>
                    <SelectItem value="Diamond">Diamond</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => createPassMutation.mutate(newPass)} disabled={createPassMutation.isPending}>
                {createPassMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={pushDialogOpen} onOpenChange={setPushDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send Push Notification</DialogTitle>
              <DialogDescription>Send a push notification to trigger pass refresh.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Target</Label>
                <Select value={pushTarget} onValueChange={(v: "single" | "all") => { setPushTarget(v); if (v === "all") setSelectedPassId(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Active Passes</SelectItem>
                    <SelectItem value="single">Single Pass</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {pushTarget === "single" && (
                <div className="space-y-2">
                  <Label>Select Pass</Label>
                  <Select value={selectedPassId || ""} onValueChange={setSelectedPassId}>
                    <SelectTrigger><SelectValue placeholder="Select pass" /></SelectTrigger>
                    <SelectContent>
                      {instances?.filter(i => i.status === "active").map(i => (
                        <SelectItem key={i.id} value={i.id}>{i.recipientName || i.serialNumber}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Message (optional)</Label>
                <Input placeholder="Update available" value={pushMessage} onChange={(e) => setPushMessage(e.target.value)} data-testid="input-push-message" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPushDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => sendPushMutation.mutate({ passInstanceId: pushTarget === "single" ? selectedPassId || undefined : undefined, message: pushMessage })} disabled={sendPushMutation.isPending}>
                {sendPushMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-2" /> Send
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
