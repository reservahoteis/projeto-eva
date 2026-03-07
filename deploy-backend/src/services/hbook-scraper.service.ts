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
  'SANTA': '59f07097c19a3b1a60c6d113',
};

/** Tempo de inatividade antes de fechar o Chromium (60s) */
const BROWSER_IDLE_TIMEOUT_MS = 60_000;

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
  unavailabilityReason?: string;
  scrapedAt: string;
  error?: string;
}

/**
 * Serviço de scraping do HBook para verificar disponibilidade de quartos
 */
class HBookScraperService {
  private browser: Browser | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private activePages = 0;

  /**
   * Obtém ou cria instância do browser.
   * Fecha automaticamente após BROWSER_IDLE_TIMEOUT_MS de inatividade.
   */
  private async getBrowser(): Promise<Browser> {
    this.clearIdleTimer();

    if (!this.browser || !this.browser.connected) {
      logger.info('HBook Scraper: Launching Chromium');
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

      // Lidar com browser fechando inesperadamente
      this.browser.on('disconnected', () => {
        logger.info('HBook Scraper: Chromium disconnected');
        this.browser = null;
        this.activePages = 0;
        this.clearIdleTimer();
      });
    }

    this.activePages++;
    return this.browser;
  }

  /**
   * Marca uma pagina como fechada e agenda idle timeout
   */
  private releasePage(): void {
    this.activePages = Math.max(0, this.activePages - 1);
    if (this.activePages === 0) {
      this.scheduleIdleClose();
    }
  }

  /**
   * Agenda fechamento do browser por inatividade
   */
  private scheduleIdleClose(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(async () => {
      if (this.activePages === 0 && this.browser) {
        logger.info('HBook Scraper: Closing Chromium (idle timeout)');
        await this.closeBrowser();
      }
    }, BROWSER_IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Fecha o browser
   */
  async closeBrowser(): Promise<void> {
    this.clearIdleTimer();
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Browser may already be closed
      }
      this.browser = null;
      this.activePages = 0;
    }
  }

  /**
   * Extrai mensagem de indisponibilidade da pagina do HBook.
   * Procura alertas, mensagens de restricao (ex: estadia minima) e textos de erro.
   */
  private async extractUnavailabilityReason(page: Page): Promise<string | undefined> {
    try {
      const reason = await page.evaluate(() => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const messages: string[] = [];

        // 1. Tentar via Knockout ViewModel (UnavailabilityMessage, ValidationMessage, etc.)
        try {
          // @ts-expect-error - window existe no contexto do browser (page.evaluate)
          const ko = (window as any).ko;
          if (ko) {
            // @ts-expect-error - document existe no contexto do browser (page.evaluate)
            const viewModel = ko.dataFor((document as any).body);
            if (viewModel) {
              const vmFields = [
                'UnavailabilityMessage', 'ValidationMessage', 'ErrorMessage',
                'NoAvailabilityMessage', 'Message', 'WarningMessage',
                'MinimumStayMessage', 'RestrictionMessage',
              ];
              for (const field of vmFields) {
                const val = typeof viewModel[field] === 'function'
                  ? viewModel[field]()
                  : viewModel[field];
                if (val && typeof val === 'string' && val.trim().length > 0) {
                  messages.push(val.trim());
                }
              }

              // Verificar MinimumStay / MinNights no ViewModel
              if (typeof viewModel.MinimumStay === 'function') {
                const minStay = viewModel.MinimumStay();
                if (minStay && Number(minStay) > 0) {
                  messages.push(`Estadia mínima de ${minStay} diária(s)`);
                }
              }
            }
          }
        } catch {
          // Knockout nao disponivel
        }

        // 2. Extrair do DOM - alertas, mensagens de erro, restricoes
        const selectors = [
          '.alert', '.alert-warning', '.alert-danger', '.alert-info',
          '.no-availability', '.no-rooms', '.unavailable-message',
          '.validation-message', '.error-message', '.warning-message',
          '.restriction-message', '.minimum-stay',
          '[data-bind*="Message"]', '[data-bind*="message"]',
          '[data-bind*="Unavailab"]', '[data-bind*="Warning"]',
          '[data-bind*="Validation"]', '[data-bind*="MinimumStay"]',
          '.booking-message', '.availability-message',
        ];

        for (const selector of selectors) {
          // @ts-expect-error - document existe no contexto do browser (page.evaluate)
          const elements = (document as any).querySelectorAll(selector);
          elements.forEach((el: any) => {
            const text = el.textContent?.trim();
            if (text && text.length > 5 && text.length < 500) {
              // Evitar duplicatas
              if (!messages.includes(text)) {
                messages.push(text);
              }
            }
          });
        }

        // 3. Procurar texto visivel que mencione restricoes comuns
        if (messages.length === 0) {
          // @ts-expect-error - document existe no contexto do browser (page.evaluate)
          const body = (document as any).body?.innerText || '';
          const patterns = [
            /estadia\s+m[ií]nima\s+de\s+\d+\s+di[aá]ria/i,
            /m[ií]nimo\s+de\s+\d+\s+noite/i,
            /n[aã]o\s+h[aá]\s+disponibilidade/i,
            /indispon[ií]vel\s+para\s+as?\s+data/i,
            /per[ií]odo\s+m[ií]nimo/i,
            /check-?in\s+n[aã]o\s+dispon[ií]vel/i,
            /sem\s+disponibilidade/i,
            /closed|fechado/i,
          ];
          for (const pattern of patterns) {
            const match = body.match(pattern);
            if (match) {
              // Pegar contexto ao redor do match (ate 150 chars)
              const idx = body.indexOf(match[0]);
              const start = Math.max(0, idx - 20);
              const end = Math.min(body.length, idx + match[0].length + 80);
              const context = body.substring(start, end).trim();
              messages.push(context);
              break;
            }
          }
        }
        /* eslint-enable @typescript-eslint/no-explicit-any */

        return messages.length > 0 ? messages.join(' | ') : null;
      });

      return reason || undefined;
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : 'Unknown' },
        'HBook Scraper: Failed to extract unavailability reason'
      );
      return undefined;
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
                  extractedRooms.push({
                    id: room.RoomTypeId || room.Id || `room-${index}`,
                    name: room.RoomTypeName || room.Name || `Quarto ${index + 1}`,
                    description: room.Description || room.RoomTypeDescription || '',
                    price: room.TotalValue || room.BestPrice || room.Price || 0,
                    originalPrice: room.OriginalPrice || undefined,
                    available: true,
                    maxAdults: room.MaxAdults || room.MaxOccupancy || undefined,
                    maxChildren: room.MaxChildren || undefined,
                    amenities: room.Amenities || [],
                    imageUrl: room.ImageUrl || room.MainImage || undefined,
                  });
                });
              }
            }
          }
        } catch {
          // ViewModel not available, fallback to DOM extraction
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

      // Se nao encontrou quartos, fazer rescraping para capturar motivo de indisponibilidade
      let unavailabilityReason: string | undefined;
      if (rooms.length === 0 && page) {
        unavailabilityReason = await this.extractUnavailabilityReason(page);
        if (unavailabilityReason) {
          logger.info({ unidade, unavailabilityReason }, 'HBook Scraper: Unavailability reason found');
        }
      }

      logger.info({
        unidade,
        companyId,
        roomsFound: rooms.length,
        unavailabilityReason,
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
        rooms,
        unavailabilityReason,
        scrapedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        unidade,
        companyId,
        error: errorMessage,
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
        error: errorMessage,
      };
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
      this.releasePage();
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
