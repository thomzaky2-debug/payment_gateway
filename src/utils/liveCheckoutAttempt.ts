export interface LiveCheckoutAttempt {key:string;body:string}
const storageKey=(merchantId:string)=>`nilepay.live-checkout-attempt.${merchantId}`;
export function getLiveCheckoutAttempt(storage:Pick<Storage,'getItem'|'setItem'>,merchantId:string,body:string,makeKey=()=>`tool-${crypto.randomUUID()}`):LiveCheckoutAttempt {
  if(!merchantId)throw new Error('Refresh account settings before creating a live checkout.');
  const saved=storage.getItem(storageKey(merchantId));
  if(saved){let previous:LiveCheckoutAttempt;try{previous=JSON.parse(saved);}catch{throw new Error('Check Transactions before resetting the saved checkout attempt.');}
    if(typeof previous?.key!=='string'||!/^tool-[A-Za-z0-9-]{8,128}$/.test(previous.key)||typeof previous.body!=='string')throw new Error('Check Transactions before resetting the saved checkout attempt.');
    if(previous.body!==body)throw new Error('A previous checkout has an unresolved result. Retry its original details or check Transactions before resetting the saved attempt.');
    return previous;
  }
  const attempt={body,key:makeKey()};storage.setItem(storageKey(merchantId),JSON.stringify(attempt));return attempt;
}
export function clearLiveCheckoutAttempt(storage:Pick<Storage,'removeItem'>,merchantId:string){storage.removeItem(storageKey(merchantId));}
