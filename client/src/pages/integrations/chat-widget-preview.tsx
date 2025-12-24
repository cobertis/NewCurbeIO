import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Copy, Mail, ExternalLink, MessageSquare, Phone, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const colorOptions = [
  { value: "blue", bg: "bg-blue-500", hex: "#3B82F6" },
  { value: "green", bg: "bg-green-500", hex: "#22C55E" },
  { value: "purple", bg: "bg-purple-500", hex: "#A855F7" },
  { value: "red", bg: "bg-red-500", hex: "#EF4444" },
  { value: "orange", bg: "bg-orange-500", hex: "#F97316" },
  { value: "teal", bg: "bg-teal-500", hex: "#14B8A6" },
  { value: "pink", bg: "bg-pink-500", hex: "#EC4899" },
  { value: "indigo", bg: "bg-indigo-500", hex: "#6366F1" },
];

export default function ChatWidgetPreviewPage() {
  const { id: widgetId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);

  const { data: widgetData, isLoading } = useQuery<{ widget?: { name?: string; colorTheme?: string; welcomeTitle?: string; welcomeMessage?: string } }>({
    queryKey: ["/api/chat-widgets", widgetId],
    enabled: !!widgetId,
  });

  const defaultWidget = {
    name: "Website Widget",
    colorTheme: "green",
    welcomeTitle: "Hi there",
    welcomeMessage: "We are here to assist you with any questions or feedback you may have.",
  };

  const widget = { ...defaultWidget, ...widgetData?.widget };
  const currentColor = colorOptions.find(c => c.value === widget.colorTheme) || colorOptions[1];
  
  const embedCode = `<script src="https://widgets.curbe.io/messenger-widget-script.js" data-code="${widgetId}" defer=""></script>`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Embed code copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800" data-testid="page-widget-preview">
      <div className="container max-w-4xl mx-auto py-12 px-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MessageSquare className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Curbe</h1>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Welcome to the Curbe widget test page
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Here you can test the Curbe widget and chat to yourself.
          </p>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 mb-8">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Install Curbe code to your website
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Copy the code below and add it to your website before the closing <code className="text-blue-600">&lt;/body&gt;</code> tag.
            </p>
            
            <div className="relative mb-4">
              <pre className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs overflow-x-auto border">
                <code className="text-slate-700 dark:text-slate-300">{embedCode}</code>
              </pre>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleCopyCode}
                data-testid="button-copy-code"
              >
                <Copy className="h-4 w-4 mr-2" />
                {copied ? "Copied" : "Copy code"}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                data-testid="button-send-instructions"
              >
                <Mail className="h-4 w-4 mr-2" />
                Send instructions via email
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-4 text-sm">
          <Link 
            href={`/settings/chat-widget/${widgetId}`}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back to web app
          </Link>
          <a 
            href="https://support.curbe.io" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Visit help center
          </a>
          <a 
            href="https://support.curbe.io/contact" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Contact support
          </a>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2">
        {!widgetOpen && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Hello, how can we help?</span>
            <button 
              onClick={() => setWidgetOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          </div>
        )}
        
        <div className="relative">
          {!widgetOpen && (
            <div className="absolute -top-16 -left-24 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
              <span className="italic">Click here<br/>to preview widget</span>
              <svg className="absolute -bottom-4 right-0 w-8 h-8" viewBox="0 0 24 24" fill="none">
                <path d="M12 5L12 19M12 19L19 12M12 19L5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(45 12 12)"/>
              </svg>
            </div>
          )}
          
          <button
            onClick={() => setWidgetOpen(!widgetOpen)}
            className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
            style={{ backgroundColor: currentColor.hex }}
            data-testid="button-widget-toggle"
          >
            {widgetOpen ? (
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <MessageSquare className="w-6 h-6 text-white" />
            )}
          </button>
        </div>
      </div>

      {widgetOpen && (
        <div className="fixed bottom-24 right-6 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <div 
            className="p-4 text-white"
            style={{ 
              background: `linear-gradient(135deg, ${currentColor.hex}, ${currentColor.hex}dd)` 
            }}
          >
            <h4 className="text-lg font-bold">{widget.welcomeTitle}</h4>
            <p className="text-sm opacity-90 mt-1">{widget.welcomeMessage}</p>
          </div>
          
          <div className="p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">How can we help you today?</p>
              <div className="border rounded-lg p-3">
                <p className="text-sm text-slate-400">Type your message here</p>
              </div>
            </div>
            
            <Button 
              className="w-full"
              style={{ backgroundColor: currentColor.hex }}
            >
              Start chat
            </Button>
            
            <div className="space-y-2 pt-2">
              <button className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium">Send a text</span>
                </div>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              
              <button className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium">Call us</span>
                </div>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="p-2 border-t text-center">
            <p className="text-xs text-slate-400">
              Powered by <span className="font-medium">Curbe</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
