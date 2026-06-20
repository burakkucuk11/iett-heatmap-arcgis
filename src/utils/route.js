/**
 * Safely call removeAll() on a route layer collection with error handling.
 * Replaces the repetitive try/catch blocks in clearRoute().
 */
export function safeRemoveAll(collection, label) {
  try {
    if (collection) {
      collection.removeAll();
    }
  } catch (error) {
    console.warn(`${label} temizlenemedi:`, error);
  }
}

/**
 * Create a styled popup container with stop/point attributes and a route button.
 * Eliminates the duplicated popup content creation in click handlers and popupTemplate.
 */
export function createPopupContent({ attributes, onRouteClick }) {
  const container = document.createElement("div");
  container.style.lineHeight = "1.7";

  if (attributes) {
    container.innerHTML = `
      <b>Durak Adı:</b> ${attributes.ADI || "-"}<br/>
      <b>Durak Kodu:</b> ${attributes.DURAK_KODU || "-"}<br/>
      <b>Durak Tipi:</b> ${attributes.DURAK_TIPI || "-"}<br/>
      <b>Yön Bilgisi:</b> ${attributes.YON_BILGISI || "-"}<br/>
      <b>Durumu:</b> ${attributes.DURUMU || "-"}<br/>
      <b>İlçe ID:</b> ${attributes.ILCEID || "-"}<br/>
      <b>Mahalle ID:</b> ${attributes.MAHALLEID || "-"}<br/>
    `;
  }

  if (onRouteClick) {
    const routeButton = createRouteButton(onRouteClick);
    container.appendChild(routeButton);
  }

  return container;
}

/**
 * Create a styled "Buraya Rota Al" button.
 * Extracted since the same button pattern appears in multiple popup contexts.
 */
export function createRouteButton(onClick) {
  const button = document.createElement("button");
  button.className = "popup-route-btn";
  button.innerText = "Buraya Rota Al";
  button.addEventListener("click", onClick);
  return button;
}

/**
 * Create a coordinate display popup content with a route button.
 */
export function createCoordinatePopupContent({ longitude, latitude, onRouteClick }) {
  const container = document.createElement("div");
  container.style.lineHeight = "1.7";

  container.innerHTML = `
    <b>Koordinat:</b><br/>
    X: ${longitude?.toFixed(6) || "-"}<br/>
    Y: ${latitude?.toFixed(6) || "-"}<br/>
  `;

  if (onRouteClick) {
    const routeButton = createRouteButton(onRouteClick);
    container.appendChild(routeButton);
  }

  return container;
}
