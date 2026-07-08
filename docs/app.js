    'use strict';

    // ── Config ────────────────────────────────────────────────────────
    const APP_VERSION = '1.3.13';
    console.log(`Baila Más! Countdown v${APP_VERSION}`);

    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQGnVKh-BKFCTuU9UHRASZDny68TRoqWZeoLSXRJh5Nq759A0lUpk4UD3dK4idAL3n4fCQaNTpCFjZA/pub?gid=0&single=true&output=csv';
    const CACHE_TTL = 15_000; // ms

    // ── In-memory cache ───────────────────────────────────────────────
    const cache = { data: null, ts: 0 };
    let allActiveClasses = []; // Cache list of parsed, active classes for filtering
    let invalidDateClasses = []; // IDs de clases con fecha inválida — mostrados en "Houston"

    async function fetchClasses() {
      const now = Date.now();
      if (cache.data && (now - cache.ts) < CACHE_TTL) return cache.data;
      const bustUrl = SHEET_URL + (SHEET_URL.includes('?') ? '&' : '?') + '_t=' + Date.now();
      const res = await fetch(bustUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      cache.data = parseCSV(text);
      cache.ts = Date.now();
      updateTimestamp();
      return cache.data;
    }

    // ── CSV Parser (RFC 4180) ─────────────────────────────────────────
    // Handles quoted fields containing commas, newlines, and escaped
    // quotes (doubled double-quotes: ""). This is required because
    // Google Sheets wraps fields with commas (e.g. Google Maps URLs)
    // in double quotes when exporting CSV.
    function parseCSVLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];

        if (inQuotes) {
          if (ch === '"') {
            if (i + 1 < line.length && line[i + 1] === '"') {
              current += '"';       // escaped quote → literal "
              i++;                 // skip the second quote
            } else {
              inQuotes = false;    // end of quoted field
            }
          } else {
            current += ch;
          }
        } else {
          if (ch === '"') {
            inQuotes = true;       // start of quoted field
          } else if (ch === ',') {
            result.push(current);
            current = '';
          } else {
            current += ch;
          }
        }
      }

      result.push(current);        // last field
      return result;
    }

    function parseCSV(text) {
      const lines = text.trim().split(/\r?\n/);
      const headers = parseCSVLine(lines[0]).map(h => h.trim());
      return lines.slice(1)
        .filter(l => l.trim())
        .map(line => {
          const values = parseCSVLine(line);
          return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]));
        });
    }

    // ── Date helpers ──────────────────────────────────────────────────
    // Maps Spanish month names to 0-based month index.
    const MONTH_MAP = {
      enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
      julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
    };

    // Maps Spanish weekday names to JS getDay() values (0 = Sunday).
    const WEEKDAY_MAP = {
      domingo: 0, lunes: 1, martes: 2, miércoles: 3, miercoles: 3,
      jueves: 4, viernes: 5, sábado: 6, sabado: 6
    };

    // Builds a Date from the new CSV columns: Anio, Mes, Dia, SemanaMes, Horario.
    // SemanaMes = 1 → first occurrence of that weekday in the month, etc.
    // All times are anchored to Argentina time (UTC-3, no DST).
    function buildDateFromRow(row) {
      const year      = parseInt(row.Anio, 10);
      const monthIdx  = MONTH_MAP[(row.Mes || '').toLowerCase().trim()];
      const targetDay = WEEKDAY_MAP[(row.Dia || '').toLowerCase().trim()];
      const week      = parseInt(row.SemanaMes, 10); // 1-based
      const [hh = '0', mm = '0'] = (row.Horario || '00:00').split(':');

      if (isNaN(year) || monthIdx === undefined || targetDay === undefined || isNaN(week)) {
        console.warn('[buildDateFromRow] ERROR: campos inválidos', { Id: row.Id, Clase: row.Clase, Anio: row.Anio, Mes: row.Mes, Dia: row.Dia, SemanaMes: row.SemanaMes, Horario: row.Horario });
        return new Date(NaN);
      }

      // Find the first day of the month, then walk forward to the target weekday.
      const firstOfMonth = new Date(Date.UTC(year, monthIdx, 1));
      const firstDow     = firstOfMonth.getUTCDay(); // 0–6
      let diff = targetDay - firstDow;
      if (diff < 0) diff += 7;
      // diff is now the date of the 1st occurrence (0-based day offset).
      const dayOfMonth = 1 + diff + (week - 1) * 7;

      // Build ISO string in Argentina offset so Date parses it correctly.
      const pad  = n => String(n).padStart(2, '0');
      const iso  = `${year}-${pad(monthIdx + 1)}-${pad(dayOfMonth)}T${pad(parseInt(hh, 10))}:${pad(parseInt(mm, 10))}:00-03:00`;
      const date = new Date(iso);

      if (isNaN(date.getTime())) {
        console.warn('[buildDateFromRow] ERROR: fecha inválida', { Id: row.Id, Clase: row.Clase, iso, dayOfMonth });
        return date;
      }

      console.log(`[buildDateFromRow] id=${row.Id} clase=${row.Clase} → ${date.toISOString()}`);
      return date;
    }

    // Returns true if `date` falls on today in Argentina time (UTC-3, no DST).
    // Using Intl.DateTimeFormat with America/Argentina/Buenos_Aires ensures the
    // comparison is correct regardless of the viewer's browser timezone.
    function isTodayAR(date) {
      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
      return fmt.format(date) === fmt.format(new Date());
    }


    // ── Filtering & sorting ───────────────────────────────────────────
    function getActiveClasses(rows) {
      const now = Date.now();
      invalidDateClasses = []; // reset antes de filtrar
      return rows
        .filter(r => {
          const activa = (r.Activa || '').toUpperCase().trim();
          if (activa !== 'SI') return false;
          const start = buildDateFromRow(r);
          if (isNaN(start.getTime())) {
            invalidDateClasses.push({ Id: r.Id, Clase: r.Clase, Anio: r.Anio, Mes: r.Mes, Dia: r.Dia, SemanaMes: r.SemanaMes, Horario: r.Horario });
            return false;
          }
          const dur = Math.max(parseInt(r.Duracion, 10) || 60, 0);
          const end = start.getTime() + dur * 60_000;
          return now <= end; // keep pending + live; discard expired
        })
        .sort((a, b) => buildDateFromRow(a) - buildDateFromRow(b));
    }

    // ── Countdown formatter ───────────────────────────────────────────
    function formatCountdown(ms) {
      const total = Math.max(0, Math.floor(ms / 1000));
      const d = Math.floor(total / 86400);
      const h = Math.floor((total % 86400) / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const pad = n => String(n).padStart(2, '0');
      return { d: pad(d), h: pad(h), m: pad(m), s: pad(s) };
    }

    // ── Sanitización (XSS-safe) ─────────────────────────────────────────
    // Los datos vienen de un Google Sheet editable por humanos: nunca hay
    // que confiar en ellos como si fueran HTML de confianza.

    // Escapa texto libre antes de insertarlo con innerHTML.
    // Truco: asignamos a textContent y leemos innerHTML — el propio
    // navegador convierte < > & " ' en sus entidades HTML.
    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str ?? '';
      return div.innerHTML;
    }

    // Valida que un link sea realmente http(s) antes de usarlo en href.
    // Devuelve null si es inválido o peligroso (ej: "javascript:...").
    function safeUrl(url) {
      if (!url) return null;
      try {
        const u = new URL(url);
        return ['http:', 'https:'].includes(u.protocol) ? u.href : null;
      } catch {
        return null;
      }
    }

    // ── Card factory ──────────────────────────────────────────────────
    let _cardIndex = 0;
    let activeCards = []; // { el, start, end, $d, $h, $m, $s } — usado por el tick global

    function createCard(cls) {
      const idx   = _cardIndex++;
      const type    = (cls.Clase || '').toLowerCase(); // 'salsa' | 'bachata'
      const start   = buildDateFromRow(cls);

      // Guard: if date is invalid, skip this card instead of crashing.
      if (isNaN(start.getTime())) {
        console.error('[createCard] Skipping card with invalid date', { Id: cls.Id, Clase: cls.Clase, Anio: cls.Anio, Mes: cls.Mes, Dia: cls.Dia, SemanaMes: cls.SemanaMes, Horario: cls.Horario });
        return null;
      }
      const isToday = isTodayAR(start);
      const dur     = Math.max(parseInt(cls.Duracion, 10) || 60, 0);
      const end   = new Date(start.getTime() + dur * 60_000);

      // Display labels — forced to Argentina timezone so users outside AR
      // always see the actual class time, not their local time.
      const dateLabel = start.toLocaleDateString('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long',
        timeZone: 'America/Argentina/Buenos_Aires'
      });
      const timeLabel = start.toLocaleTimeString('es-AR', {
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires'
      });

      // Textos que vienen del Sheet: SIEMPRE escapados antes de ir a innerHTML
      const claseTxt = escapeHtml(cls.Clase || 'Clase');
      const descTxt  = escapeHtml(cls.Descripcion || '');
      const diaTxt   = cls.Dia ? escapeHtml(cls.Dia) : '';
      const link     = safeUrl(cls.Link);

      // Build card DOM
      const card = document.createElement('div');
      card.className = `card ${type}${isToday ? ' today' : ''}`;

      card.innerHTML = `
        ${isToday ? '<div class="badge-today-full">HOY</div>' : ''}
        <div class="badge">${claseTxt}</div>
        ${diaTxt ? `<span class="badge-weekday">${diaTxt}</span>` : ''}
        <div class="card-date">${dateLabel} · ${timeLabel} · ${dur}&thinsp;min</div>
        <div class="card-title">${claseTxt}</div>
        <div class="card-desc">${descTxt}</div>

        <div class="live-banner">
          <span class="dot"></span>
          ¡Clase ahora! &nbsp;Entrá ya
        </div>

        <div class="countdown">
          <div class="cd-block"><div class="cd-value" id="d${idx}">--</div><div class="cd-label">Días</div></div>
          <div class="cd-block"><div class="cd-value" id="h${idx}">--</div><div class="cd-label">Horas</div></div>
          <div class="cd-block"><div class="cd-value" id="m${idx}">--</div><div class="cd-label">Min</div></div>
          <div class="cd-block"><div class="cd-value" id="s${idx}">--</div><div class="cd-label">Seg</div></div>
        </div>

        ${link
          ? `<a class="card-link" href="${link}" target="_blank" rel="noopener noreferrer">Unirse a la clase →</a>`
          : `<span class="card-link no-link">Sin enlace disponible</span>`
        }
      `;

      // Registramos la card en el array global: el tick único de la página
      // (ver tickAll más abajo) es quien la va a actualizar cada segundo.
      activeCards.push({
        el: card,
        start: start.getTime(),
        end: end.getTime(),
        $d: card.querySelector(`#d${idx}`),
        $h: card.querySelector(`#h${idx}`),
        $m: card.querySelector(`#m${idx}`),
        $s: card.querySelector(`#s${idx}`),
      });

      return card;
    }

    // ── Tick global ─────────────────────────────────────────────────────
    // Antes: un setInterval por card (N clases activas = N timers en paralelo).
    // Ahora: un único setInterval recorre activeCards y actualiza todo junto.
    // Más liviano y más fácil de razonar si el catálogo de clases crece.
    function tickAll() {
      const now = Date.now();

      activeCards = activeCards.filter(c => {
        if (now > c.end) {
          // Expirada → fade out y remove del DOM
          c.el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
          c.el.style.opacity = '0';
          c.el.style.transform = 'scale(0.96)';
          setTimeout(() => c.el.remove(), 520);
          return false; // sale del array: deja de actualizarse
        }

        if (now >= c.start) {
          c.el.classList.add('live');
          return true;
        }

        c.el.classList.remove('live');
        const { d, h, m, s } = formatCountdown(c.start - now);
        c.$d.textContent = d;
        c.$h.textContent = h;
        c.$m.textContent = m;
        c.$s.textContent = s;
        return true;
      });
    }

    // Arranca una sola vez para toda la página (no uno por card)
    setInterval(tickAll, 1000);

    // ── Render ────────────────────────────────────────────────────────
    function renderCards(classes) {
      _cardIndex = 0;
      activeCards = []; // el tick global arranca de cero con las cards nuevas
      const grid = document.getElementById('grid');
      grid.innerHTML = '';

      if (classes.length === 0) {
        const isFiltered = document.getElementById('filterClass').value || document.getElementById('filterDay').value;
        const title = isFiltered ? 'Sin resultados para el filtro' : 'Sin clases próximas';
        const desc = isFiltered ? 'Probá seleccionando otras opciones de filtro.' : 'No hay clases activas por ahora. ¡Volvé pronto!';
        const icon = isFiltered ? '🔍' : '🎉';

        grid.innerHTML = `
          <div class="empty">
            <div class="empty-icon">${icon}</div>
            <h2>${title}</h2>
            <p>${desc}</p>
          </div>`;
        return;
      }

      classes.forEach(cls => {
        const card = createCard(cls);
        if (card) grid.appendChild(card);
      });
      tickAll(); // pinta los valores ya, sin esperar el primer segundo
      updateHoustonLink();
    }

    // ── Houston — Error reporter ────────────────────────────────────
    function updateHoustonLink() {
      const el = document.getElementById('houstonLink');
      if (!el) return;
      el.style.display = invalidDateClasses.length > 0 ? '' : 'none';
    }

    function showHoustonModal() {
      const modal = document.getElementById('houstonModal');
      const list  = document.getElementById('houstonList');
      if (!modal || !list) return;

      if (invalidDateClasses.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary)">No hay errores de fecha.</p>';
      } else {
        list.innerHTML = invalidDateClasses.map(c =>
          `<div class="houston-item">
            <strong>ID ${escapeHtml(c.Id)}</strong> — ${escapeHtml(c.Clase || '?')}<br>
            <span>${escapeHtml(c.Anio || '?')}/${escapeHtml(c.Mes || '?')}/${escapeHtml(c.Dia || '?')} Sem=${escapeHtml(c.SemanaMes || '?')} · ${escapeHtml(c.Horario || '?')}</span>
          </div>`
        ).join('');
      }

      modal.classList.add('open');
    }

    function closeHoustonModal() {
      const modal = document.getElementById('houstonModal');
      if (modal) modal.classList.remove('open');
    }

    // ── Filtering UI Logic ───────────────────────────────────────────
    function populateFilters(classes) {
      const classSelect = document.getElementById('filterClass');
      const daySelect = document.getElementById('filterDay');

      const prevClass = classSelect.value;
      const prevDay = daySelect.value;

      // Extract unique non-empty class names
      const uniqueClasses = [...new Set(classes.map(c => c.Clase).filter(Boolean))];
      // Extract unique non-empty weekday labels
      const uniqueDays = [...new Set(classes.map(c => c.Dia).filter(Boolean))];

      // Sort classes alphabetically
      uniqueClasses.sort((a, b) => a.localeCompare(b));

      // Sort days chronologically using a standard mapping
      const dayOrder = {
        'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3,
        'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6, 'domingo': 7
      };
      uniqueDays.sort((a, b) => {
        const orderA = dayOrder[a.toLowerCase().trim()] || 99;
        const orderB = dayOrder[b.toLowerCase().trim()] || 99;
        return orderA - orderB;
      });

      // Populate Class filter
      classSelect.innerHTML = '<option value="">Todas las clases</option>';
      uniqueClasses.forEach(cls => {
        const opt = document.createElement('option');
        opt.value = cls;
        opt.textContent = cls;
        classSelect.appendChild(opt);
      });

      // Populate Day filter
      daySelect.innerHTML = '<option value="">Todos los días</option>';
      uniqueDays.forEach(day => {
        const opt = document.createElement('option');
        opt.value = day;
        opt.textContent = day;
        daySelect.appendChild(opt);
      });

      // Attempt to restore previous selections if they are still valid options
      if (uniqueClasses.includes(prevClass)) {
        classSelect.value = prevClass;
      } else {
        classSelect.value = '';
      }

      if (uniqueDays.includes(prevDay)) {
        daySelect.value = prevDay;
      } else {
        daySelect.value = '';
      }
    }

    function applyFiltersAndRender() {
      const classVal = document.getElementById('filterClass').value;
      const dayVal = document.getElementById('filterDay').value;

      const filtered = allActiveClasses.filter(c => {
        const matchClass = !classVal || c.Clase === classVal;
        const matchDay = !dayVal || c.Dia === dayVal;
        return matchClass && matchDay;
      });

      renderCards(filtered);
    }

    // ── Main ──────────────────────────────────────────────────────────
    function updateTimestamp() {
      const now = new Date();
      const options = { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: false 
      };
      const formatted = now.toLocaleString('es-AR', options);
      document.getElementById('lastUpdate').textContent = formatted;
    }

    async function init() {
      const $status = document.getElementById('status');
      const $grid   = document.getElementById('grid');
      const $filters = document.getElementById('filters');

      try {
        const rows   = await fetchClasses();
        allActiveClasses = getActiveClasses(rows);
        updateHoustonLink();
        
        $status.style.display = 'none';
        
        if (allActiveClasses.length > 0) {
          $filters.style.display = 'flex';
        } else {
          $filters.style.display = 'none';
        }
        
        $grid.style.display   = 'grid';
        populateFilters(allActiveClasses);

        applyFiltersAndRender();

        updateTimestamp();
      } catch (err) {
        $status.innerHTML = `
          <p style="color:var(--salsa-a);font-size:1rem;margin-bottom:0.5rem">Error al cargar clases</p>
          <p style="font-size:0.85rem">${err.message}</p>
          <p style="font-size:0.8rem;margin-top:0.4rem;color:var(--text-secondary)">Verificá la URL del Sheet o tu conexión.</p>`;
      }
    }

    // ── Manual refresh ────────────────────────────────────────────────
    async function manualRefresh() {
      const btn = document.getElementById('refreshBtn');
      btn.disabled = true;
      btn.textContent = '⏳ ...';

      // Force fresh fetch (bypass in-memory cache)
      cache.data = null;
      cache.ts = 0;

      try {
        const rows   = await fetchClasses();
        allActiveClasses = getActiveClasses(rows);
        updateHoustonLink();
        populateFilters(allActiveClasses);
        applyFiltersAndRender();
      } catch (err) {
        // Error already shown in status if init ran, otherwise show here
      }

      // Re-enable after CACHE_TTL
      const remaining = CACHE_TTL - (Date.now() - cache.ts);
      const waitMs = remaining > 0 ? remaining : 0;
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = '↻ Refrescar';
      }, waitMs);
    }

    init();

    // ── PWA: Service Worker registration ─────────────────────────────
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./sw.js')
          .then(reg => console.log('[SW] Registered, scope:', reg.scope))
          .catch(err => console.warn('[SW] Registration failed:', err));
      });
    }