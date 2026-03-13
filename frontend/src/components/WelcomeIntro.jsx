import { useEffect, useState, useRef } from "react";

/* ─── Inline styles (no external CSS needed beyond customer-auth.css vars) ─── */
const S = {
  root: {
    position: 'fixed', inset: 0,
    background: 'linear-gradient(135deg, #f9f5ef 0%, #f0e9dc 50%, #e8e0d0 100%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, overflow: 'hidden', fontFamily: "'Jost', sans-serif",
  },
};

/* ─── SVG Book Component ─── */
function AnimatedBook({ phase }) {
  // phase: 0=closed, 1=opening, 2=open, 3=glowing
  const isOpening = phase >= 1;
  const isOpen    = phase >= 2;

  return (
    <div style={{
      position: 'relative',
      width: 220, height: 180,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="220" height="180" viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Glow beneath */}
        {isOpen && (
          <ellipse cx="110" cy="165" rx="70" ry="10"
            fill="rgba(192,113,79,0.18)"
            style={{ filter: 'blur(6px)', animation: 'bookGlow 2s ease-in-out infinite alternate' }}
          />
        )}

        {/* Drop shadow */}
        <ellipse cx="110" cy="162" rx="55" ry="7" fill="rgba(61,44,30,0.12)" style={{ filter: 'blur(4px)' }} />

        {/* ── Back cover (always visible) ── */}
        <rect x="60" y="50" width="100" height="120" rx="4"
          fill="#6b4f38" stroke="#3d2c1e" strokeWidth="1.5" />

        {/* Back pages */}
        <rect x="62" y="52" width="96" height="116" rx="2" fill="#f0e9dc" />
        <rect x="64" y="54" width="92" height="112" rx="2" fill="#f9f5ef" />

        {/* Spine */}
        <rect x="58" y="50" width="12" height="120" rx="3"
          fill="linear-gradient(180deg,#4d7260,#3d2c1e)"
          style={{ fill: '#4d7260' }} />
        <rect x="60" y="50" width="8" height="120" rx="2" fill="#3d5c4a" />
        {/* Spine lines */}
        <line x1="62" y1="70"  x2="66" y2="70"  stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <line x1="62" y1="110" x2="66" y2="110" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <line x1="62" y1="150" x2="66" y2="150" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />

        {/* ── Right page (static, always behind) ── */}
        <rect x="70" y="54" width="86" height="112" rx="2" fill="#fdf8f2"
          stroke="rgba(61,44,30,0.08)" strokeWidth="0.5" />
        {/* Right page lines */}
        {[70, 80, 90, 100, 110, 120, 130].map((y, i) => (
          <line key={i} x1="80" y1={y} x2="148" y2={y}
            stroke="rgba(61,44,30,0.1)" strokeWidth="0.8" />
        ))}
        {/* Leaf doodle on right page */}
        {isOpen && (
          <g opacity="0.4" style={{ animation: 'fadeInPage 0.5s ease 0.4s both' }}>
            <path d="M108 85 C118 75 128 80 125 90 C122 100 108 98 108 85Z" fill="#7a9e87" />
            <line x1="108" y1="85" x2="116" y2="95" stroke="#4d7260" strokeWidth="0.8" />
          </g>
        )}

        {/* ── Front cover — ANIMATES OPEN ── */}
        <g style={{
          transformOrigin: '68px 110px',
          transform: isOpening ? 'perspective(400px) rotateY(-145deg)' : 'perspective(400px) rotateY(0deg)',
          transition: 'transform 1.1s cubic-bezier(0.42, 0, 0.22, 1.4)',
        }}>
          {/* Cover base */}
          <rect x="68" y="50" width="100" height="120" rx="4"
            fill="#4d7260" stroke="#3d2c1e" strokeWidth="1.5" />

          {/* Cover texture lines */}
          <rect x="70" y="52" width="96" height="116" rx="3"
            fill="url(#coverGrad)" stroke="none" />

          {/* Cover title area */}
          <rect x="78" y="66" width="80" height="50" rx="3"
            fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />

          {/* Cover: open book icon */}
          <path d="M98 83 Q110 79 122 83 L122 102 Q110 98 98 102 Z"
            fill="rgba(255,255,255,0.25)" />
          <line x1="110" y1="80" x2="110" y2="103" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />

          {/* Cover title text */}
          <text x="110" y="128" textAnchor="middle"
            fontFamily="'Cormorant Garamond', serif" fontSize="8" fontWeight="600"
            fill="rgba(255,255,255,0.7)" letterSpacing="1.5">STATIONERY</text>
          <text x="110" y="138" textAnchor="middle"
            fontFamily="'Cormorant Garamond', serif" fontSize="8" fontWeight="600"
            fill="rgba(255,255,255,0.7)" letterSpacing="1.5">WORLD</text>

          {/* Cover ornament */}
          <circle cx="110" cy="155" r="4" fill="rgba(192,113,79,0.6)" />
          <circle cx="110" cy="155" r="2" fill="rgba(255,255,255,0.4)" />

          {/* Inner page visible on cover back — shows as cover opens */}
          <rect x="68" y="50" width="100" height="120" rx="4" fill="#fdf8f2"
            style={{ transform: 'scaleX(-1)', transformOrigin: '118px 110px' }} />

          <defs>
            <linearGradient id="coverGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5c8870" />
              <stop offset="100%" stopColor="#3d5c4a" />
            </linearGradient>
          </defs>
        </g>

        {/* Golden glow effect from open pages */}
        {isOpen && (
          <ellipse cx="110" cy="100" rx="45" ry="55"
            fill="rgba(249,245,239,0.0)"
            style={{
              filter: 'blur(12px)',
              animation: 'pageGlow 1s ease 0.5s both',
            }}
          />
        )}
      </svg>

      {/* Sparkle particles on open */}
      {phase >= 3 && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {[
            { x: '20%', y: '10%', d: '0s', s: 0.6 },
            { x: '80%', y: '15%', d: '0.15s', s: 0.8 },
            { x: '10%', y: '50%', d: '0.3s', s: 0.5 },
            { x: '90%', y: '45%', d: '0.1s', s: 0.7 },
            { x: '50%', y: '5%',  d: '0.25s', s: 0.9 },
            { x: '30%', y: '90%', d: '0.4s', s: 0.6 },
            { x: '70%', y: '85%', d: '0.2s', s: 0.75 },
          ].map((p, i) => (
            <div key={i} style={{
              position: 'absolute', left: p.x, top: p.y,
              width: 6 * p.s, height: 6 * p.s,
              background: '#c0714f',
              borderRadius: '50%',
              animation: `sparkle 1.2s ${p.d} ease-in-out infinite`,
              transform: 'translate(-50%,-50%)',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Floating stationery items ─── */
const STATIONERY_ITEMS = [
  { emoji: '✏️',  label: 'Pencil',    startX: -120, startY: 60,   endX: -80,  endY: 20,   delay: 0,    rot: -30, dur: 1.0 },
  { emoji: '🖊️',  label: 'Pen',       startX:  120, startY: 40,   endX:  75,  endY: 10,   delay: 0.1,  rot:  25, dur: 0.9 },
  { emoji: '📐',  label: 'Set Square', startX: -130, startY: -20,  endX: -90,  endY: -50,  delay: 0.2,  rot: -15, dur: 1.1 },
  { emoji: '📏',  label: 'Ruler',     startX:  130, startY: -10,  endX:  85,  endY: -45,  delay: 0.15, rot:  10, dur: 1.0 },
  { emoji: '🔭',  label: 'Compass',   startX: -100, startY:  120, endX: -70,  endY:  80,  delay: 0.3,  rot: -20, dur: 0.95 },
  { emoji: '✂️',  label: 'Scissors',  startX:  110, startY:  120, endX:  72,  endY:  75,  delay: 0.25, rot:  15, dur: 1.05 },
  { emoji: '📌',  label: 'Pin',       startX: -50,  startY: -140, endX: -30,  endY: -95,  delay: 0.35, rot:   5, dur: 0.9  },
  { emoji: '📎',  label: 'Clip',      startX:  60,  startY: -140, endX:  35,  endY: -90,  delay: 0.4,  rot: -10, dur: 1.0  },
  { emoji: '🖍️',  label: 'Crayon',    startX: -150, startY:  50,  endX:-105,  endY:  30,  delay: 0.45, rot:  20, dur: 1.1  },
  { emoji: '📓',  label: 'Notebook',  startX:  160, startY:  80,  endX: 110,  endY:  60,  delay: 0.5,  rot: -12, dur: 0.95 },
  { emoji: '🗂️',  label: 'Folder',    startX: -20,  startY:  170, endX: -15,  endY: 110,  delay: 0.55, rot:   8, dur: 1.0  },
  { emoji: '🧮',  label: 'Abacus',   startX:  30,  startY:  170, endX:  20,  endY: 108,  delay: 0.6,  rot:  -5, dur: 1.05 },
  { emoji: '🔬',  label: 'Scope',    startX: -160, startY: -60,  endX:-112,  endY: -80,  delay: 0.65, rot:  18, dur: 0.9  },
  { emoji: '📚',  label: 'Books',    startX:  170, startY: -50,  endX: 115,  endY: -75,  delay: 0.7,  rot: -22, dur: 1.1  },
];

function FloatingItem({ item, visible }) {
  const [orbit, setOrbit] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let frame;
    let start = null;
    const animate = (ts) => {
      if (!start) start = ts;
      setOrbit((ts - start) / 1000);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  const floatY = visible ? Math.sin(orbit * 1.2 + item.delay * 5) * 6 : 0;
  const floatX = visible ? Math.cos(orbit * 0.8 + item.delay * 3) * 3 : 0;

  return (
    <div style={{
      position: 'absolute',
      left: '50%', top: '50%',
      fontSize: 28,
      lineHeight: 1,
      transform: visible
        ? `translate(calc(-50% + ${item.endX + floatX}px), calc(-50% + ${item.endY + floatY}px)) rotate(${item.rot}deg) scale(1)`
        : `translate(calc(-50% + ${item.startX}px), calc(-50% + ${item.startY}px)) rotate(${item.rot * 2}deg) scale(0.2)`,
      opacity: visible ? 1 : 0,
      transition: `transform ${item.dur}s cubic-bezier(0.34,1.56,0.64,1) ${item.delay}s, opacity 0.4s ease ${item.delay}s`,
      filter: 'drop-shadow(0 2px 6px rgba(61,44,30,0.2))',
      zIndex: 2,
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      {item.emoji}
    </div>
  );
}

/* ─── Orbit ring decorations ─── */
function OrbitRings({ visible }) {
  return (
    <>
      {[160, 220, 290].map((r, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          width: r * 2, height: r * 2,
          borderRadius: '50%',
          border: `1px dashed rgba(122,158,135,${0.15 - i * 0.04})`,
          transform: 'translate(-50%, -50%)',
          opacity: visible ? 1 : 0,
          transition: `opacity 0.8s ease ${0.4 + i * 0.15}s, transform 1s ease`,
          animation: visible ? `orbitSpin ${20 + i * 8}s linear infinite ${i % 2 === 0 ? '' : 'reverse'}` : 'none',
        }} />
      ))}
    </>
  );
}

/* ─── Main WelcomeIntro ─── */
export default function WelcomeIntro() {
  const [phase, setPhase] = useState(0);
  // 0 = initial
  // 1 = book appears
  // 2 = book opening
  // 3 = book open + sparkles
  // 4 = stationery flies in
  // 5 = title reveals
  // 6 = subtitle + tagline
  // 7 = fade out

  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 150),
      setTimeout(() => setPhase(2), 700),
      setTimeout(() => setPhase(3), 1600),
      setTimeout(() => setPhase(4), 2000),
      setTimeout(() => setPhase(5), 2600),
      setTimeout(() => setPhase(6), 3200),
      setTimeout(() => setPhase(7), 4200),
      setTimeout(() => document.dispatchEvent(new CustomEvent('welcomeDone')), 4900),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  const fadeOut = phase >= 7;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Jost:wght@300;400;500;600&display=swap');

        @keyframes orbitSpin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
          50%       { opacity: 1; transform: translate(-50%,-50%) scale(1.2); }
        }
        @keyframes titleLetter {
          from { opacity: 0; transform: translateY(30px) scale(0.8); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes subtitleIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ruleGrow {
          from { width: 0; opacity: 0; }
          to   { width: 260px; opacity: 1; }
        }
        @keyframes bookEntrance {
          from { opacity: 0; transform: translateY(30px) scale(0.7); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pageGlow {
          from { opacity: 0; }
          to   { opacity: 1; fill: rgba(249,245,239,0.15); }
        }
        @keyframes bookGlow {
          from { rx: 70; opacity: 0.18; }
          to   { rx: 85; opacity: 0.35; }
        }
        @keyframes pulseRing {
          0%   { transform: translate(-50%,-50%) scale(1); opacity: 0.5; }
          100% { transform: translate(-50%,-50%) scale(1.08); opacity: 0.15; }
        }
        @keyframes particleDrift {
          0%   { transform: translateY(0) rotate(0deg); opacity: 0.8; }
          100% { transform: translateY(-120px) rotate(360deg); opacity: 0; }
        }
        @keyframes dotGridFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .wi-title-word {
          display: inline-block;
          white-space: pre;
        }
        .wi-title-letter {
          display: inline-block;
          animation: titleLetter 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
      `}</style>

      <div style={{
        ...S.root,
        opacity: fadeOut ? 0 : 1,
        transform: fadeOut ? 'scale(1.04)' : 'scale(1)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}>

        {/* ── Dot grid background ── */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(61,44,30,0.07) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          opacity: phase >= 1 ? 1 : 0,
          transition: 'opacity 1s ease',
          animation: phase >= 1 ? 'dotGridFade 1s ease' : 'none',
          pointerEvents: 'none',
        }} />

        {/* ── Radial ambient blobs ── */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', width: 500, height: 500, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(122,158,135,0.2) 0%, transparent 70%)',
            top: -150, right: -100,
            opacity: phase >= 2 ? 1 : 0, transition: 'opacity 1.5s ease',
          }} />
          <div style={{
            position: 'absolute', width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(192,113,79,0.15) 0%, transparent 70%)',
            bottom: -100, left: -80,
            opacity: phase >= 2 ? 1 : 0, transition: 'opacity 1.5s ease 0.3s',
          }} />
        </div>

        {/* ── Orbit rings ── */}
        <OrbitRings visible={phase >= 4} />

        {/* ── Floating stationery ── */}
        {STATIONERY_ITEMS.map((item, i) => (
          <FloatingItem key={i} item={item} visible={phase >= 4} />
        ))}

        {/* ── Floating paper particles ── */}
        {phase >= 3 && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${20 + (i * 53) % 60}%`,
                top: `${60 + (i * 37) % 30}%`,
                width: 6 + (i % 4) * 2,
                height: 6 + (i % 4) * 2,
                background: i % 3 === 0 ? '#c4d8cb' : i % 3 === 1 ? '#e8c4b3' : '#f0e9dc',
                borderRadius: 2,
                opacity: 0,
                animation: `particleDrift ${1.5 + (i % 4) * 0.4}s ${i * 0.18}s ease-out infinite`,
                transform: `rotate(${i * 30}deg)`,
              }} />
            ))}
          </div>
        )}

        {/* ── CENTER CONTENT ── */}
        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 0,
        }}>

          {/* Book */}
          <div style={{
            opacity: phase >= 1 ? 1 : 0,
            animation: phase >= 1 ? 'bookEntrance 0.6s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
            marginBottom: phase >= 5 ? 16 : 8,
            transition: 'margin-bottom 0.6s ease',
          }}>
            <AnimatedBook phase={phase >= 2 ? (phase >= 3 ? 3 : 2) : (phase >= 1 ? 1 : 0)} />
          </div>

          {/* Eyebrow tag */}
          <div style={{
            fontSize: 10, letterSpacing: '3px', fontWeight: 600,
            textTransform: 'uppercase', color: '#c0714f',
            background: 'rgba(192,113,79,0.08)', border: '1px solid rgba(192,113,79,0.22)',
            padding: '4px 14px', borderRadius: 20,
            marginBottom: 12,
            opacity: phase >= 5 ? 1 : 0,
            transform: phase >= 5 ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
          }}>
            ✦ EST. IN YOUR CITY ✦
          </div>

          {/* Main title */}
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(36px, 8vw, 72px)',
            fontWeight: 700, color: '#3d2c1e',
            margin: 0, lineHeight: 1.0,
            letterSpacing: '-0.5px',
            textAlign: 'center',
          }}>
            {'STATIONERY'.split('').map((ch, i) => (
              <span key={i} className="wi-title-letter" style={{
                animationDelay: `${i * 0.045}s`,
                animationPlayState: phase >= 5 ? 'running' : 'paused',
                opacity: phase >= 5 ? undefined : 0,
              }}>{ch}</span>
            ))}
            <br />
            {'WORLD'.split('').map((ch, i) => (
              <span key={i} className="wi-title-letter" style={{
                animationDelay: `${0.45 + i * 0.055}s`,
                animationPlayState: phase >= 5 ? 'running' : 'paused',
                opacity: phase >= 5 ? undefined : 0,
                color: '#4d7260',
              }}>{ch}</span>
            ))}
          </h1>

          {/* Decorative rule */}
          <div style={{
            height: 2, borderRadius: 1, margin: '14px auto',
            background: 'linear-gradient(90deg, transparent, #e8c4b3, #c4d8cb, #e8c4b3, transparent)',
            animation: phase >= 6 ? 'ruleGrow 0.7s 0.1s ease both' : 'none',
            width: phase >= 6 ? 260 : 0,
            opacity: phase >= 6 ? 1 : 0,
            transition: phase >= 6 ? 'none' : 'opacity 0.1s',
          }} />

          {/* Subtitle */}
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
            fontSize: 'clamp(14px, 2.5vw, 20px)',
            color: '#4d7260',
            margin: 0,
            letterSpacing: '0.3px',
            opacity: phase >= 6 ? 1 : 0,
            transform: phase >= 6 ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 0.6s ease 0.25s, transform 0.6s ease 0.25s',
          }}>
            Your favourite stationery, delivered.
          </p>

          {/* Small category pills */}
          {phase >= 6 && (
            <div style={{
              display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center',
              animation: 'subtitleIn 0.5s 0.5s ease both',
            }}>
              {['📝 Notebooks', '🖊️ Pens', '📐 Geometry', '🎨 Art Supplies'].map((tag, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20,
                  background: i % 2 === 0 ? 'rgba(122,158,135,0.12)' : 'rgba(192,113,79,0.1)',
                  border: `1px solid ${i % 2 === 0 ? 'rgba(122,158,135,0.25)' : 'rgba(192,113,79,0.2)'}`,
                  color: i % 2 === 0 ? '#4d7260' : '#c0714f',
                  fontWeight: 500, letterSpacing: '0.3px',
                  animation: `subtitleIn 0.4s ${0.55 + i * 0.08}s ease both`,
                  opacity: 0,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Corner botanical sprigs ── */}
        {phase >= 4 && (
          <>
            {[
              { pos: { top: 24, left: 24 }, emoji: '🌿', delay: '0s', rot: 0 },
              { pos: { top: 24, right: 24 }, emoji: '🍃', delay: '0.1s', rot: 15 },
              { pos: { bottom: 24, left: 24 }, emoji: '🌱', delay: '0.2s', rot: -10 },
              { pos: { bottom: 24, right: 24 }, emoji: '🍃', delay: '0.3s', rot: 20 },
            ].map((s, i) => (
              <div key={i} style={{
                position: 'absolute', ...s.pos,
                fontSize: 40, opacity: 0,
                animation: `bookEntrance 0.6s cubic-bezier(0.34,1.56,0.64,1) ${s.delay} forwards`,
                transform: `rotate(${s.rot}deg)`,
                filter: 'drop-shadow(0 2px 4px rgba(61,44,30,0.15))',
              }}>
                {s.emoji}
              </div>
            ))}
          </>
        )}

        {/* ── Loading bar at bottom ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 3,
          background: 'linear-gradient(90deg, #4d7260, #7a9e87, #c0714f, #e8c4b3)',
          backgroundSize: '200% 100%',
          opacity: phase >= 1 && phase < 7 ? 1 : 0,
          transition: 'opacity 0.3s',
          animation: 'ruleGrow 4s linear',
        }} />

      </div>
    </>
  );
}