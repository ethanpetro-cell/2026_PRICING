import { useState, useEffect } from "react";
import OwnerBackend from "./OwnerBackend.jsx";

// ── Credentials ───────────────────────────────────────────────
// In a real deployment these would live in environment variables
// on Vercel, never in the source code
const USERS = {
  // Staff logins
  "hunter":   { password:"Goats1",  role:"staff",  displayName:"Hunter" },
  "james":    { password:"Goats2",  role:"staff",  displayName:"James" },
  "megan":    { password:"Goats3",  role:"staff",  displayName:"Megan" },
  "mark":     { password:"Goats4",  role:"staff",  displayName:"Mark" },
  // Admin logins
  "ethan":    { password:"OGAdmin1",role:"owner",  displayName:"Ethan" },
  "mitch":    { password:"OGAdmin2",role:"owner",  displayName:"Mitch" },
};

// ── Brand palette ─────────────────────────────────────────────
const C = {
  parchment:   "#F5F0E8",
  parchmentDk: "#EDE6D8",
  stone:       "#D8CFBC",
  stoneMd:     "#6B5540",
  stoneDk:     "#4A3520",
  bark:        "#18100A",
  charcoal:    "#0A0806",
  moss:        "#3D4A35",
  clay:        "#6B4E2E",
  rust:        "#7A3220",
  white:       "#FDFAF4",
};

const VENDORS = {
  "Bellmont":              { multiplier:1.60, discount:0.48 },
  "Neff":                  { multiplier:1.60, discount:1.00 },
  "William Ohs":           { multiplier:1.60, discount:1.00 },
  "EJ Cabinetry":          { multiplier:1.60, discount:1.00 },
  "Restaurant/Commercial": { multiplier:1.40, discount:1.00 },
  "Custom Fabrication":    { multiplier:1.00, discount:1.00 },
};

const RATES = {
  overhead:     0.18,
  design:       0.05,
  shipping:     0.03,
  installation: 0.15,
  punchlist:    0.04,
  incentive:    0.04,
  salesTax:     0.10,
  minMargin:    0.20,
};

const STATE_TAX = {
  // rate=sales tax, install=installation%, incentiveRate=rate to use, showIncentive=visible in Additional Items
  "MT": { rate:0.00,  label:"Montana (0% — no sales tax)",     install:0.12, incentiveRate:0.04,  showIncentive:true  },
  "ID": { rate:0.06,  label:"Idaho (6% state rate)",            install:0.22, incentiveRate:0.00,  showIncentive:false },
  "UT": { rate:0.061, label:"Utah (6.1% state + local base)",   install:0.12, incentiveRate:0.10,  showIncentive:false },
};

const ROOM_SUGGESTIONS = [
  "Kitchen","Master Bath","Master Closet","Pantry","Laundry",
  "Mudroom","Office","Wet Bar","Powder Bath","Bath 2","Bath 3",
  "Garage","Utility","Media Room","Entry / Foyer","Dining Room",
  "Living Room","Closet","Linen Closet","Accessories / Misc",
];

const STATUS_OPTIONS = ["Quoted","Approved","In Progress","Complete","On Hold"];
const STATUS_CONFIG = {
  "Quoted":      { bg:"#E8E2D4", color:C.bark },
  "Approved":    { bg:"#D8E0D0", color:C.moss },
  "In Progress": { bg:"#E8DCB8", color:C.clay },
  "Complete":    { bg:"#D0DCE0", color:"#2A4040" },
  "On Hold":     { bg:"#E0D0CC", color:C.rust },
};

const fmt    = n => (!n&&n!==0)||isNaN(n) ? "—" : "$"+Math.round(n).toLocaleString("en-US");
const fmtPct = n => (!n&&n!==0)||isNaN(n) ? "—" : (n*100).toFixed(1)+"%";
const newRoom = (id, vendor="Bellmont") => ({ id, name:"", list:"", upcharge:"", vendor, priceOverride:"" });

function calcRoom(room, vendorConfig) {
  const vendor = room.vendor || "Bellmont";
  const list = parseFloat(room.list)||0;
  const disc = vendorConfig[vendor]?.discount ?? 1.0;
  const net  = list * disc;
  const up   = parseFloat(room.upcharge)||0;
  const mult = vendorConfig[vendor]?.multiplier ?? 1.6;
  const auto = (net+up)*mult;
  const ovr  = parseFloat(room.priceOverride);
  const price = (!isNaN(ovr) && ovr > 0) ? ovr : auto;
  return { list, net, upcharge:up, price, auto, overridden: !isNaN(ovr)&&ovr>0, vendor };
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.parchment};color:${C.bark};font-family:'Jost',sans-serif;font-weight:300;-webkit-font-smoothing:antialiased}
  input,select{font-family:'Jost',sans-serif;font-weight:300;font-size:13px}
  input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
  ::selection{background:${C.stone};color:${C.charcoal}}
  ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:${C.parchment}}::-webkit-scrollbar-thumb{background:${C.stoneMd}}
  .ri:focus{outline:none;border-color:${C.bark}!important;background:${C.white}!important}
  .rs:focus{outline:none;border-color:${C.bark}!important}
  .fade{animation:fu .4s ease both}
  @keyframes fu{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  .rr:hover .xbtn{opacity:1!important}
  .addbtn:hover{background:${C.charcoal}!important;color:${C.parchment}!important;border-color:${C.charcoal}!important}
  .navbtn:hover{background:${C.parchmentDk}!important}
  .ph::placeholder{color:${C.stoneMd};font-style:italic}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
  @media print {
    body { background: white !important; }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    header, nav { display: none !important; }
    main { padding: 0 !important; max-width: 100% !important; }
    input, select { border: none !important; background: transparent !important; box-shadow: none !important; }
    .ri, .rs { border: none !important; background: transparent !important; }
    .xbtn { display: none !important; }
    .addbtn { display: none !important; }
    .owner-only-print { display: none !important; }
    .hide-when-client-pdf { display: none !important; }
    @page { margin: 0.75in; size: letter portrait; }
  }
`;

export default function App() {
  // ── Auth state ─────────────────────────────────────────────
  const [session, setSession] = useState(null); // null | { user, role }
  const [loginUser, setLoginUser] = useState("");
  const [loginPw, setLoginPw]     = useState("");
  const [loginErr, setLoginErr]   = useState(false);

  const tryLogin = () => {
    const u = USERS[loginUser.toLowerCase()];
    if (u && u.password === loginPw) {
      setSession({ user: loginUser.toLowerCase(), role: u.role, displayName: u.displayName });
      setLoginErr(false);
    } else {
      setLoginErr(true);
    }
  };

  const logout = () => {
    setSession(null);
    setLoginUser(""); setLoginPw(""); setLoginErr(false);
    setView("quote");
  };

  // ── App state ──────────────────────────────────────────────
  const [view, setView] = useState("quote");
  const [vendorConfig, setVendorConfig] = useState(VENDORS);
  const [rateConfig, setRateConfig]     = useState(RATES);

  const [proj, setProj] = useState({
    name:"", date:"", vendor:"Bellmont",
    quoteNum:"", state:"MT", status:"In Progress", notes:"",
  });
  const [rooms, setRooms] = useState([
    newRoom(1),newRoom(2),newRoom(3),newRoom(4),newRoom(5),
  ]);
  const [ov, setOv] = useState({
    overhead:"",design:"",shipping:"",
    installation:"",punchlist:"",incentive:"",
    salesTax:"",hardware:"",misc:"",
  });
  const [finalPrice, setFinalPrice] = useState("");
  const [savedProjects, setSavedProjects] = useState([]);
  const [autoSaveStatus, setAutoSaveStatus] = useState(""); // "", "saving", "saved"
  const [printMode, setPrintMode] = useState(""); // "", "quote-client", "co"
  const triggerPrint = (mode) => {
    setPrintMode(mode);
    setTimeout(() => { window.print(); setPrintMode(""); }, 150);
  };

  const [changeOrders, setChangeOrders] = useState([]);
  const newCO = () => ({ id:Date.now(), description:"", amount:"", approved:"Pending", date:"", notes:"" });
  const addCO = () => setChangeOrders(p=>[...p, newCO()]);
  const removeCO = id => setChangeOrders(p=>p.filter(c=>c.id!==id));
  const updateCO = (id,f,v) => setChangeOrders(p=>p.map(c=>c.id===id?{...c,[f]:v}:c));
  const coApproved = changeOrders.filter(c=>c.approved==="Approved").reduce((a,c)=>a+(parseFloat(c.amount)||0),0);
  const coPending  = changeOrders.filter(c=>c.approved==="Pending").reduce((a,c)=>a+(parseFloat(c.amount)||0),0);

  // Warn before closing if project is In Progress and not yet Quoted
  useEffect(() => {
    const handler = (e) => {
      if (proj.status === "In Progress" && proj.name) {
        e.preventDefault();
        e.returnValue = "This project is still In Progress and has not been moved to Quoted. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [proj.status, proj.name]);

  // Auto-update sales tax rate when state changes
  useEffect(() => {
    const st = STATE_TAX[proj.state];
    if (!st) return;
    setRateConfig(prev => ({ ...prev, salesTax: st.rate, installation: st.install, incentive: st.incentiveRate }));
    setOv(o => ({ ...o, salesTax: "", installation: "", incentive: "" }));
  }, [proj.state]);

  // Auto-generate quote number from project name + date
  useEffect(() => {
    if (!proj.name && !proj.date) return;
    const namePart = proj.name
      ? proj.name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim().replace(/\s+/g, " ")
      : "PROJECT";
    const datePart = proj.date
      ? (() => {
          const [y,m,d] = proj.date.split("-");
          return `${m}/${d}/${y}`;
        })()
      : "";
    const generated = datePart
      ? `${namePart}_${datePart}`
      : namePart;
    setProj(p => ({ ...p, quoteNum: generated }));
  }, [proj.name, proj.date]);

  // Auto-save whenever any form field changes (debounced 800ms)
  useEffect(() => {
    if (!proj.name) return;
    setAutoSaveStatus("saving");
    const timer = setTimeout(() => {
      // Recompute financials inline so we don't depend on derived state
      const snap_rc     = rooms.map(r => calcRoom(r, vendorConfig));
      const snap_cabNet = snap_rc.reduce((s,r)=>s+r.net, 0);
      const snap_cabCust= snap_rc.reduce((s,r)=>s+r.price, 0);
      const R           = rateConfig;
      const g = (key, auto) => { const v=parseFloat(ov[key]); return isNaN(v)?auto:v; };
      const snap_overhead     = g("overhead",     snap_cabNet  * R.overhead);
      const snap_design       = g("design",       snap_cabCust * R.design);
      const snap_shipping     = g("shipping",     snap_cabCust * R.shipping);
      const snap_installation = g("installation", snap_cabCust * R.installation);
      const snap_punchlist    = g("punchlist",    snap_cabNet  * R.punchlist);
      const snap_incentive    = g("incentive",    snap_cabNet  * R.incentive);
      const snap_salesTax     = g("salesTax",     snap_cabNet  * R.salesTax);
      const snap_hardware     = g("hardware",     0);
      const snap_misc         = g("misc",         0);
      const snap_addlSub      = snap_overhead+snap_design+snap_shipping+snap_installation+snap_punchlist+snap_incentive+snap_hardware+snap_misc;
      const snap_calcTotal    = snap_cabCust + snap_addlSub + snap_salesTax;
      const snap_effPrice     = parseFloat(finalPrice)||snap_calcTotal;
      const snap_totalCost    = snap_cabNet+snap_overhead+snap_design+snap_shipping+snap_installation+snap_punchlist+snap_incentive+snap_salesTax+snap_hardware+snap_misc;
      const snap_profit       = snap_effPrice - snap_totalCost;
      const snap_corpTax      = snap_profit > 0 ? snap_profit * 0.10 : 0;
      const snap_netProfit    = snap_profit - snap_corpTax;
      const snap_margin       = snap_effPrice > 0 ? snap_profit/snap_effPrice : 0;
      const snap_marginOk     = snap_margin >= R.minMargin;
      const entry = {
        id: proj.quoteNum || proj.name.toLowerCase().replace(/\s+/g,"-") || "draft",
        proj: {...proj},
        rooms: [...rooms],
        ov: {...ov},
        finalPrice,
        effPrice:    snap_effPrice,
        totalCost:   snap_totalCost,
        profit:      snap_profit,
        margin:      snap_margin,
        corpTax:     snap_corpTax,
        netProfit:   snap_netProfit,
        marginOk:    snap_marginOk,
        savedAt: new Date().toLocaleDateString(),
      };
      setSavedProjects(prev => {
        const existing = prev.findIndex(p => p.id === entry.id);
        if (existing >= 0) {
          const updated = [...prev]; updated[existing] = entry; return updated;
        }
        return [...prev, entry];
      });
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus(""), 2000);
    }, 800);
    return () => clearTimeout(timer);
  }, [proj, rooms, ov, finalPrice]);

  // ── Calculations ───────────────────────────────────────────
  const rc      = rooms.map(r => calcRoom(r, vendorConfig));
  const cabNet  = rc.reduce((s,r)=>s+r.net, 0);
  const cabCust = rc.reduce((s,r)=>s+r.price, 0);
  const R       = rateConfig;

  const get = (key, auto) => { const v=parseFloat(ov[key]); return isNaN(v)?auto:v; };
  const overhead     = get("overhead",     cabNet  * R.overhead);
  const design       = get("design",       cabCust * R.design);
  const shipping     = get("shipping",     cabCust * R.shipping);
  const installation = get("installation", cabCust * R.installation);
  const punchlist    = get("punchlist",    cabNet  * R.punchlist);
  const incentive    = get("incentive",    cabNet  * R.incentive);
  const salesTax     = get("salesTax",     cabNet  * R.salesTax);
  const hardware     = get("hardware",     0);
  const misc         = get("misc",         0);

  const addlSub   = overhead+design+shipping+installation+punchlist+incentive+hardware+misc;
  const subtotal  = cabCust+addlSub;
  const calcTotal = subtotal+salesTax;
  const effPrice  = parseFloat(finalPrice)||calcTotal;
  const totalCost = cabNet+overhead+design+shipping+installation+punchlist+incentive+salesTax+hardware+misc;
  const profit    = effPrice-totalCost;
  const corpTax   = profit > 0 ? profit * 0.10 : 0;  // 10% reserve on profit — owner only
  const netProfit = profit - corpTax;
  const margin    = effPrice>0?profit/effPrice:0;
  const floorPrice= totalCost/(1-R.minMargin);
  const avgMult   = rc.length ? rc.reduce((a,r)=>a+(vendorConfig[r.vendor]?.multiplier??1.6),0)/rc.length : 1.6;
  const gutCheck  = cabNet*1.05*avgMult;
  const marginOk  = margin>=R.minMargin;

  const addRoom    = () => setRooms(p=>[...p,newRoom(Date.now(), proj.vendor)]);
  const removeRoom = id => setRooms(p=>p.filter(r=>r.id!==id));
  const updRoom    = (id,f,v) => setRooms(p=>p.map(r=>r.id===id?{...r,[f]:v}:r));

  const saveProject = () => {
    const entry = {
      id: proj.quoteNum || Date.now().toString(),
      proj: {...proj},
      rooms: [...rooms],
      ov: {...ov},
      finalPrice,
      effPrice,
      totalCost,
      profit,
      margin,
      corpTax,
      netProfit,
      marginOk,
      savedAt: new Date().toLocaleDateString(),
    };
    setSavedProjects(prev => {
      const existing = prev.findIndex(p => p.id === entry.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = entry;
        return updated;
      }
      return [...prev, entry];
    });
  };

  const isOwner = session?.role === "owner";

  // ── NAV TABS ───────────────────────────────────────────────
  const tabs = [
    { id:"quote",   label:"Quote Builder",   always:true },
    { id:"change",  label:"Change Order",    always:true },
    { id:"owner",   label:"Owner View",      always:false },
    { id:"backend", label:"Owner Backend",   always:false },
  ];

  // ── LOGIN SCREEN ───────────────────────────────────────────
  if (!session) return (
    <div style={{minHeight:"100vh",background:C.parchment,
      display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{CSS}</style>
      <div className="fade" style={{
        background:C.white,border:`1px solid ${C.stone}`,
        padding:"64px 72px",textAlign:"center",width:400,
      }}>
        <div style={{
          fontFamily:"'Cormorant Garamond',serif",
          fontSize:11,letterSpacing:"0.32em",color:C.stoneDk,
          textTransform:"uppercase",marginBottom:28,
        }}>Old Goats Hard Goods</div>
        <div style={{
          fontFamily:"'Cormorant Garamond',serif",
          fontSize:36,fontWeight:300,color:C.charcoal,
          lineHeight:1.1,marginBottom:40,
        }}>Pricing<br/>Tool</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input value={loginUser} onChange={e=>{setLoginUser(e.target.value);setLoginErr(false);}}
            onKeyDown={e=>e.key==="Enter"&&tryLogin()}
            placeholder="Username"
            className="ri ph"
            style={{
              ...iSt,textAlign:"center",letterSpacing:"0.12em",
              borderColor:loginErr?C.rust:C.stone,
            }}/>
          <input type="password" value={loginPw} onChange={e=>{setLoginPw(e.target.value);setLoginErr(false);}}
            onKeyDown={e=>e.key==="Enter"&&tryLogin()}
            placeholder="Password"
            className="ri ph"
            style={{
              ...iSt,textAlign:"center",letterSpacing:"0.2em",
              borderColor:loginErr?C.rust:C.stone,
            }}/>
          {loginErr&&<div style={{fontSize:9,color:C.rust,letterSpacing:"0.15em",
            textTransform:"uppercase"}}>Invalid credentials</div>}
          <button onClick={tryLogin} style={{
            background:C.charcoal,color:C.parchment,border:"none",
            padding:14,cursor:"pointer",marginTop:4,
            fontSize:9,letterSpacing:"0.28em",textTransform:"uppercase",
            fontFamily:"'Jost',sans-serif",fontWeight:500,
          }}>Sign In</button>
        </div>
        <div style={{marginTop:28,fontSize:10,color:C.stoneDk,letterSpacing:"0.06em"}}>
          Contact your administrator for access.
        </div>
      </div>
    </div>
  );

  // ── MAIN APP ───────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:C.parchment}}>
      <style>{CSS}</style>

      {/* Header */}
      <header style={{
        background:C.white,borderBottom:`1px solid ${C.stone}`,
        position:"sticky",top:0,zIndex:100,
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 56px",height:60,
      }}>
        <div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",
            fontSize:13,fontWeight:400,letterSpacing:"0.28em",
            color:C.charcoal,textTransform:"uppercase"}}>Old Goats Hard Goods</div>
          <div style={{fontSize:8,letterSpacing:"0.32em",color:C.stoneDk,
            textTransform:"uppercase",marginTop:2}}>Project Pricing</div>
        </div>

        <nav style={{display:"flex",gap:1,alignItems:"center"}}>
          {tabs.filter(t=>t.always||isOwner).map(t=>(
            <button key={t.id} className="navbtn" onClick={()=>setView(t.id)} style={{
              background:view===t.id?C.charcoal:"transparent",
              color:view===t.id?C.parchment:C.stoneDk,
              border:"none",padding:"6px 22px",
              fontSize:8,fontWeight:500,letterSpacing:"0.22em",
              textTransform:"uppercase",cursor:"pointer",
              fontFamily:"'Jost',sans-serif",transition:"all 0.2s",
            }}>{t.label}</button>
          ))}
          <div style={{width:1,height:20,background:C.stone,margin:"0 8px"}}/>
          <div style={{fontSize:9,color:C.stoneDk,letterSpacing:"0.1em",marginRight:12}}>
            {session.displayName||session.user} {isOwner&&<span style={{color:C.clay}}>· admin</span>}
          </div>
          <button onClick={logout} style={{
            background:"none",border:`1px solid ${C.stone}`,
            color:C.stoneDk,padding:"5px 14px",cursor:"pointer",
            fontSize:8,letterSpacing:"0.18em",textTransform:"uppercase",
            fontFamily:"'Jost',sans-serif",
          }}>Sign Out</button>
        </nav>
      </header>

      <div style={{height:2,background:C.charcoal}}/>

      <main style={{maxWidth:980,margin:"0 auto",padding:"56px 56px 96px"}}>

        {/* ── OWNER BACKEND ─────────────────────────────── */}
        {view==="backend"&&isOwner&&(
          <div className="fade">
            <div style={{marginBottom:36}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",
                fontSize:9,letterSpacing:"0.18em",color:C.stoneDk,marginBottom:8}}>03</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",
                fontSize:24,fontWeight:300,color:C.charcoal}}>Owner Backend</div>
              <div style={{fontSize:11,color:C.stoneDk,marginTop:6,letterSpacing:"0.04em"}}>
                Edit rates, manage vendor multipliers, and track annual job performance.
                Changes to rates take effect immediately in the Quote Builder.
              </div>
            </div>
            <OwnerBackend
              onRatesChange={updated => {
                const flat = {};
                Object.entries(updated).forEach(([k,v]) => flat[k]=v.value);
                setRateConfig(prev=>({...prev,...flat}));
              }}
              onVendorsChange={setVendorConfig}
            />
          </div>
        )}

        {/* ── OWNER VIEW ────────────────────────────────── */}
        {view==="owner"&&isOwner&&(
          <OwnerView
            proj={proj} cabNet={cabNet} cabCust={cabCust}
            overhead={overhead} design={design} shipping={shipping}
            installation={installation} punchlist={punchlist}
            incentive={incentive} salesTax={salesTax}
            hardware={hardware} misc={misc}
            totalCost={totalCost} effPrice={effPrice}
            profit={profit} margin={margin} floorPrice={floorPrice}
            corpTax={corpTax} netProfit={netProfit}
            gutCheck={gutCheck} marginOk={marginOk}
            rooms={rooms} rc={rc}
            savedProjects={savedProjects} setSavedProjects={setSavedProjects}
          />
        )}

        {/* ── QUOTE BUILDER ─────────────────────────────── */}
        {view==="quote"&&(
          <div className="fade">

            <div className={printMode==="quote-client"?"hide-when-client-pdf":""} style={{display:"contents"}}>
            <SecHead n="01" title="Project Information"/>
            <div style={{marginBottom:52}}>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:24,marginBottom:20}}>
                <F label="Project / Client" value={proj.name} onChange={v=>setProj(p=>({...p,name:v}))} placeholder="Client name"/>
                <F label="Date" type="date" value={proj.date} onChange={v=>setProj(p=>({...p,date:v}))}/>
                <div>
                  <FL>Quote No. <span style={{fontWeight:300,color:C.stoneDk}}>— auto-generated</span></FL>
                  <input
                    value={proj.quoteNum}
                    onChange={e=>setProj(p=>({...p,quoteNum:e.target.value}))}
                    placeholder="Enter name & date above"
                    className="ri ph"
                    style={{...iSt,
                      fontSize:proj.quoteNum&&proj.quoteNum.length>22?10:12,
                      letterSpacing:"0.02em",
                      color:C.charcoal,
                    }}
                  />
                  <div style={{marginTop:5,fontSize:9,color:C.stoneDk,letterSpacing:"0.06em"}}>
                    Editable if needed
                  </div>
                </div>
                <div>
                  <FL>State</FL>
                  <select value={proj.state} onChange={e=>setProj(p=>({...p,state:e.target.value}))} className="rs" style={sSt}>
                    {Object.entries(STATE_TAX).map(([code,info])=>(
                      <option key={code} value={code}>{code} — {info.label.split("(")[1]?.replace(")","")}</option>
                    ))}
                  </select>
                  <div style={{marginTop:5,fontSize:10,color:C.stoneDk,letterSpacing:"0.08em"}}>
                    {STATE_TAX[proj.state]?.label}
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:24}}>
                <div>
                  <FL>Default Vendor <span style={{fontWeight:300,color:C.stoneDk}}>— pre-fills new rooms</span></FL>
                  <select value={proj.vendor} onChange={e=>setProj(p=>({...p,vendor:e.target.value}))} className="rs" style={sSt}>
                    {Object.keys(vendorConfig).map(v=><option key={v}>{v}</option>)}
                  </select>
                  <div style={{marginTop:5,fontSize:10,color:C.stoneDk,letterSpacing:"0.08em"}}>
                    Each room can use a different vendor below
                  </div>
                </div>
                <div>
                  <FL>Status</FL>
                  <select value={proj.status} onChange={e=>setProj(p=>({...p,status:e.target.value}))} className="rs"
                    style={{...sSt,color:STATUS_CONFIG[proj.status]?.color,
                      background:STATUS_CONFIG[proj.status]?.bg,
                      borderColor:STATUS_CONFIG[proj.status]?.color+"55"}}>
                    {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <F label="Notes" value={proj.notes} onChange={v=>setProj(p=>({...p,notes:v}))} placeholder="Optional"/>
              </div>
            </div>

            <HR/>

            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"baseline",marginBottom:28}}>
              <SecHead n="02" title="Room Pricing" inline/>
              <button onClick={addRoom} className="addbtn" style={{
                background:"transparent",border:`1px solid ${C.stoneMd}`,
                color:C.bark,padding:"7px 20px",
                fontSize:8,letterSpacing:"0.22em",textTransform:"uppercase",
                cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:500,
                transition:"all 0.2s",
              }}>+ Add Room</button>
            </div>

            <div style={{
              display:"grid",gridTemplateColumns:"1.6fr 1.1fr 1fr 1fr 0.9fr 1.2fr 1.2fr 24px",
              gap:14,paddingBottom:10,
              borderBottom:`1px solid ${C.stone}`,marginBottom:2,
            }}>
              {["Room / Area","Vendor","List Price","Net Price","Upcharge","Calc. Price","Override",""].map((h,i)=>(
                <div key={i} style={{fontSize:8,letterSpacing:"0.2em",color:C.stoneDk,
                  textTransform:"uppercase",textAlign:i>1&&i<7?"right":"left"}}>{h}</div>
              ))}
            </div>

            {rooms.map((room,idx)=>{
              const c=rc[idx];
              const pct=cabCust>0?c.price/cabCust:0;
              const isCustom = room.vendor==="Custom Fabrication";
              return(
                <div key={room.id} className="rr" style={{
                  display:"grid",gridTemplateColumns:"1.6fr 1.1fr 1fr 1fr 0.9fr 1.2fr 1.2fr 24px",
                  gap:14,padding:"5px 0",
                  borderBottom:`1px solid ${C.parchmentDk}`,alignItems:"center",
                  background: c.overridden?"#F5F2E8":"transparent",
                }}>
                  <div>
                    <input list={`r-${room.id}`} value={room.name}
                      onChange={e=>updRoom(room.id,"name",e.target.value)}
                      placeholder={`Room ${idx+1}`} className="ri ph" style={iSt}/>
                    <datalist id={`r-${room.id}`}>
                      {ROOM_SUGGESTIONS.map(s=><option key={s} value={s}/>)}
                    </datalist>
                  </div>
                  <div>
                    <select value={room.vendor||"Bellmont"}
                      onChange={e=>updRoom(room.id,"vendor",e.target.value)}
                      className="rs"
                      style={{...sSt,fontSize:11,
                        color: isCustom?C.clay:C.bark,
                        background: isCustom?"#F2EAD8":C.parchment,
                        borderColor: isCustom?C.clay:C.stone,
                      }}>
                      {Object.keys(vendorConfig).map(v=><option key={v}>{v}</option>)}
                    </select>
                    {isCustom&&(
                      <div style={{fontSize:9,color:C.clay,marginTop:3,letterSpacing:"0.06em"}}>
                        ⚠ Review multiplier
                      </div>
                    )}
                    <div style={{fontSize:9,color:C.stoneDk,marginTop:2,letterSpacing:"0.06em"}}>
                      ×{(vendorConfig[room.vendor||"Bellmont"]?.multiplier??1.6).toFixed(2)}
                      {(room.vendor||"Bellmont")==="Bellmont"&&" · ×0.48 net"}
                    </div>
                  </div>
                  <input type="number" value={room.list} placeholder="—"
                    onChange={e=>updRoom(room.id,"list",e.target.value)}
                    className="ri ph" style={{...iSt,textAlign:"right"}}/>
                  <div style={{...iSt,background:C.parchmentDk,color:C.clay,
                    textAlign:"right",display:"flex",alignItems:"center",
                    justifyContent:"flex-end",fontVariantNumeric:"tabular-nums"}}>
                    {c.net>0?fmt(c.net):"—"}
                  </div>
                  <input type="number" value={room.upcharge} placeholder="—"
                    onChange={e=>updRoom(room.id,"upcharge",e.target.value)}
                    className="ri ph" style={{...iSt,textAlign:"right"}}/>
                  <div style={{textAlign:"right",fontSize:13,
                    fontWeight:c.price>0?500:300,
                    color:c.overridden?C.clay:c.price>0?C.charcoal:C.stoneMd,
                    fontVariantNumeric:"tabular-nums",
                    fontFamily:"'Cormorant Garamond',serif"}}>
                    {c.price>0?(
                      <span>
                        {fmt(c.price)}
                        {c.overridden&&<span style={{fontSize:8,color:C.clay,
                          display:"block",letterSpacing:"0.08em",fontFamily:"'Jost',sans-serif",
                          marginTop:2}}>overridden</span>}
                        {!c.overridden&&pct>0&&<span style={{fontSize:9,color:C.stoneDk,
                          marginLeft:5,fontFamily:"'Jost',sans-serif",
                          letterSpacing:"0.08em"}}>{fmtPct(pct)}</span>}
                      </span>
                    ):"—"}
                  </div>
                  <input type="number" value={room.priceOverride} placeholder="—"
                    onChange={e=>updRoom(room.id,"priceOverride",e.target.value)}
                    className="ri ph" style={{
                      ...iSt,textAlign:"right",fontSize:12,
                      borderColor: room.priceOverride?C.clay:C.stone,
                      background: room.priceOverride?"#F5F2E8":C.parchment,
                    }}/>
                  <button className="xbtn" onClick={()=>removeRoom(room.id)} style={{
                    background:"none",border:"none",color:C.stoneMd,
                    fontSize:15,cursor:"pointer",opacity:0,
                    transition:"opacity 0.15s",padding:"0 2px",lineHeight:1,
                  }}>×</button>
                </div>
              );
            })}

            <div style={{
              display:"grid",gridTemplateColumns:"1.6fr 1.1fr 1fr 1fr 0.9fr 1.2fr 1.2fr 24px",
              gap:14,paddingTop:14,marginTop:6,
              borderTop:`2px solid ${C.charcoal}`,
            }}>
              <div style={{fontSize:9,letterSpacing:"0.2em",textTransform:"uppercase",
                color:C.bark,fontWeight:500,display:"flex",alignItems:"center"}}>Totals</div>
              <div/>
              <div style={{textAlign:"right",fontSize:12,color:C.stoneDk,
                fontVariantNumeric:"tabular-nums",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                {fmt(rooms.reduce((s,r)=>s+(parseFloat(r.list)||0),0))}
              </div>
              <div style={{textAlign:"right",fontSize:13,color:C.clay,
                fontFamily:"'Cormorant Garamond',serif",fontVariantNumeric:"tabular-nums",
                display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                {fmt(cabNet)}
              </div>
              <div/>
              <div style={{textAlign:"right",fontSize:16,color:C.charcoal,
                fontFamily:"'Cormorant Garamond',serif",fontVariantNumeric:"tabular-nums",
                display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                {fmt(cabCust)}
              </div>
              <div/>
              <div/>
            </div>

            <HR/>

            <SecHead n="03" title="Additional Line Items"/>
            <div style={{
              display:"grid",gridTemplateColumns:"repeat(3,1fr)",
              gap:"1px",background:C.stone,
              border:`1px solid ${C.stone}`,marginBottom:32,
            }}>
              {[
                ["overhead",    "Overhead",            fmt(cabNet *R.overhead),    "18% of net cost",             true],
                ["design",      "Design Fee",          fmt(cabCust*R.design),      "5% of customer",              true],
                ["shipping",    "Shipping / Delivery", fmt(cabCust*R.shipping),    "3% of customer",              true],
                ["installation","Installation",        fmt(cabCust*R.installation),`${(STATE_TAX[proj.state]?.install*100||15).toFixed(0)}% of customer`, true],
                ["punchlist",   "Punchlist Reserve",   fmt(cabNet *R.punchlist),   "4% of net cost",              true],
                ["incentive",   "Employee Incentive",  fmt(cabNet *R.incentive),   `${(R.incentive*100).toFixed(0)}% of net cost`, STATE_TAX[proj.state]?.showIncentive!==false],
                ["salesTax",    "Sales Tax",           fmt(cabNet *R.salesTax),    STATE_TAX[proj.state]?.label ?? "of net cost", true],
                ["hardware",    "Cabinet Hardware",    "Manual entry",              "",                           true],
                ["misc",        "Misc",                "Manual entry",              "",                           true],
              ].filter(([,,,,show])=>show!==false).map(([key,lbl,auto,basis])=>(
                <div key={key} style={{background:C.white,padding:"20px 22px"}}>
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:8,letterSpacing:"0.22em",color:C.stoneDk,
                      textTransform:"uppercase",marginBottom:2}}>{lbl}</div>
                    {basis&&<div style={{fontSize:10,color:C.stoneMd}}>{basis}</div>}
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <div style={{flex:1,fontSize:13,color:C.clay,fontWeight:300,
                      fontVariantNumeric:"tabular-nums",padding:"8px 0",
                      borderBottom:`1px solid ${C.stone}`,
                      fontFamily:"'Cormorant Garamond',serif"}}>{auto}</div>
                    <input type="number" placeholder="Override" value={ov[key]}
                      onChange={e=>setOv(o=>({...o,[key]:e.target.value}))}
                      className="ri ph" style={{
                        ...iSt,width:90,fontSize:12,padding:"8px 10px",
                        color:ov[key]?C.charcoal:C.stoneMd,
                      }}/>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              display:"grid",gridTemplateColumns:"repeat(5,1fr)",
              borderTop:`2px solid ${C.charcoal}`,
            }}>
              {[
                ["Cabinetry", fmt(cabCust),  false],
                ["Additional",fmt(addlSub),  false],
                ["Sales Tax", fmt(salesTax), false],
                ["Subtotal",  fmt(subtotal), false],
                ["Total",     fmt(calcTotal),true],
              ].map(([lbl,val,big])=>(
                <div key={lbl} style={{
                  padding:big?"28px 0 28px 24px":"22px 0 22px 20px",
                  background:big?C.charcoal:"transparent",
                  borderRight:`1px solid ${big?C.charcoal:C.stone}`,
                }}>
                  <div style={{fontSize:8,letterSpacing:"0.2em",
                    color:big?C.stoneMd:C.stoneDk,
                    textTransform:"uppercase",marginBottom:8}}>{lbl}</div>
                  <div style={{
                    fontFamily:"'Cormorant Garamond',serif",
                    fontSize:big?32:22,fontWeight:300,
                    color:big?C.parchment:C.bark,
                    fontVariantNumeric:"tabular-nums",lineHeight:1,
                  }}>{val}</div>
                </div>
              ))}
            </div>

            <HR/>

            <SecHead n="04" title="Final Quoted Price"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:48}}>
              <div>
                <FL>Price Override <span style={{color:C.stoneDk,fontWeight:300}}>— leave blank to use calculated</span></FL>
                <input type="number" placeholder={fmt(calcTotal)}
                  value={finalPrice} onChange={e=>setFinalPrice(e.target.value)}
                  className="ri ph"
                  style={{...iSt,fontSize:20,padding:"16px 18px",
                    fontFamily:"'Cormorant Garamond',serif",
                    color:finalPrice?C.charcoal:C.stoneMd}}/>
                {finalPrice&&<div style={{fontSize:9,color:C.clay,letterSpacing:"0.15em",
                  textTransform:"uppercase",marginTop:8}}>Custom negotiated price</div>}
              </div>
              <div style={{background:C.charcoal,padding:"32px 36px",
                display:"flex",flexDirection:"column",justifyContent:"center"}}>
                <div style={{fontSize:8,letterSpacing:"0.3em",color:C.stoneDk,
                  textTransform:"uppercase",marginBottom:14}}>Customer Will Pay</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",
                  fontSize:44,fontWeight:300,color:C.parchment,
                  fontVariantNumeric:"tabular-nums",lineHeight:1}}>
                  {fmt(effPrice)}
                </div>
                <div style={{fontSize:9,color:C.stoneDk,marginTop:12,letterSpacing:"0.1em"}}>
                  {finalPrice?"Negotiated price":"Auto-calculated total"}
                </div>
              </div>
            </div>

            <HR/>

            {/* Auto-save status bar */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"16px 24px",background:C.white,border:`1px solid ${C.stone}`}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                {autoSaveStatus==="saving"&&(
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:C.stoneMd,
                      animation:"pulse 1s infinite"}}/>
                    <span style={{fontSize:10,color:C.stoneDk,letterSpacing:"0.1em"}}>Saving…</span>
                  </div>
                )}
                {autoSaveStatus==="saved"&&(
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:C.moss}}/>
                    <span style={{fontSize:10,color:C.moss,letterSpacing:"0.1em"}}>Auto-saved</span>
                  </div>
                )}
                {!autoSaveStatus&&proj.name&&(
                  <span style={{fontSize:10,color:C.stoneDk,letterSpacing:"0.08em"}}>
                    Changes save automatically to Owner View
                  </span>
                )}
                {!proj.name&&(
                  <span style={{fontSize:10,color:C.stoneMd,letterSpacing:"0.08em",fontStyle:"italic"}}>
                    Enter a project name to enable auto-save
                  </span>
                )}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}} className="no-print">
                {proj.status==="In Progress"&&proj.name&&(
                  <div style={{fontSize:10,color:C.clay,letterSpacing:"0.06em",marginRight:8}}>
                    ⚠ Still <strong>In Progress</strong> — update status when ready to quote
                  </div>
                )}
                <button onClick={()=>triggerPrint("quote-client")} style={{
                  background:C.charcoal,color:C.parchment,border:"none",
                  padding:"7px 20px",
                  fontSize:8,letterSpacing:"0.22em",textTransform:"uppercase",
                  cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:500,
                }}>⎙ Export Client PDF</button>
                <button onClick={()=>triggerPrint("quote-internal")} style={{
                  background:"transparent",border:`1px solid ${C.stoneMd}`,
                  color:C.bark,padding:"7px 20px",
                  fontSize:8,letterSpacing:"0.22em",textTransform:"uppercase",
                  cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:500,
                }}>⎙ Internal Copy</button>
              </div>
            </div>

            </div>{/* end hide-when-client-pdf wrapper */}

          {/* ── CLIENT PDF LAYOUT (hidden on screen, shown when printing client PDF) ── */}
          {printMode==="quote-client"&&(
            <div style={{display:"none"}} className="pdf-quote-client">
              {/* This block is hidden normally; @media print + pdf-quote-client class shows it */}
            </div>
          )}
          <div className="pdf-quote-client" style={{
            display: printMode==="quote-client" ? "block" : "none",
            position:"fixed",top:0,left:0,width:"100%",background:"white",
            padding:"0.75in",fontFamily:"'Jost',sans-serif",zIndex:9999,
          }}>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"flex-end",paddingBottom:24,
              borderBottom:`2px solid #18100A`,marginBottom:32}}>
              <div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",
                  fontSize:28,fontWeight:300,color:"#18100A",letterSpacing:"0.04em"}}>
                  Old Goats Hard Goods
                </div>
                <div style={{fontSize:9,letterSpacing:"0.3em",color:"#4A3520",
                  textTransform:"uppercase",marginTop:6}}>
                  Cabinet & Millwork Quotation
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:"#4A3520",letterSpacing:"0.08em"}}>{proj.date}</div>
                <div style={{fontSize:10,color:"#4A3520",letterSpacing:"0.08em",marginTop:4}}>
                  Quote: {proj.quoteNum||"—"}
                </div>
                <div style={{fontSize:11,color:"#18100A",fontWeight:500,marginTop:4}}>
                  Status: {proj.status}
                </div>
              </div>
            </div>

            {/* Client info */}
            <div style={{marginBottom:32}}>
              <div style={{fontSize:8,letterSpacing:"0.28em",color:"#4A3520",
                textTransform:"uppercase",marginBottom:6}}>Prepared For</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",
                fontSize:22,fontWeight:300,color:"#18100A"}}>
                {proj.name||"—"}
              </div>
              <div style={{fontSize:10,color:"#4A3520",marginTop:4,letterSpacing:"0.04em"}}>
                {STATE_TAX[proj.state]?.label}
              </div>
            </div>

            {/* Room pricing table */}
            <div style={{marginBottom:32}}>
              <div style={{fontSize:8,letterSpacing:"0.28em",color:"#4A3520",
                textTransform:"uppercase",marginBottom:12,paddingBottom:8,
                borderBottom:"1px solid #D8CFBC"}}>Scope of Work</div>
              <div style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr",
                gap:12,paddingBottom:8,borderBottom:"1px solid #D8CFBC",marginBottom:4}}>
                {["Room / Area","Vendor","Price"].map((h,i)=>(
                  <div key={h} style={{fontSize:8,letterSpacing:"0.18em",color:"#4A3520",
                    textTransform:"uppercase",textAlign:i===2?"right":"left"}}>{h}</div>
                ))}
              </div>
              {rooms.filter(r=>r.name||parseFloat(r.list)>0).map((room,i)=>{
                const c=rc[rooms.indexOf(room)];
                return c?.price>0?(
                  <div key={room.id} style={{display:"grid",
                    gridTemplateColumns:"3fr 1fr 1fr",gap:12,
                    padding:"8px 0",borderBottom:"1px solid #EDE6D8"}}>
                    <div style={{fontSize:12,color:"#18100A"}}>{room.name||`Room ${i+1}`}</div>
                    <div style={{fontSize:11,color:"#4A3520"}}>{room.vendor||"Bellmont"}</div>
                    <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
                      fontSize:14,color:"#18100A",fontVariantNumeric:"tabular-nums"}}>
                      {fmt(c.price)}
                    </div>
                  </div>
                ):null;
              })}
              <div style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr",
                gap:12,paddingTop:12,marginTop:4,borderTop:"2px solid #18100A"}}>
                <div style={{fontSize:9,letterSpacing:"0.18em",color:"#18100A",
                  fontWeight:500,textTransform:"uppercase"}}>Cabinet Subtotal</div>
                <div/>
                <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
                  fontSize:16,color:"#18100A",fontVariantNumeric:"tabular-nums",fontWeight:400}}>
                  {fmt(cabCust)}
                </div>
              </div>
            </div>

            {/* Additional items — client-visible only, no percentages */}
            <div style={{marginBottom:32}}>
              <div style={{fontSize:8,letterSpacing:"0.28em",color:"#4A3520",
                textTransform:"uppercase",marginBottom:12,paddingBottom:8,
                borderBottom:"1px solid #D8CFBC"}}>Additional Items</div>
              {[
                ["Installation",        fmt(installation)],
                ["Shipping & Delivery", fmt(shipping)],
                ...(parseFloat(ov.hardware)||0 ? [["Cabinet Hardware", fmt(hardware)]] : []),
                ...(parseFloat(ov.misc)||0     ? [["Miscellaneous",    fmt(misc)]]     : []),
                ["Sales Tax",           fmt(salesTax)],
              ].map(([lbl,val])=>(
                <div key={lbl} style={{display:"flex",justifyContent:"space-between",
                  padding:"7px 0",borderBottom:"1px solid #EDE6D8"}}>
                  <div style={{fontSize:11,color:"#18100A"}}>{lbl}</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",
                    fontSize:13,color:"#18100A",fontVariantNumeric:"tabular-nums"}}>{val}</div>
                </div>
              ))}
            </div>

            {/* Total box */}
            <div style={{
              background:"#18100A",color:"#F5F0E8",
              padding:"24px 32px",
              display:"flex",justifyContent:"space-between",alignItems:"center",
              marginBottom:40,
            }}>
              <div style={{fontSize:9,letterSpacing:"0.3em",textTransform:"uppercase",color:"#D8CFBC"}}>
                Total Project Investment
              </div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",
                fontSize:36,fontWeight:300,fontVariantNumeric:"tabular-nums"}}>
                {fmt(effPrice)}
              </div>
            </div>

            {/* Notes */}
            {proj.notes&&(
              <div style={{marginBottom:32,padding:"16px 20px",
                border:"1px solid #D8CFBC",
                fontSize:11,color:"#4A3520",lineHeight:1.6}}>
                <div style={{fontSize:8,letterSpacing:"0.22em",textTransform:"uppercase",
                  color:"#4A3520",marginBottom:8}}>Notes</div>
                {proj.notes}
              </div>
            )}

            {/* Footer */}
            <div style={{paddingTop:20,borderTop:"1px solid #D8CFBC",
              display:"flex",justifyContent:"space-between",
              fontSize:9,color:"#6B5540",letterSpacing:"0.06em"}}>
              <div>This quote is valid for 30 days from the date above.</div>
              <div>Old Goats Hard Goods · {new Date().getFullYear()}</div>
            </div>
          </div>

          </div>
        )}

        {/* ── CHANGE ORDER VIEW ─────────────────────────────── */}
        {view==="change"&&(
          <div className="fade">

            {/* Print header — only visible when printing */}
            <div className="print-only" style={{display:"none",marginBottom:32}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:11,
                letterSpacing:"0.28em",textTransform:"uppercase",color:C.charcoal,marginBottom:4}}>
                Old Goats Hard Goods
              </div>
              <div style={{fontSize:8,letterSpacing:"0.2em",color:C.stoneDk,textTransform:"uppercase"}}>
                Change Order
              </div>
            </div>

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:36}}>
              <SecHead n="CO" title="Change Order"/>
              <button onClick={()=>triggerPrint("co")} className="no-print" style={{
                background:C.charcoal,color:C.parchment,border:"none",
                padding:"7px 20px",
                fontSize:8,letterSpacing:"0.22em",textTransform:"uppercase",
                cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:500,
              }}>⎙ Export PDF</button>
            </div>

            {/* Project info strip */}
            <div style={{
              display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",
              gap:24,marginBottom:40,
              padding:"20px 24px",
              background:C.white,border:`1px solid ${C.stone}`,
            }}>
              <div>
                <FL>Project / Client</FL>
                <div style={{fontSize:14,color:C.charcoal,fontFamily:"'Cormorant Garamond',serif"}}>
                  {proj.name||<span style={{color:C.stoneMd,fontStyle:"italic"}}>No project loaded</span>}
                </div>
              </div>
              <div>
                <FL>Original Quote No.</FL>
                <div style={{fontSize:12,color:C.charcoal,fontFamily:"'Cormorant Garamond',serif",lineHeight:1.3}}>
                  {proj.quoteNum||"—"}
                </div>
              </div>
              <div>
                <FL>Change Order No.</FL>
                <div style={{fontSize:12,color:C.charcoal,fontFamily:"'Cormorant Garamond',serif",lineHeight:1.3}}>
                  {proj.quoteNum ? `${proj.quoteNum}_CO${String(changeOrders.length||1).padStart(2,"0")}` : "—"}
                </div>
              </div>
              <div>
                <FL>CO Date</FL>
                <input type="date" className="ri" style={{...iSt,fontSize:12}}/>
              </div>
            </div>

            <HR/>

            {/* Change order line items */}
            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"baseline",marginBottom:24}}>
              <SecHead n="01" title="Changes" inline/>
              <button onClick={addCO} className="addbtn no-print" style={{
                background:"transparent",border:`1px solid ${C.stoneMd}`,
                color:C.bark,padding:"7px 20px",
                fontSize:8,letterSpacing:"0.22em",textTransform:"uppercase",
                cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:500,
                transition:"all 0.2s",
              }}>+ Add Line</button>
            </div>

            {/* Column headers */}
            <div style={{
              display:"grid",
              gridTemplateColumns:"3fr 1.2fr 1fr 1.5fr 24px",
              gap:16,paddingBottom:10,
              borderBottom:`1px solid ${C.stone}`,marginBottom:4,
            }}>
              {["Description of Change","Amount","Approved","Date / Notes",""].map((h,i)=>(
                <div key={i} style={{fontSize:8,letterSpacing:"0.2em",color:C.stoneDk,
                  textTransform:"uppercase",
                  textAlign:i===1?"right":"left"}}>{h}</div>
              ))}
            </div>

            {changeOrders.length===0&&(
              <div style={{padding:"32px 0",textAlign:"center",
                color:C.stoneDk,fontSize:12,
                letterSpacing:"0.06em",borderBottom:`1px solid ${C.parchmentDk}`}}>
                No change orders yet — click + Add Line to begin
              </div>
            )}

            {changeOrders.map((co,idx)=>(
              <div key={co.id} style={{
                display:"grid",
                gridTemplateColumns:"3fr 1.2fr 1fr 1.5fr 24px",
                gap:16,padding:"6px 0",
                borderBottom:`1px solid ${C.parchmentDk}`,
                alignItems:"center",
              }}>
                <input value={co.description}
                  onChange={e=>updateCO(co.id,"description",e.target.value)}
                  placeholder={`Change ${idx+1}`}
                  className="ri ph" style={iSt}/>
                <input type="number" value={co.amount}
                  onChange={e=>updateCO(co.id,"amount",e.target.value)}
                  placeholder="—"
                  className="ri ph" style={{...iSt,textAlign:"right"}}/>
                <select value={co.approved}
                  onChange={e=>updateCO(co.id,"approved",e.target.value)}
                  className="rs" style={{
                    ...sSt,fontSize:11,
                    color: co.approved==="Approved"?C.moss:co.approved==="Rejected"?C.rust:C.clay,
                  }}>
                  {["Pending","Approved","Rejected"].map(o=><option key={o}>{o}</option>)}
                </select>
                <input value={co.notes}
                  onChange={e=>updateCO(co.id,"notes",e.target.value)}
                  placeholder="Notes"
                  className="ri ph" style={{...iSt,fontSize:11}}/>
                <button className="xbtn no-print" onClick={()=>removeCO(co.id)} style={{
                  background:"none",border:"none",color:C.stoneMd,
                  fontSize:15,cursor:"pointer",opacity:0.5,
                  padding:"0 2px",lineHeight:1,
                }}>×</button>
              </div>
            ))}

            {/* CO Totals */}
            {changeOrders.length>0&&(
                <div style={{marginTop:24}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",
                    borderTop:`2px solid ${C.charcoal}`}}>
                    {[
                      ["Approved Changes",  fmt(coApproved),         C.moss],
                      ["Pending",           fmt(coPending),          C.clay],
                      ["Original Quote",    fmt(effPrice),           C.bark],
                      ["Revised Total",     fmt(effPrice+coApproved),C.charcoal],
                    ].map(([lbl,val,color])=>(
                      <div key={lbl} style={{padding:"22px 0 22px 20px",
                        borderRight:`1px solid ${C.stone}`}}>
                        <div style={{fontSize:8,letterSpacing:"0.2em",color:C.stoneDk,
                          textTransform:"uppercase",marginBottom:8}}>{lbl}</div>
                        <div style={{fontFamily:"'Cormorant Garamond',serif",
                          fontSize:24,fontWeight:300,color,
                          fontVariantNumeric:"tabular-nums",lineHeight:1}}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
            )}

            <HR/>

            {/* Signature block */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:48}}>
              <div>
                <FL>Client Signature</FL>
                <div style={{height:56,borderBottom:`1px solid ${C.stoneMd}`,marginBottom:8}}/>
                <div style={{fontSize:10,color:C.stoneDk,letterSpacing:"0.08em"}}>
                  Signature · Date
                </div>
              </div>
              <div>
                <FL>Old Goats Representative</FL>
                <div style={{height:56,borderBottom:`1px solid ${C.stoneMd}`,marginBottom:8}}/>
                <div style={{fontSize:10,color:C.stoneDk,letterSpacing:"0.08em"}}>
                  {session?.displayName||session?.user||"Representative"} · Date
                </div>
              </div>
            </div>

            <div style={{marginTop:32,padding:"16px 20px",
              background:C.white,border:`1px solid ${C.stone}`,
              fontSize:10,color:C.stoneDk,lineHeight:1.6,letterSpacing:"0.04em"}}>
              By signing above, client authorizes the changes listed and agrees to the revised project total.
              All other terms of the original contract remain unchanged.
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

// ── Owner View ─────────────────────────────────────────────────
function OwnerView({proj,cabNet,cabCust,overhead,design,shipping,
  installation,punchlist,incentive,salesTax,hardware,misc,
  totalCost,effPrice,profit,margin,netProfit,corpTax,floorPrice,gutCheck,marginOk,rooms,rc,
  savedProjects,setSavedProjects}){
  const activeProjects = (savedProjects||[]).filter(p =>
    ["In Progress","Approved","Quoted"].includes(p.proj.status)
  );
  const removeProject = (id) => setSavedProjects(prev => prev.filter(p => p.id !== id));

  return(
    <div className="fade">

      {/* ── ALL CURRENT PROJECTS ──────────────────────── */}
      {savedProjects&&savedProjects.length>0&&(
        <div style={{marginBottom:48}}>
          <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
            textTransform:"uppercase",marginBottom:16,paddingBottom:8,
            borderBottom:`1px solid ${C.stone}`}}>All Projects</div>

          {/* Headers */}
          <div style={{display:"grid",
            gridTemplateColumns:"2fr 0.8fr 1fr 1fr 1fr 1fr 1fr 24px",
            gap:12,paddingBottom:8,borderBottom:`1px solid ${C.stone}`,marginBottom:4}}>
            {["Project","Status","Vendor","Customer Price","Cost","Profit","Margin",""].map((h,i)=>(
              <div key={i} style={{fontSize:8,letterSpacing:"0.16em",color:C.stoneDk,
                textTransform:"uppercase",textAlign:i>=3&&i<=6?"right":"left"}}>{h}</div>
            ))}
          </div>

          {savedProjects.map((p,i)=>{
            const mOk = p.margin >= 0.20;
            const sc = STATUS_CONFIG[p.proj.status]||{bg:C.stone,color:C.bark};
            return(
              <div key={p.id} style={{display:"grid",
                gridTemplateColumns:"2fr 0.8fr 1fr 1fr 1fr 1fr 1fr 24px",
                gap:12,padding:"10px 0",
                borderBottom:`1px solid ${C.parchmentDk}`,alignItems:"center",
                background:i%2===0?"transparent":"#FDFAF400",
              }}>
                <div>
                  <div style={{fontSize:13,color:C.bark,fontWeight:400}}>{p.proj.name}</div>
                  <div style={{fontSize:9,color:C.stoneDk,marginTop:2,letterSpacing:"0.04em"}}>
                    {p.proj.quoteNum||"—"} · {p.proj.state} · {p.savedAt}
                  </div>
                </div>
                <div>
                  <span style={{
                    fontSize:9,fontWeight:500,letterSpacing:"0.1em",
                    textTransform:"uppercase",color:sc.color,
                    background:sc.bg,padding:"3px 8px",
                  }}>{p.proj.status}</span>
                </div>
                <div style={{fontSize:11,color:C.stoneDk}}>{p.proj.vendor}</div>
                <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
                  fontSize:14,color:C.charcoal,fontVariantNumeric:"tabular-nums"}}>
                  {fmt(p.effPrice)}
                </div>
                <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
                  fontSize:14,color:C.rust,fontVariantNumeric:"tabular-nums"}}>
                  {fmt(p.totalCost)}
                </div>
                <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
                  fontSize:14,color:p.profit>=0?C.moss:C.rust,
                  fontVariantNumeric:"tabular-nums"}}>
                  {fmt(p.profit)}
                </div>
                <div style={{textAlign:"right",fontSize:12,fontWeight:500,
                  color:mOk?C.moss:C.rust,letterSpacing:"0.04em"}}>
                  {fmtPct(p.margin)}
                </div>
                <button onClick={()=>removeProject(p.id)} style={{
                  background:"none",border:"none",color:C.stoneMd,
                  fontSize:15,cursor:"pointer",padding:"0 2px",lineHeight:1,opacity:0.5,
                }}>×</button>
              </div>
            );
          })}

          {/* Pipeline totals */}
          <div style={{display:"grid",
            gridTemplateColumns:"2fr 0.8fr 1fr 1fr 1fr 1fr 1fr 24px",
            gap:12,paddingTop:12,marginTop:4,
            borderTop:`2px solid ${C.charcoal}`}}>
            <div style={{fontSize:9,letterSpacing:"0.2em",textTransform:"uppercase",
              color:C.bark,fontWeight:500,gridColumn:"1/4"}}>
              {savedProjects.length} project{savedProjects.length!==1?"s":""} · pipeline total
            </div>
            <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
              fontSize:15,color:C.charcoal,fontVariantNumeric:"tabular-nums",fontWeight:400}}>
              {fmt(savedProjects.reduce((a,p)=>a+p.effPrice,0))}
            </div>
            <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
              fontSize:15,color:C.rust,fontVariantNumeric:"tabular-nums"}}>
              {fmt(savedProjects.reduce((a,p)=>a+p.totalCost,0))}
            </div>
            <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
              fontSize:15,color:C.moss,fontVariantNumeric:"tabular-nums"}}>
              {fmt(savedProjects.reduce((a,p)=>a+p.profit,0))}
            </div>
            <div/>
            <div/>
          </div>
        </div>
      )}

      {savedProjects&&savedProjects.length===0&&(
        <div style={{marginBottom:48,padding:"28px 24px",
          background:C.white,border:`1px solid ${C.stone}`,
          textAlign:"center",color:C.stoneDk,fontSize:12,letterSpacing:"0.06em"}}>
          No projects saved yet — build a quote and click Save Project to track it here.
        </div>
      )}

      <HR/>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",
        paddingBottom:28,borderBottom:`1px solid ${C.stone}`,marginBottom:44}}>
        <div>
          <div style={{fontSize:8,letterSpacing:"0.3em",color:C.stoneDk,
            textTransform:"uppercase",marginBottom:8}}>Current Quote — Financial Detail</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",
            fontSize:32,fontWeight:300,color:C.charcoal,lineHeight:1.1}}>
            {proj.name||"Untitled Project"}
          </div>
          <div style={{fontSize:11,color:C.stoneDk,marginTop:6,letterSpacing:"0.04em"}}>
            {proj.vendor} · {proj.quoteNum||"—"} · {proj.status}
          </div>
        </div>
        <div style={{padding:"16px 24px",
          background:marginOk?"#D8E0D0":"#E0D0CC",
          borderLeft:`3px solid ${marginOk?C.moss:C.rust}`,textAlign:"right"}}>
          <div style={{fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
            color:marginOk?C.moss:C.rust,marginBottom:6}}>Margin Check</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",
            fontSize:18,fontWeight:400,color:marginOk?C.moss:C.rust}}>
            {marginOk?"Within range":"Below minimum"}
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",
        gap:"1px",background:C.stone,border:`1px solid ${C.stone}`,marginBottom:44}}>
        {[
          ["Customer Price",   fmt(effPrice),   C.charcoal],
          ["Total Cost",       fmt(totalCost),  C.rust],
          ["Gross Profit",     fmt(profit),     profit>=0?C.moss:C.rust],
          ["Corp. Tax (10%)",  fmt(corpTax),    C.rust],
          ["Net Profit",       fmt(netProfit),  netProfit>=0?C.moss:C.rust],
          ["Margin",           fmtPct(margin),  marginOk?C.moss:C.rust],
        ].map(([lbl,val,color])=>(
          <div key={lbl} style={{background:C.white,padding:"28px 24px"}}>
            <div style={{fontSize:8,letterSpacing:"0.22em",color:C.stoneDk,
              textTransform:"uppercase",marginBottom:10}}>{lbl}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",
              fontSize:28,fontWeight:300,color,lineHeight:1,
              fontVariantNumeric:"tabular-nums"}}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.1fr 0.9fr",gap:44,marginBottom:44}}>
        <div>
          <OTtl>Cost Breakdown</OTtl>
          {[
            ["Cabinet Net Cost",        cabNet,       "Direct vendor cost"],
            ["Overhead (18%)",          overhead,     "18% of net"],
            ["Design Fee (5%)",         design,       "5% of customer"],
            ["Shipping (3%)",           shipping,     "3% of customer"],
            ["Installation",             installation, `${(STATE_TAX[proj.state]?.install*100||15).toFixed(0)}% of customer`],
            ["Punchlist Reserve (4%)",  punchlist,    "4% of net"],
            ["Employee Incentive (4%)", incentive,    "Employee incentive plan"],
            ["Sales Tax to Remit",      salesTax,     STATE_TAX[proj.state]?.label ?? "of net"],
            ["Hardware + Misc",         hardware+misc,"Manual entries"],
            ["Corp. Tax Reserve (10%)",  corpTax,      "10% of gross profit — set aside"],
          ].map(([lbl,val,note])=>(
            <div key={lbl} style={{display:"flex",justifyContent:"space-between",
              alignItems:"baseline",padding:"10px 0",
              borderBottom:`1px solid ${C.parchmentDk}`}}>
              <div>
                <div style={{fontSize:12,color:C.bark}}>{lbl}</div>
                <div style={{fontSize:9,color:C.stoneDk,letterSpacing:"0.06em",marginTop:1}}>{note}</div>
              </div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",
                fontSize:15,color:C.bark,fontVariantNumeric:"tabular-nums",marginLeft:16,flexShrink:0}}>
                {fmt(val)}
              </div>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",
            padding:"14px 0",borderTop:`2px solid ${C.charcoal}`,marginTop:4}}>
            <div style={{fontSize:10,fontWeight:500,letterSpacing:"0.15em",
              textTransform:"uppercase",color:C.charcoal}}>Total Cost</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",
              fontSize:24,color:C.charcoal,fontVariantNumeric:"tabular-nums"}}>{fmt(totalCost)}</div>
          </div>
        </div>

        <div>
          <OTtl>Profit Summary</OTtl>
          {[["Customer Price",fmt(effPrice)],["Total Cost",fmt(totalCost)]].map(([lbl,val])=>(
            <div key={lbl} style={{display:"flex",justifyContent:"space-between",
              alignItems:"baseline",padding:"10px 0",
              borderBottom:`1px solid ${C.parchmentDk}`}}>
              <div style={{fontSize:12,color:C.bark}}>{lbl}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",
                fontSize:15,color:C.bark,fontVariantNumeric:"tabular-nums"}}>{val}</div>
            </div>
          ))}
          <div style={{marginTop:16,padding:"20px 22px",
            background:profit>=0?"#EEF2EA":"#F2ECEA",
            borderLeft:`3px solid ${profit>=0?C.moss:C.rust}`}}>
            {[
              ["Estimated Profit",fmt(profit),profit>=0?C.moss:C.rust],
              ["Margin %",fmtPct(margin),marginOk?C.moss:C.rust],
              ["Corp. Tax Reserve (10%)",fmt(corpTax),C.rust],
              ["Net After Tax Reserve",fmt(netProfit),netProfit>=0?C.moss:C.rust],
            ].map(([lbl,val,color])=>(
              <div key={lbl} style={{display:"flex",justifyContent:"space-between",
                alignItems:"baseline",marginBottom:10}}>
                <div style={{fontSize:9,letterSpacing:"0.15em",
                  textTransform:"uppercase",color}}>{lbl}</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",
                  fontSize:26,fontWeight:400,color,
                  fontVariantNumeric:"tabular-nums",lineHeight:1}}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:28}}>
            <OTtl>Reference Points</OTtl>
            {[
              ["Floor Price (min to quote)",fmt(floorPrice)],
              ["Gut Check (Net × 1.05 × mult)",fmt(gutCheck)],
            ].map(([lbl,val])=>(
              <div key={lbl} style={{display:"flex",justifyContent:"space-between",
                alignItems:"baseline",padding:"10px 0",
                borderBottom:`1px solid ${C.parchmentDk}`}}>
                <div style={{fontSize:11,color:C.stoneDk}}>{lbl}</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",
                  fontSize:15,color:C.stoneDk,fontVariantNumeric:"tabular-nums"}}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <OTtl>Room Breakdown</OTtl>
      <div style={{border:`1px solid ${C.stone}`,marginTop:16}}>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 0.65fr",
          background:C.charcoal,padding:"12px 24px"}}>
          {["Room","Net Cost","Customer Price","% of Total"].map((h,i)=>(
            <div key={h} style={{fontSize:8,letterSpacing:"0.2em",color:C.stoneDk,
              textTransform:"uppercase",textAlign:i>0?"right":"left"}}>{h}</div>
          ))}
        </div>
        {rooms.map((room,i)=>{
          const c=rc[i];
          if(!room.name&&!room.list)return null;
          const pct=cabCust>0?c.price/cabCust:0;
          return(
            <div key={room.id} style={{display:"grid",
              gridTemplateColumns:"2fr 1fr 1fr 0.65fr",
              padding:"13px 24px",
              borderBottom:`1px solid ${C.parchmentDk}`,
              background:i%2===0?C.white:C.parchment}}>
              <div style={{fontSize:13,color:C.bark}}>{room.name||`Room ${i+1}`}</div>
              <div style={{textAlign:"right",fontSize:14,color:C.clay,
                fontVariantNumeric:"tabular-nums",fontFamily:"'Cormorant Garamond',serif"}}>{fmt(c.net)}</div>
              <div style={{textAlign:"right",fontSize:14,color:C.charcoal,
                fontVariantNumeric:"tabular-nums",fontFamily:"'Cormorant Garamond',serif"}}>{fmt(c.price)}</div>
              <div style={{textAlign:"right",fontSize:10,color:C.stoneDk}}>{fmtPct(pct)}</div>
            </div>
          );
        })}
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 0.65fr",
          padding:"16px 24px",background:C.charcoal}}>
          <div style={{fontSize:9,letterSpacing:"0.2em",textTransform:"uppercase",
            color:C.parchment,fontWeight:500}}>Totals</div>
          <div style={{textAlign:"right",fontSize:15,color:C.stoneMd,
            fontVariantNumeric:"tabular-nums",fontFamily:"'Cormorant Garamond',serif"}}>{fmt(cabNet)}</div>
          <div style={{textAlign:"right",fontSize:16,color:C.parchment,
            fontVariantNumeric:"tabular-nums",fontFamily:"'Cormorant Garamond',serif"}}>{fmt(cabCust)}</div>
          <div style={{textAlign:"right",fontSize:10,color:C.stoneDk}}>100%</div>
        </div>
      </div>
    </div>
  );
}

function SecHead({n,title,inline}){return(<div style={{display:"flex",alignItems:"baseline",gap:14,marginBottom:inline?0:28}}><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:11,color:C.stoneDk,letterSpacing:"0.18em"}}>{n}</span><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300,color:C.charcoal}}>{title}</span></div>);}
function OTtl({children}){return(<div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,textTransform:"uppercase",marginBottom:16,paddingBottom:8,borderBottom:`1px solid ${C.stone}`}}>{children}</div>);}
function HR(){return <div style={{height:1,background:C.stone,margin:"44px 0"}}/>;}
function FL({children}){return(<div style={{fontSize:8,letterSpacing:"0.22em",color:C.stoneDk,textTransform:"uppercase",marginBottom:8,fontWeight:500}}>{children}</div>);}
function F({label,value,onChange,placeholder,type="text"}){return(<div><FL>{label}</FL><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="ri ph" style={iSt}/></div>);}

const iSt={width:"100%",background:C.parchment,border:`1px solid ${C.stone}`,padding:"10px 14px",color:C.charcoal,fontSize:13,letterSpacing:"0.02em",fontFamily:"'Jost',sans-serif",fontWeight:300};
const sSt={...iSt,cursor:"pointer",appearance:"none",backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%238C7A64'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 14px center",paddingRight:34};
