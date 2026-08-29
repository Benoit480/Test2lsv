(() => {
  "use strict";

  const $=id=>document.getElementById(id);

  function escapeHtml(s){
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[c]));
  }

  function showMessage(html,error=false){
    const box=$("assistantSuggestions");
    if(!box)return;
    box.innerHTML=html
      ? `<div class="${error?"google-places-error":"google-places-info"}">${html}</div>`
      : "";
  }

  async function init(){
    const input=$("assistantAddress");
    if(!input)return;

    showMessage("");

    try{
      await window.fireMapGoogleReady;
      const places=await google.maps.importLibrary("places");

      if(typeof places.Autocomplete!=="function"){
        throw new Error("Autocomplete Google Places non disponible pour ce projet.");
      }

      const bounds=new google.maps.LatLngBounds(
        {lat:46.15,lng:-73.08},
        {lat:46.36,lng:-72.80}
      );

      const autocomplete=new places.Autocomplete(input,{
        bounds,
        strictBounds:false,
        componentRestrictions:{country:"ca"},
        fields:["formatted_address","geometry","place_id","name"],
        types:["address"]
      });

      window.fireMapAssistantGoogleAutocomplete=autocomplete;
      input.setAttribute("autocomplete","off");

      input.addEventListener("input",()=>{
        window.fireMapAssistantGoogleSelected=null;
        const box=$("assistantSuggestions");
        if(box)box.innerHTML="";
      },{capture:true});

      autocomplete.addListener("place_changed",()=>{
        const place=autocomplete.getPlace();
        const loc=place?.geometry?.location;

        if(!loc){
          window.fireMapAssistantGoogleSelected=null;
          showMessage(
            "<strong>Adresse Google non reconnue.</strong><span>Choisissez une adresse proposée par Google.</span>",
            true
          );
          return;
        }

        const address=String(place.formatted_address||place.name||input.value||"").trim();
        const selected={
          adresse:address,
          lat:Number(loc.lat()),
          lng:Number(loc.lng()),
          source:"google",
          placeId:String(place.place_id||"")
        };

        window.fireMapAssistantGoogleSelected=selected;
        input.value=address;
        showMessage(
          `<strong>✓ Adresse Google sélectionnée</strong><span>${escapeHtml(address)}</span>`
        );
      });

      try{ autocomplete.setBounds(bounds); }catch(_){}

    }catch(err){
      console.error("FireMap Google Places natif :",err);
      window.fireMapAssistantGoogleSelected=null;
      showMessage(
        "<strong>⚠️ Google Places indisponible</strong><span>Vérifiez que Places API est activée pour la clé Google de FireMap.</span>",
        true
      );
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",init,{once:true});
  }else{
    init();
  }
})();