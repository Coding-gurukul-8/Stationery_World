import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminWelcomeIntro from "./AdminWelcomeIntro";
import { apiService } from "../../services/api";
import { authUtils } from "../../utils/auth";
import "./VerifyOTP.css";

export default function AdminLogin() {
  const [showLogin, setShowLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authUtils.isAuthenticated()) {
      const user = authUtils.getUser();
      if (user?.role === 'ADMIN') navigate("/admin/dashboard", { replace: true });
      else if (user?.role === 'CUSTOMER') navigate("/customer", { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError("Please enter both email and password"); return; }

    setLoading(true);
    setError("");

    try {
      const response = await apiService.auth.login({ email, password });
      if (response.success) {
        const user = response.data.user;
        if (user.role === 'ADMIN') navigate("/admin/dashboard", { replace: true });
        else if (user.role === 'CUSTOMER') navigate("/customer", { replace: true });
        else { setError("Unknown user role. Please contact support."); authUtils.logout(); }
      }
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      {!showLogin && <AdminWelcomeIntro onFinish={() => setShowLogin(true)} />}

      {showLogin && (
        <div className="auth-layout">
          {/* Left decorative panel */}
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
              "The pen is mightier<br />than the sword."
            </div>
          </div>

          {/* Right form panel */}
          <div className="auth-panel-right">
            <div className="auth-form-wrap">
              <div className="auth-form-header">
                <span className="auth-form-tag">ADMIN PORTAL</span>
                <h2 className="auth-form-title">Welcome Back</h2>
                <p className="auth-form-desc">Sign in to manage your store</p>
              </div>

              <div className="auth-form-body">
                <div className="auth-field-group">
                  <label className="auth-label">Email Address</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">@</span>
                    <input
                      className="auth-input"
                      type="email"
                      placeholder="admin@stationery.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleLogin(e)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="auth-field-group">
                  <label className="auth-label">Password</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">⚿</span>
                    <input
                      className="auth-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleLogin(e)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="auth-eye-btn"
                      onClick={() => setShowPassword(v => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="auth-error-box">
                    <span className="auth-error-icon">!</span>
                    {error}
                  </div>
                )}

                <button
                  className="auth-submit-btn"
                  onClick={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="auth-spinner">◌ Signing in...</span>
                  ) : (
                    <>Sign In <span className="auth-btn-arrow">→</span></>
                  )}
                </button>

                <div className="auth-links-row">
                  <a className="auth-link" href="/admin/signup">New Admin? Create Account</a>
                  <span className="auth-link-sep">·</span>
                  <a className="auth-link" href="/admin/forgot-password">Forgot Password?</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}