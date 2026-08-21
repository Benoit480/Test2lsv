(() => {
  "use strict";
  const I=window.fireMapInternal;
  if(!I) return console.error("FireMap interne indisponible");
  const $=id=>document.getElementById(id), esc=I.esc, norm=I.norm;
  const CACHE="firemap-prevention-v1", PENDING="firemap-prevention-pending-v1";
  const boolIds=["pvElectricalPanel","pvElectricalEntrance","pvGasEntrance","pvWaterValve","pvFdcAccessible","pvSprinklers","pvGenerator","pvElevator","pvDryStandpipe","prHazmat","prChemicals","prPropane","prOxygen","prLithium","prSolar","prFuel"];
  const photoCategories={
    pvElectricalPanel:{key:"electricalPanel",label:"Panneau électrique"},
    pvElectricalEntrance:{key:"electricalEntrance",label:"Entrée électrique"},
    pvGasEntrance:{key:"gasEntrance",label:"Entrée / coupure de gaz"},
    pvWaterValve:{key:"waterValve",label:"Valve d’eau"},
    pvFdcAccessible:{key:"fdcAccessible",label:"FDC"},
    pvSprinklers:{key:"sprinklers",label:"Gicleurs"},
    pvGenerator:{key:"generator",label:"Génératrice"},
    pvElevator:{key:"elevator",label:"Ascenseur"},
    pvDryStandpipe:{key:"dryStandpipe",label:"Colonne sèche / humide"},
    prHazmat:{key:"hazmat",label:"Matières dangereuses"},
    prChemicals:{key:"chemicals",label:"Produits chimiques"},
    prPropane:{key:"propane",label:"Propane"},
    prOxygen:{key:"oxygen",label:"Oxygène"},
    prLithium:{key:"lithium",label:"Batteries au lithium"},
    prSolar:{key:"solar",label:"Panneaux solaires"},
    prFuel:{key:"fuel",label:"Réservoirs de carburant"}
  };
  let records=new Map(), cloudUnsub=null, draftPhotos={};
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||"")||f}catch(_){return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){console.warn(e)}};
  const today=()=>new Date().toISOString().slice(0,10);
  const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(16).slice(2);
  function canonical(r={}){
    return {id:String(r.id||r.buildingId||uid()),buildingId:String(r.buildingId||r.id||""),inspector:String(r.inspector||""),visitDate:String(r.visitDate||""),nextReview:String(r.nextReview||""),occupancy:Number(r.occupancy||0),accessCode:String(r.accessCode||""),checks:{...(r.checks||{})},risks:{...(r.risks||{})},electricalNotes:String(r.electricalNotes||""),gasNotes:String(r.gasNotes||""),fdcNotes:String(r.fdcNotes||""),accessNotes:String(r.accessNotes||""),hazmatNotes:String(r.hazmatNotes||""),photoUrls:Array.isArray(r.photoUrls)?r.photoUrls:String(r.photoUrls||"").split(/\n+/).map(x=>x.trim()).filter(Boolean),photosByCategory:Object.fromEntries(Object.entries(r.photosByCategory||{}).map(([k,v])=>[k,Array.isArray(v)?v:[]])),observations:String(r.observations||""),visits:Array.isArray(r.visits)?r.visits.slice(0,20):[]};
  }

  function photoUrl(photo={}){
    return String(photo.url || photo.downloadURL || photo.downloadUrl || photo.src || "");
  }

  function photoIdentity(photo={}){
    return String(photo.path || photoUrl(photo) || photo.name || "");
  }

  function mergePhotoMaps(...maps){
    const result={};
    for(const map of maps){
      for(const [category,list] of Object.entries(map||{})){
        if(!Array.isArray(list))continue;
        if(!result[category])result[category]=[];
        const seen=new Set(result[category].map(photoIdentity));
        for(const photo of list){
          const key=photoIdentity(photo);
          if(!key || seen.has(key))continue;
          result[category].push(photo);
          seen.add(key);
        }
      }
    }
    return result;
  }

  function persist(){write(CACHE,[...records.values()])}
  function pending(){return read(PENDING,{})}
  function queue(r){const p=pending();p[r.id]=r;write(PENDING,p)}
  function clearPending(id){const p=pending();delete p[id];write(PENDING,p)}
  function buildings(){return window.fireMapPreplans?.getBuildings?.()||[]}
  function recordFor(id){return records.get(String(id))||canonical({id:String(id),buildingId:String(id)})}
  function daysSince(date){if(!date)return Infinity;return Math.floor((Date.now()-new Date(date+"T12:00:00").getTime())/86400000)}
  function overdue(r){return Boolean(r.nextReview && r.nextReview<today()) || (r.visitDate && daysSince(r.visitDate)>365)}
  function score(r,b){
    let score=0;
    if(r.visitDate)score+=12;if(r.inspector)score+=5;if(r.accessCode)score+=5;if(r.occupancy>0)score+=3;
    ["electricalPanel","electricalEntrance","gasEntrance","waterValve","fdcAccessible"].forEach(k=>{if(r.checks[k])score+=6});
    ["electricalNotes","gasNotes","fdcNotes","accessNotes","hazmatNotes"].forEach(k=>{if(r[k]?.trim())score+=4});
    const categoryPhotoCount=Object.values(r.photosByCategory||{}).reduce((n,a)=>n+(Array.isArray(a)?a.length:0),0);if(r.photoUrls.length+categoryPhotoCount>=1)score+=7;if(r.photoUrls.length+categoryPhotoCount>=4)score+=5;if(b?.planUrl)score+=8;if(b?.contactName&&b?.contactPhone)score+=5;if(r.observations)score+=3;
    if(r.visitDate && daysSince(r.visitDate)<=365)score+=7;
    return Math.min(100,score);
  }
  function scoreState(n){return n>=80?"complete":n>=50?"partial":"low"}
  function scoreLabel(n){return n>=80?"Préplan bien documenté":n>=50?"Informations à compléter":"Visite de prévention requise"}
  function riskNames(r){const map={hazmat:"Matières dangereuses",chemicals:"Produits chimiques",propane:"Propane",oxygen:"Oxygène",lithium:"Batteries lithium",solar:"Panneaux solaires",fuel:"Carburant"};return Object.entries(map).filter(([k])=>r.risks[k]).map(([,v])=>v)}
  function render(){
    const bs=buildings();const q=norm($("preventionSearch").value),filter=$("preventionFilter").value;
    const stats=bs.map(b=>({b,r:recordFor(b.id)})).map(x=>({...x,s:score(x.r,x.b)}));
    const avg=stats.length?Math.round(stats.reduce((a,x)=>a+x.s,0)/stats.length):0;
    const complete=stats.filter(x=>x.s>=80).length, needs=stats.filter(x=>x.s<80).length, due=stats.filter(x=>overdue(x.r)||!x.r.visitDate).length;
    $("preventionStats").innerHTML=`<div><strong>${bs.length}</strong><span>Bâtiments</span></div><div><strong>${complete}</strong><span>Préplans complets</span></div><div><strong>${due}</strong><span>Visites à faire</span></div><div><strong>${avg}%</strong><span>Préparation moyenne</span></div>`;
    const list=stats.filter(({b,r,s})=>{
      const text=norm([b.name,b.address,b.category,r.inspector,r.observations].join(" "));
      if(q&&!text.includes(q))return false;
      if(filter==="complete"&&s<80)return false;if(filter==="incomplete"&&s>=80)return false;if(filter==="overdue"&&!overdue(r))return false;if(filter==="never"&&r.visitDate)return false;
      return true;
    }).sort((a,b)=>(overdue(b.r)-overdue(a.r))||(a.s-b.s)||a.b.name.localeCompare(b.b.name,"fr"));
    $("preventionBuildingList").innerHTML=list.map(({b,r,s})=>`<article class="card-item prevention-building-card"><div class="prevention-building-head"><div><h3>${esc(b.name)}</h3><p>${esc(b.address)||"Adresse non inscrite"}</p></div><div class="score-badge ${scoreState(s)}">${s}%</div></div><div class="score-track"><span class="${scoreState(s)}" style="width:${s}%"></span></div><div class="prevention-meta"><span>${r.visitDate?`Dernière visite : ${esc(r.visitDate)}`:"Jamais visité"}</span><span class="${overdue(r)?"overdue":""}">${overdue(r)?"⚠️ Mise à jour requise":scoreLabel(s)}</span></div><div class="card-actions"><button class="primary" data-prevention-edit="${esc(b.id)}">🏢 Ouvrir la fiche</button><button class="secondary operational-card-btn" data-prevention-operational="${esc(b.id)}">🚨 Vue intervention</button><button class="secondary" data-prevention-preplan="${esc(b.id)}">📁 Anciennes données</button><button class="secondary" data-prevention-map="${esc(b.id)}">🗺️ Carte</button></div></article>`).join("")||'<div class="card-item">Aucun bâtiment correspondant.</div>';
  }
  function setCheck(id,v){$(id).checked=Boolean(v)}
  function open(id){
    const b=buildings().find(x=>String(x.id)===String(id));if(!b)return I.toast("Bâtiment introuvable.");const r=recordFor(id);
    $("preventionDialogTitle").textContent=b.name;$("preventionBuildingId").value=b.id;$("preventionInspector").value=r.inspector;$("preventionVisitDate").value=r.visitDate||today();$("preventionNextReview").value=r.nextReview;$("preventionOccupancy").value=r.occupancy||"";$("preventionAccessCode").value=r.accessCode;
    const checks={pvElectricalPanel:"electricalPanel",pvElectricalEntrance:"electricalEntrance",pvGasEntrance:"gasEntrance",pvWaterValve:"waterValve",pvFdcAccessible:"fdcAccessible",pvSprinklers:"sprinklers",pvGenerator:"generator",pvElevator:"elevator",pvDryStandpipe:"dryStandpipe"};Object.entries(checks).forEach(([id,k])=>setCheck(id,r.checks[k]));
    const risks={prHazmat:"hazmat",prChemicals:"chemicals",prPropane:"propane",prOxygen:"oxygen",prLithium:"lithium",prSolar:"solar",prFuel:"fuel"};Object.entries(risks).forEach(([id,k])=>setCheck(id,r.risks[k]));
    draftPhotos=structuredClone
      ? structuredClone(mergePhotoMaps(r.photosByCategory,draftPhotos))
      : JSON.parse(JSON.stringify(mergePhotoMaps(r.photosByCategory,draftPhotos)));
    $("pvElectricalNotes").value=r.electricalNotes;$("pvGasNotes").value=r.gasNotes;$("pvFdcNotes").value=r.fdcNotes;$("pvAccessNotes").value=r.accessNotes;$("pvHazmatNotes").value=r.hazmatNotes;$("pvPhotoUrls").value=r.photoUrls.join("\n");$("pvObservations").value=r.observations;
    $("preventionVisitHistory").innerHTML=r.visits.length?r.visits.map(v=>`<div class="visit-item"><strong>${esc(v.date||"")}</strong><span>${esc(v.inspector||"Inspecteur non inscrit")}</span><p>${esc(v.observations||"Aucune observation")}</p></div>`).join(""):'<p class="muted">Aucune visite enregistrée.</p>';
    document.querySelectorAll("#preventionForm > .form-section").forEach(section=>section.classList.remove("form-section-collapsed"));
    decoratePhotoRows();
    renderAllPhotoGalleries();
    renderAllCategoryGalleries();
    updateLiveScore();
    $("preventionDialog").showModal();
    requestAnimationFrame(()=>renderAllCategoryGalleries());
    setTimeout(()=>{renderAllCategoryGalleries();refreshPreventionLock();setDefaultReadOnly(true)},100);
  }
  function formRecord(){
    const id=$("preventionBuildingId").value,old=recordFor(id),visitDate=$("preventionVisitDate").value||today();
    const checks={electricalPanel:$("pvElectricalPanel").checked,electricalEntrance:$("pvElectricalEntrance").checked,gasEntrance:$("pvGasEntrance").checked,waterValve:$("pvWaterValve").checked,fdcAccessible:$("pvFdcAccessible").checked,sprinklers:$("pvSprinklers").checked,generator:$("pvGenerator").checked,elevator:$("pvElevator").checked,dryStandpipe:$("pvDryStandpipe").checked};
    const risks={hazmat:$("prHazmat").checked,chemicals:$("prChemicals").checked,propane:$("prPropane").checked,oxygen:$("prOxygen").checked,lithium:$("prLithium").checked,solar:$("prSolar").checked,fuel:$("prFuel").checked};
    const entry={id:uid(),date:visitDate,inspector:$("preventionInspector").value.trim(),observations:$("pvObservations").value.trim(),savedAt:new Date().toISOString()};
    const same=old.visits[0]&&old.visits[0].date===entry.date&&old.visits[0].inspector===entry.inspector&&old.visits[0].observations===entry.observations;
    const mergedPhotos=mergePhotoMaps(old.photosByCategory,draftPhotos);
    draftPhotos=JSON.parse(JSON.stringify(mergedPhotos));
    return canonical({...old,id,buildingId:id,inspector:entry.inspector,visitDate,nextReview:$("preventionNextReview").value,occupancy:Number($("preventionOccupancy").value||0),accessCode:$("preventionAccessCode").value.trim(),checks,risks,electricalNotes:$("pvElectricalNotes").value.trim(),gasNotes:$("pvGasNotes").value.trim(),fdcNotes:$("pvFdcNotes").value.trim(),accessNotes:$("pvAccessNotes").value.trim(),hazmatNotes:$("pvHazmatNotes").value.trim(),photoUrls:$("pvPhotoUrls").value,photosByCategory:mergedPhotos,observations:entry.observations,visits:same?old.visits:[entry,...old.visits].slice(0,20)});
  }
  function updateLiveScore(){const id=$("preventionBuildingId").value;if(!id)return;const b=buildings().find(x=>String(x.id)===String(id));const r=formRecord();const s=score(r,b);$("preventionScoreValue").textContent=s+" %";$("preventionScoreBar").style.width=s+"%";$("preventionScoreBar").className=scoreState(s);$("preventionScoreLabel").textContent=scoreLabel(s)}
  async function save(e){e.preventDefault();
    const estimatedPhotoBytes=Object.values(draftPhotos||{}).flat().reduce((sum,p)=>sum+Number(p?.size||dataUrlBytes(p?.url||"")),0);
    if(estimatedPhotoBytes>850000){
      I.toast("Trop de photos dans cette fiche. Supprimez-en une avant d’enregistrer.");
      return;
    }if(!preventionEditMode){I.toast("Appuyez sur Modifier pour changer la fiche.");return;}if(forceReadOnlyFromOperationalView){I.toast("Vue intervention : fiche en lecture seule.");return;}const r=formRecord();const b=buildings().find(x=>String(x.id)===String(r.buildingId||r.id));const s=score(r,b);records.set(r.id,r);persist();queue(r);render();$("preventionDialog").close();try{await window.fireMapPreplans?.applyPreventionData?.(r.buildingId||r.id,r,s)}catch(err){console.warn("Liaison prévention-bâtiment en attente",err)}try{const c=window.fireMapCloud;if(!c?.configured||!c.savePrevention)throw new Error("Firebase indisponible");await c.savePrevention(r);clearPending(r.id);I.toast("Fiche Bâtiment synchronisée.")}catch(err){console.error(err);I.toast("Visite enregistrée localement; synchronisation en attente.")}}
  async function flush(){const c=window.fireMapCloud;if(!c?.configured||!c.savePrevention)return;for(const [id,r] of Object.entries(pending()))try{await c.savePrevention(r);clearPending(id)}catch(e){console.error(e)}}
  function connect(){
    const c=window.fireMapCloud;
    if(!c?.configured||!c.subscribePrevention){render();return}
    if(cloudUnsub)cloudUnsub();
    cloudUnsub=c.subscribePrevention(items=>{
      const p=pending();
      const localBefore=new Map(records);
      const next=new Map();

      items.forEach(item=>{
        const cloudRecord=canonical(item);
        const localRecord=localBefore.get(cloudRecord.id);
        if(localRecord){
          cloudRecord.photosByCategory=mergePhotoMaps(
            cloudRecord.photosByCategory,
            localRecord.photosByCategory
          );
        }
        next.set(cloudRecord.id,cloudRecord);
      });

      localBefore.forEach((localRecord,id)=>{
        if(!next.has(id))next.set(id,localRecord);
      });

      Object.values(p).forEach(item=>{
        const pendingRecord=canonical(item);
        const current=next.get(pendingRecord.id);
        if(current){
          pendingRecord.photosByCategory=mergePhotoMaps(
            current.photosByCategory,
            pendingRecord.photosByCategory
          );
        }
        next.set(pendingRecord.id,pendingRecord);
      });

      records=next;
      persist();
      render();
      flush();
    },e=>{
      console.error(e);
      I.toast("Prévention en mode local.");
    });
    flush();
  }
  function preplanHtml(id){
    const b=buildings().find(x=>String(x.id)===String(id)),r=records.get(String(id));
    if(!r)return '<section class="preplan-section prevention-summary"><h3>🛡️ Préplan de prévention</h3><p>Aucune visite de prévention enregistrée.</p></section>';
    const sc=score(r,b), risks=riskNames(r);
    const checkMap=[
      ["electricalPanel","⚡","Panneau électrique localisé"],
      ["electricalEntrance","⚡","Entrée électrique identifiée"],
      ["gasEntrance","🔥","Entrée / coupure de gaz identifiée"],
      ["waterValve","💧","Valve d’eau identifiée"],
      ["fdcAccessible","🚒","FDC accessible"],
      ["sprinklers","💦","Gicleurs présents"],
      ["generator","🔋","Génératrice identifiée"],
      ["elevator","🛗","Ascenseur"],
      ["dryStandpipe","🧯","Colonne sèche / humide"]
    ];
    const checked=checkMap.filter(([k])=>r.checks[k]).map(([,i,l])=>`<li>${i} ${esc(l)}</li>`).join("");
    const unchecked=checkMap.filter(([k])=>!r.checks[k]).map(([,i,l])=>`<li class="preplan-unconfirmed">${i} ${esc(l)} — non confirmé</li>`).join("");
    const photos=Object.entries(r.photosByCategory||{}).flatMap(([category,list])=>(list||[]).map(photo=>({category,photo}))).map(({category,photo})=>{
      const label=Object.values(photoCategories).find(x=>x.key===category)?.label||category;
      return `<a class="preplan-photo-card" href="${esc(photo.url)}" target="_blank" rel="noopener"><img src="${esc(photo.url)}" alt="${esc(label)}" loading="lazy"><span>${esc(label)}</span></a>`;
    }).join("");
    const risksHtml=risks.length?`<section class="preplan-section preplan-alert"><h3>☣️ Risques particuliers</h3><p>${esc(risks.join(", "))}</p>${r.hazmatNotes?`<p>${esc(r.hazmatNotes)}</p>`:""}</section>`:"";
    return `<section class="preplan-section prevention-summary preplan-from-prevention"><div class="preplan-prevention-title"><h3>🚨 Fiche opérationnelle du bâtiment</h3><span class="score-badge ${scoreState(sc)}">${sc}%</span></div><div class="score-track"><span class="${scoreState(sc)}" style="width:${sc}%"></span></div><p><strong>Dernière visite :</strong> ${esc(r.visitDate||"Non inscrite")} ${r.inspector?`— ${esc(r.inspector)}`:""}</p>${r.nextReview?`<p><strong>Prochaine révision :</strong> ${esc(r.nextReview)}</p>`:""}${r.occupancy?`<p><strong>Occupation maximale :</strong> ${esc(String(r.occupancy))}</p>`:""}${r.accessCode?`<p><strong>Code d’accès :</strong> ${esc(r.accessCode)}</p>`:""}</section><section class="preplan-section"><h3>✅ Éléments opérationnels vérifiés</h3><ul class="preplan-check-list">${checked||"<li>Aucun élément confirmé.</li>"}</ul>${unchecked?`<details><summary>Éléments non confirmés</summary><ul class="preplan-check-list">${unchecked}</ul></details>`:""}</section>${risksHtml}${r.electricalNotes?`<section class="preplan-section"><h3>⚡ Électricité</h3><p>${esc(r.electricalNotes)}</p></section>`:""}${r.gasNotes?`<section class="preplan-section"><h3>🔥 Gaz / propane</h3><p>${esc(r.gasNotes)}</p></section>`:""}${r.fdcNotes?`<section class="preplan-section"><h3>🚒 FDC</h3><p>${esc(r.fdcNotes)}</p></section>`:""}${r.accessNotes?`<section class="preplan-section"><h3>🚪 Accès</h3><p>${esc(r.accessNotes)}</p></section>`:""}${r.observations?`<section class="preplan-section"><h3>📝 Observations de prévention</h3><p>${esc(r.observations).replace(/\n/g,"<br>")}</p></section>`:""}${photos?`<section class="preplan-section"><h3>📷 Photos opérationnelles</h3><div class="preplan-photo-grid">${photos}</div></section>`:""}`;
  }
  function renderPhotoGallery(category){
    renderCategoryGallery(category);
  }
  function renderAllPhotoGalleries(){Object.values(photoCategories).forEach(meta=>renderPhotoGallery(meta.key))}
  async function compressImage(file){
    if(!file.type.startsWith("image/")||file.size<900000)return file;
    try{
      const bitmap=await createImageBitmap(file);const max=1600,ratio=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);
      canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.78));
      return blob?new File([blob],(file.name||"photo").replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"}):file;
    }catch(_){return file}
  }
  
  function dataUrlBytes(dataUrl=""){
    const base64=String(dataUrl).split(",")[1]||"";
    return Math.ceil(base64.length*0.75);
  }

  async function compressImageForFirestore(file){
    const bitmap=await createImageBitmap(file);
    const maxDimension=1100;
    const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height));
    const width=Math.max(1,Math.round(bitmap.width*scale));
    const height=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement("canvas");
    canvas.width=width;
    canvas.height=height;
    const ctx=canvas.getContext("2d",{alpha:false});
    ctx.drawImage(bitmap,0,0,width,height);
    bitmap.close?.();

    let quality=.68;
    let dataUrl=canvas.toDataURL("image/jpeg",quality);
    let bytes=dataUrlBytes(dataUrl);

    // Cible d'environ 180 Ko par photo.
    while(bytes>180000&&quality>.32){
      quality-=.08;
      dataUrl=canvas.toDataURL("image/jpeg",quality);
      bytes=dataUrlBytes(dataUrl);
    }

    if(bytes>230000){
      throw new Error("Photo trop volumineuse même après compression.");
    }

    return {dataUrl,bytes,width,height};
  }

async function uploadCategoryPhotos(category,files){
    if(!files?.length)return;
    const buildingId=$("preventionBuildingId").value;
    if(!buildingId)return I.toast("Enregistrez d’abord le bâtiment.");

    draftPhotos[category]=Array.isArray(draftPhotos[category])?draftPhotos[category]:[];

    for(const original of files){
      if(!original.type?.startsWith("image/"))continue;

      // Compression forte pour respecter la limite d'un document Firestore.
      const compressed=await compressImageForFirestore(original);
      const photo={
        id:`photo-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        url:compressed.dataUrl,
        name:original.name||`${category}-${Date.now()}.jpg`,
        type:"image/jpeg",
        size:compressed.bytes,
        width:compressed.width,
        height:compressed.height,
        createdAt:new Date().toISOString(),
        storage:"firestore"
      };

      draftPhotos[category].push(photo);
    }

    renderCategoryGallery(category);
    renderPhotoGallery(category);
    updateLiveScore();

    const current=formRecord();
    records.set(current.id,current);
    persist();
    queue(current);

    try{
      if(window.fireMapCloud?.configured&&window.fireMapCloud.savePrevention){
        await window.fireMapCloud.savePrevention(current);
        clearPending(current.id);
      }
      I.toast("Photo enregistrée gratuitement dans Firestore.");
    }catch(err){
      console.warn("Photo enregistrée localement, synchronisation en attente.",err);
      I.toast("Photo enregistrée localement; synchronisation en attente.");
    }
  }
  async function deleteCategoryPhoto(category,index){
    const photos=draftPhotos[category]||[],photo=photos[index];if(!photo)return;
    if(!confirm("Supprimer cette photo?"))return;
    photos.splice(index,1);renderPhotoGallery(category);updateLiveScore();
    try{if(photo.path&&window.fireMapCloud?.deletePreventionPhoto)await window.fireMapCloud.deletePreventionPhoto(photo.path)}catch(err){console.warn(err)}
  }
  let operationalBuildingId="";
  let forceReadOnlyFromOperationalView=false;
  function operationalHtml(id){
    const b=buildings().find(x=>String(x.id)===String(id));
    if(!b)return '<section class="preplan-section preplan-alert"><h3>Bâtiment introuvable</h3></section>';
    const r=recordFor(id), risks=riskNames(r);
    const urgent=[];
    if(r.accessCode)urgent.push(`<div><span>🔑 Accès</span><strong>${esc(r.accessCode)}</strong></div>`);
    if(r.fdcNotes)urgent.push(`<div><span>🚒 FDC</span><strong>${esc(r.fdcNotes)}</strong></div>`);
    if(r.electricalNotes)urgent.push(`<div><span>⚡ Électricité</span><strong>${esc(r.electricalNotes)}</strong></div>`);
    if(r.gasNotes)urgent.push(`<div><span>🔥 Gaz</span><strong>${esc(r.gasNotes)}</strong></div>`);
    if(r.accessNotes)urgent.push(`<div><span>🚪 Accès pompier</span><strong>${esc(r.accessNotes)}</strong></div>`);
    if(r.hazmatNotes)urgent.push(`<div><span>☣️ Matières dangereuses</span><strong>${esc(r.hazmatNotes)}</strong></div>`);
    const photos=Object.entries(r.photosByCategory||{}).flatMap(([category,list])=>(list||[]).map(photo=>({category,photo}))).slice(0,12).map(({category,photo})=>{
      const label=Object.values(photoCategories).find(x=>x.key===category)?.label||category;
      return `<a class="operational-photo" href="${esc(photo.url)}" target="_blank" rel="noopener"><img src="${esc(photo.url)}" alt="${esc(label)}" loading="lazy"><span>${esc(label)}</span></a>`;
    }).join("");
    const priorityRisks=risks.length?`<section class="preplan-section operational-danger"><h3>☣️ RISQUES CONFIRMÉS</h3><p>${esc(risks.join(" • "))}</p></section>`:"";
    return `<section class="operational-building-header">
      <div><small>BÂTIMENT</small><h2>${esc(b.name||"Bâtiment")}</h2><p>${esc(b.address||"Adresse non inscrite")}</p></div>
      <span class="score-badge ${scoreState(score(r,b))}">${score(r,b)}%</span>
    </section>
    ${priorityRisks}
    <section class="preplan-section operational-priority"><h3>⚡ Informations prioritaires</h3>
      <div class="operational-priority-grid">${urgent.length?urgent.join(""):'<p>Aucune information opérationnelle prioritaire inscrite.</p>'}</div>
    </section>
    ${r.occupancy?`<section class="preplan-section"><h3>👥 Occupation maximale</h3><p class="operational-big-value">${esc(String(r.occupancy))}</p></section>`:""}
    ${photos?`<section class="preplan-section"><h3>📷 Photos critiques</h3><div class="operational-photo-grid">${photos}</div></section>`:""}
    ${preplanHtml(id)}`;
  }
  function openOperational(id){
    const b=buildings().find(x=>String(x.id)===String(id));if(!b)return I.toast("Bâtiment introuvable.");
    forceReadOnlyFromOperationalView=true;
    operationalBuildingId=String(id);
    $("operationalBuildingTitle").textContent=b.name||"Fiche opérationnelle";
    $("operationalBuildingContent").innerHTML=operationalHtml(id);
    $("operationalBuildingDialog").showModal();
  }

  let activePhotoCategory = "";

  function photoCategoryFromInput(input){
    if(!input)return "";
    return input.dataset?.photoCategory || photoCategories[input.id]?.key || input.name || input.id || "";
  }

  function categoryLabel(category){
    const match=Object.values(photoCategories||{}).find(x=>x.key===category);
    return match?.label || category;
  }

  function ensureCategoryPhotoToolbar(row, category){
    if(!row || !category || row.querySelector(".category-photo-toolbar")) return;
    const toolbar=document.createElement("div");
    toolbar.className="category-photo-toolbar";
    toolbar.dataset.category=category;
    toolbar.innerHTML=`
      <button type="button" class="category-photo-btn camera" data-photo-camera="${category}">📷 Prendre une photo</button>
      <button type="button" class="category-photo-btn import" data-photo-import="${category}">🖼️ Importer</button>
      <div class="category-photo-gallery" data-photo-gallery="${category}"></div>`;
    row.appendChild(toolbar);
  }

  function decoratePhotoRows(){
    const form=$("preventionForm");
    if(!form) return;

    form.querySelectorAll('input[type="checkbox"]').forEach(input=>{
      const category=photoCategoryFromInput(input);
      if(!category) return;
      const row=input.closest("label") || input.parentElement;
      ensureCategoryPhotoToolbar(row,category);
    });

    const locationFields=[
      ["preventionElectricalNotes","operationalElectrical"],
      ["preventionGasNotes","operationalGas"],
      ["preventionWaterNotes","operationalWater"],
      ["preventionFdcNotes","operationalFdc"],
      ["preventionAccessNotes","operationalAccess"],
      ["preventionMechanicalNotes","operationalMechanical"]
    ];
    locationFields.forEach(([id,category])=>{
      const field=$(id);
      if(!field) return;
      const row=field.closest("label") || field.parentElement;
      ensureCategoryPhotoToolbar(row,category);
    });
  }

  function mutableCurrentRecord(){
    const id=String($("preventionBuildingId")?.value||"");
    if(!id) return null;
    const r=records.get(id) || recordFor(id);
    r.photosByCategory=r.photosByCategory||{};
    return r;
  }

  function renderCategoryGallery(category){
    const galleries=[...document.querySelectorAll("[data-photo-gallery]")]
      .filter(g=>g.dataset.photoGallery===category);
    if(!galleries.length)return;

    const list=Array.isArray(draftPhotos?.[category])?draftPhotos[category]:[];
    const html=list.map((photo,index)=>{
      const url=photoUrl(photo);
      if(!url)return "";
      return `<figure class="category-photo-thumb">
        <a href="${esc(url)}" target="_blank" rel="noopener" data-photo-open="1">
          <img src="${esc(url)}" alt="${esc(categoryLabel(category))}" loading="eager">
        </a>
        <button type="button" data-photo-delete="${category}" data-photo-index="${index}" aria-label="Supprimer">×</button>
      </figure>`;
    }).join("") + (list.length?`<small class="category-photo-count">${list.length} photo${list.length>1?"s":""}</small>`:"");

    galleries.forEach(gallery=>{
      gallery.innerHTML=html;
      gallery.classList.toggle("has-photos",list.length>0);
    });
  }

  function renderAllCategoryGalleries(){
    document.querySelectorAll("[data-photo-gallery]").forEach(g=>renderCategoryGallery(g.dataset.photoGallery));
  }

  async function addCategoryFiles(fileList){
    if(!activePhotoCategory || !fileList?.length)return;
    await uploadCategoryPhotos(activePhotoCategory,[...fileList]);
    renderCategoryGallery(activePhotoCategory);
    renderPhotoGallery(activePhotoCategory);
  }

  document.addEventListener("click",e=>{
    const camera=e.target.closest("[data-photo-camera]");
    if(camera){
      activePhotoCategory=camera.dataset.photoCamera;
      $("categoryCameraInput").value="";
      $("categoryCameraInput").click();
      return;
    }
    const importer=e.target.closest("[data-photo-import]");
    if(importer){
      activePhotoCategory=importer.dataset.photoImport;
      $("categoryImportInput").value="";
      $("categoryImportInput").click();
      return;
    }
    const del=e.target.closest("[data-photo-delete]");
    if(del){
      e.preventDefault();
      e.stopImmediatePropagation();
      const category=del.dataset.photoDelete;
      const index=Number(del.dataset.photoIndex);
      deleteCategoryPhoto(category,index).then(()=>{
        renderCategoryGallery(category);
        renderPhotoGallery(category);
      });
    }
  });

  $("categoryCameraInput")?.addEventListener("change",e=>addCategoryFiles([...e.target.files]));
  $("categoryImportInput")?.addEventListener("change",e=>addCategoryFiles([...e.target.files]));


  function hasActiveIntervention(){
    if(forceReadOnlyFromOperationalView)return true;
    try{
      const active =
        window.fireMapAssistant?.getActiveCall?.() ||
        window.fireMapAssistant?.activeCall ||
        window.fireMapInternal?.state?.activeCall ||
        window.fireMapInternal?.state?.activeIntervention ||
        JSON.parse(localStorage.getItem("firemap-active-call") || "null") ||
        JSON.parse(localStorage.getItem("firemap-active-intervention") || "null");
      return !!active;
    }catch(_){return false}
  }

  function setPreventionReadOnly(locked){
    const form=$("preventionForm");
    if(!form)return;
    form.classList.toggle("intervention-readonly",locked);
    $("interventionReadOnlyBanner")?.classList.toggle("hidden",!locked);

    form.querySelectorAll("input, select, textarea").forEach(el=>{
      if(el.type==="hidden")return;
      if(locked){
        el.dataset.wasDisabled=el.disabled?"1":"0";
        el.disabled=true;
      }else if(el.dataset.wasDisabled==="0"){
        el.disabled=false;
        delete el.dataset.wasDisabled;
      }
    });

    form.querySelectorAll(
      ".category-photo-btn,[data-photo-delete],#editPreventionButton"
    ).forEach(btn=>{
      if(locked){
        btn.dataset.wasHidden=btn.classList.contains("hidden")?"1":"0";
        btn.classList.add("hidden");
      }else if(btn.dataset.wasHidden==="0"){
        btn.classList.remove("hidden");
        delete btn.dataset.wasHidden;
      }
    });

    const save=$("savePreventionButton") || form.querySelector('button[type="submit"]');
    if(save){
      save.disabled=locked;
      save.classList.toggle("hidden",locked);
    }
  }

  function refreshPreventionLock(){
    const locked=hasActiveIntervention();
    setPreventionReadOnly(locked);
    return locked;
  }

  window.addEventListener("firemap:intervention-started",refreshPreventionLock);
  window.addEventListener("firemap:intervention-ended",refreshPreventionLock);
  window.addEventListener("storage",refreshPreventionLock);

  function openEditable(id){
    forceReadOnlyFromOperationalView=false;
    setPreventionReadOnly(false);
    open(id);
  }

  let preventionEditMode=false;

  function setDefaultReadOnly(readOnly=true){
    const form=$("preventionForm");
    if(!form)return;

    preventionEditMode=!readOnly;
    form.classList.toggle("default-readonly",readOnly);
    $("defaultReadOnlyBanner")?.classList.toggle("hidden",!readOnly);

    form.querySelectorAll("input,select,textarea").forEach(el=>{
      if(el.type==="hidden")return;
      el.disabled=readOnly;
    });

    form.querySelectorAll(".category-photo-btn,[data-photo-delete],#editPreventionButton").forEach(btn=>{
      btn.classList.toggle("hidden",readOnly);
    });

    const save=$("savePreventionButton");
    if(save){
      save.disabled=readOnly;
      save.classList.toggle("hidden",readOnly);
    }

    const edit=$("editPreventionButton");
    if(edit){
      const interventionLocked=forceReadOnlyFromOperationalView;
      edit.classList.toggle("hidden",!readOnly||interventionLocked);
    }

    const cancel=$("cancelPreventionDialog");
    if(cancel)cancel.textContent=readOnly?"Fermer":"Annuler";
  }

  function enablePreventionEditing(){
    if(forceReadOnlyFromOperationalView){
      I.toast("Vue intervention : fiche en consultation seulement.");
      return;
    }
    // Nettoyer un ancien verrouillage d'intervention avant d'activer l'édition normale.
    setPreventionReadOnly(false);
    setDefaultReadOnly(false);
    I.toast("Mode modification activé.");
  }

  function cancelPreventionEditing(){
    if(preventionEditMode){
      const id=$("preventionBuildingId")?.value;
      preventionEditMode=false;
      if(id)open(id);
      return;
    }
    $("preventionDialog").close();
  }

  window.fireMapPrevention={
    refreshReadOnly:refreshPreventionLock,
    getRecordForBuilding:id=>records.get(String(id))||null,
    getScore:id=>{const b=buildings().find(x=>String(x.id)===String(id));return score(recordFor(id),b)},
    open:openEditable,
    openReadOnly:id=>{forceReadOnlyFromOperationalView=true;open(id)},
    openOperational,
    preplanHtml
  };
  $("preventionBackMap").onclick=()=>I.showView("map");
  $("preventionSearch").oninput=render;
  $("preventionFilter").onchange=render;
  $("editPreventionButton").onclick=enablePreventionEditing;
  $("closePreventionDialog").onclick=()=>{
    $("preventionDialog").close();
    preventionEditMode=false;
    forceReadOnlyFromOperationalView=false;
  };
  $("cancelPreventionDialog").onclick=cancelPreventionEditing;
  $("openOperationalView").onclick=()=>{const id=$("preventionBuildingId").value;if(id)openOperational(id)};
  $("closeOperationalBuilding").onclick=()=>{
    $("operationalBuildingDialog").close();
    forceReadOnlyFromOperationalView=false;
  };
  $("operationalShowMap").onclick=()=>{if(!operationalBuildingId)return;$("operationalBuildingDialog").close();window.fireMapPreplans?.showBuildingOnMap?.(operationalBuildingId)};
  $("operationalNavigate").onclick=()=>{if(!operationalBuildingId)return;const b=buildings().find(x=>String(x.id)===String(operationalBuildingId));if(b)I.openNavigation?.(b)};
  $("operationalEditBuilding").onclick=()=>{
    if(!operationalBuildingId)return;
    forceReadOnlyFromOperationalView=true;
    $("operationalBuildingDialog").close();
    open(operationalBuildingId);
  };
  $("preventionForm").onsubmit=save;
  $("preventionForm").addEventListener("input",updateLiveScore);$("preventionForm").addEventListener("change",updateLiveScore);
  document.addEventListener("click",e=>{const camera=e.target.closest("[data-photo-camera]");if(camera){document.querySelector(`[data-photo-input="${camera.dataset.photoCamera}"][data-source="camera"]`)?.click();return}const imp=e.target.closest("[data-photo-import]");if(imp){document.querySelector(`[data-photo-input="${imp.dataset.photoImport}"][data-source="library"]`)?.click();return}const del=e.target.closest("[data-photo-delete]");if(del){deleteCategoryPhoto(del.dataset.photoDelete,Number(del.dataset.photoIndex));return}const ed=e.target.closest("[data-prevention-edit]");if(ed)open(ed.dataset.preventionEdit);const op=e.target.closest("[data-prevention-operational]");if(op)openOperational(op.dataset.preventionOperational);const pp=e.target.closest("[data-prevention-preplan]");if(pp)window.fireMapPreplans?.openLegacyPreplanById?.(pp.dataset.preventionPreplan);const mp=e.target.closest("[data-prevention-map]");if(mp)window.fireMapPreplans?.showBuildingOnMap?.(mp.dataset.preventionMap)});
  document.addEventListener("change",e=>{const input=e.target.closest("[data-photo-input]");if(input&&input.files?.length){uploadCategoryPhotos(input.dataset.photoInput,[...input.files]);input.value=""}});
  window.addEventListener("firemap:buildings-updated",render);window.addEventListener("firemap-preplans-ready",render);window.addEventListener("online",flush);
  setupCategoryPhotoControls();read(CACHE,[]).map(canonical).forEach(r=>records.set(r.id,r));render();connect();window.addEventListener("firemap-cloud-ready",connect);
})();
