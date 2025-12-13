import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Bell, BellOff, Download, Smartphone, Star, Calendar, CreditCard, Wallet, Home, Info } from "lucide-react";
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
  const [showInstallHelp, setShowInstallHelp] = useState(false);

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

  // Track 'landed' event when user arrives from push notification
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const nid = urlParams.get('nid');
    const src = urlParams.get('src');
    
    if (nid && src === 'push') {
      // Send landed event to backend
      fetch(`/api/push/track?e=landed&nid=${nid}`, { 
        method: 'POST',
        keepalive: true 
      }).catch(err => console.error('Failed to track landed:', err));
      
      // Clean up URL params without triggering reload
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    // Save last_card_token for PWA standalone redirect
    try {
      localStorage.setItem("last_card_token", token);
    } catch (e) {
      console.error("Failed to save last_card_token:", e);
    }

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
    } else {
      // Show manual installation instructions
      setShowInstallHelp(true);
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

        {platform === "android" && (
          <div className="space-y-3">
            {/* Botón de Notificaciones */}
            {pushSupported && !pushSubscribed && (
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
                Activar Notificaciones
              </Button>
            )}
            
            {pushSubscribed && (
              <div className="flex items-center justify-center gap-2 py-1 text-green-500" data-testid="notifications-enabled">
                <Bell className="h-4 w-4" />
                <span className="text-sm">Notificaciones activadas</span>
              </div>
            )}

            {/* Botón de Agregar al Inicio */}
            {!isPwa && (
              <>
                <Button
                  onClick={handleInstallPwa}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  data-testid="button-add-to-home"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Agregar al Inicio
                </Button>
                
                {showInstallHelp && (
                  <Card className="bg-blue-900/30 border-blue-700/50 p-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-200">
                        <p className="font-medium mb-1">Para agregar al inicio:</p>
                        <ol className="list-decimal list-inside space-y-1 text-blue-300">
                          <li>Toca el menú <span className="font-bold">⋮</span> en Chrome</li>
                          <li>Selecciona "Agregar a pantalla principal"</li>
                          <li>Confirma tocando "Agregar"</li>
                        </ol>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}
            
            {isPwa && (
              <div className="flex items-center justify-center gap-2 py-1 text-green-500" data-testid="text-card-ready">
                <Home className="h-4 w-4" />
                <span className="text-sm">Instalada en tu pantalla</span>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-500 pt-4">
          {platform === "ios" && "Usa Apple Wallet para la mejor experiencia"}
          {platform === "android" && !pushSubscribed && !isPwa && "Activa notificaciones y agrega al inicio"}
          {platform === "android" && pushSubscribed && !isPwa && "Agrega al inicio para acceso rápido"}
          {platform === "android" && !pushSubscribed && isPwa && "Activa notificaciones para estar al día"}
          {platform === "android" && pushSubscribed && isPwa && "Tu tarjeta está lista"}
          {platform === "desktop" && "Abre en tu móvil para la experiencia completa"}
        </p>
      </div>
    </div>
  );
}
