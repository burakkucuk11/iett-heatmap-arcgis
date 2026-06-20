import { describe, it, expect, beforeEach } from "vitest";
import { setupCounter } from "../counter.js";

describe("setupCounter", () => {
  let element;

  beforeEach(() => {
    element = document.createElement("button");
  });

  it("initializes the counter display to 0", () => {
    setupCounter(element);
    expect(element.innerHTML).toBe("Count is 0");
  });

  it("increments the counter on click", () => {
    setupCounter(element);
    element.click();
    expect(element.innerHTML).toBe("Count is 1");
  });

  it("increments multiple times on multiple clicks", () => {
    setupCounter(element);
    element.click();
    element.click();
    element.click();
    expect(element.innerHTML).toBe("Count is 3");
  });

  it("keeps counting past single digits", () => {
    setupCounter(element);
    for (let i = 0; i < 15; i++) {
      element.click();
    }
    expect(element.innerHTML).toBe("Count is 15");
  });
});
