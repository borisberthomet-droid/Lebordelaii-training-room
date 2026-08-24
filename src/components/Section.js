export default function Section({ title, action, children, style }) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 18,
        marginBottom: 16,
        ...style,
      }}
    >
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 3, height: 14, borderRadius: 2, background: "var(--accent-gradient)", display: "inline-block" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{title}</span>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
