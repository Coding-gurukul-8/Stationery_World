import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function AdminSignup() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    photoUrl: ''
  });
  const [loading, setLoading] = useState(false);

  function change(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { alert('Passwords do not match'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/user/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          role: 'ADMIN',
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          country: form.country,
          photoUrl: form.photoUrl
        })
      });

      if (!res.ok) {
        const t = await res.text();
        alert('Signup failed: ' + t.slice(0, 300));
      } else {
        const data = await res.json();
        if (data?.success) {
          alert('Admin account created. Please login.');
          navigate('/admin');
        } else {
          alert('Signup failed: ' + (data?.message || 'Unknown'));
        }
      }
    } catch (err) { console.error(err); alert('Request failed'); }

    setLoading(false);
  }

  return (
    <div className="admin-login-container">
      {/* TITLE */}
      <div className="admin-login-title">
        <h1>Stationery World</h1>
        <h2>Admin&apos;s Panel</h2>
      </div>

      {/* SIGNUP BOX */}
      <div className="login-box">
        <h2>Admin Signup</h2>

        <input type="text" name="name" placeholder="Admin Name" value={form.name} onChange={change} />
        <input type="email" name="email" placeholder="Email" value={form.email} onChange={change} />

        <div className="password-box">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={form.password}
            onChange={change}
          />
          <span onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
          </span>
        </div>

        <div className="password-box">
          <input
            name="confirmPassword"
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={change}
          />
          <span onClick={() => setShowConfirm(!showConfirm)}>
            {showConfirm ? <Eye size={18} /> : <EyeOff size={18} />}
          </span>
        </div>

        <input type="text" name="phone" placeholder="Phone (optional)" value={form.phone} onChange={change} />
        <input type="text" name="addressLine1" placeholder="Address line 1" value={form.addressLine1} onChange={change} />
        <input type="text" name="addressLine2" placeholder="Address line 2" value={form.addressLine2} onChange={change} />

        <div style={{ display: 'flex', gap: 8 }}>
          <input name="city" placeholder="City" value={form.city} onChange={change} style={{ flex: 1 }} />
          <input name="state" placeholder="State" value={form.state} onChange={change} style={{ flex: 1 }} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input name="postalCode" placeholder="Postal code" value={form.postalCode} onChange={change} style={{ flex: 1 }} />
          <input name="country" placeholder="Country" value={form.country} onChange={change} style={{ flex: 1 }} />
        </div>

        <input type="text" name="photoUrl" placeholder="Photo URL (optional)" value={form.photoUrl} onChange={change} style={{ marginTop: 8 }} />

        <button onClick={submit} disabled={loading}>{loading ? 'Creating...' : 'Create Admin Account'}</button>

        <div className="links center">
          <Link to="/admin">Back to Admin Login</Link>
        </div>
      </div>
    </div>
  );
}
