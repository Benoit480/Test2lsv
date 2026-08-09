(async () => {
  "use strict";
  const scripts=[
    "firebase-config.js?v=25.0.4",
    "firebase-sync.js?v=25.0.4",
    "app.js?v=25.0.4",
    "google-address-search.js?v=25.0.4",
    "preplans.js?v=25.0.4",
    "prevention.js?v=25.0.4",
    "assistant.js?v=25.0.4",
    "navigation.js?v=25.0.4",
    "vehicle-accounts.js?v=25.0.4",
    "vehicles.js?v=25.0.4",
    "vehicle-usage.js?v=25.0.4",
    "command-center.js?v=25.0.4",
    "event-manager.js?v=25.0.4"
  ];
  try{await window.fireMapGoogleReady;}catch(e){console.error(e);return;}
  for(const src of scripts){await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)});}
})();
