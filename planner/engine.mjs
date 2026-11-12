// Portable, deterministic workforce planning engine. No customer data leaves the browser.
export function forecast(history, weeks, method='trend') {
  if (!Array.isArray(history) || history.length<2 || history.some(x=>!Number.isFinite(x)||x<0)) throw Error('Provide at least two nonnegative historical observations');
  const mean=history.reduce((a,b)=>a+b,0)/history.length;
  const xMean=(history.length-1)/2;
  const slope=history.reduce((a,y,i)=>a+(i-xMean)*(y-mean),0)/history.reduce((a,_,i)=>a+(i-xMean)**2,0);
  return Array.from({length:weeks},(_,i)=>Math.max(0,method==='movingAverage'?mean:mean+slope*(history.length+i)));
}
export function backtest(history,method='trend') {
  if(history.length<5)return null;
  const errors=[];
  for(let i=4;i<history.length;i++)errors.push(Math.abs(forecast(history.slice(0,i),1,method)[0]-history[i]));
  return {mae:errors.reduce((a,b)=>a+b,0)/errors.length,observations:errors.length};
}
const positive=(x,label,allowZero=true)=>{if(!Number.isFinite(x)||(allowZero?x<0:x<=0))throw Error('Invalid '+label);return x;};
export function plan(config) {
  const {departments,transfers=[],weeks=8,otPremium=1.5,baseRate=28}=config;
  if(!Array.isArray(departments)||departments.length<1||weeks<1||weeks>26)throw Error('Invalid departments or horizon');
  positive(otPremium,'overtime multiplier',false);positive(baseRate,'wage rate',false);
  const ids=new Set();
  for(const d of departments){
    if(!d.id||ids.has(d.id))throw Error('Duplicate or missing department');ids.add(d.id);
    for(const key of ['headcount','hours','productiveShare','absence','attrition','uph','otLimit','leadWeeks'])positive(d[key],d.id+' '+key,key!=='uph');
    if(d.productiveShare>1||d.absence>=1||d.attrition>=1||d.leadWeeks>weeks)throw Error('Invalid rate or lead time');
    if(!Array.isArray(d.volume)||d.volume.length<weeks||d.volume.slice(0,weeks).some(x=>!Number.isFinite(x)||x<0))throw Error('Missing forecast for '+d.id);
  }
  for(const t of transfers)if(!ids.has(t.from)||!ids.has(t.to)||t.from===t.to||t.efficiency<=0||t.efficiency>1||t.maxPaidHours<0)throw Error('Invalid transfer');
  const hireCounts=Object.fromEntries(departments.map(d=>[d.id,0]));
  // Baseline hires: meet peak base demand after each department's hiring lead time.
  for(const d of departments){
    const productivePerPerson=d.hours*(1-d.absence)*d.productiveShare;
    let needed=0;
    for(let w=d.leadWeeks;w<weeks;w++){
      const existing=d.headcount*(1-d.attrition)**w;
      needed=Math.max(needed,d.volume[w]/d.uph/productivePerPerson-existing);
    }
    hireCounts[d.id]=Math.max(0,Math.ceil(needed));
  }
  const rows=[],actions=[];
  for(let w=0;w<weeks;w++){
    const state=departments.map(d=>{
      const hc=d.headcount*(1-d.attrition)**w+(w>=d.leadWeeks?hireCounts[d.id]*(1-d.attrition)**(w-d.leadWeeks):0);
      const need=d.volume[w]/d.uph;
      const paid=hc*d.hours*(1-d.absence),capacity=paid*d.productiveShare;
      return {id:d.id,week:w+1,headcount:hc,volume:d.volume[w],need,capacity,remaining:need-capacity,otPaid:0,transferIn:0,transferOut:0,uncovered:0,otCost:0,productivity:d.productiveShare,absence:d.absence,otLimit:d.otLimit};
    });
    // Transfer productive capacity, limited by sender surplus and eligible paid hours.
    for(const t of transfers){
      const from=state.find(s=>s.id===t.from),to=state.find(s=>s.id===t.to);
      if(from.remaining>=0||to.remaining<=0)continue;
      const availablePaid=-from.remaining/from.productivity;
      const transferPaid=Math.min(t.maxPaidHours,availablePaid,to.remaining/(t.efficiency*to.productivity));
      if(transferPaid<=0)continue;
      const supplied=transferPaid*t.efficiency*to.productivity;
      from.remaining+=transferPaid*from.productivity;to.remaining-=supplied;
      from.transferOut+=transferPaid;to.transferIn+=transferPaid;
      actions.push({week:w+1,type:'transfer',from:t.from,to:t.to,paidHours:transferPaid,productiveHours:supplied});
    }
    for(const s of state){
      const availablePaid=s.headcount*s.otLimit*(1-s.absence);
      s.otPaid=Math.min(availablePaid,Math.max(0,s.remaining)/s.productivity);
      s.remaining-=s.otPaid*s.productivity;
      s.uncovered=Math.max(0,s.remaining);
      s.otCost=s.otPaid*baseRate*otPremium;
      if(s.otPaid>0)actions.push({week:w+1,type:'overtime',department:s.id,paidHours:s.otPaid,cost:s.otCost});
    }
    rows.push(...state);
  }
  return {rows,actions,hires:hireCounts,totals:{uncovered:rows.reduce((a,r)=>a+r.uncovered,0),overtimePaid:rows.reduce((a,r)=>a+r.otPaid,0),overtimeCost:rows.reduce((a,r)=>a+r.otCost,0),transferPaid:rows.reduce((a,r)=>a+r.transferIn,0)}};
}
