"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateAccessCode } from "@/lib/access";

// Gestion des clés d'activation, réservée au coach. Les règles de sécurité sont en base (RLS :
// seul un admin lit et écrit access_keys) ; la vérification de rôle ici ne sert qu'à afficher
// un message clair au lieu d'une liste vide.
//
// Pas d'expiration : une clé reste valable tant qu'elle n'est pas révoquée. Le motif de
// révocation est enregistré pour qu'une fermeture automatique (inactivité, abonnement) puisse
// s'y brancher plus tard sans changer le modèle.

const MONO = "var(--font-ibm-plex-mono), monospace";
const btn = {
  padding: "8px 14px", background: "var(--accent-gradient)", color: "var(--sur-accent)",
  border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer",
};
const small = {
  padding: "5px 10px", background: "var(--panel-2)", color: "var(--text)",
  border: "1px solid var(--border)", borderRadius: 7, fontSize: 11, cursor: "pointer",
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "");

function statusOf(k) {
  if (k.revoked_at) return "revoquee";
  if (k.used_at) return "active";
  return "libre";
}
const STATUS = {
  libre: { label: "Libre", color: "var(--attention)" },
  active: { label: "Active", color: "var(--accent)" },
  revoquee: { label: "Révoquée", color: "var(--erreur)" },
};

export default function AccessKeysAdmin() {
  const [auth, setAuth] = useState("loading");  // loading | ok | denied
  const [keys, setKeys] = useState([]);
  const [pseudos, setPseudos] = useState({});
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState(null);     // dernière clé générée
  const [filter, setFilter] = useState("tout");
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: e } = await supabase.from("access_keys")
      .select("*").order("created_at", { ascending: false });
    if (e) { setError(e.message); return; }
    setKeys(data || []);
    const ids = [...new Set((data || []).map((k) => k.used_by).filter(Boolean))];
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, pseudo").in("id", ids);
      setPseudos(Object.fromEntries((profiles || []).map((p) => [p.id, p.pseudo])));
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setAuth("denied"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profile?.role !== "admin") { setAuth("denied"); return; }
      setAuth("ok");
      await load();
    });
  }, [load]);

  const generate = async () => {
    setError("");
    const supabase = createClient();
    // Collision d'un code sur 60 bits : improbable, mais un second essai ne coûte rien.
    for (let attempt = 0; attempt < 2; attempt++) {
      const code = generateAccessCode();
      const { error: e } = await supabase.from("access_keys").insert({ code, label: label.trim() || null });
      if (!e) { setFresh({ code, label: label.trim() }); setLabel(""); await load(); return; }
      if (e.code !== "23505") { setError(e.message); return; }
    }
    setError("Génération impossible, réessaie.");
  };

  const update = async (id, patch) => {
    setError("");
    const { error: e } = await createClient().from("access_keys").update(patch).eq("id", id);
    if (e) setError(e.message); else await load();
  };

  const copy = async (text, tag) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setError("Copie impossible : sélectionne le texte à la main.");
    }
  };

  const message = (code) =>
    `Ta clé d'accès à la Lebordelaii Training Room : ${code}\n` +
    `Active-la ici : ${window.location.origin}/login?mode=activation`;

  const counts = useMemo(() => {
    const c = { libre: 0, active: 0, revoquee: 0 };
    for (const k of keys) c[statusOf(k)]++;
    return c;
  }, [keys]);
  const shown = keys.filter((k) => filter === "tout" || statusOf(k) === filter);

  if (auth === "loading") return <div style={{ padding: 20, fontSize: 13, color: "var(--text-muted)" }}>Chargement…</div>;
  if (auth === "denied") {
    return (
      <div style={{ padding: 20, width: "100%", maxWidth: 900, margin: "0 auto", fontSize: 13 }}>
        Page réservée au coach. <Link href="/" style={{ color: "var(--accent)" }}>← Accueil</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 20, width: "100%", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <span className="titre" style={{ fontSize: 21, fontWeight: 700 }}>Clés d&apos;accès</span>
        <div style={{ display: "flex", gap: 14 }}>
          <Link href="/compte" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Mon compte</Link>
          <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>Accueil</Link>
        </div>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Nouvelle clé</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
          Une clé = un élève. Elle ne sert qu&apos;une fois, n&apos;expire pas, et tu peux la révoquer à tout moment :
          l&apos;élève perd l&apos;accès dès sa page suivante.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Pour qui ? (ex. Thibault — coaching MTT)"
            onKeyDown={(e) => { if (e.key === "Enter") generate(); }}
            style={{
              flex: "1 1 260px", background: "var(--panel-2)", border: "1px solid var(--border)",
              color: "var(--text)", borderRadius: 8, padding: "8px 10px", fontSize: 13,
            }} />
          <button onClick={generate} style={btn}>Générer une clé</button>
        </div>

        {fresh && (
          <div style={{ marginTop: 14, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
              Clé créée{fresh.label ? ` pour ${fresh.label}` : ""}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: MONO, letterSpacing: 1, marginBottom: 10, wordBreak: "break-all" }}>
              {fresh.code}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => copy(fresh.code, "code")} style={small}>{copied === "code" ? "Copiée" : "Copier la clé"}</button>
              <button onClick={() => copy(message(fresh.code), "msg")} style={small}>
                {copied === "msg" ? "Copié" : "Copier le message pour l'élève"}
              </button>
            </div>
          </div>
        )}
        {error && <div style={{ marginTop: 10, fontSize: 12, color: "var(--erreur)" }}>{error}</div>}
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {[["tout", `Toutes ${keys.length}`], ["active", `Actives ${counts.active}`], ["libre", `Libres ${counts.libre}`], ["revoquee", `Révoquées ${counts.revoquee}`]].map(([id, text]) => (
            <button key={id} onClick={() => setFilter(id)} style={{
              ...small, borderRadius: 999,
              border: `1px solid ${filter === id ? "var(--accent)" : "var(--border)"}`,
              color: filter === id ? "var(--accent)" : "var(--text-muted)", fontWeight: filter === id ? 700 : 400,
            }}>{text}</button>
          ))}
        </div>

        {shown.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucune clé.</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shown.map((k) => {
            const s = statusOf(k);
            return (
              <div key={k.id} style={{
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                background: "var(--panel-2)", borderRadius: 10, padding: "10px 12px",
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUS[s].color, minWidth: 70 }}>{STATUS[s].label}</span>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{k.label || <span style={{ color: "var(--text-muted)" }}>Sans nom</span>}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
                    {s === "libre" && `Créée le ${fmtDate(k.created_at)}, pas encore activée`}
                    {k.used_at && <>Activée le {fmtDate(k.used_at)} par <span style={{ color: "var(--text)" }}>{pseudos[k.used_by] || "compte supprimé"}</span>{k.used_email ? ` (${k.used_email})` : ""}</>}
                    {k.revoked_at && <> · révoquée le {fmtDate(k.revoked_at)}{k.revoked_reason ? ` (${k.revoked_reason})` : ""}</>}
                  </div>
                </div>
                <button onClick={() => copy(k.code, k.id)} title="Copier la clé" style={{ ...small, fontFamily: MONO }}>
                  {copied === k.id ? "Copiée" : k.code}
                </button>
                {k.revoked_at
                  ? <button onClick={() => update(k.id, { revoked_at: null, revoked_reason: null })} style={small}>Réactiver</button>
                  : <button onClick={() => update(k.id, { revoked_at: new Date().toISOString(), revoked_reason: "manuel" })}
                      style={{ ...small, color: "var(--erreur)" }}>Révoquer</button>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
