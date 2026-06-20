import "./style.css";

import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import Search from "@arcgis/core/widgets/Search.js";
import Directions from "@arcgis/core/widgets/Directions.js";
import RouteLayer from "@arcgis/core/layers/RouteLayer.js";
import FeatureTable from "@arcgis/core/widgets/FeatureTable.js";
import Graphic from "@arcgis/core/Graphic.js";
import esriConfig from "@arcgis/core/config.js";

import { ISTANBUL_CENTER, START_POINT_COLOR, ZOOM_THRESHOLDS, DEFAULT_WHERE } from "./config/constants.js";
import { heatmapRenderer, pointRenderer, stopLabelingInfo, clusterConfig } from "./config/renderers.js";
import { setInfo, formatNumber, debounce, setButtonState, togglePanel } from "./utils/dom.js";
import { haversineDistanceMeters, getUserLocationPoint, createLayerQuery } from "./utils/geo.js";
import { safeRemoveAll, createPopupContent, createCoordinatePopupContent } from "./utils/route.js";

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

    container.innerHTML = `
      <b>Durak Adı:</b> ${escapeHtml(attributes.ADI)}<br/>
      <b>Durak Kodu:</b> ${escapeHtml(attributes.DURAK_KODU)}<br/>
      <b>Durak Tipi:</b> ${escapeHtml(attributes.DURAK_TIPI)}<br/>
      <b>Yön Bilgisi:</b> ${escapeHtml(attributes.YON_BILGISI)}<br/>
      <b>Durumu:</b> ${escapeHtml(attributes.DURUMU)}<br/>
      <b>İlçe ID:</b> ${escapeHtml(attributes.ILCEID)}<br/>
      <b>Mahalle ID:</b> ${escapeHtml(attributes.MAHALLEID)}<br/>
    `;

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
});

const routeLayer = new RouteLayer({
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

const searchWidget = new Search({
  view,
  includeDefaultSources: true,
  allPlaceholder: "Durak, kod veya adres ara",
  sources: [
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
  ]
});

view.ui.add(searchWidget, {
  position: "top-left"
});

const directionsWidget = new Directions({
  view,
  layer: routeLayer,
  apiKey: esriConfig.apiKey,
  container: "directionsContainer",
  visibleElements: {
    saveAsButton: false,
    saveButton: false,
    printButton: false,
    directionsListElement: true
  },
  autoComplete: false
});

const featureTable = new FeatureTable({
  view,
  layer: iettLayer,
  container: "tableContainer",
  multiSortEnabled: true,
  highlightEnabled: true,
  fieldConfigs: [
    { name: "ADI", label: "Durak Adı" },
    { name: "DURAK_KODU", label: "Durak Kodu" },
    { name: "DURAK_TIPI", label: "Durak Tipi" },
    { name: "YON_BILGISI", label: "Yön Bilgisi" },
    { name: "DURUMU", label: "Durumu" },
    { name: "ILCEID", label: "İlçe ID" },
    { name: "MAHALLEID", label: "Mahalle ID" }
  ],
  visibleElements: {
    menuItems: {
      clearSelection: true,
      refreshData: true,
      toggleColumns: true,
      selectedRecordsShowAllToggle: true,
      zoomToSelection: true
    }
  }
});

const directionsPanel = document.getElementById("directionsPanel");
const directionsContainer = document.getElementById("directionsContainer");
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

view.watch("zoom", () => {
  applyZoomBasedRenderer();
});

view.watch("extent", debounce(async () => {
  try {
    await updateVisibleCountByExtent();
  } catch (error) {
    console.error("Extent değişikliğinde durak sayısı güncellenemedi:", error);
  }
}, 400));

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
});

useLocationNearestBtn.addEventListener("click", async () => {
  setButtonState(useLocationNearestBtn, { text: "Konum alınıyor...", disabled: true });

  try {
    const userPoint = await getUserLocationPoint();

    if (userPoint) {
      const nearest = await findNearestStop(userPoint);
      if (nearest) {
        showNearestStopInfo(nearest, userPoint);
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
        showNearestStopInfo(nearest, event.mapPoint);
      } else {
        setInfo("Seçilen noktaya yakın durak bulunamadı.");
      }

      isSelectingNearestFromMap = false;
      setButtonState(selectFromMapNearestBtn, { text: "🗺️ Haritadan Seç", disabled: false });
      return;
    }

    if (isSelectingStartPoint) {
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

      return;
    }

    pendingRouteTarget = {
      geometry: event.mapPoint,
      name: "Seçilen Nokta"
    };

    const pointContainer = document.createElement("div");
    pointContainer.style.lineHeight = "1.7";

    pointContainer.innerHTML = `
      <b>Koordinat:</b><br/>
      X: ${event.mapPoint.longitude?.toFixed(6) || "-"}<br/>
      Y: ${event.mapPoint.latitude?.toFixed(6) || "-"}<br/>
    `;

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

  zoomStatus.innerText = `Zoom ${zoom.toFixed(1)}`;

  if (zoom < ZOOM_THRESHOLDS.HEATMAP_MAX) {
    iettLayer.renderer = heatmapRenderer;
    iettLayer.featureReduction = null;
    iettLayer.featureEffect = null;
    iettLayer.labelingInfo = null;
    iettLayer.labelsVisible = false;

    activeMode.innerText = "Heatmap";
  } else if (zoom < ZOOM_THRESHOLDS.CLUSTER_MAX) {
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
      OR CAST(ILCEID AS VARCHAR(20)) LIKE '%${safeValue}%'
    `;
  }

  iettLayer.definitionExpression = currentWhere;

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

function getUserLocationPoint() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("Geolocation API desteklenmiyor.");
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(
          new Point({
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            spatialReference: { wkid: 4326 }
          })
        );
      },
      (error) => {
        console.warn("Konum alınamadı:", error.message, `(code: ${error.code})`);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  });
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
    await directionsWidget.when();
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
    await directionsWidget.viewModel.getDirections();

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
  safeRemoveAll(directionsWidget.viewModel?.reset && null, "Directions reset");

  try {
    if (directionsWidget.viewModel && directionsWidget.viewModel.reset) {
      directionsWidget.viewModel.reset();
    }
  } catch (error) {
    console.warn("Directions reset çalışmadı:", error);
  }

  safeRemoveAll(routeLayer.stops, "Stops");
  safeRemoveAll(routeLayer.directionLines, "Direction lines");
  safeRemoveAll(routeLayer.routes, "Routes");

  hasActiveRoute = false;
  isSelectingRouteTarget = false;
  updateRouteButtonState();

  const routeInfoPanel = document.getElementById("routeInfoPanel");

  if (routeInfoPanel) {
    routeInfoPanel.innerHTML = "";
  }

  if (!directionsPanel.classList.contains("hidden") && selectedStartPoint) {
    directionsContainer.innerHTML = `
      <div style="padding: 15px; background: #4CAF50; color: white; border-radius: 4px; margin-bottom: 15px; text-align: center;">
        <strong>✓ Başlangıç noktası hala aktif</strong><br/>
        <small>Haritada yeni bir hedef noktası tıkla</small>
      </div>
    `;

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

  directionsContainer.innerHTML = `
    <div style="padding: 15px; background: #4CAF50; color: white; border-radius: 4px; margin-bottom: 15px; text-align: center;">
      <strong>✓ Başlangıç noktası ayarlandı</strong><br/>
      <small>Haritada rota hedefi olan bir durak veya nokta tıkla</small>
    </div>
  `;

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

function showStartPointMenu() {
  directionsContainer.innerHTML = `
    <div style="padding: 20px; text-align: center; background: #f5f5f5; border-radius: 8px; margin-bottom: 15px;">
      <h3 style="margin-top: 0; margin-bottom: 15px; color: #333;">
        Başlangıç Noktası Seç
      </h3>

      <button id="useLocationBtn" style="width: 100%; padding: 12px; margin-bottom: 10px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
        📍 Konumumu Kullan (GPS)
      </button>

      <button id="selectFromMapBtn" style="width: 100%; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
        🗺️ Haritadan Seç
      </button>

      <p style="margin-top: 15px; font-size: 12px; color: #666;">
        Başlangıç noktası seçildikten sonra haritada hedef durağı veya noktayı tıkla.
      </p>
    </div>
  `;

  document.getElementById("useLocationBtn").addEventListener("click", async () => {
    setInfo("Konum alınıyor...");

    const userPoint = await getUserLocationPoint();

    if (userPoint) {
      setStartPoint(userPoint);
    } else {
      setInfo("Konum alınamadı. Haritadan manuel seç.");
      showStartPointMenu();
    }
  });

  document.getElementById("selectFromMapBtn").addEventListener("click", () => {
    isSelectingStartPoint = true;

    directionsContainer.innerHTML = `
      <div style="padding: 15px; background: #FF9800; color: white; border-radius: 4px; margin-bottom: 15px; text-align: center;">
        <strong>🎯 Haritada başlangıç noktasını seç</strong><br/>
        <small>Haritaya tıklayarak başlangıç noktasını işaretle</small>
      </div>
    `;

    setInfo("Haritada başlangıç noktası için bir nokta tıkla.");
  });
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

  nearestStopInfo.innerHTML = `
    <div style="background: rgba(253, 180, 98, 0.15); padding: 15px; border-radius: 8px; border-left: 4px solid #FDB462;">
      <h4 style="margin: 0 0 10px 0; color: #FDB462;">
        📍 ${escapeHtml(stop.attributes.ADI)}
      </h4>

      <div style="font-size: 13px; line-height: 1.8; color: #D9D9D9;">
        <div><strong>Durak Kodu:</strong> ${escapeHtml(stop.attributes.DURAK_KODU)}</div>
        <div><strong>Durak Tipi:</strong> ${escapeHtml(stop.attributes.DURAK_TIPI)}</div>
        <div><strong>Yön Bilgisi:</strong> ${escapeHtml(stop.attributes.YON_BILGISI)}</div>
        <div><strong>Durumu:</strong> ${escapeHtml(stop.attributes.DURUMU)}</div>
      </div>

      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2);">
        <div style="font-size: 12px; color: #FDB462; margin-bottom: 6px;">
          ⏱️ Yaklaşık ${distance} metre
        </div>
      </div>

      <button id="startRouteToNearestBtn" style="width: 100%; margin-top: 12px; padding: 10px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
        Bu Durağa Rota Oluştur
      </button>
    </div>
  `;

  document.getElementById("startRouteToNearestBtn").addEventListener("click", async () => {
    if (selectedStartPoint) {
      await createRoute(selectedStartPoint, stop.geometry, stop.attributes.ADI);
      togglePanel(nearestStopPanel, { show: false });
      setInfo(`${stop.attributes.ADI} durağına rota oluşturuldu.`);
    } else {
      togglePanel(directionsPanel, { show: true });
      toggleDirectionsBtn.innerText = "Paneli Kapat";
      showStartPointMenu();
      setInfo("Önce başlangıç noktası seç.");
    }
  });
}

function haversineDistanceMeters(lon1, lat1, lon2, lat2) {
  const radius = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return radius * c;
}

function escapeHtml(str) {
  if (str == null) return "-";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setInfo(message) {
  const info = document.getElementById("info");

  if (info) {
    info.innerText = message;
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR").format(value);
}

function debounce(callback, delay) {
  let timeout;

  return (...args) => {
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      callback(...args);
    }, delay);
  };
}
