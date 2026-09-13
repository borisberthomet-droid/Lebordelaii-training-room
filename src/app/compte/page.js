"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteLogo from "@/components/SiteLogo";
import SkillProfile from "@/components/SkillProfile";
import { createClient } from "@/lib/supabase/client";
import { MemoIcon, LeakAnalyzerIcon, LeakfinderIcon, PotOddsIcon, ProfileIcon } from "@/components/ToolIcons";

// Espace personnel. Tout ce qui parle DU JOUEUR est ici — sa progression d'abord, affichée
// directement et non derrière un clic de plus — pendant que l'accueil ne garde que les exercices.
//
// Page CLIENT et sans redirection forcée, volontairement : la version serveur renvoyait vers la
// connexion dès que la base ne répondait pas, ce qui rendait la fiche inaccessible pendant une
// mise en veille alors qu'elle se lit très bien depuis le journal local. Tout le reste du site
// fonctionne base éteinte, cet espace doit faire pareil.

function Card({ href, Icon, label, desc, tag }) {
  const style = {
    display: "block", padding: "16px 16px", background: "var(--panel)", position: "relative",
    border: "1px solid var(--border)", borderRadius: 12,
  };
  const body = (
    <>
      {tag && (
        <span style={{
          position: "absolute", top: 12, right: 12, fontSize: 10, fontWeight: 600,
          color: "#E8C547", background: "rgba(232,197,71,0.12)", border: "1px solid rgba(232,197,71,0.3)",
          borderRadius: 999, padding: "2px 8px",
        }}>{tag}</span>
      )}
      <div style={{ marginBottom: 8, opacity: href ? 1 : 0.85 }}><Icon /></div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, opacity: href ? 1 : 0.6 }}>{label}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</div>
    </>
  );
  return href
    ? <Link href={href} style={style}>{body}</Link>
    : <div style={{ ...style, cursor: "default" }}>{body}</div>;
}

function Grid({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
      {children}
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2 }}>{title}</span>
        {note && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{note}</span>}
      </div>
      {children}
    </div>
  );
}

export default function ComptePage() {
  const [me, setMe] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("profiles").select("pseudo, role").eq("id", user.id).maybeSingle();
          setMe({ pseudo: data?.pseudo || user.email?.split("@")[0], role: data?.role });
        }
      } catch { /* base injoignable : on reste en mode local */ }
      finally { setChecked(true); }
    })();
  }, []);

  const isAdmin = me?.role === "admin";

  return (
    <div style={{ minHeight: "100vh", padding: 24, maxWidth: 780, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <SiteLogo size={22} />
        <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Exercices</Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <ProfileIcon size={30} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>
            {me?.pseudo || "Mon espace"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
            {me ? `${isAdmin ? "Coach" : "Élève"} · mon espace` : checked ? "Non connecté · progression lue sur ce navigateur" : "…"}
          </div>
        </div>
      </div>

      <Section title="Ma progression" note="calculée sur tes réponses aux exercices">
        <SkillProfile />
      </Section>

      <Section title="Mon activité">
        <Grid>
          <Card href="/history" Icon={() => <PotOddsIcon size={22} />}
            label="Mon historique" desc="Tes tentatives passées, spot par spot" />
          <Card href="/ranking" Icon={() => <PotOddsIcon size={22} />}
            label="Classements" desc="Général et par exercice" />
        </Grid>
      </Section>

      <Section title="Mes fiches mémo" note="les tableaux de référence, à garder sous la main">
        <Grid>
          <Card href="/memo" Icon={() => <MemoIcon size={22} />}
            label="Pot Odds" desc="Cotes, MDF, équité de value bet, ratios de bluff" />
          <Card href="/memo" Icon={() => <MemoIcon size={22} />}
            label="PKO" desc="α(FL), Risk Premium, élasticité, RP max en table finale" />
        </Grid>
      </Section>

      <Section title="Mes leaks" note="deux outils distincts, à ne pas confondre">
        <Grid>
          <Card href="/leak-analyzer" Icon={() => <LeakAnalyzerIcon size={22} />} tag="En développement"
            label="Leak Analyzer" desc="Colle une hand history : écarts vs la stratégie CFR, main par main" />
          <Card href={null} Icon={() => <LeakfinderIcon size={22} />} tag="Pas encore construit"
            label="Leakfinder" desc="Capture ton report Hand2Note, comparaison à la matrice de référence" />
        </Grid>
      </Section>

      {isAdmin && (
        <Section title="Coach">
          <Grid>
            <Card href="/admin" Icon={() => <PotOddsIcon size={22} />}
              label="Éditeur admin" desc="Créer et gérer les spots" />
            <Card href="/range-builder" Icon={() => <PotOddsIcon size={22} />}
              label="Ranges de référence" desc="Dessiner les ranges que les élèves devront retrouver" />
          </Grid>
        </Section>
      )}
    </div>
  );
}
