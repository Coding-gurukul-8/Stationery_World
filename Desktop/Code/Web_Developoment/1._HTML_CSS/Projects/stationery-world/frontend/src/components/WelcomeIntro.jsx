import { useEffect, useState } from "react";
import "./welcome.css";

export default function WelcomeIntro() {
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`welcome ${!showWelcome ? "move-up" : ""}`}>
      {showWelcome ? (
        <>
          <h1>Welcome</h1>
          <h1>to</h1>
          <h1>Stationery World</h1>
        </>
      ) : (
        <h1 className="title-top">Stationery World</h1>
      )}
    </div>
  );
}
