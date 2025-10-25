/**
 * HHS Poverty Guidelines Integration
 * 
 * NOTE: The HHS does not provide a public JSON API for Poverty Guidelines.
 * This service uses official HHS data that is manually updated each year.
 * 
 * Official source: https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines
 * 
 * The Poverty Guidelines are updated annually in January by the Department of Health and Human Services.
 */

interface PovertyGuidelinesResponse {
  year: number;
  state?: string;
  guidelines: Array<{
    household_size: number;
    amount: number;
  }>;
  additional_person_increment?: number;
  source: 'api' | 'static';
}

/**
 * Fetches Poverty Guidelines
 * 
 * IMPORTANT: The HHS does not provide a public JSON API. This function returns
 * official HHS data that is maintained as static data within this application.
 * Data is updated annually when HHS publishes new guidelines (typically in January).
 * 
 * @param year - The year for which to fetch guidelines (e.g., 2025)
 * @param state - Optional state code (e.g., 'FL', 'AK', 'HI'). If not provided, uses 48 contiguous states + DC.
 * @returns Poverty Guidelines data with official HHS values
 */
export async function fetchPovertyGuidelines(
  year: number = new Date().getFullYear(),
  state?: string
): Promise<PovertyGuidelinesResponse> {
  console.log(`[HHS Poverty Guidelines] Requested year: ${year}, state: ${state || 'default (48 states + DC)'}`);
  console.log('[HHS Poverty Guidelines] Note: Using official HHS data (no public API available)');
  
  // Return official HHS Poverty Guidelines data
  // Data is maintained as static values and updated annually per HHS publications
  return getFallbackPovertyGuidelines(year, state);
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
    source: 'static' as const,
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
