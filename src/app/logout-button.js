"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: "8px 14px",
        borderRadius: 6,
        fontSize: 12,
        background: "var(--panel)",
        color: "var(--text)",
        border: "1px solid var(--border)",
      }}
    >
      Déconnexion
    </button>
  );
}
