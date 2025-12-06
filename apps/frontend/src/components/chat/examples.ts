/**
 * Example data for WhatsApp Interactive Messages
 *
 * Use these examples for testing and development
 */

// ============================================
// LIST MESSAGE EXAMPLES
// ============================================

export const listMessageExample1 = {
  header: 'Nossos Serviços',
  body: 'Escolha uma das opções abaixo para saber mais sobre nossos serviços de hotel:',
  footer: 'Estamos à disposição para ajudá-lo 24/7',
  buttonLabel: 'Ver Serviços',
  sections: [
    {
      title: 'Acomodações',
      rows: [
        {
          id: 'room-standard',
          title: 'Quarto Standard',
          description: 'Quarto confortável com cama de casal, TV e WiFi'
        },
        {
          id: 'room-deluxe',
          title: 'Quarto Deluxe',
          description: 'Quarto espaçoso com varanda e vista para o mar'
        },
        {
          id: 'suite',
          title: 'Suíte Master',
          description: 'Suíte luxuosa com sala de estar e banheira de hidromassagem'
        }
      ]
    },
    {
      title: 'Serviços',
      rows: [
        {
          id: 'spa',
          title: 'Spa & Wellness',
          description: 'Tratamentos relaxantes e massagens terapêuticas'
        },
        {
          id: 'restaurant',
          title: 'Restaurante',
          description: 'Culinária internacional e pratos da região'
        },
        {
          id: 'pool',
          title: 'Piscina',
          description: 'Piscina aquecida com bar molhado'
        },
        {
          id: 'gym',
          title: 'Academia',
          description: 'Academia completa 24 horas'
        }
      ]
    }
  ]
};

export const listMessageExample2 = {
  body: 'Selecione o tipo de quarto que deseja reservar:',
  buttonLabel: 'Escolher Quarto',
  sections: [
    {
      rows: [
        {
          id: 'single',
          title: 'Quarto Single',
          description: 'R$ 150/noite - Cama de solteiro'
        },
        {
          id: 'double',
          title: 'Quarto Double',
          description: 'R$ 200/noite - Cama de casal'
        },
        {
          id: 'twin',
          title: 'Quarto Twin',
          description: 'R$ 220/noite - Duas camas de solteiro'
        },
        {
          id: 'suite',
          title: 'Suíte',
          description: 'R$ 350/noite - Sala de estar + quarto'
        }
      ]
    }
  ]
};

export const listMessageExample3 = {
  header: 'Menu de Restaurante',
  body: 'Faça seu pedido através do nosso menu digital:',
  buttonLabel: 'Ver Menu',
  sections: [
    {
      title: 'Entradas',
      rows: [
        {
          id: 'salad',
          title: 'Salada Caesar',
          description: 'R$ 25 - Alface, croutons, parmesão'
        },
        {
          id: 'soup',
          title: 'Sopa do Dia',
          description: 'R$ 18 - Consulte o chef'
        }
      ]
    },
    {
      title: 'Pratos Principais',
      rows: [
        {
          id: 'steak',
          title: 'Filé Mignon',
          description: 'R$ 65 - 300g com acompanhamentos'
        },
        {
          id: 'fish',
          title: 'Salmão Grelhado',
          description: 'R$ 58 - Com legumes e arroz'
        },
        {
          id: 'pasta',
          title: 'Massa ao Pesto',
          description: 'R$ 42 - Penne com molho pesto'
        }
      ]
    },
    {
      title: 'Sobremesas',
      rows: [
        {
          id: 'tiramisu',
          title: 'Tiramisú',
          description: 'R$ 22 - Receita italiana tradicional'
        },
        {
          id: 'pudding',
          title: 'Pudim de Leite',
          description: 'R$ 18 - Caseiro com calda'
        }
      ]
    }
  ]
};

// ============================================
// CAROUSEL MESSAGE EXAMPLES
// ============================================

export const carouselMessageExample1 = {
  templateName: 'Promoções de Verão',
  cards: [
    {
      imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&h=500&fit=crop',
      bodyParams: ['Suíte Deluxe com desconto de 30% - Reserve agora e aproveite nossa oferta especial de verão!'],
      buttonPayloads: ['Reservar Agora', 'https://booking.example.com/deluxe']
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&h=500&fit=crop',
      bodyParams: ['Pacote Spa Completo - 3 dias de relaxamento total com massagens e tratamentos incluídos'],
      buttonPayloads: ['Ver Detalhes', 'https://booking.example.com/spa']
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=500&h=500&fit=crop',
      bodyParams: ['Jantar Romântico à Beira-Mar - Menu especial para casais com vista privilegiada'],
      buttonPayloads: ['Agendar Jantar', 'https://booking.example.com/dinner']
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=500&h=500&fit=crop',
      bodyParams: ['Café da Manhã Especial - Buffet completo incluído na tarifa com opções regionais'],
      buttonPayloads: ['Mais Informações']
    }
  ]
};

export const carouselMessageExample2 = {
  templateName: 'Acomodações Disponíveis',
  cards: [
    {
      imageUrl: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=500&h=500&fit=crop',
      bodyParams: ['Quarto Standard - R$ 180/noite\nCama queen, TV smart, WiFi, frigobar'],
      buttonPayloads: ['Reservar', 'Ver Fotos']
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=500&h=500&fit=crop',
      bodyParams: ['Quarto Deluxe - R$ 250/noite\nVista mar, varanda, banheira, amenities premium'],
      buttonPayloads: ['Reservar', 'Ver Fotos']
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=500&h=500&fit=crop',
      bodyParams: ['Suíte Master - R$ 450/noite\nSala de estar, jacuzzi, serviço de mordomo 24h'],
      buttonPayloads: ['Reservar', 'Ver Fotos']
    }
  ]
};

export const carouselMessageExample3 = {
  templateName: 'Experiências Exclusivas',
  cards: [
    {
      imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=500&h=500&fit=crop',
      bodyParams: ['Passeio de Barco ao Pôr do Sol - Inclui drinks e petiscos'],
      buttonPayloads: ['Agendar', 'https://booking.example.com/boat']
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=500&fit=crop',
      bodyParams: ['Trilha Ecológica Guiada - Explore a natureza com guia especializado'],
      buttonPayloads: ['Agendar', 'https://booking.example.com/trail']
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=500&h=500&fit=crop',
      bodyParams: ['Aula de Surf - Equipamento e instrutor incluídos, todos os níveis'],
      buttonPayloads: ['Agendar', 'https://booking.example.com/surf']
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=500&h=500&fit=crop',
      bodyParams: ['Mergulho com Snorkel - Explore a vida marinha local'],
      buttonPayloads: ['Agendar', 'https://booking.example.com/snorkel']
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=500&h=500&fit=crop',
      bodyParams: ['Yoga ao Amanhecer - Sessão relaxante com vista para o mar'],
      buttonPayloads: ['Agendar', 'https://booking.example.com/yoga']
    }
  ]
};

// ============================================
// BACKEND MESSAGE FORMAT EXAMPLES
// ============================================

export const backendListMessageFormat = {
  type: 'INTERACTIVE',
  content: 'Escolha uma das opções abaixo para saber mais sobre nossos serviços:',
  metadata: {
    interactiveType: 'list',
    header: 'Nossos Serviços',
    footer: 'Estamos à disposição 24/7',
    buttonLabel: 'Ver Serviços',
    sections: [
      {
        title: 'Acomodações',
        rows: [
          {
            id: 'room-standard',
            title: 'Quarto Standard',
            description: 'Quarto confortável com cama de casal'
          }
        ]
      }
    ]
  }
};

export const backendCarouselMessageFormat = {
  type: 'TEMPLATE',
  metadata: {
    templateType: 'carousel',
    templateName: 'promocoes_verao',
    cards: [
      {
        imageUrl: 'https://example.com/image1.jpg',
        bodyParams: ['Suíte Deluxe - 30% OFF'],
        buttonPayloads: ['Reservar Agora', 'https://booking.com/deluxe']
      }
    ]
  }
};

// ============================================
// N8N API PAYLOAD EXAMPLES
// ============================================

export const n8nListPayload = {
  phone: '5511999999999',
  message: 'Escolha uma opção:',
  buttonText: 'Ver Opções',
  sections: [
    {
      title: 'Seção 1',
      rows: [
        {
          id: 'opt1',
          title: 'Opção 1',
          description: 'Descrição da opção 1'
        },
        {
          id: 'opt2',
          title: 'Opção 2',
          description: 'Descrição da opção 2'
        }
      ]
    }
  ]
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert N8N format to internal message format
 */
export function convertN8NListToMessage(payload: any) {
  return {
    type: 'INTERACTIVE',
    content: payload.message,
    metadata: {
      interactiveType: 'list',
      buttonLabel: payload.buttonText || 'Ver opções',
      sections: payload.sections
    }
  };
}

/**
 * Generate random example data for testing
 */
export function getRandomListExample() {
  const examples = [listMessageExample1, listMessageExample2, listMessageExample3];
  return examples[Math.floor(Math.random() * examples.length)];
}

export function getRandomCarouselExample() {
  const examples = [carouselMessageExample1, carouselMessageExample2, carouselMessageExample3];
  return examples[Math.floor(Math.random() * examples.length)];
}
