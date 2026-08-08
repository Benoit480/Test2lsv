# FireMap V25.0.2 — Correctif Google Routes

- Requête `Route.computeRoutes()` simplifiée selon l’API Maps JavaScript actuelle.
- Suppression des options de localisation/unités non nécessaires dans la requête de trajet.
- Conversion robuste des points du tracé et des manoeuvres.
- Route Matrix simplifiée de la même façon.
- En cas d’échec, FireMap affiche maintenant le message Google exact dans le panneau Navigation afin de distinguer immédiatement un problème de code, de quota ou de clé.
- Aucun changement à `google-maps-config.js` : la clé existante est conservée.
