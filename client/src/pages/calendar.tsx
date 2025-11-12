import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Cake, Bell, Calendar as CalendarIcon, Settings, List, Grid3x3, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LoadingSpinner } from "@/components/loading-spinner";
import { NewEventDialog } from "@/components/new-event-dialog";

interface CalendarEvent {
  type: 'birthday' | 'reminder' | 'appointment' | 'holiday';
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
  countryCode?: string;
  global?: boolean;
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
  const [viewMode, setViewMode] = useState<'month' | 'listWeek'>('month');

  // Read initialView from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialView = params.get('initialView');
    if (initialView === 'listWeek') {
      setViewMode('listWeek');
    }
  }, []);

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

  // Get week range for list view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 }); // Saturday
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Navigate to previous month/week
  const goToPrevious = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, -1));
    }
  };

  // Navigate to next month/week
  const goToNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
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

  // Helper function to format time with AM/PM
  const formatTimeWithAMPM = (time: string): string => {
    // Parse time in format "HH:mm" or "HH:mm:ss"
    const [hours, minutes] = time.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) {
      return time; // Return original if parsing fails
    }
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
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
              onClick={goToPrevious}
              data-testid="button-previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goToNext}
              data-testid="button-next"
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
            {viewMode === 'month' 
              ? format(currentDate, "MMMM yyyy")
              : `${format(weekStart, "MMM dd")} - ${format(weekEnd, "MMM dd, yyyy")}`
            }
          </h2>
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
              data-testid="button-view-month"
              className="h-8"
            >
              <Grid3x3 className="h-4 w-4 mr-1" />
              Month
            </Button>
            <Button
              variant={viewMode === 'listWeek' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('listWeek')}
              data-testid="button-view-list-week"
              className="h-8"
            >
              <List className="h-4 w-4 mr-1" />
              Week
            </Button>
          </div>
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

      {/* Calendar Views */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {viewMode === 'month' ? (
          <>
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
                    } else if (event.type === 'holiday') {
                      return (
                        <TooltipProvider key={`holiday-${eventIndex}`}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="flex items-start gap-1 px-1.5 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-200"
                                data-testid={`event-holiday-${eventIndex}`}
                              >
                                <Flag className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span className="truncate flex-1">{event.title}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{event.title}</p>
                              {event.description && event.description !== event.title && (
                                <p className="text-xs text-muted-foreground">{event.description}</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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
                                  <span className="font-semibold">{formatTimeWithAMPM(event.appointmentTime)}</span>
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
          </>
        ) : (
          // Week List View
          <div className="flex-1 overflow-auto">
            <div className="space-y-2">
              {weekDays.map((day, dayIndex) => {
                const isTodayDate = isToday(day);
                const dayEvents = getEventsForDay(day);

                return (
                  <div
                    key={dayIndex}
                    className={`bg-card border rounded-lg p-4 ${isTodayDate ? 'ring-2 ring-primary' : ''}`}
                    data-testid={`list-day-${format(day, 'yyyy-MM-dd')}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`text-center ${isTodayDate ? 'text-primary' : 'text-muted-foreground'}`}>
                          <div className="text-xs font-medium uppercase">{format(day, 'EEE')}</div>
                          <div className="text-2xl font-bold">{format(day, 'd')}</div>
                        </div>
                        <div>
                          <h3 className="font-semibold">{format(day, 'MMMM d, yyyy')}</h3>
                          <p className="text-sm text-muted-foreground">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </div>

                    {dayEvents.length > 0 ? (
                      <div className="space-y-2">
                        {dayEvents.map((event, eventIndex) => {
                          if (event.type === 'birthday') {
                            return (
                              <div
                                key={`${event.personName}-${eventIndex}`}
                                className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                onClick={() => {
                                  if (event.policyId) {
                                    setLocation(`/policies/${event.policyId}`);
                                  } else if (event.quoteId) {
                                    setLocation(`/quotes/${event.quoteId}`);
                                  }
                                }}
                                data-testid={`list-event-birthday-${eventIndex}`}
                              >
                                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                                  <Cake className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-blue-900 dark:text-blue-100">{event.title}</h4>
                                  <p className="text-sm text-blue-700 dark:text-blue-300">{event.role}</p>
                                </div>
                              </div>
                            );
                          } else if (event.type === 'holiday') {
                            return (
                              <TooltipProvider key={`list-holiday-${eventIndex}`}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
                                      data-testid={`event-holiday-${eventIndex}`}
                                    >
                                      <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center">
                                        <Flag className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-purple-900 dark:text-purple-100">{event.title}</h4>
                                        {event.description && event.description !== event.title && (
                                          <p className="text-sm text-purple-700 dark:text-purple-300">{event.description}</p>
                                        )}
                                        {event.global && (
                                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">National Holiday</p>
                                        )}
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">{event.title}</p>
                                    {event.description && event.description !== event.title && (
                                      <p className="text-xs text-muted-foreground">{event.description}</p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          } else if (event.type === 'appointment') {
                            const statusColors = {
                              pending: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
                              confirmed: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30',
                              cancelled: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30',
                              completed: 'bg-gray-50 dark:bg-gray-800/20 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800/30',
                            };
                            const bgClass = statusColors[event.status as keyof typeof statusColors] || statusColors.pending;

                            return (
                              <div
                                key={`${event.appointmentId}-${eventIndex}`}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${bgClass}`}
                                onClick={() => handleAppointmentClick(event)}
                                data-testid={`list-event-appointment-${eventIndex}`}
                              >
                                <div className="flex-shrink-0 w-10 h-10 bg-white/50 dark:bg-black/20 rounded-full flex items-center justify-center">
                                  <CalendarIcon className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium">{event.title}</h4>
                                    <Badge variant={getStatusVariant(event.status)}>
                                      {getStatusLabel(event.status)}
                                    </Badge>
                                  </div>
                                  {event.appointmentTime && (
                                    <p className="text-sm font-medium mb-1">{formatTimeWithAMPM(event.appointmentTime)}</p>
                                  )}
                                  {event.appointmentPhone && (
                                    <p className="text-sm text-muted-foreground">
                                      {(() => {
                                        const cleaned = event.appointmentPhone.replace(/\D/g, "");
                                        if (cleaned.length === 10) {
                                          return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
                                        }
                                        return event.appointmentPhone;
                                      })()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          } else {
                            const priorityColors = {
                              urgent: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30',
                              high: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30',
                              medium: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
                              low: 'bg-gray-50 dark:bg-gray-800/20 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800/30',
                            };
                            const bgClass = priorityColors[event.priority as keyof typeof priorityColors] || priorityColors.medium;

                            return (
                              <div
                                key={`${event.reminderId}-${eventIndex}`}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${bgClass}`}
                                onClick={() => handleReminderClick(event)}
                                data-testid={`list-event-reminder-${eventIndex}`}
                              >
                                <div className="flex-shrink-0 w-10 h-10 bg-white/50 dark:bg-black/20 rounded-full flex items-center justify-center">
                                  <Bell className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium">
                                    {event.title || event.description || event.reminderType?.replace(/_/g, ' ') || 'Reminder'}
                                    {event.clientName && ` - ${event.clientName}`}
                                  </h4>
                                  {event.dueTime && (
                                    <p className="text-sm font-medium mb-1">{event.dueTime}</p>
                                  )}
                                  {event.description && event.title !== event.description && (
                                    <p className="text-sm text-muted-foreground">{event.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {event.priority || 'medium'} priority
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No events for this day</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
                    {selectedAppointment.time && ` at ${formatTimeWithAMPM(selectedAppointment.time)}`}
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
