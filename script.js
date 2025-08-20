let paquetes = [];
let paquetesFiltrados = [];
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
        repartidor: '', // Inicialmente sin repartidor asignado
        intentos: 3,
        estado: 'Pendiente',
        fecha: new Date().toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
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
    const { db, updateDoc, doc } = window.firestore;
    const paqueteRef = doc(db, "paquetes", paquete.id);
    await updateDoc(paqueteRef, { repartidor: repartidor });
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


function eliminarPaquete() {
    let codigo = document.getElementById("buscar-codigo").value.trim();

    if (!codigo) {
        alert("Por favor, ingresa un código de pedido.");
        return;
    }

    let paquetes = JSON.parse(localStorage.getItem("paquetes")) || [];

    // Buscar índice del paquete
    let index = paquetes.findIndex(p => p.codigo === codigo);

    if (index === -1) {
        alert("❌ Paquete no encontrado.");
        return;
    }

    // Mostrar info antes de eliminar
    let paquete = paquetes[index];
    document.getElementById("info-paquete").classList.remove("hidden");
    document.getElementById("info-codigo").textContent = paquete.codigo;
    document.getElementById("info-direccion").textContent = paquete.direccion;
    document.getElementById("info-intentos").textContent = paquete.intentos;

    // Confirmación
    if (confirm(`¿Seguro que deseas eliminar el paquete con código ${codigo}?`)) {
        paquetes.splice(index, 1); // Eliminar del array
        localStorage.setItem("paquetes", JSON.stringify(paquetes));
        alert("✅ Paquete eliminado correctamente.");
        document.getElementById("info-paquete").classList.add("hidden");
        document.getElementById("buscar-codigo").value = "";
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

    // Filtro por fecha
    if (fecha && fechaTipo !== 'todas') {
        const fechaFiltro = new Date(fecha);
        fechaFiltro.setHours(0, 0, 0, 0);

        paquetesFiltrados = paquetesFiltrados.filter(p => {
            if (!p.fecha) return false; // si no tiene fecha lo descartamos
            
            const [day, month, year] = p.fecha.split('/');
            if (!day || !month || !year) return false; // control de error

            const fechaPaquete = new Date(`${year}-${month}-${day}`);
            fechaPaquete.setHours(0, 0, 0, 0);

            switch (fechaTipo) {
                case 'antes':
                    return fechaPaquete < fechaFiltro;
                case 'despues':
                    return fechaPaquete > fechaFiltro;
                case 'igual':
                    return fechaPaquete.getTime() === fechaFiltro.getTime();
                default:
                    return true;
            }
        });
    }

    actualizarTabla(paquetesFiltrados);
}

// Exportar a Excel los resultados filtrados
function exportarExcelFiltrado() {
    const data = (paquetesFiltrados.length > 0 ? paquetesFiltrados : paquetes).map(p => ({
        'Código': p.codigo,
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

// Limpiar filtros
function limpiarFiltros() {
    document.getElementById('filtro-repartidor').value = 'Todos';
    document.getElementById('filtro-codigo').value = '';
    document.getElementById('filtro-estado').value = 'Todos';
    document.getElementById('filtro-destino').value = 'Todos';
    document.getElementById('filtro-fecha-tipo').value = 'todas';
    document.getElementById('filtro-fecha').value = '';
    document.getElementById('filtro-pago').value = 'Todos';
    document.getElementById('filtro-contenido').value = 'Todos';
    
    paquetesFiltrados = [];
    actualizarTabla();
}

// Actualizar tabla de paquetes
function actualizarTabla(paquetesMostrar = paquetes) {
    tablaPaquetes.innerHTML = '';
    
    paquetesMostrar.forEach(paquete => {
        const row = tablaPaquetes.insertRow();

        // Código
        row.insertCell(0).textContent = paquete.codigo;

        // Dirección
        row.insertCell(1).textContent = paquete.direccion;

        // Repartidor
        const repartidorCell = row.insertCell(2);
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

            select.addEventListener('change', () => {
                asignarRepartidor(paquete.codigo, select);
            });

            repartidorCell.appendChild(select);
        } else {
            repartidorCell.textContent = 'N/A';
        }

        // Destino
        row.insertCell(3).textContent = paquete.destino || 'No aplica';

        // Método de pago
        row.insertCell(4).textContent = paquete.pago || 'N/A';

        // Contenido
        row.insertCell(5).textContent = paquete.contenido || 'N/A';

        // Intentos
        row.insertCell(6).textContent = paquete.intentos;

        // Fecha
        row.insertCell(7).textContent = paquete.fecha;

        // Estado
        const estadoCell = row.insertCell(8);
        estadoCell.textContent = paquete.estado;

        // Acciones
        const accionCell = row.insertCell(9);
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
    
    actualizarResumen(paquetesMostrar);
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


// Cambiar entre pestañas
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
    event.currentTarget.classList.add('active');
    
    if (tabName === 'consulta') {
        actualizarTabla();
    }
}

async function cargarPaquetesFirestore() {
  try {
    const { db, collection, getDocs } = window.firestore;
    const querySnapshot = await getDocs(collection(db, "paquetes"));
    paquetes = [];
    querySnapshot.forEach((doc) => {
      paquetes.push({ id: doc.id, ...doc.data() });
    });
    actualizarTabla();
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
      'filtro-contenido'    // 👈 nuevo
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', aplicarFiltros);
    });

  // Búsqueda por código en vivo
  const filtroCodigo = document.getElementById('filtro-codigo');
  if (filtroCodigo) filtroCodigo.addEventListener('input', aplicarFiltros);
});