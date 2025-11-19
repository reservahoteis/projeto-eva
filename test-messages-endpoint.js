const fetch = require('node-fetch');

// Configuração
const BASE_URL = 'https://www.botreserva.com.br';
const CONVERSATION_ID = 'c220fbae-a594-4c03-994d-a116fa9a917d';

// Headers (você precisa pegar estes valores do navegador)
// Abra o DevTools → Network → Procure por uma requisição autenticada → Copie os headers
const headers = {
  'Content-Type': 'application/json',
  'x-tenant-id': 'cm3y4buz50007cl8xn7wrmyyu', // Substitua pelo tenant-id correto
  'Authorization': 'Bearer SEU_TOKEN_AQUI', // Substitua pelo token JWT correto
  'Accept': 'application/json',
  'Origin': 'https://www.botreserva.com.br'
};

// Função de teste
async function testMessagesEndpoint() {
  console.log('===========================================');
  console.log('TESTE DO ENDPOINT DE MENSAGENS');
  console.log('===========================================\n');

  const url = `${BASE_URL}/api/conversations/${CONVERSATION_ID}/messages`;

  console.log(`📍 URL: ${url}`);
  console.log(`🆔 Conversation ID: ${CONVERSATION_ID}`);
  console.log(`🏢 Tenant ID: ${headers['x-tenant-id']}`);
  console.log('\n🔄 Fazendo requisição...\n');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });

    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Headers de resposta:`);
    console.log([...response.headers.entries()].map(([k, v]) => `  ${k}: ${v}`).join('\n'));

    const data = await response.json();

    console.log('\n📦 Resposta JSON:');
    console.log(JSON.stringify(data, null, 2));

    // Análise dos dados
    console.log('\n===========================================');
    console.log('ANÁLISE DOS DADOS');
    console.log('===========================================\n');

    if (data.data && Array.isArray(data.data)) {
      console.log(`✅ Total de mensagens retornadas: ${data.data.length}`);

      if (data.data.length > 0) {
        console.log('\n📝 Primeira mensagem:');
        console.log(JSON.stringify(data.data[0], null, 2));

        console.log('\n📊 Resumo das mensagens:');
        data.data.forEach((msg, index) => {
          console.log(`  ${index + 1}. ID: ${msg.id}`);
          console.log(`     Direction: ${msg.direction}`);
          console.log(`     Content: ${msg.content?.substring(0, 50)}...`);
          console.log(`     Timestamp: ${msg.timestamp}`);
        });
      } else {
        console.log('❌ Nenhuma mensagem retornada!');
      }
    } else {
      console.log('❌ Formato de resposta inesperado!');
      console.log('Estrutura recebida:');
      console.log(Object.keys(data));
    }

    // Verificar paginação
    if (data.pagination) {
      console.log('\n📄 Informações de paginação:');
      console.log(`  Página: ${data.pagination.page}`);
      console.log(`  Limite: ${data.pagination.limit}`);
      console.log(`  Total: ${data.pagination.total}`);
      console.log(`  Total de páginas: ${data.pagination.totalPages}`);
    }

  } catch (error) {
    console.error('❌ Erro na requisição:');
    console.error(error);

    if (error.response) {
      console.error('Detalhes do erro:');
      console.error(`Status: ${error.response.status}`);
      console.error(`Body: ${await error.response.text()}`);
    }
  }
}

// Instruções para o usuário
console.log('\n⚠️  IMPORTANTE: Antes de executar este teste:\n');
console.log('1. Abra o navegador e faça login em https://www.botreserva.com.br');
console.log('2. Abra o DevTools (F12)');
console.log('3. Vá para a aba Network');
console.log('4. Navegue até uma conversa');
console.log('5. Procure por uma requisição para /api/conversations');
console.log('6. Copie os valores de:');
console.log('   - Authorization header (Bearer token)');
console.log('   - x-tenant-id header');
console.log('7. Cole esses valores no script acima\n');
console.log('Para executar: node test-messages-endpoint.js\n');

// Descomente para executar o teste
// testMessagesEndpoint();