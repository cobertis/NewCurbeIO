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
    
    // Using ip-api.com - free, 45 req/min, no API key required
    const response = await fetch(`http://ip-api.com/json/${cleanIP}?fields=status,message,country,countryCode,region,regionName,city`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`[Geolocation] HTTP error for IP ${cleanIP}: ${response.status}`);
      return { city: null, region: null, country: null, countryCode: null, success: false };
    }

    const data = await response.json() as { 
      status: string; 
      message?: string;
      country?: string; 
      countryCode?: string;
      region?: string;
      regionName?: string;
      city?: string;
    };
    
    if (data.status === "success") {
      const result: FullGeolocationResult = {
        city: data.city || null,
        region: data.regionName || null,
        country: data.country || null,
        countryCode: data.countryCode || null,
        success: true,
      };
      fullCache.set(cleanIP, { result, timestamp: Date.now() });
      console.log(`[Geolocation] Success for IP ${cleanIP}: ${result.city}, ${result.region}, ${result.country}`);
      return result;
    }
    
    console.error(`[Geolocation] API returned failure for IP ${cleanIP}: ${data.message}`);
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
