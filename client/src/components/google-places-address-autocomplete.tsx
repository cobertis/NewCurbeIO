import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface GooglePlacesSuggestion {
  place_id: string;
  display_name: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface GooglePlacesAddressAutocompleteProps {
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
}

export function GooglePlacesAddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  label = "Street Address",
  placeholder = "Start typing your address...",
  testId = "input-address-autocomplete",
}: GooglePlacesAddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GooglePlacesSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
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
        `/api/google-places/autocomplete-address?q=${encodeURIComponent(query)}`
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

    // Clear previous timeout
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Don't search if value is empty
    if (!newValue.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Set new timeout for debouncing
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const handleSelectSuggestion = async (suggestion: GooglePlacesSuggestion) => {
    // Fetch full place details
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/google-places/place-details?placeId=${encodeURIComponent(suggestion.place_id)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const address = data.address;
        
        // Update the input field with the street address
        onChange(address.street);
        
        // Call the callback with all address components and place details
        onAddressSelect({
          street: address.street,
          streetLine2: address.streetLine2,
          city: address.city,
          state: address.state,
          county: address.county,
          postalCode: address.postalCode,
          country: address.country,
        }, {
          placeId: data.placeId,
          formattedAddress: data.formattedAddress,
          latitude: data.latitude,
          longitude: data.longitude,
        });
      }
    } catch (error) {
      console.error("Failed to fetch place details:", error);
    } finally {
      setIsLoading(false);
      setSuggestions([]);
      setShowSuggestions(false);
    }
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
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full text-left px-4 py-2 hover-elevate active-elevate-2 text-sm border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              data-testid={`suggestion-${suggestion.place_id}`}
            >
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {suggestion.structured_formatting.main_text}
              </div>
              {suggestion.structured_formatting.secondary_text && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {suggestion.structured_formatting.secondary_text}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
