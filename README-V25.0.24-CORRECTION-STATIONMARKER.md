# FireMap V25.0.24
Correction de `stationMarker.getLatLng is not a function`.
L'appel est maintenant protégé : si le marqueur ne fournit pas `getLatLng`, FireMap utilise les coordonnées `STATION`.
Toutes les fonctions de V25.0.23 sont conservées.
