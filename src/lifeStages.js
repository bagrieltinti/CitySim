const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));

export const LIFE_STAGE_VERSION=1;

export const lifeStageCatalog=Object.freeze([
  {id:"infancy",name:"Primeira infância",min:0,max:2,workCapacity:0,learning:95,independence:3,stamina:48,healthRisk:18,socialDrive:72,sleepHours:14,activities:["colo e cuidado familiar","brincadeiras sensoriais","passeio acompanhado"]},
  {id:"early_childhood",name:"Infância inicial",min:3,max:5,workCapacity:0,learning:100,independence:12,stamina:70,healthRisk:12,socialDrive:86,sleepHours:11,activities:["creche","parquinho","brincadeira em grupo","contação de histórias"]},
  {id:"childhood",name:"Infância escolar",min:6,max:11,workCapacity:0,learning:96,independence:28,stamina:88,healthRisk:7,socialDrive:90,sleepHours:10,activities:["escola","esporte infantil","biblioteca","parque com amigos"]},
  {id:"adolescence",name:"Adolescência",min:12,max:17,workCapacity:18,learning:90,independence:48,stamina:92,healthRisk:8,socialDrive:96,sleepHours:9,activities:["escola","curso livre","esporte","encontro com amigos","cinema"]},
  {id:"emerging_adult",name:"Adulto jovem",min:18,max:24,workCapacity:82,learning:82,independence:76,stamina:96,healthRisk:5,socialDrive:94,sleepHours:8,activities:["faculdade","primeiro emprego","vida noturna","academia","encontro romântico"]},
  {id:"early_adult",name:"Vida adulta inicial",min:25,max:39,workCapacity:100,learning:68,independence:94,stamina:88,healthRisk:7,socialDrive:82,sleepHours:8,activities:["trabalho","cuidado familiar","restaurante","academia","evento cultural"]},
  {id:"midlife",name:"Meia-idade",min:40,max:54,workCapacity:96,learning:58,independence:100,stamina:76,healthRisk:12,socialDrive:70,sleepHours:8,activities:["trabalho","mentoria","cuidado familiar","consulta preventiva","convívio comunitário"]},
  {id:"mature_adult",name:"Maturidade",min:55,max:64,workCapacity:82,learning:54,independence:94,stamina:66,healthRisk:19,socialDrive:68,sleepHours:8.5,activities:["trabalho experiente","planejamento de aposentadoria","caminhada","família","associação de bairro"]},
  {id:"young_senior",name:"Idoso ativo",min:65,max:74,workCapacity:46,learning:48,independence:82,stamina:55,healthRisk:28,socialDrive:73,sleepHours:9,activities:["caminhada matinal","centro de convivência","cuidado dos netos","voluntariado","consulta preventiva"]},
  {id:"senior",name:"Idoso",min:75,max:84,workCapacity:18,learning:40,independence:58,stamina:40,healthRisk:42,socialDrive:78,sleepHours:9.5,activities:["convivência assistida","visita familiar","praça","fisioterapia","atividade religiosa"]},
  {id:"oldest_old",name:"Longevidade avançada",min:85,max:200,workCapacity:0,learning:30,independence:30,stamina:25,healthRisk:62,socialDrive:84,sleepHours:10,activities:["cuidado domiciliar","memórias com a família","atividade leve","acompanhamento de saúde"]},
]);

export function lifeStageForAge(age=0){
  const years=Math.max(0,Math.floor(Number(age)||0));
  return lifeStageCatalog.find(stage=>years>=stage.min&&years<=stage.max)||lifeStageCatalog.at(-1);
}

export function initializeLifeCourse(person={},week=1){
  const stage=lifeStageForAge(person.age),estimatedContributions=Math.max(0,Math.round((Math.min(65,Number(person.age)||0)-18)*42));
  const active=Boolean(person.retirement?.active||/aposentad/i.test(person.role||""));
  return {
    version:LIFE_STAGE_VERSION,
    stageId:stage.id,
    stageSinceWeek:Number(week)||1,
    previousStages:[],
    contributionWeeks:Number(person.retirement?.contributionWeeks??estimatedContributions),
    retirement:{active,retiredWeek:person.retirement?.retiredWeek??(active?Number(week)||1:null),monthlyPension:Number(person.retirement?.monthlyPension||0),formerRole:person.retirement?.formerRole||null,formerWorkplace:person.retirement?.formerWorkplace||null},
    milestones:[],
    careNeed:clamp((stage.healthRisk-20)*1.2+(100-stage.independence)*.55),
    activityPreferences:[...stage.activities],
  };
}

export function normalizeLifeCourse(person={},week=1){
  const base=person.lifeCourse?.version===LIFE_STAGE_VERSION?person.lifeCourse:initializeLifeCourse(person,week),stage=lifeStageForAge(person.age);
  return {
    ...base,
    version:LIFE_STAGE_VERSION,
    stageId:stage.id,
    stageSinceWeek:Number(base.stageSinceWeek)||Number(week)||1,
    previousStages:Array.isArray(base.previousStages)?base.previousStages.slice(-12):[],
    contributionWeeks:Math.max(0,Number(base.contributionWeeks)||0),
    retirement:{...initializeLifeCourse(person,week).retirement,...base.retirement,active:Boolean(base.retirement?.active)},
    milestones:Array.isArray(base.milestones)?base.milestones.slice(-40):[],
    careNeed:clamp(base.careNeed),
    activityPreferences:[...stage.activities],
  };
}

export function evaluateLifeStage(person={},options={}){
  const week=Number(options.week)||1,course=normalizeLifeCourse(person,week),stage=lifeStageForAge(person.age),transition=course.stageId!==stage.id?{from:course.stageId,to:stage.id,week,name:stage.name}:null;
  const updated={...course,stageId:stage.id,stageSinceWeek:transition?week:course.stageSinceWeek,previousStages:transition?[...course.previousStages,{id:transition.from,endedWeek:week}].slice(-12):course.previousStages,careNeed:clamp((stage.healthRisk-20)*1.2+(100-stage.independence)*.55+(100-(Number(person.health)||100))*.28),activityPreferences:[...stage.activities]};
  if(transition)updated.milestones=[...updated.milestones,{week,type:"life_stage",text:`Entrou na fase ${stage.name}.`}].slice(-40);
  return {course:updated,stage,transition};
}

export function evaluateRetirement(person={},courseInput,options={}){
  const course=courseInput||normalizeLifeCourse(person,options.week),stage=lifeStageForAge(person.age),minimumAge=Number(options.minimumAge??65),minimumContributions=Number(options.minimumContributions??520);
  if(course.retirement.active||Number(person.age)<minimumAge||course.contributionWeeks<minimumContributions||person.justice?.incarcerated)return {eligible:false,retire:false,reason:course.retirement.active?"already_retired":"requirements"};
  const healthPressure=Math.max(0,70-(Number(person.health)||70))*.8,agePressure=Math.max(0,Number(person.age)-minimumAge)*8,workAttachment=clamp(person.personality?.workEthic||person.personality?.dimensions?.conscientiousness||50)*.35,financialNeed=(Number(person.money)||0)<1500?18:0;
  const score=clamp(34+healthPressure+agePressure+stage.healthRisk*.32+financialNeed-workAttachment),roll=typeof options.random==="function"?options.random():Math.random();
  const retire=roll<score/100;
  const monthlyIncome=Math.max(0,Number(person.hourlyWage)||0)*Math.max(0,Number(person.shift?.hours)||0)*4;
  return {eligible:true,retire,score,monthlyPension:Math.round(Math.max(Number(options.minimumPension)||1420,Math.min(Number(options.pensionCap)||7200,monthlyIncome*.68||1420))),reason:retire?"age_health_and_choice":"continued_work"};
}

export function advanceLifeCourseWeek(person={},options={}){
  const evaluated=evaluateLifeStage(person,options),working=Boolean(person.shift&&!person.justice?.incarcerated&&!evaluated.course.retirement.active),course={...evaluated.course,contributionWeeks:evaluated.course.contributionWeeks+(working?1:0)};
  const retirement=evaluateRetirement(person,course,options);
  return {...evaluated,course,retirement};
}

export function ageDailyEffects(person={},environment={}){
  const stage=lifeStageForAge(person.age),temperature=Number(environment.temperature??24),storm=Boolean(environment.storm),rain=Boolean(environment.rain),extremeHeat=Math.max(0,temperature-31),extremeCold=Math.max(0,12-temperature),frailty=stage.healthRisk/100;
  const healthDelta=-(extremeHeat*.045+extremeCold*.06+(storm ? .08 : 0))*frailty;
  const energyDelta=-(extremeHeat*.22+extremeCold*.16+(rain ? .18 : 0))*(.45+frailty);
  const socialDelta=(stage.id==="adolescence"||stage.id==="emerging_adult") ? .35 : stage.min>=65&&storm ? -.55 : .08;
  return {stageId:stage.id,healthDelta,energyDelta,socialDelta,careNeedDelta:(extremeHeat+extremeCold)*frailty*.12,mobilityFactor:clamp(stage.stamina/78,.42,1.12),preferredActivities:[...stage.activities]};
}

export function lifeStageSummary(people=[]){
  const living=people.filter(person=>person?.alive!==false),byStage=Object.fromEntries(lifeStageCatalog.map(stage=>[stage.id,0]));
  living.forEach(person=>{byStage[lifeStageForAge(person.age).id]++;});
  const retired=living.filter(person=>person.lifeCourse?.retirement?.active||/aposentad/i.test(person.role||"")).length,careNeeds=living.filter(person=>(person.lifeCourse?.careNeed||0)>=45).length;
  return {population:living.length,byStage,retired,careNeeds,retirementRate:living.length?Math.round(retired/living.length*1000)/10:0};
}
