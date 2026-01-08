import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface GeoapifySuggestion {
  place_id: string;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    county?: string;
    state?: string;
    state_code?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
  lat?: number;
  lon?: number;
}

interface GeoapifyAddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (address: {
    street: string;
    streetLine2?: string;
    city: string;
    state: string;
    county?: string;
    postalCode: string;
    country: string;
  }, placeDetails?: {
    placeId?: string;
    formattedAddress?: string;
    latitude?: number;
    longitude?: number;
  }) => void;
  label?: string;
  placeholder?: string;
  testId?: string;
  disabled?: boolean;
}

export function GeoapifyAddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  label = "Street Address",
  placeholder = "Start typing your address...",
  testId = "input-address-autocomplete",
  disabled = false,
}: GeoapifyAddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeoapifySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/geoapify/autocomplete?q=${encodeURIComponent(query)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.results || []);
        setShowSuggestions((data.results || []).length > 0);
      }
    } catch (error) {
      console.error("Failed to fetch address suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!newValue.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const handleSelectSuggestion = (suggestion: GeoapifySuggestion) => {
    const { address } = suggestion;
    
    const streetParts = [
      address.house_number,
      address.road,
    ].filter(Boolean);
    const street = streetParts.join(" ");

    onChange(street);

    onAddressSelect({
      street,
      city: address.city || "",
      state: address.state || "",
      county: address.county,
      postalCode: address.postcode || "",
      country: address.country || "United States",
    }, {
      placeId: suggestion.place_id,
      formattedAddress: suggestion.display_name,
      latitude: suggestion.lat,
      longitude: suggestion.lon,
    });

    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative space-y-2">
      {label && <label className="block text-xs text-gray-400 mb-1 ml-1">{label}</label>}
      <div className="relative">
        <Input
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="h-11 px-4 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          data-testid={testId}
          autoComplete="off"
          name="street-address"
          id="street-address-field"
          disabled={disabled}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => {
            const mainText = suggestion.address.house_number && suggestion.address.road
              ? `${suggestion.address.house_number} ${suggestion.address.road}`
              : suggestion.address.road || suggestion.display_name.split(",")[0];
            
            const secondaryParts = [
              suggestion.address.city,
              suggestion.address.state,
              suggestion.address.postcode,
            ].filter(Boolean);
            
            return (
              <button
                key={suggestion.place_id}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                data-testid={`suggestion-${suggestion.place_id}`}
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {mainText}
                </div>
                {secondaryParts.length > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {secondaryParts.join(", ")}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
