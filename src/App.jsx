import { useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import dgImg from './assets/dg.jfif'
import './App.css'

const KEY_RECORDS = 'lp_records_v3'
const KEY_THEME   = 'lp_theme'
const KEY_OWNER   = 'lp_owner'

const load = (key, fb) => { try { return JSON.parse(localStorage.getItem(key)) ?? fb } catch { return fb } }
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)) } catch (e) { console.error(e) } }
const initials = (n = '') => n.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

/* PKR replaced with USD */
const fmtUSD = v => {
  const n = parseFloat(v)
  if (!n) return '—'
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const PIE_COLORS = ['#8a2be2','#9d4edd','#b794f4','#d8b4fe','#7b2bd6','#6b25cb']
const COMPANIES = ['Progressive','American First Finance','Acima','Paytriage','Easy Pay']
const EMPTY = { employeeName:'', customerName:'', customerNumber:'', leasingCompany:'', leasingAmount:'', approvedBy:'', approvedDate:'', deviceName:'', deviceAmount:'', paymentTime:'' }

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px', boxShadow:'0 4px 16px rgba(0,0,0,0.15)', fontSize:12, color:'#0f172a' }}>
      <p style={{ fontWeight:700, marginBottom:5 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color:p.color, marginBottom:2 }}>{p.name}: {p.name === 'count' ? p.value : fmtUSD(p.value)}</p>)}
    </div>
  )
}

function LoginScreen({ onLogin }) {
  const [name, setName] = useState('')
  const submit = e => { e.preventDefault(); if (name.trim()) onLogin(name.trim()) }
  return (
    <div className="login-screen">
      <div className="login-bg" style={{ backgroundImage:`url(${dgImg})` }} />
      <div className="login-overlay" />
      <div className="login-card">
        <div className="login-logo">📊</div>
        <h1>LeasePro</h1>
        <p>Enter your name to access your dashboard</p>
        <form onSubmit={submit}>
          <label className="login-label">Your Name</label>
          <input className="login-input" placeholder="e.g. Ahmed Ali, Sara Khan" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <button type="submit" className="login-btn">Open Dashboard →</button>
        </form>
        <p className="login-footer">Data is stored locally — same name gives you your data back every time</p>
      </div>
    </div>
  )
}

export default function App() {
  const [owner,        setOwner]        = useState(() => load(KEY_OWNER, null))
  const [records,      setRecords]      = useState(() => load(KEY_RECORDS, []))
  const [dark,         setDark]         = useState(() => localStorage.getItem(KEY_THEME) === 'dark')
  const [modal,        setModal]        = useState(false)
  const [editId,       setEditId]       = useState(null)
  const [form,         setForm]         = useState(EMPTY)
  const [search,       setSearch]       = useState('')
  const [sideOpen,     setSideOpen]     = useState(false)
  const [viewCustomer, setViewCustomer] = useState(null)
  const [custSearch,   setCustSearch]   = useState('')
  const [showCustDrop, setShowCustDrop] = useState(false)

  useEffect(() => { save(KEY_RECORDS, records) }, [records])
  useEffect(() => { save(KEY_OWNER, owner) }, [owner])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem(KEY_THEME, dark ? 'dark' : 'light')
  }, [dark])

  /* Close customer dropdown on outside click */
  useEffect(() => {
    const handler = e => {
      if (!e.target.closest('.search-box')) setShowCustDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!owner) return <LoginScreen onLogin={n => { setOwner(n); save(KEY_OWNER, n) }} />

  const myRecs      = records.filter(r => r.owner === owner)
  const totalLease  = myRecs.reduce((s, r) => s + (parseFloat(r.leasingAmount) || 0), 0)
  const totalDevice = myRecs.reduce((s, r) => s + (parseFloat(r.deviceAmount) || 0), 0)
  const now         = new Date()
  const thisMonth   = myRecs.filter(r => {
    const d = new Date(r.approvedDate)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const m = d.getMonth(), y = d.getFullYear()
    const rs = myRecs.filter(r => { const rd = new Date(r.approvedDate); return rd.getMonth() === m && rd.getFullYear() === y })
    return {
      month:   MONTHS[m],
      leasing: rs.reduce((s, r) => s + (parseFloat(r.leasingAmount) || 0), 0),
      device:  rs.reduce((s, r) => s + (parseFloat(r.deviceAmount) || 0), 0),
      count:   rs.length,
    }
  })

  const companyMap = {}
  myRecs.forEach(r => { if (r.leasingCompany) companyMap[r.leasingCompany] = (companyMap[r.leasingCompany] || 0) + (parseFloat(r.leasingAmount) || 0) })
  const pieData = Object.entries(companyMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }))

  /* Top searchbar: search by customer name */
  const topSearchResults = search.trim()
    ? [...new Set(myRecs.filter(r => r.customerName?.toLowerCase().includes(search.toLowerCase())).map(r => r.customerName))]
    : []

  const filtered = myRecs.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())))

  /* Sidebar customer search */
  const custResults = custSearch.trim()
    ? [...new Set(myRecs.filter(r => r.customerName?.toLowerCase().includes(custSearch.toLowerCase())).map(r => r.customerName))]
    : []
  const custRecs = viewCustomer ? records.filter(r => r.customerName === viewCustomer) : []

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setModal(true) }
  const openEdit = r  => { setForm({ ...r }); setEditId(r.id); setModal(true) }
  const onChange = e  => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSave = () => {
    if (!form.customerName.trim()) return alert('Customer Name is required!')
    const rec = { ...form, owner, id: editId ?? Date.now() }
    setRecords(p => editId ? p.map(r => r.id === editId ? rec : r) : [...p, rec])
    setModal(false)
  }

  const exportData = () => {
    /* Export ALL records so import restores everything */
    const blob = new Blob([JSON.stringify({ records, exportDate: new Date().toISOString(), version: 'v3' }, null, 2)], { type:'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leasepro_backup_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = e => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result)
        const incoming = data.records || (Array.isArray(data) ? data : null)
        if (!incoming) return alert('Invalid backup file.')
        if (window.confirm(`Import ${incoming.length} records? Duplicates will be skipped.`)) {
          setRecords(prev => {
            const ids = new Set(prev.map(r => r.id))
            const merged = [...prev, ...incoming.filter(r => !ids.has(r.id))]
            save(KEY_RECORDS, merged)
            return merged
          })
          alert('Import successful!')
        }
      } catch { alert('Could not read file. Make sure it is a valid LeasePro backup.') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="app-shell">
      {sideOpen && <div className="sidebar-overlay" onClick={() => setSideOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar${sideOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">📊</div>
          <div className="logo-text">Lease<span>Pro</span></div>
        </div>
        <div className="owner-info">
          <div className="owner-avatar">{initials(owner)}</div>
          <div className="owner-details">
            <div className="owner-name">{owner}</div>
            <div className="owner-role">My Dashboard</div>
          </div>
          <button className="btn-logout-sm" onClick={() => { setOwner(null); save(KEY_OWNER, null) }}>Switch</button>
        </div>
        <div className="sidebar-nav-section">
          <div className="sidebar-sec-label">Menu</div>
          <ul className="sidebar-nav">
            <li className="active"><button><span className="nav-icon">🏠</span>Dashboard</button></li>
          </ul>
          <div className="sidebar-sec-label" style={{ marginTop:14 }}>Customer Search</div>
          <div style={{ padding:'0 10px 12px', position:'relative' }}>
            <input type="text" placeholder="Search customer..." value={custSearch} onChange={e => setCustSearch(e.target.value)}
              style={{ width:'100%', padding:'9px 12px', border:'1.5px solid var(--border)', borderRadius:'10px', fontSize:'13px', outline:'none', background:'var(--main-bg)', color:'var(--text-dark)', fontFamily:'inherit' }} />
            {custResults.length > 0 && (
              <div style={{ marginTop:6, background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 4px 12px rgba(0,0,0,0.1)', maxHeight:180, overflowY:'auto' }}>
                {custResults.map((name, i) => (
                  <div key={i} onClick={() => { setViewCustomer(name); setCustSearch(''); setSideOpen(false) }}
                    style={{ padding:'9px 13px', cursor:'pointer', fontSize:'13px', color:'var(--text-dark)', borderBottom: i < custResults.length-1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--main-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="sidebar-sec-label">Actions</div>
          <ul className="sidebar-nav">
            <li><button onClick={() => { openAdd(); setSideOpen(false) }}><span className="nav-icon">➕</span>Add New Entry</button></li>
            <li><button onClick={exportData}><span className="nav-icon">📥</span>Export Backup</button></li>
            <li>
              <button onClick={() => document.getElementById('imp-file').click()}><span className="nav-icon">📤</span>Import Backup</button>
              <input type="file" id="imp-file" accept=".json" style={{ display:'none' }} onChange={importData} />
            </li>
          </ul>
        </div>
        <div className="sidebar-footer">
          <button className="dark-toggle" onClick={() => setDark(d => !d)}>
            <span>{dark ? '🌙 Dark Mode' : '☀️ Light Mode'}</span>
            <span className={`toggle-pill${dark ? ' on' : ''}`} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <div className="dash-hero">
          <img src={dgImg} alt="Banner" className="dash-hero-img" />
          <div className="dash-hero-overlay" />
          <div className="dash-hero-content">
            <button className="menu-btn" onClick={() => setSideOpen(s => !s)}>☰</button>
            <div className="dash-hero-text">
              <h1>Welcome, {owner.split(' ')[0]} 👋</h1>
              <p>Your leasing dashboard — all records in one place</p>
            </div>
            <div className="dash-hero-actions">
              <button className="btn-add" onClick={openAdd}>+ Add Entry</button>
            </div>
          </div>
        </div>

        {/* Topbar with customer name search dropdown */}
        <div className="topbar">
          <div className="topbar-left">
            <h2>Dashboard Overview</h2>
            <p>{myRecs.length} total records · {owner}</p>
          </div>
          <div className="topbar-right">
            <div className="search-box" style={{ position:'relative' }}>
              <span>🔍</span>
              <input
                placeholder="Search customer name..."
                value={search}
                onChange={e => { setSearch(e.target.value); setShowCustDrop(true) }}
                onFocus={() => setShowCustDrop(true)}
              />
              {showCustDrop && topSearchResults.length > 0 && (
                <div style={{ position:'absolute', top:'110%', left:0, right:0, background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.15)', zIndex:200, maxHeight:220, overflowY:'auto' }}>
                  {topSearchResults.map((name, i) => (
                    <div key={i}
                      onClick={() => { setViewCustomer(name); setSearch(''); setShowCustDrop(false) }}
                      style={{ padding:'10px 14px', cursor:'pointer', fontSize:'13px', color:'var(--text-dark)', borderBottom: i < topSearchResults.length-1 ? '1px solid var(--border)' : 'none', display:'flex', alignItems:'center', gap:8 }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--main-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <span style={{ width:28, height:28, borderRadius:'50%', background:'var(--gradient-premium)', color:'#fff', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{initials(name)}</span>
                      {name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-add" onClick={openAdd}>+ Add</button>
          </div>
        </div>

        <div className="page-body">
          <div className="stats-row">
            <div className="stat-card primary">
              <div className="stat-top"><div className="stat-icon">📁</div><span className="stat-badge">All Time</span></div>
              <div className="stat-val">{myRecs.length}</div>
              <div className="stat-lbl">Total Records</div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><div className="stat-icon">💰</div><span className="stat-badge">Leasing</span></div>
              <div className="stat-val">{fmtUSD(totalLease)}</div>
              <div className="stat-lbl">Total Leasing Amount</div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><div className="stat-icon">📱</div><span className="stat-badge">Devices</span></div>
              <div className="stat-val">{fmtUSD(totalDevice)}</div>
              <div className="stat-lbl">Total Device Amount</div>
            </div>
            <div className="stat-card">
              <div className="stat-top"><div className="stat-icon">📅</div><span className="stat-badge">This Month</span></div>
              <div className="stat-val">{thisMonth}</div>
              <div className="stat-lbl">Approvals This Month</div>
            </div>
          </div>

          {myRecs.length > 0 && (
            <>
              <div className="charts-grid">
                <div className="chart-card">
                  <div className="card-header"><h3>📈 Monthly Leasing Overview</h3><p>Leasing vs device amounts — last 6 months</p></div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8a2be2" stopOpacity={0.3} /><stop offset="95%" stopColor="#8a2be2" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4169e1" stopOpacity={0.25} /><stop offset="95%" stopColor="#4169e1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} tickFormatter={fmtUSD} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="leasing" name="Leasing" stroke="#8a2be2" strokeWidth={2.5} fill="url(#gL)" />
                      <Area type="monotone" dataKey="device" name="Device" stroke="#4169e1" strokeWidth={2.5} fill="url(#gD)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-card">
                  <div className="card-header"><h3>🏢 Top Leasing Companies</h3><p>Distribution by leasing amount</p></div>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={80} dataKey="value" paddingAngle={3}>
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={fmtUSD} contentStyle={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12 }} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)', fontSize:13 }}>Add records with a leasing company to see this chart</div>
                  )}
                </div>
              </div>
              <div className="chart-card bar-chart-row">
                <div className="card-header"><h3>📊 Monthly Approvals Count</h3><p>Number of approvals per month</p></div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={monthlyData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="count" name="Approvals" fill="#8a2be2" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          <div className="table-card">
            <div className="table-hdr">
              <div><h2>📋 Leasing Records</h2><p>Click a customer name to view full details</p></div>
              <span className="rec-pill">{filtered.length} records</span>
            </div>
            <div className="table-wrap">
              {filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-ico">📭</div>
                  <h3>{search ? 'No results found' : 'No records yet'}</h3>
                  <p>{search ? `No customer found for "${search}"` : 'Click the button below to add your first entry'}</p>
                  {!search && <button className="btn-add" style={{ margin:'0 auto' }} onClick={openAdd}>+ Add First Entry</button>}
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>Employee</th><th>Customer Name</th><th>Phone</th>
                      <th>Leasing Company</th><th>Leasing Amt</th><th>Approved By</th>
                      <th>Approved Date</th><th>Device</th><th>Device Amt</th>
                      <th>Payment Plan</th><th>Added By</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={r.id}>
                        <td style={{ color:'var(--text-muted)', fontWeight:500 }}>{i+1}</td>
                        <td><div className="emp-cell"><div className="avatar">{initials(r.employeeName)}</div><span className="emp-name">{r.employeeName||'—'}</span></div></td>
                        <td><span className="customer-link" onClick={() => setViewCustomer(r.customerName)}>{r.customerName||'—'}</span></td>
                        <td>{r.customerNumber||'—'}</td>
                        <td>{r.leasingCompany ? <span className="badge-co">{r.leasingCompany}</span> : '—'}</td>
                        <td className="amt-cell">{fmtUSD(r.leasingAmount)}</td>
                        <td>{r.approvedBy||'—'}</td>
                        <td>{r.approvedDate||'—'}</td>
                        <td>{r.deviceName||'—'}</td>
                        <td className="amt-cell">{fmtUSD(r.deviceAmount)}</td>
                        <td>{r.paymentTime||'—'}</td>
                        <td><span className="own-badge"><span className="own-dot"/>{r.owner}</span></td>
                        <td><button className="btn-edit" onClick={() => openEdit(r)}>✏️ Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Detail Modal — only closes via ✕ */}
      {viewCustomer && (
        <div className="modal-overlay">
          <div className="modal cust-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div><h2>👤 {viewCustomer}</h2><p>{custRecs.length} record{custRecs.length!==1?'s':''} found</p></div>
              <button className="btn-close" onClick={() => setViewCustomer(null)}>✕</button>
            </div>
            {custRecs.map((r, i) => (
              <div key={r.id} className="cust-record-block">
                {custRecs.length > 1 && <div className="cust-record-num">Record #{i+1}</div>}
                <div className="cust-detail-grid">
                  <div className="cust-detail-item"><span>📞 Phone</span><strong>{r.customerNumber||'—'}</strong></div>
                  <div className="cust-detail-item"><span>👨‍💼 Employee</span><strong>{r.employeeName||'—'}</strong></div>
                  <div className="cust-detail-item"><span>🏢 Leasing Company</span><strong>{r.leasingCompany||'—'}</strong></div>
                  <div className="cust-detail-item"><span>💰 Leasing Amount</span><strong style={{ color:'var(--primary)' }}>{fmtUSD(r.leasingAmount)}</strong></div>
                  <div className="cust-detail-item"><span>✅ Approved By</span><strong>{r.approvedBy||'—'}</strong></div>
                  <div className="cust-detail-item"><span>📅 Approved Date</span><strong>{r.approvedDate||'—'}</strong></div>
                  <div className="cust-detail-item"><span>📱 Device</span><strong>{r.deviceName||'—'}</strong></div>
                  <div className="cust-detail-item"><span>💵 Device Amount</span><strong style={{ color:'var(--primary)' }}>{fmtUSD(r.deviceAmount)}</strong></div>
                  <div className="cust-detail-item full"><span>🕐 Payment Plan</span><strong>{r.paymentTime||'—'}</strong></div>
                  <div className="cust-detail-item full"><span>🙍 Added By</span><strong>{r.owner}</strong></div>
                </div>
                <div style={{ marginTop:14 }}>
                  <button className="btn-edit" onClick={() => { setViewCustomer(null); openEdit(r) }}>✏️ Edit This Record</button>
                </div>
              </div>
            ))}
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setViewCustomer(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal — only closes via ✕ or Cancel */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div><h2>{editId ? '✏️ Edit Record' : '➕ Add New Record'}</h2><p>Fill in the details — everything can be edited later</p></div>
              <button className="btn-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="section-divider">👤 Customer Information</div>
            <div className="form-grid">
              <div className="form-group"><label>Referring Employee</label><input name="employeeName" value={form.employeeName} onChange={onChange} placeholder="Employee full name" /></div>
              <div className="form-group"><label>Customer Name *</label><input name="customerName" value={form.customerName} onChange={onChange} placeholder="Customer full name" /></div>
              <div className="form-group full"><label>Customer Phone Number</label><input name="customerNumber" value={form.customerNumber} onChange={onChange} placeholder="03XX-XXXXXXX" /></div>
            </div>
            <div className="section-divider">🏦 Leasing Details</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Leasing Company</label>
                <select name="leasingCompany" value={form.leasingCompany} onChange={onChange}>
                  <option value="">— Select Company —</option>
                  {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Leasing Amount (USD)</label><input name="leasingAmount" type="number" value={form.leasingAmount} onChange={onChange} placeholder="0" /></div>
              <div className="form-group"><label>Approved By</label><input name="approvedBy" value={form.approvedBy} onChange={onChange} placeholder="Approver's name" /></div>
              <div className="form-group"><label>Approval Date</label><input name="approvedDate" type="date" value={form.approvedDate} onChange={onChange} /></div>
            </div>
            <div className="section-divider">📱 Device Information</div>
            <div className="form-grid">
              <div className="form-group"><label>Device Name</label><input name="deviceName" value={form.deviceName} onChange={onChange} placeholder="e.g. iPhone 16, Samsung S25" /></div>
              <div className="form-group"><label>Device Amount (USD)</label><input name="deviceAmount" type="number" value={form.deviceAmount} onChange={onChange} placeholder="0" /></div>
              <div className="form-group full"><label>Payment Plan</label><input name="paymentTime" value={form.paymentTime} onChange={onChange} placeholder="e.g. 12 months, Monthly installment" /></div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn-save" onClick={handleSave}>{editId ? '✓ Update Record' : '✓ Save Record'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
