import { WS_BASE_URL, ENDPOINTS } from "./config.js";

export function subscribeActivities(tenantId, onActivity) {
  let ws = null;
  let reconnectTimer = null;
  let closedByCaller = false;
  let retry = 0;

  const url = () =>
    `${WS_BASE_URL}${ENDPOINTS.activitiesStream}?tenantId=${encodeURIComponent(
      tenantId
    )}`;

  const connect = () => {
    ws = new WebSocket(url());

    ws.onopen = () => {
      retry = 0;
    };

    ws.onmessage = (event) => {
      try {
        onActivity(JSON.parse(event.data));
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onclose = () => {
      if (closedByCaller) return;
      // Exponential backoff, capped at 10s.
      const delay = Math.min(1000 * 2 ** retry, 10000);
      retry += 1;
      reconnectTimer = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  };

  connect();

  // Unsubscribe: stop reconnecting and close the socket.
  return () => {
    closedByCaller = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (!ws) return;

    if (ws.readyState === WebSocket.CONNECTING) {
    
      ws.addEventListener("open", () => ws.close());
    } else {
      ws.close();
    }
  };
}
