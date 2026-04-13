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
    chrome.runtime.sendMessage({ action: "startCapture" }, (response) => {
      btn.disabled = false;
      if (response?.success) {
        isCapturing = true;
        updateUI(true);
      } else {
        showError(response?.error || "Failed to start capture");
      }
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
