import { useState } from "react";
import { useNavigate } from "react-router-dom";
import OtpInput from "../../components/OtpInput";

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const navigate = useNavigate();
  const handleSendOTP = () => {
    if (!emailOrPhone) return alert("Enter email or phone number");
    console.log("Sending OTP to:", emailOrPhone);
    // MOCK OTP
    sessionStorage.setItem("otp", "123456");
    sessionStorage.setItem("resetEmail", emailOrPhone);
    console.log("OTP sent: ", sessionStorage.getItem("otp"));
    //navigate("/verify-otp");
  };

  const handleVerify = () => {
    useEffect(() => {
      const savedOtp = sessionStorage.getItem("otp");
      console.log("Verify Page OTP:", savedOtp);

      if (!savedOtp) {
        navigate("/forgot-password");
      }
    }, []);

    console.log("Verifying OTP:", otp, "against", savedOtp);
    if(!savedOtp) return alert("No OTP found. Please request a new one.");
    if (otp === savedOtp) {
      navigate("/reset-password");
    } else {
      alert("Invalid OTP");
    }
  };

  const handleReset = () => {
    //changes made by priyanshu 
    if(!password) return alert("Password cannot be empty");
    if(!confirm) return alert("Please confirm your password");
    
    //from here gpt changes
    if (password !== confirm) return alert("Passwords do not match");

    // MOCK SUCCESS
    sessionStorage.clear();
    alert("Password reset successful");
    navigate("/");
  };

  return (
    <div className="login-container">
      <div className="login-box">

        {step === 1 && (
          <>
            <h2>Forgot Password</h2>
            <input
              placeholder="Email or Phone"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
            />
            <button onClick={() => {
              handleSendOTP
              setStep(2)
              
              }}>Send Code</button>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Verify Code</h2>
            <OtpInput value={otp} onChange={setOtp} />

            <button onClick={() => {
              setStep(3)
              handleVerify}}>Verify</button>
          </>
        )}

        {step === 3 && (
          <>
            <h2>Reset Password</h2>
            <input
              type="password"
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              type="password"
              placeholder="Re-enter Password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <button
              onClick={() => handleReset()}>Update Password</button>
          </>
        )}

      </div>
    </div>
  );
}
