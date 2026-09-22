import { PhysicsWorld } from "./physics.js";
import { getMap } from "./maps.js";
import { winnerRange as computeWinnerRange } from "./names.js";

let nextId = 1;

function hueColor(index, total) {
  const hue = Math.round((360 / Math.max(total, 1)) * index);
  return {
    hue,
    fill: `hsl(${hue} 78% 62%)`,
    label: `hsl(${hue} 90% 76%)`,
  };
}

export class MarbleRace {
  constructor() {
    this.world = new PhysicsWorld();
    this.map = getMap("chalkboard");
    this.marbles = [];
    this.status = "idle";
    this.elapsed = 0;
    this.speed = 1;
    this.useSkills = true;
    this.winnerMode = "first";
    this.nth = 1;
    this.rangeStart = 1;
    this.rangeEnd = 3;
    this.finished = [];
    this.winners = [];
    this.listeners = new Map();
    this.camera = { x: 8, y: 8, zoom: 38, targetX: 8, targetY: 8, targetZoom: 42 };
    this.gateOpen = false;
    this.shakeUntil = 0;
  }

  on(event, fn) {
    const list = this.listeners.get(event) || [];
    list.push(fn);
    this.listeners.set(event, list);
    return () => {
      this.listeners.set(
        event,
        (this.listeners.get(event) || []).filter((item) => item !== fn),
      );
    };
  }

  emit(event, detail) {
    for (const fn of this.listeners.get(event) || []) fn(detail);
  }

  getCount() {
    return this.marbles.length;
  }

  getWinnerRange() {
    const range = computeWinnerRange(
      this.winnerMode,
      { nth: this.nth, rangeStart: this.rangeStart, rangeEnd: this.rangeEnd },
      this.marbles.length,
    );
    return range;
  }

  setWinnerMode(mode, extra = {}) {
    this.winnerMode = mode;
    if (extra.nth != null) this.nth = extra.nth;
    if (extra.rangeStart != null) this.rangeStart = extra.rangeStart;
    if (extra.rangeEnd != null) this.rangeEnd = extra.rangeEnd;
    const range = this.getWinnerRange();
    this.nth = range.start + 1;
    this.rangeStart = range.start + 1;
    this.rangeEnd = range.end + 1;
    return range;
  }

  setMap(id) {
    this.map = getMap(id);
    if (this.marbles.length) this.setMarbles(this.marbles.map((m) => ({ name: m.name, weight: m.weight })));
    else this.installMap();
  }

  installMap() {
    const map = this.map;
    this.world.reset();
    this.world.segments = map.segments.map((s) => ({ ...s }));
    this.world.pegs = (map.pegs || []).map((p) => ({ ...p }));
    this.world.spinners = (map.spinners || []).map((s) => ({ ...s }));
    this.gateOpen = false;
    if (map.gate) this.world.segments.push({ ...map.gate, gate: true });
  }

  setMarbles(entries) {
    this.installMap();
    this.finished = [];
    this.winners = [];
    this.status = entries.length ? "ready" : "idle";
    this.elapsed = 0;
    const total = entries.length;
    this.marbles = entries.map((entry, index) => {
      const color = hueColor(index, total);
      const weight = Math.max(1, entry.weight || 1);
      const radius = 0.26 * (0.86 + Math.min(weight, 6) * 0.07);
      const cols = Math.min(9, Math.max(3, Math.ceil(Math.sqrt(total))));
      const col = index % cols;
      const row = Math.floor(index / cols);
      const spawn = this.map.spawn;
      const body = this.world.addBody({
        id: nextId++,
        name: entry.name,
        weight,
        r: radius,
        mass: Math.max(0.55, radius * radius * 18 * weight),
        x: spawn.x - spawn.width / 2 + (spawn.width / Math.max(cols - 1, 1)) * col + (Math.random() - 0.5) * 0.08,
        y: spawn.y - row * (radius * 2.15 + 0.04),
        vx: (Math.random() - 0.5) * 0.4,
        vy: 0,
        angle: Math.random() * Math.PI * 2,
        omega: 0,
        active: true,
        racing: false,
        hue: color.hue,
        fill: color.fill,
        label: color.label,
        skillT: 1.2 + Math.random() * 2.4,
        skillFlash: 0,
        stuck: 0,
        lastX: 0,
        lastY: 0,
      });
      return body;
    });
    this.camera.x = this.map.spawn.x;
    this.camera.y = this.map.spawn.y + 3;
    this.camera.targetX = this.camera.x;
    this.camera.targetY = this.camera.y;
    this.camera.zoom = 46;
    this.camera.targetZoom = 46;
    this.emit("reset", this.snapshot());
  }

  start() {
    if (!this.marbles.length || this.status === "running") return false;
    this.status = "running";
    this.elapsed = 0;
    this.finished = [];
    this.winners = [];
    this.openGate();
    for (const marble of this.marbles) {
      marble.racing = true;
      marble.vx += (Math.random() - 0.5) * 1.4;
      marble.vy += Math.random() * 0.4;
    }
    this.emit("start", this.snapshot());
    return true;
  }

  openGate() {
    this.gateOpen = true;
    this.world.segments = this.world.segments.filter((s) => !s.gate);
  }

  resetRound() {
    this.setMarbles(this.marbles.map((m) => ({ name: m.name, weight: m.weight })));
  }

  step(dt) {
    const scaled = dt * this.speed;
    if (this.status === "ready" || this.status === "running" || this.status === "finished") {
      this.world.step(scaled);
    }
    if (this.status === "running") {
      this.elapsed += scaled;
      this.updateMarbles(scaled);
      this.checkFinish();
    }
    this.updateCamera(scaled);
    this.shakeUntil = Math.max(0, this.shakeUntil - scaled);
  }

  updateMarbles(dt) {
    for (const marble of this.marbles) {
      if (!marble.racing || !marble.active) continue;
      const moved = Math.hypot(marble.x - marble.lastX, marble.y - marble.lastY);
      marble.lastX = marble.x;
      marble.lastY = marble.y;
      if (moved < 0.004) marble.stuck += dt;
      else marble.stuck = 0;
      if (marble.stuck > 1.15) this.world.shake(marble, 8);

      if (this.useSkills) {
        marble.skillT -= dt;
        if (marble.skillT <= 0) {
          const chance = 0.16 * marble.weight;
          if (Math.random() < chance) {
            marble.vx += (Math.random() - 0.5) * 16;
            marble.vy += (Math.random() - 0.7) * 10;
            marble.skillFlash = 0.45;
            this.emit("message", `${marble.name} 스킬!`);
          }
          marble.skillT = 2.4 + Math.random() * 3.4 + (1 / marble.weight);
        }
      }
      marble.skillFlash = Math.max(0, marble.skillFlash - dt);
    }
  }

  checkFinish() {
    const goalY = this.map.goalY;
    for (const marble of this.marbles) {
      if (!marble.racing) continue;
      if (marble.y - marble.r >= goalY) {
        marble.racing = false;
        this.finished.push(marble);
        this.emit("rank", { marble, rank: this.finished.length });
      }
    }

    const remaining = this.marbles.filter((m) => m.racing);
    const range = this.getWinnerRange();
    const needed = range.end + 1;
    if (remaining.length === 1 && this.finished.length + 1 >= needed) {
      remaining[0].racing = false;
      this.finished.push(remaining[0]);
    }

    if (this.finished.length >= needed || remaining.length === 0) {
      this.status = "finished";
      this.winners = this.finished.slice(range.start, range.end + 1);
      this.emit("goal", this.snapshot());
    }
  }

  updateCamera(dt) {
    const racing = this.marbles.filter((m) => m.racing);
    const pack = racing.length ? racing : this.marbles;
    if (!pack.length) return;
    let focus = pack[0];
    for (const marble of pack) {
      if (marble.y > focus.y) focus = marble;
    }
    const approaching = this.status === "running" && focus.y > this.map.zoomY - 8;
    this.camera.targetX = this.status === "ready" ? this.map.spawn.x : focus.x;
    this.camera.targetY = this.status === "ready" ? focus.y + 3.2 : focus.y + 1.2;
    this.camera.targetZoom = approaching ? 58 : this.status === "ready" ? 36 : 40;
    const k = 1 - Math.pow(0.001, dt);
    this.camera.x += (this.camera.targetX - this.camera.x) * k;
    this.camera.y += (this.camera.targetY - this.camera.y) * k;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * k;
  }

  bump(x, y) {
    this.shakeUntil = 0.35;
    for (const marble of this.marbles) {
      if (!marble.active) continue;
      const dx = marble.x - x;
      const dy = marble.y - y;
      const d2 = dx * dx + dy * dy + 0.4;
      const power = 18 / d2;
      marble.vx += dx * power;
      marble.vy += dy * power - 2;
    }
  }

  snapshot() {
    return {
      status: this.status,
      count: this.marbles.length,
      finished: this.finished.map((m, i) => ({ name: m.name, rank: i + 1, fill: m.fill })),
      winners: this.winners.map((m) => m.name),
      range: this.getWinnerRange(),
      map: this.map.id,
      elapsed: this.elapsed,
    };
  }
}
