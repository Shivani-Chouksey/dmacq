import { API_BASE_URL, ENDPOINTS, TENANT_HEADER } from "./config.js";


const ACTIVITIES_URL = `${API_BASE_URL}${ENDPOINTS.activities}`;

export async function fetchActivities({ tenantId, cursor, limit = 5, signal }) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(limit));

  const res = await fetch(`${ACTIVITIES_URL}?${params.toString()}`, {
    headers: { [TENANT_HEADER]: tenantId },
    signal,
  });

  if (!res.ok) {
    throw new Error(`fetchActivities failed: ${res.status}`);
  }
  return res.json();
}


export async function createActivity({ tenantId, payload, signal }) {
  const res = await fetch(ACTIVITIES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [TENANT_HEADER]: tenantId,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    throw new Error(`createActivity failed: ${res.status}`);
  }
  return res.json();
}
