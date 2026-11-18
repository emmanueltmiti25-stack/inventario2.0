const KEY = "inventario_productos";
const SEED = [
  {id:1,nombre:"Lápiz",categoria:"Papelería",descripcion:"",cantidad:120},
  {id:2,nombre:"Cuaderno",categoria:"Papelería",descripcion:"",cantidad:50},
  {id:3,nombre:"Borrador",categoria:"Papelería",descripcion:"",cantidad:35},
  {id:4,nombre:"Regla",categoria:"Papelería",descripcion:"",cantidad:40}
];
const Store = {
  // Devuelve un arreglo, o null si el almacenamiento falla o los datos están dañados
  load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(raw === null){ this.save(SEED); return SEED.map(p=>({...p})); }
      const d = JSON.parse(raw);
      if(!Array.isArray(d)) throw new Error("formato");
      return d;
    }catch(e){ return null; }
  },
  save(list){
    try{ localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch(e){ return false; }
  },
  nextId(list){ return list.reduce((m,p)=>Math.max(m,Number(p.id)||0),0)+1; },
  reset(){ try{ localStorage.removeItem(KEY); }catch(e){} }
};
const norm = s => s.trim().replace(/\s+/g," ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");

function toast(msg,type){
  let t = document.getElementById("toast");
  if(!t){ t = document.createElement("div"); t.id="toast"; t.setAttribute("role","status"); document.body.appendChild(t); }
  t.textContent = msg; t.className = "show " + (type||"");
  clearTimeout(t._h); t._h = setTimeout(()=>t.className="", 3200);
}
// Mensaje que sobrevive a una redirección entre páginas
function flash(msg,type){ try{ sessionStorage.setItem("flash", JSON.stringify({msg,type})); }catch(e){} }
function showFlash(){
  try{
    const f = sessionStorage.getItem("flash");
    if(f){ sessionStorage.removeItem("flash"); const o = JSON.parse(f); toast(o.msg,o.type); }
  }catch(e){}
}
function storageError(container){
  container.innerHTML = "";
  const d = document.createElement("div"); d.className="alert";
  d.textContent = "No se pudo acceder a los datos del inventario (almacenamiento bloqueado o información dañada). Revisa que el navegador permita guardar datos del sitio.";
  const b = document.createElement("button"); b.className="btn ghost sm"; b.style.marginTop="10px"; b.textContent="Restablecer inventario";
  b.onclick = ()=>{ Store.reset(); location.reload(); };
  d.appendChild(document.createElement("br")); d.appendChild(b); container.appendChild(d);
}
document.querySelectorAll("nav a").forEach(a=>{
  const here = location.pathname.split("/").pop() || "index.html";
  if(a.getAttribute("href") === here) a.setAttribute("aria-current","page");
});
showFlash();

/* ---------- Página de productos ---------- */
const tbody = document.getElementById("tbody");
if(tbody){
  const main = document.querySelector("main");
  let list = Store.load();
  if(list === null){ main.querySelector(".table-wrap").hidden = true; storageError(main); }
  else {
    const q = document.getElementById("q"), count = document.getElementById("count");
    const dlg = document.getElementById("dlg"), dlgName = document.getElementById("dlgName");
    let pending = null;
    const cell = (txt,cls)=>{ const td=document.createElement("td"); td.textContent=txt; if(cls) td.className=cls; return td; };
    function render(){
      const term = norm(q.value);
      const rows = list.filter(p=>!term || norm(p.nombre+" "+p.categoria).includes(term));
      tbody.innerHTML = "";
      rows.forEach(p=>{
        const tr = document.createElement("tr");
        tr.append(cell(p.id,"num"), cell(p.nombre), cell(p.categoria), cell(p.cantidad, "num"+(p.cantidad<=5?" low":"")));
        const td = document.createElement("td"); td.className="actions";
        const e = document.createElement("a"); e.className="btn ghost sm"; e.textContent="Editar"; e.href="agregar.html?id="+encodeURIComponent(p.id);
        e.setAttribute("aria-label","Editar "+p.nombre);
        const d = document.createElement("button"); d.className="btn danger sm"; d.textContent="Eliminar"; d.type="button";
        d.setAttribute("aria-label","Eliminar "+p.nombre);
        d.onclick = ()=>{ pending = p.id; dlgName.textContent = p.nombre; dlg.showModal(); };
        td.append(e,d); tr.appendChild(td); tbody.appendChild(tr);
      });
      document.getElementById("empty").hidden = rows.length > 0;
      document.getElementById("empty").textContent = list.length ? "Sin resultados para tu búsqueda." : "Aún no hay productos registrados.";
      count.textContent = rows.length + " de " + list.length + " productos";
    }
    q.addEventListener("input", render);
    document.getElementById("cancel").onclick = ()=>dlg.close();
    document.getElementById("confirm").onclick = ()=>{
      const next = list.filter(p=>p.id !== pending);
      if(Store.save(next)){ list = next; toast("Producto eliminado."); }
      else toast("No se pudo eliminar el producto.","error");
      dlg.close(); render();
    };
    render();
  }
}

/* ---------- Página de agregar / editar ---------- */
const form = document.getElementById("form");
if(form){
  const main = document.querySelector("main");
  const list = Store.load();
  const f = {nombre:form.nombre, categoria:form.categoria, descripcion:form.descripcion, cantidad:form.cantidad};
  const rules = {
    nombre: v => v.length<2 ? "El nombre debe tener al menos 2 caracteres." : v.length>60 ? "Máximo 60 caracteres." : "",
    categoria: v => v.length<2 ? "Indica una categoría (mínimo 2 caracteres)." : v.length>40 ? "Máximo 40 caracteres." : "",
    descripcion: v => v.length>200 ? "Máximo 200 caracteres." : "",
    cantidad: v => {
      if(v==="") return "Ingresa la cantidad.";
      const n = Number(v);
      if(!Number.isFinite(n)) return "La cantidad debe ser un número.";
      if(!Number.isInteger(n)) return "La cantidad debe ser un número entero.";
      if(n<0) return "La cantidad no puede ser negativa.";
      if(n>100000) return "La cantidad máxima es 100,000.";
      return "";
    }
  };
  const clean = k => f[k].value.trim().replace(/\s+/g," ");
  const setErr = (k,msg)=>{ document.getElementById("e-"+k).textContent=msg; f[k].classList.toggle("invalid",!!msg); f[k].setAttribute("aria-invalid",!!msg); };
  if(list === null){ form.hidden = true; storageError(main); }
  else {
    const id = new URLSearchParams(location.search).get("id");
    let editing = null;
    if(id !== null){
      editing = list.find(p=>String(p.id)===id) || null;
      if(!editing){
        form.hidden = true;
        const d = document.createElement("div"); d.className="alert"; d.textContent="El producto que intentas editar no existe o ya fue eliminado.";
        main.appendChild(d); document.getElementById("titulo").textContent="Producto no encontrado";
      } else {
        document.getElementById("titulo").textContent="Editar producto";
        document.title="Editar Producto";
        for(const k in f) f[k].value = editing[k];
        document.getElementById("save").textContent="Guardar cambios";
      }
    }
    const desc = f.descripcion, hint = document.getElementById("hint");
    const upd = ()=>hint.textContent = desc.value.length+"/200";
    desc.addEventListener("input",upd); upd();
    Object.keys(f).forEach(k=>f[k].addEventListener("blur",()=>setErr(k,rules[k](clean(k)))));
    form.addEventListener("submit",e=>{
      e.preventDefault();
      let ok = true, first = null;
      for(const k in f){ const m = rules[k](clean(k)); setErr(k,m); if(m){ ok=false; first = first||f[k]; } }
      if(ok){
        const dup = list.some(p=>(!editing || p.id!==editing.id) && norm(p.nombre)===norm(clean("nombre")) && norm(p.categoria)===norm(clean("categoria")));
        if(dup){ setErr("nombre","Ya existe un producto con ese nombre en esa categoría."); ok=false; first=f.nombre; }
      }
      if(!ok){ first.focus(); return; }
      const data = {nombre:clean("nombre"),categoria:clean("categoria"),descripcion:clean("descripcion"),cantidad:Number(f.cantidad.value)};
      const next = editing ? list.map(p=>p.id===editing.id ? {...p,...data} : p) : [...list,{id:Store.nextId(list),...data}];
      const btn = document.getElementById("save"); btn.disabled = true;
      if(Store.save(next)){ flash(editing ? "Cambios guardados." : "Producto guardado."); location.href="productos.html"; }
      else { btn.disabled=false; toast("No se pudo guardar: el almacenamiento del navegador no está disponible o está lleno.","error"); }
    });
  }
}
