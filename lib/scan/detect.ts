/* eslint-disable @typescript-eslint/no-explicit-any */
// Finds a printed ballot in a camera frame, straightens it, locates its checkboxes and measures how much ink is in each.
// Runs entirely in the browser with OpenCV.js; no image ever leaves the device.

export type BoxState = "marked" | "uncertain" | "empty";
export interface ScanBox { n: number; x: number; y: number; w: number; h: number; score: number; state: BoxState }
export interface Point { x: number; y: number }

export interface ScanOptions {
  findBallot: boolean; // false: treat the whole frame as the ballot (already cropped)
  markedAt: number; // ink fraction at or above which a box counts as marked
  uncertainAt: number; // ink fraction at or above which a box needs a person to look
  debug?: boolean; // outline everything that was considered, not just the boxes it chose
}
export const DEFAULT_OPTIONS: ScanOptions = { findBallot: true, markedAt: 0.2, uncertainAt: 0.04 };

export interface ScanResult {
  found: boolean;
  quad: Point[] | null; // ballot corners in the source frame's pixel space
  frameSize: { w: number; h: number };
  warped: HTMLCanvasElement | null; // straightened ballot with the box overlay drawn on it
  boxes: ScanBox[];
  ms: number;
}

const W = 620; // size of the straightened ballot
const H = 1700;
const MAX_SIDE = 1100; // frames are shrunk to this before analysis

// opencv.js' module object has a `then` method, so resolving a promise with it directly never finishes (it keeps
// unwrapping itself). Hand it out inside a plain holder instead.
let loading: Promise<{ cv: any }> | null = null;
export function loadOpenCv(): Promise<{ cv: any }> {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    // Never `await` the module: it is thenable and would unwrap itself forever.
    const ready = () => {
      const cv = (window as any).cv;
      if (cv?.Mat) resolve({ cv });
      else cv.onRuntimeInitialized = () => resolve({ cv });
    };
    if ((window as any).cv) { ready(); return; }
    const s = document.createElement("script");
    s.src = "/vendor/opencv.js";
    s.async = true;
    s.onload = ready;
    s.onerror = () => { loading = null; reject(new Error("Could not load the image library.")); };
    document.head.appendChild(s);
  });
  return loading;
}

function orderCorners(p: Point[]): Point[] {
  const bySum = [...p].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...p].sort((a, b) => a.x - a.y - (b.x - b.y));
  return [bySum[0], byDiff[byDiff.length - 1], bySum[3], byDiff[0]]; // tl, tr, br, bl
}
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function findQuad(cv: any, rgba: any, frame: { w: number; h: number }): Point[] | null {
  // Paper is pale and colourless; tables, walls and clothes are not. Brightness alone confuses a white sheet with a light table.
  const rgb = new cv.Mat(), hsv = new cv.Mat(), mask = new cv.Mat();
  const lo = new cv.Mat(frame.h, frame.w, cv.CV_8UC3, new cv.Scalar(0, 0, 111)), hi = new cv.Mat(frame.h, frame.w, cv.CV_8UC3, new cv.Scalar(180, 69, 255));
  const open = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5)), close = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(15, 15));
  const contours = new cv.MatVector(), hier = new cv.Mat();
  try {
    cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
    cv.inRange(hsv, lo, hi, mask);
    cv.morphologyEx(mask, mask, cv.MORPH_OPEN, open);
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, close);
    cv.findContours(mask, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    let best: any = null, bestScore = 0;
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const area = cv.contourArea(c);
      if (area < frame.w * frame.h * 0.06) { c.delete(); continue; }
      const r = cv.minAreaRect(c);
      const rectArea = r.size.width * r.size.height;
      const score = area * Math.pow(rectArea ? area / rectArea : 0, 4); // big and close to a rectangle
      if (score > bestScore) { best?.delete(); best = c; bestScore = score; } else c.delete();
    }
    if (!best) return null;
    const approx = new cv.Mat();
    cv.approxPolyDP(best, approx, 0.02 * cv.arcLength(best, true), true);
    let pts: Point[];
    if (approx.rows === 4) pts = Array.from({ length: 4 }, (_, i) => ({ x: approx.intPtr(i, 0)[0], y: approx.intPtr(i, 0)[1] }));
    else pts = cv.RotatedRect.points(cv.minAreaRect(best)).map((q: Point) => ({ x: q.x, y: q.y }));
    approx.delete(); best.delete();
    return orderCorners(pts);
  } finally {
    rgb.delete(); hsv.delete(); mask.delete(); lo.delete(); hi.delete(); open.delete(); close.delete(); contours.delete(); hier.delete();
  }
}

function median(a: number[]) {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

type Rect = { x: number; y: number; w: number; h: number };

// Finds the printed checkboxes. They are the one set of equal squares standing on a straight line down the sheet,
// as many as the race has candidates; letters and digits also look like squares, but they are not equal, evenly spaced and empty.
function findBoxes(cv: any, wg: any, expected: number): { boxes: Rect[]; candidates: Rect[] } {
  const bin = new cv.Mat(), h = new cv.Mat(), v = new cv.Mat(), lines = new cv.Mat(), contours = new cv.MatVector(), hier = new cv.Mat(), contours2 = new cv.MatVector(), hier2 = new cv.Mat();
  const kh = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(11, 1)), kv = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, 11));
  const kc = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(11, 11)), kd = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  const cand: Rect[] = [];
  // Wide limits: a tick that runs past the edge of its box makes the outline taller than it is wide.
  const squarish = (w: number, hh: number) => w >= 22 && w <= 140 && hh >= 22 && hh <= 180 && w / hh >= 0.5 && w / hh <= 1.5;
  try {
    cv.adaptiveThreshold(wg, bin, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 31, 12);

    // Source 1: long straight edges, joined across rounded corners. Pen marks and letters are not long straight lines.
    cv.morphologyEx(bin, h, cv.MORPH_OPEN, kh);
    cv.morphologyEx(bin, v, cv.MORPH_OPEN, kv);
    cv.bitwise_or(h, v, lines);
    cv.morphologyEx(lines, lines, cv.MORPH_CLOSE, kc);
    cv.dilate(lines, lines, kd);
    cv.findContours(lines, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i); const r = cv.boundingRect(c); c.delete();
      if (squarish(r.width, r.height)) cand.push({ x: r.x, y: r.y, w: r.width, h: r.height });
    }

    // Source 2: an outline that encloses a large empty hole, a hollow square.
    cv.findContours(bin, contours2, hier2, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
    const hd = hier2.data32S as Int32Array;
    for (let i = 0; i < contours2.size(); i++) {
      if (hd[i * 4 + 3] !== -1) continue;
      const c = contours2.get(i); const r = cv.boundingRect(c); c.delete();
      if (!squarish(r.width, r.height)) continue;
      let best = 0;
      for (let ch = hd[i * 4 + 2]; ch !== -1; ch = hd[ch * 4]) { const cc = contours2.get(ch); best = Math.max(best, cv.contourArea(cc)); cc.delete(); }
      if (best / (r.width * r.height) >= 0.45) cand.push({ x: r.x, y: r.y, w: r.width, h: r.height });
    }
  } finally {
    bin.delete(); h.delete(); v.delete(); lines.delete(); contours.delete(); hier.delete(); contours2.delete(); hier2.delete(); kh.delete(); kv.delete(); kc.delete(); kd.delete();
  }
  if (cand.length === 0) return { boxes: [], candidates: [] };

  const cx = (b: Rect) => b.x + b.w / 2, cy = (b: Rect) => b.y + b.h / 2;
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const paper = median(Array.from(wg.data as Uint8Array).filter((_, i) => i % 53 === 0));
  // How much of a square's outline is inked on all four sides. Marks inside the box do not change this; letters score low.
  const px = wg.data as Uint8Array, cols = wg.cols as number, rows = wg.rows as number, outlineDark = paper * 0.8;
  const dark = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && px[y * cols + x] < outlineDark;
  const edge = (b: Rect) => {
    const t = 2;
    const along = (len: number, hit: (i: number) => boolean) => { let n = 0; for (let i = 3; i < len - 3; i++) if (hit(i)) n++; return n / Math.max(1, len - 6); };
    const band = (fixed: number, i: number, horizontal: boolean) => { for (let d = -t; d <= t; d++) if (horizontal ? dark(b.x + i, fixed + d) : dark(fixed + d, b.y + i)) return true; return false; };
    return Math.min(
      along(b.w, (i) => band(b.y, i, true)), along(b.w, (i) => band(b.y + b.h - 1, i, true)),
      along(b.h, (i) => band(b.x, i, false)), along(b.h, (i) => band(b.x + b.w - 1, i, false)),
    );
  };

  // Every straight line through two similar candidates, and the candidates lying on it.
  const seen = new Set<string>(); const groups: Rect[][] = [];
  for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) {
    const a = cand[i], b = cand[j];
    const dy = cy(b) - cy(a);
    if (Math.abs(dy) < 40) continue;
    const slope = (cx(b) - cx(a)) / dy;
    if (Math.abs(slope) > 0.35) continue;
    const ref = (a.w + b.w) / 2;
    if (Math.abs(a.w - b.w) > 0.45 * ref) continue;
    const g = cand.filter((q) => Math.abs(cx(q) - (cx(a) + slope * (cy(q) - cy(a)))) < 9 + 0.15 * ref && Math.abs(q.w - ref) <= 0.45 * ref);
    const key = g.map((q) => `${q.x},${q.y}`).sort().join("|");
    if (g.length >= Math.min(expected, 2) && !seen.has(key)) { seen.add(key); groups.push(g); }
  }

  const dedupe = (g: Rect[]) => {
    const mw = median(g.map((q) => q.w)); const out: Rect[] = [];
    for (const b of [...g].sort((p, q) => Math.abs(p.w - mw) - Math.abs(q.w - mw))) if (out.every((o) => Math.abs(cy(b) - cy(o)) > 0.6 * b.h)) out.push(b);
    return out.sort((p, q) => cy(p) - cy(q));
  };
  // How wrong a run of boxes looks: uneven spacing, and outlines that are not closed on every side.
  const cost = (w: Rect[]) => {
    const gaps = w.slice(1).map((b, i) => cy(b) - cy(w[i]));
    let reg = 0;
    if (gaps.length) { const m = median(gaps); reg = gaps.reduce((s, g) => s + Math.abs(g - m), 0) / Math.max(1, m) / gaps.length; }
    // Prefer larger squares when it is close: stray dots and letter fragments are small, printed checkboxes are not.
    return reg + 2 * (1 - mean(w.map(edge))) - 0.5 * Math.min(1, mean(w.map((b) => b.w)) / 60);
  };
  let best: Rect[] = [], bestKey: [number, number, number] = [-1, -1e9, -1e9];
  for (const g0 of groups) {
    const g = dedupe(g0);
    if (g.length < Math.min(expected, 3)) continue;
    let w = g;
    if (g.length > expected) {
      let bc = 1e9;
      for (let i = 0; i + expected <= g.length; i++) { const c = cost(g.slice(i, i + expected)); if (c < bc) { bc = c; w = g.slice(i, i + expected); } }
    }
    const key: [number, number, number] = [w.length === expected ? 1 : 0, -Math.abs(w.length - expected), -cost(w)];
    const better = key[0] !== bestKey[0] ? key[0] > bestKey[0] : key[1] !== bestKey[1] ? key[1] > bestKey[1] : key[2] > bestKey[2];
    if (better) { best = w; bestKey = key; }
  }
  return { boxes: best, candidates: cand };
}

export function scanFrame(cv: any, source: CanvasImageSource & { width?: number; height?: number }, srcW: number, srcH: number, opts: ScanOptions, expected: number): ScanResult {
  const t0 = performance.now();
  const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
  const fw = Math.round(srcW * scale), fh = Math.round(srcH * scale);
  const work = document.createElement("canvas");
  work.width = fw; work.height = fh;
  work.getContext("2d")!.drawImage(source, 0, 0, fw, fh);

  const rgba = cv.imread(work), gray = new cv.Mat(), warpedRgba = new cv.Mat(), wg = new cv.Mat();
  let M: any = null, srcTri: any = null, dstTri: any = null;
  const empty = (quad: Point[] | null): ScanResult => ({ found: false, quad: quad && quad.map((p) => ({ x: p.x / scale, y: p.y / scale })), frameSize: { w: srcW, h: srcH }, warped: null, boxes: [], ms: performance.now() - t0 });
  try {
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);

    let quad: Point[] | null;
    if (opts.findBallot) quad = findQuad(cv, rgba, { w: fw, h: fh });
    else quad = [{ x: 0, y: 0 }, { x: fw - 1, y: 0 }, { x: fw - 1, y: fh - 1 }, { x: 0, y: fh - 1 }];
    if (!quad) return empty(null);

    // Make the long side vertical.
    const wide = (dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2, tall = (dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / 2;
    const ordered = wide > tall ? [quad[1], quad[2], quad[3], quad[0]] : quad;
    srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, ordered.flatMap((p) => [p.x, p.y]));
    dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, W, 0, W, H, 0, H]);
    M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(rgba, warpedRgba, M, new cv.Size(W, H), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
    cv.cvtColor(warpedRgba, wg, cv.COLOR_RGBA2GRAY);

    // The ballot's dark header tab is at the top; if the bottom is darker the sheet is upside down.
    const band = (y0: number) => { const r = wg.roi(new cv.Rect(0, y0, W, Math.round(H * 0.05))); const m = cv.mean(r)[0]; r.delete(); return m; };
    if (band(H - Math.round(H * 0.05)) < band(0) - 25) { cv.rotate(warpedRgba, warpedRgba, cv.ROTATE_180); cv.rotate(wg, wg, cv.ROTATE_180); }

    const { boxes: rects, candidates } = findBoxes(cv, wg, expected);

    // Paper brightness, so "dark" means darker than the paper and not darker than an absolute grey.
    const paper = median(Array.from(wg.data as Uint8Array).filter((_, i) => i % 53 === 0));
    const darkBelow = paper * 0.7;
    // Read the pixels straight from the straightened picture: a sub-matrix' own `data` is not contiguous.
    const px = wg.data as Uint8Array, cols = wg.cols as number;
    const boxes: ScanBox[] = rects.map((r, i) => {
      const m = Math.max(3, Math.round(Math.min(r.w, r.h) * 0.3));
      let dark = 0, total = 0;
      for (let y = r.y + m; y < r.y + r.h - m; y++) for (let x = r.x + m; x < r.x + r.w - m; x++) { total++; if (px[y * cols + x] < darkBelow) dark++; }
      const score = dark / Math.max(1, total);
      const state: BoxState = score >= opts.markedAt ? "marked" : score >= opts.uncertainAt ? "uncertain" : "empty";
      return { n: i + 1, x: r.x, y: r.y, w: r.w, h: r.h, score, state };
    });

    const out = document.createElement("canvas");
    cv.imshow(out, warpedRgba);
    const g = out.getContext("2d")!;
    g.lineWidth = 3; g.font = "bold 20px sans-serif"; g.textBaseline = "middle";
    const color: Record<BoxState, string> = { marked: "#16a34a", uncertain: "#f59e0b", empty: "#94a3b8" };
    if (opts.debug) { g.lineWidth = 1; g.strokeStyle = "#ef4444"; for (const c of candidates) g.strokeRect(c.x, c.y, c.w, c.h); g.lineWidth = 3; }
    for (const b of boxes) {
      g.strokeStyle = color[b.state]; g.fillStyle = color[b.state];
      g.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      g.fillText(String(b.n), Math.max(2, b.x - 34), b.y + b.h / 2);
    }

    return { found: true, quad: quad.map((p) => ({ x: p.x / scale, y: p.y / scale })), frameSize: { w: srcW, h: srcH }, warped: out, boxes, ms: performance.now() - t0 };
  } finally {
    rgba.delete(); gray.delete(); warpedRgba.delete(); wg.delete(); M?.delete(); srcTri?.delete(); dstTri?.delete();
  }
}

export type Decision =
  | { kind: "valid"; marks: number[] }
  | { kind: "invalid"; marks: number[]; why: string }
  | { kind: "blank" }
  | { kind: "review"; why: string }
  | { kind: "rescan"; why: string };

// What the scanner would record for this ballot, in the same terms as the counting screen.
export function decide(boxes: ScanBox[], expected: number, maxChoices: number): Decision {
  if (boxes.length !== expected) return { kind: "rescan", why: `Found ${boxes.length} boxes, expected ${expected}. Hold the ballot flat and fully in view.` };
  const uncertain = boxes.filter((b) => b.state === "uncertain");
  if (uncertain.length) return { kind: "review", why: `Box ${uncertain.map((b) => b.n).join(", ")} is faint or smudged. A person should look.` };
  const marks = boxes.filter((b) => b.state === "marked").map((b) => b.n);
  if (marks.length === 0) return { kind: "blank" };
  if (marks.length > maxChoices) return { kind: "invalid", marks, why: `${marks.length} marks, at most ${maxChoices} allowed` };
  return { kind: "valid", marks };
}
