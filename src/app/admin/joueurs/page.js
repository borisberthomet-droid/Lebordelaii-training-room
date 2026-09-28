"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Carte, MONO, Pastille, Vide, btnFantome, champ } from "@/components/carriere/Blocs";
import { listerJoueurs, monCompte } from "@/lib/supabase/carriere";

// Vue coach : une ligne par joueur, et rien d'autre. C'est un tableau de suivi administratif —
// combien de coachings, combien d'heures, qui doit payer, quel pack expire. Les axes de travail et
// le taux d'accomplissement ne sont PAS ici : ils sont dans la fiche, à un clic.

// Un joueur est actif s'il a été coaché dans les trois derniers mois ou s'il a une séance prévue.
const JOURS_ACTIF = 90;

function estActif(j) {
  if (j.prochain) return true;
  if (!j.dernier) return false;
  return (Date.now() - new Date(j.dernier)) / 86400000 <= JOURS_ACTIF;
}

function dateCourte(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const th = { padding: "8px 10px", fontWeight: 500, textAlign: "left", whiteSpace: "nowrap" };
const td = { padding: "8px 10px", whiteSpace: "nowrap" };

export default function JoueursPage() {
  const router = useRouter();
  const [joueurs, setJoueurs] = useState([]);
  const [etat, setEtat] = useState("chargement");   // chargement | pret | refuse | erreur
  const [erreur, setErreur] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("actifs");   // actifs | tous | impayes | packs

  useEffect(() => {
    (async () => {
      try {
        const c = await monCompte();
        if (!c) { setEtat("refuse"); return; }
        if (c.role !== "admin") { setEtat("refuse"); return; }
        setJoueurs(await listerJoueurs());
        setEtat("pret");
      } catch (e) { setErreur(e.message); setEtat("erreur"); }
    })();
  }, []);

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return joueurs
      .filter((j) => j.role !== "admin" || j.nbCoachings > 0)
      .filter((j) => (q ? (j.pseudo || "").toLowerCase().includes(q) : true))
      .filter((j) => {
        if (filtre === "tous") return true;
        if (filtre === "actifs") return estActif(j);
        if (filtre === "impayes") return j.impayes > 0;
        if (filtre === "packs") return !!j.pack;
        return true;
      })
      .sort((a, b) => (a.pseudo || "").localeCompare(b.pseudo || "", "fr"));
  }, [joueurs, recherche, filtre]);

  return (
    <div style={{ minHeight: "100vh", padding: 24, width: "100%", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div className="titre" style={{ fontSize: 22, fontWeight: 700 }}>Mes joueurs</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
            Suivi coaching et administratif. Clique une ligne pour ouvrir la fiche complète.
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Link href="/admin" style={{ fontSize: 12, color: "var(--text-muted)" }}>Admin spots</Link>
          <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
        </div>
      </div>

      {etat === "chargement" && <Vide>Chargement…</Vide>}
      {etat === "refuse" && (
        <Vide>Cette page est réservée au coach. <Link href="/login" style={{ color: "var(--accent)" }}>Se connecter</Link></Vide>
      )}
      {erreur && <div style={{ fontSize: 13, color: "var(--erreur)", marginBottom: 14 }}>{erreur}</div>}

      {etat === "pret" && (
        <Carte>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher un joueur"
              style={{ ...champ, maxWidth: 240, fontSize: 12, padding: "7px 9px" }} />
            {[["actifs", "Actifs"], ["tous", "Tous"], ["impayes", "Impayés"], ["packs", "Avec pack"]].map(([id, label]) => (
              <button key={id} onClick={() => setFiltre(id)} style={{
                padding: "6px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer",
                border: `1px solid ${filtre === id ? "var(--accent)" : "var(--border)"}`,
                background: filtre === id ? "rgba(52,211,153,0.14)" : "var(--panel-2)",
                color: filtre === id ? "var(--accent)" : "var(--text-muted)",
              }}>{label}</button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
              {lignes.length} joueur{lignes.length > 1 ? "s" : ""}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  <th style={th}>Joueur</th>
                  <th style={th}>Statut</th>
                  <th style={th}>Coachings</th>
                  <th style={th}>Heures</th>
                  <th style={th}>Dernier</th>
                  <th style={th}>Prochain</th>
                  <th style={th}>Formule</th>
                  <th style={th}>Restant</th>
                  <th style={th}>Expire</th>
                  <th style={th}>Paiement</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((j) => {
                  const actif = estActif(j);
                  return (
                    <tr key={j.id}
                      onClick={() => router.push(`/admin/joueurs/${j.id}`)}
                      style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}>
                      <td style={{ ...td, fontWeight: 600 }}>{j.pseudo}</td>
                      <td style={td}>
                        <Pastille couleur={actif ? "var(--accent)" : "var(--text-muted)"}>{actif ? "actif" : "inactif"}</Pastille>
                      </td>
                      <td style={{ ...td, fontFamily: MONO }}>{j.nbCoachings}</td>
                      <td style={{ ...td, fontFamily: MONO }}>{j.heures} h</td>
                      <td style={{ ...td, fontFamily: MONO }}>{dateCourte(j.dernier)}</td>
                      <td style={{ ...td, fontFamily: MONO, color: j.prochain ? "var(--accent)" : "var(--text-muted)" }}>
                        {dateCourte(j.prochain)}
                      </td>
                      <td style={td}>{j.pack ? "pack" : j.nbCoachings ? "unité" : "—"}</td>
                      <td style={{ ...td, fontFamily: MONO }}>{j.pack ? `${j.pack.etat.restantes} h` : "—"}</td>
                      <td style={{ ...td, fontFamily: MONO, color: j.pack?.etat.expire_bientot ? "var(--attention)" : undefined }}>
                        {j.pack?.etat.expire ? dateCourte(j.pack.etat.expire) : "—"}
                      </td>
                      <td style={td}>
                        {j.impayes > 0
                          ? <Pastille couleur="var(--attention)">{j.impayes} à payer</Pastille>
                          : <span style={{ color: "var(--text-muted)" }}>à jour</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!lignes.length && (
            <div style={{ marginTop: 14 }}>
              <Vide>Aucun joueur ne correspond. <button style={btnFantome} onClick={() => { setFiltre("tous"); setRecherche(""); }}>Tout afficher</button></Vide>
            </div>
          )}
        </Carte>
      )}
    </div>
  );
}
