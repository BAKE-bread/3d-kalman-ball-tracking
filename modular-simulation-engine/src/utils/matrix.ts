// ============================================================
// utils/matrix.ts — Pure linear-algebra helpers (no side-effects)
// All functions operate on plain number[][] for zero deps.
// ============================================================

/** Create an N×N zero matrix */
export const zeros = (n: number): number[][] =>
  Array.from({ length: n }, () => new Array(n).fill(0));

/** Create an N×N identity matrix */
export const identity = (n: number): number[][] => {
  const m = zeros(n);
  for (let i = 0; i < n; i++) m[i][i] = 1;
  return m;
};

/** Deep-clone a matrix */
export const cloneMatrix = (m: number[][]): number[][] =>
  m.map(row => [...row]);

/** Matrix × Matrix multiply: (r×p) × (p×c) → (r×c) */
export const matMul = (A: number[][], B: number[][]): number[][] => {
  const r = A.length, p = B.length, c = B[0].length;
  const C = Array.from({ length: r }, () => new Array(c).fill(0));
  for (let i = 0; i < r; i++)
    for (let k = 0; k < p; k++)
      if (A[i][k] !== 0)
        for (let j = 0; j < c; j++)
          C[i][j] += A[i][k] * B[k][j];
  return C;
};

/** Matrix transpose */
export const transpose = (A: number[][]): number[][] => {
  const r = A.length, c = A[0].length;
  return Array.from({ length: c }, (_, j) =>
    Array.from({ length: r }, (_, i) => A[i][j])
  );
};

/** Element-wise A + B */
export const matAdd = (A: number[][], B: number[][]): number[][] =>
  A.map((row, i) => row.map((v, j) => v + B[i][j]));

/** Element-wise A − B */
export const matSub = (A: number[][], B: number[][]): number[][] =>
  A.map((row, i) => row.map((v, j) => v - B[i][j]));

/** Scalar × matrix */
export const matScale = (s: number, A: number[][]): number[][] =>
  A.map(row => row.map(v => v * s));

/** Compute trace(A) — sum of diagonal elements */
export const trace = (A: number[][]): number =>
  A.reduce((acc, row, i) => acc + row[i], 0);

/**
 * Invert a 3×3 matrix via cofactor expansion.
 * Returns null if singular (|det| < ε).
 */
export const invert3x3 = (S: number[][]): number[][] | null => {
  const det =
    S[0][0] * (S[1][1] * S[2][2] - S[1][2] * S[2][1]) -
    S[0][1] * (S[1][0] * S[2][2] - S[1][2] * S[2][0]) +
    S[0][2] * (S[1][0] * S[2][1] - S[1][1] * S[2][0]);

  if (Math.abs(det) < 1e-9) return null;

  const inv = zeros(3);
  inv[0][0] = (S[1][1] * S[2][2] - S[1][2] * S[2][1]) / det;
  inv[0][1] = (S[0][2] * S[2][1] - S[0][1] * S[2][2]) / det;
  inv[0][2] = (S[0][1] * S[1][2] - S[0][2] * S[1][1]) / det;
  inv[1][0] = (S[1][2] * S[2][0] - S[1][0] * S[2][2]) / det;
  inv[1][1] = (S[0][0] * S[2][2] - S[0][2] * S[2][0]) / det;
  inv[1][2] = (S[0][2] * S[1][0] - S[0][0] * S[1][2]) / det;
  inv[2][0] = (S[1][0] * S[2][1] - S[1][1] * S[2][0]) / det;
  inv[2][1] = (S[0][1] * S[2][0] - S[0][0] * S[2][1]) / det;
  inv[2][2] = (S[0][0] * S[1][1] - S[0][1] * S[1][0]) / det;
  return inv;
};

/** Euclidean distance between two 3-vectors */
export const dist3 = (a: [number,number,number], b: [number,number,number]): number =>
  Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);

/** Box-Muller Gaussian noise */
export const gaussianNoise = (mean = 0, std = 1): number => {
  const u1 = Math.max(1e-10, Math.random());
  const u2 = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

/** Clamp scalar to [lo, hi] */
export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));
