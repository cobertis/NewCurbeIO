import { getManagedAccountConfig, buildHeaders } from './server/services/telnyx-e911-service';

async function reassignPhone() {
  const companyId = 'b5325600-9bf9-4eae-b34a-87d6ab2f5fb2';
  const phoneNumberId = '2846036949825750785';
  const texmlAppId = '2846165965526271975';
  
  const config = await getManagedAccountConfig(companyId);
  if (!config) {
    console.log('No config found');
    process.exit(1);
  }
  
  console.log('Reassigning phone number to TeXML app...');
  
  const response = await fetch(`https://api.telnyx.com/v2/phone_numbers/${phoneNumberId}`, {
    method: 'PATCH',
    headers: {
      ...buildHeaders(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      connection_id: texmlAppId,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Failed:', response.status, error);
    process.exit(1);
  }
  
  const data = await response.json();
  console.log('Success! Phone now assigned to:');
  console.log('- connection_id:', data.data.connection_id);
  console.log('- connection_name:', data.data.connection_name);
  
  process.exit(0);
}

reassignPhone().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
