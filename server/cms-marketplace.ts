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
  has_dental_adult_coverage?: boolean;
  has_dental_child_coverage?: boolean;
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
  },
  page?: number,
  pageSize?: number
): Promise<MarketplaceApiResponse> {
  // If page is specified, return just that page (for backwards compatibility)
  if (page && page > 1) {
    return fetchSinglePage(quoteData, page);
  }
  
  // Otherwise, fetch ALL plans in parallel
  console.log('[CMS_MARKETPLACE] 🚀 Iniciando carga rápida de TODOS los planes');
  
  // First, get the total count with page 1
  const firstPage = await fetchSinglePage(quoteData, 1);
  const totalPlans = firstPage.total || 0;
  
  if (totalPlans <= 10) {
    // If 10 or fewer plans, we already have them all
    return firstPage;
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
    pagePromises.push(fetchSinglePage(quoteData, page));
    
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
  
  // Return combined response with all plans
  return {
    ...firstPage,
    plans: uniquePlans,
    total: uniquePlans.length,
    request_data: firstPage.request_data
  };
}

/**
 * Fetch a single page of marketplace plans - internal helper function
 */
async function fetchSinglePage(
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
  },
  page: number
): Promise<MarketplaceApiResponse> {
  const apiKey = process.env.CMS_MARKETPLACE_API_KEY;
  
  if (!apiKey) {
    throw new Error('CMS_MARKETPLACE_API_KEY is not configured');
  }

  // Build household members array following CMS API format from documentation
  const people = [];
  
  // Add client - CRITICAL: aptc_eligible must be true for APTC calculation
  people.push({
    age: calculateAge(quoteData.client.dateOfBirth),
    aptc_eligible: true, // DEBE ser true para recibir créditos según documentación
    gender: formatGenderForCMS(quoteData.client.gender),
    uses_tobacco: quoteData.client.usesTobacco || false,
    is_pregnant: quoteData.client.pregnant || false,
    // Removed dob and relationship as they're not in the documentation payload
  });
  
  // Add spouses
  if (quoteData.spouses && quoteData.spouses.length > 0) {
    quoteData.spouses.forEach(spouse => {
      people.push({
        age: calculateAge(spouse.dateOfBirth),
        aptc_eligible: true, // DEBE ser true para recibir créditos
        gender: formatGenderForCMS(spouse.gender),
        uses_tobacco: spouse.usesTobacco || false,
        is_pregnant: spouse.pregnant || false,
      });
    });
  }
  
  // Add dependents
  if (quoteData.dependents && quoteData.dependents.length > 0) {
    quoteData.dependents.forEach(dependent => {
      people.push({
        age: calculateAge(dependent.dateOfBirth),
        aptc_eligible: true, // DEBE ser true para recibir créditos
        gender: formatGenderForCMS(dependent.gender),
        uses_tobacco: dependent.usesTobacco || false,
        is_pregnant: false, // Children usually not pregnant
      });
    });
  }

  const year = new Date().getFullYear(); // Current year

  // Get county FIPS code - CRÍTICO según documentación
  if (page === 1) { // Only log on first page to reduce noise
    console.log(`[CMS_MARKETPLACE] 📄 Página ${page}:`, {
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
  const requestBody = {
    household: {
      income: quoteData.householdIncome, // Ingreso anual del hogar
      people: people, // Array de personas
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
    // aptc_override: null, // Opcional - puede forzar un monto APTC específico
    // csr_override: null,  // Opcional - puede forzar un nivel CSR específico
  };

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
    
    // Primera iteración: guardar el total según documentación
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
    
    // Calculate household_aptc if not provided by the API
    // The CMS API may not always include household_aptc directly, so we calculate it
    // from the first plan that has premium_w_credit
    if (!data.household_aptc && data.plans && data.plans.length > 0) {
      // Find the first plan with premium_w_credit to calculate APTC
      const planWithCredit = data.plans.find(plan => 
        plan.premium_w_credit !== undefined && 
        plan.premium_w_credit !== null &&
        plan.premium > plan.premium_w_credit
      );
      
      if (planWithCredit && planWithCredit.premium_w_credit !== undefined) {
        // Calculate APTC as the difference between premium and premium_w_credit
        data.household_aptc = planWithCredit.premium - planWithCredit.premium_w_credit;
        console.log('[CMS_MARKETPLACE] 💰 APTC calculado desde los planes:', data.household_aptc);
      } else {
        // Set to 0 if no plans have tax credits
        data.household_aptc = 0;
        console.log('[CMS_MARKETPLACE] ⚠️ No se encontraron planes con crédito fiscal');
      }
    }
    
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
