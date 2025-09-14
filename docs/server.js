/**
 * server.js - secure backend for Community Portal Pro
 */
require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const bcrypt = require('bcrypt');
const validator = require('validator');
const fetch = require('node-fetch');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change_this_jwt_secret_to_a_long_random_value';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || '';
const RATE_WINDOW = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX) || 30;

const DATA_DIR = path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

const app = express();

app.use(helmet());
app.use(xss());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: CORS_ORIGIN, methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));

const globalLimiter = rateLimit({ windowMs: RATE_WINDOW, max: RATE_MAX, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Too many requests' } });
app.use(globalLimiter);

const authLimiter = rateLimit({ windowMs: 60000, max: 6, message: { ok:false, error:'Too many auth attempts' } });

async function ensureDataFiles(){ await fs.mkdir(DATA_DIR,{recursive:true}); try{ await fs.access(SUBMISSIONS_FILE);}catch{ await fs.writeFile(SUBMISSIONS_FILE,'[]'); } try{ await fs.access(LOGS_FILE);}catch{ await fs.writeFile(LOGS_FILE,'[]'); } }
async function readJson(file){ const raw = await fs.readFile(file,'utf8'); return JSON.parse(raw||'[]'); }
async function writeJson(file,data){ await fs.writeFile(file,JSON.stringify(data,null,2),'utf8'); }
async function appendLog(entry){ const logs = await readJson(LOGS_FILE); logs.unshift({ ts:new Date().toISOString(), ...entry }); await writeJson(LOGS_FILE, logs.slice(0,2000)); }

function sanitizeString(input, maxLen=2000){ let s = String(input||'').trim(); if(s.length>maxLen) s = s.slice(0,maxLen); return s; }
function validateSubmission(name, message){ if(!name||!message) return 'Missing name or message'; if(!validator.isLength(name,{min:1,max:200})) return 'Name length invalid'; if(!validator.isLength(message,{min:1,max:2000})) return 'Message length invalid'; if(validator.contains(message,'http')) return 'Links are not allowed'; return null; }
async function verifyRecaptcha(token, remoteip){ if(!RECAPTCHA_SECRET) return true; try{ const url='https://www.google.com/recaptcha/api/siteverify'; const params=new URLSearchParams(); params.append('secret', RECAPTCHA_SECRET); params.append('response', token); if(remoteip) params.append('remoteip', remoteip); const r = await fetch(url,{method:'POST', body: params}); const j = await r.json(); return j.success && (j.score===undefined || j.score>=0.45); }catch(e){ console.error('recaptcha',e); return false; } }

app.post('/api/submit', async (req,res)=>{ try{ const { name, message, recaptchaToken } = req.body; const n = sanitizeString(name,200); const m = sanitizeString(message,2000); const err = validateSubmission(n,m); if(err) return res.status(400).json({ok:false,error:err}); if(RECAPTCHA_SECRET){ const ok = await verifyRecaptcha(recaptchaToken, req.ip); if(!ok){ await appendLog({type:'spam-blocked', detail:{ip:req.ip}}); return res.status(403).json({ok:false,error:'reCAPTCHA failed'}); } } const submissions = await readJson(SUBMISSIONS_FILE); const item = { id: Date.now().toString() + '-' + Math.floor(Math.random()*9000+1000), name:n, message:m, published:false, createdAt:new Date().toISOString() }; submissions.unshift(item); await writeJson(SUBMISSIONS_FILE, submissions.slice(0,10000)); await appendLog({type:'submission', detail:{name:n, id:item.id, ip:req.ip}}); return res.json({ok:true,item:{id:item.id, createdAt:item.createdAt}}); }catch(e){ console.error(e); return res.status(500).json({ok:false,error:'Server error'}); } });

app.get('/api/public/submissions', async (req,res)=>{ try{ const submissions = await readJson(SUBMISSIONS_FILE); const out = submissions.filter(s=>!!s.published).slice(0,100).map(s=>({id:s.id,name:s.name,message:s.message,createdAt:s.createdAt})); return res.json({ok:true,submissions:out}); }catch(e){ console.error(e); return res.status(500).json({ok:false,error:'Server error'}); } });

app.post('/api/admin/login', authLimiter, async (req,res)=>{ try{ const { password } = req.body || {}; if(!password) return res.status(400).json({ok:false,error:'Missing password'}); let match = false; if(ADMIN_PASSWORD_HASH){ match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH).catch(()=>false); } else { match = (password === ADMIN_PASSWORD); } if(!match){ await appendLog({type:'auth-fail', detail:{ip:req.ip}}); return res.status(401).json({ok:false,error:'Invalid password'}); } const token = jwt.sign({role:'admin'}, ADMIN_SECRET, { expiresIn:'6h' }); await appendLog({type:'auth-success', detail:{ip:req.ip}}); return res.json({ok:true,token}); }catch(e){ console.error(e); return res.status(500).json({ok:false,error:'Server error'}); } });

function requireAdmin(req,res,next){ const auth = req.headers.authorization || req.query.token || req.headers['x-access-token']; if(!auth) return res.status(401).json({ok:false,error:'Missing token'}); const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth; try{ const payload = jwt.verify(token, ADMIN_SECRET); if(payload.role !== 'admin') return res.status(403).json({ok:false,error:'Forbidden'}); req.admin = payload; next(); }catch(e){ return res.status(401).json({ok:false,error:'Invalid token'}); } }

app.get('/api/admin/logs', requireAdmin, async (req,res)=>{ try{ const logs = await readJson(LOGS_FILE); const submissions = await readJson(SUBMISSIONS_FILE); return res.json({ok:true,logs:logs.slice(0,2000),submissions:submissions.slice(0,2000)}); }catch(e){ console.error(e); return res.status(500).json({ok:false,error:'Server error'}); } });

app.post('/api/admin/publish', requireAdmin, async (req,res)=>{ try{ const { id, publish } = req.body; if(!id || (publish === undefined)) return res.status(400).json({ok:false,error:'Missing id or publish flag'}); let submissions = await readJson(SUBMISSIONS_FILE); let found=false; submissions = submissions.map(s=>{ if(String(s.id)===String(id)){ found=true; s.published=!!publish; } return s; }); if(!found) return res.status(404).json({ok:false,error:'Not found'}); await writeJson(SUBMISSIONS_FILE, submissions); await appendLog({type:'publish-change', detail:{id,publish:!!publish, adminIp:req.ip}}); return res.json({ok:true}); }catch(e){ console.error(e); return res.status(500).json({ok:false,error:'Server error'}); } });

app.post('/api/admin/delete', requireAdmin, async (req,res)=>{ try{ const { id } = req.body; if(!id) return res.status(400).json({ok:false,error:'Missing id'}); let submissions = await readJson(SUBMISSIONS_FILE); const before = submissions.length; submissions = submissions.filter(s=>String(s.id)!==String(id)); if(submissions.length===before) return res.status(404).json({ok:false,error:'Not found'}); await writeJson(SUBMISSIONS_FILE, submissions); await appendLog({type:'delete-submission', detail:{id, adminIp:req.ip}}); return res.json({ok:true}); }catch(e){ console.error(e); return res.status(500).json({ok:false,error:'Server error'}); } });

(async ()=>{ await ensureDataFiles(); app.listen(PORT, ()=> console.log('Community Portal backend running on http://localhost:'+PORT)); })();
