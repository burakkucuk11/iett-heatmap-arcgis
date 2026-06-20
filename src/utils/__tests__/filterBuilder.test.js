import { describe, it, expect } from "vitest";
import { buildStopFilter } from "../filterBuilder.js";

describe("buildStopFilter", () => {
  it("returns '1=1' for empty string", () => {
    expect(buildStopFilter("")).toBe("1=1");
  });

  it("returns '1=1' for null", () => {
    expect(buildStopFilter(null)).toBe("1=1");
  });

  it("returns '1=1' for undefined", () => {
    expect(buildStopFilter(undefined)).toBe("1=1");
  });

  it("builds a LIKE filter for a simple search term", () => {
    const result = buildStopFilter("Taksim");
    expect(result).toContain("UPPER(ADI) LIKE UPPER('%Taksim%')");
    expect(result).toContain("UPPER(DURAK_KODU) LIKE UPPER('%Taksim%')");
    expect(result).toContain("UPPER(DURAK_TIPI) LIKE UPPER('%Taksim%')");
    expect(result).toContain("UPPER(YON_BILGISI) LIKE UPPER('%Taksim%')");
    expect(result).toContain("UPPER(CAST(ILCEID AS VARCHAR(20))) LIKE UPPER('%Taksim%')");
  });

  it("escapes single quotes to prevent SQL injection", () => {
    const result = buildStopFilter("O'Brien");
    expect(result).toContain("O''Brien");
    expect(result).not.toContain("O'Brien");
  });

  it("handles numeric search values", () => {
    const result = buildStopFilter("12345");
    expect(result).toContain("%12345%");
  });

  it("handles search with spaces", () => {
    const result = buildStopFilter("Kadıköy İskele");
    expect(result).toContain("%Kadıköy İskele%");
  });

  it("connects all field conditions with OR", () => {
    const result = buildStopFilter("test");
    const orCount = (result.match(/\bOR\b/g) || []).length;
    expect(orCount).toBe(4);
  });

  it("strips SQL wildcards and metacharacters from search", () => {
    const result = buildStopFilter("test%value");
    expect(result).toContain("testvalue");
    expect(result).not.toContain("test%value");
  });

  it("escapes underscores in search", () => {
    const result = buildStopFilter("test_value");
    expect(result).toContain("test\\_value");
  });

  it("strips semicolons and dashes", () => {
    const result = buildStopFilter("test;--DROP");
    expect(result).not.toContain(";");
    expect(result).not.toContain("--");
  });
});
