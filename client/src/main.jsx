import React from "react";
import { createRoot } from "react-dom/client";
import ActivityFeed from "./components/ActivityFeed.jsx";
import "./styles.css";

// Tenant comes from auth in a real app; hard-coded here for the demo.
const TENANT_ID = "tenant_01";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <div className="app">
      <h1>Activity Feed</h1>
      <ActivityFeed tenantId={TENANT_ID} />
    </div>
  </React.StrictMode>
);
