import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Phone, 
  Mail, 
  MessageSquare, 
  PlayCircle, 
  ChevronRight, 
  Check,
  ExternalLink,
  HelpCircle,
  Smartphone,
  Send,
  Settings,
  Plus
} from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";

interface User {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  onboardingCompleted: boolean;
}

interface OnboardingProgress {
  profileCompleted: boolean;
  phoneSetup: boolean;
  emailSetup: boolean;
  messagingSetup: boolean;
}

export default function GettingStarted() {
  const [, setLocation] = useLocation();
  const [faqTab, setFaqTab] = useState("sms");

  const { data: sessionData, isLoading } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: progressData } = useQuery<OnboardingProgress>({
    queryKey: ["/api/onboarding/progress"],
    enabled: !!sessionData?.user,
  });

  const user = sessionData?.user;
  const progress = progressData || {
    profileCompleted: !!(user?.firstName && user?.lastName && user?.phone),
    phoneSetup: false,
    emailSetup: false,
    messagingSetup: false,
  };

  const faqItems = {
    sms: [
      {
        question: "What is the difference between 10DLC and toll-free numbers?",
        answer: "10DLC (10-Digit Long Code) numbers are standard local phone numbers optimized for application-to-person messaging. Toll-free numbers (800, 888, etc.) are better for high-volume messaging and have higher throughput limits."
      },
      {
        question: "When and why choose a toll-free number for texting?",
        answer: "Choose toll-free for high-volume campaigns, national reach, and professional branding. They offer faster sending speeds and don't require 10DLC registration."
      },
      {
        question: "How do I register my 10DLC campaign?",
        answer: "10DLC registration involves verifying your business and use case with carriers. This ensures better deliverability and compliance with messaging regulations."
      }
    ],
    email: [
      {
        question: "How do I set up my email sending domain?",
        answer: "Navigate to Settings > Email Configuration and add your custom domain. You'll need to add DNS records to verify ownership and enable DKIM/SPF."
      },
      {
        question: "What are the email sending limits?",
        answer: "New accounts start with 10,000 free emails. Limits increase based on your plan and sending reputation over time."
      },
      {
        question: "How can I improve my email deliverability?",
        answer: "Use verified domains, maintain a clean contact list, personalize content, and avoid spam trigger words. Monitor your bounce and complaint rates."
      }
    ],
    other: [
      {
        question: "Can I integrate my existing phone system?",
        answer: "Yes! You can connect numbers from Twilio, Sinch, Vonage, Telnyx, or Bandwidth through our integrations page."
      },
      {
        question: "How does the unified inbox work?",
        answer: "All messages from SMS, email, and other channels appear in a single inbox, organized by contact. Reply through any channel from one place."
      },
      {
        question: "Is my data secure?",
        answer: "Yes. We use enterprise-grade encryption, regular security audits, and comply with SOC 2 and GDPR requirements."
      }
    ]
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Welcome to Curbe!
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Let's get you set up with all your communication channels in just a few steps.
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-3" defaultValue="profile">
          <AccordionItem value="profile" className="border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]>div>svg]:rotate-0" data-testid="accordion-profile">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Complete your profile</span>
                  {progress.profileCompleted && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 ml-2">
                      <Check className="w-3 h-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              <div className="pl-11">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Add your personal details to personalize your experience and help your team identify you.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("https://youtu.be/example", "_blank")}
                    className="gap-2"
                    data-testid="button-watch-profile-tutorial"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Watch tutorial
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setLocation("/settings/profile")}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                    data-testid="button-complete-profile"
                  >
                    {progress.profileCompleted ? "Edit profile" : "Complete profile"}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sms" className="border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <AccordionTrigger className="px-5 py-4 hover:no-underline" data-testid="accordion-sms">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">SMS broadcasts</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              <div className="space-y-4 pl-11">
                <Card className="border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Get a Curbe number</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Choose your number from our available pool of numbers.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-2" data-testid="button-watch-number-tutorial">
                          <PlayCircle className="w-4 h-4" />
                          Watch tutorial
                        </Button>
                        <Button size="sm" onClick={() => setLocation("/phone-system")} className="gap-2 bg-blue-600 hover:bg-blue-700" data-testid="button-choose-number">
                          Choose number
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Smartphone className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Bring your own number</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Connect your number from Twilio, Sinch, Vonage, or Bandwidth.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-2" data-testid="button-watch-byod-tutorial">
                          <PlayCircle className="w-4 h-4" />
                          Watch tutorial
                        </Button>
                        <Button size="sm" onClick={() => setLocation("/integrations")} className="gap-2 bg-blue-600 hover:bg-blue-700" data-testid="button-connect-provider">
                          Connect provider
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="email" className="border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <AccordionTrigger className="px-5 py-4 hover:no-underline" data-testid="accordion-email">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Email campaigns</span>
                  <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 ml-2">
                    <Gift className="w-3 h-3 mr-1" />
                    First 10,000 emails free
                  </Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              <div className="space-y-4 pl-11">
                <Card className="border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Settings className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Configure email settings</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Set up your sending domain and customize email templates.
                          </p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => setLocation("/settings/email")} className="gap-2 bg-blue-600 hover:bg-blue-700" data-testid="button-configure-email">
                        Configure
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Send className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Create your first campaign</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Start engaging your contacts with email marketing.
                          </p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => setLocation("/campaigns")} className="gap-2 bg-blue-600 hover:bg-blue-700" data-testid="button-create-campaign">
                        <Plus className="w-4 h-4" />
                        Create campaign
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="other" className="border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <AccordionTrigger className="px-5 py-4 hover:no-underline" data-testid="accordion-other">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Other channels</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              <div className="space-y-4 pl-11">
                <Card className="border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <MessageSquare className="w-5 h-5 text-green-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">iMessage</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Connect your Apple device to send iMessages.
                          </p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => setLocation("/imessage")} className="gap-2 bg-blue-600 hover:bg-blue-700" data-testid="button-setup-imessage">
                        Set up
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <MessageSquare className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">WhatsApp Business</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Connect your WhatsApp Business account.
                          </p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => setLocation("/integrations")} className="gap-2 bg-blue-600 hover:bg-blue-700" data-testid="button-setup-whatsapp">
                        Connect
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-12 text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Getting started FAQ
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Haven't found what you were looking for?{" "}
            <a href="/support" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
              Contact us
            </a>
          </p>

          <Tabs value={faqTab} onValueChange={setFaqTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="sms" data-testid="tab-faq-sms">SMS</TabsTrigger>
              <TabsTrigger value="email" data-testid="tab-faq-email">Email</TabsTrigger>
              <TabsTrigger value="other" data-testid="tab-faq-other">Other channels</TabsTrigger>
            </TabsList>

            {Object.entries(faqItems).map(([key, items]) => (
              <TabsContent key={key} value={key} className="text-left">
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <Accordion key={index} type="single" collapsible>
                      <AccordionItem value={`faq-${index}`} className="border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                        <AccordionTrigger className="px-5 py-4 hover:no-underline text-left" data-testid={`faq-${key}-${index}`}>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {item.question}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-5 pb-4">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {item.answer}
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function Gift(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}
