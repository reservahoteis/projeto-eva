// ============================================
// English translations for onboarding questions
// Applied on top of the base Portuguese data via useOnboardingQuestions hook
//
// Usage example:
//   import { personalityTranslations, propertyTranslations, tipsTranslations, archetypeTranslations } from './onboarding-questions-en'
//   const question = personalityQuestions[0]
//   const t = personalityTranslations[question.id]
//   const label = t?.question ?? question.question
// ============================================

export interface QuestionTranslation {
  theme: string
  question: string
  options: Record<string, string> // value → English label
}

// ============================================
// PERSONALITY QUESTIONS (50 questions, ids 1-50)
// ============================================

export const personalityTranslations: Record<number, QuestionTranslation> = {
  // Voice Identity (1-5)
  1: {
    theme: 'Voice Identity',
    question: 'Perceived gender of the bot voice',
    options: {
      masculina: 'Male',
      feminina: 'Female',
      neutra: 'Neutral',
      variavel: 'Variable',
    },
  },
  2: {
    theme: 'Voice Identity',
    question: 'Perceived age range of the bot',
    options: {
      jovem: 'Young (18-25)',
      'adulto-jovem': 'Young adult (26-35)',
      adulto: 'Adult (36-50)',
      maduro: 'Mature (50+)',
    },
  },
  3: {
    theme: 'Voice Identity',
    question: 'Should the bot have a proper name?',
    options: {
      'nome-humano': 'Yes, a human name',
      'nome-criativo': 'Yes, a fictional/creative name',
      'nome-marca': 'No, just the brand name',
      indiferente: 'Indifferent',
    },
  },
  4: {
    theme: 'Voice Identity',
    question: 'What level of formality is desired?',
    options: {
      'muito-formal': 'Very formal (sir/ma\'am)',
      'formal-acessivel': 'Formal but approachable',
      informal: 'Informal and friendly',
      descontraido: 'Relaxed and casual',
    },
  },
  5: {
    theme: 'Voice Identity',
    question: 'What is the main purpose of the bot?',
    options: {
      suporte: 'Service and support',
      vendas: 'Sales and conversion',
      informacao: 'Information and guidance',
      engajamento: 'Engagement and relationship',
    },
  },

  // Communication (6-9)
  6: {
    theme: 'Communication',
    question: 'How should the bot express itself in terms of vocabulary?',
    options: {
      simples: 'Simple and direct',
      tecnico: 'Technical and precise',
      rico: 'Rich and elaborate',
      coloquial: 'Colloquial and informal',
    },
  },
  7: {
    theme: 'Communication',
    question: 'Should the bot use emojis?',
    options: {
      nunca: 'Never',
      raramente: 'Rarely (only when very appropriate)',
      moderado: 'Moderately',
      frequente: 'Frequently',
    },
  },
  8: {
    theme: 'Communication',
    question: 'How should messages be in general?',
    options: {
      curtas: 'Short and direct',
      medias: 'Medium with context',
      detalhadas: 'Detailed and complete',
      variavel: 'Variable according to context',
    },
  },
  9: {
    theme: 'Communication',
    question: 'Should the bot ask follow-up questions?',
    options: {
      sempre: 'Always, to ensure satisfaction',
      'quando-necessario': 'When necessary',
      raramente: 'Rarely',
      nunca: 'Never',
    },
  },

  // Relationship with the User (10-13)
  10: {
    theme: 'Relationship with the User',
    question: 'How should the bot treat the guest?',
    options: {
      especial: 'As a valuable and special client',
      convidado: 'As a guest at home',
      profissional: 'In a professional and respectful manner',
      amigavel: 'In a friendly and close manner',
    },
  },
  11: {
    theme: 'Relationship with the User',
    question: 'Should the bot remember user information throughout the conversation?',
    options: {
      sempre: 'Yes, reference whenever relevant',
      ocasionalmente: 'Yes, occasionally',
      essenciais: 'Only essential data',
      nao: 'Not necessary',
    },
  },
  12: {
    theme: 'Relationship with the User',
    question: 'How should the bot react to complaints?',
    options: {
      empatia: 'With full empathy and immediate apology',
      calma: 'Calmly and seeking a solution',
      neutro: 'In a neutral and resolute manner',
      humano: 'Escalate to human service',
    },
  },
  13: {
    theme: 'Relationship with the User',
    question: 'Should the bot personalize greetings by the user\'s name?',
    options: {
      sempre: 'Whenever possible',
      primeira: 'On the first message of the day',
      inicial: 'Only in the initial greeting',
      nao: 'Not necessary',
    },
  },

  // Perceived Intelligence (14-17)
  14: {
    theme: 'Perceived Intelligence',
    question: 'Should the bot demonstrate deep knowledge about the hotel?',
    options: {
      especialista: 'Yes, should be a complete expert',
      humilde: 'Yes, but with humility',
      basico: 'Basic knowledge is sufficient',
      geral: 'General knowledge only',
    },
  },
  15: {
    theme: 'Perceived Intelligence',
    question: 'How should the bot handle questions it cannot answer?',
    options: {
      admite: 'Admit and offer alternatives immediately',
      infere: 'Try to infer and confirm with the user',
      escala: 'Escalate to human service',
      reformula: 'Ask to rephrase the question',
    },
  },
  16: {
    theme: 'Perceived Intelligence',
    question: 'Should the bot make proactive recommendations?',
    options: {
      sempre: 'Yes, whenever it sees an opportunity',
      moderado: 'Yes, but with moderation',
      solicitado: 'Only when requested',
      nao: 'No, maintain focus on the client\'s request',
    },
  },
  17: {
    theme: 'Perceived Intelligence',
    question: 'What level of detail in technical responses?',
    options: {
      maximo: 'Maximum detail possible',
      detalhado: 'Detailed but accessible',
      resumido: 'Summarized and objective',
      minimo: 'Minimum necessary',
    },
  },

  // Personality (18-22)
  18: {
    theme: 'Personality',
    question: 'Which personality trait best defines the bot?',
    options: {
      sofisticado: 'Sophisticated and elegant',
      caloroso: 'Warm and welcoming',
      eficiente: 'Efficient and reliable',
      criativo: 'Creative and surprising',
      sabio: 'Wise and experienced',
    },
  },
  19: {
    theme: 'Personality',
    question: 'Should the bot have its own opinions and preferences?',
    options: {
      entusiasmo: 'Yes, with enthusiasm',
      sutil: 'Yes, but subtly',
      perguntado: 'Only when asked',
      neutro: 'No, maintain neutrality',
    },
  },
  20: {
    theme: 'Personality',
    question: 'How should the bot handle social conversations/small talk?',
    options: {
      ativo: 'Participate actively with pleasure',
      breve: 'Participate briefly and redirect',
      foco: 'Accept but maintain focus on the objective',
      redireciona: 'Politely redirect to the service',
    },
  },
  21: {
    theme: 'Personality',
    question: 'Should the bot express enthusiasm in its responses?',
    options: {
      muito: 'Always, with great enthusiasm',
      moderado: 'Moderately',
      relevantes: 'Only on relevant topics',
      equilibrado: 'Always maintain a balanced tone',
    },
  },
  22: {
    theme: 'Personality',
    question: 'What is the perceived speed of responses (urgency tone)?',
    options: {
      rapido: 'Fast and agile',
      calmo: 'Calm and thoughtful',
      eficiente: 'Efficient without rushing',
      variavel: 'According to the urgency of the topic',
    },
  },

  // Humor (23-25)
  23: {
    theme: 'Humor',
    question: 'Should the bot have a sense of humor?',
    options: {
      leve: 'Yes, light and gentle humor',
      sutil: 'Yes, subtle and sophisticated humor',
      trocadilhos: 'Only occasional wordplay',
      nao: 'No, maintain seriousness',
    },
  },
  24: {
    theme: 'Humor',
    question: 'Should the bot use metaphors and analogies?',
    options: {
      frequente: 'Yes, frequently to illustrate',
      ocasional: 'Occasionally when it helps',
      raramente: 'Rarely',
      nunca: 'Never, prefer direct language',
    },
  },
  25: {
    theme: 'Humor',
    question: 'Should the bot ask rhetorical questions?',
    options: {
      sim: 'Yes, to engage',
      raramente: 'Rarely and with a clear purpose',
      nunca: 'Never',
    },
  },

  // Stance (26-28)
  26: {
    theme: 'Stance',
    question: 'How should the bot position the hotel brand?',
    options: {
      premium: 'Premium and exclusive',
      acolhedor: 'Welcoming and familiar',
      moderno: 'Modern and innovative',
      tradicional: 'Traditional and reliable',
      descontraido: 'Relaxed and fun',
    },
  },
  27: {
    theme: 'Stance',
    question: 'Should the bot mention competitors or compare services?',
    options: {
      nunca: 'Never mention competitors',
      diferenciais: 'Only to highlight the hotel\'s differentials',
      diplomacia: 'With diplomacy when asked',
      evitar: 'Avoid the topic completely',
    },
  },
  28: {
    theme: 'Stance',
    question: 'How should the bot handle sensitive topics (politics, religion)?',
    options: {
      neutro: 'Absolute neutrality and gentle deflection',
      redireciona: 'Acknowledge and redirect',
      ignora: 'Ignore and focus on service',
      respeito: 'Respond with respect and openness',
    },
  },

  // Proactivity (29-33)
  29: {
    theme: 'Proactivity',
    question: 'Should the bot anticipate guest needs?',
    options: {
      sempre: 'Yes, proactively always',
      contexto: 'Yes, based on context',
      principais: 'Only for main services',
      solicitado: 'Only when requested',
    },
  },
  30: {
    theme: 'Proactivity',
    question: 'Should the bot suggest upgrades and additional services?',
    options: {
      ativo: 'Yes, actively (upsell)',
      natural: 'Yes, naturally when opportune',
      interesse: 'Only if the client shows interest',
      nunca: 'Never, may seem intrusive',
    },
  },
  31: {
    theme: 'Proactivity',
    question: 'How often should the bot send proactive messages (check-in, check-out, etc.)?',
    options: {
      diario: 'High frequency (daily)',
      moderada: 'Moderate (key points of the stay)',
      baixa: 'Low (only critical touchpoints)',
      zero: 'Zero, only respond',
    },
  },
  32: {
    theme: 'Proactivity',
    question: 'Should the bot actively request feedback?',
    options: {
      varios: 'Yes, at multiple moments',
      final: 'Yes, only at the end of the stay',
      satisfacao: 'Only if the guest shows satisfaction',
      nao: 'No, feedback should be spontaneous',
    },
  },
  33: {
    theme: 'Proactivity',
    question: 'Should the bot remind guests about schedules and appointments?',
    options: {
      sempre: 'Yes, in advance and at the time',
      antecedencia: 'Yes, in advance only',
      solicitado: 'Only if requested',
      nao: 'Not the bot\'s responsibility',
    },
  },

  // Experience (34-35)
  34: {
    theme: 'Experience',
    question: 'Should the bot offer personalized experiences based on history?',
    options: {
      maxima: 'Yes, maximum personalization',
      sutil: 'Yes, subtle personalizations',
      basico: 'Only basic preference data',
      igual: 'Equal treatment for everyone',
    },
  },
  35: {
    theme: 'Experience',
    question: 'How should the bot present information about hotel services?',
    options: {
      experiencias: 'As unique and special experiences',
      objetiva: 'In a clear and objective manner',
      entusiasmo: 'With enthusiasm and details',
      essencial: 'Only the essentials',
    },
  },

  // Narrative (36-37)
  36: {
    theme: 'Narrative',
    question: 'Should the bot tell stories about the hotel or destination?',
    options: {
      rico: 'Yes, rich and engaging narratives',
      curtas: 'Yes, short and relevant stories',
      raramente: 'Rarely, only if very relevant',
      nao: 'No, focus on the facts',
    },
  },
  37: {
    theme: 'Narrative',
    question: 'How should the bot describe the hotel\'s location and surroundings?',
    options: {
      poetico: 'In a poetic and inspiring way',
      pratico: 'With practical and useful information',
      mix: 'Mix of inspiration and practicality',
      necessario: 'Only what is necessary',
    },
  },

  // Brand (38-39)
  38: {
    theme: 'Brand',
    question: 'Should the bot reinforce the brand values and differentials?',
    options: {
      sempre: 'Yes, in all interactions',
      momentos: 'Yes, at key moments',
      sutil: 'Subtly',
      nao: 'Not necessary',
    },
  },
  39: {
    theme: 'Brand',
    question: 'Should the bot use brand-specific jargon and language?',
    options: {
      sempre: 'Yes, consistently',
      momentos: 'Yes, at appropriate moments',
      raramente: 'Rarely',
      nao: 'No, natural language is better',
    },
  },

  // Behavior (40-42)
  40: {
    theme: 'Behavior',
    question: 'Should the bot maintain the same tone day and night?',
    options: {
      consistente: 'Yes, total consistency',
      'formal-noite': 'Slightly more formal at night',
      adaptavel: 'Adapt to context/time of day',
      'calmo-noite': 'Calmer during rest hours',
    },
  },
  41: {
    theme: 'Behavior',
    question: 'How should the bot handle multiple requests in the same message?',
    options: {
      tudo: 'Answer everything at once, organized',
      prioriza: 'Prioritize the most urgent and mention the rest',
      divide: 'Ask to divide into separate questions',
      'uma-uma': 'Answer one and ask about the others',
    },
  },
  42: {
    theme: 'Behavior',
    question: 'Should the bot confirm understanding before acting?',
    options: {
      sempre: 'Always, to avoid errors',
      complexas: 'On complex requests',
      raramente: 'Rarely, act with agility',
      nunca: 'Never, assume and inform what was done',
    },
  },

  // Memory (43-44)
  43: {
    theme: 'Memory',
    question: 'Should the bot remember preferences from previous stays?',
    options: {
      ativo: 'Yes, and mention actively',
      sutil: 'Yes, use subtly',
      frequentes: 'Only for frequent guests',
      nao: 'No, treat each stay independently',
    },
  },
  44: {
    theme: 'Memory',
    question: 'Should the bot reference previous conversations in the same stay?',
    options: {
      sempre: 'Yes, to show attention and continuity',
      relevante: 'When relevant to the context',
      raramente: 'Rarely',
      nunca: 'Never, treat each message independently',
    },
  },

  // Limits (45-47)
  45: {
    theme: 'Limits',
    question: 'Should the bot clearly indicate when it cannot help?',
    options: {
      alternativas: 'Yes, with clear alternatives',
      suave: 'Yes, but softly',
      tenta: 'Always try to find a solution first',
      escala: 'Immediately escalate to human',
    },
  },
  46: {
    theme: 'Limits',
    question: 'How should the bot handle requests outside the hotel\'s scope?',
    options: {
      ajuda: 'Help even if outside the scope',
      limitacoes: 'Help as much as possible and indicate limitations',
      redireciona: 'Politely redirect to the hotel\'s scope',
      canal: 'Explain that this is not the appropriate channel',
    },
  },
  47: {
    theme: 'Limits',
    question: 'Should the bot accept criticism and negative feedback graciously?',
    options: {
      agradece: 'Yes, thank and commit to improving',
      solucao: 'Yes, listen and offer a solution',
      aceita: 'Accept without defensiveness',
      escala: 'Escalate to manager quickly',
    },
  },

  // Closing (48-50)
  48: {
    theme: 'Closing',
    question: 'How should the bot close a conversation?',
    options: {
      personalizado: 'With warmth and personalized wishes',
      resumo: 'With a summary of what was discussed',
      satisfacao: 'With a final satisfaction question',
      breve: 'In a brief and efficient manner',
      natural: 'Let the user close naturally',
    },
  },
  49: {
    theme: 'Closing',
    question: 'Should the bot leave an invitation for the next interaction?',
    options: {
      sempre: 'Yes, always with enthusiasm',
      natural: 'Yes, naturally',
      relevante: 'Only in relevant contexts',
      nao: 'No, just close',
    },
  },
  50: {
    theme: 'Closing',
    question: 'What should be the overall tone of the closing?',
    options: {
      caloroso: 'Warm and memorable',
      profissional: 'Professional and respectful',
      leve: 'Light and relaxed',
      eficiente: 'Efficient and direct',
    },
  },
}

// ============================================
// PROPERTY QUESTIONS (90 questions, ids 1-90)
// ============================================

export const propertyTranslations: Record<number, QuestionTranslation> = {
  // Address (1-5)
  1: {
    theme: 'Address',
    question: 'Full name of the hotel/property',
    options: {
      '': 'Open field',
    },
  },
  2: {
    theme: 'Address',
    question: 'Full address (street, number, neighborhood)',
    options: {
      '': 'Open field',
    },
  },
  3: {
    theme: 'Address',
    question: 'City and state',
    options: {
      '': 'Open field',
    },
  },
  4: {
    theme: 'Address',
    question: 'ZIP code',
    options: {
      '': 'Open field',
    },
  },
  5: {
    theme: 'Address',
    question: 'Reference point or how to get there (summary)',
    options: {
      '': 'Open field',
    },
  },

  // Type and Location (6-19)
  6: {
    theme: 'Type and Location',
    question: 'Type of property',
    options: {
      hotel: 'Hotel',
      pousada: 'Inn/Guesthouse',
      resort: 'Resort',
      hostel: 'Hostel',
      'apart-hotel': 'Apart-hotel',
      boutique: 'Boutique hotel',
      'fazenda-spa': 'Farm/Spa',
      outro: 'Other',
    },
  },
  7: {
    theme: 'Type and Location',
    question: 'Category (stars)',
    options: {
      '1': '1 star',
      '2': '2 stars',
      '3': '3 stars',
      '4': '4 stars',
      '5': '5 stars',
      'sem-classificacao': 'No official classification',
    },
  },
  8: {
    theme: 'Type and Location',
    question: 'Primary location',
    options: {
      centro: 'City center',
      praia: 'Beachfront/seaside',
      montanha: 'Mountain/highland area',
      campo: 'Rural/countryside area',
      aeroporto: 'Near airport',
      negocios: 'Business district',
      historico: 'Historic/tourist area',
      outro: 'Other',
    },
  },
  9: {
    theme: 'Type and Location',
    question: 'Is the property in an area with nearby natural attractions?',
    options: {
      praia: 'Beach/coastline',
      cachoeira: 'Waterfall/river',
      montanha: 'Mountain/trails',
      lago: 'Lake/lagoon',
      floresta: 'Forest/jungle',
      nenhum: 'No nearby natural attraction',
    },
  },
  10: {
    theme: 'Type and Location',
    question: 'Distance to the nearest airport',
    options: {
      '5km': 'Up to 5 km',
      '15km': '5 to 15 km',
      '30km': '15 to 30 km',
      '60km': '30 to 60 km',
      '60km+': 'More than 60 km',
      nao: 'Not applicable',
    },
  },
  11: {
    theme: 'Type and Location',
    question: 'Is there own transport for guests?',
    options: {
      'transfer-pago': 'Airport transfer (paid)',
      'transfer-gratis': 'Airport transfer (free)',
      shuttle: 'Shuttle to tourist spots',
      locacao: 'Vehicle rental on site',
      nenhum: 'None',
    },
  },
  12: {
    theme: 'Type and Location',
    question: 'What is the profile of the immediate surroundings?',
    options: {
      restaurantes: 'Restaurants and bars',
      shopping: 'Shopping/stores',
      turisticos: 'Tourist attractions',
      residencial: 'Quiet/residential area',
      negocios: 'Business area',
      natureza: 'Nature/parks',
    },
  },
  13: {
    theme: 'Type and Location',
    question: 'Does the property have a view of something special?',
    options: {
      mar: 'Sea view',
      montanha: 'Mountain view',
      cidade: 'City view',
      jardim: 'Garden/park view',
      piscina: 'Pool view',
      nenhuma: 'No special view',
    },
  },
  14: {
    theme: 'Type and Location',
    question: 'What is the predominant climate in the region?',
    options: {
      tropical: 'Tropical (hot and humid)',
      subtropical: 'Subtropical (mild)',
      semiarido: 'Semi-arid (dry and hot)',
      temperado: 'Temperate (cold winters)',
      altitude: 'High altitude (cold)',
    },
  },
  15: {
    theme: 'Type and Location',
    question: 'What is the best time of year to visit?',
    options: {
      'jan-fev': 'January/February',
      'mar-abr': 'March/April',
      'mai-jun': 'May/June',
      'jul-ago': 'July/August',
      'set-out': 'September/October',
      'nov-dez': 'November/December',
      'ano-todo': 'Year-round',
    },
  },
  16: {
    theme: 'Type and Location',
    question: 'What type of tourism is the hotel near?',
    options: {
      praia: 'Sun and beach tourism',
      negocios: 'Business tourism',
      eco: 'Ecotourism/adventure',
      cultural: 'Cultural/historical tourism',
      gastronomico: 'Gastronomic tourism',
      saude: 'Health and wellness tourism',
      rural: 'Rural/agro tourism',
    },
  },
  17: {
    theme: 'Type and Location',
    question: 'Does the property host events and weddings?',
    options: {
      'sim-diferencial': 'Yes, it is a hotel differentiator',
      'sim-nao-foco': 'Yes, but it is not the focus',
      corporativo: 'Corporate events only',
      nao: 'No',
    },
  },
  18: {
    theme: 'Type and Location',
    question: 'What is the main target audience?',
    options: {
      familias: 'Families with children',
      casais: 'Couples/honeymoon',
      executivos: 'Executives/business',
      grupos: 'Groups/excursions',
      mochileiros: 'Backpackers',
      internacionais: 'International tourists',
      nacionais: 'Domestic tourists',
    },
  },
  19: {
    theme: 'Type and Location',
    question: 'Does the hotel accommodate travelers with special needs (accessibility)?',
    options: {
      total: 'Yes, fully accessible',
      parcial: 'Yes, partially accessible',
      basico: 'Basic accessibility (ramps)',
      nao: 'Does not have adapted infrastructure',
    },
  },

  // Hotel Profile (20-30)
  20: {
    theme: 'Hotel Profile',
    question: 'Total number of accommodation units',
    options: {
      ate10: 'Up to 10 rooms (small)',
      '11-30': '11 to 30 rooms (small-medium)',
      '31-80': '31 to 80 rooms (medium)',
      '81-150': '81 to 150 rooms (large)',
      '150+': 'More than 150 rooms (very large)',
    },
  },
  21: {
    theme: 'Hotel Profile',
    question: 'What is the average nightly rate?',
    options: {
      economico: 'Budget (economy)',
      intermediario: 'Mid-range',
      superior: 'Superior',
      luxo: 'Luxury',
      'ultra-luxo': 'Ultra-luxury',
    },
  },
  22: {
    theme: 'Hotel Profile',
    question: 'What is the operating period?',
    options: {
      'ano-todo': 'Open year-round',
      verao: 'Seasonal (summer season)',
      inverno: 'Seasonal (winter season)',
      'alta-temporada': 'Peak season only',
      fds: 'Weekends and holidays',
    },
  },
  23: {
    theme: 'Hotel Profile',
    question: 'Does the hotel have a breakfast-included policy?',
    options: {
      incluso: 'Yes, always included',
      opcional: 'Optional (may or may not include)',
      nao: 'Does not offer breakfast',
      depende: 'Depends on room type',
    },
  },
  24: {
    theme: 'Hotel Profile',
    question: 'What is the main cancellation policy?',
    options: {
      '24h': 'Free cancellation up to 24h before',
      '48h': 'Free cancellation up to 48h before',
      '7d': 'Free cancellation up to 7 days before',
      'nao-reembolsavel': 'Non-refundable',
      variavel: 'Variable policy by rate type',
    },
  },
  25: {
    theme: 'Hotel Profile',
    question: 'Which payment methods are accepted?',
    options: {
      credito: 'Credit card',
      debito: 'Debit card',
      pix: 'PIX (instant payment)',
      dinheiro: 'Cash',
      transferencia: 'Bank transfer',
      online: 'Online advance payment',
    },
  },
  26: {
    theme: 'Hotel Profile',
    question: 'Does the hotel accept pets?',
    options: {
      sim: 'Yes, no restrictions',
      pequenos: 'Yes, small breeds only',
      taxa: 'Yes, with additional fee',
      nao: 'No pets allowed',
    },
  },
  27: {
    theme: 'Hotel Profile',
    question: 'What is the check-in time?',
    options: {
      '12h': 'From 12:00 PM',
      '13h': 'From 1:00 PM',
      '14h': 'From 2:00 PM',
      '15h': 'From 3:00 PM',
      '16h': 'From 4:00 PM',
      flexivel: 'Flexible',
    },
  },
  28: {
    theme: 'Hotel Profile',
    question: 'What is the check-out time?',
    options: {
      '10h': 'By 10:00 AM',
      '11h': 'By 11:00 AM',
      '12h': 'By 12:00 PM',
      '13h': 'By 1:00 PM',
      flexivel: 'Flexible',
    },
  },
  29: {
    theme: 'Hotel Profile',
    question: 'Does the hotel offer late check-out?',
    options: {
      gratis: 'Yes, free when available',
      taxa: 'Yes, with additional fee',
      fidelidade: 'Only for loyalty program members',
      nao: 'Does not offer',
    },
  },
  30: {
    theme: 'Hotel Profile',
    question: 'Does the hotel have a loyalty program?',
    options: {
      proprio: 'Yes, own program',
      rede: 'Yes, part of a chain with a program',
      nao: 'Does not have a loyalty program',
    },
  },

  // Structure (31-54)
  31: {
    theme: 'Structure',
    question: 'What types of accommodation are available?',
    options: {
      standard: 'Standard/Simple',
      superior: 'Superior',
      deluxe: 'Deluxe',
      suite: 'Suite',
      'suite-master': 'Master/Presidential suite',
      chale: 'Chalets/cabins',
      bangalo: 'Bungalow',
      apartamento: 'Full apartment',
      dormitorio: 'Shared dormitory',
    },
  },
  32: {
    theme: 'Structure',
    question: 'Do the rooms have air conditioning?',
    options: {
      todos: 'Yes, in all rooms',
      selecionados: 'Yes, in selected rooms',
      ventilador: 'No, but has a fan',
      desnecessario: 'Not necessary (cold climate)',
    },
  },
  33: {
    theme: 'Structure',
    question: 'Do the rooms have Wi-Fi?',
    options: {
      'gratis-todos': 'Yes, free in all rooms',
      taxa: 'Yes, with fee',
      'areas-comuns': 'Only in common areas',
      nao: 'No Wi-Fi',
    },
  },
  34: {
    theme: 'Structure',
    question: 'Do the rooms have a TV?',
    options: {
      'tv-cabo': 'Yes, cable/streaming TV',
      'tv-basica': 'Yes, basic TV',
      alguns: 'Only in some rooms',
      nao: 'No TV',
    },
  },
  35: {
    theme: 'Structure',
    question: 'Do the rooms have a minibar/mini-fridge?',
    options: {
      incluso: 'Yes, with included items',
      cobrado: 'Yes, items charged separately',
      vazio: 'Empty mini-fridge (for guest use)',
      nao: 'Does not have',
    },
  },
  36: {
    theme: 'Structure',
    question: 'Do the rooms have a safe?',
    options: {
      todos: 'Yes, in all rooms',
      superiores: 'Yes, in superior rooms',
      recepcao: 'No, only at reception',
      nao: 'No safe',
    },
  },
  37: {
    theme: 'Structure',
    question: 'Does the hotel have an elevator?',
    options: {
      sim: 'Yes, modern elevator',
      manutencao: 'Yes, but may be under maintenance',
      'nao-1-andar': 'No (only 1 floor)',
      'nao-escada': 'No (guests use stairs)',
    },
  },
  38: {
    theme: 'Structure',
    question: 'Does the hotel have parking?',
    options: {
      gratis: 'Yes, free',
      cobrado: 'Yes, charged per night',
      manobrista: 'Yes, with valet',
      nao: 'Does not have',
    },
  },
  39: {
    theme: 'Structure',
    question: 'Does the hotel have a pool?',
    options: {
      'adulto-descoberta': 'Outdoor adult pool',
      'adulto-coberta': 'Indoor adult pool',
      infantil: 'Children\'s pool',
      aquecida: 'Heated pool',
      infinita: 'Infinity pool',
      nao: 'No pool',
    },
  },
  40: {
    theme: 'Structure',
    question: 'Does the hotel have a gym/fitness center?',
    options: {
      completa: 'Yes, full gym',
      basica: 'Yes, basic gym',
      quarto: 'Equipment in the room/apartment',
      nao: 'Does not have',
    },
  },
  41: {
    theme: 'Structure',
    question: 'Does the hotel have a spa/relaxation area?',
    options: {
      spa: 'Spa with treatments',
      sauna: 'Sauna',
      jacuzzi: 'Jacuzzi/hot tub',
      massagem: 'Massage room',
      nao: 'Does not have',
    },
  },
  42: {
    theme: 'Structure',
    question: 'Does the hotel have outdoor leisure spaces?',
    options: {
      jardim: 'Garden/green area',
      deck: 'Deck/collective terrace',
      quadra: 'Sports court',
      playground: 'Children\'s playground',
      trilhas: 'Own trails',
      churrasco: 'BBQ area',
      nao: 'Does not have',
    },
  },
  43: {
    theme: 'Structure',
    question: 'Does the hotel have event/meeting spaces?',
    options: {
      'salao-grande': 'Large event hall',
      reuniao: 'Meeting room',
      'ar-livre': 'Outdoor event space',
      casamentos: 'Wedding venue',
      auditorio: 'Auditorium',
      nao: 'Does not have',
    },
  },
  44: {
    theme: 'Structure',
    question: 'Does the hotel offer room service?',
    options: {
      '24h': 'Yes, 24 hours',
      limitado: 'Yes, limited hours',
      cafe: 'Breakfast in room only',
      nao: 'Does not offer',
    },
  },
  45: {
    theme: 'Structure',
    question: 'Does the hotel have a laundry service for guests?',
    options: {
      incluso: 'Yes, laundry service included',
      cobrado: 'Yes, service charged',
      'self-service': 'Self-service laundry',
      nao: 'Does not have',
    },
  },
  46: {
    theme: 'Structure',
    question: 'Does the hotel have 24-hour reception?',
    options: {
      '24h': 'Yes, 24 hours in-person',
      plantao: 'Yes, but with reduced night shift',
      limitado: 'No, limited hours',
      'self-service': 'Self-service check-in',
    },
  },
  47: {
    theme: 'Structure',
    question: 'Does the hotel offer concierge/tourist information service?',
    options: {
      dedicada: 'Yes, dedicated team',
      recepcao: 'Yes, handled by reception',
      impresso: 'Printed materials available',
      nao: 'Does not offer',
    },
  },
  48: {
    theme: 'Structure',
    question: 'Does the hotel offer babysitter/kids club service?',
    options: {
      'kids-club': 'Yes, full kids club',
      baba: 'Yes, babysitter service',
      programacao: 'Children\'s programming occasionally',
      nao: 'Does not offer',
    },
  },
  49: {
    theme: 'Structure',
    question: 'Does the hotel offer equipment rental?',
    options: {
      bicicletas: 'Bicycles',
      praia: 'Beach equipment',
      mergulho: 'Diving equipment',
      esporte: 'Sports equipment',
      nao: 'Does not offer rental',
    },
  },
  50: {
    theme: 'Structure',
    question: 'Does the hotel have a shop/boutique?',
    options: {
      souvenirs: 'Yes, souvenir and local products shop',
      boutique: 'Yes, clothing/accessories boutique',
      conveniencia: 'Convenience store/basic pharmacy only',
      nao: 'Does not have',
    },
  },
  51: {
    theme: 'Structure',
    question: 'Does the hotel have a bar/lounge?',
    options: {
      coquetelaria: 'Full bar with cocktails',
      piscina: 'Pool bar',
      lounge: 'Guest lounge',
      rooftop: 'Rooftop bar',
      nao: 'No bar',
    },
  },
  52: {
    theme: 'Structure',
    question: 'How is the room cleaning service?',
    options: {
      diaria: 'Daily cleaning included',
      '2-dias': 'Cleaning every 2 days',
      pedido: 'Upon guest request only',
      troca: 'Only at guest change',
    },
  },
  53: {
    theme: 'Structure',
    question: 'Does the hotel offer amenities in the rooms?',
    options: {
      'kit-banho': 'Complete bath kit (shampoo, soap, etc.)',
      roupao: 'Bathrobe and slippers',
      secador: 'Hair dryer',
      ferro: 'Iron',
      cafeteira: 'Coffee maker/kettle',
      premium: 'Premium amenities (high quality)',
    },
  },
  54: {
    theme: 'Structure',
    question: 'Does the hotel have a generator/emergency power?',
    options: {
      total: 'Yes, generator for the entire hotel',
      parcial: 'Yes, partial generator (essential areas)',
      nao: 'Does not have a generator',
    },
  },

  // Gastronomy (55-68)
  55: {
    theme: 'Gastronomy',
    question: 'Does the hotel have its own restaurant?',
    options: {
      alacarte: 'Yes, full à la carte restaurant',
      cafe: 'Yes, breakfast only',
      todas: 'Yes, all meals',
      nao: 'No restaurant',
    },
  },
  56: {
    theme: 'Gastronomy',
    question: 'What is the predominant cuisine of the restaurant?',
    options: {
      brasileira: 'Brazilian/regional',
      internacional: 'International',
      'frutos-mar': 'Seafood/fish',
      italiana: 'Italian',
      japonesa: 'Japanese/Asian',
      fusion: 'Contemporary/fusion',
      nao: 'Not applicable',
    },
  },
  57: {
    theme: 'Gastronomy',
    question: 'Does the hotel offer vegetarian/vegan options?',
    options: {
      cardapio: 'Yes, dedicated menu',
      variadas: 'Yes, varied options',
      limitadas: 'Yes, limited options',
      solicitacao: 'Upon prior request',
      nao: 'Does not offer',
    },
  },
  58: {
    theme: 'Gastronomy',
    question: 'Does the restaurant have specific operating hours?',
    options: {
      'horario-padrao': 'Breakfast: 6AM-10AM | Lunch: 12PM-2PM | Dinner: 7PM-10PM',
      'so-cafe': 'Breakfast only (6AM-10AM)',
      estendido: 'Extended hours (open more than 12h)',
      hospedes: 'Hotel guests only',
    },
  },
  59: {
    theme: 'Gastronomy',
    question: 'Is breakfast buffet or à la carte?',
    options: {
      bufe: 'Full buffet',
      alacarte: 'À la carte',
      continental: 'Box/bag (continental)',
      misto: 'Mixed (buffet + à la carte)',
      nao: 'Does not offer breakfast',
    },
  },
  60: {
    theme: 'Gastronomy',
    question: 'Does the hotel offer options for special diets?',
    options: {
      'sem-gluten': 'Gluten-free',
      'sem-lactose': 'Lactose-free',
      kosher: 'Kosher',
      halal: 'Halal',
      'baixa-caloria': 'Low calorie',
      nao: 'Does not offer special options',
    },
  },
  61: {
    theme: 'Gastronomy',
    question: 'Is the restaurant open to the general public (non-guests)?',
    options: {
      sim: 'Yes, open to the public',
      reserva: 'Yes, with reservation',
      hospedes: 'Hotel guests only',
      depende: 'Depends on the time',
    },
  },
  62: {
    theme: 'Gastronomy',
    question: 'Does the hotel have a bar or wine cellar?',
    options: {
      adega: 'Yes, full wine cellar',
      basico: 'Yes, basic wine selection',
      bar: 'Bar with cocktail menu',
      nao: 'Does not have',
    },
  },
  63: {
    theme: 'Gastronomy',
    question: 'Does the hotel value local/regional products on the menu?',
    options: {
      diferencial: 'Yes, it is a hotel differentiator',
      'quando-possivel': 'Yes, when possible',
      parcial: 'Partially',
      nao: 'No, standard menu',
    },
  },
  64: {
    theme: 'Gastronomy',
    question: 'Does the hotel offer special gastronomic experiences?',
    options: {
      'jantar-tematico': 'Themed dinners',
      aulas: 'Cooking classes',
      degustacao: 'Wine tasting',
      brunch: 'Special brunch',
      'noite-chefe': 'Chef\'s night',
      nao: 'Does not offer',
    },
  },
  65: {
    theme: 'Gastronomy',
    question: 'Does the hotel allow guests to bring food/drinks from outside?',
    options: {
      sim: 'Yes, no restrictions',
      rolha: 'Yes, but charges a corkage fee',
      quarto: 'Only in the room',
      nao: 'Not permitted',
    },
  },
  66: {
    theme: 'Gastronomy',
    question: 'Does the hotel offer delivery and partnerships with local restaurants?',
    options: {
      exclusivas: 'Yes, exclusive partnerships',
      indica: 'Yes, recommends but not a partner',
      recepcao: 'Reception can request delivery',
      nao: 'No',
    },
  },
  67: {
    theme: 'Gastronomy',
    question: 'What is the gastronomic highlight of the hotel?',
    options: {
      '': 'Open field',
    },
  },
  68: {
    theme: 'Gastronomy',
    question: 'Does the hotel have a renowned chef or award-winning cuisine?',
    options: {
      regional: 'Yes, regionally known chef',
      premiado: 'Yes, award-winning/recognized chef',
      qualificada: 'Qualified kitchen team',
      caseira: 'Home-style/family cooking',
      nao: 'Not applicable',
    },
  },

  // Guest Experience (69-78)
  69: {
    theme: 'Guest Experience',
    question: 'Does the hotel offer organized activities and tours?',
    options: {
      passeios: 'Local guided tours',
      aquaticas: 'Water activities',
      trilhas: 'Trails and ecotourism',
      culturais: 'Cultural activities',
      aventura: 'Sports and adventure',
      workshops: 'Workshops and courses',
      nao: 'Does not offer',
    },
  },
  70: {
    theme: 'Guest Experience',
    question: 'Does the hotel offer a welcome item?',
    options: {
      carta: 'Personalized letter',
      doces: 'Fruits/chocolates/sweets',
      bebida: 'Welcome drink',
      regional: 'Regional product',
      flores: 'Flowers/decoration',
      nao: 'Does not offer',
    },
  },
  71: {
    theme: 'Guest Experience',
    question: 'Does the hotel have a special check-in ritual?',
    options: {
      bebida: 'Yes, with welcome drink',
      concierge: 'Yes, personalized check-in with concierge',
      tour: 'Yes, hotel tour upon arrival',
      padrao: 'Standard check-in at reception',
      digital: 'Digital/self-service check-in',
    },
  },
  72: {
    theme: 'Guest Experience',
    question: 'Does the hotel collect preferences before arrival?',
    options: {
      formulario: 'Yes, detailed pre-arrival form',
      contato: 'Yes, contact via WhatsApp/email',
      basico: 'Basic information only',
      nao: 'Does not collect in advance',
    },
  },
  73: {
    theme: 'Guest Experience',
    question: 'Does the hotel offer special amenities for occasions (birthday, honeymoon)?',
    options: {
      completo: 'Yes, complete package for each occasion',
      basico: 'Yes, decoration and cake/champagne',
      taxa: 'Yes, with additional fee',
      nao: 'Does not offer',
    },
  },
  74: {
    theme: 'Guest Experience',
    question: 'Does the hotel have a satisfaction evaluation system?',
    options: {
      durante: 'Yes, during the stay (digital)',
      checkout: 'Yes, at check-out',
      'pos-estadia': 'Yes, by email after the stay',
      nao: 'No formal system',
    },
  },
  75: {
    theme: 'Guest Experience',
    question: 'Does the hotel have a sustainability policy?',
    options: {
      toalhas: 'Towel reuse program',
      solar: 'Solar/renewable energy',
      compostagem: 'Composting and waste management',
      ecologicos: 'Eco-friendly cleaning products',
      certificacao: 'Green/sustainability certification',
      nao: 'No formal policy',
    },
  },
  76: {
    theme: 'Guest Experience',
    question: 'Does the hotel have a smoking area?',
    options: {
      'ar-livre': 'Yes, designated outdoor area',
      quartos: 'Yes, smoking rooms available',
      'nao-fumante': 'No, completely smoke-free hotel',
    },
  },
  77: {
    theme: 'Guest Experience',
    question: 'What is the differentiator most mentioned by guests?',
    options: {
      '': 'Open field',
    },
  },
  78: {
    theme: 'Guest Experience',
    question: 'Does the hotel have any award or recognition?',
    options: {
      '': 'Open field (e.g., TripAdvisor Certificate of Excellence, travel guide awards...)',
    },
  },

  // Services (79-90)
  79: {
    theme: 'Services',
    question: 'What services does the hotel offer in the room?',
    options: {
      despertar: 'Wake-up call',
      turndown: 'Turndown service (bed prepared at night)',
      mordomo: 'Butler service',
      jornais: 'Newspaper delivery',
      engraxate: 'Shoe shine service',
      nenhum: 'No additional services',
    },
  },
  80: {
    theme: 'Services',
    question: 'Does the hotel offer beauty services?',
    options: {
      salao: 'Beauty salon/hairdresser',
      manicure: 'Manicure/pedicure',
      maquiagem: 'Makeup',
      nao: 'Does not offer',
    },
  },
  81: {
    theme: 'Services',
    question: 'Does the hotel offer medical assistance services?',
    options: {
      '24h': 'Yes, on-call doctor 24h',
      chamado: 'Yes, doctor on call',
      'primeiros-socorros': 'First aid kit available',
      indica: 'Indicates nearby clinics/hospitals',
      nao: 'Does not offer',
    },
  },
  82: {
    theme: 'Services',
    question: 'Does the hotel have a luggage storage service?',
    options: {
      gratis: 'Yes, free',
      taxa: 'Yes, with fee',
      nao: 'Does not offer',
    },
  },
  83: {
    theme: 'Services',
    question: 'Does the hotel have currency exchange?',
    options: {
      proprio: 'Yes, own currency exchange',
      parceria: 'Yes, in partnership with exchange house',
      indica: 'Indicates a nearby exchange house',
      nao: 'No',
    },
  },
  84: {
    theme: 'Services',
    question: 'Does the hotel offer pet services?',
    options: {
      cama: 'Pet bed/cushion',
      racao: 'Special food/treats',
      passeio: 'Pet walking area',
      'banho-tosa': 'Pet grooming',
      nao: 'Does not offer',
    },
  },
  85: {
    theme: 'Services',
    question: 'Does the hotel have a secretarial/business center service?',
    options: {
      completo: 'Yes, full business center',
      basico: 'Yes, printer and computer available',
      recepcao: 'Wi-Fi and secretarial service through reception only',
      nao: 'Does not have',
    },
  },
  86: {
    theme: 'Services',
    question: 'Does the hotel offer inbound tourism services?',
    options: {
      tours: 'Tour and excursion booking',
      carros: 'Car rental',
      restaurantes: 'Restaurant reservations',
      ingressos: 'Attraction tickets',
      guia: 'Own tour guide',
      nao: 'Does not offer',
    },
  },
  87: {
    theme: 'Services',
    question: 'Which languages are spoken by the team?',
    options: {
      portugues: 'Portuguese',
      ingles: 'English',
      espanhol: 'Spanish',
      frances: 'French',
      alemao: 'German',
      italiano: 'Italian',
      outro: 'Other',
    },
  },
  88: {
    theme: 'Services',
    question: 'Does the hotel have 24-hour security?',
    options: {
      armada: 'Yes, armed security',
      patrimonial: 'Yes, property security',
      cameras: 'Security cameras',
      basico: 'Basic security (gate/intercom)',
    },
  },
  89: {
    theme: 'Services',
    question: 'Does the hotel have a direct communication channel with guests?',
    options: {
      whatsapp: 'WhatsApp',
      app: 'Own app',
      telefone: 'Room phone',
      tv: 'TV chat in the room',
      email: 'Email',
      presencial: 'In-person reception only',
    },
  },
  90: {
    theme: 'Services',
    question: 'Does the hotel have any special partnerships with local brands or companies?',
    options: {
      '': 'Open field (e.g., partnership with spa, winery, marina, surf school...)',
    },
  },
}

// ============================================
// TIPS QUESTIONS (20 questions, ids 1-20)
// ============================================

export const tipsTranslations: Record<number, QuestionTranslation> = {
  1: {
    theme: 'Gastronomy',
    question: 'What are the top 5 best nearby restaurants to recommend to guests?',
    options: {
      restaurante_1: '1st restaurant',
      restaurante_2: '2nd restaurant',
      restaurante_3: '3rd restaurant',
      restaurante_4: '4th restaurant',
      restaurante_5: '5th restaurant',
    },
  },
  2: {
    theme: 'Gastronomy',
    question: 'What are the top 5 most authentic bars and local spots in the region?',
    options: {
      bar_1: '1st bar/local spot',
      bar_2: '2nd bar/local spot',
      bar_3: '3rd bar/local spot',
      bar_4: '4th bar/local spot',
      bar_5: '5th bar/local spot',
    },
  },
  3: {
    theme: 'Tourism',
    question: 'What are the top 5 must-see tourist attractions in the region?',
    options: {
      turistico_1: '1st tourist attraction',
      turistico_2: '2nd tourist attraction',
      turistico_3: '3rd tourist attraction',
      turistico_4: '4th tourist attraction',
      turistico_5: '5th tourist attraction',
    },
  },
  4: {
    theme: 'Tourism',
    question: 'What are the top 5 tours and activities you most recommend?',
    options: {
      passeio_1: '1st tour/activity',
      passeio_2: '2nd tour/activity',
      passeio_3: '3rd tour/activity',
      passeio_4: '4th tour/activity',
      passeio_5: '5th tour/activity',
    },
  },
  5: {
    theme: 'Shopping',
    question: 'What are the top 5 best places for shopping and souvenirs?',
    options: {
      compras_1: '1st place',
      compras_2: '2nd place',
      compras_3: '3rd place',
      compras_4: '4th place',
      compras_5: '5th place',
    },
  },
  6: {
    theme: 'Culture',
    question: 'What are the top 5 best cultural events or festivals in the region?',
    options: {
      evento_1: '1st event/festival',
      evento_2: '2nd event/festival',
      evento_3: '3rd event/festival',
      evento_4: '4th event/festival',
      evento_5: '5th event/festival',
    },
  },
  7: {
    theme: 'Nature',
    question: 'What are your top 5 favorite beaches, trails, or waterfalls to recommend?',
    options: {
      natureza_1: '1st option',
      natureza_2: '2nd option',
      natureza_3: '3rd option',
      natureza_4: '4th option',
      natureza_5: '5th option',
    },
  },
  8: {
    theme: 'Transportation',
    question: 'What are the top 5 best taxi/rideshare spots or how to get around the city?',
    options: {
      transporte_1: '1st transportation tip',
      transporte_2: '2nd transportation tip',
      transporte_3: '3rd transportation tip',
      transporte_4: '4th transportation tip',
      transporte_5: '5th transportation tip',
    },
  },
  9: {
    theme: 'Health',
    question: 'What are the top 5 nearest pharmacies, clinics, or hospitals?',
    options: {
      saude_1: '1st health option',
      saude_2: '2nd health option',
      saude_3: '3rd health option',
      saude_4: '4th health option',
      saude_5: '5th health option',
    },
  },
  10: {
    theme: 'Services',
    question: 'What are the top 5 nearest supermarkets or convenience stores?',
    options: {
      supermercado_1: '1st supermarket/convenience',
      supermercado_2: '2nd supermarket/convenience',
      supermercado_3: '3rd supermarket/convenience',
      supermercado_4: '4th supermarket/convenience',
      supermercado_5: '5th supermarket/convenience',
    },
  },
  11: {
    theme: 'Gastronomy',
    question: 'What are the top 5 must-visit coffee shops and bakeries?',
    options: {
      cafe_1: '1st coffee shop/bakery',
      cafe_2: '2nd coffee shop/bakery',
      cafe_3: '3rd coffee shop/bakery',
      cafe_4: '4th coffee shop/bakery',
      cafe_5: '5th coffee shop/bakery',
    },
  },
  12: {
    theme: 'Leisure',
    question: 'What are the top 5 best spaces for families with children?',
    options: {
      familia_1: '1st family space',
      familia_2: '2nd family space',
      familia_3: '3rd family space',
      familia_4: '4th family space',
      familia_5: '5th family space',
    },
  },
  13: {
    theme: 'Leisure',
    question: 'What are the top 5 nightlife programs you recommend (shows, clubs, theater)?',
    options: {
      noturno_1: '1st nightlife program',
      noturno_2: '2nd nightlife program',
      noturno_3: '3rd nightlife program',
      noturno_4: '4th nightlife program',
      noturno_5: '5th nightlife program',
    },
  },
  14: {
    theme: 'Sports',
    question: 'What are the top 5 best places for sports and adventure?',
    options: {
      esporte_1: '1st sports/adventure spot',
      esporte_2: '2nd sports/adventure spot',
      esporte_3: '3rd sports/adventure spot',
      esporte_4: '4th sports/adventure spot',
      esporte_5: '5th sports/adventure spot',
    },
  },
  15: {
    theme: 'Practical Tips',
    question: 'What are the top 5 important safety tips for guests?',
    options: {
      seguranca_1: '1st safety tip',
      seguranca_2: '2nd safety tip',
      seguranca_3: '3rd safety tip',
      seguranca_4: '4th safety tip',
      seguranca_5: '5th safety tip',
    },
  },
  16: {
    theme: 'Practical Tips',
    question: 'What are the top 5 essential practical facts about the city/region?',
    options: {
      pratica_1: '1st practical fact',
      pratica_2: '2nd practical fact',
      pratica_3: '3rd practical fact',
      pratica_4: '4th practical fact',
      pratica_5: '5th practical fact',
    },
  },
  17: {
    theme: 'Nature',
    question: 'What are the top 5 best viewpoints or photography spots in the region?',
    options: {
      foto_1: '1st viewpoint/photo spot',
      foto_2: '2nd viewpoint/photo spot',
      foto_3: '3rd viewpoint/photo spot',
      foto_4: '4th viewpoint/photo spot',
      foto_5: '5th viewpoint/photo spot',
    },
  },
  18: {
    theme: 'Culture',
    question: 'What are the top 5 museums or cultural centers in the region worth visiting?',
    options: {
      museu_1: '1st museum/cultural center',
      museu_2: '2nd museum/cultural center',
      museu_3: '3rd museum/cultural center',
      museu_4: '4th museum/cultural center',
      museu_5: '5th museum/cultural center',
    },
  },
  19: {
    theme: 'Gastronomy',
    question: 'What are the top 5 regional dishes or local products guests should try?',
    options: {
      tipico_1: '1st regional dish/product',
      tipico_2: '2nd regional dish/product',
      tipico_3: '3rd regional dish/product',
      tipico_4: '4th regional dish/product',
      tipico_5: '5th regional dish/product',
    },
  },
  20: {
    theme: 'Curiosities',
    question: 'What are the top 5 curiosities or stories about the region that every guest should know?',
    options: {
      curiosidade_1: '1st curiosity/story',
      curiosidade_2: '2nd curiosity/story',
      curiosidade_3: '3rd curiosity/story',
      curiosidade_4: '4th curiosity/story',
      curiosidade_5: '5th curiosity/story',
    },
  },
}

// ============================================
// ARCHETYPE TRANSLATIONS
// ============================================

export const archetypeTranslations: Record<
  string,
  {
    name: string
    description: string
    traits: string[]
  }
> = {
  concierge: {
    name: 'Concierge',
    description:
      'Sophisticated, attentive and discreet. Anticipates every need before being asked, with elegance and precision.',
    traits: ['Proactive', 'Elegant', 'Personalized', 'Discreet'],
  },
  especialista: {
    name: 'Specialist',
    description:
      'Deep expert. Responds with precision and confidence, being the ultimate reference for information.',
    traits: ['Precise', 'Reliable', 'Detail-oriented', 'Technical'],
  },
  amigo: {
    name: 'Friend',
    description:
      'Warm and close. Creates genuine connection with each guest, making the experience human and welcoming.',
    traits: ['Warm', 'Close', 'Informal', 'Empathic'],
  },
  mentor: {
    name: 'Mentor',
    description:
      'Wise and guiding. Guides guests with wisdom, sharing valuable knowledge and perspectives.',
    traits: ['Wise', 'Patient', 'Guiding', 'Inspiring'],
  },
  explorador: {
    name: 'Explorer',
    description:
      'Adventurous and enthusiastic. Turns every stay into a discovery, suggesting the unexpected with passion.',
    traits: ['Enthusiastic', 'Creative', 'Adventurous', 'Curious'],
  },
  operador: {
    name: 'Operator',
    description:
      'Efficient and reliable. Resolves everything quickly and precisely, ensuring every detail works perfectly.',
    traits: ['Efficient', 'Direct', 'Reliable', 'Problem-solver'],
  },
}
