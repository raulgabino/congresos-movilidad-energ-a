/* cross-viz.js — Visualizaciones cruzadas (Fase 3):
   1) Scatter Volumen × Tasa de aprobación con líneas de mediana (cuadrantes).
   2) Heatmap Estado × Subtema con escalas separadas Energía/Movilidad.
   Requiere: d3 v7, data.js (STATE_METRICS, ESTADOS, SUBTEMAS, DATA_FILTERED). */
(function () {
  if (!window.d3) return;
  const ESTADOS = window.ESTADOS || {};
  const ESTADO_NAMES = window.ESTADO_NAMES || [];
  const STATE_METRICS = window.STATE_METRICS || {};
  const SUBTEMAS = window.SUBTEMAS || {};
  const DATA_FILTERED = window.DATA_FILTERED || [];
  const isMobile = () => window.matchMedia('(max-width: 680px)').matches;
  const colorOf = (n) => (ESTADOS[n] && ESTADOS[n].color) || '#6B7280';
  const SHORT = {'Tamaulipas':'TAM','Nuevo León':'NL','Coahuila':'COA','Chihuahua':'CHIH','Sonora':'SON','Veracruz':'VER','Chiapas':'CHIS','Jalisco':'JAL','Estado de México':'EDOMEX','Colima':'COL','Durango':'DGO','Michoacán':'MICH','Puebla':'PUE','Querétaro':'QRO','Campeche':'CAM','Sinaloa':'SIN','Oaxaca':'OAX','Tlaxcala':'TLX','CDMX':'CDMX','Zacatecas':'ZAC','Morelos':'MOR','Guerrero':'GRO'};

  /* ────────────────────────────────────────────────────────────
     1. SCATTER: Volumen vs % aprobación con cuadrantes
     ──────────────────────────────────────────────────────────── */
  function initScatter() {
    const wrap = document.getElementById('cross-scatter');
    if (!wrap) return;

    const points = ESTADO_NAMES
      .map(n => {
        const m = STATE_METRICS[n];
        if (!m || m.total === 0) return null;
        return {
          name: n,
          total: m.total,
          aprobado: m.aprobado || 0,
          enProceso: m.enProceso || 0,
          pct: m.total ? (m.aprobado / m.total) : 0
        };
      })
      .filter(Boolean);

    if (points.length === 0) return;

    const svg = d3.select(wrap).append('svg').attr('class', 'rosling-svg');
    const margin = { top: 22, right: 22, bottom: 50, left: 56 };
    const gAxes = svg.append('g');
    const gPlot = svg.append('g');
    const gQuad = svg.append('g');

    let tt = document.createElement('div');
    tt.className = 'rosling-tt';
    tt.style.opacity = '0';
    wrap.appendChild(tt);

    function median(arr) {
      const s = [...arr].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }

    function render() {
      const width = wrap.clientWidth;
      const height = isMobile() ? Math.round(width * 0.95) : Math.round(width * 0.6);
      svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height);
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const maxTotal = d3.max(points, d => d.total) || 1;
      const x = d3.scaleSqrt().domain([0, maxTotal]).range([0, innerW]).nice();
      const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);
      const medX = median(points.map(p => p.total));
      const medY = median(points.map(p => p.pct));

      gAxes.attr('transform', `translate(${margin.left},${margin.top})`).selectAll('*').remove();
      gPlot.attr('transform', `translate(${margin.left},${margin.top})`).selectAll('*').remove();
      gQuad.attr('transform', `translate(${margin.left},${margin.top})`).selectAll('*').remove();

      // Ejes
      gAxes.append('g').attr('class', 'axis')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(isMobile() ? 4 : 6).tickSize(-innerH));
      gAxes.append('text').attr('class', 'axis-label')
        .attr('x', innerW).attr('y', innerH + 36).attr('text-anchor', 'end')
        .text('Total de documentos →');
      gAxes.append('g').attr('class', 'axis')
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => Math.round(d * 100) + '%').tickSize(-innerW));
      gAxes.append('text').attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)').attr('x', 0).attr('y', -42).attr('text-anchor', 'end')
        .text('↑ Tasa de aprobación');

      // Líneas de mediana (cuadrantes)
      gQuad.append('line').attr('class', 'quad-line')
        .attr('x1', x(medX)).attr('x2', x(medX)).attr('y1', 0).attr('y2', innerH);
      gQuad.append('line').attr('class', 'quad-line')
        .attr('x1', 0).attr('x2', innerW).attr('y1', y(medY)).attr('y2', y(medY));

      // Etiquetas de cuadrantes (esquinas)
      const labels = [
        { x: innerW - 4, y: 14, anchor: 'end', t: 'Campeones · alto volumen + alta aprobación' },
        { x: 4, y: 14, anchor: 'start', t: 'Quirúrgicos · pocos pero efectivos' },
        { x: innerW - 4, y: innerH - 6, anchor: 'end', t: 'Prolíficos · alto volumen, baja aprobación' },
        { x: 4, y: innerH - 6, anchor: 'start', t: 'Bajo volumen, baja aprobación' }
      ];
      gQuad.selectAll('text.quad-lbl').data(labels).enter()
        .append('text').attr('class', 'quad-lbl')
        .attr('x', d => d.x).attr('y', d => d.y).attr('text-anchor', d => d.anchor).text(d => d.t);

      // Puntos
      const r = isMobile() ? 5 : 7;
      const sel = gPlot.selectAll('g.scatter-pt').data(points, d => d.name).enter()
        .append('g').attr('class', 'scatter-pt')
        .attr('transform', d => `translate(${x(d.total)},${y(d.pct)})`)
        .style('cursor', 'pointer')
        .on('mousemove', function (evt, d) { showTooltip(evt, d); })
        .on('mouseleave', hideTooltip)
        .on('click', function (evt, d) { window.stateBus && window.stateBus.emit('select', d.name); });
      sel.append('circle')
        .attr('r', r)
        .attr('fill', d => colorOf(d.name))
        .attr('fill-opacity', 0.85)
        .attr('stroke', '#fff').attr('stroke-width', 1.5);
      sel.append('text')
        .attr('class', 'scatter-lbl')
        .attr('x', r + 4).attr('y', 4)
        .text(d => SHORT[d.name] || d.name);
    }

    function showTooltip(evt, d) {
      const pct = Math.round(d.pct * 100);
      tt.innerHTML = `<strong>${d.name}</strong>
        <div class="rosling-tt-row"><span>Total</span><b>${d.total}</b></div>
        <div class="rosling-tt-row"><span>Aprobados</span><b>${d.aprobado}</b></div>
        <div class="rosling-tt-row"><span>En proceso</span><b>${d.enProceso}</b></div>
        <div class="rosling-tt-row"><span>% aprobado</span><b>${pct}%</b></div>`;
      tt.style.opacity = '1';
      const r = wrap.getBoundingClientRect();
      let xx = evt.clientX - r.left + 12;
      let yy = evt.clientY - r.top + 12;
      if (xx + tt.offsetWidth > r.width) xx = evt.clientX - r.left - tt.offsetWidth - 12;
      tt.style.left = xx + 'px';
      tt.style.top = yy + 'px';
    }
    function hideTooltip() { tt.style.opacity = '0'; }

    render();
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 150);
    });
  }

  /* ────────────────────────────────────────────────────────────
     2. HEATMAP: Estado × Subtema
     ──────────────────────────────────────────────────────────── */
  function initHeatmap() {
    const wrap = document.getElementById('cross-heatmap');
    if (!wrap) return;

    // Precómputo: matriz [estado][subtema] = count
    const matrix = {};
    ESTADO_NAMES.forEach(n => { matrix[n] = {}; });
    DATA_FILTERED.forEach(d => {
      if (matrix[d.estado]) {
        matrix[d.estado][d.subtema] = (matrix[d.estado][d.subtema] || 0) + 1;
      }
    });

    // Solo estados con datos, ordenados por total descendente
    const rowsAll = ESTADO_NAMES
      .map(n => ({ name: n, total: STATE_METRICS[n] ? STATE_METRICS[n].total : 0 }))
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total);
    const rows = rowsAll.map(r => r.name);

    const eneCols = Object.keys(SUBTEMAS).filter(k => k.startsWith('ENE'));
    const movCols = Object.keys(SUBTEMAS).filter(k => k.startsWith('MOV'));
    const cols = [...eneCols, ...movCols];

    // Escalas separadas por macrotema
    let maxEne = 0, maxMov = 0;
    rows.forEach(r => {
      eneCols.forEach(c => { const v = matrix[r][c] || 0; if (v > maxEne) maxEne = v; });
      movCols.forEach(c => { const v = matrix[r][c] || 0; if (v > maxMov) maxMov = v; });
    });
    const eneScale = d3.scaleSequential(d3.interpolateOranges).domain([0, maxEne || 1]);
    const movScale = d3.scaleSequential(d3.interpolateGreens).domain([0, maxMov || 1]);
    const colorFor = (col, val) => {
      if (!val) return '#F5F2EA';
      return col.startsWith('ENE') ? eneScale(val) : movScale(val);
    };

    const svg = d3.select(wrap).append('svg').attr('class', 'rosling-svg heatmap-svg');
    const tt = document.createElement('div');
    tt.className = 'rosling-tt';
    tt.style.opacity = '0';
    wrap.appendChild(tt);

    function render() {
      const width = wrap.clientWidth;
      const margin = { top: 110, right: 16, bottom: 16, left: isMobile() ? 90 : 130 };
      const cellH = isMobile() ? 16 : 22;
      const innerH = rows.length * cellH;
      const innerW = width - margin.left - margin.right;
      const cellW = innerW / cols.length;
      const height = innerH + margin.top + margin.bottom;

      svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height);
      svg.selectAll('*').remove();

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      // Celdas
      rows.forEach((rName, ri) => {
        cols.forEach((cKey, ci) => {
          const v = (matrix[rName] && matrix[rName][cKey]) || 0;
          g.append('rect')
            .attr('class', 'heat-cell')
            .attr('x', ci * cellW + 1).attr('y', ri * cellH + 1)
            .attr('width', cellW - 2).attr('height', cellH - 2)
            .attr('rx', 2)
            .attr('fill', colorFor(cKey, v))
            .style('cursor', v ? 'pointer' : 'default')
            .on('mousemove', function (evt) { showTooltip(evt, rName, cKey, v); })
            .on('mouseleave', hideTooltip)
            .on('click', function () {
              if (!v) return;
              window.stateBus && window.stateBus.emit('select', rName);
            });
          if (v && cellH >= 20) {
            const txt = colorFor(cKey, v);
            g.append('text')
              .attr('class', 'heat-cell-val')
              .attr('x', ci * cellW + cellW / 2)
              .attr('y', ri * cellH + cellH / 2 + 3)
              .attr('text-anchor', 'middle')
              .attr('fill', v / (cKey.startsWith('ENE') ? maxEne : maxMov) > 0.55 ? '#fff' : '#3A2A0A')
              .text(v);
          }
        });
      });

      // Labels filas
      g.append('g').selectAll('text').data(rows).enter()
        .append('text')
        .attr('class', 'heat-row-lbl')
        .attr('x', -8).attr('y', (_, i) => i * cellH + cellH / 2 + 4)
        .attr('text-anchor', 'end')
        .text(d => isMobile() ? (SHORT[d] || d) : d);

      // Labels columnas (rotadas)
      g.append('g').selectAll('text').data(cols).enter()
        .append('text')
        .attr('class', 'heat-col-lbl')
        .attr('transform', (_, i) => `translate(${i * cellW + cellW / 2},-8) rotate(-45)`)
        .attr('text-anchor', 'start')
        .text(c => {
          const full = SUBTEMAS[c] || c;
          return full.length > 22 ? full.slice(0, 22) + '…' : full;
        });

      // Divisor entre Energía y Movilidad
      const divX = eneCols.length * cellW;
      g.append('line')
        .attr('class', 'heat-divider')
        .attr('x1', divX).attr('x2', divX)
        .attr('y1', -8).attr('y2', innerH);
      g.append('text')
        .attr('class', 'heat-group-lbl')
        .attr('x', eneCols.length * cellW / 2).attr('y', -90)
        .attr('text-anchor', 'middle').attr('fill', '#9A4A00')
        .text('ENERGÍA');
      g.append('text')
        .attr('class', 'heat-group-lbl')
        .attr('x', divX + movCols.length * cellW / 2).attr('y', -90)
        .attr('text-anchor', 'middle').attr('fill', '#2E7D32')
        .text('MOVILIDAD');
    }

    function showTooltip(evt, row, col, val) {
      const subName = SUBTEMAS[col] || col;
      const stateTotal = (STATE_METRICS[row] && STATE_METRICS[row].total) || 0;
      const pct = stateTotal && val ? Math.round(val / stateTotal * 100) : 0;
      tt.innerHTML = `<strong>${row}</strong>
        <div class="rosling-tt-row"><span>${subName}</span><b>${val}</b></div>
        <div class="rosling-tt-row"><span>% del estado</span><b>${pct}%</b></div>`;
      tt.style.opacity = '1';
      const r = wrap.getBoundingClientRect();
      let xx = evt.clientX - r.left + 12;
      let yy = evt.clientY - r.top + 12;
      if (xx + tt.offsetWidth > r.width) xx = evt.clientX - r.left - tt.offsetWidth - 12;
      tt.style.left = xx + 'px';
      tt.style.top = yy + 'px';
    }
    function hideTooltip() { tt.style.opacity = '0'; }

    render();
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 150);
    });
  }

  function init() {
    try { initScatter(); } catch (e) { console.error('scatter', e); }
    try { initHeatmap(); } catch (e) { console.error('heatmap', e); }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
