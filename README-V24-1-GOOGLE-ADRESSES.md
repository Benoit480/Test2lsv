# FireMap V24.1.0 — Recherche Google + Louiseville hors ligne

## Fonctionnement
- En ligne + clé Google : Place Autocomplete Google est utilisé.
- Hors ligne : uniquement `louiseville_adresses.json`.
- Si Google ne répond pas : repli automatique vers Louiseville.
- Les résultats Google ne sont pas copiés dans la banque hors ligne.

## Activer Google
1. Ouvrir `google-maps-config.js`.
2. Remplacer :
   `apiKey: "",`
   par :
   `apiKey: "VOTRE_CLE_GOOGLE",`
3. Enregistrer sur GitHub.

La clé doit être restreinte à votre site GitHub Pages et aux API nécessaires.

## API Google à activer
- Maps JavaScript API
- Places API (New)

## Hors ligne
Le service worker V24.1 met en cache l'application et la banque d'adresses de Louiseville. Il ne met pas les données Google Places en cache.
