import { useState, useEffect } from "react";
import OwnerBackend from "./OwnerBackend.jsx";
import * as db from "./db.js";

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
  "WY": { rate:0.04,  label:"Wyoming (4% state rate)",             install:0.15, incentiveRate:0.00,  showIncentive:false },
};

const ROOM_SUGGESTIONS = [
  "Kitchen","Master Bath","Master Closet","Pantry","Laundry",
  "Mudroom","Office","Wet Bar","Powder Bath","Bath 2","Bath 3",
  "Garage","Utility","Media Room","Entry / Foyer","Dining Room",
  "Living Room","Closet","Linen Closet","Accessories / Misc",
];

const STATUS_OPTIONS = ["Quoted","Approved","In Progress","Complete","On Hold","Lost"];
const STATUS_CONFIG = {
  "Quoted":      { bg:"#E8E2D4", color:C.bark },
  "Approved":    { bg:"#D8E0D0", color:C.moss },
  "In Progress": { bg:"#E8DCB8", color:C.clay },
  "Complete":    { bg:"#D0DCE0", color:"#2A4040" },
  "On Hold":     { bg:"#E0D0CC", color:C.rust },
  "Lost":        { bg:"#D8D0CC", color:"#6B4A44" },
};

const fmt    = n => (!n&&n!==0)||isNaN(n) ? "—" : "$"+Math.round(n).toLocaleString("en-US");
const fmtPct = n => (!n&&n!==0)||isNaN(n) ? "—" : (n*100).toFixed(1)+"%";
const newRoom = (id, vendor="Bellmont") => ({ id, name:"", list:"", upcharge:"", vendor, priceOverride:"", accessories:"", comments:"" });

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
  @keyframes spin{to{transform:rotate(360deg)}}
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
  .drag-handle { cursor: grab; opacity: 0.3; transition: opacity 0.15s; user-select: none; }
  .drag-handle:hover { opacity: 0.8; }
  .rr:hover .drag-handle { opacity: 0.6; }
  .rr.drag-over { border-top: 2px solid #8C7B6E !important; }
`;

export default function App() {
  // ── Auth state ─────────────────────────────────────────────
  const [session, setSession] = useState(null); // null | { user, role }
  const [loginUser, setLoginUser] = useState("");
  const [loginPw, setLoginPw]     = useState("");
  const [loginErr, setLoginErr]   = useState(false);

  const [userPerms, setUserPerms] = useState(() => {
    try {
      const stored = localStorage.getItem("og_userPerms");
      // Default: Mark restricted to ID only
      const defaults = { mark: { allowedStates: ["ID"] } };
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch { return { mark: { allowedStates: ["ID"] } }; }
  });

  const tryLogin = () => {
    const u = USERS[loginUser.toLowerCase()];
    if (u && u.password === loginPw) {
      const username = loginUser.toLowerCase();
      const storedPerms = userPerms[username];
      const effectiveAllowedStates = storedPerms?.allowedStates !== undefined
        ? storedPerms.allowedStates   // null means unrestricted, array means restricted
        : (u.allowedStates || null);
      const newSession = { user: username, role: u.role, displayName: u.displayName, allowedStates: effectiveAllowedStates };
      setSession(newSession);
      if (effectiveAllowedStates?.length) setProj(p => ({ ...p, state: effectiveAllowedStates[0] }));
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

  const [stateConfig, setStateConfig]   = useState(() => {
    try {
      const stored = localStorage.getItem("og_stateConfig");
      return stored ? JSON.parse(stored) : STATE_TAX;
    } catch { return STATE_TAX; }
  });

  const [proj, setProj] = useState({
    name:"", date:"", vendor:"Bellmont",
    quoteNum:"", stableId:"", state:"MT", status:"In Progress", notes:"", fileLink:"",
    milestones:{ quoteSent:false, depositRcvd:false, cabsOrdered:false, installSched:false, punchlist:false, complete:false },
    lostReason:"", postJobNotes:"", difficultyRating:"", followUpDate:"",
    actuals:{ installHours:"", cabActual:"", notes:"" },
  });
  const [rooms, setRooms] = useState([
    newRoom(1),newRoom(2),newRoom(3),newRoom(4),newRoom(5),
  ]);
  const [ov, setOv] = useState({
    overhead:"",design:"",shipping:"",
    installation:"",punchlist:"",incentive:"",
    salesTax:"",hardware:"",misc:"",
    lfBase:"",lfTall:"",lfWall:"",lfShelf:"",
    accessories:"",
  });
  const [finalPrice, setFinalPrice] = useState("");
  const [savedProjects, setSavedProjects] = useState(() => {
    try {
      const stored = localStorage.getItem("og_savedProjects");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [autoSaveStatus, setAutoSaveStatus] = useState(""); // "", "saving", "saved"
  const toggleProjectApproval = (projectId) => {
    setSavedProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const nowApproved = !p.quoteApproved;
      return { ...p,
        quoteApproved: nowApproved,
        quoteApprovedAt: nowApproved ? new Date().toLocaleDateString() : null,
        quoteApprovedBy: nowApproved ? (session?.displayName||session?.user) : null,
      };
    }));
  };
  const [printMode, setPrintMode] = useState(""); // "", "quote-client", "co"
  const [lfNudge,   setLfNudge]   = useState(false);
  const [showDupConfirm, setShowDupConfirm] = useState(false);
  const [projSortCol, setProjSortCol] = useState("savedAt");
  const [projSortDir, setProjSortDir] = useState("desc");
  const [projStatusFilter, setProjStatusFilter] = useState("All");
  const [templates, setTemplates] = useState(() => {
    try { const t=localStorage.getItem("og_templates"); return t?JSON.parse(t):[]; } catch { return []; }
  });
  const [showTemplates, setShowTemplates] = useState(false);
  const [showGmailModal,   setShowGmailModal]   = useState(false);
  const [showHistory,     setShowHistory]     = useState(false);
  const [quoteNumEdited,  setQuoteNumEdited]  = useState(false); // true when user manually typed a quote number
  const [mondayModal, setMondayModal] = useState(null); // null | { type:"quote"|"co", data:{} }
  const triggerPrint = (mode) => {
    setPrintMode(mode);
    setTimeout(() => { window.print(); setPrintMode(""); }, 150);
  };

  // ── Template functions ───────────────────────────────────
  const saveAsTemplate = (name) => {
    const tpl = { id:Date.now(), name, rooms:[...rooms], ov:{...ov},
      vendor:proj.vendor, state:proj.state, savedAt:new Date().toLocaleDateString() };
    setTemplates(prev => [...prev.filter(t=>t.name!==name), tpl]);
  };
  const loadTemplate = (tpl) => {
    setRooms(tpl.rooms.map(r => ({...r, id:Date.now()+Math.random()})));
    setOv({...tpl.ov});
    setProj(p => ({...p, vendor:tpl.vendor||p.vendor, state:tpl.state||p.state}));
    setShowTemplates(false);
  };
  const deleteTemplate = (id) => setTemplates(prev => prev.filter(t=>t.id!==id));

  // ── Duplicate project ─────────────────────────────────────
  const duplicateProject = () => {
    const newName = (proj.name||"Untitled") + " (Copy)";
    const today   = new Date().toISOString().split("T")[0];
    setProj(p => ({
      ...p,
      name:           newName,
      date:           today,
      quoteNum:       "",
      stableId:       "",   // CRITICAL: clear so autosave creates a new record, not overwrites original
      status:         "In Progress",
      milestones:     { quoteSent:false, depositRcvd:false, cabsOrdered:false, installSched:false, punchlist:false, complete:false },
      lostReason:     "",
      postJobNotes:   "",
      difficultyRating:"",
      followUpDate:   "",
      actuals:        { installHours:"", cabActual:"", notes:"" },
    }));
    // rooms + ov stay the same — that's the whole point of duplicating
    setFinalPrice("");
    setQuoteNumEdited(false); // let autogen create a new number for the copy
    setView("quote");
  };


  // ── New Quote ─────────────────────────────────────────────
  const BLANK_PROJ = {
    name:"", date:"", vendor:"Bellmont",
    quoteNum:"", stableId:"", state: session?.allowedStates?.[0] || "MT",
    status:"In Progress", notes:"", fileLink:"",
    milestones:{ quoteSent:false, depositRcvd:false, cabsOrdered:false, installSched:false, punchlist:false, complete:false },
    lostReason:"", postJobNotes:"", difficultyRating:"", followUpDate:"",
    actuals:{ installHours:"", cabActual:"", notes:"" },
  };
  const BLANK_OV = {
    overhead:"",design:"",shipping:"",installation:"",punchlist:"",
    incentive:"",salesTax:"",hardware:"",misc:"",
    lfBase:"",lfTall:"",lfWall:"",lfShelf:"",accessories:"",
  };
  const startNewQuote = () => {
    if (proj.name) {
      if (!window.confirm(`Start a new quote?\n\n"${proj.name}" has been auto-saved and will remain in Owner View. You can reload it anytime from the project list.`)) return;
    }
    setProj({...BLANK_PROJ, state: session?.allowedStates?.[0] || "MT"});
    setRooms([newRoom(1),newRoom(2),newRoom(3),newRoom(4),newRoom(5)]);
    setOv({...BLANK_OV});
    setFinalPrice("");
    setQuoteNumEdited(false);
    setView("quote");
  };

  // ── Change Order state (independent, keyed by project id) ──
  // savedChangeOrders: { [projectId]: [ { id, coNum, date, lines:[{...}], approved, notes } ] }
  const [savedChangeOrders, setSavedChangeOrders] = useState(() => {
    try {
      const stored = localStorage.getItem("og_savedChangeOrders");
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  // Active CO session — persists as draft across navigation
  const [activeCO, setActiveCO] = useState(() => {
    try {
      const d = localStorage.getItem("og_co_draft");
      return d ? JSON.parse(d) : null;
    } catch { return null; }
  });
  // activeCO shape: { projectId, projectSnap, coId, coNum, date, lines, notes }
  // line shape: { id, sourceType:"room"|"lineitem"|"custom", sourceId, description, origAmount, markupPct, amount, approved, notes }

  const newCOLine = () => ({
    id: Date.now()+Math.random(),
    sourceType:"custom", sourceId:null,
    description:"", origAmount:"", markupPct:"", amount:"", approved:"Pending", notes:""
  });

  // ── CO quote lookup state ──────────────────────────────────
  const [coQuoteSearch, setCoQuoteSearch] = useState("");
  const [coSearchResult, setCoSearchResult] = useState(null); // null | "not-found"
  const searchAndLoadQuote = () => {
    const q = coQuoteSearch.trim().toLowerCase();
    if (!q) return;
    const found = savedProjects.find(p =>
      (p.proj.quoteNum||"").toLowerCase().includes(q) ||
      (p.proj.name||"").toLowerCase().includes(q)
    );
    if (found) {
      startNewCO(found);
      setCoQuoteSearch("");
      setCoSearchResult(null);
    } else {
      setCoSearchResult("not-found");
    }
  };

  const startNewCO = (projectSnap) => {
    const existing = savedChangeOrders[projectSnap.id] || [];
    const coNum = String(existing.length + 1).padStart(2,"0");
    setActiveCO({
      projectId:   projectSnap.id,
      projectSnap: projectSnap,
      coId:        Date.now(),
      coNum,
      date:        new Date().toISOString().split("T")[0],
      lines:       [newCOLine()],
      notes:       "",
    });
    setView("change");
  };

  const updateCOField = (f,v) => setActiveCO(co=>({...co,[f]:v}));
  const addCOLine    = () => setActiveCO(co=>({...co,lines:[...co.lines,newCOLine()]}));
  const removeCOLine = (id) => setActiveCO(co=>({...co,lines:co.lines.filter(l=>l.id!==id)}));
  const updateCOLine = (id,f,v) => setActiveCO(co=>({
    ...co,
    lines: co.lines.map(l => {
      if (l.id!==id) return l;
      const updated = {...l,[f]:v};
      // Auto-calc amount from origAmount + markupPct when either changes
      if (f==="origAmount"||f==="markupPct") {
        const base = parseFloat(f==="origAmount"?v:updated.origAmount)||0;
        const pct  = parseFloat(f==="markupPct"?v:updated.markupPct)||0;
        if (base>0) updated.amount = String(Math.round(base*(1+pct/100)));
      }
      return updated;
    })
  }));

  // Pre-fill a CO line from an original quote room or line item
  const prefillCOLine = (lineId, sourceType, sourceId, description, origAmount) => {
    setActiveCO(co=>({
      ...co,
      lines: co.lines.map(l => l.id===lineId
        ? {...l, sourceType, sourceId, description,
            origAmount: String(Math.round(origAmount||0)),
            amount: String(Math.round(origAmount||0)) }
        : l)
    }));
  };

  const toggleCOApproval = (projectId, coId) => {
    setSavedChangeOrders(prev => {
      const list = (prev[projectId]||[]).map(co => {
        if (co.coId !== coId) return co;
        const nowApproved = !co.coApproved;
        return { ...co,
          coApproved: nowApproved,
          coApprovedAt: nowApproved ? new Date().toLocaleDateString() : null,
          coApprovedBy: nowApproved ? (session?.displayName||session?.user) : null,
        };
      });
      return { ...prev, [projectId]: list };
    });
  };

  const saveCO = () => {
    if (!activeCO) return;
    setSavedChangeOrders(prev => {
      const list = prev[activeCO.projectId] || [];
      const existing = list.findIndex(c=>c.coId===activeCO.coId);
      const entry = {...activeCO, savedAt: new Date().toLocaleDateString()};
      const updated = existing>=0
        ? list.map((c,i)=>i===existing?entry:c)
        : [...list, entry];
      return {...prev, [activeCO.projectId]: updated};
    });
  };

  // Derived CO totals
  const coLines      = activeCO?.lines || [];
  const coApproved   = coLines.filter(l=>l.approved==="Approved").reduce((a,l)=>a+(parseFloat(l.amount)||0),0);
  const coPending    = coLines.filter(l=>l.approved==="Pending").reduce((a,l)=>a+(parseFloat(l.amount)||0),0);
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
    const st = stateConfig[proj.state];
    if (!st) return;
    setRateConfig(prev => ({ ...prev, salesTax: st.rate, installation: st.install, incentive: st.incentiveRate }));
    setOv(o => ({ ...o, salesTax: "", installation: "", incentive: "" }));
  }, [proj.state]);

  // Auto-generate quote number from project name + date
  // Only overwrites if quoteNum is blank or already matches the auto pattern
  // (prevents restore or manual edits from being clobbered)
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
    if (!quoteNumEdited) {
      setProj(p => ({ ...p, quoteNum: generated }));
    }
  }, [proj.name, proj.date, quoteNumEdited]);

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
      const snap_accessories  = g("accessories", 0);
      const snap_addlSub      = snap_overhead+snap_design+snap_shipping+snap_punchlist+snap_incentive+snap_hardware+snap_misc+snap_accessories;
      const snap_calcTotal    = snap_cabCust + snap_addlSub + snap_installation + snap_salesTax;
      const snap_totalLF      = (parseFloat(ov.lfBase)||0)+(parseFloat(ov.lfTall)||0)+(parseFloat(ov.lfWall)||0)+(parseFloat(ov.lfShelf)||0);
      const snap_effPrice     = parseFloat(finalPrice)||snap_calcTotal;
      const snap_totalCost    = snap_cabNet+snap_overhead+snap_design+snap_shipping+snap_installation+snap_punchlist+snap_incentive+snap_salesTax+snap_hardware+snap_misc+snap_accessories;
      const snap_profit       = snap_effPrice - snap_totalCost;
      const snap_corpTax      = snap_profit > 0 ? snap_profit * 0.10 : 0;
      const snap_netProfit    = snap_profit - snap_corpTax;
      const snap_margin       = snap_effPrice > 0 ? snap_profit/snap_effPrice : 0;
      const snap_marginOk     = snap_margin >= R.minMargin;
      // Use stableId for record identity — survives name/quoteNum changes
      const stableId = proj.stableId || (proj.quoteNum || proj.name.toLowerCase().replace(/\s+/g,"-") || "draft") + "_" + Date.now();
      const entry = {
        id: stableId,
        proj: {...proj},
        rooms: [...rooms],
        ov: {...ov},
        finalPrice,
        installation: snap_installation,
        totalLF:      snap_totalLF,
        effPrice:    snap_effPrice,
        totalCost:   snap_totalCost,
        profit:      snap_profit,
        margin:      snap_margin,
        corpTax:     snap_corpTax,
        netProfit:   snap_netProfit,
        marginOk:    snap_marginOk,
        savedAt: new Date().toLocaleDateString(),
        rateSnapshot: {...rateConfig},
        stateSnapshot: stateConfig[proj.state] ? {...stateConfig[proj.state]} : null,
      };
      setSavedProjects(prev => {
        const existing = prev.findIndex(p => p.id === entry.id);
        if (existing >= 0) {
          const prev_entry = prev[existing];
          // Append revision snapshot (keep last 20)
          const revSnap = {
            ts:        Date.now(),
            savedAt:   new Date().toLocaleString(),
            by:        session?.displayName || session?.user || "?",
            effPrice:  snap_effPrice,
            margin:    snap_margin,
            roomCount: rooms.filter(r=>r.name||parseFloat(r.list)>0).length,
            rooms:     [...rooms],
            ov:        {...ov},
            finalPrice,
            proj:      {...proj},
          };
          const prevRevs = prev_entry.revisions || [];
          const revisions = [...prevRevs, revSnap].slice(-20); // cap at 20
          const preserved = {
            ...entry,
            stableId: prev_entry.stableId || stableId,
            revisions,
            quoteApproved:   prev_entry.quoteApproved,
            quoteApprovedAt: prev_entry.quoteApprovedAt,
            quoteApprovedBy: prev_entry.quoteApprovedBy,
          };
          const updated = [...prev]; updated[existing] = preserved; return updated;
        }
        // First save: write stableId back so future saves find same record
        if (!proj.stableId) setTimeout(() => setProj(p => ({...p, stableId})), 0);
        return [...prev, {...entry, stableId, revisions:[]}];
      });
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus(""), 2000);
    }, 800);
    return () => clearTimeout(timer);
  }, [proj, rooms, ov, finalPrice]);

  // ── Persist savedProjects to localStorage + Supabase ──────────
  useEffect(() => {
    try { localStorage.setItem("og_savedProjects", JSON.stringify(savedProjects)); }
    catch {}
    // Supabase: upsert each project individually (no-op if not enabled)
    if (syncReady) savedProjects.forEach(p => { db.upsertProject(p).catch(()=>{}); });
  }, [savedProjects, syncReady]);

  // ── Persist CO draft to localStorage ─────────────────────
  useEffect(() => {
    try {
      if (activeCO) localStorage.setItem("og_co_draft", JSON.stringify(activeCO));
      else localStorage.removeItem("og_co_draft");
    } catch {}
  }, [activeCO]);

  // ── Supabase sync ──────────────────────────────────────────
  const [syncStatus,  setSyncStatus]  = useState("idle"); // idle|syncing|synced|error
  const [syncMsg,     setSyncMsg]     = useState("");
  const [syncReady,   setSyncReady]   = useState(!db.supabaseEnabled); // true immediately if Supabase disabled

  // Pull from Supabase on login and merge with localStorage
  const syncFromSupabase = async () => {
    if (!db.supabaseEnabled) return;
    setSyncStatus("syncing");
    try {
      // Projects
      const remoteProjects = await db.loadProjects();
      if (remoteProjects && remoteProjects.length > 0) {
        setSavedProjects(local => {
          const localMap = {};
          local.forEach(p => { localMap[p.id] = p; });
          remoteProjects.forEach(p => { localMap[p.id] = p; }); // remote wins
          return Object.values(localMap);
        });
      }
      // Change orders
      const remoteCOs = await db.loadChangeOrders();
      if (remoteCOs && Object.keys(remoteCOs).length > 0) {
        setSavedChangeOrders(local => ({ ...local, ...remoteCOs }));
      }
      // Settings
      const [remoteStates, remotePerms, remoteTemplates] = await Promise.all([
        db.loadSetting("stateConfig"),
        db.loadSetting("userPerms"),
        db.loadSetting("templates"),
      ]);
      if (remoteStates)    setStateConfig(remoteStates);
      if (remotePerms)     setUserPerms(remotePerms);
      if (remoteTemplates) setTemplates(remoteTemplates);

      setSyncReady(true);
      setSyncStatus("synced");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (e) {
      setSyncReady(true);
      setSyncStatus("error");
      setSyncMsg(e.message || "Sync failed");
    }
  };

  // Sync on every login
  useEffect(() => {
    if (session) syncFromSupabase();
  }, [session?.user]);

  // ── Persist userPerms to localStorage + Supabase ─────────────
  useEffect(() => {
    try { localStorage.setItem("og_userPerms", JSON.stringify(userPerms)); } catch {}
    if (syncReady) db.saveSetting("userPerms", userPerms).catch(()=>{});
  }, [userPerms, syncReady]);

  // ── Persist templates to localStorage + Supabase ──────────────
  useEffect(() => {
    try { localStorage.setItem("og_templates", JSON.stringify(templates)); } catch {}
    if (syncReady) db.saveSetting("templates", templates).catch(()=>{});
  }, [templates, syncReady]);

  // ── Persist stateConfig to localStorage + Supabase ────────────
  useEffect(() => {
    try { localStorage.setItem("og_stateConfig", JSON.stringify(stateConfig)); } catch {}
    if (syncReady) db.saveSetting("stateConfig", stateConfig).catch(()=>{});
  }, [stateConfig, syncReady]);

  // ── Persist savedChangeOrders to localStorage + Supabase ──────
  useEffect(() => {
    try { localStorage.setItem("og_savedChangeOrders", JSON.stringify(savedChangeOrders)); }
    catch {}
    // Supabase: upsert each CO individually
    if (syncReady) { Object.entries(savedChangeOrders).forEach(([projectId, cos]) => {
      (cos||[]).forEach(co => { db.upsertCO(projectId, co).catch(()=>{}); });
    }); }
  }, [savedChangeOrders, syncReady]);

  // ── Auto-backup to Drive when savedProjects changes (debounced 30s) ──
  useEffect(() => {
    if (!driveTokenValid) return;          // only if already authenticated
    if (!savedProjects.length) return;     // nothing to back up
    const timer = setTimeout(() => backupToDrive(true), 30000);
    return () => clearTimeout(timer);
  }, [savedProjects, savedChangeOrders]);

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

  const accessories = get("accessories", 0);
  const addlSub   = overhead+design+shipping+punchlist+incentive+hardware+misc+accessories;
  const subtotal  = cabCust+addlSub;
  const calcTotal = subtotal+installation+salesTax;
  const effPrice  = parseFloat(finalPrice)||calcTotal;
  const coOrigPrice = activeCO?.projectSnap?.effPrice || effPrice;
  const totalCost = cabNet+overhead+design+shipping+installation+punchlist+incentive+salesTax+hardware+misc+accessories;
  const profit    = effPrice-totalCost;
  const corpTax   = profit > 0 ? profit * 0.10 : 0;  // 10% reserve on profit — owner only
  const netProfit = profit - corpTax;
  const margin    = effPrice>0?profit/effPrice:0;
  const floorPrice= totalCost/(1-R.minMargin);
  const avgMult   = rc.length ? rc.reduce((a,r)=>a+(vendorConfig[r.vendor]?.multiplier??1.6),0)/rc.length : 1.6;
  const gutCheck  = cabNet*1.05*avgMult;
  const marginOk  = margin>=R.minMargin;
  const totalLF   = (parseFloat(ov.lfBase)||0)+(parseFloat(ov.lfTall)||0)+(parseFloat(ov.lfWall)||0)+(parseFloat(ov.lfShelf)||0);

  const addRoom    = () => setRooms(p=>[...p,newRoom(Date.now(), proj.vendor)]);
  const clearRooms  = () => setRooms([newRoom(Date.now(), proj.vendor)]);
  // Tab from last override field adds a room
  const onLastFieldTab = (e) => {
    if (e.key==="Tab"&&!e.shiftKey) { e.preventDefault(); addRoom(); }
  };
  const [dragIdx, setDragIdx] = useState(null);
  const onDragStart = (idx) => setDragIdx(idx);
  const onDragOver  = (e, idx) => { e.preventDefault(); };
  const onDrop      = (idx) => {
    if (dragIdx === null || dragIdx === idx) return;
    setRooms(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(null);
  };
  const removeRoom = id => setRooms(p=>p.filter(r=>r.id!==id));
  const updRoom    = (id,f,v) => setRooms(p=>p.map(r=>r.id===id?{...r,[f]:v}:r));

  // saveProject removed — autosave effect handles all persistence

  const isOwner = session?.role === "owner";

  // ── Google Drive backup ───────────────────────────────────
  const GDRIVE_CLIENT_ID  = "1043189518373-dle1b90g7et50alruep7drgtgj4v2h43.apps.googleusercontent.com";
  const GDRIVE_SCOPE      = "https://www.googleapis.com/auth/drive.file";
  const BACKUP_FOLDER_NAME= "PRICING TOOL BACKUPS";

  const [driveStatus,   setDriveStatus]   = useState("idle"); // idle|connecting|saving|saved|error
  const [driveMsg,      setDriveMsg]      = useState("");
  const [driveToken,    setDriveToken]    = useState(() => {
    try { return localStorage.getItem("og_drive_token") || null; } catch { return null; }
  });
  const [driveTokenExp, setDriveTokenExp] = useState(() => {
    try { return parseInt(localStorage.getItem("og_drive_token_exp")||"0"); } catch { return 0; }
  });
  const [showBackup,    setShowBackup]    = useState(false);
  const [lastDriveBackup, setLastDriveBackup] = useState(() => {
    try { return localStorage.getItem("og_last_drive_backup") || null; } catch { return null; }
  });

  const driveTokenValid = driveToken && Date.now() < driveTokenExp - 60000;

  const getGoogleToken = () => new Promise((resolve, reject) => {
    if (driveTokenValid) { resolve(driveToken); return; }
    const width=500, height=600;
    const left=(window.screen.width-width)/2;
    const top=(window.screen.height-height)/2;
    const params = new URLSearchParams({
      client_id:     GDRIVE_CLIENT_ID,
      redirect_uri:  window.location.origin,
      response_type: "token",
      scope:         GDRIVE_SCOPE,
      prompt:        "consent",
    });
    const popup = window.open(
      `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      "google-auth",
      `width=${width},height=${height},left=${left},top=${top}`
    );
    if (!popup) { reject(new Error("Popup blocked — allow popups for this site")); return; }
    const check = setInterval(() => {
      try {
        if (!popup || popup.closed) {
          clearInterval(check);
          reject(new Error("Auth window closed"));
          return;
        }
        const href = popup.location.href;
        if (href.startsWith(window.location.origin) && href.includes("access_token")) {
          clearInterval(check);
          popup.close();
          const hash = new URLSearchParams(href.split("#")[1]||href.split("?")[1]||"");
          const token   = hash.get("access_token");
          const expires = Date.now() + (parseInt(hash.get("expires_in")||"3600")*1000);
          setDriveToken(token);
          setDriveTokenExp(expires);
          try {
            localStorage.setItem("og_drive_token",     token);
            localStorage.setItem("og_drive_token_exp", String(expires));
          } catch {}
          resolve(token);
        }
      } catch (e) {
        // Cross-origin — still loading, keep waiting
      }
    }, 300);
  });

  const findOrCreateFolder = async (token) => {
    // Search for existing folder
    const q = encodeURIComponent(`name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) return data.files[0].id;
    // Create folder
    const create = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" })
    });
    const folder = await create.json();
    return folder.id;
  };

  const uploadToDrive = async (token, folderId, filename, content) => {
    const meta = JSON.stringify({ name: filename, parents: [folderId] });
    const form = new FormData();
    form.append("metadata", new Blob([meta], {type:"application/json"}));
    form.append("file",     new Blob([content], {type:"application/json"}));
    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      { method:"POST", headers:{ Authorization:`Bearer ${token}` }, body:form }
    );
    return res.json();
  };

  const backupToDrive = async (silent=false) => {
    if (!silent) setDriveStatus("connecting");
    try {
      const token = await getGoogleToken();
      if (!silent) setDriveStatus("saving");
      const folderId = await findOrCreateFolder(token);
      const filename = `og-backup-${new Date().toISOString().replace(/[:.]/g,"-").slice(0,19)}.json`;
      const content  = JSON.stringify({
        version:1,
        exportedAt: new Date().toISOString(),
        savedProjects,
        savedChangeOrders,
      }, null, 2);
      await uploadToDrive(token, folderId, filename, content);
      const ts = new Date().toLocaleString();
      setLastDriveBackup(ts);
      try { localStorage.setItem("og_last_drive_backup", ts); } catch {}
      setDriveStatus("saved");
      setDriveMsg(`Saved to Drive · ${ts}`);
      if (!silent) setTimeout(() => { setDriveStatus("idle"); setShowBackup(false); }, 2000);
    } catch(e) {
      setDriveStatus("error");
      setDriveMsg(e.message||"Drive backup failed");
      if (silent) console.warn("Auto-backup failed:", e.message);
    }
  };

  // Local download (fallback)
  const exportData = () => {
    const data = { version:1, exportedAt:new Date().toISOString(), savedProjects, savedChangeOrders };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download=`og-pricing-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.savedProjects)     setSavedProjects(data.savedProjects);
        if (data.savedChangeOrders) setSavedChangeOrders(data.savedChangeOrders);
        alert(`Restored ${(data.savedProjects||[]).length} quotes and ${Object.values(data.savedChangeOrders||{}).flat().length} change orders.`);
      } catch { alert("Could not read backup file."); }
    };
    reader.readAsText(file);
    e.target.value="";
  };

  // ── Close backup dropdown on outside click ────────────────
  useEffect(() => {
    if (!showBackup) return;
    const handler = (e) => {
      if (!e.target.closest("[data-backup-panel]")) setShowBackup(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showBackup]);

  // ── NAV TABS ───────────────────────────────────────────────
  const tabs = [
    { id:"quote",   label:"Quote Builder",   always:true },
    { id:"change",  label:"Change Order",    always:true },
    { id:"quotes",  label:"My Quotes",       always:true },
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
          {view==="quote"&&(
            <button onClick={startNewQuote} style={{
              background:"transparent",border:`1px solid ${C.stone}`,
              color:C.stoneDk,padding:"5px 18px",cursor:"pointer",
              fontSize:8,letterSpacing:"0.22em",textTransform:"uppercase",
              fontFamily:"'Jost',sans-serif",marginRight:8,
            }}>+ New Quote</button>
          )}
          {tabs.filter(t=>t.always||isOwner).map(t=>(
            <button key={t.id} className="navbtn" onClick={()=>setView(t.id)} style={{
              background:view===t.id?C.charcoal:"transparent",
              color:view===t.id?C.parchment:C.stoneDk,
              border:"none",padding:"6px 22px",
              fontSize:8,fontWeight:500,letterSpacing:"0.22em",
              textTransform:"uppercase",cursor:"pointer",
              fontFamily:"'Jost',sans-serif",transition:"all 0.2s",
              position:"relative",
            }}>
              {t.label}
              {t.id==="change"&&activeCO&&(
                <span style={{
                  position:"absolute",top:4,right:4,
                  width:7,height:7,borderRadius:"50%",
                  background:"#EA4335",border:`1.5px solid ${view==="change"?C.charcoal:C.parchment}`,
                  display:"block",
                }}/>
              )}
            </button>
          ))}
          <div style={{width:1,height:20,background:C.stone,margin:"0 8px"}}/>
          <div style={{fontSize:9,color:C.stoneDk,letterSpacing:"0.1em",marginRight:12}}>
            {session.displayName||session.user} {isOwner&&<span style={{color:C.clay}}>· admin</span>}
          </div>
          {isOwner&&(
            <div style={{position:"relative"}} data-backup-panel="1">
              {/* Supabase sync status */}
              {db.supabaseEnabled&&(
                <span style={{
                  fontSize:8,letterSpacing:"0.14em",textTransform:"uppercase",
                  color: syncStatus==="synced"?C.moss
                       : syncStatus==="syncing"?"#4285F4"
                       : syncStatus==="error"?C.rust
                       : C.stoneDk,
                  marginRight:12,
                  fontFamily:"'Jost',sans-serif",
                }}>
                  {syncStatus==="syncing" ? "⟳ Syncing…"
                 : syncStatus==="synced"  ? "✓ Synced"
                 : syncStatus==="error"   ? "⚠ Sync error"
                 : db.supabaseEnabled ? "● Cloud" : ""}
                </span>
              )}
              <button onClick={()=>setShowBackup(v=>!v)} style={{
                background: driveStatus==="saved" ? "#3D4A35"
                          : driveStatus==="error"  ? C.rust
                          : "none",
                border:`1px solid ${driveStatus==="saved"?"#3D4A35":driveStatus==="error"?C.rust:C.stone}`,
                color: driveStatus==="saved"||driveStatus==="error" ? C.parchment : C.stoneDk,
                padding:"5px 14px",cursor:"pointer",
                fontSize:8,letterSpacing:"0.18em",textTransform:"uppercase",
                fontFamily:"'Jost',sans-serif",marginRight:4,
                transition:"all 0.3s",
              }}>
                {driveStatus==="connecting" ? "Connecting…"
                : driveStatus==="saving"    ? "Saving…"
                : driveStatus==="saved"     ? "✓ Backed Up"
                : driveStatus==="error"     ? "⚠ Backup Error"
                : "⬡ Drive"}
              </button>
              {showBackup&&(
                <div style={{
                  position:"absolute",right:0,top:"calc(100% + 8px)",
                  background:C.white,border:`1px solid ${C.stone}`,
                  padding:"20px 22px",zIndex:200,width:260,
                  boxShadow:"0 8px 24px rgba(0,0,0,0.12)",
                }} onClick={e=>e.stopPropagation()}>

                  {/* Google Drive section */}
                  <div style={{fontSize:8,letterSpacing:"0.22em",color:C.stoneDk,
                    textTransform:"uppercase",marginBottom:10}}>
                    Google Drive
                  </div>

                  {driveStatus==="error"&&(
                    <div style={{fontSize:10,color:C.rust,marginBottom:8,
                      padding:"6px 8px",background:"#F5E8E4",
                      border:`1px solid ${C.rust}44`,lineHeight:1.4}}>
                      {driveMsg}
                    </div>
                  )}

                  <button
                    onClick={()=>backupToDrive(false)}
                    disabled={driveStatus==="connecting"||driveStatus==="saving"}
                    style={{
                      width:"100%",
                      background: driveTokenValid ? "#4285F4" : C.charcoal,
                      color:"white",border:"none",
                      padding:"10px 0",cursor:"pointer",
                      fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
                      fontFamily:"'Jost',sans-serif",fontWeight:500,marginBottom:6,
                      opacity: driveStatus==="connecting"||driveStatus==="saving" ? 0.6 : 1,
                      display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                    }}>
                    <span style={{fontSize:14,lineHeight:1}}>▲</span>
                    {driveStatus==="connecting" ? "Connecting to Google…"
                    : driveStatus==="saving"    ? "Saving to Drive…"
                    : driveTokenValid           ? "Save to Drive Now"
                    : "Connect Google & Save"}
                  </button>

                  {lastDriveBackup&&driveStatus!=="error"&&(
                    <div style={{fontSize:9,color:C.moss,letterSpacing:"0.04em",
                      marginBottom:10,textAlign:"center"}}>
                      ✓ Last backup: {lastDriveBackup}
                    </div>
                  )}

                  <div style={{fontSize:9,color:C.stoneDk,marginBottom:14,
                    lineHeight:1.4,letterSpacing:"0.03em"}}>
                    Saves to <strong>"{`PRICING TOOL BACKUPS`}"</strong> folder in Google Drive.
                    Auto-saves 30s after any change once connected.
                  </div>

                  {/* Divider */}
                  <div style={{height:1,background:C.stone,margin:"12px 0"}}/>

                  {/* Local fallback */}
                  <div style={{fontSize:8,letterSpacing:"0.22em",color:C.stoneDk,
                    textTransform:"uppercase",marginBottom:10}}>
                    Local Backup
                  </div>
                  <button onClick={()=>{exportData();setShowBackup(false);}} style={{
                    width:"100%",background:"transparent",color:C.bark,
                    border:`1px solid ${C.stoneMd}`,padding:"8px 0",cursor:"pointer",
                    fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
                    fontFamily:"'Jost',sans-serif",marginBottom:6,
                  }}>↓ Download JSON</button>
                  <label style={{
                    display:"block",width:"100%",background:"transparent",
                    border:`1px solid ${C.stone}`,padding:"8px 0",cursor:"pointer",
                    fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
                    fontFamily:"'Jost',sans-serif",color:C.stoneDk,
                    textAlign:"center",boxSizing:"border-box",
                  }}>
                    ↑ Import JSON
                    <input type="file" accept=".json" onChange={(e)=>{importData(e);setShowBackup(false);}}
                      style={{display:"none"}}/>
                  </label>
                </div>
              )}
            </div>
          )}
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
              stateConfig={stateConfig}
              onStatesChange={setStateConfig}
              userPerms={userPerms}
              onUserPermsChange={setUserPerms}
            />
          </div>
        )}

        {/* ── MY QUOTES VIEW ──────────────────────────────── */}
        {view==="quotes"&&(
          <MyQuotesView
            savedProjects={savedProjects}
            savedChangeOrders={savedChangeOrders}
            session={session}
            startNewCO={startNewCO}
            setView={setView}
            setProj={setProj}
            setRooms={setRooms}
            setOv={setOv}
            setFinalPrice={setFinalPrice}
            setQuoteNumEdited={setQuoteNumEdited}
            vendorConfig={vendorConfig}
          />
        )}

        {/* ── OWNER VIEW ────────────────────────────────── */}
        {view==="owner"&&isOwner&&(
          <OwnerView
            proj={proj} cabNet={cabNet} cabCust={cabCust}
            overhead={overhead} design={design} shipping={shipping}
            installation={installation} punchlist={punchlist}
            incentive={incentive} salesTax={salesTax}
            hardware={hardware} misc={misc} accessories={accessories}
            totalCost={totalCost} effPrice={effPrice}
            profit={profit} margin={margin} floorPrice={floorPrice}
            corpTax={corpTax} netProfit={netProfit}
            gutCheck={gutCheck} marginOk={marginOk}
            rooms={rooms} rc={rc}
            ov={ov} totalLF={totalLF}
            savedProjects={savedProjects} setSavedProjects={setSavedProjects}
            savedChangeOrders={savedChangeOrders} startNewCO={startNewCO}
            toggleProjectApproval={toggleProjectApproval}
            stateConfig={stateConfig}
            loadQuote={p=>{setProj({...p.proj});setRooms([...p.rooms]);setOv({...p.ov});setFinalPrice(p.finalPrice||"");setQuoteNumEdited(true);setView("quote");}}
            onDeleteProject={id=>{setSavedProjects(prev=>prev.filter(p=>p.id!==id));db.deleteProject(id).catch(()=>{});}}
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
                    onChange={e=>{setProj(p=>({...p,quoteNum:e.target.value}));setQuoteNumEdited(true);}}
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
                    {Object.entries(stateConfig).filter(([code])=>!session?.allowedStates||session.allowedStates.includes(code)).map(([code,info])=>(
                      <option key={code} value={code}>{code} — {info.label.split("(")[1]?.replace(")","")}</option>
                    ))}
                  </select>
                  <div style={{marginTop:5,fontSize:10,color:C.stoneDk,letterSpacing:"0.08em"}}>
                    {stateConfig[proj.state]?.label}
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
                  {proj.status==="Lost"&&(
                    <input value={proj.lostReason||""} onChange={e=>setProj(p=>({...p,lostReason:e.target.value}))}
                      placeholder="Reason lost: price, timing, competitor…"
                      className="ri ph"
                      style={{...iSt,marginTop:6,fontSize:11,
                        borderColor:C.rust+"66",background:"#F2ECEA"}}/>
                  )}
                </div>
                <F label="Notes" value={proj.notes} onChange={v=>setProj(p=>({...p,notes:v}))} placeholder="Optional"/>
              </div>

              {/* Follow-up date row */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:24,marginTop:16}}>
                <div>
                  <FL>Follow-Up Date <span style={{fontWeight:300,color:C.stoneDk}}>— reminder to check in</span></FL>
                  <input type="date" value={proj.followUpDate||""} onChange={e=>setProj(p=>({...p,followUpDate:e.target.value}))}
                    className="ri" style={{...iSt,
                      borderColor: proj.followUpDate && new Date(proj.followUpDate) < new Date() ? C.rust+"88" : C.stone,
                      background:  proj.followUpDate && new Date(proj.followUpDate) < new Date() ? "#F5EEEC" : C.parchment,
                    }}/>
                  {proj.followUpDate && new Date(proj.followUpDate) < new Date() && (
                    <div style={{fontSize:9,color:C.rust,marginTop:4,letterSpacing:"0.06em"}}>
                      ⚠ Follow-up overdue
                    </div>
                  )}
                </div>
                <div style={{display:"flex",alignItems:"flex-end",gap:8,paddingBottom:2}}>
                  <button onClick={()=>setShowTemplates(true)} style={{
                    background:"transparent",border:`1px solid ${C.stoneMd}`,
                    color:C.bark,padding:"8px 18px",cursor:"pointer",
                    fontSize:8,letterSpacing:"0.18em",textTransform:"uppercase",
                    fontFamily:"'Jost',sans-serif",
                    display:"flex",alignItems:"center",gap:6,
                  }}>
                    <span style={{fontSize:12}}>⊞</span> Load Template
                    {templates.length>0&&<span style={{fontSize:9,color:C.clay}}>({templates.length})</span>}
                  </button>
                  {proj.name&&(
                    <button onClick={()=>{
                      const name = window.prompt("Template name:", proj.name||"My Template");
                      if (name) saveAsTemplate(name);
                    }} style={{
                      background:"transparent",border:`1px solid ${C.stone}`,
                      color:C.stoneDk,padding:"8px 16px",cursor:"pointer",
                      fontSize:8,letterSpacing:"0.18em",textTransform:"uppercase",
                      fontFamily:"'Jost',sans-serif",
                    }}>Save as Template</button>
                  )}
                </div>
              </div>

              {/* File link + Milestones row */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginTop:20}}>
                <div>
                  <FL>File / Drive Link <span style={{fontWeight:300,color:C.stoneDk}}>— vendor quote, floor plan, etc.</span></FL>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <input value={proj.fileLink||""} onChange={e=>setProj(p=>({...p,fileLink:e.target.value}))}
                      placeholder="https://drive.google.com/…" className="ri ph"
                      style={{...iSt,flex:1,fontSize:11}}/>
                    {proj.fileLink&&(
                      <a href={proj.fileLink} target="_blank" rel="noreferrer" style={{
                        background:C.charcoal,color:C.parchment,
                        padding:"8px 14px",fontSize:8,letterSpacing:"0.16em",
                        textTransform:"uppercase",fontFamily:"'Jost',sans-serif",
                        textDecoration:"none",whiteSpace:"nowrap",
                      }}>Open ↗</a>
                    )}
                  </div>
                </div>
                <div>
                  <FL>Project Milestones</FL>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {[
                      ["quoteSent",    "Quote Sent"],
                      ["depositRcvd",  "Deposit Rcvd"],
                      ["cabsOrdered",  "Cabs Ordered"],
                      ["installSched", "Install Sched"],
                      ["punchlist",    "Punchlist"],
                      ["complete",     "Complete"],
                    ].map(([key,lbl])=>{
                      const done = proj.milestones?.[key];
                      return(
                        <button key={key} onClick={()=>setProj(p=>({
                          ...p,
                          milestones:{...p.milestones,[key]:!done}
                        }))} style={{
                          fontSize:8,letterSpacing:"0.1em",textTransform:"uppercase",
                          fontFamily:"'Jost',sans-serif",cursor:"pointer",
                          padding:"4px 10px",
                          background: done?"#3D4A35":C.white,
                          color: done?C.parchment:C.stoneDk,
                          border:`1px solid ${done?"#3D4A35":C.stone}`,
                          transition:"all 0.15s",
                        }}>
                          {done?"✓ ":""}{lbl}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{marginTop:6,fontSize:9,color:C.stoneDk,letterSpacing:"0.04em"}}>
                    {Object.values(proj.milestones||{}).filter(Boolean).length}/6 steps complete
                  </div>
                </div>
              </div>

              {/* Duplicate button */}
              {proj.name&&(
                <div style={{marginTop:16,display:"flex",alignItems:"center",gap:12}}>
                  <button onClick={duplicateProject} style={{
                    background:"transparent",border:`1px solid ${C.stoneMd}`,
                    color:C.stoneDk,padding:"6px 16px",cursor:"pointer",
                    fontSize:8,letterSpacing:"0.18em",textTransform:"uppercase",
                    fontFamily:"'Jost',sans-serif",
                    display:"flex",alignItems:"center",gap:6,
                  }}>
                    <span style={{fontSize:12}}>⧉</span> Duplicate This Quote
                  </button>
                  <div style={{fontSize:9,color:C.stoneDk,letterSpacing:"0.04em"}}>
                    Copies all rooms &amp; pricing into a new draft
                  </div>
                </div>
              )}
            </div>

            <HR/>

            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"baseline",marginBottom:28}}>
              <SecHead n="02" title="Room Pricing" inline/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={clearRooms} style={{
                  background:"transparent",border:`1px solid ${C.stone}`,
                  color:C.stoneDk,padding:"7px 16px",
                  fontSize:8,letterSpacing:"0.22em",textTransform:"uppercase",
                  cursor:"pointer",fontFamily:"'Jost',sans-serif",
                }}>Clear All</button>
                <button onClick={addRoom} className="addbtn" style={{
                  background:"transparent",border:`1px solid ${C.stoneMd}`,
                  color:C.bark,padding:"7px 20px",
                  fontSize:8,letterSpacing:"0.22em",textTransform:"uppercase",
                  cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:500,
                  transition:"all 0.2s",
                }}>+ Add Room</button>
              </div>
            </div>

            <div style={{
              display:"grid",gridTemplateColumns:"18px 1.6fr 1.1fr 1fr 1fr 0.9fr 1.2fr 1.2fr 24px",
              gap:14,paddingBottom:10,
              borderBottom:`1px solid ${C.stone}`,marginBottom:2,
            }}>
              {["","Room / Area","Vendor","List Price","Net Price","Upcharge","Calc. Price","Override",""].map((h,i)=>(
                <div key={i} style={{fontSize:8,letterSpacing:"0.2em",color:C.stoneDk,
                  textTransform:"uppercase",textAlign:i>2&&i<8?"right":"left"}}>{h}</div>
              ))}
            </div>

            {rooms.map((room,idx)=>{
              const c=rc[idx];
              const pct=cabCust>0?c.price/cabCust:0;
              const isCustom = room.vendor==="Custom Fabrication";
              return(
                <div key={room.id} className={`rr${dragIdx===idx?" drag-over":""}`}
                  draggable
                  onDragStart={()=>onDragStart(idx)}
                  onDragOver={e=>onDragOver(e,idx)}
                  onDrop={()=>onDrop(idx)}
                  onDragEnd={()=>setDragIdx(null)}
                  style={{
                    borderBottom:`1px solid ${C.parchmentDk}`,
                    background: c.overridden?"#F5F2E8":"transparent",
                    paddingBottom:4,
                  }}>
                  {/* Main row */}
                  <div style={{
                    display:"grid",gridTemplateColumns:"18px 1.6fr 1.1fr 1fr 1fr 0.9fr 1.2fr 1.2fr 24px",
                    gap:14,padding:"6px 0 4px",alignItems:"start",
                  }}>
                    {/* Drag handle */}
                    <div className="drag-handle" style={{
                      alignSelf:"center",fontSize:14,color:C.stoneMd,
                      lineHeight:1,textAlign:"center",paddingTop:2,
                    }}>⠿</div>
                    <div style={{alignSelf:"center"}}>
                      <input list={`r-${room.id}`} value={room.name}
                        onChange={e=>updRoom(room.id,"name",e.target.value)}
                        placeholder={`Room ${idx+1}`} className="ri ph" style={iSt}/>
                      <datalist id={`r-${room.id}`}>
                        {ROOM_SUGGESTIONS.map(s=><option key={s} value={s}/>)}
                      </datalist>
                    </div>
                    <div style={{alignSelf:"start",paddingTop:0}}>
                      <select value={room.vendor||"Bellmont"}
                        onChange={e=>updRoom(room.id,"vendor",e.target.value)}
                        className="rs"
                        style={{...sSt,fontSize:11,width:"100%",
                          color: isCustom?C.clay:C.bark,
                          background: isCustom?"#F2EAD8":C.parchment,
                          borderColor: isCustom?C.clay:C.stone,
                        }}>
                        {Object.keys(vendorConfig).map(v=><option key={v}>{v}</option>)}
                      </select>
                      {isCustom&&(
                        <div style={{fontSize:8,color:C.clay,marginTop:2,letterSpacing:"0.06em",lineHeight:1.3}}>
                          ⚠ Review multiplier
                        </div>
                      )}
                      <div style={{fontSize:8,color:C.stoneDk,marginTop:2,letterSpacing:"0.04em",lineHeight:1.3}}>
                        ×{(vendorConfig[room.vendor||"Bellmont"]?.multiplier??1.6).toFixed(2)}
                        {(room.vendor||"Bellmont")==="Bellmont"&&" · ×0.48"}
                      </div>
                    </div>
                    <input type="number" value={room.list} placeholder="—"
                      onChange={e=>updRoom(room.id,"list",e.target.value)}
                      className="ri ph" style={{...iSt,textAlign:"right",alignSelf:"center"}}/>
                    <div style={{...iSt,background:C.parchmentDk,color:C.clay,
                      textAlign:"right",display:"flex",alignItems:"center",
                      justifyContent:"flex-end",fontVariantNumeric:"tabular-nums",
                      alignSelf:"center"}}>
                      {c.net>0?fmt(c.net):"—"}
                    </div>
                    <input type="number" value={room.upcharge} placeholder="—"
                      onChange={e=>updRoom(room.id,"upcharge",e.target.value)}
                      className="ri ph" style={{...iSt,textAlign:"right",alignSelf:"center"}}/>
                    <div style={{textAlign:"right",fontSize:13,
                      fontWeight:c.price>0?500:300,
                      color:c.overridden?C.clay:c.price>0?C.charcoal:C.stoneMd,
                      fontVariantNumeric:"tabular-nums",
                      fontFamily:"'Cormorant Garamond',serif",
                      alignSelf:"center"}}>
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
                      onKeyDown={idx===rooms.length-1 ? onLastFieldTab : undefined}
                      className="ri ph" style={{
                        ...iSt,textAlign:"right",fontSize:12,
                        alignSelf:"center",
                        borderColor: room.priceOverride?C.clay:C.stone,
                        background: room.priceOverride?"#F5F2E8":C.parchment,
                      }}/>
                    <button className="xbtn" onClick={()=>removeRoom(room.id)} style={{
                      background:"none",border:"none",color:C.stoneMd,
                      fontSize:15,cursor:"pointer",opacity:0,
                      transition:"opacity 0.15s",padding:"0 2px",lineHeight:1,
                      alignSelf:"center",
                    }}>×</button>
                  </div>
                  {/* Comments + Accessories sub-row */}
                  <div style={{
                    display:"grid",gridTemplateColumns:"1fr 1fr",
                    gap:10,paddingBottom:6,paddingLeft:0,
                  }}>
                    <div>
                      <input
                        value={room.accessories||""}
                        onChange={e=>updRoom(room.id,"accessories",e.target.value)}
                        placeholder="Accessories / misc for this room…"
                        className="ri ph"
                        style={{...iSt,fontSize:11,background:"#F5F2E8",
                          borderColor:room.accessories?C.clay:C.stone,
                          color:C.bark}}/>
                      {room.accessories&&(
                        <div style={{fontSize:8,color:C.clay,marginTop:2,letterSpacing:"0.06em"}}>
                          Accessories
                        </div>
                      )}
                    </div>
                    <div>
                      <input
                        value={room.comments||""}
                        onChange={e=>updRoom(room.id,"comments",e.target.value)}
                        placeholder="Comments / notes for this room…"
                        className="ri ph"
                        style={{...iSt,fontSize:11,
                          borderColor:room.comments?C.stoneMd:C.stone,
                          color:C.stoneDk}}/>
                      {room.comments&&(
                        <div style={{fontSize:8,color:C.stoneDk,marginTop:2,letterSpacing:"0.06em"}}>
                          Note
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div style={{
              display:"grid",gridTemplateColumns:"18px 1.6fr 1.1fr 1fr 1fr 0.9fr 1.2fr 1.2fr 24px",
              gap:14,paddingTop:14,marginTop:6,
              borderTop:`2px solid ${C.charcoal}`,
            }}>
              <div/>
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
                ["punchlist",   "Punchlist Reserve",   fmt(cabNet *R.punchlist),   "4% of net cost",              true],
                ["incentive",   "Employee Incentive",  fmt(cabNet *R.incentive),   `${(R.incentive*100).toFixed(0)}% of net cost`, stateConfig[proj.state]?.showIncentive!==false],
                ["salesTax",    "Sales Tax",           fmt(cabNet *R.salesTax),    stateConfig[proj.state]?.label ?? "of net cost", true],
                ["hardware",    "Cabinet Hardware",    "Manual entry",              "",                           true],
                ["accessories", "Accessories / Misc",  "Manual entry",              "",                           true],
                ["misc",        "Other Misc",          "Manual entry",              "",                           true],
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

            {/* ── Subtotal bar (before installation) ── */}
            <div style={{
              display:"grid",gridTemplateColumns:"repeat(4,1fr)",
              borderTop:`2px solid ${C.charcoal}`,marginBottom:0,
            }}>
              {[
                ["Cabinetry",  fmt(cabCust)],
                ["Additional", fmt(addlSub)],
                ["Sales Tax",  fmt(salesTax)],
                ["Subtotal",   fmt(subtotal)],
              ].map(([lbl,val])=>(
                <div key={lbl} style={{
                  padding:"22px 0 22px 20px",
                  borderRight:`1px solid ${C.stone}`,
                }}>
                  <div style={{fontSize:8,letterSpacing:"0.2em",
                    color:C.stoneDk,textTransform:"uppercase",marginBottom:8}}>{lbl}</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",
                    fontSize:22,fontWeight:300,color:C.bark,
                    fontVariantNumeric:"tabular-nums",lineHeight:1}}>{val}</div>
                </div>
              ))}
            </div>

            {/* ── Installation section ── */}
            <div style={{
              border:`1px solid ${C.stone}`,borderTop:"none",
              background:C.white,padding:"24px 28px",marginBottom:0,
            }}>
              <div style={{display:"flex",justifyContent:"space-between",
                alignItems:"flex-start",gap:32,flexWrap:"wrap"}}>

                {/* Left: LF inputs */}
                <div style={{flex:1,minWidth:380}}>
                  <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
                    textTransform:"uppercase",marginBottom:14}}>
                    Installation — Linear Footage by Category
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                    {[
                      ["lfBase",  "Base Cabinets"],
                      ["lfTall",  "Tall Cabinets"],
                      ["lfWall",  "Wall Cabinets"],
                      ["lfShelf", "Floating Shelves"],
                    ].map(([key,lbl])=>(
                      <div key={key}>
                        <div style={{fontSize:8,letterSpacing:"0.14em",color:C.stoneDk,
                          textTransform:"uppercase",marginBottom:6}}>{lbl}</div>
                        <div style={{position:"relative"}}>
                          <input type="number" value={ov[key]}
                            onChange={e=>setOv(o=>({...o,[key]:e.target.value}))}
                            placeholder="0"
                            className="ri ph"
                            style={{...iSt,paddingRight:28,textAlign:"right"}}/>
                          <span style={{position:"absolute",right:10,top:"50%",
                            transform:"translateY(-50%)",fontSize:9,
                            color:C.stoneDk,pointerEvents:"none"}}>LF</span>
                        </div>
                        <div style={{fontSize:9,color:C.stoneDk,marginTop:4,
                          letterSpacing:"0.04em"}}>
                          {parseFloat(ov[key])>0 && installation>0
                            ? `$${Math.round(installation / totalLF)}/LF`
                            : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:10,fontSize:9,color:C.stoneDk,letterSpacing:"0.04em"}}>
                    Total: <strong>{totalLF} LF</strong>
                    {totalLF>0&&installation>0&&(
                      <span style={{marginLeft:10,color:C.clay}}>
                        · {fmt(installation)} ÷ {totalLF} LF = ${Math.round(installation/totalLF)}/LF blended
                      </span>
                    )}
                    {totalLF===0&&cabCust>0&&(
                      <span style={{marginLeft:10,color:C.rust,fontSize:9,letterSpacing:"0.06em"}}>
                        ⚠ Enter LF above to enable $/LF trend tracking
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: auto calc + override */}
                <div style={{minWidth:220}}>
                  <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
                    textTransform:"uppercase",marginBottom:14}}>
                    Installation Amount
                  </div>
                  <div style={{fontSize:9,color:C.stoneDk,marginBottom:6,letterSpacing:"0.04em"}}>
                    Auto: {fmt(cabCust*R.installation)} ({(stateConfig[proj.state]?.install*100||15).toFixed(0)}% of cabinetry)
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <div style={{flex:1,fontSize:18,color:C.clay,fontWeight:300,
                      fontVariantNumeric:"tabular-nums",padding:"8px 0",
                      borderBottom:`1px solid ${C.stone}`,
                      fontFamily:"'Cormorant Garamond',serif"}}>
                      {fmt(installation)}
                    </div>
                    <input type="number" placeholder="Override"
                      value={ov.installation}
                      onChange={e=>setOv(o=>({...o,installation:e.target.value}))}
                      className="ri ph"
                      style={{...iSt,width:110,fontSize:12,padding:"8px 10px",
                        color:ov.installation?C.charcoal:C.stoneMd,
                        borderColor:ov.installation?C.clay:C.stone}}/>
                  </div>
                  {ov.installation&&(
                    <div style={{fontSize:9,color:C.clay,marginTop:4,letterSpacing:"0.1em",
                      textTransform:"uppercase"}}>Overridden</div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Total bar (after installation) ── */}
            <div style={{
              display:"grid",gridTemplateColumns:"1fr auto",
              borderTop:`2px solid ${C.charcoal}`,marginBottom:0,
            }}>
              <div style={{padding:"22px 20px",borderRight:`1px solid ${C.stone}`}}>
                <div style={{fontSize:8,letterSpacing:"0.2em",color:C.stoneDk,
                  textTransform:"uppercase",marginBottom:8}}>Installation</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",
                  fontSize:22,fontWeight:300,color:C.bark,
                  fontVariantNumeric:"tabular-nums",lineHeight:1}}>{fmt(installation)}</div>
              </div>
              <div style={{padding:"28px 36px 28px 24px",background:C.charcoal,minWidth:200}}>
                <div style={{fontSize:8,letterSpacing:"0.2em",color:C.stoneMd,
                  textTransform:"uppercase",marginBottom:8}}>Total</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",
                  fontSize:32,fontWeight:300,color:C.parchment,
                  fontVariantNumeric:"tabular-nums",lineHeight:1}}>{fmt(calcTotal)}</div>
              </div>
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
                {proj.name&&<QuoteApproveBtn
                  savedProjects={savedProjects}
                  projId={proj.stableId||proj.quoteNum||proj.name.toLowerCase().replace(/[^a-z0-9]/gi,"-").toLowerCase()||"draft"}
                  toggleProjectApproval={toggleProjectApproval}
                />}
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
                {proj.name&&savedProjects.find(p=>p.id===(proj.stableId||proj.quoteNum||proj.name.toLowerCase().replace(/\s+/g,"-")))?.revisions?.length > 1&&(
                  <button onClick={()=>setShowHistory(true)} style={{
                    background:"transparent",border:`1px solid ${C.stone}`,
                    color:C.stoneDk,padding:"7px 16px",
                    fontSize:8,letterSpacing:"0.22em",textTransform:"uppercase",
                    cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:500,
                    display:"flex",alignItems:"center",gap:6,
                  }}>
                    ⟳ History
                    <span style={{fontSize:9,color:C.clay,fontWeight:400}}>
                      {savedProjects.find(p=>p.id===(proj.stableId||proj.quoteNum||proj.name.toLowerCase().replace(/\s+/g,"-")))?.revisions?.length}
                    </span>
                  </button>
                )}
                {proj.name&&(
                  <button onClick={()=>setShowGmailModal(true)} style={{
                    background:"#EA4335",color:"#fff",border:"none",
                    padding:"7px 18px",
                    fontSize:8,letterSpacing:"0.18em",textTransform:"uppercase",
                    cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:500,
                    display:"flex",alignItems:"center",gap:6,
                  }}>
                    <span style={{fontSize:12,lineHeight:1}}>✉</span> Send via Gmail
                  </button>
                )}
                {proj.name&&(
                  <button onClick={()=>setMondayModal({
                    type:"quote",
                    data:{
                      name:        proj.name,
                      quoteNum:    proj.quoteNum||"—",
                      amount:      fmt(effPrice),
                      status:      proj.status,
                      state:       proj.state,
                      pm:          session?.displayName||session?.user||"",
                      notes:       proj.notes||"",
                      approvedAt:  savedProjects.find(p=>p.id===(proj.stableId||proj.quoteNum||proj.name.toLowerCase().replace(/\s+/g,"-")))?.quoteApprovedAt||"",
                    }
                  })} style={{
                    background:"#0073EA",color:"#fff",border:"none",
                    padding:"7px 18px",
                    fontSize:8,letterSpacing:"0.18em",textTransform:"uppercase",
                    cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:500,
                    display:"flex",alignItems:"center",gap:6,
                  }}>
                    <span style={{fontSize:14,lineHeight:1}}>▦</span> Send to Monday
                  </button>
                )}
              </div>
            </div>

            </div>{/* end hide-when-client-pdf wrapper */}

            {/* ── POST-JOB / ACTUALS SECTION (Complete or Lost) ── */}
            {(proj.status==="Complete"||proj.status==="Lost")&&(
              <div className="no-print" style={{marginTop:0}}>
                <HR/>
                <SecHead n="05" title={proj.status==="Lost"?"Lost Job Analysis":"Post-Job Review"}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:32,marginBottom:32}}>

                  {/* Left: post-job notes + difficulty */}
                  <div>
                    <div style={{
                      padding:"20px 24px",
                      background: proj.status==="Lost"?"#F2ECEA":C.white,
                      border:`1px solid ${proj.status==="Lost"?C.rust+"44":C.stone}`,
                      marginBottom:16,
                    }}>
                      <FL>{proj.status==="Lost"?"Why Did We Lose This?":"Post-Job Notes"}</FL>
                      <textarea
                        value={proj.status==="Lost"?(proj.lostReason||""):(proj.postJobNotes||"")}
                        onChange={e=>setProj(p=>proj.status==="Lost"
                          ? {...p,lostReason:e.target.value}
                          : {...p,postJobNotes:e.target.value}
                        )}
                        placeholder={proj.status==="Lost"
                          ? "Price too high? Timing? Competitor? What would you do differently?"
                          : "How did the job go? Was the quote accurate? What would you price differently next time?"
                        }
                        className="ri ph"
                        style={{...iSt,width:"100%",minHeight:90,resize:"vertical",
                          lineHeight:1.6,fontSize:11,padding:"10px 12px"}}
                      />
                    </div>
                    <div>
                      <FL>Difficulty Rating</FL>
                      <div style={{display:"flex",gap:6}}>
                        {[1,2,3,4,5].map(n=>{
                          const active = parseInt(proj.difficultyRating)>=n;
                          return(
                            <button key={n} onClick={()=>setProj(p=>({...p,
                              difficultyRating: p.difficultyRating==String(n)?"":String(n)
                            }))} style={{
                              width:36,height:36,fontSize:16,
                              background: active?"#F5F2E8":"transparent",
                              border:`1px solid ${active?C.clay:C.stone}`,
                              cursor:"pointer",color:active?C.clay:C.stoneMd,
                            }}>★</button>
                          );
                        })}
                        {proj.difficultyRating&&(
                          <div style={{fontSize:10,color:C.stoneDk,alignSelf:"center",
                            marginLeft:8,letterSpacing:"0.06em"}}>
                            {["","Easy","Moderate","Challenging","Difficult","Very Difficult"][parseInt(proj.difficultyRating)]}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: actuals vs quoted */}
                  {proj.status==="Complete"&&(
                    <div style={{padding:"20px 24px",background:C.white,border:`1px solid ${C.stone}`}}>
                      <FL>Actuals vs Quoted</FL>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",
                        gap:8,marginBottom:16,fontSize:8,letterSpacing:"0.12em",
                        color:C.stoneDk,textTransform:"uppercase"}}>
                        {["","Quoted","Actual"].map((h,i)=>(
                          <div key={i} style={{textAlign:i>0?"right":"left"}}>{h}</div>
                        ))}
                      </div>
                      {[
                        ["Cabinet Cost",   fmt(cabNet),    "cabActual",    ""],
                        ["Installation",   fmt(installation), "installActual",""],
                        ["Total Price",    fmt(effPrice),  "priceActual",  ""],
                      ].map(([lbl,quoted,key])=>{
                        const actual = parseFloat(proj.actuals?.[key]);
                        const diff   = !isNaN(actual)&&actual>0 ? actual - (parseFloat(quoted.replace(/[$,]/g,""))||0) : null;
                        return(
                          <div key={key} style={{display:"grid",
                            gridTemplateColumns:"1fr 1fr 1fr",
                            gap:8,marginBottom:8,alignItems:"center"}}>
                            <div style={{fontSize:11,color:C.bark}}>{lbl}</div>
                            <div style={{textAlign:"right",fontSize:12,color:C.stoneDk,
                              fontFamily:"'Cormorant Garamond',serif",
                              fontVariantNumeric:"tabular-nums"}}>{quoted}</div>
                            <div style={{display:"flex",gap:6,alignItems:"center",justifyContent:"flex-end"}}>
                              <input type="number"
                                value={proj.actuals?.[key]||""}
                                onChange={e=>setProj(p=>({...p,
                                  actuals:{...p.actuals,[key]:e.target.value}
                                }))}
                                placeholder="—" className="ri ph"
                                style={{...iSt,width:90,textAlign:"right",fontSize:11,
                                  padding:"4px 8px",
                                  borderColor: diff!==null&&diff>0?C.rust:diff!==null&&diff<0?C.moss:C.stone,
                                }}/>
                              {diff!==null&&(
                                <div style={{fontSize:9,minWidth:50,textAlign:"right",
                                  color:diff>0?C.rust:C.moss,letterSpacing:"0.04em",
                                  fontVariantNumeric:"tabular-nums"}}>
                                  {diff>0?"+":""}{fmt(diff)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div style={{marginTop:12}}>
                        <FL>Actuals Notes</FL>
                        <input value={proj.actuals?.notes||""}
                          onChange={e=>setProj(p=>({...p,
                            actuals:{...p.actuals,notes:e.target.value}
                          }))}
                          placeholder="Install ran long, unexpected blocking, etc."
                          className="ri ph"
                          style={{...iSt,fontSize:11,width:"100%"}}/>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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
                {stateConfig[proj.state]?.label}
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

            {/* ── No active CO — prompt to select a project ── */}
            {!activeCO&&(
              <div>
                <SecHead n="CO" title="Change Order"/>

                {/* Quote number lookup */}
                <div style={{
                  padding:"24px 28px",background:C.white,
                  border:`1px solid ${C.stone}`,marginTop:28,marginBottom:20,
                }}>
                  <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
                    textTransform:"uppercase",marginBottom:12}}>
                    Look Up a Past Quote
                  </div>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <input
                      value={coQuoteSearch}
                      onChange={e=>{setCoQuoteSearch(e.target.value);setCoSearchResult(null);}}
                      onKeyDown={e=>e.key==="Enter"&&searchAndLoadQuote()}
                      placeholder="Enter quote number or client name…"
                      className="ri ph"
                      style={{...iSt,flex:1,fontSize:13}}
                    />
                    <button onClick={searchAndLoadQuote} style={{
                      background:C.charcoal,color:C.parchment,border:"none",
                      padding:"10px 24px",cursor:"pointer",
                      fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
                      fontFamily:"'Jost',sans-serif",fontWeight:500,whiteSpace:"nowrap",
                    }}>Find Quote</button>
                  </div>
                  {coSearchResult==="not-found"&&(
                    <div style={{marginTop:10,fontSize:11,color:C.rust,letterSpacing:"0.04em"}}>
                      No saved quote found matching "{coQuoteSearch}" — make sure the quote has been saved first.
                    </div>
                  )}
                  {savedProjects.length>0&&(
                    <div style={{marginTop:16}}>
                      <div style={{fontSize:9,color:C.stoneDk,letterSpacing:"0.08em",marginBottom:8}}>
                        Or select from saved quotes:
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {savedProjects.map(p=>(
                          <button key={p.id} onClick={()=>startNewCO(p)} style={{
                            background:C.parchmentDk,border:`1px solid ${C.stone}`,
                            color:C.bark,padding:"5px 12px",cursor:"pointer",
                            fontSize:10,fontFamily:"'Jost',sans-serif",
                            display:"flex",alignItems:"center",gap:6,
                          }}>
                            <span style={{color:C.charcoal,fontWeight:500}}>{p.proj.name}</span>
                            <span style={{color:C.stoneDk,fontSize:9}}>{p.proj.quoteNum||"no #"}</span>
                            {(savedChangeOrders[p.id]||[]).length>0&&(
                              <span style={{fontSize:8,color:C.clay,background:"#F2EAD8",
                                padding:"1px 5px"}}>
                                {(savedChangeOrders[p.id]||[]).length} CO
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {proj.name&&(
                  <div style={{padding:"20px 24px",background:C.white,
                    border:`1px solid ${C.stone}`,marginBottom:8}}>
                    <div style={{fontSize:9,color:C.stoneDk,letterSpacing:"0.08em",marginBottom:10}}>
                      Current quote in builder:
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <span style={{fontSize:13,color:C.charcoal}}>{proj.name}</span>
                        <span style={{fontSize:10,color:C.stoneDk,marginLeft:10}}>{proj.quoteNum||"—"}</span>
                      </div>
                      <button onClick={()=>startNewCO({
                        id: proj.stableId||proj.quoteNum||proj.name.toLowerCase().replace(/\s+/g,"-")||"draft",
                        proj:{...proj}, rooms:[...rooms], ov:{...ov}, finalPrice,
                        effPrice, savedAt: new Date().toLocaleDateString(),
                      })} style={{
                        background:C.charcoal,color:C.parchment,border:"none",
                        padding:"8px 22px",cursor:"pointer",
                        fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
                        fontFamily:"'Jost',sans-serif",fontWeight:500,
                      }}>Issue CO</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Active CO form ── */}
            {activeCO&&(
              <div>

                {/* Header bar */}
                <div style={{display:"flex",justifyContent:"space-between",
                  alignItems:"baseline",marginBottom:32}} className="no-print">
                  <SecHead n="CO" title="Change Order" inline/>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>{ saveCO(); }} style={{
                      background:C.moss,color:C.parchment,border:"none",
                      padding:"7px 20px",cursor:"pointer",
                      fontSize:8,letterSpacing:"0.22em",textTransform:"uppercase",
                      fontFamily:"'Jost',sans-serif",fontWeight:500,
                    }}>Save CO</button>
                    <button onClick={()=>triggerPrint("co")} style={{
                      background:C.charcoal,color:C.parchment,border:"none",
                      padding:"7px 20px",cursor:"pointer",
                      fontSize:8,letterSpacing:"0.22em",textTransform:"uppercase",
                      fontFamily:"'Jost',sans-serif",fontWeight:500,
                    }}>⎙ Export PDF</button>
                    <button onClick={()=>{
                      const coNum = activeCO.projectSnap?.proj?.quoteNum
                        ? `${activeCO.projectSnap.proj.quoteNum}_CO${activeCO.coNum}`
                        : `CO${activeCO.coNum}`;
                      setMondayModal({
                        type:"co",
                        data:{
                          name:       activeCO.projectSnap?.proj?.name||"Unknown",
                          coNum,
                          amount:     fmt(coApproved||coPending),
                          status:     coApproved>0?"Approved":"Pending",
                          state:      activeCO.projectSnap?.proj?.state||"",
                          pm:         session?.displayName||session?.user||"",
                          notes:      activeCO.notes||"",
                          approvedAt: (savedChangeOrders[activeCO.projectId]||[])
                                        .find(c=>c.coId===activeCO.coId)?.coApprovedAt||"",
                        }
                      });
                    }} style={{
                      background:"#0073EA",color:"#fff",border:"none",
                      padding:"7px 18px",cursor:"pointer",
                      fontSize:8,letterSpacing:"0.18em",textTransform:"uppercase",
                      fontFamily:"'Jost',sans-serif",fontWeight:500,
                      display:"flex",alignItems:"center",gap:6,
                    }}>
                      <span style={{fontSize:14,lineHeight:1}}>▦</span> Send to Monday
                    </button>
                    <button onClick={()=>setActiveCO(null)} style={{
                      background:"transparent",border:`1px solid ${C.stoneMd}`,
                      color:C.bark,padding:"7px 18px",cursor:"pointer",
                      fontSize:8,letterSpacing:"0.22em",textTransform:"uppercase",
                      fontFamily:"'Jost',sans-serif",
                    }}>Close</button>
                  </div>
                </div>

                {/* Project info strip */}
                <div style={{
                  display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",
                  gap:24,marginBottom:32,
                  padding:"20px 24px",
                  background:C.white,border:`1px solid ${C.stone}`,
                }}>
                  <div>
                    <FL>Project / Client</FL>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",
                      fontSize:18,fontWeight:300,color:C.charcoal}}>
                      {activeCO.projectSnap?.proj?.name||"—"}
                    </div>
                  </div>
                  <div>
                    <FL>Original Quote</FL>
                    <div style={{fontSize:11,color:C.charcoal,lineHeight:1.4}}>
                      {activeCO.projectSnap?.proj?.quoteNum||"—"}
                    </div>
                  </div>
                  <div>
                    <FL>Change Order No.</FL>
                    <div style={{fontSize:13,color:C.charcoal,fontFamily:"'Cormorant Garamond',serif"}}>
                      {activeCO.projectSnap?.proj?.quoteNum
                        ? `${activeCO.projectSnap.proj.quoteNum}_CO${activeCO.coNum}`
                        : `CO${activeCO.coNum}`}
                    </div>
                  </div>
                  <div>
                    <FL>CO Date</FL>
                    <input type="date" value={activeCO.date}
                      onChange={e=>updateCOField("date",e.target.value)}
                      className="ri" style={{...iSt,fontSize:12}}/>
                  </div>
                </div>

                <HR/>

                {/* ── Reference original quote items ── */}
                {activeCO.projectSnap?.rooms?.some(r=>r.name||parseFloat(r.list)>0)&&(
                  <div style={{marginBottom:32}}>
                    <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
                      textTransform:"uppercase",marginBottom:12,paddingBottom:8,
                      borderBottom:`1px solid ${C.stone}`}}>
                      Original Quote — click to add as CO line
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
                      {activeCO.projectSnap.rooms
                        .filter(r=>r.name||parseFloat(r.list)>0)
                        .map(r=>{
                          const vc = vendorConfig;
                          const calc = calcRoom(r, vc);
                          if (!calc.price>0 && !r.name) return null;
                          return(
                            <button key={r.id}
                              onClick={()=>{
                                const newLine = newCOLine();
                                setActiveCO(co=>({
                                  ...co,
                                  lines:[...co.lines, {
                                    ...newLine,
                                    sourceType:"room", sourceId:r.id,
                                    description: r.name||"Room",
                                    origAmount: String(Math.round(calc.price||0)),
                                    amount: String(Math.round(calc.price||0)),
                                  }]
                                }));
                              }}
                              style={{
                                background:C.parchmentDk,border:`1px solid ${C.stone}`,
                                color:C.bark,padding:"6px 14px",cursor:"pointer",
                                fontSize:10,fontFamily:"'Jost',sans-serif",
                                display:"flex",alignItems:"center",gap:8,
                              }}>
                              <span style={{fontSize:11,color:C.charcoal}}>{r.name||"Room"}</span>
                              <span style={{fontSize:10,color:C.clay,
                                fontFamily:"'Cormorant Garamond',serif",
                                fontVariantNumeric:"tabular-nums"}}>{fmt(calc.price)}</span>
                            </button>
                          );
                        })}
                    </div>
                    {/* Additional line items from original quote */}
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {[
                        ["installation", "Installation",        activeCO.projectSnap?.installation],
                        ["shipping",     "Shipping & Delivery", activeCO.projectSnap?.shipping],
                        ["hardware",     "Cabinet Hardware",    activeCO.projectSnap?.hardware],
                        ["misc",         "Misc",                activeCO.projectSnap?.misc],
                      ]
                        .filter(([,, v])=>parseFloat(v)>0)
                        .map(([key,lbl,val])=>(
                          <button key={key}
                            onClick={()=>{
                              const newLine = newCOLine();
                              setActiveCO(co=>({
                                ...co,
                                lines:[...co.lines, {
                                  ...newLine,
                                  sourceType:"lineitem", sourceId:key,
                                  description: lbl,
                                  origAmount: String(Math.round(parseFloat(val)||0)),
                                  amount: String(Math.round(parseFloat(val)||0)),
                                }]
                              }));
                            }}
                            style={{
                              background:"#EEF2EA",border:`1px solid ${C.moss}22`,
                              color:C.bark,padding:"6px 14px",cursor:"pointer",
                              fontSize:10,fontFamily:"'Jost',sans-serif",
                              display:"flex",alignItems:"center",gap:8,
                            }}>
                            <span style={{fontSize:11,color:C.charcoal}}>{lbl}</span>
                            <span style={{fontSize:10,color:C.moss,
                              fontFamily:"'Cormorant Garamond',serif",
                              fontVariantNumeric:"tabular-nums"}}>{fmt(parseFloat(val))}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* ── CO Line items ── */}
                <div style={{display:"flex",justifyContent:"space-between",
                  alignItems:"baseline",marginBottom:16}}>
                  <SecHead n="01" title="Change Lines" inline/>
                  <button onClick={addCOLine} className="addbtn no-print" style={{
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
                  gridTemplateColumns:"2.5fr 1.1fr 1fr 1fr 1fr 1fr 24px",
                  gap:14,paddingBottom:10,
                  borderBottom:`1px solid ${C.stone}`,marginBottom:4,
                }}>
                  {["Description","Orig. Amt","Markup %","Amount","Approved","Notes",""].map((h,i)=>(
                    <div key={i} style={{fontSize:8,letterSpacing:"0.18em",color:C.stoneDk,
                      textTransform:"uppercase",
                      textAlign:i>=1&&i<=3?"right":"left"}}>{h}</div>
                  ))}
                </div>

                {coLines.length===0&&(
                  <div style={{padding:"28px 0",textAlign:"center",
                    color:C.stoneDk,fontSize:12,letterSpacing:"0.06em",
                    borderBottom:`1px solid ${C.parchmentDk}`}}>
                    Click a room or line item above, or + Add Line to start
                  </div>
                )}

                {coLines.map((line,idx)=>(
                  <div key={line.id} style={{
                    display:"grid",
                    gridTemplateColumns:"2.5fr 1.1fr 1fr 1fr 1fr 1fr 24px",
                    gap:14,padding:"6px 0",
                    borderBottom:`1px solid ${C.parchmentDk}`,
                    alignItems:"center",
                    background: line.sourceType!=="custom"?"#FDFAF4":"transparent",
                  }}>
                    <div>
                      <input value={line.description}
                        onChange={e=>updateCOLine(line.id,"description",e.target.value)}
                        placeholder={`Change ${idx+1}`}
                        className="ri ph" style={iSt}/>
                      {line.sourceType!=="custom"&&(
                        <div style={{fontSize:9,color:C.clay,marginTop:2,letterSpacing:"0.06em"}}>
                          from original quote
                        </div>
                      )}
                    </div>
                    <input type="number" value={line.origAmount}
                      onChange={e=>updateCOLine(line.id,"origAmount",e.target.value)}
                      placeholder="—"
                      className="ri ph" style={{...iSt,textAlign:"right",fontSize:11}}/>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <input type="number" value={line.markupPct}
                        onChange={e=>updateCOLine(line.id,"markupPct",e.target.value)}
                        placeholder="0"
                        className="ri ph" style={{...iSt,textAlign:"right",fontSize:11}}/>
                      <span style={{fontSize:10,color:C.stoneDk}}>%</span>
                    </div>
                    <input type="number" value={line.amount}
                      onChange={e=>updateCOLine(line.id,"amount",e.target.value)}
                      placeholder="—"
                      className="ri ph" style={{
                        ...iSt,textAlign:"right",
                        fontWeight: line.markupPct?"500":"300",
                        color: line.markupPct?C.charcoal:C.bark,
                      }}/>
                    <select value={line.approved}
                      onChange={e=>updateCOLine(line.id,"approved",e.target.value)}
                      className="rs" style={{
                        ...sSt,fontSize:11,
                        color: line.approved==="Approved"?C.moss
                             : line.approved==="Rejected"?C.rust:C.clay,
                      }}>
                      {["Pending","Approved","Rejected"].map(o=><option key={o}>{o}</option>)}
                    </select>
                    <input value={line.notes}
                      onChange={e=>updateCOLine(line.id,"notes",e.target.value)}
                      placeholder="Notes"
                      className="ri ph" style={{...iSt,fontSize:11}}/>
                    <button className="no-print" onClick={()=>removeCOLine(line.id)} style={{
                      background:"none",border:"none",color:C.stoneMd,
                      fontSize:15,cursor:"pointer",opacity:0.5,
                      padding:"0 2px",lineHeight:1,
                    }}>×</button>
                  </div>
                ))}

                {/* CO Notes */}
                <div style={{marginTop:20,marginBottom:32}}>
                  <FL>CO Notes / Description of Work</FL>
                  <textarea value={activeCO.notes}
                    onChange={e=>updateCOField("notes",e.target.value)}
                    placeholder="Describe the scope of changes..."
                    className="ri ph"
                    rows={3}
                    style={{
                      ...iSt,width:"100%",resize:"vertical",
                      fontFamily:"'Jost',sans-serif",lineHeight:1.6,
                    }}/>
                </div>

                {/* CO Totals */}
                {coLines.length>0&&(
                  <div style={{marginBottom:40}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",
                      borderTop:`2px solid ${C.charcoal}`}}>
                      {[
                        ["Approved Changes",  fmt(coApproved),              C.moss],
                        ["Pending",           fmt(coPending),               C.clay],
                        ["Original Quote",    fmt(coOrigPrice),             C.bark],
                        ["Revised Total",     fmt(coOrigPrice+coApproved),  C.charcoal],
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

                {/* CO Approval button */}
                <div style={{marginBottom:32,display:"flex",justifyContent:"flex-end"}}>
                  {activeCO&&<COApproveBtn
                    savedChangeOrders={savedChangeOrders}
                    projectId={activeCO.projectId}
                    coId={activeCO.coId}
                    toggleCOApproval={toggleCOApproval}
                  />}
                </div>

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

          </div>
        )}
      {/* ── MONDAY PUSH MODAL ── */}
      {mondayModal&&(
        <MondayPushModal
          modal={mondayModal}
          onClose={()=>setMondayModal(null)}
        />
      )}
      {showHistory&&(
        <HistoryModal
          revisions={savedProjects.find(p=>p.id===(proj.stableId||proj.quoteNum||proj.name.toLowerCase().replace(/\s+/g,"-")))?.revisions||[]}
          onRestore={rev=>{
            setProj({...rev.proj});
            setRooms([...rev.rooms]);
            setOv({...rev.ov});
            setFinalPrice(rev.finalPrice||"");
            setQuoteNumEdited(true); // keep restored quoteNum, don't let autogen overwrite it
            setShowHistory(false);
          }}
          onClose={()=>setShowHistory(false)}
        />
      )}
      {showTemplates&&(
        <TemplateModal
          templates={templates}
          onLoad={loadTemplate}
          onDelete={deleteTemplate}
          onClose={()=>setShowTemplates(false)}
        />
      )}
      {showGmailModal&&(
        <GmailModal
          proj={proj}
          effPrice={effPrice}
          rooms={rooms}
          rc={rc}
          cabCust={cabCust}
          installation={installation}
          salesTax={salesTax}
          totalLF={totalLF}
          onClose={()=>setShowGmailModal(false)}
        />
      )}
    </main>
    </div>
  );
}

// ── My Quotes View ─────────────────────────────────────────────
function MyQuotesView({ savedProjects, savedChangeOrders, session,
  startNewCO, setView, setProj, setRooms, setOv, setFinalPrice, setQuoteNumEdited, vendorConfig }) {

  const [tab, setTab] = useState("quotes"); // "quotes" | "cos"
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null); // null | { type:"quote"|"co", data }

  const sq = search.trim().toLowerCase();

  const filteredQuotes = (savedProjects||[]).filter(p =>
    !sq ||
    (p.proj.name||"").toLowerCase().includes(sq) ||
    (p.proj.quoteNum||"").toLowerCase().includes(sq) ||
    (p.proj.status||"").toLowerCase().includes(sq)
  );

  const allCOs = Object.values(savedChangeOrders||{}).flat();
  const filteredCOs = allCOs.filter(co =>
    !sq ||
    (co.projectSnap?.proj?.name||"").toLowerCase().includes(sq) ||
    (co.projectSnap?.proj?.quoteNum||"").toLowerCase().includes(sq) ||
    (co.coNum||"").toLowerCase().includes(sq)
  );

  const loadQuote = (p) => {
    setProj({...p.proj});
    setRooms([...p.rooms]);
    setOv({...p.ov});
    setFinalPrice(p.finalPrice||"");
    setQuoteNumEdited?.(true); // preserve loaded quoteNum, prevent autogen overwrite
    setView("quote");
  };

  const tabBtn = (id, label, count) => (
    <button onClick={()=>setTab(id)} style={{
      background: tab===id ? C.charcoal : "transparent",
      color:      tab===id ? C.parchment : C.stoneDk,
      border:     `1px solid ${tab===id ? C.charcoal : C.stone}`,
      padding:"7px 20px", cursor:"pointer",
      fontSize:8, letterSpacing:"0.2em", textTransform:"uppercase",
      fontFamily:"'Jost',sans-serif", fontWeight:500,
      display:"flex", alignItems:"center", gap:8,
    }}>
      {label}
      <span style={{
        fontSize:9, fontWeight:400,
        background: tab===id ? "rgba(255,255,255,0.15)" : C.stone,
        color:      tab===id ? C.parchment : C.bark,
        padding:"1px 6px",
      }}>{count}</span>
    </button>
  );

  return (
    <div className="fade">
      {/* Header */}
      <div style={{display:"flex", justifyContent:"space-between",
        alignItems:"baseline", marginBottom:32}}>
        <SecHead n="03" title="My Quotes & Change Orders"/>
        <div style={{fontSize:10, color:C.stoneDk, letterSpacing:"0.06em"}}>
          Logged in as {session?.displayName||session?.user}
        </div>
      </div>

      {/* Search + Tab row */}
      <div style={{display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:20, gap:16}}>
        <div style={{display:"flex", gap:4}}>
          {tabBtn("quotes", "Quotes",        (savedProjects||[]).length)}
          {tabBtn("cos",    "Change Orders", allCOs.length)}
        </div>
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Search by client name, quote number, status…"
          className="ri ph"
          style={{...iSt, width:280, fontSize:11}}
        />
      </div>

      {/* ── QUOTES LIST ── */}
      {tab==="quotes"&&(
        <div>
          {filteredQuotes.length===0?(
            <div style={{padding:"48px 0", textAlign:"center",
              border:`1px dashed ${C.stone}`, color:C.stoneMd,
              fontSize:12, letterSpacing:"0.06em"}}>
              {sq ? `No quotes matching "${sq}"` : "No quotes saved yet — build one in Quote Builder"}
            </div>
          ):(
            <div>
              {/* Column headers */}
              <div style={{display:"grid",
                gridTemplateColumns:"2.2fr 1.4fr 0.7fr 0.9fr 0.8fr 1fr 88px",
                gap:12, paddingBottom:8,
                borderBottom:`1px solid ${C.stone}`, marginBottom:4}}>
                {["Client / Project","Quote No.","State","Amount","Status","Saved",""].map((h,i)=>(
                  <div key={i} style={{fontSize:8, letterSpacing:"0.16em",
                    color:C.stoneDk, textTransform:"uppercase",
                    textAlign: i===3?"right":"left"}}>{h}</div>
                ))}
              </div>

              {filteredQuotes.map((p,i)=>{
                const sc = STATUS_CONFIG[p.proj.status]||{bg:C.stone,color:C.bark};
                const coCount = (savedChangeOrders[p.id]||[]).length;
                return(
                  <div key={p.id} style={{
                    display:"grid",
                    gridTemplateColumns:"2.2fr 1.4fr 0.7fr 0.9fr 0.8fr 1fr 88px",
                    gap:12, padding:"11px 0",
                    borderBottom:`1px solid ${C.parchmentDk}`,
                    alignItems:"center",
                    background: i%2===0 ? "transparent" : "rgba(253,250,244,0.5)",
                  }}>
                    <div>
                      <div style={{fontSize:13, color:C.bark, fontWeight:400}}>
                        {p.proj.name||"Untitled"}
                      </div>
                      {coCount>0&&(
                        <div style={{fontSize:9, color:C.clay, marginTop:2,
                          letterSpacing:"0.06em"}}>
                          {coCount} change order{coCount!==1?"s":""}
                        </div>
                      )}
                      {p.quoteApproved&&(
                        <div style={{fontSize:8, color:C.moss, marginTop:2,
                          letterSpacing:"0.08em"}}>
                          ✓ Approved {p.quoteApprovedAt}
                        </div>
                      )}
                    </div>
                    <div style={{fontSize:11, color:C.stoneDk, letterSpacing:"0.03em",
                      fontFamily:"'Cormorant Garamond',serif", lineHeight:1.3}}>
                      {p.proj.quoteNum||"—"}
                    </div>
                    <div style={{fontSize:11, color:C.stoneDk}}>
                      {p.proj.state||"—"}
                    </div>
                    <div style={{textAlign:"right",
                      fontFamily:"'Cormorant Garamond',serif",
                      fontSize:15, color:C.charcoal,
                      fontVariantNumeric:"tabular-nums"}}>
                      {fmt(p.effPrice)}
                    </div>
                    <div>
                      <span style={{
                        fontSize:8, fontWeight:500, letterSpacing:"0.1em",
                        textTransform:"uppercase",
                        color:sc.color, background:sc.bg,
                        padding:"3px 8px",
                      }}>{p.proj.status}</span>
                    </div>
                    <div style={{fontSize:10, color:C.stoneDk, letterSpacing:"0.04em"}}>
                      {p.savedAt}
                    </div>
                    <div style={{display:"flex", gap:4}}>
                      <button onClick={()=>setPreview({type:"quote",data:p})} style={{
                        background:"transparent",
                        border:`1px solid ${C.stoneMd}`,
                        color:C.bark, padding:"5px 10px", cursor:"pointer",
                        fontSize:7, letterSpacing:"0.18em", textTransform:"uppercase",
                        fontFamily:"'Jost',sans-serif",
                      }}>View</button>
                      <button onClick={()=>startNewCO(p)} style={{
                        background:C.charcoal, color:C.parchment,
                        border:"none",
                        padding:"5px 10px", cursor:"pointer",
                        fontSize:7, letterSpacing:"0.18em", textTransform:"uppercase",
                        fontFamily:"'Jost',sans-serif",
                      }}>+ CO</button>
                    </div>
                  </div>
                );
              })}

              {/* Total */}
              {filteredQuotes.length>1&&(
                <div style={{display:"grid",
                  gridTemplateColumns:"2.2fr 1.4fr 0.7fr 0.9fr 0.8fr 1fr 88px",
                  gap:12, paddingTop:12, marginTop:4,
                  borderTop:`2px solid ${C.charcoal}`}}>
                  <div style={{fontSize:8, letterSpacing:"0.2em",
                    textTransform:"uppercase", color:C.bark,
                    gridColumn:"1/4", alignSelf:"center"}}>
                    {filteredQuotes.length} quote{filteredQuotes.length!==1?"s":""}
                  </div>
                  <div style={{textAlign:"right",
                    fontFamily:"'Cormorant Garamond',serif",
                    fontSize:16, color:C.charcoal,
                    fontVariantNumeric:"tabular-nums"}}>
                    {fmt(filteredQuotes.reduce((a,p)=>a+p.effPrice,0))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── CHANGE ORDERS LIST ── */}
      {tab==="cos"&&(
        <div>
          {filteredCOs.length===0?(
            <div style={{padding:"48px 0", textAlign:"center",
              border:`1px dashed ${C.stone}`, color:C.stoneMd,
              fontSize:12, letterSpacing:"0.06em"}}>
              {sq ? `No change orders matching "${sq}"` : "No change orders yet — open a quote and click + CO"}
            </div>
          ):(
            <div>
              {/* Column headers */}
              <div style={{display:"grid",
                gridTemplateColumns:"2fr 1.6fr 0.7fr 1fr 0.8fr 1fr 60px",
                gap:12, paddingBottom:8,
                borderBottom:`1px solid ${C.stone}`, marginBottom:4}}>
                {["Client / Project","CO Number","State","Amount","Status","Date",""].map((h,i)=>(
                  <div key={i} style={{fontSize:8, letterSpacing:"0.16em",
                    color:C.stoneDk, textTransform:"uppercase",
                    textAlign: i===3?"right":"left"}}>{h}</div>
                ))}
              </div>

              {filteredCOs.map((co,i)=>{
                const coNum = co.projectSnap?.proj?.quoteNum
                  ? `${co.projectSnap.proj.quoteNum}_CO${co.coNum}`
                  : `CO${co.coNum}`;
                const approvedLines = (co.lines||[]).filter(l=>l.approved==="Approved");
                const pendingLines  = (co.lines||[]).filter(l=>l.approved==="Pending");
                const coAmt = approvedLines.length>0
                  ? approvedLines.reduce((a,l)=>a+(parseFloat(l.amount)||0),0)
                  : pendingLines.reduce((a,l)=>a+(parseFloat(l.amount)||0),0);
                const statusLabel = co.coApproved ? "Approved"
                  : approvedLines.length>0 ? "Part. Approved"
                  : "Pending";
                const statusColor = co.coApproved ? C.moss
                  : approvedLines.length>0 ? C.clay : C.stoneDk;
                const statusBg = co.coApproved ? "#D8E0D0"
                  : approvedLines.length>0 ? "#F2EAD8" : C.stone;
                return(
                  <div key={co.coId} style={{
                    display:"grid",
                    gridTemplateColumns:"2fr 1.6fr 0.7fr 1fr 0.8fr 1fr 60px",
                    gap:12, padding:"11px 0",
                    borderBottom:`1px solid ${C.parchmentDk}`,
                    alignItems:"center",
                    background: i%2===0 ? "transparent" : "rgba(253,250,244,0.5)",
                  }}>
                    <div>
                      <div style={{fontSize:13, color:C.bark, fontWeight:400}}>
                        {co.projectSnap?.proj?.name||"Unknown Project"}
                      </div>
                      {co.coApproved&&(
                        <div style={{fontSize:8, color:C.moss, marginTop:2,
                          letterSpacing:"0.08em"}}>
                          ✓ Approved {co.coApprovedAt}
                        </div>
                      )}
                    </div>
                    <div style={{fontSize:11, color:C.stoneDk,
                      fontFamily:"'Cormorant Garamond',serif",
                      lineHeight:1.3, letterSpacing:"0.02em"}}>
                      {coNum}
                    </div>
                    <div style={{fontSize:11, color:C.stoneDk}}>
                      {co.projectSnap?.proj?.state||"—"}
                    </div>
                    <div style={{textAlign:"right",
                      fontFamily:"'Cormorant Garamond',serif",
                      fontSize:15, color:C.charcoal,
                      fontVariantNumeric:"tabular-nums"}}>
                      {fmt(coAmt)}
                    </div>
                    <div>
                      <span style={{
                        fontSize:8, fontWeight:500, letterSpacing:"0.1em",
                        textTransform:"uppercase",
                        color:statusColor, background:statusBg,
                        padding:"3px 8px",
                      }}>{statusLabel}</span>
                    </div>
                    <div style={{fontSize:10, color:C.stoneDk, letterSpacing:"0.04em"}}>
                      {co.savedAt||co.date||"—"}
                    </div>
                    <button onClick={()=>setPreview({type:"co",data:co})} style={{
                      background:"transparent",
                      border:`1px solid ${C.stoneMd}`,
                      color:C.bark, padding:"5px 10px", cursor:"pointer",
                      fontSize:7, letterSpacing:"0.18em", textTransform:"uppercase",
                      fontFamily:"'Jost',sans-serif",
                    }}>View</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* ── PREVIEW MODAL ── */}
      {preview&&(
        <div style={{
          position:"fixed",top:0,left:0,right:0,bottom:0,
          background:"rgba(10,8,6,0.55)",zIndex:500,
          display:"flex",alignItems:"flex-start",justifyContent:"center",
          padding:"48px 24px",overflowY:"auto",
        }} onClick={e=>{if(e.target===e.currentTarget)setPreview(null);}}>
          <div style={{
            background:C.parchment,width:"100%",maxWidth:720,
            padding:"40px 48px",position:"relative",
            boxShadow:"0 24px 64px rgba(0,0,0,0.3)",
          }}>
            <button onClick={()=>setPreview(null)} style={{
              position:"absolute",top:16,right:20,
              background:"none",border:"none",fontSize:22,
              cursor:"pointer",color:C.stoneMd,lineHeight:1,
            }}>×</button>

            {preview.type==="quote"&&<QuotePreview
              p={preview.data}
              loadQuote={loadQuote}
              startNewCO={startNewCO}
              vendorConfig={vendorConfig}
              onClose={()=>setPreview(null)}
            />}
            {preview.type==="co"&&<COPreview
              co={preview.data}
              startNewCO={startNewCO}
              onClose={()=>setPreview(null)}
            />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quote Preview ───────────────────────────────────────────────
function QuotePreview({ p, loadQuote, startNewCO, vendorConfig, onClose }) {
  const sc = STATUS_CONFIG[p.proj.status]||{bg:C.stone,color:C.bark};
  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:28,paddingBottom:20,borderBottom:`1px solid ${C.stone}`}}>
        <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
          textTransform:"uppercase",marginBottom:6}}>Quote</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",
          fontSize:28,fontWeight:300,color:C.charcoal,lineHeight:1.1,marginBottom:8}}>
          {p.proj.name||"Untitled Project"}
        </div>
        <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{fontSize:11,color:C.stoneDk,letterSpacing:"0.04em"}}>
            {p.proj.quoteNum||"—"}
          </div>
          <div style={{fontSize:11,color:C.stoneDk}}>{p.proj.state}</div>
          <span style={{fontSize:8,fontWeight:500,letterSpacing:"0.1em",
            textTransform:"uppercase",color:sc.color,background:sc.bg,
            padding:"3px 8px"}}>{p.proj.status}</span>
          <div style={{fontSize:10,color:C.stoneDk}}>Saved {p.savedAt}</div>
          {p.quoteApproved&&(
            <div style={{fontSize:9,color:C.moss,letterSpacing:"0.08em"}}>
              ✓ Approved {p.quoteApprovedAt} by {p.quoteApprovedBy}
            </div>
          )}
        </div>
      </div>

      {/* Rooms */}
      {(p.rooms||[]).some(r=>r.name||parseFloat(r.list)>0)&&(
        <div style={{marginBottom:24}}>
          <div style={{fontSize:8,letterSpacing:"0.22em",color:C.stoneDk,
            textTransform:"uppercase",marginBottom:10}}>Rooms / Scope</div>
          <div style={{border:`1px solid ${C.stone}`}}>
            {(p.rooms||[]).filter(r=>r.name||parseFloat(r.list)>0).map((r,i)=>{
              const vc = vendorConfig||VENDORS;
              const disc = vc[r.vendor]?.discount??1;
              const mult = vc[r.vendor]?.multiplier??1.6;
              const net  = (parseFloat(r.list)||0)*disc;
              const auto = (net+(parseFloat(r.upcharge)||0))*mult;
              const ovr  = parseFloat(r.priceOverride);
              const price= (!isNaN(ovr)&&ovr>0)?ovr:auto;
              return(
                <div key={r.id||i} style={{
                  display:"grid",gridTemplateColumns:"1fr auto auto",
                  gap:20,padding:"10px 16px",
                  borderBottom:`1px solid ${C.parchmentDk}`,
                  alignItems:"center",
                  background:i%2===0?"transparent":C.white,
                }}>
                  <div>
                    <div style={{fontSize:12,color:C.bark}}>{r.name||`Room ${i+1}`}</div>
                    <div style={{fontSize:9,color:C.stoneDk,marginTop:2}}>
                      {r.vendor}
                    </div>
                  </div>
                  <div style={{fontSize:10,color:C.stoneDk,textAlign:"right"}}>
                    List: {fmt(parseFloat(r.list)||0)}
                  </div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",
                    fontSize:16,color:C.charcoal,textAlign:"right",
                    fontVariantNumeric:"tabular-nums",minWidth:90}}>
                    {fmt(price)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Total */}
      <div style={{
        display:"flex",justifyContent:"space-between",alignItems:"center",
        padding:"20px 24px",background:C.charcoal,marginBottom:24,
      }}>
        <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
          textTransform:"uppercase"}}>Total Quote</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",
          fontSize:32,fontWeight:300,color:C.parchment,
          fontVariantNumeric:"tabular-nums"}}>
          {fmt(p.effPrice)}
        </div>
      </div>

      {/* Notes */}
      {p.proj.notes&&(
        <div style={{padding:"12px 16px",background:C.white,
          border:`1px solid ${C.stone}`,marginBottom:24,
          fontSize:11,color:C.stoneDk,lineHeight:1.6}}>
          <div style={{fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
            color:C.stoneDk,marginBottom:6}}>Notes</div>
          {p.proj.notes}
        </div>
      )}

      {/* Actions */}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",
        paddingTop:20,borderTop:`1px solid ${C.stone}`}}>
        <button onClick={()=>{startNewCO(p);onClose();}} style={{
          background:"transparent",border:`1px solid ${C.stoneMd}`,
          color:C.bark,padding:"9px 20px",cursor:"pointer",
          fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
          fontFamily:"'Jost',sans-serif",
        }}>+ New Change Order</button>
        <button onClick={()=>{loadQuote(p);onClose();}} style={{
          background:C.charcoal,color:C.parchment,border:"none",
          padding:"9px 24px",cursor:"pointer",
          fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
          fontFamily:"'Jost',sans-serif",fontWeight:500,
        }}>Edit in Builder</button>
      </div>
    </div>
  );
}

// ── CO Preview ──────────────────────────────────────────────────
function COPreview({ co, startNewCO, onClose }) {
  const coNum = co.projectSnap?.proj?.quoteNum
    ? `${co.projectSnap.proj.quoteNum}_CO${co.coNum}`
    : `CO${co.coNum}`;

  const lines = co.lines||[];
  const approvedAmt = lines.filter(l=>l.approved==="Approved")
    .reduce((a,l)=>a+(parseFloat(l.amount)||0),0);
  const pendingAmt  = lines.filter(l=>l.approved==="Pending")
    .reduce((a,l)=>a+(parseFloat(l.amount)||0),0);

  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:28,paddingBottom:20,borderBottom:`1px solid ${C.stone}`}}>
        <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
          textTransform:"uppercase",marginBottom:6}}>Change Order</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",
          fontSize:24,fontWeight:300,color:C.charcoal,marginBottom:8}}>
          {co.projectSnap?.proj?.name||"Unknown Project"}
        </div>
        <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{fontSize:11,color:C.stoneDk,fontFamily:"'Cormorant Garamond',serif"}}>
            {coNum}
          </div>
          <div style={{fontSize:10,color:C.stoneDk}}>
            {co.date ? new Date(co.date).toLocaleDateString() : co.savedAt||"—"}
          </div>
          {co.coApproved&&(
            <div style={{fontSize:9,color:C.moss,letterSpacing:"0.08em"}}>
              ✓ Approved {co.coApprovedAt} by {co.coApprovedBy}
            </div>
          )}
        </div>
      </div>

      {/* Lines */}
      {lines.length>0&&(
        <div style={{marginBottom:24}}>
          <div style={{fontSize:8,letterSpacing:"0.22em",color:C.stoneDk,
            textTransform:"uppercase",marginBottom:10}}>Change Lines</div>
          <div style={{border:`1px solid ${C.stone}`}}>
            {/* Headers */}
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",
              gap:12,padding:"8px 16px",
              borderBottom:`1px solid ${C.stone}`,
              background:C.parchmentDk}}>
              {["Description","Amount","Status"].map((h,i)=>(
                <div key={i} style={{fontSize:8,letterSpacing:"0.16em",
                  color:C.stoneDk,textTransform:"uppercase",
                  textAlign:i===1?"right":"left"}}>{h}</div>
              ))}
            </div>
            {lines.map((l,i)=>{
              const statusColor = l.approved==="Approved"?C.moss
                : l.approved==="Rejected"?C.rust:C.clay;
              return(
                <div key={l.id||i} style={{
                  display:"grid",gridTemplateColumns:"2fr 1fr 1fr",
                  gap:12,padding:"10px 16px",
                  borderBottom:`1px solid ${C.parchmentDk}`,
                  alignItems:"center",
                  background:i%2===0?"transparent":C.white,
                }}>
                  <div>
                    <div style={{fontSize:12,color:C.bark}}>{l.description||`Change ${i+1}`}</div>
                    {l.sourceType!=="custom"&&(
                      <div style={{fontSize:9,color:C.clay,marginTop:2}}>from original quote</div>
                    )}
                    {l.markupPct&&parseFloat(l.markupPct)>0&&(
                      <div style={{fontSize:9,color:C.stoneDk,marginTop:2}}>
                        {parseFloat(l.markupPct)}% markup on {fmt(parseFloat(l.origAmount)||0)}
                      </div>
                    )}
                  </div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",
                    fontSize:16,color:C.charcoal,textAlign:"right",
                    fontVariantNumeric:"tabular-nums"}}>
                    {fmt(parseFloat(l.amount)||0)}
                  </div>
                  <div>
                    <span style={{fontSize:8,fontWeight:500,letterSpacing:"0.1em",
                      textTransform:"uppercase",color:statusColor,
                      background:statusColor+"22",padding:"3px 8px"}}>
                      {l.approved}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Totals */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",
        border:`1px solid ${C.stone}`,marginBottom:24}}>
        {[
          ["Approved",fmt(approvedAmt),C.moss],
          ["Pending", fmt(pendingAmt), C.clay],
          ["Original Quote",fmt(co.projectSnap?.effPrice||0),C.bark],
        ].map(([lbl,val,color])=>(
          <div key={lbl} style={{padding:"16px 18px",
            borderRight:`1px solid ${C.stone}`}}>
            <div style={{fontSize:8,letterSpacing:"0.18em",color:C.stoneDk,
              textTransform:"uppercase",marginBottom:6}}>{lbl}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",
              fontSize:20,fontWeight:300,color,
              fontVariantNumeric:"tabular-nums"}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Notes */}
      {co.notes&&(
        <div style={{padding:"12px 16px",background:C.white,
          border:`1px solid ${C.stone}`,marginBottom:24,
          fontSize:11,color:C.stoneDk,lineHeight:1.6}}>
          <div style={{fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
            color:C.stoneDk,marginBottom:6}}>Notes</div>
          {co.notes}
        </div>
      )}

      {/* Actions */}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",
        paddingTop:20,borderTop:`1px solid ${C.stone}`}}>
        <button onClick={()=>{startNewCO(co.projectSnap);onClose();}} style={{
          background:C.charcoal,color:C.parchment,border:"none",
          padding:"9px 24px",cursor:"pointer",
          fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
          fontFamily:"'Jost',sans-serif",fontWeight:500,
        }}>Open in CO Builder</button>
      </div>
    </div>
  );
}

// ── Export Modal ────────────────────────────────────────────────
const EXPORT_COLUMNS = [
  // Group: Project Info
  { id:"quoteNum",    group:"Project",   label:"Quote Number" },
  { id:"name",        group:"Project",   label:"Client / Project Name" },
  { id:"date",        group:"Project",   label:"Quote Date" },
  { id:"savedAt",     group:"Project",   label:"Saved Date" },
  { id:"state",       group:"Project",   label:"State" },
  { id:"status",      group:"Project",   label:"Status" },
  { id:"vendor",      group:"Project",   label:"Primary Vendor" },
  { id:"approved",    group:"Project",   label:"Quote Approved?" },
  { id:"approvedAt",  group:"Project",   label:"Approval Date" },
  { id:"approvedBy",  group:"Project",   label:"Approved By" },
  { id:"notes",       group:"Project",   label:"Notes" },
  // Group: Pricing
  { id:"effPrice",    group:"Pricing",   label:"Customer Price (Final)" },
  { id:"cabCust",     group:"Pricing",   label:"Cabinetry (Customer)" },
  { id:"installation",group:"Pricing",   label:"Installation" },
  { id:"hardware",    group:"Pricing",   label:"Hardware" },
  { id:"accessories", group:"Pricing",   label:"Accessories / Misc" },
  { id:"misc",        group:"Pricing",   label:"Other Misc" },
  { id:"salesTax",    group:"Pricing",   label:"Sales Tax" },
  { id:"overhead",    group:"Pricing",   label:"Overhead" },
  { id:"design",      group:"Pricing",   label:"Design Fee" },
  { id:"shipping",    group:"Pricing",   label:"Shipping" },
  { id:"punchlist",   group:"Pricing",   label:"Punchlist Reserve" },
  { id:"incentive",   group:"Pricing",   label:"Employee Incentive" },
  // Group: Financials
  { id:"totalCost",   group:"Financials",label:"Total Cost" },
  { id:"profit",      group:"Financials", label:"Gross Profit" },
  { id:"margin",      group:"Financials", label:"Margin %" },
  { id:"corpTax",     group:"Financials", label:"Corp Tax Reserve" },
  { id:"netProfit",   group:"Financials", label:"Net After Tax" },
  { id:"cabNet",      group:"Financials", label:"Cabinet Net Cost" },
  // Group: Linear Footage
  { id:"lfBase",      group:"Linear Ft", label:"LF – Base Cabinets" },
  { id:"lfTall",      group:"Linear Ft", label:"LF – Tall Cabinets" },
  { id:"lfWall",      group:"Linear Ft", label:"LF – Wall Cabinets" },
  { id:"lfShelf",     group:"Linear Ft", label:"LF – Floating Shelves" },
  { id:"totalLF",     group:"Linear Ft", label:"LF – Total" },
  { id:"perLF",       group:"Linear Ft", label:"Install $/LF (Blended)" },
  // Group: Rooms
  { id:"roomCount",   group:"Rooms",     label:"Number of Rooms" },
  { id:"roomList",    group:"Rooms",     label:"Room Names (comma list)" },
];

const DEFAULT_COLS = ["quoteNum","name","date","state","status","effPrice","cabCust","installation","totalCost","profit","margin","totalLF","perLF"];

function ExportModal({ savedProjects, savedChangeOrders, vendorConfig, onClose }) {
  const [selected, setSelected] = useState(new Set(DEFAULT_COLS));
  const [filterStatus, setFilterStatus] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [incCOs,   setIncCOs]   = useState(false);

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleGroup = (group) => {
    const cols = EXPORT_COLUMNS.filter(c=>c.group===group).map(c=>c.id);
    const allOn = cols.every(id=>selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      cols.forEach(id => allOn ? next.delete(id) : next.add(id));
      return next;
    });
  };

  // Build filtered project list
  const filtered = (savedProjects||[]).filter(p => {
    if (filterStatus!=="All" && p.proj.status!==filterStatus) return false;
    if (dateFrom && p.proj.date && p.proj.date < dateFrom) return false;
    if (dateTo   && p.proj.date && p.proj.date > dateTo)   return false;
    return true;
  });

  const orderedCols = EXPORT_COLUMNS.filter(c=>selected.has(c.id));

  const getValue = (p, id) => {
    const ov = p.ov || {};
    const G  = (key, auto) => { const v=parseFloat(ov[key]); return isNaN(v)?auto:v; };
    const cabNet = (p.rooms||[]).reduce((s,r)=>s+(parseFloat(r.list)||0)*((vendorConfig||{})[r.vendor]?.discount??1),0);
    const instAmt = p.installation ?? G("installation", (p.cabCust||0)*0.15);
    const totalLF = (parseFloat(ov.lfBase)||0)+(parseFloat(ov.lfTall)||0)+(parseFloat(ov.lfWall)||0)+(parseFloat(ov.lfShelf)||0);
    switch(id) {
      case "quoteNum":    return p.proj.quoteNum||"";
      case "name":        return p.proj.name||"";
      case "date":        return p.proj.date||"";
      case "savedAt":     return p.savedAt||"";
      case "state":       return p.proj.state||"";
      case "status":      return p.proj.status||"";
      case "vendor":      return p.proj.vendor||"";
      case "approved":    return p.quoteApproved?"Yes":"No";
      case "approvedAt":  return p.quoteApprovedAt||"";
      case "approvedBy":  return p.quoteApprovedBy||"";
      case "notes":       return p.proj.notes||"";
      case "effPrice":    return p.effPrice||0;
      case "cabCust":     return p.cabCust||0;
      case "installation":return instAmt;
      case "hardware":    return G("hardware",0);
      case "accessories": return G("accessories",0);
      case "misc":        return G("misc",0);
      case "salesTax":    return p.salesTax || G("salesTax",0);
      case "overhead":    return p.overhead  || G("overhead",0);
      case "design":      return p.design    || G("design",0);
      case "shipping":    return p.shipping  || G("shipping",0);
      case "punchlist":   return p.punchlist || G("punchlist",0);
      case "incentive":   return p.incentive || G("incentive",0);
      case "totalCost":   return p.totalCost||0;
      case "profit":      return p.profit||0;
      case "margin":      return p.margin ? +(p.margin*100).toFixed(1) : 0;
      case "corpTax":     return p.corpTax||0;
      case "netProfit":   return p.netProfit||0;
      case "cabNet":      return p.cabNet||cabNet;
      case "lfBase":      return parseFloat(ov.lfBase)||0;
      case "lfTall":      return parseFloat(ov.lfTall)||0;
      case "lfWall":      return parseFloat(ov.lfWall)||0;
      case "lfShelf":     return parseFloat(ov.lfShelf)||0;
      case "totalLF":     return totalLF;
      case "perLF":       return totalLF>0 && instAmt>0 ? +(instAmt/totalLF).toFixed(2) : "";
      case "roomCount":   return (p.rooms||[]).filter(r=>r.name||parseFloat(r.list)>0).length;
      case "roomList":    return (p.rooms||[]).filter(r=>r.name).map(r=>r.name).join(", ");
      default:            return "";
    }
  };

  const doExport = () => {
    if (!window.XLSX) { alert("SheetJS not loaded yet — try again in a moment."); return; }
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Projects ────────────────────────────────────
    const projHeaders = orderedCols.map(c=>c.label);
    const projRows = filtered.map(p => orderedCols.map(c => getValue(p, c.id)));
    const projSheet = XLSX.utils.aoa_to_sheet([projHeaders, ...projRows]);

    // Column widths
    projSheet["!cols"] = orderedCols.map(c => ({
      wch: ["notes","roomList","name"].includes(c.id) ? 36
         : ["effPrice","totalCost","profit","cabCust"].includes(c.id) ? 16
         : 14
    }));

    // Style header row (bold, fill)
    const range = XLSX.utils.decode_range(projSheet["!ref"]);
    for (let C2 = range.s.c; C2 <= range.e.c; C2++) {
      const cell = projSheet[XLSX.utils.encode_cell({r:0, c:C2})];
      if (cell) {
        cell.s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "3D3530" } },
          alignment: { horizontal: "center" },
        };
      }
    }

    // Format currency & percent columns
    const currencyCols = ["effPrice","cabCust","installation","hardware","accessories","misc","salesTax","overhead","design","shipping","punchlist","incentive","totalCost","profit","corpTax","netProfit","cabNet","perLF"];
    const pctCols = ["margin"];
    orderedCols.forEach((col, ci) => {
      for (let ri = 1; ri <= projRows.length; ri++) {
        const addr = XLSX.utils.encode_cell({r:ri, c:ci});
        if (!projSheet[addr]) continue;
        if (currencyCols.includes(col.id)) projSheet[addr].z = '$#,##0.00';
        if (pctCols.includes(col.id))      projSheet[addr].z = '0.0"%"';
      }
    });

    XLSX.utils.book_append_sheet(wb, projSheet, "Projects");

    // ── Sheet 2: Room Detail ─────────────────────────────────
    const roomHeaders = ["Quote #","Project","State","Room Name","Vendor","List Price","Net Price","Upcharge","Final Price","Accessories","Comments"];
    const roomRows = [];
    filtered.forEach(p => {
      (p.rooms||[]).filter(r=>r.name||parseFloat(r.list)>0).forEach(r => {
        const vc = r.vendor && r.vendor !== "" ? r.vendor : "Bellmont";
        const list = parseFloat(r.list)||0;
        const vc2 = vendorConfig||{};
        const disc = vc2[vc]?.discount ?? 0.48;
        const mult = vc2[vc]?.multiplier ?? 1.6;
        const net  = list*disc;
        const up   = parseFloat(r.upcharge)||0;
        const auto = (net+up)*mult;
        const ovr  = parseFloat(r.priceOverride);
        const finalRoomPrice = (!isNaN(ovr)&&ovr>0) ? ovr : auto;
        roomRows.push([
          p.proj.quoteNum||"",
          p.proj.name||"",
          p.proj.state||"",
          r.name||"",
          vc,
          list,
          net,
          up,
          finalRoomPrice,
          r.accessories||"",
          r.comments||"",
        ]);
      });
    });
    const roomSheet = XLSX.utils.aoa_to_sheet([roomHeaders, ...roomRows]);
    roomSheet["!cols"] = [14,28,8,20,16,12,12,10,12,24,36].map(w=>({wch:w}));
    for (let c2=0; c2<=roomHeaders.length-1; c2++) {
      const cell = roomSheet[XLSX.utils.encode_cell({r:0,c:c2})];
      if (cell) cell.s = { font:{bold:true,color:{rgb:"FFFFFF"}}, fill:{fgColor:{rgb:"3D3530"}} };
    }
    XLSX.utils.book_append_sheet(wb, roomSheet, "Room Detail");

    // ── Sheet 3: Change Orders (optional) ────────────────────
    if (incCOs) {
      const coHeaders = ["Quote #","Project","CO #","State","Date","Line Description","Amount","Status","CO Approved"];
      const coRows = [];
      filtered.forEach(p => {
        const cos = savedChangeOrders?.[p.id]||[];
        cos.forEach(co => {
          (co.lines||[]).forEach(l => {
            coRows.push([
              p.proj.quoteNum||"",
              p.proj.name||"",
              co.coNum||"",
              p.proj.state||"",
              co.date ? new Date(co.date).toLocaleDateString() : "",
              l.description||"",
              parseFloat(l.amount)||0,
              l.approved||"",
              co.coApproved?"Yes":"No",
            ]);
          });
        });
      });
      const coSheet = XLSX.utils.aoa_to_sheet([coHeaders, ...coRows]);
      coSheet["!cols"] = [14,28,8,8,12,36,12,10,10].map(w=>({wch:w}));
      for (let c2=0; c2<=coHeaders.length-1; c2++) {
        const cell = coSheet[XLSX.utils.encode_cell({r:0,c:c2})];
        if (cell) cell.s = { font:{bold:true,color:{rgb:"FFFFFF"}}, fill:{fgColor:{rgb:"3D3530"}} };
      }
      XLSX.utils.book_append_sheet(wb, coSheet, "Change Orders");
    }

    // ── Sheet 4: $/LF Analysis ───────────────────────────────
    const lfProjects = filtered.filter(p => {
      const ov = p.ov||{};
      return (parseFloat(ov.lfBase)||0)+(parseFloat(ov.lfTall)||0)+(parseFloat(ov.lfWall)||0)+(parseFloat(ov.lfShelf)||0) > 0;
    });
    if (lfProjects.length > 0) {
      const lfHeaders = ["Quote #","Project","Date","State","Total LF","LF Base","LF Tall","LF Wall","LF Shelves","Install $","$/LF Blended","$/LF Base","$/LF Tall","$/LF Wall","$/LF Shelves","Customer Price","$/LF Total Price"];
      const lfRows = lfProjects.map(p => {
        const ov = p.ov||{};
        const lfBase  = parseFloat(ov.lfBase)||0;
        const lfTall  = parseFloat(ov.lfTall)||0;
        const lfWall  = parseFloat(ov.lfWall)||0;
        const lfShelf = parseFloat(ov.lfShelf)||0;
        const tot     = lfBase+lfTall+lfWall+lfShelf;
        const inst    = p.installation ?? parseFloat(ov.installation)||0;
        const pLF     = tot>0 ? inst/tot : 0;
        return [
          p.proj.quoteNum||"",
          p.proj.name||"",
          p.proj.date||"",
          p.proj.state||"",
          tot, lfBase, lfTall, lfWall, lfShelf,
          inst,
          tot>0 ? +pLF.toFixed(2) : "",
          lfBase>0  ? +(inst*(lfBase/tot)/lfBase).toFixed(2)  : "",
          lfTall>0  ? +(inst*(lfTall/tot)/lfTall).toFixed(2)  : "",
          lfWall>0  ? +(inst*(lfWall/tot)/lfWall).toFixed(2)  : "",
          lfShelf>0 ? +(inst*(lfShelf/tot)/lfShelf).toFixed(2): "",
          p.effPrice||0,
          tot>0 ? +((p.effPrice||0)/tot).toFixed(2) : "",
        ];
      });
      const lfSheet = XLSX.utils.aoa_to_sheet([lfHeaders, ...lfRows]);
      lfSheet["!cols"] = [14,28,12,8,10,10,10,10,10,12,12,10,10,10,10,16,14].map(w=>({wch:w}));
      for (let c2=0; c2<=lfHeaders.length-1; c2++) {
        const cell = lfSheet[XLSX.utils.encode_cell({r:0,c:c2})];
        if (cell) cell.s = { font:{bold:true,color:{rgb:"FFFFFF"}}, fill:{fgColor:{rgb:"3D3530"}} };
      }
      XLSX.utils.book_append_sheet(wb, lfSheet, "$/LF Analysis");
    }

    const filename = `og-pricing-export-${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    onClose();
  };

  const groups = [...new Set(EXPORT_COLUMNS.map(c=>c.group))];

  return (
    <div style={{
      position:"fixed",top:0,left:0,right:0,bottom:0,
      background:"rgba(10,8,6,0.6)",zIndex:600,
      display:"flex",alignItems:"flex-start",justifyContent:"center",
      padding:"40px 24px",overflowY:"auto",
    }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{
        background:C.parchment,width:"100%",maxWidth:780,
        padding:"40px 48px",position:"relative",
        boxShadow:"0 24px 64px rgba(0,0,0,0.3)",
      }}>
        <button onClick={onClose} style={{
          position:"absolute",top:16,right:20,
          background:"none",border:"none",fontSize:22,
          cursor:"pointer",color:C.stoneMd,lineHeight:1,
        }}>×</button>

        {/* Title */}
        <div style={{marginBottom:28,paddingBottom:20,borderBottom:`1px solid ${C.stone}`}}>
          <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
            textTransform:"uppercase",marginBottom:6}}>Owner View</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",
            fontSize:28,fontWeight:300,color:C.charcoal}}>Export to Spreadsheet</div>
          <div style={{fontSize:11,color:C.stoneDk,marginTop:6,letterSpacing:"0.04em",lineHeight:1.5}}>
            Choose which columns to include. Always exports a Room Detail sheet and a $/LF Analysis sheet (when LF data exists).
          </div>
        </div>

        {/* Filters */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:8,letterSpacing:"0.22em",color:C.stoneDk,
            textTransform:"uppercase",marginBottom:10}}>Filter Projects</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:12,alignItems:"end"}}>
            <div>
              <div style={{fontSize:9,color:C.stoneDk,letterSpacing:"0.1em",marginBottom:4}}>Status</div>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
                className="rs" style={{...sSt,width:"100%",fontSize:11}}>
                <option value="All">All Statuses</option>
                {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:9,color:C.stoneDk,letterSpacing:"0.1em",marginBottom:4}}>Date From</div>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                className="ri" style={{...iSt,fontSize:11,width:"100%"}}/>
            </div>
            <div>
              <div style={{fontSize:9,color:C.stoneDk,letterSpacing:"0.1em",marginBottom:4}}>Date To</div>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                className="ri" style={{...iSt,fontSize:11,width:"100%"}}/>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:8,
              fontSize:10,color:C.bark,cursor:"pointer",paddingBottom:2}}>
              <input type="checkbox" checked={incCOs} onChange={e=>setIncCOs(e.target.checked)}/>
              Include COs
            </label>
          </div>
          <div style={{marginTop:8,fontSize:10,color:C.clay,letterSpacing:"0.04em"}}>
            {filtered.length} project{filtered.length!==1?"s":""} will be exported
            {incCOs&&` · ${filtered.reduce((a,p)=>(savedChangeOrders?.[p.id]||[]).length+a,0)} change orders`}
          </div>
        </div>

        {/* Column picker */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:8,letterSpacing:"0.22em",color:C.stoneDk,
            textTransform:"uppercase",marginBottom:12}}>
            Columns to Include — Projects Sheet
          </div>
          {groups.map(group=>{
            const cols = EXPORT_COLUMNS.filter(c=>c.group===group);
            const allOn = cols.every(c=>selected.has(c.id));
            const someOn = cols.some(c=>selected.has(c.id));
            return(
              <div key={group} style={{marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                  <button onClick={()=>toggleGroup(group)} style={{
                    fontSize:8,letterSpacing:"0.16em",textTransform:"uppercase",
                    background: allOn?C.charcoal:someOn?"#8C7B6E":"transparent",
                    color: allOn||someOn?C.parchment:C.stoneDk,
                    border:`1px solid ${allOn?C.charcoal:C.stoneMd}`,
                    padding:"3px 10px",cursor:"pointer",
                    fontFamily:"'Jost',sans-serif",
                  }}>{group}</button>
                  <div style={{fontSize:9,color:C.stoneDk}}>
                    {cols.filter(c=>selected.has(c.id)).length}/{cols.length} selected
                  </div>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,paddingLeft:4}}>
                  {cols.map(col=>(
                    <button key={col.id} onClick={()=>toggle(col.id)} style={{
                      fontSize:9,padding:"5px 12px",cursor:"pointer",
                      border:`1px solid ${selected.has(col.id)?C.clay:C.stone}`,
                      background: selected.has(col.id)?"#F5F2E8":C.white,
                      color: selected.has(col.id)?C.bark:C.stoneDk,
                      fontFamily:"'Jost',sans-serif",letterSpacing:"0.04em",
                      fontWeight: selected.has(col.id)?500:400,
                    }}>{col.label}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          paddingTop:20,borderTop:`1px solid ${C.stone}`}}>
          <div style={{fontSize:10,color:C.stoneDk,letterSpacing:"0.04em"}}>
            {selected.size} column{selected.size!==1?"s":""} selected · {filtered.length} rows
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} style={{
              background:"transparent",border:`1px solid ${C.stone}`,
              color:C.stoneDk,padding:"9px 20px",cursor:"pointer",
              fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
              fontFamily:"'Jost',sans-serif",
            }}>Cancel</button>
            <button onClick={doExport} disabled={selected.size===0||filtered.length===0} style={{
              background: selected.size>0&&filtered.length>0 ? C.charcoal : C.stoneMd,
              color:C.parchment,border:"none",
              padding:"9px 28px",cursor: selected.size>0&&filtered.length>0 ? "pointer":"default",
              fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
              fontFamily:"'Jost',sans-serif",fontWeight:500,
            }}>⬇ Export .xlsx</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Owner View ─────────────────────────────────────────────────
function OwnerView({proj,cabNet,cabCust,overhead,design,shipping,
  installation,punchlist,incentive,salesTax,hardware,misc,accessories,
  totalCost,effPrice,profit,margin,netProfit,corpTax,floorPrice,gutCheck,marginOk,rooms,rc,
  ov,totalLF,
  savedProjects,setSavedProjects,savedChangeOrders,startNewCO,toggleProjectApproval,loadQuote,onDeleteProject,stateConfig}){
  const activeProjects = (savedProjects||[]).filter(p =>
    ["In Progress","Approved","Quoted"].includes(p.proj.status)
  );
  const removeProject = (id) => onDeleteProject ? onDeleteProject(id) : setSavedProjects(prev => prev.filter(p => p.id !== id));
  const [showExport, setShowExport] = useState(false);

  return(
    <div className="fade">

      {/* ── BILLABLE THIS MONTH ──────────────────────── */}
      {(()=>{
        const now = new Date();
        const thisMonth = `${now.getMonth()+1}/${now.getFullYear()}`;
        const inMonth = (dateStr) => {
          if (!dateStr) return false;
          const d = new Date(dateStr);
          return d.getMonth()+1 === now.getMonth()+1 && d.getFullYear() === now.getFullYear();
        };
        const approvedQuotes = (savedProjects||[]).filter(p =>
          p.quoteApproved && inMonth(p.quoteApprovedAt)
        );
        const approvedCOs = Object.values(savedChangeOrders||{})
          .flat()
          .filter(co => co.coApproved && inMonth(co.coApprovedAt));
        const quotesTotal = approvedQuotes.reduce((a,p)=>a+p.effPrice,0);
        const cosTotal    = approvedCOs.reduce((a,co)=>{
          const lines = co.lines||[];
          return a + lines.filter(l=>l.approved==="Approved").reduce((s,l)=>s+(parseFloat(l.amount)||0),0);
        },0);
        const billableTotal = quotesTotal + cosTotal;
        const hasBillable = approvedQuotes.length>0||approvedCOs.length>0;

        return(
          <div style={{marginBottom:48}}>
            {/* Section header */}
            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"baseline",marginBottom:16,paddingBottom:8,
              borderBottom:`1px solid ${C.stone}`}}>
              <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
                textTransform:"uppercase"}}>
                Billable — {now.toLocaleString("default",{month:"long"})} {now.getFullYear()}
              </div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",
                fontSize:22,fontWeight:300,color:C.charcoal,
                fontVariantNumeric:"tabular-nums"}}>
                {hasBillable ? fmt(billableTotal) : "Nothing approved yet"}
              </div>
            </div>

            {!hasBillable&&(
              <div style={{padding:"20px 24px",
                border:`1px dashed ${C.stone}`,
                fontSize:11,color:C.stoneMd,letterSpacing:"0.04em",textAlign:"center"}}>
                Mark quotes and change orders as Approved to track billable amounts here.
              </div>
            )}

            {/* Approved Quotes */}
            {approvedQuotes.length>0&&(
              <div style={{marginBottom:24}}>
                <div style={{fontSize:8,letterSpacing:"0.2em",color:C.moss,
                  textTransform:"uppercase",marginBottom:8,display:"flex",
                  alignItems:"center",gap:8}}>
                  <span style={{display:"inline-block",width:8,height:8,
                    borderRadius:"50%",background:C.moss}}/>
                  Approved Quotes — {fmt(quotesTotal)}
                </div>
                {approvedQuotes.map(p=>(
                  <div key={p.id} style={{
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"10px 16px",marginBottom:4,
                    background:"#EEF2EA",
                    borderLeft:`3px solid ${C.moss}`,
                  }}>
                    <div>
                      <div style={{fontSize:12,color:C.bark,fontWeight:400}}>{p.proj.name}</div>
                      <div style={{fontSize:9,color:C.stoneDk,marginTop:2,letterSpacing:"0.04em"}}>
                        {p.proj.quoteNum||"—"} · Approved {p.quoteApprovedAt} by {p.quoteApprovedBy}
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",
                        fontSize:18,color:C.charcoal,fontVariantNumeric:"tabular-nums"}}>
                        {fmt(p.effPrice)}
                      </div>
                      <div style={{fontSize:9,color:C.moss,letterSpacing:"0.06em",marginTop:2}}>
                        ✓ Quote Approved
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Approved COs */}
            {approvedCOs.length>0&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:8,letterSpacing:"0.2em",color:C.clay,
                  textTransform:"uppercase",marginBottom:8,display:"flex",
                  alignItems:"center",gap:8}}>
                  <span style={{display:"inline-block",width:8,height:8,
                    borderRadius:"50%",background:C.clay}}/>
                  Approved Change Orders — {fmt(cosTotal)}
                </div>
                {approvedCOs.map(co=>{
                  const coAmt = (co.lines||[])
                    .filter(l=>l.approved==="Approved")
                    .reduce((a,l)=>a+(parseFloat(l.amount)||0),0);
                  const projSnap = co.projectSnap;
                  return(
                    <div key={co.coId} style={{
                      display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"10px 16px",marginBottom:4,
                      background:"#F5F0E4",
                      borderLeft:`3px solid ${C.clay}`,
                    }}>
                      <div>
                        <div style={{fontSize:12,color:C.bark,fontWeight:400}}>
                          {projSnap?.proj?.name||"Unknown Project"}
                        </div>
                        <div style={{fontSize:9,color:C.stoneDk,marginTop:2,letterSpacing:"0.04em"}}>
                          {projSnap?.proj?.quoteNum
                            ? `${projSnap.proj.quoteNum}_CO${co.coNum}`
                            : `CO${co.coNum}`}
                          {" · Approved "}{co.coApprovedAt}{" by "}{co.coApprovedBy}
                        </div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontFamily:"'Cormorant Garamond',serif",
                          fontSize:18,color:C.charcoal,fontVariantNumeric:"tabular-nums"}}>
                          {fmt(coAmt)}
                        </div>
                        <div style={{fontSize:9,color:C.clay,letterSpacing:"0.06em",marginTop:2}}>
                          ✓ CO Approved
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Billable total bar */}
            {hasBillable&&(
              <div style={{
                display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"16px 20px",
                background:C.charcoal,
                marginTop:8,
              }}>
                <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
                  textTransform:"uppercase"}}>
                  Total Billable This Month
                </div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",
                  fontSize:28,fontWeight:300,color:C.parchment,
                  fontVariantNumeric:"tabular-nums"}}>
                  {fmt(billableTotal)}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── ALL CURRENT PROJECTS ──────────────────────── */}
      {savedProjects&&savedProjects.length>0&&(()=>{
        // Sort + filter
        const statuses = ["All",...new Set((savedProjects||[]).map(p=>p.proj.status))];
        const filtered = (savedProjects||[]).filter(p =>
          projStatusFilter==="All" || p.proj.status===projStatusFilter
        );
        const sortFns = {
          name:    (a,b)=>(a.proj.name||"").localeCompare(b.proj.name||""),
          status:  (a,b)=>(a.proj.status||"").localeCompare(b.proj.status||""),
          vendor:  (a,b)=>(a.proj.vendor||"").localeCompare(b.proj.vendor||""),
          price:   (a,b)=>(a.effPrice||0)-(b.effPrice||0),
          cost:    (a,b)=>(a.totalCost||0)-(b.totalCost||0),
          profit:  (a,b)=>(a.profit||0)-(b.profit||0),
          margin:  (a,b)=>(a.margin||0)-(b.margin||0),
          savedAt: (a,b)=>new Date(a.savedAt||0)-new Date(b.savedAt||0),
        };
        const sorted = [...filtered].sort((a,b)=>{
          const r = (sortFns[projSortCol]||sortFns.savedAt)(a,b);
          return projSortDir==="asc"?r:-r;
        });
        const toggleSort = (col) => {
          if (projSortCol===col) setProjSortDir(d=>d==="asc"?"desc":"asc");
          else { setProjSortCol(col); setProjSortDir("desc"); }
        };
        const SortHdr = ({col,label,right}) => (
          <div onClick={()=>toggleSort(col)}
            style={{fontSize:8,letterSpacing:"0.16em",color:projSortCol===col?C.bark:C.stoneDk,
              textTransform:"uppercase",textAlign:right?"right":"left",
              cursor:"pointer",userSelect:"none",
              display:"flex",alignItems:"center",gap:4,
              justifyContent:right?"flex-end":"flex-start",
            }}>
            {label}
            <span style={{fontSize:9,opacity:projSortCol===col?1:0.3}}>
              {projSortCol===col ? (projSortDir==="asc"?"↑":"↓") : "↕"}
            </span>
          </div>
        );

        return(
        <div style={{marginBottom:48}}>
          {/* Header row */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${C.stone}`}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
                textTransform:"uppercase"}}>All Projects</div>
              {/* Status filter pills */}
              <div style={{display:"flex",gap:4}}>
                {statuses.map(st=>{
                  const sc2=STATUS_CONFIG[st]||{bg:C.stone,color:C.bark};
                  const active=projStatusFilter===st;
                  return(
                    <button key={st} onClick={()=>setProjStatusFilter(st)} style={{
                      fontSize:8,letterSpacing:"0.1em",textTransform:"uppercase",
                      fontFamily:"'Jost',sans-serif",cursor:"pointer",
                      padding:"3px 10px",
                      background: active?(st==="All"?C.charcoal:sc2.bg):"transparent",
                      color: active?(st==="All"?C.parchment:sc2.color):C.stoneDk,
                      border:`1px solid ${active?(st==="All"?C.charcoal:sc2.color+"88"):C.stone}`,
                    }}>{st}</button>
                  );
                })}
              </div>
            </div>
            <button onClick={()=>setShowExport(true)} style={{
              background:C.charcoal,color:C.parchment,border:"none",
              padding:"7px 18px",cursor:"pointer",
              fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
              fontFamily:"'Jost',sans-serif",fontWeight:500,
              display:"flex",alignItems:"center",gap:6,
            }}>
              <span style={{fontSize:12,lineHeight:1}}>⬇</span> Export to Spreadsheet
            </button>
          </div>

          {/* Sortable column headers */}
          <div style={{display:"grid",
            gridTemplateColumns:"2fr 0.8fr 1fr 1fr 1fr 1fr 1fr 24px",
            gap:12,paddingBottom:8,borderBottom:`1px solid ${C.stone}`,marginBottom:4}}>
            <SortHdr col="name"   label="Project"/>
            <SortHdr col="status" label="Status"/>
            <SortHdr col="vendor" label="Vendor"/>
            <SortHdr col="price"  label="Price"  right/>
            <SortHdr col="cost"   label="Cost"   right/>
            <SortHdr col="profit" label="Profit" right/>
            <SortHdr col="margin" label="Margin" right/>
            <div/>
          </div>

          {sorted.length===0&&(
            <div style={{padding:"24px",textAlign:"center",
              fontSize:11,color:C.stoneMd,letterSpacing:"0.04em",
              border:`1px dashed ${C.stone}`}}>
              No projects match "{projStatusFilter}" status
            </div>
          )}

          {sorted.map((p,i)=>{
            const mOk = p.margin >= 0.20;
            const sc = STATUS_CONFIG[p.proj.status]||{bg:C.stone,color:C.bark};
            const isLost = p.proj.status==="Lost";
            return(
              <div key={p.id} style={{display:"grid",
                gridTemplateColumns:"2fr 0.8fr 1fr 1fr 1fr 1fr 1fr 24px",
                gap:12,padding:"10px 0",
                borderBottom:`1px solid ${C.parchmentDk}`,alignItems:"center",
                background:isLost?"#FAF5F4":i%2===0?"transparent":"transparent",
                opacity:isLost?0.75:1,
              }}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{fontSize:13,color:isLost?C.stoneDk:C.bark,fontWeight:400,
                      textDecoration:isLost?"line-through":"none"}}>{p.proj.name}</div>
                    {(savedChangeOrders[p.id]||[]).length>0&&(
                      <span style={{fontSize:8,letterSpacing:"0.1em",color:C.clay,
                        background:"#F2EAD8",padding:"2px 7px",fontWeight:500}}>
                        {(savedChangeOrders[p.id]||[]).length} CO
                      </span>
                    )}
                    {p.proj.milestones&&Object.values(p.proj.milestones).filter(Boolean).length>0&&(
                      <span style={{fontSize:8,color:C.moss,letterSpacing:"0.06em"}}>
                        {Object.values(p.proj.milestones).filter(Boolean).length}/6
                      </span>
                    )}
                  </div>
                  <div style={{fontSize:9,color:C.stoneDk,marginTop:2,letterSpacing:"0.04em"}}>
                    {p.proj.quoteNum||"—"} · {p.proj.state} · {p.savedAt}
                  </div>
                  {isLost&&p.proj.lostReason&&(
                    <div style={{fontSize:9,color:"#6B4A44",marginTop:2,
                      letterSpacing:"0.04em",fontStyle:"italic"}}>
                      Lost: {p.proj.lostReason}
                    </div>
                  )}
                  {!isLost&&p.proj.followUpDate&&(()=>{
                    const overdue = new Date(p.proj.followUpDate) < new Date();
                    return(
                      <div style={{fontSize:9,marginTop:2,letterSpacing:"0.04em",
                        color:overdue?C.rust:C.stoneDk}}>
                        {overdue?"⚠ Follow-up overdue · ":"Follow up · "}{p.proj.followUpDate}
                      </div>
                    );
                  })()}
                  {p.proj.status==="Complete"&&p.proj.difficultyRating&&(
                    <div style={{fontSize:9,color:C.clay,marginTop:2}}>
                      {"★".repeat(parseInt(p.proj.difficultyRating))}{"☆".repeat(5-parseInt(p.proj.difficultyRating))}
                      <span style={{marginLeft:4,letterSpacing:"0.04em"}}>
                        {["","Easy","Moderate","Challenging","Difficult","Very Difficult"][parseInt(p.proj.difficultyRating)]}
                      </span>
                    </div>
                  )}
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
                  fontSize:14,color:isLost?C.stoneDk:C.charcoal,fontVariantNumeric:"tabular-nums"}}>
                  {fmt(p.effPrice)}
                </div>
                <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
                  fontSize:14,color:C.rust,fontVariantNumeric:"tabular-nums"}}>
                  {fmt(p.totalCost)}
                </div>
                <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
                  fontSize:14,color:isLost?C.stoneDk:p.profit>=0?C.moss:C.rust,
                  fontVariantNumeric:"tabular-nums"}}>
                  {isLost?"—":fmt(p.profit)}
                </div>
                <div style={{textAlign:"right",fontSize:12,fontWeight:500,
                  color:isLost?C.stoneDk:mOk?C.moss:C.rust,letterSpacing:"0.04em"}}>
                  {isLost?"—":fmtPct(p.margin)}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
                  <button onClick={()=>loadQuote(p)} style={{
                    background:"transparent",border:`1px solid ${C.stoneMd}`,
                    color:C.bark,padding:"4px 10px",cursor:"pointer",
                    fontSize:7,letterSpacing:"0.16em",textTransform:"uppercase",
                    fontFamily:"'Jost',sans-serif",fontWeight:500,whiteSpace:"nowrap",
                  }}>✎ Edit</button>
                  {!isLost&&<button onClick={()=>startNewCO(p)} style={{
                    background:C.charcoal,color:C.parchment,border:"none",
                    padding:"4px 10px",cursor:"pointer",
                    fontSize:7,letterSpacing:"0.16em",textTransform:"uppercase",
                    fontFamily:"'Jost',sans-serif",fontWeight:500,whiteSpace:"nowrap",
                  }}>+ CO</button>}
                  <button onClick={()=>removeProject(p.id)} style={{
                    background:"none",border:"none",color:C.stoneMd,
                    fontSize:13,cursor:"pointer",padding:"0 2px",lineHeight:1,opacity:0.5,
                  }}>×</button>
                </div>
              </div>
            );
          })}

          {/* Pipeline totals — exclude Lost */}
          {(()=>{
            const live = sorted.filter(p=>p.proj.status!=="Lost");
            return live.length>0&&(
              <div style={{display:"grid",
                gridTemplateColumns:"2fr 0.8fr 1fr 1fr 1fr 1fr 1fr 24px",
                gap:12,paddingTop:12,marginTop:4,
                borderTop:`2px solid ${C.charcoal}`}}>
                <div style={{fontSize:9,letterSpacing:"0.2em",textTransform:"uppercase",
                  color:C.bark,fontWeight:500,gridColumn:"1/4"}}>
                  {live.length} project{live.length!==1?"s":""} · pipeline total
                  {filtered.length>live.length&&<span style={{color:C.stoneDk,fontWeight:300,marginLeft:6}}>
                    ({filtered.length-live.length} lost not included)
                  </span>}
                </div>
                <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
                  fontSize:15,color:C.charcoal,fontVariantNumeric:"tabular-nums",fontWeight:400}}>
                  {fmt(live.reduce((a,p)=>a+p.effPrice,0))}
                </div>
                <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
                  fontSize:15,color:C.rust,fontVariantNumeric:"tabular-nums"}}>
                  {fmt(live.reduce((a,p)=>a+p.totalCost,0))}
                </div>
                <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
                  fontSize:15,color:C.moss,fontVariantNumeric:"tabular-nums"}}>
                  {fmt(live.reduce((a,p)=>a+p.profit,0))}
                </div>
                <div/>
                <div/>
              </div>
            );
          })()}
        </div>
        );
      })()}

      {savedProjects&&savedProjects.length===0&&(
        <div style={{marginBottom:48,padding:"28px 24px",
          background:C.white,border:`1px solid ${C.stone}`,
          textAlign:"center",color:C.stoneDk,fontSize:12,letterSpacing:"0.06em"}}>
          No projects saved yet — build a quote and click Save Project to track it here.
        </div>
      )}

      <HR/>

      {/* ── TRENDS & COMPARABLES ──────────────────────────── */}
      {(savedProjects||[]).length >= 2 && (()=>{
        const all = (savedProjects||[]).filter(p=>p.proj.status!=="Lost");
        const withLF = all.filter(p=>{
          const ov=p.ov||{};
          return (parseFloat(ov.lfBase)||0)+(parseFloat(ov.lfTall)||0)+(parseFloat(ov.lfWall)||0)+(parseFloat(ov.lfShelf)||0)>0;
        });

        // By-state margin averages
        const byState = {};
        all.forEach(p=>{
          const st=p.proj.state||"?";
          if (!byState[st]) byState[st]={sum:0,cnt:0,rev:0};
          byState[st].sum += p.margin||0;
          byState[st].cnt++;
          byState[st].rev += p.effPrice||0;
        });

        // By-vendor margin averages
        const byVendor = {};
        all.forEach(p=>{
          const v=p.proj.vendor||"?";
          if (!byVendor[v]) byVendor[v]={sum:0,cnt:0};
          byVendor[v].sum += p.margin||0;
          byVendor[v].cnt++;
        });

        // Overall stats
        const avgMargin = all.reduce((a,p)=>a+(p.margin||0),0)/all.length;
        const avgPrice  = all.reduce((a,p)=>a+(p.effPrice||0),0)/all.length;
        const avgPerLF  = withLF.length>0 ? withLF.reduce((a,p)=>{
          const ov=p.ov||{};
          const tot=(parseFloat(ov.lfBase)||0)+(parseFloat(ov.lfTall)||0)+(parseFloat(ov.lfWall)||0)+(parseFloat(ov.lfShelf)||0);
          return a + (tot>0?(p.effPrice||0)/tot:0);
        },0)/withLF.length : 0;

        // Comparable projects to current quote in builder
        const comparables = proj.name ? all
          .filter(p=>p.id !== (proj.stableId||proj.quoteNum||proj.name.toLowerCase().replace(/\s+/g,"-")))
          .map(p=>{
            let score=0;
            if (p.proj.state===proj.state) score+=3;
            if (p.proj.vendor===proj.vendor) score+=2;
            const priceDiff = Math.abs((p.effPrice||0)-(effPrice||0))/(effPrice||1);
            if (priceDiff<0.2) score+=3;
            else if (priceDiff<0.4) score+=1;
            const ov2=p.ov||{};
            const pLF2=(parseFloat(ov2.lfBase)||0)+(parseFloat(ov2.lfTall)||0)+(parseFloat(ov2.lfWall)||0)+(parseFloat(ov2.lfShelf)||0);
            const lfDiff=Math.abs(pLF2-totalLF)/(totalLF||1);
            if (totalLF>0&&lfDiff<0.25) score+=2;
            return {...p,_score:score};
          })
          .filter(p=>p._score>1)
          .sort((a,b)=>b._score-a._score)
          .slice(0,5)
        : [];

        return(
          <div style={{marginBottom:48}}>
            <OTtl>Trends &amp; Intelligence</OTtl>

            {/* KPI row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",
              gap:"1px",background:C.stone,border:`1px solid ${C.stone}`,marginBottom:28}}>
              {[
                ["Avg Margin", fmtPct(avgMargin), avgMargin>=0.2?C.moss:C.rust],
                ["Avg Job Size", fmt(avgPrice), C.bark],
                ["Avg $/LF", withLF.length>0?`$${Math.round(avgPerLF)}/LF`:"no LF data", C.bark],
                ["Jobs Tracked", String(all.length), C.bark],
              ].map(([lbl,val,color])=>(
                <div key={lbl} style={{background:C.white,padding:"18px 20px"}}>
                  <div style={{fontSize:8,letterSpacing:"0.18em",color:C.stoneDk,
                    textTransform:"uppercase",marginBottom:6}}>{lbl}</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",
                    fontSize:22,fontWeight:300,color,
                    fontVariantNumeric:"tabular-nums"}}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:32,marginBottom:28}}>
              {/* By state */}
              <div>
                <div style={{fontSize:8,letterSpacing:"0.18em",color:C.stoneDk,
                  textTransform:"uppercase",marginBottom:10}}>Avg Margin by State</div>
                {Object.entries(byState).sort((a,b)=>b[1].cnt-a[1].cnt).map(([st,d])=>{
                  const avg=d.sum/d.cnt;
                  return(
                    <div key={st} style={{display:"flex",alignItems:"center",
                      gap:10,marginBottom:8}}>
                      <div style={{width:28,fontSize:9,fontWeight:500,color:C.bark,
                        letterSpacing:"0.1em"}}>{st}</div>
                      <div style={{flex:1,height:6,background:C.parchmentDk,position:"relative"}}>
                        <div style={{
                          position:"absolute",left:0,top:0,bottom:0,
                          width:`${Math.min(avg*100/0.5*100,100)}%`,
                          background:avg>=0.2?C.moss:C.rust,
                          transition:"width 0.3s",
                        }}/>
                      </div>
                      <div style={{width:44,textAlign:"right",fontSize:10,
                        color:avg>=0.2?C.moss:C.rust,fontWeight:500}}>
                        {fmtPct(avg)}
                      </div>
                      <div style={{width:36,textAlign:"right",fontSize:9,color:C.stoneDk}}>
                        {d.cnt} job{d.cnt!==1?"s":""}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* By vendor */}
              <div>
                <div style={{fontSize:8,letterSpacing:"0.18em",color:C.stoneDk,
                  textTransform:"uppercase",marginBottom:10}}>Avg Margin by Vendor</div>
                {Object.entries(byVendor).sort((a,b)=>b[1].cnt-a[1].cnt).map(([v,d])=>{
                  const avg=d.sum/d.cnt;
                  return(
                    <div key={v} style={{display:"flex",alignItems:"center",
                      gap:10,marginBottom:8}}>
                      <div style={{width:80,fontSize:9,color:C.bark,
                        overflow:"hidden",textOverflow:"ellipsis",
                        whiteSpace:"nowrap"}}>{v}</div>
                      <div style={{flex:1,height:6,background:C.parchmentDk,position:"relative"}}>
                        <div style={{
                          position:"absolute",left:0,top:0,bottom:0,
                          width:`${Math.min(avg*100/0.5*100,100)}%`,
                          background:avg>=0.2?C.moss:C.rust,
                          transition:"width 0.3s",
                        }}/>
                      </div>
                      <div style={{width:44,textAlign:"right",fontSize:10,
                        color:avg>=0.2?C.moss:C.rust,fontWeight:500}}>
                        {fmtPct(avg)}
                      </div>
                      <div style={{width:36,textAlign:"right",fontSize:9,color:C.stoneDk}}>
                        {d.cnt} job{d.cnt!==1?"s":""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>


            {/* Win / Loss Funnel */}
            {(()=>{
              const won   = all.filter(p=>p.proj.status==="Approved"||p.proj.status==="Complete");
              const lost  = all.filter(p=>p.proj.status==="Lost");
              const total = won.length + lost.length;
              if (total < 2) return null;
              const winRate = total>0 ? won.length/total : 0;
              const byStateFunnel = {};
              [...won,...lost].forEach(p=>{
                const st=p.proj.state||"?";
                if(!byStateFunnel[st]) byStateFunnel[st]={won:0,lost:0};
                if(p.proj.status==="Lost") byStateFunnel[st].lost++;
                else byStateFunnel[st].won++;
              });
              const brackets=[["<$20k",0,20000],["$20-50k",20000,50000],["$50-100k",50000,100000],[">$100k",100000,Infinity]];
              const byBracket={};
              brackets.forEach(([lbl])=>byBracket[lbl]={won:0,lost:0});
              [...won,...lost].forEach(p=>{
                const price=p.effPrice||0;
                const b=brackets.find(([,lo,hi])=>price>=lo&&price<hi);
                if(b){ if(p.proj.status==="Lost") byBracket[b[0]].lost++; else byBracket[b[0]].won++; }
              });
              return(
                <div style={{marginBottom:28}}>
                  <div style={{fontSize:8,letterSpacing:"0.18em",color:C.stoneDk,
                    textTransform:"uppercase",marginBottom:10}}>Win / Loss Analysis</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                    <div style={{background:C.white,padding:"16px 18px",border:`1px solid ${C.stone}`}}>
                      <div style={{fontSize:8,letterSpacing:"0.14em",color:C.stoneDk,
                        textTransform:"uppercase",marginBottom:10}}>Overall Win Rate</div>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",
                        fontSize:28,fontWeight:300,
                        color:winRate>=0.6?C.moss:winRate>=0.4?C.clay:C.rust,
                        fontVariantNumeric:"tabular-nums"}}>{fmtPct(winRate)}</div>
                      <div style={{fontSize:9,color:C.stoneDk,marginTop:4,letterSpacing:"0.04em"}}>
                        {won.length} won · {lost.length} lost
                      </div>
                      <div style={{marginTop:10,height:6,background:C.parchmentDk,position:"relative"}}>
                        <div style={{position:"absolute",left:0,top:0,bottom:0,
                          width:`${winRate*100}%`,
                          background:winRate>=0.6?C.moss:winRate>=0.4?C.clay:C.rust}}/>
                      </div>
                    </div>
                    <div style={{background:C.white,padding:"16px 18px",border:`1px solid ${C.stone}`}}>
                      <div style={{fontSize:8,letterSpacing:"0.14em",color:C.stoneDk,
                        textTransform:"uppercase",marginBottom:10}}>Win Rate by State</div>
                      {Object.entries(byStateFunnel).sort((a,b)=>(b[1].won+b[1].lost)-(a[1].won+a[1].lost)).map(([st,d])=>{
                        const tot=d.won+d.lost;
                        const wr=tot>0?d.won/tot:0;
                        return(
                          <div key={st} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                            <div style={{width:24,fontSize:9,fontWeight:500,color:C.bark}}>{st}</div>
                            <div style={{flex:1,height:5,background:C.parchmentDk,position:"relative"}}>
                              <div style={{position:"absolute",left:0,top:0,bottom:0,
                                width:`${wr*100}%`,
                                background:wr>=0.6?C.moss:wr>=0.4?C.clay:C.rust}}/>
                            </div>
                            <div style={{fontSize:9,fontWeight:500,width:36,textAlign:"right",
                              color:wr>=0.6?C.moss:wr>=0.4?C.clay:C.rust}}>{fmtPct(wr)}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{background:C.white,padding:"16px 18px",border:`1px solid ${C.stone}`}}>
                      <div style={{fontSize:8,letterSpacing:"0.14em",color:C.stoneDk,
                        textTransform:"uppercase",marginBottom:10}}>Win Rate by Job Size</div>
                      {brackets.map(([lbl])=>{
                        const d=byBracket[lbl];
                        const tot=d.won+d.lost;
                        if(!tot) return null;
                        const wr=d.won/tot;
                        return(
                          <div key={lbl} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                            <div style={{width:52,fontSize:9,color:C.bark}}>{lbl}</div>
                            <div style={{flex:1,height:5,background:C.parchmentDk,position:"relative"}}>
                              <div style={{position:"absolute",left:0,top:0,bottom:0,
                                width:`${wr*100}%`,
                                background:wr>=0.6?C.moss:wr>=0.4?C.clay:C.rust}}/>
                            </div>
                            <div style={{fontSize:9,fontWeight:500,width:36,textAlign:"right",
                              color:wr>=0.6?C.moss:wr>=0.4?C.clay:C.rust}}>{fmtPct(wr)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Seasonal Patterns */}
            {(()=>{
              const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              const byMonth=Array(12).fill(null).map(()=>({cnt:0,margin:0,revenue:0}));
              all.forEach(p=>{
                const d=new Date(p.proj.date||p.savedAt||"");
                if(isNaN(d.getTime())) return;
                const m=d.getMonth();
                byMonth[m].cnt++;
                byMonth[m].margin+=p.margin||0;
                byMonth[m].revenue+=p.effPrice||0;
              });
              const hasData=byMonth.some(m=>m.cnt>0);
              if(!hasData) return null;
              const maxRev=Math.max(...byMonth.map(m=>m.revenue),1);
              return(
                <div style={{marginBottom:28}}>
                  <div style={{fontSize:8,letterSpacing:"0.18em",color:C.stoneDk,
                    textTransform:"uppercase",marginBottom:10}}>Seasonal Patterns</div>
                  <div style={{background:C.white,border:`1px solid ${C.stone}`,padding:"20px 18px"}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:4,alignItems:"end",height:90}}>
                      {byMonth.map((m,i)=>{
                        const h=maxRev>0?Math.max((m.revenue/maxRev)*70,m.cnt>0?8:0):0;
                        const avgMarg=m.cnt>0?m.margin/m.cnt:0;
                        return(
                          <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                            <div style={{fontSize:7,color:m.cnt>0?C.clay:C.stone,fontWeight:500}}>
                              {m.cnt>0?m.cnt:""}
                            </div>
                            <div style={{width:"100%",height:h||2,
                              background:m.cnt>0?(avgMarg>=0.2?C.moss:avgMarg>=0.15?C.clay:C.rust):C.parchmentDk,
                              transition:"height 0.3s",
                            }}/>
                            <div style={{fontSize:7,color:C.stoneDk}}>{MONTHS[i]}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{marginTop:8,fontSize:9,color:C.stoneDk,letterSpacing:"0.04em"}}>
                      Bar height = revenue volume · Color = avg margin (green ≥20%, amber 15-20%, red &lt;15%) · Number = job count
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Comparable projects */}
            {proj.name&&(
              <div>
                <div style={{fontSize:8,letterSpacing:"0.18em",color:C.stoneDk,
                  textTransform:"uppercase",marginBottom:10}}>
                  Comparable Past Projects — {proj.name} ({fmt(effPrice)}{totalLF>0?`, ${totalLF} LF`:""})
                </div>
                {comparables.length===0?(
                  <div style={{padding:"16px 20px",border:`1px dashed ${C.stone}`,
                    fontSize:11,color:C.stoneMd,letterSpacing:"0.04em"}}>
                    Not enough similar past jobs yet — comparables will appear as your project history grows.
                  </div>
                ):(
                  <div style={{border:`1px solid ${C.stone}`}}>
                    <div style={{display:"grid",
                      gridTemplateColumns:"2fr 0.6fr 0.7fr 0.8fr 0.8fr 0.8fr 0.7fr",
                      gap:12,padding:"8px 16px",
                      background:C.parchmentDk,
                      borderBottom:`1px solid ${C.stone}`}}>
                      {["Project","State","Vendor","Price","Margin","$/LF","LF"].map((h,i)=>(
                        <div key={i} style={{fontSize:8,letterSpacing:"0.14em",color:C.stoneDk,
                          textTransform:"uppercase",textAlign:i>=3?"right":"left"}}>{h}</div>
                      ))}
                    </div>
                    {comparables.map((p,i)=>{
                      const ov2=p.ov||{};
                      const pLF2=(parseFloat(ov2.lfBase)||0)+(parseFloat(ov2.lfTall)||0)+(parseFloat(ov2.lfWall)||0)+(parseFloat(ov2.lfShelf)||0);
                      const perLF2=pLF2>0?Math.round((p.effPrice||0)/pLF2):null;
                      return(
                        <div key={p.id} style={{display:"grid",
                          gridTemplateColumns:"2fr 0.6fr 0.7fr 0.8fr 0.8fr 0.8fr 0.7fr",
                          gap:12,padding:"10px 16px",
                          borderBottom:i<comparables.length-1?`1px solid ${C.parchmentDk}`:"none",
                          alignItems:"center",
                          background:i%2===0?"transparent":C.white,
                        }}>
                          <div>
                            <div style={{fontSize:12,color:C.bark}}>{p.proj.name}</div>
                            <div style={{fontSize:9,color:C.stoneDk,marginTop:1,letterSpacing:"0.04em"}}>
                              {p.proj.quoteNum||"—"} · {p.savedAt}
                            </div>
                          </div>
                          <div style={{fontSize:10,color:C.stoneDk}}>{p.proj.state}</div>
                          <div style={{fontSize:10,color:C.stoneDk,
                            overflow:"hidden",textOverflow:"ellipsis",
                            whiteSpace:"nowrap"}}>{p.proj.vendor}</div>
                          <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
                            fontSize:13,color:C.charcoal,fontVariantNumeric:"tabular-nums"}}>
                            {fmt(p.effPrice)}
                          </div>
                          <div style={{textAlign:"right",fontSize:11,fontWeight:500,
                            color:p.margin>=0.2?C.moss:C.rust}}>
                            {fmtPct(p.margin)}
                          </div>
                          <div style={{textAlign:"right",fontSize:11,color:C.clay,
                            fontVariantNumeric:"tabular-nums"}}>
                            {perLF2?`$${perLF2}/LF`:"—"}
                          </div>
                          <div style={{textAlign:"right",fontSize:10,color:C.stoneDk}}>
                            {pLF2>0?`${pLF2} LF`:"—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

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
            ["Punchlist Reserve (4%)",  punchlist,    "4% of net"],
            ["Employee Incentive (4%)", incentive,    "Employee incentive plan"],
            ["Sales Tax to Remit",      salesTax,     stateConfig[proj.state]?.label ?? "of net"],
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

          {/* Installation + LF breakdown */}
          <div style={{padding:"12px 0",borderBottom:`1px solid ${C.parchmentDk}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
              <div>
                <div style={{fontSize:12,color:C.bark}}>Installation</div>
                <div style={{fontSize:9,color:C.stoneDk,letterSpacing:"0.06em",marginTop:1}}>
                  {(stateConfig[proj.state]?.install*100||15).toFixed(0)}% of customer
                  {totalLF>0&&<span style={{marginLeft:8,color:C.clay}}>
                    · ${Math.round(installation/totalLF)}/LF blended · {totalLF} LF total
                  </span>}
                </div>
              </div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",
                fontSize:15,color:C.bark,fontVariantNumeric:"tabular-nums",marginLeft:16,flexShrink:0}}>
                {fmt(installation)}
              </div>
            </div>
            {totalLF>0&&(
              <div style={{
                display:"grid",
                gridTemplateColumns:"repeat(4,1fr)",
                gap:8,padding:"12px 14px",
                background:C.parchmentDk,
              }}>
                {[
                  ["Base",    ov?.lfBase,  "Base Cabinets"],
                  ["Tall",    ov?.lfTall,  "Tall Cabinets"],
                  ["Wall",    ov?.lfWall,  "Wall Cabinets"],
                  ["Shelves", ov?.lfShelf, "Floating Shelves"],
                ].map(([short,lf,full])=>{
                  const lfNum = parseFloat(lf)||0;
                  const pctLF = totalLF>0 ? lfNum/totalLF : 0;
                  const instAmt = installation * pctLF;
                  const perLF = lfNum>0 ? Math.round(instAmt/lfNum) : 0;
                  return(
                    <div key={short} style={{textAlign:"center"}}>
                      <div style={{fontSize:8,letterSpacing:"0.14em",color:C.stoneDk,
                        textTransform:"uppercase",marginBottom:4}}>{full}</div>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",
                        fontSize:18,color:C.charcoal,fontVariantNumeric:"tabular-nums",
                        lineHeight:1}}>
                        {lfNum>0 ? `${lfNum} LF` : "—"}
                      </div>
                      {lfNum>0&&(
                        <>
                          <div style={{fontSize:10,color:C.clay,marginTop:4,
                            fontVariantNumeric:"tabular-nums"}}>
                            {fmt(instAmt)}
                          </div>
                          <div style={{fontSize:9,color:C.stoneDk,marginTop:2,
                            letterSpacing:"0.04em"}}>
                            ${perLF}/LF
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {totalLF===0&&(
              <div style={{fontSize:9,color:C.stoneMd,letterSpacing:"0.06em",
                fontStyle:"italic"}}>
                Enter linear footage in Quote Builder to see $/LF breakdown
              </div>
            )}
          </div>
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

      {/* Export modal */}
      {showExport&&(
        <ExportModal
          savedProjects={savedProjects}
          savedChangeOrders={savedChangeOrders}
          vendorConfig={vendorConfig}
          onClose={()=>setShowExport(false)}
        />
      )}
    </div>
  );
}

function QuoteApproveBtn({savedProjects, projId, toggleProjectApproval}) {
  // Find by exact match or prefix match
  const sp = savedProjects.find(p => p.id === projId ||
    p.id.startsWith(projId.split("_")[0]));
  const approved = sp?.quoteApproved;
  return(
    <button onClick={()=>sp&&toggleProjectApproval(sp.id)}
      disabled={!sp}
      style={{
        marginTop:20,
        background: approved?"#3D4A35":"transparent",
        border:`1px solid ${approved?"#3D4A35":"#6B5540"}`,
        color: approved?"#F5F0E8":"#D8CFBC",
        padding:"9px 20px",cursor:sp?"pointer":"default",
        fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
        fontFamily:"'Jost',sans-serif",fontWeight:500,
        display:"flex",alignItems:"center",gap:8,
        transition:"all 0.2s",
      }}>
      <span style={{fontSize:12}}>{approved?"✓":"○"}</span>
      {approved ? `Approved ${sp.quoteApprovedAt}` : "Mark Quote Approved"}
    </button>
  );
}

function COApproveBtn({savedChangeOrders, projectId, coId, toggleCOApproval}) {
  const savedCO = (savedChangeOrders[projectId]||[]).find(c=>c.coId===coId);
  const approved = savedCO?.coApproved;
  return(
    <button
      onClick={()=>savedCO&&toggleCOApproval(projectId,coId)}
      disabled={!savedCO}
      style={{
        background: approved?"#3D4A35":"transparent",
        border:`1px solid ${approved?"#3D4A35":"#6B5540"}`,
        color: approved?"#F5F0E8":"#18100A",
        padding:"10px 28px",cursor:savedCO?"pointer":"default",
        fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
        fontFamily:"'Jost',sans-serif",fontWeight:500,
        display:"flex",alignItems:"center",gap:8,
        transition:"all 0.2s",
      }}>
      <span style={{fontSize:12}}>{approved?"✓":"○"}</span>
      {approved ? `CO Approved — ${savedCO.coApprovedAt}` : "Mark Change Order Approved"}
      {!savedCO&&<span style={{fontSize:9,color:"#6B5540",marginLeft:4}}>(save first)</span>}
    </button>
  );
}

// ── Monday.com Push Modal ──────────────────────────────────────
function MondayPushModal({ modal, onClose }) {
  const [boardSearch, setBoardSearch] = useState(modal.data.name||"");
  const [step, setStep]               = useState("board"); // "board" | "pushing" | "done" | "error"
  const [boards, setBoards]           = useState([]);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [resultMsg, setResultMsg]     = useState("");
  const [errorMsg, setErrorMsg]       = useState("");

  const { type, data } = modal;
  const itemTitle = type==="quote"
    ? `${data.quoteNum} — ${data.name}`
    : `${data.coNum} — ${data.name}`;

  const searchBoards = async () => {
    if (!boardSearch.trim()) return;
    setLoadingBoards(true);
    setBoards([]);
    setSelectedBoard(null);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system: "You are a Monday.com assistant. Use the monday MCP tool to search for boards. Return ONLY a JSON array of objects with {id, name} for boards matching the search. No markdown, no explanation.",
          messages:[{role:"user",content:`Search Monday.com boards for: "${boardSearch}". Return matching boards as JSON array [{id, name}].`}],
          mcp_servers:[{type:"url",url:"https://mcp.monday.com/mcp",name:"monday-mcp"}],
        })
      });
      const json = await resp.json();
      const text = (json.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      try {
        const clean = text.replace(/```json|```/g,"").trim();
        const parsed = JSON.parse(clean);
        const arr = Array.isArray(parsed) ? parsed : (parsed.boards||parsed.data||[]);
        setBoards(arr);
        if (arr.length===0) setErrorMsg(`No boards found matching "${boardSearch}"`);
        else setErrorMsg("");
      } catch {
        // Try to extract board info from text response
        setBoards([{id:"manual",name:boardSearch}]);
        setErrorMsg("Could not parse boards — showing manual entry option.");
      }
    } catch(e) {
      setErrorMsg("Monday.com integration requires the Claude.ai environment. Download the quote PDF and attach to Monday manually.");
    }
    setLoadingBoards(false);
  };

  const pushToMonday = async () => {
    if (!selectedBoard) return;
    setStep("pushing");
    try {
      const columnValues = JSON.stringify({
        ...(type==="quote" ? {
          text:       data.quoteNum,
          numbers:    data.amount.replace(/[$,]/g,""),
          status:     {label: data.status},
          text1:      data.state,
          text2:      data.pm,
          date:       data.approvedAt||new Date().toLocaleDateString(),
          long_text:  data.notes,
        } : {
          text:       data.coNum,
          numbers:    data.amount.replace(/[$,]/g,""),
          status:     {label: data.status},
          text1:      data.state,
          text2:      data.pm,
          date:       data.approvedAt||new Date().toLocaleDateString(),
          long_text:  data.notes,
        })
      });

      const prompt = `Create a new item in Monday.com board ID "${selectedBoard.id}" (board name: "${selectedBoard.name}").
Item name: "${itemTitle}"
Set these column values where columns exist (skip any that don't exist on this board):
- Quote/CO Number: ${type==="quote"?data.quoteNum:data.coNum}
- Amount: ${data.amount}
- Status: ${data.status}
- State: ${data.state}
- Project Manager: ${data.pm}
- Date: ${data.approvedAt||new Date().toLocaleDateString()}
- Notes: ${data.notes||"none"}
Type: ${type==="quote"?"Quote":"Change Order"}

Create the item and confirm success. Reply with a single sentence confirming the item was created.`;

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{role:"user",content:prompt}],
          mcp_servers:[{type:"url",url:"https://mcp.monday.com/mcp",name:"monday-mcp"}],
        })
      });
      const json = await resp.json();
      const text = (json.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").trim();
      setResultMsg(text || "Item created successfully.");
      setStep("done");
    } catch(e) {
      setErrorMsg("Push failed: " + e.message);
      setStep("error");
    }
  };

  const C2 = {bg:"#F5F0E8",bark:"#18100A",stone:"#D8CFBC",stoneDk:"#4A3520",
    stoneMd:"#6B5540",charcoal:"#0A0806",moss:"#3D4A35",parchment:"#F5F0E8",
    monday:"#0073EA"};

  return(
    <div style={{
      position:"fixed",top:0,left:0,right:0,bottom:0,
      background:"rgba(10,8,6,0.6)",zIndex:10000,
      display:"flex",alignItems:"center",justifyContent:"center",
    }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{
        background:C2.bg,width:520,maxWidth:"90vw",
        padding:"36px 40px",position:"relative",
        boxShadow:"0 20px 60px rgba(0,0,0,0.4)",
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position:"absolute",top:16,right:20,background:"none",border:"none",
          fontSize:20,cursor:"pointer",color:C2.stoneMd,lineHeight:1,
        }}>×</button>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28}}>
          <div style={{
            background:C2.monday,color:"#fff",
            width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:18,fontWeight:700,
          }}>▦</div>
          <div>
            <div style={{fontSize:9,letterSpacing:"0.24em",color:C2.stoneDk,
              textTransform:"uppercase",marginBottom:2}}>
              Send to Monday.com
            </div>
            <div style={{fontSize:13,color:C2.bark,fontWeight:400}}>
              {type==="quote"?"Quote":"Change Order"} — {data.name}
            </div>
          </div>
        </div>

        {/* Item preview */}
        <div style={{
          padding:"14px 18px",background:"white",
          border:`1px solid ${C2.stone}`,marginBottom:24,
        }}>
          <div style={{fontSize:8,letterSpacing:"0.2em",color:C2.stoneDk,
            textTransform:"uppercase",marginBottom:8}}>Item to Create</div>
          <div style={{fontSize:13,color:C2.bark,fontWeight:500,marginBottom:6}}>{itemTitle}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[
              ["Amount",data.amount],
              ["Status",data.status],
              ["State", data.state],
              ["PM",    data.pm],
              ["Type",  type==="quote"?"Quote":"Change Order"],
              ...(data.approvedAt?[["Approved",data.approvedAt]]:[]),
            ].map(([k,v])=>(
              <div key={k}>
                <div style={{fontSize:8,color:C2.stoneDk,letterSpacing:"0.12em",
                  textTransform:"uppercase"}}>{k}</div>
                <div style={{fontSize:11,color:C2.bark,marginTop:2}}>{v||"—"}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Board search — step: board */}
        {step==="board"&&(
          <div>
            <div style={{fontSize:8,letterSpacing:"0.2em",color:C2.stoneDk,
              textTransform:"uppercase",marginBottom:8}}>
              Monday Board Name
            </div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input
                value={boardSearch}
                onChange={e=>{setBoardSearch(e.target.value);setBoards([]);setSelectedBoard(null);setErrorMsg("");}}
                onKeyDown={e=>e.key==="Enter"&&searchBoards()}
                placeholder="Type customer board name…"
                style={{
                  flex:1,background:"white",border:`1px solid ${C2.stone}`,
                  padding:"10px 12px",fontSize:13,color:C2.bark,
                  fontFamily:"'Jost',sans-serif",outline:"none",
                }}
              />
              <button onClick={searchBoards} disabled={loadingBoards} style={{
                background:C2.charcoal,color:"#F5F0E8",border:"none",
                padding:"10px 20px",cursor:"pointer",
                fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
                fontFamily:"'Jost',sans-serif",fontWeight:500,
                opacity:loadingBoards?0.6:1,
              }}>{loadingBoards?"Searching…":"Search"}</button>
            </div>

            {errorMsg&&(
              <div style={{fontSize:11,color:"#7A3220",marginBottom:12,
                padding:"8px 12px",background:"#F5E8E4",border:"1px solid #E0C8C0"}}>
                {errorMsg}
              </div>
            )}

            {boards.length>0&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:8,letterSpacing:"0.16em",color:C2.stoneDk,
                  textTransform:"uppercase",marginBottom:8}}>
                  Select Board
                </div>
                {boards.map(b=>(
                  <div key={b.id} onClick={()=>setSelectedBoard(b)} style={{
                    padding:"10px 14px",marginBottom:4,cursor:"pointer",
                    border:`1px solid ${selectedBoard?.id===b.id?C2.monday:C2.stone}`,
                    background: selectedBoard?.id===b.id?"#E8F2FF":"white",
                    color:C2.bark,fontSize:12,
                    display:"flex",alignItems:"center",gap:8,
                  }}>
                    <span style={{
                      width:16,height:16,borderRadius:"50%",
                      border:`2px solid ${selectedBoard?.id===b.id?C2.monday:C2.stone}`,
                      background:selectedBoard?.id===b.id?C2.monday:"transparent",
                      display:"inline-block",flexShrink:0,
                    }}/>
                    {b.name}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={pushToMonday}
              disabled={!selectedBoard}
              style={{
                width:"100%",
                background:selectedBoard?C2.monday:"#D0D0D0",
                color:"white",border:"none",
                padding:"12px",cursor:selectedBoard?"pointer":"default",
                fontSize:9,letterSpacing:"0.22em",textTransform:"uppercase",
                fontFamily:"'Jost',sans-serif",fontWeight:500,
                transition:"background 0.2s",
              }}>
              {selectedBoard?`Push to "${selectedBoard.name}"`:
                boards.length>0?"Select a board above":"Search for a board first"}
            </button>
          </div>
        )}

        {/* Pushing state */}
        {step==="pushing"&&(
          <div style={{textAlign:"center",padding:"32px 0"}}>
            <div style={{fontSize:13,color:C2.bark,marginBottom:8}}>
              Pushing to Monday.com…
            </div>
            <div style={{fontSize:11,color:C2.stoneDk}}>Creating item in {selectedBoard?.name}</div>
          </div>
        )}

        {/* Done state */}
        {step==="done"&&(
          <div style={{textAlign:"center",padding:"24px 0"}}>
            <div style={{fontSize:28,marginBottom:12}}>✓</div>
            <div style={{fontSize:13,color:C2.moss,fontWeight:500,marginBottom:8}}>
              Pushed to Monday.com
            </div>
            <div style={{fontSize:11,color:C2.stoneDk,marginBottom:24,lineHeight:1.6}}>
              {resultMsg}
            </div>
            <button onClick={onClose} style={{
              background:C2.charcoal,color:"#F5F0E8",border:"none",
              padding:"10px 28px",cursor:"pointer",
              fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
              fontFamily:"'Jost',sans-serif",fontWeight:500,
            }}>Done</button>
          </div>
        )}

        {/* Error state */}
        {step==="error"&&(
          <div style={{textAlign:"center",padding:"24px 0"}}>
            <div style={{fontSize:13,color:"#7A3220",marginBottom:12}}>Push failed</div>
            <div style={{fontSize:11,color:C2.stoneDk,marginBottom:24,
              padding:"12px 16px",background:"#F5E8E4",border:"1px solid #E0C8C0",
              textAlign:"left",lineHeight:1.6}}>
              {errorMsg}
            </div>
            <button onClick={()=>setStep("board")} style={{
              background:C2.charcoal,color:"#F5F0E8",border:"none",
              padding:"10px 28px",cursor:"pointer",
              fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
              fontFamily:"'Jost',sans-serif",fontWeight:500,
            }}>Try Again</button>
          </div>
        )}
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

// ── Template Modal ─────────────────────────────────────────────
// ── History Modal ──────────────────────────────────────────────
function HistoryModal({ revisions, onRestore, onClose }) {
  const [preview, setPreview] = useState(null); // null | revision index
  const fmt2  = n => (!n&&n!==0)||isNaN(n) ? "—" : "$"+Math.round(n).toLocaleString("en-US");
  const fmtP  = n => (!n&&n!==0)||isNaN(n) ? "—" : (n*100).toFixed(1)+"%";
  const revs  = [...revisions].reverse(); // newest first

  return (
    <div style={{
      position:"fixed",top:0,left:0,right:0,bottom:0,
      background:"rgba(10,8,6,0.65)",zIndex:700,
      display:"flex",alignItems:"center",justifyContent:"center",
    }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{
        background:C.parchment,width:"100%",maxWidth:680,
        padding:"36px 44px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",
        maxHeight:"84vh",overflowY:"auto",
      }}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",
          marginBottom:24,paddingBottom:16,borderBottom:`1px solid ${C.stone}`}}>
          <div>
            <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
              textTransform:"uppercase",marginBottom:4}}>Quote Builder</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",
              fontSize:24,fontWeight:300,color:C.charcoal}}>Revision History</div>
          </div>
          <button onClick={onClose} style={{
            background:"none",border:"none",fontSize:22,
            cursor:"pointer",color:C.stoneMd,lineHeight:1,
          }}>×</button>
        </div>

        <div style={{fontSize:11,color:C.stoneDk,marginBottom:20,letterSpacing:"0.04em",lineHeight:1.6}}>
          Every auto-save creates a revision. Click any version to preview it, then restore if needed.
          The current version is always at the top.
        </div>

        {revs.length === 0 ? (
          <div style={{padding:"24px",textAlign:"center",color:C.stoneDk,fontSize:11}}>
            No revisions yet — they appear as you make changes.
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div style={{
              display:"grid",gridTemplateColumns:"1.6fr 0.8fr 0.8fr 0.6fr 0.6fr 80px",
              gap:12,paddingBottom:8,
              borderBottom:`1px solid ${C.stone}`,marginBottom:4,
            }}>
              {["Saved","Price","Margin","Rooms","By",""].map((h,i)=>(
                <div key={i} style={{fontSize:8,letterSpacing:"0.16em",color:C.stoneDk,
                  textTransform:"uppercase",textAlign:i>=1&&i<=3?"right":"left"}}>{h}</div>
              ))}
            </div>

            {revs.map((rev, i) => {
              const isCurrent = i === 0;
              const isExpanded = preview === i;
              const activeRooms = (rev.rooms||[]).filter(r=>r.name||parseFloat(r.list)>0);
              return (
                <div key={rev.ts}>
                  {/* Row */}
                  <div style={{
                    display:"grid",gridTemplateColumns:"1.6fr 0.8fr 0.8fr 0.6fr 0.6fr 80px",
                    gap:12,padding:"12px 0",
                    borderBottom:`1px solid ${C.parchmentDk}`,
                    alignItems:"center",
                    background: isCurrent ? "#EEF2EA" : "transparent",
                  }}>
                    <div>
                      <div style={{fontSize:11,color:C.bark,fontWeight:isCurrent?500:300}}>
                        {rev.savedAt}
                        {isCurrent&&<span style={{
                          marginLeft:8,fontSize:8,letterSpacing:"0.1em",
                          color:C.moss,textTransform:"uppercase",fontWeight:500,
                        }}>● current</span>}
                      </div>
                      <div style={{fontSize:9,color:C.stoneDk,marginTop:2,letterSpacing:"0.04em"}}>
                        {rev.proj?.status||"—"} · {rev.proj?.vendor||"—"} · {rev.proj?.state||"—"}
                      </div>
                    </div>
                    <div style={{textAlign:"right",fontFamily:"'Cormorant Garamond',serif",
                      fontSize:14,color:C.charcoal,fontVariantNumeric:"tabular-nums"}}>
                      {fmt2(rev.effPrice)}
                    </div>
                    <div style={{textAlign:"right",fontSize:11,fontWeight:500,
                      color:rev.margin>=0.2?C.moss:C.rust}}>
                      {fmtP(rev.margin)}
                    </div>
                    <div style={{textAlign:"right",fontSize:11,color:C.stoneDk}}>
                      {rev.roomCount||activeRooms.length}
                    </div>
                    <div style={{fontSize:9,color:C.stoneDk,letterSpacing:"0.04em"}}>
                      {rev.by||"—"}
                    </div>
                    <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                      <button onClick={()=>setPreview(isExpanded?null:i)} style={{
                        background:"transparent",border:`1px solid ${C.stone}`,
                        color:C.stoneDk,padding:"4px 10px",cursor:"pointer",
                        fontSize:8,letterSpacing:"0.12em",textTransform:"uppercase",
                        fontFamily:"'Jost',sans-serif",
                      }}>{isExpanded?"▲":"▼"}</button>
                    </div>
                  </div>

                  {/* Expanded preview */}
                  {isExpanded&&(
                    <div style={{
                      background:C.white,border:`1px solid ${C.stone}`,
                      borderTop:"none",padding:"20px 24px",marginBottom:2,
                    }}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:16}}>
                        {/* Room breakdown */}
                        <div>
                          <div style={{fontSize:8,letterSpacing:"0.18em",color:C.stoneDk,
                            textTransform:"uppercase",marginBottom:10}}>Rooms</div>
                          {activeRooms.length===0?(
                            <div style={{fontSize:11,color:C.stoneMd}}>No rooms</div>
                          ):activeRooms.map((r,ri)=>{
                            const list=parseFloat(r.list)||0;
                            const ovr=parseFloat(r.priceOverride);
                            return(
                              <div key={ri} style={{display:"flex",justifyContent:"space-between",
                                padding:"5px 0",borderBottom:`1px solid ${C.parchmentDk}`,
                                fontSize:11}}>
                                <span style={{color:C.bark}}>{r.name||`Room ${ri+1}`}</span>
                                <span style={{color:C.stoneDk,fontVariantNumeric:"tabular-nums"}}>
                                  {(!isNaN(ovr)&&ovr>0)?fmt2(ovr):list>0?fmt2(list)+" (list)":"—"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {/* Price summary */}
                        <div>
                          <div style={{fontSize:8,letterSpacing:"0.18em",color:C.stoneDk,
                            textTransform:"uppercase",marginBottom:10}}>Pricing</div>
                          {[
                            ["Final Price",  fmt2(rev.effPrice)],
                            ["Margin",       fmtP(rev.margin)],
                            ["Final Price Override", rev.finalPrice?fmt2(parseFloat(rev.finalPrice)):"Auto-calculated"],
                          ].map(([lbl,val])=>(
                            <div key={lbl} style={{display:"flex",justifyContent:"space-between",
                              padding:"5px 0",borderBottom:`1px solid ${C.parchmentDk}`,fontSize:11}}>
                              <span style={{color:C.stoneDk}}>{lbl}</span>
                              <span style={{color:C.bark,fontVariantNumeric:"tabular-nums"}}>{val}</span>
                            </div>
                          ))}
                          {rev.proj?.notes&&(
                            <div style={{marginTop:10,fontSize:10,color:C.stoneDk,
                              fontStyle:"italic",lineHeight:1.5}}>{rev.proj.notes}</div>
                          )}
                        </div>
                      </div>

                      {!isCurrent&&(
                        <div style={{display:"flex",justifyContent:"flex-end",gap:8,
                          paddingTop:12,borderTop:`1px solid ${C.stone}`}}>
                          <div style={{fontSize:10,color:C.stoneDk,alignSelf:"center",
                            letterSpacing:"0.04em",marginRight:8}}>
                            Restoring will replace the builder with this version.
                            The current version will remain in history.
                          </div>
                          <button onClick={()=>onRestore(rev)} style={{
                            background:C.charcoal,color:C.parchment,border:"none",
                            padding:"9px 28px",cursor:"pointer",
                            fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
                            fontFamily:"'Jost',sans-serif",fontWeight:500,
                          }}>⟳ Restore This Version</button>
                        </div>
                      )}
                      {isCurrent&&(
                        <div style={{fontSize:10,color:C.moss,letterSpacing:"0.06em",
                          paddingTop:12,borderTop:`1px solid ${C.stone}`}}>
                          ✓ This is the current version — no restore needed.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateModal({ templates, onLoad, onDelete, onClose }) {
  const [saveName, setSaveName] = useState("");
  return (
    <div style={{
      position:"fixed",top:0,left:0,right:0,bottom:0,
      background:"rgba(10,8,6,0.6)",zIndex:700,
      display:"flex",alignItems:"center",justifyContent:"center",
    }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{
        background:C.parchment,width:"100%",maxWidth:560,
        padding:"36px 44px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",
        maxHeight:"80vh",overflowY:"auto",
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",
          marginBottom:24,paddingBottom:16,borderBottom:`1px solid ${C.stone}`}}>
          <div>
            <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
              textTransform:"uppercase",marginBottom:4}}>Quote Templates</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",
              fontSize:24,fontWeight:300,color:C.charcoal}}>Load a Template</div>
          </div>
          <button onClick={onClose} style={{
            background:"none",border:"none",fontSize:22,
            cursor:"pointer",color:C.stoneMd,lineHeight:1,
          }}>×</button>
        </div>

        {templates.length===0?(
          <div style={{
            padding:"32px 24px",textAlign:"center",
            border:`1px dashed ${C.stone}`,
            color:C.stoneDk,fontSize:12,letterSpacing:"0.04em",lineHeight:1.8,
          }}>
            No templates saved yet.<br/>
            <span style={{fontSize:10,color:C.stoneMd}}>
              Build a quote, then click "Save as Template" in Project Info to save your room setup.
            </span>
          </div>
        ):(
          <div>
            {templates.map(t=>(
              <div key={t.id} style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"14px 0",borderBottom:`1px solid ${C.parchmentDk}`,
              }}>
                <div>
                  <div style={{fontSize:13,color:C.bark,fontWeight:400}}>{t.name}</div>
                  <div style={{fontSize:9,color:C.stoneDk,marginTop:2,letterSpacing:"0.04em"}}>
                    {(t.rooms||[]).filter(r=>r.name||parseFloat(r.list)>0).length} rooms ·{" "}
                    {t.vendor||"—"} · Saved {t.savedAt}
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>onLoad(t)} style={{
                    background:C.charcoal,color:C.parchment,border:"none",
                    padding:"7px 20px",cursor:"pointer",
                    fontSize:8,letterSpacing:"0.18em",textTransform:"uppercase",
                    fontFamily:"'Jost',sans-serif",fontWeight:500,
                  }}>Load</button>
                  <button onClick={()=>onDelete(t.id)} style={{
                    background:"none",border:`1px solid ${C.stone}`,color:C.stoneDk,
                    padding:"7px 12px",cursor:"pointer",fontSize:12,lineHeight:1,
                  }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{marginTop:20,fontSize:9,color:C.stoneDk,letterSpacing:"0.06em",
          lineHeight:1.6,padding:"12px 16px",background:C.white,border:`1px solid ${C.stone}`}}>
          Loading a template replaces your current rooms and override values.
          Project name, date, and quote number are not changed.
        </div>
      </div>
    </div>
  );
}

// ── Gmail Modal ────────────────────────────────────────────────
function GmailModal({ proj, effPrice, rooms, rc, cabCust, installation, salesTax, totalLF, onClose }) {
  const [step,       setStep]    = useState("compose"); // compose | sending | done | error
  const [to,         setTo]      = useState("");
  const [subject,    setSubject] = useState(`Cabinet Quote — ${proj.name||"Your Project"} · ${proj.quoteNum||""}`);
  const [bodyNotes,  setBodyNotes]= useState(proj.notes||"");
  const [result,     setResult]  = useState("");
  const [errMsg,     setErrMsg]  = useState("");

  const fmt2 = n => (!n&&n!==0)||isNaN(n) ? "—" : "$"+Math.round(n).toLocaleString("en-US");

  const activeRooms = rooms.filter((r,i)=>(r.name||parseFloat(r.list)>0) && rc[i]);

  const buildBody = () => {
    const lines = [];
    lines.push(`Hi,`);
    lines.push(``);
    lines.push(`Please find your cabinet pricing summary below for ${proj.name||"your project"}.`);
    if (bodyNotes) lines.push(`\n${bodyNotes}`);
    lines.push(``);
    lines.push(`── QUOTE SUMMARY ──────────────────────`);
    lines.push(`Quote No:  ${proj.quoteNum||"—"}`);
    lines.push(`Date:      ${proj.date||new Date().toLocaleDateString()}`);
    lines.push(`State:     ${proj.state||"—"}`);
    if (activeRooms.length>0) {
      lines.push(``);
      lines.push(`── ROOM BREAKDOWN ─────────────────────`);
      activeRooms.forEach((r,i)=>{
        const c = rc[rooms.indexOf(r)];
        if (c) lines.push(`${(r.name||"Room").padEnd(22)} ${fmt2(c.price)}`);
      });
    }
    lines.push(``);
    lines.push(`── PRICING ────────────────────────────`);
    lines.push(`Cabinetry:       ${fmt2(cabCust)}`);
    lines.push(`Installation:    ${fmt2(installation)}`);
    if (salesTax>0) lines.push(`Sales Tax:       ${fmt2(salesTax)}`);
    lines.push(`─────────────────────────────────────`);
    lines.push(`TOTAL:           ${fmt2(effPrice)}`);
    if (totalLF>0) lines.push(`(${totalLF} LF total)`);
    lines.push(``);
    lines.push(`This quote is valid for 30 days. Please contact us with any questions.`);
    lines.push(``);
    lines.push(`Old Goats Hard Goods`);
    return lines.join("\n");
  };

  const sendEmail = async () => {
    if (!to.trim()) { setErrMsg("Enter a recipient email address"); return; }
    setStep("sending");
    setErrMsg("");
    try {
      const body = buildBody();
      const emailContent = `To: ${to.trim()}\nSubject: ${subject}\n\n${body}`;
      // Use Gmail MCP to create a draft
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          mcp_servers:[{type:"url",url:"https://gmail.mcp.claude.com/mcp",name:"gmail-mcp"}],
          messages:[{
            role:"user",
            content:`Create a Gmail draft with these exact details:\nTo: ${to.trim()}\nSubject: ${subject}\nBody:\n${body}\n\nUse the Gmail MCP to create this draft. Confirm with "Draft created." when done.`
          }]
        })
      });
      const data = await resp.json();
      const text = (data.content||[]).map(c=>c.text||"").join("");
      if (text.toLowerCase().includes("draft") || text.toLowerCase().includes("created") || text.toLowerCase().includes("sent")) {
        setResult("Gmail draft created! Open Gmail to review and send.");
        setStep("done");
      } else if (data.error) {
        throw new Error(data.error.message||"API error");
      } else {
        setResult(text||"Draft created — check Gmail.");
        setStep("done");
      }
    } catch(e) {
      const isAuthErr = e.message?.includes("401") || e.message?.includes("auth") || e.message?.includes("key");
      setErrMsg(isAuthErr ? "Gmail integration requires the Claude.ai environment. Use your email client and paste the preview text instead." : (e.message||"Failed to create draft"));
      setStep("compose");
    }
  };

  const btnSt = (primary) => ({
    background:primary?"#EA4335":"transparent",
    color:primary?"#fff":C.bark,
    border:primary?"none":`1px solid ${C.stoneMd}`,
    padding:"9px 24px",cursor:"pointer",
    fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",
    fontFamily:"'Jost',sans-serif",fontWeight:500,
  });

  return (
    <div style={{
      position:"fixed",top:0,left:0,right:0,bottom:0,
      background:"rgba(10,8,6,0.6)",zIndex:700,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 24px",
    }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{
        background:C.parchment,width:"100%",maxWidth:600,
        padding:"36px 44px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",
        maxHeight:"90vh",overflowY:"auto",
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",
          marginBottom:24,paddingBottom:16,borderBottom:`1px solid ${C.stone}`}}>
          <div>
            <div style={{fontSize:8,letterSpacing:"0.28em",color:C.stoneDk,
              textTransform:"uppercase",marginBottom:4}}>Gmail</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",
              fontSize:24,fontWeight:300,color:C.charcoal}}>
              Send Quote Summary
            </div>
          </div>
          <button onClick={onClose} style={{
            background:"none",border:"none",fontSize:22,
            cursor:"pointer",color:C.stoneMd,lineHeight:1,
          }}>×</button>
        </div>

        {step==="compose"&&(
          <div>
            {errMsg&&(
              <div style={{marginBottom:14,padding:"10px 14px",
                background:"#F5E8E4",border:`1px solid ${C.rust}44`,
                fontSize:11,color:C.rust,letterSpacing:"0.04em"}}>{errMsg}</div>
            )}

            <div style={{marginBottom:16}}>
              <FL>To</FL>
              <input value={to} onChange={e=>setTo(e.target.value)}
                placeholder="client@example.com"
                className="ri ph" style={{...iSt,fontSize:13}}/>
            </div>
            <div style={{marginBottom:16}}>
              <FL>Subject</FL>
              <input value={subject} onChange={e=>setSubject(e.target.value)}
                className="ri ph" style={{...iSt,fontSize:12}}/>
            </div>
            <div style={{marginBottom:20}}>
              <FL>Personal note <span style={{fontWeight:300,color:C.stoneDk}}>— added to email body</span></FL>
              <textarea value={bodyNotes} onChange={e=>setBodyNotes(e.target.value)}
                placeholder="Any specific notes for this client…"
                className="ri ph"
                style={{...iSt,width:"100%",minHeight:70,resize:"vertical",
                  lineHeight:1.6,fontSize:11,padding:"10px 12px"}}/>
            </div>

            {/* Preview */}
            <div style={{marginBottom:20}}>
              <FL>Email Preview</FL>
              <pre style={{
                background:C.white,border:`1px solid ${C.stone}`,
                padding:"14px 16px",fontSize:10,color:C.bark,
                lineHeight:1.7,overflowX:"auto",whiteSpace:"pre-wrap",
                fontFamily:"'Jost',sans-serif",fontWeight:300,
                maxHeight:220,overflowY:"auto",
              }}>{buildBody()}</pre>
            </div>

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={onClose} style={btnSt(false)}>Cancel</button>
              <button onClick={sendEmail} style={btnSt(true)}>
                ✉ Create Gmail Draft
              </button>
            </div>
            <div style={{marginTop:12,fontSize:9,color:C.stoneDk,letterSpacing:"0.04em",
              textAlign:"right"}}>
              Creates a draft in Gmail — you can review before sending
            </div>
          </div>
        )}

        {step==="sending"&&(
          <div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{
              width:32,height:32,border:`3px solid ${C.stone}`,
              borderTopColor:"#EA4335",borderRadius:"50%",
              animation:"spin 0.8s linear infinite",
              margin:"0 auto 16px",
            }}/>
            <div style={{fontSize:13,color:C.bark,letterSpacing:"0.04em"}}>
              Creating Gmail draft…
            </div>
          </div>
        )}

        {step==="done"&&(
          <div style={{textAlign:"center",padding:"32px 0"}}>
            <div style={{fontSize:32,marginBottom:12,color:"#EA4335"}}>✉</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",
              fontSize:20,fontWeight:300,color:C.charcoal,marginBottom:8}}>
              Draft Created
            </div>
            <div style={{fontSize:12,color:C.stoneDk,marginBottom:28,
              lineHeight:1.6,letterSpacing:"0.04em"}}>
              {result}
            </div>
            <button onClick={onClose} style={btnSt(false)}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
