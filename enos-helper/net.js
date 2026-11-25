// enos Helper : compte les appels d enos a son serveur qui sont en cours, pour savoir quand une page a fini de se charger.
// Tourne dans la page (monde principal). Ne lit ni les adresses ni les reponses : un simple compteur, pose sur <html>.
(() => {
  if (window.__ehNet) return;
  window.__ehNet = true;
  const live = new Set();
  const root = document.documentElement;
  // Un appel de plus de 6 s (attente de notifications) ne compte plus : il ne dit rien de la page.
  const out = () => { const now = Date.now(); let n = 0; for (const t of live) if (now - t.at < 6000) n++; root.setAttribute('data-eh-net', String(n)); };
  const start = () => { const t = { at: Date.now() }; live.add(t); out(); return () => { live.delete(t); out(); }; };
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    try { this.addEventListener('loadend', start(), { once: true }); } catch (e) {}
    return send.apply(this, arguments);
  };
  if (window.fetch) {
    const f = window.fetch;
    window.fetch = function () {
      let end = () => {};
      try { end = start(); } catch (e) {}
      const p = f.apply(this, arguments);
      p.then(end, end);
      return p;
    };
  }
  setInterval(out, 1000);
  out();
})();
