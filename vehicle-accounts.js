(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const KEY="firemap-vehicle-account-session-v1";
  const ACCOUNTS=[
    {id:"202",number:"202",name:"Autopompe 202",role:"unit",roleLabel:"Unité",icon:"🚒"},
    {id:"502",number:"502",name:"Échelle 502",role:"unit",roleLabel:"Unité",icon:"🪜"},
    {id:"802",number:"802",name:"Citerne 802",role:"unit",roleLabel:"Unité",icon:"🚛"},
    {id:"602",number:"602",name:"Unité de soutien 602",role:"unit",roleLabel:"Unité",icon:"🧰"},
    {id:"902",number:"902",name:"Pickup 902",role:"unit",roleLabel:"Unité",icon:"🛻"},
    {id:"102",number:"102",name:"Chef 102",role:"chief",roleLabel:"Chef des opérations",icon:"👨‍🚒"}
  ];
  let selectedId="";
  let session=read();

  function read(){try{return JSON.parse(localStorage.getItem(KEY)||"null")}catch(_){return null}}
  function current(){return session?.id?(ACCOUNTS.find(a=>a.id===String(session.id))||session):null}
  function isChief(){return current()?.role==="chief"||current()?.number==="102"}
  function isOwnVehicle(id){return isChief()||String(current()?.id||"")===String(id)}
  function canAccessCommand(){return isChief()}

  function render(){
    const box=$("vehicleAccountGrid");if(!box)return;
    box.innerHTML=ACCOUNTS.map(a=>`<button type="button" class="vehicle-account-card ${selectedId===a.id?"selected":""} ${a.role==="chief"?"chief":""}" data-account-id="${a.id}">
      <span class="vehicle-account-icon">${a.icon}</span><strong>${a.name}</strong><small>${a.roleLabel}</small>
      <em>${a.role==="chief"?"Accès commandement":"Lié à son véhicule"}</em>
    </button>`).join("");
  }
  function select(id){
    const a=ACCOUNTS.find(x=>x.id===String(id));if(!a)return;
    selectedId=a.id;render();
    $("vehicleAccountSelected").classList.remove("hidden");
    $("vehicleAccountSelectedIcon").textContent=a.icon;
    $("vehicleAccountSelectedName").textContent=a.name;
    $("vehicleAccountSelectedRole").textContent=a.roleLabel;
  }
  function apply(){
    const a=current();
    document.querySelectorAll('[data-view="command"]').forEach(b=>{b.classList.toggle("hidden",!isChief());b.disabled=!isChief()});
    $("switchVehicleAccount")?.classList.toggle("hidden",!a);
    $("accountBadge")?.classList.toggle("hidden",!a);
    if(a){$("accountBadgeIcon").textContent=a.icon;$("accountBadgeNumber").textContent=a.number;$("accountBadgeRole").textContent=a.roleLabel}
    document.body.dataset.accountRole=a?.role||"";
    document.body.dataset.accountVehicle=a?.id||"";
    window.dispatchEvent(new CustomEvent("firemap:account-changed",{detail:a}));
  }
  function open(canCancel=true){
    selectedId=current()?.id||"";render();
    if(selectedId)select(selectedId);else $("vehicleAccountSelected").classList.add("hidden");
    $("vehicleAccountCancel").classList.toggle("hidden",!canCancel||!current());
    const d=$("vehicleAccountDialog");if(d&&!d.open)d.showModal();
  }
  function login(e){
    e.preventDefault();
    const a=ACCOUNTS.find(x=>x.id===selectedId);if(!a)return;
    session={...a,signedInAt:new Date().toISOString()};
    localStorage.setItem(KEY,JSON.stringify(session));
    $("vehicleAccountDialog").close();apply();
    window.fireMapInternal?.showView?.(isChief()?"command":"vehicles");
  }
  document.addEventListener("click",e=>{const c=e.target.closest("[data-account-id]");if(c)select(c.dataset.accountId)});
  $("vehicleAccountForm")?.addEventListener("submit",login);
  $("vehicleAccountCancel")?.addEventListener("click",()=>$("vehicleAccountDialog").close());
  $("switchVehicleAccount")?.addEventListener("click",()=>open(true));
  $("accountBadge")?.addEventListener("click",()=>open(true));
  window.fireMapAccount={current,isChief,isOwnVehicle,canAccessCommand,openChooser:open,accounts:()=>ACCOUNTS.map(x=>({...x}))};
  apply();if(!current())requestAnimationFrame(()=>open(false));
})();