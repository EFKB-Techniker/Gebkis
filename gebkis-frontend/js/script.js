/**
 * Geburtstagsliste – Anzeige wochenweise oder (im Debug-Modus) für ein ganzes Jahr.
 *
 * URL-Schema:
 *   /aktuelle_woche_sN.html   Aktuelle Woche, Seite N
 *   /vorherige_woche_sN.html  Vorherige Woche, Seite N
 *   /?debug                   Debug-Modus, aktuelles Jahr
 *   /?debug=2025              Debug-Modus, spezifisches Jahr
 *   /?debug=2025&page=2       Debug-Modus mit Seite
 *
 * Tastatur:
 *   j / ←   eine Seite zurück (wechselt Woche, wenn am Anfang)
 *   l / →   eine Seite vorwärts (wechselt Woche, wenn am Ende)
 *   k       zurück zur aktuellen Woche
 */
(() => {
    'use strict';

    // ============================================================
    // KONFIGURATION
    // ============================================================
    const CONFIG = Object.freeze({
        // Zukünftiges Bildnamensschema: "DD-MMM-YY - Vorname, Nachname.jpg"
        // Beispiele:  12-Jan-93 - Max, Mustermann.jpg
        //             01-Mrz-12 - Tim, Vogel.jpg
        // Sobald die Bilder umbenannt sind, hier auf true setzen.
        USE_NEW_IMAGE_NAMING: true,

        ITEMS_PER_PAGE: 6,               // Wochenansicht: 3x2 Grid pro Seite
        ITEMS_PER_PAGE_DEBUG: Infinity,  // Debug: alles auf einer Seite; auf Zahl setzen für Pagination

        EXCEL_DIR: 'excel/',
        IMAGE_DIR: 'images/',
        FALLBACK_IMAGE: 'images/keinfoto.png',

        DEFAULT_PATH: '/aktuelle_woche_s1.html',

        MONTHS_DE: [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
        ],

        MONTHS_DE_SHORT: [
            'Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun',
            'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
        ],

        UMLAUT_MAP: {
            'ä': 'ae', 'ö': 'oe', 'ü': 'ue',
            'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue',
            'ß': 'ss',
        },

        // Transparentes 1x1-GIF als Platzhalter, vermeidet Layout-Shift beim Bild-Tausch.
        PLACEHOLDER_SRC: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    });

    // ============================================================
    // STATE
    // ============================================================
    const state = {
        birthdays: [],                              // alle geparsten Einträge
        weekOffset: 0,                              // 0 = aktuelle Woche
        page: 0,                                    // 0-basiert
        debugMode: false,
        debugYear: new Date().getFullYear(),
        imageCache: new Map(),                      // src -> Promise<resolvedSrc>
    };

    let elements = null;  // wird im Init befüllt

    // ============================================================
    // DATUM
    // ============================================================

    /** Parst DD.MM.YYYY, YYYY-MM-DD oder Excel-Seriennummern. */
    function parseDate(input) {
        if (input == null || input === '') return null;

        // Excel-Seriennummer (Number oder rein numerischer String)
        const asNum = typeof input === 'number' ? input : Number(input);
        if (Number.isFinite(asNum) && (typeof input === 'number' || /^\d+(\.\d+)?$/.test(String(input).trim()))) {
            // Excel-Epoch: 1899-12-30 (korrigiert um den fiktiven Schalttag 1900-02-29)
            const date = new Date(Date.UTC(1899, 11, 30));
            date.setUTCDate(date.getUTCDate() + Math.floor(asNum));
            date.setHours(12, 0, 0, 0);
            return Number.isNaN(date.getTime()) ? null : date;
        }

        const str = String(input).trim();
        let parts;
        if (str.includes('.')) parts = str.split('.');
        else if (str.includes('-')) parts = str.split('-').reverse();
        else return null;

        if (parts.length !== 3) return null;
        const [d, m, y] = parts.map(p => parseInt(p, 10));
        if (![d, m, y].every(Number.isFinite)) return null;

        const date = new Date(y, m - 1, d, 12, 0, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDateDE(date) {
        const pad = n => String(n).padStart(2, '0');
        return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
    }

    /** MM.DD.YY für altes Bildnamens-Schema. */
    function formatDateForImage(date) {
        const pad = n => String(n).padStart(2, '0');
        return `${pad(date.getMonth() + 1)}.${pad(date.getDate())}.${String(date.getFullYear()).slice(-2)}`;
    }

    /** DD-MMM-YY für neues Bildnamens-Schema (z.B. "12-Jan-93"). */
    function formatDateForImageNew(date) {
        const pad = n => String(n).padStart(2, '0');
        const month = CONFIG.MONTHS_DE_SHORT[date.getMonth()];
        return `${pad(date.getDate())}-${month}-${String(date.getFullYear()).slice(-2)}`;
    }

    /** Montag der Woche eines gegebenen Datums (ISO-konform). */
    function getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function getWeekRange(weekOffset) {
        const monday = getMonday(new Date());
        monday.setDate(monday.getDate() + weekOffset * 7);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return { monday, sunday };
    }

    /**
     * Prüft, ob ein Geburtstag (Tag/Monat) in einen Wochenbereich fällt.
     * Berücksichtigt Jahreswechsel, falls die Woche über zwei Jahre läuft.
     */
    function isInWeekRange(birthDate, monday, sunday) {
        const years = new Set([monday.getFullYear(), sunday.getFullYear()]);
        for (const year of years) {
            const candidate = new Date(year, birthDate.getMonth(), birthDate.getDate(), 12);
            if (candidate >= monday && candidate <= sunday) return true;
        }
        return false;
    }

    // ============================================================
    // STRINGS / BILDPFADE
    // ============================================================

    function convertUmlauts(str) {
        return str.replace(/[äöüÄÖÜß]/g, ch => CONFIG.UMLAUT_MAP[ch] || ch);
    }

    function getImageSrc(birthday) {
        const last = convertUmlauts(birthday.nachname);
        const first = convertUmlauts(birthday.vorname);
        if (CONFIG.USE_NEW_IMAGE_NAMING) {
            // Neu: DD-MMM-YY - Vorname, Nachname.jpg
            return `${CONFIG.IMAGE_DIR}${formatDateForImageNew(birthday.date)} - ${first}, ${last}.jpg`;
        }
        // Alt: MM.DD.YY - Nachname, Vorname.jpg
        return `${CONFIG.IMAGE_DIR}${formatDateForImage(birthday.date)} - ${last}, ${first}.jpg`;
    }

    // ============================================================
    // URL-HANDLING
    // ============================================================

    function parseURL() {
        const url = new URL(window.location.href);
        const debugParam = url.searchParams.get('debug');

        if (debugParam !== null) {
            state.debugMode = true;
            const year = parseInt(debugParam, 10);
            state.debugYear = Number.isFinite(year) ? year : new Date().getFullYear();
            const pageNum = parseInt(url.searchParams.get('page'), 10);
            state.page = Number.isFinite(pageNum) ? Math.max(0, pageNum - 1) : 0;
            return;
        }

        state.debugMode = false;
        const match = url.pathname.match(/(aktuelle|vorherige)_woche_s(\d+)\.html/);
        if (match) {
            state.weekOffset = match[1] === 'vorherige' ? -1 : 0;
            state.page = Math.max(0, parseInt(match[2], 10) - 1);
        } else {
            // Default-Pfad setzen ohne Reload
            window.history.replaceState({}, '', CONFIG.DEFAULT_PATH);
            state.weekOffset = 0;
            state.page = 0;
        }
    }

    function buildCurrentURL() {
        if (state.debugMode) {
            return `/?debug=${state.debugYear}${state.page > 0 ? `&page=${state.page + 1}` : ''}`;
        }
        const prefix = state.weekOffset < 0 ? 'vorherige' : 'aktuelle';
        return `/${prefix}_woche_s${state.page + 1}.html`;
    }

    function updateURL() {
        const newURL = buildCurrentURL();
        const current = window.location.pathname + window.location.search;
        if (current !== newURL) {
            window.history.pushState({}, '', newURL);
        }
    }

    // ============================================================
    // DATEN LADEN
    // ============================================================

    async function findExcelFile() {
        const res = await fetch(CONFIG.EXCEL_DIR);
        if (!res.ok) throw new Error(`Excel-Verzeichnis nicht erreichbar (HTTP ${res.status})`);
        const files = await res.json();
        const excel = files.find(f => /\.xlsx?$/i.test(f.name));
        if (!excel) throw new Error('Keine .xls/.xlsx-Datei im Verzeichnis gefunden');
        return excel.name;
    }

    async function loadBirthdays() {
        const filename = await findExcelFile();
        console.log('[birthdays] Lade', filename);

        const res = await fetch(`${CONFIG.EXCEL_DIR}${filename}`);
        if (!res.ok) throw new Error(`Excel-Datei nicht ladbar (HTTP ${res.status})`);

        const buffer = await res.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 'A', range: 1, raw: true });

        const parsed = [];
        for (const row of rows) {
            const vorname = String(row.B || '').trim();
            const nachname = String(row.C || '').trim();
            const date = parseDate(row.D);
            if (!vorname || !nachname || !date) continue;
            parsed.push({ vorname, nachname, date });
        }
        console.log(`[birthdays] ${parsed.length} Einträge geparst`);
        return parsed;
    }

    // ============================================================
    // FILTER / SORT
    // ============================================================

    function sortByDayOfYear(a, b) {
        if (a.date.getMonth() !== b.date.getMonth()) return a.date.getMonth() - b.date.getMonth();
        if (a.date.getDate() !== b.date.getDate()) return a.date.getDate() - b.date.getDate();
        return a.nachname.localeCompare(b.nachname, 'de');
    }

    function getVisibleBirthdays() {
        if (state.debugMode) {
            // Debug-Modus: das volle Jahr (Januar–Dezember), alle Personen,
            // sortiert nach Tag/Monat. KEINE Filterung nach heutigem Datum oder Woche.
            const sorted = [...state.birthdays].sort(sortByDayOfYear);
            if (sorted.length > 0) {
                const first = sorted[0];
                const last = sorted[sorted.length - 1];
                console.log(
                    `[birthdays] Debug: ${sorted.length} Einträge, ` +
                    `erster: ${formatDateDE(first.date)} (${first.vorname} ${first.nachname}), ` +
                    `letzter: ${formatDateDE(last.date)} (${last.vorname} ${last.nachname})`
                );
            }
            return sorted;
        }
        const { monday, sunday } = getWeekRange(state.weekOffset);
        return state.birthdays
            .filter(b => isInWeekRange(b.date, monday, sunday))
            .sort(sortByDayOfYear);
    }

    function getPageSize() {
        return state.debugMode ? CONFIG.ITEMS_PER_PAGE_DEBUG : CONFIG.ITEMS_PER_PAGE;
    }

    // ============================================================
    // BILDER (mit Cache)
    // ============================================================

    function loadImage(src) {
        const cached = state.imageCache.get(src);
        if (cached) return cached;

        const promise = new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(src);
            img.onerror = () => {
                console.info(`[birthdays] Fallback für ${src}`);
                resolve(CONFIG.FALLBACK_IMAGE);
            };
            img.src = src;
        });
        state.imageCache.set(src, promise);
        return promise;
    }

    // ============================================================
    // RENDERING
    // ============================================================

    function renderBirthdayItem(birthday) {
        const item = document.createElement('div');
        item.className = 'birthday-item';

        const img = document.createElement('img');
        img.src = CONFIG.PLACEHOLDER_SRC;
        img.alt = `${birthday.vorname} ${birthday.nachname}`;

        const name = document.createElement('p');
        name.className = 'name';
        name.textContent = `${birthday.vorname} ${birthday.nachname}`;

        const date = document.createElement('p');
        date.className = 'date';
        const day = String(birthday.date.getDate()).padStart(2, '0');
        date.textContent = `${day}. ${CONFIG.MONTHS_DE[birthday.date.getMonth()]}`;

        item.append(img, name, date);

        // Bild asynchron mit Cache laden
        loadImage(getImageSrc(birthday)).then(src => {
            // img bleibt im Speicher, auch wenn aus DOM entfernt – kein Bug, nur No-Op.
            img.src = src;
        });

        return item;
    }

    function buildTitle() {
        if (state.debugMode) {
            return `Alle Geburtstage – ${state.debugYear}`;
        }
        const { monday, sunday } = getWeekRange(state.weekOffset);
        return `Geburtstage vom ${formatDateDE(monday)} - ${formatDateDE(sunday)}`;
    }

    function render() {
        const visible = getVisibleBirthdays();
        const pageSize = getPageSize();
        const totalPages = Number.isFinite(pageSize)
            ? Math.max(1, Math.ceil(visible.length / pageSize))
            : 1;

        // Seite in gültigen Bereich clampen
        state.page = Math.min(Math.max(0, state.page), totalPages - 1);

        const pageItems = Number.isFinite(pageSize)
            ? visible.slice(state.page * pageSize, state.page * pageSize + pageSize)
            : visible;

        // Titel + Pagination-Anzeige
        elements.title.textContent = buildTitle();
        if (totalPages > 1) {
            elements.pagination.textContent = `Seite ${state.page + 1} von ${totalPages}`;
            elements.pagination.style.display = 'block';
        } else {
            elements.pagination.style.display = 'none';
        }

        // Liste neu aufbauen
        const grid = document.createElement('div');
        grid.className = 'birthday-grid';

        if (pageItems.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'no-birthdays';
            const p = document.createElement('p');
            p.textContent = state.debugMode
                ? `Keine Geburtstage für ${state.debugYear}`
                : 'Keine Geburtstage in dieser Woche';
            empty.appendChild(p);
            grid.appendChild(empty);
        } else {
            const frag = document.createDocumentFragment();
            for (const b of pageItems) frag.appendChild(renderBirthdayItem(b));
            grid.appendChild(frag);
        }

        elements.list.replaceChildren(grid);
        elements.list.scrollTop = 0;
        updateURL();
    }

    function renderError(err) {
        elements.title.textContent = 'Fehler beim Laden';
        const grid = document.createElement('div');
        grid.className = 'birthday-grid';
        grid.innerHTML = `
            <div class="no-birthdays">
                <p>Geburtstage konnten nicht geladen werden.</p>
                <p style="font-size: 0.7em; opacity: 0.7;">${err.message || err}</p>
            </div>`;
        elements.list.replaceChildren(grid);
        elements.pagination.style.display = 'none';
    }

    // ============================================================
    // NAVIGATION
    // ============================================================

    function navigatePage(delta) {
        const pageSize = getPageSize();
        const totalPages = Number.isFinite(pageSize)
            ? Math.max(1, Math.ceil(getVisibleBirthdays().length / pageSize))
            : 1;
        const newPage = state.page + delta;

        if (newPage < 0) {
            if (!state.debugMode) navigateWeek(-1, /* goToLastPage */ true);
            return;
        }
        if (newPage >= totalPages) {
            if (!state.debugMode) navigateWeek(1, /* goToLastPage */ false);
            return;
        }

        state.page = newPage;
        render();
    }

    function navigateWeek(delta, goToLastPage = false) {
        if (state.debugMode) return;
        state.weekOffset += delta;
        const pageSize = getPageSize();
        const totalPages = Number.isFinite(pageSize)
            ? Math.max(1, Math.ceil(getVisibleBirthdays().length / pageSize))
            : 1;
        state.page = goToLastPage ? totalPages - 1 : 0;
        render();
    }

    function navigateToCurrentWeek() {
        if (state.debugMode) return;
        state.weekOffset = 0;
        state.page = 0;
        render();
    }

    function handleKeyPress(event) {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        switch (event.key.toLowerCase()) {
            case 'j':
            case 'arrowleft':
                navigatePage(-1);
                event.preventDefault();
                break;
            case 'l':
            case 'arrowright':
                navigatePage(1);
                event.preventDefault();
                break;
            case 'k':
                navigateToCurrentWeek();
                event.preventDefault();
                break;
        }
    }

    // ============================================================
    // INIT
    // ============================================================

    async function init() {
        const app = document.getElementById('app');
        if (!app) {
            console.error('[birthdays] #app nicht gefunden');
            return;
        }

        const pagination = document.createElement('div');
        pagination.className = 'floating-pagination';
        pagination.style.display = 'none';
        document.body.appendChild(pagination);

        elements = {
            title: app.querySelector('.app-header h1'),
            list: document.getElementById('birthdayList'),
            pagination,
        };

        parseURL();

        try {
            state.birthdays = await loadBirthdays();
            render();
        } catch (err) {
            console.error('[birthdays] Init fehlgeschlagen:', err);
            renderError(err);
        }

        document.addEventListener('keydown', handleKeyPress);
        window.addEventListener('popstate', () => {
            parseURL();
            render();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
