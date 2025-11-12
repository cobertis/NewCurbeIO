import { formatInTimeZone } from 'date-fns-tz';

interface PublicHoliday {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
}

// TTL cache for holidays (24 hours)
interface CacheEntry {
  data: PublicHoliday[];
  timestamp: number;
}

const holidayCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Fetch public holidays for a given country and year
 * Uses Nager.Date API - completely free, no API key required
 * Implements 24-hour TTL caching
 */
export async function getPublicHolidays(countryCode: string = 'US', year: number = new Date().getFullYear()): Promise<PublicHoliday[]> {
  const cacheKey = `${countryCode}-${year}`;
  
  // Check if cached data exists and is still valid
  const cached = holidayCache.get(cacheKey);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_TTL) {
      console.log(`[HOLIDAYS] Cache hit for ${countryCode} ${year} (age: ${Math.round(age / 1000 / 60)}m)`);
      return cached.data;
    } else {
      console.log(`[HOLIDAYS] Cache expired for ${countryCode} ${year} (age: ${Math.round(age / 1000 / 60)}m)`);
      holidayCache.delete(cacheKey);
    }
  }

  try {
    console.log(`[HOLIDAYS] Fetching holidays from API for ${countryCode} ${year}`);
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
    
    if (!response.ok) {
      console.error(`[HOLIDAYS] Failed to fetch holidays: ${response.status} ${response.statusText}`);
      return [];
    }

    const holidays: PublicHoliday[] = await response.json();
    
    // Cache the results with timestamp
    holidayCache.set(cacheKey, {
      data: holidays,
      timestamp: Date.now(),
    });
    
    console.log(`[HOLIDAYS] Fetched and cached ${holidays.length} holidays for ${countryCode} ${year}`);
    
    return holidays;
  } catch (error) {
    console.error('[HOLIDAYS] Error fetching public holidays:', error);
    return [];
  }
}

/**
 * Get holidays for the calendar view
 * Returns holidays in a format suitable for the calendar
 */
export async function getCalendarHolidays(countryCode: string = 'US', year: number = new Date().getFullYear()): Promise<Array<{
  type: 'holiday';
  date: string;
  title: string;
  description: string;
  countryCode: string;
  global: boolean;
}>> {
  const holidays = await getPublicHolidays(countryCode, year);
  
  return holidays.map(holiday => ({
    type: 'holiday' as const,
    date: holiday.date,
    title: holiday.name,
    description: holiday.localName,
    countryCode: holiday.countryCode,
    global: holiday.global,
  }));
}

/**
 * Clear the holiday cache (useful for testing or manual refresh)
 */
export function clearHolidayCache(): void {
  holidayCache.clear();
}
