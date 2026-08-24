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

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { pseudo } },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setDone(true);
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
          Inscription
        </div>

        {done ? (
          <div style={{ fontSize: 13, color: "#6FCF97" }}>
            Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis{" "}
            <Link href="/login" style={{ color: "var(--accent)" }}>
              connecte-toi
            </Link>
            .
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Pseudo
              </label>
              <input
                required
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
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

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Mot de passe
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? "Création…" : "Créer le compte"}
            </button>

            <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
              Déjà un compte ?{" "}
              <Link href="/login" style={{ color: "var(--accent)" }}>
                Se connecter
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
