const { db, doc, getDoc } = window.firestore;
const auth = window.firebaseAuth;
const listenAuthChanges = window.listenAuthChanges;

listenAuthChanges(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    alert("❌ Usuario no tiene rol asignado.");
    window.location.href = "index.html";
    return;
  }

  const rol = snap.data().rol;

  if (window.location.pathname.includes("admin.html") && rol !== "admin") {
    window.location.href = "index.html";
  }
  if (window.location.pathname.includes("registro.html") && !["admin","registro"].includes(rol)) {
    window.location.href = "index.html";
  }
  if (window.location.pathname.includes("consulta.html") && !["admin","registro","consulta"].includes(rol)) {
    window.location.href = "index.html";
  }

  console.log("✅ Usuario autenticado:", user.email, "Rol:", rol);
});
