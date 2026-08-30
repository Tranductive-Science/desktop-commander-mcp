import { spawn } from 'node:child_process';
const worker='E:\\Dev\\DesktopCommanderMCP\\dist\\index.js';
const p=spawn(process.execPath,[worker],{
  cwd:'E:\\Dev\\DesktopCommanderMCP',
  env:{...process.env,DC_REMOTE_DEVICE:'true'},
  stdio:['pipe','pipe','pipe']
});
console.log('PID',p.pid);
p.stdout.on('data',d=>console.log('STDOUT',JSON.stringify(String(d))));
p.stderr.on('data',d=>console.log('STDERR',JSON.stringify(String(d))));
p.on('error',e=>console.log('ERROR',e));
p.on('exit',(c,s)=>console.log('EXIT',c,s));
setTimeout(()=>{
  const m={jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'raw-probe',version:'1'}}};
  console.log('SEND',JSON.stringify(m));
  p.stdin.write(JSON.stringify(m)+'\n');
},100);
setTimeout(()=>{console.log('KILL');p.kill();},90000);
