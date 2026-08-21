(async () => {
  "use strict";
  const scripts=[
    "firebase-config.js?v=25.0.6",
    "firebase-sync.js?v=25.0.6",
    "app.js?v=25.0.6",
    "preplans.js?v=25.0.6",
    "prevention.js?v=25.0.6",
    "assistant.js?v=25.0.6",
    "navigation.js?v=25.0.6",
    "vehicle-accounts.js?v=25.0.6",
    "vehicles.js?v=25.0.6",
    "vehicle-usage.js?v=25.0.6",
    "command-center.js?v=25.0.6",
    "event-manager.js?v=25.0.6"
  ];

  // V25.0.6: FireMap starts immediately. Google Maps may finish later.
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
      const registration=await navigator.serviceWorker.register("service-worker.js?v=25.0.6",{updateViaCache:"none"});
      registration.update().catch(()=>{});
    }catch(error){
      console.warn("Service worker FireMap indisponible.",error);
    }
  }
})();
