/**
 * Script para criar template de carousel no WhatsApp Business API
 *
 * Template: carousel_geral_url_10cards
 * - 10 cards de carousel
 * - Cada card: imagem + body dinâmico + 2 botões (URL + Quick Reply)
 *
 * Uso:
 *   npx ts-node scripts/create-carousel-template.ts
 *
 * Ou via Docker:
 *   docker exec crm-backend npx ts-node scripts/create-carousel-template.ts
 */

/// <reference types="node" />
import axios from 'axios';

// ============================
// CONFIGURAÇÕES
// ============================

// WABA ID - ID da conta WhatsApp Business (do servidor de produção)
const WABA_ID = '1377104410568104';

// Access Token - Token de acesso da Meta (descriptografado do servidor)
const ACCESS_TOKEN = 'EAAhLVq96CJ8BQLpnUGYLgrdQBJQAkq5E5Ma7MxYK9DPtmCOVIn9XSULZBMimDAPRfNCeR9VloyxzUNMh45TcpkL2zlGcYtYF5TIsbpvDbkd0ZBYPhzbDT08SWjzwIog2muJzhpGZARFTrsgmZCX1lQzXZAvo6YiK4aVZAUImdwIZB5PGU8eZAThLbadxpOcG7QZDZD';

// URLs de imagens de exemplo para os 10 cards (todas verificadas como válidas - 200 OK)
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
  'https://minio-api.srv02.messengermax.com.br/marciok/CAMBURI/BangaloDuplexVistaJardim/IMG_4489.jpeg',
];

const GRAPH_API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ============================
// FUNÇÕES AUXILIARES
// ============================

/**
 * Faz upload de imagem para obter o header_handle
 * Necessário para imagens de exemplo em templates de carousel
 */
async function uploadSampleImage(imageUrl: string): Promise<string> {
  console.log(`\n📤 Fazendo upload da imagem: ${imageUrl}`);

  try {
    // 1. Baixar a imagem
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const imageBuffer = Buffer.from(imageResponse.data);
    console.log(`   ✓ Imagem baixada: ${imageBuffer.length} bytes`);

    // 2. Criar sessão de upload
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
    console.log(`   ✓ Sessão de upload criada: ${uploadSessionId}`);

    // 3. Fazer upload do arquivo
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

    // Pegar apenas a primeira linha do header handle (às vezes vem concatenado)
    const rawHandle = uploadResponse.data.h;
    const headerHandle = rawHandle.split('\n')[0].trim();
    console.log(`   ✓ Header handle obtido: ${headerHandle.substring(0, 50)}...`);

    return headerHandle;
  } catch (error: any) {
    console.error(`   ✗ Erro no upload:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Cria o template de carousel via Graph API
 */
async function createCarouselTemplate(headerHandles: string[]): Promise<void> {
  console.log('\n🚀 Criando template de carousel...');

  // Nomes de exemplo para os quartos
  const roomNames = [
    'Suite Araucaria Com Hidro',
    'Suite Araucaria Familia',
    'Suite Vista Da Mantiqueira',
    'Suite Retro Vista Das Montanhas',
    'Suite Super Luxo Com Banheira',
    'Suite Ofuro Casal',
    'Cabana Retro Master Vista Mantiqueira',
    'Suite Terrea Casal',
    'Suite Superior Vista Jardim',
    'Bangalo Duplex Vista Jardim',
  ];

  // Construir os 10 cards - usando mesma estrutura do carousel_fotos_track_5cards aprovado
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
          body_text: [[roomNames[index] ?? `Suite ${index + 1}`]],
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
    name: 'carousel_acomodacoes_10cards',
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

  console.log('\n📦 Payload do template:');
  console.log(JSON.stringify(templatePayload, null, 2));

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

    console.log('\n✅ Template criado com sucesso!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('\n❌ Erro ao criar template:');
    const errorData = error.response?.data?.error;
    if (errorData) {
      console.error('Código:', errorData.code);
      console.error('Subcode:', errorData.error_subcode);
      console.error('Título:', errorData.error_user_title);
      console.error('Mensagem:', errorData.error_user_msg);
      console.error('Detalhes:', errorData.message);
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

/**
 * Lista templates existentes
 */
async function listTemplates(): Promise<void> {
  console.log('\n📋 Listando templates existentes...');

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

    console.log('Templates:');
    for (const template of response.data.data) {
      console.log(`  - ${template.name} (${template.status}) [${template.category}]`);
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
  console.log('   CRIAÇÃO DE TEMPLATE CAROUSEL - WhatsApp Business API');
  console.log('   Template: carousel_geral_url_10cards');
  console.log('═══════════════════════════════════════════════════════════════');

  // Verificar configurações
  if (!WABA_ID || !ACCESS_TOKEN) {
    console.error('\n❌ ERRO: Configure WABA_ID e ACCESS_TOKEN antes de executar!');
    console.log('\nPara obter os valores, execute no banco de dados:');
    console.log('  SELECT "whatsappBusinessAccountId", "whatsappAccessToken" FROM "Tenant" LIMIT 1;');
    console.log('\nNOTA: O token está criptografado. Use o decrypt() do projeto.');
    process.exit(1);
  }

  try {
    // 1. Listar templates existentes
    await listTemplates();

    // 2. Fazer upload das imagens de exemplo
    console.log('\n📸 Fazendo upload de 10 imagens de exemplo...');
    const headerHandles: string[] = [];

    for (let i = 0; i < 10; i++) {
      const imageUrl = SAMPLE_IMAGES[i] ?? SAMPLE_IMAGES[0]!;
      try {
        const handle = await uploadSampleImage(imageUrl);
        headerHandles.push(handle);
      } catch (error) {
        console.error(`   Falha no upload da imagem ${i + 1}, usando placeholder...`);
        // Se falhar, usar a primeira imagem que deu certo
        if (headerHandles.length > 0) {
          headerHandles.push(headerHandles[0]!);
        } else {
          throw new Error('Não foi possível fazer upload de nenhuma imagem');
        }
      }
    }

    console.log(`\n✓ ${headerHandles.length} header handles obtidos`);

    // 3. Criar o template
    await createCarouselTemplate(headerHandles);

    // 4. Listar templates novamente para confirmar
    await listTemplates();

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   ✅ PROCESSO CONCLUÍDO');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\nO template precisa ser aprovado pela Meta antes de ser usado.');
    console.log('Acompanhe o status em: https://business.facebook.com/wa/manage/message-templates/');

  } catch (error) {
    console.error('\n❌ Processo falhou:', error);
    process.exit(1);
  }
}

main();
