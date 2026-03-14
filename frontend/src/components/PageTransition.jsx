import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "./PageTransition.css";
import WalkingBoyLoader from "./WalkingBoyLoader";

// Keep this around for quick icon-based transitions if desired later.
// const ARROW = (
//   <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
//     <path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
//     <path d="M14 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
//   </svg>
// );
//
// const STAR = (
//   <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
//     <path d="M12 2l2.7 7.6H22l-6.2 4.5 2.7 7.6L12 16.5 6.5 21.7 9.2 14.1 3 9.6h7.3L12 2z" fill="currentColor" />
//   </svg>
// );
//
// const PENCIL = (
//   <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
//     <path d="M3 21v-3.75l12.06-12.06 3.75 3.75L6.75 21H3z" fill="currentColor" />
//     <path d="M14.06 4.94l3.75 3.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
//   </svg>
// );

const TRANSITION_TIMEOUT = 1200; // keep transition visible longer so the walking animation is noticeable

export default function PageTransition() {
  const location = useLocation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    // Trigger transition on every route change
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), TRANSITION_TIMEOUT);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  if (!active) return null;

  return (
    <div className="page-transition-overlay" aria-hidden="true">
      <div className="page-transition-pattern" />
      <div className="page-transition-icon">
        <WalkingBoyLoader />
      </div>
      <div className="page-transition-text">Loading…</div>
    </div>
  );
}
