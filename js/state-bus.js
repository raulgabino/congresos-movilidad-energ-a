/* state-bus.js — event bus mínimo para comunicar componentes
   sin acoplarlos directamente. Uso:
     stateBus.on('select', code => { ... });
     stateBus.emit('select', 'Tamaulipas');                       */
(function (global) {
  const handlers = new Map();
  global.stateBus = {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(fn);
      return () => handlers.get(event).delete(fn);
    },
    emit(event, payload) {
      const set = handlers.get(event);
      if (!set) return;
      set.forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
    }
  };
})(window);
