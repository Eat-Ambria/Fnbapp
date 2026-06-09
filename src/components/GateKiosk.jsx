// Ambria FnB — Gate Kiosk (full-screen attendance)
import React, { useState, useRef, useEffect } from "react";
import { C, SECTION_META } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TODAY_LABEL, safeArr } from '../utils/helpers.js';
import { STAFF_LIST, GROOMING_CHECKS } from '../data/staffData.js';
import { Avatar, SelfieCapture } from './SharedUI.jsx';
import { dbUpsert } from '../lib/db.js';

function GateKiosk({empDb, attendance, setAttendance, currentUser, setCurrentUser, lang}) {
  const T2 = s => T(s, lang || 'en');
  const [step, setStep] = useState('dept');
  const [selDept, setSelDept] = useState(null);
  const [selStaff, setSelStaff] = useState(null);
  const [success, setSuccess] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [vendorForm, setVendorForm] = useState({name:'',company:'',purpose:'',section:'',phone:'',vehicle:''});
  const photoRef = useRef(null);

  const venueName = currentUser.venue || 'Ambria';

  const DEPTS = [
    {id:'kitchen',label:'Kitchen',icon:'👨‍🍳',
      sections:['Indian Curries','Tandoor','Chinese','Chaat','Sweets','Continental','Bakery']},
    {id:'service',label:'Service',icon:'🍽'},
    {id:'crockery',label:'Crockery',icon:'🍶'},
    {id:'beverages',label:'Beverages',icon:'🥤'},
    {id:'transport',label:'Transport',icon:'🚛'},
    {id:'odc',label:'ODC',icon:'🏕'},
    {id:'management',label:'Management',icon:'🔐'},
    {id:'maintenance',label:'Maintenance',icon:'🔧'},
    {id:'vendor',label:'Outside Vendor',icon:'🏢'},
  ];

  function getStaffForDept(dept) {
    return safeArr(empDb).filter(function(s) {
      if (s.is_active === false) return false;
      if (s.role === 'kiosk_gate' || s.role === 'admin') return false;
      if (dept.sections) return dept.sections.includes(s.section);
      return s.dept === dept.id;
    });
  }

  function handlePunch(type) {
    var now = new Date();
    var timeStr = now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    var sid = selStaff.staffListId || selStaff.staff_id;
    var todayRec = safeArr(attendance).find(function(a){
      return a.staff_id===sid && a.date===TODAY;
    });
    var recordId = (todayRec && todayRec.id) ? todayRec.id : 'att-'+Date.now();
    var newRecord = {
      id: recordId,
      staff_id: sid,
      staff_name: selStaff.name,
      section: selStaff.section || '',
      dept: selStaff.dept || '',
      date: TODAY,
      status: 'Present',
      in_time: type==='IN' ? timeStr : (todayRec ? todayRec.in_time||'' : ''),
      out_time: type==='OUT' ? timeStr : '',
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
    // localStorage
    try {
      var allAtt = JSON.parse(localStorage.getItem('ambria_attendance')||'[]');
      var idx = allAtt.findIndex(function(a){return a.staff_id===sid && a.date===TODAY;});
      if (idx>=0){allAtt[idx]={...allAtt[idx],...newRecord};}else{allAtt.push(newRecord);}
      localStorage.setItem('ambria_attendance', JSON.stringify(allAtt));
    } catch(e){}
    // Supabase (strip large photo fields to avoid payload limits)
    try {
      if (typeof supabase!=='undefined' && supabase) {
        var dbRec = {id:newRecord.id,staff_id:newRecord.staff_id,staff_name:newRecord.staff_name,
          section:newRecord.section,dept:newRecord.dept,date:newRecord.date,status:newRecord.status,
          in_time:newRecord.in_time,out_time:newRecord.out_time,venue:newRecord.venue};
        supabase.from('attendance').upsert(dbRec,{onConflict:'staff_id,date'})
          .then(function(){}).catch(function(e){console.error('gate att:',e);});
      }
    } catch(e){}
    setSuccess({name:selStaff.name, type:type, time:timeStr});
    setStep('success');
    setTimeout(function(){
      setStep('dept');
      setSelDept(null);
      setSelStaff(null);
      setSuccess(null);
      setPhoto(null);
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
      var allAtt = JSON.parse(localStorage.getItem('ambria_attendance')||'[]');
      allAtt.push(record);
      localStorage.setItem('ambria_attendance', JSON.stringify(allAtt));
    } catch(e){}
    try {
      if (typeof supabase!=='undefined' && supabase) {
        supabase.from('attendance').insert({
          id:vid, staff_id:vid, staff_name:record.staff_name,
          section:record.section, dept:'vendor', date:TODAY,
          status:'Vendor', in_time:record.in_time, out_time:record.out_time,
          venue:venueName
        }).then(function(){}).catch(function(e){console.error(e);});
      }
    } catch(e){}
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

  function handlePhoto(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) { setPhoto(ev.target.result); };
    reader.readAsDataURL(file);
  }

  // ── VENUE HEADER ──
  var header = React.createElement('div', {
    style:{textAlign:'center',padding:'16px',marginBottom:20,
      background:'#1A1714',borderRadius:16,border:'2px solid #D4B44A30'}
  },
    React.createElement('div', {style:{fontSize:22,fontWeight:700,
      color:'#D4B44A',fontFamily:'var(--font-display)'}}, venueName),
    React.createElement('div', {style:{fontSize:12,color:'#7A6F62',marginTop:4}},
      'Gate Kiosk · ' + TODAY_LABEL)
  );

  // ── STEP 1: SELECT DEPARTMENT ──
  if (step === 'dept') {
    return React.createElement('div', null,
      header,
      React.createElement('div', {style:{fontSize:18,fontWeight:700,
        color:'#F5F0E8',textAlign:'center',fontFamily:'var(--font-display)',
        marginBottom:20}}, T2('Select Your Department')),
      React.createElement('div', {style:{display:'grid',
        gridTemplateColumns:'repeat(3,1fr)',gap:12}},
        DEPTS.map(function(d) {
          var count = getStaffForDept(d).length;
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
            style:{background:'#1A1714',border:'2px solid #2A2520',
              borderRadius:16,padding:'24px 12px',cursor:'pointer',
              textAlign:'center',minHeight:110}
          },
            React.createElement('div',{style:{fontSize:32,marginBottom:6}},d.icon),
            React.createElement('div',{style:{fontSize:14,fontWeight:700,
              color:'#F5F0E8'}},d.label),
            React.createElement('div',{style:{fontSize:11,color:'#7A6F62',
              marginTop:4}},d.id==='vendor'?'Entry Form':count+' staff')
          );
        })
      ),
      React.createElement('div', {style:{position:'fixed',bottom:10,right:10}},
        React.createElement('button', {
          onClick: function() { setCurrentUser(null); },
          style:{padding:'6px 14px',borderRadius:8,background:'#1A1714',
            border:'1px solid #2A2520',color:'#4A4238',fontSize:10,
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
        style:{padding:'10px 18px',borderRadius:10,background:'#1A1714',
          border:'1px solid #2A2520',color:'#7A6F62',fontSize:13,
          cursor:'pointer',marginBottom:16,minHeight:44}
      }, '← ' + T2('Back')),
      React.createElement('div', {style:{fontSize:18,fontWeight:700,
        color:'#F5F0E8',fontFamily:'var(--font-display)',marginBottom:16}},
        selDept.icon + ' ' + selDept.label + ' — ' + T2('Select Your Name')),
      Object.keys(grouped).map(function(sec) {
        return React.createElement('div', {key:sec, style:{marginBottom:16}},
          Object.keys(grouped).length > 1 ?
            React.createElement('div', {style:{fontSize:12,fontWeight:700,
              color:'#D4B44A',marginBottom:8,textTransform:'uppercase',
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
              var statusColor = (isIn || isComplete) ? '#3EAA68' : '#7A6F62';
              return React.createElement('button', {
                key: sid,
                onClick: function() { setSelStaff(s); setStep('selfie'); },
                style:{padding:'14px 12px',borderRadius:12,
                  background: (isIn || isComplete) ? '#0A2010' : '#141210',
                  border:'1.5px solid '+((isIn || isComplete) ? '#1A4828' : '#2A2520'),
                  cursor:'pointer',textAlign:'left',minHeight:56}
              },
                React.createElement('div',{style:{fontSize:14,fontWeight:700,
                  color:'#F5F0E8'}},s.name),
                React.createElement('div',{style:{fontSize:11,
                  color:statusColor,marginTop:2}}, statusText)
              );
            })
          )
        );
      }),
      staffList.length === 0 ?
        React.createElement('div', {style:{textAlign:'center',padding:24,
          color:'#7A6F62',fontSize:13}}, T2('No staff in this department')) : null
    );
  }

  // ── STEP 2b: VENDOR ENTRY FORM ──
  if (step === 'vendor') {
    var fld = {width:'100%',padding:'12px',borderRadius:10,
      border:'1px solid #2A2520',fontSize:14,color:'#F5F0E8',
      background:'#141210',boxSizing:'border-box',minHeight:44};
    var lbl = {fontSize:11,fontWeight:700,color:'#7A6F62',marginBottom:4,
      textTransform:'uppercase',letterSpacing:0.8};
    var canSubmitIn = vendorForm.name.trim()&&vendorForm.company.trim()&&vendorForm.purpose&&photo;
    var canSubmitOut = vendorForm.name.trim()&&vendorForm.company.trim();
    return React.createElement('div',null,
      header,
      React.createElement('button',{
        onClick:function(){setStep('dept');setPhoto(null);},
        style:{padding:'10px 18px',borderRadius:10,background:'#1A1714',
          border:'1px solid #2A2520',color:'#7A6F62',fontSize:13,
          cursor:'pointer',marginBottom:16,minHeight:44}
      },'← Back'),
      React.createElement('div',{style:{fontSize:18,fontWeight:700,
        color:'#F5F0E8',fontFamily:'var(--font-display)',marginBottom:16}},
        '🏢 Outside Vendor Entry'),
      React.createElement('div',{style:{background:'#1A1714',borderRadius:14,
        padding:'18px',border:'1px solid #2A2520'}},
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
                borderRadius:12,objectFit:'cover',border:'2px solid #D4B44A'}}),
              React.createElement('button',{
                onClick:function(){photoRef.current&&photoRef.current.click();},
                style:{padding:'8px 16px',borderRadius:10,background:'#1A1714',
                  border:'1px solid #2A2520',color:'#D4B44A',fontSize:12,cursor:'pointer'}
              },'📸 Retake')
            ) :
            React.createElement('button',{
              onClick:function(){photoRef.current&&photoRef.current.click();},
              style:{padding:'14px 20px',borderRadius:12,width:'100%',
                background:'linear-gradient(135deg,#D4B44A,#A8891E)',
                color:'#0A0908',border:'none',fontSize:13,fontWeight:700,
                cursor:'pointer',minHeight:48,boxSizing:'border-box'}
            },'📸 Take Visitor Photo')
        ),
        React.createElement('div',{style:{display:'flex',gap:10,marginTop:8}},
          React.createElement('button',{
            onClick:function(){handleVendorPunch('IN');},
            disabled:!canSubmitIn,
            style:{flex:1,padding:'16px',borderRadius:12,fontSize:16,fontWeight:700,
              cursor:canSubmitIn?'pointer':'not-allowed',minHeight:56,
              background:canSubmitIn?'linear-gradient(135deg,#3EAA68,#1A5030)':'#333',
              color:canSubmitIn?'#fff':'#666',border:'none'}
          },'✅ VENDOR IN'),
          React.createElement('button',{
            onClick:function(){handleVendorPunch('OUT');},
            disabled:!canSubmitOut,
            style:{flex:1,padding:'16px',borderRadius:12,fontSize:16,fontWeight:700,
              cursor:canSubmitOut?'pointer':'not-allowed',minHeight:56,
              background:canSubmitOut?'linear-gradient(135deg,#D04040,#8A1010)':'#333',
              color:canSubmitOut?'#fff':'#666',border:'none'}
          },'🚪 VENDOR OUT')
        )
      )
    );
  }

  // ── STEP 3: SELFIE + PUNCH ──
  if (step === 'selfie' && selStaff) {
    var sid3 = selStaff.staffListId || selStaff.staff_id;
    var todayRec3 = safeArr(attendance).find(function(a){
      return a.staff_id===sid3 && a.date===TODAY;
    });
    var punchedIn3  = todayRec3 && todayRec3.in_time;
    var punchedOut3 = todayRec3 && todayRec3.out_time;
    var punchEl = punchedIn3 && punchedOut3
      ? React.createElement('div',{style:{padding:20,background:'#0A2010',borderRadius:14,
          border:'1px solid #1A4828'}},
          React.createElement('div',{style:{fontSize:16,color:'#3EAA68',fontWeight:700}},
            '✅ Attendance complete'),
          React.createElement('div',{style:{fontSize:13,color:'#7A6F62',marginTop:4}},
            'IN: '+todayRec3.in_time+' · OUT: '+todayRec3.out_time)
        )
      : punchedIn3
        ? React.createElement('div',null,
            React.createElement('div',{style:{fontSize:13,color:'#3EAA68',marginBottom:10,fontWeight:700}},
              '✅ Punched IN at '+todayRec3.in_time),
            React.createElement('button',{
              onClick:function(){handlePunch('OUT');},
              style:{padding:'18px 50px',borderRadius:14,fontSize:18,fontWeight:700,
                cursor:'pointer',minHeight:64,width:'100%',maxWidth:320,
                background:'linear-gradient(135deg,#D04040,#8A1010)',
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
      React.createElement('div',{style:{fontSize:22,fontWeight:700,color:'#F5F0E8',
        fontFamily:'var(--font-display)',marginBottom:4}},selStaff.name),
      React.createElement('div',{style:{fontSize:13,color:'#7A6F62',marginBottom:20}},
        (selStaff.section||selStaff.dept)+' · '+(selStaff.staffListId||selStaff.staff_id)),
      photo ? React.createElement('div',{style:{marginBottom:16}},
        React.createElement('img',{src:photo,style:{width:140,height:140,
          borderRadius:20,objectFit:'cover',border:'3px solid #D4B44A'}}),
        React.createElement('div',{style:{fontSize:11,color:'#3EAA68',marginTop:6,fontWeight:700}},
          '✅ Selfie captured')
      ) : null,
      React.createElement('div',{style:{marginBottom:20}},
        React.createElement('input',{
          ref:photoRef,type:'file',accept:'image/*',capture:'user',
          onChange:handlePhoto,style:{display:'none'}
        }),
        React.createElement('button',{
          onClick:function(){photoRef.current&&photoRef.current.click();},
          style:{padding:'16px 32px',borderRadius:14,
            background:photo?'#1A1714':'linear-gradient(135deg,#D4B44A,#A8891E)',
            color:photo?'#D4B44A':'#0A0908',
            border:photo?'2px solid #D4B44A':'none',
            fontSize:15,fontWeight:700,cursor:'pointer',minHeight:54}
        }, photo?'📸 Retake Selfie':'📸 Take Selfie First')
      ),
      photo
        ? React.createElement('div',{style:{marginTop:8}}, punchEl)
        : React.createElement('div',{style:{fontSize:12,color:'#D4914A',marginTop:8}},
            '⚠️ Take selfie first to enable punch button'),
      React.createElement('button',{
        onClick:function(){setStep('name');setSelStaff(null);setPhoto(null);},
        style:{marginTop:20,padding:'10px 24px',borderRadius:10,
          background:'#1A1714',border:'1px solid #2A2520',
          color:'#7A6F62',fontSize:12,cursor:'pointer'}
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
        color:'#F5F0E8',fontFamily:'var(--font-display)',marginBottom:8}},
        success.name),
      React.createElement('div',{style:{fontSize:20,
        color:success.type==='IN'?'#3EAA68':'#D4914A',
        fontWeight:700,marginBottom:4}},
        (success.type==='IN'?'PUNCHED IN':'PUNCHED OUT')+' at '+success.time),
      React.createElement('div',{style:{fontSize:16,color:'#7A6F62',
        marginTop:24}},
        'Returning in 4 seconds...')
    );
  }

  return React.createElement('div',{style:{textAlign:'center',
    padding:40,color:'#7A6F62'}},'Loading...');
}

// ── Unified attendance record schema ──────────────────────────────
// Every attendance record in state always has BOTH naming conventions so
// GateKiosk (staff_id / in_time / out_time) and legacy KioskAttendance
// (staffId / time / punchOut) components can read each other's records.

export { GateKiosk };
