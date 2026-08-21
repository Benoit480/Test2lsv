(() => {
  "use strict";
  const I=window.fireMapInternal;
  if(!I) return console.error("FireMap interne indisponible");
  const $=id=>document.getElementById(id), esc=I.esc, norm=I.norm;
  const layer=L.layerGroup().addTo(I.map);
  let buildings=[], markers=new Map(), pendingMapPoint=null, pendingMarkerRender=false;
  const BUILDINGS_CACHE_KEY="firemap-batiments-v1";
  const BUILDINGS_PENDING_KEY="firemap-batiments-pending-v1";
  const BUILDINGS_MIGRATED_KEY="firemap-batiments-cloud-migrated-v1";
  let cloudUnsubscribe=null, cloudConnected=false;
  window.addEventListener("firemap:map-idle",()=>{
    if(pendingMarkerRender)requestAnimationFrame(()=>renderMarkers());
  });
  function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||"")||fallback}catch(_){return fallback}}
  function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(e){console.warn("Stockage local indisponible",e)}}
  function loadCachedBuildings(){const list=readJson(BUILDINGS_CACHE_KEY,[]);return Array.isArray(list)?list:[]}
  function saveCachedBuildings(list){writeJson(BUILDINGS_CACHE_KEY,list)}
  function getPending(){const p=readJson(BUILDINGS_PENDING_KEY,{save:{},delete:{}});return {save:p?.save||{},delete:p?.delete||{}}}
  function setPending(p){writeJson(BUILDINGS_PENDING_KEY,p)}
  function queueSave(b){const p=getPending();p.save[b.id]=b;delete p.delete[b.id];setPending(p)}
  function queueDelete(id){const p=getPending();delete p.save[id];p.delete[id]=true;setPending(p)}
  function clearPendingSave(id){const p=getPending();delete p.save[id];setPending(p)}
  function clearPendingDelete(id){const p=getPending();delete p.delete[id];setPending(p)}
  const categoryLabel={school:"École",care:"CHSLD / résidence",industry:"Industrie",commercial:"Commerce",gas_station:"Station-service",municipal:"Municipal",hazmat:"Matières dangereuses",other:"Autre"};
  const categoryIcon={school:"🏫",care:"🏥",industry:"🏭",commercial:"🏢",gas_station:"⛽",municipal:"🏛️",hazmat:"☣️",other:"🏢"};
  const riskLabel={low:"Faible",medium:"Moyen",high:"Élevé",very_high:"Très élevé"};
  const riskColor={low:"#39d353",medium:"#ffd400",high:"#ff9500",very_high:"#ff3b30"};
  const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(16).slice(2);
  function canonical(b={}){return {id:String(b.id||uid()),name:String(b.name||"Bâtiment sans nom"),address:String(b.address||""),lat:Number(b.lat),lng:Number(b.lng),category:b.category||"other",risk:b.risk||"high",floors:Number(b.floors||0),basement:b.basement||"unknown",risks:b.risks||"",fdc:b.fdc||"",electrical:b.electrical||"",gas:b.gas||"",hazmat:b.hazmat||"",access:b.access||"",assembly:b.assembly||"",attackSide:b.attackSide||"",contactName:b.contactName||"",contactPhone:b.contactPhone||"",planUrl:b.planUrl||"",photoUrls:Array.isArray(b.photoUrls)?b.photoUrls:String(b.photoUrls||"").split(/\n+/).map(x=>x.trim()).filter(Boolean),notes:b.notes||"",preventionOccupancy:Number(b.preventionOccupancy||0),preventionAccessCode:b.preventionAccessCode||"",lastPreventionVisit:b.lastPreventionVisit||"",preventionInspector:b.preventionInspector||"",preventionNextReview:b.preventionNextReview||"",preventionScore:Number(b.preventionScore||0)}}
  function icon(b){const c=riskColor[b.risk]||"#ff9500",emoji=categoryIcon[b.category]||"🏢";return L.divIcon({className:"building-div-icon",html:`<div class="building-marker" style="--risk:${c}"><span>${emoji}</span></div>`,iconSize:[32,38],iconAnchor:[16,34],popupAnchor:[0,-32]})}
  function renderMarkers(){
    if(window.fireMapMapMoving){
      pendingMarkerRender=true;
      return;
    }
    pendingMarkerRender=false;
    layer.clearLayers();markers.clear();buildings.forEach(b=>{if(!isFinite(b.lat)||!isFinite(b.lng))return;const m=L.marker([b.lat,b.lng],{icon:icon(b)}).bindPopup(`<strong>${esc(b.name)}</strong><br>${esc(b.address)}<br><span class="risk-badge ${b.risk}">${riskLabel[b.risk]}</span><br><button data-open-preplan="${esc(b.id)}">Ouvrir la fiche</button>`).addTo(layer);markers.set(b.id,m)})}
  function renderList(){const q=norm($("buildingSearch").value),rf=$("riskFilter").value;const list=buildings.filter(b=>(!rf||b.risk===rf)&&(!q||norm(Object.values(b).join(" ")).includes(q))).sort((a,b)=>a.name.localeCompare(b.name,"fr"));$("buildingList").innerHTML=list.map(b=>`<article class="card-item building-card"><div class="building-list-icon" style="--risk:${riskColor[b.risk]}">${categoryIcon[b.category]}</div><div class="card-content"><h3>${esc(b.name)}</h3><span class="risk-badge ${b.risk}">${riskLabel[b.risk]}</span><p>${esc(b.address)||"Adresse non inscrite"}</p><p>${categoryLabel[b.category]} · ${b.floors||"?"} étage(s)</p><div class="card-actions"><button class="secondary" data-show-building="${esc(b.id)}">Ouvrir</button><button class="secondary" data-edit-building="${esc(b.id)}">Modifier</button><button class="primary" data-nav-building="${esc(b.id)}">GPS</button></div></div></article>`).join("")||'<div class="card-item">Aucun bâtiment enregistré.</div>'}
  function setBuildings(items,{persist=true}={}){buildings=items.map(canonical);if(persist)saveCachedBuildings(buildings);renderMarkers();renderList();window.dispatchEvent(new CustomEvent("firemap:buildings-updated",{detail:{buildings:buildings.slice()}}))}
  function openChoice(point=null){if(point){pendingMapPoint={lat:Number(point.lat),lng:Number(point.lng)};I.state.lastMapClick={...pendingMapPoint}}else pendingMapPoint=null;$("addChoiceDialog").showModal() }
  function mapPoint(){return pendingMapPoint||I.state.lastMapClick||I.state.user||{lat:I.map.getCenter().lat,lng:I.map.getCenter().lng}}
  function openForm(b=null){
    const p=mapPoint(),isNew=!b;
    $("buildingDialog").classList.toggle("new-building-mode",isNew);
    $("buildingModalTitle").textContent=isNew?"Nouveau bâtiment — Identification":`Modifier — ${b.name}`;
    $("newBuildingHelp")?.classList.toggle("hidden",!isNew);
    $("saveBuildingButton").textContent=isNew?"Continuer vers la fiche Prévention":"Enregistrer";
    $("buildingId").value=b?.id||"";
    $("buildingName").value=b?.name||"";
    $("buildingCategory").value=b?.category||"other";
    $("buildingAddress").value=b?.address||I.nearestAddress?.(p)||I.state.selected?.adresse||"";
    $("buildingLat").value=b?.lat??I.state.selected?.lat??p.lat.toFixed(7);
    $("buildingLng").value=b?.lng??I.state.selected?.lng??p.lng.toFixed(7);
    $("buildingRisk").value=b?.risk||"high";
    $("buildingFloors").value=b?.floors||1;
    $("buildingBasement").value=b?.basement||"no";
    $("buildingRisks").value=b?.risks||"";
    $("buildingFdc").value=b?.fdc||"";
    $("buildingElectrical").value=b?.electrical||"";
    $("buildingGas").value=b?.gas||"";
    $("buildingHazmat").value=b?.hazmat||"";
    $("buildingAccess").value=b?.access||"";
    $("buildingAssembly").value=b?.assembly||"";
    $("buildingAttackSide").value=b?.attackSide||"";
    $("buildingContactName").value=b?.contactName||"";
    $("buildingContactPhone").value=b?.contactPhone||"";
    $("buildingPlanUrl").value=b?.planUrl||"";
    $("buildingPhotoUrls").value=(b?.photoUrls||[]).join("\n");
    $("buildingNotes").value=b?.notes||"";
    $("deleteBuilding").classList.toggle("hidden",isNew);
    $("buildingDialog").showModal();
  }
  function fromForm(){return canonical({id:$("buildingId").value||uid(),name:$("buildingName").value,address:$("buildingAddress").value,lat:$("buildingLat").value,lng:$("buildingLng").value,category:$("buildingCategory").value,risk:$("buildingRisk").value,floors:$("buildingFloors").value,basement:$("buildingBasement").value,risks:$("buildingRisks").value,fdc:$("buildingFdc").value,electrical:$("buildingElectrical").value,gas:$("buildingGas").value,hazmat:$("buildingHazmat").value,access:$("buildingAccess").value,assembly:$("buildingAssembly").value,attackSide:$("buildingAttackSide").value,contactName:$("buildingContactName").value,contactPhone:$("buildingContactPhone").value,planUrl:$("buildingPlanUrl").value,photoUrls:$("buildingPhotoUrls").value,notes:$("buildingNotes").value})}
  async function save(){
    const wasNew=!$("buildingId").value;
    const b=fromForm();
    if(!b.name.trim()||!b.address.trim())return I.toast("Nom et adresse requis.");
    if(!isFinite(b.lat)||!isFinite(b.lng))return I.toast("Coordonnées invalides.");
    const i=buildings.findIndex(x=>x.id===b.id);
    if(i>=0)buildings[i]=b;else buildings.push(b);
    queueSave(b);
    setBuildings(buildings);
    $("buildingDialog").close();
    const c=window.fireMapCloud;
    try{
      if(!c?.configured||!c.saveBuilding)throw new Error("Firebase pas encore prêt");
      await c.saveBuilding(b);
      clearPendingSave(b.id);
      I.toast(wasNew?"Bâtiment créé. Complétez maintenant la fiche Prévention.":"Bâtiment enregistré et synchronisé.");
    }catch(e){
      console.error(e);
      I.toast(wasNew?"Bâtiment créé localement. Complétez la fiche Prévention.":"Bâtiment sauvegardé; synchronisation automatique en attente.");
    }finally{
      if(wasNew){
        setTimeout(()=>{
          if(window.fireMapPrevention?.open)window.fireMapPrevention.open(b.id);
          else I.toast("La fiche Prévention sera disponible dans le menu Bâtiments.");
        },150);
      }
    }
  }
  async function remove(){const id=$("buildingId").value;if(!id||!confirm("Supprimer définitivement ce bâtiment et son préplan?"))return;buildings=buildings.filter(b=>b.id!==id);queueDelete(id);setBuildings(buildings);$("buildingDialog").close();const c=window.fireMapCloud;try{if(!c?.configured||!c.deleteBuilding)throw new Error("Firebase pas encore prêt");await c.deleteBuilding(id);clearPendingDelete(id);I.toast("Bâtiment supprimé et synchronisé.")}catch(e){console.error(e);I.toast("Suppression enregistrée; synchronisation automatique en attente.")}}
  function section(title,icon,text){if(!text)return "";return `<section class="preplan-section"><h3>${icon} ${title}</h3><p>${esc(text).replace(/\n/g,"<br>")}</p></section>`}
  function openPreplan(b){if(!b)return;const photos=(b.photoUrls||[]).map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Photo du bâtiment" loading="lazy"></a>`).join("");$("preplanContent").innerHTML=`<div class="modal-head"><div><small>PRÉPLAN OPÉRATIONNEL</small><h2>${esc(b.name)}</h2></div><button type="button" data-close-preplan>×</button></div><div class="preplan-hero"><div class="building-list-icon large" style="--risk:${riskColor[b.risk]}">${categoryIcon[b.category]}</div><div><strong>${esc(b.address)}</strong><span>${categoryLabel[b.category]} · Risque ${riskLabel[b.risk]} · ${b.floors||"?"} étage(s)</span>${b.lastPreventionVisit?`<small class="building-prevention-meta">Dernière prévention : ${esc(b.lastPreventionVisit)}${b.preventionInspector?` — ${esc(b.preventionInspector)}`:""}${b.preventionScore?` · ${esc(String(b.preventionScore))}%`:""}</small>`:""}</div></div><div class="preplan-actions"><button class="primary" data-nav-building="${esc(b.id)}">➤ Naviguer</button><button class="secondary" data-map-building="${esc(b.id)}">🗺️ Voir sur la carte</button><button class="secondary prevention-open-btn" data-open-prevention="${esc(b.id)}">🛡️ Prévention</button>${b.planUrl?`<a class="button-link primary" href="${esc(b.planUrl)}" target="_blank" rel="noopener">📄 Ouvrir le plan</a>`:""}</div><div class="preplan-grid">${section("Risques particuliers","⚠️",b.risks)}${section("FDC / prise pompier","💧",b.fdc)}${section("Électricité","⚡",b.electrical)}${section("Gaz / propane","🔥",b.gas)}${section("Matières dangereuses","☣️",b.hazmat)}${section("Accès pompier","🚪",b.access)}${section("Point de rassemblement","📍",b.assembly)}${section("Côté d’attaque conseillé","🚒",b.attackSide)}${section("Responsable","👤",[b.contactName,b.contactPhone].filter(Boolean).join(" — "))}${section("Notes opérationnelles","📝",b.notes)}</div>${window.fireMapPrevention?.preplanHtml?.(b.id)||""}${photos?`<section class="preplan-section"><h3>📷 Photos</h3><div class="photo-grid">${photos}</div></section>`:""}<div class="modal-actions"><button class="secondary" data-edit-building="${esc(b.id)}">Modifier</button><button class="primary" data-close-preplan>Fermer</button></div>`;$("preplanDialog").showModal()}
  function showOnMap(b){$("preplanDialog").close();I.showView("map");I.map.setView([b.lat,b.lng],18);markers.get(b.id)?.openPopup()}
  document.addEventListener("click",e=>{
    const addTrigger=e.target.closest("#bottomAdd,#mapAddBtn,#drawerAdd");if(addTrigger){e.preventDefault();e.stopImmediatePropagation();openChoice();return}
    const op=e.target.closest("[data-open-preplan]");if(op){const id=op.dataset.openPreplan;window.fireMapPrevention?.open?.(id)||openPreplan(buildings.find(b=>b.id===id))}
    const sh=e.target.closest("[data-show-building]");if(sh){const id=sh.dataset.showBuilding;window.fireMapPrevention?.open?.(id)||openPreplan(buildings.find(b=>b.id===id))}
    const ed=e.target.closest("[data-edit-building]");if(ed){$("preplanDialog").close();openForm(buildings.find(b=>b.id===ed.dataset.editBuilding))}
    const nv=e.target.closest("[data-nav-building]");if(nv){const b=buildings.find(x=>x.id===nv.dataset.navBuilding);if(b)location.href=I.navUrl(b.lat,b.lng)}
    const mp=e.target.closest("[data-map-building]");if(mp){const b=buildings.find(x=>x.id===mp.dataset.mapBuilding);if(b)showOnMap(b)}
    const pv=e.target.closest("[data-open-prevention]");if(pv){$("preplanDialog").close();window.fireMapPrevention?.open?.(pv.dataset.openPrevention)}
    if(e.target.closest("[data-close-preplan]"))$("preplanDialog").close();
  },true);
  $("closeChoice").onclick=()=>{$("addChoiceDialog").close();pendingMapPoint=null};$("chooseHydrant").onclick=()=>{$("addChoiceDialog").close();I.openHydrantForm();pendingMapPoint=null};$("chooseBuilding").onclick=()=>{$("addChoiceDialog").close();openForm();pendingMapPoint=null};$("addBuildingTop").onclick=()=>openForm();$("closeBuildingModal").onclick=$("cancelBuilding").onclick=()=>{$("buildingDialog").classList.remove("new-building-mode");$("buildingDialog").close()};$("buildingForm").onsubmit=e=>{e.preventDefault();save()};$("deleteBuilding").onclick=remove;$("buildingSearch").oninput=renderList;$("riskFilter").onchange=renderList;$("buildingToggle").onchange=e=>e.target.checked?layer.addTo(I.map):I.map.removeLayer(layer);
  // Mode édition sécuritaire : maintenir 1 seconde sur la carte pour ajouter un élément.
  const editBtn=$("editModeBtn"), mapContainer=I.map.getContainer();
  let editMode=false, holdTimer=null, holdStart=null, holdPointerId=null, holdTriggered=false;
  function setEditMode(enabled){
    editMode=Boolean(enabled);
    editBtn.setAttribute("aria-pressed",String(editMode));
    editBtn.textContent=editMode?"✏️ Édition : OUI":"✏️ Édition : NON";
    editBtn.classList.toggle("active",editMode);
    mapContainer.classList.toggle("map-edit-mode",editMode);
    cancelHold();
    I.toast(editMode?"Mode édition activé : maintenez 1 seconde sur la carte.":"Mode consultation activé.");
  }
  function cancelHold(){
    if(holdTimer){clearTimeout(holdTimer);holdTimer=null}
    holdStart=null;holdPointerId=null;holdTriggered=false;
    mapContainer.classList.remove("holding-to-add");
  }
  function ignoredTarget(target){return Boolean(target.closest(".gm-control-active,.gm-style-iw,.firemap-google-marker,.map-fab,button,a,input,label"))}
  function pointFromClient(x,y){const r=mapContainer.getBoundingClientRect();return I.map.containerPointToLatLng(L.point(x-r.left,y-r.top))}
  editBtn.addEventListener("click",()=>setEditMode(!editMode));
  mapContainer.addEventListener("pointerdown",e=>{
    if(!editMode||document.querySelector("dialog[open]")||ignoredTarget(e.target)||e.button>0)return;
    cancelHold();
    holdPointerId=e.pointerId;holdStart={x:e.clientX,y:e.clientY};
    mapContainer.classList.add("holding-to-add");
    holdTimer=setTimeout(()=>{
      holdTimer=null;holdTriggered=true;
      const latlng=pointFromClient(holdStart.x,holdStart.y);
      navigator.vibrate?.(35);
      openChoice({lat:latlng.lat,lng:latlng.lng});
      I.toast("Position choisie : ajoutez une borne ou un bâtiment.");
      mapContainer.classList.remove("holding-to-add");
    },1000);
  },{passive:true});
  mapContainer.addEventListener("pointermove",e=>{
    if(e.pointerId!==holdPointerId||!holdStart)return;
    if(Math.hypot(e.clientX-holdStart.x,e.clientY-holdStart.y)>12)cancelHold();
  },{passive:true});
  ["pointerup","pointercancel","pointerleave"].forEach(type=>mapContainer.addEventListener(type,e=>{
    if(e.pointerId===holdPointerId&&!holdTriggered)cancelHold();
    else if(e.pointerId===holdPointerId){holdStart=null;holdPointerId=null;holdTriggered=false}
  },{passive:true}));
  mapContainer.addEventListener("contextmenu",e=>{if(editMode){e.preventDefault();e.stopPropagation()}},{passive:false});

  async function updateBuildingFromPrevention(id, patch={}){
    const index=buildings.findIndex(b=>String(b.id)===String(id));
    if(index<0) return null;
    const merged=canonical({...buildings[index],...patch,id:buildings[index].id});
    buildings[index]=merged;
    queueSave(merged);
    setBuildings(buildings);
    const c=window.fireMapCloud;
    try{
      if(!c?.configured||!c.saveBuilding) throw new Error("Firebase pas encore prêt");
      await c.saveBuilding(merged);
      clearPendingSave(merged.id);
    }catch(e){console.warn("Préplan mis à jour localement; synchronisation en attente.",e)}
    return merged;
  }
  window.fireMapPreplans={
    getBuildings:()=>buildings.slice(),
    applyPreventionData:async(id,record,scoreValue=0)=>{
      const index=buildings.findIndex(b=>String(b.id)===String(id));
      if(index<0)return false;
      const current=buildings[index];
      const joinRiskNames=()=>{
        const labels={hazmat:"Matières dangereuses",chemicals:"Produits chimiques",propane:"Propane",oxygen:"Oxygène",lithium:"Batteries au lithium",solar:"Panneaux solaires",fuel:"Réservoirs de carburant"};
        return Object.entries(record.risks||{}).filter(([,v])=>v).map(([k])=>labels[k]||k).join(", ");
      };
      const riskSummary=joinRiskNames();
      const patch={
        preventionOccupancy:Number(record.occupancy||0),
        preventionAccessCode:String(record.accessCode||""),
        lastPreventionVisit:String(record.visitDate||""),
        preventionInspector:String(record.inspector||""),
        preventionNextReview:String(record.nextReview||""),
        preventionScore:Number(scoreValue||0)
      };
      if(record.fdcNotes)patch.fdc=record.fdcNotes;
      if(record.electricalNotes)patch.electrical=record.electricalNotes;
      if(record.gasNotes)patch.gas=record.gasNotes;
      if(record.hazmatNotes)patch.hazmat=record.hazmatNotes;
      if(record.accessNotes)patch.access=record.accessNotes;
      if(riskSummary)patch.risks=riskSummary;
      if(record.observations)patch.notes=record.observations;
      const merged=canonical({...current,...patch,id:current.id});
      buildings[index]=merged;
      queueSave(merged);
      setBuildings(buildings);
      try{
        const cloud=window.fireMapCloud;
        if(cloud?.configured&&cloud.saveBuilding){
          await cloud.saveBuilding(merged);
          clearPendingSave(merged.id);
        }
      }catch(err){console.warn("Mise à jour bâtiment en attente",err)}
      return true;
    },
    openPreplanById:id=>{const b=buildings.find(x=>String(x.id)===String(id));if(b)openPreplan(b)},
    openLegacyPreplanById:id=>{const b=buildings.find(x=>String(x.id)===String(id));if(b)openPreplan(b)},
    showBuildingOnMap:id=>{const b=buildings.find(x=>String(x.id)===String(id));if(b)showOnMap(b)},
    updateBuildingFromPrevention
  };
  window.dispatchEvent(new Event("firemap-preplans-ready"));

  async function flushPending(c){
    const p=getPending();
    for(const [id,b] of Object.entries(p.save)){try{await c.saveBuilding(b);clearPendingSave(id)}catch(e){console.error("Échec sync bâtiment",id,e)}}
    for(const id of Object.keys(p.delete)){try{await c.deleteBuilding(id);clearPendingDelete(id)}catch(e){console.error("Échec suppression bâtiment",id,e)}}
  }
  const connect=()=>{
    const c=window.fireMapCloud;
    if(!c?.configured||!c.subscribeBuildings){cloudConnected=false;I.toast("Bâtiments en mode local : Firebase indisponible.");return}
    cloudConnected=true;
    if(cloudUnsubscribe)cloudUnsubscribe();
    let firstSnapshot=true;
    cloudUnsubscribe=c.subscribeBuildings(async cloudItems=>{
      const pending=getPending();
      const cloudMap=new Map(cloudItems.map(x=>[String(x.id),canonical(x)]));
      // Au premier branchement, transférer une seule fois les anciens bâtiments locaux vers Firestore.
      if(firstSnapshot && localStorage.getItem(BUILDINGS_MIGRATED_KEY)!=="yes"){
        for(const b of buildings){if(!cloudMap.has(b.id) && !pending.delete[b.id])queueSave(b)}
        localStorage.setItem(BUILDINGS_MIGRATED_KEY,"yes");
      }
      firstSnapshot=false;
      // Garder visibles les écritures locales encore en attente jusqu'à confirmation du serveur.
      const nowPending=getPending();
      Object.entries(nowPending.save).forEach(([id,b])=>cloudMap.set(id,canonical(b)));
      Object.keys(nowPending.delete).forEach(id=>cloudMap.delete(id));
      setBuildings([...cloudMap.values()]);
      await flushPending(c);
    },e=>{cloudConnected=false;console.error(e);I.toast("Erreur de synchronisation des bâtiments; copie locale conservée.")});
    flushPending(c);
  };
  setBuildings(loadCachedBuildings());
  connect();window.addEventListener("firemap-cloud-ready",connect);
  window.addEventListener("online",()=>{if(window.fireMapCloud?.configured){connect()}});
})();
