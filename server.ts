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

// HTTP Server and WebSocket server setup
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Helper to broadcast to all open WS clients
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
          dbState[key] = data;
          saveDbToDisk();
          broadcast({ type: "UPDATE", key, data }, ws);
        }
      } else if (parsed.type === "SAVE_BULK") {
        if (parsed.data && typeof parsed.data === "object") {
          dbState = { ...dbState, ...parsed.data };
          saveDbToDisk();
          broadcast({ type: "UPDATE_BULK", state: dbState }, ws);
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
  dbState[key] = data;
  saveDbToDisk();
  broadcast({ type: "UPDATE", key, data });
  res.json({ success: true });
});

app.post("/api/db/save-bulk", (req, res) => {
  const data = req.body;
  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "Invalid data" });
  }
  dbState = { ...dbState, ...data };
  saveDbToDisk();
  broadcast({ type: "UPDATE_BULK", state: dbState });
  res.json({ success: true });
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupVite().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
});
