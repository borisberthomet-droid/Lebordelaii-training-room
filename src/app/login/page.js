"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/");
    router.refresh();
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
      <form
        onSubmit={handleSubmit}
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
          Connexion
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
          {loading ? "Connexion…" : "Se connecter"}
        </button>

        <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
          Pas encore de compte ?{" "}
          <Link href="/signup" style={{ color: "var(--accent)" }}>
            S&apos;inscrire
          </Link>
        </div>
      </form>
    </div>
  );
}
