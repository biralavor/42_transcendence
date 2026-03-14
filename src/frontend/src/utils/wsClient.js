/**
 * createWsClient — thin WebSocket wrapper with JSON serialization
 * and exponential-backoff reconnection.
 *
 * @param {string} url - WebSocket URL
 * @param {{ onMessage?: Function, onOpen?: Function, onClose?: Function }} handlers
 * @returns {{ send: Function, close: Function }}
 */
export function createWsClient(url, { onMessage, onOpen, onClose } = {}) {
  let ws;
  let retryDelay = 1000;
  let intentionallyClosed = false;

  function connect() {
    ws = new WebSocket(url);

    ws.onopen = () => {
      retryDelay = 1000;
      onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        onMessage?.(JSON.parse(event.data));
      } catch {
        onMessage?.(event.data);
      }
    };

    ws.onclose = () => {
      onClose?.();
      if (!intentionallyClosed) {
        setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      }
    };
  }

  connect();

  return {
    send(data) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    },
    close() {
      intentionallyClosed = true;
      ws.close();
    },
  };
}
