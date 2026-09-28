"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import FicheJoueur from "@/components/carriere/FicheJoueur";
import { Vide } from "@/components/carriere/Blocs";
import { chargerFiche, monCompte } from "@/lib/supabase/carriere";

// Gestion de carrière — la page d'accueil du joueur. Elle ne demande rien, elle montre : axes du
// moment, statistiques en focus, objectifs, semaine, coaching. Tout ce qui se modifie vit dans une
// sous-page, pour que celle-ci reste lisible en une seconde.

const ONGLETS = [
  { href: "/carriere/auto-evaluation", label: "Auto-évaluation" },
  { href: "/carriere/objectifs", label: "Objectifs" },
  { href: "/carriere/semaine", label: "Ma semaine" },
  { href: "/carriere/leak-finder", label: "Leak Finder" },
  { href: "/carriere/coachings", label: "Coachings" },
];

export default function CarrierePage() {
  const [compte, setCompte] = useState(null);
  const [fiche, setFiche] = useState(null);
  const [etat, setEtat] = useState("chargement");   // chargement | pret | horsligne | erreur
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(async () => {
    const c = await monCompte();
    if (!c) { setEtat("horsligne"); return; }
    setCompte(c);
    setFiche(await chargerFiche(c.id));
    setEtat("pret");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await charger();
      } catch (e) { setErreur(e.message); setEtat("erreur"); }
    })();
  }, [charger]);

  const rafraichir = useCallback(async () => {
    if (!compte) return;
    setFiche(await chargerFiche(compte.id));
  }, [compte]);

  return (
    <div style={{ minHeight: "100vh", padding: 24, width: "100%", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div className="titre" style={{ fontSize: 22, fontWeight: 700 }}>Gestion de carrière</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
            {compte ? `${compte.pseudo} — où j'en suis, ce que je travaille, ce que je fais aujourd'hui` : " "}
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {compte?.role === "admin" && (
            <Link href="/admin/joueurs" style={{ fontSize: 12, color: "var(--accent)" }}>Vue coach</Link>
          )}
          <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {ONGLETS.map((o) => (
          <Link key={o.href} href={o.href} style={{
            padding: "7px 14px", borderRadius: 999, fontSize: 12,
            border: "1px solid var(--border)", background: "var(--panel-2)", color: "var(--text)",
          }}>
            {o.label}
          </Link>
        ))}
      </div>

      {etat === "chargement" && <Vide>Chargement…</Vide>}

      {etat === "horsligne" && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, fontSize: 13, lineHeight: 1.7 }}>
          Ta carrière est rattachée à ton compte : connecte-toi pour la voir.{" "}
          <Link href="/login" style={{ color: "var(--accent)" }}>Se connecter</Link>
        </div>
      )}

      {etat === "erreur" && (
        <div style={{ background: "var(--panel)", border: "1px solid rgba(224,100,90,0.35)", borderRadius: 14, padding: 18, fontSize: 13, color: "var(--erreur)", lineHeight: 1.7 }}>
          {erreur}
        </div>
      )}

      {etat === "pret" && fiche && (
        <FicheJoueur fiche={fiche} compte={compte} mode="joueur" onRafraichir={rafraichir} />
      )}
    </div>
  );
}
