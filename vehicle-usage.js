(() => {
  "use strict";
  const $=id=>document.getElementById(id), core=window.fireMapInternal;
  if(!core)return;
  const CACHE="firemap-vehicle-usages-v2",PENDING="firemap-vehicle-usages-pending-v2",ACTIVE_EVENT_DATA="firemap-command-active-event-data";
  const STATUS={station:"En caserne",enroute:"En route",onscene:"Arrivé sur les lieux",returning:"Retour vers caserne"};
  let usages=[],cloudUnsub=null;
  const read=(k,f=[])=>{try{return JSON.parse(localStorage.getItem(k))||f}catch(_){return f}},write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=v=>core.esc?core.esc(v):String(v??""),uid=()=>crypto.randomUUID?crypto.randomUUID():`usage-${Date.now()}`;
  const vehicles=()=>window.fireMapVehicles?.getVehicles?.()||[];
  function emptyOutlet(n){return{active:false,type:"1¾ po",pressure:"",sector:"",location:""}}
  function canonical(x={}){
    const outlets={};for(let n=1;n<=6;n++){const o={...emptyOutlet(n),...(x.outlets?.[n]||x.outlets?.[String(n)]||{})};o.active=!!o.active;o.pressure=o.pressure===""||o.pressure==null?"":Number(o.pressure);o.sector=["1","2","3","4","5"].includes(String(o.sector))?String(o.sector):"";o.location=String(o.location||"");o.type=n<=2?"1¾ po":(["1¾ po","2½ po"].includes(o.type)?o.type:"1¾ po");outlets[n]=o}
    const sp=x.special||{};
    return{id:String(x.id||uid()),eventId:String(x.eventId||""),sourceCallId:String(x.sourceCallId||""),vehicleId:String(x.vehicleId||""),vehicleName:String(x.vehicleName||""),vehicleNumber:String(x.vehicleNumber||""),status:STATUS[x.status]?x.status:"station",firefighters:Number(x.firefighters||0),supplied:String(x.supplied||"no"),outlets,special:{fourInch:{active:!!sp.fourInch?.active,pressure:sp.fourInch?.pressure===""||sp.fourInch?.pressure==null?"":Number(sp.fourInch.pressure),sector:["1","2","3","4","5"].includes(String(sp.fourInch?.sector))?String(sp.fourInch.sector):"",location:String(sp.fourInch?.location||"")},deckGun:{active:!!sp.deckGun?.active,pressure:sp.deckGun?.pressure===""||sp.deckGun?.pressure==null?"":Number(sp.deckGun.pressure),sector:["1","2","3","4","5"].includes(String(sp.deckGun?.sector))?String(sp.deckGun.sector):"",location:String(sp.deckGun?.location||"")}},residualStart:x.residualStart===""||x.residualStart==null?"":Number(x.residualStart),residualEnd:x.residualEnd===""||x.residualEnd==null?"":Number(x.residualEnd),notes:String(x.notes||""),createdAt:String(x.createdAt||new Date().toISOString()),updatedAtText:String(x.updatedAtText||new Date().toLocaleString("fr-CA"))}
  }
  const persist=()=>write(CACHE,usages),pending=()=>read(PENDING,{}),queue=u=>{const p=pending();p[u.id]=u;write(PENDING,p)},clearPending=id=>{const p=pending();delete p[id];write(PENDING,p)};
  const suppliedLabel=v=>({no:"Non alimenté",hydrant:"Borne",tanker:"Citerne",relay:"Relais",other:"Autre"})[v]||v;
  const activeCount=u=>Object.values(u.outlets||{}).filter(o=>o.active).length+(u.special?.fourInch?.active?1:0)+(u.special?.deckGun?.active?1:0);
  function activeCommandEvent(){
    try{return JSON.parse(localStorage.getItem(ACTIVE_EVENT_DATA)||"null")}catch(_){return null}
  }
  function ensureEventLink(item){
    const event=activeCommandEvent();
    if(event?.id){
      item.eventId=String(event.id);
      item.sourceCallId=String(event.sourceCallId||"");
    }
    return item;
  }

  function render(){const box=$("vehicleUsageList");if(!box){window.dispatchEvent(new CustomEvent("firemap:vehicle-usages-ready"));return;}const sorted=[...usages].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));box.innerHTML=sorted.length?sorted.map(u=>`<article class="vehicle-usage-card"><div class="vehicle-usage-icon">🚒</div><div class="vehicle-usage-main"><h4>${esc(u.vehicleName||"Véhicule")}</h4><strong>${esc(STATUS[u.status])}</strong>${u.eventId?`<small class="vehicle-event-link">🚨 Événement lié</small>`:""}<p>👨‍🚒 ${u.firefighters} pompier${u.firefighters>1?"s":""} · 💧 ${esc(suppliedLabel(u.supplied))}</p><p>${activeCount(u)} sortie${activeCount(u)>1?"s":""} en service</p><small>${esc(u.updatedAtText)}</small></div><button class="secondary small" data-usage-edit="${esc(u.id)}">Ouvrir</button></article>`).join(""):'<div class="card-item"><strong>Aucune fiche véhicule</strong></div>'}
  function fillVehicleOptions(){const s=$("vehicleUsageVehicle");s.innerHTML=vehicles().map(v=>`<option value="${esc(v.id)}">${esc(v.name)}</option>`).join("")}
  function setStatus(s){$("vehicleUsageStatus").value=s;$("vehicleUsageStatusText").textContent=`État : ${STATUS[s]}`;document.querySelectorAll("[data-usage-status]").forEach(b=>b.classList.toggle("active",b.dataset.usageStatus===s))}
  function hid(k){return $(k==="fourInch"?"fourInchActive":k==="deckGun"?"deckGunActive":`outlet${k}Active`)}
  function active(k){return hid(k)?.value==="true"}
  function setActive(k,v){hid(k).value=v?"true":"false";const c=document.querySelector(`[data-outlet-card="${k}"]`);c?.classList.toggle("active",v);const b=c?.querySelector(".pump-outlet-toggle");b?.classList.toggle("active",v);const sm=b?.querySelector("small");if(sm)sm.textContent=v?"En service":(k==="deckGun"?"Non utilisé":"Non utilisée")}
  function fillOutlet(k,o={}){setActive(k,!!o.active);if(k==="fourInch"){$("fourInchPressure").value=o.pressure??"";$("fourInchSector").value=o.sector||"";$("fourInchLocation").value=o.location||"";return}if(k==="deckGun"){$("deckGunPressure").value=o.pressure??"";$("deckGunSector").value=o.sector||"";$("deckGunLocation").value=o.location||"";return}if(Number(k)>2)$(`outlet${k}Type`).value=o.type||"1¾ po";$(`outlet${k}Pressure`).value=o.pressure??"";$(`outlet${k}Sector`).value=o.sector||"";$(`outlet${k}Location`).value=o.location||""}
  function readOutlet(k){if(k==="fourInch")return{active:active(k),pressure:$("fourInchPressure").value,sector:$("fourInchSector").value,location:$("fourInchLocation").value.trim()};if(k==="deckGun")return{active:active(k),pressure:$("deckGunPressure").value,sector:$("deckGunSector").value,location:$("deckGunLocation").value.trim()};return{active:active(k),type:Number(k)<=2?"1¾ po":$(`outlet${k}Type`).value,pressure:$(`outlet${k}Pressure`).value,sector:$(`outlet${k}Sector`).value,location:$(`outlet${k}Location`).value.trim()}}
  function openForm(item=null){
    const saveStatus=$("vehicleUsageSaveStatus");
    if(saveStatus){
      saveStatus.textContent="";
      saveStatus.className="vehicle-usage-save-status hidden";
    }
fillVehicleOptions();const u=item?canonical(item):ensureEventLink(canonical({}));$("vehicleUsageId").value=item?u.id:"";$("vehicleUsageVehicle").value=u.vehicleId||vehicles()[0]?.id||"";$("vehicleUsageFirefighters").value=u.firefighters;$("vehicleUsageSupplied").value=u.supplied;$("vehicleUsageResidualStart").value=u.residualStart;$("vehicleUsageResidualEnd").value=u.residualEnd;$("vehicleUsageNotes").value=u.notes;$("vehicleUsageTitle").textContent=item?`Modifier — ${u.vehicleName}`:"Nouvelle fiche véhicule";$("deleteVehicleUsage").classList.toggle("hidden",!item);setStatus(u.status);for(let n=1;n<=6;n++)fillOutlet(String(n),u.outlets[n]);fillOutlet("fourInch",u.special.fourInch);fillOutlet("deckGun",u.special.deckGun);$("vehicleUsageDialog").showModal()}
  function fromForm(){
    const id=$("vehicleUsageId").value||uid();
    const select=$("vehicleUsageVehicle");
    const selectedId=String(select?.value||"");
    const selectedText=String(select?.selectedOptions?.[0]?.textContent||"").trim();

    const knownVehicle=vehicles().find(x=>String(x.id)===selectedId)
      || vehicles().find(x=>String(x.number||"")===selectedId)
      || vehicles().find(x=>String(x.name||"").trim()===selectedText)
      || null;

    const old=usages.find(x=>String(x.id)===String(id));
    const outlets={};
    for(let n=1;n<=6;n++)outlets[n]=readOutlet(String(n));

    const fallbackNumber=(selectedText.match(/\b(\d{2,4})\b/)||[])[1]||"";

    return ensureEventLink(canonical({
      ...old,
      id,
      vehicleId:String(knownVehicle?.id||selectedId),
      vehicleName:String(knownVehicle?.name||selectedText||"Véhicule"),
      vehicleNumber:String(knownVehicle?.number||fallbackNumber),
      status:$("vehicleUsageStatus").value,
      firefighters:$("vehicleUsageFirefighters").value,
      supplied:$("vehicleUsageSupplied").value,
      outlets,
      special:{
        fourInch:readOutlet("fourInch"),
        deckGun:readOutlet("deckGun")
      },
      residualStart:$("vehicleUsageResidualStart").value,
      residualEnd:$("vehicleUsageResidualEnd").value,
      notes:$("vehicleUsageNotes").value.trim(),
      createdAt:old?.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      updatedAtText:new Date().toLocaleString("fr-CA")
    }));
  }

  function setSaveStatus(message,type="info"){
    const box=$("vehicleUsageSaveStatus");
    if(!box)return;
    box.textContent=message;
    box.className=`vehicle-usage-save-status ${type}`;
  }

  function verifyLocalSave(id){
    try{
      const rows=JSON.parse(localStorage.getItem(CACHE)||"[]");
      return Array.isArray(rows)&&rows.some(x=>String(x.id)===String(id));
    }catch(_){
      return false;
    }
  }

  function syncVehicleUsageInBackground(u){
    const cloud=window.fireMapCloud;
    if(!cloud?.configured||typeof cloud.saveVehicleUsage!=="function")return;

    const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error("Délai Firebase dépassé")),8000));
    Promise.race([cloud.saveVehicleUsage(u),timeout])
      .then(()=>{
        clearPending(u.id);
        core.toast("Fiche véhicule synchronisée.");
      })
      .catch(err=>{
        console.warn("Synchronisation Firebase en attente.",err);
        // La fiche demeure dans PENDING et sera renvoyée plus tard.
      });
  }

  function save(e){
    e?.preventDefault?.();
    e?.stopPropagation?.();

    const button=$("saveVehicleUsageButton");
    if(button?.dataset.saving==="true")return;

    if(button){
      button.dataset.saving="true";
      button.disabled=true;
      button.textContent="Enregistrement…";
    }
    setSaveStatus("Enregistrement en cours…","info");

    try{
      const select=$("vehicleUsageVehicle");
      if(!select?.value)throw new Error("Aucun véhicule sélectionné.");

      let localRows=[];
      try{
        const parsed=JSON.parse(localStorage.getItem(CACHE)||"[]");
        localRows=Array.isArray(parsed)?parsed:[];
      }catch(_){}

      const merged=new Map();
      [...localRows,...usages].forEach(row=>{
        const item=canonical(row);
        merged.set(String(item.id),item);
      });
      usages=[...merged.values()];

      const u=fromForm();
      if(!u.vehicleId)throw new Error("Le véhicule sélectionné n’a pas d’identifiant.");

      const i=usages.findIndex(x=>String(x.id)===String(u.id));
      if(i>=0)usages[i]=u;
      else usages.push(u);

      // Sauvegarde locale immédiate et vérifiée.
      localStorage.setItem(CACHE,JSON.stringify(usages));
      queue(u);
      if(!verifyLocalSave(u.id))throw new Error("La fiche n’a pas pu être vérifiée dans le téléphone.");

      render();
      window.dispatchEvent(new CustomEvent("firemap:vehicle-usages-ready"));
      window.dispatchEvent(new CustomEvent("firemap:vehicle-usage-updated",{detail:{eventId:u.eventId,usage:u}}));
      window.fireMapVehicles?.refreshProfiles?.();

      setSaveStatus("✅ Fiche enregistrée sur le téléphone.","success");
      core.toast("Fiche véhicule enregistrée.");

      // Réactiver le bouton AVANT Firebase.
      if(button){
        button.dataset.saving="false";
        button.disabled=false;
        button.textContent="Enregistrer la fiche";
      }

      // Fermer tout de suite; Firebase ne peut plus bloquer l’interface.
      setTimeout(()=>$("vehicleUsageDialog")?.close(),300);
      syncVehicleUsageInBackground(u);
    }catch(err){
      console.error("Erreur d’enregistrement de la fiche véhicule.",err);
      setSaveStatus(`❌ ${err?.message||"Erreur pendant l’enregistrement."}`,"error");
      core.toast(err?.message||"Erreur pendant l’enregistrement.");
      if(button){
        button.dataset.saving="false";
        button.disabled=false;
        button.textContent="Enregistrer la fiche";
      }
    }
  }

  async function remove(){const id=$("vehicleUsageId").value;if(!id||!confirm("Supprimer cette fiche véhicule?"))return;usages=usages.filter(x=>x.id!==id);persist();render();$("vehicleUsageDialog").close();
    window.dispatchEvent(new CustomEvent("firemap:vehicle-usages-ready"));
    window.dispatchEvent(new CustomEvent("firemap:vehicle-usage-updated",{detail:{eventId:"",deletedId:id}}));
    try{await window.fireMapCloud?.deleteVehicleUsage?.(id)}catch(_){}}
  async function flush(){for(const u of Object.values(pending()))try{await window.fireMapCloud?.saveVehicleUsage?.(u);clearPending(u.id)}catch(_){}}
  function connect(){const c=window.fireMapCloud;if(!c?.subscribeVehicleUsages){render();return}cloudUnsub?.();cloudUnsub=c.subscribeVehicleUsages(items=>{const p=pending();usages=items.map(canonical);Object.values(p).forEach(x=>{const u=canonical(x),i=usages.findIndex(y=>y.id===u.id);if(i>=0)usages[i]=u;else usages.push(u)});persist();render();window.dispatchEvent(new CustomEvent("firemap:vehicle-usages-ready"));window.fireMapVehicles?.refreshProfiles?.();flush()},console.error);flush()}
  document.addEventListener("click",e=>{const s=e.target.closest("[data-usage-status]");if(s)setStatus(s.dataset.usageStatus);const o=e.target.closest("[data-outlet-toggle]");if(o){const k=o.dataset.outletToggle;setActive(k,!active(k))}const ed=e.target.closest("[data-usage-edit]");if(ed)openForm(usages.find(x=>x.id===ed.dataset.usageEdit))});
  if($("newVehicleUsage")) $("newVehicleUsage").onclick=()=>openForm();
  if($("closeVehicleUsageDialog")) $("closeVehicleUsageDialog").onclick=()=>$("vehicleUsageDialog").close();
  if($("cancelVehicleUsageDialog")) $("cancelVehicleUsageDialog").onclick=()=>$("vehicleUsageDialog").close();
  if($("deleteVehicleUsage")) $("deleteVehicleUsage").onclick=remove;
  if($("vehicleUsageForm")) $("vehicleUsageForm").addEventListener("submit",save);
  if($("saveVehicleUsageButton")) $("saveVehicleUsageButton").onclick=save;
  function latestForVehicle(vehicleId){
    const event=activeCommandEvent();
    const matching=[...usages].filter(u=>String(u.vehicleId)===String(vehicleId));

    const activeLinked=event?.id
      ? matching.filter(u=>
          String(u.eventId||"")===String(event.id) &&
          u.eventClosed!==true
        )
      : [];

    const currentProfiles=matching.filter(u=>
      u.eventClosed!==true &&
      (
        !u.eventId ||
        u.resetAfterEventId ||
        (event?.id && String(u.eventId||"")===String(event.id))
      )
    );

    const candidates=activeLinked.length
      ? activeLinked
      : (currentProfiles.length ? currentProfiles : matching.filter(u=>u.eventClosed!==true));

    return candidates
      .sort((a,b)=>{
        const aReset=a.resetAfterEventId?1:0;
        const bReset=b.resetAfterEventId?1:0;
        if(aReset!==bReset)return bReset-aReset;
        const ad=Date.parse(a.updatedAt||a.createdAt||"")||0;
        const bd=Date.parse(b.updatedAt||b.createdAt||"")||0;
        if(bd!==ad)return bd-ad;
        return String(b.updatedAtText||"").localeCompare(String(a.updatedAtText||""));
      })[0]||null;
  }
  function openForVehicle(vehicleId){
    if(!$("vehicleUsageDialog")){
      console.error("Fenêtre de fiche véhicule introuvable.");
      return I.toast("La fiche du véhicule ne peut pas s’ouvrir.");
    }
    const existing=latestForVehicle(vehicleId);
    if(existing)return openForm(existing);
    const vehicle=vehicles().find(v=>String(v.id)===String(vehicleId));
    const fresh=ensureEventLink(canonical({
      vehicleId:String(vehicle?.id||vehicleId),
      vehicleName:vehicle?.name||"",
      vehicleNumber:vehicle?.number||""
    }));
    openForm(fresh);
    $("vehicleUsageId").value="";
    $("vehicleUsageVehicle").value=String(vehicleId);
    $("vehicleUsageTitle").textContent=`Nouvelle fiche — ${vehicle?.name||"Véhicule"}`;
  }
  function getAll(){
    let local=[];
    try{
      const parsed=JSON.parse(localStorage.getItem(CACHE)||"[]");
      local=Array.isArray(parsed)?parsed:[];
    }catch(_){}
    const merged=new Map();
    [...usages,...local].forEach(row=>{
      const item=canonical(row);
      merged.set(String(item.id),item);
    });
    return [...merged.values()];
  }
  function emptyResetOutlets(){
    const outlets={};
    for(let number=1;number<=6;number++){
      outlets[number]={
        active:false,
        type:number<=2?"1¾ po":"",
        pressure:"",
        sector:"",
        location:""
      };
    }
    return outlets;
  }

  function resetAllUnitsAfterEvent(eventId){
    const targetEventId=String(eventId||"");
    if(!targetEventId)return {archived:0,reset:0};

    let local=[];
    try{
      const parsed=JSON.parse(localStorage.getItem(CACHE)||"[]");
      local=Array.isArray(parsed)?parsed:[];
    }catch(_){}

    const merged=new Map();
    [...local,...usages].forEach(row=>{
      const item=canonical(row);
      merged.set(String(item.id),item);
    });
    usages=[...merged.values()];

    const completedAt=new Date().toISOString();
    const affected=usages.filter(item=>String(item.eventId||"")===targetEventId);

    // Conserver les fiches originales dans l’historique de l’événement terminé.
    affected.forEach(item=>{
      item.eventClosed=true;
      item.eventClosedAt=completedAt;
      item.updatedAt=completedAt;
      item.updatedAtText=new Date(completedAt).toLocaleString("fr-CA");
      queue(item);
    });

    const resetProfiles=[];
    const seenVehicles=new Set();

    affected.forEach(old=>{
      const vehicleId=String(old.vehicleId||old.vehicleNumber||"");
      if(!vehicleId||seenVehicles.has(vehicleId))return;
      seenVehicles.add(vehicleId);

      const clean=canonical({
        id:`reset-${vehicleId}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        eventId:"",
        sourceCallId:"",
        vehicleId,
        vehicleName:String(old.vehicleName||`Unité ${vehicleId}`),
        vehicleNumber:String(old.vehicleNumber||vehicleId),
        status:"station",
        firefighters:0,
        supplied:"no",
        outlets:emptyResetOutlets(),
        special:{
          fourInch:{active:false,type:"4 po",pressure:"",sector:"",location:""},
          deckGun:{active:false,type:"Canon",pressure:"",sector:"",location:""}
        },
        residualStart:"",
        residualEnd:"",
        notes:"",
        createdAt:completedAt,
        updatedAt:completedAt,
        updatedAtText:new Date(completedAt).toLocaleString("fr-CA"),
        resetAfterEventId:targetEventId
      });

      usages.push(clean);
      queue(clean);
      resetProfiles.push(clean);
    });

    localStorage.removeItem(ACTIVE_EVENT_DATA);
    persist();
    render();

    window.dispatchEvent(new CustomEvent("firemap:vehicle-usages-ready"));
    window.dispatchEvent(new CustomEvent("firemap:vehicle-usage-updated",{
      detail:{
        eventId:targetEventId,
        reset:true,
        archived:affected.length,
        profiles:resetProfiles
      }
    }));
    window.fireMapVehicles?.refreshProfiles?.();

    affected.forEach(item=>syncVehicleUsageInBackground(item));
    resetProfiles.forEach(item=>syncVehicleUsageInBackground(item));

    return {archived:affected.length,reset:resetProfiles.length};
  }


  function refreshVehicleProfiles(){
    window.dispatchEvent(new CustomEvent("firemap:vehicle-usages-ready"));
  }

  usages=read(CACHE,[]).map(canonical);
  window.fireMapVehicleUsage={
    getAll,
    latestForVehicle,
    openForVehicle,
    activeCount,
    suppliedLabel,
    resetAllUnitsAfterEvent
  };
  window.addEventListener("firemap:command-event-linked",()=>{render();refreshVehicleProfiles()});
  render();
  refreshVehicleProfiles();
  if(window.fireMapCloud)connect();else window.addEventListener("firemap-cloud-ready",connect,{once:true});
})();
