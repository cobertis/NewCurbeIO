import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Cake, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";

interface CalendarEvent {
  type: 'birthday' | 'reminder';
  date: string;
  title: string;
  description: string;
  quoteId: string;
  personName?: string;
  role?: string;
  reminderId?: string;
  reminderType?: string;
  priority?: string;
  status?: string;
  dueTime?: string;
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [, setLocation] = useLocation();

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
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">Loading calendar...</p>
        </div>
      </div>
    );
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
          <Button data-testid="button-new-event">
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
                          key={`${event.quoteId}-${eventIndex}`}
                          className="flex items-start gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                          title={`${event.title} - ${event.role}\nClick to view quote`}
                          onClick={() => setLocation(`/quotes/${event.quoteId}`)}
                          data-testid={`event-birthday-${eventIndex}`}
                        >
                          <Cake className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="truncate flex-1">{event.title}</span>
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
                      const displayText = event.title || event.description || event.reminderType?.replace(/_/g, ' ') || 'Reminder';
                      const tooltipText = [
                        displayText,
                        event.description && event.title !== event.description ? event.description : null,
                        event.dueTime ? `at ${event.dueTime}` : null,
                        `${event.priority || 'medium'} priority`,
                        'Click to view quote'
                      ].filter(Boolean).join('\n');
                      
                      return (
                        <div
                          key={`${event.reminderId}-${eventIndex}`}
                          className={`flex items-start gap-1 px-1.5 py-0.5 rounded text-xs cursor-pointer transition-colors ${colorClass}`}
                          title={tooltipText}
                          onClick={() => setLocation(`/quotes/${event.quoteId}`)}
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
    </div>
  );
}
