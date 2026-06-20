const STOP_COLOR = "#FDB462";

export const heatmapRenderer = {
  type: "heatmap",
  colorStops: [
    { ratio: 0, color: "rgba(128, 177, 211, 0)" },
    { ratio: 0.35, color: "rgba(128, 177, 211, 0.16)" },
    { ratio: 0.58, color: "rgba(253, 180, 98, 0.34)" },
    { ratio: 0.82, color: "rgba(255, 145, 70, 0.50)" },
    { ratio: 1, color: "rgba(190, 45, 28, 0.68)" }
  ],
  radius: 10,
  maxDensity: 0.045,
  minDensity: 0
};

export const pointRenderer = {
  type: "simple",
  symbol: {
    type: "simple-marker",
    style: "circle",
    color: STOP_COLOR,
    size: 8,
    outline: {
      color: "#ffffff",
      width: 1
    }
  }
};

export const stopLabelingInfo = [
  {
    labelExpressionInfo: {
      expression: "$feature.ADI"
    },
    symbol: {
      type: "text",
      color: "#ffffff",
      haloColor: "#172536",
      haloSize: 1.5,
      font: {
        size: 10,
        weight: "bold",
        family: "Arial"
      }
    },
    labelPlacement: "above-center",
    minScale: 18000,
    maxScale: 0
  }
];

export const clusterConfig = {
  type: "cluster",
  clusterRadius: "90px",
  popupTemplate: {
    title: "Durak Kümesi",
    content: "Bu bölgede <b>{cluster_count}</b> adet IETT durağı var."
  },
  labelingInfo: [
    {
      deconflictionStrategy: "none",
      labelExpressionInfo: {
        expression: "Text($feature.cluster_count, '#,###')"
      },
      symbol: {
        type: "text",
        color: "#172536",
        font: {
          weight: "bold",
          size: "13px"
        }
      },
      labelPlacement: "center-center"
    }
  ],
  renderer: {
    type: "simple",
    symbol: {
      type: "simple-marker",
      style: "circle",
      color: STOP_COLOR,
      size: 28,
      outline: {
        color: "#ffffff",
        width: 1.2
      }
    },
    visualVariables: [
      {
        type: "size",
        field: "cluster_count",
        stops: [
          { value: 10, size: 22 },
          { value: 100, size: 40 },
          { value: 500, size: 62 }
        ]
      }
    ]
  }
};

/**
 * Determines the rendering mode based on the current zoom level.
 *
 * @param {number} zoom - Current map zoom level
 * @returns {{ mode: string, renderer: object, featureReduction: object|null, labelsVisible: boolean, labelingInfo: Array|null }}
 */
export function getRendererForZoom(zoom) {
  if (zoom < 12) {
    return {
      mode: "Heatmap",
      renderer: heatmapRenderer,
      featureReduction: null,
      labelsVisible: false,
      labelingInfo: null
    };
  } else if (zoom >= 12 && zoom < 15) {
    return {
      mode: "Cluster",
      renderer: pointRenderer,
      featureReduction: clusterConfig,
      labelsVisible: false,
      labelingInfo: null
    };
  } else {
    return {
      mode: "Point + Label + Effect",
      renderer: pointRenderer,
      featureReduction: null,
      labelsVisible: true,
      labelingInfo: stopLabelingInfo
    };
  }
}
