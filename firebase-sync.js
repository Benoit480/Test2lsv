(async () => {
  const cfg = window.firebaseConfig || {};
  if (!cfg.apiKey || !cfg.projectId) {
    window.fireMapCloud = { configured: false };
    window.dispatchEvent(new Event("firemap-cloud-ready"));
    return;
  }
  try {
    const [{ initializeApp }, authMod, fs, storageMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js")
    ]);
    const app = initializeApp(cfg);
    const auth = authMod.getAuth(app);
    const db = fs.getFirestore(app);
    const storage = storageMod.getStorage(app);
    try { await fs.enableIndexedDbPersistence(db); } catch (_) {}
    await authMod.signInAnonymously(auth);
    const ref = fs.collection(db, "bornes");
    const clean = p => {
      const data = { ...p };
      delete data.photo;
      return { ...data, id: String(p.id), lat: Number(p.lat), lng: Number(p.lng), updatedAt: fs.serverTimestamp() };
    };
    window.fireMapCloud = {
      configured: true,
      subscribe(ok, fail) { return fs.onSnapshot(ref, s => ok(s.docs.map(d => ({ id: d.id, ...d.data() }))), fail); },
      savePoint(p) { return fs.setDoc(fs.doc(db, "bornes", String(p.id)), clean(p), { merge: true }); },
      deletePoint(id) { return fs.deleteDoc(fs.doc(db, "bornes", String(id))); },
      subscribeBuildings(ok, fail) { return fs.onSnapshot(fs.collection(db, "batiments"), s => ok(s.docs.map(d => ({ id: d.id, ...d.data() }))), fail); },
      saveBuilding(p) { const data={...p,id:String(p.id),lat:Number(p.lat),lng:Number(p.lng),updatedAt:fs.serverTimestamp()}; return fs.setDoc(fs.doc(db,"batiments",String(p.id)),data,{merge:true}); },
      deleteBuilding(id) { return fs.deleteDoc(fs.doc(db,"batiments",String(id))); },
      subscribePrevention(ok, fail) { return fs.onSnapshot(fs.collection(db, "prevention"), s => ok(s.docs.map(d => ({ id: d.id, ...d.data() }))), fail); },
      savePrevention(p) { const data={...p,id:String(p.id),buildingId:String(p.buildingId||p.id),updatedAt:fs.serverTimestamp()}; return fs.setDoc(fs.doc(db,"prevention",String(p.id)),data,{merge:true}); },
      deletePrevention(id) { return fs.deleteDoc(fs.doc(db,"prevention",String(id))); },
      async uploadPreventionPhoto(buildingId, category, file) {
        const safeName = String(file.name || "photo.jpg").replace(/[^a-zA-Z0-9._-]+/g, "-");
        const photoId = (crypto.randomUUID ? crypto.randomUUID() : Date.now()+"-"+Math.random().toString(16).slice(2));
        const path = `prevention/${String(buildingId)}/${String(category)}/${photoId}-${safeName}`;
        const objectRef = storageMod.ref(storage, path);
        await storageMod.uploadBytes(objectRef, file, { contentType: file.type || "image/jpeg", cacheControl: "public,max-age=3600" });
        const url = await storageMod.getDownloadURL(objectRef);
        return { url, path, name: file.name || "Photo", type: file.type || "image/jpeg", size: Number(file.size || 0), createdAt: new Date().toISOString() };
      },
      deletePreventionPhoto(path) { return storageMod.deleteObject(storageMod.ref(storage, String(path))); },
      subscribeVehicles(ok, fail) { return fs.onSnapshot(fs.collection(db, "vehicules"), s => ok(s.docs.map(d => ({ id: d.id, ...d.data() }))), fail); },
      saveVehicle(v) { const data={...v,id:String(v.id),lat:Number(v.lat),lng:Number(v.lng),updatedAt:fs.serverTimestamp()}; return fs.setDoc(fs.doc(db,"vehicules",String(v.id)),data,{merge:true}); },
      deleteVehicle(id) { return fs.deleteDoc(fs.doc(db,"vehicules",String(id))); },
      subscribeVehicleUsages(ok, fail) { return fs.onSnapshot(fs.collection(db, "utilisations_vehicules"), s => ok(s.docs.map(d => ({ id: d.id, ...d.data() }))), fail); },
      saveVehicleUsage(v) { const data={...v,id:String(v.id),vehicleId:String(v.vehicleId||""),updatedAt:fs.serverTimestamp()}; return fs.setDoc(fs.doc(db,"utilisations_vehicules",String(v.id)),data,{merge:true}); },
      deleteVehicleUsage(id) { return fs.deleteDoc(fs.doc(db,"utilisations_vehicules",String(id))); },
      subscribeCommandEvents(ok, fail) { return fs.onSnapshot(fs.collection(db, "evenements_commandement"), s => ok(s.docs.map(d => ({ id: d.id, ...d.data() }))), fail); },
      saveCommandEvent(v) { return fs.setDoc(fs.doc(db,"evenements_commandement",String(v.id)),{...v,updatedAt:fs.serverTimestamp()},{merge:true}); },
      subscribeStation(ok, fail) { return fs.onSnapshot(fs.doc(db,"configuration","caserne"), d => ok(d.exists()?{id:d.id,...d.data()}:null), fail); },
      saveStation(v) { const data={...v,lat:Number(v.lat),lng:Number(v.lng),updatedAt:fs.serverTimestamp()}; return fs.setDoc(fs.doc(db,"configuration","caserne"),data,{merge:true}); },
      async saveMany(items) {
        for (let i = 0; i < items.length; i += 400) {
          const batch = fs.writeBatch(db);
          items.slice(i, i + 400).forEach(p => batch.set(fs.doc(db, "bornes", String(p.id)), clean(p), { merge: true }));
          await batch.commit();
        }
      }
    };
  } catch (error) {
    console.error(error);
    window.fireMapCloud = { configured: false, error };
  }
  window.dispatchEvent(new Event("firemap-cloud-ready"));
})();
