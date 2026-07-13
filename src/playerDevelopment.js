const clamp = (value, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
const asArray = (value) => Array.isArray(value) ? value : [];
const round = (value, digits = 0) => { const factor = 10 ** digits; return Math.round((Number(value) || 0) * factor) / factor; };

export const PLAYER_DEVELOPMENT_VERSION = 1;
export const PLAYER_DEVELOPMENT_THRESHOLDS = Object.freeze([0, 80, 220, 480, 850, 1350]);
export const PLAYER_DEVELOPMENT_DOMAINS = Object.freeze([
  { id: "wellbeing", name: "Bem-estar", description: "Autocuidado, saúde, energia e equilíbrio emocional.", levels: ["Sobrevivendo", "Criando rotina", "Equilíbrio", "Resiliência", "Plenitude", "Referência de cuidado"] },
  { id: "relationships", name: "Relações", description: "Amizades, família, intimidade, limites e reparação.", levels: ["Desconhecido", "Criando laços", "Pessoa próxima", "Pilar da rede", "Vínculos profundos", "Legado afetivo"] },
  { id: "career", name: "Carreira", description: "Trabalho, reputação profissional, renda e responsabilidade.", levels: ["Em busca", "Iniciante", "Profissional", "Especialista", "Liderança", "Legado profissional"] },
  { id: "education", name: "Formação", description: "Estudos, competências, desempenho e curiosidade.", levels: ["Curioso", "Aprendiz", "Aplicado", "Competente", "Mestre", "Mentor"] },
  { id: "finance", name: "Patrimônio", description: "Estabilidade, contratos, propriedades e escolhas financeiras.", levels: ["Instável", "Organizando-se", "Reserva", "Estável", "Próspero", "Legado patrimonial"] },
  { id: "civic", name: "Vida cívica", description: "Participação comunitária, serviços públicos e influência local.", levels: ["Morador", "Participante", "Voz ativa", "Liderança local", "Agente público", "Legado cívico"] },
  { id: "culture", name: "Vida urbana", description: "Exploração, lazer, cultura e repertório de experiências.", levels: ["Recém-chegado", "Explorador", "Frequentador", "Conectado", "Figura da cidade", "Memória viva"] },
]);

const domainById = new Map(PLAYER_DEVELOPMENT_DOMAINS.map((domain) => [domain.id, domain]));

function levelForXp(xp) {
  let level = 0;
  PLAYER_DEVELOPMENT_THRESHOLDS.forEach((threshold, index) => { if (xp >= threshold) level = index; });
  return level;
}

function normalizeDomain(input = {}) {
  const xp = Math.max(0, round(input.xp, 1)), level = levelForXp(xp);
  return { xp, level, milestones: asArray(input.milestones).slice(0, 30).map(String) };
}

export function ensurePlayerDevelopment(person, clock = {}) {
  const source = person?.playerDevelopment && typeof person.playerDevelopment === "object" ? person.playerDevelopment : {};
  const domains = {};
  PLAYER_DEVELOPMENT_DOMAINS.forEach((domain) => { domains[domain.id] = normalizeDomain(source.domains?.[domain.id]); });
  const state = {
    version: PLAYER_DEVELOPMENT_VERSION,
    startedWeek: Number(source.startedWeek || clock.week || 1),
    domains,
    chapters: asArray(source.chapters).slice(0, 30).map((chapter) => ({ id: String(chapter.id), title: String(chapter.title), text: String(chapter.text), week: Number(chapter.week || 1) })),
    history: asArray(source.history).slice(0, 100).map((entry) => ({ week: Number(entry.week || 1), day: Number(entry.day || 0), domain: String(entry.domain || "wellbeing"), amount: Number(entry.amount || 0), text: String(entry.text || "Progresso registrado.") })),
    bonuses: { ...(source.bonuses || {}) },
  };
  if (person) person.playerDevelopment = state;
  updateBonuses(state);
  return state;
}

function updateBonuses(state) {
  const level = (id) => state.domains[id]?.level || 0;
  state.bonuses = {
    recoveryMultiplier: round(1 + level("wellbeing") * .04, 2),
    relationshipAcceptance: level("relationships") * 1.5,
    wageMultiplier: round(1 + level("career") * .025, 3),
    learningMultiplier: round(1 + level("education") * .04, 2),
    civicInfluence: level("civic") * 2,
    experienceMultiplier: round(1 + level("culture") * .02, 2),
  };
}

function addChapter(state, id, title, text, week) {
  if (state.chapters.some((chapter) => chapter.id === id)) return false;
  state.chapters.unshift({ id, title, text, week: Number(week || 1) });
  state.chapters = state.chapters.slice(0, 30);
  return true;
}

function derivedFloors(person, simulation) {
  const relationships = typeof simulation?.relationshipsOf === "function" ? simulation.relationshipsOf(person) : [];
  const family = simulation?.families?.find((item) => item.memberIds?.includes(person.id));
  const propertyCount = simulation?.buildings?.filter((building) => building.ownerId === person.id || family?.propertyIds?.includes(building.id)).length || 0;
  const placeCount = new Set(asArray(person.placeInteractionHistory).map((entry) => entry.buildingId)).size;
  const positiveLinks = relationships.filter(({ link }) => (link.affinity || 0) >= 30).length;
  return {
    wellbeing: clamp((person.health || 0) * .65 + (person.happiness || 0) * .25 + (person.energy || 0) * .1, 0, 100) * 1.3,
    relationships: positiveLinks * 28 + relationships.filter(({ link }) => link.lifecycle).length * 55 + asArray(person.actionLog).filter((entry) => entry.interactionId).length * 3,
    career: (person.shift ? 90 : 0) + (person.playerControl?.workMinutesThisWeek || 0) * .35 + Math.max(0, Number(person.hourlyWage || 0) - 15) * 4,
    education: (person.education?.enrolled ? 65 : 0) + Number(person.education?.credits || 0) * 26 + Number(person.education?.performance || 0) * .8,
    finance: Math.max(0, Math.log10(Math.max(1, Number(person.money || 0))) - 2) * 110 + propertyCount * 180 + asArray(simulation?.markets?.realEstate?.contracts).filter((contract) => [contract.debtorId, contract.tenantId].includes(person.id)).length * 45,
    civic: Number(person.playerExperience?.civic || 0) * 14 + asArray(person.placeInteractionHistory).filter((entry) => /cityhall|civic|police/.test(entry.interactionId)).length * 16,
    culture: placeCount * 34 + asArray(person.placeInteractionHistory).length * 5,
  };
}

export function syncPlayerDevelopment(person, simulation) {
  const state = ensurePlayerDevelopment(person, { week: simulation?.week });
  const floors = derivedFloors(person, simulation);
  Object.entries(floors).forEach(([id, xp]) => {
    const domain = state.domains[id];
    if (domain && xp > domain.xp) domain.xp = round(xp, 1);
    if (domain) domain.level = levelForXp(domain.xp);
  });
  const goals = asArray(person.personalGoals);
  const known = typeof simulation?.relationshipsOf === "function" ? simulation.relationshipsOf(person).length : 0;
  const romantic = typeof simulation?.romanticLinksOf === "function" ? simulation.romanticLinksOf(person, { activeOnly: true }) : [];
  addChapter(state, "arrival", "Um novo começo", `${person.name} começou uma nova trajetória em Vila Esperança.`, state.startedWeek);
  if (person.shift || person.education?.enrolled) addChapter(state, "direction", "Uma direção", person.shift ? `Conquistou um vínculo como ${person.role}.` : `Ingressou em ${person.education.institution}.`, simulation?.week);
  if (known >= 5) addChapter(state, "belonging", "Laços na cidade", "Construiu uma rede de pessoas conhecidas e deixou de viver como estranho na cidade.", simulation?.week);
  if (romantic.length) addChapter(state, "intimacy", "Uma história a dois", "Um vínculo amoroso passou a integrar sua trajetória.", simulation?.week);
  if (goals.some((goal) => (goal.progress || 0) >= 50)) addChapter(state, "turning_point", "Ponto de virada", "Uma aspiração de vida alcançou metade de seu caminho.", simulation?.week);
  if (state.chapters.length >= 5 || goals.some((goal) => goal.status === "completed")) addChapter(state, "legacy", "O começo de um legado", "Suas decisões já produzem consequências duradouras para pessoas, patrimônio e cidade.", simulation?.week);
  updateBonuses(state);
  person.playerDevelopment = state;
  return state;
}

export function recordPlayerDevelopment(person, simulation, input = {}) {
  const state = syncPlayerDevelopment(person, simulation), id = domainById.has(input.domain) ? input.domain : "wellbeing", domain = state.domains[id], amount = Math.max(0, Number(input.amount || 0));
  if (!amount) return { state, leveledUp: false, domain: id };
  const previousLevel = domain.level;
  domain.xp = round(domain.xp + amount * (state.bonuses.experienceMultiplier || 1), 1);
  domain.level = levelForXp(domain.xp);
  const leveledUp = domain.level > previousLevel, definition = domainById.get(id);
  if (leveledUp) {
    const milestone = `${definition.name}: ${definition.levels[domain.level]}`;
    if (!domain.milestones.includes(milestone)) domain.milestones.unshift(milestone);
    person.happiness = clamp((person.happiness || 0) + 2 + domain.level * .4);
  }
  state.history.unshift({ week: Number(simulation?.week || 1), day: Number(simulation?.day || 0), domain: id, amount: round(amount, 1), text: String(input.text || `Avanço em ${definition.name}.`) });
  state.history = state.history.slice(0, 100);
  updateBonuses(state);
  return { state, leveledUp, domain: id, level: domain.level, levelName: definition.levels[domain.level] };
}

export function getPlayerStoryOpportunities(person, simulation) {
  const opportunities = [], relationships = typeof simulation?.relationshipsOf === "function" ? simulation.relationshipsOf(person) : [];
  const lowNeed = Object.entries({ hunger: person.needs?.hunger, social: person.needs?.social, hygiene: person.needs?.hygiene, energy: person.energy }).sort((a, b) => Number(a[1]) - Number(b[1]))[0];
  if (Number(lowNeed?.[1]) < 45) opportunities.push({ id: "recover", domain: "wellbeing", priority: 95 - Number(lowNeed[1]), title: "Recuperar o equilíbrio", description: `${lowNeed[0]} está em ${Math.round(lowNeed[1])}%.`, hint: "Use a aba Agora ou Saúde antes de assumir compromissos longos." });
  if (!person.shift && person.age >= 18) opportunities.push({ id: "find_work", domain: "career", priority: 76, title: "Construir uma vida profissional", description: "Sem vínculo de trabalho, a renda e a progressão patrimonial ficam limitadas.", hint: "Abra Trabalho para conhecer empregadores e candidatar-se." });
  else if (person.shift) opportunities.push({ id: "career_growth", domain: "career", priority: 42, title: "Consolidar sua reputação", description: `${person.role} em ${person.workplace}.`, hint: "Cumpra expedientes e desenvolva formação relacionada." });
  if (!person.education?.enrolled) opportunities.push({ id: "education", domain: "education", priority: 48, title: "Investir em formação", description: "Uma matrícula abre competências e novas oportunidades.", hint: "Veja instituições na aba Estudos." });
  if (relationships.length < 4) opportunities.push({ id: "belong", domain: "relationships", priority: 68, title: "Criar uma rede de apoio", description: "Seu círculo social ainda é pequeno.", hint: "Conheça pessoas presentes nos mesmos lugares e cultive contatos." });
  const tense = relationships.find(({ link }) => (link.tension || 0) >= 30);
  if (tense) opportunities.push({ id: `repair:${tense.person.id}`, domain: "relationships", priority: 72, title: `Resolver a tensão com ${tense.person.firstName}`, description: `O vínculo acumula ${Math.round(tense.link.tension)}% de tensão.`, hint: "Abra a relação e avalie pedir desculpas, estabelecer limites ou reparar o vínculo." });
  const family = simulation?.families?.find((item) => item.memberIds?.includes(person.id));
  if ((family?.wealth || person.money || 0) > 9000) opportunities.push({ id: "housing", domain: "finance", priority: 38, title: "Planejar moradia e patrimônio", description: "Há recursos para comparar contratos e imóveis.", hint: "Use Moradia para avaliar aluguel, compra e financiamento." });
  if (new Set(asArray(person.placeInteractionHistory).map((entry) => entry.buildingId)).size < 5) opportunities.push({ id: "explore", domain: "culture", priority: 45, title: "Descobrir a cidade", description: "Novos lugares oferecem atividades, contatos e memórias diferentes.", hint: "Abra Lugares e explore cultura, parques, serviços e comércio." });
  opportunities.push({ id: "civic", domain: "civic", priority: 25, title: "Participar de Vila Esperança", description: "Audiências e serviços públicos conectam sua história ao destino da cidade.", hint: "Visite a Prefeitura, equipamentos cívicos e ações comunitárias." });
  return opportunities.sort((left, right) => right.priority - left.priority).slice(0, 8);
}

export function getPlayerDevelopmentDashboard(person, simulation) {
  const state = syncPlayerDevelopment(person, simulation);
  return {
    version: PLAYER_DEVELOPMENT_VERSION,
    domains: PLAYER_DEVELOPMENT_DOMAINS.map((definition) => {
      const current = state.domains[definition.id], nextThreshold = PLAYER_DEVELOPMENT_THRESHOLDS[Math.min(PLAYER_DEVELOPMENT_THRESHOLDS.length - 1, current.level + 1)];
      const floor = PLAYER_DEVELOPMENT_THRESHOLDS[current.level], span = Math.max(1, nextThreshold - floor), progress = current.level >= PLAYER_DEVELOPMENT_THRESHOLDS.length - 1 ? 100 : clamp((current.xp - floor) / span * 100);
      return { ...definition, ...current, levelName: definition.levels[current.level], nextLevelName: definition.levels[Math.min(definition.levels.length - 1, current.level + 1)], nextThreshold, progress: round(progress) };
    }),
    chapters: [...state.chapters],
    opportunities: getPlayerStoryOpportunities(person, simulation),
    bonuses: { ...state.bonuses },
    history: [...state.history],
  };
}
