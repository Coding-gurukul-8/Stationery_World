import { useEffect, useRef } from "react";
import "./WalkingBoyLoader.css";

/**
 * WalkingBoyLoader — pixel-art walking boy
 * Matches reference: dark beanie + devil horns + white cross,
 * messy brown hair, warm brown skin, dark grey hoodie,
 * dark navy jeans, dark sneakers.
 *
 * Props:
 *   label {string}  — text below animation (default "Loading...")
 *                     pass "" to hide
 */
export default function WalkingBoyLoader({ label = "Loading..." }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const S = 4; // each "pixel" = 4×4 real pixels (pixel-art scale)

    /* ── Colour palette — pixel-art exact ── */
    const K  = "#1a1612"; // black outline
    const SK = "#a0653a"; // skin mid
    const SL = "#c4844e"; // skin light
    const SN = "#2c2420"; // skin shadow
    const HB = "#3d2210"; // hair brown dark
    const HL = "#5c3418"; // hair brown light
    const BD = "#2e3038"; // beanie dark
    const BM = "#383c44"; // beanie mid
    const HR = "#c0392b"; // horn red
    const HRL= "#e74c3c"; // horn red light
    const WT = "#e8e0d0"; // white (+)
    const GD = "#484848"; // shirt dark
    const GM = "#5a5a5a"; // shirt mid
    const GL = "#6e6e6e"; // shirt light
    const JD = "#1e2535"; // jeans dark
    const JM = "#252e42"; // jeans mid
    const JL = "#2e3a52"; // jeans light
    const SD = "#111111"; // shoe dark
    const SM = "#1e1e1e"; // shoe mid

    const px = (col, x, y, w = 1, h = 1) => {
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(x * S, y * S, w * S, h * S);
    };

    const drawFrame = (phase) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const sin  = Math.sin(phase * Math.PI * 2);
      const sin2 = Math.sin(phase * Math.PI * 2 + Math.PI); // opposite
      const bounce = Math.abs(sin) * 3;

      /* Ground shadow */
      ctx.save();
      ctx.translate(40 * S / 4, 39 * S);
      const sc = 1 - Math.abs(sin) * 0.15;
      ctx.scale(sc, 1);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      /* Body bounce */
      ctx.save();
      ctx.translate(0, -bounce);

      /* ── Hair tufts peeking from sides ── */
      px(HB, 1, 10, 2, 3); px(HL, 2, 9, 2, 2); px(HB, 0, 12, 2, 2);
      px(HB,16, 10, 3, 3); px(HL,16, 9, 2, 2); px(HB,17, 12, 2, 2);

      /* ── Beanie ── */
      px(BD,  5, 2, 12, 2);
      px(BM,  4, 4, 14, 2);
      px(BD,  3, 6, 16, 2);
      px(BM,  3, 8, 16, 2);
      px(BD,  3,10, 16, 1);
      px(K,   3,11, 16, 1); // brim outline
      px(BD,  3,12, 16, 2); // brim

      /* Beanie shading crease */
      px(BM,  5, 7,  3, 1);
      px(BM, 14, 7,  3, 1);

      /* ── Horns ── */
      px(K,   6, 1, 1, 2); px(HR,  7, 1, 1, 2); px(HRL, 7, 0, 1, 1);
      px(K,  15, 1, 1, 2); px(HR, 14, 1, 1, 2); px(HRL,14, 0, 1, 1);

      /* ── Cross (+) on beanie ── */
      px(WT, 10, 5, 2, 1);
      px(WT, 11, 4, 1, 3);

      /* ── Face ── */
      px(K,   5,12, 12, 1); // top outline
      px(K,   4,13,  1, 7); px(K, 17, 13, 1, 7); // sides
      px(SK,  5,13, 12, 6);
      px(SL,  6,13, 10, 3); // highlight
      px(SN,  5,18, 12, 1); // chin shadow
      px(K,   5,19, 12, 1); // bottom outline

      /* Eyebrows */
      px(HB,  7, 14, 3, 1);
      px(HB, 12, 14, 3, 1);

      /* Eyes */
      px(K,   8, 15, 2, 2);
      px(K,  13, 15, 2, 2);
      px(WT,  9, 15, 1, 1); // shine L
      px(WT, 14, 15, 1, 1); // shine R

      /* Nose dot */
      px(SN, 11, 17, 1, 1);

      /* Mouth smile */
      px(K,   9, 18, 1, 1);
      px(SN, 10, 18, 3, 1);
      px(K,  13, 18, 1, 1);
      px(K,  10, 19, 1, 1); px(K, 12, 19, 1, 1);

      /* Cheeks */
      ctx.fillStyle = "rgba(200,120,80,0.35)";
      ctx.fillRect(6 * S, 17 * S, 2 * S, 1 * S);
      ctx.fillRect(14 * S, 17 * S, 2 * S, 1 * S);

      /* Neck */
      px(SK,  9, 19, 4, 2);
      px(SN,  9, 20, 4, 1);

      /* ── Shirt / hoodie ── */
      px(K,   3, 21, 1, 9); px(K, 18, 21, 1, 9);
      px(K,   4, 20, 14, 1); px(K, 4, 30, 14, 1);
      px(GM,  4, 21, 14, 9);
      px(GD,  4, 21,  1, 9); px(GD, 17, 21, 1, 9);
      px(GL,  6, 21, 10, 3);
      px(GD,  4, 29, 14, 1);
      /* collar */
      px(K,   8, 20, 6, 2);
      px(GD,  9, 20, 4, 2);
      /* kangaroo pocket */
      px(GD,  8, 26, 6, 3);
      px(K,   8, 26, 6, 1); px(K, 8, 29, 6, 1);
      px(K,   8, 26, 1, 3); px(K,13, 26, 1, 3);

      /* ── Left arm (swings back with left leg) ── */
      const lAOff = Math.round(sin * 2);
      px(GD,  1, 21, 3, 3);  // sleeve
      px(K,   0, 22 + lAOff, 1, 8);
      px(K,   4, 22 + lAOff, 1, 8);
      px(K,   1, 21 + lAOff, 3, 1);
      px(K,   1, 30 + lAOff, 3, 1);
      px(SN,  1, 22 + lAOff, 1, 8);
      px(SK,  2, 22 + lAOff, 2, 8);
      px(SL,  3, 22 + lAOff, 1, 7);

      /* ── Right arm (swings forward) ── */
      const rAOff = Math.round(sin2 * 2);
      px(GM, 18, 21, 3, 3);  // sleeve
      px(K,  17, 22 + rAOff, 1, 8);
      px(K,  21, 22 + rAOff, 1, 8);
      px(K,  18, 21 + rAOff, 3, 1);
      px(K,  18, 30 + rAOff, 3, 1);
      px(SN, 18, 22 + rAOff, 1, 8);
      px(SK, 19, 22 + rAOff, 2, 8);
      px(SL, 20, 22 + rAOff, 1, 7);

      /* ── Legs / jeans ── */
      px(JD, 10, 30, 2, 2); // crotch
      px(K,  10, 29, 2, 1);

      /* Left leg */
      const lLOff = Math.round(sin2 * 3);
      px(K,   4, 31 + lLOff, 1, 9); px(K, 10, 31 + lLOff, 1, 9);
      px(K,   5, 30, 5, 1);
      px(JD,  5, 31 + lLOff, 1, 8);
      px(JM,  6, 31 + lLOff, 4, 8);
      px(JL,  8, 31 + lLOff, 2, 8);
      /* shoe left */
      px(K,   3, 38 + lLOff, 1, 2); px(K, 10, 38 + lLOff, 2, 2);
      px(SM,  4, 38 + lLOff, 6, 1);
      px(SD,  3, 39 + lLOff, 8, 1);

      /* Right leg */
      const rLOff = Math.round(sin * 3);
      px(K,  11, 31 + rLOff, 1, 9); px(K, 17, 31 + rLOff, 1, 9);
      px(K,  12, 30, 5, 1);
      px(JD, 12, 31 + rLOff, 1, 8);
      px(JM, 13, 31 + rLOff, 4, 8);
      px(JL, 15, 31 + rLOff, 2, 8);
      /* shoe right */
      px(K,  10, 38 + rLOff, 1, 2); px(K, 17, 38 + rLOff, 2, 2);
      px(SM, 11, 38 + rLOff, 6, 1);
      px(SD, 10, 39 + rLOff, 8, 1);

      ctx.restore();
    };

    let rafId;
    let start = null;
    const CYCLE = 750; // ms per walk cycle

    const loop = (ts) => {
      if (!start) start = ts;
      const t = ((ts - start) % CYCLE) / CYCLE;
      drawFrame(t);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="walking-boy-loader" aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="boy-canvas"
        width={88}
        height={160}
      />
      {label && <span className="boy-label">{label}</span>}
    </div>
  );
}