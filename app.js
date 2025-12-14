/* =========================================
   ALSET Irrigation Systems — ERP (Demo)
   - CRUD: clientes, proveedores, inventario, ventas, facturas, empleados
   - Asistencias (check-in/out)
   - Reportes por fecha + export CSV
   - Analíticas: top clientes/productos + margen estimado
   - Persistencia: localStorage
========================================= */

const DB_KEY = "ALSET_ERP_DB_v1";

const $$ = (sel, root=document) => root.querySelector(sel);
const $$$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const nowISO = () => new Date().toISOString();
const dateOnlyISO = (d=new Date()) => d.toISOString().slice(0,10);

function uid(prefix="id"){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function money(n, currency){
  const c = currency || getDB().config.currency || "MXN";
  try{
    return new Intl.NumberFormat("es-MX", { style:"currency", currency:c }).format(n || 0);
  }catch{
    return `$${(n||0).toFixed(2)}`;
  }
}

function parseNum(v){
  const n = Number(String(v).replace(/,/g,"."));
  return Number.isFinite(n) ? n : 0;
}

function withinRange(isoDate, days){
  if(days === "all") return true;
  const d = new Date(isoDate);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Number(days));
  return d >= cutoff;
}

function download(filename, text){
  const blob = new Blob([text], {type:"text/plain;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 600);
}

/* ---------------- DB ---------------- */

function defaultDB(){
  return {
    config: {
      companyName: "ALSET Irrigation Systems",
      currency: "MXN",
      iva: 16
    },
    clientes: [],
    proveedores: [],
    inventario: [],     // {id, sku, nombre, categoria, costo, precio, stock, minStock, proveedorId}
    movimientos: [],    // {id, fecha, tipo, productoId, qty, nota}
    ventas: [],         // {id, fecha, folio, clienteId, items:[{productoId, qty, precio, costo}], status, notas}
    facturas: [],       // {id, fecha, folio, ventaId, clienteId, subtotal, iva, total, status, pagado}
    empleados: [],      // {id, nombre, puesto, salarioMensual}
    recibos: [],        // {id, fecha, empleadoId, bruto, deducciones, neto, notas}
    asistencias: []     // {id, fecha, empleadoId, checkIn, checkOut, minutosTarde}
  };
}

function getDB(){
  const raw = localStorage.getItem(DB_KEY);
  if(!raw) return defaultDB();
  try{
    const parsed = JSON.parse(raw);
    return {...defaultDB(), ...parsed};
  }catch{
    return defaultDB();
  }
}

function setDB(db){
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function resetDB(){
  localStorage.removeItem(DB_KEY);
}

/* ---------------- UI: Views ---------------- */

function setView(view){
  $$$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  $$$(".view").forEach(sec => sec.classList.add("hidden"));
  const el = $$(`#view-${view}`);
  if(el) el.classList.remove("hidden");
  renderAll();
}

$$$(".nav-item").forEach(btn=>{
  btn.addEventListener("click", ()=> setView(btn.dataset.view));
});

$$$("[data-jump]").forEach(btn=>{
  btn.addEventListener("click", ()=> setView(btn.dataset.jump));
});

/* ---------------- Modal helpers ---------------- */

const modal = $$("#modal");
const modalTitle = $$("#modalTitle");
const modalBody = $$("#modalBody");
const modalFoot = $$("#modalFoot");
const modalClose = $$("#modalClose");

function openModal(title, bodyHTML, footHTML){
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHTML || "";
  modalFoot.innerHTML = footHTML || "";
  modal.classList.remove("hidden");
}

function closeModal(){
  modal.classList.add("hidden");
  modalBody.innerHTML = "";
  modalFoot.innerHTML = "";
}

modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", (e)=>{ if(e.target === modal) closeModal(); });

/* ---------------- Seed demo ---------------- */

function seedDemo(){
  const db = getDB();
  if(db.clientes.length || db.inventario.length) return;

  // Clientes
  const c1 = {id:uid("cli"), nombre:"Rancho El Mezquite", telefono:"", email:"", direccion:"", saldo:0};
  const c2 = {id:uid("cli"), nombre:"AgroServicios La Cima", telefono:"", email:"", direccion:"", saldo:0};
  db.clientes.push(c1,c2);

  // Proveedores
  const p1 = {id:uid("prov"), nombre:"HydroParts MX", telefono:"", email:"", direccion:"", condiciones:"30 días"};
  const p2 = {id:uid("prov"), nombre:"ElectroPump Supply", telefono:"", email:"", direccion:"", condiciones:"Contado"};
  db.proveedores.push(p1,p2);

  // Inventario
  const i1 = {id:uid("prd"), sku:"VAL-001", nombre:"Válvula 2” PVC", categoria:"Conexiones", costo:120, precio:210, stock:28, minStock:10, proveedorId:p1.id};
  const i2 = {id:uid("prd"), sku:"PMP-075", nombre:"Bomba 7.5HP", categoria:"Bombas", costo:9800, precio:13800, stock:3, minStock:4, proveedorId:p2.id};
  const i3 = {id:uid("prd"), sku:"TUB-160", nombre:"Tubería 160 PSI (rollo)", categoria:"Tubería", costo:740, precio:1120, stock:12, minStock:6, proveedorId:p1.id};
  db.inventario.push(i1,i2,i3);

  db.movimientos.push(
    {id:uid("mov"), fecha:dateOnlyISO(), tipo:"entrada", productoId:i1.id, qty:28, nota:"Inventario inicial"},
    {id:uid("mov"), fecha:dateOnlyISO(), tipo:"entrada", productoId:i2.id, qty:3, nota:"Inventario inicial"},
    {id:uid("mov"), fecha:dateOnlyISO(), tipo:"entrada", productoId:i3.id, qty:12, nota:"Inventario inicial"},
  );

  // Empleados
  const e1 = {id:uid("emp"), nombre:"Luis Ramírez", puesto:"Técnico", salarioMensual:14500};
  const e2 = {id:uid("emp"), nombre:"Karla N.", puesto:"Administración", salarioMensual:13200};
  db.empleados.push(e1,e2);

  // Ventas + Facturas
  const v1 = {
    id:uid("ven"),
    fecha: new Date(Date.now()-8*86400000).toISOString().slice(0,10),
    folio:"V-0001",
    clienteId:c1.id,
    status:"cerrada",
    notas:"Instalación incluida",
    items:[
      {productoId:i2.id, qty:1, precio:i2.precio, costo:i2.costo},
      {productoId:i1.id, qty:4, precio:i1.precio, costo:i1.costo}
    ]
  };
  db.ventas.push(v1);

  // Descontar stock por venta cerrada
  applySaleStock(db, v1, -1);

  const totals = saleTotals(db, v1);
  const f1 = {
    id:uid("fac"),
    fecha:v1.fecha,
    folio:"F-1001",
    ventaId:v1.id,
    clienteId:v1.clienteId,
    subtotal: totals.subtotal,
    iva: totals.iva,
    total: totals.total,
    status:"emitida",
    pagado: false
  };
  db.facturas.push(f1);

  setDB(db);
}

/* ---------------- Business logic ---------------- */

function findById(arr, id){ return arr.find(x=>x.id===id); }

function saleTotals(db, venta){
  const ivaPct = parseNum(db.config.iva)/100;
  const subtotal = (venta.items||[]).reduce((acc,it)=> acc + parseNum(it.precio)*parseNum(it.qty), 0);
  const iva = subtotal * ivaPct;
  const total = subtotal + iva;
  const costo = (venta.items||[]).reduce((acc,it)=> acc + parseNum(it.costo)*parseNum(it.qty), 0);
  const margen = subtotal - costo;
  return {subtotal, iva, total, costo, margen};
}

function applySaleStock(db, venta, direction){
  // direction -1 = sale reduces stock, +1 = revert sale
  (venta.items||[]).forEach(it=>{
    const prd = findById(db.inventario, it.productoId);
    if(prd){
      prd.stock = clamp(parseNum(prd.stock) + direction*parseNum(it.qty), 0, 1e9);
      db.movimientos.push({
        id:uid("mov"),
        fecha: venta.fecha || dateOnlyISO(),
        tipo: direction<0 ? "salida" : "entrada",
        productoId: prd.id,
        qty: parseNum(it.qty),
        nota: direction<0 ? `Venta ${venta.folio}` : `Reverso ${venta.folio}`
      });
    }
  });
}

function ensureFolio(prefix, arr, field="folio"){
  const nums = arr
    .map(x => String(x[field]||"").match(/\d+/)?.[0])
    .filter(Boolean)
    .map(Number);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(next).padStart(4,"0")}`;
}

/* ---------------- Render helpers ---------------- */

function renderTable(el, columns, rows){
  // columns: [{key, label, render?}]
  const thead = `<thead><tr>${columns.map(c=>`<th>${c.label}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${
    rows.map(r=>`<tr>${
      columns.map(c=>{
        const v = c.render ? c.render(r) : (r[c.key] ?? "");
        return `<td>${v}</td>`;
      }).join("")
    }</tr>`).join("")
  }</tbody>`;
  el.innerHTML = thead + tbody;
}

function badge(status){
  const s = String(status||"").toLowerCase();
  if(["pagada","cerrada","activo"].includes(s)) return `<span class="badge ok">${status}</span>`;
  if(["pendiente","borrador"].includes(s)) return `<span class="badge warn">${status}</span>`;
  if(["cancelada","vencida","baja"].includes(s)) return `<span class="badge danger">${status}</span>`;
  return `<span class="badge">${status}</span>`;
}

function actionBtns(btns){
  return btns.map(b=>`<button class="btn small ${b.kind||"ghost"}" data-act="${b.act}" data-id="${b.id}">${b.label}</button>`).join(" ");
}

function hookActions(tableEl, handlers){
  // handlers: {actName: (id)=>{}}
  tableEl.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-act]");
    if(!btn) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;
    if(handlers[act]) handlers[act](id);
  });
}

/* ---------------- Dashboard ---------------- */

function renderDashboard(){
  const db = getDB();
  const range = $$("#dashRange").value;
  const ventasFiltradas = db.ventas.filter(v=> withinRange(v.fecha, range));
  const factFiltradas = db.facturas.filter(f=> withinRange(f.fecha, range));

  const sumVentas = ventasFiltradas.reduce((acc,v)=> acc + saleTotals(db,v).total, 0);
  const criticos = db.inventario.filter(p=> parseNum(p.stock) < parseNum(p.minStock||0));
  const nomina = db.empleados.reduce((acc,e)=> acc + parseNum(e.salarioMensual), 0);

  $$("#kpiVentas").textContent = money(sumVentas, db.config.currency);
  $$("#kpiVentasSub").textContent = `${ventasFiltradas.length} venta(s) en periodo`;
  $$("#kpiFacturas").textContent = `${factFiltradas.length}`;
  $$("#kpiFacturasSub").textContent = `${factFiltradas.filter(f=>f.pagado).length} pagada(s)`;
  $$("#kpiCritico").textContent = `${criticos.length}`;
  $$("#kpiNomina").textContent = money(nomina, db.config.currency);

  // Últimas ventas
  const last = [...db.ventas].sort((a,b)=> (b.fecha||"").localeCompare(a.fecha||"")).slice(0,7);
  renderTable($$("#tblUltVentas"), [
    {label:"Fecha", key:"fecha"},
    {label:"Folio", key:"folio"},
    {label:"Cliente", render:(r)=> findById(db.clientes, r.clienteId)?.nombre || "—"},
    {label:"Estatus", render:(r)=> badge(r.status)},
    {label:"Total", render:(r)=> money(saleTotals(db,r).total, db.config.currency)}
  ], last);

  // Críticos
  renderTable($$("#tblCritico"), [
    {label:"SKU", key:"sku"},
    {label:"Producto", key:"nombre"},
    {label:"Stock", render:(r)=> `${r.stock}`},
    {label:"Mínimo", render:(r)=> `${r.minStock||0}`},
    {label:"Acción", render:(r)=> `<button class="btn small" data-jump="inventario">Revisar</button>`}
  ], criticos.slice(0,8));
}

/* ---------------- Clientes ---------------- */

function renderClientes(){
  const db = getDB();
  const q = ($$("#cliSearch")?.value || "").toLowerCase().trim();
  const rows = db.clientes
    .filter(c=> !q || (c.nombre||"").toLowerCase().includes(q))
    .map(c=>({
      ...c,
      saldo: parseNum(c.saldo||0)
    }));

  renderTable($$("#tblClientes"), [
    {label:"Nombre", key:"nombre"},
    {label:"Tel", key:"telefono"},
    {label:"Email", key:"email"},
    {label:"Saldo", render:(r)=> money(r.saldo, db.config.currency)},
    {label:"Acciones", render:(r)=> actionBtns([
      {label:"Editar", act:"edit", id:r.id},
      {label:"Eliminar", act:"del", id:r.id, kind:"danger"}
    ])}
  ], rows);

  hookActions($$("#tblClientes"), {
    edit: (id)=> openClienteForm(id),
    del: (id)=> deleteCliente(id),
  });
}

function openClienteForm(id){
  const db = getDB();
  const c = id ? findById(db.clientes, id) : {id:null, nombre:"", telefono:"", email:"", direccion:"", saldo:0};
  openModal(
    id ? "Editar cliente" : "Nuevo cliente",
    `
      <div class="form">
        <label>Nombre</label><input class="input" id="fCliNombre" value="${escapeHtml(c.nombre)}"/>
        <label>Teléfono</label><input class="input" id="fCliTel" value="${escapeHtml(c.telefono)}"/>
        <label>Email</label><input class="input" id="fCliEmail" value="${escapeHtml(c.email)}"/>
        <label>Dirección</label><input class="input" id="fCliDir" value="${escapeHtml(c.direccion||"")}"/>
        <label>Saldo (opcional)</label><input class="input" id="fCliSaldo" type="number" step="0.01" value="${parseNum(c.saldo)}"/>
      </div>
    `,
    `
      <button class="btn ghost" id="btnCancel">Cancelar</button>
      <button class="btn" id="btnSave">Guardar</button>
    `
  );
  $$("#btnCancel").onclick = closeModal;
  $$("#btnSave").onclick = ()=>{
    const db2 = getDB();
    const payload = {
      id: c.id || uid("cli"),
      nombre: $$("#fCliNombre").value.trim(),
      telefono: $$("#fCliTel").value.trim(),
      email: $$("#fCliEmail").value.trim(),
      direccion: $$("#fCliDir").value.trim(),
      saldo: parseNum($$("#fCliSaldo").value)
    };
    if(!payload.nombre) return alert("El nombre es obligatorio.");
    if(c.id){
      const idx = db2.clientes.findIndex(x=>x.id===c.id);
      db2.clientes[idx] = payload;
    }else{
      db2.clientes.push(payload);
    }
    setDB(db2);
    closeModal();
    renderAll();
  };
}

function deleteCliente(id){
  if(!confirm("¿Eliminar cliente?")) return;
  const db = getDB();
  db.clientes = db.clientes.filter(c=>c.id!==id);
  // mantener integridad simple: ventas/facturas quedan con nombre vacío
  setDB(db);
  renderAll();
}

/* ---------------- Proveedores ---------------- */

function renderProveedores(){
  const db = getDB();
  const q = ($$("#provSearch")?.value || "").toLowerCase().trim();
  const rows = db.proveedores
    .filter(p=> !q || (p.nombre||"").toLowerCase().includes(q));

  renderTable($$("#tblProveedores"), [
    {label:"Nombre", key:"nombre"},
    {label:"Tel", key:"telefono"},
    {label:"Email", key:"email"},
    {label:"Condiciones", render:(r)=> escapeHtml(r.condiciones||"—")},
    {label:"Acciones", render:(r)=> actionBtns([
      {label:"Editar", act:"edit", id:r.id},
      {label:"Eliminar", act:"del", id:r.id, kind:"danger"}
    ])}
  ], rows);

  hookActions($$("#tblProveedores"), {
    edit: (id)=> openProveedorForm(id),
    del: (id)=> deleteProveedor(id),
  });
}

function openProveedorForm(id){
  const db = getDB();
  const p = id ? findById(db.proveedores, id) : {id:null, nombre:"", telefono:"", email:"", direccion:"", condiciones:""};
  openModal(
    id ? "Editar proveedor" : "Nuevo proveedor",
    `
      <div class="form">
        <label>Nombre</label><input class="input" id="fProvNombre" value="${escapeHtml(p.nombre)}"/>
        <label>Teléfono</label><input class="input" id="fProvTel" value="${escapeHtml(p.telefono)}"/>
        <label>Email</label><input class="input" id="fProvEmail" value="${escapeHtml(p.email)}"/>
        <label>Dirección</label><input class="input" id="fProvDir" value="${escapeHtml(p.direccion||"")}"/>
        <label>Condiciones</label><input class="input" id="fProvCond" value="${escapeHtml(p.condiciones||"")}"/>
      </div>
    `,
    `
      <button class="btn ghost" id="btnCancel">Cancelar</button>
      <button class="btn" id="btnSave">Guardar</button>
    `
  );
  $$("#btnCancel").onclick = closeModal;
  $$("#btnSave").onclick = ()=>{
    const db2 = getDB();
    const payload = {
      id: p.id || uid("prov"),
      nombre: $$("#fProvNombre").value.trim(),
      telefono: $$("#fProvTel").value.trim(),
      email: $$("#fProvEmail").value.trim(),
      direccion: $$("#fProvDir").value.trim(),
      condiciones: $$("#fProvCond").value.trim(),
    };
    if(!payload.nombre) return alert("El nombre es obligatorio.");
    if(p.id){
      const idx = db2.proveedores.findIndex(x=>x.id===p.id);
      db2.proveedores[idx] = payload;
    }else{
      db2.proveedores.push(payload);
    }
    setDB(db2);
    closeModal();
    renderAll();
  };
}

function deleteProveedor(id){
  if(!confirm("¿Eliminar proveedor?")) return;
  const db = getDB();
  db.proveedores = db.proveedores.filter(p=>p.id!==id);
  setDB(db);
  renderAll();
}

/* ---------------- Inventario ---------------- */

function renderInventario(){
  const db = getDB();
  const q = ($$("#invSearch")?.value || "").toLowerCase().trim();

  const rows = db.inventario
    .filter(p=>{
      if(!q) return true;
      return (p.sku||"").toLowerCase().includes(q)
        || (p.nombre||"").toLowerCase().includes(q)
        || (p.categoria||"").toLowerCase().includes(q);
    })
    .map(p=>{
      const prov = findById(db.proveedores, p.proveedorId)?.nombre || "—";
      const crit = parseNum(p.stock) < parseNum(p.minStock||0);
      return {...p, prov, crit};
    });

  renderTable($$("#tblInventario"), [
    {label:"SKU", key:"sku"},
    {label:"Producto", render:(r)=> `${escapeHtml(r.nombre)} ${r.crit ? `<span class="badge danger">crítico</span>`:""}`},
    {label:"Categoría", key:"categoria"},
    {label:"Proveedor", render:(r)=> escapeHtml(r.prov)},
    {label:"Costo", render:(r)=> money(parseNum(r.costo), db.config.currency)},
    {label:"Precio", render:(r)=> money(parseNum(r.precio), db.config.currency)},
    {label:"Stock", render:(r)=> `${parseNum(r.stock)}`},
    {label:"Mín.", render:(r)=> `${parseNum(r.minStock||0)}`},
    {label:"Acciones", render:(r)=> actionBtns([
      {label:"Editar", act:"edit", id:r.id},
      {label:"Eliminar", act:"del", id:r.id, kind:"danger"}
    ])}
  ], rows);

  hookActions($$("#tblInventario"), {
    edit: (id)=> openProductoForm(id),
    del: (id)=> deleteProducto(id)
  });

  // Resumen
  const invValor = db.inventario.reduce((acc,p)=> acc + parseNum(p.costo)*parseNum(p.stock), 0);
  const criticos = db.inventario.filter(p=> parseNum(p.stock) < parseNum(p.minStock||0)).length;

  $$("#invValor").textContent = money(invValor, db.config.currency);
  $$("#invTotal").textContent = `${db.inventario.length}`;
  $$("#invCriticos").textContent = `${criticos}`;
  $$("#invMovs").textContent = `${db.movimientos.length}`;
}

function openProductoForm(id){
  const db = getDB();
  const p = id ? findById(db.inventario, id) : {
    id:null, sku:"", nombre:"", categoria:"", costo:0, precio:0, stock:0, minStock:0, proveedorId:""
  };

  const provOptions = [`<option value="">—</option>`]
    .concat(db.proveedores.map(x=>`<option value="${x.id}" ${x.id===p.proveedorId?"selected":""}>${escapeHtml(x.nombre)}</option>`))
    .join("");

  openModal(
    id ? "Editar producto" : "Nuevo producto",
    `
      <div class="form">
        <label>SKU</label><input class="input" id="fSku" value="${escapeHtml(p.sku)}"/>
        <label>Nombre</label><input class="input" id="fNombre" value="${escapeHtml(p.nombre)}"/>
        <label>Categoría</label><input class="input" id="fCat" value="${escapeHtml(p.categoria)}"/>
        <label>Proveedor</label><select class="input" id="fProv">${provOptions}</select>
        <label>Costo unitario</label><input class="input" id="fCosto" type="number" step="0.01" value="${parseNum(p.costo)}"/>
        <label>Precio venta</label><input class="input" id="fPrecio" type="number" step="0.01" value="${parseNum(p.precio)}"/>
        <label>Stock</label><input class="input" id="fStock" type="number" step="1" value="${parseNum(p.stock)}"/>
        <label>Stock mínimo</label><input class="input" id="fMin" type="number" step="1" value="${parseNum(p.minStock||0)}"/>
      </div>
    `,
    `
      <button class="btn ghost" id="btnCancel">Cancelar</button>
      <button class="btn" id="btnSave">Guardar</button>
    `
  );

  $$("#btnCancel").onclick = closeModal;
  $$("#btnSave").onclick = ()=>{
    const db2 = getDB();
    const payload = {
      id: p.id || uid("prd"),
      sku: $$("#fSku").value.trim(),
      nombre: $$("#fNombre").value.trim(),
      categoria: $$("#fCat").value.trim(),
      proveedorId: $$("#fProv").value,
      costo: parseNum($$("#fCosto").value),
      precio: parseNum($$("#fPrecio").value),
      stock: parseNum($$("#fStock").value),
      minStock: parseNum($$("#fMin").value),
    };
    if(!payload.sku || !payload.nombre) return alert("SKU y nombre son obligatorios.");
    if(p.id){
      const idx = db2.inventario.findIndex(x=>x.id===p.id);
      db2.inventario[idx] = payload;
    }else{
      db2.inventario.push(payload);
      db2.movimientos.push({id:uid("mov"), fecha:dateOnlyISO(), tipo:"entrada", productoId:payload.id, qty:payload.stock, nota:"Alta de producto"});
    }
    setDB(db2);
    closeModal();
    renderAll();
  };
}

function deleteProducto(id){
  if(!confirm("¿Eliminar producto?")) return;
  const db = getDB();
  db.inventario = db.inventario.filter(p=>p.id!==id);
  setDB(db);
  renderAll();
}

function openAjusteStock(){
  const db = getDB();
  const opts = db.inventario.map(p=>`<option value="${p.id}">${escapeHtml(p.sku)} — ${escapeHtml(p.nombre)}</option>`).join("");
  openModal(
    "Ajuste de stock",
    `
      <div class="form">
        <label>Producto</label>
        <select class="input" id="ajProd">${opts}</select>
        <label>Tipo</label>
        <select class="input" id="ajTipo">
          <option value="entrada">Entrada</option>
          <option value="salida">Salida</option>
        </select>
        <label>Cantidad</label>
        <input class="input" id="ajQty" type="number" step="1" value="1" />
        <label>Nota</label>
        <input class="input" id="ajNota" placeholder="Ej. ajuste por inventario físico" />
      </div>
    `,
    `
      <button class="btn ghost" id="btnCancel">Cancelar</button>
      <button class="btn" id="btnApply">Aplicar</button>
    `
  );
  $$("#btnCancel").onclick = closeModal;
  $$("#btnApply").onclick = ()=>{
    const db2 = getDB();
    const productoId = $$("#ajProd").value;
    const tipo = $$("#ajTipo").value;
    const qty = clamp(parseInt($$("#ajQty").value||"0",10), 0, 1e9);
    const nota = $$("#ajNota").value.trim();
    const prd = findById(db2.inventario, productoId);
    if(!prd) return alert("Producto inválido.");
    if(qty<=0) return alert("Cantidad debe ser mayor a 0.");

    if(tipo==="salida"){
      if(parseNum(prd.stock) < qty) return alert("Stock insuficiente.");
      prd.stock = parseNum(prd.stock) - qty;
    }else{
      prd.stock = parseNum(prd.stock) + qty;
    }
    db2.movimientos.push({id:uid("mov"), fecha:dateOnlyISO(), tipo, productoId, qty, nota});
    setDB(db2);
    closeModal();
    renderAll();
  };
}

function openMovimientos(){
  const db = getDB();
  const rows = [...db.movimientos]
    .sort((a,b)=> (b.fecha||"").localeCompare(a.fecha||""))
    .slice(0,80)
    .map(m=>{
      const prd = findById(db.inventario, m.productoId);
      return {...m, sku: prd?.sku||"—", nombre: prd?.nombre||"—"};
    });

  openModal(
    "Movimientos de inventario (últimos 80)",
    `
      <div class="table-wrap">
        <table class="table" id="tblMov"></table>
      </div>
    `,
    `<button class="btn" id="btnOk">Cerrar</button>`
  );

  renderTable($$("#tblMov"), [
    {label:"Fecha", key:"fecha"},
    {label:"Tipo", render:(r)=> badge(r.tipo)},
    {label:"SKU", key:"sku"},
    {label:"Producto", render:(r)=> escapeHtml(r.nombre)},
    {label:"Cantidad", render:(r)=> `${parseNum(r.qty)}`},
    {label:"Nota", render:(r)=> escapeHtml(r.nota||"")}
  ], rows);

  $$("#btnOk").onclick = closeModal;
}

/* ---------------- Ventas ---------------- */

function renderVentas(){
  const db = getDB();
  const q = ($$("#ventasSearch")?.value||"").toLowerCase().trim();
  const rows = [...db.ventas]
    .sort((a,b)=> (b.fecha||"").localeCompare(a.fecha||""))
    .filter(v=>{
      if(!q) return true;
      const cli = findById(db.clientes, v.clienteId)?.nombre || "";
      return (v.folio||"").toLowerCase().includes(q)
        || cli.toLowerCase().includes(q)
        || (v.status||"").toLowerCase().includes(q);
    })
    .map(v=>{
      const cli = findById(db.clientes, v.clienteId)?.nombre || "—";
      const totals = saleTotals(db, v);
      return {...v, cli, total: totals.total};
    });

  renderTable($$("#tblVentas"), [
    {label:"Fecha", key:"fecha"},
    {label:"Folio", key:"folio"},
    {label:"Cliente", render:(r)=> escapeHtml(r.cli)},
    {label:"Estatus", render:(r)=> badge(r.status)},
    {label:"Total", render:(r)=> money(r.total, db.config.currency)},
    {label:"Acciones", render:(r)=> actionBtns([
      {label:"Ver/Editar", act:"edit", id:r.id},
      {label:"Facturar", act:"bill", id:r.id},
      {label:"Eliminar", act:"del", id:r.id, kind:"danger"}
    ])}
  ], rows);

  hookActions($$("#tblVentas"), {
    edit: (id)=> openVentaForm(id),
    bill: (id)=> crearFacturaDesdeVenta(id),
    del: (id)=> deleteVenta(id)
  });
}

function openVentaForm(id){
  const db = getDB();
  const v = id ? findById(db.ventas, id) : {
    id:null,
    fecha: dateOnlyISO(),
    folio: ensureFolio("V", db.ventas),
    clienteId: db.clientes[0]?.id || "",
    status: "pendiente",
    notas: "",
    items: []
  };

  const cliOptions = db.clientes.map(c=>`<option value="${c.id}" ${c.id===v.clienteId?"selected":""}>${escapeHtml(c.nombre)}</option>`).join("");

  const prodOptions = db.inventario.map(p=>`<option value="${p.id}">${escapeHtml(p.sku)} — ${escapeHtml(p.nombre)} (stock ${p.stock})</option>`).join("");

  openModal(
    id ? `Venta ${v.folio}` : "Nueva venta",
    `
      <div class="grid two">
        <div class="form">
          <label>Fecha</label><input class="input" id="vFecha" type="date" value="${v.fecha}"/>
          <label>Folio</label><input class="input" id="vFolio" value="${escapeHtml(v.folio)}"/>
          <label>Cliente</label><select class="input" id="vCliente">${cliOptions}</select>
          <label>Estatus</label>
          <select class="input" id="vStatus">
            ${["pendiente","cerrada","cancelada"].map(s=>`<option ${s===v.status?"selected":""}>${s}</option>`).join("")}
          </select>
          <label>Notas</label><input class="input" id="vNotas" value="${escapeHtml(v.notas||"")}"/>
        </div>

        <div class="card" style="border-radius:18px">
          <div class="pad">
            <div class="row" style="justify-content:space-between">
              <b>Items</b>
              <button class="btn small" id="btnAddItem">+ Agregar</button>
            </div>
            <div class="table-wrap" style="margin-top:10px">
              <table class="table" id="tblVentaItems"></table>
            </div>
            <div class="note" id="ventaTotals"></div>
          </div>
        </div>
      </div>
    `,
    `
      <button class="btn ghost" id="btnCancel">Cancelar</button>
      <button class="btn" id="btnSave">Guardar</button>
    `
  );

  function renderItems(){
    const rows = (v.items||[]).map((it, idx)=>{
      const p = findById(db.inventario, it.productoId);
      return {
        idx,
        sku: p?.sku || "—",
        nombre: p?.nombre || "—",
        qty: parseNum(it.qty),
        precio: parseNum(it.precio),
        total: parseNum(it.qty)*parseNum(it.precio)
      };
    });

    renderTable($$("#tblVentaItems"), [
      {label:"#", render:(r)=> `${r.idx+1}`},
      {label:"SKU", key:"sku"},
      {label:"Producto", render:(r)=> escapeHtml(r.nombre)},
      {label:"Qty", render:(r)=> `<input class="input" data-qty="${r.idx}" style="width:90px" type="number" step="1" value="${r.qty}">`},
      {label:"Precio", render:(r)=> `<input class="input" data-precio="${r.idx}" style="width:120px" type="number" step="0.01" value="${r.precio}">`},
      {label:"Total", render:(r)=> money(r.total, db.config.currency)},
      {label:"", render:(r)=> `<button class="btn small danger" data-delitem="${r.idx}">Quitar</button>`}
    ], rows);

    const totals = saleTotals(db, v);
    $$("#ventaTotals").innerHTML = `
      Subtotal: <b>${money(totals.subtotal, db.config.currency)}</b> ·
      IVA (${db.config.iva}%): <b>${money(totals.iva, db.config.currency)}</b> ·
      Total: <b>${money(totals.total, db.config.currency)}</b>
    `;
  }

  renderItems();

  $$("#btnAddItem").onclick = ()=>{
    openModal(
      "Agregar item",
      `
        <div class="form">
          <label>Producto</label><select class="input" id="itProd">${prodOptions}</select>
          <label>Cantidad</label><input class="input" id="itQty" type="number" step="1" value="1"/>
          <label>Precio</label><input class="input" id="itPrecio" type="number" step="0.01" value="0"/>
        </div>
      `,
      `
        <button class="btn ghost" id="btnCancel2">Cancelar</button>
        <button class="btn" id="btnAdd2">Agregar</button>
      `
    );

    const prodSel = $$("#itProd");
    const autoFill = ()=>{
      const p = findById(db.inventario, prodSel.value);
      if(p){
        $$("#itPrecio").value = parseNum(p.precio);
      }
    };
    autoFill();
    prodSel.onchange = autoFill;

    $$("#btnCancel2").onclick = ()=>{
      closeModal();
      // Re-abrir la venta (modal “padre” ya se cerró al abrir este)
      openVentaForm(v.id);
    };
    $$("#btnAdd2").onclick = ()=>{
      const p = findById(db.inventario, $$("#itProd").value);
      const qty = parseNum($$("#itQty").value);
      const precio = parseNum($$("#itPrecio").value);
      if(!p) return alert("Producto inválido.");
      if(qty<=0) return alert("Cantidad debe ser > 0.");

      v.items.push({productoId:p.id, qty, precio, costo:parseNum(p.costo)});
      closeModal();
      openVentaForm(v.id);
    };
  };

  // Inputs dentro de la tabla
  $$("#tblVentaItems").addEventListener("input",(e)=>{
    const qtyIdx = e.target.getAttribute("data-qty");
    const prIdx = e.target.getAttribute("data-precio");
    if(qtyIdx !== null){
      v.items[Number(qtyIdx)].qty = parseNum(e.target.value);
      renderItems();
    }
    if(prIdx !== null){
      v.items[Number(prIdx)].precio = parseNum(e.target.value);
      renderItems();
    }
  });

  $$("#tblVentaItems").addEventListener("click",(e)=>{
    const del = e.target.getAttribute("data-delitem");
    if(del !== null){
      v.items.splice(Number(del),1);
      renderItems();
    }
  });

  $$("#btnCancel").onclick = closeModal;
  $$("#btnSave").onclick = ()=>{
    const db2 = getDB();

    const payload = {
      ...v,
      id: v.id || uid("ven"),
      fecha: $$("#vFecha").value || dateOnlyISO(),
      folio: $$("#vFolio").value.trim() || ensureFolio("V", db2.ventas),
      clienteId: $$("#vCliente").value,
      status: $$("#vStatus").value,
      notas: $$("#vNotas").value.trim(),
      items: (v.items||[]).map(it=> ({...it, qty:parseNum(it.qty), precio:parseNum(it.precio), costo:parseNum(it.costo)}))
    };

    if(!payload.clienteId) return alert("Selecciona un cliente.");
    if(!payload.items.length) return alert("Agrega al menos un item.");

    // Validar stock si se cierra
    if(payload.status==="cerrada"){
      // calcular requerido
      const shortages = [];
      payload.items.forEach(it=>{
        const prd = findById(db2.inventario, it.productoId);
        if(prd && parseNum(prd.stock) < parseNum(it.qty)){
          shortages.push(`${prd.sku} (${prd.stock} < ${it.qty})`);
        }
      });
      if(shortages.length) return alert("Stock insuficiente:\n" + shortages.join("\n"));
    }

    // Si existía y estaba cerrada, revertir stock antes de guardar (para recalcular)
    if(v.id){
      const prev = findById(db2.ventas, v.id);
      if(prev?.status==="cerrada") applySaleStock(db2, prev, +1);
      const idx = db2.ventas.findIndex(x=>x.id===v.id);
      db2.ventas[idx] = payload;
    }else{
      db2.ventas.push(payload);
    }

    // Aplicar stock si quedó cerrada
    if(payload.status==="cerrada"){
      applySaleStock(db2, payload, -1);
    }

    setDB(db2);
    closeModal();
    renderAll();
  };
}

function deleteVenta(id){
  if(!confirm("¿Eliminar venta?")) return;
  const db = getDB();
  const v = findById(db.ventas, id);
  if(v?.status==="cerrada"){
    // revert stock
    applySaleStock(db, v, +1);
  }
  db.ventas = db.ventas.filter(x=>x.id!==id);
  // facturas ligadas quedan, pero sin venta
  setDB(db);
  renderAll();
}

/* ---------------- Facturación ---------------- */

function renderFacturacion(){
  const db = getDB();
  const q = ($$("#facSearch")?.value||"").toLowerCase().trim();

  const rows = [...db.facturas]
    .sort((a,b)=> (b.fecha||"").localeCompare(a.fecha||""))
    .filter(f=>{
      if(!q) return true;
      const cli = findById(db.clientes, f.clienteId)?.nombre || "";
      return (f.folio||"").toLowerCase().includes(q)
        || cli.toLowerCase().includes(q)
        || (f.status||"").toLowerCase().includes(q);
    })
    .map(f=>{
      const cli = findById(db.clientes, f.clienteId)?.nombre || "—";
      return {...f, cli};
    });

  renderTable($$("#tblFacturas"), [
    {label:"Fecha", key:"fecha"},
    {label:"Folio", key:"folio"},
    {label:"Cliente", render:(r)=> escapeHtml(r.cli)},
    {label:"Estatus", render:(r)=> badge(r.pagado ? "pagada" : r.status)},
    {label:"Total", render:(r)=> money(parseNum(r.total), db.config.currency)},
    {label:"Acciones", render:(r)=> actionBtns([
      {label:"Ver", act:"view", id:r.id},
      {label:"Marcar pagada", act:"pay", id:r.id},
      {label:"Eliminar", act:"del", id:r.id, kind:"danger"}
    ])}
  ], rows);

  hookActions($$("#tblFacturas"), {
    view: (id)=> viewFactura(id),
    pay: (id)=> pagarFactura(id),
    del: (id)=> deleteFactura(id)
  });

  const pendientes = rows.filter(f=>!f.pagado).slice(0,12);
  renderTable($$("#tblPendientes"), [
    {label:"Folio", key:"folio"},
    {label:"Cliente", render:(r)=> escapeHtml(r.cli)},
    {label:"Total", render:(r)=> money(parseNum(r.total), db.config.currency)},
    {label:"Acción", render:(r)=> `<button class="btn small" data-act="pay" data-id="${r.id}">Cobrar</button>`}
  ], pendientes);

  hookActions($$("#tblPendientes"), {
    pay: (id)=> pagarFactura(id)
  });
}

function crearFacturaDesdeVenta(ventaId){
  const db = getDB();
  const v = findById(db.ventas, ventaId);
  if(!v) return alert("Venta no encontrada.");
  if(v.status!=="cerrada") return alert("Solo puedes facturar ventas en estatus 'cerrada'.");
  const existing = db.facturas.find(f=>f.ventaId===v.id);
  if(existing) return alert(`Ya existe factura ${existing.folio} para esa venta.`);

  const totals = saleTotals(db, v);
  const factura = {
    id: uid("fac"),
    fecha: v.fecha || dateOnlyISO(),
    folio: ensureFolio("F", db.facturas),
    ventaId: v.id,
    clienteId: v.clienteId,
    subtotal: totals.subtotal,
    iva: totals.iva,
    total: totals.total,
    status: "emitida",
    pagado: false
  };
  db.facturas.push(factura);
  setDB(db);
  renderAll();
  setView("facturacion");
}

function openFacturaNueva(){
  const db = getDB();
  // opción: crear manual sin venta (simple)
  const cliOptions = db.clientes.map(c=>`<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("");

  openModal(
    "Nueva factura (manual)",
    `
      <div class="form">
        <label>Fecha</label><input class="input" id="fFecha" type="date" value="${dateOnlyISO()}"/>
        <label>Cliente</label><select class="input" id="fCliente">${cliOptions}</select>
        <label>Subtotal</label><input class="input" id="fSub" type="number" step="0.01" value="0"/>
        <label>Estatus</label>
        <select class="input" id="fStatus">
          <option>emitida</option>
          <option>pendiente</option>
        </select>
      </div>
      <div class="note">Esta factura no está ligada a una venta. Si quieres, factura desde “Gestión comercial”.</div>
    `,
    `
      <button class="btn ghost" id="btnCancel">Cancelar</button>
      <button class="btn" id="btnSave">Crear</button>
    `
  );

  $$("#btnCancel").onclick = closeModal;
  $$("#btnSave").onclick = ()=>{
    const db2 = getDB();
    const subtotal = parseNum($$("#fSub").value);
    const iva = subtotal * (parseNum(db2.config.iva)/100);
    const total = subtotal + iva;

    const fac = {
      id: uid("fac"),
      fecha: $$("#fFecha").value || dateOnlyISO(),
      folio: ensureFolio("F", db2.facturas),
      ventaId: null,
      clienteId: $$("#fCliente").value,
      subtotal, iva, total,
      status: $$("#fStatus").value,
      pagado: false
    };
    db2.facturas.push(fac);
    setDB(db2);
    closeModal();
    renderAll();
  };
}

function viewFactura(id){
  const db = getDB();
  const f = findById(db.facturas, id);
  if(!f) return;
  const cli = findById(db.clientes, f.clienteId)?.nombre || "—";
  openModal(
    `Factura ${f.folio}`,
    `
      <div class="grid two">
        <div class="pad" style="padding:0">
          <div class="stat"><span>Fecha</span><strong>${f.fecha}</strong></div>
          <div class="stat"><span>Cliente</span><strong>${escapeHtml(cli)}</strong></div>
          <div class="stat"><span>Estatus</span><strong>${f.pagado ? "pagada" : f.status}</strong></div>
          <div class="stat"><span>Subtotal</span><strong>${money(f.subtotal, db.config.currency)}</strong></div>
          <div class="stat"><span>IVA</span><strong>${money(f.iva, db.config.currency)}</strong></div>
          <div class="stat"><span>Total</span><strong>${money(f.total, db.config.currency)}</strong></div>
        </div>
        <div class="note">
          Si quieres PDF real, se puede agregar en fase 2 con librería (jspdf) o backend.
        </div>
      </div>
    `,
    `
      <button class="btn ghost" id="btnClose">Cerrar</button>
      <button class="btn" id="btnPay">${f.pagado ? "Pagada ✅" : "Marcar pagada"}</button>
    `
  );
  $$("#btnClose").onclick = closeModal;
  $$("#btnPay").onclick = ()=>{
    if(f.pagado) return;
    pagarFactura(f.id);
    closeModal();
  };
}

function pagarFactura(id){
  const db = getDB();
  const f = findById(db.facturas, id);
  if(!f) return;
  f.pagado = true;
  f.status = "pagada";
  setDB(db);
  renderAll();
}

function deleteFactura(id){
  if(!confirm("¿Eliminar factura?")) return;
  const db = getDB();
  db.facturas = db.facturas.filter(f=>f.id!==id);
  setDB(db);
  renderAll();
}

function cobroRapido(){
  const db = getDB();
  const pend = db.facturas.filter(f=>!f.pagado).slice(0,20);
  if(!pend.length) return alert("No hay facturas pendientes.");
  const opts = pend.map(f=>{
    const cli = findById(db.clientes, f.clienteId)?.nombre || "—";
    return `<option value="${f.id}">${f.folio} — ${cli} — ${money(f.total, db.config.currency)}</option>`;
  }).join("");

  openModal(
    "Cobro rápido",
    `
      <div class="form">
        <label>Selecciona factura</label>
        <select class="input" id="paySel">${opts}</select>
      </div>
    `,
    `
      <button class="btn ghost" id="btnCancel">Cancelar</button>
      <button class="btn" id="btnPay">Cobrar</button>
    `
  );
  $$("#btnCancel").onclick = closeModal;
  $$("#btnPay").onclick = ()=>{
    pagarFactura($$("#paySel").value);
    closeModal();
  };
}

/* ---------------- Nómina ---------------- */

function renderNomina(){
  const db = getDB();
  const q = ($$("#nomSearch")?.value||"").toLowerCase().trim();
  const emps = db.empleados.filter(e=> !q || (e.nombre||"").toLowerCase().includes(q));

  renderTable($$("#tblEmpleados"), [
    {label:"Nombre", key:"nombre"},
    {label:"Puesto", key:"puesto"},
    {label:"Salario mensual", render:(r)=> money(parseNum(r.salarioMensual), db.config.currency)},
    {label:"Acciones", render:(r)=> actionBtns([
      {label:"Editar", act:"edit", id:r.id},
      {label:"Eliminar", act:"del", id:r.id, kind:"danger"}
    ])}
  ], emps);

  hookActions($$("#tblEmpleados"), {
    edit: (id)=> openEmpleadoForm(id),
    del: (id)=> deleteEmpleado(id)
  });

  const recibos = [...db.recibos].sort((a,b)=> (b.fecha||"").localeCompare(a.fecha||"")).slice(0,30)
    .map(r=>{
      const e = findById(db.empleados, r.empleadoId);
      return {...r, emp: e?.nombre||"—"};
    });

  renderTable($$("#tblRecibos"), [
    {label:"Fecha", key:"fecha"},
    {label:"Empleado", render:(r)=> escapeHtml(r.emp)},
    {label:"Bruto", render:(r)=> money(parseNum(r.bruto), db.config.currency)},
    {label:"Deducciones", render:(r)=> money(parseNum(r.deducciones), db.config.currency)},
    {label:"Neto", render:(r)=> money(parseNum(r.neto), db.config.currency)},
    {label:"Notas", render:(r)=> escapeHtml(r.notas||"")}
  ], recibos);
}

function openEmpleadoForm(id){
  const db = getDB();
  const e = id ? findById(db.empleados, id) : {id:null, nombre:"", puesto:"", salarioMensual:0};

  openModal(
    id ? "Editar empleado" : "Nuevo empleado",
    `
      <div class="form">
        <label>Nombre</label><input class="input" id="eNom" value="${escapeHtml(e.nombre)}"/>
        <label>Puesto</label><input class="input" id="ePuesto" value="${escapeHtml(e.puesto||"")}"/>
        <label>Salario mensual</label><input class="input" id="eSal" type="number" step="0.01" value="${parseNum(e.salarioMensual)}"/>
      </div>
    `,
    `
      <button class="btn ghost" id="btnCancel">Cancelar</button>
      <button class="btn" id="btnSave">Guardar</button>
    `
  );

  $$("#btnCancel").onclick = closeModal;
  $$("#btnSave").onclick = ()=>{
    const db2 = getDB();
    const payload = {
      id: e.id || uid("emp"),
      nombre: $$("#eNom").value.trim(),
      puesto: $$("#ePuesto").value.trim(),
      salarioMensual: parseNum($$("#eSal").value)
    };
    if(!payload.nombre) return alert("Nombre obligatorio.");
    if(e.id){
      const idx = db2.empleados.findIndex(x=>x.id===e.id);
      db2.empleados[idx] = payload;
    }else{
      db2.empleados.push(payload);
    }
    setDB(db2);
    closeModal();
    renderAll();
  };
}

function deleteEmpleado(id){
  if(!confirm("¿Eliminar empleado?")) return;
  const db = getDB();
  db.empleados = db.empleados.filter(e=>e.id!==id);
  setDB(db);
  renderAll();
}

function calcularNomina(){
  const db = getDB();
  if(!db.empleados.length) return alert("No hay empleados.");

  openModal(
    "Calcular nómina (simple)",
    `
      <div class="form">
        <label>Fecha</label><input class="input" id="nFecha" type="date" value="${dateOnlyISO()}"/>
        <label>Deducción global (%)</label><input class="input" id="nDed" type="number" step="0.1" value="10"/>
        <label>Notas</label><input class="input" id="nNotas" placeholder="Ej. quincena 1" />
      </div>
      <div class="note">
        Cálculo demo: neto = salario - (salario * deducción%).
      </div>
    `,
    `
      <button class="btn ghost" id="btnCancel">Cancelar</button>
      <button class="btn" id="btnRun">Generar recibos</button>
    `
  );

  $$("#btnCancel").onclick = closeModal;
  $$("#btnRun").onclick = ()=>{
    const db2 = getDB();
    const fecha = $$("#nFecha").value || dateOnlyISO();
    const dedPct = clamp(parseNum($$("#nDed").value), 0, 100)/100;
    const notas = $$("#nNotas").value.trim();

    db2.empleados.forEach(emp=>{
      const bruto = parseNum(emp.salarioMensual);
      const deducciones = bruto * dedPct;
      const neto = bruto - deducciones;
      db2.recibos.push({
        id:uid("rec"),
        fecha,
        empleadoId: emp.id,
        bruto, deducciones, neto,
        notas
      });
    });

    setDB(db2);
    closeModal();
    renderAll();
  };
}

/* ---------------- Asistencias ---------------- */

function renderAsistencias(){
  const db = getDB();
  // empleado selector
  const sel = $$("#asisEmpleado");
  if(sel){
    sel.innerHTML = db.empleados.map(e=>`<option value="${e.id}">${escapeHtml(e.nombre)}</option>`).join("");
  }
  const date = $$("#asisFecha")?.value || dateOnlyISO();

  const rows = db.asistencias
    .filter(a=> a.fecha === date)
    .sort((a,b)=> (a.checkIn||"").localeCompare(b.checkIn||""))
    .map(a=>{
      const emp = findById(db.empleados, a.empleadoId)?.nombre || "—";
      return {...a, emp};
    });

  renderTable($$("#tblAsistencias"), [
    {label:"Empleado", render:(r)=> escapeHtml(r.emp)},
    {label:"Check-in", render:(r)=> r.checkIn || "—"},
    {label:"Check-out", render:(r)=> r.checkOut || "—"},
    {label:"Tarde (min)", render:(r)=> `${parseNum(r.minutosTarde||0)}`},
    {label:"Acciones", render:(r)=> actionBtns([
      {label:"Eliminar", act:"del", id:r.id, kind:"danger"}
    ])}
  ], rows);

  hookActions($$("#tblAsistencias"), {
    del: (id)=> deleteAsistencia(id)
  });

  // resumen
  const total = rows.length;
  const tardanzas = rows.filter(r=> parseNum(r.minutosTarde)>0).length;
  const abiertos = rows.filter(r=> !r.checkOut).length;

  $$("#asisResumen").innerHTML = `
    <div class="stat"><span>Fecha</span><strong>${date}</strong></div>
    <div class="stat"><span>Registros</span><strong>${total}</strong></div>
    <div class="stat"><span>Tardanzas</span><strong>${tardanzas}</strong></div>
    <div class="stat"><span>Sin salida</span><strong>${abiertos}</strong></div>
    <div class="note">Regla demo: tarde si entra después de 09:05.</div>
  `;
}

function checkIn(){
  const db = getDB();
  const fecha = $$("#asisFecha").value || dateOnlyISO();
  const empleadoId = $$("#asisEmpleado").value;
  if(!empleadoId) return alert("Selecciona empleado.");
  const ya = db.asistencias.find(a=>a.fecha===fecha && a.empleadoId===empleadoId);
  if(ya) return alert("Ya existe registro para ese empleado en esa fecha.");

  const t = new Date();
  const checkIn = t.toTimeString().slice(0,5);

  // tardanza demo
  const [hh,mm] = checkIn.split(":").map(Number);
  const mins = hh*60+mm;
  const limite = 9*60+5;
  const minutosTarde = Math.max(0, mins - limite);

  db.asistencias.push({
    id:uid("asi"),
    fecha,
    empleadoId,
    checkIn,
    checkOut:null,
    minutosTarde
  });
  setDB(db);
  renderAll();
}

function checkOut(){
  const db = getDB();
  const fecha = $$("#asisFecha").value || dateOnlyISO();
  const empleadoId = $$("#asisEmpleado").value;
  const reg = db.asistencias.find(a=>a.fecha===fecha && a.empleadoId===empleadoId);
  if(!reg) return alert("No hay check-in para ese empleado hoy.");
  if(reg.checkOut) return alert("Ya tiene check-out.");
  reg.checkOut = new Date().toTimeString().slice(0,5);
  setDB(db);
  renderAll();
}

function deleteAsistencia(id){
  if(!confirm("¿Eliminar registro?")) return;
  const db = getDB();
  db.asistencias = db.asistencias.filter(a=>a.id!==id);
  setDB(db);
  renderAll();
}

/* ---------------- Reportes ---------------- */

let lastReport = {columns:[], rows:[]};

function renderReportes(){
  // solo set defaults si vacíos
  const from = $$("#repFrom");
  const to = $$("#repTo");
  if(from && !from.value) {
    const d = new Date(); d.setDate(d.getDate()-30);
    from.value = d.toISOString().slice(0,10);
  }
  if(to && !to.value) to.value = dateOnlyISO();
}

function generarReporte(){
  const db = getDB();
  const from = $$("#repFrom").value;
  const to = $$("#repTo").value;
  const tipo = $$("#repTipo").value;

  const inRange = (d)=> d>=from && d<=to;

  let columns = [];
  let rows = [];

  if(tipo==="ventas"){
    columns = ["fecha","folio","cliente","status","subtotal","iva","total","margen"];
    rows = db.ventas.filter(v=> inRange(v.fecha)).map(v=>{
      const cli = findById(db.clientes, v.clienteId)?.nombre || "—";
      const t = saleTotals(db, v);
      return {
        fecha:v.fecha, folio:v.folio, cliente:cli, status:v.status,
        subtotal:t.subtotal, iva:t.iva, total:t.total, margen:t.margen
      };
    });
  }

  if(tipo==="facturas"){
    columns = ["fecha","folio","cliente","status","total","pagado"];
    rows = db.facturas.filter(f=> inRange(f.fecha)).map(f=>{
      const cli = findById(db.clientes, f.clienteId)?.nombre || "—";
      return {fecha:f.fecha, folio:f.folio, cliente:cli, status:f.status, total:f.total, pagado: f.pagado ? "sí":"no"};
    });
  }

  if(tipo==="inventario"){
    columns = ["sku","nombre","categoria","stock","minStock","costo","precio","valor"];
    rows = db.inventario.map(p=>{
      const valor = parseNum(p.costo)*parseNum(p.stock);
      return {...p, valor};
    });
  }

  if(tipo==="nomina"){
    columns = ["fecha","empleado","bruto","deducciones","neto","notas"];
    rows = db.recibos.filter(r=> inRange(r.fecha)).map(r=>{
      const emp = findById(db.empleados, r.empleadoId)?.nombre || "—";
      return {fecha:r.fecha, empleado:emp, bruto:r.bruto, deducciones:r.deducciones, neto:r.neto, notas:r.notas||""};
    });
  }

  if(tipo==="asistencias"){
    columns = ["fecha","empleado","checkIn","checkOut","minutosTarde"];
    rows = db.asistencias.filter(a=> inRange(a.fecha)).map(a=>{
      const emp = findById(db.empleados, a.empleadoId)?.nombre || "—";
      return {fecha:a.fecha, empleado:emp, checkIn:a.checkIn||"", checkOut:a.checkOut||"", minutosTarde:a.minutosTarde||0};
    });
  }

  lastReport = {columns, rows};

  // render table
  const tbl = $$("#tblReporte");
  renderTable(tbl, columns.map(c=>({label:c, key:c, render:(r)=>{
    const v = r[c];
    if(typeof v === "number" && ["subtotal","iva","total","margen","bruto","deducciones","neto","costo","precio","valor"].includes(c)){
      return money(v, db.config.currency);
    }
    return escapeHtml(String(v ?? ""));
  }})), rows);
}

function reportToCSV(){
  const db = getDB();
  const cols = lastReport.columns;
  const rows = lastReport.rows;
  if(!cols.length) return "";
  const escapeCSV = (v)=>{
    const s = String(v ?? "");
    if(/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };
  const lines = [
    cols.join(","),
    ...rows.map(r=> cols.map(c=>{
      const v = r[c];
      if(typeof v === "number" && ["subtotal","iva","total","margen","bruto","deducciones","neto","costo","precio","valor"].includes(c)){
        return escapeCSV(v.toFixed(2));
      }
      return escapeCSV(v);
    }).join(","))
  ];
  return lines.join("\n");
}

/* ---------------- Analíticas ---------------- */

function renderAnaliticas(){
  const db = getDB();
  const range = $$("#anaRange").value;

  const ventas = db.ventas.filter(v=> withinRange(v.fecha, range) && v.status==="cerrada");

  // Top clientes
  const byClient = new Map();
  ventas.forEach(v=>{
    const t = saleTotals(db,v);
    byClient.set(v.clienteId, (byClient.get(v.clienteId)||0) + t.total);
  });
  const topClientes = [...byClient.entries()]
    .map(([clienteId, total])=>({
      cliente: findById(db.clientes, clienteId)?.nombre || "—",
      total
    }))
    .sort((a,b)=> b.total-a.total)
    .slice(0,10);

  renderTable($$("#tblTopClientes"), [
    {label:"Cliente", render:(r)=> escapeHtml(r.cliente)},
    {label:"Total", render:(r)=> money(r.total, db.config.currency)}
  ], topClientes);

  // Top productos por unidades
  const byProd = new Map();
  ventas.forEach(v=>{
    (v.items||[]).forEach(it=>{
      byProd.set(it.productoId, (byProd.get(it.productoId)||0) + parseNum(it.qty));
    });
  });
  const topProductos = [...byProd.entries()]
    .map(([productoId, units])=>({
      sku: findById(db.inventario, productoId)?.sku || "—",
      producto: findById(db.inventario, productoId)?.nombre || "—",
      units
    }))
    .sort((a,b)=> b.units-a.units)
    .slice(0,10);

  renderTable($$("#tblTopProductos"), [
    {label:"SKU", key:"sku"},
    {label:"Producto", render:(r)=> escapeHtml(r.producto)},
    {label:"Unidades", render:(r)=> `${r.units}`}
  ], topProductos);

  // Margen
  const totals = ventas.reduce((acc,v)=>{
    const t = saleTotals(db,v);
    acc.subtotal += t.subtotal;
    acc.costo += t.costo;
    acc.margen += t.margen;
    acc.total += t.total;
    return acc;
  }, {subtotal:0, costo:0, margen:0, total:0});

  const margenPct = totals.subtotal ? (totals.margen / totals.subtotal) * 100 : 0;

  $$("#margenBox").innerHTML = `
    <div class="stat"><span>Ingresos (subtotal)</span><strong>${money(totals.subtotal, db.config.currency)}</strong></div>
    <div class="stat"><span>Costo estimado</span><strong>${money(totals.costo, db.config.currency)}</strong></div>
    <div class="stat"><span>Margen</span><strong>${money(totals.margen, db.config.currency)}</strong></div>
    <div class="stat"><span>Margen %</span><strong>${margenPct.toFixed(1)}%</strong></div>
    <div class="note">Margen estimado con costo unitario del inventario.</div>
  `;

  // Salud
  const criticos = db.inventario.filter(p=> parseNum(p.stock) < parseNum(p.minStock||0)).length;
  const pendientesPago = db.facturas.filter(f=> !f.pagado).length;

  const score = clamp(
    100
    - criticos*8
    - pendientesPago*4,
    0, 100
  );

  $$("#saludBox").innerHTML = `
    <div class="stat"><span>Score</span><strong>${score}/100</strong></div>
    <div class="stat"><span>Stock crítico</span><strong>${criticos}</strong></div>
    <div class="stat"><span>Facturas pendientes</span><strong>${pendientesPago}</strong></div>
    <div class="note">Esto es un indicador demo. Se puede mejorar con KPIs reales.</div>
  `;
}

/* ---------------- Config ---------------- */

function renderConfig(){
  const db = getDB();
  $$("#cfgNombre").value = db.config.companyName || "ALSET Irrigation Systems";
  $$("#cfgMoneda").value = db.config.currency || "MXN";
  $$("#cfgIVA").value = parseNum(db.config.iva);
}

function saveConfig(){
  const db = getDB();
  db.config.companyName = $$("#cfgNombre").value.trim() || "ALSET Irrigation Systems";
  db.config.currency = $$("#cfgMoneda").value;
  db.config.iva = clamp(parseNum($$("#cfgIVA").value), 0, 100);
  setDB(db);
  // Actualizar topbar (solo nombre visual)
  $$("title").textContent = `${db.config.companyName} — ERP`;
  renderAll();
}

/* ---------------- Export / Import ---------------- */

function exportJSON(){
  const db = getDB();
  download("ALSET_ERP_backup.json", JSON.stringify(db, null, 2));
}

async function importJSON(file){
  const text = await file.text();
  try{
    const obj = JSON.parse(text);
    // merge con defaults
    const merged = {...defaultDB(), ...obj};
    setDB(merged);
    alert("Importación exitosa ✅");
    renderAll();
  }catch{
    alert("JSON inválido.");
  }
}

/* ---------------- Utils ---------------- */

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* ---------------- Quick Create ---------------- */

function openQuickCreate(){
  openModal(
    "Nuevo (rápido)",
    `
      <div class="form">
        <label>¿Qué quieres crear?</label>
        <select class="input" id="qcType">
          <option value="cliente">Cliente</option>
          <option value="proveedor">Proveedor</option>
          <option value="producto">Producto</option>
          <option value="venta">Venta</option>
          <option value="factura">Factura manual</option>
          <option value="empleado">Empleado</option>
        </select>
      </div>
    `,
    `
      <button class="btn ghost" id="btnCancel">Cancelar</button>
      <button class="btn" id="btnGo">Continuar</button>
    `
  );
  $$("#btnCancel").onclick = closeModal;
  $$("#btnGo").onclick = ()=>{
    const t = $$("#qcType").value;
    closeModal();
    if(t==="cliente") openClienteForm(null);
    if(t==="proveedor") openProveedorForm(null);
    if(t==="producto") openProductoForm(null);
    if(t==="venta") openVentaForm(null);
    if(t==="factura") openFacturaNueva();
    if(t==="empleado") openEmpleadoForm(null);
  };
}

/* ---------------- Render All ---------------- */

function renderAll(){
  // dashboard always can be updated
  renderDashboard();
  renderClientes();
  renderProveedores();
  renderInventario();
  renderVentas();
  renderFacturacion();
  renderNomina();
  renderAsistencias();
  renderReportes();
  renderAnaliticas();
  renderConfig();
}

/* ---------------- Event bindings ---------------- */

function bind(){
  // dashboard
  $$("#dashRange").addEventListener("change", renderAll);
  $$("#btnSeed").addEventListener("click", ()=>{
    seedDemo();
    renderAll();
  });

  // clientes/proveedores/inv searches
  $$("#cliSearch").addEventListener("input", renderClientes);
  $$("#provSearch").addEventListener("input", renderProveedores);
  $$("#invSearch").addEventListener("input", renderInventario);
  $$("#ventasSearch").addEventListener("input", renderVentas);
  $$("#facSearch").addEventListener("input", renderFacturacion);
  $$("#nomSearch").addEventListener("input", renderNomina);

  // inventario actions
  $$("#btnProductoNuevo").addEventListener("click", ()=> openProductoForm(null));
  $$("#btnAjusteStock").addEventListener("click", openAjusteStock);
  $$("#btnMovimientos").addEventListener("click", openMovimientos);

  // ventas actions
  $$("#btnVentaNueva").addEventListener("click", ()=> openVentaForm(null));

  // clientes/proveedores actions
  $$("#btnClienteNuevo").addEventListener("click", ()=> openClienteForm(null));
  $$("#btnProveedorNuevo").addEventListener("click", ()=> openProveedorForm(null));

  // facturacion actions
  $$("#btnFacturaNueva").addEventListener("click", openFacturaNueva);
  $$("#btnCobroRapido").addEventListener("click", cobroRapido);

  // nomina actions
  $$("#btnEmpleadoNuevo").addEventListener("click", ()=> openEmpleadoForm(null));
  $$("#btnCalcularNomina").addEventListener("click", calcularNomina);

  // asistencias
  $$("#asisFecha").value = dateOnlyISO();
  $$("#asisFecha").addEventListener("change", renderAsistencias);
  $$("#btnCheckIn").addEventListener("click", checkIn);
  $$("#btnCheckOut").addEventListener("click", checkOut);

  // reportes
  $$("#btnGenerarReporte").addEventListener("click", generarReporte);
  $$("#btnCopiarReporte").addEventListener("click", async ()=>{
    const csv = reportToCSV();
    if(!csv) return alert("Genera un reporte primero.");
    await navigator.clipboard.writeText(csv);
    alert("Copiado ✅");
  });
  $$("#btnDescargarCSV").addEventListener("click", ()=>{
    const csv = reportToCSV();
    if(!csv) return alert("Genera un reporte primero.");
    download("reporte.csv", csv);
  });

  // analiticas
  $$("#anaRange").addEventListener("change", renderAnaliticas);
  $$("#btnRecalcularAna").addEventListener("click", renderAnaliticas);

  // config
  $$("#btnGuardarCfg").addEventListener("click", saveConfig);

  // export/import/reset/quick
  $$("#btnExport").addEventListener("click", exportJSON);
  $$("#fileImport").addEventListener("change", (e)=>{
    const f = e.target.files?.[0];
    if(f) importJSON(f);
    e.target.value = "";
  });

  $$("#btnReset").addEventListener("click", ()=>{
    if(!confirm("Esto borrará los datos guardados en este navegador. ¿Continuar?")) return;
    resetDB();
    seedDemo();
    renderAll();
    alert("Listo ✅");
  });

  $$("#btnNewQuick").addEventListener("click", openQuickCreate);
}

/* ---------------- Init ---------------- */

(function init(){
  // seed initial demo so it isn't blank
  seedDemo();

  // topbar title sync
  const db = getDB();
  $$("title").textContent = `${db.config.companyName || "ALSET Irrigation Systems"} — ERP`;

  bind();
  renderAll();

  // start on dashboard
  setView("dashboard");
})();
