export const conditions = [
  {id:'flu',name:'Gripe',kind:'infecciosa',severity:18,duration:5,contagious:.08,ageRisk:0,treatment:'Repouso e hidratação'},
  {id:'pneumonia',name:'Pneumonia',kind:'infecciosa',severity:54,duration:12,contagious:.025,ageRisk:.35,treatment:'Antibiótico e observação'},
  {id:'hypertension',name:'Hipertensão',kind:'crônica',severity:24,duration:9999,contagious:0,ageRisk:.55,treatment:'Medicação contínua'},
  {id:'fracture',name:'Fratura',kind:'acidente',severity:48,duration:28,contagious:0,ageRisk:.1,treatment:'Imobilização e fisioterapia'},
  {id:'food_poisoning',name:'Intoxicação alimentar',kind:'aguda',severity:34,duration:3,contagious:0,ageRisk:.08,treatment:'Hidratação e medicação'},
  {id:'migraine',name:'Enxaqueca',kind:'crônica',severity:16,duration:2,contagious:0,ageRisk:.05,treatment:'Analgésico e repouso'}
  ,{id:'depression',name:'Depressão',kind:'mental',severity:36,duration:120,contagious:0,ageRisk:.08,treatment:'Psicoterapia e antidepressivo',medication:'Sertralina'}
  ,{id:'anxiety',name:'Transtorno de ansiedade',kind:'mental',severity:28,duration:90,contagious:0,ageRisk:.04,treatment:'Psicoterapia e ansiolítico',medication:'Escitalopram'}
  ,{id:'burnout',name:'Esgotamento profissional',kind:'mental',severity:42,duration:35,contagious:0,ageRisk:.02,treatment:'Afastamento e psicoterapia',medication:null}
  ,{id:'diabetes',name:'Diabetes',kind:'crônica',severity:32,duration:9999,contagious:0,ageRisk:.42,treatment:'Controle glicêmico e medicação',medication:'Metformina'}
  ,{id:'asthma',name:'Asma',kind:'crônica',severity:26,duration:9999,contagious:0,ageRisk:.15,treatment:'Acompanhamento e broncodilatador',medication:'Salbutamol'}
  ,{id:'dengue',name:'Dengue',kind:'infecciosa',severity:58,duration:12,contagious:.01,ageRisk:.12,treatment:'Hidratação e monitoramento',medication:'Paracetamol'}
  ,{id:'heart_disease',name:'Doença cardíaca',kind:'crônica',severity:64,duration:9999,contagious:0,ageRisk:.72,treatment:'Acompanhamento cardiológico',medication:'Losartana'}
  ,{id:'appendicitis',name:'Apendicite',kind:'aguda',severity:68,duration:9,contagious:0,ageRisk:.06,treatment:'Cirurgia e observação hospitalar',medication:'Antibiótico'}
  ,{id:'stroke',name:'Acidente vascular cerebral',kind:'aguda',severity:88,duration:45,contagious:0,ageRisk:.78,treatment:'Emergência neurológica e reabilitação',medication:'Losartana'}
  ,{id:'kidney_disease',name:'Doença renal',kind:'crônica',severity:56,duration:9999,contagious:0,ageRisk:.5,treatment:'Acompanhamento nefrológico e controle metabólico',medication:'Losartana'}
  ,{id:'cancer',name:'Câncer',kind:'crônica',severity:76,duration:520,contagious:0,ageRisk:.62,treatment:'Oncologia, quimioterapia e acompanhamento',medication:'Analgésico'}
  ,{id:'bipolar',name:'Transtorno bipolar',kind:'mental',severity:44,duration:9999,contagious:0,ageRisk:.05,treatment:'Psiquiatria, psicoterapia e estabilização do humor',medication:'Estabilizador de humor'}
  ,{id:'dental_infection',name:'Infecção odontológica',kind:'aguda',severity:29,duration:8,contagious:0,ageRisk:.04,treatment:'Atendimento odontológico e antibiótico',medication:'Antibiótico'}
];

export const medicationCatalog={Sertralina:{price:38,days:30},Escitalopram:{price:44,days:30},Metformina:{price:22,days:30},Salbutamol:{price:31,days:45},Paracetamol:{price:12,days:10},Losartana:{price:18,days:30},Antibiótico:{price:29,days:10},Analgésico:{price:10,days:7},'Estabilizador de humor':{price:64,days:30}};

export const newMedicalRecord=()=>({conditions:[],admitted:false,admittedDay:null,discharged:0,visits:0,medications:[],prescriptions:[],sickLeave:0,mentalHealth:65+Math.floor(Math.random()*30),primaryCareVisits:0,therapySessions:0,triage:null,carePlan:[],procedures:[],allergies:[],bloodType:['A+','A−','B+','B−','AB+','O+','O−'][Math.floor(Math.random()*7)],history:[]});
export const conditionById=id=>conditions.find(c=>c.id===id);

export function healthRisk(person){
  const ageFactor=person.age<5?.02:person.age>80?.16:person.age>65?.08:.025;
  const healthFactor=Math.max(0,(60-person.health)/300);
  return ageFactor+healthFactor;
}
