/**
 * Script para ver detalhes de um template específico
 */

import axios from 'axios';

const WABA_ID = '1377104410568104';
const ACCESS_TOKEN = 'EAAhLVq96CJ8BQLpnUGYLgrdQBJQAkq5E5Ma7MxYK9DPtmCOVIn9XSULZBMimDAPRfNCeR9VloyxzUNMh45TcpkL2zlGcYtYF5TIsbpvDbkd0ZBYPhzbDT08SWjzwIog2muJzhpGZARFTrsgmZCX1lQzXZAvo6YiK4aVZAUImdwIZB5PGU8eZAThLbadxpOcG7QZDZD';
const BASE_URL = 'https://graph.facebook.com/v21.0';

const templateName = process.argv[2] || 'carousel_quartos_7cards';

async function main() {
  console.log(`Buscando template: ${templateName}\n`);

  try {
    const response = await axios.get(
      `${BASE_URL}/${WABA_ID}/message_templates`,
      {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        params: { name: templateName }
      }
    );

    if (response.data.data.length === 0) {
      console.log('Template não encontrado');
      return;
    }

    const template = response.data.data[0];
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   DETALHES DO TEMPLATE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Nome:', template.name);
    console.log('ID:', template.id);
    console.log('Status:', template.status);
    console.log('Categoria:', template.category);
    console.log('Idioma:', template.language);
    console.log('Rejected Reason:', template.rejected_reason || 'N/A');
    console.log('Quality Score:', JSON.stringify(template.quality_score) || 'N/A');

    console.log('\nResponse completa:');
    console.log(JSON.stringify(template, null, 2));
  } catch (error: any) {
    console.error('Erro:', error.response?.data || error.message);
  }
}

main();
