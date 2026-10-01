"use client";

import PageLegale, { Liste, Section, Valeur } from "@/components/PageLegale";
import { EDITEUR, HEBERGEURS, MEDIATEUR } from "@/lib/legal";

export default function MentionsLegalesPage() {
  return (
    <PageLegale
      titre="Mentions légales"
      chapeau="Qui édite ce site, qui l'héberge, et à qui s'adresser."
    >
      <Section titre="Éditeur du site">
        <Liste>
          <li>Nom : {EDITEUR.nom}</li>
          <li>Nom commercial : {EDITEUR.marque}</li>
          <li>Statut : <Valeur>{EDITEUR.statut}</Valeur></li>
          <li>SIRET : <Valeur>{EDITEUR.siret}</Valeur></li>
          {EDITEUR.ape && <li>Code APE : {EDITEUR.ape}</li>}
          <li>Adresse : <Valeur>{EDITEUR.adresse}</Valeur></li>
          <li>Contact : <a href={`mailto:${EDITEUR.email}`} style={{ color: "var(--accent)" }}>{EDITEUR.email}</a></li>
          {EDITEUR.telephone && <li>Téléphone : {EDITEUR.telephone}</li>}
          <li>TVA : <Valeur>{EDITEUR.tva}</Valeur></li>
          <li>Directeur de la publication : {EDITEUR.directeurPublication}</li>
        </Liste>
      </Section>

      <Section titre="Hébergement et stockage des données">
        <p>
          Le site s&apos;appuie sur deux prestataires. Ils n&apos;utilisent pas les données pour leur
          propre compte : ils les hébergent.
        </p>
        <Liste>
          {HEBERGEURS.map((h) => (
            <li key={h.nom}>
              <strong>{h.role}</strong> — {h.nom}, {h.adresse} ({h.site}).{" "}
              <span style={{ color: "var(--text-muted)" }}>{h.note}</span>
            </li>
          ))}
        </Liste>
      </Section>

      <Section titre="Propriété intellectuelle">
        <p>
          Les exercices, les textes, les corrections, les simulations de stratégie et leur mise en
          forme sont la propriété de {EDITEUR.nom}. L&apos;accès à la plateforme est personnel : il
          n&apos;autorise ni la copie, ni l&apos;extraction, ni la rediffusion des contenus, notamment des
          fichiers de stratégie issus des simulations, que ce soit à titre gratuit ou payant.
        </p>
        <p style={{ marginTop: 8 }}>
          Les logiciels tiers cités (PioSOLVER, GTO Wizard, Hand2Note, Winamax) restent la propriété
          de leurs éditeurs respectifs et ne sont mentionnés qu&apos;à titre de référence.
        </p>
      </Section>

      <Section titre="Public concerné">
        <p>
          La plateforme s&apos;adresse à des joueurs de poker majeurs. Elle enseigne la technique du jeu ;
          elle ne propose aucun jeu d&apos;argent, n&apos;encaisse aucune mise et ne garantit aucun gain.
        </p>
      </Section>

      <Section titre="Médiation de la consommation">
        <p>
          Conformément aux articles L.616-1 et R.616-1 du Code de la consommation,{" "}
          {EDITEUR.nom} a adhéré à un dispositif de médiation. En cas de litige non résolu
          directement, le consommateur peut saisir gratuitement :
        </p>
        <Liste>
          <li><strong>{MEDIATEUR.nom}</strong> ({MEDIATEUR.forme})</li>
          <li>{MEDIATEUR.adresse}</li>
          <li>
            <a href={MEDIATEUR.siteUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
              {MEDIATEUR.site}
            </a>{" "}
            — {MEDIATEUR.telephone}
          </li>
        </Liste>
      </Section>

      <Section titre="Signaler un problème">
        <p>
          Pour toute question sur le site, une demande de retrait de contenu ou un problème d&apos;accès,
          écrire à <a href={`mailto:${EDITEUR.email}`} style={{ color: "var(--accent)" }}>{EDITEUR.email}</a>.
        </p>
      </Section>
    </PageLegale>
  );
}
