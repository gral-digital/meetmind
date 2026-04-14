let mediaStream = null;
let micStream = null;
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

    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log("[Offscreen] Got mic stream, tracks:", micStream.getAudioTracks().length);
    } catch (err) {
      console.warn("[Offscreen] Mic capture failed, continuing with tab audio only:", err);
      micStream = null;
    }

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
  const tabSource = audioContext.createMediaStreamSource(mediaStream);
  const micSource = micStream ? audioContext.createMediaStreamSource(micStream) : null;

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

  // Both sources feed the processor — multiple connections to the same input
  // are summed by the Web Audio graph, so the backend gets a mic + tab mix.
  tabSource.connect(processor);
  if (micSource) micSource.connect(processor);
  processor.connect(audioContext.destination);

  // Tab capture mutes the original tab playback, so route the tab stream to
  // the speakers ourselves — otherwise the user can't hear other participants.
  // Mic is intentionally NOT routed to destination to avoid feedback.
  tabSource.connect(audioContext.destination);

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
  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  console.log("[Offscreen] Audio capture stopped");
}
