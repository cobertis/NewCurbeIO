import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";
import { SettingsLayout } from "@/components/settings-layout";

export default function SmsVoiceCpaas() {
  return (
    <SettingsLayout activeSection="sms-voice">
      <div className="space-y-6" data-testid="page-sms-voice-cpaas">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/settings" className="hover:text-slate-700 dark:hover:text-slate-300">
            Settings
          </Link>
          <span>&gt;</span>
          <Link href="/settings/sms-voice" className="hover:text-slate-700 dark:hover:text-slate-300">
            SMS & voice
          </Link>
          <span>&gt;</span>
          <span className="text-slate-700 dark:text-slate-300">Bring Your Own CPaaS</span>
        </div>

        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100" data-testid="text-page-title">
            Bring Your Own CPaaS
          </h1>
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Construction className="h-12 w-12 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Under Construction
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                We're working hard to bring you the CPaaS integration feature. 
                This page will allow you to connect your own CPaaS providers like Twilio, Vonage, and more.
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Check back soon for updates.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}
