// The control component. Lives in a shadow root so X's CSS can't touch it and
// ours can't leak into X. Visual tokens mirror X's Light, Dim and Lights out themes.
(() => {
  const TLF = window.TLF;
  const store = TLF.store;
  const MAX_TOPICS = 10;
  const MAX_TOPIC_LENGTH = 80;

  const ICON = {
    chevron:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.543 8.96l1.414-1.42L12 14.59l7.043-7.05 1.414 1.42L12 17.41 3.543 8.96z"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"/></svg>',
    eye:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M1.9 12S5.6 5.5 12 5.5 22.1 12 22.1 12 18.4 18.5 12 18.5 1.9 12 1.9 12z"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    eyeOff:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M1.9 12S5.6 5.5 12 5.5 22.1 12 22.1 12 18.4 18.5 12 18.5 1.9 12 1.9 12z"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 3.5l17 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
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
    button:focus-visible, a:focus-visible, input[type="range"]:focus-visible {
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
    .head { display: flex; align-items: center; gap: 4px; padding: 12px 16px; flex: none; }
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
      display: flex; flex-direction: column; gap: 20px; padding: 4px 16px 16px;
      overflow-y: auto; max-height: calc(var(--max-h, 9999px) - 66px);
      scrollbar-width: thin;
    }
    .group { display: flex; flex-direction: column; gap: 8px; }
    .label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .label { font-size: 15px; line-height: 20px; font-weight: 700; }
    .value { font-size: 15px; font-weight: 700; color: rgb(var(--accent)); font-variant-numeric: tabular-nums; }
    .hint { margin: 0; font-size: 13px; line-height: 16px; color: var(--sub); }
    .hint.error { color: var(--danger); }

    /* Pill field, the same shape as X's search box */
    .field {
      display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 5px 0 16px;
      border: 1px solid transparent; border-radius: 999px; background: var(--field);
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }
    .field:focus-within { background: var(--bg); border-color: rgb(var(--accent)); }
    .field input {
      flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent;
      color: var(--text); font: inherit;
    }
    .field input::placeholder { color: var(--sub); }

    .btn {
      flex: none; height: 32px; padding: 0 16px; border-radius: 999px;
      background: var(--btn); color: var(--btn-fg); font-size: 14px; font-weight: 700;
      transition: background-color 0.15s ease, opacity 0.15s ease;
    }
    .btn:hover:not(:disabled) { background: var(--btn-hover); }
    .btn:disabled { opacity: 0.5; cursor: default; }

    /* Topic chips */
    .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      display: inline-flex; align-items: center; max-width: 100%; height: 32px; padding: 0 4px 0 12px;
      border-radius: 999px; background: rgb(var(--accent) / 0.1); color: rgb(var(--accent));
      font-size: 14px; font-weight: 700;
    }
    .chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip button {
      flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; margin-left: 2px; border-radius: 50%;
      transition: background-color 0.15s ease;
    }
    .chip button:hover { background: rgb(var(--accent) / 0.2); }
    .chip button svg { width: 14px; height: 14px; }

    /* Slider */
    input[type="range"] {
      --pct: 50%;
      -webkit-appearance: none; appearance: none; width: 100%; height: 22px; margin: 0;
      background: transparent; cursor: pointer;
    }
    input[type="range"]::-webkit-slider-runnable-track {
      height: 4px; border-radius: 2px;
      background: linear-gradient(to right, rgb(var(--accent)) var(--pct), var(--track) var(--pct));
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; width: 18px; height: 18px; margin-top: -7px; border-radius: 50%;
      background: rgb(var(--accent)); border: 0; box-shadow: 0 0 0 0 rgb(var(--accent) / 0.2);
      transition: box-shadow 0.15s ease;
    }
    input[type="range"]:hover::-webkit-slider-thumb,
    input[type="range"]:active::-webkit-slider-thumb { box-shadow: 0 0 0 8px rgb(var(--accent) / 0.2); }
    input[type="range"]::-moz-range-track { height: 4px; border-radius: 2px; background: var(--track); }
    input[type="range"]::-moz-range-progress { height: 4px; border-radius: 2px; background: rgb(var(--accent)); }
    input[type="range"]::-moz-range-thumb { width: 18px; height: 18px; border: 0; border-radius: 50%; background: rgb(var(--accent)); }
    .scale { display: flex; justify-content: space-between; font-size: 13px; line-height: 16px; color: var(--sub); }

    /* Alerts and status */
    .alert {
      margin: 0; padding: 12px; border-radius: 12px; font-size: 14px; line-height: 18px;
      background: rgba(244, 33, 46, 0.1); color: var(--danger);
    }
    .foot {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding-top: 12px; margin-top: -4px; border-top: 1px solid var(--border);
      font-size: 13px; line-height: 16px; color: var(--sub);
    }
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

            <div class="group">
              <label class="label" for="topicInput">Show posts about</label>
              <form class="field" id="topicForm" autocomplete="off">
                <input id="topicInput" type="text" maxlength="${MAX_TOPIC_LENGTH}" placeholder="Add a topic" spellcheck="false" />
                <button type="submit" class="btn" id="addBtn" disabled>Add</button>
              </form>
              <ul class="chips" id="chips" aria-label="Your topics"></ul>
              <p class="hint" id="topicHint"></p>
            </div>

            <div class="group">
              <div class="label-row">
                <label class="label" for="threshold">Match strength</label>
                <span class="value" id="thresholdValue"></span>
              </div>
              <input id="threshold" type="range" min="10" max="95" step="5" />
              <div class="scale"><span>Looser</span><span>Stricter</span></div>
            </div>

            <div class="group">
              <label class="label" for="keyInput">TypeSafe API key</label>
              <div class="field">
                <input id="keyInput" type="password" placeholder="Paste your key" autocomplete="off" autocapitalize="off" spellcheck="false" />
                <button type="button" class="icon-btn" id="eyeBtn" aria-label="Show API key" aria-pressed="false">${ICON.eye}</button>
              </div>
              <p class="hint">Saved in this browser only. <a href="https://console.typesafe.ai/keys" target="_blank" rel="noopener noreferrer">Get a key</a></p>
            </div>

            <div class="foot" id="foot" hidden aria-live="polite">
              <span id="footText"></span>
              <span class="busy" id="busy" hidden><span class="spinner"></span><span id="busyText"></span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  function createPanel() {
    const host = document.createElement('div');
    host.id = 'tlf-host';
    host.style.cssText = 'position:absolute;left:0;top:0;width:0;z-index:1000;display:none;margin:0;padding:0;border:0;pointer-events:auto;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style>${HTML}`;

    const $ = (id) => root.getElementById(id);
    const el = {
      card: $('card'), heading: $('heading'), chevron: $('chevron'), summary: $('summary'), sw: $('switch'),
      alert: $('alert'), form: $('topicForm'), topicInput: $('topicInput'), addBtn: $('addBtn'),
      chips: $('chips'), topicHint: $('topicHint'), threshold: $('threshold'), thresholdValue: $('thresholdValue'),
      keyInput: $('keyInput'), eyeBtn: $('eyeBtn'), foot: $('foot'), footText: $('footText'),
      busy: $('busy'), busyText: $('busyText'), bodyWrap: $('bodyWrap'),
    };

    // Keep keystrokes away from X's global keyboard shortcuts (j, k, n, ...).
    ['keydown', 'keyup', 'keypress'].forEach((t) => root.addEventListener(t, (e) => e.stopPropagation()));

    let stats = { active: false, routeOk: true, shown: 0, hidden: 0, filtered: 0, waiting: 0, total: 0 };
    let errorMessage = null;
    let hintOverride = null;
    let resizeCb = () => {};

    new ResizeObserver(() => resizeCb(el.card.getBoundingClientRect().height)).observe(el.card);

    // ---- rendering --------------------------------------------------------
    function summaryLine(s) {
      if (errorMessage) return { text: errorMessage.short, error: true };
      if (!s.apiKey) return { text: 'Add your API key to start' };
      if (!s.topics.length) return { text: 'Add a topic to start' };
      if (!s.enabled) return { text: 'Off' };
      if (!stats.routeOk) return { text: 'Not filtering on this page' };
      return { text: filteredLine() };
    }

    function filteredLine() {
      const n = stats.filtered ?? stats.hidden;
      return `${n} ${n === 1 ? 'tweet' : 'tweets'} filtered`;
    }

    function render() {
      const s = store.state;
      el.card.classList.toggle('open', s.expanded);
      el.heading.setAttribute('aria-expanded', String(s.expanded));
      el.chevron.setAttribute('aria-expanded', String(s.expanded));
      el.chevron.setAttribute('aria-label', s.expanded ? 'Hide settings' : 'Show settings');
      el.bodyWrap.toggleAttribute('inert', !s.expanded);

      el.sw.setAttribute('aria-checked', String(s.enabled));

      const sum = summaryLine(s);
      el.summary.textContent = sum.text;
      el.summary.classList.toggle('error', !!sum.error);

      el.alert.hidden = !errorMessage;
      if (errorMessage) el.alert.textContent = errorMessage.long;

      // Topics
      el.chips.textContent = '';
      for (const topic of s.topics) {
        const li = document.createElement('li');
        li.className = 'chip';
        const label = document.createElement('span');
        label.textContent = topic;
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.innerHTML = ICON.close;
        rm.setAttribute('aria-label', `Remove ${topic}`);
        rm.addEventListener('click', () => store.set({ topics: store.state.topics.filter((t) => t !== topic) }));
        li.append(label, rm);
        el.chips.append(li);
      }
      el.addBtn.disabled = !el.topicInput.value.trim();
      if (hintOverride) {
        el.topicHint.textContent = hintOverride;
        el.topicHint.classList.add('error');
      } else {
        el.topicHint.classList.remove('error');
        el.topicHint.textContent = s.topics.length
          ? 'Posts that match any of these topics stay in your timeline.'
          : 'Be specific: "Formula 1 race results" works better than "sports".';
      }

      // Threshold
      const pct = ((s.threshold - 10) / (95 - 10)) * 100;
      el.threshold.value = String(s.threshold);
      el.threshold.style.setProperty('--pct', `${pct}%`);
      el.thresholdValue.textContent = `${s.threshold}%`;

      // API key (don't fight the user while they type)
      if (root.activeElement !== el.keyInput && el.keyInput.value !== s.apiKey) el.keyInput.value = s.apiKey;

      // Footer
      const live = s.enabled && s.apiKey && s.topics.length && stats.routeOk && !errorMessage?.blocking;
      el.foot.hidden = !live;
      if (live) {
        el.footText.textContent = filteredLine();
        el.busy.hidden = stats.waiting === 0;
        el.busyText.textContent = `Checking ${stats.waiting}`;
      }
    }

    // ---- events -----------------------------------------------------------
    const toggleOpen = () => store.set({ expanded: !store.state.expanded });
    el.heading.addEventListener('click', toggleOpen);
    el.chevron.addEventListener('click', toggleOpen);

    el.sw.addEventListener('click', () => {
      const on = !store.state.enabled;
      store.set({ enabled: on });
      if (on && !store.state.apiKey) {
        store.set({ expanded: true });
        setTimeout(() => el.keyInput.focus(), 220);
      }
    });

    el.topicInput.addEventListener('input', () => {
      hintOverride = null;
      render();
    });
    el.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const topic = el.topicInput.value.replace(/\s+/g, ' ').trim();
      if (!topic) return;
      const topics = store.state.topics;
      if (topics.some((t) => t.toLowerCase() === topic.toLowerCase())) {
        hintOverride = 'That topic is already on your list.';
      } else if (topics.length >= MAX_TOPICS) {
        hintOverride = `You can add up to ${MAX_TOPICS} topics.`;
      } else {
        hintOverride = null;
        el.topicInput.value = '';
        store.set({ topics: [...topics, topic] });
      }
      render();
    });

    el.threshold.addEventListener('input', () => store.set({ threshold: Number(el.threshold.value) }, { persist: false }));
    el.threshold.addEventListener('change', () => store.set({ threshold: Number(el.threshold.value) }));

    let keyTimer;
    const saveKey = () => {
      clearTimeout(keyTimer);
      store.set({ apiKey: el.keyInput.value.trim() });
    };
    el.keyInput.addEventListener('input', () => {
      clearTimeout(keyTimer);
      keyTimer = setTimeout(saveKey, 500);
    });
    el.keyInput.addEventListener('change', saveKey);
    el.keyInput.addEventListener('blur', saveKey);

    el.eyeBtn.addEventListener('click', () => {
      const show = el.keyInput.type === 'password';
      el.keyInput.type = show ? 'text' : 'password';
      el.eyeBtn.innerHTML = show ? ICON.eyeOff : ICON.eye;
      el.eyeBtn.setAttribute('aria-pressed', String(show));
      el.eyeBtn.setAttribute('aria-label', show ? 'Hide API key' : 'Show API key');
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
