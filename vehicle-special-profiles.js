(() => {
"use strict";
const $=s=>document.querySelector(s);
const id=()=>{for(const v of [window.fireMapVehicleAccounts?.getCurrentVehicleId?.(),window.fireMapVehicleAccounts?.currentVehicleId,window.fireMapCurrentVehicleId,localStorage.getItem("firemap-vehicle-account"),localStorage.getItem("firemap-current-vehicle")]){const m=String(v||"").match(/\b(102|202|502|602|802|902)\b/);if(m)return m[1]}return null};
const panel=()=>$("#vehicleUsagePanel")||$("#vehicleUsage")||$("#vehicleProfile")||$("#vehicleSheet")||$(".vehicle-usage-panel")||$(".vehicle-profile")||$(".vehicle-sheet")||$("[data-vehicle-usage]");
const key=v=>`firemap-special-vehicle-${v}-v25.0.12`;
const load=v=>{try{return JSON.parse(localStorage.getItem(key(v))||"{}")}catch(_){return{}}};
const save=(v,r)=>{const d={};r.querySelectorAll("[data-vsp]").forEach(e=>d[e.dataset.vsp]=e.type==="checkbox"?e.checked:e.value);d.updatedAt=new Date().toISOString();localStorage.setItem(key(v),JSON.stringify(d));window.dispatchEvent(new CustomEvent("firemap:special-vehicle-profile-updated",{detail:{vehicleId:v,data:d}}));try{window.fireMapCloud?.saveVehicleUsage?.(v,{specialProfile:d,specialProfileVersion:"25.0.12"})}catch(_){}};
const common=()=>`<section class="vsp-card"><h3>Informations communes</h3><div class="vsp-grid">
<label>État<select data-vsp="status"><option>En caserne</option><option>En route</option><option>Arrivé sur les lieux</option><option>Retour vers caserne</option></select></label>
<label>Pompiers<input data-vsp="crewCount" type="number" min="0" inputmode="numeric"></label>
<label>Conducteur / opérateur<input data-vsp="driver"></label>
<label>Secteur<select data-vsp="sector"><option value="">Non assigné</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>Commandement</option></select></label>
<label>Heure d'arrivée<input data-vsp="arrivalTime" type="time"></label>
<label>GPS<button type="button" class="btn secondary" data-gps>📍 Mettre à jour</button><span data-gps-label>—</span></label>
</div><label>Notes<textarea data-vsp="notes" rows="3"></textarea></label></section>`;
const chef=()=>`<section class="vsp-card"><h3>👨‍🚒 102 — Chef</h3><div class="vsp-grid">
<label>Officier responsable<input data-vsp="officer"></label>
<label>Commandement<select data-vsp="commandMode"><option>Mobile</option><option>Poste établi</option><option>Transféré</option></select></label>
<label>Stratégie<select data-vsp="strategy"><option value="">Non définie</option><option>Offensive</option><option>Défensive</option><option>Transitionnelle</option></select></label>
<label>Renfort<select data-vsp="alarmLevel"><option>Normal</option><option>Renfort 1</option><option>Renfort 2</option><option>Renfort 3</option></select></label>
<label>Secteur 1<input data-vsp="sector1Officer"></label><label>Secteur 2<input data-vsp="sector2Officer"></label>
<label>Secteur 3<input data-vsp="sector3Officer"></label><label>Secteur 4<input data-vsp="sector4Officer"></label>
<label>Secteur 5<input data-vsp="sector5Officer"></label><label>Sécurité<input data-vsp="safetyOfficer"></label>
<label>Ressources demandées<textarea data-vsp="requestedResources" rows="2"></textarea></label>
<label>Risques / priorités<textarea data-vsp="commandPriorities" rows="2"></textarea></label>
</div><button type="button" class="btn primary" data-open-command>🧭 Ouvrir Poste de commandement</button></section>`;
const outlet=n=>`<div class="vsp-outlet"><b>Sortie ${n}</b><label><input data-vsp="outlet${n}Active" type="checkbox"> Active</label><label>Diamètre ${n<3?`<input data-vsp="outlet${n}Diameter" value="1¾ po" readonly>`:`<select data-vsp="outlet${n}Diameter"><option>1¾ po</option><option>2½ po</option></select>`}</label><label>PSI<input data-vsp="outlet${n}Psi" type="number"></label><label>Secteur<select data-vsp="outlet${n}Sector"><option></option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label>Affectation<input data-vsp="outlet${n}Assignment"></label></div>`;
const pump=()=>`<section class="vsp-card"><h3>🚒 202 — Autopompe</h3><div class="vsp-grid">
<label>Alimentation<select data-vsp="waterSupply"><option>Non alimenté</option><option>Borne fontaine</option><option>Citerne</option><option>Relais</option><option>Autre</option></select></label>
<label>Borne / source<input data-vsp="waterSourceRef"></label><label>Pression entrée (PSI)<input data-vsp="intakePsi" type="number"></label>
<label>Pression pompe (PSI)<input data-vsp="pumpPsi" type="number"></label><label>Résiduel initial<input data-vsp="residualInitial" type="number"></label>
<label>Résiduel actuel<input data-vsp="residualCurrent" type="number"></label><label>Niveau réservoir<select data-vsp="tankLevel"><option>100 %</option><option>75 %</option><option>50 %</option><option>25 %</option><option>Vide</option></select></label>
<label>Opérateur pompe<input data-vsp="pumpOperator"></label></div><h4>Sorties</h4>${[1,2,3,4,5,6].map(outlet).join("")}
<h4>Sorties spéciales</h4><div class="vsp-grid"><label><input data-vsp="fourInchActive" type="checkbox"> Sortie 4 po active</label><label>4 po — affectation<input data-vsp="fourInchAssignment"></label>
<label><input data-vsp="deckGunActive" type="checkbox"> Canon actif</label><label>Canon PSI<input data-vsp="deckGunPsi" type="number"></label><label>Canon secteur<select data-vsp="deckGunSector"><option></option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label>Canon affectation<input data-vsp="deckGunAssignment"></label></div></section>`;
function enhance(){const v=id(),p=panel();if(!p||!["102","202"].includes(v)||p.dataset.vsp===v)return;p.dataset.vsp=v;p.innerHTML=`<div class="vsp-wrap"><header><h2>${v==="102"?"👨‍🚒 102 — Chef":"🚒 202 — Autopompe"}</h2></header>${common()}${v==="102"?chef():pump()}</div>`;const d=load(v);p.querySelectorAll("[data-vsp]").forEach(e=>{if(!(e.dataset.vsp in d))return;e.type==="checkbox"?e.checked=!!d[e.dataset.vsp]:e.value=d[e.dataset.vsp]??""});let t;p.addEventListener("input",()=>{clearTimeout(t);t=setTimeout(()=>save(v,p),250)});p.addEventListener("change",()=>save(v,p));p.querySelector("[data-open-command]")?.addEventListener("click",()=>$("#commandCenterBtn")?.click());p.querySelector("[data-gps]")?.addEventListener("click",()=>navigator.geolocation?.getCurrentPosition(x=>{const s=p.querySelector("[data-gps-label]");if(s)s.textContent=`${x.coords.latitude.toFixed(5)}, ${x.coords.longitude.toFixed(5)}`}))}
new MutationObserver(()=>queueMicrotask(enhance)).observe(document.body,{childList:true,subtree:true});window.addEventListener("firemap:vehicle-account-changed",enhance);document.readyState==="loading"?document.addEventListener("DOMContentLoaded",enhance,{once:true}):enhance();
})();