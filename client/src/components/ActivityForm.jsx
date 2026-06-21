import React, { useState, useCallback } from "react";

const TYPES = ["CREATE", "UPDATE", "DELETE", "COMMENT", "LOGIN", "CUSTOM"];


function ActivityForm({ onSubmit }) {
  const [actorName, setActorName] = useState("");
  const [type, setType] = useState("CREATE");
  const [entityId, setEntityId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!actorName.trim() || !entityId.trim()) {
        setMessage({ kind: "error", text: "Actor and entity are required." });
        return;
      }

      setSubmitting(true);
      setMessage(null);

      const result = await onSubmit({
        actorId: actorName.trim().toLowerCase().replace(/\s+/g, "_"),
        actorName: actorName.trim(),
        type,
        entityId: entityId.trim(),
        metadata: { source: "form" },
      });

      setSubmitting(false);

      if (result?.ok) {
        // Reset only on success.
        setActorName("");
        setEntityId("");
        setType("CREATE");
        setMessage({ kind: "ok", text: "Activity created." });
      } else {
        // Optimistic item was rolled back in the hook; tell the user.
        setMessage({
          kind: "error",
          text: result?.error || "Failed to create activity.",
        });
      }
    },
    [actorName, type, entityId, onSubmit]
  );

  return (
    <form className="activity-form" onSubmit={handleSubmit}>
      <input
        className="input"
        placeholder="Actor name"
        value={actorName}
        onChange={(e) => setActorName(e.target.value)}
        disabled={submitting}
      />
      <select
        className="input"
        value={type}
        onChange={(e) => setType(e.target.value)}
        disabled={submitting}
      >
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input
        className="input"
        placeholder="Entity id (e.g. doc_42)"
        value={entityId}
        onChange={(e) => setEntityId(e.target.value)}
        disabled={submitting}
      />
      <button className="btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add activity"}
      </button>

      {message && (
        <span className={`form-msg form-msg-${message.kind}`}>
          {message.text}
        </span>
      )}
    </form>
  );
}

export default React.memo(ActivityForm);
