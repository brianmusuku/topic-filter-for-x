// Places the component in X's right column, directly below the search box.
// The host is inserted into the sidebar's normal flow. This is deliberately
// not fixed, absolute, or sticky: X owns the page layout, so a real sibling
// is much more reliable than a floating element positioned over a slot.
(() => {
  const TLF = window.TLF;
  const SIDEBAR = '[data-testid="sidebarColumn"]';
  const NEWS_SIDEBAR = '[data-testid="news_sidebar"]';
  const SEARCH_FORM = 'form[role="search"]';
  const SEARCH_FALLBACK = '[data-testid="SearchBox_Search_Input_label"]';

  function branchUnder(ancestor, node) {
    while (node?.parentElement && node.parentElement !== ancestor) node = node.parentElement;
    return node?.parentElement === ancestor ? node : null;
  }

  function sharedStack(first, second) {
    const ancestors = new Set();
    for (let node = first; node; node = node.parentElement) ancestors.add(node);
    for (let node = second; node; node = node.parentElement) {
      if (ancestors.has(node)) return node;
    }
    return null;
  }

  function target() {
    const sidebar = document.querySelector(SIDEBAR);
    if (!sidebar) return null;

    const search = sidebar.querySelector(SEARCH_FORM) || sidebar.querySelector(SEARCH_FALLBACK);
    const news = sidebar.querySelector(NEWS_SIDEBAR);
    if (search && news) {
      const stack = sharedStack(search, news);
      const block = stack && branchUnder(stack, news);
      const searchBlock = stack && branchUnder(stack, search);
      if (stack && block && searchBlock && block !== searchBlock) {
        return { stack, block, before: true };
      }
    }

    // Fall back to a sibling of the complete search block. Keep the host out
    // of the search form and its nested wrappers.
    if (search) {
      let block = search;
      while (block.parentElement && block.parentElement !== sidebar && block.parentElement.children.length === 1) {
        block = block.parentElement;
      }
      if (block.parentElement) return { stack: block.parentElement, block, before: false };
    }

    // If the search box is temporarily absent during navigation, use the
    // sidebar itself. The next pass will move the host below search when it
    // appears.
    return { stack: sidebar, block: null, before: false };
  }

  function ensure(host) {
    const place = target();
    if (!place) {
      host.style.display = 'none';
      return false;
    }

    const { stack, block, before } = place;
    if (block && block.parentElement === stack) {
      const correctlyPlaced = host.parentElement === stack && (before ? host.nextElementSibling === block : host.previousElementSibling === block);
      if (!correctlyPlaced) {
        stack.insertBefore(host, before ? block : block.nextSibling);
      }
    } else if (host.parentElement !== stack || stack.firstElementChild !== host) {
      stack.insertBefore(host, stack.firstChild);
    }

    host.style.position = 'static';
    host.style.left = 'auto';
    host.style.top = 'auto';
    host.style.width = '100%';
    host.style.marginBottom = '12px';
    host.style.flex = '0 0 auto';
    host.style.minHeight = '0';
    host.style.visibility = 'visible';
    host.style.display = 'block';
    return true;
  }

  // Kept as a compatibility hook for main.js. In normal flow the card's own
  // height is already part of X's layout, so no slot height is needed.
  function setHeight() {}

  function layout(host) {
    const inSidebar = !!host.closest(SIDEBAR);
    if (!inSidebar) host.style.display = 'none';
    return inSidebar;
  }

  TLF.placement = { ensure, layout, setHeight };
})();
