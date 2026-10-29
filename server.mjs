import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.join(import.meta.dirname, 'dist');
http.createServer((req,res)=>{
 const url = new URL(req.url,'http://localhost');
 const file = path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);});
}).listen(Number(process.argv[2]||4185),'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+Number(process.argv[2]||4185)));
