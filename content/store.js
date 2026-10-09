// Settings store, persisted in chrome.storage.local and kept in sync across tabs.
(() => {
  const TLF = (window.TLF = window.TLF || {});

  const DEFAULTS = {
    enabled: false,
    topics: [],
    threshold: 60, // percent
    apiKey: '',
    expanded: true,
  };

  const state = { ...DEFAULTS };
  const listeners = new Set();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const emit = (changed) => listeners.forEach((fn) => fn(changed));

  TLF.store = {
    state,
    DEFAULTS,

    async load() {
      try {
        const saved = await chrome.storage.local.get(Object.keys(DEFAULTS));
        for (const k of Object.keys(DEFAULTS)) if (k in saved) state[k] = saved[k];
      } catch {
        /* storage unavailable: run with defaults */
      }
    },

    /** Update settings. Pass { persist: false } for transient updates (e.g. dragging a slider). */
    set(patch, { persist = true } = {}) {
      const changed = {};
      for (const [k, v] of Object.entries(patch)) {
        if (!same(state[k], v)) {
          state[k] = v;
          changed[k] = v;
        }
      }
      if (persist) {
        try {
          chrome.storage.local.set(patch);
        } catch {
          /* extension was reloaded; page needs a refresh */
        }
      }
      if (Object.keys(changed).length) emit(changed);
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const changed = {};
      for (const [k, { newValue }] of Object.entries(changes)) {
        if (!(k in DEFAULTS)) continue;
        const v = newValue === undefined ? DEFAULTS[k] : newValue;
        if (!same(state[k], v)) {
          state[k] = v;
          changed[k] = v;
        }
      }
      if (Object.keys(changed).length) emit(changed);
    });
  } catch {
    /* ignore */
  }
})();
