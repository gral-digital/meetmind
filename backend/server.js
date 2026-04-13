import dotenv from "dotenv";
dotenv.config({ path: "../.env.local" });
dotenv.config({ path: "../.env" });
import { WebSocketServer, WebSocket } from "ws";
import { Transcriber } from "./transcriber.js";
import { AIEngine } from "./ai.js";

const PORT_EXTENSION = 7777; // Chrome extension sends audio here
const PORT_OVERLAY = 7778; // Electron overlay receives suggestions here

// Validate env
if (!process.env.DEEPGRAM_API_KEY || !process.env.ANTHROPIC_API_KEY) {
  console.error("Missing DEEPGRAM_API_KEY or ANTHROPIC_API_KEY in .env");
  process.exit(1);
}

const transcriber = new Transcriber(process.env.DEEPGRAM_API_KEY);
const ai = new AIEngine(process.env.ANTHROPIC_API_KEY);

// Track overlay connections
const overlayClients = new Set();

function broadcastToOverlay(data) {
  const msg = JSON.stringify(data);
  for (const client of overlayClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// --- Extension WebSocket (receives audio) ---
const extensionWSS = new WebSocketServer({ port: PORT_EXTENSION });

extensionWSS.on("connection", async (ws) => {
  console.log("[Server] Chrome extension connected");

  broadcastToOverlay({ type: "status", status: "connected" });

  try {
    await transcriber.start();
  } catch (err) {
    console.error("[Server] Failed to start transcriber:", err);
    ws.close();
    return;
  }

  // When we get transcript data, check if we should call Claude
  let finalCount = 0;
  transcriber.onTranscript = async (data) => {
    // Send live transcript to overlay
    broadcastToOverlay({
      type: "transcript",
      text: data.text,
      speaker: data.speaker,
      isFinal: data.isFinal,
    });

    // After every 2 final transcripts, try to get suggestions
    if (data.isFinal) {
      finalCount++;
      if (finalCount >= 2) {
        finalCount = 0;
        const suggestions = await ai.getSuggestions(data.context);
        if (suggestions) {
          broadcastToOverlay({ type: "suggestions", suggestions });
        }
      }
    }
  };

  ws.on("message", (data) => {
    // Raw audio bytes from extension
    transcriber.sendAudio(data);
  });

  ws.on("close", () => {
    console.log("[Server] Chrome extension disconnected");
    transcriber.stop();
    broadcastToOverlay({ type: "status", status: "disconnected" });
  });

  ws.on("error", (err) => {
    console.error("[Server] Extension WS error:", err.message);
  });
});

console.log(`[Server] Extension WebSocket listening on ws://localhost:${PORT_EXTENSION}`);

// --- Overlay WebSocket (sends suggestions) ---
const overlayWSS = new WebSocketServer({ port: PORT_OVERLAY });

overlayWSS.on("connection", (ws) => {
  console.log("[Server] Overlay connected");
  overlayClients.add(ws);

  ws.on("close", () => {
    overlayClients.delete(ws);
    console.log("[Server] Overlay disconnected");
  });
});

console.log(`[Server] Overlay WebSocket listening on ws://localhost:${PORT_OVERLAY}`);
console.log("[Server] MeetMind backend ready. Waiting for connections...");
