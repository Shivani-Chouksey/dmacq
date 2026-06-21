import React, { useState, useEffect } from "react";
import { useActivityFeed } from "../hooks/useActivityFeed.js";
import ActivityItem from "./ActivityItem.jsx";
import ActivityForm from "./ActivityForm.jsx";

const FILTER_TYPES = ["ALL", "CREATE", "UPDATE", "DELETE", "COMMENT", "LOGIN"];

export default function ActivityFeed({ tenantId }) {
  const {
    activities,
    status,
    loadingMore,
    hasMore,
    error,
    loadMore,
    addActivity,
  } = useActivityFeed(tenantId);

  const [filter, setFilter] = useState("ALL");
  const [sentinel, setSentinel] = useState(null);

  
  useEffect(() => {
    if (!sentinel || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" } // prefetch slightly before the bottom
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, hasMore, loadingMore, loadMore]);

  
  const visible =
    filter === "ALL" ? activities : activities.filter((a) => a.type === filter);

  return (
    <section className="feed">
      
      <ActivityForm onSubmit={addActivity} />

      <FilterBar filter={filter} onFilter={setFilter} />

      {error && <div className="banner banner-error">{error}</div>}

      {/* Loading state (initial) */}
      {status === "loading" && <div className="state">Loading feed…</div>}

      {/* Error state (initial load failed) */}
      {status === "error" && activities.length === 0 && (
        <div className="state state-error">Could not load activities.</div>
      )}

      {/* Empty state */}
      {status === "success" && visible.length === 0 && (
        <div className="state state-empty">
          {filter === "ALL" ? "No activity yet." : `No "${filter}" activity.`}
        </div>
      )}

      {/* The list */}
      {visible.length > 0 && (
        <ul className="activity-list">
          {visible.map((a) => (
            <ActivityItem key={a._id} activity={a} />
          ))}
        </ul>
      )}

      {/* Infinite-scroll sentinel + bottom states */}
      {hasMore ? (
        <div ref={setSentinel} className="sentinel">
          {loadingMore ? "Loading more…" : ""}
        </div>
      ) : (
        status === "success" &&
        activities.length > 0 && (
          <div className="state-end">You're all caught up.</div>
        )
      )}
    </section>
  );
}


const FilterBar = React.memo(function FilterBar({ filter, onFilter }) {
  return (
    <div className="toolbar">
      <div className="filters">
        {FILTER_TYPES.map((t) => (
          <button
            key={t}
            className={`chip ${filter === t ? "chip-active" : ""}`}
            onClick={() => onFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
});
