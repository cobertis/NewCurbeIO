import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, MessageSquare, Palette, Globe, Code, Copy, Check } from "lucide-react";
import { SettingsLayout } from "@/components/settings-layout";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

const colorOptions = [
  { value: "blue", bg: "bg-blue-500", label: "Blue" },
  { value: "orange", bg: "bg-orange-500", label: "Orange" },
  { value: "green", bg: "bg-green-500", label: "Green" },
  { value: "red", bg: "bg-red-500", label: "Red" },
  { value: "teal", bg: "bg-teal-500", label: "Teal" },
];

export default function ChatWidgetFlowPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [widgetName, setWidgetName] = useState("");
  const [domain, setDomain] = useState("");
  const [colorTheme, setColorTheme] = useState("blue");
  const [themeType, setThemeType] = useState<"gradient" | "solid">("gradient");
  const [welcomeMessage, setWelcomeMessage] = useState("Hi there! We are here to assist you with any questions or feedback you may have.");
  const [embedCode, setEmbedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [createdWidgetId, setCreatedWidgetId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/integrations/chat-widget/create", {
        name: widgetName,
        domain,
        colorTheme,
        themeType,
        welcomeMessage,
      });
    },
    onSuccess: (data: { widgetId: string; embedCode: string }) => {
      toast({
        title: "Widget Created",
        description: "Your chat widget has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/chat-widget/list"] });
      setCreatedWidgetId(data.widgetId);
      setEmbedCode(data.embedCode || `<script src="https://widget.curbe.io/v1/${data.widgetId}.js" async></script>`);
      setCurrentStep(3);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Creation failed",
        description: error.message || "We couldn't create your widget. Please try again.",
      });
    },
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast({
      title: "Copied",
      description: "Embed code copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!widgetName.trim()) {
        toast({
          variant: "destructive",
          title: "Name required",
          description: "Please enter a name for your widget.",
        });
        return;
      }
      if (!domain.trim()) {
        toast({
          variant: "destructive",
          title: "Domain required",
          description: "Please enter your website domain.",
        });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      createMutation.mutate();
    }
  };

  const handleDiscard = () => {
    setLocation("/settings/chat-widget");
  };

  const getStepStatus = (step: number) => {
    if (step < currentStep) return "completed";
    if (step === currentStep) return "current";
    return "pending";
  };

  const StepIndicator = ({ step, status }: { step: number; status: "completed" | "current" | "pending" }) => {
    if (status === "completed") {
      return (
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
          <CheckCircle2 className="h-5 w-5" />
        </div>
      );
    }
    return (
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-medium ${
        status === "current" 
          ? "bg-blue-500 text-white" 
          : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
      }`}>
        {step}
      </div>
    );
  };

  return (
    <SettingsLayout activeSection="chat-widget">
      <div className="space-y-6" data-testid="page-chat-widget-flow">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/settings" className="hover:text-slate-700 dark:hover:text-slate-300">
            Settings
          </Link>
          <span>&gt;</span>
          <Link href="/settings/chat-widget" className="hover:text-slate-700 dark:hover:text-slate-300">
            Chat widget
          </Link>
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500">
                  <MessageSquare className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Create chat widget
                </h1>
              </div>
              <Button 
                variant="outline" 
                onClick={handleDiscard}
                data-testid="button-discard"
              >
                Discard
              </Button>
            </div>

            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <StepIndicator step={1} status={getStepStatus(1)} />
                  <div className={`w-0.5 flex-1 mt-2 ${currentStep > 1 ? "bg-green-500" : "bg-slate-200 dark:bg-slate-700"}`} />
                </div>
                <div className="flex-1 pb-8">
                  {currentStep === 1 ? (
                    <>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        Basic settings
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Configure the basic settings for your chat widget.
                      </p>
                      
                      <div className="space-y-4 max-w-md">
                        <div className="space-y-2">
                          <Label htmlFor="widget-name" className="text-sm font-medium">
                            Widget name
                          </Label>
                          <Input
                            id="widget-name"
                            placeholder="My Website Chat"
                            value={widgetName}
                            onChange={(e) => setWidgetName(e.target.value)}
                            data-testid="input-widget-name"
                          />
                          <p className="text-xs text-slate-500">
                            This name is for your reference only and won't be visible to visitors.
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="domain" className="text-sm font-medium">
                            Website domain
                          </Label>
                          <div className="flex items-center">
                            <span className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-r-0 rounded-l-md text-sm text-slate-500">
                              https://
                            </span>
                            <Input
                              id="domain"
                              placeholder="www.example.com"
                              value={domain}
                              onChange={(e) => setDomain(e.target.value)}
                              className="rounded-l-none"
                              data-testid="input-domain"
                            />
                          </div>
                          <p className="text-xs text-slate-500">
                            The domain where the widget will be embedded.
                          </p>
                        </div>
                        
                        <Button 
                          className="mt-4"
                          onClick={handleNext}
                          data-testid="button-next-step"
                        >
                          Next: Customize appearance
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        Basic settings
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {widgetName} • {domain}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <StepIndicator step={2} status={getStepStatus(2)} />
                  <div className={`w-0.5 flex-1 mt-2 ${currentStep > 2 ? "bg-green-500" : "bg-slate-200 dark:bg-slate-700"}`} />
                </div>
                <div className="flex-1 pb-8">
                  {currentStep === 2 ? (
                    <>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        Customize appearance
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Match the widget to your brand.
                      </p>
                      
                      <div className="space-y-6 max-w-md">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Palette className="h-4 w-4 text-blue-500" />
                            <Label className="text-sm font-medium">Color theme</Label>
                          </div>
                          
                          <RadioGroup value={themeType} onValueChange={(v) => setThemeType(v as "gradient" | "solid")} className="flex gap-4">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="gradient" id="gradient" />
                              <Label htmlFor="gradient" className="text-sm cursor-pointer">Gradient</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="solid" id="solid" />
                              <Label htmlFor="solid" className="text-sm cursor-pointer">Solid color</Label>
                            </div>
                          </RadioGroup>
                          
                          <div className="flex gap-2">
                            {colorOptions.map((color) => (
                              <button
                                key={color.value}
                                onClick={() => setColorTheme(color.value)}
                                className={`w-8 h-8 rounded-full ${color.bg} transition-all ${
                                  colorTheme === color.value 
                                    ? "ring-2 ring-offset-2 ring-blue-500" 
                                    : "hover:scale-110"
                                }`}
                                title={color.label}
                                data-testid={`button-color-${color.value}`}
                              />
                            ))}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="welcome-message" className="text-sm font-medium">
                            Welcome message
                          </Label>
                          <Input
                            id="welcome-message"
                            placeholder="Hi there! How can we help you today?"
                            value={welcomeMessage}
                            onChange={(e) => setWelcomeMessage(e.target.value)}
                            data-testid="input-welcome-message"
                          />
                        </div>
                        
                        <div className="flex gap-3">
                          <Button 
                            variant="outline"
                            onClick={() => setCurrentStep(1)}
                            data-testid="button-back"
                          >
                            Back
                          </Button>
                          <Button 
                            onClick={handleNext}
                            disabled={createMutation.isPending}
                            data-testid="button-create-widget"
                          >
                            {createMutation.isPending ? "Creating..." : "Create widget"}
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : currentStep > 2 ? (
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        Customize appearance
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Theme: {themeType} • Color: {colorTheme}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-base font-medium text-blue-600 dark:text-blue-400">
                        Customize appearance
                      </h3>
                      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        Configure colors and branding for your widget.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <StepIndicator step={3} status={getStepStatus(3)} />
                </div>
                <div className="flex-1">
                  {currentStep >= 3 ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                          Widget created 🎉
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Your chat widget has been created. Add the code below to your website to start chatting with visitors.
                        </p>
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Code className="h-4 w-4 text-slate-500" />
                          <Label className="text-sm font-medium">Embed code</Label>
                        </div>
                        <div className="relative">
                          <pre className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm overflow-x-auto">
                            <code className="text-slate-700 dark:text-slate-300">{embedCode}</code>
                          </pre>
                          <Button
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={handleCopyCode}
                            data-testid="button-copy-code"
                          >
                            {copied ? (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-1" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          Add this code to your website's HTML, just before the closing &lt;/body&gt; tag.
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Button 
                          onClick={() => setLocation("/settings/chat-widget")}
                          data-testid="button-finish"
                        >
                          Finish
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => createdWidgetId && setLocation(`/settings/chat-widget/${createdWidgetId}/settings`)}
                          data-testid="button-widget-settings"
                        >
                          Widget settings
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-base font-medium text-blue-600 dark:text-blue-400">
                        Get embed code
                      </h3>
                      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        Embed the widget on your website.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}
