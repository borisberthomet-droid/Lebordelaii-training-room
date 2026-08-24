import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteLogo from "@/components/SiteLogo";
import Logo from "@/components/Logo";
import { PotOddsIcon, LeakAnalyzerIcon, LeakfinderIcon, PkoRpIcon } from "@/components/ToolIcons";
import LogoutButton from "./logout-button";

const TOOLS = [
  {
    href: "/find-it",
    Icon: () => <Logo size={24} showWordmark={false} />,
    label: "Find It!",
    desc: "Entraînement à la lecture de range — devine la range de vilain",
  },
  {
    href: "/pot-odds",
    Icon: () => <PotOddsIcon size={24} />,
    label: "Pot Odds",
    desc: "Fréquences de call, de fold equity et de bluff vs bet/raise river",
    inDev: true,
  },
  {
    href: "/leak-analyzer",
    Icon: () => <LeakAnalyzerIcon size={24} />,
    label: "Leak Analyzer",
    desc: "Analyse une hand history et détecte les écarts vs la stratégie CFR",
    inDev: true,
  },
  {
    href: "/pko-rp",
    Icon: () => <PkoRpIcon size={24} />,
    label: "PKO — KO & RP",
    desc: "Colle une hand history : valeur des KO en blinds et RP de chaque joueur",
    inDev: true,
  },
  {
    href: null,
    Icon: () => <LeakfinderIcon size={24} />,
    label: "Leakfinder",
    desc: "Capture ton report Hand2Note, comparaison automatique à la matrice de référence",
    inDev: true,
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("pseudo, role")
    .eq("id", user.id)
    .single();

  return (
    <div style={{ minHeight: "100vh", padding: 24, maxWidth: 780, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 36,
        }}
      >
        <SiteLogo size={22} />
        <LogoutButton />
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>
          Salut {profile?.pseudo || user.email.split("@")[0]}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          {profile?.role === "admin" ? "Coach" : "Élève"} · choisis un exercice
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {TOOLS.map((tool) => {
          const cardStyle = {
            display: "block", padding: "20px 18px", background: "var(--panel)", position: "relative",
            border: "1px solid var(--border)", borderRadius: 14, transition: "border-color 0.15s",
          };
          const content = (
            <>
              {tool.inDev && (
                <span style={{
                  position: "absolute", top: 14, right: 14, fontSize: 10, fontWeight: 600,
                  color: "#E8C547", background: "rgba(232,197,71,0.12)", border: "1px solid rgba(232,197,71,0.3)",
                  borderRadius: 999, padding: "2px 8px", letterSpacing: 0.2,
                }}>
                  En développement
                </span>
              )}
              <div style={{ marginBottom: 10, opacity: tool.href ? 1 : 0.85 }}><tool.Icon /></div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, opacity: tool.href ? 1 : 0.6 }}>{tool.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{tool.desc}</div>
            </>
          );
          return tool.href ? (
            <Link key={tool.label} href={tool.href} style={cardStyle}>{content}</Link>
          ) : (
            <div key={tool.label} style={{ ...cardStyle, cursor: "default" }}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
