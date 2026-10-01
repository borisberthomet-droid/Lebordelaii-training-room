"use client";

import PageLegale, { Liste, Section, Valeur } from "@/components/PageLegale";
import { EDITEUR, MEDIATEUR, PRESTATIONS } from "@/lib/legal";

// Projet de CGV. Écrit à partir de ce que l'application fait réellement, et de ce qui est
// réellement vendu : des séances à l'unité, pas de pack d'heures prépayées. À faire relire par
// un juriste avant publication : une clause d'annulation mal tournée se retourne contre son auteur.

export default function CgvPage() {
  return (
    <PageLegale
      titre="Conditions générales de vente"
      chapeau="Ce qui est vendu, à quel prix, comment on annule, et ce que le coaching ne promet pas."
      avertissement={
        <>
          <strong>Projet, à faire relire avant publication.</strong> Ce texte a été rédigé à partir du
          fonctionnement réel de la plateforme, mais il n&apos;a pas été relu par un juriste. Un point
          mérite particulièrement son avis : la renonciation au droit de rétractation lorsque la
          séance est planifiée dans les quatorze jours.
        </>
      }
    >
      <Section titre="1. Qui vend, et quoi">
        <p>
          Les présentes conditions régissent les prestations de coaching poker vendues par{" "}
          {EDITEUR.nom} (<Valeur>{EDITEUR.statut}</Valeur>, SIRET <Valeur>{EDITEUR.siret}</Valeur>)
          sous la marque {EDITEUR.marque}, à des personnes physiques majeures.
        </p>
        <p style={{ marginTop: 8 }}>
          L&apos;accès à la plateforme d&apos;entraînement est fourni dans le cadre de l&apos;accompagnement, par
          une clé d&apos;activation personnelle et non cessible.
        </p>
      </Section>

      <Section titre="2. Prestations et prix">
        <Liste>
          {PRESTATIONS.map((p) => (
            <li key={p.nom}>
              <strong>{p.nom}</strong> — <Valeur>{p.prix}</Valeur> {p.unite}.
            </li>
          ))}
        </Liste>
        <p style={{ marginTop: 10 }}>
          Les prix sont en euros. <Valeur>{EDITEUR.tva}</Valeur> Le tarif applicable est celui affiché
          au moment de la réservation ; une évolution ultérieure est sans effet sur une séance déjà
          réglée.
        </p>
      </Section>

      <Section titre="3. Réservation et paiement">
        <p>
          La réservation se fait par accord écrit entre le coach et l&apos;élève (e-mail, message, ou
          formulaire du site). Le paiement s&apos;effectue avant la séance, par les moyens convenus entre
          les parties ; la plateforme n&apos;encaisse aucun paiement et n&apos;enregistre aucune donnée
          bancaire.
        </p>
      </Section>

      <Section titre="4. Droit de rétractation">
        <p>
          Pour un achat à distance, tu disposes de quatorze jours pour te rétracter sans motif, à
          compter de la conclusion du contrat, en écrivant à{" "}
          <a href={`mailto:${EDITEUR.email}`} style={{ color: "var(--accent)" }}>{EDITEUR.email}</a>.
        </p>
        <p style={{ marginTop: 8 }}>
          Si tu demandes que la prestation commence avant la fin de ce délai — une séance planifiée
          dans les quatorze jours, ou l&apos;ouverture immédiate de l&apos;accès à la plateforme — il t&apos;est
          demandé d&apos;y consentir expressément. Tu conserves alors ton droit de rétractation pour ce
          qui n&apos;a pas encore été fourni, la partie déjà exécutée restant due.
        </p>
      </Section>

      <Section titre="5. Annulation et report">
        <Liste>
          <li>
            Une séance peut être déplacée sans frais jusqu&apos;à <strong>24 heures</strong> avant
            l&apos;heure prévue.
          </li>
          <li>
            Passé ce délai, ou en cas d&apos;absence, la séance est considérée comme due.
          </li>
          <li>
            Si le coach doit annuler, la séance est reportée sans frais, ou remboursée si aucun
            report ne convient.
          </li>
        </Liste>
      </Section>

      <Section titre="6. Ce que le coaching promet, et ce qu'il ne promet pas">
        <p>
          Le coach s&apos;engage à fournir un accompagnement sérieux : préparation des séances, analyse de
          ton jeu, plan de travail et suivi.
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>Aucun gain n&apos;est garanti.</strong> Le poker comporte une part de hasard et un risque
          de perte financière. Les prestations vendues ici sont des prestations d&apos;enseignement : elles
          ne constituent ni un conseil en investissement, ni une promesse de résultat, ni une
          garantie de progression. La gestion de ta bankroll et tes décisions de jeu restent les
          tiennes.
        </p>
      </Section>

      <Section titre="7. Accès à la plateforme">
        <p>
          La clé d&apos;activation est personnelle. Le partage d&apos;un accès, la revente ou l&apos;extraction des
          contenus — notamment des fichiers de stratégie issus des simulations — entraînent la
          révocation immédiate de l&apos;accès, sans remboursement des séances déjà réglées.
        </p>
        <p style={{ marginTop: 8 }}>
          La plateforme est fournie en l&apos;état, avec une disponibilité normale mais sans garantie
          d&apos;absence d&apos;interruption. Une interruption durable ouvre droit à la prolongation de l&apos;accès
          d&apos;une durée équivalente.
        </p>
      </Section>

      <Section titre="8. Jeu responsable">
        <p>
          Les prestations s&apos;adressent exclusivement à des personnes majeures. Si le jeu cesse d&apos;être
          un plaisir, des professionnels écoutent gratuitement et anonymement au 09 74 75 13 13
          (Joueurs Info Service).
        </p>
      </Section>

      <Section titre="9. Données personnelles">
        <p>
          Le traitement des données est décrit dans la{" "}
          <a href="/confidentialite" style={{ color: "var(--accent)" }}>politique de confidentialité</a>,
          qui fait partie intégrante des présentes conditions.
        </p>
      </Section>

      <Section titre="10. Réclamation et médiation">
        <p>
          En cas de désaccord, écris d&apos;abord à{" "}
          <a href={`mailto:${EDITEUR.email}`} style={{ color: "var(--accent)" }}>{EDITEUR.email}</a> :
          la plupart des situations se règlent ainsi. À défaut d&apos;accord amiable dans un délai d&apos;un
          mois, tu peux saisir gratuitement le médiateur de la consommation dont relève{" "}
          {EDITEUR.marque} :
        </p>
        <Liste>
          <li>
            <strong>{MEDIATEUR.nom}</strong> ({MEDIATEUR.forme})
          </li>
          <li>{MEDIATEUR.adresse}</li>
          <li>
            <a href={MEDIATEUR.siteUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
              {MEDIATEUR.site}
            </a>{" "}
            — {MEDIATEUR.telephone}
          </li>
        </Liste>
        <p style={{ marginTop: 10 }}>
          La saisine du médiateur est gratuite pour le consommateur et se fait en ligne depuis le
          site ci-dessus. Tu peux également utiliser la plateforme européenne de règlement des
          litiges en ligne.
        </p>
      </Section>

      <Section titre="11. Droit applicable">
        <p>
          Les présentes conditions sont soumises au droit français. À défaut d&apos;accord amiable, les
          tribunaux français sont compétents.
        </p>
      </Section>
    </PageLegale>
  );
}
