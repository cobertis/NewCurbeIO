/**
 * Format phone number as user types
 * Formats to: (XXX) XXX-XXXX
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-numeric characters
  const cleaned = value.replace(/\D/g, '');
  
  // Limit to 10 digits
  const limited = cleaned.substring(0, 10);
  
  // Apply formatting based on length
  if (limited.length === 0) {
    return '';
  } else if (limited.length <= 3) {
    return `(${limited}`;
  } else if (limited.length <= 6) {
    return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  } else {
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
  }
}

/**
 * Extract clean phone number (digits only) from formatted string
 */
export function cleanPhoneNumber(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Hook to handle phone input with automatic formatting
 */
export function usePhoneInput(initialValue?: string) {
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    const formatted = formatPhoneNumber(e.target.value);
    onChange(formatted);
  };

  return { handlePhoneChange };
}
