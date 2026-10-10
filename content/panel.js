// The control component. Lives in a shadow root so X's CSS can't touch it and
// ours can't leak into X. Visual tokens mirror X's Light, Dim and Lights out themes.
(() => {
  const TLF = window.TLF;
  const store = TLF.store;
  const MAX_TOPICS = 10;
  const MAX_TOPIC_LENGTH = 140; // topics are short descriptions, not single words
  const THRESHOLD_MIN = 10;
  const THRESHOLD_MAX = 95;
  const THRESHOLD_STEP = 5;
  const SEGMENTS = 10;

  const ICON = {
    chevron:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.543 8.96l1.414-1.42L12 14.59l7.043-7.05 1.414 1.42L12 17.41 3.543 8.96z"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M1.9 12S5.6 5.5 12 5.5 22.1 12 22.1 12 18.4 18.5 12 18.5 1.9 12 1.9 12z"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    eyeOff:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M1.9 12S5.6 5.5 12 5.5 22.1 12 22.1 12 18.4 18.5 12 18.5 1.9 12 1.9 12z"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 3.5l17 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    hash: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></g></svg>',
    sliders:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="15" cy="8" r="2.5" fill="var(--bg)"/><circle cx="9" cy="16" r="2.5" fill="var(--bg)"/></g></svg>',
    key: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><line x1="11" y1="12" x2="21" y2="3"/><line x1="17" y1="7" x2="20" y2="10"/></g></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><line x1="12" y1="5" x2="12" y2="19"/></g></svg>',
  };

  const CSS = `
    :host {
      all: initial;
      display: block;
      font-family: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    /* Tokens: X's Light, Dim and Lights out themes. */
    :host, :host([data-theme="light"]) {
      --accent: 29 155 240;
      --bg: #ffffff; --border: #eff3f4; --text: #0f1419; --sub: #536471;
      --field: #eff3f4; --hover: rgba(15, 20, 25, 0.1);
      --btn: #0f1419; --btn-fg: #ffffff; --btn-hover: #272c30;
      --track: #cfd9de; --danger: #f4212e;
      --shadow: rgba(101, 119, 134, 0.2) 0 0 15px, rgba(101, 119, 134, 0.15) 0 0 3px 1px;
    }
    :host([data-theme="dark"]) {
      --bg: #000000; --border: #2f3336; --text: #e7e9ea; --sub: #71767b;
      --field: #202327; --hover: rgba(231, 233, 234, 0.1);
      --btn: #eff3f4; --btn-fg: #0f1419; --btn-hover: #d7dbdc; --track: #333639;
      --shadow: rgba(255, 255, 255, 0.2) 0 0 15px, rgba(255, 255, 255, 0.15) 0 0 3px 1px;
    }
    :host([data-theme="dim"]) {
      --bg: #15202b; --border: #38444d; --text: #f7f9f9; --sub: #8b98a5;
      --field: #1e2732; --hover: rgba(247, 249, 249, 0.1);
      --btn: #f7f9f9; --btn-fg: #0f1419; --btn-hover: #d7dbdc; --track: #38444d;
      --shadow: rgba(136, 153, 166, 0.2) 0 0 15px, rgba(136, 153, 166, 0.15) 0 0 3px 1px;
    }

    *, *::before, *::after { box-sizing: border-box; }
    [hidden] { display: none !important; }
    button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; }
    a { color: rgb(var(--accent)); text-decoration: none; }
    a:hover { text-decoration: underline; }
    /* No focus rings or blue borders while using the mouse or typing. A ring appears
       only after Tab is pressed, so keyboard users can still see where they are. */
    button, a, input, textarea, .meter { outline: none; }
    .kbd button:focus-visible, .kbd a:focus-visible, .kbd .meter:focus-visible {
      outline: 2px solid rgb(var(--accent)); outline-offset: 2px;
    }

    .card {
      display: flex; flex-direction: column; overflow: hidden;
      max-height: var(--max-h, none);
      background: var(--bg); color: var(--text);
      border: 1px solid var(--border); border-radius: 16px;
      font: 400 15px/20px inherit;
      -webkit-font-smoothing: antialiased;
      transition: box-shadow 0.15s ease;
    }
    /* Header */
    .head { display: flex; align-items: center; gap: 4px; padding: 8px 16px 10px; flex: none; }
    .heading { flex: 1; min-width: 0; text-align: left; border-radius: 8px; }
    .title { display: block; font-size: 20px; line-height: 24px; font-weight: 800; letter-spacing: -0.01em; }
    .summary {
      margin-top: 2px; font-size: 13px; line-height: 16px; color: var(--sub);
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
      overflow-wrap: anywhere;
    }
    .summary.error { color: var(--danger); }

    .icon-btn {
      flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 50%; color: var(--sub);
      transition: background-color 0.15s ease;
    }
    .icon-btn:hover { background: var(--hover); }
    .icon-btn svg { width: 20px; height: 20px; }
    .chevron svg { transition: transform 0.2s ease; }
    .open .chevron svg { transform: rotate(180deg); }

    .switch {
      position: relative; flex: none; width: 42px; height: 24px; margin-left: 4px;
      border-radius: 999px; background: var(--track); transition: background-color 0.15s ease;
    }
    .switch::after {
      content: ""; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%;
      background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); transition: transform 0.15s ease;
    }
    .switch[aria-checked="true"] { background: rgb(var(--accent)); }
    .switch[aria-checked="true"]::after { transform: translateX(18px); }

    /* Body (animated open/close) */
    .body-wrap { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.2s ease; min-height: 0; }
    .open .body-wrap { grid-template-rows: 1fr; }
    .body-clip { min-height: 0; overflow: hidden; }
    .body {
      display: flex; flex-direction: column; padding: 0 16px;
      overflow-y: auto; max-height: calc(var(--max-h, 9999px) - 66px);
      scrollbar-width: thin;
    }

    /* Sections: icon badge + heading, separated by hairlines */
    .sec { display: flex; flex-direction: column; gap: 8px; padding: 12px 0; border-top: 1px solid var(--border); }
    .sec-head { display: flex; align-items: center; gap: 10px; min-height: 28px; }
    .ico {
      flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 50%; background: var(--field); color: var(--text);
    }
    .ico svg { width: 14px; height: 14px; }
    .label { flex: 1; min-width: 0; font-size: 15px; line-height: 20px; font-weight: 700; }
    .count { font-size: 13px; line-height: 16px; color: var(--sub); }
    .value { font-size: 15px; font-weight: 700; color: rgb(var(--accent)); font-variant-numeric: tabular-nums; }
    .hint { margin: 0; font-size: 13px; line-height: 16px; color: var(--sub); }
    .hint.error { color: var(--danger); }

    /* Pill field, the same shape as X's search box */
    .field {
      display: flex; align-items: center; gap: 6px; height: 40px; padding: 0 3px 0 16px;
      border: 1px solid transparent; border-radius: 999px; background: var(--field);
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }
    .field input {
      flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent;
      color: var(--text); font: inherit;
    }
    .field input::placeholder { color: var(--sub); }

    .btn {
      flex: none; height: 28px; padding: 0 14px; border-radius: 999px;
      background: rgb(var(--accent)); color: #fff; font-size: 14px; font-weight: 700;
      transition: filter 0.15s ease, opacity 0.15s ease;
    }
    .btn:hover:not(:disabled) { filter: brightness(0.92); }
    .btn:disabled { opacity: 0.5; cursor: default; }

    /* Topics: one joined container (scrolling list + add row) */
    .list { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--bg); }
    .scrollwrap { position: relative; }
    .scroll {
      list-style: none; margin: 0; padding: 0; max-height: 144px; overflow-y: auto;
      scrollbar-width: thin; scrollbar-color: var(--track) transparent;
    }
    .scroll::-webkit-scrollbar { width: 10px; }
    .scroll::-webkit-scrollbar-track { background: transparent; margin: 6px 0; }
    .scroll::-webkit-scrollbar-thumb {
      background: var(--track); border-radius: 5px; border: 3px solid var(--bg); background-clip: padding-box;
    }
    .scroll::-webkit-scrollbar-thumb:hover { background: var(--sub); background-clip: padding-box; }
    .fade {
      position: absolute; left: 0; right: 10px; bottom: 0; height: 28px; pointer-events: none;
      background: linear-gradient(to bottom, transparent, var(--bg)); opacity: 0; transition: opacity 0.15s ease;
    }
    .scrollwrap.more .fade { opacity: 1; }

    .row { display: flex; align-items: flex-start; gap: 8px; padding: 0 4px 0 14px; border-bottom: 1px solid var(--border); }
    .row:last-child { border-bottom: 0; }
    .tn {
      flex: 1; min-width: 0; padding: 8px 0; font-size: 14px; line-height: 20px; overflow-wrap: anywhere;
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
    }
    .row button {
      flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; margin-top: 4px; border-radius: 50%; color: var(--sub);
      transition: background-color 0.15s ease;
    }
    .row button:hover { background: var(--hover); }
    .row button svg { width: 14px; height: 14px; }

    .addrow {
      display: flex; align-items: center; gap: 8px; padding: 3px 4px 3px 12px;
      border-top: 1px solid var(--border); background: var(--field);
      background: color-mix(in srgb, var(--field) 55%, transparent);
    }
    .scrollwrap[hidden] + .addrow { border-top: 0; }
    .addrow > svg { flex: none; width: 16px; height: 16px; color: var(--sub); }
    .addrow textarea {
      flex: 1; min-width: 0; height: 32px; max-height: 76px; padding: 6px 0; border: 0; outline: 0;
      resize: none; background: transparent; color: var(--text); font: inherit; font-size: 14px; line-height: 20px;
    }
    .addrow textarea::placeholder { color: var(--sub); }

    /* Match strength: ten tappable blocks (one slider for assistive tech) */
    .meter { display: flex; gap: 4px; border-radius: 8px; cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; }
    .seg { flex: 1; height: 24px; display: flex; align-items: center; }
    .seg i {
      display: block; width: 100%; height: 10px; border-radius: 5px;
      background: linear-gradient(to right, rgb(var(--accent)) var(--fill, 0%), var(--field) var(--fill, 0%));
    }
    .scale { display: flex; justify-content: space-between; margin-top: -2px; font-size: 13px; line-height: 16px; color: var(--sub); }

    /* Alerts and status */
    .alert {
      margin: 0 0 4px; padding: 12px; border-radius: 12px; font-size: 14px; line-height: 18px;
      background: rgba(244, 33, 46, 0.1); color: var(--danger);
    }
    .foot {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px;
      padding: 10px 0 12px; border-top: 1px solid var(--border);
      font-size: 13px; line-height: 16px; color: var(--sub);
    }
    .stats { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px 12px; }
    .foot.is-busy .stats { display: none; }
    .foot b { font-size: 14px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
    .dot { width: 4px; height: 4px; border-radius: 50%; background: var(--track); }
    .busy { display: inline-flex; align-items: center; gap: 8px; }
    .spinner {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid var(--track); border-top-color: rgb(var(--accent));
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { transition-duration: 0.01ms !important; }
    }
  `;

  const HTML = `
    <div class="card" id="card">
      <div class="head">
        <button type="button" class="heading" id="heading" aria-expanded="false" aria-controls="body">
          <span class="title">Topic filter</span>
          <span class="summary" id="summary"></span>
        </button>
        <button type="button" class="icon-btn chevron" id="chevron" aria-expanded="false" aria-controls="body" aria-label="Show settings">${ICON.chevron}</button>
        <button type="button" class="switch" id="switch" role="switch" aria-checked="false" aria-label="Filter my timeline"></button>
      </div>

      <div class="body-wrap" id="bodyWrap">
        <div class="body-clip">
          <div class="body" id="body">
            <p class="alert" id="alert" role="alert" hidden></p>

            <section class="sec">
              <div class="sec-head">
                <label class="label" for="topicInput">Show posts about</label>
                <span class="count" id="topicCount"></span>
              </div>
              <div class="list">
                <div class="scrollwrap" id="scrollWrap" hidden>
                  <ul class="scroll" id="topicList" aria-label="Your topics"></ul>
                  <div class="fade" aria-hidden="true"></div>
                </div>
                <form class="addrow" id="topicForm" autocomplete="off">
                  ${ICON.plus}
                  <textarea id="topicInput" rows="1" maxlength="${MAX_TOPIC_LENGTH}" placeholder="Add a topic" spellcheck="false"></textarea>
                  <button type="submit" class="btn" id="addBtn" disabled>Add</button>
                </form>
              </div>
              <p class="hint" id="topicHint"></p>
            </section>

            <section class="sec">
              <div class="sec-head">
                <span class="label" id="strengthLabel">Match strength</span>
                <span class="value" id="thresholdValue"></span>
              </div>
              <div class="meter" id="meter" role="slider" tabindex="0" aria-labelledby="strengthLabel"
                   aria-valuemin="${THRESHOLD_MIN}" aria-valuemax="${THRESHOLD_MAX}" aria-valuenow="60" aria-valuetext="60%"></div>
              <div class="scale" aria-hidden="true"><span>Looser</span><span>Stricter</span></div>
            </section>

            <section class="sec">
              <div class="sec-head">
                <label class="label" for="keyInput">TypeSafe API key</label>
              </div>
              <div class="field">
                <input id="keyInput" type="password" placeholder="Paste your key" autocomplete="off" autocapitalize="off" spellcheck="false" />
                <button type="button" class="icon-btn" id="eyeBtn" aria-label="Show API key" aria-pressed="false">${ICON.eye}</button>
              </div>
              <p class="hint">Saved in this browser only. <a href="https://console.typesafe.ai/keys" target="_blank" rel="noopener noreferrer">Get a key</a></p>
            </section>

            <div class="foot" id="foot" hidden aria-live="polite">
              <span class="stats">
                <span><b id="sessionNum"></b> filtered this session</span>
                <span class="dot" id="totalDot" aria-hidden="true" hidden></span>
                <span id="totalStat" hidden><b id="totalNum"></b> total</span>
              </span>
              <span class="busy" id="busy" hidden><span class="spinner"></span><span id="busyText"></span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  function createPanel() {
    const host = document.createElement("div");
    host.id = "tlf-host";
    host.style.cssText =
      "position:absolute;left:0;top:0;width:0;z-index:1000;display:none;margin:0;padding:0;border:0;pointer-events:auto;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS}</style>${HTML}`;

    const $ = (id) => root.getElementById(id);
    const el = {
      card: $("card"),
      heading: $("heading"),
      chevron: $("chevron"),
      summary: $("summary"),
      sw: $("switch"),
      alert: $("alert"),
      form: $("topicForm"),
      topicInput: $("topicInput"),
      addBtn: $("addBtn"),
      scrollWrap: $("scrollWrap"),
      topicList: $("topicList"),
      topicCount: $("topicCount"),
      topicHint: $("topicHint"),
      meter: $("meter"),
      thresholdValue: $("thresholdValue"),
      keyInput: $("keyInput"),
      eyeBtn: $("eyeBtn"),
      foot: $("foot"),
      sessionNum: $("sessionNum"),
      totalDot: $("totalDot"),
      totalStat: $("totalStat"),
      totalNum: $("totalNum"),
      busy: $("busy"),
      busyText: $("busyText"),
      bodyWrap: $("bodyWrap"),
    };

    // Keep keystrokes away from X's global keyboard shortcuts (j, k, n, ...).
    ["keydown", "keyup", "keypress"].forEach((t) =>
      root.addEventListener(t, (e) => e.stopPropagation()),
    );
    // Show keyboard focus rings only after Tab; hide them again on any pointer use.
    root.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Tab") el.card.classList.add("kbd");
      },
      true,
    );
    root.addEventListener(
      "pointerdown",
      () => el.card.classList.remove("kbd"),
      true,
    );

    let stats = {
      active: false,
      routeOk: true,
      shown: 0,
      hidden: 0,
      filtered: 0,
      filteredTotal: null,
      waiting: 0,
      total: 0,
    };
    let errorMessage = null;
    let hintOverride = null;
    let resizeCb = () => {};
    let renderedTopics = null; // JSON of the topics currently in the DOM

    // Ten blocks, built once; render() only toggles which are filled.
    const segs = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const seg = document.createElement("div");
      seg.className = "seg";
      seg.setAttribute("aria-hidden", "true");
      seg.append(document.createElement("i"));
      el.meter.append(seg);
      segs.push(seg);
    }

    // Show the bottom fade only while more topics are hidden below.
    function updateFade() {
      const list = el.topicList;
      const more = list.scrollHeight - list.scrollTop - list.clientHeight > 2;
      el.scrollWrap.classList.toggle("more", more);
    }
    el.topicList.addEventListener("scroll", updateFade, { passive: true });

    new ResizeObserver(() => {
      updateFade();
      resizeCb(el.card.getBoundingClientRect().height);
    }).observe(el.card);

    // ---- rendering --------------------------------------------------------
    function summaryLine(s) {
      if (errorMessage) return { text: errorMessage.short, error: true };
      if (!s.apiKey) return { text: "Add your API key to start" };
      if (!s.topics.length) return { text: "Add a topic to start" };
      if (!s.enabled) return { text: "Off" };
      if (!stats.routeOk) return { text: "Not filtering on this page" };
      const n = s.topics.length;
      return { text: `Active \u00b7 ${n} ${n === 1 ? "topic" : "topics"}` };
    }

    function renderTopics(topics) {
      const key = JSON.stringify(topics);
      if (key === renderedTopics) return;
      const grew =
        renderedTopics !== null &&
        topics.length > JSON.parse(renderedTopics).length;
      const prevTop = el.topicList.scrollTop;
      renderedTopics = key;

      el.topicList.textContent = "";
      for (const topic of topics) {
        const li = document.createElement("li");
        li.className = "row";
        const text = document.createElement("span");
        text.className = "tn";
        text.textContent = topic;
        text.title = topic; // full text when the row is clamped to two lines
        const rm = document.createElement("button");
        rm.type = "button";
        rm.innerHTML = ICON.close;
        rm.setAttribute("aria-label", `Remove topic: ${topic}`);
        rm.addEventListener("click", () =>
          store.set({ topics: store.state.topics.filter((t) => t !== topic) }),
        );
        li.append(text, rm);
        el.topicList.append(li);
      }
      el.scrollWrap.hidden = !topics.length;
      // Keep the scroll position across re-renders; jump to the end after an add.
      el.topicList.scrollTop = grew ? el.topicList.scrollHeight : prevTop;
      updateFade();
    }

    function autosize() {
      const ta = el.topicInput;
      ta.style.height = "32px";
      ta.style.height = `${Math.min(ta.scrollHeight, 76)}px`;
    }

    function render() {
      const s = store.state;
      el.card.classList.toggle("open", s.expanded);
      el.heading.setAttribute("aria-expanded", String(s.expanded));
      el.chevron.setAttribute("aria-expanded", String(s.expanded));
      el.chevron.setAttribute(
        "aria-label",
        s.expanded ? "Hide settings" : "Show settings",
      );
      el.bodyWrap.toggleAttribute("inert", !s.expanded);

      el.sw.setAttribute("aria-checked", String(s.enabled));

      const sum = summaryLine(s);
      el.summary.textContent = sum.text;
      el.summary.classList.toggle("error", !!sum.error);

      el.alert.hidden = !errorMessage;
      if (errorMessage) el.alert.textContent = errorMessage.long;

      // Topics
      renderTopics(s.topics);
      const n = s.topics.length;
      el.topicCount.textContent = n
        ? `${n} ${n === 1 ? "topic" : "topics"}`
        : "";
      el.addBtn.disabled = !el.topicInput.value.trim();
      if (hintOverride) {
        el.topicHint.textContent = hintOverride;
        el.topicHint.classList.add("error");
      } else {
        el.topicHint.classList.remove("error");
        el.topicHint.textContent = n
          ? "Posts that match any of these topics stay in your timeline."
          : 'Be specific: "Formula 1 race results" works better than "sports".';
      }

      // Match strength
      // Each block is 10%, so a 5% step fills half of a block.
      segs.forEach((seg, i) =>
        seg.style.setProperty(
          "--fill",
          `${clamp(s.threshold / 10 - i, 0, 1) * 100}%`,
        ),
      );
      el.meter.setAttribute("aria-valuenow", String(s.threshold));
      el.meter.setAttribute("aria-valuetext", `${s.threshold}%`);
      el.thresholdValue.textContent = `${s.threshold}%`;

      // API key (don't fight the user while they type)
      if (root.activeElement !== el.keyInput && el.keyInput.value !== s.apiKey)
        el.keyInput.value = s.apiKey;

      // Footer: session count and all-time total (blank until the total has loaded)
      const live =
        s.enabled &&
        s.apiKey &&
        s.topics.length &&
        stats.routeOk &&
        !errorMessage?.blocking;
      el.foot.hidden = !live;
      if (live) {
        el.sessionNum.textContent = (
          stats.filtered ?? stats.hidden
        ).toLocaleString();
        const hasTotal = typeof stats.filteredTotal === "number";
        el.totalDot.hidden = !hasTotal;
        el.totalStat.hidden = !hasTotal;
        if (hasTotal)
          el.totalNum.textContent = stats.filteredTotal.toLocaleString();
        el.busy.hidden = stats.waiting === 0;
        el.foot.classList.toggle("is-busy", !el.busy.hidden);
        el.busyText.textContent = `Checking ${stats.waiting}`;
      }
      updateFade();
    }

    // ---- events -----------------------------------------------------------
    const toggleOpen = () => store.set({ expanded: !store.state.expanded });
    el.heading.addEventListener("click", toggleOpen);
    el.chevron.addEventListener("click", toggleOpen);

    el.sw.addEventListener("click", () => {
      const on = !store.state.enabled;
      store.set({ enabled: on });
      if (on && !store.state.apiKey) {
        store.set({ expanded: true });
        setTimeout(() => el.keyInput.focus(), 220);
      }
    });

    el.topicInput.addEventListener("input", () => {
      // Topics are single-line text, even when pasted.
      if (/[\r\n]/.test(el.topicInput.value))
        el.topicInput.value = el.topicInput.value.replace(
          /\s*[\r\n]+\s*/g,
          " ",
        );
      hintOverride = null;
      autosize();
      render();
    });
    el.topicInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        el.form.requestSubmit();
      }
    });
    el.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const topic = el.topicInput.value.replace(/\s+/g, " ").trim();
      if (!topic) return;
      const topics = store.state.topics;
      if (topics.some((t) => t.toLowerCase() === topic.toLowerCase())) {
        hintOverride = "That topic is already on your list.";
      } else if (topics.length >= MAX_TOPICS) {
        hintOverride = `You can add up to ${MAX_TOPICS} topics.`;
      } else {
        hintOverride = null;
        el.topicInput.value = "";
        autosize();
        store.set({ topics: [...topics, topic] });
      }
      render();
    });

    // Match strength: click or drag across the blocks (5% steps); arrow keys nudge by 5.
    const valueAt = (clientX) => {
      const r = el.meter.getBoundingClientRect();
      const frac = r.width ? (clientX - r.left) / r.width : 0;
      const stepped =
        Math.round((frac * 100) / THRESHOLD_STEP) * THRESHOLD_STEP;
      return clamp(stepped, THRESHOLD_MIN, THRESHOLD_MAX);
    };
    let dragging = false;
    el.meter.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      el.meter.setPointerCapture(e.pointerId);
      el.meter.focus({ preventScroll: true });
      store.set({ threshold: valueAt(e.clientX) }, { persist: false });
    });
    el.meter.addEventListener("pointermove", (e) => {
      if (dragging)
        store.set({ threshold: valueAt(e.clientX) }, { persist: false });
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      store.set({ threshold: store.state.threshold }); // persist the final value
    };
    el.meter.addEventListener("pointerup", endDrag);
    el.meter.addEventListener("pointercancel", endDrag);
    el.meter.addEventListener("keydown", (e) => {
      const t = store.state.threshold;
      let next = null;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown")
        next = t - THRESHOLD_STEP;
      else if (e.key === "ArrowRight" || e.key === "ArrowUp")
        next = t + THRESHOLD_STEP;
      else if (e.key === "Home") next = THRESHOLD_MIN;
      else if (e.key === "End") next = THRESHOLD_MAX;
      if (next === null) return;
      e.preventDefault();
      store.set({ threshold: clamp(next, THRESHOLD_MIN, THRESHOLD_MAX) });
    });

    let keyTimer;
    const saveKey = () => {
      clearTimeout(keyTimer);
      store.set({ apiKey: el.keyInput.value.trim() });
    };
    el.keyInput.addEventListener("input", () => {
      clearTimeout(keyTimer);
      keyTimer = setTimeout(saveKey, 500);
    });
    el.keyInput.addEventListener("change", saveKey);
    el.keyInput.addEventListener("blur", saveKey);

    el.eyeBtn.addEventListener("click", () => {
      const show = el.keyInput.type === "password";
      el.keyInput.type = show ? "text" : "password";
      el.eyeBtn.innerHTML = show ? ICON.eyeOff : ICON.eye;
      el.eyeBtn.setAttribute("aria-pressed", String(show));
      el.eyeBtn.setAttribute(
        "aria-label",
        show ? "Hide API key" : "Show API key",
      );
    });

    store.subscribe(render);
    render();

    return {
      host,
      render,
      onResize(fn) {
        resizeCb = fn;
      },
      setStats(next) {
        stats = next;
        render();
      },
      /** error: { short, long, blocking } | null */
      setError(next) {
        errorMessage = next;
        render();
      },
    };
  }

  TLF.createPanel = createPanel;
})();
