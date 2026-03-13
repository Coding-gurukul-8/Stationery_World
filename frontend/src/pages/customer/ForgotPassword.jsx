import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./customer-auth.css";

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
  const color  = pct <= 20 ? '#d9534f' : pct <= 60 ? '#e67e22' : pct <= 80 ? '#7a9e87' : '#4d7260';
  const label  = pct <= 20 ? 'Too weak' : pct <= 60 ? 'Fair' : pct <= 80 ? 'Good' : 'Strong ✓';
  if (!value) return null;
  return (
    <div className="ca-pw-strength">
      <div className="ca-pw-bar-bg">
        <div className="ca-pw-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="ca-pw-label" style={{ color }}>{label}</span>
      <div className="ca-pw-rules">
        {PW_RULES.map(r => (
          <div key={r.key} className={`ca-pw-rule ${r.test(value) ? 'ca-pw-rule-ok' : 'ca-pw-rule-fail'}`}>
            <span className="ca-pw-rule-icon">{r.test(value) ? '✓' : '○'}</span>
            {r.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function Steps({ current }) {
  return (
    <div className="ca-steps">
      {[1,2,3].map((n, i) => (
        <>
          <div key={n} className={`ca-step-dot ${n === current ? 'ca-step-active' : n < current ? 'ca-step-done' : ''}`}>
            {n < current ? '✓' : n}
          </div>
          {i < 2 && <div className={`ca-step-conn ${n < current ? 'ca-step-conn-done' : ''}`} />}
        </>
      ))}
    </div>
  );
}

export default function ForgotPassword() {
  const navigate = useNavigate();
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

  const clear = () => { setError(''); setMessage(''); };

  const handleSendOTP = async () => {
    if (!email) { setError('Please enter your email'); return; }
    setLoading(true); clear();
    try {
      const res  = await fetch('http://localhost:3000/api/user/forgot-password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: email.toLowerCase().trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');
      setMessage(`OTP sent to ${email}. Check your inbox!`);
      sessionStorage.setItem('resetEmail', email);
      setStep(2);
    } catch(err) { setError(err.message || 'Failed to send OTP'); }
    finally { setLoading(false); }
  };

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) { setError('Please enter the 6-digit OTP'); return; }
    setLoading(true); clear();
    try {
      const res  = await fetch('http://localhost:3000/api/user/verify-otp', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: email.toLowerCase().trim(), otp }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid OTP');
      setMessage('OTP verified! Set your new password.');
      setStep(3);
    } catch(err) { setError(err.message || 'Verification failed'); }
    finally { setLoading(false); }
  };

  const handleReset = async () => {
    clear();
    if (!password) { setError('Password cannot be empty'); return; }
    const failed = PW_RULES.filter(r => !r.test(password)).map(r => r.label);
    if (failed.length > 0) { setError('Password must have: ' + failed.join(', ')); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res  = await fetch('http://localhost:3000/api/user/reset-password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: email.toLowerCase().trim(), otp, newPassword: password }) });
      const data = await res.json();
      if (!res.ok) {
        if (data?.errors?.length) { setError('Password must have: ' + data.errors.join(', ')); return; }
        throw new Error(data.message || 'Reset failed');
      }
      sessionStorage.clear();
      alert('Password reset! You can now log in.');
      navigate('/');
    } catch(err) { setError(err.message || 'Reset failed'); }
    finally { setLoading(false); }
  };

  const stepTitles = ['Forgot Password', 'Verify Code', 'New Password'];
  const stepDescs  = ['Enter your email to get a reset code', `Code sent to ${email || 'your email'}`, 'Create a strong new password'];

  const allPwPassed = PW_RULES.every(r => r.test(password));

  return (
    <div className="ca-root">
      <div className="ca-dot-grid" />

      <div className="ca-card">
        <div className="ca-card-bar" />

        <div className="ca-brand">
          <span className="ca-brand-leaf">🌿</span>
          <span className="ca-brand-name">Stationery World</span>
        </div>

        <div className="ca-header">
          <span className="ca-tag">PASSWORD RECOVERY</span>
          <h2 className="ca-title">{stepTitles[step-1]}</h2>
          <p className="ca-desc">{stepDescs[step-1]}</p>
        </div>

        <Steps current={step} />

        {error   && <div className="ca-error"><span>⚠</span> {error}</div>}
        {message && <div className="ca-success"><span>✓</span> {message}</div>}

        {/* Step 1 */}
        {step === 1 && (
          <>
            <div className="ca-field">
              <label className="ca-label">Email Address</label>
              <div className="ca-input-wrap">
                <span className="ca-input-icon">@</span>
                <input className="ca-input" type="email" placeholder="you@example.com" value={email}
                  onChange={e => { setEmail(e.target.value); clear(); }}
                  onKeyPress={e => e.key==='Enter' && handleSendOTP()} disabled={loading} />
              </div>
            </div>
            <button className="ca-btn" onClick={handleSendOTP} disabled={loading}>
              {loading ? <span className="ca-spinner">◌ Sending...</span> : <>Send Code <span className="ca-btn-arrow">→</span></>}
            </button>
            <div className="ca-links">
              <span className="ca-link" onClick={() => navigate('/')}>← Back to Login</span>
            </div>
          </>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <>
            <div className="ca-field">
              <label className="ca-label">6-Digit Code</label>
              <input className="ca-otp-input" type="text" inputMode="numeric" placeholder="• • • • • •"
                value={otp} maxLength={6}
                onChange={e => { const v = e.target.value.replace(/\D/g,''); if(v.length<=6){ setOtp(v); clear(); } }}
                onKeyPress={e => e.key==='Enter' && otp.length===6 && handleVerify()}
                disabled={loading} />
              <p className="ca-otp-hint">{otp.length}/6 digits</p>
            </div>
            <button className="ca-btn" onClick={handleVerify} disabled={loading || otp.length!==6}>
              {loading ? <span className="ca-spinner">◌ Verifying...</span> : <>Verify Code <span className="ca-btn-arrow">→</span></>}
            </button>
            <div className="ca-links">
              <button className="ca-link-btn" onClick={handleSendOTP} disabled={loading}>Resend Code</button>
            </div>
          </>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <>
            <div className="ca-field">
              <label className="ca-label">New Password</label>
              <div className={`ca-input-wrap ${password && !allPwPassed ? 'ca-input-warn' : password && allPwPassed ? 'ca-input-ok' : ''}`}>
                <span className="ca-input-icon">🔒</span>
                <input className="ca-input" type={showPw?"text":"password"} placeholder="Create a strong password"
                  value={password} onChange={e => { setPassword(e.target.value); clear(); }} />
                <button type="button" className="ca-eye-btn" onClick={() => setShowPw(v=>!v)} tabIndex={-1}>{showPw?"🙈":"👁"}</button>
              </div>
              {password && <PasswordStrength value={password} />}
            </div>
            <div className="ca-field">
              <label className="ca-label">Confirm Password</label>
              <div className={`ca-input-wrap ${confirm && confirm!==password ? 'ca-input-warn' : confirm && confirm===password ? 'ca-input-ok' : ''}`}>
                <span className="ca-input-icon">🔒</span>
                <input className="ca-input" type={showCf?"text":"password"} placeholder="Repeat password"
                  value={confirm} onChange={e => { setConfirm(e.target.value); clear(); }}
                  onKeyPress={e => e.key==='Enter' && handleReset()} />
                <button type="button" className="ca-eye-btn" onClick={() => setShowCf(v=>!v)} tabIndex={-1}>{showCf?"🙈":"👁"}</button>
              </div>
              {confirm && confirm!==password && <p className="ca-field-error">Passwords do not match</p>}
            </div>
            <button className="ca-btn" onClick={handleReset} disabled={loading}>
              {loading ? <span className="ca-spinner">◌ Updating...</span> : <>Reset Password <span className="ca-btn-arrow">→</span></>}
            </button>
          </>
        )}

      </div>
    </div>
  );
}