import { useState } from "react";

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

const fmt    = n => (!n&&n!==0)||isNaN(n) ? "—" : "$"+Math.round(n).toLocaleString("en-US");
const fmtPct = n => (!n&&n!==0)||isNaN(n) ? "—" : (n*100).toFixed(1)+"%";

const DEFAULT_RATES = {
  overhead:     { label:"Overhead",            value:0.18, basis:"% of net cost" },
  design:       { label:"Design Fee",          value:0.05, basis:"% of customer price" },
  shipping:     { label:"Shipping / Delivery", value:0.03, basis:"% of customer price" },
  installation: { label:"Installation",        value:0.15, basis:"% of customer price" },
  punchlist:    { label:"Punchlist Reserve",   value:0.04, basis:"% of net cost" },
  incentive:    { label:"Employee Incentive",  value:0.04, basis:"% of net cost" },
  salesTax:     { label:"Sales Tax",           value:0.10, basis:"% of net cost" },
  minMargin:    { label:"Minimum Margin",      value:0.20, basis:"target floor %" },
};

const DEFAULT_VENDORS = {
  "Bellmont":              { multiplier:1.60, discount:0.48 },
    "Neff":                  { multiplier:1.60, discount:1.00 },
  "William Ohs":           { multiplier:1.60, discount:1.00 },
  "EJ Cabinetry":          { multiplier:1.60, discount:1.00 },
  "Restaurant/Commercial": { multiplier:1.40, discount:1.00 },
  "Custom Fabrication":    { multiplier:1.00, discount:1.00 },
};

const EMPTY_JOB = {
  id: Date.now(),
  client:"", date:"", vendor:"Bellmont", quoteNum:"",
  status:"Quoted", cabCust:0, addlItems:0, salesTax:0,
  totalCust:0, ogCost:0, notes:"",
};

export default function OwnerBackend({ onRatesChange, onVendorsChange, stateConfig, onStatesChange, userPerms, onUserPermsChange }) {
  const [tab, setTab]       = useState("rates");
  const [rates, setRates]   = useState(DEFAULT_RATES);
  const [vendors, setVendors] = useState(DEFAULT_VENDORS);
  const [jobs, setJobs]     = useState([]);
  const [saved, setSaved]   = useState(false);
  const [editingJob, setEditingJob] = useState(null);

  const updateRate = (key, val) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const updated = { ...rates, [key]: { ...rates[key], value: num/100 } };
      setRates(updated);
      onRatesChange?.(updated);
    }
  };

  const updateVendorMult = (name, val) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const updated = { ...vendors, [name]: { ...vendors[name], multiplier: num } };
      setVendors(updated);
      onVendorsChange?.(updated);
    }
  };

  const updateVendorDisc = (name, val) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const updated = { ...vendors, [name]: { ...vendors[name], discount: num } };
      setVendors(updated);
      onVendorsChange?.(updated);
    }
  };

  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorMult, setNewVendorMult] = useState("1.60");
  const [newVendorDisc, setNewVendorDisc] = useState("1.00");
  const [addingVendor, setAddingVendor]   = useState(false);

  const addVendor = () => {
    const name = newVendorName.trim();
    const mult = parseFloat(newVendorMult);
    const disc = parseFloat(newVendorDisc);
    if (!name || isNaN(mult) || isNaN(disc)) return;
    const updated = { ...vendors, [name]: { multiplier: mult, discount: disc } };
    setVendors(updated);
    onVendorsChange?.(updated);
    setNewVendorName(""); setNewVendorMult("1.60"); setNewVendorDisc("1.00");
    setAddingVendor(false);
  };

  const removeVendor = (name) => {
    const updated = { ...vendors };
    delete updated[name];
    setVendors(updated);
    onVendorsChange?.(updated);
  };

  const saveRates = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addJob = () => setJobs(j => [...j, { ...EMPTY_JOB, id: Date.now() }]);
  const removeJob = id => setJobs(j => j.filter(x => x.id !== id));
  const updateJob = (id, field, val) =>
    setJobs(j => j.map(x => {
      if (x.id !== id) return x;
      const updated = { ...x, [field]: val };
      // auto-calc total
      const c = parseFloat(updated.cabCust)||0;
      const a = parseFloat(updated.addlItems)||0;
      const t = parseFloat(updated.salesTax)||0;
      updated.totalCust = c + a + t;
      return updated;
    }));

  // Annual stats
  const totalRevenue = jobs.reduce((s,j) => s+(parseFloat(j.totalCust)||0), 0);
  const totalCost    = jobs.reduce((s,j) => s+(parseFloat(j.ogCost)||0), 0);
  const totalProfit  = totalRevenue - totalCost;
  const avgMargin    = totalRevenue > 0 ? totalProfit/totalRevenue : 0;
  const completeJobs = jobs.filter(j => j.status==="Complete").length;
  const belowMargin  = jobs.filter(j => {
    const rev = parseFloat(j.totalCust)||0;
    const cost = parseFloat(j.ogCost)||0;
    return rev > 0 && cost > 0 && (rev-cost)/rev < rates.minMargin.value;
  }).length;

  const STATUS_OPTIONS = ["Quoted","Approved","In Progress","Complete","On Hold"];
  const STATUS_COLORS = {
    "Quoted":      C.bark,
    "Approved":    C.moss,
    "In Progress": C.clay,
    "Complete":    "#2A4040",
    "On Hold":     C.rust,
  };

  return (
    <div style={{ fontFamily:"'Jost',sans-serif", fontWeight:300 }}>

      {/* Sub-nav */}
      <div style={{
        display:"flex", gap:0, marginBottom:40,
        borderBottom:`1px solid ${C.stone}`,
      }}>
        {[
          ["rates",  "Rates & Vendors"],
          ["states", "States & Tax"],
          ["users",  "User Permissions"],
          ["database","Database Setup"],
          ["jobs",   "Annual Job Log"],
          ["report", "Annual Report"],
        ].map(([t,lbl]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background:"none", border:"none",
            borderBottom: tab===t ? `2px solid ${C.charcoal}` : "2px solid transparent",
            color: tab===t ? C.charcoal : C.stoneDk,
            padding:"10px 24px 12px",
            fontSize:9, letterSpacing:"0.22em",
            textTransform:"uppercase", cursor:"pointer",
            fontFamily:"'Jost',sans-serif", fontWeight:500,
            marginBottom:-1, transition:"all 0.15s",
          }}>{lbl}</button>
        ))}
      </div>

      {/* ── RATES & VENDORS ─────────────────────────────── */}
      {tab==="rates" && (
        <div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:48}}>

            {/* Rate editor */}
            <div>
              <OTtl>Calculation Rates</OTtl>
              <div style={{ fontSize:11, color:C.stoneDk, marginBottom:20, letterSpacing:"0.04em" }}>
                Changes here update the pricing tool immediately. Save to confirm.
              </div>
              {Object.entries(rates).map(([key, r]) => (
                <div key={key} style={{
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"12px 0", borderBottom:`1px solid ${C.parchmentDk}`,
                }}>
                  <div>
                    <div style={{fontSize:12, color:C.bark}}>{r.label}</div>
                    <div style={{fontSize:9, color:C.stoneDk, letterSpacing:"0.06em", marginTop:2}}>{r.basis}</div>
                  </div>
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <input
                      type="number"
                      defaultValue={(r.value*100).toFixed(1)}
                      onBlur={e => updateRate(key, e.target.value)}
                      style={{
                        width:72, background:C.parchment,
                        border:`1px solid ${C.stone}`,
                        padding:"7px 10px", textAlign:"right",
                        color:C.charcoal, fontSize:13,
                        fontFamily:"'Jost',sans-serif",
                      }}
                    />
                    <span style={{fontSize:11, color:C.stoneDk, width:12}}>%</span>
                  </div>
                </div>
              ))}
              <button onClick={saveRates} style={{
                marginTop:20, background:saved?C.moss:C.charcoal,
                color:C.parchment, border:"none",
                padding:"11px 28px", cursor:"pointer",
                fontSize:9, letterSpacing:"0.22em", textTransform:"uppercase",
                fontFamily:"'Jost',sans-serif", fontWeight:500,
                transition:"background 0.3s",
              }}>{saved ? "Saved ✓" : "Save Rates"}</button>
            </div>

            {/* Vendor editor */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:16}}>
                <OTtl style={{}}>Vendor Multipliers</OTtl>
                <button onClick={()=>setAddingVendor(v=>!v)} style={{
                  background:"transparent", border:`1px solid ${C.stoneMd}`,
                  color:C.bark, padding:"5px 16px",
                  fontSize:8, letterSpacing:"0.2em", textTransform:"uppercase",
                  cursor:"pointer", fontFamily:"'Jost',sans-serif", fontWeight:500,
                }}>+ Add Vendor</button>
              </div>
              <div style={{ fontSize:11, color:C.stoneDk, marginBottom:16, letterSpacing:"0.04em" }}>
                Multiplier × net cost = customer price. Discount: Bellmont uses 0.48, others 1.00.
              </div>

              {/* Add vendor form */}
              {addingVendor&&(
                <div style={{
                  padding:"16px 20px", background:"#EEF2EA",
                  borderLeft:`3px solid ${C.moss}`,
                  marginBottom:16,
                }}>
                  <div style={{fontSize:9,letterSpacing:"0.18em",textTransform:"uppercase",
                    color:C.moss,marginBottom:14}}>New Vendor</div>
                  <div style={{display:"grid",gridTemplateColumns:"2fr 90px 90px 80px",gap:10,alignItems:"end"}}>
                    <div>
                      <div style={{fontSize:8,letterSpacing:"0.18em",color:C.stoneDk,
                        textTransform:"uppercase",marginBottom:6}}>Vendor Name</div>
                      <input value={newVendorName}
                        onChange={e=>setNewVendorName(e.target.value)}
                        placeholder="e.g. Dura Supreme"
                        onKeyDown={e=>e.key==="Enter"&&addVendor()}
                        style={{
                          width:"100%",background:C.white,border:`1px solid ${C.stone}`,
                          padding:"8px 10px",color:C.charcoal,fontSize:12,
                          fontFamily:"'Jost',sans-serif",
                        }}/>
                    </div>
                    <div>
                      <div style={{fontSize:8,letterSpacing:"0.18em",color:C.stoneDk,
                        textTransform:"uppercase",marginBottom:6}}>Multiplier</div>
                      <input type="number" step="0.01" value={newVendorMult}
                        onChange={e=>setNewVendorMult(e.target.value)}
                        style={{
                          width:"100%",background:C.white,border:`1px solid ${C.stone}`,
                          padding:"8px 8px",textAlign:"center",color:C.charcoal,
                          fontSize:12,fontFamily:"'Jost',sans-serif",
                        }}/>
                    </div>
                    <div>
                      <div style={{fontSize:8,letterSpacing:"0.18em",color:C.stoneDk,
                        textTransform:"uppercase",marginBottom:6}}>Discount</div>
                      <input type="number" step="0.01" value={newVendorDisc}
                        onChange={e=>setNewVendorDisc(e.target.value)}
                        style={{
                          width:"100%",background:C.white,border:`1px solid ${C.stone}`,
                          padding:"8px 8px",textAlign:"center",color:C.charcoal,
                          fontSize:12,fontFamily:"'Jost',sans-serif",
                        }}/>
                    </div>
                    <button onClick={addVendor} style={{
                      background:C.moss,color:C.parchment,border:"none",
                      padding:"8px 14px",cursor:"pointer",
                      fontSize:9,letterSpacing:"0.18em",textTransform:"uppercase",
                      fontFamily:"'Jost',sans-serif",fontWeight:500,
                      whiteSpace:"nowrap",
                    }}>Add</button>
                  </div>
                </div>
              )}

              {/* Headers */}
              <div style={{
                display:"grid", gridTemplateColumns:"1fr 80px 80px 28px",
                gap:8, paddingBottom:10,
                borderBottom:`1px solid ${C.stone}`, marginBottom:4,
              }}>
                {["Vendor","Multiplier","Discount",""].map((h,i) => (
                  <div key={i} style={{fontSize:8, letterSpacing:"0.2em",
                    color:C.stoneDk, textTransform:"uppercase",
                    textAlign:i===1||i===2?"center":"left"}}>{h}</div>
                ))}
              </div>

              {Object.entries(vendors).map(([name, v]) => (
                <div key={name} style={{
                  display:"grid", gridTemplateColumns:"1fr 80px 80px 28px",
                  gap:8, padding:"8px 0",
                  borderBottom:`1px solid ${C.parchmentDk}`,
                  alignItems:"center",
                }}>
                  <div style={{fontSize:12, color:C.bark}}>{name}</div>
                  <input
                    type="number" step="0.01"
                    defaultValue={v.multiplier.toFixed(2)}
                    onBlur={e => updateVendorMult(name, e.target.value)}
                    style={{
                      background:C.parchment, border:`1px solid ${C.stone}`,
                      padding:"7px 8px", textAlign:"center",
                      color:C.charcoal, fontSize:12,
                      fontFamily:"'Jost',sans-serif",
                    }}
                  />
                  <input
                    type="number" step="0.01"
                    defaultValue={v.discount.toFixed(2)}
                    onBlur={e => updateVendorDisc(name, e.target.value)}
                    style={{
                      background:C.parchment, border:`1px solid ${C.stone}`,
                      padding:"7px 8px", textAlign:"center",
                      color: name==="Bellmont" ? C.clay : C.stoneDk,
                      fontSize:12,
                      fontFamily:"'Jost',sans-serif",
                    }}
                  />
                  <button onClick={()=>removeVendor(name)} style={{
                    background:"none",border:"none",color:C.stoneMd,
                    fontSize:15,cursor:"pointer",padding:"0 2px",
                    lineHeight:1,opacity:0.6,
                  }} title="Remove vendor">×</button>
                </div>
              ))}
              <div style={{marginTop:12, fontSize:10, color:C.stoneDk, fontStyle:"italic",
                letterSpacing:"0.04em"}}>
                Discount of 1.00 = list price equals net price · Changes apply to all new quotes immediately
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ANNUAL JOB LOG ───────────────────────────────── */}
      {tab==="jobs" && (
        <div>
          <div style={{display:"flex", justifyContent:"space-between",
            alignItems:"baseline", marginBottom:24}}>
            <OTtl>Job Log — {new Date().getFullYear()}</OTtl>
            <button onClick={addJob} style={{
              background:"transparent", border:`1px solid ${C.stoneMd}`,
              color:C.bark, padding:"7px 20px",
              fontSize:8, letterSpacing:"0.22em", textTransform:"uppercase",
              cursor:"pointer", fontFamily:"'Jost',sans-serif", fontWeight:500,
            }}>+ Add Job</button>
          </div>

          {jobs.length === 0 && (
            <div style={{
              textAlign:"center", padding:"56px 0",
              color:C.stoneDk, fontSize:13,
              border:`1px dashed ${C.stone}`,
            }}>
              No jobs logged yet — click + Add Job to begin
            </div>
          )}

          {jobs.length > 0 && (
            <div style={{overflowX:"auto"}}>
              {/* Headers */}
              <div style={{
                display:"grid",
                gridTemplateColumns:"1.6fr 0.9fr 1.1fr 0.7fr 0.9fr 1fr 1fr 0.8fr 1fr 24px",
                gap:10, paddingBottom:10,
                borderBottom:`1px solid ${C.stone}`, marginBottom:4,
                minWidth:900,
              }}>
                {["Client","Date","Vendor","Quote #","Status","Cab. Total","Add'l + Tax","OG Cost","Profit / Margin",""].map((h,i) => (
                  <div key={i} style={{fontSize:8,letterSpacing:"0.15em",
                    color:C.stoneDk,textTransform:"uppercase",
                    textAlign:i>=5&&i<=8?"right":"left"}}>{h}</div>
                ))}
              </div>

              {jobs.map((job,idx) => {
                const rev  = parseFloat(job.totalCust)||0;
                const cost = parseFloat(job.ogCost)||0;
                const p    = rev - cost;
                const m    = rev > 0 ? p/rev : null;
                const mOk  = m !== null && m >= rates.minMargin.value;
                return (
                  <div key={job.id} style={{
                    display:"grid",
                    gridTemplateColumns:"1.6fr 0.9fr 1.1fr 0.7fr 0.9fr 1fr 1fr 0.8fr 1fr 24px",
                    gap:10, padding:"6px 0",
                    borderBottom:`1px solid ${C.parchmentDk}`,
                    alignItems:"center", minWidth:900,
                    background: idx%2===0?"transparent":"#FDFAF400",
                  }}>
                    <input value={job.client}
                      onChange={e=>updateJob(job.id,"client",e.target.value)}
                      placeholder="Client name"
                      style={{...jobInput}} />
                    <input type="date" value={job.date}
                      onChange={e=>updateJob(job.id,"date",e.target.value)}
                      style={{...jobInput,fontSize:11}} />
                    <select value={job.vendor}
                      onChange={e=>updateJob(job.id,"vendor",e.target.value)}
                      style={{...jobInput,appearance:"none",cursor:"pointer"}}>
                      {Object.keys(DEFAULT_VENDORS).map(v=><option key={v}>{v}</option>)}
                    </select>
                    <input value={job.quoteNum}
                      onChange={e=>updateJob(job.id,"quoteNum",e.target.value)}
                      placeholder="—"
                      style={{...jobInput}} />
                    <select value={job.status}
                      onChange={e=>updateJob(job.id,"status",e.target.value)}
                      style={{
                        ...jobInput,appearance:"none",cursor:"pointer",
                        color:STATUS_COLORS[job.status],
                        fontSize:10,
                      }}>
                      {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                    </select>
                    {["cabCust","addlItems","ogCost"].map(f => (
                      <input key={f} type="number" value={job[f]||""}
                        onChange={e=>updateJob(job.id,f,e.target.value)}
                        placeholder="0"
                        style={{...jobInput,textAlign:"right"}} />
                    ))}
                    {/* Profit / margin */}
                    <div style={{textAlign:"right"}}>
                      {rev > 0 && cost > 0 ? (
                        <div>
                          <div style={{
                            fontSize:12, fontWeight:500,
                            color: p>=0?C.moss:C.rust,
                            fontVariantNumeric:"tabular-nums",
                            fontFamily:"'Cormorant Garamond',serif",
                          }}>{fmt(p)}</div>
                          <div style={{
                            fontSize:9, color:mOk?C.moss:C.rust,
                            letterSpacing:"0.06em",
                          }}>{fmtPct(m)}</div>
                        </div>
                      ) : <span style={{color:C.stoneDk,fontSize:11}}>—</span>}
                    </div>
                    <button onClick={()=>removeJob(job.id)} style={{
                      background:"none",border:"none",color:C.stoneMd,
                      fontSize:15,cursor:"pointer",padding:"0 2px",lineHeight:1,
                    }}>×</button>
                  </div>
                );
              })}

              {/* Totals */}
              <div style={{
                display:"grid",
                gridTemplateColumns:"1.6fr 0.9fr 1.1fr 0.7fr 0.9fr 1fr 1fr 0.8fr 1fr 24px",
                gap:10, paddingTop:14, marginTop:6,
                borderTop:`2px solid ${C.charcoal}`, minWidth:900,
              }}>
                <div style={{fontSize:9,letterSpacing:"0.2em",
                  textTransform:"uppercase",color:C.bark,fontWeight:500}}>Totals</div>
                <div/><div/><div/><div/>
                <div style={{textAlign:"right",fontSize:13,
                  fontFamily:"'Cormorant Garamond',serif",color:C.bark}}>
                  {fmt(jobs.reduce((s,j)=>s+(parseFloat(j.cabCust)||0),0))}
                </div>
                <div style={{textAlign:"right",fontSize:13,
                  fontFamily:"'Cormorant Garamond',serif",color:C.bark}}>
                  {fmt(jobs.reduce((s,j)=>s+(parseFloat(j.addlItems)||0)+(parseFloat(j.salesTax)||0),0))}
                </div>
                <div style={{textAlign:"right",fontSize:13,
                  fontFamily:"'Cormorant Garamond',serif",color:C.bark}}>
                  {fmt(totalCost)}
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:14,fontWeight:500,
                    color:totalProfit>=0?C.moss:C.rust,
                    fontFamily:"'Cormorant Garamond',serif"}}>
                    {fmt(totalProfit)}
                  </div>
                  <div style={{fontSize:9,color:avgMargin>=rates.minMargin.value?C.moss:C.rust}}>
                    {fmtPct(avgMargin)}
                  </div>
                </div>
                <div/>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ANNUAL REPORT ────────────────────────────────── */}
      {tab==="report" && (
        <div>
          <OTtl>Annual Summary — {new Date().getFullYear()}</OTtl>

          {/* KPI strip */}
          <div style={{
            display:"grid", gridTemplateColumns:"repeat(5,1fr)",
            gap:"1px", background:C.stone,
            border:`1px solid ${C.stone}`, marginBottom:40,
          }}>
            {[
              ["Total Jobs",     jobs.length,                   false, C.bark],
              ["Total Revenue",  fmt(totalRevenue),             false, C.bark],
              ["Total Cost",     fmt(totalCost),                false, C.rust],
              ["Total Profit",   fmt(totalProfit),              false, totalProfit>=0?C.moss:C.rust],
              ["Avg Margin",     fmtPct(avgMargin),             true,  avgMargin>=rates.minMargin.value?C.moss:C.rust],
            ].map(([lbl,val,big,color]) => (
              <div key={lbl} style={{background:C.white, padding:"24px 20px"}}>
                <div style={{fontSize:8,letterSpacing:"0.2em",color:C.stoneDk,
                  textTransform:"uppercase",marginBottom:8}}>{lbl}</div>
                <div style={{
                  fontFamily:"'Cormorant Garamond',serif",
                  fontSize:big?28:22, fontWeight:300, color, lineHeight:1,
                  fontVariantNumeric:"tabular-nums",
                }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Status breakdown */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:48}}>
            <div>
              <OTtl>Jobs by Status</OTtl>
              {["Quoted","Approved","In Progress","Complete","On Hold"].map(s => {
                const count = jobs.filter(j=>j.status===s).length;
                const rev   = jobs.filter(j=>j.status===s).reduce((a,j)=>a+(parseFloat(j.totalCust)||0),0);
                if (!count) return null;
                return (
                  <div key={s} style={{
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"10px 0",borderBottom:`1px solid ${C.parchmentDk}`,
                  }}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{
                        width:8,height:8,borderRadius:"50%",
                        background:STATUS_COLORS[s],
                      }}/>
                      <span style={{fontSize:12,color:C.bark}}>{s}</span>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:12,color:C.bark}}>{count} job{count!==1?"s":""}</div>
                      <div style={{fontSize:10,color:C.stoneDk}}>{fmt(rev)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <OTtl>Margin Health</OTtl>
              <div style={{
                padding:"20px 22px",
                background: belowMargin>0?"#F2ECEA":"#EEF2EA",
                borderLeft:`3px solid ${belowMargin>0?C.rust:C.moss}`,
                marginBottom:16,
              }}>
                <div style={{fontSize:9,letterSpacing:"0.15em",textTransform:"uppercase",
                  color:belowMargin>0?C.rust:C.moss,marginBottom:8}}>
                  {belowMargin>0?"Needs Attention":"All Clear"}
                </div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,
                  fontWeight:300,color:belowMargin>0?C.rust:C.moss}}>
                  {belowMargin} job{belowMargin!==1?"s":""} below {(rates.minMargin.value*100).toFixed(0)}% margin
                </div>
              </div>
              <div style={{
                padding:"20px 22px",
                background:"#F0EDE8",
                borderLeft:`3px solid ${C.stoneMd}`,
              }}>
                <div style={{fontSize:9,letterSpacing:"0.15em",textTransform:"uppercase",
                  color:C.stoneDk,marginBottom:8}}>Completed Revenue</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,
                  fontWeight:300,color:C.charcoal}}>
                  {fmt(jobs.filter(j=>j.status==="Complete").reduce((s,j)=>s+(parseFloat(j.totalCust)||0),0))}
                </div>
                <div style={{fontSize:10,color:C.stoneDk,marginTop:4}}>
                  from {completeJobs} completed job{completeJobs!==1?"s":""}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STATES & TAX ─────────────────────────────────── */}
      {tab==="states" && (
        <div>
          <OTtl>States &amp; Tax Rates</OTtl>
          <div style={{ fontSize:11, color:C.stoneDk, marginBottom:20, letterSpacing:"0.04em", lineHeight:1.6 }}>
            Add or edit states below. Changes take effect immediately in the quote builder state selector.
            Each state controls its own sales tax rate, default installation rate, and incentive settings.
          </div>

          {/* Column headers */}
          <div style={{
            display:"grid", gridTemplateColumns:"0.7fr 2fr 1fr 1fr 1fr 0.8fr 80px",
            gap:12, paddingBottom:8, borderBottom:`1px solid ${C.stone}`, marginBottom:4,
          }}>
            {["Code","Label","Sales Tax %","Install %","Incentive %","Show Incentive",""].map((h,i) => (
              <div key={i} style={{ fontSize:8, letterSpacing:"0.16em", color:C.stoneDk,
                textTransform:"uppercase", textAlign:i>=2&&i<=4?"right":"left" }}>{h}</div>
            ))}
          </div>

          {/* Existing states */}
          {Object.entries(stateConfig||{}).map(([code, info]) => (
            <StateRow key={code} code={code} info={info}
              onUpdate={(field, val) => {
                const updated = {
                  ...stateConfig,
                  [code]: { ...info, [field]: val }
                };
                onStatesChange?.(updated);
              }}
              onDelete={() => {
                const updated = { ...stateConfig };
                delete updated[code];
                onStatesChange?.(updated);
              }}
            />
          ))}

          {/* Add new state row */}
          <AddStateRow
            existingCodes={Object.keys(stateConfig||{})}
            onAdd={(code, info) => {
              onStatesChange?.({ ...stateConfig, [code]: info });
            }}
          />

          <div style={{
            marginTop:20, padding:"14px 18px",
            background:"#EEF2EA", border:`1px solid ${C.moss}22`,
            fontSize:10, color:C.stoneDk, lineHeight:1.6, letterSpacing:"0.04em",
          }}>
            <strong style={{color:C.moss}}>Tip:</strong> The install % sets the default installation auto-calculation for that state.
            Sales tax is applied to net cabinet cost. Incentive % only matters if "Show Incentive" is on.
            Mark users can only be restricted to specific state codes in the USERS config.
          </div>
        </div>
      )}

      {/* ── USER PERMISSIONS ─────────────────────────────── */}
      {tab==="users" && (
        <div>
          <OTtl>User State Permissions</OTtl>
          <div style={{ fontSize:11, color:C.stoneDk, marginBottom:24, letterSpacing:"0.04em", lineHeight:1.7 }}>
            Control which states each user can quote in. Owners always have access to all states.
            Set a user to <strong style={{color:C.bark}}>All States</strong> to remove restrictions,
            or select specific states to limit them.
          </div>

          {/* Column headers */}
          <div style={{
            display:"grid", gridTemplateColumns:"1fr 1fr 2fr",
            gap:16, paddingBottom:8,
            borderBottom:`1px solid ${C.stone}`, marginBottom:4,
          }}>
            {["User","Role","Allowed States"].map((h,i) => (
              <div key={i} style={{ fontSize:8, letterSpacing:"0.16em", color:C.stoneDk,
                textTransform:"uppercase" }}>{h}</div>
            ))}
          </div>

          {/* Staff users */}
          {[
            { key:"hunter", displayName:"Hunter", role:"Staff" },
            { key:"james",  displayName:"James",  role:"Staff" },
            { key:"megan",  displayName:"Megan",  role:"Staff" },
            { key:"mark",   displayName:"Mark",   role:"Staff" },
          ].map(u => {
            const perm = userPerms?.[u.key];
            const restricted = perm?.allowedStates !== null && perm?.allowedStates !== undefined;
            const allowed = perm?.allowedStates || [];
            const allStateCodes = Object.keys(stateConfig||{});

            const toggleAll = () => {
              onUserPermsChange?.({
                ...(userPerms||{}),
                [u.key]: { allowedStates: restricted ? null : [] }
              });
            };
            const toggleState = (code) => {
              const current = allowed;
              const next = current.includes(code)
                ? current.filter(c=>c!==code)
                : [...current, code];
              onUserPermsChange?.({
                ...(userPerms||{}),
                [u.key]: { allowedStates: next }
              });
            };

            return (
              <div key={u.key} style={{
                display:"grid", gridTemplateColumns:"1fr 1fr 2fr",
                gap:16, padding:"16px 0",
                borderBottom:`1px solid ${C.parchmentDk}`,
                alignItems:"start",
              }}>
                {/* Name */}
                <div style={{
                  fontFamily:"'Cormorant Garamond',serif",
                  fontSize:18, fontWeight:300, color:C.charcoal,
                }}>{u.displayName}</div>

                {/* Role badge */}
                <div style={{
                  fontSize:9, fontWeight:500, letterSpacing:"0.1em",
                  textTransform:"uppercase", color:C.clay,
                  background:"#F2EAD8", padding:"4px 10px",
                  alignSelf:"center", display:"inline-block",
                }}>{u.role}</div>

                {/* State toggles */}
                <div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                    {/* All States toggle */}
                    <button onClick={toggleAll} style={{
                      fontSize:8, letterSpacing:"0.12em", textTransform:"uppercase",
                      fontFamily:"'Jost',sans-serif", cursor:"pointer",
                      padding:"5px 12px",
                      background: !restricted ? C.charcoal : "transparent",
                      color: !restricted ? C.parchment : C.stoneDk,
                      border: `1px solid ${!restricted ? C.charcoal : C.stone}`,
                      transition:"all 0.15s",
                    }}>All States</button>

                    {/* Per-state toggles */}
                    {allStateCodes.map(code => {
                      const active = restricted && allowed.includes(code);
                      return (
                        <button key={code} onClick={()=>{ if(restricted) toggleState(code); }}
                          disabled={!restricted}
                          style={{
                            fontSize:9, letterSpacing:"0.1em",
                            fontFamily:"'Jost',sans-serif", cursor:restricted?"pointer":"default",
                            padding:"5px 12px", fontWeight:500,
                            background: active ? "#3D4A35" : restricted ? "transparent" : C.parchmentDk,
                            color: active ? C.parchment : restricted ? C.stoneDk : C.stone,
                            border: `1px solid ${active ? "#3D4A35" : restricted ? C.stone : C.parchmentDk}`,
                            transition:"all 0.15s",
                            opacity: restricted ? 1 : 0.4,
                          }}>{code}</button>
                      );
                    })}
                  </div>

                  {/* Summary */}
                  <div style={{fontSize:9,color:C.stoneDk,letterSpacing:"0.04em"}}>
                    {!restricted
                      ? "Can quote in any state"
                      : allowed.length===0
                        ? "⚠ No states assigned — user cannot quote"
                        : `Restricted to: ${allowed.join(", ")}`
                    }
                  </div>
                </div>
              </div>
            );
          })}

          {/* Owners note */}
          <div style={{
            marginTop:24, padding:"14px 18px",
            background:"#EEF2EA", border:`1px solid ${C.moss}22`,
            fontSize:10, color:C.stoneDk, lineHeight:1.6, letterSpacing:"0.04em",
          }}>
            <strong style={{color:C.moss}}>Owners (Ethan, Mitch)</strong> always have access to all states
            and all features regardless of these settings.
            Changes take effect the next time a user logs in.
          </div>
        </div>
      )}

      {/* ── DATABASE SETUP ───────────────────────────────── */}
      {tab==="database" && (
        <div>
          <OTtl>Supabase Database Setup</OTtl>
          <div style={{ fontSize:11, color:C.stoneDk, marginBottom:24, letterSpacing:"0.04em", lineHeight:1.8 }}>
            Connecting a Supabase database gives all users access to the same data from any device.
            Projects, change orders, templates, state config, and user permissions all sync automatically.
            localStorage stays as an offline fallback — nothing is lost if you skip this.
          </div>

          {/* Step 1 */}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:9, letterSpacing:"0.2em", color:C.bark, textTransform:"uppercase",
              fontWeight:500, marginBottom:10 }}>Step 1 — Create a free Supabase project</div>
            <div style={{ fontSize:11, color:C.stoneDk, lineHeight:1.7 }}>
              Go to <strong style={{color:C.bark}}>supabase.com</strong> → New Project → choose any name (e.g. "og-pricing").
              Free tier is plenty — this tool stores simple JSON blobs, not large files.
              Takes about 2 minutes to provision.
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:9, letterSpacing:"0.2em", color:C.bark, textTransform:"uppercase",
              fontWeight:500, marginBottom:10 }}>Step 2 — Run the schema SQL</div>
            <div style={{ fontSize:11, color:C.stoneDk, lineHeight:1.7, marginBottom:10 }}>
              In your Supabase dashboard go to <strong>SQL Editor → New query</strong>, paste the contents
              of <code style={{background:"#EDE6D8",padding:"1px 6px",fontSize:10}}>supabase_schema.sql</code> (included in your zip),
              and click Run. This creates 3 tables and sets permissions.
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:9, letterSpacing:"0.2em", color:C.bark, textTransform:"uppercase",
              fontWeight:500, marginBottom:10 }}>Step 3 — Get your credentials</div>
            <div style={{ fontSize:11, color:C.stoneDk, lineHeight:1.7 }}>
              In Supabase go to <strong>Settings → API</strong>. Copy two values:
            </div>
            <div style={{
              background:C.charcoal, color:"#A8D8A0", padding:"16px 20px",
              fontFamily:"monospace", fontSize:11, lineHeight:1.8,
              marginTop:10, letterSpacing:"0.02em",
            }}>
              Project URL  → starts with https://xxxx.supabase.co<br/>
              anon public key → long JWT string (safe to expose in frontend)
            </div>
          </div>

          {/* Step 4 */}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:9, letterSpacing:"0.2em", color:C.bark, textTransform:"uppercase",
              fontWeight:500, marginBottom:10 }}>Step 4 — Add to Vercel environment variables</div>
            <div style={{ fontSize:11, color:C.stoneDk, lineHeight:1.7, marginBottom:10 }}>
              In your Vercel project go to <strong>Settings → Environment Variables</strong> and add:
            </div>
            <div style={{
              background:C.charcoal, color:"#A8D8A0", padding:"16px 20px",
              fontFamily:"monospace", fontSize:11, lineHeight:1.8, marginTop:10,
            }}>
              VITE_SUPABASE_URL = https://xxxx.supabase.co<br/>
              VITE_SUPABASE_ANON_KEY = eyJhbGci...your-anon-key
            </div>
            <div style={{ fontSize:11, color:C.stoneDk, lineHeight:1.7, marginTop:10 }}>
              Then redeploy (Vercel → Deployments → Redeploy). The tool will detect the variables
              and start syncing automatically. <strong>No code changes needed.</strong>
            </div>
          </div>

          {/* Step 5 - migrate */}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:9, letterSpacing:"0.2em", color:C.bark, textTransform:"uppercase",
              fontWeight:500, marginBottom:10 }}>Step 5 — Migrate existing data</div>
            <div style={{ fontSize:11, color:C.stoneDk, lineHeight:1.7 }}>
              After redeployment, the next person to log in will automatically push all their
              local projects and settings up to Supabase. Have Ethan log in first to seed the database,
              then everyone else's logins will pull that data down.
            </div>
          </div>

          {/* What syncs */}
          <div style={{
            padding:"18px 20px", background:"#EEF2EA",
            border:`1px solid ${C.moss}33`, marginBottom:20,
          }}>
            <div style={{ fontSize:9, letterSpacing:"0.18em", color:C.moss,
              textTransform:"uppercase", marginBottom:10, fontWeight:500 }}>What gets synced</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 24px" }}>
              {[
                ["Projects & quotes","✓  All users see the same pipeline"],
                ["Change orders",    "✓  COs attach to projects across devices"],
                ["State config",     "✓  Tax/install rates consistent for everyone"],
                ["User permissions", "✓  State restrictions apply on every machine"],
                ["Templates",        "✓  Shared template library for the whole team"],
                ["Rate config",      "✗  Still per-session (intentional)"],
                ["Drive token",      "✗  OAuth token stays local (security)"],
                ["CO draft",         "✗  In-progress CO stays on your device"],
              ].map(([lbl,note]) => (
                <div key={lbl} style={{fontSize:10,color:C.stoneDk,lineHeight:1.5}}>
                  <span style={{color:note.startsWith("✓")?C.moss:C.stoneMd}}>{note.charAt(0)}</span>
                  <span style={{marginLeft:6,color:C.bark,fontWeight:note.startsWith("✓")?400:300}}>
                    {lbl}
                  </span>
                  <span style={{marginLeft:4,color:C.stoneDk}}>— {note.slice(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            padding:"14px 18px", background:"#F5EEE8",
            border:`1px solid ${C.clay}33`,
            fontSize:10, color:C.stoneDk, lineHeight:1.6,
          }}>
            <strong style={{color:C.clay}}>Note:</strong> The anon key is safe to expose in a
            frontend app — Supabase Row Level Security handles access control.
            For an internal tool on a private Vercel URL this is the standard approach.
            If you ever make the URL public, you'd want to add proper auth.
          </div>
        </div>
      )}
    </div>
  );
}

function OTtl({children}){
  return(
    <div style={{fontSize:8,letterSpacing:"0.28em",color:"#8C7A64",
      textTransform:"uppercase",marginBottom:16,paddingBottom:8,
      borderBottom:"1px solid #D8CFBC"}}>{children}</div>
  );
}

const jobInput = {
  width:"100%", background:"#F5F0E8",
  border:"1px solid #D8CFBC",
  padding:"7px 8px", color:"#1C1810",
  fontSize:12, fontFamily:"'Jost',sans-serif",
  fontWeight:300,
};

// ── StateRow: edit one state inline ─────────────────────────
function StateRow({ code, info, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [localLabel,    setLocalLabel]    = useState(info.label||"");
  const [localTax,      setLocalTax]      = useState(((info.rate||0)*100).toFixed(2));
  const [localInstall,  setLocalInstall]  = useState(((info.install||0)*100).toFixed(0));
  const [localIncentive,setLocalIncentive]= useState(((info.incentiveRate||0)*100).toFixed(0));
  const [localShowInc,  setLocalShowInc]  = useState(!!info.showIncentive);

  const commit = () => {
    onUpdate("label",         localLabel);
    onUpdate("rate",          parseFloat(localTax)/100 || 0);
    onUpdate("install",       parseFloat(localInstall)/100 || 0);
    onUpdate("incentiveRate", parseFloat(localIncentive)/100 || 0);
    onUpdate("showIncentive", localShowInc);
    setEditing(false);
  };

  const rowSt = {
    display:"grid", gridTemplateColumns:"0.7fr 2fr 1fr 1fr 1fr 0.8fr 80px",
    gap:12, padding:"10px 0", borderBottom:"1px solid #EDE6D8", alignItems:"center",
  };
  const inp = {
    width:"100%", background:"#F5F0E8", border:"1px solid #D8CFBC",
    padding:"5px 7px", color:"#1C1810", fontSize:11,
    fontFamily:"'Jost',sans-serif", fontWeight:300,
  };

  if (!editing) return (
    <div style={rowSt}>
      <div style={{fontSize:11,fontWeight:500,color:C.bark,letterSpacing:"0.08em"}}>{code}</div>
      <div style={{fontSize:11,color:C.bark}}>{info.label}</div>
      <div style={{textAlign:"right",fontSize:11,color:C.stoneDk}}>
        {((info.rate||0)*100).toFixed(2)}%
      </div>
      <div style={{textAlign:"right",fontSize:11,color:C.stoneDk}}>
        {((info.install||0)*100).toFixed(0)}%
      </div>
      <div style={{textAlign:"right",fontSize:11,color:C.stoneDk}}>
        {((info.incentiveRate||0)*100).toFixed(0)}%
      </div>
      <div style={{textAlign:"center",fontSize:11,color:info.showIncentive?C.moss:C.stoneDk}}>
        {info.showIncentive?"Yes":"No"}
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setEditing(true)} style={{
          background:"transparent",border:"1px solid #D8CFBC",color:C.bark,
          padding:"4px 10px",cursor:"pointer",fontSize:8,letterSpacing:"0.1em",
          textTransform:"uppercase",fontFamily:"'Jost',sans-serif",
        }}>Edit</button>
        <button onClick={onDelete} style={{
          background:"none",border:"none",color:C.stoneDk,
          fontSize:14,cursor:"pointer",lineHeight:1,padding:"0 2px",
        }}>×</button>
      </div>
    </div>
  );

  return (
    <div style={{...rowSt,background:"#FAF7F0",padding:"12px 8px",marginBottom:4}}>
      <div style={{fontSize:12,fontWeight:500,color:C.bark,letterSpacing:"0.08em"}}>{code}</div>
      <input value={localLabel} onChange={e=>setLocalLabel(e.target.value)} style={inp}
        placeholder="State label"/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:4}}>
        <input type="number" value={localTax} onChange={e=>setLocalTax(e.target.value)}
          style={{...inp,width:60,textAlign:"right"}} placeholder="0"/>
        <span style={{fontSize:10,color:C.stoneDk}}>%</span>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:4}}>
        <input type="number" value={localInstall} onChange={e=>setLocalInstall(e.target.value)}
          style={{...inp,width:60,textAlign:"right"}} placeholder="0"/>
        <span style={{fontSize:10,color:C.stoneDk}}>%</span>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:4}}>
        <input type="number" value={localIncentive} onChange={e=>setLocalIncentive(e.target.value)}
          style={{...inp,width:60,textAlign:"right"}} placeholder="0"/>
        <span style={{fontSize:10,color:C.stoneDk}}>%</span>
      </div>
      <div style={{textAlign:"center"}}>
        <button onClick={()=>setLocalShowInc(v=>!v)} style={{
          padding:"4px 10px",fontSize:9,cursor:"pointer",fontFamily:"'Jost',sans-serif",
          border:"1px solid #D8CFBC",
          background:localShowInc?"#D8E0D0":"transparent",
          color:localShowInc?C.moss:C.stoneDk,
        }}>{localShowInc?"Yes":"No"}</button>
      </div>
      <button onClick={commit} style={{
        background:C.charcoal,color:"#F5F0E8",border:"none",
        padding:"6px 12px",cursor:"pointer",fontSize:8,
        letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif",
      }}>Save</button>
    </div>
  );
}

// ── AddStateRow: add a brand-new state ───────────────────────
function AddStateRow({ existingCodes, onAdd }) {
  const [open,     setOpen]     = useState(false);
  const [code,     setCode]     = useState("");
  const [label,    setLabel]    = useState("");
  const [tax,      setTax]      = useState("0");
  const [install,  setInstall]  = useState("15");
  const [incentive,setIncentive]= useState("0");
  const [showInc,  setShowInc]  = useState(false);
  const [err,      setErr]      = useState("");

  const add = () => {
    const c = code.trim().toUpperCase();
    if (!c||c.length<2) { setErr("Enter a 2-letter state code"); return; }
    if (existingCodes.includes(c)) { setErr(`${c} already exists`); return; }
    onAdd(c, {
      rate:          parseFloat(tax)/100||0,
      label:         label||`${c} (${tax}% rate)`,
      install:       parseFloat(install)/100||0.15,
      incentiveRate: parseFloat(incentive)/100||0,
      showIncentive: showInc,
    });
    setCode(""); setLabel(""); setTax("0"); setInstall("15"); setIncentive("0");
    setShowInc(false); setErr(""); setOpen(false);
  };

  if (!open) return (
    <div style={{paddingTop:16}}>
      <button onClick={()=>setOpen(true)} style={{
        background:"transparent",border:"1px solid #D8CFBC",color:C.bark,
        padding:"8px 20px",cursor:"pointer",fontSize:8,letterSpacing:"0.2em",
        textTransform:"uppercase",fontFamily:"'Jost',sans-serif",fontWeight:500,
      }}>+ Add State</button>
    </div>
  );

  const inp2 = {
    width:"100%",background:"#F5F0E8",border:"1px solid #D8CFBC",
    padding:"7px 8px",color:"#1C1810",fontSize:11,
    fontFamily:"'Jost',sans-serif",fontWeight:300,
  };

  return (
    <div style={{
      marginTop:12,padding:"20px 20px",
      background:"#FAF7F0",border:"1px dashed #C8BBA8",
    }}>
      <div style={{fontSize:8,letterSpacing:"0.22em",color:C.stoneDk,
        textTransform:"uppercase",marginBottom:14}}>New State</div>
      {err&&<div style={{fontSize:10,color:C.rust,marginBottom:8}}>{err}</div>}
      <div style={{display:"grid",gridTemplateColumns:"0.7fr 2fr 1fr 1fr 1fr 0.8fr",gap:12,marginBottom:12}}>
        <div>
          <div style={{fontSize:8,letterSpacing:"0.12em",color:C.stoneDk,
            textTransform:"uppercase",marginBottom:4}}>Code *</div>
          <input value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setErr("");}}
            maxLength={3} placeholder="NV" style={inp2}/>
        </div>
        <div>
          <div style={{fontSize:8,letterSpacing:"0.12em",color:C.stoneDk,
            textTransform:"uppercase",marginBottom:4}}>Label</div>
          <input value={label} onChange={e=>setLabel(e.target.value)}
            placeholder="Nevada (6.85% rate)" style={inp2}/>
        </div>
        <div>
          <div style={{fontSize:8,letterSpacing:"0.12em",color:C.stoneDk,
            textTransform:"uppercase",marginBottom:4}}>Sales Tax %</div>
          <input type="number" value={tax} onChange={e=>setTax(e.target.value)}
            placeholder="0" style={{...inp2,textAlign:"right"}}/>
        </div>
        <div>
          <div style={{fontSize:8,letterSpacing:"0.12em",color:C.stoneDk,
            textTransform:"uppercase",marginBottom:4}}>Install %</div>
          <input type="number" value={install} onChange={e=>setInstall(e.target.value)}
            placeholder="15" style={{...inp2,textAlign:"right"}}/>
        </div>
        <div>
          <div style={{fontSize:8,letterSpacing:"0.12em",color:C.stoneDk,
            textTransform:"uppercase",marginBottom:4}}>Incentive %</div>
          <input type="number" value={incentive} onChange={e=>setIncentive(e.target.value)}
            placeholder="0" style={{...inp2,textAlign:"right"}}/>
        </div>
        <div>
          <div style={{fontSize:8,letterSpacing:"0.12em",color:C.stoneDk,
            textTransform:"uppercase",marginBottom:4}}>Show Inc.</div>
          <button onClick={()=>setShowInc(v=>!v)} style={{
            padding:"7px 10px",fontSize:9,cursor:"pointer",width:"100%",
            fontFamily:"'Jost',sans-serif",border:"1px solid #D8CFBC",
            background:showInc?"#D8E0D0":"transparent",
            color:showInc?C.moss:C.stoneDk,
          }}>{showInc?"Yes":"No"}</button>
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={add} style={{
          background:C.charcoal,color:"#F5F0E8",border:"none",
          padding:"8px 24px",cursor:"pointer",fontSize:8,
          letterSpacing:"0.2em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif",
        }}>Add State</button>
        <button onClick={()=>{setOpen(false);setErr("");}} style={{
          background:"transparent",border:"1px solid #D8CFBC",color:C.stoneDk,
          padding:"8px 16px",cursor:"pointer",fontSize:8,
          letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif",
        }}>Cancel</button>
      </div>
    </div>
  );
}
