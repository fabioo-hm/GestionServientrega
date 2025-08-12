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
        direccion = document.getElementById('direccion').value;
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
function buscarPaquete() {
    const codigo = document.getElementById('buscar-codigo').value;
    const paquete = paquetes.find(p => p.codigo === codigo);
    
    if (paquete) {
        document.getElementById('info-codigo').textContent = paquete.codigo;
        document.getElementById('info-direccion').textContent = paquete.direccion || 'Retiro en oficina';
        document.getElementById('info-intentos').textContent = paquete.intentos;
        document.getElementById('nuevos-intentos').value = paquete.intentos;
        document.getElementById('info-paquete').classList.remove('hidden');
    } else {
        alert('Paquete no encontrado');
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
    paquetesFiltrados = paquetes;
    const repartidor = document.getElementById('filtro-repartidor').value;
    const codigo = document.getElementById('filtro-codigo').value;
    const estado = document.getElementById('filtro-estado').value;
    const destino = document.getElementById('filtro-destino').value;
    const fechaTipo = document.getElementById('filtro-fecha-tipo').value;
    const fecha = document.getElementById('filtro-fecha').value;
    
    // Filtro por repartidor
    if (repartidor !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p => p.repartidor === repartidor);
    }
    
    // Filtro por código
    if (codigo) {
        paquetesFiltrados = paquetesFiltrados.filter(p => 
            p.codigo.toLowerCase().includes(codigo.toLowerCase())
        );
    }
    
    // Filtro por estado
    if (estado !== 'Todos') {
        paquetesFiltrados = paquetesFiltrados.filter(p => p.estado === estado);
    }
    
    // Filtro por destino
    if (destino !== 'Todos') {
        if (destino === 'No aplica') {
            paquetesFiltrados = paquetesFiltrados.filter(p => !p.destino);
        } else {
            paquetesFiltrados = paquetesFiltrados.filter(p => p.destino === destino);
        }
    }
    
    // Filtro por fecha
    if (fecha && fechaTipo !== 'todas') {
        const fechaFiltro = new Date(fecha);
        fechaFiltro.setHours(0, 0, 0, 0);
        
        paquetesFiltrados = paquetesFiltrados.filter(p => {
            const [day, month, year] = p.fecha.split('/');
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
        'Dirección': p.direccion || 'Retiro en oficina',
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
    
    paquetesFiltrados = [];
    actualizarTabla();
}

// Actualizar tabla de paquetes
function actualizarTabla(paquetesMostrar = paquetes) {
    tablaPaquetes.innerHTML = '';
    
    paquetesMostrar.forEach(paquete => {
        const row = tablaPaquetes.insertRow();
        row.insertCell(0).textContent = paquete.codigo;
        row.insertCell(1).textContent = paquete.direccion || 'Retiro en oficina';
        
        const repartidorCell = row.insertCell(2);
        
        // Select para asignar repartidor
        if (!paquete.repartidor && paquete.envio === 'Entrega en dirección') {
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
            select.addEventListener('change', () => {
                asignarRepartidor(paquete.codigo, select);
            });
            repartidorCell.appendChild(select);
        } else {
            repartidorCell.textContent = paquete.repartidor || 'N/A';
        }
        
        row.insertCell(3).textContent = paquete.destino || 'No aplica';
        row.insertCell(4).textContent = paquete.intentos;
        row.insertCell(5).textContent = paquete.fecha;
        
        const estadoCell = row.insertCell(6);
        estadoCell.textContent = paquete.estado;
        
        const accionCell = row.insertCell(7);
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
    const datos = XLSX.utils.sheet_to_json(hoja);

    if (datos.length === 0) {
      alert("El archivo está vacío o mal estructurado.");
      return;
    }

    // Validar que exista columna 'Código'
    if (!('Código' in datos[0])) {
      alert("La hoja debe tener una columna llamada 'Código'.");
      return;
    }

    // Códigos en Excel y Firestore
    const codigosExcel = datos.map(row => String(row['Código']).trim());
    // Códigos en Excel y paquetes actualmente mostrados (filtrados o todos)
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
});