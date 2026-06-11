import { useState, useEffect, useRef, useCallback, useReducer } from "react";

// ═══════════════════════════════════════════════════════════════
//  SECTION 1 — PURE MATH UTILITIES (matrix.ts equivalent)
// ═══════════════════════════════════════════════════════════════
const zeros = (n) => Array.from({ length: n }, () => new Array(n).fill(0));
const eye = (n) => { const m = zeros(n); for (let i = 0; i < n; i++) m[i][i] = 1; return m; };
const matmul = (A, B) => {
  const r = A.length, p = B.length, c = B[0].length;
  const C = Array.from({ length: r }, () => new Array(c).fill(0));
  for (let i = 0; i < r; i++) for (let k = 0; k < p; k++) if (A[i][k] !== 0) for (let j = 0; j < c; j++) C[i][j] += A[i][k] * B[k][j];
  return C;
};
const matadd = (A, B) => A.map((r, i) => r.map((v, j) => v + B[i][j]));
const matsub = (A, B) => A.map((r, i) => r.map((v, j) => v - B[i][j]));
const mattrans = (A) => Array.from({ length: A[0].length }, (_, j) => Array.from({ length: A.length }, (_, i) => A[i][j]));
const mattrace = (A) => A.reduce((s, r, i) => s + r[i], 0);
const inv3x3 = (S) => {
  const d = S[0][0] * (S[1][1] * S[2][2] - S[1][2] * S[2][1]) - S[0][1] * (S[1][0] * S[2][2] - S[1][2] * S[2][0]) + S[0][2] * (S[1][0] * S[2][1] - S[1][1] * S[2][0]);
  if (Math.abs(d) < 1e-9) return null;
  const I = zeros(3);
  I[0][0] = (S[1][1]*S[2][2]-S[1][2]*S[2][1])/d; I[0][1] = (S[0][2]*S[2][1]-S[0][1]*S[2][2])/d; I[0][2] = (S[0][1]*S[1][2]-S[0][2]*S[1][1])/d;
  I[1][0] = (S[1][2]*S[2][0]-S[1][0]*S[2][2])/d; I[1][1] = (S[0][0]*S[2][2]-S[0][2]*S[2][0])/d; I[1][2] = (S[0][2]*S[1][0]-S[0][0]*S[1][2])/d;
  I[2][0] = (S[1][0]*S[2][1]-S[1][1]*S[2][0])/d; I[2][1] = (S[0][1]*S[2][0]-S[0][0]*S[2][1])/d; I[2][2] = (S[0][0]*S[1][1]-S[0][1]*S[1][0])/d;
  return I;
};
const gauss = (std = 1) => { const u1 = Math.max(1e-10, Math.random()), u2 = Math.random(); return std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
const dist3 = (a, b) => Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ═══════════════════════════════════════════════════════════════
//  SECTION 2 — KALMAN FILTER CLASS  (core/KalmanFilter3D.ts)
// ═══════════════════════════════════════════════════════════════
class KalmanFilter3D {
  constructor() {
    this.X = [0, 0, 0, 0, 0, 0];
    this.P = eye(6);
    this.Q = zeros(6); this.R = zeros(3);
    this.F = zeros(6); this.B = zeros(6).map(() => new Array(3).fill(0));
    this.H = [[1,0,0,0,0,0],[0,1,0,0,0,0],[0,0,1,0,0,0]];
    this.U = [0, 0, 0];
    this._build(1/60, 9.8, 0.02, 2.25);
  }
  reset(pos, vel) {
    this.X = [...pos, ...vel];
    this.P = eye(6);
    for (let i = 0; i < 6; i++) this.P[i][i] = 100;
  }
  _build(dt, g, qv, rv) {
    this.F = [[1,0,0,dt,0,0],[0,1,0,0,dt,0],[0,0,1,0,0,dt],[0,0,0,1,0,0],[0,0,0,0,1,0],[0,0,0,0,0,1]];
    this.B = [[0,0,0],[0,0,0],[0,0,0.5*dt*dt],[0,0,0],[0,0,0],[0,0,dt]];
    this.U = [0, 0, -g];
    for (let i = 0; i < 6; i++) this.Q[i][i] = qv;
    for (let i = 0; i < 3; i++) this.R[i][i] = rv;
  }
  predict(dt, g, qv) {
    this._build(dt, g, qv, this.R[0][0]);
    const nX = new Array(6).fill(0);
    for (let i = 0; i < 6; i++) { let s = 0; for (let j = 0; j < 6; j++) s += this.F[i][j] * this.X[j]; for (let j = 0; j < 3; j++) s += this.B[i][j] * this.U[j]; nX[i] = s; }
    this.X = nX;
    const FP = matmul(this.F, this.P);
    this.P = matadd(matmul(FP, mattrans(this.F)), this.Q);
  }
  update(z) {
    const y = [z[0]-this.X[0], z[1]-this.X[1], z[2]-this.X[2]];
    const S = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S[i][j] = this.P[i][j] + this.R[i][j];
    const iS = inv3x3(S); if (!iS) return;
    const K = Array.from({ length: 6 }, (_, i) => [0,1,2].map(j => [0,1,2].reduce((s, k) => s + this.P[i][k] * iS[k][j], 0)));
    for (let i = 0; i < 6; i++) this.X[i] += K[i][0]*y[0] + K[i][1]*y[1] + K[i][2]*y[2];
    const KH = zeros(6); for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) KH[i][j] = K[i][j];
    this.P = matmul(matsub(eye(6), KH), this.P);
  }
  setRVariance(rv) { for (let i = 0; i < 3; i++) this.R[i][i] = rv; }
  uncertainty() { return mattrace(this.P); }
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 3 — PHYSICS ENGINE  (physics/PhysicsEngine.ts)
// ═══════════════════════════════════════════════════════════════
class PhysicsEngine {
  constructor(pos, vel, cfg) {
    this.pos = [...pos]; this.vel = [...vel]; this.cfg = { ...cfg };
  }
  setConfig(cfg) { this.cfg = { ...this.cfg, ...cfg }; }
  reset(pos, vel) { this.pos = [...pos]; this.vel = [...vel]; }
  randomiseVelocity(speed = 15) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    this.vel = [speed * Math.sin(ph) * Math.cos(th), speed * Math.sin(ph) * Math.sin(th), speed * Math.cos(ph)];
  }
  step() {
    const { gravity: g, restitution: e, airResistance: ar, boxSize: bs, dt } = this.cfg;
    this.vel[2] -= g * dt;
    const drag = 1 - clamp(ar * dt, 0, 0.99);
    this.vel[0] *= drag; this.vel[1] *= drag; this.vel[2] *= drag;
    this.pos[0] += this.vel[0] * dt; this.pos[1] += this.vel[1] * dt; this.pos[2] += this.vel[2] * dt;
    const half = bs / 2; let hit = false;
    for (let i = 0; i < 3; i++) {
      if (this.pos[i] > half)  { this.pos[i] = half;  this.vel[i] = -Math.abs(this.vel[i]) * e; hit = true; }
      else if (this.pos[i] < -half) { this.pos[i] = -half; this.vel[i] = Math.abs(this.vel[i]) * e; hit = true; }
    }
    return { pos: [...this.pos], vel: [...this.vel], hit };
  }
  forecast(steps) {
    const { gravity: g, restitution: e, airResistance: ar, boxSize: bs, dt } = this.cfg;
    const half = bs / 2; let p = [...this.pos], v = [...this.vel]; const path = [];
    for (let s = 0; s < steps; s++) {
      v[2] -= g * dt; const drag = 1 - clamp(ar * dt, 0, 0.99);
      for (let i = 0; i < 3; i++) { v[i] *= drag; p[i] += v[i] * dt; if (p[i] > half) { p[i] = half; v[i] = -Math.abs(v[i]) * e; } else if (p[i] < -half) { p[i] = -half; v[i] = Math.abs(v[i]) * e; } }
      path.push([...p]);
    }
    return path;
  }
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 4 — 3D CANVAS RENDERER  (2D projection of 3D space)
// ═══════════════════════════════════════════════════════════════
class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext("2d");
    this.theta = 0.55; this.phi = 0.50; this.scale = 22;
    this.trueTrail = []; this.kalmanTrail = []; this.TRAIL_MAX = 300;
    this._dragging = false; this._lastX = 0; this._lastY = 0;
    this._attachEvents();
  }
  _attachEvents() {
    const c = this.canvas;
    c.addEventListener("mousedown", e => { this._dragging = true; this._lastX = e.clientX; this._lastY = e.clientY; });
    window.addEventListener("mouseup", () => { this._dragging = false; });
    c.addEventListener("mousemove", e => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastX, dy = e.clientY - this._lastY;
      this._lastX = e.clientX; this._lastY = e.clientY;
      this.theta += dx * 0.007; this.phi = clamp(this.phi + dy * 0.007, 0.15, Math.PI - 0.15);
    });
    c.addEventListener("wheel", e => { e.preventDefault(); this.scale = clamp(this.scale - e.deltaY * 0.03, 10, 40); }, { passive: false });
    c.addEventListener("touchstart", e => { if (e.touches.length === 1) { this._dragging = true; this._lastX = e.touches[0].clientX; this._lastY = e.touches[0].clientY; } });
    c.addEventListener("touchmove", e => { e.preventDefault(); if (!this._dragging || e.touches.length !== 1) return; const dx = e.touches[0].clientX - this._lastX, dy = e.touches[0].clientY - this._lastY; this._lastX = e.touches[0].clientX; this._lastY = e.touches[0].clientY; this.theta += dx * 0.007; this.phi = clamp(this.phi + dy * 0.007, 0.15, Math.PI - 0.15); }, { passive: false });
    c.addEventListener("touchend", () => { this._dragging = false; });
  }
  // Project 3D world point → 2D canvas coords (isometric-style perspective)
  project(x, y, z) {
    const st = Math.sin(this.theta), ct = Math.cos(this.theta);
    const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    // Camera basis vectors
    const rx = ct * x + st * z;
    const ry = -sp * st * x + cp * y + sp * ct * z;
    const rz = cp * st * x + sp * y - cp * ct * z;
    const fov = 2.2; const dist = 60;
    const perspective = dist / (dist + rz);
    const W = this.canvas.width, H = this.canvas.height;
    return { sx: W / 2 + rx * this.scale * fov * perspective, sy: H / 2 - ry * this.scale * fov * perspective, depth: rz };
  }
  _boxEdges() {
    const h = 10; // half box
    const corners = [[-h,-h,-h],[-h,-h,h],[-h,h,-h],[-h,h,h],[h,-h,-h],[h,-h,h],[h,h,-h],[h,h,h]];
    const edges = [[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
    return { corners: corners.map(([x,y,z]) => this.project(x, y, z)), edges };
  }
  addTrue(pos) { this.trueTrail.push([...pos]); if (this.trueTrail.length > this.TRAIL_MAX) this.trueTrail.shift(); }
  addKalman(pos) { this.kalmanTrail.push([...pos]); if (this.kalmanTrail.length > this.TRAIL_MAX) this.kalmanTrail.shift(); }
  clearTrails() { this.trueTrail = []; this.kalmanTrail = []; }
  draw(state) {
    const { truePos, kalmanPos, sensorPos, showTrue, showKalman, showSensor, showForecast, forecast, running } = state;
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0b1426"; ctx.fillRect(0, 0, W, H);
    // ── Box wireframe
    const { corners, edges } = this._boxEdges();
    ctx.strokeStyle = "rgba(51,65,85,0.8)"; ctx.lineWidth = 0.8;
    edges.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(corners[a].sx, corners[a].sy); ctx.lineTo(corners[b].sx, corners[b].sy); ctx.stroke(); });
    // Floor grid
    ctx.strokeStyle = "rgba(30,58,95,0.35)"; ctx.lineWidth = 0.5;
    const h = 10, gridDiv = 4;
    for (let i = -gridDiv; i <= gridDiv; i++) {
      const t = i * (h / gridDiv);
      const p0 = this.project(-h, -h, t), p1 = this.project(h, -h, t);
      const q0 = this.project(t, -h, -h), q1 = this.project(t, -h, h);
      ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(q0.sx, q0.sy); ctx.lineTo(q1.sx, q1.sy); ctx.stroke();
    }
    // ── Forecast trail
    if (showForecast && forecast && forecast.length > 1) {
      ctx.strokeStyle = "rgba(251,191,36,0.35)"; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
      ctx.beginPath();
      forecast.forEach((p, i) => { const { sx, sy } = this.project(...p); i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy); });
      ctx.stroke(); ctx.setLineDash([]);
    }
    // ── True trail
    if (showTrue && this.trueTrail.length > 1) {
      ctx.lineWidth = 1.2;
      for (let i = 1; i < this.trueTrail.length; i++) {
        const alpha = (i / this.trueTrail.length) * 0.6;
        ctx.strokeStyle = `rgba(34,197,94,${alpha})`;
        const a = this.project(...this.trueTrail[i-1]), b = this.project(...this.trueTrail[i]);
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      }
    }
    // ── Kalman trail
    if (showKalman && this.kalmanTrail.length > 1) {
      ctx.lineWidth = 1.6;
      for (let i = 1; i < this.kalmanTrail.length; i++) {
        const alpha = (i / this.kalmanTrail.length) * 0.9;
        ctx.strokeStyle = `rgba(6,182,212,${alpha})`;
        const a = this.project(...this.kalmanTrail[i-1]), b = this.project(...this.kalmanTrail[i]);
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      }
    }
    // Sort drawables by depth for correct occlusion
    const drawables = [];
    if (truePos) drawables.push({ type: "true", pos: truePos });
    if (kalmanPos) drawables.push({ type: "kalman", pos: kalmanPos });
    if (sensorPos && showSensor) drawables.push({ type: "sensor", pos: sensorPos });
    drawables.sort((a, b) => this.project(...b.pos).depth - this.project(...a.pos).depth);
    drawables.forEach(({ type, pos }) => {
      const { sx, sy } = this.project(...pos);
      if (type === "true") {
        ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI*2);
        ctx.fillStyle = "#22c55e"; ctx.fill();
        ctx.strokeStyle = "rgba(34,197,94,0.4)"; ctx.lineWidth = 3; ctx.stroke();
      } else if (type === "kalman") {
        ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI*2);
        ctx.fillStyle = "rgba(6,182,212,0.9)"; ctx.fill();
        ctx.strokeStyle = "rgba(6,182,212,0.35)"; ctx.lineWidth = 3; ctx.stroke();
      } else if (type === "sensor") {
        const s = 5;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.PI/4);
        ctx.beginPath(); ctx.rect(-s, -s, s*2, s*2);
        ctx.fillStyle = "#f43f5e"; ctx.fill();
        ctx.restore();
      }
    });
    // Idle overlay
    if (!running) {
      ctx.fillStyle = "rgba(11,20,38,0.72)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#38bdf8"; ctx.font = "bold 28px monospace"; ctx.textAlign = "center"; ctx.fillText("∿", W/2, H/2 - 18);
      ctx.fillStyle = "#e2e8f0"; ctx.font = "600 14px Inter,system-ui,sans-serif"; ctx.fillText("3D Kalman Filter Simulation", W/2, H/2 + 8);
      ctx.fillStyle = "#475569"; ctx.font = "11px Inter,system-ui,sans-serif"; ctx.fillText("Drag to orbit  ·  Scroll to zoom  ·  Press Start", W/2, H/2 + 28);
      ctx.textAlign = "left";
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 5 — DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════
const DEFAULT_CFG = {
  gravity: 9.8, restitution: 0.85, airResistance: 0.05, boxSize: 20, dt: 1/60,
  noiseStdDev: 1.5, sampleInterval: 2, dropRate: 0.15,
  qNominal: 0.02, qCollision: 5.0,
  showTrue: true, showKalman: true, showSensor: true, showForecast: false,
};
const INIT_POS = [0, 6, 2], INIT_VEL = [8, 12, 5];

// ═══════════════════════════════════════════════════════════════
//  SECTION 6 — SMALL REUSABLE UI COMPONENTS
// ═══════════════════════════════════════════════════════════════
function Slider({ label, value, min, max, step, unit = "", fmt, onChange, hint }) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = fmt ? fmt(value) : (step < 0.1 ? value.toFixed(3) : step < 1 ? value.toFixed(2) : String(value));
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 700, fontFamily: "monospace" }}>{display}{unit}</span>
      </div>
      <div style={{ position: "relative", height: 18, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 3, background: "#1e3a5f", borderRadius: 2 }} />
        <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 3, background: "linear-gradient(90deg,#0ea5e9,#06b6d4)", borderRadius: 2 }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position: "absolute", left: 0, right: 0, width: "100%", opacity: 0, cursor: "pointer", height: 18, margin: 0 }} />
        <div style={{ position: "absolute", left: `calc(${pct}% - 6px)`, width: 12, height: 12, borderRadius: "50%", background: "#e2e8f0", border: "2px solid #06b6d4", pointerEvents: "none" }} />
      </div>
      {hint && <div style={{ fontSize: 9, color: "#334155", marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function Toggle({ label, value, onChange, color = "#06b6d4", sub }) {
  return (
    <div onClick={onChange} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", padding: "5px 0", userSelect: "none" }}>
      <div style={{ width: 32, height: 17, borderRadius: 9, background: value ? color : "#1e3a5f", position: "relative", border: value ? "none" : "1px solid #334155", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 1.5, left: value ? 16 : 1.5, width: 13, height: 13, borderRadius: "50%", background: "#e2e8f0", transition: "left 0.18s" }} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: value ? "#e2e8f0" : "#64748b", fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 9.5, color: "#475569" }}>{sub}</div>}
      </div>
    </div>
  );
}

function Btn({ children, onClick, variant = "secondary", disabled, icon }) {
  const styles = {
    primary: { background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", color: "#fff", border: "none" },
    secondary: { background: "#1e3a5f", color: "#94a3b8", border: "1px solid #2d4a6e" },
    danger: { background: "linear-gradient(135deg,#dc2626,#f43f5e)", color: "#fff", border: "none" },
    ghost: { background: "transparent", color: "#64748b", border: "1px solid #1e3a5f" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...styles[variant], padding: "6px 11px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, display: "flex", alignItems: "center", gap: 5, letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {icon && <span>{icon}</span>}{children}
    </button>
  );
}

function MetCard({ label, value, color, sub }) {
  return (
    <div style={{ background: "#0f172a", borderRadius: 7, padding: "8px 10px", border: `1px solid ${value === "—" ? "#1e3a5f" : color + "33"}`, minWidth: 78 }}>
      <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "monospace", marginTop: 1, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#475569", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function StatusPill({ status }) {
  const map = { idle: ["#64748b", "IDLE"], running: ["#22c55e", "LIVE"], paused: ["#f59e0b", "PAUSED"] };
  const [c, l] = map[status];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: c + "18", border: `1px solid ${c}44`, padding: "3px 9px", borderRadius: 12 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: c, boxShadow: status === "running" ? `0 0 6px ${c}` : "none", animation: status === "running" ? "blink 1.2s infinite" : "none" }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: c, letterSpacing: "0.07em" }}>{l}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 7 — MINI CHART  (canvas-based, no lib needed)
// ═══════════════════════════════════════════════════════════════
function MiniChart({ data, mode }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width = c.clientWidth * (window.devicePixelRatio || 1);
    const H = c.height = c.clientHeight * (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0b1426"; ctx.fillRect(0, 0, W, H);
    if (!data || data.length < 2) { ctx.fillStyle = "#1e3a5f"; ctx.font = "11px monospace"; ctx.textAlign = "center"; ctx.fillText("Awaiting data…", W/2, H/2); return; }
    const pad = { l: 36, r: 8, t: 8, b: 20 };
    const series = mode === "rmse" ? [data.map(d => d.k), data.map(d => d.s)] : [data.map(d => d.cov)];
    const colors = mode === "rmse" ? ["#06b6d4", "#f43f5e"] : ["#a78bfa"];
    const dashes = mode === "rmse" ? [false, true] : [false];
    const allV = series.flat().filter(v => v != null && v > 0);
    const maxV = allV.length ? Math.max(...allV) * 1.18 : 1;
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    // Grid lines
    ctx.strokeStyle = "#1e3a5f"; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 3; i++) {
      const y = pad.t + ch * (1 - i/3);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = "#334155"; ctx.font = `${10 * (window.devicePixelRatio||1)}px monospace`;
      ctx.fillText((maxV * i/3).toFixed(2), 2, y + 4);
    }
    const n = data.length;
    series.forEach((s, si) => {
      ctx.strokeStyle = colors[si]; ctx.lineWidth = si === 0 ? 1.8 : 1.3;
      ctx.setLineDash(dashes[si] ? [4*2, 2*2] : []);
      ctx.beginPath(); let started = false;
      for (let i = 0; i < n; i++) {
        const v = s[i]; if (v == null || v <= 0) { started = false; continue; }
        const x = pad.l + (i / (n - 1)) * cw, y = pad.t + ch * (1 - v / maxV);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    });
    ctx.textAlign = "left";
  }, [data, mode]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 8 — PANEL CONTENT COMPONENTS
// ═══════════════════════════════════════════════════════════════
function PhysicsPanel({ cfg, setCfg }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#475569", marginBottom: 12, lineHeight: 1.65 }}>Configure Newtonian dynamics. Changes apply to the live simulation immediately.</div>
      <Slider label="Gravity" value={cfg.gravity} min={0} max={25} step={0.5} unit=" m/s²" onChange={v => setCfg("gravity", v)} hint="9.8 = Earth · 0 = zero-G · 25 = high-G experiment" />
      <Slider label="Restitution (e)" value={cfg.restitution} min={0.1} max={1.0} step={0.05} onChange={v => setCfg("restitution", v)} hint="1.0 = perfect elastic bounce · 0.1 = near-inelastic" />
      <Slider label="Air Resistance" value={cfg.airResistance} min={0} max={0.3} step={0.01} onChange={v => setCfg("airResistance", v)} hint="0 = vacuum · 0.3 = dense medium, rapid deceleration" />
      <div style={{ borderTop: "1px solid #1e3a5f", paddingTop: 10, marginTop: 2 }}>
        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Sim Constants</div>
        <div style={{ display: "flex", gap: 7 }}>
          {[["Box Size", `±${cfg.boxSize/2} m`], ["Timestep dt", `${(cfg.dt*1000).toFixed(1)} ms`], ["Target FPS", "~60 fps"]].map(([l, v]) => (
            <div key={l} style={{ flex: 1, background: "#0b1426", padding: "5px 7px", borderRadius: 5 }}>
              <div style={{ fontSize: 9, color: "#475569" }}>{l}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SensorPanel({ cfg, setCfg }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#475569", marginBottom: 12, lineHeight: 1.65 }}>Emulates non-ideal hardware: downsampling, Gaussian noise injection, and random packet loss.</div>
      <Slider label="Noise σ" value={cfg.noiseStdDev} min={0.1} max={5.0} step={0.1} unit=" m" fmt={v => v.toFixed(1)} onChange={v => setCfg("noiseStdDev", v)} hint="Std-dev per axis. R = σ² in measurement noise matrix" />
      <Slider label="Sample Interval" value={cfg.sampleInterval} min={1} max={12} step={1} unit=" frames" onChange={v => setCfg("sampleInterval", Math.round(v))} hint="1 = full-rate sensor · 12 = very sparse / heavy compute" />
      <Slider label="Packet Drop Rate" value={cfg.dropRate} min={0} max={0.85} step={0.05} fmt={v => `${(v*100).toFixed(0)}%`} onChange={v => setCfg("dropRate", v)} hint="Probability any scheduled sample is silently discarded" />
      <div style={{ borderTop: "1px solid #1e3a5f", paddingTop: 10, marginTop: 2 }}>
        <Toggle label="Show Sensor Markers" value={cfg.showSensor} onChange={() => setCfg("showSensor", !cfg.showSensor)} color="#f43f5e" sub="Red squares = raw noisy observations" />
      </div>
      <div style={{ marginTop: 10, background: "#0b1426", borderRadius: 5, padding: "7px 9px", border: "1px solid #1e3a5f" }}>
        <div style={{ fontSize: 9, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Configured R Matrix</div>
        <code style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
          diag([{cfg.noiseStdDev.toFixed(1)}², {cfg.noiseStdDev.toFixed(1)}², {cfg.noiseStdDev.toFixed(1)}²])<br />
          = diag([{(cfg.noiseStdDev**2).toFixed(2)}, {(cfg.noiseStdDev**2).toFixed(2)}, {(cfg.noiseStdDev**2).toFixed(2)}])
        </code>
      </div>
    </div>
  );
}

function FilterPanel({ cfg, setCfg }) {
  const qrRatio = cfg.qNominal / (cfg.noiseStdDev ** 2);
  const balance = qrRatio < 0.01 ? "Sensor-dominant: smooth but may lag manoeuvres" : qrRatio > 0.2 ? "Model-dominant: responsive but noisier estimate" : "Balanced: good steady-state convergence";
  return (
    <div>
      <div style={{ fontSize: 10, color: "#475569", marginBottom: 12, lineHeight: 1.65 }}>Tune the process noise Q and measurement noise R. These govern the trust balance between physics model and sensor data.</div>
      <Slider label="Q Nominal (process noise)" value={cfg.qNominal} min={0.001} max={0.5} step={0.005} fmt={v => v.toFixed(3)} onChange={v => setCfg("qNominal", v)} hint="Low Q = smooth trajectory, slow to follow manoeuvres" />
      <Slider label="Q Collision (adaptive boost)" value={cfg.qCollision} min={0.5} max={20} step={0.5} fmt={v => v.toFixed(1)} onChange={v => setCfg("qCollision", v)} hint="Q inflated to this at wall-hit — forces fast re-acquisition" />
      <div style={{ background: "#0b1426", borderRadius: 5, padding: "8px 9px", border: "1px solid #1e3a5f", marginBottom: 12 }}>
        <div style={{ fontSize: 9, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Q / R Ratio</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 5, background: "#1e3a5f", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, qrRatio * 500)}%`, background: "linear-gradient(90deg,#0ea5e9,#22c55e)", borderRadius: 3, transition: "width 0.2s" }} />
          </div>
          <code style={{ fontSize: 11, color: "#94a3b8", minWidth: 52 }}>{qrRatio.toFixed(4)}</code>
        </div>
        <div style={{ fontSize: 9.5, color: "#475569", marginTop: 4 }}>{balance}</div>
      </div>
      <div style={{ borderTop: "1px solid #1e3a5f", paddingTop: 10 }}>
        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Visualisation Layers</div>
        <Toggle label="True Trajectory" value={cfg.showTrue} onChange={() => setCfg("showTrue", !cfg.showTrue)} color="#22c55e" sub="Green — ground-truth physics path" />
        <Toggle label="Kalman Trajectory" value={cfg.showKalman} onChange={() => setCfg("showKalman", !cfg.showKalman)} color="#06b6d4" sub="Cyan — filter state estimate path" />
        <Toggle label="Forecast Ghost (1s)" value={cfg.showForecast} onChange={() => setCfg("showForecast", !cfg.showForecast)} color="#f59e0b" sub="Yellow dashed — predictive lookahead" />
      </div>
    </div>
  );
}

function AboutPanel() {
  const S = ({ title, children }) => (
    <div style={{ marginBottom: 13 }}>
      <div style={{ fontSize: 10, color: "#38bdf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
  const M = ({ c }) => <code style={{ background: "#0b1426", padding: "1px 4px", borderRadius: 3, fontFamily: "monospace", fontSize: 10, color: "#94a3b8" }}>{c}</code>;
  return (
    <div>
      <S title="State Space Model"><M c="X = [x y z vx vy vz]ᵀ" /> · Transition matrix <M c="F" /> encodes constant-velocity kinematics. Gravity enters as <M c="B·U" /> where <M c="U=[0,0,−g]ᵀ" />.</S>
      <S title="Predict Step"><M c="X̂ = F·X + B·U" /> &nbsp;·&nbsp; <M c="P̂ = F·P·Fᵀ + Q" /> — runs every frame regardless of sensor availability.</S>
      <S title="Update Step"><M c="y = Z − H·X̂" /> (innovation) &nbsp;·&nbsp; <M c="K = P̂·Hᵀ·S⁻¹" /> (Kalman gain) &nbsp;·&nbsp; <M c="X = X̂ + K·y" /></S>
      <S title="Adaptive Q Inflation">At wall collisions the true velocity inverts — a non-linearity the linear KF cannot predict. Q is inflated ×250 for 1–2 frames, spiking K so the filter heavily trusts the incoming measurement over the now-wrong prediction. Re-acquisition happens within 2 frames.</S>
      <S title="RMSE Metric"><M c="√(1/N · Σ ||X_true − X̂||²)" /> accumulated across all frames. A well-tuned system achieves Kalman RMSE ≤ 0.5× Sensor RMSE under normal noise conditions.</S>
      <S title="R vs Q Tuning">R large → filter distrusts sensor → smooth but lagged. Q large → filter distrusts model → responsive but noisier. Optimal: <M c="Q/R ≈ σ_process²/σ_sensor²" />.</S>
      <div style={{ padding: "8px 9px", background: "#0b1426", borderRadius: 5, border: "1px solid #1e3a5f", fontSize: 10, color: "#334155" }}>
        Architecture: React 18 · Zustand · Three.js / WebGL · TypeScript 5 · Vite — spec V1.0.0
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 9 — ROOT APP COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const physicsRef = useRef(null);
  const kfRef = useRef(null);
  const rafRef = useRef(null);
  const simStateRef = useRef({ frame: 0, sumSqK: 0, sumSqS: 0, sensorCnt: 0, running: false, paused: false });

  const [status, setStatus] = useState("idle");
  const [activePanel, setActivePanel] = useState("physics");
  const [chartMode, setChartMode] = useState("rmse");
  const [cfg, setCfgState] = useState(DEFAULT_CFG);
  const cfgRef = useRef(cfg);

  const [metrics, setMetrics] = useState({ rmseK: "—", rmseS: "—", errK: "—", cov: "—", frame: 0, vx: 0, vy: 0, vz: 0 });
  const [chartData, setChartData] = useState([]);

  const setCfg = useCallback((key, val) => {
    setCfgState(prev => { const next = { ...prev, [key]: val }; cfgRef.current = next; return next; });
  }, []);

  // ── Init subsystems
  const initSim = useCallback(() => {
    if (!canvasRef.current) return;
    const cfg0 = cfgRef.current;
    rendererRef.current = new Renderer3D(canvasRef.current);
    physicsRef.current = new PhysicsEngine([...INIT_POS], [...INIT_VEL], cfg0);
    kfRef.current = new KalmanFilter3D();
    kfRef.current.reset([...INIT_POS], [...INIT_VEL]);
    kfRef.current.setRVariance(cfg0.noiseStdDev ** 2);
    simStateRef.current = { frame: 0, sumSqK: 0, sumSqS: 0, sensorCnt: 0, running: false, paused: false };
  }, []);

  // ── Animation loop
  const startLoop = useCallback(() => {
    const ss = simStateRef.current;
    ss.running = true; ss.paused = false;
    const localChartData = [];
    const tick = () => {
      if (!ss.running) return;
      rafRef.current = requestAnimationFrame(tick);
      if (ss.paused) { rendererRef.current?.draw({ running: false }); return; }
      const cfg0 = cfgRef.current;
      ss.frame++;
      const physics = physicsRef.current;
      const kf = kfRef.current;
      const rend = rendererRef.current;
      physics.setConfig(cfg0);
      kf.setRVariance(cfg0.noiseStdDev ** 2);
      const { pos: truePos, hit } = physics.step();
      const qv = hit ? cfg0.qCollision : cfg0.qNominal;
      kf.predict(cfg0.dt, cfg0.gravity, qv);
      let sensorPos = null;
      if (ss.frame % cfg0.sampleInterval === 0 && Math.random() > cfg0.dropRate) {
        const σ = cfg0.noiseStdDev;
        sensorPos = [truePos[0] + gauss(σ), truePos[1] + gauss(σ), truePos[2] + gauss(σ)];
        kf.update(sensorPos);
        ss.sumSqS += dist3(truePos, sensorPos) ** 2;
        ss.sensorCnt++;
      }
      const kalmanPos = [kf.X[0], kf.X[1], kf.X[2]];
      const errK = dist3(truePos, kalmanPos);
      ss.sumSqK += errK ** 2;
      const rmseK = Math.sqrt(ss.sumSqK / ss.frame);
      const rmseS = ss.sensorCnt > 0 ? Math.sqrt(ss.sumSqS / ss.sensorCnt) : 0;
      const cov = kf.uncertainty();
      rend.addTrue(truePos);
      rend.addKalman(kalmanPos);
      const forecast = cfg0.showForecast && ss.frame % 5 === 0 ? physics.forecast(60) : undefined;
      rend.draw({ truePos, kalmanPos, sensorPos, showTrue: cfg0.showTrue, showKalman: cfg0.showKalman, showSensor: cfg0.showSensor, showForecast: cfg0.showForecast, forecast, running: true });
      if (ss.frame % 6 === 0) {
        localChartData.push({ k: rmseK, s: rmseS, cov });
        if (localChartData.length > 150) localChartData.shift();
        setChartData([...localChartData]);
      }
      if (ss.frame % 10 === 0) {
        setMetrics({ rmseK: rmseK.toFixed(3), rmseS: rmseS.toFixed(3), errK: errK.toFixed(3), cov: cov.toFixed(1), frame: ss.frame, vx: kf.X[3], vy: kf.X[4], vz: kf.X[5] });
      }
    };
    tick();
  }, []);

  const handleStart = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    initSim();
    setStatus("running");
    setChartData([]);
    setMetrics({ rmseK: "—", rmseS: "—", errK: "—", cov: "—", frame: 0, vx: 0, vy: 0, vz: 0 });
    setTimeout(startLoop, 20);
  }, [initSim, startLoop]);

  const handlePause = useCallback(() => {
    const ss = simStateRef.current;
    ss.paused = !ss.paused;
    setStatus(ss.paused ? "paused" : "running");
  }, []);

  const handleReset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const ss = simStateRef.current;
    ss.running = false;
    initSim();
    setStatus("idle");
    setChartData([]);
    setMetrics({ rmseK: "—", rmseS: "—", errK: "—", cov: "—", frame: 0, vx: 0, vy: 0, vz: 0 });
    setTimeout(() => rendererRef.current?.draw({ running: false }), 30);
  }, [initSim]);

  const handleRandomise = useCallback(() => {
    physicsRef.current?.randomiseVelocity();
  }, []);

  // Sync cfgRef
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);

  // Init renderer on mount
  useEffect(() => {
    initSim();
    setTimeout(() => rendererRef.current?.draw({ running: false }), 30);
    return () => { cancelAnimationFrame(rafRef.current); simStateRef.current.running = false; };
  }, []);

  // Resize canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    const obs = new ResizeObserver(() => {
      if (!canvasRef.current) return;
      const pr = window.devicePixelRatio || 1;
      canvasRef.current.width = canvasRef.current.clientWidth * pr;
      canvasRef.current.height = canvasRef.current.clientHeight * pr;
    });
    obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, []);

  const TABS = [
    { id: "physics", label: "Physics", icon: "⚙" },
    { id: "sensor", label: "Sensor", icon: "📡" },
    { id: "filter", label: "Filter", icon: "∿" },
    { id: "about", label: "About", icon: "?" },
  ];

  const isRunning = status === "running";
  const hasData = metrics.rmseK !== "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0b1426", fontFamily: "Inter,system-ui,sans-serif", overflow: "hidden", color: "#e2e8f0" }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.4} }
        input[type=range]{-webkit-appearance:none;appearance:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:0;height:0}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:2px}
        *{box-sizing:border-box;margin:0;padding:0}
      `}</style>

      {/* ─── HEADER ─────────────────────────────────────────── */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 48, background: "#0f172a", borderBottom: "1px solid #1e3a5f", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 5, background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, boxShadow: "0 0 12px rgba(6,182,212,0.4)" }}>∿</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>KalmanTracker 3D</div>
            <div style={{ fontSize: 10, color: "#475569" }}>Real-time 6-DOF State Estimation · WebGL</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <StatusPill status={status} />
          {status === "idle"
            ? <Btn variant="primary" onClick={handleStart} icon="▶">Start</Btn>
            : <Btn variant="primary" onClick={handlePause} icon={isRunning ? "⏸" : "▶"}>{isRunning ? "Pause" : "Resume"}</Btn>}
          <Btn variant="secondary" onClick={handleReset} icon="↺">Reset</Btn>
          <Btn variant="ghost" onClick={handleRandomise} disabled={!isRunning} icon="⚂">Randomise</Btn>
        </div>
      </header>

      {/* ─── MAIN ───────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ─── VIEWPORT + CHART ──────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", minWidth: 0 }}>

          {/* 3D Canvas */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", cursor: "grab" }} />

            {/* Legend */}
            <div style={{ position: "absolute", top: 10, left: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              {[["#22c55e", "True State"], ["#06b6d4", "Kalman Estimate"], ["#f43f5e", "Sensor Reading"], ["#f59e0b", "Forecast (1s)"]].map(([c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: c, boxShadow: `0 0 5px ${c}88` }} />
                  <span style={{ fontSize: 10, color: "#64748b" }}>{l}</span>
                </div>
              ))}
            </div>

            {/* Live metric cards floating over canvas */}
            <div style={{ position: "absolute", bottom: 12, left: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <MetCard label="Kalman RMSE" value={hasData ? metrics.rmseK + "m" : "—"} color="#06b6d4" sub="Cumulative" />
              <MetCard label="Sensor RMSE" value={hasData ? metrics.rmseS + "m" : "—"} color="#f43f5e" sub="Sensor frames" />
              <MetCard label="Current Error" value={hasData ? metrics.errK + "m" : "—"} color="#22c55e" sub="Instantaneous" />
              <MetCard label="tr(P)" value={hasData ? metrics.cov : "—"} color="#a78bfa" sub="Uncertainty" />
            </div>
          </div>

          {/* ─── CHART PANEL ──────────────────────────────── */}
          <div style={{ height: 132, borderTop: "1px solid #1e3a5f", background: "#0b1426", padding: "8px 14px 6px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 5 }}>
                {["rmse", "cov"].map(t => (
                  <button key={t} onClick={() => setChartMode(t)} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, cursor: "pointer", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", background: chartMode === t ? "#1e3a5f" : "transparent", color: chartMode === t ? "#38bdf8" : "#475569", border: chartMode === t ? "1px solid #2d4a6e" : "1px solid transparent" }}>
                    {t === "rmse" ? "RMSE Error" : "Covariance tr(P)"}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 10, color: "#334155" }}>{hasData ? `Frame ${metrics.frame.toLocaleString()}` : ""}</span>
            </div>
            <div style={{ height: 82 }}>
              <MiniChart data={chartData} mode={chartMode} />
            </div>
          </div>
        </div>

        {/* ─── SIDEBAR ────────────────────────────────────── */}
        <aside style={{ width: 275, flexShrink: 0, background: "#0f172a", borderLeft: "1px solid #1e3a5f", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Panel tabs */}
          <div style={{ display: "flex", padding: "7px 8px 0", borderBottom: "1px solid #1e3a5f", gap: 3, flexShrink: 0, flexWrap: "wrap" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActivePanel(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 8px", borderRadius: 5, cursor: "pointer", background: activePanel === t.id ? "#1e3a5f" : "transparent", border: activePanel === t.id ? "1px solid #2d4a6e" : "1px solid transparent", color: activePanel === t.id ? "#38bdf8" : "#64748b", fontSize: 9, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", minWidth: 48 }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "13px 13px 16px" }}>
            {activePanel === "physics" && <PhysicsPanel cfg={cfg} setCfg={setCfg} />}
            {activePanel === "sensor"  && <SensorPanel  cfg={cfg} setCfg={setCfg} />}
            {activePanel === "filter"  && <FilterPanel  cfg={cfg} setCfg={setCfg} />}
            {activePanel === "about"   && <AboutPanel />}
          </div>

          {/* Velocity footer */}
          <div style={{ borderTop: "1px solid #1e3a5f", padding: "8px 13px", flexShrink: 0, background: "#0b1426" }}>
            <div style={{ fontSize: 9, color: "#334155", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Kalman Estimated Velocity</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["X", metrics.vx], ["Y", metrics.vy], ["Z", metrics.vz]].map(([ax, v]) => (
                <div key={ax} style={{ flex: 1, textAlign: "center", background: "#0f172a", borderRadius: 4, padding: "4px 0" }}>
                  <div style={{ fontSize: 9, color: "#475569" }}>{ax}</div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>{typeof v === "number" ? v.toFixed(1) : "0.0"}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
