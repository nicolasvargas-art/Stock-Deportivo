// ==== Utilidades ====
const $ = id => document.getElementById(id);
const leerJSON = k => JSON.parse(localStorage.getItem(k) || "[]");
const guardarJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ==== Estado global ====
let inventario = [];
let usuarios = [];
let usuarioActual = null;

// ==== Login (BACKEND) ====
async function validarIngreso(ev) {
  
  if (ev) ev.preventDefault();

  const correo = document.getElementById('correo').value;
  const clave  = document.getElementById('clave').value;

  if (!correo || !clave) {
    alert('Por favor ingresa correo y clave');
    return false;
  }

  try {
    const respuesta = await fetch('http://localhost:8080/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ correo, clave })
    });

    if (respuesta.ok) {
      const usuario = await respuesta.json();
      // Guardar usuario logueado
      localStorage.setItem('usuarioLogueado', JSON.stringify(usuario));
      alert('Ingreso exitoso, bienvenido ' + usuario.nombre);
      // Redirigir a dashboard
      window.location.href = 'dashboard.html';
      return false;
    } else if (respuesta.status === 401) {
      alert('Correo o clave incorrectos');
      return false;
    } else {
      alert('Error en el servidor: ' + respuesta.status);
      return false;
    }
  } catch (error) {
    console.error(error);
    alert('No se pudo conectar con el servidor');
    return false;
  }
}

// ==== Cargar usuarios desde la API ====
async function cargarUsuariosDesdeApi() {
  try {
    const resp = await fetch('http://localhost:8080/api/usuarios');
    if (!resp.ok) {
      console.error('Error HTTP al cargar usuarios:', resp.status);
      return;
    }
    usuarios = await resp.json();
  } catch (e) {
    console.error('Error al conectar con la API de usuarios', e);
  }
}

// ==== Inicialización (login o dashboard) ====
window.onload = async () => {
  const esDashboard = !!$("menuTop");

  // Inventario sigue en localStorage
  inventario = leerJSON("inventario");

  // Usuario actual, leído del login previo
  usuarioActual = JSON.parse(localStorage.getItem("usuarioLogueado") || "null");

  if (!esDashboard) {
   
    return;
  }

  if (!usuarioActual) {
    // Si no hay usuario logueado, envía a login
    location.href = "inicio.html";
    return;
  }

  
  await cargarUsuariosDesdeApi();

  renderizarProductos();
  renderizarUsuarios();
  actualizarPanel();
  aplicarRestriccionesPorRol();
};

// ==== Menú hamburguesa ====
function toggleMenu(forzar) {
  const menu = $("menuTop");
  if (!menu) return;
  if (typeof forzar === "boolean") menu.classList.toggle("visible", forzar);
  else menu.classList.toggle("visible");
}

document.addEventListener("click", e => {
  const menu = $("menuTop");
  const btn  = document.querySelector(".btn-menu");
  if (!menu || !btn) return;
  if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove("visible");
});

// ==== Vistas ====
function cambiarVista(id) {
  document.querySelectorAll(".vista").forEach(v => v.classList.add("ocultar"));
  const vista = $(id);
  if (vista) vista.classList.remove("ocultar");
}

// ==== Productos (solo localStorage de momento) ====
function limpiarFormulario() {
  ["idProducto", "producto", "stock", "precio"].forEach(id => { const el = $(id); if (el) el.value = ""; });
}

function guardarProducto() {
  const id     = $("idProducto").value;
  const nombre = $("producto").value.trim();
  const stock  = parseInt($("stock").value.trim());
  const precio = parseFloat(($("precio")?.value || "").trim());

  if (!nombre || isNaN(stock) || isNaN(precio)) return alert("Completa nombre, stock y precio (números).");
  if (stock < 0 || precio < 0) return alert("Stock y precio deben ser positivos.");

  if (id) {
    const i = inventario.findIndex(p => p.id === Number(id));
    if (i !== -1) { inventario[i].nombre = nombre; inventario[i].stock = stock; inventario[i].precio = precio; }
  } else {
    inventario.push({ id: Date.now(), nombre, stock, precio });
  }

  guardarJSON("inventario", inventario);
  renderizarProductos();
  actualizarPanel();
  limpiarFormulario();
}

function renderizarProductos() {
  const cuerpo     = $("lista-productos");
  const panelLista = $("panel-lista");
  if (!cuerpo || !panelLista) return;

  cuerpo.innerHTML = "";
  panelLista.innerHTML = "";

  inventario.forEach(prod => {
    const tr = document.createElement("tr");

    const tdNombre = document.createElement("td");
    tdNombre.textContent = prod.nombre;

    const tdStock = document.createElement("td");
    tdStock.textContent = prod.stock;

    const tdPrecio = document.createElement("td");
    tdPrecio.textContent = prod.precio != null ? `$ ${prod.precio.toFixed(2)}` : "$ 0.00";

    const tdAcciones = document.createElement("td");
    const btnEditar  = document.createElement("button");
    btnEditar.textContent = "Editar";
    btnEditar.className   = "btn-accion btn-editar";
    btnEditar.onclick     = () => editarProducto(prod.id);
    tdAcciones.appendChild(btnEditar);

    if (!usuarioActual || usuarioActual.rol === "Administrador") {
      const btnEliminar = document.createElement("button");
      btnEliminar.textContent = "Eliminar";
      btnEliminar.className   = "btn-accion btn-eliminar";
      btnEliminar.onclick     = () => eliminarProducto(prod.id);
      tdAcciones.appendChild(btnEliminar);
    }

    tr.append(tdNombre, tdStock, tdPrecio, tdAcciones);
    cuerpo.appendChild(tr);

    const li    = document.createElement("li");
    const valor = (prod.precio || 0) * prod.stock;
    li.textContent = `${prod.nombre} - Stock: ${prod.stock} - Precio: $${(prod.precio || 0).toFixed(2)} - Valor: $${valor.toFixed(2)}`;
    panelLista.appendChild(li);
  });
}

function editarProducto(id) {
  const p = inventario.find(x => x.id === id);
  if (!p) return;
  cambiarVista("productos");
  $("idProducto").value = p.id;
  $("producto").value   = p.nombre;
  $("stock").value      = p.stock;
  if ($("precio")) $("precio").value = p.precio ?? "";
}

function eliminarProducto(id) {
  if (!confirm("¿Deseas eliminar este producto?")) return;
  inventario = inventario.filter(p => p.id !== id);
  guardarJSON("inventario", inventario);
  renderizarProductos();
  actualizarPanel();
}

function filtrarProductos() {
  const q = $("busquedaProducto").value.toLowerCase();
  document.querySelectorAll("#lista-productos tr").forEach(f => {
    const nombre = f.cells[0].textContent.toLowerCase();
    f.style.display = nombre.includes(q) ? "" : "none";
  });
}

// ==== Usuarios (lista desde API, edición local de momento) ====
function limpiarFormularioUsuario() {
  ["idUsuario", "nombreUsuario", "correoUsuario", "rolUsuario", "claveUsuario"]
    .forEach(id => { const el = $(id); if (el) el.value = ""; });
}

function guardarUsuario() {
  // OJO: ahora mismo esto solo actualiza el arreglo local y localStorage
  // En el futuro lo cambiamos para llamar POST/PUT a la API /api/usuarios
  const id     = $("idUsuario").value;
  const nombre = $("nombreUsuario").value.trim();
  const correo = $("correoUsuario").value.trim();
  const rol    = $("rolUsuario").value.trim();
  const clave  = ($("claveUsuario")?.value || "").trim();

  if (!nombre || !correo || !rol || !clave) return alert("Completa todos los campos del usuario.");
  if (!correo.includes("@") || !correo.includes(".")) return alert("Correo de usuario no válido.");

  if (id) {
    const i = usuarios.findIndex(u => u.id === Number(id));
    if (i !== -1) { usuarios[i] = { ...usuarios[i], nombre, correo, rol, clave }; }
  } else {
    usuarios.push({ id: Date.now(), nombre, correo, rol, clave });
  }

  // Esto ya no sincroniza con la BD; solo localStorage
  guardarJSON("usuarios", usuarios);
  renderizarUsuarios();
  actualizarPanel();
  limpiarFormularioUsuario();
}

function renderizarUsuarios() {
  const cuerpo = $("lista-usuarios");
  if (!cuerpo) return;

  cuerpo.innerHTML = "";

  usuarios.forEach(u => {
    const tr = document.createElement("tr");

    const tdNombre = document.createElement("td"); tdNombre.textContent = u.nombre;
    const tdCorreo = document.createElement("td"); tdCorreo.textContent = u.correo;
    const tdRol    = document.createElement("td"); tdRol.textContent    = u.rol;
    const tdAcc    = document.createElement("td");

    if (!usuarioActual || usuarioActual.rol === "Administrador") {
      const bE = document.createElement("button");
      bE.textContent = "Editar";
      bE.className   = "btn-accion btn-editar";
      bE.onclick     = () => editarUsuario(u.id);

      const bD = document.createElement("button");
      bD.textContent = "Eliminar";
      bD.className   = "btn-accion btn-eliminar";
      bD.onclick     = () => eliminarUsuario(u.id);

      tdAcc.append(bE, bD);
    } else {
      tdAcc.textContent = "Sin permisos";
    }

    tr.append(tdNombre, tdCorreo, tdRol, tdAcc);
    cuerpo.appendChild(tr);
  });
}

function editarUsuario(id) {
  const u = usuarios.find(x => x.id === id);
  if (!u) return;
  cambiarVista("usuarios");
  $("idUsuario").value      = u.id;
  $("nombreUsuario").value  = u.nombre;
  $("correoUsuario").value  = u.correo;
  $("rolUsuario").value     = u.rol;
  if ($("claveUsuario")) $("claveUsuario").value = u.clave || "";
}

function eliminarUsuario(id) {
  if (!confirm("¿Deseas eliminar este usuario?")) return;
  usuarios = usuarios.filter(u => u.id !== id);
  guardarJSON("usuarios", usuarios);
  renderizarUsuarios();
  actualizarPanel();
}

function filtrarUsuarios() {
  const q = $("busquedaUsuario").value.toLowerCase();
  document.querySelectorAll("#lista-usuarios tr").forEach(f => {
    const nombre = f.cells[0].textContent.toLowerCase();
    const correo = f.cells[1].textContent.toLowerCase();
    const rol    = f.cells[2].textContent.toLowerCase();
    f.style.display = (nombre.includes(q) || correo.includes(q) || rol.includes(q)) ? "" : "none";
  });
}

// ==== Permisos por rol ====
function aplicarRestriccionesPorRol() {
  if (!usuarioActual) return;
  if (usuarioActual.rol === "Vendedor") {
    const menuUsuarios = document.querySelector("nav ul li[onclick*='usuarios']");
    if (menuUsuarios) menuUsuarios.style.display = "none";
    const seccionUsuarios = $("usuarios");
    if (seccionUsuarios) seccionUsuarios.style.display = "none";
  }
}

// ==== Panel resumen ====
function actualizarPanel() {
  const totalProductos  = inventario.length;
  const stockTotal      = inventario.reduce((s, p) => s + p.stock, 0);
  const totalUsuarios   = usuarios.length;
  const valorInventario = inventario.reduce((s, p) => s + (p.precio || 0) * p.stock, 0);

  if ($("total-productos")) $("total-productos").textContent = totalProductos;
  if ($("stock-total"))     $("stock-total").textContent     = stockTotal;
  if ($("total-usuarios"))  $("total-usuarios").textContent  = totalUsuarios;
  if ($("valor-inventario")) $("valor-inventario").textContent = `$ ${valorInventario.toFixed(2)}`;
}
