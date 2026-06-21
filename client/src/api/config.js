
const HOST = import.meta.env.VITE_API_HOST || "localhost:5010";

export const API_BASE_URL = `http://${HOST}`;
export const WS_BASE_URL = `ws://${HOST}`;

// Endpoints paths
export const ENDPOINTS = {
  activities: "/activities", // GET (cursor) + POST
  activitiesStream: "/ws/activities", // WebSocket real-time feed
};

// Header the backend reads to scope every request to a tenant.
export const TENANT_HEADER = "x-tenant-id";
