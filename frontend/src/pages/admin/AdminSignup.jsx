import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/constants";
import "./VerifyOTP.css";

// ─── Password rules (mirrors backend passwordValidator) ───────────────────────
const PW_RULES = [
  { key: 'uc',  label: '1 Uppercase letter',  test: v => /[A-Z]/.test(v) },
  { key: 'lc',  label: '1 Lowercase letter',  test: v => /[a-z]/.test(v) },
  { key: 'num', label: '1 Number',             test: v => /[0-9]/.test(v) },
  { key: 'sc',  label: '1 Special character',  test: v => /[^A-Za-z0-9]/.test(v) },
  { key: 'len', label: 'At least 8 characters',test: v => v.length >= 8   },
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
        <div
          className="pw-strength-bar-fill"
          style={{ width: `${pct}%`, background: color, transition: 'width 0.3s, background 0.3s' }}
        />
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

export default function AdminSignup() {
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile,    setPhotoFile]    = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [pwFocused,    setPwFocused]    = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    phone: '', addressLine1: '', addressLine2: '',
    city: '', state: '', postalCode: '', country: ''
  });

  const change = e => {
    setError('');
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Photo must be under 5MB'); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  // Validate password client-side before sending
  function validatePw(pw) {
    const failed = PW_RULES.filter(r => !r.test(pw)).map(r => r.label);
    return failed;
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (!form.name || !form.email || !form.password) {
      setError('Name, email and password are required.'); return;
    }

    const pwErrors = validatePw(form.password);
    if (pwErrors.length > 0) {
      setError('Password must have: ' + pwErrors.join(', ')); return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match'); return;
    }

    setLoading(true);

    try {
      // ✅ Use FormData so the photo file is sent as multipart
      const fd = new FormData();
      fd.append('name',        form.name);
      fd.append('email',       form.email);
      fd.append('password',    form.password);
      fd.append('role',        'ADMIN');
      fd.append('phone',       form.phone);
      fd.append('addressLine1',form.addressLine1);
      fd.append('addressLine2',form.addressLine2);
      fd.append('city',        form.city);
      fd.append('state',       form.state);
      fd.append('postalCode',  form.postalCode);
      fd.append('country',     form.country);
      if (photoFile) fd.append('photo', photoFile);  // field name 'photo' matches multer

      const res = await fetch(`${API_BASE_URL}/api/user/signup`, { method: 'POST', body: fd });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (data?.success) {
        alert('✅ Admin account created! Please log in.');
        navigate('/admin');
      } else {
        // Show backend password errors if any
        if (data?.errors?.length) {
          setError('Password must have: ' + data.errors.join(', '));
        } else {
          setError(data?.message || `Signup failed${res.ok ? '' : ` (HTTP ${res.status})`}`);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const allPwPassed = PW_RULES.every(r => r.test(form.password));

  return (
    <div className="auth-root">
      <div className="auth-layout auth-layout-signup">
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
            "Write your story<br />from the very first page."
          </div>
        </div>

        {/* Right form panel */}
        <div className="auth-panel-right auth-panel-right-scroll">
          <div className="auth-form-wrap">
            <div className="auth-form-header">
              <span className="auth-form-tag">NEW ADMIN</span>
              <h2 className="auth-form-title">Create Account</h2>
              <p className="auth-form-desc">Set up your administrator profile</p>
            </div>

            <div className="auth-form-body">

              {/* ── Photo Upload ── */}
              <div className="auth-photo-section">
                <div
                  className="auth-photo-circle"
                  onClick={() => fileRef.current.click()}
                  title="Click to upload photo"
                >
                  {photoPreview
                    ? <img src={photoPreview} alt="preview" className="auth-photo-img" />
                    : <span className="auth-photo-placeholder">👤<br /><small>Upload Photo</small></span>
                  }
                  <div className="auth-photo-overlay">📷</div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  style={{ display: 'none' }}
                  onChange={handlePhotoChange}
                />
                <p className="auth-photo-hint">Optional · Max 5MB · JPG/PNG/WEBP</p>
              </div>

              {/* ── Basic Info ── */}
              <div className="auth-section-label">Basic Info</div>

              <div className="auth-field-group">
                <label className="auth-label">Full Name *</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">✦</span>
                  <input className="auth-input" name="name" placeholder="Your full name" value={form.name} onChange={change} />
                </div>
              </div>

              <div className="auth-field-group">
                <label className="auth-label">Email Address *</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">@</span>
                  <input className="auth-input" name="email" type="email" placeholder="admin@stationery.com" value={form.email} onChange={change} />
                </div>
              </div>

              <div className="auth-field-group">
                <label className="auth-label">Phone <span className="auth-optional">(optional)</span></label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">☎</span>
                  <input className="auth-input" name="phone" placeholder="+91 00000 00000" value={form.phone} onChange={change} />
                </div>
              </div>

              {/* ── Password ── */}
              <div className="auth-section-label">Security</div>

              <div className="auth-field-group">
                <label className="auth-label">Password *</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">⚿</span>
                  <input
                    className={`auth-input ${form.password && !allPwPassed ? 'auth-input-warn' : form.password && allPwPassed ? 'auth-input-ok' : ''}`}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={form.password}
                    onChange={change}
                    onFocus={() => setPwFocused(true)}
                    onBlur={() => setPwFocused(false)}
                  />
                  <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>
                {/* Show strength whenever there's a value */}
                {form.password && <PasswordStrength value={form.password} />}
              </div>

              <div className="auth-field-group">
                <label className="auth-label">Confirm Password *</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">⚿</span>
                  <input
                    className={`auth-input ${form.confirmPassword && form.confirmPassword !== form.password ? 'auth-input-warn' : form.confirmPassword && form.confirmPassword === form.password ? 'auth-input-ok' : ''}`}
                    name="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={form.confirmPassword}
                    onChange={change}
                  />
                  <button type="button" className="auth-eye-btn" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
                    {showConfirm ? "🙈" : "👁"}
                  </button>
                </div>
                {form.confirmPassword && form.confirmPassword !== form.password && (
                  <p className="auth-field-error">Passwords do not match</p>
                )}
              </div>

              {/* ── Address ── */}
              <div className="auth-section-label">Address <span className="auth-optional">(optional)</span></div>

              <div className="auth-field-group">
                <input className="auth-input auth-input-standalone" name="addressLine1" placeholder="Address Line 1" value={form.addressLine1} onChange={change} />
              </div>
              <div className="auth-field-group">
                <input className="auth-input auth-input-standalone" name="addressLine2" placeholder="Address Line 2" value={form.addressLine2} onChange={change} />
              </div>
              <div className="auth-grid-2">
                <input className="auth-input auth-input-standalone" name="city" placeholder="City" value={form.city} onChange={change} />
                <input className="auth-input auth-input-standalone" name="state" placeholder="State" value={form.state} onChange={change} />
              </div>
              <div className="auth-grid-2">
                <input className="auth-input auth-input-standalone" name="postalCode" placeholder="Postal Code" value={form.postalCode} onChange={change} />
                <input className="auth-input auth-input-standalone" name="country" placeholder="Country" value={form.country} onChange={change} />
              </div>

              {error && (
                <div className="auth-error-box">
                  <span className="auth-error-icon">!</span>
                  {error}
                </div>
              )}

              <button className="auth-submit-btn" onClick={submit} disabled={loading}>
                {loading
                  ? <span className="auth-spinner">◌ Creating Account...</span>
                  : <>Create Admin Account <span className="auth-btn-arrow">→</span></>
                }
              </button>

              <div className="auth-links-row">
                <Link className="auth-link" to="/admin">Already have an account? Sign In</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}