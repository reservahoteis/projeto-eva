/**
 * Script para verificar motivo de rejeição dos templates
 */

import axios from 'axios';

const WABA_ID = '1377104410568104';
const ACCESS_TOKEN = 'EAAhLVq96CJ8BQLpnUGYLgrdQBJQAkq5E5Ma7MxYK9DPtmCOVIn9XSULZBMimDAPRfNCeR9VloyxzUNMh45TcpkL2zlGcYtYF5TIsbpvDbkd0ZBYPhzbDT08SWjzwIog2muJzhpGZARFTrsgmZCX1lQzXZAvo6YiK4aVZAUImdwIZB5PGU8eZAThLbadxpOcG7QZDZD';
const BASE_URL = 'https://graph.facebook.com/v21.0';

async function checkRejectedTemplates() {
  const response = await axios.get(
    `${BASE_URL}/${WABA_ID}/message_templates`,
    {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      params: { limit: 100 }
    }
  );

  const rejected = response.data.data.filter((t: any) =>
    t.name.includes('carousel_acomodacoes') && t.status === 'REJECTED'
  );

  console.log('Templates rejeitados:\n');
  for (const t of rejected) {
    console.log(`=== ${t.name} ===`);
    console.log('Status:', t.status);
    console.log('Rejected Reason:', t.rejected_reason || 'N/A');
    console.log('Quality Score:', JSON.stringify(t.quality_score, null, 2));
    console.log('---');
  }
}

checkRejectedTemplates().catch(console.error);
