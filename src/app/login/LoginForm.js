"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SiteLogo from "@/components/SiteLogo";
import { ACTIVATION_MESSAGES, normalizeCode } from "@/lib/access";

// Connexion et activation sur une même carte, en deux onglets. L'activation crée le compte avec
// la clé transmise par Boris ; la base vérifie et réserve la clé au moment de la création (voir
// supabase/schema.sql), la vérification préalable ne sert qu'à afficher un message précis.

const inputStyle = {
  width: "100%",
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  borderRadius: 8,
  padding: "9px 10px",
  fontSize: 13,
};

const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 };

function tab(active) {
  return {
    flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", fontSize: 13,
    fontWeight: active ? 700 : 500, cursor: "pointer",
    background: active ? "var(--panel)" : "transparent",
    color: active ? "var(--text)" : "var(--text-muted)",
  };
}

// Messages Supabase traduits en action concrète plutôt que laissés en anglais technique.
function authMessage(error) {
  const m = error?.message || "";
  if (/invalid login credentials/i.test(m)) return "Email ou mot de passe incorrect.";
  if (/email not confirmed/i.test(m)) return "Ton adresse email n'est pas encore confirmée.";
  if (/already registered|already been registered/i.test(m)) {
    return "Un compte existe déjà avec cet email : connecte-toi, tu pourras y activer ta clé.";
  }
  // Refus levé par la base au moment de réserver la clé : elle a été prise entre la vérification
  // et la création du compte.
  if (/database error/i.test(m)) {
    return "La clé n'a pas pu être activée, elle vient peut-être d'être utilisée. Réessaie ou contacte Boris.";
  }
  if (/password/i.test(m) && /6|characters|short/i.test(m)) return "Mot de passe trop court : 6 caractères minimum.";
  return m || "Une erreur est survenue.";
}

export default function LoginForm({ initialMode, next, initialError }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [code, setCode] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState(initialError);
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (m) => { setMode(m); setError(""); setInfo(""); };

  const login = async () => {
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) { setError(authMessage(signInError)); return; }
    router.push(next);
    router.refresh();
  };

  const activate = async () => {
    const supabase = createClient();
    const cleanCode = normalizeCode(code);
    const { data: status, error: checkError } = await supabase.rpc("check_activation", {
      p_code: cleanCode, p_pseudo: pseudo.trim(),
    });
    if (checkError) { setError("Impossible de vérifier la clé pour le moment. Réessaie dans un instant."); return; }
    if (status !== "ok") { setError(ACTIVATION_MESSAGES[status] || "Clé refusée."); return; }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { pseudo: pseudo.trim(), access_key: cleanCode, consent: true },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
      },
    });
    if (signUpError) { setError(authMessage(signUpError)); return; }
    // Sans session, Supabase exige encore la confirmation de l'email : la clé est bien réservée,
    // il reste à cliquer le lien.
    if (!data.session) {
      setInfo("Accès activé. Confirme ton adresse email avec le lien reçu, puis connecte-toi.");
      return;
    }
    router.push(next);
    router.refresh();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setInfo("");
    setLoading(true);
    try {
      await (mode === "login" ? login() : activate());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={handleSubmit} style={{
        width: "100%", maxWidth: 380, background: "var(--panel)",
        border: "1px solid var(--border)", borderRadius: 16, padding: 28,
      }}>
        <div style={{ marginBottom: 18 }}>
          <SiteLogo size={20} />
        </div>

        <div style={{ display: "flex", gap: 4, background: "var(--panel-2)", borderRadius: 10, padding: 4, marginBottom: 18 }}>
          <button type="button" onClick={() => switchMode("login")} style={tab(mode === "login")}>Se connecter</button>
          <button type="button" onClick={() => switchMode("activation")} style={tab(mode === "activation")}>Activer mon accès</button>
        </div>

        {mode === "activation" && (
          <>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
              Saisis la clé que Boris t&apos;a transmise, puis choisis tes identifiants.
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Clé d&apos;activation</label>
              <input required value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="LBT-XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false}
                style={{ ...inputStyle, fontFamily: "var(--font-ibm-plex-mono), monospace", letterSpacing: 0.5 }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Pseudo <span style={{ opacity: 0.7 }}>— visible dans les classements</span></label>
              <input required value={pseudo} onChange={(e) => setPseudo(e.target.value)} style={inputStyle} />
            </div>
          </>
        )}

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Mot de passe</label>
            {mode === "login" && (
              <Link href="/forgot-password" style={{ fontSize: 11, color: "var(--text-muted)" }}>Oublié ?</Link>
            )}
          </div>
          <input type="password" required minLength={mode === "activation" ? 6 : undefined}
            value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "activation" ? "new-password" : "current-password"} style={inputStyle} />
        </div>

        {mode === "activation" && (
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 16, cursor: "pointer" }}>
            <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 3, accentColor: "var(--accent)" }} />
            <span>
              J&apos;accepte que mes données de suivi (résultats aux exercices, informations de profil)
              soient stockées de façon sécurisée pour mon accompagnement. Je peux en demander la
              suppression à tout moment.
            </span>
          </label>
        )}

        {error && <div style={{ fontSize: 12, color: "var(--erreur)", marginBottom: 12, lineHeight: 1.5 }}>{error}</div>}
        {info && <div style={{ fontSize: 12, color: "var(--accent)", marginBottom: 12, lineHeight: 1.5 }}>{info}</div>}

        <button type="submit" disabled={loading} style={{
          width: "100%", padding: "11px 12px", background: "var(--accent-gradient)", color: "var(--sur-accent)",
          border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}>
          {loading ? "…" : mode === "login" ? "Se connecter" : "Activer mon accès"}
        </button>
      </form>
    </div>
  );
}
