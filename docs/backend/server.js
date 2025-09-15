import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

const allowedOrigin = "https://weIlThought.github.io";
app.use(cors({
  origin: allowedOrigin,
  methods: ["GET","POST"],
  credentials: false
}));

app.use(bodyParser.json());

// Data storage
const dataFile = path.join("data","submissions.json");
function readData(){
  try{
    return JSON.parse(fs.readFileSync(dataFile));
  }catch(e){
    return [];
  }
}
function writeData(subs){
  fs.writeFileSync(dataFile, JSON.stringify(subs,null,2));
}

// Routes
app.post("/api/submit",(req,res)=>{
  const {name,email,category,title,message,evidenceUrl} = req.body;
  if(!title || !message) return res.json({ok:false,error:"Missing fields"});
  const subs = readData();
  const newSub = { id: Date.now().toString(), name, email, category, title, message, evidenceUrl, createdAt:new Date().toISOString(), published:false };
  subs.push(newSub);
  writeData(subs);
  res.json({ok:true,submission:newSub});
});

app.get("/api/public/submissions",(req,res)=>{
  const subs = readData().filter(s=>s.published);
  res.json({ok:true,submissions:subs});
});

// Admin login
app.post("/api/admin/login",(req,res)=>{
  const {password} = req.body;
  if(password !== ADMIN_PASSWORD) return res.json({ok:false,error:"Invalid password"});
  const token = jwt.sign({role:"admin"},JWT_SECRET,{expiresIn:"6h"});
  res.json({ok:true,token});
});

function auth(req,res,next){
  const auth = req.headers["authorization"];
  if(!auth) return res.status(401).json({ok:false,error:"Missing auth"});
  const token = auth.split(" ")[1];
  try{
    const dec = jwt.verify(token,JWT_SECRET);
    req.user = dec;
    next();
  }catch(e){ return res.status(401).json({ok:false,error:"Invalid token"}); }
}

// Admin endpoints
app.get("/api/admin/logs",auth,(req,res)=>{
  res.json({ok:true,submissions:readData()});
});
app.post("/api/admin/publish",auth,(req,res)=>{
  const {id,publish} = req.body;
  let subs = readData();
  const sub = subs.find(s=>s.id===id);
  if(!sub) return res.json({ok:false,error:"Not found"});
  sub.published = !!publish;
  writeData(subs);
  res.json({ok:true,submission:sub});
});
app.post("/api/admin/delete",auth,(req,res)=>{
  const {id} = req.body;
  let subs = readData();
  subs = subs.filter(s=>s.id!==id);
  writeData(subs);
  res.json({ok:true});
});

// Start server
app.listen(PORT,()=>console.log("Server running on port "+PORT));
