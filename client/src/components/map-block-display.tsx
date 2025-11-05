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
    google?: {
      maps?: {
        importLibrary?: (library: string) => Promise<any>;
        Map?: any;
        Marker?: any;
        marker?: {
          AdvancedMarkerElement?: any;
        };
        InfoWindow?: any;
      };
    };
  }
}

// Loader state management
let loaderPromise: Promise<void> | null = null;
let isLoaded = false;

// Load Google Maps using the modern importLibrary method
async function loadGoogleMaps(): Promise<void> {
  // Already loaded
  if (isLoaded && window.google?.maps?.Map) {
    return;
  }

  // Already loading
  if (loaderPromise) {
    return loaderPromise;
  }

  loaderPromise = new Promise((resolve, reject) => {
    // Check if already exists
    if (window.google?.maps?.importLibrary) {
      isLoaded = true;
      resolve();
      return;
    }

    // Create bootstrap loader script
    const script = document.createElement('script');
    script.src = '/api/google-maps-js-loader';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // Wait a bit for Google to initialize
      const checkGoogle = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkGoogle);
          isLoaded = true;
          resolve();
        }
      }, 50);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkGoogle);
        if (!window.google?.maps) {
          reject(new Error('Google Maps failed to initialize'));
        }
      }, 5000);
    };

    script.onerror = () => {
      reject(new Error('Failed to load Google Maps script'));
    };

    document.head.appendChild(script);
  });

  return loaderPromise;
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
        // Load Google Maps
        await loadGoogleMaps();

        if (!mounted) return;

        // Check if Google Maps is available
        if (!window.google?.maps) {
          throw new Error('Google Maps not available');
        }

        // Use traditional API (no importLibrary needed for basic maps)
        const position = { lat: latitude, lng: longitude };

        const map = new window.google.maps.Map(mapRef.current, {
          center: position,
          zoom: zoomLevel,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          mapId: 'DEMO_MAP_ID', // Required for some features
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
          // Check for specific API errors
          if (err.message?.includes('ApiNotActivatedMapError') || err.code === 'API_NOT_ACTIVATED') {
            setError('Maps API not enabled. Please activate "Maps JavaScript API" in Google Cloud Console');
          } else if (err.message?.includes('API key')) {
            setError('Invalid API key');
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
          {error.includes('Maps JavaScript API') && (
            <p className="text-xs text-gray-500 mt-2">
              Go to Google Cloud Console → APIs & Services → Enable "Maps JavaScript API"
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