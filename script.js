let paquetes = [];
let paquetesFiltrados = [];
let paginaActual = 1;
const paquetesPorPagina = 200;
let paquetesFiltradosGlobal = []; // contendrá todos los paquetes filtrados

// Detectar usuario logueado
// script.js

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
        repartidor: '', // Inicialmente sin repartidor asignado
        intentos: 3,
        estado: 'Pendiente',
        fecha: new Date().toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }),
        registrador: registrador
    };
    
    guardarPaqueteFirestore(nuevoPaquete).then(() => {
        cargarPaquetesFirestore();
    });
    
    formPaquete.reset();
    alert('Paquete registrado con éxito!');
});

// Función para asignar repartidor directamente desde el select
async function asignarRepartidor(codigo, selectElement) {
  const repartidor = selectElement.value;
  const paquete = paquetes.find(p => p.codigo === codigo);

  if (repartidor && paquete) {
    paquete.repartidor = repartidor;

    // Si es Repartidor 4 -> pedimos ubicación
    if (repartidor === "Repartidor 4") {
      let ubicacion = prompt("Selecciona ubicación (AL o SAN):", "AL");
      ubicacion = ubicacion?.toUpperCase();

      if (ubicacion === "AL" || ubicacion === "SAN") {
        paquete.destino = ubicacion; // 👈 Guardamos en destino
      } else {
        alert("Ubicación no válida, usando LA por defecto.");
        paquete.destino = "AL";
      }
    }

    const { db, updateDoc, doc } = window.firestore;
    const paqueteRef = doc(db, "paquetes", paquete.id);
    await updateDoc(paqueteRef, { 
      repartidor: repartidor,
      destino: paquete.destino || "" 
    });
    actualizarTabla();
  }
}
// Función para marcar como digitalizado
async function marcarComoDigitalizado(codigo) {
  const paquete = paquetes.find(p => p.codigo === codigo);
  if (paquete) {
    paquete.estado = 'Digitalizado';
    paquete.fechaDigitalizacion = new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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
    paquete.fechaEntrega = new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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
    paquetesFiltrados = [...paquetes]; // Copia del array original
    
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

    if (pago && pago !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p => 
            p.pago && p.pago.toLowerCase() === pago.toLowerCase()
        );
    }

    // ✅ Filtro por contenido
    if (contenido && contenido !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p => 
            p.contenido && p.contenido.toLowerCase() === contenido.toLowerCase()
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

    if (envio && envio !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p => 
            p.envio && p.envio.toLowerCase() === envio.toLowerCase()
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
    
    // Filtro por fecha - VERSIÓN MEJORADA CON SELECCIÓN DE TIPO DE FECHA
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

            const [day, month, year] = fechaBase.split("/");
            if (!day || !month || !year) return false;

            const fechaPaquete = new Date(`${year}-${month}-${day}`);
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

                // Para intervalo, usar la fecha seleccionada (registro o digitalización)
                let fechaComparar = null;
                if (tipoFechaFiltro === 'digitalizacion' && p.fechaDigitalizacion) {
                    const [day, month, year] = p.fechaDigitalizacion.split("/");
                    fechaComparar = new Date(`${year}-${month}-${day}`);
                    fechaComparar.setHours(0, 0, 0, 0);
                } else if (p.fecha) {
                    const [day, month, year] = p.fecha.split("/");
                    fechaComparar = new Date(`${year}-${month}-${day}`);
                    fechaComparar.setHours(0, 0, 0, 0);
                }
                
                return fechaComparar && fechaComparar >= fechaInicio && fechaComparar <= fechaFin;
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

// Exportar a Excel los resultados filtrados
function exportarExcelFiltrado() {
    const data = (paquetesFiltrados.length > 0 ? paquetesFiltrados : paquetes).map(p => ({
        'Registrador': p.registrador || 'N/A',
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
        'Fecha registro': p.fecha,
        'Fecha entrega': p.fechaEntrega || 'No entregado',
        'Fecha digitalización': p.fechaDigitalizacion || 'No digitalizado'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Paquetes");
    XLSX.writeFile(wb, `control_paquetes_${new Date().toISOString().slice(0,10)}.xlsx`);
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

    // renderiza solo los paquetes de la pagina
    paginaPaquetes.forEach(paquete => {
        const row = tablaPaquetes.insertRow();
        // Registrador
        row.insertCell(0).textContent = paquete.registrador || '-';
        // Código
        row.insertCell(1).textContent = paquete.codigo;

        row.insertCell(2).textContent = paquete.piezas || 1;
        // Dirección
        row.insertCell(3).textContent = paquete.direccion;

        // Repartidor
        const repartidorCell = row.insertCell(4);
        if (paquete.envio === 'Entrega en dirección') {
            const select = document.createElement('select');
            select.className = 'select-repartidor';
            select.innerHTML = `
                <option value="">Seleccionar</option>
                <option value="Repartidor 1">Repartidor 1</option>
                <option value="Repartidor 2">Repartidor 2</option>
                <option value="Repartidor 3">Repartidor 3</option>
                <option value="Repartidor 4">Repartidor 4</option>
                <option value="Repartidor 5">Repartidor 5</option>
            `;

            // Preseleccionar si ya tiene repartidor asignado
            if (paquete.repartidor) {
                select.value = paquete.repartidor;
            }

            // Contenedor para el segundo select (ubicación)
            const ubicacionContainer = document.createElement("div");

            select.addEventListener('change', async () => {
                await asignarRepartidor(paquete.codigo, select);

                // Si es Repartidor 4 -> mostrar segundo select
                ubicacionContainer.innerHTML = ""; // limpiar antes de agregar
                if (select.value === "Repartidor 4") {
                    const ubicacionSelect = document.createElement("select");
                    ubicacionSelect.innerHTML = `
                        <option value="">Seleccionar ubicación</option>
                        <option value="AL">AL</option>
                        <option value="SAN">SAN</option>
                    `;

                    // Preseleccionar si ya tiene destino
                    if (paquete.destino) {
                        ubicacionSelect.value = paquete.destino;
                    }

                    ubicacionSelect.addEventListener("change", async () => {
                        const ubicacion = ubicacionSelect.value;
                        if (ubicacion) {
                            paquete.destino = ubicacion;
                            const { db, updateDoc, doc } = window.firestore;
                            const paqueteRef = doc(db, "paquetes", paquete.id);
                            await updateDoc(paqueteRef, { destino: ubicacion });
                            actualizarTabla();
                        }
                    });

                    ubicacionContainer.appendChild(ubicacionSelect);
                }
            });

            repartidorCell.appendChild(select);
            repartidorCell.appendChild(ubicacionContainer);

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
        row.insertCell(9).textContent = paquete.fecha;
        
        row.insertCell(10).textContent = paquete.fechaEntrega || '-';

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
    const { db, collection, addDoc } = window.firestore;
    await addDoc(collection(db, "paquetes"), paquete);
    console.log("Paquete guardado en Firestore");
  } catch (e) {
    console.error("Error guardando en Firestore: ", e);
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

    // ⚠️ event.currentTarget no existe si llamas desde HTML con onclick
    // Lo cambiamos para que funcione
    const boton = Array.from(tabButtons).find(btn =>
        btn.getAttribute("onclick")?.includes(`'${tabName}'`)
    );
    if (boton) boton.classList.add("active");

    if (tabName === 'consulta') {
        actualizarTabla();
    }
}

// ✅ Hacemos la función global
window.openTab = openTab;


async function cargarPaquetesFirestore() {
  try {
    const { db, collection, getDocs } = window.firestore;
    const querySnapshot = await getDocs(collection(db, "paquetes"));
    paquetes = [];
    querySnapshot.forEach((doc) => {
      paquetes.push({ id: doc.id, ...doc.data() });
    });

    // inicializamos paginación
    paquetesFiltradosGlobal = paquetes.slice();
    paginaActual = 1;
    actualizarTabla(); // ahora actualizarTabla manejará la paginación
  } catch (e) {
    console.error("Error cargando paquetes: ", e);
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
    [
      'filtro-repartidor',
      'filtro-estado',
      'filtro-destino',
      'filtro-fecha-tipo',
      'filtro-fecha',
      'filtro-pago',        // 👈 nuevo
      'filtro-contenido',    // 👈 nuevo
      'filtro-envio'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', aplicarFiltros);
    });

  // Búsqueda por código en vivo
  const filtroCodigo = document.getElementById('filtro-codigo');
  if (filtroCodigo) filtroCodigo.addEventListener('input', aplicarFiltros);

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
    if (!docId) {
        alert("No hay paquete seleccionado para eliminar.");
        return;
    }

    if (!confirm("¿Seguro que deseas eliminar este paquete?")) {
        return;
    }

    try {
        const { db, deleteDoc, doc } = window.firestore; // 👈 importante
        await deleteDoc(doc(db, "paquetes", docId));

        alert("✅ Paquete eliminado correctamente.");
        document.getElementById("info-eliminar").classList.add("hidden");
        document.getElementById("codigo-eliminar").value = "";
    } catch (error) {
        console.error("Error eliminando paquete: ", error);
        alert("❌ Hubo un error al eliminar el paquete.");
    }
}

const PASSWORD_ELIMINAR = "ServientregaGerman123"; // <- cambia la contraseña si quieres

async function eliminarPaqueteConPassword() {
  try {
    // 1) pedir contraseña
    const inputPass = prompt("Ingrese la contraseña para eliminar el paquete:");
    if (inputPass === null) {
      // usuario canceló
      return;
    }
    if (inputPass !== PASSWORD_ELIMINAR) {
      alert("❌ Contraseña incorrecta. No se eliminó el paquete.");
      return;
    }

    // 2) obtener docId (si fue guardado por buscarPaqueteEliminar)
    const infoEl = document.getElementById("info-eliminar");
    const docId = infoEl?.dataset?.docId; // puede ser undefined
    const { db, doc, deleteDoc, collection, query, where, getDocs } = window.firestore;

    if (docId) {
      // eliminar directamente por ID (recomendado)
      await deleteDoc(doc(db, "paquetes", docId));
    } else {
      // si no tenemos docId, buscamos por el campo 'codigo' visible
      const codigo = (document.getElementById("eliminar-codigo").textContent || "").trim();
      if (!codigo) {
        alert("No hay paquete cargado para eliminar.");
        return;
      }

      // buscamos documentos que tengan ese codigo
      const paquetesRef = collection(db, "paquetes");
      const q = query(paquetesRef, where("codigo", "==", codigo));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert("No se encontró ningún documento con ese código en Firestore.");
        return;
      }

      // eliminamos todos los documentos que coincidan (si hay más de uno)
      const deletes = snapshot.docs.map(d => deleteDoc(doc(db, "paquetes", d.id)));
      await Promise.all(deletes);
    }

    // 3) post-eliminación: feedback y refrescar tabla
    alert("✅ Paquete eliminado correctamente.");
    if (infoEl) infoEl.classList.add("hidden");
    const inputCodigo = document.getElementById("codigo-eliminar");
    if (inputCodigo) inputCodigo.value = "";
    // recargamos desde Firestore para que la UI quede consistente
    if (typeof cargarPaquetesFirestore === "function") {
      cargarPaquetesFirestore();
    }
  } catch (error) {
    console.error("Error eliminando paquete (con password):", error);
    alert("❌ Ocurrió un error al eliminar el paquete. Revisa la consola.");
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
async function confirmarEdicion() {
    if (!confirm("¿Está seguro de que desea guardar los cambios?")) {
        return;
    }

    try {
        const { db, updateDoc, doc } = window.firestore;
        const paqueteRef = doc(db, "paquetes", paqueteEditando.id);
        
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
        
        // Actualizar en Firestore
        await updateDoc(paqueteRef, datosActualizados);
        
        alert("✅ Cambios guardados correctamente");
        cancelarEdicion();
        cargarPaquetesFirestore(); // Recargar datos
    } catch (error) {
        console.error("Error al guardar cambios:", error);
        alert("❌ Error al guardar los cambios");
    }
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


