/**
 * Script de teste para envio de mensagens via API
 *
 * Como usar:
 * 1. Faça login no sistema e pegue o token JWT do localStorage
 * 2. Pegue o ID de uma conversa ativa
 * 3. Execute: node test-send-message.js <token> <conversationId>
 */

const https = require('https');

// Pegar argumentos da linha de comando
const [,, token, conversationId, message] = process.argv;

if (!token || !conversationId) {
    console.log('Uso: node test-send-message.js <token> <conversationId> [mensagem]');
    console.log('\nExemplo:');
    console.log('node test-send-message.js eyJhbGc... 123456 "Olá, teste de mensagem"');
    process.exit(1);
}

const messageContent = message || `Teste de mensagem enviada às ${new Date().toLocaleTimeString('pt-BR')}`;

const data = JSON.stringify({
    type: 'TEXT',
    content: messageContent
});

const options = {
    hostname: 'api.botreserva.com.br',
    path: `/api/conversations/${conversationId}/messages`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': data.length
    }
};

console.log('Enviando mensagem para conversa:', conversationId);
console.log('Conteúdo:', messageContent);

const req = https.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {
        console.log('\nStatus:', res.statusCode);

        try {
            const response = JSON.parse(responseData);

            if (res.statusCode === 200 || res.statusCode === 201) {
                console.log('✅ Mensagem enviada com sucesso!');
                console.log('\nDetalhes da mensagem:');
                console.log('- ID:', response.id);
                console.log('- Status:', response.status);
                console.log('- WhatsApp ID:', response.whatsappMessageId);
                console.log('- Criada em:', new Date(response.createdAt).toLocaleString('pt-BR'));
            } else {
                console.log('❌ Erro ao enviar mensagem:');
                console.log(JSON.stringify(response, null, 2));
            }
        } catch (e) {
            console.log('Resposta:', responseData);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Erro de rede:', error.message);
});

// Enviar a requisição
req.write(data);
req.end();

console.log('\nAguardando resposta do servidor...');