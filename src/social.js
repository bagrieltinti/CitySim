const compatibility = (a,b) => {
  const shared=a.traits.filter(t=>b.traits.includes(t)).length;
  const friction=(a.traits.includes('reservado')&&b.traits.includes('sociável'))||(a.traits.includes('metódico')&&b.traits.includes('impulsivo'));
  return shared*12-(friction?8:0)+(a.familyId===b.familyId?18:0);
};

export function seedRelationships(people){
  const links=[];
  const add=(a,b,type,affinity,trust=50)=>{if(!a||!b||a.id===b.id||links.some(l=>(l.a===a.id&&l.b===b.id)||(l.a===b.id&&l.b===a.id)))return;links.push({id:`rel-seed-${links.length+1}`,a:a.id,b:b.id,type,affinity,trust,interactions:0,lastEvent:'Vínculo anterior à fundação da cidade',history:[]});};
  people.forEach(p=>{
    p.parents.forEach(id=>add(p,people.find(x=>x.id===id),'família',82,88));
    if(p.partnerId){const partner=people.find(x=>x.id===p.partnerId);add(p,partner,p.age>25?'casamento':'romance',72+compatibility(p,partner),78);}
  });
  people.forEach((p,i)=>{
    const candidates=people.filter(x=>x.id!==p.id&&x.familyId!==p.familyId).sort((a,b)=>Math.abs(a.age-p.age)-Math.abs(b.age-p.age));
    for(let n=0;n<2;n++){const friend=candidates[(i*3+n*7)%Math.min(18,candidates.length)];add(p,friend,'amizade',48+compatibility(p,friend),42+Math.floor(Math.random()*35));}
  });
  for(let i=0;i<6;i++){const a=people[(i*13+5)%people.length],b=people[(i*17+31)%people.length];add(a,b,'conflito',-28-Math.floor(Math.random()*35),18);}
  return links;
}

export function relationBetween(links,a,b){return links.find(l=>(l.a===a&&l.b===b)||(l.a===b&&l.b===a));}
export function otherPerson(link,personId,people){return people.find(p=>p.id===(link.a===personId?link.b:link.a));}
export function relationLabel(link){
  if(link?.lifecycle)return relationshipStageLabel(link.lifecycle);
  return {
    amizade:"Amizade",
    conhecido:"Conhecidos",
    colega:"Colegas",
    vizinhança:"Vizinhança",
    romance:"Relacionamento",
    noivado:"Noivado",
    casamento:"Casamento",
    "união estável":"União estável",
    "ex-relacionamento":"Ex-relacionamento",
    família:"Família",
    viuvez:"Viuvez",
    conflito:"Conflito",
  }[link?.type]||"Vínculo social";
}
import { relationshipStageLabel } from "./relationshipLifecycle.js";
