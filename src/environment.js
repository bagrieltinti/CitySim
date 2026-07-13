const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
const pickWeighted=(items,rng=Math.random)=>{let roll=rng(),sum=0;for(const item of items){sum+=item.weight;if(roll<=sum)return item;}return items.at(-1);};

export const CLIMATE_VERSION=2;
export const seasonCatalog=Object.freeze({
  "Verão":{weeks:[50,12],average:[24,32],rainfall:170,daylight:13.2,description:"Calor, pancadas convectivas e tempestades de fim de tarde."},
  "Outono":{weeks:[13,25],average:[16,26],rainfall:88,daylight:11.6,description:"Transição mais seca, neblina e entradas ocasionais de ar frio."},
  "Inverno":{weeks:[26,38],average:[7,20],rainfall:62,daylight:10.8,description:"Manhãs frias, baixa umidade e ondas de frio; neve é excepcional."},
  "Primavera":{weeks:[39,49],average:[18,29],rainfall:126,daylight:12.4,description:"Aquecimento rápido, ventos, floração e temporais isolados."},
});

export const seasonForClimateWeek=week=>{const current=((Number(week)||1)-1)%52+1;return current<=12||current>=50?"Verão":current<=25?"Outono":current<=38?"Inverno":"Primavera";};

export const weatherProfiles={
  "Verão":[
    {name:"Ensolarado",weight:.29,temp:[28,36],humidity:[42,68],wind:[5,18],uv:[8,12]},
    {name:"Calor intenso",weight:.12,temp:[35,42],humidity:[28,54],wind:[3,14],uv:[10,13],heatwave:true,duration:[2,5],severity:3},
    {name:"Nublado",weight:.16,temp:[25,31],humidity:[58,82],wind:[6,20],uv:[4,8]},
    {name:"Chuva de verão",weight:.28,temp:[23,30],humidity:[72,96],wind:[10,30],uv:[2,6],rain:true,precipitation:[8,38]},
    {name:"Tempestade",weight:.12,temp:[20,28],humidity:[78,100],wind:[32,75],uv:[0,4],rain:true,storm:true,precipitation:[35,95],severity:4,duration:[1,2]},
    {name:"Granizo",weight:.03,temp:[17,25],humidity:[75,98],wind:[40,88],uv:[0,3],rain:true,storm:true,hail:true,precipitation:[25,70],severity:5},
  ],
  "Outono":[
    {name:"Ensolarado",weight:.28,temp:[19,28],humidity:[35,62],wind:[5,18],uv:[5,9]},
    {name:"Nublado",weight:.31,temp:[16,24],humidity:[55,82],wind:[6,22],uv:[2,6]},
    {name:"Chuva",weight:.20,temp:[14,22],humidity:[72,96],wind:[8,28],uv:[1,4],rain:true,precipitation:[5,34]},
    {name:"Neblina",weight:.11,temp:[11,19],humidity:[82,100],wind:[0,8],uv:[1,4],fog:true,visibility:[.25,2.5]},
    {name:"Frente fria",weight:.10,temp:[7,16],humidity:[45,76],wind:[18,44],uv:[2,6],coldWave:true,duration:[2,4],severity:2},
  ],
  "Inverno":[
    {name:"Ensolarado",weight:.23,temp:[12,22],humidity:[20,48],wind:[4,18],uv:[4,7],dry:true},
    {name:"Nublado",weight:.25,temp:[8,18],humidity:[48,78],wind:[7,24],uv:[1,4]},
    {name:"Chuva fria",weight:.17,temp:[5,14],humidity:[74,98],wind:[12,34],uv:[0,3],rain:true,precipitation:[4,28],coldWave:true},
    {name:"Frente fria",weight:.22,temp:[1,11],humidity:[35,72],wind:[20,52],uv:[1,5],coldWave:true,duration:[2,5],severity:3},
    {name:"Geada",weight:.08,temp:[-1,7],humidity:[32,67],wind:[0,12],uv:[2,6],frost:true,coldWave:true,duration:[1,3],severity:3},
    {name:"Neblina",weight:.04,temp:[3,12],humidity:[86,100],wind:[0,7],uv:[0,3],fog:true,visibility:[.15,1.8]},
    {name:"Neve rara",weight:.01,temp:[-3,2],humidity:[72,96],wind:[10,32],uv:[0,3],snow:true,coldWave:true,precipitation:[2,14],duration:[1,2],severity:5},
  ],
  "Primavera":[
    {name:"Ensolarado",weight:.32,temp:[22,31],humidity:[35,65],wind:[7,22],uv:[7,11]},
    {name:"Nublado",weight:.20,temp:[18,27],humidity:[54,82],wind:[8,25],uv:[3,7]},
    {name:"Chuva",weight:.20,temp:[17,25],humidity:[70,96],wind:[9,32],uv:[2,6],rain:true,precipitation:[5,36]},
    {name:"Ventania",weight:.13,temp:[18,29],humidity:[38,70],wind:[38,78],uv:[4,9],windstorm:true,severity:3},
    {name:"Tempestade",weight:.12,temp:[16,25],humidity:[76,99],wind:[34,74],uv:[0,4],rain:true,storm:true,precipitation:[28,82],severity:4},
    {name:"Granizo",weight:.03,temp:[14,23],humidity:[75,98],wind:[42,90],uv:[0,3],rain:true,storm:true,hail:true,precipitation:[22,64],severity:5},
  ],
};

const randomRange=(range,rng=Math.random)=>{const [min,max]=range||[0,0];return min+rng()*(max-min);};
const thermalSensation=(temperature,humidity,wind)=>Math.round(temperature+(humidity>70&&temperature>26?(humidity-70)*.055*(temperature-24):0)-(temperature<15?wind*.055:0));

export function generateWeather(season,options={}){
  const rng=options.random||Math.random,profiles=weatherProfiles[season]||weatherProfiles[seasonForClimateWeek(options.week)],profile=options.profile||pickWeighted(profiles,rng),temperature=Math.round(randomRange(profile.temp,rng)),humidity=Math.round(randomRange(profile.humidity,rng)),windSpeed=Math.round(randomRange(profile.wind,rng)),precipitation=Math.round(randomRange(profile.precipitation||[0,profile.rain?8:0],rng)*10)/10,visibility=Math.round(randomRange(profile.visibility||[profile.storm?1.5:7,profile.storm?5:16],rng)*10)/10,uvIndex=Math.round(randomRange(profile.uv||[2,8],rng)*10)/10,severity=Number(profile.severity||0),rain=Boolean(profile.rain),storm=Boolean(profile.storm),snow=Boolean(profile.snow),cold=Boolean(profile.coldWave||temperature<9),heat=Boolean(profile.heatwave||temperature>34),mobilityFactor=clamp(1-(storm ? .34 : 0)-(snow ? .42 : 0)-(profile.fog ? .18 : 0)-(profile.windstorm ? .14 : 0)-(rain ? .12 : 0),.42,1);
  const apparentTemperature=thermalSensation(temperature,humidity,windSpeed),alerts=[];
  if(storm)alerts.push("tempestade severa");if(profile.hail)alerts.push("granizo");if(profile.windstorm||windSpeed>60)alerts.push("ventos fortes");if(heat)alerts.push("calor extremo");if(cold)alerts.push("frio intenso");if(snow)alerts.push("neve e gelo");if(profile.dry||humidity<28)alerts.push("baixa umidade");
  return {name:profile.name,season,temperature,apparentTemperature,humidity,windSpeed,precipitation,visibility,uvIndex,rain,storm,snow,hail:Boolean(profile.hail),fog:Boolean(profile.fog),frost:Boolean(profile.frost),heat,cold,dry:Boolean(profile.dry||humidity<32),severity,mobilityFactor,outdoorFactor:clamp(1-severity*.12-(rain ? .18 : 0)-(snow ? .26 : 0)-(heat ? .12 : 0),.25,1),accidentRisk:clamp(4+severity*12+(rain?8:0)+(snow?22:0)+(profile.fog?12:0)),energyDemand:clamp(50+Math.abs(apparentTemperature-22)*3),healthRisks:{respiratory:Boolean(cold||humidity>88),heatStress:Boolean(heat),dehydration:Boolean(humidity<30||heat),falls:Boolean(snow||profile.frost)},alerts,durationDays:Math.max(1,Math.round(randomRange(profile.duration||[1,1],rng))),patternDay:1};
}

export function createClimateState(options={}){
  const week=Number(options.week)||1,season=options.season||seasonForClimateWeek(week),current=generateWeather(season,{...options,week});
  return {version:CLIMATE_VERSION,week,season,current,patternRemaining:Math.max(0,current.durationDays-1),forecast:Array.from({length:7},(_,index)=>generateWeather(season,{...options,week:week+index/7})),droughtIndex:18,floodRisk:0,consecutiveDryDays:current.rain?0:1,consecutiveWetDays:current.rain?1:0,history:[],alerts:current.alerts.slice(),records:{maxTemperature:current.temperature,minTemperature:current.temperature,maxRainfall:current.precipitation,maxWind:current.windSpeed},revision:0};
}

export function advanceClimateDay(previousState={},options={}){
  const week=Number(options.week)||previousState.week||1,season=options.season||seasonForClimateWeek(week),state=previousState?.version===CLIMATE_VERSION?previousState:createClimateState({...options,week,season}),rng=options.random||Math.random;
  let current,patternRemaining=Math.max(0,Number(state.patternRemaining)||0);
  if(patternRemaining>0&&state.current?.name){const profile=(weatherProfiles[season]||[]).find(item=>item.name===state.current.name);current=generateWeather(season,{random:rng,profile,week});current.patternDay=(state.current.patternDay||1)+1;current.durationDays=state.current.durationDays;patternRemaining--;}else{current=generateWeather(season,{random:rng,week});patternRemaining=Math.max(0,current.durationDays-1);}
  const dryDays=current.rain?0:(state.consecutiveDryDays||0)+1,wetDays=current.rain?(state.consecutiveWetDays||0)+1:0,droughtIndex=clamp((state.droughtIndex||0)+(current.rain?-Math.min(18,current.precipitation*.45):1.4)+(current.heat?3:0)),floodRisk=clamp((state.floodRisk||0)*.62+current.precipitation*.82+wetDays*4),events=[];
  if(floodRisk>=65)events.push({type:"flood_warning",severity:Math.round(floodRisk),text:"Risco de alagamentos em vias baixas e margens de córregos."});
  if(droughtIndex>=70)events.push({type:"drought_warning",severity:Math.round(droughtIndex),text:"Período seco pressiona reservatórios, vegetação e qualidade do ar."});
  current.alerts.forEach(alert=>events.push({type:"weather_alert",severity:current.severity,text:`Alerta municipal: ${alert}.`}));
  const next={...state,week,season,current,patternRemaining,forecast:[...(state.forecast||[]).slice(1),generateWeather(season,{random:rng,week:week+1})],droughtIndex,floodRisk,consecutiveDryDays:dryDays,consecutiveWetDays:wetDays,alerts:current.alerts.slice(),history:[{week,day:Number(options.day)||0,...state.current},...(state.history||[])].slice(0,120),records:{maxTemperature:Math.max(state.records?.maxTemperature??current.temperature,current.temperature),minTemperature:Math.min(state.records?.minTemperature??current.temperature,current.temperature),maxRainfall:Math.max(state.records?.maxRainfall||0,current.precipitation),maxWind:Math.max(state.records?.maxWind||0,current.windSpeed)},revision:(state.revision||0)+1};
  return {state:next,current,events};
}

export const weatherIcon=name=>name?.includes("Tempestade")||name?.includes("Granizo")?"⛈":name?.includes("Neve")?"🌨️":name?.includes("Chuva")?"🌧️":name?.includes("Neblina")?"🌫️":name?.includes("Nublado")?"☁️":name?.includes("Frente fria")||name?.includes("Geada")?"❄️":name?.includes("Calor")?"🌡️":"☀️";

export function summarizeClimate(state={}){const current=state.current||{};return {season:state.season,weather:current.name,temperature:current.temperature,apparentTemperature:current.apparentTemperature,alerts:current.alerts||[],droughtIndex:Math.round(state.droughtIndex||0),floodRisk:Math.round(state.floodRisk||0),forecast:(state.forecast||[]).slice(0,7).map(day=>({name:day.name,temperature:day.temperature,rain:day.rain,severity:day.severity}))};}
