import { useState, useEffect } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, collection, onSnapshot, setDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCW1MT6kr6mNYj-E0cBXZQvbE7X6S_x-wc",
  authDomain: "kursal-planning.firebaseapp.com",
  projectId: "kursal-planning",
  storageBucket: "kursal-planning.firebasestorage.app",
  messagingSenderId: "244416060188",
  appId: "1:244416060188:web:c0bac411b9eb85525c78d9"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// ── Helpers ───────────────────────────────────────────────────────────
function toDateStr(d) { return d.toISOString().split("T")[0]; }
function getTodayPlus(n) { const d=new Date(); d.setDate(d.getDate()+n); return toDateStr(d); }
function formatDate(s) { const [,m,d]=s.split("-"); return `${d}/${m}`; }
function formatFullDate(s) { return new Date(s+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}); }
function genId() { return Math.random().toString(36).slice(2,9); }
function hoursUntil(date,time) { return (new Date(`${date}T${time}:00`)-new Date())/3600000; }
function birthdayPwd(s) { if(!s)return""; const[y,m,d]=s.split("-"); return`${d}${m}${y}`; }

const POSTES=["Salle","Bar","Cuisine"];
const JOURS_SHORT=["L","M","M","J","V","S","D"];
const MOIS=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function useCollection(col) {
  const [data,setData]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ const u=onSnapshot(collection(db,col),s=>{ setData(s.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); }); return u; },[col]);
  return [data,loading];
}
function useDoc(col,id) {
  const [data,setData]=useState(null);
  useEffect(()=>{ if(!id)return; const u=onSnapshot(doc(db,col,id),s=>setData(s.exists()?s.data():null)); return u; },[col,id]);
  return data;
}

function posteColor(p){return{Salle:"#e8f5e9",Bar:"#e3f2fd",Cuisine:"#fff3e0"}[p]||"#f5f5f5";}
function posteEmoji(p){return{Salle:"🍽",Bar:"🍸",Cuisine:"👨‍🍳"}[p]||"📋";}
function posteDot(p){return{Salle:"#43a047",Bar:"#1976d2",Cuisine:"#f57c00"}[p]||"#888";}

// ── App ───────────────────────────────────────────────────────────────
export default function App() {
  const [view,setView]=useState("login");
  const [currentUser,setCurrentUser]=useState(null);
  const [employees,empLoading]=useCollection("employees");
  const [shifts,shiftLoading]=useCollection("shifts");
  const config=useDoc("config","manager");
  const managerPwd=config?.pwd||"1234";
  const [unavailability]=useCollection("unavailability");
  const [workedHoursCol]=useCollection("workedHours");
  const loading=empLoading||shiftLoading;

  const notifs=shifts.filter(s=>{ const h=hoursUntil(s.date,s.debut); return h>0&&h<=48; });
  const logout=()=>{setView("login");setCurrentUser(null);};

  const addEmployee=async(e)=>{ const id=genId(); await setDoc(doc(db,"employees",id),{...e,id}); };
  const updateEmployee=async(e)=>{ await setDoc(doc(db,"employees",e.id),e); };
  const removeEmployee=async(id)=>{ await deleteDoc(doc(db,"employees",id)); shifts.filter(s=>s.employeeId===id).forEach(s=>deleteDoc(doc(db,"shifts",s.id))); };
  const addShift=async(s)=>{ const id=genId(); await setDoc(doc(db,"shifts",id),{...s,id}); };
  const removeShift=async(id)=>{ await deleteDoc(doc(db,"shifts",id)); };
  const setManagerPwd=async(pwd)=>{ await setDoc(doc(db,"config","manager"),{pwd}); };
  const addUnavail=async(empId,u)=>{ const id=genId(); await setDoc(doc(db,"unavailability",id),{...u,id,empId,status:"pending"}); };
  const removeUnavail=async(id)=>{ await deleteDoc(doc(db,"unavailability",id)); };
  const updateUnavailStatus=async(id,status)=>{ await updateDoc(doc(db,"unavailability",id),{status}); };
  const saveWorkedHours=async(empId,date,heures,note)=>{ const id=`${empId}_${date}`; await setDoc(doc(db,"workedHours",id),{empId,date,heures,note}); };

  if(loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#1a237e,#006064)",flexDirection:"column",gap:16}}>
      <span style={{fontSize:48}}>🍽</span>
      <div style={{color:"#fff",fontSize:18,fontWeight:700}}>Kursal de Panne</div>
      <div style={{color:"rgba(255,255,255,.6)",fontSize:14}}>Connexion à Firebase…</div>
    </div>
  );
  if(view==="login") return <LoginPage employees={employees} managerPwd={managerPwd} onLogin={(r,u)=>{setView(r);setCurrentUser(u);}}/>;
  if(view==="manager") return <ManagerView employees={employees} shifts={shifts} notifications={notifs} unavailability={unavailability} workedHoursCol={workedHoursCol} managerPwd={managerPwd} onAddEmployee={addEmployee} onUpdateEmployee={updateEmployee} onRemoveEmployee={removeEmployee} onAddShift={addShift} onRemoveShift={removeShift} onSetManagerPwd={setManagerPwd} onUpdateUnavailStatus={updateUnavailStatus} onLogout={logout}/>;
  if(view==="employee") {
    const empShifts=shifts.filter(s=>s.employeeId===currentUser.id);
    return <EmployeeView employee={currentUser} shifts={empShifts} allShifts={shifts} employees={employees} notifications={notifs.filter(s=>s.employeeId===currentUser.id)} unavailability={unavailability.filter(u=>u.empId===currentUser.id)} workedHours={workedHoursCol.filter(w=>w.empId===currentUser.id)} onAddUnavail={u=>addUnavail(currentUser.id,u)} onRemoveUnavail={removeUnavail} onSaveWorkedHours={(d,h,n)=>saveWorkedHours(currentUser.id,d,h,n)} onLogout={logout}/>;
  }
}

// ── Login ─────────────────────────────────────────────────────────────
function LoginPage({employees,managerPwd,onLogin}) {
  const [mode,setMode]=useState("choice");
  const [pin,setPin]=useState("");
  const [selEmp,setSelEmp]=useState("");
  const [pwd,setPwd]=useState("");
  const [step,setStep]=useState(1);
  const [err,setErr]=useState("");

  return (
    <div style={S.loginBg}>
      <div style={S.loginCard}>
        <div style={S.logoWrap}><span style={{fontSize:42}}>🍽</span><h1 style={S.logoTitle}>Kursal de Panne</h1><p style={S.logoSub}>Planning du personnel</p></div>
        {mode==="choice"&&(<div style={S.choiceWrap}>
          <button style={{...S.roleBtn,background:"#e8f5e9"}} onClick={()=>setMode("manager")}><span style={{fontSize:28}}>👨‍💼</span><span style={S.roleBtnLabel}>Manager</span></button>
          <button style={{...S.roleBtn,background:"#e3f2fd"}} onClick={()=>setMode("employee")}><span style={{fontSize:28}}>👤</span><span style={S.roleBtnLabel}>Employé</span></button>
        </div>)}
        {mode==="manager"&&(<div style={S.formWrap}>
          <p style={S.formLabel}>Code manager</p>
          <input style={S.input} type="password" placeholder="••••" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(pin===managerPwd?onLogin("manager",null):setErr("Code incorrect"))}/>
          {err&&<p style={S.errTxt}>{err}</p>}
          <button style={S.btnPrimary} onClick={()=>pin===managerPwd?onLogin("manager",null):setErr("Code incorrect")}>Connexion</button>
          <button style={S.btnGhost} onClick={()=>{setMode("choice");setErr("");setPin("");}}>Retour</button>
        </div>)}
        {mode==="employee"&&step===1&&(<div style={S.formWrap}>
          <p style={S.formLabel}>Sélectionner votre profil</p>
          <select style={S.input} value={selEmp} onChange={e=>setSelEmp(e.target.value)}>
            <option value="">-- Choisir --</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
          </select>
          {err&&<p style={S.errTxt}>{err}</p>}
          <button style={S.btnPrimary} onClick={()=>{if(!selEmp){setErr("Choisissez un employé");return;}setStep(2);setErr("");}}>Continuer</button>
          <button style={S.btnGhost} onClick={()=>{setMode("choice");setErr("");setSelEmp("");setStep(1);}}>Retour</button>
        </div>)}
        {mode==="employee"&&step===2&&(<div style={S.formWrap}>
          <p style={S.formLabel}>Mot de passe</p>
          <p style={{fontSize:12,color:"#888",marginTop:-4}}>Votre date de naissance (ex : 15061995)</p>
          <input style={S.input} type="password" placeholder="JJMMAAAA" value={pwd} maxLength={8} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>{ if(e.key!=="Enter")return; const emp=employees.find(x=>x.id===selEmp); if(pwd===birthdayPwd(emp?.naissance))onLogin("employee",emp); else setErr("Mot de passe incorrect"); }}/>
          {err&&<p style={S.errTxt}>{err}</p>}
          <button style={S.btnPrimary} onClick={()=>{ const emp=employees.find(x=>x.id===selEmp); if(pwd===birthdayPwd(emp?.naissance))onLogin("employee",emp); else setErr("Mot de passe incorrect (JJMMAAAA)"); }}>Accéder</button>
          <button style={S.btnGhost} onClick={()=>{setStep(1);setErr("");setPwd("");}}>Retour</button>
        </div>)}
      </div>
    </div>
  );
}

// ── Calendar Planning ────────────────────────────────────────────────
function CalendarPlanning({shifts,employees,onAddShift,onRemoveShift,isManager,myId}) {
  const today=new Date();
  const [viewMode,setViewMode]=useState("month"); // month|3week|2week|1week
  const [anchor,setAnchor]=useState(new Date(today.getFullYear(),today.getMonth(),1));
  const [selectedDate,setSelectedDate]=useState(null);
  const [addModal,setAddModal]=useState(null); // date string
  const [newShift,setNewShift]=useState({employeeId:"",debut:"09:00",fin:"",poste:"Salle"});
  const [saving,setSaving]=useState(false);

  // Calcule les jours à afficher selon la vue
  const getDays=()=>{
    if(viewMode==="month"){
      const y=anchor.getFullYear(), m=anchor.getMonth();
      const first=new Date(y,m,1);
      const startDow=(first.getDay()+6)%7; // lundi=0
      const daysInMonth=new Date(y,m+1,0).getDate();
      const days=[];
      for(let i=0;i<startDow;i++) days.push(null);
      for(let i=1;i<=daysInMonth;i++) days.push(toDateStr(new Date(y,m,i)));
      while(days.length%7!==0) days.push(null);
      return days;
    }
    const weeks=viewMode==="3week"?3:viewMode==="2week"?2:1;
    const mon=new Date(anchor);
    const dow=(mon.getDay()+6)%7;
    mon.setDate(mon.getDate()-dow);
    const days=[];
    for(let i=0;i<weeks*7;i++){ const d=new Date(mon); d.setDate(mon.getDate()+i); days.push(toDateStr(d)); }
    return days;
  };

  const days=getDays();
  const todayStr=toDateStr(today);

  const navigate=(dir)=>{
    const a=new Date(anchor);
    if(viewMode==="month"){ a.setMonth(a.getMonth()+dir); }
    else{ const w=viewMode==="3week"?3:viewMode==="2week"?2:1; a.setDate(a.getDate()+dir*w*7); }
    setAnchor(a);
  };

  const getLabel=()=>{
    if(viewMode==="month") return `${MOIS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    const first=days.find(d=>d); const last=[...days].reverse().find(d=>d);
    return first&&last?`${formatDate(first)} – ${formatDate(last)}`:"";
  };

  const handleDayClick=(dateStr)=>{
    if(!dateStr) return;
    if(isManager){
      const emp=employees[0];
      setNewShift({employeeId:emp?.id||"",debut:"09:00",fin:"",poste:emp?.poste||"Salle"});
      setAddModal(dateStr);
    } else {
      setSelectedDate(selectedDate===dateStr?null:dateStr);
    }
  };

  const handleAddShift=async()=>{
    if(!newShift.employeeId||!addModal) return;
    setSaving(true);
    await onAddShift({...newShift,date:addModal});
    setAddModal(null); setSaving(false);
  };

  const empName=id=>{ const e=employees.find(x=>x.id===id); return e?`${e.prenom} ${e.nom[0]}.`:"?"; };

  return (
    <div>
      {/* Sélecteur de vue */}
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {[["month","1 Mois"],["3week","3 Sem."],["2week","2 Sem."],["1week","1 Sem."]].map(([v,l])=>(
          <button key={v} onClick={()=>{setViewMode(v);setAnchor(new Date(today.getFullYear(),today.getMonth(),1));}} style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:viewMode===v?"#1a237e":"#fff",color:viewMode===v?"#fff":"#555",boxShadow:"0 1px 4px rgba(0,0,0,.1)"}}>{l}</button>
        ))}
      </div>

      {/* Navigation mois/semaine */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button style={S.weekBtn} onClick={()=>navigate(-1)}>‹</button>
        <span style={{fontWeight:800,fontSize:15,color:"#1a237e"}}>{getLabel()}</span>
        <button style={S.weekBtn} onClick={()=>navigate(1)}>›</button>
      </div>

      {/* En-tête jours */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {JOURS_SHORT.map((j,i)=><div key={i} style={{textAlign:"center",fontSize:11,fontWeight:700,color:"#888",padding:"4px 0"}}>{j}</div>)}
      </div>

      {/* Grille */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {days.map((dateStr,i)=>{
          if(!dateStr) return <div key={i} style={{minHeight:56}}/>;
          const dayShifts=shifts.filter(s=>s.date===dateStr);
          const isToday=dateStr===todayStr;
          const isSel=selectedDate===dateStr;
          const [,, dd]=dateStr.split("-");
          return (
            <div key={dateStr} onClick={()=>handleDayClick(dateStr)} style={{minHeight:56,borderRadius:10,padding:"4px 3px",cursor:"pointer",background:isSel?"#e8eaf6":isToday?"#e3f2fd":"#fff",border:isToday?"2px solid #1a237e":isSel?"2px solid #5c6bc0":"1px solid #eee",transition:"background .15s"}}>
              <div style={{textAlign:"center",fontWeight:isToday?900:500,fontSize:13,color:isToday?"#1a237e":"#333",marginBottom:2,background:isToday?"#1a237e":"transparent",borderRadius:"50%",width:22,height:22,lineHeight:"22px",margin:"0 auto 2px",color:isToday?"#fff":"#333"}}>{dd}</div>
              {dayShifts.slice(0,3).map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:2,marginBottom:1}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:posteDot(s.poste),flexShrink:0}}/>
                  <div style={{fontSize:9,color:"#444",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",fontWeight:myId&&s.employeeId===myId?700:400}}>{empName(s.employeeId)}</div>
                </div>
              ))}
              {dayShifts.length>3&&<div style={{fontSize:8,color:"#aaa",textAlign:"center"}}>+{dayShifts.length-3}</div>}
              {isManager&&<div style={{fontSize:10,color:"#bbb",textAlign:"center",marginTop:2}}>+</div>}
            </div>
          );
        })}
      </div>

      {/* Détail jour sélectionné (employé) */}
      {selectedDate&&!isManager&&(()=>{
        const dayShifts=shifts.filter(s=>s.date===selectedDate);
        return (
          <div style={{marginTop:16,background:"#fff",borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 12px rgba(0,0,0,.1)"}}>
            <div style={{fontWeight:800,fontSize:15,color:"#1a237e",marginBottom:10}}>{formatFullDate(selectedDate)}</div>
            {dayShifts.length===0?<div style={{color:"#ccc",textAlign:"center",padding:"12px 0"}}>Aucun service</div>
              :dayShifts.map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:10,marginBottom:6,background:posteColor(s.poste),border:myId&&s.employeeId===myId?"2px solid #1976d2":"none"}}>
                  <span style={{fontSize:18}}>{posteEmoji(s.poste)}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#222"}}>{employees.find(e=>e.id===s.employeeId)?.prenom} {employees.find(e=>e.id===s.employeeId)?.nom}</div>
                    <div style={{fontSize:11,color:"#666"}}>{s.debut}{s.fin?`–${s.fin}`:""} · {s.poste}</div>
                  </div>
                  {myId&&s.employeeId===myId&&<span style={{background:"#1976d2",color:"#fff",fontSize:9,borderRadius:4,padding:"2px 6px",fontWeight:700}}>Moi</span>}
                </div>
              ))
            }
          </div>
        );
      })()}

      {/* Modal ajout service (manager) */}
      {addModal&&isManager&&(
        <Modal title={`Service du ${formatFullDate(addModal)}`} onClose={()=>setAddModal(null)}>
          <label style={S.label}>Employé</label>
          <select style={S.input} value={newShift.employeeId} onChange={e=>{ const emp=employees.find(x=>x.id===e.target.value); setNewShift(p=>({...p,employeeId:e.target.value,poste:emp?.poste||"Salle"})); }}>
            <option value="">-- Choisir --</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.poste})</option>)}
          </select>
          <div style={{display:"flex",gap:10}}>
            <div style={{flex:1}}><label style={S.label}>Début</label><input style={S.input} type="time" value={newShift.debut} onChange={e=>setNewShift(p=>({...p,debut:e.target.value}))}/></div>
            <div style={{flex:1}}><label style={S.label}>Fin <span style={{color:"#aaa",fontWeight:400}}>(opt.)</span></label><input style={S.input} type="time" value={newShift.fin} onChange={e=>setNewShift(p=>({...p,fin:e.target.value}))}/></div>
          </div>
          <label style={S.label}>Poste</label>
          <select style={S.input} value={newShift.poste} onChange={e=>setNewShift(p=>({...p,poste:e.target.value}))}>
            {POSTES.map(p=><option key={p}>{p}</option>)}
          </select>
          {/* Services déjà ce jour */}
          {shifts.filter(s=>s.date===addModal).length>0&&(<>
            <div style={{fontSize:12,fontWeight:700,color:"#888",marginTop:8,marginBottom:4}}>SERVICES DU JOUR</div>
            {shifts.filter(s=>s.date===addModal).map(s=>(
              <div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,padding:"5px 8px",borderRadius:8,background:posteColor(s.poste),marginBottom:4}}>
                <span>{employees.find(e=>e.id===s.employeeId)?.prenom} — {s.debut}{s.fin?`–${s.fin}`:""} ({s.poste})</span>
                <button style={{background:"rgba(0,0,0,.08)",border:"none",borderRadius:4,cursor:"pointer",fontSize:11,padding:"2px 6px"}} onClick={()=>onRemoveShift(s.id)}>✕</button>
              </div>
            ))}
          </>)}
          <button style={{...S.btnPrimary,width:"100%",marginTop:12,opacity:saving?.6:1}} onClick={handleAddShift} disabled={saving}>{saving?"Enregistrement…":"Ajouter ce service"}</button>
        </Modal>
      )}
    </div>
  );
}

// ── Manager View ──────────────────────────────────────────────────────
function ManagerView({employees,shifts,notifications,unavailability,workedHoursCol,managerPwd,onAddEmployee,onUpdateEmployee,onRemoveEmployee,onAddShift,onRemoveShift,onSetManagerPwd,onUpdateUnavailStatus,onLogout}) {
  const [tab,setTab]=useState("planning");
  const [menuOpen,setMenuOpen]=useState(false);
  const [showAddEmp,setShowAddEmp]=useState(false);
  const [editEmp,setEditEmp]=useState(null);
  const [newEmp,setNewEmp]=useState({nom:"",prenom:"",adresse:"",telephone:"",type:"fixe",poste:"Salle",naissance:""});
  const [pwdForm,setPwdForm]=useState({ancien:"",nouveau:"",confirm:""});
  const [pwdMsg,setPwdMsg]=useState(null);
  const [saving,setSaving]=useState(false);
  const [indispoModal,setIndispoModal]=useState(null); // employee object
  const [indispoFin,setIndispoFin]=useState("");

  const navItems=[
    {id:"planning",icon:"📅",label:"Planning"},
    {id:"employees",icon:"👥",label:"Équipe"},
    {id:"overview",icon:"📊",label:"Vue d'ensemble"},
    {id:"notifs",icon:"🔔",label:`Alertes (${notifications.length})`},
    {id:"settings",icon:"⚙️",label:"Paramètres"},
  ];

  const handleAddEmp=async()=>{ if(!newEmp.nom||!newEmp.prenom)return; setSaving(true); await onAddEmployee(newEmp); setNewEmp({nom:"",prenom:"",adresse:"",telephone:"",type:"fixe",poste:"Salle",naissance:""}); setShowAddEmp(false); setSaving(false); };
  const handleSaveEmp=async()=>{ setSaving(true); await onUpdateEmployee(editEmp); setEditEmp(null); setSaving(false); };
  const handleDelEmp=async(id)=>{ if(!window.confirm("Supprimer ?"))return; await onRemoveEmployee(id); };
  const handleChangePwd=async()=>{ if(pwdForm.ancien!==managerPwd){setPwdMsg({type:"err",text:"Ancien code incorrect."});return;} if(pwdForm.nouveau.length<4){setPwdMsg({type:"err",text:"Min. 4 caractères."});return;} if(pwdForm.nouveau!==pwdForm.confirm){setPwdMsg({type:"err",text:"Mots de passe différents."});return;} await onSetManagerPwd(pwdForm.nouveau); setPwdForm({ancien:"",nouveau:"",confirm:""}); setPwdMsg({type:"ok",text:"Modifié ✅"}); };
  const totalH=empId=>workedHoursCol.filter(w=>w.empId===empId).reduce((s,w)=>s+(parseFloat(w.heures)||0),0);

  return (
    <div style={S.appWrap}>
      {menuOpen&&<div style={S.menuOverlay} onClick={()=>setMenuOpen(false)}/>}
      <div style={S.topBar}>
        <button style={S.hamburger} onClick={()=>setMenuOpen(o=>!o)}>{menuOpen?"✕":"☰"}</button>
        <span style={{fontSize:18}}>🍽</span>
        <span style={S.topBarTitle}>Kursal de Panne</span>
        <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
          {navItems.map(item=>(
            <button key={item.id} title={item.label} style={{...S.topNavBtn,...(tab===item.id?S.topNavBtnActive:{})}} onClick={()=>setTab(item.id)}>
              {item.icon}
              {item.id==="notifs"&&notifications.length>0&&<span style={S.notifDot}>{notifications.length}</span>}
            </button>
          ))}
        </div>
      </div>
      <aside style={{...S.sidebar,...(menuOpen?S.sidebarOpen:{})}}>
        <div style={S.sideHead}>
          <span style={{fontSize:20}}>🍽</span><span style={S.sideTitle}>Kursal de Panne</span>
          <button style={{...S.hamburger,marginLeft:"auto",color:"#fff"}} onClick={()=>setMenuOpen(false)}>✕</button>
        </div>
        <nav style={S.nav}>
          {navItems.map(item=>(
            <button key={item.id} style={{...S.navBtn,...(tab===item.id?S.navBtnActive:{})}} onClick={()=>{setTab(item.id);setMenuOpen(false);}}>
              <span style={{fontSize:18}}>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
          <div style={{height:1,background:"rgba(255,255,255,.15)",margin:"12px 0"}}/>
          <button style={{...S.navBtn,color:"#ffcdd2"}} onClick={()=>{setMenuOpen(false);onLogout();}}>
            <span style={{fontSize:18}}>↩</span><span>Déconnexion</span>
          </button>
        </nav>
        <button style={S.logoutBtn} onClick={onLogout}>↩ Déconnexion</button>
      </aside>

      <main style={S.main}>
        {/* PLANNING */}
        {tab==="planning"&&(<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h2 style={S.pageTitle}>Planning</h2>
          </div>
          <CalendarPlanning shifts={shifts} employees={employees} onAddShift={onAddShift} onRemoveShift={onRemoveShift} isManager={true}/>
        </>)}

        {/* ÉQUIPE */}
        {tab==="employees"&&(<>
          <div style={S.pageHeader}><h2 style={S.pageTitle}>Équipe ({employees.length})</h2><button style={S.btnPrimary} onClick={()=>setShowAddEmp(true)}>+ Ajouter</button></div>
          <div style={S.empGrid}>
            {employees.map(emp=>{
              const up=shifts.filter(s=>s.employeeId===emp.id&&s.date>=getTodayPlus(0));
              return (<div key={emp.id} style={S.empCard}>
                <div style={{...S.empAvatar,background:posteColor(emp.poste)}}>{emp.prenom[0]}{emp.nom[0]}</div>
                <div style={S.empInfo}>
                  <div style={S.empName}>{emp.prenom} {emp.nom}</div>
                  <div style={S.empDetail}>📍 {emp.adresse}</div>
                  <div style={S.empDetail}>📞 {emp.telephone}</div>
                  {emp.naissance&&<div style={S.empDetail}>🎂 {emp.naissance.split("-").reverse().join("/")}</div>}
                  <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                    <span style={{...S.badge,background:posteColor(emp.poste)}}>{emp.poste}</span>
                    <span style={{...S.badge,background:emp.type==="fixe"?"#dcedc8":"#fce4ec"}}>{emp.type==="fixe"?"Fixe":"Étudiant"}</span>
                    <span style={{...S.badge,background:"#e3f2fd"}}>{up.length} service{up.length!==1?"s":""} à venir</span>
                    <span style={{...S.badge,background:"#f3e5f5"}}>
                      {(()=>{ const now=new Date(); const y=now.getFullYear(); const m=String(now.getMonth()+1).padStart(2,"0"); return shifts.filter(s=>s.employeeId===emp.id&&s.date.startsWith(`${y}-${m}`)).length; })()} ce mois
                    </span>
                    {emp.indispo&&<span style={{...S.badge,background:"#ffcdd2",color:"#c62828"}}>🚫 Indisponible{emp.indispoFin?` jusqu'au ${formatDate(emp.indispoFin)}`:""}</span>}
                  </div>
                </div>
                <div style={S.empActions}>
                  <button style={S.btnEdit} onClick={()=>setEditEmp({...emp})}>✏️</button>
                  <button style={S.btnDel} onClick={()=>handleDelEmp(emp.id)}>🗑️</button>
                  <button style={{...S.btnEdit,background:emp.indispo?"#ffcdd2":"#f5f5f5",fontSize:11,padding:"5px 7px"}} onClick={()=>setIndispoModal(emp)} title="Gérer indisponibilité">🚫</button>
                </div>
              </div>);
            })}
          </div>
          {showAddEmp&&<Modal title="Nouvel employé" onClose={()=>setShowAddEmp(false)}><EmpForm data={newEmp} setData={setNewEmp}/><button style={{...S.btnPrimary,width:"100%",marginTop:12,opacity:saving?.6:1}} onClick={handleAddEmp} disabled={saving}>{saving?"Enregistrement…":"Ajouter"}</button></Modal>}
          {editEmp&&<Modal title="Modifier l'employé" onClose={()=>setEditEmp(null)}><EmpForm data={editEmp} setData={setEditEmp}/><button style={{...S.btnPrimary,width:"100%",marginTop:12,opacity:saving?.6:1}} onClick={handleSaveEmp} disabled={saving}>{saving?"Enregistrement…":"Enregistrer"}</button></Modal>}
          {indispoModal&&(
            <Modal title={`Indisponibilité — ${indispoModal.prenom} ${indispoModal.nom}`} onClose={()=>{setIndispoModal(null);setIndispoFin("");}}>
              {indispoModal.indispo?(
                <>
                  <div style={{background:"#ffcdd2",borderRadius:10,padding:"12px 14px",marginBottom:14,fontSize:13,fontWeight:600,color:"#c62828"}}>
                    🚫 Actuellement indisponible{indispoModal.indispoFin?` jusqu'au ${formatDate(indispoModal.indispoFin)}`:" (sans date de fin)"}
                  </div>
                  <button style={{...S.btnPrimary,width:"100%",background:"#43a047"}} onClick={async()=>{ setSaving(true); await onUpdateEmployee({...indispoModal,indispo:false,indispoFin:""}); setIndispoModal(null); setIndispoFin(""); setSaving(false); }}>
                    ✅ Remettre disponible
                  </button>
                </>
              ):(
                <>
                  <div style={{background:"#f5f5f5",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#555"}}>
                    ✅ Cet employé est actuellement disponible.
                  </div>
                  <label style={S.label}>Date de fin d'indisponibilité <span style={{color:"#aaa",fontWeight:400}}>(optionnel)</span></label>
                  <input style={{...S.input,marginBottom:14}} type="date" value={indispoFin} min={getTodayPlus(0)} onChange={e=>setIndispoFin(e.target.value)}/>
                  <button style={{...S.btnPrimary,width:"100%",background:"#e53935"}} onClick={async()=>{ setSaving(true); await onUpdateEmployee({...indispoModal,indispo:true,indispoFin:indispoFin||""}); setIndispoModal(null); setIndispoFin(""); setSaving(false); }}>
                    🚫 Mettre indisponible
                  </button>
                </>
              )}
            </Modal>
          )}
        </>)}

        {/* VUE D'ENSEMBLE */}
        {tab==="overview"&&(<>
          <div style={S.pageHeader}><h2 style={S.pageTitle}>Vue d'ensemble</h2></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
            {employees.map(emp=>{
              const up=shifts.filter(s=>s.employeeId===emp.id&&s.date>=getTodayPlus(0)).sort((a,b)=>a.date.localeCompare(b.date));
              return (<div key={emp.id} style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,.08)"}}>
                <div style={{background:posteColor(emp.poste),padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{...S.empAvatar,background:"rgba(255,255,255,.6)",flexShrink:0}}>{emp.prenom[0]}{emp.nom[0]}</div>
                  <div><div style={{fontWeight:800,fontSize:14}}>{emp.prenom} {emp.nom}</div><div style={{fontSize:11,color:"#555"}}>{emp.poste} · {emp.type==="fixe"?"Fixe":"Étudiant"}</div></div>
                  <div style={{marginLeft:"auto",textAlign:"right"}}><div style={{fontWeight:800,fontSize:16}}>{totalH(emp.id).toFixed(1)}h</div><div style={{fontSize:10,color:"#777"}}>saisies</div></div>
                </div>
                <div style={{padding:"10px 14px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:6}}>SERVICES À VENIR</div>
                  {up.length===0&&<div style={{color:"#ccc",fontSize:12}}>Aucun</div>}
                  {up.slice(0,3).map(s=><div key={s.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"3px 0",borderBottom:"1px solid #f5f5f5"}}><span style={{color:"#444"}}>{formatFullDate(s.date)}</span><span style={{color:"#666",fontWeight:600}}>{s.debut}{s.fin?`–${s.fin}`:""}</span></div>)}
                  {up.length>3&&<div style={{fontSize:10,color:"#aaa",marginTop:3}}>+{up.length-3} autres…</div>}
                </div>
              </div>);
            })}
          </div>
        </>)}

        {/* ALERTES */}
        {tab==="notifs"&&(<>
          <div style={S.pageHeader}><h2 style={S.pageTitle}>Alertes & Indisponibilités</h2></div>
          <h3 style={S.sectionTitle}>🔔 Services dans moins de 48h</h3>
          {notifications.length===0&&<div style={{...S.emptyBox,marginBottom:20}}>✅ Aucun service imminent</div>}
          {notifications.map(s=>{ const emp=employees.find(e=>e.id===s.employeeId); const h=hoursUntil(s.date,s.debut); return (
            <div key={s.id} style={S.notifCard}>
              <div style={S.notifIcon}>🔔</div>
              <div style={{flex:1}}><div style={S.notifName}>{emp?.prenom} {emp?.nom}</div><div style={S.notifDetail}>{formatFullDate(s.date)} · {s.debut}{s.fin?`–${s.fin}`:""} · {s.poste}</div><div style={S.notifContact}>📞 {emp?.telephone} · Dans {Math.round(h)}h</div></div>
              <span style={{...S.badge,background:h<24?"#ffccbc":"#fff9c4",alignSelf:"center"}}>{h<24?"⚠️ Urgent":"📬 Notifié"}</span>
            </div>
          );})}
          <div style={{height:1,background:"#e8eaf6",margin:"20px 0"}}/>
          <h3 style={S.sectionTitle}>🚫 Indisponibilités déclarées</h3>
          {unavailability.filter(u=>u.dateFin>=getTodayPlus(0)).length===0?<div style={S.emptyBox}>✅ Aucune indisponibilité</div>
            :unavailability.filter(u=>u.dateFin>=getTodayPlus(0)).sort((a,b)=>a.dateDebut.localeCompare(b.dateDebut)).map(u=>{ const emp=employees.find(e=>e.id===u.empId); const same=u.dateDebut===u.dateFin; const bc=u.status==="accepted"?"#43a047":u.status==="refused"?"#e53935":"#ff9800"; return (
              <div key={u.id} style={{...S.notifCard,borderLeft:`4px solid ${bc}`}}>
                <div style={{fontSize:24}}>🚫</div>
                <div style={{flex:1}}><div style={S.notifName}>{emp?.prenom} {emp?.nom}<span style={{...S.badge,background:posteColor(emp?.poste),marginLeft:8}}>{emp?.poste}</span></div><div style={S.notifDetail}>{same?formatFullDate(u.dateDebut):`${formatFullDate(u.dateDebut)} → ${formatFullDate(u.dateFin)}`}</div>{u.motif&&<div style={{fontSize:11,color:"#888",fontStyle:"italic"}}>💬 {u.motif}</div>}</div>
                <div style={{display:"flex",flexDirection:"column",gap:5,alignSelf:"center"}}>
                  {u.status==="pending"?(<><button onClick={()=>onUpdateUnavailStatus(u.id,"accepted")} style={{background:"#e8f5e9",border:"1.5px solid #43a047",color:"#2e7d32",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>✅ Accepter</button><button onClick={()=>onUpdateUnavailStatus(u.id,"refused")} style={{background:"#fce4ec",border:"1.5px solid #e53935",color:"#c62828",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>❌ Refuser</button></>)
                  :(<><span style={{...S.badge,background:u.status==="accepted"?"#e8f5e9":"#fce4ec",color:u.status==="accepted"?"#2e7d32":"#c62828"}}>{u.status==="accepted"?"✅ Acceptée":"❌ Refusée"}</span><button onClick={()=>onUpdateUnavailStatus(u.id,"pending")} style={{fontSize:10,color:"#888",background:"none",border:"none",cursor:"pointer"}}>Modifier</button></>)}
                </div>
              </div>
            );})}
        </>)}

        {/* PARAMÈTRES */}
        {tab==="settings"&&(<>
          <div style={S.pageHeader}><h2 style={S.pageTitle}>Paramètres</h2></div>
          <div style={{maxWidth:420}}>
            <div style={{background:"#fff",borderRadius:14,padding:"22px 24px",boxShadow:"0 2px 10px rgba(0,0,0,.08)"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}><span style={{fontSize:26}}>🔑</span><div><div style={{fontWeight:800,fontSize:15,color:"#1a237e"}}>Changer le mot de passe</div><div style={{fontSize:11,color:"#888"}}>Synchronisé via Firebase</div></div></div>
              <label style={S.label}>Ancien mot de passe</label>
              <input style={{...S.input,marginBottom:8}} type="password" value={pwdForm.ancien} onChange={e=>{setPwdForm(p=>({...p,ancien:e.target.value}));setPwdMsg(null);}}/>
              <label style={S.label}>Nouveau mot de passe</label>
              <input style={{...S.input,marginBottom:8}} type="password" value={pwdForm.nouveau} onChange={e=>{setPwdForm(p=>({...p,nouveau:e.target.value}));setPwdMsg(null);}}/>
              <label style={S.label}>Confirmer</label>
              <input style={{...S.input,marginBottom:14}} type="password" value={pwdForm.confirm} onChange={e=>{setPwdForm(p=>({...p,confirm:e.target.value}));setPwdMsg(null);}}/>
              {pwdMsg&&<div style={{borderRadius:8,padding:"9px 12px",marginBottom:10,fontSize:12,fontWeight:600,background:pwdMsg.type==="ok"?"#e8f5e9":"#fce4ec",color:pwdMsg.type==="ok"?"#2e7d32":"#c62828"}}>{pwdMsg.text}</div>}
              <button style={{...S.btnPrimary,width:"100%"}} onClick={handleChangePwd}>Enregistrer</button>
            </div>
          </div>
        </>)}
      </main>
    </div>
  );
}

// ── Employee View ─────────────────────────────────────────────────────
function EmployeeView({employee,shifts,allShifts,employees,notifications,unavailability,workedHours,onAddUnavail,onRemoveUnavail,onSaveWorkedHours,onLogout}) {
  const [tab,setTab]=useState("planning");
  const [menuOpen,setMenuOpen]=useState(false);
  const [editingHours,setEditingHours]=useState(null);
  const [newU,setNewU]=useState({dateDebut:getTodayPlus(1),dateFin:getTodayPlus(1),motif:""});
  const [unavailMsg,setUnavailMsg]=useState(null);
  const [saving,setSaving]=useState(false);
  const totalWorked=workedHours.reduce((s,w)=>s+(parseFloat(w.heures)||0),0);

  const navItems=[
    {id:"planning",icon:"📅",label:"Mon planning"},
    {id:"heures",icon:"⏱️",label:"Mes heures"},
    {id:"indispo",icon:"🚫",label:"Indisponibilités"},
  ];

  const handleAddUnavail=async()=>{ if(!newU.dateDebut||!newU.dateFin)return; if(newU.dateFin<newU.dateDebut){setUnavailMsg({type:"err",text:"La fin doit être après le début."});return;} setSaving(true); await onAddUnavail(newU); setNewU({dateDebut:getTodayPlus(1),dateFin:getTodayPlus(1),motif:""}); setUnavailMsg({type:"ok",text:"Enregistrée ✅"}); setTimeout(()=>setUnavailMsg(null),3000); setSaving(false); };
  const handleSaveHours=async()=>{ if(!editingHours)return; setSaving(true); await onSaveWorkedHours(editingHours.date,editingHours.heures,editingHours.note); setEditingHours(null); setSaving(false); };
  const upcoming=shifts.filter(s=>s.date>=getTodayPlus(0)).sort((a,b)=>a.date.localeCompare(b.date));

  return (
    <div style={S.appWrap}>
      {menuOpen&&<div style={S.menuOverlay} onClick={()=>setMenuOpen(false)}/>}
      <div style={S.topBar}>
        <button style={S.hamburger} onClick={()=>setMenuOpen(o=>!o)}>{menuOpen?"✕":"☰"}</button>
        <div style={{...S.empAvatar,width:30,height:30,fontSize:12,background:posteColor(employee.poste),flexShrink:0}}>{employee.prenom[0]}{employee.nom[0]}</div>
        <span style={S.topBarTitle}>{employee.prenom}</span>
        <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
          {navItems.map(item=>(
            <button key={item.id} title={item.label} style={{...S.topNavBtn,...(tab===item.id?S.topNavBtnActive:{})}} onClick={()=>setTab(item.id)}>{item.icon}</button>
          ))}
        </div>
      </div>
      <aside style={{...S.sidebar,...(menuOpen?S.sidebarOpen:{})}}>
        <div style={S.sideHead}>
          <span style={{fontSize:20}}>🍽</span><span style={S.sideTitle}>Kursal de Panne</span>
          <button style={{...S.hamburger,marginLeft:"auto",color:"#fff"}} onClick={()=>setMenuOpen(false)}>✕</button>
        </div>
        <div style={S.empProfileBox}>
          <div style={{...S.empAvatar,margin:"0 auto 8px",width:48,height:48,fontSize:17,background:posteColor(employee.poste)}}>{employee.prenom[0]}{employee.nom[0]}</div>
          <div style={{fontWeight:700,color:"#fff",fontSize:14}}>{employee.prenom} {employee.nom}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:2}}>{employee.poste} · {employee.type==="fixe"?"Fixe":"Étudiant"}</div>
        </div>
        <nav style={S.nav}>
          {navItems.map(item=>(
            <button key={item.id} style={{...S.navBtn,...(tab===item.id?S.navBtnActive:{})}} onClick={()=>{setTab(item.id);setMenuOpen(false);}}>
              <span style={{fontSize:18}}>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
          <div style={{height:1,background:"rgba(255,255,255,.15)",margin:"12px 0"}}/>
          <button style={{...S.navBtn,color:"#ffcdd2"}} onClick={()=>{setMenuOpen(false);onLogout();}}>
            <span style={{fontSize:18}}>↩</span><span>Déconnexion</span>
          </button>
        </nav>
        <button style={S.logoutBtn} onClick={onLogout}>↩ Déconnexion</button>
      </aside>

      <main style={S.main}>
        {notifications.length>0&&<div style={S.alertBanner}>🔔 {notifications.length} service{notifications.length>1?"s":""} dans moins de 48h !{notifications.map(s=><span key={s.id} style={{display:"block",fontSize:12,marginTop:3}}>➤ {formatFullDate(s.date)} à {s.debut}{s.fin?`–${s.fin}`:""} ({s.poste})</span>)}</div>}

        {/* MON PLANNING */}
        {tab==="planning"&&(<>
          <div style={{marginBottom:12}}>
            <h2 style={S.pageTitle}>Mon planning</h2>
            {upcoming.length>0&&<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
              {upcoming.slice(0,3).map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,background:posteColor(s.poste),padding:"10px 14px",borderRadius:12}}>
                  <span style={{fontSize:22}}>{posteEmoji(s.poste)}</span>
                  <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{formatFullDate(s.date)}</div><div style={{fontSize:11,color:"#555"}}>{s.debut}{s.fin?` – ${s.fin}`:" (fin à définir)"} · {s.poste}</div></div>
                  {hoursUntil(s.date,s.debut)<=48&&<span style={{...S.badge,background:"#ffccbc"}}>⏰ {Math.round(hoursUntil(s.date,s.debut))}h</span>}
                </div>
              ))}
            </div>}
          </div>
          <div style={{fontSize:13,fontWeight:700,color:"#888",marginBottom:8,textTransform:"uppercase"}}>Planning équipe</div>
          <CalendarPlanning shifts={allShifts} employees={employees} isManager={false} myId={employee.id}/>
        </>)}

        {/* MES HEURES */}
        {tab==="heures"&&(<>
          <div style={S.pageHeader}><h2 style={S.pageTitle}>Mes heures</h2><div style={{...S.badge,background:"#e8f5e9",fontSize:13,padding:"5px 12px"}}>Total : <strong>{totalWorked.toFixed(1)}h</strong></div></div>
          <p style={{color:"#888",fontSize:12,marginBottom:16}}>Visible uniquement par vous.</p>
          {shifts.filter(s=>s.date<=getTodayPlus(0)).sort((a,b)=>b.date.localeCompare(a.date)).length===0?<div style={S.emptyBox}>Aucun service passé.</div>
            :shifts.filter(s=>s.date<=getTodayPlus(0)).sort((a,b)=>b.date.localeCompare(a.date)).map(s=>{ const rec=workedHours.find(w=>w.date===s.date); return (
              <div key={s.id} style={{background:"#fff",borderRadius:12,padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 6px rgba(0,0,0,.07)",display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:22}}>{posteEmoji(s.poste)}</span>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{formatFullDate(s.date)}</div><div style={{fontSize:11,color:"#888"}}>{s.debut}{s.fin?`–${s.fin}`:""} · {s.poste}</div>{rec?.note&&<div style={{fontSize:11,color:"#666",fontStyle:"italic"}}>"{rec.note}"</div>}</div>
                {rec?<div style={{textAlign:"right"}}><div style={{fontWeight:800,fontSize:17,color:"#1a237e"}}>{rec.heures}h</div><button style={{fontSize:10,color:"#1976d2",background:"none",border:"none",cursor:"pointer"}} onClick={()=>setEditingHours({date:s.date,heures:rec.heures,note:rec.note||""})}>Modifier</button></div>
                :<button style={S.btnPrimary} onClick={()=>setEditingHours({date:s.date,heures:"",note:""})}>+ Saisir</button>}
              </div>
            );})}
          {editingHours&&<Modal title={`Heures du ${formatFullDate(editingHours.date)}`} onClose={()=>setEditingHours(null)}>
            <label style={S.label}>Heures travaillées</label>
            <input style={S.input} type="number" step="0.5" min="0" max="24" placeholder="ex : 7.5" value={editingHours.heures} onChange={e=>setEditingHours(p=>({...p,heures:e.target.value}))}/>
            <label style={S.label}>Note (optionnel)</label>
            <input style={S.input} placeholder="coupure, heures sup…" value={editingHours.note} onChange={e=>setEditingHours(p=>({...p,note:e.target.value}))}/>
            <button style={{...S.btnPrimary,width:"100%",marginTop:12,opacity:saving?.6:1}} onClick={handleSaveHours} disabled={saving}>{saving?"Enregistrement…":"Enregistrer"}</button>
          </Modal>}
        </>)}

        {/* INDISPONIBILITÉS */}
        {tab==="indispo"&&(<>
          <div style={S.pageHeader}><h2 style={S.pageTitle}>Mes indisponibilités</h2></div>
          <div style={{background:"#fff",borderRadius:14,padding:"16px 18px",marginBottom:18,boxShadow:"0 2px 10px rgba(0,0,0,.08)"}}>
            <div style={{fontWeight:700,fontSize:14,color:"#1a237e",marginBottom:12}}>➕ Déclarer une indisponibilité</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:130}}><label style={S.label}>Du</label><input style={S.input} type="date" value={newU.dateDebut} min={getTodayPlus(0)} onChange={e=>{setNewU(p=>({...p,dateDebut:e.target.value}));setUnavailMsg(null);}}/></div>
              <div style={{flex:1,minWidth:130}}><label style={S.label}>Au</label><input style={S.input} type="date" value={newU.dateFin} min={newU.dateDebut} onChange={e=>{setNewU(p=>({...p,dateFin:e.target.value}));setUnavailMsg(null);}}/></div>
            </div>
            <label style={{...S.label,marginTop:8,display:"block"}}>Motif <span style={{color:"#aaa",fontWeight:400}}>(opt.)</span></label>
            <input style={{...S.input,marginBottom:12}} placeholder="vacances, rdv…" value={newU.motif} onChange={e=>setNewU(p=>({...p,motif:e.target.value}))}/>
            {unavailMsg&&<div style={{borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,fontWeight:600,background:unavailMsg.type==="ok"?"#e8f5e9":"#fce4ec",color:unavailMsg.type==="ok"?"#2e7d32":"#c62828"}}>{unavailMsg.text}</div>}
            <button style={{...S.btnPrimary,width:"100%",opacity:saving?.6:1}} onClick={handleAddUnavail} disabled={saving}>{saving?"Enregistrement…":"Enregistrer"}</button>
          </div>
          {unavailability.filter(u=>u.dateFin>=getTodayPlus(0)).length===0?<div style={S.emptyBox}>Aucune indisponibilité.</div>
            :unavailability.filter(u=>u.dateFin>=getTodayPlus(0)).sort((a,b)=>a.dateDebut.localeCompare(b.dateDebut)).map(u=>{ const same=u.dateDebut===u.dateFin; return (
              <div key={u.id} style={{background:"#fff",borderRadius:12,padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 6px rgba(0,0,0,.07)",display:"flex",alignItems:"center",gap:12,borderLeft:`4px solid ${u.status==="accepted"?"#43a047":u.status==="refused"?"#e53935":"#ff9800"}`}}>
                <span style={{fontSize:20}}>🚫</span>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{same?formatFullDate(u.dateDebut):`${formatFullDate(u.dateDebut)} → ${formatFullDate(u.dateFin)}`}</div>{u.motif&&<div style={{fontSize:11,color:"#888",fontStyle:"italic"}}>💬 {u.motif}</div>}</div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
                  <span style={{...S.badge,background:u.status==="accepted"?"#e8f5e9":u.status==="refused"?"#fce4ec":"#fff9c4",color:u.status==="accepted"?"#2e7d32":u.status==="refused"?"#c62828":"#f57f17"}}>{u.status==="accepted"?"✅ Acceptée":u.status==="refused"?"❌ Refusée":"⏳ En attente"}</span>
                  {u.status==="pending"&&<button style={{background:"#fce4ec",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11}} onClick={()=>onRemoveUnavail(u.id)}>🗑️</button>}
                </div>
              </div>
            );})}
        </>)}
      </main>
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────
function EmpForm({data,setData}) {
  return (<>
    <div style={{display:"flex",gap:10}}>
      <div style={{flex:1}}><label style={S.label}>Prénom</label><input style={S.input} value={data.prenom} onChange={e=>setData(p=>({...p,prenom:e.target.value}))}/></div>
      <div style={{flex:1}}><label style={S.label}>Nom</label><input style={S.input} value={data.nom} onChange={e=>setData(p=>({...p,nom:e.target.value}))}/></div>
    </div>
    <label style={S.label}>Adresse</label><input style={S.input} value={data.adresse} onChange={e=>setData(p=>({...p,adresse:e.target.value}))}/>
    <label style={S.label}>Téléphone</label><input style={S.input} value={data.telephone} onChange={e=>setData(p=>({...p,telephone:e.target.value}))}/>
    <label style={S.label}>Date de naissance <span style={{color:"#aaa",fontWeight:400}}>(= mot de passe)</span></label>
    <input style={S.input} type="date" value={data.naissance||""} onChange={e=>setData(p=>({...p,naissance:e.target.value}))}/>
    <label style={S.label}>Poste habituel</label>
    <select style={S.input} value={data.poste||"Salle"} onChange={e=>setData(p=>({...p,poste:e.target.value}))}>{POSTES.map(p=><option key={p}>{p}</option>)}</select>
    <label style={S.label}>Type</label>
    <select style={S.input} value={data.type} onChange={e=>setData(p=>({...p,type:e.target.value}))}><option value="fixe">Fixe</option><option value="etudiant">Étudiant</option></select>
  </>);
}

function Modal({title,onClose,children}) {
  return (<div style={S.overlay}><div style={S.modal}>
    <div style={S.modalHead}><h3 style={S.modalTitle}>{title}</h3><button style={S.modalClose} onClick={onClose}>✕</button></div>
    <div style={S.modalBody}>{children}</div>
  </div></div>);
}

// ── Styles ────────────────────────────────────────────────────────────
const S = {
  loginBg:{minHeight:"100vh",background:"linear-gradient(135deg,#1a237e 0%,#0d47a1 60%,#006064 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Georgia',serif"},
  loginCard:{background:"#fff",borderRadius:20,padding:"36px 32px",width:320,boxShadow:"0 24px 64px rgba(0,0,0,.3)",textAlign:"center"},
  logoWrap:{marginBottom:24},
  logoTitle:{margin:"6px 0 4px",fontSize:19,fontWeight:800,color:"#1a237e",letterSpacing:-0.5},
  logoSub:{margin:0,color:"#888",fontSize:12},
  choiceWrap:{display:"flex",gap:12,justifyContent:"center"},
  roleBtn:{flex:1,border:"none",borderRadius:14,padding:"16px 8px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:8,boxShadow:"0 2px 8px rgba(0,0,0,.08)"},
  roleBtnLabel:{fontSize:12,fontWeight:700,color:"#333"},
  formWrap:{display:"flex",flexDirection:"column",gap:10,textAlign:"left"},
  formLabel:{fontWeight:700,color:"#1a237e",marginBottom:-4},
  input:{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #ddd",fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit"},
  btnPrimary:{background:"#1a237e",color:"#fff",border:"none",borderRadius:10,padding:"11px 18px",fontWeight:700,cursor:"pointer",fontSize:13},
  btnGhost:{background:"transparent",color:"#888",border:"1.5px solid #ddd",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontSize:12,marginTop:-4},
  errTxt:{color:"#e53935",fontSize:12,margin:"2px 0"},
  appWrap:{display:"flex",minHeight:"100vh",flexDirection:"column",fontFamily:"'Segoe UI',sans-serif",background:"#f8f9fb"},
  topBar:{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#1a237e",color:"#fff",position:"sticky",top:0,zIndex:200,flexShrink:0},
  topBarTitle:{fontWeight:700,fontSize:14,color:"#fff"},
  hamburger:{background:"none",border:"none",color:"#fff",fontSize:22,cursor:"pointer",padding:"2px 4px",lineHeight:1},
  topNavBtn:{background:"rgba(255,255,255,.12)",border:"none",borderRadius:8,padding:"5px 7px",fontSize:16,cursor:"pointer",position:"relative"},
  topNavBtnActive:{background:"rgba(255,255,255,.3)"},
  notifDot:{position:"absolute",top:-4,right:-4,background:"#ff5252",color:"#fff",borderRadius:"50%",fontSize:8,width:13,height:13,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700},
  menuOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:299},
  sidebar:{position:"fixed",top:0,left:"-280px",width:260,height:"100vh",background:"#1a237e",color:"#fff",display:"flex",flexDirection:"column",zIndex:300,transition:"left .25s ease",overflowY:"auto"},
  sidebarOpen:{left:0},
  sideHead:{display:"flex",alignItems:"center",gap:10,padding:"16px 18px",borderBottom:"1px solid rgba(255,255,255,.15)"},
  sideTitle:{fontWeight:800,fontSize:14,letterSpacing:-0.3},
  empProfileBox:{padding:"14px 18px 16px",borderBottom:"1px solid rgba(255,255,255,.15)",textAlign:"center"},
  nav:{flex:1,padding:"14px 10px",display:"flex",flexDirection:"column",gap:4},
  navBtn:{background:"transparent",border:"none",color:"rgba(255,255,255,.75)",borderRadius:10,padding:"10px 12px",textAlign:"left",cursor:"pointer",fontSize:13,display:"flex",gap:10,alignItems:"center"},
  navBtnActive:{background:"rgba(255,255,255,.18)",color:"#fff",fontWeight:700},
  logoutBtn:{margin:"0 10px 16px",background:"rgba(255,255,255,.1)",border:"none",color:"rgba(255,255,255,.7)",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:12},
  main:{flex:1,padding:"16px 14px",overflowY:"auto"},
  pageHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16},
  pageTitle:{margin:0,fontSize:20,fontWeight:800,color:"#1a1a1a"},
  sectionTitle:{fontSize:13,fontWeight:700,color:"#555",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:0.5},
  weekBtn:{background:"#fff",border:"1.5px solid #ddd",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600},
  empGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12},
  empCard:{background:"#fff",borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"flex-start",gap:12,boxShadow:"0 1px 8px rgba(0,0,0,.08)"},
  empAvatar:{width:42,height:42,borderRadius:"50%",background:"#e8eaf6",color:"#1a237e",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,flexShrink:0},
  empInfo:{flex:1,minWidth:0},
  empName:{fontWeight:700,fontSize:14,color:"#1a1a1a"},
  empDetail:{fontSize:11,color:"#777",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  empActions:{display:"flex",flexDirection:"column",gap:5},
  btnEdit:{background:"#e3f2fd",border:"none",borderRadius:7,padding:"5px 9px",cursor:"pointer",fontSize:13},
  btnDel:{background:"#fce4ec",border:"none",borderRadius:7,padding:"5px 9px",cursor:"pointer",fontSize:13},
  badge:{display:"inline-block",padding:"3px 8px",borderRadius:20,fontSize:10,fontWeight:600,color:"#333"},
  notifCard:{background:"#fff",borderRadius:12,padding:"14px 16px",display:"flex",gap:12,alignItems:"flex-start",boxShadow:"0 1px 6px rgba(0,0,0,.07)",marginBottom:8},
  notifIcon:{fontSize:22},
  notifName:{fontWeight:700,fontSize:14,color:"#1a1a1a"},
  notifDetail:{fontSize:12,color:"#555",marginTop:3},
  notifContact:{fontSize:11,color:"#888",marginTop:3},
  emptyBox:{background:"#f0f4f8",borderRadius:10,padding:"20px",textAlign:"center",color:"#666",fontSize:13},
  alertBanner:{background:"linear-gradient(90deg,#ff6f00,#ffa000)",color:"#fff",borderRadius:12,padding:"12px 16px",marginBottom:16,fontWeight:600,fontSize:13,boxShadow:"0 4px 12px rgba(255,111,0,.3)"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400},
  modal:{background:"#fff",borderRadius:16,width:400,maxWidth:"94vw",boxShadow:"0 24px 64px rgba(0,0,0,.3)",overflow:"hidden",maxHeight:"90vh",overflowY:"auto"},
  modalHead:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px",borderBottom:"1px solid #eee",background:"#f8f9ff"},
  modalTitle:{margin:0,fontSize:15,fontWeight:800,color:"#1a237e"},
  modalClose:{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#888"},
  modalBody:{padding:"18px",display:"flex",flexDirection:"column",gap:8},
  label:{fontSize:11,fontWeight:700,color:"#555",marginBottom:-4},
};
