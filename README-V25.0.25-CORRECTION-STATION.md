# FireMap V25.0.25
Correction de l'erreur `Can't find variable: STATION`.

Le repli ajouté en V25.0.24 ne dépend plus d'une variable globale `STATION`.
Si `stationMarker` n'expose pas `getLatLng()`, FireMap ignore ce point au lieu de provoquer une erreur.
Toutes les autres fonctions sont conservées.
