(async () => {
  "use strict";
  const scripts=[
    "firebase-config.js?v=25.0.14",
    "firebase-sync.js?v=25.0.14",
    "app.js?v=25.0.14",
    "preplans.js?v=25.0.14",
    "prevention.js?v=25.0.14",
    "assistant.js?v=25.0.14",
    "assistant-google-places-native.js?v=25.0.14",
    "navigation.js?v=25.0.14",
    "vehicle-accounts.js?v=25.0.14",
    "vehicles.js?v=25.0.14",
    "vehicle-usage.js?v=25.0.14",
    "command-center.js?v=25.0.14",
    "event-manager.js?v=25.0.14"
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
      const registration=await navigator.serviceWorker.register("service-worker.js?v=25.0.14",{updateViaCache:"none"});
      registration.update().catch(()=>{});
    }catch(error){
      console.warn("Service worker FireMap indisponible.",error);
    }
  }
})();
