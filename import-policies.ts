import { db } from "./server/db";
import { quotes, policies, policyPlans, users } from "./shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import { parse } from "csv-parse/sync";
import { randomBytes } from "crypto";

// Configuration
const DRY_RUN = process.env.DRY_RUN !== 'false';
const CSV_FILE = 'attached_assets/on_ex_applications-export-14873324-20251108T204911-1-of-1_1762656355763.csv';

// Helper to generate 8-character unique ID
function generateShortId(): string {
  return randomBytes(4).toString('hex');
}

// Helper to parse M/D/YYYY or M/D/YY dates to yyyy-MM-dd
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr === 'false' || dateStr === '') return null;
  try {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    
    let [month, day, year] = parts;
    
    // Handle 2-digit years
    if (year.length === 2) {
      const yearNum = parseInt(year);
      year = yearNum >= 50 ? `19${year}` : `20${year}`;
    }
    
    // Pad month and day
    month = month.padStart(2, '0');
    day = day.padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    return null;
  }
}

// Helper to normalize phone (add "1" prefix if 10 digits)
function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '1' + digits;
  if (digits.length === 11) return digits;
  return digits;
}

// Helper to parse household income from masked value
function parseIncome(income: string): string | null {
  if (!income || income === '******') return null;
  return income;
}

async function importPolicies() {
  console.log('🚀 Starting policy import...');
  console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'PRODUCTION (will insert data)'}\n`);
  
  // 1. Get Claudia Ferreiro's user ID and company ID
  console.log('📌 Finding Claudia Ferreiro in database...');
  const claudia = await db.query.users.findFirst({
    where: eq(users.email, 'claudia@cobertisinsurance.com')
  });
  
  if (!claudia || !claudia.companyId) {
    console.error('❌ Claudia Ferreiro not found or has no company');
    process.exit(1);
  }
  
  console.log(`✅ Found Claudia: ${claudia.id}, Company: ${claudia.companyId}\n`);
  
  // 2. Read and parse CSV using csv-parse library
  console.log('📄 Reading CSV file...');
  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  
  console.log(`📊 Found ${records.length} records in CSV\n`);
  
  const results = {
    success: 0,
    skipped: 0,
    failed: 0,
    errors: [] as any[]
  };
  
  // 3. Process each record
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const rowNum = i + 2; // +2 because: +1 for header, +1 for 0-index
    
    try {
      console.log(`\n[${rowNum}/${records.length + 1}] Processing: ${record.first_name} ${record.last_name}...`);
      
      // Check for duplicates using marketplace IDs
      const marketplaceId = record.ffm_app_id || null;
      const subscriberId = record.ffm_subscriber_id || null;
      const ssn = record.ssn !== '***-**-****' ? record.ssn : null;
      const dob = parseDate(record.dob);
      
      // Skip if already exists
      if (marketplaceId) {
        const existing = await db.query.policies.findFirst({
          where: eq(policies.marketplaceId, marketplaceId)
        });
        if (existing) {
          console.log(`  ⏭️  Skipped: Already exists (marketplaceId: ${marketplaceId})`);
          results.skipped++;
          continue;
        }
      }
      
      // Parse and validate dates
      const effectiveDate = parseDate(record.effective_date);
      const clientDob = dob;
      
      // Use defaults for missing required fields
      const clientFirstName = record.first_name || 'Unknown';
      const clientLastName = record.last_name || 'Unknown';
      const clientEmail = record.email || `imported${rowNum}@curbe.io`;
      const clientPhone = normalizePhone(record.phone) || '10000000000'; // Default phone if missing
      
      // Validate required fields
      if (!effectiveDate) {
        throw new Error(`Missing required field: effective_date`);
      }
      
      // Prepare data with defaults
      const quoteData = {
        id: generateShortId(),
        companyId: claudia.companyId,
        createdBy: claudia.id,
        agentId: claudia.id,
        effectiveDate: effectiveDate,
        productType: 'aca' as const,
        clientFirstName,
        clientLastName,
        clientEmail,
        clientPhone,
        clientDateOfBirth: clientDob,
        clientGender: record.gender === 'male' ? 'male' as const : record.gender === 'female' ? 'female' as const : null,
        clientSsn: ssn,
        clientPreferredLanguage: record.preferred_language || 'English',
        physical_street: record.address || record.street_address || null,
        physical_address_line_2: record.unit || null,
        physical_city: record.city || null,
        physical_state: record.state || null,
        physical_postal_code: record.zip_code || null,
        physical_county: record.county || null,
        annualHouseholdIncome: parseIncome(record.household_income),
        familyGroupSize: record.household_size ? parseInt(record.household_size) : null,
        status: 'pending' as const,
        notes: `Imported from CSV on ${new Date().toISOString().split('T')[0]}. Original FFM ID: ${marketplaceId || 'N/A'}, Subscriber ID: ${subscriberId || 'N/A'}`
      };
      
      const policyData = {
        id: generateShortId(),
        quoteId: quoteData.id,
        companyId: claudia.companyId,
        createdBy: claudia.id,
        agentId: claudia.id,
        effectiveDate: effectiveDate,
        productType: 'aca' as const,
        clientFirstName,
        clientLastName,
        clientEmail,
        clientPhone,
        clientDateOfBirth: clientDob,
        clientGender: record.gender === 'male' ? 'male' as const : record.gender === 'female' ? 'female' as const : null,
        clientSsn: ssn,
        clientPreferredLanguage: record.preferred_language || 'English',
        physical_street: record.address || record.street_address || null,
        physical_address_line_2: record.unit || null,
        physical_city: record.city || null,
        physical_state: record.state || null,
        physical_postal_code: record.zip_code || null,
        physical_county: record.county || null,
        annualHouseholdIncome: parseIncome(record.household_income),
        familyGroupSize: record.household_size ? parseInt(record.household_size) : null,
        status: record.policy_status === 'Effectuated' ? 'active' as const : 'pending' as const,
        memberId: subscriberId,
        marketplaceId: marketplaceId,
        notes: `Imported from CSV. Original status: ${record.policy_status || 'Unknown'}. Issuer: ${record.issuer || 'Unknown'}. Plan: ${record.plan_name || 'Unknown'}`
      };
      
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would create quote: ${quoteData.id}`);
        console.log(`  [DRY RUN] Would create policy: ${policyData.id}`);
        if (record.premium && parseFloat(record.premium) > 0) {
          console.log(`  [DRY RUN] Would create policy plan with premium $${record.premium}`);
        }
        results.success++;
      } else {
        // Use transaction for atomicity
        await db.transaction(async (tx) => {
          // Insert quote
          await tx.insert(quotes).values(quoteData);
          console.log(`  ✓ Created quote: ${quoteData.id}`);
          
          // Insert policy
          await tx.insert(policies).values(policyData);
          console.log(`  ✓ Created policy: ${policyData.id}`);
          
          // Insert policy plan if we have premium info
          if (record.premium && parseFloat(record.premium) > 0) {
            await tx.insert(policyPlans).values({
              policyId: policyData.id,
              planName: record.plan_name || 'Imported ACA Plan',
              carrier: record.issuer || 'Unknown Carrier',
              premium: parseFloat(record.premium),
              effectiveDate: effectiveDate,
              subsidy: record.subsidy ? parseFloat(record.subsidy) : null,
              isPrimary: true
            });
            console.log(`  ✓ Created policy plan with premium $${record.premium}`);
          }
        });
        
        results.success++;
      }
      
      console.log(`  ✅ ${DRY_RUN ? 'Would import' : 'Successfully imported'} (${results.success}/${records.length})`);
      
    } catch (error: any) {
      results.failed++;
      results.errors.push({ 
        row: rowNum, 
        name: `${record.first_name || 'Unknown'} ${record.last_name || 'Unknown'}`, 
        error: error.message 
      });
      console.error(`  ❌ Failed: ${error.message}`);
    }
  }
  
  // Final report
  console.log('\n' + '='.repeat(70));
  console.log(`📊 IMPORT SUMMARY ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(70));
  console.log(`✅ ${DRY_RUN ? 'Would import' : 'Successfully imported'}: ${results.success}`);
  console.log(`⏭️  Skipped (duplicates): ${results.skipped}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success rate: ${((results.success / records.length) * 100).toFixed(1)}%`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Failed Records:');
    results.errors.forEach(err => {
      console.log(`  Row ${err.row}: ${err.name} - ${err.error}`);
    });
  }
  
  if (DRY_RUN) {
    console.log('\n💡 To execute the import, run: DRY_RUN=false tsx /tmp/import-policies-v2.ts');
  } else {
    console.log(`\n✅ Import complete! Created ${results.success} policies.`);
  }
}

// Run import
importPolicies().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
