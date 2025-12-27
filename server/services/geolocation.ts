interface GeolocationResult {
  countryCode: string;
  countryName: string;
  success: boolean;
}

interface FullGeolocationResult {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  success: boolean;
}

const cache = new Map<string, { result: GeolocationResult; timestamp: number }>();
const fullCache = new Map<string, { result: FullGeolocationResult; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

export async function getFullGeolocationFromIP(ip: string): Promise<FullGeolocationResult> {
  const cleanIP = ip.replace(/^::ffff:/, "");
  
  if (cleanIP === "127.0.0.1" || cleanIP === "::1" || cleanIP === "localhost" || cleanIP.startsWith("192.168.") || cleanIP.startsWith("10.")) {
    return { city: null, region: null, country: null, countryCode: null, success: false };
  }

  const cached = fullCache.get(cleanIP);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // Using FreeIPAPI.com - free, 60 req/min, commercial use allowed
    const response = await fetch(`https://freeipapi.com/api/json/${cleanIP}`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`[Geolocation] HTTP error for IP ${cleanIP}: ${response.status}`);
      return { city: null, region: null, country: null, countryCode: null, success: false };
    }

    const data = await response.json() as { 
      ipAddress?: string;
      cityName?: string;
      regionName?: string;
      countryName?: string;
      countryCode?: string;
    };
    
    if (data.ipAddress) {
      const result: FullGeolocationResult = {
        city: data.cityName || null,
        region: data.regionName || null,
        country: data.countryName || null,
        countryCode: data.countryCode || null,
        success: true,
      };
      fullCache.set(cleanIP, { result, timestamp: Date.now() });
      console.log(`[Geolocation] Success for IP ${cleanIP}: ${result.city}, ${result.region}, ${result.country}`);
      return result;
    }
    
    console.error(`[Geolocation] API returned no data for IP ${cleanIP}`);
    return { city: null, region: null, country: null, countryCode: null, success: false };
  } catch (error) {
    console.error(`[Geolocation] Error fetching location for IP ${cleanIP}:`, error);
    return { city: null, region: null, country: null, countryCode: null, success: false };
  }
}

export async function getCountryFromIP(ip: string): Promise<GeolocationResult> {
  const cleanIP = ip.replace(/^::ffff:/, "");
  
  if (cleanIP === "127.0.0.1" || cleanIP === "::1" || cleanIP === "localhost") {
    return { countryCode: "US", countryName: "United States", success: true };
  }

  const cached = cache.get(cleanIP);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`http://ip-api.com/json/${cleanIP}?fields=status,country,countryCode`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { countryCode: "", countryName: "", success: false };
    }

    const data = await response.json() as { status: string; country?: string; countryCode?: string };
    
    if (data.status === "success" && data.country && data.countryCode) {
      const result: GeolocationResult = {
        countryCode: data.countryCode,
        countryName: data.country,
        success: true,
      };
      cache.set(cleanIP, { result, timestamp: Date.now() });
      return result;
    }
    
    return { countryCode: "", countryName: "", success: false };
  } catch (error) {
    console.error("Geolocation error:", error);
    return { countryCode: "", countryName: "", success: false };
  }
}

export function shouldShowWidget(
  targeting: {
    countries?: "all" | "selected" | "excluded";
    selectedCountries?: string[];
  } | undefined,
  visitorCountry: string,
  geoSuccess: boolean
): boolean {
  if (!targeting || targeting.countries === "all" || !targeting.countries) {
    return true;
  }

  const selectedCountries = targeting.selectedCountries || [];
  
  if (selectedCountries.length === 0) {
    return true;
  }

  if (!geoSuccess || !visitorCountry) {
    return true;
  }

  const countryMatch = selectedCountries.some(
    (c) => c.toLowerCase() === visitorCountry.toLowerCase()
  );

  if (targeting.countries === "selected") {
    return countryMatch;
  }
  
  if (targeting.countries === "excluded") {
    return !countryMatch;
  }

  return true;
}
