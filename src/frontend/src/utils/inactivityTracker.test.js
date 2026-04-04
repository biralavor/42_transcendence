import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startInactivityTracker,
  stopInactivityTracker,
  resetInactivityTimer,
  isInWarningState,
  getTimeUntilLogout
} from './inactivityTracker';

describe('inactivityTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopInactivityTracker();
    vi.restoreAllMocks();
  });

  it('should trigger warning callback at warning threshold', () => {
    const onWarning = vi.fn();
    startInactivityTracker({ warningThresholdMs: 5000, logoutThresholdMs: 10000, onWarning });

    vi.advanceTimersByTime(4000);
    expect(onWarning).not.toHaveBeenCalled();
    expect(isInWarningState()).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(onWarning).toHaveBeenCalledOnce();
    expect(isInWarningState()).toBe(true);
  });

  it('should trigger logout callback at logout threshold', () => {
    const onLogout = vi.fn();
    startInactivityTracker({ warningThresholdMs: 5000, logoutThresholdMs: 10000, onLogout });

    vi.advanceTimersByTime(9000);
    expect(onLogout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('should not reset warning state on passive reset', () => {
    const onWarning = vi.fn();
    startInactivityTracker({ warningThresholdMs: 5000, logoutThresholdMs: 10000, onWarning });

    vi.advanceTimersByTime(5000);
    expect(isInWarningState()).toBe(true);

    resetInactivityTimer(false); // Passive reset
    expect(isInWarningState()).toBe(true);

    resetInactivityTimer(true); // Force reset
    expect(isInWarningState()).toBe(false);
  });

  it('should properly calculate time until logout', () => {
    startInactivityTracker({ warningThresholdMs: 5000, logoutThresholdMs: 10000 });
    expect(getTimeUntilLogout()).toBe(10000);

    vi.advanceTimersByTime(2000);
    expect(getTimeUntilLogout()).toBe(8000);
  });
});