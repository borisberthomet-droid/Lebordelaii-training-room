"use client";

import PageLegale, { Liste, Section, Valeur } from "@/components/PageLegale";
import { EDITEUR, HEBERGEURS } from "@/lib/legal";

// Cette page décrit ce que le site fait RÉELLEMENT des données : elle a été écrite à partir du
// schéma de la base, table par table, et non recopiée d'un modèle. Si une fonctionnalité change,
// c'est ici qu'il faut revenir.

export default function ConfidentialitePage() {
  return (
    <PageLegale
      titre="Politique de confidentialité"
      chapeau="Ce que la plateforme enregistre, pourquoi, pendant combien de temps, et comment en demander la suppression."
      avertissement={
        <>
          Ce texte décrit le fonctionnement réel de la plateforme, écrit à partir de sa base de
          données. Il devra être relu à chaque fois qu&apos;une fonctionnalité nouvelle collecte des
          informations — l&apos;enregistrement audio des coachings, en particulier, n&apos;est pas encore en
          service et la section qui le concerne ne vaudra qu&apos;à ce moment-là.
        </>
      }
    >
      <Section titre="Qui est responsable">
        <p>
          {EDITEUR.nom} (<Valeur>{EDITEUR.statut}</Valeur>), éditeur de {EDITEUR.marque}, décide
          de ce qui est collecté et pourquoi. Pour toute question ou demande :{" "}
          <a href={`mailto:${EDITEUR.email}`} style={{ color: "var(--accent)" }}>{EDITEUR.email}</a>.
        </p>
      </Section>

      <Section titre="Ce qui est enregistré">
        <p>La liste est exhaustive au jour de la mise à jour indiquée ci-dessus.</p>
        <Liste>
          <li>
            <strong>Compte</strong> — adresse e-mail, mot de passe (jamais lisible : il est stocké
            sous forme chiffrée par notre prestataire d&apos;authentification), pseudo, date de création.
          </li>
          <li>
            <strong>Fiche joueur</strong>, remplie par toi et par toi seul — prénom, nom, adresse,
            téléphone, pseudo Discord, pseudos sur les rooms, buy-in moyen, formats joués,
            disponibilités.
          </li>
          <li>
            <strong>Entraînement</strong> — tes réponses aux exercices, tes scores, la date de
            chaque tentative, et les notes de compétence qui en sont déduites.
          </li>
          <li>
            <strong>Suivi de carrière</strong> — auto-évaluations, objectifs, tâches et routines,
            axes de travail, statistiques de jeu suivies avec le coach et les notes qu&apos;il y associe,
            captures d&apos;écran de tes statistiques déposées par le coach.
          </li>
          <li>
            <strong>Coaching</strong> — dates, durées, état de paiement, packs d&apos;heures, et la
            synthèse écrite de chaque séance une fois validée par le coach.
          </li>
        </Liste>
        <p style={{ marginTop: 10 }}>
          Aucune donnée bancaire n&apos;est enregistrée : les paiements ne passent pas par la plateforme.
          Aucun outil de mesure d&apos;audience ni de publicité n&apos;est installé.
        </p>
      </Section>

      <Section titre="Pourquoi, et sur quelle base">
        <Liste>
          <li>
            <strong>Faire fonctionner ton compte et l&apos;entraînement</strong> — nécessaire à
            l&apos;exécution du contrat qui nous lie. Sans ces données, il n&apos;y a pas de service.
          </li>
          <li>
            <strong>Assurer ton suivi de coaching</strong> — sur la base de ton consentement, donné
            au moment de l&apos;activation de ton accès, et retirable à tout moment.
          </li>
          <li>
            <strong>Tenir la comptabilité des séances vendues</strong> — obligation légale.
          </li>
        </Liste>
      </Section>

      <Section titre="Qui y a accès">
        <Liste>
          <li>
            <strong>Toi</strong> — l&apos;ensemble de tes données.
          </li>
          <li>
            <strong>Ton coach</strong> — ta fiche, ta progression, ton suivi. C&apos;est l&apos;objet même de
            l&apos;accompagnement.
          </li>
          <li>
            <strong>Les autres élèves</strong> — uniquement ton pseudo et tes résultats aux exercices,
            et seulement à travers les classements. Jamais ton e-mail, ni ta fiche, ni ton suivi.
          </li>
          <li>
            <strong>Nos prestataires techniques</strong> — {HEBERGEURS.map((h) => h.nom).join(" et ")},
            qui hébergent le site et la base. Ils n&apos;exploitent pas les données pour leur compte.
          </li>
        </Liste>
        <p style={{ marginTop: 10 }}>
          Les données sont stockées dans l&apos;Union européenne (Irlande). Nos prestataires étant des
          sociétés non européennes, un accès technique depuis un pays tiers reste possible ; il est
          encadré par les clauses contractuelles types de la Commission européenne.
        </p>
      </Section>

      <Section titre="Combien de temps">
        <Liste>
          <li>Tant que ton compte existe, pour le compte et le suivi.</li>
          <li>Un an après la fermeture de ton compte pour les données de suivi, le temps de traiter
            une éventuelle reprise, puis suppression.</li>
          <li>Dix ans pour ce qui relève de la comptabilité des séances vendues, comme la loi l&apos;exige.</li>
          <li>Les captures d&apos;écran de statistiques sont supprimées dès que le coach les retire.</li>
        </Liste>
      </Section>

      <Section titre="Tes droits">
        <p>
          Tu peux à tout moment demander à consulter tes données, les corriger, les récupérer dans un
          format lisible, en limiter l&apos;usage, ou tout faire effacer. Une demande envoyée à{" "}
          <a href={`mailto:${EDITEUR.email}`} style={{ color: "var(--accent)" }}>{EDITEUR.email}</a>{" "}
          reçoit une réponse sous trente jours.
        </p>
        <p style={{ marginTop: 8 }}>
          Une partie se fait sans nous : ta fiche se modifie depuis ton compte, et retirer ton
          consentement au suivi revient à demander la fermeture de ton accès.
        </p>
        <p style={{ marginTop: 8 }}>
          Si la réponse ne te satisfait pas, tu peux saisir la CNIL (cnil.fr).
        </p>
      </Section>

      <Section titre="Cookies">
        <p>
          Le site ne dépose qu&apos;un cookie de session, celui qui te garde connecté d&apos;une page à
          l&apos;autre. Il est indispensable au fonctionnement du service et ne sert à rien d&apos;autre :
          aucun consentement n&apos;est requis pour ce type de cookie, et aucune bannière n&apos;a donc lieu
          d&apos;être. Ton navigateur conserve aussi quelques préférences d&apos;affichage, qui ne quittent
          jamais ton appareil.
        </p>
      </Section>

      <Section titre="Enregistrement des coachings">
        <p>
          Cette fonctionnalité n&apos;est <strong>pas encore en service</strong>. Le jour où elle le sera,
          aucun enregistrement ne pourra démarrer sans ton accord explicite, demandé séance par
          séance. L&apos;enregistrement servira uniquement à produire la synthèse écrite ; l&apos;audio et sa
          transcription seront supprimés une fois la synthèse validée, et seule celle-ci sera
          conservée dans ton suivi.
        </p>
      </Section>
    </PageLegale>
  );
}
