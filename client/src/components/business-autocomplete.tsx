import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { FormControl, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Building2, Phone, Globe, MapPin } from "lucide-react";

interface BusinessResult {
  id: string;
  name: string;
  formattedAddress: string;
  shortFormattedAddress: string;
  phone: string;
  website: string;
  type: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

interface BusinessAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onBusinessSelect: (business: {
    name: string;
    phone: string;
    website: string;
    address: string;
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

export function BusinessAutocomplete({
  value,
  onChange,
  onBusinessSelect,
  label = "Search for your business",
  placeholder = "Start typing your business name...",
  testId = "input-business-autocomplete",
  error,
}: BusinessAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<BusinessResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [notListed, setNotListed] = useState(false);
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
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/google-places/search-business?q=${encodeURIComponent(query)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.results || []);
        setShowSuggestions((data.results || []).length > 0);
      } else {
        console.error("Failed to fetch business suggestions");
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error("Failed to fetch business suggestions:", error);
      setSuggestions([]);
      setShowSuggestions(false);
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

    // Set new timeout for debouncing (500ms for business search)
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 500);
  };

  const formatPhoneForForm = (phone: string): string => {
    // If phone is already in a good format, return it
    if (phone.startsWith('+1 ')) {
      return phone;
    }
    
    // Remove any non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Format as +1 (XXX) XXX-XXXX
    if (cleaned.length === 10) {
      return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    
    // Return original if we can't format it
    return phone;
  };

  const handleSelectSuggestion = (business: BusinessResult) => {
    // Update the company name field
    onChange(business.name);

    // Call the callback with all business data
    onBusinessSelect({
      name: business.name,
      phone: formatPhoneForForm(business.phone),
      website: business.website,
      address: business.address.street,
      city: business.address.city,
      state: business.address.state,
      postalCode: business.address.postalCode,
      country: business.address.country || "United States",
    });

    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleNotListedChange = (checked: boolean) => {
    setNotListed(checked);
    if (checked) {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={value}
              onChange={handleInputChange}
              placeholder={placeholder}
              data-testid={testId}
              autoComplete="off"
              className="pl-10"
              disabled={notListed}
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </FormControl>
        {error && <FormMessage>{error}</FormMessage>}
        
        {/* Not Listed Checkbox */}
        <div className="flex items-center space-x-2 mt-2">
          <Checkbox 
            id="not-listed" 
            checked={notListed}
            onCheckedChange={handleNotListedChange}
            data-testid="checkbox-not-listed"
          />
          <label 
            htmlFor="not-listed" 
            className="text-sm text-muted-foreground cursor-pointer"
          >
            My business is not listed
          </label>
        </div>
      </FormItem>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && !notListed && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-80 overflow-y-auto">
          {suggestions.map((business) => (
            <button
              key={business.id}
              type="button"
              onClick={() => handleSelectSuggestion(business)}
              className="w-full text-left px-4 py-3 hover-elevate active-elevate-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              data-testid={`business-suggestion-${business.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    {business.name}
                  </div>
                  {business.type && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {business.type}
                    </div>
                  )}
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {business.shortFormattedAddress || business.formattedAddress}
                  </div>
                  <div className="flex gap-4 mt-1">
                    {business.phone && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {business.phone}
                      </div>
                    )}
                    {business.website && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        Website available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}