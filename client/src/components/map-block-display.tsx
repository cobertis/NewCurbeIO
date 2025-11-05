import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, AlertCircle } from "lucide-react";

interface MapBlockDisplayProps {
  placeId?: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  zoomLevel?: number;
  height?: string;
  showButton?: boolean;
  buttonColor?: string;
}

// Global types for Google Maps
declare global {
  interface Window {
    google?: any;
  }
}

// Loader state
let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: Array<() => void> = [];

// Load Google Maps script
function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (scriptLoaded && window.google?.maps?.Map) {
      resolve();
      return;
    }

    // Add to queue
    loadCallbacks.push(() => resolve());

    // Already loading
    if (scriptLoading) {
      return;
    }

    scriptLoading = true;

    // Check if script already exists
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      // Wait for it to load
      waitForGoogleMaps().then(() => {
        scriptLoaded = true;
        scriptLoading = false;
        loadCallbacks.forEach(cb => cb());
        loadCallbacks.length = 0;
      }).catch(reject);
      return;
    }

    // Load our loader script
    const script = document.createElement('script');
    script.src = '/api/google-maps-js-loader';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      waitForGoogleMaps()
        .then(() => {
          scriptLoaded = true;
          scriptLoading = false;
          loadCallbacks.forEach(cb => cb());
          loadCallbacks.length = 0;
        })
        .catch(reject);
    };

    script.onerror = () => {
      scriptLoading = false;
      reject(new Error('Failed to load Google Maps'));
    };

    document.head.appendChild(script);
  });
}

// Wait for Google Maps to be fully loaded
function waitForGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds max

    const check = () => {
      attempts++;

      // Check if google.maps.Map is a constructor
      if (window.google?.maps?.Map && typeof window.google.maps.Map === 'function') {
        try {
          // Try to instantiate to verify it works
          const test = window.google.maps.Map.toString();
          if (test.includes('function') || test.includes('class')) {
            resolve();
            return;
          }
        } catch (e) {
          // Not ready yet
        }
      }

      if (attempts >= maxAttempts) {
        reject(new Error('Timeout waiting for Google Maps'));
        return;
      }

      setTimeout(check, 100);
    };

    check();
  });
}

export function MapBlockDisplay({
  placeId,
  latitude,
  longitude,
  formattedAddress,
  zoomLevel = 15,
  height = "300px",
  showButton = true,
  buttonColor = "#2563EB",
}: MapBlockDisplayProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    // No coordinates? No map.
    if (!latitude || !longitude) {
      setIsLoading(false);
      setError(null);
      return;
    }

    let mounted = true;

    async function initMap() {
      if (!mapRef.current) return;

      try {
        setIsLoading(true);
        setError(null);

        // Load Google Maps
        await loadGoogleMapsScript();

        if (!mounted) return;

        // Double check
        if (!window.google?.maps?.Map) {
          throw new Error('Google Maps not available');
        }

        // Verify Map is a constructor
        if (typeof window.google.maps.Map !== 'function') {
          throw new Error('Google Maps not fully initialized');
        }

        const position = { lat: latitude, lng: longitude };

        // Create map
        const map = new window.google.maps.Map(mapRef.current, {
          center: position,
          zoom: zoomLevel,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
        });

        // Create marker
        const marker = new window.google.maps.Marker({
          position: position,
          map: map,
          title: formattedAddress || "Location",
        });

        // Add info window
        if (formattedAddress) {
          const infoWindow = new window.google.maps.InfoWindow({
            content: `<div style="padding: 8px; font-family: sans-serif;">
              <strong>${formattedAddress}</strong>
            </div>`,
          });

          marker.addListener("click", () => {
            infoWindow.open(map, marker);
          });
        }

        if (mounted) {
          mapInstanceRef.current = map;
          setIsLoading(false);
          setError(null);
        }
      } catch (err: any) {
        console.error("[MAP] Error:", err);
        if (mounted) {
          if (err.message?.includes('ApiNotActivatedMapError')) {
            setError('Maps API not enabled in Google Cloud Console');
          } else if (err.message?.includes('ApiTargetBlockedMapError')) {
            setError('API key restriction error');
          } else if (err.message?.includes('not a constructor')) {
            setError('Google Maps still loading, please wait...');
          } else {
            setError(err.message || 'Failed to load map');
          }
          setIsLoading(false);
        }
      }
    }

    initMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude, formattedAddress, zoomLevel]);

  if (!latitude || !longitude) {
    return (
      <div
        className="relative bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300"
        style={{ height }}
      >
        <div className="text-center px-4">
          <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Select a location to display the map</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="relative bg-red-50 dark:bg-red-900/20 rounded-xl overflow-hidden flex items-center justify-center border-2 border-red-200"
        style={{ height }}
      >
        <div className="text-center px-4">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
          {error.includes('Google Cloud Console') && (
            <p className="text-xs text-gray-500 mt-2">
              Enable "Maps JavaScript API" in Google Cloud Console
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden shadow-lg" style={{ height }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      
      {showButton && formattedAddress && !isLoading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formattedAddress)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg shadow-lg text-sm font-medium transition-all hover:shadow-xl transform hover:scale-105"
            style={{ backgroundColor: buttonColor }}
            data-testid="button-see-location"
          >
            <MapPin className="w-4 h-4" />
            See Our Location
          </a>
        </div>
      )}
    </div>
  );
}