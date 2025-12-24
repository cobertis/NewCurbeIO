interface GeolocationResult {
  countryCode: string;
  countryName: string;
  success: boolean;
}

const cache = new Map<string, { result: GeolocationResult; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

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
