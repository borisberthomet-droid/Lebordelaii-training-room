"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getRandomAvailableSpot } from "@/lib/supabase/spots";
import PageHeader from "@/components/PageHeader";

export default function TrainPage() {
  const router = useRouter();
  const [state, setState] = useState("loading"); // loading | empty | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const spot = await getRandomAvailableSpot();
        if (!spot) { setState("empty"); return; }
        router.replace(`/play/${spot.id}?from=train`);
      } catch (e) {
        setErrorMsg(e.message);
        setState("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "loading") {
    return (
      <div style={{ minHeight: "100vh", padding: 20, maxWidth: 480, margin: "0 auto" }}>
        <PageHeader subtitle="Entraînement" />
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Sélection d&apos;un spot…</div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div style={{ minHeight: "100vh", padding: 20, maxWidth: 480, margin: "0 auto" }}>
        <PageHeader subtitle="Entraînement" />
        <div style={{ fontSize: 13, color: "#E0645A" }}>{errorMsg}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 20, maxWidth: 480, margin: "0 auto" }}>
      <PageHeader subtitle="Entraînement" />
      <div
        style={{
          background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14,
          padding: 24, textAlign: "center",
        }}
      >
        <div style={{ fontSize: 14, marginBottom: 6 }}>Aucun spot disponible pour l&apos;instant.</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Tous les spots exploit sont verrouillés ou ton coach n&apos;a pas encore ajouté de spot.
        </div>
        <Link href="/" style={{ display: "inline-block", marginTop: 16, fontSize: 12, color: "var(--accent)" }}>
          ← Accueil
        </Link>
      </div>
    </div>
  );
}
