// Local-only teaching tool; this does not connect to NilePay, InstaPay or a bank.
import http from 'node:http';import crypto from 'node:crypto';
const port=Number(process.env.MOCK_PORT||8090),app=process.env.APP_URL||'http://localhost:8080';
const secret=process.env.NILEPAY_WEBHOOK_SECRET;if(!secret)throw new Error('Set the demo webhook secret.');
const sessions=new Map(),keys=new Map();
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://localhost:${port}`);let result;
    if(req.method==='POST'&&url.pathname==='/api/v1/checkout/create'){
      if(req.headers.authorization!==`Bearer ${process.env.NILEPAY_API_KEY}`){res.writeHead(401);res.end('{}');return;}
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536)throw new Error('Body too large');}
      const key=req.headers['idempotency-key'];const previous=keys.get(key);
      if(previous&&previous.raw!==raw){res.writeHead(409);res.end(JSON.stringify({ok:false,error:'Idempotency conflict'}));return;}
      if(previous)result=previous.tx;
      else{const tx={...JSON.parse(raw),sessionId:'cmt_demo_'+crypto.randomUUID(),status:'PENDING',currency:'EGP'};tx.checkoutUrl=`http://localhost:${port}/pay/${tx.sessionId}`;sessions.set(tx.sessionId,tx);keys.set(key,{raw,tx});result=tx;}
    }else if(req.method==='GET'&&url.pathname==='/api/v1/checkout/status'){
      if(req.headers.authorization!==`Bearer ${process.env.NILEPAY_API_KEY}`){res.writeHead(401);res.end('{}');return;}
      result=sessions.get(url.searchParams.get('sessionId'));if(!result)throw new Error('Session not found. If the mock restarted, reset only the demo database.');
    }else if(req.method==='GET'&&url.pathname.startsWith('/pay/')){
      const tx=sessions.get(url.pathname.slice(5));if(!tx)throw new Error('Session not found');
      res.writeHead(200,{'Content-Type':'text/html'});res.end(`<h1>LOCAL MOCK PAYMENT</h1><p>No bank transfer happens.</p><form method="POST" action="/confirm/${tx.sessionId}"><button>Simulate confirmation and signed webhook</button></form>`);return;
    }else if(req.method==='POST'&&url.pathname.startsWith('/confirm/')){
      const tx=sessions.get(url.pathname.slice(9));if(!tx)throw new Error('Session not found');tx.status='CONFIRMED';tx.detectedAmountEgp=tx.amountEgp;
      const raw=JSON.stringify({event:'payment.confirmed',transaction:tx});const timestamp=String(Math.floor(Date.now()/1000));
      const signature=crypto.createHmac('sha256',secret).update(timestamp+'.'+raw).digest('hex');
      const response=await fetch(app+'/webhooks/nilepay',{method:'POST',headers:{'Content-Type':'application/json','X-Instapay-Timestamp':timestamp,'X-Instapay-Signature':'v1='+signature,'X-Instapay-Event-Id':'evt_mock_'+tx.sessionId},body:raw,signal:AbortSignal.timeout(5000)});
      if(!response.ok)throw new Error('Webhook rejected: '+await response.text());
      res.writeHead(303,{Location:tx.returnUrl||app+'/return'});res.end();return;
    }else{res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,checkout:result}));
  }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:error.message}));}
}).listen(port,'127.0.0.1',()=>console.log(`Local mock gateway: http://localhost:${port}. Restarting clears mock sessions.`));
