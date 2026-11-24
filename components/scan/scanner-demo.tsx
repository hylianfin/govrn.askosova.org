"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, ImageUp, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_OPTIONS, decide, loadOpenCv, scanFrame, type Decision, type ScanOptions, type ScanResult } from "@/lib/scan/detect";

const PRESETS = [
  { label: "High School Government", count: 2, max: 1 },
  { label: "High School Senator", count: 19, max: 3 },
  { label: "Middle School Government", count: 7, max: 1 },
  { label: "Middle School Senator", count: 17, max: 3 },
];

type Logged = { id: number; at: string; decision: Decision };

function DecisionView({ d }: { d: Decision }) {
  if (d.kind === "valid") return <div><Badge variant="success">Valid ballot</Badge><p className="mt-2 text-sm">Would record marks <b className="tabular-nums">{d.marks.join(", ")}</b></p></div>;
  if (d.kind === "blank") return <div><Badge variant="secondary">Blank ballot</Badge><p className="mt-2 text-sm text-muted-foreground">No box is marked.</p></div>;
  if (d.kind === "invalid") return <div><Badge variant="danger">Invalid ballot</Badge><p className="mt-2 text-sm text-muted-foreground">{d.why}. Marks: {d.marks.join(", ")}.</p></div>;
  if (d.kind === "review") return <div><Badge variant="warning">Needs a person</Badge><p className="mt-2 text-sm text-muted-foreground">{d.why}</p></div>;
  return <div><Badge variant="danger">Rescan</Badge><p className="mt-2 text-sm text-muted-foreground">{d.why}</p></div>;
}

const sig = (d: Decision) => (d.kind === "valid" || d.kind === "invalid" ? `${d.kind}:${d.marks.join(",")}` : d.kind);

export function ScannerDemo() {
  const [holder, setCv] = useState<{ cv: any } | null>(null);
  const cv = holder?.cv ?? null;
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState(0);
  const [count, setCount] = useState(PRESETS[0].count);
  const [maxChoices, setMaxChoices] = useState(PRESETS[0].max);
  const [opts, setOpts] = useState<ScanOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [stable, setStable] = useState<string>("");
  const [log, setLog] = useState<Logged[]>([]);

  const warpedHost = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const live = useRef({ recent: [] as string[], locked: false, absent: 0, id: 0 });
  const params = useRef({ count, maxChoices, opts });
  params.current = { count, maxChoices, opts };

  useEffect(() => { loadOpenCv().then((h) => setCv(h)).catch((e) => setError(e.message)); }, []);

  const show = useCallback((r: ScanResult) => {
    setResult(r);
    if (process.env.NODE_ENV !== "production") (window as unknown as { __lastScan?: ScanResult }).__lastScan = r;
    const host = warpedHost.current;
    if (host) { host.replaceChildren(); if (r.warped) { r.warped.className = "h-auto w-full rounded-lg border border-border"; host.appendChild(r.warped); } }
  }, []);

  // One photo: analyse it right away.
  const analyseImage = useCallback((img: HTMLImageElement) => {
    if (!cv) return;
    try { show(scanFrame(cv, img, img.naturalWidth, img.naturalHeight, params.current.opts, params.current.count)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not read this image."); }
  }, [cv, show]);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    stopCamera();
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { setImageUrl(url); analyseImage(img); };
    img.src = url;
  };

  // Re-run on the same photo when thresholds or the ballot-finding switch change.
  useEffect(() => {
    if (!imageUrl || camera) return;
    const img = new Image();
    img.onload = () => analyseImage(img);
    img.src = imageUrl;
  }, [opts, count, imageUrl, camera, analyseImage]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera(false);
  }
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      setImageUrl(null);
      setCamera(true);
      live.current = { recent: [], locked: false, absent: 0, id: live.current.id };
      setError(null);
      requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } });
    } catch {
      setError("The camera is not available. Allow camera access in the browser, or upload a photo instead.");
    }
  }

  // Live mode: read a frame twice a second; record a ballot once three reads in a row agree, then wait for it to leave the frame.
  useEffect(() => {
    if (!camera || !cv) return;
    const timer = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.videoWidth === 0) return;
      let r: ScanResult;
      try { r = scanFrame(cv, v, v.videoWidth, v.videoHeight, params.current.opts, params.current.count); } catch { return; }
      const o = overlayRef.current;
      if (o) {
        o.width = v.videoWidth; o.height = v.videoHeight;
        const g = o.getContext("2d")!;
        g.clearRect(0, 0, o.width, o.height);
        if (r.quad) { g.strokeStyle = "#2563eb"; g.lineWidth = 6; g.beginPath(); r.quad.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.stroke(); }
      }
      const L = live.current;
      const complete = r.found && r.boxes.length === params.current.count;
      if (!complete) {
        L.recent = [];
        if (!r.found) { L.absent++; if (L.absent >= 3) { L.locked = false; setStable(""); } }
        if (r.found) show(r);
        return;
      }
      L.absent = 0;
      show(r);
      if (L.locked) return;
      const d = decide(r.boxes, params.current.count, params.current.maxChoices);
      L.recent = [...L.recent, sig(d)].slice(-3);
      if (L.recent.length === 3 && L.recent.every((x) => x === L.recent[0]) && d.kind !== "rescan" && d.kind !== "review") {
        L.locked = true;
        L.id += 1;
        setStable(sig(d));
        setLog((l) => [{ id: L.id, at: new Date().toLocaleTimeString("en-GB"), decision: d }, ...l].slice(0, 12));
        try { const a = new AudioContext(); const osc = a.createOscillator(); osc.frequency.value = 880; osc.connect(a.destination); osc.start(); osc.stop(a.currentTime + 0.12); } catch { /* no sound */ }
      }
    }, 500);
    return () => clearInterval(timer);
  }, [camera, cv, show]);

  const decision = result?.found ? decide(result.boxes, count, maxChoices) : null;
  const choose = (i: number) => { setPreset(i); setCount(PRESETS[i].count); setMaxChoices(PRESETS[i].max); };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Which ballot is this?</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p, i) => (
                <button key={p.label} onClick={() => choose(i)} className={cn("rounded-md border px-3 py-1.5 text-sm", preset === i ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>{p.label}</button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <label className="flex items-center gap-2">Boxes on ballot <input type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} className="h-8 w-16 rounded-md border border-input bg-background px-2 text-foreground" /></label>
              <label className="flex items-center gap-2">Max marks <input type="number" min={1} max={3} value={maxChoices} onChange={(e) => setMaxChoices(Math.max(1, Number(e.target.value) || 1))} className="h-8 w-16 rounded-md border border-input bg-background px-2 text-foreground" /></label>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-medium">Sensitivity</p>
            <label className="flex items-center gap-3 text-muted-foreground">Marked from <input type="range" min={0.05} max={0.5} step={0.01} value={opts.markedAt} onChange={(e) => setOpts({ ...opts, markedAt: Number(e.target.value) })} /> <span className="w-10 tabular-nums text-foreground">{Math.round(opts.markedAt * 100)}%</span></label>
            <label className="flex items-center gap-3 text-muted-foreground">Faint from <input type="range" min={0.01} max={0.3} step={0.01} value={opts.uncertainAt} onChange={(e) => setOpts({ ...opts, uncertainAt: Math.min(Number(e.target.value), opts.markedAt) })} /> <span className="w-10 tabular-nums text-foreground">{Math.round(opts.uncertainAt * 100)}%</span></label>
            <label className="flex items-center gap-2 text-muted-foreground"><input type="checkbox" checked={!!opts.debug} onChange={(e) => setOpts({ ...opts, debug: e.target.checked })} /> Show everything it considered (red outlines)</label>
            <label className="flex items-center gap-2 text-muted-foreground"><input type="checkbox" checked={opts.findBallot} onChange={(e) => setOpts({ ...opts, findBallot: e.target.checked })} /> Find the ballot in the picture (untick if the photo is already cropped to the sheet)</label>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className={cn("inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted", !cv && "pointer-events-none opacity-50")}>
            <ImageUp className="h-4 w-4" /> Upload or take a photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {camera ? <Button variant="outline" onClick={stopCamera}><CameraOff className="h-4 w-4" /> Stop camera</Button> : <Button disabled={!cv} onClick={startCamera}><Camera className="h-4 w-4" /> Start camera</Button>}
          {!cv && !error && <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading the image library (one time, about 10 MB)…</span>}
          {error && <span className="text-sm text-danger">{error}</span>}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">What the camera sees</h2>
          {camera ? (
            <div className="relative overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} playsInline muted className="block w-full" />
              <canvas ref={overlayRef} className="absolute inset-0 h-full w-full" />
              {stable && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-success px-3 py-1 text-xs font-bold text-white"><CheckCircle2 className="h-3.5 w-3.5" /> Read. Remove the ballot for the next one</span>}
            </div>
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Uploaded ballot" className="w-full rounded-lg border border-border" />
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">Upload a photo of a ballot, or start the camera and hold a ballot in front of it.</p>
          )}
          {result && <p className="mt-2 text-xs text-muted-foreground">{result.found ? `Ballot found · read in ${Math.round(result.ms)} ms` : "No ballot found. Put it on a darker surface with all four corners in view."}</p>}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Straightened ballot</h2>{result?.found && <span className="text-xs text-muted-foreground">{result.boxes.length} boxes found</span>}</div>
          <div ref={warpedHost} className="max-h-[70vh] overflow-auto" />
          {!result?.found && <p className="rounded-lg border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">The straightened ballot with its boxes appears here.</p>}
          <p className="mt-2 text-xs text-muted-foreground"><span className="text-[#16a34a]">Green</span> marked · <span className="text-[#f59e0b]">orange</span> faint · <span className="text-[#94a3b8]">grey</span> empty</p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">What it would record</h2>
          {decision ? <DecisionView d={decision} /> : <p className="text-sm text-muted-foreground">Nothing read yet.</p>}
          <p className="mt-4 text-xs text-muted-foreground">Test page only: nothing is recorded in the real count.</p>
          {result?.found && result.boxes.length > 0 && (
            <ul className="mt-4 max-h-64 divide-y divide-border overflow-auto rounded-lg border border-border text-sm">
              {result.boxes.map((b) => (
                <li key={b.n} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="w-6 text-right tabular-nums text-muted-foreground">{b.n}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full", b.state === "marked" ? "bg-success" : b.state === "uncertain" ? "bg-warning" : "bg-muted-foreground/40")} style={{ width: `${Math.min(100, b.score * 200)}%` }} /></span>
                  <span className="w-12 text-right tabular-nums">{Math.round(b.score * 100)}%</span>
                  <span className="w-16 text-xs capitalize text-muted-foreground">{b.state}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Live scan log</h2>
            {log.length > 0 && <Button size="sm" variant="ghost" onClick={() => setLog([])}><RotateCcw className="h-3.5 w-3.5" /> Clear</Button>}
          </div>
          {log.length === 0 ? <p className="text-sm text-muted-foreground">With the camera on, each ballot that reads the same three times in a row is added here, once. Take the ballot away before showing the next one.</p> : (
            <ol className="space-y-2">
              {log.map((l) => (
                <li key={l.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="w-6 text-right font-semibold tabular-nums text-muted-foreground">#{l.id}</span>
                  <span className="flex-1">{l.decision.kind === "valid" ? <>Marks <b className="tabular-nums">{l.decision.marks.join(", ")}</b></> : l.decision.kind === "invalid" ? <>Invalid · {l.decision.why}</> : "Blank"}</span>
                  <time className="text-xs text-muted-foreground">{l.at}</time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
