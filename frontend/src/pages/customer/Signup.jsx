import { useState, useRef } from "react";
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

export default function Signup() {
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    phone: '', addressLine1: '', addressLine2: '',
    city: '', state: '', postalCode: '', country: ''
  });

  const [photoFile,    setPhotoFile]    = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showPw,       setShowPw]       = useState(false);
  const [showCf,       setShowCf]       = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const change = e => { setError(''); setForm(f => ({ ...f, [e.target.name]: e.target.value })); };

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024)    { setError('Image must be under 5MB'); return; }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
    setError('');
  }

  const removePhoto = () => { setPhotoFile(null); setPhotoPreview(null); };

  const allPwPassed = PW_RULES.every(r => r.test(form.password));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.name || !form.email || !form.password) { setError('Name, email and password are required'); return; }

    const failed = PW_RULES.filter(r => !r.test(form.password)).map(r => r.label);
    if (failed.length > 0) { setError('Password must have: ' + failed.join(', ')); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (k !== 'confirmPassword') fd.append(k, v); });
      if (photoFile) fd.append('photo', photoFile);

      const res  = await fetch('/api/user/signup', { method: 'POST', body: fd });
      const data = await res.json();

      if (data?.success) {
        alert('Account created! Please log in.');
        navigate('/');
      } else {
        if (data?.errors?.length) setError('Password must have: ' + data.errors.join(', '));
        else setError(data?.message || 'Signup failed');
      }
    } catch (err) {
      setError('Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ca-root" style={{ padding: '40px 16px' }}>
      <div className="ca-dot-grid" />

      <div className="ca-card ca-card-wide">
        <div className="ca-card-bar" />

        <div className="ca-brand">
          <span className="ca-brand-leaf">🌿</span>
          <span className="ca-brand-name">Stationery World</span>
        </div>

        <div className="ca-header">
          <span className="ca-tag">NEW CUSTOMER</span>
          <h2 className="ca-title">Create Account</h2>
          <p className="ca-desc">Join us and start exploring</p>
        </div>

        {/* Photo upload */}
        <div className="ca-photo-section">
          <div className="ca-photo-ring" onClick={() => fileRef.current.click()} title="Upload profile photo">
            {photoPreview
              ? <img src={photoPreview} alt="preview" className="ca-photo-preview" />
              : <span className="ca-photo-placeholder">🧑<small>PHOTO</small></span>
            }
            <div className="ca-photo-overlay">📷</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhotoChange} />
          {photoPreview
            ? <button type="button" className="ca-photo-remove" onClick={removePhoto}>Remove photo</button>
            : <p className="ca-photo-hint">Optional · Max 5MB · JPG/PNG/WEBP</p>
          }
        </div>

        {/* Basic info */}
        <div className="ca-section-label">Basic Info</div>

        <div className="ca-field">
          <label className="ca-label">Full Name *</label>
          <div className="ca-input-wrap">
            <span className="ca-input-icon">✦</span>
            <input className="ca-input" name="name" placeholder="Your full name" value={form.name} onChange={change} />
          </div>
        </div>

        <div className="ca-field">
          <label className="ca-label">Email *</label>
          <div className="ca-input-wrap">
            <span className="ca-input-icon">@</span>
            <input className="ca-input" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={change} />
          </div>
        </div>

        <div className="ca-field">
          <label className="ca-label">Phone <span className="ca-optional">(optional)</span></label>
          <div className="ca-input-wrap">
            <span className="ca-input-icon">☎</span>
            <input className="ca-input" name="phone" placeholder="+91 00000 00000" value={form.phone} onChange={change} />
          </div>
        </div>

        {/* Security */}
        <div className="ca-section-label">Security</div>

        <div className="ca-field">
          <label className="ca-label">Password *</label>
          <div className={`ca-input-wrap ${form.password && !allPwPassed ? 'ca-input-warn' : form.password && allPwPassed ? 'ca-input-ok' : ''}`}>
            <span className="ca-input-icon">🔒</span>
            <input
              className="ca-input"
              name="password" type={showPw ? "text" : "password"}
              placeholder="Create a strong password"
              value={form.password} onChange={change}
            />
            <button type="button" className="ca-eye-btn" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
              {showPw ? "🙈" : "👁"}
            </button>
          </div>
          {form.password && <PasswordStrength value={form.password} />}
        </div>

        <div className="ca-field">
          <label className="ca-label">Confirm Password *</label>
          <div className={`ca-input-wrap ${form.confirmPassword && form.confirmPassword !== form.password ? 'ca-input-warn' : form.confirmPassword && form.confirmPassword === form.password ? 'ca-input-ok' : ''}`}>
            <span className="ca-input-icon">🔒</span>
            <input
              className="ca-input"
              name="confirmPassword" type={showCf ? "text" : "password"}
              placeholder="Repeat your password"
              value={form.confirmPassword} onChange={change}
            />
            <button type="button" className="ca-eye-btn" onClick={() => setShowCf(v => !v)} tabIndex={-1}>
              {showCf ? "🙈" : "👁"}
            </button>
          </div>
          {form.confirmPassword && form.confirmPassword !== form.password && (
            <p className="ca-field-error">Passwords do not match</p>
          )}
        </div>

        {/* Address */}
        <div className="ca-section-label">Address <span className="ca-optional">(optional)</span></div>

        <div className="ca-field">
          <input className="ca-input-bare" name="addressLine1" placeholder="Address line 1" value={form.addressLine1} onChange={change} />
        </div>
        <div className="ca-field">
          <input className="ca-input-bare" name="addressLine2" placeholder="Address line 2" value={form.addressLine2} onChange={change} />
        </div>
        <div className="ca-grid-2">
          <input className="ca-input-bare" name="city"  placeholder="City"  value={form.city}  onChange={change} />
          <input className="ca-input-bare" name="state" placeholder="State" value={form.state} onChange={change} />
        </div>
        <div className="ca-grid-2">
          <input className="ca-input-bare" name="postalCode" placeholder="Postal Code" value={form.postalCode} onChange={change} />
          <input className="ca-input-bare" name="country"    placeholder="Country"     value={form.country}    onChange={change} />
        </div>

        {error && (
          <div className="ca-error"><span>⚠</span> {error}</div>
        )}

        <button className="ca-btn" onClick={handleSubmit} disabled={loading}>
          {loading
            ? <span className="ca-spinner">◌ Creating Account...</span>
            : <>Create Account <span className="ca-btn-arrow">→</span></>
          }
        </button>

        <div className="ca-links">
          <span className="ca-link" onClick={() => navigate('/')}>Already have an account? Sign In</span>
        </div>
      </div>
    </div>
  );
}