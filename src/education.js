export const educationStages = [
  {id:'childhood',name:'Educação infantil',minAge:4,maxAge:5,institution:'Escola Municipal'},
  {id:'primary',name:'Ensino fundamental',minAge:6,maxAge:14,institution:'Escola Municipal'},
  {id:'secondary',name:'Ensino médio',minAge:15,maxAge:17,institution:'Escola Municipal'},
  {id:'college',name:'Ensino superior',minAge:18,maxAge:29,institution:'Faculdade Municipal'}
];
export const courses=['Administração','Enfermagem','Engenharia civil','Pedagogia','Direito','Tecnologia da informação'];
export const skillNames=['comunicação','lógica','criatividade','organização','técnica'];
export const stageForAge=age=>educationStages.find(s=>age>=s.minAge&&age<=s.maxAge);
export const emptyEducation=()=>({stage:'none',institution:null,course:null,enrolled:false,attendance:100,performance:50,semester:1,credits:0,degree:null,skills:{comunicação:20,lógica:20,criatividade:20,organização:20,técnica:10},history:[]});
