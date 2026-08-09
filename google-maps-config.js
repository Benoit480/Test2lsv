// FireMap — configuration Google Maps / recherche d’adresse Google
// La clé doit rester restreinte au site GitHub Pages FireMap et aux API autorisées.
window.FIREMAP_GOOGLE_MAPS_API_KEY = "AIzaSyD20E6icu8pdOsTDZApecCLT7T7O9bFAgU";

// Configuration partagée avec la recherche Google Places.
window.FIREMAP_GOOGLE_CONFIG = {
  apiKey: window.FIREMAP_GOOGLE_MAPS_API_KEY,
  language: "fr",
  region: "CA",
  louisevilleCenter: { lat: 46.2563, lng: -72.9417 },
  locationBiasRadiusMeters: 50000
};
