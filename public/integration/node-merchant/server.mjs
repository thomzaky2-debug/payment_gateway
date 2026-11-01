import http from 'node:http';
import { openStore, verifyWebhook, applyPayment, publicOrder } from './fulfillment.mjs';
const port=Number(process.env.PORT||8080);
const base=(process.env.NILEPAY_API_URL||'http://127.0.0.1:8090').replace(/\/$/,'');
const appUrl=process.env.APP_URL||`http://localhost:${port}`;
const key=process.env.NILEPAY_API_KEY;
const secret=process.env.NILEPAY_WEBHOOK_SECRET;
if(!key||!secret)throw new Error('Set NILEPAY_API_KEY and NILEPAY_WEBHOOK_SECRET in .env.');
const local=['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname);
if(!local&&process.env.ALLOW_LIVE_CHECKOUT!=='true')throw new Error('Set ALLOW_LIVE_CHECKOUT=true deliberately before creating live payment sessions.');
if(!local&&new URL(base).protocol!=='https:')throw new Error('Live API connections require HTTPS.');
const db=openStore(process.env.DATABASE_FILE||'merchant.sqlite');
// The demonstration sells one server-priced digital license. Client amounts are ignored.
db.prepare('INSERT INTO orders(id,amount_cents) VALUES (?,?) ON CONFLICT(id) DO NOTHING').run('1042',15000);
async function body(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>65536)throw Object.assign(new Error('Body too large'),{status:413});chunks.push(chunk);}return Buffer.concat(chunks);}
async function gateway(path,options={}){
  const response=await fetch(base+path,{...options,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(10000)});
  const result=await response.json();if(!response.ok||result.ok!==true)throw Object.assign(new Error(result.error||'Gateway request failed'),{status:response.status>=400?response.status:502});return result.checkout;
}
const page=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>NilePay integration demo</title></head><body style="font:16px system-ui;max-width:650px;margin:40px auto;padding:20px"><h1>Merchant integration demo</h1><p>Order 1042: digital license, 150 EGP. ${local?'LOCAL MOCK: no bank transfer.':'LIVE MODE: this creates a real NilePay checkout.'}</p><label>Customer InstaPay handle <input id="sender" value="customer@instapay"></label><p><button id="create">Create / retry checkout</button> <button id="status">Check payment status</button></p><a id="pay" hidden>Open checkout</a><pre id="result" style="white-space:pre-wrap"></pre><p>A browser return never confirms payment. Only a signed webhook or an authenticated status lookup can grant a license.</p><script>
async function run(path,options){try{const r=await fetch(path,options);const data=await r.json();document.getElementById('result').textContent=JSON.stringify(data,null,2);const a=document.getElementById('pay');if(data.checkoutUrl){a.href=data.checkoutUrl;a.hidden=false;}}catch(e){document.getElementById('result').textContent=e.message;}}
document.getElementById('create').onclick=()=>run('/orders/1042/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({senderHandle:document.getElementById('sender').value})});document.getElementById('status').onclick=()=>run('/orders/1042/status');run('/orders/1042');</script></body></html>`;
http.createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://localhost').pathname;
    if(req.method==='POST'&&path==='/webhooks/nilepay'){
      const verified=verifyWebhook(await body(req),req.headers,secret);
      const result=applyPayment(db,verified);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;
    }
    // Browser controls are a localhost demonstration, not a production storefront.
    if(req.method==='POST'&&path!=='/webhooks/nilepay'&&req.headers.origin&&req.headers.origin!==new URL(appUrl).origin)throw Object.assign(new Error('Origin rejected'),{status:403});
    let result;
    if(req.method==='POST'&&path==='/orders/1042/checkout'){
      const input=JSON.parse((await body(req)).toString('utf8'));
      const sender=String(input.senderHandle||'').trim();
      if(!/^[A-Za-z0-9._-]+@instapay$/.test(sender))throw Object.assign(new Error('Enter a valid customer@instapay handle'),{status:400});
      const payload=JSON.stringify({amountEgp:150,senderHandle:sender,note:'Order #1042',productCategory:'Digital license',items:[{name:'Digital license',quantity:1,unitPrice:150}],returnUrl:new URL('/return',appUrl).href});
      db.prepare('UPDATE orders SET request_json=COALESCE(request_json,?) WHERE id=?').run(payload,'1042');
      const order=db.prepare('SELECT * FROM orders WHERE id=?').get('1042');
      if(order.request_json!==payload)throw Object.assign(new Error('This order already has different checkout details. Reuse the original handle or create a new order in your real application.'),{status:409});
      if(!order.session_id){
        const checkout=await gateway('/api/v1/checkout/create',{method:'POST',headers:{'Idempotency-Key':'merchant-order-1042-attempt-1'},body:order.request_json});
        if(typeof checkout.sessionId!=='string'||typeof checkout.checkoutUrl!=='string'||!['https:','http:'].includes(new URL(checkout.checkoutUrl).protocol))throw new Error('Invalid gateway response');
        db.prepare('UPDATE orders SET session_id=?,checkout_url=? WHERE id=?').run(checkout.sessionId,checkout.checkoutUrl,'1042');
      }
      result=publicOrder(db,'1042');
    }else if(req.method==='GET'&&path==='/orders/1042/status'){
      const order=publicOrder(db,'1042');
      if(order.sessionId){const tx=await gateway('/api/v1/checkout/status?sessionId='+encodeURIComponent(order.sessionId));if(tx.status==='CONFIRMED')applyPayment(db,{event:{event:'payment.confirmed',transaction:tx}});}
      result=publicOrder(db,'1042');
    }else if(req.method==='GET'&&path==='/orders/1042'){result=publicOrder(db,'1042');}
    else if(req.method==='GET'&&['/','/return'].includes(path)){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'});res.end(page);return;}
    else{res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(result));
  }catch(error){res.writeHead(error.status||502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
}).listen(port,'127.0.0.1',()=>console.log(`Merchant example: ${appUrl}. Webhook: ${appUrl}/webhooks/nilepay`));
