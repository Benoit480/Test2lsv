(()=>{"use strict";const $=id=>document.getElementById(id),I=window.fireMapInternal;if(!I)return;const EC="firemap-command-events-v1",AC="firemap-command-active-v1",UC="firemap-vehicle-usages-v2",ACTIVE_EVENT_DATA="firemap-command-active-event-data";let events=[],activeId=localStorage.getItem(AC)||"",timer,commandCloudUnsub=null;const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))||f}catch(_){return f}},write=(k,v)=>localStorage.setItem(k,JSON.stringify(v)),uid=()=>crypto.randomUUID?crypto.randomUUID():`e-${Date.now()}`,esc=v=>I.esc?I.esc(v):String(v??"");function normAddress(v=""){return String(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\b(rue|avenue|av|boulevard|boul|chemin|ch|route|rang)\b/g,"").replace(/[^a-z0-9]/g,"")}
function buildings(){return window.fireMapPreplans?.getBuildings?.()||window.fireMapInternal?.state?.buildings||[]}
function findBuilding(e){const target=normAddress(e?.address||"");if(!target)return null;const list=buildings();return list.find(b=>normAddress(b.address||b.adresse||"")===target)||list.find(b=>{const a=normAddress(b.address||b.adresse||"");return a&&(a.includes(target)||target.includes(a))})||null}
function preventionRecord(id){return window.fireMapPrevention?.getRecordForBuilding?.(id)||null}
function preventionPhotoUrls(r){const out=[],seen=new Set();Object.values(r?.photosByCategory||{}).forEach(list=>Array.isArray(list)&&list.forEach(p=>{const u=String(p?.url||p?.downloadURL||p?.src||"");if(u&&!seen.has(u)){seen.add(u);out.push(u)}}));String(r?.photoUrls||"").split(/\n+/).map(x=>x.trim()).filter(Boolean).forEach(u=>{if(!seen.has(u)){seen.add(u);out.push(u)}});return out}
function renderPrevention(e){const b=findBuilding(e),empty=$("commandPreventionEmpty"),content=$("commandPreventionContent");if(!b){empty?.classList.remove("hidden");content?.classList.add("hidden");return}const r=preventionRecord(b.id)||{};empty?.classList.add("hidden");content?.classList.remove("hidden");content.dataset.buildingId=String(b.id);$("commandPreventionTitle").textContent=b.name||"Bâtiment";$("commandPreventionAddress").textContent=b.address||b.adresse||e.address||"";$("commandPreventionRisks").textContent=r.risksNotes||r.hazmatNotes||b.risks||"Aucun risque inscrit";$("commandPreventionFdc").textContent=r.fdcNotes||b.fdc||"Non inscrit";$("commandPreventionElectrical").textContent=r.electricalNotes||b.electrical||"Non inscrit";$("commandPreventionGas").textContent=r.gasNotes||b.gas||"Non inscrit";$("commandPreventionHazmat").textContent=r.hazmatNotes||b.hazmat||"Non inscrit";$("commandPreventionAccess").textContent=r.accessNotes||b.access||"Non inscrit";const photos=preventionPhotoUrls(r);$("commandPreventionPhotos").innerHTML=photos.length?photos.slice(0,12).map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Photo prévention" loading="lazy"></a>`).join(""):'<div class="card-item"><strong>Aucune photo</strong></div>'}
function active(){return events.find(e=>e.id===activeId&&e.status!=="closed")||null}function saveLocal(){
    write(EC,events);
    const e=active();
    if(e)write(ACTIVE_EVENT_DATA,{id:e.id,sourceCallId:e.sourceCallId||"",number:e.number,address:e.address});
    else localStorage.removeItem(ACTIVE_EVENT_DATA);
  }
  function usageList(){
    const e=active();
    if(!e)return[];
    return read(UC,[]).filter(u=>String(u.eventId||"")===String(e.id));
  }
  function newestByVehicle(){
    const m=new Map();
    [...usageList()].sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))).forEach(u=>{
      if(!m.has(String(u.vehicleId)))m.set(String(u.vehicleId),u)
    });
    return m
  }function outletRows(u){const a=[];Object.entries(u?.outlets||{}).forEach(([k,o])=>{if(o?.active)a.push({vehicle:u.vehicleName,name:Number(k)<=2?`Préconnect ${k}`:`Sortie ${k}`,type:o.type,psi:o.pressure,sector:o.sector,location:o.location})});if(u?.special?.fourInch?.active)a.push({vehicle:u.vehicleName,name:"Sortie 4 po",type:"4 po",psi:u.special.fourInch.pressure,sector:u.special.fourInch.sector,location:u.special.fourInch.location});if(u?.special?.deckGun?.active)a.push({vehicle:u.vehicleName,name:"Canon",type:"Canon",psi:u.special.deckGun.pressure,sector:u.special.deckGun.sector,location:u.special.deckGun.location});return a}function state(u){if(u?.supplied&&u.supplied!=="no")return["blue","🔵","Alimenté"];if(u?.status==="onscene")return["green","🟢","Sur les lieux"];if(u?.status==="enroute"||u?.status==="returning")return["yellow","🟡",u.status==="returning"?"Retour vers caserne":"En route"];return["gray","⚪","En caserne"]}function openForm(e=null){const n=new Date(),x=e||{id:"",number:`${n.getFullYear()}-${String(events.length+1).padStart(3,"0")}`,address:"",type:"",alarm:"1",chief:"",notes:""};$("commandEventId").value=x.id||"";$("commandEventNumberInput").value=x.number||"";$("commandEventAddressInput").value=x.address||"";$("commandEventTypeInput").value=x.type||"";$("commandEventAlarmInput").value=x.alarm||"1";$("commandEventChiefInput").value=x.chief||"";$("commandEventNotesInput").value=x.notes||"";$("commandEventDialogTitle").textContent=e?"Modifier l’événement":"Nouvel événement";$("commandEventDialog").showModal()}function journalIcon(category){
  return ({
    system:"⚙️",call:"📟",vehicle:"🚒",water:"💧",outlet:"🚿",
    pressure:"📊",sector:"📍",command:"📝",strategy:"🧭",
    radio:"📻",safety:"⚠️",victim:"🚑",utility:"🔌",other:"•"
  })[category]||"•";
}
function addJournal(e,msg,options={}){
  e.journal=Array.isArray(e.journal)?e.journal:[];
  const at=options.at||new Date().toISOString();
  const fingerprint=String(options.fingerprint||"");
  if(fingerprint&&e.journal.some(j=>String(j.fingerprint||"")===fingerprint))return false;
  e.journal.unshift({
    id:uid(),
    at,
    time:new Date(at).toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit"}),
    message:String(msg),
    category:String(options.category||"system"),
    level:String(options.level||"info"),
    author:String(options.author||""),
    details:String(options.details||""),
    fingerprint
  });
  return true;
}async function submit(ev){ev.preventDefault();const id=$("commandEventId").value||uid(),old=events.find(x=>x.id===id),e={...old,id,number:$("commandEventNumberInput").value.trim(),address:$("commandEventAddressInput").value.trim(),type:$("commandEventTypeInput").value.trim(),alarm:$("commandEventAlarmInput").value,chief:$("commandEventChiefInput").value.trim(),notes:$("commandEventNotesInput").value.trim(),sourceCallId:old?.sourceCallId||"",status:"active",startedAt:old?.startedAt||new Date().toISOString(),journal:old?.journal||[]};if(!old)addJournal(e,"Événement créé",{category:"system"});const i=events.findIndex(x=>x.id===id);if(i>=0)events[i]=e;else events.push(e);activeId=id;localStorage.setItem(AC,id);saveLocal();$("commandEventDialog").close();render();try{await window.fireMapCloud?.saveCommandEvent?.(e)}catch(_){}}async function createEventFromActiveCall(call={}){
    const address=String(call.adresse||call.address||"").trim();
    if(!address)return;
    const sourceCallId=String(call.callId||call.eventId||"").trim()||
      `call-${String(call.startedAt||new Date().toISOString()).replace(/\D/g,"").slice(0,14)}-${I.addressNorm(address).replace(/\s+/g,"-").slice(0,45)}`;

    let e=events.find(x=>String(x.sourceCallId||"")===sourceCallId&&x.status!=="closed")||active();
    const sameAddress=e&&String(e.address||"").trim().toLowerCase()===address.toLowerCase();

    if(!e){
      const now=new Date();
      e={
        id:uid(),
        sourceCallId,
        number:`${now.getFullYear()}-${String(events.length+1).padStart(3,"0")}`,
        address,
        type:String(call.callType||"Intervention"),
        alarm:String(call.alarmLevel||"1").match(/[1-5]/)?.[0]||"1",
        chief:"",
        notes:String(call.dispatchRaw||""),
        status:"active",
        startedAt:String(call.startedAt||now.toISOString()),
        journal:[]
      };
      addJournal(e,"Appel reçu et événement créé automatiquement",{category:"call",level:"important"});
      events.push(e);
      activeId=e.id;
      localStorage.setItem(AC,e.id);
    }else{
      let changed=false;
      if(!e.sourceCallId){e.sourceCallId=sourceCallId;changed=true}
      activeId=e.id;
      localStorage.setItem(AC,e.id);
      if(!sameAddress&&address){e.address=address;changed=true}
      if(call.callType&&(!e.type||e.type==="Intervention")){e.type=String(call.callType);changed=true}
      const alarm=String(call.alarmLevel||"").match(/[1-5]/)?.[0];
      if(alarm&&e.alarm!==alarm){e.alarm=alarm;changed=true}
      if(changed)addJournal(e,"Informations de l’appel mises à jour",{category:"call"});
    }

    saveLocal();
    window.dispatchEvent(new CustomEvent("firemap:command-event-linked",{detail:{
      eventId:e.id,
      sourceCallId:e.sourceCallId||sourceCallId,
      number:e.number,
      address:e.address
    }}));
    render();
    try{
      await window.fireMapCloud?.saveCommandEvent?.(e);
      I.toast("Événement ajouté automatiquement au poste de commandement.");
    }catch(err){
      console.warn(err);
      I.toast("Événement créé localement dans le poste de commandement.");
    }
  }


function eventStartedAtValue(event){
  const value=event?.startedAt;
  if(typeof value==="string")return Date.parse(value)||0;
  if(value?.toMillis)return value.toMillis();
  if(value?.seconds)return Number(value.seconds)*1000;
  return 0;
}

function applyCloudCommandEvents(items=[]){
  const localEvents=read(EC,[]);
  const merged=new Map(localEvents.map(event=>[String(event.id),event]));
  (Array.isArray(items)?items:[]).forEach(event=>{
    if(event?.id)merged.set(String(event.id),event);
  });
  events=[...merged.values()];

  const previousActiveId=String(activeId||localStorage.getItem(AC)||"");
  const previousEvent=previousActiveId
    ? events.find(event=>String(event.id)===previousActiveId)
    : null;

  if(previousEvent?.status==="closed"){
    activeId="";
    localStorage.removeItem(AC);
    localStorage.removeItem(ACTIVE_EVENT_DATA);
    write(EC,events);
    window.dispatchEvent(new CustomEvent("firemap:event-closed",{detail:previousEvent}));
    render();
    return;
  }

  let current=events.find(event=>
    String(event.id)===String(activeId) && event.status!=="closed"
  )||null;

  if(!current){
    current=events
      .filter(event=>event.status!=="closed")
      .sort((a,b)=>eventStartedAtValue(b)-eventStartedAtValue(a))[0]||null;
  }

  if(current){
    activeId=String(current.id);
    localStorage.setItem(AC,activeId);
    write(ACTIVE_EVENT_DATA,{
      id:current.id,
      sourceCallId:current.sourceCallId||"",
      number:current.number||"",
      address:current.address||""
    });
    window.dispatchEvent(new CustomEvent("firemap:command-event-linked",{detail:{
      eventId:current.id,
      sourceCallId:current.sourceCallId||"",
      number:current.number||"",
      address:current.address||""
    }}));
  }else{
    activeId="";
    localStorage.removeItem(AC);
    localStorage.removeItem(ACTIVE_EVENT_DATA);
  }

  write(EC,events);
  render();
}

function connectCommandCloud(){
  const cloud=window.fireMapCloud;
  if(!cloud?.subscribeCommandEvents)return;
  commandCloudUnsub?.();
  commandCloudUnsub=cloud.subscribeCommandEvents(
    items=>applyCloudCommandEvents(items),
    error=>console.warn("Synchronisation des événements indisponible.",error)
  );
}

function residualValues(rows){
  const values=[];
  rows.forEach(({u})=>{
    [u?.residualStart,u?.residualEnd].forEach(value=>{
      if(value===""||value==null)return;
      const number=Number(value);
      if(Number.isFinite(number))values.push(number);
    });
  });
  return values;
}
function sectorGroups(outlets){
  const groups=new Map();
  outlets.forEach(outlet=>{
    const sector=String(outlet.sector||"").trim();
    if(!sector)return;
    if(!groups.has(sector))groups.set(sector,{sector,outlets:[],vehicles:new Set()});
    const group=groups.get(sector);
    group.outlets.push(outlet);
    if(outlet.vehicle)group.vehicles.add(outlet.vehicle);
  });
  return [...groups.values()].sort((a,b)=>Number(a.sector)-Number(b.sector));
}
function renderSectors(outlets){
  const groups=sectorGroups(outlets);
  $("commandActiveSectorCount").textContent=groups.length;
  $("commandSectorList").innerHTML=groups.length?groups.map(group=>{
    const psi=group.outlets
      .map(outlet=>Number(outlet.psi))
      .filter(Number.isFinite);
    const average=psi.length?Math.round(psi.reduce((sum,value)=>sum+value,0)/psi.length):null;
    return `<article class="command-sector-card">
      <div class="command-sector-title">
        <span>📍</span>
        <div><small>SECTEUR</small><h3>Secteur ${esc(group.sector)}</h3></div>
      </div>
      <div class="command-sector-stats">
        <span><strong>${group.vehicles.size}</strong> véhicule${group.vehicles.size>1?"s":""}</span>
        <span><strong>${group.outlets.length}</strong> sortie${group.outlets.length>1?"s":""}</span>
        <span><strong>${average!=null?`${average} PSI`:"—"}</strong> pression moyenne</span>
      </div>
      <ul>${group.outlets.map(outlet=>`<li>
        <strong>${esc(outlet.vehicle)} — ${esc(outlet.name)}</strong>
        <span>${outlet.psi!==""&&outlet.psi!=null?`${esc(outlet.psi)} PSI`:"Pression non inscrite"}${outlet.location?` · ${esc(outlet.location)}`:""}</span>
      </li>`).join("")}</ul>
    </article>`;
  }).join(""):'<div class="card-item"><strong>Aucun secteur actif</strong><p>Choisissez un secteur dans une sortie active pour l’afficher ici.</p></div>';
}

const JOURNAL_SNAPSHOT_PREFIX="firemap-command-journal-snapshot-";
let journalFilter="all";
let automaticJournalBusy=false;

function usageOutletMap(u){
  const map=new Map();
  Object.entries(u?.outlets||{}).forEach(([key,o])=>{
    map.set(`outlet-${key}`,{
      active:!!o?.active,
      name:Number(key)<=2?`Préconnect ${key}`:`Sortie ${key}`,
      type:String(o?.type||""),
      pressure:o?.pressure,
      sector:String(o?.sector||""),
      location:String(o?.location||"")
    });
  });
  map.set("fourInch",{
    active:!!u?.special?.fourInch?.active,name:"Sortie 4 po",type:"4 po",
    pressure:u?.special?.fourInch?.pressure,sector:String(u?.special?.fourInch?.sector||""),
    location:String(u?.special?.fourInch?.location||"")
  });
  map.set("deckGun",{
    active:!!u?.special?.deckGun?.active,name:"Canon",type:"Canon",
    pressure:u?.special?.deckGun?.pressure,sector:String(u?.special?.deckGun?.sector||""),
    location:String(u?.special?.deckGun?.location||"")
  });
  return map;
}
function usageSnapshot(u){
  return {
    vehicleId:String(u?.vehicleId||""),
    vehicleName:String(u?.vehicleName||"Véhicule"),
    status:String(u?.status||"station"),
    supplied:String(u?.supplied||"no"),
    residualStart:u?.residualStart,
    residualEnd:u?.residualEnd,
    outlets:Object.fromEntries(usageOutletMap(u))
  };
}
function readJournalSnapshot(eventId){
  return read(JOURNAL_SNAPSHOT_PREFIX+eventId,{});
}
function writeJournalSnapshot(eventId,value){
  write(JOURNAL_SNAPSHOT_PREFIX+eventId,value);
}
function statusText(value){
  return ({station:"En caserne",enroute:"En route",onscene:"Arrivé sur les lieux",returning:"Retour vers caserne"})[value]||value;
}
function supplyText(value){
  return ({no:"Non alimenté",hydrant:"Alimenté par une borne",tanker:"Alimenté par une citerne",relay:"Alimenté par relais",other:"Alimenté — autre source"})[value]||value;
}
function outletDetails(outlet){
  return [
    outlet.type,
    outlet.pressure!==""&&outlet.pressure!=null?`${outlet.pressure} PSI`:"",
    outlet.sector?`Secteur ${outlet.sector}`:"",
    outlet.location
  ].filter(Boolean).join(" · ");
}
function buildAutomaticJournal(event,usageRows){
  if(!event||automaticJournalBusy)return false;
  automaticJournalBusy=true;
  try{
    const previous=readJournalSnapshot(event.id);
    const next={};
    let changed=false;

    usageRows.forEach(u=>{
      const key=String(u.vehicleId||u.vehicleName||"");
      const current=usageSnapshot(u);
      next[key]=current;
      const old=previous[key];

      // First observation: log meaningful current state without flooding the journal.
      if(!old){
        if(current.status!=="station"){
          changed=addJournal(event,`${current.vehicleName} — ${statusText(current.status)}`,{
            category:"vehicle",
            fingerprint:`${event.id}:${key}:first-status:${current.status}`
          })||changed;
        }
        if(current.supplied!=="no"){
          changed=addJournal(event,`${current.vehicleName} — ${supplyText(current.supplied)}`,{
            category:"water",level:"important",
            fingerprint:`${event.id}:${key}:first-supply:${current.supplied}`
          })||changed;
        }
        Object.entries(current.outlets).forEach(([outletKey,outlet])=>{
          if(!outlet.active)return;
          changed=addJournal(event,`${current.vehicleName} — ${outlet.name} mise en service`,{
            category:"outlet",
            details:outletDetails(outlet),
            fingerprint:`${event.id}:${key}:first-outlet:${outletKey}:${outlet.active}:${outlet.pressure}:${outlet.sector}:${outlet.location}`
          })||changed;
        });
        [["initiale",current.residualStart],["finale",current.residualEnd]].forEach(([label,value])=>{
          if(value===""||value==null)return;
          changed=addJournal(event,`${current.vehicleName} — pression résiduelle ${label}: ${value} PSI`,{
            category:"pressure",
            level:Number(value)<20?"critical":Number(value)<30?"attention":"info",
            fingerprint:`${event.id}:${key}:first-residual:${label}:${value}`
          })||changed;
        });
        return;
      }

      if(old.status!==current.status){
        changed=addJournal(event,`${current.vehicleName} — ${statusText(current.status)}`,{
          category:"vehicle",
          fingerprint:`${event.id}:${key}:status:${old.status}->${current.status}:${u.updatedAt||u.updatedAtText||""}`
        })||changed;
      }

      if(old.supplied!==current.supplied){
        changed=addJournal(event,`${current.vehicleName} — ${supplyText(current.supplied)}`,{
          category:"water",
          level:current.supplied==="no"?"attention":"important",
          fingerprint:`${event.id}:${key}:supply:${old.supplied}->${current.supplied}:${u.updatedAt||u.updatedAtText||""}`
        })||changed;
      }

      [["initiale","residualStart"],["finale","residualEnd"]].forEach(([label,field])=>{
        if(String(old[field]??"")===String(current[field]??""))return;
        if(current[field]===""||current[field]==null)return;
        const value=Number(current[field]);
        changed=addJournal(event,`${current.vehicleName} — pression résiduelle ${label}: ${current[field]} PSI`,{
          category:"pressure",
          level:Number.isFinite(value)&&value<20?"critical":Number.isFinite(value)&&value<30?"attention":"info",
          fingerprint:`${event.id}:${key}:residual:${field}:${old[field]}->${current[field]}:${u.updatedAt||u.updatedAtText||""}`
        })||changed;
      });

      const oldOutlets=new Map(Object.entries(old.outlets||{}));
      Object.entries(current.outlets).forEach(([outletKey,outlet])=>{
        const prior=oldOutlets.get(outletKey)||{active:false};
        if(prior.active!==outlet.active){
          changed=addJournal(event,`${current.vehicleName} — ${outlet.name} ${outlet.active?"mise en service":"fermée"}`,{
            category:"outlet",
            level:outlet.active?"info":"attention",
            details:outlet.active?outletDetails(outlet):"",
            fingerprint:`${event.id}:${key}:outlet-state:${outletKey}:${prior.active}->${outlet.active}:${u.updatedAt||u.updatedAtText||""}`
          })||changed;
        }else if(outlet.active&&(
          String(prior.pressure??"")!==String(outlet.pressure??"")||
          String(prior.sector||"")!==String(outlet.sector||"")||
          String(prior.location||"")!==String(outlet.location||"")
        )){
          changed=addJournal(event,`${current.vehicleName} — ${outlet.name} mise à jour`,{
            category:"outlet",
            details:outletDetails(outlet),
            fingerprint:`${event.id}:${key}:outlet-update:${outletKey}:${outlet.pressure}:${outlet.sector}:${outlet.location}:${u.updatedAt||u.updatedAtText||""}`
          })||changed;
        }
      });
    });

    writeJournalSnapshot(event.id,next);
    return changed;
  }finally{
    automaticJournalBusy=false;
  }
}
function journalMatches(entry,filter){
  if(filter==="all")return true;
  if(filter==="critical")return entry.level==="critical";
  return entry.category===filter;
}
function journalLevelLabel(level){
  return ({info:"Information",attention:"Attention",important:"Important",critical:"Critique"})[level]||level;
}
function renderJournal(event){
  const entries=(event.journal||[]).filter(entry=>journalMatches(entry,journalFilter));
  const counts=(event.journal||[]).reduce((result,entry)=>{
    result[entry.level]=(result[entry.level]||0)+1;
    return result;
  },{});
  $("commandJournalSummary").innerHTML=`
    <span><strong>${(event.journal||[]).length}</strong> entrées</span>
    <span><strong>${counts.critical||0}</strong> critiques</span>
    <span><strong>${counts.important||0}</strong> importantes</span>`;
  $("commandJournalList").innerHTML=entries.length?entries.map(entry=>`
    <article class="command-journal-item level-${esc(entry.level||"info")}">
      <time>${esc(entry.time||"")}</time>
      <div class="command-journal-icon">${journalIcon(entry.category)}</div>
      <div class="command-journal-content">
        <div class="command-journal-meta">
          <strong>${esc(journalLevelLabel(entry.level||"info"))}</strong>
          <span>${esc(entry.author||"Automatique")}</span>
        </div>
        <p>${esc(entry.message)}</p>
        ${entry.details?`<small>${esc(entry.details)}</small>`:""}
      </div>
    </article>`).join(""):'<div class="card-item"><strong>Aucune entrée pour ce filtre</strong></div>';
}
function saveEventInBackground(event){
  saveLocal();
  Promise.resolve(window.fireMapCloud?.saveCommandEvent?.(event)).catch(error=>console.warn("Journal en attente de synchronisation.",error));
}

function gpsPositionState(vehicle){
  if(!vehicle?.sharing)return {key:"off",label:"GPS arrêté"};
  const stamp=Date.parse(vehicle.gpsUpdatedAt||vehicle.updatedAt||"");
  const age=Number.isFinite(stamp)?Math.max(0,Math.floor((Date.now()-stamp)/1000)):Infinity;
  if(age<=20)return {key:"live",label:"En direct"};
  if(age<=90)return {key:"delayed",label:`Retard ${age} s`};
  return {key:"stale",label:"Position ancienne"};
}
function renderGpsVehicles(vehicles){
  const box=$("commandGpsList");if(!box)return;
  box.innerHTML=vehicles.map(v=>{
    const gps=gpsPositionState(v);
    const speed=Number.isFinite(Number(v.speed))?Math.round(Number(v.speed)*3.6):null;
    const accuracy=Number.isFinite(Number(v.accuracy))?Math.round(Number(v.accuracy)):null;
    return `<article class="command-gps-card ${gps.key}">
      <div class="command-gps-unit"><span>${esc(v.icon||"🚒")}</span><div><h3>${esc(v.name)}</h3><strong>${gps.label}</strong></div></div>
      <div class="command-gps-data"><span>Dernière position <strong>${esc(v.updatedAtText||"Jamais")}</strong></span><span>Précision <strong>${accuracy!=null?`±${accuracy} m`:"—"}</strong></span><span>Vitesse <strong>${speed!=null?`${speed} km/h`:"—"}</strong></span></div>
      <button class="secondary" data-command-gps-vehicle="${esc(v.id)}" ${Number.isFinite(Number(v.lat))&&Number.isFinite(Number(v.lng))?"":"disabled"}>Voir sur la carte</button>
    </article>`;
  }).join("");
}
function render(){const e=active();$("commandEmpty").classList.toggle("hidden",!!e);$("commandDashboard").classList.toggle("hidden",!e);if(!e)return;const vehicles=window.fireMapVehicles?.getVehicles?.()||[],map=newestByVehicle(),rows=vehicles.map(v=>({v,u:map.get(String(v.id))})),eng=rows.filter(x=>x.u&&x.u.status!=="station"),out=rows.flatMap(x=>outletRows(x.u));$("commandEventNumber").textContent=`ÉVÉNEMENT ${e.number}`;$("commandEventAddress").textContent=e.address;$("commandEventType").textContent=e.type||"Type non inscrit";$("commandVehicleCount").textContent=eng.length;$("commandOnSceneCount").textContent=rows.filter(x=>state(x.u)[0]==="green").length;$("commandSuppliedCount").textContent=rows.filter(x=>state(x.u)[0]==="blue").length;$("commandFirefighterCount").textContent=rows.reduce((s,x)=>s+Number(x.u?.firefighters||0),0);$("commandOutletCount").textContent=out.length;const residuals=residualValues(rows);$("commandResidualMinimum").textContent=residuals.length?`${Math.min(...residuals)} PSI`:"—";$("commandVehicleList").innerHTML=rows.map(({v,u})=>{const s=state(u);return`<article class="command-vehicle-card ${s[0]}"><span>${s[1]}</span><div><h3>${esc(v.name)}</h3><strong>${s[2]}</strong><p>👨‍🚒 ${Number(u?.firefighters||0)} · 💧 ${outletRows(u).length}</p></div></article>`}).join("");renderGpsVehicles(vehicles);$("commandOutletList").innerHTML=out.length?out.map(o=>`<article class="command-outlet-card"><strong>${esc(o.vehicle)} — ${esc(o.name)}</strong><span>${esc(o.type||"")} · ${o.psi!==""&&o.psi!=null?o.psi:"—"} PSI · ${o.sector?`Secteur ${esc(o.sector)}`:"Secteur non précisé"}</span><p>${esc(o.location||"Affectation non inscrite")}</p></article>`).join(""):'<div class="card-item"><strong>Aucune sortie active</strong></div>';renderSectors(out);renderPrevention(e);const automaticChanged=buildAutomaticJournal(e,rows.map(x=>x.u).filter(Boolean));if(automaticChanged)saveEventInBackground(e);renderJournal(e);$("commandEventMeta").textContent=`Alarme ${e.alarm} · Chef : ${e.chief||"—"} · Début : ${new Date(e.startedAt).toLocaleString("fr-CA")}`;tick()}function tick(){const e=active();if(!e)return;const s=Math.max(0,Math.floor((Date.now()-new Date(e.startedAt))/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;$("commandElapsed").textContent=h?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`}function tab(name){document.querySelectorAll("[data-command-tab]").forEach(b=>b.classList.toggle("active",b.dataset.commandTab===name));["Vehicles","Outlets","Sectors","Gps","Prevention","Journal","Event"].forEach(n=>$("commandPanel"+n).classList.toggle("hidden",n.toLowerCase()!==name))}$("commandOpenPrevention").onclick=()=>{const id=$("commandPreventionContent")?.dataset?.buildingId;if(!id)return I.toast("Aucune fiche de prévention liée.");window.fireMapPrevention?.open?.(id)};
$("commandShowPreventionMap").onclick=()=>{const id=$("commandPreventionContent")?.dataset?.buildingId;if(!id)return I.toast("Aucun bâtiment lié.");window.fireMapPreplans?.showBuildingOnMap?.(id)};
window.addEventListener("firemap:prevention-updated",()=>renderPrevention(active()));
window.addEventListener("firemap:buildings-updated",()=>renderPrevention(active()));
document.addEventListener("click",e=>{const b=e.target.closest("[data-command-tab]");if(b)tab(b.dataset.commandTab)});$("newCommandEvent").onclick=()=>openForm();$("editCommandEvent").onclick=()=>openForm(active());$("closeCommandEventDialog").onclick=$("cancelCommandEventDialog").onclick=()=>$("commandEventDialog").close();$("commandEventForm").onsubmit=submit;$("commandJournalAdd").onclick=()=>{
  const e=active(),text=$("commandJournalText").value.trim();
  if(!e||!text)return;
  addJournal(e,text,{
    category:$("commandJournalCategory").value,
    level:$("commandJournalLevel").value,
    author:$("commandJournalAuthor").value.trim()||"Chef des opérations"
  });
  $("commandJournalText").value="";
  saveEventInBackground(e);
  render();
};
$("commandJournalText").addEventListener("keydown",event=>{
  if(event.key==="Enter"){
    event.preventDefault();
    $("commandJournalAdd").click();
  }
});
document.addEventListener("click",event=>{
  const filter=event.target.closest("[data-journal-filter]");
  if(!filter)return;
  journalFilter=filter.dataset.journalFilter;
  document.querySelectorAll("[data-journal-filter]").forEach(button=>button.classList.toggle("active",button===filter));
  const e=active();
  if(e)renderJournal(e);
});async function legacyCloseActiveCommandEvent_DISABLED(){
  if(!window.fireMapAccount?.isChief?.()){
    I.toast("Seul le compte 102 peut terminer un événement.");
    return false;
  }

  const event=active();
  if(!event)return false;
  if(!confirm("Terminer cet événement et réinitialiser toutes les unités?"))return false;

  event.status="closed";
  event.closedAt=new Date().toISOString();
  event.closedBy="102";
  addJournal(event,"Intervention terminée par le compte 102",{
    category:"system",
    level:"important",
    author:"102 — Chef des opérations"
  });

  saveLocal();
  const result=window.fireMapVehicleUsage?.resetAllUnitsAfterEvent?.(event.id)||{archived:0,reset:0};

  activeId="";
  localStorage.removeItem(AC);
  localStorage.removeItem(ACTIVE_EVENT_DATA);
  write(EC,events);

  window.dispatchEvent(new CustomEvent("firemap:event-closed",{detail:event}));
  render();

  I.toast(
    `Événement terminé — ${result.reset||0} unité${result.reset===1?"":"s"} réinitialisée${result.reset===1?"":"s"}.`
  );

  try{
    await window.fireMapCloud?.saveCommandEvent?.(event);
  }catch(error){
    console.warn("Fermeture enregistrée localement, synchronisation en attente.",error);
    I.toast("Événement fermé localement — synchronisation Firebase en attente.");
  }
  return true;
}

/* V24: fermeture gérée exclusivement par event-manager.js */

window.addEventListener("firemap:call-active",e=>createEventFromActiveCall(e.detail||{}));
  window.fireMapCommandCenter={
    createFromActiveCall:createEventFromActiveCall,
    open:()=>{if(!window.fireMapAccount?.canAccessCommand?.())return I.toast("Le Centre de commandement est réservé au compte 102.");I.showView("command")},
    getActiveEvent:active,
    refresh:render,
    getEvents:()=>events,
    setActiveId:(id)=>{
      activeId=String(id||"");
      if(activeId)localStorage.setItem(AC,activeId);
      else localStorage.removeItem(AC);
      render();
    }
  };
  document.addEventListener("click",event=>{
    const link=event.target.closest('[data-view="command"]');
    if(link&&!window.fireMapAccount?.canAccessCommand?.()){
      event.preventDefault();event.stopImmediatePropagation();
      I.toast("Le Centre de commandement est réservé au compte 102.");
    }
  },true);
  function applyEndEventPermission(){
    const button=$("endCommandEvent");
    const allowed=window.fireMapAccount?.isChief?.()===true;
    if(button){
      button.classList.toggle("hidden",!allowed);
      button.disabled=!allowed;
      button.setAttribute("aria-hidden",allowed?"false":"true");
    }
  }
  applyEndEventPermission();

  window.addEventListener("firemap:account-changed",()=>{
    applyEndEventPermission();
    if(!window.fireMapAccount?.canAccessCommand?.()&&document.querySelector("#view-command.active"))I.showView("vehicles");
  });
  $("commandGpsOpenMap")?.addEventListener("click",()=>I.showView("map"));
document.addEventListener("click",event=>{
  const target=event.target.closest("[data-command-gps-vehicle]");
  if(!target)return;
  window.fireMapVehicles?.showVehicle?.(target.dataset.commandGpsVehicle);
});

document.addEventListener("click",event=>{
  const endButton=event.target.closest?.("#endCommandEvent");
  if(endButton && !window.fireMapAccount?.isChief?.()){
    event.preventDefault();
    event.stopImmediatePropagation();
    I.toast("Seul le compte 102 peut terminer un événement.");
  }
},true);

  events=read(EC,[]);
  render();
  connectCommandCloud();
  window.addEventListener("firemap-cloud-ready",connectCommandCloud);
  timer=setInterval(tick,1000);
  window.addEventListener("storage",render);
  window.addEventListener("firemap:vehicle-usage-updated",render);
  window.addEventListener("firemap:command-event-linked",render);
})();