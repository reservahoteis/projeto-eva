/**
 * Script para criar UM template por vez e ver o erro detalhado
 */

import axios from 'axios';

const WABA_ID = '1377104410568104';
const ACCESS_TOKEN = 'EAAhLVq96CJ8BQLpnUGYLgrdQBJQAkq5E5Ma7MxYK9DPtmCOVIn9XSULZBMimDAPRfNCeR9VloyxzUNMh45TcpkL2zlGcYtYF5TIsbpvDbkd0ZBYPhzbDT08SWjzwIog2muJzhpGZARFTrsgmZCX1lQzXZAvo6YiK4aVZAUImdwIZB5PGU8eZAThLbadxpOcG7QZDZD';
const BASE_URL = 'https://graph.facebook.com/v21.0';

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

// Parâmetro: quantos cards criar
const CARD_COUNT = parseInt(process.argv[2] || '7');

async function uploadSampleImage(imageUrl: string): Promise<string> {
  console.log(`   📤 Upload: ${imageUrl.split('/').pop()?.substring(0, 30)}...`);

  const imageResponse = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });
  const imageBuffer = Buffer.from(imageResponse.data);

  const createSessionResponse = await axios.post(
    `${BASE_URL}/app/uploads`,
    { file_length: imageBuffer.length, file_type: 'image/jpeg', file_name: 'sample_image.jpg' },
    { headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
  );

  const uploadResponse = await axios.post(
    `${BASE_URL}/${createSessionResponse.data.id}`,
    imageBuffer,
    { headers: { Authorization: `OAuth ${ACCESS_TOKEN}`, 'Content-Type': 'application/octet-stream', file_offset: '0' } }
  );

  return uploadResponse.data.h.split('\n')[0].trim();
}

async function main() {
  const templateName = CARD_COUNT === 1
    ? 'carousel_quartos_1card'
    : `carousel_quartos_${CARD_COUNT}cards`;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   CRIAR TEMPLATE: ${templateName}`);
  console.log(`   Cards: ${CARD_COUNT}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Upload das imagens necessárias
  console.log(`\n📸 Fazendo upload de ${CARD_COUNT} imagens...`);
  const headerHandles: string[] = [];
  for (let i = 0; i < CARD_COUNT; i++) {
    headerHandles.push(await uploadSampleImage(SAMPLE_IMAGES[i]!));
  }
  console.log('   ✅ Upload completo\n');

  // Criar cards - ESTRUTURA IDÊNTICA aos aprovados (1-6 e 10)
  const cards = headerHandles.map((headerHandle, index) => ({
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

  console.log('📦 Payload:');
  console.log(JSON.stringify(templatePayload, null, 2));

  console.log('\n🚀 Enviando para Meta API...\n');

  try {
    const response = await axios.post(
      `${BASE_URL}/${WABA_ID}/message_templates`,
      templatePayload,
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
    );

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   ✅ SUCESSO!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   ❌ ERRO!');
    console.log('═══════════════════════════════════════════════════════════════');

    const errorData = error.response?.data?.error;
    if (errorData) {
      console.log('Código:', errorData.code);
      console.log('Subcode:', errorData.error_subcode);
      console.log('Tipo:', errorData.type);
      console.log('Mensagem:', errorData.message);
      console.log('Título:', errorData.error_user_title);
      console.log('Mensagem Usuário:', errorData.error_user_msg);
      console.log('FBTrace:', errorData.fbtrace_id);
      console.log('\nResponse completa:');
      console.log(JSON.stringify(error.response?.data, null, 2));
    } else {
      console.log('Erro:', error.message);
    }
  }
}

main().catch(console.error);
