# Configuration iPhone — SMS automatique vers FireMap

Une application web ne peut pas lire directement les SMS d’un iPhone. La méthode gratuite utilise une automatisation personnelle dans l’application Raccourcis.

## Dans FireMap

1. Ouvrir `Intervention`.
2. Ouvrir `Importer le SMS de répartition`.
3. Inscrire le numéro exact de la répartition.
4. Activer `Réception automatique`.
5. Appuyer sur `Copier le lien FireMap`.

## Dans Raccourcis

1. Ouvrir **Raccourcis**.
2. Aller dans **Automatisation**.
3. Créer une nouvelle automatisation de type **Message**.
4. Choisir l’expéditeur correspondant au numéro de la répartition.
5. Choisir **Exécuter immédiatement**, lorsque cette option est disponible.
6. Ajouter l’action **Encoder l’URL** avec le contenu du message reçu.
7. Ajouter une action **Texte** et coller le lien FireMap copié.
8. Remplacer `TEXTE_ENCODE` par la variable du message encodé.
9. Ajouter l’action **Ouvrir les URL**.

Le lien ressemble à :

`https://VOTRE-NOM.github.io/VOTRE-DEPOT/?source=shortcut&from=NUMERO&sms=TEXTE_ENCODE`

## Résultat

FireMap vérifie le numéro, bloque les doublons, extrait l’adresse et crée automatiquement l’appel actif ainsi que l’événement du poste de commandement.

Selon la version d’iOS et les réglages de sécurité, une confirmation peut être demandée.
