'use client';

import { WhatsAppListMessage } from './WhatsAppListMessage';
import { WhatsAppCarouselMessage } from './WhatsAppCarouselMessage';

/**
 * Demo Component for Interactive WhatsApp Messages
 *
 * This component demonstrates the WhatsApp iOS-style rendering of:
 * 1. List messages (interactive lists)
 * 2. Carousel messages (template carousels)
 *
 * Usage: Import this component in a test page to see the components in action
 */
export function InteractiveMessagesDemo() {
  // Example list message data
  const listMessageData = {
    header: 'Nossos Serviços',
    body: 'Escolha uma das opções abaixo para saber mais sobre nossos serviços de hotel:',
    footer: 'Estamos à disposição para ajudá-lo',
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
          }
        ]
      }
    ]
  };

  // Example carousel message data
  const carouselMessageData = {
    templateName: 'Promoções de Verão',
    cards: [
      {
        imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&h=500&fit=crop',
        bodyParams: ['Suíte Deluxe com desconto de 30% - Reserve agora e aproveite!'],
        buttonPayloads: ['Reservar Agora', 'https://booking.example.com/deluxe']
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&h=500&fit=crop',
        bodyParams: ['Pacote Spa Completo - 3 dias de relaxamento total com massagens incluídas'],
        buttonPayloads: ['Ver Detalhes', 'https://booking.example.com/spa']
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=500&h=500&fit=crop',
        bodyParams: ['Jantar Romântico à Beira-Mar - Menu especial para casais'],
        buttonPayloads: ['Agendar', 'https://booking.example.com/dinner']
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=500&h=500&fit=crop',
        bodyParams: ['Café da Manhã Especial - Buffet completo incluído na tarifa'],
        buttonPayloads: ['Mais Informações']
      }
    ]
  };

  return (
    <div className="min-h-screen bg-[#e5ddd5] p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-[#111b21] mb-2">
            WhatsApp Interactive Messages Demo
          </h1>
          <p className="text-[#667781] text-sm">
            Demonstração dos componentes de mensagens interativas do WhatsApp (Listas e Carrosséis)
            com design idêntico ao WhatsApp iOS 2024/2025
          </p>
        </div>

        {/* List Message Demo */}
        <div className="space-y-3">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-semibold text-[#111b21] mb-1">
              Lista Interativa
            </h2>
            <p className="text-sm text-[#667781] mb-3">
              Mensagem com botão que abre uma lista de opções organizadas por seções
            </p>
          </div>

          {/* Simulated chat bubble */}
          <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[75%] md:max-w-[65%]">
            <div
              className="bg-white rounded-lg shadow-sm"
              style={{ boxShadow: '0 1px 0.5px rgba(0,0,0,.13)' }}
            >
              <WhatsAppListMessage
                header={listMessageData.header}
                body={listMessageData.body}
                footer={listMessageData.footer}
                buttonLabel={listMessageData.buttonLabel}
                sections={listMessageData.sections}
                isOwnMessage={false}
              />
            </div>
          </div>
        </div>

        {/* Carousel Message Demo */}
        <div className="space-y-3">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-semibold text-[#111b21] mb-1">
              Carrossel de Template
            </h2>
            <p className="text-sm text-[#667781] mb-3">
              Cards deslizáveis horizontalmente com imagens, texto e botões de ação
            </p>
          </div>

          {/* Simulated chat bubble */}
          <div className="flex items-end gap-2 max-w-[95%] sm:max-w-[85%]">
            <div
              className="bg-white rounded-lg shadow-sm overflow-hidden"
              style={{ boxShadow: '0 1px 0.5px rgba(0,0,0,.13)' }}
            >
              <WhatsAppCarouselMessage
                cards={carouselMessageData.cards}
                templateName={carouselMessageData.templateName}
                isOwnMessage={false}
              />
            </div>
          </div>
        </div>

        {/* Design Specifications */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-[#111b21] mb-4">
            Especificações de Design
          </h2>

          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-medium text-[#111b21] mb-2">Cores WhatsApp</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#00a884] border border-gray-200"></div>
                  <span className="text-xs text-[#667781]">#00a884 (Green)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#027eb5] border border-gray-200"></div>
                  <span className="text-xs text-[#667781]">#027eb5 (Blue)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#111b21] border border-gray-200"></div>
                  <span className="text-xs text-[#667781]">#111b21 (Text)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#667781] border border-gray-200"></div>
                  <span className="text-xs text-[#667781]">#667781 (Secondary)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#f0f2f5] border border-gray-200"></div>
                  <span className="text-xs text-[#667781]">#f0f2f5 (Background)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#d9fdd3] border border-gray-200"></div>
                  <span className="text-xs text-[#667781]">#d9fdd3 (Own msg)</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-[#111b21] mb-2">Features Implementadas</h3>
              <ul className="list-disc list-inside space-y-1 text-[#667781]">
                <li>Border radius 16px para cards principais, 8px para elementos internos</li>
                <li>Sombras sutis e em camadas (box-shadow multi-layer)</li>
                <li>Tipografia: System font stack (San Francisco / Segoe UI)</li>
                <li>Bottom sheet modal no mobile, card centralizado no desktop</li>
                <li>Scroll horizontal suave com snap-to-center para carrossel</li>
                <li>Drag/swipe para navegação de cards</li>
                <li>Indicadores de paginação (dots) e navegação por setas</li>
                <li>Transições e animações suaves (cubic-bezier curves)</li>
                <li>Responsivo: mobile-first design</li>
                <li>Acessibilidade: keyboard navigation, ARIA labels</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
