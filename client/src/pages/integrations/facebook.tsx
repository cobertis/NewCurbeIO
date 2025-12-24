import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle } from "lucide-react";
import { SiFacebook } from "react-icons/si";

export default function FacebookIntegrationPage() {
  const [, setLocation] = useLocation();

  const benefits = [
    "View all chats in a unified inbox",
    "See full message history",
    "Collaborate on chats with your team",
  ];

  const faqs = [
    {
      question: "What is the Facebook channel?",
      answer: "The Facebook channel allows you to connect your Facebook Business Page to receive and respond to messages from your customers directly within Curbe. This creates a unified inbox for all your customer communications."
    },
    {
      question: "How can Facebook integration help my business?",
      answer: "Facebook integration helps you manage customer conversations more efficiently by centralizing all messages in one place. Your team can collaborate on responses, track conversation history, and ensure no customer inquiry goes unanswered."
    },
    {
      question: "Can I connect multiple Facebook Pages?",
      answer: "Yes, you can connect multiple Facebook Pages to your Curbe account. Each page's messages will appear in your unified inbox, allowing you to manage all your business communications from a single dashboard."
    },
    {
      question: "Do I need special tools to use Facebook with this system?",
      answer: "No special tools are required. You just need to be an admin of the Facebook Page you want to connect. The integration process is simple and guided - just click 'Get started' and follow the steps."
    },
    {
      question: "Can my team handle Facebook messages together?",
      answer: "Absolutely! Once connected, all team members with access to your Curbe account can view and respond to Facebook messages. You can assign conversations to specific team members and track who responded to which customer."
    },
  ];

  return (
    <div className="space-y-8" data-testid="page-facebook-integration">
      <div>
        <h1 className="text-2xl font-semibold">Facebook</h1>
      </div>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-8">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="flex-1 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">
                  Connect your Facebook page to manage messages
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Handle messages from your Facebook audience in one place. Stay organized, track chats, and respond faster.
                </p>
              </div>

              <div className="space-y-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-slate-700 dark:text-slate-300">{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => setLocation("/integrations/facebook/flow")}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-get-started"
                >
                  Get started
                </Button>
                <Button 
                  variant="outline"
                  data-testid="button-learn-more"
                >
                  Learn more
                </Button>
              </div>
            </div>

            <div className="w-full lg:w-80 flex-shrink-0">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-4 right-4">
                  <SiFacebook className="h-8 w-8 text-blue-600" />
                </div>
                <div className="space-y-3 mt-8">
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-600">KR</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Kate Reyes</p>
                        <p className="text-xs text-slate-500">New chat</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Hi, I have received your promo. But I have some questions about it. Can you help?
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white rounded-lg p-2 text-xs max-w-[80%]">
                      Of course! How can I help you today?
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-1">Facebook FAQ</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Haven't found what you were looking for?{" "}
            <a href="/support" className="text-blue-600 hover:underline">Contact us</a>
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="border-slate-200 dark:border-slate-800"
            >
              <AccordionTrigger 
                className="text-left hover:no-underline py-4"
                data-testid={`accordion-faq-${index}`}
              >
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-slate-600 dark:text-slate-400">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
