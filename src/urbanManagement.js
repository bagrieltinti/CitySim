import {
  authorizeMunicipalPublicWork,
  getLocalGovernmentSummary,
  localGovernmentContextFromSimulation,
} from "./localGovernment.js";
import { municipalProjectSemanticKey } from "./municipalActions.js";

export const URBAN_MANAGEMENT_VERSION = 1;

const ACTIVE_WORK_STATUSES = new Set(["planned", "procurement", "contracting", "executing"]);
const TERMINAL_INTERVENTION_STATUSES = new Set(["completed", "cancelled", "orphaned"]);
const MAX_INTERVENTIONS = 120;
const MAX_HISTORY = 180;
const MAX_DISTRICT_COMPLETIONS = 40;

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));
const round = (value, decimals = 0) => {
  const factor = 10 ** decimals;
  return Math.round((Number(value) || 0) * factor) / factor;
};
const asArray = (value) => (Array.isArray(value) ? value : []);
const clone = (value) => structuredClone(value);
const money = (value) => Math.round(Number(value) || 0);
const average = (values, fallback = 0) => {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : fallback;
};

function effect(domain, target, delta, metadata = null) {
  return { domain, target, operation: "add", delta, reversible: false, metadata };
}

function catalogEntry(definition) {
  return Object.freeze({
    requiresVacantLot: false,
    streetCount: 0,
    tags: [],
    municipalEffects: [],
    districtEffects: {},
    physical: {},
    ...definition,
    tags: Object.freeze([...(definition.tags || [])]),
    municipalEffects: Object.freeze((definition.municipalEffects || []).map((item) => Object.freeze(item))),
    districtEffects: Object.freeze({ ...(definition.districtEffects || {}) }),
    physical: Object.freeze({ ...(definition.physical || {}) }),
  });
}

export const URBAN_INTERVENTION_CATALOG = Object.freeze([
  catalogEntry({
    id: "complete-streets",
    category: "mobility",
    categoryLabel: "Mobilidade",
    name: "Ruas completas e acessíveis",
    description: "Requalifica calçadas, travessias, pavimento, drenagem e arborização no mesmo corredor.",
    departmentId: "mobility",
    workType: "paving",
    baseCost: 78000,
    baseWeeks: 8,
    workersRequired: 9,
    streetCount: 2,
    tags: ["calçadas", "acessibilidade", "segurança viária"],
    municipalEffects: [effect("transport", "roadCapacity", 3), effect("transport", "pedestrianAccessibility", 10)],
    districtEffects: { mobility: 13, accessibility: 16, safety: 5, desirability: 4 },
    physical: { roadCondition: 24, drainage: 10, sidewalk: true, lighting: "completa" },
  }),
  catalogEntry({
    id: "bus-priority-corridor",
    category: "mobility",
    categoryLabel: "Mobilidade",
    name: "Corredor de prioridade ao ônibus",
    description: "Implanta prioridade semafórica, pontos acessíveis e faixa preferencial em um eixo de alta demanda.",
    departmentId: "mobility",
    workType: "paving",
    baseCost: 92000,
    baseWeeks: 10,
    workersRequired: 11,
    streetCount: 1,
    tags: ["ônibus", "pontos", "prioridade semafórica"],
    municipalEffects: [effect("transport", "punctuality", 6), effect("transport", "routeCapacity", 8)],
    districtEffects: { mobility: 16, accessibility: 7, emissions: -4 },
    physical: { roadCondition: 14, sidewalk: true, lighting: "completa" },
  }),
  catalogEntry({
    id: "pedestrian-school-routes",
    category: "mobility",
    categoryLabel: "Mobilidade",
    name: "Rotas escolares caminháveis",
    description: "Conecta moradias e escolas com calçadas contínuas, travessias elevadas e sinalização de baixa velocidade.",
    departmentId: "mobility",
    workType: "paving",
    baseCost: 54000,
    baseWeeks: 6,
    workersRequired: 7,
    streetCount: 2,
    tags: ["escolas", "pedestres", "infância"],
    municipalEffects: [effect("transport", "pedestrianAccessibility", 8), effect("education", "attendanceSupport", 5)],
    districtEffects: { mobility: 8, accessibility: 13, safety: 9 },
    physical: { roadCondition: 8, sidewalk: true, lighting: "completa" },
  }),
  catalogEntry({
    id: "sanitary-sewer-extension",
    category: "sanitation",
    categoryLabel: "Saneamento",
    name: "Extensão da rede de esgoto",
    description: "Universaliza coleta, ligações domiciliares e tratamento sanitário nos lotes ainda descobertos.",
    departmentId: "environment",
    workType: "utilities",
    baseCost: 108000,
    baseWeeks: 12,
    workersRequired: 12,
    tags: ["esgoto", "água", "saúde ambiental"],
    municipalEffects: [effect("housing", "utilityReliability", 8), effect("environment", "sanitationCoverage", 12)],
    districtEffects: { sanitation: 18, health: 7, pollution: -8, infrastructure: 10 },
    physical: { lotServiceLevel: 15, utilities: { water: true, sewer: true } },
  }),
  catalogEntry({
    id: "neighborhood-ecopoint",
    category: "sanitation",
    categoryLabel: "Saneamento",
    name: "Ecoponto e coleta seletiva",
    description: "Cria entrega voluntária de recicláveis, volumosos e resíduos de obras com coleta programada.",
    departmentId: "environment",
    workType: "utilities",
    baseCost: 72000,
    baseWeeks: 8,
    workersRequired: 7,
    requiresVacantLot: true,
    tags: ["reciclagem", "resíduos", "limpeza urbana"],
    municipalEffects: [effect("environment", "wasteRecovery", 10), effect("administration", "wasteCollectionCapacity", 7)],
    districtEffects: { sanitation: 13, pollution: -7, desirability: 3 },
    physical: { lotServiceLevel: 7, utilityCapacity: { waste: 8 } },
  }),
  catalogEntry({
    id: "smart-led-lighting",
    category: "lighting",
    categoryLabel: "Iluminação",
    name: "Iluminação pública LED inteligente",
    description: "Substitui luminárias, cobre pontos escuros e monitora falhas remotamente.",
    departmentId: "environment",
    workType: "utilities",
    baseCost: 46000,
    baseWeeks: 6,
    workersRequired: 6,
    streetCount: 3,
    tags: ["LED", "segurança noturna", "eficiência"],
    municipalEffects: [effect("security", "nighttimeSafety", 8), effect("environment", "energyEfficiency", 5)],
    districtEffects: { lighting: 24, safety: 8, accessibility: 4, desirability: 3 },
    physical: { lighting: "completa" },
  }),
  catalogEntry({
    id: "linear-park",
    category: "parks",
    categoryLabel: "Parques e lazer",
    name: "Parque linear de bairro",
    description: "Combina áreas verdes, caminhada, lazer infantil e recuperação ambiental em um novo parque.",
    departmentId: "environment",
    workType: "public_facility",
    baseCost: 125000,
    baseWeeks: 12,
    workersRequired: 13,
    requiresVacantLot: true,
    tags: ["parque", "lazer", "arborização"],
    municipalEffects: [effect("environment", "greenIndex", 8), effect("health", "preventiveWellbeing", 5)],
    districtEffects: { green: 20, health: 7, drainage: 5, desirability: 8, pollution: -5 },
    physical: { environment: { green: 18, airQuality: 5, noise: -6 } },
  }),
  catalogEntry({
    id: "pocket-parks-network",
    category: "parks",
    categoryLabel: "Parques e lazer",
    name: "Rede de praças de bolso",
    description: "Recupera pequenas áreas para descanso, brincar, convívio e arborização de proximidade.",
    departmentId: "environment",
    workType: "public_facility",
    baseCost: 68000,
    baseWeeks: 7,
    workersRequired: 8,
    requiresVacantLot: true,
    tags: ["praças", "convívio", "infância"],
    municipalEffects: [effect("environment", "greenIndex", 4), effect("administration", "publicFacilityCapacity", 4)],
    districtEffects: { green: 11, health: 4, desirability: 6 },
    physical: { environment: { green: 10, airQuality: 3, noise: -3 } },
  }),
  catalogEntry({
    id: "social-housing-complex",
    category: "housing",
    categoryLabel: "Habitação",
    name: "Conjunto habitacional integrado",
    description: "Produz moradia social ligada a transporte, serviços e espaços comunitários.",
    departmentId: "housing",
    workType: "housing",
    baseCost: 210000,
    baseWeeks: 18,
    workersRequired: 20,
    requiresVacantLot: true,
    tags: ["moradia social", "aluguel acessível", "urbanização"],
    municipalEffects: [effect("housing", "housingCapacity", 24), effect("housing", "affordability", 10)],
    districtEffects: { housing: 22, accessibility: 4, services: 3 },
    physical: { lotServiceLevel: 18, utilities: { water: true, sewer: true, power: true, roadAccess: true } },
  }),
  catalogEntry({
    id: "housing-retrofit",
    category: "housing",
    categoryLabel: "Habitação",
    name: "Requalificação de moradias",
    description: "Corrige riscos, acessibilidade, eficiência energética e salubridade em residências existentes.",
    departmentId: "housing",
    workType: "housing",
    baseCost: 88000,
    baseWeeks: 10,
    workersRequired: 10,
    tags: ["retrofit", "salubridade", "eficiência"],
    municipalEffects: [effect("housing", "safeHousing", 10), effect("housing", "housingCapacity", 6)],
    districtEffects: { housing: 13, sanitation: 5, accessibility: 5, desirability: 5 },
    physical: { homeCondition: 12, homeValuePercent: 3 },
  }),
  catalogEntry({
    id: "microdrainage-upgrade",
    category: "drainage",
    categoryLabel: "Drenagem e resiliência",
    name: "Reforço de microdrenagem",
    description: "Amplia galerias, bocas de lobo e manutenção preventiva nos pontos de alagamento.",
    departmentId: "environment",
    workType: "drainage",
    baseCost: 82000,
    baseWeeks: 9,
    workersRequired: 10,
    streetCount: 3,
    tags: ["alagamento", "galerias", "chuvas"],
    municipalEffects: [effect("environment", "urbanDrainage", 12), effect("environment", "climateResilience", 8)],
    districtEffects: { drainage: 22, resilience: 13, infrastructure: 6, desirability: 3 },
    physical: { drainage: 24, roadCondition: 5 },
  }),
  catalogEntry({
    id: "retention-gardens",
    category: "drainage",
    categoryLabel: "Drenagem e resiliência",
    name: "Jardins de chuva e reservação",
    description: "Retém águas pluviais com soluções naturais e reduz picos de inundação.",
    departmentId: "environment",
    workType: "drainage",
    baseCost: 104000,
    baseWeeks: 12,
    workersRequired: 11,
    requiresVacantLot: true,
    tags: ["jardins de chuva", "reservação", "infraestrutura verde"],
    municipalEffects: [effect("environment", "urbanDrainage", 9), effect("environment", "climateResilience", 11)],
    districtEffects: { drainage: 17, resilience: 18, green: 8, pollution: -3 },
    physical: { drainage: 12, environment: { green: 8, airQuality: 2, noise: -2 } },
  }),
  catalogEntry({
    id: "family-health-unit",
    category: "health_education",
    categoryLabel: "Saúde e educação",
    name: "Unidade de Saúde da Família",
    description: "Amplia atenção básica, prevenção, vacinação e acompanhamento territorial.",
    departmentId: "health",
    workType: "public_facility",
    baseCost: 185000,
    baseWeeks: 16,
    workersRequired: 17,
    requiresVacantLot: true,
    tags: ["UBS", "atenção básica", "prevenção"],
    municipalEffects: [effect("health", "beds", 12), effect("health", "primaryCareCapacity", 32)],
    districtEffects: { health: 24, services: 12, desirability: 5 },
    physical: { lotServiceLevel: 10 },
  }),
  catalogEntry({
    id: "full-time-school",
    category: "health_education",
    categoryLabel: "Saúde e educação",
    name: "Escola municipal em tempo integral",
    description: "Cria novas vagas, contraturno, alimentação e espaços de cultura e esporte.",
    departmentId: "education",
    workType: "public_facility",
    baseCost: 198000,
    baseWeeks: 17,
    workersRequired: 18,
    requiresVacantLot: true,
    tags: ["escola", "tempo integral", "cultura"],
    municipalEffects: [effect("education", "schoolCapacity", 80), effect("education", "quality", 4)],
    districtEffects: { education: 25, services: 12, safety: 3, desirability: 5 },
    physical: { lotServiceLevel: 10 },
  }),
  catalogEntry({
    id: "civic-center-revival",
    category: "revitalization",
    categoryLabel: "Revitalização",
    name: "Revitalização do centro cívico",
    description: "Recupera fachadas, térreos ativos, mobiliário, acessibilidade e permanência no espaço público.",
    departmentId: "housing",
    workType: "public_facility",
    baseCost: 132000,
    baseWeeks: 14,
    workersRequired: 14,
    streetCount: 2,
    tags: ["centro", "fachadas", "espaço público"],
    municipalEffects: [effect("administration", "publicFacilityCapacity", 8), effect("employment", "localCommerce", 6)],
    districtEffects: { revitalization: 20, accessibility: 8, safety: 5, desirability: 12 },
    physical: { roadCondition: 8, sidewalk: true, lighting: "completa", homeValuePercent: 4 },
  }),
  catalogEntry({
    id: "mixed-use-recovery",
    category: "revitalization",
    categoryLabel: "Revitalização",
    name: "Recuperação urbana de uso misto",
    description: "Transforma área subutilizada em moradia, comércio local e equipamentos de proximidade.",
    departmentId: "housing",
    workType: "housing",
    baseCost: 165000,
    baseWeeks: 15,
    workersRequired: 17,
    requiresVacantLot: true,
    tags: ["uso misto", "comércio", "adensamento"],
    municipalEffects: [effect("housing", "housingCapacity", 12), effect("employment", "localCommerce", 8)],
    districtEffects: { revitalization: 17, housing: 10, services: 8, desirability: 10 },
    physical: { lotServiceLevel: 15, utilities: { water: true, sewer: true, power: true, roadAccess: true } },
  }),
]);

const catalogIndex = new Map(URBAN_INTERVENTION_CATALOG.map((item) => [item.id, item]));

function initialUrbanManagementState() {
  return {
    version: URBAN_MANAGEMENT_VERSION,
    sequence: 0,
    interventions: [],
    districtOutcomes: {},
    history: [],
    lastAuditWeek: null,
  };
}

function normalizeOutcome(input = {}) {
  const completedInterventionIds = [...new Set(asArray(input.completedInterventionIds).map(String))].slice(0, MAX_DISTRICT_COMPLETIONS);
  const metrics = {};
  Object.entries(input.metrics || {}).forEach(([key, value]) => {
    if (Number.isFinite(Number(value))) metrics[String(key)] = round(Number(value), 2);
  });
  return { metrics, completedInterventionIds, updatedWeek: Math.max(1, Number(input.updatedWeek || 1)) };
}

function normalizeIntervention(input = {}) {
  return {
    id: String(input.id || "urban-intervention-legacy"),
    catalogId: String(input.catalogId || "unknown"),
    category: String(input.category || "unknown"),
    name: String(input.name || "Intervenção urbana"),
    districtId: input.districtId == null ? null : String(input.districtId),
    targetStreetIds: [...new Set(asArray(input.targetStreetIds).map(String))].slice(0, 8),
    targetLotId: input.targetLotId == null ? null : String(input.targetLotId),
    physicalAssetId: input.physicalAssetId == null ? null : String(input.physicalAssetId),
    semanticProjectId: input.semanticProjectId == null
      ? municipalProjectSemanticKey({ urbanCatalogId: input.catalogId })
      : String(input.semanticProjectId),
    publicWorkId: input.publicWorkId == null ? null : String(input.publicWorkId),
    authorizedWeek: Math.max(1, Number(input.authorizedWeek || 1)),
    expectedWeeks: Math.max(1, Number(input.expectedWeeks || 1)),
    expectedEndWeek: Math.max(1, Number(input.expectedEndWeek || input.authorizedWeek || 1)),
    budget: Math.max(0, money(input.budget)),
    status: String(input.status || "planned"),
    stage: String(input.stage || "design"),
    progress: clamp(input.progress),
    spent: Math.max(0, round(input.spent, 2)),
    effectsApplied: Boolean(input.effectsApplied),
    effectsAppliedWeek: input.effectsAppliedWeek == null ? null : Math.max(1, Number(input.effectsAppliedWeek)),
    history: asArray(input.history).slice(0, 30).map((entry) => ({
      week: Math.max(1, Number(entry?.week || 1)),
      text: String(entry?.text || "Atualização da intervenção."),
    })),
  };
}

export function normalizeUrbanManagementState(input = {}, context = {}) {
  const source = input && typeof input === "object" ? input : {};
  const base = initialUrbanManagementState();
  const districtOutcomes = {};
  Object.entries(source.districtOutcomes || {}).slice(0, 80).forEach(([districtId, outcome]) => {
    districtOutcomes[String(districtId)] = normalizeOutcome(outcome);
  });
  const interventions = asArray(source.interventions).map(normalizeIntervention);
  const active = interventions.filter((item) => !TERMINAL_INTERVENTION_STATUSES.has(item.status));
  const terminal = interventions.filter((item) => TERMINAL_INTERVENTION_STATUSES.has(item.status)).slice(0, Math.max(0, MAX_INTERVENTIONS - active.length));
  return {
    ...base,
    version: URBAN_MANAGEMENT_VERSION,
    sequence: Math.max(0, Number(source.sequence || 0)),
    interventions: [...active, ...terminal].slice(0, MAX_INTERVENTIONS),
    districtOutcomes,
    history: asArray(source.history).slice(0, MAX_HISTORY).map((entry) => ({
      week: Math.max(1, Number(entry?.week || context.week || 1)),
      text: String(entry?.text || "Registro de gestão urbana."),
      interventionId: entry?.interventionId == null ? null : String(entry.interventionId),
      districtId: entry?.districtId == null ? null : String(entry.districtId),
    })),
    lastAuditWeek: source.lastAuditWeek == null ? null : Math.max(1, Number(source.lastAuditWeek)),
  };
}

export function serializeUrbanManagement(inputState = {}) {
  return clone(normalizeUrbanManagementState(inputState));
}

export function deserializeUrbanManagement(snapshot = {}, context = {}) {
  const parsed = typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot;
  return normalizeUrbanManagementState(parsed, context);
}

function districtFor(simulation, districtId) {
  return asArray(simulation?.city?.districts).find((district) => district.id === districtId) || null;
}

function streetTouchesDistrict(street, district) {
  if (!street || !district) return false;
  if (street.axis === "v") return street.at >= district.x && street.at <= district.x + district.w;
  return street.at >= district.y && street.at <= district.y + district.h;
}

function streetsForDistrict(simulation, district) {
  return asArray(simulation?.city?.streets).filter((street) => streetTouchesDistrict(street, district));
}

function availableLotsForDistrict(simulation, districtId, state) {
  const reservedIds = new Set(state.interventions
    .filter((item) => !TERMINAL_INTERVENTION_STATUSES.has(item.status))
    .map((item) => item.targetLotId)
    .filter(Boolean));
  return asArray(simulation?.city?.lots).filter((lot) => {
    const status = lot.status || "urbanized";
    return lot.district === districtId
      && !lot.occupied
      && !lot.reservedForDevelopment
      && !lot.municipalReservationId
      && !reservedIds.has(lot.id)
      && ["urbanized", "ready", "serviced"].includes(status);
  });
}

function activePublicWorks(simulation) {
  return asArray(simulation?.localGovernment?.publicWorks).filter((work) => ACTIVE_WORK_STATUSES.has(work.status));
}

export function getUrbanBudgetPosition(simulation) {
  const treasury = Math.max(0, Number(simulation?.money || 0));
  const activeWorks = activePublicWorks(simulation);
  const committed = activeWorks.reduce((total, work) => total + Math.max(0, Number(work.budget || 0) - Number(work.spent || 0)), 0);
  const weeklySpending = Math.max(0, Number(simulation?.governance?.weeklySpending || 0));
  const safetyReserve = Math.max(25000, weeklySpending * 2);
  return {
    treasury: round(treasury, 2),
    committed: round(committed, 2),
    safetyReserve: round(safetyReserve, 2),
    available: round(Math.max(0, treasury - committed - safetyReserve), 2),
    activeWorks: activeWorks.length,
  };
}

function districtOutcomeMetrics(state, districtId) {
  return state.districtOutcomes[districtId]?.metrics || {};
}

function severity(score) {
  if (score >= 75) return "crítica";
  if (score >= 55) return "alta";
  if (score >= 35) return "moderada";
  return "baixa";
}

function needsFor(metrics) {
  const scores = [
    ["mobility", "Mobilidade", clamp(metrics.congestion * 0.58 + metrics.averageWait * 1.15 + (100 - metrics.roadCondition) * 0.24)],
    ["sanitation", "Saneamento", clamp(100 - metrics.sanitationCoverage)],
    ["lighting", "Iluminação", clamp(100 - metrics.lightingCoverage)],
    ["parks", "Parques e lazer", clamp(100 - metrics.green)],
    ["housing", "Habitação", clamp(Math.max(0, metrics.occupancy - 62) * 1.8 + Math.max(0, 12 - metrics.vacantHomes) * 2)],
    ["drainage", "Drenagem e resiliência", clamp(100 - metrics.drainage)],
    ["health_education", "Saúde e educação", clamp((100 - metrics.healthCoverage) * 0.52 + (100 - metrics.educationCoverage) * 0.48)],
    ["revitalization", "Revitalização", clamp((100 - metrics.desirability) * 0.52 + (100 - metrics.roadCondition) * 0.25 + metrics.commercialVacancy * 0.23)],
  ];
  return scores
    .map(([id, label, score]) => ({ id, label, score: round(score, 1), severity: severity(score) }))
    .sort((left, right) => right.score - left.score);
}

export function getUrbanTerritorialSnapshot(simulation) {
  if (!simulation?.city || !Array.isArray(simulation.city.districts)) {
    return { week: Number(simulation?.week || 1), districts: [], city: {}, needs: [], error: "Cidade ainda não inicializada." };
  }
  const state = normalizeUrbanManagementState(simulation.urbanManagement, { week: simulation.week });
  const buildingIndex = new Map(asArray(simulation.buildings).map((building) => [building.id, building]));
  const alive = asArray(simulation.people).filter((person) => person.alive !== false);
  const activeCases = asArray(simulation.justiceSystem?.openCases).filter((item) => !["arquivado", "absolvido", "condenado"].includes(item.status));
  const districts = simulation.city.districts.map((district) => {
    const buildings = asArray(simulation.buildings).filter((building) => building.districtId === district.id);
    const homes = buildings.filter((building) => building.type === "home");
    const residents = alive.filter((person) => buildingIndex.get(person.homeId)?.districtId === district.id);
    const households = new Set(residents.map((person) => person.householdId || person.familyId).filter(Boolean)).size;
    const lots = asArray(simulation.city.lots).filter((lot) => lot.district === district.id);
    const streets = streetsForDistrict(simulation, district);
    const load = streets.map((street) => Number(simulation.transportSystem?.streetLoad?.[street.id]?.ratio || 0) * 100);
    const routeStops = asArray(simulation.transportSystem?.routes).flatMap((route) => asArray(route.stops));
    const transitStops = routeStops.filter((stop) => Array.isArray(stop)
      && stop[0] >= district.x && stop[0] <= district.x + district.w
      && stop[1] >= district.y && stop[1] <= district.y + district.h).length;
    const environment = simulation.environment?.districts?.[district.id] || {};
    const outcome = districtOutcomeMetrics(state, district.id);
    const capacity = homes.reduce((total, home) => total + Math.max(0, Number(home.capacity || 0)), 0);
    const vacantHomes = homes.filter((home) => Number(home.occupied || 0) < Number(home.capacity || 0)).length;
    const healthFacilities = buildings.filter((building) => building.type === "health").length;
    const schools = buildings.filter((building) => building.type === "school").length;
    const parks = buildings.filter((building) => building.type === "park").length;
    const shops = buildings.filter((building) => building.type === "shop" || building.businessId).length;
    const closedShops = buildings.filter((building) => {
      const business = asArray(simulation.businesses).find((item) => item.buildingId === building.id);
      return business?.closed;
    }).length;
    const lotService = average(lots.map((lot) => Number(lot.serviceLevel || 0)), 70);
    const sanitationBase = lots.length
      ? lots.filter((lot) => lot.infrastructure?.sewer || ["urbanized", "ready", "developed"].includes(lot.status)).length / lots.length * 100
      : 100;
    const lightingBase = streets.length
      ? streets.filter((street) => street.lighting === "completa").length / streets.length * 100
      : 100;
    const roadConditionBase = average(streets.map((street) => Number(street.condition || 0)), 70);
    const drainageBase = average(streets.map((street) => Number(street.drainage || 0)), 70);
    const greenBase = Number(environment.green ?? (parks ? 38 + parks * 18 : 24));
    const crimeCount = activeCases.filter((item) => buildingIndex.get(item.locationId)?.districtId === district.id).length;
    const desirabilityBase = Number(simulation.urbanEvolution?.districtMetrics?.[district.id]?.desirability || 58);
    const healthCoverageBase = clamp(35 + healthFacilities * 24 + Math.min(20, Number(simulation.healthSystem?.primaryCareCapacity || 0) / Math.max(1, alive.length) * 100));
    const children = residents.filter((person) => person.age < 18).length;
    const educationCoverageBase = clamp(40 + schools * 24 + Math.min(18, Number(simulation.educationSystem?.schoolCapacity || 0) / Math.max(1, children || residents.length) * 4));
    const metrics = {
      population: residents.length,
      households,
      housingCapacity: capacity,
      occupancy: round(capacity ? residents.length / capacity * 100 : 0, 1),
      vacantHomes,
      averageHomeValue: homes.length ? money(average(homes.map((home) => Number(home.value || 0)))) : 0,
      businesses: shops,
      services: buildings.filter((building) => ["civic", "health", "school", "park"].includes(building.type)).length,
      parks,
      healthFacilities,
      schools,
      transitStops,
      congestion: round(clamp(average(load, Number(simulation.transportSystem?.congestionIndex || 0) * 100)), 1),
      averageWait: round(Number(simulation.transportSystem?.averageWait || 0), 1),
      roadCondition: round(clamp(roadConditionBase + Number(outcome.mobility || 0) * 0.35 + Number(outcome.infrastructure || 0) * 0.25), 1),
      sanitationCoverage: round(clamp(sanitationBase + Number(outcome.sanitation || 0)), 1),
      lightingCoverage: round(clamp(lightingBase + Number(outcome.lighting || 0)), 1),
      drainage: round(clamp(drainageBase + Number(outcome.drainage || 0)), 1),
      infrastructure: round(clamp(lotService + Number(outcome.infrastructure || 0)), 1),
      green: round(clamp(greenBase + Number(outcome.green || 0)), 1),
      airQuality: round(clamp(Number(environment.airQuality || simulation.environment?.cityAirQuality || 75) - Number(outcome.pollution || 0)), 1),
      noise: round(clamp(Number(environment.noise || 35)), 1),
      crimeCount,
      safety: round(clamp(72 - crimeCount * 7 + Number(outcome.safety || 0)), 1),
      healthCoverage: round(clamp(healthCoverageBase + Number(outcome.health || 0)), 1),
      educationCoverage: round(clamp(educationCoverageBase + Number(outcome.education || 0)), 1),
      desirability: round(clamp(desirabilityBase + Number(outcome.desirability || 0) + Number(outcome.revitalization || 0) * 0.35), 1),
      commercialVacancy: round(shops ? closedShops / shops * 100 : 0, 1),
      availableLots: availableLotsForDistrict(simulation, district.id, state).length,
    };
    const needs = needsFor(metrics);
    const urbanIndex = round(clamp(average([
      metrics.roadCondition,
      metrics.sanitationCoverage,
      metrics.lightingCoverage,
      metrics.drainage,
      metrics.green,
      metrics.safety,
      metrics.healthCoverage,
      metrics.educationCoverage,
      metrics.desirability,
    ])), 1);
    const interventions = state.interventions.filter((item) => item.districtId === district.id && !TERMINAL_INTERVENTION_STATUSES.has(item.status));
    const publicWorks = activePublicWorks(simulation).filter((work) => work.districtId === district.id);
    return {
      id: district.id,
      name: district.name,
      status: district.status || "active",
      urbanIndex,
      metrics,
      needs,
      priority: needs[0] || null,
      activeInterventions: interventions.map((item) => ({ id: item.id, catalogId: item.catalogId, name: item.name, status: item.status, progress: item.progress })),
      publicWorks: publicWorks.map((work) => ({ id: work.id, name: work.name, stage: work.stage, progress: work.progress, budget: work.budget })),
    };
  });
  const cityNeeds = needsFor({
    congestion: average(districts.map((item) => item.metrics.congestion)),
    averageWait: average(districts.map((item) => item.metrics.averageWait)),
    roadCondition: average(districts.map((item) => item.metrics.roadCondition)),
    sanitationCoverage: average(districts.map((item) => item.metrics.sanitationCoverage)),
    lightingCoverage: average(districts.map((item) => item.metrics.lightingCoverage)),
    green: average(districts.map((item) => item.metrics.green)),
    occupancy: average(districts.map((item) => item.metrics.occupancy)),
    vacantHomes: districts.reduce((total, item) => total + item.metrics.vacantHomes, 0),
    drainage: average(districts.map((item) => item.metrics.drainage)),
    healthCoverage: average(districts.map((item) => item.metrics.healthCoverage)),
    educationCoverage: average(districts.map((item) => item.metrics.educationCoverage)),
    desirability: average(districts.map((item) => item.metrics.desirability)),
    commercialVacancy: average(districts.map((item) => item.metrics.commercialVacancy)),
  });
  return {
    week: Number(simulation.week || 1),
    districts,
    city: {
      urbanIndex: round(average(districts.map((district) => district.urbanIndex)), 1),
      population: alive.length,
      activeInterventions: state.interventions.filter((item) => !TERMINAL_INTERVENTION_STATUSES.has(item.status)).length,
      completedInterventions: state.interventions.filter((item) => item.status === "completed").length,
      budget: getUrbanBudgetPosition(simulation),
    },
    needs: cityNeeds,
  };
}

function interventionScale(simulation, districtSnapshot) {
  const populationShare = districtSnapshot.metrics.population / Math.max(1, asArray(simulation.people).filter((person) => person.alive !== false).length);
  const pressure = districtSnapshot.priority?.score || 40;
  return clamp(0.86 + populationShare * 0.35 + pressure * 0.0015, 0.85, 1.18);
}

function selectTargetStreets(simulation, district, entry, preferredStreetId) {
  if (!entry.streetCount) return [];
  const candidates = streetsForDistrict(simulation, district);
  const preferred = preferredStreetId && candidates.find((street) => street.id === preferredStreetId);
  const score = (street) => {
    if (entry.category === "lighting") return street.lighting === "completa" ? 100 : street.lighting === "parcial" ? 45 : 0;
    if (entry.category === "drainage") return Number(street.drainage || 0);
    return Number(street.condition || 0);
  };
  const ordered = candidates.filter((street) => street !== preferred).sort((left, right) => score(left) - score(right));
  return [...(preferred ? [preferred] : []), ...ordered].slice(0, entry.streetCount);
}

export function evaluateUrbanIntervention(simulation, catalogId, options = {}) {
  const entry = catalogIndex.get(catalogId);
  const reasons = [];
  if (!entry) return { eligible: false, reasons: ["Intervenção urbana desconhecida."], catalogId };
  const districtId = options.districtId || simulation?.city?.districts?.[0]?.id || null;
  const district = districtFor(simulation, districtId);
  if (!district) reasons.push("Selecione um bairro válido.");
  if (district && district.status && !["active", "construction"].includes(district.status)) reasons.push("O bairro ainda não está liberado para esta intervenção.");
  const state = normalizeUrbanManagementState(simulation?.urbanManagement, { week: simulation?.week });
  const duplicate = state.interventions.some((item) => item.catalogId === catalogId
    && item.districtId === districtId
    && !TERMINAL_INTERVENTION_STATUSES.has(item.status));
  const semanticProjectId = municipalProjectSemanticKey({ urbanCatalogId: catalogId });
  const localDuplicate = asArray(simulation?.localGovernment?.publicWorks).some((work) => (work.urbanCatalogId === catalogId
    || (semanticProjectId && municipalProjectSemanticKey(work) === semanticProjectId))
    && work.districtId === districtId
    && ACTIVE_WORK_STATUSES.has(work.status));
  const municipalDuplicate = semanticProjectId && asArray(simulation?.municipalActions?.active).some((action) =>
    municipalProjectSemanticKey(action) === semanticProjectId
    && action.districtId === districtId
    && !["completed", "cancelled", "orphaned"].includes(action.status));
  if (duplicate || localDuplicate || municipalDuplicate) reasons.push("Uma obra equivalente já está ativa no bairro.");
  const snapshot = getUrbanTerritorialSnapshot(simulation);
  const districtSnapshot = snapshot.districts.find((item) => item.id === districtId) || null;
  const scale = districtSnapshot ? interventionScale(simulation, districtSnapshot) : 1;
  const cost = Math.max(1000, Math.round(entry.baseCost * scale / 100) * 100);
  const weeks = Math.max(2, Math.round(entry.baseWeeks * (0.94 + (districtSnapshot?.priority?.score || 40) * 0.0015)));
  const budget = getUrbanBudgetPosition(simulation);
  if (Number(simulation?.money || 0) < 0) reasons.push("O tesouro municipal está negativo.");
  if (cost > budget.available) reasons.push(`Faltam R$ ${money(cost - budget.available).toLocaleString("pt-BR")} de margem fiscal após compromissos e reserva.`);
  const activeOwn = state.interventions.filter((item) => !TERMINAL_INTERVENTION_STATUSES.has(item.status)).length;
  if (activeOwn >= 12) reasons.push("A Prefeitura atingiu o limite de 12 intervenções urbanas simultâneas.");
  const localLimit = Number(simulation?.localGovernment?.config?.publicWorkLimit || 120);
  if (activePublicWorks(simulation).length >= localLimit) reasons.push("A Prefeitura atingiu o limite configurado de obras simultâneas.");
  const availableLots = district ? availableLotsForDistrict(simulation, districtId, state) : [];
  if (entry.requiresVacantLot && !availableLots.length) reasons.push("Não há terreno urbanizado livre e sem reserva neste bairro.");
  const streets = district ? selectTargetStreets(simulation, district, entry, options.streetId) : [];
  if (entry.streetCount && !streets.length) reasons.push("Não há via compatível no bairro selecionado.");
  const categoryNeed = districtSnapshot?.needs.find((item) => item.id === entry.category) || null;
  return {
    eligible: reasons.length === 0,
    reasons,
    catalogId,
    districtId,
    cost,
    weeks,
    expectedEndWeek: Number(simulation?.week || 1) + weeks + 2,
    budget,
    targetStreetIds: streets.map((street) => street.id),
    targetLotId: entry.requiresVacantLot ? availableLots[0]?.id || null : null,
    need: categoryNeed,
    impacts: clone(entry.districtEffects),
  };
}

export function getUrbanInterventionCatalog(simulation, options = {}) {
  return URBAN_INTERVENTION_CATALOG.map((entry) => {
    const evaluation = evaluateUrbanIntervention(simulation, entry.id, options);
    return {
      ...clone(entry),
      ...evaluation,
      display: {
        cost: `R$ ${money(evaluation.cost).toLocaleString("pt-BR")}`,
        duration: `${evaluation.weeks} semana${evaluation.weeks === 1 ? "" : "s"}`,
        status: evaluation.eligible ? "Disponível" : evaluation.reasons[0],
      },
    };
  });
}

export function planUrbanIntervention(simulation, catalogId, options = {}) {
  const entry = catalogIndex.get(catalogId);
  const evaluation = evaluateUrbanIntervention(simulation, catalogId, options);
  if (!entry || !evaluation.eligible) return { ok: false, evaluation, plan: null };
  const district = districtFor(simulation, evaluation.districtId);
  const streets = evaluation.targetStreetIds.map((id) => simulation.city.streets.find((street) => street.id === id)).filter(Boolean);
  const state = normalizeUrbanManagementState(simulation.urbanManagement, { week: simulation.week });
  const id = `urban-intervention-${state.sequence + 1}`;
  const address = streets.length ? streets.map((street) => street.name).join(" · ") : district.name;
  const workInput = {
    type: entry.workType,
    name: `${entry.name} — ${district.name}`,
    departmentId: entry.departmentId,
    districtId: district.id,
    address,
    budget: evaluation.cost,
    expectedWeeks: evaluation.weeks,
    workersRequired: entry.workersRequired,
    lengthKm: entry.streetCount ? round(Math.max(0.5, entry.streetCount * 0.8), 1) : undefined,
    capacity: entry.category === "housing" ? Number(entry.municipalEffects.find((item) => item.target === "housingCapacity")?.delta || 0) : undefined,
    completionEffects: clone(entry.municipalEffects),
    cause: evaluation.need
      ? `${evaluation.need.label.toLowerCase()} é prioridade ${evaluation.need.severity} no diagnóstico territorial de ${district.name}`
      : `demanda territorial identificada em ${district.name}`,
  };
  const record = normalizeIntervention({
    id,
    catalogId,
    category: entry.category,
    name: entry.name,
    districtId: district.id,
    targetStreetIds: evaluation.targetStreetIds,
    targetLotId: evaluation.targetLotId,
    semanticProjectId: municipalProjectSemanticKey({ urbanCatalogId: catalogId }),
    authorizedWeek: Number(simulation.week || 1),
    expectedWeeks: evaluation.weeks,
    expectedEndWeek: evaluation.expectedEndWeek,
    budget: evaluation.cost,
    status: "planned",
    stage: "design",
    history: [{ week: Number(simulation.week || 1), text: "Intervenção priorizada pelo diagnóstico urbano e preparada para autorização." }],
  });
  return {
    ok: true,
    evaluation,
    plan: {
      id,
      intervention: record,
      workInput,
      mutation: {
        target: "simulation",
        operation: "authorizeMunicipalPublicWork",
        stateKey: "urbanManagement",
        localGovernmentStateKey: "localGovernment",
        reservesLotId: evaluation.targetLotId,
      },
    },
  };
}

export function applyUrbanIntervention(simulation, catalogId, options = {}) {
  if (!simulation || typeof simulation !== "object") {
    return { ok: false, error: "Simulação inválida.", evaluation: { eligible: false, reasons: ["Simulação inválida."] } };
  }
  if (!simulation.localGovernment) {
    return { ok: false, error: "Prefeitura ainda não inicializada.", evaluation: { eligible: false, reasons: ["Prefeitura ainda não inicializada."] } };
  }
  const planned = planUrbanIntervention(simulation, catalogId, options);
  if (!planned.ok) return planned;
  try {
    const currentState = normalizeUrbanManagementState(simulation.urbanManagement, { week: simulation.week });
    const result = authorizeMunicipalPublicWork(
      simulation.localGovernment,
      planned.plan.workInput,
      localGovernmentContextFromSimulation(simulation),
    );
    const work = result.state.publicWorks.find((item) => item.id === result.work.id);
    if (!work) throw new Error("A obra autorizada não foi localizada no cadastro municipal.");
    work.urbanInterventionId = planned.plan.id;
    work.urbanCatalogId = catalogId;
    work.semanticProjectId = municipalProjectSemanticKey({ urbanCatalogId: catalogId });
    work.streetId = planned.plan.intervention.targetStreetIds[0] || null;
    work.targetStreetIds = [...planned.plan.intervention.targetStreetIds];
    work.targetLotId = planned.plan.intervention.targetLotId;
    const record = normalizeIntervention({
      ...planned.plan.intervention,
      publicWorkId: work.id,
      expectedEndWeek: work.expectedEndWeek,
      status: work.status,
      stage: work.stage,
    });
    currentState.sequence += 1;
    currentState.interventions.unshift(record);
    currentState.interventions = currentState.interventions.slice(0, MAX_INTERVENTIONS);
    currentState.history.unshift({
      week: Number(simulation.week || 1),
      text: `${record.name} foi autorizada em ${districtFor(simulation, record.districtId)?.name || "bairro municipal"}.`,
      interventionId: record.id,
      districtId: record.districtId,
    });
    currentState.history = currentState.history.slice(0, MAX_HISTORY);
    const lot = record.targetLotId && simulation.city?.lots?.find((item) => item.id === record.targetLotId);
    if (lot) {
      lot.reservedForDevelopment = true;
      lot.municipalReservationId = record.id;
    }
    simulation.localGovernment = result.state;
    simulation.urbanManagement = currentState;
    if (simulation.governance) simulation.governance.localGovernment = simulation.localGovernment;
    simulation.localGovernmentSummary = getLocalGovernmentSummary(
      simulation.localGovernment,
      localGovernmentContextFromSimulation(simulation),
    );
    if (typeof simulation.syncMunicipalPublicWorks === "function") simulation.syncMunicipalPublicWorks();
    if (typeof simulation.publishMunicipalNews === "function") result.newsFacts.forEach((fact) => simulation.publishMunicipalNews(fact));
    return {
      ok: true,
      intervention: clone(record),
      work: clone(work),
      decision: clone(result.decision),
      newsFacts: clone(result.newsFacts),
      evaluation: planned.evaluation,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), evaluation: planned.evaluation };
  }
}

function assetSpecification(entry) {
  if (entry.id === "family-health-unit") return { type: "health", capacity: 40, floors: 2, label: "Unidade de Saúde da Família" };
  if (entry.id === "full-time-school") return { type: "school", capacity: 80, floors: 2, label: "Escola Municipal de Tempo Integral" };
  if (["linear-park", "pocket-parks-network", "retention-gardens"].includes(entry.id)) {
    return { type: "park", capacity: entry.id === "linear-park" ? 70 : 42, floors: 1, label: entry.name };
  }
  if (["social-housing-complex", "mixed-use-recovery"].includes(entry.id)) {
    const capacity = Number(entry.municipalEffects.find((item) => item.target === "housingCapacity")?.delta || 12);
    return { type: "home", capacity: Math.max(4, capacity), floors: 3, label: entry.name };
  }
  if (entry.id === "neighborhood-ecopoint") return { type: "civic", capacity: 24, floors: 1, label: "Ecoponto Municipal" };
  return { type: "civic", capacity: 24, floors: 1, label: entry.name };
}

function municipalAssetSpaces(buildingId, type, capacity, floors) {
  const layouts = {
    park: [["access", "Acessos", .12], ["leisure", "Lazer e atividades", .5], ["social", "Convivência", .38]],
    health: [["reception", "Recepção", .12], ["waiting", "Sala de espera", .2], ["care", "Consultórios e atendimento", .5], ["staff", "Equipe de saúde", .18]],
    school: [["reception", "Entrada", .08], ["classroom", "Salas de aula", .62], ["social", "Pátio e convivência", .2], ["staff", "Equipe escolar", .1]],
    home: [["living", "Convivência", .2], ["kitchen", "Cozinha comunitária", .12], ["bedroom", "Unidades residenciais", .58], ["service", "Apoio", .1]],
    civic: [["access", "Atendimento", .2], ["service", "Operação municipal", .55], ["social", "Área pública", .25]],
  };
  const layout = layouts[type] || layouts.civic;
  let allocated = 0;
  return layout.map(([kind, name, share], index) => {
    const roomCapacity = index === layout.length - 1
      ? Math.max(1, capacity - allocated)
      : Math.max(1, Math.round(capacity * share));
    allocated += roomCapacity;
    return {
      id: `${buildingId}:${kind}`,
      kind,
      name,
      floor: Math.min(floors, 1 + Math.floor(index / 2)),
      capacity: roomCapacity,
      occupants: [],
    };
  });
}

function nearestStreetToLot(simulation, lot) {
  const centerX = Number(lot.x || 0) + Number(lot.w || 1) / 2;
  const centerY = Number(lot.y || 0) + Number(lot.h || 1) / 2;
  return asArray(simulation.city?.streets).slice().sort((left, right) => {
    const leftDistance = left.axis === "v" ? Math.abs(Number(left.at) - centerX) : Math.abs(Number(left.at) - centerY);
    const rightDistance = right.axis === "v" ? Math.abs(Number(right.at) - centerX) : Math.abs(Number(right.at) - centerY);
    return leftDistance - rightDistance;
  })[0] || null;
}

function materializeUrbanAsset(simulation, intervention, entry) {
  if (!intervention.targetLotId || !entry.requiresVacantLot) return null;
  const lot = asArray(simulation.city?.lots).find((item) => item.id === intervention.targetLotId);
  if (!lot) return null;
  const buildingId = intervention.physicalAssetId || `municipal-asset-${intervention.id}`;
  const existing = asArray(simulation.buildings).find((building) =>
    building.id === buildingId || building.urbanInterventionId === intervention.id);
  if (existing) {
    intervention.physicalAssetId = existing.id;
    lot.occupied = true;
    lot.status = "developed";
    lot.municipalAssetId = existing.id;
    return existing;
  }
  const occupyingBuilding = asArray(simulation.buildings).find((building) => building.lotId === lot.id);
  if (lot.occupied && occupyingBuilding) {
    intervention.physicalAssetId = occupyingBuilding.id;
    lot.municipalAssetId ||= occupyingBuilding.id;
    return occupyingBuilding;
  }

  const specification = assetSpecification(entry);
  const margin = .22;
  const width = Math.max(.7, Math.min(Number(lot.w || 1) - margin * 2, specification.type === "park" ? 3.2 : 2.4));
  const height = Math.max(.7, Math.min(Number(lot.h || 1) - margin * 2, specification.type === "park" ? 2.7 : 3.1));
  const x = Number(lot.x || 0) + Math.max(margin, (Number(lot.w || width) - width) / 2);
  const y = Number(lot.y || 0) + Math.max(margin, (Number(lot.h || height) - height) / 2);
  const street = nearestStreetToLot(simulation, lot);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const access = street?.axis === "v"
    ? { x: Number(street.at), y: centerY }
    : street?.axis === "h"
      ? { x: centerX, y: Number(street.at) }
      : { x: centerX, y: y + height };
  const district = districtFor(simulation, intervention.districtId);
  const area = Math.max(60, Math.round(Number(lot.area || width * height * 100) * .72));
  const home = specification.type === "home";
  const building = {
    id: buildingId,
    name: `${specification.label} — ${district?.name || "Vila Esperança"}`,
    type: specification.type,
    capacity: specification.capacity,
    occupied: 0,
    x,
    y,
    w: width,
    h: height,
    lotId: lot.id,
    districtId: intervention.districtId,
    lotArea: Number(lot.area || area),
    frontage: Number(lot.frontage || width),
    terrainSlope: Number(lot.slope || 0),
    address: {
      streetId: street?.id || null,
      street: street?.name || "Via municipal",
      number: 100 + (Number(lot.row || 0) * 37 + Number(lot.col || 0) * 19 + Number(simulation.week || 1)) % 890,
      district: district?.name || "Vila Esperança",
      postalCode: `129${String(10 + Math.abs(Number(lot.row || 0) * 7 + Number(lot.col || 0)) % 80).padStart(2, "0")}-000`,
      accessSurface: street?.surface || "asfalto",
    },
    floors: specification.floors,
    spaces: municipalAssetSpaces(buildingId, specification.type, specification.capacity, specification.floors),
    access,
    propertyType: home ? "Moradia pública municipal" : "Equipamento público municipal",
    propertyTypeId: home ? "predio_residencial" : "comercial",
    condition: 100,
    area,
    yearBuilt: 2026 + Math.floor(Math.max(0, Number(simulation.week || 1) - 1) / 52),
    value: Number(intervention.budget || entry.baseCost || 0),
    rent: 0,
    units: home ? Math.max(1, Math.ceil(specification.capacity / 4)) : 1,
    tenure: home ? "public" : null,
    ownerId: null,
    amenities: ["accessible", "municipal"],
    property: {
      typeId: home ? "predio_residencial" : "loja",
      area,
      bedrooms: home ? Math.max(1, Math.ceil(specification.capacity / 3)) : 0,
      bathrooms: Math.max(1, Math.ceil(specification.capacity / 16)),
      condition: 100,
      furnished: true,
      parkingSpaces: specification.type === "park" ? 0 : 2,
      ownerKind: "municipality",
      ownerId: "prefeitura-vila-esperanca",
      occupiedById: null,
      occupiedByIds: [],
      listingId: null,
      vacancyWeeks: 0,
      improvements: [{ id: intervention.id, week: Number(simulation.week || 1), label: entry.name }],
    },
    meter: { water: 0, power: 0, waste: 0, bill: 0, connected: true, outages: 0, lastReading: 0 },
    municipalAsset: true,
    urbanInterventionId: intervention.id,
    publicWorkId: intervention.publicWorkId,
    openedWeek: Number(simulation.week || 1),
  };
  simulation.buildings.push(building);
  intervention.physicalAssetId = building.id;
  lot.occupied = true;
  lot.status = "developed";
  lot.municipalAssetId = building.id;
  lot.municipalInterventionId = intervention.id;
  if (typeof simulation.refreshWorldIndexes === "function") simulation.refreshWorldIndexes();
  return building;
}

function applyPhysicalCompletion(simulation, state, intervention, entry, physicalAsset = null) {
  const district = districtFor(simulation, intervention.districtId);
  if (!district) return;
  const physical = entry.physical || {};
  const representedMetrics = new Set();
  const streets = intervention.targetStreetIds
    .map((id) => simulation.city.streets.find((street) => street.id === id))
    .filter(Boolean);
  streets.forEach((street) => {
    if (physical.roadCondition) {
      street.condition = clamp(Number(street.condition || 0) + physical.roadCondition);
      representedMetrics.add("mobility");
    }
    if (physical.drainage) {
      street.drainage = clamp(Number(street.drainage || 0) + physical.drainage);
      representedMetrics.add("drainage");
    }
    if (physical.sidewalk) street.sidewalk = true;
    if (physical.lighting) {
      street.lighting = physical.lighting;
      representedMetrics.add("lighting");
    }
    street.urbanInterventions ||= [];
    if (!street.urbanInterventions.includes(intervention.id)) street.urbanInterventions.unshift(intervention.id);
    street.urbanInterventions = street.urbanInterventions.slice(0, 12);
  });
  const targetLots = intervention.targetLotId
    ? simulation.city.lots.filter((lot) => lot.id === intervention.targetLotId)
    : simulation.city.lots.filter((lot) => lot.district === intervention.districtId);
  targetLots.forEach((lot) => {
    if (physical.lotServiceLevel) {
      lot.serviceLevel = clamp(Number(lot.serviceLevel || 0) + physical.lotServiceLevel);
      representedMetrics.add("infrastructure");
    }
    if (physical.utilities) {
      lot.infrastructure = { ...(lot.infrastructure || {}), ...physical.utilities };
      if (physical.utilities.sewer) representedMetrics.add("sanitation");
    }
    lot.municipalImprovements ||= [];
    if (!lot.municipalImprovements.includes(intervention.id)) lot.municipalImprovements.unshift(intervention.id);
    lot.municipalImprovements = lot.municipalImprovements.slice(0, 12);
  });
  if (physical.utilityCapacity && simulation.infrastructure?.systems) {
    Object.entries(physical.utilityCapacity).forEach(([systemId, percent]) => {
      const system = simulation.infrastructure.systems[systemId];
      if (system) system.capacity = round(Number(system.capacity || 0) * (1 + Number(percent || 0) / 100), 2);
    });
  }
  const homes = asArray(simulation.buildings).filter((building) => building.type === "home" && building.districtId === intervention.districtId);
  homes.forEach((home) => {
    if (physical.homeCondition) home.condition = clamp(Number(home.condition ?? 70) + physical.homeCondition);
    if (physical.homeValuePercent) home.value = money(Number(home.value || 0) * (1 + physical.homeValuePercent / 100));
  });
  if (physical.environment) {
    simulation.environment ||= {};
    simulation.environment.districts ||= {};
    const environmental = simulation.environment.districts[intervention.districtId] ||= {};
    if (physical.environment.green) {
      const greenDelta = Number(entry.districtEffects?.green ?? physical.environment.green);
      environmental.green = clamp(Number(environmental.green || 0) + greenDelta);
      representedMetrics.add("green");
    }
    if (physical.environment.airQuality) {
      environmental.airQuality = clamp(Number(environmental.airQuality || 0) + physical.environment.airQuality);
      representedMetrics.add("pollution");
    }
    if (physical.environment.noise) environmental.noise = clamp(Number(environmental.noise || 0) + physical.environment.noise);
  }
  if (physicalAsset?.type === "health") representedMetrics.add("health");
  if (physicalAsset?.type === "school") representedMetrics.add("education");
  if (physicalAsset?.type === "home") representedMetrics.add("housing");
  if (physicalAsset?.type === "park") representedMetrics.add("green");
  const outcome = state.districtOutcomes[intervention.districtId] ||= normalizeOutcome({ updatedWeek: simulation.week });
  Object.entries(entry.districtEffects || {}).forEach(([key, value]) => {
    if (representedMetrics.has(key)) return;
    outcome.metrics[key] = round(Number(outcome.metrics[key] || 0) + Number(value || 0), 2);
  });
  if (!outcome.completedInterventionIds.includes(intervention.id)) outcome.completedInterventionIds.unshift(intervention.id);
  outcome.completedInterventionIds = outcome.completedInterventionIds.slice(0, MAX_DISTRICT_COMPLETIONS);
  outcome.updatedWeek = Number(simulation.week || 1);
}

function releaseMunicipalLot(simulation, intervention) {
  if (!intervention.targetLotId) return;
  const lot = simulation.city?.lots?.find((item) => item.id === intervention.targetLotId);
  if (!lot || lot.municipalReservationId !== intervention.id) return;
  lot.reservedForDevelopment = false;
  delete lot.municipalReservationId;
}

export function synchronizeUrbanManagement(simulation) {
  if (!simulation || typeof simulation !== "object") return normalizeUrbanManagementState();
  const state = normalizeUrbanManagementState(simulation.urbanManagement, { week: simulation.week });
  const workIndex = new Map(asArray(simulation.localGovernment?.publicWorks).map((work) => [work.id, work]));
  state.interventions.forEach((intervention) => {
    if (!intervention.publicWorkId) return;
    const work = workIndex.get(intervention.publicWorkId);
    if (!work) {
      if (!TERMINAL_INTERVENTION_STATUSES.has(intervention.status)) {
        intervention.status = "orphaned";
        intervention.stage = "missing_public_work";
        intervention.history.unshift({ week: Number(simulation.week || 1), text: "Cadastro da obra municipal não foi encontrado; intervenção encerrada com segurança." });
        releaseMunicipalLot(simulation, intervention);
      }
      return;
    }
    intervention.status = work.status;
    intervention.stage = work.stage;
    intervention.progress = clamp(work.progress);
    intervention.spent = Math.max(0, round(work.spent, 2));
    intervention.expectedEndWeek = Math.max(1, Number(work.expectedEndWeek || intervention.expectedEndWeek));
    if (work.status === "completed") {
      const entry = catalogIndex.get(intervention.catalogId);
      const physicalAsset = entry?.requiresVacantLot
        ? materializeUrbanAsset(simulation, intervention, entry)
        : null;
      if (!intervention.effectsApplied) {
        if (entry) applyPhysicalCompletion(simulation, state, intervention, entry, physicalAsset);
        intervention.effectsApplied = true;
        intervention.effectsAppliedWeek = Number(simulation.week || 1);
        intervention.history.unshift({ week: Number(simulation.week || 1), text: "Entrega incorporada ao diagnóstico e aos ativos urbanos do bairro." });
        state.history.unshift({
          week: Number(simulation.week || 1),
          text: `${intervention.name} foi entregue e seus efeitos territoriais entraram em operação.`,
          interventionId: intervention.id,
          districtId: intervention.districtId,
        });
      }
      releaseMunicipalLot(simulation, intervention);
    } else if (work.status === "cancelled") {
      releaseMunicipalLot(simulation, intervention);
    }
    intervention.history = intervention.history.slice(0, 30);
  });
  state.history = state.history.slice(0, MAX_HISTORY);
  state.lastAuditWeek = Number(simulation.week || 1);
  simulation.urbanManagement = state;
  return clone(state);
}

export function getUrbanManagementDashboard(simulation, options = {}) {
  if (options.synchronize !== false) synchronizeUrbanManagement(simulation);
  const territorial = getUrbanTerritorialSnapshot(simulation);
  const districtId = options.districtId || territorial.districts[0]?.id || null;
  const state = normalizeUrbanManagementState(simulation?.urbanManagement, { week: simulation?.week });
  return {
    version: URBAN_MANAGEMENT_VERSION,
    week: Number(simulation?.week || 1),
    selectedDistrictId: districtId,
    territorial,
    interventions: getUrbanInterventionCatalog(simulation, { districtId }),
    portfolio: state.interventions.map((item) => ({
      ...clone(item),
      districtName: districtFor(simulation, item.districtId)?.name || "Cidade inteira",
      remainingBudget: round(Math.max(0, item.budget - item.spent), 2),
      remainingWeeks: Math.max(0, item.expectedEndWeek - Number(simulation?.week || 1)),
    })),
    budget: getUrbanBudgetPosition(simulation),
    history: clone(state.history),
  };
}
