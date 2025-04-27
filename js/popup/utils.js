export const DEBUG = true;

/**
 * Generic debug logger
 */
export function debug(...args) {
  if (DEBUG) {
    console.log("[HallHop Debug]", ...args);
  }
}

/**
 * Ripple effect for buttons (expects CSS variables --x and --y)
 */
export function createRippleEffect(e) {
  const btn = e.currentTarget;
  btn.classList.remove("ripple");
  const rect = btn.getBoundingClientRect();
  btn.style.setProperty("--x", `${e.clientX - rect.left}px`);
  btn.style.setProperty("--y", `${e.clientY - rect.top}px`);
  void btn.offsetWidth; // trigger reflow
  btn.classList.add("ripple");
}

/**
 * Show an element, with special handling for modals/loading overlays
 */
export function showElement(elem, displayType = "block") {
  if (!elem) return;
  if (
    elem.classList.contains("loading-overlay") ||
    elem.classList.contains("modal-overlay")
  ) {
    elem.classList.add("visible");
  } else {
    elem.style.display = displayType;
    void elem.offsetWidth; // enable transitions
    elem.classList.add("showing");
  }
}

/**
 * Hide an element, with special handling for modals/loading overlays
 */
export function hideElement(elem) {
  if (!elem) return;
  if (
    elem.classList.contains("loading-overlay") ||
    elem.classList.contains("modal-overlay")
  ) {
    elem.classList.remove("visible");
  } else {
    elem.classList.remove("showing");
    setTimeout(() => {
      elem.style.display = "none";
    }, 400); // match your CSS transition
  }
}

/**
 * Hide a confirmation/modal overlay by removing its 'visible' class
 */
export function hideModal(modalElem) {
  if (modalElem) {
    modalElem.classList.remove("visible");
    debug("Hiding modal");
  }
}

/**
 * Animation helper: header gradient follow
 */
export function updateHeaderColor(e) {
  const header = document.querySelector(".app-header");
  if (!header) return;
  const rect = header.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
    header.style.setProperty("--x", `${x}px`);
    header.style.setProperty("--y", `${y}px`);
    const hue = Math.floor((x / rect.width) * 30) + 210;
    header.style.setProperty("--hue", hue);
    header.style.setProperty("--opacity", "1");
  } else {
    header.style.setProperty("--opacity", "0");
  }
}

/**
 * Animation helper: card gradient follow
 */
export function updateCardGradient(e) {
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  card.style.setProperty("--x", `${x}px`);
  card.style.setProperty("--y", `${y}px`);
}

/**
 * Development helper: logs computed styles on the dropdown
 */
export function checkDropdownVisibility() {
  const dropdown = document.getElementById("studentDropdown");
  if (!dropdown) {
    debug("DROPDOWN CHECK: Element not found");
    return;
  }
  const style = window.getComputedStyle(dropdown);
  debug(
    "DROPDOWN CHECK:",
    "Opacity:", style.opacity,
    "Max-height:", style.maxHeight,
    "Display:", style.display,
    "Visibility:", style.visibility,
    "Classes:", dropdown.className,
    "Size:", style.width, style.height,
    "Position:", style.position,
    "Z-index:", style.zIndex
  );
}

/**
 * Show loading overlay with optional message
 */
export function showLoading(message) {
  const overlay = document.getElementById("loading");
  const text = overlay?.querySelector(".loading-text");
  if (text && message) {
    text.textContent = message;
  }
  showElement(overlay);
  debug("Showing loading overlay");
}

/**
 * Hide loading overlay
 */
export function hideLoading() {
  const overlay = document.getElementById("loading");
  hideElement(overlay);
  debug("Hiding loading overlay");
}
