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

// Simple Google Maps loader that actually works
declare global {
  interface Window {
    google?: any;
    initGoogleMap?: () => void;
  }
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
      setError("Please select a location from the address field");
      return;
    }

    // Load Google Maps script if not already loaded
    const loadGoogleMaps = () => {
      if (window.google?.maps) {
        initializeMap();
        return;
      }

      // Create callback function
      const callbackName = `initGoogleMap_${Date.now()}`;
      (window as any)[callbackName] = () => {
        initializeMap();
        delete (window as any)[callbackName];
      };

      // Check if script already exists
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        // Wait for it to load
        const checkInterval = setInterval(() => {
          if (window.google?.maps) {
            clearInterval(checkInterval);
            initializeMap();
          }
        }, 100);
        return;
      }

      // Create and append script
      const script = document.createElement('script');
      script.src = `/api/google-maps-js-loader?callback=${callbackName}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        setError("Failed to load Google Maps");
        setIsLoading(false);
      };
      document.head.appendChild(script);
    };

    // Initialize the map
    const initializeMap = () => {
      if (!mapRef.current || !window.google?.maps) {
        setError("Google Maps not available");
        setIsLoading(false);
        return;
      }

      try {
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

        // Add marker
        const marker = new window.google.maps.Marker({
          position: position,
          map: map,
          title: formattedAddress || "Location",
        });

        // Add info window if we have an address
        if (formattedAddress) {
          const infoWindow = new window.google.maps.InfoWindow({
            content: `<div style="padding: 8px;">
              <strong>${formattedAddress}</strong>
            </div>`,
          });

          marker.addListener("click", () => {
            infoWindow.open(map, marker);
          });
        }

        mapInstanceRef.current = map;
        setIsLoading(false);
        setError(null);
      } catch (err) {
        console.error("Error initializing map:", err);
        setError("Failed to initialize map");
        setIsLoading(false);
      }
    };

    // Start loading
    loadGoogleMaps();

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude, formattedAddress, zoomLevel]);

  // No coordinates provided
  if (!latitude || !longitude) {
    return (
      <div
        className="relative bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300"
        style={{ height }}
      >
        <div className="text-center px-4">
          <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            Please select a location to display the map
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="relative bg-red-50 dark:bg-red-900/20 rounded-xl overflow-hidden flex items-center justify-center border-2 border-red-200"
        style={{ height }}
      >
        <div className="text-center px-4">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <p className="text-xs text-gray-500 mt-1">
            Latitude: {latitude}, Longitude: {longitude}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden shadow-lg" style={{ height }}>
      {/* Map container */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* Button overlay */}
      {showButton && formattedAddress && !isLoading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              formattedAddress
            )}`}
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