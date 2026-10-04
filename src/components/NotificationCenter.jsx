// Ambria FnB — Kitchen notification bell (V92)
// In-app notifications (bell + loud chime, realtime via `notifications` table)
// and web push registration (so a closed/backgrounded tab still gets a
// system notification — see src/sw.js's `push` handler and the
// supabase/functions/send-push edge function that fans a row out to every
// subscribed device). Self-contained: renders nothing for a non-kitchen
// currentUser, so it's safe to drop into any header.
// Place in: src/components/NotificationCenter.jsx

import React, { useEffect, useState, useRef } from "react";
import { K } from '../utils/theme.js';
import { Icon } from './Icons.jsx';
import { supabase } from '../lib/supabase.js';
import { dbSubscribe } from '../lib/db.js';

export function isKitchenRole(currentUser) {
  if (!currentUser || !currentUser.role) return false;
  return currentUser.role === 'head_chef' || currentUser.role.startsWith('section_');
}
function staffIdOf(currentUser) {
  return (currentUser && (currentUser.staff_id || currentUser.staffListId || currentUser.id)) || null;
}

// Push subscriptions need the VAPID public key as a raw Uint8Array, not the
// base64url string web-push/the browser APIs exchange it as.
function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var raw = window.atob(base64);
  var out = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// One shared, lazily-created AudioContext (reused across chimes, same reason
// EventDayTab's overtime siren keeps a single module-level context) — a fresh
// AudioContext created outside a user gesture can start "suspended" in some
// browsers, while a context that's already running stays running.
var _chimeCtx = null;
function playChime() {
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!_chimeCtx) _chimeCtx = new Ctx();
    if (_chimeCtx.state === 'suspended') _chimeCtx.resume();
    var ctx = _chimeCtx;
    // Bright two-note "ding-dong", loud enough to cut through a kitchen —
    // deliberately NOT a loop (that's the overtime siren's job elsewhere).
    [880, 1320].forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      var start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(start); osc.stop(start + 0.55);
    });
  } catch (e) {}
}

function timeAgo(iso) {
  if (!iso) return '';
  var ms = Date.now() - new Date(iso).getTime();
  var min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return min + 'm ago';
  var hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h ago';
  return Math.floor(hr / 24) + 'd ago';
}

export function NotificationCenter({ currentUser, T2 = function (s) { return s; } }) {
  var isKitchen = isKitchenRole(currentUser);
  var myId = staffIdOf(currentUser);
  var [items, setItems] = useState([]);
  var [open, setOpen] = useState(false);
  var btnRef = useRef(null);

  function matchesMe(row) {
    if (row.target_staff_id) return row.target_staff_id === myId;
    if (row.target_role === 'kitchen') return isKitchen;
    return false;
  }
  function isUnread(row) {
    return !(Array.isArray(row.read_by) && myId && row.read_by.indexOf(myId) >= 0);
  }

  // ── Web push registration — runs once per login for a kitchen account. ──
  useEffect(function () {
    if (!isKitchen || !currentUser) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    var vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;
    var cancelled = false;
    (async function () {
      try {
        if (Notification.permission === 'denied') return;
        var reg = await navigator.serviceWorker.ready;
        var sub = await reg.pushManager.getSubscription();
        if (!sub) {
          var perm = await Notification.requestPermission();
          if (perm !== 'granted' || cancelled) return;
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }
        if (cancelled) return;
        var json = sub.toJSON();
        await supabase.from('push_subscriptions').upsert({
          endpoint: json.endpoint,
          staff_id: myId,
          role: currentUser.role || null,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent,
        }, { onConflict: 'endpoint' });
      } catch (e) {
        console.error('[NotificationCenter] push subscribe failed:', e);
      }
    })();
    return function () { cancelled = true; };
    // eslint-disable-next-line
  }, [isKitchen, myId]);

  // ── Load recent + listen live. ──
  useEffect(function () {
    if (!isKitchen) return;
    var cancelled = false;
    (async function () {
      var res = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30);
      if (!cancelled && !res.error) setItems((res.data || []).filter(matchesMe));
    })();
    var unsub = dbSubscribe('notifications', function (payload) {
      if (payload.eventType === 'INSERT') {
        if (!matchesMe(payload.new)) return;
        setItems(function (prev) { return [payload.new].concat(prev).slice(0, 30); });
        playChime();
      } else if (payload.eventType === 'UPDATE') {
        setItems(function (prev) { return prev.map(function (x) { return x.id === payload.new.id ? payload.new : x; }); });
      }
    });
    return function () { cancelled = true; unsub(); };
    // eslint-disable-next-line
  }, [isKitchen, myId]);

  // ── Outside click closes the dropdown. ──
  useEffect(function () {
    if (!open) return;
    function onDown(e) { if (btnRef.current && !btnRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDown);
    return function () { document.removeEventListener('mousedown', onDown); };
  }, [open]);

  if (!isKitchen) return null;

  var unread = items.filter(isUnread);

  async function markRead(row) {
    if (!myId || !isUnread(row)) return;
    var nextReadBy = (Array.isArray(row.read_by) ? row.read_by : []).concat([myId]);
    setItems(function (prev) { return prev.map(function (x) { return x.id === row.id ? { ...x, read_by: nextReadBy } : x; }); });
    try { await supabase.from('notifications').update({ read_by: nextReadBy }).eq('id', row.id); } catch (e) { console.error('[NotificationCenter] markRead failed:', e); }
  }
  async function markAllRead() {
    var toMark = unread;
    if (!myId || toMark.length === 0) return;
    setItems(function (prev) { return prev.map(function (x) { return isUnread(x) ? { ...x, read_by: (Array.isArray(x.read_by) ? x.read_by : []).concat([myId]) } : x; }); });
    try {
      await Promise.all(toMark.map(function (row) {
        var nextReadBy = (Array.isArray(row.read_by) ? row.read_by : []).concat([myId]);
        return supabase.from('notifications').update({ read_by: nextReadBy }).eq('id', row.id);
      }));
    } catch (e) { console.error('[NotificationCenter] markAllRead failed:', e); }
  }

  return (
    <div ref={btnRef} style={{ position: "relative", flexShrink: 0 }}>
      <button className="ash-iconbtn kh-rip" onClick={function () { setOpen(function (v) { return !v; }); }}
        title={unread.length > 0 ? (unread.length + ' ' + T2('unread notification(s)')) : T2('No new notifications')}
        style={{ position: "relative", width: 38, height: 38, borderRadius: 10, background: K.surface, border: "1px solid " + K.line, color: K.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
        <Icon name="bell" size={17} />
        {unread.length > 0 && (
          <span style={{ position: "absolute", top: 3, right: 3, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 999, background: K.danger, color: "#fff", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid " + K.surface }}>
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 340, maxHeight: 420, overflowY: "auto", background: K.surface, border: "1px solid " + K.line, borderRadius: 14, boxShadow: K.shadowLift, zIndex: 10002 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid " + K.lineSoft, position: "sticky", top: 0, background: K.surface }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: K.text }}>{T2("Notifications")}</span>
            {unread.length > 0 && (
              <button onClick={markAllRead} style={{ border: "none", background: "transparent", color: K.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                {T2("Mark all read")}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: "28px 16px", textAlign: "center", color: K.textFaint, fontSize: 12.5 }}>{T2("Nothing yet.")}</div>
          ) : (
            items.map(function (row) {
              var unreadRow = isUnread(row);
              return (
                <div key={row.id} onClick={function () { markRead(row); }}
                  style={{ padding: "11px 14px", borderBottom: "1px solid " + K.lineSoft, cursor: unreadRow ? "pointer" : "default", background: unreadRow ? K.accentSoft : "transparent", display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: unreadRow ? K.accent : "transparent", flexShrink: 0, marginTop: 5 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: unreadRow ? 700 : 600, color: K.text }}>{row.title}</div>
                    {row.body && <div style={{ fontSize: 11.5, color: K.textMuted, marginTop: 2 }}>{row.body}</div>}
                    <div style={{ fontSize: 10.5, color: K.textFaint, marginTop: 3 }}>{timeAgo(row.created_at)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;
