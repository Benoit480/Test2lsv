(() => {
  "use strict";

  const BUILD="25.0.20";
  const ACTIVE_ID_KEY="firemap-command-active-v1";
  const ACTIVE_DATA_KEY="firemap-command-active-event-data";
  const EVENTS_KEY="firemap-command-events-v1";
  const CALL_KEY="firemap-active-call";
  const CLOSE_MARKER_KEY="firemap-last-closed-event-v24";

  let cloudUnsubscribe=null;
  let closing=false;

  const $=id=>document.getElementById(id);
  const toast=message=>window.fireMapInternal?.toast?.(message);

  function read(key,fallback){
    try{
      const parsed=JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    }catch(_){return fallback}
  }
  function write(key,value){
    localStorage.setItem(key,JSON.stringify(value));
  }
  function isChief(){
    const account=window.fireMapAccount?.current?.();
    return Boolean(
      window.fireMapAccount?.isChief?.() ||
      String(account?.number||account?.id||"")==="102"
    );
  }

  function activeEvent(){
    return window.fireMapCommandCenter?.getActiveEvent?.() || null;
  }

  function removeAssistantCloseControls(){
    // Exact historical control.
    $("assistantEnd")?.remove();

    // Defensive cleanup if a future/older template uses another id/text.
    document.querySelectorAll("#view-assistant button, #view-assistant [role='button']").forEach(button=>{
      const text=(button.textContent||"").toLowerCase();
      if(
        /terminer.*(intervention|événement|evenement)/i.test(text) ||
        /fermer.*(intervention|événement|evenement)/i.test(text)
      ){
        button.remove();
      }
    });
  }

  function applyPermissions(){
    removeAssistantCloseControls();

    const button=$("endCommandEvent");
    if(button){
      const allowed=isChief();
      button.hidden=!allowed;
      button.disabled=!allowed;
      button.classList.toggle("hidden",!allowed);
      button.setAttribute("aria-hidden",allowed?"false":"true");
      button.title=allowed
        ?"Terminer l’événement et réinitialiser les unités"
        :"Réservé au compte 102";
    }

    document.querySelectorAll('[data-view="command"]').forEach(link=>{
      const allowed=isChief();
      link.classList.toggle("hidden",!allowed);
      link.disabled=!allowed;
    });
  }

  function clearLocalActiveEvent(event={}){
    const eventId=String(event.id||event.eventId||"");

    localStorage.removeItem(ACTIVE_ID_KEY);
    localStorage.removeItem(ACTIVE_DATA_KEY);
    localStorage.removeItem(CALL_KEY);

    const events=read(EVENTS_KEY,[]);
    if(Array.isArray(events)&&eventId){
      const index=events.findIndex(item=>String(item.id)===eventId);
      if(index>=0)events[index]={...events[index],...event,status:"closed"};
      write(EVENTS_KEY,events);
    }

    window.fireMapCommandCenter?.setActiveId?.("");
    window.fireMapVehicles?.refreshProfiles?.();

    window.dispatchEvent(new CustomEvent("firemap:event-closed",{
      detail:{...event,id:eventId,status:"closed",source:"event-manager-v24"}
    }));
  }

  async function closeFromCommandCenter(){
    if(closing)return;
    if(!isChief()){
      toast("Seul le compte 102 peut terminer un événement.");
      return;
    }

    const event=activeEvent();
    if(!event){
      toast("Aucun événement actif.");
      return;
    }

    if(!confirm("Terminer cet événement? Les fiches des unités seront réinitialisées."))return;

    closing=true;
    const closedAt=new Date().toISOString();
    const closed={
      ...event,
      status:"closed",
      closedAt,
      closedBy:"102",
      closedByLabel:"102 — Chef des opérations"
    };

    let result={archived:0,reset:0};

    try{
      // La fermeture locale est prioritaire : une erreur Firebase ne doit jamais
      // empêcher le chef 102 de terminer l'événement.
      try{
        result=window.fireMapVehicleUsage?.resetAllUnitsAfterEvent?.(closed.id)
          || {archived:0,reset:0};
      }catch(error){
        console.warn("Réinitialisation unités à reprendre",error);
      }

      try{
        const events=read(EVENTS_KEY,[]);
        if(Array.isArray(events)){
          const index=events.findIndex(item=>String(item.id)===String(closed.id));
          if(index>=0)events[index]=closed;
          else events.push(closed);
          write(EVENTS_KEY,events);
        }
      }catch(error){
        console.warn("Archivage local événement incomplet",error);
      }

      // Fermer l'événement sur cet appareil même si la synchro réseau échoue.
      try{
        clearLocalActiveEvent(closed);
      }catch(error){
        console.warn("Nettoyage événement actif",error);
        localStorage.removeItem(ACTIVE_ID_KEY);
        localStorage.removeItem(ACTIVE_DATA_KEY);
        localStorage.removeItem(CALL_KEY);
        window.fireMapCommandCenter?.setActiveId?.("");
      }

      try{
        localStorage.setItem(CLOSE_MARKER_KEY,JSON.stringify({
          id:String(closed.id),closedAt,build:"25.0.20"
        }));
      }catch(_){}

      // Synchronisation non bloquante. syncEvent met déjà l'événement en file
      // d'attente avant Firebase, donc aucune fermeture ne doit afficher une erreur.
      try{
        const synced=await window.fireMapCommandCenter?.syncEvent?.(closed);
        toast(
          synced
            ? `Événement terminé — ${result.reset||0} unités réinitialisées.`
            : `Événement terminé — ${result.reset||0} unités réinitialisées; synchronisation Firebase en attente.`
        );
      }catch(error){
        console.warn("Fermeture locale réussie; Firebase en attente",error);
        toast(`Événement terminé — ${result.reset||0} unités réinitialisées; synchronisation Firebase en attente.`);
      }
    }catch(error){
      console.error("Fermeture événement - erreur inattendue",error);
      // Dernier filet de sécurité : l'événement ne doit pas rester actif pour 102.
      try{
        localStorage.removeItem(ACTIVE_ID_KEY);
        localStorage.removeItem(ACTIVE_DATA_KEY);
        localStorage.removeItem(CALL_KEY);
        window.fireMapCommandCenter?.setActiveId?.("");
      }catch(_){}
      toast("Événement terminé localement; synchronisation à vérifier.");
    }finally{
      closing=false;
    }
  }

  function newestOpenEvent(items=[]){
    return [...items]
      .filter(item=>item&&item.status!=="closed")
      .sort((a,b)=>{
        const at=Date.parse(a.startedAt||a.createdAt||"")||0;
        const bt=Date.parse(b.startedAt||b.createdAt||"")||0;
        return bt-at;
      })[0]||null;
  }

  function handleCloudEvents(items=[]){
    if(!Array.isArray(items))return;

    const localActiveId=String(localStorage.getItem(ACTIVE_ID_KEY)||"");
    const activeData=read(ACTIVE_DATA_KEY,null);
    const expectedId=localActiveId||String(activeData?.id||"");

    // If the active event is closed in Firebase, closure is authoritative.
    if(expectedId){
      const same=items.find(item=>String(item.id)===expectedId);
      if(same?.status==="closed"){
        const last=read(CLOSE_MARKER_KEY,null);
        if(String(last?.id||"")!==String(same.id)){
          window.fireMapVehicleUsage?.resetAllUnitsAfterEvent?.(same.id);
          localStorage.setItem(CLOSE_MARKER_KEY,JSON.stringify({
            id:String(same.id),closedAt:same.closedAt||new Date().toISOString(),build:BUILD
          }));
        }
        clearLocalActiveEvent(same);
        toast("Événement terminé par le poste de commandement.");
        return;
      }
    }

    // Devices that started with no local active id adopt the newest open event.
    if(!expectedId){
      const open=newestOpenEvent(items);
      if(open){
        localStorage.setItem(ACTIVE_ID_KEY,String(open.id));
        write(ACTIVE_DATA_KEY,{
          id:String(open.id),
          sourceCallId:String(open.sourceCallId||""),
          number:String(open.number||""),
          address:String(open.address||"")
        });
        window.fireMapCommandCenter?.setActiveId?.(String(open.id));
        window.dispatchEvent(new CustomEvent("firemap:command-event-linked",{detail:{
          eventId:String(open.id),
          sourceCallId:String(open.sourceCallId||""),
          number:String(open.number||""),
          address:String(open.address||"")
        }}));
      }
    }
  }

  function connectCloud(){
    const cloud=window.fireMapCloud;
    if(!cloud?.configured||!cloud?.subscribeCommandEvents)return;

    try{cloudUnsubscribe?.()}catch(_){}
    cloudUnsubscribe=cloud.subscribeCommandEvents(
      handleCloudEvents,
      error=>console.warn("V24 événements Firebase",error)
    );
  }

  function attachEndButton(){
    const old=$("endCommandEvent");
    if(!old)return;

    // Clone strips every legacy onclick/addEventListener attached directly to the node.
    const fresh=old.cloneNode(true);
    old.replaceWith(fresh);
    fresh.addEventListener("click",event=>{
      event.preventDefault();
      event.stopPropagation();
      closeFromCommandCenter();
    });
  }

  function boot(){
    removeAssistantCloseControls();
    attachEndButton();
    applyPermissions();

    window.addEventListener("firemap:account-changed",applyPermissions);
    window.addEventListener("firemap-cloud-ready",connectCloud);
    connectCloud();

    // Re-apply after dynamic rendering.
    const observer=new MutationObserver(()=>applyPermissions());
    observer.observe(document.body,{childList:true,subtree:true});

    window.fireMapEventManager={
      build:BUILD,
      isChief,
      closeActiveEvent:closeFromCommandCenter,
      refreshPermissions:applyPermissions
    };

    console.info(`[FireMap] Event Manager V${BUILD} actif`);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot,{once:true});
  }else{
    boot();
  }
})();