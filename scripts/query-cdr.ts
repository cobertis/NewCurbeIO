import { SecretsService } from '../server/services/secrets-service';

const managedAccountId = '1db32018-deb6-47d0-89ce-24c3d3b6da3d';

async function queryCDR() {
  const secretsService = new SecretsService();
  let apiKey = await secretsService.getCredential('telnyx', 'api_key');
  
  if (!apiKey) {
    console.log('No API key found');
    return;
  }
  
  apiKey = apiKey.trim().replace(/[\r\n\t]/g, '');
  
  // Also try WebRTC record type
  for (const recordType of ['call-control', 'webrtc']) {
    console.log(`\n========== RECORD TYPE: ${recordType} ==========`);
    
    const params = new URLSearchParams();
    params.set('filter[record_type]', recordType);
    params.set('filter[date_range]', 'today');
    params.set('sort', '-started_at');
    params.set('page[size]', '20');
    
    const url = 'https://api.telnyx.com/v2/detail_records?' + params.toString();
    
    const response = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'x-managed-account-id': managedAccountId,
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Records:', data.data?.length || 0);
    
    if (data.meta) {
      console.log('Total Results:', data.meta.total_results);
    }
    
    // Show calls with duration > 60
    const longCalls = (data.data || []).filter((r: any) => r.call_sec >= 60);
    if (longCalls.length > 0) {
      console.log('\n*** LONG CALLS (>= 60s) ***');
      for (const r of longCalls) {
        console.log(`${r.started_at} | ${r.call_sec}s billed ${r.billed_sec}s | $${r.cost}`);
      }
    }
    
    // Show first 3 records
    console.log('\nMost Recent:');
    for (const r of (data.data || []).slice(0, 3)) {
      console.log(`${r.started_at} | ${r.direction} | ${r.call_sec || 0}s | $${r.cost}`);
    }
  }
  
  console.log('\n\nCurrent time UTC:', new Date().toISOString());
  console.log('Expected call time: 2025-12-11T18:43:39Z');
}

queryCDR().catch(console.error);
