export default function OtpInput({ value, onChange }) {
  return (
    <input
      placeholder="Enter 6-digit code"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        letterSpacing: "6px",
        textAlign: "center",
        fontSize: "18px",
      }}
    />
  );
}
