import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
const worker='E:\\Dev\\DesktopCommanderMCP\\dist\\index.js';
const t=new StdioClientTransport({command:process.execPath,args:[worker],cwd:'E:\\Dev\\DesktopCommanderMCP',env:{...getDefaultEnvironment(),DC_HTTP_GATEWAY_SESSION:'probe',DC_REMOTE_DEVICE:'true'},stderr:'pipe'});
t.stderr?.on('data',d=>console.error('STDERR',String(d)));
const c=new Client({name:'sdk-probe',version:'1'},{capabilities:{}});
console.log('CONNECT_BEGIN',Date.now());
try {
  await c.connect(t,{timeout:10000});
  console.log('CONNECT_OK',Date.now(),c.getServerVersion(),c.getServerCapabilities());
  const x=await c.listTools();
  console.log('TOOLS_OK',x.tools?.length);
} catch(e) {
  console.error('CONNECT_FAIL',e?.stack||e);
} finally {
  try{await c.close();}catch{}
  try{await t.close();}catch{}
}
