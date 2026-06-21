import express from "express";

import {
  createActivity,
  getActivities,
} from "../controllers/activity.controller.js";
import { resolveTenant } from "../middleware/tenant.js";

const router = express.Router();


router.post("/",resolveTenant, createActivity);

router.get("/",resolveTenant, getActivities);

export default router;
