import { useEffect, useRef, useState } from "react";
import { loadGoogleMapsAPI } from "@/lib/google-maps-loader";
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
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!latitude || !longitude) {
      setIsLoading(false);
      setError("No location data available");
      return;
    }

    let mounted = true;

    const initMap = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const google = await loadGoogleMapsAPI();

        if (!mounted || !mapRef.current) return;

        const position = { lat: latitude, lng: longitude };

        const map = new google.maps.Map(mapRef.current, {
          center: position,
          zoom: zoomLevel,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: 'auto',
        });

        const marker = new google.maps.Marker({
          position: position,
          map: map,
          title: formattedAddress || "Location",
          animation: google.maps.Animation.DROP,
        });

        if (formattedAddress) {
          const infoWindow = new google.maps.InfoWindow({
            content: `<div style="padding: 8px;"><strong>${formattedAddress}</strong></div>`,
          });

          marker.addListener("click", () => {
            infoWindow.open(map, marker);
          });
        }

        mapInstanceRef.current = map;
        markerRef.current = marker;

        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load Google Maps:", err);
        if (mounted) {
          setError("Failed to load map");
          setIsLoading(false);
        }
      }
    };

    initMap();

    return () => {
      mounted = false;
      
      // Cleanup: remove marker and map instance
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      
      mapInstanceRef.current = null;
    };
  }, [latitude, longitude, formattedAddress, zoomLevel]);

  if (isLoading) {
    return (
      <div
        className="relative bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error || !latitude || !longitude) {
    return (
      <div
        className="relative bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300"
        style={{ height }}
      >
        <div className="text-center px-4">
          <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {error || "Please select a location to display the map"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden shadow-lg" style={{ height }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      
      {showButton && formattedAddress && (
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
