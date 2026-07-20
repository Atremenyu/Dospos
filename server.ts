import express from "express";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Body parser with size limits for bulk synchronizations
app.use(express.json({ limit: "50mb" }));

// Database configuration
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory DB representation
let dbState: Record<string, any> = {};

// Load existing database on startup
if (fs.existsSync(DB_FILE)) {
  try {
    const rawData = fs.readFileSync(DB_FILE, "utf-8");
    dbState = JSON.parse(rawData);
    console.log("Database loaded successfully from:", DB_FILE);
  } catch (error) {
    console.error("Error reading database file, starting clean:", error);
    dbState = {};
  }
}

// Thread-safe save helper
function saveDbToDisk() {
  try {
    // Write atomically using temporary file to prevent corruption
    const tempFile = DB_FILE + ".tmp";
    fs.writeFileSync(tempFile, JSON.stringify(dbState, null, 2), "utf-8");
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error("Error saving database to disk:", error);
  }
}

// Advanced State Reconciliation & Merging logic for multi-device environments
function reconcileTwoOrders(a: any, b: any): any {
  // 1. Compare updatedAt timestamps if both exist
  if (a.updatedAt && b.updatedAt) {
    const timeA = new Date(a.updatedAt).getTime();
    const timeB = new Date(b.updatedAt).getTime();
    if (timeA > timeB) return a;
    if (timeB > timeA) return b;
  } else if (a.updatedAt && !b.updatedAt) {
    return a;
  } else if (!a.updatedAt && b.updatedAt) {
    return b;
  }

  // 2. Fallback: Reconcile based on status progression (terminal statuses should win)
  const statusPriority: Record<string, number> = {
    pending: 1,
    preparing: 2,
    ready: 3,
    delivered: 4,
    cancelled: 4,
  };
  const priorityA = statusPriority[a.status] || 0;
  const priorityB = statusPriority[b.status] || 0;

  if (priorityA > priorityB) return a;
  if (priorityB > priorityA) return b;

  // 3. Fallback: If one is marked paid and other isn't, prefer paid status
  if (a.isPaid && !b.isPaid) return a;
  if (b.isPaid && !a.isPaid) return b;

  // 4. Fallback: Compare payments count (more records usually means more payments processed)
  const paymentsA = Array.isArray(a.payments) ? a.payments.length : 0;
  const paymentsB = Array.isArray(b.payments) ? b.payments.length : 0;
  if (paymentsA > paymentsB) return a;
  if (paymentsB > paymentsA) return b;

  // 5. Fallback: Compare items or default to the incoming one (b)
  const itemsA = Array.isArray(a.items) ? a.items.length : 0;
  const itemsB = Array.isArray(b.items) ? b.items.length : 0;
  if (itemsA > itemsB) return a;
  if (itemsB > itemsA) return b;

  return b;
}

function mergeOrders(existing: any[], incoming: any[]): any[] {
  if (!Array.isArray(existing)) return incoming || [];
  if (!Array.isArray(incoming)) return existing || [];

  const existingMap = new Map(existing.map((o) => [o.id, o]));
  const mergedMap = new Map(existingMap);

  incoming.forEach((incOrder) => {
    if (!incOrder || !incOrder.id) return;
    const extOrder = existingMap.get(incOrder.id);
    if (!extOrder) {
      // Order exists in client but not in server yet
      mergedMap.set(incOrder.id, incOrder);
    } else {
      // Order exists in both: merge them intelligently
      mergedMap.set(incOrder.id, reconcileTwoOrders(extOrder, incOrder));
    }
  });

  // Sort by date/timestamp descending to keep newer orders first
  return Array.from(mergedMap.values()).sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : 0;
    const bTime = b.date ? new Date(b.date).getTime() : 0;
    return bTime - aTime;
  });
}

function mergeById(existing: any[], incoming: any[]): any[] {
  if (!Array.isArray(existing)) return incoming || [];
  if (!Array.isArray(incoming)) return existing || [];

  const existingMap = new Map(existing.map((item) => [item.id, item]));
  const mergedMap = new Map(existingMap);

  incoming.forEach((incItem) => {
    if (!incItem || !incItem.id) return;
    const extItem = existingMap.get(incItem.id);
    if (!extItem) {
      mergedMap.set(incItem.id, incItem);
    } else {
      // If both have updatedAt, take newer
      if (extItem.updatedAt && incItem.updatedAt) {
        const timeExt = new Date(extItem.updatedAt).getTime();
        const timeInc = new Date(incItem.updatedAt).getTime();
        if (timeInc >= timeExt) {
          mergedMap.set(incItem.id, incItem);
        }
      } else if (!extItem.updatedAt && incItem.updatedAt) {
        mergedMap.set(incItem.id, incItem);
      } else if (extItem.updatedAt && !incItem.updatedAt) {
        // keep existing on server since it's newer / has updatedAt
      } else {
        // default to incoming
        mergedMap.set(incItem.id, incItem);
      }
    }
  });

  return Array.from(mergedMap.values());
}

function mergeBulkState(existingState: Record<string, any>, incomingState: Record<string, any>): Record<string, any> {
  const newState = { ...existingState };
  Object.keys(incomingState).forEach((key) => {
    const data = incomingState[key];
    if (key === "orders") {
      newState[key] = mergeOrders(newState[key], data);
    } else if (["ingredients", "products", "shifts", "cashShifts", "tables", "users", "roles"].includes(key)) {
      newState[key] = mergeById(newState[key], data);
    } else {
      newState[key] = data;
    }
  });
  return newState;
}

// HTTP Server and WebSocket server setup
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Helper to broadcast to all open WS clients (optionally including/excluding sender)
function broadcast(message: any, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(payload);
    }
  });
}

// WebSocket connection handling
wss.on("connection", (ws) => {
  console.log("Client connected via WebSocket");
  
  // Send the current complete state on connection
  ws.send(JSON.stringify({ type: "INIT", state: dbState }));

  ws.on("message", (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed.type === "SAVE") {
        const { key, data } = parsed;
        if (key) {
          if (key === "orders") {
            dbState[key] = mergeOrders(dbState[key], data);
          } else if (["ingredients", "products", "shifts", "cashShifts", "tables", "users", "roles"].includes(key)) {
            dbState[key] = mergeById(dbState[key], data);
          } else {
            dbState[key] = data;
          }
          saveDbToDisk();
          // Broadcast the merged state to EVERYONE (including sender) to resolve conflicts
          broadcast({ type: "UPDATE", key, data: dbState[key] });
        }
      } else if (parsed.type === "SAVE_BULK") {
        if (parsed.data && typeof parsed.data === "object") {
          dbState = mergeBulkState(dbState, parsed.data);
          saveDbToDisk();
          // Broadcast to EVERYONE to resolve conflicts
          broadcast({ type: "UPDATE_BULK", state: dbState });
        }
      }
    } catch (err) {
      console.error("Error handling WebSocket message:", err);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

// API Routes
app.get("/api/db", (req, res) => {
  res.json(dbState);
});

app.post("/api/db/save", (req, res) => {
  const { key, data } = req.body;
  if (!key) {
    return res.status(400).json({ error: "Missing key" });
  }
  if (key === "orders") {
    dbState[key] = mergeOrders(dbState[key], data);
  } else if (["ingredients", "products", "shifts", "cashShifts", "tables", "users", "roles"].includes(key)) {
    dbState[key] = mergeById(dbState[key], data);
  } else {
    dbState[key] = data;
  }
  saveDbToDisk();
  broadcast({ type: "UPDATE", key, data: dbState[key] });
  res.json({ success: true, data: dbState[key] });
});

app.post("/api/db/save-bulk", (req, res) => {
  const data = req.body;
  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "Invalid data" });
  }
  dbState = mergeBulkState(dbState, data);
  saveDbToDisk();
  broadcast({ type: "UPDATE_BULK", state: dbState });
  res.json({ success: true, data: dbState });
});

app.post("/api/db/reset", (req, res) => {
  dbState = {};
  saveDbToDisk();
  broadcast({ type: "RESET" });
  res.json({ success: true });
});

// Vite middleware or production static serving
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupVite().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
});
