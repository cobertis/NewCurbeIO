import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, AlertCircle, Navigation, ExternalLink } from "lucide-react";

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
    if (scriptLoaded && window.google?.maps?.Map) {
      resolve();
      return;
    }

    loadCallbacks.push(() => resolve());

    if (scriptLoading) {
      return;
    }

    scriptLoading = true;

    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      waitForGoogleMaps().then(() => {
        scriptLoaded = true;
        scriptLoading = false;
        loadCallbacks.forEach(cb => cb());
        loadCallbacks.length = 0;
      }).catch(reject);
      return;
    }

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

function waitForGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 100;

    const check = () => {
      attempts++;

      if (window.google?.maps?.Map && typeof window.google.maps.Map === 'function') {
        try {
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

        await loadGoogleMapsScript();

        if (!mounted) return;

        if (!window.google?.maps?.Map) {
          throw new Error('Google Maps not available');
        }

        if (typeof window.google.maps.Map !== 'function') {
          throw new Error('Google Maps not fully initialized');
        }

        const position = { lat: latitude, lng: longitude };

        // Create modern map with custom styling
        const map = new window.google.maps.Map(mapRef.current, {
          center: position,
          zoom: zoomLevel,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
          // Modern map styling
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "on" }]
            },
            {
              featureType: "transit",
              elementType: "labels.icon",
              stylers: [{ visibility: "off" }]
            }
          ],
        });

        // Create marker with bounce animation
        const marker = new window.google.maps.Marker({
          position: position,
          map: map,
          title: formattedAddress || "Location",
          animation: window.google.maps.Animation.DROP,
        });

        // Add info window with modern design
        if (formattedAddress) {
          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="
                padding: 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                max-width: 250px;
              ">
                <div style="
                  display: flex;
                  align-items: start;
                  gap: 10px;
                  margin-bottom: 8px;
                ">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 0C6.13 0 3 3.13 3 7c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${buttonColor}"/>
                  </svg>
                  <div style="flex: 1;">
                    <div style="
                      font-weight: 600;
                      font-size: 14px;
                      color: #111827;
                      margin-bottom: 4px;
                    ">
                      ${formattedAddress.split(',')[0]}
                    </div>
                    <div style="
                      font-size: 12px;
                      color: #6B7280;
                      line-height: 1.4;
                    ">
                      ${formattedAddress.split(',').slice(1).join(',').trim()}
                    </div>
                  </div>
                </div>
                <a 
                  href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formattedAddress)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: ${buttonColor};
                    color: white;
                    text-decoration: none;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s;
                  "
                  onmouseover="this.style.opacity='0.9'"
                  onmouseout="this.style.opacity='1'"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                  Open in Google Maps
                </a>
              </div>
            `,
          });

          // Auto-open info window
          infoWindow.open(map, marker);

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
  }, [latitude, longitude, formattedAddress, zoomLevel, buttonColor]);

  if (!latitude || !longitude) {
    return (
      <div
        className="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600"
        style={{ height }}
      >
        <div className="text-center px-4">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-white" />
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            No Location Selected
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Search for an address or business to display the map
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="relative bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-red-200 dark:border-red-800"
        style={{ height }}
      >
        <div className="text-center px-4">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
          </div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">{error}</p>
          {error.includes('Google Cloud Console') && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Enable "Maps JavaScript API" in your Google Cloud Console
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl group" style={{ height }}>
      {/* Map container */}
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} className="transition-all" />
      
      {/* Loading overlay with modern design */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/95 to-gray-100/95 dark:from-gray-900/95 dark:to-gray-800/95 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <Loader2 className="w-16 h-16 animate-spin text-blue-500" />
              <div className="absolute inset-0 w-16 h-16 animate-ping opacity-20">
                <div className="w-full h-full rounded-full bg-blue-500"></div>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 animate-pulse">
              Loading map...
            </p>
          </div>
        </div>
      )}
      
      {/* Modern action button with gradient */}
      {showButton && formattedAddress && !isLoading && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formattedAddress)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group/btn flex items-center gap-2 px-5 py-3 text-white rounded-xl shadow-2xl text-sm font-semibold transition-all hover:shadow-3xl transform hover:scale-105 active:scale-95 backdrop-blur-sm"
            style={{ 
              background: `linear-gradient(135deg, ${buttonColor} 0%, ${buttonColor}dd 100%)`,
            }}
            data-testid="button-see-location"
          >
            <Navigation className="w-4 h-4 transition-transform group-hover/btn:rotate-12" />
            <span>Get Directions</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
        </div>
      )}
      
      {/* Subtle corner badge */}
      {!isLoading && (
        <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="px-3 py-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-lg shadow-lg flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Live Map</span>
          </div>
        </div>
      )}
    </div>
  );
}