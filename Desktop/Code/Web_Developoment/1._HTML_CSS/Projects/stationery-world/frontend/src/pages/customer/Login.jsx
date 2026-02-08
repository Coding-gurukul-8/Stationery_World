import { useNavigate } from "react-router-dom";
import { useState } from "react";
import WelcomeIntro from "../../components/WelcomeIntro";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="login-container">
      <WelcomeIntro />

      <div className="login-box login-box-exclusive">
        <h2>Login</h2>

        <input type="text" placeholder="Username or Email" />

        <div className="password-box">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
          />
          <span onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </span>
        </div>

        <button>Login</button>

        <div className="links">
          <a onClick={() => navigate("/forgot-password")}>Forgot Password?</a>
          <a onClick={() => navigate("/signup")}>Sign Up</a>
        </div>
      </div>
    </div>
  );
}
