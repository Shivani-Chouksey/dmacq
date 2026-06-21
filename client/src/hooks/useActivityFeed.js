import { useState, useEffect, useCallback } from "react";
import {
  fetchActivities,
  createActivity as createActivityApi,
} from "../api/activityApi.js";
import { subscribeActivities } from "../api/realtime.js";

const PAGE_SIZE = 5;
let tempSeq = 0;

export function useActivityFeed(tenantId) {
  const [activities, setActivities] = useState([]);
  const [cursor, setCursor] = useState(null); // ISO date of last loaded item
  const [hasMore, setHasMore] = useState(true);
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Add items, skipping any _id already in the list.
  const merge = useCallback((incoming, position) => {
    setActivities((prev) => {
      const ids = new Set(prev.map((a) => a._id));
      const fresh = incoming.filter((a) => !ids.has(a._id));
      if (fresh.length === 0) return prev; // no change => no re-render
      return position === "prepend" ? [...fresh, ...prev] : [...prev, ...fresh];
    });
  }, []);

  // --- Initial load -------------------------------------------------------
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");

    fetchActivities({ tenantId, limit: PAGE_SIZE, signal: controller.signal })
      .then(({ data, pageInfo }) => {
        setActivities(data);
        setCursor(pageInfo.nextCursor);
        setHasMore(pageInfo.hasMore);
        setStatus("success");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setStatus("error");
      });

    return () => controller.abort();
  }, [tenantId]);

  // --- Infinite scroll: load the next cursor page -------------------------
  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const { data, pageInfo } = await fetchActivities({
        tenantId,
        cursor,
        limit: PAGE_SIZE,
      });
      merge(data, "append");
      setCursor(pageInfo.nextCursor);
      setHasMore(pageInfo.hasMore);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [tenantId, cursor, merge]);

  // --- Real-time updates (WebSocket): prepend live activities -------------
  useEffect(() => {
    return subscribeActivities(tenantId, (activity) =>
      merge([activity], "prepend")
    );
  }, [tenantId, merge]);

  const addActivity = useCallback(
    async (payload) => {
      tempSeq += 1;
      const tempId = `temp_${tempSeq}`;
      const optimistic = {
        ...payload,
        _id: tempId,
        createdAt: new Date().toISOString(),
        metadata: payload.metadata || {},
        _status: "pending",
      };

      setActivities((prev) => [optimistic, ...prev]); // optimistic insert

      try {
        const { data: saved } = await createActivityApi({ tenantId, payload });
        setActivities((prev) => {
        
          const swapped = prev.map((a) =>
            a._id === tempId ? { ...saved, _status: "ok" } : a
          );
          const seen = new Set();
          return swapped.filter((a) => {
            if (seen.has(a._id)) return false;
            seen.add(a._id);
            return true;
          });
        });
        return { ok: true, activity: saved };
      } catch (err) {
        setActivities((prev) => prev.filter((a) => a._id !== tempId));
        setError(`Failed to create activity: ${err.message}`);
        return { ok: false, error: err.message };
      }
    },
    [tenantId]
  );

  return {
    activities,
    status,
    loadingMore,
    hasMore,
    error,
    loadMore,
    addActivity,
  };
}
