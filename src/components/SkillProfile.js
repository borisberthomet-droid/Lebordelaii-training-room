"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SkillRadar from "@/components/SkillRadar";
import { createClient } from "@/lib/supabase/client";
import { getMySkillAttempts, getSkillAttemptsFor, listStudents, readLocalSkillAttempts } from "@/lib/supabase/skillAttempts";
import { buildProfile, levelFor, MIN_WEIGHT } from "@/lib/poker/skillScore";

// Où chaque compétence se travaille : une fiche qui pointe un trou sans dire où aller ne sert à
// rien. L'axe ICM n'a pas encore d'exercice, et c'est dit plutôt que masqué.
const WHERE = {
  equite: [{ href: "/value-equity", label: "Quelle est ton équité ?" }, { href: "/pot-odds", label: "Pot Odds" }],
  frequence: [{ href: "/range-position", label: "Où suis-je dans ma range ?" }, { href: "/range-builder", label: "Range Builder" }],
  calcul: [{ href: "/math-trainer", label: "Math Trainer" }],
  lecture: [{ href: "/train", label: "Find It!" }],
  pko: [{ href: "/pko-rp/trainer", label: "RP Trainer" }],
  icm: [],
};

function Bar({ value, dim }) {
  return (
    <div style={{ height: 6, background: "var(--panel-2)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, value || 0))}%`, height: "100%",
        background: dim ? "var(--border)" : "var(--accent-gradient)",
      }} />
    </div>
  );
}

// Bloc « ma progression » : autonome, il charge lui-même ses données. Vit dans /compte pour
// que l'élève voie son niveau en arrivant, sans avoir à ouvrir une page de plus.
export default function SkillProfile() {
  const [me, setMe] = useState(null);
  const [students, setStudents] = useState([]);
  const [viewing, setViewing] = useState(null);   // id de l'élève regardé (coach)
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setMe(null); return; }   // pas connecté : on lira le journal local
        const { data: prof } = await supabase
          .from("profiles").select("id, pseudo, role").eq("id", user.id).maybeSingle();
        setMe(prof || { id: user.id, pseudo: user.email, role: "student" });
        if (prof?.role === "admin") setStudents(await listStudents().catch(() => []));
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const autreEleve = me && viewing && viewing !== me.id;
    try {
      const rows = autreEleve ? await getSkillAttemptsFor(viewing) : await getMySkillAttempts();
      // La base peut répondre vide parce qu'elle est en veille ou que la table n'existe pas
      // encore : dans ce cas le journal local est la seule source, et on le dit.
      if (rows.length === 0 && !autreEleve) {
        const local = readLocalSkillAttempts();
        if (local.length) { setSource("local"); setProfile(buildProfile(local)); return; }
      }
      setSource("base");
      setProfile(buildProfile(rows));
    } catch {
      if (autreEleve) { setProfile(buildProfile([])); setSource("base"); return; }
      setSource("local");
      setProfile(buildProfile(readLocalSkillAttempts()));
    } finally {
      setLoading(false);
    }
  }, [me, viewing]);

  useEffect(() => { load(); }, [load]);

  if (error) {
    return <div style={{ fontSize: 13, color: "#E0645A" }}>{error}</div>;
  }

  const mesures = profile?.axes.filter((a) => a.measured) || [];
  // Points forts et axes de progression doivent être DISJOINTS : avec deux axes mesurés, prendre
  // « les 2 meilleurs » et « les 2 moins bons » affichait deux fois la même paire.
  const classes = [...mesures].sort((a, b) => b.score - a.score);
  const nForts = Math.min(2, Math.floor(classes.length / 2));
  const forts = classes.slice(0, nForts);
  const faibles = classes.slice(-Math.min(2, classes.length - nForts));
  const jamais = profile?.axes.filter((a) => !a.measured) || [];

  return (
    <div>
      {me?.role === "admin" && students.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Élève</label>
          <select value={viewing || me.id} onChange={(e) => setViewing(e.target.value)} style={{
            width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
            color: "var(--text)", borderRadius: 8, padding: "8px 10px", fontSize: 13,
          }}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.pseudo || s.id.slice(0, 8)}{s.id === me.id ? " (moi)" : ""}</option>)}
          </select>
        </div>
      )}

      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        {loading ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Calcul des compétences…</div>
        ) : !profile || profile.total === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
            Aucune tentative enregistrée pour l&apos;instant. Fais quelques exercices et la fiche se
            remplira toute seule — il faut {MIN_WEIGHT} réponses sur un axe pour qu&apos;il soit noté.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 46, fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>
                {profile.global ?? "—"}
              </span>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Score global / 100</div>
                {profile.global != null && (
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{levelFor(profile.global)}</div>
                )}
              </div>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                {profile.total} réponses · {profile.measuredAxes}/{profile.axes.length} axes mesurés
              </span>
            </div>

            <SkillRadar axes={profile.axes} />

            <div style={{ marginTop: 10 }}>
              {profile.axes.map((a) => (
                <div key={a.id} style={{ padding: "9px 0", borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: a.measured ? "var(--text)" : "var(--text-muted)" }}>
                      {a.label}
                    </span>
                    <span style={{ fontSize: 12, fontFamily: "var(--font-ibm-plex-mono), monospace", color: a.measured ? "var(--accent)" : "var(--text-muted)" }}>
                      {a.measured ? a.score : "non mesuré"}
                      {a.trend != null && a.trend !== 0 && (
                        <span style={{ marginLeft: 8, color: a.trend > 0 ? "#34D399" : "#E0645A" }}>
                          {a.trend > 0 ? "+" : ""}{a.trend} ce mois-ci
                        </span>
                      )}
                    </span>
                  </div>
                  <Bar value={a.measured ? a.score : 0} dim={!a.measured} />
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span>{a.desc}</span>
                    <span>
                      {a.measured
                        ? `${a.n} réponses · confiance ${Math.round(a.confidence * 100)}%`
                        : WHERE[a.id]?.length
                          ? <>à travailler dans {WHERE[a.id].map((w, i) => (
                              <span key={w.href}>{i > 0 ? ", " : ""}<Link href={w.href} style={{ color: "var(--accent)" }}>{w.label}</Link></span>
                            ))}</>
                          : "aucun exercice ne mesure encore cet axe"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {profile && mesures.length >= 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--accent)" }}>Points forts</div>
            {forts.map((a) => (
              <div key={a.id} style={{ fontSize: 12, color: "var(--text-muted)", padding: "2px 0" }}>
                {a.label} <span style={{ color: "var(--text)" }}>{a.score}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#E8C547" }}>Axes de progression</div>
            {faibles.map((a) => (
              <div key={a.id} style={{ fontSize: 12, color: "var(--text-muted)", padding: "2px 0" }}>
                {a.label} <span style={{ color: "var(--text)" }}>{a.score}</span>
                {WHERE[a.id]?.[0] && (
                  <> — <Link href={WHERE[a.id][0].href} style={{ color: "var(--accent)" }}>{WHERE[a.id][0].label}</Link></>
                )}
              </div>
            ))}
            {jamais.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                Jamais testé : {jamais.map((a) => a.label).join(", ")}
              </div>
            )}
          </div>
        </div>
      )}

      {source === "local" && (
        <div style={{ fontSize: 11, color: "#E8C547", marginBottom: 12, lineHeight: 1.6 }}>
          Données lues sur ce navigateur, pas sur le compte : la base est en veille ou la table
          n&apos;est pas encore créée. Les réponses sont conservées et remonteront une fois la base
          revenue.
        </div>
      )}

      <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--text)" }}>Comment se lit une note.</strong> 0 n&apos;est pas
        « zéro pointé » mais « le niveau d&apos;un joueur qui répondrait sans regarder le spot » —
        mesuré sur les données réelles de chaque exercice. 100 veut dire sans erreur. Répondre au
        hasard à un choix entre cinq quintiles donne donc 0, pas 20. Les réponses récentes comptent
        davantage : une réponse d&apos;il y a un mois pèse moitié moins qu&apos;aujourd&apos;hui.
      </div>
    </div>
  );
}
