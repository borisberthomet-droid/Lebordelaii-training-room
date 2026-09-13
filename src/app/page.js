"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SiteLogo from "@/components/SiteLogo";
import ThemePanels from "@/components/ThemePanels";
import { PkoRpIcon, ProfileIcon } from "@/components/ToolIcons";
import LogoutButton from "./logout-button";

// L'accueil s'organise autour des QUATRE COMPÉTENCES CLÉS, une couleur chacune, avec la note du
// moment — c'est le modèle de Boris, et ça évite de faire deviner à l'élève à quoi sert chaque
// outil. Tout ce qui parle du joueur (progression détaillée, mémo, leaks, historique) vit dans
// /compte.
//
// PKO et ICM restent à part, en bandeau discret : le PKO est déjà noté dans la fiche via le RP
// Trainer, mais l'ICM n'a aucun exercice, donc les deux ne forment pas encore un thème à part
// entière.
const PKO_TOOLS = [
  {
    href: "/pko-rp", Icon: () => <PkoRpIcon size={24} />,
    label: "PKO — KO & RP", desc: "Colle une main : valeur des KO en blindes et RP par joueur",
  },
  {
    href: "/pko-rp/trainer", Icon: () => <PkoRpIcon size={24} />,
    label: "RP Trainer", desc: "Estime le Risk Premium, du début de tournoi à la table finale",
  },
];

const cardStyle = {
  display: "block", padding: "18px 16px", background: "var(--panel)", position: "relative",
  border: "1px solid var(--border)", borderRadius: 12,
};

export default function Home() {
  // Pas de redirection forcée vers la connexion : tous les exercices du site tournent déjà sans
  // session, et une base en veille rendait l'accueil entièrement inaccessible. On affiche donc
  // toujours les compétences, et on invite à se connecter seulement pour synchroniser.
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
      } catch { /* base injoignable : mode local */ }
      finally { setChecked(true); }
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", padding: 24, width: "100%", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <SiteLogo size={22} />
        {me
          ? <LogoutButton />
          : checked && <Link href="/login" style={{ fontSize: 12, color: "var(--accent)" }}>Se connecter</Link>}
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>
          {me ? `Salut ${me.pseudo}` : "Training Room"}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          {me
            ? `${me.role === "admin" ? "Coach" : "Élève"} · choisis une compétence à travailler`
            : "Choisis une compétence à travailler — connecte-toi pour garder ta progression"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 26 }}>
        <Link href="/train" style={{
          display: "block", padding: "18px 18px", background: "var(--accent-gradient)",
          borderRadius: 14, color: "#0B1210",
        }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>S&apos;entraîner</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Un spot au hasard, théorique ou exploit</div>
        </Link>
        <Link href="/compte" style={{ ...cardStyle, padding: "18px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <ProfileIcon size={22} />
            <span style={{ fontSize: 17, fontWeight: 700 }}>Mon compte</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Ma progression, mes fiches mémo, mes leaks
          </div>
        </Link>
      </div>

      <ThemePanels />

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2 }}>PKO &amp; ICM</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          le PKO est déjà noté dans ta fiche ; l&apos;ICM attend son exercice
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {PKO_TOOLS.map((tool) => (
          <Link key={tool.label} href={tool.href} style={cardStyle}>
            <div style={{ marginBottom: 9 }}><tool.Icon /></div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{tool.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{tool.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
