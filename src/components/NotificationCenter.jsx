// Ambria FnB — Kitchen notification bell (V92)
// In-app notifications (bell + loud chime, realtime via `notifications` table)
// and web push registration (so a closed/backgrounded tab still gets a
// system notification — see src/sw.js's `push` handler and the
// supabase/functions/send-push edge function that fans a row out to every
// subscribed device). Self-contained: renders nothing for a non-kitchen
// currentUser, so it's safe to drop into any header.
// Place in: src/components/NotificationCenter.jsx

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { K } from '../utils/theme.js';
import { Icon } from './Icons.jsx';
import { supabase } from '../lib/supabase.js';
import { dbSubscribe } from '../lib/db.js';

// Gates the bell, the 'kitchen' notification match, and push-subscription
// registration — admin included (not just head_chef/section_*) so admin sees
// and gets pushed the same FP-released/changed alerts kitchen stations do.
// The send-push edge function (supabase/functions/send-push/index.ts) mirrors
// this same role set server-side for the actual push fan-out — keep both in
// sync by hand, there's no shared import across the client/edge-function boundary.
export function isKitchenRole(currentUser) {
  if (!currentUser || !currentUser.role) return false;
  return currentUser.role === 'head_chef' || currentUser.role === 'admin' || currentUser.role.startsWith('section_');
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

export function NotificationCenter({ currentUser, T2 = function (s) { return s; }, onOpenEvent }) {
  var isKitchen = isKitchenRole(currentUser);
  var myId = staffIdOf(currentUser);
  var [items, setItems] = useState([]);
  var [open, setOpen] = useState(false);
  // Anchor coords for the portaled panel below — some headers this bell sits
  // in (the section-tablet plate) clip their own content with overflow:hidden
  // for a decorative border-radius, which silently clipped the dropdown to a
  // sliver when it rendered inline. Portaled to <body> and positioned fixed
  // instead, same escape-hatch KModal/KToast already use for this class of bug.
  var [panelPos, setPanelPos] = useState(null); // { top, right } in viewport px
  var btnRef = useRef(null);
  var panelRef = useRef(null);

  function matchesMe(row) {
    if (row.target_staff_id) return row.target_staff_id === myId;
    if (row.target_role === 'kitchen') return isKitchen;
    return false;
  }
  function isUnread(row) {
    return !(Array.isArray(row.read_by) && myId && row.read_by.indexOf(myId) >= 0);
  }

  // ── Web push registration. ──
  // 'needs-action': permission is still default and nothing has asked for it
  // via an actual click — most browsers silently swallow
  // Notification.requestPermission() when it isn't called from a direct user
  // gesture, so the boot-time effect below only auto-completes a subscription
  // that's already granted; anything short of that surfaces a button instead
  // of silently doing nothing.
  var [pushStatus, setPushStatus] = useState('idle'); // idle|subscribed|needs-action|denied|unsupported
  function ensurePushSubscription(fromClick) {
    if (!isKitchen || !currentUser) return Promise.resolve();
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setPushStatus('unsupported'); return Promise.resolve(); }
    var vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) { setPushStatus('unsupported'); return Promise.resolve(); }
    return (async function () {
      try {
        if (Notification.permission === 'denied') { setPushStatus('denied'); return; }
        var reg = await navigator.serviceWorker.ready;
        var sub = await reg.pushManager.getSubscription();
        if (!sub) {
          if (!fromClick && Notification.permission !== 'granted') { setPushStatus('needs-action'); return; }
          var perm = await Notification.requestPermission();
          if (perm === 'denied') { setPushStatus('denied'); return; }
          if (perm !== 'granted') { setPushStatus('needs-action'); return; }
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }
        var json = sub.toJSON();
        await supabase.from('push_subscriptions').upsert({
          endpoint: json.endpoint,
          staff_id: myId,
          role: currentUser.role || null,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent,
        }, { onConflict: 'endpoint' });
        setPushStatus('subscribed');
      } catch (e) {
        console.error('[NotificationCenter] push subscribe failed:', e);
        setPushStatus('needs-action');
      }
    })();
  }
  useEffect(function () {
    ensurePushSubscription(false);
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

  // ── Position the portaled panel against the bell, and close on outside
  //    click/scroll (fixed-position coords go stale the moment the page under
  //    it scrolls, same as any anchored popover). ──
  useEffect(function () {
    if (!open) return;
    function place() {
      if (!btnRef.current) return;
      var r = btnRef.current.getBoundingClientRect();
      var margin = 12;
      // A fixed 340px panel positioned by `right` alone (no clamp) ran its
      // left edge straight off a phone's screen — the bell sits near the
      // left on a narrow header, so `right` computed from it is huge.
      var width = Math.min(340, window.innerWidth - margin * 2);
      var right = window.innerWidth - r.right;
      var maxRight = window.innerWidth - width - margin;
      if (right > maxRight) right = maxRight;
      if (right < margin) right = margin;
      // The bell now also lives at the BOTTOM of the sidebar — opening
      // downward unconditionally (the only direction this ever supported)
      // pushed the panel off the bottom of the screen from there. Open
      // whichever side has more room, and cap height to what's actually
      // available so it's never cut off on the chosen side either.
      var spaceBelow = window.innerHeight - r.bottom - margin;
      var spaceAbove = r.top - margin;
      var openDown = spaceBelow >= Math.min(420, spaceAbove) || spaceBelow >= spaceAbove;
      var maxHeight = Math.min(420, openDown ? spaceBelow : spaceAbove);
      setPanelPos(openDown
        ? { top: r.bottom + 8, right: right, width: width, maxHeight: maxHeight }
        : { bottom: window.innerHeight - r.top + 8, right: right, width: width, maxHeight: maxHeight });
    }
    place();
    function onDown(e) {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      setOpen(false);
    }
    // Scrolling the panel's own notification list (it's overflowY:auto)
    // dispatches a capture-phase scroll event too — ignore it, only close
    // on a scroll of the page underneath.
    function onScroll(e) { if (panelRef.current && panelRef.current.contains(e.target)) return; setOpen(false); }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return function () {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
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

      {open && panelPos && createPortal(
        <div ref={panelRef} style={{ position: "fixed", top: panelPos.top, bottom: panelPos.bottom, right: panelPos.right, width: panelPos.width, maxHeight: panelPos.maxHeight, overflowY: "auto", background: K.surface, border: "1px solid " + K.line, borderRadius: 14, boxShadow: K.shadowLift, zIndex: 10002 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid " + K.lineSoft, position: "sticky", top: 0, background: K.surface }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: K.text }}>{T2("Notifications")}</span>
            {unread.length > 0 && (
              <button onClick={markAllRead} style={{ border: "none", background: "transparent", color: K.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                {T2("Mark all read")}
              </button>
            )}
          </div>
          {(pushStatus === 'needs-action' || pushStatus === 'denied') && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid " + K.lineSoft, background: K.accentSoft }}>
              <Icon name="bell" size={14} color={K.accent} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: K.textBody, lineHeight: 1.4 }}>
                {pushStatus === 'denied'
                  ? T2("Notifications are blocked for this site — enable them in your browser's site settings to get alerts when the app is closed.")
                  : T2("Get notified even when this tab is closed.")}
              </div>
              {pushStatus === 'needs-action' && (
                <button onClick={function () { ensurePushSubscription(true); }}
                  style={{ flexShrink: 0, border: "none", borderRadius: 999, background: K.accent, color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}>
                  {T2("Enable")}
                </button>
              )}
            </div>
          )}
          {unread.length === 0 ? (
            <div style={{ padding: "28px 16px", textAlign: "center", color: K.textFaint, fontSize: 12.5 }}>{T2("You're all caught up.")}</div>
          ) : (
            // Read notifications drop off the list entirely rather than
            // sticking around greyed out — this panel is a to-do list of
            // what's new, not a permanent log.
            unread.map(function (row) {
              return (
                <div key={row.id}
                  onClick={function () {
                    markRead(row);
                    if (row.event_id && onOpenEvent) { onOpenEvent(row.event_id); setOpen(false); }
                  }}
                  style={{ padding: "11px 14px", borderBottom: "1px solid " + K.lineSoft, cursor: "pointer", background: K.accentSoft, display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: K.accent, flexShrink: 0, marginTop: 5 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: K.text }}>{row.title}</div>
                    {row.body && <div style={{ fontSize: 11.5, color: K.textMuted, marginTop: 2 }}>{row.body}</div>}
                    <div style={{ fontSize: 10.5, color: K.textFaint, marginTop: 3 }}>{timeAgo(row.created_at)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default NotificationCenter;
