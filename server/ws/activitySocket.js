import { WebSocketServer } from "ws";

const tenantClients = new Map();

let wss = null;

export function initActivitySocket(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: "/ws/activities" });

  wss.on("connection", (ws, req) => {
    const { searchParams } = new URL(req.url, "http://localhost");
    const tenantId = searchParams.get("tenantId");

    // Tenant is mandatory — reject anonymous connections.
    if (!tenantId) {
      ws.close(1008, "tenantId required");
      return;
    }

    if (!tenantClients.has(tenantId)) tenantClients.set(tenantId, new Set());
    tenantClients.get(tenantId).add(ws);

    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("close", () => {
      const set = tenantClients.get(tenantId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) tenantClients.delete(tenantId);
      }
    });
  });

 
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(heartbeat));

  console.log("🔌 WebSocket server ready on /ws/activities");
  return wss;
}


export function broadcastActivity(activity) {
  const set = tenantClients.get(activity.tenantId);
  if (!set || set.size === 0) return;

  const payload = JSON.stringify({
    _id: String(activity._id),
    actorId: activity.actorId,
    actorName: activity.actorName,
    type: activity.type,
    entityId: activity.entityId,
    metadata: activity.metadata,
    createdAt: activity.createdAt,
  });

  for (const ws of set) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}
