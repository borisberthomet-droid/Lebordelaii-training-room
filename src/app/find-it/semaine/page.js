"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { getMainDeLaSemaine, getMonScore, getSpotLeaderboard, getSpotLock } from "@/lib/supabase/spots";

// La main de la semaine : une vraie main jouée, une vraie range à deviner, UN SEUL essai.
//
// L'essai unique n'est pas une contrainte technique, c'est la règle du jeu : un classement où
// l'on peut retenter jusqu'à tomber juste ne classe plus rien. La page le dit avant de lancer,
// pas après — personne ne doit découvrir la règle en ayant déjà cliqué.
//
// Trois états : pas de main publiée, main à jouer, main déjà jouée. Le troisième affiche le
// score de l'élève et le classement, parce que c'est ce qu'il vient voir en revenant.

const panneau = {
  background: "var(--panel)", border: "1px solid var(--border)",
  borderRadius: 14, padding: 18,
};

function formatSemaine(date) {
  if (!date) return "";
  return new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export default function MainDeLaSemaine() {
  const router = useRouter();
  const [etat, setEtat] = useState("chargement"); // chargement | aucune | jouable | jouee | erreur
  const [spot, setSpot] = useState(null);
  const [mon, setMon] = useState(null);
  const [classement, setClassement] = useState([]);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const main = await getMainDeLaSemaine();
        if (!main) { setEtat("aucune"); return; }
        setSpot(main);

        const [verrou, score, top] = await Promise.all([
          getSpotLock(main.id),
          getMonScore(main.id),
          getSpotLeaderboard(main.id),
        ]);
        setMon(score);
        setClassement(top);
        setEtat(verrou || score ? "jouee" : "jouable");
      } catch (e) {
        setErreur(e.message);
        setEtat("erreur");
      }
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", padding: 20, width: "100%", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo size={24} showWordmark={false} />
          <span className="titre" style={{ fontSize: 21, fontWeight: 700 }}>Main de la semaine</span>
        </div>
        <Link href="/find-it" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Find It</Link>
      </div>

      {etat === "chargement" && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Chargement…</div>
      )}

      {etat === "erreur" && (
        <div style={{ fontSize: 13, color: "var(--erreur)" }}>{erreur}</div>
      )}

      {etat === "aucune" && (
        <div style={panneau}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Pas encore de main</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
            Boris publie une main par semaine. Reviens lundi — en attendant, le{" "}
            <Link href="/find-it/sim" style={{ color: "var(--accent)" }}>Find It sur simulation</Link>{" "}
            tourne sans limite.
          </div>
        </div>
      )}

      {(etat === "jouable" || etat === "jouee") && spot && (
        <>
          <div style={panneau}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
              Semaine du {formatSemaine(spot.semaineDu)}
            </div>
            <div className="titre" style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>{spot.nom}</div>
            {spot.consigne && (
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>{spot.consigne}</div>
            )}

            {etat === "jouable" ? (
              <>
                <div style={{
                  marginTop: 14, padding: "10px 12px", borderRadius: 10, fontSize: 12, lineHeight: 1.7,
                  background: "color-mix(in srgb, var(--attention) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--attention) 35%, transparent)",
                }}>
                  <strong>Un seul essai.</strong> Une fois la main jouée, elle est jouée : le score part
                  au classement et la main ne se rejoue pas. Prends ton temps avant de lancer.
                </div>
                <button
                  onClick={() => router.push(`/play/${spot.id}?from=semaine`)}
                  style={{
                    marginTop: 14, width: "100%", padding: "12px 16px", background: "var(--accent-gradient)",
                    color: "var(--sur-accent)", border: "none", borderRadius: 10, fontWeight: 700,
                    fontSize: 14, cursor: "pointer",
                  }}
                >
                  Jouer la main
                </button>
              </>
            ) : (
              <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ton score</span>
                <span style={{
                  fontSize: 28, fontWeight: 800, color: "var(--accent)",
                  fontFamily: "var(--font-ibm-plex-mono), monospace",
                }}>
                  {mon ? Math.round(mon.score) : "—"}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/ 100</span>
              </div>
            )}
          </div>

          {/* Le classement n'apparaît qu'une fois la main jouée : le nombre de participants et les
              scores des autres sont déjà une information sur la difficulté du spot. */}
          {etat === "jouee" && (
            <div style={{ ...panneau, marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Classement de la semaine</div>
              {classement.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Personne d&apos;autre n&apos;a encore joué.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {classement.map((ligne, i) => (
                    <div key={ligne.pseudo + i} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: "var(--panel-2)", borderRadius: 8, padding: "8px 12px",
                    }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, minWidth: 22,
                        color: i === 0 ? "var(--accent)" : "var(--text-muted)",
                      }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 13 }}>{ligne.pseudo}</span>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        fontFamily: "var(--font-ibm-plex-mono), monospace",
                      }}>{Math.round(ligne.score)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.7 }}>
                Prochaine main lundi. D&apos;ici là, le{" "}
                <Link href="/find-it/sim" style={{ color: "var(--accent)" }}>Find It sur simulation</Link>{" "}
                se joue autant de fois que tu veux.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
