const msg = document.getElementById("msg");
const btn = document.getElementById("btn");

btn.addEventListener("click", async () => {
  btn.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    msg.innerHTML = '<span class="ok">Microphone access granted.</span><br>You can close this tab and click "Start Listening" again.';
    btn.style.display = "none";
    setTimeout(() => window.close(), 1500);
  } catch (err) {
    console.error("[Permission] getUserMedia failed:", err);
    msg.innerHTML = '<span class="err">Permission denied.</span><br>Open chrome://settings/content/microphone to allow this extension, then retry.';
    btn.disabled = false;
  }
});
