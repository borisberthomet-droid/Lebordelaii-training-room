"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteLogo from "@/components/SiteLogo";
import LogoutButton from "../logout-button";
import { createClient } from "@/lib/supabase/client";
import { ACTIVATION_MESSAGES, normalizeCode } from "@/lib/access";

// Page de ceux qui sont connectés mais sans accès actif : compte créé avant les clés, accès
// révoqué, ou durée arrivée à son terme. Le proxy les y envoie pour toute autre page.
//
// Les trois cas ne se racontent pas pareil. « Ton accès a été désactivé » à quelqu'un dont
// l'abonnement s'est simplement terminé, c'est l'inquiéter pour rien ; l'inverse, lui laisser
// croire à une fin normale alors que le coach a coupé, c'est lui mentir.

const inputStyle = {
  width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "9px 10px", fontSize: 13,
  fontFamily: "var(--font-ibm-plex-mono), monospace", letterSpacing: 0.5,
};

export default function AccessPage() {
  const router = useRouter();
  const [state, setState] = useState(null);     // 'actif' | 'expire' | 'revoque' | 'aucun'
  const [echeance, setEcheance] = useState(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([supabase.auth.getUser(), supabase.rpc("mon_acces")])
      .then(([{ data: { user } }, { data }]) => {
        setEmail(user?.email || "");
        setState(data?.etat || "aucun");
        setEcheance(data?.expire_le || null);
      })
      .catch(() => setState("aucun"));
  }, []);

  const redeem = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const supabase = createClient();
      const { data: status, error: rpcError } = await supabase.rpc("redeem_access_key", {
        p_code: normalizeCode(code), p_consent: consent,
      });
      if (rpcError) { setError("Impossible de vérifier la clé pour le moment."); return; }
      if (status !== "ok") { setError(ACTIVATION_MESSAGES[status] || "Clé refusée."); return; }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={redeem} style={{
        width: "100%", maxWidth: 380, background: "var(--panel)",
        border: "1px solid var(--border)", borderRadius: 16, padding: 28,
      }}>
        <div style={{ marginBottom: 18 }}><SiteLogo size={20} /></div>

        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          {state === "revoque" ? "Ton accès a été désactivé"
            : state === "expire" ? "Ton accès est arrivé à échéance"
              : "Ton accès n'est pas encore actif"}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 16 }}>
          {state === "actif"
            ? "Ton accès est actif."
            : state === "expire"
              ? `Ta période d'accès s'est terminée${echeance ? " le " + new Date(echeance).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""}. Écris à Boris pour la prolonger : tes résultats et ton suivi sont conservés, tu les retrouveras intacts.`
              : state === "revoque"
                ? "Pour le réactiver, demande une nouvelle clé à Boris et saisis-la ci-dessous."
                : "Saisis la clé d'activation que Boris t'a transmise."}
          {email && <> Connecté en tant que <span style={{ color: "var(--text)" }}>{email}</span>.</>}
        </div>

        {state === "actif" ? (
          <button type="button" onClick={() => { router.push("/"); router.refresh(); }} style={{
            width: "100%", padding: "11px 12px", background: "var(--accent-gradient)", color: "var(--sur-accent)",
            border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>
            Aller à l&apos;accueil
          </button>
        ) : (
          <>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Clé d&apos;activation</label>
            <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="LBT-XXXX-XXXX-XXXX"
              autoComplete="off" spellCheck={false} style={{ ...inputStyle, marginBottom: 14 }} />

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 16, cursor: "pointer" }}>
              <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: 3, accentColor: "var(--accent)" }} />
              <span>
                J&apos;accepte que mes données de suivi (résultats aux exercices, informations de profil)
                soient stockées de façon sécurisée pour mon accompagnement. Je peux en demander la
                suppression à tout moment.
              </span>
            </label>

            {error && <div style={{ fontSize: 12, color: "var(--erreur)", marginBottom: 12, lineHeight: 1.5 }}>{error}</div>}

            <button type="submit" disabled={loading || state === null} style={{
              width: "100%", padding: "11px 12px", background: "var(--accent-gradient)", color: "var(--sur-accent)",
              border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
              cursor: loading ? "default" : "pointer", opacity: loading || state === null ? 0.6 : 1,
            }}>
              {loading ? "…" : "Activer mon accès"}
            </button>
          </>
        )}

        <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
          <LogoutButton />
        </div>
      </form>
    </div>
  );
}
