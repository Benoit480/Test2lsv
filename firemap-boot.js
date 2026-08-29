(async () => {
  "use strict";
  const scripts=[
    "firebase-config.js?v=25.0.8",
    "firebase-sync.js?v=25.0.8",
    "app.js?v=25.0.8",
    "google-address-search.js?v=25.0.8",
    "preplans.js?v=25.0.8",
    "prevention.js?v=25.0.8",
    "assistant.js?v=25.0.8",
    "navigation.js?v=25.0.8",
    "vehicle-accounts.js?v=25.0.8",
    "vehicles.js?v=25.0.8",
    "vehicle-usage.js?v=25.0.8",
    "command-center.js?v=25.0.8",
    "event-manager.js?v=25.0.8"
  ];

  // V25.0.5: FireMap starts immediately. Google Maps may finish later.
  // The map adapter already waits internally for window.fireMapGoogleReady.
  for(const src of scripts){
    await new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src=src;
      s.onload=resolve;
      s.onerror=()=>reject(new Error(`Impossible de charger ${src}`));
      document.body.appendChild(s);
    });
  }

  // Re-register/update the PWA cache explicitly.
  if("serviceWorker" in navigator){
    try{
      const registration=await navigator.serviceWorker.register("service-worker.js?v=25.0.8",{updateViaCache:"none"});
      registration.update().catch(()=>{});
    }catch(error){
      console.warn("Service worker FireMap indisponible.",error);
    }
  }
})();
