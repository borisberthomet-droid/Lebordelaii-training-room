"use client";

import { useEffect, useState } from "react";
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

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [ready, setReady] = useState(false);

  // Par ici, /auth/confirm a déjà échangé le code PKCE du lien email contre une
  // session (cookie posé côté serveur) avant la redirection — on vérifie juste
  // qu'elle est bien présente plutôt que de retenter de la détecter côté client.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(!!session);
      setChecked(true);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
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
          Nouveau mot de passe
        </div>

        {!checked ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Vérification du lien…</div>
        ) : !ready ? (
          <div style={{ fontSize: 13, color: "#E0645A" }}>
            Ce lien est invalide ou a expiré.{" "}
            <Link href="/forgot-password" style={{ color: "var(--accent)" }}>
              Demander un nouveau lien
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Nouveau mot de passe
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

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              {loading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
