"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import FicheJoueur from "@/components/carriere/FicheJoueur";
import {
  PanneauAxes, PanneauCoachings, PanneauLeak, PanneauMental, PanneauPrestations,
} from "@/components/carriere/PanneauxCoach";
import { Carte, MONO, Vide } from "@/components/carriere/Blocs";
import { chargerFiche, lienCapture, listerCaptures, monCompte } from "@/lib/supabase/carriere";
import { createClient } from "@/lib/supabase/client";

// La fiche d'un joueur, vue du coach. En haut ce que le joueur voit lui-même — c'est ce qu'on veut
// relire avant une séance : où il en est, ce qu'il travaille, ce qu'il a fait cette semaine. En
// dessous, les commandes du coach.

const CHAMPS_FICHE = [
  ["prenom", "Prénom"], ["nom", "Nom"], ["discord", "Discord"], ["rooms", "Pseudos rooms"],
  ["abi", "ABI"], ["formats", "Formats"], ["telephone", "Téléphone"], ["adresse", "Adresse"],
  ["dispos", "Disponibilités"],
];

export default function FicheCoachPage() {
  const params = useParams();
  const userId = params?.id;
  const [compte, setCompte] = useState(null);
  const [joueur, setJoueur] = useState(null);
  const [fiche, setFiche] = useState(null);
  const [captures, setCaptures] = useState([]);
  const [liens, setLiens] = useState({});
  const [etat, setEtat] = useState("chargement");
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(async (id) => {
    const f = await chargerFiche(id);
    const caps = await listerCaptures(id);
    const paires = await Promise.all(caps.map(async (c) => [c.id, await lienCapture(c.chemin)]));
    setFiche(f);
    setCaptures(caps);
    setLiens(Object.fromEntries(paires));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const c = await monCompte();
        if (!c || c.role !== "admin") { setEtat("refuse"); return; }
        setCompte(c);
        const { data } = await createClient()
          .from("profiles").select("id, pseudo, created_at").eq("id", userId).maybeSingle();
        setJoueur(data);
        await charger(userId);
        setEtat("pret");
      } catch (e) { setErreur(e.message); setEtat("erreur"); }
    })();
  }, [userId, charger]);

  const rafraichir = useCallback(() => charger(userId), [charger, userId]);

  return (
    <div style={{ minHeight: "100vh", padding: 24, width: "100%", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div className="titre" style={{ fontSize: 22, fontWeight: 700 }}>
            {joueur?.pseudo || "Fiche joueur"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
            Ce qu&apos;on a travaillé, où il en est, la prochaine étape.
          </div>
        </div>
        <Link href="/admin/joueurs" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Mes joueurs</Link>
      </div>

      {etat === "chargement" && <Vide>Chargement…</Vide>}
      {etat === "refuse" && <Vide>Cette page est réservée au coach.</Vide>}
      {erreur && <div style={{ fontSize: 13, color: "var(--erreur)", marginBottom: 14 }}>{erreur}</div>}

      {etat === "pret" && fiche && (
        <div style={{ display: "grid", gap: 14 }}>
          <Carte titre="Coordonnées">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, fontSize: 12 }}>
              {CHAMPS_FICHE.map(([cle, label]) => (
                <div key={cle}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</div>
                  <div style={{ fontFamily: MONO }}>{fiche.prive?.[cle] || "—"}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 10 }}>
              Ces informations sont saisies par le joueur dans son compte.
            </div>
          </Carte>

          <FicheJoueur fiche={fiche} compte={compte} mode="coach" onRafraichir={rafraichir} />

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "grid", gap: 14 }}>
            {/* Raccourcis : la fiche est longue, et le Leak Finder est ce qu'on ouvre le plus
                souvent avant une séance. */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Commandes du coach</span>
              {[["axes", "Axes"], ["leak", "Leak Finder"], ["coachings", "Coachings et packs"]].map(([ancre, label]) => (
                <a key={ancre} href={`#${ancre}`} style={{
                  fontSize: 12, color: "var(--accent)", border: "1px solid var(--border)",
                  borderRadius: 999, padding: "4px 12px",
                }}>{label}</a>
              ))}
            </div>
            <div id="prestations"><PanneauPrestations fiche={fiche} coachId={compte.id} onRafraichir={rafraichir} /></div>
            <div id="mental"><PanneauMental fiche={fiche} /></div>
            <div id="axes"><PanneauAxes fiche={fiche} coachId={compte.id} onRafraichir={rafraichir} /></div>
            <div id="leak">
              <PanneauLeak fiche={fiche} coachId={compte.id} captures={captures} liens={liens} onRafraichir={rafraichir} />
            </div>
            <div id="coachings" style={{ display: "grid", gap: 14 }}>
              <PanneauCoachings fiche={fiche} coachId={compte.id} onRafraichir={rafraichir} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
