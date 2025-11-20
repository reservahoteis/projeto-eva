/**
 * Script para testar envio de mensagem via API
 * Isso vai disparar o evento Socket.io corretamente
 */

const https = require('https');

const conversationId = 'c220fbae-a594-4c03-994d-a116fa9a917d';
const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0OWU1NTYzZi0wZDUyLTQyNTgtYjZlMC0yOTIwMjc4ODk2YzYiLCJyb2xlIjoiVEVOQU5UX0FETUlOIiwidGVuYW50SWQiOiI5MTZjYTcwYS0wNDI4LTQ3ZjgtOThhMy0wZjc5MWU0MmYyOTIiLCJpYXQiOjE3NjM2MDYxNjUsImV4cCI6MTc2MzYwNzA2NX0.O0uaq7KfEjSZdiIZARYvI6luM2q5GvmeCOo4i4cNpqE';

// CORREÇÃO: conversationId removido do payload (vem do URL param)
const payload = JSON.stringify({
  type: 'TEXT',
  content: `🧪 Teste Socket.io via API - ${new Date().toISOString()}`
  // conversationId NÃO vai no body - vem de /:conversationId/messages
});

const options = {
  hostname: 'api.botreserva.com.br',
  port: 443,
  path: `/api/conversations/${conversationId}/messages`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Authorization': `Bearer ${accessToken}`,
    'x-tenant-slug': 'hoteis-reserva'  // IMPORTANTE: Header obrigatório para multi-tenant
  }
};

console.log('📤 Enviando mensagem via API...');
console.log('URL:', `https://${options.hostname}${options.path}`);
console.log('Payload:', payload);

const req = https.request(options, (res) => {
  console.log('\n📥 Resposta do servidor:');
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n📄 Body da resposta:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));

      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('\n✅ SUCESSO! Mensagem enviada via API');
        console.log('Agora o Socket.io deve ter disparado o evento message:new');
        console.log('Verifique o console do navegador em botreserva.com.br');
      } else {
        console.log('\n❌ ERRO:', res.statusCode);
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error('\n❌ Erro na requisição:', e.message);
});

req.write(payload);
req.end();
