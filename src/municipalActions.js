/**
 * Ações administrativas acionáveis da Prefeitura.
 *
 * O módulo mantém seu próprio estado serializável e integra-se às APIs de
 * legislação, decisões e obras de localGovernment.js. Nenhuma migração é
 * obrigatória: saves sem `municipalActions` são normalizados sob demanda.
 */

import {
  authorizeMunicipalPublicWork,
  getLocalGovernmentSummary,
  issueMunicipalDecision,
  MUNICIPAL_DEPARTMENTS,
  normalizeLocalGovernmentState,
  proposeLocalLaw,
} from "./localGovernment.js";

export const MUNICIPAL_ACTIONS_VERSION = 1;

export const MUNICIPAL_ACTION_CATEGORY_LABELS = Object.freeze({
  works: "Obras e infraestrutura",
  services: "Programas e serviços",
  enforcement: "Fiscalização",
  administration: "Gestão e orçamento",
  participation: "Participação popular",
  legislation: "Legislação",
});

const clamp = (value, minimum = 0, maximum = 100) =>
  Math.max(minimum, Math.min(maximum, Number.isFinite(Number(value)) ? Number(value) : minimum));
const round = (value, digits = 2) => {
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
const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const effect = (domain, target, delta, operation = "add", reversible = true, metadata = null) => ({
  domain,
  target,
  operation,
  delta,
  reversible,
  metadata,
});

const work = (type, overrides = {}) => ({ type, ...overrides });

const define = (definition) => Object.freeze({
  durationWeeks: 1,
  cooldownWeeks: 8,
  approvalImpact: 1,
  scope: "city",
  paymentMode: definition.kind === "work" ? "commitment" : "upfront",
  requirements: {},
  effects: [],
  expectedEffects: [],
  ...definition,
});

/**
 * Catálogo deliberadamente declarativo. A UI pode renderizá-lo sem conhecer
 * detalhes de implementação, enquanto `executeMunicipalAction` converte cada
 * entrada em decisão, obra, audiência ou proposição legislativa concreta.
 */
export const MUNICIPAL_ACTION_CATALOG = Object.freeze([
  define({
    id: "complete-streets-corridor", title: "Corredor de ruas completas", category: "works", kind: "work", departmentId: "mobility",
    description: "Pavimenta um eixo viário com drenagem, calçadas acessíveis, travessias e iluminação.", cost: 72000, durationWeeks: 10, cooldownWeeks: 18, approvalImpact: 3, scope: "district",
    work: work("paving", { lengthKm: 1.8, workersRequired: 8, satisfiesInfrastructure: ["roads", "transit", "drainage"] }),
    expectedEffects: ["1,8 km de vias qualificadas", "mais capacidade viária", "melhor drenagem e acessibilidade"],
    requirements: { minimumAdministrativeCapacity: 32, maximumConcurrentDepartment: 2 },
  }),
  define({
    id: "neighborhood-drainage", title: "Macrodrenagem de bairro", category: "works", kind: "work", departmentId: "environment",
    description: "Implanta galerias, jardins de chuva e reservatórios para reduzir alagamentos.", cost: 64000, durationWeeks: 9, cooldownWeeks: 16, approvalImpact: 3, scope: "district",
    work: work("drainage", { workersRequired: 7, satisfiesInfrastructure: ["drainage"] }),
    expectedEffects: ["menor risco de alagamento", "maior resiliência climática", "vias protegidas em chuvas fortes"],
    requirements: { minimumAdministrativeCapacity: 30, maximumConcurrentDepartment: 2 },
  }),
  define({
    id: "utility-modernization", title: "Modernização das redes essenciais", category: "works", kind: "work", departmentId: "housing",
    description: "Renova água, energia e saneamento em trechos críticos da cidade.", cost: 88000, durationWeeks: 12, cooldownWeeks: 22, approvalImpact: 3,
    work: work("utilities", { workersRequired: 9, satisfiesInfrastructure: ["water", "energy", "sanitation"] }),
    expectedEffects: ["redes mais confiáveis", "novos lotes atendidos", "menos interrupções de serviço"],
    requirements: { minimumAdministrativeCapacity: 38, maximumConcurrentDepartment: 2 },
  }),
  define({
    id: "social-housing-complex", title: "Conjunto municipal de moradia", category: "works", kind: "work", departmentId: "housing",
    description: "Constrói habitação pública para famílias em aluguel pressionado ou hospedagem temporária.", cost: 142000, durationWeeks: 16, cooldownWeeks: 30, approvalImpact: 5, scope: "district",
    work: work("housing", { capacity: 28, workersRequired: 13, satisfiesInfrastructure: ["housing"] }),
    expectedEffects: ["28 novas vagas residenciais", "redução da pressão habitacional", "empregos temporários na construção"],
    requirements: { minimumAdministrativeCapacity: 42, maximumConcurrentDepartment: 1 },
  }),
  define({
    id: "neighborhood-clinic", title: "Unidade de saúde de bairro", category: "works", kind: "work", departmentId: "health",
    description: "Implanta uma unidade de atenção básica com vacinação, prevenção e saúde mental.", cost: 98000, durationWeeks: 13, cooldownWeeks: 24, approvalImpact: 5, scope: "district",
    work: work("public_facility", {
      workersRequired: 10, satisfiesInfrastructure: ["health"],
      completionEffects: [effect("administration", "publicFacilityCapacity", 8, "add", false), effect("health", "primaryCareCapacity", 12, "add", false), effect("health", "mentalHealthAccess", 7, "add", false)],
    }),
    expectedEffects: ["mais atenção primária", "acesso local à saúde mental", "menor pressão sobre hospitais"],
    requirements: { minimumAdministrativeCapacity: 40, maximumConcurrentDepartment: 1 },
  }),
  define({
    id: "full-time-school", title: "Escola municipal de tempo integral", category: "works", kind: "work", departmentId: "education",
    description: "Cria vagas escolares com biblioteca, esporte, laboratório e alimentação ampliada.", cost: 116000, durationWeeks: 15, cooldownWeeks: 28, approvalImpact: 5, scope: "district",
    work: work("public_facility", {
      workersRequired: 12, satisfiesInfrastructure: ["education"],
      completionEffects: [effect("administration", "publicFacilityCapacity", 8, "add", false), effect("education", "schoolCapacity", 18, "add", false), effect("education", "quality", 5, "add", false)],
    }),
    expectedEffects: ["18 vagas educacionais equivalentes", "melhoria pedagógica", "proteção social no contraturno"],
    requirements: { minimumAdministrativeCapacity: 40, maximumConcurrentDepartment: 1 },
  }),
  define({
    id: "linear-park", title: "Parque linear e corredor verde", category: "works", kind: "work", departmentId: "environment",
    description: "Recupera margens urbanas com árvores, lazer, caminhos e drenagem sustentável.", cost: 56000, durationWeeks: 9, cooldownWeeks: 18, approvalImpact: 4, scope: "district",
    work: work("public_facility", {
      workersRequired: 7, satisfiesInfrastructure: ["drainage", "green_area"],
      completionEffects: [effect("environment", "greenIndex", 8, "add", false), effect("environment", "urbanDrainage", 5, "add", false), effect("administration", "publicFacilityCapacity", 3, "add", false)],
    }),
    expectedEffects: ["mais cobertura vegetal", "lazer de proximidade", "absorção de águas pluviais"],
    requirements: { minimumAdministrativeCapacity: 30, maximumConcurrentDepartment: 2 },
  }),
  define({
    id: "integrated-bus-terminal", title: "Terminal integrado de ônibus", category: "works", kind: "work", departmentId: "mobility",
    description: "Constrói terminal acessível com integração de linhas e informação ao passageiro.", cost: 124000, durationWeeks: 14, cooldownWeeks: 28, approvalImpact: 5,
    work: work("public_facility", {
      workersRequired: 12, satisfiesInfrastructure: ["transit"],
      completionEffects: [effect("transport", "routeCapacity", 10, "add", false), effect("transport", "punctuality", 7, "add", false), effect("administration", "publicFacilityCapacity", 5, "add", false)],
    }),
    expectedEffects: ["mais capacidade no transporte", "linhas mais pontuais", "integração e acessibilidade"],
    requirements: { minimumAdministrativeCapacity: 44, maximumConcurrentDepartment: 1 },
  }),

  define({
    id: "primary-care-campaign", title: "Mutirão de atenção básica", category: "services", kind: "program", departmentId: "health",
    description: "Mobiliza equipes para consultas, vacinação e busca ativa de casos evitáveis.", cost: 18000, durationWeeks: 4, cooldownWeeks: 12, approvalImpact: 3,
    effects: [effect("health", "primaryCareCapacity", 6), effect("health", "prevention", 5)],
    expectedEffects: ["mais consultas preventivas", "vacinação reforçada", "filas menores no curto prazo"],
    requirements: { maximumConcurrentDepartment: 2 },
  }),
  define({
    id: "learning-recovery", title: "Programa de recuperação escolar", category: "services", kind: "program", departmentId: "education",
    description: "Oferece reforço, tutoria e acompanhamento de frequência para estudantes.", cost: 15000, durationWeeks: 6, cooldownWeeks: 14, approvalImpact: 3,
    effects: [effect("education", "quality", 4), effect("education", "retention", 7)],
    expectedEffects: ["aprendizagem recuperada", "menor evasão", "apoio individual a estudantes"],
    requirements: { maximumConcurrentDepartment: 2 },
  }),
  define({
    id: "social-rent", title: "Auxílio aluguel emergencial", category: "services", kind: "program", departmentId: "social",
    description: "Protege famílias vulneráveis enquanto a rede habitacional encontra solução permanente.", cost: 28000, durationWeeks: 8, cooldownWeeks: 18, approvalImpact: 4,
    effects: [effect("housing", "rentPressure", -7), effect("housing", "transitionalHousing", 9)],
    expectedEffects: ["menos famílias sem moradia", "proteção contra despejos", "tempo para reassentamento adequado"],
    requirements: { minimumAdministrativeCapacity: 28, maximumConcurrentDepartment: 2 },
  }),
  define({
    id: "job-qualification", title: "Qualificação e recolocação profissional", category: "services", kind: "program", departmentId: "development",
    description: "Conecta cursos rápidos, vagas abertas e empresas locais.", cost: 22000, durationWeeks: 8, cooldownWeeks: 16, approvalImpact: 3,
    effects: [effect("employment", "jobCreation", 5), effect("employment", "trainingCapacity", 12)],
    expectedEffects: ["mais moradores qualificados", "vagas preenchidas com rapidez", "desemprego pressionado para baixo"],
    requirements: { maximumConcurrentDepartment: 2 },
  }),
  define({
    id: "selective-waste-collection", title: "Coleta seletiva porta a porta", category: "services", kind: "program", departmentId: "environment",
    description: "Expande separação de resíduos, cooperativas e educação ambiental.", cost: 16000, durationWeeks: 6, cooldownWeeks: 14, approvalImpact: 2,
    effects: [effect("environment", "wasteRecovery", 10), effect("environment", "pollution", -4)],
    expectedEffects: ["mais reciclagem", "menos descarte irregular", "renda para cooperativas"],
    requirements: { maximumConcurrentDepartment: 2 },
  }),
  define({
    id: "smart-street-lighting", title: "Iluminação pública inteligente", category: "services", kind: "program", departmentId: "security",
    description: "Substitui pontos críticos e prioriza rotas de pedestres e áreas com ocorrências.", cost: 26000, durationWeeks: 6, cooldownWeeks: 14, approvalImpact: 3, scope: "district",
    effects: [effect("security", "crimePrevention", 7), effect("environment", "energyEfficiency", 4)],
    expectedEffects: ["rotas noturnas mais seguras", "resposta rápida a lâmpadas apagadas", "menor consumo de energia"],
    requirements: { maximumConcurrentDepartment: 2 },
  }),
  define({
    id: "civil-defense-plan", title: "Operação preventiva da Defesa Civil", category: "services", kind: "program", departmentId: "security",
    description: "Mapeia risco, prepara abrigos, alertas e equipes para eventos climáticos.", cost: 20000, durationWeeks: 5, cooldownWeeks: 14, approvalImpact: 3,
    effects: [effect("environment", "climateResilience", 7), effect("security", "emergencyReadiness", 9)],
    expectedEffects: ["alertas antecipados", "abrigos preparados", "resposta coordenada a emergências"],
    requirements: { maximumConcurrentDepartment: 2 },
  }),

  define({
    id: "sanitary-inspection", title: "Força-tarefa de vigilância sanitária", category: "enforcement", kind: "enforcement", departmentId: "health",
    description: "Inspeciona estabelecimentos de maior risco e orienta correções antes de sanções.", cost: 7000, durationWeeks: 2, cooldownWeeks: 8, approvalImpact: 1,
    effects: [effect("health", "sanitaryCompliance", 8), effect("administration", "inspectionCapacity", 3)],
    expectedEffects: ["menos risco sanitário", "comércio orientado", "infrações graves autuadas"],
    requirements: { maximumConcurrentDepartment: 2 },
  }),
  define({
    id: "building-safety-inspection", title: "Fiscalização de segurança predial", category: "enforcement", kind: "enforcement", departmentId: "housing",
    description: "Vistoria obras, imóveis degradados e acessibilidade em edificações de uso coletivo.", cost: 8500, durationWeeks: 3, cooldownWeeks: 9, approvalImpact: 1, scope: "district",
    effects: [effect("housing", "buildingSafety", 9), effect("administration", "inspectionCapacity", 3)],
    expectedEffects: ["obras mais seguras", "irregularidades corrigidas", "acessibilidade fiscalizada"],
    requirements: { maximumConcurrentDepartment: 2 },
  }),
  define({
    id: "traffic-safety-operation", title: "Operação de segurança viária", category: "enforcement", kind: "enforcement", departmentId: "mobility",
    description: "Fiscaliza velocidade, travessias, transporte irregular e pontos de conflito.", cost: 7500, durationWeeks: 2, cooldownWeeks: 8, approvalImpact: 1, scope: "district",
    effects: [effect("transport", "roadSafety", 8), effect("transport", "punctuality", 2)],
    expectedEffects: ["menos conflitos no trânsito", "travessias protegidas", "transporte regular fiscalizado"],
    requirements: { maximumConcurrentDepartment: 2 },
  }),
  define({
    id: "environmental-compliance", title: "Fiscalização ambiental integrada", category: "enforcement", kind: "enforcement", departmentId: "environment",
    description: "Combate descarte irregular, supressão de árvores e poluição de cursos d'água.", cost: 6800, durationWeeks: 3, cooldownWeeks: 9, approvalImpact: 1, scope: "district",
    effects: [effect("environment", "compliance", 8), effect("environment", "pollution", -3)],
    expectedEffects: ["danos ambientais interrompidos", "áreas sensíveis protegidas", "responsáveis notificados"],
    requirements: { maximumConcurrentDepartment: 2 },
  }),

  define({
    id: "expenditure-audit", title: "Auditoria extraordinária de gastos", category: "administration", kind: "administration", departmentId: "finance",
    description: "Revisa contratos, medições e compras com publicação de achados e providências.", cost: 9000, durationWeeks: 4, cooldownWeeks: 16, approvalImpact: 2,
    effects: [effect("administration", "transparency", 9), effect("administration", "procurementEfficiency", 5)],
    expectedEffects: ["contratos revisados", "mais transparência", "desperdícios identificados"],
    requirements: { maximumConcurrentDepartment: 1 },
  }),
  define({
    id: "digital-service-center", title: "Central digital de serviços", category: "administration", kind: "administration", departmentId: "government",
    description: "Unifica protocolos, agendamentos, licenças e acompanhamento de solicitações.", cost: 24000, durationWeeks: 8, cooldownWeeks: 20, approvalImpact: 3,
    effects: [effect("administration", "publicServiceQuality", 8), effect("administration", "administrativeEfficiency", 9)],
    expectedEffects: ["menos filas presenciais", "protocolos rastreáveis", "resposta administrativa mais rápida"],
    requirements: { minimumAdministrativeCapacity: 35, maximumConcurrentDepartment: 1 },
  }),
  define({
    id: "interdepartmental-task-force", title: "Força-tarefa entre secretarias", category: "administration", kind: "administration", departmentId: "government",
    description: "Realoca equipes temporariamente para atacar filas e pendências mais críticas.", cost: 14000, durationWeeks: 5, cooldownWeeks: 14, approvalImpact: 2,
    effects: [effect("administration", "backlogReduction", 12), effect("administration", "publicServiceQuality", 4)],
    expectedEffects: ["filas administrativas reduzidas", "metas semanais comuns", "casos complexos destravados"],
    requirements: { maximumConcurrentDepartment: 1 },
  }),
  define({
    id: "fiscal-contingency-plan", title: "Plano de contingência fiscal", category: "administration", kind: "administration", departmentId: "finance",
    description: "Cria reserva operacional e revisão mensal para preservar serviços essenciais.", cost: 4500, durationWeeks: 3, cooldownWeeks: 18, approvalImpact: 1,
    effects: [effect("administration", "fiscalReserve", 10), effect("administration", "budgetPredictability", 8)],
    expectedEffects: ["reserva para emergências", "despesas monitoradas", "menor risco de interrupção de obras"],
    requirements: { maximumConcurrentDepartment: 1 },
  }),

  define({
    id: "master-plan-hearing", title: "Audiência do Plano Diretor", category: "participation", kind: "hearing", departmentId: "housing",
    description: "Consulta moradores sobre adensamento, usos do solo, habitação e expansão urbana.", cost: 3000, durationWeeks: 1, cooldownWeeks: 12, approvalImpact: 2,
    effects: [effect("administration", "publicParticipation", 7), effect("housing", "planningLegitimacy", 6)],
    expectedEffects: ["demandas territoriais registradas", "planejamento mais legítimo", "devolutiva pública obrigatória"],
    requirements: { maximumConcurrentDepartment: 1 },
  }),
  define({
    id: "mobility-hearing", title: "Audiência de mobilidade e transporte", category: "participation", kind: "hearing", departmentId: "mobility",
    description: "Debate rotas, tarifa, acessibilidade e segurança viária com usuários da rede.", cost: 2800, durationWeeks: 1, cooldownWeeks: 10, approvalImpact: 2,
    effects: [effect("administration", "publicParticipation", 6), effect("transport", "planningQuality", 5)],
    expectedEffects: ["prioridades de usuários registradas", "linhas avaliadas", "compromissos públicos de melhoria"],
    requirements: { maximumConcurrentDepartment: 1 },
  }),
  define({
    id: "participatory-budget", title: "Ciclo de orçamento participativo", category: "participation", kind: "hearing", departmentId: "finance",
    description: "Moradores apresentam e priorizam investimentos para o próximo ciclo fiscal.", cost: 6500, durationWeeks: 4, cooldownWeeks: 24, approvalImpact: 4,
    effects: [effect("administration", "publicParticipation", 12), effect("administration", "budgetLegitimacy", 10)],
    expectedEffects: ["prioridades votadas por moradores", "orçamento territorializado", "prestação de contas programada"],
    requirements: { minimumAdministrativeCapacity: 30, maximumConcurrentDepartment: 1 },
  }),

  define({
    id: "affordable-housing-bill", title: "Propor lei de moradia acessível", category: "legislation", kind: "legislation", departmentId: "housing",
    description: "Protocoliza política de produção habitacional, aluguel social e proteção contra despejos.", cost: 3800, durationWeeks: 2, cooldownWeeks: 20, approvalImpact: 1, templateId: "housing-access",
    expectedEffects: ["projeto enviado às comissões", "debate público sobre aluguel", "capacidade habitacional ampliada se aprovado"],
    requirements: { requiresSponsor: true, uniqueLawTemplate: true, maximumConcurrentDepartment: 1 },
  }),
  define({
    id: "integrated-transit-bill", title: "Propor lei de transporte integrado", category: "legislation", kind: "legislation", departmentId: "mobility",
    description: "Protocoliza metas de frequência, integração tarifária e acessibilidade dos ônibus.", cost: 3800, durationWeeks: 2, cooldownWeeks: 20, approvalImpact: 1, templateId: "integrated-transit",
    expectedEffects: ["projeto enviado às comissões", "metas de pontualidade debatidas", "rede mais integrada se aprovado"],
    requirements: { requiresSponsor: true, uniqueLawTemplate: true, maximumConcurrentDepartment: 1 },
  }),
  define({
    id: "climate-resilience-bill", title: "Propor lei de resiliência climática", category: "legislation", kind: "legislation", departmentId: "environment",
    description: "Protocoliza metas permanentes para arborização, drenagem e proteção ambiental.", cost: 3800, durationWeeks: 2, cooldownWeeks: 20, approvalImpact: 1, templateId: "climate-resilience",
    expectedEffects: ["projeto enviado às comissões", "metas ambientais vinculantes", "investimento climático planejado"],
    requirements: { requiresSponsor: true, uniqueLawTemplate: true, maximumConcurrentDepartment: 1 },
  }),
]);

const CATALOG_BY_ID = new Map(MUNICIPAL_ACTION_CATALOG.map((action) => [action.id, action]));

const MUNICIPAL_ACTION_SEMANTICS = Object.freeze({
  "complete-streets-corridor": "complete-streets",
  "social-housing-complex": "social-housing",
  "full-time-school": "full-time-school",
  "linear-park": "linear-park",
  "neighborhood-clinic": "primary-health-facility",
});

const URBAN_CATALOG_SEMANTICS = Object.freeze({
  "complete-streets": "complete-streets",
  "social-housing-complex": "social-housing",
  "full-time-school": "full-time-school",
  "linear-park": "linear-park",
  "family-health-unit": "primary-health-facility",
});

/** Chave compartilhada para impedir que dois painéis autorizem a mesma obra. */
export function municipalProjectSemanticKey(input) {
  if (typeof input === "string") return MUNICIPAL_ACTION_SEMANTICS[input] || URBAN_CATALOG_SEMANTICS[input] || null;
  if (!input || typeof input !== "object") return null;
  return input.semanticProjectId
    || MUNICIPAL_ACTION_SEMANTICS[input.municipalActionId || input.actionId]
    || URBAN_CATALOG_SEMANTICS[input.urbanCatalogId || input.catalogId]
    || null;
}

const baseState = (week = 1) => ({
  version: MUNICIPAL_ACTIONS_VERSION,
  sequence: 0,
  week: Math.max(1, Math.floor(finite(week, 1))),
  active: [],
  completed: [],
  hearings: [],
  cooldowns: {},
  history: [],
  statistics: {
    authorized: 0,
    completed: 0,
    rejected: 0,
    immediateSpending: 0,
    worksCommitted: 0,
    approvalDelta: 0,
  },
});

const normalizeRecord = (record = {}) => ({
  id: String(record.id || "municipal-action-legacy"),
  actionId: String(record.actionId || "unknown"),
  title: String(record.title || CATALOG_BY_ID.get(record.actionId)?.title || "Ação municipal"),
  category: String(record.category || CATALOG_BY_ID.get(record.actionId)?.category || "administration"),
  kind: String(record.kind || CATALOG_BY_ID.get(record.actionId)?.kind || "administration"),
  departmentId: String(record.departmentId || CATALOG_BY_ID.get(record.actionId)?.departmentId || "government"),
  districtId: record.districtId == null ? null : String(record.districtId),
  districtName: record.districtName == null ? null : String(record.districtName),
  startedWeek: Math.max(1, finite(record.startedWeek, 1)),
  expectedEndWeek: Math.max(1, finite(record.expectedEndWeek, record.startedWeek || 1)),
  completedWeek: record.completedWeek == null ? null : Math.max(1, finite(record.completedWeek, 1)),
  status: String(record.status || "active"),
  progress: clamp(record.progress || 0),
  cost: Math.max(0, finite(record.cost)),
  paid: Math.max(0, finite(record.paid)),
  committed: Math.max(0, finite(record.committed)),
  approvalImpact: finite(record.approvalImpact),
  decisionId: record.decisionId == null ? null : String(record.decisionId),
  workId: record.workId == null ? null : String(record.workId),
  proposalId: record.proposalId == null ? null : String(record.proposalId),
  hearingId: record.hearingId == null ? null : String(record.hearingId),
  semanticProjectId: record.semanticProjectId == null
    ? municipalProjectSemanticKey(record.actionId)
    : String(record.semanticProjectId),
  outcome: record.outcome == null ? null : String(record.outcome),
  effects: asArray(record.effects).map(clone),
});

export function normalizeMunicipalActionsState(input = {}, context = {}) {
  let source = input;
  if (typeof source === "string") {
    try { source = JSON.parse(source); } catch { source = {}; }
  }
  if (!source || typeof source !== "object") source = {};
  const initial = baseState(context.week ?? source.week ?? 1);
  const state = {
    ...initial,
    ...clone(source),
    version: MUNICIPAL_ACTIONS_VERSION,
    sequence: Math.max(0, Math.floor(finite(source.sequence))),
    week: Math.max(1, Math.floor(finite(context.week ?? source.week, 1))),
    statistics: { ...initial.statistics, ...(source.statistics || {}) },
  };
  state.active = asArray(source.active).map(normalizeRecord).filter((record) => record.status !== "completed");
  state.completed = asArray(source.completed).map((record) => ({
    ...normalizeRecord(record),
    status: String(record?.status || "completed"),
  })).slice(0, 160);
  state.hearings = asArray(source.hearings).map((hearing) => ({
    id: String(hearing.id || "municipal-hearing-legacy"),
    actionId: String(hearing.actionId || "unknown"),
    title: String(hearing.title || "Audiência pública"),
    week: Math.max(1, finite(hearing.week, state.week)),
    departmentId: String(hearing.departmentId || "government"),
    participants: Math.max(0, Math.floor(finite(hearing.participants))),
    districtId: hearing.districtId == null ? null : String(hearing.districtId),
    decisionId: hearing.decisionId == null ? null : String(hearing.decisionId),
    demands: asArray(hearing.demands).map(String),
  })).slice(0, 80);
  state.cooldowns = Object.fromEntries(Object.entries(source.cooldowns || {})
    .map(([id, until]) => [String(id), Math.max(0, Math.floor(finite(until)))])
    .filter(([id]) => CATALOG_BY_ID.has(id)));
  state.history = asArray(source.history).map((entry) => ({
    id: String(entry.id || "municipal-action-history-legacy"),
    week: Math.max(1, finite(entry.week, state.week)),
    type: String(entry.type || "action"),
    text: String(entry.text || "Ação municipal registrada."),
    actionId: entry.actionId == null ? null : String(entry.actionId),
    recordId: entry.recordId == null ? null : String(entry.recordId),
  })).slice(0, 240);
  return state;
}

const nextId = (state, prefix) => {
  state.sequence += 1;
  return `${prefix}-${state.sequence}`;
};

const addHistory = (state, week, text, actionId, recordId, type = "action") => {
  state.history.unshift({ id: nextId(state, "municipal-action-history"), week, type, text, actionId, recordId });
  state.history = state.history.slice(0, 240);
};

const contextWeek = (context, state) => Math.max(1, Math.floor(finite(context.week ?? state.week, 1)));
const localGovernmentFrom = (context, week) => normalizeLocalGovernmentState(
  context.localGovernment || context.governance?.localGovernment || {},
  { ...context, week },
);
const treasuryFrom = (context) => Math.max(0, finite(context.treasury ?? context.money ?? context.finance?.treasury, 0));
const approvalFrom = (context) => clamp(
  context.governance?.approval
    ?? context.governance?.politics?.approval?.overall
    ?? context.politics?.state?.approval?.overall
    ?? context.politics?.approval?.overall
    ?? 50,
);

const districtsFrom = (context) => asArray(context.city?.districts || context.districts);
const resolvedDistrict = (definition, context, options = {}) => {
  if (definition.scope !== "district") return null;
  const districts = districtsFrom(context);
  const id = options.districtId || context.selectedDistrictId || context.districtId || districts[0]?.id || null;
  if (!id) return null;
  const district = districts.find((candidate) => String(candidate.id) === String(id));
  if (!district) return null;
  return { id: String(district.id), name: String(district.name || options.districtName || "Bairro selecionado") };
};

const activeNativeWorks = (localGovernment) => asArray(localGovernment?.publicWorks)
  .filter((workItem) => !["completed", "cancelled", "archived"].includes(workItem.status));

const committedWorkBudget = (localGovernment) => round(activeNativeWorks(localGovernment)
  .reduce((total, workItem) => total + Math.max(0, finite(workItem.budget) - finite(workItem.spent)), 0));

function synchronizeState(inputState, context = {}) {
  const state = normalizeMunicipalActionsState(inputState, context);
  const week = contextWeek(context, state);
  const localGovernment = localGovernmentFrom(context, week);
  const hasCanonicalLocalGovernment = Boolean(context.localGovernment || context.governance?.localGovernment);
  const completedNow = [];
  const remaining = [];

  state.active.forEach((record) => {
    const current = { ...record };
    if (current.workId) {
      const nativeWork = asArray(localGovernment.publicWorks).find((item) => item.id === current.workId);
      if (nativeWork) {
        current.progress = clamp(nativeWork.progress);
        current.committed = Math.max(0, round(finite(nativeWork.budget) - finite(nativeWork.spent)));
        current.status = nativeWork.status === "completed" ? "completed" : nativeWork.status === "cancelled" ? "cancelled" : "active";
        current.outcome = nativeWork.stage || nativeWork.status;
        if (["completed", "cancelled"].includes(nativeWork.status)) current.completedWeek = nativeWork.completedWeek || week;
      } else if (hasCanonicalLocalGovernment) {
        current.status = "cancelled";
        current.committed = 0;
        current.completedWeek = week;
        current.outcome = "orphaned_public_work";
      }
    } else {
      const duration = Math.max(1, current.expectedEndWeek - current.startedWeek);
      current.progress = clamp(((week - current.startedWeek) / duration) * 100);
      if (week >= current.expectedEndWeek) {
        current.status = "completed";
        current.progress = 100;
        current.completedWeek = week;
        current.outcome ||= current.kind === "legislation" ? "proposição protocolada" : current.kind === "hearing" ? "audiência realizada" : "execução concluída";
      }
    }
    if (["completed", "cancelled"].includes(current.status)) completedNow.push(current);
    else remaining.push(current);
  });

  completedNow.forEach((record) => {
    if (!state.completed.some((item) => item.id === record.id)) {
      state.completed.unshift(record);
      state.statistics.completed = finite(state.statistics.completed) + 1;
      addHistory(state, week, `${record.title} foi ${record.status === "cancelled" ? "encerrada" : "concluída"}.`, record.actionId, record.id, "completion");
    }
  });
  state.active = remaining;
  state.completed = state.completed.slice(0, 160);
  state.cooldowns = Object.fromEntries(Object.entries(state.cooldowns).filter(([, until]) => finite(until) > week));
  state.week = week;
  return { state, localGovernment, completedNow };
}

const requirementLabels = (definition) => {
  const labels = [];
  labels.push(definition.paymentMode === "commitment" ? "verba total disponível para reserva" : "saldo disponível para pagamento imediato");
  if (definition.requirements.minimumAdministrativeCapacity) labels.push(`capacidade administrativa mínima de ${definition.requirements.minimumAdministrativeCapacity}%`);
  if (definition.requirements.maximumConcurrentDepartment) labels.push(`máximo de ${definition.requirements.maximumConcurrentDepartment} ação(ões) simultânea(s) na secretaria`);
  if (definition.requirements.requiresSponsor) labels.push("prefeito ou vereador em exercício para protocolar");
  if (definition.requirements.uniqueLawTemplate) labels.push("nenhuma lei ou proposta equivalente ativa");
  if (definition.scope === "district") labels.push("bairro-alvo definido");
  return labels;
};

function evaluatePrepared(state, definition, context, localGovernment, options = {}) {
  const week = contextWeek(context, state);
  const treasury = treasuryFrom(context);
  const committed = committedWorkBudget(localGovernment);
  const available = Math.max(0, round(treasury - committed));
  const district = resolvedDistrict(definition, context, options);
  const reasons = [];
  const cooldownUntil = finite(state.cooldowns[definition.id]);
  const requirements = definition.requirements || {};
  const dedupeDistrictId = district?.id || null;
  const semanticProjectId = municipalProjectSemanticKey(definition.id);

  if (cooldownUntil > week) reasons.push(`Disponível novamente na semana ${cooldownUntil}.`);
  if (state.active.some((record) => record.actionId === definition.id && (record.districtId || null) === dedupeDistrictId)) {
    reasons.push("Esta ação já está em execução neste território.");
  }
  if (semanticProjectId && state.active.some((record) =>
    municipalProjectSemanticKey(record) === semanticProjectId
    && (record.districtId || null) === dedupeDistrictId)) {
    reasons.push("Já existe uma obra equivalente em execução neste território.");
  }
  if (state.active.length >= 8) reasons.push("A Prefeitura já atingiu o limite de oito ações simultâneas.");
  const activeDepartment = state.active.filter((record) => record.departmentId === definition.departmentId).length;
  if (requirements.maximumConcurrentDepartment && activeDepartment >= requirements.maximumConcurrentDepartment) {
    reasons.push("A secretaria responsável não possui capacidade para outra ação simultânea.");
  }
  if (definition.scope === "district" && !district) reasons.push("Não há bairro disponível para receber a ação.");
  if (definition.cost > available) reasons.push(`Faltam R$ ${Math.ceil(definition.cost - available).toLocaleString("pt-BR")} de saldo livre.`);

  const department = asArray(localGovernment.departments).find((item) => item.id === definition.departmentId);
  const administrativeCapacity = finite(department?.performance ?? localGovernment.indicators?.administrativeCapacity, 50);
  if (requirements.minimumAdministrativeCapacity && administrativeCapacity < requirements.minimumAdministrativeCapacity) {
    reasons.push(`Capacidade da secretaria em ${Math.round(administrativeCapacity)}%; mínimo exigido: ${requirements.minimumAdministrativeCapacity}%.`);
  }
  if (requirements.minimumApproval && approvalFrom(context) < requirements.minimumApproval) {
    reasons.push(`Aprovação mínima exigida: ${requirements.minimumApproval}%.`);
  }
  if (requirements.requiresSponsor) {
    const hasSponsor = Boolean(localGovernment.executive?.mayor?.personId || asArray(localGovernment.legislature?.councilors).some((office) => office.personId));
    if (!hasSponsor) reasons.push("Não há autoridade em exercício habilitada para protocolar a proposta.");
  }
  if (requirements.uniqueLawTemplate && definition.templateId) {
    const duplicateLaw = asArray(localGovernment.laws).some((law) => law.templateId === definition.templateId && ["promulgated", "in_force", "suspended"].includes(law.status));
    const duplicateProposal = asArray(localGovernment.proposals).some((proposal) => proposal.templateId === definition.templateId && !["enacted", "rejected", "archived", "withdrawn"].includes(proposal.status));
    if (duplicateLaw || duplicateProposal) reasons.push("Já existe lei ou proposição equivalente ativa.");
  }
  if (definition.kind === "work") {
    const duplicateNative = activeNativeWorks(localGovernment).some((workItem) =>
      (workItem.municipalActionId === definition.id || (semanticProjectId && municipalProjectSemanticKey(workItem) === semanticProjectId))
      && (workItem.districtId || null) === dedupeDistrictId);
    if (duplicateNative) reasons.push("Uma obra equivalente já está autorizada para este território.");
    const duplicateUrbanState = semanticProjectId && asArray(context.urbanManagement?.interventions).some((intervention) =>
      !["completed", "cancelled", "orphaned"].includes(intervention.status)
      && municipalProjectSemanticKey(intervention) === semanticProjectId
      && (intervention.districtId || null) === dedupeDistrictId);
    if (duplicateUrbanState) reasons.push("O planejamento urbano já possui uma intervenção equivalente neste território.");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    reason: reasons[0] || null,
    week,
    treasury,
    committed,
    available,
    cost: definition.cost,
    balanceAfterAuthorization: definition.paymentMode === "upfront" ? round(treasury - definition.cost) : treasury,
    availableAfterAuthorization: round(available - definition.cost),
    district,
    administrativeCapacity: round(administrativeCapacity, 1),
    cooldownUntil: cooldownUntil || null,
  };
}

export function evaluateMunicipalAction(inputState, actionId, context = {}, options = {}) {
  const definition = CATALOG_BY_ID.get(String(actionId));
  if (!definition) return { allowed: false, reasons: ["Ação municipal desconhecida."], reason: "Ação municipal desconhecida." };
  const prepared = synchronizeState(inputState, context);
  return evaluatePrepared(prepared.state, definition, context, prepared.localGovernment, options);
}

const applyApproval = (inputGovernance, delta) => {
  const governance = clone(inputGovernance || {});
  const before = clamp(governance.approval ?? governance.politics?.approval?.overall ?? 50);
  const after = clamp(before + finite(delta));
  governance.approval = round(after, 1);
  if (governance.politics?.approval) {
    const previous = clamp(governance.politics.approval.overall ?? before);
    governance.politics.approval.previous = previous;
    governance.politics.approval.overall = round(clamp(previous + finite(delta)), 1);
    governance.politics.approval.trend = round(governance.politics.approval.overall - previous, 1);
  }
  return { governance, before, after: governance.approval };
};

const actionContext = (context, week, treasury) => ({ ...context, week, treasury, money: treasury });

export function executeMunicipalAction(inputState, actionId, context = {}, options = {}) {
  const definition = CATALOG_BY_ID.get(String(actionId));
  if (!definition) throw new Error(`Ação municipal desconhecida: ${actionId}`);
  const prepared = synchronizeState(inputState, context);
  const state = prepared.state;
  let localGovernment = prepared.localGovernment;
  const availability = evaluatePrepared(state, definition, context, localGovernment, options);
  if (!availability.allowed) throw new Error(availability.reasons.join(" "));

  const week = availability.week;
  const district = availability.district;
  let integration = { events: [], newsFacts: [], effects: [] };
  let decisionId = null;
  let workId = null;
  let proposalId = null;
  let hearingId = null;

  if (definition.kind === "work") {
    integration = authorizeMunicipalPublicWork(localGovernment, {
      ...clone(definition.work),
      name: definition.title,
      budget: definition.cost,
      expectedWeeks: definition.durationWeeks,
      departmentId: definition.departmentId,
      districtId: district?.id || null,
      cause: options.cause || definition.description,
    }, actionContext(context, week, availability.treasury));
    localGovernment = integration.state;
    const nativeWork = localGovernment.publicWorks.find((item) => item.id === integration.work.id);
    if (nativeWork) {
      nativeWork.municipalActionId = definition.id;
      nativeWork.municipalActionScope = district?.id || "city";
      nativeWork.semanticProjectId = municipalProjectSemanticKey(definition.id);
    }
    workId = integration.work.id;
    decisionId = integration.decision?.id || null;
  } else if (definition.kind === "legislation") {
    integration = proposeLocalLaw(localGovernment, {
      templateId: definition.templateId,
      sponsorId: options.sponsorId,
    }, actionContext(context, week, availability.treasury));
    localGovernment = integration.state;
    proposalId = integration.proposal.id;
  } else {
    integration = issueMunicipalDecision(localGovernment, {
      kind: definition.kind === "hearing" ? "public_hearing" : `municipal_${definition.kind}`,
      title: definition.title,
      summary: definition.description,
      authorityPersonId: options.authorityPersonId,
      departmentId: definition.departmentId,
      effects: definition.effects,
      cause: options.cause || "prioridade definida pela administração municipal",
      consequences: definition.expectedEffects,
      newsworthy: definition.approvalImpact >= 3 || definition.kind === "hearing",
      importance: definition.approvalImpact >= 4 ? 4 : definition.approvalImpact >= 2 ? 3 : 2,
    }, actionContext(context, week, availability.treasury));
    localGovernment = integration.state;
    decisionId = integration.decision.id;
    if (definition.kind === "hearing") {
      const population = asArray(context.people).filter((person) => person.alive !== false).length;
      hearingId = nextId(state, "municipal-hearing");
      state.hearings.unshift({
        id: hearingId,
        actionId: definition.id,
        title: definition.title,
        week,
        departmentId: definition.departmentId,
        participants: Math.max(12, Math.min(240, Math.round(population * 0.09) || 28)),
        districtId: district?.id || null,
        decisionId,
        demands: definition.expectedEffects.slice(0, 3),
      });
      state.hearings = state.hearings.slice(0, 80);
    }
  }

  const treasuryAfter = definition.paymentMode === "upfront"
    ? Math.max(0, round(availability.treasury - definition.cost))
    : availability.treasury;
  const approval = applyApproval(context.governance, definition.approvalImpact);
  const recordId = nextId(state, "municipal-action");
  const record = normalizeRecord({
    id: recordId,
    actionId: definition.id,
    title: definition.title,
    category: definition.category,
    kind: definition.kind,
    departmentId: definition.departmentId,
    districtId: district?.id || null,
    districtName: district?.name || null,
    startedWeek: week,
    expectedEndWeek: week + definition.durationWeeks,
    status: "active",
    progress: 0,
    cost: definition.cost,
    paid: definition.paymentMode === "upfront" ? definition.cost : 0,
    committed: definition.paymentMode === "commitment" ? definition.cost : 0,
    approvalImpact: definition.approvalImpact,
    decisionId,
    workId,
    proposalId,
    hearingId,
    semanticProjectId: municipalProjectSemanticKey(definition.id),
    effects: definition.effects,
  });

  state.active.unshift(record);
  state.cooldowns[definition.id] = week + definition.cooldownWeeks;
  state.statistics.authorized = finite(state.statistics.authorized) + 1;
  state.statistics.immediateSpending = round(finite(state.statistics.immediateSpending) + record.paid);
  state.statistics.worksCommitted = round(finite(state.statistics.worksCommitted) + record.committed);
  state.statistics.approvalDelta = round(finite(state.statistics.approvalDelta) + definition.approvalImpact, 1);
  state.week = week;
  addHistory(
    state,
    week,
    `${definition.title} foi autorizada${district ? ` em ${district.name}` : ""}; ${definition.paymentMode === "commitment" ? "verba reservada" : "despesa executada"} de R$ ${definition.cost.toLocaleString("pt-BR")}.`,
    definition.id,
    recordId,
    "authorization",
  );

  return {
    ok: true,
    state,
    action: clone(record),
    definition: clone(definition),
    availability,
    localGovernment,
    governance: approval.governance,
    treasury: treasuryAfter,
    finance: {
      treasuryBefore: availability.treasury,
      treasuryAfter,
      immediateDebit: record.paid,
      newCommitment: record.committed,
      previouslyCommitted: availability.committed,
      availableAfter: Math.max(0, round(treasuryAfter - availability.committed - record.committed)),
    },
    approval: { before: approval.before, after: approval.after, delta: definition.approvalImpact },
    decision: integration.decision || null,
    work: integration.work || null,
    proposal: integration.proposal || null,
    hearing: hearingId ? clone(state.hearings.find((item) => item.id === hearingId)) : null,
    effects: asArray(integration.effects),
    events: asArray(integration.events),
    newsFacts: asArray(integration.newsFacts),
  };
}

export function advanceMunicipalActionsWeek(inputState, context = {}) {
  const prepared = synchronizeState(inputState, context);
  return {
    state: prepared.state,
    completed: clone(prepared.completedNow),
    snapshot: getMunicipalActionsSnapshot(prepared.state, { ...context, localGovernment: prepared.localGovernment }),
  };
}

export function getMunicipalActionCatalog() {
  return MUNICIPAL_ACTION_CATALOG.map((definition) => ({
    ...clone(definition),
    categoryLabel: MUNICIPAL_ACTION_CATEGORY_LABELS[definition.category] || definition.category,
    departmentName: MUNICIPAL_DEPARTMENTS.find((department) => department.id === definition.departmentId)?.shortName || definition.departmentId,
    requirementsSummary: requirementLabels(definition),
  }));
}

export function getMunicipalActionsSnapshot(inputState, context = {}, options = {}) {
  const prepared = synchronizeState(inputState, context);
  const { state, localGovernment } = prepared;
  const treasury = treasuryFrom(context);
  const committed = committedWorkBudget(localGovernment);
  const actions = MUNICIPAL_ACTION_CATALOG.map((definition) => {
    const availability = evaluatePrepared(state, definition, context, localGovernment, options);
    const active = state.active.find((record) => record.actionId === definition.id && (record.districtId || null) === (availability.district?.id || null));
    return {
      ...clone(definition),
      categoryLabel: MUNICIPAL_ACTION_CATEGORY_LABELS[definition.category] || definition.category,
      departmentName: MUNICIPAL_DEPARTMENTS.find((department) => department.id === definition.departmentId)?.shortName || definition.departmentId,
      requirementsSummary: requirementLabels(definition),
      availability,
      active: clone(active || null),
      status: active ? "active" : availability.allowed ? "available" : "blocked",
    };
  });
  const categories = Object.entries(MUNICIPAL_ACTION_CATEGORY_LABELS).map(([id, label]) => ({
    id,
    label,
    actions: actions.filter((action) => action.category === id),
  }));
  const departments = MUNICIPAL_DEPARTMENTS.map((department) => {
    const current = asArray(localGovernment.departments).find((item) => item.id === department.id);
    return {
      id: department.id,
      name: department.shortName,
      fullName: department.name,
      performance: round(current?.performance ?? 50, 1),
      backlog: round(current?.backlog ?? 0, 1),
      vacancies: Math.max(0, finite(current?.vacancies)),
      activeActions: state.active.filter((record) => record.departmentId === department.id).length,
      availableActions: actions.filter((action) => action.departmentId === department.id && action.availability.allowed).length,
    };
  });
  return {
    version: MUNICIPAL_ACTIONS_VERSION,
    week: state.week,
    approval: approvalFrom(context),
    finance: {
      treasury,
      committed,
      available: Math.max(0, round(treasury - committed)),
      immediateSpending: round(state.statistics.immediateSpending),
      worksAuthorized: round(state.statistics.worksCommitted),
    },
    totals: {
      catalog: actions.length,
      available: actions.filter((action) => action.availability.allowed).length,
      blocked: actions.filter((action) => !action.availability.allowed).length,
      active: state.active.length,
      completed: state.completed.length,
      hearings: state.hearings.length,
    },
    actions,
    categories,
    departments,
    active: clone(state.active),
    completed: clone(state.completed.slice(0, 40)),
    hearings: clone(state.hearings.slice(0, 20)),
    history: clone(state.history.slice(0, 40)),
    localGovernment: {
      activeWorks: activeNativeWorks(localGovernment).length,
      openProposals: asArray(localGovernment.proposals).filter((proposal) => !["enacted", "rejected", "archived", "withdrawn"].includes(proposal.status)).length,
      activeLaws: asArray(localGovernment.laws).filter((law) => ["promulgated", "in_force"].includes(law.status)).length,
    },
  };
}

/** Aplica com segurança o resultado puro de `executeMunicipalAction` à Simulation. */
export function applyMunicipalActionResultToSimulation(simulation, result) {
  if (!simulation || !result?.ok) throw new Error("Resultado de ação municipal inválido.");
  simulation.municipalActions = clone(result.state);
  simulation.localGovernment = clone(result.localGovernment);
  simulation.money = Math.max(0, finite(result.treasury));
  simulation.governance = clone(result.governance || simulation.governance || {});
  simulation.governance.localGovernment = simulation.localGovernment;
  if (simulation.politics?.state?.approval) {
    const politicalApproval = simulation.politics.state.approval;
    const politicalResult = result.governance?.politics?.approval;
    politicalApproval.previous = clamp(politicalResult?.previous ?? politicalApproval.overall ?? 50);
    politicalApproval.overall = clamp(
      politicalResult?.overall ?? finite(politicalApproval.overall, 50) + finite(result.approval?.delta),
    );
    politicalApproval.trend = round(politicalApproval.overall - politicalApproval.previous, 1);
    simulation.governance.politics = simulation.politics.state;
  }
  if (result.finance?.immediateDebit > 0) {
    simulation.governance.extraordinarySpending = round(
      finite(simulation.governance.extraordinarySpending) + result.finance.immediateDebit,
    );
  }
  if (typeof simulation.publishMunicipalNews === "function") {
    result.newsFacts.forEach((fact) => simulation.publishMunicipalNews(fact));
  }
  if (typeof simulation.log === "function") {
    simulation.log("prefeitura", `${result.action.title} foi autorizada.`, "civic", {
      section: "Política",
      dedupeKey: result.action.id,
      priority: result.definition.approvalImpact >= 4 ? "destaque" : "normal",
    });
  }
  simulation.localGovernmentSummary = getLocalGovernmentSummary(simulation.localGovernment, {
    week: simulation.week,
    people: simulation.people,
    businesses: simulation.businesses,
    politics: simulation.politics?.state,
    governance: simulation.governance,
    treasury: simulation.money,
    city: simulation.city,
  });
  return result.action;
}

/** Atalho voltado à UI: executa e aplica a ação diretamente na simulação. */
export function executeMunicipalActionForSimulation(simulation, actionId, options = {}) {
  if (!simulation) throw new Error("Simulação não informada.");
  const context = {
    week: simulation.week,
    people: simulation.people,
    city: simulation.city,
    treasury: simulation.money,
    money: simulation.money,
    governance: simulation.governance,
    politics: simulation.politics,
    localGovernment: simulation.localGovernment,
    housingSystem: simulation.housingSystem,
    transportSystem: simulation.transportSystem,
    justiceSystem: simulation.justiceSystem,
    healthSystem: simulation.healthSystem,
    educationSystem: simulation.educationSystem,
    environment: simulation.environment,
    urbanManagement: simulation.urbanManagement,
  };
  const result = executeMunicipalAction(simulation.municipalActions, actionId, context, options);
  applyMunicipalActionResultToSimulation(simulation, result);
  return result;
}

export function advanceMunicipalActionsForSimulation(simulation) {
  if (!simulation) throw new Error("Simulação não informada.");
  const result = advanceMunicipalActionsWeek(simulation.municipalActions, {
    week: simulation.week,
    people: simulation.people,
    city: simulation.city,
    treasury: simulation.money,
    governance: simulation.governance,
    politics: simulation.politics,
    localGovernment: simulation.localGovernment,
  });
  simulation.municipalActions = clone(result.state);
  return result;
}

export function serializeMunicipalActions(inputState) {
  return clone(normalizeMunicipalActionsState(inputState));
}

export function deserializeMunicipalActions(snapshot, context = {}) {
  return normalizeMunicipalActionsState(snapshot, context);
}

export const createMunicipalActionsState = (context = {}) => normalizeMunicipalActionsState({}, context);
