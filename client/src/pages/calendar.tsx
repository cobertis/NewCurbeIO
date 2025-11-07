import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Cake, Bell, Calendar as CalendarIcon, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LoadingSpinner } from "@/components/loading-spinner";
import { NewEventDialog } from "@/components/new-event-dialog";

interface CalendarEvent {
  type: 'birthday' | 'reminder' | 'appointment';
  date: string;
  title: string;
  description: string;
  quoteId?: string;
  policyId?: string;
  personName?: string;
  role?: string;
  reminderId?: string;
  reminderType?: string;
  priority?: string;
  status?: string;
  dueTime?: string;
  appointmentId?: string;
  appointmentTime?: string;
  appointmentPhone?: string;
  appointmentEmail?: string;
  clientName?: string;
}

interface AppointmentDetails {
  id?: string;
  date: string;
  time?: string;
  clientName: string;
  phone?: string;
  email?: string;
  notes?: string;
  status?: string;
}

interface ReminderDetails {
  id?: string;
  type: 'reminder' | 'task';
  title: string;
  description: string;
  date: string;
  time?: string;
  priority?: string;
  status?: string;
  quoteId?: string;
  policyId?: string;
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [, setLocation] = useLocation();
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDetails | null>(null);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<ReminderDetails | null>(null);
  const [newEventDialogOpen, setNewEventDialogOpen] = useState(false);

  // Fetch calendar events
  const { data: eventsData, isLoading } = useQuery<{ events: CalendarEvent[] }>({
    queryKey: ["/api/calendar/events"],
  });

  // Get the start and end of the current month
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  // Get the start and end of the calendar view (including days from previous/next month)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  
  // Get all days to display in the calendar
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  // Navigate to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Helper function for status badge variants
  const getStatusVariant = (status?: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'pending': return 'default';
      case 'confirmed': return 'outline';
      case 'cancelled': return 'destructive';
      case 'completed': return 'secondary';
      default: return 'default';
    }
  };

  // Helper function for status labels
  const getStatusLabel = (status?: string): string => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'confirmed': return 'Confirmada';
      case 'cancelled': return 'Cancelada';
      case 'completed': return 'Completada';
      default: return status || 'Pendiente';
    }
  };

  // Handle appointment click
  const handleAppointmentClick = (event: CalendarEvent) => {
    setSelectedAppointment({
      id: event.appointmentId?.toString(),
      date: event.date,
      time: event.appointmentTime,
      clientName: event.title.replace('Appointment with ', ''),
      phone: event.appointmentPhone,
      email: event.appointmentEmail,
      notes: event.description,
      status: event.status,
    });
    setAppointmentDialogOpen(true);
  };

  // Handle reminder/task click
  const handleReminderClick = (event: CalendarEvent) => {
    setSelectedReminder({
      id: event.reminderId,
      type: event.type === 'reminder' ? 'reminder' : 'task',
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.dueTime,
      priority: event.priority,
      status: event.status,
      quoteId: event.quoteId,
      policyId: event.policyId,
    });
    setReminderDialogOpen(true);
  };

  // Group events by date
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  if (eventsData?.events) {
    eventsData.events.forEach((event) => {
      // For birthdays, we need to match the month and day only (recurring annually)
      if (event.type === 'birthday') {
        // Parse date string directly to avoid timezone issues
        // Format is yyyy-MM-dd, e.g., "2000-10-09"
        const [yearStr, monthStr, dayStr] = event.date.split('-');
        const eventMonth = parseInt(monthStr, 10); // 1-12
        const eventDay = parseInt(dayStr, 10);     // 1-31
        
        // Check all calendar days to find matching birthdays
        calendarDays.forEach((day) => {
          // getMonth() returns 0-11, so add 1 to compare
          // getDate() returns 1-31, same as our parsed day
          if (day.getMonth() + 1 === eventMonth && day.getDate() === eventDay) {
            const dateKey = format(day, "yyyy-MM-dd");
            if (!eventsByDate[dateKey]) {
              eventsByDate[dateKey] = [];
            }
            eventsByDate[dateKey].push(event);
          }
        });
      } else {
        // Reminders are shown only on their exact date
        const dateKey = event.date;
        if (!eventsByDate[dateKey]) {
          eventsByDate[dateKey] = [];
        }
        eventsByDate[dateKey].push(event);
      }
    });
  }

  // Get events for a specific day
  const getEventsForDay = (day: Date): CalendarEvent[] => {
    const dateKey = format(day, "yyyy-MM-dd");
    return eventsByDate[dateKey] || [];
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading calendar..." />;
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={goToPreviousMonth}
              data-testid="button-previous-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goToNextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={goToToday}
            data-testid="button-today"
          >
            Today
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-medium">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <Button
            variant="outline"
            onClick={() => setLocation("/calendar/settings")}
            data-testid="button-appointment-config"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure Availability
          </Button>
          <Button onClick={() => setNewEventDialogOpen(true)} data-testid="button-new-event">
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-px bg-border mb-px">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="bg-muted px-4 py-3 text-center text-sm font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days grid */}
        <div className="flex-1 grid grid-cols-7 gap-px bg-border overflow-hidden">
          {calendarDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);
            const dayEvents = getEventsForDay(day);

            return (
              <div
                key={index}
                className={`
                  bg-background p-2 overflow-y-auto
                  ${!isCurrentMonth ? "bg-muted/30" : ""}
                  ${isTodayDate ? "bg-primary/5" : ""}
                `}
                data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`
                      text-sm font-medium
                      ${!isCurrentMonth ? "text-muted-foreground" : ""}
                      ${isTodayDate ? "bg-primary text-primary-foreground rounded-full h-7 w-7 flex items-center justify-center" : ""}
                    `}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                {/* Events */}
                <div className="space-y-1">
                  {dayEvents.map((event, eventIndex) => {
                    if (event.type === 'birthday') {
                      return (
                        <div
                          key={`${event.quoteId || event.policyId}-${eventIndex}`}
                          className="flex items-start gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                          title={`${event.title} - ${event.role}\nClick to view ${event.policyId ? 'policy' : 'quote'}`}
                          onClick={() => {
                            if (event.policyId) {
                              setLocation(`/policies/${event.policyId}`);
                            } else if (event.quoteId) {
                              setLocation(`/quotes/${event.quoteId}`);
                            }
                          }}
                          data-testid={`event-birthday-${eventIndex}`}
                        >
                          <Cake className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="truncate flex-1">{event.title}</span>
                        </div>
                      );
                    } else if (event.type === 'appointment') {
                      // Appointment - color based on status
                      const statusColors = {
                        pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 border-l-2 border-yellow-500',
                        confirmed: 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/50 border-l-2 border-green-500',
                        cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/50 border-l-2 border-red-500',
                        completed: 'bg-gray-100 dark:bg-gray-800/30 text-gray-900 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800/50 border-l-2 border-gray-500',
                      };
                      const colorClass = statusColors[event.status as keyof typeof statusColors] || statusColors.pending;
                      
                      return (
                        <div
                          key={`${event.appointmentId}-${eventIndex}`}
                          className={`appointment-event px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${colorClass}`}
                          onClick={() => handleAppointmentClick(event)}
                          data-testid={`event-appointment-${event.appointmentId}`}
                        >
                          <div className="flex items-start gap-1">
                            <CalendarIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{event.title}</div>
                              {event.appointmentTime && (
                                <div className="text-[10px] mt-0.5 flex items-center gap-1">
                                  <span className="font-semibold">{event.appointmentTime}</span>
                                  {event.appointmentPhone && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate">
                                        {(() => {
                                          const cleaned = event.appointmentPhone.replace(/\D/g, "");
                                          if (cleaned.length === 10) {
                                            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
                                          }
                                          return event.appointmentPhone;
                                        })()}
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      // Reminder - color based on priority
                      const priorityColors = {
                        urgent: 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/50',
                        high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-200 hover:bg-orange-200 dark:hover:bg-orange-900/50',
                        medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
                        low: 'bg-gray-100 dark:bg-gray-800/30 text-gray-900 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800/50',
                      };
                      const colorClass = priorityColors[event.priority as keyof typeof priorityColors] || priorityColors.medium;
                      
                      // Show title or description, not just reminder type
                      const baseTitle = event.title || event.description || event.reminderType?.replace(/_/g, ' ') || 'Reminder';
                      const displayText = event.clientName ? `${baseTitle} - ${event.clientName}` : baseTitle;
                      const tooltipText = [
                        displayText,
                        event.description && event.title !== event.description ? event.description : null,
                        event.dueTime ? `at ${event.dueTime}` : null,
                        `${event.priority || 'medium'} priority`,
                        `Click to view ${event.policyId ? 'policy' : 'quote'}`
                      ].filter(Boolean).join('\n');
                      
                      return (
                        <div
                          key={`${event.reminderId}-${eventIndex}`}
                          className={`flex items-start gap-1 px-1.5 py-0.5 rounded text-xs cursor-pointer transition-colors ${colorClass}`}
                          title={tooltipText}
                          onClick={() => handleReminderClick(event)}
                          data-testid={`event-reminder-${eventIndex}`}
                        >
                          <Bell className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="truncate flex-1">{displayText}</span>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Appointment Details Dialog */}
      <Dialog open={appointmentDialogOpen} onOpenChange={setAppointmentDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-appointment-details">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogDescription>
              View appointment information
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg" data-testid="text-appointment-client">
                    {selectedAppointment.clientName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedAppointment.date), "MMMM d, yyyy")}
                    {selectedAppointment.time && ` at ${selectedAppointment.time}`}
                  </p>
                </div>
                <Badge variant={getStatusVariant(selectedAppointment.status)} data-testid="badge-appointment-status">
                  {getStatusLabel(selectedAppointment.status)}
                </Badge>
              </div>

              <div className="space-y-3 pt-2">
                {selectedAppointment.phone && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="text-sm" data-testid="text-appointment-phone">
                      {(() => {
                        const cleaned = selectedAppointment.phone.replace(/\D/g, "");
                        if (cleaned.length === 10) {
                          return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
                        }
                        return selectedAppointment.phone;
                      })()}
                    </p>
                  </div>
                )}
                
                {selectedAppointment.email && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="text-sm" data-testid="text-appointment-email">{selectedAppointment.email}</p>
                  </div>
                )}

                {selectedAppointment.notes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Notes</label>
                    <p className="text-sm" data-testid="text-appointment-notes">{selectedAppointment.notes}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setAppointmentDialogOpen(false)}
                  data-testid="button-close-appointment"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reminder/Task Details Dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-reminder-details">
          <DialogHeader>
            <DialogTitle>Reminder Details</DialogTitle>
            <DialogDescription>
              View reminder information
            </DialogDescription>
          </DialogHeader>
          {selectedReminder && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg" data-testid="text-reminder-title">
                    {selectedReminder.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedReminder.date), "MMMM d, yyyy")}
                    {selectedReminder.time && ` at ${selectedReminder.time}`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                {selectedReminder.status && (
                  <Badge variant={getStatusVariant(selectedReminder.status)} data-testid="badge-reminder-status">
                    {getStatusLabel(selectedReminder.status)}
                  </Badge>
                )}
                {selectedReminder.priority && (
                  <Badge variant="outline" data-testid="badge-reminder-priority">
                    {selectedReminder.priority} priority
                  </Badge>
                )}
              </div>

              <div className="space-y-3 pt-2">
                {selectedReminder.description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <p className="text-sm" data-testid="text-reminder-description">{selectedReminder.description}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4">
                {(selectedReminder.quoteId || selectedReminder.policyId) && (
                  <Button
                    variant="default"
                    onClick={() => {
                      if (selectedReminder.policyId) {
                        setLocation(`/policies/${selectedReminder.policyId}`);
                      } else if (selectedReminder.quoteId) {
                        setLocation(`/quotes/${selectedReminder.quoteId}`);
                      }
                      setReminderDialogOpen(false);
                    }}
                    data-testid="button-view-related"
                  >
                    View {selectedReminder.policyId ? 'Policy' : 'Quote'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setReminderDialogOpen(false)}
                  className={!selectedReminder.quoteId && !selectedReminder.policyId ? 'ml-auto' : ''}
                  data-testid="button-close-reminder"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* New Event Dialog */}
      <NewEventDialog open={newEventDialogOpen} onOpenChange={setNewEventDialogOpen} />
    </div>
  );
}
