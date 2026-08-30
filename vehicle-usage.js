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
  function timestampIso(value,fallback=""){
    if(!value)return fallback;
    if(typeof value==="string")return value;
    try{
      if(typeof value.toDate==="function")return value.toDate().toISOString();
      if(Number.isFinite(Number(value.seconds)))return new Date(Number(value.seconds)*1000).toISOString();
      if(value instanceof Date)return value.toISOString();
    }catch(_){}
    return fallback;
  }
  function canonical(x={}){
    const outlets={};
    for(let n=1;n<=6;n++){
      const o={...emptyOutlet(n),...(x.outlets?.[n]||x.outlets?.[String(n)]||{})};
      o.active=!!o.active;
      o.pressure=o.pressure===""||o.pressure==null?"":Number(o.pressure);
      o.sector=["1","2","3","4","5"].includes(String(o.sector))?String(o.sector):"";
      o.location=String(o.location||"");
      o.type=n<=2?"1¾ po":(["1¾ po","2½ po"].includes(o.type)?o.type:"1¾ po");
      outlets[n]=o;
    }
    const sp=x.special||{};
    const nowIso=new Date().toISOString();
    const createdAt=timestampIso(x.createdAt,nowIso);
    const updatedAt=timestampIso(x.updatedAt,createdAt);
    const updatedDate=new Date(updatedAt);
    return{
      id:String(x.id||uid()),
      eventId:String(x.eventId||""),
      sourceCallId:String(x.sourceCallId||""),
      vehicleId:String(x.vehicleId||""),
      vehicleName:String(x.vehicleName||""),
      vehicleNumber:String(x.vehicleNumber||""),
      status:STATUS[x.status]?x.status:"station",
      firefighters:Number(x.firefighters||0),
      supplied:String(x.supplied||"no"),
      outlets,
      special:{
        fourInch:{active:!!sp.fourInch?.active,pressure:sp.fourInch?.pressure===""||sp.fourInch?.pressure==null?"":Number(sp.fourInch.pressure),sector:["1","2","3","4","5"].includes(String(sp.fourInch?.sector))?String(sp.fourInch.sector):"",location:String(sp.fourInch?.location||"")},
        deckGun:{active:!!sp.deckGun?.active,pressure:sp.deckGun?.pressure===""||sp.deckGun?.pressure==null?"":Number(sp.deckGun.pressure),sector:["1","2","3","4","5"].includes(String(sp.deckGun?.sector))?String(sp.deckGun.sector):"",location:String(sp.deckGun?.location||"")}
      },
      chef:{
        officer:String(x.chef?.officer||""),
        commandMode:String(x.chef?.commandMode||""),
        strategy:String(x.chef?.strategy||""),
        alarmLevel:String(x.chef?.alarmLevel||""),
        sector1:String(x.chef?.sector1||""),
        sector2:String(x.chef?.sector2||""),
        sector3:String(x.chef?.sector3||""),
        sector4:String(x.chef?.sector4||""),
        sector5:String(x.chef?.sector5||""),
        safety:String(x.chef?.safety||""),
        resources:String(x.chef?.resources||""),
        priorities:String(x.chef?.priorities||"")
      },
      ladder:{
        operator:String(x.ladder?.operator||""),deployed:String(x.ladder?.deployed||"no"),
        height:x.ladder?.height===""||x.ladder?.height==null?"":Number(x.ladder.height),
        angle:x.ladder?.angle===""||x.ladder?.angle==null?"":Number(x.ladder.angle),
        stabilizers:String(x.ladder?.stabilizers||""),supply:String(x.ladder?.supply||"none"),
        supplyPsi:x.ladder?.supplyPsi===""||x.ladder?.supplyPsi==null?"":Number(x.ladder.supplyPsi),
        gun:String(x.ladder?.gun||"off"),gunPsi:x.ladder?.gunPsi===""||x.ladder?.gunPsi==null?"":Number(x.ladder.gunPsi),
        sector:String(x.ladder?.sector||""),assignment:String(x.ladder?.assignment||"")
      },
      tanker:{
        capacity:x.tanker?.capacity===""||x.tanker?.capacity==null?"":Number(x.tanker.capacity),
        level:String(x.tanker?.level||"100"),mode:String(x.tanker?.mode||""),fillSource:String(x.tanker?.fillSource||""),
        supplying:String(x.tanker?.supplying||""),flow:x.tanker?.flow===""||x.tanker?.flow==null?"":Number(x.tanker.flow),
        shuttleStart:String(x.tanker?.shuttleStart||""),shuttleReturn:String(x.tanker?.shuttleReturn||""),
        turnaround:x.tanker?.turnaround===""||x.tanker?.turnaround==null?"":Number(x.tanker.turnaround),
        trips:x.tanker?.trips===""||x.tanker?.trips==null?"":Number(x.tanker.trips),notes:String(x.tanker?.notes||"")
      },
      residualStart:x.residualStart===""||x.residualStart==null?"":Number(x.residualStart),
      residualEnd:x.residualEnd===""||x.residualEnd==null?"":Number(x.residualEnd),
      notes:String(x.notes||""),
      createdAt,
      updatedAt,
      updatedAtText:String(x.updatedAtText||(
        Number.isFinite(updatedDate.getTime())?updatedDate.toLocaleString("fr-CA"):new Date().toLocaleString("fr-CA")
      )),
      eventClosed:x.eventClosed===true,
      eventClosedAt:timestampIso(x.eventClosedAt,""),
      resetAfterEventId:String(x.resetAfterEventId||"")
    }
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
  function vehicleNumberFromSelect(){
    const s=$("vehicleUsageVehicle");
    const text=String(s?.selectedOptions?.[0]?.textContent||"");
    const value=String(s?.value||"");
    return (text.match(/\b(102|202|502|602|802|902)\b/)||value.match(/\b(102|202|502|602|802|902)\b/)||[])[1]||"";
  }

  function setVehicleFormMode(number){
    const isChef=String(number)==="102",isPump=String(number)==="202",isLadder=String(number)==="502",isTanker=String(number)==="802";
    const noPump=isChef||isLadder||isTanker;
    $("vehicleUsageChefSection")?.classList.toggle("hidden",!isChef);
    $("vehicleUsageLadderSection")?.classList.toggle("hidden",!isLadder);
    $("vehicleUsageTankerSection")?.classList.toggle("hidden",!isTanker);
    $("vehicleUsageSuppliedLabel")?.classList.toggle("hidden",noPump);
    $("vehicleUsagePumpSection")?.classList.toggle("hidden",noPump);
    $("vehicleUsageSpecialSection")?.classList.toggle("hidden",noPump);
    $("vehicleUsagePressureSection")?.classList.toggle("hidden",noPump);
    if(isChef)$("vehicleUsageTitle").textContent="Fiche 102 — Chef";
    else if(isPump)$("vehicleUsageTitle").textContent="Fiche 202 — Autopompe";
    else if(isLadder)$("vehicleUsageTitle").textContent="Fiche 502 — Échelle";
    else if(isTanker)$("vehicleUsageTitle").textContent="Fiche 802 — Citerne";
  }

  function fillChef(c={}){
    $("vehicleUsageChefOfficer").value=c.officer||"";
    $("vehicleUsageChefCommandMode").value=c.commandMode||"";
    $("vehicleUsageChefStrategy").value=c.strategy||"";
    $("vehicleUsageChefAlarm").value=c.alarmLevel||"";
    $("vehicleUsageChefSector1").value=c.sector1||"";
    $("vehicleUsageChefSector2").value=c.sector2||"";
    $("vehicleUsageChefSector3").value=c.sector3||"";
    $("vehicleUsageChefSector4").value=c.sector4||"";
    $("vehicleUsageChefSector5").value=c.sector5||"";
    $("vehicleUsageChefSafety").value=c.safety||"";
    $("vehicleUsageChefResources").value=c.resources||"";
    $("vehicleUsageChefPriorities").value=c.priorities||"";
  }

  function readChef(){
    return{
      officer:$("vehicleUsageChefOfficer").value.trim(),
      commandMode:$("vehicleUsageChefCommandMode").value,
      strategy:$("vehicleUsageChefStrategy").value,
      alarmLevel:$("vehicleUsageChefAlarm").value,
      sector1:$("vehicleUsageChefSector1").value.trim(),
      sector2:$("vehicleUsageChefSector2").value.trim(),
      sector3:$("vehicleUsageChefSector3").value.trim(),
      sector4:$("vehicleUsageChefSector4").value.trim(),
      sector5:$("vehicleUsageChefSector5").value.trim(),
      safety:$("vehicleUsageChefSafety").value.trim(),
      resources:$("vehicleUsageChefResources").value.trim(),
      priorities:$("vehicleUsageChefPriorities").value.trim()
    };
  }


  function fillLadder(x={}){for(const [id,k] of [["vehicleUsageLadderOperator","operator"],["vehicleUsageLadderDeployed","deployed"],["vehicleUsageLadderHeight","height"],["vehicleUsageLadderAngle","angle"],["vehicleUsageLadderStabilizers","stabilizers"],["vehicleUsageLadderSupply","supply"],["vehicleUsageLadderSupplyPsi","supplyPsi"],["vehicleUsageLadderGun","gun"],["vehicleUsageLadderGunPsi","gunPsi"],["vehicleUsageLadderSector","sector"],["vehicleUsageLadderAssignment","assignment"]])$(id).value=x[k]??""}
  function readLadder(){return{operator:$("vehicleUsageLadderOperator").value.trim(),deployed:$("vehicleUsageLadderDeployed").value,height:$("vehicleUsageLadderHeight").value,angle:$("vehicleUsageLadderAngle").value,stabilizers:$("vehicleUsageLadderStabilizers").value,supply:$("vehicleUsageLadderSupply").value,supplyPsi:$("vehicleUsageLadderSupplyPsi").value,gun:$("vehicleUsageLadderGun").value,gunPsi:$("vehicleUsageLadderGunPsi").value,sector:$("vehicleUsageLadderSector").value,assignment:$("vehicleUsageLadderAssignment").value.trim()}}
  function fillTanker(x={}){for(const [id,k] of [["vehicleUsageTankerCapacity","capacity"],["vehicleUsageTankerLevel","level"],["vehicleUsageTankerMode","mode"],["vehicleUsageTankerFillSource","fillSource"],["vehicleUsageTankerSupplying","supplying"],["vehicleUsageTankerFlow","flow"],["vehicleUsageTankerShuttleStart","shuttleStart"],["vehicleUsageTankerShuttleReturn","shuttleReturn"],["vehicleUsageTankerTurnaround","turnaround"],["vehicleUsageTankerTrips","trips"],["vehicleUsageTankerNotes","notes"]])$(id).value=x[k]??""}
  function readTanker(){return{capacity:$("vehicleUsageTankerCapacity").value,level:$("vehicleUsageTankerLevel").value,mode:$("vehicleUsageTankerMode").value,fillSource:$("vehicleUsageTankerFillSource").value.trim(),supplying:$("vehicleUsageTankerSupplying").value.trim(),flow:$("vehicleUsageTankerFlow").value,shuttleStart:$("vehicleUsageTankerShuttleStart").value,shuttleReturn:$("vehicleUsageTankerShuttleReturn").value,turnaround:$("vehicleUsageTankerTurnaround").value,trips:$("vehicleUsageTankerTrips").value,notes:$("vehicleUsageTankerNotes").value.trim()}}
  function journalSummary(before,after,n){
    const a=[];const p=(label,x,y)=>{if(String(x??"")!==String(y??""))a.push(`${label}: ${x||"—"} → ${y||"—"}`)};
    p("État",before?.status,after?.status);p("Effectif",before?.firefighters,after?.firefighters);
    if(n==="102"){p("Officier",before?.chef?.officer,after?.chef?.officer);p("Commandement",before?.chef?.commandMode,after?.chef?.commandMode);p("Stratégie",before?.chef?.strategy,after?.chef?.strategy);p("Renfort",before?.chef?.alarmLevel,after?.chef?.alarmLevel);for(let i=1;i<=5;i++)p(`Secteur ${i}`,before?.chef?.[`sector${i}`],after?.chef?.[`sector${i}`]);p("Sécurité",before?.chef?.safety,after?.chef?.safety)}
    if(n==="202"){p("Alimentation",before?.supplied,after?.supplied);p("Résiduel initial",before?.residualStart,after?.residualStart);p("Résiduel final",before?.residualEnd,after?.residualEnd);for(let i=1;i<=6;i++){const b=before?.outlets?.[i]||{},c=after?.outlets?.[i]||{};p(`Sortie ${i}`,b.active?"Active":"Inactive",c.active?"Active":"Inactive");if(b.active||c.active){p(`Sortie ${i} PSI`,b.pressure,c.pressure);p(`Sortie ${i} secteur`,b.sector,c.sector)}}}
    if(n==="502"){p("Échelle",before?.ladder?.deployed,after?.ladder?.deployed);p("Hauteur",before?.ladder?.height,after?.ladder?.height);p("Angle",before?.ladder?.angle,after?.ladder?.angle);p("Stabilisateurs",before?.ladder?.stabilizers,after?.ladder?.stabilizers);p("Alimentation",before?.ladder?.supply,after?.ladder?.supply);p("Canon aérien",before?.ladder?.gun,after?.ladder?.gun);p("Canon PSI",before?.ladder?.gunPsi,after?.ladder?.gunPsi);p("Secteur",before?.ladder?.sector,after?.ladder?.sector);p("Affectation",before?.ladder?.assignment,after?.ladder?.assignment)}
    if(n==="802"){p("Niveau eau",before?.tanker?.level,after?.tanker?.level);p("Mode",before?.tanker?.mode,after?.tanker?.mode);p("Remplissage",before?.tanker?.fillSource,after?.tanker?.fillSource);p("Alimente",before?.tanker?.supplying,after?.tanker?.supplying);p("Débit GPM",before?.tanker?.flow,after?.tanker?.flow);p("Rotation min",before?.tanker?.turnaround,after?.tanker?.turnaround);p("Rotations",before?.tanker?.trips,after?.tanker?.trips)}
    return a;
  }
  function openForm(item=null){
    const saveStatus=$("vehicleUsageSaveStatus");
    if(saveStatus){
      saveStatus.textContent="";
      saveStatus.className="vehicle-usage-save-status hidden";
    }
fillVehicleOptions();
    const u=item?canonical(item):ensureEventLink(canonical({}));
    $("vehicleUsageId").value=item?u.id:"";
    $("vehicleUsageVehicle").value=u.vehicleId||vehicles()[0]?.id||"";
    $("vehicleUsageFirefighters").value=u.firefighters;
    $("vehicleUsageSupplied").value=u.supplied;
    $("vehicleUsageResidualStart").value=u.residualStart;
    $("vehicleUsageResidualEnd").value=u.residualEnd;
    $("vehicleUsageNotes").value=u.notes;
    $("vehicleUsageTitle").textContent=item?`Modifier — ${u.vehicleName}`:"Nouvelle fiche véhicule";
    $("deleteVehicleUsage").classList.toggle("hidden",!item);
    setStatus(u.status);
    for(let n=1;n<=6;n++)fillOutlet(String(n),u.outlets[n]);
    fillOutlet("fourInch",u.special.fourInch);
    fillOutlet("deckGun",u.special.deckGun);
    fillChef(u.chef);
    fillLadder(u.ladder);
    fillTanker(u.tanker);
    setVehicleFormMode(vehicleNumberFromSelect());
    $("vehicleUsageDialog").showModal()
  }
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
      chef:readChef(),
      ladder:readLadder(),
      tanker:readTanker(),
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

      const priorId=$("vehicleUsageId").value;
      const prior=priorId?usages.find(x=>String(x.id)===String(priorId)):null;
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
      const journalNumber=String(u.vehicleNumber||vehicleNumberFromSelect()||"");
      journalSummary(prior,u,journalNumber).forEach(message=>{
        window.dispatchEvent(new CustomEvent("firemap:vehicle-journal-entry",{detail:{vehicleId:journalNumber,message:`${journalNumber} — ${message}`,at:new Date().toISOString()}}));
      });
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
  function connect(){
    const c=window.fireMapCloud;
    if(!c?.configured||!c?.subscribeVehicleUsages){render();return}
    cloudUnsub?.();
    cloudUnsub=c.subscribeVehicleUsages(items=>{
      const p=pending();
      usages=items.map(canonical);
      Object.values(p).forEach(x=>{
        const u=canonical(x),i=usages.findIndex(y=>y.id===u.id);
        if(i>=0)usages[i]=u;else usages.push(u);
      });
      persist();
      render();
      window.dispatchEvent(new CustomEvent("firemap:vehicle-usages-ready",{detail:{source:"firebase",count:usages.length}}));
      window.dispatchEvent(new CustomEvent("firemap:vehicle-usage-updated",{detail:{source:"firebase",remote:true,count:usages.length}}));
      window.fireMapVehicles?.refreshProfiles?.();
      flush();
    },error=>console.error("Synchronisation fiches véhicules:",error));
    flush();
  }
  if($("vehicleUsageVehicle")) $("vehicleUsageVehicle").addEventListener("change",()=>{
    setVehicleFormMode(vehicleNumberFromSelect());
  });

  if($("vehicleUsageChefCommand")) $("vehicleUsageChefCommand").onclick=()=>{
    $("vehicleUsageDialog")?.close();
    document.querySelector('[data-view="command"],#commandCenterBtn,.command-center-open')?.click?.();
  };

  if($("vehicleUsageChefJournal")) $("vehicleUsageChefJournal").onclick=()=>{
    const text=prompt("Entrée au journal — Chef 102 :");
    if(!text)return;
    window.dispatchEvent(new CustomEvent("firemap:command-journal-add",{
      detail:{vehicleId:"102",message:text,at:new Date().toISOString()}
    }));
    core.toast("Entrée envoyée au journal.");
  };

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

  function resetFleetDefinition(){
    const current=vehicles();
    if(current?.length)return current.map(v=>({
      id:String(v.id||v.number||""),
      number:String(v.number||v.id||""),
      name:String(v.name||`Unité ${v.number||v.id||""}`)
    }));
    return [
      {id:"102",number:"102",name:"Chef 102"},
      {id:"202",number:"202",name:"Autopompe 202"},
      {id:"502",number:"502",name:"Échelle 502"},
      {id:"602",number:"602",name:"Unité de soutien 602"},
      {id:"802",number:"802",name:"Citerne 802"},
      {id:"902",number:"902",name:"Pickup 902"}
    ];
  }

  function resetFleetDefinition(){
    const byNumber=new Map();
    (vehicles()||[]).forEach(v=>{
      const number=String(v.number||v.id||"");
      if(number)byNumber.set(number,{
        id:String(v.id||number),number,name:String(v.name||`Unité ${number}`)
      });
    });
    const defaults=[
      ["102","Chef 102"],["202","Autopompe 202"],["502","Échelle 502"],
      ["602","Unité de soutien 602"],["802","Citerne 802"],["902","Pickup 902"]
    ];
    return defaults.map(([number,name])=>byNumber.get(number)||{id:number,number,name});
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

    const now=new Date();
    const completedAt=now.toISOString();
    const affected=usages.filter(item=>String(item.eventId||"")===targetEventId);

    // Archiver les fiches de l'événement terminé.
    affected.forEach(item=>{
      item.eventClosed=true;
      item.eventClosedAt=completedAt;
      item.updatedAt=completedAt;
      item.updatedAtText=now.toLocaleString("fr-CA");
      queue(item);
    });

    // Éviter d'empiler plusieurs resets du même événement.
    usages=usages.filter(item=>String(item.resetAfterEventId||"")!==targetEventId);

    const resetProfiles=resetFleetDefinition().map((vehicle,index)=>canonical({
      id:`ready-${vehicle.number}-${Date.now()}-${index}`,
      eventId:"",
      sourceCallId:"",
      vehicleId:String(vehicle.id||vehicle.number),
      vehicleName:String(vehicle.name),
      vehicleNumber:String(vehicle.number),
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
      updatedAtText:now.toLocaleString("fr-CA"),
      resetAfterEventId:targetEventId,
      eventClosed:false
    }));

    resetProfiles.forEach(item=>{
      usages.push(item);
      queue(item);
    });

    localStorage.removeItem(ACTIVE_EVENT_DATA);
    persist();
    render();
    window.dispatchEvent(new CustomEvent("firemap:vehicle-usages-ready"));
    window.dispatchEvent(new CustomEvent("firemap:vehicle-usage-updated",{
      detail:{eventId:targetEventId,reset:true,profiles:resetProfiles}
    }));
    window.fireMapVehicles?.refreshProfiles?.();

    // Synchronisation non bloquante.
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

  // Bouton central de la barre du bas : ouvre directement la fiche
  // du véhicule lié au compte actuellement connecté.
  const bottomVehicleUsage=$("bottomVehicleUsage");
  if(bottomVehicleUsage){
    bottomVehicleUsage.addEventListener("click",()=>{
      const account=window.fireMapAccount?.current?.();
      if(!account?.id){
        window.fireMapAccount?.openChooser?.(false);
        return core.toast("Choisissez d’abord le compte de l’unité.");
      }
      openForVehicle(String(account.id));
    });
  }
  window.addEventListener("firemap:command-event-linked",()=>{render();refreshVehicleProfiles()});
  render();
  refreshVehicleProfiles();
  connect();window.addEventListener("firemap-cloud-ready",connect);window.addEventListener("online",connect);
})();
