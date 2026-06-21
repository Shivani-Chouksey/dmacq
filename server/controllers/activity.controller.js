import { ActivityModel, VALID_TYPES } from "../models/activity.model.js";
import { buildCursorFilter, getNextCursor } from "../utils/pagination.js";
import { broadcastActivity } from "../ws/activitySocket.js";


const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const PROJECTION = "actorId actorName type entityId metadata createdAt";

async function createActivity(req, res) {
  try {
    const tenantId = req.tenantId; // guaranteed by resolveTenant middleware
    const { actorId, actorName, type, entityId, metadata } = req.body;

   
    if (!actorId || !actorName || !type || !entityId) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "actorId, actorName, type and entityId are required",
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: "INVALID_TYPE",
        message: `type must be one of: ${VALID_TYPES.join(", ")}`,
      });
    }

  
    const activity = await ActivityModel.create({
      tenantId,
      actorId,
      actorName,
      type,
      entityId,
      metadata: metadata || {},
      createdAt: new Date(),
    });

    // Push to this tenant's connected WebSocket clients (real-time feed).
    broadcastActivity(activity);

    return res.status(201).json({ data: activity });
  } catch (err) {
    console.error("createActivity error:", err);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}


async function getActivities(req, res) {
  try {
    const tenantId = req.tenantId; // guaranteed by resolveTenant middleware
    const { cursor } = req.query;

    const limit = Math.min(
      parseInt(req.query.limit, 10) || DEFAULT_LIMIT,
      MAX_LIMIT
    );

    // Validate cursor before building the filter so we fail fast on bad input.
    if (cursor && Number.isNaN(new Date(cursor).getTime())) {
      return res.status(400).json({ error: "INVALID_CURSOR" });
    }

    // tenantId + { createdAt: { $lt: cursor } } — matches the compound index.
    const filter = buildCursorFilter(tenantId, cursor);

  
    const docs = await ActivityModel.find(filter)
      .select(PROJECTION)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = docs.length > limit;
    const data = hasMore ? docs.slice(0, limit) : docs;
    const next = getNextCursor(data);
    const nextCursor = hasMore && next ? new Date(next).toISOString() : null;

    return res.status(200).json({
      data,
      pageInfo: { nextCursor, hasMore, limit },
    });
  } catch (err) {
    console.error("getActivities error:", err);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}

export { createActivity, getActivities };
