(() => {
  "use strict";

  const BUILD="25.0.9";
  const INPUTS=[
    {input:"addressSearch",box:"results",status:"searchStatus",mode:"select"},
    {input:"addressSearchFull",box:"resultsFull",status:"searchStatusFull",mode:"select"},
    {input:"assistantAddress",box:"assistantSuggestions",status:null,mode:"assistant"}
  ];
  const cfg=window.FIREMAP_GOOGLE_CONFIG||{};
  const I=window.fireMapInternal;
  let placesLib=null;
  let token=null;
  let newestRequestId=0;
  let debounceTimer=null;
  let googleLoadPromise=null;

  const $=id=>document.getElementById(id);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const configured=()=>Boolean(String(cfg.apiKey||"").trim());
  const online=()=>navigator.onLine!==false;

  function localAddresses(){ return I?.getAddresses?.()||[]; }
  function normAddress(value){ return I?.addressNorm?.(value)||String(value||"").toLowerCase(); }

  function localSearch(query){
    const terms=normAddress(query).split(" ").filter(Boolean);
    if(!terms.length)return [];
    return localAddresses()
      .filter(a=>terms.every(t=>String(a.rechercheNormalisee||normAddress([a.adresse,a.codePostal,a.recherche].filter(Boolean).join(" "))).includes(t)))
      .sort((a,b)=>String(a.adresse||"").localeCompare(String(b.adresse||""),"fr",{numeric:true}))
      .slice(0,35);
  }

  function localStatusText(extra=""){
    const n=localAddresses().length.toLocaleString("fr-CA");
    return `Hors ligne — ${n} adresses de Louiseville${extra}`;
  }

  function renderLocal(spec,query,message=""){
    const box=$(spec.box), status=spec.status?$(spec.status):null;
    if(!box)return;
    const items=localSearch(query);
    box.innerHTML=items.map(a=>{
      const idx=localAddresses().indexOf(a);
      return `<button class="result-item local-address-result" data-address-index="${idx}"><span class="pin">📍</span><span><strong>${esc(a.adresse)}</strong><small>Louiseville — banque hors ligne</small></span></button>`;
    }).join("");
    if(status)status.textContent=message || (query.trim()
      ? (items.length?`${items.length} résultat(s) Louiseville — mode hors ligne`:`Aucune adresse de Louiseville trouvée`)
      : localStatusText());
  }

  function loadGoogle(){
    if(!configured())return Promise.reject(new Error("Clé Google non configurée"));
    if(window.google?.maps?.importLibrary)return Promise.resolve(window.google.maps);
    if(googleLoadPromise)return googleLoadPromise;

    googleLoadPromise=new Promise((resolve,reject)=>{
      const callback=`__fireMapGoogleReady_${Date.now()}`;
      window[callback]=()=>{
        delete window[callback];
        resolve(window.google.maps);
      };
      const script=document.createElement("script");
      const params=new URLSearchParams({
        key:String(cfg.apiKey).trim(),
        v:"weekly",
        loading:"async",
        callback,
        language:cfg.language||"fr",
        region:cfg.region||"CA"
      });
      script.src=`https://maps.googleapis.com/maps/api/js?${params}`;
      script.async=true;
      script.onerror=()=>reject(new Error("Google Maps JavaScript API non chargée"));
      document.head.appendChild(script);
    });
    return googleLoadPromise;
  }

  async function ensurePlaces(){
    await loadGoogle();
    if(!placesLib)placesLib=await google.maps.importLibrary("places");
    if(!token)token=new placesLib.AutocompleteSessionToken();
    return placesLib;
  }

  function googleBranding(){
    return `<div class="google-results-brand" aria-label="Résultats Google"><span>Résultats</span><strong>Google</strong></div>`;
  }

  async function renderGoogle(spec,query,requestId){
    const box=$(spec.box),status=spec.status?$(spec.status):null;
    if(!box)return;
    if(query.trim().length<3){
      box.innerHTML="";
      if(status)status.textContent="Google — entrez au moins 3 caractères";
      return;
    }

    if(status)status.textContent="Recherche Google…";
    const lib=await ensurePlaces();
    const center=cfg.louisevilleCenter||{lat:46.2563,lng:-72.9417};
    const radius=Number(cfg.locationBiasRadiusMeters)||50000;
    const request={
      input:query,
      sessionToken:token,
      language:cfg.language==="fr"?"fr-CA":cfg.language,
      region:String(cfg.region||"CA").toLowerCase(),
      locationBias:{center,radius}
    };
    const response=await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
    if(requestId!==newestRequestId)return;
    const predictions=(response.suggestions||[]).map(x=>x.placePrediction).filter(Boolean).slice(0,8);
    box.innerHTML=predictions.map((prediction,index)=>
      `<button class="result-item google-address-result" data-google-result="${index}"><span class="pin">📍</span><span><strong>${esc(prediction.text.toString())}</strong><small>Google</small></span></button>`
    ).join("") + (predictions.length?googleBranding():"");
    box._fireMapGooglePredictions=predictions;
    box._fireMapGoogleSpec=spec;
    if(status)status.textContent=predictions.length?`${predictions.length} résultat(s) Google`:`Aucun résultat Google`;
  }

  async function selectGooglePrediction(box,index){
    const prediction=box?._fireMapGooglePredictions?.[index];
    if(!prediction)return;
    try{
      const place=prediction.toPlace();
      await place.fetchFields({fields:["formattedAddress","location","displayName"]});
      const location=place.location;
      const lat=typeof location?.lat==="function"?location.lat():Number(location?.lat);
      const lng=typeof location?.lng==="function"?location.lng():Number(location?.lng);
      if(!Number.isFinite(lat)||!Number.isFinite(lng))throw new Error("Coordonnées absentes");
      const address=String(place.formattedAddress||place.displayName||prediction.text.toString());
      const selected={
        adresse:address,
        lat,lng,
        source:"google",
        placeId:String(place.id||"")
      };
      if(box?._fireMapGoogleSpec?.mode==="assistant" && typeof window.fireMapAssistantStartAddress==="function"){
        const input=document.getElementById("assistantAddress");
        if(input)input.value=address;
        box.innerHTML="";
        window.fireMapAssistantStartAddress(selected);
      }else{
        I.selectAddress(selected);
      }
      token=new placesLib.AutocompleteSessionToken();
    }catch(error){
      console.warn("Sélection Google impossible",error);
      I.toast?.("Impossible d’ouvrir cette adresse Google.");
    }
  }

  function performSearch(spec,value){
    const query=String(value||"");
    if(!query.trim()){
      $(spec.box).innerHTML="";
      const status=spec.status?$(spec.status):null;
      if(status)status.textContent=online()&&configured()
        ? "Google en ligne — Louiseville disponible hors ligne"
        : localStatusText(configured()?"":" — Google non configuré");
      return;
    }

    if(!online()||!configured()){
      renderLocal(spec,query,configured()?"":"Google non configuré — recherche Louiseville seulement");
      return;
    }

    const requestId=++newestRequestId;
    clearTimeout(debounceTimer);
    debounceTimer=setTimeout(async()=>{
      try{
        await renderGoogle(spec,query,requestId);
      }catch(error){
        console.warn("Recherche Google indisponible, repli Louiseville",error);
        renderLocal(spec,query,"Google indisponible — résultats Louiseville");
      }
    },230);
  }

  function bindInput(spec){
    const input=$(spec.input);
    if(!input)return;
    // Capture phase: when online+configured, prevent the old local renderer from replacing Google results.
    input.addEventListener("input",event=>{
      if(online()&&configured()){
        event.stopImmediatePropagation();
      }
      performSearch(spec,input.value);
    },true);
  }

  function refreshMode(){
    INPUTS.forEach(spec=>{
      const input=$(spec.input);
      if(input)performSearch(spec,input.value);
    });
    document.body?.classList.toggle("firemap-google-online",online()&&configured());
  }

  document.addEventListener("click",event=>{
    const button=event.target.closest("[data-google-result]");
    if(!button)return;
    event.preventDefault();
    const box=button.closest(".results");
    selectGooglePrediction(box,Number(button.dataset.googleResult));
  });

  window.addEventListener("online",refreshMode);
  window.addEventListener("offline",refreshMode);

  function boot(){
    INPUTS.forEach(bindInput);
    refreshMode();
    window.fireMapGoogleAddressSearch={
      build:BUILD,
      configured,
      mode:()=>online()&&configured()?"google":"louiseville-offline",
      refresh:refreshMode
    };
    console.info(`[FireMap] Recherche hybride V${BUILD}: ${online()&&configured()?"Google":"Louiseville local"}`);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
