export const utilityTypes={
  water:{name:'Água',unit:'m³',color:'#4b8eb5',baseCapacity:1680,rate:4.7},
  power:{name:'Energia',unit:'kWh',color:'#d7a63f',baseCapacity:2720,rate:.82},
  waste:{name:'Resíduos',unit:'kg',color:'#668c62',baseCapacity:1420,rate:.36}
};
export const buildingDemand={home:{water:5.2,power:8.5,waste:3.4},shop:{water:12,power:24,waste:11},health:{water:34,power:62,waste:18},school:{water:24,power:38,waste:14},civic:{water:15,power:31,waste:9},park:{water:18,power:5,waste:7}};
export const emptyMeter=()=>({water:0,power:0,waste:0,bill:0,connected:true,outages:0,lastReading:0});
