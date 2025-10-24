/**
 * CMS Marketplace API Integration
 * 
 * This service integrates with the healthcare.gov CMS Marketplace API
 * to fetch real-time health insurance plan quotations based on client data.
 */

// Interface matching the official CMS Marketplace API format
interface MarketplaceQuoteRequest {
  household: {
    income: number;
    effective_date?: string;
    has_married_couple?: boolean;
    people: Array<{
      age: number;
      dob?: string;
      gender?: string;
      uses_tobacco?: boolean;
      is_pregnant?: boolean;
      aptc_eligible?: boolean;
      has_mec?: boolean;
      is_parent?: boolean;
      relationship?: string;
      utilization?: 'Low' | 'Medium' | 'High';
    }>;
  };
  market: 'Individual';
  place: {
    countyfips: string;
    state: string;
    zipcode: string;
  };
  year: number;
  aptc_override?: number;
}

interface MarketplacePlan {
  id: string;
  name: string;
  issuer: {
    name: string;
    id: string;
  };
  benefits: Array<{
    name: string;
    covered: boolean;
    cost_sharings: Array<{
      coinsurance_rate?: number;
      coinsurance_options?: string;
      copay_amount?: number;
      copay_options?: string;
      display_string: string;
    }>;
  }>;
  deductibles: Array<{
    amount: number;
    family_cost: string;
    individual_cost: string;
    type: string;
  }>;
  disease_mgmt_programs: string[];
  has_national_network: boolean;
  premium: number;
  premium_w_credit?: number;
  quality_rating: {
    available: boolean;
    year?: number;
    global_rating?: number;
    global_not_rated_reason?: string;
  };
  simple_choice: boolean;
  metal_level: string;
  plan_type: string;
  specialist_referral_required: boolean;
  premium_scenarios?: Array<{
    age: number;
    premium: number;
  }>;
  moops?: Array<{
    amount: number;
    family_cost: string;
    individual_cost: string;
    type: string;
  }>;
}

interface MarketplaceApiResponse {
  plans: MarketplacePlan[];
  total: number;
  year: number;
  household_aptc?: number;
  household_csr?: string;
  household_lcbp_premium?: number;
  household_slcsp_premium?: number;
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Fetch health insurance plans from CMS Marketplace API
 */
export async function fetchMarketplacePlans(
  quoteData: {
    zipCode: string;
    county: string;
    state: string;
    householdIncome: number;
    client: {
      dateOfBirth: string;
      gender?: string;
      pregnant?: boolean;
      usesTobacco?: boolean;
    };
    spouses?: Array<{
      dateOfBirth: string;
      gender?: string;
      pregnant?: boolean;
      usesTobacco?: boolean;
    }>;
    dependents?: Array<{
      dateOfBirth: string;
      gender?: string;
      pregnant?: boolean;
      usesTobacco?: boolean;
    }>;
  }
): Promise<MarketplaceApiResponse> {
  const apiKey = process.env.CMS_MARKETPLACE_API_KEY;
  
  if (!apiKey) {
    throw new Error('CMS_MARKETPLACE_API_KEY is not configured');
  }

  // Build household members array following CMS API format
  const people = [];
  
  // Add client
  people.push({
    age: calculateAge(quoteData.client.dateOfBirth),
    dob: quoteData.client.dateOfBirth,
    gender: quoteData.client.gender?.toLowerCase(),
    uses_tobacco: quoteData.client.usesTobacco || false,
    is_pregnant: quoteData.client.pregnant || false,
    aptc_eligible: true,
    relationship: 'Self'
  });
  
  // Add spouses
  if (quoteData.spouses && quoteData.spouses.length > 0) {
    quoteData.spouses.forEach(spouse => {
      people.push({
        age: calculateAge(spouse.dateOfBirth),
        dob: spouse.dateOfBirth,
        gender: spouse.gender?.toLowerCase(),
        uses_tobacco: spouse.usesTobacco || false,
        is_pregnant: spouse.pregnant || false,
        aptc_eligible: true,
        relationship: 'Spouse'
      });
    });
  }
  
  // Add dependents
  if (quoteData.dependents && quoteData.dependents.length > 0) {
    quoteData.dependents.forEach(dependent => {
      people.push({
        age: calculateAge(dependent.dateOfBirth),
        dob: dependent.dateOfBirth,
        gender: dependent.gender?.toLowerCase(),
        uses_tobacco: dependent.usesTobacco || false,
        is_pregnant: dependent.pregnant || false,
        aptc_eligible: true,
        relationship: 'Child'
      });
    });
  }

  const householdSize = people.length;
  const year = new Date().getFullYear(); // Current year for plan ratings

  // Get county FIPS code - REQUIRED by CMS API
  console.log('[CMS_MARKETPLACE] Fetching county FIPS for:', {
    zipCode: quoteData.zipCode,
    county: quoteData.county,
    state: quoteData.state,
  });

  const countyFips = await getCountyFips(quoteData.zipCode, quoteData.county, quoteData.state);
  
  if (!countyFips) {
    console.error('[CMS_MARKETPLACE] Could not determine county FIPS code');
    throw new Error(`Unable to determine county FIPS for ${quoteData.county}, ${quoteData.state}. Please verify the address information.`);
  }

  console.log('[CMS_MARKETPLACE] County FIPS:', countyFips);

  // Build request body following the official CMS Marketplace API format
  const requestBody: MarketplaceQuoteRequest = {
    household: {
      income: quoteData.householdIncome,
      people: people // Already in correct format
    },
    market: 'Individual',
    place: {
      countyfips: countyFips,
      state: quoteData.state,
      zipcode: quoteData.zipCode,
    },
    year,
  };

  console.log('[CMS_MARKETPLACE] Requesting plans with full request body:', JSON.stringify(requestBody, null, 2));

  try {
    // CMS Marketplace API endpoint
    const apiUrl = 'https://marketplace.api.healthcare.gov/api/v1/plans/search';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CMS_MARKETPLACE] API Error:', response.status, errorText);
      
      // Provide more specific error messages
      if (response.status === 400) {
        throw new Error('Invalid request to marketplace API. Please verify all quote information is complete and accurate.');
      } else if (response.status === 401 || response.status === 403) {
        throw new Error('Authentication failed with marketplace API. Please contact support.');
      } else if (response.status === 404) {
        throw new Error('No plans found for the specified location and criteria.');
      } else {
        throw new Error(`Marketplace API error (${response.status}). Please try again later.`);
      }
    }

    const data: MarketplaceApiResponse = await response.json();
    
    console.log('[CMS_MARKETPLACE] Successfully fetched', data.plans?.length || 0, 'plans');
    
    return data;
  } catch (error) {
    console.error('[CMS_MARKETPLACE] Error fetching plans:', error);
    throw error;
  }
}

/**
 * Get county FIPS code from zip code and county name
 */
export async function getCountyFips(zipCode: string, countyName: string, state: string): Promise<string | null> {
  const apiKey = process.env.CMS_MARKETPLACE_API_KEY;
  
  if (!apiKey) {
    throw new Error('CMS_MARKETPLACE_API_KEY is not configured');
  }

  try {
    const apiUrl = `https://marketplace.api.healthcare.gov/api/v1/counties/by/zip/${zipCode}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
      },
    });

    if (!response.ok) {
      console.error('[CMS_MARKETPLACE] County FIPS lookup error:', response.status);
      return null;
    }

    const data = await response.json();
    
    // Find matching county
    const county = data.counties?.find((c: any) => 
      c.name.toLowerCase().includes(countyName.toLowerCase()) &&
      c.state.toLowerCase() === state.toLowerCase()
    );
    
    return county?.fips || null;
  } catch (error) {
    console.error('[CMS_MARKETPLACE] Error fetching county FIPS:', error);
    return null;
  }
}
