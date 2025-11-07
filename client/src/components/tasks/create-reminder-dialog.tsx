import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStandaloneReminderSchema, type InsertStandaloneReminder } from "@shared/schema";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Info } from "lucide-react";
import { format } from "date-fns";
import type { User } from "@shared/schema";

interface CreateReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertStandaloneReminder) => void;
  isPending: boolean;
}

// Predefined reminder types
const REMINDER_TYPES = [
  "Income Verification",
  "Follow up call",
  "Document Review",
  "Policy Renewal",
  "Client Meeting",
  "Application Status Check",
  "Birthday Call",
  "Annual Review",
  "Payment Reminder",
  "Custom"
];

// Set reminder before options
const SET_REMINDER_OPTIONS = [
  { value: "0", label: "At time of event" },
  { value: "15", label: "15 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "120", label: "2 hours before" },
  { value: "1440", label: "1 day before" },
  { value: "2880", label: "2 days before" },
  { value: "10080", label: "1 week before" },
];

export function CreateReminderDialog({ open, onOpenChange, onSubmit, isPending }: CreateReminderDialogProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: usersData } = useQuery<{ users: User[] }>({
    queryKey: ["/api/users"],
  });

  const currentUser = sessionData?.user;
  const allUsers = usersData?.users || [];

  const form = useForm<InsertStandaloneReminder>({
    resolver: zodResolver(insertStandaloneReminderSchema),
    defaultValues: {
      dueDate: "",
      dueTime: "09:00",
      timezone: "America/New_York",
      setReminderBefore: "60",
      reminderType: "",
      notifyUserIds: [],
      description: "",
      isPrivate: false,
      priority: "medium",
      status: "pending",
      title: "",
    },
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      form.reset({
        dueDate: "",
        dueTime: "09:00",
        timezone: "America/New_York",
        setReminderBefore: "60",
        reminderType: "",
        notifyUserIds: [],
        description: "",
        isPrivate: false,
        priority: "medium",
        status: "pending",
        title: "",
      });
      setSelectedUsers([]);
    }
  }, [open, form]);

  const handleSubmit = (data: InsertStandaloneReminder) => {
    // Set title from reminderType if not custom
    const submissionData = {
      ...data,
      title: data.reminderType,
      notifyUserIds: selectedUsers.length > 0 ? selectedUsers : undefined,
    };
    onSubmit(submissionData);
  };

  // Generate time options (every 15 minutes)
  const timeOptions: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      timeOptions.push(`${h}:${m}`);
    }
  }

  // Format time to display with AM/PM
  const formatTimeDisplay = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Toggle user selection for multi-select
  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="dialog-create-reminder">
        <DialogHeader>
          <DialogTitle>Create a new reminder</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Due Date and Due Time - Side by Side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Due Date */}
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-1">
                      Due date <span className="text-red-500">*</span>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </FormLabel>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            data-testid="button-select-due-date"
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {field.value ? format(new Date(field.value + "T00:00:00"), "MM/dd/yyyy") : "mm/dd/yyyy"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value ? new Date(field.value + "T00:00:00") : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              field.onChange(`${year}-${month}-${day}`);
                              setCalendarOpen(false);
                            }
                          }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Due Time */}
              <FormField
                control={form.control}
                name="dueTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Due time <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "09:00"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-due-time">
                          <div className="flex items-center">
                            <Clock className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="hh:mm" />
                          </div>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px]">
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>
                            {formatTimeDisplay(time)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Time Zone (readonly) */}
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time zone</FormLabel>
                  <FormControl>
                    <Input {...field} disabled className="bg-muted" data-testid="input-timezone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Set Reminder Before */}
            <FormField
              control={form.control}
              name="setReminderBefore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    Set reminder
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "60"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-reminder-before">
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SET_REMINDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* What is this reminder for? */}
            <FormField
              control={form.control}
              name="reminderType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    What is this reminder for? <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-reminder-type">
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REMINDER_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Who should be notified? */}
            <FormItem>
              <FormLabel>Who should be notified?</FormLabel>
              <div className="border rounded-md p-3 space-y-2 max-h-[150px] overflow-y-auto">
                {allUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Loading users...</p>
                ) : (
                  allUsers.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={() => toggleUser(user.id)}
                        data-testid={`checkbox-notify-user-${user.id}`}
                      />
                      <label
                        htmlFor={`user-${user.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {user.firstName} {user.lastName} ({user.email})
                      </label>
                    </div>
                  ))
                )}
              </div>
              {selectedUsers.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedUsers.length} user(s) selected
                </p>
              )}
            </FormItem>

            {/* Description/Comments */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description/Comments <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="(optional) Type here more details about this reminder..."
                      rows={4}
                      data-testid="textarea-reminder-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Private Reminder */}
            <FormField
              control={form.control}
              name="isPrivate"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-private-reminder"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer">
                      Private reminder (it will be only visible by you)
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-close-dialog"
              >
                Close
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit-reminder">
                {isPending ? <LoadingSpinner message="" fullScreen={false} /> : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
