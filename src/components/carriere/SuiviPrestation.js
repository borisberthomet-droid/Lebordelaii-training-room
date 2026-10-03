"use client";

import { MONO } from "./Blocs";
import {
  dateEtape, etapesDe, etapesFranchies, libelleType, PAIEMENTS, progression,
} from "@/lib/carriere/prestations";

// Le suivi d'une prestation, façon suivi de colis : une colonne d'étapes, celles qui sont
// franchies portent leur date, la suivante est mise en avant, les autres attendent.
//
// Le même composant sert au coach et à l'élève. Il n'affiche rien d'autre que ce qui est dans la
// prestation : les boutons d'avancement vivent dans le panneau du coach, ici tout est en lecture.
// C'est ce qui garantit qu'ils voient exactement la même chose — le coach ne peut pas annoncer un
// avancement que l'élève ne verrait pas.

const fmt = (iso) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "";

function Montant({ prestation }) {
  if (prestation.montant == null) return null;
  const p = PAIEMENTS[prestation.paiement] || PAIEMENTS.attendu;
  return (
    <span style={{ fontSize: 12, fontFamily: MONO, color: p.couleur, whiteSpace: "nowrap" }}>
      {Number(prestation.montant).toLocaleString("fr-FR")} € · {p.label}
    </span>
  );
}

export default function SuiviPrestation({ prestation, titre = true }) {
  const etapes = etapesDe(prestation);
  const franchies = etapesFranchies(prestation);
  const annulee = prestation.statut === "annulee";
  const pct = Math.round(progression(prestation) * 100);

  return (
    <div style={{ opacity: annulee ? 0.5 : 1 }}>
      {titre && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {libelleType(prestation)}
            {annulee && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> — annulée</span>}
          </span>
          <Montant prestation={prestation} />
        </div>
      )}

      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: MONO, marginBottom: 8 }}>
        {franchies} / {etapes.length} · {pct} %
      </div>

      <div style={{ display: "grid", gap: 0 }}>
        {etapes.map((e, i) => {
          const numero = i + 1;
          const faite = numero <= franchies;
          const courante = numero === franchies + 1 && !annulee;
          const dernier = i === etapes.length - 1;
          const couleur = faite ? "var(--accent)" : courante ? "var(--attention)" : "var(--border)";

          return (
            <div key={numero} style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
              {/* La pastille et le trait qui la relie à la suivante : c'est le trait qui fait
                  lire la colonne comme un trajet plutôt que comme une liste à cocher. */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: "50%", flexShrink: 0, marginTop: 3,
                  background: faite ? "var(--accent)" : "transparent",
                  border: `2px solid ${couleur}`,
                  boxShadow: courante ? "0 0 0 3px color-mix(in srgb, var(--attention) 25%, transparent)" : "none",
                }} />
                {!dernier && (
                  <div style={{
                    flex: 1, width: 2, minHeight: 22, marginTop: 2,
                    background: numero < franchies ? "var(--accent)" : "var(--border)",
                  }} />
                )}
              </div>

              <div style={{ paddingBottom: dernier ? 0 : 12, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 12.5,
                    fontWeight: faite || courante ? 700 : 400,
                    color: faite ? "var(--text)" : courante ? "var(--attention)" : "var(--text-muted)",
                  }}>{e.titre}</span>
                  {faite && (
                    <span style={{ fontSize: 11, fontFamily: MONO, color: "var(--text-muted)" }}>
                      {fmt(dateEtape(prestation, numero))}
                    </span>
                  )}
                  {courante && (
                    <span style={{ fontSize: 10, color: "var(--attention)", fontWeight: 700, letterSpacing: 0.3 }}>
                      EN COURS
                    </span>
                  )}
                </div>
                {e.detail && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 2 }}>{e.detail}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {prestation.note && (
        <div style={{
          marginTop: 12, padding: "9px 11px", borderRadius: 9, fontSize: 12, lineHeight: 1.6,
          background: "var(--panel-2)", color: "var(--text)",
        }}>
          {prestation.note}
        </div>
      )}
    </div>
  );
}
