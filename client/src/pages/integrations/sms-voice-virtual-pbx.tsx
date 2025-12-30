import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Construction, ChevronRight } from "lucide-react";
import { SettingsLayout } from "@/components/settings-layout";

export default function SmsVoiceVirtualPbx() {
  return (
    <SettingsLayout activeSection="sms-voice">
      <div className="space-y-6" data-testid="page-sms-voice-virtual-pbx">
        <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-sms-pbx">
          <Link href="/settings/sms-voice" className="text-muted-foreground hover:text-foreground transition-colors">SMS & Voice</Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Virtual PBX</span>
        </div>

        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100" data-testid="text-page-title">
            Virtual PBX
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
                We're working hard to bring you the Virtual PBX feature. 
                This page will allow you to configure and manage your virtual phone system.
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
