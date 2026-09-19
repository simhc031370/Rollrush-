export function seg(ax, ay, bx, by) {
  return { ax, ay, bx, by };
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const len2 = abx * abx + aby * aby;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / len2));
  return { x: ax + abx * t, y: ay + aby * t, t };
}

function spinnerCorners(spinner, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const hx = spinner.length / 2;
  const hy = spinner.thickness / 2;
  const local = [
    [-hx, -hy],
    [hx, -hy],
    [hx, hy],
    [-hx, hy],
  ];
  return local.map(([lx, ly]) => ({
    x: spinner.x + lx * c - ly * s,
    y: spinner.y + lx * s + ly * c,
  }));
}

export function spinnerSegments(spinner, angle = spinner.angle) {
  const p = spinnerCorners(spinner, angle);
  return [
    seg(p[0].x, p[0].y, p[1].x, p[1].y),
    seg(p[1].x, p[1].y, p[2].x, p[2].y),
    seg(p[2].x, p[2].y, p[3].x, p[3].y),
    seg(p[3].x, p[3].y, p[0].x, p[0].y),
  ];
}

export class PhysicsWorld {
  constructor() {
    this.bodies = [];
    this.segments = [];
    this.pegs = [];
    this.spinners = [];
    this.gravity = 26;
    this.restitution = 0.46;
    this.friction = 0.18;
    this.air = 0.9992;
  }

  reset() {
    this.bodies = [];
    this.segments = [];
    this.pegs = [];
    this.spinners = [];
  }

  addBody(body) {
    this.bodies.push(body);
    return body;
  }

  step(dt) {
    const clamped = Math.min(0.024, Math.max(0, dt));
    const steps = 4;
    const h = clamped / steps;
    for (let i = 0; i < steps; i += 1) this.substep(h);
  }

  substep(dt) {
    for (const spinner of this.spinners) {
      spinner.angle += spinner.omega * dt;
    }

    for (const body of this.bodies) {
      if (!body.active) continue;
      body.vy += this.gravity * dt;
      body.vx *= this.air;
      body.vy *= this.air;
      const speed = Math.hypot(body.vx, body.vy);
      const maxSpeed = 38;
      if (speed > maxSpeed) {
        body.vx = (body.vx / speed) * maxSpeed;
        body.vy = (body.vy / speed) * maxSpeed;
      }
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.omega *= 0.995;
      body.angle += body.omega * dt;
    }

    this.collideBodies();
    this.collideSegments();
    this.collidePegs();
    this.collideSpinners();
  }

  collideBodies() {
    const list = this.bodies;
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      if (!a.active) continue;
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[j];
        if (!b.active) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > minDist * minDist || d2 === 0) continue;
        const dist = Math.sqrt(d2);
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        const invA = 1 / a.mass;
        const invB = 1 / b.mass;
        const invSum = invA + invB;
        const corr = (Math.max(overlap - 0.001, 0) * 0.82) / invSum;
        a.x -= nx * corr * invA;
        a.y -= ny * corr * invA;
        b.x += nx * corr * invB;
        b.y += ny * corr * invB;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velN = rvx * nx + rvy * ny;
        if (velN > 0) continue;
        const e = this.restitution;
        const jn = (-(1 + e) * velN) / invSum;
        a.vx -= jn * nx * invA;
        a.vy -= jn * ny * invA;
        b.vx += jn * nx * invB;
        b.vy += jn * ny * invB;

        const tx = -ny;
        const ty = nx;
        const velT = rvx * tx + rvy * ty;
        const jt = Math.max(-Math.abs(jn) * this.friction, Math.min(Math.abs(jn) * this.friction, -velT / invSum));
        a.vx -= jt * tx * invA;
        a.vy -= jt * ty * invA;
        b.vx += jt * tx * invB;
        b.vy += jt * ty * invB;
        a.omega -= velT * 0.15;
        b.omega += velT * 0.15;
      }
    }
  }

  collideSegments() {
    for (const body of this.bodies) {
      if (!body.active) continue;
      for (const segment of this.segments) {
        this.resolveCircleSegment(body, segment, 0, 0);
      }
    }
  }

  collidePegs() {
    for (const body of this.bodies) {
      if (!body.active) continue;
      for (const peg of this.pegs) {
        const dx = body.x - peg.x;
        const dy = body.y - peg.y;
        const minDist = body.r + peg.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > minDist * minDist) continue;
        const dist = d2 === 0 ? 0.0001 : Math.sqrt(d2);
        const nx = dist === 0 ? 0 : dx / dist;
        const ny = dist === 0 ? -1 : dy / dist;
        const overlap = minDist - dist;
        body.x += nx * overlap;
        body.y += ny * overlap;
        const velN = body.vx * nx + body.vy * ny;
        if (velN < 0) {
          body.vx -= (1 + this.restitution) * velN * nx;
          body.vy -= (1 + this.restitution) * velN * ny;
        }
      }
    }
  }

  collideSpinners() {
    for (const spinner of this.spinners) {
      const parts = spinnerSegments(spinner);
      for (const body of this.bodies) {
        if (!body.active) continue;
        for (const part of parts) {
          const cx = (part.ax + part.bx) / 2;
          const cy = (part.ay + part.by) / 2;
          const rx = cx - spinner.x;
          const ry = cy - spinner.y;
          const surfaceVx = -spinner.omega * ry;
          const surfaceVy = spinner.omega * rx;
          this.resolveCircleSegment(body, part, surfaceVx, surfaceVy);
        }
      }
    }
  }

  resolveCircleSegment(body, segment, surfaceVx, surfaceVy) {
    const hit = closestPointOnSegment(body.x, body.y, segment.ax, segment.ay, segment.bx, segment.by);
    const dx = body.x - hit.x;
    const dy = body.y - hit.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > body.r * body.r) return;
    const dist = d2 === 0 ? 0 : Math.sqrt(d2);
    let nx;
    let ny;
    if (dist === 0) {
      const abx = segment.bx - segment.ax;
      const aby = segment.by - segment.ay;
      const len = Math.hypot(abx, aby) || 1;
      nx = -aby / len;
      ny = abx / len;
    } else {
      nx = dx / dist;
      ny = dy / dist;
    }
    const overlap = body.r - dist;
    body.x += nx * overlap;
    body.y += ny * overlap;

    const relVx = body.vx - surfaceVx;
    const relVy = body.vy - surfaceVy;
    const velN = relVx * nx + relVy * ny;
    if (velN < 0) {
      body.vx -= (1 + this.restitution) * velN * nx;
      body.vy -= (1 + this.restitution) * velN * ny;
      const tx = -ny;
      const ty = nx;
      const velT = relVx * tx + relVy * ty;
      body.vx -= velT * tx * this.friction;
      body.vy -= velT * ty * this.friction;
      body.omega += velT * 0.4;
    }
  }

  shake(body, amount = 6) {
    body.vx += (Math.random() - 0.5) * amount * 2;
    body.vy += (Math.random() - 0.6) * amount;
    body.stuck = 0;
  }
}
