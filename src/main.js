import "./style.css";

import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import RouteLayer from "@arcgis/core/layers/RouteLayer.js";
import Graphic from "@arcgis/core/Graphic.js";
import esriConfig from "@arcgis/core/config.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import TableTemplate from "@arcgis/core/widgets/FeatureTable/support/TableTemplate.js";

import "@arcgis/map-components/dist/components/arcgis-search";
import "@arcgis/map-components/dist/components/arcgis-directions";
import "@arcgis/map-components/dist/components/arcgis-feature-table";

import { ISTANBUL_CENTER, START_POINT_COLOR, NEAREST_STOP_COLOR, USER_LOCATION_COLOR, ZOOM_THRESHOLDS, DEFAULT_WHERE } from "./config/constants.js";
import { heatmapRenderer, pointRenderer, stopLabelingInfo, clusterConfig } from "./config/renderers.js";
import { setInfo, formatNumber, debounce, setButtonState, togglePanel } from "./utils/dom.js";
import { haversineDistanceMeters, getUserLocationPoint, createLayerQuery } from "./utils/geo.js";
import { createPopupContent, createCoordinatePopupContent } from "./utils/route.js";

// Note: VITE_ prefixed env vars are bundled into client JS.
// Ensure this API key is scoped to required services only
// and has referrer restrictions in the ArcGIS Developer dashboard.
esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;

let totalStopCount = 0;
let currentWhere = DEFAULT_WHERE;

let isSelectingStartPoint = false;
let selectedStartPoint = null;
let selectedStartGraphic = null;

let pendingRouteTarget = null;
let isSelectingRouteTarget = false;
let hasActiveRoute = false;
let isSelectingNearestFromMap = false;

let nearestStopGraphic = null;
let userLocationGraphic = null;

let lastRendererMode = null;

const iettLayer = new GeoJSONLayer({
  url: "/Data/OtobusDuraklari.geojson",
  title: "IETT Durakları",
  outFields: ["*"],
  renderer: heatmapRenderer,
  popupTemplate: {
    title: "{ADI}",
    content: (event) => {
      const graphic = event.graphic;
      const attributes = graphic.attributes;

      const container = document.createElement("div");
      container.style.lineHeight = "1.7";

      const fields = [
        ["Durak Adı", attributes.ADI],
        ["Durak Kodu", attributes.DURAK_KODU],
        ["Durak Tipi", attributes.DURAK_TIPI],
        ["Yön Bilgisi", attributes.YON_BILGISI],
        ["Durumu", attributes.DURUMU],
        ["İlçe ID", attributes.ILCEID],
        ["Mahalle ID", attributes.MAHALLEID]
      ];

      fields.forEach(([label, value]) => {
        const line = document.createElement("div");
        const bold = document.createElement("b");
        bold.textContent = `${label}: `;
        line.appendChild(bold);
        const span = document.createElement("span");
        span.textContent = value || "-";
        line.appendChild(span);
        container.appendChild(line);
      });

    const routeButton = document.createElement("button");
    routeButton.className = "popup-route-btn";
    routeButton.innerText = "Buraya Rota Al";

    routeButton.addEventListener("click", async () => {
      if (!selectedStartPoint) {
        setInfo("Önce sol panelden 'Başlangıç Noktası Seç' butonuna basıp haritadan başlangıç seçmelisin.");
        return;
      }

      await createRoute(
        selectedStartPoint,
        graphic.geometry,
        attributes.ADI || "IETT Durağı"
      );
    });

    container.appendChild(routeButton);

    return container;
  }
}
});

let routeLayer = new RouteLayer({
  title: "Rota"
});

const map = new Map({
  basemap: "dark-gray-vector",
  layers: [iettLayer, routeLayer]
});

const view = new MapView({
  container: "viewDiv",
  map,
  center: ISTANBUL_CENTER,
  zoom: 10,
  constraints: {
    minZoom: 8,
    maxZoom: 20
  },
  popup: {
    dockEnabled: true,
    dockOptions: {
      position: "bottom-right",
      breakpoint: false
    }
  }
});

const searchEl = document.querySelector("arcgis-search");
const directionsEl = document.querySelector("arcgis-directions");
const featureTableEl = document.querySelector("arcgis-feature-table");

searchEl.view = view;
searchEl.includeDefaultSources = true;
searchEl.allPlaceholder = "Durak, kod veya adres ara";
searchEl.sources = [
  {
    layer: iettLayer,
    searchFields: ["ADI", "DURAK_KODU", "DURAK_TIPI", "YON_BILGISI", "ILCEID"],
    displayField: "ADI",
    exactMatch: false,
    outFields: ["*"],
    name: "IETT Durakları",
    placeholder: "Durak adı veya kodu ara",
    suggestionsEnabled: true,
    minSuggestCharacters: 2
  }
];

view.ui.add(searchEl, { position: "top-left" });

directionsEl.view = view;
directionsEl.layer = routeLayer;
directionsEl.apiKey = esriConfig.apiKey;
directionsEl.hideSaveAsButton = true;
directionsEl.hideSaveButton = true;
directionsEl.hidePrintButton = true;

featureTableEl.view = view;
featureTableEl.layer = iettLayer;
featureTableEl.multipleSortEnabled = true;
featureTableEl.tableTemplate = new TableTemplate({
  columnTemplates: [
    { type: "field", fieldName: "ADI", label: "Durak Adı" },
    { type: "field", fieldName: "DURAK_KODU", label: "Durak Kodu" },
    { type: "field", fieldName: "DURAK_TIPI", label: "Durak Tipi" },
    { type: "field", fieldName: "YON_BILGISI", label: "Yön Bilgisi" },
    { type: "field", fieldName: "DURUMU", label: "Durumu" },
    { type: "field", fieldName: "ILCEID", label: "İlçe ID" },
    { type: "field", fieldName: "MAHALLEID", label: "Mahalle ID" }
  ]
});

const directionsPanel = document.getElementById("directionsPanel");
const directionsOverlay = document.getElementById("directionsOverlay");
const toggleDirectionsBtn = document.getElementById("toggleDirectionsBtn");
const clearRouteBtn = document.getElementById("clearRouteBtn");

const toggleTableBtn = document.getElementById("toggleTableBtn");
const tableDrawer = document.getElementById("tableDrawer");
const closeTableBtn = document.getElementById("closeTableBtn");

const stopFilterInput = document.getElementById("stopFilterInput");
const clearFilterBtn = document.getElementById("clearFilterBtn");

const setStartModeBtn = document.getElementById("setStartModeBtn");
const clearStartBtn = document.getElementById("clearStartBtn");

const fitStopsBtn = document.getElementById("fitStopsBtn");
const resetViewBtn = document.getElementById("resetViewBtn");

const nearestStopBtn = document.getElementById("nearestStopBtn");
const nearestStopPanel = document.getElementById("nearestStopPanel");
const closeNearestBtn = document.getElementById("closeNearestBtn");
const useLocationNearestBtn = document.getElementById("useLocationNearestBtn");
const selectFromMapNearestBtn = document.getElementById("selectFromMapNearestBtn");
const nearestStopContent = document.getElementById("nearestStopContent");
const nearestStopInfo = document.getElementById("nearestStopInfo");

view.when(async () => {
  await iettLayer.when();

  const totalQuery = createLayerQuery(iettLayer, { where: DEFAULT_WHERE });
  totalStopCount = await iettLayer.queryFeatureCount(totalQuery);

  document.getElementById("totalStops").innerText = formatNumber(totalStopCount);

  await updateVisibleCountByExtent();
  applyZoomBasedRenderer();
  updateRouteButtonState();

  view.goTo({
    center: ISTANBUL_CENTER,
    zoom: 10
  });

  setInfo("Harita hazır. Yakınlaşınca cluster ve point gösterimine geçer.");
}).catch((error) => {
  console.error("Harita yüklenemedi:", error);
  setInfo("Harita yüklenemedi. Console hatasını kontrol et.");
});

reactiveUtils.watch(
  () => view.zoom,
  debounce(() => {
    applyZoomBasedRenderer();
  }, 80)
);

reactiveUtils.watch(
  () => view.extent,
  debounce(async () => {
    try {
      await updateVisibleCountByExtent();
    } catch (error) {
      console.error("Extent değişikliğinde durak sayısı güncellenemedi:", error);
    }
  }, 400)
);

toggleDirectionsBtn.addEventListener("click", () => {
  const isVisible = togglePanel(directionsPanel, {
    triggerBtn: toggleDirectionsBtn,
    showText: "Rota Paneli",
    hideText: "Paneli Kapat"
  });

  if (isVisible) {
    showStartPointMenu();
  } else {
    isSelectingStartPoint = false;
    isSelectingRouteTarget = false;
  }
});

clearRouteBtn.addEventListener("click", () => {
  clearRoute();
});

toggleTableBtn.addEventListener("click", () => {
  togglePanel(tableDrawer, {
    triggerBtn: toggleTableBtn,
    showText: "Durak Tablosu",
    hideText: "Tabloyu Kapat"
  });
});

closeTableBtn.addEventListener("click", () => {
  togglePanel(tableDrawer, { show: false });
  toggleTableBtn.innerText = "Durak Tablosu";
});

stopFilterInput.addEventListener("input", debounce(async () => {
  const value = stopFilterInput.value.trim();
  await applyTextFilter(value);
}, 350));

clearFilterBtn.addEventListener("click", async () => {
  stopFilterInput.value = "";
  await applyTextFilter("");
});

setStartModeBtn.addEventListener("click", () => {
  isSelectingStartPoint = true;
  setButtonState(setStartModeBtn, { text: "Haritadan Başlangıç Seçiliyor...", disabled: true });
  setInfo("Haritada bir noktaya tıkla. Bu nokta rota başlangıcı olacak.");
});

clearStartBtn.addEventListener("click", () => {
  clearStartPoint();
  setInfo("Başlangıç noktası temizlendi.");
});

fitStopsBtn.addEventListener("click", async () => {
  try {
    const query = iettLayer.createQuery();
    query.where = currentWhere;
    query.returnGeometry = true;

    const result = await iettLayer.queryExtent(query);

    if (result.extent) {
      view.goTo(result.extent.expand(1.18));
      setInfo("Gösterilen durakların tamamına zoom yapıldı.");
    } else {
      setInfo("Mevcut filtre için durak alanı bulunamadı.");
    }
  } catch (error) {
    console.error("Durak extent sorgusu başarısız:", error);
    setInfo("Durak alanı hesaplanamadı. Lütfen tekrar deneyin.");
  }
});

resetViewBtn.addEventListener("click", () => {
  view.goTo({
    center: ISTANBUL_CENTER,
    zoom: 10
  });

  setInfo("Harita İstanbul geneline sıfırlandı.");
});

nearestStopBtn.addEventListener("click", () => {
  togglePanel(nearestStopPanel, { show: true });
  nearestStopContent.style.display = "block";
  nearestStopInfo.style.display = "none";
  setInfo("En yakın durak bulmak için bir yöntem seç.");
});

closeNearestBtn.addEventListener("click", () => {
  togglePanel(nearestStopPanel, { show: false });
  isSelectingNearestFromMap = false;
  clearNearestStopGraphics();
});

useLocationNearestBtn.addEventListener("click", async () => {
  setButtonState(useLocationNearestBtn, { text: "Konum alınıyor...", disabled: true });

  try {
    const userPoint = await getUserLocationPoint();

    if (userPoint) {
      const nearest = await findNearestStop(userPoint);
      if (nearest) {
        await handleNearestStopFound(nearest, userPoint);
      }
    } else {
      setInfo("Konum alınamadı. Haritadan nokta seç.");
    }
  } catch (error) {
    console.error("En yakın durak aranırken hata:", error);
    setInfo("En yakın durak aranırken bir hata oluştu.");
  }

  setButtonState(useLocationNearestBtn, { text: "📍 Konumumu Kullan (GPS)", disabled: false });
});

selectFromMapNearestBtn.addEventListener("click", () => {
  isSelectingNearestFromMap = true;
  setButtonState(selectFromMapNearestBtn, { text: "Haritada nokta seçiliyor...", disabled: true });
  setInfo("En yakın durağı bulmak için haritada bir nokta tıkla.");
});

view.on("click", async (event) => {
  try {
    if (isSelectingNearestFromMap) {
      if (!event.mapPoint?.longitude || !event.mapPoint?.latitude) {
        setInfo("Haritadan geçerli bir nokta seçilemedi.");

        isSelectingNearestFromMap = false;
        selectFromMapNearestBtn.disabled = false;
        selectFromMapNearestBtn.innerText = "🗺️ Haritadan Seç";
        return;
      }

      const nearest = await findNearestStop(event.mapPoint);

      if (nearest) {
        await handleNearestStopFound(nearest, event.mapPoint);
      } else {
        setInfo("Seçilen noktaya yakın durak bulunamadı.");
      }

      isSelectingNearestFromMap = false;
      setButtonState(selectFromMapNearestBtn, { text: "🗺️ Haritadan Seç", disabled: false });
      return;
    }

    if (isSelectingStartPoint) {
      if (!event.mapPoint?.longitude || !event.mapPoint?.latitude) {
        setInfo("Geçerli bir nokta seçilemedi. Tekrar dene.");
        return;
      }
      setStartPoint(event.mapPoint);
      return;
    }

    const hit = await view.hitTest(event);

    const stopGraphic = hit.results.find((result) => {
      return result.graphic && result.graphic.layer === iettLayer;
    })?.graphic;

    if (stopGraphic) {
      pendingRouteTarget = {
        geometry: stopGraphic.geometry,
        name: stopGraphic.attributes?.ADI || "IETT Durağı"
      };

      if (isSelectingRouteTarget && selectedStartPoint) {
        await createRoute(selectedStartPoint, pendingRouteTarget.geometry, pendingRouteTarget.name);
        pendingRouteTarget = null;
      }

      return;
    }

    pendingRouteTarget = {
      geometry: event.mapPoint,
      name: "Seçilen Nokta"
    };

    if (isSelectingRouteTarget && selectedStartPoint) {
      await createRoute(selectedStartPoint, event.mapPoint, "Seçilen Nokta");
      pendingRouteTarget = null;
      return;
    }

    const pointContainer = document.createElement("div");
    pointContainer.style.lineHeight = "1.7";

    const coordLabel = document.createElement("b");
    coordLabel.textContent = "Koordinat:";
    pointContainer.appendChild(coordLabel);
    pointContainer.appendChild(document.createElement("br"));

    const xText = document.createTextNode(`X: ${event.mapPoint.longitude?.toFixed(6) || "-"}`);
    pointContainer.appendChild(xText);
    pointContainer.appendChild(document.createElement("br"));

    const yText = document.createTextNode(`Y: ${event.mapPoint.latitude?.toFixed(6) || "-"}`);
    pointContainer.appendChild(yText);
    pointContainer.appendChild(document.createElement("br"));

    const pointRouteButton = document.createElement("button");
    pointRouteButton.className = "popup-route-btn";
    pointRouteButton.innerText = "Buraya Rota Al";

    pointRouteButton.addEventListener("click", async () => {
      if (!selectedStartPoint) {
        setInfo("Önce başlangıç noktası seçmelisin.");
        return;
      }

      await createRoute(
        selectedStartPoint,
        event.mapPoint,
        "Seçilen Nokta"
      );
    });

    pointContainer.appendChild(pointRouteButton);

    view.popup.open({
      title: "Seçilen Nokta",
      content: pointContainer,
      location: event.mapPoint
    });
  } catch (error) {
    console.error("Harita tıklama olayı işlenemedi:", error);
    setInfo("İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.");
  }
});

function applyZoomBasedRenderer() {
  const zoom = view.zoom;
  const zoomStatus = document.getElementById("zoomStatus");
  const activeMode = document.getElementById("activeMode");

  let mode;
  if (zoom < ZOOM_THRESHOLDS.HEATMAP_MAX) {
    mode = "heatmap";
  } else if (zoom < ZOOM_THRESHOLDS.CLUSTER_MAX) {
    mode = "cluster";
  } else {
    mode = "point";
  }

  zoomStatus.innerText = `Zoom ${zoom.toFixed(1)}`;

  if (mode === lastRendererMode) {
    return;
  }
  lastRendererMode = mode;

  if (mode === "heatmap") {
    iettLayer.renderer = heatmapRenderer;
    iettLayer.featureReduction = null;
    iettLayer.featureEffect = null;
    iettLayer.labelingInfo = null;
    iettLayer.labelsVisible = false;

    activeMode.innerText = "Heatmap";
  } else if (mode === "cluster") {
    iettLayer.renderer = pointRenderer;
    iettLayer.featureReduction = clusterConfig;
    iettLayer.featureEffect = null;
    iettLayer.labelingInfo = null;
    iettLayer.labelsVisible = false;

    activeMode.innerText = "Cluster";
  } else {
    iettLayer.renderer = pointRenderer;
    iettLayer.featureReduction = null;

    iettLayer.labelingInfo = stopLabelingInfo;
    iettLayer.labelsVisible = true;

    iettLayer.featureEffect = {
      filter: {
        where: currentWhere
      },
      includedEffect: "drop-shadow(0px, 0px, 8px #FDB462) brightness(1.24)",
      excludedEffect: "opacity(25%) grayscale(80%)"
    };

    activeMode.innerText = "Point + Label + Effect";
  }
}

async function applyTextFilter(value) {
  if (!value) {
    currentWhere = DEFAULT_WHERE;
  } else {
    const safeValue = value
      .replaceAll("'", "''")
      .replaceAll("%", "")
      .replaceAll("_", "\\_")
      .replaceAll("-", "")
      .replaceAll(";", "")
      .replace(/[\x00-\x1f]/g, "");

    currentWhere = `
      UPPER(ADI) LIKE UPPER('%${safeValue}%')
      OR UPPER(DURAK_KODU) LIKE UPPER('%${safeValue}%')
      OR UPPER(DURAK_TIPI) LIKE UPPER('%${safeValue}%')
      OR UPPER(YON_BILGISI) LIKE UPPER('%${safeValue}%')
      OR UPPER(CAST(ILCEID AS VARCHAR(20))) LIKE UPPER('%${safeValue}%')
    `;
  }

  iettLayer.definitionExpression = currentWhere;

  lastRendererMode = null;
  applyZoomBasedRenderer();

  try {
    await updateVisibleCountByExtent();
  } catch (error) {
    console.error("Filtre sonrası durak sayısı güncellenemedi:", error);
  }

  if (value) {
    setInfo(`Filtre uygulandı: "${value}"`);
  } else {
    setInfo("Filtre temizlendi. Tüm duraklar gösteriliyor.");
  }
}

async function updateVisibleCountByExtent() {
  if (!view.extent) {
    return;
  }

  const query = createLayerQuery(iettLayer, {
    where: currentWhere,
    geometry: view.extent,
    spatialRelationship: "intersects"
  });

  try {
    const count = await iettLayer.queryFeatureCount(query);
    document.getElementById("visibleStops").innerText = formatNumber(count);
  } catch (error) {
    console.warn("Extent içindeki durak sayısı alınamadı:", error);
    document.getElementById("visibleStops").innerText = "-";
  }
}

async function findNearestStop(userPoint) {
  const query = createLayerQuery(iettLayer, {
    where: currentWhere,
    outFields: ["*"],
    returnGeometry: true
  });

  let result;
  try {
    result = await iettLayer.queryFeatures(query);
  } catch (error) {
    console.error("Durak sorgusu başarısız:", error);
    setInfo("Durak verileri alınamadı. Lütfen tekrar deneyin.");
    return null;
  }

  if (!result.features || result.features.length === 0) {
    setInfo("Mevcut filtre için durak bulunamadı.");
    return null;
  }

  let nearest = null;
  let nearestDistance = Infinity;

  result.features.forEach((feature) => {
    const distance = haversineDistanceMeters(
      userPoint.longitude,
      userPoint.latitude,
      feature.geometry.longitude,
      feature.geometry.latitude
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = feature;
    }
  });

  if (nearest) {
    setInfo(
      `En yakın durak: ${nearest.attributes.ADI || "-"} · Yaklaşık ${Math.round(nearestDistance)} metre`
    );
  }

  return nearest;
}

async function createRoute(startPoint, endPoint, stopName) {
  try {
    await reactiveUtils.whenOnce(() => directionsEl.view);
  } catch (error) {
    console.error("Directions widget başlatılamadı:", error);
    setInfo("Rota servisi başlatılamadı. Sayfa yenilenmeyi deneyin.");
    return;
  }

  togglePanel(directionsPanel, { show: true });
  toggleDirectionsBtn.innerText = "Paneli Kapat";

  clearRoute(false);

  try {
    routeLayer.stops.addMany([
      {
        name: "Başlangıç Noktası",
        geometry: startPoint
      },
      {
        name: stopName,
        geometry: endPoint
      }
    ]);
  } catch (error) {
    console.error("Rota noktaları eklenemedi:", error);
    setInfo("Rota noktaları ayarlanamadı. Lütfen tekrar deneyin.");
    return;
  }

  try {
    await directionsEl.getDirections();

    hasActiveRoute = true;
    isSelectingRouteTarget = false;
    updateRouteButtonState();

    setInfo(`${stopName} için rota oluşturuldu.`);
  } catch (error) {
    hasActiveRoute = false;
    isSelectingRouteTarget = true;
    updateRouteButtonState();

    console.error("Rota oluşturulamadı:", error);
    setInfo("Rota oluşturulamadı. API key veya routing servisini kontrol et.");
  }
}

function clearRoute(showMessage = true) {
  try {
    map.remove(routeLayer);
    routeLayer = new RouteLayer({ title: "Rota" });
    map.add(routeLayer);
    directionsEl.layer = routeLayer;
  } catch (error) {
    console.warn("Rota temizleme sırasında hata:", error);
  }

  clearNearestStopGraphics();

  hasActiveRoute = false;
  isSelectingRouteTarget = false;
  updateRouteButtonState();

  const routeInfoPanel = document.getElementById("routeInfoPanel");

  if (routeInfoPanel) {
    routeInfoPanel.innerHTML = "";
  }

  if (!directionsPanel.classList.contains("hidden") && selectedStartPoint) {
    showDirectionsOverlay("success", "Başlangıç noktası hala aktif", "Haritada yeni bir hedef noktası tıkla");
    isSelectingRouteTarget = true;
  }

  if (showMessage) {
    setInfo("Rota temizlendi.");
  }
}

function updateRouteButtonState() {
  setButtonState(clearRouteBtn, {
    text: hasActiveRoute ? "Rotayı Temizle" : "Temizlenecek Rota Yok",
    disabled: !hasActiveRoute
  });
}

function setStartPoint(point) {
  selectedStartPoint = point;
  isSelectingStartPoint = false;

  if (selectedStartGraphic) {
    view.graphics.remove(selectedStartGraphic);
  }

  selectedStartGraphic = new Graphic({
    geometry: point,
    symbol: {
      type: "simple-marker",
      style: "circle",
      color: START_POINT_COLOR,
      size: 14,
      outline: {
        color: "#ffffff",
        width: 2
      }
    },
    attributes: {
      type: "start-point"
    },
    popupTemplate: {
      title: "Rota Başlangıç Noktası",
      content: "Bu nokta rota başlangıcı olarak seçildi."
    }
  });

  view.graphics.add(selectedStartGraphic);

  showDirectionsOverlay("success", "Başlangıç noktası ayarlandı", "Haritada rota hedefi olan bir durak veya nokta tıkla");

  isSelectingRouteTarget = true;

  setButtonState(setStartModeBtn, { text: "Başlangıç Noktası Seç", disabled: false });
  setInfo("Başlangıç noktası seçildi. Şimdi hedef durağı veya noktayı tıkla.");
}

function clearStartPoint() {
  selectedStartPoint = null;
  isSelectingStartPoint = false;
  isSelectingRouteTarget = false;

  if (selectedStartGraphic) {
    view.graphics.remove(selectedStartGraphic);
    selectedStartGraphic = null;
  }

  setButtonState(setStartModeBtn, { text: "Başlangıç Noktası Seç", disabled: false });

  if (!directionsPanel.classList.contains("hidden")) {
    showStartPointMenu();
  }
}

function showDirectionsOverlay(type, title, subtitle) {
  const typeClasses = {
    success: "directions-overlay-success",
    warning: "directions-overlay-warning",
    info: "directions-overlay-info"
  };

  directionsOverlay.className = `directions-overlay ${typeClasses[type] || ""}`;
  directionsOverlay.innerHTML = "";

  const strong = document.createElement("strong");
  strong.textContent = title;
  directionsOverlay.appendChild(strong);

  if (subtitle) {
    directionsOverlay.appendChild(document.createElement("br"));
    const small = document.createElement("small");
    small.textContent = subtitle;
    directionsOverlay.appendChild(small);
  }

  directionsOverlay.classList.remove("hidden");
}

function hideDirectionsOverlay() {
  directionsOverlay.classList.add("hidden");
}

function showStartPointMenu() {
  hideDirectionsOverlay();

  const menu = document.getElementById("startPointMenu");
  menu.classList.remove("hidden");

  const useLocationBtn = document.getElementById("useLocationBtn");
  const selectFromMapBtn = document.getElementById("selectFromMapBtn");

  const newUseLocationBtn = useLocationBtn.cloneNode(true);
  useLocationBtn.parentNode.replaceChild(newUseLocationBtn, useLocationBtn);

  const newSelectFromMapBtn = selectFromMapBtn.cloneNode(true);
  selectFromMapBtn.parentNode.replaceChild(newSelectFromMapBtn, selectFromMapBtn);

  newUseLocationBtn.addEventListener("click", async () => {
    setInfo("Konum alınıyor...");

    const userPoint = await getUserLocationPoint();

    if (userPoint) {
      menu.classList.add("hidden");
      setStartPoint(userPoint);
    } else {
      setInfo("Konum alınamadı. Haritadan manuel seç.");
    }
  });

  newSelectFromMapBtn.addEventListener("click", () => {
    isSelectingStartPoint = true;
    menu.classList.add("hidden");

    showDirectionsOverlay("warning", "Haritada başlangıç noktasını seç", "Haritaya tıklayarak başlangıç noktasını işaretle");

    setInfo("Haritada başlangıç noktası için bir nokta tıkla.");
  });
}

function clearNearestStopGraphics() {
  if (nearestStopGraphic) {
    view.graphics.remove(nearestStopGraphic);
    nearestStopGraphic = null;
  }
  if (userLocationGraphic) {
    view.graphics.remove(userLocationGraphic);
    userLocationGraphic = null;
  }
}

function highlightNearestStop(stop) {
  clearNearestStopGraphics();

  nearestStopGraphic = new Graphic({
    geometry: stop.geometry,
    symbol: {
      type: "simple-marker",
      style: "circle",
      color: NEAREST_STOP_COLOR,
      size: 18,
      outline: {
        color: "#ffffff",
        width: 3
      }
    },
    attributes: { type: "nearest-stop-highlight" }
  });

  view.graphics.add(nearestStopGraphic);
}

function showUserLocationMarker(point) {
  if (userLocationGraphic) {
    view.graphics.remove(userLocationGraphic);
  }

  userLocationGraphic = new Graphic({
    geometry: point,
    symbol: {
      type: "simple-marker",
      style: "circle",
      color: USER_LOCATION_COLOR,
      size: 12,
      outline: {
        color: "#ffffff",
        width: 2
      }
    },
    attributes: { type: "user-location" }
  });

  view.graphics.add(userLocationGraphic);
}

async function handleNearestStopFound(stop, userPoint) {
  highlightNearestStop(stop);
  showUserLocationMarker(userPoint);
  showNearestStopInfo(stop, userPoint);

  await view.goTo({
    target: [stop.geometry, userPoint],
    zoom: Math.max(view.zoom, 15)
  });

  if (!selectedStartPoint) {
    setStartPoint(userPoint);
  }

  togglePanel(nearestStopPanel, { show: false });

  await createRoute(
    selectedStartPoint,
    stop.geometry,
    stop.attributes.ADI || "IETT Durağı"
  );
}

function showNearestStopInfo(stop, userPoint) {
  const distance = Math.round(
    haversineDistanceMeters(
      userPoint.longitude,
      userPoint.latitude,
      stop.geometry.longitude,
      stop.geometry.latitude
    )
  );

  nearestStopContent.style.display = "none";
  nearestStopInfo.style.display = "block";
  nearestStopInfo.innerHTML = "";

  const card = document.createElement("div");
  card.className = "nearest-stop-card";

  const title = document.createElement("h4");
  title.className = "nearest-stop-title";
  title.textContent = stop.attributes.ADI || "-";
  card.appendChild(title);

  const details = document.createElement("div");
  details.className = "nearest-stop-details";

  const detailFields = [
    ["Durak Kodu", stop.attributes.DURAK_KODU],
    ["Durak Tipi", stop.attributes.DURAK_TIPI],
    ["Yön Bilgisi", stop.attributes.YON_BILGISI],
    ["Durumu", stop.attributes.DURUMU]
  ];

  detailFields.forEach(([label, value]) => {
    const row = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    row.appendChild(strong);
    const span = document.createElement("span");
    span.textContent = value || "-";
    row.appendChild(span);
    details.appendChild(row);
  });

  card.appendChild(details);

  const distanceSection = document.createElement("div");
  distanceSection.className = "nearest-stop-distance";
  const distanceText = document.createElement("div");
  distanceText.className = "nearest-stop-distance-text";
  distanceText.textContent = `Yaklaşık ${distance} metre`;
  distanceSection.appendChild(distanceText);
  card.appendChild(distanceSection);

  nearestStopInfo.appendChild(card);
}


