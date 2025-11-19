// ============================================
// DEBUG SOCKET.IO - COLE NO CONSOLE DO BROWSER
// ============================================

// 1. EXPOR SOCKET GLOBALMENTE
if (typeof window !== 'undefined' && window.socket) {
  console.log('✅ Socket já está exposto');
} else {
  console.log('⚠️ Socket não encontrado. Aguarde a conexão...');
}

// 2. MONITORAR TODOS OS EVENTOS
if (window.socket) {
  // Remover listeners anteriores
  window.socket.removeAllListeners();

  // Capturar TODOS os eventos
  window.socket.onAny((event, ...args) => {
    console.log('🔵 SOCKET EVENT:', {
      event: event,
      data: args[0],
      timestamp: new Date().toISOString(),
      fullArgs: args
    });

    // Destacar eventos importantes
    if (event === 'message:new') {
      console.log('🚨 NOVA MENSAGEM RECEBIDA:', args[0]);
      console.log('   - Message ID:', args[0]?.message?.id);
      console.log('   - Conversation ID:', args[0]?.conversation?.id || args[0]?.conversationId);
      console.log('   - Content:', args[0]?.message?.content);
    }
  });

  console.log('✅ Debug ativado! Monitore os eventos...');
} else {
  console.error('❌ Socket não está disponível. Execute este script após a conexão.');
}

// 3. FUNÇÕES HELPER PARA TESTE
window.debugSocket = {
  // Verificar status
  status: () => {
    if (!window.socket) return console.error('Socket não disponível');
    console.log('📊 Socket Status:', {
      connected: window.socket.connected,
      id: window.socket.id,
      transport: window.socket.io?.engine?.transport?.name
    });
  },

  // Listar todos os listeners
  listeners: () => {
    if (!window.socket) return console.error('Socket não disponível');
    const events = window.socket._callbacks || {};
    console.log('📋 Event Listeners:', Object.keys(events));
    Object.keys(events).forEach(event => {
      console.log(`   - ${event}: ${events[event]?.length || 0} listeners`);
    });
  },

  // Enviar mensagem de teste
  testMessage: (conversationId) => {
    if (!window.socket) return console.error('Socket não disponível');
    if (!conversationId) return console.error('Forneça o ID da conversa');

    const testData = {
      message: {
        id: 'test-' + Date.now(),
        conversationId: conversationId,
        content: 'Mensagem de teste: ' + new Date().toLocaleTimeString(),
        direction: 'INBOUND',
        createdAt: new Date().toISOString()
      },
      conversation: {
        id: conversationId
      }
    };

    console.log('📤 Emitindo evento de teste:', testData);
    window.socket.emit('message:new', testData);
  },

  // Simular recebimento de mensagem
  simulateReceive: (conversationId) => {
    if (!window.socket) return console.error('Socket não disponível');
    if (!conversationId) return console.error('Forneça o ID da conversa');

    const testData = {
      message: {
        id: 'sim-' + Date.now(),
        conversationId: conversationId,
        content: 'SIMULAÇÃO: ' + new Date().toLocaleTimeString(),
        direction: 'INBOUND',
        status: 'DELIVERED',
        createdAt: new Date().toISOString()
      },
      conversation: {
        id: conversationId,
        contact: {
          name: 'Teste User',
          phoneNumber: '+5511999999999'
        }
      }
    };

    // Simular como se viesse do servidor
    console.log('🎭 Simulando recebimento:', testData);

    // Disparar o evento localmente
    if (window.socket.listeners('message:new').length > 0) {
      window.socket.listeners('message:new').forEach(listener => {
        listener(testData);
      });
    } else {
      console.error('❌ Nenhum listener registrado para message:new');
    }
  }
};

// 4. INSTRUÇÕES
console.log(`
📚 INSTRUÇÕES DE DEBUG:
=======================
1. debugSocket.status()          - Ver status da conexão
2. debugSocket.listeners()       - Listar todos os event listeners
3. debugSocket.testMessage('ID') - Enviar mensagem de teste
4. debugSocket.simulateReceive('ID') - Simular recebimento local

EXEMPLO:
  debugSocket.simulateReceive('675b5f3e31e58c2e982c69ba')

MONITORANDO:
  Todos os eventos estão sendo logados automaticamente.
  Procure por 🔵 SOCKET EVENT no console.
`);