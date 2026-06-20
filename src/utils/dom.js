/**
 * Escape HTML entities to prevent XSS when interpolating into innerHTML.
 */
export function escapeHtml(str) {
  if (str == null) return "-";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Display a status message in the info panel.
 */
export function setInfo(message) {
  const info = document.getElementById("info");

  if (info) {
    info.innerText = message;
  }
}

/**
 * Format a number using Turkish locale.
 */
export function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR").format(value);
}

/**
 * Create a debounced version of a callback function.
 */
export function debounce(callback, delay) {
  let timeout;

  return (...args) => {
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      callback(...args);
    }, delay);
  };
}

/**
 * Update a button's text and disabled state in one call.
 * Reduces repetitive btn.innerText + btn.disabled assignments.
 */
export function setButtonState(btn, { text, disabled }) {
  if (text !== undefined) {
    btn.innerText = text;
  }

  if (disabled !== undefined) {
    btn.disabled = disabled;
  }
}

/**
 * Toggle a panel's visibility (via 'hidden' class) and optionally
 * update a trigger button's text.
 */
export function togglePanel(panel, { show, triggerBtn, showText, hideText } = {}) {
  if (show === undefined) {
    panel.classList.toggle("hidden");
  } else if (show) {
    panel.classList.remove("hidden");
  } else {
    panel.classList.add("hidden");
  }

  const isHidden = panel.classList.contains("hidden");

  if (triggerBtn && showText && hideText) {
    triggerBtn.innerText = isHidden ? showText : hideText;
  }

  return !isHidden;
}
