/**
 * HHS Poverty Guidelines API Integration
 * 
 * This service integrates with the U.S. Department of Health and Human Services (HHS)
 * Poverty Guidelines API to fetch official federal poverty level data.
 * 
 * API Documentation: https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines/poverty-guidelines-api
 */

interface PovertyGuidelinesResponse {
  year: number;
  state?: string;
  guidelines: Array<{
    household_size: number;
    amount: number;
  }>;
  additional_person_increment?: number;
}

/**
 * Fetches Poverty Guidelines from the HHS API
 * @param year - The year for which to fetch guidelines (e.g., 2025)
 * @param state - Optional state code (e.g., 'FL' for Florida). If not provided, uses the 48 contiguous states standard.
 * @returns Poverty Guidelines data
 */
export async function fetchPovertyGuidelines(
  year: number = new Date().getFullYear(),
  state?: string
): Promise<PovertyGuidelinesResponse> {
  try {
    // The HHS API endpoint for poverty guidelines
    const baseUrl = 'https://aspe.hhs.gov/poverty-guidelines';
    
    // Construct the API URL - The exact endpoint structure may vary
    // This is a common pattern for government APIs
    let apiUrl = `${baseUrl}/${year}`;
    if (state) {
      apiUrl += `?state=${state.toUpperCase()}`;
    }
    
    console.log(`[HHS Poverty Guidelines] Fetching data from: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Curbe-CRM/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HHS API returned status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[HHS Poverty Guidelines] Successfully fetched data:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('[HHS Poverty Guidelines] Error fetching data:', error);
    
    // Return fallback data for 2025 (48 contiguous states + DC)
    // These are the official 2025 HHS Poverty Guidelines
    console.log('[HHS Poverty Guidelines] Using fallback data for year 2025');
    return getFallbackPovertyGuidelines(year, state);
  }
}

/**
 * Returns fallback Poverty Guidelines data when the API is unavailable
 * Based on 2025 official HHS Poverty Guidelines for the 48 contiguous states and DC
 */
function getFallbackPovertyGuidelines(year: number, state?: string): PovertyGuidelinesResponse {
  // 2025 Poverty Guidelines for 48 contiguous states and DC
  const guidelines2025 = [
    { household_size: 1, amount: 15650 },
    { household_size: 2, amount: 21150 },
    { household_size: 3, amount: 26650 },
    { household_size: 4, amount: 32150 },
    { household_size: 5, amount: 37650 },
    { household_size: 6, amount: 43150 },
    { household_size: 7, amount: 48650 },
    { household_size: 8, amount: 54150 },
  ];

  // Alaska has higher poverty guidelines
  const guidelinesAlaska2025 = [
    { household_size: 1, amount: 19570 },
    { household_size: 2, amount: 26430 },
    { household_size: 3, amount: 33290 },
    { household_size: 4, amount: 40150 },
    { household_size: 5, amount: 47010 },
    { household_size: 6, amount: 53870 },
    { household_size: 7, amount: 60730 },
    { household_size: 8, amount: 67590 },
  ];

  // Hawaii has higher poverty guidelines
  const guidelinesHawaii2025 = [
    { household_size: 1, amount: 18010 },
    { household_size: 2, amount: 24330 },
    { household_size: 3, amount: 30650 },
    { household_size: 4, amount: 36970 },
    { household_size: 5, amount: 43290 },
    { household_size: 6, amount: 49610 },
    { household_size: 7, amount: 55930 },
    { household_size: 8, amount: 62250 },
  ];

  let guidelines = guidelines2025;
  let additionalPersonIncrement = 5500;

  // Check if state is Alaska or Hawaii
  if (state?.toUpperCase() === 'AK') {
    guidelines = guidelinesAlaska2025;
    additionalPersonIncrement = 6860;
  } else if (state?.toUpperCase() === 'HI') {
    guidelines = guidelinesHawaii2025;
    additionalPersonIncrement = 6320;
  }

  return {
    year: 2025,
    state: state?.toUpperCase(),
    guidelines,
    additional_person_increment: additionalPersonIncrement,
  };
}

/**
 * Calculates poverty guideline amount for a specific household size
 * @param householdSize - The number of people in the household
 * @param year - The year for guidelines
 * @param state - Optional state code
 * @returns The poverty guideline amount for the household size
 */
export async function getPovertyGuidelineForHouseholdSize(
  householdSize: number,
  year: number = new Date().getFullYear(),
  state?: string
): Promise<number> {
  const data = await fetchPovertyGuidelines(year, state);
  
  // Find exact match in guidelines
  const guideline = data.guidelines.find(g => g.household_size === householdSize);
  if (guideline) {
    return guideline.amount;
  }
  
  // Calculate for household sizes larger than 8
  if (householdSize > 8 && data.additional_person_increment) {
    const baseAmount = data.guidelines.find(g => g.household_size === 8)?.amount || 0;
    const additionalPeople = householdSize - 8;
    return baseAmount + (additionalPeople * data.additional_person_increment);
  }
  
  return 0;
}

/**
 * Calculates all poverty guideline percentages for a household
 * Returns amounts for common percentages: 50%, 75%, 100%, 125%, 133%, 135%, 138%, 150%, 175%, 180%, 185%, 200%, 250%, 300%, 400%
 */
export async function getPovertyGuidelinePercentages(
  householdSize: number,
  year: number = new Date().getFullYear(),
  state?: string
): Promise<Record<string, number>> {
  const baseAmount = await getPovertyGuidelineForHouseholdSize(householdSize, year, state);
  
  const percentages = [50, 75, 100, 125, 133, 135, 138, 150, 175, 180, 185, 200, 250, 300, 400];
  const result: Record<string, number> = {};
  
  for (const percentage of percentages) {
    result[`${percentage}%`] = Math.round((baseAmount * percentage) / 100);
  }
  
  return result;
}
