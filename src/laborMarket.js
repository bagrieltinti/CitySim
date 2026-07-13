const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
const alive=person=>person&&person.alive!==false;
const normalize=text=>String(text||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

export const LABOR_MARKET_VERSION=1;
export const defaultLaborPolicy=Object.freeze({retirementAge:65,benefitWeekly:115,benefitMaximumWeeks:26,trainingCapacity:8,wageSubsidyRate:.22,wageSubsidyWeeks:12,publicWorksThreshold:8,youthApprenticeship:true});

export function createLaborMarketState(options={}){
  return {version:LABOR_MARKET_VERSION,week:Number(options.week)||1,wageIndex:100,participationRate:0,unemploymentRate:0,underemploymentRate:0,vacancies:0,seekers:{},subsidies:[],training:[],publicWorks:[],history:[],statistics:{hires:0,separations:0,benefitPayments:0,benefitCost:0,trained:0,publicWorksPlacements:0},policy:{...defaultLaborPolicy,...options.policy},revision:0};
}

export function normalizeLaborMarketState(state={},options={}){
  const base=state?.version===LABOR_MARKET_VERSION?state:createLaborMarketState(options);
  return {...base,version:LABOR_MARKET_VERSION,week:Number(base.week)||1,wageIndex:Math.max(60,Number(base.wageIndex)||100),seekers:{...(base.seekers||{})},subsidies:(base.subsidies||[]).map(item=>({...item})),training:(base.training||[]).map(item=>({...item})),publicWorks:(base.publicWorks||[]).map(item=>({...item})),history:(base.history||[]).slice(-80).map(item=>({...item})),statistics:{...createLaborMarketState().statistics,...base.statistics},policy:{...defaultLaborPolicy,...base.policy,...options.policy},revision:Number(base.revision)||0};
}

export function isRetired(person){return Boolean(person?.lifeCourse?.retirement?.active||person?.retirement?.active||/aposentad/i.test(person?.role||""));}
export function isStudentOnly(person){return Boolean(person?.education?.enrolled&&!person?.shift&&Number(person.age)<25);}
export function isEmployed(person){return alive(person)&&!person.justice?.incarcerated&&!isRetired(person)&&Boolean(person.shift||person.businessId||person.politicalOffice||person.employment?.active);}
export function isLaborParticipant(person,policy=defaultLaborPolicy){return alive(person)&&Number(person.age)>=16&&Number(person.age)<=(Number(policy.retirementAge)||65)+9&&!person.justice?.incarcerated&&!isRetired(person)&&!isStudentOnly(person);}

function businessVacancies(business,peopleById){
  if(!business||business.closed)return 0;
  const active=(business.employees||[]).filter(id=>alive(peopleById.get(id))&&!peopleById.get(id)?.justice?.incarcerated).length;
  return Math.max(0,Number(business.minimumStaff||1)-active);
}

export function analyzeLaborMarket(snapshot={},options={}){
  const people=(snapshot.people||[]).filter(alive),businesses=snapshot.businesses||[],policy={...defaultLaborPolicy,...options.policy},peopleById=new Map(people.map(person=>[person.id,person]));
  const participants=people.filter(person=>isLaborParticipant(person,policy)),employed=participants.filter(isEmployed),unemployed=participants.filter(person=>!isEmployed(person)),underemployed=employed.filter(person=>Number(person.shift?.hours||40)<24),vacancyRows=[];
  businesses.forEach(business=>{const count=businessVacancies(business,peopleById);if(count)vacancyRows.push({businessId:business.id,businessName:business.name,sector:business.sector||"Outros",count,roles:(business.requiredRoles||[]).slice()});});
  const vacancies=vacancyRows.reduce((sum,row)=>sum+row.count,0),sectorDemand={};vacancyRows.forEach(row=>sectorDemand[row.sector]=(sectorDemand[row.sector]||0)+row.count);
  const wages=employed.map(person=>Number(person.hourlyWage)||0).filter(Boolean),averageWage=wages.length?wages.reduce((a,b)=>a+b,0)/wages.length:0;
  return {week:Number(snapshot.week)||1,population:people.length,workingAge:participants.length,participants:participants.map(person=>person.id),employed:employed.map(person=>person.id),unemployed:unemployed.map(person=>person.id),underemployed:underemployed.map(person=>person.id),participationRate:people.length?participants.length/people.length*100:0,unemploymentRate:participants.length?unemployed.length/participants.length*100:0,underemploymentRate:participants.length?underemployed.length/participants.length*100:0,vacancies,vacancyRows,sectorDemand,averageWage,mismatchRate:Math.abs(vacancies-unemployed.length)/Math.max(1,vacancies+unemployed.length)*100};
}

function candidateScore(person,business,week,options={}){
  const roles=(business.requiredRoles||[]).map(normalize),roleText=normalize(person.role),roleMatch=roles.some(role=>roleText&&role.includes(roleText.split(" ")[0]))?18:0,education=Number(person.education?.performance||50)*.18,workEthic=Number(person.personality?.workEthic||person.personality?.dimensions?.conscientiousness||50)*.32,reliability=(100-Number(person.justice?.recordPoints||0)*11)*.14,experience=Number(person.employmentHistory?.length||person.history?.filter?.(item=>/trabalh|contrat/i.test(item.text)).length||0)*2,wait=Math.min(24,Number(options.seekerWeeks?.[person.id]||0))*.45,youth=Number(person.age)<25?3:0;
  return roleMatch+education+workEthic+reliability+experience+wait+youth+((Number(person.id?.replace(/\D/g,""))||0)+week)%7*.01;
}

export function rankLaborCandidates(people=[],business={},options={}){
  return people.filter(person=>isLaborParticipant(person,options.policy)&&!isEmployed(person)).map(person=>({personId:person.id,score:candidateScore(person,business,Number(options.week)||1,options)})).sort((a,b)=>b.score-a.score||a.personId.localeCompare(b.personId));
}

export function runLaborMarketWeek(previousState,snapshot={},options={}){
  const state=normalizeLaborMarketState(previousState,options),policy={...state.policy,...options.policy},analysis=analyzeLaborMarket(snapshot,{policy}),people=snapshot.people||[],businesses=snapshot.businesses||[],week=analysis.week,seekers={...state.seekers};
  const unemployedSet=new Set(analysis.unemployed);
  Object.keys(seekers).forEach(id=>{if(!unemployedSet.has(id))delete seekers[id];});
  analysis.unemployed.forEach(id=>{const prior=seekers[id]||{sinceWeek:week,weeks:0,benefitWeeks:0,trainingWeeks:0};seekers[id]={...prior,weeks:prior.weeks+1,lastWeek:week};});
  const activeSubsidies=state.subsidies.filter(item=>item.untilWeek>=week),training=state.training.filter(item=>item.status==="active"&&item.untilWeek>=week),publicWorks=state.publicWorks.filter(item=>item.status==="active"&&item.untilWeek>=week);
  const benefits=analysis.unemployed.map(id=>({personId:id,amount:seekers[id].benefitWeeks<policy.benefitMaximumWeeks?policy.benefitWeekly:0,weeks:seekers[id].weeks})).filter(item=>item.amount>0);
  benefits.forEach(item=>seekers[item.personId].benefitWeeks++);
  const longTerm=analysis.unemployed.slice().sort((a,b)=>(seekers[b]?.weeks||0)-(seekers[a]?.weeks||0));
  const activeTrainingIds=new Set(training.map(item=>item.personId)),trainingStarts=longTerm.filter(id=>!activeTrainingIds.has(id)&&(seekers[id]?.weeks||0)>=4).slice(0,policy.trainingCapacity).map((personId,index)=>({id:`training:${week}:${personId}`,personId,program:index%2?"Qualificação em serviços":"Competências digitais e administrativas",startWeek:week,untilWeek:week+6,status:"active"}));
  const matches=[];for(const vacancy of analysis.vacancyRows){const business=businesses.find(item=>item.id===vacancy.businessId),ranked=rankLaborCandidates(people,business,{week,policy,seekerWeeks:Object.fromEntries(Object.entries(seekers).map(([id,row])=>[id,row.weeks]))}).filter(row=>!matches.some(match=>match.personId===row.personId));ranked.slice(0,vacancy.count).forEach((row,index)=>matches.push({...row,businessId:business.id,role:business.requiredRoles?.[(business.employees?.length||0)+index]||`${business.sector||"Serviços"} · atendimento`,subsidized:(seekers[row.personId]?.weeks||0)>=8}));}
  const publicWorksStarts=analysis.unemploymentRate>=policy.publicWorksThreshold?longTerm.filter(id=>!matches.some(match=>match.personId===id)&&!publicWorks.some(item=>item.personId===id)).slice(0,Math.max(2,Math.ceil(analysis.workingAge*.02))).map(personId=>({id:`public-work:${week}:${personId}`,personId,startWeek:week,untilWeek:week+13,status:"active",role:"Agente temporário de obras e zeladoria",weeklyPay:520})):[];
  const subsidies=matches.filter(match=>match.subsidized).map(match=>({id:`wage-subsidy:${week}:${match.personId}`,personId:match.personId,businessId:match.businessId,startWeek:week,untilWeek:week+policy.wageSubsidyWeeks,rate:policy.wageSubsidyRate,status:"active"}));
  const pressure=analysis.vacancies-analysis.unemployed.length,wageIndex=Math.max(70,state.wageIndex*(1+clamp(pressure,-20,20)*.0007));
  const historyEntry={week,unemploymentRate:+analysis.unemploymentRate.toFixed(1),participationRate:+analysis.participationRate.toFixed(1),vacancies:analysis.vacancies,matches:matches.length,beneficiaries:benefits.length,trainingStarts:trainingStarts.length,publicWorksStarts:publicWorksStarts.length};
  const next={...state,week,wageIndex:+wageIndex.toFixed(2),participationRate:analysis.participationRate,unemploymentRate:analysis.unemploymentRate,underemploymentRate:analysis.underemploymentRate,vacancies:analysis.vacancies,seekers,subsidies:[...subsidies,...activeSubsidies].slice(0,120),training:[...trainingStarts,...training].slice(0,120),publicWorks:[...publicWorksStarts,...publicWorks].slice(0,80),history:[...state.history,historyEntry].slice(-80),statistics:{...state.statistics,benefitPayments:state.statistics.benefitPayments+benefits.length,benefitCost:state.statistics.benefitCost+benefits.reduce((sum,item)=>sum+item.amount,0),trained:state.statistics.trained+trainingStarts.length,publicWorksPlacements:state.statistics.publicWorksPlacements+publicWorksStarts.length},policy,revision:state.revision+1};
  return {state:next,analysis,actions:{benefits,trainingStarts,matches,publicWorksStarts,subsidies},summary:historyEntry};
}

export function summarizeLaborMarket(state){
  const normalized=normalizeLaborMarketState(state),latest=normalized.history.at(-1)||{};
  return {week:normalized.week,unemploymentRate:+normalized.unemploymentRate.toFixed(1),participationRate:+normalized.participationRate.toFixed(1),underemploymentRate:+normalized.underemploymentRate.toFixed(1),vacancies:normalized.vacancies,wageIndex:normalized.wageIndex,activeTraining:normalized.training.filter(item=>item.status==="active"&&item.untilWeek>=normalized.week).length,activeSubsidies:normalized.subsidies.filter(item=>item.status==="active"&&item.untilWeek>=normalized.week).length,publicWorks:normalized.publicWorks.filter(item=>item.status==="active"&&item.untilWeek>=normalized.week).length,latest};
}
