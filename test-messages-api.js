/**
 * Script de teste direto para API de mensagens
 * Testa a rota GET /api/conversations/:conversationId/messages
 */

const axios = require('axios');

// Configurações
const API_BASE_URL = 'http://localhost:3001/api';
const CONVERSATION_ID = 'c220fbae-a594-4c03-994d-a116fa9a917d';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjBkNzgyZjlmLWUxM2ItNDgwYy04MjFmLTUzYzA5YjNmNjQzMiIsImVtYWlsIjoiYWRtaW5AaG90ZWlzLmNvbSIsInRlbmFudElkIjoiaG90ZWlzLXJlc2VydmEiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3MzI5OTk1MDIsImV4cCI6MTczMzYwNDMwMn0.7Yy5qcRAjBvPnWQhX0yxb7x-i4h6H4K0BQZCaO3UlMw';

async function testMessagesAPI() {
  console.log('🔍 Testando API de Mensagens\n');
  console.log('Configuração:');
  console.log(`  URL Base: ${API_BASE_URL}`);
  console.log(`  Conversation ID: ${CONVERSATION_ID}`);
  console.log(`  Token: ${AUTH_TOKEN.substring(0, 50)}...`);
  console.log('\n' + '='.repeat(80) + '\n');

  try {
    // 1. Testar rota de listagem de mensagens
    console.log('📋 Teste 1: GET /api/conversations/:id/messages');
    console.log(`URL: ${API_BASE_URL}/conversations/${CONVERSATION_ID}/messages`);

    const response = await axios.get(
      `${API_BASE_URL}/conversations/${CONVERSATION_ID}/messages`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'X-Tenant-ID': 'hoteis-reserva',
          'Content-Type': 'application/json'
        },
        params: {
          limit: 50,
          page: 1
        }
      }
    );

    console.log('\n✅ Resposta recebida:');
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    console.log('\nDados da resposta:');
    console.log(JSON.stringify(response.data, null, 2));

    // Analisar resposta
    if (response.data.data && Array.isArray(response.data.data)) {
      console.log('\n📊 Análise dos dados:');
      console.log(`  Total de mensagens: ${response.data.data.length}`);
      console.log(`  Total no banco: ${response.data.pagination?.total || 'N/A'}`);
      console.log(`  Página atual: ${response.data.pagination?.page || 'N/A'}`);
      console.log(`  Limite por página: ${response.data.pagination?.limit || 'N/A'}`);

      if (response.data.data.length > 0) {
        console.log('\n📨 Primeira mensagem:');
        const firstMessage = response.data.data[0];
        console.log(`  ID: ${firstMessage.id}`);
        console.log(`  Conteúdo: ${firstMessage.content}`);
        console.log(`  Direção: ${firstMessage.direction}`);
        console.log(`  Status: ${firstMessage.status}`);
        console.log(`  Timestamp: ${firstMessage.timestamp}`);
      }
    }

    // 2. Testar conversação específica
    console.log('\n' + '='.repeat(80) + '\n');
    console.log('📋 Teste 2: GET /api/conversations/:id');
    console.log(`URL: ${API_BASE_URL}/conversations/${CONVERSATION_ID}`);

    const convResponse = await axios.get(
      `${API_BASE_URL}/conversations/${CONVERSATION_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'X-Tenant-ID': 'hoteis-reserva',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ Conversa encontrada:');
    console.log(JSON.stringify(convResponse.data, null, 2));

    // 3. Testar envio de mensagem
    console.log('\n' + '='.repeat(80) + '\n');
    console.log('📋 Teste 3: POST /api/conversations/:id/messages');
    console.log('Enviando mensagem de teste...');

    const sendResponse = await axios.post(
      `${API_BASE_URL}/conversations/${CONVERSATION_ID}/messages`,
      {
        content: `Teste API - ${new Date().toISOString()}`,
        type: 'TEXT'
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'X-Tenant-ID': 'hoteis-reserva',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ Mensagem enviada:');
    console.log(JSON.stringify(sendResponse.data, null, 2));

    // 4. Verificar se mensagem aparece na lista
    console.log('\n' + '='.repeat(80) + '\n');
    console.log('📋 Teste 4: Verificando se mensagem aparece na lista');

    const verifyResponse = await axios.get(
      `${API_BASE_URL}/conversations/${CONVERSATION_ID}/messages`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'X-Tenant-ID': 'hoteis-reserva',
          'Content-Type': 'application/json'
        },
        params: {
          limit: 10,
          page: 1
        }
      }
    );

    const newMessageFound = verifyResponse.data.data.some(
      msg => msg.id === sendResponse.data.id
    );

    if (newMessageFound) {
      console.log('✅ Mensagem encontrada na lista!');
    } else {
      console.log('❌ Mensagem NÃO encontrada na lista');
    }

    console.log('\n' + '='.repeat(80) + '\n');
    console.log('✅ Todos os testes concluídos com sucesso!');

  } catch (error) {
    console.error('\n❌ Erro durante o teste:');

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Headers:', error.response.headers);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('Nenhuma resposta recebida');
      console.error('Request:', error.request);
    } else {
      console.error('Erro:', error.message);
    }

    console.error('\nStack trace:');
    console.error(error.stack);
  }
}

// Executar testes
console.log('�� Iniciando testes da API de mensagens...\n');
testMessagesAPI().catch(console.error);