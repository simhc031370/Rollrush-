export class Recorder {
  constructor() {
    this.recorder = null;
    this.chunks = [];
    this.active = false;
  }

  canRecord() {
    return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined";
  }

  start(canvas) {
    if (!this.canRecord() || this.active || typeof canvas.captureStream !== "function") return false;
    let stream;
    try {
      stream = canvas.captureStream(30);
    } catch {
      return false;
    }
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";
    this.chunks = [];
    try {
      this.recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      return false;
    }
    this.recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) this.chunks.push(event.data);
    };
    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `classroom-draw-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      this.active = false;
    };
    this.recorder.start();
    this.active = true;
    return true;
  }

  stop() {
    if (!this.active || !this.recorder) return;
    if (this.recorder.state !== "inactive") this.recorder.stop();
  }
}

export function playFanfare() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime + i * 0.09;
    osc.start(t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.stop(t + 0.42);
  });
}
