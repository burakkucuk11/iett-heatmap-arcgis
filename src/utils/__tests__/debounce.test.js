import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce } from "../debounce.js";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call immediately", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();

    expect(fn).not.toHaveBeenCalled();
  });

  it("calls the function after the delay", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledOnce();
  });

  it("resets the timer on subsequent calls", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    vi.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("passes arguments to the callback", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("hello", 42);
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("hello", 42);
  });

  it("uses the latest arguments when called multiple times", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("first");
    debounced("second");
    debounced("third");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith("third");
  });

  it("can be called multiple times after delay elapses", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("a");
    vi.advanceTimersByTime(100);

    debounced("b");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, "a");
    expect(fn).toHaveBeenNthCalledWith(2, "b");
  });

  it("handles zero delay", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 0);

    debounced();
    vi.advanceTimersByTime(0);

    expect(fn).toHaveBeenCalledOnce();
  });
});
