"""HBook scraper service — check room availability via headless browser.

Equivalent of deploy-backend/src/services/hbook-scraper.service.ts.
Uses Playwright (async) instead of Puppeteer. Playwright is actively
maintained and has first-class Python async support.

Browser lifecycle:
  - A single Chromium instance is shared across requests.
  - After the last active page closes, the browser is shut down after
    60 seconds of inactivity to free RAM.
  - If the browser disconnects unexpectedly, a new one is launched on
    the next request.

Install: ``pip install playwright && playwright install chromium``
"""

from __future__ import annotations

import asyncio
import re
import unicodedata
from datetime import UTC, datetime
from typing import Any

import structlog

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Company ID mapping (same as TypeScript)
# ---------------------------------------------------------------------------

COMPANY_IDS: dict[str, str] = {
    "CAMPOS": "67bcbe2ca5788fa175aa8b38",
    "CAMPOS DO JORDAO": "67bcbe2ca5788fa175aa8b38",
    "ILHABELA": "5f15f591ab41d43ac0fed67e",
    "CAMBURI": "6750b19f496b9fcb0e105ccb",
    "SANTO ANTONIO": "662ff573ca37a716229fe257",
    "SANTO ANTONIO DO PINHAL": "662ff573ca37a716229fe257",
    "SANTA": "59f07097c19a3b1a60c6d113",
}

BROWSER_IDLE_TIMEOUT_S = 60  # seconds


# ---------------------------------------------------------------------------
# Result types (plain dicts — no ORM dependency)
# ---------------------------------------------------------------------------

def _strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


# ---------------------------------------------------------------------------
# Service class
# ---------------------------------------------------------------------------


class HBookScraperService:
    """Headless-browser scraper for the HBook booking engine."""

    def __init__(self) -> None:
        self._browser: Any = None  # playwright Browser instance
        self._playwright: Any = None
        self._active_pages = 0
        self._idle_task: asyncio.Task | None = None
        self._lock = asyncio.Lock()

    # -- Browser lifecycle --------------------------------------------------

    async def _get_browser(self) -> Any:
        """Return (or launch) the shared Chromium browser."""
        self._cancel_idle()

        async with self._lock:
            if self._browser is None or not self._browser.is_connected():
                try:
                    from playwright.async_api import async_playwright
                except ImportError as exc:
                    raise RuntimeError(
                        "playwright is not installed. "
                        "Run: pip install playwright && playwright install chromium"
                    ) from exc

                logger.info("HBook Scraper: Launching Chromium")
                self._playwright = await async_playwright().start()
                self._browser = await self._playwright.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-accelerated-2d-canvas",
                        "--disable-gpu",
                        "--single-process",
                    ],
                )
                self._browser.on(
                    "disconnected",
                    lambda: self._on_disconnect(),
                )

            self._active_pages += 1
        return self._browser

    def _on_disconnect(self) -> None:
        logger.info("HBook Scraper: Chromium disconnected")
        self._browser = None
        self._active_pages = 0
        self._cancel_idle()

    def _release_page(self) -> None:
        self._active_pages = max(0, self._active_pages - 1)
        if self._active_pages == 0:
            self._schedule_idle_close()

    def _schedule_idle_close(self) -> None:
        self._cancel_idle()
        self._idle_task = asyncio.create_task(self._idle_close())

    async def _idle_close(self) -> None:
        await asyncio.sleep(BROWSER_IDLE_TIMEOUT_S)
        if self._active_pages == 0 and self._browser:
            logger.info("HBook Scraper: Closing Chromium (idle timeout)")
            await self.close_browser()

    def _cancel_idle(self) -> None:
        if self._idle_task and not self._idle_task.done():
            self._idle_task.cancel()
            self._idle_task = None

    async def close_browser(self) -> None:
        self._cancel_idle()
        if self._browser:
            try:
                await self._browser.close()
            except Exception:
                pass
            self._browser = None
            self._active_pages = 0
        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception:
                pass
            self._playwright = None

    # -- Company ID ---------------------------------------------------------

    @staticmethod
    def get_company_id(unidade: str) -> str | None:
        key = _strip_accents(unidade.upper().strip())
        return COMPANY_IDS.get(key)

    # -- URL builder --------------------------------------------------------

    @staticmethod
    def build_url(
        company_id: str,
        checkin: str,
        checkout: str,
        adults: int,
        children: int | None = None,
        children_ages: list[int] | None = None,
    ) -> str:
        from urllib.parse import quote
        url = f"https://hbook.hsystem.com.br/Booking?companyId={company_id}"
        url += f"&checkin={quote(checkin)}"
        url += f"&checkout={quote(checkout)}"
        url += f"&adults={adults}"
        if children and children > 0:
            url += f"&children={children}"
            if children_ages:
                for age in children_ages:
                    url += f"&childrenage={age}"
        return url

    # -- Unavailability reason extraction -----------------------------------

    async def _extract_unavailability_reason(self, page: Any) -> str | None:
        """Extract unavailability message from the HBook page.

        Uses 3 strategies (same as TypeScript version):
        1. Knockout ViewModel fields
        2. DOM selectors for alert/error elements
        3. Regex body text patterns
        """
        try:
            reason = await page.evaluate("""() => {
                const messages = [];

                // 1. Knockout ViewModel
                try {
                    const ko = window.ko;
                    if (ko) {
                        const viewModel = ko.dataFor(document.body);
                        if (viewModel) {
                            const fields = [
                                'UnavailabilityMessage', 'ValidationMessage', 'ErrorMessage',
                                'NoAvailabilityMessage', 'Message', 'WarningMessage',
                                'MinimumStayMessage', 'RestrictionMessage',
                            ];
                            for (const field of fields) {
                                const val = typeof viewModel[field] === 'function'
                                    ? viewModel[field]()
                                    : viewModel[field];
                                if (val && typeof val === 'string' && val.trim().length > 0) {
                                    messages.push(val.trim());
                                }
                            }
                            if (typeof viewModel.MinimumStay === 'function') {
                                const minStay = viewModel.MinimumStay();
                                if (minStay && Number(minStay) > 0) {
                                    messages.push('Estadia minima de ' + minStay + ' diaria(s)');
                                }
                            }
                        }
                    }
                } catch (e) {}

                // 2. DOM selectors
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
                for (const sel of selectors) {
                    const els = document.querySelectorAll(sel);
                    els.forEach(el => {
                        const text = el.textContent?.trim();
                        if (text && text.length > 5 && text.length < 500 && !messages.includes(text)) {
                            messages.push(text);
                        }
                    });
                }

                // 3. Regex body text
                if (messages.length === 0) {
                    const body = document.body?.innerText || '';
                    const patterns = [
                        /estadia\\s+m[ií]nima\\s+de\\s+\\d+\\s+di[aá]ria/i,
                        /m[ií]nimo\\s+de\\s+\\d+\\s+noite/i,
                        /n[aã]o\\s+h[aá]\\s+disponibilidade/i,
                        /indispon[ií]vel\\s+para\\s+as?\\s+data/i,
                        /per[ií]odo\\s+m[ií]nimo/i,
                        /check-?in\\s+n[aã]o\\s+dispon[ií]vel/i,
                        /sem\\s+disponibilidade/i,
                        /closed|fechado/i,
                    ];
                    for (const pattern of patterns) {
                        const match = body.match(pattern);
                        if (match) {
                            const idx = body.indexOf(match[0]);
                            const start = Math.max(0, idx - 20);
                            const end = Math.min(body.length, idx + match[0].length + 80);
                            messages.push(body.substring(start, end).trim());
                            break;
                        }
                    }
                }

                return messages.length > 0 ? messages.join(' | ') : null;
            }""")
            return reason or None
        except Exception as exc:
            logger.warning(
                "HBook Scraper: Failed to extract unavailability reason",
                error=str(exc),
            )
            return None

    # -- Main: check availability -------------------------------------------

    async def check_availability(
        self,
        unidade: str,
        checkin: str,
        checkout: str,
        adults: int,
        children: int | None = None,
        children_ages: list[int] | None = None,
    ) -> dict:
        """Check room availability on HBook.

        Returns a dict matching the AvailabilityResult TypeScript interface.
        """
        company_id = self.get_company_id(unidade)

        if not company_id:
            valid = ", ".join(sorted(COMPANY_IDS.keys()))
            return {
                "success": False,
                "companyId": "",
                "unidade": unidade,
                "checkin": checkin,
                "checkout": checkout,
                "adults": adults,
                "children": children,
                "childrenAges": children_ages,
                "rooms": [],
                "scrapedAt": datetime.now(tz=UTC).isoformat(),
                "error": f'Unidade "{unidade}" nao encontrada. Unidades validas: {valid}',
            }

        url = self.build_url(company_id, checkin, checkout, adults, children, children_ages)
        page = None

        try:
            logger.info(
                "HBook Scraper: Starting availability check",
                unidade=unidade,
                company_id=company_id,
                checkin=checkin,
                checkout=checkout,
                adults=adults,
                children=children,
            )

            browser = await self._get_browser()
            page = await browser.new_page()

            await page.set_extra_http_headers({
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
            })
            await page.set_viewport_size({"width": 1920, "height": 1080})

            await page.goto(url, wait_until="networkidle", timeout=30000)

            # Wait for rooms to render (Knockout.js)
            try:
                await page.wait_for_selector(
                    '[data-bind*="AvailableRooms"], .room-item, .room-card, .accommodation-item',
                    timeout=15000,
                )
            except Exception:
                logger.warning("HBook Scraper: Room selector not found, trying extraction anyway")

            # Extra wait for JavaScript rendering
            await asyncio.sleep(3)

            # Extract room data from Knockout ViewModel or DOM
            rooms: list[dict] = await page.evaluate("""() => {
                const extractedRooms = [];

                // 1. Knockout ViewModel
                try {
                    const ko = window.ko;
                    if (ko) {
                        const viewModel = ko.dataFor(document.body);
                        if (viewModel && typeof viewModel.AvailableRooms === 'function') {
                            const availableRooms = viewModel.AvailableRooms();
                            if (Array.isArray(availableRooms)) {
                                availableRooms.forEach((room, index) => {
                                    extractedRooms.push({
                                        id: room.RoomTypeId || room.Id || 'room-' + index,
                                        name: room.RoomTypeName || room.Name || 'Quarto ' + (index + 1),
                                        description: room.Description || room.RoomTypeDescription || '',
                                        price: room.TotalValue || room.BestPrice || room.Price || 0,
                                        originalPrice: room.OriginalPrice || null,
                                        available: true,
                                        maxAdults: room.MaxAdults || room.MaxOccupancy || null,
                                        maxChildren: room.MaxChildren || null,
                                        amenities: room.Amenities || [],
                                        imageUrl: room.ImageUrl || room.MainImage || null,
                                    });
                                });
                            }
                        }
                    }
                } catch (e) {}

                // 2. DOM fallback
                if (extractedRooms.length === 0) {
                    const roomElements = document.querySelectorAll(
                        '.room-item, .room-card, .accommodation-item, [data-room-id], .room-type'
                    );
                    roomElements.forEach((el, index) => {
                        const nameEl = el.querySelector('.room-name, .room-title, h3, h4, .title');
                        const priceEl = el.querySelector('.room-price, .price, .total-value');
                        const imgEl = el.querySelector('img');

                        if (nameEl) {
                            extractedRooms.push({
                                id: el.getAttribute('data-room-id') || 'dom-room-' + index,
                                name: nameEl.textContent?.trim() || 'Quarto ' + (index + 1),
                                price: priceEl
                                    ? parseFloat(priceEl.textContent?.replace(/[^\\d,]/g, '').replace(',', '.') || '0')
                                    : null,
                                available: true,
                                imageUrl: imgEl?.src || null,
                            });
                        }
                    });
                }

                return extractedRooms;
            }""")

            # If no rooms found, extract unavailability reason
            unavailability_reason: str | None = None
            if not rooms and page:
                unavailability_reason = await self._extract_unavailability_reason(page)
                if unavailability_reason:
                    logger.info(
                        "HBook Scraper: Unavailability reason found",
                        unidade=unidade,
                        unavailability_reason=unavailability_reason,
                    )

            logger.info(
                "HBook Scraper: Availability check completed",
                unidade=unidade,
                company_id=company_id,
                rooms_found=len(rooms),
                unavailability_reason=unavailability_reason,
            )

            return {
                "success": True,
                "companyId": company_id,
                "unidade": unidade,
                "checkin": checkin,
                "checkout": checkout,
                "adults": adults,
                "children": children,
                "childrenAges": children_ages,
                "rooms": rooms,
                "unavailabilityReason": unavailability_reason,
                "scrapedAt": datetime.now(tz=UTC).isoformat(),
            }

        except Exception as exc:
            logger.error(
                "HBook Scraper: Failed to check availability",
                unidade=unidade,
                company_id=company_id,
                error=str(exc),
            )
            return {
                "success": False,
                "companyId": company_id or "",
                "unidade": unidade,
                "checkin": checkin,
                "checkout": checkout,
                "adults": adults,
                "children": children,
                "childrenAges": children_ages,
                "rooms": [],
                "scrapedAt": datetime.now(tz=UTC).isoformat(),
                "error": str(exc),
            }
        finally:
            if page:
                try:
                    await page.close()
                except Exception:
                    pass
            self._release_page()

    # -- Convenience: check specific room -----------------------------------

    async def is_room_available(
        self,
        unidade: str,
        room_name: str,
        checkin: str,
        checkout: str,
        adults: int,
        children: int | None = None,
        children_ages: list[int] | None = None,
    ) -> dict:
        """Check if a specific room type is available.

        Returns ``{"available": bool, "room": dict|None, "error": str|None}``.
        """
        result = await self.check_availability(
            unidade, checkin, checkout, adults, children, children_ages,
        )

        if not result["success"]:
            return {"available": False, "room": None, "error": result.get("error")}

        normalized_target = _strip_accents(room_name.lower().strip())

        for room in result["rooms"]:
            normalized_name = _strip_accents(room.get("name", "").lower().strip())
            if normalized_target in normalized_name or normalized_name in normalized_target:
                return {"available": True, "room": room, "error": None}

        return {"available": False, "room": None, "error": None}


# Singleton
hbook_scraper_service = HBookScraperService()
