const clamp = (value, minimum = 0, maximum = 100) =>
  Math.max(minimum, Math.min(maximum, Number.isFinite(Number(value)) ? Number(value) : minimum));

const slug = (value) => String(value || "atividade")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_|_$/g, "");

const title = (value) => {
  const text = String(value || "Interagir com o local").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "Interagir com o local";
};

const asArray = (value) => Array.isArray(value) ? value : [];
const humanCareFacility = (building) => /hospital|\bubs\b|caps|odontol/i.test(String(building?.name || ""));

const BASE_INTERACTIONS = Object.freeze([
  { id: "home_cook", label: "Preparar uma refeição caprichada", description: "Cozinhar com calma e cuidar da alimentação.", types: ["home"], durationMinutes: 50, effects: { hunger: 34, comfort: 5, energy: -3, happiness: 2 } },
  { id: "home_organize", label: "Organizar e cuidar da casa", description: "Arrumar o ambiente e resolver pequenas tarefas domésticas.", types: ["home"], durationMinutes: 45, effects: { hygiene: 12, comfort: 20, energy: -5, happiness: 1 } },
  { id: "home_plan", label: "Planejar a semana", description: "Rever compromissos, orçamento e objetivos pessoais.", types: ["home"], durationMinutes: 30, effects: { comfort: 8, stress: -7, happiness: 1 } },
  { id: "home_exercise", label: "Fazer exercício em casa", description: "Treinar sem equipamento e melhorar o condicionamento.", types: ["home"], durationMinutes: 40, effects: { health: 2, energy: -9, hygiene: -7, happiness: 2 } },
  { id: "park_walk", label: "Caminhar pelo parque", description: "Observar a cidade, respirar e aliviar a tensão.", types: ["park"], durationMinutes: 40, effects: { health: 2, energy: -4, stress: -8, happiness: 4, social: 2 } },
  { id: "park_exercise", label: "Treinar ao ar livre", description: "Usar o espaço público para uma atividade física mais intensa.", types: ["park"], durationMinutes: 55, effects: { health: 3, energy: -12, hygiene: -8, happiness: 4 } },
  { id: "park_relax", label: "Relaxar e observar o movimento", description: "Sentar por alguns minutos e acompanhar a vida do bairro.", types: ["park"], durationMinutes: 35, effects: { energy: 5, stress: -10, happiness: 3, social: 2 } },
  { id: "school_library", label: "Usar biblioteca e espaços de estudo", description: "Pesquisar, ler e desenvolver conhecimentos fora das aulas.", types: ["school"], durationMinutes: 70, effects: { energy: -6, happiness: 1, education: 1.8 } },
  { id: "school_orientation", label: "Pedir orientação acadêmica", description: "Conversar sobre cursos, desempenho e próximos passos.", types: ["school"], durationMinutes: 35, effects: { stress: -5, education: 0.8, social: 3 } },
  { id: "school_socialize", label: "Conhecer colegas no campus", description: "Circular pelos espaços comuns e ampliar contatos.", types: ["school"], durationMinutes: 45, effects: { social: 12, happiness: 3, energy: -3 } },
  { id: "health_prevention", label: "Participar de orientação preventiva", description: "Receber informações de prevenção e autocuidado.", types: ["health"], durationMinutes: 35, effects: { health: 2, stress: -4, happiness: 1 } },
  { id: "health_waiting_room", label: "Conversar na sala de espera", description: "Trocar experiências com outras pessoas presentes.", types: ["health"], durationMinutes: 25, effects: { social: 7, stress: -2 } },
  { id: "civic_request", label: "Protocolar uma solicitação", description: "Registrar formalmente uma demanda de serviço público.", types: ["civic"], durationMinutes: 35, effects: { civic: 2, stress: -2 } },
  { id: "civic_information", label: "Consultar serviços e documentos", description: "Buscar informações oficiais e acompanhar processos.", types: ["civic"], durationMinutes: 25, effects: { civic: 1, stress: -3 } },
  { id: "civic_hearing", label: "Participar de atendimento público", description: "Apresentar necessidades e ouvir encaminhamentos da equipe municipal.", types: ["civic"], durationMinutes: 55, effects: { civic: 4, social: 5, happiness: 1 } },
]);

const SPECIAL_INTERACTIONS = Object.freeze([
  { id: "cityhall_budget", match: /prefeit/i, label: "Consultar orçamento e obras", description: "Acompanhar contratos, prioridades e a execução municipal.", durationMinutes: 40, effects: { civic: 5, social: 2 } },
  { id: "cityhall_audience", match: /prefeit/i, label: "Participar de audiência pública", description: "Falar sobre o bairro e reagir às propostas da gestão.", durationMinutes: 75, effects: { civic: 8, social: 8, energy: -4, happiness: 2 } },
  { id: "police_report", match: /delegacia/i, label: "Registrar uma ocorrência", description: "Formalizar um fato e solicitar orientação policial.", durationMinutes: 50, effects: { civic: 4, stress: -4 } },
  { id: "police_guidance", match: /delegacia/i, label: "Pedir orientação de segurança", description: "Conversar sobre prevenção, direitos e procedimentos.", durationMinutes: 30, effects: { civic: 2, stress: -5 } },
  { id: "museum_explore", match: /museu/i, label: "Explorar o acervo da cidade", description: "Conhecer histórias, objetos e memórias dos bairros.", durationMinutes: 80, effects: { happiness: 5, social: 4, education: 1.5, energy: -4 } },
  { id: "cinema_session", match: /cinema/i, label: "Assistir a uma sessão", description: "Acompanhar um filme e compartilhar a experiência com o público.", durationMinutes: 120, cost: 24, effects: { happiness: 9, social: 7, energy: -5, stress: -8 } },
  { id: "employment_guidance", match: /emprego/i, label: "Receber orientação profissional", description: "Revisar perfil, vagas e caminhos de qualificação.", durationMinutes: 55, effects: { career: 4, stress: -5, civic: 2 } },
  { id: "cemetery_remember", match: /cemit[eé]rio/i, label: "Visitar e preservar uma memória", description: "Reservar um momento de lembrança e elaboração emocional.", durationMinutes: 50, effects: { happiness: -1, stress: -7, social: 2 } },
]);

function businessEffect(label, business) {
  const text = `${label} ${business?.sector || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const effects = { happiness: 3, social: 4, energy: -3 };
  if (/comer|jantar|lanchar|refeicao|pizza|sorvete|cafe|pao/.test(text)) Object.assign(effects, { hunger: 20, happiness: 5, social: 6 });
  if (/dancar|festa|show|musica|celebrar|bar|boate|clube/.test(text)) Object.assign(effects, { happiness: 8, social: 12, energy: -9, hygiene: -4, stress: -5 });
  if (/exercicio|atividade leve|academia|bem-estar/.test(text)) Object.assign(effects, { health: 3, happiness: 4, energy: -11, hygiene: -7 });
  if (/livro|exposicao|visita guiada|curso|oficina/.test(text)) Object.assign(effects, { education: 1.5, happiness: 4, social: 5 });
  if (/cabelo|barba|estetico|beleza/.test(text)) Object.assign(effects, { hygiene: 18, happiness: 7, social: 4 });
  if (/terapia|saude|consulta|exame|tratamento/.test(text) && !/veterin|saude animal/.test(text)) Object.assign(effects, { health: 3, stress: -7, happiness: 1 });
  if (/vaga|entrevista|profissional/.test(text)) Object.assign(effects, { career: 4, stress: -4, social: 4 });
  if (/contas|emprestimo|investir|credito|financiamento/.test(text)) Object.assign(effects, { finance: 4, stress: -3 });
  if (/parque|caminhar|ar livre/.test(text)) Object.assign(effects, { health: 2, stress: -7, happiness: 4 });
  return effects;
}

function inferredCost(label, business) {
  const text = String(label).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/orientacao|procurar vaga|entrevista|curso profissional|atividade leve|oficina/.test(text)) return 0;
  if (/aposta/.test(text)) return 120;
  if (/show|festa|dancar|sessao|exposicao/.test(text)) return Math.min(48, ...Object.values(business?.products || {}).map((product) => Number(product.price) || 48));
  return 0;
}

function fallbackBusinessActivities(business) {
  const sector = String(business?.sector || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/mercado|vestuario|livraria|comercio/.test(sector)) return ["comparar opções com calma", "pedir recomendação à equipe"];
  if (/cafe|restaurante|padaria|pizzaria|sorveteria/.test(sector)) return ["sentar e aproveitar o ambiente", "conversar com outras pessoas no salão"];
  if (/farmacia|saude|diagnostico|odont|veterin/.test(sector)) return ["pedir orientação profissional", "receber orientação preventiva"];
  if (/hotel/.test(sector)) return ["relaxar no saguão", "conhecer hóspedes e visitantes"];
  if (/educacao/.test(sector)) return ["conhecer os espaços", "conversar sobre cursos e atividades"];
  if (/servico publico|registr|emprego|assistencia/.test(sector)) return ["solicitar orientação de atendimento", "acompanhar um protocolo"];
  if (/financeir|imobili/.test(sector)) return ["pedir uma simulação detalhada", "conversar sobre planejamento financeiro"];
  if (/automot|combustivel|construcao/.test(sector)) return ["solicitar uma avaliação técnica", "acompanhar o serviço de perto"];
  if (/entretenimento|cultura|cinema|museu/.test(sector)) return ["explorar a programação", "socializar com o público"];
  if (/bem-estar|beleza|barbearia/.test(sector)) return ["receber uma orientação personalizada", "relaxar durante o atendimento"];
  return ["conhecer o funcionamento do local", "conversar com a equipe"];
}

function businessInteractions(business) {
  if (!business) return [];
  const labels = asArray(business?.interactions).length ? asArray(business.interactions) : fallbackBusinessActivities(business);
  return labels.slice(0, 8).map((label) => ({
    id: `business_${slug(business.id || business.name)}_${slug(label)}`,
    label: title(label),
    description: `Vivenciar esta atividade em ${business.name}.`,
    durationMinutes: /show|festa|jantar|evento|companhia/i.test(label) ? 90 : 45,
    cost: inferredCost(label, business),
    effects: businessEffect(label, business),
    businessId: business.id,
  }));
}

function developmentDomainFor(interaction, business) {
  const id = String(interaction?.id || ""), effects = interaction?.effects || {};
  if (/^(museum|cinema)_/.test(id)) return "culture";
  if (/^employment_/.test(id) || effects.career) return "career";
  if (effects.finance) return "finance";
  if (/^(cityhall|civic|police)_/.test(id) || effects.civic) return "civic";
  if (id === "school_socialize") return "relationships";
  if (/^school_/.test(id) || effects.education) return "education";
  if (/^(home|park|health|cemetery)_/.test(id)) return "wellbeing";
  const text = `${interaction?.label || ""} ${business?.sector || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/cinema|cultura|museu|show|musica|festa|dancar|exposicao/.test(text)) return "culture";
  if (effects.health || effects.stress || effects.hunger || effects.hygiene || effects.comfort || effects.energy) return "wellbeing";
  if (effects.social) return "relationships";
  return "culture";
}

function contextOf(sim, person, buildingInput) {
  const building = typeof buildingInput === "string"
    ? sim?.buildings?.find((item) => item.id === buildingInput)
    : buildingInput;
  const business = sim?.businesses?.find((item) => item.buildingId === building?.id) || null;
  return { sim, person, building, business };
}

function availability(interaction, context) {
  const { sim, person, building, business } = context;
  if (!person?.alive || !building) return "Pessoa ou local indisponível.";
  if (person.currentTrip || person.locationId !== building.id) return "Você precisa estar no local para realizar esta ação.";
  if (person.playerControl?.activeAction) return "Conclua ou cancele a ação atual.";
  if (business && typeof sim?.isOpen === "function" && !sim.isOpen(business)) return `${business.name} está fechado neste horário.`;
  if (business?.adultOnly && person.age < 18) return "Este estabelecimento é exclusivo para adultos.";
  if ((interaction.cost || 0) > (person.money || 0)) return "Dinheiro insuficiente para esta atividade.";
  const last = asArray(person.placeInteractionHistory).find((entry) => entry.interactionId === interaction.id);
  const now = typeof sim?.absoluteMinute === "function" ? sim.absoluteMinute() : 0;
  const remaining = last ? Math.max(0, (interaction.cooldownMinutes || 90) - (now - (last.absoluteMinute || 0))) : 0;
  if (remaining > 0) return `Espere cerca de ${Math.ceil(remaining)} minuto(s) antes de repetir esta atividade.`;
  return null;
}

export function listPlaceInteractions(sim, person, buildingInput) {
  const context = contextOf(sim, person, buildingInput);
  if (!context.building) return [];
  const healthcareAllowed = typeof sim?.playerHealthcareEligibility === "function"
    ? sim.playerHealthcareEligibility(person, context.building).ok
    : humanCareFacility(context.building);
  const base = BASE_INTERACTIONS.filter((entry) => entry.types.includes(context.building.type) && (!entry.id.startsWith("health_") || healthcareAllowed));
  const special = SPECIAL_INTERACTIONS.filter((entry) => entry.match.test(`${context.building.name} ${context.business?.sector || ""}`));
  const dynamic = businessInteractions(context.business);
  return [...base, ...special, ...dynamic]
    .filter((entry, index, all) => all.findIndex((candidate) => candidate.id === entry.id) === index)
    .slice(0, 14)
    .map((entry) => {
      const reason = availability(entry, context);
      return { ...entry, developmentDomain: developmentDomainFor(entry, context.business), available: !reason, reason, buildingId: context.building.id, businessId: entry.businessId || context.business?.id || null };
    });
}

export function placeInteractionById(sim, person, buildingInput, interactionId) {
  return listPlaceInteractions(sim, person, buildingInput).find((entry) => entry.id === interactionId) || null;
}

export function preparePlaceInteraction(sim, person, buildingInput, interactionId) {
  const interaction = placeInteractionById(sim, person, buildingInput, interactionId);
  if (!interaction) return { ok: false, reason: "Esta atividade não está disponível neste local." };
  if (!interaction.available) return { ok: false, reason: interaction.reason, interaction };
  return { ok: true, interaction };
}

function applyEffects(person, effects = {}) {
  person.needs ||= {};
  const recovery = person.playerDevelopment?.bonuses?.recoveryMultiplier || 1, positive = (value) => value > 0 ? value * recovery : value;
  if (effects.hunger) person.needs.hunger = clamp((person.needs.hunger || 0) + positive(effects.hunger));
  if (effects.social) person.needs.social = clamp((person.needs.social || 0) + effects.social);
  if (effects.hygiene) person.needs.hygiene = clamp((person.needs.hygiene || 0) + positive(effects.hygiene));
  if (effects.comfort) person.needs.comfort = clamp((person.needs.comfort || 0) + positive(effects.comfort));
  if (effects.happiness) person.happiness = clamp((person.happiness || 0) + effects.happiness);
  if (effects.energy) person.energy = clamp((person.energy || 0) + effects.energy);
  if (effects.health) person.health = clamp((person.health || 0) + positive(effects.health));
  const emotional = person.mind?.emotional || person.mind?.state;
  if (emotional && effects.stress) emotional.stress = clamp((emotional.stress || 0) + effects.stress);
  if (effects.education && person.education) person.education.performance = clamp((person.education.performance || 0) + effects.education);
  person.playerExperience ||= { civic: 0, career: 0, finance: 0 };
  ["civic", "career", "finance"].forEach((key) => {
    if (effects[key]) person.playerExperience[key] = Math.max(0, (person.playerExperience[key] || 0) + effects[key]);
  });
}

export function resolvePlaceInteraction(sim, person, action = {}) {
  const building = sim?.buildings?.find((item) => item.id === action.placeId);
  const interaction = placeInteractionById(sim, person, building, action.interactionId);
  if (!interaction) return { ok: false, reason: "Esta atividade não está mais disponível neste local." };
  if (person?.locationId !== building?.id || person.currentTrip) return { ok: false, reason: "Você deixou o local antes de concluir a atividade." };
  if (interaction.reason && !interaction.reason.startsWith("Conclua ou cancele")) return { ok: false, reason: interaction.reason, interaction };
  const cost = Math.max(0, Number(interaction.cost) || 0);
  const business = sim?.businesses?.find((item) => item.id === interaction.businessId);
  if (cost > 0) {
    person.money -= cost;
    if (business) {
      business.cash = (business.cash || 0) + cost;
      business.revenue = (business.revenue || 0) + cost;
      business.sales = (business.sales || 0) + 1;
    }
  }
  applyEffects(person, interaction.effects);
  const absoluteMinute = typeof sim?.absoluteMinute === "function" ? sim.absoluteMinute() : 0;
  person.placeInteractionHistory ||= [];
  person.placeInteractionHistory.unshift({ interactionId: interaction.id, buildingId: building.id, businessId: business?.id || null, week: sim.week, day: sim.day, minute: sim.minute, absoluteMinute, cost });
  person.placeInteractionHistory = person.placeInteractionHistory.slice(0, 40);
  if (business) {
    business.collectiveInteractions ||= [];
    const companions = asArray(business.presentCustomers).filter((id) => id !== person.id).slice(0, 4);
    business.collectiveInteractions.unshift({ week: sim.week, day: sim.day, time: sim.time, interaction: interaction.label, hostId: person.id, participants: [person.id, ...companions] });
    business.collectiveInteractions = business.collectiveInteractions.slice(0, 24);
  }
  const message = `${interaction.label} em ${building.name} foi concluído${cost ? ` por R$ ${cost.toLocaleString("pt-BR")}` : ""}.`;
  return { ok: true, interaction, cost, message, details: { interactionId: interaction.id, developmentDomain: interaction.developmentDomain || null, buildingId: building.id, businessId: business?.id || null, cost, effects: { ...interaction.effects } } };
}

export const placeInteractionsApi = Object.freeze({
  listPlaceInteractions,
  placeInteractionById,
  preparePlaceInteraction,
  resolvePlaceInteraction,
});
