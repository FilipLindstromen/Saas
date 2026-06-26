export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 50%, #f0fdf4 100%)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 20px",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgb(0 0 0 / 0.08)",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="#2563eb" />
              <path d="M7 12h10M12 7v10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#0f172a", letterSpacing: "-0.02em" }}>
              MetaConnect
            </span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
