/**
 * 🔍 DEBUG SOCKET.IO NO BROWSER
 *
 * COMO USAR:
 * 1. Abra o Dashboard no navegador
 * 2. Faça login e entre em uma conversa
 * 3. Abra o Console (F12)
 * 4. Cole e execute este código no console
 * 5. Observe os logs quando receber mensagens
 */

console.log('%c🔍 INICIANDO DEBUG DO SOCKET.IO', 'background: #4CAF50; color: white; padding: 10px; font-size: 16px');

// Verificar se o Socket está disponível
if (typeof window === 'undefined') {
  console.error('❌ Este script deve ser executado no navegador!');
} else {
  // Interceptar console.logs relacionados ao Socket
  const originalLog = console.log;
  console.log = function(...args) {
    const message = args[0];
    if (typeof message === 'string' &&
        (message.includes('message') ||
         message.includes('Socket') ||
         message.includes('conversation') ||
         message.includes('📨') ||
         message.includes('🆕'))) {
      originalLog.apply(console, ['%c[SOCKET]', 'background: #2196F3; color: white; padding: 2px 5px; border-radius: 3px', ...args]);
    } else {
      originalLog.apply(console, args);
    }
  };

  console.log('✅ Debug ativado! Logs do Socket serão destacados em azul');
  console.log('📌 Informações da página:');
  console.log('  - URL:', window.location.href);
  console.log('  - Conversation ID:', window.location.pathname.split('/').pop());

  // Verificar localStorage
  const token = localStorage.getItem('accessToken');
  const tenantSlug = localStorage.getItem('tenantSlug');
  console.log('  - Token presente:', !!token);
  console.log('  - Tenant:', tenantSlug);

  // Adicionar listener global para detectar mudanças no DOM
  let messageCount = document.querySelectorAll('[data-message-id]').length ||
                     document.querySelectorAll('.message-bubble').length ||
                     document.querySelectorAll('[class*="message"]').length;

  console.log('📊 Mensagens na tela:', messageCount);

  // Monitorar mudanças
  const observer = new MutationObserver((mutations) => {
    const newMessageCount = document.querySelectorAll('[data-message-id]').length ||
                           document.querySelectorAll('.message-bubble').length ||
                           document.querySelectorAll('[class*="message"]').length;

    if (newMessageCount > messageCount) {
      console.log('%c🎉 NOVA MENSAGEM DETECTADA NO DOM!', 'background: #4CAF50; color: white; padding: 5px 10px; font-size: 14px');
      console.log(`  Mensagens: ${messageCount} → ${newMessageCount} (+${newMessageCount - messageCount})`);
      messageCount = newMessageCount;
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('👀 Monitorando mudanças no DOM...');

  // Função para testar envio manual
  window.testSocket = function() {
    console.log('%c📤 ENVIANDO MENSAGEM DE TESTE', 'background: #FF9800; color: white; padding: 5px 10px');

    const conversationId = window.location.pathname.split('/').pop();
    const testMessage = `Teste Socket ${new Date().toLocaleTimeString('pt-BR')}`;

    fetch('https://api.botreserva.com.br/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: JSON.stringify({
        conversationId: conversationId,
        type: 'TEXT',
        content: testMessage
      })
    })
    .then(r => r.json())
    .then(data => {
      console.log('✅ Mensagem enviada:', data.id);
      console.log('⏳ Aguardando aparecer na tela SEM F5...');

      setTimeout(() => {
        const found = Array.from(document.querySelectorAll('*')).some(el =>
          el.textContent?.includes(testMessage)
        );

        if (found) {
          console.log('%c✅ SUCESSO! Mensagem apareceu em tempo real!', 'background: #4CAF50; color: white; padding: 10px; font-size: 16px');
        } else {
          console.log('%c❌ FALHA! Mensagem NÃO apareceu. Precisa F5', 'background: #F44336; color: white; padding: 10px; font-size: 16px');
        }
      }, 3000);
    })
    .catch(err => console.error('Erro:', err));
  };

  console.log('%c💡 Digite testSocket() para enviar mensagem de teste', 'background: #9C27B0; color: white; padding: 5px 10px');
}