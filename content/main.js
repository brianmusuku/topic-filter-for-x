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

  const POST = 'article[data-testid="tweet"], [data-testid="cellInnerDiv"]';
  const CELL = '[data-testid="cellInnerDiv"]';

  let lastPath = location.pathname;

  // ---- scroll anchoring ---------------------------------------------------
  // X lays the timeline out with absolutely positioned cells. When we collapse
  // or expand a post, the cells around it are moved by X a moment later, and
  // the browser's built-in scroll anchoring can't follow that. If the shift
  // happens above the viewport, the page appears to jump. So: remember where
  // the first visible post is, and for a short while nudge the scroll position
  // to keep it exactly where it was. If anything else scrolls the page (the
  // user, or X restoring its saved position) we simply take a new reference.
  const HOLD_MS = 700;
  let held = null;
  let holdUntil = 0;
  let holdRaf = 0;

  function pickAnchor() {
    let best = null;
    let bestTop = Infinity;
    for (const cell of document.querySelectorAll(CELL)) {
      const r = cell.getBoundingClientRect();
      if (r.height > 0 && r.bottom > 8 && r.top < bestTop) {
        best = cell;
        bestTop = r.top;
      }
    }
    return best ? { el: best, top: bestTop, y: window.scrollY } : null;
  }

  function follow() {
    holdRaf = 0;
    if (held) {
      if (!held.el.isConnected || window.scrollY !== held.y) {
        held = pickAnchor();
      } else {
        const drift = held.el.getBoundingClientRect().top - held.top;
        if (Math.abs(drift) >= 1) {
          window.scrollBy(0, drift);
          held.y = window.scrollY;
        }
      }
    }
    if (performance.now() < holdUntil) holdRaf = requestAnimationFrame(follow);
    else held = null;
  }

  // The filter calls this BEFORE it collapses/expands a post.
  function hold() {
    holdUntil = performance.now() + HOLD_MS;
    if (!held) held = pickAnchor();
    if (!holdRaf) holdRaf = requestAnimationFrame(follow);
  }

  // ---- scheduling ---------------------------------------------------------
  // New posts are handled on the next animation frame. That runs before the
  // browser lays the page out and before X measures the new cells, so posts we
  // already know about are collapsed from their very first frame and X records
  // their real (collapsed) height. Everything else is coalesced like before.
  let raf = 0;
  let timer = 0;

  function run() {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    raf = timer = 0;
    tick();
  }

  function schedule(urgent = false) {
    if (urgent) {
      if (raf) return;
      clearTimeout(timer);
      raf = requestAnimationFrame(run);
      // requestAnimationFrame is paused in background tabs.
      timer = setTimeout(run, 250);
    } else if (!raf && !timer) {
      timer = setTimeout(run, 100);
    }
  }

  function tick() {
    // No unconditional hold() here: X reflows constantly for its own reasons
    // (composer, dialogs, dropdowns) and we must not fight that. The filter
    // calls hold() itself, right before it changes a post's layout.
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      filter.resetPage();
    }
    // 'pending' means the search box isn't ready yet; look again shortly
    // instead of waiting for X to happen to change something.
    if (TLF.placement.ensure(panel.host) === "pending")
      setTimeout(() => schedule(), 200);
    TLF.theme.apply(panel.host);
    TLF.placement.layout(panel.host);
    filter.scan();
  }

  const filter = TLF.createFilter({
    onRescan: () => schedule(true),
    onBeforeLayoutChange: hold,
  });
  filter.onStats(panel.setStats);
  filter.onError(panel.setError);

  TLF.store.subscribe((changed) => {
    if ("apiKey" in changed) filter.resetAuth();
    schedule(true);
  });
  panel.onResize((h) => {
    TLF.placement.setHeight(h);
    schedule();
  });

  function addedPosts(records) {
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (n.nodeType === 1 && (n.matches(POST) || n.querySelector(POST)))
          return true;
      }
    }
    return false;
  }

  // X mutates its DOM constantly; only new posts need to be handled right away.
  new MutationObserver((records) => schedule(addedPosts(records))).observe(
    document.body,
    {
      childList: true,
      subtree: true,
    },
  );
  addEventListener("resize", () => schedule());

  tick();
})();
