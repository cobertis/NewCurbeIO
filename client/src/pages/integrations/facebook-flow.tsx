import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MessageCircle, Clock } from "lucide-react";
import { SiFacebook } from "react-icons/si";
import { SettingsLayout } from "@/components/settings-layout";

export default function FacebookFlowPage() {
  const [, setLocation] = useLocation();

  const handleLoginWithFacebook = () => {
    // TODO: Implement Facebook OAuth flow
    console.log("Initiating Facebook login...");
  };

  const handleDiscard = () => {
    setLocation("/settings/facebook");
  };

  return (
    <SettingsLayout activeSection="facebook">
    <div className="space-y-6" data-testid="page-facebook-flow">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <Link href="/settings">
          <span className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            Settings
          </span>
        </Link>
        <span className="text-slate-400">&gt;</span>
        <span>Facebook</span>
      </div>

      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <SiFacebook className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-xl font-semibold">Connect Facebook page</h1>
            </div>
            <Button 
              variant="outline" 
              onClick={handleDiscard}
              className="bg-white dark:bg-slate-800"
              data-testid="button-discard"
            >
              Discard
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6 max-w-3xl">
        <div className="flex gap-6">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium text-sm">
              1
            </div>
            <div className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700 mt-2"></div>
          </div>
          
          <div className="flex-1 pb-8">
            <h2 className="text-lg font-semibold mb-2">Connect Facebook account</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
              Follow these steps to connect your Facebook pages and start receiving Facebook conversations directly in Curbe.
            </p>

            <div className="space-y-4">
              <div className="flex gap-3">
                <SiFacebook className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Connect your Facebook page</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    To connect a Facebook page, you <span className="font-semibold">must be an admin</span> of the page. If you don't have one, you can create it during setup.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <MessageCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Receive direct messages</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Receive chats from users who contact your page and respond to them directly from Curbe.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Reply window</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    You will have 24 hours to respond to messages received from customers.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Button 
                onClick={handleLoginWithFacebook}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-login-facebook"
              >
                <SiFacebook className="h-4 w-4 mr-2" />
                Login with Facebook
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center font-medium text-sm">
              2
            </div>
          </div>
          
          <div className="flex-1">
            <h2 className="text-lg font-medium text-blue-600">Facebook page</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Select the Facebook page you want to connect after logging in.
            </p>
          </div>
        </div>
      </div>
    </div>
    </SettingsLayout>
  );
}
