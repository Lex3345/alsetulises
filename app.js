const DB_KEY="ALSET_ERP_V2";
const $=q=>document.querySelector(q);

function uid(p){return p+"_"+Date.now();}
function db(){return JSON.parse(localStorage.getItem(DB_KEY))||{
  clientes:[], proveedores:[], inventario:[],
  cotizaciones:[], ventas:[], facturas:[],
  empleados:[], asistencias:[]
};}
function save(d){localStorage.setItem(DB_KEY,JSON.stringify(d));}

function setView(v){
  document.querySelectorAll(".view").forEach(x=>x.classList.add("hidden"));
  $("#view-"+v).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));
  document.querySelector(`[data-view="${v}"]`).classList.add("active");
  render();
}
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>setView(b.dataset.view));

/* MODAL */
function openModal(t,b,cb){
  $("#modalTitle").innerText=t;
  $("#modalBody").innerHTML=b;
  $("#modal").classList.remove("hidden");
  $("#modalSave").onclick=cb;
}
function closeModal(){$("#modal").classList.add("hidden");}

/* CLIENTES */
function openCliente(){
  openModal("Nuevo cliente",`<input id="cNom" placeholder="Nombre">`,()=>{
    const d=db();d.clientes.push({id:uid("cli"),nombre:$("#cNom").value});
    save(d);closeModal();render();
  });
}

/* INVENTARIO */
function openProducto(){
  openModal("Nuevo producto",
  `<input id="pNom" placeholder="Producto"><input id="pStock" type="number" placeholder="Stock">`,()=>{
    const d=db();
    d.inventario.push({id:uid("prd"),nombre:$("#pNom").value,stock:+$("#pStock").value});
    save(d);closeModal();render();
  });
}

/* COTIZACIONES */
function openCotizacion(){
  openModal("Nueva cotización",
  `<input id="cotCli" placeholder="Cliente"><input id="cotVal" type="date">`,()=>{
    const d=db();
    d.cotizaciones.push({id:uid("cot"),cliente:$("#cotCli").value,estado:"borrador"});
    save(d);closeModal();render();
  });
}

/* VENTAS */
function openVenta(){
  openModal("Nueva venta",`<input id="vCli" placeholder="Cliente">`,()=>{
    const d=db();
    d.ventas.push({id:uid("ven"),cliente:$("#vCli").value,estado:"pendiente"});
    save(d);closeModal();render();
  });
}

/* RENDER */
function render(){
  const d=db();
  $("#tblClientes").innerHTML=d.clientes.map(c=>`<tr><td>${c.nombre}</td></tr>`).join("");
  $("#tblInventario").innerHTML=d.inventario.map(p=>`<tr><td>${p.nombre}</td><td>${p.stock}</td></tr>`).join("");
  $("#tblCotizaciones").innerHTML=d.cotizaciones.map(c=>`<tr><td>${c.cliente}</td><td>${c.estado}</td></tr>`).join("");
  $("#tblVentas").innerHTML=d.ventas.map(v=>`<tr><td>${v.cliente}</td><td>${v.estado}</td></tr>`).join("");
}

render();
