/**
 * Motor político municipal determinístico da Cidade Viva.
 *
 * O módulo não depende da UI e pode ser usado como uma máquina de estado. Toda
 * aleatoriedade passa por SeededRandom; portanto, a mesma semente, população e
 * sequência de semanas produzem o mesmo histórico.
 */

const clamp = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
const round = (value, digits = 1) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};
const clone = (value) =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
const average = (items) =>
  items.length ? items.reduce((sum, item) => sum + item, 0) / items.length : 0;
const sum = (items, selector = (item) => item) =>
  items.reduce((total, item) => total + selector(item), 0);

export function stableHash(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const deterministicNoise = (key, min = 0, max = 1) =>
  min + (stableHash(key) / 4294967295) * (max - min);

export class SeededRandom {
  constructor(seed = "cidade-viva-politica") {
    this.state = typeof seed === "number" ? seed >>> 0 : stableHash(seed);
    if (!this.state) this.state = 0x9e3779b9;
  }

  next() {
    let state = this.state;
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    this.state = state >>> 0;
    return this.state / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  chance(probability) {
    return this.next() < clamp(probability, 0, 1);
  }

  pick(items) {
    return items.length ? items[this.int(0, items.length - 1)] : null;
  }

  weighted(items, weight = (item) => item.weight ?? 1) {
    const total = sum(items, (item) => Math.max(0, weight(item)));
    if (!items.length || total <= 0) return items[0] ?? null;
    let cursor = this.range(0, total);
    for (const item of items) {
      cursor -= Math.max(0, weight(item));
      if (cursor <= 0) return item;
    }
    return items.at(-1);
  }
}

export const POLITICAL_AXES = Object.freeze({
  economy: { label: "Economia", negative: "serviços públicos", positive: "livre iniciativa" },
  social: { label: "Costumes", negative: "tradicional", positive: "progressista" },
  environment: { label: "Ambiente", negative: "expansão", positive: "preservação" },
  security: { label: "Segurança", negative: "prevenção", positive: "repressão" },
  urbanism: { label: "Urbanismo", negative: "adensamento", positive: "expansão" },
});

export const PARTY_CATALOG = Object.freeze([
  {
    id: "frente-cidada",
    number: 21,
    acronym: "FC",
    name: "Frente Cidadã",
    color: "#38bdf8",
    slogan: "Serviços que chegam a cada bairro",
    ideology: { economy: -32, social: 36, environment: 38, security: -18, urbanism: -20 },
    priorities: ["health", "education", "housing"],
    discipline: 72,
  },
  {
    id: "alianca-liberal",
    number: 30,
    acronym: "ALM",
    name: "Aliança Liberal Municipal",
    color: "#f59e0b",
    slogan: "Emprego, contas equilibradas e cidade aberta",
    ideology: { economy: 68, social: 8, environment: -24, security: 34, urbanism: 42 },
    priorities: ["economy", "infrastructure", "mobility"],
    discipline: 67,
  },
  {
    id: "verde-bairro",
    number: 43,
    acronym: "VB",
    name: "Verde & Bairro",
    color: "#22c55e",
    slogan: "Uma cidade próxima, saudável e resiliente",
    ideology: { economy: -12, social: 58, environment: 88, security: -36, urbanism: -52 },
    priorities: ["environment", "mobility", "culture"],
    discipline: 61,
  },
  {
    id: "trabalho-comunidade",
    number: 14,
    acronym: "TC",
    name: "Trabalho e Comunidade",
    color: "#ef4444",
    slogan: "Renda, moradia e dignidade",
    ideology: { economy: -74, social: 28, environment: 22, security: -28, urbanism: -8 },
    priorities: ["economy", "housing", "health"],
    discipline: 84,
  },
  {
    id: "renovacao-municipal",
    number: 55,
    acronym: "RM",
    name: "Renovação Municipal",
    color: "#a78bfa",
    slogan: "Ordem, família e bairros seguros",
    ideology: { economy: 34, social: -66, environment: -18, security: 82, urbanism: 28 },
    priorities: ["security", "infrastructure", "economy"],
    discipline: 79,
  },
]);

export const POLICY_CATALOG = Object.freeze([
  {
    id: "saude-da-familia",
    name: "Saúde da Família em Todo Bairro",
    department: "health",
    summary: "Amplia equipes de atenção básica, visitas domiciliares e prevenção.",
    cost: 36000,
    implementationWeeks: 16,
    publicSupport: 82,
    ideology: { economy: -42, social: 18, environment: 0, security: -8, urbanism: -14 },
    effects: [{ kind: "budget", key: "health", delta: 3 }, { kind: "modifier", key: "primaryCare", delta: 12 }],
  },
  {
    id: "fila-zero",
    name: "Programa Fila Zero",
    department: "health",
    summary: "Contrata plantões e integra regulação de consultas, exames e internações.",
    cost: 54000,
    implementationWeeks: 12,
    publicSupport: 86,
    ideology: { economy: -34, social: 16, environment: 0, security: 0, urbanism: 0 },
    effects: [{ kind: "budget", key: "health", delta: 2 }, { kind: "modifier", key: "hospitalCapacity", delta: 10 }],
  },
  {
    id: "escola-integral",
    name: "Escola Integral e Conectada",
    department: "education",
    summary: "Expande jornada, alimentação, reforço escolar e formação tecnológica.",
    cost: 47000,
    implementationWeeks: 20,
    publicSupport: 78,
    ideology: { economy: -38, social: 38, environment: 8, security: -14, urbanism: -12 },
    effects: [{ kind: "budget", key: "education", delta: 3 }, { kind: "modifier", key: "educationQuality", delta: 9 }],
  },
  {
    id: "aluguel-social",
    name: "Moradia Primeiro",
    department: "housing",
    summary: "Cria aluguel social, mediação de despejos e produção habitacional.",
    cost: 62000,
    implementationWeeks: 28,
    publicSupport: 69,
    ideology: { economy: -76, social: 46, environment: 8, security: -18, urbanism: -34 },
    effects: [{ kind: "modifier", key: "housingCapacity", delta: 18 }, { kind: "modifier", key: "rentPressure", delta: -10 }],
  },
  {
    id: "corredores-onibus",
    name: "Corredores de Ônibus e Bilhete Integrado",
    department: "mobility",
    summary: "Prioriza ônibus, integra tarifas e melhora frequência nas linhas.",
    cost: 76000,
    implementationWeeks: 30,
    publicSupport: 74,
    ideology: { economy: -24, social: 20, environment: 58, security: -6, urbanism: -48 },
    effects: [{ kind: "budget", key: "transport", delta: 3 }, { kind: "policy", key: "transitFare", delta: -0.3 }, { kind: "modifier", key: "transitPunctuality", delta: 12 }],
  },
  {
    id: "ruas-seguras",
    name: "Ruas Seguras",
    department: "security",
    summary: "Combina iluminação, patrulhamento territorial e prevenção comunitária.",
    cost: 43000,
    implementationWeeks: 18,
    publicSupport: 77,
    ideology: { economy: 2, social: -4, environment: 10, security: 42, urbanism: -8 },
    effects: [{ kind: "budget", key: "security", delta: 3 }, { kind: "modifier", key: "crimePrevention", delta: 11 }],
  },
  {
    id: "guarda-cidada",
    name: "Guarda Cidadã Profissional",
    department: "security",
    summary: "Reestrutura formação, perícia, corregedoria e resposta a emergências.",
    cost: 58000,
    implementationWeeks: 24,
    publicSupport: 71,
    ideology: { economy: 8, social: -22, environment: 0, security: 76, urbanism: 4 },
    effects: [{ kind: "budget", key: "security", delta: 2 }, { kind: "modifier", key: "investigationQuality", delta: 14 }],
  },
  {
    id: "distrito-produtivo",
    name: "Distrito Produtivo Local",
    department: "economy",
    summary: "Oferece crédito condicionado a empregos formais e compras locais.",
    cost: 39000,
    implementationWeeks: 16,
    publicSupport: 64,
    ideology: { economy: 42, social: 4, environment: -12, security: 2, urbanism: 34 },
    effects: [{ kind: "policy", key: "businessTax", delta: -0.5 }, { kind: "modifier", key: "jobCreation", delta: 10 }],
  },
  {
    id: "compras-locais",
    name: "Compras Públicas Locais",
    department: "economy",
    summary: "Reserva contratos para fornecedores e cooperativas da cidade.",
    cost: 24000,
    implementationWeeks: 10,
    publicSupport: 72,
    ideology: { economy: -28, social: 18, environment: 12, security: 0, urbanism: 0 },
    effects: [{ kind: "modifier", key: "localDemand", delta: 12 }, { kind: "modifier", key: "supplierReliability", delta: 6 }],
  },
  {
    id: "drenagem-verde",
    name: "Drenagem Verde e Parques Lineares",
    department: "environment",
    summary: "Reduz enchentes com áreas permeáveis, arborização e parques.",
    cost: 68000,
    implementationWeeks: 32,
    publicSupport: 70,
    ideology: { economy: -16, social: 22, environment: 90, security: -8, urbanism: -54 },
    effects: [{ kind: "budget", key: "infrastructure", delta: 2 }, { kind: "modifier", key: "climateResilience", delta: 18 }],
  },
  {
    id: "bairro-legal",
    name: "Bairro Legal",
    department: "infrastructure",
    summary: "Regulariza endereços e leva água, energia, calçadas e iluminação.",
    cost: 71000,
    implementationWeeks: 30,
    publicSupport: 80,
    ideology: { economy: -24, social: 26, environment: 8, security: 2, urbanism: 12 },
    effects: [{ kind: "budget", key: "infrastructure", delta: 3 }, { kind: "modifier", key: "utilityReliability", delta: 13 }],
  },
  {
    id: "centro-vivo",
    name: "Centro Vivo e Cultura Noturna",
    department: "culture",
    summary: "Apoia espaços culturais, economia noturna e ocupação segura do centro.",
    cost: 31000,
    implementationWeeks: 14,
    publicSupport: 61,
    ideology: { economy: 2, social: 68, environment: 20, security: -24, urbanism: -42 },
    effects: [{ kind: "modifier", key: "cultureActivity", delta: 15 }, { kind: "modifier", key: "nightEconomy", delta: 9 }],
  },
  {
    id: "governo-aberto",
    name: "Governo Aberto",
    department: "transparency",
    summary: "Publica contratos, agendas, indicadores e cria auditoria cidadã.",
    cost: 18000,
    implementationWeeks: 10,
    publicSupport: 84,
    ideology: { economy: 4, social: 34, environment: 8, security: -6, urbanism: 0 },
    effects: [{ kind: "modifier", key: "transparency", delta: 20 }, { kind: "modifier", key: "corruptionRisk", delta: -14 }],
  },
  {
    id: "equilibrio-fiscal",
    name: "Plano de Equilíbrio Fiscal",
    department: "finance",
    summary: "Revisa despesas e melhora cobrança sem interromper serviços essenciais.",
    cost: 12000,
    implementationWeeks: 12,
    publicSupport: 55,
    ideology: { economy: 66, social: -6, environment: -8, security: 8, urbanism: 12 },
    effects: [{ kind: "modifier", key: "administrativeEfficiency", delta: 14 }, { kind: "policy", key: "propertyTax", delta: 0.05 }],
  },
]);

export const CAMPAIGN_EVENTS = Object.freeze([
  { id: "door-to-door", label: "Caminhada de bairro", cost: 700, visibility: 3, persuasion: 4 },
  { id: "debate", label: "Debate público", cost: 350, visibility: 7, persuasion: 3 },
  { id: "meeting", label: "Reunião comunitária", cost: 450, visibility: 2, persuasion: 6 },
  { id: "media", label: "Campanha em mídia local", cost: 1800, visibility: 9, persuasion: 2 },
  { id: "policy-launch", label: "Lançamento de proposta", cost: 900, visibility: 5, persuasion: 5 },
  { id: "fundraiser", label: "Arrecadação política", cost: 200, visibility: 1, persuasion: 1, fundraising: 3200 },
]);

const SCANDAL_CATALOG = Object.freeze([
  { id: "contract", title: "Suspeita em contrato público", baseSeverity: 64, corruption: true },
  { id: "donation", title: "Doação eleitoral irregular", baseSeverity: 48, corruption: true },
  { id: "nepotism", title: "Denúncia de favorecimento familiar", baseSeverity: 52, corruption: true },
  { id: "expense", title: "Uso indevido de verba pública", baseSeverity: 58, corruption: true },
  { id: "statement", title: "Declaração pública controversa", baseSeverity: 28, corruption: false },
  { id: "omission", title: "Omissão em declaração patrimonial", baseSeverity: 42, corruption: true },
]);

export const DEFAULT_POLITICS_CONFIG = Object.freeze({
  seed: "cidade-viva-politica",
  termWeeks: 208,
  campaignWeeks: 8,
  councilSeats: 9,
  mayorCandidates: 5,
  councilCandidatesPerParty: 6,
  minimumVotingAge: 16,
  minimumMayorAge: 21,
  proposalIntervalWeeks: 6,
  pollingIntervalWeeks: 2,
  historyLimit: 240,
  pollLimit: 40,
  bootstrapGovernment: true,
});

const personAge = (person) => Number(person?.age ?? 0);
const personCharisma = (person) =>
  clamp(person?.genetics?.charisma ?? person?.personality?.charisma ?? 50);
const personIntegrity = (person) => {
  const record = person?.justice ?? {};
  const conscientiousness = person?.personality?.dimensions?.conscientiousness ?? 50;
  return clamp(62 + conscientiousness * 0.3 - (record.recordPoints ?? 0) * 3 - (record.convictions ?? 0) * 12);
};

export function isPoliticallyEligible(person, office = "council", config = DEFAULT_POLITICS_CONFIG) {
  if (!person || person.alive === false || person.justice?.incarcerated) return false;
  if (person.politicalRightsSuspended) return false;
  const minimumAge = office === "mayor" ? config.minimumMayorAge : 18;
  return personAge(person) >= minimumAge;
}

export function citizenIdeology(person) {
  const dimensions = person?.personality?.dimensions ?? {};
  const values = person?.personality?.values ?? [];
  const interests = person?.personality?.interests ?? [];
  const money = Number(person?.money ?? 1000);
  const hasValue = (value) => values.includes(value);
  const hasInterest = (value) => interests.includes(value);
  return {
    economy: clamp((money - 2500) / 55 + (person?.personality?.riskTolerance ?? 50) * 0.45 - 30, -100, 100),
    social: clamp((dimensions.openness ?? 50) * 1.45 - 70 + (hasValue("liberdade") ? 18 : 0) - (hasValue("tradição") ? 18 : 0), -100, 100),
    environment: clamp((dimensions.openness ?? 50) - 35 + (hasInterest("natureza") ? 42 : 0), -100, 100),
    security: clamp(25 - (dimensions.agreeableness ?? 50) * 0.5 + (hasValue("segurança") ? 36 : 0) + ((person?.justice?.offenses?.length ?? 0) ? -22 : 0), -100, 100),
    urbanism: clamp((money > 5000 ? 20 : -12) + (hasValue("comunidade") ? -28 : 0), -100, 100),
  };
}

const ideologyDistance = (left, right) =>
  average(Object.keys(POLITICAL_AXES).map((axis) => Math.abs((left?.[axis] ?? 0) - (right?.[axis] ?? 0))));

const partyForPerson = (person, parties = PARTY_CATALOG) => {
  const ideology = citizenIdeology(person);
  return [...parties].sort((left, right) => {
    const difference = ideologyDistance(ideology, left.ideology) - ideologyDistance(ideology, right.ideology);
    return difference || stableHash(`${person.id}-${left.id}`) - stableHash(`${person.id}-${right.id}`);
  })[0];
};

export function derivePoliticalMetrics(context = {}) {
  const people = (context.people ?? []).filter((person) => person?.alive !== false);
  const adults = people.filter((person) => personAge(person) >= 18);
  const unemployed = adults.filter((person) => person.role === "Desempregado").length;
  const businesses = (context.businesses ?? []).filter((business) => !business.closed);
  const routes = context.transportSystem?.routes ?? context.transport?.routes ?? [];
  const justice = context.justiceSystem ?? context.justice ?? {};
  const caseHistory = [...(justice.openCases ?? []), ...(justice.closedCases ?? [])];
  const recentReported = caseHistory.length
    ? caseHistory.filter((item) => Number(item.week ?? 0) >= Number(context.week ?? 1) - 4).length
    : (justice.reported ?? 0) / Math.max(1, Number(context.week ?? 1));
  const admissions = people.filter((person) => person.medical?.admitted).length;
  const activeConditions = sum(people, (person) => person.medical?.conditions?.length ?? 0);
  return {
    population: people.length,
    eligibleVoters: people.filter((person) => personAge(person) >= (context.minimumVotingAge ?? 16)).length,
    averageHappiness: round(average(people.map((person) => person.happiness ?? 50))),
    unemploymentRate: round((unemployed / Math.max(1, adults.length)) * 100),
    crimeRate: round((recentReported / Math.max(1, people.length)) * 100),
    activeBusinesses: businesses.length,
    healthPressure: round(((admissions + activeConditions) / Math.max(1, people.length)) * 100),
    transitPunctuality: round(average(routes.map((route) => route.punctuality ?? 65)) || 65),
    housingPressure: round(context.housingPressure ?? context.housingSystem?.occupancyRate ?? 55),
    treasury: Number(context.treasury ?? context.finance?.treasury ?? context.money ?? 0),
    corruption: Number(context.justiceSystem?.corruption ?? context.corruption ?? 0),
    districts: context.districtMetrics ?? context.districts ?? {},
  };
}

function initialPoliticsState(config) {
  return {
    version: 1,
    initialized: false,
    phase: "governo",
    calendar: { week: 1, term: 0, nextElectionWeek: null },
    parties: PARTY_CATALOG.map((party) => ({ ...clone(party), members: [], support: 20, treasury: 22000, seats: 0 })),
    candidates: [],
    activeElection: null,
    elections: [],
    polls: [],
    mandates: [],
    officeHolders: { mayor: null, deputyMayor: null },
    council: { totalSeats: config.councilSeats, members: [], presidency: null, coalition: [], opposition: [], majority: false },
    proposals: [],
    implementations: [],
    activePolicies: [],
    modifiers: {},
    scandals: [],
    approval: {
      overall: 55,
      previous: 55,
      trend: 0,
      economy: 55,
      health: 55,
      education: 55,
      security: 55,
      mobility: 55,
      integrity: 65,
      byDistrict: {},
      history: [],
    },
    publicOpinion: { economy: 50, health: 72, education: 68, security: 61, mobility: 58, housing: 60, environment: 52 },
    promises: [],
    history: [],
    pendingEvents: [],
    statistics: { elections: 0, proposals: 0, lawsApproved: 0, lawsRejected: 0, scandals: 0, impeachments: 0, turnoutAverage: 0 },
  };
}

const normalizeCandidateName = (person, index) =>
  person?.name ?? `Candidatura Cívica ${index + 1}`;

const civicScore = (person, office, party) => {
  const personality = person?.personality ?? {};
  const dimensions = personality.dimensions ?? {};
  const notability = person?.notability?.score ?? 0;
  const education = person?.education?.degree ? 10 : person?.education?.enrolled ? 3 : 0;
  const ageExperience = clamp((personAge(person) - (office === "mayor" ? 21 : 18)) * 0.6, 0, 24);
  const integrity = personIntegrity(person);
  const affinity = 100 - ideologyDistance(citizenIdeology(person), party.ideology);
  return personCharisma(person) * 0.22 + (dimensions.conscientiousness ?? 50) * 0.18 + (personality.empathy ?? 50) * 0.1 + integrity * 0.18 + affinity * 0.16 + ageExperience + education + notability * 0.08;
};

const platformFor = (person, party) => {
  const personal = citizenIdeology(person);
  const ideology = {};
  Object.keys(POLITICAL_AXES).forEach((axis) => {
    ideology[axis] = round(party.ideology[axis] * 0.72 + personal[axis] * 0.28);
  });
  const rankedPolicies = POLICY_CATALOG
    .map((policy) => ({ policy, fit: ideologyDistance(ideology, policy.ideology) - (party.priorities.includes(policy.department) ? 16 : 0) }))
    .sort((left, right) => left.fit - right.fit)
    .slice(0, 4)
    .map(({ policy }) => policy.id);
  return { ideology, priorities: rankedPolicies };
};

export class PoliticsSystem {
  constructor(options = {}) {
    this.config = { ...DEFAULT_POLITICS_CONFIG, ...options };
    this.random = new SeededRandom(this.config.seed);
    this.state = initialPoliticsState(this.config);
    this.sequence = 0;
  }

  nextId(prefix) {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  initialize(context = {}) {
    if (this.state.initialized) return this.state;
    const week = Number(context.week ?? 1);
    this.state.initialized = true;
    this.state.calendar.week = week;
    this.assignPartyMembers(context.people ?? []);
    if (this.config.bootstrapGovernment) {
      this.startElection(context, { electionWeek: week, bootstrap: true });
      this.holdElection(context);
    } else {
      this.state.calendar.nextElectionWeek = week + this.config.termWeeks;
    }
    this.updateApproval(context, true);
    return this.state;
  }

  assignPartyMembers(people = []) {
    this.state.parties.forEach((party) => { party.members = []; });
    people.filter((person) => person?.alive !== false && personAge(person) >= 16).forEach((person) => {
      const party = partyForPerson(person, this.state.parties);
      if (party) party.members.push(person.id);
    });
    const total = Math.max(1, sum(this.state.parties, (party) => party.members.length));
    this.state.parties.forEach((party) => { party.support = round((party.members.length / total) * 100); });
  }

  startElection(context = {}, options = {}) {
    if (!this.state.initialized) {
      this.state.initialized = true;
      this.assignPartyMembers(context.people ?? []);
    }
    if (this.state.activeElection) return this.state.activeElection;
    const startWeek = Number(context.week ?? this.state.calendar.week ?? 1);
    const electionWeek = Number(options.electionWeek ?? startWeek + this.config.campaignWeeks);
    const id = this.nextId("election");
    const candidates = this.recruitCandidates(context.people ?? [], id);
    const election = {
      id,
      cycle: this.state.statistics.elections + 1,
      startWeek,
      electionWeek,
      status: "campaign",
      bootstrap: Boolean(options.bootstrap),
      candidates: candidates.map((candidate) => candidate.id),
      mayorCandidateIds: candidates.filter((candidate) => candidate.office === "mayor").map((candidate) => candidate.id),
      councilCandidateIds: candidates.filter((candidate) => candidate.office === "council").map((candidate) => candidate.id),
      polls: [],
      result: null,
      turnout: null,
    };
    this.state.candidates.push(...candidates);
    this.state.activeElection = election;
    this.state.phase = "campanha";
    this.emit("election", "Eleições municipais convocadas", `Começou a campanha para Prefeitura e ${this.config.councilSeats} cadeiras da Câmara Municipal.`, startWeek, { newsworthy: true, importance: 4, refs: [id] });
    return election;
  }

  recruitCandidates(people, electionId) {
    const candidates = [];
    const used = new Set();
    const offices = [
      { id: "mayor", perParty: 1 },
      { id: "council", perParty: this.config.councilCandidatesPerParty },
    ];
    offices.forEach(({ id: office, perParty }) => {
      this.state.parties.forEach((party, partyIndex) => {
        const eligible = people
          .filter((person) => isPoliticallyEligible(person, office, this.config) && !used.has(person.id))
          .map((person) => ({ person, score: civicScore(person, office, party) + deterministicNoise(`${electionId}-${office}-${party.id}-${person.id}`, -6, 6) }))
          .sort((left, right) => right.score - left.score || String(left.person.id).localeCompare(String(right.person.id)))
          .slice(0, perParty);
        for (let index = 0; index < perParty; index++) {
          const person = eligible[index]?.person ?? null;
          if (person) used.add(person.id);
          const candidateIndex = candidates.length;
          const integrity = personIntegrity(person);
          const charisma = personCharisma(person);
          const campaignFunds = office === "mayor" ? 12000 + party.treasury * 0.28 : 3200 + party.treasury * 0.06;
          candidates.push({
            id: `${electionId}-${office}-${party.id}-${person?.id ?? `virtual-${index}`}`,
            electionId,
            personId: person?.id ?? null,
            name: normalizeCandidateName(person, candidateIndex),
            office,
            partyId: party.id,
            number: office === "mayor" ? party.number : party.number * 1000 + partyIndex * 100 + index + 1,
            age: personAge(person) || 35 + ((partyIndex * 7 + index * 3) % 28),
            status: "active",
            incumbent: person?.id === this.state.officeHolders.mayor?.personId,
            charisma,
            integrity,
            rejection: round(clamp(18 + (100 - integrity) * 0.34 + deterministicNoise(`${electionId}-rejection-${candidateIndex}`, -5, 7))),
            visibility: round(office === "mayor" ? 24 + charisma * 0.18 : 10 + charisma * 0.08),
            favorability: round(38 + charisma * 0.18 + integrity * 0.12),
            funds: round(campaignFunds),
            spent: 0,
            donations: [],
            campaignEvents: [],
            debateScore: null,
            platform: platformFor(person, party),
            votes: 0,
          });
        }
      });
    });
    candidates.filter((candidate) => candidate.office === "mayor").forEach((candidate) => {
      const party = this.state.parties.find((item) => item.id === candidate.partyId);
      const runningMate = people
        .filter((person) => isPoliticallyEligible(person, "council", this.config) && !used.has(person.id))
        .map((person) => ({ person, score: civicScore(person, "council", party) + deterministicNoise(`${electionId}-deputy-${candidate.partyId}-${person.id}`, -5, 5) }))
        .sort((left, right) => right.score - left.score || String(left.person.id).localeCompare(String(right.person.id)))[0]?.person;
      if (runningMate) used.add(runningMate.id);
      candidate.runningMate = {
        personId: runningMate?.id ?? null,
        name: runningMate?.name ?? `Vice da chapa ${party?.acronym ?? candidate.number}`,
        partyId: candidate.partyId,
      };
    });
    return candidates;
  }

  campaignWeek(context = {}) {
    const election = this.state.activeElection;
    if (!election || election.status !== "campaign") return [];
    const week = Number(context.week ?? this.state.calendar.week);
    const events = [];
    this.activeCandidates().forEach((candidate) => {
      if (candidate.personId) {
        const person = (context.people ?? []).find((item) => item.id === candidate.personId);
        if (!isPoliticallyEligible(person, candidate.office, this.config)) {
          candidate.status = "withdrawn";
          this.emit("campaign", "Candidatura retirada", `${candidate.name} deixou a disputa eleitoral.`, week, { newsworthy: true, refs: [candidate.id] });
          return;
        }
      }
      const affordable = CAMPAIGN_EVENTS.filter((event) => event.cost <= candidate.funds);
      const event = this.random.pick(affordable.length ? affordable : [CAMPAIGN_EVENTS.at(-1)]);
      if (!event) return;
      candidate.funds -= event.cost;
      candidate.spent += event.cost;
      if (event.fundraising) {
        const donation = round(event.fundraising * this.random.range(0.55, 1.15));
        candidate.funds += donation;
        candidate.donations.push({ week, amount: donation, source: "apoiadores locais" });
      }
      const quality = clamp(candidate.charisma * 0.55 + candidate.integrity * 0.2 + this.random.range(-15, 15));
      candidate.visibility = round(clamp(candidate.visibility + event.visibility * (0.65 + quality / 180)));
      candidate.favorability = round(clamp(candidate.favorability + event.persuasion * (quality - 42) / 100));
      const record = { week, type: event.id, label: event.label, quality: round(quality), cost: event.cost };
      candidate.campaignEvents.unshift(record);
      candidate.campaignEvents = candidate.campaignEvents.slice(0, 24);
      events.push({ candidateId: candidate.id, ...record });
    });
    if ((week - election.startWeek) % this.config.pollingIntervalWeeks === 0) this.runPoll(context);
    if (!election.bootstrap && this.random.chance(0.035)) this.maybeCreateScandal(context, "campaign");
    return events;
  }

  activeCandidates(office = null) {
    const electionId = this.state.activeElection?.id;
    return this.state.candidates.filter((candidate) => candidate.electionId === electionId && candidate.status === "active" && (!office || candidate.office === office));
  }

  scoreCandidateForVoter(candidate, voter, electionId, poll = false) {
    const distance = ideologyDistance(citizenIdeology(voter), candidate.platform.ideology);
    const party = this.state.parties.find((item) => item.id === candidate.partyId);
    const partyAffinity = 100 - ideologyDistance(citizenIdeology(voter), party?.ideology);
    const personal = candidate.charisma * 0.14 + candidate.integrity * 0.12 + candidate.visibility * 0.16 + candidate.favorability * 0.2 - candidate.rejection * 0.18;
    const incumbent = candidate.incumbent ? (this.state.approval.overall - 50) * 0.28 : 0;
    const noise = deterministicNoise(`${electionId}-${poll ? "poll" : "vote"}-${voter.id}-${candidate.id}`, -11, 11);
    return 82 - distance * 0.58 + partyAffinity * 0.18 + personal + incumbent + noise;
  }

  runPoll(context = {}, sampleSize = 180) {
    const election = this.state.activeElection;
    if (!election) return null;
    const week = Number(context.week ?? this.state.calendar.week);
    const voters = (context.people ?? [])
      .filter((person) => person?.alive !== false && personAge(person) >= this.config.minimumVotingAge)
      .sort((left, right) => stableHash(`${election.id}-${week}-${left.id}`) - stableHash(`${election.id}-${week}-${right.id}`))
      .slice(0, sampleSize);
    const mayor = this.activeCandidates("mayor");
    const counts = Object.fromEntries(mayor.map((candidate) => [candidate.id, 0]));
    let undecided = 0;
    voters.forEach((voter) => {
      const ranked = mayor.map((candidate) => ({ candidate, score: this.scoreCandidateForVoter(candidate, voter, election.id, true) })).sort((left, right) => right.score - left.score);
      if (!ranked.length || ranked[0].score < 60 || ranked[0].score - (ranked[1]?.score ?? 0) < 3) undecided += 1;
      else counts[ranked[0].candidate.id] += 1;
    });
    const valid = Math.max(1, voters.length);
    const results = mayor.map((candidate) => ({ candidateId: candidate.id, name: candidate.name, partyId: candidate.partyId, percentage: round((counts[candidate.id] / valid) * 100), count: counts[candidate.id] })).sort((left, right) => right.percentage - left.percentage);
    const poll = {
      id: this.nextId("poll"),
      electionId: election.id,
      week,
      sampleSize: voters.length,
      marginOfError: voters.length ? round(98 / Math.sqrt(voters.length), 1) : 0,
      undecided: round((undecided / valid) * 100),
      results,
    };
    this.state.polls.unshift(poll);
    this.state.polls = this.state.polls.slice(0, this.config.pollLimit);
    election.polls.unshift(poll.id);
    return poll;
  }

  holdElection(context = {}) {
    const election = this.state.activeElection;
    if (!election) return null;
    const week = Number(context.week ?? election.electionWeek);
    const voters = (context.people ?? []).filter((person) => person?.alive !== false && personAge(person) >= this.config.minimumVotingAge);
    const mayorCandidates = this.activeCandidates("mayor");
    const councilCandidates = this.activeCandidates("council");
    const mayorVotes = Object.fromEntries(mayorCandidates.map((candidate) => [candidate.id, 0]));
    const councilVotes = Object.fromEntries(councilCandidates.map((candidate) => [candidate.id, 0]));
    const partyVotes = Object.fromEntries(this.state.parties.map((party) => [party.id, 0]));
    let turnout = 0;
    voters.forEach((voter) => {
      const propensity = clamp(48 + (voter.personality?.conscientiousness ?? voter.personality?.dimensions?.conscientiousness ?? 50) * 0.25 + (personAge(voter) >= 18 && personAge(voter) <= 70 ? 18 : 4) + deterministicNoise(`${election.id}-turnout-${voter.id}`, -24, 20));
      if (propensity < 45) return;
      turnout += 1;
      const mayorChoice = mayorCandidates.map((candidate) => ({ candidate, score: this.scoreCandidateForVoter(candidate, voter, election.id) })).sort((left, right) => right.score - left.score)[0]?.candidate;
      if (mayorChoice) mayorVotes[mayorChoice.id] += 1;
      const preferredParty = [...this.state.parties].sort((left, right) => ideologyDistance(citizenIdeology(voter), left.ideology) - ideologyDistance(citizenIdeology(voter), right.ideology))[0];
      if (preferredParty) {
        partyVotes[preferredParty.id] += 1;
        const localCandidates = councilCandidates.filter((candidate) => candidate.partyId === preferredParty.id);
        const councilChoice = localCandidates.sort((left, right) => this.scoreCandidateForVoter(right, voter, election.id) - this.scoreCandidateForVoter(left, voter, election.id))[0];
        if (councilChoice) councilVotes[councilChoice.id] += 1;
      }
    });
    if (!turnout && mayorCandidates.length) {
      turnout = 1;
      mayorVotes[mayorCandidates[0].id] = 1;
      partyVotes[mayorCandidates[0].partyId] = 1;
    }
    mayorCandidates.forEach((candidate) => { candidate.votes = mayorVotes[candidate.id] ?? 0; });
    councilCandidates.forEach((candidate) => { candidate.votes = councilVotes[candidate.id] ?? 0; });
    const mayorRanking = [...mayorCandidates].sort((left, right) => right.votes - left.votes || right.favorability - left.favorability || left.number - right.number);
    const winner = mayorRanking[0] ?? null;
    const candidateCapacity = Object.fromEntries(
      this.state.parties.map((party) => [
        party.id,
        councilCandidates.filter((candidate) => candidate.partyId === party.id).length,
      ]),
    );
    const seatAllocation = this.allocateSeats(
      partyVotes,
      this.config.councilSeats,
      candidateCapacity,
    );
    const councilWinners = [];
    Object.entries(seatAllocation).forEach(([partyId, seats]) => {
      councilWinners.push(...councilCandidates.filter((candidate) => candidate.partyId === partyId).sort((left, right) => right.votes - left.votes || right.favorability - left.favorability).slice(0, seats));
    });
    election.status = "completed";
    election.turnout = { voters: turnout, eligible: voters.length, percentage: round((turnout / Math.max(1, voters.length)) * 100) };
    election.result = {
      mayor: winner ? { candidateId: winner.id, personId: winner.personId, name: winner.name, partyId: winner.partyId, votes: winner.votes, percentage: round((winner.votes / Math.max(1, turnout)) * 100) } : null,
      mayorRanking: mayorRanking.map((candidate) => ({ candidateId: candidate.id, votes: candidate.votes, percentage: round((candidate.votes / Math.max(1, turnout)) * 100) })),
      partyVotes,
      seatAllocation,
      councilWinners: councilWinners.map((candidate) => candidate.id),
    };
    this.installGovernment(election, winner, councilWinners, week);
    this.state.elections.unshift(clone(election));
    this.state.activeElection = null;
    this.state.phase = "governo";
    this.state.statistics.elections += 1;
    const previousElections = this.state.statistics.elections - 1;
    this.state.statistics.turnoutAverage = round((this.state.statistics.turnoutAverage * previousElections + election.turnout.percentage) / this.state.statistics.elections);
    this.emit("election-result", "Resultado das eleições municipais", `${winner?.name ?? "A candidatura mais votada"} venceu a Prefeitura com ${election.result.mayor?.percentage ?? 0}% dos votos; comparecimento foi de ${election.turnout.percentage}%.`, week, { newsworthy: true, importance: 5, refs: [election.id, winner?.personId].filter(Boolean) });
    return election.result;
  }

  allocateSeats(partyVotes, seats = this.config.councilSeats, capacity = {}) {
    const allocation = Object.fromEntries(this.state.parties.map((party) => [party.id, 0]));
    for (let seat = 0; seat < seats; seat++) {
      const winner = this.state.parties
        .filter((party) => allocation[party.id] < (capacity[party.id] ?? Number.POSITIVE_INFINITY))
        .map((party) => ({ partyId: party.id, quotient: (partyVotes[party.id] ?? 0) / (allocation[party.id] + 1), votes: partyVotes[party.id] ?? 0 }))
        .sort((left, right) => right.quotient - left.quotient || right.votes - left.votes || left.partyId.localeCompare(right.partyId))[0];
      if (winner) allocation[winner.partyId] += 1;
    }
    return allocation;
  }

  installGovernment(election, winner, councilWinners, week) {
    const endWeek = week + this.config.termWeeks - 1;
    const winningParty = this.state.parties.find((party) => party.id === winner?.partyId);
    this.state.officeHolders.mayor = winner ? { candidateId: winner.id, personId: winner.personId, name: winner.name, partyId: winner.partyId, sinceWeek: week, endWeek, acting: false } : null;
    this.state.officeHolders.deputyMayor = winner?.runningMate ? { candidateId: null, personId: winner.runningMate.personId, name: winner.runningMate.name, partyId: winner.runningMate.partyId, sinceWeek: week, endWeek } : null;
    this.state.council.members = councilWinners.map((candidate) => ({ candidateId: candidate.id, personId: candidate.personId, name: candidate.name, partyId: candidate.partyId, votes: candidate.votes, mandateStart: week, mandateEnd: endWeek, attendance: 100, billsAuthored: 0, votesCast: 0 }));
    this.state.council.presidency = this.state.council.members.sort((left, right) => right.votes - left.votes)[0]?.candidateId ?? null;
    const coalition = this.negotiateCoalition(winner?.partyId);
    this.state.council.coalition = coalition;
    this.state.council.opposition = this.state.parties.map((party) => party.id).filter((partyId) => !coalition.includes(partyId));
    this.state.council.majority = sum(this.state.council.members, (member) => coalition.includes(member.partyId) ? 1 : 0) > this.config.councilSeats / 2;
    this.state.parties.forEach((party) => {
      party.seats = this.state.council.members.filter((member) => member.partyId === party.id).length;
      party.treasury = Math.max(1000, party.treasury - 5000);
    });
    const mandate = { id: this.nextId("mandate"), electionId: election.id, startWeek: week, endWeek, mayor: clone(this.state.officeHolders.mayor), deputyMayor: clone(this.state.officeHolders.deputyMayor), coalition: [...coalition], status: "active", approvalStart: this.state.approval.overall, approvalEnd: null, laws: [], crises: [] };
    this.state.mandates.forEach((item) => { if (item.status === "active") { item.status = "completed"; item.approvalEnd = this.state.approval.overall; } });
    this.state.mandates.unshift(mandate);
    this.state.calendar.term += 1;
    this.state.calendar.nextElectionWeek = endWeek - this.config.campaignWeeks;
    this.state.promises = (winner?.platform.priorities ?? winningParty?.priorities ?? []).map((policyId) => ({ policyId, status: "promised", mandateId: mandate.id, proposedWeek: null, completedWeek: null }));
  }

  negotiateCoalition(mayorPartyId) {
    if (!mayorPartyId) return [];
    const mayorParty = this.state.parties.find((party) => party.id === mayorPartyId);
    const coalition = [mayorPartyId];
    let seats = this.state.council.members.filter((member) => member.partyId === mayorPartyId).length;
    const alternatives = this.state.parties.filter((party) => party.id !== mayorPartyId).sort((left, right) => ideologyDistance(mayorParty?.ideology, left.ideology) - ideologyDistance(mayorParty?.ideology, right.ideology) || right.seats - left.seats);
    for (const party of alternatives) {
      if (seats > this.config.councilSeats / 2) break;
      coalition.push(party.id);
      seats += this.state.council.members.filter((member) => member.partyId === party.id).length;
    }
    return coalition;
  }

  createProposal(policyId, options = {}, context = {}) {
    const policy = POLICY_CATALOG.find((item) => item.id === policyId);
    if (!policy) throw new Error(`Política municipal desconhecida: ${policyId}`);
    const week = Number(context.week ?? this.state.calendar.week);
    const mayor = this.state.officeHolders.mayor;
    const sponsorPartyId = options.sponsorPartyId ?? mayor?.partyId ?? this.state.council.members[0]?.partyId ?? null;
    const sponsorId = options.sponsorId ?? mayor?.personId ?? this.state.council.members.find((member) => member.partyId === sponsorPartyId)?.personId ?? null;
    const proposal = {
      id: this.nextId("bill"),
      policyId,
      name: options.name ?? policy.name,
      summary: options.summary ?? policy.summary,
      sponsorId,
      sponsorPartyId,
      createdWeek: week,
      updatedWeek: week,
      status: "draft",
      stage: "redação",
      cost: Number(options.cost ?? policy.cost),
      implementationWeeks: Number(options.implementationWeeks ?? policy.implementationWeeks),
      publicSupport: round(clamp(options.publicSupport ?? policy.publicSupport + deterministicNoise(`${this.sequence}-${policyId}`, -7, 7))),
      effects: clone(options.effects ?? policy.effects),
      ideology: clone(policy.ideology),
      amendments: [],
      committee: null,
      vote: null,
      sanctionedWeek: null,
      implementationId: null,
      history: [{ week, text: "Minuta apresentada à Câmara Municipal." }],
    };
    this.state.proposals.unshift(proposal);
    this.state.statistics.proposals += 1;
    const promise = this.state.promises.find((item) => item.policyId === policyId && item.status === "promised");
    if (promise) { promise.status = "proposed"; promise.proposedWeek = week; }
    this.emit("proposal", "Projeto apresentado à Câmara", `${proposal.name} entrou em tramitação com custo previsto de R$ ${proposal.cost.toLocaleString("pt-BR")}.`, week, { newsworthy: true, importance: 3, refs: [proposal.id, sponsorId].filter(Boolean) });
    return proposal;
  }

  advanceProposals(context = {}) {
    const week = Number(context.week ?? this.state.calendar.week);
    this.state.proposals.filter((proposal) => !["rejected", "vetoed", "implementing", "completed", "withdrawn"].includes(proposal.status)).forEach((proposal) => {
      const age = week - proposal.updatedWeek;
      if (proposal.status === "draft" && age >= 1) {
        proposal.status = "committee";
        proposal.stage = `comissão de ${POLICY_CATALOG.find((policy) => policy.id === proposal.policyId)?.department ?? "administração"}`;
        proposal.updatedWeek = week;
        proposal.committee = { startedWeek: week, report: null, hearings: 0 };
        proposal.history.unshift({ week, text: "Encaminhado à comissão temática." });
      } else if (proposal.status === "committee" && age >= 2) {
        proposal.committee.hearings = 1 + (proposal.publicSupport > 70 ? 1 : 0);
        proposal.committee.report = this.proposalFeasibility(proposal, context) >= 45 ? "favorable" : "unfavorable";
        proposal.status = "plenary";
        proposal.stage = "plenário";
        proposal.updatedWeek = week;
        proposal.history.unshift({ week, text: `Parecer ${proposal.committee.report === "favorable" ? "favorável" : "contrário"}; pauta liberada para votação.` });
      } else if (proposal.status === "plenary" && age >= 1) {
        this.voteProposal(proposal.id, context);
      } else if (proposal.status === "approved" && age >= 1) {
        this.sanctionProposal(proposal, context);
      }
    });
  }

  proposalFeasibility(proposal, context = {}) {
    const metrics = derivePoliticalMetrics(context);
    const treasuryScore = metrics.treasury <= 0 ? 45 : clamp((metrics.treasury / Math.max(1, proposal.cost)) * 35);
    const administration = clamp(50 + (this.state.modifiers.administrativeEfficiency ?? 0));
    return clamp(proposal.publicSupport * 0.35 + treasuryScore * 0.3 + administration * 0.2 + this.state.approval.overall * 0.15);
  }

  voteProposal(proposalId, context = {}, forcedVotes = null) {
    const proposal = this.state.proposals.find((item) => item.id === proposalId);
    if (!proposal || !["plenary", "approved"].includes(proposal.status)) return proposal?.vote ?? null;
    const week = Number(context.week ?? this.state.calendar.week);
    const votes = [];
    this.state.council.members.forEach((member) => {
      const party = this.state.parties.find((item) => item.id === member.partyId);
      const compatibility = 100 - ideologyDistance(party?.ideology, proposal.ideology);
      const coalitionBonus = this.state.council.coalition.includes(member.partyId) ? 13 : -5;
      const sponsorBonus = member.partyId === proposal.sponsorPartyId ? 18 : 0;
      const discipline = (party?.discipline ?? 60) * 0.12;
      const score = compatibility * 0.42 + proposal.publicSupport * 0.25 + coalitionBonus + sponsorBonus + discipline + deterministicNoise(`${proposal.id}-${member.candidateId}`, -15, 15);
      const choice = forcedVotes?.[member.candidateId] ?? (score >= 55 ? "yes" : score < 44 ? "no" : "abstain");
      votes.push({ memberId: member.personId, candidateId: member.candidateId, partyId: member.partyId, choice, score: round(score) });
      member.votesCast += 1;
    });
    const yes = votes.filter((vote) => vote.choice === "yes").length;
    const no = votes.filter((vote) => vote.choice === "no").length;
    const abstain = votes.length - yes - no;
    const approved = yes > no && yes >= Math.floor(this.config.councilSeats / 2) + 1;
    proposal.vote = { week, yes, no, abstain, votes };
    proposal.status = approved ? "approved" : "rejected";
    proposal.stage = approved ? "sanção do Executivo" : "arquivado";
    proposal.updatedWeek = week;
    proposal.history.unshift({ week, text: approved ? `Aprovado por ${yes} votos a ${no}.` : `Rejeitado por ${no} votos a ${yes}.` });
    if (approved) {
      this.emit("council-vote", "Câmara aprova projeto", `${proposal.name} foi aprovado por ${yes} votos a ${no}.`, week, { newsworthy: true, importance: 4, refs: [proposal.id] });
    } else {
      this.state.statistics.lawsRejected += 1;
      this.emit("council-vote", "Projeto rejeitado", `${proposal.name} não obteve maioria na Câmara (${yes} a ${no}).`, week, { newsworthy: true, importance: 2, refs: [proposal.id] });
    }
    return proposal.vote;
  }

  sanctionProposal(proposal, context = {}) {
    const week = Number(context.week ?? this.state.calendar.week);
    const mayorParty = this.state.officeHolders.mayor?.partyId;
    const mayorPartyData = this.state.parties.find((party) => party.id === mayorParty);
    const compatibility = 100 - ideologyDistance(mayorPartyData?.ideology, proposal.ideology);
    const veto = proposal.sponsorPartyId !== mayorParty && compatibility < 35 && proposal.publicSupport < 62;
    if (veto) {
      proposal.status = "vetoed";
      proposal.stage = "vetado";
      proposal.updatedWeek = week;
      proposal.history.unshift({ week, text: "Veto integral do Executivo." });
      this.state.statistics.lawsRejected += 1;
      this.emit("veto", "Prefeitura veta projeto", `${proposal.name} recebeu veto integral do Executivo.`, week, { newsworthy: true, importance: 3, refs: [proposal.id] });
      return false;
    }
    proposal.status = "implementing";
    proposal.stage = "implementação";
    proposal.updatedWeek = week;
    proposal.sanctionedWeek = week;
    const implementation = {
      id: this.nextId("implementation"),
      proposalId: proposal.id,
      policyId: proposal.policyId,
      name: proposal.name,
      startedWeek: week,
      expectedEndWeek: week + proposal.implementationWeeks,
      progress: 0,
      phase: "planejamento",
      status: "active",
      budget: proposal.cost,
      spent: 0,
      delayedWeeks: 0,
      effectsApplied: false,
      history: [{ week, text: "Lei sancionada e planejamento iniciado." }],
    };
    proposal.implementationId = implementation.id;
    this.state.implementations.unshift(implementation);
    this.state.statistics.lawsApproved += 1;
    this.state.mandates.find((mandate) => mandate.status === "active")?.laws.push(proposal.id);
    this.emit("sanction", "Nova lei municipal sancionada", `${proposal.name} foi sancionado e entrou em fase de implementação.`, week, { newsworthy: true, importance: 4, refs: [proposal.id, implementation.id] });
    return true;
  }

  advanceImplementations(context = {}) {
    const week = Number(context.week ?? this.state.calendar.week);
    this.state.implementations.filter((implementation) => implementation.status === "active").forEach((implementation) => {
      const proposal = this.state.proposals.find((item) => item.id === implementation.proposalId);
      const weeklyCost = implementation.budget / Math.max(1, proposal?.implementationWeeks ?? 12);
      const canSpend = this.trySpend(weeklyCost, context, { type: "policy", implementationId: implementation.id, name: implementation.name });
      if (!canSpend) {
        implementation.delayedWeeks += 1;
        implementation.phase = "aguardando recursos";
        if (implementation.delayedWeeks === 1 || implementation.delayedWeeks % 4 === 0) this.emit("policy-delay", "Política pública sofre atraso", `${implementation.name} aguarda liberação de recursos há ${implementation.delayedWeeks} semana(s).`, week, { newsworthy: implementation.delayedWeeks >= 4, importance: 2, refs: [implementation.id] });
        return;
      }
      implementation.spent = round(Math.min(implementation.budget, implementation.spent + weeklyCost), 2);
      const administrative = clamp(58 + (this.state.modifiers.administrativeEfficiency ?? 0));
      const increment = (100 / Math.max(1, proposal?.implementationWeeks ?? 12)) * (0.72 + administrative / 180);
      implementation.progress = round(clamp(implementation.progress + increment));
      implementation.phase = implementation.progress < 18 ? "planejamento" : implementation.progress < 45 ? "contratações" : implementation.progress < 82 ? "execução" : "avaliação e entrega";
      if (implementation.progress >= 100 || implementation.spent >= implementation.budget * 0.995) this.completeImplementation(implementation, proposal, context);
    });
  }

  trySpend(amount, context, metadata) {
    if (typeof context.spend === "function") return context.spend(amount, metadata) !== false;
    if (typeof context.finance?.spend === "function") return context.finance.spend(amount, metadata) !== false;
    if (Number.isFinite(context.finance?.treasury)) {
      if (context.finance.treasury < amount) return false;
      context.finance.treasury -= amount;
      return true;
    }
    if (Number.isFinite(context.treasury)) return context.treasury >= amount;
    return true;
  }

  completeImplementation(implementation, proposal, context) {
    const week = Number(context.week ?? this.state.calendar.week);
    implementation.progress = 100;
    implementation.status = "completed";
    implementation.phase = "concluída";
    implementation.completedWeek = week;
    if (!implementation.effectsApplied) {
      (proposal?.effects ?? []).forEach((effect) => this.applyPolicyEffect(effect, context, proposal));
      implementation.effectsApplied = true;
    }
    if (proposal) {
      proposal.status = "completed";
      proposal.stage = "vigente";
      proposal.updatedWeek = week;
      proposal.history.unshift({ week, text: "Implementação concluída; política em vigor." });
      this.state.activePolicies.push({ policyId: proposal.policyId, proposalId: proposal.id, sinceWeek: week, effects: clone(proposal.effects) });
      const promise = this.state.promises.find((item) => item.policyId === proposal.policyId && item.status !== "completed");
      if (promise) { promise.status = "completed"; promise.completedWeek = week; }
    }
    this.emit("policy-complete", "Política pública entregue", `${implementation.name} foi concluída e passa a produzir efeitos na cidade.`, week, { newsworthy: true, importance: 4, refs: [implementation.id, proposal?.id].filter(Boolean) });
  }

  applyPolicyEffect(effect, context = {}, proposal = null) {
    if (effect.kind === "modifier") {
      this.state.modifiers[effect.key] = round((this.state.modifiers[effect.key] ?? 0) + effect.delta);
      if (typeof context.applyPolicyEffect === "function") context.applyPolicyEffect(clone(effect), proposal ? clone(proposal) : null);
      return;
    }
    if (typeof context.applyPolicyEffect === "function") {
      context.applyPolicyEffect(clone(effect), proposal ? clone(proposal) : null);
      return;
    }
    const governance = context.governance;
    if (!governance) return;
    if (effect.kind === "policy" && governance.policies && effect.key in governance.policies) {
      governance.policies[effect.key] = round(Number(governance.policies[effect.key]) + effect.delta, 2);
    } else if (effect.kind === "budget" && governance.budget && effect.key in governance.budget) {
      governance.budget = rebalanceBudget(governance.budget, effect.key, Number(governance.budget[effect.key]) + effect.delta);
    }
  }

  maybeAutoProposal(context = {}) {
    const week = Number(context.week ?? this.state.calendar.week);
    if (!this.state.officeHolders.mayor || week % this.config.proposalIntervalWeeks !== 0) return null;
    const open = this.state.proposals.filter((proposal) => !["rejected", "vetoed", "completed", "withdrawn"].includes(proposal.status));
    if (open.length >= 3) return null;
    const promised = this.state.promises.find((promise) => promise.status === "promised");
    const alreadyUsed = new Set(this.state.proposals.map((proposal) => proposal.policyId));
    const policyId = promised?.policyId ?? POLICY_CATALOG.find((policy) => !alreadyUsed.has(policy.id))?.id;
    return policyId ? this.createProposal(policyId, {}, context) : null;
  }

  reportScandal(details = {}, context = {}) {
    const week = Number(context.week ?? this.state.calendar.week);
    const template = SCANDAL_CATALOG.find((item) => item.id === details.type) ?? this.random.pick(SCANDAL_CATALOG);
    const target = details.target ?? this.state.officeHolders.mayor ?? this.random.pick(this.state.council.members);
    if (!target || !template) return null;
    const severity = round(clamp(details.severity ?? template.baseSeverity + this.random.range(-12, 15)));
    const scandal = {
      id: this.nextId("scandal"),
      type: template.id,
      title: details.title ?? template.title,
      targetPersonId: details.targetPersonId ?? target.personId,
      targetName: details.targetName ?? target.name,
      targetOffice: details.targetOffice ?? (target === this.state.officeHolders.mayor ? "mayor" : "council"),
      partyId: details.partyId ?? target.partyId,
      startedWeek: week,
      severity,
      evidence: round(clamp(details.evidence ?? this.random.range(18, 78))),
      corruption: details.corruption ?? template.corruption,
      status: "investigating",
      investigationWeeks: 0,
      approvalImpact: round(-(severity * 0.08)),
      outcome: null,
      history: [{ week, text: "Denúncia protocolada e investigação aberta." }],
    };
    this.state.scandals.unshift(scandal);
    this.state.statistics.scandals += 1;
    this.emit("scandal", "Crise política na Prefeitura", `${scandal.title} envolve ${scandal.targetName}; órgãos de controle abriram investigação.`, week, { newsworthy: true, importance: severity >= 65 ? 5 : 4, refs: [scandal.id, scandal.targetPersonId].filter(Boolean) });
    return scandal;
  }

  maybeCreateScandal(context = {}, origin = "government") {
    const metrics = derivePoliticalMetrics(context);
    const riskModifier = this.state.modifiers.corruptionRisk ?? 0;
    const chance = origin === "campaign" ? 0.06 : clamp(0.006 + metrics.corruption * 0.002 + riskModifier * 0.0004, 0.002, 0.15);
    if (!this.random.chance(chance)) return null;
    const targets = [this.state.officeHolders.mayor, ...this.state.council.members].filter(Boolean);
    const target = this.random.weighted(targets, (item) => item === this.state.officeHolders.mayor ? 3 : 1);
    return this.reportScandal({ target }, context);
  }

  advanceScandals(context = {}) {
    const week = Number(context.week ?? this.state.calendar.week);
    this.state.scandals.filter((scandal) => scandal.status === "investigating").forEach((scandal) => {
      scandal.investigationWeeks += 1;
      scandal.evidence = round(clamp(scandal.evidence + this.random.range(-3, 8)));
      if (scandal.investigationWeeks < 3 + Math.floor(scandal.severity / 25)) return;
      const substantiated = scandal.evidence + scandal.severity * 0.38 + deterministicNoise(`${scandal.id}-outcome`, -22, 18) >= 67;
      scandal.status = "closed";
      scandal.outcome = substantiated ? (scandal.severity >= 78 && scandal.evidence >= 68 ? "removed" : "substantiated") : "dismissed";
      scandal.closedWeek = week;
      if (scandal.outcome === "removed") {
        this.removeOfficial(scandal.targetPersonId, scandal.targetOffice, week, `afastamento após ${scandal.title.toLowerCase()}`);
        if (scandal.targetOffice === "mayor") this.state.statistics.impeachments += 1;
      }
      scandal.history.unshift({ week, text: scandal.outcome === "dismissed" ? "Investigação arquivada sem responsabilização." : scandal.outcome === "removed" ? "Responsabilidade confirmada e perda do cargo determinada." : "Irregularidade confirmada; sanções administrativas aplicadas." });
      this.emit("scandal-outcome", "Investigação política concluída", `${scandal.targetName}: ${scandal.outcome === "dismissed" ? "denúncia arquivada" : scandal.outcome === "removed" ? "perda do cargo determinada" : "irregularidade confirmada"}.`, week, { newsworthy: true, importance: scandal.outcome === "removed" ? 5 : 3, refs: [scandal.id, scandal.targetPersonId].filter(Boolean) });
    });
  }

  removeOfficial(personId, office, week, reason) {
    if (office === "mayor" && this.state.officeHolders.mayor?.personId === personId) {
      const former = this.state.officeHolders.mayor;
      const deputy = this.state.officeHolders.deputyMayor;
      if (deputy) this.state.officeHolders.mayor = { ...clone(deputy), acting: true, sinceWeek: week, successionReason: reason };
      else this.state.officeHolders.mayor = null;
      this.state.mandates.find((mandate) => mandate.status === "active")?.crises.push({ week, type: "vacancy", former: former.name, reason });
      this.emit("succession", "Mudança no comando da Prefeitura", deputy ? `${deputy.name} assumiu a Prefeitura após ${reason}.` : `A Prefeitura ficou vaga após ${reason}.`, week, { newsworthy: true, importance: 5, refs: [personId, deputy?.personId].filter(Boolean) });
      return;
    }
    const index = this.state.council.members.findIndex((member) => member.personId === personId);
    if (index >= 0) {
      const [former] = this.state.council.members.splice(index, 1);
      const mandateElectionId = this.state.mandates.find((mandate) => mandate.status === "active")?.electionId;
      const replacement = this.state.candidates.filter((candidate) => candidate.electionId === mandateElectionId && candidate.office === "council" && candidate.partyId === former.partyId && !this.state.council.members.some((member) => member.candidateId === candidate.id)).sort((left, right) => right.votes - left.votes)[0];
      if (replacement) this.state.council.members.push({ candidateId: replacement.id, personId: replacement.personId, name: replacement.name, partyId: replacement.partyId, votes: replacement.votes, mandateStart: week, mandateEnd: former.mandateEnd, attendance: 100, billsAuthored: 0, votesCast: 0, substitute: true });
    }
  }

  ensureGovernmentContinuity(context = {}) {
    const week = Number(context.week ?? this.state.calendar.week);
    const people = context.people ?? [];
    const mayor = this.state.officeHolders.mayor;
    if (mayor?.personId) {
      const person = people.find((item) => item.id === mayor.personId);
      if (!person || person.alive === false || person.justice?.incarcerated) this.removeOfficial(mayor.personId, "mayor", week, person?.alive === false ? "falecimento" : "impedimento legal");
    }
    [...this.state.council.members].forEach((member) => {
      if (!member.personId) return;
      const person = people.find((item) => item.id === member.personId);
      if (!person || person.alive === false || person.justice?.incarcerated) this.removeOfficial(member.personId, "council", week, person?.alive === false ? "falecimento" : "impedimento legal");
    });
  }

  updateApproval(context = {}, immediate = false) {
    const metrics = derivePoliticalMetrics(context);
    const governance = context.governance ?? {};
    const budget = governance.budget ?? {};
    const scandals = this.state.scandals.filter((scandal) => scandal.status === "investigating");
    const scandalPenalty = sum(scandals, (scandal) => Math.abs(scandal.approvalImpact));
    const promisesCompleted = this.state.promises.filter((promise) => promise.status === "completed").length;
    const promiseScore = this.state.promises.length ? (promisesCompleted / this.state.promises.length) * 16 : 3;
    const economy = clamp(72 - metrics.unemploymentRate * 2.3 + Math.min(10, metrics.activeBusinesses / 5) + (metrics.treasury >= 0 ? 4 : -10));
    const health = clamp(72 - metrics.healthPressure * 0.75 + (budget.health ?? 20) * 0.7 + (this.state.modifiers.primaryCare ?? 0) * 0.25);
    const education = clamp(42 + (budget.education ?? 20) * 1.7 + (this.state.modifiers.educationQuality ?? 0) * 0.4);
    const security = clamp(78 - metrics.crimeRate * 1.6 + (budget.security ?? 18) * 0.65 + (this.state.modifiers.crimePrevention ?? 0) * 0.35);
    const mobility = clamp(metrics.transitPunctuality * 0.7 + (budget.transport ?? 16) * 0.8 + (this.state.modifiers.transitPunctuality ?? 0) * 0.4);
    const integrity = clamp(76 + (this.state.modifiers.transparency ?? 0) * 0.5 - scandalPenalty * 1.8);
    const target = clamp(metrics.averageHappiness * 0.28 + economy * 0.16 + health * 0.12 + education * 0.1 + security * 0.12 + mobility * 0.1 + integrity * 0.08 + promiseScore - scandalPenalty * 0.35);
    const previous = this.state.approval.overall;
    const overall = immediate ? target : previous * 0.72 + target * 0.28;
    Object.assign(this.state.approval, { previous, overall: round(overall), trend: round(overall - previous), economy: round(economy), health: round(health), education: round(education), security: round(security), mobility: round(mobility), integrity: round(integrity) });
    const districts = metrics.districts ?? {};
    Object.entries(districts).forEach(([districtId, district]) => {
      const local = clamp(overall + ((district.happiness ?? metrics.averageHappiness) - metrics.averageHappiness) * 0.35 - (district.crimes ?? 0) * 0.45 + deterministicNoise(`${this.state.calendar.week}-${districtId}`, -3, 3));
      this.state.approval.byDistrict[districtId] = round(local);
    });
    this.state.approval.history.unshift({ week: Number(context.week ?? this.state.calendar.week), overall: this.state.approval.overall, economy: this.state.approval.economy, health: this.state.approval.health, security: this.state.approval.security });
    this.state.approval.history = this.state.approval.history.slice(0, 104);
    this.state.publicOpinion.economy = round(clamp(45 + metrics.unemploymentRate * 1.4));
    this.state.publicOpinion.health = round(clamp(52 + metrics.healthPressure * 0.8));
    this.state.publicOpinion.security = round(clamp(48 + metrics.crimeRate * 1.3));
    this.state.publicOpinion.mobility = round(clamp(82 - metrics.transitPunctuality * 0.45));
    return this.state.approval;
  }

  tickWeek(context = {}) {
    if (!this.state.initialized) this.initialize(context);
    const week = Number(context.week ?? this.state.calendar.week + 1);
    this.state.calendar.week = week;
    this.ensureGovernmentContinuity(context);
    if (!this.state.activeElection && this.state.calendar.nextElectionWeek != null && week >= this.state.calendar.nextElectionWeek) this.startElection(context, { electionWeek: week + this.config.campaignWeeks });
    if (this.state.activeElection) {
      if (week >= this.state.activeElection.electionWeek) this.holdElection(context);
      else this.campaignWeek(context);
    }
    this.advanceScandals(context);
    this.maybeCreateScandal(context);
    this.advanceProposals(context);
    this.maybeAutoProposal(context);
    this.advanceImplementations(context);
    this.updateApproval(context);
    this.state.history = this.state.history.slice(0, this.config.historyLimit);
    return this.drainEvents();
  }

  emit(type, title, text, week, options = {}) {
    const entry = {
      id: this.nextId("political-event"),
      week: Number(week ?? this.state.calendar.week),
      type,
      title,
      text,
      category: "politics",
      newsworthy: Boolean(options.newsworthy),
      importance: options.importance ?? 2,
      refs: options.refs ?? [],
    };
    this.state.history.unshift(entry);
    this.state.pendingEvents.push(entry);
    return entry;
  }

  drainEvents() {
    const events = this.state.pendingEvents.map((event) => clone(event));
    this.state.pendingEvents.length = 0;
    return events;
  }

  getCandidate(candidateId) {
    return this.state.candidates.find((candidate) => candidate.id === candidateId) ?? null;
  }

  getProposal(proposalId) {
    return this.state.proposals.find((proposal) => proposal.id === proposalId) ?? null;
  }

  getSnapshot() {
    return clone(this.state);
  }

  serialize() {
    return { config: clone(this.config), sequence: this.sequence, randomState: this.random.state, state: this.getSnapshot() };
  }

  static hydrate(snapshot) {
    if (!snapshot?.state) throw new Error("Snapshot político inválido.");
    const system = new PoliticsSystem(snapshot.config ?? {});
    system.sequence = Number(snapshot.sequence ?? 0);
    system.random.state = Number(snapshot.randomState ?? stableHash(system.config.seed)) >>> 0;
    system.state = clone(snapshot.state);
    return system;
  }
}

export function rebalanceBudget(budget, changedKey, desiredValue) {
  const keys = Object.keys(budget ?? {});
  if (!keys.includes(changedKey) || !keys.length) return { ...(budget ?? {}) };
  const minimum = 5;
  const desired = clamp(desiredValue, minimum, 100 - minimum * (keys.length - 1));
  const others = keys.filter((key) => key !== changedKey);
  const available = 100 - desired;
  const weights = others.map((key) => Math.max(0.01, Number(budget[key]) - minimum));
  const weightTotal = sum(weights);
  const result = { ...budget, [changedKey]: round(desired) };
  let allocated = desired;
  others.forEach((key, index) => {
    const value = index === others.length - 1
      ? 100 - allocated
      : minimum + (available - minimum * others.length) * (weights[index] / weightTotal);
    result[key] = round(value);
    allocated += result[key];
  });
  const correction = round(100 - sum(Object.values(result)), 1);
  result[others.at(-1) ?? changedKey] = round(result[others.at(-1) ?? changedKey] + correction);
  return result;
}

export const createPoliticsSystem = (options = {}) => new PoliticsSystem(options);

/** Monta o contexto esperado pelo motor usando a instância atual de Simulation. */
export function politicsContextFromSimulation(simulation) {
  return {
    week: simulation.week,
    people: simulation.people,
    businesses: simulation.businesses,
    governance: simulation.governance,
    transportSystem: simulation.transportSystem,
    justiceSystem: simulation.justiceSystem,
    healthSystem: simulation.healthSystem,
    housingSystem: simulation.housingSystem,
    districtMetrics: simulation.urbanEvolution?.districtMetrics,
    treasury: simulation.money,
    spend(amount) {
      if (simulation.money < amount) return false;
      simulation.money -= amount;
      return true;
    },
    applyPolicyEffect(effect, proposal) {
      if (effect.kind === "modifier") {
        simulation.cityModifiers ||= {};
        simulation.cityModifiers[effect.key] = round((simulation.cityModifiers[effect.key] ?? 0) + effect.delta);
      } else if (effect.kind === "policy" && effect.key in (simulation.governance?.policies ?? {})) {
        simulation.governance.policies[effect.key] = round(simulation.governance.policies[effect.key] + effect.delta, 2);
        if (effect.key === "transitFare") simulation.transportSystem?.routes?.forEach((route) => { route.fare = simulation.governance.policies.transitFare; });
      } else if (effect.kind === "budget" && effect.key in (simulation.governance?.budget ?? {})) {
        simulation.governance.budget = rebalanceBudget(simulation.governance.budget, effect.key, simulation.governance.budget[effect.key] + effect.delta);
      }
      if (proposal && simulation.governance?.history) simulation.governance.history.unshift({ week: simulation.week, text: `${proposal.name}: efeito ${effect.key} implementado.` });
    },
  };
}

/** Cria e inicializa o subsistema sem modificar métodos da Simulation. */
export function createPoliticsForSimulation(simulation, options = {}) {
  const system = new PoliticsSystem(options);
  system.initialize(politicsContextFromSimulation(simulation));
  return system;
}

/** Avança uma semana e publica os eventos relevantes no diário da Simulation. */
export function advancePoliticsForSimulation(system, simulation) {
  const events = system.tickWeek(politicsContextFromSimulation(simulation));
  if (typeof simulation.log === "function") {
    events.forEach((event) => {
      if (event.newsworthy) simulation.log("política", `${event.title}: ${event.text}`, "civic");
    });
  }
  if (simulation.governance) {
    simulation.governance.approval = system.state.approval.overall;
    simulation.governance.politics = system.state;
  }
  return events;
}
