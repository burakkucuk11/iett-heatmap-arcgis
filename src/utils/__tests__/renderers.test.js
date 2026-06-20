import { describe, it, expect } from "vitest";
import {
  heatmapRenderer,
  pointRenderer,
  stopLabelingInfo,
  clusterConfig,
  getRendererForZoom
} from "../renderers.js";

describe("renderers configuration", () => {
  describe("heatmapRenderer", () => {
    it("has type heatmap", () => {
      expect(heatmapRenderer.type).toBe("heatmap");
    });

    it("has colorStops defined", () => {
      expect(heatmapRenderer.colorStops).toHaveLength(5);
    });

    it("colorStops start at ratio 0 and end at ratio 1", () => {
      expect(heatmapRenderer.colorStops[0].ratio).toBe(0);
      expect(heatmapRenderer.colorStops[4].ratio).toBe(1);
    });

    it("has radius and density configured", () => {
      expect(heatmapRenderer.radius).toBe(10);
      expect(heatmapRenderer.maxDensity).toBe(0.045);
      expect(heatmapRenderer.minDensity).toBe(0);
    });
  });

  describe("pointRenderer", () => {
    it("has type simple", () => {
      expect(pointRenderer.type).toBe("simple");
    });

    it("uses a simple-marker circle symbol", () => {
      expect(pointRenderer.symbol.type).toBe("simple-marker");
      expect(pointRenderer.symbol.style).toBe("circle");
    });

    it("has the correct stop color", () => {
      expect(pointRenderer.symbol.color).toBe("#FDB462");
    });

    it("has a white outline", () => {
      expect(pointRenderer.symbol.outline.color).toBe("#ffffff");
    });
  });

  describe("stopLabelingInfo", () => {
    it("has exactly one label class", () => {
      expect(stopLabelingInfo).toHaveLength(1);
    });

    it("uses the ADI field for labels", () => {
      expect(stopLabelingInfo[0].labelExpressionInfo.expression).toBe("$feature.ADI");
    });

    it("has text symbol type", () => {
      expect(stopLabelingInfo[0].symbol.type).toBe("text");
    });

    it("places labels above center", () => {
      expect(stopLabelingInfo[0].labelPlacement).toBe("above-center");
    });
  });

  describe("clusterConfig", () => {
    it("has type cluster", () => {
      expect(clusterConfig.type).toBe("cluster");
    });

    it("has a cluster radius of 90px", () => {
      expect(clusterConfig.clusterRadius).toBe("90px");
    });

    it("has a popup template with cluster count", () => {
      expect(clusterConfig.popupTemplate.content).toContain("{cluster_count}");
    });

    it("has size visual variable with 3 stops", () => {
      const sizeVar = clusterConfig.renderer.visualVariables.find(
        (v) => v.type === "size"
      );
      expect(sizeVar).toBeDefined();
      expect(sizeVar.stops).toHaveLength(3);
    });
  });
});

describe("getRendererForZoom", () => {
  it("returns Heatmap mode for zoom < 12", () => {
    const result = getRendererForZoom(10);
    expect(result.mode).toBe("Heatmap");
    expect(result.renderer).toBe(heatmapRenderer);
    expect(result.featureReduction).toBeNull();
    expect(result.labelsVisible).toBe(false);
    expect(result.labelingInfo).toBeNull();
  });

  it("returns Heatmap mode for zoom 0", () => {
    const result = getRendererForZoom(0);
    expect(result.mode).toBe("Heatmap");
  });

  it("returns Heatmap mode for zoom 11.9", () => {
    const result = getRendererForZoom(11.9);
    expect(result.mode).toBe("Heatmap");
  });

  it("returns Cluster mode for zoom 12", () => {
    const result = getRendererForZoom(12);
    expect(result.mode).toBe("Cluster");
    expect(result.renderer).toBe(pointRenderer);
    expect(result.featureReduction).toBe(clusterConfig);
    expect(result.labelsVisible).toBe(false);
    expect(result.labelingInfo).toBeNull();
  });

  it("returns Cluster mode for zoom 14", () => {
    const result = getRendererForZoom(14);
    expect(result.mode).toBe("Cluster");
  });

  it("returns Cluster mode for zoom 14.9", () => {
    const result = getRendererForZoom(14.9);
    expect(result.mode).toBe("Cluster");
  });

  it("returns Point mode for zoom 15", () => {
    const result = getRendererForZoom(15);
    expect(result.mode).toBe("Point + Label + Effect");
    expect(result.renderer).toBe(pointRenderer);
    expect(result.featureReduction).toBeNull();
    expect(result.labelsVisible).toBe(true);
    expect(result.labelingInfo).toBe(stopLabelingInfo);
  });

  it("returns Point mode for zoom 18", () => {
    const result = getRendererForZoom(18);
    expect(result.mode).toBe("Point + Label + Effect");
  });

  it("returns Point mode for zoom 20", () => {
    const result = getRendererForZoom(20);
    expect(result.mode).toBe("Point + Label + Effect");
  });
});
