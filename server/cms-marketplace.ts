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
 * Fetch ALL health insurance plans from CMS Marketplace API in parallel
 * Optimized for speed - gets all plans in one go
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
    }>;
    dependents?: Array<{
      dateOfBirth: string;
      gender?: string;
      pregnant?: boolean;
      usesTobacco?: boolean;
      isApplicant?: boolean; // true = needs insurance (denied Medicaid), false = has Medicaid/CHIP
    }>;
  },
  page?: number,
  pageSize?: number,
  yearOverride?: number
): Promise<MarketplaceApiResponse> {
  // Validate yearOverride if provided
  if (yearOverride && (yearOverride < 2025 || yearOverride > 2030)) {
    throw new Error(`Year override must be between 2025 and 2030, received: ${yearOverride}`);
  }
  
  // If page is specified, return just that page (for backwards compatibility)
  if (page && page > 1) {
    return fetchSinglePage(quoteData, page, yearOverride);
  }
  
  // Otherwise, fetch ALL plans in parallel
  const targetYear = yearOverride || new Date().getFullYear();
  console.log(`[CMS_MARKETPLACE] 🚀 Iniciando carga rápida de TODOS los planes para año ${targetYear}`);
  
  // First, get the total count with page 1
  const firstPage = await fetchSinglePage(quoteData, 1, yearOverride);
  const totalPlans = firstPage.total || 0;
  
  if (totalPlans <= 10) {
    // If 10 or fewer plans, we already have them all
    // Calculate household_aptc from plans and return
    return calculateHouseholdAptcAndReturn(firstPage, firstPage.plans || []);
  }
  
  // Calculate how many pages we need (API returns max 10 per page)
  const plansPerPage = 10; // API limitation
  const totalPages = Math.ceil(totalPlans / plansPerPage);
  
  console.log(`[CMS_MARKETPLACE] 📊 ${totalPlans} planes disponibles en ${totalPages} páginas`);
  console.log(`[CMS_MARKETPLACE] ⚡ Obteniendo todas las páginas en paralelo...`);
  
  // Create promises for all remaining pages (we already have page 1)
  const pagePromises: Promise<MarketplaceApiResponse>[] = [];
  
  // Batch requests in groups of 5 to avoid overwhelming the API
  const batchSize = 5;
  for (let page = 2; page <= totalPages; page++) {
    pagePromises.push(fetchSinglePage(quoteData, page, yearOverride));
    
    // Add small delay between batches to be respectful to the API
    if (page % batchSize === 0 && page < totalPages) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Fetch all pages in parallel
  const remainingPages = await Promise.all(pagePromises);
  
  // Combine all plans from all pages
  const allPlans = [...(firstPage.plans || [])];
  for (const pageData of remainingPages) {
    if (pageData.plans) {
      allPlans.push(...pageData.plans);
    }
  }
  
  // Remove duplicates by plan ID (just in case)
  const uniquePlans = allPlans.filter((plan, index, self) =>
    index === self.findIndex(p => p.id === plan.id)
  );
  
  console.log(`[CMS_MARKETPLACE] ✅ ${uniquePlans.length} planes únicos obtenidos exitosamente`);
  
  // Calculate household_aptc from plans and return final response
  return calculateHouseholdAptcAndReturn(firstPage, uniquePlans);
}

/**
 * Calculate household_aptc from SLCSP if API doesn't provide it
 * SLCSP = Second Lowest Cost Silver Plan (benchmark for APTC calculations)
 * This function is called for ALL response paths to ensure consistent APTC calculation
 */
function calculateHouseholdAptcAndReturn(
  firstPageResponse: MarketplaceApiResponse,
  allPlans: any[]
): MarketplaceApiResponse {
  let household_aptc = firstPageResponse.household_aptc;
  console.log(`[CMS_MARKETPLACE] 🔍 API provided household_aptc: ${household_aptc}`);
  
  if (!household_aptc || household_aptc === 0) {
    console.log(`[CMS_MARKETPLACE] ⚠️ household_aptc is 0 or undefined, calculating from SLCSP...`);
   
    // Find all Silver plans and sort by premium (unsubsidized)
    const silverPlans = allPlans
      .filter((p: any) => p.metal_level === 'Silver')
      .sort((a: any, b: any) => (a.premium || 0) - (b.premium || 0));
    
    if (silverPlans.length >= 2) {
      // Second lowest cost silver plan
      const slcsp = silverPlans[1];
      // APTC = unsubsidized premium - subsidized premium
      household_aptc = slcsp.premium - (slcsp.premium_w_credit || 0);
      console.log(`[CMS_MARKETPLACE] 💰 Calculated household_aptc from SLCSP: $${household_aptc}`);
      console.log(`  - SLCSP Plan: ${slcsp.name} (${slcsp.id})`);
      console.log(`  - SLCSP Premium: $${slcsp.premium}`);
      console.log(`  - SLCSP Premium w/ Credit: $${slcsp.premium_w_credit}`);
    } else if (silverPlans.length === 1) {
      // Only one silver plan - use it as benchmark
      const slcsp = silverPlans[0];
      household_aptc = slcsp.premium - (slcsp.premium_w_credit || 0);
      console.log(`[CMS_MARKETPLACE] 💰 Calculated household_aptc from only Silver plan: $${household_aptc}`);
    }
  }
  
  // Return combined response - API provides ALL calculations (APTC, CSR, premium_w_credit)
  // We extract household_aptc from SLCSP if API doesn't provide it
  return {
    ...firstPageResponse,
    plans: allPlans,
    total: allPlans.length,
    household_aptc: household_aptc || 0,
    household_csr: firstPageResponse.household_csr,
    household_slcsp_premium: firstPageResponse.household_slcsp_premium,
  };
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
  yearOverride?: number
): Promise<MarketplaceApiResponse> {
  const apiKey = process.env.CMS_MARKETPLACE_API_KEY;
  
  if (!apiKey) {
    throw new Error('CMS_MARKETPLACE_API_KEY is not configured');
  }

  // Build household members array following CMS API format from documentation
  // CRITICAL: CMS API requires BOTH age AND dob for accurate APTC/CSR calculations
  // Per documentation: "Either an age or dob value must be provided"
  // Without age, API cannot calculate household_aptc, household_csr, household_slcsp_premium
  const people = [];
  
  // Check if there's a married couple (spouse exists)
  const hasMarriedCouple = quoteData.spouses && quoteData.spouses.length > 0;
  
  // Add client - Always the "Self" relationship
  people.push({
    age: calculateAge(quoteData.client.dateOfBirth), // CRITICAL: Required for APTC/CSR calculation
    dob: quoteData.client.dateOfBirth, // DOB for accurate age calculation with effective_date
    aptc_eligible: true, // Per CMS docs: tax dependents are generally eligible if household qualifies
    does_not_cohabitate: false, // Per CMS docs: false means they live together (required for accurate APTC)
    has_mec: false, // No Minimal Essential Coverage (client needs insurance)
    gender: formatGenderForCMS(quoteData.client.gender),
    is_parent: false, // Per CMS docs: optional field for parent status
    is_pregnant: quoteData.client.pregnant || false,
    relationship: "Self", // CRITICAL: Required for APTC calculation
    uses_tobacco: quoteData.client.usesTobacco || false,
    utilization: "Medium", // Per CMS docs: one of Low/Medium/High - describes insurance usage
  });
  
  // Add spouses - Relationship "Spouse" is CRITICAL for APTC calculation
  if (quoteData.spouses && quoteData.spouses.length > 0) {
    quoteData.spouses.forEach(spouse => {
      people.push({
        age: calculateAge(spouse.dateOfBirth), // CRITICAL: Required for APTC/CSR calculation
        dob: spouse.dateOfBirth, // DOB for accurate age calculation with effective_date
        aptc_eligible: true, // Per CMS docs: tax dependents are generally eligible if household qualifies
        does_not_cohabitate: false, // Per CMS docs: false means they live together (required for accurate APTC)
        has_mec: false, // No Minimal Essential Coverage (spouse needs insurance)
        gender: formatGenderForCMS(spouse.gender),
        is_parent: false, // Per CMS docs: optional field for parent status
        is_pregnant: spouse.pregnant || false,
        relationship: "Spouse", // CRITICAL: Required for married couple APTC calculation
        uses_tobacco: spouse.usesTobacco || false,
        utilization: "Medium", // Per CMS docs: one of Low/Medium/High - describes insurance usage
      });
    });
  }
  
  // Add dependents - Relationship "Child" for proper household calculation
  if (quoteData.dependents && quoteData.dependents.length > 0) {
    quoteData.dependents.forEach(dependent => {
      // CRITICAL LOGIC per user requirement:
      // isApplicant === true  → Dependent NEEDS insurance (Medicaid denied) → aptc_eligible: true, has_mec: false
      // isApplicant === false → Dependent HAS Medicaid/CHIP → aptc_eligible: false, has_mec: true
      const needsInsurance = dependent.isApplicant !== false; // Default to true if not specified
      
      people.push({
        age: calculateAge(dependent.dateOfBirth), // CRITICAL: Required for APTC/CSR calculation
        dob: dependent.dateOfBirth, // DOB for accurate age calculation with effective_date
        aptc_eligible: needsInsurance, // Per CMS docs: only eligible if they need insurance (not on Medicaid/CHIP)
        does_not_cohabitate: false, // Per CMS docs: false means they live together (required for accurate APTC)
        has_mec: !needsInsurance, // Minimal Essential Coverage (Medicaid/CHIP) if NOT applicant
        gender: formatGenderForCMS(dependent.gender),
        is_parent: false, // Per CMS docs: optional field for parent status
        is_pregnant: dependent.pregnant || false, // CRITICAL: Use actual pregnancy status from database
        relationship: "Child", // CRITICAL: Required for proper household size calculation
        uses_tobacco: dependent.usesTobacco || false,
        utilization: "Medium", // Per CMS docs: one of Low/Medium/High - describes insurance usage
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

  // Calculate pagination parameters
  const currentPage = page;
  const limit = 100; // Try to get max, but API only returns 10
  const offset = (currentPage - 1) * 10; // Use 10 because that's what API actually returns

  // Build request body following the EXACT structure from documentation
  // IMPORTANTE: limit y offset van en el body, no en la URL
  const requestBody: any = {
    household: {
      income: quoteData.householdIncome, // Ingreso anual del hogar
      people: people, // Array de personas
      has_married_couple: hasMarriedCouple, // CRITICAL: Required for accurate APTC calculation for couples
    },
    market: 'Individual', // Mercado individual
    place: {
      countyfips: countyFips, // CRÍTICO: Código FIPS del condado
      state: quoteData.state, // Estado de 2 letras
      zipcode: quoteData.zipCode, // ZIP de 5 dígitos
    },
    year: year,
    // Paginación en el body según documentación
    limit: limit,
    offset: offset,
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
    console.log(`[CMS_MARKETPLACE] 📊 Página ${currentPage}: Solicitando hasta ${limit} planes, offset: ${offset}`);
    console.log('[CMS_MARKETPLACE] Request body:', JSON.stringify(requestBody, null, 2));
  }

  try {
    // CMS Marketplace API endpoint - exacto de la documentación
    const apiUrl = 'https://marketplace.api.healthcare.gov/api/v1/plans/search';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apikey': apiKey, // Mantenemos el API key aunque la doc dice que no es necesario
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
    
    // Log total plans available (only on first page)
    if (offset === 0 && data.total) {
      console.log(`[CMS_MARKETPLACE] 📊 Total de planes disponibles: ${data.total}`);
    }
    
    if (page === 1 || page % 5 === 0) { // Reduce logging noise
      console.log(`[CMS_MARKETPLACE] ✅ Página ${currentPage}: ${data.plans?.length || 0} planes obtenidos`);
    }
    
    // Agregar información del request para mostrar al usuario
    data.request_data = {
      household_income: quoteData.householdIncome,
      people_count: people.length,
      people: people.map((p: any) => ({
        age: p.age,
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
      limit: limit,
      offset: offset
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
        console.log('[CMS_MARKETPLACE] 🎯 FOUND OSCAR PLAN 40572FL0200025 ON PAGE ' + currentPage + ':');
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
