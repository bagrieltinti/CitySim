export const streets = [
  {id:'v1',name:'Av. dos Pioneiros',kind:'avenue',axis:'v',at:1},
  {id:'v2',name:'Rua das Palmeiras',kind:'street',axis:'v',at:7},
  {id:'v3',name:'Av. Central',kind:'avenue',axis:'v',at:13},
  {id:'v4',name:'Rua do Comércio',kind:'street',axis:'v',at:19},
  {id:'v5',name:'Av. das Nações',kind:'avenue',axis:'v',at:25},
  {id:'v6',name:'Rua dos Imigrantes',kind:'street',axis:'v',at:31},
  {id:'v7',name:'Rodovia Municipal',kind:'avenue',axis:'v',at:37},
  {id:'h1',name:'Rua Aurora',kind:'street',axis:'h',at:1},
  {id:'h2',name:'Av. Esperança',kind:'avenue',axis:'h',at:6},
  {id:'h3',name:'Rua das Acácias',kind:'street',axis:'h',at:11},
  {id:'h4',name:'Av. Municipal',kind:'avenue',axis:'h',at:16},
  {id:'h5',name:'Rua da Estação',kind:'street',axis:'h',at:21},
  {id:'h6',name:'Av. do Contorno',kind:'avenue',axis:'h',at:26},
  {id:'h7',name:'Rua Horizonte',kind:'street',axis:'h',at:31}
].map((street,index)=>({...street,surface:index>=5&&index<=6||index>=12?'cascalho':'asfalto',condition:index>=5&&index<=6||index>=12?58:78+(index*7)%20,lanes:street.kind==='avenue'?4:2,sidewalk:index>=5&&index<=6||index>=12?false:true,lighting:index>=5&&index<=6||index>=12?'parcial':'completa',drainage:index>=5&&index<=6||index>=12?45:82,constructionStatus:'complete',openedWeek:1,pavementHistory:[]}));

export const cityBounds={width:38,height:32};

export const districts = [
  {id:'centro',name:'Centro',x:13,y:6,w:12,h:15,color:'#d6cdb4'},
  {id:'norte',name:'Jardim Aurora',x:1,y:1,w:36,h:5,color:'#ccd6bf'},
  {id:'oeste',name:'Vila dos Pioneiros',x:1,y:6,w:12,h:25,color:'#d8cfb9'},
  {id:'leste',name:'Bairro Esperança',x:25,y:6,w:12,h:25,color:'#c9d4c2'},
  {id:'sul',name:'Parque Sul',x:13,y:21,w:12,h:10,color:'#c4d3b8'}
];

export function districtAt(x,y,districtList=districts){return districtList.find(d=>x>=d.x&&x<d.x+d.w&&y>=d.y&&y<d.y+d.h)||districtList[0];}
export function addressFor(building,index,plan=null){
  const streetList=plan?.streets||streets,districtList=plan?.districts||districts,candidates=streetList.map(s=>({street:s,distance:s.axis==='v'?Math.abs(building.x-s.at):Math.abs(building.y-s.at)})).sort((a,b)=>a.distance-b.distance);
  const street=candidates[0].street,number=100+Math.round((street.axis==='v'?building.y:building.x)*37)+index*2;
  return {streetId:street.id,street:street.name,number,district:districtAt(building.x,building.y,districtList).name,postalCode:`129${String(10+index).padStart(2,'0')}-${String(100+index*7).slice(-3)}`,accessSurface:street.surface};
}
export const formatAddress=a=>`${a.street}, ${a.number} · ${a.district}`;

const stableUnit=(...parts)=>{let hash=2166136261;for(const char of parts.join(':')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0)/4294967296;};

export function generateLots(){
  const vertical=streets.filter(s=>s.axis==='v').map(s=>s.at).sort((a,b)=>a-b),horizontal=streets.filter(s=>s.axis==='h').map(s=>s.at).sort((a,b)=>a-b),lots=[];
  for(let row=0;row<horizontal.length-1;row++)for(let col=0;col<vertical.length-1;col++){
    const left=vertical[col]+.55,right=vertical[col+1]-.55,top=horizontal[row]+.55,bottom=horizontal[row+1]-.55,district=districtAt((left+right)/2,(top+bottom)/2).id,seed=stableUnit(row,col,district),zone=district==='centro'?'mixed':row===0?'civic':(col+row)%5===0?'mixed':'residential';
    const count=seed<.16?1:seed<.5?2:seed<.82?3:4,splitHorizontal=(right-left)>=(bottom-top),gap=.12,weights=Array.from({length:count},(_,part)=>.72+stableUnit(row,col,part)*.58),total=weights.reduce((a,b)=>a+b,0),span=(splitHorizontal?right-left:bottom-top)-gap*(count-1);let cursor=splitHorizontal?left:top;
    weights.forEach((weight,part)=>{const length=span*weight/total,x=splitHorizontal?cursor:left,y=splitHorizontal?top:cursor,w=splitHorizontal?length:right-left,h=splitHorizontal?bottom-top:length,frontage=splitHorizontal?w:h,depth=splitHorizontal?h:w,area=Math.round(w*h*100),peripheral=['norte','leste','oeste','sul'].includes(district),serviceLevel=peripheral?68+Math.round(stableUnit('service',row,col,part)*24):88+Math.round(stableUnit('service',row,col,part)*10);lots.push({id:`lot-${row}-${col}-${part}`,x,y,w,h,row,col,zone,district,occupied:false,area,frontage:Math.round(frontage*10)/10,depth:Math.round(depth*10)/10,shape:stableUnit('shape',row,col,part)>.82?'irregular':'retangular',slope:Math.round(stableUnit('slope',row,col,part)*14),serviceLevel,status:'urbanized',createdWeek:1});cursor+=length+gap;});
  }
  return lots;
}

export function generateUrbanPlan(descriptors){
  const planStreets=streets.map(street=>structuredClone(street)),planDistricts=districts.map(district=>structuredClone(district)),lots=generateLots().map(lot=>structuredClone(lot)),priority={civic:['civic','mixed','residential'],health:['civic','mixed'],school:['civic','residential','mixed'],shop:['mixed','residential'],park:['residential','mixed'],home:['residential','mixed']};
  const buildings=[];
  descriptors.forEach((descriptor,index)=>{
    const zones=priority[descriptor.type]||['mixed','residential'];let lot;
    const targetArea=descriptor.type==='park'?420:descriptor.type==='civic'||descriptor.type==='school'||descriptor.type==='health'?330:descriptor.type==='shop'?190:descriptor.capacity>=10?210:135;
    for(const zone of zones){const candidates=lots.filter(l=>!l.occupied&&l.zone===zone).sort((a,b)=>Math.abs(a.area-targetArea)-Math.abs(b.area-targetArea)||stableUnit(descriptor.name,a.id)-stableUnit(descriptor.name,b.id));if(candidates.length){lot=candidates[0];break;}}
    lot ||= lots.find(l=>!l.occupied);if(!lot)return;lot.occupied=true;
    const pad=descriptor.type==='park'?.05:.12;
    const building={...descriptor,id:descriptor.id,x:lot.x+pad,y:lot.y+pad,w:lot.w-pad*2,h:lot.h-pad*2,lotId:lot.id,districtId:lot.district,lotArea:lot.area,frontage:lot.frontage,terrainSlope:lot.slope};
    buildings.push(building);
  });
  return {streets:planStreets,districts:planDistricts,lots,buildings,bounds:{width:cityBounds.width,height:cityBounds.height}};
}
