import React from "react";

function ActivityItem({ activity }) {
  const { actorName, type, entityId, createdAt, _status } = activity;

  return (
    <li className={`activity-item ${_status === "pending" ? "is-pending" : ""}`}>
      <span className={`badge badge-${type.toLowerCase()}`}>{type}</span>
      <span className="actor">{actorName}</span>
      <span className="entity">{entityId}</span>
      <time className="time">{new Date(createdAt).toLocaleTimeString()}</time>
      {_status === "pending" && <span className="pending-tag">sending…</span>}
    </li>
  );
}

export default React.memo(ActivityItem);
