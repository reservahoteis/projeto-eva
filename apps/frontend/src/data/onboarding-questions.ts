// ============================================
// Dados das perguntas do Onboarding
// Seção 1: Personalidade do Bot (50 perguntas)
// Seção 2: Sobre a Propriedade (90 perguntas)
// Seção 3: Dicas e Sugestões (20 perguntas)
// ============================================

export interface OnboardingOption {
  label: string
  value: string
  score?: number
}

export interface OnboardingQuestion {
  id: number
  theme: string
  question: string
  options: OnboardingOption[]
  type: 'single' | 'multiple' | 'text' | 'top5'
}

// ============================================
// SEÇÃO 1: PERSONALIDADE DO BOT (50 perguntas)
// ============================================

export const personalityQuestions: OnboardingQuestion[] = [
  // Identidade da Voz (1-5)
  {
    id: 1,
    theme: 'Identidade da Voz',
    question: 'Gênero percebido da voz do bot',
    type: 'single',
    options: [
      { label: 'Masculina', value: 'masculina', score: 1 },
      { label: 'Feminina', value: 'feminina', score: 2 },
      { label: 'Neutra', value: 'neutra', score: 3 },
      { label: 'Variável', value: 'variavel', score: 4 },
    ],
  },
  {
    id: 2,
    theme: 'Identidade da Voz',
    question: 'Faixa etária percebida do bot',
    type: 'single',
    options: [
      { label: 'Jovem (18-25)', value: 'jovem', score: 1 },
      { label: 'Adulto jovem (26-35)', value: 'adulto-jovem', score: 2 },
      { label: 'Adulto (36-50)', value: 'adulto', score: 3 },
      { label: 'Maduro (50+)', value: 'maduro', score: 4 },
    ],
  },
  {
    id: 3,
    theme: 'Identidade da Voz',
    question: 'O bot deve ter nome próprio?',
    type: 'single',
    options: [
      { label: 'Sim, um nome humano', value: 'nome-humano', score: 2 },
      { label: 'Sim, um nome fictício/criativo', value: 'nome-criativo', score: 3 },
      { label: 'Não, apenas o nome da marca', value: 'nome-marca', score: 1 },
      { label: 'Indiferente', value: 'indiferente', score: 1 },
    ],
  },
  {
    id: 4,
    theme: 'Identidade da Voz',
    question: 'Qual é o nível de formalidade desejado?',
    type: 'single',
    options: [
      { label: 'Muito formal (você, senhor/a)', value: 'muito-formal', score: 1 },
      { label: 'Formal mas acessível', value: 'formal-acessivel', score: 2 },
      { label: 'Informal e amigável', value: 'informal', score: 3 },
      { label: 'Descontraído e casual', value: 'descontraido', score: 4 },
    ],
  },
  {
    id: 5,
    theme: 'Identidade da Voz',
    question: 'Qual o principal propósito do bot?',
    type: 'single',
    options: [
      { label: 'Atendimento e suporte', value: 'suporte', score: 2 },
      { label: 'Vendas e conversão', value: 'vendas', score: 1 },
      { label: 'Informação e orientação', value: 'informacao', score: 3 },
      { label: 'Engajamento e relacionamento', value: 'engajamento', score: 4 },
    ],
  },

  // Comunicação (6-9)
  {
    id: 6,
    theme: 'Comunicação',
    question: 'Como o bot deve se expressar em termos de vocabulário?',
    type: 'single',
    options: [
      { label: 'Simples e direto', value: 'simples', score: 3 },
      { label: 'Técnico e preciso', value: 'tecnico', score: 2 },
      { label: 'Rico e elaborado', value: 'rico', score: 4 },
      { label: 'Coloquial e informal', value: 'coloquial', score: 3 },
    ],
  },
  {
    id: 7,
    theme: 'Comunicação',
    question: 'O bot deve usar emojis?',
    type: 'single',
    options: [
      { label: 'Nunca', value: 'nunca', score: 1 },
      { label: 'Raramente (só quando muito adequado)', value: 'raramente', score: 2 },
      { label: 'Moderadamente', value: 'moderado', score: 3 },
      { label: 'Frequentemente', value: 'frequente', score: 4 },
    ],
  },
  {
    id: 8,
    theme: 'Comunicação',
    question: 'Como devem ser as mensagens em geral?',
    type: 'single',
    options: [
      { label: 'Curtas e diretas', value: 'curtas', score: 2 },
      { label: 'Médias com contexto', value: 'medias', score: 3 },
      { label: 'Detalhadas e completas', value: 'detalhadas', score: 4 },
      { label: 'Variável conforme contexto', value: 'variavel', score: 3 },
    ],
  },
  {
    id: 9,
    theme: 'Comunicação',
    question: 'O bot deve fazer perguntas de acompanhamento?',
    type: 'single',
    options: [
      { label: 'Sempre, para garantir satisfação', value: 'sempre', score: 4 },
      { label: 'Quando necessário', value: 'quando-necessario', score: 3 },
      { label: 'Raramente', value: 'raramente', score: 2 },
      { label: 'Nunca', value: 'nunca', score: 1 },
    ],
  },

  // Relação com o Usuário (10-13)
  {
    id: 10,
    theme: 'Relação com o Usuário',
    question: 'Como o bot deve tratar o hóspede?',
    type: 'single',
    options: [
      { label: 'Como um cliente valioso e especial', value: 'especial', score: 4 },
      { label: 'Como um convidado de casa', value: 'convidado', score: 3 },
      { label: 'De forma profissional e respeitosa', value: 'profissional', score: 2 },
      { label: 'De forma amigável e próxima', value: 'amigavel', score: 3 },
    ],
  },
  {
    id: 11,
    theme: 'Relação com o Usuário',
    question: 'O bot deve lembrar informações do usuário ao longo da conversa?',
    type: 'single',
    options: [
      { label: 'Sim, referenciar sempre que relevante', value: 'sempre', score: 4 },
      { label: 'Sim, ocasionalmente', value: 'ocasionalmente', score: 3 },
      { label: 'Apenas dados essenciais', value: 'essenciais', score: 2 },
      { label: 'Não é necessário', value: 'nao', score: 1 },
    ],
  },
  {
    id: 12,
    theme: 'Relação com o Usuário',
    question: 'Como o bot deve reagir a reclamações?',
    type: 'single',
    options: [
      { label: 'Com empatia total e pedido de desculpas imediato', value: 'empatia', score: 4 },
      { label: 'Com calma e busca de solução', value: 'calma', score: 3 },
      { label: 'De forma neutra e resoluta', value: 'neutro', score: 2 },
      { label: 'Encaminhar para atendimento humano', value: 'humano', score: 1 },
    ],
  },
  {
    id: 13,
    theme: 'Relação com o Usuário',
    question: 'O bot deve personalizar saudações pelo nome do usuário?',
    type: 'single',
    options: [
      { label: 'Sempre que possível', value: 'sempre', score: 4 },
      { label: 'Na primeira mensagem do dia', value: 'primeira', score: 3 },
      { label: 'Apenas na saudação inicial', value: 'inicial', score: 2 },
      { label: 'Não precisa', value: 'nao', score: 1 },
    ],
  },

  // Inteligência Percebida (14-17)
  {
    id: 14,
    theme: 'Inteligência Percebida',
    question: 'O bot deve demonstrar conhecimento profundo sobre o hotel?',
    type: 'single',
    options: [
      { label: 'Sim, deve ser um especialista completo', value: 'especialista', score: 4 },
      { label: 'Sim, mas com humildade', value: 'humilde', score: 3 },
      { label: 'Conhecimento básico suficiente', value: 'basico', score: 2 },
      { label: 'Conhecimento geral apenas', value: 'geral', score: 1 },
    ],
  },
  {
    id: 15,
    theme: 'Inteligência Percebida',
    question: 'Como o bot deve lidar com perguntas que não sabe responder?',
    type: 'single',
    options: [
      { label: 'Admitir e oferecer alternativas imediatamente', value: 'admite', score: 3 },
      { label: 'Tentar inferir e confirmar com o usuário', value: 'infere', score: 4 },
      { label: 'Escalar para atendimento humano', value: 'escala', score: 2 },
      { label: 'Pedir para reformular a pergunta', value: 'reformula', score: 2 },
    ],
  },
  {
    id: 16,
    theme: 'Inteligência Percebida',
    question: 'O bot deve fazer recomendações proativas?',
    type: 'single',
    options: [
      { label: 'Sim, sempre que ver oportunidade', value: 'sempre', score: 4 },
      { label: 'Sim, mas com moderação', value: 'moderado', score: 3 },
      { label: 'Apenas quando solicitado', value: 'solicitado', score: 2 },
      { label: 'Não, manter foco no pedido do cliente', value: 'nao', score: 1 },
    ],
  },
  {
    id: 17,
    theme: 'Inteligência Percebida',
    question: 'Qual nível de detalhamento nas respostas técnicas?',
    type: 'single',
    options: [
      { label: 'Máximo detalhe possível', value: 'maximo', score: 4 },
      { label: 'Detalhado mas acessível', value: 'detalhado', score: 3 },
      { label: 'Resumido e objetivo', value: 'resumido', score: 2 },
      { label: 'Mínimo necessário', value: 'minimo', score: 1 },
    ],
  },

  // Personalidade (18-22)
  {
    id: 18,
    theme: 'Personalidade',
    question: 'Qual traço de personalidade melhor define o bot?',
    type: 'single',
    options: [
      { label: 'Sofisticado e elegante', value: 'sofisticado', score: 1 },
      { label: 'Caloroso e acolhedor', value: 'caloroso', score: 3 },
      { label: 'Eficiente e confiável', value: 'eficiente', score: 2 },
      { label: 'Criativo e surpreendente', value: 'criativo', score: 5 },
      { label: 'Sábio e experiente', value: 'sabio', score: 4 },
    ],
  },
  {
    id: 19,
    theme: 'Personalidade',
    question: 'O bot deve ter opiniões e preferências próprias?',
    type: 'single',
    options: [
      { label: 'Sim, com entusiasmo', value: 'entusiasmo', score: 3 },
      { label: 'Sim, mas sutilmente', value: 'sutil', score: 2 },
      { label: 'Apenas quando perguntado', value: 'perguntado', score: 2 },
      { label: 'Não, manter neutralidade', value: 'neutro', score: 1 },
    ],
  },
  {
    id: 20,
    theme: 'Personalidade',
    question: 'Como o bot deve lidar com conversas sociais/small talk?',
    type: 'single',
    options: [
      { label: 'Participar ativamente com prazer', value: 'ativo', score: 3 },
      { label: 'Participar brevemente e redirecionar', value: 'breve', score: 2 },
      { label: 'Aceitar mas manter foco no objetivo', value: 'foco', score: 2 },
      { label: 'Educadamente redirecionar ao serviço', value: 'redireciona', score: 1 },
    ],
  },
  {
    id: 21,
    theme: 'Personalidade',
    question: 'O bot deve expressar entusiasmo nas respostas?',
    type: 'single',
    options: [
      { label: 'Sempre, com muito entusiasmo', value: 'muito', score: 4 },
      { label: 'Moderadamente', value: 'moderado', score: 3 },
      { label: 'Apenas em tópicos relevantes', value: 'relevantes', score: 2 },
      { label: 'Manter tom equilibrado sempre', value: 'equilibrado', score: 1 },
    ],
  },
  {
    id: 22,
    theme: 'Personalidade',
    question: 'Qual é a velocidade percebida nas respostas (tom de urgência)?',
    type: 'single',
    options: [
      { label: 'Rápido e ágil', value: 'rapido', score: 2 },
      { label: 'Calmo e ponderado', value: 'calmo', score: 3 },
      { label: 'Eficiente sem pressa', value: 'eficiente', score: 2 },
      { label: 'Conforme urgência do tema', value: 'variavel', score: 3 },
    ],
  },

  // Humor (23-25)
  {
    id: 23,
    theme: 'Humor',
    question: 'O bot deve ter senso de humor?',
    type: 'single',
    options: [
      { label: 'Sim, humor leve e gentil', value: 'leve', score: 3 },
      { label: 'Sim, humor sutil e sofisticado', value: 'sutil', score: 2 },
      { label: 'Apenas trocadilhos ocasionais', value: 'trocadilhos', score: 2 },
      { label: 'Não, manter seriedade', value: 'nao', score: 1 },
    ],
  },
  {
    id: 24,
    theme: 'Humor',
    question: 'O bot deve usar metáforas e analogias?',
    type: 'single',
    options: [
      { label: 'Sim, com frequência para ilustrar', value: 'frequente', score: 4 },
      { label: 'Ocasionalmente quando ajuda', value: 'ocasional', score: 3 },
      { label: 'Raramente', value: 'raramente', score: 2 },
      { label: 'Nunca, preferir linguagem direta', value: 'nunca', score: 1 },
    ],
  },
  {
    id: 25,
    theme: 'Humor',
    question: 'O bot deve fazer perguntas retóricas?',
    type: 'single',
    options: [
      { label: 'Sim, para engajar', value: 'sim', score: 3 },
      { label: 'Raramente e com propósito claro', value: 'raramente', score: 2 },
      { label: 'Nunca', value: 'nunca', score: 1 },
    ],
  },

  // Postura (26-28)
  {
    id: 26,
    theme: 'Postura',
    question: 'Como o bot deve posicionar a marca do hotel?',
    type: 'single',
    options: [
      { label: 'Premium e exclusivo', value: 'premium', score: 1 },
      { label: 'Acolhedor e familiar', value: 'acolhedor', score: 3 },
      { label: 'Moderno e inovador', value: 'moderno', score: 5 },
      { label: 'Tradicional e confiável', value: 'tradicional', score: 4 },
      { label: 'Descontraído e divertido', value: 'descontraido', score: 3 },
    ],
  },
  {
    id: 27,
    theme: 'Postura',
    question: 'O bot deve mencionar concorrentes ou comparar serviços?',
    type: 'single',
    options: [
      { label: 'Nunca mencionar concorrentes', value: 'nunca', score: 1 },
      { label: 'Apenas para destacar diferenciais do hotel', value: 'diferenciais', score: 2 },
      { label: 'Com diplomacia quando perguntado', value: 'diplomacia', score: 3 },
      { label: 'Evitar o tema completamente', value: 'evitar', score: 1 },
    ],
  },
  {
    id: 28,
    theme: 'Postura',
    question: 'Como o bot deve tratar temas sensíveis (política, religião)?',
    type: 'single',
    options: [
      { label: 'Neutralidade absoluta e desvio gentil', value: 'neutro', score: 1 },
      { label: 'Reconhecer e redirecionar', value: 'redireciona', score: 2 },
      { label: 'Ignorar e focar no serviço', value: 'ignora', score: 1 },
      { label: 'Responder com respeito e abertura', value: 'respeito', score: 3 },
    ],
  },

  // Proatividade (29-33)
  {
    id: 29,
    theme: 'Proatividade',
    question: 'O bot deve antecipar necessidades do hóspede?',
    type: 'single',
    options: [
      { label: 'Sim, proativamente sempre', value: 'sempre', score: 4 },
      { label: 'Sim, baseado no contexto', value: 'contexto', score: 3 },
      { label: 'Apenas para serviços principais', value: 'principais', score: 2 },
      { label: 'Somente quando solicitado', value: 'solicitado', score: 1 },
    ],
  },
  {
    id: 30,
    theme: 'Proatividade',
    question: 'O bot deve sugerir upgrades e serviços adicionais?',
    type: 'single',
    options: [
      { label: 'Sim, ativamente (upsell)', value: 'ativo', score: 1 },
      { label: 'Sim, com naturalidade quando oportuno', value: 'natural', score: 2 },
      { label: 'Apenas se o cliente demonstrar interesse', value: 'interesse', score: 3 },
      { label: 'Nunca, pode parecer invasivo', value: 'nunca', score: 4 },
    ],
  },
  {
    id: 31,
    theme: 'Proatividade',
    question: 'Com que frequência o bot deve enviar mensagens proativas (check-in, check-out, etc)?',
    type: 'single',
    options: [
      { label: 'Alta frequência (diário)', value: 'diario', score: 4 },
      { label: 'Moderada (pontos-chave da estadia)', value: 'moderada', score: 3 },
      { label: 'Baixa (apenas critical touchpoints)', value: 'baixa', score: 2 },
      { label: 'Zero, apenas responder', value: 'zero', score: 1 },
    ],
  },
  {
    id: 32,
    theme: 'Proatividade',
    question: 'O bot deve pedir feedback ativamente?',
    type: 'single',
    options: [
      { label: 'Sim, em vários momentos', value: 'varios', score: 4 },
      { label: 'Sim, apenas no final da estadia', value: 'final', score: 3 },
      { label: 'Apenas se o hóspede demonstrar satisfação', value: 'satisfacao', score: 2 },
      { label: 'Não, feedback deve ser espontâneo', value: 'nao', score: 1 },
    ],
  },
  {
    id: 33,
    theme: 'Proatividade',
    question: 'O bot deve lembrar o hóspede sobre horários e compromissos?',
    type: 'single',
    options: [
      { label: 'Sim, com antecedência e no momento', value: 'sempre', score: 4 },
      { label: 'Sim, apenas com antecedência', value: 'antecedencia', score: 3 },
      { label: 'Apenas se solicitado', value: 'solicitado', score: 2 },
      { label: 'Não é responsabilidade do bot', value: 'nao', score: 1 },
    ],
  },

  // Experiência (34-35)
  {
    id: 34,
    theme: 'Experiência',
    question: 'O bot deve oferecer experiências personalizadas baseadas no histórico?',
    type: 'single',
    options: [
      { label: 'Sim, personalização máxima', value: 'maxima', score: 4 },
      { label: 'Sim, personalizações sutis', value: 'sutil', score: 3 },
      { label: 'Apenas dados básicos de preferência', value: 'basico', score: 2 },
      { label: 'Tratamento igual para todos', value: 'igual', score: 1 },
    ],
  },
  {
    id: 35,
    theme: 'Experiência',
    question: 'Como o bot deve apresentar informações sobre serviços do hotel?',
    type: 'single',
    options: [
      { label: 'Como experiências únicas e especiais', value: 'experiencias', score: 4 },
      { label: 'De forma clara e objetiva', value: 'objetiva', score: 2 },
      { label: 'Com entusiasmo e detalhes', value: 'entusiasmo', score: 3 },
      { label: 'Apenas o essencial', value: 'essencial', score: 1 },
    ],
  },

  // Narrativa (36-37)
  {
    id: 36,
    theme: 'Narrativa',
    question: 'O bot deve contar histórias sobre o hotel ou destino?',
    type: 'single',
    options: [
      { label: 'Sim, narrativas ricas e envolventes', value: 'rico', score: 4 },
      { label: 'Sim, histórias curtas e relevantes', value: 'curtas', score: 3 },
      { label: 'Raramente, apenas se muito relevante', value: 'raramente', score: 2 },
      { label: 'Não, focar nos fatos', value: 'nao', score: 1 },
    ],
  },
  {
    id: 37,
    theme: 'Narrativa',
    question: 'Como o bot deve descrever a localização e entorno do hotel?',
    type: 'single',
    options: [
      { label: 'De forma poética e inspiradora', value: 'poetico', score: 4 },
      { label: 'Com informações práticas e úteis', value: 'pratico', score: 2 },
      { label: 'Mix de inspiração e praticidade', value: 'mix', score: 3 },
      { label: 'Apenas o necessário', value: 'necessario', score: 1 },
    ],
  },

  // Marca (38-39)
  {
    id: 38,
    theme: 'Marca',
    question: 'O bot deve reforçar os valores e diferenciais da marca?',
    type: 'single',
    options: [
      { label: 'Sim, em todas as interações', value: 'sempre', score: 4 },
      { label: 'Sim, nos momentos-chave', value: 'momentos', score: 3 },
      { label: 'Sutilmente', value: 'sutil', score: 2 },
      { label: 'Não é necessário', value: 'nao', score: 1 },
    ],
  },
  {
    id: 39,
    theme: 'Marca',
    question: 'O bot deve usar o jargão e linguagem específica da marca?',
    type: 'single',
    options: [
      { label: 'Sim, consistentemente', value: 'sempre', score: 3 },
      { label: 'Sim, nos momentos adequados', value: 'momentos', score: 2 },
      { label: 'Raramente', value: 'raramente', score: 2 },
      { label: 'Não, linguagem natural é melhor', value: 'nao', score: 1 },
    ],
  },

  // Comportamento (40-42)
  {
    id: 40,
    theme: 'Comportamento',
    question: 'O bot deve manter o mesmo tom dia e noite?',
    type: 'single',
    options: [
      { label: 'Sim, consistência total', value: 'consistente', score: 2 },
      { label: 'Levemente mais formal à noite', value: 'formal-noite', score: 2 },
      { label: 'Adaptar ao contexto/horário', value: 'adaptavel', score: 3 },
      { label: 'Mais calmo em horários de descanso', value: 'calmo-noite', score: 3 },
    ],
  },
  {
    id: 41,
    theme: 'Comportamento',
    question: 'Como o bot deve lidar com múltiplas solicitações na mesma mensagem?',
    type: 'single',
    options: [
      { label: 'Responder tudo de uma vez, organizado', value: 'tudo', score: 3 },
      { label: 'Priorizar a mais urgente e mencionar as demais', value: 'prioriza', score: 3 },
      { label: 'Pedir para dividir em perguntas separadas', value: 'divide', score: 2 },
      { label: 'Responder uma e perguntar sobre as outras', value: 'uma-uma', score: 2 },
    ],
  },
  {
    id: 42,
    theme: 'Comportamento',
    question: 'O bot deve confirmar entendimento antes de agir?',
    type: 'single',
    options: [
      { label: 'Sempre, para evitar erros', value: 'sempre', score: 3 },
      { label: 'Em solicitações complexas', value: 'complexas', score: 3 },
      { label: 'Raramente, agir com agilidade', value: 'raramente', score: 2 },
      { label: 'Nunca, assumir e informar o que foi feito', value: 'nunca', score: 1 },
    ],
  },

  // Memória (43-44)
  {
    id: 43,
    theme: 'Memória',
    question: 'O bot deve lembrar preferências de estadias anteriores?',
    type: 'single',
    options: [
      { label: 'Sim, e mencionar ativamente', value: 'ativo', score: 4 },
      { label: 'Sim, usar sutilmente', value: 'sutil', score: 3 },
      { label: 'Apenas para hóspedes frequentes', value: 'frequentes', score: 2 },
      { label: 'Não, tratar cada estadia isoladamente', value: 'nao', score: 1 },
    ],
  },
  {
    id: 44,
    theme: 'Memória',
    question: 'O bot deve fazer referência a conversas anteriores na mesma estadia?',
    type: 'single',
    options: [
      { label: 'Sim, para mostrar atenção e continuidade', value: 'sempre', score: 4 },
      { label: 'Quando relevante para o contexto', value: 'relevante', score: 3 },
      { label: 'Raramente', value: 'raramente', score: 2 },
      { label: 'Nunca, tratar cada mensagem independente', value: 'nunca', score: 1 },
    ],
  },

  // Limites (45-47)
  {
    id: 45,
    theme: 'Limites',
    question: 'O bot deve indicar claramente quando não pode ajudar?',
    type: 'single',
    options: [
      { label: 'Sim, com alternativas claras', value: 'alternativas', score: 3 },
      { label: 'Sim, mas de forma suave', value: 'suave', score: 2 },
      { label: 'Tentar sempre encontrar uma solução antes', value: 'tenta', score: 4 },
      { label: 'Escalar imediatamente para humano', value: 'escala', score: 2 },
    ],
  },
  {
    id: 46,
    theme: 'Limites',
    question: 'Como o bot deve lidar com solicitações fora do escopo do hotel?',
    type: 'single',
    options: [
      { label: 'Ajudar mesmo que fora do escopo', value: 'ajuda', score: 3 },
      { label: 'Ajudar dentro do possível e indicar limitações', value: 'limitacoes', score: 3 },
      { label: 'Educadamente redirecionar ao escopo do hotel', value: 'redireciona', score: 2 },
      { label: 'Explicar que não é o canal adequado', value: 'canal', score: 1 },
    ],
  },
  {
    id: 47,
    theme: 'Limites',
    question: 'O bot deve aceitar críticas e feedbacks negativos graciosamente?',
    type: 'single',
    options: [
      { label: 'Sim, agradecer e comprometer-se a melhorar', value: 'agradece', score: 4 },
      { label: 'Sim, ouvir e oferecer solução', value: 'solucao', score: 3 },
      { label: 'Aceitar sem defensividade', value: 'aceita', score: 2 },
      { label: 'Escalar para gestor rapidamente', value: 'escala', score: 1 },
    ],
  },

  // Encerramento (48-50)
  {
    id: 48,
    theme: 'Encerramento',
    question: 'Como o bot deve encerrar uma conversa?',
    type: 'single',
    options: [
      { label: 'Com warmth e votos personalizados', value: 'personalizado', score: 4 },
      { label: 'Com resumo do que foi tratado', value: 'resumo', score: 3 },
      { label: 'Com pergunta final de satisfação', value: 'satisfacao', score: 3 },
      { label: 'De forma breve e eficiente', value: 'breve', score: 2 },
      { label: 'Deixar o usuário encerrar naturalmente', value: 'natural', score: 2 },
    ],
  },
  {
    id: 49,
    theme: 'Encerramento',
    question: 'O bot deve deixar convite para próxima interação?',
    type: 'single',
    options: [
      { label: 'Sim, sempre com entusiasmo', value: 'sempre', score: 4 },
      { label: 'Sim, de forma natural', value: 'natural', score: 3 },
      { label: 'Apenas em contextos relevantes', value: 'relevante', score: 2 },
      { label: 'Não, apenas encerrar', value: 'nao', score: 1 },
    ],
  },
  {
    id: 50,
    theme: 'Encerramento',
    question: 'Qual deve ser o tom geral do encerramento?',
    type: 'single',
    options: [
      { label: 'Caloroso e memorável', value: 'caloroso', score: 4 },
      { label: 'Profissional e respeitoso', value: 'profissional', score: 2 },
      { label: 'Leve e descontraído', value: 'leve', score: 3 },
      { label: 'Eficiente e direto', value: 'eficiente', score: 1 },
    ],
  },
]

// ============================================
// SEÇÃO 2: SOBRE A PROPRIEDADE (90 perguntas)
// ============================================

export const propertyQuestions: OnboardingQuestion[] = [
  // Endereço (1-5)
  {
    id: 1,
    theme: 'Endereço',
    question: 'Nome completo do hotel/propriedade',
    type: 'text',
    options: [{ label: 'Campo aberto', value: '' }],
  },
  {
    id: 2,
    theme: 'Endereço',
    question: 'Endereço completo (rua, número, bairro)',
    type: 'text',
    options: [{ label: 'Campo aberto', value: '' }],
  },
  {
    id: 3,
    theme: 'Endereço',
    question: 'Cidade e estado',
    type: 'text',
    options: [{ label: 'Campo aberto', value: '' }],
  },
  {
    id: 4,
    theme: 'Endereço',
    question: 'CEP',
    type: 'text',
    options: [{ label: 'Campo aberto', value: '' }],
  },
  {
    id: 5,
    theme: 'Endereço',
    question: 'Ponto de referência ou como chegar (resumido)',
    type: 'text',
    options: [{ label: 'Campo aberto', value: '' }],
  },

  // Tipo e Localização (6-19)
  {
    id: 6,
    theme: 'Tipo e Localização',
    question: 'Tipo de propriedade',
    type: 'single',
    options: [
      { label: 'Hotel', value: 'hotel' },
      { label: 'Pousada', value: 'pousada' },
      { label: 'Resort', value: 'resort' },
      { label: 'Hostel', value: 'hostel' },
      { label: 'Apart-hotel', value: 'apart-hotel' },
      { label: 'Boutique hotel', value: 'boutique' },
      { label: 'Fazenda/Spa', value: 'fazenda-spa' },
      { label: 'Outro', value: 'outro' },
    ],
  },
  {
    id: 7,
    theme: 'Tipo e Localização',
    question: 'Categoria (estrelas)',
    type: 'single',
    options: [
      { label: '1 estrela', value: '1' },
      { label: '2 estrelas', value: '2' },
      { label: '3 estrelas', value: '3' },
      { label: '4 estrelas', value: '4' },
      { label: '5 estrelas', value: '5' },
      { label: 'Sem classificação oficial', value: 'sem-classificacao' },
    ],
  },
  {
    id: 8,
    theme: 'Tipo e Localização',
    question: 'Localização principal',
    type: 'single',
    options: [
      { label: 'Centro da cidade', value: 'centro' },
      { label: 'Beira-mar/praia', value: 'praia' },
      { label: 'Região serrana/montanha', value: 'montanha' },
      { label: 'Área rural/campo', value: 'campo' },
      { label: 'Próximo a aeroporto', value: 'aeroporto' },
      { label: 'Área de negócios', value: 'negocios' },
      { label: 'Zona histórica/turística', value: 'historico' },
      { label: 'Outro', value: 'outro' },
    ],
  },
  {
    id: 9,
    theme: 'Tipo e Localização',
    question: 'A propriedade fica em área com atrativo natural próximo?',
    type: 'multiple',
    options: [
      { label: 'Praia/litoral', value: 'praia' },
      { label: 'Cachoeira/rio', value: 'cachoeira' },
      { label: 'Montanha/trilhas', value: 'montanha' },
      { label: 'Lago/lagoa', value: 'lago' },
      { label: 'Floresta/mata', value: 'floresta' },
      { label: 'Não tem atrativo natural próximo', value: 'nenhum' },
    ],
  },
  {
    id: 10,
    theme: 'Tipo e Localização',
    question: 'Distância do aeroporto mais próximo',
    type: 'single',
    options: [
      { label: 'Até 5 km', value: '5km' },
      { label: '5 a 15 km', value: '15km' },
      { label: '15 a 30 km', value: '30km' },
      { label: '30 a 60 km', value: '60km' },
      { label: 'Mais de 60 km', value: '60km+' },
      { label: 'Não aplicável', value: 'nao' },
    ],
  },
  {
    id: 11,
    theme: 'Tipo e Localização',
    question: 'Há transporte próprio para hóspedes?',
    type: 'multiple',
    options: [
      { label: 'Transfer aeroporto (pago)', value: 'transfer-pago' },
      { label: 'Transfer aeroporto (gratuito)', value: 'transfer-gratis' },
      { label: 'Shuttle para pontos turísticos', value: 'shuttle' },
      { label: 'Locação de veículos no local', value: 'locacao' },
      { label: 'Nenhum', value: 'nenhum' },
    ],
  },
  {
    id: 12,
    theme: 'Tipo e Localização',
    question: 'Qual o perfil do entorno imediato?',
    type: 'multiple',
    options: [
      { label: 'Restaurantes e bares', value: 'restaurantes' },
      { label: 'Shopping/lojas', value: 'shopping' },
      { label: 'Pontos turísticos', value: 'turisticos' },
      { label: 'Área calma/residencial', value: 'residencial' },
      { label: 'Área de negócios', value: 'negocios' },
      { label: 'Natureza/parques', value: 'natureza' },
    ],
  },
  {
    id: 13,
    theme: 'Tipo e Localização',
    question: 'A propriedade tem vista para algo especial?',
    type: 'multiple',
    options: [
      { label: 'Vista para o mar', value: 'mar' },
      { label: 'Vista para montanha', value: 'montanha' },
      { label: 'Vista para cidade', value: 'cidade' },
      { label: 'Vista para jardim/parque', value: 'jardim' },
      { label: 'Vista para piscina', value: 'piscina' },
      { label: 'Sem vista especial', value: 'nenhuma' },
    ],
  },
  {
    id: 14,
    theme: 'Tipo e Localização',
    question: 'Qual o clima predominante na região?',
    type: 'single',
    options: [
      { label: 'Tropical (quente e úmido)', value: 'tropical' },
      { label: 'Subtropical (ameno)', value: 'subtropical' },
      { label: 'Semiárido (seco e quente)', value: 'semiarido' },
      { label: 'Temperado (frio no inverno)', value: 'temperado' },
      { label: 'De altitude (frio)', value: 'altitude' },
    ],
  },
  {
    id: 15,
    theme: 'Tipo e Localização',
    question: 'Qual a melhor época do ano para visitar?',
    type: 'multiple',
    options: [
      { label: 'Janeiro/Fevereiro', value: 'jan-fev' },
      { label: 'Março/Abril', value: 'mar-abr' },
      { label: 'Maio/Junho', value: 'mai-jun' },
      { label: 'Julho/Agosto', value: 'jul-ago' },
      { label: 'Setembro/Outubro', value: 'set-out' },
      { label: 'Novembro/Dezembro', value: 'nov-dez' },
      { label: 'Ano todo', value: 'ano-todo' },
    ],
  },
  {
    id: 16,
    theme: 'Tipo e Localização',
    question: 'O hotel fica próximo a qual tipo de turismo?',
    type: 'multiple',
    options: [
      { label: 'Turismo de sol e praia', value: 'praia' },
      { label: 'Turismo de negócios', value: 'negocios' },
      { label: 'Ecoturismo/aventura', value: 'eco' },
      { label: 'Turismo cultural/histórico', value: 'cultural' },
      { label: 'Turismo gastronômico', value: 'gastronomico' },
      { label: 'Turismo de saúde e bem-estar', value: 'saude' },
      { label: 'Turismo rural/agro', value: 'rural' },
    ],
  },
  {
    id: 17,
    theme: 'Tipo e Localização',
    question: 'A propriedade recebe eventos e casamentos?',
    type: 'single',
    options: [
      { label: 'Sim, é um diferencial do hotel', value: 'sim-diferencial' },
      { label: 'Sim, mas não é o foco', value: 'sim-nao-foco' },
      { label: 'Apenas eventos corporativos', value: 'corporativo' },
      { label: 'Não', value: 'nao' },
    ],
  },
  {
    id: 18,
    theme: 'Tipo e Localização',
    question: 'Qual o público-alvo principal?',
    type: 'multiple',
    options: [
      { label: 'Famílias com crianças', value: 'familias' },
      { label: 'Casais/lua de mel', value: 'casais' },
      { label: 'Executivos/negócios', value: 'executivos' },
      { label: 'Grupos/excursões', value: 'grupos' },
      { label: 'Mochileiros/backpackers', value: 'mochileiros' },
      { label: 'Turistas internacionais', value: 'internacionais' },
      { label: 'Turistas nacionais', value: 'nacionais' },
    ],
  },
  {
    id: 19,
    theme: 'Tipo e Localização',
    question: 'O hotel atende viajantes com necessidades especiais (acessibilidade)?',
    type: 'single',
    options: [
      { label: 'Sim, totalmente acessível', value: 'total' },
      { label: 'Sim, parcialmente acessível', value: 'parcial' },
      { label: 'Acessibilidade básica (rampas)', value: 'basico' },
      { label: 'Não possui estrutura adaptada', value: 'nao' },
    ],
  },

  // Perfil do Hotel (20-30)
  {
    id: 20,
    theme: 'Perfil do Hotel',
    question: 'Número total de unidades habitacionais',
    type: 'single',
    options: [
      { label: 'Até 10 quartos (pequeno)', value: 'ate10' },
      { label: '11 a 30 quartos (médio-pequeno)', value: '11-30' },
      { label: '31 a 80 quartos (médio)', value: '31-80' },
      { label: '81 a 150 quartos (grande)', value: '81-150' },
      { label: 'Mais de 150 quartos (muito grande)', value: '150+' },
    ],
  },
  {
    id: 21,
    theme: 'Perfil do Hotel',
    question: 'Qual o ticket médio da diária?',
    type: 'single',
    options: [
      { label: 'Até R$ 150 (econômico)', value: 'economico' },
      { label: 'R$ 150 a R$ 350 (intermediário)', value: 'intermediario' },
      { label: 'R$ 350 a R$ 700 (superior)', value: 'superior' },
      { label: 'R$ 700 a R$ 1.500 (luxo)', value: 'luxo' },
      { label: 'Acima de R$ 1.500 (ultra luxo)', value: 'ultra-luxo' },
    ],
  },
  {
    id: 22,
    theme: 'Perfil do Hotel',
    question: 'Qual o período de funcionamento?',
    type: 'single',
    options: [
      { label: 'Funciona o ano todo', value: 'ano-todo' },
      { label: 'Sazonal (temporada de verão)', value: 'verao' },
      { label: 'Sazonal (temporada de inverno)', value: 'inverno' },
      { label: 'Alta temporada apenas', value: 'alta-temporada' },
      { label: 'Fins de semana e feriados', value: 'fds' },
    ],
  },
  {
    id: 23,
    theme: 'Perfil do Hotel',
    question: 'O hotel tem política de café da manhã incluso?',
    type: 'single',
    options: [
      { label: 'Sim, sempre incluso', value: 'incluso' },
      { label: 'Opcional (pode incluir ou não)', value: 'opcional' },
      { label: 'Não oferece café da manhã', value: 'nao' },
      { label: 'Depende do tipo de quarto', value: 'depende' },
    ],
  },
  {
    id: 24,
    theme: 'Perfil do Hotel',
    question: 'Qual a política de cancelamento principal?',
    type: 'single',
    options: [
      { label: 'Cancelamento gratuito até 24h antes', value: '24h' },
      { label: 'Cancelamento gratuito até 48h antes', value: '48h' },
      { label: 'Cancelamento gratuito até 7 dias antes', value: '7d' },
      { label: 'Não reembolsável', value: 'nao-reembolsavel' },
      { label: 'Política variável por tipo de tarifa', value: 'variavel' },
    ],
  },
  {
    id: 25,
    theme: 'Perfil do Hotel',
    question: 'Quais formas de pagamento são aceitas?',
    type: 'multiple',
    options: [
      { label: 'Cartão de crédito', value: 'credito' },
      { label: 'Cartão de débito', value: 'debito' },
      { label: 'PIX', value: 'pix' },
      { label: 'Dinheiro', value: 'dinheiro' },
      { label: 'Transferência bancária', value: 'transferencia' },
      { label: 'Pagamento online antecipado', value: 'online' },
    ],
  },
  {
    id: 26,
    theme: 'Perfil do Hotel',
    question: 'O hotel aceita animais de estimação?',
    type: 'single',
    options: [
      { label: 'Sim, sem restrições', value: 'sim' },
      { label: 'Sim, apenas pequenos portes', value: 'pequenos' },
      { label: 'Sim, com taxa adicional', value: 'taxa' },
      { label: 'Não aceita animais', value: 'nao' },
    ],
  },
  {
    id: 27,
    theme: 'Perfil do Hotel',
    question: 'Qual o horário de check-in?',
    type: 'single',
    options: [
      { label: 'A partir das 12h', value: '12h' },
      { label: 'A partir das 13h', value: '13h' },
      { label: 'A partir das 14h', value: '14h' },
      { label: 'A partir das 15h', value: '15h' },
      { label: 'A partir das 16h', value: '16h' },
      { label: 'Flexível', value: 'flexivel' },
    ],
  },
  {
    id: 28,
    theme: 'Perfil do Hotel',
    question: 'Qual o horário de check-out?',
    type: 'single',
    options: [
      { label: 'Até as 10h', value: '10h' },
      { label: 'Até as 11h', value: '11h' },
      { label: 'Até as 12h', value: '12h' },
      { label: 'Até as 13h', value: '13h' },
      { label: 'Flexível', value: 'flexivel' },
    ],
  },
  {
    id: 29,
    theme: 'Perfil do Hotel',
    question: 'O hotel oferece late check-out?',
    type: 'single',
    options: [
      { label: 'Sim, gratuito quando disponível', value: 'gratis' },
      { label: 'Sim, com taxa adicional', value: 'taxa' },
      { label: 'Apenas para membros/programa fidelidade', value: 'fidelidade' },
      { label: 'Não oferece', value: 'nao' },
    ],
  },
  {
    id: 30,
    theme: 'Perfil do Hotel',
    question: 'O hotel tem programa de fidelidade?',
    type: 'single',
    options: [
      { label: 'Sim, programa próprio', value: 'proprio' },
      { label: 'Sim, faz parte de rede com programa', value: 'rede' },
      { label: 'Não possui programa de fidelidade', value: 'nao' },
    ],
  },

  // Estrutura (31-54)
  {
    id: 31,
    theme: 'Estrutura',
    question: 'Quais tipos de acomodação existem?',
    type: 'multiple',
    options: [
      { label: 'Standard/Simples', value: 'standard' },
      { label: 'Superior', value: 'superior' },
      { label: 'Deluxe', value: 'deluxe' },
      { label: 'Suíte', value: 'suite' },
      { label: 'Suíte master/presidencial', value: 'suite-master' },
      { label: 'Chalés/cabanas', value: 'chale' },
      { label: 'Bangalô', value: 'bangalo' },
      { label: 'Apartamento completo', value: 'apartamento' },
      { label: 'Dormitório compartilhado', value: 'dormitorio' },
      { label: 'Outro', value: 'outro' },
    ],
  },
  {
    id: 32,
    theme: 'Estrutura',
    question: 'Os quartos possuem ar-condicionado?',
    type: 'single',
    options: [
      { label: 'Sim, em todos os quartos', value: 'todos' },
      { label: 'Sim, em quartos selecionados', value: 'selecionados' },
      { label: 'Não, mas tem ventilador', value: 'ventilador' },
      { label: 'Não é necessário (clima frio)', value: 'desnecessario' },
    ],
  },
  {
    id: 33,
    theme: 'Estrutura',
    question: 'Os quartos possuem Wi-Fi?',
    type: 'single',
    options: [
      { label: 'Sim, gratuito em todos os quartos', value: 'gratis-todos' },
      { label: 'Sim, com taxa', value: 'taxa' },
      { label: 'Apenas em áreas comuns', value: 'areas-comuns' },
      { label: 'Não possui Wi-Fi', value: 'nao' },
    ],
  },
  {
    id: 34,
    theme: 'Estrutura',
    question: 'Os quartos possuem TV?',
    type: 'single',
    options: [
      { label: 'Sim, TV a cabo/streaming', value: 'tv-cabo' },
      { label: 'Sim, TV básica', value: 'tv-basica' },
      { label: 'Apenas em alguns quartos', value: 'alguns' },
      { label: 'Não possui TV', value: 'nao' },
    ],
  },
  {
    id: 35,
    theme: 'Estrutura',
    question: 'Os quartos possuem frigobar/minibar?',
    type: 'single',
    options: [
      { label: 'Sim, com itens inclusos', value: 'incluso' },
      { label: 'Sim, itens cobrados à parte', value: 'cobrado' },
      { label: 'Frigobar vazio (para uso do hóspede)', value: 'vazio' },
      { label: 'Não possui', value: 'nao' },
    ],
  },
  {
    id: 36,
    theme: 'Estrutura',
    question: 'Os quartos possuem cofre?',
    type: 'single',
    options: [
      { label: 'Sim, em todos', value: 'todos' },
      { label: 'Sim, em quartos superiores', value: 'superiores' },
      { label: 'Não, apenas na recepção', value: 'recepcao' },
      { label: 'Não possui cofre', value: 'nao' },
    ],
  },
  {
    id: 37,
    theme: 'Estrutura',
    question: 'O hotel possui elevador?',
    type: 'single',
    options: [
      { label: 'Sim, elevador moderno', value: 'sim' },
      { label: 'Sim, mas pode estar em manutenção', value: 'manutencao' },
      { label: 'Não (apenas 1 andar)', value: 'nao-1-andar' },
      { label: 'Não (hóspedes sobem escada)', value: 'nao-escada' },
    ],
  },
  {
    id: 38,
    theme: 'Estrutura',
    question: 'O hotel possui estacionamento?',
    type: 'single',
    options: [
      { label: 'Sim, gratuito', value: 'gratis' },
      { label: 'Sim, cobrado por diária', value: 'cobrado' },
      { label: 'Sim, com manobrista', value: 'manobrista' },
      { label: 'Não possui', value: 'nao' },
    ],
  },
  {
    id: 39,
    theme: 'Estrutura',
    question: 'O hotel possui piscina?',
    type: 'multiple',
    options: [
      { label: 'Piscina adulto descoberta', value: 'adulto-descoberta' },
      { label: 'Piscina adulto coberta', value: 'adulto-coberta' },
      { label: 'Piscina infantil', value: 'infantil' },
      { label: 'Piscina aquecida', value: 'aquecida' },
      { label: 'Piscina de borda infinita', value: 'infinita' },
      { label: 'Não possui piscina', value: 'nao' },
    ],
  },
  {
    id: 40,
    theme: 'Estrutura',
    question: 'O hotel possui academia/fitness?',
    type: 'single',
    options: [
      { label: 'Sim, academia completa', value: 'completa' },
      { label: 'Sim, academia básica', value: 'basica' },
      { label: 'Equipamentos no quarto/apartamento', value: 'quarto' },
      { label: 'Não possui', value: 'nao' },
    ],
  },
  {
    id: 41,
    theme: 'Estrutura',
    question: 'O hotel possui spa/área de relaxamento?',
    type: 'multiple',
    options: [
      { label: 'Spa com tratamentos', value: 'spa' },
      { label: 'Sauna', value: 'sauna' },
      { label: 'Jacuzzi/banheira de hidromassagem', value: 'jacuzzi' },
      { label: 'Sala de massagem', value: 'massagem' },
      { label: 'Não possui', value: 'nao' },
    ],
  },
  {
    id: 42,
    theme: 'Estrutura',
    question: 'O hotel possui espaços de lazer ao ar livre?',
    type: 'multiple',
    options: [
      { label: 'Jardim/área verde', value: 'jardim' },
      { label: 'Deck/varanda coletiva', value: 'deck' },
      { label: 'Quadra esportiva', value: 'quadra' },
      { label: 'Playground infantil', value: 'playground' },
      { label: 'Trilhas próprias', value: 'trilhas' },
      { label: 'Área de churrasqueira', value: 'churrasco' },
      { label: 'Não possui', value: 'nao' },
    ],
  },
  {
    id: 43,
    theme: 'Estrutura',
    question: 'O hotel tem espaços para eventos/reuniões?',
    type: 'multiple',
    options: [
      { label: 'Salão de eventos grande', value: 'salao-grande' },
      { label: 'Sala de reuniões', value: 'reuniao' },
      { label: 'Espaço ao ar livre para eventos', value: 'ar-livre' },
      { label: 'Espaço para casamentos', value: 'casamentos' },
      { label: 'Auditório', value: 'auditorio' },
      { label: 'Não possui', value: 'nao' },
    ],
  },
  {
    id: 44,
    theme: 'Estrutura',
    question: 'O hotel possui serviço de quarto (room service)?',
    type: 'single',
    options: [
      { label: 'Sim, 24 horas', value: '24h' },
      { label: 'Sim, em horário limitado', value: 'limitado' },
      { label: 'Apenas café da manhã no quarto', value: 'cafe' },
      { label: 'Não possui', value: 'nao' },
    ],
  },
  {
    id: 45,
    theme: 'Estrutura',
    question: 'O hotel tem lavanderia para hóspedes?',
    type: 'single',
    options: [
      { label: 'Sim, serviço de lavanderia incluso', value: 'incluso' },
      { label: 'Sim, serviço cobrado', value: 'cobrado' },
      { label: 'Lavanderia self-service', value: 'self-service' },
      { label: 'Não possui', value: 'nao' },
    ],
  },
  {
    id: 46,
    theme: 'Estrutura',
    question: 'O hotel tem recepção 24 horas?',
    type: 'single',
    options: [
      { label: 'Sim, 24 horas presencial', value: '24h' },
      { label: 'Sim, mas com plantão noturno reduzido', value: 'plantao' },
      { label: 'Não, com horário limitado', value: 'limitado' },
      { label: 'Check-in self-service', value: 'self-service' },
    ],
  },
  {
    id: 47,
    theme: 'Estrutura',
    question: 'O hotel oferece concierge/serviço de informações turísticas?',
    type: 'single',
    options: [
      { label: 'Sim, equipe dedicada', value: 'dedicada' },
      { label: 'Sim, realizado pela recepção', value: 'recepcao' },
      { label: 'Material impresso disponível', value: 'impresso' },
      { label: 'Não oferece', value: 'nao' },
    ],
  },
  {
    id: 48,
    theme: 'Estrutura',
    question: 'O hotel oferece serviço de babá/kids club?',
    type: 'single',
    options: [
      { label: 'Sim, kids club completo', value: 'kids-club' },
      { label: 'Sim, serviço de babá', value: 'baba' },
      { label: 'Programação infantil às vezes', value: 'programacao' },
      { label: 'Não oferece', value: 'nao' },
    ],
  },
  {
    id: 49,
    theme: 'Estrutura',
    question: 'O hotel oferece locação de equipamentos?',
    type: 'multiple',
    options: [
      { label: 'Bicicletas', value: 'bicicletas' },
      { label: 'Equipamentos de praia', value: 'praia' },
      { label: 'Equipamentos de mergulho', value: 'mergulho' },
      { label: 'Equipamentos de esporte', value: 'esporte' },
      { label: 'Não oferece locação', value: 'nao' },
    ],
  },
  {
    id: 50,
    theme: 'Estrutura',
    question: 'O hotel tem loja/boutique?',
    type: 'single',
    options: [
      { label: 'Sim, loja de souvenirs e produtos locais', value: 'souvenirs' },
      { label: 'Sim, boutique de roupas/acessórios', value: 'boutique' },
      { label: 'Apenas conveniência/farmácia básica', value: 'conveniencia' },
      { label: 'Não possui', value: 'nao' },
    ],
  },
  {
    id: 51,
    theme: 'Estrutura',
    question: 'O hotel tem bar/lounge?',
    type: 'multiple',
    options: [
      { label: 'Bar completo com coquetelaria', value: 'coquetelaria' },
      { label: 'Bar de piscina', value: 'piscina' },
      { label: 'Lounge para hóspedes', value: 'lounge' },
      { label: 'Rooftop bar', value: 'rooftop' },
      { label: 'Não possui bar', value: 'nao' },
    ],
  },
  {
    id: 52,
    theme: 'Estrutura',
    question: 'Como é o serviço de limpeza dos quartos?',
    type: 'single',
    options: [
      { label: 'Limpeza diária incluída', value: 'diaria' },
      { label: 'Limpeza a cada 2 dias', value: '2-dias' },
      { label: 'Somente a pedido do hóspede', value: 'pedido' },
      { label: 'Apenas na troca de hóspede', value: 'troca' },
    ],
  },
  {
    id: 53,
    theme: 'Estrutura',
    question: 'O hotel oferece amenities nos quartos?',
    type: 'multiple',
    options: [
      { label: 'Kit completo de banho (shampoo, sabonete, etc.)', value: 'kit-banho' },
      { label: 'Roupão e chinelo', value: 'roupao' },
      { label: 'Secador de cabelo', value: 'secador' },
      { label: 'Ferro de passar', value: 'ferro' },
      { label: 'Cafeteira/chaleira', value: 'cafeteira' },
      { label: 'Amenities premium (alta qualidade)', value: 'premium' },
    ],
  },
  {
    id: 54,
    theme: 'Estrutura',
    question: 'O hotel tem gerador/energia de emergência?',
    type: 'single',
    options: [
      { label: 'Sim, gerador para todo o hotel', value: 'total' },
      { label: 'Sim, gerador parcial (áreas essenciais)', value: 'parcial' },
      { label: 'Não possui gerador', value: 'nao' },
    ],
  },

  // Gastronomia (55-68)
  {
    id: 55,
    theme: 'Gastronomia',
    question: 'O hotel possui restaurante próprio?',
    type: 'single',
    options: [
      { label: 'Sim, restaurante completo a la carte', value: 'alacarte' },
      { label: 'Sim, apenas para café da manhã', value: 'cafe' },
      { label: 'Sim, todas as refeições', value: 'todas' },
      { label: 'Não possui restaurante', value: 'nao' },
    ],
  },
  {
    id: 56,
    theme: 'Gastronomia',
    question: 'Qual a culinária predominante do restaurante?',
    type: 'multiple',
    options: [
      { label: 'Brasileira/regional', value: 'brasileira' },
      { label: 'Internacional', value: 'internacional' },
      { label: 'Frutos do mar/pescados', value: 'frutos-mar' },
      { label: 'Italiana', value: 'italiana' },
      { label: 'Japonesa/asiática', value: 'japonesa' },
      { label: 'Contemporânea/fusion', value: 'fusion' },
      { label: 'Não se aplica', value: 'nao' },
    ],
  },
  {
    id: 57,
    theme: 'Gastronomia',
    question: 'O hotel oferece opções vegetarianas/veganas?',
    type: 'single',
    options: [
      { label: 'Sim, cardápio dedicado', value: 'cardapio' },
      { label: 'Sim, opções variadas', value: 'variadas' },
      { label: 'Sim, opções limitadas', value: 'limitadas' },
      { label: 'Mediante solicitação prévia', value: 'solicitacao' },
      { label: 'Não oferece', value: 'nao' },
    ],
  },
  {
    id: 58,
    theme: 'Gastronomia',
    question: 'O restaurante tem horário específico de funcionamento?',
    type: 'single',
    options: [
      { label: 'Café: 6h-10h | Almoço: 12h-14h | Jantar: 19h-22h', value: 'horario-padrao' },
      { label: 'Só café da manhã (6h-10h)', value: 'so-cafe' },
      { label: 'Horário estendido (aberto mais de 12h)', value: 'estendido' },
      { label: 'Apenas para hóspedes', value: 'hospedes' },
    ],
  },
  {
    id: 59,
    theme: 'Gastronomia',
    question: 'O café da manhã é bufê ou à la carte?',
    type: 'single',
    options: [
      { label: 'Bufê completo', value: 'bufe' },
      { label: 'À la carte', value: 'alacarte' },
      { label: 'Caixa/saco (continental)', value: 'continental' },
      { label: 'Misto (bufê + à la carte)', value: 'misto' },
      { label: 'Não oferece café da manhã', value: 'nao' },
    ],
  },
  {
    id: 60,
    theme: 'Gastronomia',
    question: 'O hotel oferece opções para dietas especiais?',
    type: 'multiple',
    options: [
      { label: 'Sem glúten', value: 'sem-gluten' },
      { label: 'Sem lactose', value: 'sem-lactose' },
      { label: 'Kosher', value: 'kosher' },
      { label: 'Halal', value: 'halal' },
      { label: 'Baixa caloria', value: 'baixa-caloria' },
      { label: 'Não oferece opções especiais', value: 'nao' },
    ],
  },
  {
    id: 61,
    theme: 'Gastronomia',
    question: 'O restaurante é aberto ao público externo (não hóspedes)?',
    type: 'single',
    options: [
      { label: 'Sim, aberto ao público', value: 'sim' },
      { label: 'Sim, com reserva', value: 'reserva' },
      { label: 'Apenas hóspedes', value: 'hospedes' },
      { label: 'Depende do horário', value: 'depende' },
    ],
  },
  {
    id: 62,
    theme: 'Gastronomia',
    question: 'O hotel tem bar ou cave de vinhos?',
    type: 'single',
    options: [
      { label: 'Sim, adega/cave completa', value: 'adega' },
      { label: 'Sim, seleção básica de vinhos', value: 'basico' },
      { label: 'Bar com carta de drinks', value: 'bar' },
      { label: 'Não possui', value: 'nao' },
    ],
  },
  {
    id: 63,
    theme: 'Gastronomia',
    question: 'O hotel valoriza produtos locais/regionais no cardápio?',
    type: 'single',
    options: [
      { label: 'Sim, é um diferencial do hotel', value: 'diferencial' },
      { label: 'Sim, quando possível', value: 'quando-possivel' },
      { label: 'Parcialmente', value: 'parcial' },
      { label: 'Não, cardápio padrão', value: 'nao' },
    ],
  },
  {
    id: 64,
    theme: 'Gastronomia',
    question: 'O hotel oferece experiências gastronômicas especiais?',
    type: 'multiple',
    options: [
      { label: 'Jantares temáticos', value: 'jantar-tematico' },
      { label: 'Aulas de culinária', value: 'aulas' },
      { label: 'Degustação de vinhos', value: 'degustacao' },
      { label: 'Brunch especial', value: 'brunch' },
      { label: 'Noite do chefe', value: 'noite-chefe' },
      { label: 'Não oferece', value: 'nao' },
    ],
  },
  {
    id: 65,
    theme: 'Gastronomia',
    question: 'O hotel permite trazer comida/bebida de fora?',
    type: 'single',
    options: [
      { label: 'Sim, sem restrições', value: 'sim' },
      { label: 'Sim, mas cobra taxa de rolha', value: 'rolha' },
      { label: 'Apenas para o quarto', value: 'quarto' },
      { label: 'Não é permitido', value: 'nao' },
    ],
  },
  {
    id: 66,
    theme: 'Gastronomia',
    question: 'O hotel oferece deliveries e parcerias com restaurantes locais?',
    type: 'single',
    options: [
      { label: 'Sim, parcerias exclusivas', value: 'exclusivas' },
      { label: 'Sim, indica mas não é parceiro', value: 'indica' },
      { label: 'A recepção pode solicitar delivery', value: 'recepcao' },
      { label: 'Não', value: 'nao' },
    ],
  },
  {
    id: 67,
    theme: 'Gastronomia',
    question: 'Qual o destaque gastronômico do hotel?',
    type: 'text',
    options: [{ label: 'Campo aberto', value: '' }],
  },
  {
    id: 68,
    theme: 'Gastronomia',
    question: 'O hotel tem chef renomado ou culinária premiada?',
    type: 'single',
    options: [
      { label: 'Sim, chef conhecido regionalmente', value: 'regional' },
      { label: 'Sim, chef premiado/reconhecido', value: 'premiado' },
      { label: 'Equipe de cozinha qualificada', value: 'qualificada' },
      { label: 'Cozinha caseira/familiar', value: 'caseira' },
      { label: 'Não se aplica', value: 'nao' },
    ],
  },

  // Experiência do Hóspede (69-78)
  {
    id: 69,
    theme: 'Experiência do Hóspede',
    question: 'O hotel oferece atividades e passeios organizados?',
    type: 'multiple',
    options: [
      { label: 'Passeios guiados locais', value: 'passeios' },
      { label: 'Atividades aquáticas', value: 'aquaticas' },
      { label: 'Trilhas e ecoturismo', value: 'trilhas' },
      { label: 'Atividades culturais', value: 'culturais' },
      { label: 'Esportes e aventura', value: 'aventura' },
      { label: 'Workshops e cursos', value: 'workshops' },
      { label: 'Não oferece', value: 'nao' },
    ],
  },
  {
    id: 70,
    theme: 'Experiência do Hóspede',
    question: 'O hotel oferece algum item de boas-vindas?',
    type: 'multiple',
    options: [
      { label: 'Carta personalizada', value: 'carta' },
      { label: 'Frutas/chocolates/doces', value: 'doces' },
      { label: 'Bebida de boas-vindas', value: 'bebida' },
      { label: 'Produto regional', value: 'regional' },
      { label: 'Flores/decoração', value: 'flores' },
      { label: 'Não oferece', value: 'nao' },
    ],
  },
  {
    id: 71,
    theme: 'Experiência do Hóspede',
    question: 'O hotel tem algum ritual de check-in especial?',
    type: 'single',
    options: [
      { label: 'Sim, com bebida de boas-vindas', value: 'bebida' },
      { label: 'Sim, check-in personalizado com concierge', value: 'concierge' },
      { label: 'Sim, tour pelo hotel na chegada', value: 'tour' },
      { label: 'Check-in padrão na recepção', value: 'padrao' },
      { label: 'Check-in digital/self-service', value: 'digital' },
    ],
  },
  {
    id: 72,
    theme: 'Experiência do Hóspede',
    question: 'O hotel coleta preferências antes da chegada?',
    type: 'single',
    options: [
      { label: 'Sim, formulário detalhado pré-chegada', value: 'formulario' },
      { label: 'Sim, contato por WhatsApp/e-mail', value: 'contato' },
      { label: 'Apenas informações básicas', value: 'basico' },
      { label: 'Não coleta previamente', value: 'nao' },
    ],
  },
  {
    id: 73,
    theme: 'Experiência do Hóspede',
    question: 'O hotel oferece amenities especiais para ocasiões (aniversário, lua de mel)?',
    type: 'single',
    options: [
      { label: 'Sim, pacote completo para cada ocasião', value: 'completo' },
      { label: 'Sim, decoração e bolo/champanhe', value: 'basico' },
      { label: 'Sim, mediante taxa adicional', value: 'taxa' },
      { label: 'Não oferece', value: 'nao' },
    ],
  },
  {
    id: 74,
    theme: 'Experiência do Hóspede',
    question: 'O hotel tem sistema de avaliação de satisfação?',
    type: 'single',
    options: [
      { label: 'Sim, durante a estadia (digital)', value: 'durante' },
      { label: 'Sim, no check-out', value: 'checkout' },
      { label: 'Sim, por e-mail pós-estadia', value: 'pos-estadia' },
      { label: 'Não possui sistema formal', value: 'nao' },
    ],
  },
  {
    id: 75,
    theme: 'Experiência do Hóspede',
    question: 'O hotel tem alguma política de sustentabilidade?',
    type: 'multiple',
    options: [
      { label: 'Programa de reutilização de toalhas', value: 'toalhas' },
      { label: 'Energia solar/renovável', value: 'solar' },
      { label: 'Compostagem e gestão de resíduos', value: 'compostagem' },
      { label: 'Produtos de limpeza ecológicos', value: 'ecologicos' },
      { label: 'Certificação verde/sustentabilidade', value: 'certificacao' },
      { label: 'Não possui política formal', value: 'nao' },
    ],
  },
  {
    id: 76,
    theme: 'Experiência do Hóspede',
    question: 'O hotel tem área para fumantes?',
    type: 'single',
    options: [
      { label: 'Sim, área designada ao ar livre', value: 'ar-livre' },
      { label: 'Sim, quartos para fumantes disponíveis', value: 'quartos' },
      { label: 'Não, hotel totalmente não-fumante', value: 'nao-fumante' },
    ],
  },
  {
    id: 77,
    theme: 'Experiência do Hóspede',
    question: 'Qual é o diferencial mais mencionado pelos hóspedes?',
    type: 'text',
    options: [{ label: 'Campo aberto', value: '' }],
  },
  {
    id: 78,
    theme: 'Experiência do Hóspede',
    question: 'O hotel tem algum prêmio ou reconhecimento?',
    type: 'text',
    options: [{ label: 'Campo aberto (ex: TripAdvisor Certificate of Excellence, Guia 4 Rodas)...', value: '' }],
  },

  // Serviços (79-90)
  {
    id: 79,
    theme: 'Serviços',
    question: 'Quais serviços o hotel oferece no quarto?',
    type: 'multiple',
    options: [
      { label: 'Chamada de despertar', value: 'despertar' },
      { label: 'Turndown service (cama preparada à noite)', value: 'turndown' },
      { label: 'Serviço de mordomo', value: 'mordomo' },
      { label: 'Entrega de jornais', value: 'jornais' },
      { label: 'Serviço de engraxate', value: 'engraxate' },
      { label: 'Nenhum serviço adicional', value: 'nenhum' },
    ],
  },
  {
    id: 80,
    theme: 'Serviços',
    question: 'O hotel oferece serviços de beleza?',
    type: 'multiple',
    options: [
      { label: 'Salão de beleza/cabeleireiro', value: 'salao' },
      { label: 'Manicure/pedicure', value: 'manicure' },
      { label: 'Maquiagem', value: 'maquiagem' },
      { label: 'Não oferece', value: 'nao' },
    ],
  },
  {
    id: 81,
    theme: 'Serviços',
    question: 'O hotel oferece serviços de assistência médica?',
    type: 'single',
    options: [
      { label: 'Sim, médico de plantão 24h', value: '24h' },
      { label: 'Sim, médico sob chamado', value: 'chamado' },
      { label: 'Kit de primeiros socorros disponível', value: 'primeiros-socorros' },
      { label: 'Indica clínicas/hospitais próximos', value: 'indica' },
      { label: 'Não oferece', value: 'nao' },
    ],
  },
  {
    id: 82,
    theme: 'Serviços',
    question: 'O hotel tem serviço de guarda-bagagem?',
    type: 'single',
    options: [
      { label: 'Sim, gratuito', value: 'gratis' },
      { label: 'Sim, com taxa', value: 'taxa' },
      { label: 'Não oferece', value: 'nao' },
    ],
  },
  {
    id: 83,
    theme: 'Serviços',
    question: 'O hotel tem câmbio de moeda?',
    type: 'single',
    options: [
      { label: 'Sim, câmbio próprio', value: 'proprio' },
      { label: 'Sim, em parceria com casa de câmbio', value: 'parceria' },
      { label: 'Indica casa de câmbio próxima', value: 'indica' },
      { label: 'Não', value: 'nao' },
    ],
  },
  {
    id: 84,
    theme: 'Serviços',
    question: 'O hotel oferece serviços para pets?',
    type: 'multiple',
    options: [
      { label: 'Cama/almofada para pet', value: 'cama' },
      { label: 'Ração/petisco especial', value: 'racao' },
      { label: 'Área de passeio para pets', value: 'passeio' },
      { label: 'Banho e tosa', value: 'banho-tosa' },
      { label: 'Não oferece', value: 'nao' },
    ],
  },
  {
    id: 85,
    theme: 'Serviços',
    question: 'O hotel tem serviço de secretaria/business center?',
    type: 'single',
    options: [
      { label: 'Sim, business center completo', value: 'completo' },
      { label: 'Sim, impressora e computador disponíveis', value: 'basico' },
      { label: 'Apenas Wi-Fi e secretaria pela recepção', value: 'recepcao' },
      { label: 'Não possui', value: 'nao' },
    ],
  },
  {
    id: 86,
    theme: 'Serviços',
    question: 'O hotel oferece serviços de turismo receptivo?',
    type: 'multiple',
    options: [
      { label: 'Reserva de tours e passeios', value: 'tours' },
      { label: 'Aluguel de carros', value: 'carros' },
      { label: 'Reserva de restaurantes', value: 'restaurantes' },
      { label: 'Ingressos para atrações', value: 'ingressos' },
      { label: 'Guia de turismo próprio', value: 'guia' },
      { label: 'Não oferece', value: 'nao' },
    ],
  },
  {
    id: 87,
    theme: 'Serviços',
    question: 'Quais idiomas são falados pela equipe?',
    type: 'multiple',
    options: [
      { label: 'Português', value: 'portugues' },
      { label: 'Inglês', value: 'ingles' },
      { label: 'Espanhol', value: 'espanhol' },
      { label: 'Francês', value: 'frances' },
      { label: 'Alemão', value: 'alemao' },
      { label: 'Italiano', value: 'italiano' },
      { label: 'Outro', value: 'outro' },
    ],
  },
  {
    id: 88,
    theme: 'Serviços',
    question: 'O hotel tem segurança 24 horas?',
    type: 'single',
    options: [
      { label: 'Sim, segurança armada', value: 'armada' },
      { label: 'Sim, segurança patrimonial', value: 'patrimonial' },
      { label: 'Câmeras de segurança', value: 'cameras' },
      { label: 'Segurança básica (portão/interfone)', value: 'basico' },
    ],
  },
  {
    id: 89,
    theme: 'Serviços',
    question: 'O hotel tem canal de comunicação direto com hóspedes?',
    type: 'multiple',
    options: [
      { label: 'WhatsApp', value: 'whatsapp' },
      { label: 'Aplicativo próprio', value: 'app' },
      { label: 'Telefone interno do quarto', value: 'telefone' },
      { label: 'Chat na TV do quarto', value: 'tv' },
      { label: 'E-mail', value: 'email' },
      { label: 'Recepção presencial apenas', value: 'presencial' },
    ],
  },
  {
    id: 90,
    theme: 'Serviços',
    question: 'O hotel tem alguma parceria especial com marcas ou empresas locais?',
    type: 'text',
    options: [{ label: 'Campo aberto (ex: parceria com spa, vinícola, marina, escola de surf...)', value: '' }],
  },
]

// ============================================
// SEÇÃO 3: DICAS E SUGESTÕES (20 perguntas)
// ============================================

export const tipsQuestions: OnboardingQuestion[] = [
  {
    id: 1,
    theme: 'Gastronomia',
    question: 'Quais são os 5 melhores restaurantes próximos para indicar aos hóspedes?',
    type: 'top5',
    options: [
      { label: '1º restaurante', value: 'restaurante_1' },
      { label: '2º restaurante', value: 'restaurante_2' },
      { label: '3º restaurante', value: 'restaurante_3' },
      { label: '4º restaurante', value: 'restaurante_4' },
      { label: '5º restaurante', value: 'restaurante_5' },
    ],
  },
  {
    id: 2,
    theme: 'Gastronomia',
    question: 'Quais são os 5 bares e botecos mais autênticos da região?',
    type: 'top5',
    options: [
      { label: '1º bar/boteco', value: 'bar_1' },
      { label: '2º bar/boteco', value: 'bar_2' },
      { label: '3º bar/boteco', value: 'bar_3' },
      { label: '4º bar/boteco', value: 'bar_4' },
      { label: '5º bar/boteco', value: 'bar_5' },
    ],
  },
  {
    id: 3,
    theme: 'Turismo',
    question: 'Quais são os 5 pontos turísticos imperdíveis da região?',
    type: 'top5',
    options: [
      { label: '1º ponto turístico', value: 'turistico_1' },
      { label: '2º ponto turístico', value: 'turistico_2' },
      { label: '3º ponto turístico', value: 'turistico_3' },
      { label: '4º ponto turístico', value: 'turistico_4' },
      { label: '5º ponto turístico', value: 'turistico_5' },
    ],
  },
  {
    id: 4,
    theme: 'Turismo',
    question: 'Quais são os 5 passeios e atividades que você mais recomenda?',
    type: 'top5',
    options: [
      { label: '1º passeio/atividade', value: 'passeio_1' },
      { label: '2º passeio/atividade', value: 'passeio_2' },
      { label: '3º passeio/atividade', value: 'passeio_3' },
      { label: '4º passeio/atividade', value: 'passeio_4' },
      { label: '5º passeio/atividade', value: 'passeio_5' },
    ],
  },
  {
    id: 5,
    theme: 'Compras',
    question: 'Quais são os 5 melhores lugares para compras e souvenirs?',
    type: 'top5',
    options: [
      { label: '1º lugar', value: 'compras_1' },
      { label: '2º lugar', value: 'compras_2' },
      { label: '3º lugar', value: 'compras_3' },
      { label: '4º lugar', value: 'compras_4' },
      { label: '5º lugar', value: 'compras_5' },
    ],
  },
  {
    id: 6,
    theme: 'Cultura',
    question: 'Quais são os 5 melhores eventos culturais ou festivais da região?',
    type: 'top5',
    options: [
      { label: '1º evento/festival', value: 'evento_1' },
      { label: '2º evento/festival', value: 'evento_2' },
      { label: '3º evento/festival', value: 'evento_3' },
      { label: '4º evento/festival', value: 'evento_4' },
      { label: '5º evento/festival', value: 'evento_5' },
    ],
  },
  {
    id: 7,
    theme: 'Natureza',
    question: 'Quais são as 5 praias, trilhas ou cachoeiras favoritas para indicar?',
    type: 'top5',
    options: [
      { label: '1ª opção', value: 'natureza_1' },
      { label: '2ª opção', value: 'natureza_2' },
      { label: '3ª opção', value: 'natureza_3' },
      { label: '4ª opção', value: 'natureza_4' },
      { label: '5ª opção', value: 'natureza_5' },
    ],
  },
  {
    id: 8,
    theme: 'Transporte',
    question: 'Quais são os 5 melhores pontos de táxi/uber ou como se locomover na cidade?',
    type: 'top5',
    options: [
      { label: '1ª dica de transporte', value: 'transporte_1' },
      { label: '2ª dica de transporte', value: 'transporte_2' },
      { label: '3ª dica de transporte', value: 'transporte_3' },
      { label: '4ª dica de transporte', value: 'transporte_4' },
      { label: '5ª dica de transporte', value: 'transporte_5' },
    ],
  },
  {
    id: 9,
    theme: 'Saúde',
    question: 'Quais são as 5 farmácias, clínicas ou hospitais mais próximos?',
    type: 'top5',
    options: [
      { label: '1ª opção de saúde', value: 'saude_1' },
      { label: '2ª opção de saúde', value: 'saude_2' },
      { label: '3ª opção de saúde', value: 'saude_3' },
      { label: '4ª opção de saúde', value: 'saude_4' },
      { label: '5ª opção de saúde', value: 'saude_5' },
    ],
  },
  {
    id: 10,
    theme: 'Serviços',
    question: 'Quais são os 5 supermercados ou conveniências mais próximos?',
    type: 'top5',
    options: [
      { label: '1º supermercado/conveniência', value: 'supermercado_1' },
      { label: '2º supermercado/conveniência', value: 'supermercado_2' },
      { label: '3º supermercado/conveniência', value: 'supermercado_3' },
      { label: '4º supermercado/conveniência', value: 'supermercado_4' },
      { label: '5º supermercado/conveniência', value: 'supermercado_5' },
    ],
  },
  {
    id: 11,
    theme: 'Gastronomia',
    question: 'Quais são as 5 cafeterias e padarias imperdíveis?',
    type: 'top5',
    options: [
      { label: '1ª cafeteria/padaria', value: 'cafe_1' },
      { label: '2ª cafeteria/padaria', value: 'cafe_2' },
      { label: '3ª cafeteria/padaria', value: 'cafe_3' },
      { label: '4ª cafeteria/padaria', value: 'cafe_4' },
      { label: '5ª cafeteria/padaria', value: 'cafe_5' },
    ],
  },
  {
    id: 12,
    theme: 'Lazer',
    question: 'Quais são os 5 melhores espaços para família com crianças?',
    type: 'top5',
    options: [
      { label: '1º espaço para família', value: 'familia_1' },
      { label: '2º espaço para família', value: 'familia_2' },
      { label: '3º espaço para família', value: 'familia_3' },
      { label: '4º espaço para família', value: 'familia_4' },
      { label: '5º espaço para família', value: 'familia_5' },
    ],
  },
  {
    id: 13,
    theme: 'Lazer',
    question: 'Quais são os 5 programas noturnos que você recomenda (shows, baladas, teatro)?',
    type: 'top5',
    options: [
      { label: '1º programa noturno', value: 'noturno_1' },
      { label: '2º programa noturno', value: 'noturno_2' },
      { label: '3º programa noturno', value: 'noturno_3' },
      { label: '4º programa noturno', value: 'noturno_4' },
      { label: '5º programa noturno', value: 'noturno_5' },
    ],
  },
  {
    id: 14,
    theme: 'Esporte',
    question: 'Quais são os 5 melhores locais para esporte e aventura?',
    type: 'top5',
    options: [
      { label: '1º local de esporte/aventura', value: 'esporte_1' },
      { label: '2º local de esporte/aventura', value: 'esporte_2' },
      { label: '3º local de esporte/aventura', value: 'esporte_3' },
      { label: '4º local de esporte/aventura', value: 'esporte_4' },
      { label: '5º local de esporte/aventura', value: 'esporte_5' },
    ],
  },
  {
    id: 15,
    theme: 'Dicas Práticas',
    question: 'Quais são as 5 dicas de segurança importantes para os hóspedes?',
    type: 'top5',
    options: [
      { label: '1ª dica de segurança', value: 'seguranca_1' },
      { label: '2ª dica de segurança', value: 'seguranca_2' },
      { label: '3ª dica de segurança', value: 'seguranca_3' },
      { label: '4ª dica de segurança', value: 'seguranca_4' },
      { label: '5ª dica de segurança', value: 'seguranca_5' },
    ],
  },
  {
    id: 16,
    theme: 'Dicas Práticas',
    question: 'Quais são as 5 informações práticas essenciais sobre a cidade/região?',
    type: 'top5',
    options: [
      { label: '1ª informação prática', value: 'pratica_1' },
      { label: '2ª informação prática', value: 'pratica_2' },
      { label: '3ª informação prática', value: 'pratica_3' },
      { label: '4ª informação prática', value: 'pratica_4' },
      { label: '5ª informação prática', value: 'pratica_5' },
    ],
  },
  {
    id: 17,
    theme: 'Natureza',
    question: 'Quais são os 5 melhores mirantes ou pontos de fotografia da região?',
    type: 'top5',
    options: [
      { label: '1º mirante/ponto fotográfico', value: 'foto_1' },
      { label: '2º mirante/ponto fotográfico', value: 'foto_2' },
      { label: '3º mirante/ponto fotográfico', value: 'foto_3' },
      { label: '4º mirante/ponto fotográfico', value: 'foto_4' },
      { label: '5º mirante/ponto fotográfico', value: 'foto_5' },
    ],
  },
  {
    id: 18,
    theme: 'Cultura',
    question: 'Quais são os 5 museus ou centros culturais da região que vale visitar?',
    type: 'top5',
    options: [
      { label: '1º museu/centro cultural', value: 'museu_1' },
      { label: '2º museu/centro cultural', value: 'museu_2' },
      { label: '3º museu/centro cultural', value: 'museu_3' },
      { label: '4º museu/centro cultural', value: 'museu_4' },
      { label: '5º museu/centro cultural', value: 'museu_5' },
    ],
  },
  {
    id: 19,
    theme: 'Gastronomia',
    question: 'Quais são os 5 pratos ou produtos típicos da região que os hóspedes devem experimentar?',
    type: 'top5',
    options: [
      { label: '1º prato/produto típico', value: 'tipico_1' },
      { label: '2º prato/produto típico', value: 'tipico_2' },
      { label: '3º prato/produto típico', value: 'tipico_3' },
      { label: '4º prato/produto típico', value: 'tipico_4' },
      { label: '5º prato/produto típico', value: 'tipico_5' },
    ],
  },
  {
    id: 20,
    theme: 'Curiosidades',
    question: 'Quais são as 5 curiosidades ou histórias da região que todo hóspede deveria saber?',
    type: 'top5',
    options: [
      { label: '1ª curiosidade/história', value: 'curiosidade_1' },
      { label: '2ª curiosidade/história', value: 'curiosidade_2' },
      { label: '3ª curiosidade/história', value: 'curiosidade_3' },
      { label: '4ª curiosidade/história', value: 'curiosidade_4' },
      { label: '5ª curiosidade/história', value: 'curiosidade_5' },
    ],
  },
]

// ============================================
// CÁLCULO DE ARQUÉTIPO (Seção 1)
// ============================================

export type ArchetypeKey = 'concierge' | 'especialista' | 'amigo' | 'mentor' | 'explorador' | 'operador'

export interface Archetype {
  key: ArchetypeKey
  name: string
  description: string
  traits: string[]
  color: string
  bgColor: string
  textColor: string
  icon: string
}

export const archetypes: Record<ArchetypeKey, Archetype> = {
  concierge: {
    key: 'concierge',
    name: 'Concierge',
    description: 'Sofisticado, atento e discreto. Antecipa cada necessidade antes de ser solicitado, com elegância e precisão.',
    traits: ['Proativo', 'Elegante', 'Personalizado', 'Discreto'],
    color: '#D4A017',
    bgColor: '#FFF9E6',
    textColor: '#7A5C00',
    icon: '🎩',
  },
  especialista: {
    key: 'especialista',
    name: 'Especialista',
    description: 'Profundo conhecedor. Responde com precisão e confiança, sendo a referência máxima em informações.',
    traits: ['Preciso', 'Confiável', 'Detalhista', 'Técnico'],
    color: '#007BE0',
    bgColor: '#E6F4FF',
    textColor: '#004A8C',
    icon: '🔍',
  },
  amigo: {
    key: 'amigo',
    name: 'Amigo',
    description: 'Caloroso e próximo. Cria conexão genuína com cada hóspede, tornando a experiência humana e acolhedora.',
    traits: ['Caloroso', 'Próximo', 'Informal', 'Empático'],
    color: '#278F5E',
    bgColor: '#E4FAEB',
    textColor: '#145C38',
    icon: '🤝',
  },
  mentor: {
    key: 'mentor',
    name: 'Mentor',
    description: 'Sábio e orientador. Guia os hóspedes com sabedoria, compartilhando conhecimento e perspectivas valiosas.',
    traits: ['Sábio', 'Paciente', 'Orientador', 'Inspirador'],
    color: '#6846E3',
    bgColor: '#F0ECFF',
    textColor: '#3D2A8C',
    icon: '🧙',
  },
  explorador: {
    key: 'explorador',
    name: 'Explorador',
    description: 'Aventureiro e entusiasmado. Transforma cada estadia em uma descoberta, sugerindo o inesperado com paixão.',
    traits: ['Entusiasta', 'Criativo', 'Aventureiro', 'Curioso'],
    color: '#DB7706',
    bgColor: '#FFF7D3',
    textColor: '#7A4200',
    icon: '🧭',
  },
  operador: {
    key: 'operador',
    name: 'Operador',
    description: 'Eficiente e confiável. Resolve tudo com rapidez e precisão, garantindo que cada detalhe funcione perfeitamente.',
    traits: ['Eficiente', 'Direto', 'Confiável', 'Resolutivo'],
    color: '#525252',
    bgColor: '#F3F3F3',
    textColor: '#171717',
    icon: '⚙️',
  },
}

// Mapeamento de score para arquétipo dominante
// Scores das respostas de personalidade definem o arquétipo
// 1 = Operador/Especialista, 2 = Especialista/Mentor, 3 = Amigo/Explorador, 4 = Concierge/Mentor
export function calculateArchetype(answers: Record<number, string>): ArchetypeKey {
  const scores: Record<ArchetypeKey, number> = {
    concierge: 0,
    especialista: 0,
    amigo: 0,
    mentor: 0,
    explorador: 0,
    operador: 0,
  }

  personalityQuestions.forEach((question) => {
    const selectedValue = answers[question.id]
    if (!selectedValue) return

    const selectedOption = question.options.find((o) => o.value === selectedValue)
    if (!selectedOption?.score) return

    const score = selectedOption.score

    // Mapear scores para arquetipos com base em temas
    switch (question.theme) {
      case 'Identidade da Voz':
      case 'Postura':
        if (score === 1) scores.operador += 2
        if (score === 2) scores.especialista += 2
        if (score === 3) scores.amigo += 2
        if (score === 4) scores.concierge += 2
        if (score === 5) scores.explorador += 2
        break
      case 'Comunicação':
      case 'Relação com o Usuário':
        if (score === 1) scores.operador += 1
        if (score === 2) scores.especialista += 1
        if (score === 3) scores.amigo += 1
        if (score === 4) scores.concierge += 1
        break
      case 'Inteligência Percebida':
        if (score === 1) scores.operador += 1
        if (score === 2) scores.especialista += 2
        if (score === 3) scores.mentor += 1
        if (score === 4) scores.especialista += 2
        break
      case 'Personalidade':
      case 'Humor':
        if (score === 1) scores.concierge += 1
        if (score === 2) scores.especialista += 1
        if (score === 3) scores.amigo += 1
        if (score === 4) scores.explorador += 1
        if (score === 5) scores.explorador += 2
        break
      case 'Proatividade':
      case 'Experiência':
        if (score === 1) scores.operador += 1
        if (score === 2) scores.especialista += 1
        if (score === 3) scores.mentor += 1
        if (score === 4) scores.concierge += 2
        break
      case 'Narrativa':
      case 'Marca':
        if (score === 1) scores.operador += 1
        if (score === 2) scores.mentor += 1
        if (score === 3) scores.amigo += 1
        if (score === 4) scores.explorador += 2
        break
      default:
        if (score === 1) scores.operador += 1
        if (score === 2) scores.especialista += 1
        if (score === 3) scores.mentor += 1
        if (score === 4) scores.concierge += 1
        break
    }
  })

  // Retorna arquétipo com maior score
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a)
  return (sorted[0]?.[0] ?? 'operador') as ArchetypeKey
}
