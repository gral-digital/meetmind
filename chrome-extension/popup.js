let isCapturing = false;

document.addEventListener("DOMContentLoaded", () => {
  // Check current status
  chrome.runtime.sendMessage({ action: "getStatus" }, (response) => {
    if (response?.isCapturing) {
      isCapturing = true;
      updateUI(true);
    }
  });

  // Bind button click
  document.getElementById("btn").addEventListener("click", toggleCapture);
});

function toggleCapture() {
  const btn = document.getElementById("btn");
  btn.disabled = true;

  if (!isCapturing) {
    // MV3 popups close on focus loss, so Chrome suppresses the mic permission
    // prompt if we call getUserMedia here. Check the permission state first
    // and, if not granted, open a dedicated extension page in a tab where the
    // prompt can actually appear. Permission persists across extension
    // contexts so the offscreen doc can reuse it afterward.
    navigator.permissions
      .query({ name: "microphone" })
      .then((perm) => {
        if (perm.state !== "granted") {
          chrome.tabs.create({ url: chrome.runtime.getURL("permission.html") });
          btn.disabled = false;
          showError("Grant mic access in the new tab, then retry");
          return;
        }
        chrome.runtime.sendMessage({ action: "startCapture" }, (response) => {
          btn.disabled = false;
          if (response?.success) {
            isCapturing = true;
            updateUI(true);
          } else {
            showError(response?.error || "Failed to start capture");
          }
        });
      })
      .catch((err) => {
        btn.disabled = false;
        console.error("[Popup] Permission query failed:", err);
        showError("Couldn't check mic permission");
      });
  } else {
    chrome.runtime.sendMessage({ action: "stopCapture" }, (response) => {
      btn.disabled = false;
      if (response?.success) {
        isCapturing = false;
        updateUI(false);
      }
    });
  }
}

function updateUI(active) {
  const status = document.getElementById("status");
  const dot = document.getElementById("dot");
  const text = document.getElementById("statusText");
  const btn = document.getElementById("btn");

  if (active) {
    status.className = "status active";
    dot.className = "dot active";
    text.textContent = "Listening...";
    btn.textContent = "Stop Listening";
    btn.className = "stop";
  } else {
    status.className = "status idle";
    dot.className = "dot idle";
    text.textContent = "Ready to listen";
    btn.textContent = "Start Listening";
    btn.className = "start";
  }
}

function showError(msg) {
  const status = document.getElementById("status");
  const dot = document.getElementById("dot");
  const text = document.getElementById("statusText");

  status.className = "status error";
  dot.className = "dot error";
  text.textContent = msg;

  setTimeout(() => updateUI(false), 3000);
}
