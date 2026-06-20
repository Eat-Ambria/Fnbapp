// Ambria FnB — Activity Log (Supabase-wired)
import React, { useState, useEffect } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, safeArr } from '../utils/helpers.js';
import { Card } from './SharedUI.jsx';
import { supabase } from '../lib/supabase.js';

// ── Writable log helper — call from any component ──
// Usage: import { logActivity } from './ActivityLog.jsx';
//        logActivity('kitchen','Paneer Tikka completed','dish_complete',{evId,dish,chef:'Gopal'});
async function logActivity(type, message, action, meta = {}, userId = null) {
  if (!supabase) return;
  try {
    await supabase.from('activity_log').insert({
      type, message, action,
      meta: typeof meta === 'object' ? meta : {},
      user_id: userId || meta?.userId || null,
      created_at: new Date().toISOString(),
    });
  } catch (e) { console.warn('logActivity err:', e); }
}

function ActivityLog({ lang, currentUser, empDb, attendance, kitchenTracking, events }) {
  const T2 = s => T(s, lang || 'en');
  const [filter, setFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(TODAY);
  const [dbLogs, setDbLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // ── Load from Supabase ──
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const from = dateFilter + 'T00:00:00';
      const to = dateFilter + 'T23:59:59';
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(500);
      if (!cancelled && !error && data) setDbLogs(data);
      setLoading(false);
    }
    load();
    // Realtime subscription
    const chan = supabase.channel('activity_log_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, (payload) => {
        if (payload.new?.created_at?.startsWith(dateFilter)) {
          setDbLogs(p => [payload.new, ...p]);
        }
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(chan); };
  }, [dateFilter]);

  // ── Derive client-side logs from props (live fallback for today) ──
  const clientLogs = [];
  if (dateFilter === TODAY) {
    safeArr(attendance).forEach(a => {
      if (a.in_time) clientLogs.push({ ts: a.date + 'T' + a.in_time, type: 'attendance', icon: '✅', color: C.green, msg: (a.staff_name || a.staff_id) + ' punched IN', detail: [a.venue, a.section].filter(Boolean).join(' · ') });
      if (a.out_time) clientLogs.push({ ts: a.date + 'T' + a.out_time, type: 'attendance', icon: '🚪', color: C.red, msg: (a.staff_name || a.staff_id) + ' punched OUT', detail: [a.venue, a.section].filter(Boolean).join(' · ') });
      if (a.is_vendor) clientLogs.push({ ts: a.date + 'T' + (a.in_time || '00:00'), type: 'vendor', icon: '🏢', color: C.amber, msg: 'Vendor: ' + (a.staff_name || 'Unknown') + (a.vendor_company ? ' (' + a.vendor_company + ')' : ''), detail: [a.vendor_purpose, a.venue].filter(Boolean).join(' · ') });
    });
    const kt = kitchenTracking || {};
    Object.keys(kt).forEach(evId => {
      const evName = safeArr(events).find(e => e.id === evId)?.guest || evId;
      Object.keys(kt[evId] || {}).forEach(dk => {
        const d = kt[evId][dk];
        if (d.completed || d.ready) clientLogs.push({ ts: d.completedAt || d.readyAt || TODAY + 'T00:00', type: 'kitchen', icon: '✅', color: C.green, msg: dk + ' completed' + (d.completedBy ? ' by ' + d.completedBy : ''), detail: evName });
        if (d.storeEnd) clientLogs.push({ ts: d.storeEndAt || TODAY + 'T00:00', type: 'kitchen', icon: '🏪', color: C.gold, msg: 'Store sourcing done — ' + dk, detail: evName });
        if (d.readyForDispatch) clientLogs.push({ ts: d.dispatchMarkedAt || TODAY + 'T00:00', type: 'dispatch', icon: '🚛', color: C.blue || '#4A8FD0', msg: 'Ready for dispatch — ' + dk, detail: evName + (d.dispatchMarkedBy ? ' · ' + d.dispatchMarkedBy : '') });
      });
    });
  }

  // ── Merge DB logs + client logs, dedup by message+timestamp ──
  const dbMapped = dbLogs.map(l => ({
    ts: l.created_at, type: l.type || 'system', icon: l.type === 'attendance' ? '✅' : l.type === 'kitchen' ? '👨‍🍳' : l.type === 'dispatch' ? '🚛' : l.type === 'vendor' ? '🏢' : l.type === 'system' ? '⚙️' : '📋',
    color: l.type === 'attendance' ? C.green : l.type === 'kitchen' ? C.gold : l.type === 'dispatch' ? (C.blue || '#4A8FD0') : l.type === 'vendor' ? C.amber : C.muted,
    msg: l.message, detail: l.meta?.detail || '', fromDb: true,
  }));
  const seen = new Set(dbMapped.map(l => l.msg + '|' + (l.ts || '').slice(0, 16)));
  const merged = [...dbMapped, ...clientLogs.filter(l => !seen.has(l.msg + '|' + (l.ts || '').slice(0, 16)))];
  merged.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));

  const FILTERS = [
    { v: 'all', l: T2('All'), c: C.gold },
    { v: 'attendance', l: T2('Attendance'), c: C.green },
    { v: 'kitchen', l: T2('Kitchen'), c: C.amber },
    { v: 'dispatch', l: T2('Dispatch'), c: C.blue || '#4A8FD0' },
    { v: 'vendor', l: T2('Vendors'), c: C.wine || '#9060C8' },
    { v: 'system', l: T2('System'), c: C.muted },
  ];
  const filtered = filter === 'all' ? merged : merged.filter(l => l.type === filter);

  function fmtTime(ts) {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return ts; }
  }

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: 'var(--font-display)', marginBottom: 4 }}>📋 {T2('Activity Log')}</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: C.muted }}>{merged.length} {T2('entries')}</div>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, color: C.text, background: C.surface }} />
        {dateFilter !== TODAY && <button onClick={() => setDateFilter(TODAY)} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.gold, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{T2('Today')}</button>}
        {loading && <span style={{ fontSize: 11, color: C.muted }}>⏳</span>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const cnt = f.v === 'all' ? merged.length : merged.filter(l => l.type === f.v).length;
          if (cnt === 0 && f.v !== 'all') return null;
          return (
            <button key={f.v} onClick={() => setFilter(f.v)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                background: filter === f.v ? f.c + '20' : 'transparent',
                border: `1px solid ${filter === f.v ? f.c : C.border}`,
                color: filter === f.v ? f.c : C.muted, fontWeight: filter === f.v ? 700 : 400 }}>
              {f.l} ({cnt})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          <div>{T2('No log entries found')}</div>
        </div>
      ) : (
        filtered.slice(0, 300).map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px',
            marginBottom: 4, background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: l.color + '15', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{l.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{l.msg}</div>
              {l.detail && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{l.detail}</div>}
            </div>
            <div style={{ fontSize: 10, color: C.faint, whiteSpace: 'nowrap', marginTop: 2 }}>{fmtTime(l.ts)}</div>
          </div>
        ))
      )}
    </div>
  );
}

export { ActivityLog, logActivity };