let paquetes = [];
let paquetesFiltrados = [];
let paginaActual = 1;
const paquetesPorPagina = 50;
let paquetesFiltradosGlobal = []; // contendrá todos los paquetes filtrados

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
        // Si no escriben dirección, ponemos por defecto el texto
        if (direccion === '') {
            direccion = 'Entrega en dirección';
        }
    } else if (envio === 'Retiro en oficina') {
        // Dirección por defecto para retiro
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
        fecha: new Date().toLocaleDateString('es-ES'), // Formato DD/MM/YYYY
        fechaTimestamp: new Date(), // Guarda también el timestamp exacto
        registrador: registrador
    };
    
    guardarPaqueteFirestore(nuevoPaquete).then(() => {
        cargarPaquetesFirestore();
    });
    
    formPaquete.reset();
    alert('Paquete registrado con éxito!');
});

async function asignarRepartidor(codigo, selectElement) {
    const repartidor = selectElement.value;
    
    // Buscar en todos los arrays
    let paquete = paquetes.find(p => p.codigo === codigo);
    let paqueteEnFiltrados = paquetesFiltradosGlobal.find(p => p.codigo === codigo);
    
    if (repartidor && paquete) {
        // 🔥 ACTUALIZAR EN TODOS LOS ARRAYS NECESARIOS
        paquete.repartidor = repartidor;
        paquete.fechaAsignacionRepartidor = new Date().toISOString();
        
        // Si también está en filtrados, actualizar ahí
        if (paqueteEnFiltrados) {
            paqueteEnFiltrados.repartidor = repartidor;
            paqueteEnFiltrados.fechaAsignacionRepartidor = paquete.fechaAsignacionRepartidor;
        }
        
        // Si es Repartidor 6 - Retiro Of., forzar retiro en oficina
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

        // Si es Repartidor 4 -> pedimos ubicación
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

        // 🔥 ACTUALIZAR FIRESTORE
        const { db, updateDoc, doc } = window.firestore;
        const paqueteRef = doc(db, "paquetes", paquete.id);
        
        const datosActualizar = { 
            repartidor: repartidor,
            fechaAsignacionRepartidor: paquete.fechaAsignacionRepartidor,
            destino: paquete.destino || "" 
        };
        
        // Si es Repartidor 6, actualizar también envío y dirección
        if (repartidor === "Repartidor 6 - Retiro Of.") {
            datosActualizar.envio = "Retiro en oficina";
            datosActualizar.direccion = "Retiro en oficina";
        }
        
        await updateDoc(paqueteRef, datosActualizar);
        
        // 🔥 FORZAR ACTUALIZACIÓN VISUAL INMEDIATA
        actualizarSelectRepartidor(codigo, repartidor);
        
        // Opcional: pequeño retraso para asegurar la actualización
        setTimeout(() => {
            actualizarTabla();
        }, 100);
    }
}

// 🔥 NUEVA FUNCIÓN PARA ACTUALIZAR SELECT ESPECÍFICO
function actualizarSelectRepartidor(codigo, repartidor) {
    const selects = document.querySelectorAll(`select.select-repartidor`);
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
// Función para marcar como digitalizado
async function marcarComoDigitalizado(codigo) {
    const paquete = paquetes.find(p => p.codigo === codigo);
    if (paquete) {
        paquete.estado = 'Digitalizado';
        paquete.fechaDigitalizacion = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
        
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
// Buscar paquete para modificar intentos
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
// Actualizar intentos de entrega
async function actualizarIntentos() {
  const codigo = document.getElementById('buscar-codigo').value;
  const nuevosIntentos = parseInt(document.getElementById('nuevos-intentos').value);
  const paquete = paquetes.find(p => p.codigo === codigo);
  if (paquete) {
    paquete.intentos = nuevosIntentos;
    paquete.estado = nuevosIntentos === 0 ? 'Devolución' : 'Pendiente';
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
// Marcar paquete como entregado
async function marcarComoEntregado(codigo) {
    const paquete = paquetes.find(p => p.codigo === codigo);
    if (paquete) {
        paquete.estado = 'Entregado';
        paquete.fechaEntrega = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
        
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
// Aplicar múltiples filtros
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
    // Filtro por repartidor
    if (repartidor && repartidor !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p => 
            p.repartidor && p.repartidor.toLowerCase() === repartidor.toLowerCase()
        );
    }
    // Filtro por código
    if (codigo) {
        paquetesFiltrados = paquetesFiltrados.filter(p => 
            p.codigo && p.codigo.toLowerCase().includes(codigo.toLowerCase())
        );
    }
    // Filtro por estado
    if (estado && estado !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p => 
            p.estado && p.estado.toLowerCase() === estado.toLowerCase()
        );
    }
    // Filtro por destino
    if (destino && destino !== 'Todos') {
        if (destino === 'No aplica') {
            paquetesFiltrados = paquetesFiltrados.filter(p => !p.destino);
        } else {
            paquetesFiltrados = paquetesFiltrados.filter(p => 
                p.destino && p.destino.toLowerCase() === destino.toLowerCase()
            );
        }
    }
    // Filtro por pago
    if (pago && pago !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p => 
            p.pago && p.pago.toLowerCase() === pago.toLowerCase()
        );
    }
    // Filtro por contenido
    if (contenido && contenido !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p => 
            p.contenido && p.contenido.toLowerCase() === contenido.toLowerCase()
        );
    }
    // Filtro por envío
    if (envio && envio !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p => 
            p.envio && p.envio.toLowerCase() === envio.toLowerCase()
        );
    }
    // ✅ FILTRO DE FECHAS CORREGIDO
    if (fechaTipo !== 'todas') {
        paquetesFiltrados = paquetesFiltrados.filter(p => {
            let fechaBase = null;
            
            // Determinar qué fecha usar según la selección del usuario
            if (tipoFechaFiltro === 'digitalizacion' && p.fechaDigitalizacion) {
                fechaBase = p.fechaDigitalizacion;
            } else {
                fechaBase = p.fecha; // Por defecto, fecha de registro
            } 
            if (!fechaBase) return false;
            // ✅ DETECTAR AUTOMÁTICAMENTE EL FORMATO DE FECHA
            let fechaPaquete;
            
            if (fechaBase.includes('/')) {
                // Formato DD/MM/YYYY
                const [day, month, year] = fechaBase.split("/");
                fechaPaquete = new Date(`${year}-${month}-${day}`);
            } else if (fechaBase.includes('-')) {
                // Formato YYYY-MM-DD
                fechaPaquete = new Date(fechaBase);
            } else {
                // Timestamp de Firestore
                fechaPaquete = fechaBase.toDate ? fechaBase.toDate() : new Date(fechaBase);
            }
            fechaPaquete.setHours(0, 0, 0, 0);
            if (fechaTipo === 'antes' || fechaTipo === 'despues' || fechaTipo === 'igual') {
                if (!fecha) return true;
                const fechaFiltro = new Date(fecha);
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

                const fechaInicio = new Date(inicio);
                const fechaFin = new Date(fin);
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

// Limpiar filtros - actualizada para incluir el nuevo selector
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
    // Restablecer el selector de tipo de fecha a "Fecha de registro"
    document.querySelector('input[name="tipo-fecha"][value="registro"]').checked = true;
    tipoFechaFiltro = 'registro';
    paquetesFiltrados = [];
    actualizarTabla();
}
// Exportar a Excel los resultados filtrados - MODIFICADA
function exportarExcelFiltrado() {
    const data = (paquetesFiltrados.length > 0 ? paquetesFiltrados : paquetes).map(p => ({
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
        // 🔥 NUEVA COLUMNA: Fecha entregado al repartidor
        'Fecha entregado al repartidor': p.fechaAsignacionRepartidor 
            ? formatearFechaParaMostrar(p.fechaAsignacionRepartidor) 
            : 'No asignado',
        'Intentos': p.intentos,
        'Estado': p.estado,
        'Fecha registro': formatearFechaParaMostrar(p.fecha),
        'Fecha ingreso': p.fechaIngreso ? formatearFechaParaMostrar(p.fechaIngreso) : 'N/A',
        'Fecha entrega': p.fechaEntrega ? formatearFechaParaMostrar(p.fechaEntrega) : 'No entregado',
        'Fecha digitalización': p.fechaDigitalizacion ? formatearFechaParaMostrar(p.fechaDigitalizacion) : 'No digitalizado',
        'Notas': p.activo === false ? 'Versión anterior inactiva' : 'Versión activa actual'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Paquetes (Última versión)");
    const fechaDescarga = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `control_paquetes_ultima_version_${fechaDescarga}.xlsx`);
}
// Actualizar tabla de paquetes
function actualizarTabla() {
    const tablaBody = tablaPaquetes; // ya tienes esta referencia al tbody
    tablaBody.innerHTML = '';

    // si no hay datos, limpiamos resumen y controles
    if (!Array.isArray(paquetesFiltradosGlobal)) paquetesFiltradosGlobal = [];
    const total = paquetesFiltradosGlobal.length;
    const inicio = (paginaActual - 1) * paquetesPorPagina;
    const fin = inicio + paquetesPorPagina;
    const paginaPaquetes = paquetesFiltradosGlobal.slice(inicio, fin);
    const { db, collection, query, where, getDocs } = window.firestore;
    paginaPaquetes.forEach(async (paquete) => {
        const row = tablaPaquetes.insertRow();  
        // Registrador
        row.insertCell(0).textContent = paquete.registrador || '-';
        // Código con indicador de duplicados
        const codigoCell = row.insertCell(1);
        codigoCell.textContent = paquete.codigo;
        // 🔍 Verificar si hay versiones anteriores
        try {
            const paquetesRef = collection(db, "paquetes");
            const q = query(paquetesRef, where("codigo", "==", paquete.codigo));
            const querySnapshot = await getDocs(q);
            const totalVersiones = querySnapshot.size;
        } catch (e) {
            console.error("Error verificando versiones:", e);
        }
        row.insertCell(2).textContent = paquete.piezas || 1;
        row.insertCell(3).textContent = paquete.direccion;
        // Repartidor
        const repartidorCell = row.insertCell(4);
        if (paquete.envio === 'Entrega en dirección') {
            const select = document.createElement('select');
            select.className = 'select-repartidor';
            select.dataset.codigo = paquete.codigo; // 🔥 AGREGAR DATASET
            select.innerHTML = `
                <option value="">Seleccionar</option>
                <option value="Repartidor 1">Repartidor 1</option>
                <option value="Repartidor 2">Repartidor 2</option>
                <option value="Repartidor 3">Repartidor 3</option>
                <option value="Repartidor 4">Repartidor 4</option>
                <option value="Repartidor 5">Repartidor 5</option>
                <option value="Repartidor 6 - Retiro Of.">Repartidor 6 - Retiro Of.</option>
            `;
            
            // Preseleccionar si ya tiene repartidor asignado
            if (paquete.repartidor) {
                select.value = paquete.repartidor;
            }
            
            // 🔥 REMOVER EVENT LISTENERS ANTERIORES Y AGREGAR NUEVO
            select.onchange = null; // Limpiar listeners anteriores
            select.addEventListener('change', async (e) => {
                await asignarRepartidor(paquete.codigo, e.target);
            });
            
            repartidorCell.appendChild(select);
        } else {
            repartidorCell.textContent = 'N/A';
        }
        // Destino
        row.insertCell(5).textContent = paquete.destino || 'No aplica';
        // Método de pago
        row.insertCell(6).textContent = paquete.pago || 'N/A';
        // Contenido
        row.insertCell(7).textContent = paquete.contenido || 'N/A';
        // Intentos
        row.insertCell(8).textContent = paquete.intentos;
        // Fecha
        row.insertCell(9).textContent = formatearFechaParaMostrar(paquete.fecha);
        row.insertCell(10).textContent = formatearFechaParaMostrar(paquete.fechaEntrega);
        // Estado
        const estadoCell = row.insertCell(11);
        estadoCell.textContent = paquete.estado;
        // Acciones
        const accionCell = row.insertCell(12);
        accionCell.className = 'accion-cell';
        
        // Botón para marcar como entregado
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
        
        // Botón para marcar como digitalizado
        if (paquete.estado === 'Entregado') {
            const btnDigitalizado = document.createElement('button');
            btnDigitalizado.textContent = 'Digitalizar';
            btnDigitalizado.className = 'estado-btn digitalizado';
            btnDigitalizado.onclick = () => marcarComoDigitalizado(paquete.codigo);
            accionCell.appendChild(btnDigitalizado);
        }
        // Celda de historial
        const historialCell = row.insertCell(13); // Ajusta el índice según tu estructura
        const btnHistorial = document.createElement('button');
        btnHistorial.textContent = '📋 Historial';
        btnHistorial.className = 'btn-historial';
        btnHistorial.onclick = () => verHistorialCodigo(paquete.codigo);
        btnHistorial.title = 'Ver todas las versiones de este código';
        historialCell.appendChild(btnHistorial);
        
        // Colores para estados
        switch(paquete.estado) {
            case 'Devolución':
                estadoCell.style.color = 'red';
                break;
            case 'Entregado':
                estadoCell.style.color = 'green';
                break;
            case 'Digitalizado':
                estadoCell.style.color = 'blue';
                break;
            default:
                estadoCell.style.color = 'orange';
        }
    });
    
    actualizarResumen(paquetesFiltradosGlobal);
    renderizarControlesPaginacion();
}

function renderizarPagina() {
    const inicio = (paginaActual - 1) * paquetesPorPagina;
    const fin = inicio + paquetesPorPagina;
    const paquetesPagina = paquetesFiltradosGlobal.slice(inicio, fin);

    actualizarTabla(paquetesPagina);              // muestra los 200 visibles
    actualizarResumen(paquetesFiltradosGlobal);   // ✅ resumen del total filtrado
    renderizarControlesPaginacion();              // muestra controles
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
    renderizarPagina(); // ✅ esta sí usa el slice correcto
}



// Actualizar resumen
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
    
    // 🔍 Buscar si ya existe un paquete con el mismo código
    const paquetesRef = collection(db, "paquetes");
    const q = query(paquetesRef, where("codigo", "==", paquete.codigo));
    const querySnapshot = await getDocs(q);
    
    // 📝 Marcar como inactivos los paquetes anteriores encontrados
    for (const docSnapshot of querySnapshot.docs) {
      const data = docSnapshot.data();
      // Solo desactivar si está activo (no tiene activo: false)
      if (data.activo !== false) {
        const paqueteAnteriorRef = doc(db, "paquetes", docSnapshot.id);
        await updateDoc(paqueteAnteriorRef, {
          activo: false,
          estadoAnterior: data.estado, // Guardar el estado anterior por si se necesita
          fechaReemplazo: new Date().toISOString().split('T')[0],
          reemplazadoPorRegistrador: window.registrador || "Desconocido"
        });
        
        // 📋 Registrar en el historial que se desactivó por reemplazo
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
    
    // ✅ Ahora guardar el nuevo paquete como activo
    paquete.activo = true;
    paquete.esUltimo = true; // Marcar como el último
    paquete.fechaIngreso = new Date().toISOString().split('T')[0];
    await addDoc(collection(db, "paquetes"), paquete);
    
    console.log("✅ Paquete guardado en Firestore (se desactivaron versiones anteriores)");
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

// ✅ Hacemos la función global
window.openTab = openTab;

async function cargarPaquetesFirestore() {
  try {
    const { db, collection, getDocs, query, where, orderBy } = window.firestore;
    
    // Cargar TODOS los paquetes para poder identificar el último de cada código
    const querySnapshot = await getDocs(collection(db, "paquetes"));
    paquetes = [];
    querySnapshot.forEach((doc) => {
      paquetes.push({ id: doc.id, ...doc.data() });
    });
    
    // 🎯 Filtrar para mostrar solo el último de cada código
    const codigosUnicos = new Map();
    
    // Ordenar por fechaTimestamp descendente para obtener el más reciente primero
    paquetes.sort((a, b) => {
      const fechaA = a.fechaTimestamp?.toDate ? a.fechaTimestamp.toDate() : new Date(a.fechaTimestamp || a.fecha);
      const fechaB = b.fechaTimestamp?.toDate ? b.fechaTimestamp.toDate() : new Date(b.fechaTimestamp || b.fecha);
      return fechaB - fechaA;
    });
    
    // Tomar solo el primero (más reciente) de cada código
    const paquetesUnicos = [];
    paquetes.forEach(paquete => {
      if (!codigosUnicos.has(paquete.codigo)) {
        codigosUnicos.set(paquete.codigo, true);
        paquetesUnicos.push(paquete);
      }
    });
    
    paquetes = paquetesUnicos;
    
    // Inicializar paginación
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
    
    // Normalizamos encabezados
    const datos = XLSX.utils.sheet_to_json(hoja, { header: 1 }); // Array de arrays
    if (datos.length === 0) {
      alert("El archivo está vacío o mal estructurado.");
      return;
    }

    // Primera fila = encabezados
    let encabezados = datos[0].map(h => 
      String(h || "")
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar acentos
        .replace(/\s+/g, "") // quitar espacios
    );

    // Buscamos columna que tenga 'codigo'
    const idxCodigo = encabezados.findIndex(h => h.includes("codigo"));
    if (idxCodigo === -1) {
      alert("No se encontró ninguna columna que contenga 'Código'.");
      return;
    }

    // Extraemos solo esa columna
    const codigosExcel = datos.slice(1) // quitamos encabezado
      .map(fila => String(fila[idxCodigo] || "").trim())
      .filter(c => c.length > 0);

    // Codigos en Firestore
    const codigosFirestore = (paquetesFiltrados.length > 0 ? paquetesFiltrados : paquetes)
      .map(p => String(p.codigo).trim());

    // Diferencias
    const enExcelNoFirestore = codigosExcel.filter(c => !codigosFirestore.includes(c));
    const enFirestoreNoExcel = codigosFirestore.filter(c => !codigosExcel.includes(c));

    // Mostrar resultados
    let html = "<h4>Resultado de la comparación</h4>";
    html += `<p><strong>En Excel pero NO en Firestore:</strong> ${enExcelNoFirestore.length} códigos</p>`;
    html += `<p>${enExcelNoFirestore.join(', ') || 'Ninguno'}</p>`;
    html += `<p><strong>En Firestore pero NO en Excel:</strong> ${enFirestoreNoExcel.length} códigos</p>`;
    html += `<p>${enFirestoreNoExcel.join(', ') || 'Ninguno'}</p>`;

    document.getElementById('resultado-comparacion').innerHTML = html;
  };
  reader.readAsArrayBuffer(archivo);
}

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
    cargarPaquetesFirestore();
    document.getElementById('filtro-fecha-tipo').addEventListener('change', function () {
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
});

async function buscarPaqueteEliminar() {
    const codigo = document.getElementById("codigo-eliminar").value.trim();
    if (!codigo) {
        alert("Por favor ingrese un código.");
        return;
    }

    const { db, collection, query, where, getDocs } = window.firestore; // 👈 importante

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
        
        // Obtener datos antes de eliminar
        const paqueteSnapshot = await getDoc(paqueteRef);
        const datosPaquete = paqueteSnapshot.data();
        
        // Registrar en historial ANTES de eliminar
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
        
        // Eliminar el paquete
        await deleteDoc(paqueteRef);
        
        alert("✅ Paquete eliminado correctamente.");
        document.getElementById("info-eliminar").classList.add("hidden");
        document.getElementById("codigo-eliminar").value = "";
        
        // Recargar datos
        cargarPaquetesFirestore();
        cargarHistorialFirestore();
    } catch (error) {
        console.error("Error eliminando paquete: ", error);
        alert("❌ Hubo un error al eliminar el paquete.");
    }
}

const PASSWORD_ELIMINAR = "ServientregaGerman123"; // <- cambia la contraseña si quieres

async function eliminarPaqueteConPassword() {
  try {
    // 1) Pedir contraseña
    const inputPass = prompt("Ingrese la contraseña para eliminar el paquete:");
    if (inputPass === null) return;

    if (inputPass !== PASSWORD_ELIMINAR) {
      alert("❌ Contraseña incorrecta. No se eliminó el paquete.");
      return;
    }

    // 2) Obtener docId guardado al buscar paquete
    const infoEl = document.getElementById("info-eliminar");
    const docId = infoEl?.dataset?.docId;

    const { 
      db, doc, deleteDoc, collection, 
      query, where, getDocs, getDoc 
    } = window.firestore;

    // Si tenemos docId → flujo ideal
    if (docId) {
      const paqueteRef = doc(db, "paquetes", docId);

      // 🔹 Obtener datos antes de eliminar
      const paqueteSnapshot = await getDoc(paqueteRef);
      if (!paqueteSnapshot.exists()) {
        alert("❌ El paquete ya no existe en la base de datos.");
        return;
      }

      const datosPaquete = paqueteSnapshot.data();

      // 🔹 Registrar historial antes de borrar
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

      // 🔹 Eliminar paquete
      await deleteDoc(paqueteRef);

    } else {
      // Si no hay docId, buscar por código visible
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

      // 🔹 Para cada coincidencia: registrar historial y eliminar
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

    // 3) Feedback y refresco UI
    alert("✅ Paquete eliminado correctamente.");
    if (infoEl) infoEl.classList.add("hidden");

    const inputCodigo = document.getElementById("codigo-eliminar");
    if (inputCodigo) inputCodigo.value = "";

    if (typeof cargarPaquetesFirestore === "function") {
      cargarPaquetesFirestore();
    }
    if (typeof cargarHistorialFirestore === "function") {
      cargarHistorialFirestore();
    }

  } catch (error) {
    console.error("Error eliminando paquete (con password):", error);
    alert("❌ Ocurrió un error al eliminar el paquete.");
  }
}

let paqueteEditando = null;

// Buscar paquete para editar
async function buscarPaqueteEditar() {
    const codigo = document.getElementById("editar-codigo").value.trim();
    const paquete = paquetes.find(p => p.codigo === codigo);

    if (paquete) {
        paqueteEditando = paquete;
        mostrarFormularioEdicion(paquete);
    } else {
        alert("❌ Paquete no encontrado.");
        document.getElementById("formulario-edicion").classList.add("hidden");
    }
}

// Mostrar formulario con datos actuales
function mostrarFormularioEdicion(paquete) {
    // Llenar campos del formulario
    document.getElementById("editar-id").value = paquete.id;
    document.getElementById("editar-codigo-input").value = paquete.codigo;
    document.getElementById("editar-piezas").value = paquete.piezas || 1;
    
    // Método de pago
    document.querySelector(`input[name="editar-pago"][value="${paquete.pago}"]`).checked = true;
    
    // Tipo de envío
    document.querySelector(`input[name="editar-envio"][value="${paquete.envio}"]`).checked = true;
    
    // Tipo de contenido
    document.querySelector(`input[name="editar-contenido"][value="${paquete.contenido}"]`).checked = true;
    
    // Destino y dirección
    if (paquete.envio === 'Entrega en dirección') {
        document.getElementById("editar-direccion-group").classList.remove("hidden");
        if (paquete.destino) {
            document.querySelector(`input[name="editar-destino"][value="${paquete.destino}"]`).checked = true;
        }
        document.getElementById("editar-direccion").value = paquete.direccion || '';
    } else {
        document.getElementById("editar-direccion-group").classList.add("hidden");
    }
    
    // Otros campos
    document.getElementById("editar-repartidor").value = paquete.repartidor || '';
    document.getElementById("editar-intentos").value = paquete.intentos || 0;
    document.getElementById("editar-estado").value = paquete.estado || 'Pendiente';
    
    // Fechas - convertir formato DD/MM/AAAA a YYYY-MM-DD para input type="date"
    if (paquete.fecha) {
        const [day, month, year] = paquete.fecha.split('/');
        document.getElementById("editar-fecha").value = `${year}-${month}-${day}`;
    }
    
    if (paquete.fechaEntrega) {
        const [day, month, year] = paquete.fechaEntrega.split('/');
        document.getElementById("editar-fecha-entrega").value = `${year}-${month}-${day}`;
    }
    
    if (paquete.fechaDigitalizacion) {
        const [day, month, year] = paquete.fechaDigitalizacion.split('/');
        document.getElementById("editar-fecha-digitalizacion").value = `${year}-${month}-${day}`;
    }
    
    // Mostrar formulario
    document.getElementById("formulario-edicion").classList.remove("hidden");
    
    // Agregar event listeners para mostrar/ocultar dirección
    document.querySelectorAll('input[name="editar-envio"]').forEach(radio => {
        radio.addEventListener('change', function() {
            document.getElementById("editar-direccion-group").classList.toggle('hidden', this.value !== 'Entrega en dirección');
        });
    });
}

// Confirmar edición
// Confirmar edición - MODIFICADA PARA ACTUALIZAR FECHA AL CAMBIAR REPARTIDOR
async function confirmarEdicion() {
    if (!confirm("¿Está seguro de que desea guardar los cambios?")) {
        return;
    }

    try {
        const { db, updateDoc, doc, getDoc } = window.firestore;
        const paqueteRef = doc(db, "paquetes", paqueteEditando.id);
        
        // Obtener datos anteriores
        const paqueteSnapshot = await getDoc(paqueteRef);
        const datosAnteriores = paqueteSnapshot.data();
        
        // Recopilar datos del formulario
        const datosActualizados = {
            codigo: document.getElementById("editar-codigo-input").value,
            piezas: parseInt(document.getElementById("editar-piezas").value),
            pago: document.querySelector('input[name="editar-pago"]:checked').value,
            envio: document.querySelector('input[name="editar-envio"]:checked').value,
            contenido: document.querySelector('input[name="editar-contenido"]:checked').value,
            repartidor: document.getElementById("editar-repartidor").value,
            intentos: parseInt(document.getElementById("editar-intentos").value),
            estado: document.getElementById("editar-estado").value,
            fecha: convertirFechaADDMYYYY(document.getElementById("editar-fecha").value)
        };
        
        // 🔥 ACTUALIZAR FECHA SI CAMBIA EL REPARTIDOR
        const repartidorAnterior = datosAnteriores.repartidor || '';
        const repartidorNuevo = datosActualizados.repartidor || '';
        
        if (repartidorNuevo && repartidorNuevo !== repartidorAnterior) {
            datosActualizados.fechaAsignacionRepartidor = new Date().toISOString();
        } else if (repartidorNuevo && repartidorNuevo === repartidorAnterior) {
            // Mantener la fecha existente si no cambia
            datosActualizados.fechaAsignacionRepartidor = datosAnteriores.fechaAsignacionRepartidor;
        }
        
        // Manejar dirección y destino
        if (datosActualizados.envio === 'Entrega en dirección') {
            datosActualizados.destino = document.querySelector('input[name="editar-destino"]:checked').value;
            datosActualizados.direccion = document.getElementById("editar-direccion").value.trim();
        } else {
            datosActualizados.destino = '';
            datosActualizados.direccion = 'Retiro en oficina';
        }
        
        // Fechas opcionales
        const fechaEntrega = document.getElementById("editar-fecha-entrega").value;
        if (fechaEntrega) {
            datosActualizados.fechaEntrega = convertirFechaADDMYYYY(fechaEntrega);
        }
        
        const fechaDigitalizacion = document.getElementById("editar-fecha-digitalizacion").value;
        if (fechaDigitalizacion) {
            datosActualizados.fechaDigitalizacion = convertirFechaADDMYYYY(fechaDigitalizacion);
        }
        
        // Detectar cambios
        const cambiosDetectados = {};
        Object.keys(datosActualizados).forEach(key => {
            if (JSON.stringify(datosAnteriores[key]) !== JSON.stringify(datosActualizados[key])) {
                cambiosDetectados[key] = {
                    anterior: datosAnteriores[key],
                    nuevo: datosActualizados[key]
                };
            }
        });
        
        // Solo registrar si hay cambios
        if (Object.keys(cambiosDetectados).length > 0) {
            // Registrar en historial
            await window.registrarHistorial(
                datosActualizados.codigo,
                "edicion",
                cambiosDetectados,
                window.registrador
            );
        }
        
        // Actualizar en Firestore
        await updateDoc(paqueteRef, datosActualizados);
        
        alert("✅ Cambios guardados correctamente");
        cancelarEdicion();
        
        // Recargar datos
        cargarPaquetesFirestore();
        cargarHistorialFirestore();
    } catch (error) {
        console.error("Error al guardar cambios:", error);
        alert("❌ Error al guardar los cambios");
    }
}

function formatearFechaParaMostrar(fecha) {
    if (!fecha) return '-';
    
    // Si es timestamp de Firestore
    if (fecha.toDate) {
        const date = fecha.toDate();
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
    
    // Si es un string ISO (como fechaAsignacionRepartidor)
    if (typeof fecha === 'string' && fecha.includes('T')) {
        const date = new Date(fecha);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
    
    // Si ya está en formato DD/MM/YYYY
    if (typeof fecha === 'string' && fecha.includes('/')) {
        return fecha;
    }
    
    // Si está en formato YYYY-MM-DD, convertirlo
    if (typeof fecha === 'string' && fecha.includes('-') && fecha.length === 10) {
        const [year, month, day] = fecha.split('-');
        return `${day}/${month}/${year}`;
    }
    
    return '-';
}

// Función auxiliar para convertir fechas
function convertirFechaADDMYYYY(fechaISO) {
    if (!fechaISO) return '';
    const fecha = new Date(fechaISO);
    const day = fecha.getDate().toString().padStart(2, '0');
    const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const year = fecha.getFullYear();
    return `${day}/${month}/${year}`;
}

// Cancelar edición
function cancelarEdicion() {
    document.getElementById("formulario-edicion").classList.add("hidden");
    document.getElementById("editar-codigo").value = '';
    paqueteEditando = null;
}

// Variables para historial
let historialCargado = [];
let historialFiltrado = [];

// Función para cargar historial desde Firestore
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

// Función para mostrar historial en la tabla
function mostrarHistorial() {
    const tablaBody = document.querySelector('#tabla-historial tbody');
    if (!tablaBody) return;
    
    tablaBody.innerHTML = '';
    
    historialFiltrado.forEach(registro => {
        const row = tablaBody.insertRow();
        row.className = `historial-${registro.accion}`;
        
        // Formatear fecha
        let fechaStr = 'N/A';
        if (registro.fecha) {
            const fecha = registro.fecha.toDate ? registro.fecha.toDate() : new Date(registro.fecha);
            fechaStr = fecha.toLocaleString('es-ES');
        }
        
        // Celda 1: Fecha y Hora
        row.insertCell(0).textContent = fechaStr;
        
        // Celda 2: Código
        row.insertCell(1).textContent = registro.codigo || 'N/A';
        
        // Celda 3: Acción
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
        
        // Celda 4: Detalles del cambio
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
        
        // Celda 5: Usuario
        row.insertCell(4).textContent = registro.usuario || 'Desconocido';
    });
}

// Función para aplicar filtros al historial
function aplicarFiltrosHistorial() {
    const codigo = document.getElementById('filtro-historial-codigo').value.trim().toLowerCase();
    const accion = document.getElementById('filtro-historial-accion').value;
    const fecha = document.getElementById('filtro-historial-fecha').value;
    
    historialFiltrado = historialCargado.filter(registro => {
        // Filtro por código
        if (codigo && registro.codigo) {
            if (!registro.codigo.toLowerCase().includes(codigo)) return false;
        }
        
        // Filtro por acción
        if (accion !== 'Todas' && registro.accion !== accion) {
            return false;
        }
        
        // Filtro por fecha
        if (fecha) {
            const registroFecha = registro.fecha?.toDate ? 
                registro.fecha.toDate().toISOString().split('T')[0] : 
                new Date(registro.fecha).toISOString().split('T')[0];
            if (registroFecha !== fecha) return false;
        }
        
        return true;
    });
    
    mostrarHistorial();
}

// Función para limpiar filtros del historial
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
            const fecha = data.fechaTimestamp?.toDate ? 
                data.fechaTimestamp.toDate().toLocaleDateString('es-ES') : 
                (data.fecha || 'N/A');
            
            historialHTML += `
                <tr ${data.activo === false ? 'style="background-color: #f8f8f8; color: #999;"' : 'style="background-color: #e8f5e9;"'}>
                    <td>${fecha}</td>
                    <td>${data.registrador || 'N/A'}</td>
                    <td>${data.estado || 'N/A'}</td>
                    <td>${data.direccion || 'N/A'}</td>
                    <td>${data.activo === false ? '❌ Inactivo' : '✅ Activo'}</td>
                    <td>
                        ${contador === 1 ? '<span style="color: green;">⬤ Última versión</span>' : ''}
                    </td>
                </tr>
            `;
        });
        
        historialHTML += `</tbody></table>`;
        historialHTML += `<p><strong>Total de versiones:</strong> ${contador}</p>`;
        
        // Mostrar en un modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.3);
            z-index: 1000;
            max-width: 80%;
            max-height: 80%;
            overflow: auto;
        `;
        
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 999;
        `;        
        overlay.onclick = () => {
            document.body.removeChild(modal);
            document.body.removeChild(overlay);
        };       
        modal.innerHTML = historialHTML + `
            <button id="cerrarHistorial" style="margin-top:10px;">Cerrar</button>
        `;
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        // 🔹 Ahora sí el botón existe en el DOM
        document.getElementById("cerrarHistorial").onclick = () => {
            document.body.removeChild(modal);
            document.body.removeChild(overlay);
        };
    } catch (e) {
        console.error("Error cargando historial del código:", e);
        alert("Error al cargar el historial");
    }
}
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