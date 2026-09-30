"use client";

import Link from "next/link";
import SiteLogo from "@/components/SiteLogo";
import { MISE_A_JOUR, aCompleter } from "@/lib/legal";

// Mise en page commune aux trois pages légales. Elles sont accessibles sans compte — c'est une
// obligation, et de toute façon quelqu'un qui hésite à s'inscrire doit pouvoir les lire avant.

export function Section({ titre, children }) {
  return (
    <section style={{ marginTop: 26 }}>
      <h2 className="titre" style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{titre}</h2>
      <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text)" }}>{children}</div>
    </section>
  );
}

// Affiche une valeur, ou la signale en évidence si elle n'a pas encore été renseignée.
export function Valeur({ children }) {
  if (aCompleter(children)) {
    return (
      <mark style={{
        background: "color-mix(in srgb, var(--attention) 22%, transparent)",
        color: "var(--attention)", padding: "1px 6px", borderRadius: 5, fontWeight: 600,
      }}>
        {children}
      </mark>
    );
  }
  return <>{children}</>;
}

export function Liste({ children }) {
  return <ul style={{ margin: "8px 0 0 18px", display: "grid", gap: 6 }}>{children}</ul>;
}

export default function PageLegale({ titre, chapeau, children, avertissement }) {
  return (
    <div style={{ minHeight: "100vh", padding: 24, width: "100%", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <SiteLogo size={18} />
        <Link href="/login" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Connexion</Link>
      </div>

      <h1 className="titre" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>{titre}</h1>
      {chapeau && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.7 }}>{chapeau}</p>
      )}
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, fontFamily: "var(--font-ibm-plex-mono), monospace" }}>
        Dernière mise à jour : {MISE_A_JOUR}
      </div>

      {avertissement && (
        <div style={{
          marginTop: 18, padding: "12px 14px", borderRadius: 10, fontSize: 12, lineHeight: 1.7,
          background: "color-mix(in srgb, var(--attention) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--attention) 35%, transparent)",
          color: "var(--text)",
        }}>
          {avertissement}
        </div>
      )}

      {children}

      <div style={{
        marginTop: 36, paddingTop: 16, borderTop: "1px solid var(--border)",
        display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "var(--text-muted)",
      }}>
        <Link href="/mentions-legales">Mentions légales</Link>
        <Link href="/confidentialite">Confidentialité</Link>
        <Link href="/cgv">Conditions de vente</Link>
      </div>
    </div>
  );
}
