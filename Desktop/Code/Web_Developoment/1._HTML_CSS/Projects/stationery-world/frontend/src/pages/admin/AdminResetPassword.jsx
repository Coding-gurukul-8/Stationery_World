import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const navigate = useNavigate();

  const handleReset = () => {
    if (!password || !confirm) return alert("Fill all fields");
    if (password !== confirm) return alert("Passwords do not match");

    sessionStorage.removeItem("adminOTP");
    sessionStorage.removeItem("adminEmail");

    alert("Password reset successful");
    navigate("/admin");
  };

  return (
    <div className="admin-login-container">
      <div className="login-box">
        <h2>Reset Password</h2>

        <input
          type="password"
          placeholder="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <button onClick={handleReset}>Reset Password</button>
      </div>
    </div>
  );
}
