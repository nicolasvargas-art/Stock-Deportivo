const $ = id => document.getElementById(id);

let inventario = [];
let usuarios = [];
let usuarioActual = null;

async function validarIngreso(ev) {
  if (ev) ev.preventDefault();
  const correo = $('correo')?.value;
  const clave  = $('clave')?.value;
  if (!correo || !clave) {
    alert('Por favor ingresa correo y clave');
    return false;
  }
  try {
    const r = await fetch('http://localhost:8080/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, clave })
    });
    if (r.ok) {
      const u = await r.json();
      localStorage.setItem('usuarioLogueado', JSON.stringify(u));
      alert('Ingreso exitoso, bienvenido ' + u.nombre);
      window.location.href = 'dashboard.html';
      return false;
    }
    if (r.status === 401) alert('Correo o clave incorrectos');
    else alert('Error en el servidor: ' + r.status);
    return false;
  } catch (e) {
    console.error(e);
    alert('No se pudo conectar con el servidor');
    return false;
  }
}

async function cargarUsuariosDesdeApi() {
  try {
    const r = await fetch('http://localhost:8080/api/usuarios');
    if (r.ok) usuarios = await r.json();
  } catch (e) {
    console.error('Error usuarios', e);
  }
}

async function cargarProductosDesdeApi() {
  try {
    const r = await fetch('http://localhost:8080/api/productos');
    if (r.ok) inventario = await r.json();
  } catch (e) {
    console.error('Error productos', e);
  }
}

window.onload = async () => {
  const esDashboard = !!$('menuTop');
  usuarioActual = JSON.parse(localStorage.getItem('usuarioLogueado') || 'null');
  if (!esDashboard) return;
  if (!usuarioActual) {
    location.href = 'inicio.html';
    return;
  }
  await cargarProductosDesdeApi();
  await cargarUsuariosDesdeApi();
  renderizarProductos();
  renderizarUsuarios();
  actualizarPanel();
  aplicarRestriccionesPorRol();
};

function cambiarVista(id) {
  document.querySelectorAll('.vista').forEach(v => v.classList.add('ocultar'));
  const v = $(id);
  if (v) v.classList.remove('ocultar');
}

function limpiarFormulario() {
  ['idProducto', 'producto', 'stock', 'precio'].forEach(id => {
    const el = $(id);
    if (el) el.value = '';
  });
}

async function guardarProducto() {
  const id     = $('idProducto').value;
  const nombre = $('producto').value.trim();
  const stock  = parseInt(($('stock').value || '').trim());
  const precio = parseFloat(($('precio')?.value || '').trim());

  if (!nombre || isNaN(stock) || isNaN(precio)) {
    alert('Completa nombre, stock y precio (números).');
    return;
  }
  if (stock < 0 || precio < 0) {
    alert('Stock y precio deben ser positivos.');
    return;
  }

  const p = { nombre, stock, precio };

  try {
    let r;
    if (id) {
      r = await fetch(`http://localhost:8080/api/productos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      });
    } else {
      r = await fetch('http://localhost:8080/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      });
    }
    if (!r.ok) {
      alert('Error al guardar producto: ' + r.status);
      return;
    }
    await cargarProductosDesdeApi();
    renderizarProductos();
    actualizarPanel();
    limpiarFormulario();
    alert('Producto guardado correctamente');
  } catch (e) {
    console.error(e);
    alert('No se pudo conectar con el servidor para guardar el producto');
  }
}

function renderizarProductos() {
  const cuerpo = $('lista-productos');
  const panel  = $('panel-lista');
  if (!cuerpo || !panel) return;

  cuerpo.innerHTML = '';
  panel.innerHTML  = '';

  inventario.forEach(prod => {
    const tr = document.createElement('tr');

    const tdNombre = document.createElement('td');
    tdNombre.textContent = prod.nombre;

    const tdStock  = document.createElement('td');
    tdStock.textContent  = prod.stock;

    const tdPrecio = document.createElement('td');
    tdPrecio.textContent = prod.precio != null ? `$ ${prod.precio.toFixed(2)}` : '$ 0.00';

    const tdAcc = document.createElement('td');
    const bE = document.createElement('button');
    bE.textContent = 'Editar';
    bE.className   = 'btn-accion btn-editar';
    bE.onclick     = () => editarProducto(prod.id);
    tdAcc.appendChild(bE);

    if (!usuarioActual || usuarioActual.rol === 'Administrador') {
      const bD = document.createElement('button');
      bD.textContent = 'Eliminar';
      bD.className   = 'btn-accion btn-eliminar';
      bD.onclick     = () => eliminarProducto(prod.id);
      tdAcc.appendChild(bD);
    }

    tr.append(tdNombre, tdStock, tdPrecio, tdAcc);
    cuerpo.appendChild(tr);

    const li = document.createElement('li');
    const valor = (prod.precio || 0) * prod.stock;
    li.textContent = `${prod.nombre} - Stock: ${prod.stock} - Precio: $${(prod.precio || 0).toFixed(2)} - Valor: $${valor.toFixed(2)}`;
    panel.appendChild(li);
  });
}

function editarProducto(id) {
  const p = inventario.find(x => x.id === id);
  if (!p) return;

  cambiarVista('productos');
  $('idProducto').value = p.id;
  $('producto').value   = p.nombre;
  $('stock').value      = p.stock;
  if ($('precio')) $('precio').value = p.precio ?? '';
}

async function eliminarProducto(id) {
  if (!confirm('¿Deseas eliminar este producto?')) return;

  try {
    const r = await fetch(`http://localhost:8080/api/productos/${id}`, { method: 'DELETE' });
    if (r.status !== 204 && r.status !== 200) {
      alert('Error al eliminar producto: ' + r.status);
      return;
    }
    await cargarProductosDesdeApi();
    renderizarProductos();
    actualizarPanel();
    alert('Producto eliminado correctamente');
  } catch (e) {
    console.error(e);
    alert('No se pudo conectar con el servidor para eliminar el producto');
  }
}

function filtrarProductos() {
  const q = $('busquedaProducto').value.toLowerCase();
  document.querySelectorAll('#lista-productos tr').forEach(f => {
    const nombre = f.cells[0].textContent.toLowerCase();
    f.style.display = nombre.includes(q) ? '' : 'none';
  });
}

function limpiarFormularioUsuario() {
  ['idUsuario', 'nombreUsuario', 'correoUsuario', 'rolUsuario', 'claveUsuario']
    .forEach(id => { const el = $(id); if (el) el.value = ''; });
}

async function guardarUsuario() {
  const id     = $('idUsuario').value;
  const nombre = $('nombreUsuario').value.trim();
  const correo = $('correoUsuario').value.trim();
  const rol    = $('rolUsuario').value.trim();
  const clave  = ($('claveUsuario')?.value || '').trim();

  if (!nombre || !correo || !rol || !clave) {
    alert('Completa todos los campos del usuario.');
    return;
  }

  if (!correo.includes('@') || !correo.includes('.')) {
    alert('Correo de usuario no válido.');
    return;
  }

  const rolNormalizado = rol.toLowerCase();
  if (rolNormalizado !== 'vendedor' && rolNormalizado !== 'administrador') {
    alert('El rol debe ser "Vendedor" o "Administrador".');
    return;
  }

  const rolFinal = rolNormalizado === 'vendedor' ? 'Vendedor' : 'Administrador';

  if (clave.length < 6) {
    alert('La contraseña debe tener mínimo 6 caracteres.');
    return;
  }

  const u = { nombre, correo, rol: rolFinal, clave };

  try {
    let r;
    if (id) {
      r = await fetch(`http://localhost:8080/api/usuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(u)
      });
    } else {
      r = await fetch('http://localhost:8080/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(u)
      });
    }
    if (!r.ok) {
      alert('Error al guardar usuario en el servidor: ' + r.status);
      return;
    }
    await cargarUsuariosDesdeApi();
    renderizarUsuarios();
    actualizarPanel();
    limpiarFormularioUsuario();
    alert('Usuario guardado correctamente');
  } catch (e) {
    console.error(e);
    alert('No se pudo conectar con el servidor para guardar el usuario');
  }
}

function renderizarUsuarios() {
  const cuerpo = $('lista-usuarios');
  if (!cuerpo) return;

  cuerpo.innerHTML = '';

  usuarios.forEach(u => {
    const tr = document.createElement('tr');

    const tdNombre = document.createElement('td');
    tdNombre.textContent = u.nombre;

    const tdCorreo = document.createElement('td');
    tdCorreo.textContent = u.correo;

    const tdRol = document.createElement('td');
    tdRol.textContent = u.rol;

    const tdAcc = document.createElement('td');

    if (!usuarioActual || usuarioActual.rol === 'Administrador') {
      const bE = document.createElement('button');
      bE.textContent = 'Editar';
      bE.className   = 'btn-accion btn-editar';
      bE.onclick     = () => editarUsuario(u.id);

      const bD = document.createElement('button');
      bD.textContent = 'Eliminar';
      bD.className   = 'btn-accion btn-eliminar';
      bD.onclick     = () => eliminarUsuario(u.id);

      tdAcc.append(bE, bD);
    } else {
      tdAcc.textContent = 'Sin permisos';
    }

    tr.append(tdNombre, tdCorreo, tdRol, tdAcc);
    cuerpo.appendChild(tr);
  });
}

function editarUsuario(id) {
  const u = usuarios.find(x => x.id === id);
  if (!u) return;

  cambiarVista('usuarios');
  $('idUsuario').value     = u.id;
  $('nombreUsuario').value = u.nombre;
  $('correoUsuario').value = u.correo;
  $('rolUsuario').value    = u.rol;
  if ($('claveUsuario')) $('claveUsuario').value = u.clave || '';
}

async function eliminarUsuario(id) {
  if (!confirm('¿Deseas eliminar este usuario?')) return;

  try {
    const r = await fetch(`http://localhost:8080/api/usuarios/${id}`, { method: 'DELETE' });
    if (r.status !== 204 && r.status !== 200) {
      alert('Error al eliminar usuario: ' + r.status);
      return;
    }
    await cargarUsuariosDesdeApi();
    renderizarUsuarios();
    actualizarPanel();
    alert('Usuario eliminado correctamente');
  } catch (e) {
    console.error(e);
    alert('No se pudo conectar con el servidor para eliminar el usuario');
  }
}

function filtrarUsuarios() {
  const q = $('busquedaUsuario')?.value.toLowerCase() || '';
  document.querySelectorAll('#lista-usuarios tr').forEach(f => {
    const nombre = f.cells[0].textContent.toLowerCase();
    const correo = f.cells[1].textContent.toLowerCase();
    const rol    = f.cells[2].textContent.toLowerCase();
    f.style.display = (nombre.includes(q) || correo.includes(q) || rol.includes(q)) ? '' : 'none';
  });
}

function aplicarRestriccionesPorRol() {
  if (!usuarioActual) return;
  if (usuarioActual.rol === 'Vendedor') {
    const menuUsuarios = document.querySelector("nav ul li[onclick*='usuarios']");
    if (menuUsuarios) menuUsuarios.style.display = 'none';
    const seccionUsuarios = $('usuarios');
    if (seccionUsuarios) seccionUsuarios.style.display = 'none';
  }
}

function actualizarPanel() {
  const totalProductos  = inventario.length;
  const stockTotal      = inventario.reduce((s, p) => s + (p.stock || 0), 0);
  const totalUsuarios   = usuarios.length;
  const valorInventario = inventario.reduce((s, p) => s + (p.precio || 0) * (p.stock || 0), 0);

  if ($('total-productos'))  $('total-productos').textContent  = totalProductos;
  if ($('stock-total'))      $('stock-total').textContent      = stockTotal;
  if ($('total-usuarios'))   $('total-usuarios').textContent   = totalUsuarios;
  if ($('valor-inventario')) $('valor-inventario').textContent = `$ ${valorInventario.toFixed(2)}`;
}
