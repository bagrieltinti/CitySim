const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};
const trend = (current, previous, tolerance = 2) => current > previous + tolerance ? "rising" : current < previous - tolerance ? "falling" : "stable";

export const developmentStageCatalog = Object.freeze([
  { id: "consolidated_village", label: "Vila consolidada", minPopulation: 0, minAttractiveness: 0, minDistricts: 1, nextPopulation: 230 },
  { id: "forming_center", label: "Centro urbano em formação", minPopulation: 230, minAttractiveness: 42, minDistricts: 3, nextPopulation: 300 },
  { id: "expanding_city", label: "Cidade em expansão", minPopulation: 300, minAttractiveness: 50, minDistricts: 4, nextPopulation: 450 },
  { id: "regional_city", label: "Cidade regional", minPopulation: 450, minAttractiveness: 57, minDistricts: 5, nextPopulation: 700 },
  { id: "urban_hub", label: "Polo urbano", minPopulation: 700, minAttractiveness: 64, minDistricts: 7, nextPopulation: 1000 },
]);

const pressureCatalog = Object.freeze({
  housing: { label: "Moradia", goodWhenLow: true },
  jobs: { label: "Trabalho", goodWhenLow: true },
  services: { label: "Serviços públicos", goodWhenLow: true },
  mobility: { label: "Mobilidade", goodWhenLow: true },
  land: { label: "Terrenos urbanizados", goodWhenLow: true },
  infrastructure: { label: "Infraestrutura", goodWhenLow: true },
  fiscal: { label: "Capacidade fiscal", goodWhenLow: true },
});

function attractivenessOf(snapshot = {}) {
  const unemployment = clamp(snapshot.labor?.unemploymentRate, 0, 100), vacancies = Math.max(0, snapshot.labor?.vacancies || 0);
  const vacancyRate = snapshot.housing?.capacity ? snapshot.housing.vacant / snapshot.housing.capacity * 100 : 0;
  const hotelPressure = Math.max(0, snapshot.housing?.hotelGuests || 0);
  const crimeRate = Math.max(0, snapshot.services?.crimeRate || 0);
  const components = {
    jobs: clamp(72 - unemployment * 2.15 + Math.min(14, vacancies * 1.8)),
    housing: clamp(53 + vacancyRate * 2.2 - hotelPressure * 2.4 - Math.max(0, (snapshot.housing?.priceIndex || 100) - 115) * .2),
    services: clamp(((snapshot.services?.health || 70) + (snapshot.services?.education || 70) + (snapshot.services?.civic || 70)) / 3),
    safety: clamp(88 - crimeRate * 4.5),
    mobility: clamp(86 - (snapshot.mobility?.averageWait || 0) * 1.25 - (snapshot.mobility?.congestion || 0) * .35),
    environment: clamp((snapshot.environment?.airQuality || 75) * .7 + (snapshot.environment?.green || 55) * .3),
    governance: clamp(snapshot.governance?.approval || 55),
  };
  const score = round(components.jobs * .22 + components.housing * .2 + components.services * .17 + components.safety * .12 + components.mobility * .11 + components.environment * .08 + components.governance * .1, 1);
  return { score, components };
}

function pressuresOf(snapshot = {}, previous = {}) {
  const occupancy = snapshot.housing?.capacity ? snapshot.housing.occupied / snapshot.housing.capacity : 1;
  const projectedVacancy = Math.max(0, (snapshot.housing?.vacant || 0) + (snapshot.housing?.pipelineCapacity || 0));
  const reserveTarget = Math.max(12, Math.ceil((snapshot.population || 0) * .075));
  const housing = clamp((occupancy - .72) * 220 + (snapshot.housing?.hotelGuests || 0) * 4 + Math.max(0, reserveTarget - projectedVacancy) * 2.8);
  const jobs = clamp((snapshot.labor?.unemploymentRate || 0) * 6 + Math.max(0, (snapshot.labor?.vacancies || 0) - Math.ceil((snapshot.population || 0) / 100)) * 5);
  const healthLoad = snapshot.services?.healthCapacity ? snapshot.services.healthOccupied / snapshot.services.healthCapacity * 100 : 50;
  const educationLoad = snapshot.services?.educationCapacity ? snapshot.services.educationOccupied / snapshot.services.educationCapacity * 100 : 50;
  const services = clamp(Math.max(0, healthLoad - 62) * 1.25 + Math.max(0, educationLoad - 72) * .9 + Math.max(0, 68 - (snapshot.services?.civic || 68)));
  const mobility = clamp((snapshot.mobility?.averageWait || 0) * 2.4 + (snapshot.mobility?.congestion || 0) * .65 + (snapshot.mobility?.failures || 0) * 8);
  const availableLots = Math.max(0, snapshot.land?.availableLots || 0), land = clamp((10 - availableLots) * 8 + (snapshot.land?.activeExpansion ? -20 : 0) + Math.max(0, occupancy - .8) * 95);
  const infrastructure = clamp(100 - (snapshot.infrastructure?.condition || 72) + (snapshot.infrastructure?.outages || 0) * 10 + (snapshot.land?.activeExpansion ? 8 : 0));
  const weeklyBalance = (snapshot.governance?.weeklyRevenue || 0) - (snapshot.governance?.weeklySpending || 0), treasuryFloor = Math.max(90000, (snapshot.population || 0) * 420);
  const fiscal = clamp((weeklyBalance < 0 ? Math.abs(weeklyBalance) / 2200 : 0) + Math.max(0, treasuryFloor - (snapshot.governance?.treasury || 0)) / 3500);
  const values = { housing, jobs, services, mobility, land, infrastructure, fiscal };
  return Object.entries(values).map(([id, value]) => {
    const drivers = {
      housing: [`${Math.round(occupancy * 100)}% da capacidade ocupada`, `${snapshot.housing?.hotelGuests || 0} pessoa(s) em hospedagem temporária`, `${projectedVacancy} vaga(s) atuais ou em obra`],
      jobs: [`Desemprego em ${round(snapshot.labor?.unemploymentRate || 0, 1)}%`, `${snapshot.labor?.vacancies || 0} vaga(s) formal(is)`],
      services: [`Saúde em ${Math.round(healthLoad)}% da capacidade`, `Educação em ${Math.round(educationLoad)}% da capacidade`],
      mobility: [`Espera média de ${Math.round(snapshot.mobility?.averageWait || 0)} min`, `Congestionamento ${Math.round(snapshot.mobility?.congestion || 0)}`],
      land: [`${availableLots} terreno(s) urbanizado(s) livre(s)`, `${snapshot.land?.plannedLots || 0} terreno(s) em preparação`],
      infrastructure: [`Condição média ${Math.round(snapshot.infrastructure?.condition || 0)}%`, `${snapshot.infrastructure?.outages || 0} interrupção(ões) ativa(s)`],
      fiscal: [`Saldo semanal ${weeklyBalance >= 0 ? "+" : "-"}R$ ${Math.abs(Math.round(weeklyBalance)).toLocaleString("pt-BR")}`, `Tesouro em R$ ${Math.round(snapshot.governance?.treasury || 0).toLocaleString("pt-BR")}`],
    }[id] || [];
    const prior = previous[id]?.value ?? value;
    return { id, label: pressureCatalog[id].label, value: round(value, 1), trend: trend(value, prior), level: value >= 75 ? "critical" : value >= 55 ? "high" : value >= 32 ? "moderate" : "controlled", drivers };
  });
}

function stageOf(snapshot, attractiveness, previousStageId) {
  let stage = developmentStageCatalog[0];
  developmentStageCatalog.forEach((candidate) => {
    if ((snapshot.population || 0) >= candidate.minPopulation && attractiveness >= candidate.minAttractiveness && (snapshot.land?.districts || 0) >= candidate.minDistricts) stage = candidate;
  });
  const index = developmentStageCatalog.findIndex((candidate) => candidate.id === stage.id), next = developmentStageCatalog[index + 1] || null;
  const progress = next ? clamp(((snapshot.population || 0) - stage.minPopulation) / Math.max(1, next.minPopulation - stage.minPopulation) * 100) : 100;
  return { ...stage, progress: round(progress, 1), nextId: next?.id || null, nextLabel: next?.label || "Polo consolidado", changed: Boolean(previousStageId && previousStageId !== stage.id) };
}

export function createCityDevelopmentState(snapshot = {}, clock = {}) {
  const attractiveness = attractivenessOf(snapshot), stage = stageOf(snapshot, attractiveness.score, null);
  return {
    version: 1,
    revision: 1,
    stageId: stage.id,
    stageEnteredWeek: clock.week || 1,
    stageAssessment: { candidateId: stage.id, consecutiveWeeks: 0 },
    attractiveness,
    pressures: pressuresOf(snapshot),
    populationHistory: [{ week: clock.week || 1, population: snapshot.population || 0, capacity: snapshot.housing?.capacity || 0, births: snapshot.totals?.births || 0, deaths: snapshot.totals?.deaths || 0, arrivals: snapshot.totals?.arrivals || 0, departures: snapshot.totals?.departures || 0, net: 0 }],
    lastTotals: { population: snapshot.population || 0, births: snapshot.totals?.births || 0, deaths: snapshot.totals?.deaths || 0, arrivals: snapshot.totals?.arrivals || 0, departures: snapshot.totals?.departures || 0 },
    migration: { accumulator: 0, waitingCandidates: 0, arrivals: 0, departures: 0, blockedArrivals: 0, lastArrivalWeek: null, lastDepartureWeek: null, yearIndex: Math.floor(((clock.week || 1) - 1) / 52), yearStartPopulation: snapshot.population || 0, arrivalsThisYear: 0, annualRate: 0, annualCap: 0, remainingAnnual: 0 },
    planning: { lastHousingWeek: -20, lastExpansionWeek: -30, lastCommercialWeek: -20, lastCivicWeek: -30, lastRezoningWeek: -20, lastPrivateDevelopmentWeek: -20 },
    weekly: { naturalChange: 0, migrationChange: 0, netChange: 0, rolling13: 0, annualizedRate: 0 },
    history: [{ week: clock.week || 1, kind: "foundation", text: `${stage.label} iniciou seu plano de desenvolvimento integrado.` }],
    milestones: [],
    formerResidents: [],
    lastPlan: null,
  };
}

export function planCityDevelopment(previousState, snapshot = {}, clock = {}) {
  const state = previousState?.version === 1 ? structuredClone(previousState) : createCityDevelopmentState(snapshot, clock);
  const attractiveness = attractivenessOf(snapshot), pressureList = pressuresOf(snapshot, Object.fromEntries((state.pressures || []).map((item) => [item.id, item]))), pressure = Object.fromEntries(pressureList.map((item) => [item.id, item.value]));
  const week = clock.week || 1, population = Math.max(1, snapshot.population || 0), yearIndex = Math.floor((week - 1) / 52), housingGate = pressure.housing >= 80 ? .12 : pressure.housing >= 62 ? .38 : pressure.housing >= 45 ? .72 : 1;
  state.migration ||= {};
  if (state.migration.yearIndex !== yearIndex) {
    state.migration.yearIndex = yearIndex;
    state.migration.yearStartPopulation = population;
    state.migration.arrivalsThisYear = 0;
  }
  const stageIndex = Math.max(0, developmentStageCatalog.findIndex((candidate) => candidate.id === state.stageId));
  const vacancyRate = snapshot.housing?.capacity ? (snapshot.housing?.vacant || 0) / snapshot.housing.capacity : 0;
  const stageMigration = [{ base: .015, cap: .04, burst: 1 }, { base: .02, cap: .05, burst: 1 }, { base: .018, cap: .04, burst: 2 }, { base: .012, cap: .03, burst: 2 }, { base: .008, cap: .02, burst: 2 }][stageIndex] || { base: .015, cap: .04, burst: 1 };
  const attractivenessPull = clamp((attractiveness.score - 55) / 25, 0, 1), laborPull = clamp((snapshot.labor?.vacancies || 0) / Math.max(1, population * .026), 0, 1);
  const stress = Math.max(pressure.housing, pressure.services, pressure.mobility, pressure.infrastructure) / 100;
  const recentNatural = (state.populationHistory || []).slice(-13), naturalBase = recentNatural[0]?.population || population;
  const naturalAnnualRate = recentNatural.length > 1 ? recentNatural.reduce((sum, item) => sum + (item.births || 0) - (item.deaths || 0), 0) / Math.max(1, naturalBase) * 4 : 0;
  const boomEligible = attractiveness.score >= 78 && pressure.housing < 48 && pressure.services < 48 && (snapshot.labor?.unemploymentRate || 100) < 4 && (snapshot.labor?.vacancies || 0) >= Math.max(5, population * .035);
  const annualGrowthCap = boomEligible ? Math.min(.08, stageMigration.cap + .03) : stageMigration.cap;
  const targetAnnualRate = clamp(stageMigration.base + attractivenessPull * .015 + laborPull * .01 - stress * .015, 0, annualGrowthCap);
  const annualRate = Math.min(targetAnnualRate, Math.max(0, annualGrowthCap - Math.max(0, naturalAnnualRate)));
  const annualCap = Math.max(0, Math.ceil((state.migration.yearStartPopulation || population) * annualRate));
  const remainingAnnual = Math.max(0, annualCap - (state.migration.arrivalsThisYear || 0));
  const basePull = annualCap / 52 * clamp(.72 + (attractiveness.score - 50) / 80, .45, 1.35);
  const hotelRoom = Math.max(0, (snapshot.housing?.hotelCapacity || 0) - (snapshot.housing?.hotelGuests || 0));
  const arrivalCapacity = hotelRoom > 0 || (snapshot.housing?.vacant || 0) > 5;
  const accumulatedPull = (state.migration.accumulator || 0) + basePull * housingGate;
  const migrationAccumulator = clamp(arrivalCapacity ? accumulatedPull : accumulatedPull * .85, 0, Math.min(8, remainingAnnual + .99));
  const arrivals = arrivalCapacity && attractiveness.score >= 44 ? Math.min(stageMigration.burst, remainingAnnual, Math.floor(migrationAccumulator)) : 0;
  const departures = attractiveness.score < 39 && (snapshot.migration?.eligibleDepartures || 0) > 0 && week - (state.migration?.lastDepartureWeek || -20) >= 8 ? 1 : 0;
  const activeHousing = (snapshot.housing?.activeProjects || 0) + (snapshot.housing?.privateProjects || 0), activeExpansion = Boolean(snapshot.land?.activeExpansion);
  const plan = {
    arrivals,
    departures,
    startHousing: pressure.housing >= 52 && activeHousing < (pressure.housing >= 76 ? 3 : 2) && week - state.planning.lastHousingWeek >= 3,
    startExpansion: !activeExpansion && (pressure.land >= 66 || ((snapshot.land?.availableLots || 0) < 6 && pressure.housing >= 48)) && week - state.planning.lastExpansionWeek >= 12,
    startCommercial: (snapshot.economy?.businessesPer100 || 0) < 22 && (snapshot.weeklyPopulationChange || state.weekly?.netChange || 0) >= 0 && week - state.planning.lastCommercialWeek >= 10,
    startCivic: pressure.services >= 60 && week - state.planning.lastCivicWeek >= 16,
    rezone: pressure.housing >= 68 && pressure.land >= 42 && week - state.planning.lastRezoningWeek >= 12 ? "higher_density" : pressure.jobs >= 64 && (snapshot.land?.mixedLots || 0) < 4 && week - state.planning.lastRezoningWeek >= 12 ? "mixed_use" : null,
    allowPrivateDevelopment: pressure.housing >= 48 && pressure.housing < 76 && vacancyRate < .14 && activeHousing === 0 && week - (state.planning.lastPrivateDevelopmentWeek ?? -20) >= 8,
  };
  state.attractiveness = attractiveness;
  state.pressures = pressureList;
  state.migration.accumulator = migrationAccumulator;
  state.migration.waitingCandidates = Math.max(0, Math.round(migrationAccumulator - arrivals + (arrivalCapacity ? 0 : basePull)));
  state.migration.annualRate = round(annualRate * 100, 2);
  state.migration.annualCap = annualCap;
  state.migration.remainingAnnual = remainingAnnual;
  state.lastPlan = { week, ...plan };
  return { state, plan, analysis: { attractiveness, pressures: pressureList, housingGate, basePull, annualRate, annualCap, remainingAnnual } };
}

export function commitCityDevelopment(interimState, snapshot = {}, outcome = {}, clock = {}) {
  const state = structuredClone(interimState), week = clock.week || 1, previous = state.lastTotals || {};
  const totals = { population: snapshot.population || 0, births: snapshot.totals?.births || 0, deaths: snapshot.totals?.deaths || 0, arrivals: snapshot.totals?.arrivals || 0, departures: snapshot.totals?.departures || 0 };
  const births = Math.max(0, totals.births - (previous.births || 0)), deaths = Math.max(0, totals.deaths - (previous.deaths || 0)), arrivals = Math.max(0, outcome.arrivals || totals.arrivals - (previous.arrivals || 0)), departures = Math.max(0, outcome.departures || totals.departures - (previous.departures || 0));
  const naturalChange = births - deaths, migrationChange = arrivals - departures, netChange = totals.population - (previous.population || totals.population);
  state.migration.accumulator = Math.max(0, state.migration.accumulator - arrivals);
  state.migration.arrivals += arrivals;
  state.migration.departures += departures;
  state.migration.arrivalsThisYear = (state.migration.arrivalsThisYear || 0) + arrivals;
  state.migration.remainingAnnual = Math.max(0, (state.migration.annualCap || 0) - state.migration.arrivalsThisYear);
  state.migration.blockedArrivals += Math.max(0, (state.lastPlan?.arrivals || 0) - arrivals);
  if (arrivals) state.migration.lastArrivalWeek = week;
  if (departures) state.migration.lastDepartureWeek = week;
  if (outcome.housingStarted) state.planning.lastHousingWeek = week;
  if (outcome.expansionStarted) state.planning.lastExpansionWeek = week;
  if (outcome.commercialStarted) state.planning.lastCommercialWeek = week;
  if (outcome.civicStarted) state.planning.lastCivicWeek = week;
  if (outcome.rezoned) state.planning.lastRezoningWeek = week;
  const populationHistory = [...state.populationHistory, { week, population: totals.population, capacity: snapshot.housing?.capacity || 0, births, deaths, arrivals, departures, net: netChange }].slice(-156);
  const rolling = populationHistory.slice(-13), rolling13 = rolling.reduce((sum, item) => sum + item.net, 0), basePopulation = rolling[0]?.population - rolling[0]?.net || totals.population;
  state.weekly = { naturalChange, migrationChange, netChange, rolling13, annualizedRate: round(basePopulation ? rolling13 / basePopulation * 4 * 100 : 0, 2) };
  state.populationHistory = populationHistory;
  state.lastTotals = totals;
  state.attractiveness = attractivenessOf(snapshot);
  state.pressures = pressuresOf(snapshot, Object.fromEntries((state.pressures || []).map((item) => [item.id, item])));
  const candidateStage = stageOf(snapshot, state.attractiveness.score, state.stageId), currentIndex = Math.max(0, developmentStageCatalog.findIndex((item) => item.id === state.stageId)), candidateIndex = Math.max(0, developmentStageCatalog.findIndex((item) => item.id === candidateStage.id));
  state.stageAssessment ||= { candidateId: state.stageId, consecutiveWeeks: 0 };
  if (candidateStage.id === state.stageId) state.stageAssessment = { candidateId: state.stageId, consecutiveWeeks: 0 };
  else if (state.stageAssessment.candidateId === candidateStage.id) state.stageAssessment.consecutiveWeeks++;
  else state.stageAssessment = { candidateId: candidateStage.id, consecutiveWeeks: 1 };
  const currentStage = developmentStageCatalog[currentIndex], downwardMarginReached = candidateIndex >= currentIndex || totals.population < currentStage.minPopulation * .92 || state.attractiveness.score < currentStage.minAttractiveness - 8;
  const requiredWeeks = candidateIndex > currentIndex ? 13 : 26;
  const stageChanged = candidateStage.id !== state.stageId && downwardMarginReached && state.stageAssessment.consecutiveWeeks >= requiredWeeks;
  const stage = { ...candidateStage, changed: stageChanged }, events = [];
  if (stageChanged) {
    const prior = developmentStageCatalog.find((item) => item.id === state.stageId)?.label || "estágio anterior";
    state.stageId = stage.id;
    state.stageEnteredWeek = week;
    state.stageAssessment = { candidateId: stage.id, consecutiveWeeks: 0 };
    const event = { week, kind: "stage", text: `Vila Esperança avançou de ${prior} para ${stage.label}.` };
    if (candidateIndex < currentIndex) event.text = event.text.replace("avan\u00e7ou", "foi reclassificada");
    state.milestones.unshift(event); events.push(event);
  }
  const actions = [];
  if (arrivals) actions.push(`${arrivals} chegada(s)`);
  if (departures) actions.push(`${departures} saída(s)`);
  if (outcome.housingStarted) actions.push("nova obra habitacional");
  if (outcome.expansionStarted) actions.push("expansão territorial");
  if (outcome.commercialStarted) actions.push("novo polo comercial");
  if (outcome.civicStarted) actions.push("novo equipamento público");
  if (outcome.rezoned) actions.push("revisão de zoneamento");
  if (actions.length || netChange || births || deaths) state.history.unshift({ week, kind: "weekly", text: `${netChange >= 0 ? "+" : ""}${netChange} morador(es) na semana${actions.length ? `; ${actions.join(", ")}` : ""}.` });
  state.history = state.history.slice(0, 120);
  state.revision++;
  return { state, stage, events };
}

export function forecastCityDevelopment(state, snapshot = {}, weeks = 26) {
  const history = state?.populationHistory || [], recent = history.slice(-Math.min(13, history.length));
  const samples = recent.length > 1 ? recent.slice(1) : recent;
  const observedNatural = samples.length ? samples.reduce((sum, item) => sum + (item.births || 0) - (item.deaths || 0), 0) / samples.length : 0;
  const observedMigration = samples.length ? samples.reduce((sum, item) => sum + (item.arrivals || 0) - (item.departures || 0), 0) / samples.length : 0;
  const quotaWeekly = Math.max(0, (state?.migration?.annualRate || 0) / 100 * (snapshot.population || 0) / 52);
  const housingGate = state?.pressures?.find((item) => item.id === "housing")?.value > 70 ? .3 : 1;
  const expectedMigration = clamp((samples.length >= 6 ? observedMigration * .55 + quotaWeekly * .45 : quotaWeekly) * housingGate, -1, quotaWeekly);
  const weeklyNet = observedNatural + expectedMigration;
  const projectedPopulation = Math.max(0, Math.round((snapshot.population || 0) + weeklyNet * weeks));
  const capacityGain = Math.round(snapshot.housing?.pipelineCapacity || 0);
  return { weeks, population: projectedPopulation, weeklyNet: round(weeklyNet, 2), housingCapacity: (snapshot.housing?.capacity || 0) + capacityGain, housingDeficit: Math.max(0, projectedPopulation - ((snapshot.housing?.capacity || 0) + capacityGain)), confidence: recent.length >= 13 ? 82 : recent.length >= 6 ? 68 : 52 };
}

export function stageSummary(state, snapshot = {}) {
  const index = Math.max(0, developmentStageCatalog.findIndex((candidate) => candidate.id === state?.stageId)), current = developmentStageCatalog[index], next = developmentStageCatalog[index + 1] || null;
  const stage = { ...current, progress: next ? round(clamp(((snapshot.population || 0) - current.minPopulation) / Math.max(1, next.minPopulation - current.minPopulation) * 100), 1) : 100, nextId: next?.id || null, nextLabel: next?.label || "Polo consolidado" };
  stage.pendingCandidateId = state?.stageAssessment?.candidateId !== stage.id ? state.stageAssessment.candidateId : null;
  stage.pendingWeeks = state?.stageAssessment?.consecutiveWeeks || 0;
  return { id: stage.id, label: stage.label, progress: stage.progress, nextId: stage.nextId, nextLabel: stage.nextLabel, enteredWeek: state?.stageEnteredWeek || 1 };
}
