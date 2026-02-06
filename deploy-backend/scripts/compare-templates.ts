/**
 * Script para comparar templates aprovados vs rejeitados
 */

import axios from 'axios';

const WABA_ID = '1377104410568104';
const ACCESS_TOKEN = 'EAAhLVq96CJ8BQLpnUGYLgrdQBJQAkq5E5Ma7MxYK9DPtmCOVIn9XSULZBMimDAPRfNCeR9VloyxzUNMh45TcpkL2zlGcYtYF5TIsbpvDbkd0ZBYPhzbDT08SWjzwIog2muJzhpGZARFTrsgmZCX1lQzXZAvo6YiK4aVZAUImdwIZB5PGU8eZAThLbadxpOcG7QZDZD';
const BASE_URL = 'https://graph.facebook.com/v21.0';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   COMPARAÇÃO DE TEMPLATES');
  console.log('═══════════════════════════════════════════════════════════════');

  // Listar todos os templates carousel_acomodacoes
  const response = await axios.get(
    `${BASE_URL}/${WABA_ID}/message_templates`,
    {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      params: { limit: 100 }
    }
  );

  const carouselTemplates = response.data.data.filter((t: any) =>
    t.name.includes('carousel_acomodacoes') || t.name.includes('carousel_geral') || t.name.includes('carousel_fotos')
  );

  console.log('\n📋 Todos os templates de carousel:');
  console.log('────────────────────────────────────────────────────────────────');

  // Agrupar por status
  const approved = carouselTemplates.filter((t: any) => t.status === 'APPROVED');
  const rejected = carouselTemplates.filter((t: any) => t.status === 'REJECTED');
  const pending = carouselTemplates.filter((t: any) => t.status === 'PENDING');

  console.log('\n✅ APROVADOS:');
  for (const t of approved) {
    console.log(`   - ${t.name}`);
  }

  console.log('\n❌ REJEITADOS:');
  for (const t of rejected) {
    console.log(`   - ${t.name}`);
    // Buscar mais detalhes
    console.log(`     Reason: ${t.rejected_reason || 'N/A'}`);
  }

  console.log('\n⏳ PENDENTES:');
  for (const t of pending) {
    console.log(`   - ${t.name}`);
  }

  // Padrão observado
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   📊 ANÁLISE');
  console.log('═══════════════════════════════════════════════════════════════');

  const approvedCounts = approved
    .filter((t: any) => t.name.includes('carousel_acomodacoes'))
    .map((t: any) => {
      const match = t.name.match(/(\d+)card/);
      return match ? parseInt(match[1]) : 0;
    })
    .sort((a: number, b: number) => a - b);

  const rejectedCounts = rejected
    .filter((t: any) => t.name.includes('carousel_acomodacoes'))
    .map((t: any) => {
      const match = t.name.match(/(\d+)card/);
      return match ? parseInt(match[1]) : 0;
    })
    .sort((a: number, b: number) => a - b);

  console.log(`\n   Aprovados (qtd cards): ${approvedCounts.join(', ')}`);
  console.log(`   Rejeitados (qtd cards): ${rejectedCounts.join(', ')}`);
}

main().catch(console.error);
