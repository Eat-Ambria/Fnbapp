// PunchCapture.jsx — Programmatic selfie capture with face detection + GPS
// Replaces <input type="file" capture="user"> with video stream + skin-tone analysis
// Props: punchType ('in'|'out'), staffName, onComplete({blob,dataUrl,gps}), onCancel()

import React, { useState, useRef, useEffect } from "react";
import { C } from '../data/constants.js';

/* ═══════════════════════════════════════════════════════════
   GPS — parallel with camera, Nominatim reverse geocode
   ═══════════════════════════════════════════════════════════ */
function requestGPS() {
  return new Promise(function(resolve) {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        var gps = {
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
          areaName:  null
        };
        // Reverse geocode — 3 s timeout, fail silently
        var ctrl = new AbortController();
        var timer = setTimeout(function(){ ctrl.abort(); }, 3000);
        fetch(
          'https://nominatim.openstreetmap.org/reverse?lat=' + gps.latitude +
          '&lon=' + gps.longitude + '&format=json&zoom=16&addressdetails=1',
          { signal: ctrl.signal }
        ).then(function(r){ return r.json(); })
         .then(function(data) {
            clearTimeout(timer);
            var a = (data && data.address) || {};
            gps.areaName = a.neighbourhood || a.suburb || a.city_district ||
                           a.village || a.town || a.city || null;
            resolve(gps);
         }).catch(function(){ clearTimeout(timer); resolve(gps); });
      },
      function(){ resolve(null); },                       // denied / failed
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/* ═══════════════════════════════════════════════════════════
   SKIN-TONE HEURISTIC (Tier 2)
   Samples center 50 % of a down-scaled video frame and
   classifies pixels as skin-tone. Returns detection metrics.
   ═══════════════════════════════════════════════════════════ */
function analyzeSkinTone(video, canvas) {
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  var W = 160, H = 120;
  canvas.width = W; canvas.height = H;
  ctx.drawImage(video, 0, 0, W, H);

  // Center 50 % region
  var cx = Math.floor(W * 0.25), cy = Math.floor(H * 0.25);
  var cw = Math.floor(W * 0.5),  ch = Math.floor(H * 0.5);
  var img  = ctx.getImageData(cx, cy, cw, ch);
  var px   = img.data;
  var total = cw * ch;

  var skinN = 0, brightN = 0, midSkinN = 0;
  var lumSum = 0, lumSqSum = 0;

  for (var i = 0; i < px.length; i += 4) {
    var r = px[i], g = px[i+1], b = px[i+2];
    var lum = 0.299*r + 0.587*g + 0.114*b;
    lumSum   += lum;
    lumSqSum += lum * lum;
    if (lum > 200) brightN++;

    var skin = false;
    if (lum >= 60) {
      // Normal-light thresholds
      skin = r>80 && g>50 && b>30 && r>g && r>b &&
             Math.abs(r-g)>15 && (r-b)>20 && (r-b)<120 && (r-g)<80;
    } else {
      // Low-light relaxed
      skin = r>40 && g>25 && b>15 && r>g && r>b &&
             Math.abs(r-g)>8  && (r-b)>10;
    }
    if (skin) {
      skinN++;
      if (lum>40 && lum<200) midSkinN++;
    }
  }

  var skinR   = skinN   / total;
  var brightR = brightN / total;
  var midR    = midSkinN/ total;
  var lumMean = lumSum  / total;
  var lumVar  = (lumSqSum / total) - (lumMean * lumMean);
  var lowLight = lumMean < 60;

  var detected = lowLight
    ? (skinR > 0.10 && midR > 0.45 && lumVar > 100)
    : (skinR > 0.22 && brightR < 0.40 && midR > 0.55 && lumVar > 400);

  return { detected: detected, skinRatio: skinR, luminanceMean: lumMean };
}

/* ═══════════════════════════════════════════════════════════
   MOTION CHECK — sliding window (6 frames)
   Cumulative delta of skinRatio + normalised luminanceMean.
   ═══════════════════════════════════════════════════════════ */
function checkMotion(history) {
  if (history.length < 3) return false;
  var delta = 0;
  for (var i = 1; i < history.length; i++) {
    delta += Math.abs(history[i].skinRatio      - history[i-1].skinRatio);
    delta += Math.abs(history[i].luminanceMean  - history[i-1].luminanceMean) / 255;
  }
  return delta > 0.015;
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */
function PunchCapture(props) {
  var punchType = props.punchType;
  var staffName = props.staffName;
  var onComplete = props.onComplete;
  var onCancel   = props.onCancel;

  // Refs
  var videoRef    = useRef(null);
  var canvasRef   = useRef(null);          // hidden analysis canvas
  var streamRef   = useRef(null);
  var detectRef   = useRef(null);          // detection interval id
  var histRef     = useRef([]);            // motion history buffer
  var gpsRef      = useRef({ st: 'pending', data: null });
  var aliveRef    = useRef(true);
  var autoRef     = useRef(null);          // 60 s auto-close

  // State
  var _p  = useState('init');     var phase      = _p[0];      var setPhase      = _p[1];
  var _f  = useState(false);      var faceOk     = _f[0];      var setFaceOk     = _f[1];
  var _m  = useState(false);      var motionOk   = _m[0];      var setMotionOk   = _m[1];
  var _st = useState('Opening camera…');  var statusMsg = _st[0]; var setStatusMsg = _st[1];
  var _ci = useState(null);       var captured   = _ci[0];     var setCaptured   = _ci[1];
  var _fl = useState(false);      var flash      = _fl[0];     var setFlash      = _fl[1];
  var _er = useState(null);       var camErr     = _er[0];     var setCamErr     = _er[1];
  var _cd = useState(60);         var countdown  = _cd[0];     var setCountdown  = _cd[1];

  /* ── mount: GPS + camera ────────────────────────────── */
  useEffect(function() {
    aliveRef.current = true;

    // GPS (fire-and-forget)
    requestGPS().then(function(gps) {
      if (!aliveRef.current) return;
      gpsRef.current = gps
        ? { st: 'done',   data: gps }
        : { st: 'failed', data: null };
    });

    // Camera
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCamErr('Camera not supported on this browser');
      return;
    }
    var cancelled = false;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    }).then(function(stream) {
      if (cancelled || !aliveRef.current) {
        stream.getTracks().forEach(function(t){ t.stop(); });
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = function() {
          videoRef.current.play();
          setPhase('camera');
          setStatusMsg('Position your face in the oval');
          startDetection();
          startAutoClose();
        };
      }
    }).catch(function(err) {
      if (!cancelled && aliveRef.current) {
        console.error('Camera:', err);
        setCamErr(
          err.name === 'NotAllowedError'
            ? 'Camera permission denied — please allow and retry'
            : 'Could not open camera (' + (err.message || err.name) + ')'
        );
      }
    });

    return function() {
      cancelled = true;
      aliveRef.current = false;
      cleanup();
    };
  }, []);

  /* ── detection loop (500 ms) ────────────────────────── */
  function startDetection() {
    histRef.current = [];
    detectRef.current = setInterval(function() {
      if (!videoRef.current || !canvasRef.current) return;
      if (videoRef.current.readyState < 2) return;

      var res    = analyzeSkinTone(videoRef.current, canvasRef.current);
      var hist   = histRef.current;
      hist.push(res);
      if (hist.length > 6) hist.shift();

      var face   = res.detected;
      var motion = checkMotion(hist);

      setFaceOk(face);
      setMotionOk(motion);
      setStatusMsg(
        !face   ? 'Position your face in the oval'
        : !motion ? 'Face detected — move slightly…'
        : 'Ready! Tap capture ✓'
      );
    }, 500);
  }

  /* ── 60 s auto-close countdown ──────────────────────── */
  function startAutoClose() {
    var sec = 60;
    autoRef.current = setInterval(function() {
      sec--;
      setCountdown(sec);
      if (sec <= 0) {
        cleanup();
        if (onCancel) onCancel();
      }
    }, 1000);
  }

  /* ── cleanup everything ─────────────────────────────── */
  function cleanup() {
    if (detectRef.current) { clearInterval(detectRef.current); detectRef.current = null; }
    if (autoRef.current)   { clearInterval(autoRef.current);   autoRef.current   = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(function(t){ t.stop(); });
      streamRef.current = null;
    }
  }

  /* ── capture selfie ─────────────────────────────────── */
  function handleCapture() {
    if (!videoRef.current) return;

    // Flash
    setFlash(true);
    setTimeout(function(){ setFlash(false); }, 300);

    var video = videoRef.current;
    var maxW  = 640;
    var scale = Math.min(1, maxW / video.videoWidth);
    var w = Math.round(video.videoWidth  * scale);
    var h = Math.round(video.videoHeight * scale);

    var cv  = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    // Mirror (front camera is flipped in display)
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);

    var dataUrl = cv.toDataURL('image/jpeg', 0.6);
    cv.toBlob(function(blob) {
      cleanup();
      setCaptured({ blob: blob, dataUrl: dataUrl });
      setPhase('captured');
      finishWithGPS(blob, dataUrl);
    }, 'image/jpeg', 0.6);
  }

  /* ── resolve GPS and hand back to parent ────────────── */
  function finishWithGPS(blob, dataUrl) {
    var g = gpsRef.current;
    if (g.st === 'done') {
      onComplete({ blob: blob, dataUrl: dataUrl, gps: g.data });
      return;
    }
    if (g.st === 'failed') { setPhase('gps_fail'); return; }

    // Still pending — poll up to 5 s more
    setStatusMsg('Acquiring location…');
    var start = Date.now();
    var poll  = setInterval(function() {
      var g2 = gpsRef.current;
      if (g2.st === 'done') {
        clearInterval(poll);
        onComplete({ blob: blob, dataUrl: dataUrl, gps: g2.data });
      } else if (g2.st === 'failed' || Date.now() - start > 5000) {
        clearInterval(poll);
        gpsRef.current = { st: 'failed', data: null };
        setPhase('gps_fail');
      }
    }, 300);
  }

  function punchAnyway() {
    if (captured) {
      onComplete({ blob: captured.blob, dataUrl: captured.dataUrl, gps: null });
    }
  }

  /* ════════════════════  RENDER  ════════════════════════ */

  var BTN = {
    padding:'14px 28px', borderRadius:12, fontSize:14, fontWeight:700,
    cursor:'pointer', border:'none', minHeight:48
  };

  // ── Camera error ──
  if (camErr) {
    return React.createElement('div', {style:{textAlign:'center',padding:40}},
      React.createElement('div', {style:{fontSize:48,marginBottom:16}}, '📷'),
      React.createElement('div', {style:{fontSize:14,fontWeight:700,color:C.red,marginBottom:8,lineHeight:1.5}}, camErr),
      React.createElement('div', {style:{fontSize:12,color:C.muted,marginBottom:20}},
        'Check browser settings → Site permissions → Camera'),
      React.createElement('button', {
        onClick: onCancel,
        style:Object.assign({}, BTN, {background:C.surface,color:C.text,border:'1px solid '+C.border})
      }, '← Go Back')
    );
  }

  // ── GPS fail (selfie already captured) ──
  if (phase === 'gps_fail' && captured) {
    return React.createElement('div', {style:{textAlign:'center',padding:40}},
      React.createElement('div', {style:{fontSize:48,marginBottom:8}}, '📍'),
      React.createElement('div', {style:{fontSize:16,fontWeight:700,color:C.amber,marginBottom:6}},
        'GPS Unavailable'),
      React.createElement('div', {style:{fontSize:13,color:C.muted,marginBottom:20,lineHeight:1.5}},
        'Location could not be determined.\nYou can still punch without it.'),
      React.createElement('img', {
        src: captured.dataUrl,
        style:{width:100,height:100,borderRadius:16,objectFit:'cover',
          border:'3px solid '+C.wine,marginBottom:20}
      }),
      React.createElement('div', {style:{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}},
        React.createElement('button', {
          onClick: punchAnyway,
          style:Object.assign({}, BTN, {
            background:'linear-gradient(135deg,'+C.wine+',#6D4A25)',color:'#fff'})
        }, '📍 Punch Anyway'),
        React.createElement('button', {
          onClick: onCancel,
          style:Object.assign({}, BTN, {background:C.surface,color:C.text,border:'1px solid '+C.border})
        }, 'Cancel')
      )
    );
  }

  // ── Init (camera loading) ──
  if (phase === 'init') {
    return React.createElement('div', {style:{textAlign:'center',padding:60}},
      React.createElement('div', {style:{fontSize:48,marginBottom:16,
        animation:'pulse 1.5s infinite'}}, '📷'),
      React.createElement('div', {style:{fontSize:14,color:C.muted}}, 'Opening camera…'),
      React.createElement('button', {
        onClick: onCancel,
        style:Object.assign({}, BTN, {marginTop:24,background:C.surface,color:C.muted,
          border:'1px solid '+C.border,fontSize:12})
      }, '← Cancel')
    );
  }

  // ── Camera live ──
  var ready     = faceOk && motionOk;
  var ringColor = ready ? C.green : faceOk ? C.amber : 'rgba(255,255,255,0.5)';
  var ringStyle = ready ? 'solid' : 'dashed';

  return React.createElement('div', {
    style:{width:'100%',maxWidth:400,margin:'0 auto'}
  },
    // Header
    React.createElement('div', {style:{textAlign:'center',padding:'4px 0',marginBottom:6}},
      React.createElement('div', {style:{fontSize:15,fontWeight:700,color:C.text,
        fontFamily:'var(--font-display)'}}, staffName),
      React.createElement('div', {style:{
        fontSize:12,fontWeight:600,marginTop:2,
        color: ready ? C.green : faceOk ? C.amber : C.muted
      }}, statusMsg)
    ),

    // Video container
    React.createElement('div', {
      style:{position:'relative',width:'100%',paddingTop:'75%',
        background:'#000',borderRadius:20,overflow:'hidden'}
    },
      // Video element
      React.createElement('video', {
        ref: videoRef, autoPlay: true, playsInline: true, muted: true,
        style:{position:'absolute',top:0,left:0,width:'100%',height:'100%',
          objectFit:'cover',transform:'scaleX(-1)'}
      }),

      // Oval face guide
      React.createElement('div', {style:{
        position:'absolute', top:'10%', left:'20%', width:'60%', height:'70%',
        borderRadius:'50%',
        border:'3px ' + ringStyle + ' ' + ringColor,
        boxShadow:'0 0 0 9999px rgba(0,0,0,0.35)',
        transition:'border-color 0.3s, border-style 0.3s',
        pointerEvents:'none'
      }}),

      // Countdown badge
      React.createElement('div', {style:{
        position:'absolute',top:8,right:10,
        background:'rgba(0,0,0,0.55)',color:'#fff',
        padding:'3px 8px',borderRadius:8,fontSize:11,fontWeight:600
      }}, countdown + 's'),

      // Flash overlay
      flash ? React.createElement('div', {style:{
        position:'absolute',top:0,left:0,right:0,bottom:0,
        background:'#fff',opacity:0.85,
        transition:'opacity 0.3s'
      }}) : null
    ),

    // Hidden analysis canvas
    React.createElement('canvas', {ref: canvasRef, style:{display:'none'}}),

    // Controls
    React.createElement('div', {
      style:{display:'flex',gap:12,justifyContent:'center',marginTop:14}
    },
      React.createElement('button', {
        onClick: function(){ cleanup(); onCancel(); },
        style:{padding:'12px 22px',borderRadius:12,fontSize:13,fontWeight:600,
          cursor:'pointer',background:C.surface,color:C.muted,
          border:'1px solid '+C.border,minHeight:48}
      }, '← Cancel'),
      React.createElement('button', {
        onClick: handleCapture,
        disabled: !ready,
        style:{padding:'12px 32px',borderRadius:12,fontSize:16,fontWeight:700,
          cursor: ready ? 'pointer' : 'not-allowed',
          background: ready
            ? 'linear-gradient(135deg,'+C.green+',#1A5030)'
            : '#555',
          color:'#fff', border:'none', minHeight:48,
          opacity: ready ? 1 : 0.5,
          transition:'opacity 0.3s, background 0.3s'}
      }, '📸 Capture')
    ),

    // Ready hint
    !ready ? React.createElement('div', {style:{
      textAlign:'center',fontSize:11,color:C.muted,marginTop:8
    }}, faceOk
      ? 'Move your head slightly to confirm liveness'
      : 'Centre your face inside the oval'
    ) : null
  );
}

export { PunchCapture, requestGPS };