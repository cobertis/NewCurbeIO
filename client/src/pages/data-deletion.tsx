import { Card, CardContent } from "@/components/ui/card";
import { Shield, Mail, Clock, Settings, CheckCircle } from "lucide-react";

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Data Deletion Instructions
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            In accordance with Meta Platform policies and applicable privacy regulations, you have the right to request the deletion of your data from Curbe.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                How to Disconnect Your Account
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                To disconnect Curbe from your Facebook or Instagram account:
              </p>
              <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-400 list-decimal list-inside">
                <li>Go to your Facebook Settings &gt; Apps and Websites</li>
                <li>Find "Curbe" in the list of active apps</li>
                <li>Click "Remove" to revoke access</li>
                <li>This will disconnect your account from our platform</li>
              </ol>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                Request Data Deletion
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                To request complete deletion of your data from our systems, please contact us:
              </p>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Email</p>
                <a 
                  href="mailto:privacy@curbe.io?subject=Data%20Deletion%20Request" 
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  data-testid="link-privacy-email"
                >
                  privacy@curbe.io
                </a>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                Please include your email address and any relevant account information in your request.
              </p>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Processing Timeline
              </h2>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-amber-800 dark:text-amber-200 text-sm">
                  Your data deletion request will be processed within <strong>30 days</strong> of receipt. You will receive an email confirmation once the deletion is complete.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                What Data Will Be Deleted
              </h2>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">&#10003;</span>
                  Your Facebook/Instagram connection data
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">&#10003;</span>
                  Messages and conversations associated with your account
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">&#10003;</span>
                  Profile information obtained from Meta platforms
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">&#10003;</span>
                  Any stored access tokens and authentication data
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-slate-500 dark:text-slate-400 space-y-2">
          <p>
            For questions about our privacy practices, please visit our{" "}
            <a href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
          </p>
          <p>
            Curbe.io - A product of Curbe Technologies LLC
          </p>
        </div>
      </div>
    </div>
  );
}
