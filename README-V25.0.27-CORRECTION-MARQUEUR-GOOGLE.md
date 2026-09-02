# FireMap V25.0.27
Correction à la source des erreurs du marqueur de caserne avec Google Maps.

Le MarkerAdapter Google supporte maintenant les méthodes Leaflet utilisées par FireMap :
- getLatLng()
- setLatLng()
- setPopupContent()

Cela corrige la chaîne d'erreurs :
- stationMarker.getLatLng is not a function
- Can't find variable: STATION
- null is not an object (evaluating pos.lat)
- stationMarker.setPopupContent is not a function

Les modifications du Centre de commandement sont conservées.
