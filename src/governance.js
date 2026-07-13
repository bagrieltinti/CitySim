export const defaultPolicies={incomeTax:5,businessTax:8,propertyTax:.35,transitFare:4.8};
export const defaultBudget={health:22,education:20,security:18,transport:16,infrastructure:24};
export const policyLabels={health:'Saúde',education:'Educação',security:'Segurança',transport:'Transporte',infrastructure:'Infraestrutura'};
export const normalizeBudget=(budget,changed)=>{const value=Math.max(5,Math.min(60,budget[changed])),others=Object.keys(budget).filter(k=>k!==changed),remaining=100-value,current=others.reduce((s,k)=>s+budget[k],0);const result={...budget,[changed]:value};others.forEach((k,i)=>result[k]=i===others.length-1?remaining-others.slice(0,-1).reduce((s,x)=>s+result[x],0):Math.max(5,Math.round(budget[k]/current*remaining)));return result;};
