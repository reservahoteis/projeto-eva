/**
 * Script para criar templates de carousel de 1 a 9 cards no WhatsApp Business API
 *
 * Templates: carousel_acomodacoes_1card até carousel_acomodacoes_9cards
 * - Cada card: imagem + body dinâmico + 2 botões (URL + Quick Reply)
 *
 * Uso:
 *   npx ts-node scripts/create-carousel-templates-1-9.ts
 */

/// <reference types="node" />
import axios from 'axios';

// ============================
// CONFIGURAÇÕES
// ============================

const WABA_ID = '1377104410568104';
const ACCESS_TOKEN = 'EAAhLVq96CJ8BQLpnUGYLgrdQBJQAkq5E5Ma7MxYK9DPtmCOVIn9XSULZBMimDAPRfNCeR9VloyxzUNMh45TcpkL2zlGcYtYF5TIsbpvDbkd0ZBYPhzbDT08SWjzwIog2muJzhpGZARFTrsgmZCX1lQzXZAvo6YiK4aVZAUImdwIZB5PGU8eZAThLbadxpOcG7QZDZD';

const SAMPLE_IMAGES = [
  'https://minio-api.srv02.messengermax.com.br/marciok/CamposDoJord%C3%A3o/SuiteArauc%C3%A1riaComHidro/campos-24.jpg',
  'https://minio-api.srv02.messengermax.com.br/marciok/CamposDoJord%C3%A3o/SuiteArauc%C3%A1riaFamilia/campos-278.jpg',
  'https://minio-api.srv02.messengermax.com.br/marciok/CamposDoJord%C3%A3o/SuiteVistaDaMantiqueira/campos-113.jpg',
  'https://minio-api.srv02.messengermax.com.br/marciok/CamposDoJord%C3%A3o/SuiteRetr%C3%B4VistaDasMontanhas/campos-94.jpg',
  'https://minio-api.srv02.messengermax.com.br/marciok/CamposDoJord%C3%A3o/SuiteSuperLuxoComBanheira/Heif%20para%20JPG%20%288%29.jpg',
  'https://minio-api.srv02.messengermax.com.br/hotelreserva/campos_suite_ofuro_casal_ou_familia/IMG_0320.jpeg',
  'https://minio-api.srv02.messengermax.com.br/marciok/CamposDoJord%C3%A3o/CabanaRetr%C3%B4MasterVistaMantiqueiraComHidro/IMG_2120_jpg.jpg',
  'https://minio-api.srv02.messengermax.com.br/marciok/CAMBURI/SuiteTerreaCasal/IMG_6229.jpg',
  'https://minio-api.srv02.messengermax.com.br/marciok/CAMBURI/SuiteSuperiorVistaJardim/IMG_4483.jpeg',
];

const ROOM_NAMES = [
  'Suite Araucaria Com Hidro',
  'Suite Araucaria Familia',
  'Suite Vista Da Mantiqueira',
  'Suite Retro Vista Das Montanhas',
  'Suite Super Luxo Com Banheira',
  'Suite Ofuro Casal',
  'Cabana Retro Master Vista Mantiqueira',
  'Suite Terrea Casal',
  'Suite Superior Vista Jardim',
];

const GRAPH_API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ============================
// FUNÇÕES AUXILIARES
// ============================

async function uploadSampleImage(imageUrl: string): Promise<string> {
  console.log(`   📤 Upload: ${imageUrl.split('/').pop()}`);

  const imageResponse = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });
  const imageBuffer = Buffer.from(imageResponse.data);

  const createSessionResponse = await axios.post(
    `${BASE_URL}/app/uploads`,
    {
      file_length: imageBuffer.length,
      file_type: 'image/jpeg',
      file_name: 'sample_image.jpg',
    },
    {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const uploadSessionId = createSessionResponse.data.id;

  const uploadResponse = await axios.post(
    `${BASE_URL}/${uploadSessionId}`,
    imageBuffer,
    {
      headers: {
        Authorization: `OAuth ${ACCESS_TOKEN}`,
        'Content-Type': 'application/octet-stream',
        file_offset: '0',
      },
    }
  );

  const rawHandle = uploadResponse.data.h;
  const headerHandle = rawHandle.split('\n')[0].trim();
  console.log(`      ✓ Handle obtido`);

  return headerHandle;
}

async function createCarouselTemplate(
  cardCount: number,
  headerHandles: string[]
): Promise<{ success: boolean; id?: string; error?: string }> {
  const templateName = cardCount === 1
    ? 'carousel_acomodacoes_1card'
    : `carousel_acomodacoes_${cardCount}cards`;

  console.log(`\n🚀 Criando template: ${templateName}`);

  const cards = headerHandles.slice(0, cardCount).map((headerHandle, index) => ({
    components: [
      {
        type: 'HEADER',
        format: 'IMAGE',
        example: {
          header_handle: [headerHandle],
        },
      },
      {
        type: 'BODY',
        text: 'Confira a acomodação: {{1}}',
        example: {
          body_text: [[ROOM_NAMES[index] ?? `Suite ${index + 1}`]],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Reserve Aqui',
            url: 'https://api.botreserva.com.br/api/n8n/track-click{{1}}',
            example: ['?phone=5512988367859&unidade=CAMPOSDOJORDAO&quarto=Suite&redirect=https%3A%2F%2Fhbook.hsystem.com.br'],
          },
          {
            type: 'QUICK_REPLY',
            text: 'Voltar ao Menu',
          },
        ],
      },
    ],
  }));

  const templatePayload = {
    name: templateName,
    language: 'pt_BR',
    category: 'MARKETING',
    components: [
      {
        type: 'BODY',
        text: 'Confira as Acomodações disponíveis:',
      },
      {
        type: 'CAROUSEL',
        cards: cards,
      },
    ],
  };

  try {
    const response = await axios.post(
      `${BASE_URL}/${WABA_ID}/message_templates`,
      templatePayload,
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`   ✅ Criado! ID: ${response.data.id} | Status: ${response.data.status}`);
    return { success: true, id: response.data.id };
  } catch (error: any) {
    const errorData = error.response?.data?.error;
    const errorMsg = errorData?.error_user_msg || errorData?.message || error.message;
    console.error(`   ❌ Erro: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

async function listTemplates(): Promise<void> {
  console.log('\n📋 Templates existentes:');

  try {
    const response = await axios.get(
      `${BASE_URL}/${WABA_ID}/message_templates`,
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
        params: {
          limit: 100,
        },
      }
    );

    const carouselTemplates = response.data.data.filter((t: any) =>
      t.name.includes('carousel_acomodacoes')
    );

    for (const template of carouselTemplates) {
      console.log(`   - ${template.name} (${template.status})`);
    }
  } catch (error: any) {
    console.error('Erro ao listar templates:', error.response?.data || error.message);
  }
}

// ============================
// EXECUÇÃO PRINCIPAL
// ============================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   CRIAÇÃO DE TEMPLATES CAROUSEL (1 a 9 cards)');
  console.log('   WhatsApp Business API');
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    // 1. Upload das 9 imagens
    console.log('\n📸 Fazendo upload de 9 imagens...');
    const headerHandles: string[] = [];

    for (let i = 0; i < 9; i++) {
      const imageUrl = SAMPLE_IMAGES[i]!;
      try {
        const handle = await uploadSampleImage(imageUrl);
        headerHandles.push(handle);
      } catch (error) {
        console.error(`   ✗ Falha no upload da imagem ${i + 1}`);
        if (headerHandles.length > 0) {
          headerHandles.push(headerHandles[0]!);
        } else {
          throw new Error('Não foi possível fazer upload de nenhuma imagem');
        }
      }
    }

    console.log(`\n✓ ${headerHandles.length} header handles obtidos`);

    // 2. Criar templates de 1 a 9 cards
    const results: { name: string; success: boolean; id?: string; error?: string }[] = [];

    for (let cardCount = 1; cardCount <= 9; cardCount++) {
      const result = await createCarouselTemplate(cardCount, headerHandles);
      const templateName = cardCount === 1
        ? 'carousel_acomodacoes_1card'
        : `carousel_acomodacoes_${cardCount}cards`;
      results.push({ name: templateName, ...result });

      // Pequeno delay entre criações para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. Resumo final
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   📊 RESUMO DA CRIAÇÃO');
    console.log('═══════════════════════════════════════════════════════════════');

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`\n   ✅ Sucesso: ${successCount}`);
    console.log(`   ❌ Falhas: ${failCount}`);

    console.log('\n   Detalhes:');
    for (const result of results) {
      if (result.success) {
        console.log(`   ✅ ${result.name} - ID: ${result.id}`);
      } else {
        console.log(`   ❌ ${result.name} - Erro: ${result.error}`);
      }
    }

    // 4. Listar templates criados
    await listTemplates();

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   ✅ PROCESSO CONCLUÍDO');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\nOs templates precisam ser aprovados pela Meta.');
    console.log('Acompanhe em: https://business.facebook.com/wa/manage/message-templates/');

  } catch (error) {
    console.error('\n❌ Processo falhou:', error);
    process.exit(1);
  }
}

main();
