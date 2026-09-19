import { spinnerSegments } from "./physics.js";

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.dpr = 1;
    this.theme = "dark";
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  }

  worldToScreen(camera, x, y) {
    return {
      x: (x - camera.x) * camera.zoom + this.canvas.width / (2 * this.dpr) * this.dpr,
      y: (y - camera.y) * camera.zoom + this.canvas.height / (2 * this.dpr) * this.dpr,
    };
  }

  draw(race, now) {
    const ctx = this.ctx;
    const { canvas } = this;
    const dark = this.theme === "dark";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawBackdrop(ctx, canvas, dark, race);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(race.camera.zoom, race.camera.zoom);
    ctx.translate(-race.camera.x, -race.camera.y);
    if (race.shakeUntil > 0) {
      ctx.translate((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18);
    }
    this.drawCourse(ctx, race, dark);
    this.drawMarbles(ctx, race, dark);
    ctx.restore();

    this.drawMinimap(ctx, race, dark);
    this.updateParticles(now);
    this.drawParticles(ctx);
  }

  drawBackdrop(ctx, canvas, dark) {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (dark) {
      g.addColorStop(0, "#10231c");
      g.addColorStop(1, "#07110e");
    } else {
      g.addColorStop(0, "#efe6d4");
      g.addColorStop(1, "#d9cbb0");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.globalAlpha = dark ? 0.07 : 0.12;
    ctx.strokeStyle = dark ? "#d9f5e3" : "#5a4630";
    ctx.lineWidth = 1;
    const gap = 42 * this.dpr;
    for (let x = 0; x < canvas.width; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gap) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCourse(ctx, race, dark) {
    const map = race.map;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.save();
    ctx.strokeStyle = dark ? "rgba(243, 234, 211, 0.9)" : "rgba(62, 42, 28, 0.88)";
    ctx.lineWidth = 0.18;
    ctx.shadowColor = dark ? "rgba(0,0,0,0.35)" : "rgba(90,70,40,0.2)";
    ctx.shadowBlur = 8;
    for (const segment of race.world.segments) {
      if (segment.gate) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 206, 84, 0.95)";
        ctx.lineWidth = 0.28;
        ctx.beginPath();
        ctx.moveTo(segment.ax, segment.ay);
        ctx.lineTo(segment.bx, segment.by);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(segment.ax, segment.ay);
      ctx.lineTo(segment.bx, segment.by);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = dark ? "rgba(226, 214, 176, 0.95)" : "rgba(90, 64, 40, 0.92)";
    for (const peg of race.world.pegs) {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = dark ? "#8ee4c2" : "#2f7d63";
    ctx.lineWidth = 0.16;
    for (const spinner of race.world.spinners) {
      for (const part of spinnerSegments(spinner)) {
        ctx.beginPath();
        ctx.moveTo(part.ax, part.ay);
        ctx.lineTo(part.bx, part.by);
        ctx.stroke();
      }
    }

    ctx.save();
    ctx.strokeStyle = "rgba(255, 206, 84, 0.95)";
    ctx.shadowColor = "#ffce54";
    ctx.shadowBlur = 18;
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.moveTo(map.width / 2 - 1.7, map.goalY);
    ctx.lineTo(map.width / 2 + 1.7, map.goalY);
    ctx.stroke();
    ctx.restore();
  }

  drawMarbles(ctx, race, dark) {
    const zoom = race.camera.zoom;
    for (const marble of race.marbles) {
      ctx.save();
      ctx.translate(marble.x, marble.y);
      ctx.rotate(marble.angle);
      if (marble.skillFlash > 0) {
        ctx.strokeStyle = `rgba(255,220,120,${marble.skillFlash})`;
        ctx.lineWidth = 0.08;
        ctx.beginPath();
        ctx.arc(0, 0, marble.r + 0.16, 0, Math.PI * 2);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(-marble.r * 0.3, -marble.r * 0.35, marble.r * 0.1, 0, 0, marble.r);
      g.addColorStop(0, "#fff6");
      g.addColorStop(0.28, marble.fill);
      g.addColorStop(1, dark ? "#0b0b0b" : "#2a2218");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, marble.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 0.03;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(marble.x, marble.y + marble.r + 0.18);
      ctx.scale(1 / zoom, 1 / zoom);
      ctx.font = `700 ${Math.max(13, Math.min(18, 15 * (this.dpr)))}px "Pretendard", "Apple SD Gothic Neo", sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = dark ? "rgba(6,12,10,0.85)" : "rgba(255,252,246,0.9)";
      ctx.fillStyle = marble.label;
      ctx.strokeText(marble.name, 0, 0);
      ctx.fillText(marble.name, 0, 0);
      ctx.restore();
    }
  }

  drawMinimap(ctx, race, dark) {
    const w = 118 * this.dpr;
    const h = 210 * this.dpr;
    const x = this.canvas.width - w - 18 * this.dpr;
    const y = this.canvas.height - h - 22 * this.dpr;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = dark ? "rgba(8,18,15,0.72)" : "rgba(255,250,240,0.78)";
    roundRect(ctx, x, y, w, h, 14 * this.dpr);
    ctx.fill();
    ctx.strokeStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(80,60,40,0.16)";
    ctx.stroke();

    const map = race.map;
    const pad = 10 * this.dpr;
    const scale = Math.min((w - pad * 2) / map.width, (h - pad * 2) / map.height);
    const ox = x + (w - map.width * scale) / 2;
    const oy = y + pad;

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = dark ? "rgba(243,234,211,0.7)" : "rgba(70,50,30,0.7)";
    ctx.lineWidth = 1.2 * this.dpr;
    for (const segment of race.world.segments) {
      ctx.beginPath();
      ctx.moveTo(ox + segment.ax * scale, oy + segment.ay * scale);
      ctx.lineTo(ox + segment.bx * scale, oy + segment.by * scale);
      ctx.stroke();
    }
    for (const marble of race.marbles) {
      ctx.fillStyle = marble.fill;
      ctx.beginPath();
      ctx.arc(ox + marble.x * scale, oy + marble.y * scale, Math.max(2.2 * this.dpr, marble.r * scale), 0, Math.PI * 2);
      ctx.fill();
    }

    const viewH = this.canvas.height / race.camera.zoom;
    const viewW = this.canvas.width / race.camera.zoom;
    ctx.strokeStyle = "rgba(255,206,84,0.85)";
    ctx.lineWidth = 1.5 * this.dpr;
    ctx.strokeRect(
      ox + (race.camera.x - viewW / 2) * scale,
      oy + (race.camera.y - viewH / 2) * scale,
      viewW * scale,
      viewH * scale,
    );
    ctx.restore();
  }

  burst(x, y, color) {
    for (let i = 0; i < 18; i += 1) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * -5 - 1,
        life: 1,
        color,
      });
    }
  }

  updateParticles(dt) {
    this.particles = this.particles.filter((p) => {
      p.vy += 8 * dt;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dt * 1.4;
      return p.life > 0;
    });
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 4 * this.dpr, 8 * this.dpr);
    }
    ctx.globalAlpha = 1;
  }
}

export function screenToWorld(canvas, camera, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;
  return {
    x: (x - canvas.width / 2) / camera.zoom + camera.x,
    y: (y - canvas.height / 2) / camera.zoom + camera.y,
  };
}
