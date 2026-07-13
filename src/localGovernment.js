/**
 * Prefeitura e legislação municipal da Cidade Viva.
 *
 * O módulo é funcional: nenhuma função altera o estado ou o contexto recebidos.
 * Operações retornam uma cópia serializável do estado e instruções de integração
 * (`assignments` e `effects`) para que Simulation decida quando aplicá-las.
 */

export const LOCAL_GOVERNMENT_VERSION = 1;

const clamp = (value, minimum = 0, maximum = 100) =>
  Math.max(minimum, Math.min(maximum, Number.isFinite(Number(value)) ? Number(value) : minimum));
const round = (value, digits = 1) => {
  const scale = 10 ** digits;
  return Math.round(Number(value || 0) * scale) / scale;
};
const clone = (value) => {
  if (value == null) return value;
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
};
const asArray = (value) => (Array.isArray(value) ? value : []);
const average = (values) =>
  values.length ? values.reduce((total, value) => total + Number(value || 0), 0) / values.length : 0;

export function municipalStableHash(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const noise = (key, minimum = 0, maximum = 1) =>
  minimum + (municipalStableHash(key) / 4294967295) * (maximum - minimum);

export const MUNICIPAL_DEPARTMENTS = Object.freeze([
  {
    id: "government",
    name: "Secretaria de Governo e Administração",
    shortName: "Governo",
    budgetKey: "infrastructure",
    mission: "Coordenação do gabinete, atendimento público, pessoal e serviços administrativos.",
    basePosts: 2,
    populationPerPost: 115,
    servantRoles: ["Agente administrativo", "Analista de gestão", "Atendente municipal"],
    keywords: ["administr", "gest", "atendente", "direito"],
  },
  {
    id: "finance",
    name: "Secretaria Municipal da Fazenda e Planejamento",
    shortName: "Fazenda",
    budgetKey: "infrastructure",
    mission: "Orçamento, tributos, compras públicas, patrimônio e planejamento financeiro.",
    basePosts: 2,
    populationPerPost: 145,
    servantRoles: ["Auditor fiscal", "Analista de orçamento", "Agente fazendário"],
    keywords: ["contador", "contab", "finan", "econom", "auditor"],
  },
  {
    id: "health",
    name: "Secretaria Municipal de Saúde",
    shortName: "Saúde",
    budgetKey: "health",
    mission: "Atenção básica, vigilância sanitária, regulação e rede hospitalar municipal.",
    basePosts: 2,
    populationPerPost: 95,
    servantRoles: ["Sanitarista municipal", "Regulador de saúde", "Agente de saúde"],
    keywords: ["médic", "enferm", "saúde", "farmac", "psic"],
  },
  {
    id: "education",
    name: "Secretaria Municipal de Educação",
    shortName: "Educação",
    budgetKey: "education",
    mission: "Gestão de escolas, vagas, alimentação, transporte e qualidade pedagógica.",
    basePosts: 2,
    populationPerPost: 105,
    servantRoles: ["Técnico educacional", "Supervisor escolar", "Agente de matrículas"],
    keywords: ["professor", "pedagog", "educa", "coordenador"],
  },
  {
    id: "housing",
    name: "Secretaria de Habitação e Desenvolvimento Urbano",
    shortName: "Habitação",
    budgetKey: "infrastructure",
    mission: "Política habitacional, licenciamento, uso do solo e expansão ordenada dos bairros.",
    basePosts: 2,
    populationPerPost: 120,
    servantRoles: ["Urbanista municipal", "Fiscal de obras", "Técnico habitacional"],
    keywords: ["arquitet", "engen", "imobili", "constru", "urban"],
  },
  {
    id: "mobility",
    name: "Secretaria Municipal de Mobilidade",
    shortName: "Mobilidade",
    budgetKey: "transport",
    mission: "Trânsito, transporte coletivo, calçadas, ciclovias e segurança viária.",
    basePosts: 2,
    populationPerPost: 125,
    servantRoles: ["Planejador de mobilidade", "Agente de trânsito", "Fiscal de transportes"],
    keywords: ["motorista", "trânsito", "transport", "logíst", "mobilidade"],
  },
  {
    id: "security",
    name: "Secretaria de Segurança Urbana e Defesa Civil",
    shortName: "Segurança",
    budgetKey: "security",
    mission: "Guarda municipal, prevenção territorial, defesa civil e resposta a emergências.",
    basePosts: 2,
    populationPerPost: 110,
    servantRoles: ["Guarda municipal", "Analista de segurança", "Agente de defesa civil"],
    keywords: ["policial", "segurança", "perit", "bombeiro", "guarda"],
  },
  {
    id: "environment",
    name: "Secretaria de Meio Ambiente e Serviços Urbanos",
    shortName: "Ambiente",
    budgetKey: "infrastructure",
    mission: "Arborização, resíduos, parques, drenagem e fiscalização ambiental.",
    basePosts: 2,
    populationPerPost: 140,
    servantRoles: ["Analista ambiental", "Fiscal ambiental", "Agente de parques"],
    keywords: ["ambient", "biólog", "parque", "limpeza", "jard"],
  },
  {
    id: "development",
    name: "Secretaria de Desenvolvimento, Trabalho e Renda",
    shortName: "Desenvolvimento",
    budgetKey: "infrastructure",
    mission: "Emprego, qualificação, comércio, empreendedorismo e abastecimento local.",
    basePosts: 1,
    populationPerPost: 155,
    servantRoles: ["Agente de emprego", "Analista de desenvolvimento", "Fiscal de comércio"],
    keywords: ["gerente", "comerc", "rh", "recursos humanos", "econom"],
  },
  {
    id: "social",
    name: "Secretaria de Assistência Social e Cidadania",
    shortName: "Assistência",
    budgetKey: "health",
    mission: "Proteção de famílias, acolhimento, benefícios e defesa de direitos.",
    basePosts: 2,
    populationPerPost: 125,
    servantRoles: ["Assistente social", "Agente de cidadania", "Técnico de benefícios"],
    keywords: ["social", "psic", "cuidador", "mediador", "direito"],
  },
]);

export const MUNICIPAL_INTERNAL_OFFICES = Object.freeze([
  {
    kind: "chief_of_staff",
    title: "Chefe de Gabinete",
    salaryPerWeek: 2480,
    responsibilities: ["agenda do Executivo", "coordenação política", "monitoramento de metas"],
    keywords: ["administr", "gest", "gerente"],
  },
  {
    kind: "comptroller",
    title: "Controlador(a)-geral do Município",
    salaryPerWeek: 2360,
    responsibilities: ["controle interno", "auditoria", "integridade e transparência"],
    keywords: ["auditor", "contador", "direito", "finan"],
  },
  {
    kind: "attorney_general",
    title: "Procurador(a)-geral do Município",
    salaryPerWeek: 2580,
    responsibilities: ["consultoria jurídica", "defesa judicial", "controle de legalidade"],
    keywords: ["advog", "direito", "juríd"],
  },
]);

export const MUNICIPAL_COMMITTEES = Object.freeze([
  { id: "constitution", name: "Constituição, Justiça e Redação", departments: ["government"], seats: 3 },
  { id: "finance", name: "Finanças, Orçamento e Fiscalização", departments: ["finance", "development"], seats: 3 },
  { id: "social_services", name: "Saúde, Educação e Assistência", departments: ["health", "education", "social"], seats: 3 },
  { id: "urban_development", name: "Habitação e Desenvolvimento Urbano", departments: ["housing"], seats: 3 },
  { id: "mobility_security", name: "Mobilidade, Segurança e Serviços Públicos", departments: ["mobility", "security"], seats: 3 },
  { id: "environment", name: "Meio Ambiente e Resiliência", departments: ["environment"], seats: 3 },
]);

export const MUNICIPAL_LAW_CATALOG = Object.freeze([
  {
    id: "responsible-budget",
    name: "Lei de Equilíbrio e Transparência Orçamentária",
    departmentId: "finance",
    summary: "Institui metas fiscais, painel de despesas e reserva para emergências municipais.",
    complexity: 3,
    publicSupport: 73,
    implementationCost: 16000,
    operatingCostPerWeek: 260,
    vacatioWeeks: 2,
    effects: [
      { domain: "budget", target: "infrastructure", operation: "rebalance", delta: 1, reversible: true },
      { domain: "budget", target: "administrativeEfficiency", operation: "add", delta: 9, reversible: true },
    ],
  },
  {
    id: "municipal-careers",
    name: "Plano Municipal de Carreiras e Concurso Público",
    departmentId: "government",
    summary: "Cria carreira estável, seleção pública e formação continuada para serviços municipais.",
    complexity: 3,
    publicSupport: 66,
    implementationCost: 28000,
    operatingCostPerWeek: 1850,
    vacatioWeeks: 3,
    effects: [
      { domain: "employment", target: "municipalJobs", operation: "add", delta: 12, reversible: true },
      { domain: "employment", target: "publicServiceQuality", operation: "add", delta: 10, reversible: true },
    ],
  },
  {
    id: "housing-access",
    name: "Lei Municipal de Moradia e Aluguel Acessível",
    departmentId: "housing",
    summary: "Combina produção habitacional, aluguel social, imóveis vazios e proteção contra despejos.",
    complexity: 4,
    publicSupport: 76,
    implementationCost: 72000,
    operatingCostPerWeek: 2250,
    vacatioWeeks: 2,
    effects: [
      { domain: "housing", target: "constructionCapacity", operation: "add", delta: 16, reversible: true },
      { domain: "housing", target: "rentPressure", operation: "add", delta: -12, reversible: true },
      { domain: "budget", target: "infrastructure", operation: "rebalance", delta: 2, reversible: true },
    ],
  },
  {
    id: "integrated-transit",
    name: "Lei do Transporte Integrado e Frequente",
    departmentId: "mobility",
    summary: "Fixa metas de frequência, integração tarifária, acessibilidade e prioridade aos ônibus.",
    complexity: 4,
    publicSupport: 81,
    implementationCost: 68000,
    operatingCostPerWeek: 1720,
    vacatioWeeks: 2,
    effects: [
      { domain: "transport", target: "punctuality", operation: "add", delta: 12, reversible: true },
      { domain: "transport", target: "routeCapacity", operation: "add", delta: 10, reversible: true },
      { domain: "budget", target: "transport", operation: "rebalance", delta: 3, reversible: true },
    ],
  },
  {
    id: "safe-neighborhoods",
    name: "Lei de Bairros Seguros e Prevenção Comunitária",
    departmentId: "security",
    summary: "Integra iluminação, patrulha territorial, canais de denúncia e prevenção social da violência.",
    complexity: 3,
    publicSupport: 79,
    implementationCost: 44000,
    operatingCostPerWeek: 1320,
    vacatioWeeks: 1,
    effects: [
      { domain: "security", target: "patrolCapacity", operation: "add", delta: 3, reversible: true },
      { domain: "security", target: "crimePrevention", operation: "add", delta: 13, reversible: true },
      { domain: "budget", target: "security", operation: "rebalance", delta: 2, reversible: true },
    ],
  },
  {
    id: "climate-resilience",
    name: "Lei de Arborização, Drenagem e Resiliência Climática",
    departmentId: "environment",
    summary: "Define metas de cobertura verde, drenagem sustentável, qualidade do ar e proteção de parques.",
    complexity: 4,
    publicSupport: 74,
    implementationCost: 59000,
    operatingCostPerWeek: 980,
    vacatioWeeks: 3,
    effects: [
      { domain: "environment", target: "greenIndex", operation: "add", delta: 11, reversible: true },
      { domain: "environment", target: "emissions", operation: "add", delta: -9, reversible: true },
      { domain: "environment", target: "climateResilience", operation: "add", delta: 15, reversible: true },
    ],
  },
  {
    id: "local-jobs",
    name: "Lei de Emprego Local e Compras da Cidade",
    departmentId: "development",
    summary: "Reserva compras públicas para fornecedores locais que mantenham empregos formais.",
    complexity: 2,
    publicSupport: 71,
    implementationCost: 24000,
    operatingCostPerWeek: 520,
    vacatioWeeks: 1,
    effects: [
      { domain: "employment", target: "jobCreation", operation: "add", delta: 12, reversible: true },
      { domain: "employment", target: "localDemand", operation: "add", delta: 9, reversible: true },
    ],
  },
  {
    id: "healthy-city",
    name: "Lei da Cidade Saudável",
    departmentId: "health",
    summary: "Integra atenção básica, saúde mental, vigilância e prevenção nos bairros.",
    complexity: 3,
    publicSupport: 84,
    implementationCost: 52000,
    operatingCostPerWeek: 1980,
    vacatioWeeks: 2,
    effects: [
      { domain: "health", target: "primaryCareCapacity", operation: "add", delta: 12, reversible: true },
      { domain: "health", target: "mentalHealthAccess", operation: "add", delta: 10, reversible: true },
      { domain: "budget", target: "health", operation: "rebalance", delta: 2, reversible: true },
    ],
  },
  {
    id: "paved-connected-neighborhoods",
    name: "Programa Legal de Pavimentação e Ruas Completas",
    departmentId: "mobility",
    summary: "Autoriza pavimentação com drenagem, calçadas acessíveis, iluminação e conexão ao transporte coletivo.",
    complexity: 4,
    publicSupport: 86,
    implementationCost: 84000,
    operatingCostPerWeek: 740,
    vacatioWeeks: 1,
    effects: [
      { domain: "transport", target: "pavedRoadCapacity", operation: "add", delta: 18, reversible: false, metadata: { publicWorkType: "paving" } },
      { domain: "environment", target: "urbanDrainage", operation: "add", delta: 8, reversible: false },
      { domain: "employment", target: "constructionJobs", operation: "add", delta: 7, reversible: false },
    ],
  },
  {
    id: "planned-urban-expansion",
    name: "Lei de Expansão Urbana Planejada",
    departmentId: "housing",
    summary: "Condiciona novos bairros a fases autorizadas, vias, saneamento, transporte, escola, saúde e reserva ambiental.",
    complexity: 5,
    publicSupport: 69,
    implementationCost: 96000,
    operatingCostPerWeek: 1120,
    vacatioWeeks: 3,
    effects: [
      { domain: "housing", target: "urbanExpansionAuthorization", operation: "authorize", delta: 1, reversible: true, metadata: { phaseType: "mixed_neighborhood", requiredInfrastructure: ["roads", "water", "energy", "transit", "health", "education"] } },
      { domain: "housing", target: "newLots", operation: "add", delta: 24, reversible: false },
      { domain: "environment", target: "protectedLandShare", operation: "add", delta: 6, reversible: true },
      { domain: "budget", target: "infrastructure", operation: "rebalance", delta: 3, reversible: true },
    ],
  },
]);

export const LOCAL_LAW_STAGE_LABELS = Object.freeze({
  filed: "Proposição protocolada",
  committee: "Análise nas comissões",
  public_hearing: "Audiência pública",
  ready_for_plenary: "Pronto para o plenário",
  executive_review: "Sanção ou veto do Executivo",
  veto_review: "Análise de veto pela Câmara",
  enacted: "Lei promulgada",
  rejected: "Rejeitado",
  archived: "Arquivado",
  withdrawn: "Retirado",
  promulgated: "Vacatio legis",
  in_force: "Em vigor",
  suspended: "Eficácia suspensa",
  repealed: "Revogada",
  expired: "Prazo encerrado",
});

export const DEFAULT_LOCAL_GOVERNMENT_CONFIG = Object.freeze({
  seed: "cidade-viva-prefeitura",
  councilSeats: 9,
  historyLimit: 260,
  proposalLimit: 180,
  lawLimit: 240,
  sessionLimit: 160,
  decisionLimit: 180,
  publicWorkLimit: 120,
  effectLimit: 480,
  autoProposalIntervalWeeks: 8,
  autoProposals: true,
  publicHearingComplexity: 4,
  servantSalaryPerWeek: 1080,
  secretarySalaryPerWeek: 2240,
  mayorSalaryPerWeek: 3280,
  deputyMayorSalaryPerWeek: 2640,
  councilorSalaryPerWeek: 2140,
  maximumDepartmentPosts: 12,
});

function initialDepartment(definition) {
  return {
    id: definition.id,
    name: definition.name,
    shortName: definition.shortName,
    budgetKey: definition.budgetKey,
    mission: definition.mission,
    secretaryOfficeId: null,
    servantIds: [],
    authorizedPosts: definition.basePosts,
    vacancies: definition.basePosts,
    workload: 50,
    backlog: 0,
    performance: 55,
    serviceLevel: 55,
    budgetShare: 0,
    history: [],
  };
}

function initialState(options = {}, context = {}) {
  const config = { ...DEFAULT_LOCAL_GOVERNMENT_CONFIG, ...clone(options) };
  const week = Math.max(1, Number(context.week ?? 1));
  return {
    version: LOCAL_GOVERNMENT_VERSION,
    id: "prefeitura-vila-esperanca",
    sequence: 0,
    config,
    calendar: {
      week,
      phase: "government",
      mandateId: null,
      mandateStartWeek: null,
      mandateEndWeek: null,
      activeElectionId: null,
      nextElectionWeek: null,
      transition: false,
    },
    executive: {
      mayor: null,
      deputyMayor: null,
      internalOffices: [],
      secretaries: [],
      cabinetLastMetWeek: null,
    },
    legislature: {
      totalSeats: Number(config.councilSeats),
      councilors: [],
      presidentPersonId: null,
      vicePresidentPersonId: null,
      coalitionPartyIds: [],
      oppositionPartyIds: [],
      committees: MUNICIPAL_COMMITTEES.map((committee) => ({ ...clone(committee), memberIds: [], chairPersonId: null })),
    },
    departments: MUNICIPAL_DEPARTMENTS.map(initialDepartment),
    workforce: {
      assignments: [],
      authorizedPositions: 0,
      filledPositions: 0,
      vacancies: 0,
      weeklyPayroll: 0,
      hires: 0,
      departures: 0,
    },
    proposals: [],
    laws: [],
    sessions: [],
    decisions: [],
    publicWorks: [],
    urbanExpansion: { authorizations: [], activePhaseIds: [], completedPhaseIds: [] },
    effectLedger: [],
    pendingEffects: [],
    events: [],
    history: [],
    statistics: {
      proposals: 0,
      approved: 0,
      rejected: 0,
      vetoes: 0,
      vetoesOverridden: 0,
      lawsInForce: 0,
      lawsRepealed: 0,
      sessions: 0,
      decisions: 0,
      appointments: 0,
      worksAuthorized: 0,
      worksCompleted: 0,
      expansionPhasesAuthorized: 0,
      expansionPhasesCompleted: 0,
    },
    indicators: {
      administrativeCapacity: 50,
      legislativeProductivity: 50,
      transparency: 55,
      fiscalPressure: 0,
      servicePressure: 50,
    },
  };
}

function mergeOffice(value) {
  if (!value || typeof value !== "object") return null;
  return {
    id: String(value.id ?? `office-${value.kind ?? "unknown"}`),
    kind: String(value.kind ?? "official"),
    title: String(value.title ?? "Agente público"),
    branch: value.branch === "legislative" ? "legislative" : "executive",
    appointment: value.appointment === "elected" ? "elected" : "appointed",
    personId: value.personId == null ? null : String(value.personId),
    personName: value.personName == null ? null : String(value.personName),
    partyId: value.partyId == null ? null : String(value.partyId),
    departmentId: value.departmentId == null ? null : String(value.departmentId),
    mandateId: value.mandateId == null ? null : String(value.mandateId),
    sinceWeek: Number(value.sinceWeek ?? 1),
    endWeek: value.endWeek == null ? null : Number(value.endWeek),
    status: String(value.status ?? "active"),
    salaryPerWeek: Math.max(0, Number(value.salaryPerWeek ?? 0)),
    responsibilities: asArray(value.responsibilities).map(String),
    sourceCandidateId: value.sourceCandidateId == null ? null : String(value.sourceCandidateId),
    acting: Boolean(value.acting),
  };
}

export function normalizeLocalGovernmentState(input = {}, context = {}) {
  const source = clone(input || {});
  const base = initialState(source.config || {}, { week: context.week ?? source.calendar?.week ?? 1 });
  const state = {
    ...base,
    ...source,
    version: LOCAL_GOVERNMENT_VERSION,
    sequence: Math.max(0, Number(source.sequence ?? 0)),
    config: { ...base.config, ...(source.config || {}) },
    calendar: { ...base.calendar, ...(source.calendar || {}) },
    executive: { ...base.executive, ...(source.executive || {}) },
    legislature: { ...base.legislature, ...(source.legislature || {}) },
    workforce: { ...base.workforce, ...(source.workforce || {}) },
    statistics: { ...base.statistics, ...(source.statistics || {}) },
    indicators: { ...base.indicators, ...(source.indicators || {}) },
  };
  state.executive.mayor = mergeOffice(state.executive.mayor);
  state.executive.deputyMayor = mergeOffice(state.executive.deputyMayor);
  state.executive.internalOffices = asArray(state.executive.internalOffices).map(mergeOffice).filter(Boolean);
  state.executive.secretaries = asArray(state.executive.secretaries).map(mergeOffice).filter(Boolean);
  state.legislature.councilors = asArray(state.legislature.councilors).map(mergeOffice).filter(Boolean);
  state.legislature.coalitionPartyIds = asArray(state.legislature.coalitionPartyIds).map(String);
  state.legislature.oppositionPartyIds = asArray(state.legislature.oppositionPartyIds).map(String);
  state.legislature.committees = MUNICIPAL_COMMITTEES.map((definition) => {
    const current = asArray(state.legislature.committees).find((item) => item.id === definition.id) || {};
    return {
      ...clone(definition),
      ...current,
      memberIds: asArray(current.memberIds).map(String),
      chairPersonId: current.chairPersonId == null ? null : String(current.chairPersonId),
    };
  });
  state.departments = MUNICIPAL_DEPARTMENTS.map((definition) => {
    const current = asArray(state.departments).find((item) => item.id === definition.id) || {};
    return {
      ...initialDepartment(definition),
      ...current,
      servantIds: asArray(current.servantIds).map(String),
      history: asArray(current.history).slice(0, 52),
    };
  });
  state.urbanExpansion = { ...base.urbanExpansion, ...(source.urbanExpansion || {}) };
  state.urbanExpansion.authorizations = asArray(state.urbanExpansion.authorizations);
  state.urbanExpansion.activePhaseIds = asArray(state.urbanExpansion.activePhaseIds).map(String);
  state.urbanExpansion.completedPhaseIds = asArray(state.urbanExpansion.completedPhaseIds).map(String);
  ["assignments", "proposals", "laws", "sessions", "decisions", "publicWorks", "effectLedger", "pendingEffects", "events", "history"].forEach((key) => {
    state[key] = asArray(state[key]);
  });
  state.calendar.week = Math.max(1, Number(context.week ?? state.calendar.week ?? 1));
  return state;
}

function nextId(state, prefix) {
  state.sequence += 1;
  return `${prefix}-${state.sequence}`;
}

function addHistory(state, text, week, type = "administration", refs = []) {
  const entry = { id: nextId(state, "municipal-history"), week, type, text, refs: refs.filter(Boolean) };
  state.history.unshift(entry);
  state.history = state.history.slice(0, state.config.historyLimit);
  return entry;
}

function emit(state, events, type, title, text, week, options = {}) {
  const consequences = asArray(options.consequences).map(String);
  const event = {
    id: nextId(state, "municipal-event"),
    week,
    type,
    title,
    text,
    category: "local-government",
    importance: Number(options.importance ?? 2),
    newsworthy: Boolean(options.newsworthy),
    refs: asArray(options.refs).filter(Boolean),
    cause: options.cause == null ? null : String(options.cause),
    consequences,
    peopleIds: asArray(options.peopleIds).filter(Boolean).map(String),
    placeIds: asArray(options.placeIds).filter(Boolean).map(String),
    departmentId: options.departmentId || null,
    lawId: options.lawId || null,
    proposalId: options.proposalId || null,
    decisionId: options.decisionId || null,
    workId: options.workId || null,
    urbanExpansionPhaseId: options.urbanExpansionPhaseId || null,
  };
  state.events.unshift(event);
  state.events = state.events.slice(0, state.config.historyLimit);
  events.push(clone(event));
  addHistory(state, `${title}: ${text}`, week, type, event.refs);
  return event;
}

function addProposalHistory(proposal, week, stage, text) {
  proposal.history.unshift({ week, stage, text });
  proposal.history = proposal.history.slice(0, 80);
  proposal.updatedWeek = week;
}

function politicsState(context = {}) {
  const politics = context.politics?.state || context.politics || context.governance?.politics || null;
  return politics && typeof politics === "object" ? politics : null;
}

function personEligible(person) {
  return Boolean(
    person &&
      person.alive !== false &&
      Number(person.age ?? 0) >= 18 &&
      !person.justice?.incarcerated &&
      !person.politicalRightsSuspended,
  );
}

function personName(person, fallback = "Cargo vago") {
  return person?.name || [person?.firstName, person?.lastName].filter(Boolean).join(" ") || fallback;
}

function electedOffice(kind, holder, title, salaryPerWeek, mandateId, week, endWeek) {
  if (!holder?.personId) return null;
  return mergeOffice({
    id: `office-${kind}-${holder.personId}`,
    kind,
    title,
    branch: kind === "councilor" ? "legislative" : "executive",
    appointment: "elected",
    personId: holder.personId,
    personName: holder.name,
    partyId: holder.partyId,
    mandateId,
    sinceWeek: holder.sinceWeek ?? holder.mandateStart ?? week,
    endWeek: holder.endWeek ?? holder.mandateEnd ?? endWeek,
    status: "active",
    salaryPerWeek,
    sourceCandidateId: holder.candidateId,
    acting: Boolean(holder.acting),
    responsibilities:
      kind === "mayor"
        ? ["dirigir o Executivo", "sancionar leis", "executar o orçamento"]
        : kind === "deputy_mayor"
          ? ["substituir o prefeito", "coordenar projetos intersetoriais"]
          : ["legislar", "fiscalizar o Executivo", "representar a população"],
  });
}

function officeCandidateScore(person, office, department, week) {
  const role = String(person.role || person.jobTitle || "").toLowerCase();
  const education = person.education || {};
  const personality = person.personality || {};
  const dimensions = personality.dimensions || {};
  const keywords = [...asArray(office?.keywords), ...asArray(department?.keywords)];
  const professionalFit = keywords.reduce((score, keyword) => score + (role.includes(keyword) ? 15 : 0), 0);
  const unemployedBonus = /desempregado|sem ocupa|aposentado/.test(role) ? 28 : 0;
  const publicExperience = /municip|prefeitura|públic|servidor|professor|policial|saúde/.test(role) ? 17 : 0;
  const employedPenalty = person.businessId ? 24 : 0;
  const qualification = education.degree || education.completed ? 16 : education.enrolled ? 5 : 0;
  const integrity = clamp(
    70 + Number(dimensions.conscientiousness ?? personality.conscientiousness ?? 50) * 0.25 -
      asArray(person.justice?.offenses).length * 12 - Number(person.justice?.recordPoints ?? 0) * 3,
  );
  return (
    professionalFit +
    unemployedBonus +
    publicExperience +
    qualification +
    integrity * 0.32 +
    Number(dimensions.openness ?? 50) * 0.08 +
    Number(person.genetics?.charisma ?? personality.charisma ?? 50) * 0.08 -
    employedPenalty +
    noise(`${week}:${person.id}:${office?.kind || department?.id}`, -8, 8)
  );
}

function bestCandidate(people, usedIds, office, department, week) {
  return people
    .filter((person) => personEligible(person) && !usedIds.has(String(person.id)))
    .map((person) => ({ person, score: officeCandidateScore(person, office, department, week) }))
    .sort((left, right) => right.score - left.score || String(left.person.id).localeCompare(String(right.person.id)))[0]?.person || null;
}

function validHolder(personId, peopleById, usedIds = null) {
  if (!personId) return false;
  const valid = personEligible(peopleById.get(String(personId)));
  return valid && (!usedIds || !usedIds.has(String(personId)));
}

function assignmentForOffice(office) {
  if (!office?.personId) return null;
  return {
    personId: office.personId,
    source: "local-government",
    officeId: office.id,
    departmentId: office.departmentId,
    role: office.title,
    workplace: office.kind === "councilor" ? "Câmara Municipal" : "Prefeitura",
    contract: office.appointment === "elected" ? "Mandato eletivo" : "Cargo de confiança",
    salaryPerWeek: office.salaryPerWeek,
    hourlyWage: round(office.salaryPerWeek / 40, 2),
    shift: { name: "Serviço público municipal", start: 8, end: 17, days: [0, 1, 2, 3, 4], hours: 40 },
  };
}

function rebuildCommittees(state) {
  const councilors = state.legislature.councilors;
  state.legislature.committees = MUNICIPAL_COMMITTEES.map((definition, committeeIndex) => {
    const ordered = [...councilors].sort((left, right) => {
      const leftKey = municipalStableHash(`${state.calendar.mandateId}:${definition.id}:${left.personId}`);
      const rightKey = municipalStableHash(`${state.calendar.mandateId}:${definition.id}:${right.personId}`);
      return leftKey - rightKey;
    });
    const members = [];
    const parties = new Set();
    ordered.forEach((office) => {
      if (members.length >= Math.min(definition.seats, ordered.length)) return;
      if (!parties.has(office.partyId) || ordered.length <= definition.seats) {
        members.push(office.personId);
        parties.add(office.partyId);
      }
    });
    ordered.forEach((office) => {
      if (members.length < Math.min(definition.seats, ordered.length) && !members.includes(office.personId)) members.push(office.personId);
    });
    return {
      ...clone(definition),
      memberIds: members,
      chairPersonId: members[committeeIndex % Math.max(1, members.length)] || null,
    };
  });
}

function departmentAuthorizedPosts(definition, population, config) {
  return clamp(
    definition.basePosts + Math.floor(Math.max(0, population - 200) / definition.populationPerPost),
    definition.basePosts,
    config.maximumDepartmentPosts,
  );
}

function synchronizeOccupantsInPlace(state, context, events) {
  const week = Number(context.week ?? state.calendar.week);
  const politics = politicsState(context) || {};
  const people = asArray(context.people);
  const peopleById = new Map(people.map((person) => [String(person.id), person]));
  const holders = politics.officeHolders || {};
  const holderIsValid = (holder) => !holder?.personId
    ? false
    : !people.length || personEligible(peopleById.get(String(holder.personId)));
  let mayorHolder = holderIsValid(holders.mayor) ? holders.mayor : null;
  let deputyHolder = holderIsValid(holders.deputyMayor) ? holders.deputyMayor : null;
  if (!mayorHolder && deputyHolder) {
    mayorHolder = { ...deputyHolder, acting: true, successionReason: "vacância ou impedimento do titular" };
    deputyHolder = null;
  }
  const activeMandate = asArray(politics.mandates).find((mandate) => mandate.status === "active") || null;
  const incomingMandateId = String(
    activeMandate?.id ||
      mayorHolder?.mandateId ||
      (mayorHolder?.personId ? `mandate-${mayorHolder.personId}-${mayorHolder.sinceWeek || week}` : state.calendar.mandateId || "caretaker"),
  );
  const mandateChanged = Boolean(state.calendar.mandateId && state.calendar.mandateId !== incomingMandateId);
  const endWeek = Number(activeMandate?.endWeek ?? mayorHolder?.endWeek ?? state.calendar.mandateEndWeek ?? week + 207);
  state.calendar.week = week;
  state.calendar.mandateId = incomingMandateId;
  state.calendar.mandateStartWeek = Number(activeMandate?.startWeek ?? mayorHolder?.sinceWeek ?? state.calendar.mandateStartWeek ?? week);
  state.calendar.mandateEndWeek = endWeek;
  state.calendar.activeElectionId = politics.activeElection?.id || null;
  state.calendar.nextElectionWeek = politics.calendar?.nextElectionWeek ?? state.calendar.nextElectionWeek;
  state.calendar.phase = politics.activeElection ? "campaign" : mandateChanged ? "transition" : "government";
  state.calendar.transition = mandateChanged;

  const previousMayorId = state.executive.mayor?.personId || null;
  state.executive.mayor = electedOffice(
    "mayor",
    mayorHolder,
    "Prefeito(a)",
    state.config.mayorSalaryPerWeek,
    incomingMandateId,
    week,
    endWeek,
  );
  state.executive.deputyMayor = electedOffice(
    "deputy_mayor",
    deputyHolder,
    "Vice-prefeito(a)",
    state.config.deputyMayorSalaryPerWeek,
    incomingMandateId,
    week,
    endWeek,
  );
  if (state.executive.mayor?.acting && previousMayorId !== state.executive.mayor.personId) {
    emit(
      state,
      events,
      "mayoral-succession",
      "Vice assume o comando da Prefeitura",
      `${state.executive.mayor.personName} passou a exercer interinamente o cargo de prefeito(a).`,
      week,
      {
        newsworthy: true,
        importance: 5,
        peopleIds: [previousMayorId, state.executive.mayor.personId],
        refs: [state.calendar.mandateId],
        cause: mayorHolder.successionReason || "vacância ou impedimento do titular",
        consequences: ["continuidade administrativa preservada", "cargo de vice-prefeito permanece vago durante a substituição"],
      },
    );
  }
  const politicalCouncil = asArray(politics.council?.members).filter((member) => holderIsValid(member));
  state.legislature.totalSeats = Number(politics.council?.totalSeats ?? state.config.councilSeats);
  state.legislature.councilors = politicalCouncil
    .map((member) => electedOffice(
      "councilor",
      member,
      "Vereador(a)",
      state.config.councilorSalaryPerWeek,
      incomingMandateId,
      week,
      endWeek,
    ))
    .filter(Boolean);
  state.legislature.coalitionPartyIds = asArray(politics.council?.coalition).map(String);
  state.legislature.oppositionPartyIds = asArray(politics.council?.opposition).map(String);
  const presidencyCandidateId = politics.council?.presidency;
  state.legislature.presidentPersonId =
    state.legislature.councilors.find((office) => office.sourceCandidateId === presidencyCandidateId)?.personId ||
    state.legislature.councilors[0]?.personId || null;
  state.legislature.vicePresidentPersonId =
    state.legislature.councilors.find((office) => office.personId !== state.legislature.presidentPersonId)?.personId || null;

  const usedIds = new Set(
    [state.executive.mayor, state.executive.deputyMayor, ...state.legislature.councilors]
      .map((office) => office?.personId)
      .filter(Boolean)
      .map(String),
  );

  if (mandateChanged) {
    state.executive.internalOffices = [];
    state.executive.secretaries = [];
    state.departments.forEach((department) => { department.secretaryOfficeId = null; });
    emit(
      state,
      events,
      "government-transition",
      "Transição no governo municipal",
      `A equipe de ${state.executive.mayor?.personName || "governo interino"} iniciou a composição do novo secretariado.`,
      week,
      { newsworthy: true, importance: 4, refs: [previousMayorId, state.executive.mayor?.personId] },
    );
  }

  state.executive.internalOffices = MUNICIPAL_INTERNAL_OFFICES.map((definition) => {
    const existing = state.executive.internalOffices.find((office) => office.kind === definition.kind);
    let holderId = existing?.personId;
    if (!validHolder(holderId, peopleById, usedIds)) holderId = bestCandidate(people, usedIds, definition, null, week)?.id || null;
    if (holderId) usedIds.add(String(holderId));
    const person = peopleById.get(String(holderId));
    return mergeOffice({
      ...existing,
      id: existing?.id || `office-${definition.kind}`,
      kind: definition.kind,
      title: definition.title,
      branch: "executive",
      appointment: "appointed",
      personId: holderId,
      personName: personName(person),
      partyId: state.executive.mayor?.partyId,
      mandateId: incomingMandateId,
      sinceWeek: existing?.personId === holderId ? existing.sinceWeek : week,
      endWeek,
      salaryPerWeek: definition.salaryPerWeek,
      responsibilities: definition.responsibilities,
    });
  });

  state.executive.secretaries = MUNICIPAL_DEPARTMENTS.map((definition) => {
    const existing = state.executive.secretaries.find((office) => office.departmentId === definition.id);
    let holderId = existing?.personId;
    if (!validHolder(holderId, peopleById, usedIds)) holderId = bestCandidate(people, usedIds, { kind: "secretary" }, definition, week)?.id || null;
    if (holderId) usedIds.add(String(holderId));
    const person = peopleById.get(String(holderId));
    const office = mergeOffice({
      ...existing,
      id: existing?.id || `office-secretary-${definition.id}`,
      kind: "secretary",
      title: `Secretário(a) de ${definition.shortName}`,
      branch: "executive",
      appointment: "appointed",
      personId: holderId,
      personName: personName(person),
      partyId: state.executive.mayor?.partyId,
      departmentId: definition.id,
      mandateId: incomingMandateId,
      sinceWeek: existing?.personId === holderId ? existing.sinceWeek : week,
      endWeek,
      salaryPerWeek: state.config.secretarySalaryPerWeek,
      responsibilities: [definition.mission, "dirigir servidores e contratos", "prestar contas ao prefeito e à Câmara"],
    });
    state.departments.find((department) => department.id === definition.id).secretaryOfficeId = office.id;
    return office;
  });

  const previousServants = new Set(state.departments.flatMap((department) => department.servantIds));
  state.departments.forEach((department) => {
    const definition = MUNICIPAL_DEPARTMENTS.find((item) => item.id === department.id);
    department.authorizedPosts = departmentAuthorizedPosts(definition, people.filter((person) => person.alive !== false).length, state.config);
    const retained = department.servantIds.filter((personId) => validHolder(personId, peopleById, usedIds));
    department.servantIds = retained;
    retained.forEach((personId) => usedIds.add(String(personId)));
    while (department.servantIds.length < department.authorizedPosts) {
      const candidate = bestCandidate(people, usedIds, { kind: "civil_servant" }, definition, week);
      if (!candidate) break;
      department.servantIds.push(String(candidate.id));
      usedIds.add(String(candidate.id));
    }
    department.vacancies = Math.max(0, department.authorizedPosts - department.servantIds.length);
  });

  rebuildCommittees(state);
  const officeAssignments = [
    state.executive.mayor,
    state.executive.deputyMayor,
    ...state.executive.internalOffices,
    ...state.executive.secretaries,
    ...state.legislature.councilors,
  ].map(assignmentForOffice).filter(Boolean);
  const servantAssignments = state.departments.flatMap((department) => {
    const definition = MUNICIPAL_DEPARTMENTS.find((item) => item.id === department.id);
    return department.servantIds.map((personId, index) => {
      const role = definition.servantRoles[index % definition.servantRoles.length];
      return {
        personId,
        source: "local-government",
        officeId: null,
        departmentId: department.id,
        role,
        workplace: department.name,
        contract: "Servidor público municipal",
        salaryPerWeek: state.config.servantSalaryPerWeek,
        hourlyWage: round(state.config.servantSalaryPerWeek / 40, 2),
        shift: { name: "Expediente municipal", start: 8, end: 17, days: [0, 1, 2, 3, 4], hours: 40 },
      };
    });
  });
  state.workforce.assignments = [...officeAssignments, ...servantAssignments];
  state.workforce.authorizedPositions =
    2 + MUNICIPAL_INTERNAL_OFFICES.length + MUNICIPAL_DEPARTMENTS.length + state.legislature.totalSeats +
    state.departments.reduce((total, department) => total + department.authorizedPosts, 0);
  state.workforce.filledPositions = state.workforce.assignments.length;
  state.workforce.vacancies = Math.max(0, state.workforce.authorizedPositions - state.workforce.filledPositions);
  state.workforce.weeklyPayroll = round(state.workforce.assignments.reduce((total, assignment) => total + assignment.salaryPerWeek, 0), 2);
  const currentServants = new Set(state.departments.flatMap((department) => department.servantIds));
  state.workforce.hires += [...currentServants].filter((personId) => !previousServants.has(personId)).length;
  state.workforce.departures += [...previousServants].filter((personId) => !currentServants.has(personId)).length;
  if (mandateChanged || (!previousMayorId && state.executive.mayor?.personId)) {
    state.statistics.appointments += state.executive.internalOffices.length + state.executive.secretaries.length;
  }
  return { mandateChanged, assignments: clone(state.workforce.assignments) };
}

export function synchronizeLocalGovernmentOccupants(input, context = {}) {
  const state = normalizeLocalGovernmentState(input, context);
  const events = [];
  const result = synchronizeOccupantsInPlace(state, context, events);
  return {
    state,
    assignments: result.assignments,
    people: applyLocalGovernmentAssignmentsToPeople(context.people || [], result.assignments),
    events,
    newsFacts: municipalEventsToNewsFacts(events),
    mandateChanged: result.mandateChanged,
  };
}

function servicePressureFor(departmentId, context) {
  const people = asArray(context.people).filter((person) => person.alive !== false);
  const population = Math.max(1, people.length);
  const housing = context.housingSystem || {};
  const transport = context.transportSystem || {};
  const justice = context.justiceSystem || {};
  const environment = context.environment || {};
  const businesses = asArray(context.businesses).filter((business) => !business.closed);
  const unemployed = people.filter((person) => Number(person.age ?? 0) >= 18 && person.role === "Desempregado").length;
  const pressures = {
    government: 38 + asArray(context.governance?.history).length * 0.08,
    finance: 45 + (Number(context.treasury ?? context.money ?? 0) < 0 ? 35 : 0),
    health: 35 + people.filter((person) => person.medical?.admitted).length * 7 + asArray(context.healthSystem?.waiting).length * 4,
    education: 35 + people.filter((person) => person.education?.enrolled).length / population * 45,
    housing: 35 + asArray(housing.hotelGuests).length * 8 + Number(housing.occupancyRate ?? 60) * 0.35,
    mobility: 35 + asArray(transport.routes).reduce((total, route) => total + Number(route.waiting ?? 0), 0) * 1.5 + (100 - average(asArray(transport.routes).map((route) => route.punctuality ?? 65))) * 0.5,
    security: 35 + asArray(justice.openCases).length / population * 180 + Number(justice.corruption ?? 0) * 1.5,
    environment: 40 + (100 - Number(environment.cityAirQuality ?? context.environmentSystem?.cityAirQuality ?? 70)) * 0.55 + Number(environment.emissions ?? 0) * 0.08,
    development: 35 + unemployed / population * 240 + Math.max(0, 20 - businesses.length) * 1.5,
    social: 35 + people.filter((person) => person.happiness < 40).length / population * 120 + asArray(housing.hotelGuests).length * 4,
  };
  return clamp(pressures[departmentId] ?? 50);
}

function updateDepartmentsInPlace(state, context) {
  const budget = context.governance?.budget || {};
  state.departments.forEach((department) => {
    const pressure = servicePressureFor(department.id, context);
    const staffing = department.authorizedPosts ? department.servantIds.length / department.authorizedPosts : 0;
    const budgetShare = Number(budget[department.budgetKey] ?? 18);
    department.workload = round(pressure);
    department.backlog = round(clamp(department.backlog * 0.72 + Math.max(0, pressure - 55) * (1.25 - staffing), 0, 100));
    department.performance = round(clamp(38 + staffing * 32 + budgetShare * 0.9 - department.backlog * 0.28));
    department.serviceLevel = round(clamp(department.performance * 0.72 + (100 - pressure) * 0.28));
    department.budgetShare = round(budgetShare);
    if (state.calendar.week % 4 === 0) {
      department.history.unshift({
        week: state.calendar.week,
        performance: department.performance,
        workload: department.workload,
        backlog: department.backlog,
        staff: department.servantIds.length,
        vacancies: department.vacancies,
      });
      department.history = department.history.slice(0, 52);
    }
  });
  state.indicators.administrativeCapacity = round(average(state.departments.map((department) => department.performance)));
  state.indicators.servicePressure = round(average(state.departments.map((department) => department.workload)));
  const treasury = Number(context.treasury ?? context.money ?? 0);
  state.indicators.fiscalPressure = round(clamp(state.workforce.weeklyPayroll / Math.max(1, Math.abs(treasury)) * 100));
}

function proposalTemplate(input) {
  if (typeof input === "string") return MUNICIPAL_LAW_CATALOG.find((item) => item.id === input) || null;
  if (input?.templateId) return MUNICIPAL_LAW_CATALOG.find((item) => item.id === input.templateId) || null;
  return null;
}

function committeeIdsFor(departmentId) {
  const thematic = MUNICIPAL_COMMITTEES.find((committee) => committee.departments.includes(departmentId));
  return [...new Set(["constitution", thematic?.id || "finance", departmentId === "finance" ? null : "finance"].filter(Boolean))];
}

function validateEffects(effects) {
  const domains = new Set(["budget", "treasury", "employment", "housing", "transport", "security", "environment", "health", "education", "administration"]);
  return asArray(effects)
    .filter((effect) => effect && domains.has(effect.domain) && effect.target)
    .map((effect) => ({
      domain: String(effect.domain),
      target: String(effect.target),
      operation: String(effect.operation || "add"),
      delta: Number(effect.delta ?? 0),
      value: effect.value == null ? null : Number(effect.value),
      reversible: effect.reversible !== false,
      metadata: effect.metadata ? clone(effect.metadata) : null,
    }));
}

function sponsorFor(state, sponsorId) {
  const officials = [state.executive.mayor, ...state.legislature.councilors].filter(Boolean);
  return officials.find((office) => office.personId === sponsorId || office.id === sponsorId) || state.executive.mayor || state.legislature.councilors[0] || null;
}

function proposeInPlace(state, input = {}, context = {}, events = []) {
  const template = proposalTemplate(input);
  const values = typeof input === "string" ? {} : input || {};
  if (!template && !values.name) throw new Error("A proposta municipal precisa de templateId ou nome.");
  const week = Number(context.week ?? state.calendar.week);
  const departmentId = values.departmentId || template?.departmentId || "government";
  if (!MUNICIPAL_DEPARTMENTS.some((department) => department.id === departmentId)) throw new Error(`Secretaria municipal desconhecida: ${departmentId}`);
  const sponsor = sponsorFor(state, values.sponsorId);
  if (!sponsor) throw new Error("Não há prefeito ou vereador habilitado para apresentar a proposta.");
  const isRepeal = values.kind === "repeal";
  if (isRepeal && !state.laws.some((law) => law.id === values.targetLawId && ["promulgated", "in_force", "suspended"].includes(law.status))) {
    throw new Error("A lei indicada para revogação não está ativa.");
  }
  const proposal = {
    id: nextId(state, "municipal-bill"),
    number: state.statistics.proposals + 1,
    kind: isRepeal ? "repeal" : String(values.kind || "ordinary"),
    templateId: template?.id || null,
    targetLawId: values.targetLawId || null,
    name: String(values.name || (isRepeal ? `Revogação de ${state.laws.find((law) => law.id === values.targetLawId)?.name}` : template.name)),
    summary: String(values.summary || template?.summary || "Proposição legislativa municipal."),
    departmentId,
    sponsorId: sponsor.personId,
    sponsorOfficeId: sponsor.id,
    sponsorPartyId: sponsor.partyId,
    originatedBy: sponsor.kind === "mayor" ? "executive" : "legislative",
    createdWeek: week,
    updatedWeek: week,
    status: "filed",
    stage: "filed",
    complexity: clamp(Math.round(Number(values.complexity ?? template?.complexity ?? 2)), 1, 5),
    publicSupport: round(clamp(values.publicSupport ?? template?.publicSupport ?? 55)),
    implementationCost: Math.max(0, Number(values.implementationCost ?? template?.implementationCost ?? 0)),
    operatingCostPerWeek: Math.max(0, Number(values.operatingCostPerWeek ?? template?.operatingCostPerWeek ?? 0)),
    vacatioWeeks: Math.max(0, Math.round(Number(values.vacatioWeeks ?? template?.vacatioWeeks ?? 1))),
    sunsetWeeks: values.sunsetWeeks == null ? null : Math.max(1, Math.round(Number(values.sunsetWeeks))),
    effects: isRepeal ? [] : validateEffects(values.effects || template?.effects || []),
    requiredCommitteeIds: committeeIdsFor(departmentId),
    committeeReports: [],
    amendments: [],
    hearing: null,
    vote: null,
    executiveDecision: null,
    vetoVote: null,
    lawId: null,
    fiscalImpact: {
      implementationCost: Math.max(0, Number(values.implementationCost ?? template?.implementationCost ?? 0)),
      weeklyCost: Math.max(0, Number(values.operatingCostPerWeek ?? template?.operatingCostPerWeek ?? 0)),
      reviewed: false,
    },
    history: [{ week, stage: "filed", text: `Proposição protocolada por ${sponsor.personName || sponsor.title}.` }],
  };
  state.proposals.unshift(proposal);
  state.proposals = state.proposals.slice(0, state.config.proposalLimit);
  state.statistics.proposals += 1;
  emit(
    state,
    events,
    "proposal-filed",
    "Nova proposição na Câmara",
    `${proposal.name} foi protocolada por ${sponsor.personName || sponsor.title}.`,
    week,
    { newsworthy: proposal.complexity >= 4, importance: proposal.complexity >= 4 ? 3 : 2, refs: [proposal.id, sponsor.personId] },
  );
  return proposal;
}

export function proposeLocalLaw(inputState, proposalInput = {}, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const events = [];
  const proposal = proposeInPlace(state, proposalInput, context, events);
  return { state, proposal: clone(proposal), events, newsFacts: municipalEventsToNewsFacts(events) };
}

function proposalFeasibility(state, proposal, context) {
  const treasury = Number(context.treasury ?? context.money ?? 0);
  const fiscalCapacity = proposal.implementationCost <= 0
    ? 90
    : clamp((Math.max(0, treasury) / Math.max(1, proposal.implementationCost)) * 60);
  const department = state.departments.find((item) => item.id === proposal.departmentId);
  const administrative = department?.performance ?? state.indicators.administrativeCapacity;
  const legal = proposal.kind === "repeal" || proposal.effects.length ? 72 : 38;
  return round(clamp(proposal.publicSupport * 0.28 + fiscalCapacity * 0.3 + administrative * 0.24 + legal * 0.18));
}

function reviewCommitteesInPlace(state, proposal, context, events) {
  const week = state.calendar.week;
  const feasibility = proposalFeasibility(state, proposal, context);
  proposal.committeeReports = proposal.requiredCommitteeIds.map((committeeId) => {
    const committee = state.legislature.committees.find((item) => item.id === committeeId);
    const legalBonus = committeeId === "constitution" ? (proposal.effects.length || proposal.kind === "repeal" ? 8 : -16) : 0;
    const fiscalPenalty = committeeId === "finance" && proposal.implementationCost > Math.max(0, Number(context.treasury ?? context.money ?? 0)) * 0.5 ? -18 : 0;
    const score = round(clamp(feasibility + legalBonus + fiscalPenalty + noise(`${proposal.id}:${committeeId}`, -9, 9)));
    const result = score >= 52 ? "favorable" : score >= 43 ? "favorable_with_amendments" : "unfavorable";
    return {
      committeeId,
      committeeName: committee?.name || committeeId,
      reviewedWeek: week,
      chairPersonId: committee?.chairPersonId || null,
      score,
      result,
      rationale: result === "favorable"
        ? "Mérito, legalidade e capacidade de execução considerados adequados."
        : result === "favorable_with_amendments"
          ? "Parecer favorável condicionado a ajustes de redação e execução fiscal."
          : "O parecer identificou risco jurídico, fiscal ou baixa capacidade de execução.",
    };
  });
  if (proposal.committeeReports.some((report) => report.result === "favorable_with_amendments")) {
    proposal.amendments.push({
      id: nextId(state, "amendment"),
      week,
      authorCommitteeId: proposal.committeeReports.find((report) => report.result === "favorable_with_amendments").committeeId,
      text: "Execução condicionada à disponibilidade orçamentária e prestação trimestral de contas.",
      status: "incorporated",
    });
    proposal.implementationCost = round(proposal.implementationCost * 0.94, 2);
    proposal.fiscalImpact.implementationCost = proposal.implementationCost;
  }
  proposal.fiscalImpact.reviewed = true;
  const publicHearing = proposal.complexity >= state.config.publicHearingComplexity || proposal.publicSupport < 50;
  proposal.status = publicHearing ? "public_hearing" : "ready_for_plenary";
  proposal.stage = proposal.status;
  addProposalHistory(
    proposal,
    week,
    proposal.stage,
    `${proposal.committeeReports.length} comissão(ões) concluíram parecer; ${publicHearing ? "audiência pública convocada" : "matéria liberada ao plenário"}.`,
  );
  emit(
    state,
    events,
    "committee-report",
    "Comissões concluem análise",
    `${proposal.name} recebeu pareceres e ${publicHearing ? "seguirá para audiência pública" : "poderá ser votada"}.`,
    week,
    { importance: 2, refs: [proposal.id] },
  );
}

function holdPublicHearingInPlace(state, proposal, context, events) {
  const week = state.calendar.week;
  const population = asArray(context.people).filter((person) => person.alive !== false).length;
  const participants = Math.max(8, Math.min(120, Math.round(population * (0.06 + proposal.publicSupport / 1400))));
  const supportDelta = round(noise(`${proposal.id}:hearing`, -4, 6));
  proposal.publicSupport = round(clamp(proposal.publicSupport + supportDelta));
  proposal.hearing = {
    week,
    participants,
    speakers: Math.max(3, Math.round(participants * 0.16)),
    supportBefore: round(proposal.publicSupport - supportDelta),
    supportAfter: proposal.publicSupport,
    demands: [
      "publicação de indicadores de execução",
      proposal.departmentId === "housing" ? "prioridade a famílias em moradia temporária" : "distribuição territorial equilibrada",
    ],
  };
  proposal.status = "ready_for_plenary";
  proposal.stage = "ready_for_plenary";
  addProposalHistory(proposal, week, proposal.stage, `Audiência pública realizada com ${participants} participante(s).`);
  emit(
    state,
    events,
    "public-hearing",
    "Cidade participa de audiência pública",
    `${participants} moradores debateram ${proposal.name}.`,
    week,
    { newsworthy: true, importance: 3, refs: [proposal.id] },
  );
}

function createSessionInPlace(state, options, events) {
  const week = Number(options.week ?? state.calendar.week);
  const scheduledCouncilors = state.legislature.councilors;
  const forcedAttendance = options.attendeeIds ? new Set(options.attendeeIds.map(String)) : null;
  const attendeeIds = scheduledCouncilors
    .filter((office) => forcedAttendance ? forcedAttendance.has(String(office.personId)) : noise(`${week}:${options.kind}:${office.personId}:attendance`) < 0.91)
    .map((office) => office.personId);
  const quorumRequired = Math.floor(state.legislature.totalSeats / 2) + 1;
  const session = {
    id: nextId(state, "council-session"),
    number: state.statistics.sessions + 1,
    week,
    kind: options.kind || "ordinary",
    title: options.title || "Sessão ordinária da Câmara Municipal",
    agenda: asArray(options.agenda).map((item) => ({ ...clone(item) })),
    attendeeIds,
    absentIds: scheduledCouncilors.map((office) => office.personId).filter((personId) => !attendeeIds.includes(personId)),
    quorumRequired,
    quorumMet: attendeeIds.length >= quorumRequired,
    presidentPersonId: state.legislature.presidentPersonId,
    status: "open",
    votes: [],
    decisions: [],
    minutes: [],
    publicAttendance: Number(options.publicAttendance ?? Math.round(noise(`${week}:${options.kind}:public`, 4, 45))),
  };
  state.sessions.unshift(session);
  state.sessions = state.sessions.slice(0, state.config.sessionLimit);
  state.statistics.sessions += 1;
  if (!session.quorumMet) {
    session.status = "adjourned_no_quorum";
    session.minutes.push("Sessão encerrada sem deliberação por ausência de quórum.");
    emit(state, events, "session-no-quorum", "Sessão encerrada sem quórum", "A Câmara não reuniu presença suficiente para deliberar.", week, { importance: 2, refs: [session.id] });
  } else if (session.agenda.length) {
    const deliberative = ["deliberative", "veto_review", "extraordinary"].includes(session.kind);
    emit(
      state,
      events,
      "council-session",
      session.title,
      `A Câmara abriu sessão com ${session.attendeeIds.length} vereador(es) e ${session.agenda.length} item(ns) na pauta.`,
      week,
      {
        newsworthy: deliberative,
        importance: deliberative ? 3 : 1,
        refs: [session.id, ...session.agenda.map((item) => item.refId)],
        peopleIds: session.attendeeIds,
        cause: session.agenda.map((item) => item.title).join("; "),
        consequences: ["matérias com quórum poderão produzir decisões municipais nesta sessão"],
      },
    );
  }
  return session;
}

export function createCouncilSession(inputState, options = {}, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const events = [];
  const session = createSessionInPlace(state, { ...options, week: context.week ?? options.week }, events);
  return { state, session: clone(session), events, newsFacts: municipalEventsToNewsFacts(events) };
}

function partyData(context, partyId) {
  return asArray(politicsState(context)?.parties).find((party) => party.id === partyId) || null;
}

function voteChoice(state, proposal, councilor, context, overrideVeto) {
  const party = partyData(context, councilor.partyId);
  const coalition = state.legislature.coalitionPartyIds.includes(councilor.partyId);
  const sponsor = councilor.partyId && councilor.partyId === proposal.sponsorPartyId;
  const favorableReports = proposal.committeeReports.filter((report) => report.result !== "unfavorable").length;
  const unfavorableReports = proposal.committeeReports.length - favorableReports;
  let score = proposal.publicSupport * 0.42 + favorableReports * 9 - unfavorableReports * 13;
  score += sponsor ? 14 : 0;
  score += proposal.originatedBy === "executive" ? (coalition ? 13 : -7) : coalition ? 4 : 1;
  score += Number(party?.discipline ?? 60) * 0.08;
  score += noise(`${proposal.id}:${councilor.personId}:${overrideVeto ? "veto" : "bill"}`, -14, 14);
  if (overrideVeto) score += coalition ? -7 : 10;
  return score >= 53 ? "yes" : score < 43 ? "no" : "abstain";
}

function enactLawInPlace(state, proposal, context, events, basis, effects = []) {
  const week = state.calendar.week;
  if (proposal.kind === "repeal") {
    const target = state.laws.find((law) => law.id === proposal.targetLawId);
    if (target) effects.push(...repealLawInPlace(state, target, context, events, `revogada pela proposição ${proposal.number}`));
  }
  const law = {
    id: nextId(state, "municipal-law"),
    number: state.laws.length ? Math.max(...state.laws.map((item) => Number(item.number || 0))) + 1 : 1,
    proposalId: proposal.id,
    templateId: proposal.templateId,
    kind: proposal.kind,
    targetLawId: proposal.targetLawId,
    name: proposal.name,
    summary: proposal.summary,
    departmentId: proposal.departmentId,
    enactedWeek: week,
    promulgatedByPersonId: basis === "veto_override" ? state.legislature.presidentPersonId : state.executive.mayor?.personId || state.legislature.presidentPersonId,
    enactmentBasis: basis,
    status: "promulgated",
    stage: "promulgated",
    effectiveWeek: week + proposal.vacatioWeeks,
    expiryWeek: proposal.sunsetWeeks == null ? null : week + proposal.vacatioWeeks + proposal.sunsetWeeks,
    repealedWeek: null,
    repealReason: null,
    implementationCost: proposal.implementationCost,
    operatingCostPerWeek: proposal.operatingCostPerWeek,
    effects: clone(proposal.effects),
    effectsApplied: false,
    implementation: {
      progress: 0,
      spent: 0,
      expectedWeeks: Math.max(1, proposal.complexity * 3),
      delayedWeeks: 0,
      status: "planning",
    },
    history: [{ week, stage: "promulgated", text: `Lei promulgada; vigência prevista para a semana ${week + proposal.vacatioWeeks}.` }],
  };
  proposal.status = "enacted";
  proposal.stage = "enacted";
  proposal.lawId = law.id;
  addProposalHistory(proposal, week, "enacted", `Convertida na Lei Municipal nº ${law.number}.`);
  state.laws.unshift(law);
  state.laws = state.laws.slice(0, state.config.lawLimit);
  state.statistics.approved += 1;
  emit(
    state,
    events,
    "law-enacted",
    "Nova lei municipal promulgada",
    `A Lei nº ${law.number}, ${law.name}, entrará em vigor na semana ${law.effectiveWeek}.`,
    week,
    {
      newsworthy: true,
      importance: 4,
      refs: [proposal.id, law.id],
      lawId: law.id,
      proposalId: proposal.id,
      departmentId: law.departmentId,
      peopleIds: [law.promulgatedByPersonId],
      cause: basis === "veto_override" ? "a Câmara derrubou o veto por maioria qualificada" : "o Executivo sancionou a matéria aprovada pelos vereadores",
      consequences: [`vigência prevista para a semana ${law.effectiveWeek}`, ...law.effects.map((effect) => `${effect.domain}: ${effect.target}`)],
      urbanExpansionPhaseId: law.effects.some((effect) => effect.target === "urbanExpansionAuthorization") ? `expansion-${law.id}` : null,
    },
  );
  return law;
}

function voteInPlace(state, proposal, context, events, forcedVotes = null, options = {}) {
  const week = state.calendar.week;
  const overrideVeto = proposal.status === "veto_review" || options.overrideVeto;
  if (!overrideVeto && proposal.status !== "ready_for_plenary") return proposal.vote || null;
  const session = options.sessionId
    ? state.sessions.find((item) => item.id === options.sessionId)
    : createSessionInPlace(state, {
      week,
      kind: overrideVeto ? "veto_review" : "deliberative",
      title: overrideVeto ? "Sessão de apreciação de veto" : "Sessão deliberativa da Câmara",
      agenda: [{ type: overrideVeto ? "veto" : "proposal", refId: proposal.id, title: proposal.name }],
      attendeeIds: options.attendeeIds,
    }, events);
  if (!session || !session.quorumMet) {
    addProposalHistory(proposal, week, proposal.stage, "Votação adiada por falta de quórum.");
    return null;
  }
  const votes = state.legislature.councilors
    .filter((office) => session.attendeeIds.includes(office.personId))
    .map((councilor) => {
      const forced = forcedVotes?.[councilor.personId] ?? forcedVotes?.[councilor.id] ?? null;
      const choice = forced === "override" ? "yes" : forced === "maintain" ? "no" : forced || voteChoice(state, proposal, councilor, context, overrideVeto);
      return {
        personId: councilor.personId,
        personName: councilor.personName,
        partyId: councilor.partyId,
        choice: ["yes", "no", "abstain"].includes(choice) ? choice : "abstain",
      };
    });
  const yes = votes.filter((vote) => vote.choice === "yes").length;
  const no = votes.filter((vote) => vote.choice === "no").length;
  const abstain = votes.length - yes - no;
  const required = overrideVeto
    ? Math.ceil(state.legislature.totalSeats * 2 / 3)
    : proposal.kind === "budget" || proposal.kind === "zoning"
      ? Math.floor(state.legislature.totalSeats / 2) + 1
      : Math.floor(votes.length / 2) + 1;
  const approved = yes >= required && yes > no;
  const vote = { id: nextId(state, "council-vote"), week, sessionId: session.id, overrideVeto, yes, no, abstain, required, approved, votes };
  session.votes.push(clone(vote));
  session.minutes.push(`${proposal.name}: ${yes} favorável(is), ${no} contrário(s), ${abstain} abstenção(ões).`);
  session.status = "closed";
  if (overrideVeto) {
    proposal.vetoVote = vote;
    if (approved) {
      state.statistics.vetoesOverridden += 1;
      enactLawInPlace(state, proposal, context, events, "veto_override", options.effects || []);
    } else {
      proposal.status = "archived";
      proposal.stage = "archived";
      state.statistics.rejected += 1;
      addProposalHistory(proposal, week, "archived", `Veto mantido por ${no} voto(s); matéria arquivada.`);
      emit(state, events, "veto-maintained", "Câmara mantém veto", `O veto a ${proposal.name} foi mantido.`, week, { newsworthy: true, importance: 3, refs: [proposal.id, session.id] });
    }
  } else {
    proposal.vote = vote;
    proposal.status = approved ? "executive_review" : "rejected";
    proposal.stage = proposal.status;
    addProposalHistory(proposal, week, proposal.stage, approved ? `Aprovada por ${yes} voto(s); segue ao Executivo.` : `Rejeitada por ${no} voto(s) contrário(s).`);
    if (!approved) {
      state.statistics.rejected += 1;
      emit(state, events, "proposal-rejected", "Câmara rejeita proposição", `${proposal.name} não alcançou a maioria necessária.`, week, { newsworthy: proposal.complexity >= 4, importance: 2, refs: [proposal.id, session.id] });
    } else {
      emit(state, events, "proposal-approved", "Câmara aprova proposição", `${proposal.name} foi aprovada por ${yes} votos e segue para sanção ou veto.`, week, { newsworthy: true, importance: 4, refs: [proposal.id, session.id] });
    }
  }
  return vote;
}

export function voteLocalProposal(inputState, proposalId, context = {}, forcedVotes = null, options = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const events = [];
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal) throw new Error(`Proposição municipal não encontrada: ${proposalId}`);
  const effects = [];
  const vote = voteInPlace(state, proposal, context, events, forcedVotes, { ...options, effects });
  return { state, proposal: clone(proposal), vote: clone(vote), effects, events, newsFacts: municipalEventsToNewsFacts(events) };
}

function executiveReviewInPlace(state, proposal, context, events, forcedDecision = null, effects = []) {
  const week = state.calendar.week;
  const treasury = Number(context.treasury ?? context.money ?? 0);
  const coalitionSupport = state.legislature.coalitionPartyIds.includes(proposal.sponsorPartyId);
  const fiscalRisk = proposal.implementationCost > Math.max(0, treasury) * 0.65;
  const legalRisk = proposal.committeeReports.some((report) => report.result === "unfavorable" && report.committeeId === "constitution");
  const score = proposal.publicSupport + (coalitionSupport ? 10 : -6) - (fiscalRisk ? 22 : 0) - (legalRisk ? 28 : 0) + noise(`${proposal.id}:executive`, -10, 10);
  const decision = forcedDecision || (score >= 48 ? "sanction" : "veto");
  proposal.executiveDecision = {
    week,
    decision,
    mayorPersonId: state.executive.mayor?.personId || null,
    reasons: decision === "sanction"
      ? ["interesse público", "viabilidade administrativa"]
      : [legalRisk ? "vício jurídico apontado" : "contrariedade ao interesse público", fiscalRisk ? "risco fiscal" : "divergência de mérito"],
  };
  if (decision === "veto") {
    proposal.status = "veto_review";
    proposal.stage = "veto_review";
    state.statistics.vetoes += 1;
    addProposalHistory(proposal, week, "veto_review", "Veto integral encaminhado à Câmara para apreciação.");
    emit(state, events, "executive-veto", "Prefeitura veta proposição", `${proposal.name} recebeu veto integral e voltará à Câmara.`, week, { newsworthy: true, importance: 4, refs: [proposal.id, state.executive.mayor?.personId] });
    return null;
  }
  addProposalHistory(proposal, week, "enacted", "Sanção integral pelo Executivo municipal.");
  return enactLawInPlace(state, proposal, context, events, "mayoral_sanction", effects);
}

export function decideLocalExecutiveReview(inputState, proposalId, decision, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const events = [];
  const effects = [];
  const proposal = state.proposals.find((item) => item.id === proposalId);
  if (!proposal || proposal.status !== "executive_review") throw new Error("A proposição não aguarda decisão do Executivo.");
  const law = executiveReviewInPlace(state, proposal, context, events, decision, effects);
  return { state, proposal: clone(proposal), law: clone(law), effects, events, newsFacts: municipalEventsToNewsFacts(events) };
}

function queueEffect(state, effects, effect, source) {
  const normalized = {
    id: nextId(state, "municipal-effect"),
    week: state.calendar.week,
    sourceType: source.type,
    sourceId: source.id,
    lawId: source.lawId || null,
    decisionId: source.decisionId || null,
    domain: effect.domain,
    target: effect.target,
    operation: effect.operation || "add",
    delta: Number(effect.delta ?? 0),
    value: effect.value == null ? null : Number(effect.value),
    reversible: effect.reversible !== false,
    metadata: effect.metadata ? clone(effect.metadata) : null,
  };
  state.pendingEffects.push(normalized);
  state.pendingEffects = state.pendingEffects.slice(-state.config.effectLimit);
  effects.push(clone(normalized));
  return normalized;
}

function reverseEffect(effect) {
  if (effect.operation === "add" || effect.operation === "rebalance") return { ...clone(effect), delta: -Number(effect.delta || 0), metadata: { ...(effect.metadata || {}), reversal: true } };
  if (effect.operation === "multiply") {
    const value = Number(effect.value ?? effect.delta ?? 1);
    return { ...clone(effect), operation: "multiply", value: value ? 1 / value : 1, metadata: { ...(effect.metadata || {}), reversal: true } };
  }
  return { ...clone(effect), operation: "remove", metadata: { ...(effect.metadata || {}), reversal: true } };
}

function recordExpansionAuthorizationFromLaw(state, law) {
  const expansionEffect = law.effects.find((effect) => effect.domain === "housing" && effect.target === "urbanExpansionAuthorization");
  if (!expansionEffect) return null;
  const id = `expansion-${law.id}`;
  let authorization = state.urbanExpansion.authorizations.find((item) => item.id === id);
  if (!authorization) {
    authorization = {
      id,
      name: `Fase de expansão autorizada pela Lei nº ${law.number}`,
      districtId: expansionEffect.metadata?.districtId || null,
      phaseNumber: state.urbanExpansion.authorizations.length + 1,
      status: "authorized",
      authorizedWeek: state.calendar.week,
      activatedWeek: null,
      completedWeek: null,
      authorityPersonId: law.promulgatedByPersonId,
      legalBasisLawIds: [law.id],
      housingCapacity: Number(expansionEffect.metadata?.housingCapacity ?? 24),
      commercialLots: Number(expansionEffect.metadata?.commercialLots ?? 4),
      requiredInfrastructure: asArray(expansionEffect.metadata?.requiredInfrastructure || ["roads", "water", "energy", "transit"]),
      completedInfrastructure: [],
      publicWorkIds: [],
      environmentalReserve: Number(expansionEffect.metadata?.environmentalReserve ?? 6),
      history: [{ week: state.calendar.week, text: "Fase autorizada pela entrada em vigor da lei urbanística." }],
    };
    state.urbanExpansion.authorizations.unshift(authorization);
    state.statistics.expansionPhasesAuthorized += 1;
  }
  return authorization;
}

function applyLawInPlace(state, law, context, events, effects) {
  if (!law || !["promulgated", "in_force"].includes(law.status)) return [];
  const week = state.calendar.week;
  if (law.status === "promulgated" && week < law.effectiveWeek) return [];
  const newlyApplied = [];
  if (!law.effectsApplied) {
    const expansionAuthorization = recordExpansionAuthorizationFromLaw(state, law);
    law.effects.forEach((effect, index) => {
      const ledgerKey = `${law.id}:activation:${index}`;
      if (state.effectLedger.some((entry) => entry.key === ledgerKey)) return;
      const effectToQueue = expansionAuthorization && effect.target === "urbanExpansionAuthorization"
        ? { ...effect, metadata: { ...(effect.metadata || {}), phaseId: expansionAuthorization.id, housingCapacity: expansionAuthorization.housingCapacity, commercialLots: expansionAuthorization.commercialLots } }
        : effect;
      const queued = queueEffect(state, effects, effectToQueue, { type: "law", id: law.id, lawId: law.id });
      state.effectLedger.unshift({ key: ledgerKey, effectId: queued.id, lawId: law.id, index, active: true, appliedWeek: week, reversedWeek: null });
      newlyApplied.push(queued);
    });
    law.effectsApplied = true;
    law.status = "in_force";
    law.stage = "in_force";
    law.history.unshift({ week, stage: "in_force", text: "Lei entrou em vigor e seus efeitos estruturais foram encaminhados aos sistemas da cidade." });
    state.statistics.lawsInForce += 1;
    emit(state, events, "law-effective", "Lei municipal entra em vigor", `A Lei nº ${law.number}, ${law.name}, passou a produzir efeitos.`, week, {
      newsworthy: true,
      importance: 3,
      refs: [law.id],
      lawId: law.id,
      departmentId: law.departmentId,
      cause: `fim da vacatio legis prevista na promulgação da Lei nº ${law.number}`,
      consequences: law.effects.map((effect) => `${effect.domain}: ${effect.target} ${effect.delta >= 0 ? "+" : ""}${effect.delta}`),
      urbanExpansionPhaseId: law.effects.some((effect) => effect.target === "urbanExpansionAuthorization") ? `expansion-${law.id}` : null,
    });
  }
  return newlyApplied;
}

export function applyLocalLaw(inputState, lawId, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const events = [];
  const effects = [];
  const law = state.laws.find((item) => item.id === lawId);
  if (!law) throw new Error(`Lei municipal não encontrada: ${lawId}`);
  applyLawInPlace(state, law, context, events, effects);
  return { state, law: clone(law), effects, events, newsFacts: municipalEventsToNewsFacts(events) };
}

function repealLawInPlace(state, law, context, events, reason = "revogação expressa") {
  if (!law || !["promulgated", "in_force", "suspended"].includes(law.status)) return [];
  const week = state.calendar.week;
  const effects = [];
  if (law.effectsApplied) {
    law.effects.forEach((effect, index) => {
      if (effect.reversible === false) return;
      const ledger = state.effectLedger.find((entry) => entry.key === `${law.id}:activation:${index}` && entry.active);
      if (!ledger) return;
      const reversed = queueEffect(state, effects, reverseEffect(effect), { type: "law-repeal", id: law.id, lawId: law.id });
      ledger.active = false;
      ledger.reversedWeek = week;
      ledger.reversalEffectId = reversed.id;
    });
  }
  law.status = "repealed";
  law.stage = "repealed";
  law.repealedWeek = week;
  law.repealReason = reason;
  law.history.unshift({ week, stage: "repealed", text: `Lei revogada: ${reason}.` });
  state.statistics.lawsRepealed += 1;
  state.statistics.lawsInForce = Math.max(0, state.statistics.lawsInForce - (law.effectsApplied ? 1 : 0));
  emit(state, events, "law-repealed", "Lei municipal revogada", `A Lei nº ${law.number}, ${law.name}, deixou de vigorar (${reason}).`, week, {
    newsworthy: true,
    importance: 3,
    refs: [law.id],
    lawId: law.id,
    departmentId: law.departmentId,
    cause: reason,
    consequences: ["efeitos reversíveis da norma foram encaminhados para retirada", "novos atos não poderão usar a lei como fundamento"],
  });
  return effects;
}

export function repealLocalLaw(inputState, lawId, context = {}, options = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const events = [];
  const law = state.laws.find((item) => item.id === lawId);
  if (!law) throw new Error(`Lei municipal não encontrada: ${lawId}`);
  const effects = repealLawInPlace(state, law, context, events, options.reason || "revogação administrativa autorizada");
  return { state, law: clone(law), effects, events, newsFacts: municipalEventsToNewsFacts(events) };
}

export function proposeLawRepeal(inputState, lawId, context = {}, options = {}) {
  const law = normalizeLocalGovernmentState(inputState, context).laws.find((item) => item.id === lawId);
  if (!law) throw new Error(`Lei municipal não encontrada: ${lawId}`);
  return proposeLocalLaw(inputState, {
    kind: "repeal",
    targetLawId: lawId,
    name: options.name || `Revogação da Lei nº ${law.number} — ${law.name}`,
    summary: options.summary || `Revoga integralmente a Lei Municipal nº ${law.number}.`,
    departmentId: options.departmentId || law.departmentId,
    sponsorId: options.sponsorId,
    complexity: options.complexity ?? 2,
    publicSupport: options.publicSupport ?? 50,
    vacatioWeeks: 0,
  }, context);
}

function advanceLawsInPlace(state, context, events, effects) {
  const week = state.calendar.week;
  state.laws.forEach((law) => {
    if (law.status === "promulgated" && week >= law.effectiveWeek) applyLawInPlace(state, law, context, events, effects);
    if (law.status !== "in_force") return;
    if (law.expiryWeek != null && week >= law.expiryWeek) {
      const expiryEffects = repealLawInPlace(state, law, context, events, "encerramento do prazo de vigência");
      effects.push(...expiryEffects);
      law.status = "expired";
      law.stage = "expired";
      return;
    }
    const weeklyImplementationCost = law.implementationCost / Math.max(1, law.implementation.expectedWeeks);
    if (law.implementation.progress < 100 && weeklyImplementationCost > 0) {
      const treasuryProvided = context.treasury != null || context.money != null;
      const treasury = Number(context.treasury ?? context.money ?? 0);
      const affordable = !treasuryProvided || weeklyImplementationCost <= Math.max(0, treasury) * 0.35;
      if (affordable) {
        const remaining = Math.max(0, law.implementationCost - law.implementation.spent);
        const spend = Math.min(remaining, weeklyImplementationCost);
        if (spend > 0) {
          queueEffect(state, effects, { domain: "treasury", target: "municipalTreasury", operation: "spend", delta: -round(spend, 2), reversible: false }, { type: "law-implementation", id: law.id, lawId: law.id });
          law.implementation.spent = round(law.implementation.spent + spend, 2);
        }
        law.implementation.progress = round(clamp(law.implementation.spent / Math.max(1, law.implementationCost) * 100));
        law.implementation.status = law.implementation.progress >= 100 ? "completed" : "executing";
      } else {
        law.implementation.delayedWeeks += 1;
        law.implementation.status = "delayed_by_budget";
        if (law.implementation.delayedWeeks === 1 || law.implementation.delayedWeeks % 4 === 0) {
          emit(state, events, "law-delay", "Execução de lei sofre atraso", `${law.name} aguarda disponibilidade financeira.`, week, { newsworthy: law.implementation.delayedWeeks >= 4, importance: 2, refs: [law.id] });
        }
      }
    }
    if (law.operatingCostPerWeek > 0) {
      queueEffect(state, effects, { domain: "treasury", target: "municipalTreasury", operation: "spend", delta: -round(law.operatingCostPerWeek, 2), reversible: false }, { type: "law-operation", id: `${law.id}:${week}`, lawId: law.id });
    }
  });
  state.effectLedger = state.effectLedger.slice(0, state.config.effectLimit);
}

export function drainLocalGovernmentEffects(inputState, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const effects = clone(state.pendingEffects);
  state.pendingEffects = [];
  return { state, effects };
}

export function acknowledgeLocalGovernmentEffects(inputState, effectIds = [], context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const acknowledged = new Set(asArray(effectIds).map(String));
  const before = state.pendingEffects.length;
  state.pendingEffects = state.pendingEffects.filter((effect) => !acknowledged.has(String(effect.id)));
  return { state, acknowledged: before - state.pendingEffects.length };
}

function issueDecisionInPlace(state, input, context, events, effects) {
  const week = state.calendar.week;
  const authority = input.authorityPersonId || state.executive.mayor?.personId || state.executive.deputyMayor?.personId || null;
  const decisionEffects = validateEffects(input.effects || []);
  const decision = {
    id: nextId(state, "municipal-decision"),
    number: state.statistics.decisions + 1,
    week,
    kind: String(input.kind || "administrative_order"),
    title: String(input.title || "Decisão administrativa municipal"),
    summary: String(input.summary || "Providência de gestão adotada pela Prefeitura."),
    authorityPersonId: authority,
    departmentId: input.departmentId || "government",
    legalBasisLawIds: asArray(input.legalBasisLawIds),
    effects: decisionEffects,
    status: "effective",
    expiresWeek: input.expiresWeek == null ? null : Number(input.expiresWeek),
  };
  decisionEffects.forEach((effect) => queueEffect(state, effects, effect, { type: "decision", id: decision.id, decisionId: decision.id }));
  state.decisions.unshift(decision);
  state.decisions = state.decisions.slice(0, state.config.decisionLimit);
  state.statistics.decisions += 1;
  emit(state, events, "municipal-decision", decision.title, decision.summary, week, {
    newsworthy: Boolean(input.newsworthy),
    importance: input.importance ?? 2,
    refs: [decision.id, authority],
    peopleIds: [authority],
    decisionId: decision.id,
    departmentId: decision.departmentId,
    cause: input.cause || "demanda administrativa identificada pela Prefeitura",
    consequences: asArray(input.consequences).length
      ? input.consequences
      : decisionEffects.map((effect) => `${effect.domain}: ${effect.target} ${effect.delta >= 0 ? "+" : ""}${effect.delta}`),
    urbanExpansionPhaseId: input.urbanExpansionPhaseId || null,
    workId: input.workId || null,
  });
  return decision;
}

export function issueMunicipalDecision(inputState, decisionInput = {}, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const events = [];
  const effects = [];
  const decision = issueDecisionInPlace(state, decisionInput, context, events, effects);
  return { state, decision: clone(decision), effects, events, newsFacts: municipalEventsToNewsFacts(events) };
}

export function authorizeUrbanExpansionPhase(inputState, phaseInput = {}, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const events = [];
  const effects = [];
  const activeLegalBasis = asArray(phaseInput.legalBasisLawIds).filter((lawId) =>
    state.laws.some((law) => law.id === lawId && law.status === "in_force"),
  );
  const planningLaw = state.laws.find((law) => law.templateId === "planned-urban-expansion" && law.status === "in_force");
  if (planningLaw && !activeLegalBasis.includes(planningLaw.id)) activeLegalBasis.push(planningLaw.id);
  if (!activeLegalBasis.length && phaseInput.allowWithoutPlanningLaw !== true) {
    throw new Error("A fase de expansão precisa de lei urbanística vigente ou autorização excepcional explícita.");
  }
  const id = nextId(state, "urban-expansion-phase");
  const phase = {
    id,
    name: String(phaseInput.name || `Expansão urbana — fase ${state.urbanExpansion.authorizations.length + 1}`),
    districtId: phaseInput.districtId || null,
    phaseNumber: Number(phaseInput.phaseNumber ?? state.urbanExpansion.authorizations.length + 1),
    status: "authorized",
    authorizedWeek: state.calendar.week,
    activatedWeek: null,
    completedWeek: null,
    authorityPersonId: phaseInput.authorityPersonId || state.executive.mayor?.personId || null,
    legalBasisLawIds: activeLegalBasis,
    housingCapacity: Math.max(0, Number(phaseInput.housingCapacity ?? 30)),
    commercialLots: Math.max(0, Number(phaseInput.commercialLots ?? 5)),
    requiredInfrastructure: asArray(phaseInput.requiredInfrastructure || ["roads", "water", "energy", "transit", "health", "education"]),
    completedInfrastructure: [],
    publicWorkIds: [],
    environmentalReserve: clamp(Number(phaseInput.environmentalReserve ?? 8), 0, 100),
    history: [{ week: state.calendar.week, text: "Fase autorizada com condicionantes urbanísticas e ambientais." }],
  };
  state.urbanExpansion.authorizations.unshift(phase);
  state.statistics.expansionPhasesAuthorized += 1;
  const decision = issueDecisionInPlace(state, {
    kind: "urban_expansion_authorization",
    title: `Prefeitura autoriza ${phase.name}`,
    summary: `A fase prevê ${phase.housingCapacity} moradias, ${phase.commercialLots} lotes comerciais e infraestrutura obrigatória antes da ocupação.`,
    authorityPersonId: phase.authorityPersonId,
    departmentId: "housing",
    legalBasisLawIds: activeLegalBasis,
    effects: [{
      domain: "housing",
      target: "urbanExpansionPhase",
      operation: "authorize",
      delta: 1,
      reversible: true,
      metadata: { phaseId: phase.id, housingCapacity: phase.housingCapacity, commercialLots: phase.commercialLots, requiredInfrastructure: phase.requiredInfrastructure },
    }],
    cause: phaseInput.cause || "crescimento populacional e pressão por novas moradias",
    consequences: [
      `${phase.housingCapacity} moradias poderão ser implantadas após as obras obrigatórias`,
      `${phase.environmentalReserve}% da área deverá permanecer como reserva ambiental`,
      "ocupação permanece bloqueada até a conclusão da infraestrutura essencial",
    ],
    urbanExpansionPhaseId: phase.id,
    newsworthy: true,
    importance: 4,
  }, context, events, effects);
  phase.decisionId = decision.id;
  return { state, phase: clone(phase), decision: clone(decision), effects, events, newsFacts: municipalEventsToNewsFacts(events) };
}

const PUBLIC_WORK_COMPLETION_EFFECTS = Object.freeze({
  paving: [
    { domain: "transport", target: "pavedRoadLength", operation: "add", delta: 1, reversible: false },
    { domain: "transport", target: "roadCapacity", operation: "add", delta: 3, reversible: false },
    { domain: "environment", target: "urbanDrainage", operation: "add", delta: 2, reversible: false },
  ],
  drainage: [
    { domain: "environment", target: "urbanDrainage", operation: "add", delta: 8, reversible: false },
    { domain: "environment", target: "climateResilience", operation: "add", delta: 5, reversible: false },
  ],
  utilities: [
    { domain: "housing", target: "servicedLots", operation: "add", delta: 12, reversible: false },
    { domain: "housing", target: "utilityReliability", operation: "add", delta: 5, reversible: false },
  ],
  housing: [
    { domain: "housing", target: "housingCapacity", operation: "add", delta: 12, reversible: false },
  ],
  public_facility: [
    { domain: "administration", target: "publicFacilityCapacity", operation: "add", delta: 8, reversible: false },
  ],
});

export function authorizeMunicipalPublicWork(inputState, workInput = {}, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const events = [];
  const effects = [];
  const type = String(workInput.type || "paving");
  const allowedTypes = Object.keys(PUBLIC_WORK_COMPLETION_EFFECTS);
  if (!allowedTypes.includes(type)) throw new Error(`Tipo de obra municipal desconhecido: ${type}`);
  const phase = workInput.urbanExpansionPhaseId
    ? state.urbanExpansion.authorizations.find((item) => item.id === workInput.urbanExpansionPhaseId)
    : null;
  if (workInput.urbanExpansionPhaseId && !phase) throw new Error("Fase de expansão urbana não encontrada.");
  const id = nextId(state, "public-work");
  const budget = Math.max(1000, Number(workInput.budget ?? (type === "paving" ? 48000 : 36000)));
  const expectedWeeks = Math.max(2, Math.round(Number(workInput.expectedWeeks ?? 8)));
  const completionEffects = validateEffects(workInput.completionEffects || PUBLIC_WORK_COMPLETION_EFFECTS[type]).map((effect) => {
    if (type === "paving" && effect.target === "pavedRoadLength" && workInput.lengthKm != null) return { ...effect, delta: Number(workInput.lengthKm) };
    if (type === "housing" && effect.target === "housingCapacity" && workInput.capacity != null) return { ...effect, delta: Number(workInput.capacity) };
    return effect;
  });
  const work = {
    id,
    name: String(workInput.name || (type === "paving" ? "Pavimentação e drenagem viária" : "Obra pública municipal")),
    type,
    departmentId: workInput.departmentId || (type === "paving" ? "mobility" : type === "drainage" ? "environment" : "housing"),
    districtId: workInput.districtId || phase?.districtId || null,
    address: workInput.address || null,
    urbanExpansionPhaseId: phase?.id || null,
    legalBasisLawIds: asArray(workInput.legalBasisLawIds),
    authorizedWeek: state.calendar.week,
    startedWeek: null,
    expectedEndWeek: state.calendar.week + expectedWeeks + 2,
    completedWeek: null,
    status: "planned",
    stage: "design",
    progress: 0,
    budget,
    spent: 0,
    expectedWeeks,
    delayedWeeks: 0,
    contractorId: workInput.contractorId || null,
    workersRequired: Math.max(2, Number(workInput.workersRequired ?? Math.ceil(budget / 12000))),
    lengthKm: workInput.lengthKm == null ? null : Number(workInput.lengthKm),
    capacity: workInput.capacity == null ? null : Number(workInput.capacity),
    completionEffects,
    satisfiesInfrastructure: asArray(workInput.satisfiesInfrastructure || ({
      paving: ["roads", "transit"],
      drainage: ["drainage"],
      utilities: ["water", "energy"],
      housing: ["housing"],
      public_facility: ["health", "education"],
    }[type] || [])),
    reportedMilestones: [],
    history: [{ week: state.calendar.week, stage: "design", text: "Obra autorizada e encaminhada ao projeto executivo." }],
  };
  const decision = issueDecisionInPlace(state, {
    kind: "public_work_authorization",
    title: `${work.name} é autorizada`,
    summary: `Investimento previsto de R$ ${Math.round(budget).toLocaleString("pt-BR")} em ${expectedWeeks} semana(s).`,
    departmentId: work.departmentId,
    legalBasisLawIds: work.legalBasisLawIds,
    cause: workInput.cause || (phase ? `infraestrutura obrigatória da ${phase.name}` : "demanda de infraestrutura identificada pela Prefeitura"),
    consequences: [
      `${work.workersRequired} posto(s) de trabalho na execução`,
      type === "paving" ? `${work.lengthKm || 1} km de vias receberão pavimento, calçadas e drenagem` : "capacidade urbana será ampliada após a entrega",
      phase ? "a entrega contará para liberar a fase de expansão urbana" : "serviço urbano será ampliado após a conclusão",
    ],
    urbanExpansionPhaseId: phase?.id,
    workId: work.id,
    newsworthy: true,
    importance: 3,
  }, context, events, effects);
  work.decisionId = decision.id;
  state.publicWorks.unshift(work);
  state.publicWorks = state.publicWorks.slice(0, state.config.publicWorkLimit);
  state.statistics.worksAuthorized += 1;
  if (phase) {
    phase.publicWorkIds.push(work.id);
    if (!state.urbanExpansion.activePhaseIds.includes(phase.id)) state.urbanExpansion.activePhaseIds.push(phase.id);
    phase.status = "infrastructure_in_progress";
    phase.activatedWeek ||= state.calendar.week;
    phase.history.unshift({ week: state.calendar.week, text: `${work.name} foi vinculada às condicionantes da fase.` });
  }
  return { state, work: clone(work), decision: clone(decision), effects, events, newsFacts: municipalEventsToNewsFacts(events) };
}

function completeExpansionInfrastructure(state, work) {
  if (!work.urbanExpansionPhaseId) return null;
  const phase = state.urbanExpansion.authorizations.find((item) => item.id === work.urbanExpansionPhaseId);
  if (!phase) return null;
  asArray(work.satisfiesInfrastructure).forEach((completed) => {
    if (!phase.completedInfrastructure.includes(completed)) phase.completedInfrastructure.push(completed);
  });
  const ready = phase.requiredInfrastructure.every((requirement) => phase.completedInfrastructure.includes(requirement));
  if (ready && phase.status !== "ready_for_occupation") {
    phase.status = "ready_for_occupation";
    phase.completedWeek = state.calendar.week;
    state.urbanExpansion.activePhaseIds = state.urbanExpansion.activePhaseIds.filter((id) => id !== phase.id);
    if (!state.urbanExpansion.completedPhaseIds.includes(phase.id)) state.urbanExpansion.completedPhaseIds.push(phase.id);
    state.statistics.expansionPhasesCompleted += 1;
  }
  return { phase, ready };
}

function advancePublicWorksInPlace(state, context, events, effects) {
  const week = state.calendar.week;
  state.publicWorks.filter((work) => !["completed", "cancelled"].includes(work.status)).forEach((work) => {
    const age = week - work.authorizedWeek;
    if (work.status === "planned" && age >= 1) {
      work.status = "procurement";
      work.stage = "bidding";
      work.history.unshift({ week, stage: work.stage, text: "Edital, orçamento e cronograma foram encaminhados à contratação." });
      emit(state, events, "public-work-bidding", "Obra municipal entra em licitação", `${work.name} iniciou seleção de executores.`, week, {
        importance: 2,
        refs: [work.id, work.decisionId],
        workId: work.id,
        departmentId: work.departmentId,
        cause: "conclusão do projeto executivo e autorização orçamentária",
        consequences: ["propostas serão comparadas antes da ordem de serviço"],
      });
      return;
    }
    if (work.status === "procurement" && age >= 2) {
      work.status = "executing";
      work.stage = "construction";
      work.startedWeek = week;
      work.history.unshift({ week, stage: work.stage, text: "Ordem de serviço emitida; equipes mobilizadas." });
      emit(state, events, "public-work-start", "Obra municipal começa", `${work.name} mobilizou equipes e entrou em execução.`, week, {
        newsworthy: true,
        importance: 3,
        refs: [work.id, work.decisionId],
        workId: work.id,
        departmentId: work.departmentId,
        cause: "contratação concluída e ordem de serviço emitida",
        consequences: [`${work.workersRequired} trabalhador(es) mobilizado(s)`, `entrega estimada para a semana ${work.expectedEndWeek}`],
        urbanExpansionPhaseId: work.urbanExpansionPhaseId,
      });
      return;
    }
    if (work.status !== "executing") return;
    const weeklySpend = work.budget / work.expectedWeeks;
    const treasuryProvided = context.treasury != null || context.money != null;
    const treasury = Number(context.treasury ?? context.money ?? 0);
    const queuedTreasuryDelta = effects
      .filter((effect) => effect.domain === "treasury" && effect.target === "municipalTreasury")
      .reduce((total, effect) => total + Number(effect.delta || 0), 0);
    const availableTreasury = treasuryProvided ? Math.max(0, treasury + queuedTreasuryDelta) : Number.POSITIVE_INFINITY;
    const remaining = Math.max(0, work.budget - work.spent);
    const spend = Math.min(remaining, weeklySpend);
    if (treasuryProvided && availableTreasury + 0.005 < spend) {
      work.delayedWeeks += 1;
      work.stage = "delayed_by_budget";
      if (work.delayedWeeks === 1 || work.delayedWeeks % 4 === 0) {
        emit(state, events, "public-work-delay", "Obra municipal desacelera por falta de verba", `${work.name} acumula ${work.delayedWeeks} semana(s) de atraso.`, week, {
          newsworthy: work.delayedWeeks >= 4,
          importance: 2,
          refs: [work.id],
          workId: work.id,
          cause: "tesouro insuficiente para a medição semanal",
          consequences: [`previsão de entrega deslocada em ${work.delayedWeeks} semana(s)`],
        });
      }
      return;
    }
    work.stage = "construction";
    work.spent = round(work.spent + spend, 2);
    work.progress = round(clamp(work.spent / work.budget * 100));
    if (spend > 0) queueEffect(state, effects, { domain: "treasury", target: "municipalTreasury", operation: "spend", delta: -spend, reversible: false }, { type: "public-work", id: work.id });
    [25, 50, 75].forEach((milestone) => {
      if (work.progress >= milestone && !work.reportedMilestones.includes(milestone)) {
        work.reportedMilestones.push(milestone);
        work.history.unshift({ week, stage: work.stage, text: `Obra alcançou ${milestone}% de execução física e financeira.` });
        emit(state, events, "public-work-progress", `${work.name} chega a ${milestone}%`, `A Prefeitura confirmou novo avanço físico da obra.`, week, {
          importance: milestone === 50 ? 2 : 1,
          refs: [work.id],
          workId: work.id,
          cause: `medição semanal confirmou ${milestone}% de execução`,
          consequences: [`restam ${Math.max(0, 100 - milestone)}% até a entrega`],
          urbanExpansionPhaseId: work.urbanExpansionPhaseId,
        });
      }
    });
    if (work.progress < 100) return;
    work.status = "completed";
    work.stage = "delivered";
    work.completedWeek = week;
    work.history.unshift({ week, stage: work.stage, text: "Obra vistoriada, recebida e entregue ao uso público." });
    work.completionEffects.forEach((effect) => queueEffect(state, effects, effect, { type: "public-work-delivery", id: work.id }));
    state.statistics.worksCompleted += 1;
    const expansion = completeExpansionInfrastructure(state, work);
    emit(state, events, "public-work-complete", "Prefeitura entrega obra municipal", `${work.name} foi concluída com investimento de R$ ${Math.round(work.spent).toLocaleString("pt-BR")}.`, week, {
      newsworthy: true,
      importance: 4,
      refs: [work.id, work.decisionId, expansion?.phase?.id],
      workId: work.id,
      departmentId: work.departmentId,
      cause: "execução física atingiu 100% e a vistoria aprovou a entrega",
      consequences: [
        ...work.completionEffects.map((effect) => `${effect.target} ${effect.delta >= 0 ? "+" : ""}${effect.delta}`),
        expansion?.ready ? `${expansion.phase.name} está liberada para ocupação` : expansion?.phase ? `${expansion.phase.name} cumpriu mais uma condicionante` : "infraestrutura disponível à população",
      ],
      urbanExpansionPhaseId: expansion?.phase?.id,
    });
  });
}


function administrativeDecisionForPressure(state, context, events, effects) {
  if (state.calendar.week % 4 !== 0 || state.executive.cabinetLastMetWeek === state.calendar.week) return null;
  const pressured = [...state.departments].sort((left, right) => right.workload - left.workload)[0];
  state.executive.cabinetLastMetWeek = state.calendar.week;
  const decision = issueDecisionInPlace(state, {
    kind: "cabinet_resolution",
    title: `Gabinete prioriza ${pressured.shortName}`,
    summary: `A reunião do secretariado definiu plano de resposta para carga de serviço em ${Math.round(pressured.workload)}%.`,
    departmentId: pressured.id,
    effects: pressured.vacancies > 0
      ? [{ domain: "employment", target: "temporaryMunicipalHiring", operation: "add", delta: Math.min(3, pressured.vacancies), reversible: false }]
      : [{ domain: "administration", target: `${pressured.id}Efficiency`, operation: "add", delta: 1, reversible: false }],
    newsworthy: pressured.workload >= 78,
    importance: pressured.workload >= 78 ? 3 : 1,
  }, context, events, effects);
  addHistory(state, `Reunião do secretariado analisou ${pressured.name}.`, state.calendar.week, "cabinet", [decision.id, pressured.id]);
  return decision;
}

function advanceProposalsInPlace(state, context, events, effects) {
  const week = state.calendar.week;
  const open = state.proposals.filter((proposal) => !["enacted", "rejected", "archived", "withdrawn"].includes(proposal.status));
  open.forEach((proposal) => {
    const age = week - Number(proposal.updatedWeek ?? proposal.createdWeek ?? week);
    if (age < 1) return;
    if (proposal.status === "filed") {
      proposal.status = "committee";
      proposal.stage = "committee";
      addProposalHistory(proposal, week, "committee", `Distribuída a ${proposal.requiredCommitteeIds.length} comissão(ões) permanente(s).`);
      return;
    }
    if (proposal.status === "committee" && age >= Math.max(1, proposal.complexity - 1)) {
      reviewCommitteesInPlace(state, proposal, context, events);
      return;
    }
    if (proposal.status === "public_hearing") {
      holdPublicHearingInPlace(state, proposal, context, events);
      return;
    }
    if (proposal.status === "ready_for_plenary") {
      voteInPlace(state, proposal, context, events, null, { effects });
      return;
    }
    if (proposal.status === "executive_review") {
      executiveReviewInPlace(state, proposal, context, events, null, effects);
      return;
    }
    if (proposal.status === "veto_review") voteInPlace(state, proposal, context, events, null, { overrideVeto: true, effects });
  });
}

function maybeAutoProposalInPlace(state, context, events) {
  if (!state.config.autoProposals || !state.executive.mayor || state.calendar.phase !== "government") return null;
  if (state.calendar.week % state.config.autoProposalIntervalWeeks !== 0) return null;
  const open = state.proposals.filter((proposal) => !["enacted", "rejected", "archived", "withdrawn"].includes(proposal.status));
  if (open.length >= 3) return null;
  const activeTemplates = new Set([
    ...state.laws.filter((law) => ["promulgated", "in_force"].includes(law.status)).map((law) => law.templateId),
    ...open.map((proposal) => proposal.templateId),
  ]);
  const department = [...state.departments].sort((left, right) => right.workload - left.workload)[0];
  const candidates = MUNICIPAL_LAW_CATALOG.filter((template) => !activeTemplates.has(template.id));
  const template = candidates.find((item) => item.departmentId === department?.id) || candidates[0];
  return template ? proposeInPlace(state, { templateId: template.id }, context, events) : null;
}

function ensureRoutineSession(state, events) {
  if (state.calendar.week % 4 !== 0 || state.sessions.some((session) => session.week === state.calendar.week)) return;
  const session = createSessionInPlace(state, {
    week: state.calendar.week,
    kind: "ordinary",
    title: "Sessão ordinária de fiscalização",
    agenda: [{ type: "accountability", refId: state.calendar.mandateId, title: "Prestação mensal de contas e serviços" }],
  }, events);
  if (session.quorumMet) {
    session.status = "closed";
    session.minutes.push("Secretarias apresentaram execução orçamentária, filas e indicadores de atendimento.");
    session.decisions.push({ type: "oversight", text: "Relatórios recebidos e publicados no portal de transparência." });
  }
}

function updateGovernmentIndicators(state) {
  const completedVotes = state.sessions.flatMap((session) => session.votes).length;
  const openProposals = state.proposals.filter((proposal) => !["enacted", "rejected", "archived", "withdrawn"].includes(proposal.status)).length;
  state.indicators.legislativeProductivity = round(clamp(45 + completedVotes * 1.2 + state.statistics.approved * 2 - openProposals * 1.5));
  const controllerFilled = state.executive.internalOffices.some((office) => office.kind === "comptroller" && office.personId);
  state.indicators.transparency = round(clamp(52 + (controllerFilled ? 13 : -8) + state.sessions.filter((session) => session.publicAttendance > 0).length * 0.15));
}

export function advanceLocalGovernmentWeek(inputState, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  state.calendar.week = Math.max(state.calendar.week, Number(context.week ?? state.calendar.week + 1));
  const events = [];
  const effects = [];
  const sync = synchronizeOccupantsInPlace(state, { ...context, week: state.calendar.week }, events);
  updateDepartmentsInPlace(state, context);
  advanceProposalsInPlace(state, context, events, effects);
  maybeAutoProposalInPlace(state, context, events);
  advanceLawsInPlace(state, context, events, effects);
  advancePublicWorksInPlace(state, context, events, effects);
  administrativeDecisionForPressure(state, context, events, effects);
  ensureRoutineSession(state, events);
  updateGovernmentIndicators(state);
  state.proposals = state.proposals.slice(0, state.config.proposalLimit);
  state.laws = state.laws.slice(0, state.config.lawLimit);
  state.sessions = state.sessions.slice(0, state.config.sessionLimit);
  state.decisions = state.decisions.slice(0, state.config.decisionLimit);
  state.publicWorks = state.publicWorks.slice(0, state.config.publicWorkLimit);
  state.history = state.history.slice(0, state.config.historyLimit);
  return {
    state,
    assignments: sync.assignments,
    people: applyLocalGovernmentAssignmentsToPeople(context.people || [], sync.assignments),
    effects,
    events,
    newsFacts: municipalEventsToNewsFacts(events),
    mandateChanged: sync.mandateChanged,
  };
}

export function createLocalGovernmentState(context = {}, options = {}) {
  const state = initialState(options, context);
  const events = [];
  synchronizeOccupantsInPlace(state, context, events);
  updateDepartmentsInPlace(state, context);
  updateGovernmentIndicators(state);
  return normalizeLocalGovernmentState(state, context);
}

export const createLocalGovernment = createLocalGovernmentState;

export function applyLocalGovernmentAssignmentsToPeople(inputPeople = [], assignments = []) {
  const active = new Map(asArray(assignments).map((assignment) => [String(assignment.personId), clone(assignment)]));
  return asArray(inputPeople).map((sourcePerson) => {
    const person = clone(sourcePerson);
    const assignment = active.get(String(person.id));
    if (!assignment && person.localGovernmentAssignment) {
      const previous = person.preLocalGovernmentEmployment || {};
      person.role = previous.role ?? "Desempregado";
      person.workplace = previous.workplace ?? "—";
      person.businessId = previous.businessId ?? null;
      person.contract = previous.contract ?? null;
      person.hourlyWage = Number(previous.hourlyWage ?? 0);
      person.shift = previous.shift ? clone(previous.shift) : null;
      person.localGovernmentAssignment = null;
      person.municipalOffice = null;
      person.politicalOffice = null;
      person.preLocalGovernmentEmployment = null;
      return person;
    }
    if (!assignment) return person;
    if (!person.localGovernmentAssignment) {
      person.preLocalGovernmentEmployment = {
        role: person.role ?? null,
        workplace: person.workplace ?? null,
        businessId: person.businessId ?? null,
        contract: person.contract ?? null,
        hourlyWage: Number(person.hourlyWage ?? 0),
        shift: person.shift ? clone(person.shift) : null,
      };
    }
    person.role = assignment.role;
    person.workplace = assignment.workplace;
    person.businessId = null;
    person.contract = assignment.contract;
    person.hourlyWage = assignment.hourlyWage;
    person.shift = clone(assignment.shift);
    person.localGovernmentAssignment = clone(assignment);
    person.municipalOffice = assignment.officeId;
    person.politicalOffice = assignment.contract === "Mandato eletivo" ? assignment.role : null;
    return person;
  });
}

function rebalanceMunicipalBudget(budget, target, delta) {
  const result = { ...(budget || {}) };
  const keys = Object.keys(result);
  if (!keys.includes(target) || keys.length < 2) return result;
  const minimum = 5;
  const desired = clamp(Number(result[target] || 0) + Number(delta || 0), minimum, 100 - minimum * (keys.length - 1));
  const others = keys.filter((key) => key !== target);
  const remaining = 100 - desired;
  const current = others.reduce((total, key) => total + Math.max(minimum, Number(result[key] || minimum)), 0);
  result[target] = round(desired);
  let allocated = result[target];
  others.forEach((key, index) => {
    const value = index === others.length - 1
      ? 100 - allocated
      : remaining * (Math.max(minimum, Number(result[key] || minimum)) / Math.max(1, current));
    result[key] = round(Math.max(minimum, value));
    allocated += result[key];
  });
  const correction = round(100 - Object.values(result).reduce((total, value) => total + Number(value || 0), 0));
  result[others.at(-1)] = round(result[others.at(-1)] + correction);
  return result;
}

function applyGenericModifier(city, effect) {
  city.cityModifiers ||= {};
  city.cityModifiers[effect.domain] ||= {};
  const modifiers = city.cityModifiers[effect.domain];
  const current = Number(modifiers[effect.target] ?? 0);
  if (effect.operation === "set") modifiers[effect.target] = Number(effect.value ?? effect.delta ?? 0);
  else if (effect.operation === "multiply") modifiers[effect.target] = round((current || 1) * Number(effect.value ?? effect.delta ?? 1), 3);
  else if (effect.operation === "remove") delete modifiers[effect.target];
  else modifiers[effect.target] = round(current + Number(effect.delta || 0), 3);
}

export function applyLocalGovernmentEffectsToSnapshot(inputSnapshot = {}, inputEffects = []) {
  const city = clone(inputSnapshot || {});
  const effects = asArray(inputEffects?.effects || inputEffects);
  effects.forEach((effect) => {
    if (effect.domain === "treasury" && effect.target === "municipalTreasury") {
      const delta = Number(effect.delta || 0);
      city.money = round(Number(city.money ?? city.treasury ?? 0) + delta, 2);
      if (city.treasury != null) city.treasury = city.money;
      city.governance ||= {};
      if (delta < 0) city.governance.extraordinarySpending = round(Number(city.governance.extraordinarySpending || 0) + Math.abs(delta), 2);
      return;
    }
    if (effect.domain === "budget" && city.governance?.budget && effect.target in city.governance.budget) {
      city.governance.budget = rebalanceMunicipalBudget(city.governance.budget, effect.target, effect.delta);
      return;
    }
    if (effect.domain === "housing") {
      city.housingSystem ||= {};
      if (effect.operation === "authorize") {
        city.housingSystem.authorizedExpansionPhases ||= [];
        const phaseId = effect.metadata?.phaseId || effect.sourceId;
        if (!city.housingSystem.authorizedExpansionPhases.some((phase) => phase.id === phaseId)) {
          city.housingSystem.authorizedExpansionPhases.push({ id: phaseId, ...clone(effect.metadata), authorizedWeek: effect.week, status: "authorized" });
        }
      } else if (typeof city.housingSystem[effect.target] === "number") {
        city.housingSystem[effect.target] = round(city.housingSystem[effect.target] + Number(effect.delta || 0));
      } else applyGenericModifier(city, effect);
      return;
    }
    if (effect.domain === "transport") {
      city.transportSystem ||= {};
      if (effect.target === "punctuality") asArray(city.transportSystem.routes).forEach((route) => { route.punctuality = round(clamp(Number(route.punctuality ?? 65) + Number(effect.delta || 0))); });
      else if (effect.target === "routeCapacity") asArray(city.transportSystem.routes).forEach((route) => { route.capacity = Math.max(1, round(Number(route.capacity ?? 30) + Number(effect.delta || 0))); });
      else applyGenericModifier(city, effect);
      return;
    }
    if (effect.domain === "security" && effect.target === "patrolCapacity") {
      city.justiceSystem ||= {};
      city.justiceSystem.patrols = Math.max(0, round(Number(city.justiceSystem.patrols || 0) + Number(effect.delta || 0)));
      return;
    }
    if (effect.domain === "environment" && city.environment && typeof city.environment[effect.target] === "number") {
      city.environment[effect.target] = round(city.environment[effect.target] + Number(effect.delta || 0));
      return;
    }
    if (effect.domain === "health" && city.healthSystem && typeof city.healthSystem[effect.target] === "number") {
      city.healthSystem[effect.target] = round(city.healthSystem[effect.target] + Number(effect.delta || 0));
      return;
    }
    if (effect.domain === "education" && city.educationSystem && typeof city.educationSystem[effect.target] === "number") {
      city.educationSystem[effect.target] = round(city.educationSystem[effect.target] + Number(effect.delta || 0));
      return;
    }
    applyGenericModifier(city, effect);
  });
  return city;
}

export function municipalEventsToNewsFacts(inputEvents = []) {
  return asArray(inputEvents).map((event) => {
    const works = event.workId || event.type.startsWith("public-work");
    const expansion = Boolean(event.urbanExpansionPhaseId);
    const section = works || expansion ? "Cidade" : event.type.includes("law") || event.type.includes("proposal") || event.type.includes("veto") || event.type.includes("session") ? "Política" : "Administração";
    const consequences = asArray(event.consequences);
    return {
      id: `news-fact-${event.id}`,
      sourceEventId: event.id,
      week: event.week,
      kind: event.type,
      section,
      headline: event.title,
      lead: event.text,
      cause: event.cause || "decisão registrada pelos órgãos municipais",
      consequences: consequences.length ? consequences : ["o ato passa a integrar o acompanhamento público da cidade"],
      body: [
        event.text,
        `Causa: ${event.cause || "deliberação ou necessidade administrativa registrada"}.`,
        `Efeito: ${(consequences.length ? consequences : ["acompanhamento municipal iniciado"]).join("; ")}.`,
      ].join(" "),
      priority: event.importance >= 4 ? "destaque" : event.importance >= 3 ? "relevante" : "registro",
      newsworthy: event.newsworthy,
      peopleIds: asArray(event.peopleIds),
      placeIds: asArray(event.placeIds),
      refs: asArray(event.refs),
      lawId: event.lawId,
      proposalId: event.proposalId,
      decisionId: event.decisionId,
      workId: event.workId,
      urbanExpansionPhaseId: event.urbanExpansionPhaseId,
      tone: "civic",
    };
  });
}

function allGovernmentOffices(state) {
  return [
    state.executive.mayor,
    state.executive.deputyMayor,
    ...state.executive.internalOffices,
    ...state.executive.secretaries,
    ...state.legislature.councilors,
  ].filter(Boolean);
}

export function getMunicipalOfficialProfile(inputState, personOrOfficeId, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const office = allGovernmentOffices(state).find((item) => item.personId === personOrOfficeId || item.id === personOrOfficeId);
  if (!office) return null;
  const person = asArray(context.people).find((item) => String(item.id) === String(office.personId));
  const department = state.departments.find((item) => item.id === office.departmentId) || null;
  const committees = state.legislature.committees.filter((committee) => committee.memberIds.includes(office.personId));
  const authored = state.proposals.filter((proposal) => proposal.sponsorId === office.personId);
  const votes = state.sessions.flatMap((session) => session.votes.flatMap((vote) => vote.votes.map((individual) => ({ ...individual, sessionId: session.id, proposalVoteId: vote.id })))).filter((vote) => vote.personId === office.personId);
  const decisions = state.decisions.filter((decision) => decision.authorityPersonId === office.personId);
  return {
    office: clone(office),
    person: person ? clone(person) : null,
    department: department ? clone(department) : null,
    committees: clone(committees),
    authoredProposals: clone(authored),
    votes: clone(votes),
    decisions: clone(decisions),
    tenureWeeks: Math.max(0, state.calendar.week - office.sinceWeek + 1),
    active: office.status === "active",
  };
}

export function getLocalLawProfile(inputState, lawOrProposalId, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const law = state.laws.find((item) => item.id === lawOrProposalId);
  const proposal = law
    ? state.proposals.find((item) => item.id === law.proposalId)
    : state.proposals.find((item) => item.id === lawOrProposalId);
  if (!law && !proposal) return null;
  const resolvedLaw = law || state.laws.find((item) => item.proposalId === proposal.id) || null;
  const sessions = state.sessions.filter((session) => session.agenda.some((item) => item.refId === proposal?.id));
  const relatedWorks = state.publicWorks.filter((work) => resolvedLaw && work.legalBasisLawIds.includes(resolvedLaw.id));
  return {
    proposal: proposal ? clone(proposal) : null,
    law: resolvedLaw ? clone(resolvedLaw) : null,
    stageLabel: LOCAL_LAW_STAGE_LABELS[resolvedLaw?.stage || proposal?.stage] || resolvedLaw?.stage || proposal?.stage,
    sessions: clone(sessions),
    publicWorks: clone(relatedWorks),
    effects: clone(resolvedLaw?.effects || proposal?.effects || []),
    effectLedger: clone(state.effectLedger.filter((entry) => entry.lawId === resolvedLaw?.id)),
  };
}

export function getCouncilSessionProfile(inputState, sessionId, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) return null;
  return {
    session: clone(session),
    agendaRecords: session.agenda.map((agendaItem) => ({
      agenda: clone(agendaItem),
      proposal: clone(state.proposals.find((proposal) => proposal.id === agendaItem.refId) || null),
      law: clone(state.laws.find((law) => law.id === agendaItem.refId || law.proposalId === agendaItem.refId) || null),
    })),
    attendees: session.attendeeIds.map((personId) => getMunicipalOfficialProfile(state, personId, context)).filter(Boolean),
    newsFacts: municipalEventsToNewsFacts(state.events.filter((event) => event.refs.includes(session.id))),
  };
}

export function getMunicipalDecisionProfile(inputState, decisionId, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const decision = state.decisions.find((item) => item.id === decisionId);
  if (!decision) return null;
  return {
    decision: clone(decision),
    authority: decision.authorityPersonId ? getMunicipalOfficialProfile(state, decision.authorityPersonId, context) : null,
    legalBasis: state.laws.filter((law) => decision.legalBasisLawIds.includes(law.id)).map(clone),
    publicWorks: state.publicWorks.filter((work) => work.decisionId === decision.id).map(clone),
    urbanExpansionPhases: state.urbanExpansion.authorizations.filter((phase) => phase.decisionId === decision.id).map(clone),
    effects: clone(state.pendingEffects.filter((effect) => effect.decisionId === decision.id)),
    newsFacts: municipalEventsToNewsFacts(state.events.filter((event) => event.decisionId === decision.id || event.refs.includes(decision.id))),
  };
}

export function getMunicipalPublicWorkProfile(inputState, workId, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const work = state.publicWorks.find((item) => item.id === workId);
  if (!work) return null;
  return {
    work: clone(work),
    decision: clone(state.decisions.find((decision) => decision.id === work.decisionId) || null),
    legalBasis: state.laws.filter((law) => work.legalBasisLawIds.includes(law.id)).map(clone),
    urbanExpansionPhase: clone(state.urbanExpansion.authorizations.find((phase) => phase.id === work.urbanExpansionPhaseId) || null),
    pendingEffects: clone(state.pendingEffects.filter((effect) => effect.sourceId === work.id)),
    newsFacts: municipalEventsToNewsFacts(state.events.filter((event) => event.workId === work.id || event.refs.includes(work.id))),
  };
}

export function getLocalGovernmentSummary(inputState, context = {}) {
  const state = normalizeLocalGovernmentState(inputState, context);
  const inForce = state.laws.filter((law) => law.status === "in_force");
  const openProposals = state.proposals.filter((proposal) => !["enacted", "rejected", "archived", "withdrawn"].includes(proposal.status));
  const works = state.publicWorks.filter((work) => !["completed", "cancelled"].includes(work.status));
  return {
    week: state.calendar.week,
    phase: state.calendar.phase,
    mandateId: state.calendar.mandateId,
    mayor: state.executive.mayor ? { personId: state.executive.mayor.personId, name: state.executive.mayor.personName, partyId: state.executive.mayor.partyId } : null,
    deputyMayor: state.executive.deputyMayor ? { personId: state.executive.deputyMayor.personId, name: state.executive.deputyMayor.personName } : null,
    council: {
      occupiedSeats: state.legislature.councilors.length,
      totalSeats: state.legislature.totalSeats,
      presidentPersonId: state.legislature.presidentPersonId,
      coalitionSeats: state.legislature.councilors.filter((office) => state.legislature.coalitionPartyIds.includes(office.partyId)).length,
    },
    administration: {
      secretaries: state.executive.secretaries.filter((office) => office.personId).length,
      filledPositions: state.workforce.filledPositions,
      authorizedPositions: state.workforce.authorizedPositions,
      vacancies: state.workforce.vacancies,
      weeklyPayroll: state.workforce.weeklyPayroll,
      capacity: state.indicators.administrativeCapacity,
      servicePressure: state.indicators.servicePressure,
    },
    legislation: {
      openProposals: openProposals.length,
      inForceLaws: inForce.length,
      promulgatedLaws: state.laws.filter((law) => law.status === "promulgated").length,
      vetoes: state.statistics.vetoes,
      nextProposal: openProposals.sort((left, right) => left.updatedWeek - right.updatedWeek)[0]?.id || null,
    },
    publicWorks: {
      active: works.length,
      delayed: works.filter((work) => work.stage === "delayed_by_budget").length,
      completed: state.statistics.worksCompleted,
      investmentCommitted: round(works.reduce((total, work) => total + work.budget, 0), 2),
    },
    urbanExpansion: {
      authorized: state.urbanExpansion.authorizations.length,
      active: state.urbanExpansion.activePhaseIds.length,
      ready: state.urbanExpansion.authorizations.filter((phase) => phase.status === "ready_for_occupation").length,
      housingCapacity: state.urbanExpansion.authorizations.reduce((total, phase) => total + Number(phase.housingCapacity || 0), 0),
    },
    departments: state.departments.map((department) => ({
      id: department.id,
      name: department.shortName,
      performance: department.performance,
      workload: department.workload,
      backlog: department.backlog,
      staff: department.servantIds.length,
      vacancies: department.vacancies,
    })),
    activeElectionId: state.calendar.activeElectionId,
    nextElectionWeek: state.calendar.nextElectionWeek,
    pendingEffects: state.pendingEffects.length,
  };
}

export function serializeLocalGovernment(inputState) {
  return clone(normalizeLocalGovernmentState(inputState));
}

export function deserializeLocalGovernment(snapshot, context = {}) {
  const parsed = typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot;
  return normalizeLocalGovernmentState(parsed, context);
}

export function localGovernmentContextFromSimulation(simulation) {
  return {
    week: simulation.week,
    people: simulation.people,
    businesses: simulation.businesses,
    politics: simulation.politics?.state || simulation.governance?.politics || null,
    governance: simulation.governance,
    treasury: simulation.money,
    housingSystem: simulation.housingSystem,
    transportSystem: simulation.transportSystem,
    justiceSystem: simulation.justiceSystem,
    healthSystem: simulation.healthSystem,
    educationSystem: simulation.educationSystem,
    environment: simulation.environment,
    city: simulation.city,
  };
}

export function createLocalGovernmentForSimulation(simulation, options = {}) {
  return createLocalGovernmentState(localGovernmentContextFromSimulation(simulation), options);
}

export function advanceLocalGovernmentForSimulation(inputState, simulation) {
  return advanceLocalGovernmentWeek(inputState, localGovernmentContextFromSimulation(simulation));
}
