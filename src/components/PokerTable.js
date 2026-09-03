// Table de poker vue de dessus, pour le RP Trainer. Une liste de stacks ne dit pas d'un coup
// d'oeil qui parle après qui — or c'est exactement ce qui décide du régime de calcul (hero
// clôture ou non) et de la couverture. La table le montre.
//
// Générique sur le nombre de sièges : 6 en jeu de table (positions réelles), jusqu'à 9 en table
// finale (sièges numérotés, pas de position).

const ROLE_COLORS = {
  hero: { border: "var(--accent)", text: "var(--accent)", bg: "rgba(52,211,153,0.12)" },
  jam: { border: "#E89A47", text: "#E89A47", bg: "rgba(232,154,71,0.12)" },
  toAct: { border: "var(--border)", text: "var(--text)", bg: "var(--panel-2)" },
  folded: { border: "var(--border)", text: "var(--text-muted)", bg: "transparent" },
  // En table finale on décrit une confrontation, pas une séquence d'action : les autres joueurs
  // pèsent sur l'ICM mais ne « parlent » pas. Pas de ligne d'état pour eux.
  idle: { border: "var(--border)", text: "var(--text)", bg: "var(--panel-2)" },
};

// Les sièges sont posés sur une ellipse. On démarre à 210° et on tourne dans le sens horaire :
// pour 6 joueurs ça place UTG en haut à gauche et l'action descend vers la BB en bas à gauche,
// soit l'ordre de parole préflop lu naturellement.
function seatPoint(i, n, rx, ry) {
  const angle = ((210 + (360 / n) * i) * Math.PI) / 180;
  return { left: `${50 + rx * Math.cos(angle)}%`, top: `${50 + ry * Math.sin(angle)}%` };
}

function Seat({ seat, showKO }) {
  const c = ROLE_COLORS[seat.state] || ROLE_COLORS.toAct;
  const dim = seat.state === "folded";
  return (
    <div style={{
      width: 92, padding: "6px 4px", borderRadius: 10, textAlign: "center",
      border: `1px solid ${c.border}`, background: c.bg, opacity: dim ? 0.45 : 1,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: c.text, letterSpacing: 0.2 }}>
        {seat.label}
        {seat.isHero ? " (toi)" : ""}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 700, color: "var(--text)",
        fontFamily: "var(--font-ibm-plex-mono), monospace",
      }}>
        {seat.stackBB} BB
      </div>
      {showKO && seat.nKO != null && (
        <div style={{
          fontSize: 10, color: seat.isVillain ? c.text : "var(--text-muted)",
          fontWeight: seat.isVillain ? 700 : 400,
          fontFamily: "var(--font-ibm-plex-mono), monospace",
        }}>
          {seat.nKO} KO
        </div>
      )}
      {seat.state === "jam" && (
        <div style={{ fontSize: 9, color: c.text, fontWeight: 700, letterSpacing: 0.5 }}>JAM</div>
      )}
      {seat.state === "folded" && (
        <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 0.5 }}>fold</div>
      )}
      {seat.state === "toAct" && !seat.isVillain && (
        <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 0.5 }}>à parler</div>
      )}
    </div>
  );
}

export default function PokerTable({ seats, center, showKO = true }) {
  const n = seats.length;
  const small = n <= 6;
  // Les sièges dépassent l'ellipse : on garde de la marge pour ne pas les rogner. Une table de
  // 9 a besoin de plus de hauteur et d'un rayon vertical plus grand qu'une table de 6.
  const height = small ? 270 : 320;
  const rx = 38;
  const ry = small ? 32 : 34;
  // Largeur minimale, mesurée et non estimée (voir le contrôle de géométrie) : en dessous, les
  // cartes se chevauchent ou sortent du cadre. À 6 sièges la contrainte est le débordement
  // latéral (269 px) ; à 9 c'est le chevauchement entre voisins, bien plus exigeant (520 px) —
  // un minWidth de 400 laissait deux paires se superposer. En dessous, la table défile
  // horizontalement plutôt que d'être rognée.
  const minWidth = small ? 300 : 540;

  return (
    <div style={{ overflowX: "auto", margin: "4px 0 14px" }}>
      <div style={{ position: "relative", height, minWidth }}>
        <div style={{
          position: "absolute", inset: "22% 16%", borderRadius: "50%",
          background: "rgba(52,211,153,0.045)", border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {center && (
            <div style={{
              textAlign: "center", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.7,
              fontFamily: "var(--font-ibm-plex-mono), monospace", padding: "0 8px",
            }}>
              {center}
            </div>
          )}
        </div>
        {seats.map((seat, i) => {
          const p = seatPoint(i, n, rx, ry);
          return (
            <div key={seat.label} style={{
              position: "absolute", left: p.left, top: p.top, transform: "translate(-50%, -50%)",
            }}>
              <Seat seat={seat} showKO={showKO} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
