/* rosling-viz.js — Visualizaciones tipo Hans Rosling con D3.
   1) Bubble chart animado: X=Energía, Y=Movilidad, tamaño=total, color=%aprobado, frame=mes
   2) Racing bars: top-N estados acumulando documentos en el tiempo
   3) Small multiples: mini sparkline acumulado por estado
   Requiere: d3 v7, timeline-data.js (window.TIMELINE), data.js (ESTADOS) */
(function () {
  const T = window.TIMELINE;
  if (!T || !window.d3) return;

  const ESTADOS = window.ESTADOS || {};
  const ESTADO_NAMES = window.ESTADO_NAMES || [];
  const isMobile = () => window.matchMedia('(max-width: 680px)').matches;
  const colorOf = (n) => (ESTADOS[n] && ESTADOS[n].color) || '#6B7280';

  /* ────────────────────────────────────────────────────────────
     1. BUBBLE CHART ANIMADO (estilo Gapminder/Rosling)
     ──────────────────────────────────────────────────────────── */
  function initBubble() {
    const wrap = document.getElementById('rosling-bubble');
    if (!wrap) return;

    let frame = 0;          // índice de mes actual
    let playing = false;
    let timer = null;
    const FRAME_MS = 700;

    /* SVG y escalas */
    const svg = d3.select(wrap).append('svg').attr('class', 'rosling-svg');
    const margin = { top: 20, right: 28, bottom: 50, left: 56 };
    const gPlot = svg.append('g').attr('class', 'plot');
    const gAxes = svg.append('g').attr('class', 'axes');
    const gLabels = svg.append('g').attr('class', 'labels');
    const yearLabel = svg.append('text').attr('class', 'rosling-year');

    let xScale, yScale, rScale, colorScale;

    function maxOver(metric) {
      let max = 0;
      ESTADO_NAMES.forEach(n => {
        T.byState[n].forEach(p => { if (p[metric] > max) max = p[metric]; });
      });
      return max || 1;
    }
    const maxEne = maxOver('ene');
    const maxMov = maxOver('mov');
    const maxTotal = maxOver('total');

    function layout() {
      const width = wrap.clientWidth;
      const height = isMobile() ? Math.round(width * 0.95) : Math.round(width * 0.62);
      svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height);
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      // Escalas log-like (sqrt) para que estados pequeños no se aplasten
      xScale = d3.scaleSqrt().domain([0, maxEne]).range([0, innerW]).nice();
      yScale = d3.scaleSqrt().domain([0, maxMov]).range([innerH, 0]).nice();
      rScale = d3.scaleSqrt().domain([0, maxTotal]).range([4, isMobile() ? 24 : 36]);
      colorScale = d3.scaleSequential().domain([0, 1]).interpolator(d3.interpolateRgb('#DC2626', '#0E7C42'));

      gPlot.attr('transform', `translate(${margin.left},${margin.top})`);
      gAxes.attr('transform', `translate(${margin.left},${margin.top})`);
      gLabels.attr('transform', `translate(${margin.left},${margin.top})`);

      gAxes.selectAll('*').remove();
      // Eje X
      gAxes.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale).ticks(isMobile() ? 4 : 6).tickSize(-innerH));
      gAxes.append('text').attr('class', 'axis-label')
        .attr('x', innerW).attr('y', innerH + 36).attr('text-anchor', 'end')
        .text('Iniciativas de Energía (acum.) →');
      // Eje Y
      gAxes.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale).ticks(isMobile() ? 4 : 6).tickSize(-innerW));
      gAxes.append('text').attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', 0).attr('y', -42).attr('text-anchor', 'end')
        .text('↑ Iniciativas de Movilidad (acum.)');

      yearLabel.attr('x', width - margin.right - 8).attr('y', margin.top + 8).attr('text-anchor', 'end');
    }

    function dataAtFrame(i) {
      return ESTADO_NAMES.map(n => {
        const p = T.byState[n][i];
        return { name: n, ...p };
      }).filter(d => d.total > 0);
    }

    function render() {
      const points = dataAtFrame(frame);
      const sel = gPlot.selectAll('circle.bubble').data(points, d => d.name);
      sel.enter().append('circle')
        .attr('class', 'bubble')
        .attr('cx', d => xScale(d.ene))
        .attr('cy', d => yScale(d.mov))
        .attr('r', 0)
        .attr('fill', d => colorOf(d.name))
        .attr('fill-opacity', 0.55)
        .attr('stroke', d => colorOf(d.name))
        .attr('stroke-width', 1.4)
        .on('mousemove', function (evt, d) { showTooltip(evt, d); })
        .on('mouseleave', hideTooltip)
        .on('click', function (evt, d) { window.stateBus && window.stateBus.emit('select', d.name); })
        .merge(sel)
        .transition().duration(FRAME_MS * 0.8)
        .attr('cx', d => xScale(d.ene))
        .attr('cy', d => yScale(d.mov))
        .attr('r', d => rScale(d.total))
        .attr('fill-opacity', 0.55);
      sel.exit().transition().duration(300).attr('r', 0).remove();

      // Etiquetas: solo top 5 por total
      const top = [...points].sort((a, b) => b.total - a.total).slice(0, 5);
      const lblSel = gLabels.selectAll('text.bubble-lbl').data(top, d => d.name);
      lblSel.enter().append('text')
        .attr('class', 'bubble-lbl')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .text(d => d.name)
        .merge(lblSel)
        .transition().duration(FRAME_MS * 0.8)
        .attr('x', d => xScale(d.ene))
        .attr('y', d => yScale(d.mov) - rScale(d.total) - 6)
        .text(d => d.name);
      lblSel.exit().remove();

      yearLabel.text(T.monthLabels[frame]);
      const slider = document.getElementById('rosling-slider');
      if (slider) slider.value = frame;
      const lbl = document.getElementById('rosling-month-label');
      if (lbl) lbl.textContent = T.monthLabels[frame];
    }

    /* tooltip */
    let tt = document.createElement('div');
    tt.className = 'rosling-tt';
    tt.style.opacity = '0';
    wrap.appendChild(tt);
    function showTooltip(evt, d) {
      const pct = Math.round(d.pctAprobado * 100);
      tt.innerHTML = `<strong>${d.name}</strong>
        <div class="rosling-tt-row"><span>Energía</span><b>${d.ene}</b></div>
        <div class="rosling-tt-row"><span>Movilidad</span><b>${d.mov}</b></div>
        <div class="rosling-tt-row"><span>Total</span><b>${d.total}</b></div>
        <div class="rosling-tt-row"><span>% aprobado</span><b>${pct}%</b></div>`;
      tt.style.opacity = '1';
      const r = wrap.getBoundingClientRect();
      let x = evt.clientX - r.left + 12;
      let y = evt.clientY - r.top + 12;
      if (x + tt.offsetWidth > r.width) x = evt.clientX - r.left - tt.offsetWidth - 12;
      tt.style.left = x + 'px';
      tt.style.top = y + 'px';
    }
    function hideTooltip() { tt.style.opacity = '0'; }

    /* Controles play/pause y slider */
    function play() {
      if (playing) return;
      playing = true;
      document.getElementById('rosling-play').textContent = '⏸';
      timer = setInterval(() => {
        frame = (frame + 1) % T.months.length;
        render();
        if (frame === T.months.length - 1) { stop(); }
      }, FRAME_MS);
    }
    function stop() {
      playing = false;
      document.getElementById('rosling-play').textContent = '▶';
      if (timer) { clearInterval(timer); timer = null; }
    }
    document.getElementById('rosling-play').addEventListener('click', () => playing ? stop() : play());
    const slider = document.getElementById('rosling-slider');
    slider.max = T.months.length - 1;
    slider.value = 0;
    slider.addEventListener('input', e => { stop(); frame = +e.target.value; render(); });

    layout();
    render();
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { layout(); render(); }, 150);
    });
  }

  /* ────────────────────────────────────────────────────────────
     2. RACING BAR CHART
     ──────────────────────────────────────────────────────────── */
  function initRacing() {
    const wrap = document.getElementById('rosling-racing');
    if (!wrap) return;

    const TOP_N = 10;
    const FRAME_MS = 600;
    let frame = 0;
    let playing = false;
    let timer = null;

    const svg = d3.select(wrap).append('svg').attr('class', 'rosling-svg');
    const margin = { top: 14, right: 60, bottom: 28, left: 110 };
    const g = svg.append('g');
    const monthLabel = svg.append('text').attr('class', 'rosling-year racing-year');

    let width, height, innerW, innerH, xScale, yScale;

    function layout() {
      width = wrap.clientWidth;
      height = isMobile() ? 360 : 420;
      svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height);
      innerW = width - margin.left - margin.right;
      innerH = height - margin.top - margin.bottom;
      g.attr('transform', `translate(${margin.left},${margin.top})`);
      yScale = d3.scaleBand().range([0, innerH]).padding(0.18);
      monthLabel.attr('x', width - margin.right - 4).attr('y', height - 6).attr('text-anchor', 'end');
    }

    function dataAtFrame(i) {
      return ESTADO_NAMES
        .map(n => ({ name: n, total: T.byState[n][i].total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, TOP_N);
    }

    function render() {
      const data = dataAtFrame(frame);
      const max = Math.max(1, ...data.map(d => d.total));
      xScale = d3.scaleLinear().domain([0, max]).range([0, innerW]);
      yScale.domain(data.map(d => d.name));

      // Bars
      const bars = g.selectAll('rect.race-bar').data(data, d => d.name);
      bars.enter().append('rect')
        .attr('class', 'race-bar')
        .attr('x', 0)
        .attr('y', d => yScale(d.name))
        .attr('height', yScale.bandwidth())
        .attr('width', 0)
        .attr('fill', d => colorOf(d.name))
        .merge(bars)
        .transition().duration(FRAME_MS * 0.85)
        .attr('y', d => yScale(d.name))
        .attr('height', yScale.bandwidth())
        .attr('width', d => xScale(d.total));
      bars.exit().transition().duration(300).attr('width', 0).remove();

      // Labels izquierda (nombre)
      const nm = g.selectAll('text.race-name').data(data, d => d.name);
      nm.enter().append('text')
        .attr('class', 'race-name')
        .attr('x', -8)
        .attr('text-anchor', 'end')
        .attr('dy', '0.35em')
        .text(d => d.name)
        .merge(nm)
        .transition().duration(FRAME_MS * 0.85)
        .attr('y', d => yScale(d.name) + yScale.bandwidth() / 2)
        .text(d => d.name);
      nm.exit().remove();

      // Labels derecha (valor)
      const vl = g.selectAll('text.race-val').data(data, d => d.name);
      vl.enter().append('text')
        .attr('class', 'race-val')
        .attr('x', 0)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'start')
        .text(d => d.total)
        .merge(vl)
        .transition().duration(FRAME_MS * 0.85)
        .attr('x', d => xScale(d.total) + 6)
        .attr('y', d => yScale(d.name) + yScale.bandwidth() / 2)
        .tween('text', function (d) {
          const i = d3.interpolateNumber(+this.textContent, d.total);
          return t => { this.textContent = Math.round(i(t)); };
        });
      vl.exit().remove();

      monthLabel.text(T.monthLabels[frame]);
    }

    function play() {
      if (playing) return;
      playing = true;
      document.getElementById('racing-play').textContent = '⏸';
      timer = setInterval(() => {
        frame = (frame + 1) % T.months.length;
        render();
        if (frame === T.months.length - 1) stop();
      }, FRAME_MS);
    }
    function stop() {
      playing = false;
      document.getElementById('racing-play').textContent = '▶';
      if (timer) { clearInterval(timer); timer = null; }
    }
    document.getElementById('racing-play').addEventListener('click', () => playing ? stop() : play());

    layout();
    render();
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { layout(); render(); }, 150);
    });
  }

  /* ────────────────────────────────────────────────────────────
     3. SMALL MULTIPLES
     ──────────────────────────────────────────────────────────── */
  function initSmallMultiples() {
    const wrap = document.getElementById('rosling-multiples');
    if (!wrap) return;

    // Solo estados con datos en la ventana, ordenados por total final
    const items = ESTADO_NAMES
      .map(n => ({ name: n, series: T.byState[n], finalTotal: T.byState[n][T.byState[n].length - 1].total }))
      .filter(it => it.finalTotal > 0)
      .sort((a, b) => b.finalTotal - a.finalTotal);

    // Mismo eje Y para todos (comparable)
    const globalMax = Math.max(1, ...items.map(it => it.finalTotal));

    wrap.innerHTML = '';
    items.forEach(it => {
      const card = document.createElement('div');
      card.className = 'sm-card';
      card.innerHTML = `
        <div class="sm-head">
          <span class="sm-name">${it.name}</span>
          <span class="sm-val">${it.finalTotal}</span>
        </div>
        <svg class="sm-svg" viewBox="0 0 200 60" preserveAspectRatio="none"></svg>
      `;
      wrap.appendChild(card);

      const svg = d3.select(card.querySelector('.sm-svg'));
      const w = 200, h = 60, pad = 4;
      const x = d3.scaleLinear().domain([0, T.months.length - 1]).range([pad, w - pad]);
      const y = d3.scaleLinear().domain([0, globalMax]).range([h - pad, pad]);
      const area = d3.area()
        .x((_, i) => x(i))
        .y0(h - pad)
        .y1(d => y(d.total))
        .curve(d3.curveMonotoneX);
      const line = d3.line()
        .x((_, i) => x(i))
        .y(d => y(d.total))
        .curve(d3.curveMonotoneX);

      const c = colorOf(it.name);
      svg.append('path').attr('d', area(it.series)).attr('fill', c).attr('fill-opacity', 0.18);
      svg.append('path').attr('d', line(it.series)).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 1.6);

      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        window.stateBus && window.stateBus.emit('select', it.name);
      });
    });
  }

  /* ────────────────────────────────────────────────────────────
     INIT
     ──────────────────────────────────────────────────────────── */
  function init() {
    try { initBubble(); } catch (e) { console.error('bubble', e); }
    try { initRacing(); } catch (e) { console.error('racing', e); }
    try { initSmallMultiples(); } catch (e) { console.error('multiples', e); }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
