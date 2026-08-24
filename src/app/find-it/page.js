import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";
import LogoutButton from "../logout-button";

const NAV_ITEMS = [
  { href: "/ranking", label: "Classements", desc: "Général et par spot" },
  { href: "/history", label: "Mon historique", desc: "Tes tentatives passées" },
];

export default async function FindItHome() {
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
        <Logo size={30} wordmarkSize={19} />
        <LogoutButton />
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>
          Salut {profile?.pseudo || user.email.split("@")[0]}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          {profile?.role === "admin" ? "Coach" : "Élève"} · entraînement de lecture de range
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        <Link
          href="/train"
          style={{
            display: "block", padding: "18px 18px", background: "var(--accent-gradient)",
            borderRadius: 14, color: "#0B1210", gridColumn: "1 / -1",
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>S&apos;entraîner</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Un spot au hasard, théorique ou exploit</div>
        </Link>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "block", padding: "18px 18px", background: "var(--panel)",
              border: "1px solid var(--border)", borderRadius: 14, transition: "border-color 0.15s",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.desc}</div>
          </Link>
        ))}
        {profile?.role === "admin" && (
          <Link
            href="/admin"
            style={{
              display: "block", padding: "18px 18px", background: "var(--accent-gradient)",
              borderRadius: 14, color: "#0B1210",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Éditeur admin</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Créer et gérer les spots</div>
          </Link>
        )}
      </div>
    </div>
  );
}
