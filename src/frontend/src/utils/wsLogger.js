/**
 * WebSocket Logger - Tracks payloads and latency for game waiting room
 * Usage: 
 *   wsLogger.ready('user-123', { type: 'player_ready', player_id: 123 })
 *   wsLogger.receive('game-invite-1-2-1234', { type: 'state', players: [...] })
 *   wsLogger.latency('ready_to_broadcast', startTime)
 */

const WS_LOG_ENABLED = true; // Set to false to disable all logging

class WebSocketLogger {
  constructor() {
    this.events = [];
    this.maxEvents = 100; // Keep last 100 events in memory
  }

  /**
   * Get current high-resolution timestamp in milliseconds
   */
  getTimestamp() {
    return performance.now();
  }

  /**
   * Format a log entry with styling for browser console
   */
  formatLog(level, category, message, data = null) {
    const timestamp = new Date().toISOString();
    const levelColor = {
      info: '#0066cc',
      error: '#cc0000',
      warn: '#ff9900',
      debug: '#666666',
    }[level] || '#000000';

    const prefix = `%c[${timestamp}] [${level.toUpperCase()}] [${category}]`;
    const args = [`${prefix}%c ${message}`, `color: ${levelColor}; font-weight: bold;`, 'color: #333'];

    if (data) {
      args.push(data);
    }

    return { prefix, args };
  }

  /**
   * Log ready button click with payload
   */
  ready(roomId, payload) {
    if (!WS_LOG_ENABLED) return;

    const entry = {
      type: 'ready_click',
      roomId,
      payload,
      timestamp: this.getTimestamp(),
      iso: new Date().toISOString(),
    };

    this.events.push(entry);
    if (this.events.length > this.maxEvents) this.events.shift();

    const { args } = this.formatLog('info', 'GameWaitingRoom', '🔘 Ready button clicked');
    console.log(...args, { roomId, payload, ts: entry.timestamp.toFixed(2) });
  }

  /**
   * Log WebSocket message sent
   */
  send(roomId, payload) {
    if (!WS_LOG_ENABLED) return;

    const entry = {
      type: 'send',
      roomId,
      payload,
      timestamp: this.getTimestamp(),
      iso: new Date().toISOString(),
    };

    this.events.push(entry);
    if (this.events.length > this.maxEvents) this.events.shift();

    const { args } = this.formatLog('info', 'WS Send', `↗️  Payload sent`, { roomId, payload });
    console.log(...args);
  }

  /**
   * Log WebSocket message received
   */
  receive(roomId, payload) {
    if (!WS_LOG_ENABLED) return;

    const entry = {
      type: 'receive',
      roomId,
      payload,
      timestamp: this.getTimestamp(),
      iso: new Date().toISOString(),
    };

    this.events.push(entry);
    if (this.events.length > this.maxEvents) this.events.shift();

    const { args } = this.formatLog('info', 'WS Receive', `↙️  Payload received`, {
      roomId,
      payload,
    });
    console.log(...args);
  }

  /**
   * Log connection state change
   */
  connection(roomId, state, metadata = {}) {
    if (!WS_LOG_ENABLED) return;

    const entry = {
      type: 'connection',
      roomId,
      state,
      metadata,
      timestamp: this.getTimestamp(),
      iso: new Date().toISOString(),
    };

    this.events.push(entry);
    if (this.events.length > this.maxEvents) this.events.shift();

    const icon = state === 'open' ? '🔗' : '🔌';
    const { args } = this.formatLog('debug', 'WS Connection', `${icon} ${state}`, {
      roomId,
      metadata,
    });
    console.log(...args);
  }

  /**
   * Log UI state update after receiving payload
   */
  uiUpdate(roomId, updateData) {
    if (!WS_LOG_ENABLED) return;

    const entry = {
      type: 'ui_update',
      roomId,
      updateData,
      timestamp: this.getTimestamp(),
      iso: new Date().toISOString(),
    };

    this.events.push(entry);
    if (this.events.length > this.maxEvents) this.events.shift();

    const { args } = this.formatLog('info', 'UI Update', `🎨 State updated`, {
      roomId,
      updateData,
    });
    console.log(...args);
  }

  /**
   * Calculate and log latency between two events
   * Usage: wsLogger.latency('ready_to_broadcast', readyClickTime)
   * Returns latency in milliseconds
   */
  latency(label, startTimestamp) {
    if (!WS_LOG_ENABLED) return null;

    const endTimestamp = this.getTimestamp();
    const latencyMs = (endTimestamp - startTimestamp).toFixed(2);

    const entry = {
      type: 'latency',
      label,
      latencyMs: parseFloat(latencyMs),
      startTimestamp,
      endTimestamp,
      iso: new Date().toISOString(),
    };

    this.events.push(entry);
    if (this.events.length > this.maxEvents) this.events.shift();

    const { args } = this.formatLog('info', 'Latency', `⏱️  ${label}`, {
      latencyMs: `${latencyMs}ms`,
    });
    console.log(...args);

    return parseFloat(latencyMs);
  }

  /**
   * Log complete flow (ready → send → receive → ui update)
   */
  flowStart(roomId, label) {
    if (!WS_LOG_ENABLED) return this.getTimestamp();

    const { args } = this.formatLog('debug', 'Flow', `▶️  Flow started: ${label}`, { roomId });
    console.log(...args);

    return this.getTimestamp();
  }

  flowEnd(roomId, label, startTime) {
    if (!WS_LOG_ENABLED) return null;

    const latency = this.latency(`${label} (complete flow)`, startTime);
    const { args } = this.formatLog('info', 'Flow', `✅ Flow completed: ${label}`, {
      totalLatencyMs: `${latency}ms`,
    });
    console.log(...args);

    return latency;
  }

  /**
   * Export all events for debugging
   */
  export() {
    return {
      exportedAt: new Date().toISOString(),
      eventCount: this.events.length,
      events: this.events,
    };
  }

  /**
   * Clear all logged events
   */
  clear() {
    this.events = [];
  }

  /**
   * Get summary statistics
   */
  summary() {
    const summary = {
      totalEvents: this.events.length,
      byType: {},
      timeSpan: null,
    };

    this.events.forEach((event) => {
      summary.byType[event.type] = (summary.byType[event.type] || 0) + 1;
    });

    if (this.events.length > 1) {
      const first = this.events[0].timestamp;
      const last = this.events[this.events.length - 1].timestamp;
      summary.timeSpan = `${(last - first).toFixed(2)}ms`;
    }

    return summary;
  }
}

// Create singleton instance
const wsLogger = new WebSocketLogger();

export default wsLogger;
