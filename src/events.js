export const seasonalCalendar=[
  {id:'summer',week:2,name:'Cinema de Verão',season:'Verão',location:'Parque das Mangueiras',start:19,end:23,duration:2,budget:4200},
  {id:'carnival',week:7,name:'Carnaval de Rua',season:'Verão',location:'Praça das Acácias',start:16,end:24,duration:3,budget:18000},
  {id:'autumn',week:17,name:'Feira de Sabores de Outono',season:'Outono',location:'Mercado do Sol',start:10,end:20,duration:2,budget:6800},
  {id:'june',week:25,name:'Festa Junina Municipal',season:'Inverno',location:'Praça das Acácias',start:17,end:24,duration:3,budget:14500},
  {id:'spring',week:39,name:'Festival da Primavera',season:'Primavera',location:'Parque das Mangueiras',start:9,end:21,duration:2,budget:9200},
  {id:'christmas',week:51,name:'Natal na Praça',season:'Verão',location:'Praça das Acácias',start:18,end:24,duration:4,budget:16000}
];
export const seasonForWeek=week=>week<=12||week>=50?'Verão':week<=25?'Outono':week<=38?'Inverno':'Primavera';
