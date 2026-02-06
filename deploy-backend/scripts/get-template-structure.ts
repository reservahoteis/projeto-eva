/**
 * Script para ver estrutura completa de um template aprovado
 */

import axios from 'axios';

const WABA_ID = '1377104410568104';
const ACCESS_TOKEN = 'EAAhLVq96CJ8BQLpnUGYLgrdQBJQAkq5E5Ma7MxYK9DPtmCOVIn9XSULZBMimDAPRfNCeR9VloyxzUNMh45TcpkL2zlGcYtYF5TIsbpvDbkd0ZBYPhzbDT08SWjzwIog2muJzhpGZARFTrsgmZCX1lQzXZAvo6YiK4aVZAUImdwIZB5PGU8eZAThLbadxpOcG7QZDZD';
const BASE_URL = 'https://graph.facebook.com/v21.0';

async function main() {
  // Listar todos os templates
  const response = await axios.get(
    `${BASE_URL}/${WABA_ID}/message_templates`,
    {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      params: { limit: 100 }
    }
  );

  // Buscar carousel_geral_7cards (aprovado com 7 cards)
  const geral7 = response.data.data.find((t: any) => t.name === 'carousel_geral_7cards');

  // Buscar carousel_fotos_track_8cards (aprovado com 8 cards)
  const fotos8 = response.data.data.find((t: any) => t.name === 'carousel_fotos_track_8cards');

  // Buscar carousel_acomodacoes_6cards (aprovado)
  const acomod6 = response.data.data.find((t: any) => t.name === 'carousel_acomodacoes_6cards');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   ESTRUTURA DOS TEMPLATES APROVADOS');
  console.log('═══════════════════════════════════════════════════════════════');

  if (geral7) {
    console.log('\n📋 carousel_geral_7cards (APROVADO - 7 cards):');
    console.log(JSON.stringify(geral7, null, 2));
  }

  if (fotos8) {
    console.log('\n📋 carousel_fotos_track_8cards (APROVADO - 8 cards):');
    console.log(JSON.stringify(fotos8, null, 2));
  }

  if (acomod6) {
    console.log('\n📋 carousel_acomodacoes_6cards (APROVADO - 6 cards):');
    console.log(JSON.stringify(acomod6, null, 2));
  }
}

main().catch(console.error);
