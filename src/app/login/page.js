import LoginForm from "./LoginForm";
import { safeNext } from "@/lib/access";

// Page serveur : lit les paramètres d'URL (onglet demandé, page de retour) et les passe au
// formulaire client. Lire l'URL côté client imposerait une frontière Suspense en plus.
export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  return (
    <LoginForm
      initialMode={params.mode === "activation" ? "activation" : "login"}
      next={safeNext(params.next)}
      initialError={typeof params.error === "string" ? params.error : ""}
    />
  );
}
