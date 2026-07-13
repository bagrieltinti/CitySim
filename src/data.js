export const masculineFirstNames=['Miguel','Arthur','Gael','Theo','Heitor','Davi','Bento','Samuel','Caio','Ravi','Noah','Tomás','Gabriel','Matheus','Lucas','João','Pedro','Gustavo','Felipe','Henrique','Daniel','Nicolas','Eduardo','Vicente','Bruno','Murilo','Emanuel','Renato','André','Otávio','Diego','Leandro','Antônio','Bernardo','Cauã','Enzo','Fábio','Hugo','Joaquim','Leonardo','Marcelo','Paulo','Rafael','Rodrigo','Vítor','Wesley'];
export const feminineFirstNames=['Helena','Alice','Laura','Cecília','Manuela','Lívia','Valentina','Aurora','Clara','Elisa','Maya','Iara','Beatriz','Sofia','Isabela','Marina','Ana','Luísa','Bianca','Lorena','Yasmin','Camila','Rebeca','Aline','Letícia','Natália','Júlia','Estela','Carolina','Maitê','Teresa','Nina','Adriana','Amanda','Bárbara','Daniela','Fernanda','Gabriela','Heloísa','Larissa','Márcia','Patrícia','Raquel','Renata','Vitória'];
export const neutralFirstNames=['Alex','Ariel','Cris','Dani','Dominique','Luca','Noah','Ravi','Sam','Sol'];
export const firstNames=[...new Set([...masculineFirstNames,...feminineFirstNames,...neutralFirstNames])];
export function firstNameForIdentity(identity,rng=Math.random){const normalized=String(identity||"").toLowerCase(),pool=normalized.includes("mulher")?feminineFirstNames:normalized.includes("homem")?masculineFirstNames:neutralFirstNames;return pool[Math.floor(rng()*pool.length)];}
export const lastNames = ['Almeida','Barbosa','Campos','Dias','Esteves','Freitas','Gomes','Lima','Moraes','Nogueira','Oliveira','Pereira','Queiroz','Rocha','Santos','Teixeira','Vasconcelos','Azevedo','Cardoso','Farias','Machado','Monteiro','Ribeiro','Silveira','Costa','Martins','Carvalho','Mendes','Ramos','Correia','Batista','Cavalcanti','Duarte','Fonseca','Guimarães','Miranda','Pinheiro','Rezende','Tavares','Xavier'];
export const traits = ['gentil','ambicioso','criativo','reservado','sociável','prático','curioso','leal','impulsivo','paciente','romântico','metódico'];
export const jobs = [
  ['Professora', 'Escola Municipal', 29], ['Enfermeiro', 'Hospital São Lucas', 36],
  ['Padeiro', 'Padaria Aurora', 24], ['Analista', 'Edifício Horizonte', 42],
  ['Barista', 'Café do Largo', 21], ['Mecânica', 'Oficina Central', 31],
  ['Farmacêutico', 'Farmácia Popular', 34], ['Policial', 'Delegacia', 38],
  ['Comerciante', 'Mercado do Sol', 32], ['Cozinheiro', 'Bistrô da Praça', 27],
  ['Agente funerário', 'Funerária Serenidade', 31], ['Tanatopraxista', 'Funerária Serenidade', 37],
  ['Médico-legista', 'Instituto Médico-Legal', 48], ['Técnico de necropsia', 'Instituto Médico-Legal', 35],
  ['Padeiro', 'Padaria Aurora', 25], ['Atendente', 'Padaria Aurora', 19],
  ['Bartender', 'Bar Esquina 12', 25], ['Garçom', 'Pub Ferro & Fogo', 22],
  ['DJ', 'Clube Eclipse', 34], ['Segurança', 'Boate Nebulosa', 28],
  ['Promotor de eventos', 'Clube Eclipse', 31], ['Músico', 'Casa de Shows Estação', 32],
  ['Técnico de som', 'Casa de Shows Estação', 30], ['Bilheteiro', 'Casa de Shows Estação', 20],
  ['Recepcionista', 'Casa Rubi', 24], ['Artista adulta', 'Casa Rubi', 36],
  ['Mecânico', 'Oficina Central', 32], ['Eletricista automotivo', 'Oficina Central', 35],
  ['Frentista', 'Posto Avenida', 23], ['Caixa bancário', 'Banco Cooperativo', 31],
  ['Analista de crédito', 'Banco Cooperativo', 43], ['Sucateiro', 'Ferro-Velho Oeste', 27],
  ['Estudante', 'Faculdade Municipal', 0], ['Autônomo', 'Em casa', 25]
];
export const venueTypes = [
  { type:'home', label:'Residência', color:'#d8b98a' }, { type:'shop', label:'Comércio', color:'#e07a5f' },
  { type:'park', label:'Parque', color:'#76a878' }, { type:'school', label:'Educação', color:'#e9c46a' },
  { type:'health', label:'Saúde', color:'#ef8c8c' }, { type:'civic', label:'Serviço público', color:'#81a4cd' }
];
export const headlines = [
  'A feira de domingo movimentou a Praça das Acácias.', 'Uma nova família chegou à cidade e está hospedada no Hotel Central.',
  'Moradores organizaram um mutirão no Parque das Mangueiras.', 'O Mercado do Sol contratou dois novos funcionários.',
  'A escola abriu inscrições para as atividades do próximo semestre.', 'O Café do Largo virou ponto de encontro depois do expediente.'
];
