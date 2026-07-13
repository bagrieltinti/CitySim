export const offenses=[
  {id:'noise',name:'Perturbação do sossego',severity:'leve',weight:26,fine:180,sentence:0,violence:0},
  {id:'vandalism',name:'Vandalismo',severity:'leve',weight:20,fine:650,sentence:3,violence:.05},
  {id:'theft',name:'Furto',severity:'médio',weight:18,fine:900,sentence:14,violence:.08},
  {id:'fraud',name:'Fraude',severity:'médio',weight:12,fine:2800,sentence:24,violence:0},
  {id:'assault',name:'Agressão',severity:'grave',weight:10,fine:1500,sentence:45,violence:.75},
  {id:'robbery',name:'Roubo',severity:'grave',weight:8,fine:3200,sentence:70,violence:.4},
  {id:'corruption',name:'Corrupção',severity:'grave',weight:6,fine:8000,sentence:100,violence:0},
  {id:'burglary',name:'Invasão e furto residencial',severity:'médio',weight:11,fine:1800,sentence:34,violence:.12},
  {id:'vehicle_theft',name:'Roubo de veículo',severity:'grave',weight:8,fine:4200,sentence:80,violence:.25},
  {id:'cybercrime',name:'Crime cibernético',severity:'médio',weight:7,fine:5200,sentence:42,violence:0},
  {id:'drug_trafficking',name:'Tráfico de entorpecentes',severity:'grave',weight:5,fine:9000,sentence:150,violence:.3},
  {id:'arson',name:'Incêndio criminoso',severity:'grave',weight:3,fine:12000,sentence:180,violence:.65},
  {id:'homicide',name:'Homicídio',severity:'gravíssimo',weight:1.2,fine:20000,sentence:520,violence:1}
  ,{id:'domestic_violence',name:'Violência doméstica',severity:'grave',weight:4.5,fine:4500,sentence:110,violence:.82}
  ,{id:'kidnapping',name:'Sequestro e cárcere privado',severity:'gravíssimo',weight:.8,fine:18000,sentence:420,violence:.9}
  ,{id:'extortion',name:'Extorsão',severity:'grave',weight:3.5,fine:7500,sentence:130,violence:.35}
  ,{id:'money_laundering',name:'Lavagem de dinheiro',severity:'grave',weight:3,fine:15000,sentence:180,violence:0}
  ,{id:'organized_crime',name:'Organização criminosa',severity:'gravíssimo',weight:1.5,fine:22000,sentence:360,violence:.45}
  ,{id:'environmental_crime',name:'Crime ambiental',severity:'médio',weight:4,fine:11000,sentence:55,violence:0}
  ,{id:'traffic_crime',name:'Crime de trânsito',severity:'médio',weight:8,fine:2600,sentence:28,violence:.38}
];
export const emptyJusticeRecord=()=>({offenses:[],fines:0,arrests:0,convictions:0,acquittals:0,warrants:[],incarcerated:false,pretrial:false,sentenceRemaining:0,totalSentence:0,served:0,recordPoints:0,recordStatus:'limpa',rehabilitation:0,disciplinary:0,prisonJob:null,prisonProgram:null,programProgress:0,familyVisits:0,prisonWing:null,cell:null,securityLevel:null,parole:false,history:[]});
export function weightedOffense(random=Math.random()){const total=offenses.reduce((n,o)=>n+o.weight,0);let cursor=random*total;for(const o of offenses){cursor-=o.weight;if(cursor<=0)return o;}return offenses[0];}
