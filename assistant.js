(()=>{
  "use strict";
  const $=id=>document.getElementById(id);
  const I=window.fireMapInternal;
  if(!I)return;
  let active=null, matchedBuilding=null, nearest=[];
  const esc=I.esc;
  const dist=(a,b)=>{const R=6371000,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lng-a.lng)*Math.PI/180,x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))};
  const fmt=m=>m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(1)} km`;
  const flow=p=>Number(p.flowGpm||p.flowRate||0);
  const flowLabel=p=>{const g=flow(p);return g>=1500?"🔵 ≥ 1 500 gal/min":g>=1000?"🟢 1 000 à 1 499 gal/min":g>=500?"🟠 500 à 999 gal/min":"🔴 < 500 gal/min"};
  function findBuilding(a){const bs=window.fireMapPreplans?.getBuildings?.()||[];const n=I.addressNorm(a.adresse||"");return bs.map(b=>({b,d:dist(a,b)})).sort((x,y)=>x.d-y.d).find(x=>x.d<=90||I.addressNorm(x.b.address||"")===n)?.b||null}
  async function computeHydrants(a){return I.rankHydrantsByRoad?await I.rankHydrantsByRoad(a,5):I.getHydrants().filter(p=>p.status!=="out_of_service"&&isFinite(p.lat)&&isFinite(p.lng)).map(p=>({...p,distance:dist(a,p),roadDistance:false})).sort((x,y)=>x.distance-y.distance).slice(0,5)}
  function criticalCard(icon,title,text,urgent=false){return `<article class="assistant-critical ${urgent?'urgent':''}"><span>${icon}</span><div><small>${title}</small><strong>${esc(text||"Non indiqué")}</strong></div></article>`}
  async function render(){if(!active)return;matchedBuilding=findBuilding(active);$("assistantEmpty").classList.add("hidden");$("assistantDashboard").classList.remove("hidden");$("assistantActiveAddress").textContent=active.adresse;$("assistantPreplanStatus").textContent=matchedBuilding?`Préplan trouvé : ${matchedBuilding.name}`:"Aucun préplan associé à cette adresse";
    const b=matchedBuilding;
    $("assistantCritical").innerHTML=(active.callType?criticalCard("🚨","NATURE DE L’APPEL",active.callType,true):"")+(active.alarmLevel?criticalCard("🔔","NIVEAU / CAS",active.alarmLevel):"")+(b?[criticalCard("⚠️","RISQUES PARTICULIERS",b.risks,!!b.risks),criticalCard("💧","FDC / PRISE POMPIER",b.fdc),criticalCard("⚡","COUPURE ÉLECTRIQUE",b.electrical),criticalCard("🔥","GAZ / PROPANE",b.gas),criticalCard("☣️","MATIÈRES DANGEREUSES",b.hazmat,!!b.hazmat),criticalCard("🚪","ACCÈS POMPIER",b.access)].join(""):criticalCard("ℹ️","PRÉPLAN","Aucun bâtiment à risque enregistré à proximité"));
    $("assistantHydrants").innerHTML='<p class="muted">Calcul des distances réelles par la route…</p>';
    nearest=await computeHydrants(active);
    const routeLabel=p=>p.roadDistance?`${fmt(p.distance)} par la route`:`${fmt(p.distance)} à vol d’oiseau`;
    $("assistantHydrants").innerHTML=nearest.map((p,i)=>`<article class="assistant-hydrant ${i===0?'recommended':''}"><div class="assistant-rank">${i+1}</div><div><strong>${esc(p.name||"Borne")}</strong><span>${esc(p.address||"Adresse non inscrite")}</span><small>${flowLabel(p)} · ${routeLabel(p)}${isFinite(p.duration)?` · ~${Math.max(1,Math.round(p.duration/60))} min`:""} · ${p.status==="restricted"?"À inspecter":"Disponible"}</small></div><button data-assistant-hydrant="${esc(p.id)}" class="secondary small">Carte</button></article>`).join("")||"<p>Aucune borne disponible.</p>";
    $("assistantPreplanPanel").classList.toggle("hidden",!b);if(b)$("assistantPreplanSummary").innerHTML=`<div class="assistant-summary"><strong>${esc(b.name)}</strong><span>Risque ${esc(b.risk||"non défini")} · ${esc(String(b.floors||"?"))} étage(s)</span><p>${esc(b.attackSide||b.notes||"Consultez le préplan complet pour les détails opérationnels.")}</p></div>`;
  }
  function start(a,meta={}){
    const startedAt=meta.startedAt||new Date().toISOString();
    const callId=String(
      meta.callId||
      meta.eventId||
      `call-${startedAt.replace(/\D/g,"").slice(0,14)}-${I.addressNorm(a.adresse||"").replace(/\s+/g,"-").slice(0,45)}`
    );
    active={...a,...meta,callId,startedAt};
    try{localStorage.setItem("firemap-active-call",JSON.stringify(active))}catch(_){}
    $("assistantAddress").value=a.adresse;
    I.selectAddress(a,false);
    I.showView("assistant");
    render();
    window.dispatchEvent(new CustomEvent("firemap:call-active",{detail:{
      ...active,
      callId,
      eventId:callId,
      adresse:active.adresse||a.adresse||"",
      address:active.adresse||a.adresse||"",
      callType:active.callType||meta.callType||"Intervention",
      alarmLevel:active.alarmLevel||meta.alarmLevel||"",
      startedAt
    }}));
  }
  function suggestions(){const q=$("assistantAddress").value.trim();if(q.length<2){$("assistantSuggestions").innerHTML="";return}const nq=I.addressNorm(q);const list=I.getAddresses().filter(a=>I.addressNorm(a.adresse).includes(nq)).slice(0,8);$("assistantSuggestions").innerHTML=list.map((a,i)=>`<button type="button" data-assistant-address="${i}"><strong>${esc(a.adresse)}</strong></button>`).join("");$("assistantSuggestions")._items=list}

  function cleanSms(text){return String(text||"").replace(/https?:\/\/\S+/gi," ").replace(/[()]/g," ").replace(/\s+/g," ").trim()}
  function addressBase(address){
    return String(address?.adresse||"")
      .replace(/,\s*Louiseville(?:\s+[A-Z]\d[A-Z]\s?\d[A-Z]\d)?\s*$/i,"")
      .trim();
  }
  function extractDispatchAddress(text){
    const cleaned=cleanSms(text);
    const patterns=[
      /\bAU\s+(.+?)\s*,\s*LOUISEVILLE\b/i,
      /\bA[UÙ]\s+(.+?)\s*,\s*LOUISEVILLE\b/i,
      /\b(?:ADRESSE|LIEU)\s*[:\-]\s*(.+?)\s*,\s*LOUISEVILLE\b/i
    ];
    for(const pattern of patterns){
      const match=cleaned.match(pattern);
      if(match?.[1])return match[1].replace(/\s+/g," ").trim();
    }
    return "";
  }
  function findAddressByExtracted(extracted){
    if(!extracted)return null;
    const addresses=I.getAddresses();
    const target=I.addressNorm(extracted);
    if(!target)return null;
    const exact=addresses.find(a=>I.addressNorm(addressBase(a))===target);
    if(exact)return exact;
    const targetParts=target.split(" ").filter(Boolean);
    const civic=targetParts.find(x=>/^\d+[a-z]?$/.test(x));
    const streetWords=targetParts.filter(x=>x!==civic);
    const scored=addresses.map(a=>{
      const base=I.addressNorm(addressBase(a));
      const parts=base.split(" ").filter(Boolean);
      const number=parts.find(x=>/^\d+[a-z]?$/.test(x));
      let score=0;
      if(civic&&number===civic)score+=2000;
      else if(civic)score-=2000;
      for(const word of streetWords){if(parts.includes(word))score+=120;}
      if(streetWords.length&&streetWords.every(w=>parts.includes(w)))score+=1200;
      if(base.includes(target)||target.includes(base))score+=800;
      return {a,score};
    }).sort((x,y)=>y.score-x.score);
    return scored[0]?.score>=2000?scored[0].a:null;
  }
  function findAddressInSms(text){
    const extracted=extractDispatchAddress(text);
    const strict=findAddressByExtracted(extracted);
    if(strict)return {address:strict,extracted};
    return {address:null,extracted};
  }
  function parseDispatchSms(text){
    const raw=String(text||"").trim();
    const cleaned=cleanSms(raw);
    const found=findAddressInSms(cleaned);
    const address=found.address;
    const extractedAddress=found.extracted;
    let callType="";
    const natureMatch=cleaned.match(/^\s*Louiseville\s+(.+?)\s+A[UÙ]\s+/i);
    if(natureMatch?.[1])callType=natureMatch[1].trim();
    if(!callType)callType="Appel de répartition";
    const alarm=(cleaned.match(/(?:1\s*(?:ERE|RE)|2\s*(?:E|EME)|3\s*(?:E|EME))\s+ALARME(?:\s+CAS\s+[^,.]+)?/i)||cleaned.match(/CAS\s+[^,.]+/i)||[])[0]||"";
    const vehicles=[];
    const tail=cleaned.match(/CAS\s+\d+\s*[,;]?\s*((?:\d{2,4}\s*[,;]\s*)*\d{2,4})/i)?.[1]||"";
    for(const value of tail.split(/[,;]\s*/)){if(/^\d{2,4}$/.test(value)&&!vehicles.includes(value))vehicles.push(value)}
    return {raw,address,extractedAddress,callType,alarmLevel:alarm,vehicles};
  }
  function showDispatchPreview(parsed){
    const box=$("dispatchPreview");
    box.classList.remove("hidden");
    box.innerHTML=`<strong>${parsed.address?"✅ Appel détecté":"⚠️ Adresse à vérifier"}</strong><span><b>Nature :</b> ${esc(parsed.callType||"Non détectée")}</span><span><b>Adresse extraite :</b> ${esc(parsed.extractedAddress||"Non détectée")}</span><span><b>Adresse confirmée :</b> ${esc(parsed.address?.adresse||"Aucune correspondance exacte dans la banque")}</span>${parsed.alarmLevel?`<span><b>Niveau :</b> ${esc(parsed.alarmLevel)}</span>`:""}${parsed.vehicles?.length?`<span><b>Véhicules :</b> ${esc(parsed.vehicles.join(" • "))}</span>`:""}`;
  }
  function importDispatchSms(text){
    const parsed=parseDispatchSms(text);
    showDispatchPreview(parsed);
    if(!parsed.address){I.toast("Adresse non reconnue. Vérifiez le SMS ou entrez l’adresse manuellement.");return false}
    start(parsed.address,{callType:parsed.callType,alarmLevel:parsed.alarmLevel,dispatchRaw:parsed.raw,startedAt:new Date().toISOString()});
    $("smsImportCard").open=false;
    I.toast("Appel actif créé à partir du SMS.");
    return true;
  }

  $("assistantAddress").addEventListener("input",suggestions);
  document.addEventListener("click",e=>{const a=e.target.closest("[data-assistant-address]");if(a){const item=$("assistantSuggestions")._items?.[Number(a.dataset.assistantAddress)];if(item)start(item)}const h=e.target.closest("[data-assistant-hydrant]");if(h){const p=I.getHydrants().find(x=>x.id===h.dataset.assistantHydrant);if(p){I.showView("map");I.map.setView([p.lat,p.lng],18);I.state.markers.get(p.id)?.openPopup()}}});
  $("assistantLaunch").onclick=()=>{const q=$("assistantAddress").value.trim();const nq=I.addressNorm(q);const a=I.getAddresses().find(x=>I.addressNorm(x.adresse)===nq)||I.getAddresses().find(x=>I.addressNorm(x.adresse).includes(nq));a?start(a):I.toast("Adresse introuvable dans la banque de Louiseville.")};
  $("assistantUseActive").onclick=()=>I.state.selected?start(I.state.selected):I.toast("Sélectionnez d’abord une adresse sur la carte.");
  $("pasteDispatchSms").onclick=async()=>{try{const text=await navigator.clipboard.readText();$("dispatchSms").value=text;showDispatchPreview(parseDispatchSms(text))}catch(e){I.toast("Maintenez le doigt dans la zone de texte, puis choisissez Coller.");$("dispatchSms").focus()}};
  $("analyzeDispatchSms").onclick=()=>importDispatchSms($("dispatchSms").value);
  $("dispatchSms").addEventListener("input",()=>{const t=$("dispatchSms").value.trim();if(t.length>10)showDispatchPreview(parseDispatchSms(t));else $("dispatchPreview").classList.add("hidden")});
  $("assistantNavigate").onclick=()=>active&&window.fireMapNavigation?.start(active);
  $("assistantBackMap").onclick=()=>I.showView("map");
  $("assistantShowMap").onclick=()=>{if(!active)return;I.showView("map");const pts=[[active.lat,active.lng],...nearest.slice(0,3).map(p=>[p.lat,p.lng])];I.map.fitBounds(pts,{padding:[45,45]})};
  $("assistantOpenPreplan").onclick=()=>matchedBuilding&&window.fireMapPreplans?.openPreplanById(matchedBuilding.id);
  $("assistantEnd").onclick=()=>{active=null;matchedBuilding=null;nearest=[];I.clearIntervention();$("assistantDashboard").classList.add("hidden");$("assistantEmpty").classList.remove("hidden");$("assistantAddress").value="";I.showView("map")};

  window.fireMapDispatch={parse:parseDispatchSms,importText:importDispatchSms};
  window.addEventListener("load",()=>{
    const params=new URLSearchParams(location.search);
    const shared=params.get("appel")||params.get("sms")||params.get("text");
    if(shared){I.showView("assistant");$("smsImportCard").open=true;$("dispatchSms").value=shared;setTimeout(()=>importDispatchSms(shared),350);history.replaceState({},"",location.pathname)}
  });
})();


/* FireMap V20.2.3 — événements de verrouillage des fiches */
(function(){
  const dispatch=(name,detail={})=>window.dispatchEvent(new CustomEvent(name,{detail}));
  const originalSetItem=localStorage.setItem.bind(localStorage);
  const originalRemoveItem=localStorage.removeItem.bind(localStorage);

  localStorage.setItem=function(key,value){
    originalSetItem(key,value);
    if(/active[-_ ]?(call|intervention)|appel[-_ ]?actif/i.test(key)){
      dispatch("firemap:intervention-started",{key,value});
    }
  };
  localStorage.removeItem=function(key){
    originalRemoveItem(key);
    if(/active[-_ ]?(call|intervention)|appel[-_ ]?actif/i.test(key)){
      dispatch("firemap:intervention-ended",{key});
    }
  };

  window.fireMapInterventionLock={
    start(detail={}){dispatch("firemap:intervention-started",detail)},
    end(detail={}){dispatch("firemap:intervention-ended",detail)}
  };
})();
