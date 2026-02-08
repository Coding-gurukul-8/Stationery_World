import AuthLayout from "../../components/AuthLayout";
import { useState } from "react";
import AdminWelcomeIntro from "./AdminWelcomeIntro";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [showLogin, setShowLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();

    // TEMP: Assume login success
    
    navigate("/admin/dashboard");
  };

  return (
    <div className="admin-login-container">
      {!showLogin && (
        <AdminWelcomeIntro onFinish={() => setShowLogin(true)} />
      )}

      {showLogin && (
        <>
         <div className="admin-login-title">
            <h1>STATIONERY WORLD</h1>
            <h2>ADMIN&apos;S PANEL</h2>
          </div>
        <div className="admin-login-box">
          <h2>Admin Login</h2>

          <input type="email" placeholder="Admin Email" />

          <div className="password-box">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
            />
            <span onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? "🙈" : "👁"}
            </span>
          </div>

          <button onClick={handleLogin}>Login</button>

          <p className="admin-link">
            New Admin? <a href="/admin/signup">Create Account</a>
          </p>

          <p className="forgot-link">
          <a href="/admin/forgot-password">
            Forgot Password?
          </a>
        </p>
        </div>
        </>
      )}
    </div>

    
  );
}
