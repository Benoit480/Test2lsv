(async () => {
  "use strict";
  const scripts=[
    "firebase-config.js?v=25.0.2",
    "firebase-sync.js?v=25.0.2",
    "app.js?v=25.0.2",
    "preplans.js?v=25.0.2",
    "prevention.js?v=25.0.2",
    "assistant.js?v=25.0.2",
    "navigation.js?v=25.0.2",
    "vehicle-accounts.js?v=25.0.2",
    "vehicles.js?v=25.0.2",
    "vehicle-usage.js?v=25.0.4",
    "command-center.js?v=25.0.4",
    "event-manager.js?v=25.0.2"
  ];
  try{await window.fireMapGoogleReady;}catch(e){console.error(e);return;}
  for(const src of scripts){await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)});}
})();
