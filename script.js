const db=supabase.createClient(window.SUPABASE_URL,window.SUPABASE_KEY);
const BUCKET="vbl-videos";

function toggle(id){document.getElementById(id).classList.toggle("hidden")}
function msg(id,t,bad=false){const e=document.getElementById(id);e.textContent=t;e.style.color=bad?"#ff7777":"#79c5ff"}
function esc(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function copyCode(c){navigator.clipboard.writeText(c);alert("Kimásolva: "+c)}

async function loadVideos(){
 const box=document.getElementById("videoList");
 const {data,error}=await db.from("videos").select("*").eq("status","approved").order("created_at",{ascending:false});
 if(error){box.innerHTML='<p class="muted">A Supabase adatbázis még nincs beállítva.</p>';return}
 if(!data.length){box.innerHTML='<p class="muted">Még nincs jóváhagyott videó.</p>';return}
 box.innerHTML=data.map(v=>{
  const url=db.storage.from(BUCKET).getPublicUrl(v.file_path).data.publicUrl;
  return `<article class="video"><video controls preload="metadata" src="${url}"></video><h3>${esc(v.title)}</h3></article>`;
 }).join("");
}

async function uploadVideo(){
 const title=document.getElementById("title").value.trim(),file=document.getElementById("file").files[0];
 if(!title||!file){msg("uploadMsg","Töltsd ki a címet és válassz videót.",true);return}
 if(file.size>50*1024*1024){msg("uploadMsg","A videó maximum 50 MB lehet.",true);return}
 msg("uploadMsg","Feltöltés...")
 const name=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
 const path="pending/"+crypto.randomUUID()+"-"+name;
 const up=await db.storage.from(BUCKET).upload(path,file,{contentType:file.type});
 if(up.error){msg("uploadMsg","Hiba: "+up.error.message,true);return}
 const ins=await db.from("videos").insert({title,file_path:path,status:"pending"});
 if(ins.error){await db.storage.from(BUCKET).remove([path]);msg("uploadMsg","Adatbázis hiba: "+ins.error.message,true);return}
 document.getElementById("title").value="";document.getElementById("file").value="";
 msg("uploadMsg","Siker! A videó jóváhagyásra vár.");
}

async function login(){
 const email=document.getElementById("email").value.trim(),password=document.getElementById("password").value;
 const r=await db.auth.signInWithPassword({email,password});
 if(r.error){msg("adminMsg","Sikertelen belépés: "+r.error.message,true);return}
 msg("adminMsg","Belépve.");loadPending();
}
async function logout(){await db.auth.signOut();document.getElementById("pending").innerHTML="";msg("adminMsg","Kijelentkezve.")}

async function loadPending(){
 const r=await db.rpc("is_admin");
 if(r.error||r.data!==true){msg("adminMsg","Ez a fiók nem admin.",true);return}
 const q=await db.from("videos").select("*").eq("status","pending").order("created_at");
 if(q.error){msg("adminMsg",q.error.message,true);return}
 const box=document.getElementById("pending");
 if(!q.data.length){box.innerHTML='<p class="muted">Nincs várakozó videó.</p>';return}
 box.innerHTML=q.data.map(v=>{
  const url=db.storage.from(BUCKET).getPublicUrl(v.file_path).data.publicUrl;
  return `<div class="pending"><video controls src="${url}"></video><h3>${esc(v.title)}</h3><button class="primary" onclick="moderate('${v.id}','approved')">✅ Jóváhagyás</button> <button onclick="moderate('${v.id}','rejected')">❌ Elutasítás</button></div>`
 }).join("");
}
async function moderate(id,status){
 const r=await db.from("videos").update({status}).eq("id",id);
 if(r.error){msg("adminMsg",r.error.message,true);return}
 loadPending();loadVideos();
}
db.auth.onAuthStateChange((e)=>{if(e==="SIGNED_IN")loadPending()});
loadVideos();