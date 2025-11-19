/**
 * Script para testar Socket.io em tempo real
 *
 * COMO USAR:
 * 1. Abra o navegador e faça login no dashboard
 * 2. Entre em uma conversa existente
 * 3. Abra o Console do navegador (F12)
 * 4. Execute: node test-socket-realtime.js <conversationId>
 * 5. Observe se a mensagem aparece SEM dar F5!
 */

const io = require('socket.io-client');
const axios = require('axios');

// Configurações
const API_URL = 'https://api.botreserva.com.br';
const SOCKET_URL = API_URL;
const conversationId = process.argv[2];

if (!conversationId) {
  console.error('❌ Por favor, forneça o ID da conversa como argumento');
  console.error('Uso: node test-socket-realtime.js <conversationId>');
  process.exit(1);
}

// Substitua pelo seu token de acesso (pegue do localStorage no browser)
const ACCESS_TOKEN = 'SEU_TOKEN_AQUI';

console.log('🚀 Iniciando teste de Socket.io tempo real...');
console.log('📝 Conversation ID:', conversationId);
console.log('🔗 Socket URL:', SOCKET_URL);

// Conectar ao Socket.io
const socket = io(SOCKET_URL, {
  auth: {
    token: ACCESS_TOKEN,
    tenantSlug: 'hoteis-reserva',
  },
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('✅ Conectado ao Socket.io!');
  console.log('🆔 Socket ID:', socket.id);

  // Entrar na room da conversa
  socket.emit('conversation:join', conversationId);
  console.log('📌 Entrando na conversa:', conversationId);
});

socket.on('conversation:joined', (data) => {
  console.log('✅ Entrou na conversa:', data.conversationId);

  // Agora vamos enviar uma mensagem de teste via API
  sendTestMessage();
});

socket.on('message:new', (data) => {
  console.log('🆕 NOVA MENSAGEM RECEBIDA VIA SOCKET!!!');
  console.log('📨 Dados:', JSON.stringify(data, null, 2));
  console.log('✅ TESTE PASSOU! Mensagem apareceu em tempo real!');

  // Sucesso! Pode desconectar
  setTimeout(() => {
    console.log('👋 Desconectando...');
    socket.disconnect();
    process.exit(0);
  }, 2000);
});

socket.on('error', (error) => {
  console.error('❌ Erro no Socket:', error);
});

socket.on('connect_error', (error) => {
  console.error('❌ Erro de conexão:', error.message);
  console.error('💡 Verifique se o token está correto!');
});

async function sendTestMessage() {
  console.log('📤 Enviando mensagem de teste via API...');

  try {
    const response = await axios.post(
      `${API_URL}/api/messages/send`,
      {
        conversationId: conversationId,
        type: 'TEXT',
        content: `🤖 Teste Socket.io - ${new Date().toLocaleTimeString('pt-BR')}`,
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Mensagem enviada com sucesso!');
    console.log('📝 ID da mensagem:', response.data.id);
    console.log('⏳ Aguardando receber via Socket.io...');
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Timeout de segurança
setTimeout(() => {
  console.error('⏰ TIMEOUT! Mensagem não chegou via Socket.io após 30 segundos');
  console.error('❌ TESTE FALHOU - Socket.io não está funcionando em tempo real');
  process.exit(1);
}, 30000);