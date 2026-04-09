/* timeline-data.js — precomputa series temporales por estado para
   las visualizaciones tipo Rosling. Una sola pasada al cargar.
   Expone window.TIMELINE = { months, byState, totalsByMonth, monthLabels } */
(function (global) {
  const data = global.DATA_FILTERED || [];
  const estados = global.ESTADO_NAMES || [];
  const estatusH = (e) => (global.ESTATUS_HOMOLOGADO && global.ESTATUS_HOMOLOGADO[e]) || e;

  /* 1. Lista ordenada de meses presentes en el dataset */
  const monthSet = new Set();
  data.forEach(d => monthSet.add(d.fecha.substring(0, 7)));
  const months = [...monthSet].sort();

  /* 2. Counts por (estado, mes) — no acumulados aún */
  const raw = {}; // raw[estado][month] = { ene, mov, total, aprobado }
  estados.forEach(n => {
    raw[n] = {};
    months.forEach(m => raw[n][m] = { ene: 0, mov: 0, total: 0, aprobado: 0 });
  });
  data.forEach(d => {
    const ym = d.fecha.substring(0, 7);
    const r = raw[d.estado] && raw[d.estado][ym];
    if (!r) return;
    r.total++;
    if (d.macrotema === 'Energía') r.ene++;
    else if (d.macrotema === 'Movilidad') r.mov++;
    if (estatusH(d.estatus) === 'Aprobado') r.aprobado++;
  });

  /* 3. Series acumuladas por estado: cada mes contiene el total acumulado
        hasta esa fecha (facilita Rosling-style: estados crecen monotónicos). */
  const byState = {};
  estados.forEach(n => {
    let cumEne = 0, cumMov = 0, cumApr = 0;
    byState[n] = months.map(m => {
      const r = raw[n][m];
      cumEne += r.ene;
      cumMov += r.mov;
      cumApr += r.aprobado;
      const cumTotal = cumEne + cumMov;
      return {
        month: m,
        ene: cumEne,
        mov: cumMov,
        total: cumTotal,
        aprobado: cumApr,
        pctAprobado: cumTotal ? (cumApr / cumTotal) : 0,
        deltaTotal: r.total // delta del mes (no acumulado), útil para racing
      };
    });
  });

  /* 4. Total de documentos por mes (para sparkline global) */
  const totalsByMonth = months.map(m => {
    let s = 0;
    estados.forEach(n => { s += raw[n][m].total; });
    return { month: m, total: s };
  });

  /* 5. Labels legibles "Oct '24" */
  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthLabels = months.map(m => {
    const [y, mm] = m.split('-');
    return MES[+mm - 1] + ' \'' + y.slice(2);
  });

  global.TIMELINE = { months, byState, totalsByMonth, monthLabels, raw };
})(window);
