import { useMemo, useRef, useEffect, useState } from 'react';
import './CartoonMascot.css';

/**
 * Cartoon Mascot component for a friendly stationery-themed animation.
 * Used on admin + customer screens as a subtle floating mascot.
 *
 * Features:
 * - Draggable / moveable
 * - Multiple animated variants (pencil, ruler, book, paintbrush)
 */
export default function CartoonMascot({ position = 'bottom-right' }) {
  // position accepts: 'top-right', 'bottom-right', 'top-left', 'bottom-left'
  // We'll compute an initial x/y offset and then allow the user to drag the mascot anywhere.
  const wrapperRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [pos, setPos] = useState(null);

  const getInitialPos = () => {
    const padding = 18;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const size = 120;

    const [vert, horiz] = position.split('-');
    const x = horiz === 'right' ? width - size - padding : padding;
    const y = vert === 'bottom' ? height - size - padding : padding;

    return { x, y };
  };

  useEffect(() => {
    if (!pos) {
      setPos(getInitialPos());
    }

    const handleResize = () => {
      // Keep mascot on-screen after resizing (if it was still close to edges)
      setPos((current) => {
        if (!current) return current;
        const maxX = window.innerWidth - 140;
        const maxY = window.innerHeight - 140;
        return {
          x: Math.min(Math.max(current.x, 12), maxX),
          y: Math.min(Math.max(current.y, 12), maxY)
        };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pos, position]);

  const variant = useMemo(() => {
    const variants = ['pencil', 'ruler', 'book', 'paintbrush'];
    return variants[Math.floor(Date.now() / 5000) % variants.length];
  }, []);

  const Svg = useMemo(() => {
    switch (variant) {
      case 'ruler':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="mascot-svg">
            <defs>
              <linearGradient id="mascot-shadow" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(26, 22, 18, 0.18)" />
                <stop offset="100%" stopColor="rgba(26, 22, 18, 0)" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="58" fill="#FFF5E8" stroke="#C9A84C" strokeWidth="4" />
            <rect x="38" y="30" width="44" height="70" rx="8" fill="#F7D488" stroke="#D69F2E" strokeWidth="2" />
            {Array.from({ length: 7 }).map((_, i) => (
              <line
                key={i}
                x1="42"
                y1={40 + i * 9}
                x2="78"
                y2={40 + i * 9}
                stroke="#C37B25"
                strokeWidth="1"
              />
            ))}
            <circle cx="60" cy="70" r="12" fill="#fff" stroke="#C37B25" strokeWidth="2" />
            <path
              d="M52 70c2 3 8 3 10 0"
              stroke="#C37B25"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <ellipse cx="60" cy="108" rx="32" ry="8" fill="url(#mascot-shadow)" />
          </svg>
        );
      case 'paintbrush':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="mascot-svg">
            <defs>
              <linearGradient id="mascot-shadow" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(26, 22, 18, 0.18)" />
                <stop offset="100%" stopColor="rgba(26, 22, 18, 0)" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="58" fill="#FFF5E8" stroke="#C9A84C" strokeWidth="4" />
            <path d="M70 30 L80 40 L60 80 L50 70 Z" fill="#7A9E87" stroke="#4D7260" strokeWidth="2" />
            <path d="M50 70 L52 88 L68 92 L70 74 Z" fill="#D69F2E" stroke="#A1753E" strokeWidth="2" />
            <path d="M52 88 C52 96 68 96 68 88" stroke="#703E1D" strokeWidth="3" fill="none" />
            <ellipse cx="60" cy="108" rx="32" ry="8" fill="url(#mascot-shadow)" />
          </svg>
        );
      case 'book':
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="mascot-svg">
            <defs>
              <linearGradient id="mascot-shadow" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(26, 22, 18, 0.18)" />
                <stop offset="100%" stopColor="rgba(26, 22, 18, 0)" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="58" fill="#FFF5E8" stroke="#C9A84C" strokeWidth="4" />
            <path d="M40 45 h40 v6 h-40 z" fill="#A78B6A" />
            <path d="M40 51 h40 v44 h-40 z" fill="#F7F0E4" />
            <path d="M42 55 h36 v4 h-36 z" fill="#E0D2C2" />
            <path d="M42 63 h36 v4 h-36 z" fill="#E0D2C2" />
            <path d="M42 71 h36 v4 h-36 z" fill="#E0D2C2" />
            <path d="M42 79 h36 v4 h-36 z" fill="#E0D2C2" />
            <path d="M42 87 h36 v4 h-36 z" fill="#E0D2C2" />
            <path d="M58 107 l8 -14 l12 6 l-8 14 z" fill="#C0714F" opacity="0.9" />
            <path d="M58 107 l8 -14 l12 6 l-8 14 z" fill="none" stroke="#8C4F31" strokeWidth="1" />
            <ellipse cx="60" cy="108" rx="32" ry="8" fill="url(#mascot-shadow)" />
          </svg>
        );
      default:
        return (
          <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="mascot-svg">
            <defs>
              <linearGradient id="mascot-shadow" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(26, 22, 18, 0.18)" />
                <stop offset="100%" stopColor="rgba(26, 22, 18, 0)" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="58" fill="#FFF5E8" stroke="#C9A84C" strokeWidth="4" />
            <path
              d="M42 70 L68 44 L72 48 L46 74 Z"
              fill="#FFC966"
              stroke="#D69F2E"
              strokeWidth="2"
            />
            <path
              d="M46 74 L72 48 L78 54 L52 80 Z"
              fill="#F1A35A"
              stroke="#D69F2E"
              strokeWidth="2"
            />
            <path
              d="M48 76 L58 86 L66 78 L56 68 Z"
              fill="#FDE8C3"
              stroke="#D69F2E"
              strokeWidth="1.2"
            />
            <g className="mascot-face" transform="translate(20, 26)">
              <circle cx="40" cy="40" r="20" fill="#FFFFFF" opacity="0.92" />
              <path
                d="M33 40 Q40 47 47 40"
                stroke="#1A1612"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx="34" cy="35" r="3" fill="#1A1612" />
              <circle cx="46" cy="35" r="3" fill="#1A1612" />
            </g>
            <ellipse cx="60" cy="108" rx="32" ry="8" fill="url(#mascot-shadow)" />
          </svg>
        );
    }
  }, [variant]);

  const handlePointerDown = (event) => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setDragging(true);
    setDragOffset({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
    wrapperRef.current.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragging) return;
    setPos({
      x: event.clientX - dragOffset.x,
      y: event.clientY - dragOffset.y
    });
  };

  const handlePointerUp = (event) => {
    if (!dragging) return;
    setDragging(false);
    if (wrapperRef.current) {
      wrapperRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const wrapperStyle = pos
    ? {
        left: pos.x,
        top: pos.y
      }
    : undefined;

  return (
    <div
      ref={wrapperRef}
      className={`mascot-wrapper ${dragging ? 'grabbing' : ''} ${pos ? '' : `mascot-${position}`}`}
      aria-hidden="true"
      style={wrapperStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="mascot-floating" data-variant={variant}>
        {Svg}
      </div>
    </div>
  );
}
