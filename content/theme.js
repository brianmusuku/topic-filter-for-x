// Reads X's current display theme (Light / Dim / Lights out), accent color and font
// so the component always looks native.
(() => {
  const TLF = window.TLF;
  const DEFAULT_ACCENT = '29 155 240'; // X blue, as an "r g b" triple
  let lastAccent = DEFAULT_ACCENT;

  function parseRGB(value) {
    const m = value && value.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length >= 4 && p[3] === 0) return null; // transparent
    return p.slice(0, 3);
  }

  function detect() {
    // X can leave body transparent and paint the theme on the document root or
    // its main app surface. Check those in order before using the OS preference.
    const surfaces = [
      document.body,
      document.documentElement,
      document.querySelector('[data-testid="primaryColumn"]'),
      document.querySelector('[data-testid="AppTabBar_Home_Link"]')?.parentElement,
    ];
    for (const surface of surfaces) {
      if (!surface) continue;
      const bg = parseRGB(getComputedStyle(surface).backgroundColor);
      if (!bg) continue;
      const [r, g, b] = bg;
      if ((r * 299 + g * 587 + b * 114) / 1000 > 150) return 'light';
      return Math.max(r, g, b) < 12 ? 'dark' : 'dim';
    }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // The Post button is painted in the user's chosen accent color.
  function accent() {
    const btn = document.querySelector('[data-testid="SideNav_NewTweet_Button"]');
    const c = btn && parseRGB(getComputedStyle(btn).backgroundColor);
    if (c) {
      const max = Math.max(...c);
      const min = Math.min(...c);
      if (max > 80 && (max - min) / max > 0.35) lastAccent = c.join(' ');
    }
    return lastAccent;
  }

  // Body often inherits a generic stack. X paints timeline and sidebar copy in Chirp.
  function fontFamily() {
    const probe =
      document.querySelector('[data-testid="tweetText"]') ||
      document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
      document.querySelector('[data-testid="primaryColumn"]') ||
      document.body;
    return getComputedStyle(probe).fontFamily;
  }

  function apply(host) {
    const theme = detect();
    if (host.getAttribute('data-theme') !== theme) host.setAttribute('data-theme', theme);
    const a = accent();
    if (host.style.getPropertyValue('--accent') !== a) host.style.setProperty('--accent', a);
    const font = fontFamily();
    if (font && host.style.fontFamily !== font) host.style.fontFamily = font;
  }

  TLF.theme = { detect, accent, apply };
})();
