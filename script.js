const db = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
const BUCKET = "vbl-videos";

function msg(id, text, bad=false){
  const e=document.getElementById(id);
  if(!e) return;
  e.textContent=text;
  e.style.color=bad ? "#ff7777" : "#79c5ff";
}
function esc(s){
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function copyCode(code){
  navigator.clipboard.writeText(code).then(()=>alert("Kimásolva: "+code)).catch(()=>{});
}
function getVisitorId(){
  let id=localStorage.getItem("exc_vbl_visitor_id");
  if(!id){
    id=crypto.randomUUID();
    localStorage.setItem("exc_vbl_visitor_id",id);
  }
  return id;
}
const visitorId=getVisitorId();

async function loadVideos(){
  const box=document.getElementById("videoList");
  if(!box) return;

  const q=await db.from("videos")
    .select("*")
    .eq("status","approved")
    .order("created_at",{ascending:false});

  if(q.error){
    box.innerHTML='<p class="muted">Videóadatbázis hiba: '+esc(q.error.message)+'</p>';
    return;
  }
  if(!q.data.length){
    box.innerHTML='<p class="muted">Még nincs jóváhagyott videó.</p>';
    return;
  }

  const counts=await db.rpc("get_video_like_counts");
  const countMap={};
  (counts.data||[]).forEach(x=>countMap[x.video_id]=Number(x.like_count));

  const mine=await db.from("video_likes").select("video_id").eq("visitor_id",visitorId);
  const liked=new Set((mine.data||[]).map(x=>x.video_id));

  box.innerHTML=q.data.map(v=>{
    const url=db.storage.from(BUCKET).getPublicUrl(v.file_path).data.publicUrl;
    const isLiked=liked.has(v.id);
    return `<article class="video-card">
      <video controls preload="metadata" src="${esc(url)}"></video>
      <h3>${esc(v.title)}</h3>
      <div class="video-actions">
        <button class="like-btn" onclick="likeVideo('${v.id}')" ${isLiked?"disabled":""}>
          ${isLiked?"❤️ Lájkolva":"🤍 Like"}
        </button>
        <span class="like-count">❤️ ${countMap[v.id]||0}</span>
      </div>
    </article>`;
  }).join("");
}

async function likeVideo(videoId){
  const r=await db.from("video_likes").insert({video_id:videoId,visitor_id:visitorId});
  if(r.error && r.error.code!=="23505"){
    alert("Like hiba: "+r.error.message);
    return;
  }
  await loadVideos();
}

async function uploadVideo(){
  const titleEl=document.getElementById("title");
  const fileEl=document.getElementById("file");
  const title=titleEl.value.trim();
  const file=fileEl.files[0];

  if(!title || !file){
    msg("uploadMsg","Írd be a címet és válassz videót.",true);
    return;
  }
  if(file.size>50*1024*1024){
    msg("uploadMsg","A videó maximum 50 MB lehet.",true);
    return;
  }

  msg("uploadMsg","Videó feltöltése...");

  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path="pending/"+crypto.randomUUID()+"-"+safeName;

  const up=await db.storage.from(BUCKET).upload(path,file,{
    contentType:file.type,
    upsert:false
  });

  if(up.error){
    msg("uploadMsg","Feltöltési hiba: "+up.error.message,true);
    return;
  }

  const ins=await db.from("videos").insert({
    title:title,
    file_path:path,
    status:"pending"
  });

  if(ins.error){
    await db.storage.from(BUCKET).remove([path]);
    msg("uploadMsg","Adatbázis hiba: "+ins.error.message,true);
    return;
  }

  titleEl.value="";
  fileEl.value="";
  msg("uploadMsg","✅ Siker! A videó elküldve ellenőrzésre.");
}

async function login(){
  const email=document.getElementById("email").value.trim();
  const password=document.getElementById("password").value;
  const r=await db.auth.signInWithPassword({email,password});
  if(r.error){
    msg("adminMsg","Belépési hiba: "+r.error.message,true);
    return;
  }
  msg("adminMsg","✅ Belépve.");
  await loadPending();
}

async function logout(){
  await db.auth.signOut();
  const p=document.getElementById("pending");
  if(p)p.innerHTML="";
  msg("adminMsg","Kijelentkezve.");
}

async function loadPending(){
  const a=await db.rpc("is_admin");
  if(a.error || a.data!==true){
    msg("adminMsg","Ez a fiók nem admin.",true);
    return;
  }

  const q=await db.from("videos")
    .select("*")
    .eq("status","pending")
    .order("created_at");

  if(q.error){
    msg("adminMsg",q.error.message,true);
    return;
  }

  const box=document.getElementById("pending");
  if(!q.data.length){
    box.innerHTML='<p class="muted">Nincs várakozó videó.</p>';
    return;
  }

  box.innerHTML=q.data.map(v=>{
    const url=db.storage.from(BUCKET).getPublicUrl(v.file_path).data.publicUrl;
    return `<div class="pending-item">
      <video controls src="${esc(url)}"></video>
      <h3>${esc(v.title)}</h3>
      <button onclick="moderate('${v.id}','approved')">✅ Jóváhagyás</button>
      <button onclick="moderate('${v.id}','rejected')">❌ Elutasítás</button>
    </div>`;
  }).join("");
}

async function moderate(id,status){
  const r=await db.from("videos").update({status}).eq("id",id);
  if(r.error){
    msg("adminMsg",r.error.message,true);
    return;
  }
  await loadPending();
  await loadVideos();
}

db.auth.onAuthStateChange(event=>{
  if(event==="SIGNED_IN") loadPending();
});

loadVideos();
