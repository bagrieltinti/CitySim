/**
 * CityDynamics
 *
 * Diretor puro de ritmo da cidade. Ele observa atividade e gargalos, calcula
 * quanta iniciativa a cidade precisa e propõe impulsos para os sistemas
 * responsáveis executarem. Um impulso é sempre uma intenção (nunca um
 * resultado consumado): este módulo não abre vagas, cura moradores, resolve
 * crimes nem movimenta dinheiro sozinho.
 *
 * Todas as saídas são serializáveis e nenhum snapshot/estado recebido é
 * alterado. O desempate é estável por padrão; `options.random` permite injetar
 * uma fonte pseudoaleatória determinística da simulação.
 */

export const CITY_DYNAMICS_VERSION = 1;

export const CITY_DYNAMICS_CADENCES = Object.freeze({
  DAILY: "daily",
  WEEKLY: "weekly",
});

export const CITY_DYNAMICS_LIMITS = Object.freeze({
  recentImpulses: 48,
  historyCycles: 56,
  targetIds: 8,
  dailyImpulses: 2,
  weeklyImpulses: 3,
  impulsesPerWeek: 5,
  impulsesPerCategoryWeek: 2,
});

export const CITY_DYNAMICS_SIGNAL_LABELS = Object.freeze({
  silence: "silêncio no diário",
  lowInteraction: "baixa interação social",
  commerce: "pressão no comércio",
  employment: "pressão no emprego",
  mobility: "pressão na mobilidade",
  health: "pressão na saúde",
  safety: "pressão na segurança",
  population: "pressão populacional e habitacional",
});

const freezeCatalogEntry = (entry) =>
  Object.freeze({
    ...entry,
    triggers: Object.freeze({ ...entry.triggers }),
    expectedSignals: Object.freeze([...entry.expectedSignals]),
  });

/** Catálogo declarativo; a integração decide como materializar cada proposta. */
export const CITY_IMPULSE_CATALOG = Object.freeze([
  freezeCatalogEntry({
    type: "community_meetup",
    label: "Encontro comunitário de bairro",
    category: "social",
    targetKind: "district",
    threshold: 45,
    cooldownDays: 7,
    durationDays: 1,
    triggers: { lowInteraction: 0.7, silence: 0.3 },
    action: "schedule_neighborhood_meetup",
    expectedSignals: ["presença confirmada", "novas interações", "diversidade de participantes"],
  }),
  freezeCatalogEntry({
    type: "cultural_program",
    label: "Programação cultural em espaço público",
    category: "social",
    targetKind: "public_place",
    threshold: 52,
    cooldownDays: 12,
    durationDays: 2,
    triggers: { silence: 0.48, lowInteraction: 0.42, population: 0.1 },
    action: "propose_public_cultural_program",
    expectedSignals: ["agenda publicada", "fluxo no espaço", "interações entre círculos sociais"],
  }),
  freezeCatalogEntry({
    type: "neighborhood_market",
    label: "Feira local de produtores e comerciantes",
    category: "commerce",
    targetKind: "district",
    threshold: 43,
    cooldownDays: 10,
    durationDays: 2,
    triggers: { commerce: 0.56, lowInteraction: 0.24, population: 0.2 },
    action: "organize_neighborhood_market",
    expectedSignals: ["adesão de vendedores", "visitas", "pedidos gerados"],
  }),
  freezeCatalogEntry({
    type: "local_business_campaign",
    label: "Campanha de comércio local",
    category: "commerce",
    targetKind: "business",
    threshold: 49,
    cooldownDays: 14,
    durationDays: 5,
    triggers: { commerce: 0.78, silence: 0.12, lowInteraction: 0.1 },
    action: "offer_local_business_campaign",
    expectedSignals: ["estabelecimentos participantes", "visitas", "conversão em vendas"],
  }),
  freezeCatalogEntry({
    type: "hiring_round",
    label: "Rodada local de contratação",
    category: "employment",
    targetKind: "business",
    threshold: 46,
    cooldownDays: 10,
    durationDays: 4,
    triggers: { employment: 0.72, commerce: 0.18, population: 0.1 },
    action: "open_coordinated_hiring_round",
    expectedSignals: ["vagas anunciadas", "candidaturas válidas", "entrevistas realizadas"],
  }),
  freezeCatalogEntry({
    type: "public_cleanup",
    label: "Mutirão de cuidado urbano",
    category: "urban_care",
    targetKind: "district",
    threshold: 51,
    cooldownDays: 14,
    durationDays: 2,
    triggers: { population: 0.44, mobility: 0.2, safety: 0.16, lowInteraction: 0.2 },
    action: "coordinate_public_cleanup",
    expectedSignals: ["equipes e voluntários mobilizados", "pontos vistoriados", "serviços solicitados"],
  }),
  freezeCatalogEntry({
    type: "preventive_maintenance",
    label: "Janela de manutenção preventiva",
    category: "mobility",
    targetKind: "infrastructure",
    threshold: 47,
    cooldownDays: 7,
    durationDays: 3,
    triggers: { mobility: 0.78, population: 0.22 },
    action: "request_preventive_maintenance_window",
    expectedSignals: ["ativos inspecionados", "ordens de serviço", "tempo de indisponibilidade previsto"],
  }),
  freezeCatalogEntry({
    type: "transit_reinforcement",
    label: "Reforço temporário do transporte público",
    category: "mobility",
    targetKind: "transit_route",
    threshold: 57,
    cooldownDays: 5,
    durationDays: 3,
    triggers: { mobility: 0.88, population: 0.12 },
    action: "propose_transit_service_reinforcement",
    expectedSignals: ["viagens adicionais programadas", "fila média", "tempo médio de espera"],
  }),
  freezeCatalogEntry({
    type: "health_advisory",
    label: "Alerta preventivo de saúde",
    category: "health",
    targetKind: "city",
    threshold: 61,
    cooldownDays: 7,
    durationDays: 4,
    triggers: { health: 0.92, population: 0.08 },
    action: "publish_evidence_based_health_advisory",
    expectedSignals: ["alcance do alerta", "procura por orientação", "novos casos observados"],
  }),
  freezeCatalogEntry({
    type: "mobile_health_outreach",
    label: "Ação móvel de orientação em saúde",
    category: "health",
    targetKind: "district",
    threshold: 69,
    cooldownDays: 12,
    durationDays: 3,
    triggers: { health: 0.86, population: 0.14 },
    action: "request_mobile_health_outreach",
    expectedSignals: ["atendimentos ofertados", "triagens realizadas", "encaminhamentos registrados"],
  }),
  freezeCatalogEntry({
    type: "local_safety_forum",
    label: "Fórum local de segurança e prevenção",
    category: "safety",
    targetKind: "district",
    threshold: 52,
    cooldownDays: 14,
    durationDays: 2,
    triggers: { safety: 0.76, lowInteraction: 0.1, population: 0.14 },
    action: "convene_local_safety_forum",
    expectedSignals: ["ocorrências contextualizadas", "participação dos moradores", "ações preventivas propostas"],
  }),
  freezeCatalogEntry({
    type: "local_debate",
    label: "Debate público sobre prioridades locais",
    category: "civic",
    targetKind: "district",
    threshold: 55,
    cooldownDays: 18,
    durationDays: 2,
    triggers: { population: 0.36, commerce: 0.18, mobility: 0.18, health: 0.14, safety: 0.14 },
    action: "schedule_local_policy_debate",
    expectedSignals: ["pautas registradas", "participação plural", "propostas encaminhadas"],
  }),
  freezeCatalogEntry({
    type: "housing_orientation_day",
    label: "Plantão de moradia e regularização",
    category: "housing",
    targetKind: "district",
    threshold: 58,
    cooldownDays: 14,
    durationDays: 2,
    triggers: { population: 0.84, employment: 0.08, commerce: 0.08 },
    action: "open_housing_orientation_day",
    expectedSignals: ["famílias orientadas", "demandas habitacionais registradas", "encaminhamentos"],
  }),
]);

const SIGNAL_KEYS = Object.freeze(Object.keys(CITY_DYNAMICS_SIGNAL_LABELS));
const clamp = (value, minimum = 0, maximum = 100) => {
  const number = Number(value);
  return Math.max(minimum, Math.min(maximum, Number.isFinite(number) ? number : minimum));
};
const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};
const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);
const firstArray = (...values) => values.find(Array.isArray) ?? [];
const firstFinite = (...values) => {
  for (const value of values) {
    if (value == null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
};
const text = (value) => String(value ?? "").trim();
const normalized = (value) =>
  text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const idOf = (value) => text(value && typeof value === "object" ? value.id ?? value.personId ?? value.buildingId : value);
const uniqueIds = (values, limit = CITY_DYNAMICS_LIMITS.targetIds) =>
  [...new Set(asArray(values).map(idOf).filter(Boolean))].slice(0, limit);
const mean = (values, fallback = 0) => {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? finite.reduce((total, value) => total + value, 0) / finite.length : fallback;
};

const stableHash = (value) => {
  let hash = 2166136261;
  for (const character of text(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
};

const randomUnit = (random, fallbackKey) => {
  if (typeof random !== "function") return stableHash(fallbackKey);
  const value = Number(random());
  return Number.isFinite(value) ? clamp(value, 0, 0.999999) : stableHash(fallbackKey);
};

const alive = (person) =>
  Boolean(person) &&
  person.alive !== false &&
  !person.dead &&
  !person.deceased &&
  !person.dateOfDeath;

const statusIs = (value, terms) => terms.some((term) => normalized(value).includes(term));

const resolveClock = (snapshot = {}, options = {}, fallbackDay = 0) => {
  const cadence = options.cadence === CITY_DYNAMICS_CADENCES.WEEKLY
    ? CITY_DYNAMICS_CADENCES.WEEKLY
    : options.cadence === CITY_DYNAMICS_CADENCES.DAILY
      ? CITY_DYNAMICS_CADENCES.DAILY
      : snapshot.cadence === CITY_DYNAMICS_CADENCES.WEEKLY
        ? CITY_DYNAMICS_CADENCES.WEEKLY
        : CITY_DYNAMICS_CADENCES.DAILY;
  const explicitWeek = firstFinite(options.week, snapshot.week);
  const week = Math.max(0, Math.floor(explicitWeek ?? Math.floor(fallbackDay / 7)));
  const dayOfWeek = Math.max(0, Math.min(6, Math.floor(firstFinite(options.dayOfWeek, snapshot.dayOfWeek, snapshot.day) || 0)));
  const explicitDay = firstFinite(options.absoluteDay, options.clockDay, snapshot.absoluteDay, snapshot.elapsedDays, snapshot.clock?.absoluteDay);
  const calculated = explicitDay == null
    ? explicitWeek != null
      ? week * 7 + dayOfWeek
      : fallbackDay
    : explicitDay;
  return { cadence, week, dayOfWeek, clockDay: Math.max(0, Math.floor(calculated)) };
};

const temporalDayOf = (entry) => {
  if (!entry || typeof entry !== "object") return null;
  const direct = firstFinite(entry.absoluteDay, entry.elapsedDay, entry.clockDay, entry.date?.absoluteDay);
  if (direct != null) return direct;
  const week = firstFinite(entry.week, entry.weekNumber);
  if (week != null) return week * 7 + Math.max(0, Math.min(6, firstFinite(entry.day, entry.dayOfWeek) || 0));
  const timestamp = text(entry.time ?? entry.timestamp);
  const match = timestamp.match(/Sem\.?\s*(\d+)/i);
  if (!match) return null;
  const weekdays = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
  const timestampKey = normalized(timestamp);
  const weekday = weekdays.findIndex((name) => timestampKey.includes(name));
  return Number(match[1]) * 7 + Math.max(0, weekday);
};

const recentItems = (items, clockDay, windowDays) => {
  const source = asArray(items);
  if (!source.length) return [];
  const temporal = source.filter((entry) => temporalDayOf(entry) != null);
  if (!temporal.length) return source;
  return source.filter((entry) => {
    const day = temporalDayOf(entry);
    return day != null && day <= clockDay && clockDay - day < windowDays;
  });
};

const isEmployed = (person) => {
  if (!alive(person) || Number(person.age) < 16) return false;
  if (person.employed === true || person.jobId || person.workplaceId) return true;
  const state = normalized(person.employment?.status ?? person.employmentStatus ?? person.workStatus);
  if (statusIs(state, ["desempreg", "unemploy", "inativ", "aposent", "retir"])) return false;
  return Boolean(person.job?.id || person.job?.title || person.employment?.jobId || state === "employed" || state === "empregado");
};

const isSeekingWork = (person) => {
  if (!alive(person) || Number(person.age) < 16 || Number(person.age) > 75 || isEmployed(person)) return false;
  const state = normalized(person.employment?.status ?? person.employmentStatus ?? person.workStatus);
  return person.seekingWork === true || statusIs(state, ["desempreg", "unemploy", "procurando", "seeking"]);
};

const isPermanentlyInactiveBusiness = (business) => {
  if (business.active === false || business.operational === false || business.permanentlyClosed === true) return true;
  return statusIs(business.status, ["encerrad", "falid", "closed permanently", "inativ", "dissolvid"]);
};

const inventoryRatio = (business) => {
  const explicit = firstFinite(business.inventoryRatio, business.stockRatio, business.inventory?.ratio);
  if (explicit != null) return clamp(explicit <= 1 ? explicit * 100 : explicit, 0, 100);
  const current = firstFinite(business.stock, business.inventory?.quantity, business.inventory?.current);
  const desired = firstFinite(business.stockCapacity, business.inventory?.capacity, business.inventory?.target);
  return current != null && desired > 0 ? clamp((current / desired) * 100) : null;
};

const businessIsStruggling = (business) => {
  const profit = firstFinite(business.profit, business.weeklyProfit, business.finance?.profit);
  const cash = firstFinite(business.cash, business.balance, business.finance?.cash);
  return business.financialStress === true || business.atRisk === true || (profit != null && profit < 0) || (cash != null && cash < 0);
};

const residentIsSick = (person) => {
  if (!alive(person)) return false;
  const conditions = firstArray(person.conditions, person.medical?.conditions, person.healthRecord?.conditions);
  const activeCondition = conditions.some((condition) => typeof condition === "string" || condition?.active !== false);
  const health = firstFinite(person.health, person.healthScore, person.medical?.health);
  return person.sick === true || person.ill === true || activeCondition || (health != null && health < 62);
};

const residentIsHospitalized = (person) =>
  alive(person) && Boolean(person.hospitalized || person.medical?.admitted || person.hospitalization?.active);

const residentIsStranded = (person) => {
  const action = normalized(person.currentAction ?? person.action ?? person.activity);
  const wait = firstFinite(person.waitingMinutes, person.mobility?.waitingMinutes, person.trip?.waitingMinutes);
  return Boolean(person.stranded || person.trip?.stuck || (wait != null && wait >= 45) || statusIs(action, ["esperando onibus", "waiting for bus", "preso no transito"]));
};

const housingIsTemporary = (person) => {
  const state = normalized(person.housingStatus ?? person.residenceType ?? person.home?.type);
  return person.unhoused === true || person.temporaryHousing === true || statusIs(state, ["hotel", "pousada", "abrigo", "tempor", "sem teto", "homeless"]);
};

const candidateIds = (snapshot, residents, businesses, mobilityAssets, pressuredBusinesses, vulnerableResidents, strandedResidents) => {
  const districts = firstArray(snapshot.districts, snapshot.city?.districts, snapshot.neighborhoods);
  const publicPlaces = firstArray(snapshot.publicPlaces, snapshot.city?.publicPlaces, snapshot.buildings)
    .filter((place) => statusIs(place.type ?? place.category, ["parque", "praca", "public", "civic", "cultura"]));
  const infrastructure = firstArray(snapshot.infrastructure, snapshot.roads, snapshot.city?.roads, snapshot.transport?.stops);
  const routes = firstArray(snapshot.transport?.routes, snapshot.transitRoutes, snapshot.mobility?.routes);
  return {
    city: uniqueIds([snapshot.city?.id ?? snapshot.cityId ?? "city"], 1),
    district: uniqueIds(districts),
    public_place: uniqueIds(publicPlaces.length ? publicPlaces : districts),
    business: uniqueIds(pressuredBusinesses.length ? pressuredBusinesses : businesses),
    infrastructure: uniqueIds(infrastructure.length ? infrastructure : mobilityAssets),
    transit_route: uniqueIds(routes.length ? routes : mobilityAssets),
    vulnerable_resident: uniqueIds(vulnerableResidents),
    stranded_resident: uniqueIds(strandedResidents),
    resident: uniqueIds(residents),
  };
};

/** Cria um estado vazio e seguro para persistência em save games. */
export function createCityDynamicsState(options = {}) {
  const baseline = clamp(options.baselineIntensity ?? 42);
  return {
    version: CITY_DYNAMICS_VERSION,
    clockDay: Math.max(0, Math.floor(Number(options.absoluteDay) || 0)),
    week: Math.max(0, Math.floor(Number(options.week) || 0)),
    cadence: options.cadence === CITY_DYNAMICS_CADENCES.WEEKLY ? CITY_DYNAMICS_CADENCES.WEEKLY : CITY_DYNAMICS_CADENCES.DAILY,
    intensity: baseline,
    targetIntensity: baseline,
    momentum: 0,
    fatigue: 0,
    lastImpulseDay: null,
    cooldowns: {},
    weeklyQuota: { week: Math.max(0, Math.floor(Number(options.week) || 0)), total: 0, byCategory: {} },
    recentImpulses: [],
    history: [],
    revision: 0,
  };
}

const normalizeState = (state, options = {}) => {
  const initial = state?.version === CITY_DYNAMICS_VERSION ? state : createCityDynamicsState(options);
  const week = Math.max(0, Math.floor(Number(initial.week) || 0));
  const quotaWeek = Math.max(0, Math.floor(Number(initial.weeklyQuota?.week) || 0));
  const byCategory = Object.fromEntries(
    Object.entries(initial.weeklyQuota?.byCategory ?? {}).map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))]),
  );
  return {
    version: CITY_DYNAMICS_VERSION,
    clockDay: Math.max(0, Math.floor(Number(initial.clockDay) || 0)),
    week,
    cadence: initial.cadence === CITY_DYNAMICS_CADENCES.WEEKLY ? CITY_DYNAMICS_CADENCES.WEEKLY : CITY_DYNAMICS_CADENCES.DAILY,
    intensity: clamp(initial.intensity ?? 42),
    targetIntensity: clamp(initial.targetIntensity ?? initial.intensity ?? 42),
    momentum: clamp(initial.momentum, -100, 100),
    fatigue: clamp(initial.fatigue),
    lastImpulseDay: initial.lastImpulseDay != null && Number.isFinite(Number(initial.lastImpulseDay)) ? Number(initial.lastImpulseDay) : null,
    cooldowns: Object.fromEntries(
      Object.entries(initial.cooldowns ?? {}).map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))]),
    ),
    weeklyQuota: {
      week: quotaWeek || week,
      total: Math.max(0, Math.floor(Number(initial.weeklyQuota?.total) || 0)),
      byCategory,
    },
    recentImpulses: asArray(initial.recentImpulses).slice(0, CITY_DYNAMICS_LIMITS.recentImpulses).map((impulse) => ({ ...impulse })),
    history: asArray(initial.history).slice(-CITY_DYNAMICS_LIMITS.historyCycles).map((entry) => ({ ...entry })),
    revision: Math.max(0, Math.floor(Number(initial.revision) || 0)),
  };
};

/**
 * Lê um snapshot diário ou semanal e o reduz a sinais de 0–100. Campos
 * agregados em `options.metrics` têm precedência e facilitam integrações que
 * já mantêm contadores recentes.
 */
export function analyzeCityDynamics(snapshot = {}, options = {}) {
  const clock = resolveClock(snapshot, options);
  const windowDays = clock.cadence === CITY_DYNAMICS_CADENCES.WEEKLY ? 7 : 1;
  const metrics = options.metrics ?? {};
  const residents = firstArray(snapshot.residents, snapshot.people, snapshot.population?.residents, snapshot.population).filter(alive);
  const declaredPopulation = firstFinite(metrics.population, snapshot.population?.count, snapshot.populationCount, typeof snapshot.population === "number" ? snapshot.population : null);
  const population = Math.max(0, Math.floor(declaredPopulation ?? residents.length));
  const businesses = firstArray(snapshot.businesses, snapshot.establishments, snapshot.commerce?.establishments);
  const mobilityAssets = firstArray(snapshot.transport?.vehicles, snapshot.vehicles, snapshot.mobility?.vehicles, snapshot.transport?.stops);
  const logSource = firstArray(snapshot.logs, snapshot.cityLog, snapshot.journal, snapshot.events, snapshot.recentEvents);
  const interactionSource = firstArray(snapshot.interactions, snapshot.socialInteractions, snapshot.social?.interactions, snapshot.recentInteractions);
  const crimeSource = firstArray(snapshot.crimes, snapshot.justice?.crimes, snapshot.security?.incidents, snapshot.police?.incidents);
  const recentLogs = recentItems(logSource, clock.clockDay, windowDays);
  const recentInteractions = recentItems(interactionSource, clock.clockDay, windowDays);
  const recentCrimes = recentItems(crimeSource, clock.clockDay, windowDays);

  const expectedLogs = Math.max(windowDays === 1 ? 2 : 7, population * 0.025 * windowDays);
  const logCount = Math.max(0, firstFinite(metrics.recentLogs, options.recentLogCount, recentLogs.length) || 0);
  const expectedInteractions = Math.max(windowDays === 1 ? 3 : 12, population * 0.16 * windowDays);
  const interactionCount = Math.max(0, firstFinite(metrics.recentInteractions, options.recentInteractionCount, recentInteractions.length) || 0);
  const silence = clamp((1 - logCount / expectedLogs) * 100);
  const lowInteraction = clamp((1 - interactionCount / expectedInteractions) * 100);

  // `isOpen === false` é deliberadamente ignorado: pode ser apenas o horário.
  const permanentlyInactive = businesses.filter(isPermanentlyInactiveBusiness);
  const lowStock = businesses.filter((business) => {
    const ratio = inventoryRatio(business);
    return ratio != null && ratio < 25;
  });
  const struggling = businesses.filter(businessIsStruggling);
  const vacancies = businesses.reduce((total, business) => total + Math.max(0, Math.floor(firstFinite(business.openPositions, business.vacancies, business.staffing?.vacancies) || 0)), 0);
  const operationalBusinesses = Math.max(1, businesses.length - permanentlyInactive.length);
  const commerce = clamp(
    (permanentlyInactive.length / Math.max(1, businesses.length)) * 42 +
    (struggling.length / Math.max(1, businesses.length)) * 34 +
    (lowStock.length / operationalBusinesses) * 24,
  );

  const workingAge = residents.filter((person) => Number(person.age) >= 16 && Number(person.age) <= 75);
  const seekingWork = workingAge.filter(isSeekingWork);
  const unemployedRate = firstFinite(metrics.unemploymentRate, snapshot.economy?.unemploymentRate) ??
    (workingAge.length ? (seekingWork.length / workingAge.length) * 100 : 0);
  const vacancyMismatch = vacancies && seekingWork.length ? Math.abs(vacancies - seekingWork.length) / Math.max(vacancies, seekingWork.length) : 0;
  const understaffed = businesses.filter((business) => business.understaffed || (firstFinite(business.staff, business.staffing?.current) ?? 1) < (firstFinite(business.requiredStaff, business.staffing?.required) ?? 0));
  const employment = clamp(unemployedRate * 3.6 + vacancyMismatch * 18 + (understaffed.length / Math.max(1, businesses.length)) * 30);

  const strandedResidents = residents.filter(residentIsStranded);
  const waitMinutes = firstFinite(metrics.averageWaitMinutes, snapshot.mobility?.averageWaitMinutes, snapshot.transport?.averageWaitMinutes) ??
    mean(residents.map((person) => firstFinite(person.waitingMinutes, person.mobility?.waitingMinutes)).filter((value) => value != null));
  const congestion = clamp(firstFinite(metrics.congestion, snapshot.mobility?.congestion, snapshot.transport?.congestion) || 0);
  const failures = Math.max(0, firstFinite(metrics.serviceFailures, snapshot.mobility?.serviceFailures, snapshot.transport?.serviceFailures) || 0);
  const mobility = clamp(
    (strandedResidents.length / Math.max(1, population)) * 220 +
    clamp((waitMinutes - 10) * 2.2) * 0.42 +
    congestion * 0.25 +
    Math.min(30, failures * 5),
  );

  const sickResidents = residents.filter(residentIsSick);
  const hospitalizedResidents = residents.filter(residentIsHospitalized);
  const capacity = Math.max(0, firstFinite(metrics.healthCapacity, snapshot.health?.capacity, snapshot.healthSystem?.beds) || 0);
  const occupied = Math.max(0, firstFinite(metrics.healthOccupied, snapshot.health?.occupied, snapshot.healthSystem?.occupiedBeds, hospitalizedResidents.length) || 0);
  const capacityPressure = capacity ? clamp((occupied / capacity) * 100) : hospitalizedResidents.length ? 35 : 0;
  const health = clamp(
    (sickResidents.length / Math.max(1, population)) * 150 +
    (hospitalizedResidents.length / Math.max(1, population)) * 260 +
    capacityPressure * 0.38,
  );

  const unresolvedCrimes = recentCrimes.filter((crime) => !crime.resolved && !statusIs(crime.status, ["resolvid", "arquivad", "condenad", "absolvid", "closed"]));
  const crimeCount = Math.max(0, firstFinite(metrics.recentCrimes, recentCrimes.length) || 0);
  const severeCrimes = recentCrimes.filter((crime) => crime.severity >= 70 || statusIs(crime.severity ?? crime.type, ["grave", "violent", "homic", "assassin", "sequest"]));
  const safety = clamp(
    (crimeCount / Math.max(1, population)) * (windowDays === 1 ? 900 : 300) +
    (unresolvedCrimes.length / Math.max(1, crimeCount)) * 30 +
    Math.min(28, severeCrimes.length * 7),
  );

  const temporaryHousing = residents.filter(housingIsTemporary);
  const housingShortage = Math.max(0, firstFinite(metrics.housingShortage, snapshot.housing?.shortage, snapshot.housing?.unmetDemand) || 0);
  const growthRate = Math.abs(firstFinite(metrics.populationGrowthRate, snapshot.population?.growthRate, snapshot.demographics?.growthRate) || 0);
  const populationPressure = clamp(
    (temporaryHousing.length / Math.max(1, population)) * 260 +
    (housingShortage / Math.max(1, population)) * 220 +
    Math.min(32, growthRate * 3.2),
  );

  const signals = {
    silence: round(silence),
    lowInteraction: round(lowInteraction),
    commerce: round(commerce),
    employment: round(employment),
    mobility: round(mobility),
    health: round(health),
    safety: round(safety),
    population: round(populationPressure),
  };
  const pressuredBusinesses = uniqueIds([...struggling, ...lowStock, ...understaffed], CITY_DYNAMICS_LIMITS.targetIds * 2);
  const vulnerableResidents = uniqueIds([...hospitalizedResidents, ...sickResidents, ...temporaryHousing], CITY_DYNAMICS_LIMITS.targetIds * 2);
  const candidates = candidateIds(
    snapshot,
    residents,
    businesses,
    mobilityAssets,
    pressuredBusinesses,
    vulnerableResidents,
    strandedResidents,
  );
  const topSignals = SIGNAL_KEYS
    .map((key) => ({ key, label: CITY_DYNAMICS_SIGNAL_LABELS[key], value: signals[key] }))
    .filter((entry) => entry.value >= 25)
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));

  return {
    cadence: clock.cadence,
    clockDay: clock.clockDay,
    week: clock.week,
    windowDays,
    population,
    signals,
    topSignals,
    activity: {
      recentLogs: logCount,
      expectedLogs: round(expectedLogs),
      recentInteractions: interactionCount,
      expectedInteractions: round(expectedInteractions),
    },
    sectors: {
      commerce: { businesses: businesses.length, permanentlyInactive: permanentlyInactive.length, struggling: struggling.length, lowStock: lowStock.length },
      employment: { seekingWork: seekingWork.length, vacancies, understaffedBusinesses: understaffed.length, unemploymentRate: round(unemployedRate) },
      mobility: { strandedResidents: strandedResidents.length, averageWaitMinutes: round(waitMinutes), congestion: round(congestion), serviceFailures: failures },
      health: { sickResidents: sickResidents.length, hospitalizedResidents: hospitalizedResidents.length, capacity, occupied },
      safety: { recentCrimes: crimeCount, unresolvedCrimes: unresolvedCrimes.length, severeCrimes: severeCrimes.length },
      population: { temporaryHousing: temporaryHousing.length, housingShortage, growthRate: round(growthRate, 2) },
    },
    candidates,
  };
}

/** Atalho explícito para o ciclo diário. */
export function analyzeDailyCitySignals(snapshot = {}, options = {}) {
  return analyzeCityDynamics(snapshot, { ...options, cadence: CITY_DYNAMICS_CADENCES.DAILY });
}

/** Atalho explícito para o ciclo semanal. */
export function analyzeWeeklyCitySignals(snapshot = {}, options = {}) {
  return analyzeCityDynamics(snapshot, { ...options, cadence: CITY_DYNAMICS_CADENCES.WEEKLY });
}

/** Calcula a intensidade desejada sem alterar o estado. */
export function calculateTargetIntensity(analysis, state = {}, options = {}) {
  const signals = analysis?.signals ?? {};
  const baseline = clamp(options.baselineIntensity ?? 42);
  const weightedPressure =
    clamp(signals.silence) * 0.13 +
    clamp(signals.lowInteraction) * 0.19 +
    clamp(signals.commerce) * 0.12 +
    clamp(signals.employment) * 0.1 +
    clamp(signals.mobility) * 0.12 +
    clamp(signals.health) * 0.11 +
    clamp(signals.safety) * 0.11 +
    clamp(signals.population) * 0.12;
  const quietSynergy = Math.min(clamp(signals.silence), clamp(signals.lowInteraction)) >= 60 ? 8 : 0;
  const broadPressure = SIGNAL_KEYS.filter((key) => clamp(signals[key]) >= 55).length >= 3 ? 6 : 0;
  const overload = Math.max(0, (Number(analysis?.activity?.recentLogs) || 0) - (Number(analysis?.activity?.expectedLogs) || 0) * 1.75);
  const overloadPenalty = Math.min(12, overload * 0.8);
  const fatiguePenalty = clamp(state?.fatigue) * 0.18;
  return round(clamp(baseline + weightedPressure * 0.48 + quietSynergy + broadPressure - overloadPenalty - fatiguePenalty));
}

const weightedImpulseScore = (entry, signals) =>
  Object.entries(entry.triggers).reduce((total, [signal, weight]) => total + clamp(signals?.[signal]) * weight, 0);

const evidenceFor = (analysis, triggerCodes) => {
  const sectors = analysis?.sectors ?? {};
  const evidence = {};
  for (const code of triggerCodes) {
    evidence[code] = clamp(analysis?.signals?.[code]);
    if (sectors[code]) evidence[`${code}Metrics`] = { ...sectors[code] };
  }
  return evidence;
};

const targetsFor = (entry, analysis) => {
  const candidates = analysis?.candidates ?? {};
  const ids = candidates[entry.targetKind]?.length
    ? candidates[entry.targetKind]
    : entry.targetKind === "district"
      ? candidates.public_place
      : entry.targetKind === "city"
        ? candidates.city
        : [];
  return uniqueIds(ids);
};

const quotaForWeek = (state, week) =>
  state.weeklyQuota?.week === week
    ? { week, total: state.weeklyQuota.total, byCategory: { ...state.weeklyQuota.byCategory } }
    : { week, total: 0, byCategory: {} };

/**
 * Seleciona propostas elegíveis. Cooldown, cotas e variedade são considerados
 * antes do sorteio; portanto, aumentar a velocidade do jogo não causa spam.
 */
export function selectCityImpulses(previousState, analysis, options = {}) {
  const state = normalizeState(previousState, options);
  const targetIntensity = clamp(options.targetIntensity ?? calculateTargetIntensity(analysis, state, options));
  const week = Math.max(0, Math.floor(Number(analysis?.week) || 0));
  const clockDay = Math.max(state.clockDay, Math.floor(Number(analysis?.clockDay) || 0));
  const cadence = analysis?.cadence === CITY_DYNAMICS_CADENCES.WEEKLY ? CITY_DYNAMICS_CADENCES.WEEKLY : CITY_DYNAMICS_CADENCES.DAILY;
  const quota = quotaForWeek(state, week);
  const configuredMaximum = Number(options.maxImpulses);
  const maxPerCycle = Math.max(0, Math.floor(Number.isFinite(configuredMaximum) ? configuredMaximum : (
    cadence === CITY_DYNAMICS_CADENCES.WEEKLY
      ? targetIntensity >= 78 ? 3 : targetIntensity >= 52 ? 2 : targetIntensity >= 36 ? 1 : 0
      : targetIntensity >= 78 ? 2 : targetIntensity >= 38 ? 1 : 0
  )));
  const weeklyLimit = Math.max(1, Math.floor(Number(options.weeklyLimit) || CITY_DYNAMICS_LIMITS.impulsesPerWeek));
  const categoryLimit = Math.max(1, Math.floor(Number(options.categoryWeeklyLimit) || CITY_DYNAMICS_LIMITS.impulsesPerCategoryWeek));
  const availableSlots = Math.max(0, Math.min(maxPerCycle, weeklyLimit - quota.total));
  if (!availableSlots || (cadence === CITY_DYNAMICS_CADENCES.DAILY && state.lastImpulseDay === clockDay)) return [];

  const ranked = CITY_IMPULSE_CATALOG.flatMap((entry) => {
    if ((state.cooldowns[entry.type] || 0) > clockDay) return [];
    if ((quota.byCategory[entry.category] || 0) >= categoryLimit) return [];
    const baseScore = weightedImpulseScore(entry, analysis?.signals);
    if (baseScore < entry.threshold) return [];
    const lastSame = state.recentImpulses.find((impulse) => impulse.type === entry.type);
    const lastCategory = state.recentImpulses.find((impulse) => impulse.category === entry.category);
    const repeatPenalty = lastSame ? 14 : lastCategory && clockDay - Number(lastCategory.clockDay || 0) < 10 ? 7 : 0;
    const urgencyBoost = Math.max(...Object.keys(entry.triggers).map((key) => clamp(analysis?.signals?.[key]))) >= 75 ? 5 : 0;
    const jitter = (randomUnit(options.random, `${week}:${clockDay}:${entry.type}:${state.revision}`) - 0.5) * 5;
    const score = round(baseScore + targetIntensity * 0.08 + urgencyBoost - repeatPenalty + jitter);
    return [{ entry, baseScore, score }];
  }).sort((a, b) => b.score - a.score || a.entry.type.localeCompare(b.entry.type));

  const chosen = [];
  const usedCategories = new Set();
  for (const candidate of ranked) {
    if (chosen.length >= availableSlots) break;
    if (usedCategories.has(candidate.entry.category)) continue;
    const triggerCodes = Object.keys(candidate.entry.triggers)
      .filter((key) => clamp(analysis?.signals?.[key]) >= 25)
      .sort((a, b) => clamp(analysis?.signals?.[b]) - clamp(analysis?.signals?.[a]));
    const strongest = triggerCodes[0] ?? Object.keys(candidate.entry.triggers)[0];
    const priority = candidate.baseScore >= 76 ? "high" : candidate.baseScore >= 58 ? "elevated" : "normal";
    const targetIds = targetsFor(candidate.entry, analysis);
    chosen.push({
      id: `city-impulse:${week}:${clockDay}:${candidate.entry.type}:${state.revision + 1}`,
      type: candidate.entry.type,
      label: candidate.entry.label,
      category: candidate.entry.category,
      status: "proposed",
      cadence,
      week,
      clockDay,
      expiresDay: clockDay + Math.max(1, candidate.entry.durationDays),
      priority,
      selectionScore: candidate.score,
      triggerCodes,
      rationale: `Proposta motivada por ${CITY_DYNAMICS_SIGNAL_LABELS[strongest] ?? strongest} (${round(analysis?.signals?.[strongest])}/100).`,
      evidence: evidenceFor(analysis, triggerCodes),
      targets: { kind: candidate.entry.targetKind, ids: targetIds },
      proposal: {
        action: candidate.entry.action,
        suggestedDurationDays: candidate.entry.durationDays,
        expectedSignals: [...candidate.entry.expectedSignals],
      },
      cooldownUntilDay: clockDay + candidate.entry.cooldownDays,
    });
    usedCategories.add(candidate.entry.category);
  }
  return chosen;
}

/** Executa um ciclo completo e devolve somente novos objetos. */
export function runCityDynamicsCycle(previousState, snapshot = {}, options = {}) {
  const base = normalizeState(previousState, options);
  const fallbackIncrement = options.cadence === CITY_DYNAMICS_CADENCES.WEEKLY ? 7 : 1;
  const clock = resolveClock(snapshot, options, base.clockDay + fallbackIncrement);
  const analysis = analyzeCityDynamics(snapshot, { ...options, ...clock });
  const targetIntensity = calculateTargetIntensity(analysis, base, options);
  const responseRate = analysis.cadence === CITY_DYNAMICS_CADENCES.WEEKLY ? 0.72 : 0.48;
  const intensity = round(clamp(base.intensity + (targetIntensity - base.intensity) * responseRate));
  const impulses = selectCityImpulses(base, analysis, { ...options, targetIntensity: intensity });
  const quota = quotaForWeek(base, analysis.week);
  for (const impulse of impulses) {
    quota.total += 1;
    quota.byCategory[impulse.category] = (quota.byCategory[impulse.category] || 0) + 1;
  }
  const cooldowns = Object.fromEntries(Object.entries(base.cooldowns).filter(([, until]) => until > analysis.clockDay));
  impulses.forEach((impulse) => { cooldowns[impulse.type] = impulse.cooldownUntilDay; });
  const priorAverage = base.history.length ? mean(base.history.slice(-4).map((entry) => entry.intensity), base.intensity) : base.intensity;
  const momentum = round(clamp(intensity - priorAverage, -100, 100));
  const fatigue = round(clamp(base.fatigue * (analysis.cadence === CITY_DYNAMICS_CADENCES.WEEKLY ? 0.58 : 0.88) + impulses.length * 13));
  const historyEntry = {
    cadence: analysis.cadence,
    clockDay: analysis.clockDay,
    week: analysis.week,
    intensity,
    targetIntensity,
    impulseCount: impulses.length,
    topSignal: analysis.topSignals[0]?.key ?? null,
    signals: { ...analysis.signals },
  };
  const state = {
    version: CITY_DYNAMICS_VERSION,
    clockDay: analysis.clockDay,
    week: analysis.week,
    cadence: analysis.cadence,
    intensity,
    targetIntensity,
    momentum,
    fatigue,
    lastImpulseDay: impulses.length ? analysis.clockDay : base.lastImpulseDay,
    cooldowns,
    weeklyQuota: quota,
    recentImpulses: [...impulses, ...base.recentImpulses].slice(0, CITY_DYNAMICS_LIMITS.recentImpulses),
    history: [...base.history, historyEntry].slice(-CITY_DYNAMICS_LIMITS.historyCycles),
    revision: base.revision + 1,
  };
  return { state, analysis, targetIntensity, intensity, impulses };
}

/** Atalho para integração no fechamento do dia. */
export function runDailyCityDynamics(previousState, snapshot = {}, options = {}) {
  return runCityDynamicsCycle(previousState, snapshot, { ...options, cadence: CITY_DYNAMICS_CADENCES.DAILY });
}

/** Atalho para integração no fechamento da semana. */
export function runWeeklyCityDynamics(previousState, snapshot = {}, options = {}) {
  return runCityDynamicsCycle(previousState, snapshot, { ...options, cadence: CITY_DYNAMICS_CADENCES.WEEKLY });
}

/** Resumo compacto para HUD, depuração, diário ou telemetria. */
export function summarizeCityDynamics(state) {
  const normalizedState = normalizeState(state);
  const last = normalizedState.history.at(-1);
  const topSignals = last?.signals
    ? SIGNAL_KEYS
      .map((key) => ({ key, label: CITY_DYNAMICS_SIGNAL_LABELS[key], value: clamp(last.signals[key]) }))
      .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
      .slice(0, 3)
    : [];
  const activeCooldowns = Object.values(normalizedState.cooldowns).filter((until) => until > normalizedState.clockDay).length;
  const pace = normalizedState.intensity >= 75 ? "muito ativo" : normalizedState.intensity >= 55 ? "ativo" : normalizedState.intensity >= 35 ? "estável" : "calmo";
  return {
    week: normalizedState.week,
    clockDay: normalizedState.clockDay,
    cadence: normalizedState.cadence,
    intensity: round(normalizedState.intensity),
    targetIntensity: round(normalizedState.targetIntensity),
    momentum: round(normalizedState.momentum),
    fatigue: round(normalizedState.fatigue),
    pace,
    topSignals,
    impulsesThisWeek: normalizedState.weeklyQuota.total,
    remainingWeeklyCapacity: Math.max(0, CITY_DYNAMICS_LIMITS.impulsesPerWeek - normalizedState.weeklyQuota.total),
    activeCooldowns,
    lastImpulse: normalizedState.recentImpulses[0]
      ? {
        type: normalizedState.recentImpulses[0].type,
        label: normalizedState.recentImpulses[0].label,
        clockDay: normalizedState.recentImpulses[0].clockDay,
        status: normalizedState.recentImpulses[0].status,
      }
      : null,
  };
}
