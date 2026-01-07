import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Mail, Phone, FileText } from "lucide-react";

const supportOptions = [
  {
    title: "Documentation",
    description: "Browse our comprehensive guides and tutorials.",
    icon: FileText,
    action: "View Docs",
  },
  {
    title: "Email Support",
    description: "Get help from our support team via email.",
    icon: Mail,
    action: "Send Email",
  },
  {
    title: "Live Chat",
    description: "Chat with our support team in real-time.",
    icon: MessageSquare,
    action: "Start Chat",
  },
  {
    title: "Phone Support",
    description: "Call us for immediate assistance.",
    icon: Phone,
    action: "Call Now",
  },
];

export default function Support() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {supportOptions.map((option) => (
          <Card key={option.title} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <option.icon className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-base font-medium">{option.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{option.description}</p>
              <Button variant="outline" size="sm" className="w-full" data-testid={`button-${option.action.toLowerCase().replace(/\s+/g, '-')}`}>
                {option.action}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Contact Support</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" placeholder="How can we help?" data-testid="input-subject" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Describe your issue or question..."
                rows={6}
                data-testid="textarea-message"
              />
            </div>
            <Button data-testid="button-submit-support">Submit Request</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
