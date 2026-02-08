import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminForgotPassword() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleSendOTP = () => {
    if (!email) return alert("Enter email");

    // MOCK OTP
    const otp = "123456";

    sessionStorage.setItem("adminOTP", otp);
    sessionStorage.setItem("adminEmail", email);

    navigate("/admin/verify-otp");
  };

  return (
    <div className="admin-login-container">
      <div className="login-box">
        <h2>Forgot Password</h2>

        <input
          type="email"
          placeholder="Admin Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button onClick={handleSendOTP}>Send OTP</button>
      </div>
    </div>
  );
}
