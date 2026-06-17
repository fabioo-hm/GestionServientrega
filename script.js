let paquetes = [];
let paquetesFiltrados = [];
let paginaActual = 1;
const paquetesPorPagina = 50;
let paquetesFiltradosGlobal = [];

window.listenAuthChanges((user) => {
  if (user) {
    console.log("✅ Usuario logueado:", user.email);
    if (user.email === "registradorservientregaa@gmail.com") {
      window.registrador = "A";
    } else if (user.email === "registradorservientregab@gmail.com") {
      window.registrador = "B";
    } else {
      window.registrador = "?";
    }
    console.log("Registrador asignado:", window.registrador);
  } else {
    window.registrador = "";
    console.log("⚠️ No hay usuario logueado");
  }
});

// Elementos del DOM
const formPaquete = document.getElementById('formPaquete');
const envioRadios = document.querySelectorAll('input[name="envio"]');
const direccionGroup = document.getElementById('direccion-group');
const tablaPaquetes = document.getElementById('tabla-paquetes').getElementsByTagName('tbody')[0];

// Mostrar/ocultar campos de dirección según tipo de envío
envioRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        direccionGroup.classList.toggle('hidden', this.value !== 'Entrega en dirección');
    });
});

// Registrar nuevo paquete
formPaquete.addEventListener('submit', function(e) {
    e.preventDefault();

    const codigo = document.getElementById('codigo').value;
    const piezas = parseInt(document.getElementById('piezas').value) || 1;
    const pago = document.querySelector('input[name="pago"]:checked').value;
    const envio = document.querySelector('input[name="envio"]:checked').value;
    const contenido = document.querySelector('input[name="contenido"]:checked').value;

    let destino = '';
    let direccion = '';

    if (envio === 'Entrega en dirección') {
        destino = document.querySelector('input[name="destino"]:checked').value;
        direccion = document.getElementById('direccion').value.trim();
        if (direccion === '') {
            direccion = 'Entrega en dirección';
        }
    } else if (envio === 'Retiro en oficina') {
        direccion = 'Retiro en oficina';
    }

    const nuevoPaquete = {
        codigo,
        pago,
        envio,
        contenido,
        destino,
        direccion,
        piezas,
        repartidor: '',
        intentos: 3,
        estado: 'Pendiente',
        fecha: new Date().toLocaleDateString('es-ES'),
        fechaTimestamp: new Date(),
        registrador: window.registrador
    };

    guardarPaqueteFirestore(nuevoPaquete).then(() => {
        cargarPaquetesFirestore();
    });

    formPaquete.reset();
    alert('Paquete registrado con éxito!');
});

async function asignarRepartidor(codigo, selectElement) {
    const repartidor = selectElement.value;

    let paquete = paquetes.find(p => p.codigo === codigo);
    let paqueteEnFiltrados = paquetesFiltradosGlobal.find(p => p.codigo === codigo);

    if (repartidor && paquete) {
        paquete.repartidor = repartidor;
        paquete.fechaAsignacionRepartidor = new Date().toISOString();

        if (paqueteEnFiltrados) {
            paqueteEnFiltrados.repartidor = repartidor;
            paqueteEnFiltrados.fechaAsignacionRepartidor = paquete.fechaAsignacionRepartidor;
        }

        if (repartidor === "Repartidor 6 - Retiro Of.") {
            paquete.envio = "Retiro en oficina";
            paquete.direccion = "Retiro en oficina";
            paquete.destino = "No aplica";
            if (paqueteEnFiltrados) {
                paqueteEnFiltrados.envio = "Retiro en oficina";
                paqueteEnFiltrados.direccion = "Retiro en oficina";
                paqueteEnFiltrados.destino = "No aplica";
            }
        }

        if (repartidor === "Repartidor 4") {
            let ubicacion = prompt("Selecciona ubicación (AL o SAN):", "AL");
            ubicacion = ubicacion?.toUpperCase();
            if (ubicacion === "AL" || ubicacion === "SAN") {
                paquete.destino = ubicacion;
                if (paqueteEnFiltrados) paqueteEnFiltrados.destino = ubicacion;
            } else {
                alert("Ubicación no válida, usando AL por defecto.");
                paquete.destino = "AL";
                if (paqueteEnFiltrados) paqueteEnFiltrados.destino = "AL";
            }
        }

        const { db, updateDoc, doc } = window.firestore;
        const paqueteRef = doc(db, "paquetes", paquete.id);

        const datosActualizar = {
            repartidor: repartidor,
            fechaAsignacionRepartidor: paquete.fechaAsignacionRepartidor,
            destino: paquete.destino || ""
        };

        if (repartidor === "Repartidor 6 - Retiro Of.") {
            datosActualizar.envio = "Retiro en oficina";
            datosActualizar.direccion = "Retiro en oficina";
        }

        await updateDoc(paqueteRef, datosActualizar);

        actualizarSelectRepartidor(codigo, repartidor);

        setTimeout(() => {
            actualizarTabla();
        }, 100);
    }
}

function actualizarSelectRepartidor(codigo, repartidor) {
    const selects = document.querySelectorAll('select.select-repartidor');
    selects.forEach(select => {
        const row = select.closest('tr');
        if (row) {
            const codigoCell = row.cells[1].textContent.trim();
            if (codigoCell === codigo) {
                select.value = repartidor;
            }
        }
    });
}

// FIX: marcarComoDigitalizado ahora sincroniza paquetesFiltradosGlobal y recarga desde Firestore
async function marcarComoDigitalizado(codigo) {
    const paquete = paquetes.find(p => p.codigo === codigo);
    if (paquete) {
        paquete.estado = 'Digitalizado';
        paquete.fechaDigitalizacion = new Date().toISOString().split('T')[0];

        // Sincronizar también en filtrados
        const paqueteEnFiltrados = paquetesFiltradosGlobal.find(p => p.codigo === codigo);
        if (paqueteEnFiltrados) {
            paqueteEnFiltrados.estado = 'Digitalizado';
            paqueteEnFiltrados.fechaDigitalizacion = paquete.fechaDigitalizacion;
        }

        const { db, updateDoc, doc } = window.firestore;
        const paqueteRef = doc(db, "paquetes", paquete.id);
        await updateDoc(paqueteRef, {
            estado: 'Digitalizado',
            fechaDigitalizacion: paquete.fechaDigitalizacion
        });
        actualizarTabla();
        alert('Paquete marcado como digitalizado');
    }
}

let paqueteSeleccionado = null;

async function buscarPaquete() {
    const codigo = document.getElementById("buscar-codigo").value.trim();
    const paquete = paquetes.find(p => p.codigo === codigo);

    if (paquete) {
        paqueteSeleccionado = paquete;
        document.getElementById("info-codigo").textContent = paquete.codigo;
        document.getElementById("info-direccion").textContent = paquete.direccion;
        document.getElementById("info-intentos").textContent = paquete.intentos;
        document.getElementById("info-paquete").classList.remove("hidden");
    } else {
        alert("❌ Paquete no encontrado.");
        document.getElementById("info-paquete").classList.add("hidden");
    }
}

async function actualizarIntentos() {
    const codigo = document.getElementById('buscar-codigo').value;
    const nuevosIntentos = parseInt(document.getElementById('nuevos-intentos').value);
    const paquete = paquetes.find(p => p.codigo === codigo);
    if (paquete) {
        paquete.intentos = nuevosIntentos;
        paquete.estado = nuevosIntentos === 0 ? 'Devolución' : 'Pendiente';

        // Sincronizar en filtrados
        const paqueteEnFiltrados = paquetesFiltradosGlobal.find(p => p.codigo === codigo);
        if (paqueteEnFiltrados) {
            paqueteEnFiltrados.intentos = nuevosIntentos;
            paqueteEnFiltrados.estado = paquete.estado;
        }

        const { db, updateDoc, doc } = window.firestore;
        const paqueteRef = doc(db, "paquetes", paquete.id);
        await updateDoc(paqueteRef, {
            intentos: nuevosIntentos,
            estado: paquete.estado
        });
        alert('Intentos actualizados correctamente');
        document.getElementById('info-intentos').textContent = nuevosIntentos;
    }
}

// FIX: marcarComoEntregado ahora sincroniza paquetesFiltradosGlobal
async function marcarComoEntregado(codigo) {
    const paquete = paquetes.find(p => p.codigo === codigo);
    if (paquete) {
        paquete.estado = 'Entregado';
        paquete.fechaEntrega = new Date().toISOString().split('T')[0];

        // Sincronizar también en filtrados
        const paqueteEnFiltrados = paquetesFiltradosGlobal.find(p => p.codigo === codigo);
        if (paqueteEnFiltrados) {
            paqueteEnFiltrados.estado = 'Entregado';
            paqueteEnFiltrados.fechaEntrega = paquete.fechaEntrega;
        }

        const { db, updateDoc, doc } = window.firestore;
        const paqueteRef = doc(db, "paquetes", paquete.id);
        await updateDoc(paqueteRef, {
            estado: 'Entregado',
            fechaEntrega: paquete.fechaEntrega
        });
        actualizarTabla();
        alert('Paquete marcado como entregado');
    }
}

function aplicarFiltros() {
    paquetesFiltrados = [...paquetes];

    const repartidor = document.getElementById('filtro-repartidor').value.trim();
    const codigo = document.getElementById('filtro-codigo').value.trim();
    const estado = document.getElementById('filtro-estado').value.trim();
    const destino = document.getElementById('filtro-destino').value.trim();
    const fechaTipo = document.getElementById('filtro-fecha-tipo').value.trim();
    const fecha = document.getElementById('filtro-fecha').value;
    const pago = document.getElementById('filtro-pago').value.trim();
    const contenido = document.getElementById('filtro-contenido').value.trim();
    const envio = document.getElementById('filtro-envio').value.trim();

    // FIX: leer tipoFechaFiltro directamente del DOM para evitar dependencia de variable global
    const tipoFechaFiltro = document.querySelector('input[name="tipo-fecha"]:checked')?.value || 'registro';

    if (repartidor && repartidor !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p =>
            p.repartidor && p.repartidor.toLowerCase() === repartidor.toLowerCase()
        );
    }
    if (codigo) {
        paquetesFiltrados = paquetesFiltrados.filter(p =>
            p.codigo && p.codigo.toLowerCase().includes(codigo.toLowerCase())
        );
    }
    if (estado && estado !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p =>
            p.estado && p.estado.toLowerCase() === estado.toLowerCase()
        );
    }
    if (destino && destino !== 'Todos') {
        if (destino === 'No aplica') {
            paquetesFiltrados = paquetesFiltrados.filter(p => !p.destino);
        } else {
            paquetesFiltrados = paquetesFiltrados.filter(p =>
                p.destino && p.destino.toLowerCase() === destino.toLowerCase()
            );
        }
    }
    if (pago && pago !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p =>
            p.pago && p.pago.toLowerCase() === pago.toLowerCase()
        );
    }
    if (contenido && contenido !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p =>
            p.contenido && p.contenido.toLowerCase() === contenido.toLowerCase()
        );
    }
    if (envio && envio !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p =>
            p.envio && p.envio.toLowerCase() === envio.toLowerCase()
        );
    }

    if (fechaTipo !== 'todas') {
        paquetesFiltrados = paquetesFiltrados.filter(p => {
            let fechaBase = null;

            if (tipoFechaFiltro === 'digitalizacion' && p.fechaDigitalizacion) {
                fechaBase = p.fechaDigitalizacion;
            } else {
                fechaBase = p.fecha;
            }

            if (!fechaBase) return false;

            let fechaPaquete;
            if (typeof fechaBase === 'string' && fechaBase.includes('/')) {
                const [day, month, year] = fechaBase.split("/");
                fechaPaquete = new Date(`${year}-${month}-${day}`);
            } else if (typeof fechaBase === 'string' && fechaBase.includes('-')) {
                fechaPaquete = new Date(fechaBase + 'T00:00:00'); // forzar hora local
            } else {
                fechaPaquete = fechaBase.toDate ? fechaBase.toDate() : new Date(fechaBase);
            }
            fechaPaquete.setHours(0, 0, 0, 0);

            if (fechaTipo === 'antes' || fechaTipo === 'despues' || fechaTipo === 'igual') {
                if (!fecha) return true;
                const fechaFiltro = new Date(fecha + 'T00:00:00');
                fechaFiltro.setHours(0, 0, 0, 0);
                switch (fechaTipo) {
                    case 'antes': return fechaPaquete < fechaFiltro;
                    case 'despues': return fechaPaquete > fechaFiltro;
                    case 'igual': return fechaPaquete.getTime() === fechaFiltro.getTime();
                }
            }

            if (fechaTipo === 'intervalo') {
                const inicio = document.getElementById('fecha-inicio').value;
                const fin = document.getElementById('fecha-fin').value;
                if (!inicio || !fin) return true;
                const fechaInicio = new Date(inicio + 'T00:00:00');
                const fechaFin = new Date(fin + 'T00:00:00');
                fechaInicio.setHours(0, 0, 0, 0);
                fechaFin.setHours(0, 0, 0, 0);
                return fechaPaquete >= fechaInicio && fechaPaquete <= fechaFin;
            }

            return true;
        });
    }

    paquetesFiltradosGlobal = paquetesFiltrados;
    paginaActual = 1;
    actualizarTabla();
}

// FIX: limpiarFiltros ahora restaura correctamente paquetesFiltradosGlobal
function limpiarFiltros() {
    document.getElementById('filtro-repartidor').value = 'Todos';
    document.getElementById('filtro-codigo').value = '';
    document.getElementById('filtro-estado').value = 'Todos';
    document.getElementById('filtro-destino').value = 'Todos';
    document.getElementById('filtro-fecha-tipo').value = 'todas';
    document.getElementById('filtro-fecha').value = '';
    document.getElementById('filtro-pago').value = 'Todos';
    document.getElementById('filtro-contenido').value = 'Todos';
    document.getElementById('filtro-envio').value = 'Todos';
    document.querySelector('input[name="tipo-fecha"][value="registro"]').checked = true;

    // Ocultar campos de fecha al limpiar
    document.getElementById('filtro-fecha').style.display = 'none';
    document.getElementById('filtro-intervalo').style.display = 'none';

    paquetesFiltrados = [];
    // FIX: restaurar paquetesFiltradosGlobal con todos los paquetes
    paquetesFiltradosGlobal = [...paquetes];
    paginaActual = 1;
    actualizarTabla();
}

function exportarExcelFiltrado() {
    const lista = paquetesFiltradosGlobal.length > 0 ? paquetesFiltradosGlobal : paquetes;
    const data = lista.map(p => ({
        'Registrador': p.registrador || 'N/A',
        'Código': p.codigo,
        'Versión': 'Última',
        'Piezas': p.piezas,
        'Método de pago': p.pago,
        'Tipo de envío': p.envio,
        'Contenido': p.contenido,
        'Destino': p.destino || 'N/A',
        'Dirección': p.direccion,
        'Repartidor': p.repartidor || 'Sin asignar',
        'Fecha repartidor': p.fechaAsignacionRepartidor
            ? formatearFechaParaMostrar(p.fechaAsignacionRepartidor)
            : 'No asignado',
        'Intentos': p.intentos,
        'Estado': p.estado,
        'Fecha registro': formatearFechaParaMostrar(p.fecha),
        //'Fecha entrega': p.fechaEntrega ? formatearFechaParaMostrar(p.fechaEntrega) : 'No entregado',
        'Fecha digitalización': p.fechaDigitalizacion ? formatearFechaParaMostrar(p.fechaDigitalizacion) : 'No digitalizado',
        'Notas': p.activo === false ? 'Versión anterior inactiva' : 'Versión activa actual'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Paquetes (Última versión)");
    const fechaDescarga = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `control_paquetes_ultima_version_${fechaDescarga}.xlsx`);
}

function actualizarTabla() {
    const tablaBody = tablaPaquetes;
    tablaBody.innerHTML = '';

    if (!Array.isArray(paquetesFiltradosGlobal)) paquetesFiltradosGlobal = [];

    const inicio = (paginaActual - 1) * paquetesPorPagina;
    const fin = inicio + paquetesPorPagina;
    const paginaPaquetes = paquetesFiltradosGlobal.slice(inicio, fin);

    paginaPaquetes.forEach((paquete) => {
        const row = tablaPaquetes.insertRow();

        // Registrador
        row.insertCell(0).textContent = paquete.registrador || '-';

        // Código — FIX: eliminado el bloque N+1 que nunca usaba su resultado
        const codigoCell = row.insertCell(1);
        codigoCell.textContent = paquete.codigo;

        row.insertCell(2).textContent = paquete.piezas || 1;
        row.insertCell(3).textContent = paquete.direccion;

        // Repartidor
        const repartidorCell = row.insertCell(4);
        if (paquete.envio === 'Entrega en dirección') {
            const select = document.createElement('select');
            select.className = 'select-repartidor';
            select.dataset.codigo = paquete.codigo;
            select.innerHTML = `
                <option value="">Seleccionar</option>
                <option value="Repartidor 1">Repartidor 1</option>
                <option value="Repartidor 2">Repartidor 2</option>
                <option value="Repartidor 3">Repartidor 3</option>
                <option value="Repartidor 4">Repartidor 4</option>
                <option value="Repartidor 5">Repartidor 5</option>
                <option value="Repartidor 6 - Retiro Of.">Repartidor 6 - Retiro Of.</option>
            `;
            if (paquete.repartidor) {
                select.value = paquete.repartidor;
            }
            select.onchange = null;
            select.addEventListener('change', async (e) => {
                await asignarRepartidor(paquete.codigo, e.target);
            });
            repartidorCell.appendChild(select);
        } else {
            repartidorCell.textContent = 'N/A';
        }

        row.insertCell(5).textContent = paquete.destino || 'No aplica';
        row.insertCell(6).textContent = paquete.pago || 'N/A';
        row.insertCell(7).textContent = paquete.contenido || 'N/A';
        row.insertCell(8).textContent = paquete.intentos;
        row.insertCell(9).textContent = formatearFechaParaMostrar(paquete.fecha);
        row.insertCell(10).textContent = formatearFechaParaMostrar(paquete.fechaEntrega);

        const estadoCell = row.insertCell(11);
        estadoCell.textContent = paquete.estado;

        const accionCell = row.insertCell(12);
        accionCell.className = 'accion-cell';

        if (
            paquete.estado === 'Pendiente' &&
            (
                (paquete.envio === 'Entrega en dirección' && paquete.repartidor) ||
                (paquete.envio !== 'Entrega en dirección')
            )
        ) {
            const btnEntregado = document.createElement('button');
            btnEntregado.textContent = 'Marcar como entregado';
            btnEntregado.className = 'estado-btn entregado';
            btnEntregado.onclick = () => marcarComoEntregado(paquete.codigo);
            accionCell.appendChild(btnEntregado);
        }

        if (paquete.estado === 'Entregado') {
            const btnDigitalizado = document.createElement('button');
            btnDigitalizado.textContent = 'Digitalizar';
            btnDigitalizado.className = 'estado-btn digitalizado';
            btnDigitalizado.onclick = () => marcarComoDigitalizado(paquete.codigo);
            accionCell.appendChild(btnDigitalizado);
        }

        const historialCell = row.insertCell(13);
        const btnHistorial = document.createElement('button');
        btnHistorial.textContent = '📋 Historial';
        btnHistorial.className = 'btn-historial';
        btnHistorial.onclick = () => verHistorialCodigo(paquete.codigo);
        btnHistorial.title = 'Ver todas las versiones de este código';
        historialCell.appendChild(btnHistorial);

        switch (paquete.estado) {
            case 'Devolución': estadoCell.style.color = 'red'; break;
            case 'Entregado': estadoCell.style.color = 'green'; break;
            case 'Digitalizado': estadoCell.style.color = 'blue'; break;
            default: estadoCell.style.color = 'orange';
        }
    });

    actualizarResumen(paquetesFiltradosGlobal);
    renderizarControlesPaginacion();
}

// FIX: renderizarPagina() simplificada — delega todo a actualizarTabla() que ya hace el slice
function renderizarPagina() {
    actualizarTabla();
}

function renderizarControlesPaginacion() {
    const contenedor = document.getElementById("paginacion");
    if (!contenedor) return;

    const total = paquetesFiltradosGlobal.length;
    const totalPaginas = Math.max(1, Math.ceil(total / paquetesPorPagina));
    const inicio = (paginaActual - 1) * paquetesPorPagina + 1;
    const fin = Math.min(paginaActual * paquetesPorPagina, total);

    contenedor.innerHTML = `
        <button class="btn" onclick="cambiarPagina(-1)" ${paginaActual === 1 ? "disabled" : ""}>⬅️ Anterior</button>
        <span style="margin: 0 10px;">Página ${paginaActual} de ${totalPaginas} — mostrando ${inicio}–${fin} de ${total}</span>
        <button class="btn" onclick="cambiarPagina(1)" ${paginaActual === totalPaginas ? "disabled" : ""}>Siguiente ➡️</button>
    `;
}

function cambiarPagina(delta) {
    const totalPaginas = Math.max(1, Math.ceil(paquetesFiltradosGlobal.length / paquetesPorPagina));
    paginaActual = Math.min(totalPaginas, Math.max(1, paginaActual + delta));
    actualizarTabla();
}

function actualizarResumen(paquetesMostrar) {
    document.getElementById('total-paquetes').textContent = paquetesMostrar.length;
    document.getElementById('pendientes').textContent = paquetesMostrar.filter(p => p.estado === 'Pendiente').length;
    document.getElementById('entregados').textContent = paquetesMostrar.filter(p => p.estado === 'Entregado').length;
    document.getElementById('digitalizados').textContent = paquetesMostrar.filter(p => p.estado === 'Digitalizado').length;
    document.getElementById('devoluciones').textContent = paquetesMostrar.filter(p => p.estado === 'Devolución').length;
}

async function guardarPaqueteFirestore(paquete) {
    try {
        const { db, collection, addDoc, query, where, getDocs, updateDoc, doc } = window.firestore;

        const paquetesRef = collection(db, "paquetes");
        const q = query(paquetesRef, where("codigo", "==", paquete.codigo));
        const querySnapshot = await getDocs(q);

        for (const docSnapshot of querySnapshot.docs) {
            const data = docSnapshot.data();
            if (data.activo !== false) {
                const paqueteAnteriorRef = doc(db, "paquetes", docSnapshot.id);
                await updateDoc(paqueteAnteriorRef, {
                    activo: false,
                    estadoAnterior: data.estado,
                    fechaReemplazo: new Date().toISOString().split('T')[0],
                    reemplazadoPorRegistrador: window.registrador || "Desconocido"
                });
                await window.registrarHistorial(
                    paquete.codigo,
                    "reemplazo",
                    {
                        motivo: "Reemplazado por nuevo ingreso",
                        idAnterior: docSnapshot.id,
                        estadoAnterior: data.estado,
                        registradorAnterior: data.registrador || "N/A"
                    },
                    window.registrador
                );
            }
        }

        paquete.activo = true;
        paquete.esUltimo = true;
        paquete.fechaIngreso = new Date().toISOString().split('T')[0];
        await addDoc(collection(db, "paquetes"), paquete);

        console.log("✅ Paquete guardado en Firestore");
    } catch (e) {
        console.error("❌ Error guardando en Firestore: ", e);
    }
}

function openTab(tabName) {
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove('active');
    }
    const tabButtons = document.getElementsByClassName('tab-button');
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove('active');
    }
    document.getElementById(tabName).classList.add('active');
    const boton = Array.from(tabButtons).find(btn =>
        btn.getAttribute("onclick")?.includes(`'${tabName}'`)
    );
    if (boton) boton.classList.add("active");

    if (tabName === 'consulta') {
        actualizarTabla();
    } else if (tabName === 'historial') {
        cargarHistorialFirestore();
    }
}

window.openTab = openTab;

async function cargarPaquetesFirestore() {
    try {
        const { db, collection, getDocs } = window.firestore;

        const querySnapshot = await getDocs(collection(db, "paquetes"));
        paquetes = [];
        querySnapshot.forEach((doc) => {
            paquetes.push({ id: doc.id, ...doc.data() });
        });

        let paquetesActivos = paquetes.filter(p => p.activo !== false);

        paquetesActivos.sort((a, b) => {
            const fechaA = a.fechaTimestamp?.toDate ? a.fechaTimestamp.toDate() : new Date(a.fechaTimestamp || a.fecha);
            const fechaB = b.fechaTimestamp?.toDate ? b.fechaTimestamp.toDate() : new Date(b.fechaTimestamp || b.fecha);
            return fechaB - fechaA;
        });

        const codigosUnicos = new Map();
        const paquetesUnicos = [];
        paquetesActivos.forEach(paquete => {
            if (!codigosUnicos.has(paquete.codigo)) {
                codigosUnicos.set(paquete.codigo, true);
                paquetesUnicos.push(paquete);
            }
        });

        paquetes = paquetesUnicos;
        paquetesFiltradosGlobal = paquetes.slice();
        paginaActual = 1;
        actualizarTabla();
    } catch (e) {
        console.error("❌ Error cargando paquetes: ", e);
    }
}

async function compararExcel() {
    const archivo = document.getElementById('archivo-excel').files[0];
    if (!archivo) {
        alert("Por favor selecciona un archivo Excel para comparar.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const hoja = workbook.Sheets[workbook.SheetNames[0]];

        const datos = XLSX.utils.sheet_to_json(hoja, { header: 1 });
        if (datos.length === 0) {
            alert("El archivo está vacío o mal estructurado.");
            return;
        }

        let encabezados = datos[0].map(h =>
            String(h || "")
                .toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, "")
        );

        const idxCodigo = encabezados.findIndex(h => h.includes("codigo"));
        if (idxCodigo === -1) {
            alert("No se encontró ninguna columna que contenga 'Código'.");
            return;
        }

        const codigosExcel = datos.slice(1)
            .map(fila => String(fila[idxCodigo] || "").trim())
            .filter(c => c.length > 0);

        // FIX: usar siempre paquetesFiltradosGlobal para consistencia con la vista actual
        const codigosFirestore = paquetesFiltradosGlobal.map(p => String(p.codigo).trim());

        const enExcelNoFirestore = codigosExcel.filter(c => !codigosFirestore.includes(c));
        const enFirestoreNoExcel = codigosFirestore.filter(c => !codigosExcel.includes(c));

        let html = "<h4>Resultado de la comparación</h4>";
        html += `<p><strong>En Excel pero NO en Firestore:</strong> ${enExcelNoFirestore.length} códigos</p>`;
        html += `<p>${enExcelNoFirestore.join(', ') || 'Ninguno'}</p>`;
        html += `<p><strong>En Firestore pero NO en Excel:</strong> ${enFirestoreNoExcel.length} códigos</p>`;
        html += `<p>${enFirestoreNoExcel.join(', ') || 'Ninguno'}</p>`;

        document.getElementById('resultado-comparacion').innerHTML = html;
    };
    reader.readAsArrayBuffer(archivo);
}

document.addEventListener('DOMContentLoaded', function() {
    cargarPaquetesFirestore();

    document.getElementById('filtro-fecha-tipo').addEventListener('change', function() {
        const tipo = this.value;
        const filtroFecha = document.getElementById('filtro-fecha');
        const filtroIntervalo = document.getElementById('filtro-intervalo');

        if (tipo === 'intervalo') {
            filtroFecha.style.display = 'none';
            filtroIntervalo.style.display = 'block';
        } else if (tipo === 'todas') {
            filtroFecha.style.display = 'none';
            filtroIntervalo.style.display = 'none';
        } else {
            filtroFecha.style.display = 'block';
            filtroIntervalo.style.display = 'none';
        }
    });

    const btnPrevisualizar = document.getElementById('btnPrevisualizar');
    if (btnPrevisualizar) {
        btnPrevisualizar.onclick = window.previsualizarLimpieza;
    }

    const btn2025 = document.getElementById('btnEliminarDigitalizados2025');
    if (btn2025) {
        btn2025.onclick = window.eliminarDigitalizados2025;
    }
});

async function buscarPaqueteEliminar() {
    const codigo = document.getElementById("codigo-eliminar").value.trim();
    if (!codigo) {
        alert("Por favor ingrese un código.");
        return;
    }

    const { db, collection, query, where, getDocs } = window.firestore;
    const paquetesRef = collection(db, "paquetes");
    const q = query(paquetesRef, where("codigo", "==", codigo));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        alert("No se encontró ningún paquete con ese código.");
        document.getElementById("info-eliminar").classList.add("hidden");
        return;
    }

    const paqueteDoc = querySnapshot.docs[0];
    const paqueteData = paqueteDoc.data();

    document.getElementById("info-eliminar").dataset.docId = paqueteDoc.id;
    document.getElementById("eliminar-codigo").textContent = paqueteData.codigo || "";
    document.getElementById("eliminar-direccion").textContent = paqueteData.direccion || "";
    document.getElementById("eliminar-destino").textContent = paqueteData.destino || "";
    document.getElementById("eliminar-pago").textContent = paqueteData.pago || "";
    document.getElementById("eliminar-estado").textContent = paqueteData.estado || "";
    document.getElementById("eliminar-repartidor").textContent = paqueteData.repartidor || "";
    document.getElementById("info-eliminar").classList.remove("hidden");
}

async function eliminarPaquete() {
    const docId = document.getElementById("info-eliminar").dataset.docId;
    const codigo = document.getElementById("eliminar-codigo").textContent;

    if (!docId || !codigo) {
        alert("No hay paquete seleccionado para eliminar.");
        return;
    }

    if (!confirm("¿Seguro que deseas eliminar este paquete?")) {
        return;
    }

    try {
        const { db, deleteDoc, doc, getDoc } = window.firestore;
        const paqueteRef = doc(db, "paquetes", docId);
        const paqueteSnapshot = await getDoc(paqueteRef);
        const datosPaquete = paqueteSnapshot.data();

        await window.registrarHistorial(
            codigo,
            "eliminacion",
            {
                direccion: datosPaquete.direccion || "",
                destino: datosPaquete.destino || "",
                estado: datosPaquete.estado || "",
                repartidor: datosPaquete.repartidor || ""
            },
            window.registrador
        );

        await deleteDoc(paqueteRef);

        alert("✅ Paquete eliminado correctamente.");
        document.getElementById("info-eliminar").classList.add("hidden");
        document.getElementById("codigo-eliminar").value = "";
        cargarPaquetesFirestore();
        cargarHistorialFirestore();
    } catch (error) {
        console.error("Error eliminando paquete: ", error);
        alert("❌ Hubo un error al eliminar el paquete.");
    }
}

// NOTA DE SEGURIDAD: mover esta validación a una Cloud Function de Firebase
// para que la contraseña no sea visible en el código fuente del navegador.
const PASSWORD_ELIMINAR = "ServientregaGerman123";

async function eliminarPaqueteConPassword() {
    try {
        const inputPass = prompt("Ingrese la contraseña para eliminar el paquete:");
        if (inputPass === null) return;

        if (inputPass !== PASSWORD_ELIMINAR) {
            alert("❌ Contraseña incorrecta. No se eliminó el paquete.");
            return;
        }

        const infoEl = document.getElementById("info-eliminar");
        const docId = infoEl?.dataset?.docId;

        const { db, doc, deleteDoc, collection, query, where, getDocs, getDoc } = window.firestore;

        if (docId) {
            const paqueteRef = doc(db, "paquetes", docId);
            const paqueteSnapshot = await getDoc(paqueteRef);
            if (!paqueteSnapshot.exists()) {
                alert("❌ El paquete ya no existe en la base de datos.");
                return;
            }
            const datosPaquete = paqueteSnapshot.data();
            await window.registrarHistorial(
                datosPaquete.codigo || "",
                "eliminacion",
                {
                    direccion: datosPaquete.direccion || "",
                    destino: datosPaquete.destino || "",
                    estado: datosPaquete.estado || "",
                    repartidor: datosPaquete.repartidor || ""
                },
                window.registrador
            );
            await deleteDoc(paqueteRef);
        } else {
            const codigo = (document.getElementById("eliminar-codigo").textContent || "").trim();
            if (!codigo) {
                alert("No hay paquete cargado para eliminar.");
                return;
            }
            const paquetesRef = collection(db, "paquetes");
            const q = query(paquetesRef, where("codigo", "==", codigo));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                alert("❌ No se encontró ningún paquete con ese código.");
                return;
            }
            for (const d of snapshot.docs) {
                const datosPaquete = d.data();
                await window.registrarHistorial(
                    datosPaquete.codigo || "",
                    "eliminacion",
                    {
                        direccion: datosPaquete.direccion || "",
                        destino: datosPaquete.destino || "",
                        estado: datosPaquete.estado || "",
                        repartidor: datosPaquete.repartidor || ""
                    },
                    window.registrador
                );
                await deleteDoc(doc(db, "paquetes", d.id));
            }
        }

        alert("✅ Paquete eliminado correctamente.");
        if (infoEl) infoEl.classList.add("hidden");
        const inputCodigo = document.getElementById("codigo-eliminar");
        if (inputCodigo) inputCodigo.value = "";
        cargarPaquetesFirestore();
        cargarHistorialFirestore();
    } catch (error) {
        console.error("Error eliminando paquete (con password):", error);
        alert("❌ Ocurrió un error al eliminar el paquete.");
    }
}

let paqueteEditando = null;

async function buscarPaqueteEditar() {
    const codigo = document.getElementById("editar-codigo").value.trim();
    const paquete = paquetes.find(p => p.codigo === codigo);

    if (paquete) {
        paqueteEditando = paquete;
        mostrarFormularioEdicion(paquete);
    } else {
        alert("❌ Paquete no encontrado. Solo se pueden editar paquetes activos.");
        document.getElementById("formulario-edicion").classList.add("hidden");
    }
}

// FIX: mostrarFormularioEdicion ahora maneja correctamente múltiples formatos de fecha
function mostrarFormularioEdicion(paquete) {
    document.getElementById("editar-id").value = paquete.id;
    document.getElementById("editar-codigo-input").value = paquete.codigo;
    document.getElementById("editar-piezas").value = paquete.piezas || 1;

    document.querySelector(`input[name="editar-pago"][value="${paquete.pago}"]`).checked = true;
    document.querySelector(`input[name="editar-envio"][value="${paquete.envio}"]`).checked = true;
    document.querySelector(`input[name="editar-contenido"][value="${paquete.contenido}"]`).checked = true;

    if (paquete.envio === 'Entrega en dirección') {
        document.getElementById("editar-direccion-group").classList.remove("hidden");
        if (paquete.destino) {
            const radioDestino = document.querySelector(`input[name="editar-destino"][value="${paquete.destino}"]`);
            if (radioDestino) radioDestino.checked = true;
        }
        document.getElementById("editar-direccion").value = paquete.direccion || '';
    } else {
        document.getElementById("editar-direccion-group").classList.add("hidden");
    }

    document.getElementById("editar-repartidor").value = paquete.repartidor || '';
    document.getElementById("editar-intentos").value = paquete.intentos || 0;
    document.getElementById("editar-estado").value = paquete.estado || 'Pendiente';

    // FIX: usar fechaParaInputDate() para manejar DD/MM/YYYY y YYYY-MM-DD correctamente
    document.getElementById("editar-fecha").value = fechaParaInputDate(paquete.fecha);
    document.getElementById("editar-fecha-entrega").value = fechaParaInputDate(paquete.fechaEntrega);
    document.getElementById("editar-fecha-digitalizacion").value = fechaParaInputDate(paquete.fechaDigitalizacion);

    document.getElementById("formulario-edicion").classList.remove("hidden");

    document.querySelectorAll('input[name="editar-envio"]').forEach(radio => {
        radio.addEventListener('change', function() {
            document.getElementById("editar-direccion-group").classList.toggle('hidden', this.value !== 'Entrega en dirección');
        });
    });
}

// FIX: función auxiliar que detecta el formato de fecha y devuelve YYYY-MM-DD para input[type=date]
function fechaParaInputDate(fecha) {
    if (!fecha) return '';
    if (typeof fecha === 'string' && fecha.includes('/')) {
        // DD/MM/YYYY → YYYY-MM-DD
        const [day, month, year] = fecha.split('/');
        if (day && month && year) return `${year}-${month}-${day}`;
    }
    if (typeof fecha === 'string' && fecha.includes('-') && fecha.length === 10) {
        // Ya es YYYY-MM-DD
        return fecha;
    }
    return '';
}

async function confirmarEdicion() {
    if (!confirm("¿Está seguro de que desea guardar los cambios?")) {
        return;
    }

    try {
        const { db, updateDoc, doc, getDoc } = window.firestore;
        const paqueteRef = doc(db, "paquetes", paqueteEditando.id);

        const paqueteSnapshot = await getDoc(paqueteRef);
        const datosAnteriores = paqueteSnapshot.data();

        const datosActualizados = {
            codigo: document.getElementById("editar-codigo-input").value,
            piezas: parseInt(document.getElementById("editar-piezas").value),
            pago: document.querySelector('input[name="editar-pago"]:checked').value,
            envio: document.querySelector('input[name="editar-envio"]:checked').value,
            contenido: document.querySelector('input[name="editar-contenido"]:checked').value,
            repartidor: document.getElementById("editar-repartidor").value,
            intentos: parseInt(document.getElementById("editar-intentos").value),
            estado: document.getElementById("editar-estado").value,
            // FIX: usar conversión sin objeto Date para evitar bug de zona horaria
            fecha: convertirFechaADDMYYYY(document.getElementById("editar-fecha").value)
        };

        const repartidorAnterior = datosAnteriores.repartidor || '';
        const repartidorNuevo = datosActualizados.repartidor || '';

        if (repartidorNuevo && repartidorNuevo !== repartidorAnterior) {
            datosActualizados.fechaAsignacionRepartidor = new Date().toISOString();
        } else if (repartidorNuevo && repartidorNuevo === repartidorAnterior) {
            datosActualizados.fechaAsignacionRepartidor = datosAnteriores.fechaAsignacionRepartidor;
        }

        if (datosActualizados.envio === 'Entrega en dirección') {
            datosActualizados.destino = document.querySelector('input[name="editar-destino"]:checked').value;
            datosActualizados.direccion = document.getElementById("editar-direccion").value.trim();
        } else {
            datosActualizados.destino = '';
            datosActualizados.direccion = 'Retiro en oficina';
        }

        const fechaEntrega = document.getElementById("editar-fecha-entrega").value;
        if (fechaEntrega) {
            datosActualizados.fechaEntrega = convertirFechaADDMYYYY(fechaEntrega);
        }

        const fechaDigitalizacion = document.getElementById("editar-fecha-digitalizacion").value;
        if (fechaDigitalizacion) {
            datosActualizados.fechaDigitalizacion = convertirFechaADDMYYYY(fechaDigitalizacion);
        }

        const cambiosDetectados = {};
        Object.keys(datosActualizados).forEach(key => {
            if (JSON.stringify(datosAnteriores[key]) !== JSON.stringify(datosActualizados[key])) {
                cambiosDetectados[key] = {
                    anterior: datosAnteriores[key],
                    nuevo: datosActualizados[key]
                };
            }
        });

        if (Object.keys(cambiosDetectados).length > 0) {
            await window.registrarHistorial(
                datosActualizados.codigo,
                "edicion",
                cambiosDetectados,
                window.registrador
            );
        }

        await updateDoc(paqueteRef, datosActualizados);
        alert("✅ Cambios guardados correctamente");
        cancelarEdicion();
        cargarPaquetesFirestore();
        cargarHistorialFirestore();
    } catch (error) {
        console.error("Error al guardar cambios:", error);
        alert("❌ Error al guardar los cambios");
    }
}

function formatearFechaParaMostrar(fecha) {
    if (!fecha) return '-';
    if (fecha.toDate) {
        const date = fecha.toDate();
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    if (typeof fecha === 'string' && fecha.includes('T')) {
        const date = new Date(fecha);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    if (typeof fecha === 'string' && fecha.includes('/')) {
        return fecha;
    }
    if (typeof fecha === 'string' && fecha.includes('-') && fecha.length === 10) {
        const [year, month, day] = fecha.split('-');
        return `${day}/${month}/${year}`;
    }
    return '-';
}

// FIX: convertir sin crear objeto Date para evitar desfase de zona horaria (UTC vs local)
function convertirFechaADDMYYYY(fechaISO) {
    if (!fechaISO) return '';
    const [year, month, day] = fechaISO.split('-');
    if (!year || !month || !day) return '';
    return `${day}/${month}/${year}`;
}

function cancelarEdicion() {
    document.getElementById("formulario-edicion").classList.add("hidden");
    document.getElementById("editar-codigo").value = '';
    paqueteEditando = null;
}

let historialCargado = [];
let historialFiltrado = [];

async function cargarHistorialFirestore() {
    try {
        const { db, collection, getDocs, query, orderBy } = window.firestore;
        const historialRef = collection(db, "historial");
        const q = query(historialRef, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        historialCargado = [];
        querySnapshot.forEach((doc) => {
            historialCargado.push({ id: doc.id, ...doc.data() });
        });

        historialFiltrado = [...historialCargado];
        mostrarHistorial();
    } catch (e) {
        console.error("Error cargando historial:", e);
    }
}

function mostrarHistorial() {
    const tablaBody = document.querySelector('#tabla-historial tbody');
    if (!tablaBody) return;

    tablaBody.innerHTML = '';

    historialFiltrado.forEach(registro => {
        const row = tablaBody.insertRow();
        row.className = `historial-${registro.accion}`;

        let fechaStr = 'N/A';
        if (registro.fecha) {
            const fecha = registro.fecha.toDate ? registro.fecha.toDate() : new Date(registro.fecha);
            fechaStr = fecha.toLocaleString('es-ES');
        }

        row.insertCell(0).textContent = fechaStr;
        row.insertCell(1).textContent = registro.codigo || 'N/A';

        const accionCell = row.insertCell(2);
        if (registro.accion === 'edicion') {
            accionCell.textContent = '✏️ Edición';
            accionCell.style.color = '#2196F3';
        } else if (registro.accion === 'eliminacion') {
            accionCell.textContent = '🗑️ Eliminación';
            accionCell.style.color = '#F44336';
        } else {
            accionCell.textContent = registro.accion;
        }

        const detallesCell = row.insertCell(3);
        if (registro.accion === 'edicion' && registro.cambios) {
            let html = '<ul class="cambios-lista">';
            Object.entries(registro.cambios).forEach(([campo, valores]) => {
                html += `<li><strong>${campo}:</strong> ${valores.anterior || 'N/A'} → ${valores.nuevo || 'N/A'}</li>`;
            });
            html += '</ul>';
            detallesCell.innerHTML = html;
        } else if (registro.accion === 'eliminacion') {
            detallesCell.textContent = registro.cambios || 'Paquete eliminado';
        }

        row.insertCell(4).textContent = registro.usuario || 'Desconocido';
    });
}

function aplicarFiltrosHistorial() {
    const codigo = document.getElementById('filtro-historial-codigo').value.trim().toLowerCase();
    const accion = document.getElementById('filtro-historial-accion').value;
    const fecha = document.getElementById('filtro-historial-fecha').value;

    historialFiltrado = historialCargado.filter(registro => {
        if (codigo && registro.codigo) {
            if (!registro.codigo.toLowerCase().includes(codigo)) return false;
        }
        if (accion !== 'Todas' && registro.accion !== accion) {
            return false;
        }
        if (fecha) {
            const registroFecha = registro.fecha?.toDate
                ? registro.fecha.toDate().toISOString().split('T')[0]
                : new Date(registro.fecha).toISOString().split('T')[0];
            if (registroFecha !== fecha) return false;
        }
        return true;
    });

    mostrarHistorial();
}

function limpiarFiltrosHistorial() {
    document.getElementById('filtro-historial-codigo').value = '';
    document.getElementById('filtro-historial-accion').value = 'Todas';
    document.getElementById('filtro-historial-fecha').value = '';
    historialFiltrado = [...historialCargado];
    mostrarHistorial();
}

async function verHistorialCodigo(codigo) {
    try {
        const { db, collection, query, where, getDocs, orderBy } = window.firestore;
        const paquetesRef = collection(db, "paquetes");
        const q = query(paquetesRef, where("codigo", "==", codigo), orderBy("fechaTimestamp", "desc"));
        const querySnapshot = await getDocs(q);

        let historialHTML = `<h3>Historial completo del código: ${codigo}</h3>`;
        historialHTML += `<table class="historial-table">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Registrador</th>
                    <th>Estado</th>
                    <th>Dirección</th>
                    <th>Activo</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>`;

        let contador = 0;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            contador++;
            const fecha = data.fechaTimestamp?.toDate
                ? data.fechaTimestamp.toDate().toLocaleDateString('es-ES')
                : (data.fecha || 'N/A');

            historialHTML += `
                <tr ${data.activo === false ? 'style="background-color: #f8f8f8; color: #999;"' : 'style="background-color: #e8f5e9;"'}>
                    <td>${fecha}</td>
                    <td>${data.registrador || 'N/A'}</td>
                    <td>${data.estado || 'N/A'}</td>
                    <td>${data.direccion || 'N/A'}</td>
                    <td>${data.activo === false ? '❌ Inactivo' : '✅ Activo'}</td>
                    <td>${contador === 1 ? '<span style="color: green;">⬤ Última versión</span>' : ''}</td>
                </tr>
            `;
        });

        historialHTML += `</tbody></table>`;
        historialHTML += `<p><strong>Total de versiones:</strong> ${contador}</p>`;

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: white; padding: 20px;
            border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.3);
            z-index: 1000; max-width: 80%; max-height: 80%; overflow: auto;
        `;

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 999;
        `;

        const cerrar = () => {
            document.body.removeChild(modal);
            document.body.removeChild(overlay);
        };

        overlay.onclick = cerrar;
        modal.innerHTML = historialHTML + `<button id="cerrarHistorial" style="margin-top:10px;">Cerrar</button>`;
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        document.getElementById("cerrarHistorial").onclick = cerrar;
    } catch (e) {
        console.error("Error cargando historial del código:", e);
        alert("Error al cargar el historial");
    }
}

async function obtenerPaquetesPorRangoFechaDigitalizacion(fechaInicio, fechaFin) {
    const { db, collection, getDocs } = window.firestore;
    const paquetesRef = collection(db, "paquetes");
    const snapshot = await getDocs(paquetesRef);
    const resultados = [];

    const inicioDate = new Date(fechaInicio + 'T00:00:00');
    const finDate = new Date(fechaFin + 'T00:00:00');
    inicioDate.setHours(0, 0, 0, 0);
    finDate.setHours(0, 0, 0, 0);

    snapshot.forEach(doc => {
        const data = doc.data();
        let fechaDigitalizacion = data.fechaDigitalizacion;
        if (!fechaDigitalizacion) return;

        let fechaDate = null;
        if (fechaDigitalizacion.includes('/')) {
            const [day, month, year] = fechaDigitalizacion.split('/');
            fechaDate = new Date(`${year}-${month}-${day}T00:00:00`);
        } else if (fechaDigitalizacion.includes('-')) {
            fechaDate = new Date(fechaDigitalizacion + 'T00:00:00');
        }

        if (fechaDate && fechaDate >= inicioDate && fechaDate <= finDate) {
            resultados.push({ id: doc.id, ...data });
        }
    });
    return resultados;
}

window.previsualizarLimpieza = async function() {
    const fechaInicio = document.getElementById('cleanupFechaInicio').value;
    const fechaFin = document.getElementById('cleanupFechaFin').value;
    if (!fechaInicio || !fechaFin) {
        alert("❌ Debes seleccionar ambas fechas (DESDE y HASTA).");
        return;
    }
    if (fechaInicio > fechaFin) {
        alert("❌ La fecha 'DESDE' no puede ser mayor que 'HASTA'.");
        return;
    }

    const previewDiv = document.getElementById('resultadoPrevisualizacion');
    previewDiv.innerHTML = '<p>Cargando paquetes... ⏳</p>';

    try {
        const lista = await obtenerPaquetesPorRangoFechaDigitalizacion(fechaInicio, fechaFin);
        if (lista.length === 0) {
            previewDiv.innerHTML = '<div class="mensaje-advertencia">📭 No se encontraron paquetes digitalizados en el rango de fechas seleccionado.</div>';
            return;
        }

        let html = `
            <div style="background: #e3f2fd; padding: 12px; border-radius: 6px;">
                <strong>📊 Resumen:</strong> ${lista.length} paquetes digitalizados encontrados en el rango ${fechaInicio} → ${fechaFin}
            </div>
            <div class="preview-lista">
                <h4>Vista previa (primeros 50):</h4>
                <ul style="list-style: none; padding: 0;">
        `;
        lista.slice(0, 50).forEach(p => {
            html += `<li class="preview-item">📦 <strong>${p.codigo}</strong> - Estado: ${p.estado || 'N/A'} - Digitalización: ${p.fechaDigitalizacion}</li>`;
        });
        if (lista.length > 50) html += `<li>... y ${lista.length - 50} más</li>`;
        html += `</ul></div>`;
        html += `
            <div style="margin-top: 20px; display: flex; gap: 15px; flex-wrap: wrap;">
                <button id="btnGenerarBackupClean" class="btn btn-backup">📀 Descargar Backup (Excel) de estos ${lista.length} paquetes</button>
                <button id="btnEliminarMasivo" class="btn btn-peligro">🗑️ ELIMINAR PERMANENTEMENTE (${lista.length} paquetes)</button>
            </div>
            <div class="mensaje-advertencia" style="margin-top: 15px;">
                ⚠️ <strong>ATENCIÓN:</strong> La eliminación es irreversible. Se recomienda descargar backup antes de eliminar.
            </div>
        `;
        previewDiv.innerHTML = html;

        document.getElementById('btnGenerarBackupClean').onclick = () => exportarBackupLimpieza(lista);
        document.getElementById('btnEliminarMasivo').onclick = () => confirmarEliminacionMasiva(lista, fechaInicio, fechaFin);
    } catch (error) {
        console.error(error);
        previewDiv.innerHTML = `<div class="mensaje-advertencia">❌ Error al cargar los paquetes: ${error.message}</div>`;
    }
};

function exportarBackupLimpieza(paquetesLista) {
    if (!paquetesLista.length) {
        alert("No hay paquetes para respaldar.");
        return;
    }
    const data = paquetesLista.map(p => ({
        'ID Firestore': p.id,
        'Código': p.codigo,
        'Piezas': p.piezas,
        'Método de pago': p.pago,
        'Tipo de envío': p.envio,
        'Contenido': p.contenido,
        'Destino': p.destino || 'N/A',
        'Dirección': p.direccion,
        'Repartidor': p.repartidor || 'Sin asignar',
        'Intentos': p.intentos,
        'Estado': p.estado,
        'Fecha registro (original)': p.fecha,
        'Fecha ingreso sistema': p.fechaIngreso || p.fecha,
        'Fecha entrega': p.fechaEntrega || '',
        'Fecha digitalización': p.fechaDigitalizacion || '',
        'Registrador': p.registrador || 'N/A',
        'Activo': p.activo !== false ? 'Sí' : 'No'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Backup_eliminacion");
    const fechaActual = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    XLSX.writeFile(wb, `backup_eliminacion_${fechaActual}.xlsx`);
    alert(`✅ Backup generado con ${paquetesLista.length} registros.`);
}

// FIX: registrar historial ANTES del batch.commit() para evitar inconsistencias
async function confirmarEliminacionMasiva(paquetesLista, fechaInicio, fechaFin) {
    if (!paquetesLista.length) {
        alert("No hay paquetes para eliminar.");
        return;
    }

    const confirmText = prompt(`⚠️ ELIMINACIÓN MASIVA ⚠️\nEstás a punto de borrar ${paquetesLista.length} paquetes de forma PERMANENTE.\nEscribe "CONFIRMAR ELIMINAR" para proceder:`);
    if (confirmText !== "CONFIRMAR ELIMINAR") {
        alert("Operación cancelada.");
        return;
    }

    const previewDiv = document.getElementById('resultadoPrevisualizacion');
    previewDiv.innerHTML = `<p>⏳ Eliminando ${paquetesLista.length} paquetes... Por favor espera.</p>`;

    try {
        const { db, doc, writeBatch } = window.firestore;
        let eliminados = 0;
        const batchSize = 500;

        for (let i = 0; i < paquetesLista.length; i += batchSize) {
            const lote = paquetesLista.slice(i, i + batchSize);

            // FIX: registrar historial de todo el lote ANTES de hacer el commit del batch
            for (const paquete of lote) {
                await window.registrarHistorial(
                    paquete.codigo,
                    "limpieza_masiva",
                    {
                        motivo: `Eliminado por limpieza de rango ${fechaInicio} a ${fechaFin}`,
                        fechaIngreso: paquete.fechaIngreso,
                        datos_resumen: `Código: ${paquete.codigo}, Estado: ${paquete.estado}`
                    },
                    window.registrador || "ADMIN_LIMPIEZA"
                );
            }

            const batch = writeBatch(db);
            for (const paquete of lote) {
                batch.delete(doc(db, "paquetes", paquete.id));
            }
            await batch.commit();

            eliminados += lote.length;
            previewDiv.innerHTML = `<p>✅ Progreso: ${eliminados} de ${paquetesLista.length} eliminados...</p>`;
        }

        await window.registrarHistorial(
            "LIMPIEZA_MASIVA",
            "limpieza_rango",
            {
                rango: `${fechaInicio} - ${fechaFin}`,
                total_eliminados: eliminados,
                fecha_operacion: new Date().toISOString()
            },
            window.registrador || "ADMIN_SISTEMA"
        );

        previewDiv.innerHTML = `
            <div style="background: #c8e6c9; padding: 15px; border-radius: 6px;">
                ✅ <strong>Limpieza completada exitosamente.</strong><br>
                Se eliminaron ${eliminados} paquetes en el rango ${fechaInicio} → ${fechaFin}.<br>
                <button class="btn" onclick="location.reload()">🔄 Recargar página</button>
            </div>
        `;

        if (typeof cargarPaquetesFirestore === 'function') {
            setTimeout(() => cargarPaquetesFirestore(), 1500);
        }
        if (typeof cargarHistorialFirestore === 'function') {
            cargarHistorialFirestore();
        }
    } catch (error) {
        console.error("Error durante eliminación masiva:", error);
        previewDiv.innerHTML = `<div class="mensaje-advertencia">❌ Error crítico: ${error.message}. Algunos paquetes no se eliminaron.</div>`;
    }
}

async function obtenerPaquetesDigitalizadosPorAnio(anio) {
    const { db, collection, getDocs } = window.firestore;
    const paquetesRef = collection(db, "paquetes");
    const snapshot = await getDocs(paquetesRef);
    const resultados = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        const fechaDig = data.fechaDigitalizacion;
        if (fechaDig && fechaDig.startsWith(String(anio))) {
            resultados.push({ id: doc.id, ...data });
        }
    });
    return resultados;
}

window.eliminarDigitalizados2025 = async function() {
    const anio = 2025;
    const confirmText = prompt(`⚠️ ELIMINACIÓN MASIVA ⚠️\nEstás a punto de borrar TODOS los paquetes DIGITALIZADOS en el año ${anio}.\nEsta acción es PERMANENTE.\nEscribe "ELIMINAR DIGITALIZADOS 2025" para proceder:`);
    if (confirmText !== "ELIMINAR DIGITALIZADOS 2025") {
        alert("Operación cancelada.");
        return;
    }

    const previewDiv = document.getElementById('resultadoPrevisualizacion');
    previewDiv.innerHTML = `<p>🔍 Buscando paquetes digitalizados en ${anio}...</p>`;

    try {
        const lista = await obtenerPaquetesDigitalizadosPorAnio(anio);
        if (lista.length === 0) {
            previewDiv.innerHTML = `<div class="mensaje-advertencia">📭 No se encontraron paquetes digitalizados en ${anio}.</div>`;
            return;
        }

        exportarBackupLimpieza(lista);

        const confirmFinal = confirm(`Se encontraron ${lista.length} paquetes digitalizados en ${anio}. Se generó un backup. ¿Deseas continuar con la eliminación?`);
        if (!confirmFinal) {
            previewDiv.innerHTML = `<div class="mensaje-advertencia">Operación cancelada por el usuario.</div>`;
            return;
        }

        previewDiv.innerHTML = `<p>⏳ Eliminando ${lista.length} paquetes... Por favor espera.</p>`;

        const { db, doc, writeBatch } = window.firestore;
        let eliminados = 0;
        const batchSize = 500;

        for (let i = 0; i < lista.length; i += batchSize) {
            const lote = lista.slice(i, i + batchSize);

            // FIX: registrar historial ANTES del commit
            for (const paquete of lote) {
                await window.registrarHistorial(
                    paquete.codigo,
                    "limpieza_digitalizados_2025",
                    {
                        motivo: `Eliminado por limpieza de digitalizados año ${anio}`,
                        fechaDigitalizacion: paquete.fechaDigitalizacion,
                        fechaIngreso: paquete.fechaIngreso
                    },
                    window.registrador || "ADMIN_LIMPIEZA"
                );
            }

            const batch = writeBatch(db);
            for (const paquete of lote) {
                batch.delete(doc(db, "paquetes", paquete.id));
            }
            await batch.commit();

            eliminados += lote.length;
            previewDiv.innerHTML = `<p>✅ Progreso: ${eliminados} de ${lista.length} eliminados...</p>`;
        }

        await window.registrarHistorial(
            "LIMPIEZA_DIGITALIZADOS_2025",
            "limpieza_rango",
            {
                anio: anio,
                total_eliminados: eliminados,
                fecha_operacion: new Date().toISOString()
            },
            window.registrador || "ADMIN_SISTEMA"
        );

        previewDiv.innerHTML = `
            <div style="background: #c8e6c9; padding: 15px; border-radius: 6px;">
                ✅ <strong>Limpieza completada exitosamente.</strong><br>
                Se eliminaron ${eliminados} paquetes digitalizados en ${anio}.<br>
                <button class="btn" onclick="location.reload()">🔄 Recargar página</button>
            </div>
        `;

        if (typeof cargarPaquetesFirestore === 'function') {
            setTimeout(() => cargarPaquetesFirestore(), 1500);
        }
        if (typeof cargarHistorialFirestore === 'function') {
            cargarHistorialFirestore();
        }
    } catch (error) {
        console.error("Error durante eliminación:", error);
        previewDiv.innerHTML = `<div class="mensaje-advertencia">❌ Error crítico: ${error.message}. Algunos paquetes no se eliminaron.</div>`;
    }
};

// Exponer funciones al HTML
window.openTab = openTab;
window.aplicarFiltros = aplicarFiltros;
window.limpiarFiltros = limpiarFiltros;
window.exportarExcelFiltrado = exportarExcelFiltrado;
window.compararExcel = compararExcel;
window.buscarPaquete = buscarPaquete;
window.actualizarIntentos = actualizarIntentos;
window.buscarPaqueteEliminar = buscarPaqueteEliminar;
window.eliminarPaquete = eliminarPaquete;
window.eliminarPaqueteConPassword = eliminarPaqueteConPassword;
window.cambiarPagina = cambiarPagina;
window.buscarPaqueteEditar = buscarPaqueteEditar;
window.confirmarEdicion = confirmarEdicion;
window.cancelarEdicion = cancelarEdicion;
window.cargarHistorialFirestore = cargarHistorialFirestore;
window.aplicarFiltrosHistorial = aplicarFiltrosHistorial;
window.limpiarFiltrosHistorial = limpiarFiltrosHistorial;
window.verHistorialCodigo = verHistorialCodigo;