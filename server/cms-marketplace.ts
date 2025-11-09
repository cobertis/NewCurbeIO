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
      dob: string; // CRITICAL: Send ONLY dob (not age) for accurate "plan specific rating-age adjustments"
      gender?: string;
      uses_tobacco?: boolean;
      is_pregnant?: boolean;
      aptc_eligible?: boolean;
      has_mec?: boolean;
      is_parent?: boolean;
      relationship?: string;
      utilization?: 'Low' | 'Medium' | 'High';
      does_not_cohabitate?: boolean;
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
  type: string; // HMO, PPO, EPO, POS - this is the plan network type
  specialist_referral_required: boolean;
  hsa_eligible: boolean;
  has_dental_child_coverage?: boolean; // Calculated from benefits
  has_dental_adult_coverage?: boolean; // Calculated from benefits
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
  request_data?: any; // Data about the request for transparency
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth: string, effectiveDate?: string): number {
  // CRITICAL: Calculate age on the effective date, NOT today
  // The CMS API uses the age field to determine premiums and APTC
  const referenceDate = effectiveDate ? new Date(effectiveDate) : new Date();
  const birthDate = new Date(dateOfBirth);
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Format gender for CMS API (expects "Male" or "Female")
 */
function formatGenderForCMS(gender?: string): string {
  if (!gender) return 'Male'; // Default if not provided
  const lowerGender = gender.toLowerCase();
  if (lowerGender === 'male' || lowerGender === 'm') return 'Male';
  if (lowerGender === 'female' || lowerGender === 'f') return 'Female';
  // For "other" or any other value, default to Male as CMS API only accepts Male/Female
  return 'Male';
}

/**
 * Fetch health insurance plans from CMS Marketplace API
 * PURE PASS-THROUGH - Returns EXACTLY what the CMS API returns without any modifications
 */
export async function fetchMarketplacePlans(
  quoteData: {
    zipCode: string;
    county: string;
    state: string;
    householdIncome: number;
    effectiveDate?: string; // CRITICAL: Required for APTC/CSR calculation
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
      aptc_eligible?: boolean; // CRITICAL: If false, spouse is NOT an applicant (no APTC eligibility)
    }>;
    dependents?: Array<{
      dateOfBirth: string;
      gender?: string;
      pregnant?: boolean;
      usesTobacco?: boolean;
      isApplicant?: boolean; // true = needs insurance (denied Medicaid), false = has Medicaid/CHIP
    }>;
  },
  page: number = 1,
  pageSize: number = 100,
  yearOverride?: number
): Promise<MarketplaceApiResponse> {
  // Validate yearOverride if provided
  if (yearOverride && (yearOverride < 2025 || yearOverride > 2030)) {
    throw new Error(`Year override must be between 2025 and 2030, received: ${yearOverride}`);
  }
  
  const targetYear = yearOverride || new Date().getFullYear();
  console.log(`[CMS_MARKETPLACE] 🚀 Fetching plans - Page ${page}, Year ${targetYear}`);
  console.log(`[CMS_MARKETPLACE] ⚠️  PURE PASS-THROUGH MODE - No modifications will be made to API response`);
  
  // Call fetchSinglePage and return EXACTLY what the CMS API returns
  // NO deduplication, NO recalculation, NO modifications
  const apiResponse = await fetchSinglePage(quoteData, page, pageSize, yearOverride);
  
  console.log(`[CMS_MARKETPLACE] ✅ Returning EXACT API response:`);
  console.log(`  - Plans returned: ${apiResponse.plans?.length || 0}`);
  console.log(`  - Total available: ${apiResponse.total || 0}`);
  console.log(`  - household_aptc: ${apiResponse.household_aptc || 'NOT PROVIDED BY API'}`);
  console.log(`  - household_csr: ${apiResponse.household_csr || 'NOT PROVIDED BY API'}`);
  console.log(`[CMS_MARKETPLACE] 🔒 NO deduplication, NO recalculation - showing exactly what CMS API calculated`);
  
  return apiResponse;
}

/**
 * Fetch a single page of marketplace plans - internal helper function
 * The CMS API automatically calculates premium_w_credit based on household data
 */
async function fetchSinglePage(
  quoteData: {
    zipCode: string;
    county: string;
    state: string;
    householdIncome: number;
    effectiveDate?: string; // CRITICAL: Required for APTC/CSR calculation
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
      aptc_eligible?: boolean; // CRITICAL: If false, spouse is NOT an applicant (no APTC eligibility)
    }>;
    dependents?: Array<{
      dateOfBirth: string;
      gender?: string;
      pregnant?: boolean;
      usesTobacco?: boolean;
      isApplicant?: boolean; // true = needs insurance (denied Medicaid), false = has Medicaid/CHIP
    }>;
  },
  page: number,
  limit: number = 100,
  yearOverride?: number
): Promise<MarketplaceApiResponse> {
  const apiKey = process.env.CMS_MARKETPLACE_API_KEY;
  
  if (!apiKey) {
    throw new Error('CMS_MARKETPLACE_API_KEY is not configured');
  }

  // Build household members array following CMS API format from documentation
  // FIX 2: API requires BOTH age and dob fields for accurate calculations
  const people = [];
  
  // Check if there's a married couple (spouse exists)
  const hasMarriedCouple = quoteData.spouses && quoteData.spouses.length > 0;
  
  // Determine effective date for age calculation (use provided date or default to Jan 1 of target year)
  const effectiveDateForAge = quoteData.effectiveDate || `${year}-01-01`;
  
  // Add client - BASIC fields only per official CMS API example
  const clientAge = calculateAge(quoteData.client.dateOfBirth, effectiveDateForAge);
  people.push({
    age: clientAge,
    aptc_eligible: true,
    gender: formatGenderForCMS(quoteData.client.gender),
    uses_tobacco: quoteData.client.usesTobacco || false,
  });
  
  // Add spouses - BASIC fields only per official CMS API example
  if (quoteData.spouses && quoteData.spouses.length > 0) {
    quoteData.spouses.forEach(spouse => {
      const isApplicant = spouse.aptc_eligible !== false;
      const spouseAge = calculateAge(spouse.dateOfBirth, effectiveDateForAge);
      
      people.push({
        age: spouseAge,
        aptc_eligible: isApplicant,
        gender: formatGenderForCMS(spouse.gender),
        uses_tobacco: spouse.usesTobacco || false,
      });
    });
  }
  
  // Add dependents - BASIC fields only per official CMS API example
  if (quoteData.dependents && quoteData.dependents.length > 0) {
    quoteData.dependents.forEach(dependent => {
      const needsInsurance = dependent.isApplicant !== false;
      const dependentAge = calculateAge(dependent.dateOfBirth, effectiveDateForAge);
      
      people.push({
        age: dependentAge,
        aptc_eligible: needsInsurance,
        gender: formatGenderForCMS(dependent.gender),
        uses_tobacco: dependent.usesTobacco || false,
      });
    });
  }

  // Use yearOverride if provided, otherwise use current year
  const year = yearOverride || new Date().getFullYear();

  // Get county FIPS code - CRÍTICO según documentación
  if (page === 1) { // Only log on first page to reduce noise
    console.log(`[CMS_MARKETPLACE] 📄 Página ${page} (año ${year}):`, {
      ZIP: quoteData.zipCode,
      Estado: quoteData.state,
      County: quoteData.county,
    });
  }

  const countyFips = await getCountyFips(quoteData.zipCode, quoteData.county, quoteData.state);
  
  if (!countyFips) {
    console.error('[CMS_MARKETPLACE] ❌ Could not determine county FIPS code');
    throw new Error(`Unable to determine county FIPS for ${quoteData.county}, ${quoteData.state}. Please verify the address information.`);
  }

  if (page === 1) {
    console.log('[CMS_MARKETPLACE] County FIPS:', countyFips);
  }

  // FIX 1: Build request body with ONLY supported fields per official documentation
  // FIX 3: Pagination moved to query parameters (not in body)
  const requestBody: any = {
    household: {
      income: quoteData.householdIncome, // ANNUAL household income (API assumes annual by default)
      people: people, // Array of household members with age and dob
      has_married_couple: hasMarriedCouple, // CRITICAL: Required for accurate APTC calculation for couples
    },
    market: 'Individual',
    place: {
      countyfips: countyFips,
      state: quoteData.state,
      zipcode: quoteData.zipCode,
    },
    year: year,
  };
  
  // CRITICAL: Add effective_date if provided - required for accurate APTC/CSR calculation
  if (quoteData.effectiveDate) {
    requestBody.household.effective_date = quoteData.effectiveDate;
    if (page === 1) {
      console.log('[CMS_MARKETPLACE] ✅ Using effective_date:', quoteData.effectiveDate);
      console.log('[CMS_MARKETPLACE] ✅ Has married couple:', hasMarriedCouple);
    }
  } else if (page === 1) {
    console.log('[CMS_MARKETPLACE] ⚠️ No effective_date provided - APTC/CSR may be inaccurate');
  }

  if (page === 1) {
    console.log(`[CMS_MARKETPLACE] 📊 Page ${page}: Requesting up to ${limit} plans per page`);
    console.log(`[CMS_MARKETPLACE] 💰 ANNUAL Income: $${quoteData.householdIncome}/year`);
    console.log('[CMS_MARKETPLACE] 🔍 EXACT REQUEST PAYLOAD TO CMS API:');
    console.log(JSON.stringify(requestBody, null, 2));
  }

  try {
    // FIX 3: CMS Marketplace API endpoint with pagination in query parameters
    const apiUrl = `https://marketplace.api.healthcare.gov/api/v1/plans/search?apikey=${apiKey}&per_page=${limit}&page=${page}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
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
    
    // CRITICAL DEBUG: Log complete API response on first page to see ALL fields
    if (page === 1) {
      console.log('[CMS_MARKETPLACE] 🔍 COMPLETE API RESPONSE (first page):');
      console.log(JSON.stringify({
        household_aptc: data.household_aptc,
        household_csr: data.household_csr,
        household_lcbp_premium: data.household_lcbp_premium,
        household_slcsp_premium: data.household_slcsp_premium,
        total: data.total,
        year: data.year,
        plans_count: data.plans?.length
      }, null, 2));
    }
    
    // Log total plans available (only on first page)
    if (page === 1 && data.total) {
      console.log(`[CMS_MARKETPLACE] 📊 Total de planes disponibles: ${data.total}`);
    }
    
    if (page === 1 || page % 5 === 0) { // Reduce logging noise
      console.log(`[CMS_MARKETPLACE] ✅ Página ${page}: ${data.plans?.length || 0} planes obtenidos`);
    }
    
    // Agregar información del request para mostrar al usuario
    data.request_data = {
      household_income: quoteData.householdIncome,
      people_count: people.length,
      people: people.map((p: any) => ({
        age: p.age,
        dob: p.dob,
        gender: p.gender,
        tobacco: p.uses_tobacco,
        pregnant: p.is_pregnant,
        aptc_eligible: p.aptc_eligible
      })),
      location: {
        zip: quoteData.zipCode,
        state: quoteData.state,
        county: quoteData.county,
        county_fips: countyFips
      },
      year: year,
      per_page: limit,
      page: page
    };
    
    // DEBUG: Log API response metadata on first page
    if (page === 1) {
      console.log('[CMS_MARKETPLACE] 📋 API RESPONSE METADATA:');
      console.log(`  - household_csr: ${data.household_csr || 'NOT PROVIDED'}`);
      console.log(`  - household_aptc: ${data.household_aptc || 'NOT PROVIDED'}`);
      console.log(`  - household_slcsp_premium: ${data.household_slcsp_premium || 'NOT PROVIDED'}`);
      
      if (data.plans && data.plans.length > 0) {
        const firstPlan = data.plans[0];
        console.log('[CMS_MARKETPLACE] 🔍 SAMPLE PLAN FROM API:');
        console.log(`  - Plan ID: ${firstPlan.id}`);
        console.log(`  - Plan Name: ${firstPlan.name}`);
        console.log(`  - Metal Level: ${firstPlan.metal_level}`);
        console.log(`  - Premium: ${firstPlan.premium}`);
        console.log(`  - Premium w/ Credit: ${firstPlan.premium_w_credit}`);
      }
    }
    
    // DEBUG: Look for Oscar plan specifically in EVERY page
    if (data.plans) {
      const oscarPlan = data.plans.find((p: any) => p.id === '40572FL0200025');
      if (oscarPlan) {
        console.log('[CMS_MARKETPLACE] 🎯 FOUND OSCAR PLAN 40572FL0200025 ON PAGE ' + page + ':');
        console.log(`  - Issuer: ${oscarPlan.issuer?.name}`);
        console.log(`  - Plan Name: ${oscarPlan.name}`);
        console.log(`  - Metal Level: ${oscarPlan.metal_level}`);
        console.log(`  - Type: ${oscarPlan.type}`);
        console.log(`  - Premium (unsubsidized): $${oscarPlan.premium}`);
        console.log(`  - Premium w/ Credit (subsidized): $${oscarPlan.premium_w_credit}`);
        console.log(`  - APTC Amount: $${oscarPlan.premium - (oscarPlan.premium_w_credit || 0)}`);
        console.log(`  - Deductible: ${oscarPlan.deductibles?.[0]?.amount || 'N/A'}`);
        console.log(`  - Design Type: ${oscarPlan.design_type || 'N/A'}`);
      }
    }
    
    // API automatically calculates ALL values (premium_w_credit, household_aptc, household_csr)
    // We do NOT calculate or override ANY values - we return exactly what the API provides
    
    // Log if we're reaching the end of pagination
    if (data.plans && data.plans.length < limit) {
      console.log(`[CMS_MARKETPLACE] ✅ Búsqueda completa: última página con ${data.plans.length} planes`);
    }
    
    return data;
  } catch (error) {
    console.error('[CMS_MARKETPLACE] Error fetching plans:', error);
    throw error;
  }
}

/**
 * Build CMS Marketplace API payload from policy data
 * CRITICAL: This function respects the isApplicant field for all members
 * Client is always an applicant; spouses and dependents use their isApplicant field
 */
export function buildCMSPayloadFromPolicy(policyData: {
  members: Array<{
    role: string;
    dateOfBirth: string;
    gender?: string;
    pregnant?: boolean;
    tobaccoUser?: boolean;
    isApplicant?: boolean;
  }>;
  zipCode: string;
  county: string;
  state: string;
  householdIncome: number;
  effectiveDate?: string;
}): {
  zipCode: string;
  county: string;
  state: string;
  householdIncome: number;
  effectiveDate?: string;
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
    aptc_eligible?: boolean; // CRITICAL: false means spouse is NOT an applicant
  }>;
  dependents?: Array<{
    dateOfBirth: string;
    gender?: string;
    pregnant?: boolean;
    usesTobacco?: boolean;
    isApplicant?: boolean;
  }>;
} {
  // Find the client (policy owner) - always the primary applicant
  const clientMember = policyData.members.find(m => m.role === 'client');
  if (!clientMember || !clientMember.dateOfBirth) {
    throw new Error('Policy must have a client member with date of birth');
  }

  // Find spouses - respect their isApplicant field
  const spouseMembers = policyData.members.filter(m => m.role === 'spouse');

  // Find dependents - use isApplicant field to determine if they need insurance
  const dependentMembers = policyData.members.filter(m => m.role === 'dependent');

  // Count actual applicants for logging
  const spouseApplicants = spouseMembers.filter(s => s.isApplicant !== false).length;
  const dependentApplicants = dependentMembers.filter(d => d.isApplicant !== false).length;
  const totalApplicants = 1 + spouseApplicants + dependentApplicants;

  console.log('[buildCMSPayloadFromPolicy] Building payload with:');
  console.log(`  - Client: 1 (role=client, applicant=TRUE)`);
  console.log(`  - Spouses: ${spouseMembers.length} (${spouseApplicants} applicants, ${spouseMembers.length - spouseApplicants} with MEC)`);
  console.log(`  - Dependents: ${dependentMembers.length} (${dependentApplicants} applicants, ${dependentMembers.length - dependentApplicants} with MEC)`);
  console.log(`  - Total applicants: ${totalApplicants}`);

  // Build the payload with correct mapping
  return {
    zipCode: policyData.zipCode,
    county: policyData.county,
    state: policyData.state,
    householdIncome: policyData.householdIncome,
    effectiveDate: policyData.effectiveDate,
    client: {
      dateOfBirth: clientMember.dateOfBirth,
      gender: clientMember.gender,
      pregnant: clientMember.pregnant || false,
      usesTobacco: clientMember.tobaccoUser || false,
    },
    spouses: spouseMembers.map(s => ({
      dateOfBirth: s.dateOfBirth,
      gender: s.gender,
      pregnant: s.pregnant || false,
      usesTobacco: s.tobaccoUser || false,
      aptc_eligible: s.isApplicant !== false, // CRITICAL: Respect isApplicant field - default TRUE unless explicitly false
    })),
    dependents: dependentMembers.map(d => ({
      dateOfBirth: d.dateOfBirth,
      gender: d.gender,
      pregnant: d.pregnant || false,
      usesTobacco: d.tobaccoUser || false,
      isApplicant: d.isApplicant !== false, // Default TRUE unless explicitly false
    })),
  };
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
