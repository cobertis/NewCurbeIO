import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ComplianceSuccess() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/compliance/success/:id");
  const applicationId = params?.id;

  return (
    <div className="flex flex-col items-center justify-center p-6 py-12">
      <div className="max-w-2xl w-full text-center">
        <div className="mb-6">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4" data-testid="text-success-title">
          Thank you for the submission
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-8">
          We have received your toll-free verification details and are already reviewing them.
        </p>

        <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 mb-8 text-left">
          <CardContent className="p-8 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                When can I start using my toll-free number for texting?
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                The approval process <span className="font-semibold text-gray-900 dark:text-white">typically takes 3-5 business days</span>, though it may sometimes take longer. This timeline is beyond our control as an external messaging aggregator handles the approval.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                How can I view the status of my verification?
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                As soon as there's news about your application, we'll email you. You can also check the{" "}
                <a 
                  href="/phone-system" 
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  onClick={(e) => {
                    e.preventDefault();
                    setLocation("/phone-system");
                  }}
                  data-testid="link-verification-overview"
                >
                  Toll-free verification
                </a>{" "}
                overview page for status updates.
              </p>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={() => setLocation("/phone-system")}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          data-testid="button-back-to-app"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to the app
        </Button>
      </div>
    </div>
  );
}
