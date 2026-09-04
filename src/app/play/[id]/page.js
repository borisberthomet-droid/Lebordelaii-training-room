"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getRandomAvailableSpot, getSpot, getSpotLock, insertAttempt, setSpotLock } from "@/lib/supabase/spots";
import { ACCENT } from "@/lib/poker/constants";
import { comboKey } from "@/lib/poker/combos";
import { drawRandomHand, drawWeightedCombo, drawWeightedHand, scoreAttempt, knownCards, parseBoardCards } from "@/lib/poker/scoring";
import { decomposeBuyIn } from "@/lib/poker/hhParser";
import RangeGrid from "@/components/RangeGrid";
import MiniCard from "@/components/MiniCard";
import Replayer from "@/components/Replayer";

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function getResultMessage(found, score) {
  if (!found) return { emoji: "💀", text: "Raté ! Le combo de vilain n'était pas dans ta sélection." };
  if (score >= 90) return { emoji: "🎯", text: "Lecture chirurgicale !" };
  if (score >= 70) return { emoji: "🔥", text: "Très solide !" };
  if (score >= 40) return { emoji: "👍", text: "Bien joué, range plutôt précise." };
  if (score >= 15) return { emoji: "🎣", text: "Trouvé... mais en ratissant large." };
  return { emoji: "😅", text: "Trouvé de justesse, noyé dans une sélection énorme." };
}

export default function PlaySpotPage() {
  const { id } = useParams();
  const router = useRouter();

  const [state, setState] = useState("loading"); // loading | locked | error | ready
  const [errorMsg, setErrorMsg] = useState("");
  const [spot, setSpot] = useState(null);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [nextLoading, setNextLoading] = useState(false);

  const [heroCards, setHeroCards] = useState([]);
  const [villainKey, setVillainKey] = useState(null);
  const [playWeights, setPlayWeights] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [showLobby, setShowLobby] = useState(false);
  const [studentAnswer, setStudentAnswer] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await getSpot(id);
        setSpot(loaded);

        if (loaded.mode === "exploit") {
          const lock = await getSpotLock(loaded.id);
          if (lock && Date.now() - lock < 30 * 24 * 3600 * 1000) {
            setLockedUntil(lock);
            setState("locked");
            return;
          }
        }

        // Les cartes du board sont retirees des DEUX tirages : sans ca, Hero pouvait recevoir
        // une carte posee sur le tapis, et le combo du vilain a trouver pouvait en contenir une
        // — donc etre introuvable puisque la grille le grise.
        const boardCards = parseBoardCards(loaded.board);
        const hero = loaded.mode === "exploit"
          ? [loaded.heroCombo.slice(0, 2), loaded.heroCombo.slice(2, 4)]
          : (loaded.heroWeights && Object.values(loaded.heroWeights).some((w) => w > 0)
              ? drawWeightedHand(loaded.heroWeights, boardCards)
              : drawRandomHand(boardCards));
        const villain = loaded.mode === "exploit"
          ? (loaded.villainCombo.length === 4 ? comboKey([loaded.villainCombo.slice(0, 2), loaded.villainCombo.slice(2, 4)]) : loaded.villainCombo)
          : drawWeightedCombo(loaded.weights, knownCards(hero, loaded.board));

        setHeroCards(hero);
        setVillainKey(villain);
        setTimeLeft(loaded.timer);
        setRunning(true);
        setState("ready");
      } catch (e) {
        setErrorMsg(e.message);
        setState("error");
      }
    })();
  }, [id]);

  const submit = async () => {
    setRunning(false);
    if (!spot || !villainKey) return;
    const selected = Object.entries(playWeights).filter(([, v]) => v > 0).map(([k]) => k);
    const { found, score } = scoreAttempt(selected, spot.weights, villainKey);
    const referenceValues = Object.values(spot.weights).filter((w) => w > 0);
    const referenceCount = referenceValues.length;
    const referenceWeighted = referenceValues.reduce((sum, w) => sum + w, 0);
    setReveal({ found, score, villainKey, selectedCount: selected.length, referenceCount, referenceWeighted });
    if (spot.mode === "exploit") await setSpotLock(spot.id);
    try {
      await insertAttempt({ spotId: spot.id, score, found, selectedCount: selected.length, referenceCount });
    } catch (e) {
      console.error("Impossible d'enregistrer la tentative", e);
    }
  };

  const goToNext = async () => {
    setNextLoading(true);
    try {
      const next = await getRandomAvailableSpot(spot?.id);
      if (next) router.push(`/play/${next.id}?from=train`);
      else router.push("/train");
    } finally {
      setNextLoading(false);
    }
  };

  useEffect(() => {
    if (!running) return;
    if (timeLeft <= 0) {
      const t = setTimeout(() => submit(), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, timeLeft]);

  if (state === "loading") {
    return <div style={{ padding: 20, fontSize: 13, color: "var(--text-muted)" }}>Chargement…</div>;
  }
  if (state === "error") {
    return (
      <div style={{ padding: 20, fontSize: 13, color: "#E0645A" }}>
        {errorMsg} — <Link href="/train" style={{ color: "var(--accent)" }}>essayer un autre spot</Link>
      </div>
    );
  }
  if (state === "locked") {
    return (
      <div style={{ padding: 20, maxWidth: 480 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{spot.nom}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Ce spot exploit a déjà été joué. Il sera de nouveau disponible le{" "}
          <span style={{ color: ACCENT }}>{new Date(lockedUntil + 30 * 24 * 3600 * 1000).toLocaleDateString("fr-FR")}</span>.
        </div>
        <button onClick={goToNext} disabled={nextLoading} style={{ display: "inline-block", marginTop: 16, padding: "8px 16px", background: "var(--accent-gradient)", color: "#0B1210", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, opacity: nextLoading ? 0.6 : 1 }}>
          {nextLoading ? "…" : "Spot suivant"}
        </button>
      </div>
    );
  }

  const buyInInfo = decomposeBuyIn(spot.buyIn, spot.seats);

  return (
    <div style={{ padding: 20, maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{spot.nom}</div>
        <div style={{ fontFamily: "var(--font-ibm-plex-mono), monospace", fontSize: 22, color: timeLeft <= 5 ? "#C4544A" : ACCENT }}>
          {fmtTime(timeLeft)}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, fontSize: 12, flexWrap: "wrap" }}>
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px" }}>
          KO: <span style={{ color: ACCENT, fontFamily: "var(--font-ibm-plex-mono), monospace" }}>{spot.koValue || "—"}</span>
        </div>
        <div onMouseEnter={() => setShowLobby(true)} onMouseLeave={() => setShowLobby(false)}
          style={{ position: "relative", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
          Lobby
          {showLobby && (
            <div style={{ position: "absolute", top: "110%", left: 0, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: 10, width: 230, zIndex: 30, fontSize: 11, fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
              {buyInInfo ? <div>Buy-in: {buyInInfo.total}€ ({buyInInfo.parts.map((p) => `${p}€`).join(" + ")})</div> : <div>Buy-in: {spot.buyIn || "—"}</div>}
              <div>Format: {spot.format || "—"}</div>
              <div>Starting stack: {spot.startingStack || "—"}</div>
              <div>Palier: {spot.palier || "—"}</div>
              <div>Inscrits: {spot.nbInscrits || "—"}</div>
            </div>
          )}
        </div>
      </div>

      <Replayer spot={spot} heroCardsOverride={heroCards} />

      {!reveal ? (
        <>
          {spot.villainInfo && spot.villainInfo.trim() && (
            <div style={{ marginBottom: 14, background: "var(--panel)", border: "1px solid #E0645A", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 12, color: "#E0645A", fontWeight: 700, marginBottom: 4 }}>🕵️ Sur l&apos;adversaire</div>
              <div style={{ fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{spot.villainInfo}</div>
            </div>
          )}
          <div style={{ marginBottom: 14, background: "var(--panel)", border: `1px solid ${ACCENT}`, borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 12, color: ACCENT, fontWeight: 700, marginBottom: 4 }}>🎯 Ta mission</div>
            {spot.consigne && spot.consigne.trim() && (
              <div style={{ fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.5, marginBottom: 6 }}>{spot.consigne}</div>
            )}
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", lineHeight: 1.5 }}>
              Plus ta sélection est étroite, plus tu marques de points — mais attention, si le bon combo n&apos;y est pas, tu repars à 0. Vise juste, pas large.
            </div>
          </div>
          <RangeGrid comboWeights={playWeights} setComboWeights={setPlayWeights} mode="play" excludedCards={knownCards(heroCards, spot.board)} />
          {spot.question && spot.question.trim() && (
            <div style={{ marginTop: 14, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 8 }}>🤔 {spot.question}</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[["oui", "Oui"], ["non", "Non"]].map(([v, label]) => (
                  <button key={v} onClick={() => setStudentAnswer(v)} style={{
                    padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    border: `1px solid ${studentAnswer === v ? ACCENT : "var(--border)"}`,
                    background: studentAnswer === v ? ACCENT : "var(--panel-2)",
                    color: studentAnswer === v ? "#0B1210" : "var(--text)",
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={submit} style={{ marginTop: 14, padding: "10px 20px", background: "var(--accent-gradient)", color: "#0B1210", border: "none", borderRadius: 8, fontWeight: 700 }}>
            Valider
          </button>
        </>
      ) : (
        <>
          <RangeGrid comboWeights={playWeights} setComboWeights={() => {}} mode="reveal"
            resultReveal={{ villainKey: reveal.villainKey, found: reveal.found }} excludedCards={knownCards(heroCards, spot.board)} />
          {(() => {
            const msg = getResultMessage(reveal.found, reveal.score);
            return (
              <div style={{ marginTop: 14, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>{msg.emoji}</span>
                <span style={{ color: reveal.found ? "#6FCF97" : "#C4544A" }}>{msg.text}</span>
              </div>
            );
          })()}
          <div style={{ marginTop: 8, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: reveal.found ? "#6FCF97" : "#C4544A", fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
              {reveal.score} pts
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              Combo vilain :
              <MiniCard card={reveal.villainKey.slice(0, 2)} />
              <MiniCard card={reveal.villainKey.slice(2, 4)} />
            </div>
          </div>
          {spot.question && spot.question.trim() && (
            <div style={{ marginTop: 12, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 6 }}>🤔 {spot.question}</div>
              <div style={{ fontSize: 12, marginBottom: spot.questionAvis && spot.questionAvis.trim() ? 8 : 0 }}>
                {studentAnswer == null ? (
                  <span style={{ color: "var(--text-muted)" }}>Tu n&apos;as pas répondu — la bonne réponse était <b>{spot.questionAnswer === "oui" ? "Oui" : "Non"}</b>.</span>
                ) : studentAnswer === spot.questionAnswer ? (
                  <span style={{ color: "#6FCF97" }}>✅ Bonne réponse !</span>
                ) : (
                  <span style={{ color: "#C4544A" }}>❌ Raté — la bonne réponse était <b>{spot.questionAnswer === "oui" ? "Oui" : "Non"}</b>.</span>
                )}
              </div>
              {spot.questionAvis && spot.questionAvis.trim() && (
                <div style={{ fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{spot.questionAvis}</div>
              )}
            </div>
          )}
          {spot.explication && spot.explication.trim() && (
            <div style={{ marginTop: 12, background: "var(--panel)", border: `1px solid ${ACCENT}`, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700, marginBottom: 4 }}>💬 Le mot du coach</div>
              <div style={{ fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{spot.explication}</div>
            </div>
          )}
          {spot.gtoWizardLink && spot.gtoWizardLink.trim() && (
            <a href={spot.gtoWizardLink} target="_blank" rel="noopener noreferrer" style={{
              marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
              background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8,
              color: "var(--text)", fontSize: 12, fontWeight: 600, textDecoration: "none", width: "fit-content",
            }}>
              Voir la sim GTOWizard ↗
            </a>
          )}
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px", fontSize: 12 }}>
              <span style={{ color: "var(--text-muted)" }}>Ta sélection : </span>
              <span style={{ color: "var(--text)", fontFamily: "var(--font-ibm-plex-mono), monospace", fontWeight: 700 }}>{reveal.selectedCount} combos</span>
            </div>
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px", fontSize: 12 }}>
              <span style={{ color: "var(--text-muted)" }}>Range de référence : </span>
              <span style={{ color: ACCENT, fontFamily: "var(--font-ibm-plex-mono), monospace", fontWeight: 700 }}>{reveal.referenceCount} combos</span>
              <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-ibm-plex-mono), monospace" }}> · {reveal.referenceWeighted.toFixed(1)} réels</span>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={goToNext} disabled={nextLoading} style={{ padding: "9px 18px", background: "var(--accent-gradient)", color: "#0B1210", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, opacity: nextLoading ? 0.6 : 1 }}>
              {nextLoading ? "…" : "Spot suivant"}
            </button>
            <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Accueil</Link>
          </div>
        </>
      )}
    </div>
  );
}
