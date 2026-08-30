#!/usr/bin/env node
const base=process.env.TEST_MCP_URL||'http://127.0.0.1:3001/mcp';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function parse(text){const d=text.split(/\r?\n/).filter(x=>x.startsWith('data: ')).map(x=>x.slice(6)).join('\n'); if(!d) throw Error(`No SSE data: ${text.slice(0,300)}`); return JSON.parse(d);}
async function post(body,sid){
  const h={'content-type':'application/json','accept':'application/json, text/event-stream'}; if(sid)h['mcp-session-id']=sid;
  const t=Date.now(),r=await fetch(base,{method:'POST',headers:h,body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const text=await r.text(), payload=(r.headers.get('content-type')||'').includes('text/event-stream')?parse(text):(text?JSON.parse(text):null);
  return {status:r.status,sid:r.headers.get('mcp-session-id'),payload,ms:Date.now()-t};
}
const call=(id,name,args)=>({jsonrpc:'2.0',id,method:'tools/call',params:{name,arguments:args}});
const txt=r=>r?.payload?.result?.content?.map(x=>x?.text||'').join('\n')||'';
async function init(label){
  const r=await post({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:`gw-test-${label}`,version:'1'}}});
  if(r.status!==200||!r.sid||r.payload?.error)throw Error(`init ${label} failed ${JSON.stringify(r)}`); return r;
}
async function del(sid){try{await fetch(base,{method:'DELETE',headers:{accept:'application/json','mcp-session-id':sid},signal:AbortSignal.timeout(5000)});}catch{}}
async function main(){
  const a=await init('A'),b=await init('B'); if(a.sid===b.sid)throw Error('duplicate session IDs');
  console.log('SESSIONS',a.sid,b.sid);
  const [ra,rb]=await Promise.all([
    post(call(777777,'start_process',{command:'powershell -NoProfile -Command "Start-Sleep -Milliseconds 1800; Write-Output AAA"',timeout_ms:6000}),a.sid),
    post(call(777777,'start_process',{command:'powershell -NoProfile -Command "Start-Sleep -Milliseconds 100; Write-Output BBB"',timeout_ms:6000}),b.sid)
  ]);
  console.log('SAME_ID_A',ra.status,ra.ms,txt(ra).slice(0,250)); console.log('SAME_ID_B',rb.status,rb.ms,txt(rb).slice(0,250));
  if(ra.status!==200||rb.status!==200||ra.payload?.id!==777777||rb.payload?.id!==777777||!txt(ra).includes('AAA')||!txt(rb).includes('BBB'))throw Error('same-ID isolation failed');

  const ps=await post(call(777778,'start_process',{command:'powershell -NoProfile -Command "Write-Output READY; Start-Sleep -Seconds 10; Write-Output DONE"',timeout_ms:2000}),a.sid);
  const m=txt(ps).match(/PID\s+(\d+)/i); if(!m)throw Error(`PID parse failed: ${txt(ps)}`); const pid=Number(m[1]);
  console.log('PERSIST_PID',pid); await sleep(6500);
  const rr=await post(call(777779,'read_process_output',{pid,timeout_ms:1500,offset:0,length:100}),a.sid);
  console.log('AFTER_IDLE',rr.status,rr.ms,txt(rr).slice(0,400));
  if(rr.status!==200||rr.payload?.error||rr.payload?.id!==777779)throw Error('session persistence failed');

  const h=await fetch(base.replace(/\/mcp$/,'/healthz'),{signal:AbortSignal.timeout(3000)}).then(r=>r.json());
  console.log('HEALTH',JSON.stringify(h)); await Promise.allSettled([del(a.sid),del(b.sid)]); console.log('GATEWAY_CANARY_PASS');
}
main().catch(e=>{console.error('GATEWAY_CANARY_FAIL',e?.stack||e);process.exit(1);});
