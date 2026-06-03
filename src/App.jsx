import { useState, useEffect } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, collection,
  onSnapshot, setDoc, deleteDoc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase init ─────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCW1MT6kr6mNYj-E0cBXZQvbE7X6S_x-wc",
  authDomain: "kursal-planning.firebaseapp.com",
  projectId: "kursal-planning",
  storageBucket: "kursal-planning.firebasestorage.app",
  messagingSenderId: "244416060188",
  appId: "1:244416060188:web:c0bac411b9eb85525c78d9"
};
const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);

// ── Helpers ───────────────────────────────────────────────────────────
function getTodayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function getWeekDays(offset = 0) {
  const today = new Date();
  today.setDate(today.getDate() + offset * 7);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}
function formatDate(s) { const [,m,d]=s.split("-"); return `${d}/${m}`; }
function formatFullDate(s) {
  return new Date(s+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
}
function genId() { return Math.random().toString(36).slice(2,9); }
function hoursUntil(dateStr, timeStr) {
  return (new Date(`${dateStr}T${timeStr}:00`) - new Date()) / 3_600_000;
}
function birthdayPwd(dateStr) {
  if (!dateStr) return "";
  const [y,m,d] = dateStr.split("-");
  return `${d}${m}${y}`;
}

const POSTES  = ["Salle","Bar","Cuisine"];
const JOURS   = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

// ── Hook Firebase realtime ────────────────────────────────────────────
function useCollection(colName) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, colName), snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [colName]);
  return [data, loading];
}
function useDoc(colName, docId) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!docId) return;
    const unsub = onSnapshot(doc(db, colName, docId), snap => {
      setData(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, [colName, docId]);
  return data;
}

// ── App racine ────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]           = useState("login");
  const [currentUser, setCurrentUser] = useState(null);

  const [employees, empLoading]   = useCollection("employees");
  const [shifts, shiftLoading]    = useCollection("shifts");

  // Config (mot de passe manager)
  const config = useDoc("config", "manager");
  const managerPwd = config?.pwd || "1234";

  // Indisponibilités (collection globale)
  const [unavailability, unavailLoading] = useCollection("unavailability");

  // Heures travaillées (collection globale)
  const [workedHoursCol] = useCollection("workedHours");

  const loading = empLoading || shiftLoading;

  const pendingNotifications = shifts.filter(s => {
    const h = hoursUntil(s.date, s.debut);
    return h > 0 && h <= 48;
  });

  // ── Écriture Firestore ──
  const addEmployee = async (emp) => {
    const id = genId();
    await setDoc(doc(db,"employees",id), { ...emp, id });
  };
  const updateEmployee = async (emp) => {
    await setDoc(doc(db,"employees",emp.id), emp);
  };
  const removeEmployee = async (id) => {
    await deleteDoc(doc(db,"employees",id));
    // supprimer ses services
    shifts.filter(s=>s.employeeId===id).forEach(s=>deleteDoc(doc(db,"shifts",s.id)));
  };
  const addShift = async (shift) => {
    const id = genId();
    await setDoc(doc(db,"shifts",id), { ...shift, id });
  };
  const removeShift = async (id) => {
    await deleteDoc(doc(db,"shifts",id));
  };
  const setManagerPwd = async (pwd) => {
    await setDoc(doc(db,"config","manager"), { pwd });
  };
  const addUnavail = async (empId, u) => {
    const id = genId();
    await setDoc(doc(db,"unavailability",id), { ...u, id, empId, status:"pending" });
  };
  const removeUnavail = async (id) => {
    await deleteDoc(doc(db,"unavailability",id));
  };
  const updateUnavailStatus = async (id, status) => {
    await updateDoc(doc(db,"unavailability",id), { status });
  };
  const saveWorkedHours = async (empId, date, heures, note) => {
    const id = `${empId}_${date}`;
    await setDoc(doc(db,"workedHours",id), { empId, date, heures, note });
  };

  const logout = () => { setView("login"); setCurrentUser(null); };

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#1a237e,#006064)", flexDirection:"column", gap:16 }}>
      <span style={{ fontSize:48 }}>🍽</span>
      <div style={{ color:"#fff", fontSize:18, fontWeight:700 }}>Kursal de Panne</div>
      <div style={{ color:"rgba(255,255,255,.6)", fontSize:14 }}>Connexion à Firebase…</div>
    </div>
  );

  if (view === "login")
    return <LoginPage employees={employees} managerPwd={managerPwd}
             onLogin={(role,user)=>{ setView(role); setCurrentUser(user); }} />;

  if (view === "manager")
    return <ManagerView
      employees={employees} shifts={shifts}
      notifications={pendingNotifications}
      unavailability={unavailability}
      workedHoursCol={workedHoursCol}
      managerPwd={managerPwd}
      onAddEmployee={addEmployee} onUpdateEmployee={updateEmployee} onRemoveEmployee={removeEmployee}
      onAddShift={addShift} onRemoveShift={removeShift}
      onSetManagerPwd={setManagerPwd}
      onUpdateUnavailStatus={updateUnavailStatus}
      onLogout={logout} />;

  if (view === "employee") {
    const empShifts       = shifts.filter(s => s.employeeId === currentUser.id);
    const empUnavail      = unavailability.filter(u => u.empId === currentUser.id);
    const empWorked       = workedHoursCol.filter(w => w.empId === currentUser.id);
    const empNotifs       = pendingNotifications.filter(s => s.employeeId === currentUser.id);
    return <EmployeeView
      employee={currentUser} shifts={empShifts} allShifts={shifts}
      employees={employees} notifications={empNotifs}
      unavailability={empUnavail} workedHours={empWorked}
      onAddUnavail={(u)=>addUnavail(currentUser.id, u)}
      onRemoveUnavail={removeUnavail}
      onSaveWorkedHours={(date,h,n)=>saveWorkedHours(currentUser.id,date,h,n)}
      onLogout={logout} />;
  }
}

// ── Connexion ─────────────────────────────────────────────────────────
function LoginPage({ employees, managerPwd, onLogin }) {
  const [mode,setMode]   = useState("choice");
  const [pin,setPin]     = useState("");
  const [selEmp,setSelEmp] = useState("");
  const [pwd,setPwd]     = useState("");
  const [step,setStep]   = useState(1);
  const [error,setError] = useState("");

  const handleManager = () => {
    if (pin === managerPwd) onLogin("manager",null);
    else setError("Code incorrect");
  };
  const handleEmpPwd = () => {
    const emp = employees.find(e=>e.id===selEmp);
    if (!emp) return;
    if (pwd === birthdayPwd(emp.naissance)) onLogin("employee",emp);
    else setError("Mot de passe incorrect (date d'anniversaire JJMMAAAA)");
  };

  return (
    <div style={S.loginBg}>
      <div style={S.loginCard}>
        <div style={S.logoWrap}>
          <span style={S.logoIcon}>🍽</span>
          <h1 style={S.logoTitle}>Kursal de Panne</h1>
          <p style={S.logoSub}>Planning du personnel</p>
        </div>

        {mode==="choice" && (
          <div style={S.choiceWrap}>
            <button style={{...S.roleBtn,background:"#e8f5e9"}} onClick={()=>setMode("manager")}>
              <span style={{fontSize:28}}>👨‍💼</span><span style={S.roleBtnLabel}>Manager</span>
            </button>
            <button style={{...S.roleBtn,background:"#e3f2fd"}} onClick={()=>setMode("employee")}>
              <span style={{fontSize:28}}>👤</span><span style={S.roleBtnLabel}>Employé</span>
            </button>
          </div>
        )}

        {mode==="manager" && (
          <div style={S.formWrap}>
            <p style={S.formLabel}>Code manager</p>
            <input style={S.input} type="password" placeholder="••••" value={pin}
              onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleManager()} />
            {error && <p style={S.errTxt}>{error}</p>}
            <button style={S.btnPrimary} onClick={handleManager}>Connexion</button>
            <button style={S.btnGhost} onClick={()=>{setMode("choice");setError("");setPin("");}}>Retour</button>
          </div>
        )}

        {mode==="employee" && step===1 && (
          <div style={S.formWrap}>
            <p style={S.formLabel}>Sélectionner votre profil</p>
            <select style={S.input} value={selEmp} onChange={e=>setSelEmp(e.target.value)}>
              <option value="">-- Choisir --</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
            </select>
            {error && <p style={S.errTxt}>{error}</p>}
            <button style={S.btnPrimary} onClick={()=>{if(!selEmp){setError("Choisissez un employé");return;}setStep(2);setError("");}}>Continuer</button>
            <button style={S.btnGhost} onClick={()=>{setMode("choice");setError("");setSelEmp("");setStep(1);}}>Retour</button>
          </div>
        )}

        {mode==="employee" && step===2 && (
          <div style={S.formWrap}>
            <p style={S.formLabel}>Mot de passe</p>
            <p style={{fontSize:12,color:"#888",marginTop:-4}}>Votre date de naissance (ex : 15061995)</p>
            <input style={S.input} type="password" placeholder="JJMMAAAA" value={pwd} maxLength={8}
              onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleEmpPwd()} />
            {error && <p style={S.errTxt}>{error}</p>}
            <button style={S.btnPrimary} onClick={handleEmpPwd}>Accéder</button>
            <button style={S.btnGhost} onClick={()=>{setStep(1);setError("");setPwd("");}}>Retour</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Vue Manager ───────────────────────────────────────────────────────
function ManagerView({ employees, shifts, notifications, unavailability, workedHoursCol, managerPwd,
  onAddEmployee, onUpdateEmployee, onRemoveEmployee, onAddShift, onRemoveShift,
  onSetManagerPwd, onUpdateUnavailStatus, onLogout }) {

  const [tab,setTab]           = useState("planning");
  const [weekOffset,setWeek]   = useState(0);
  const [showAddEmp,setShowAddEmp]     = useState(false);
  const [showAddShift,setShowAddShift] = useState(false);
  const [editEmp,setEditEmp]   = useState(null);
  const [newEmp,setNewEmp]     = useState({nom:"",prenom:"",adresse:"",telephone:"",type:"fixe",poste:"Salle",naissance:""});
  const [newShift,setNewShift] = useState({employeeId:"",date:getTodayPlus(0),debut:"09:00",fin:"",poste:"Salle"});
  const [pwdForm,setPwdForm]   = useState({ancien:"",nouveau:"",confirm:""});
  const [pwdMsg,setPwdMsg]     = useState(null);
  const [saving,setSaving]     = useState(false);

  const weekDays = getWeekDays(weekOffset);
  const empName  = id => { const e=employees.find(e=>e.id===id); return e?`${e.prenom} ${e.nom}`:"?"; };

  const handleAddEmployee = async () => {
    if (!newEmp.nom||!newEmp.prenom) return;
    setSaving(true);
    await onAddEmployee(newEmp);
    setNewEmp({nom:"",prenom:"",adresse:"",telephone:"",type:"fixe",poste:"Salle",naissance:""});
    setShowAddEmp(false); setSaving(false);
  };
  const handleSaveEditEmp = async () => {
    setSaving(true);
    await onUpdateEmployee(editEmp);
    setEditEmp(null); setSaving(false);
  };
  const handleDelEmployee = async (id) => {
    if (!window.confirm("Supprimer cet employé et ses services ?")) return;
    await onRemoveEmployee(id);
  };
  const handleAddShift = async () => {
    if (!newShift.employeeId||!newShift.date) return;
    setSaving(true);
    await onAddShift(newShift);
    setNewShift({employeeId:"",date:getTodayPlus(0),debut:"09:00",fin:"",poste:"Salle"});
    setShowAddShift(false); setSaving(false);
  };
  const handleChangePwd = async () => {
    if (pwdForm.ancien!==managerPwd) { setPwdMsg({type:"err",text:"Ancien mot de passe incorrect."}); return; }
    if (pwdForm.nouveau.length<4)    { setPwdMsg({type:"err",text:"Minimum 4 caractères."}); return; }
    if (pwdForm.nouveau!==pwdForm.confirm) { setPwdMsg({type:"err",text:"Les mots de passe ne correspondent pas."}); return; }
    await onSetManagerPwd(pwdForm.nouveau);
    setPwdForm({ancien:"",nouveau:"",confirm:""});
    setPwdMsg({type:"ok",text:"Mot de passe modifié ✅"});
  };

  // Total heures par employé
  const totalHoursForEmp = (empId) =>
    workedHoursCol.filter(w=>w.empId===empId).reduce((s,w)=>s+(parseFloat(w.heures)||0),0);

  return (
    <div style={S.appWrap}>
      <aside style={S.sidebar}>
        <div style={S.sideHead}><span style={{fontSize:22}}>🍽</span><span style={S.sideTitle}>Kursal de Panne</span></div>
        <nav style={S.nav}>
          {[
            {id:"planning", icon:"📅", label:"Planning"},
            {id:"employees",icon:"👥", label:"Équipe"},
            {id:"overview", icon:"📊", label:"Vue d'ensemble"},
            {id:"notifs",   icon:"🔔", label:`Alertes (${notifications.length})`},
            {id:"settings", icon:"⚙️",  label:"Paramètres"},
          ].map(item=>(
            <button key={item.id} style={{...S.navBtn,...(tab===item.id?S.navBtnActive:{})}} onClick={()=>setTab(item.id)}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <button style={S.logoutBtn} onClick={onLogout}>↩ Déconnexion</button>
      </aside>

      <main style={S.main}>

        {/* ── PLANNING ── */}
        {tab==="planning" && (<>
          <div style={S.pageHeader}>
            <h2 style={S.pageTitle}>Planning de la semaine</h2>
            <button style={S.btnPrimary} onClick={()=>setShowAddShift(true)}>+ Ajouter un service</button>
          </div>
          <div style={S.weekNav}>
            <button style={S.weekBtn} onClick={()=>setWeek(o=>o-1)}>‹ Préc.</button>
            <span style={S.weekLabel}>{formatDate(weekDays[0])} – {formatDate(weekDays[6])}</span>
            <button style={S.weekBtn} onClick={()=>setWeek(o=>o+1)}>Suiv. ›</button>
          </div>
          <div style={S.planGrid}>
            {weekDays.map((day,i)=>{
              const dayShifts = shifts.filter(s=>s.date===day);
              return (
                <div key={day} style={S.dayCol}>
                  <div style={S.dayHeader}>
                    <span style={S.dayName}>{JOURS[i]}</span>
                    <span style={S.dayDate}>{formatDate(day)}</span>
                  </div>
                  <div style={S.dayShifts}>
                    {dayShifts.length===0 && <p style={S.noShift}>—</p>}
                    {dayShifts.map(s=>(
                      <div key={s.id} style={{...S.shiftCard,background:posteColor(s.poste)}}>
                        <div style={S.shiftName}>{empName(s.employeeId)}</div>
                        <div style={S.shiftTime}>{s.debut}{s.fin?`–${s.fin}`:""}</div>
                        <div style={S.shiftPoste}>{s.poste}</div>
                        <button style={S.shiftDel} onClick={()=>onRemoveShift(s.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {showAddShift && (
            <Modal title="Nouveau service" onClose={()=>setShowAddShift(false)}>
              <label style={S.label}>Employé</label>
              <select style={S.input} value={newShift.employeeId} onChange={e=>{
                const emp=employees.find(x=>x.id===e.target.value);
                setNewShift(p=>({...p,employeeId:e.target.value,poste:emp?.poste||"Salle"}));
              }}>
                <option value="">-- Choisir --</option>
                {employees.map(e=><option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.poste})</option>)}
              </select>
              <label style={S.label}>Date</label>
              <input style={S.input} type="date" value={newShift.date} onChange={e=>setNewShift(p=>({...p,date:e.target.value}))} />
              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1}}><label style={S.label}>Début</label><input style={S.input} type="time" value={newShift.debut} onChange={e=>setNewShift(p=>({...p,debut:e.target.value}))} /></div>
                <div style={{flex:1}}><label style={S.label}>Fin <span style={{color:"#aaa",fontWeight:400}}>(optionnel)</span></label><input style={S.input} type="time" value={newShift.fin} onChange={e=>setNewShift(p=>({...p,fin:e.target.value}))} /></div>
              </div>
              <label style={S.label}>Poste</label>
              <select style={S.input} value={newShift.poste} onChange={e=>setNewShift(p=>({...p,poste:e.target.value}))}>
                {POSTES.map(p=><option key={p}>{p}</option>)}
              </select>
              <button style={{...S.btnPrimary,width:"100%",marginTop:12,opacity:saving?.6:1}} onClick={handleAddShift} disabled={saving}>{saving?"Enregistrement…":"Enregistrer"}</button>
            </Modal>
          )}
        </>)}

        {/* ── ÉQUIPE ── */}
        {tab==="employees" && (<>
          <div style={S.pageHeader}>
            <h2 style={S.pageTitle}>Équipe ({employees.length})</h2>
            <button style={S.btnPrimary} onClick={()=>setShowAddEmp(true)}>+ Ajouter</button>
          </div>
          <div style={S.empGrid}>
            {employees.map(emp=>{
              const upcoming=shifts.filter(s=>s.employeeId===emp.id&&s.date>=getTodayPlus(0));
              return (
                <div key={emp.id} style={S.empCard}>
                  <div style={{...S.empAvatar,background:posteColor(emp.poste)}}>{emp.prenom[0]}{emp.nom[0]}</div>
                  <div style={S.empInfo}>
                    <div style={S.empName}>{emp.prenom} {emp.nom}</div>
                    <div style={S.empDetail}>📍 {emp.adresse}</div>
                    <div style={S.empDetail}>📞 {emp.telephone}</div>
                    {emp.naissance&&<div style={S.empDetail}>🎂 {emp.naissance.split("-").reverse().join("/")}</div>}
                    <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                      <span style={{...S.badge,background:posteColor(emp.poste)}}>{emp.poste}</span>
                      <span style={{...S.badge,background:emp.type==="fixe"?"#dcedc8":"#fce4ec"}}>{emp.type==="fixe"?"Fixe":"Étudiant"}</span>
                      <span style={{...S.badge,background:"#e3f2fd"}}>{upcoming.length} service{upcoming.length!==1?"s":""} à venir</span>
                    </div>
                  </div>
                  <div style={S.empActions}>
                    <button style={S.btnEdit} onClick={()=>setEditEmp({...emp})}>✏️</button>
                    <button style={S.btnDel} onClick={()=>handleDelEmployee(emp.id)}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
          {showAddEmp && (
            <Modal title="Nouvel employé" onClose={()=>setShowAddEmp(false)}>
              <EmpForm data={newEmp} setData={setNewEmp} />
              <button style={{...S.btnPrimary,width:"100%",marginTop:12,opacity:saving?.6:1}} onClick={handleAddEmployee} disabled={saving}>{saving?"Enregistrement…":"Ajouter"}</button>
            </Modal>
          )}
          {editEmp && (
            <Modal title="Modifier l'employé" onClose={()=>setEditEmp(null)}>
              <EmpForm data={editEmp} setData={setEditEmp} />
              <button style={{...S.btnPrimary,width:"100%",marginTop:12,opacity:saving?.6:1}} onClick={handleSaveEditEmp} disabled={saving}>{saving?"Enregistrement…":"Enregistrer"}</button>
            </Modal>
          )}
        </>)}

        {/* ── VUE D'ENSEMBLE ── */}
        {tab==="overview" && (<>
          <div style={S.pageHeader}><h2 style={S.pageTitle}>Vue d'ensemble</h2></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
            {employees.map(emp=>{
              const empShifts=shifts.filter(s=>s.employeeId===emp.id).sort((a,b)=>a.date.localeCompare(b.date));
              const upcoming=empShifts.filter(s=>s.date>=getTodayPlus(0));
              const totalH=totalHoursForEmp(emp.id);
              return (
                <div key={emp.id} style={{background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,.08)"}}>
                  <div style={{background:posteColor(emp.poste),padding:"14px 18px",display:"flex",alignItems:"center",gap:12}}>
                    <div style={{...S.empAvatar,background:"rgba(255,255,255,.6)",flexShrink:0}}>{emp.prenom[0]}{emp.nom[0]}</div>
                    <div>
                      <div style={{fontWeight:800,fontSize:15}}>{emp.prenom} {emp.nom}</div>
                      <div style={{fontSize:12,color:"#555"}}>{emp.poste} · {emp.type==="fixe"?"Fixe":"Étudiant"}</div>
                    </div>
                    <div style={{marginLeft:"auto",textAlign:"right"}}>
                      <div style={{fontWeight:800,fontSize:18}}>{totalH.toFixed(1)}h</div>
                      <div style={{fontSize:11,color:"#777"}}>heures saisies</div>
                    </div>
                  </div>
                  <div style={{padding:"12px 18px"}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#888",marginBottom:8}}>SERVICES À VENIR</div>
                    {upcoming.length===0&&<div style={{color:"#ccc",fontSize:13}}>Aucun service planifié</div>}
                    {upcoming.slice(0,4).map(s=>(
                      <div key={s.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:"1px solid #f5f5f5"}}>
                        <span style={{color:"#444"}}>{formatFullDate(s.date)}</span>
                        <span style={{color:"#666",fontWeight:600}}>{s.debut}{s.fin?`–${s.fin}`:""} <span style={{color:"#aaa"}}>({s.poste})</span></span>
                      </div>
                    ))}
                    {upcoming.length>4&&<div style={{fontSize:11,color:"#aaa",marginTop:4}}>+{upcoming.length-4} autres…</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>)}

        {/* ── ALERTES ── */}
        {tab==="notifs" && (<>
          <div style={S.pageHeader}><h2 style={S.pageTitle}>Alertes & Indisponibilités</h2></div>

          <h3 style={S.sectionTitle}>🔔 Services dans moins de 48h</h3>
          {notifications.length===0&&<div style={{...S.emptyBox,marginBottom:24}}>✅ Aucun service imminent</div>}
          {notifications.map(s=>{
            const emp=employees.find(e=>e.id===s.employeeId);
            const h=hoursUntil(s.date,s.debut);
            return (
              <div key={s.id} style={S.notifCard}>
                <div style={S.notifIcon}>🔔</div>
                <div style={{flex:1}}>
                  <div style={S.notifName}>{emp?.prenom} {emp?.nom}</div>
                  <div style={S.notifDetail}>{formatFullDate(s.date)} · {s.debut}{s.fin?`–${s.fin}`:""} · {s.poste}</div>
                  <div style={S.notifContact}>📞 {emp?.telephone} · Dans {Math.round(h)}h</div>
                </div>
                <span style={{...S.badge,background:h<24?"#ffccbc":"#fff9c4",alignSelf:"center"}}>{h<24?"⚠️ Urgent":"📬 Notifié"}</span>
              </div>
            );
          })}

          <div style={{height:1,background:"#e8eaf6",margin:"24px 0"}} />

          <h3 style={S.sectionTitle}>🚫 Indisponibilités déclarées</h3>
          {unavailability.filter(u=>u.dateFin>=getTodayPlus(0)).length===0
            ? <div style={S.emptyBox}>✅ Aucune indisponibilité déclarée</div>
            : unavailability.filter(u=>u.dateFin>=getTodayPlus(0))
                .sort((a,b)=>a.dateDebut.localeCompare(b.dateDebut))
                .map(u=>{
                  const emp=employees.find(e=>e.id===u.empId);
                  const same=u.dateDebut===u.dateFin;
                  const bColor=u.status==="accepted"?"#43a047":u.status==="refused"?"#e53935":"#ff9800";
                  return (
                    <div key={u.id} style={{...S.notifCard,borderLeft:`4px solid ${bColor}`}}>
                      <div style={{fontSize:26}}>🚫</div>
                      <div style={{flex:1}}>
                        <div style={S.notifName}>{emp?.prenom} {emp?.nom}
                          <span style={{...S.badge,background:posteColor(emp?.poste),marginLeft:8}}>{emp?.poste}</span>
                        </div>
                        <div style={S.notifDetail}>{same?formatFullDate(u.dateDebut):`${formatFullDate(u.dateDebut)} → ${formatFullDate(u.dateFin)}`}</div>
                        {u.motif&&<div style={{fontSize:12,color:"#888",marginTop:4,fontStyle:"italic"}}>💬 {u.motif}</div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,alignSelf:"center"}}>
                        {u.status==="pending"?(
                          <>
                            <button onClick={()=>onUpdateUnavailStatus(u.id,"accepted")} style={{background:"#e8f5e9",border:"1.5px solid #43a047",color:"#2e7d32",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontWeight:700,fontSize:12}}>✅ Accepter</button>
                            <button onClick={()=>onUpdateUnavailStatus(u.id,"refused")}  style={{background:"#fce4ec",border:"1.5px solid #e53935",color:"#c62828",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontWeight:700,fontSize:12}}>❌ Refuser</button>
                          </>
                        ):(
                          <>
                            <span style={{...S.badge,background:u.status==="accepted"?"#e8f5e9":"#fce4ec",color:u.status==="accepted"?"#2e7d32":"#c62828"}}>
                              {u.status==="accepted"?"✅ Acceptée":"❌ Refusée"}
                            </span>
                            <button onClick={()=>onUpdateUnavailStatus(u.id,"pending")} style={{fontSize:11,color:"#888",background:"none",border:"none",cursor:"pointer",padding:0}}>Modifier</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
          }
        </>)}

        {/* ── PARAMÈTRES ── */}
        {tab==="settings" && (<>
          <div style={S.pageHeader}><h2 style={S.pageTitle}>Paramètres</h2></div>
          <div style={{maxWidth:440}}>
            <div style={{background:"#fff",borderRadius:16,padding:"24px 28px",boxShadow:"0 2px 12px rgba(0,0,0,.08)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                <span style={{fontSize:28}}>🔑</span>
                <div>
                  <div style={{fontWeight:800,fontSize:16,color:"#1a237e"}}>Changer le mot de passe manager</div>
                  <div style={{fontSize:12,color:"#888"}}>Synchronisé pour tous les appareils via Firebase.</div>
                </div>
              </div>
              <label style={S.label}>Ancien mot de passe</label>
              <input style={{...S.input,marginBottom:8}} type="password" placeholder="••••" value={pwdForm.ancien} onChange={e=>{setPwdForm(p=>({...p,ancien:e.target.value}));setPwdMsg(null);}} />
              <label style={S.label}>Nouveau mot de passe</label>
              <input style={{...S.input,marginBottom:8}} type="password" placeholder="Minimum 4 caractères" value={pwdForm.nouveau} onChange={e=>{setPwdForm(p=>({...p,nouveau:e.target.value}));setPwdMsg(null);}} />
              <label style={S.label}>Confirmer</label>
              <input style={{...S.input,marginBottom:14}} type="password" value={pwdForm.confirm} onChange={e=>{setPwdForm(p=>({...p,confirm:e.target.value}));setPwdMsg(null);}} />
              {pwdMsg&&<div style={{borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,fontWeight:600,background:pwdMsg.type==="ok"?"#e8f5e9":"#fce4ec",color:pwdMsg.type==="ok"?"#2e7d32":"#c62828"}}>{pwdMsg.text}</div>}
              <button style={{...S.btnPrimary,width:"100%"}} onClick={handleChangePwd}>Enregistrer</button>
            </div>
          </div>
        </>)}

      </main>
    </div>
  );
}

// ── Vue Employé ───────────────────────────────────────────────────────
function EmployeeView({ employee, shifts, allShifts, employees, notifications,
  unavailability, workedHours, onAddUnavail, onRemoveUnavail, onSaveWorkedHours, onLogout }) {

  const [tab,setTab]       = useState("planning");
  const [weekOffset,setWeek] = useState(0);
  const [editingHours,setEditingHours] = useState(null);
  const [newU,setNewU]     = useState({dateDebut:getTodayPlus(1),dateFin:getTodayPlus(1),motif:""});
  const [unavailMsg,setUnavailMsg] = useState(null);
  const [saving,setSaving] = useState(false);
  const weekDays = getWeekDays(weekOffset);
  const upcoming = shifts.filter(s=>s.date>=getTodayPlus(0)).sort((a,b)=>a.date.localeCompare(b.date));
  const totalWorked = workedHours.reduce((s,w)=>s+(parseFloat(w.heures)||0),0);

  const handleAddUnavail = async () => {
    if (!newU.dateDebut||!newU.dateFin) return;
    if (newU.dateFin<newU.dateDebut) { setUnavailMsg({type:"err",text:"La date de fin doit être après le début."}); return; }
    setSaving(true);
    await onAddUnavail(newU);
    setNewU({dateDebut:getTodayPlus(1),dateFin:getTodayPlus(1),motif:""});
    setUnavailMsg({type:"ok",text:"Indisponibilité enregistrée ✅"});
    setTimeout(()=>setUnavailMsg(null),3000);
    setSaving(false);
  };
  const handleSaveHours = async () => {
    if (!editingHours) return;
    setSaving(true);
    await onSaveWorkedHours(editingHours.date, editingHours.heures, editingHours.note);
    setEditingHours(null); setSaving(false);
  };

  return (
    <div style={S.appWrap}>
      <aside style={S.sidebar}>
        <div style={S.sideHead}><span style={{fontSize:22}}>🍽</span><span style={S.sideTitle}>Kursal de Panne</span></div>
        <div style={S.empProfileBox}>
          <div style={{...S.empAvatar,margin:"0 auto 8px",width:50,height:50,fontSize:18,background:posteColor(employee.poste)}}>{employee.prenom[0]}{employee.nom[0]}</div>
          <div style={{fontWeight:700,color:"#fff",fontSize:14}}>{employee.prenom} {employee.nom}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:2}}>{employee.poste} · {employee.type==="fixe"?"Fixe":"Étudiant"}</div>
        </div>
        <nav style={S.nav}>
          {[
            {id:"planning", icon:"📅", label:"Mon planning"},
            {id:"heures",   icon:"⏱️",  label:"Mes heures"},
            {id:"indispo",  icon:"🚫", label:"Indisponibilités"},
          ].map(item=>(
            <button key={item.id} style={{...S.navBtn,...(tab===item.id?S.navBtnActive:{})}} onClick={()=>setTab(item.id)}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <button style={S.logoutBtn} onClick={onLogout}>↩ Déconnexion</button>
      </aside>

      <main style={S.main}>
        {notifications.length>0&&(
          <div style={S.alertBanner}>
            🔔 Rappel : {notifications.length} service{notifications.length>1?"s":""} dans moins de 48h !
            {notifications.map(s=>(
              <span key={s.id} style={{display:"block",fontSize:13,marginTop:4}}>
                ➤ {formatFullDate(s.date)} à {s.debut}{s.fin?`–${s.fin}`:""} ({s.poste})
              </span>
            ))}
          </div>
        )}

        {/* ── MON PLANNING ── */}
        {tab==="planning" && (<>
          <div style={S.pageHeader}><h2 style={S.pageTitle}>Mes prochains services</h2></div>
          {upcoming.length===0
            ? <div style={S.emptyBox}>Aucun service à venir.</div>
            : <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
              {upcoming.map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:16,background:posteColor(s.poste),padding:"14px 18px",borderRadius:14}}>
                  <div style={{fontSize:26}}>{posteEmoji(s.poste)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,color:"#222"}}>{formatFullDate(s.date)}</div>
                    <div style={{fontSize:13,color:"#555"}}>{s.debut}{s.fin?` – ${s.fin}`:" (fin à définir)"} · {s.poste}</div>
                  </div>
                  {hoursUntil(s.date,s.debut)<=48&&<span style={{...S.badge,background:"#ffccbc"}}>⏰ Dans {Math.round(hoursUntil(s.date,s.debut))}h</span>}
                </div>
              ))}
            </div>
          }
          <div style={S.pageHeader}><h2 style={S.pageTitle}>Planning de l'équipe</h2></div>
          <div style={S.weekNav}>
            <button style={S.weekBtn} onClick={()=>setWeek(o=>o-1)}>‹</button>
            <span style={S.weekLabel}>{formatDate(weekDays[0])} – {formatDate(weekDays[6])}</span>
            <button style={S.weekBtn} onClick={()=>setWeek(o=>o+1)}>›</button>
          </div>
          <div style={S.planGrid}>
            {weekDays.map((day,i)=>{
              const dayShifts=allShifts.filter(s=>s.date===day);
              return (
                <div key={day} style={S.dayCol}>
                  <div style={S.dayHeader}><span style={S.dayName}>{JOURS[i]}</span><span style={S.dayDate}>{formatDate(day)}</span></div>
                  <div style={S.dayShifts}>
                    {dayShifts.length===0&&<p style={S.noShift}>—</p>}
                    {dayShifts.map(s=>{
                      const isMine=s.employeeId===employee.id;
                      const emp=employees.find(e=>e.id===s.employeeId);
                      return (
                        <div key={s.id} style={{...S.shiftCard,background:posteColor(s.poste),border:isMine?"2px solid #1976d2":"none"}}>
                          {isMine&&<span style={S.myTag}>Moi</span>}
                          <div style={S.shiftName}>{emp?.prenom} {emp?.nom[0]}.</div>
                          <div style={S.shiftTime}>{s.debut}{s.fin?`–${s.fin}`:""}</div>
                          <div style={S.shiftPoste}>{s.poste}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>)}

        {/* ── MES HEURES ── */}
        {tab==="heures" && (<>
          <div style={S.pageHeader}>
            <h2 style={S.pageTitle}>Mes heures travaillées</h2>
            <div style={{...S.badge,background:"#e8f5e9",fontSize:14,padding:"6px 14px"}}>Total : <strong>{totalWorked.toFixed(1)}h</strong></div>
          </div>
          <p style={{color:"#888",fontSize:13,marginBottom:20}}>Saisissez vos heures réelles. Visibles uniquement par vous.</p>
          {shifts.filter(s=>s.date<=getTodayPlus(0)).sort((a,b)=>b.date.localeCompare(a.date)).length===0
            ? <div style={S.emptyBox}>Aucun service passé.</div>
            : shifts.filter(s=>s.date<=getTodayPlus(0)).sort((a,b)=>b.date.localeCompare(a.date)).map(s=>{
              const rec=workedHours.find(w=>w.date===s.date);
              return (
                <div key={s.id} style={{background:"#fff",borderRadius:14,padding:"14px 18px",marginBottom:10,boxShadow:"0 1px 8px rgba(0,0,0,.07)",display:"flex",alignItems:"center",gap:14}}>
                  <div style={{fontSize:24}}>{posteEmoji(s.poste)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,color:"#222"}}>{formatFullDate(s.date)}</div>
                    <div style={{fontSize:12,color:"#888"}}>{s.debut}{s.fin?`–${s.fin}`:""} · {s.poste}</div>
                    {rec?.note&&<div style={{fontSize:12,color:"#666",marginTop:2,fontStyle:"italic"}}>"{rec.note}"</div>}
                  </div>
                  {rec
                    ? <div style={{textAlign:"right"}}>
                        <div style={{fontWeight:800,fontSize:18,color:"#1a237e"}}>{rec.heures}h</div>
                        <button style={{fontSize:11,color:"#1976d2",background:"none",border:"none",cursor:"pointer",padding:0}} onClick={()=>setEditingHours({date:s.date,heures:rec.heures,note:rec.note||""})}>Modifier</button>
                      </div>
                    : <button style={S.btnPrimary} onClick={()=>setEditingHours({date:s.date,heures:"",note:""})}>+ Saisir</button>
                  }
                </div>
              );
            })
          }
          {editingHours&&(
            <Modal title={`Heures du ${formatFullDate(editingHours.date)}`} onClose={()=>setEditingHours(null)}>
              <label style={S.label}>Heures travaillées</label>
              <input style={S.input} type="number" step="0.5" min="0" max="24" placeholder="ex : 7.5" value={editingHours.heures} onChange={e=>setEditingHours(p=>({...p,heures:e.target.value}))} />
              <label style={S.label}>Note (optionnel)</label>
              <input style={S.input} placeholder="ex : coupure 30min…" value={editingHours.note} onChange={e=>setEditingHours(p=>({...p,note:e.target.value}))} />
              <button style={{...S.btnPrimary,width:"100%",marginTop:12,opacity:saving?.6:1}} onClick={handleSaveHours} disabled={saving}>{saving?"Enregistrement…":"Enregistrer"}</button>
            </Modal>
          )}
        </>)}

        {/* ── INDISPONIBILITÉS ── */}
        {tab==="indispo" && (<>
          <div style={S.pageHeader}><h2 style={S.pageTitle}>Mes indisponibilités</h2></div>
          <p style={{color:"#888",fontSize:13,marginBottom:20}}>Déclarez les jours où vous n'êtes pas disponible. Le manager sera informé.</p>
          <div style={{background:"#fff",borderRadius:16,padding:"20px 24px",marginBottom:24,boxShadow:"0 2px 12px rgba(0,0,0,.08)"}}>
            <div style={{fontWeight:700,fontSize:15,color:"#1a237e",marginBottom:14}}>➕ Déclarer une indisponibilité</div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:140}}>
                <label style={S.label}>Du</label>
                <input style={S.input} type="date" value={newU.dateDebut} min={getTodayPlus(0)} onChange={e=>{setNewU(p=>({...p,dateDebut:e.target.value}));setUnavailMsg(null);}} />
              </div>
              <div style={{flex:1,minWidth:140}}>
                <label style={S.label}>Au</label>
                <input style={S.input} type="date" value={newU.dateFin} min={newU.dateDebut||getTodayPlus(0)} onChange={e=>{setNewU(p=>({...p,dateFin:e.target.value}));setUnavailMsg(null);}} />
              </div>
            </div>
            <label style={{...S.label,marginTop:10,display:"block"}}>Motif <span style={{color:"#aaa",fontWeight:400}}>(optionnel)</span></label>
            <input style={{...S.input,marginBottom:14}} placeholder="ex : vacances, rendez-vous…" value={newU.motif} onChange={e=>setNewU(p=>({...p,motif:e.target.value}))} />
            {unavailMsg&&<div style={{borderRadius:10,padding:"9px 14px",marginBottom:10,fontSize:13,fontWeight:600,background:unavailMsg.type==="ok"?"#e8f5e9":"#fce4ec",color:unavailMsg.type==="ok"?"#2e7d32":"#c62828"}}>{unavailMsg.text}</div>}
            <button style={{...S.btnPrimary,width:"100%",opacity:saving?.6:1}} onClick={handleAddUnavail} disabled={saving}>{saving?"Enregistrement…":"Enregistrer"}</button>
          </div>

          <div style={{fontWeight:700,fontSize:14,color:"#555",marginBottom:12,textTransform:"uppercase",letterSpacing:0.5}}>Mes déclarations</div>
          {unavailability.filter(u=>u.dateFin>=getTodayPlus(0)).length===0
            ? <div style={S.emptyBox}>Aucune indisponibilité déclarée.</div>
            : unavailability.filter(u=>u.dateFin>=getTodayPlus(0)).sort((a,b)=>a.dateDebut.localeCompare(b.dateDebut)).map(u=>{
              const same=u.dateDebut===u.dateFin;
              return (
                <div key={u.id} style={{background:"#fff",borderRadius:14,padding:"14px 18px",marginBottom:10,boxShadow:"0 1px 8px rgba(0,0,0,.07)",display:"flex",alignItems:"center",gap:14,borderLeft:`4px solid ${u.status==="accepted"?"#43a047":u.status==="refused"?"#e53935":"#ff9800"}`}}>
                  <div style={{fontSize:22}}>🚫</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,color:"#222",fontSize:14}}>{same?formatFullDate(u.dateDebut):`${formatFullDate(u.dateDebut)} → ${formatFullDate(u.dateFin)}`}</div>
                    {u.motif&&<div style={{fontSize:12,color:"#888",marginTop:3,fontStyle:"italic"}}>💬 {u.motif}</div>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                    <span style={{...S.badge,background:u.status==="accepted"?"#e8f5e9":u.status==="refused"?"#fce4ec":"#fff9c4",color:u.status==="accepted"?"#2e7d32":u.status==="refused"?"#c62828":"#f57f17"}}>
                      {u.status==="accepted"?"✅ Acceptée":u.status==="refused"?"❌ Refusée":"⏳ En attente"}
                    </span>
                    {u.status==="pending"&&<button style={{background:"#fce4ec",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:12}} onClick={()=>onRemoveUnavail(u.id)}>🗑️ Annuler</button>}
                  </div>
                </div>
              );
            })
          }
        </>)}
      </main>
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────
function EmpForm({ data, setData }) {
  return (
    <>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><label style={S.label}>Prénom</label><input style={S.input} value={data.prenom} onChange={e=>setData(p=>({...p,prenom:e.target.value}))} /></div>
        <div style={{flex:1}}><label style={S.label}>Nom</label><input style={S.input} value={data.nom} onChange={e=>setData(p=>({...p,nom:e.target.value}))} /></div>
      </div>
      <label style={S.label}>Adresse</label>
      <input style={S.input} value={data.adresse} onChange={e=>setData(p=>({...p,adresse:e.target.value}))} />
      <label style={S.label}>Téléphone</label>
      <input style={S.input} value={data.telephone} onChange={e=>setData(p=>({...p,telephone:e.target.value}))} />
      <label style={S.label}>Date de naissance <span style={{color:"#aaa",fontWeight:400}}>(= mot de passe)</span></label>
      <input style={S.input} type="date" value={data.naissance||""} onChange={e=>setData(p=>({...p,naissance:e.target.value}))} />
      <label style={S.label}>Poste habituel</label>
      <select style={S.input} value={data.poste||"Salle"} onChange={e=>setData(p=>({...p,poste:e.target.value}))}>
        {POSTES.map(p=><option key={p}>{p}</option>)}
      </select>
      <label style={S.label}>Type</label>
      <select style={S.input} value={data.type} onChange={e=>setData(p=>({...p,type:e.target.value}))}>
        <option value="fixe">Fixe</option>
        <option value="etudiant">Étudiant</option>
      </select>
    </>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.modalHead}>
          <h3 style={S.modalTitle}>{title}</h3>
          <button style={S.modalClose} onClick={onClose}>✕</button>
        </div>
        <div style={S.modalBody}>{children}</div>
      </div>
    </div>
  );
}

function posteColor(p){return{Salle:"#e8f5e9",Bar:"#e3f2fd",Cuisine:"#fff3e0"}[p]||"#f5f5f5";}
function posteEmoji(p){return{Salle:"🍽",Bar:"🍸",Cuisine:"👨‍🍳"}[p]||"📋";}

const S = {
  loginBg:{minHeight:"100vh",background:"linear-gradient(135deg,#1a237e 0%,#0d47a1 60%,#006064 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Georgia',serif"},
  loginCard:{background:"#fff",borderRadius:20,padding:"40px 36px",width:340,boxShadow:"0 24px 64px rgba(0,0,0,.3)",textAlign:"center"},
  logoWrap:{marginBottom:28},
  logoIcon:{fontSize:42},
  logoTitle:{margin:"6px 0 4px",fontSize:20,fontWeight:800,color:"#1a237e",letterSpacing:-0.5},
  logoSub:{margin:0,color:"#888",fontSize:13},
  choiceWrap:{display:"flex",gap:12,justifyContent:"center"},
  roleBtn:{flex:1,border:"none",borderRadius:14,padding:"18px 8px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:8,boxShadow:"0 2px 8px rgba(0,0,0,.08)"},
  roleBtnLabel:{fontSize:13,fontWeight:700,color:"#333"},
  formWrap:{display:"flex",flexDirection:"column",gap:10,textAlign:"left"},
  formLabel:{fontWeight:700,color:"#1a237e",marginBottom:-4},
  input:{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #ddd",fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit"},
  btnPrimary:{background:"#1a237e",color:"#fff",border:"none",borderRadius:10,padding:"11px 20px",fontWeight:700,cursor:"pointer",fontSize:14},
  btnGhost:{background:"transparent",color:"#888",border:"1.5px solid #ddd",borderRadius:10,padding:"10px 20px",cursor:"pointer",fontSize:13,marginTop:-4},
  errTxt:{color:"#e53935",fontSize:13,margin:"2px 0"},
  appWrap:{display:"flex",minHeight:"100vh",fontFamily:"'Segoe UI',sans-serif",background:"#f8f9fb"},
  sidebar:{width:220,background:"#1a237e",color:"#fff",display:"flex",flexDirection:"column",padding:"24px 0",flexShrink:0},
  sideHead:{display:"flex",alignItems:"center",gap:10,padding:"0 20px 24px",borderBottom:"1px solid rgba(255,255,255,.15)"},
  sideTitle:{fontWeight:800,fontSize:15,letterSpacing:-0.5},
  empProfileBox:{padding:"16px 20px 20px",borderBottom:"1px solid rgba(255,255,255,.15)",textAlign:"center"},
  nav:{flex:1,padding:"16px 12px",display:"flex",flexDirection:"column",gap:6},
  navBtn:{background:"transparent",border:"none",color:"rgba(255,255,255,.75)",borderRadius:10,padding:"10px 14px",textAlign:"left",cursor:"pointer",fontSize:14,display:"flex",gap:10,alignItems:"center"},
  navBtnActive:{background:"rgba(255,255,255,.18)",color:"#fff",fontWeight:700},
  logoutBtn:{margin:"0 12px",background:"rgba(255,255,255,.1)",border:"none",color:"rgba(255,255,255,.7)",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:13},
  main:{flex:1,padding:"28px 32px",overflowY:"auto"},
  pageHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20},
  pageTitle:{margin:0,fontSize:22,fontWeight:800,color:"#1a1a1a"},
  sectionTitle:{fontSize:15,fontWeight:700,color:"#555",margin:"0 0 10px",textTransform:"uppercase",letterSpacing:0.5},
  weekNav:{display:"flex",alignItems:"center",gap:16,marginBottom:16},
  weekBtn:{background:"#fff",border:"1.5px solid #ddd",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:13,fontWeight:600},
  weekLabel:{fontWeight:700,color:"#444",fontSize:15},
  planGrid:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8},
  dayCol:{minWidth:90,background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,.07)"},
  dayHeader:{background:"#f0f3ff",padding:"8px 10px",textAlign:"center",borderBottom:"1px solid #e8eaf6"},
  dayName:{display:"block",fontSize:11,fontWeight:700,color:"#1a237e",textTransform:"uppercase"},
  dayDate:{display:"block",fontSize:12,color:"#666",marginTop:2},
  dayShifts:{padding:6,display:"flex",flexDirection:"column",gap:6,minHeight:60},
  noShift:{textAlign:"center",color:"#ccc",fontSize:18,margin:"10px 0"},
  shiftCard:{borderRadius:8,padding:"7px 8px",position:"relative"},
  shiftName:{fontSize:11,fontWeight:700,color:"#222"},
  shiftTime:{fontSize:11,color:"#555",marginTop:1},
  shiftPoste:{fontSize:10,color:"#888",marginTop:1},
  shiftDel:{position:"absolute",top:4,right:4,background:"rgba(0,0,0,.08)",border:"none",borderRadius:4,cursor:"pointer",fontSize:9,color:"#555",padding:"1px 4px"},
  myTag:{position:"absolute",top:4,right:4,background:"#1976d2",color:"#fff",fontSize:8,borderRadius:4,padding:"1px 5px",fontWeight:700},
  empGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:14},
  empCard:{background:"#fff",borderRadius:14,padding:"16px 18px",display:"flex",alignItems:"flex-start",gap:14,boxShadow:"0 1px 8px rgba(0,0,0,.08)"},
  empAvatar:{width:44,height:44,borderRadius:"50%",background:"#e8eaf6",color:"#1a237e",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:15,flexShrink:0},
  empInfo:{flex:1,minWidth:0},
  empName:{fontWeight:700,fontSize:15,color:"#1a1a1a"},
  empDetail:{fontSize:12,color:"#777",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  empActions:{display:"flex",flexDirection:"column",gap:6},
  btnEdit:{background:"#e3f2fd",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:14},
  btnDel:{background:"#fce4ec",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:14},
  badge:{display:"inline-block",padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:600,color:"#333"},
  notifCard:{background:"#fff",borderRadius:14,padding:"16px 20px",display:"flex",gap:16,alignItems:"flex-start",boxShadow:"0 1px 8px rgba(0,0,0,.07)",marginBottom:10},
  notifIcon:{fontSize:26},
  notifName:{fontWeight:700,fontSize:15,color:"#1a1a1a"},
  notifDetail:{fontSize:13,color:"#555",marginTop:4},
  notifContact:{fontSize:12,color:"#888",marginTop:4},
  emptyBox:{background:"#f0f4f8",borderRadius:12,padding:"24px",textAlign:"center",color:"#666",fontSize:15},
  alertBanner:{background:"linear-gradient(90deg,#ff6f00,#ffa000)",color:"#fff",borderRadius:14,padding:"14px 20px",marginBottom:20,fontWeight:600,boxShadow:"0 4px 16px rgba(255,111,0,.3)"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100},
  modal:{background:"#fff",borderRadius:18,width:420,maxWidth:"95vw",boxShadow:"0 24px 64px rgba(0,0,0,.3)",overflow:"hidden",maxHeight:"90vh",overflowY:"auto"},
  modalHead:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 20px",borderBottom:"1px solid #eee",background:"#f8f9ff"},
  modalTitle:{margin:0,fontSize:17,fontWeight:800,color:"#1a237e"},
  modalClose:{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#888"},
  modalBody:{padding:"20px",display:"flex",flexDirection:"column",gap:8},
  label:{fontSize:12,fontWeight:700,color:"#555",marginBottom:-4},
};
