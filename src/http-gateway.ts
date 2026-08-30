#!/usr/bin/env node
// @ts-nocheck
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DC_ROOT || path.resolve(here, '..');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const WORKER = process.env.DC_STDIO_WORKER || path.join(ROOT, 'dist', 'index.js');
const LOG = process.env.GATEWAY_LOG || path.join(ROOT, 'gateway.log');
const IDLE = Number(process.env.SESSION_IDLE_MS || 30 * 60 * 1000);
const MAX = Number(process.env.MAX_SESSIONS || 64);
const sessions = new Map();

const log = (event, data={}) => {
  const line = `${new Date().toISOString()} ${event} ${JSON.stringify(data)}`;
  console.log(line);
  try { fs.appendFileSync(LOG, line + '\n'); } catch {}
};
const err = (id, code, message, data) => ({
  jsonrpc:'2.0', id, error:{code,message,...(data===undefined?{}:{data})}
});
const normalizeError = (id, e) => err(id, Number.isInteger(e?.code)?e.code:-32603, e?.message || String(e), e?.data);
const wantsSse = req => String(req.headers.accept||'').toLowerCase().includes('text/event-stream');
const send = (req,res,payload,sid,status=200) => {
  if (sid) res.setHeader('Mcp-Session-Id', sid);
  if (!wantsSse(req)) return res.status(status).json(payload);
  res.status(status).set({'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
  res.end(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
};

async function createSession() {
  const id = randomUUID();
  const transport = new StdioClientTransport({
    command: process.execPath, args:[WORKER,'--no-onboarding'], cwd:path.dirname(WORKER), stderr:'pipe',
    env:{...getDefaultEnvironment(), DC_HTTP_GATEWAY_SESSION:id, DC_REMOTE_DEVICE:'true'}
  });
  transport.stderr?.on('data', chunk => log('BACKEND_STDERR',{id,text:String(chunk).slice(0,2000)}));
  transport.onerror = e => log('BACKEND_TRANSPORT_ERROR',{id,message:e?.message});
  const client = new Client({name:'desktop-commander-http-gateway',version:'1.0.0'},{capabilities:{}});
  let timer;
  try {
    await Promise.race([
      client.connect(transport),
      new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('stdio backend init timeout')),30000))
    ]);
  } catch (e) {
    try { await transport.close(); } catch {}
    throw e;
  } finally { clearTimeout(timer); }
  const now=Date.now();
  const s={id,client,transport,createdAt:now,lastSeen:now,active:0,closing:false};
  sessions.set(id,s); log('SESSION_OPEN',{id,count:sessions.size});
  evictExcess();
  return s;
}
async function closeSession(id, reason) {
  const s=sessions.get(id);
  if (!s || s.closing) return;
  s.closing=true; sessions.delete(id); log('SESSION_CLOSE',{id,reason,count:sessions.size});
  try { await s.client.close(); } catch(e) { log('CLIENT_CLOSE_ERROR',{id,message:e?.message}); }
  try { await s.transport.close(); } catch {}
}
function evictExcess() {
  const excess=sessions.size-MAX; if(excess<=0) return;
  [...sessions.values()].filter(s=>!s.active).sort((a,b)=>a.lastSeen-b.lastSeen)
    .slice(0,excess).forEach(s=>void closeSession(s.id,'capacity'));
}
function initResult(s, r) {
  const requested=r.params?.protocolVersion;
  const protocolVersion=typeof requested==='string' && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
    ? requested : LATEST_PROTOCOL_VERSION;
  const capabilities=s.client.getServerCapabilities?.() || {tools:{},resources:{},prompts:{}};
  const serverInfo=s.client.getServerVersion?.() || {name:'desktop-commander',version:'unknown'};
  const instructions=s.client.getInstructions?.();
  return {protocolVersion,capabilities,serverInfo,...(instructions?{instructions}:{})};
}

async function dispatch(s,r) {
  const hasId=Object.prototype.hasOwnProperty.call(r||{},'id');
  const id=hasId?(r.id??null):null, method=r?.method, p=r?.params||{}, c=s.client;
  if(typeof method!=='string') return hasId?err(id,-32600,'Invalid Request'):null;
  if(method.startsWith('notifications/')) return null;
  try {
    let result;
    switch(method) {
      case 'initialize': result=initResult(s,r); break;
      case 'ping': result=typeof c.ping==='function'?await c.ping():{}; break;
      case 'tools/list': result=await c.listTools(p); break;
      case 'tools/call': result=await c.callTool(p); break;
      case 'resources/list': result=await c.listResources(p); break;
      case 'resources/read': result=await c.readResource(p); break;
      case 'resources/templates/list': result=await c.listResourceTemplates(p); break;
      case 'prompts/list': result=await c.listPrompts(p); break;
      case 'prompts/get': result=await c.getPrompt(p); break;
      case 'logging/setLevel': result=typeof c.setLoggingLevel==='function'?await c.setLoggingLevel(p.level):{}; break;
      case 'completion/complete':
        if(typeof c.complete!=='function') return hasId?err(id,-32601,`Method not found: ${method}`):null;
        result=await c.complete(p); break;
      case 'resources/subscribe':
        if(typeof c.subscribeResource!=='function') return hasId?err(id,-32601,`Method not found: ${method}`):null;
        result=await c.subscribeResource(p); break;
      case 'resources/unsubscribe':
        if(typeof c.unsubscribeResource!=='function') return hasId?err(id,-32601,`Method not found: ${method}`):null;
        result=await c.unsubscribeResource(p); break;
      default: return hasId?err(id,-32601,`Method not found: ${method}`):null;
    }
    return hasId?{jsonrpc:'2.0',id,result}:null;
  } catch(e) {
    log('RPC_ERROR',{session:s.id,method,id,message:e?.message});
    return hasId?normalizeError(id,e):null;
  }
}

const app=express();
app.disable('x-powered-by');
app.use(cors({exposedHeaders:['Mcp-Session-Id','MCP-Protocol-Version']}));
app.use(express.json({limit:'64mb'}));
app.get('/healthz',(_req,res)=>res.json({ok:true,pid:process.pid,sessions:sessions.size,uptimeSeconds:Math.floor(process.uptime()),worker:WORKER}));

async function handle(req,res) {
  const raw=req.headers['mcp-session-id'], sid=Array.isArray(raw)?raw[0]:raw;
  if(req.method==='DELETE') {
    if(!sid||!sessions.has(sid)) return res.status(404).json(err(null,-32001,'Session not found'));
    await closeSession(sid,'client-delete'); return res.status(200).end();
  }
  if(req.method==='GET') {
    if(!sid||!sessions.has(sid)) return res.status(404).json(err(null,-32001,'Session not found'));
    return res.status(405).json(err(null,-32000,'No standalone notification stream'));
  }
  if(req.method!=='POST') return res.status(405).json(err(null,-32000,'Method not allowed'));

  let s,newSession=false;
  if(sid) {
    s=sessions.get(sid);
    if(!s) return res.status(404).json(err(null,-32001,'Session not found'));
  } else if(req.body && !Array.isArray(req.body) && req.body.method==='initialize') {
    try { s=await createSession(); newSession=true; }
    catch(e) {
      log('SESSION_OPEN_ERROR',{message:e?.message});
      return send(req,res,err(req.body?.id??null,-32603,'Backend initialization failed',e?.message),undefined,500);
    }
  } else return res.status(400).json(err(null,-32000,'Mcp-Session-Id header is required'));

  s.lastSeen=Date.now(); s.active++; const started=Date.now();
  try {
    const batch=Array.isArray(req.body), messages=batch?req.body:[req.body];
    if(!messages.length) return send(req,res,err(null,-32600,'Invalid Request'),s.id,400);
    const responses=(await Promise.all(messages.map(m=>dispatch(s,m)))).filter(x=>x!==null);
    log('RPC',{session:s.id,methods:messages.map(x=>x?.method),ids:messages.map(x=>x?.id),ms:Date.now()-started,newSession});
    if(!responses.length) { res.setHeader('Mcp-Session-Id',s.id); return res.status(202).end(); }
    return send(req,res,batch?responses:responses[0],s.id);
  } finally { s.active=Math.max(0,s.active-1); s.lastSeen=Date.now(); }
}
const route=(req,res)=>handle(req,res).catch(e=>{
  log('HTTP_HANDLER_ERROR',{message:e?.message});
  if(!res.headersSent) res.status(500).json(err(null,-32603,'Internal gateway error')); else res.end();
});
app.all('/mcp',route); app.all('/api/mcp',route);

const cleanup=setInterval(()=>{
  const cutoff=Date.now()-IDLE;
  for(const s of sessions.values()) if(!s.active && s.lastSeen<cutoff) void closeSession(s.id,'idle-timeout');
},60000); cleanup.unref();

const server=app.listen(PORT,HOST,()=>log('GATEWAY_LISTEN',{host:HOST,port:PORT,pid:process.pid,worker:WORKER,idleMs:IDLE}));
async function shutdown(signal) {
  log('GATEWAY_SHUTDOWN',{signal,count:sessions.size});
  clearInterval(cleanup);
  await new Promise(resolve=>server.close(resolve));
  await Promise.allSettled([...sessions.keys()].map(id=>closeSession(id,signal)));
  process.exit(0);
}
process.on('SIGINT',()=>void shutdown('SIGINT'));
process.on('SIGTERM',()=>void shutdown('SIGTERM'));
