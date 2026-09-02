(() => {
  "use strict";

  const key = String(window.FIREMAP_GOOGLE_MAPS_API_KEY || "").trim();
  let googleReadyResolve;
  const googleReady = new Promise(resolve => { googleReadyResolve = resolve; });
  window.fireMapGoogleReady = googleReady;

  function loadGoogleMaps() {
    if (!key || key === "COLLEZ_VOTRE_CLE_API_ICI") {
      document.addEventListener("DOMContentLoaded", () => {
        const map = document.getElementById("map");
        if (map) map.innerHTML = '<div class="google-map-config-error"><strong>Clé Google Maps manquante</strong><span>Ouvrez <code>google-maps-config.js</code> et collez votre clé API.</span></div>';
      });
      console.error("FireMap: clé Google Maps non configurée dans google-maps-config.js");
      return;
    }
    window.__fireMapGoogleMapsLoaded = () => googleReadyResolve(window.google);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&libraries=places&callback=__fireMapGoogleMapsLoaded&language=fr&region=CA&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = () => console.error("FireMap: échec du chargement de Google Maps JavaScript API.");
    document.head.appendChild(script);
  }

  function toLiteral(value) {
    if (Array.isArray(value)) return {lat:Number(value[0]), lng:Number(value[1])};
    if (value && typeof value.lat === "function") return {lat:value.lat(), lng:value.lng()};
    if (value && Number.isFinite(Number(value.lat)) && Number.isFinite(Number(value.lng))) return {lat:Number(value.lat), lng:Number(value.lng)};
    return {lat:0,lng:0};
  }
  function wrapLatLng(value) {
    const p = toLiteral(value);
    return {
      lat:p.lat, lng:p.lng,
      distanceTo(other){
        const q=toLiteral(other),R=6371000,p1=p.lat*Math.PI/180,p2=q.lat*Math.PI/180,dp=(q.lat-p.lat)*Math.PI/180,dl=(q.lng-p.lng)*Math.PI/180;
        const a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
        return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
      }
    };
  }

  class LayerGroup {
    constructor(){this.layers=new Set();this.map=null;}
    addTo(map){this.map=map;this.layers.forEach(l=>l._setMap?.(map));return this;}
    addLayer(layer){this.layers.add(layer);if(this.map)layer._setMap?.(this.map);return this;}
    removeLayer(layer){if(!layer)return this;layer._setMap?.(null);this.layers.delete(layer);return this;}
    clearLayers(){this.layers.forEach(l=>l._setMap?.(null));this.layers.clear();return this;}
    _setMap(map){this.map=map;this.layers.forEach(l=>l._setMap?.(map));}
  }

  class MapAdapter {
    constructor(id, options={}){
      this.el=typeof id==="string"?document.getElementById(id):id;
      this.gmap=null;this._center={lat:46.2563,lng:-72.9417};this._zoom=14;this._pending=[];
      let readyResolve;this.ready=new Promise(resolve=>{readyResolve=resolve});
      this.attributionControl={setPrefix(){}};
      googleReady.then(async()=>{
        const {Map}=await google.maps.importLibrary("maps");
        this.gmap=new Map(this.el,{center:this._center,zoom:this._zoom,mapTypeControl:true,streetViewControl:false,fullscreenControl:true,gestureHandling:"greedy",mapTypeId:"roadmap",mapId:"DEMO_MAP_ID"});
        readyResolve(this.gmap);
        this._pending.splice(0).forEach(fn=>fn());
      });
    }
    _do(fn){if(this.gmap)fn();else this._pending.push(fn);return this;}
    setView(center,zoom){this._center=toLiteral(center);if(Number.isFinite(Number(zoom)))this._zoom=Number(zoom);return this._do(()=>{this.gmap.setCenter(this._center);this.gmap.setZoom(this._zoom)});}
    fitBounds(points,opts={}){
      return this._do(async()=>{
        const {LatLngBounds}=await google.maps.importLibrary("core");
        const b=new LatLngBounds();
        const arr=Array.isArray(points)?points:(points?._points||[]);
        arr.forEach(p=>b.extend(toLiteral(p)));
        const padding=Array.isArray(opts.padding)?Math.max(...opts.padding):Number(opts.padding)||45;
        this.gmap.fitBounds(b,padding);
      });
    }
    getCenter(){if(this.gmap){const c=this.gmap.getCenter();return wrapLatLng(c)}return wrapLatLng(this._center)}
    getContainer(){return this.el}
    invalidateSize(){this._do(()=>google.maps.event.trigger(this.gmap,"resize"));return this}
    on(type,handler){this._do(()=>this.gmap.addListener(type,e=>handler({latlng:wrapLatLng(e.latLng),originalEvent:e.domEvent||e})));return this}
    removeLayer(layer){layer?._setMap?.(null);return this}
    containerPointToLatLng(point){
      if(!this.gmap)return wrapLatLng(this._center);
      const projection=this.gmap.getProjection(); if(!projection)return wrapLatLng(this._center);
      const bounds=this.gmap.getBounds(); if(!bounds)return wrapLatLng(this._center);
      const ne=projection.fromLatLngToPoint(bounds.getNorthEast()), sw=projection.fromLatLngToPoint(bounds.getSouthWest());
      const scale=Math.pow(2,this.gmap.getZoom());
      const world={x:sw.x+Number(point.x)/scale,y:ne.y+Number(point.y)/scale};
      return wrapLatLng(projection.fromPointToLatLng(world));
    }
  }

  class MarkerAdapter {
    constructor(latlng,opts={}){this.pos=toLiteral(latlng);this.opts=opts;this.map=null;this.marker=null;this.popupHtml="";this.info=null;this.tooltip="";}
    _setMap(map){this.map=map;if(!map){if(this.marker){this.marker.map=null;this.marker.setMap?.(null)}return;} map.ready.then(()=>this._render());}
    async _render(){if(!this.map?.gmap)return; const {AdvancedMarkerElement}=await google.maps.importLibrary("marker");
      if(this.marker){this.marker.map=null;}
      const content=document.createElement("div");content.className="firemap-google-marker";content.innerHTML=this.opts.icon?.html||'<div class="google-default-pin">●</div>';
      this.marker=new AdvancedMarkerElement({map:this.map.gmap,position:this.pos,content,zIndex:Number(this.opts.zIndexOffset)||undefined,title:this.tooltip||undefined});
      this.marker.addListener("click",()=>this.openPopup());
    }
    addTo(target){target instanceof LayerGroup?target.addLayer(this):this._setMap(target);return this}
    bindPopup(html){this.popupHtml=html;return this}
    bindTooltip(text){this.tooltip=text;return this}
    openPopup(){if(!this.map?.gmap||!this.marker||!this.popupHtml&&!this.tooltip)return this; if(this.info)this.info.close();this.info=new google.maps.InfoWindow({content:this.popupHtml||this.tooltip});this.info.open({map:this.map.gmap,anchor:this.marker});return this}
    getLatLng(){return wrapLatLng(this.pos)}
    setLatLng(v){this.pos=toLiteral(v);if(this.marker)this.marker.position=this.pos;return this}
    setPopupContent(html){this.popupHtml=html; if(this.info){this.info.setContent(html)} return this}
  }

  class PolylineAdapter {
    constructor(points,opts={}){this.points=(points||[]).map(toLiteral);this.opts=opts;this.map=null;this.poly=null;this._points=this.points;}
    _setMap(map){this.map=map;if(!map){this.poly?.setMap(null);return;}map.ready.then(()=>{if(this.poly)this.poly.setMap(null);this.poly=new google.maps.Polyline({map:map.gmap,path:this.points,strokeColor:this.opts.color||"#1689ff",strokeOpacity:this.opts.opacity??1,strokeWeight:this.opts.weight||4,icons:this.opts.dashArray?[{icon:{path:"M 0,-1 0,1",strokeOpacity:1,scale:3},offset:"0",repeat:"14px"}]:undefined});});}
    addTo(target){target instanceof LayerGroup?target.addLayer(this):this._setMap(target);return this}
    getBounds(){return { _points:this.points };}
  }

  class CircleAdapter {
    constructor(latlng,opts={}){this.pos=toLiteral(latlng);this.opts=opts;this.map=null;this.circle=null;this.popupHtml="";}
    _setMap(map){this.map=map;if(!map){this.circle?.setMap(null);return;}map.ready.then(()=>{if(this.circle)this.circle.setMap(null);this.circle=new google.maps.Circle({map:map.gmap,center:this.pos,radius:Number(this.opts.radius)||8,strokeColor:this.opts.color||"#fff",strokeWeight:this.opts.weight||2,fillColor:this.opts.fillColor||this.opts.color||"#2563eb",fillOpacity:this.opts.fillOpacity??1});});}
    addTo(target){target instanceof LayerGroup?target.addLayer(this):this._setMap(target);return this}
    bindPopup(html){this.popupHtml=html;return this}
    bindTooltip(html){this.popupHtml=html;return this}
    openPopup(){if(this.map?.gmap&&this.popupHtml){new google.maps.InfoWindow({content:this.popupHtml,position:this.pos}).open({map:this.map.gmap});}return this}
    setLatLng(v){this.pos=toLiteral(v);this.circle?.setCenter(this.pos);return this}
    setRadius(r){this.opts.radius=Number(r)||0;this.circle?.setRadius(this.opts.radius);return this}
  }

  const L={
    map:(id,opts)=>new MapAdapter(id,opts),
    tileLayer:()=>({addTo(){return this}}),
    layerGroup:()=>new LayerGroup(),
    divIcon:opts=>opts||{},
    marker:(latlng,opts)=>new MarkerAdapter(latlng,opts),
    polyline:(pts,opts)=>new PolylineAdapter(pts,opts),
    circleMarker:(latlng,opts)=>new CircleAdapter(latlng,opts),
    circle:(latlng,opts)=>new CircleAdapter(latlng,opts),
    point:(x,y)=>({x,y})
  };
  window.L=L;

  window.fireMapGoogleGeocode={
    async geocode(address){
      await googleReady;const {Geocoder}=await google.maps.importLibrary("geocoding");const geocoder=new Geocoder();
      const {results}=await geocoder.geocode({address:String(address||""),region:"CA"});
      return (results||[]).map(r=>({address:r.formatted_address,lat:r.geometry.location.lat(),lng:r.geometry.location.lng(),placeId:r.place_id}));
    }
  };

  function routeErrorMessage(error){
    const parts=[];
    if(error?.message)parts.push(error.message);
    if(error?.code)parts.push(String(error.code));
    if(error?.status)parts.push(String(error.status));
    if(error?.details)parts.push(typeof error.details==="string"?error.details:JSON.stringify(error.details));
    return parts.filter(Boolean).join(" — ") || "Erreur Google Routes inconnue";
  }

  function routePoint(value){
    if(!value)return null;
    const p=toLiteral(value);
    return Number.isFinite(p.lat)&&Number.isFinite(p.lng)?p:null;
  }

  window.fireMapGoogleRoutes={
    lastError:"",
    async computeRoute(origin,destination,{steps=true}={}){
      await googleReady;
      const {Route}=await google.maps.importLibrary("routes");
      const request={
        origin:toLiteral(origin),
        destination:toLiteral(destination),
        travelMode:"DRIVING",
        fields:steps
          ? ["path","distanceMeters","durationMillis","legs"]
          : ["path","distanceMeters","durationMillis"]
      };
      try{
        const {routes}=await Route.computeRoutes(request);
        const route=routes?.[0];
        if(!route)throw new Error("Aucun trajet retourné par Google Routes");
        const normalizedSteps=steps?(route.legs||[]).flatMap(leg=>(leg.steps||[]).map(step=>({
          distance:Number(step.distanceMeters)||0,
          instruction:step.instructions||"Continuez",
          maneuverType:String(step.maneuver||"straight").toLowerCase(),
          location:routePoint(step.endLocation)
        }))):[];
        const path=(route.path||[]).map(routePoint).filter(Boolean).map(p=>[p.lat,p.lng]);
        if(!path.length)throw new Error("Google Routes a retourné un trajet sans tracé");
        this.lastError="";
        return {
          distance:Number(route.distanceMeters)||0,
          duration:(Number(route.durationMillis)||0)/1000,
          path,
          steps:normalizedSteps,
          raw:route
        };
      }catch(error){
        this.lastError=routeErrorMessage(error);
        console.error("FireMap Google Routes computeRoute:",error);
        throw error;
      }
    },
    async matrix(origin,destinations){
      await googleReady;
      const {RouteMatrix}=await google.maps.importLibrary("routes");
      try{
        const {matrix}=await RouteMatrix.computeRouteMatrix({
          origins:[toLiteral(origin)],
          destinations:destinations.map(toLiteral),
          travelMode:"DRIVING",
          fields:["distanceMeters","durationMillis","condition"]
        });
        const row=matrix?.rows?.[0];
        this.lastError="";
        return (row?.items||[]).map(item=>({
          distance:Number(item.distanceMeters),
          duration:Number(item.durationMillis)/1000,
          condition:item.condition
        }));
      }catch(error){
        this.lastError=routeErrorMessage(error);
        console.error("FireMap Google Routes matrix:",error);
        throw error;
      }
    }
  };

  loadGoogleMaps();
})();
