/**
 * Script de Debug Completo para o Problema das Mensagens
 *
 * PROBLEMA: Mensagens aparecem no Kanban mas NÃO no chat individual
 * CONVERSAÇÃO: c220fbae-a594-4c03-994d-a116fa9a917d
 */

const http = require('http');
const https = require('https');

// ===============================================
// CONFIGURAÇÃO - AJUSTE ESTES VALORES
// ===============================================

const CONFIG = {
  // Token JWT - pegue do navegador (F12 > Network > Headers > Authorization)
  AUTH_TOKEN: 'Bearer SEU_TOKEN_AQUI',

  // Tenant ID - pegue do navegador (F12 > Network > Headers > x-tenant-id)
  TENANT_ID: 'cm3y4buz50007cl8xn7wrmyyu',

  // ID da conversa com problema
  CONVERSATION_ID: 'c220fbae-a594-4c03-994d-a116fa9a917d'
};

// ===============================================
// FUNÇÕES DE TESTE
// ===============================================

/**
 * Faz uma requisição HTTPS
 */
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

/**
 * Testa o endpoint de mensagens
 */
async function testMessagesEndpoint() {
  console.log('================================================');
  console.log('TESTE 1: ENDPOINT DE MENSAGENS');
  console.log('================================================\n');

  const options = {
    hostname: 'www.botreserva.com.br',
    path: `/api/conversations/${CONFIG.CONVERSATION_ID}/messages`,
    method: 'GET',
    headers: {
      'Authorization': CONFIG.AUTH_TOKEN,
      'x-tenant-id': CONFIG.TENANT_ID,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };

  console.log('📍 URL:', `https://${options.hostname}${options.path}`);
  console.log('🔑 Headers:', JSON.stringify(options.headers, null, 2));
  console.log('\n⏳ Fazendo requisição...\n');

  try {
    const response = await makeRequest(options);

    console.log('✅ Status:', response.statusCode);
    console.log('📋 Headers de Resposta:', JSON.stringify(response.headers, null, 2));

    let jsonData;
    try {
      jsonData = JSON.parse(response.body);
      console.log('\n📦 Resposta JSON:');
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log('\n❌ Resposta não é JSON válido:');
      console.log(response.body);
      return;
    }

    // Análise da resposta
    analyzeResponse(jsonData);

  } catch (error) {
    console.error('\n❌ Erro na requisição:', error);
  }
}

/**
 * Analisa a resposta da API
 */
function analyzeResponse(data) {
  console.log('\n================================================');
  console.log('ANÁLISE DA RESPOSTA');
  console.log('================================================\n');

  // Verificar estrutura esperada
  console.log('🔍 Estrutura da resposta:');
  console.log('  - Tem "data"?:', data.hasOwnProperty('data'));
  console.log('  - Tem "pagination"?:', data.hasOwnProperty('pagination'));

  if (data.data) {
    console.log('  - "data" é array?:', Array.isArray(data.data));
    console.log('  - Quantidade de mensagens:', data.data.length);

    if (data.data.length > 0) {
      console.log('\n📝 Primeira mensagem:');
      const firstMsg = data.data[0];
      console.log('  - ID:', firstMsg.id);
      console.log('  - Content:', firstMsg.content?.substring(0, 50) + '...');
      console.log('  - Direction:', firstMsg.direction);
      console.log('  - Type:', firstMsg.type);
      console.log('  - Timestamp:', firstMsg.timestamp);
      console.log('  - TenantId:', firstMsg.tenantId);
      console.log('  - ConversationId:', firstMsg.conversationId);

      // Verificar tipos de dados
      console.log('\n🔧 Tipos de dados (primeira mensagem):');
      Object.entries(firstMsg).forEach(([key, value]) => {
        console.log(`  - ${key}: ${typeof value} ${value === null ? '(null)' : ''}`);
      });
    } else {
      console.log('\n⚠️  Array de dados está vazio!');
    }
  } else {
    console.log('\n❌ Resposta não tem campo "data"!');
  }

  if (data.pagination) {
    console.log('\n📄 Paginação:');
    console.log('  - Page:', data.pagination.page);
    console.log('  - Limit:', data.pagination.limit);
    console.log('  - Total:', data.pagination.total);
    console.log('  - Total Pages:', data.pagination.totalPages);
  }

  // Verificar problemas comuns
  console.log('\n⚠️  Verificação de Problemas:');

  if (!data.data || !Array.isArray(data.data)) {
    console.log('  ❌ Estrutura incorreta: "data" não é um array');
  } else if (data.data.length === 0) {
    console.log('  ❌ Nenhuma mensagem retornada (array vazio)');
  } else {
    console.log('  ✅ Estrutura correta e mensagens foram retornadas');
  }

  // Verificar se os timestamps estão em formato correto
  if (data.data && data.data.length > 0) {
    const hasInvalidTimestamps = data.data.some(msg => {
      if (typeof msg.timestamp === 'string') {
        return isNaN(Date.parse(msg.timestamp));
      }
      return false;
    });

    if (hasInvalidTimestamps) {
      console.log('  ⚠️  Alguns timestamps podem estar em formato inválido');
    }
  }
}

/**
 * Testa a conversação
 */
async function testConversation() {
  console.log('\n================================================');
  console.log('TESTE 2: ENDPOINT DA CONVERSAÇÃO');
  console.log('================================================\n');

  const options = {
    hostname: 'www.botreserva.com.br',
    path: `/api/conversations/${CONFIG.CONVERSATION_ID}`,
    method: 'GET',
    headers: {
      'Authorization': CONFIG.AUTH_TOKEN,
      'x-tenant-id': CONFIG.TENANT_ID,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };

  console.log('📍 URL:', `https://${options.hostname}${options.path}`);

  try {
    const response = await makeRequest(options);
    console.log('✅ Status:', response.statusCode);

    if (response.statusCode === 200) {
      const conversation = JSON.parse(response.body);
      console.log('\n📋 Conversação:');
      console.log('  - ID:', conversation.id);
      console.log('  - Status:', conversation.status);
      console.log('  - Contact ID:', conversation.contactId);
      console.log('  - Last Message:', conversation.lastMessageAt);
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

/**
 * Main - Executa todos os testes
 */
async function main() {
  console.log('================================================');
  console.log('DIAGNÓSTICO DO PROBLEMA DE MENSAGENS');
  console.log('================================================\n');
  console.log('🔍 Conversa ID:', CONFIG.CONVERSATION_ID);
  console.log('🏢 Tenant ID:', CONFIG.TENANT_ID);
  console.log('🔐 Token configurado?:', CONFIG.AUTH_TOKEN !== 'Bearer SEU_TOKEN_AQUI');

  if (CONFIG.AUTH_TOKEN === 'Bearer SEU_TOKEN_AQUI') {
    console.log('\n⚠️  ATENÇÃO: Configure o token de autenticação primeiro!');
    console.log('\nComo obter o token:');
    console.log('1. Abra https://www.botreserva.com.br no navegador');
    console.log('2. Faça login');
    console.log('3. Abra o DevTools (F12)');
    console.log('4. Vá para a aba Network');
    console.log('5. Navegue até uma conversa');
    console.log('6. Procure uma requisição para /api/conversations');
    console.log('7. Nos headers da requisição, copie:');
    console.log('   - Authorization (todo o valor, incluindo "Bearer")');
    console.log('   - x-tenant-id');
    console.log('8. Cole os valores no CONFIG deste script');
    return;
  }

  // Executar testes
  await testConversation();
  await testMessagesEndpoint();

  console.log('\n================================================');
  console.log('RESUMO');
  console.log('================================================\n');
  console.log('✅ Testes completados!');
  console.log('\n🔍 Próximos passos:');
  console.log('1. Se "data" está vazio, verificar query SQL no backend');
  console.log('2. Se estrutura está incorreta, verificar serialização');
  console.log('3. Se há erro 401/403, verificar autenticação');
  console.log('4. Se há erro 404, verificar rotas');
}

// Executar
main().catch(console.error);