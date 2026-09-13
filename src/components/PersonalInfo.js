"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyAccount, updatePseudo, saveMyPrivate } from "@/lib/supabase/profile";

// Informations personnelles. Rien n'est conservé dans le navigateur, contrairement à la
// progression : une adresse ou un téléphone n'ont rien à faire dans un localStorage. Sans
// session ou sans base, on le dit et on n'affiche pas de formulaire trompeur.

const CHAMPS = [
  { id: "discord", label: "Pseudo Discord", placeholder: "lebordelaii#0000", aide: "pour les sessions de coaching" },
  { id: "rooms", label: "Pseudos sur les rooms", placeholder: "Winamax : nutsR · Stars : …", aide: "pour retrouver tes mains" },
  { id: "abi", label: "Buy-in moyen", placeholder: "50 €", aide: "sert à calibrer les spots travaillés" },
  { id: "formats", label: "Formats joués", placeholder: "MTT, PKO, Spins", aide: null },
  { id: "objectif", label: "Objectif de la saison", placeholder: "passer les 100 € d'ABI", aide: null, long: true },
  { id: "dispos", label: "Disponibilités", placeholder: "Europe/Paris — soirs en semaine", aide: "fuseau et créneaux" },
  { id: "telephone", label: "Téléphone", placeholder: "06 12 34 56 78", aide: null },
  { id: "adresse", label: "Adresse", placeholder: "12 rue…, 33000 Bordeaux", aide: "facturation", long: true },
];

const input = {
  width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", fontSize: 13,
};

export default function PersonalInfo() {
  const [compte, setCompte] = useState(null);
  const [valeurs, setValeurs] = useState({});
  const [pseudo, setPseudo] = useState("");
  const [etat, setEtat] = useState("chargement");   // chargement | pret | horsligne
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    getMyAccount()
      .then((c) => {
        if (!c) { setEtat("horsligne"); return; }
        setCompte(c);
        setPseudo(c.pseudo);
        setValeurs(Object.fromEntries(CHAMPS.map((f) => [f.id, c.prive?.[f.id] || ""])));
        setEtat("pret");
      })
      .catch(() => setEtat("horsligne"));
  }, []);

  const enregistrer = async () => {
    setEnCours(true); setMessage(null);
    try {
      if (pseudo.trim() && pseudo.trim() !== compte.pseudo) await updatePseudo(pseudo.trim());
      await saveMyPrivate(valeurs);
      setCompte((c) => ({ ...c, pseudo: pseudo.trim() || c.pseudo }));
      setMessage({ ok: true, texte: "Enregistré." });
    } catch (e) {
      setMessage({ ok: false, texte: e.message || "Enregistrement impossible." });
    } finally {
      setEnCours(false);
    }
  };

  if (etat === "chargement") {
    return <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Chargement…</div>;
  }
  if (etat === "horsligne") {
    return (
      <div style={{
        background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14,
        padding: 18, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7,
      }}>
        Tes informations personnelles ne sont lisibles qu&apos;une fois connecté, et elles ne sont
        jamais gardées sur cet appareil.{" "}
        <Link href="/login" style={{ color: "var(--accent)" }}>Se connecter</Link>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            Pseudo <span style={{ opacity: 0.7 }}>— visible dans les classements</span>
          </label>
          <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} style={input} />
        </div>

        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            Email <span style={{ opacity: 0.7 }}>— sert à te connecter</span>
          </label>
          <input value={compte.email || ""} readOnly style={{ ...input, opacity: 0.6, cursor: "not-allowed" }} />
        </div>

        {CHAMPS.map((f) => (
          <div key={f.id} style={f.long ? { gridColumn: "1 / -1" } : undefined}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              {f.label}{f.aide && <span style={{ opacity: 0.7 }}> — {f.aide}</span>}
            </label>
            <input
              value={valeurs[f.id] || ""} placeholder={f.placeholder}
              onChange={(e) => setValeurs((v) => ({ ...v, [f.id]: e.target.value }))}
              style={input}
            />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={enregistrer} disabled={enCours} style={{
          padding: "9px 18px", background: "var(--accent-gradient)", color: "#0B1210",
          border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13,
          cursor: enCours ? "default" : "pointer", opacity: enCours ? 0.6 : 1,
        }}>
          {enCours ? "…" : "Enregistrer"}
        </button>
        {message && (
          <span style={{ fontSize: 12, color: message.ok ? "var(--accent)" : "#E0645A" }}>{message.texte}</span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)" }}>
          Seul toi — et ton coach — voyez ces informations.
        </span>
      </div>
    </div>
  );
}
