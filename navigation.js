(()=>{
  "use strict";
  const $=id=>document.getElementById(id);
  const I=window.fireMapInternal;
  if(!I)return;

  let destination=null;
  let routeLayer=L.layerGroup().addTo(I.map);
  let positionMarker=null;
  let accuracyCircle=null;
  let routeLine=null;
  let routeCoordinates=[];
  let routeSteps=[];
  let watchId=null;
  let currentPosition=null;
  let lastRouteOrigin=null;
  let lastRouteAt=0;
  let requestController=null;

  const fmtDistance=m=>m<1000?`${Math.max(0,Math.round(m))} m`:`${(m/1000).toFixed(1)} km`;
  const fmtDuration=s=>{const min=Math.max(1,Math.round(s/60));return min<60?`${min} min`:`${Math.floor(min/60)} h ${min%60} min`};
  const radians=d=>d*Math.PI/180;
  const distance=(a,b)=>{const R=6371000,p1=radians(a.lat),p2=radians(b.lat),dp=radians(b.lat-a.lat),dl=radians(b.lng-a.lng),x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))};

  function turnIcon(step){
    const m=step?.maneuver||{};
    if(m.type==="arrive")return "🏁";
    if(m.type==="roundabout"||m.type==="rotary")return "⟳";
    const mod=m.modifier||"straight";
    return ({left:"↰",right:"↱","slight left":"↖","slight right":"↗","sharp left":"⬅","sharp right":"➡",uturn:"↩",straight:"↑"})[mod]||"➤";
  }
  function instruction(step){
    const m=step?.maneuver||{}, road=step?.name?` sur ${step.name}`:"";
    if(m.type==="depart")return `Prenez la route${road}`;
    if(m.type==="arrive")return "Vous êtes arrivé à destination";
    if(m.type==="roundabout"||m.type==="rotary")return `Entrez dans le carrefour giratoire${m.exit?` et prenez la sortie ${m.exit}`:""}${road}`;
    if(m.type==="merge")return `Insérez-vous${road}`;
    if(m.type==="on ramp")return `Prenez la bretelle${road}`;
    if(m.type==="off ramp")return `Prenez la sortie${road}`;
    if(m.type==="fork")return `Restez ${String(m.modifier||"").includes("left")?"à gauche":"à droite"}${road}`;
    if(m.type==="end of road")return `Au bout de la route, tournez ${String(m.modifier||"").includes("left")?"à gauche":"à droite"}${road}`;
    const dir=({left:"à gauche",right:"à droite","slight left":"légèrement à gauche","slight right":"légèrement à droite","sharp left":"fortement à gauche","sharp right":"fortement à droite",uturn:"faites demi-tour",straight:"continuez tout droit"})[m.modifier||"straight"]||"continuez";
    return dir==="faites demi-tour"?`${dir}${road}`:`Tournez ${dir}${road}`;
  }
  function setStatus(text,error=false){const el=$("navigationStatus");el.textContent=text;el.classList.toggle("error",error)}
  function showPanel(){
    I.showView("assistant");
    $("integratedNavigation").classList.remove("hidden");
    $("navigationDestination").textContent=destination?.adresse||destination?.address||"Destination";
  }
  function updatePositionVisual(pos){
    currentPosition=pos;
    const ll=[pos.lat,pos.lng];
    if(!positionMarker){
      positionMarker=L.circleMarker(ll,{radius:9,color:"#fff",weight:3,fillColor:"#2563eb",fillOpacity:1}).bindTooltip("Position actuelle").addTo(routeLayer);
      accuracyCircle=L.circle(ll,{radius:pos.accuracy||20,color:"#60a5fa",weight:1,fillColor:"#60a5fa",fillOpacity:.08}).addTo(routeLayer);
    }else{positionMarker.setLatLng(ll);accuracyCircle.setLatLng(ll).setRadius(pos.accuracy||20)}
    $("navigationAccuracy").textContent=pos.accuracy?`± ${Math.round(pos.accuracy)} m`:"—";
    updateNextStep(pos);
  }
  function updateNextStep(pos){
    if(!routeSteps.length)return;
    let best=0,bestD=Infinity;
    routeSteps.forEach((s,i)=>{const c=s.maneuver?.location;if(!c)return;const d=distance(pos,{lat:c[1],lng:c[0]});if(d<bestD){bestD=d;best=i}});
    const step=routeSteps[Math.min(best+1,routeSteps.length-1)]||routeSteps[best];
    const c=step?.maneuver?.location;
    const d=c?distance(pos,{lat:c[1],lng:c[0]}):step?.distance||0;
    $("navigationTurnIcon").textContent=turnIcon(step);
    $("navigationInstruction").textContent=instruction(step);
    $("navigationStepDistance").textContent=step?.maneuver?.type==="arrive"?"":`Dans environ ${fmtDistance(d)}`;
  }
  function renderSteps(){
    $("navigationSteps").innerHTML=routeSteps.map(s=>`<li><span>${turnIcon(s)}</span><div><strong>${I.esc(instruction(s))}</strong><small>${fmtDistance(s.distance||0)}</small></div></li>`).join("");
  }
  async function calculate(origin){
    if(!destination)return;
    if(requestController)requestController.abort();
    requestController=new AbortController();
    setStatus("Calcul du trajet en cours…");
    $("navigationInstruction").textContent="Calcul du trajet…";
    const url=`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;
    try{
      const r=await fetch(url,{signal:requestController.signal,headers:{"Accept":"application/json"}});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const data=await r.json();
      const route=data.routes?.[0];
      if(!route)throw new Error("Aucun trajet");
      routeCoordinates=route.geometry.coordinates.map(c=>[c[1],c[0]]);
      routeSteps=(route.legs||[]).flatMap(l=>l.steps||[]);
      if(routeLine)routeLayer.removeLayer(routeLine);
      routeLine=L.polyline(routeCoordinates,{color:"#1689ff",weight:6,opacity:.95,lineJoin:"round"}).addTo(routeLayer);
      L.circleMarker([destination.lat,destination.lng],{radius:10,color:"#fff",weight:3,fillColor:"#ff3b30",fillOpacity:1}).bindTooltip("Intervention").addTo(routeLayer);
      I.map.fitBounds(routeLine.getBounds(),{padding:[45,45]});
      $("navigationDistance").textContent=fmtDistance(route.distance);
      $("navigationDuration").textContent=fmtDuration(route.duration);
      renderSteps();updateNextStep(origin);
      lastRouteOrigin={lat:origin.lat,lng:origin.lng};lastRouteAt=Date.now();
      setStatus("Navigation active. Le GPS suit votre déplacement.");
    }catch(e){
      if(e.name==="AbortError")return;
      console.error(e);setStatus("Impossible de calculer le trajet. Utilisez le bouton Apple Plans / Google Maps.",true);I.toast("Trajet intégré indisponible.");
    }
  }
  function beginWatch(){
    if(!navigator.geolocation){setStatus("GPS non disponible sur cet appareil.",true);return}
    if(watchId!==null)navigator.geolocation.clearWatch(watchId);
    watchId=navigator.geolocation.watchPosition(p=>{
      const pos={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,speed:p.coords.speed,heading:p.coords.heading};
      updatePositionVisual(pos);
      if(!lastRouteOrigin)calculate(pos);
      else if(Date.now()-lastRouteAt>25000&&distance(pos,lastRouteOrigin)>120)calculate(pos);
    },err=>{setStatus(err.code===1?"Autorisez la localisation dans les réglages de Safari.":"Signal GPS indisponible. Réessayez à l’extérieur.",true)}, {enableHighAccuracy:true,maximumAge:3000,timeout:15000});
  }
  function start(dest,options={}){
    if(!dest||!isFinite(dest.lat)||!isFinite(dest.lng)){I.toast("Destination invalide.");return}
    stop(false);
    destination={...dest,lat:Number(dest.lat),lng:Number(dest.lng)};
    routeLayer.addTo(I.map);
    I.map.setView([destination.lat,destination.lng],17);
    if(options.showPanel!==false)showPanel();
    beginWatch();
  }
  function stop(hide=true){
    if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null}
    if(requestController){requestController.abort();requestController=null}
    routeLayer.clearLayers();positionMarker=null;accuracyCircle=null;routeLine=null;routeCoordinates=[];routeSteps=[];currentPosition=null;lastRouteOrigin=null;lastRouteAt=0;
    if(hide)$("integratedNavigation")?.classList.add("hidden");
  }

  // Démarre automatiquement le GPS lorsqu’un appel devient actif, puis l’arrête à la fin.
  window.addEventListener("firemap:intervention-start",event=>{
    const dest=event.detail;
    if(!dest)return;
    start(dest,{showPanel:false});
    I.map.setView([Number(dest.lat),Number(dest.lng)],17);
    I.toast("GPS activé automatiquement vers l’intervention.");
  });
  window.addEventListener("firemap:intervention-end",()=>{
    stop(true);
    I.toast("GPS arrêté : intervention terminée.");
  });

  $("navigationRecalculate").onclick=()=>currentPosition?calculate(currentPosition):beginWatch();
  $("navigationExternal").onclick=()=>destination&&(location.href=I.navUrl(destination.lat,destination.lng));
  $("navigationStop").onclick=()=>stop(true);
  $("navigationClose").onclick=()=>stop(true);
  window.fireMapNavigation={start,stop,isActive:()=>watchId!==null};
})();
