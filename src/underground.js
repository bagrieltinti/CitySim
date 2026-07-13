export const undergroundVenues = {
  "Porão 77": { front:"Bar privado", activity:"cassino clandestino", products:["aposta ilegal","bebida sem licença"], professions:["Apostador profissional","Crupiê clandestino","Cobrador"], baseHeat:18 },
  "Depósito Norte": { front:"Armazém logístico", activity:"contrabando", products:["eletrônicos contrabandeados","mercadoria sem nota","medicamento desviado"], professions:["Contrabandista","Olheiro","Transportador clandestino"], baseHeat:24 },
  "Agência Prisma": { front:"Consultoria financeira", activity:"lavagem de dinheiro", products:["empresa de fachada","conta laranja","nota fiscal falsa"], professions:["Operador financeiro ilegal","Laranja","Contador clandestino"], baseHeat:28 },
  "Casa Vênus": { front:"Casa noturna", activity:"serviços adultos sem licença", products:["companhia adulta","evento privado"], professions:["Profissional do sexo","Agenciador ilegal","Segurança clandestino"], baseHeat:20 },
  "Banca do Viaduto": { front:"Comércio informal", activity:"receptação", products:["peça roubada","celular de origem duvidosa","documento falso"], professions:["Receptador","Falsificador","Vendedor clandestino"], baseHeat:26 }
};

export const illegalProfessions = [...new Set(Object.values(undergroundVenues).flatMap(v=>v.professions))];
export const isAdultUnderground = activity => activity === "serviços adultos sem licença";
