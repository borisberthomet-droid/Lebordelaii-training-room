import { Fraunces, Poppins, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import PiedDePage from "@/components/PiedDePage";

// Les polices de la marque, reprises du site de coaching : un serif à fort caractère pour les
// titres, un sans rond pour le texte courant. Le monospace reste réservé aux CHIFFRES — pot,
// équité, fréquences — parce qu'une colonne de nombres qui ne s'aligne pas se lit deux fois.
// `axes` n'est accepté que si la police est chargée en variable ; avec des graisses fixes, Next
// refuse le module. On s'en tient donc aux deux graisses dont on se sert.
const titre = Fraunces({
  variable: "--font-titre",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const corps = Poppins({
  variable: "--font-corps",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata = {
  title: "Lebordelaii Training Room",
  description: "Outils d'entraînement poker MTT/PKO — lecture de range, pot odds, analyse de leaks",
  icons: { icon: "/marque/app-64.png", apple: "/marque/app-192.png" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${titre.variable} ${corps.variable} ${ibmPlexMono.variable}`}>
      <body>
        {children}
        <PiedDePage />
      </body>
    </html>
  );
}
