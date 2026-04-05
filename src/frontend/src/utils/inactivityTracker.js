let checkIntervalId = null;
let lastActivityTime = Date.now();
let isWarning = false;
let config = null;

export const DEFAULT_WARNING_THRESHOLD_MINUTES = 15;
export const DEFAULT_LOGOUT_THRESHOLD_MINUTES = 20;
export const ACTIVITY_DEBOUNCE_SECONDS = 10;

export const ACTIVITY_EVENTS = [
  'mousemove',
  'click',
  'keydown',
  'scroll',
  'touchstart',
  'focusin'
];

export function startInactivityTracker(options = {}) {
  config = {
    warningThresholdMs: DEFAULT_WARNING_THRESHOLD_MINUTES * 60 * 1000,
    logoutThresholdMs: DEFAULT_LOGOUT_THRESHOLD_MINUTES * 60 * 1000,
    checkIntervalMs: 1000,
    onWarning: () => {},
    onLogout: () => {},
    ...options
  };
  lastActivityTime = Date.now();
  isWarning = false;

  if (checkIntervalId) clearInterval(checkIntervalId);

  checkIntervalId = setInterval(() => {
    const idleTime = Date.now() - lastActivityTime;

    if (idleTime >= config.logoutThresholdMs) {
      const onLogout = config.onLogout;
      stopInactivityTracker();
      if (onLogout) onLogout();
    } else if (idleTime >= config.warningThresholdMs && !isWarning) {
      isWarning = true;
      if (config.onWarning) config.onWarning();
    }
  }, config.checkIntervalMs);
}

export function resetInactivityTimer(force = false) {
  // If we are in the warning state, passive activity (like mousemove)
  // should not reset the timer or dismiss the warning.
  // Only an explicit 'force' reset (e.g., clicking "Stay Logged In") works.
  if (isWarning && !force) return;

  lastActivityTime = Date.now();
  isWarning = false;
}

export function stopInactivityTracker() {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
  isWarning = false;
  config = null;
}

export function isInWarningState() {
  return isWarning;
}

export function getTimeUntilLogout() {
  if (!config) return 0;
  const idleTime = Date.now() - lastActivityTime;
  const remaining = config.logoutThresholdMs - idleTime;
  return Math.max(0, remaining);
}