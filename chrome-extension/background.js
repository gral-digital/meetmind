let isCapturing = false;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startCapture") {
    startCapture(sendResponse);
    return true; // async response
  }
  if (message.action === "stopCapture") {
    stopCapture(sendResponse);
    return true;
  }
  if (message.action === "getStatus") {
    sendResponse({ isCapturing });
    return false;
  }
});

async function startCapture(sendResponse) {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log("[BG] Active tab:", tab?.id, tab?.url);

    if (!tab) {
      sendResponse({ success: false, error: "No active tab found" });
      return;
    }

    // Create or ensure offscreen document exists BEFORE getting stream ID
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });
    console.log("[BG] Existing offscreen docs:", existingContexts.length);

    if (existingContexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["USER_MEDIA"],
        justification: "Capturing tab audio for real-time transcription",
      });
      console.log("[BG] Offscreen document created");
    }

    // Get a media stream ID for tab capture
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    console.log("[BG] Got stream ID:", streamId ? "yes" : "no");

    // Send stream ID to offscreen document to start capturing
    chrome.runtime.sendMessage({
      action: "startOffscreenCapture",
      streamId,
      tabId: tab.id,
    });

    isCapturing = true;
    sendResponse({ success: true });
  } catch (err) {
    console.error("[BG] Failed to start capture:", err);
    sendResponse({ success: false, error: err.message });
  }
}

async function stopCapture(sendResponse) {
  chrome.runtime.sendMessage({ action: "stopOffscreenCapture" });
  isCapturing = false;
  sendResponse({ success: true });
}
