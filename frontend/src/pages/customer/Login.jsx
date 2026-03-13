import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import WelcomeIntro from "../../components/WelcomeIntro";
import { apiService } from "../../services/api";
import { authUtils } from "../../utils/auth";
import "./customer-auth.css";

/* ─── Stationery orbit items — same cast as WelcomeIntro ─── */
const ORBIT_ITEMS = [
  /* TOP */
  { emoji: '✏️',  startX:   0, startY: -360, endX:  -90, endY: -200, rot: -25, size: 26, dur: 3.2, delay: 0.00, phase: 0.00 },
  { emoji: '📏',  startX:   0, startY: -360, endX:   25, endY: -210, rot:  10, size: 22, dur: 3.8, delay: 0.10, phase: 1.20 },
  { emoji: '📐',  startX:   0, startY: -360, endX:  135, endY: -185, rot:  20, size: 24, dur: 4.1, delay: 0.20, phase: 2.40 },
  /* RIGHT */
  { emoji: '🖊️',  startX:  420, startY:   0, endX:  225, endY: -105, rot:  30, size: 24, dur: 3.5, delay: 0.08, phase: 0.80 },
  { emoji: '📎',  startX:  420, startY:   0, endX:  235, endY:    0, rot: -10, size: 20, dur: 4.3, delay: 0.18, phase: 2.10 },
  { emoji: '📌',  startX:  420, startY:   0, endX:  220, endY:  115, rot:  15, size: 20, dur: 3.9, delay: 0.28, phase: 3.50 },
  /* BOTTOM */
  { emoji: '✂️',  startX:   0, startY:  360, endX:  125, endY:  195, rot: -18, size: 24, dur: 4.0, delay: 0.15, phase: 1.60 },
  { emoji: '🖍️',  startX:   0, startY:  360, endX:  -15, endY:  215, rot:   8, size: 22, dur: 3.6, delay: 0.25, phase: 2.90 },
  { emoji: '📓',  startX:   0, startY:  360, endX: -145, endY:  192, rot: -12, size: 26, dur: 4.2, delay: 0.35, phase: 0.40 },
  /* LEFT */
  { emoji: '📚',  startX: -420, startY:   0, endX: -228, endY:  105, rot:  22, size: 26, dur: 3.7, delay: 0.05, phase: 1.80 },
  { emoji: '🔬',  startX: -420, startY:   0, endX: -238, endY:   -5, rot: -15, size: 22, dur: 4.4, delay: 0.22, phase: 3.20 },
  { emoji: '🧮',  startX: -420, startY:   0, endX: -222, endY: -115, rot:  12, size: 22, dur: 3.3, delay: 0.38, phase: 0.60 },
  /* DIAGONAL CORNERS */
  { emoji: '🌿',  startX: -370, startY: -310, endX: -180, endY: -158, rot: -30, size: 24, dur: 3.8, delay: 0.45, phase: 2.70 },
  { emoji: '🍃',  startX:  370, startY: -310, endX:  175, endY: -152, rot:  25, size: 22, dur: 4.0, delay: 0.55, phase: 1.10 },
  { emoji: '🗂️',  startX:  370, startY:  310, endX:  170, endY:  162, rot: -20, size: 24, dur: 3.6, delay: 0.65, phase: 3.80 },
  { emoji: '📋',  startX: -370, startY:  310, endX: -175, endY:  158, rot:  18, size: 22, dur: 4.1, delay: 0.75, phase: 2.00 },
];

/* ── Single orbiting stationery item ── */
function OrbitItem({ item, visible }) {
  const [floatOffset, setFloatOffset] = useState({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const t = (ts - startRef.current) / 1000;
      setFloatOffset({
        x: Math.cos(t / (item.dur * 1.3) * Math.PI * 2 + item.phase) * 4.5,
        y: Math.sin(t / item.dur        * Math.PI * 2 + item.phase) * 7,
      });
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [visible, item]);

  const settled = visible;

  return (
    <div style={{
      position:  'absolute',
      left:      '50%',
      top:       '50%',
      fontSize:   item.size,
      lineHeight: 1,
      willChange: 'transform',
      transform:  settled
        ? `translate(calc(-50% + ${item.endX + floatOffset.x}px), calc(-50% + ${item.endY + floatOffset.y}px)) rotate(${item.rot}deg) scale(1)`
        : `translate(calc(-50% + ${item.startX}px), calc(-50% + ${item.startY}px)) rotate(${item.rot * 2}deg) scale(0.05)`,
      opacity:    settled ? 0.9 : 0,
      transition: `transform ${item.dur * 0.75}s cubic-bezier(0.34,1.56,0.64,1) ${item.delay}s,
                   opacity   0.45s ease ${item.delay}s`,
      filter:     'drop-shadow(0 3px 8px rgba(61,44,30,0.22))',
      pointerEvents: 'none',
      userSelect:    'none',
      zIndex:        0,
    }}>
      {item.emoji}
    </div>
  );
}

/* ── Dashed orbit rings (identical to WelcomeIntro) ── */
function OrbitRings({ visible }) {
  const rings = [
    { r: 172, spd: 22, color: 'rgba(122,158,135,0.18)', rev: false },
    { r: 235, spd: 31, color: 'rgba(192,113,79,0.12)',  rev: true  },
    { r: 298, spd: 42, color: 'rgba(122,158,135,0.09)', rev: false },
  ];
  return (
    <>
      {rings.map((ring, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '50%',
          width:  ring.r * 2, height: ring.r * 2,
          borderRadius: '50%',
          border: `1px dashed ${ring.color}`,
          transform: 'translate(-50%, -50%)',
          opacity:    visible ? 1 : 0,
          transition: `opacity 1.1s ease ${0.25 + i * 0.2}s`,
          animation:  visible
            ? `orbitRingSpin ${ring.spd}s linear infinite ${ring.rev ? 'reverse' : ''}`
            : 'none',
          pointerEvents: 'none',
        }} />
      ))}
    </>
  );
}

/* ── Floating paper confetti (same as WelcomeIntro) ── */
function Confetti({ visible }) {
  if (!visible) return null;
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:0 }}>
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left:  `${15 + (i * 53) % 70}%`,
          top:   `${55 + (i * 37) % 35}%`,
          width:  5 + (i % 4) * 2,
          height: 5 + (i % 4) * 2,
          background: i % 3 === 0 ? '#c4d8cb' : i % 3 === 1 ? '#e8c4b3' : '#f0e9dc',
          borderRadius: 2,
          opacity: 0,
          animation: `loginParticleDrift ${1.6 + (i % 4) * 0.45}s ${i * 0.18}s ease-out infinite`,
          transform: `rotate(${i * 30}deg)`,
        }} />
      ))}
    </div>
  );
}

/* ── Sparkle dots scattered between orbit rings ── */
function Sparkles({ visible }) {
  if (!visible) return null;
  const pts = [
    { x:'32%', y:'16%', d:'0s',    s:5 },
    { x:'68%', y:'14%', d:'0.22s', s:6 },
    { x:'88%', y:'48%', d:'0.44s', s:5 },
    { x:'78%', y:'84%', d:'0.33s', s:6 },
    { x:'22%', y:'82%', d:'0.11s', s:5 },
    { x:'10%', y:'46%', d:'0.55s', s:4 },
    { x:'50%', y:'8%',  d:'0.38s', s:6 },
    { x:'50%', y:'92%', d:'0.16s', s:5 },
  ];
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0 }}>
      {pts.map((p, i) => (
        <div key={i} style={{
          position:'absolute', left:p.x, top:p.y,
          width:p.s, height:p.s, background:'#c0714f',
          borderRadius:'50%',
          transform:'translate(-50%,-50%)',
          animation:`loginSparkle 1.5s ${p.d} ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════ */
export default function Login() {
  const navigate = useNavigate();
  const [showIntro,    setShowIntro]    = useState(true);
  const [itemsVisible, setItemsVisible] = useState(false);
  const [cardVisible,  setCardVisible]  = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  useEffect(() => {
    const done = () => {
      setShowIntro(false);
      setTimeout(() => setCardVisible(true),  80);
      setTimeout(() => setItemsVisible(true), 400);
    };
    document.addEventListener('welcomeDone', done);
    return () => document.removeEventListener('welcomeDone', done);
  }, []);

  useEffect(() => {
    if (authUtils.isAuthenticated()) {
      const user = authUtils.getUser();
      if (user?.role === 'ADMIN')         navigate('/admin/dashboard', { replace: true });
      else if (user?.role === 'CUSTOMER') navigate('/customer',        { replace: true });
    }
  }, [navigate]);

  const handleLogin = async () => {
    if (!email || !password) { setError('Please enter both email and password'); return; }
    setLoading(true); setError('');
    try {
      const response = await apiService.auth.login({ email, password });
      if (response.success) {
        const user = response.data.user;
        if (user.role === 'ADMIN')         navigate('/admin/dashboard', { replace: true });
        else if (user.role === 'CUSTOMER') navigate('/customer',        { replace: true });
        else { setError('Unknown user role. Please contact support.'); authUtils.logout(); }
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ca-root">
      <style>{`
        @keyframes orbitRingSpin {
          from { transform: translate(-50%, -50%) rotate(0deg);   }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes loginSparkle {
          0%,100% { opacity:0; transform:translate(-50%,-50%) scale(0.4); }
          50%     { opacity:1; transform:translate(-50%,-50%) scale(1.3); }
        }
        @keyframes loginParticleDrift {
          0%   { opacity:0;   transform:translateY(0px)   rotate(0deg);   }
          15%  { opacity:0.7;                                              }
          100% { opacity:0;   transform:translateY(-115px) rotate(360deg); }
        }
        @keyframes loginSprigBloom {
          from { opacity:0; transform:scale(0.2); }
          to   { opacity:0.55; transform:scale(1); }
        }
        @keyframes loginEmojiFloat {
          0%,100% { transform:translateY(0)   rotate(var(--r)); }
          50%     { transform:translateY(-7px) rotate(var(--r)); }
        }
        @keyframes loginBarShimmer {
          from { background-position: -200% center; }
          to   { background-position:  200% center; }
        }
        @keyframes loginCardPulse {
          0%,100% { box-shadow: 0 4px 6px rgba(61,44,30,0.04), 0 20px 60px rgba(61,44,30,0.14),
                                0 0 0 1px rgba(255,255,255,0.7) inset, 0 0 0px rgba(122,158,135,0.2); }
          50%     { box-shadow: 0 4px 6px rgba(61,44,30,0.04), 0 20px 60px rgba(61,44,30,0.14),
                                0 0 0 1px rgba(255,255,255,0.7) inset, 0 0 30px rgba(122,158,135,0.18); }
        }
      `}</style>

      {/* Dot grid */}
      <div className="ca-dot-grid" />

      {/* Ambient blobs */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:0 }}>
        <div style={{
          position:'absolute', width:600, height:600, borderRadius:'50%',
          background:'radial-gradient(circle, rgba(122,158,135,0.2) 0%, transparent 70%)',
          top:-180, right:-160,
        }} />
        <div style={{
          position:'absolute', width:480, height:480, borderRadius:'50%',
          background:'radial-gradient(circle, rgba(192,113,79,0.14) 0%, transparent 70%)',
          bottom:-130, left:-130,
        }} />
      </div>

      {/* Welcome intro */}
      {showIntro && <WelcomeIntro />}

      {/* ── Post-intro scene ── */}
      {!showIntro && (
        <div style={{
          position: 'relative',
          width: '100%', height: '100vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>

          {/* Orbit rings */}
          <OrbitRings visible={itemsVisible} />

          {/* Stationery items orbiting */}
          {ORBIT_ITEMS.map((item, i) => (
            <OrbitItem key={i} item={item} visible={itemsVisible} />
          ))}

          {/* Confetti particles */}
          <Confetti visible={itemsVisible} />

          {/* Sparkle dots */}
          <Sparkles visible={itemsVisible} />

          {/* Corner botanical sprigs — same as WelcomeIntro */}
          {itemsVisible && [
            { pos:{ top:24, left:24 },   emoji:'🌿', r:'-15deg', d:'0s'    },
            { pos:{ top:24, right:24 },  emoji:'🍃', r:'12deg',  d:'0.12s' },
            { pos:{ bottom:24, left:24 },emoji:'🌱', r:'-8deg',  d:'0.24s' },
            { pos:{ bottom:24, right:24},emoji:'🍃', r:'20deg',  d:'0.36s' },
          ].map((s, i) => (
            <div key={i} style={{
              position: 'fixed', ...s.pos,
              fontSize: 40,
              '--r': s.r,
              animation: `loginSprigBloom 0.7s cubic-bezier(0.34,1.56,0.64,1) ${s.d} both,
                          loginEmojiFloat ${3.8 + i * 0.4}s ${s.d} ease-in-out infinite`,
              filter: 'drop-shadow(0 2px 6px rgba(61,44,30,0.15))',
              pointerEvents: 'none', zIndex: 0,
            }}>
              {s.emoji}
            </div>
          ))}

          {/* ══════════════ CARD ══════════════ */}
          <div
            className="ca-card"
            style={{
              position:   'relative',
              zIndex:     10,
              opacity:    cardVisible ? 1 : 0,
              transform:  cardVisible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.93)',
              transition: 'opacity 0.65s cubic-bezier(0.22,1,0.36,1), transform 0.65s cubic-bezier(0.22,1,0.36,1)',
              animation:  cardVisible ? 'loginCardPulse 4s 1.2s ease-in-out infinite' : 'none',
            }}
          >
            {/* Shimmer top bar */}
            <div style={{
              position: 'absolute', top: 0, left: 20, right: 20, height: 3,
              background: 'linear-gradient(90deg, #e8c4b3, #c4d8cb, #7a9e87, #c4d8cb, #e8c4b3)',
              backgroundSize: '200% 100%',
              borderRadius: '0 0 4px 4px',
              animation: 'loginBarShimmer 2.8s linear infinite',
            }} />

            {/* Brand */}
            <div className="ca-brand">
              <span className="ca-brand-leaf" style={{ fontSize: 28 }}>📖</span>
              <span className="ca-brand-name">Stationery World</span>
            </div>

            {/* Header */}
            <div className="ca-header">
              <span className="ca-tag">✦ CUSTOMER LOGIN ✦</span>
              <h2 className="ca-title">Welcome Back</h2>
              <p className="ca-desc">Sign in to continue shopping</p>
            </div>

            <div className="ca-divider">
              <div className="ca-divider-line" />
              <span className="ca-divider-leaf">🌿</span>
              <div className="ca-divider-line" />
            </div>

            {/* Email */}
            <div className="ca-field">
              <label className="ca-label">Email or Username</label>
              <div className="ca-input-wrap">
                <span className="ca-input-icon">@</span>
                <input
                  className="ca-input"
                  type="text"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  onKeyPress={e => e.key === 'Enter' && handleLogin()}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="ca-field">
              <label className="ca-label">Password</label>
              <div className="ca-input-wrap">
                <span className="ca-input-icon">🔑</span>
                <input
                  className="ca-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyPress={e => e.key === 'Enter' && handleLogin()}
                  disabled={loading}
                />
                <button type="button" className="ca-eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && <div className="ca-error"><span>⚠</span> {error}</div>}

            {/* Remember / Forgot row */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 8, fontSize: 12, color: '#9a8878',
            }}>
              <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                <input type="checkbox" style={{ accentColor:'#4d7260', width:13, height:13 }} />
                Remember me
              </label>
              <span
                style={{ color:'#4d7260', cursor:'pointer', fontWeight:500, textDecoration:'underline dotted' }}
                onClick={() => navigate('/forgot-password')}
              >
                Forgot Password?
              </span>
            </div>

            <button className="ca-btn" onClick={handleLogin} disabled={loading}>
              {loading
                ? <span className="ca-spinner">◌ Signing in...</span>
                : <><span>📖</span> Sign In <span className="ca-btn-arrow">→</span></>
              }
            </button>

            <div className="ca-divider" style={{ margin:'4px 0 12px' }}>
              <div className="ca-divider-line" />
              <span style={{ fontSize:11, color:'#9a8878', whiteSpace:'nowrap', padding:'0 8px' }}>New here?</span>
              <div className="ca-divider-line" />
            </div>

            <div className="ca-links">
              <span className="ca-link" onClick={() => navigate('/signup')}>✦ Create Account →</span>
            </div>

            {/* Bottom sway strip */}
            <div style={{ display:'flex', justifyContent:'center', gap:14, marginTop:20, fontSize:17, opacity:0.3 }}>
              {[
                { e:'✏️', r:'-8deg',  d:'0s'    },
                { e:'📏', r:' 5deg',  d:'0.28s' },
                { e:'📐', r:'-12deg', d:'0.56s' },
                { e:'🖊️', r:' 10deg', d:'0.84s' },
                { e:'📌', r:'-5deg',  d:'1.12s' },
              ].map(({ e, r, d }, i) => (
                <span key={i} style={{
                  display:'inline-block', '--r':r,
                  animation:`loginEmojiFloat ${2.8 + i * 0.35}s ${d} ease-in-out infinite`,
                }}>{e}</span>
              ))}
            </div>
          </div>
          {/* ══════════════ END CARD ══════════════ */}

        </div>
      )}
    </div>
  );
}