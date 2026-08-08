(async () => {
  "use strict";
  const scripts=[
    "firebase-config.js?v=25.0.0",
    "firebase-sync.js?v=25.0.0",
    "app.js?v=25.0.0",
    "preplans.js?v=25.0.0",
    "prevention.js?v=25.0.0",
    "assistant.js?v=25.0.0",
    "navigation.js?v=25.0.0",
    "vehicle-accounts.js?v=25.0.0",
    "vehicles.js?v=25.0.0",
    "vehicle-usage.js?v=25.0.0",
    "command-center.js?v=25.0.0",
    "event-manager.js?v=25.0.0"
  ];
  try{await window.fireMapGoogleReady;}catch(e){console.error(e);return;}
  for(const src of scripts){await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)});}
})();
