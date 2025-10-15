import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Mail, CheckCircle, XCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { z } from "zod";
import { useSearch } from "wouter";

const unsubscribeSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  token: z.string().optional(),
  campaignId: z.string().optional(),
});

type UnsubscribeForm = z.infer<typeof unsubscribeSchema>;

export default function Unsubscribe() {
  const searchParams = new URLSearchParams(useSearch());
  const emailFromUrl = searchParams.get("email");
  const tokenFromUrl = searchParams.get("token");
  const campaignIdFromUrl = searchParams.get("campaignId");
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasToken] = useState(!!tokenFromUrl);

  const form = useForm<UnsubscribeForm>({
    resolver: zodResolver(unsubscribeSchema),
    defaultValues: {
      email: emailFromUrl || "",
      token: tokenFromUrl || "",
      campaignId: campaignIdFromUrl || "",
    },
  });

  useEffect(() => {
    if (emailFromUrl) {
      form.setValue("email", emailFromUrl);
    }
    if (tokenFromUrl) {
      form.setValue("token", tokenFromUrl);
    }
    if (campaignIdFromUrl) {
      form.setValue("campaignId", campaignIdFromUrl);
    }
  }, [emailFromUrl, tokenFromUrl, campaignIdFromUrl, form]);

  const unsubscribeMutation = useMutation({
    mutationFn: async (data: UnsubscribeForm) => {
      return apiRequest("POST", "/api/unsubscribe", data);
    },
    onSuccess: () => {
      setIsSuccess(true);
    },
    onError: () => {
      form.setError("email", {
        message: "Failed to unsubscribe. Please check the email address and try again.",
      });
    },
  });

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Successfully Unsubscribed</CardTitle>
            <CardDescription className="text-base mt-2">
              You have been successfully removed from our email list. You will no longer receive campaign emails from us.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              If you change your mind, you can always re-subscribe by logging into your account settings.
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.href = "/"}
              className="w-full"
              data-testid="button-return-home"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Unsubscribe from Emails</CardTitle>
          <CardDescription className="text-base mt-2">
            {hasToken 
              ? "We're sorry to see you go. Confirm your email address below to unsubscribe from our campaign emails."
              : "We're sorry to see you go. Enter your email address below to unsubscribe from our campaign emails."
            }
          </CardDescription>
          {!hasToken && (
            <div className="mt-4 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                For best security, please use the unsubscribe link from your email campaign.
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => unsubscribeMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your.email@example.com"
                        {...field}
                        data-testid="input-unsubscribe-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input type="hidden" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="campaignId"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input type="hidden" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="h-4 w-4" />
                  <span>{form.formState.errors.root.message}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={unsubscribeMutation.isPending}
                data-testid="button-unsubscribe"
              >
                {unsubscribeMutation.isPending ? "Unsubscribing..." : "Unsubscribe"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              Changed your mind?{" "}
              <a href="/" className="text-primary hover:underline">
                Return to home
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
