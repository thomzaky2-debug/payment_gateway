import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
export function openStore(filename='merchant.sqlite') {
  const db=new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'EGP',
      request_json TEXT, session_id TEXT UNIQUE, checkout_url TEXT, status TEXT NOT NULL DEFAULT 'PENDING'
    );
    CREATE TABLE IF NOT EXISTS webhook_events (id TEXT PRIMARY KEY, body_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS digital_licenses (order_id TEXT PRIMARY KEY REFERENCES orders(id), license TEXT NOT NULL);
  `);
  return db;
}
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
export function verifyWebhook(raw,headers,secret,now=Math.floor(Date.now()/1000)) {
  if(!secret)fail('Webhook secret is not configured',503);
  const timestamp=headers['x-instapay-timestamp'];
  const signature=headers['x-instapay-signature'];
  const eventId=headers['x-instapay-event-id'];
  if(typeof timestamp!=='string'||!/^\d{1,12}$/.test(timestamp)||Math.abs(now-Number(timestamp))>300)fail('Invalid or stale timestamp',401);
  if(typeof eventId!=='string'||!/^evt_[A-Za-z0-9_-]{1,128}$/.test(eventId))fail('Missing or invalid event ID',401);
  if(typeof signature!=='string'||!/^v1=[a-f0-9]{64}$/i.test(signature))fail('Malformed signature',401);
  const expected=crypto.createHmac('sha256',secret).update(timestamp+'.').update(raw).digest();
  const supplied=Buffer.from(signature.slice(3),'hex');
  if(!crypto.timingSafeEqual(expected,supplied))fail('Invalid signature',401);
  let event;try{event=JSON.parse(raw.toString('utf8'));}catch{fail('Invalid JSON');}
  return {event,eventId,bodyHash:crypto.createHash('sha256').update(raw).digest('hex')};
}
export function applyPayment(db,{event,eventId,bodyHash}) {
  db.exec('BEGIN IMMEDIATE');
  try{
    if(eventId){
      const seen=db.prepare('SELECT body_hash FROM webhook_events WHERE id=?').get(eventId);
      if(seen){if(seen.body_hash!==bodyHash)fail('Event ID reused with different content',409);db.exec('COMMIT');return {duplicate:true};}
    }
    // Non-payment events never grant goods or change an order.
    const relevant=['payment.confirmed','payment.underpaid','payment.overpaid','payment.expired'].includes(event?.event);
    if(!relevant){if(eventId)db.prepare('INSERT INTO webhook_events VALUES (?,?)').run(eventId,bodyHash);db.exec('COMMIT');return {ignored:true};}
    const tx=event.transaction;
    if(!tx||typeof tx.sessionId!=='string')fail('Missing transaction');
    // Never trust a browser return or the free-text order note as a payment mapping.
    const order=db.prepare('SELECT * FROM orders WHERE session_id=?').get(tx.sessionId);
    if(!order)fail('Checkout not mapped yet; retry delivery',503);
    if(tx.currency!==order.currency||!Number.isFinite(tx.amountEgp)||Math.round(tx.amountEgp*100)!==order.amount_cents)fail('Order amount or currency mismatch',422);
    if(event.event==='payment.confirmed'&&tx.status==='CONFIRMED'){
      db.prepare("UPDATE orders SET status='PAID' WHERE id=?").run(order.id);
      // This database-backed digital license is the demo's actual fulfillment.
      // UNIQUE(order_id) makes webhook retries, new event IDs and status polling safe.
      db.prepare('INSERT INTO digital_licenses(order_id,license) VALUES (?,?) ON CONFLICT(order_id) DO NOTHING').run(order.id,crypto.randomUUID());
    }else if(order.status!=='PAID'&&['UNDERPAID','OVERPAID','EXPIRED'].includes(tx.status)){
      db.prepare('UPDATE orders SET status=? WHERE id=?').run(tx.status,order.id);
    }
    if(eventId)db.prepare('INSERT INTO webhook_events VALUES (?,?)').run(eventId,bodyHash);
    db.exec('COMMIT');return {received:true};
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function publicOrder(db,id){return db.prepare('SELECT o.id,o.status,o.session_id AS sessionId,o.checkout_url AS checkoutUrl,l.license FROM orders o LEFT JOIN digital_licenses l ON l.order_id=o.id WHERE o.id=?').get(id);}
