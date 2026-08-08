# FireMap V25 — Google Maps

Cette version remplace la carte Leaflet/OpenStreetMap par Google Maps JavaScript API et remplace les calculs routiers OSRM par la bibliothèque Routes de Google Maps JavaScript.

## Une seule action obligatoire

Ouvrir `google-maps-config.js` et remplacer :

```js
window.FIREMAP_GOOGLE_MAPS_API_KEY = "COLLEZ_VOTRE_CLE_API_ICI";
```

par votre clé Google Maps sécurisée. Ne changez rien d’autre dans ce fichier.

La clé doit autoriser le référent :

`https://benoit480.github.io/Test2lsv/*`

et les API :

- Maps JavaScript API
- Geocoding API
- Routes API

## Fonctions converties

- Carte opérationnelle Google Maps
- Bornes-fontaines et fenêtres d’information
- Bâtiments / préplans
- Caserne et véhicules GPS
- Position utilisateur
- Sélection de position sur la carte
- Classement des bornes par distance routière via Route Matrix
- Tracés routiers vers les trois bornes recommandées
- Navigation intégrée via Google Routes
- Geocoding Google disponible pour les extensions futures

Les modules Firebase, événements, comptes véhicules, prévention et commandement sont conservés.
