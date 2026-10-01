# Envoi des e-mails d'authentification

Sans SMTP, Supabase envoie depuis son serveur de démonstration : **3 e-mails par heure, tous
destinataires confondus**, et uniquement vers les adresses des membres du projet. C'est pour ça
que « mot de passe oublié » ne marche pas pour un élève. Il faut donner à Supabase un serveur
d'envoi à nous.

## Pas besoin de Resend : tu as déjà ce qu'il faut

J'ai regardé le DNS de `lebordelaii.fr` avant de te faire créer un compte quelque part :

| Ce que j'ai trouvé | Conséquence |
|---|---|
| Serveurs de noms `ns*.ui-dns.*` | Le domaine est géré chez **IONOS** |
| `MX` → `mx00.ionos.fr`, `mx01.ionos.fr` | La boîte `contact@lebordelaii.fr` est **hébergée chez IONOS** |
| `SPF` → `v=spf1 include:_spf-eu.ionos.com ~all` | IONOS est **déjà autorisé** à envoyer pour ton domaine |

Donc : tu as une boîte mail professionnelle, et son serveur d'envoi est déjà déclaré dans ton
DNS. On s'en sert. Zéro compte à créer, zéro enregistrement DNS à ajouter, et les e-mails
partent de `contact@lebordelaii.fr` — une adresse qui existe vraiment et où l'élève peut
répondre.

Resend resterait l'option de repli si la boîte IONOS se mettait à limiter les envois. Pour une
dizaine d'élèves et quelques e-mails de connexion par semaine, on en est loin.

## 1. Brancher le SMTP

Supabase → **Authentication** → **Emails** → onglet **SMTP Settings** → activer *Enable Custom
SMTP*, puis :

| Champ | Valeur |
|---|---|
| Host | `smtp.ionos.fr` |
| Port | `465` |
| Username | `contact@lebordelaii.fr` *(l'adresse complète, pas juste « contact »)* |
| Password | le mot de passe de la boîte IONOS |
| Sender email | `contact@lebordelaii.fr` |
| Sender name | `Lebordelaii Training Room` |

Deux pièges :

- **L'adresse d'expédition doit être exactement celle du compte SMTP.** IONOS refuse d'envoyer
  au nom d'une autre adresse. Pas de `noreply@…` qui n'existe pas dans la boîte.
- **Ne me donne pas ce mot de passe.** Tape-le directement dans le formulaire Supabase. Il n'a
  pas besoin de passer par notre conversation, et il ouvre ta boîte mail.

Si le port 465 est refusé, essayer `587` — c'est le même serveur en STARTTLS.

## 2. Vérifier les URL de retour

Supabase → **Authentication** → **URL Configuration**. Les liens des e-mails atterrissent sur
`/auth/confirm`, qui échange le code contre une session (voir `src/app/auth/confirm/route.js`) :
si l'URL n'est pas autorisée, le lien est refusé **après** le clic, ce qui ressemble à un lien
cassé alors que l'envoi a parfaitement marché.

- **Site URL** : `https://lebordelaii-training-room.vercel.app`
- **Redirect URLs** : ajouter `https://lebordelaii-training-room.vercel.app/auth/confirm` et,
  pour le développement, `http://localhost:3000/auth/confirm`

## 3. Remettre la confirmation d'adresse

Supabase → **Authentication** → **Sign In / Providers** → Email → réactiver **Confirm email**.

Tu l'avais coupée parce que rien ne partait. Maintenant qu'un e-mail arrive, elle sert à quelque
chose de concret : une adresse saisie de travers à l'inscription bloque l'élève pour toujours,
puisque « mot de passe oublié » écrit à une boîte qui n'existe pas. La confirmation attrape la
faute de frappe le premier jour.

## 4. Mettre les gabarits français

Supabase → **Authentication** → **Emails** → **Templates**. Trois gabarits à remplacer, le
contenu de chaque fichier à coller dans le champ *Message body* :

| Template Supabase | Fichier | Objet à mettre |
|---|---|---|
| Confirm signup | `confirmation-inscription.html` | `Confirme ton adresse — Lebordelaii Training Room` |
| Reset password | `reinitialisation-mot-de-passe.html` | `Nouveau mot de passe — Lebordelaii Training Room` |
| Change email address | `changement-email.html` | `Confirme ta nouvelle adresse — Lebordelaii Training Room` |

Les autres (Magic Link, Invite user) ne sont pas utilisés par le site : on les laisse tels quels.

`{{ .ConfirmationURL }}`, `{{ .Email }}` et `{{ .NewEmail }}` sont remplis par Supabase à
l'envoi — ne pas y toucher.

## 5. Monter la limite d'envoi

Supabase → **Authentication** → **Rate Limits** → *Rate limit for sending emails*. Elle reste
basse même avec un SMTP à soi. Trente par heure suffisent largement, mais vérifie qu'elle n'est
pas restée à 3.

## 6. Tester

Avec une adresse jetable, **pas la tienne** : si le mot de passe est réinitialisé sur ton propre
compte au milieu d'un test, tu te retrouves dehors.

1. `/forgot-password` → saisir l'adresse de test → l'e-mail doit arriver en moins d'une minute.
2. Cliquer le bouton → tu dois tomber sur `/update-password`, connecté.
3. Changer le mot de passe → se reconnecter avec le nouveau.

Si rien n'arrive : Supabase → **Logs** → **Auth Logs**. Une erreur SMTP y est écrite en clair
(mauvais mot de passe, port fermé, expéditeur refusé). C'est plus rapide que de deviner.
