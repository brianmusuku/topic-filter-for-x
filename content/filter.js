// Classifies posts with Jev (one Noul per topic) and collapses the ones that don't match.
//
// Flow per post:  extract text -> ask Jev about each topic that hasn't been
// scored yet -> cache the probabilities -> show the post if ANY topic scores
// at or above the threshold.
//
// Because the raw probabilities are cached, moving the threshold slider is
// instant and costs no API calls.
(() => {
  const TLF = window.TLF;
  const store = TLF.store;

  const CONCURRENCY = 3;
  const MAX_ATTEMPTS = 3;
  const MAX_CACHE = 4000;
  const MAX_TEXT = 1500;
  // Posts without their own text (including bare images/videos) can't pass a
  // topic test. Flip to true to keep them visible instead.
  const SHOW_UNREADABLE = false;

  const TWEET = 'article[data-testid="tweet"]';
  const CELL = '[data-testid="cellInnerDiv"]';

  const scores = new Map(); // post key -> Map(topic -> probability)
  const seen = new Map(); // post key -> readable?  (for the counters)
  const queued = new Map(); // post key -> { info, article }
  const inflight = new Set();
  const failed = new Set();
  const opened = new Set(); // post keys the user chose to uncollapse
  const attempts = new Map();
  const infoOf = new WeakMap(); // <article> -> extracted info
  const listeners = { stats: new Set(), error: new Set() };

  let running = 0;
  let authError = false;
  let applied = false;
  let statsQueued = false;
  let rescan = () => {};
  let sessionFiltered = 0;
  let sessionCountRequested = false;
  const reportedFiltered = new Set();

  // ---- helpers ------------------------------------------------------------
  function routeOk() {
    const p = location.pathname;
    return (
      p === "/" ||
      p === "/home" ||
      p.startsWith("/search") ||
      p.startsWith("/explore") ||
      /^\/i\/lists\/\d+/.test(p)
    );
  }

  const isActive = () => {
    const s = store.state;
    return !!(
      s.enabled &&
      s.apiKey &&
      s.topics.length &&
      routeOk() &&
      !authError
    );
  };

  function ensureStyle() {
    if (document.getElementById("tlf-style")) return;
    const style = document.createElement("style");
    style.id = "tlf-style";
    // Keep X's tweet article and author row intact. Hide the post body,
    // attached media/cards and action bar, plus their immediate wrappers.
    style.textContent = [
      '[data-tlf="wait"]{display:none !important}',
      '[data-tlf="collapse"] article[data-testid="tweet"] [data-testid="socialContext"], [data-tlf="collapse"] article[data-testid="tweet"] [data-testid="promotedIndicator"]{display:none !important}',
      '[data-tlf="collapse"] article[data-testid="tweet"] [data-testid="tweetText"], [data-tlf="collapse"] article[data-testid="tweet"] div:has(> [data-testid="tweetText"]){display:none !important}',
      '[data-tlf="collapse"] article[data-testid="tweet"] [data-testid="reply"], [data-tlf="collapse"] article[data-testid="tweet"] div:has(> [data-testid="reply"]){display:none !important}',
      '[data-tlf="collapse"] article[data-testid="tweet"] [data-testid="placementTracking"]{display:none !important}',
      '[data-tlf="collapse"] article[data-testid="tweet"] [data-testid="tweetPhoto"], [data-tlf="collapse"] article[data-testid="tweet"] div:has(> [data-testid="tweetPhoto"]){display:none !important}',
      '[data-tlf="collapse"] article[data-testid="tweet"] [data-testid="videoComponent"], [data-tlf="collapse"] article[data-testid="tweet"] [data-testid="videoPlayer"], [data-tlf="collapse"] article[data-testid="tweet"] div:has(> [data-testid="videoPlayer"]){display:none !important}',
      '[data-tlf="collapse"] article[data-testid="tweet"] [data-testid="card.wrapper"], [data-tlf="collapse"] article[data-testid="tweet"] div:has(> [data-testid="card.wrapper"]), [data-tlf="collapse"] article[data-testid="tweet"] [data-testid="card.layoutLarge.media"], [data-tlf="collapse"] article[data-testid="tweet"] [data-testid="card.layoutSmall.media"]{display:none !important}',
      // div[role=link] is the quoted post. The verified/affiliation badge inside the author row is also a div[role=link]; leave it alone.
      '[data-tlf="collapse"] article[data-testid="tweet"] [data-testid="pollCard"], [data-tlf="collapse"] article[data-testid="tweet"] [data-testid="articlePreview"], [data-tlf="collapse"] article[data-testid="tweet"] div[role="link"]:not([data-testid="User-Name"] *){display:none !important}',
      '[data-tlf="collapse"] article[data-testid="tweet"] [role="group"], [data-tlf="collapse"] article[data-testid="tweet"] div:has(> [role="group"]){display:none !important}',
      '[data-tlf="collapse"] article[data-testid="tweet"] [data-testid="caret"]{display:none !important}',
      // Wrappers marked by setMediaCollapsed(). Never put this mark on an element that contains the author row.
      '[data-tlf="collapse"] article[data-testid="tweet"] [data-tlf-media]{display:none !important}',
      ".tlf-original-action{display:none !important}",
      // Tighten the virtualized cell while retaining the profile and author row.
      '[data-tlf="collapse"]{height:auto !important;min-height:0 !important;padding:0 !important;margin:0 !important}',
      '[data-tlf="collapse"] > div:first-child{border:0 !important;box-shadow:none !important}',
      '[data-tlf="collapse"] article[data-testid="tweet"]{padding-bottom:8px !important;border-bottom:1px solid color-mix(in srgb, currentColor 10%, transparent) !important;box-shadow:none !important}',
      ".tlf-reveal{display:inline-flex !important;align-items:center !important;padding:4px 8px !important;border:0 !important;border-radius:9999px !important;background:none !important;background-color:transparent !important;font:inherit !important;cursor:pointer !important;flex-shrink:0 !important;white-space:nowrap !important;margin:0 !important;align-self:center !important;position:static !important;transform:none !important}",
      ".tlf-reveal:hover{text-decoration:underline}",
      ".tlf-reveal:focus-visible{outline:2px solid currentColor;outline-offset:1px}",
    ].join("");
    document.head.appendChild(style);
  }

  const clean = (s) => s.replace(/\s+/g, " ").trim();
  const hash = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };

  // Text with emoji <img alt="..."> flattened back to characters.
  function readText(node) {
    let out = "";
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) out += c.nodeValue;
      else if (c.nodeType === 1)
        out += c.tagName === "IMG" ? c.getAttribute("alt") || "" : readText(c);
    });
    return out;
  }

  const statusId = (a) =>
    a
      .querySelector('a[href*="/status/"] time')
      ?.closest("a")
      ?.getAttribute("href")
      ?.match(/\/status\/(\d+)/)?.[1] ?? null;

  function extract(article, id) {
    const texts = [...article.querySelectorAll('[data-testid="tweetText"]')];
    const quotedEl = texts.find((t) => t.closest('[role="link"]'));
    const mainEl = texts.find(
      (t) => t !== quotedEl && !t.closest('[role="link"]'),
    );

    const text = mainEl ? clean(readText(mainEl)).slice(0, MAX_TEXT) : "";
    const quoted = quotedEl ? clean(readText(quotedEl)).slice(0, MAX_TEXT) : "";
    const handle =
      article
        .querySelector('[data-testid="User-Name"] a[href^="/"]')
        ?.getAttribute("href") ?? "";
    const authorRow = article.querySelector('[data-testid="User-Name"]');
    const authorReady = !!(
      authorRow?.textContent.trim() &&
      article.querySelector('[data-testid^="UserAvatar-Container-"]')
    );
    const alts = [
      ...article.querySelectorAll('[data-testid="tweetPhoto"] img[alt]'),
    ]
      .map((i) => clean(i.alt))
      .filter((a) => a && !/^(image|embedded video|video)$/i.test(a))
      .slice(0, 4);

    let payload = null;
    // Image alt text is useful context for a text post, but it must not make a
    // textless image/video post count as readable.
    if (text || quoted) {
      payload = { post: { author: handle.replace(/^\//, "@"), text } };
      if (quoted) payload.quoted_post = { text: quoted };
      if (alts.length) payload.image_descriptions = alts;
    }
    const key = id || `h${hash(handle + "|" + text + "|" + quoted)}`;
    return { key, id, payload, readable: !!(text || quoted), authorReady };
  }

  function getInfo(article) {
    const id = statusId(article);
    const cached = infoOf.get(article);
    if (cached && cached.payload && (!id || cached.id === id)) {
      const authorRow = article.querySelector('[data-testid="User-Name"]');
      cached.authorReady = !!(
        authorRow?.textContent.trim() &&
        article.querySelector('[data-testid^="UserAvatar-Container-"]')
      );
      return cached;
    }
    const info = extract(article, id);
    infoOf.set(article, info);
    return info;
  }

  const missingTopics = (key) => {
    const have = scores.get(key);
    return store.state.topics.filter((t) => !have || !have.has(t));
  };

  /** 'show' | 'hide' | 'wait' (still being classified) */
  function decide(key, readable) {
    if (!readable) return SHOW_UNREADABLE ? "show" : "hide";
    const have = scores.get(key);
    const min = store.state.threshold / 100;
    let waiting = false;
    for (const topic of store.state.topics) {
      const v = have?.get(topic);
      if (v === undefined) waiting = true;
      else if (v >= min) return "show";
    }
    if (waiting) return failed.has(key) ? "show" : "wait"; // fail open
    return "hide";
  }

  function clearAll() {
    if (!applied) return;
    document
      .querySelectorAll("[data-tlf]")
      .forEach((n) => n.removeAttribute("data-tlf"));
    document
      .querySelectorAll("[data-tlf-media]")
      .forEach((n) => n.removeAttribute("data-tlf-media"));
    document.querySelectorAll(".tlf-reveal").forEach((n) => n.remove());
    document
      .querySelectorAll(".tlf-original-action")
      .forEach((n) => n.classList.remove("tlf-original-action"));
    applied = false;
  }

  // ---- stats / errors -----------------------------------------------------
  function computeStats() {
    const active = isActive();
    const out = {
      active,
      routeOk: routeOk(),
      shown: 0,
      hidden: 0,
      filtered: sessionFiltered,
      waiting: 0,
      total: 0,
    };
    if (!active) return out;
    for (const [key, readable] of seen) {
      const d = decide(key, readable);
      out.total++;
      if (d === "show") out.shown++;
      else if (d === "hide") out.hidden++;
      else out.waiting++;
    }
    return out;
  }

  function emitStats() {
    if (statsQueued) return;
    statsQueued = true;
    requestAnimationFrame(() => {
      statsQueued = false;
      const s = computeStats();
      listeners.stats.forEach((fn) => fn(s));
    });
  }

  function setError(err) {
    listeners.error.forEach((fn) => fn(err));
  }

  // ---- classification queue ----------------------------------------------
  function enqueue(info, article) {
    if (inflight.has(info.key) || queued.has(info.key) || failed.has(info.key))
      return;
    queued.set(info.key, { info, article });
  }

  function takeNext() {
    for (const [key, item] of queued) {
      queued.delete(key);
      if (item.article.isConnected) return item;
    }
    return null;
  }

  function pump() {
    while (!authError && isActive() && running < CONCURRENCY) {
      const item = takeNext();
      if (!item) return;
      run(item);
    }
  }

  async function send(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch {
      return { ok: false, code: "extension" };
    }
  }

  async function run({ info, article }) {
    const topics = missingTopics(info.key);
    if (!topics.length) return rescan();

    running++;
    inflight.add(info.key);
    const res = await send({
      type: "tlf:classify",
      state: info.payload,
      topics,
    });
    running--;
    inflight.delete(info.key);

    if (res?.ok) {
      const have = scores.get(info.key) || new Map();
      for (const t of topics) have.set(t, res.scores[t] ?? 0);
      scores.set(info.key, have);
      if (scores.size > MAX_CACHE) scores.delete(scores.keys().next().value);
      attempts.delete(info.key);
      setError(null);
    } else if (res?.code === "no_key" || res?.code === "bad_key") {
      authError = true;
      setError({
        short: "Check your API key",
        long: "TypeSafe rejected that API key, so filtering is paused and your timeline is showing everything. Paste a valid key to resume.",
        blocking: true,
      });
    } else {
      const n = (attempts.get(info.key) || 0) + 1;
      attempts.set(info.key, n);
      if (n < MAX_ATTEMPTS) {
        setTimeout(() => {
          if (article.isConnected) queued.set(info.key, { info, article });
          rescan();
        }, 1500 * n);
      } else {
        failed.add(info.key);
        setError({
          short: "Some posts weren\u2019t checked",
          long:
            res?.code === "http"
              ? `TypeSafe returned an error (${res.status}). Posts that couldn\u2019t be checked are shown unfiltered.`
              : "Couldn\u2019t reach TypeSafe. Posts that couldn\u2019t be checked are shown unfiltered.",
          blocking: false,
        });
      }
    }
    rescan();
  }

  function revealButton(article, key) {
    const cell = article.closest(CELL) || article;
    let btn = [...cell.querySelectorAll(".tlf-reveal")].find(
      (n) => n.dataset.tlfKey === key,
    );
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tlf-reveal";
      const onToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.key;
        if (opened.has(id)) opened.delete(id);
        else opened.add(id);
        rescan();
      };
      btn.addEventListener("click", onToggle, true);
      btn.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
    }

    // Reuse X's Grok/"Explain this post" action slot. Keeping the toggle in
    // the header makes it feel like a native tweet action and avoids a loose
    // full-width control below the tweet.
    const original = article.querySelector(
      '[aria-label="Grok actions"], [aria-label*="Explain this post" i], [data-testid="caret"], [aria-label="More"], [aria-label="Share post"]',
    );
    const slot = original?.parentElement;
    if (original) original.classList.add("tlf-original-action");
    if (slot && btn.parentElement !== slot) {
      slot.append(btn);
    } else if (!slot && btn.parentElement !== cell) {
      try {
        cell.append(btn);
      } catch {
        article.append(btn);
      }
    }
    btn.dataset.key = key;
    btn.dataset.tlfKey = key;
    btn.style.color = `rgb(${TLF.theme.accent()})`;
    const fontSource =
      article.querySelector('[data-testid="tweetText"]') || article;
    const tweetFont = getComputedStyle(fontSource);
    btn.style.font = tweetFont.font;
    const open = opened.has(key);
    btn.textContent = open ? "Hide" : "Show";
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Collapse tweet" : "Show tweet");
  }

  // Things that make up a post's "attachment": photos, video, cards, polls,
  // article previews and quoted posts.
  const MEDIA_SELECTOR = [
    '[data-testid="tweetPhoto"]',
    '[data-testid="videoComponent"]',
    '[data-testid="videoPlayer"]',
    '[data-testid="card.wrapper"]',
    '[data-testid="pollCard"]',
    '[data-testid="articlePreview"]',
  ].join(",");

  // Parts of the post that must stay on screen while it is collapsed: the
  // post's own author row and avatar (not the ones inside a quoted post), and
  // our Show/Hide button.
  function protectedNodes(article) {
    const own = (sel) =>
      [...article.querySelectorAll(sel)].find(
        (n) => !n.closest('[role="link"]'),
      );
    return [
      own('[data-testid="User-Name"]'),
      own('[data-testid="Tweet-User-Avatar"]'),
      ...article.querySelectorAll(".tlf-reveal"),
    ].filter(Boolean);
  }

  // X wraps the whole post in one or two layout divs, so media is often nested
  // in the same ancestors as the author row. Hide the highest ancestor of each
  // attachment that does NOT contain anything we must keep, which removes the
  // attachment together with its spacing wrappers and nothing else.
  function mediaTargets(article) {
    const keep = protectedNodes(article);
    const targets = new Set();
    // Without a visible author row there is nothing safe to anchor on.
    if (!keep.length) return targets;
    const holdsKept = (el) => keep.some((k) => el.contains(k));

    const seeds = [...article.querySelectorAll(MEDIA_SELECTOR)];
    // A quoted post is a role="link" box that holds its own author row.
    for (const link of article.querySelectorAll('[role="link"]')) {
      if (
        !link.closest('[data-testid="User-Name"]') &&
        link.querySelector('[data-testid="User-Name"]')
      )
        seeds.push(link);
    }

    for (const seed of seeds) {
      if (holdsKept(seed)) continue;
      let el = seed;
      while (
        el.parentElement &&
        el.parentElement !== article &&
        !holdsKept(el.parentElement)
      )
        el = el.parentElement;
      targets.add(el);
    }
    // Drop targets nested inside another target.
    for (const t of [...targets]) {
      for (const other of targets) {
        if (other !== t && other.contains(t)) {
          targets.delete(t);
          break;
        }
      }
    }
    return targets;
  }

  function setMediaCollapsed(article, collapsed) {
    const want = collapsed ? mediaTargets(article) : new Set();
    for (const el of article.querySelectorAll("[data-tlf-media]")) {
      if (!want.has(el)) el.removeAttribute("data-tlf-media");
    }
    for (const el of want) {
      if (!el.hasAttribute("data-tlf-media"))
        el.setAttribute("data-tlf-media", "");
    }
  }

  function removeReveal(article) {
    const cell = article.closest(CELL) || article;
    for (const btn of cell.querySelectorAll(".tlf-reveal")) btn.remove();
    for (const original of cell.querySelectorAll(".tlf-original-action"))
      original.classList.remove("tlf-original-action");
  }

  // ---- main pass ----------------------------------------------------------
  function scan() {
    ensureStyle();
    if (!sessionCountRequested) {
      sessionCountRequested = true;
      send({ type: "tlf:get-filtered" }).then((res) => {
        if (res?.ok) {
          sessionFiltered = res.count;
          emitStats();
        }
      });
    }
    if (!isActive()) {
      queued.clear();
      clearAll();
      emitStats();
      return;
    }

    const currentKeys = new Set();
    const filteredNow = [];
    for (const article of document.querySelectorAll(TWEET)) {
      const info = getInfo(article);
      const readable = info.readable;
      currentKeys.add(info.key);
      seen.set(info.key, readable);

      const state = info.authorReady ? decide(info.key, readable) : "show";
      const cell = article.closest(CELL) || article;
      if (state === "hide") {
        if (!reportedFiltered.has(info.key)) {
          reportedFiltered.add(info.key);
          filteredNow.push(info.key);
        }
        revealButton(article, info.key);
        const mark = opened.has(info.key) ? "open" : "collapse";
        setMediaCollapsed(article, mark === "collapse");
        if (cell.getAttribute("data-tlf") !== mark)
          cell.setAttribute("data-tlf", mark);
      } else {
        removeReveal(article);
        setMediaCollapsed(article, false);
        if (state === "wait") {
          if (cell.getAttribute("data-tlf") !== "wait")
            cell.setAttribute("data-tlf", "wait");
        } else if (cell.hasAttribute("data-tlf")) {
          cell.removeAttribute("data-tlf");
        }
      }
      applied = true;

      if (state === "wait") enqueue(info, article);
    }
    if (filteredNow.length) {
      send({ type: "tlf:record-filtered", keys: filteredNow }).then((res) => {
        if (res?.ok) {
          sessionFiltered = res.count;
          emitStats();
        }
      });
    }
    // X virtualizes the timeline and removes tweets that have scrolled out of
    // the mounted DOM. Do not let those abandoned entries keep the spinner at
    // "Checking" forever.
    for (const key of seen.keys()) {
      if (!currentKeys.has(key)) seen.delete(key);
    }
    pump();
    emitStats();
  }

  TLF.createFilter = function createFilter({ onRescan }) {
    rescan = onRescan || (() => {});
    return {
      scan,
      onStats: (fn) => listeners.stats.add(fn),
      onError: (fn) => listeners.error.add(fn),
      /** Call when the API key changes: give everything a fresh start. */
      resetAuth() {
        authError = false;
        failed.clear();
        attempts.clear();
        setError(null);
      },
      /** Call on in-app navigation. */
      resetPage() {
        seen.clear();
        queued.clear();
        emitStats();
      },
    };
  };
})();
