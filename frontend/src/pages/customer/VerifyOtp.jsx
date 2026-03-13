import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./VerifyOTP.css";

export default function VerifyOTP() {
  const [otp, setOtp] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    const value = e.target.value.replace(/\D/g, ""); // numbers only
    if (value.length <= 6) {
      setOtp(value);
    }
  };

  const handleVerify = () => {
    if (otp.length !== 6) {
      alert("Please enter a 6-digit OTP");
      return;
    }

    // TEMP: frontend-only verification
    sessionStorage.setItem("adminOTP", otp);

    navigate("/admin/reset-password");
  };

  return (
    <div className="verify-otp-page">
      <div className="verify-otp-card">
        <h1>Verify OTP</h1>
        <p>Enter the 6-digit OTP sent to your email</p>

        <input
          type="text"
          value={otp}
          onChange={handleChange}
          placeholder="------"
          className="otp-input"
        />

        <button onClick={handleVerify} className="verify-btn">
          Verify OTP
        </button>
      </div>
    </div>
  );
}
