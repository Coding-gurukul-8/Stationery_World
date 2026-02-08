import { useEffect, useState } from "react";

export default function AdminWelcomeIntro({ onFinish }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 150),   // WELCOME
      setTimeout(() => setStep(2), 400),   // TO
      setTimeout(() => setStep(3), 900),   // STATIONERY WORLD
      setTimeout(() => setStep(4), 1500),  // ADMIN PANEL
      setTimeout(() => setStep(5), 2200),  // move up
      setTimeout(() => onFinish(), 2600),  // show login
    ];

    return () => timers.forEach(clearTimeout);
  }, [onFinish]);

  return (
    <div className={`admin-welcome ${step >= 5 ? "move-up" : ""}`}>
      {step >= 1 && <h3 className={`fade ${step >= 5 ? "fade-out" : ""}`}>WELCOME</h3>}
      {step >= 2 && <h3 className={`fade ${step >= 5 ? "fade-out" : ""}`}>TO</h3>}
      {step >= 3 && <h1 className="slide">STATIONERY WORLD</h1>}
      {step >= 4 && <h2 className="slide small">ADMIN&apos;S PANEL</h2>}
    </div>
  );
}
