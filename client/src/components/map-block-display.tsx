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

declare global {
  interface Window {
    google?: any;
  }
}

let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: Array<() => void> = [];

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

// Create custom SVG marker with theme color
function createCustomMarker(color: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g filter="url(#shadow)">
        <path d="M16 0C9.373 0 4 5.373 4 12C4 21 16 38 16 38C16 38 28 21 28 12C28 5.373 22.627 0 16 0Z" fill="${color}"/>
        <circle cx="16" cy="12" r="5" fill="white"/>
      </g>
      <defs>
        <filter id="shadow" x="0" y="0" width="32" height="42" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix"/>
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
          <feOffset dy="2"/>
          <feGaussianBlur stdDeviation="2"/>
          <feComposite in2="hardAlpha" operator="out"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
        </filter>
      </defs>
    </svg>
  `)}`;
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

        // Clean map - minimal controls
        const map = new window.google.maps.Map(mapRef.current, {
          center: position,
          zoom: zoomLevel,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          gestureHandling: 'cooperative',
          disableDefaultUI: true,
        });

        // Animated marker with bounce - custom color pin
        new window.google.maps.Marker({
          position: position,
          map: map,
          title: formattedAddress || "Location",
          animation: window.google.maps.Animation.BOUNCE,
          icon: {
            url: createCustomMarker(buttonColor),
            scaledSize: new window.google.maps.Size(32, 42),
            anchor: new window.google.maps.Point(16, 42),
          },
        });

        mapInstanceRef.current = map;

        if (mounted) {
          setIsLoading(false);
          setError(null);
        }
      } catch (err: any) {
        console.error("[MAP] Error:", err);
        if (mounted) {
          setError('Unable to load map');
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
        className="relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200 dark:border-gray-700"
        style={{ height }}
      >
        <div className="text-center px-4">
          <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No location selected
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="relative bg-red-50 dark:bg-red-900/10 rounded-lg overflow-hidden flex items-center justify-center border border-red-200 dark:border-red-800"
        style={{ height }}
      >
        <div className="text-center px-4">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      
      {isLoading && (
        <div className="absolute inset-0 bg-white dark:bg-gray-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}
      
      {showButton && formattedAddress && !isLoading && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formattedAddress)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: buttonColor }}
            data-testid="button-see-location"
          >
            Cómo Llegar →
          </a>
        </div>
      )}
    </div>
  );
}