export const vehicleModels=[
  {model:'Aurora Compact',type:'carro',price:32000,seats:5,efficiency:14},
  {model:'Veloce City',type:'carro',price:48000,seats:5,efficiency:12},
  {model:'Horizonte Sedan',type:'carro',price:71000,seats:5,efficiency:11},
  {model:'Brisa Moto',type:'moto',price:18000,seats:2,efficiency:28},
  {model:'Utili Van',type:'van',price:89000,seats:8,efficiency:9}
];
export const transitRoutes=[
  {id:'L1',name:'Linha 1 · Circular Centro',color:'#c65446',fare:4.8,stops:[[7,6],[13,6],[19,6],[25,6],[25,11],[25,16],[19,16],[13,16],[7,16],[7,11],[7,6]]},
  {id:'L2',name:'Linha 2 · Norte–Sul',color:'#416f8d',fare:4.8,stops:[[19,1],[19,6],[19,11],[19,16],[19,21],[19,26],[19,31],[19,26],[19,21],[19,16],[19,11],[19,6],[19,1]]},
  {id:'L3',name:'Linha 3 · Bairro Esperança',color:'#66834f',fare:4.8,stops:[[13,21],[19,21],[25,21],[31,21],[37,21],[37,16],[31,16],[25,16],[19,16],[13,16],[13,21]]},
  {id:'L4',name:'Linha 4 · Interbairros',color:'#8a5d92',fare:4.8,stops:[[1,26],[7,26],[13,26],[19,26],[25,26],[31,26],[37,26],[37,11],[31,11],[25,11],[19,11],[13,11],[7,11],[1,11],[1,26]]}
];
export const emptyMobility=()=>({license:false,vehicleIds:[],preferred:'a pé',trips:0,transitTrips:0,commuteMinutes:0});
export const emptyVehicleRecord=()=>({stolen:false,recovered:false,listed:false,history:[]});
