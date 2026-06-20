import { describe, it, expect } from "vitest";
import { formatNumber } from "../formatNumber.js";

describe("formatNumber", () => {
  it("formats a small number without separators", () => {
    expect(formatNumber(5)).toBe("5");
  });

  it("formats hundreds without separators", () => {
    expect(formatNumber(999)).toBe("999");
  });

  it("formats thousands with a period separator (TR locale)", () => {
    const result = formatNumber(1000);
    // Turkish locale uses '.' as thousands separator
    expect(result).toBe("1.000");
  });

  it("formats tens of thousands", () => {
    expect(formatNumber(12345)).toBe("12.345");
  });

  it("formats millions", () => {
    expect(formatNumber(1000000)).toBe("1.000.000");
  });

  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats negative numbers", () => {
    const result = formatNumber(-1500);
    expect(result).toContain("1.500");
    expect(result).toContain("-");
  });

  it("formats decimal numbers with comma as decimal separator", () => {
    const result = formatNumber(1234.56);
    expect(result).toContain("1.234");
    expect(result).toContain(",");
  });
});
