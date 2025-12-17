import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Loader2, Plus, Trash2, Save, Smartphone, QrCode, CreditCard, 
  Palette, Settings2, BarChart3, Eye, Download, Bell, Users, RefreshCw, Send, Copy, Link,
  Shield, Upload, CheckCircle, XCircle, Key, AlertCircle
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
  passStyle: z.string().default("storeCard"),
  barcodeFormat: z.string(),
  barcodeMessage: z.string(),
  headerFields: z.array(passFieldSchema),
  primaryFields: z.array(passFieldSchema),
  secondaryFields: z.array(passFieldSchema),
  auxiliaryFields: z.array(passFieldSchema),
  backFields: z.array(passFieldSchema),
  iconBase64: z.string().optional(),
  logoBase64: z.string().optional(),
  stripBase64: z.string().optional(),
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
  platformCounts?: {
    android: number;
    ios: number;
    desktop: number;
  };
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
  universalToken: string | null;
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

interface CertificateStatus {
  configured: boolean;
  hasSignerCert: boolean;
  hasSignerKey: boolean;
  certInfo: {
    uploadedAt: string;
    expiresAt: string | null;
    subject: string | null;
  } | null;
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
  { key: "memberId", description: "Member ID", example: "MIM-6546" },
  { key: "recipientName", description: "Recipient's name", example: "John Doe" },
  { key: "tierLevel", description: "Plan/Tier level", example: "Gold PPO" },
  { key: "companyName", description: "Insurance company", example: "Curbe Insurance" },
  { key: "memberSince", description: "Member since date", example: "Jan 2024" },
];

const passStyleOptions = [
  { value: "storeCard", label: "Store Card (Insurance, Membership)" },
  { value: "generic", label: "Generic Pass" },
  { value: "eventTicket", label: "Event Ticket" },
  { value: "coupon", label: "Coupon" },
];

const replaceTemplateVars = (value: string): string => {
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const variable = templateVariables.find(v => v.key === key);
    return variable?.example || `{{${key}}}`;
  });
};

function PassPreview({ design, showBack = false }: { design: VipPassDesignFormData; showBack?: boolean }) {
  const bgColor = design.backgroundColor?.startsWith('#') ? design.backgroundColor : (design.backgroundColor || '#1a2744');
  const fgColor = design.foregroundColor?.startsWith('#') ? design.foregroundColor : (design.foregroundColor || '#ffffff');
  const lblColor = design.labelColor?.startsWith('#') ? design.labelColor : (design.labelColor || '#e87722');

  const headerField = design.headerFields?.[0];
  const primaryField = design.primaryFields?.[0];
  const secondaryFields = design.secondaryFields || [];
  const auxiliaryFields = design.auxiliaryFields || [];

  if (showBack) {
    return (
      <div className="flex flex-col items-center">
        <div 
          className="w-[300px] min-h-[420px] rounded-2xl overflow-hidden p-5"
          style={{ backgroundColor: bgColor, color: fgColor, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
          data-testid="pass-preview-back"
        >
          <div className="text-sm font-semibold mb-4 pb-2 border-b border-white/20">
            Pass Information
          </div>
          <div className="space-y-3">
            {(design.backFields?.length > 0 ? design.backFields : [
              { key: "portal", label: "Member Portal", value: "https://member.insurance.com" },
              { key: "support", label: "Customer Support", value: "1-800-555-0100" },
              { key: "claims", label: "Claims", value: "claims@insurance.com" },
            ]).map((field, i) => (
              <div key={i} className="py-2 border-b border-white/10">
                <div className="text-xs font-medium mb-1" style={{ color: lblColor }}>{field.label}</div>
                <div className="text-sm" style={{ color: field.value.startsWith('http') || field.value.includes('@') ? '#4da6ff' : fgColor }}>
                  {field.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div 
        className="w-[300px] rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: bgColor, color: fgColor, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
        data-testid="pass-preview"
      >
        {/* Header Row: Logo + Header Field */}
        <div className="p-4 flex justify-between items-start">
          <div className="flex-shrink-0">
            {design.logoBase64 ? (
              <img 
                src={design.logoBase64} 
                alt="Logo" 
                className="max-h-10 object-contain" 
                style={{ maxWidth: '100px' }}
              />
            ) : (
              <div className="text-lg font-bold" style={{ color: fgColor }}>
                {design.logoText || "LOGO"}
              </div>
            )}
          </div>
          {headerField && (
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wide" style={{ color: lblColor }}>
                {headerField.label}
              </div>
              <div className="text-base font-bold">
                {replaceTemplateVars(headerField.value)}
              </div>
            </div>
          )}
        </div>

        {/* Primary Field with Thumbnail */}
        <div className="px-4 pb-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              {primaryField ? (
                <>
                  <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: lblColor }}>
                    {primaryField.label}
                  </div>
                  <div className="text-2xl font-bold leading-tight">
                    {replaceTemplateVars(primaryField.value)}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: lblColor }}>
                    POLICYHOLDER
                  </div>
                  <div className="text-2xl font-bold leading-tight">
                    John Doe
                  </div>
                </>
              )}
            </div>
            {design.stripBase64 && (
              <div className="flex-shrink-0 ml-3">
                <img 
                  src={design.stripBase64} 
                  alt="Thumbnail" 
                  className="h-16 w-auto object-contain rounded"
                />
              </div>
            )}
          </div>
        </div>

        {/* Secondary Fields */}
        {secondaryFields.length > 0 && (
          <div className="px-4 pb-3 space-y-2">
            {secondaryFields.map((field, i) => (
              <div key={i}>
                <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: lblColor }}>
                  {field.label}
                </div>
                <div className="text-sm font-medium">
                  {replaceTemplateVars(field.value)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Auxiliary Fields */}
        {auxiliaryFields.length > 0 && (
          <div className="px-4 pb-3">
            <div className="text-[9px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: lblColor }}>
              {auxiliaryFields[0]?.label || "COVERAGE"}
            </div>
            <div className="text-sm">
              {auxiliaryFields.map(f => replaceTemplateVars(f.value)).join(", ")}
            </div>
          </div>
        )}

        {/* QR Code Section */}
        <div className="mt-auto p-4 flex flex-col items-center bg-white rounded-t-xl">
          <div className="w-24 h-24 flex items-center justify-center mb-2" data-testid="preview-barcode">
            <QrCode className="h-20 w-20 text-gray-800" />
          </div>
          <div className="text-[10px] text-gray-600 font-medium">
            {design.passDescription || "Scan for verification"}
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageUploadSection({ 
  label, description, size, fieldName, value, onChange 
}: { 
  label: string;
  description: string;
  size: string;
  fieldName: string;
  value?: string;
  onChange: (base64: string) => void;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        onChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="border rounded-lg p-4 text-center" data-testid={`upload-${fieldName}`}>
      {value ? (
        <div className="space-y-2">
          <img src={value} alt={label} className="w-16 h-16 mx-auto object-contain rounded" />
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => onChange("")}
            data-testid={`button-remove-${fieldName}`}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Remove
          </Button>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 mx-auto mb-2 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
            <Upload className="h-5 w-5" />
          </div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground mb-2">{description}<br/>{size}</div>
          <label className="cursor-pointer">
            <input 
              type="file" 
              accept="image/png,image/jpeg" 
              className="hidden" 
              onChange={handleFileChange}
              data-testid={`input-${fieldName}`}
            />
            <Button type="button" variant="outline" size="sm" asChild>
              <span><Upload className="h-3 w-3 mr-1" /> Upload</span>
            </Button>
          </label>
        </>
      )}
    </div>
  );
}

function FieldArraySection({ 
  title, name, fields, append, remove, form 
}: { 
  title: string;
  name: "headerFields" | "primaryFields" | "secondaryFields" | "auxiliaryFields" | "backFields";
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
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front");
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
  const [pushTarget, setPushTarget] = useState<"single" | "all">("all");
  const [pushForm, setPushForm] = useState({
    title: "",
    body: "",
    url: "",
    icon: "",
    badge: "",
    image: "",
    tag: "",
    renotify: false,
    requireInteraction: false,
    silent: false,
    notificationType: "INFO" as "TRANSACTIONAL" | "REMINDER" | "ACTION_REQUIRED" | "INFO",
    actions: [] as { action: string; title: string; icon?: string }[]
  });
  const [newPass, setNewPass] = useState({ recipientName: "", recipientEmail: "", recipientPhone: "", memberId: "", tierLevel: "Gold" });
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");

  const { data: existingDesign, isLoading: designLoading } = useQuery<VipPassDesignFormData>({ queryKey: ["/api/vip-pass/design"] });
  const { data: certStatus, isLoading: certLoading } = useQuery<CertificateStatus>({ queryKey: ["/api/vip-pass/certificate-status"] });
  const { data: stats, isLoading: statsLoading } = useQuery<VipPassStats>({ queryKey: ["/api/vip-pass/stats"] });
  const { data: instances, isLoading: instancesLoading } = useQuery<VipPassInstance[]>({ queryKey: ["/api/vip-pass/instances"] });
  const { data: notificationHistory, isLoading: historyLoading } = useQuery<NotificationHistory[]>({ queryKey: ["/api/vip-pass/notifications/history"] });

  const form = useForm<VipPassDesignFormData>({
    resolver: zodResolver(vipPassDesignSchema),
    defaultValues: {
      passName: "Insurance Card", 
      passDescription: "Scan for verification", 
      logoText: "INSURANCE",
      backgroundColor: "#1a2744", 
      foregroundColor: "#ffffff", 
      labelColor: "#e87722",
      passTypeIdentifier: "", 
      teamIdentifier: "", 
      passStyle: "storeCard",
      barcodeFormat: "PKBarcodeFormatQR", 
      barcodeMessage: "{{serialNumber}}",
      headerFields: [{ key: "policyNumber", label: "POLICY", value: "{{memberId}}" }],
      primaryFields: [{ key: "name", label: "POLICYHOLDER", value: "{{recipientName}}" }],
      secondaryFields: [
        { key: "plan", label: "PLAN TYPE", value: "{{tierLevel}}" },
        { key: "company", label: "INSURER", value: "{{companyName}}" }
      ],
      auxiliaryFields: [
        { key: "coverage", label: "COVERAGE", value: "Auto, Liability, Comprehensive" }
      ],
      backFields: [
        { key: "portal", label: "Member Portal", value: "https://member.curbe.io" },
        { key: "claims", label: "Claims", value: "claims@curbe.io" },
        { key: "support", label: "Customer Support", value: "1-800-CURBE-00" },
        { key: "terms", label: "Terms & Conditions", value: "https://insurance.curbe.io/terms" }
      ],
      iconBase64: "",
      logoBase64: "",
      stripBase64: "",
    },
  });

  const headerFieldsArray = useFieldArray({ control: form.control, name: "headerFields" });
  const primaryFieldsArray = useFieldArray({ control: form.control, name: "primaryFields" });
  const secondaryFieldsArray = useFieldArray({ control: form.control, name: "secondaryFields" });
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

  const uploadCertMutation = useMutation({
    mutationFn: async ({ file, password }: { file: File; password: string }) => {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      return await apiRequest("POST", "/api/vip-pass/certificate", { p12Base64: base64, password });
    },
    onSuccess: () => {
      toast({ title: "Certificate Uploaded", description: "Your Apple certificate has been configured successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/certificate-status"] });
      setCertFile(null);
      setCertPassword("");
    },
    onError: (error: Error) => { toast({ title: "Upload Failed", description: error.message, variant: "destructive" }); },
  });

  const deleteCertMutation = useMutation({
    mutationFn: async () => await apiRequest("DELETE", "/api/vip-pass/certificate"),
    onSuccess: () => {
      toast({ title: "Certificate Removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/certificate-status"] });
    },
    onError: (error: Error) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const resetPushForm = () => {
    setPushForm({
      title: "",
      body: "",
      url: "",
      icon: "",
      badge: "",
      image: "",
      tag: "",
      renotify: false,
      requireInteraction: false,
      silent: false,
      notificationType: "INFO",
      actions: []
    });
  };

  const sendPushMutation = useMutation({
    mutationFn: async (payload: {
      passInstanceId?: string;
      title: string;
      body: string;
      url?: string;
      icon?: string;
      badge?: string;
      image?: string;
      tag?: string;
      renotify?: boolean;
      requireInteraction?: boolean;
      silent?: boolean;
      notificationType?: string;
      actions?: { action: string; title: string; icon?: string }[];
    }) => {
      return await apiRequest("POST", "/api/vip-pass/notifications/send", payload);
    },
    onSuccess: (data: any) => {
      toast({ title: "Push Sent", description: `Success: ${data.successCount || 0}, Failed: ${data.failedCount || 0}` });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/notifications/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/instances"] });
      setPushDialogOpen(false);
      resetPushForm();
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
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="management" data-testid="tab-management">
              <CreditCard className="h-4 w-4 mr-2" /> Management
            </TabsTrigger>
            <TabsTrigger value="designer" data-testid="tab-designer">
              <Palette className="h-4 w-4 mr-2" /> Designer
            </TabsTrigger>
            <TabsTrigger value="certificates" data-testid="tab-certificates">
              <Shield className="h-4 w-4 mr-2" /> Certificates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="designer" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2"><Settings2 className="h-5 w-5" /> Pass Configuration</CardTitle>
                  <CardDescription>Design your Insurance Card for Apple Wallet and Google Wallet</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form className="space-y-6">
                      <Tabs value={designConfigTab} onValueChange={setDesignConfigTab}>
                        <TabsList className="grid w-full grid-cols-5" data-testid="config-tabs">
                          <TabsTrigger value="basic">Basic</TabsTrigger>
                          <TabsTrigger value="images">Images</TabsTrigger>
                          <TabsTrigger value="colors">Colors</TabsTrigger>
                          <TabsTrigger value="barcode">Barcode</TabsTrigger>
                          <TabsTrigger value="fields">Fields</TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="space-y-4 pt-4">
                          <FormField control={form.control} name="passStyle" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pass Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger data-testid="select-pass-style"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {passStyleOptions.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>Store Card is recommended for insurance/membership cards</FormDescription>
                            </FormItem>
                          )} />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="passName" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Pass Name</FormLabel>
                                <FormControl><Input {...field} placeholder="Insurance Card" data-testid="input-pass-name" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="logoText" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Header Text</FormLabel>
                                <FormControl><Input {...field} placeholder="INSURANCE CARD" data-testid="input-logo-text" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                          <FormField control={form.control} name="passDescription" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl><Input {...field} placeholder="Member Insurance Card" data-testid="input-pass-description" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="passTypeIdentifier" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Pass Type ID</FormLabel>
                                <FormControl><Input {...field} placeholder="pass.com.company.insurance" data-testid="input-pass-type-id" /></FormControl>
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

                        <TabsContent value="images" className="space-y-4 pt-4">
                          <div className="text-sm text-muted-foreground mb-4">
                            Upload your company branding. Image resolutions differ between Apple and Google Wallet.
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <ImageUploadSection
                              label="Icon"
                              description="Lockscreen icon"
                              size="87 x 87 pixels"
                              fieldName="iconBase64"
                              value={watchedValues.iconBase64}
                              onChange={(v) => form.setValue("iconBase64", v)}
                            />
                            <ImageUploadSection
                              label="Logo"
                              description="Header logo"
                              size="150 x 150 pixels"
                              fieldName="logoBase64"
                              value={watchedValues.logoBase64}
                              onChange={(v) => form.setValue("logoBase64", v)}
                            />
                            <ImageUploadSection
                              label="Strip Image"
                              description="Banner image"
                              size="1125 x 432 pixels"
                              fieldName="stripBase64"
                              value={watchedValues.stripBase64}
                              onChange={(v) => form.setValue("stripBase64", v)}
                            />
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

                        <TabsContent value="fields" className="space-y-4 pt-4">
                          <div className="text-sm text-muted-foreground mb-2">
                            Configure the fields displayed on your pass. Use template variables like {"{{memberId}}"} for dynamic content.
                          </div>
                          <FieldArraySection title="Header Fields (Top Right)" name="headerFields" fields={headerFieldsArray.fields as PassField[]} append={headerFieldsArray.append} remove={headerFieldsArray.remove} form={form} />
                          <Separator />
                          <FieldArraySection title="Primary Fields (Name, Main Info)" name="primaryFields" fields={primaryFieldsArray.fields as PassField[]} append={primaryFieldsArray.append} remove={primaryFieldsArray.remove} form={form} />
                          <Separator />
                          <FieldArraySection title="Secondary Fields (Details)" name="secondaryFields" fields={secondaryFieldsArray.fields as PassField[]} append={secondaryFieldsArray.append} remove={secondaryFieldsArray.remove} form={form} />
                          <Separator />
                          <FieldArraySection title="Auxiliary Fields (Coverage)" name="auxiliaryFields" fields={auxiliaryFieldsArray.fields as PassField[]} append={auxiliaryFieldsArray.append} remove={auxiliaryFieldsArray.remove} form={form} />
                          <Separator />
                          <FieldArraySection title="Back Fields (Info when tapping i)" name="backFields" fields={backFieldsArray.fields as PassField[]} append={backFieldsArray.append} remove={backFieldsArray.remove} form={form} />
                        </TabsContent>
                      </Tabs>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Live Preview</CardTitle>
                      <div className="flex rounded-lg border overflow-hidden">
                        <button
                          type="button"
                          className={`px-3 py-1 text-xs font-medium transition-colors ${previewSide === "front" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                          onClick={() => setPreviewSide("front")}
                          data-testid="button-preview-front"
                        >
                          Front
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1 text-xs font-medium transition-colors ${previewSide === "back" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                          onClick={() => setPreviewSide("back")}
                          data-testid="button-preview-back"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <PassPreview design={watchedValues} showBack={previewSide === "back"} />
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
                  <CardTitle className="text-sm font-medium">Passes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalPasses || 0}</div>
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="text-green-600">Active: {stats?.activePasses || 0}</span>
                    <span className="text-red-600">Revoked: {stats?.revokedPasses || 0}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-devices">
                    {(stats?.platformCounts?.android || 0) + (stats?.platformCounts?.ios || 0)}
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Android: {stats?.platformCounts?.android || 0}</span>
                    <span>iOS: {stats?.platformCounts?.ios || 0}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Notifications</CardTitle>
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600" data-testid="text-notifications-sent">
                    {stats?.notificationStats?.sent || 0}
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="text-green-600" data-testid="text-notifications-delivered">
                      Delivered: {stats?.notificationStats?.delivered || 0}
                    </span>
                    <span className="text-red-600" data-testid="text-notifications-failed">
                      Failed: {stats?.notificationStats?.failed || 0}
                    </span>
                  </div>
                  {(stats?.notificationStats?.clicked || 0) > 0 && (
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span data-testid="text-notifications-clicked">
                        Clicked: {stats?.notificationStats?.clicked || 0}
                      </span>
                    </div>
                  )}
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
                                            const publicUrl = `${window.location.origin}/p/${instance.universalToken}`;
                                            navigator.clipboard.writeText(publicUrl);
                                            toast({ title: "Link Copied", description: "Public link copied to clipboard" });
                                          }}
                                          disabled={instance.status !== "active" || !instance.universalToken}
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
                                          onClick={() => window.open(`/p/${instance.universalToken}`, "_blank")}
                                          disabled={instance.status !== "active" || !instance.universalToken}
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

          <TabsContent value="certificates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Apple Wallet Certificates
                </CardTitle>
                <CardDescription>
                  Upload your Apple Developer .p12 certificate to enable signed VIP Pass generation.
                  Certificates are stored securely in the database and used only in memory.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {certLoading ? (
                  <LoadingSpinner fullScreen={false} />
                ) : certStatus?.configured ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div className="flex-1">
                        <p className="font-medium text-green-800 dark:text-green-200">Certificate Configured</p>
                        {certStatus.certInfo?.subject && (
                          <p className="text-sm text-green-600 dark:text-green-400">{certStatus.certInfo.subject}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-green-600 dark:text-green-400 mt-1">
                          <span>Uploaded: {certStatus.certInfo?.uploadedAt ? format(new Date(certStatus.certInfo.uploadedAt), "MMM d, yyyy") : "recently"}</span>
                          {certStatus.certInfo?.expiresAt && (
                            <span className={new Date(certStatus.certInfo.expiresAt) < new Date() ? "text-red-600 font-medium" : ""}>
                              Expires: {format(new Date(certStatus.certInfo.expiresAt), "MMM d, yyyy")}
                              {new Date(certStatus.certInfo.expiresAt) < new Date() && " (EXPIRED)"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        {certStatus.hasSignerCert ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                        <span>Signer Certificate</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {certStatus.hasSignerKey ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                        <span>Private Key</span>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex gap-3">
                      <Button
                        variant="destructive"
                        onClick={() => deleteCertMutation.mutate()}
                        disabled={deleteCertMutation.isPending}
                        data-testid="button-delete-certificate"
                      >
                        {deleteCertMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                        Remove Certificate
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">Certificate Required</p>
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                          Upload your .p12 certificate from Apple Developer Portal to generate signed passes.
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="cert-file">Certificate File (.p12)</Label>
                        <Input
                          id="cert-file"
                          type="file"
                          accept=".p12,.pfx"
                          onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                          data-testid="input-certificate-file"
                        />
                        {certFile && (
                          <p className="text-sm text-muted-foreground">
                            Selected: {certFile.name} ({(certFile.size / 1024).toFixed(1)} KB)
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="cert-password">Certificate Password</Label>
                        <Input
                          id="cert-password"
                          type="password"
                          placeholder="Enter the .p12 password"
                          value={certPassword}
                          onChange={(e) => setCertPassword(e.target.value)}
                          data-testid="input-certificate-password"
                        />
                      </div>
                      
                      <Button
                        onClick={() => certFile && uploadCertMutation.mutate({ file: certFile, password: certPassword })}
                        disabled={!certFile || !certPassword || uploadCertMutation.isPending}
                        data-testid="button-upload-certificate"
                      >
                        {uploadCertMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload Certificate
                      </Button>
                    </div>
                    
                    <Separator />
                    
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p className="font-medium">How to get your certificate:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Go to Apple Developer Portal → Certificates, IDs & Profiles</li>
                        <li>Create a Pass Type ID under Identifiers</li>
                        <li>Create a Pass Type ID Certificate under Certificates</li>
                        <li>Download and export as .p12 from Keychain Access</li>
                      </ol>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
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

        <Dialog open={pushDialogOpen} onOpenChange={(open) => { setPushDialogOpen(open); if (!open) resetPushForm(); }}>
          <DialogContent className="sm:max-w-5xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Rich Push Notification Designer</DialogTitle>
              <DialogDescription>Send customized push notifications to Android devices</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <ScrollArea className="max-h-[calc(90vh-180px)] pr-4 lg:col-span-2">
                <div className="space-y-6 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Target</Label>
                      <Select value={pushTarget} onValueChange={(v: "single" | "all") => { setPushTarget(v); if (v === "all") setSelectedPassId(null); }}>
                        <SelectTrigger data-testid="select-push-target"><SelectValue /></SelectTrigger>
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
                          <SelectTrigger data-testid="select-pass-instance"><SelectValue placeholder="Select pass" /></SelectTrigger>
                          <SelectContent>
                            {instances?.filter(i => i.status === "active").map(i => (
                              <SelectItem key={i.id} value={i.id}>{i.recipientName || i.serialNumber}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Content</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Title <span className="text-muted-foreground text-xs">(required)</span></Label>
                        <Input 
                          placeholder="VIP Pass Update" 
                          value={pushForm.title} 
                          onChange={(e) => setPushForm({ ...pushForm, title: e.target.value })} 
                          data-testid="input-push-title" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Notification Type</Label>
                        <Select value={pushForm.notificationType} onValueChange={(v: "TRANSACTIONAL" | "REMINDER" | "ACTION_REQUIRED" | "INFO") => setPushForm({ ...pushForm, notificationType: v })}>
                          <SelectTrigger data-testid="select-notification-type"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INFO">Info</SelectItem>
                            <SelectItem value="TRANSACTIONAL">Transactional</SelectItem>
                            <SelectItem value="REMINDER">Reminder</SelectItem>
                            <SelectItem value="ACTION_REQUIRED">Action Required</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Body <span className="text-muted-foreground text-xs">(required, 40-120 chars ideal)</span></Label>
                      <Textarea 
                        placeholder="Your VIP benefits have been updated. Tap to view details." 
                        value={pushForm.body} 
                        onChange={(e) => setPushForm({ ...pushForm, body: e.target.value })} 
                        rows={2}
                        data-testid="input-push-body" 
                      />
                      <p className="text-xs text-muted-foreground">{pushForm.body.length} characters</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Click URL <span className="text-muted-foreground text-xs">(destination when clicked)</span></Label>
                      <Input 
                        placeholder="https://example.com/vip" 
                        value={pushForm.url} 
                        onChange={(e) => setPushForm({ ...pushForm, url: e.target.value })} 
                        data-testid="input-push-url" 
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Media</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Icon URL <span className="text-muted-foreground text-xs">(192x192 PNG)</span></Label>
                        <Input 
                          placeholder="https://..." 
                          value={pushForm.icon} 
                          onChange={(e) => setPushForm({ ...pushForm, icon: e.target.value })} 
                          data-testid="input-push-icon" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Badge URL <span className="text-muted-foreground text-xs">(72x72 PNG)</span></Label>
                        <Input 
                          placeholder="https://..." 
                          value={pushForm.badge} 
                          onChange={(e) => setPushForm({ ...pushForm, badge: e.target.value })} 
                          data-testid="input-push-badge" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Large Image URL <span className="text-muted-foreground text-xs">(1200x600, optional)</span></Label>
                      <Input 
                        placeholder="https://..." 
                        value={pushForm.image} 
                        onChange={(e) => setPushForm({ ...pushForm, image: e.target.value })} 
                        data-testid="input-push-image" 
                      />
                    </div>
                  </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Grouping</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tag <span className="text-muted-foreground text-xs">(group notifications)</span></Label>
                      <Select value={pushForm.tag || "none"} onValueChange={(v) => setPushForm({ ...pushForm, tag: v === "none" ? "" : v })}>
                        <SelectTrigger data-testid="select-push-tag"><SelectValue placeholder="No tag" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No tag</SelectItem>
                          <SelectItem value="billing">Billing</SelectItem>
                          <SelectItem value="renewal">Renewal</SelectItem>
                          <SelectItem value="documents">Documents</SelectItem>
                          <SelectItem value="appointment">Appointment</SelectItem>
                          <SelectItem value="update">Update</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 flex items-end">
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={pushForm.renotify} 
                          onCheckedChange={(checked) => setPushForm({ ...pushForm, renotify: checked })} 
                          data-testid="switch-renotify"
                        />
                        <Label className="cursor-pointer">Re-notify <span className="text-xs text-muted-foreground">(alert if same tag)</span></Label>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Behavior</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={pushForm.requireInteraction} 
                        onCheckedChange={(checked) => setPushForm({ ...pushForm, requireInteraction: checked })} 
                        data-testid="switch-require-interaction"
                      />
                      <Label className="cursor-pointer text-sm">Require Interaction</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={pushForm.silent} 
                        onCheckedChange={(checked) => setPushForm({ ...pushForm, silent: checked })} 
                        data-testid="switch-silent"
                      />
                      <Label className="cursor-pointer text-sm">Silent</Label>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Action Buttons <span className="text-muted-foreground text-xs">(max 2-3)</span></h4>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        if (pushForm.actions.length < 3) {
                          setPushForm({ ...pushForm, actions: [...pushForm.actions, { action: "", title: "" }] });
                        }
                      }}
                      disabled={pushForm.actions.length >= 3}
                      data-testid="button-add-action"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Action
                    </Button>
                  </div>
                  {pushForm.actions.map((action, index) => (
                    <Card key={index} className="p-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Action ID</Label>
                          <Input 
                            placeholder="view_details" 
                            value={action.action} 
                            onChange={(e) => {
                              const newActions = [...pushForm.actions];
                              newActions[index].action = e.target.value;
                              setPushForm({ ...pushForm, actions: newActions });
                            }} 
                            data-testid={`input-action-id-${index}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Button Title</Label>
                          <Input 
                            placeholder="View Details" 
                            value={action.title} 
                            onChange={(e) => {
                              const newActions = [...pushForm.actions];
                              newActions[index].title = e.target.value;
                              setPushForm({ ...pushForm, actions: newActions });
                            }} 
                            data-testid={`input-action-title-${index}`}
                          />
                        </div>
                        <div className="flex items-end gap-1">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Icon URL</Label>
                            <Input 
                              placeholder="https://..." 
                              value={action.icon || ""} 
                              onChange={(e) => {
                                const newActions = [...pushForm.actions];
                                newActions[index].icon = e.target.value || undefined;
                                setPushForm({ ...pushForm, actions: newActions });
                              }} 
                              data-testid={`input-action-icon-${index}`}
                            />
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive" 
                            onClick={() => {
                              const newActions = pushForm.actions.filter((_, i) => i !== index);
                              setPushForm({ ...pushForm, actions: newActions });
                            }}
                            data-testid={`button-remove-action-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {pushForm.actions.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">Default actions: Open, Dismiss</p>
                  )}
                </div>
              </div>
            </ScrollArea>

              <div className="lg:col-span-1">
                <div className="sticky top-0">
                  <h4 className="text-sm font-medium mb-3">Android Preview</h4>
                  <div className="bg-gray-900 rounded-2xl p-3 shadow-xl" style={{ width: "280px" }}>
                    <div className="bg-gray-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {pushForm.icon ? (
                            <img src={pushForm.icon} alt="Icon" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <Bell className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-gray-400 text-xs mb-0.5">
                            <span>VIP Card</span>
                            <span>·</span>
                            <span>now</span>
                          </div>
                          <p className="text-white text-sm font-medium truncate">{pushForm.title || "VIP Pass Update"}</p>
                          <p className="text-gray-300 text-xs line-clamp-2">{pushForm.body || "Notification body preview..."}</p>
                        </div>
                      </div>
                      {pushForm.image && (
                        <div className="rounded-lg overflow-hidden bg-gray-700 h-24">
                          <img src={pushForm.image} alt="Large" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                      )}
                      {pushForm.actions.length > 0 && (
                        <div className="flex gap-2 pt-1">
                          {pushForm.actions.slice(0, 2).map((action, i) => (
                            <button key={i} className="flex-1 text-xs text-blue-400 font-medium py-1 px-2 bg-gray-700 rounded">
                              {action.title || "Action"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-center mt-2 text-gray-500 text-xs">
                      Expanded notification preview
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 text-center max-w-[280px]">
                    Actual appearance may vary by device and Android version
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => { setPushDialogOpen(false); resetPushForm(); }}>Cancel</Button>
              <Button 
                onClick={() => sendPushMutation.mutate({ 
                  passInstanceId: pushTarget === "single" ? selectedPassId || undefined : undefined, 
                  title: pushForm.title || "VIP Pass Update",
                  body: pushForm.body,
                  url: pushForm.url || undefined,
                  icon: pushForm.icon || undefined,
                  badge: pushForm.badge || undefined,
                  image: pushForm.image || undefined,
                  tag: pushForm.tag || undefined,
                  renotify: pushForm.renotify,
                  requireInteraction: pushForm.requireInteraction,
                  silent: pushForm.silent,
                  notificationType: pushForm.notificationType,
                  actions: pushForm.actions.length > 0 ? pushForm.actions.filter(a => a.action && a.title) : undefined
                })} 
                disabled={sendPushMutation.isPending || !pushForm.body}
                data-testid="button-send-push"
              >
                {sendPushMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-2" /> Send Notification
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
