import { describe, it, expect } from "vitest";
import { haversineDistanceMeters } from "../haversine.js";

describe("haversineDistanceMeters", () => {
  it("returns 0 for two identical points", () => {
    const distance = haversineDistanceMeters(28.9784, 41.0082, 28.9784, 41.0082);
    expect(distance).toBe(0);
  });

  it("calculates correct distance between Istanbul and Ankara (approx 350km)", () => {
    // Istanbul (28.9784, 41.0082) -> Ankara (32.8597, 39.9334)
    const distance = haversineDistanceMeters(28.9784, 41.0082, 32.8597, 39.9334);
    // Expected ~350km
    expect(distance).toBeGreaterThan(340000);
    expect(distance).toBeLessThan(360000);
  });

  it("calculates short distances accurately (Taksim to Galata, ~1.2km)", () => {
    // Taksim Square (28.9853, 41.0370) -> Galata Tower (28.9741, 41.0256)
    const distance = haversineDistanceMeters(28.9853, 41.0370, 28.9741, 41.0256);
    expect(distance).toBeGreaterThan(1000);
    expect(distance).toBeLessThan(1600);
  });

  it("is commutative (distance A->B equals B->A)", () => {
    const ab = haversineDistanceMeters(28.9784, 41.0082, 32.8597, 39.9334);
    const ba = haversineDistanceMeters(32.8597, 39.9334, 28.9784, 41.0082);
    expect(ab).toBeCloseTo(ba, 6);
  });

  it("handles crossing the prime meridian", () => {
    // London (0.1278 W, 51.5074) -> Paris (2.3522 E, 48.8566)
    const distance = haversineDistanceMeters(-0.1278, 51.5074, 2.3522, 48.8566);
    // Expected ~340km
    expect(distance).toBeGreaterThan(330000);
    expect(distance).toBeLessThan(350000);
  });

  it("handles crossing the equator", () => {
    // Quito (78.4678 W, 0.1807 S) -> Bogota (74.0721 W, 4.7110 N)
    const distance = haversineDistanceMeters(-78.4678, -0.1807, -74.0721, 4.7110);
    // Expected ~730km
    expect(distance).toBeGreaterThan(700000);
    expect(distance).toBeLessThan(760000);
  });

  it("handles antipodal points (max distance ~20000km)", () => {
    const distance = haversineDistanceMeters(0, 0, 180, 0);
    // Half the Earth's circumference ~20015km
    expect(distance).toBeGreaterThan(20000000);
    expect(distance).toBeLessThan(20100000);
  });

  it("handles very small distances (< 100m)", () => {
    // Two points about 50 meters apart
    const distance = haversineDistanceMeters(28.9784, 41.0082, 28.9790, 41.0082);
    expect(distance).toBeGreaterThan(30);
    expect(distance).toBeLessThan(80);
  });
});
