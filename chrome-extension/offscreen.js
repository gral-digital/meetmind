let mediaStream = null;
let audioContext = null;
let processor = null;
let ws = null;

const WS_URL = "ws://localhost:7777";

chrome.runtime.onMessage.addListener((message) => {
  console.log("[Offscreen] Received message:", message.action);
  if (message.action === "startOffscreenCapture") {
    startCapture(message.streamId);
  }
  if (message.action === "stopOffscreenCapture") {
    stopCapture();
  }
});

async function startCapture(streamId) {
  try {
    console.log("[Offscreen] Starting capture with stream ID");

    // Get the media stream from the tab
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
    });
    console.log("[Offscreen] Got media stream, tracks:", mediaStream.getAudioTracks().length);

    // Connect WebSocket to backend
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("[Offscreen] WebSocket connected to backend");
      startAudioProcessing();
    };

    ws.onclose = () => {
      console.log("[Offscreen] WebSocket disconnected");
    };

    ws.onerror = (err) => {
      console.error("[Offscreen] WebSocket error:", err);
    };
  } catch (err) {
    console.error("[Offscreen] Failed to start capture:", err);
  }
}

function startAudioProcessing() {
  audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(mediaStream);

  processor = audioContext.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (event) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const float32 = event.inputBuffer.getChannelData(0);
      // Convert float32 to int16 PCM (what Deepgram expects for linear16)
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      ws.send(int16.buffer);
    }
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  // Tab capture mutes the original tab playback, so route the stream to the
  // speakers ourselves — otherwise the user can't hear other participants.
  source.connect(audioContext.destination);

  console.log("[Offscreen] Audio processing started");
}

function stopCapture() {
  if (processor) {
    processor.disconnect();
    processor = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  console.log("[Offscreen] Audio capture stopped");
}
