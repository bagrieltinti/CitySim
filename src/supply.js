export const suppliers=[
  {id:'foods',name:'Cooperativa Vale Verde',categories:['alimentos','café','refeição'],distance:38,reliability:.93,markup:.43},
  {id:'health',name:'Distribuidora MedSul',categories:['remédio','higiene'],distance:74,reliability:.88,markup:.48},
  {id:'services',name:'Central Regional de Insumos',categories:['diária','consulta','serviço','ingresso','entrada'],distance:51,reliability:.96,markup:.35},
  {id:'drinks',name:'Bebidas Serra Azul',categories:['bebida','petisco','lanche','pão','conveniência'],distance:44,reliability:.91,markup:.4},
  {id:'auto',name:'Autopeças Rodovia',categories:['peça','reparo','combustível','sucata'],distance:67,reliability:.86,markup:.46},
  {id:'funeral',name:'Central Funerária Regional',categories:['básico','tradicional','cerimonial'],distance:82,reliability:.94,markup:.38}
];
export const supplierFor=product=>suppliers.find(s=>s.categories.includes(product))||suppliers[2];
export const productShelfLife={alimentos:16,café:35,refeição:3,remédio:90,higiene:120,diária:999,consulta:999,pão:2,lanche:2,bebida:180,petisco:20,combustível:999,peça:999,sucata:999,ingresso:999,entrada:999};
