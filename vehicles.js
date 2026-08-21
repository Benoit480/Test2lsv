(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const core = window.fireMapInternal;
  if (!core?.map) return;

  const DEFAULT_STATION = {
    id: "caserne",
    name: "Caserne de Louiseville",
    address: "Coordonnées à confirmer",
    phone: "",
    lat: 46.2563,
    lng: -72.9417
  };
  const DEFAULT_VEHICLES = [
    { id: "202", number: "202", name: "Autopompe 202", type: "engine", status: "station", crew: "", icon: "🚒" },
    { id: "502", number: "502", name: "Échelle 502", type: "ladder", status: "station", crew: "", icon: "🪜" },
    { id: "802", number: "802", name: "Citerne 802", type: "tanker", status: "station", crew: "", icon: "🚛" },
    { id: "602", number: "602", name: "Unité de soutien 602", type: "support", status: "station", crew: "", icon: "🧰" },
    { id: "902", number: "902", name: "Pickup 902", type: "pickup", status: "station", crew: "", icon: "🛻" },
    { id: "102", number: "102", name: "Chef 102", type: "chief", status: "station", crew: "", icon: "👨‍🚒" }
  ];
  const STATUS = {
    station: { label: "À la caserne", color: "#39d353" },
    enroute: { label: "En route", color: "#3b82f6" },
    onscene: { label: "Sur les lieux", color: "#ff9500" },
    water: { label: "Alimentation établie", color: "#a855f7" },
    returning: { label: "Retour", color: "#ef4444" },
    out: { label: "Hors service", color: "#64748b" }
  };
  const TYPE_ICON = { engine: "🚒", ladder: "🪜", tanker: "🚛", support: "🧰", pickup: "🛻", chief: "👨‍🚒" };
  const state = { station: loadLocal("firemap-station", DEFAULT_STATION), vehicles: loadLocal("firemap-vehicles", DEFAULT_VEHICLES), markers: new Map(), watchId: null, sharingId: null, cloudStarted: false, pendingMapRender: false, lastMapRenderKey: "" };
  const layer = L.layerGroup().addTo(core.map);
  window.addEventListener("firemap:map-idle",()=>{
    if(state.pendingMapRender)requestAnimationFrame(()=>renderMap());
  });

  function loadLocal(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v || structuredClone(fallback); }
    catch (_) { return JSON.parse(JSON.stringify(fallback)); }
  }
  function saveLocal() {
    localStorage.setItem("firemap-station", JSON.stringify(state.station));
    localStorage.setItem("firemap-vehicles", JSON.stringify(state.vehicles));
  }
  function esc(v) { return core.esc ? core.esc(v) : String(v ?? ""); }
  function validPos(v) { return Number.isFinite(Number(v?.lat)) && Number.isFinite(Number(v?.lng)); }
  function stationPos(v) { return validPos(v) ? v : state.station; }
  function statusMeta(s) { return STATUS[s] || STATUS.station; }
  function normalizeVehicle(v) {
    const type = v.type || DEFAULT_VEHICLES.find(x => x.id === String(v.id))?.type || "engine";
    const pos = stationPos(v);
    return { ...v, id: String(v.id), number: String(v.number || v.id), name: v.name || `${type} ${v.id}`, type, icon: v.icon || TYPE_ICON[type] || "🚒", status: STATUS[v.status] ? v.status : "station", crew: v.crew || "", lat: Number(pos.lat), lng: Number(pos.lng), sharing: Boolean(v.sharing), updatedBy: v.updatedBy || "" };
  }
  function stationIcon() {
    return L.divIcon({ className: "", html: '<div class="station-marker"><div class="station-marker-body">🚒</div><div class="station-marker-label">CASERNE</div></div>', iconSize: [50, 62], iconAnchor: [25, 48], popupAnchor: [0, -46] });
  }
  function vehicleIcon(v) {
    const m = statusMeta(v.status);
    return L.divIcon({ className: "", html: `<div class="vehicle-marker ${v.sharing ? "live" : ""}" style="--status:${m.color}"><div class="vehicle-marker-body">${esc(v.icon)}</div><div class="vehicle-marker-label">${esc(v.number)}</div></div>`, iconSize: [44, 57], iconAnchor: [22, 39], popupAnchor: [0, -38] });
  }
  function gpsAgeSeconds(vehicle){
    const timestamp=Date.parse(vehicle?.gpsUpdatedAt||vehicle?.updatedAt||"");
    return Number.isFinite(timestamp)?Math.max(0,Math.floor((Date.now()-timestamp)/1000)):Infinity;
  }
  function gpsFreshness(vehicle){
    if(!vehicle?.sharing)return {key:"off",label:"GPS arrêté"};
    const age=gpsAgeSeconds(vehicle);
    if(age<=20)return {key:"live",label:"GPS en direct"};
    if(age<=90)return {key:"delayed",label:`GPS retardé · ${age} s`};
    return {key:"stale",label:"Position ancienne"};
  }
  function visibleMapVehicles(){
    const account=window.fireMapAccount?.current?.();
    return window.fireMapAccount?.isChief?.()
      ? state.vehicles
      : state.vehicles.filter(vehicle=>String(vehicle.id)===String(account?.id||""));
  }
  function renderMap(force=false) {
    if(window.fireMapMapMoving){
      state.pendingMapRender=true;
      return;
    }
    state.pendingMapRender=false;
    const renderKey=JSON.stringify({
      station:[state.station?.lat,state.station?.lng,state.station?.name],
      vehicles:state.vehicles.map(v=>[v.id,v.number,v.lat,v.lng,v.status,v.sharing])
    });
    if(!force&&renderKey===state.lastMapRenderKey)return;
    state.lastMapRenderKey=renderKey;
    layer.clearLayers(); state.markers.clear();
    const s = state.station;
    L.marker([s.lat, s.lng], { icon: stationIcon(), zIndexOffset: 700 })
      .bindPopup(`<strong>🚒 ${esc(s.name)}</strong><br>${esc(s.address || "Adresse non inscrite")}<br>${s.phone ? `<a href="tel:${esc(s.phone)}">${esc(s.phone)}</a><br>` : ""}<button type="button" data-station-nav>Navigation</button>`)
      .addTo(layer);
    visibleMapVehicles().map(normalizeVehicle).forEach(v => {
      const m = statusMeta(v.status);
      const marker = L.marker([v.lat, v.lng], { icon: vehicleIcon(v), zIndexOffset: 600 })
        .bindPopup(`<strong>${esc(v.icon)} ${esc(v.name)}</strong><br><span style="color:${m.color};font-weight:800">${esc(m.label)}</span><br>${v.crew ? `${esc(v.crew)}<br>` : ""}${v.sharing?`<strong style="color:#22c55e">● GPS en direct</strong><br>`:"GPS arrêté<br>"}${v.updatedAtText ? `Mise à jour : ${esc(v.updatedAtText)}<br>` : ""}${Number.isFinite(Number(v.accuracy))?`Précision : ±${Math.round(Number(v.accuracy))} m<br>`:""}<button type="button" data-vehicle-edit="${esc(v.id)}">Modifier</button>`)
        .addTo(layer);
      state.markers.set(v.id, marker);
    });
  }

  function normalizeVehicleKey(value="") {
    return String(value).toLowerCase().replace(/[^a-z0-9]/g,"");
  }
  function localVehicleUsages() {
    try {
      const rows = JSON.parse(localStorage.getItem("firemap-vehicle-usages-v2") || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch (_) {
      return [];
    }
  }
  function usageMatchesVehicle(usage, vehicle) {
    const id = normalizeVehicleKey(vehicle.id);
    const number = normalizeVehicleKey(vehicle.number);
    const name = normalizeVehicleKey(vehicle.name);
    const usageId = normalizeVehicleKey(usage?.vehicleId);
    const usageNumber = normalizeVehicleKey(usage?.vehicleNumber);
    const usageName = normalizeVehicleKey(usage?.vehicleName);
    return Boolean(
      (usageId && (usageId === id || usageId === number)) ||
      (usageNumber && (usageNumber === id || usageNumber === number)) ||
      (usageName && usageName === name)
    );
  }
  function latestUsage(vehicleId) {
    const vehicle = state.vehicles.map(normalizeVehicle)
      .find(v => String(v.id) === String(vehicleId));
    if (!vehicle) return null;

    const activeEvent = (() => {
      try {
        return JSON.parse(localStorage.getItem("firemap-command-active-event-data") || "null");
      } catch (_) {
        return null;
      }
    })();

    const fromApi = window.fireMapVehicleUsage?.getAll?.() || [];
    const fromLocal = localVehicleUsages();
    const merged = new Map();

    [...fromApi, ...fromLocal].forEach(row => {
      if (!row) return;
      const key = String(row.id || `${row.vehicleId}-${row.createdAt || row.updatedAtText || ""}`);
      merged.set(key, row);
    });

    const matching = [...merged.values()].filter(row => usageMatchesVehicle(row, vehicle));

    const linked = activeEvent?.id
      ? matching.filter(row =>
          String(row.eventId || "") === String(activeEvent.id) &&
          row.eventClosed !== true
        )
      : [];

    const currentProfiles = matching.filter(row =>
      row.eventClosed !== true &&
      (
        !row.eventId ||
        row.resetAfterEventId ||
        (activeEvent?.id && String(row.eventId || "") === String(activeEvent.id))
      )
    );

    const candidates = linked.length
      ? linked
      : (currentProfiles.length ? currentProfiles : matching.filter(row => row.eventClosed !== true));

    return candidates.sort((a,b) => {
      const aReset = a.resetAfterEventId ? 1 : 0;
      const bReset = b.resetAfterEventId ? 1 : 0;
      if (aReset !== bReset) return bReset - aReset;

      const ad = Date.parse(a.updatedAt || a.createdAt || "") || 0;
      const bd = Date.parse(b.updatedAt || b.createdAt || "") || 0;
      if (bd !== ad) return bd - ad;
      return String(b.updatedAtText || "").localeCompare(String(a.updatedAtText || ""));
    })[0] || null;
  }
  function usageActiveCount(usage) {
    if (!usage) return 0;
    const normal = Object.values(usage.outlets || {}).filter(outlet => outlet?.active === true).length;
    const fourInch = usage.special?.fourInch?.active === true ? 1 : 0;
    const deckGun = usage.special?.deckGun?.active === true ? 1 : 0;
    return normal + fourInch + deckGun;
  }
  function usageSupplyLabel(value) {
    const key = String(value || "no").toLowerCase();
    return ({
      no: "Non alimenté",
      hydrant: "Borne",
      tanker: "Citerne",
      relay: "Relais",
      other: "Autre"
    })[key] || String(value || "Non alimenté");
  }
  function usageState(usage, vehicle) {
    if (usage?.supplied && usage.supplied !== "no") {
      return { label: "Alimenté", color: "#3b82f6", className: "usage-supplied" };
    }
    if (usage?.status === "onscene") {
      return { label: "Sur les lieux", color: "#22c55e", className: "usage-onscene" };
    }
    if (usage?.status === "enroute") {
      return { label: "En route", color: "#eab308", className: "usage-enroute" };
    }
    if (usage?.status === "returning") {
      return { label: "Retour vers caserne", color: "#eab308", className: "usage-returning" };
    }
    const meta = statusMeta(vehicle.status);
    return { label: meta.label, color: meta.color, className: "usage-station" };
  }
  function activeOutletSummary(usage) {
    if (!usage) return "";
    const rows = [];
    Object.entries(usage.outlets || {}).forEach(([number, outlet]) => {
      if (!outlet?.active) return;
      const name = Number(number) <= 2 ? `Préconnect ${number}` : `Sortie ${number}`;
      const details = [
        outlet.type,
        outlet.pressure !== "" && outlet.pressure != null ? `${outlet.pressure} PSI` : "",
        outlet.sector ? `Secteur ${outlet.sector}` : "",
        outlet.location || ""
      ].filter(Boolean).join(" · ");
      rows.push(`<li><strong>${esc(name)}</strong>${details ? `<span>${esc(details)}</span>` : ""}</li>`);
    });
    const four = usage.special?.fourInch;
    if (four?.active) {
      const details = [
        four.pressure !== "" && four.pressure != null ? `${four.pressure} PSI` : "",
        four.sector ? `Secteur ${four.sector}` : "",
        four.location || ""
      ].filter(Boolean).join(" · ");
      rows.push(`<li><strong>Sortie 4 po</strong>${details ? `<span>${esc(details)}</span>` : ""}</li>`);
    }
    const gun = usage.special?.deckGun;
    if (gun?.active) {
      const details = [
        gun.pressure !== "" && gun.pressure != null ? `${gun.pressure} PSI` : "",
        gun.sector ? `Secteur ${gun.sector}` : "",
        gun.location || ""
      ].filter(Boolean).join(" · ");
      rows.push(`<li><strong>Canon</strong>${details ? `<span>${esc(details)}</span>` : ""}</li>`);
    }
    return rows.length ? `<ul class="vehicle-profile-outlets">${rows.join("")}</ul>` : '<p class="vehicle-profile-empty">Aucune sortie en service</p>';
  }
  function renderList() {
    const activeAccount=window.fireMapAccount?.current?.();
    $("stationNameDisplay").textContent=window.fireMapAccount?.isChief?.()
      ? state.station.name
      : `${activeAccount?.icon||"🚒"} Compte ${activeAccount?.number||""} — ${activeAccount?.name||"Unité"}`;
    $("stationAddressDisplay").textContent = state.station.address || "Adresse non inscrite";
    const box = $("vehicleList");
    const visibleVehicles=window.fireMapAccount?.isChief?.()
      ? state.vehicles
      : state.vehicles.filter(v=>String(v.id)===String(activeAccount?.id||""));
    box.innerHTML = visibleVehicles.map(normalizeVehicle).map(v => {
      const usage = latestUsage(v.id);
      const operational = usageState(usage, v);
      const sharing = state.sharingId === v.id;
      const count = usageActiveCount(usage);
      const linked = Boolean(usage?.eventId);
      return `<article class="vehicle-card vehicle-profile-card ${sharing ? "sharing" : ""} ${operational.className}" style="--vehicle-status:${operational.color}">
        <div class="vehicle-profile-top">
          <div class="vehicle-symbol">${esc(v.icon)}</div>
          <div class="vehicle-main">
            <h3>${esc(v.name)}</h3>
            <span class="vehicle-status">${esc(operational.label)}</span>
            ${linked ? '<span class="vehicle-profile-linked">🚨 Événement actif lié</span>' : ""}
          </div>
        </div>

        <div class="vehicle-profile-usage">
          <div class="vehicle-profile-stats">
            <span>👨‍🚒 <strong>${Number(usage?.firefighters || 0)}</strong> pompier${Number(usage?.firefighters || 0) > 1 ? "s" : ""}</span>
            <span>💧 <strong>${esc(usageSupplyLabel(usage?.supplied || "no"))}</strong></span>
            <span>🚿 <strong>${count}</strong> sortie${count !== 1 ? "s" : ""} active${count !== 1 ? "s" : ""}</span>
          </div>
          <div class="vehicle-profile-residual">
            <span>📊 <strong>Pression résiduelle</strong></span>
            <div>
              <span>Initiale : <strong>${usage?.residualStart !== "" && usage?.residualStart != null ? `${esc(usage.residualStart)} PSI` : "Non inscrite"}</strong></span>
              <span>Finale : <strong>${usage?.residualEnd !== "" && usage?.residualEnd != null ? `${esc(usage.residualEnd)} PSI` : "Non inscrite"}</strong></span>
            </div>
          </div>
          ${activeOutletSummary(usage)}
          ${usage?.notes ? `<p class="vehicle-profile-notes">${esc(usage.notes)}</p>` : ""}
          <small>${usage?.updatedAtText ? `Dernière fiche : ${esc(usage.updatedAtText)}` : "Aucune fiche d’utilisation enregistrée"}</small>
        </div>

        <div class="vehicle-profile-gps ${gpsFreshness(v).key}">
          <div><span>📡</span><div><strong>${gpsFreshness(v).label}</strong><small>${v.updatedAtText?`Dernière position : ${esc(v.updatedAtText)}`:"Aucune position transmise"}</small></div></div>
          <div class="vehicle-profile-gps-data">
            <span>Précision <strong>${Number.isFinite(Number(v.accuracy))?`±${Math.round(Number(v.accuracy))} m`:'—'}</strong></span>
            <span>Vitesse <strong>${Number.isFinite(Number(v.speed))?`${Math.round(Number(v.speed)*3.6)} km/h`:'—'}</strong></span>
          </div>
        </div>

        <div class="vehicle-actions vehicle-profile-actions">
          <button class="primary small" data-vehicle-usage="${esc(v.id)}">${usage ? "Modifier la fiche" : "Créer la fiche"}</button>
          <button class="secondary small" data-vehicle-show="${esc(v.id)}">Carte</button>
          <button class="secondary small" data-vehicle-edit="${esc(v.id)}">Profil unité</button>
          ${String(window.fireMapAccount?.current?.()?.id||"")===String(v.id)?`<button class="${sharing ? "danger" : "secondary"} small" data-vehicle-share="${esc(v.id)}">${sharing ? "Arrêter le GPS" : "Activer le GPS en direct"}</button>`:""}
        </div>
      </article>`;
    }).join("");
    $("vehicleSyncStatus").textContent = window.fireMapCloud?.configured ? "Synchronisation Firebase active" : "Mode local";
    $("stopSharingAll").classList.toggle("hidden", !state.sharingId);
    renderMap();
  }
  function showOnMap(id) {
    core.showView("map");
    const v = state.vehicles.find(x => String(x.id) === String(id));
    if (!v) return;
    core.map.setView([Number(v.lat), Number(v.lng)], 17);
    setTimeout(() => state.markers.get(String(id))?.openPopup(), 150);
  }
  function showStation() {
    core.showView("map"); core.map.setView([state.station.lat, state.station.lng], 17);
  }
  function openVehicle(id) {
    const v = state.vehicles.find(x => String(x.id) === String(id)); if (!v) return;
    $("vehicleId").value = v.id; $("vehicleName").value = v.name; $("vehicleNumber").value = v.number; $("vehicleType").value = v.type; $("vehicleStatus").value = v.status; $("vehicleCrew").value = v.crew || "";
    $("vehicleDialogTitle").textContent = v.name; $("vehicleDialog").showModal();
  }
  async function saveVehicleForm(e) {
    e.preventDefault(); const id = $("vehicleId").value; const current = state.vehicles.find(x => String(x.id) === id); if (!current) return;
    const type = $("vehicleType").value;
    Object.assign(current, { name: $("vehicleName").value.trim(), number: $("vehicleNumber").value.trim(), type, icon: TYPE_ICON[type] || "🚒", status: $("vehicleStatus").value, crew: $("vehicleCrew").value.trim() });
    if (current.status === "station" && state.sharingId !== id) Object.assign(current, { lat: state.station.lat, lng: state.station.lng, sharing: false });
    saveLocal(); renderList(); $("vehicleDialog").close();
    try { if (window.fireMapCloud?.configured) await window.fireMapCloud.saveVehicle(current); core.toast("Véhicule enregistré et synchronisé."); } catch (err) { console.error(err); core.toast("Véhicule enregistré localement."); }
  }
  function openStation() {
    $("stationName").value = state.station.name; $("stationAddress").value = state.station.address || ""; $("stationLat").value = state.station.lat; $("stationLng").value = state.station.lng; $("stationPhone").value = state.station.phone || ""; $("stationDialog").showModal();
  }
  async function saveStationForm(e) {
    e.preventDefault(); const lat = Number($("stationLat").value), lng = Number($("stationLng").value); if (!Number.isFinite(lat) || !Number.isFinite(lng)) return core.toast("Coordonnées invalides.");
    state.station = { id: "caserne", name: $("stationName").value.trim(), address: $("stationAddress").value.trim(), phone: $("stationPhone").value.trim(), lat, lng };
    state.vehicles.forEach(v => { if (v.status === "station" && state.sharingId !== String(v.id)) Object.assign(v, { lat, lng }); });
    saveLocal(); renderList(); $("stationDialog").close();
    try { if (window.fireMapCloud?.configured) { await window.fireMapCloud.saveStation(state.station); for (const v of state.vehicles.filter(v => v.status === "station")) await window.fireMapCloud.saveVehicle(v); } core.toast("Caserne enregistrée."); } catch (err) { console.error(err); core.toast("Caserne enregistrée localement."); }
  }
  async function pushPosition(v, coords) {
    const now=new Date();
    Object.assign(v, { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy, speed: coords.speed || 0, heading: coords.heading, sharing: true, gpsAccountId:String(window.fireMapAccount?.current?.()?.id||v.id), gpsUpdatedAt:now.toISOString(), status: v.status === "station" ? "enroute" : v.status, updatedAtText: now.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) });
    saveLocal(); renderList();
    try { if (window.fireMapCloud?.configured) await window.fireMapCloud.saveVehicle(v); } catch (err) { console.error(err); }
  }
  async function stopSharing(silent = false) {
    if (state.watchId != null) navigator.geolocation.clearWatch(state.watchId);
    const id = state.sharingId, v = state.vehicles.find(x => String(x.id) === String(id)); state.watchId = null; state.sharingId = null;
    if (v) { v.sharing = false; v.gpsStoppedAt=new Date().toISOString(); saveLocal(); renderList(); try { if (window.fireMapCloud?.configured) await window.fireMapCloud.saveVehicle(v); } catch (_) {} }
    if (!silent) core.toast("Partage GPS arrêté.");
  }
  function toggleSharing(id) {
    const account=window.fireMapAccount?.current?.();
    if(!account)return core.toast("Choisissez d’abord le compte du véhicule.");
    if(String(account.id)!==String(id))return core.toast(`Le compte ${account.number} ne peut partager que la position du véhicule ${account.number}.`);
    if (state.sharingId === String(id)) return stopSharing();
    if (!navigator.geolocation) return core.toast("GPS non disponible sur cet appareil.");
    if (state.sharingId) stopSharing(true);
    const v = state.vehicles.find(x => String(x.id) === String(id)); if (!v) return;
    state.sharingId = String(id); renderList();
    state.watchId = navigator.geolocation.watchPosition(p => pushPosition(v, p.coords), err => { console.error(err); stopSharing(true); core.toast("Autorisez la localisation précise pour partager le véhicule."); }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
    core.toast(`${v.name} partage maintenant sa position.`);
  }
  async function seedCloudIfNeeded(items) {
    if (items.length) return;
    for (const v of state.vehicles) await window.fireMapCloud.saveVehicle(normalizeVehicle(v));
  }
  function connectCloud() {
    if (state.cloudStarted) return; const cloud = window.fireMapCloud; if (!cloud) return;
    state.cloudStarted = true;
    if (!cloud.configured || !cloud.subscribeVehicles) return renderList();
    cloud.subscribeVehicles(async items => {
      if (!items.length) { try { await seedCloudIfNeeded(items); } catch (e) { console.error(e); } return; }
      state.vehicles = items.map(normalizeVehicle).sort((a,b) => DEFAULT_VEHICLES.findIndex(x=>x.id===a.id)-DEFAULT_VEHICLES.findIndex(x=>x.id===b.id)); saveLocal(); renderList();
    }, console.error);
    cloud.subscribeStation(async item => {
      if (item && validPos(item)) { state.station = { ...DEFAULT_STATION, ...item, lat: Number(item.lat), lng: Number(item.lng) }; saveLocal(); renderList(); }
      else { try { await cloud.saveStation(state.station); } catch (e) { console.error(e); } }
    }, console.error);
  }

  document.addEventListener("click", e => {
    const show = e.target.closest("[data-vehicle-show]"); if (show) showOnMap(show.dataset.vehicleShow);
    const edit=e.target.closest("[data-vehicle-edit]");
    if(edit){
      if(!window.fireMapAccount?.isOwnVehicle?.(edit.dataset.vehicleEdit))return core.toast("Ce compte n’est pas lié à ce véhicule.");
      openVehicle(edit.dataset.vehicleEdit);
    }
    const share = e.target.closest("[data-vehicle-share]"); if (share) toggleSharing(share.dataset.vehicleShare);
    const usageButton = e.target.closest("[data-vehicle-usage]");
    if(usageButton){
      if(!window.fireMapAccount?.isOwnVehicle?.(usageButton.dataset.vehicleUsage))return core.toast("Ce compte n’est pas lié à ce véhicule.");
      window.fireMapVehicleUsage?.openForVehicle?.(usageButton.dataset.vehicleUsage);
    }
    if (e.target.closest("[data-station-nav]")) location.href = core.navUrl(state.station.lat, state.station.lng);
  });
  $("vehiclesBackMap").onclick = () => core.showView("map");
  $("showStationMap").onclick = showStation;
  $("navigateStation").onclick = () => location.href = core.navUrl(state.station.lat, state.station.lng);
  $("editStation").onclick = openStation;
  $("stopSharingAll").onclick = () => stopSharing();
  $("closeVehicleDialog").onclick = $("cancelVehicleDialog").onclick = () => $("vehicleDialog").close();
  $("vehicleForm").onsubmit = saveVehicleForm;
  $("closeStationDialog").onclick = $("cancelStationDialog").onclick = () => $("stationDialog").close();
  $("stationForm").onsubmit = saveStationForm;

  state.vehicles = DEFAULT_VEHICLES.map(def => normalizeVehicle({ ...def, ...(state.vehicles.find(v => String(v.id) === def.id) || {}), lat: state.vehicles.find(v => String(v.id) === def.id)?.lat ?? state.station.lat, lng: state.vehicles.find(v => String(v.id) === def.id)?.lng ?? state.station.lng }));
  saveLocal(); renderList();
  window.addEventListener("firemap:vehicle-usages-ready", renderList);
  window.addEventListener("firemap:vehicle-usage-updated", renderList);
  window.addEventListener("firemap:account-changed",event=>{
    if(state.sharingId&&String(event.detail?.id||"")!==String(state.sharingId))stopSharing(true);
    renderList();
  });
  window.addEventListener("storage", e => {
    if (!e.key || e.key === "firemap-vehicle-usages-v2") renderList();
  });
  connectCloud(); window.addEventListener("firemap-cloud-ready", connectCloud);
  window.addEventListener("beforeunload", () => { if (state.watchId != null) navigator.geolocation.clearWatch(state.watchId); });
  window.fireMapVehicles = {
    getVehicles: () => state.vehicles,
    getStation: () => state.station,
    showStation,
    showVehicle: showOnMap,
    refreshProfiles: renderList,
    gpsFreshness,
    gpsAgeSeconds
  };
})();
