import logoUrl from "../assets/logo.svg";

export default function Logo({ size = 34, alt = "Stationery World" }) {
  return (
    <img
      src={logoUrl}
      alt={alt}
      width={size}
      height={size}
      style={{ display: "block", pointerEvents: "none" }}
      className="sw-logo"
    />
  );
}
