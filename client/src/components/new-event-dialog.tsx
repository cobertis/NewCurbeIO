import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertManualBirthdaySchema, insertStandaloneReminderSchema, insertAppointmentSchema } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Cake, Clock, User } from "lucide-react";
import { format } from "date-fns";

// Define form schemas for validation
const birthdayFormSchema = z.object({
  clientName: z.string().min(1, "Client name is required").max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format"),
  role: z.enum(["Primary", "Spouse", "Dependent"]),
  quoteId: z.string().optional(),
  policyId: z.string().optional(),
});

const reminderFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format"),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:mm format").optional().or(z.literal("")).transform((val) => val || undefined),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["pending", "completed", "snoozed"]).default("pending"),
  quoteId: z.string().optional(),
  policyId: z.string().optional(),
});

const appointmentFormSchema = z.object({
  clientName: z.string().min(1, "Client name is required").max(100),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format"),
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format"),
  phone: z.string().max(20).optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  notes: z.string().max(1000).optional(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]).default("pending"),
});

type BirthdayFormData = z.infer<typeof birthdayFormSchema>;
type ReminderFormData = z.infer<typeof reminderFormSchema>;
type AppointmentFormData = z.infer<typeof appointmentFormSchema>;

interface NewEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewEventDialog({ open, onOpenChange }: NewEventDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("birthday");

  // Birthday form
  const birthdayForm = useForm<BirthdayFormData>({
    resolver: zodResolver(birthdayFormSchema),
    defaultValues: {
      clientName: "",
      dateOfBirth: "",
      role: "Primary",
    },
  });

  // Reminder form
  const reminderForm = useForm<ReminderFormData>({
    resolver: zodResolver(reminderFormSchema),
    defaultValues: {
      title: "",
      description: "",
      dueDate: "",
      dueTime: "",
      priority: "medium",
      status: "pending",
    },
  });

  // Appointment form
  const appointmentForm = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      clientName: "",
      appointmentDate: "",
      appointmentTime: "",
      phone: "",
      email: "",
      notes: "",
      status: "pending",
    },
  });

  // Birthday mutation
  const createBirthdayMutation = useMutation({
    mutationFn: (data: BirthdayFormData) =>
      apiRequest("POST", "/api/calendar/events/birthday", data),
    onSuccess: () => {
      toast({
        title: "Birthday Event Created",
        description: "The birthday event has been added to your calendar.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      birthdayForm.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create birthday event",
        variant: "destructive",
      });
    },
  });

  // Reminder mutation
  const createReminderMutation = useMutation({
    mutationFn: (data: ReminderFormData) =>
      apiRequest("POST", "/api/calendar/events/reminder", data),
    onSuccess: () => {
      toast({
        title: "Reminder Created",
        description: "The reminder has been added to your calendar.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      reminderForm.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create reminder",
        variant: "destructive",
      });
    },
  });

  // Appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: (data: AppointmentFormData) =>
      apiRequest("POST", "/api/calendar/events/appointment", data),
    onSuccess: () => {
      toast({
        title: "Appointment Created",
        description: "The appointment has been added to your calendar.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      appointmentForm.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create appointment",
        variant: "destructive",
      });
    },
  });

  // Form submit handlers
  const onBirthdaySubmit = (data: BirthdayFormData) => {
    createBirthdayMutation.mutate(data);
  };

  const onReminderSubmit = (data: ReminderFormData) => {
    createReminderMutation.mutate(data);
  };

  const onAppointmentSubmit = (data: AppointmentFormData) => {
    createAppointmentMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-new-event">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Create New Event</DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            Add a birthday, reminder, or appointment to your calendar
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-event-type">
            <TabsTrigger value="birthday" data-testid="tab-birthday">
              <Cake className="h-4 w-4 mr-2" />
              Birthday
            </TabsTrigger>
            <TabsTrigger value="reminder" data-testid="tab-reminder">
              <Clock className="h-4 w-4 mr-2" />
              Reminder
            </TabsTrigger>
            <TabsTrigger value="appointment" data-testid="tab-appointment">
              <User className="h-4 w-4 mr-2" />
              Appointment
            </TabsTrigger>
          </TabsList>

          {/* Birthday Form */}
          <TabsContent value="birthday" data-testid="content-birthday">
            <Form {...birthdayForm}>
              <form onSubmit={birthdayForm.handleSubmit(onBirthdaySubmit)} className="space-y-4">
                <FormField
                  control={birthdayForm.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
                          {...field}
                          data-testid="input-birthday-client-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={birthdayForm.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth *</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-birthday-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={birthdayForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-birthday-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Primary" data-testid="option-role-primary">Primary</SelectItem>
                          <SelectItem value="Spouse" data-testid="option-role-spouse">Spouse</SelectItem>
                          <SelectItem value="Dependent" data-testid="option-role-dependent">Dependent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createBirthdayMutation.isPending}
                    data-testid="button-submit-birthday"
                  >
                    {createBirthdayMutation.isPending ? "Creating..." : "Create Birthday Event"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* Reminder Form */}
          <TabsContent value="reminder" data-testid="content-reminder">
            <Form {...reminderForm}>
              <form onSubmit={reminderForm.handleSubmit(onReminderSubmit)} className="space-y-4">
                <FormField
                  control={reminderForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Reminder title"
                          {...field}
                          data-testid="input-reminder-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={reminderForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional details..."
                          {...field}
                          data-testid="input-reminder-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={reminderForm.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            data-testid="input-reminder-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={reminderForm.control}
                    name="dueTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Time</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            data-testid="input-reminder-time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={reminderForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-reminder-priority">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low" data-testid="option-priority-low">Low</SelectItem>
                            <SelectItem value="medium" data-testid="option-priority-medium">Medium</SelectItem>
                            <SelectItem value="high" data-testid="option-priority-high">High</SelectItem>
                            <SelectItem value="urgent" data-testid="option-priority-urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={reminderForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-reminder-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending" data-testid="option-status-pending">Pending</SelectItem>
                            <SelectItem value="completed" data-testid="option-status-completed">Completed</SelectItem>
                            <SelectItem value="snoozed" data-testid="option-status-snoozed">Snoozed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createReminderMutation.isPending}
                    data-testid="button-submit-reminder"
                  >
                    {createReminderMutation.isPending ? "Creating..." : "Create Reminder"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* Appointment Form */}
          <TabsContent value="appointment" data-testid="content-appointment">
            <Form {...appointmentForm}>
              <form onSubmit={appointmentForm.handleSubmit(onAppointmentSubmit)} className="space-y-4">
                <FormField
                  control={appointmentForm.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
                          {...field}
                          data-testid="input-appointment-client-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={appointmentForm.control}
                    name="appointmentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            data-testid="input-appointment-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={appointmentForm.control}
                    name="appointmentTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time *</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            data-testid="input-appointment-time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={appointmentForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="(555) 123-4567"
                            {...field}
                            data-testid="input-appointment-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={appointmentForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john@example.com"
                            {...field}
                            data-testid="input-appointment-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={appointmentForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes..."
                          {...field}
                          data-testid="input-appointment-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={appointmentForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-appointment-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending" data-testid="option-appointment-status-pending">Pending</SelectItem>
                          <SelectItem value="confirmed" data-testid="option-appointment-status-confirmed">Confirmed</SelectItem>
                          <SelectItem value="cancelled" data-testid="option-appointment-status-cancelled">Cancelled</SelectItem>
                          <SelectItem value="completed" data-testid="option-appointment-status-completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createAppointmentMutation.isPending}
                    data-testid="button-submit-appointment"
                  >
                    {createAppointmentMutation.isPending ? "Creating..." : "Create Appointment"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
