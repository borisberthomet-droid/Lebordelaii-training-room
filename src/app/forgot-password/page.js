"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SiteLogo from "@/components/SiteLogo";

const inputStyle = {
  width: "100%",
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/update-password`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 340,
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 28,
        }}
      >
        <div style={{ marginBottom: 6 }}>
          <SiteLogo size={20} />
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 24 }}>
          Mot de passe oublié
        </div>

        {sent ? (
          <div style={{ fontSize: 13, color: "#6FCF97" }}>
            Si un compte existe avec cette adresse, un lien de réinitialisation vient d&apos;être envoyé. Vérifie ta boîte mail (et les spams).
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ fontSize: 12, color: "#E0645A", marginBottom: 12 }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--accent-gradient)",
                color: "#0B1210",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Envoi…" : "Envoyer le lien"}
            </button>
          </form>
        )}

        <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
          <Link href="/login" style={{ color: "var(--accent)" }}>
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
