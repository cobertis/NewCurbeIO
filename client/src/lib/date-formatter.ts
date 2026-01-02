/**
 * Date formatting utilities with timezone support
 */

/**
 * Get the browser's detected timezone as a fallback
 * @returns The browser's IANA timezone string
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Format a date with the user's timezone
 * @param date - Date to format (Date object or string)
 * @param timezone - User's timezone (e.g., 'America/New_York'). If not provided, uses browser's timezone
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDateWithTimezone(
  date: Date | string,
  timezone?: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const effectiveTimezone = timezone || getBrowserTimezone();
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
    timeZone: effectiveTimezone,
  };

  return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj);
}

/**
 * Format a date with time in the user's timezone
 * @param date - Date to format (Date object or string)
 * @param timezone - User's timezone (e.g., 'America/New_York'). If not provided, uses browser's timezone
 * @returns Formatted date and time string
 */
export function formatDateTimeWithTimezone(
  date: Date | string,
  timezone?: string
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const effectiveTimezone = timezone || getBrowserTimezone();
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: effectiveTimezone,
  }).format(dateObj);
}

/**
 * Format a date with time including seconds in the user's timezone
 * @param date - Date to format (Date object or string)
 * @param timezone - User's timezone (e.g., 'America/New_York'). If not provided, uses browser's timezone
 * @returns Formatted date and time string with seconds (e.g., "Jan 1, 2026, 7:52:34 PM")
 */
export function formatDateTimeWithSeconds(
  date: Date | string,
  timezone?: string
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const effectiveTimezone = timezone || getBrowserTimezone();
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone: effectiveTimezone,
  }).format(dateObj);
}

/**
 * Format a time in the user's timezone
 * @param date - Date to format (Date object or string)
 * @param timezone - User's timezone (e.g., 'America/New_York'). If not provided, uses browser's timezone
 * @returns Formatted time string
 */
export function formatTimeWithTimezone(
  date: Date | string,
  timezone?: string
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const effectiveTimezone = timezone || getBrowserTimezone();
  
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: effectiveTimezone,
  }).format(dateObj);
}

/**
 * Format a date (simple alias for formatDateWithTimezone)
 * @param date - Date to format (Date object or string)
 * @param timezone - User's timezone (optional)
 * @returns Formatted date string
 */
export function formatDate(date: Date | string, timezone?: string): string {
  return formatDateWithTimezone(date, timezone);
}

/**
 * Get a relative time string (e.g., "2 hours ago")
 * Note: This doesn't use timezone since it's relative
 * @param date - Date to format (Date object or string)
 * @returns Relative time string
 */
export function getTimeAgo(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((new Date().getTime() - dateObj.getTime()) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval !== 1 ? 's' : ''} ago`;
    }
  }
  
  return 'just now';
}
