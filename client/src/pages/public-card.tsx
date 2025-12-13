import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Bell, BellOff, Download, Smartphone, Star, Calendar, CreditCard, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CardData {
  card: {
    serialNumber: string;
    memberName: string | null;
    memberSince: string | null;
    tierLevel: string | null;
    memberId: string | null;
  };
  company: {
    id: string;
    name: string;
    logo: string | null;
  } | null;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function detectPlatform(): "ios" | "android" | "desktop" {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export default function PublicCard() {
  const [, params] = useRoute("/p/:token");
  const token = params?.token;
  const { toast } = useToast();

  const [cardData, setCardData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [isPwa, setIsPwa] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [downloadingWallet, setDownloadingWallet] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsPwa(isStandalone());
    setPushSupported("serviceWorker" in navigator && "PushManager" in window);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  useEffect(() => {
    if (!token) return;

    async function fetchCard() {
      try {
        const res = await fetch(`/api/public/card/${token}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "Card not found");
        }
        const data = await res.json();
        setCardData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchCard();
  }, [token]);

  useEffect(() => {
    if (!pushSupported || !token) return;

    async function checkSubscription() {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushSubscribed(!!sub);
      } catch (err) {
        console.error("Check subscription error:", err);
      }
    }

    checkSubscription();
  }, [pushSupported, token]);

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      return reg;
    } catch (err) {
      console.error("SW registration failed:", err);
      return null;
    }
  }

  async function subscribeToPush() {
    if (!token || subscribing) return;
    setSubscribing(true);

    try {
      const reg = await registerServiceWorker();
      if (!reg) throw new Error("Service Worker not available");

      const keyRes = await fetch("/api/push/public-key");
      if (!keyRes.ok) throw new Error("Push not configured");
      const { publicKey } = await keyRes.json();

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
          platform,
        }),
      });

      if (!res.ok) throw new Error("Failed to register subscription");

      setPushSubscribed(true);
      toast({ title: "Notifications enabled", description: "You will receive VIP updates" });
    } catch (err: any) {
      console.error("Subscribe error:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubscribing(false);
    }
  }

  async function unsubscribeFromPush() {
    if (subscribing) return;
    setSubscribing(true);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      setPushSubscribed(false);
      toast({ title: "Notifications disabled" });
    } catch (err: any) {
      console.error("Unsubscribe error:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubscribing(false);
    }
  }

  async function handleInstallPwa() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        toast({ title: "App installed", description: "Open from your home screen" });
      }
      setDeferredPrompt(null);
    }
  }

  async function testPush() {
    if (!token) return;
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.sent > 0) {
        toast({ title: "Test sent", description: "Check your notifications" });
      } else {
        toast({ title: "No subscriptions", description: "Enable notifications first", variant: "destructive" });
      }
    } catch (err) {
      console.error("Test push error:", err);
    }
  }

  async function downloadAppleWallet() {
    if (!token || downloadingWallet) return;
    setDownloadingWallet(true);

    try {
      const res = await fetch(`/api/public/wallet/${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to download wallet pass");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vip-pass-${token.slice(0, 8)}.pkpass`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: "Pass downloaded", description: "Open the file to add to Apple Wallet" });
    } catch (err: any) {
      console.error("Download wallet error:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingWallet(false);
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen={true} message="Loading your card..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="p-8 text-center max-w-sm">
          <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h1 className="text-xl font-semibold mb-2">Card Not Found</h1>
          <p className="text-gray-500">{error}</p>
        </Card>
      </div>
    );
  }

  if (!cardData) return null;

  const { card, company } = cardData;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4">
      <div className="max-w-sm mx-auto space-y-4">
        <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 text-white overflow-hidden">
          {company?.logo && (
            <div className="p-4 flex justify-center bg-white/5">
              <img src={company.logo} alt={company.name} className="h-12 object-contain" />
            </div>
          )}
          
          <div className="p-6 space-y-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold" data-testid="text-member-name">
                {card.memberName}
              </h1>
              {company && (
                <p className="text-gray-400 text-sm">{company.name}</p>
              )}
            </div>

            {card.tierLevel && (
              <div className="flex justify-center">
                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  <Star className="h-3 w-3 mr-1" />
                  {card.tierLevel}
                </Badge>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              {card.memberId && (
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-gray-400 text-xs">Member ID</p>
                  <p className="text-xl font-bold" data-testid="text-member-id">{card.memberId}</p>
                </div>
              )}
              
              {card.memberSince && (
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-gray-400 text-xs">Member Since</p>
                  <p className="font-medium" data-testid="text-member-since">{new Date(card.memberSince).toLocaleDateString()}</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500 text-center">
                Card #{card.serialNumber}
              </p>
            </div>
          </div>
        </Card>

        {platform === "ios" && (
          <Button
            onClick={downloadAppleWallet}
            disabled={downloadingWallet}
            className="w-full bg-black hover:bg-gray-900 text-white"
            data-testid="button-add-apple-wallet"
          >
            {downloadingWallet ? (
              <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />
            ) : (
              <Wallet className="h-4 w-4 mr-2" />
            )}
            Add to Apple Wallet
          </Button>
        )}

        {platform === "android" && !isPwa && deferredPrompt && (
          <Button
            onClick={handleInstallPwa}
            className="w-full"
            variant="outline"
            data-testid="button-install-pwa"
          >
            <Download className="h-4 w-4 mr-2" />
            Install App
          </Button>
        )}

        {platform === "android" && pushSupported && (
          <div className="space-y-2">
            {!pushSubscribed ? (
              <Button
                onClick={subscribeToPush}
                disabled={subscribing}
                className="w-full bg-green-600 hover:bg-green-700"
                data-testid="button-enable-notifications"
              >
                {subscribing ? (
                  <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />
                ) : (
                  <Bell className="h-4 w-4 mr-2" />
                )}
                Enable Notifications
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={testPush}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-test-notification"
                >
                  Test Notification
                </Button>
                <Button
                  onClick={unsubscribeFromPush}
                  disabled={subscribing}
                  variant="ghost"
                  className="text-red-500"
                  data-testid="button-disable-notifications"
                >
                  <BellOff className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-500 pt-4">
          {platform === "ios" && "Use Apple Wallet for the best experience"}
          {platform === "android" && "Install app and enable notifications for updates"}
          {platform === "desktop" && "Open on your mobile device for the full experience"}
        </p>
      </div>
    </div>
  );
}
