/**
 * CMS Marketplace API Integration
 * 
 * This service integrates with the healthcare.gov CMS Marketplace API
 * to fetch real-time health insurance plan quotations based on client data.
 */

import { credentialProvider } from "./services/credential-provider";

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
  is_medicaid_chip?: boolean; // Indicates if household is Medicaid/CHIP eligible
  request_data?: any; // Data about the request for transparency
  currentPage?: number; // Current page number in pagination
  pageSize?: number; // Number of items per page
  totalPages?: number; // Total number of pages available
  totalCmsPlans?: number; // Total plans from CMS before filtering (for transparency)
  facets?: {
    carriers: Array<{ issuerId: string; name: string; count: number }>;
  };
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
 * Fetch household eligibility (APTC and CSR) from CMS Marketplace API
 * FIX for PROBLEM 1: The /plans/search endpoint does NOT return household_aptc
 * We must call the /households/eligibility/estimates endpoint separately
 */
export async function fetchHouseholdEligibility(
  quoteData: {
    zipCode: string;
    county: string;
    state: string;
    householdIncome: number;
    effectiveDate?: string;
    client: {
      dateOfBirth: string;
      gender?: string;
      usesTobacco?: boolean;
    };
    spouses?: Array<{
      dateOfBirth: string;
      gender?: string;
      usesTobacco?: boolean;
      aptc_eligible?: boolean;
    }>;
    dependents?: Array<{
      dateOfBirth: string;
      gender?: string;
      usesTobacco?: boolean;
      isApplicant?: boolean;
    }>;
  },
  yearOverride?: number
): Promise<{ aptc: number; csr: string; is_medicaid_chip?: boolean } | null> {
  const { apiKey } = await credentialProvider.getCmsApi();
  
  if (!apiKey) {
    throw new Error('CMS Marketplace API key not configured in database');
  }

  const year = yearOverride || new Date().getFullYear();
  
  // Build people array - use DOB directly per CMS spec
  const people = [];
  
  // Add client (always the primary applicant)
  people.push({
    dob: quoteData.client.dateOfBirth, // Send DOB directly (not calculated age)
    aptc_eligible: true,
    has_mec: false,
    gender: formatGenderForCMS(quoteData.client.gender),
    uses_tobacco: quoteData.client.usesTobacco || false,
    relationship: 'Self', // Primary applicant
  });
  
  // Add spouses
  if (quoteData.spouses && quoteData.spouses.length > 0) {
    quoteData.spouses.forEach(spouse => {
      const isApplicant = spouse.aptc_eligible !== false;
      people.push({
        dob: spouse.dateOfBirth, // Send DOB directly (not calculated age)
        aptc_eligible: isApplicant,
        has_mec: false,
        gender: formatGenderForCMS(spouse.gender),
        uses_tobacco: spouse.usesTobacco || false,
        relationship: 'Spouse', // Spouse relationship
      });
    });
  }
  
  // Add dependents (children)
  if (quoteData.dependents && quoteData.dependents.length > 0) {
    quoteData.dependents.forEach(dependent => {
      const needsInsurance = dependent.isApplicant !== false;
      people.push({
        dob: dependent.dateOfBirth, // Send DOB directly (not calculated age)
        aptc_eligible: needsInsurance,
        has_mec: false,
        gender: formatGenderForCMS(dependent.gender),
        uses_tobacco: dependent.usesTobacco || false,
        relationship: 'Child', // Child relationship (CRITICAL for Medicaid-denied cases)
      });
    });
  }

  // Get county FIPS code
  const countyFips = await getCountyFips(quoteData.zipCode, quoteData.county, quoteData.state);
  if (!countyFips) {
    console.error('[CMS_MARKETPLACE_ELIGIBILITY] ❌ Could not determine county FIPS code');
    return null;
  }

  // Use REAL income - do NOT adjust it
  // The CMS API will calculate the correct APTC based on actual household income
  // Even if some members show "is_medicaid_chip: true", they were denied so APTC applies
  const requestBody = {
    household: {
      income: quoteData.householdIncome,
      people: people,
    },
    place: {
      countyfips: countyFips,
      state: quoteData.state,
      zipcode: quoteData.zipCode,
    },
    year: year,
  };

  try {
    const apiUrl = `https://marketplace.api.healthcare.gov/api/v1/households/eligibility/estimates?apikey=${apiKey}`;
    
    console.log('[CMS_MARKETPLACE_ELIGIBILITY] 🔍 Fetching APTC/CSR from eligibility endpoint...');
    console.log('[CMS_MARKETPLACE_ELIGIBILITY] 📤 Request Body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error('[CMS_MARKETPLACE_ELIGIBILITY] API Error:', response.status);
      const errorText = await response.text();
      console.error('[CMS_MARKETPLACE_ELIGIBILITY] ❌ Error Response:', errorText);
      return null;
    }

    const data = await response.json();
    console.log('[CMS_MARKETPLACE_ELIGIBILITY] 📥 Full Response:', JSON.stringify(data, null, 2));
    
    if (data.estimates && data.estimates.length > 0) {
      const estimate = data.estimates[0];
      console.log(`[CMS_MARKETPLACE_ELIGIBILITY] ✅ APTC: $${estimate.aptc}, CSR: ${estimate.csr}, is_medicaid_chip: ${estimate.is_medicaid_chip}`);
      return {
        aptc: estimate.aptc,
        csr: estimate.csr,
        is_medicaid_chip: estimate.is_medicaid_chip,
      };
    }
    
    console.log('[CMS_MARKETPLACE_ELIGIBILITY] ⚠️ No estimates found in response');
    return null;
  } catch (error) {
    console.error('[CMS_MARKETPLACE_ELIGIBILITY] Error:', error);
    return null;
  }
}

/**
 * Fetch health insurance plans from CMS Marketplace API
 * 
 * CRITICAL FIX IMPLEMENTED:
 * - Continuously fetches CMS pages until enough FILTERED results are accumulated
 * - Applies filters after each batch to ensure we don't miss plans on later pages
 * - Stops when either: enough filtered results for requested page OR all CMS data exhausted
 * - Returns accurate pagination metadata based on filtered totals, not CMS raw data
 * 
 * This ensures filters work correctly even when matching plans are on later CMS pages,
 * preventing the issue where filters would return 0 results incorrectly.
 */
export async function fetchMarketplacePlans(
  quoteData: {
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
      aptc_eligible?: boolean;
    }>;
    dependents?: Array<{
      dateOfBirth: string;
      gender?: string;
      pregnant?: boolean;
      usesTobacco?: boolean;
      isApplicant?: boolean;
    }>;
  },
  page: number = 1,
  pageSize: number = 100,
  yearOverride?: number,
  filters?: {
    metalLevels?: string[];
    issuers?: string[];
    networks?: string[];
    diseasePrograms?: string[];
    maxPremium?: number;
    maxDeductible?: number;
    planFeatures?: string[];
  },
  aptcOverride?: number
): Promise<MarketplaceApiResponse> {
  // Validate yearOverride if provided
  if (yearOverride && (yearOverride < 2025 || yearOverride > 2030)) {
    throw new Error(`Year override must be between 2025 and 2030, received: ${yearOverride}`);
  }
  
  const targetYear = yearOverride || new Date().getFullYear();
  console.log(`[CMS_MARKETPLACE] 🚀 Fetching plans - Page ${page}, PageSize ${pageSize}, Year ${targetYear}`);
  
  // Step 1: ALWAYS call /households/eligibility/estimates to get authoritative APTC
  // This endpoint returns APTC even when income < 138% FPL (Medicaid expansion threshold)
  // It also returns is_medicaid_chip flag which we'll document in the response
  console.log('[CMS_MARKETPLACE] 📊 Step 1: Fetching eligibility from /households/eligibility/estimates...');
  let eligibility: { aptc: number; csr: string; is_medicaid_chip?: boolean } | null = null;
  
  try {
    eligibility = await fetchHouseholdEligibility(quoteData, yearOverride);
    if (eligibility) {
      console.log(`[CMS_MARKETPLACE] ✅ Eligibility: APTC=$${eligibility.aptc}, CSR=${eligibility.csr}, is_medicaid_chip=${eligibility.is_medicaid_chip}`);
    } else {
      console.log('[CMS_MARKETPLACE] ⚠️ Eligibility endpoint returned null');
    }
  } catch (error) {
    console.error('[CMS_MARKETPLACE] ❌ Error fetching eligibility:', error);
    // Continue anyway - /plans/search might still work without APTC override
  }
  
  // CRITICAL FIX - Keep fetching CMS pages until we have enough filtered results
  // OR we've exhausted all available CMS data
  const PLANS_PER_API_PAGE = 10; // CMS API hard limit
  console.log('[CMS_MARKETPLACE] 📄 Step 2: Fetching and filtering plans from CMS...');
  
  let allCmsPlans: MarketplacePlan[] = [];
  let filteredAccumulator: MarketplacePlan[] = [];
  let totalCmsPlans = 0;
  let year = targetYear;
  let cmsOffset = 0;
  let cmsFetchCount = 0;
  
  // ALWAYS fetch ALL plans from CMS API, then apply pagination to the filtered results
  // This ensures users see all available plans with proper filtering and pagination
  while (true) {
    cmsFetchCount++;
    console.log(`[CMS_MARKETPLACE] 📄 Fetching CMS batch #${cmsFetchCount} (offset=${cmsOffset})...`);
    
    // Step 2: Use the APTC from eligibility endpoint as aptc_override in /plans/search
    // This forces the CMS API to apply APTC even when is_medicaid_chip: true
    const aptcToUse = eligibility?.aptc;
    const apiResponse = await fetchSinglePage(quoteData, cmsOffset, yearOverride, filters, aptcToUse);
    
    if (apiResponse.plans && apiResponse.plans.length > 0) {
      // Add to all CMS plans collection
      allCmsPlans = allCmsPlans.concat(apiResponse.plans);
      totalCmsPlans = apiResponse.total;
      year = apiResponse.year;
      
      // Apply filters to the new batch
      let batchFiltered = apiResponse.plans;
      
      // Filter by networks (plan.type)
      if (filters?.networks && filters.networks.length > 0) {
        batchFiltered = batchFiltered.filter((plan: MarketplacePlan) => 
          filters.networks!.includes(plan.type)
        );
      }
      
      // Filter by max premium
      if (filters?.maxPremium && filters.maxPremium > 0) {
        batchFiltered = batchFiltered.filter((plan: MarketplacePlan) => {
          const premium = plan.premium_w_credit !== undefined ? plan.premium_w_credit : plan.premium;
          return premium <= filters.maxPremium!;
        });
      }
      
      // Filter by max deductible
      if (filters?.maxDeductible && filters.maxDeductible > 0) {
        batchFiltered = batchFiltered.filter((plan: MarketplacePlan) => {
          const medicalDeductible = plan.deductibles?.find((d: any) => 
            d.type === 'Medical Deductible' || d.type === 'Medical EHB Deductible'
          );
          return !medicalDeductible || medicalDeductible.amount <= filters.maxDeductible!;
        });
      }
      
      // Filter by plan features
      if (filters?.planFeatures && filters.planFeatures.length > 0) {
        batchFiltered = batchFiltered.filter((plan: MarketplacePlan) => {
          return filters.planFeatures!.every(feature => {
            if (feature === 'dental_child') return plan.has_dental_child_coverage;
            if (feature === 'dental_adult') return plan.has_dental_adult_coverage;
            if (feature === 'hsa_eligible') return plan.hsa_eligible;
            if (feature === 'simple_choice') return plan.simple_choice;
            return false;
          });
        });
      }
      
      // Add filtered results to accumulator
      filteredAccumulator = filteredAccumulator.concat(batchFiltered);
      
      console.log(`[CMS_MARKETPLACE] Batch #${cmsFetchCount}: ${apiResponse.plans.length} CMS plans, ${batchFiltered.length} passed filters`);
      console.log(`[CMS_MARKETPLACE] Total accumulated: ${filteredAccumulator.length} filtered plans of ${allCmsPlans.length} CMS plans fetched`);
    }
    
    // Check if we've exhausted all CMS data
    const reachedEndOfCmsData = !apiResponse.plans || 
                                 apiResponse.plans.length === 0 || 
                                 apiResponse.plans.length < PLANS_PER_API_PAGE ||
                                 allCmsPlans.length >= totalCmsPlans;
    
    if (reachedEndOfCmsData) {
      console.log(`[CMS_MARKETPLACE] ✅ Exhausted all CMS data (${allCmsPlans.length} of ${totalCmsPlans} total CMS plans)`);
      break;
    }
    
    // Move to next CMS page
    cmsOffset += PLANS_PER_API_PAGE;
    
    // Safety limit to prevent infinite loops (max 100 pages = 1000 plans)
    if (cmsFetchCount >= 100) {
      console.log('[CMS_MARKETPLACE] ⚠️ Reached safety limit of 100 CMS page fetches');
      break;
    }
  }
  
  console.log(`[CMS_MARKETPLACE] ✅ Final totals: ${allCmsPlans.length} CMS plans fetched, ${filteredAccumulator.length} passed filters`);
  console.log(`[CMS_MARKETPLACE] ✅ household_aptc: $${eligibility?.aptc || 'NOT AVAILABLE'}`);
  console.log(`[CMS_MARKETPLACE] ✅ household_csr: ${eligibility?.csr || 'NOT AVAILABLE'}`);
  console.log(`[CMS_MARKETPLACE] ✅ is_medicaid_chip: ${eligibility?.is_medicaid_chip ?? 'NOT AVAILABLE'}`);
  
  // Step 3: Calculate facets from ALL filtered plans (before pagination)
  const carrierCounts = new Map<string, { issuerId: string; name: string; count: number }>();
  filteredAccumulator.forEach(plan => {
    const issuerId = plan.issuer?.id || 'unknown';
    const name = plan.issuer?.name || 'Unknown';
    const existing = carrierCounts.get(issuerId);
    if (existing) {
      existing.count++;
    } else {
      carrierCounts.set(issuerId, { issuerId, name, count: 1 });
    }
  });
  
  const facets = {
    carriers: Array.from(carrierCounts.values()).sort((a, b) => a.name.localeCompare(b.name))
  };
  
  console.log(`[CMS_MARKETPLACE] ✅ Facets calculated: ${facets.carriers.length} unique carriers`);
  
  // Step 4: Calculate pagination on the already-filtered results
  const totalFilteredPlans = filteredAccumulator.length;
  const totalPages = Math.ceil(totalFilteredPlans / pageSize);
  
  // Return paginated subset of filtered plans
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedPlans = filteredAccumulator.slice(startIndex, endIndex);
  
  console.log(`[CMS_MARKETPLACE] ✅ Final result: Page ${page}/${totalPages}, showing ${paginatedPlans.length} of ${totalFilteredPlans} filtered plans`);
  
  // Return combined response with eligibility data, facets, and proper pagination metadata
  return {
    plans: paginatedPlans,
    total: totalFilteredPlans, // Total after filtering
    totalPages: totalPages, // Total pages after filtering
    currentPage: page,
    pageSize: pageSize,
    year: year,
    household_aptc: eligibility?.aptc,
    household_csr: eligibility?.csr,
    is_medicaid_chip: eligibility?.is_medicaid_chip, // Document Medicaid eligibility flag
    totalCmsPlans: totalCmsPlans, // Add for transparency
    facets: facets, // Facets calculated from all filtered plans
  };
}

/**
 * Fetch a single page of marketplace plans - internal helper function
 * SIMPLIFIED: Uses ONLY the minimal required fields per official CMS API documentation
 * FIX: Uses offset in request BODY (not query params)
 */
async function fetchSinglePage(
  quoteData: {
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
      aptc_eligible?: boolean;
    }>;
    dependents?: Array<{
      dateOfBirth: string;
      gender?: string;
      pregnant?: boolean;
      usesTobacco?: boolean;
      isApplicant?: boolean;
    }>;
  },
  offset: number,
  yearOverride?: number,
  filters?: {
    metalLevels?: string[];
    issuers?: string[];
    networks?: string[];
    diseasePrograms?: string[];
    maxPremium?: number;
    maxDeductible?: number;
    planFeatures?: string[];
  },
  aptcOverride?: number
): Promise<MarketplaceApiResponse> {
  const { apiKey } = await credentialProvider.getCmsApi();
  
  if (!apiKey) {
    throw new Error('CMS Marketplace API key not configured in database');
  }

  const year = yearOverride || new Date().getFullYear();

  // Build household members array - use DOB directly per CMS spec
  // Per official CMS API docs: dob, aptc_eligible, gender, uses_tobacco, relationship
  const people = [];
  
  // Check if there's a married couple (spouse exists)
  const hasMarriedCouple = quoteData.spouses && quoteData.spouses.length > 0;
  
  // Add client - send DOB directly (not calculated age)
  people.push({
    dob: quoteData.client.dateOfBirth,
    aptc_eligible: true,
    gender: formatGenderForCMS(quoteData.client.gender),
    uses_tobacco: quoteData.client.usesTobacco || false,
    relationship: 'Self',
  });
  
  // Add spouses - send DOB directly (not calculated age)
  if (quoteData.spouses && quoteData.spouses.length > 0) {
    quoteData.spouses.forEach(spouse => {
      const isApplicant = spouse.aptc_eligible !== false;
      
      people.push({
        dob: spouse.dateOfBirth,
        aptc_eligible: isApplicant,
        gender: formatGenderForCMS(spouse.gender),
        uses_tobacco: spouse.usesTobacco || false,
        relationship: 'Spouse',
      });
    });
  }
  
  // Add dependents - send DOB directly (not calculated age)
  if (quoteData.dependents && quoteData.dependents.length > 0) {
    quoteData.dependents.forEach(dependent => {
      const needsInsurance = dependent.isApplicant !== false;
      
      people.push({
        dob: dependent.dateOfBirth,
        aptc_eligible: needsInsurance,
        gender: formatGenderForCMS(dependent.gender),
        uses_tobacco: dependent.usesTobacco || false,
        relationship: 'Child',
      });
    });
  }

  // Get county FIPS code
  const countyFips = await getCountyFips(quoteData.zipCode, quoteData.county, quoteData.state);
  
  if (!countyFips) {
    console.error('[CMS_MARKETPLACE] ❌ Could not determine county FIPS code');
    throw new Error(`Unable to determine county FIPS for ${quoteData.county}, ${quoteData.state}. Please verify the address information.`);
  }

  // Build SIMPLIFIED request body with MINIMAL fields
  const requestBody: any = {
    household: {
      income: quoteData.householdIncome,
      people: people,
      has_married_couple: hasMarriedCouple,
    },
    market: 'Individual',
    place: {
      countyfips: countyFips,
      state: quoteData.state,
      zipcode: quoteData.zipCode,
    },
    year: year,
    offset: offset, // FIX: Pagination via offset in BODY
  };
  
  // Add effective_date if provided
  if (quoteData.effectiveDate) {
    requestBody.household.effective_date = quoteData.effectiveDate;
  }
  
  // Add aptc_override if provided (top-level parameter per CMS API docs)
  if (aptcOverride !== undefined) {
    requestBody.aptc_override = aptcOverride;
    console.log(`[CMS_MARKETPLACE] Using APTC override: $${aptcOverride}`);
  }

  // Add filters if provided (CMS API native filters)
  if (filters) {
    const filterObj: any = {};
    
    // Metal levels filter
    if (filters.metalLevels && filters.metalLevels.length > 0) {
      filterObj.metal_levels = filters.metalLevels;
    }
    
    // Issuers filter (carriers)
    if (filters.issuers && filters.issuers.length > 0) {
      filterObj.issuers = filters.issuers;
    }
    
    // Network type filter (division in CMS API)
    if (filters.networks && filters.networks.length > 0) {
      // CMS API uses 'division' for network type filtering
      // For now, we'll handle this in frontend since CMS API's division mapping is unclear
      // filterObj.division = filters.networks[0]; // CMS accepts single division, not array
    }
    
    // Disease management programs filter
    if (filters.diseasePrograms && filters.diseasePrograms.length > 0) {
      filterObj.disease_mgmt_programs = filters.diseasePrograms;
    }
    
    // Only add filter object if it has properties
    if (Object.keys(filterObj).length > 0) {
      requestBody.filter = filterObj;
    }
  }

  try {
    // FIX: Simple API URL without pagination query params
    const apiUrl = `https://marketplace.api.healthcare.gov/api/v1/plans/search?apikey=${apiKey}`;
    
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
    
    // Log what CMS API actually returns
    console.log('[CMS_MARKETPLACE] 📥 CMS API Response Keys:', Object.keys(data));
    console.log('[CMS_MARKETPLACE] 📥 household_aptc from API:', data.household_aptc);
    console.log('[CMS_MARKETPLACE] 📥 household_csr from API:', data.household_csr);
    
    // Add request metadata for transparency
    data.request_data = {
      household_income: quoteData.householdIncome,
      people_count: people.length,
      people: people.map((p: any) => ({
        dob: p.dob,
        gender: p.gender,
        relationship: p.relationship,
        tobacco: p.uses_tobacco,
        aptc_eligible: p.aptc_eligible
      })),
      location: {
        zip: quoteData.zipCode,
        state: quoteData.state,
        county: quoteData.county,
        county_fips: countyFips
      },
      year: year,
      offset: offset
    };
    
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
  const { apiKey } = await credentialProvider.getCmsApi();
  
  if (!apiKey) {
    throw new Error('CMS Marketplace API key not configured in database');
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
