export type PricingRecord = Record<string, any>;
export function pricingOfferActive(plan:PricingRecord, now=Date.now()) {return plan.offerPriceEgp!==null&&plan.offerPriceEgp!==undefined&&Number(plan.offerPriceEgp)>0&&Number(plan.offerPriceEgp)<Number(plan.priceEgp)&&Date.parse(plan.offerEndsAt)>now;}
export function effectivePlanPrice(plan:PricingRecord,now=Date.now()){return Number(pricingOfferActive(plan,now)?plan.offerPriceEgp:plan.priceEgp);}
export function privateOfferStatus(offer:PricingRecord,now=Date.now()){return offer.status==='ACTIVE'&&Date.parse(offer.validUntil)<=now?'EXPIRED':offer.status;}
export function filterPricing(rows:PricingRecord[],query:string,status:string,sort:string,kind:string,now=Date.now()) {
  const q=query.trim().toLowerCase();
  return rows.filter(r=>[r.name,r.displayName,r.title,r.description,r.client?.businessName,r.client?.email,r.businessName,r.email,r.subscriptionPlan].filter(Boolean).join(' ').toLowerCase().includes(q))
    .filter(r=>status==='ALL'||(kind==='allocations'&&status==='QUOTA'?Number(r.txLimit)>0&&Number(r.txCount)/Number(r.txLimit)>=.8:kind==='allocations'&&status==='EXPIRING'?Date.parse(r.subscriptionEndsAt)>=now&&Date.parse(r.subscriptionEndsAt)<=now+7*86400000:kind==='offers'?privateOfferStatus(r,now)===status:status==='ACTIVE'?r.isActive!==false:r.isActive===false))
    .sort((a,b)=>sort==='price-low'?Number(a.priceEgp)-Number(b.priceEgp):sort==='price-high'?Number(b.priceEgp)-Number(a.priceEgp):sort==='capacity'?Number(b.maxTransactions??b.extraTx)-Number(a.maxTransactions??a.extraTx):String(a.displayName||a.title||a.businessName||a.name).localeCompare(String(b.displayName||b.title||b.businessName||b.name)));
}
export function capacityMatches(plans:PricingRecord[],transactions:number,days:number,now=Date.now()) {
  if(!Number.isSafeInteger(transactions)||transactions<1||!Number.isSafeInteger(days)||days<1)return [];
  return plans.filter(p=>p.isActive!==false&&!['FREE_TRIAL','ENTERPRISE'].includes(p.name)&&Number(p.maxTransactions)>=transactions&&Number(p.periodDays)>=days&&Number(p.priceEgp)>0).sort((a,b)=>effectivePlanPrice(a,now)-effectivePlanPrice(b,now));
}
export function pricingValidation(kind:'plan'|'bundle'|'offer'|'trial',r:PricingRecord):string {
  const integer=(v:any,min:number,max:number)=>String(v).trim()!==''&&Number.isInteger(Number(v))&&Number(v)>=min&&Number(v)<=max;
  const amount=(v:any,min:number,max:number)=>String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max;
  if(kind!=='trial'&&!amount(r.priceEgp,kind==='plan'?0:0.01,kind==='bundle'?1_000_000:10_000_000))return 'Enter a valid price within the allowed range.';
  if(kind==='bundle'){
    if(!/^[A-Z0-9_]{3,50}$/.test(r.name||'')||!String(r.displayName||'').trim()||r.displayName.length>80)return 'Use a 3–50 character bundle key and a display name up to 80 characters.';
    if(!integer(r.extraTx,1,10_000_000)||!integer(r.sortOrder,0,10_000))return 'Enter a valid transaction allowance and display order (0–10,000).';
  }else{
    if(!integer(r.maxTransactions,1,kind==='trial'?10_000:100_000_000)||!integer(r.periodDays,1,kind==='trial'?365:3650))return 'Enter a valid whole-number transaction allowance and duration.';
  }
  if(kind==='plan'&&r.offerPriceEgp!==''&&r.offerPriceEgp!==null&&r.offerPriceEgp!==undefined){
    if(!amount(r.offerPriceEgp,0.01,10_000_000)||Number(r.offerPriceEgp)>=Number(r.priceEgp)||!integer(r.offerValidDays,1,365)||!String(r.offerLabel||'').trim()||r.offerLabel.length>80)return 'Promotion needs a lower positive price, a label up to 80 characters, and 1–365 days of validity.';
  }
  if(kind==='offer'&&(!r.clientId||!String(r.title||'').trim()||r.title.length>120||!integer(r.validDays,1,365)))return 'Select a merchant, enter a title up to 120 characters, and choose 1–365 validity days.';
  return '';
}
export function pricingCsv(kind:string,rows:PricingRecord[],now=Date.now()) {
  const columns=kind==='allocations'?['Merchant','Email','Plan','Used transactions','Quota','Subscription ends']:['Name','Status','Price EGP','Effective price EGP','Transactions','Duration days','Validity ends'];
  const cell=(v:any)=>{let s=String(v??'');if(/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const values=rows.map(r=>kind==='allocations'?[r.businessName,r.email,r.subscriptionPlan,r.txCount,r.txLimit,r.subscriptionEndsAt]:[r.displayName||r.title||r.name,kind==='offers'?privateOfferStatus(r,now):r.isActive===false?'HIDDEN':'ACTIVE',r.priceEgp,kind==='plans'?effectivePlanPrice(r,now):r.priceEgp,r.maxTransactions??r.extraTx,r.periodDays,r.validUntil||r.offerEndsAt]);
  return '\uFEFF'+[columns,...values].map(row=>row.map(cell).join(',')).join('\r\n');
}
/** Preserve an unchanged promotion's exact deadline when editing catalog details. */
export function planPromotionUpdate(draft:PricingRecord,original:PricingRecord,now=Date.now()):PricingRecord {
  if(draft.offerPriceEgp===''||draft.offerPriceEgp===null||draft.offerPriceEgp===undefined)return {clearOffer:true};
  const remaining=Math.max(1,Math.ceil((Date.parse(original.offerEndsAt)-now)/86400000));
  if(pricingOfferActive(original,now)&&Number(draft.offerPriceEgp)===Number(original.offerPriceEgp)&&String(draft.offerLabel).trim()===String(original.offerLabel||'Limited-time offer').trim()&&Number(draft.offerValidDays)===Number(draft._originalOfferValidDays ?? remaining))return {};
  return {offerPriceEgp:Number(draft.offerPriceEgp),offerLabel:String(draft.offerLabel).trim(),offerValidDays:Number(draft.offerValidDays)};
}
