import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./VerifyOTP.css";

// ─── Password rules (mirrors backend passwordValidator) ───────────────────────
const PW_RULES = [
  { key: 'uc',  label: '1 Uppercase letter',   test: v => /[A-Z]/.test(v) },
  { key: 'lc',  label: '1 Lowercase letter',   test: v => /[a-z]/.test(v) },
  { key: 'num', label: '1 Number',              test: v => /[0-9]/.test(v) },
  { key: 'sc',  label: '1 Special character',  test: v => /[^A-Za-z0-9]/.test(v) },
  { key: 'len', label: 'At least 8 characters', test: v => v.length >= 8  },
];

function PasswordStrength({ value }) {
  const passed = PW_RULES.filter(r => r.test(value)).length;
  const pct    = (passed / PW_RULES.length) * 100;
  const color  = pct <= 20 ? '#e74c3c' : pct <= 60 ? '#f39c12' : pct <= 80 ? '#3498db' : '#27ae60';
  const label  = pct <= 20 ? 'Too weak' : pct <= 60 ? 'Fair' : pct <= 80 ? 'Good' : 'Strong';

  if (!value) return null;

  return (
    <div className="pw-strength-wrap">
      <div className="pw-strength-bar-bg">
        <div className="pw-strength-bar-fill" style={{ width: `${pct}%`, background: color, transition: 'width 0.3s, background 0.3s' }} />
      </div>
      <span className="pw-strength-label" style={{ color }}>{label}</span>
      <div className="pw-rules-list">
        {PW_RULES.map(r => (
          <div key={r.key} className={`pw-rule ${r.test(value) ? 'pw-rule-ok' : 'pw-rule-fail'}`}>
            <span className="pw-rule-icon">{r.test(value) ? '✓' : '○'}</span>
            {r.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDots({ current }) {
  return (
    <div className="auth-step-dots">
      {[1, 2, 3].map(n => (
        <div key={n} className={`auth-step-dot ${n === current ? 'auth-step-dot-active' : n < current ? 'auth-step-dot-done' : ''}`}>
          {n < current ? '✓' : n}
        </div>
      ))}
      <div className="auth-step-line" />
    </div>
  );
}

export default function AdminForgotPassword() {
  const navigate  = useNavigate();
  const [step,    setStep]    = useState(1);
  const [email,   setEmail]   = useState('');
  const [otp,     setOtp]     = useState('');
  const [password,setPassword]= useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw,  setShowPw]  = useState(false);
  const [showCf,  setShowCf]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [message, setMessage] = useState('');

  function clearMessages() { setError(''); setMessage(''); }

  // ── Step 1: Send OTP ────────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    if (!email) { setError('Please enter your admin email'); return; }
    setLoading(true); clearMessages();

    try {
      const res  = await fetch('http://localhost:3000/api/user/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');

      setMessage(`OTP sent to ${email}. Check your inbox!`);
      sessionStorage.setItem('adminEmail', email);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ──────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!otp || otp.length !== 6) { setError('Please enter a valid 6-digit OTP'); return; }
    setLoading(true); clearMessages();

    try {
      const res  = await fetch('http://localhost:3000/api/user/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid OTP');

      setMessage('OTP verified! Set your new password below.');
      setStep(3);
    } catch (err) {
      setError(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Reset Password ──────────────────────────────────────────────────
  const handleReset = async () => {
    clearMessages();
    if (!password)            { setError('Password cannot be empty'); return; }
    if (!confirm)             { setError('Please confirm your password'); return; }

    // Client-side password rule check — same rules as backend
    const failed = PW_RULES.filter(r => !r.test(password)).map(r => r.label);
    if (failed.length > 0) {
      setError('Password must have: ' + failed.join(', '));
      return;
    }

    if (password !== confirm) { setError('Passwords do not match'); return; }

    setLoading(true);

    try {
      const res  = await fetch('http://localhost:3000/api/user/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), otp, newPassword: password })
      });
      const data = await res.json();

      if (!res.ok) {
        // Show backend password errors if any
        if (data?.errors?.length) {
          setError('Password must have: ' + data.errors.join(', '));
        } else {
          throw new Error(data.message || 'Failed to reset password');
        }
        return;
      }

      sessionStorage.clear();
      alert('✅ Password reset successfully! You can now login.');
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => { setOtp(''); await handleSendOTP(); };

  const allPwPassed = PW_RULES.every(r => r.test(password));

  const stepTitles = ['Request OTP', 'Verify OTP', 'New Password'];
  const stepDescs  = [
    'Enter your admin email to receive a reset code',
    `Code sent to ${email || 'your email'} — check your inbox`,
    'Create a new strong password for your account'
  ];

  return (
    <div className="auth-root">
      <div className="auth-layout">
        {/* Left panel */}
        <div className="auth-panel-left">
          <div className="auth-brand">
            <div className="auth-brand-icon">✒</div>
            <h1 className="auth-brand-name">Stationery<br />World</h1>
            <p className="auth-brand-sub">Admin's Sanctum</p>
          </div>
          <div className="auth-panel-lines">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="auth-ruled-line" style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
          <div className="auth-panel-quote">
            "Every mistake is just<br />a draft waiting<br />to be rewritten."
          </div>
        </div>

        {/* Right form panel */}
        <div className="auth-panel-right">
          <div className="auth-form-wrap">

            <div className="auth-form-header">
              <span className="auth-form-tag">PASSWORD RECOVERY</span>
              <h2 className="auth-form-title">{stepTitles[step - 1]}</h2>
              <p className="auth-form-desc">{stepDescs[step - 1]}</p>
            </div>

            <StepDots current={step} />

            <div className="auth-form-body">

              {/* ── Messages ── */}
              {error && (
                <div className="auth-error-box">
                  <span className="auth-error-icon">!</span>
                  {error}
                </div>
              )}
              {message && (
                <div className="auth-success-box">
                  <span>✓</span> {message}
                </div>
              )}

              {/* ── Step 1 ── */}
              {step === 1 && (
                <>
                  <div className="auth-field-group">
                    <label className="auth-label">Admin Email Address</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">@</span>
                      <input
                        className="auth-input"
                        type="email"
                        placeholder="admin@stationery.com"
                        value={email}
                        onChange={e => { setEmail(e.target.value); clearMessages(); }}
                        onKeyPress={e => e.key === 'Enter' && handleSendOTP()}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <button className="auth-submit-btn" onClick={handleSendOTP} disabled={loading}>
                    {loading ? <span className="auth-spinner">◌ Sending...</span> : <>Send OTP <span className="auth-btn-arrow">→</span></>}
                  </button>

                  <div className="auth-links-row">
                    <a className="auth-link" href="/admin">← Back to Login</a>
                  </div>
                </>
              )}

              {/* ── Step 2 ── */}
              {step === 2 && (
                <>
                  <div className="auth-field-group">
                    <label className="auth-label">6-Digit OTP</label>
                    <input
                      className="auth-otp-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '');
                        if (v.length <= 6) { setOtp(v); clearMessages(); }
                      }}
                      onKeyPress={e => e.key === 'Enter' && otp.length === 6 && handleVerify()}
                      maxLength={6}
                      disabled={loading}
                    />
                    <p className="auth-otp-hint">{otp.length}/6 digits entered</p>
                  </div>

                  <button
                    className="auth-submit-btn"
                    onClick={handleVerify}
                    disabled={loading || otp.length !== 6}
                  >
                    {loading ? <span className="auth-spinner">◌ Verifying...</span> : <>Verify OTP <span className="auth-btn-arrow">→</span></>}
                  </button>

                  <div className="auth-links-row">
                    <button className="auth-link-btn" onClick={handleResend} disabled={loading}>
                      Didn't receive it? Resend OTP
                    </button>
                  </div>
                </>
              )}

              {/* ── Step 3 ── */}
              {step === 3 && (
                <>
                  <div className="auth-field-group">
                    <label className="auth-label">New Password</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">⚿</span>
                      <input
                        className={`auth-input ${password && !allPwPassed ? 'auth-input-warn' : password && allPwPassed ? 'auth-input-ok' : ''}`}
                        type={showPw ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={password}
                        onChange={e => { setPassword(e.target.value); clearMessages(); }}
                      />
                      <button type="button" className="auth-eye-btn" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                        {showPw ? "🙈" : "👁"}
                      </button>
                    </div>
                    {password && <PasswordStrength value={password} />}
                  </div>

                  <div className="auth-field-group">
                    <label className="auth-label">Confirm New Password</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">⚿</span>
                      <input
                        className={`auth-input ${confirm && confirm !== password ? 'auth-input-warn' : confirm && confirm === password ? 'auth-input-ok' : ''}`}
                        type={showCf ? "text" : "password"}
                        placeholder="Repeat your password"
                        value={confirm}
                        onChange={e => { setConfirm(e.target.value); clearMessages(); }}
                        onKeyPress={e => e.key === 'Enter' && handleReset()}
                      />
                      <button type="button" className="auth-eye-btn" onClick={() => setShowCf(v => !v)} tabIndex={-1}>
                        {showCf ? "🙈" : "👁"}
                      </button>
                    </div>
                    {confirm && confirm !== password && (
                      <p className="auth-field-error">Passwords do not match</p>
                    )}
                  </div>

                  <button className="auth-submit-btn" onClick={handleReset} disabled={loading}>
                    {loading ? <span className="auth-spinner">◌ Resetting...</span> : <>Reset Password <span className="auth-btn-arrow">→</span></>}
                  </button>
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}