// Ambria FnB — Activity Log
import React, { useState } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, safeArr } from '../utils/helpers.js';
import { Card } from './SharedUI.jsx';

function ActivityLog({lang, currentUser, empDb, attendance, kitchenTracking, events}) {
  var T2 = function(s){return T(s,lang||'en');};
  var [filter, setFilter] = useState('all');
  var logs = [];

  safeArr(attendance).forEach(function(a){
    if(a.in_time){
      logs.push({time:a.date+' '+a.in_time,type:'attendance',icon:'✅',color:'#3EAA68',
        msg:(a.staff_name||a.staff_id)+' punched IN',
        detail:(a.venue||'')+(a.section?' · '+a.section:''),
        sortKey:new Date(a.date+'T'+(a.in_time||'00:00')).getTime()||0});
    }
    if(a.out_time){
      logs.push({time:a.date+' '+a.out_time,type:'attendance',icon:'🚪',color:'#D04040',
        msg:(a.staff_name||a.staff_id)+' punched OUT',
        detail:(a.venue||'')+(a.section?' · '+a.section:''),
        sortKey:new Date(a.date+'T'+(a.out_time||'23:59')).getTime()||0});
    }
    if(a.is_vendor){
      logs.push({time:a.date+' '+(a.in_time||a.out_time||''),type:'vendor',icon:'🏢',color:'#D4914A',
        msg:'Vendor: '+(a.staff_name||'Unknown')+' ('+(a.vendor_company||'')+')',
        detail:(a.vendor_purpose||'')+(a.venue?' · '+a.venue:''),
        sortKey:new Date(a.date+'T'+(a.in_time||'00:00')).getTime()||0});
    }
  });

  var kt=kitchenTracking||{};
  Object.keys(kt).forEach(function(evId){
    Object.keys(kt[evId]||{}).forEach(function(dk){
      var d=kt[evId][dk];
      if(d.storeEnd){
        logs.push({time:d.storeEndAt||'',type:'kitchen',icon:'🏪',color:'#D4B44A',
          msg:'Store sourcing done',detail:evId+' · '+dk,sortKey:d.storeEnd||0});
      }
      if(d.completed||d.ready){
        logs.push({time:d.completedAt||d.readyAt||'',type:'kitchen',icon:'✅',color:'#3EAA68',
          msg:'Dish completed by '+(d.completedBy||'Chef'),detail:evId+' · '+dk,sortKey:1});
      }
      if(d.readyForDispatch){
        logs.push({time:d.dispatchMarkedAt||'',type:'dispatch',icon:'🚛',color:'#4A8FD0',
          msg:'Dispatch ready — '+(d.dispatchMarkedBy||'Chef'),detail:evId+' · '+dk,sortKey:2});
      }
      if(d.selfie){
        logs.push({time:d.completedAt||'',type:'kitchen',icon:'📸',color:'#C084FC',
          msg:'Chef selfie captured by '+(d.completedBy||'Chef'),detail:evId,sortKey:3});
      }
    });
  });

  logs.sort(function(a,b){return (b.sortKey||0)-(a.sortKey||0);});

  var FILTERS=[
    {v:'all',l:'All',c:'#D4B44A'},
    {v:'attendance',l:'Attendance',c:'#3EAA68'},
    {v:'kitchen',l:'Kitchen',c:'#D4914A'},
    {v:'dispatch',l:'Dispatch',c:'#4A8FD0'},
    {v:'vendor',l:'Vendors',c:'#9060C8'},
  ];
  var filtered=filter==='all'?logs:logs.filter(function(l){return l.type===filter;});

  return(
    <div>
      <div style={{fontSize:20,fontWeight:700,color:'#F5F0E8',fontFamily:'var(--font-display)',marginBottom:4}}>📋 {T2('Activity Log')}</div>
      <div style={{fontSize:12,color:'#7A6F62',marginBottom:16}}>{T2('All actions across the app')} — {logs.length} {T2('entries')}</div>
      <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
        {FILTERS.map(function(f){
          var cnt=f.v==='all'?logs.length:logs.filter(function(l){return l.type===f.v;}).length;
          return(
            <button key={f.v} onClick={function(){setFilter(f.v);}}
              style={{padding:'6px 14px',borderRadius:8,fontSize:11,cursor:'pointer',
                background:filter===f.v?f.c+'20':'transparent',
                border:'1px solid '+(filter===f.v?f.c:'#2A2520'),
                color:filter===f.v?f.c:'#7A6F62',fontWeight:filter===f.v?700:400}}>
              {f.l} ({cnt})
            </button>
          );
        })}
      </div>
      {filtered.length===0?(
        <div style={{textAlign:'center',padding:40,color:'#7A6F62'}}>
          <div style={{fontSize:28,marginBottom:8}}>📋</div>
          <div>{T2('No log entries found')}</div>
        </div>
      ):(
        filtered.slice(0,200).map(function(l,i){
          return(
            <div key={i} style={{display:'flex',gap:12,alignItems:'flex-start',padding:'10px 14px',
              marginBottom:4,background:'#141210',borderRadius:10,border:'1px solid #2A2520'}}>
              <div style={{width:32,height:32,borderRadius:8,background:l.color+'15',display:'flex',
                alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{l.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:'#F5F0E8'}}>{l.msg}</div>
                {l.detail&&<div style={{fontSize:11,color:'#7A6F62',marginTop:2}}>{l.detail}</div>}
              </div>
              <div style={{fontSize:10,color:'#4A4238',whiteSpace:'nowrap',marginTop:2}}>{l.time}</div>
            </div>
          );
        })
      )}
    </div>
  );
}


export { ActivityLog };
