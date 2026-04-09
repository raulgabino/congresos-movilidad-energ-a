/* map.js — Mapa coroplético de México con D3.
   Requiere: d3 v7, data.js (STATE_METRICS, ESTADOS), state-bus.js
   Renderiza dentro del contenedor #mapa-svg-wrap y emite 'select' al bus. */
(function () {
  const CONTAINER_ID = 'mapa-svg-wrap';
  const TOOLTIP_ID   = 'mapa-tooltip';
  const GEOJSON_URL  = 'assets/mexico-states.geojson';

  /* Mapeo nombre del GeoJSON → key en ESTADOS/STATE_METRICS */
  const NAME_MAP = {
    'Distrito Federal': 'CDMX',
    'México': 'Estado de México',
    'Michoacán de Ocampo': 'Michoacán',
    'Veracruz de Ignacio de la Llave': 'Veracruz',
    'Coahuila de Zaragoza': 'Coahuila'
  };
  function normalizeName(geoName) {
    return NAME_MAP[geoName] || geoName;
  }

  let svg, g, path, projection, tooltip, currentSelection = null, allFeatures = [];
  let mapMode = 'total'; // 'total' | 'percapita'

  function metricsFor(name) {
    const m = (window.STATE_METRICS && window.STATE_METRICS[name]) || null;
    if (!m) return null;
    const pop = (window.POPULATION && window.POPULATION[name]) || null;
    const totalPC = pop ? (m.total / pop * 1e6) : null;
    return Object.assign({}, m, { totalPerCapita: totalPC, population: pop });
  }

  function valueOf(m) {
    if (!m) return 0;
    return mapMode === 'percapita' ? (m.totalPerCapita || 0) : m.total;
  }

  function allValues() {
    return Object.keys(window.STATE_METRICS || {})
      .map(n => valueOf(metricsFor(n)))
      .filter(v => v > 0);
  }

  function colorScale() {
    const vals = allValues();
    const max = Math.max(1, ...vals);
    const interp = d3.interpolateRgb('#FFE6B8', '#9A4A00');
    return v => v <= 0 ? '#EFEDE6' : interp(Math.sqrt(v / max));
  }

  function fillFor(name) {
    const m = metricsFor(name);
    const v = valueOf(m);
    if (!m || v <= 0) return '#EFEDE6';
    return colorScale()(v);
  }

  function fmtPC(v) {
    if (v == null) return '—';
    return v >= 10 ? v.toFixed(1) : v.toFixed(2);
  }

  function legendStops() {
    const vals = allValues();
    const max = Math.max(1, ...vals);
    const stops = [max * 0.04, max * 0.15, max * 0.4, max * 0.7, max];
    return mapMode === 'percapita' ? stops.map(v => +v.toFixed(2)) : stops.map(v => Math.round(v));
  }

  function showTooltip(evt, feature) {
    const name = normalizeName(feature.properties.state_name);
    const m = metricsFor(name);
    let html = `<div class="mapa-tt-name">${name}</div>`;
    if (!m || m.total === 0) {
      html += `<div class="mapa-tt-empty">Sin registros en la ventana actual</div>`;
    } else {
      const pctEne = m.total ? Math.round(m.energia / m.total * 100) : 0;
      const pctMov = 100 - pctEne;
      const pcStr = m.totalPerCapita != null ? fmtPC(m.totalPerCapita) + ' /M hab.' : '—';
      html += `
        <div class="mapa-tt-row"><span>Total</span><strong>${m.total}</strong></div>
        <div class="mapa-tt-row"><span>Per cápita</span><strong>${pcStr}</strong></div>
        <div class="mapa-tt-row"><span style="color:#E8960A">Energía</span><strong>${m.energia} (${pctEne}%)</strong></div>
        <div class="mapa-tt-row"><span style="color:#2E7D32">Movilidad</span><strong>${m.movilidad} (${pctMov}%)</strong></div>
        <div class="mapa-tt-row mapa-tt-sub"><span>Aprobados</span><strong>${m.aprobado}</strong></div>
      `;
    }
    tooltip.innerHTML = html;
    tooltip.style.opacity = '1';
    moveTooltip(evt);
  }
  function moveTooltip(evt) {
    const wrap = document.getElementById(CONTAINER_ID);
    const r = wrap.getBoundingClientRect();
    let x = evt.clientX - r.left + 14;
    let y = evt.clientY - r.top + 14;
    const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    if (x + tw > r.width)  x = evt.clientX - r.left - tw - 14;
    if (y + th > r.height) y = evt.clientY - r.top - th - 14;
    tooltip.style.left = Math.max(4, x) + 'px';
    tooltip.style.top  = Math.max(4, y) + 'px';
  }
  function hideTooltip() { tooltip.style.opacity = '0'; }

  function onClick(feature) {
    const name = normalizeName(feature.properties.state_name);
    const m = metricsFor(name);
    if (!m || m.total === 0) return; // sin datos: no filtrar
    if (currentSelection === name) {
      currentSelection = null;
      window.stateBus.emit('select', null);
    } else {
      currentSelection = name;
      window.stateBus.emit('select', name);
    }
    updateSelectionStyles();
  }

  function updateSelectionStyles() {
    g.selectAll('path.mapa-state')
      .classed('is-selected', d => normalizeName(d.properties.state_name) === currentSelection)
      .classed('is-dim', d => currentSelection && normalizeName(d.properties.state_name) !== currentSelection);
  }

  function render() {
    const wrap = document.getElementById(CONTAINER_ID);
    const width = wrap.clientWidth;
    const height = Math.round(width * 0.62); // proporción cómoda para México
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height);

    projection = d3.geoMercator().fitSize([width, height], { type: 'FeatureCollection', features: allFeatures });
    path = d3.geoPath(projection);

    const sel = g.selectAll('path.mapa-state').data(allFeatures, d => d.properties.state_code);
    sel.enter()
      .append('path')
      .attr('class', 'mapa-state')
      .attr('stroke', '#FAFAF7')
      .attr('stroke-width', 0.6)
      .on('mousemove', function (evt, d) { showTooltip(evt, d); d3.select(this).attr('stroke-width', 1.4); })
      .on('mouseleave', function () { hideTooltip(); d3.select(this).attr('stroke-width', 0.6); })
      .on('click', function (evt, d) { onClick(d); })
      .merge(sel)
      .attr('d', path)
      .attr('fill', d => fillFor(normalizeName(d.properties.state_name)));

    updateSelectionStyles();
    renderLegend();
  }

  function renderLegend() {
    const legend = document.getElementById('mapa-legend');
    if (!legend) return;
    const stops = legendStops();
    const sc = colorScale();
    const titulo = mapMode === 'percapita'
      ? 'Documentos por millón de habitantes · desde octubre 2024'
      : 'Documentos por estado · desde octubre 2024';
    const ayuda = mapMode === 'percapita'
      ? 'Normalización: total ÷ población × 1,000,000 (Censo INEGI 2020). Estados pequeños como Tlaxcala suben en intensidad relativa.'
      : 'Escala raíz cuadrada para mayor contraste. Haz clic en un estado para filtrar el resto del dashboard.';
    legend.innerHTML = `
      <div class="mapa-mode-toggle" role="tablist" aria-label="Modo del mapa">
        <button type="button" class="mapa-mode-btn ${mapMode==='total'?'is-active':''}" data-mode="total">Total</button>
        <button type="button" class="mapa-mode-btn ${mapMode==='percapita'?'is-active':''}" data-mode="percapita">Por millón hab.</button>
      </div>
      <div class="mapa-legend-title">${titulo}</div>
      <div class="mapa-legend-bar">
        ${stops.map(v => `<div class="mapa-legend-stop"><span class="sw" style="background:${sc(v)}"></span><span>${v}</span></div>`).join('')}
        <div class="mapa-legend-stop"><span class="sw" style="background:#EFEDE6"></span><span>sin datos</span></div>
      </div>
      <div class="mapa-legend-help">${ayuda}</div>
    `;
    legend.querySelectorAll('.mapa-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = btn.getAttribute('data-mode');
        if (m === mapMode) return;
        mapMode = m;
        // recolorea con transición y rerenderiza la leyenda
        g.selectAll('path.mapa-state')
          .transition().duration(450)
          .attr('fill', d => fillFor(normalizeName(d.properties.state_name)));
        renderLegend();
      });
    });
  }

  function init() {
    const wrap = document.getElementById(CONTAINER_ID);
    if (!wrap || typeof d3 === 'undefined') return;

    tooltip = document.createElement('div');
    tooltip.id = TOOLTIP_ID;
    tooltip.className = 'mapa-tooltip';
    tooltip.style.opacity = '0';
    wrap.appendChild(tooltip);

    svg = d3.select(wrap).append('svg').attr('class', 'mapa-svg');
    g = svg.append('g');

    // click en fondo del SVG = limpiar selección
    svg.on('click', function (evt) {
      if (evt.target === svg.node() && currentSelection) {
        currentSelection = null;
        window.stateBus.emit('select', null);
        updateSelectionStyles();
      }
    });

    d3.json(GEOJSON_URL).then(geo => {
      allFeatures = geo.features;
      render();
      window.addEventListener('resize', debounce(render, 150));
    }).catch(err => {
      console.error('Error cargando GeoJSON:', err);
      wrap.innerHTML = '<div class="mapa-error">No se pudo cargar el mapa de México.</div>';
    });
  }

  function debounce(fn, ms) {
    let t; return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), ms); };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
