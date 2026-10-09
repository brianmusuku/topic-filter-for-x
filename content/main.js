// Wires the pieces together and keeps them in step with X's single-page app.
(async () => {
  if (window.__tlfBooted) return;
  window.__tlfBooted = true;

  const TLF = window.TLF;
  await TLF.store.load();

  const panel = TLF.createPanel();
  // Keep the host outside X's body layout. X changes body overflow/stacking
  // contexts between routes, which can clip an absolutely positioned child.
  // The host is still document-positioned by placement.js, so it scrolls
  // normally instead of becoming sticky.
  document.documentElement.appendChild(panel.host);

  let timer = 0;
  let lastPath = location.pathname;

  function tick() {
    timer = 0;
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      filter.resetPage();
    }
    TLF.placement.ensure(panel.host);
    TLF.theme.apply(panel.host);
    TLF.placement.layout(panel.host);
    filter.scan();
  }
  // X mutates its DOM constantly; coalesce bursts into one pass.
  const schedule = () => {
    if (!timer) timer = setTimeout(tick, 100);
  };

  const filter = TLF.createFilter({ onRescan: schedule });
  filter.onStats(panel.setStats);
  filter.onError(panel.setError);

  TLF.store.subscribe((changed) => {
    if ('apiKey' in changed) filter.resetAuth();
    schedule();
  });
  panel.onResize((h) => {
    TLF.placement.setHeight(h);
    schedule();
  });

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  addEventListener('resize', schedule);

  tick();
})();
