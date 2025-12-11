import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Plus, Trash2, Save, Smartphone, QrCode, CreditCard, Info, Palette, Settings2, BarChart3, List, Eye } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

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
    <div className="sticky top-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Eye className="h-5 w-5" />
        Pass Preview
      </h3>
      
      {/* Outer glow container */}
      <div className="relative mx-auto w-[340px] h-[480px] flex items-center justify-center">
        {/* Animated holographic border glow */}
        <div 
          className="absolute inset-0 rounded-3xl opacity-75 blur-xl"
          style={{
            background: `linear-gradient(135deg, ${bgColor}90, #00f2fe50, #4facfe50, #00f2fe50, ${bgColor}90)`,
            animation: 'pulse 3s ease-in-out infinite',
          }}
        />
        
        {/* Main card */}
        <div 
          className="relative w-[320px] h-[460px] rounded-3xl overflow-hidden"
          style={{ 
            backgroundColor: bgColor,
            color: fgColor,
            boxShadow: `0 0 40px ${bgColor}80, 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)`,
          }}
          data-testid="pass-preview"
        >
          {/* Holographic shimmer overlay */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              background: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.1) 25%, transparent 50%, rgba(255,255,255,0.15) 75%, transparent 100%)',
              backgroundSize: '400% 400%',
              animation: 'shimmer 8s ease-in-out infinite',
            }}
          />
          
          {/* Tech grid pattern */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(${fgColor}20 1px, transparent 1px),
                linear-gradient(90deg, ${fgColor}20 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
            }}
          />
          
          {/* Scan line effect */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.02]"
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${fgColor}10 2px, ${fgColor}10 4px)`,
            }}
          />
          
          {/* Top gradient accent */}
          <div 
            className="absolute top-0 left-0 right-0 h-1"
            style={{
              background: `linear-gradient(90deg, transparent, ${fgColor}60, transparent)`,
            }}
          />
          
          {/* Header section */}
          <div className="relative p-6 flex justify-between items-start">
            {/* Logo with glow */}
            <div className="flex flex-col gap-1">
              <div 
                className="text-2xl font-black tracking-[0.2em] uppercase"
                style={{ 
                  textShadow: `0 0 20px ${fgColor}40, 0 0 40px ${fgColor}20`,
                  letterSpacing: '0.15em',
                }}
                data-testid="preview-logo-text"
              >
                {design.logoText || "VIP GOLD"}
              </div>
              <div 
                className="text-[9px] uppercase tracking-[0.3em] font-medium opacity-60"
              >
                Exclusive Access
              </div>
            </div>
            
            {/* Futuristic icon badge */}
            <div 
              className="relative w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden"
              style={{ 
                background: `linear-gradient(135deg, ${fgColor}15, ${fgColor}05)`,
                boxShadow: `inset 0 1px 0 ${fgColor}20, 0 0 20px ${fgColor}10`,
              }}
            >
              <div 
                className="absolute inset-0 opacity-50"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${fgColor}20, transparent 60%)`,
                }}
              />
              <CreditCard className="h-7 w-7 relative z-10" style={{ color: fgColor }} />
            </div>
          </div>
          
          {/* Decorative line with nodes */}
          <div className="px-6 pb-4">
            <div className="relative h-[2px] w-full" style={{ backgroundColor: `${fgColor}10` }}>
              <div 
                className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{ backgroundColor: fgColor, boxShadow: `0 0 10px ${fgColor}` }}
              />
              <div 
                className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: `${fgColor}60` }}
              />
              <div 
                className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{ backgroundColor: fgColor, boxShadow: `0 0 10px ${fgColor}` }}
              />
            </div>
          </div>
          
          {/* Primary fields with futuristic styling */}
          <div className="px-6 py-2">
            {design.primaryFields?.length > 0 ? (
              design.primaryFields.map((field, i) => (
                <div key={i} className="mb-4" data-testid={`preview-primary-field-${i}`}>
                  <div 
                    className="text-[10px] uppercase tracking-[0.25em] font-semibold mb-2 flex items-center gap-2"
                    style={{ color: lblColor }}
                  >
                    <span 
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: lblColor }}
                    />
                    {field.label}
                  </div>
                  <div 
                    className="text-3xl font-bold tracking-tight"
                    style={{ 
                      textShadow: `0 0 30px ${fgColor}30`,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                  >
                    {replaceTemplateVars(field.value)}
                  </div>
                </div>
              ))
            ) : (
              <div className="mb-4">
                <div 
                  className="text-[10px] uppercase tracking-[0.25em] font-semibold mb-2 flex items-center gap-2"
                  style={{ color: lblColor }}
                >
                  <span 
                    className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: lblColor }}
                  />
                  Member ID
                </div>
                <div 
                  className="text-3xl font-bold tracking-tight"
                  style={{ textShadow: `0 0 30px ${fgColor}30` }}
                >
                  VIP-ABC123
                </div>
              </div>
            )}
          </div>

          {/* Auxiliary fields in sleek containers */}
          <div className="px-6 py-3 flex gap-4">
            {design.auxiliaryFields?.length > 0 ? (
              design.auxiliaryFields.slice(0, 3).map((field, i) => (
                <div 
                  key={i} 
                  className="flex-1 p-3 rounded-xl"
                  style={{ 
                    background: `linear-gradient(135deg, ${fgColor}08, ${fgColor}03)`,
                    border: `1px solid ${fgColor}10`,
                  }}
                  data-testid={`preview-auxiliary-field-${i}`}
                >
                  <div 
                    className="text-[8px] uppercase tracking-[0.2em] font-semibold mb-1"
                    style={{ color: lblColor }}
                  >
                    {field.label}
                  </div>
                  <div className="text-sm font-semibold tracking-wide">
                    {replaceTemplateVars(field.value)}
                  </div>
                </div>
              ))
            ) : (
              <>
                <div 
                  className="flex-1 p-3 rounded-xl"
                  style={{ 
                    background: `linear-gradient(135deg, ${fgColor}08, ${fgColor}03)`,
                    border: `1px solid ${fgColor}10`,
                  }}
                >
                  <div 
                    className="text-[8px] uppercase tracking-[0.2em] font-semibold mb-1"
                    style={{ color: lblColor }}
                  >
                    Tier
                  </div>
                  <div className="text-sm font-semibold tracking-wide">Gold</div>
                </div>
                <div 
                  className="flex-1 p-3 rounded-xl"
                  style={{ 
                    background: `linear-gradient(135deg, ${fgColor}08, ${fgColor}03)`,
                    border: `1px solid ${fgColor}10`,
                  }}
                >
                  <div 
                    className="text-[8px] uppercase tracking-[0.2em] font-semibold mb-1"
                    style={{ color: lblColor }}
                  >
                    Name
                  </div>
                  <div className="text-sm font-semibold tracking-wide">John Doe</div>
                </div>
              </>
            )}
          </div>

          {/* QR Code section with futuristic frame */}
          <div 
            className="absolute bottom-0 left-0 right-0 p-5 flex flex-col items-center"
            style={{
              background: `linear-gradient(to top, rgba(255,255,255,0.98), rgba(255,255,255,0.95))`,
              borderTop: '1px solid rgba(0,0,0,0.05)',
            }}
          >
            {/* Tech frame around QR */}
            <div className="relative">
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-gray-400 rounded-tl" />
              <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-gray-400 rounded-tr" />
              <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-gray-400 rounded-bl" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-gray-400 rounded-br" />
              
              <div 
                className="w-24 h-24 rounded-lg flex items-center justify-center bg-white shadow-sm"
                data-testid="preview-barcode"
              >
                {design.barcodeFormat === "PKBarcodeFormatQR" || design.barcodeFormat === "PKBarcodeFormatAztec" ? (
                  <QrCode className="h-16 w-16 text-gray-800" />
                ) : (
                  <BarChart3 className="h-14 w-16 text-gray-800" />
                )}
              </div>
            </div>
            <div className="text-[9px] text-gray-500 mt-3 font-mono tracking-wider uppercase">
              {replaceTemplateVars(design.barcodeMessage || "{{serialNumber}}")}
            </div>
          </div>
        </div>
      </div>
      
      {/* CSS Animations */}
      <style>{`
        @keyframes shimmer {
          0%, 100% { background-position: 0% 0%; }
          50% { background-position: 100% 100%; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(0.98); }
          50% { opacity: 0.8; transform: scale(1); }
        }
      `}</style>
      
      <p className="text-xs text-muted-foreground text-center mt-4 max-w-[320px] mx-auto">
        Preview with sample data. Template variables like {"{{memberId}}"} will be replaced with actual values.
      </p>
    </div>
  );
}

function FieldArraySection({ 
  title, 
  name, 
  fields, 
  append, 
  remove, 
  form 
}: { 
  title: string;
  name: "primaryFields" | "auxiliaryFields" | "backFields";
  fields: PassField[];
  append: (value: PassField) => void;
  remove: (index: number) => void;
  form: ReturnType<typeof useForm<VipPassDesignFormData>>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ key: "", label: "", value: "" })}
          data-testid={`button-add-${name}`}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Field
        </Button>
      </div>
      
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No fields added yet</p>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <Card key={index} className="p-3" data-testid={`${name}-field-${index}`}>
              <div className="grid grid-cols-3 gap-2">
                <FormField
                  control={form.control}
                  name={`${name}.${index}.key`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Key</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g., member" 
                          className="h-8 text-sm"
                          data-testid={`input-${name}-${index}-key`}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`${name}.${index}.label`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Label</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g., Member ID" 
                          className="h-8 text-sm"
                          data-testid={`input-${name}-${index}-label`}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex items-end gap-1">
                  <FormField
                    control={form.control}
                    name={`${name}.${index}.value`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">Value</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="e.g., {{memberId}}" 
                            className="h-8 text-sm"
                            data-testid={`input-${name}-${index}-value`}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => remove(index)}
                    data-testid={`button-remove-${name}-${index}`}
                  >
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

export default function VipPassDesigner() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("basic");

  const { data: existingDesign, isLoading, error } = useQuery<VipPassDesignFormData>({
    queryKey: ["/api/vip-pass/design"],
  });

  const form = useForm<VipPassDesignFormData>({
    resolver: zodResolver(vipPassDesignSchema),
    defaultValues: {
      passName: "VIP Gold Pass",
      passDescription: "VIP Member Pass",
      logoText: "VIP GOLD",
      backgroundColor: "#000000",
      foregroundColor: "#ffffff",
      labelColor: "#c8c8c8",
      passTypeIdentifier: "",
      teamIdentifier: "",
      barcodeFormat: "PKBarcodeFormatQR",
      barcodeMessage: "{{serialNumber}}",
      primaryFields: [{ key: "member", label: "Member ID", value: "{{memberId}}" }],
      auxiliaryFields: [
        { key: "tier", label: "Tier", value: "{{tierLevel}}" },
        { key: "name", label: "Name", value: "{{recipientName}}" },
      ],
      backFields: [{ key: "info", label: "VIP Benefits", value: "Priority service\nExclusive updates\nFast-lane handling" }],
    },
  });

  const primaryFieldsArray = useFieldArray({
    control: form.control,
    name: "primaryFields",
  });

  const auxiliaryFieldsArray = useFieldArray({
    control: form.control,
    name: "auxiliaryFields",
  });

  const backFieldsArray = useFieldArray({
    control: form.control,
    name: "backFields",
  });

  useEffect(() => {
    if (existingDesign && Object.keys(existingDesign).length > 0) {
      const formData = {
        ...existingDesign,
        backgroundColor: existingDesign.backgroundColor?.startsWith('rgb') 
          ? rgbToHex(existingDesign.backgroundColor) 
          : (existingDesign.backgroundColor || "#000000"),
        foregroundColor: existingDesign.foregroundColor?.startsWith('rgb') 
          ? rgbToHex(existingDesign.foregroundColor) 
          : (existingDesign.foregroundColor || "#ffffff"),
        labelColor: existingDesign.labelColor?.startsWith('rgb') 
          ? rgbToHex(existingDesign.labelColor) 
          : (existingDesign.labelColor || "#c8c8c8"),
      };
      form.reset(formData);
    }
  }, [existingDesign, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: VipPassDesignFormData) => {
      const submitData = {
        ...data,
        backgroundColor: hexToRgb(data.backgroundColor),
        foregroundColor: hexToRgb(data.foregroundColor),
        labelColor: hexToRgb(data.labelColor),
      };
      return await apiRequest("POST", "/api/vip-pass/design", submitData);
    },
    onSuccess: () => {
      toast({ 
        title: "Design saved", 
        description: "Your VIP Pass design has been saved successfully." 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/design"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error saving design", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: VipPassDesignFormData) => {
    saveMutation.mutate(data);
  };

  const watchedValues = form.watch();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto py-6 px-4">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="page-title">VIP Pass Designer</h1>
              <p className="text-muted-foreground">Design your Apple Wallet VIP Pass for customers</p>
            </div>
            <Button 
              onClick={form.handleSubmit(onSubmit)}
              disabled={saveMutation.isPending}
              data-testid="button-save-design"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Design
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  Pass Configuration
                </CardTitle>
                <CardDescription>
                  Customize how your VIP pass looks and what information it displays
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="grid w-full grid-cols-5" data-testid="config-tabs">
                        <TabsTrigger value="basic" data-testid="tab-basic">Basic</TabsTrigger>
                        <TabsTrigger value="colors" data-testid="tab-colors">Colors</TabsTrigger>
                        <TabsTrigger value="apple" data-testid="tab-apple">Apple</TabsTrigger>
                        <TabsTrigger value="barcode" data-testid="tab-barcode">Barcode</TabsTrigger>
                        <TabsTrigger value="fields" data-testid="tab-fields">Fields</TabsTrigger>
                      </TabsList>

                      <TabsContent value="basic" className="space-y-4 pt-4">
                        <FormField
                          control={form.control}
                          name="passName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pass Name</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="VIP Gold Pass"
                                  data-testid="input-pass-name"
                                />
                              </FormControl>
                              <FormDescription>Internal name for this pass design</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="passDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pass Description</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="VIP Member Pass"
                                  data-testid="input-pass-description"
                                />
                              </FormControl>
                              <FormDescription>Description shown in the Wallet app</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="logoText"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Logo Text</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="VIP GOLD"
                                  data-testid="input-logo-text"
                                />
                              </FormControl>
                              <FormDescription>Text displayed at the top of the pass</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>

                      <TabsContent value="colors" className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="backgroundColor"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  <Palette className="h-4 w-4" />
                                  Background Color
                                </FormLabel>
                                <FormControl>
                                  <div className="flex gap-2">
                                    <Input
                                      type="color"
                                      {...field}
                                      className="w-12 h-10 p-1 cursor-pointer"
                                      data-testid="input-background-color"
                                    />
                                    <Input 
                                      value={field.value} 
                                      onChange={field.onChange}
                                      placeholder="#000000"
                                      className="flex-1"
                                      data-testid="input-background-color-text"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="foregroundColor"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  <Palette className="h-4 w-4" />
                                  Text Color
                                </FormLabel>
                                <FormControl>
                                  <div className="flex gap-2">
                                    <Input
                                      type="color"
                                      {...field}
                                      className="w-12 h-10 p-1 cursor-pointer"
                                      data-testid="input-foreground-color"
                                    />
                                    <Input 
                                      value={field.value} 
                                      onChange={field.onChange}
                                      placeholder="#ffffff"
                                      className="flex-1"
                                      data-testid="input-foreground-color-text"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="labelColor"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  <Palette className="h-4 w-4" />
                                  Label Color
                                </FormLabel>
                                <FormControl>
                                  <div className="flex gap-2">
                                    <Input
                                      type="color"
                                      {...field}
                                      className="w-12 h-10 p-1 cursor-pointer"
                                      data-testid="input-label-color"
                                    />
                                    <Input 
                                      value={field.value} 
                                      onChange={field.onChange}
                                      placeholder="#c8c8c8"
                                      className="flex-1"
                                      data-testid="input-label-color-text"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="apple" className="space-y-4 pt-4">
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                          <div className="flex items-start gap-3">
                            <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <div className="text-sm text-amber-800 dark:text-amber-200">
                              <p className="font-medium">Apple Developer Account Required</p>
                              <p className="mt-1 text-amber-700 dark:text-amber-300">
                                You need an Apple Developer account to create valid passes. 
                                Get your Pass Type ID and Team ID from the Apple Developer Portal.
                              </p>
                            </div>
                          </div>
                        </div>

                        <FormField
                          control={form.control}
                          name="passTypeIdentifier"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pass Type Identifier</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="pass.com.company.vip"
                                  data-testid="input-pass-type-identifier"
                                />
                              </FormControl>
                              <FormDescription>
                                The Pass Type ID from your Apple Developer account (e.g., pass.com.yourcompany.vip)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="teamIdentifier"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Team Identifier</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="ABCDE12345"
                                  data-testid="input-team-identifier"
                                />
                              </FormControl>
                              <FormDescription>
                                Your 10-character Apple Team ID from the Developer Portal
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>

                      <TabsContent value="barcode" className="space-y-4 pt-4">
                        <FormField
                          control={form.control}
                          name="barcodeFormat"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Barcode Format</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-barcode-format">
                                    <SelectValue placeholder="Select barcode format" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="PKBarcodeFormatQR">QR Code</SelectItem>
                                  <SelectItem value="PKBarcodeFormatPDF417">PDF417</SelectItem>
                                  <SelectItem value="PKBarcodeFormatAztec">Aztec</SelectItem>
                                  <SelectItem value="PKBarcodeFormatCode128">Code 128</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                QR Code is recommended for best compatibility
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="barcodeMessage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Barcode Message</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="{{serialNumber}}"
                                  data-testid="input-barcode-message"
                                />
                              </FormControl>
                              <FormDescription>
                                Data encoded in the barcode. Use template variables like {"{{serialNumber}}"}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="bg-muted/50 rounded-lg p-4">
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <List className="h-4 w-4" />
                            Available Template Variables
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            {templateVariables.map((v) => (
                              <div key={v.key} className="flex items-center gap-2">
                                <code className="bg-background px-2 py-0.5 rounded text-xs font-mono">
                                  {`{{${v.key}}}`}
                                </code>
                                <span className="text-muted-foreground text-xs">{v.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="fields" className="space-y-6 pt-4">
                        <FieldArraySection
                          title="Primary Fields (Large Text)"
                          name="primaryFields"
                          fields={primaryFieldsArray.fields}
                          append={primaryFieldsArray.append}
                          remove={primaryFieldsArray.remove}
                          form={form}
                        />

                        <Separator />

                        <FieldArraySection
                          title="Auxiliary Fields (Secondary Info)"
                          name="auxiliaryFields"
                          fields={auxiliaryFieldsArray.fields}
                          append={auxiliaryFieldsArray.append}
                          remove={auxiliaryFieldsArray.remove}
                          form={form}
                        />

                        <Separator />

                        <FieldArraySection
                          title="Back Fields (Pass Back Side)"
                          name="backFields"
                          fields={backFieldsArray.fields}
                          append={backFieldsArray.append}
                          remove={backFieldsArray.remove}
                          form={form}
                        />

                        <div className="bg-muted/50 rounded-lg p-4">
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            Field Tips
                          </h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• <strong>Key</strong>: Unique identifier (no spaces, lowercase)</li>
                            <li>• <strong>Label</strong>: Display name shown above the value</li>
                            <li>• <strong>Value</strong>: Can include template variables like {"{{memberId}}"}</li>
                          </ul>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <div className="lg:sticky lg:top-6 lg:self-start">
              <Card>
                <CardContent className="pt-6">
                  <PassPreview design={watchedValues} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
