import puppeteer, { Browser, Page } from 'puppeteer';
import logger from '@/config/logger';

/**
 * Mapeamento de unidades para companyId do HBook
 */
const COMPANY_IDS: Record<string, string> = {
  'CAMPOS': '67bcbe2ca5788fa175aa8b38',
  'CAMPOS DO JORDAO': '67bcbe2ca5788fa175aa8b38',
  'ILHABELA': '5f15f591ab41d43ac0fed67e',
  'CAMBURI': '6750b19f496b9fcb0e105ccb',
  'SANTO ANTONIO': '662ff573ca37a716229fe257',
  'SANTO ANTONIO DO PINHAL': '662ff573ca37a716229fe257',
};

/**
 * Interface para quarto disponível
 */
export interface AvailableRoom {
  id: string;
  name: string;
  description?: string;
  price?: number;
  originalPrice?: number;
  available: boolean;
  maxAdults?: number;
  maxChildren?: number;
  amenities?: string[];
  imageUrl?: string;
}

/**
 * Interface para resultado da verificação de disponibilidade
 */
export interface AvailabilityResult {
  success: boolean;
  companyId: string;
  unidade: string;
  checkin: string;
  checkout: string;
  adults: number;
  children?: number;
  childrenAges?: number[];
  rooms: AvailableRoom[];
  scrapedAt: string;
  error?: string;
}

/**
 * Serviço de scraping do HBook para verificar disponibilidade de quartos
 */
class HBookScraperService {
  private browser: Browser | null = null;

  /**
   * Obtém ou cria instância do browser
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      this.browser = await puppeteer.launch({
        headless: true,
        // Usar Chromium do sistema em Docker (definido por PUPPETEER_EXECUTABLE_PATH)
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
          '--single-process', // Necessário para Alpine
        ],
      });
    }
    return this.browser;
  }

  /**
   * Fecha o browser
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Obtém o companyId a partir do nome da unidade
   */
  getCompanyId(unidade: string): string | null {
    const normalizedUnidade = unidade
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    return COMPANY_IDS[normalizedUnidade] || null;
  }

  /**
   * Monta a URL do HBook com os parâmetros
   */
  buildUrl(
    companyId: string,
    checkin: string,
    checkout: string,
    adults: number,
    children?: number,
    childrenAges?: number[]
  ): string {
    let url = `https://hbook.hsystem.com.br/Booking?companyId=${companyId}`;
    url += `&checkin=${encodeURIComponent(checkin)}`;
    url += `&checkout=${encodeURIComponent(checkout)}`;
    url += `&adults=${adults}`;

    if (children && children > 0) {
      url += `&children=${children}`;
      if (childrenAges && childrenAges.length > 0) {
        childrenAges.forEach(age => {
          url += `&childrenage=${age}`;
        });
      }
    }

    return url;
  }

  /**
   * Verifica disponibilidade de quartos no HBook
   */
  async checkAvailability(
    unidade: string,
    checkin: string,
    checkout: string,
    adults: number,
    children?: number,
    childrenAges?: number[]
  ): Promise<AvailabilityResult> {
    const companyId = this.getCompanyId(unidade);

    if (!companyId) {
      return {
        success: false,
        companyId: '',
        unidade,
        checkin,
        checkout,
        adults,
        children,
        childrenAges,
        rooms: [],
        scrapedAt: new Date().toISOString(),
        error: `Unidade "${unidade}" não encontrada. Unidades válidas: ${Object.keys(COMPANY_IDS).join(', ')}`,
      };
    }

    const url = this.buildUrl(companyId, checkin, checkout, adults, children, childrenAges);
    let page: Page | null = null;

    try {
      logger.info({
        unidade,
        companyId,
        checkin,
        checkout,
        adults,
        children,
        url,
      }, 'HBook Scraper: Starting availability check');

      const browser = await this.getBrowser();
      page = await browser.newPage();

      // Configurar user agent e viewport
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // Navegar para a página
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Aguardar carregamento dos quartos (Knockout.js)
      // O HBook usa data-bind="foreach: AvailableRooms" para renderizar os quartos
      await page.waitForSelector('[data-bind*="AvailableRooms"], .room-item, .room-card, .accommodation-item', {
        timeout: 15000,
      }).catch(() => {
        // Se não encontrar o seletor específico, continua mesmo assim
        logger.warn('HBook Scraper: Room selector not found, will try to extract data anyway');
      });

      // Aguardar um pouco mais para o JavaScript carregar
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extrair dados dos quartos usando Knockout.js ViewModel
      // O código dentro de evaluate() roda no contexto do browser (não no Node)
      const rooms: AvailableRoom[] = await page.evaluate(() => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const extractedRooms: any[] = [];

        // Tentar acessar o ViewModel do Knockout.js
        try {
          // @ts-expect-error - window existe no contexto do browser (page.evaluate)
          const ko = (window as any).ko;
          if (ko) {
            // @ts-expect-error - document existe no contexto do browser (page.evaluate)
            const body = (document as any).body;
            const viewModel = ko.dataFor(body);

            if (viewModel && typeof viewModel.AvailableRooms === 'function') {
              const availableRooms = viewModel.AvailableRooms();

              if (Array.isArray(availableRooms)) {
                availableRooms.forEach((room: any, index: number) => {
                  // Extrair preço - pode ser número direto ou objeto com TotalValue
                  let price = 0;
                  if (typeof room.TotalValue === 'number') {
                    price = room.TotalValue;
                  } else if (typeof room.BestPrice === 'number') {
                    price = room.BestPrice;
                  } else if (room.Price && typeof room.Price === 'object') {
                    price = room.Price.TotalValue || room.Price.FullTotalValue || 0;
                  } else if (typeof room.Price === 'number') {
                    price = room.Price;
                  }

                  extractedRooms.push({
                    id: room.RoomTypeId || room.Id || `room-${index}`,
                    name: room.RoomTypeName || room.Name || `Quarto ${index + 1}`,
                    description: room.Description || room.RoomTypeDescription || '',
                    price,
                    originalPrice: room.OriginalPrice || undefined,
                    available: price > 0, // Disponível apenas se tiver preço > 0
                    maxAdults: room.MaxAdults || room.MaxOccupancy || undefined,
                    maxChildren: room.MaxChildren || undefined,
                    amenities: room.Amenities || [],
                    imageUrl: room.ImageUrl || room.MainImage || undefined,
                  });
                });
              }
            }
          }
        } catch (e) {
          console.error('Error accessing Knockout ViewModel:', e);
        }

        // Fallback: tentar extrair do DOM se não conseguiu pelo ViewModel
        if (extractedRooms.length === 0) {
          // @ts-expect-error - document existe no contexto do browser (page.evaluate)
          const roomElements = (document as any).querySelectorAll('.room-item, .room-card, .accommodation-item, [data-room-id], .room-type');

          roomElements.forEach((el: any, index: number) => {
            const nameEl = el.querySelector('.room-name, .room-title, h3, h4, .title');
            const priceEl = el.querySelector('.room-price, .price, .total-value');
            const imgEl = el.querySelector('img');

            if (nameEl) {
              extractedRooms.push({
                id: el.getAttribute('data-room-id') || `dom-room-${index}`,
                name: nameEl.textContent?.trim() || `Quarto ${index + 1}`,
                price: priceEl ? parseFloat(priceEl.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || '0') : undefined,
                available: true,
                imageUrl: imgEl?.src || undefined,
              });
            }
          });
        }
        /* eslint-enable @typescript-eslint/no-explicit-any */

        return extractedRooms;
      });

      // Filtrar apenas quartos com preço > 0 (disponíveis)
      const availableRoomsFiltered = rooms.filter(r => r.price && r.price > 0);

      logger.info({
        unidade,
        companyId,
        roomsFound: rooms.length,
        roomsAvailable: availableRoomsFiltered.length,
      }, 'HBook Scraper: Availability check completed');

      return {
        success: true,
        companyId,
        unidade,
        checkin,
        checkout,
        adults,
        children,
        childrenAges,
        rooms: availableRoomsFiltered,
        scrapedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error({
        unidade,
        companyId,
        error: error.message,
      }, 'HBook Scraper: Failed to check availability');

      return {
        success: false,
        companyId: companyId || '',
        unidade,
        checkin,
        checkout,
        adults,
        children,
        childrenAges,
        rooms: [],
        scrapedAt: new Date().toISOString(),
        error: error.message,
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Verifica se um quarto específico está disponível
   */
  async isRoomAvailable(
    unidade: string,
    roomName: string,
    checkin: string,
    checkout: string,
    adults: number,
    children?: number,
    childrenAges?: number[]
  ): Promise<{ available: boolean; room?: AvailableRoom; error?: string }> {
    const result = await this.checkAvailability(
      unidade,
      checkin,
      checkout,
      adults,
      children,
      childrenAges
    );

    if (!result.success) {
      return { available: false, error: result.error };
    }

    // Normalizar nome do quarto para comparação
    const normalizedRoomName = roomName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    // Buscar quarto pelo nome (comparação parcial)
    const room = result.rooms.find(r => {
      const normalizedName = r.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

      return normalizedName.includes(normalizedRoomName) || normalizedRoomName.includes(normalizedName);
    });

    return {
      available: !!room,
      room,
    };
  }
}

export const hbookScraperService = new HBookScraperService();
