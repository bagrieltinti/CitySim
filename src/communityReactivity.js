/**
 * CommunityReactivity
 *
 * Motor puro de diagnóstico e resposta comunitária. Ele transforma um snapshot
 * semanal de moradores, relações e moradias em demandas explicáveis, distribui
 * capacidade escassa e produz consequências que a simulação pode aplicar.
 *
 * Nenhuma função altera os objetos recebidos. Todo o estado retornado contém
 * apenas dados serializáveis. Quando desempates aleatórios forem desejados, o
 * chamador deve fornecer `options.random`; a mesma sequência gera o mesmo
 * resultado. Sem essa opção, o desempate é determinístico pelo identificador.
 */

export const COMMUNITY_REACTIVITY_VERSION = 1;

export const COMMUNITY_SERVICE_TYPES = Object.freeze({
  DAYCARE: "daycare",
  FAMILY_MEDIATION: "familyMediation",
  ELDER_HOME_SUPPORT: "elderHomeSupport",
  TRANSITIONAL_HOUSING: "transitionalHousing",
});

export const COMMUNITY_SERVICE_CATALOG = Object.freeze([
  Object.freeze({ id: "daycare", label: "Creche municipal", capacityUnit: "vaga infantil", reviewCadence: "weekly" }),
  Object.freeze({ id: "familyMediation", label: "Mediação familiar", capacityUnit: "caso acompanhado", reviewCadence: "weekly" }),
  Object.freeze({ id: "elderHomeSupport", label: "Apoio domiciliar à pessoa idosa", capacityUnit: "visita semanal", reviewCadence: "weekly" }),
  Object.freeze({ id: "transitionalHousing", label: "Acolhimento habitacional transitório", capacityUnit: "leito", reviewCadence: "weekly" }),
]);

export const COMMUNITY_REACTIVITY_LIMITS = Object.freeze({
  demandsPerService: 320,
  activeCasesPerService: 256,
  waitlistPerService: 256,
  recentResponses: 320,
  recentConsequences: 320,
  historyWeeks: 24,
  reasonCodes: 12,
  residentIdsPerCase: 16,
});

export const DEFAULT_COMMUNITY_CAPACITIES = Object.freeze({
  daycare: 24,
  familyMediation: 6,
  elderHomeSupport: 12,
  transitionalHousing: 10,
});

const SERVICE_KEYS = Object.freeze(Object.values(COMMUNITY_SERVICE_TYPES));
const ROMANTIC_STAGES = new Set([
  "paquera",
  "ficante_casual",
  "ficante_recorrente",
  "ficante_exclusivo",
  "namoro",
  "uniao_estavel",
  "noivado",
  "casamento",
  "separado",
  "divorciado",
]);
const SEPARATION_STAGES = new Set(["separado", "divorciado", "encerrado"]);
const TEMPORARY_HOUSING_TERMS = ["hotel", "pousada", "abrigo", "shelter", "temporar", "emergencial"];
const UNHOUSED_TERMS = ["sem_teto", "sem teto", "homeless", "desabrig", "rua"];

const clamp = (value, minimum = 0, maximum = 100) => {
  const number = Number(value);
  return Math.max(minimum, Math.min(maximum, Number.isFinite(number) ? number : minimum));
};

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const normalizedWeek = (value) => Math.max(0, Math.floor(Number(value) || 0));
const text = (value) => String(value ?? "").trim();
const lower = (value) =>
  text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);
const idOf = (value) => text(value && typeof value === "object" ? value.id ?? value.personId : value);
const unique = (values, limit = Infinity) =>
  [...new Set(asArray(values).map(idOf).filter(Boolean))].slice(0, limit);
const bounded = (values, limit) => asArray(values).slice(0, Math.max(0, limit));
const sum = (values) => values.reduce((total, value) => total + (Number(value) || 0), 0);
const includesAny = (value, terms) => terms.some((term) => lower(value).includes(term));

const stableHash = (value) => {
  let hash = 2166136261;
  for (const character of text(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
};

const safeRandom = (random, fallbackKey) => {
  if (typeof random !== "function") return stableHash(fallbackKey);
  const value = Number(random());
  return Number.isFinite(value) ? clamp(value, 0, 0.999999) : stableHash(fallbackKey);
};

const emptyServiceRecord = () => Object.fromEntries(SERVICE_KEYS.map((service) => [service, []]));

const normalizeCapacities = (capacities = {}) =>
  Object.fromEntries(
    SERVICE_KEYS.map((service) => {
      const raw = capacities?.[service] ?? DEFAULT_COMMUNITY_CAPACITIES[service];
      const units = typeof raw === "object" ? raw?.units : raw;
      return [service, Math.max(0, Math.floor(Number(units) || 0))];
    }),
  );

const alive = (person) =>
  Boolean(person) &&
  person.alive !== false &&
  !person.deceased &&
  !person.dead &&
  !person.dateOfDeath &&
  !person.deathWeek;

const ageOf = (person) => clamp(person?.age ?? person?.years ?? 0, 0, 130);

const incomeOf = (person) =>
  Math.max(
    0,
    Number(
      person?.income ??
      person?.weeklyIncome ??
      person?.salary ??
      person?.wage ??
      person?.job?.salary ??
        person?.employment?.income ??
        (Number(person?.hourlyWage || 0) * Number(person?.shift?.hours || 0)),
    ) || 0,
  );

const isWorking = (person) => {
  const employment = person?.employment;
  const status = lower(employment?.status ?? person?.employmentStatus ?? person?.workStatus);
  if (["desempregado", "unemployed", "inativo", "aposentado", "retired", "nenhum"].includes(status)) return false;
  if (person?.employed === false || person?.jobless === true) return false;
  if (person?.employed === true || person?.working === true || person?.jobId) return true;
  const role = lower(person?.role ?? person?.occupation ?? person?.profession);
  if (
    (Number(person?.wage) > 0 || person?.workplace) &&
    !includesAny(role, ["estudante", "student", "desempreg", "aposentad", "inativo", "nenhum"])
  ) return true;
  if (typeof person?.job === "string") {
    const job = lower(person.job);
    if (job && !includesAny(job, ["desempreg", "sem emprego", "nenhum", "aposentad", "inativo"])) return true;
  }
  if (person?.job && typeof person.job === "object" && (person.job.id || person.job.title || person.job.role)) return true;
  return Boolean(employment && (employment.jobId || employment.employerId || employment.role || status === "employed"));
};

const hasIrregularWork = (person) => {
  const schedule = lower(
    person?.job?.schedule ?? person?.employment?.schedule ?? person?.workSchedule ?? person?.shift?.name ?? "",
  );
  const shift = person?.shift;
  const overnight = Number.isFinite(Number(shift?.start)) && Number.isFinite(Number(shift?.end)) && Number(shift.start) >= Number(shift.end);
  const extendedWeek = asArray(shift?.days).length >= 6;
  return Boolean(person?.nightShift || person?.rotatingShift || overnight || extendedWeek || includesAny(schedule, ["noturn", "rotativ", "plantao", "7 dias"]));
};

const isAvailableCaregiver = (person) => {
  if (!alive(person) || ageOf(person) < 16) return false;
  if (person?.hospitalized || person?.medical?.admitted) return false;
  if (person?.disabled && Number(person?.mobility ?? 100) < 25) return false;
  return !isWorking(person);
};

const healthSeverity = (person) => {
  const health = clamp(person?.health ?? person?.healthScore ?? 100, 0, 100);
  const conditions = asArray(person?.conditions ?? person?.medical?.conditions ?? person?.healthRecord?.conditions);
  const conditionSeverity = conditions.reduce((maximum, condition) => {
    const active = typeof condition === "object" ? condition.active !== false : true;
    return active ? Math.max(maximum, Number(condition?.severity ?? 25) || 25) : maximum;
  }, 0);
  const admission = person?.hospitalized || person?.medical?.admitted ? 75 : 0;
  const mobility = Number(person?.mobility);
  const mobilityRisk = Number.isFinite(mobility) ? 100 - clamp(mobility) : 0;
  return clamp(Math.max(100 - health, conditionSeverity, admission, mobilityRisk));
};

const householdReferenceOf = (person) =>
  idOf(
    person?.householdId ??
      person?.familyHouseholdId ??
      person?.homeId ??
      person?.residenceId ??
      person?.propertyId ??
      person?.addressId,
  );

const explicitHomeReferenceOf = (person) =>
  idOf(person?.homeId ?? person?.residenceId ?? person?.propertyId ?? person?.addressId);

const residentIdsFromHousehold = (household) =>
  unique(
    household?.residentIds ??
      household?.residents ??
      household?.memberIds ??
      household?.members ??
      household?.occupants,
    COMMUNITY_REACTIVITY_LIMITS.residentIdsPerCase * 4,
  );

const createIndexes = (snapshot = {}) => {
  const residents = asArray(snapshot.residents ?? snapshot.people ?? snapshot.population).filter(alive);
  const residentById = new Map(residents.map((person) => [idOf(person), person]).filter(([id]) => id));
  const housingEntries = asArray(snapshot.housing ?? snapshot.properties ?? snapshot.residences ?? snapshot.homes);
  const housingById = new Map(housingEntries.map((entry) => [idOf(entry), entry]).filter(([id]) => id));
  const explicitHouseholds = asArray(snapshot.households ?? snapshot.families);
  const householdById = new Map();
  const householdByResidentId = new Map();

  for (const household of explicitHouseholds) {
    const householdId = idOf(household) || `household:${householdById.size + 1}`;
    const residentIds = residentIdsFromHousehold(household).filter((id) => residentById.has(id));
    const normalized = { ...household, id: householdId, residentIds };
    householdById.set(householdId, normalized);
    residentIds.forEach((residentId) => householdByResidentId.set(residentId, householdId));
  }

  for (const person of residents) {
    const residentId = idOf(person);
    if (!residentId || householdByResidentId.has(residentId)) continue;
    const reference = householdReferenceOf(person);
    const householdId = reference ? `derived:${reference}` : `resident:${residentId}`;
    if (!householdById.has(householdId)) householdById.set(householdId, { id: householdId, residentIds: [] });
    householdById.get(householdId).residentIds.push(residentId);
    householdByResidentId.set(residentId, householdId);
  }

  const parentIdsByChildId = new Map();
  for (const person of residents) {
    const childId = idOf(person);
    const parentIds = unique([
      ...asArray(person?.parentIds),
      ...asArray(person?.parents),
      ...asArray(person?.guardianIds),
      person?.motherId,
      person?.fatherId,
      person?.parentAId,
      person?.parentBId,
    ]).filter((id) => id !== childId && residentById.has(id));
    parentIdsByChildId.set(childId, parentIds);
  }

  return {
    residents,
    residentById,
    housingEntries,
    housingById,
    households: [...householdById.values()],
    householdById,
    householdByResidentId,
    parentIdsByChildId,
  };
};

const demandRecord = ({ service, applicantId, residentIds, priorityScore, units = 1, reasonCodes, details }) => ({
  id: `${service}:${applicantId}`,
  service,
  applicantId: text(applicantId),
  residentIds: unique(residentIds, COMMUNITY_REACTIVITY_LIMITS.residentIdsPerCase),
  priorityScore: round(clamp(priorityScore, 0, 100), 1),
  units: Math.max(1, Math.floor(Number(units) || 1)),
  reasonCodes: unique(reasonCodes, COMMUNITY_REACTIVITY_LIMITS.reasonCodes),
  details: details && typeof details === "object" ? { ...details } : {},
});

const daycareDemands = (indexes) => {
  const demands = [];
  for (const child of indexes.residents) {
    const age = ageOf(child);
    if (age >= 6) continue;
    if (child?.childcare?.privateProvider || child?.childcare?.homeCare || child?.hasAtHomeCaregiver) continue;

    const childId = idOf(child);
    const householdId = indexes.householdByResidentId.get(childId);
    const household = indexes.householdById.get(householdId);
    const householdAdults = (household?.residentIds || [])
      .map((id) => indexes.residentById.get(id))
      .filter((person) => ageOf(person) >= 16 && idOf(person) !== childId);
    const parentIds = indexes.parentIdsByChildId.get(childId) || [];
    const guardians = (parentIds.length ? parentIds.map((id) => indexes.residentById.get(id)) : householdAdults).filter(Boolean);
    if (!guardians.length) continue;

    const workingGuardians = guardians.filter(isWorking);
    const availableCaregivers = householdAdults.filter(isAvailableCaregiver);
    const explicitlyNeedsCare = child?.needsChildcare === true || child?.childcare?.needed === true;
    if (!explicitlyNeedsCare && (!workingGuardians.length || availableCaregivers.length)) continue;

    const singleCaregiver = guardians.length === 1;
    const lowIncome = sum(guardians.map(incomeOf)) / Math.max(1, guardians.length) < 700;
    const irregular = guardians.some(hasIrregularWork);
    const alreadyEnrolled = Boolean(child?.daycareId || child?.childcare?.enrolled || child?.childcare?.providerId);
    const reasons = ["young_child", "working_guardians"];
    if (singleCaregiver) reasons.push("single_caregiver");
    if (lowIncome) reasons.push("low_income");
    if (irregular) reasons.push("irregular_work_schedule");
    if (alreadyEnrolled) reasons.push("continuing_care");

    demands.push(
      demandRecord({
        service: COMMUNITY_SERVICE_TYPES.DAYCARE,
        applicantId: childId,
        residentIds: [childId, ...guardians.map(idOf)],
        priorityScore:
          40 +
          (6 - age) * 3 +
          (singleCaregiver ? 15 : 0) +
          (lowIncome ? 12 : 0) +
          (irregular ? 8 : 0) +
          (alreadyEnrolled ? 6 : 0) +
          clamp(55 - Number(child?.health ?? 100), 0, 15),
        reasonCodes: reasons,
        details: {
          childId,
          childAge: age,
          guardianIds: guardians.map(idOf),
          workingGuardianIds: workingGuardians.map(idOf),
          householdId,
          alreadyEnrolled,
        },
      }),
    );
  }
  return demands;
};

const relationshipPeople = (relationship) =>
  unique([
    ...asArray(relationship?.partnerIds),
    ...asArray(relationship?.personIds),
    ...asArray(relationship?.people),
    ...asArray(relationship?.members),
    relationship?.personAId,
    relationship?.personBId,
    relationship?.aId,
    relationship?.bId,
    relationship?.a,
    relationship?.b,
    relationship?.fromId,
    relationship?.toId,
    relationship?.ownerId,
    relationship?.targetId,
  ]);

const relationshipStage = (relationship) =>
  lower(
    relationship?.lifecycle?.stage ??
      relationship?.relationshipStage ??
      relationship?.stage ??
      relationship?.status ??
      relationship?.type,
  ).replace(/\s+/g, "_");

const sharedChildrenFor = (relationship, peopleIds, indexes) => {
  const explicitChildren = unique([
    ...asArray(relationship?.sharedChildren),
    ...asArray(relationship?.childIds),
    ...asArray(relationship?.children),
    ...asArray(relationship?.lifecycle?.familyPlanning?.children),
    ...asArray(relationship?.lifecycle?.familyPlanning?.childrenIds),
  ]).filter((id) => indexes.residentById.has(id));
  if (explicitChildren.length) return explicitChildren;
  if (peopleIds.length < 2) return [];
  const pair = new Set(peopleIds.slice(0, 2));
  return indexes.residents
    .filter((person) => {
      const parents = indexes.parentIdsByChildId.get(idOf(person)) || [];
      return [...pair].every((partnerId) => parents.includes(partnerId));
    })
    .map(idOf);
};

const mediationDemands = (snapshot, indexes) => {
  const deduplicated = new Map();
  for (const relationship of asArray(snapshot.relationships ?? snapshot.socialLinks ?? snapshot.links)) {
    const peopleIds = relationshipPeople(relationship).filter((id) => indexes.residentById.has(id)).slice(0, 2);
    if (peopleIds.length !== 2) continue;
    const stage = relationshipStage(relationship);
    if (stage && !ROMANTIC_STAGES.has(stage) && !relationship?.isRomantic) continue;
    const childIds = sharedChildrenFor(relationship, peopleIds, indexes);
    if (!childIds.length) continue;

    const metrics = relationship?.lifecycle?.metrics ?? relationship?.metrics ?? relationship;
    const tension = clamp(metrics?.tension ?? metrics?.conflict ?? relationship?.conflictLevel ?? 0);
    const communication = clamp(metrics?.communication ?? 50);
    const satisfaction = clamp(metrics?.satisfaction ?? 50);
    const conflictExperiences = asArray(
      relationship?.lifecycle?.experiences ?? relationship?.recentInteractions ?? relationship?.history,
    ).filter((entry) =>
      includesAny(entry?.type ?? entry?.kind ?? entry?.label, ["discuss", "conflit", "ciume", "agress", "separ"]),
    ).length;
    const separated = SEPARATION_STAGES.has(stage);
    const explicitNeed = relationship?.mediationNeeded || relationship?.custodyDispute || relationship?.coparentingConflict;
    if (!separated && !explicitNeed && tension < 55 && conflictExperiences < 2) continue;

    const pairKey = [...peopleIds].sort().join(":");
    const reasons = ["shared_children"];
    if (separated) reasons.push("separation_with_children");
    if (tension >= 55) reasons.push("high_relationship_tension");
    if (communication < 38) reasons.push("poor_communication");
    if (relationship?.custodyDispute) reasons.push("custody_dispute");
    if (conflictExperiences) reasons.push("recent_conflicts");
    const record = demandRecord({
      service: COMMUNITY_SERVICE_TYPES.FAMILY_MEDIATION,
      applicantId: pairKey,
      residentIds: [...peopleIds, ...childIds],
      priorityScore:
        34 +
        tension * 0.34 +
        (100 - communication) * 0.12 +
        (separated ? 12 : 0) +
        (relationship?.custodyDispute ? 16 : 0) +
        Math.min(10, conflictExperiences * 2) +
        Math.min(8, childIds.length * 2),
      reasonCodes: reasons,
      details: {
        relationshipId: idOf(relationship),
        adultIds: peopleIds,
        childIds,
        stage: stage || "unknown",
        tension,
        communication,
        satisfaction,
        conflictExperiences,
      },
    });
    const previous = deduplicated.get(pairKey);
    if (!previous || previous.priorityScore < record.priorityScore) deduplicated.set(pairKey, record);
  }
  return [...deduplicated.values()];
};

const elderSupportDemands = (indexes) => {
  const demands = [];
  for (const elder of indexes.residents) {
    const age = ageOf(elder);
    if (age < 65) continue;
    const elderId = idOf(elder);
    const householdId = indexes.householdByResidentId.get(elderId);
    const household = indexes.householdById.get(householdId);
    const householdSize = household?.residentIds?.length || 1;
    const alone = elder?.livesAlone === true || householdSize === 1;
    const severity = healthSeverity(elder);
    const sick = severity >= 28 || elder?.needsHomeCare || elder?.medical?.sickLeave > 0;
    if (!alone && !sick) continue;

    const recentDischarge = Boolean(elder?.recentlyDischarged || elder?.medical?.recentDischarge);
    const noNearbyFamily = elder?.nearbyFamilyCount === 0 || elder?.supportNetwork === "none";
    const reasons = [];
    if (alone) reasons.push("elder_living_alone");
    if (sick) reasons.push("elder_health_vulnerability");
    if (severity >= 60) reasons.push("high_clinical_risk");
    if (recentDischarge) reasons.push("post_discharge_support");
    if (noNearbyFamily) reasons.push("weak_support_network");

    demands.push(
      demandRecord({
        service: COMMUNITY_SERVICE_TYPES.ELDER_HOME_SUPPORT,
        applicantId: elderId,
        residentIds: [elderId],
        units: severity >= 70 || recentDischarge ? 2 : 1,
        priorityScore:
          26 +
          Math.max(0, age - 65) * 0.7 +
          severity * 0.42 +
          (alone ? 16 : 0) +
          (recentDischarge ? 15 : 0) +
          (noNearbyFamily ? 8 : 0),
        reasonCodes: reasons,
        details: { elderId, age, householdId, householdSize, alone, healthSeverity: severity, recentDischarge },
      }),
    );
  }
  return demands;
};

const housingForHousehold = (household, members, indexes) => {
  const direct = household?.home ?? household?.housing ?? household?.residence ?? household?.property;
  if (direct && typeof direct === "object") return direct;
  const reference = idOf(
    household?.homeId ??
      household?.housingId ??
      household?.residenceId ??
      household?.propertyId ??
      members.map(explicitHomeReferenceOf).find(Boolean),
  );
  return indexes.housingById.get(reference) ?? (reference ? { id: reference } : null);
};

const transitionalHousingDemands = (indexes) => {
  const demands = [];
  for (const household of indexes.households) {
    const members = household.residentIds.map((id) => indexes.residentById.get(id)).filter(Boolean);
    if (!members.length) continue;
    const housing = housingForHousehold(household, members, indexes);
    const status = lower(
      household?.housingStatus ??
        household?.tenure ??
        housing?.status ??
        members.map((person) => person?.housingStatus ?? person?.housing).find(Boolean) ??
        "",
    );
    const type = lower(household?.housingType ?? housing?.type ?? housing?.category ?? housing?.kind ?? "");
    const noExplicitHome = !housing && members.every((person) => !explicitHomeReferenceOf(person));
    const unhoused =
      household?.homeless === true ||
      members.some((person) => person?.homeless === true) ||
      includesAny(status, UNHOUSED_TERMS) ||
      noExplicitHome;
    const temporary =
      household?.temporaryHousing === true ||
      housing?.temporary === true ||
      members.some((person) => person?.temporaryAccommodation || person?.hotelGuest) ||
      includesAny(`${status} ${type}`, TEMPORARY_HOUSING_TERMS);
    const pendingMove = Boolean(
      household?.pendingMove ||
        household?.awaitingHousing ||
        members.some((person) => person?.pendingMove || person?.homeUnderConstruction),
    );
    const evictionRisk = Boolean(
      household?.evictionNotice ||
        household?.evictionRisk ||
        housing?.foreclosure ||
        members.some((person) => person?.evictionNotice),
    );
    const uninhabitable = Boolean(
      housing?.habitable === false ||
        housing?.condemned ||
        housing?.destroyed ||
        household?.displaced,
    );
    const bedrooms = Math.max(0, Number(housing?.bedrooms ?? household?.bedrooms ?? 0) || 0);
    const capacity = Math.max(0, Number(housing?.capacity ?? household?.capacity ?? bedrooms * 2) || 0);
    const overcrowded = Boolean(
      household?.overcrowded || housing?.overcrowded || (capacity > 0 && members.length > capacity),
    );
    if (!unhoused && !temporary && !pendingMove && !evictionRisk && !uninhabitable && !overcrowded) continue;

    const children = members.filter((person) => ageOf(person) < 18).length;
    const elders = members.filter((person) => ageOf(person) >= 65).length;
    const medicallyVulnerable = members.filter((person) => healthSeverity(person) >= 45).length;
    const reasons = [];
    if (unhoused) reasons.push("unhoused_household");
    if (temporary) reasons.push("temporary_accommodation");
    if (pendingMove) reasons.push("pending_permanent_housing");
    if (evictionRisk) reasons.push("eviction_risk");
    if (uninhabitable) reasons.push("uninhabitable_home");
    if (overcrowded) reasons.push("overcrowding");
    if (children) reasons.push("children_in_household");
    if (medicallyVulnerable) reasons.push("medical_vulnerability");

    demands.push(
      demandRecord({
        service: COMMUNITY_SERVICE_TYPES.TRANSITIONAL_HOUSING,
        applicantId: household.id,
        residentIds: members.map(idOf),
        units: members.length,
        priorityScore:
          24 +
          (unhoused ? 28 : 0) +
          (uninhabitable ? 25 : 0) +
          (evictionRisk ? 17 : 0) +
          (temporary ? 12 : 0) +
          (pendingMove ? 8 : 0) +
          (overcrowded ? 10 : 0) +
          Math.min(15, children * 4) +
          Math.min(9, elders * 3) +
          Math.min(12, medicallyVulnerable * 4),
        reasonCodes: reasons,
        details: {
          householdId: household.id,
          housingId: idOf(housing),
          householdSize: members.length,
          children,
          elders,
          medicallyVulnerable,
          temporary,
          unhoused,
          overcrowded,
        },
      }),
    );
  }
  return demands;
};

/** Cria o estado inicial, pronto para persistência junto ao save da cidade. */
export function createCommunityReactivityState(options = {}) {
  const week = normalizedWeek(options.week);
  return {
    version: COMMUNITY_REACTIVITY_VERSION,
    week,
    capacities: normalizeCapacities(options.capacities),
    activeCases: emptyServiceRecord(),
    waitlists: emptyServiceRecord(),
    indicators: createEmptyIndicators(week),
    recentResponses: [],
    recentConsequences: [],
    history: [],
    revision: 0,
  };
}

/**
 * Analisa um snapshot semanal sem alocar vagas. Campos aceitos têm aliases para
 * permitir integração gradual: residents/people/population, relationships/links,
 * households/families e housing/properties/residences.
 */
export function analyzeWeeklyCommunityNeeds(snapshot = {}, options = {}) {
  const indexes = createIndexes(snapshot);
  const week = normalizedWeek(options.week ?? snapshot.week ?? snapshot.clock?.week);
  const demands = {
    daycare: daycareDemands(indexes),
    familyMediation: mediationDemands(snapshot, indexes),
    elderHomeSupport: elderSupportDemands(indexes),
    transitionalHousing: transitionalHousingDemands(indexes),
  };
  for (const service of SERVICE_KEYS) {
    demands[service] = demands[service]
      .sort((a, b) => b.priorityScore - a.priorityScore || a.id.localeCompare(b.id))
      .slice(0, COMMUNITY_REACTIVITY_LIMITS.demandsPerService);
  }
  const totals = Object.fromEntries(
    SERVICE_KEYS.map((service) => [
      service,
      { cases: demands[service].length, units: sum(demands[service].map((demand) => demand.units)) },
    ]),
  );
  return {
    version: COMMUNITY_REACTIVITY_VERSION,
    week,
    population: indexes.residents.length,
    householdCount: indexes.households.length,
    demands,
    totals,
  };
}

const previousCaseMap = (previousState, service) => {
  const map = new Map();
  for (const entry of [
    ...asArray(previousState?.activeCases?.[service]),
    ...asArray(previousState?.waitlists?.[service]),
  ]) {
    if (entry?.id) map.set(entry.id, entry);
  }
  return map;
};

const caseFromDemand = (demand, status, week, previous, tieBreaker) => ({
  ...demand,
  status,
  requestedWeek: normalizedWeek(previous?.requestedWeek ?? week),
  startedWeek: status === "allocated" ? normalizedWeek(previous?.startedWeek ?? week) : null,
  waitWeeks: status === "waitlisted" ? Math.max(1, week - normalizedWeek(previous?.requestedWeek ?? week) + 1) : 0,
  reviewWeek: week + 1,
  continuity: previous?.status === status || (status === "allocated" && previous?.status === "allocated"),
  tieBreaker: round(tieBreaker, 6),
});

/** Distribui capacidade por prioridade, continuidade e tempo de espera. */
export function allocateCommunityCapacity(analysis, options = {}) {
  const week = normalizedWeek(options.week ?? analysis?.week);
  const capacities = normalizeCapacities(options.capacities ?? options.previousState?.capacities);
  const allocations = emptyServiceRecord();
  const waitlists = emptyServiceRecord();
  const utilization = {};

  for (const service of SERVICE_KEYS) {
    const previousById = previousCaseMap(options.previousState, service);
    const candidates = asArray(analysis?.demands?.[service]).map((demand) => {
      const previous = previousById.get(demand.id);
      const waitBonus = Math.min(16, Number(previous?.waitWeeks ?? 0) * 2);
      const continuityBonus = previous?.status === "allocated" ? 8 : 0;
      return {
        demand,
        previous,
        effectivePriority: demand.priorityScore + waitBonus + continuityBonus,
        tieBreaker: safeRandom(options.random, `${week}:${service}:${demand.id}`),
      };
    });
    candidates.sort(
      (a, b) =>
        b.effectivePriority - a.effectivePriority ||
        b.tieBreaker - a.tieBreaker ||
        a.demand.id.localeCompare(b.demand.id),
    );

    let remaining = capacities[service];
    for (const candidate of candidates) {
      if (
        candidate.demand.units <= remaining &&
        allocations[service].length < COMMUNITY_REACTIVITY_LIMITS.activeCasesPerService
      ) {
        remaining -= candidate.demand.units;
        allocations[service].push(
          caseFromDemand(candidate.demand, "allocated", week, candidate.previous, candidate.tieBreaker),
        );
      } else if (waitlists[service].length < COMMUNITY_REACTIVITY_LIMITS.waitlistPerService) {
        waitlists[service].push(
          caseFromDemand(candidate.demand, "waitlisted", week, candidate.previous, candidate.tieBreaker),
        );
      }
    }
    const used = capacities[service] - remaining;
    utilization[service] = {
      capacity: capacities[service],
      used,
      remaining,
      rate: capacities[service] ? round((used / capacities[service]) * 100, 1) : 0,
      servedCases: allocations[service].length,
      waitlistedCases: waitlists[service].length,
      unmetUnits: sum(waitlists[service].map((entry) => entry.units)),
    };
  }
  return { week, capacities, allocations, waitlists, utilization };
}

const allocatedResponse = (entry, week) => {
  const common = {
    id: `response:${week}:${entry.id}`,
    week,
    service: entry.service,
    status: "allocated",
    caseId: entry.id,
    applicantId: entry.applicantId,
    residentIds: entry.residentIds,
    priorityScore: entry.priorityScore,
    reviewWeek: entry.reviewWeek,
  };
  if (entry.service === COMMUNITY_SERVICE_TYPES.DAYCARE) {
    return { ...common, action: "municipal_daycare_slot", summary: "Vaga semanal de creche e rotina de entrega segura organizadas.", interventions: ["supervised_childcare", "guardian_schedule_coordination", "attendance_monitoring"] };
  }
  if (entry.service === COMMUNITY_SERVICE_TYPES.FAMILY_MEDIATION) {
    return { ...common, action: "family_mediation_plan", summary: "Mediação familiar e plano de coparentalidade iniciados.", interventions: ["mediated_session", "child_centered_agreement", "conflict_followup"] };
  }
  if (entry.service === COMMUNITY_SERVICE_TYPES.ELDER_HOME_SUPPORT) {
    return { ...common, action: "elder_home_visit", summary: "Visita domiciliar, checagem de saúde e rede de apoio mobilizadas.", interventions: ["wellbeing_check", "medication_check", "meal_and_network_support"] };
  }
  return { ...common, action: "transitional_housing_placement", summary: "Acolhimento transitório e busca ativa por moradia permanente iniciados.", interventions: ["temporary_beds", "housing_case_management", "benefit_and_property_search"] };
};

const waitlistResponse = (entry, week) => ({
  id: `response:${week}:${entry.id}:wait`,
  week,
  service: entry.service,
  status: "waitlisted",
  caseId: entry.id,
  applicantId: entry.applicantId,
  residentIds: entry.residentIds,
  priorityScore: entry.priorityScore,
  waitWeeks: entry.waitWeeks,
  action: "priority_waitlist_monitoring",
  summary: "Demanda registrada; vulnerabilidade será reavaliada na próxima semana.",
  interventions: ["weekly_reassessment", "emergency_escalation_if_needed"],
});

/** Gera respostas operacionais e recomendações de expansão da rede. */
export function buildCommunityResponses(allocation) {
  const week = normalizedWeek(allocation?.week);
  const caseResponses = SERVICE_KEYS.flatMap((service) => [
    ...asArray(allocation?.allocations?.[service]).map((entry) => allocatedResponse(entry, week)),
    ...asArray(allocation?.waitlists?.[service]).map((entry) => waitlistResponse(entry, week)),
  ]).slice(0, COMMUNITY_REACTIVITY_LIMITS.recentResponses);
  const structuralResponses = SERVICE_KEYS.flatMap((service) => {
    const utilization = allocation?.utilization?.[service];
    if (!utilization?.waitlistedCases) return [];
    const urgency = utilization.unmetUnits >= Math.max(4, utilization.capacity * 0.5) ? "high" : "moderate";
    return [{
      id: `capacity-response:${week}:${service}`,
      week,
      service,
      action: "expand_or_contract_service_capacity",
      urgency,
      trigger: "persistent_or_current_waitlist",
      recommendedCapacityDelta: Math.max(1, Math.ceil(utilization.unmetUnits * (urgency === "high" ? 0.5 : 0.3))),
      affectedCases: utilization.waitlistedCases,
      summary: `A rede de ${service} precisa absorver ${utilization.unmetUnits} unidade(s) ainda não atendida(s).`,
    }];
  });
  return { caseResponses, structuralResponses };
}

const consequenceFor = (entry, allocated, week) => {
  const base = {
    id: `consequence:${week}:${entry.id}:${allocated ? "served" : "waiting"}`,
    week,
    service: entry.service,
    status: allocated ? "protective" : "unmet_need",
    caseId: entry.id,
    applicantId: entry.applicantId,
    residentIds: entry.residentIds,
    durationWeeks: 1,
  };
  if (entry.service === COMMUNITY_SERVICE_TYPES.DAYCARE) {
    return allocated
      ? { ...base, effects: { childSafety: 8, childDevelopment: 3, guardianWorkReliability: 9, householdStress: -5, incomeInstabilityRisk: -6 } }
      : { ...base, effects: { guardianWorkReliability: -6, householdStress: 5, incomeInstabilityRisk: 7, missedWorkRisk: 8 } };
  }
  if (entry.service === COMMUNITY_SERVICE_TYPES.FAMILY_MEDIATION) {
    return allocated
      ? { ...base, effects: { relationshipTension: -7, communication: 6, coparentingCoordination: 8, childConflictExposure: -8 } }
      : { ...base, effects: { relationshipTension: 4, childConflictExposure: 5, custodyEscalationRisk: 4, householdStress: 3 } };
  }
  if (entry.service === COMMUNITY_SERVICE_TYPES.ELDER_HOME_SUPPORT) {
    return allocated
      ? { ...base, effects: { isolation: -8, treatmentAdherence: 7, preventableEmergencyRisk: -6, wellbeing: 5 } }
      : { ...base, effects: { isolation: 5, treatmentAdherence: -3, preventableEmergencyRisk: 6, healthDeteriorationRisk: 4 } };
  }
  return allocated
    ? { ...base, effects: { housingStability: 12, exposureRisk: -9, schoolAndWorkContinuity: 6, householdStress: -7 } }
    : { ...base, effects: { housingStability: -6, exposureRisk: 8, schoolAndWorkContinuity: -5, householdStress: 7 } };
};

/** Traduz atendimento e espera em modificadores de gameplay fáceis de aplicar. */
export function buildCommunityConsequences(allocation) {
  return SERVICE_KEYS.flatMap((service) => [
    ...asArray(allocation?.allocations?.[service]).map((entry) => consequenceFor(entry, true, allocation.week)),
    ...asArray(allocation?.waitlists?.[service]).map((entry) => consequenceFor(entry, false, allocation.week)),
  ]).slice(0, COMMUNITY_REACTIVITY_LIMITS.recentConsequences);
}

function createEmptyIndicators(week = 0) {
  return {
    week: normalizedWeek(week),
    population: 0,
    households: 0,
    requestedCases: 0,
    servedCases: 0,
    waitlistedCases: 0,
    requestedUnits: 0,
    servedUnits: 0,
    coverageRate: 100,
    pressureIndex: 0,
    highPriorityWaiting: 0,
    byService: Object.fromEntries(
      SERVICE_KEYS.map((service) => [service, { requestedCases: 0, servedCases: 0, waitlistedCases: 0, requestedUnits: 0, servedUnits: 0, coverageRate: 100 }]),
    ),
  };
}

/** Consolida indicadores para painel, jornal e decisões da prefeitura. */
export function calculateCommunityIndicators(analysis, allocation) {
  const indicators = createEmptyIndicators(analysis?.week ?? allocation?.week);
  indicators.population = Math.max(0, Number(analysis?.population) || 0);
  indicators.households = Math.max(0, Number(analysis?.householdCount) || 0);
  for (const service of SERVICE_KEYS) {
    const demands = asArray(analysis?.demands?.[service]);
    const served = asArray(allocation?.allocations?.[service]);
    const waiting = asArray(allocation?.waitlists?.[service]);
    const requestedUnits = sum(demands.map((entry) => entry.units));
    const servedUnits = sum(served.map((entry) => entry.units));
    const record = {
      requestedCases: demands.length,
      servedCases: served.length,
      waitlistedCases: waiting.length,
      requestedUnits,
      servedUnits,
      coverageRate: requestedUnits ? round((servedUnits / requestedUnits) * 100, 1) : 100,
    };
    indicators.byService[service] = record;
    indicators.requestedCases += record.requestedCases;
    indicators.servedCases += record.servedCases;
    indicators.waitlistedCases += record.waitlistedCases;
    indicators.requestedUnits += requestedUnits;
    indicators.servedUnits += servedUnits;
    indicators.highPriorityWaiting += waiting.filter((entry) => entry.priorityScore >= 75).length;
  }
  indicators.coverageRate = indicators.requestedUnits
    ? round((indicators.servedUnits / indicators.requestedUnits) * 100, 1)
    : 100;
  indicators.pressureIndex = indicators.requestedUnits
    ? round(clamp((indicators.requestedUnits - indicators.servedUnits) / indicators.requestedUnits, 0, 1) * 100, 1)
    : 0;
  return indicators;
}

/**
 * Pipeline principal: diagnostica, aloca, gera efeitos e retorna o próximo
 * estado. É a função indicada para o tick semanal da simulação.
 */
export function runCommunityReactivityWeek(previousState, snapshot = {}, options = {}) {
  const baseState = previousState?.version === COMMUNITY_REACTIVITY_VERSION
    ? previousState
    : createCommunityReactivityState(options);
  const week = normalizedWeek(options.week ?? snapshot.week ?? baseState.week + 1);
  const capacities = normalizeCapacities({ ...baseState.capacities, ...(options.capacities ?? {}) });
  const analysis = analyzeWeeklyCommunityNeeds(snapshot, { week });
  const allocation = allocateCommunityCapacity(analysis, {
    week,
    capacities,
    previousState: baseState,
    random: options.random,
  });
  const responses = buildCommunityResponses(allocation);
  const consequences = buildCommunityConsequences(allocation);
  const indicators = calculateCommunityIndicators(analysis, allocation);
  const historyEntry = {
    week,
    requestedCases: indicators.requestedCases,
    servedCases: indicators.servedCases,
    waitlistedCases: indicators.waitlistedCases,
    coverageRate: indicators.coverageRate,
    pressureIndex: indicators.pressureIndex,
  };
  const state = {
    version: COMMUNITY_REACTIVITY_VERSION,
    week,
    capacities,
    activeCases: allocation.allocations,
    waitlists: allocation.waitlists,
    indicators,
    recentResponses: bounded(
      [...responses.caseResponses, ...responses.structuralResponses],
      COMMUNITY_REACTIVITY_LIMITS.recentResponses,
    ),
    recentConsequences: bounded(consequences, COMMUNITY_REACTIVITY_LIMITS.recentConsequences),
    history: [...asArray(baseState.history), historyEntry].slice(-COMMUNITY_REACTIVITY_LIMITS.historyWeeks),
    revision: Math.max(0, Math.floor(Number(baseState.revision) || 0)) + 1,
  };
  return { state, analysis, allocation, responses, consequences, indicators };
}

/** Resumo pequeno para logs, fichas administrativas ou notícias. */
export function summarizeCommunityReactivity(state) {
  const indicators = state?.indicators ?? createEmptyIndicators(state?.week);
  const pressureRanking = SERVICE_KEYS
    .map((service) => ({ service, waitlisted: Number(indicators?.byService?.[service]?.waitlistedCases) || 0 }))
    .sort((a, b) => b.waitlisted - a.waitlisted || a.service.localeCompare(b.service));
  return {
    week: normalizedWeek(state?.week),
    coverageRate: round(indicators.coverageRate, 1),
    pressureIndex: round(indicators.pressureIndex, 1),
    servedCases: Math.max(0, Number(indicators.servedCases) || 0),
    waitlistedCases: Math.max(0, Number(indicators.waitlistedCases) || 0),
    highPriorityWaiting: Math.max(0, Number(indicators.highPriorityWaiting) || 0),
    mostPressuredService: pressureRanking[0]?.waitlisted > 0 ? pressureRanking[0].service : null,
  };
}
