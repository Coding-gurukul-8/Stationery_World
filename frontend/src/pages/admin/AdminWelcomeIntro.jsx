import { useEffect, useState } from "react";
import "./VerifyOTP.css";

export default function AdminWelcomeIntro({ onFinish }) {
  const [step, setStep] = useState(0);
  // step 0 = blank
  // step 1 = ruled lines animate in
  // step 2 = "WELCOME TO" fades in
  // step 3 = "STATIONERY WORLD" slides in
  // step 4 = "ADMIN'S SANCTUM" slides in + nib icon
  // step 5 = everything fades out → onFinish

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 100),   // lines appear
      setTimeout(() => setStep(2), 500),   // welcome to
      setTimeout(() => setStep(3), 1050),  // stationery world
      setTimeout(() => setStep(4), 1650),  // admin sanctum + nib
      setTimeout(() => setStep(5), 2600),  // fade out
      setTimeout(() => onFinish(),  3100), // trigger login
    ];
    return () => timers.forEach(clearTimeout);
  }, [onFinish]);

  return (
    <div className={`wi-root ${step >= 5 ? "wi-fade-out" : ""}`}>

      {/* Ruled lines background — same motif as left panel */}
      <div className="wi-lines-bg">
        {[...Array(18)].map((_, i) => (
          <div
            key={i}
            className={`wi-line ${step >= 1 ? "wi-line-in" : ""}`}
            style={{ animationDelay: `${i * 0.06}s` }}
          />
        ))}
      </div>

      {/* Center content */}
      <div className="wi-center">

        {/* Nib icon — drops in with step 4 */}
        <div className={`wi-nib ${step >= 4 ? "wi-nib-in" : ""}`}>✒</div>

        {/* WELCOME TO */}
        <p className={`wi-eyebrow ${step >= 2 ? "wi-in" : ""}`}>
          WELCOME&nbsp;&nbsp;TO
        </p>

        {/* STATIONERY WORLD — big Playfair headline, letter by letter */}
        <h1 className={`wi-headline ${step >= 3 ? "wi-in" : ""}`}>
          {"STATIONERY WORLD".split("").map((ch, i) => (
            <span
              key={i}
              className="wi-letter"
              style={{ animationDelay: `${i * 0.045}s` }}
            >
              {ch === " " ? "\u00A0" : ch}
            </span>
          ))}
        </h1>

        {/* Gold rule */}
        <div className={`wi-rule ${step >= 3 ? "wi-rule-in" : ""}`} />

        {/* ADMIN'S SANCTUM */}
        <h2 className={`wi-sub ${step >= 4 ? "wi-in" : ""}`}>
          ADMIN&apos;S&nbsp;SANCTUM
        </h2>
      </div>

      {/* Corner decorations */}
      <div className="wi-corner wi-corner-tl">✦</div>
      <div className="wi-corner wi-corner-tr">✦</div>
      <div className="wi-corner wi-corner-bl">✦</div>
      <div className="wi-corner wi-corner-br">✦</div>
    </div>
  );
}