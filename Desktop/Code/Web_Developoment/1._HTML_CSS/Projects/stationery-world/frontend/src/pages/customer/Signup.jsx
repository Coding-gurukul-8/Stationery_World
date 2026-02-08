import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    photoUrl: ""
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  async function handleSubmit(e) {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

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
        const text = await res.text();
        alert('Signup failed: ' + text.slice(0, 300));
      } else {
        const data = await res.json();
        if (data?.success) {
          alert('Signup successful. You can now log in.');
          navigate('/');
        } else {
          alert('Signup failed: ' + (data?.message || 'Unknown error'));
        }
      }
    } catch (err) {
      console.error('Signup error', err);
      alert('Request failed');
    }
    setLoading(false);
  }

  return (
    <div className="login-container">
      <div className="login-box signup-box-exclusive">
        <h2>Sign Up</h2>

        <input
          type="text"
          name="name"
          placeholder="Full name"
          value={form.name}
          onChange={handleChange}
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
        />

        <input
          type="text"
          name="phone"
          placeholder="Phone (optional)"
          value={form.phone}
          onChange={handleChange}
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
        />

        <input
          type="password"
          name="confirmPassword"
          placeholder="Re-enter Password"
          value={form.confirmPassword}
          onChange={handleChange}
        />

        <input
          type="text"
          name="addressLine1"
          placeholder="Address line 1 (optional)"
          value={form.addressLine1}
          onChange={handleChange}
        />
        <input
          type="text"
          name="addressLine2"
          placeholder="Address line 2 (optional)"
          value={form.addressLine2}
          onChange={handleChange}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            name="city"
            placeholder="City"
            value={form.city}
            onChange={handleChange}
            style={{ flex: 1 }}
          />
          <input
            type="text"
            name="state"
            placeholder="State"
            value={form.state}
            onChange={handleChange}
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            type="text"
            name="postalCode"
            placeholder="Postal code"
            value={form.postalCode}
            onChange={handleChange}
            style={{ flex: 1 }}
          />
          <input
            type="text"
            name="country"
            placeholder="Country"
            value={form.country}
            onChange={handleChange}
            style={{ flex: 1 }}
          />
        </div>

        <input
          type="text"
          name="photoUrl"
          placeholder="Photo URL (optional)"
          value={form.photoUrl}
          onChange={handleChange}
          style={{ marginTop: 8 }}
        />

        <button onClick={handleSubmit} disabled={loading}>{loading ? 'Signing up...' : 'Create Account'}</button>

        <div className="links">
          <a onClick={() => navigate('/')}>Back to Login</a>
        </div>
      </div>
    </div>
  );
}
