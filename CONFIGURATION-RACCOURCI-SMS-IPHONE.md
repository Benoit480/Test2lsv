# Configuration iPhone — import SMS simplifié

## Adresse dédiée

Utilisez cette adresse dans Raccourcis :

`https://benoit480.github.io/Test2lsv/import/?from=332211&sms=`

La variable **URL encodée** doit être ajoutée immédiatement après `sms=`.

## Raccourci complet

1. Déclencheur : **Lorsque je reçois un message de 332211**.
2. Action : **Encoder URL**.
   - Entrée : `Message reçu`.
3. Action : **Texte**.
   - Contenu fixe :

   `https://benoit480.github.io/Test2lsv/import/?from=332211&sms=`

   - Ajouter la variable bleue produite par **Encoder URL** juste après le signe `=`.
4. Action : **Ouvrir les URL**.
   - Entrée : la variable **Texte**.
5. Choisir **Exécuter immédiatement** lorsque l’option est disponible.

## Résultat

Le SMS ouvre l’adresse `/import/`, qui transmet ensuite le message à FireMap. FireMap :

- vérifie que le numéro est autorisé;
- bloque les doublons;
- extrait l’adresse et la nature de l’appel;
- crée l’appel actif;
- crée l’événement du poste de commandement.

## Important

Une page Web ne peut pas lire directement les SMS d’un iPhone. La variable du message doit donc toujours être transmise par Raccourcis.
