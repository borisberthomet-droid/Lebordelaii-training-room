import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteLogo from "@/components/SiteLogo";
import Logo from "@/components/Logo";
import {
  PotOddsIcon, PkoRpIcon, RangeBuilderIcon, MathTrainerIcon, ProfileIcon,
} from "@/components/ToolIcons";
import LogoutButton from "./logout-button";

// L'accueil ne garde que les EXERCICES, groupés par compétence. Tout ce qui concerne le joueur
// lui-même — progression, mémo, leaks, historique — vit dans /compte. Douze cartes à plat ne se
// lisaient plus.
const SECTIONS = [
  {
    title: "Lecture de range",
    desc: "Reconstruire ce que l'adversaire peut avoir",
    tools: [
      {
        href: "/find-it", Icon: () => <Logo size={24} showWordmark={false} />,
        label: "Find It!", desc: "Devine la range du vilain sur un spot réel",
      },
      {
        href: "/range-builder", Icon: () => <RangeBuilderIcon size={24} />,
        label: "Range Builder", desc: "Dessine une stratégie et compare-la à la référence du coach",
        inDev: true,
      },
    ],
  },
  {
    title: "Postflop",
    desc: "Situer sa main et décider, sur simulation résolue",
    tools: [
      {
        href: "/range-position", Icon: () => <RangeBuilderIcon size={24} />,
        label: "Où suis-je dans ma range ?",
        desc: "Face à une mise, place ta main dans ta range — turn et river", inDev: true,
      },
      {
        href: "/value-equity", Icon: () => <PotOddsIcon size={24} />,
        label: "Quelle est ton équité ?",
        desc: "Tu peux miser : estime ton équité et le sizing max en value", inDev: true,
      },
    ],
  },
  {
    title: "Cotes & calcul",
    desc: "Les nombres qu'il faut sortir sans réfléchir",
    tools: [
      {
        href: "/pot-odds", Icon: () => <PotOddsIcon size={24} />,
        label: "Pot Odds", desc: "Cotes de call, fold equity, fréquences de bluff",
      },
      {
        href: "/math-trainer", Icon: () => <MathTrainerIcon size={24} />,
        label: "Math Trainer", desc: "Calcul mental : sizings en % du pot, cotes risque/récompense",
        inDev: true,
      },
    ],
  },
  {
    title: "PKO & ICM",
    desc: "Primes, Risk Premium et pression de table finale",
    tools: [
      {
        href: "/pko-rp", Icon: () => <PkoRpIcon size={24} />,
        label: "PKO — KO & RP", desc: "Colle une main : valeur des KO en blindes et RP par joueur",
        inDev: true,
      },
      {
        href: "/pko-rp/trainer", Icon: () => <PkoRpIcon size={24} />,
        label: "RP Trainer", desc: "Estime le Risk Premium, du début de tournoi à la table finale",
        inDev: true,
      },
    ],
  },
];

const cardStyle = {
  display: "block", padding: "18px 16px", background: "var(--panel)", position: "relative",
  border: "1px solid var(--border)", borderRadius: 12,
};

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("pseudo, role").eq("id", user.id).single();

  return (
    <div style={{ minHeight: "100vh", padding: 24, maxWidth: 780, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <SiteLogo size={22} />
        <LogoutButton />
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>
          Salut {profile?.pseudo || user.email.split("@")[0]}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          {profile?.role === "admin" ? "Coach" : "Élève"} · choisis un exercice
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 30 }}>
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

      {SECTIONS.map((section) => (
        <div key={section.title} style={{ marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2 }}>{section.title}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{section.desc}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {section.tools.map((tool) => (
              <Link key={tool.label} href={tool.href} style={cardStyle}>
                {tool.inDev && (
                  <span style={{
                    position: "absolute", top: 12, right: 12, fontSize: 10, fontWeight: 600,
                    color: "#E8C547", background: "rgba(232,197,71,0.12)",
                    border: "1px solid rgba(232,197,71,0.3)", borderRadius: 999, padding: "2px 8px",
                  }}>
                    En développement
                  </span>
                )}
                <div style={{ marginBottom: 9 }}><tool.Icon /></div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{tool.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{tool.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
