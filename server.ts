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

// Database configuration & Railway volume mount path resolution
function resolveDataDir(): string {
  if (process.env.DATA_DIR) {
    return process.env.DATA_DIR;
  }
  if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    return process.env.RAILWAY_VOLUME_MOUNT_PATH;
  }
  if (fs.existsSync("/app/data") || process.env.RAILWAY_ENVIRONMENT) {
    return "/app/data";
  }
  return path.join(process.cwd(), "data");
}

const DATA_DIR = resolveDataDir();
const DB_FILE = path.join(DATA_DIR, "db.json");
const BACKUP_FILE = path.join(DATA_DIR, "db.json.bak");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log("Created data directory at:", DATA_DIR);
  } catch (err) {
    console.error("Error creating data directory:", err);
  }
}

// In-memory DB representation
let dbState: Record<string, any> = {};

// Load existing database on startup with backup fallback
function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const rawData = fs.readFileSync(DB_FILE, "utf-8");
      if (rawData && rawData.trim().length > 0) {
        dbState = JSON.parse(rawData);
        console.log("Database loaded successfully from:", DB_FILE);
        return;
      }
    } catch (error) {
      console.error("Error reading main database file, checking backup:", error);
    }
  }

  // Check backup if main failed or was empty
  if (fs.existsSync(BACKUP_FILE)) {
    try {
      const rawBackup = fs.readFileSync(BACKUP_FILE, "utf-8");
      if (rawBackup && rawBackup.trim().length > 0) {
        dbState = JSON.parse(rawBackup);
        console.log("Restored database from backup file:", BACKUP_FILE);
        return;
      }
    } catch (bkErr) {
      console.error("Error reading backup file:", bkErr);
    }
  }

  console.log("No existing database found, starting clean in:", DATA_DIR);
  dbState = {};
}

loadDatabase();

// Thread-safe save helper with automatic backup and atomic write
function saveDbToDisk() {
  try {
    const serialized = JSON.stringify(dbState, null, 2);
    const tempFile = path.join(DATA_DIR, `db_${Date.now()}.tmp`);

    // Write to temporary file in the same directory first
    fs.writeFileSync(tempFile, serialized, "utf-8");

    // Keep backup of existing valid file
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.copyFileSync(DB_FILE, BACKUP_FILE);
      } catch (e) {
        // Non-fatal backup error
      }
    }

    // Atomic rename
    try {
      fs.renameSync(tempFile, DB_FILE);
    } catch (renameErr) {
      // Fallback if cross-device or volume lock prevents rename in Docker
      fs.writeFileSync(DB_FILE, serialized, "utf-8");
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch (e) {}
      }
    }
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

  // 5. Fallback: Compare items count (more items usually means user added products)
  const itemsA = Array.isArray(a.items) ? a.items.length : 0;
  const itemsB = Array.isArray(b.items) ? b.items.length : 0;
  if (itemsA > itemsB) return a;
  if (itemsB > itemsA) return b;

  return b;
}

function mergeOrders(existing: any[], incoming: any[]): any[] {
  // Safeguard: never wipe existing orders if client sent an empty or invalid array
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return Array.isArray(existing) ? existing : [];
  }
  if (!Array.isArray(existing) || existing.length === 0) {
    return incoming;
  }

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

// Entities that are purely additive audit logs and merged by item ID
const MANAGED_BY_ID_KEYS = [
  "shifts", 
  "cashShifts"
];

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
    } else if (MANAGED_BY_ID_KEYS.includes(key)) {
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
          } else if (MANAGED_BY_ID_KEYS.includes(key)) {
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
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    dataDir: DATA_DIR,
    dbFile: DB_FILE,
    dbExists: fs.existsSync(DB_FILE),
    backupExists: fs.existsSync(BACKUP_FILE),
    counts: {
      orders: Array.isArray(dbState.orders) ? dbState.orders.length : 0,
      products: Array.isArray(dbState.products) ? dbState.products.length : 0,
      cashShifts: Array.isArray(dbState.cashShifts) ? dbState.cashShifts.length : 0,
      promotions: Array.isArray(dbState.promotions) ? dbState.promotions.length : 0,
    }
  });
});

app.get("/api/next-order-number", (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const orders: any[] = Array.isArray(dbState.orders) ? dbState.orders : [];
    
    // Find highest order number used today
    const todayOrders = orders.filter((o) => {
      if (!o || !o.date) return false;
      return o.date.startsWith(todayStr) || new Date(o.date).toISOString().startsWith(todayStr);
    });

    let maxNum = 0;
    todayOrders.forEach((o) => {
      const n = parseInt(o.orderNumber, 10);
      if (!isNaN(n) && n > maxNum && n < 1000) {
        maxNum = n;
      }
    });

    const nextOrderNumber = (maxNum % 99) + 1;
    const movementNumber = (orders.length + 8862).toString();

    res.json({ nextOrderNumber, movementNumber });
  } catch (err) {
    res.json({ nextOrderNumber: 1, movementNumber: "8862" });
  }
});

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
  } else if (MANAGED_BY_ID_KEYS.includes(key)) {
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
