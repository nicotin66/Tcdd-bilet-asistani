// Offscreen document script for playing audio alerts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PLAY_ALERT_SOUND") {
    playChime();
    sendResponse({ success: true });
  }
  return true;
});

function playChime() {
  const audio = document.getElementById("alertAudio");
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Fallback: Web Audio API synthesis
      synthesizeStationChime();
    });
  } else {
    synthesizeStationChime();
  }
}

function synthesizeStationChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [587.33, 880.00, 1174.66]; // D5, A5, D6
    let startTime = audioCtx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.35);

      gain.gain.setValueAtTime(0, startTime + idx * 0.35);
      gain.gain.linearRampToValueAtTime(0.4, startTime + idx * 0.35 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + idx * 0.35 + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(startTime + idx * 0.35);
      osc.stop(startTime + idx * 0.35 + 0.65);
    });
  } catch (err) {
    console.error("Web Audio synthesis error:", err);
  }
}
