/**
 * Appointment Availability Service
 * 
 * This service manages appointment scheduling by:
 * - Generating available time slots within business hours
 * - Checking conflicts against existing appointments and calendar events
 * - Preventing duplicate appointments
 * - Handling timezone conversions
 */

import { db } from "../db";
import { landingAppointments, landingPages, companies } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { 
  format, 
  addMinutes
} from "date-fns";

// Type for weekly availability
interface DayAvailability {
  enabled: boolean;
  slots: Array<{ start: string; end: string }>;
}

interface WeeklyAvailability {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

/**
 * Configuration
 */
const DEFAULT_BUSINESS_START = 9; // 9 AM
const DEFAULT_BUSINESS_END = 17; // 5 PM
const DEFAULT_BUFFER_MINUTES = 5; // Buffer time between appointments
const DEFAULT_TIMEZONE = "UTC";

/**
 * Interface for a time slot
 */
export interface TimeSlot {
  time: string; // HH:mm format
  available: boolean;
  reason?: string; // If unavailable: "booked", "conflict", "outside_hours", "buffer"
}

/**
 * Interface for calendar event (from /api/calendar/events)
 */
interface CalendarEvent {
  type: "birthday" | "reminder";
  date: string; // yyyy-MM-dd
  dueTime?: string; // HH:mm (for reminders)
  title?: string;
  description?: string;
}

/**
 * Parse time string (HH:mm) to hours and minutes
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours, minutes };
}

/**
 * Check if two time ranges overlap
 * 
 * NOTE: This function assumes both time ranges are in the same timezone.
 * In this system, all HH:mm times represent company local time, ensuring
 * consistent comparisons.
 * 
 * @param start1 Start time of first range (HH:mm in company timezone)
 * @param end1 End time of first range (HH:mm in company timezone)
 * @param start2 Start time of second range (HH:mm in company timezone)
 * @param end2 End time of second range (HH:mm in company timezone)
 * @returns true if ranges overlap
 */
function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = parseTime(start1);
  const e1 = parseTime(end1);
  const s2 = parseTime(start2);
  const e2 = parseTime(end2);

  // Convert to minutes since midnight for easier comparison
  const s1Mins = s1.hours * 60 + s1.minutes;
  const e1Mins = e1.hours * 60 + e1.minutes;
  const s2Mins = s2.hours * 60 + s2.minutes;
  const e2Mins = e2.hours * 60 + e2.minutes;

  // Check if ranges overlap
  return s1Mins < e2Mins && e1Mins > s2Mins;
}

/**
 * Calculate end time given start time and duration
 * @param startTime Start time (HH:mm)
 * @param durationMinutes Duration in minutes
 * @returns End time (HH:mm)
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const { hours, minutes } = parseTime(startTime);
  const baseDate = new Date();
  baseDate.setHours(hours, minutes, 0, 0);
  
  const endDate = addMinutes(baseDate, durationMinutes);
  return format(endDate, "HH:mm");
}

/**
 * Interface for time range
 */
interface TimeRange {
  start: string; // HH:mm
  end: string;   // HH:mm
}

/**
 * Generate all possible time slots based on user's availability configuration
 * 
 * @param date Date in yyyy-MM-dd format
 * @param slotDuration Duration of each slot in minutes
 * @param availableRanges Array of time ranges when user is available
 * @returns Array of time strings in HH:mm format (in company timezone)
 */
function generateTimeSlotsFromRanges(
  date: string,
  slotDuration: number,
  availableRanges: TimeRange[]
): string[] {
  const slots: string[] = [];
  
  // Generate slots for each available time range
  for (const range of availableRanges) {
    const { hours: startHour, minutes: startMinute } = parseTime(range.start);
    const { hours: endHour, minutes: endMinute } = parseTime(range.end);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    // Generate slots within this range
    for (let currentMinutes = startMinutes; currentMinutes < endMinutes; currentMinutes += slotDuration) {
      // Check if this slot would end after the range end
      if (currentMinutes + slotDuration > endMinutes) break;
      
      const hour = Math.floor(currentMinutes / 60);
      const minute = currentMinutes % 60;
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      slots.push(timeString);
    }
  }
  
  return slots;
}

/**
 * Generate all possible time slots for a day using default business hours
 * (fallback when user has no availability configuration)
 * 
 * @param date Date in yyyy-MM-dd format
 * @param slotDuration Duration of each slot in minutes
 * @param timezone Company timezone
 * @returns Array of time strings in HH:mm format (in company timezone)
 */
function generateDefaultTimeSlots(
  date: string,
  slotDuration: number,
  timezone: string
): string[] {
  return generateTimeSlotsFromRanges(date, slotDuration, [
    { start: '09:00', end: '17:00' }
  ]);
}

/**
 * Fetch calendar events for a specific date and company
 * This simulates calling /api/calendar/events but queries the database directly
 */
async function getCalendarEventsForDate(
  date: string,
  companyId: string
): Promise<CalendarEvent[]> {
  try {
    // Import storage to access reminders
    const { storage } = await import("../storage");
    
    const events: CalendarEvent[] = [];
    
    // Get quote reminders for this date
    const quoteReminders = await storage.getQuoteRemindersByCompany(companyId);
    for (const reminder of quoteReminders) {
      if (
        (reminder.status === "pending" || reminder.status === "snoozed") &&
        reminder.dueDate === date
      ) {
        events.push({
          type: "reminder",
          date: reminder.dueDate,
          dueTime: reminder.dueTime,
          title: reminder.title || reminder.reminderType,
          description: reminder.description || "",
        });
      }
    }
    
    // Get policy reminders for this date
    const policyReminders = await storage.getPolicyRemindersByCompany(companyId);
    for (const reminder of policyReminders) {
      if (
        (reminder.status === "pending" || reminder.status === "snoozed") &&
        reminder.dueDate === date
      ) {
        events.push({
          type: "reminder",
          date: reminder.dueDate,
          dueTime: reminder.dueTime,
          title: reminder.title || reminder.reminderType,
          description: reminder.description || "",
        });
      }
    }
    
    // Note: Birthdays are recurring and don't block specific times,
    // so we don't include them as blocking events
    
    return events;
  } catch (error) {
    console.error("[APPOINTMENT-SERVICE] Error fetching calendar events:", error);
    return [];
  }
}

/**
 * Get available time slots for appointments
 * 
 * @param params.date - Date in yyyy-MM-dd format
 * @param params.userId - User ID (for future use with user-specific calendars)
 * @param params.companyId - Company ID to check timezone and existing appointments
 * @param params.duration - Duration in minutes (30 or 60), defaults to 30
 * @returns Array of time slots with availability status
 */
export async function getAvailableSlots(params: {
  date: string;
  userId: string;
  companyId: string;
  duration?: number;
}): Promise<TimeSlot[]> {
  const { date, userId, companyId, duration = 30 } = params;
  
  try {
    // Validate duration
    if (duration !== 30 && duration !== 60) {
      throw new Error("Duration must be 30 or 60 minutes");
    }
    
    // Get company timezone
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
    });
    
    const timezone = company?.timezone || DEFAULT_TIMEZONE;
    
    // Get user's availability configuration
    const { storage } = await import("../storage");
    const availability = await storage.getAppointmentAvailability(userId);
    
    let allSlots: string[];
    let hasCustomAvailability = false;
    
    if (availability) {
      // Determine the day of week for the requested date
      const dateObj = new Date(date + 'T00:00:00');
      const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // Map day of week to day key
      const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayKey = dayKeys[dayOfWeek] as keyof WeeklyAvailability;
      
      // Cast weeklyAvailability to the correct type
      const weeklyAvailability = availability.weeklyAvailability as WeeklyAvailability;
      const dayConfig = weeklyAvailability[dayKey];
      
      // If day is disabled, return empty array (no slots available)
      if (!dayConfig || !dayConfig.enabled || !dayConfig.slots || dayConfig.slots.length === 0) {
        return [];
      }
      
      // Use the configured availability duration instead of the passed duration
      const slotDuration = availability.appointmentDuration as number || duration;
      
      // Generate slots from user's configured time ranges
      allSlots = generateTimeSlotsFromRanges(date, slotDuration, dayConfig.slots);
      hasCustomAvailability = true;
    } else {
      // No availability configuration, use default business hours
      allSlots = generateDefaultTimeSlots(date, duration, timezone);
    }
    
    // Get all landing pages for this company
    const companyLandingPages = await db.query.landingPages.findMany({
      where: eq(landingPages.companyId, companyId),
      columns: { id: true },
    });
    
    const landingPageIds = companyLandingPages.map(page => page.id);
    
    // Get existing appointments for this date and company (excluding cancelled)
    // Only query if there are landing pages for this company
    let existingAppointments: any[] = [];
    if (landingPageIds.length > 0) {
      existingAppointments = await db.query.landingAppointments.findMany({
        where: and(
          eq(landingAppointments.appointmentDate, date),
          inArray(landingAppointments.landingPageId, landingPageIds),
          sql`${landingAppointments.status} != 'cancelled'`
        ),
      });
    }
    
    // Get calendar events for this date
    const calendarEvents = await getCalendarEventsForDate(date, companyId);
    
    // Check each slot for availability
    const timeSlots: TimeSlot[] = allSlots.map((slotTime) => {
      const slotEndTime = calculateEndTime(slotTime, duration);
      
      // Only check business hours when using default configuration
      // If user has custom availability, their configured hours are already respected
      if (!hasCustomAvailability) {
        const { hours: slotHour } = parseTime(slotTime);
        const { hours: endHour, minutes: endMinutes } = parseTime(slotEndTime);
        
        if (slotHour < DEFAULT_BUSINESS_START || endHour > DEFAULT_BUSINESS_END) {
          return {
            time: slotTime,
            available: false,
            reason: "outside_hours",
          };
        }
        
        // Special case: if end time is exactly at business end and minutes are 0, it's okay
        if (endHour === DEFAULT_BUSINESS_END && endMinutes > 0) {
          return {
            time: slotTime,
            available: false,
            reason: "outside_hours",
          };
        }
      }
      
      // Check against existing appointments (including buffer time)
      // Note: All appointment times are stored in company timezone (HH:mm format)
      for (const appointment of existingAppointments) {
        // Skip cancelled appointments
        if (appointment.status === "cancelled") {
          continue;
        }
        
        const appointmentEndTime = calculateEndTime(
          appointment.appointmentTime,
          appointment.duration
        );
        
        // Add buffer time to appointment
        const bufferedEndTime = calculateEndTime(
          appointment.appointmentTime,
          appointment.duration + DEFAULT_BUFFER_MINUTES
        );
        
        // Check if slot overlaps with appointment + buffer
        // Both slotTime and appointment.appointmentTime are in company timezone
        if (
          timeRangesOverlap(
            slotTime,
            slotEndTime,
            appointment.appointmentTime,
            bufferedEndTime
          )
        ) {
          return {
            time: slotTime,
            available: false,
            reason: "booked",
          };
        }
      }
      
      // Check against calendar events (reminders with specific times)
      // Note: All calendar event times are stored in company timezone (HH:mm format)
      for (const event of calendarEvents) {
        if (event.type === "reminder" && event.dueTime) {
          // Assume reminders block 30 minutes
          const eventDuration = 30;
          const eventEndTime = calculateEndTime(event.dueTime, eventDuration);
          
          // Add buffer time to event
          const bufferedEventEndTime = calculateEndTime(
            event.dueTime,
            eventDuration + DEFAULT_BUFFER_MINUTES
          );
          
          // Check if slot overlaps with event + buffer
          // Both slotTime and event.dueTime are in company timezone
          if (
            timeRangesOverlap(
              slotTime,
              slotEndTime,
              event.dueTime,
              bufferedEventEndTime
            )
          ) {
            return {
              time: slotTime,
              available: false,
              reason: "conflict",
            };
          }
        }
      }
      
      // Slot is available
      return {
        time: slotTime,
        available: true,
      };
    });
    
    return timeSlots;
  } catch (error) {
    console.error("[APPOINTMENT-SERVICE] Error getting available slots:", error);
    throw error;
  }
}

/**
 * Check if a specific time slot is available
 * 
 * @param params.date - Date in yyyy-MM-dd format
 * @param params.time - Time in HH:mm format
 * @param params.userId - User ID
 * @param params.companyId - Company ID
 * @param params.duration - Duration in minutes
 * @returns true if slot is available, false otherwise
 */
export async function isSlotAvailable(params: {
  date: string;
  time: string;
  userId: string;
  companyId: string;
  duration: number;
}): Promise<boolean> {
  const { date, time, userId, companyId, duration } = params;
  
  try {
    // Get all available slots for the date
    const slots = await getAvailableSlots({
      date,
      userId,
      companyId,
      duration,
    });
    
    // Find the specific slot
    const slot = slots.find((s) => s.time === time);
    
    // Return availability status
    return slot?.available ?? false;
  } catch (error) {
    console.error("[APPOINTMENT-SERVICE] Error checking slot availability:", error);
    return false;
  }
}

/**
 * Check if an appointment is a duplicate
 * 
 * An appointment is considered a duplicate if there's an existing appointment with:
 * - Same landing page ID
 * - Same email
 * - Same date
 * - Same time
 * - Status is not "cancelled"
 * 
 * @param params.landingPageId - Landing page ID
 * @param params.email - Email address
 * @param params.appointmentDate - Appointment date (yyyy-MM-dd)
 * @param params.appointmentTime - Appointment time (HH:mm)
 * @returns true if duplicate exists, false otherwise
 */
export async function isDuplicateAppointment(params: {
  landingPageId: string;
  email: string;
  appointmentDate: string;
  appointmentTime: string;
}): Promise<boolean> {
  const { landingPageId, email, appointmentDate, appointmentTime } = params;
  
  try {
    // Query for existing appointment with same criteria
    const existingAppointment = await db.query.landingAppointments.findFirst({
      where: and(
        eq(landingAppointments.landingPageId, landingPageId),
        eq(landingAppointments.email, email),
        eq(landingAppointments.appointmentDate, appointmentDate),
        eq(landingAppointments.appointmentTime, appointmentTime)
      ),
    });
    
    // If appointment exists and is not cancelled, it's a duplicate
    if (existingAppointment && existingAppointment.status !== "cancelled") {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("[APPOINTMENT-SERVICE] Error checking for duplicate appointment:", error);
    // In case of error, return false to allow the appointment
    // (better to allow than to incorrectly block)
    return false;
  }
}
