(() => {
  "use strict";
  const CENTER=[46.2563,-72.9417], ADDRESS_FILE="louiseville_adresses.json", HYDRANT_FILE="firemap-2026-07-30 2.geojson";
  const $=id=>document.getElementById(id), state={addresses:[],hydrants:[],markers:new Map(),selected:null,user:null,lastMapClick:null,cloudReady:false,cloudHasData:false,deferredInstall:null,nearest:[],history:[],favorites:[],mapMoving:false,pendingMarkerRender:false};
  const map=L.map("map",{
    zoomControl:true,
    zoomAnimation:false,
    fadeAnimation:false,
    markerZoomAnimation:false,
    inertia:true
  }).setView(CENTER,14);
  map.attributionControl.setPrefix(false);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:20,attribution:"&copy; OpenStreetMap contributors"}).addTo(map);
  const hydrantLayer=L.layerGroup().addTo(map), interventionLayer=L.layerGroup().addTo(map), resourceLayer=L.layerGroup().addTo(map), userLayer=L.layerGroup().addTo(map);
  const mapContainer=map.getContainer();
  map.on("movestart zoomstart",()=>{
    state.mapMoving=true;
    window.fireMapMapMoving=true;
    mapContainer.classList.add("firemap-map-moving");
  });
  map.on("moveend zoomend",()=>{
    state.mapMoving=false;
    window.fireMapMapMoving=false;
    mapContainer.classList.remove("firemap-map-moving");
    if(state.pendingMarkerRender){
      state.pendingMarkerRender=false;
      requestAnimationFrame(()=>renderMarkers());
    }
    window.dispatchEvent(new CustomEvent("firemap:map-idle"));
  });

  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const addressNorm=s=>{
    s=norm(s).replace(/\bn\s+d\b/g,"notre dame");
    const aliases={st:"saint",ste:"sainte",stte:"sainte",av:"avenue",ave:"avenue",boul:"boulevard",bd:"boulevard",blvd:"boulevard",ch:"chemin",rte:"route"};
    const ignored=new Set(["rue","avenue","boulevard","chemin","route"]);
    return s.split(" ").filter(Boolean).map(t=>aliases[t]||t).filter(t=>!ignored.has(t)).join(" ");
  };
  const toast=m=>{const t=$("toast");t.textContent=m;t.classList.remove("hidden");clearTimeout(toast.x);toast.x=setTimeout(()=>t.classList.add("hidden"),2600)};
  const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(16).slice(2);
  const statusLabel=s=>({available:"Disponible",restricted:"Restreinte",out_of_service:"Hors service",unknown:"Inconnue",active:"Disponible",maintenance:"Restreinte",inactive:"Hors service"}[s]||"Inconnue");
  const normalizeStatus=s=>({active:"available",maintenance:"restricted",inactive:"out_of_service"}[s]||s||"unknown");
  const statusClass=s=>normalizeStatus(s);
  const statusColor=s=>({available:"#39d353",restricted:"#ffd400",out_of_service:"#ff3b30",unknown:"#9ca3af"}[normalizeStatus(s)]||"#9ca3af");
  const FLOW_BANDS={red:{key:"red",color:"#ff2a22",label:"Rouge",range:"moins de 500 gal/min",value:499},orange:{key:"orange",color:"#ff9500",label:"Orange",range:"500 à 999 gal/min",value:750},green:{key:"green",color:"#69d31f",label:"Vert",range:"1 000 à 1 499 gal/min",value:1250},blue:{key:"blue",color:"#1e90ff",label:"Bleu",range:"1 500 gal/min et plus",value:1500},gray:{key:"gray",color:"#9ca3af",label:"Inconnue",range:"Débit inconnu",value:0}};
  const flowBand=g=>{if(typeof g==="string"&&FLOW_BANDS[g])return FLOW_BANDS[g];g=Number(g)||0;if(g>=1500)return FLOW_BANDS.blue;if(g>=1000)return FLOW_BANDS.green;if(g>=500)return FLOW_BANDS.orange;if(g>0)return FLOW_BANDS.red;return FLOW_BANDS.gray};
  const fmtGpm=v=>flowBand(v).range;
  const flowValueForBand=k=>(FLOW_BANDS[k]||FLOW_BANDS.gray).value;
  function canonical(p){const legacyStatus=normalizeStatus(p.status);let flowGpm=Number(p.flowGpm??p.flowRate??p.debitGpm??0)||0;return {id:String(p.id||uid()),name:String(p.name||p.numero||"Sans numéro"),address:String(p.address||p.adresse||""),lat:Number(p.lat),lng:Number(p.lng),status:legacyStatus,hydrantColor:flowBand(flowGpm).key,outletType:p.outletType||p.outlet||"",flowRate:flowGpm,flowGpm,flowUnit:"gpm",inspection:p.inspection||"",notes:p.notes||"",type:"station"}}
  async function loadBase(){
    try{const [a,g]=await Promise.all([fetch(ADDRESS_FILE,{cache:"no-cache"}).then(r=>r.json()),fetch(HYDRANT_FILE,{cache:"no-cache"}).then(r=>r.json())]);state.addresses=a.map(x=>({...x,rechercheNormalisee:addressNorm([x.adresse,x.codePostal,x.recherche].filter(Boolean).join(" "))}));updateAddressCounts();const base=(g.features||[]).map(f=>canonical({...f.properties,lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0]})).filter(p=>isFinite(p.lat)&&isFinite(p.lng));setHydrants(base,"local");}catch(e){console.error(e);toast("Erreur de chargement des données.")}
  }
  function setHydrants(items,source){state.hydrants=items.map(canonical);renderMarkers();renderHydrantList();renderInspections();$("hydrantCount").textContent=`${state.hydrants.length} bornes affichées`;if(state.selected)renderNearest();if(source==="cloud")state.cloudHasData=true}
  function hydrantSvg(color){return `<svg viewBox="0 0 64 74" aria-hidden="true"><g fill="${color}" stroke="#090b10" stroke-width="2.2" stroke-linejoin="round"><path d="M24 8h16l4 8H20z"/><rect x="21" y="15" width="22" height="9" rx="4"/><path d="M18 25h28v32H18z"/><rect x="7" y="31" width="12" height="17" rx="4"/><rect x="45" y="31" width="12" height="17" rx="4"/><rect x="3" y="35" width="7" height="9" rx="2"/><rect x="54" y="35" width="7" height="9" rx="2"/><path d="M14 57h36l6 10H8z"/><rect x="26" y="29" width="12" height="20" rx="4" fill="#0c1017" opacity=".3"/></g><circle cx="32" cy="9" r="3" fill="#d8e1ec"/></svg>`}
  function markerHtml(p){const band=flowBand(p.flowGpm),border=statusColor(p.status);return `<div class="hydrant-marker" style="--flow:${band.color};--status:${border}" title="${band.label} — ${band.range}"><div class="hydrant-emoji">${hydrantSvg(band.color)}</div><div class="hydrant-gpm">${band.key==="blue"?"≥1500":band.key==="green"?"1000–1499":band.key==="orange"?"500–999":band.key==="red"?"<500":"?"}</div></div>`}
  function iconFor(p){return L.divIcon({className:"custom-hydrant",html:markerHtml(p),iconSize:[22,30],iconAnchor:[11,27],popupAnchor:[0,-27]})}
  function renderMarkers(){
    if(state.mapMoving||window.fireMapMapMoving){
      state.pendingMarkerRender=true;
      return;
    }
    hydrantLayer.clearLayers();state.markers.clear();state.hydrants.forEach(p=>{const band=flowBand(p.flowGpm);const m=L.marker([p.lat,p.lng],{icon:iconFor(p)}).bindPopup(`<strong>Borne ${esc(p.name)}</strong><br>${esc(p.address)||"Adresse non inscrite"}<br><b style="color:${band.color}">${fmtGpm(p.flowGpm)}</b><br><span class="status ${statusClass(p.status)}">${statusLabel(p.status)}</span><br><button onclick="window.editFireHydrant('${esc(p.id)}')">Modifier</button>`).addTo(hydrantLayer);state.markers.set(p.id,m)})}
  function miniHydrant(p){const b=flowBand(p.flowGpm);return `<div class="hydrant-mini" style="--flow:${b.color};--status:${statusColor(p.status)}">${hydrantSvg(b.color)}</div>`}
  function renderHydrantList(){const q=norm($("hydrantSearch").value),sf=$("statusFilter").value;const items=state.hydrants.filter(p=>(!sf||normalizeStatus(p.status)===sf)&&(!q||norm([p.name,p.address,p.status,p.notes,p.flowGpm].join(" ")).includes(q))).sort((a,b)=>a.name.localeCompare(b.name,"fr",{numeric:true}));$("hydrantList").innerHTML=items.map(p=>`<article class="card-item">${miniHydrant(p)}<div class="card-content"><h3>Borne ${esc(p.name)}</h3><span class="status ${statusClass(p.status)}">${statusLabel(p.status)}</span><p>${esc(p.address)||"Adresse non inscrite"}</p><p>${p.inspection?"Inspection : "+esc(p.inspection):"Inspection non inscrite"} · <b>${fmtGpm(p.flowGpm)}</b></p><div class="card-actions"><button class="secondary" data-show="${esc(p.id)}">Voir</button><button class="secondary" data-edit="${esc(p.id)}">Modifier</button><button class="primary" data-nav="${esc(p.id)}">GPS</button></div></div></article>`).join("")||`<div class="card-item">Aucune borne trouvée.</div>`}
  function renderInspections(){const old=new Date();old.setFullYear(old.getFullYear()-1);let current=0,due=0,missing=0;const sorted=[...state.hydrants].sort((a,b)=>(a.inspection||"").localeCompare(b.inspection||""));sorted.forEach(p=>{if(!p.inspection)missing++;else if(new Date(p.inspection)<old)due++;else current++});$("inspectionStats").innerHTML=`<div><strong>${current}</strong><span>À jour</span></div><div><strong>${due}</strong><span>À inspecter</span></div><div><strong>${missing}</strong><span>Sans date</span></div>`;$("inspectionList").innerHTML=sorted.map(p=>`<article class="card-item">${miniHydrant(p)}<div class="card-content"><h3>Borne ${esc(p.name)}</h3><p>${esc(p.address)}</p><p>${fmtGpm(p.flowGpm)} · ${p.inspection?`Dernière inspection : ${esc(p.inspection)}`:"Aucune inspection inscrite"}</p><div class="card-actions"><button class="secondary" data-edit="${esc(p.id)}">Mettre à jour</button></div></div></article>`).join("")}
  function search(query){const terms=addressNorm(query).split(" ").filter(Boolean);if(!terms.length)return[];return state.addresses.filter(a=>terms.every(t=>a.rechercheNormalisee.includes(t))).sort((a,b)=>a.adresse.localeCompare(b.adresse,"fr",{numeric:true})).slice(0,35)}
  function updateAddressCounts(){const n=state.addresses.length.toLocaleString("fr-CA");$("searchStatus").textContent=`${n} adresses chargées`;$("searchStatusFull").textContent=`${n} adresses chargées`}
  function renderResults(inputId,boxId,statusId){const input=$(inputId),items=search(input.value),box=$(boxId);box.innerHTML="";if(!input.value.trim()){updateAddressCounts();return}$(statusId).textContent=items.length?`${items.length} résultat(s) affiché(s)`:"Aucune adresse trouvée";box.innerHTML=items.map((a,i)=>`<button class="result-item" data-address-index="${state.addresses.indexOf(a)}"><span class="pin">📍</span><span><strong>${esc(a.adresse)}</strong><small>${a.lat.toFixed(6)}, ${a.lng.toFixed(6)}</small></span></button>`).join("")}
  function interventionIcon(){return L.divIcon({className:"custom-hydrant",html:`<div class="intervention-pin pulse-ring"><span>🔥</span></div>`,iconSize:[38,38],iconAnchor:[8,34],popupAnchor:[10,-31]})}
  function saveHistory(a){const item={adresse:a.adresse,lat:a.lat,lng:a.lng,at:new Date().toISOString()};state.history=[item,...state.history.filter(x=>x.adresse!==item.adresse)].slice(0,8);localStorage.setItem("firemap-interventions",JSON.stringify(state.history));renderHistory()}
  function loadHistory(){try{state.history=JSON.parse(localStorage.getItem("firemap-interventions")||"[]")}catch(_){state.history=[]}renderHistory()}
  function renderHistory(){const box=$("recentInterventions");if(!box)return;box.innerHTML=state.history.length?state.history.map((x,i)=>`<button class="recent-item" data-history="${i}"><strong>${esc(x.adresse)}</strong><span>${new Date(x.at).toLocaleString("fr-CA",{dateStyle:"short",timeStyle:"short"})}</span></button>`).join(""):`<span class="muted">Aucune intervention récente.</span>`}

  function loadFavorites(){try{state.favorites=JSON.parse(localStorage.getItem("firemap-favorites")||"[]")}catch(_){state.favorites=[]}renderFavorites()}
  function renderFavorites(){const box=$("favoritePlaces");if(!box)return;box.innerHTML=state.favorites.length?state.favorites.map((x,i)=>`<div class="favorite-item"><button data-favorite="${i}"><strong>${esc(x.name||x.adresse)}</strong><span>${esc(x.adresse)}</span></button><button class="favorite-remove" data-favorite-remove="${i}" aria-label="Retirer">×</button></div>`).join(""):`<span class="muted">Aucun favori. Choisissez une adresse puis appuyez sur « Ajouter l’adresse active ».</span>`}
  function addFavorite(){if(!state.selected)return toast("Choisissez d’abord une adresse.");const name=prompt("Nom du lieu (ex. Caserne, Aréna, École)",state.selected.adresse)||state.selected.adresse;const item={name,adresse:state.selected.adresse,lat:state.selected.lat,lng:state.selected.lng};state.favorites=[item,...state.favorites.filter(x=>x.adresse!==item.adresse)].slice(0,20);localStorage.setItem("firemap-favorites",JSON.stringify(state.favorites));renderFavorites();toast("Lieu ajouté aux favoris.")}
  function startVoice(inputId,boxId,statusId){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return toast("La recherche vocale n’est pas disponible sur ce navigateur.");const r=new SR();r.lang="fr-CA";r.interimResults=false;r.maxAlternatives=1;toast("Parlez maintenant…");r.onresult=e=>{const text=e.results[0][0].transcript;$(inputId).value=text;renderResults(inputId,boxId,statusId);toast(`Adresse entendue : ${text}`)};r.onerror=()=>toast("La recherche vocale n’a pas fonctionné.");r.start()}
  let roadRankCache=null, nearestRenderToken=0;
  function computeNearestAir(origin=state.selected,limit=12){if(!origin)return[];return state.hydrants.filter(p=>normalizeStatus(p.status)!=="out_of_service"&&isFinite(p.lat)&&isFinite(p.lng)).map(p=>({...p,airDistance:distance(origin,p)})).sort((a,b)=>a.airDistance-b.airDistance).slice(0,limit)}
  async function rankHydrantsByRoad(origin,limit=5){
    const candidates=computeNearestAir(origin,12);if(!candidates.length)return[];
    const key=[Number(origin.lat).toFixed(5),Number(origin.lng).toFixed(5),...candidates.map(p=>p.id)].join("|");
    if(roadRankCache?.key===key&&Date.now()-roadRankCache.at<60000)return roadRankCache.items.slice(0,limit);
    const coords=[[origin.lng,origin.lat],...candidates.map(p=>[p.lng,p.lat])].map(c=>c.join(",")).join(";");
    const destinations=candidates.map((_,i)=>i+1).join(";");
    try{
      const url=`https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&destinations=${destinations}&annotations=distance,duration`;
      const r=await fetch(url,{headers:{Accept:"application/json"}});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();
      const distances=data.distances?.[0]||[],durations=data.durations?.[0]||[];
      const items=candidates.map((p,i)=>({...p,distance:Number(distances[i]),duration:Number(durations[i]),roadDistance:true})).filter(p=>isFinite(p.distance)).sort((a,b)=>a.distance-b.distance||((normalizeStatus(a.status)==="restricted")-(normalizeStatus(b.status)==="restricted"))||(Number(b.flowGpm||0)-Number(a.flowGpm||0)));
      if(items.length){roadRankCache={key,at:Date.now(),items};return items.slice(0,limit)}
    }catch(e){console.warn("Classement routier indisponible, repli à vol d’oiseau",e)}
    const fallback=candidates.map(p=>({...p,distance:p.airDistance,duration:null,roadDistance:false})).sort((a,b)=>a.distance-b.distance);roadRankCache={key,at:Date.now(),items:fallback};return fallback.slice(0,limit)
  }
  async function drawRoadRoutes(origin,items){
    resourceLayer.clearLayers();const colors=["#f59e0b","#94a3b8","#b87333"];
    await Promise.all(items.slice(0,3).map(async(p,i)=>{try{const url=`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${p.lng},${p.lat}?overview=full&geometries=geojson`;const r=await fetch(url,{headers:{Accept:"application/json"}});if(!r.ok)throw new Error();const route=(await r.json()).routes?.[0];if(!route)return;L.polyline(route.geometry.coordinates.map(c=>[c[1],c[0]]),{color:colors[i],weight:i===0?5:3,opacity:.88,dashArray:i===0?null:"8 7",className:"leaflet-intervention-line"}).addTo(resourceLayer)}catch(_){L.polyline([[origin.lat,origin.lng],[p.lat,p.lng]],{color:colors[i],weight:i===0?4:2,opacity:.55,dashArray:"6 7"}).addTo(resourceLayer)}}))
  }
  async function renderNearest(){
    const token=++nearestRenderToken,box=$("nearestList");resourceLayer.clearLayers();if(!state.selected){state.nearest=[];return[]}
    box.innerHTML=`<span class="muted">Calcul des distances réelles par la route…</span>`;$("nearestText").textContent="Calcul des trajets routiers…";
    const items=await rankHydrantsByRoad(state.selected,3);if(token!==nearestRenderToken)return items;state.nearest=items;
    if(!items.length){box.innerHTML=`<span class="muted">Aucune borne active disponible.</span>`;$("nearestText").textContent="Aucune borne active";return[]}
    const label=p=>p.roadDistance?`${Math.round(p.distance)} m par la route`:`${Math.round(p.distance)} m à vol d’oiseau`;
    $("nearestText").textContent=`Borne ${items[0].name} à ${label(items[0])}`;
    box.innerHTML=items.map((p,i)=>`<div class="nearest-item"><div class="nearest-rank">${i+1}</div><div class="nearest-info"><strong>Borne ${esc(p.name)} · ${label(p)}</strong><span>${esc(p.address)||"Adresse non inscrite"} · ${fmtGpm(p.flowGpm)}${isFinite(p.duration)?` · ~${Math.max(1,Math.round(p.duration/60))} min`:""}</span></div><div class="nearest-actions"><button class="mini-map" data-nearest-show="${esc(p.id)}">Carte</button><button class="mini-gps" data-nav="${esc(p.id)}">GPS</button></div></div>`).join("");
    await drawRoadRoutes(state.selected,items);return items
  }
  function selectAddress(a,remember=true){state.selected=a;$("addressSearch").value=a.adresse;$("addressSearchFull").value=a.adresse;$("results").innerHTML=$("resultsFull").innerHTML="";$("interventionCard").classList.remove("hidden");$("selectedAddress").textContent=a.adresse;interventionLayer.clearLayers();resourceLayer.clearLayers();L.marker([a.lat,a.lng],{icon:interventionIcon()}).bindPopup(`<strong>🔥 Intervention</strong><br>${esc(a.adresse)}`).addTo(interventionLayer).openPopup();renderNearest();if(remember)saveHistory(a);map.setView([a.lat,a.lng],17);showView("map");window.dispatchEvent(new CustomEvent("firemap:intervention-start",{detail:{...a,lat:Number(a.lat),lng:Number(a.lng)}}))}
  function clearIntervention(){const previous=state.selected;state.selected=null;state.nearest=[];interventionLayer.clearLayers();resourceLayer.clearLayers();$("interventionCard").classList.add("hidden");$("addressSearch").value=$("addressSearchFull").value="";updateAddressCounts();map.setView(CENTER,14);window.dispatchEvent(new CustomEvent("firemap:intervention-end",{detail:previous||null}))}
  const navUrl=(lat,lng)=>/iPhone|iPad|iPod/i.test(navigator.userAgent)?`https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`:`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  function distance(a,b){const R=6371000,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lng-a.lng)*Math.PI/180,x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
  async function nearest(){if(!state.selected)return toast("Choisissez d’abord une adresse.");const items=await renderNearest();if(!items.length)return;map.fitBounds([[state.selected.lat,state.selected.lng],...items.map(p=>[p.lat,p.lng])],{padding:[45,45]});state.markers.get(items[0].id)?.openPopup()}
  function showView(name){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));closeDrawer();if(name==="map")setTimeout(()=>map.invalidateSize(),100)}
  function openDrawer(){$("drawer").classList.add("open");$("backdrop").classList.remove("hidden")}
  function closeDrawer(){$("drawer").classList.remove("open");$("backdrop").classList.add("hidden")}
  function nearestAddress(pos,maxMeters=100){if(!pos||!state.addresses.length)return "";const rad=Math.PI/180,lat1=Number(pos.lat)*rad;let best=null,bestD=Infinity;for(const a of state.addresses){const lat2=Number(a.lat)*rad,dLat=lat2-lat1,dLng=(Number(a.lng)-Number(pos.lng))*rad;const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;const d=12742000*Math.asin(Math.min(1,Math.sqrt(h)));if(d<bestD){bestD=d;best=a}}return bestD<=maxMeters?best?.adresse||"":""}
  function openForm(p=null){const d=$("hydrantDialog"),pos=state.lastMapClick||state.user||{lat:map.getCenter().lat,lng:map.getCenter().lng};$("modalTitle").textContent=p?`Modifier la borne ${p.name}`:"Ajouter une borne";$("hydrantId").value=p?.id||"";$("hydrantName").value=p?.name||"";$("hydrantStatus").value=normalizeStatus(p?.status||"available");$("hydrantAddress").value=p?.address||nearestAddress(pos)||state.selected?.adresse||"";$("hydrantLat").value=p?.lat??pos.lat.toFixed(7);$("hydrantLng").value=p?.lng??pos.lng.toFixed(7);$("outletType").value=p?.outletType||"";$("flowRate").value=flowBand(p?.flowGpm||p?.flowRate||p?.hydrantColor).key==="gray"?"":flowBand(p?.flowGpm||p?.flowRate||p?.hydrantColor).key;$("inspectionDate").value=p?.inspection||"";$("hydrantNotes").value=p?.notes||"";$("deleteHydrant").classList.toggle("hidden",!p);d.showModal()}
  async function saveForm(){const p=canonical({id:$("hydrantId").value||uid(),name:$("hydrantName").value,address:$("hydrantAddress").value,lat:$("hydrantLat").value,lng:$("hydrantLng").value,status:$("hydrantStatus").value,outletType:$("outletType").value,flowGpm:flowValueForBand($("flowRate").value),flowRate:flowValueForBand($("flowRate").value),hydrantColor:$("flowRate").value,flowUnit:"gpm",inspection:$("inspectionDate").value,notes:$("hydrantNotes").value});if(!isFinite(p.lat)||!isFinite(p.lng))return toast("Coordonnées invalides.");const i=state.hydrants.findIndex(x=>x.id===p.id);if(i>=0)state.hydrants[i]=p;else state.hydrants.push(p);setHydrants(state.hydrants,"local");$("hydrantDialog").close();try{if(window.fireMapCloud?.configured)await window.fireMapCloud.savePoint(p);toast("Borne enregistrée et synchronisée.")}catch(e){console.error(e);toast("Borne enregistrée localement, erreur Firebase.")}}
  async function removeCurrent(){const id=$("hydrantId").value;if(!id||!confirm("Supprimer définitivement cette borne ?"))return;state.hydrants=state.hydrants.filter(p=>p.id!==id);setHydrants(state.hydrants,"local");$("hydrantDialog").close();try{if(window.fireMapCloud?.configured)await window.fireMapCloud.deletePoint(id);toast("Borne supprimée.")}catch(e){toast("Suppression locale seulement.")}}
  function locate(){if(!navigator.geolocation)return toast("GPS non disponible.");navigator.geolocation.getCurrentPosition(p=>{state.user={lat:p.coords.latitude,lng:p.coords.longitude};userLayer.clearLayers();L.circleMarker([state.user.lat,state.user.lng],{radius:9,color:"#fff",weight:3,fillColor:"#2563eb",fillOpacity:1}).bindPopup("Votre position").addTo(userLayer).openPopup();map.setView([state.user.lat,state.user.lng],16)},()=>toast("Autorisez la localisation dans Safari."),{enableHighAccuracy:true,timeout:12000,maximumAge:5000})}
  function connectCloud(){const start=()=>{const c=window.fireMapCloud;if(!c?.configured){$("syncTitle").textContent="Mode local";$("syncText").textContent="Firebase non connecté";return}$("syncTitle").textContent="Synchronisation active";$("syncText").textContent="Tous les appareils sont reliés";$("syncDot").classList.add("ok");c.subscribe(async data=>{if(data.length){setHydrants(data,"cloud")}else if(!state.cloudHasData&&state.hydrants.length){try{await c.saveMany(state.hydrants);toast("Bornes initiales envoyées dans Firebase.")}catch(e){console.error(e)}}},e=>{console.error(e);$("syncTitle").textContent="Erreur Firebase"})};if(window.fireMapCloud)start();else window.addEventListener("firemap-cloud-ready",start,{once:true})}

  async function disableLegacyFireMapCache(){
    try{
      if("serviceWorker" in navigator){
        const registrations=await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg=>reg.unregister().catch(()=>false)));
      }
      if("caches" in window){
        const names=await caches.keys();
        await Promise.all(
          names
            .filter(name=>/firemap/i.test(name))
            .map(name=>caches.delete(name))
        );
      }
      localStorage.setItem("firemap-runtime-build","24.0.0");
    }catch(error){
      console.warn("Nettoyage de l’ancien cache FireMap impossible.",error);
    }
  }
  window.addEventListener("load",disableLegacyFireMapCache,{once:true});

  window.fireMapInternal={map,state,showView,openHydrantForm:openForm,navUrl,toast,esc,norm,addressNorm,getAddresses:()=>state.addresses,getHydrants:()=>state.hydrants,selectAddress,clearIntervention,nearestAddress,rankHydrantsByRoad,drawRoadRoutes};
  document.addEventListener("click",e=>{const v=e.target.closest("[data-view]");if(v)showView(v.dataset.view);const ai=e.target.closest("[data-address-index]");if(ai)selectAddress(state.addresses[Number(ai.dataset.addressIndex)]);const edit=e.target.closest("[data-edit]");if(edit)openForm(state.hydrants.find(p=>p.id===edit.dataset.edit));const show=e.target.closest("[data-show]");if(show){const p=state.hydrants.find(x=>x.id===show.dataset.show);showView("map");map.setView([p.lat,p.lng],18);state.markers.get(p.id)?.openPopup()}const nav=e.target.closest("[data-nav]");if(nav){const p=state.hydrants.find(x=>x.id===nav.dataset.nav);if(p)location.href=navUrl(p.lat,p.lng)}const ns=e.target.closest("[data-nearest-show]");if(ns){const p=state.hydrants.find(x=>x.id===ns.dataset.nearestShow);if(p){map.setView([p.lat,p.lng],18);state.markers.get(p.id)?.openPopup()}}const hi=e.target.closest("[data-history]");if(hi){const x=state.history[Number(hi.dataset.history)];if(x)selectAddress(x,false)}const fi=e.target.closest("[data-favorite]");if(fi){const x=state.favorites[Number(fi.dataset.favorite)];if(x)selectAddress(x,false)}const fr=e.target.closest("[data-favorite-remove]");if(fr){state.favorites.splice(Number(fr.dataset.favoriteRemove),1);localStorage.setItem("firemap-favorites",JSON.stringify(state.favorites));renderFavorites()}});
  [["addressSearch","results","searchStatus"],["addressSearchFull","resultsFull","searchStatusFull"]].forEach(([i,b,s])=>$(i).addEventListener("input",()=>renderResults(i,b,s)));$("clearSearch").onclick=()=>{$("addressSearch").value="";$("results").innerHTML="";updateAddressCounts()};$("clearSearchFull").onclick=()=>{$("addressSearchFull").value="";$("resultsFull").innerHTML="";updateAddressCounts()};
  $("menuBtn").onclick=$("bottomMore").onclick=openDrawer;$("closeDrawer").onclick=$("backdrop").onclick=closeDrawer;$("clearIntervention").onclick=clearIntervention;$("addFavorite").onclick=addFavorite;$("voiceSearch").onclick=()=>startVoice("addressSearch","results","searchStatus");$("voiceSearchFull").onclick=()=>startVoice("addressSearchFull","resultsFull","searchStatusFull");$("clearHistory").onclick=()=>{state.history=[];localStorage.removeItem("firemap-interventions");renderHistory()};[$("drawerAdd"),$("addHydrantTop"),$("bottomAdd")].filter(Boolean).forEach(b=>b.onclick=()=>openForm());$("locateBtn").onclick=locate;$("gpsBtn").onclick=()=>state.selected?window.fireMapNavigation?.start(state.selected):toast("Choisissez une adresse.");$("nearestBtn").onclick=nearest;$("hydrantToggle").onchange=e=>e.target.checked?hydrantLayer.addTo(map):map.removeLayer(hydrantLayer);$("hydrantSearch").oninput=renderHydrantList;$("statusFilter").onchange=renderHydrantList;$("closeModal").onclick=$("cancelModal").onclick=()=>$("hydrantDialog").close();$("hydrantForm").onsubmit=e=>{e.preventDefault();saveForm()};$("deleteHydrant").onclick=removeCurrent;map.on("click",e=>state.lastMapClick={lat:e.latlng.lat,lng:e.latlng.lng});window.editFireHydrant=id=>openForm(state.hydrants.find(p=>p.id===id));
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.deferredInstall=e;$("installBtn").classList.remove("hidden")});$("installBtn").onclick=async()=>{if(state.deferredInstall){state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null}};
  loadHistory();loadFavorites();loadBase().then(connectCloud);
})();
