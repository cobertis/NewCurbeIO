import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle2, MessageCircle, Bot, ExternalLink, QrCode, Eye, EyeOff, ChevronRight } from "lucide-react";
import { SiTelegram } from "react-icons/si";
import { SettingsLayout } from "@/components/settings-layout";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";
import type { ChannelConnection } from "@shared/schema";

export default function TelegramFlowPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [botToken, setBotToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const { data: connectionData, isLoading } = useQuery<{ connection: ChannelConnection | null }>({
    queryKey: ["/api/integrations/telegram/status"],
  });

  const connection = connectionData?.connection;
  const isConnected = connection?.status === "active";

  useEffect(() => {
    if (isConnected) {
      setCurrentStep(2);
    }
  }, [isConnected]);

  const connectMutation = useMutation({
    mutationFn: async (token: string) => {
      return apiRequest("POST", "/api/integrations/telegram/connect", { botToken: token });
    },
    onSuccess: () => {
      toast({
        title: "Telegram Bot Connected",
        description: "Your Telegram bot has been connected successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/telegram/status"] });
      setCurrentStep(2);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: error.message || "We couldn't connect your Telegram bot. Please check the token and try again.",
      });
    },
  });

  const handleConnectBot = () => {
    if (!botToken.trim()) {
      toast({
        variant: "destructive",
        title: "Token required",
        description: "Please enter your Telegram bot token.",
      });
      return;
    }
    connectMutation.mutate(botToken);
  };

  const handleDiscard = () => {
    setLocation("/settings/telegram");
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

  if (isLoading) {
    return (
      <SettingsLayout activeSection="telegram">
        <LoadingSpinner />
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout activeSection="telegram">
      <div className="space-y-6" data-testid="page-telegram-flow">
        <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-telegram-setup">
          <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">Settings</Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Telegram Setup</span>
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-[#0088CC]">
                  <SiTelegram className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Connect Telegram bot
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
                        Connect Telegram bot
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Follow the steps below to connect your Telegram bot and start managing your conversations in Curbe.
                      </p>
                      
                      <div className="space-y-3 mb-6">
                        <div className="flex items-start gap-3">
                          <SiTelegram className="h-5 w-5 text-[#0088CC] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-slate-900 dark:text-slate-100">Create a bot with @BotFather</span>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Message{" "}
                              <a 
                                href="https://t.me/BotFather" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                @BotFather
                              </a>{" "}
                              on Telegram and use the /newbot command to create your bot.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <Bot className="h-5 w-5 text-[#0088CC] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-slate-900 dark:text-slate-100">Get your bot token</span>
                            <p className="text-sm text-slate-500 dark:text-slate-400">After creating your bot, @BotFather will give you a unique token. Copy this token.</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <MessageCircle className="h-5 w-5 text-[#0088CC] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-slate-900 dark:text-slate-100">Receive messages</span>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Once connected, all messages to your bot will appear in Curbe Messenger.</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4 max-w-md">
                        <div className="space-y-2">
                          <Label htmlFor="bot-token" className="text-sm font-medium">
                            Bot Token
                          </Label>
                          <div className="relative">
                            <Input
                              id="bot-token"
                              type={showToken ? "text" : "password"}
                              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                              value={botToken}
                              onChange={(e) => setBotToken(e.target.value)}
                              className="pr-10"
                              data-testid="input-bot-token"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                              onClick={() => setShowToken(!showToken)}
                            >
                              {showToken ? (
                                <EyeOff className="h-4 w-4 text-slate-500" />
                              ) : (
                                <Eye className="h-4 w-4 text-slate-500" />
                              )}
                            </Button>
                          </div>
                          <p className="text-xs text-slate-500">
                            You can get this from{" "}
                            <a 
                              href="https://t.me/BotFather" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              @BotFather
                            </a>{" "}
                            on Telegram
                          </p>
                        </div>
                        
                        <Button 
                          className="bg-[#0088CC] hover:bg-[#006699] text-white gap-2"
                          onClick={handleConnectBot}
                          disabled={connectMutation.isPending || !botToken.trim()}
                          data-testid="button-connect-telegram"
                        >
                          <SiTelegram className="h-4 w-4" />
                          {connectMutation.isPending ? "Connecting..." : "Connect Telegram Bot"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        Connect Telegram bot
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Telegram bot: {connection?.displayName || "Connected"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <StepIndicator step={2} status={getStepStatus(2)} />
                </div>
                <div className="flex-1">
                  {currentStep >= 2 ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                          Telegram bot connected 🎉
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          You have successfully connected your Telegram bot and can now manage your conversations in Curbe.
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                          Your Telegram Bot
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                              <SiTelegram className="h-5 w-5 text-[#0088CC]" />
                            </div>
                            <a 
                              href={`https://t.me/${(connection?.metadata as { botUsername?: string })?.botUsername || connection?.displayName || ""}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-base font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 flex items-center gap-1"
                            >
                              @{(connection?.metadata as { botUsername?: string })?.botUsername || connection?.displayName || "Bot"}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-2" data-testid="button-qr-code">
                                <QrCode className="h-4 w-4" />
                                View QR code
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Telegram Bot Link</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  Share this link with customers to start a conversation:
                                </p>
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                  <code className="text-sm break-all">
                                    https://t.me/{(connection?.metadata as { botUsername?: string })?.botUsername || connection?.displayName || ""}
                                  </code>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                      
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        To test connection, <span className="font-medium">scan the QR code</span> or <span className="font-medium">click the bot link</span> to send a message to your Telegram bot. The message you send will appear in{" "}
                        <a href="/messenger" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                          Curbe Messenger
                        </a>. For more information, please read{" "}
                        <a 
                          href="#" 
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          our support article
                        </a>.
                      </p>
                      
                      <div className="flex items-center gap-3">
                        <Button 
                          onClick={() => setLocation("/settings/telegram")}
                          data-testid="button-finish"
                        >
                          Finish
                        </Button>
                        <Button 
                          variant="outline"
                          className="gap-2"
                          onClick={() => setLocation("/messenger")}
                          data-testid="button-go-to-messenger"
                        >
                          Go to Messenger
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-base font-medium text-blue-600 dark:text-blue-400">
                        Telegram bot connected
                      </h3>
                      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        Your Telegram bot will appear here after connecting.
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
