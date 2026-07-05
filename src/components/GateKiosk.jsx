// Ambria FnB — Gate Kiosk (full-screen attendance)
import React, { useState, useRef, useEffect } from "react";
import { C, SECTION_META, TEAM_DEPTS } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TODAY_LABEL, safeArr, calcHoursWorked, fmtHours, classifyDay, genPunchId } from '../utils/helpers.js';
import { GROOMING_CHECKS } from '../data/staffData.js';
import { Avatar, SelfieCapture } from './SharedUI.jsx';
import { PunchCapture } from './PunchCapture.jsx';
import { dbUpsert } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';
import { logActivity } from './ActivityLog.jsx';

function GateKiosk({empDb, attendance, setAttendance, currentUser, setCurrentUser, lang}) {
  const T2 = s => T(s, lang || 'en');
  const [step, setStep] = useState('dept');
  const [selDept, setSelDept] = useState(null);
  const [selStaff, setSelStaff] = useState(null);
  const [success, setSuccess] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [vendorForm, setVendorForm] = useState({name:'',company:'',purpose:'',section:'',phone:'',vehicle:''});
  const [gpsData, setGpsData] = useState(null);
  const photoRef = useRef(null);

  const venueName = currentUser.venue || 'Ambria';

  const DEPTS = React.useMemo(function(){
    var arr = (TEAM_DEPTS||[]).map(function(d){ return {id:d.id,label:d.label,icon:d.icon,sections:d.sections||[]}; });
    arr.push({id:'vendor',label:'Outside Vendor',icon:'🏢'});
    return arr;
  }, [TEAM_DEPTS.length]);

  function getStaffForDept(dept) {
    var secSet = new Set((dept.sections||[]).map(function(x){return x.toLowerCase();}));
    function matchesDept(s) {
      if (secSet.size && secSet.has((s.section||'').toLowerCase())) return true;
      if (s.dept && s.dept === dept.id) return true;
      return false;
    }
    // First try empDb (Supabase staff records)
    var dbStaff = safeArr(empDb).filter(function(s) {
      if (s.is_active === false) return false;
      if (s.role === 'kiosk_gate') return false;
      if (s.role && s.role.startsWith('section_')) return false;
      return matchesDept(s);
    });
    return dbStaff;
  }

  function handlePunch(type) {
    var punchId = genPunchId();
    var now = new Date();
    var timeStr = now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    var sid = selStaff.staffListId || selStaff.staff_id;
    var todayRec = safeArr(attendance).find(function(a){
      return a.staff_id===sid && a.date===TODAY;
    });
    var recordId = (todayRec && todayRec.id) ? todayRec.id : 'att-'+Date.now();
    var inTime = type==='IN' ? timeStr : (todayRec ? todayRec.in_time||'' : '');
    var outTime = type==='OUT' ? timeStr : '';
    var dayClass = outTime ? classifyDay(inTime, outTime) : {status:'Present',hours:null};
    var hoursWorked = outTime ? calcHoursWorked(inTime, outTime) : null;
    var newRecord = {
      id: recordId,
      staff_id: sid,
      staff_name: selStaff.name,
      section: selStaff.section || '',
      dept: selStaff.dept || '',
      date: TODAY,
      status: dayClass.status,
      in_time: inTime,
      out_time: outTime,
      client_punch_id: punchId,
      in_photo: type==='IN' ? photo : (todayRec ? todayRec.in_photo||null : null),
      out_photo: type==='OUT' ? photo : null,
      venue: venueName,
      method: 'kiosk',
    };
    // Update React state
    setAttendance(function(prev) {
      var exists = prev.find(function(a){return a.id===recordId;});
      if (exists) return prev.map(function(a){return a.id===recordId?{...a,...newRecord}:a;});
      return [...prev, newRecord];
    });
    
    // Supabase — upsert record then upload compressed photo
    try {
      if (typeof supabase!=='undefined' && supabase) {
        var dbRec = {id:newRecord.id,staff_id:newRecord.staff_id,staff_name:newRecord.staff_name,
          section:newRecord.section,dept:newRecord.dept,date:newRecord.date,status:newRecord.status,
          in_time:newRecord.in_time,out_time:newRecord.out_time,venue:newRecord.venue,
          client_punch_id:punchId,hours_worked:hoursWorked};
        if (gpsData && type==='IN') {
          dbRec.in_latitude=gpsData.latitude; dbRec.in_longitude=gpsData.longitude;
          dbRec.in_gps_accuracy=gpsData.accuracy; dbRec.in_location=gpsData.areaName||null;
        }
        if (gpsData && type==='OUT') {
          dbRec.out_latitude=gpsData.latitude; dbRec.out_longitude=gpsData.longitude;
          dbRec.out_gps_accuracy=gpsData.accuracy; dbRec.out_location=gpsData.areaName||null;
        }
        supabase.from('attendance').upsert(dbRec,{onConflict:'staff_id,date'})
          .then(function(){
            if (photoBlob) {
              var photoField = type==='IN' ? 'in_photo_url' : 'out_photo_url';
              uploadPhoto(photoBlob, sid, type.toLowerCase()).then(function(url) {
                if (url) {
                  var upd = {}; upd[photoField] = url;
                  supabase.from('attendance').update(upd).eq('staff_id',sid).eq('date',TODAY)
                    .then(function(){}).catch(function(e){console.error('photo url save:',e);});
                }
              });
            }
          }).catch(function(e){console.error('gate att:',e);});
      }
    } catch(e){}
    logActivity('attendance', selStaff.name+' punched '+type, 'punch_'+type.toLowerCase(), {staff_id:sid, venue:venueName, section:selStaff.section||''});
    setSuccess({name:selStaff.name, type:type, time:timeStr});
    setStep('success');
    setTimeout(function(){
      setStep('dept');
      setSelDept(null);
      setSelStaff(null);
      setSuccess(null);
      setPhoto(null);
      setPhotoBlob(null);
      setGpsData(null);
    }, 4000);
  }

  function handleVendorPunch(type) {
    var now = new Date();
    var timeStr = now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    var vid = 'VND-'+Date.now();
    var record = {
      id: vid,
      staff_id: vid,
      staff_name: vendorForm.name.trim(),
      section: vendorForm.section || 'Vendor',
      dept: 'vendor',
      date: TODAY,
      status: 'Vendor',
      in_time: type==='IN' ? timeStr : '',
      out_time: type==='OUT' ? timeStr : '',
      venue: venueName,
      vendor_company: vendorForm.company.trim(),
      vendor_purpose: vendorForm.purpose,
      vendor_phone: vendorForm.phone,
      vendor_vehicle: vendorForm.vehicle,
      photo: photo || null,
      is_vendor: true,
    };
    setAttendance(function(prev){ return [...prev, record]; });
    
    try {
      if (typeof supabase!=='undefined' && supabase) {
        supabase.from('attendance').insert({
          id:vid, staff_id:vid, staff_name:record.staff_name,
          section:record.section, dept:'vendor', date:TODAY,
          status:'Vendor', in_time:record.in_time, out_time:record.out_time,
          venue:venueName
        }).then(function(){
            if (photoBlob) {
              uploadPhoto(photoBlob, vid, 'vendor').then(function(url) {
                if (url) {
                  supabase.from('attendance').update({in_photo_url:url}).eq('id',vid)
                    .then(function(){}).catch(function(e){console.error('vendor photo save:',e);});
                }
              });
            }
          }).catch(function(e){console.error(e);});
      }
    } catch(e){}
    logActivity('vendor', 'Vendor: '+vendorForm.name.trim()+' ('+vendorForm.company.trim()+') '+type, 'vendor_punch_'+type.toLowerCase(), {vendor:vendorForm.name.trim(), company:vendorForm.company.trim(), purpose:vendorForm.purpose, venue:venueName});
    setSuccess({name:vendorForm.name+' ('+vendorForm.company+')', type:type, time:timeStr});
    setStep('success');
    setTimeout(function(){
      setStep('dept');
      setSelDept(null);
      setSelStaff(null);
      setSuccess(null);
      setPhoto(null);
      setVendorForm({name:'',company:'',purpose:'',section:'',phone:'',vehicle:''});
    }, 4000);
  }

  function compressImage(file, maxDim, quality) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.onload = function() {
        var w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          var ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(blob) { resolve(blob); }, 'image/jpeg', quality);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  function uploadPhoto(blob, staffId, punchType) {
    if (!supabase || !blob) return Promise.resolve(null);
    var path = TODAY + '/' + staffId + '_' + punchType + '_' + Date.now() + '.jpg';
    return supabase.storage.from('attendance-photos').upload(path, blob, {
      contentType: 'image/jpeg', upsert: true
    }).then(function(res) {
      if (res.error) { console.error('photo upload:', res.error); return null; }
      var urlRes = supabase.storage.from('attendance-photos').getPublicUrl(path);
      return urlRes.data ? urlRes.data.publicUrl : null;
    }).catch(function(e) { console.error('photo upload:', e); return null; });
  }

  function handlePhoto(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    compressImage(file, 480, 0.65).then(function(blob) {
      var reader = new FileReader();
      reader.onload = function(ev) { setPhoto(ev.target.result); };
      reader.readAsDataURL(blob);
      setPhotoBlob(blob);
    });
  }

  // ── VENUE HEADER ──
  var header = React.createElement('div', {
    style:{textAlign:'center',padding:'16px',marginBottom:20,
      background:C.surface,borderRadius:16,border:'1px solid '+C.border,
      boxShadow:'0 2px 8px rgba(0,0,0,.06)'}
  },
    React.createElement('div', {style:{fontSize:22,fontWeight:700,
      color:C.wine,fontFamily:'var(--font-display)'}}, venueName),
    React.createElement('div', {style:{fontSize:12,color:C.muted,marginTop:4}},
      'Gate Kiosk · ' + TODAY_LABEL)
  );

  // ── STEP 1: SELECT DEPARTMENT ──
  if (step === 'dept') {
    return React.createElement('div', null,
      header,
      React.createElement('div', {style:{fontSize:18,fontWeight:700,
        color:C.wine,textAlign:'center',fontFamily:'var(--font-display)',
        marginBottom:6}}, T2('Select Your Department')),
      React.createElement('div', {style:{fontSize:12,color:C.muted,
        textAlign:'center',marginBottom:16}},
        (function(){
          var todayTotal = safeArr(attendance).filter(function(a){return a.date===TODAY && !a.is_vendor;}).length;
          var todayIn = safeArr(attendance).filter(function(a){return a.date===TODAY && !a.is_vendor && a.in_time && !a.out_time;}).length;
          return todayTotal>0 ? todayIn+' currently in · '+todayTotal+' punched today' : 'No punches yet today';
        })()
      ),
      React.createElement('div', {style:{display:'grid',
        gridTemplateColumns:'repeat(3,1fr)',gap:12}},
        DEPTS.map(function(d) {
          var count = getStaffForDept(d).length;
          var deptIn = safeArr(attendance).filter(function(a){
            return a.date===TODAY && !a.is_vendor && a.in_time && !a.out_time
              && d.sections && d.sections.includes(a.section);
          }).length;
          return React.createElement('button', {
            key: d.id,
            onClick: function() {
              if (d.id === 'vendor') {
                setVendorForm({name:'',company:'',purpose:'',section:'',phone:'',vehicle:''});
                setStep('vendor');
              } else {
                setSelDept(d);
                setStep('name');
              }
            },
            style:{background:C.surface,border:'1.5px solid '+(deptIn>0?C.greenBorder:C.border),
              borderRadius:16,padding:'24px 12px',cursor:'pointer',
              textAlign:'center',minHeight:110,
              boxShadow:'0 2px 8px rgba(0,0,0,.04)'}
          },
            React.createElement('div',{style:{fontSize:32,marginBottom:6}},d.icon),
            React.createElement('div',{style:{fontSize:14,fontWeight:700,
              color:C.text}},d.label),
            React.createElement('div',{style:{fontSize:11,color:deptIn>0?C.green:C.muted,
              marginTop:4}},d.id==='vendor'?'Entry Form':(deptIn>0?deptIn+' in · ':'')+count+' staff')
          );
        })
      ),
      React.createElement('div', {style:{position:'fixed',bottom:10,right:10}},
        React.createElement('button', {
          onClick: function() { setCurrentUser(null); },
          style:{padding:'6px 14px',borderRadius:8,background:C.surface,
            border:'1px solid '+C.border,color:C.muted,fontSize:10,
            cursor:'pointer'}
        }, 'Sign Out')
      )
    );
  }

  // ── STEP 2: SELECT NAME ──
  if (step === 'name' && selDept) {
    var staffList = getStaffForDept(selDept);
    var grouped = {};
    staffList.forEach(function(s) {
      var sec = s.section || s.dept || 'Other';
      if (!grouped[sec]) grouped[sec] = [];
      grouped[sec].push(s);
    });
    return React.createElement('div', null,
      header,
      React.createElement('button', {
        onClick: function() { setStep('dept'); setSelDept(null); },
        style:{padding:'10px 18px',borderRadius:10,background:C.surface,
          border:'1px solid '+C.border,color:C.muted,fontSize:13,
          cursor:'pointer',marginBottom:16,minHeight:44}
      }, '← ' + T2('Back')),
      React.createElement('div', {style:{fontSize:18,fontWeight:700,
        color:C.text,fontFamily:'var(--font-display)',marginBottom:16}},
        selDept.icon + ' ' + selDept.label + ' — ' + T2('Select Your Name')),
      Object.keys(grouped).map(function(sec) {
        return React.createElement('div', {key:sec, style:{marginBottom:16}},
          Object.keys(grouped).length > 1 ?
            React.createElement('div', {style:{fontSize:12,fontWeight:700,
              color:C.wine,marginBottom:8,textTransform:'uppercase',
              letterSpacing:0.8}}, sec) : null,
          React.createElement('div', {style:{display:'grid',
            gridTemplateColumns:'repeat(2,1fr)',gap:8}},
            grouped[sec].map(function(s) {
              var sid = s.staffListId || s.staff_id;
              var todayAtt = safeArr(attendance).find(function(a) {
                return a.staff_id === sid && a.date === TODAY;
              });
              var isComplete = todayAtt && todayAtt.in_time && todayAtt.out_time;
              var isIn = todayAtt && todayAtt.in_time && !todayAtt.out_time;
              var statusText = isComplete
                ? '✅ IN: '+todayAtt.in_time+' · OUT: '+todayAtt.out_time
                : isIn
                  ? '✅ IN since '+todayAtt.in_time
                  : '⬜ Not yet punched in';
              var statusColor = (isIn || isComplete) ? C.green : C.muted;
              return React.createElement('button', {
                key: sid,
                onClick: function() { setSelStaff(s); setStep('selfie'); },
                style:{padding:'14px 12px',borderRadius:12,
                  background: (isIn || isComplete) ? C.greenBg : C.surface,
                  border:'1.5px solid '+((isIn || isComplete) ? C.greenBorder : C.border),
                  cursor:'pointer',textAlign:'left',minHeight:72,
                  display:'flex',alignItems:'center',gap:12}
              },
                s.photo_url
                  ? React.createElement('img',{src:s.photo_url,style:{width:52,height:52,borderRadius:'50%',objectFit:'cover',border:'1px solid '+C.border,flexShrink:0}})
                  : React.createElement('div',{style:{width:52,height:52,borderRadius:'50%',background:C.bg,border:'1px solid '+C.border,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,color:C.muted,flexShrink:0}},(s.name||'?').charAt(0).toUpperCase()),
                React.createElement('div',{style:{flex:1,minWidth:0}},
                  React.createElement('div',{style:{fontSize:14,fontWeight:700,
                    color:C.text}},s.name),
                  React.createElement('div',{style:{fontSize:11,
                    color:statusColor,marginTop:2}}, statusText)
                )
              );
            })
          )
        );
      }),
      staffList.length === 0 ?
        React.createElement('div', {style:{textAlign:'center',padding:24,
          color:C.muted,fontSize:13}}, T2('No staff in this department')) : null
    );
  }

  // ── STEP 2b: VENDOR ENTRY FORM ──
  if (step === 'vendor') {
    var fld = {width:'100%',padding:'12px',borderRadius:10,
      border:'1px solid '+C.border,fontSize:14,color:C.text,
      background:C.bg,boxSizing:'border-box',minHeight:44};
    var lbl = {fontSize:11,fontWeight:700,color:C.muted,marginBottom:4,
      textTransform:'uppercase',letterSpacing:0.8};
    var canSubmitIn = vendorForm.name.trim()&&vendorForm.company.trim()&&vendorForm.purpose&&photo;
    var canSubmitOut = vendorForm.name.trim()&&vendorForm.company.trim();
    return React.createElement('div',null,
      header,
      React.createElement('button',{
        onClick:function(){setStep('dept');setPhoto(null);},
        style:{padding:'10px 18px',borderRadius:10,background:C.surface,
          border:'1px solid '+C.border,color:C.muted,fontSize:13,
          cursor:'pointer',marginBottom:16,minHeight:44}
      },'← Back'),
      React.createElement('div',{style:{fontSize:18,fontWeight:700,
        color:C.text,fontFamily:'var(--font-display)',marginBottom:16}},
        '🏢 Outside Vendor Entry'),
      React.createElement('div',{style:{background:C.surface,borderRadius:14,
        padding:'18px',border:'1px solid '+C.border}},
        React.createElement('div',{style:{marginBottom:12}},
          React.createElement('div',{style:lbl},'Visitor Name *'),
          React.createElement('input',{value:vendorForm.name,
            onChange:function(e){setVendorForm(function(p){return{...p,name:e.target.value};});},
            placeholder:'Enter full name',style:fld})
        ),
        React.createElement('div',{style:{marginBottom:12}},
          React.createElement('div',{style:lbl},'Company / Vendor Name *'),
          React.createElement('input',{value:vendorForm.company,
            onChange:function(e){setVendorForm(function(p){return{...p,company:e.target.value};});},
            placeholder:'e.g. Fresh Farms, Gupta Traders',style:fld})
        ),
        React.createElement('div',{style:{marginBottom:12}},
          React.createElement('div',{style:lbl},'Purpose of Visit *'),
          React.createElement('select',{value:vendorForm.purpose,
            onChange:function(e){setVendorForm(function(p){return{...p,purpose:e.target.value};});},
            style:fld},
            React.createElement('option',{value:''},'Select purpose'),
            React.createElement('option',{value:'Delivery'},'📦 Delivery'),
            React.createElement('option',{value:'Pickup'},'🚛 Pickup'),
            React.createElement('option',{value:'Maintenance'},'🔧 Maintenance / Repair'),
            React.createElement('option',{value:'Meeting'},'🤝 Meeting'),
            React.createElement('option',{value:'Installation'},'⚙️ Installation'),
            React.createElement('option',{value:'Inspection'},'🔍 Inspection'),
            React.createElement('option',{value:'Other'},'📋 Other')
          )
        ),
        React.createElement('div',{style:{marginBottom:12}},
          React.createElement('div',{style:lbl},'Visiting Section / Department'),
          React.createElement('select',{value:vendorForm.section,
            onChange:function(e){setVendorForm(function(p){return{...p,section:e.target.value};});},
            style:fld},
            React.createElement('option',{value:''},'Select section'),
            React.createElement('option',{value:'Kitchen'},'Kitchen'),
            React.createElement('option',{value:'Service'},'Service'),
            React.createElement('option',{value:'Crockery'},'Crockery'),
            React.createElement('option',{value:'Beverages'},'Beverages'),
            React.createElement('option',{value:'Transport'},'Transport'),
            React.createElement('option',{value:'ODC'},'ODC'),
            React.createElement('option',{value:'Management'},'Management'),
            React.createElement('option',{value:'Maintenance'},'Maintenance'),
            React.createElement('option',{value:'General'},'General / Multiple')
          )
        ),
        React.createElement('div',{style:{marginBottom:12}},
          React.createElement('div',{style:lbl},'Phone Number'),
          React.createElement('input',{value:vendorForm.phone,
            onChange:function(e){setVendorForm(function(p){return{...p,phone:e.target.value.replace(/[^0-9]/g,'').slice(0,10)};});},
            placeholder:'10 digit mobile',inputMode:'numeric',maxLength:10,style:fld})
        ),
        React.createElement('div',{style:{marginBottom:12}},
          React.createElement('div',{style:lbl},'Vehicle Number'),
          React.createElement('input',{value:vendorForm.vehicle,
            onChange:function(e){setVendorForm(function(p){return{...p,vehicle:e.target.value.toUpperCase()};});},
            placeholder:'e.g. DL 01 AB 1234',style:fld})
        ),
        React.createElement('div',{style:{marginBottom:16}},
          React.createElement('div',{style:lbl},'Visitor Photo *'),
          React.createElement('input',{
            ref:photoRef,type:'file',accept:'image/*',capture:'user',
            onChange:handlePhoto,style:{display:'none'}
          }),
          photo ?
            React.createElement('div',{style:{display:'flex',gap:12,alignItems:'center'}},
              React.createElement('img',{src:photo,style:{width:80,height:80,
                borderRadius:12,objectFit:'cover',border:'2px solid '+C.gold}}),
              React.createElement('button',{
                onClick:function(){photoRef.current&&photoRef.current.click();},
                style:{padding:'8px 16px',borderRadius:10,background:C.bg,
                  border:'1px solid '+C.border,color:C.wine,fontSize:12,cursor:'pointer'}
              },'📸 Retake')
            ) :
            React.createElement('button',{
              onClick:function(){photoRef.current&&photoRef.current.click();},
              style:{padding:'14px 20px',borderRadius:12,width:'100%',
                background:'linear-gradient(135deg,'+C.wine+',#6D4A25)',
                color:'#fff',border:'none',fontSize:13,fontWeight:700,
                cursor:'pointer',minHeight:48,boxSizing:'border-box'}
            },'📸 Take Visitor Photo')
        ),
        React.createElement('div',{style:{display:'flex',gap:10,marginTop:8}},
          React.createElement('button',{
            onClick:function(){handleVendorPunch('IN');},
            disabled:!canSubmitIn,
            style:{flex:1,padding:'16px',borderRadius:12,fontSize:16,fontWeight:700,
              cursor:canSubmitIn?'pointer':'not-allowed',minHeight:56,
              background:canSubmitIn?'linear-gradient(135deg,'+C.green+',#147A54)':C.border,
              color:canSubmitIn?'#fff':'#666',border:'none'}
          },'✅ VENDOR IN'),
          React.createElement('button',{
            onClick:function(){handleVendorPunch('OUT');},
            disabled:!canSubmitOut,
            style:{flex:1,padding:'16px',borderRadius:12,fontSize:16,fontWeight:700,
              cursor:canSubmitOut?'pointer':'not-allowed',minHeight:56,
              background:canSubmitOut?'linear-gradient(135deg,'+C.red+',#8A1010)':C.border,
              color:canSubmitOut?'#fff':'#666',border:'none'}
          },'🚪 VENDOR OUT')
        )
      )
    );
  }

  // ── STEP 3: SELFIE + PUNCH ──
  if (step === 'selfie' && selStaff) {
    // No photo yet → PunchCapture (programmatic camera + GPS)
    if (!photo) {
      var _sid = selStaff.staffListId || selStaff.staff_id;
      var _rec = safeArr(attendance).find(function(a){ return a.staff_id===_sid && a.date===TODAY; });
      var _isIn = _rec && _rec.in_time && !_rec.out_time;
      return React.createElement('div',{style:{padding:'20px 16px'}},
        header,
        React.createElement(PunchCapture, {
          punchType: _isIn ? 'out' : 'in',
          staffName: selStaff.name,
          onComplete: function(result) {
            setPhoto(result.dataUrl);
            setPhotoBlob(result.blob);
            setGpsData(result.gps || null);
          },
          onCancel: function() {
            setStep('name'); setSelStaff(null); setPhoto(null); setGpsData(null);
          }
        })
      );
    }
    var sid3 = selStaff.staffListId || selStaff.staff_id;
    var todayRec3 = safeArr(attendance).find(function(a){
      return a.staff_id===sid3 && a.date===TODAY;
    });
    var punchedIn3  = todayRec3 && todayRec3.in_time;
    var punchedOut3 = todayRec3 && todayRec3.out_time;
    var punchEl = punchedIn3 && punchedOut3
      ? React.createElement('div',{style:{padding:20,background:C.greenBg,borderRadius:14,
          border:'1px solid '+C.greenBorder}},
          React.createElement('div',{style:{fontSize:16,color:C.green,fontWeight:700}},
            '✅ Attendance complete'),
          React.createElement('div',{style:{fontSize:13,color:C.muted,marginTop:4}},
            'IN: '+todayRec3.in_time+' · OUT: '+todayRec3.out_time)
        )
      : punchedIn3
        ? React.createElement('div',null,
            React.createElement('div',{style:{fontSize:13,color:C.green,marginBottom:10,fontWeight:700}},
              '✅ Punched IN at '+todayRec3.in_time),
            React.createElement('button',{
              onClick:function(){handlePunch('OUT');},
              style:{padding:'18px 50px',borderRadius:14,fontSize:18,fontWeight:700,
                cursor:'pointer',minHeight:64,width:'100%',maxWidth:320,
                background:'linear-gradient(135deg,'+C.red+',#8A1010)',
                color:'#fff',border:'none'}
            },'🚪 PUNCH OUT')
          )
        : React.createElement('button',{
            onClick:function(){handlePunch('IN');},
            style:{padding:'18px 50px',borderRadius:14,fontSize:18,fontWeight:700,
              cursor:'pointer',minHeight:64,width:'100%',maxWidth:320,
              background:'linear-gradient(135deg,#3EAA68,#1A5030)',
              color:'#fff',border:'none'}
          },'✅ PUNCH IN');
    return React.createElement('div',{style:{textAlign:'center',padding:'30px 20px'}},
      header,
      React.createElement('div',{style:{fontSize:48,marginBottom:8}},'📸'),
      React.createElement('div',{style:{fontSize:22,fontWeight:700,color:C.text,
        fontFamily:'var(--font-display)',marginBottom:4}},selStaff.name),
      React.createElement('div',{style:{fontSize:13,color:C.muted,marginBottom:20}},
        (selStaff.section||selStaff.dept)+' · '+(selStaff.staffListId||selStaff.staff_id)),
      React.createElement('div',{style:{marginBottom:16}},
        React.createElement('img',{src:photo,style:{width:140,height:140,
          borderRadius:20,objectFit:'cover',border:'3px solid '+C.wine}}),
        React.createElement('div',{style:{fontSize:11,color:C.green,marginTop:6,fontWeight:700}},
          '✅ Selfie captured')
      ),
      React.createElement('div',{style:{marginBottom:12,textAlign:'center'}},
        React.createElement('button',{
          onClick:function(){setPhoto(null);setPhotoBlob(null);setGpsData(null);},
          style:{padding:'8px 20px',borderRadius:10,background:C.surface,
            border:'1px solid '+C.border,color:C.wine,fontSize:12,fontWeight:600,cursor:'pointer'}
        },'📸 Retake'),
        gpsData
          ? React.createElement('div',{style:{fontSize:11,color:C.green,marginTop:8}},
              '📍 '+(gpsData.areaName||(gpsData.latitude.toFixed(4)+', '+gpsData.longitude.toFixed(4)))
              +(gpsData.accuracy?' (±'+Math.round(gpsData.accuracy)+'m)':''))
          : React.createElement('div',{style:{fontSize:11,color:C.amber,marginTop:8}},
              '📍 No GPS — location not recorded')
      ),
      React.createElement('div',{style:{marginTop:8}}, punchEl),
      React.createElement('button',{
        onClick:function(){setStep('name');setSelStaff(null);setPhoto(null);},
        style:{marginTop:20,padding:'10px 24px',borderRadius:10,
          background:C.surface,border:'1px solid '+C.border,
          color:C.muted,fontSize:12,cursor:'pointer'}
      },'← Wrong person? Go back')
    );
  }

  // ── STEP 4: SUCCESS + AUTO RETURN ──
  if (step === 'success' && success) {
    return React.createElement('div', {style:{textAlign:'center',
      padding:'80px 20px'}},
      React.createElement('div',{style:{fontSize:64,marginBottom:16}},
        success.type==='IN'?'✅':'🚪'),
      React.createElement('div',{style:{fontSize:28,fontWeight:700,
        color:C.text,fontFamily:'var(--font-display)',marginBottom:8}},
        success.name),
      React.createElement('div',{style:{fontSize:20,
        color:success.type==='IN'?C.green:C.amber,
        fontWeight:700,marginBottom:4}},
        (success.type==='IN'?'PUNCHED IN':'PUNCHED OUT')+' at '+success.time),
      React.createElement('div',{style:{fontSize:16,color:C.muted,
        marginTop:24}},
        'Returning in 4 seconds...')
    );
  }

  return React.createElement('div',{style:{textAlign:'center',
    padding:40,color:C.muted}},'Loading...');
}

// ── Unified attendance record schema ──────────────────────────────
// Every attendance record in state always has BOTH naming conventions so
// GateKiosk (staff_id / in_time / out_time) and legacy KioskAttendance
// (staffId / time / punchOut) components can read each other's records.

export { GateKiosk };
