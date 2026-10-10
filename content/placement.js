// Places the component in X's right column, directly below the search box.
// The host is inserted into the sidebar's normal flow. This is deliberately
// not fixed, absolute, or sticky: X owns the page layout, so a real sibling
// is much more reliable than a floating element positioned over a slot.
//
// One rule is used on every page: find the search box, climb to the largest
// wrapper that is still "search sized", and insert the host right after it.
// Using rendered size (rather than counting children or looking for other
// sidebar sections) means it doesn't matter which sections a page has, and the
// host can never end up inside the search component or above it.
(() => {
  const TLF = window.TLF;
  const SIDEBAR = '[data-testid="sidebarColumn"]';
  const SEARCH_FORM = 'form[role="search"]';
  const SEARCH_FALLBACK = '[data-testid="SearchBox_Search_Input_label"]';
  const MARGIN = 12; // gap below the card
  const SLACK = 36; // padding a search wrapper may add around the form itself
  const GRACE_MS = 1000; // how long to wait for search before giving up on it

  let missingSince = 0;

  const findSearch = (root) =>
    root.querySelector(SEARCH_FORM) || root.querySelector(SEARCH_FALLBACK);

  // The first element inside the sidebar that actually has several children:
  // the stack that holds the column's sections.
  function topOfSidebar(sidebar) {
    let node = sidebar;
    while (
      node.children.length === 1 &&
      node.firstElementChild.tagName !== "FORM"
    ) {
      node = node.firstElementChild;
    }
    return node;
  }

  function searchBlock(sidebar, search, host) {
    const rect = search.getBoundingClientRect();
    if (rect.height <= 0) return null; // not laid out yet
    // Don't count our own card towards a wrapper's height, or a host that was
    // misplaced once would keep inflating its wrapper and stay misplaced.
    const hostH = host.isConnected
      ? host.getBoundingClientRect().height + MARGIN
      : 0;
    const limit = rect.height + SLACK;
    let block = search;
    while (block.parentElement && block.parentElement !== sidebar) {
      const parent = block.parentElement;
      const own =
        parent.getBoundingClientRect().height -
        (parent.contains(host) ? hostH : 0);
      if (own > limit) break;
      block = parent;
    }
    return block.parentElement ? block : null;
  }

  // X doesn't keep the search box in normal flow. It follows the search block
  // with an empty spacer <div> that reserves the box's height. Inserting
  // between the two puts the card at the very top of the flow, on top of the
  // search box, so the card has to go after any such spacers.
  const isSpacer = (n) =>
    n.tagName === "DIV" && n.childElementCount === 0 && !n.textContent.trim();

  function insertionAnchor(block, host) {
    let anchor = block;
    for (
      let n = block.nextElementSibling;
      n && (n === host || isSpacer(n));
      n = n.nextElementSibling
    ) {
      if (n !== host) anchor = n;
    }
    return anchor;
  }

  /** @returns {true|false|'pending'} placed / no sidebar / waiting for search */
  function ensure(host) {
    const sidebar = document.querySelector(SIDEBAR);
    if (!sidebar) {
      host.style.display = "none";
      return false;
    }

    let search = findSearch(sidebar);
    // While the user is typing in search its dropdown changes the wrapper
    // sizes. Leave the card where it is until they're done.
    if (
      search &&
      host.parentElement &&
      search.contains(document.activeElement) &&
      sidebar.contains(host)
    ) {
      return true;
    }

    let stack;
    let before = null; // node to insert before; null = append after `block`
    let block = null;

    if (search) {
      block = searchBlock(sidebar, search, host);
      if (!block) {
        host.style.display = "none";
        return "pending";
      }
      missingSince = 0;
      stack = block.parentElement;
    } else {
      // No search in the sidebar. Either it hasn't rendered yet (navigating),
      // or this page keeps its search box elsewhere (e.g. Explore). Wait a
      // moment so the card doesn't flash above the search box on its way in.
      if (!missingSince) missingSince = performance.now();
      if (performance.now() - missingSince < GRACE_MS) {
        host.style.display = "none";
        return "pending";
      }
      stack = topOfSidebar(sidebar);
      before = stack.firstChild;
    }

    const anchor = block && insertionAnchor(block, host);
    const correct = block
      ? host.parentElement === stack && host.previousElementSibling === anchor
      : host.parentElement === stack && stack.firstElementChild === host;
    if (!correct) {
      if (block) stack.insertBefore(host, anchor.nextSibling);
      else stack.insertBefore(host, before);
    }

    host.style.position = "static";
    host.style.left = "auto";
    host.style.top = "auto";
    host.style.width = "100%";
    host.style.marginBottom = `${MARGIN}px`;
    host.style.flex = "0 0 auto";
    host.style.minHeight = "0";
    host.style.visibility = "visible";
    host.style.display = "block";
    return true;
  }

  // Kept as a compatibility hook for main.js. In normal flow the card's own
  // height is already part of X's layout, so no slot height is needed.
  function setHeight() {}

  function layout(host) {
    const inSidebar = !!host.closest(SIDEBAR);
    if (!inSidebar) host.style.display = "none";
    return inSidebar;
  }

  TLF.placement = { ensure, layout, setHeight };
})();
