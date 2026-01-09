import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { FormControl, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";

interface AddressResult {
  place_id: string;
  display_name: string;
  address: {
    name?: string;
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }) => void;
  label?: string;
  placeholder?: string;
  testId?: string;
  error?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  label = "Street Address",
  placeholder = "Start typing an address...",
  testId = "input-address-autocomplete",
  error,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressResult[]>([]);
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
        `/api/geoapify/autocomplete-address?q=${encodeURIComponent(query)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        // Transform Geoapify results to our format
        const transformedResults = (data.results || data.predictions || []).map((result: any) => {
          const geoapifyData = result._geoapify_data || {};
          const mainText = result.structured_formatting?.main_text || geoapifyData.street || '';
          return {
            place_id: result.place_id,
            display_name: result.description || '',
            address: {
              name: mainText,
              house_number: mainText.match(/^\d+/)?.[0] || '',
              road: mainText.replace(/^\d+\s*/, '') || '',
              city: geoapifyData.city || '',
              town: '',
              village: '',
              state: geoapifyData.state || '',
              postcode: geoapifyData.postalCode || '',
              country: geoapifyData.country || 'US',
            }
          };
        }).filter((result: AddressResult) => {
          return result.address && (result.address.road || result.address.house_number || result.address.name);
        });
        setSuggestions(transformedResults);
        setShowSuggestions(transformedResults.length > 0);
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

  const handleSelectSuggestion = (result: AddressResult) => {
    const { address } = result;
    
    // Build street address from components
    const streetParts = [
      address.house_number,
      address.road,
    ].filter(Boolean);
    const street = streetParts.join(" ");

    // Extract city (could be city, town, or village)
    const city = address.city || address.town || address.village || "";

    // Update the input field with the street address
    onChange(street);

    // Call the callback with all address components
    onAddressSelect({
      street,
      city,
      state: address.state || "",
      postalCode: address.postcode || "",
      country: address.country || "",
    });

    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <FormItem className="w-full">
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <div className="relative">
            <Input
              value={value}
              onChange={handleInputChange}
              placeholder={placeholder}
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
        </FormControl>
        {error && <FormMessage>{error}</FormMessage>}
      </FormItem>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((result) => (
            <button
              key={result.place_id}
              type="button"
              onClick={() => handleSelectSuggestion(result)}
              className="w-full text-left px-4 py-2 hover:bg-muted/50 text-sm border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              data-testid={`suggestion-${result.place_id}`}
            >
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {result.address.name || (result.address.house_number && result.address.road
                  ? `${result.address.house_number} ${result.address.road}`
                  : result.address.road || result.display_name?.split(',')[0])}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {[
                  result.address.city || result.address.town || result.address.village,
                  result.address.state,
                  result.address.postcode,
                ].filter(Boolean).join(", ")}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
