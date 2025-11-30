# Arquitetura dos Fluxos N8N - Hoteis Reserva

## Visao Geral

O sistema utiliza N8N como orquestrador de automacao para atendimento via WhatsApp com IA conversacional.

## Fluxos Identificados

### 1. MARCIO - IA CONVERSACIONAL (Principal)

**Funcao:** Fluxo principal que recebe mensagens do WhatsApp e orquestra toda a logica de atendimento.

**Webhook:** `POST /recebimento_zapi_marcio_ok_`

**Tipos de Mensagem Suportados:**
- TEXTO - Mensagens de texto
- AUDIO - Mensagens de audio (transcritas)
- IMAGEM - Imagens enviadas
- BOTAO - Respostas de botoes interativos
- BOTAO2 - Respostas de botoes (formato alternativo)

**Menus Principais:**
- "Ja estou hospedado e quero ajuda" -> IA Hospede
- "Quer orcar uma reserva" -> IA Comercial
- "Ja tenho uma reserva" -> Consulta reserva
- "Mais opcoes" -> Menu secundario

**Unidades Hoteleiras:**
- Campos do Jordao
- Ilhabela
- Camburi
- Santo Antonio do Pinhal

### 2. FUNCOES IA MARCIO

**Funcao:** Subfluxo que executa funcoes especificas da IA.

**Funcoes Disponíveis:**
- `faq_hospede` - FAQ para hospedes
- `concierge` - Servicos de concierge
- `servico` - Servicos do hotel
- `faq` - FAQ geral
- `quartos` - Informacoes de quartos

**Banco de Dados MySQL:**
- `FAQ` - Perguntas frequentes por unidade
- `CONCIERGE_RESERVA` - Dados de concierge
- `SERVICOS` - Servicos disponiveis
- `IA_SDR_CAMPOS` - Log de interacoes

### 3. EXT - MARCIO IA COMERCIAL

**Funcao:** IA especializada em vendas e orcamentos de reservas.

### 4. EXT - MARCIO IA HOSPEDE

**Funcao:** IA especializada em atendimento a hospedes ja hospedados.

### 5. EXT - MARCIO RESPOSTA MENU FAQ

**Funcao:** Processamento de respostas do menu de FAQ.

### 6. EXT - MARCIO RESPOSTAS MENUS BOTOES

**Funcao:** Processamento de respostas de botoes interativos.

### 7. NOTIFICAR ATENDENTE MARCIO

**Funcao:** Notifica atendentes humanos quando necessario escalacao.

**Roteamento por Unidade:**
- Campos do Jordao -> Atendente especifico
- Ilhabela -> Atendente especifico
- Camburi -> Atendente especifico
- Santo Antonio do Pinhal -> Atendente especifico

### 8. MARCIO ATT TABELA DE CARROSSEL

**Funcao:** Atualizacao de dados para carrosseis de imagens.

### 9. (OK) MARCIO - ATUALIZA MENU DE FAQ

**Funcao:** Atualizacao do menu de FAQ.

### 10. marcio link

**Funcao:** Gerenciamento de links e redirecionamentos.

## Integracao Z-API

**API WhatsApp:** Z-API (https://api.z-api.io)

**Endpoints Utilizados:**
- `/send-text` - Envio de mensagens de texto
- `/send-button-list` - Envio de lista de botoes

**Autenticacao:**
- Header: `Client-Token`
- Instance ID no path da URL

## Estrutura de Dados

### Formato de Mensagem Recebida (Webhook)
```json
{
  "body": {
    "phone": "5511999999999",
    "fromMe": false,
    "text": {
      "message": "texto da mensagem"
    },
    "audio": {
      "audioUrl": "url do audio"
    },
    "image": {
      "imageUrl": "url da imagem"
    },
    "buttonReply": {
      "buttonId": "id do botao"
    }
  }
}
```

### Formato de Memoria/Sessao
- Chave Redis: `|MARCIO-{telefone}`
- Armazena historico de conversa e contexto

## Ponto de Integracao com CRM

### Cenario 1: CRM como Painel de Atendimento
O N8N pode chamar a API do CRM para:
- Criar/atualizar contatos
- Registrar conversas
- Notificar atendentes via WebSocket

### Cenario 2: CRM Substitui N8N
O CRM pode absorver funcionalidades do N8N:
- Webhook direto do WhatsApp Business API
- IA integrada (OpenAI)
- Logica de roteamento interna

### Cenario 3: Coexistencia
- N8N para automacao complexa e IA
- CRM para visualizacao e intervencao humana
- Sincronizacao bidirecional via API

## Proximos Passos

1. **Definir modelo de integracao** - Escolher cenario
2. **Criar endpoints de integracao** - API no CRM para N8N
3. **Sincronizar dados** - Contatos e conversas
4. **Notificacoes realtime** - WebSocket para atendentes
5. **Dashboard unificado** - Visualizar todas as conversas
