import { redirect } from "next/navigation";

// L'inscription libre n'existe plus : un compte se crée en activant une clé, sur l'onglet dédié
// de la page de connexion. On garde l'adresse pour les anciens liens.
export default function SignupPage() {
  redirect("/login?mode=activation");
}
