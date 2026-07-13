import { firstNameForIdentity, lastNames, traits, jobs } from "./data.js";
import { businessCatalog, shiftTemplates, isWorking } from "./economy.js";
import { seedRelationships, relationBetween, otherPerson } from "./social.js";
import {
  conditions,
  conditionById,
  newMedicalRecord,
  healthRisk,
  medicationCatalog,
} from "./health.js";
import {
  courses,
  emptyEducation,
  stageForAge,
  educationStages,
  skillNames,
} from "./education.js";
import { homeNames, occupancyRate } from "./housing.js";
import { offenses, emptyJusticeRecord, weightedOffense } from "./justice.js";
import { streets, districts, addressFor, generateUrbanPlan } from "./city.js";
import {
  vehicleModels,
  transitRoutes,
  emptyMobility,
  emptyVehicleRecord,
} from "./transport.js";
import {
  randomGenetics,
  inheritGenetics,
  inheritTraits,
  randomIdentity,
  randomOrientation,
  pronounsForIdentity,
} from "./lifecycle.js";
import { buildRoutine, currentBlock } from "./routine.js";
import { utilityTypes, buildingDemand, emptyMeter } from "./infrastructure.js";
import { suppliers, supplierFor, productShelfLife } from "./supply.js";
import { seasonalCalendar, seasonForWeek } from "./events.js";
import { defaultPolicies, defaultBudget, normalizeBudget } from "./governance.js";
import { createClimateState, advanceClimateDay, summarizeClimate } from "./environment.js";
import { generatePersonality, generateNotability, familyOrigins } from "./personality.js";
import { undergroundVenues, isAdultUnderground } from "./underground.js";
import { vehicleMarketCatalog, initializeMarkets, tickMarkets, getMarketSnapshot, seedMarketListings, purchaseVehicle, rentVehicle, returnRentedVehicle, createVehicleListing, purchaseProperty, rentProperty, createPropertyListing, makeFamilyBusinessDecision } from "./markets.js";
import { PoliticsSystem, createPoliticsForSimulation, advancePoliticsForSimulation } from "./politics.js";
import { buildKinshipIndex } from "./kinship.js";
import {
  initializeCharacterMind,
  normalizeCharacterMind,
  recordMemory,
  updateCharacterMindDaily,
  updateCharacterMindWeekly,
} from "./characterMind.js";
import {
  applyInteractionEffects,
  buildSocialContext,
  chooseSocialInteraction,
  decayRelationship,
  ensureRelationshipDepth,
} from "./socialDynamics.js";
import {
  applyRelationshipExperience,
  evaluateRelationshipWeekly,
  initializeRelationshipLifecycle,
  normalizeRelationshipLifecycle,
  relationshipStageLabel,
  transitionRelationshipStage,
} from "./relationshipLifecycle.js";
import {
  createCommunityReactivityState,
  runCommunityReactivityWeek,
  summarizeCommunityReactivity,
} from "./communityReactivity.js";
import {
  createCityDynamicsState,
  runDailyCityDynamics,
  summarizeCityDynamics,
} from "./cityDynamics.js";
import { initializeLifeCourse, advanceLifeCourseWeek, ageDailyEffects, lifeStageForAge, lifeStageSummary } from "./lifeStages.js";
import { createLaborMarketState, runLaborMarketWeek, summarizeLaborMarket, rankLaborCandidates } from "./laborMarket.js";
import { createTaxiSystem, requestTaxiRide, boardTaxiRide, finishTaxiRide, cancelTaxiRide, taxiSuitability, summarizeTaxiSystem } from "./taxi.js";
import { createInvestigationState, runInvestigationDay, getInvestigationCaseFile, summarizeInvestigations } from "./investigationDynamics.js";
import {
  createLocalGovernmentForSimulation,
  advanceLocalGovernmentForSimulation,
  applyLocalGovernmentAssignmentsToPeople,
  authorizeMunicipalPublicWork,
  drainLocalGovernmentEffects,
  getLocalGovernmentSummary,
  localGovernmentContextFromSimulation,
} from "./localGovernment.js";
import { createRealEstateDynamics, runRealEstateDynamicsWeek, summarizeRealEstateDynamics } from "./realEstateDynamics.js";
import { createSimulationPersonPatch, validateCharacterDraft } from "./gameplay.js";
import { commitCityDevelopment, createCityDevelopmentState, forecastCityDevelopment, planCityDevelopment, stageSummary } from "./cityDevelopment.js";

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const roundNumber = (value, digits = 0) => { const factor = 10 ** digits; return Math.round((Number(value) || 0) * factor) / factor; };
let simulationUidCounter = 0;
const uid = (prefix) => `${prefix}-${++simulationUidCounter}`;

export const SIMULATION_SNAPSHOT_VERSION = 1;

// These values are either indexes/caches or denormalized views of canonical data.
// Persisting them would multiply a save by several megabytes and, after parsing,
// leave references pointing at duplicate objects instead of the loaded world.
export const SIMULATION_SNAPSHOT_TRANSIENT_KEYS = Object.freeze([
  "activeEventById",
  "activeEventByPerson",
  "activeEventIndexKey",
  "buildingIndex",
  "buildingNameIndex",
  "buildingsByType",
  "businessByBuildingId",
  "businessIndex",
  "businessIndexSignature",
  "communityCare",
  "familyNetworks",
  "kinship",
  "pendingPlayerCharacter",
  "personIndex",
  "relationshipAdjacency",
  "relationshipDegree",
  "relationshipIndex",
  "routeIndex",
  "streetIndex",
  "vehicleIndex",
]);

const snapshotTransientKeySet = new Set(SIMULATION_SNAPSHOT_TRANSIENT_KEYS);

export function getSimulationUidCounter() {
  return simulationUidCounter;
}

export function reserveSimulationUidCounter(value) {
  const next = Math.floor(Number(value));
  if (!Number.isSafeInteger(next) || next < 0 || next >= Number.MAX_SAFE_INTEGER)
    throw new TypeError("Contador de identificadores da simulação inválido.");
  simulationUidCounter = Math.max(simulationUidCounter, next);
  return simulationUidCounter;
}

function greatestUidSuffix(value, seen = new WeakSet()) {
  if (typeof value === "string") {
    const match = /-([0-9]+)$/.exec(value);
    const suffix = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(suffix) ? suffix : 0;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return 0;
  seen.add(value);
  let greatest = 0;
  const entries = value instanceof Map
    ? [...value.entries()].flat()
    : value instanceof Set
      ? [...value.values()]
      : Object.values(value);
  entries.forEach((entry) => { greatest = Math.max(greatest, greatestUidSuffix(entry, seen)); });
  return greatest;
}

function assertSimulationSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") throw new TypeError("Snapshot da simulação ausente ou inválido.");
  if (snapshot.version !== SIMULATION_SNAPSHOT_VERSION)
    throw new TypeError(`Versão de snapshot incompatível (${snapshot.version ?? "desconhecida"}).`);
  const state = snapshot.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new TypeError("Estado da simulação ausente ou inválido.");
  if (!["spectator", "gameplay"].includes(state.gameMode)) throw new TypeError("Modo da simulação inválido no snapshot.");
  ["people", "buildings", "families", "businesses", "relationships", "vehicles"].forEach((key) => {
    if (!Array.isArray(state[key])) throw new TypeError(`Coleção obrigatória ausente no snapshot: ${key}.`);
  });
  if (!state.city || typeof state.city !== "object") throw new TypeError("Mapa da cidade ausente no snapshot.");
  if (![state.week, state.day, state.minute].every(Number.isFinite)) throw new TypeError("Relógio da simulação inválido no snapshot.");
  if (state.gameMode === "gameplay" && (!state.playerId || !state.people.some((person) => person?.id === state.playerId)))
    throw new TypeError("Personagem jogável não foi encontrado no snapshot.");
  if (state.gameMode === "spectator" && state.playerId) throw new TypeError("Snapshot de observador contém um personagem controlado.");
  return state;
}

export class Simulation {
  constructor(options = {}) {
    this.gameMode = options.mode === "gameplay" ? "gameplay" : "spectator";
    this.pendingPlayerCharacter = options.playerCharacter && validateCharacterDraft(options.playerCharacter).valid ? options.playerCharacter : null;
    this.playerId = null;
    this.minute = 6 * 60 + 30;
    this.day = 0;
    this.week = 1;
    this.speed = this.gameMode === "gameplay" ? 24 : 96;
    this.money = 248600;
    this.logs = [];
    this.newsroom = { articles: [], publishedByWeek: {}, publishedBySectionWeek: {}, updated: 0, sections: ["Cidade", "Política", "Segurança", "Justiça", "Economia", "Trabalho", "Habitação", "Sociedade", "Saúde", "Mobilidade", "Meio Ambiente", "Cultura"] };
    this.people = [];
    this.buildings = [];
    this.families = [];
    this.businesses = [];
    this.relationships = [];
    this.deaths = [];
    this.vehicles = [];
    this.weather = "Ensolarado";
    this.temperature = 24;
    this.seedCity();
  }

  toSaveSnapshot() {
    const state = {};
    Object.entries(this).forEach(([key, value]) => {
      if (snapshotTransientKeySet.has(key)) return;
      if (key === "politics") {
        if (!value || typeof value.serialize !== "function") throw new TypeError("Subsistema político não pode ser serializado.");
        state.politics = value.serialize();
        return;
      }
      if (key === "governance") {
        // Both fields are aliases of canonical top-level state and are restored
        // after parsing. Keeping them here would duplicate large object graphs.
        const { politics: _politics, localGovernment: _localGovernment, ...governance } = value || {};
        state.governance = governance;
        return;
      }
      if (key === "people") {
        state.people = value.map((person) => {
          // Routine and relationshipProfile are deterministic projections of
          // the person's current work, education, age and personality. They
          // account for more than 1 MB in a new city and are rebuilt on load.
          const { routine: _routine, relationshipProfile: _relationshipProfile, familyNetworkId: _familyNetworkId, ...savedPerson } = person;
          return savedPerson;
        });
        return;
      }
      state[key] = value;
    });
    return {
      version: SIMULATION_SNAPSHOT_VERSION,
      uidCounter: getSimulationUidCounter(),
      // Network objects contain full Person references, so only their stable
      // identity is kept. rebuildKinship uses this lightweight overlap map to
      // preserve IDs referenced by family events and traditions.
      familyNetworkIdentity: (this.familyNetworks || []).map((network) => ({
        id: network.id,
        memberIds: [...(network.memberIds || [])],
      })),
      state,
    };
  }

  static fromSaveSnapshot(snapshot) {
    const state = assertSimulationSnapshot(snapshot);
    if (snapshot.uidCounter !== undefined && (!Number.isSafeInteger(snapshot.uidCounter) || snapshot.uidCounter < 0))
      throw new TypeError("Contador de identificadores inválido no snapshot.");
    if (!state.politics || typeof state.politics !== "object") throw new TypeError("Subsistema político ausente no snapshot.");
    const simulation = Object.create(Simulation.prototype);
    Object.entries(state).forEach(([key, value]) => { simulation[key] = value; });

    simulation.politics = PoliticsSystem.hydrate(state.politics);
    simulation.pendingPlayerCharacter = null;
    simulation.kinship = null;
    if (snapshot.familyNetworkIdentity !== undefined && !Array.isArray(snapshot.familyNetworkIdentity))
      throw new TypeError("Identidade das redes familiares inválida no snapshot.");
    simulation.familyNetworks = (snapshot.familyNetworkIdentity || []).map((network) => {
      if (!network || typeof network.id !== "string" || !Array.isArray(network.memberIds))
        throw new TypeError("Registro de rede familiar inválido no snapshot.");
      return { id: network.id, memberIds: network.memberIds.filter((id) => typeof id === "string") };
    });
    simulation.relationshipIndex = null;
    simulation.relationshipDegree = null;
    simulation.relationshipAdjacency = null;
    simulation.personIndex = null;
    simulation.buildingIndex = null;
    simulation.buildingNameIndex = null;
    simulation.buildingsByType = null;
    simulation.vehicleIndex = null;
    simulation.routeIndex = null;
    simulation.businessIndex = null;
    simulation.businessByBuildingId = null;
    simulation.streetIndex = null;
    simulation.businessIndexSignature = "";
    simulation.activeEventIndexKey = "";
    simulation.activeEventByPerson = new Map();
    simulation.activeEventById = new Map();

    const snapshotCounter = snapshot.uidCounter ?? 0;
    reserveSimulationUidCounter(Math.max(snapshotCounter, greatestUidSuffix(state)));
    simulation.rebuildRelationshipIndex();
    simulation.rebuildKinship({ seedLinks: false });
    simulation.people.forEach((person) => { person.routine = buildRoutine(person); });
    simulation.refreshWorldIndexes();

    if (!simulation.governance || typeof simulation.governance !== "object") throw new TypeError("Governança ausente no snapshot.");
    simulation.governance.politics = simulation.politics.state;
    if (simulation.localGovernment) simulation.governance.localGovernment = simulation.localGovernment;
    if (simulation.communitySystem?.state) simulation.communityCare = simulation.communitySystem.state;
    if (simulation.realEstateDynamics?.properties) simulation.syncRealEstateValuations();
    simulation.synchronizeWorldState();
    return simulation;
  }

  seedCity() {
    const descriptors = [
      ["Prefeitura", "civic"],
      ["Hospital São Lucas", "health"],
      ["Escola Municipal", "school"],
      ["Creche Municipal Sementinha", "school"],
      ["Cemitério da Paz", "civic"],
      ["Funerária Serenidade", "shop"],
      ["Instituto Médico-Legal", "civic"],
      ["Praça das Acácias", "park"],
      ["Mercado do Sol", "shop"],
      ["Café do Largo", "shop"],
      ["Terminal Municipal", "civic"],
      ["Delegacia", "civic"],
      ["Presídio Municipal", "civic"],
      ["Hotel Central", "shop"],
      ["Faculdade Municipal", "school"],
      ["Parque das Mangueiras", "park"],
      ["Farmácia Popular", "health"],
      ["Estação Meteorológica", "civic"],
      ["UBS Vila Esperança", "health"],
      ["CAPS Bem Viver", "health"],
      ["Restaurante Sabor da Vila", "shop"],
      ["Livraria Horizonte", "shop"],
      ["Cinema Municipal", "shop"],
      ["Academia Movimento", "shop"],
      ["Padaria Aurora", "shop"],
      ["Bar Esquina 12", "shop"],
      ["Pub Ferro & Fogo", "shop"],
      ["Clube Eclipse", "shop"],
      ["Boate Nebulosa", "shop"],
      ["Casa de Shows Estação", "shop"],
      ["Casa Rubi", "shop"],
      ["Oficina Central", "shop"],
      ["Posto Avenida", "shop"],
      ["Banco Cooperativo", "shop"],
      ["Ferro-Velho Oeste", "shop"],
      ["Porão 77", "shop"],
      ["Depósito Norte", "shop"],
      ["Agência Prisma", "shop"],
      ["Casa Vênus", "shop"],
      ["Banca do Viaduto", "shop"],
      ["Estação de Água", "civic"],
      ["Subestação Central", "civic"],
      ["Centro de Reciclagem", "civic"],
      ["Imobiliária Horizonte", "shop"],
      ["Concessionária Avenida", "shop"],
      ["Central Táxi Vila", "shop"],
      ["Construtora Horizonte", "shop"],
      ["Cartório Civil", "civic"],
      ["Clínica Veterinária Vida Animal", "health"],
      ["Laboratório Vida", "health"],
      ["Centro Odontológico Sorriso", "health"],
      ["Salão Bela Vila", "shop"],
      ["Barbearia Central", "shop"],
      ["Pet Shop Amigo", "shop"],
      ["Loja Estação Moda", "shop"],
      ["Pizzaria Forno Alto", "shop"],
      ["Sorveteria Primavera", "shop"],
      ["Agência Municipal de Emprego", "civic"],
      ["Centro de Convivência do Idoso", "civic"],
      ["Museu da Cidade", "civic"],
    ].map(([name, type]) => ({
      id: uid("b"),
      name,
      type,
      capacity: 40,
      occupied: 0,
    }));
    for (let i = 0; i < 28; i++)
      descriptors.push({
        id: uid("b"),
        name: `${i % 3 === 0 ? "Casa" : "Residencial"} ${pick(lastNames)}`,
        type: "home",
        capacity: i % 3 === 0 ? 8 : 10,
        occupied: 0,
        value: 90000 + Math.floor(Math.random() * 180000),
      });
    const plan = generateUrbanPlan(descriptors);
    this.city = {
      streets: plan.streets,
      districts: plan.districts,
      lots: plan.lots,
      bounds: plan.bounds,
    };
    this.urbanEvolution = { expansions: 0, projects: [], expansionProjects: [], completed: 0, rezoned: 0, history: [], districtMetrics: {}, businessTransactions: [], relocations: 0, lotsReleased: 0, roadsOpened: 0 };
    this.buildings = plan.buildings;
    const npcPopulation = this.gameMode === "gameplay" && this.pendingPlayerCharacter ? 199 : 200;
    for (let i = 0; i < npcPopulation; i++) this.people.push(this.makePerson(i));
    this.createCityGrid();
    this.createPhysicalSpaces();
    this.createFamilies();
    this.seedExtendedFamilies();
    this.createHousingSystem();
    this.createHealthSystem();
    this.createEducationSystem();
    this.createEconomy();
    this.createLifeStageSystem();
    this.createLaborMarketSystem();
    this.relationships = seedRelationships(this.people);
    this.createDemographicSystem();
    this.createFamilyLifeSystem();
    this.createCharacterSystem();
    this.createRelationshipSystem();
    this.createJusticeSystem();
    this.createUndergroundSystem();
    this.createTransportSystem();
    this.createMarketsSystem();
    this.createRealEstateDynamicsSystem();
    this.createFuneralFleet();
    this.createSupplyChain();
    this.createInfrastructureSystem();
    this.createEventSystem();
    this.createGovernanceSystem();
    this.createPoliticsSystem();
    this.createLocalGovernmentSystem();
    this.createEnvironmentSystem();
    this.createCommunityReactivitySystem();
    this.createCityDynamicsSystem();
    if (this.gameMode === "gameplay" && this.pendingPlayerCharacter)
      this.createPlayerCitizen(this.pendingPlayerCharacter);
    this.createRoutines();
    this.weeklyCommunityReactivity({ initial: true });
    this.synchronizeWorldState();
    this.createCityDevelopmentSystem();
    this.log(
      "fundação",
      `Cidade Viva foi fundada com ${this.people.length} moradores e ${this.families.length} famílias pioneiras.`,
      "civic",
    );
    this.log("cidade", `${this.businesses.length} estabelecimentos e ${this.transportSystem.routes.length} linhas iniciaram a operação na cidade.`, "social");
    this.dailyCityDynamics({ initial: true });
  }
  makePerson(i) {
    const homes = this.buildings.filter((b) => b.type === "home"),
      home = homes[i % homes.length];
    home.occupied++;
    const job = pick(jobs), age =
      i < 12
        ? Math.floor(Math.random() * 7)
        : i < 40
        ? 7 + Math.floor(Math.random() * 11)
        : 18 + Math.floor(Math.random() * 58);
    const identity=randomIdentity(),firstName=firstNameForIdentity(identity),retiredAtSeed=age>=65&&Math.random()<.76;
    let [role, workplace, wage] =
      age < 18 ? ["Estudante", "Escola Municipal", 0] : retiredAtSeed ? ["Aposentado(a)", "—", 0] : job;
    if (age < 4) [role, workplace, wage] = ["Crian\u00e7a", "\u2014", 0];
    else if (age < 6) [role, workplace, wage] = ["Estudante", "Creche Municipal Sementinha", 0];
    const family = `${lastNames[i % homes.length]}`,personTraits = [pick(traits), pick(traits)],lifeCourse=initializeLifeCourse({age,role,retirement:retiredAtSeed?{active:true,retiredWeek:1,monthlyPension:1420,formerRole:job[0],formerWorkplace:job[1]}:null},1);
    return {
      id: uid("p"),
      name: `${firstName} ${family}`,
      firstName,
      family,
      age,
      role,
      workplace,
      wage,
      homeId: home.id,
      traits: personTraits,
      health: 70 + Math.floor(Math.random() * 31),
      happiness: 55 + Math.floor(Math.random() * 40),
      energy: 65 + Math.floor(Math.random() * 35),
      money: 600 + Math.floor(Math.random() * 9000),
      x: home.x + 0.5,
      y: home.y + 0.5,
      target: null,
      activity: "Em casa",
      currentAction: { text:"Em casa",phase:"present",placeId:home.id,destinationId:null,mode:null,sinceWeek:1,sinceDay:0,sinceMinute:450 },
      actionLog: [],
      color: `hsl(${Math.floor(Math.random() * 360)} 45% 55%)`,
      friends: 2 + Math.floor(Math.random() * 9),
      parents: [],
      children: [],
      partnerId: null,
      history: [],
      housing: "family",
      alive: true,
      bereavement: { active: [], leaveDays: 0, visitToday: null },
      guardianship: null,
      medical: newMedicalRecord(),
      education: emptyEducation(),
      justice: emptyJusticeRecord(),
        mobility: emptyMobility(),
        needs: { hunger: 82, social: 70, hygiene: 88, comfort: 75 },
        reproductive: {
          childrenDesired: Math.floor(Math.random() * 4),
          pregnancyId: null,
          expectingPregnancyIds: [],
          postpartumUntilWeek: null,
          fertility: 45 + Math.floor(Math.random() * 50),
          canGestate: Math.random() < .49,
        },
      identity,
      pronouns:pronounsForIdentity(identity),
      orientation: randomOrientation(),
        genetics: randomGenetics(),
        personality: generatePersonality(personTraits),
      notability: generateNotability(),
      lifeStage:lifeStageForAge(age).id,
      lifeCourse,
      bornWeek: -(age * 52),
      birthdayWeek: 1 + Math.floor(Math.random() * 52),
    };
  }
  isPlayerControlled(person) {
    return Boolean(person && (person.id === this.playerId || person.controlledByPlayer || person.playerControlled));
  }
  player() {
    return this.people.find((person) => person.id === this.playerId) || null;
  }
  autonomousPopulationView() {
    if (this.gameMode !== "gameplay" || !this.playerId) return this;
    const simulation = this, view = Object.create(this);
    Object.defineProperty(view, "people", { value: this.people.filter((person) => !this.isPlayerControlled(person)), writable: false });
    Object.defineProperty(view, "money", { get: () => simulation.money, set: (value) => { simulation.money = value; } });
    Object.defineProperty(view, "log", { value: (...args) => simulation.log(...args) });
    return view;
  }
  connectPlayerToLocalFamily(person, originId) {
    if (!person || !["city_native", "family_heir"].includes(originId)) return [];
    const home = this.buildings.find((building) => building.id === person.homeId), desired = originId === "family_heir" || person.age < 18 ? 2 : 1;
    const adults = this.people.filter((candidate) => candidate.alive && candidate.id !== person.id && candidate.age >= 18);
    const score = (candidate, idealGap) => {
      const candidateHome = this.buildings.find((building) => building.id === candidate.homeId);
      return (candidate.family === person.family ? 120 : 0) + (candidate.homeId === person.homeId ? 34 : 0) + (candidateHome?.districtId && candidateHome.districtId === home?.districtId ? 14 : 0) + (candidate.justice?.incarcerated ? -18 : 4) - Math.abs(idealGap - 29);
    };
    const parentCandidates = adults
      .filter((candidate) => candidate.age - person.age >= 18 && candidate.age - person.age <= 55 && (candidate.children?.length || 0) < 8)
      .sort((a, b) => score(b, b.age - person.age) - score(a, a.age - person.age) || String(a.id).localeCompare(String(b.id)));
    const selected = parentCandidates.slice(0, desired).map((relative) => ({ relative, role: "parent" }));
    if (selected.length < desired) {
      const selectedIds = new Set(selected.map((entry) => entry.relative.id));
      adults
        .filter((candidate) => !selectedIds.has(candidate.id) && person.age - candidate.age >= 18 && person.age - candidate.age <= 60 && (candidate.parents?.length || 0) < 2)
        .sort((a, b) => score(b, person.age - b.age) - score(a, person.age - a.age) || String(a.id).localeCompare(String(b.id)))
        .slice(0, desired - selected.length)
        .forEach((relative) => selected.push({ relative, role: "child" }));
    }
    selected.forEach(({ relative, role }) => {
      if (role === "parent") {
        person.parents = [...new Set([...(person.parents || []), relative.id])];
        relative.children = [...new Set([...(relative.children || []), person.id])];
      } else {
        person.children = [...new Set([...(person.children || []), relative.id])];
        relative.parents = [...new Set([...(relative.parents || []), person.id])];
      }
      const link = this.ensureSocialRelationship(person, relative, { isFamily: true });
      if (link) {
        link.type = "família";
        link.domain = "family";
        link.affinity = Math.max(link.affinity || 0, role === "parent" ? 68 : 64);
        link.trust = Math.max(link.trust || 0, 64);
        link.familiarity = Math.max(link.familiarity || 0, 72);
        link.lastEvent = "Vínculo familiar anterior ao início da trajetória do jogador";
        link.history ||= [];
        link.history.unshift({ week: this.week, text: `${relative.name} foi registrado(a) como ${role === "parent" ? "pai, mãe ou responsável" : "filho(a) adulto(a)"} de ${person.name}.` });
        link.history = link.history.slice(0, 30);
      }
      relative.history ||= [];
      relative.history.unshift({ week: this.week, text: `${person.name} passou a integrar formalmente sua árvore familiar.` });
    });
    const parentIds = selected.filter((entry) => entry.role === "parent").map((entry) => entry.relative.id);
    if (person.age < 18 && parentIds.length) person.guardianship = { guardianId: parentIds[0], coGuardianId: parentIds[1] || null, reason: "Responsabilidade parental", placement: "família de origem", startedWeek: this.week, active: true };
    return selected.map(({ relative, role }) => ({ personId: relative.id, name: relative.name, role }));
  }
  createPlayerCitizen(character) {
    if (!character?.name || this.playerId) return this.player();
    const template = this.makePerson(this.people.length), originalHome = this.buildings.find((building) => building.id === template.homeId);
    const originId = character.originId || "city_native", temporary = ["newcomer", "second_chance"].includes(originId);
    const availableHomes = this.buildings.filter((building) => building.type === "home" && (building.occupied || 0) < (building.capacity || 1));
    const heirHomes = availableHomes.filter((building) => ["Apartamento", "Residencial multifamiliar"].includes(building.propertyType));
    const selectedHome = temporary
      ? this.buildings.find((building) => building.id === this.housingSystem.hotelId) || this.buildings.find((building) => building.name === "Hotel Central")
      : originId === "family_heir"
        ? (heirHomes.length ? heirHomes : availableHomes).slice().sort((a, b) => (b.value || 0) - (a.value || 0) || (b.capacity - b.occupied) - (a.capacity - a.occupied))[0]
        : availableHomes.slice().sort((a, b) => (a.occupied || 0) - (b.occupied || 0) || (a.rent || 0) - (b.rent || 0))[0];
    const home = selectedHome || originalHome;
    if (originalHome?.id !== home?.id) {
      originalHome.occupied = Math.max(0, (originalHome.occupied || 0) - 1);
      home.occupied = (home.occupied || 0) + 1;
    }
    const patch = createSimulationPersonPatch(character, {
      personId: template.id,
      homeId: home?.id || template.homeId,
      housing: character.startingConditions?.housing,
      startingMoney: character.startingConditions?.money,
      institutionName: Number(character.age) < 18 ? "Escola Municipal" : "Faculdade Municipal",
    });
    Object.assign(template, patch, {
      id: template.id,
      controlledByPlayer: true,
      playerControlled: true,
      controlMode: "player",
      decisionMode: "player",
      role: patch.role === "Desempregado(a)" ? "Desempregado" : patch.role,
      homeId: home?.id || template.homeId,
      locationId: home?.id || template.homeId,
      x: (home?.x || 0) + (home?.w || 1) / 2,
      y: (home?.y || 0) + (home?.h || 1) / 2,
      target: null,
      path: [],
      currentTrip: null,
      destinationId: null,
      scheduleKey: "player-control",
      activity: temporary ? "Instalando-se temporariamente no Hotel Central" : "Em casa · aguardando sua decisão",
      activityCategory: "leisure",
      currentAction: { text: "Aguardando sua decisão", phase: "present", placeId: home?.id || null, destinationId: null, mode: null, sinceWeek: this.week, sinceDay: this.day, sinceMinute: this.minute },
      playerControl: {
        autonomyFallback: false,
        obeyRoutineWhenIdle: false,
        directCommandPriority: 100,
        activeAction: null,
        lastCommandResult: null,
        workMinutesThisWeek: 0,
        studyMinutesThisWeek: 0,
        totalCommands: 0,
      },
      playerState: {
        originId,
        reputation: character.startingConditions?.reputation || 0,
        biography: character.biography || "",
        professionPreference: character.professionPreference || "",
        joinedWeek: this.week,
      },
      personalGoals: (character.goals || []).map((goal) => ({ ...goal, milestones: [...(goal.milestones || [])] })),
      history: [{ week: this.week, text: temporary ? "Chegou a Vila Esperança para começar uma nova vida." : `Começou uma nova trajetória em ${home?.name || "Vila Esperança"}.` }],
    });
    template.lifeCourse = initializeLifeCourse(template, this.week);
    template.lifeStage = lifeStageForAge(template.age).id;
    template.education = template.education || emptyEducation();
    if (template.role === "Estudante") {
      const stage = stageForAge(template.age) || educationStages.find((entry) => entry.id === "college");
      template.education = {
        ...template.education,
        stage: stage.id,
        institution: stage.institution,
        course: stage.id === "college" ? courses[0] : null,
        enrolled: true,
        attendance: 100,
        performance: 55,
        history: [{ week: this.week, text: `Matrícula inicial em ${stage.name}.` }],
      };
      template.workplace = stage.institution;
    }
    this.people.push(template);
    const tenure = originId === "family_heir" ? "owned" : temporary ? "temporary" : character.startingConditions?.housing === "owned" ? "owned" : "rent";
    const otherHouseholdIds = new Set(this.people.filter((person) => person.alive && person.id !== template.id && person.homeId === template.homeId).map((person) => person.householdId).filter(Boolean));
    const propertyShare = tenure === "owned" && home ? (home.ownerId && home.ownerId !== template.id ? 1 / Math.max(2, otherHouseholdIds.size + 1) : 1) : 0;
    const household = this.createHousehold({
      surname: template.family,
      homeId: template.homeId,
      memberIds: [template.id],
      wealth: template.money + Math.round((home?.value || 0) * propertyShare),
      tenure,
      origin: originId === "newcomer" ? "Outra cidade" : "Vila Esperança",
      reputation: 50 + (character.startingConditions?.reputation || 0),
      milestones: [{ week: this.week, text: `${template.name} iniciou uma trajetória controlada pelo jogador.` }],
    });
    template.familyId = household.id;
    template.householdId = household.id;
    template.housing = tenure;
    if (tenure === "owned" && home) {
      if (!home.ownerId || home.ownerId === template.id) home.ownerId = template.id;
      else {
        home.unitOwnerIds = [...new Set([...(home.unitOwnerIds || []), template.id])];
        template.propertyInterests = [{ buildingId: home.id, kind: "residential_unit", share: propertyShare }];
      }
      home.tenure = "owned";
    }
    if (temporary && !this.housingSystem.hotelGuests.includes(template.id)) this.housingSystem.hotelGuests.push(template.id);
    this.playerId = template.id;
    this.ensureCharacterState(template);
    this.relationshipProfileFor(template);
    this.rebuildRelationshipIndex();
    template.playerState.localFamily = this.connectPlayerToLocalFamily(template, originId);
    const contacts = Math.max(0, Number(character.startingConditions?.socialContacts) || 0);
    this.people.filter((person) => person.id !== template.id && person.alive && person.age >= Math.max(6, template.age - 24) && person.age <= template.age + 24).slice(0, contacts).forEach((person) => {
      const link = this.ensureSocialRelationship(template, person, { isNeighbor: true });
      if (link) { link.affinity = Math.max(link.affinity || 0, 48); link.trust = Math.max(link.trust || 0, 42); }
    });
    this.rebuildRelationshipIndex();
    this.rebuildKinship({ seedLinks: true });
    this.lifeStageSystem.summary = lifeStageSummary(this.people);
    this.syncHousingOccupancy();
    this.recordCharacterMemory(template, { kind: "novo começo", summary: template.history[0].text, placeId: template.homeId, valence: 58, importance: 90, novelty: 100, core: true, tags: ["player", "origem", originId] });
    return template;
  }
  createCityGrid() {
    this.city ||= { streets, districts, lots: [] };
    const residentialTypes=["Casa térrea","Sobrado","Apartamento","Kitnet","Residencial multifamiliar"],propertyTypeIds=["casa","sobrado","apartamento","kitnet","pensao","casa-geminada","condominio"];
    this.buildings.forEach((b, i) => {b.address = addressFor(b, i, this.city);if(b.type==="home"){b.propertyType=residentialTypes[i%residentialTypes.length];b.propertyTypeId=propertyTypeIds[i%propertyTypeIds.length];b.bedrooms=b.propertyType==="Kitnet"?1:1+(i%4);b.condition=72+(i*7)%28;b.area=Math.round(38+b.w*b.h*18+(i%5)*12);b.yearBuilt=1968+(i*11)%58;b.rent||=Math.round((b.value||100000)*.006);}});
  }
  createPhysicalSpaces() {
    this.buildings.forEach((building) => this.ensurePhysicalSpaces(building));
    this.spatialSystem = { revisions: 1, lastSync: null, occupancy: {}, overcrowded: [] };
  }
  ensurePhysicalSpaces(building) {
    if (!building || building.spaces?.length) return building?.spaces || [];
    const capacity = Math.max(2, building.capacity || 20), layouts = {
      home: [["living", "Sala", .28], ["kitchen", "Cozinha", .14], ["bedroom", "Quartos", .42], ["service", "Área de serviço", .08], ["yard", "Quintal / acesso", .08]],
      shop: [["public", "Área de atendimento", .42], ["service", "Balcão / serviço", .18], ["staff", "Área da equipe", .14], ["stock", "Estoque", .18], ["access", "Entrada e calçada", .08]],
      health: [["reception", "Recepção", .12], ["waiting", "Sala de espera", .18], ["care", "Consultórios e atendimento", .34], ["ward", "Internação", .26], ["staff", "Área clínica", .10]],
      school: [["reception", "Entrada", .08], ["classroom", "Salas de aula", .56], ["staff", "Sala da equipe", .12], ["social", "Pátio e convivência", .18], ["service", "Apoio", .06]],
      civic: [["reception", "Recepção pública", .18], ["public", "Atendimento", .28], ["office", "Área administrativa", .24], ["secure", "Área restrita", .22], ["access", "Entrada e calçada", .08]],
      park: [["access", "Acessos", .12], ["social", "Área de convivência", .48], ["leisure", "Lazer", .30], ["service", "Apoio", .10]],
    }, layout = layouts[building.type] || layouts.civic;
    building.floors ||= building.type === "home" ? Math.max(1, Math.ceil(capacity / 8)) : Math.max(1, Math.ceil(capacity / 35));
    building.spaces = layout.map(([id, name, share], index) => ({ id: `${building.id}:${id}`, kind: id, name, floor: Math.min(building.floors, 1 + Math.floor(index / 3)), capacity: Math.max(1, Math.round(capacity * share)), occupants: [] }));
    building.access = this.accessPoint?.(building) || { x: building.x + building.w / 2, y: building.y + building.h };
    return building.spaces;
  }
  choosePhysicalSpace(person, building, action) {
    const spaces = this.ensurePhysicalSpaces(building), activity = `${action?.text || person.activity || ""}`.toLowerCase();
    const preferred = person.medical?.admitted ? ["ward", "care"] : person.justice?.incarcerated ? ["secure"] : /dorm|sono|casa/.test(activity) ? ["bedroom", "living"] : /cozinh|refei|comendo/.test(activity) ? ["kitchen", "service"] : /trabalh|expediente|aula|estud/.test(activity) ? ["staff", "office", "classroom", "service"] : /compr|atend|consulta|tratamento/.test(activity) ? ["care", "public", "waiting"] : /lazer|conversa|festa|evento/.test(activity) ? ["social", "leisure", "public"] : ["living", "public", "reception", "social"];
    return preferred.map(kind => spaces.find(s => s.kind === kind && s.occupants.length < s.capacity)).find(Boolean) || spaces.slice().sort((a,b) => a.occupants.length/a.capacity - b.occupants.length/b.capacity)[0];
  }
  syncPhysicalOccupancy() {
    if (!this.spatialSystem) return;
    this.refreshWorldIndexes();
    this.spatialSystem.occupancy = {}; this.spatialSystem.overcrowded = [];
    this.buildings.forEach(b => this.ensurePhysicalSpaces(b).forEach(s => { s.occupants = []; }));
    this.people.filter(p => p.alive && !p.currentTrip && p.locationId).forEach(p => { const b = this.buildingIndex.get(p.locationId); if (!b) return; const space = this.choosePhysicalSpace(p, b, p.currentAction); if (!space) return; space.occupants.push(p.id); p.currentAction.spaceId = space.id; p.currentAction.spaceName = space.name; });
    this.buildings.forEach(b => { const present = b.spaces.reduce((n,s) => n + s.occupants.length, 0), capacity = b.spaces.reduce((n,s) => n + s.capacity, 0); this.spatialSystem.occupancy[b.id] = { present, capacity, ratio: present / Math.max(1, capacity) }; if (present > capacity) this.spatialSystem.overcrowded.push(b.id); });
    this.spatialSystem.lastSync = { week: this.week, day: this.day, minute: this.minute };
  }
  createInfrastructureSystem() {
    this.infrastructure = {
      systems: {},
      outages: [],
      revenue: 0,
      maintenance: 0,
      serviceLevel: 100,
    };
    Object.entries(utilityTypes).forEach(
      ([id, info]) =>
        (this.infrastructure.systems[id] = {
          id,
          ...info,
          capacity: info.baseCapacity,
          demand: 0,
          condition: 88 + Math.random() * 10,
          active: true,
        }),
    );
    this.buildings.forEach((b) => (b.meter = emptyMeter()));
  }
  dailyInfrastructure() {
    const totals = { water: 0, power: 0, waste: 0 };
    this.buildings.forEach((b) => {
      b.meter ||= emptyMeter();
      const base = buildingDemand[b.type] || buildingDemand.civic,
        people = b.type === "home" ? Math.max(1, b.occupied || 0) : 3,
        activity =
          b.businessId &&
          this.isOpen(this.businesses.find((x) => x.id === b.businessId))
            ? 1.2
            : 1;
      Object.keys(totals).forEach((type) => {
        const amount =
          base[type] *
          (0.65 + people * 0.16) *
          activity *
          (0.88 + Math.random() * 0.24);
        b.meter[type] += amount;
        totals[type] += amount;
      });
    });
    Object.entries(this.infrastructure.systems).forEach(([type, system]) => {
      system.demand = totals[type];
      system.condition = Math.max(
        0,
        system.condition - (system.demand / system.capacity) * 0.035,
      );
      const overloaded = system.demand > system.capacity,
        breakdown = Math.random() < (100 - system.condition) / 18000;
      if ((overloaded || breakdown) && system.active)
        this.startOutage(type, overloaded ? "sobrecarga" : "falha técnica");
    });
    this.infrastructure.outages.slice().forEach((o) => {
      o.remaining--;
      if (o.remaining <= 0) this.endOutage(o);
    });
    const ratios = Object.values(this.infrastructure.systems).map((s) =>
      Math.min(1, s.demand / s.capacity),
    );
    this.infrastructure.serviceLevel = Math.round(
      100 - this.infrastructure.outages.length * 12 - Math.max(...ratios) * 8,
    );
  }
  startOutage(type, cause) {
    const system = this.infrastructure.systems[type],
      district =
        this.city.districts[
          Math.floor(Math.random() * this.city.districts.length)
        ];
    system.active = false;
    const outage = {
      id: uid("outage"),
      type,
      districtId: district.id,
      cause,
      remaining: 1 + Math.floor(Math.random() * 3),
      started: this.week,
    };
    this.infrastructure.outages.push(outage);
    this.buildings
      .filter((b) => b.districtId === district.id)
      .forEach((b) => {
        b.meter.outages++;
        b.meter.connected = false;
        this.people
          .filter((p) => p.homeId === b.id)
          .forEach((p) => (p.happiness = Math.max(0, p.happiness - 3)));
      });
    this.log(
      "infraestrutura",
      `${system.name}: ${cause} interrompeu o serviço em ${district.name}.`,
      "civic",
    );
  }
  endOutage(outage) {
    this.infrastructure.outages = this.infrastructure.outages.filter(
      (o) => o.id !== outage.id,
    );
    const system = this.infrastructure.systems[outage.type];
    system.active = true;
    system.condition = Math.min(100, system.condition + 8);
    const district = this.city.districts.find(
      (d) => d.id === outage.districtId,
    );
    this.buildings
      .filter((b) => b.districtId === district.id)
      .forEach((b) => (b.meter.connected = true));
    this.infrastructure.maintenance += 4200;
    this.money -= 4200;
    this.log(
      "reparo",
      `O serviço de ${system.name.toLowerCase()} foi restabelecido em ${district.name}.`,
      "social",
    );
  }
  weeklyInfrastructure() {
    let billed = 0;
    this.buildings.forEach((b) => {
      const usage =
        b.meter.water * utilityTypes.water.rate +
        b.meter.power * utilityTypes.power.rate +
        b.meter.waste * utilityTypes.waste.rate;
      b.meter.bill = usage;
      billed += usage;
      const family = this.families.find((f) => f.homeId === b.id);
      if (family) {
        const adults = family.memberIds
          .map((id) => this.people.find((p) => p.id === id))
          .filter((p) => p?.alive && p.age >= 18);
        adults.forEach((p) => (p.money -= usage / Math.max(1, adults.length)));
      }
      const business = this.businesses.find((x) => x.buildingId === b.id);
      if (business) business.cash -= usage;
      b.meter.water = 0;
      b.meter.power = 0;
      b.meter.waste = 0;
    });
    this.infrastructure.revenue += billed;
    this.money += billed;
    Object.values(this.infrastructure.systems).forEach((s) => {
      if (s.condition < 65) {
        const cost = 3500;
        s.condition = Math.min(100, s.condition + 12);
        this.infrastructure.maintenance += cost;
        this.money -= cost;
      }
    });
  }
  createEventSystem() {
    this.events = {
      calendar: structuredClone(seasonalCalendar),
      active: [],
      history: [],
      attendance: 0,
      season: seasonForWeek(this.week),
    };
  }
  weeklyEvents() {
    const weekOfYear = ((this.week - 1) % 52) + 1;
    this.events.season = seasonForWeek(weekOfYear);
    this.events.calendar
      .filter((e) => e.week === weekOfYear)
      .forEach((template) => {
        const event = {
          ...structuredClone(template),
          id: `${template.id}-${this.week}`,
          remaining: template.duration,
          participants: this.people
            .filter((p) => p.alive && p.age >= 6 && Math.random() < 0.48)
            .map((p) => p.id),
          attendance: 0,
          status: "active",
        };
        this.events.active.push(event);
        this.money -= event.budget;
        this.log(
          "evento",
          `${event.name} começou em ${event.location}.`,
          "social",
        );
      });
  }
  dailyEvents({ dayComplete = false } = {}) {
    this.events.active.slice().forEach((event) => {
      if (event.suspended) return;
      if (event.familyEvent) {
        const scheduledDate = (event.week - 1) * 7 + event.day;
        const currentDate = (this.week - 1) * 7 + this.day;
        if (currentDate < scheduledDate || (currentDate === scheduledDate && !dayComplete)) {
          if (currentDate === scheduledDate) event.status = "active";
          return;
        }
        event.remaining = 0;
      }
      event.remaining--;
      if (event.remaining <= 0) {
        event.status = "finished";
        this.events.active = this.events.active.filter(
          (e) => e.id !== event.id,
        );
        this.events.history.unshift(event);
        this.events.history = this.events.history.slice(0, 30);
        this.log(
          "evento",
          `${event.name} terminou com ${event.attendance} visitas.`,
          "social",
        );
      }
    });
  }
  activeEventFor(p) {
    const hour = this.minute / 60, key = `${this.week}:${this.day}:${Math.floor(hour)}:${this.events.active.length}`;
    if (this.activeEventIndexKey !== key) {
      this.activeEventIndexKey = key;
      this.activeEventByPerson = new Map();
      this.activeEventById = new Map();
      this.events.active.forEach((event) => {
        this.activeEventById.set(event.id, event);
        const active = !event.suspended && (!event.familyEvent || (event.week === this.week && event.day === this.day)) && (event.end > event.start ? hour >= event.start && hour < event.end : hour >= event.start || hour < event.end);
        if (!active) return;
        (event.participants || []).forEach((personId) => { if (!this.activeEventByPerson.has(personId)) this.activeEventByPerson.set(personId, event); });
      });
    }
    return this.activeEventByPerson.get(p.id);
  }
  createCityDynamicsSystem() {
    const absoluteDay = (this.week - 1) * 7 + this.day;
    this.cityDynamics = {
      state: createCityDynamicsState({ week: this.week, absoluteDay, baselineIntensity: 48 }),
      latestAnalysis: null,
      latestSummary: null,
      activeImpulses: [],
      history: [],
      applied: 0,
      logsToday: 0,
      tripsStartedToday: 0,
      tripsCompletedToday: 0,
      tripsAbandonedToday: 0,
      lastInteractionCount: this.characterSystem?.interactions || 0,
    };
  }
  cityDynamicsSnapshot() {
    const alive = this.people.filter((person) => person.alive), absoluteDay = (this.week - 1) * 7 + this.day;
    const workingAge = alive.filter((person) => person.age >= 18 && person.age < 70 && !/estudante|aposentad/i.test(person.role));
    const unemployed = workingAge.filter((person) => person.role === "Desempregado" || !person.workplace || person.workplace === "—");
    const housing = this.housingStats(), interactionCount = Math.max(0, (this.characterSystem?.interactions || 0) - (this.cityDynamics?.lastInteractionCount || 0));
    const familyByMember = new Map();
    this.families.forEach((family) => (family.memberIds || []).forEach((id) => familyByMember.set(id, family)));
    const people = alive.map((person) => {
      const family = familyByMember.get(person.id), trip = person.currentTrip;
      return {
        id: person.id,
        alive: true,
        age: person.age,
        health: person.health,
        medical: person.medical,
        employmentStatus: unemployed.includes(person) ? "desempregado" : "empregado",
        workplaceId: person.workplace && person.workplace !== "—" ? person.workplace : null,
        currentAction: person.activity,
        waitingMinutes: trip?.phase === "waiting" ? trip.waitedMinutes || 0 : 0,
        temporaryHousing: family?.tenure === "temporary" || /hotel|pousada/i.test(this.buildingIndex?.get(person.homeId)?.name || ""),
      };
    });
    const businesses = this.businesses.map((business) => {
      const products = Object.values(business.products || {}), inventoryRatio = products.length ? products.reduce((sum, product) => sum + (product.stock || 0) / Math.max(1, product.target || product.stock || 1), 0) / products.length : 1;
      const staffing = this.businessStaffing(business);
      return {
        id: business.id,
        active: !business.closed,
        status: business.closed ? "encerrado" : "ativo",
        cash: business.cash,
        inventoryRatio,
        staff: staffing.total,
        requiredStaff: business.minimumStaff || 1,
        openPositions: Math.max(0, (business.minimumStaff || 1) - staffing.total),
        understaffed: staffing.total < (business.minimumStaff || 1),
      };
    });
    return {
      week: this.week,
      day: this.day,
      absoluteDay,
      people,
      businesses,
      logs: this.logs,
      districts: this.city.districts,
      publicPlaces: this.buildings.filter((building) => ["park", "civic"].includes(building.type)),
      infrastructure: Object.entries(this.infrastructure?.systems || {}).map(([id, system]) => ({ id, condition: system.condition })),
      transport: { routes: this.transportSystem.routes, averageWaitMinutes: this.transportSystem.averageWait, congestion: this.transportSystem.congestionIndex, serviceFailures: this.cityDynamics?.tripsAbandonedToday || 0 },
      health: { capacity: this.healthSystem.beds, occupied: this.healthSystem.admitted.length },
      justice: { crimes: this.justiceSystem.openCases },
      housing: { shortage: Math.max(0, alive.length - housing.capacity) },
      metrics: {
        recentLogs: this.cityDynamics?.logsToday || 0,
        recentInteractions: interactionCount,
        unemploymentRate: workingAge.length ? unemployed.length / workingAge.length * 100 : 0,
        averageWaitMinutes: this.transportSystem.averageWait,
        congestion: this.transportSystem.congestionIndex,
        serviceFailures: this.cityDynamics?.tripsAbandonedToday || 0,
        recentCrimes: this.justiceSystem.openCases.filter((crime) => this.week - (crime.week || this.week) <= 1).length,
        healthCapacity: this.healthSystem.beds,
        healthOccupied: this.healthSystem.admitted.length,
        housingShortage: Math.max(0, alive.length - housing.capacity),
      },
    };
  }
  expireCityDynamicsEffects() {
    if (!this.cityDynamics) return;
    const absoluteDay = (this.week - 1) * 7 + this.day;
    this.businesses.forEach((business) => { if (business.dynamicCampaign?.untilDay < absoluteDay) delete business.dynamicCampaign; });
    this.transportSystem.routes.forEach((route) => {
      if (route.dynamicReinforcement?.untilDay < absoluteDay) {
        route.frequency = route.dynamicReinforcement.baseFrequency;
        delete route.dynamicReinforcement;
      }
    });
    const expired = this.cityDynamics.activeImpulses.filter((item) => item.expiresDay < absoluteDay);
    this.cityDynamics.history.unshift(...expired.map((item) => ({ ...item, status: "completed" })));
    this.cityDynamics.history = this.cityDynamics.history.slice(0, 80);
    this.cityDynamics.activeImpulses = this.cityDynamics.activeImpulses.filter((item) => item.expiresDay >= absoluteDay);
  }
  impulseVenue(impulse) {
    const targetId = impulse.targets?.ids?.[0], direct = this.buildingIndex?.get(targetId);
    if (direct) return direct;
    if (impulse.type === "neighborhood_market") return this.buildingNameIndex?.get("Mercado do Sol");
    if (impulse.type === "cultural_program") return this.buildingNameIndex?.get("Cinema Municipal") || this.buildingNameIndex?.get("Praça das Acácias");
    if (["health_advisory", "mobile_health_outreach"].includes(impulse.type)) return this.buildingNameIndex?.get("UBS Vila Esperança") || this.buildingNameIndex?.get("Hospital São Lucas");
    if (impulse.type === "housing_orientation_day") return this.buildingNameIndex?.get("Prefeitura");
    if (impulse.type === "local_safety_forum") return this.buildingNameIndex?.get("Delegacia");
    const districtId = impulse.targets?.kind === "district" ? targetId : null;
    return this.buildings.find((building) => ["park", "civic"].includes(building.type) && (!districtId || building.districtId === districtId) && !/presídio|cemitério|médico-legal/i.test(building.name)) || this.buildingNameIndex?.get("Praça das Acácias");
  }
  scheduleCityImpulseEvent(impulse, venue, options = {}) {
    if (!venue) return null;
    const absoluteDay = (this.week - 1) * 7 + this.day, start = options.start ?? 18, end = options.end ?? Math.min(24, start + 3);
    const relevant = this.people.filter((person) => {
      if (!person.alive || person.age < 6 || person.justice.incarcerated || person.medical.admitted) return false;
      if (options.audience === "health") return person.health < 75 || person.medical.conditions.length > 0 || person.age > 64;
      if (options.audience === "housing") { const family = this.families.find((item) => item.memberIds?.includes(person.id)); return family?.tenure === "temporary" || family?.arrears > 1; }
      const block = currentBlock(person, this.day, start * 60);
      return ["rest", "leisure", "social", "meal", "errand"].includes(block.category);
    });
    const capacity = Math.max(1, Math.min(venue.capacity || 40, Math.max(12, Math.round(14 + (this.cityDynamics.state.intensity || 50) * .22))));
    const participants = relevant.sort(() => Math.random() - .5).slice(0, capacity).map((person) => person.id);
    const event = {
      id: `${impulse.id}:event`,
      name: options.name || impulse.label,
      location: venue.name,
      start,
      end,
      remaining: 1,
      participants,
      attendedIds: [],
      attendance: 0,
      status: "active",
      importance: "dinâmica local",
      dynamicImpulseId: impulse.id,
      dynamicImpulseType: impulse.type,
      week: this.week,
      day: this.day,
      budget: options.budget || 0,
      effect: options.effect || null,
      scheduledAbsoluteDay: absoluteDay,
    };
    this.events.active.push(event);
    this.activeEventIndexKey = "";
    return event;
  }
  applyCityImpulse(impulse) {
    const absoluteDay = (this.week - 1) * 7 + this.day, venue = this.impulseVenue(impulse);
    let event = null, detail = impulse.label, tone = "social", kind = "evento";
    if (impulse.type === "local_business_campaign") {
      const preferred = this.businesses.find((business) => business.id === impulse.targets?.ids?.[0] && !business.closed && business.days.includes(this.day));
      const business = preferred || this.businesses.find((item) => !item.closed && item.days.includes(this.day));
      if (business) {
        business.dynamicCampaign = { impulseId: impulse.id, untilDay: impulse.expiresDay, serviceBonus: 7, startedDay: absoluteDay };
        const building = this.buildingIndex?.get(business.buildingId), start = business.open === 0 ? 10 : business.close < business.open ? business.open : Math.max(business.open, 10);
        event = this.scheduleCityImpulseEvent(impulse, building, { start, end: Math.min(24, start + 3), name: `Circuito local em ${business.name}` });
        detail = `${business.name} iniciou uma campanha local com programação e atendimento reforçado.`; tone = "money"; kind = "economia";
      }
    } else if (impulse.type === "hiring_round") {
      const business = this.businesses.find((item) => item.id === impulse.targets?.ids?.[0] && !item.closed) || this.businesses.filter((item) => !item.closed).sort((a, b) => (b.minimumStaff - b.employees.length) - (a.minimumStaff - a.employees.length))[0];
      if (business) {
        const before = business.employees.length, needed = Math.max(1, (business.minimumStaff || 1) - this.businessStaffing(business).total);
        this.recruitForBusiness(business, needed);
        const hired = Math.max(0, business.employees.length - before);
        detail = hired ? `${business.name} contratou ${hired} morador(es) em uma rodada coordenada de vagas.` : `${business.name} abriu uma rodada de entrevistas para completar sua equipe.`;
        tone = "money"; kind = "economia";
      }
    } else if (impulse.type === "transit_reinforcement") {
      const route = this.transportSystem.routes.find((item) => item.id === impulse.targets?.ids?.[0]) || this.transportSystem.routes.slice().sort((a, b) => b.waiting - a.waiting)[0];
      if (route) {
        route.dynamicReinforcement ||= { baseFrequency: route.frequency, untilDay: impulse.expiresDay };
        route.dynamicReinforcement.untilDay = impulse.expiresDay;
        route.frequency = Math.max(6, route.dynamicReinforcement.baseFrequency - 4);
        route.punctuality = clamp(route.punctuality + 3, 0, 99);
        detail = `${route.name} recebeu reforço temporário; o intervalo caiu para ${route.frequency} minutos.`; tone = "civic"; kind = "transporte";
      }
    } else if (impulse.type === "preventive_maintenance") {
      const entries = Object.entries(this.infrastructure.systems), [systemId, system] = entries.find(([id]) => id === impulse.targets?.ids?.[0]) || entries.sort((a, b) => a[1].condition - b[1].condition)[0] || [];
      if (system) {
        const before = system.condition, cost = 1200;
        system.condition = clamp(system.condition + 5, 0, 100); this.money -= cost; this.infrastructure.maintenance += cost;
        detail = `A manutenção preventiva de ${system.label || systemId} elevou a condição de ${Math.round(before)}% para ${Math.round(system.condition)}%.`; tone = "civic"; kind = "obras";
      }
    } else {
      const configuration = {
        community_meetup: { start: 18, end: 21 },
        cultural_program: { start: 19, end: 23 },
        neighborhood_market: { start: this.day >= 5 ? 10 : 17, end: this.day >= 5 ? 14 : 21 },
        public_cleanup: { start: this.day >= 5 ? 9 : 17, end: this.day >= 5 ? 12 : 20, effect: "urban_care" },
        health_advisory: { start: 9, end: 13, audience: "health", effect: "health_outreach" },
        mobile_health_outreach: { start: 9, end: 14, audience: "health", effect: "health_outreach" },
        local_safety_forum: { start: 19, end: 21, effect: "civic_participation" },
        local_debate: { start: 19, end: 22, effect: "civic_participation" },
        housing_orientation_day: { start: 17, end: 21, audience: "housing", effect: "housing_guidance" },
      }[impulse.type] || { start: 18, end: 21 };
      event = this.scheduleCityImpulseEvent(impulse, venue, configuration);
      detail = `${impulse.label} foi confirmado em ${venue?.name || "Vila Esperança"}, com ${event?.participants.length || 0} moradores inscritos.`;
      if (["health_advisory", "mobile_health_outreach"].includes(impulse.type)) { kind = "saúde"; tone = "civic"; }
      if (impulse.type === "housing_orientation_day") { kind = "moradia"; tone = "civic"; }
      if (["local_safety_forum", "local_debate", "public_cleanup"].includes(impulse.type)) tone = "civic";
      if (impulse.type === "neighborhood_market") { kind = "economia"; tone = "money"; }
    }
    this.log(kind, detail, tone);
    return { ...impulse, status: "active", eventId: event?.id || null, detail, startedDay: absoluteDay };
  }
  dailyCityDynamics({ initial = false } = {}) {
    if (!this.cityDynamics) this.createCityDynamicsSystem();
    this.expireCityDynamicsEffects();
    const snapshot = this.cityDynamicsSnapshot(), result = runDailyCityDynamics(this.cityDynamics.state, snapshot, { week: this.week, dayOfWeek: this.day, absoluteDay: snapshot.absoluteDay, baselineIntensity: initial ? 52 : 48, metrics: snapshot.metrics });
    this.cityDynamics.lastInteractionCount = this.characterSystem?.interactions || 0;
    this.cityDynamics.logsToday = 0;
    this.cityDynamics.tripsStartedToday = 0;
    this.cityDynamics.tripsCompletedToday = 0;
    this.cityDynamics.tripsAbandonedToday = 0;
    const applied = result.impulses.map((impulse) => this.applyCityImpulse(impulse));
    const appliedIds = new Set(applied.map((impulse) => impulse.id));
    this.cityDynamics.state = { ...result.state, recentImpulses: result.state.recentImpulses.map((impulse) => appliedIds.has(impulse.id) ? { ...impulse, status: "active" } : impulse) };
    this.cityDynamics.latestAnalysis = result.analysis;
    this.cityDynamics.latestSummary = summarizeCityDynamics(this.cityDynamics.state);
    this.cityDynamics.activeImpulses.unshift(...applied);
    this.cityDynamics.activeImpulses = this.cityDynamics.activeImpulses.slice(0, 30);
    this.cityDynamics.applied += applied.length;
    return { ...result, applied };
  }
  createCityDevelopmentSystem() {
    const snapshot = this.cityDevelopmentSnapshot();
    this.cityDevelopment = createCityDevelopmentState(snapshot, { week: this.week });
    this.cityDevelopmentSummary = this.buildCityDevelopmentSummary(snapshot);
  }
  cityDevelopmentSnapshot() {
    const alive = this.people.filter((person) => person.alive), population = alive.length, housing = this.housingStats();
    const privateProjects = (this.realEstateDynamics?.projects || []).filter((project) => project.status === "active");
    const privatePipelineCapacity = privateProjects.reduce((sum, project) => sum + Math.max(0, project.capacity || project.units || 0), 0);
    const workingAge = alive.filter((person) => person.age >= 18 && person.age < 70 && !/estudante|aposentad/i.test(person.role || ""));
    const unemployed = workingAge.filter((person) => person.role === "Desempregado" || !person.workplace || person.workplace === "—");
    const vacancies = this.workforceSystem?.vacancies?.reduce((sum, item) => sum + (item.count || 0), 0) || this.businesses.reduce((sum, business) => sum + Math.max(0, (business.minimumStaff || 1) - (business.employees || []).filter((id) => this.people.find((person) => person.id === id)?.alive).length), 0);
    const students = alive.filter((person) => person.education?.enrolled).length, schoolCapacity = (this.educationSystem?.schoolCapacity || 0) + (this.educationSystem?.collegeCapacity || 0);
    const infrastructureSystems = Object.values(this.infrastructure?.systems || {}), infrastructureCondition = infrastructureSystems.length ? infrastructureSystems.reduce((sum, system) => sum + (system.condition || 0), 0) / infrastructureSystems.length : this.infrastructure?.serviceLevel || 70;
    const availableLots = this.city.lots.filter((lot) => !lot.occupied && !lot.reservedForDevelopment && ["urbanized", "ready"].includes(lot.status || "urbanized"));
    const plannedLots = this.city.lots.filter((lot) => ["planned", "earthworks", "servicing"].includes(lot.status));
    const activeCases = this.justiceSystem?.openCases?.filter((item) => !["arquivado", "absolvido"].includes(item.status)) || [];
    const eligibleDepartures = this.families.filter((family) => {
      if (!family.arrivedWeek || this.week - family.arrivedWeek < 12 || family.memberIds?.includes(this.playerId)) return false;
      const living = this.livingHouseholdMembers(family), adults = living.filter((person) => person.age >= 18);
      return living.length > 0 && living.length <= 2 && family.tenure === "temporary" && adults.length > 0 && adults.every((person) => !person.shift && person.role === "Desempregado");
    }).length;
    return {
      week: this.week,
      population,
      weeklyPopulationChange: this.cityDevelopment?.weekly?.netChange || 0,
      totals: { births: this.demographics?.births || 0, deaths: this.deaths?.length || 0, arrivals: this.housingSystem?.immigrants || 0, departures: this.housingSystem?.departures || 0 },
      housing: { ...housing, pipelineCapacity: this.housingSystem.construction.reduce((sum, project) => sum + (project.capacity || 0), 0) + privatePipelineCapacity, activeProjects: this.housingSystem.construction.length, privateProjects: privateProjects.length, hotelCapacity: this.housingSystem.hotelCapacity, priceIndex: this.housingSystem.priceIndex },
      labor: { unemploymentRate: workingAge.length ? unemployed.length / workingAge.length * 100 : 0, vacancies, participationRate: workingAge.length ? (workingAge.length - unemployed.length) / workingAge.length * 100 : 0 },
      services: { health: clamp(100 - this.healthSystem.waiting.length * 2 - this.healthSystem.admitted.length / Math.max(1, this.healthSystem.beds) * 25, 20, 100), education: clamp(100 - students / Math.max(1, schoolCapacity) * 30, 30, 100), civic: clamp((this.infrastructure?.serviceLevel || 72) + this.buildings.filter((building) => ["civic", "park"].includes(building.type)).length / Math.max(1, population) * 90, 25, 100), healthCapacity: this.healthSystem.beds, healthOccupied: this.healthSystem.admitted.length, educationCapacity: schoolCapacity, educationOccupied: students, crimeRate: activeCases.length / Math.max(1, population) * 100 },
      mobility: { averageWait: this.transportSystem.averageWait || 0, congestion: this.transportSystem.congestionIndex || 0, failures: this.cityDynamics?.tripsAbandonedToday || 0 },
      environment: { airQuality: this.environment?.cityAirQuality || 75, green: this.environment?.greenIndex || this.environment?.cityGreen || 55 },
      infrastructure: { condition: infrastructureCondition, outages: this.infrastructure?.outages?.filter((outage) => outage.status !== "resolved").length || 0 },
      governance: { approval: this.governance.approval, treasury: this.money, weeklyRevenue: this.governance.weeklyRevenue, weeklySpending: this.governance.weeklySpending },
      land: { availableLots: availableLots.length, mixedLots: availableLots.filter((lot) => lot.zone === "mixed").length, plannedLots: plannedLots.length, activeExpansion: this.urbanEvolution.expansionProjects.some((project) => project.status === "active"), districts: this.city.districts.length },
      economy: { activeBusinesses: this.businesses.filter((business) => !business.closed).length, businessesPer100: this.businesses.filter((business) => !business.closed).length / Math.max(1, population) * 100 },
      migration: { eligibleDepartures },
    };
  }
  districtDevelopmentSnapshot() {
    const activeCases = this.justiceSystem?.openCases?.filter((item) => !["arquivado", "absolvido"].includes(item.status)) || [];
    return this.city.districts.map((district) => {
      const buildings = this.buildings.filter((building) => building.districtId === district.id), homes = buildings.filter((building) => building.type === "home"), residents = this.people.filter((person) => person.alive && homes.some((home) => home.id === person.homeId));
      const capacity = homes.reduce((sum, home) => sum + (home.capacity || 0), 0), employed = residents.filter((person) => person.age < 18 || person.shift || /aposentad|estudante/i.test(person.role || "")).length;
      const lots = this.city.lots.filter((lot) => lot.district === district.id), availableLots = lots.filter((lot) => !lot.occupied && !lot.reservedForDevelopment && ["urbanized", "ready"].includes(lot.status || "urbanized")).length;
      const services = buildings.filter((building) => ["civic", "health", "school", "park"].includes(building.type)).length, businesses = buildings.filter((building) => building.businessId).length;
      const crimeCount = activeCases.filter((item) => buildings.some((building) => building.id === item.locationId)).length, lotService = lots.length ? lots.reduce((sum, lot) => sum + (lot.serviceLevel || (["urbanized", "ready", "developed"].includes(lot.status) ? 80 : 20)), 0) / lots.length : 70;
      const occupancy = capacity ? residents.length / capacity : 0, serviceCoverage = clamp(45 + services * 9 + businesses * 2 - Math.max(0, residents.length - services * 30) * .5, 10, 100), desirability = clamp((this.urbanEvolution.districtMetrics[district.id]?.desirability || 58) + serviceCoverage * .12 - crimeCount * 3, 15, 98);
      const stage = district.status !== "active" ? district.developmentPhase || district.status : residents.length < 12 ? "ocupação inicial" : occupancy > .78 && services >= 2 ? "consolidado" : "em adensamento";
      return { id: district.id, name: district.name, status: district.status || "active", stage, population: residents.length, capacity, occupancy: roundNumber(occupancy * 100, 1), households: new Set(residents.map((person) => person.householdId || person.familyId)).size, employment: residents.length ? roundNumber(employed / residents.length * 100, 1) : 0, businesses, services, serviceCoverage: roundNumber(serviceCoverage, 1), infrastructure: roundNumber(lotService, 1), availableLots, plannedLots: lots.filter((lot) => ["planned", "earthworks", "servicing"].includes(lot.status)).length, crimeCount, desirability: roundNumber(desirability, 1), averageHomeValue: homes.length ? Math.round(homes.reduce((sum, home) => sum + (home.value || 0), 0) / homes.length) : 0, pressure: roundNumber(clamp((occupancy - .65) * 120 + Math.max(0, 55 - serviceCoverage) + Math.max(0, 55 - lotService), 0, 100), 1) };
    });
  }
  collectDevelopmentProjects() {
    const projects = [];
    this.housingSystem.construction.forEach((project) => projects.push({ id: project.id, kind: "housing", name: project.name, districtId: this.city.lots.find((lot) => lot.id === project.lotId)?.district || null, phase: "construção", progress: roundNumber((1 - project.remaining / Math.max(1, project.totalWeeks || project.remaining + 1)) * 100, 1), etaWeek: this.week + project.remaining, capacityAdded: project.capacity, status: "active", lotId: project.lotId }));
    this.urbanEvolution.expansionProjects.filter((project) => project.status === "active").forEach((project) => projects.push({ id: project.id, kind: "expansion", name: this.city.districts.find((district) => district.id === project.districtId)?.name || "Expansão urbana", districtId: project.districtId, phase: project.phaseLabel, progress: roundNumber((project.phaseIndex + project.phaseProgress) / 5 * 100, 1), etaWeek: this.week + project.remainingWeeks + Math.max(0, 4 - project.phaseIndex) * 3, capacityAdded: project.lotIds.length * 8, status: project.status, lotIds: project.lotIds }));
    this.urbanEvolution.projects.forEach((project) => projects.push({ id: project.id, kind: project.type, name: project.name, districtId: this.city.lots.find((lot) => lot.id === project.lotId)?.district || null, phase: "obra vertical", progress: roundNumber((1 - project.remaining / Math.max(1, project.totalWeeks || project.remaining + 1)) * 100, 1), etaWeek: this.week + project.remaining, capacityAdded: project.type === "commercial" ? 12 : 35, status: "active", lotId: project.lotId }));
    (this.realEstateDynamics?.projects || []).filter((project) => !["completed", "cancelled"].includes(project.status)).forEach((project) => projects.push({ id: project.id, kind: "private_development", name: project.name, districtId: this.city.lots.find((lot) => lot.id === project.lotId)?.district || null, phase: project.phases?.[project.phaseIndex]?.label || project.phase || project.status, progress: roundNumber((project.progress || 0) <= 1 ? (project.progress || 0) * 100 : project.progress, 1), etaWeek: this.week + Math.max(1, project.remainingWeeks || 4), capacityAdded: project.units || project.plannedUnits || 0, status: project.status, lotId: project.lotId }));
    (this.localGovernment?.publicWorks || []).filter((work) => !["completed", "cancelled", "archived"].includes(work.status)).forEach((work) => projects.push({ id: work.id, kind: "public_work", name: work.name, districtId: work.districtId || null, phase: work.stage || work.status, progress: roundNumber(work.progress || 0, 1), etaWeek: this.week + Math.max(1, work.expectedWeeks || 4), capacityAdded: 0, status: work.status, streetId: work.streetId || null }));
    return projects.map((entry) => {
      const urban = this.urbanEvolution.projects.find((project) => project.id === entry.id);
      return urban ? { ...entry, capacityAdded: urban.capacityAdded ?? entry.capacityAdded, serviceKind: urban.serviceKind || null } : entry;
    });
  }
  buildCityDevelopmentSummary(snapshot = this.cityDevelopmentSnapshot()) {
    const state = this.cityDevelopment || createCityDevelopmentState(snapshot, { week: this.week }), forecast26 = forecastCityDevelopment(state, snapshot, 26), forecast52 = forecastCityDevelopment(state, snapshot, 52);
    return { revision: state.revision, stage: stageSummary(state, snapshot), attractiveness: state.attractiveness, population: { current: snapshot.population, housingCapacity: snapshot.housing.capacity, housingVacant: snapshot.housing.vacant, hotelGuests: snapshot.housing.hotelGuests, naturalChange: state.weekly?.naturalChange || 0, migrationChange: state.weekly?.migrationChange || 0, netChange: state.weekly?.netChange || 0, rolling13: state.weekly?.rolling13 || 0, annualizedRate: state.weekly?.annualizedRate || 0, births: snapshot.totals.births, deaths: snapshot.totals.deaths, arrivals: snapshot.totals.arrivals, departures: snapshot.totals.departures }, pressures: state.pressures || [], districts: this.districtDevelopmentSnapshot(), projects: this.collectDevelopmentProjects(), forecasts: [forecast26, forecast52], migration: { ...state.migration }, history: state.history || [], milestones: state.milestones || [], formerResidents: state.formerResidents || [], plan: state.lastPlan };
  }
  rezoneForDevelopment(kind = "higher_density") {
    const candidates = this.city.lots.filter((lot) => !lot.occupied && !lot.reservedForDevelopment && ["urbanized", "ready"].includes(lot.status || "urbanized"));
    const lot = kind === "mixed_use" ? candidates.find((candidate) => candidate.zone === "residential") : candidates.filter((candidate) => candidate.zone === "residential" && candidate.developmentRules?.density !== "high").sort((a, b) => (b.area || b.w * b.h * 100) - (a.area || a.w * a.h * 100))[0];
    if (!lot) return false;
    lot.previousZone = lot.zone;
    if (kind === "mixed_use") lot.zone = "mixed";
    lot.developmentRules = { ...(lot.developmentRules || {}), decisionWeek: this.week, kind, density: kind === "higher_density" ? "high" : lot.developmentRules?.density || "medium", maxFloors: kind === "higher_density" ? 8 : 4, mixedUse: kind === "mixed_use" };
    this.urbanEvolution.rezoned++;
    const district = this.city.districts.find((candidate) => candidate.id === lot.district);
    this.urbanEvolution.history.unshift({ week: this.week, text: `${district?.name || "A cidade"} teve um terreno revisado para ${kind === "higher_density" ? "maior densidade residencial" : "uso misto"}.` });
    this.log("zoneamento", `O plano diretor autorizou ${kind === "higher_density" ? "adensamento residencial" : "uso misto"} em ${district?.name || "um setor urbano"}.`, "civic", { cause: "pressões integradas de moradia, emprego e disponibilidade de terrenos", consequences: ["novo potencial construtivo", "infraestrutura monitorada antes da ocupação"], priority: "normal" });
    return true;
  }
  emigrateRecentHousehold() {
    const family = this.families.filter((candidate) => {
      if (!candidate.arrivedWeek || this.week - candidate.arrivedWeek < 12 || candidate.memberIds?.includes(this.playerId) || candidate.tenure !== "temporary") return false;
      const living = this.livingHouseholdMembers(candidate), adults = living.filter((person) => person.age >= 18);
      const ids = new Set(living.map((person) => person.id));
      const hasActiveCase = (this.justiceSystem?.openCases || []).some((item) => [item.perpetratorId, item.suspectId, item.victimId].some((id) => ids.has(id)));
      const hasClinicalCase = (this.healthSystem?.clinicalCases || []).some((item) => ids.has(item.personId) && !["encerrado", "óbito"].includes(item.status));
      const hasScheduledCommitment = (this.events?.active || []).some((event) => (event.participants || []).some((id) => ids.has(id))) || (this.familyEvents || []).some((event) => event.status === "scheduled" && (event.participants || event.participantIds || []).some((id) => ids.has(id)));
      return living.length === 1 && adults.length === 1 && adults.every((person) => !person.shift && person.role === "Desempregado" && !person.partnerId && !(person.children || []).length && !(person.medical?.conditions || []).length && !person.justice?.incarcerated) && !hasActiveCase && !hasClinicalCase && !hasScheduledCommitment;
    }).sort((a, b) => a.arrivedWeek - b.arrivedWeek)[0];
    if (!family) return null;
    const residents = this.livingHouseholdMembers(family), ids = new Set(residents.map((person) => person.id)), record = { week: this.week, familyId: family.id, surname: family.surname, names: residents.map((person) => person.name), arrivedWeek: family.arrivedWeek, reason: "não conseguiu consolidar emprego e moradia permanente" };
    record.profiles = residents.map((person) => ({ id: person.id, name: person.name, age: person.age, gender: person.gender, role: person.role, priorHomeId: person.homeId, residentStatus: "emigrated", emigratedWeek: this.week, history: structuredClone(person.history || []) }));
    record.household = { tenure: family.tenure, wealth: family.wealth, priorHomeId: family.homeId };
    this.businesses.forEach((business) => { business.employees = business.employees.filter((id) => !ids.has(id)); });
    this.housingSystem.hotelGuests = this.housingSystem.hotelGuests.filter((id) => !ids.has(id));
    this.relationships = this.relationships.filter((relationship) => !ids.has(relationship.a) && !ids.has(relationship.b));
    this.healthSystem.waiting = this.healthSystem.waiting.filter((entry) => !ids.has(typeof entry === "string" ? entry : entry?.personId));
    this.healthSystem.admitted = this.healthSystem.admitted.filter((entry) => !ids.has(typeof entry === "string" ? entry : entry?.personId));
    this.healthSystem.triageQueue = this.healthSystem.triageQueue.filter((entry) => !ids.has(typeof entry === "string" ? entry : entry?.personId));
    this.justiceSystem.prisoners = this.justiceSystem.prisoners.filter((id) => !ids.has(id));
    this.justiceSystem.prisonWings.forEach((wing) => { wing.inmates = wing.inmates.filter((id) => !ids.has(id)); });
    this.events.active.forEach((event) => { event.participants = (event.participants || []).filter((id) => !ids.has(id)); });
    this.familyEvents.forEach((event) => {
      ["participants", "participantIds", "invitedIds", "attendedIds"].forEach((key) => { if (Array.isArray(event[key])) event[key] = event[key].filter((id) => !ids.has(id)); });
    });
    this.vehicles.filter((vehicle) => ids.has(vehicle.ownerId)).forEach((vehicle) => { vehicle.ownerId = null; vehicle.status = "inventory"; });
    this.people = this.people.filter((person) => !ids.has(person.id));
    this.families = this.families.filter((candidate) => candidate.id !== family.id);
    this.housingSystem.departures++;
    this.rebuildRelationshipIndex();
    this.rebuildKinship({ seedLinks: false });
    this.syncHousingOccupancy();
    this.log("migração", `A família ${family.surname} deixou Vila Esperança após ${this.week - family.arrivedWeek} semanas sem conseguir se estabelecer.`, "civic", { cause: record.reason, consequences: ["vaga liberada na hospedagem temporária", "demanda de emprego revisada"], priority: "normal" });
    return record;
  }
  weeklyCityDevelopment() {
    const before = this.cityDevelopmentSnapshot(), planned = planCityDevelopment(this.cityDevelopment, before, { week: this.week }), outcome = { arrivals: 0, departures: 0, departureRecords: [], housingStarted: false, expansionStarted: false, commercialStarted: false, civicStarted: false, rezoned: false };
    this.cityDevelopment = planned.state;
    for (let index = 0; index < planned.plan.departures; index++) { const departure = this.emigrateRecentHousehold(); if (departure) { outcome.departures++; outcome.departureRecords.push(departure); } }
    for (let index = 0; index < planned.plan.arrivals; index++) if (this.immigrate()) outcome.arrivals++;
    if (planned.plan.startHousing) { const count = this.housingSystem.construction.length; this.startConstruction(); outcome.housingStarted = this.housingSystem.construction.length > count; }
    if (planned.plan.startExpansion) outcome.expansionStarted = this.expandCityGrid();
    if (planned.plan.startCommercial) { const count = this.urbanEvolution.projects.length; this.startUrbanProject("commercial"); outcome.commercialStarted = this.urbanEvolution.projects.length > count; }
    const civicKind = [["health", before.services.healthOccupied / Math.max(1, before.services.healthCapacity)], ["education", before.services.educationOccupied / Math.max(1, before.services.educationCapacity)], ["safety", before.services.crimeRate / 5], ["community", Math.max(0, 70 - before.services.civic) / 35]].sort((a, b) => b[1] - a[1])[0][0];
    if (planned.plan.startCivic) { const count = this.urbanEvolution.projects.length; this.startUrbanProject("civic", { serviceKind: civicKind }); outcome.civicStarted = this.urbanEvolution.projects.length > count; }
    if (planned.plan.rezone) outcome.rezoned = this.rezoneForDevelopment(planned.plan.rezone);
    this.synchronizeWorldState();
    const after = this.cityDevelopmentSnapshot(), committed = commitCityDevelopment(this.cityDevelopment, after, outcome, { week: this.week });
    this.cityDevelopment = committed.state;
    if (outcome.departureRecords.length) this.cityDevelopment.formerResidents.unshift(...outcome.departureRecords);
    this.cityDevelopment.formerResidents = this.cityDevelopment.formerResidents.slice(0, 80);
    this.cityDevelopmentSummary = this.buildCityDevelopmentSummary(after);
    committed.events.forEach((event) => this.log("desenvolvimento", event.text, "civic", { cause: "crescimento acumulado de população, serviços e infraestrutura", consequences: ["novo estágio registrado no plano diretor"], priority: "destaque" }));
    return { plan: planned.plan, outcome, summary: this.cityDevelopmentSummary };
  }
  createGovernanceSystem() {
    this.governance = {
      policies: structuredClone(defaultPolicies),
      budget: structuredClone(defaultBudget),
      approval: 62,
      weeklyRevenue: 0,
      weeklySpending: 0,
      extraordinarySpending: 0,
      totalTaxRevenue: 0,
      history: [],
    };
  }
  createPoliticsSystem(){this.politics=createPoliticsForSimulation(this,{seed:"vila-esperanca-2026",termWeeks:208,campaignWeeks:12,councilSeats:9});this.governance.politics=this.politics.state;this.syncPoliticalOffices();}
  createLocalGovernmentSystem() {
    this.localGovernment = createLocalGovernmentForSimulation(this, {
      seed: "prefeitura-vila-esperanca",
      councilSeats: 9,
      autoProposals: true,
    });
    const context = localGovernmentContextFromSimulation(this);
    this.city.streets
      .filter((street) => street.surface !== "asfalto")
      .slice(0, 2)
      .forEach((street, index) => {
        const authorized = authorizeMunicipalPublicWork(this.localGovernment, {
          type: "paving",
          name: `Pavimentação completa da ${street.name}`,
          address: street.name,
          budget: 52000 + index * 9000,
          expectedWeeks: 6 + index * 2,
          lengthKm: street.kind === "avenue" ? 1.8 : 1.2,
          workersRequired: 6 + index * 2,
          cause: "via de cascalho com demanda crescente de moradores, ônibus e serviços",
        }, context);
        this.localGovernment = authorized.state;
        const work = this.localGovernment.publicWorks.find((item) => item.id === authorized.work.id);
        if (work) work.streetId = street.id;
        authorized.newsFacts.forEach((fact) => this.publishMunicipalNews(fact));
      });
    this.syncLocalGovernmentAssignments(this.localGovernment.workforce.assignments);
    this.localGovernmentSummary = getLocalGovernmentSummary(this.localGovernment, context);
    this.governance.localGovernment = this.localGovernment;
    this.syncMunicipalPublicWorks();
  }
  syncLocalGovernmentAssignments(assignments = []) {
    const eligibleAssignments = assignments.filter((assignment) => {
      const person = this.people.find((candidate) => candidate.id === assignment.personId);
      const preservesEssentialService = person?.contract === "Serviço público" && assignment.contract !== "Mandato eletivo";
      return person?.alive && !this.isPlayerControlled(person) && !preservesEssentialService && !person.lifeCourse?.retirement?.active && !/aposentad/i.test(person.role || "");
    });
    const nextPeople = applyLocalGovernmentAssignmentsToPeople(this.people, eligibleAssignments);
    nextPeople.forEach((next) => {
      const person = this.people.find((candidate) => candidate.id === next.id);
      if (!person) return;
      const previousBusiness = this.businessOf(person);
      if (previousBusiness && next.businessId !== person.businessId)
        previousBusiness.employees = previousBusiness.employees.filter((id) => id !== person.id);
      ["role", "workplace", "businessId", "contract", "hourlyWage", "shift", "localGovernmentAssignment", "municipalOffice", "politicalOffice", "preLocalGovernmentEmployment"].forEach((key) => {
        person[key] = next[key] == null ? next[key] : typeof next[key] === "object" ? structuredClone(next[key]) : next[key];
      });
      const restoredBusiness = this.businesses.find((business) => business.id === person.businessId);
      if (restoredBusiness && !restoredBusiness.employees.includes(person.id)) restoredBusiness.employees.push(person.id);
      if (person.lifeCourse?.retirement?.active) {
        const business = this.businessOf(person);
        if (business) business.employees = business.employees.filter((id) => id !== person.id);
        person.role = "Aposentado(a)";
        person.workplace = "—";
        person.businessId = null;
        person.contract = "Aposentadoria";
        person.hourlyWage = 0;
        person.shift = null;
        person.localGovernmentAssignment = null;
        person.municipalOffice = null;
      }
      person.routine = buildRoutine(person);
    });
  }
  applyMunicipalEffects(effects = []) {
    this.cityModifiers ||= {};
    effects.forEach((effect) => {
      const delta = Number(effect.delta || 0);
      if (effect.domain === "treasury" && effect.target === "municipalTreasury") {
        this.money += delta;
        if (delta < 0) this.governance.extraordinarySpending += Math.abs(delta);
        return;
      }
      if (effect.domain === "budget" && effect.target in this.governance.budget) {
        this.governance.budget = normalizeBudget({ ...this.governance.budget, [effect.target]: this.governance.budget[effect.target] + delta }, effect.target);
        return;
      }
      if (effect.domain === "security" && effect.target === "patrolCapacity") {
        this.justiceSystem.patrols = Math.max(1, this.justiceSystem.patrols + delta);
        return;
      }
      if (effect.domain === "transport" && effect.target === "punctuality") {
        this.transportSystem.routes.forEach((route) => route.punctuality = clamp((route.punctuality || 70) + delta, 0, 100));
        return;
      }
      if (effect.domain === "transport" && effect.target === "routeCapacity") {
        this.transportSystem.routes.forEach((route) => route.capacity = Math.max(1, (route.capacity || 30) + delta));
        return;
      }
      const targetSystem = effect.domain === "housing" ? this.housingSystem : effect.domain === "transport" ? this.transportSystem : effect.domain === "health" ? this.healthSystem : effect.domain === "education" ? this.educationSystem : effect.domain === "environment" ? this.environment : null;
      if (targetSystem && typeof targetSystem[effect.target] === "number") targetSystem[effect.target] += delta;
      else {
        this.cityModifiers[effect.domain] ||= {};
        const current = Number(this.cityModifiers[effect.domain][effect.target] || 0);
        this.cityModifiers[effect.domain][effect.target] = effect.operation === "set" ? Number(effect.value ?? delta) : current + delta;
      }
    });
  }
  publishMunicipalNews(fact) {
    if (!fact?.newsworthy) return;
    const kind = fact.workId ? "obras" : fact.section === "Política" ? "política" : "prefeitura";
    this.log(kind, `${fact.headline}. ${fact.lead}`, fact.tone || "civic", {
      section: fact.section === "Administração" ? "Política" : fact.section,
      peopleIds: fact.peopleIds,
      placeIds: fact.placeIds,
      cause: fact.cause,
      consequences: fact.consequences,
      dedupeKey: fact.id,
      priority: fact.priority === "destaque" ? "destaque" : "normal",
    });
  }
  syncMunicipalPublicWorks() {
    (this.localGovernment?.publicWorks || []).forEach((work) => {
      const street = this.city.streets.find((candidate) => candidate.id === work.streetId);
      if (!street) return;
      street.constructionStatus = work.status === "completed" ? "complete" : work.status === "executing" ? "under_construction" : work.stage;
      street.workId = work.id;
      street.workProgress = work.progress;
      if (work.status === "executing") {
        street.condition = clamp(52 + work.progress * .24, 0, 100);
        if (work.progress >= 75) street.sidewalk = true;
      }
      if (work.status === "completed" && street.surface !== "asfalto") {
        street.surface = "asfalto";
        street.condition = 96;
        street.sidewalk = true;
        street.lighting = "completa";
        street.drainage = 92;
        street.pavementHistory ||= [];
        street.pavementHistory.unshift({ week: this.week, workId: work.id, investment: work.spent });
        this.buildings.filter((building) => building.address?.streetId === street.id).forEach((building) => building.address.accessSurface = "asfalto");
      }
    });
  }
  weeklyLocalGovernment() {
    const simulationView = this.autonomousPopulationView(), result = advanceLocalGovernmentForSimulation(this.localGovernment, simulationView);
    this.localGovernment = result.state;
    this.syncLocalGovernmentAssignments(result.assignments);
    this.maintainWorkforce();
    const drained = drainLocalGovernmentEffects(this.localGovernment, localGovernmentContextFromSimulation(simulationView));
    this.localGovernment = drained.state;
    this.applyMunicipalEffects(drained.effects);
    result.newsFacts.forEach((fact) => this.publishMunicipalNews(fact));
    this.syncMunicipalPublicWorks();
    this.localGovernmentSummary = getLocalGovernmentSummary(this.localGovernment, localGovernmentContextFromSimulation(simulationView));
    this.governance.localGovernment = this.localGovernment;
  }
  syncPoliticalOffices() {
    const state = this.politics.state, targets = new Map();
    if (state.officeHolders.mayor?.personId) targets.set(state.officeHolders.mayor.personId, "Prefeito(a)");
    if (state.officeHolders.deputyMayor?.personId) targets.set(state.officeHolders.deputyMayor.personId, "Vice-prefeito(a)");
    state.council.members.forEach((member) => { if (member.personId) targets.set(member.personId, "Vereador(a)"); });
    this.people.filter((person) => person.politicalOffice && !targets.has(person.id)).forEach((person) => {
      person.role = person.prePoliticalOffice?.role || "Desempregado";
      person.workplace = person.prePoliticalOffice?.workplace || "—";
      person.businessId = person.prePoliticalOffice?.businessId || null;
      person.shift = person.prePoliticalOffice?.shift || null;
      person.hourlyWage = Number(person.prePoliticalOffice?.hourlyWage || 0);
      person.contract = person.prePoliticalOffice?.contract || (person.shift ? "CLT" : null);
      person.politicalOffice = null;
      person.prePoliticalOffice = null;
      person.routine = buildRoutine(person);
    });
    targets.forEach((office, id) => {
      const person = this.people.find((candidate) => candidate.id === id);
      if (!person) return;
      if (!person.politicalOffice) person.prePoliticalOffice = { role: person.role, workplace: person.workplace, businessId: person.businessId, shift: person.shift, hourlyWage: Number(person.hourlyWage || 0), contract: person.contract };
      const oldBusiness = this.businessOf(person);
      if (oldBusiness) oldBusiness.employees = oldBusiness.employees.filter((employeeId) => employeeId !== person.id);
      person.politicalOffice = office;
      person.role = office;
      person.workplace = "Prefeitura";
      person.businessId = null;
      person.contract = "Mandato eletivo";
      person.hourlyWage = office === "Prefeito(a)" ? 72 : office === "Vice-prefeito(a)" ? 58 : 39;
      person.shift = { name: "Mandato público", start: 8, end: 17, days: [0, 1, 2, 3, 4], hours: 40 };
      person.routine = buildRoutine(person);
    });
  }
  weeklyPolitics(){const events=advancePoliticsForSimulation(this.politics,this.autonomousPopulationView());this.syncPoliticalOffices();return events;}
  setPolicy(name, value) {
    if (name in this.governance.policies) {
      this.governance.policies[name] = Number(value);
      if (name === "transitFare")
        this.transportSystem.routes.forEach((r) => (r.fare = Number(value)));
    } else if (name in this.governance.budget)
      this.governance.budget = normalizeBudget(
        { ...this.governance.budget, [name]: Number(value) },
        name,
      );
    this.governance.history.unshift({
      week: this.week,
        text: `Política municipal alterada: ${name} para ${value}.`,
    });
  }
  weeklyGovernance(payroll) {
    const g = this.governance,
      incomeTaxRate = g.policies.incomeTax / 100;
    let playerTaxableIncome = 0;
    this.people
      .filter((p) => p.alive && p.shift && !p.justice.incarcerated)
      .forEach((p) => {
        const taxableIncome = this.isPlayerControlled(p)
          ? Number(p.hourlyWage || 0) * Math.max(0, Number(p.playerControl?.workMinutesThisWeek || 0)) / 60
          : Number(p.hourlyWage || 0) * Number(p.shift.hours || 0);
        p.money -= taxableIncome * incomeTaxRate;
        if (this.isPlayerControlled(p)) playerTaxableIncome += taxableIncome;
      });
    const incomeRevenue = (payroll + playerTaxableIncome) * incomeTaxRate;
    let businessRevenue = 0,
      propertyRevenue = 0;
    this.businesses.forEach((b) => {
      const taxable = Math.max(0, b.revenue - (b.lastTaxedRevenue || 0)),
        tax = taxable * (g.policies.businessTax / 100);
      b.cash -= tax;
      businessRevenue += tax;
      b.lastTaxedRevenue = b.revenue;
    });
    this.buildings
      .filter((b) => b.type === "home" && b.ownerId)
      .forEach((b) => {
        const tax = (b.value * (g.policies.propertyTax / 100)) / 52,
          owner = this.people.find((p) => p.id === b.ownerId);
        if (owner?.alive) owner.money -= tax;
        propertyRevenue += tax;
      });
    const revenue = incomeRevenue + businessRevenue + propertyRevenue,
      operatingBudget = 12000,
      extraordinarySpending = Number(g.extraordinarySpending || 0),
      spending = operatingBudget + extraordinarySpending;
    this.money += revenue - operatingBudget;
    g.weeklyRevenue = revenue;
    g.weeklySpending = spending;
    g.extraordinarySpending = 0;
    g.totalTaxRevenue += revenue;
    this.healthSystem.beds = 20 + Math.round(g.budget.health * 0.7);
    this.educationSystem.quality = 45 + g.budget.education * 1.8;
    this.justiceSystem.patrols = Math.max(2, Math.round(g.budget.security / 4));
    const infraFactor = 0.72 + g.budget.infrastructure / 85;
    Object.entries(this.infrastructure.systems).forEach(
      ([type, system]) =>
        (system.capacity = Math.round(
          utilityTypes[type].baseCapacity * infraFactor,
        )),
    );
    const taxPressure =
      g.policies.incomeTax + g.policies.businessTax * 0.45;
    const serviceScore =
      (g.budget.health +
        g.budget.education +
        g.budget.security +
        g.budget.transport +
        g.budget.infrastructure) /
      5;
    g.approval = clamp(
      Math.round(
        this.people
          .filter((p) => p.alive)
          .reduce((s, p) => s + p.happiness, 0) /
          Math.max(1, this.people.filter((p) => p.alive).length) +
          serviceScore * 0.35 -
          taxPressure * 0.7,
      ),
      0,
      100,
    );
    g.history.unshift({
      week: this.week,
      text: `Receita de R$ ${Math.round(revenue).toLocaleString("pt-BR")} e despesas de R$ ${spending.toLocaleString("pt-BR")}.`,
    });
    g.history = g.history.slice(0, 30);
  }
  createEnvironmentSystem() {
    const climate = createClimateState({ week: this.week, season: this.events.season });
    this.environment = {
      ...climate,
      districts: {},
      cityAirQuality: 82,
      emissions: 0,
      greenIndex: 0,
      weatherHistory: [],
    };
    this.weather = climate.current.name;
    this.temperature = climate.current.temperature;
    this.climateSummary = summarizeClimate(this.environment);
    this.updateEnvironmentalMetrics();
  }
  updateEnvironmentalMetrics() {
    let totalAir = 0,
      totalGreen = 0;
    this.city.districts.forEach((district) => {
      const buildings = this.buildings.filter(
          (b) => b.districtId === district.id,
        ),
        parks = buildings.filter((b) => b.type === "park").length,
        commerce = buildings.filter((b) => b.type === "shop").length,
        residents = this.people.filter((p) => {
          const home = this.buildings.find((b) => b.id === p.homeId);
          return p.alive && home?.districtId === district.id;
        }).length,
        cars = this.people.filter((p) => {
          const home = this.buildings.find((b) => b.id === p.homeId);
          return (
            p.currentTrip?.mode === "carro" && home?.districtId === district.id
          );
        }).length,
        green = clamp(28 + parks * 24 - commerce * 2, 5, 100),
        pollution = clamp(16 + cars * 2.8 + commerce * 5 - parks * 12, 4, 92),
        airQuality = clamp(Math.round(100 - pollution), 8, 100),
        noise = clamp(22 + cars * 4 + commerce * 7 + residents * 0.35, 10, 100);
      this.environment.districts[district.id] = {
        airQuality,
        noise: Math.round(noise),
        green: Math.round(green),
        residents,
      };
      totalAir += airQuality;
      totalGreen += green;
    });
    this.environment.cityAirQuality = Math.round(
      totalAir / this.city.districts.length,
    );
    this.environment.greenIndex = Math.round(
      totalGreen / this.city.districts.length,
    );
    this.environment.emissions = Math.round(
      this.transportSystem.traffic * 2.4 +
        this.businesses.filter((b) => this.isOpen(b)).length * 3.2,
    );
  }
  dailyEnvironment() {
    const previous = this.environment.current;
    const districts = this.environment.districts;
    const metrics = {
      cityAirQuality: this.environment.cityAirQuality,
      emissions: this.environment.emissions,
      greenIndex: this.environment.greenIndex,
      weatherHistory: this.environment.weatherHistory || this.environment.history || [],
    };
    const result = advanceClimateDay(this.environment, {
      week: this.week,
      day: this.day,
      season: this.events.season,
    });
    this.environment = { ...result.state, ...metrics, districts };
    this.weather = this.environment.current.name;
    this.temperature = this.environment.current.temperature;
    this.environment.weatherHistory = this.environment.history.slice(0, 60);
    this.climateSummary = summarizeClimate(this.environment);
    this.updateEnvironmentalMetrics();
    this.people.filter((p) => p.alive).forEach((p) => {
      const home = this.buildings.find((b) => b.id === p.homeId),
        quality = this.environment.districts[home?.districtId]?.airQuality || 80;
      if (quality < 50) p.health = Math.max(0, p.health - 0.12);
      if (this.environment.current.heat) p.energy = Math.max(0, p.energy - 3);
      if (this.environment.current.cold && Math.random() < 0.008)
        this.addCondition(p, "flu", false);
    });
    const newlySuspendedEvents = [];
    this.events.active.forEach((event) => {
      const suspended = this.environment.current.storm || this.environment.current.snow || this.environment.current.hail;
      if (suspended && !event.suspended) newlySuspendedEvents.push(event);
      event.suspended = suspended;
    });
    if (newlySuspendedEvents.length) {
      const names = newlySuspendedEvents.slice(0, 4).map((event) => event.name);
      const text = newlySuspendedEvents.length === 1
        ? `${names[0]} foi suspenso temporariamente pela tempestade.`
        : `${newlySuspendedEvents.length} eventos foram suspensos pela tempestade, incluindo ${names.join(", ")}${newlySuspendedEvents.length > names.length ? " e outras programações" : ""}.`;
      this.log("clima", text, "civic", {
        cause: `alerta de ${this.environment.current.name.toLowerCase()}`,
        consequences: ["programações coletivas suspensas", "participantes avisados", "deslocamentos evitados"],
        facts: newlySuspendedEvents.map((event) => event.name),
        dedupeKey: `eventos-clima-${this.week}-${this.day}`,
        priority: "destaque",
      });
    }
    if (this.environment.current.storm && Math.random() < 0.22) {
      const type = Math.random() < 0.65 ? "power" : "water";
      if (this.infrastructure.systems[type].active)
        this.startOutage(type, "danos causados pela tempestade");
    }
    result.events.forEach((event) => this.log(
      "clima",
      event.text,
      event.severity >= 4 ? "civic" : "neutral",
      {
        cause: this.environment.current.name,
        consequences: ["mobilidade", "saúde", "infraestrutura urbana"],
        priority: event.severity >= 4 ? "alta" : "normal",
      },
    ));
    if (previous.name !== this.environment.current.name)
      this.log(
        "clima",
        `Previsão para hoje: ${this.environment.current.name}, ${this.temperature}°C (sensação de ${this.environment.current.apparentTemperature}°C).`,
        "neutral",
      );
  }
  createLifeStageSystem() {
    this.retirementSystem={retired:0,pensionsPaid:0,weeklyCost:0,transitions:[],history:[],minimumAge:65,minimumPension:1420};
    this.people.forEach((person)=>{
      person.lifeCourse=person.lifeCourse||initializeLifeCourse(person,this.week);
      person.lifeStage=lifeStageForAge(person.age).id;
      if(person.lifeCourse.retirement.active){this.retirementSystem.retired++;person.role="Aposentado(a)";person.workplace="—";person.shift=null;person.businessId=null;}
    });
    this.lifeStageSystem={summary:lifeStageSummary(this.people),dailyCareAlerts:0,lastWeek:this.week};
  }
  retirePerson(person,decision,{initial=false}={}) {
    if(!person?.alive||person.lifeCourse?.retirement?.active||person.politicalOffice)return false;
    const employer=this.businessOf(person);if(employer)employer.employees=employer.employees.filter(id=>id!==person.id);
    person.lifeCourse ||= initializeLifeCourse(person,this.week);
    person.lifeCourse.retirement={active:true,retiredWeek:this.week,monthlyPension:decision.monthlyPension||this.retirementSystem.minimumPension,formerRole:person.role,formerWorkplace:person.workplace};
    person.role="Aposentado(a)";person.workplace="—";person.businessId=null;person.shift=null;person.contract="Aposentadoria";person.hourlyWage=0;person.routine=buildRoutine(person);
    person.history.push({week:this.week,text:`Aposentou-se${decision.reason==="age_health_and_choice"?" após avaliar saúde, idade e trajetória profissional":""}.`});
    this.retirementSystem.retired++;this.retirementSystem.history.unshift({week:this.week,personId:person.id,text:`${person.name} iniciou a aposentadoria com benefício mensal de R$ ${Math.round(person.lifeCourse.retirement.monthlyPension).toLocaleString("pt-BR")}.`});this.retirementSystem.history=this.retirementSystem.history.slice(0,80);
    if(!initial)this.log("aposentadoria",`${person.name} encerrou a vida profissional e iniciou a aposentadoria.`,"social",{peopleIds:[person.id],cause:"idade, contribuição e decisão pessoal",consequences:["nova rotina","benefício previdenciário","vaga no mercado de trabalho"],priority:"normal"});
    return true;
  }
  weeklyLifeStages() {
    let weeklyCost=0;
    this.people.filter(person=>person.alive).forEach(person=>{
      const result=advanceLifeCourseWeek(person,{week:this.week,minimumAge:this.retirementSystem.minimumAge,minimumPension:this.retirementSystem.minimumPension});
      person.lifeCourse=result.course;person.lifeStage=result.stage.id;
      if(result.transition){this.retirementSystem.transitions.push({personId:person.id,...result.transition});person.history.push({week:this.week,text:`Entrou na fase de vida: ${result.stage.name}.`});}
      if(result.retirement?.retire&&!this.isPlayerControlled(person))this.retirePerson(person,result.retirement);
      if(person.lifeCourse.retirement.active){const weekly=Math.round((person.lifeCourse.retirement.monthlyPension||this.retirementSystem.minimumPension)/4.33);person.money+=weekly;weeklyCost+=weekly;}
    });
    this.money-=weeklyCost;this.retirementSystem.weeklyCost=weeklyCost;this.retirementSystem.pensionsPaid+=weeklyCost;this.retirementSystem.retired=this.people.filter(person=>person.alive&&person.lifeCourse?.retirement?.active).length;this.lifeStageSystem.summary=lifeStageSummary(this.people);this.lifeStageSystem.lastWeek=this.week;
  }
  dailyLifeStages() {
    let careAlerts=0;const weather=this.environment?.current||{};
    this.people.filter(person=>person.alive).forEach(person=>{person.lifeCourse ||= initializeLifeCourse(person,this.week);const effects=ageDailyEffects(person,weather);person.health=clamp(person.health+effects.healthDelta,0,100);person.energy=clamp(person.energy+effects.energyDelta,0,100);person.needs.social=clamp(person.needs.social+effects.socialDelta,0,100);person.lifeCourse.careNeed=clamp((person.lifeCourse.careNeed||0)+effects.careNeedDelta,0,100);person.ageMobilityFactor=effects.mobilityFactor;person.ageActivities=effects.preferredActivities;if(person.lifeCourse.careNeed>=60)careAlerts++;});
    this.lifeStageSystem.dailyCareAlerts=careAlerts;
  }
  createLaborMarketSystem() {
    this.laborMarket=createLaborMarketState({week:this.week,policy:{retirementAge:this.retirementSystem.minimumAge}});
    this.laborMarketSummary=summarizeLaborMarket(this.laborMarket);
  }
  weeklyLaborMarket() {
    if(!this.laborMarket)this.createLaborMarketSystem();
    this.laborMarket.publicWorks.filter(job=>job.status==="active"&&job.untilWeek<this.week).forEach(job=>{const person=this.people.find(candidate=>candidate.id===job.personId);if(person?.alive&&person.contract==="Programa municipal temporário"){person.role="Desempregado";person.workplace="—";person.shift=null;person.contract=null;person.history.push({week:this.week,text:"Concluiu contrato temporário de obras e zeladoria."});}});
    if(this.week%4===0)this.businesses.filter(business=>!business.closed&&business.cash>45000&&business.visits>(business.minimumStaff||1)*18&&business.minimumStaff<Math.max(3,(business.requiredRoles?.length||2)+2)).slice(0,3).forEach(business=>{business.minimumStaff++;business.management?.decisions?.unshift?.({week:this.week,text:"Quadro ampliado após crescimento da demanda."});});
    const result=runLaborMarketWeek(this.laborMarket,{week:this.week,people:this.people.filter(person=>!this.isPlayerControlled(person)),businesses:this.businesses},{policy:{...this.laborMarket.policy,retirementAge:this.retirementSystem.minimumAge}});this.laborMarket=result.state;
    result.actions.benefits.forEach(item=>{const person=this.people.find(candidate=>candidate.id===item.personId);if(person){person.money+=item.amount;person.employmentSupport={type:"seguro-desemprego",weekly:item.amount,sinceWeek:this.week};this.money-=item.amount;}});
    result.actions.trainingStarts.forEach(item=>{const person=this.people.find(candidate=>candidate.id===item.personId);if(person){person.jobTraining={...item};person.education.performance=clamp(person.education.performance+3,0,100);person.history.push({week:this.week,text:`Ingressou em ${item.program}.`});}});
    result.actions.matches.forEach(match=>{const person=this.people.find(candidate=>candidate.id===match.personId),business=this.businesses.find(candidate=>candidate.id===match.businessId);if(person&&business&&!person.shift)this.assignWorkerToBusiness(person,business,match.role);});
    result.actions.publicWorksStarts.forEach(job=>{const person=this.people.find(candidate=>candidate.id===job.personId);if(!person||person.shift)return;person.role=job.role;person.workplace="Prefeitura";person.contract="Programa municipal temporário";person.hourlyWage=Math.round(job.weeklyPay/30);person.shift={name:"Frente municipal de trabalho",start:7,end:15,days:[0,1,2,3,4],hours:30};person.history.push({week:this.week,text:"Foi contratado temporariamente para obras e zeladoria urbana."});});
    const hires=result.actions.matches.length,rate=result.analysis.unemploymentRate;if(hires||result.actions.publicWorksStarts.length)this.log("emprego",`${hires} contratação(ões) privada(s) e ${result.actions.publicWorksStarts.length} vaga(s) de trabalho municipal foram encaminhadas; desemprego em ${rate.toFixed(1)}%.`,"money",{cause:"oferta de vagas e programas municipais",consequences:["renda familiar","capacidade dos estabelecimentos","taxa de desemprego"],priority:"normal"});
    this.laborMarketSummary=summarizeLaborMarket(this.laborMarket);
  }
  createRoutines() {
    this.people.forEach((p) => {
      p.routine = buildRoutine(p);
      p.locationId = p.homeId;
      p.path = [];
      p.scheduleKey = null;
    });
  }
  createFamilies() {
    const homes = this.buildings.filter((b) => b.type === "home");
    homes.forEach((home, index) => {
      const members = this.people
        .filter((p) => p.homeId === home.id)
        .sort((a, b) => b.age - a.age);
      const surname = members[0]?.family || lastNames[index];
      const adults = members.filter((p) => p.age >= 18),
        children = members.filter((p) => p.age < 18),
        partnerCandidates = adults
          .filter((p) => p.age >= 22 && p.age <= 48)
          .sort((a, b) => Math.abs(a.age - 34) - Math.abs(b.age - 34));
      let partnerPair = [];
      for (let aIndex = 0; aIndex < partnerCandidates.length && !partnerPair.length; aIndex++) {
        for (let bIndex = aIndex + 1; bIndex < partnerCandidates.length; bIndex++) {
          const a = partnerCandidates[aIndex], b = partnerCandidates[bIndex];
          if (Math.abs(a.age - b.age) <= 16 && this.orientationCompatible(a, b)) { partnerPair = [a, b]; break; }
        }
      }
      const parents = partnerPair.length ? partnerPair : adults.slice(0, 2);
      if (partnerPair.length > 1) {
        partnerPair[0].partnerId = partnerPair[1].id;
        partnerPair[1].partnerId = partnerPair[0].id;
      }
      children.forEach((child) => {
        const childParents = [...parents, ...adults].filter((adult, position, all) => adult.age - child.age >= 16 && all.findIndex((candidate) => candidate.id === adult.id) === position).slice(0, 2);
        child.parents = childParents.map((p) => p.id);
        child.parents.forEach((id) =>
          this.people.find((p) => p.id === id).children.push(child.id),
        );
        if (childParents.length > 1) {
          child.genetics = inheritGenetics(
            childParents[0].genetics,
            childParents[1].genetics,
          );
          child.traits = inheritTraits(childParents[0].traits, childParents[1].traits);
        }
      });
      const owner = adults[0] || members[0],
        tenure =
          index % 3 === 0 ? "rent" : index % 5 === 0 ? "mortgage" : "owned";
      home.ownerId =
        tenure === "rent"
          ? this.people[(index * 7 + 20) % this.people.length].id
          : owner.id;
      home.tenure = tenure;
      home.rent = 850 + index * 65;
      const family = {
        id: uid("f"),
        kind: "household",
        surname,
        homeId: home.id,
        memberIds: members.map((p) => p.id),
        foundedYear: 1982 + index * 3,
        wealth: members.reduce((s, p) => s + p.money, 0),
        tenure,
        origin: pick(familyOrigins),
        reputation: 45 + Math.floor(Math.random() * 45),
        milestones: [],
      };
      members.forEach((p) => {
        p.familyId = family.id;
        p.householdId = family.id;
        p.housing = tenure;
        p.history.push({
          week: 1,
          text: `Começou a simulação morando em ${home.name}.`,
        });
      });
      this.families.push(family);
    });
  }
  seedExtendedFamilies(){
    const memberPeople=f=>f.memberIds.map(id=>this.people.find(p=>p.id===id)).filter(Boolean),anchorFamilies=this.families.map(f=>({family:f,elders:memberPeople(f).filter(p=>p.age>=52).sort((a,b)=>b.age-a.age)})).filter(x=>x.elders.length).sort((a,b)=>b.elders[0].age-a.elders[0].age).slice(0,9),anchorIds=new Set(anchorFamilies.map(x=>x.family.id)),targets=this.families.filter(f=>!anchorIds.has(f.id)).map(f=>({family:f,adult:memberPeople(f).filter(p=>p.age>=20&&p.age<=46&&!p.parents.length).sort((a,b)=>b.children.length-a.children.length||a.age-b.age)[0]})).filter(x=>x.adult),used=new Set();
    anchorFamilies.forEach((anchor,index)=>{const descendants=targets.filter(x=>!used.has(x.family.id)&&anchor.elders[0].age-x.adult.age>=18).slice(index%2,2+index%2);descendants.forEach(({family,adult})=>{used.add(family.id);const parents=anchor.elders.filter(e=>e.age-adult.age>=18).slice(0,2);adult.parents=parents.map(p=>p.id);parents.forEach(parent=>{if(!parent.children.includes(adult.id))parent.children.push(adult.id);});adult.lineageOrigin=anchor.family.id;adult.history.unshift({week:1,text:`Mantém raízes familiares com o núcleo ${anchor.family.surname}, embora viva em outro domicílio.`});anchor.family.milestones.push({week:1,text:`Parte dos descendentes formou domicílios próprios na cidade.`});});});
  }
  familyOf(person) {
    return this.families.find((f) => f.id === (person?.householdId || person?.familyId));
  }
  livingHouseholdMembers(family) {
    return (family?.memberIds || [])
      .map((id) => this.people.find((p) => p.id === id))
      .filter((person) => person?.alive);
  }
  createHousehold(data = {}) {
    const household = {
      id: data.id || uid("f"),
      kind: "household",
      surname: data.surname || "Novo domicílio",
      homeId: data.homeId || null,
      memberIds: [...new Set(data.memberIds || [])],
      foundedYear: data.foundedYear || 2026 + Math.floor(this.week / 52),
      wealth: Number.isFinite(data.wealth) ? data.wealth : 0,
      tenure: data.tenure || "temporary",
      origin: data.origin || "Vila Esperança",
      reputation: Number.isFinite(data.reputation) ? data.reputation : 50,
      creditScore: Number.isFinite(data.creditScore) ? data.creditScore : 620,
      arrears: Number.isFinite(data.arrears) ? data.arrears : 0,
      housingCost: Number.isFinite(data.housingCost) ? data.housingCost : 0,
      milestones: data.milestones || [],
    };
    this.families.push(household);
    household.memberIds.forEach((id) => {
      const person = this.people.find((p) => p.id === id);
      if (!person) return;
      person.familyId = household.id;
      person.householdId = household.id;
    });
    return household;
  }
  normalizeHouseholds() {
    this.families.forEach((household) => {
      household.kind = "household";
      household.memberIds = [...new Set(household.memberIds || [])].filter((id) => {
        const person = this.people.find((p) => p.id === id);
        return person?.alive;
      });
      household.wealth = Number.isFinite(household.wealth) ? household.wealth : 0;
      household.creditScore = Number.isFinite(household.creditScore) ? household.creditScore : 620;
      household.arrears = Number.isFinite(household.arrears) ? household.arrears : 0;
      household.housingCost = Number.isFinite(household.housingCost) ? household.housingCost : 0;
      household.milestones ||= [];
      const members = this.livingHouseholdMembers(household);
      const homes = members.reduce((counts, person) => {
        counts[person.homeId] = (counts[person.homeId] || 0) + 1;
        return counts;
      }, {});
      const primaryHome = Object.entries(homes).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (primaryHome) household.homeId = primaryHome;
      members.forEach((person) => {
        person.familyId = household.id;
        person.householdId = household.id;
        if (household.homeId && person.homeId !== household.homeId) person.homeId = household.homeId;
      });
    });
    this.people.filter((person) => person.alive && !this.familyOf(person)).forEach((person) => {
      this.createHousehold({ surname: person.family, homeId: person.homeId, memberIds: [person.id], wealth: person.money, tenure: person.housing });
    });
    this.syncHousingOccupancy();
  }
  syncHousingOccupancy() {
    const hotelId = this.housingSystem?.hotelId || this.buildings.find((building) => building.name === "Hotel Central")?.id;
    this.buildings.filter((building) => building.type === "home" || building.id === hotelId).forEach((building) => {
      building.occupied = this.people.filter((person) => person.alive && person.homeId === building.id).length;
    });
    if (this.housingSystem && hotelId) {
      const hotel = this.buildings.find((building) => building.id === hotelId);
      this.housingSystem.hotelCapacity = hotel?.capacity || this.housingSystem.hotelCapacity;
      this.housingSystem.hotelGuests = this.people.filter((person) => person.alive && person.homeId === hotelId && person.housing === "temporary").map((person) => person.id);
    }
  }
  hasHousingRoom(person, additionalResidents = 1, excludingIds = []) {
    const home = this.buildings.find((building) => building.id === person?.homeId);
    if (!home || !Number.isFinite(home.capacity)) return false;
    const excluded = new Set(excludingIds);
    const residents = this.people.filter(
      (resident) => resident.alive && resident.homeId === home.id && !excluded.has(resident.id),
    ).length;
    return residents + additionalResidents <= home.capacity;
  }
  relativesOf(person) {
    if (!this.kinship) {
      const ids = [...(person.parents || []), ...(person.children || []), person.partnerId].filter(Boolean);
      return ids.map((id) => this.people.find((p) => p.id === id)).filter(Boolean);
    }
    return this.kinship.relativesOf(person, { includePartners: true, livingOnly: false, maxDistance: 8 }).map((entry) => entry.person);
  }
  createHousingSystem() {
    this.housingSystem = {
      hotelId: this.buildings.find((b) => b.name === "Hotel Central").id,
      hotelCapacity: this.buildings.find((b) => b.name === "Hotel Central").capacity,
      hotelGuests: [],
      construction: [],
      moves: 0,
      immigrants: 0,
      departures: 0,
      completed: 0,
      applications: [],
      listings: [],
      transactions: [],
      evictions: 0,
      priceIndex: 100,
      averageRent: 0,
    };
    this.families.forEach((f) => {
      f.arrears = 0;
      f.housingCost = 0;
      f.creditScore = 420 + Math.floor(Math.random() * 420);
    });
    this.syncHousingOccupancy();
  }
  householdIncome(family) {
    return family.memberIds
      .map((id) => this.people.find((p) => p.id === id))
      .filter((p) => p?.alive && p.shift)
      .reduce((sum, p) => sum + p.hourlyWage * p.shift.hours * 4, 0);
  }
  isHomeOccupiable(home) {
    if (!home || home.type !== "home" || home.occupancyPermit === false) return false;
    const lot = this.city?.lots?.find((candidate) => candidate.id === home.lotId || candidate.id === home.parentLotId);
    if (!lot) return true;
    return !["raw", "planned", "authorized", "earthworks", "servicing", "reserved", "construction"].includes(lot.status);
  }
  createHousingListing(home, type = "rent") {
    if (!this.isHomeOccupiable(home)) return;
    if (this.housingSystem.listings.some((listing) => listing.homeId === home.id && listing.status === "available")) return;
    this.housingSystem.listings.push({
      id: uid("listing"),
      homeId: home.id,
      type,
      price:
        type === "sale"
          ? Math.round(home.value * (this.housingSystem.priceIndex / 100))
          : home.rent,
      listedWeek: this.week,
      applications: [],
      status: "available",
    });
  }
  processHousingMarket() {
    this.syncHousingOccupancy();
    const available = this.housingSystem.listings.filter(
      (l) => l.status === "available",
    );
    this.housingSystem.hotelGuests.forEach((personId) => {
      const p = this.people.find((x) => x.id === personId),
        family = this.familyOf(p);
      available.forEach((listing) => {
        if (listing.applications.includes(family.id)) return;
        const home = this.buildings.find((building) => building.id === listing.homeId),
          householdSize = this.livingHouseholdMembers(family).length,
          residents = this.people.filter((person) => person.alive && person.homeId === home?.id && !family.memberIds.includes(person.id)).length;
        if (!this.isHomeOccupiable(home) || residents + householdSize > home.capacity) return;
        const income = this.householdIncome(family),
          affordable =
            listing.type === "rent"
              ? income >= listing.price * 2.5
              : family.wealth >= listing.price * 0.2;
        if (affordable) listing.applications.push(family.id);
      });
    });
    available.forEach((listing) => {
      if (!listing.applications.length) return;
      const candidates = listing.applications
        .map((id) => this.families.find((f) => f.id === id))
        .filter(Boolean)
        .sort((a, b) => b.creditScore - a.creditScore),
        family = candidates[0],
        home = this.buildings.find((b) => b.id === listing.homeId);
      if (!family || !home || this.people.filter((person) => person.alive && person.homeId === home.id && !family.memberIds.includes(person.id)).length + this.livingHouseholdMembers(family).length > home.capacity) return;
      if (listing.type === "sale") {
        const adults = family.memberIds
          .map((id) => this.people.find((p) => p.id === id))
          .filter((p) => p.age >= 18);
        const buyer = adults[0];
        buyer.money -= listing.price * 0.2;
        home.ownerId = buyer.id;
        home.tenure = "mortgage";
        home.mortgagePayment = Math.round((listing.price * 0.8) / 240);
        family.tenure = "mortgage";
      } else family.tenure = "rent";
      if (!this.moveFamilyToHome(family, home)) return;
      listing.status = "closed";
      listing.familyId = family.id;
      this.housingSystem.transactions.unshift({
        week: this.week,
        familyId: family.id,
        homeId: home.id,
        type: listing.type,
        price: listing.price,
      });
      if (home.occupied < home.capacity) this.createHousingListing(home, (home.units || 1) > 1 ? "rent" : listing.type);
    });
  }
  moveFamilyToHome(family, home) {
    const living = this.livingHouseholdMembers(family),
      existingResidents = home ? this.people.filter((person) => person.alive && person.homeId === home.id && !family.memberIds.includes(person.id)).length : 0;
    if (!this.isHomeOccupiable(home) || existingResidents + living.length > home.capacity) return false;
    const old = this.buildings.find((b) => b.id === family.homeId);
    family.memberIds.forEach((id) => {
      const p = this.people.find((x) => x.id === id);
      if (!p?.alive) return;
      if (old) old.occupied = Math.max(0, old.occupied - 1);
      home.occupied++;
      p.homeId = home.id;
      p.housing = family.tenure;
      p.x = home.x + home.w / 2;
      p.y = home.y + home.h / 2;
      p.locationId = home.id;
      p.history.push({ week: this.week, text: `Mudou-se para ${home.name}.` });
      this.housingSystem.hotelGuests = this.housingSystem.hotelGuests.filter(
        (guest) => guest !== p.id,
      );
    });
    family.homeId = home.id;
    this.housingSystem.moves++;
    this.log(
      "mudança",
      `A família ${family.surname} mudou-se para ${home.name}.`,
      "social",
    );
    this.syncHousingOccupancy();
    return true;
  }
  evictFamily(family) {
    this.syncHousingOccupancy();
    const hotel = this.buildings.find((b) => b.id === this.housingSystem.hotelId),
      old = this.buildings.find((b) => b.id === family.homeId),
      living = family.memberIds
        .map((id) => this.people.find((p) => p.id === id))
        .filter((p) => p?.alive);
    if (
      (hotel?.occupied || 0) + living.filter((person) => person.homeId !== hotel?.id).length >
      (hotel?.capacity || this.housingSystem.hotelCapacity)
    )
      return;
    living.forEach((p) => {
      old.occupied = Math.max(0, old.occupied - 1);
      p.homeId = hotel.id;
      p.housing = "temporary";
      p.locationId = hotel.id;
      p.happiness = Math.max(0, p.happiness - 12);
      if (!this.housingSystem.hotelGuests.includes(p.id)) this.housingSystem.hotelGuests.push(p.id);
    });
    family.homeId = hotel.id;
    family.tenure = "temporary";
    family.arrears = 0;
    this.housingSystem.evictions++;
    this.createHousingListing(old, "rent");
    this.log(
      "despejo",
      `A família ${family.surname} foi despejada e está no Hotel Central.`,
      "civic",
    );
    this.syncHousingOccupancy();
  }
  housingStats() {
    const homes = this.buildings.filter((building) => this.isHomeOccupiable(building)),
      capacity = homes.reduce((s, h) => s + h.capacity, 0),
      occupied = homes.reduce((s, h) => s + h.occupied, 0);
    return {
      homes: homes.length,
      capacity,
      occupied,
      vacant: Math.max(0, capacity - occupied),
      overcrowded: homes.filter((h) => occupancyRate(h) > 1).length,
      hotelGuests: this.housingSystem.hotelGuests.length,
    };
  }
  startConstruction() {
    if (this.housingSystem.construction.length >= 3) return;
    const index =
        this.housingSystem.completed + this.housingSystem.construction.length,
      housingNow=this.housingStats(),density=housingNow.occupied/Math.max(1,housingNow.capacity),
      lot =
        this.city.lots.find((l) => !l.occupied && !l.reservedForDevelopment && ["urbanized", "ready"].includes(l.status || "urbanized") && l.zone === "residential") ||
        this.city.lots.find((l) => !l.occupied && !l.reservedForDevelopment && ["urbanized", "ready"].includes(l.status || "urbanized"));
    if (!lot) return;
    lot.occupied = true;
    const highDensity = lot.developmentRules?.density === "high";
    const duration = highDensity ? 9 + (index % 3) : 5 + (index % 4);
    const project = {
      id: uid("build"),
      name: `${highDensity ? "Residencial Vertical" : density>.82 ? "Conjunto" : "Residencial"} ${homeNames[index % homeNames.length]}`,
      x: lot.x + 0.12,
      y: lot.y + 0.12,
      w: lot.w - 0.24,
      h: lot.h - 0.24,
      lotId: lot.id,
      capacity: highDensity ? 20 + (index % 3) * 4 : density>.82?12+(index%3)*4:6+(index%3)*2,
      cost: (highDensity ? 248000 : density>.82?118000:68000) + index * 7500,
      remaining: duration,
      totalWeeks: duration,
      density: highDensity ? "high" : density > .82 ? "medium" : "low",
    };
    this.housingSystem.construction.push(project);
    this.money -= project.cost;
    this.log("obras", `Começou a construção do ${project.name}.`, "civic");
    return project;
  }
  finishConstruction(project) {
    const lot = this.city.lots.find((l) => l.id === project.lotId),
      home = {
        id: uid("b"),
        name: project.name,
        type: "home",
        x: project.x,
        y: project.y,
        w: project.w,
        h: project.h,
        capacity: project.capacity,
        occupied: 0,
        value: project.cost * 1.35,
        ownerId: null,
        tenure: "rent",
        rent: 780 + this.housingSystem.completed * 55,
        districtId: lot?.district,
        meter: emptyMeter(),
    };
    home.address = addressFor(home, this.buildings.length, this.city);
    this.ensurePhysicalSpaces(home);
    this.buildings.push(home);
    const assignedHouseholds = this.assignTemporaryResidents(home);
    if (!assignedHouseholds) this.createHousingListing(home, this.housingSystem.completed % 3 === 2 ? "sale" : "rent");
    this.housingSystem.construction = this.housingSystem.construction.filter(
      (p) => p.id !== project.id,
    );
    this.housingSystem.completed++;
    this.log(
      "moradia",
      `${home.name} foi concluído com capacidade para ${home.capacity} moradores.`,
      "social",
    );
  }
  assignTemporaryResidents(home, { requireAssistance = false } = {}) {
    this.syncHousingOccupancy();
    let assigned = 0;
    const households = [...new Set(this.housingSystem.hotelGuests.map((id) => this.familyOf(this.people.find((person) => person.id === id))?.id))]
      .map((id) => this.families.find((family) => family.id === id))
      .filter(Boolean)
      .sort((a, b) => this.livingHouseholdMembers(a).length - this.livingHouseholdMembers(b).length);
    for (const family of households) {
      if (requireAssistance && family.housingAssistance?.status !== "acompanhamento habitacional") continue;
      const size = this.livingHouseholdMembers(family).length;
      if (home.occupied + size > home.capacity) continue;
      family.tenure = "rent";
      if (this.moveFamilyToHome(family, home)) {
        assigned++;
        family.milestones ||= [];
        family.milestones.push({ week:this.week, text:`Deixou a hospedagem temporária e estabeleceu residência em ${home.name}.` });
      }
    }
    if (assigned) this.housingSystem.listings.filter((listing) => listing.homeId === home.id && listing.status === "available").forEach((listing) => { listing.status = "allocated"; listing.familyId = households[0]?.id || null; });
    return assigned;
  }
  settleAssistedTemporaryResidents() {
    if (!this.housingSystem.hotelGuests.length) return 0;
    let moved = 0;
    this.buildings
      .filter((building) => this.isHomeOccupiable(building) && building.occupied < building.capacity)
      .sort((a, b) => (a.rent || 0) - (b.rent || 0) || (b.capacity - b.occupied) - (a.capacity - a.occupied))
      .forEach((home) => { if (this.housingSystem.hotelGuests.length) moved += this.assignTemporaryResidents(home, { requireAssistance: true }); });
    return moved;
  }
  immigrate() {
    this.syncHousingOccupancy();
    const hotel = this.buildings.find((b) => b.id === this.housingSystem.hotelId);
    if (!hotel || hotel.occupied >= hotel.capacity) return false;
    const p = this.makePerson(this.people.length + 7);
    const assigned = this.buildings.find((b) => b.id === p.homeId);
    assigned.occupied--;
    p.homeId = hotel.id;
    p.x = hotel.x + 0.5;
    p.y = hotel.y + 0.5;
    p.housing = "temporary";
    p.role = "Desempregado";
    p.workplace = "—";
    p.shift = null;
    p.businessId = null;
    p.education = emptyEducation();
    p.medical = newMedicalRecord();
    p.parents = [];
    p.children = [];
    p.partnerId = null;
    p.history = [
      {
        week: this.week,
        text: "Chegou de outra cidade e hospedou-se no Hotel Central.",
      },
    ];
    const family = {
      id: uid("f"),
      kind: "household",
      surname: p.family,
      homeId: hotel.id,
      memberIds: [p.id],
      foundedYear: 2026 + Math.floor(this.week / 52),
      wealth: p.money,
      tenure: "temporary",
      arrivedWeek: this.week,
    };
    p.familyId = family.id;
    p.householdId = family.id;
    p.routine = buildRoutine(p);
    p.locationId = hotel.id;
    p.path = [];
    this.people.push(p);
    this.families.push(family);
    this.ensureCharacterState(p);
    this.relationshipProfileFor(p);
    this.recordCharacterMemory(p, {
      kind: "mudança",
      summary: `Chegou a Vila Esperança e iniciou uma nova vida no ${hotel.name}.`,
      placeId: hotel.id,
      valence: 28,
      importance: 72,
      novelty: 92,
      core: true,
      tags: ["mudança", "migração", "recomeço"],
    });
    this.housingSystem.hotelGuests.push(p.id);
    this.syncHousingOccupancy();
    this.housingSystem.immigrants++;
    this.log(
      "migração",
      `${p.name} chegou à cidade e está no Hotel Central.`,
      "social",
    );
    return true;
  }
  expandCityGrid() {
    if (this.city.bounds.width >= 74 || this.urbanEvolution.expansionProjects.some((project) => project.status !== "completed")) return false;
    const oldEdge = Math.max(...this.city.streets.filter((street) => street.axis === "v").map((street) => street.at));
    const base = oldEdge + 6, edge = oldEdge + 12, expansion = this.urbanEvolution.expansionProjects.length + 1;
    const district = {
      id: `expansion-${expansion}`,
      name: ["Nova Esperança", "Jardim do Sol", "Vila Horizonte", "Parque das Araucárias"][expansion % 4],
      x: oldEdge,
      y: 1,
      w: 12,
      h: 30,
      color: ["#cbd6c5", "#d8d1bd", "#c6d4ce", "#d7c9bd"][expansion % 4],
      status: "planning",
      developmentPhase: "levantamento técnico",
      createdWeek: this.week,
    };
    const newStreets = [
      { id: `vx-${expansion}-1`, name: `Av. da Expansão ${expansion}`, kind: "avenue", axis: "v", at: base, lanes: 4 },
      { id: `vx-${expansion}-2`, name: `Rua do Progresso ${expansion}`, kind: "street", axis: "v", at: edge, lanes: 2 },
    ].map((street) => ({ ...street, surface: "terra", condition: 28, sidewalk: false, lighting: "ausente", drainage: 10, constructionStatus: "design", openedWeek: null, workProgress: 0, pavementHistory: [] }));
    this.city.streets.push(...newStreets);
    this.city.districts.push(district);
    this.city.bounds.width = edge + 1;
    const horizontal = this.city.streets.filter((street) => street.axis === "h").map((street) => street.at).sort((a, b) => a - b), vertical = [oldEdge, base, edge], lotIds = [];
    for (let row = 0; row < horizontal.length - 1; row++) for (let col = 0; col < 2; col++) {
      const left = vertical[col] + .55, right = vertical[col + 1] - .55, top = horizontal[row] + .55, bottom = horizontal[row + 1] - .55;
      const splitHorizontal = right - left >= bottom - top, count = 1 + ((row * 3 + col + expansion) % 3), gap = .12;
      const weights = Array.from({ length: count }, (_, part) => .8 + ((row + 1) * (part + 2) + col + expansion) % 7 / 10);
      const total = weights.reduce((sum, value) => sum + value, 0), available = (splitHorizontal ? right - left : bottom - top) - gap * (count - 1);
      let cursor = splitHorizontal ? left : top;
      weights.forEach((weight, part) => {
        const length = available * weight / total, x = splitHorizontal ? cursor : left, y = splitHorizontal ? top : cursor, w = splitHorizontal ? length : right - left, h = splitHorizontal ? bottom - top : length;
        const lot = {
          id: `lot-x${expansion}-${row}-${col}-${part}`,
          x,
          y,
          w,
          h,
          row,
          col: col + 6 + expansion * 2,
          zone: row === 0 ? "mixed" : (row + col + part) % 5 === 0 ? "mixed" : "residential",
          district: district.id,
          occupied: false,
          status: "planned",
          area: Math.round(w * h * 100),
          frontage: Math.round((splitHorizontal ? w : h) * 10) / 10,
          depth: Math.round((splitHorizontal ? h : w) * 10) / 10,
          shape: (row + col + part) % 6 === 0 ? "irregular" : "retangular",
          slope: (row * 3 + col * 5 + part * 2) % 16,
          serviceLevel: 8,
          expansionProjectId: `expansion-project-${expansion}`,
          createdWeek: this.week,
        };
        this.city.lots.push(lot);
        lotIds.push(lot.id);
        cursor += length + gap;
      });
    }
    const project = {
      id: `expansion-project-${expansion}`,
      districtId: district.id,
      streetIds: newStreets.map((street) => street.id),
      lotIds,
      status: "active",
      phaseIndex: 0,
      phase: "survey",
      phaseLabel: "levantamento e licenciamento",
      phaseProgress: 0,
      remainingWeeks: 2,
      startedWeek: this.week,
      investment: 0,
      history: [{ week: this.week, text: "Levantamentos topográficos, ambientais e fundiários iniciados." }],
    };
    this.urbanEvolution.expansionProjects.push(project);
    this.urbanEvolution.history.unshift({ week: this.week, text: `${district.name} entrou em planejamento: ${lotIds.length} terrenos foram desenhados, mas a ocupação permanece bloqueada.` });
    this.log("expansão urbana", `A Prefeitura autorizou o planejamento de ${district.name}; lotes só serão liberados após vias, redes e vistoria.`, "civic", { cause: "pressão habitacional e reserva de lotes abaixo da meta", consequences: ["levantamento técnico iniciado", "ocupação ainda proibida", `${lotIds.length} terrenos planejados`], priority: "destaque" });
    return true;
  }
  advanceExpansionProjects() {
    const phases = [
      { id: "survey", label: "levantamento e licenciamento", weeks: 2, investment: 24000 },
      { id: "earthworks", label: "terraplenagem e drenagem primária", weeks: 3, investment: 78000 },
      { id: "roads", label: "abertura das vias em terra", weeks: 4, investment: 126000 },
      { id: "utilities", label: "redes de água, esgoto, energia e iluminação", weeks: 3, investment: 164000 },
      { id: "inspection", label: "vistoria e liberação dos terrenos", weeks: 2, investment: 42000 },
    ];
    this.urbanEvolution.expansionProjects.filter((project) => project.status === "active").forEach((project) => {
      const phase = phases[project.phaseIndex], district = this.city.districts.find((candidate) => candidate.id === project.districtId), streets = project.streetIds.map((id) => this.city.streets.find((street) => street.id === id)).filter(Boolean), lots = project.lotIds.map((id) => this.city.lots.find((lot) => lot.id === id)).filter(Boolean);
      project.remainingWeeks--;
      project.phaseProgress = clamp(1 - project.remainingWeeks / phase.weeks, 0, 1);
      if (phase.id === "earthworks") {
        district.status = "construction";
        streets.forEach((street) => { street.constructionStatus = "earthworks"; street.workProgress = Math.round(project.phaseProgress * 25); });
        lots.forEach((lot) => { lot.status = "earthworks"; lot.serviceLevel = 12; });
      }
      if (phase.id === "roads") streets.forEach((street) => { street.constructionStatus = "under_construction"; street.condition = Math.round(28 + project.phaseProgress * 25); street.workProgress = Math.round(25 + project.phaseProgress * 35); });
      if (phase.id === "utilities") {
        streets.forEach((street) => { street.surface = "cascalho"; street.condition = 62; street.drainage = Math.round(20 + project.phaseProgress * 50); street.lighting = project.phaseProgress > .65 ? "parcial" : "ausente"; street.workProgress = Math.round(60 + project.phaseProgress * 25); });
        lots.forEach((lot) => { lot.status = "servicing"; lot.serviceLevel = Math.round(22 + project.phaseProgress * 60); lot.infrastructure = { water: project.phaseProgress > .35, sewer: project.phaseProgress > .6, power: project.phaseProgress > .2 }; });
      }
      if (project.remainingWeeks > 0) return;
      project.investment += phase.investment;
      this.money -= phase.investment;
      project.history.unshift({ week: this.week, text: `${phase.label} concluída.` });
      this.urbanEvolution.history.unshift({ week: this.week, text: `${district.name}: ${phase.label} concluída.` });
      if (project.phaseIndex < phases.length - 1) {
        project.phaseIndex++;
        const next = phases[project.phaseIndex];
        project.phase = next.id;
        project.phaseLabel = next.label;
        project.phaseProgress = 0;
        project.remainingWeeks = next.weeks;
        district.developmentPhase = next.label;
        if (["roads", "utilities"].includes(next.id)) this.log("obras", `${district.name} entrou na etapa de ${next.label}.`, "civic", { cause: `${phase.label} concluída`, consequences: ["canteiro permanece ativo", "lotes continuam bloqueados"], priority: "normal" });
        return;
      }
      project.status = "completed";
      project.completedWeek = this.week;
      district.status = "active";
      district.developmentPhase = "bairro liberado";
      streets.forEach((street) => { street.surface = "cascalho"; street.condition = 68; street.drainage = 72; street.lighting = "parcial"; street.constructionStatus = "complete"; street.workProgress = 100; street.openedWeek = this.week; });
      lots.forEach((lot) => { lot.status = "urbanized"; lot.serviceLevel = 84; lot.infrastructure = { water: true, sewer: true, power: true, roadAccess: true, paved: false }; });
      this.urbanEvolution.expansions++;
      this.urbanEvolution.lotsReleased += lots.length;
      this.urbanEvolution.roadsOpened += streets.length;
      const route = this.transportSystem?.routes?.find((candidate) => candidate.id === "L3");
      if (route) streets.forEach((street) => route.stops.splice(Math.max(1, route.stops.length - 1), 0, [street.at, 21]));
      const pavingTarget = streets.find((street) => street.kind === "avenue") || streets[0];
      if (pavingTarget && this.localGovernment && !this.localGovernment.publicWorks.some((work) => work.streetId === pavingTarget.id)) {
        const authorized = authorizeMunicipalPublicWork(this.localGovernment, {
          type: "paving",
          name: `Pavimentação definitiva da ${pavingTarget.name}`,
          address: pavingTarget.name,
          districtId: district.id,
          expectedWeeks: 8,
          budget: 96000,
          lengthKm: 1.8,
          workersRequired: 9,
          cause: "abertura do novo bairro e necessidade de acesso permanente ao transporte coletivo",
        }, localGovernmentContextFromSimulation(this));
        this.localGovernment = authorized.state;
        const work = this.localGovernment.publicWorks.find((item) => item.id === authorized.work.id);
        if (work) work.streetId = pavingTarget.id;
        authorized.newsFacts.forEach((fact) => this.publishMunicipalNews(fact));
      }
      this.log("expansão urbana", `${district.name} foi liberado após vistoria; ${lots.length} lotes agora podem receber obras, enquanto a pavimentação definitiva tramita separadamente.`, "civic", { cause: "vias em cascalho e redes essenciais concluídas", consequences: ["lotes liberados", "rota pública estendida", "pavimentação municipal contratada"], priority: "destaque" });
    });
  }
  startUrbanProject(type, options = {}) {
    if (this.urbanEvolution.projects.length >= 3) return;
    const lot=this.city.lots.find((l)=>!l.occupied&&!l.reservedForDevelopment&&["urbanized","ready"].includes(l.status||"urbanized")&&(type==="commercial"?l.zone==="mixed":true)); if(!lot)return;
    const serviceCatalog = {
      health: { names: ["UBS Jardim Vivo", "Cl\u00ednica Municipal da Fam\u00edlia"], buildingType: "health", capacityAdded: 12, cost: 210000, duration: 12 },
      education: { names: ["Escola Parque", "Centro Municipal de Educa\u00e7\u00e3o"], buildingType: "school", capacityAdded: 36, cost: 235000, duration: 13 },
      safety: { names: ["Base Comunit\u00e1ria de Seguran\u00e7a", "Posto Integrado de Prote\u00e7\u00e3o"], buildingType: "civic", capacityAdded: 1, cost: 175000, duration: 10 },
      community: { names: ["Pra\u00e7a Linear", "Centro Comunit\u00e1rio", "Centro Esportivo"], buildingType: "park", capacityAdded: 35, cost: 145000, duration: 10 },
    };
    const service = serviceCatalog[options.serviceKind] || serviceCatalog.community;
    lot.occupied=true; const names=type==="commercial"?["Galeria Popular","Padaria do Bairro","Oficina Horizonte","Armazém Comunitário"]:["Praça Linear","Posto Comunitário","Centro Esportivo"],duration=type==="commercial"?7:10;
    const project={id:uid("urban"),type,name:names[(this.urbanEvolution.completed+this.urbanEvolution.projects.length)%names.length],lotId:lot.id,remaining:duration,totalWeeks:duration,cost:type==="commercial"?95000:145000};
    if (type === "civic") Object.assign(project, { serviceKind: options.serviceKind || "community", buildingType: service.buildingType, capacityAdded: service.capacityAdded, name: service.names[(this.urbanEvolution.completed + this.urbanEvolution.projects.length) % service.names.length], remaining: service.duration, totalWeeks: service.duration, cost: service.cost });
    this.urbanEvolution.projects.push(project); this.money-=project.cost*(type==="civic"?1:.25); this.urbanEvolution.history.unshift({week:this.week,text:`Obras de ${project.name} iniciadas.`});
  }
  finishUrbanProject(project) {
    const lot=this.city.lots.find((l)=>l.id===project.lotId),building={id:uid("b"),name:project.name,type:project.type==="commercial"?"shop":project.name.includes("Praça")?"park":"civic",x:lot.x+.12,y:lot.y+.12,w:lot.w-.24,h:lot.h-.24,capacity:35,occupied:0,value:project.cost*1.3,districtId:lot.district,meter:emptyMeter()};
    if (project.buildingType) building.type = project.buildingType;
    building.capacity = Math.max(building.capacity, project.capacityAdded || 0);
    if (project.serviceKind === "health") { this.healthSystem.beds += project.capacityAdded || 12; this.healthSystem.primaryCareCapacity += 18; }
    if (project.serviceKind === "education") this.educationSystem.schoolCapacity += project.capacityAdded || 36;
    if (project.serviceKind === "safety") this.justiceSystem.patrols += project.capacityAdded || 1;
    if (project.serviceKind === "community") this.infrastructure.serviceLevel = clamp(this.infrastructure.serviceLevel + 3, 0, 100);
    building.address=addressFor(building,this.buildings.length,this.city); this.ensurePhysicalSpaces(building); this.buildings.push(building);
    if(project.type==="commercial") { const owner=this.people.filter(p=>p.alive&&!this.isPlayerControlled(p)&&p.age>=24).sort((a,b)=>b.money-a.money)[0],business={id:uid("biz"),buildingId:building.id,name:building.name,sector:"Comércio local",open:7,close:21,products:{conveniência:{price:22,stock:90,target:120}},ownerId:owner?.id||null,cash:12000,revenue:0,expenses:0,sales:0,employees:[],days:[0,1,2,3,4,5,6],presentCustomers:[],transactions:[],visits:0,reputation:60,serviceQuality:65}; building.businessId=business.id;this.businesses.push(business); }
    this.urbanEvolution.projects=this.urbanEvolution.projects.filter(p=>p.id!==project.id);this.urbanEvolution.completed++;this.urbanEvolution.history.unshift({week:this.week,text:`${project.name} foi inaugurado em ${building.address.district}.`});
  }
  weeklyUrbanEvolution() {
    this.advanceExpansionProjects();
    this.urbanEvolution.projects.forEach(p=>p.remaining--); this.urbanEvolution.projects.filter(p=>p.remaining<=0).forEach(p=>this.finishUrbanProject(p));
    const housing=this.housingStats(),freeLots=this.city.lots.filter(l=>!l.occupied&&!l.reservedForDevelopment&&["urbanized","ready"].includes(l.status||"urbanized")).length,activeCases=this.justiceSystem.openCases.filter(c=>!["condenado","absolvido","arquivado"].includes(c.status));
    this.city.districts.forEach(d=>{const residents=this.people.filter(p=>p.alive&&this.buildings.find(b=>b.id===p.homeId)?.districtId===d.id).length,crimes=activeCases.filter(c=>this.buildings.find(b=>b.id===c.locationId)?.districtId===d.id).length,services=this.buildings.filter(b=>b.districtId===d.id&&b.type!=="home").length,desirability=clamp(58+services*2.2-crimes*3+Math.min(12,residents*.08),15,98);this.urbanEvolution.districtMetrics[d.id]={residents,crimes,services,desirability};this.buildings.filter(b=>b.type==="home"&&b.districtId===d.id).forEach(h=>h.value=Math.max(45000,Math.round(h.value*(1+(desirability-55)*.00018))));});
    this.urbanEvolution.lastCapacityAudit = { week: this.week, freeLots, housingOccupancy: roundNumber(housing.occupied / Math.max(1, housing.capacity) * 100, 1) };
  }
  weeklyHousing() {
    this.syncHousingOccupancy();
    this.housingSystem.construction.forEach((p) => p.remaining--);
    this.housingSystem.construction
      .filter((p) => p.remaining <= 0)
      .forEach((p) => this.finishConstruction(p));
    this.processHousingMarket();
    this.settleAssistedTemporaryResidents();
    const homes = this.buildings.filter((b) => b.type === "home"),
      vacancy = homes.reduce((n, h) => n + Math.max(0, h.capacity - h.occupied), 0);
    this.housingSystem.priceIndex = clamp(
      this.housingSystem.priceIndex + (vacancy < 8 ? 0.8 : -0.35),
      65,
      220,
    );
    this.housingSystem.averageRent = Math.round(
      homes.reduce((s, h) => s + (h.rent || 0), 0) / Math.max(1, homes.length),
    );
    const crowdedHomes = this.buildings
      .filter((building) => building.type === "home" && building.occupied > building.capacity)
      .sort((a, b) => b.occupied - b.capacity - (a.occupied - a.capacity));
    crowdedHomes.forEach((crowded) => {
      const residentFamilies = [...new Set(
        this.people
          .filter((person) => person.alive && person.homeId === crowded.id)
          .map((person) => person.householdId || person.familyId)
          .filter(Boolean),
      )]
        .map((id) => this.families.find((family) => family.id === id))
        .filter(Boolean)
        .sort((a, b) => this.livingHouseholdMembers(a).length - this.livingHouseholdMembers(b).length);
      const family = residentFamilies.find((candidate) => {
        const size = this.livingHouseholdMembers(candidate).length;
        return this.buildings.some(
          (home) => home.type === "home" && home.id !== crowded.id && home.capacity - home.occupied >= size,
        );
      });
      if (!family) {
        if (this.housingSystem.construction.length < 3) this.startConstruction();
        return;
      }
      const size = this.livingHouseholdMembers(family).length;
      const destination = this.buildings
        .filter(
          (home) => home.type === "home" && home.id !== crowded.id && home.capacity - home.occupied >= size,
        )
        .sort((a, b) => (a.rent || 0) - (b.rent || 0) || b.capacity - b.occupied - (a.capacity - a.occupied))[0];
      if (destination && this.moveFamilyToHome(family, destination)) {
        family.milestones ||= [];
        family.milestones.unshift({
          week: this.week,
          text: `Mudança coletiva para ${destination.name} após superlotação em ${crowded.name}.`,
        });
      }
    });
    this.syncHousingOccupancy();
  }
  createJusticeSystem() {
    this.justiceSystem = {
      prisonCapacity: 52,
      prisoners: [],
      openCases: [],
      solved: 0,
      reported: 0,
      finesCollected: 0,
      patrols: 3,
      corruption: 0,
      paroles: 0,
      incidents: 0,
      rehabilitated: 0,
      courtQueue: [],
      closedCases: [],
      warrants: [],
      evidenceLab: { queue: [], processed: 0, capacity: 5 },
      dispatches: 0,
      responseMinutes: 11,
      arrests: 0,
      acquittals: 0,
      convictions: 0,
      overcrowding: 0,
      raids: 0,
      illegalVenuesDiscovered: 0,
      victimSupport: [],
      emergencyCalls: [],
      districtCrime: {},
      useOfForceIncidents: 0,
      prisonWings: [
        { id: "minimum", name: "Ala de baixa segurança", capacity: 22, inmates: [] },
        { id: "medium", name: "Ala de segurança média", capacity: 20, inmates: [] },
        { id: "maximum", name: "Ala de segurança máxima", capacity: 10, inmates: [] },
      ],
      programs: ["Trabalho interno", "Educação básica", "Apoio psicológico"],
    };
    this.investigationState = createInvestigationState({
      week: this.week,
      day: this.day,
      hour: Math.floor(this.minute / 60),
      minute: this.minute % 60,
      labCapacity: this.justiceSystem.evidenceLab.capacity,
    });
    this.investigationSummary = summarizeInvestigations(this.investigationState);
  }
  createUndergroundSystem() {
    this.underground={enterprises:[],transactions:[],dirtyMoney:0,laundered:0,seized:0,operations:0,closedSchemes:0,clients:new Set()};
    Object.entries(undergroundVenues).forEach(([name,definition])=>{const business=this.businesses.find(b=>b.name===name);if(!business)return;const members=business.employees.map(id=>this.people.find(p=>p.id===id)).filter(p=>p?.alive&&p.age>=18);this.underground.enterprises.push({id:uid("scheme"),businessId:business.id,name,activity:definition.activity,front:definition.front,products:definition.products,memberIds:members.map(p=>p.id),leaderId:business.ownerId,heat:definition.baseHeat,dirtyFunds:4000+Math.floor(Math.random()*9000),launderedFunds:0,status:"operando",customers:[],history:[]});});
  }
  dailyUnderground() {
    this.underground.enterprises.forEach(scheme=>{
      const business=this.businesses.find(b=>b.id===scheme.businessId);if(!business||business.closed)return;if(business.suspendedDays>0){scheme.status="interditado";return;}scheme.status="operando";
      const candidates=this.people.filter(p=>p.alive&&!this.isPlayerControlled(p)&&p.age>=18&&!p.justice.incarcerated&&p.money>80&&(p.personality.riskTolerance>58||p.money<450||p.traits.includes("impulsivo"))),visits=Math.min(5,Math.floor(Math.random()*3)+(business.nightlife&&this.day>=3?2:0));
      candidates.sort(()=>Math.random()-.5).slice(0,visits).forEach(client=>{if(isAdultUnderground(scheme.activity)&&client.age<18)return;const price=scheme.activity==="lavagem de dinheiro"?300:scheme.activity==="contrabando"?180:scheme.activity==="serviços adultos sem licença"?240:90+Math.floor(Math.random()*100);if(client.money<price)return;client.money-=price;scheme.dirtyFunds+=price;this.underground.dirtyMoney+=price;scheme.heat=clamp(scheme.heat+1+price/600,0,100);scheme.customers.unshift(client.id);scheme.customers=scheme.customers.slice(0,30);this.underground.clients.add(client.id);client.activity=`Cliente de ${scheme.front.toLowerCase()}`;client.happiness=clamp(client.happiness+2,0,100);client.needs.social=clamp(client.needs.social+3,0,100);const transaction={id:uid("illegal-tx"),schemeId:scheme.id,clientId:client.id,week:this.week,day:this.day,amount:price,product:pick(scheme.products)};this.underground.transactions.unshift(transaction);scheme.history.unshift({week:this.week,text:`Movimentação de R$ ${price} em ${transaction.product}.`});});
      if(scheme.activity==="lavagem de dinheiro"||business.frontBusiness){const amount=Math.min(scheme.dirtyFunds,250+Math.random()*700);scheme.dirtyFunds-=amount;scheme.launderedFunds+=amount;business.cash+=amount*.72;this.underground.laundered+=amount;scheme.heat=clamp(scheme.heat+amount/1600,0,100);}
      scheme.heat=clamp(scheme.heat-.35,0,100);if(scheme.heat>68&&Math.random()<.025+this.justiceSystem.patrols*.008)this.raidUnderground(scheme);
    });
    this.underground.transactions=this.underground.transactions.slice(0,180);
  }
  raidUnderground(scheme) {
    const business=this.businesses.find(b=>b.id===scheme.businessId),suspects=[scheme.leaderId,...scheme.memberIds].map(id=>this.people.find(p=>p.id===id)).filter(p=>p?.alive),seized=Math.round(scheme.dirtyFunds+scheme.launderedFunds*.45);scheme.dirtyFunds=0;scheme.launderedFunds*=.55;scheme.heat=25;scheme.status="sob investigação";scheme.history.unshift({week:this.week,text:`Operação policial apreendeu R$ ${seized.toLocaleString("pt-BR")}.`});business.suspendedDays=8+Math.floor(Math.random()*14);this.underground.seized+=seized;this.money+=seized;this.underground.operations++;this.justiceSystem.raids++;
    suspects.slice(0,Math.max(1,Math.ceil(suspects.length*.5))).forEach((suspect,i)=>{const offense=scheme.activity==="lavagem de dinheiro"?"fraud":scheme.activity==="contrabando"||scheme.activity==="receptação"?"vehicle_theft":"corruption",victim=this.people.find(p=>p.alive&&p.id!==suspect.id),crime={id:uid("case"),offenseId:offense,perpetratorId:suspect.id,suspectId:suspect.id,victimId:victim?.id,week:this.week,day:this.day,time:this.time,locationId:this.buildings.find(b=>b.businessId===business.id)?.id,status:"em investigação",priority:4,assignedOfficerId:null,progress:68,evidence:[{id:uid("evidence"),type:"registros financeiros apreendidos",forensic:true,status:"validada",strength:24+i*3}],witnesses:2,evidenceStrength:34+i*4,warrantId:null,timeline:[{week:this.week,day:this.day,text:`Identificado durante operação em ${business.name}.`} ]};this.justiceSystem.openCases.push(crime);this.justiceSystem.reported++;suspect.justice.offenses.push(crime.id);});
    const owner=this.people.find(p=>p.id===scheme.leaderId),family=owner&&this.familyOf(owner);if(family){family.wealth=Math.max(0,family.wealth-seized);family.creditScore=Math.max(200,family.creditScore-80);family.arrears+=2;family.milestones||=[];family.milestones.push({week:this.week,text:`Patrimônio atingido por operação em ${business.name}.`});}
    this.log("operação policial",`Operação em ${business.name} desarticulou esquema de ${scheme.activity}, apreendeu R$ ${seized.toLocaleString("pt-BR")} e identificou ${suspects.length} suspeito(s).`,"civic");
  }
  weeklyUnderground() {
    this.underground.enterprises.filter(s=>s.status!=="encerrado").forEach(s=>{const business=this.businesses.find(b=>b.id===s.businessId);if(business?.suspendedDays<=0&&s.memberIds.length<4){const recruit=this.people.filter(p=>p.alive&&!this.isPlayerControlled(p)&&p.age>=18&&!p.justice.incarcerated&&!s.memberIds.includes(p.id)).sort((a,b)=>b.personality.riskTolerance-a.personality.riskTolerance)[0];if(recruit&&Math.random()<.18){s.memberIds.push(recruit.id);recruit.history.push({week:this.week,text:`Passou a atuar informalmente para ${business.name}.`});}}if(s.heat>90&&Math.random()<.15){s.status="encerrado";business.closed=true;business.closedWeek=this.week;this.underground.closedSchemes++;}});
  }
  crimeRisk(p) {
    const poverty = p.money < 0 ? 0.012 : p.money < 400 ? 0.006 : 0.0015;
    const traits = p.traits.includes("impulsivo") ? 0.004 : 0;
    const repeat = p.justice.convictions * 0.0015;
    const acuteStress = (p.mind?.emotional?.stress || 0) > 78 && (p.personality?.dimensions?.stability || 50) < 42 ? .0018 : 0;
    const socialProtection = (p.needs?.social || 0) > 72 && this.relationshipsOf(p).some(({ link }) => link.trust > 65) ? -.0012 : 0;
    return Math.max(.0002, poverty + traits + repeat + acuteStress + socialProtection);
  }
  dailyJustice() {
    this.justiceSystem.prisoners = [...new Set(this.justiceSystem.prisoners)].filter((id) => {
      const person = this.people.find((candidate) => candidate.id === id);
      return person?.alive && person.justice?.incarcerated;
    });
    this.justiceSystem.prisonWings.forEach((wing) => {
      wing.inmates = [...new Set(wing.inmates)].filter((id) => {
        const person = this.people.find((candidate) => candidate.id === id);
        return person?.alive && person.justice?.incarcerated && person.justice.prisonWing === wing.id;
      });
    });
    this.justiceSystem.overcrowding = Math.max(0, this.justiceSystem.prisoners.length - this.justiceSystem.prisonCapacity);
    this.justiceSystem.prisoners.slice().forEach((id) => {
      const p = this.people.find((x) => x.id === id),
        j = p.justice;
      if (j.pretrial) { p.activity = "Aguardando julgamento"; return; }
      j.sentenceRemaining--;
      j.served++;
      if (!j.prisonJob)
        j.prisonJob = ["Cozinha", "Manutenção", "Lavanderia", "Biblioteca"][
          Number(p.id.replace(/\D/g, "")) % 4
        ];
      if (!j.prisonProgram) j.prisonProgram = pick(this.justiceSystem.programs);
      const crowding = Math.max(0, this.justiceSystem.prisoners.length / this.justiceSystem.prisonCapacity - 1);
      j.programProgress = clamp(j.programProgress + .5, 0, 100);
      j.rehabilitation = clamp(
        j.rehabilitation +
          (p.traits.includes("paciente") || p.traits.includes("metódico")
            ? 0.65
            : 0.32) + (j.prisonProgram ? .18 : 0) - crowding * .35,
        0,
        100,
      );
      p.health = clamp(p.health - crowding * .08, 0, 100); p.happiness = clamp(p.happiness - .04 - crowding * .12, 0, 100);
      p.money += 3;
      if (
        Math.random() <
        0.008 + (p.traits.includes("impulsivo") ? 0.012 : 0) + crowding * .018
      ) {
        j.disciplinary++;
        j.sentenceRemaining += 2;
        j.rehabilitation = Math.max(0, j.rehabilitation - 5);
        this.justiceSystem.incidents++;
        j.history.unshift({
          week: this.week,
          text: "Recebeu sanção disciplinar durante o cumprimento da pena.",
        });
      }
      const servedRatio = j.totalSentence ? j.served / j.totalSentence : 1;
      if (
        j.totalSentence >= 14 &&
        servedRatio > 0.5 &&
        j.rehabilitation > 68 &&
        j.disciplinary < 2 &&
        Math.random() < 0.018
      ) {
        j.parole = true;
        this.justiceSystem.paroles++;
        this.releasePrisoner(p, true);
      } else if (j.sentenceRemaining <= 0) this.releasePrisoner(p, false);
    });
    this.people
      .filter((p) => p.alive && p.justice.parole && !p.justice.incarcerated)
      .forEach((p) => {
        p.justice.sentenceRemaining--;
        if (p.justice.sentenceRemaining <= 0) {
          p.justice.parole = false;
          p.justice.history.unshift({
            week: this.week,
            text: "Concluiu o período de liberdade condicional.",
          });
        }
      });
    const candidates = this.people.filter(
      (p) => p.alive && !this.isPlayerControlled(p) && p.age >= 16 && !p.justice.incarcerated,
    );
    candidates.forEach((p) => {
      if (Math.random() >= this.crimeRisk(p)) return;
      let offense = weightedOffense();
      if (
        offense.id === "corruption" &&
        !["Policial", "Comerciante", "Analista"].includes(p.role)
      )
        offense = offenses[1];
      const offenderPlace = this.buildings.find((building) => building.id === p.locationId),
        eligibleVictims = this.people.filter((v) => v.alive && v.id !== p.id && !v.justice.incarcerated),
        coPresent = eligibleVictims.filter((v) => !v.currentTrip && v.locationId === p.locationId),
        sameDistrict = eligibleVictims.filter((v) => this.buildings.find((building) => building.id === v.locationId)?.districtId === offenderPlace?.districtId),
        victims = coPresent.length ? coPresent : sameDistrict.length ? sameDistrict : eligibleVictims,
        victim = victims[Math.floor(Math.random() * victims.length)];
      const crime = {
        id: uid("case"),
        offenseId: offense.id,
        perpetratorId: p.id,
        suspectId: null,
        victimId: victim?.id,
        week: this.week,
        day: this.day,
        time: this.time,
        locationId: p.locationId || victim?.locationId || p.homeId,
        status: "despacho solicitado",
        priority: offense.severity === "gravíssimo" ? 5 : offense.severity === "grave" ? 4 : offense.severity === "médio" ? 3 : 2,
        assignedOfficerId: null,
        progress: 0,
        evidence: [],
        witnesses: Math.floor(Math.random() * 4),
        evidenceStrength: 0,
        warrantId: null,
        timeline: [{ week: this.week, day: this.day, text: "Ocorrência comunicada à central." }],
      };
      this.justiceSystem.openCases.push(crime);
      this.justiceSystem.reported++;
      this.justiceSystem.dispatches++;
      this.justiceSystem.emergencyCalls.unshift({id:uid("call"),caseId:crime.id,callerId:victim?.id||null,priority:crime.priority,receivedAt:this.time,responseMinutes:Math.max(3,Math.round(this.justiceSystem.responseMinutes+(Math.random()-.5)*6)),status:"equipe despachada"});this.justiceSystem.emergencyCalls=this.justiceSystem.emergencyCalls.slice(0,80);
      if(victim)this.justiceSystem.victimSupport.unshift({caseId:crime.id,personId:victim.id,status:"acolhimento inicial",psychologicalSupport:offense.violence>.3,compensation:0,week:this.week});
      p.justice.offenses.push(crime.id);
      p.justice.history.unshift({
        week: this.week,
        text: `Suspeito de ${offense.name}.`,
      });
      if (offense.id === "homicide" && victim) {
        this.die(victim, `homicídio em investigação (${offense.name})`);
        crime.homicide = true;crime.priority = 5;crime.evidenceStrength += 8;
        const deathRecord=this.funeralSystem.records.find(r=>r.personId===victim.id);if(deathRecord){crime.deathRecordId=deathRecord.id;deathRecord.criminalCaseId=crime.id;}
        crime.timeline.unshift({week:this.week,day:this.day,text:"Local isolado; perícia e investigação de homicídio acionadas."});
      } else if (offense.violence > 0.3 && victim) {
        victim.health = Math.max(5, victim.health - 8 - offense.violence * 15);
        victim.medical.history.unshift({
          week: this.week,
          text: `Atendido após ocorrência de ${offense.name}.`,
        });
        if(victim.health<35)this.addCondition(victim,"fracture",false);
      }
      if (victim?.alive) this.recordCharacterMemory(victim, {
        kind: "vitimização",
        summary: `Foi vítima de uma ocorrência de ${offense.name} em ${this.buildings.find((building) => building.id === crime.locationId)?.name || "Vila Esperança"}.`,
        actorIds: [p.id],
        placeId: crime.locationId,
        valence: -88,
        importance: 70 + crime.priority * 5,
        stressImpact: 12 + crime.priority * 3,
        core: crime.priority >= 4,
        tags: ["crime", "vítima", offense.id],
      });
      this.log(
        "ocorrência",
        `${offense.name} foi registrado${victim ? ` envolvendo ${victim.name}` : ""}.`,
        "civic",
      );
    });
    this.processEvidenceLab();
    this.investigateCasesAdvanced();
    this.processCourtCases();
    this.inspectBusinesses();
    this.dailyUnderground();
    this.advanceInvestigations();
  }
  advanceInvestigations() {
    const result = runInvestigationDay(
      this.investigationState,
      {
        week: this.week,
        day: this.day,
        hour: Math.floor(this.minute / 60),
        minute: this.minute % 60,
        time: this.time,
        people: this.people,
        buildings: this.buildings,
        justiceSystem: this.justiceSystem,
      },
      { random: Math.random },
    );
    this.investigationState = result.state;
    this.investigationSummary = summarizeInvestigations(result.state);
    const bySource = new Map(result.state.cases.map((record) => [record.sourceCaseId, record]));
    this.justiceSystem.openCases.forEach((crime) => {
      const record = bySource.get(crime.id);
      if (!record) return;
      crime.investigationId = record.id;
      crime.investigationStatus = record.status;
      crime.investigationProgress = record.progress.overall;
      crime.investigationConfidence = record.progress.confidence;
      crime.progress = Math.max(Number(crime.progress) || 0, record.progress.overall);
      crime.evidenceStrength = Math.max(Number(crime.evidenceStrength) || 0, record.progress.evidence * 0.42);
    });
    result.journalEvents
      .filter((event) => event.publication.status === "eligible" && event.publication.newsworthiness >= 52)
      .forEach((event) => {
        const named = event.people.map((person) => person.name).filter(Boolean);
        this.log(
          event.kind || "investigação",
          `${event.title}. ${event.summary}${named.length ? ` Pessoas citadas: ${named.join(", ")}.` : ""}`,
          event.offense.homicide || event.publication.newsworthiness >= 78 ? "civic" : "neutral",
          {
            section: "Segurança",
            peopleIds: event.personIds,
            placeIds: event.locationId ? [event.locationId] : [],
            cause: event.cause,
            consequences: [event.confirmedConsequence],
            facts: event.confirmedFacts,
            dedupeKey: event.publication.dedupeKey,
            priority: event.publication.newsworthiness >= 78 ? "urgente" : "normal",
          },
        );
      });
  }
  investigationFile(caseId) {
    return getInvestigationCaseFile(this.investigationState, caseId, {
      people: this.people,
      buildings: this.buildings,
    });
  }
  inspectBusinesses() {
    this.businesses.forEach((b) => { if (b.suspendedDays > 0) b.suspendedDays--; });
    const targets=this.businesses.filter(b=>b.illegalActivity&&!b.closed&&!(b.suspendedDays>0)); if(!targets.length||Math.random()>.006*this.justiceSystem.patrols)return;
    const b=pick(targets),discovered=Math.random()<.38+this.justiceSystem.patrols*.06-this.justiceSystem.corruption*.004;if(!discovered)return;
    b.suspendedDays=2+Math.floor(Math.random()*6);b.inspections=(b.inspections||0)+1;this.justiceSystem.raids++;this.justiceSystem.illegalVenuesDiscovered++;
    const owner=this.people.find(p=>p.id===b.ownerId);if(owner){owner.justice.fines+=3500;owner.justice.history.unshift({week:this.week,text:`Autuado por atividade clandestina em ${b.name}.`});}
    this.log("operação policial", `${b.name} foi interditado após descoberta de ${b.illegalActivity}.`, "civic");
  }
  processEvidenceLab() {
    this.justiceSystem.evidenceLab.queue.slice(0, this.justiceSystem.evidenceLab.capacity).forEach((item) => {
      item.daysRemaining--;
      if (item.daysRemaining > 0) return;
      const crime = this.justiceSystem.openCases.find((c) => c.id === item.caseId);
      if (crime) { item.status = "laudo concluído"; crime.evidenceStrength += item.strength; crime.timeline.unshift({ week: this.week, day: this.day, text: `Perícia concluiu análise de ${item.type}.` }); }
      this.justiceSystem.evidenceLab.queue = this.justiceSystem.evidenceLab.queue.filter((x) => x.id !== item.id); this.justiceSystem.evidenceLab.processed++;
    });
  }
  investigateCasesAdvanced() {
    const officers = this.people.filter((p) => p.alive && p.role === "Policial"), detectives = Math.max(2, Math.floor(officers.length * .35)), capacity = Math.max(2, officers.length + detectives * 2);
    this.justiceSystem.openCases.filter((c) => !["encaminhado ao tribunal", "condenado", "arquivado", "absolvido"].includes(c.status)).sort((a, b) => b.priority - a.priority).slice(0, capacity).forEach((c) => {
      const offense = offenses.find((o) => o.id === c.offenseId), officer = officers.find((p) => p.id === c.assignedOfficerId) || officers[(Number(c.id.replace(/\D/g, "")) || 0) % Math.max(1, officers.length)];
      if (!c.assignedOfficerId) { c.assignedOfficerId = officer?.id || null; c.status = "preservação do local"; c.progress += 12; c.timeline.unshift({ week: this.week, day: this.day, text: `${officer?.name || "Equipe policial"} assumiu a ocorrência.` }); }
      const corruptionChance = offense.id === "corruption" ? .035 : .004;
      if (Math.random() < corruptionChance + this.justiceSystem.corruption * .0002) { c.status = "arquivado"; c.timeline.unshift({ week: this.week, day: this.day, text: "Caso arquivado irregularmente." }); this.justiceSystem.corruption++; return; }
      c.status = "em investigação"; c.progress = clamp(c.progress + 6 + detectives * .5 + c.witnesses * .8, 0, 100);
      if (Math.random() < .36 && c.evidence.length < 6) {
        const type = pick(["impressões digitais", "imagem de câmera", "material biológico", "registro telefônico", "objeto apreendido", "depoimento testemunhal"]), forensic = ["impressões digitais", "material biológico", "objeto apreendido"].includes(type), evidence = { id: uid("evidence"), type, forensic, status: forensic ? "aguardando perícia" : "validada", strength: 7 + Math.floor(Math.random() * 14) };
        c.evidence.push(evidence); if (forensic) this.justiceSystem.evidenceLab.queue.push({ ...evidence, caseId: c.id, daysRemaining: 1 + Math.floor(Math.random() * 3) }); else c.evidenceStrength += evidence.strength;
      }
      if (!c.suspectId && c.progress >= 32 && Math.random() < .45 + c.evidenceStrength * .006) { c.suspectId = c.perpetratorId; c.status = "suspeito identificado"; c.timeline.unshift({ week: this.week, day: this.day, text: "Suspeito identificado por cruzamento de indícios." }); }
      if (c.suspectId && !c.warrantId && c.evidenceStrength >= 22) { const warrant = { id: uid("warrant"), caseId: c.id, personId: c.suspectId, type: offense.severity === "leve" ? "intimação" : "prisão preventiva", status: "cumprido", week: this.week }; c.warrantId = warrant.id; this.justiceSystem.warrants.unshift(warrant); const suspect = this.people.find((p) => p.id === c.suspectId); suspect.justice.warrants.push(warrant.id); suspect.justice.arrests++; this.justiceSystem.arrests++; }
      if (c.suspectId && c.progress >= 72 && c.evidenceStrength >= 26) {
        c.status = "encaminhado ao tribunal"; const court = { id: uid("trial"), caseId: c.id, defendantId: c.suspectId, offenseId: c.offenseId, daysRemaining: 2 + Math.floor(Math.random() * 5), status: "audiência marcada", evidenceStrength: c.evidenceStrength, hearings: 0 };
        this.justiceSystem.courtQueue.push(court); if (["grave", "gravíssimo"].includes(offense.severity)) this.detainPretrial(this.people.find((p) => p.id === c.suspectId));
      } else if (c.progress >= 100 && c.evidenceStrength < 18) { c.status = "arquivado por falta de provas"; this.justiceSystem.closedCases.unshift(c); }
    });
  }
  nextPrisonCell(wingId, { pretrial = false, excludePersonId = null } = {}) {
    const prefix = pretrial ? "P" : wingId === "minimum" ? "B" : wingId === "medium" ? "M" : "A";
    const used = new Set(
      this.justiceSystem.prisoners
        .filter((id) => id !== excludePersonId)
        .map((id) => this.people.find((person) => person.id === id)?.justice?.cell)
        .filter(Boolean),
    );
    let number = 1;
    while (used.has(`${prefix}-${String(number).padStart(2, "0")}`)) number++;
    return `${prefix}-${String(number).padStart(2, "0")}`;
  }
  assignPrisonPlacement(person, wingId, { pretrial = false } = {}) {
    const wing = this.justiceSystem.prisonWings.find((candidate) => candidate.id === wingId);
    if (!person || !wing) return null;
    this.justiceSystem.prisonWings.forEach(
      (candidate) => (candidate.inmates = candidate.inmates.filter((id) => id !== person.id)),
    );
    person.justice.securityLevel = pretrial ? "provisório" : wing.id;
    person.justice.prisonWing = wing.id;
    person.justice.cell = this.nextPrisonCell(wing.id, { pretrial, excludePersonId: person.id });
    wing.inmates.push(person.id);
    return wing;
  }
  detainPretrial(p) {
    if (!p || p.justice.incarcerated) return;
    p.justice.incarcerated = true; p.justice.pretrial = true; p.role = "Preso provisório"; p.workplace = "Presídio Municipal"; p.activity = "Aguardando julgamento"; p.shift = null;
    this.placePersonAt(p,"Presídio Municipal");
    if (!this.justiceSystem.prisoners.includes(p.id)) this.justiceSystem.prisoners.push(p.id);
    this.assignPrisonPlacement(p, "minimum", { pretrial: true });
    p.routine = buildRoutine(p);
    this.justiceSystem.overcrowding = Math.max(0, this.justiceSystem.prisoners.length - this.justiceSystem.prisonCapacity);
    this.recordCharacterMemory(p, { kind:"prisão", summary:"Foi detido provisoriamente e passou a aguardar julgamento no Presídio Municipal.", placeId:p.locationId, valence:-86, importance:88, stressImpact:22, core:true, tags:["prisão","justiça","incerteza"] });
  }
  processCourtCases() {
    this.justiceSystem.courtQueue.filter((t) => !["condenado", "absolvido", "arquivado"].includes(t.status)).forEach((trial) => {
      trial.daysRemaining--; if (trial.daysRemaining > 0) return; trial.hearings++;
      const crime = this.justiceSystem.openCases.find((c) => c.id === trial.caseId), defendant = this.people.find((p) => p.id === trial.defendantId), offense = offenses.find((o) => o.id === trial.offenseId);if(!crime||!defendant||!offense){trial.status="arquivado";return;}const probability = clamp(.18 + trial.evidenceStrength / 85 + (crime.witnesses || 0) * .035, .12, .96);
      if (Math.random() < probability) { trial.status = "condenado"; crime.status = "condenado"; this.justiceSystem.convictions++; this.convict(defendant, offense); }
      else { trial.status = "absolvido"; crime.status = "absolvido"; defendant.justice.acquittals++; defendant.justice.pretrial = false; this.justiceSystem.acquittals++; if (defendant.justice.incarcerated) this.releasePrisoner(defendant, false); defendant.justice.history.unshift({ week: this.week, text: `Absolvido da acusação de ${offense.name}.` }); }
      this.justiceSystem.closedCases.unshift(crime); this.justiceSystem.solved++;
    });
  }
  investigateCases() {
    const police =
      this.people.filter((p) => p.alive && p.role === "Policial").length || 2;
    const capacity = police * this.justiceSystem.patrols;
    this.justiceSystem.openCases
      .filter((c) => ["reported", "investigating"].includes(c.status))
      .slice(0, capacity)
      .forEach((c) => {
        const suspect = this.people.find((p) => p.id === c.suspectId),
          offense = offenses.find((o) => o.id === c.offenseId);
        const corruptionChance = offense.id === "corruption" ? 0.18 : 0.015;
        if (Math.random() < corruptionChance) {
          c.status = "archived";
          this.justiceSystem.corruption++;
          return;
        }
        if (Math.random() < 0.58 + police * 0.025) {
          c.status = "solved";
          this.justiceSystem.solved++;
          this.convict(suspect, offense);
        } else c.status = "investigating";
      });
  }
  convict(p, offense) {
    p.justice.convictions++;
    p.justice.fines += offense.fine;
    p.justice.recordPoints +=
      offense.severity === "grave" ? 5 : offense.severity === "médio" ? 3 : 1;
    p.justice.lastConvictionWeek = this.week;
    p.justice.recordStatus =
      p.justice.recordPoints >= 5 ? "ficha grave" : "com antecedentes";
    const paid = Math.min(Math.max(0, p.money), offense.fine);
    p.money -= paid;
    this.justiceSystem.finesCollected += paid;
    this.money += paid;
    p.justice.history.unshift({
      week: this.week,
      text: `Condenado por ${offense.name}: multa de R$ ${offense.fine.toLocaleString("pt-BR")}${offense.sentence ? ` e ${offense.sentence} dias de prisão` : ""}.`,
    });
    this.recordCharacterMemory(p, { kind:"condenação", summary:`Foi condenado por ${offense.name}${offense.sentence ? ` e recebeu pena de ${offense.sentence} dias` : ""}.`, valence:-82, importance:86, stressImpact:18, core:offense.sentence>30, tags:["justiça","condenação"] });
    if (
      offense.sentence &&
      (p.justice.incarcerated || this.justiceSystem.prisoners.length < this.justiceSystem.prisonCapacity)
    )
      this.imprison(p, offense.sentence);
    this.log(
      "justiça",
      `${p.name} recebeu condenação por ${offense.name}.`,
      "civic",
    );
  }
  imprison(p, days) {
    if (!p?.alive || !days) return false;
    if (p.justice.incarcerated && p.justice.pretrial) {
      p.justice.pretrial = false; p.justice.sentenceRemaining = days; p.justice.totalSentence = days; p.justice.served = 0; p.justice.rehabilitation = 10; p.role = "Detento"; p.activity = "Cumprindo pena";
      const level = days >= 150 ? "maximum" : days >= 45 ? "medium" : "minimum"; this.assignPrisonPlacement(p, level); if (!this.justiceSystem.prisoners.includes(p.id)) this.justiceSystem.prisoners.push(p.id); return true;
    }
    if (p.justice.incarcerated) {
      p.justice.sentenceRemaining = Math.max(0, p.justice.sentenceRemaining || 0) + days;
      p.justice.totalSentence = Math.max(p.justice.served || 0, p.justice.totalSentence || 0) + days;
      if (!this.justiceSystem.prisoners.includes(p.id)) this.justiceSystem.prisoners.push(p.id);
      const level = p.justice.totalSentence >= 150 ? "maximum" : p.justice.totalSentence >= 45 ? "medium" : "minimum";
      const wing = this.justiceSystem.prisonWings.find((candidate) => candidate.id === p.justice.prisonWing);
      if (!wing || !p.justice.cell || wing.id !== level) this.assignPrisonPlacement(p, level);
      else if (!wing.inmates.includes(p.id)) wing.inmates.push(p.id);
      p.justice.history.unshift({ week: this.week, text: `Nova pena de ${days} dias somada ao período em cumprimento.` });
      return true;
    }
    const employer = this.businessOf(p);
    p.justice.previousJob = p.shift
      ? { role: p.role, workplace: p.workplace, businessId: p.businessId }
      : null;
    if (employer)
      employer.employees = employer.employees.filter((id) => id !== p.id);
    p.justice.incarcerated = true;
    p.justice.sentenceRemaining = days;
    p.justice.totalSentence = days;
    p.justice.served = 0;
    p.justice.rehabilitation = 10;
    p.justice.disciplinary = 0;
    p.justice.prisonJob = null;
    p.justice.parole = false;
    p.justice.arrests++;
    if (!this.justiceSystem.prisoners.includes(p.id)) this.justiceSystem.prisoners.push(p.id);
    p.role = "Detento";
    p.workplace = "Presídio Municipal";
    p.shift = null;
    p.routine = buildRoutine(p);
    p.activity = "Cumprindo pena";
    p.target = null;
    this.placePersonAt(p,"Presídio Municipal");
    const level = days >= 150 ? "maximum" : days >= 45 ? "medium" : "minimum";
    this.assignPrisonPlacement(p, level);
    this.justiceSystem.overcrowding = Math.max(0, this.justiceSystem.prisoners.length - this.justiceSystem.prisonCapacity);
    this.recordCharacterMemory(p, { kind:"prisão", summary:`Entrou no Presídio Municipal para cumprir uma pena de ${days} dias.`, placeId:p.locationId, valence:-88, importance:90, stressImpact:24, core:true, tags:["prisão","justiça"] });
    return true;
  }
  releasePrisoner(p, parole = false) {
    p.justice.incarcerated = false;
    p.justice.sentenceRemaining = parole ? p.justice.sentenceRemaining : 0;
    this.justiceSystem.prisoners = this.justiceSystem.prisoners.filter(
      (id) => id !== p.id,
    );
    this.justiceSystem.prisonWings.forEach((w) => (w.inmates = w.inmates.filter((id) => id !== p.id)));
    p.justice.prisonWing = null; p.justice.securityLevel = null; p.justice.cell = null;
    if (p.justice.rehabilitation > 75) this.justiceSystem.rehabilitated++;
    p.role = "Desempregado";
    p.workplace = "—";
    p.routine = buildRoutine(p);
    this.placePersonAt(p,p.homeId);
    p.justice.history.unshift({
      week: this.week,
      text: parole
        ? "Recebeu liberdade condicional."
        : "Cumpriu a pena e foi libertado.",
    });
    this.log(
      "libertação",
      `${p.name} deixou o Presídio Municipal${parole ? " em liberdade condicional" : " após cumprir pena"}.`,
      "social",
    );
    this.recordCharacterMemory(p, { kind:"libertação", summary:parole?"Deixou o presídio em liberdade condicional.":"Cumpriu a pena e deixou o presídio.", placeId:p.homeId, valence:72, importance:82, novelty:72, core:true, tags:["libertação","recomeço","justiça"] });
  }
  weeklyJustice() {
    this.weeklyUnderground();
    this.justiceSystem.overcrowding = Math.max(0, this.justiceSystem.prisoners.length - this.justiceSystem.prisonCapacity);
    this.justiceSystem.districtCrime={};this.city.districts.forEach(d=>{const cases=this.justiceSystem.openCases.filter(c=>this.buildings.find(b=>b.id===c.locationId)?.districtId===d.id&&!["arquivado","absolvido"].includes(c.status));this.justiceSystem.districtCrime[d.id]={reported:cases.length,violent:cases.filter(c=>offenses.find(o=>o.id===c.offenseId)?.violence>.3).length,solved:cases.filter(c=>["condenado","encaminhado ao tribunal"].includes(c.status)).length};});
    this.justiceSystem.victimSupport.forEach(s=>{const victim=this.people.find(p=>p.id===s.personId);if(!victim?.alive)return;if(s.psychologicalSupport){victim.medical.mentalHealth=clamp(victim.medical.mentalHealth+1.5,0,100);s.status="acompanhamento psicossocial";}const crime=this.justiceSystem.openCases.find(c=>c.id===s.caseId);if(crime?.status==="condenado"&&s.compensation===0){s.compensation=500+Math.round((offenses.find(o=>o.id===crime.offenseId)?.fine||0)*.15);victim.money+=s.compensation;s.status="indenização concedida";}});
    this.justiceSystem.prisoners.forEach((id) => { const p = this.people.find((x) => x.id === id); if (!p?.alive) return; const visitors = this.relativesOf(p).filter((r) => r.alive).length; if (visitors && Math.random() < .58) { p.justice.familyVisits++; p.happiness = clamp(p.happiness + 3, 0, 100); p.justice.history.unshift({ week: this.week, text: "Recebeu visita familiar no presídio." }); } });
    this.people
      .filter((p) => p.alive && !p.justice.incarcerated)
      .forEach((p) => {
        const j = p.justice;
        if (
          j.recordPoints > 0 &&
          this.week - (j.lastConvictionWeek || 0) >= 52 &&
          this.week % 26 === 0
        ) {
          j.recordPoints = Math.max(0, j.recordPoints - 1);
          j.recordStatus =
            j.recordPoints === 0
              ? "limpa"
              : j.recordPoints >= 5
                ? "ficha grave"
                : "com antecedentes";
        }
        if (p.role === "Desempregado" && !j.parole) {
          const chance = Math.max(0.015, 0.2 - j.recordPoints * 0.025);
          if (Math.random() < chance) {
            const business = this.businesses
              .slice()
              .sort((a, b) => a.employees.length - b.employees.length)[0];
            p.role = j.recordPoints >= 5 ? "Auxiliar operacional" : "Assistente";
            p.workplace = business.name;
            p.businessId = business.id;
            p.shift = structuredClone(
              shiftTemplates[
                Number(p.id.replace(/\D/g, "")) % shiftTemplates.length
              ],
            );
            p.hourlyWage = Math.max(12, 20 - j.recordPoints);
            p.contract = "CLT";
            business.employees.push(p.id);
            p.history.push({
              week: this.week,
              text: `Foi contratado por ${business.name}${j.recordPoints ? " apesar dos antecedentes" : ""}.`,
            });
            this.recordCharacterMemory(p, {
              kind: "trabalho",
              summary: `Foi contratado por ${business.name}${j.recordPoints ? " e recomeçou apesar dos antecedentes" : ""}.`,
              placeId: business.buildingId,
              valence: 68,
              importance: 72,
              novelty: 62,
              tags: ["trabalho", "contratação", "recomeço"],
            });
          }
        }
      });
    const activeTrials=this.justiceSystem.courtQueue.filter(t=>!["condenado","absolvido","arquivado"].includes(t.status)),activeCourtCases=new Set(activeTrials.map(t=>t.caseId)),completedTrials=this.justiceSystem.courtQueue.filter(t=>["condenado","absolvido","arquivado"].includes(t.status)).slice(-240);this.justiceSystem.courtQueue=[...completedTrials,...activeTrials];this.justiceSystem.closedCases=this.justiceSystem.closedCases.slice(0,320);this.justiceSystem.openCases=this.justiceSystem.openCases.filter(c=>activeCourtCases.has(c.id)||!["condenado","absolvido","arquivado","arquivado por falta de provas"].includes(c.status)||this.week-(c.week||this.week)<52).slice(-500);this.justiceSystem.emergencyCalls=this.justiceSystem.emergencyCalls.slice(0,120);this.justiceSystem.victimSupport=this.justiceSystem.victimSupport.slice(0,240);this.justiceSystem.warrants=this.justiceSystem.warrants.slice(0,320);
  }
  createTransportSystem() {
    this.transportSystem = {
      routes: structuredClone(transitRoutes),
      fleet: [],
      dailyRiders: 0,
      totalRiders: 0,
      revenue: 0,
      traffic: 0,
      streetLoad: {},
      congestionIndex: 0,
      vehicleMarket: [],
      stolen: [],
      recovered: 0,
      scrapped: 0,
      breakdowns: 0,
      maintenanceCost: 0,
      averageWait: 0,
    };
    this.transportSystem.routes.forEach((route, i) => {
      route.frequency = 12 + i * 3;
      route.serviceStart = 5;
      route.serviceEnd = 24;
      route.waiting = 0;
      route.punctuality = 88;
      route.completedTrips = 0;
    });
    const adults = this.people.filter((p) => p.age >= 18 && p.alive);
    adults.forEach((p, i) => {
      p.mobility.license = p.age >= 20 && i % 5 !== 0;
      if (p.mobility.license && i % 3 === 0) {
        const spec = vehicleModels[i % vehicleModels.length];
        const v = this.createVehicle(spec, p.id, "private");
        p.mobility.vehicleIds.push(v.id);
        p.mobility.preferred = "carro";
      } else
        p.mobility.preferred =
          i % 3 === 0 ? "ônibus" : i % 2 === 0 ? "bicicleta" : "a pé";
    });
    this.transportSystem.routes.forEach((route, i) => {
      const drivers = adults
        .filter((p) => p.shift && !p.education.enrolled && !p.lifeCourse?.retirement?.active && !p.localGovernmentAssignment && !p.politicalOffice && p.contract !== "Serviço público" && !["Motorista de transporte público", "Taxista"].includes(p.role))
        .slice(i * 3, i * 3 + 3);
      drivers.forEach((p) => {
        const employer = this.businessOf(p);
        if (employer) employer.employees = employer.employees.filter((id) => id !== p.id);
        p.role = "Motorista de transporte público";
        p.workplace = "Terminal Municipal";
        p.businessId = null;
        p.contract = "Empresa municipal de transporte";
        p.hourlyWage = 29;
        p.shift = { name: "Escala de transporte público", start: 5 + (i % 2) * 7, end: 13 + (i % 2) * 7, days: [0, 1, 2, 3, 4, 5], hours: 42 };
        p.routine = buildRoutine(p);
      });
      const spec = {
        model: `Ônibus Urbano ${i + 1}`,
        type: "ônibus",
        price: 380000,
        seats: 42,
        efficiency: 3,
      };
      for (let unit = 0; unit < 2; unit++) {
        const bus = this.createVehicle(
          { ...spec, model: `${spec.model}-${unit + 1}` },
          "municipality",
          "public",
        );
        bus.routeId = route.id;
        bus.x = route.stops[unit][0];
        bus.y = route.stops[unit][1];
        bus.stopIndex = unit + 1;
        bus.occupancy = 0;
        this.transportSystem.fleet.push(bus.id);
      }
    });
    this.createTaxiTransportSystem();
  }
  createTaxiTransportSystem() {
    const central = this.buildings.find((building) => building.name === "Central Táxi Vila"), terminal = this.buildings.find((building) => building.name === "Terminal Municipal");
    this.taxiSystem = createTaxiSystem({
      stands: [
        { id: "taxi-stand-central", name: "Ponto Central", x: central?.x || 13, y: central?.y || 11, capacity: 5 },
        { id: "taxi-stand-terminal", name: "Ponto do Terminal", x: terminal?.x || 19, y: terminal?.y || 21, capacity: 4 },
      ],
    });
    const taxiBusiness = this.businesses.find((business) => business.name === "Central Táxi Vila");
    const candidates = [
      ...(taxiBusiness?.employees || []).map((id) => this.people.find((person) => person.id === id)),
      ...this.people.filter((person) => person.alive && person.age >= 21 && person.mobility.license && !person.lifeCourse?.retirement?.active && !person.localGovernmentAssignment && !person.politicalOffice && person.contract !== "Serviço público"),
    ].filter((person, index, all) => person && all.findIndex((candidate) => candidate.id === person.id) === index).slice(0, 6);
    candidates.forEach((driver, index) => {
      const former = this.businessOf(driver);
      if (former && former.id !== taxiBusiness?.id) former.employees = former.employees.filter((id) => id !== driver.id);
      driver.role = "Taxista";
      driver.workplace = "Central Táxi Vila";
      driver.businessId = taxiBusiness?.id || null;
      driver.contract = index % 3 === 0 ? "Taxista permissionário" : "Cooperado";
      driver.hourlyWage = 27;
      driver.shift = index % 2
        ? { name: "Táxi noturno", start: 16, end: 2, days: [1, 2, 3, 4, 5, 6], hours: 44 }
        : { name: "Táxi diurno", start: 6, end: 16, days: [0, 1, 2, 3, 4, 5], hours: 44 };
      if (taxiBusiness && !taxiBusiness.employees.includes(driver.id)) taxiBusiness.employees.push(driver.id);
      const company = this.taxiSystem.companies[index % this.taxiSystem.companies.length], stand = this.taxiSystem.stands[index % this.taxiSystem.stands.length];
      const vehicle = this.createVehicle({ model: index % 2 ? "Sedan Táxi Esperança" : "Táxi Vila Híbrido", type: "táxi", price: 108000, seats: 4, efficiency: index % 2 ? 11 : 17 }, company.id, "taxi");
      vehicle.driverId = driver.id;
      vehicle.companyId = company.id;
      vehicle.x = stand.x + index * .08;
      vehicle.y = stand.y + index * .08;
      company.driverIds.push(driver.id);
      company.vehicleIds.push(vehicle.id);
      driver.taxiVehicleId = vehicle.id;
      driver.routine = buildRoutine(driver);
    });
    this.taxiSummary = summarizeTaxiSystem(this.taxiSystem);
  }
  createFuneralFleet() {
    if (this.funeralSystem.hearseIds.length) return;
    const hearse = this.createVehicle({ model: "Serenidade Fúnebre", type: "carro funerário", price: 118000, seats: 3, efficiency: 8 }, "municipality", "funeral"), building = this.buildings.find((b) => b.name === "Funerária Serenidade");
    hearse.x = building?.x || 0; hearse.y = building?.y || 0;
    this.funeralSystem.hearseIds.push(hearse.id);
  }
  createVehicle(spec, ownerId, use) {
    const year = 2014 + Math.floor(Math.random() * 13),
      vehicle = {
        id: uid("veh"),
        plate: `CV${String(1000 + this.vehicles.length).slice(-4)}`,
        model: spec.model,
        type: spec.type,
        year,
        value: Math.round(spec.price * (0.58 + (year - 2014) * 0.035)),
        seats: spec.seats,
        efficiency: spec.efficiency,
        ownerId,
        use,
        x: 0,
        y: 0,
        status: "active",
        fuel: 45 + Math.random() * 15,
        fuelCapacity: use === "public" ? 180 : use === "delivery" ? 120 : 55,
        condition: 65 + Math.floor(Math.random() * 35),
        mileage: Math.floor(Math.random() * 180000),
        maintenanceDue: false,
        record: emptyVehicleRecord(),
      };
    this.vehicles.push(vehicle);
    return vehicle;
  }
  createMarketsSystem(){this.markets=initializeMarkets(this,null,{seedListings:true,vehicleListings:8,propertyListings:12});vehicleMarketCatalog.slice(0,13).forEach((spec,index)=>{const dealer=this.markets.vehicle.dealerships[index%this.markets.vehicle.dealerships.length],vehicle=this.createVehicle(spec,dealer.id,"dealership");vehicle.status="inventory";vehicle.originalPrice=spec.price;dealer.inventoryIds.push(vehicle.id);createVehicleListing(this,this.markets,vehicle.id,{sellerId:dealer.id,dealershipId:dealer.id,kind:index%5===4?"lease":"sale",price:Math.round(spec.price*(1+dealer.markup))});});}
  realEstateDynamicsSnapshot() {
    const districts = new Map(this.city.districts.map((district) => [district.id, district]));
    const lots = this.city.lots.map((lot) => {
      const district = districts.get(lot.district), infrastructure = lot.infrastructure || {};
      const released = ["urbanized", "serviced", "ready"].includes(lot.status || "urbanized");
      const districtReleased = !district?.status || district.status === "active";
      const serviced = (lot.serviceLevel || 0) >= 55 || Boolean(infrastructure.roadAccess && infrastructure.water && infrastructure.power);
      return { ...lot, developmentEligible: !lot.occupied && !lot.reservedForDevelopment && released && districtReleased && serviced };
    });
    return {
      week: this.week,
      people: this.people,
      families: this.families,
      buildings: this.buildings,
      businesses: this.businesses,
      city: { ...this.city, lots },
      environment: this.environment,
      urbanEvolution: this.urbanEvolution,
      markets: this.markets,
    };
  }
  createRealEstateDynamicsSystem() {
    this.realEstateDynamics = createRealEstateDynamics(this.realEstateDynamicsSnapshot(), {
      week: this.week,
      seedListings: true,
      autoListings: true,
    });
    this.realEstateSummary = summarizeRealEstateDynamics(this.realEstateDynamics);
    this.syncRealEstateValuations();
  }
  syncRealEstateValuations() {
    (this.realEstateDynamics?.properties || []).forEach((property) => {
      const building = this.buildings.find((candidate) => candidate.id === property.buildingId);
      if (!building) return;
      building.propertyTypeId = property.typeId;
      building.propertyLabel = property.valuation?.typeLabel;
      building.value = Math.max(1, Math.round(property.currentValue || building.value || 1));
      building.rent = Math.max(0, Math.round(property.estimatedRent || building.rent || 0));
      building.marketValuation = {
        week: this.week,
        sale: building.value,
        rent: building.rent,
        pricePerSquareMeter: property.valuation?.pricePerSquareMeter || 0,
        demandPressure: property.valuation?.demandPressure || 1,
        factors: property.valuation?.factors || [],
      };
      building.units = property.units;
      building.lotArea = property.lotArea;
      building.amenities = property.amenities;
    });
  }
  applyRealEstateEffect(effect) {
    const lot = this.city.lots.find((candidate) => candidate.id === effect.lotId);
    const project = this.realEstateDynamics.projects.find((candidate) => candidate.id === effect.projectId);
    if (!lot || !project) return;
    lot.developmentProjectId = project.id;
    if (effect.type === "subdivide_lot") {
      lot.status = "subdivided";
      lot.plannedParcels = effect.parcels;
      this.log("expansão urbana", `${project.name} concluiu o parcelamento do terreno em ${effect.parcelCount} lote(s) de tamanhos variados.`, "civic", { cause: "demanda imobiliária e aprovação do loteamento", consequences: ["novas unidades em preparação", "infraestrutura ainda obrigatória"], placeIds: [], priority: "normal" });
      return;
    }
    if (effect.type === "connect_infrastructure") {
      lot.status = "serviced";
      lot.serviceLevel = 92;
      lot.infrastructure = { ...(lot.infrastructure || {}), water: true, sewer: true, power: true };
      return;
    }
    if (effect.type === "pave_access") {
      lot.status = "ready";
      lot.accessPaved = true;
      lot.infrastructure = { ...(lot.infrastructure || {}), roadAccess: true, paved: true };
      return;
    }
    if (effect.type === "create_building") {
      if (this.buildings.some((building) => building.developmentProjectId === project.id)) return;
      const propertyIds = project.createdPropertyIds.length ? project.createdPropertyIds : [`development-building:${project.id}`];
      const count = propertyIds.length;
      const splitHorizontal = lot.w >= lot.h;
      const gap = .1;
      const span = (splitHorizontal ? lot.w : lot.h) - gap * Math.max(0, count - 1);
      const segment = span / count;
      const type = ["comercial", "misto"].includes(effect.propertyTypeId) ? "shop" : "home";
      propertyIds.forEach((propertyId, index) => {
        const x = splitHorizontal ? lot.x + index * (segment + gap) : lot.x;
        const y = splitHorizontal ? lot.y : lot.y + index * (segment + gap);
        const w = splitHorizontal ? segment : lot.w;
        const h = splitHorizontal ? lot.h : segment;
        const childLotId = effect.parcels?.[index]?.id || `${lot.id}:unit:${index + 1}`;
        let childLot = this.city.lots.find((candidate) => candidate.id === childLotId);
        if (!childLot) {
          childLot = {
            id: childLotId,
            parentLotId: lot.id,
            x,
            y,
            w,
            h,
            area: effect.parcels?.[index]?.area || Math.round((lot.area || lot.w * lot.h * 100) / count),
            frontage: effect.parcels?.[index]?.frontage || Math.round((splitHorizontal ? w : h) * 10) / 10,
            depth: effect.parcels?.[index]?.depth || Math.round((splitHorizontal ? h : w) * 10) / 10,
            zone: lot.zone,
            district: lot.district,
            status: "construction",
            occupied: true,
            developmentProjectId: project.id,
          };
          this.city.lots.push(childLot);
        }
        const label = effect.propertyTypeId === "predio_residencial" ? "Edifício" : effect.propertyTypeId === "apartamento" ? "Residencial" : effect.propertyTypeId === "condominio_fechado" ? "Condomínio" : type === "shop" ? "Centro comercial" : "Casa";
        const building = {
          id: propertyId,
          name: `${label} ${project.name}${count > 1 ? ` · ${index + 1}` : ""}`,
          type,
          x: x + .1,
          y: y + .1,
          w: Math.max(.25, w - .2),
          h: Math.max(.25, h - .2),
          capacity: Math.max(1, Math.round(effect.capacity / count)),
          occupied: 0,
          value: Math.round(project.projectedValue / count),
          districtId: lot.district,
          lotId: childLot.id,
          lotArea: childLot.area,
          propertyTypeId: effect.propertyTypeId,
          units: Math.max(1, Math.round(effect.units / count)),
          floors: effect.propertyTypeId === "predio_residencial" ? Math.max(3, Math.ceil(effect.units / 3)) : effect.propertyTypeId === "apartamento" ? 2 : 1,
          developmentProjectId: project.id,
          occupancyPermit: false,
          meter: emptyMeter(),
        };
        building.address = addressFor(building, this.buildings.length, this.city);
        this.ensurePhysicalSpaces(building);
        this.buildings.push(building);
      });
      lot.occupied = true;
      lot.status = "construction";
      return;
    }
    if (effect.type === "open_for_occupation") {
      const delivered = this.buildings.filter((building) => building.developmentProjectId === project.id);
      delivered.forEach((building) => {
        building.occupancyPermit = true;
        building.tenure ||= "rent";
        building.rent ||= Math.max(620, Math.round((building.value || project.projectedValue / Math.max(1, delivered.length)) * .0052 / Math.max(1, building.units || 1)));
      });
      this.city.lots.filter((candidate) => candidate.developmentProjectId === project.id).forEach((candidate) => candidate.status = "developed");
      lot.status = "developed";
      lot.occupied = true;
      delivered.filter((building) => building.type === "home").forEach((home) => {
        const assigned = this.assignTemporaryResidents(home);
        if (!assigned && home.occupied < home.capacity) this.createHousingListing(home, (home.units || 1) > 1 ? "rent" : "sale");
      });
      this.syncHousingOccupancy();
      this.log("moradia", `${project.name} recebeu habite-se e entregou ${project.units} unidade(s) após loteamento, redes, pavimentação e construção.`, "civic", { cause: "conclusão das cinco etapas urbanísticas", consequences: ["novas moradias disponíveis", "maior capacidade do bairro"], priority: "destaque" });
    }
  }
  weeklyRealEstateDynamics() {
    const projectsStartedBefore = this.realEstateDynamics?.stats?.projectsStarted || 0;
    const allowPrivateDevelopment = this.cityDevelopment?.lastPlan?.allowPrivateDevelopment === true;
    const result = runRealEstateDynamicsWeek(this.realEstateDynamics, this.realEstateDynamicsSnapshot(), {
      week: this.week,
      autoTransactions: false,
      autoListings: true,
      autoProjects: allowPrivateDevelopment,
      maximumActiveProjects: this.people.filter((person) => person.alive).length >= 450 ? 2 : 1,
      minimumProjectPressure: 1.08,
    });
    this.realEstateDynamics = result.state;
    this.realEstateSummary = result.summary;
    if ((result.state.stats?.projectsStarted || 0) > projectsStartedBefore && this.cityDevelopment?.planning) this.cityDevelopment.planning.lastPrivateDevelopmentWeek = this.week;
    result.state.projects.filter((project) => project.status === "active").forEach((project) => {
      const lot = this.city.lots.find((candidate) => candidate.id === project.lotId);
      if (lot) {
        lot.reservedForDevelopment = project.id;
        if (lot.status === "urbanized") lot.status = "reserved";
      }
    });
    result.effects.forEach((effect) => this.applyRealEstateEffect(effect));
    result.events.filter((event) => ["development_started", "development_phase", "development_completed"].includes(event.kind)).forEach((event) => {
      if (event.kind === "development_started") this.log("mercado imobiliário", event.text, "money", { cause: "pressão de procura por tipo e bairro", consequences: ["investimento privado", "obra por fases", "novas ofertas futuras"], priority: "normal" });
    });
    this.syncRealEstateValuations();
  }
  weeklyMarkets(){
    this.markets=tickMarkets(this,this.markets,{weeks:1,hooks:{createBusinessBranch:({business})=>this.createBusinessBranchFromMarket(business),onBusinessRelocated:({business})=>this.log("negócios",`${business.name} concluiu sua mudança de endereço.`,"money")}});
    const activeVehicles=this.markets.vehicle.listings.filter(l=>l.status==="active").length,activeProperties=this.markets.realEstate.listings.filter(l=>l.status==="active").length;if(activeVehicles<6||activeProperties<3)seedMarketListings(this,this.markets,{vehicleListings:Math.max(0,9-activeVehicles),propertyListings:Math.max(0,8-activeProperties)});
    const vehicleShortfall=Math.max(0,6-this.markets.vehicle.listings.filter(l=>l.status==="active").length);for(let n=0;n<vehicleShortfall;n++){const spec=vehicleMarketCatalog[(this.week+n)%vehicleMarketCatalog.length],dealer=this.markets.vehicle.dealerships[(this.week+n)%this.markets.vehicle.dealerships.length],vehicle=this.createVehicle(spec,dealer.id,"dealership");vehicle.status="inventory";vehicle.originalPrice=spec.price;dealer.inventoryIds.push(vehicle.id);createVehicleListing(this,this.markets,vehicle.id,{sellerId:dealer.id,dealershipId:dealer.id,kind:n===vehicleShortfall-1&&n>0?"rental":"sale",price:Math.round(spec.price*(1+dealer.markup))});}
    if(!this.markets.vehicle.listings.some(l=>l.status==="active"&&["rental","lease"].includes(l.kind))){const spec=vehicleMarketCatalog[(this.week+3)%vehicleMarketCatalog.length],dealer=this.markets.vehicle.dealerships.find(d=>d.rental)||this.markets.vehicle.dealerships.at(-1),vehicle=this.createVehicle(spec,dealer.id,"dealership");vehicle.status="inventory";vehicle.originalPrice=spec.price;dealer.inventoryIds.push(vehicle.id);createVehicleListing(this,this.markets,vehicle.id,{sellerId:dealer.id,dealershipId:dealer.id,kind:"rental"});}
    const vehicleSale=this.markets.vehicle.listings.find(l=>l.status==="active"&&l.kind==="sale"),vehicleRental=this.markets.vehicle.listings.find(l=>l.status==="active"&&["rental","lease"].includes(l.kind));
    if(vehicleSale&&Math.random()<.34){const buyer=this.people.filter(p=>p.alive&&!this.isPlayerControlled(p)&&p.age>=18&&p.mobility.license&&!p.mobility.vehicleIds.length&&p.id!==vehicleSale.sellerId&&p.money>=vehicleSale.price*.1).sort((a,b)=>b.money-a.money)[0];if(buyer)this.buyVehicleListing(vehicleSale.id,buyer.id,{finance:{downPaymentRate:.1,months:48}});}
    if(vehicleRental&&Math.random()<.28){const renter=this.people.filter(p=>p.alive&&!this.isPlayerControlled(p)&&p.age>=18&&p.mobility.license&&!p.mobility.vehicleIds.length&&p.id!==vehicleRental.sellerId&&p.money>vehicleRental.deposit+vehicleRental.price*7).sort((a,b)=>b.personality?.riskTolerance-a.personality?.riskTolerance)[0];if(renter)this.rentVehicleListing(vehicleRental.id,renter.id,{durationDays:14+Math.floor(Math.random()*29)});}
    if(this.week%8===0){const listing=this.markets.realEstate.listings.find(l=>l.status==="active"&&l.kind==="sale"),buyer=this.families.filter(f=>!f.memberIds?.includes(this.playerId)&&f.id!==listing?.sellerId&&f.wealth>(listing?.price||Infinity)*.1).sort((a,b)=>b.wealth-a.wealth)[0];if(listing&&buyer)this.buyPropertyListing(listing.id,buyer.id,{finance:{downPaymentRate:.1,months:240},occupy:false});}
    const rentalHome=this.markets.realEstate.listings.find(l=>l.status==="active"&&l.kind==="rent");if(rentalHome&&Math.random()<.38){const tenant=this.families.filter(f=>!f.memberIds?.includes(this.playerId)&&f.id!==rentalHome.sellerId&&["temporary","rent"].includes(f.tenure)&&f.wealth>rentalHome.price*2).sort((a,b)=>b.arrears-a.arrears||b.wealth-a.wealth)[0];if(tenant)this.rentPropertyListing(rentalHome.id,tenant.id,{durationWeeks:52});}
    const removable=new Set();this.supplyChain?.suppliers.forEach(s=>this.vehicles.filter(v=>v.use==="delivery"&&v.ownerId===s.id&&v.status==="returned").slice(3).forEach(v=>removable.add(v.id)));if(removable.size)this.vehicles=this.vehicles.filter(v=>!removable.has(v.id));
    return this.marketSnapshot();
  }
  marketSnapshot(){return getMarketSnapshot(this,this.markets);}
  createBusinessBranchFromMarket(parent){let lot=this.city.lots.find(l=>!l.occupied&&!l.reservedForDevelopment&&["urbanized","ready"].includes(l.status||"urbanized")&&l.zone==="mixed");if(!lot){this.expandCityGrid();lot=this.city.lots.find(l=>!l.occupied&&!l.reservedForDevelopment&&["urbanized","ready"].includes(l.status||"urbanized")&&l.zone==="mixed");}if(!lot)return null;lot.occupied=true;const number=this.businesses.filter(b=>b.parentBusinessId===parent.id).length+2,building={id:uid("b"),name:`${parent.name} · Unidade ${number}`,type:"shop",x:lot.x+.12,y:lot.y+.12,w:lot.w-.24,h:lot.h-.24,capacity:parent.capacity||35,occupied:0,value:Math.round((this.buildings.find(b=>b.id===parent.buildingId)?.value||120000)*.78),districtId:lot.district,lotId:lot.id,meter:emptyMeter()};building.address=addressFor(building,this.buildings.length,this.city);this.ensurePhysicalSpaces(building);const branch={...structuredClone(parent),id:uid("biz"),buildingId:building.id,name:building.name,parentBusinessId:parent.id,cash:Math.max(18000,Math.round(parent.cash*.18)),revenue:0,expenses:0,sales:0,employees:[],presentCustomers:[],transactions:[],visits:0,collectiveInteractions:[],management:{...parent.management,decisions:[]}};Object.values(branch.products).forEach(p=>{p.stock=Math.round((p.target||50)*.65);p.supplierId||=supplierFor(Object.keys(branch.products).find(k=>branch.products[k]===p)||"").id;});building.businessId=branch.id;this.buildings.push(building);this.businesses.push(branch);this.recruitForBusiness(branch,branch.minimumStaff||2);this.log("negócios",`${parent.name} abriu a unidade ${number} em ${building.address.district}, sob controle da mesma família.`,"money");return branch;}
  listVehicleForMarket(vehicleId,options={}){return createVehicleListing(this,this.markets,vehicleId,options);}
  buyVehicleListing(listingId,buyerId,options={}){return purchaseVehicle(this,this.markets,listingId,buyerId,options);}
  rentVehicleListing(listingId,renterId,options={}){return rentVehicle(this,this.markets,listingId,renterId,options);}
  returnVehicleRental(contractId,options={}){return returnRentedVehicle(this,this.markets,contractId,options);}
  listPropertyForMarket(buildingId,options={}){return createPropertyListing(this,this.markets,buildingId,options);}
  buyPropertyListing(listingId,buyerId,options={}){return purchaseProperty(this,this.markets,listingId,buyerId,options);}
  rentPropertyListing(listingId,tenantId,options={}){return rentProperty(this,this.markets,listingId,tenantId,options);}
  decideFamilyBusiness(businessId,type,options={}){return makeFamilyBusinessDecision(this,this.markets,businessId,type,options);}
  vehicleOf(p) {
    return (p.mobility.vehicleIds || []).map((id) => this.vehicleIndex?.get(id)).find((vehicle) => vehicle?.status === "active");
  }
  chooseTransport(p, destination, options = {}) {
    const distance = Math.hypot(destination.x - p.x, destination.y - p.y);
    const car = this.vehicleOf(p);
    const taxiDistanceKm = distance * .1;
    const taxiScore = this.taxiSystem ? taxiSuitability(p, { distance: taxiDistanceKm, hour: this.minute / 60, priority: p.actionPriority || 40 }, this.environment?.current || {}) : 0;
    let mode =
      distance < 2
        ? "a pé"
        : car && car.fuel > 3 && car.condition > 18
          ? "carro"
          : taxiScore >= 48
            ? "táxi"
          : distance > 5
            ? "ônibus"
            : p.mobility.preferred;
    const requestedMode = options.mode && options.mode !== "auto" ? options.mode : null;
    if (requestedMode) {
      if (requestedMode === "carro" && car && p.mobility?.license && car.fuel > 3 && car.condition > 18) mode = "carro";
      else if (requestedMode === "táxi" && p.age >= 16) mode = "táxi";
      else if (requestedMode === "ônibus") mode = "ônibus";
      else if (requestedMode === "bicicleta") mode = "bicicleta";
      else if (requestedMode === "a pé") mode = "a pé";
    }
    const travelFactor = mode === "carro" || mode === "táxi" ? 2.4 : mode === "ônibus" ? 4.2 : mode === "bicicleta" ? 4.6 : 6.5;
    const travelBuffer = mode === "ônibus" ? 70 : mode === "táxi" ? 45 : 35;
    const now=this.absoluteMinute(),priority=p.actionPriority||40,maxTripMinutes=clamp(Math.round(distance*travelFactor+travelBuffer),70,240),travelDeadline=now+maxTripMinutes;
    p.currentTrip = { mode, distance, started: this.minute,startedAt:now,elapsedMinutes:0,maxTripMinutes,priority,deadlineAt:Math.max(p.actionDeadlineAt||0,travelDeadline),phase:mode==="ônibus"?"to_stop":mode==="táxi"?"waiting_taxi":"moving",plannedActivity:p.activity,destinationId:destination.buildingId||p.destinationId,destinationName:destination.name||this.buildingIndex?.get(p.destinationId)?.name||"destino" };
    if (mode === "táxi") {
      const request = requestTaxiRide(this.taxiSystem, {
        week: this.week,
        day: this.day,
        minute: this.minute,
        hour: this.minute / 60,
        personId: p.id,
        origin: { x: p.x, y: p.y },
        destination: { x: destination.x, y: destination.y, buildingId: destination.buildingId },
        distance: taxiDistanceKm,
        availableMoney: p.money,
      }, this.vehicles, { rain: this.environment.current.rain, severeWeather: this.environment.current.storm || this.environment.current.snow });
      this.taxiSystem = request.state;
      if (request.ok) {
        const vehicle = this.vehicles.find((candidate) => candidate.id === request.ride.vehicleId);
        if (vehicle) vehicle.status = "dispatching";
        p.currentTrip.taxiRideId = request.ride.id;
        p.currentTrip.vehicleId = request.ride.vehicleId;
        p.currentTrip.driverId = request.ride.driverId;
        p.currentTrip.fare = request.fare;
        p.currentTrip.waitMinutes = request.waitMinutes;
        p.currentTrip.waitRemaining = request.waitMinutes;
        p.currentTrip.maxWait = Math.max(18, request.waitMinutes * 2);
        p.target = null;
        p.path = [];
      } else {
        mode = distance > 5 ? "ônibus" : "a pé";
        p.currentTrip.mode = mode;
        p.currentTrip.phase = mode === "ônibus" ? "to_stop" : "moving";
        p.currentTrip.maxTripMinutes = clamp(Math.round(distance * (mode === "ônibus" ? 4.2 : 6.5) + (mode === "ônibus" ? 70 : 35)), 70, 240);
        p.currentTrip.deadlineAt = Math.max(p.actionDeadlineAt || 0, now + p.currentTrip.maxTripMinutes);
      }
      this.taxiSummary = summarizeTaxiSystem(this.taxiSystem);
    }
    if (mode === "ônibus") {
      const fare = this.governance?.policies.transitFare || 4.8;
      this.transportSystem.dailyRiders++;
      this.transportSystem.totalRiders++;
      this.transportSystem.revenue += fare;
      p.money -= fare;
      p.mobility.transitTrips++;
      const nearestStop = (stops, x, y) => { let best = null, bestDistance = Infinity; stops.forEach((stop) => { const stopDistance = Math.hypot(stop[0] - x, stop[1] - y); if (stopDistance < bestDistance) { best = stop; bestDistance = stopDistance; } }); return { stop: best, distance: bestDistance }; };
      let selected = null;
      this.transportSystem.routes.forEach((route) => {
        const entry = nearestStop(route.stops, p.x, p.y), exit = nearestStop(route.stops, destination.x, destination.y), score = entry.distance + exit.distance + (entry.stop === exit.stop ? 50 : 0);
        if (!selected || score < selected.score) selected = { route, entry: entry.stop, exit: exit.stop, score };
      });
      const route = selected.route, wait = Math.ceil(route.frequency * Math.random());
      route.waiting++;
      this.transportSystem.averageWait =
        (this.transportSystem.averageWait + wait) / 2;
      p.currentTrip.waitMinutes = wait;
      p.currentTrip.waitRemaining = wait;
      p.currentTrip.boardedMinutes=0;
      p.currentTrip.routeId = route.id;
      p.currentTrip.entryStop=selected.entry;
      p.currentTrip.exitStop=selected.exit;
      p.currentTrip.maxWait=Math.max(24,route.frequency*2);p.currentTrip.waitedMinutes=0;
      let bus = null, busDistance = Infinity; this.transportSystem.fleet.forEach((id) => { const candidate = this.vehicleIndex?.get(id); if (candidate?.routeId !== route.id || candidate.status !== "active") return; const candidateDistance = Math.hypot(candidate.x - p.x, candidate.y - p.y); if (candidateDistance < busDistance) { bus = candidate; busDistance = candidateDistance; } }); p.currentTrip.vehicleId=bus?.id||null;
      p.path=[];p.target={x:p.currentTrip.entryStop[0],y:p.currentTrip.entryStop[1]};
    } else if (mode === "carro" && car) {
      const liters = distance / Math.max(1, car.efficiency);
      car.fuel = Math.max(0, car.fuel - liters);
      car.mileage += distance;
      car.condition = Math.max(0, car.condition - distance * 0.004);
      car.maintenanceDue = car.condition < 35;
      p.money -= liters * 6.15;
      p.currentTrip.vehicleId = car.id;
    }
    p.mobility.trips++;
    if (this.cityDynamics) this.cityDynamics.tripsStartedToday++;
    p.mobility.commuteMinutes = Math.round(
      distance * (mode === "carro" || mode === "táxi" ? 1.25 : mode === "ônibus" ? 2.6 : mode === "bicicleta" ? 2.1 : 3.2),
    ) + (p.currentTrip.waitMinutes || 0);
  }
  absoluteMinute(){return ((this.week-1)*7+this.day)*1440+this.minute;}
  actionPriorityFor(p,scheduled,destination){
    if(p.medical?.admitted||p.justice?.incarcerated)return 100;
    if(p.needs.hunger<8||p.health<25)return 92;
    if(destination?.id===p.homeId&&(this.minute>=1260||this.minute<360||p.energy<18))return 88;
    if(scheduled.socialIntentId)return scheduled.supportIntent?70:62;
    if(scheduled.eventId){const event=this.activeEventById?.get(scheduled.eventId) || this.events.active.find(item=>item.id===scheduled.eventId);return event?.importance==="marco familiar"?76:event?.importance==="sazonal"?72:event?.importance==="pessoal"?68:64;}
    let priority = {work:82,study:78,meal:66,rest:58,errand:42,social:32,leisure:22,commute:70}[scheduled.category]||40;
    const goal = p.mind?.goals?.find((item) => item.status === "active");
    if (goal) {
      const boosts = {
        education: { study: 7 },
        personal_growth: { study: 5, leisure: 3 },
        employment: { work: 6, errand: 4 },
        career_growth: { work: 6 },
        financial_security: { work: 4, errand: 2 },
        health_recovery: { rest: 8, meal: 3 },
        wellbeing: { rest: 5, leisure: 3 },
        belonging: { social: 10, leisure: 4 },
        relationship: { social: 9 },
        family_care: { social: 8, meal: 4 },
        community: { social: 6, leisure: 4 },
      };
      priority += boosts[goal.type]?.[scheduled.category] || 0;
    }
    return Math.min(87, priority);
  }
  abandonTrip(p,reason="rota indisponível"){
    const trip=p.currentTrip;if(!trip)return;if(trip.taxiRideId&&this.taxiSystem){const cancelled=cancelTaxiRide(this.taxiSystem,trip.taxiRideId,reason);this.taxiSystem=cancelled.state;const taxi=this.vehicles.find(vehicle=>vehicle.id===trip.vehicleId);if(taxi)taxi.status="active";this.taxiSummary=summarizeTaxiSystem(this.taxiSystem);}if(this.cityDynamics)this.cityDynamics.tripsAbandonedToday++;const route=this.routeIndex?.get(trip.routeId);if(route)route.waiting=Math.max(0,route.waiting-1);p.currentTrip=null;p.target=null;p.path=[];p.destinationId=null;p.scheduleKey=null;p.destinationRecheckAt=null;p.activity=`Replanejando: ${reason}`;
  }
  fallbackFromTransit(p,reason){
    const trip=p.currentTrip,destination=this.buildingIndex?.get(trip?.destinationId);if(!trip||!destination)return this.abandonTrip(p,reason);
    const remaining=Math.hypot(destination.x-p.x,destination.y-p.y);trip.mode=this.vehicleOf(p)?"carro":remaining>4?"bicicleta":"a pé";trip.phase="moving";trip.waitFailure=reason;trip.elapsedMinutes=0;trip.maxTripMinutes=clamp(Math.round(remaining*8+40),60,240);p.path=[];p.target=this.accessPoint(destination);p.destinationId=destination.id;trip.deadlineAt=this.absoluteMinute()+trip.maxTripMinutes;
  }
  updateTransit(minutes = 10) {
    this.transportSystem.fleet.forEach((id) => {
      const bus = this.vehicleIndex?.get(id) || this.vehicles.find((v) => v.id === id),
        route = this.routeIndex?.get(bus.routeId) || this.transportSystem.routes.find((r) => r.id === bus.routeId);
      bus.recentStops = [];
      const serviceHour=this.minute/60;if(!route||serviceHour<route.serviceStart||serviceHour>=route.serviceEnd||bus.status==="maintenance"||bus.status==="broken")return;
      let travelBudget = 2.25 * minutes / (1 + this.roadPenaltyAt(bus.x, bus.y));
      let travelled = 0;
      let guard = route.stops.length * 2;
      while (travelBudget > 0.01 && guard-- > 0) {
        const target = route.stops[bus.stopIndex], dx = target[0] - bus.x, dy = target[1] - bus.y, distance = Math.hypot(dx, dy);
        if (distance <= travelBudget + 0.001) {
          bus.x = target[0];
          bus.y = target[1];
          travelled += distance;
          travelBudget -= distance;
          bus.recentStops.push([target[0], target[1]]);
          bus.stopIndex = (bus.stopIndex + 1) % route.stops.length;
          if(bus.stopIndex===0){route.completedTrips++;if(bus.fuel<bus.fuelCapacity*.35){const liters=bus.fuelCapacity-bus.fuel;bus.fuel=bus.fuelCapacity;this.transportSystem.maintenanceCost+=liters*6.15;this.money-=liters*6.15;}}
          bus.occupancy = Math.min(bus.seats,Math.floor(this.transportSystem.dailyRiders/Math.max(1,this.transportSystem.fleet.length))+Math.floor(Math.random()*8));
          continue;
        }
        bus.x += (dx / distance) * travelBudget;
        bus.y += (dy / distance) * travelBudget;
        travelled += travelBudget;
        travelBudget = 0;
      }
      const travelledKm=travelled*.1;bus.fuel=Math.max(0,bus.fuel-travelledKm/bus.efficiency);bus.mileage+=travelledKm;bus.condition=Math.max(0,bus.condition-travelledKm*.0012);if((bus.condition<15||bus.fuel<=0)&&Math.random()<.012){bus.status="broken";this.transportSystem.breakdowns++;route.punctuality=Math.max(20,route.punctuality-5);this.log("transporte",`${bus.model} apresentou pane na ${route.name}.`,"civic");}
    });
    const drivers = this.people.filter(
      (p) => ["carro", "táxi"].includes(p.currentTrip?.mode) && p.target,
    );
    this.transportSystem.traffic = drivers.length;
    this.transportSystem.streetLoad = {};
    this.city.streets.forEach((s) => {
      const load =
          drivers.filter(
            (p) => Math.abs((s.axis === "v" ? p.x : p.y) - s.at) < 0.38,
          ).length +
          this.transportSystem.fleet
            .map((id) => this.vehicles.find((v) => v.id === id))
            .filter((v) => Math.abs((s.axis === "v" ? v.x : v.y) - s.at) < 0.38)
            .length *
            2,
        capacity = s.kind === "avenue" ? 22 : 12;
      this.transportSystem.streetLoad[s.id] = {
        load,
        capacity,
        ratio: load / capacity,
      };
    });
    this.transportSystem.congestionIndex = Math.max(
      0,
      ...Object.values(this.transportSystem.streetLoad).map((x) => x.ratio),
    );
    this.updateDeliveries(minutes);
  }
  personStatus(person) {
    return this.derivePersonAction(person).text;
  }
  derivePersonAction(person) {
    if(!person.alive)return {text:"Falecido",phase:"deceased",placeId:person.locationId,mode:null,destinationId:null};
    if(person.justice.incarcerated)return {text:person.justice.pretrial?"Aguardando julgamento no Presídio Municipal":`Cumprindo pena no Presídio Municipal · ${person.justice.sentenceRemaining} dias restantes`,phase:"institutional",placeId:person.locationId,mode:null,destinationId:null};
    if(person.medical.admitted)return {text:`Internado no Hospital São Lucas${person.medical.conditions[0]?` · ${conditionById(person.medical.conditions[0].id)?.name||"em tratamento"}`:""}`,phase:"institutional",placeId:person.locationId,mode:null,destinationId:null};
    const trip=person.currentTrip;
    if(trip){if(trip.mode==="ônibus"&&trip.phase==="to_stop")return {text:`Caminhando até o ponto para ir a ${trip.destinationName}`,phase:"to_stop",placeId:null,destinationId:trip.destinationId,mode:"ônibus",priority:trip.priority};if(trip.mode==="ônibus"&&trip.phase==="waiting")return {text:`Aguardando ônibus para ${trip.destinationName} · ${trip.waitedMinutes||0} min`,phase:"waiting",placeId:person.locationId,destinationId:trip.destinationId,mode:"ônibus",priority:trip.priority,waitedMinutes:trip.waitedMinutes||0};if(trip.mode==="ônibus"&&trip.phase==="onboard"){const bus=this.vehicleIndex?.get(trip.vehicleId),route=this.routeIndex?.get(trip.routeId);return {text:`Embarcado no ${bus?.model||"ônibus"} · ${route?.name||"linha urbana"} · destino ${trip.destinationName}`,phase:"onboard",placeId:null,destinationId:trip.destinationId,vehicleId:bus?.id||null,mode:"ônibus",priority:trip.priority};}if(trip.mode==="táxi"&&trip.phase==="waiting_taxi")return {text:`Aguardando táxi para ${trip.destinationName} · previsão ${Math.max(0,Math.ceil(trip.waitRemaining||0))} min`,phase:"waiting",placeId:person.locationId,destinationId:trip.destinationId,vehicleId:trip.vehicleId,mode:"táxi",priority:trip.priority};if(trip.mode==="táxi"&&trip.phase==="onboard")return {text:`Em táxi para ${trip.destinationName} · tarifa prevista R$ ${Number(trip.fare||0).toFixed(2)}`,phase:"onboard",placeId:null,destinationId:trip.destinationId,vehicleId:trip.vehicleId,mode:"táxi",priority:trip.priority};const verb=trip.mode==="carro"?"Dirigindo":trip.mode==="bicicleta"?"Pedalando":trip.mode==="táxi"?"Em táxi":"Caminhando";return {text:`${verb} para ${trip.destinationName}`,phase:trip.phase||"moving",placeId:null,destinationId:trip.destinationId,vehicleId:trip.vehicleId||null,mode:trip.mode,priority:trip.priority};}
    const playerAction=this.isPlayerControlled(person)?person.playerControl?.activeAction:null;
    if(playerAction)return {text:playerAction.label,baseActivity:playerAction.label,phase:"player-action",placeId:person.locationId,destinationId:null,mode:"presencial",priority:100,endsAt:playerAction.endsAt,progress:clamp((this.absoluteMinute()-playerAction.startedAt)/Math.max(1,playerAction.endsAt-playerAction.startedAt)*100,0,100)};
    if(person.socialContext?.expiresAt>this.absoluteMinute()&&person.socialContext.placeId===person.locationId)return {text:person.socialContext.label,baseActivity:person.socialContext.label,phase:"social",placeId:person.locationId,destinationId:null,mode:"presencial",socialContext:person.socialContext};
    if(this.isPlayerControlled(person)){const place=this.buildingIndex?.get(person.locationId),text=`Aguardando sua decisão${place?` · ${place.name}`:""}`;return {text,baseActivity:"Aguardando sua decisão",phase:"player-idle",placeId:place?.id||person.locationId||null,destinationId:null,mode:null,priority:100};}
    const place=this.buildingIndex?.get(person.locationId),previous=person.currentAction,stale=/aguardando|dirigindo|caminhando|pedalando|trânsito|ônibus/i.test(person.activity),suffix=place?` · ${place.name}`:"";let baseActivity=previous?.phase==="present"&&person.activity===previous.text?previous.baseActivity:(stale?"Presente no local":person.activity);if(suffix&&baseActivity?.endsWith(suffix))baseActivity=baseActivity.slice(0,-suffix.length);return {text:`${baseActivity||"Presente"}${suffix}`,baseActivity:baseActivity||"Presente",phase:"present",placeId:place?.id||null,destinationId:null,mode:null};
  }
  syncPersonState(person) {
    if (person.socialContext && (!person.alive || person.currentTrip || person.socialContext.expiresAt <= this.absoluteMinute())) this.clearSocialContext(person);
    if(!person.currentAction)person.currentAction={};const derived=this.derivePersonAction(person),signature=`${derived.phase}|${derived.text}|${derived.placeId||""}|${derived.destinationId||""}|${derived.vehicleId||""}`;
    if(person.currentAction.signature!==signature)person.currentAction={...derived,signature,sinceWeek:this.week,sinceDay:this.day,sinceMinute:this.minute};else Object.assign(person.currentAction,derived);
    person.activity=derived.text;
    if(derived.phase==="onboard"&&derived.vehicleId){const vehicle=this.vehicleIndex?.get(derived.vehicleId);if(vehicle){person.x=vehicle.x;person.y=vehicle.y;}}
    if(!person.currentTrip&&!person.target&&derived.placeId){const place=this.buildingIndex?.get(derived.placeId);if(place&&(person.x<place.x||person.x>place.x+place.w||person.y<place.y||person.y>place.y+place.h)){person.x=place.x+place.w/2;person.y=place.y+place.h/2;}}
  }
  refreshWorldIndexes() {
    if (!this.buildingIndex || this.buildingIndex.size !== this.buildings.length) {
      this.buildingIndex = new Map(this.buildings.map((building) => [building.id, building]));
      this.buildingNameIndex = new Map(this.buildings.map((building) => [building.name, building]));
      this.buildingsByType = new Map();
      this.buildings.forEach((building) => { if (!this.buildingsByType.has(building.type)) this.buildingsByType.set(building.type, []); this.buildingsByType.get(building.type).push(building); });
    }
    if (!this.vehicleIndex || this.vehicleIndex.size !== this.vehicles.length) this.vehicleIndex = new Map(this.vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const routes = this.transportSystem?.routes || [];
    if (!this.routeIndex || this.routeIndex.size !== routes.length) this.routeIndex = new Map(routes.map((route) => [route.id, route]));
    const businessSignature = `${this.businesses.length}:${this.buildings.length}:${this.urbanEvolution?.relocations || 0}`;
    if (this.businessIndexSignature !== businessSignature) {
      this.businessIndexSignature = businessSignature;
      this.businessIndex = new Map(this.businesses.map((business) => [business.id, business]));
      this.businessByBuildingId = new Map(this.businesses.map((business) => [business.buildingId, business]));
    }
    if (!this.streetIndex || this.streetIndex.size !== this.city.streets.length) this.streetIndex = new Map(this.city.streets.map((street) => [street.id, street]));
  }
  synchronizeWorldState({ occupancy = true } = {}) { this.refreshWorldIndexes(); this.people.forEach(p=>this.syncPersonState(p)); if (occupancy) this.syncPhysicalOccupancy(); }
  placePersonAt(person,buildingRef) {const building=this.buildings.find(b=>b.id===buildingRef||b.name===buildingRef);if(!building)return;if(this.isPlayerControlled(person)&&(person.currentTrip||person.playerControl?.travelCommand||person.playerControl?.activeAction))this.cancelPlayerAction("ação interrompida por uma mudança institucional");else if(person.currentTrip)this.abandonTrip(person,"deslocamento interrompido por uma mudança institucional");this.clearSocialContext(person);person.locationId=building.id;person.destinationId=null;person.target=null;person.path=[];person.currentTrip=null;person.x=building.x+building.w/2;person.y=building.y+building.h/2;}
  setPlayerCommandResult(person, commandId, ok, message, details = {}) {
    if (!person?.playerControl) return null;
    const result = { commandId: commandId || null, ok: Boolean(ok), message, details, week: this.week, day: this.day, minute: this.minute, at: this.absoluteMinute() };
    person.playerControl.lastCommandResult = result;
    person.playerControl.totalCommands = (person.playerControl.totalCommands || 0) + 1;
    return result;
  }
  issuePlayerTravel(buildingId, options = {}) {
    const person = this.player(), building = this.buildings.find((candidate) => candidate.id === buildingId);
    if (!person?.alive) return { ok: false, reason: "personagem indisponível" };
    if (person.justice?.incarcerated || person.medical?.admitted) return { ok: false, reason: "o deslocamento está bloqueado pela situação atual" };
    if (!building) return { ok: false, reason: "destino não encontrado" };
    if (person.playerControl?.activeAction || person.playerControl?.travelCommand || person.currentTrip) this.cancelPlayerAction("rota substituída pelo jogador");
    person.playerControl.travelCommand = { commandId: options.commandId || null, buildingId, startedAt: this.absoluteMinute(), mode: options.mode || "auto" };
    person.activity = options.activity || `Indo para ${building.name}`;
    person.activityCategory = "commute";
    person.actionPriority = 100;
    person.actionDeadlineAt = this.absoluteMinute() + 300;
    if (person.locationId === building.id) {
      person.playerControl.travelCommand = null;
      person.activity = "Aguardando sua decisão";
      person.activityCategory = "leisure";
      const result = this.setPlayerCommandResult(person, options.commandId, true, `Você já está em ${building.name}.`, { buildingId });
      return { ok: true, immediate: true, result };
    }
    this.routeTo(person, building, { mode: options.mode || "auto", playerCommand: true });
    if (!person.currentTrip) {
      person.playerControl.travelCommand = null;
      const result = this.setPlayerCommandResult(person, options.commandId, false, `Não foi possível iniciar o deslocamento para ${building.name}.`, { buildingId });
      return { ok: false, reason: "rota indisponível", result };
    }
    return { ok: true, mode: person.currentTrip.mode || null, building };
  }
  cancelPlayerAction(reason = "cancelada pelo jogador") {
    const person = this.player();
    if (!person) return { ok: false, reason: "personagem não encontrado" };
    const active = person.playerControl?.activeAction, travel = person.playerControl?.travelCommand;
    if (person.currentTrip) this.abandonTrip(person, reason);
    person.playerControl.activeAction = null;
    person.playerControl.travelCommand = null;
    person.activity = "Aguardando sua decisão";
    person.activityCategory = "leisure";
    const commandId = active?.commandId || travel?.commandId || null;
    const result = commandId ? this.setPlayerCommandResult(person, commandId, false, reason) : null;
    return { ok: Boolean(active || travel), result };
  }
  startPlayerActivity(type, options = {}) {
    const person = this.player(), place = this.buildings.find((building) => building.id === person?.locationId);
    if (!person?.alive) return { ok: false, reason: "personagem indisponível" };
    if (person.justice?.incarcerated && !["rest", "eat", "wait"].includes(type)) return { ok: false, reason: "ação indisponível durante a prisão" };
    if (person.medical?.admitted && !["rest", "eat", "wait"].includes(type)) return { ok: false, reason: "ação indisponível durante a internação" };
    if (person.currentTrip) return { ok: false, reason: "conclua ou cancele o deslocamento atual" };
    if (person.playerControl?.activeAction) return { ok: false, reason: "conclua ou cancele a ação atual" };
    const definitions = {
      rest: { label: "Descansando", category: "rest", duration: 90, home: true },
      eat: { label: "Preparando e fazendo uma refeição", category: "meal", duration: 45, home: true },
      hygiene: { label: "Cuidando da higiene", category: "rest", duration: 30, home: true },
      leisure: { label: "Aproveitando o tempo livre", category: "leisure", duration: 60 },
      work: { label: `Trabalhando como ${String(person.role || "profissional").toLowerCase()}`, category: "work", duration: 120, work: true },
      study: { label: "Estudando", category: "study", duration: 90, study: true },
      wait: { label: "Esperando e observando o movimento", category: "leisure", duration: 30 },
    };
    const definition = definitions[type];
    if (!definition) return { ok: false, reason: "ação desconhecida" };
    if (definition.home && person.locationId !== person.homeId) return { ok: false, reason: "essa ação precisa ser realizada em casa" };
    if (definition.work) {
      const workplace = this.buildings.find((building) => building.name === person.workplace);
      const business = this.businessOf(person);
      if (!person.shift || !workplace || person.locationId !== workplace.id) return { ok: false, reason: "vá ao seu local de trabalho antes de iniciar o expediente" };
      if (business && !this.isOpen(business)) return { ok: false, reason: `${business.name} está fechado neste horário` };
    }
    if (definition.study) {
      const institution = this.buildings.find((building) => building.name === person.education?.institution);
      if (!person.education?.enrolled || !institution || person.locationId !== institution.id) return { ok: false, reason: "é necessário estar matriculado e presente na instituição" };
    }
    const duration = Math.max(10, Number(options.durationMinutes) || definition.duration), commandId = options.commandId || null;
    person.playerControl.activeAction = { id: commandId || uid("player-action"), commandId, type, label: definition.label, category: definition.category, placeId: place?.id || null, startedAt: this.absoluteMinute(), endsAt: this.absoluteMinute() + duration, durationMinutes: duration, interruptible: true };
    person.activity = definition.label;
    person.activityCategory = definition.category;
    person.actionPriority = 100;
    return { ok: true, action: person.playerControl.activeAction };
  }
  updatePlayerControl(person) {
    if (!this.isPlayerControlled(person) || !person.playerControl) return;
    const action = person.playerControl.activeAction;
    if (!action || this.absoluteMinute() < action.endsAt) return;
    let message = `${action.label} foi concluído.`;
    if (action.type === "work") {
      const hours = action.durationMinutes / 60, payment = Math.round((person.hourlyWage || 0) * hours * 100) / 100, business = this.businessOf(person);
      person.money += payment;
      if (business) business.cash -= payment;
      person.playerControl.workMinutesThisWeek += action.durationMinutes;
      message = `Expediente concluído: R$ ${payment.toLocaleString("pt-BR")} recebidos.`;
    } else if (action.type === "study") {
      person.playerControl.studyMinutesThisWeek += action.durationMinutes;
      person.education.performance = clamp(person.education.performance + action.durationMinutes / 100, 0, 100);
      person.education.attendance = clamp(person.education.attendance + 1.2, 0, 100);
      person.education.credits += action.durationMinutes >= 90 ? 1 : 0;
      message = "Sessão de estudos concluída; desempenho e créditos foram atualizados.";
    } else if (action.type === "hygiene") {
      person.needs.hygiene = clamp(person.needs.hygiene + 48, 0, 100);
      message = "Higiene e conforto recuperados.";
    } else if (action.type === "eat") {
      person.needs.hunger = clamp(person.needs.hunger + 24, 0, 100);
      message = "Refeição concluída; a fome diminuiu.";
    } else if (action.type === "rest") {
      person.energy = clamp(person.energy + 14, 0, 100);
      person.needs.comfort = clamp(person.needs.comfort + 12, 0, 100);
      message = "Descanso concluído; energia e conforto melhoraram.";
    } else if (action.type === "leisure") {
      person.happiness = clamp(person.happiness + 3, 0, 100);
    }
    person.actionLog.unshift({ week: this.week, day: this.day, time: this.time, activity: message, place: this.buildings.find((building) => building.id === person.locationId)?.name || "Cidade" });
    person.actionLog = person.actionLog.slice(0, 24);
    person.playerControl.activeAction = null;
    person.activity = "Aguardando sua decisão";
    person.activityCategory = "leisure";
    this.setPlayerCommandResult(person, action.commandId, true, message, { type: action.type, durationMinutes: action.durationMinutes });
  }
  playerPurchase(businessId, productName, options = {}) {
    const person = this.player(), business = this.businesses.find((candidate) => candidate.id === businessId);
    if (!person?.alive || !business) return { ok: false, reason: "estabelecimento indisponível" };
    if (person.locationId !== business.buildingId || person.currentTrip) return { ok: false, reason: "você precisa estar no estabelecimento" };
    if (!this.isOpen(business)) return { ok: false, reason: `${business.name} está fechado` };
    const product = business.products?.[productName];
    if (!product) return { ok: false, reason: "produto ou serviço indisponível" };
    if (product.stock <= 0) return { ok: false, reason: "estoque esgotado" };
    if (person.money < product.price) return { ok: false, reason: "dinheiro insuficiente" };
    this.interactWithBusiness(person, business, productName);
    const transaction = business.transactions[0], ok = transaction?.personId === person.id && transaction?.product === productName && transaction?.week === this.week && transaction?.day === this.day && transaction?.time === this.time;
    if (ok) this.setPlayerCommandResult(person, options.commandId, true, `${productName} adquirido em ${business.name}.`, { businessId, productName, price: transaction.price });
    return ok ? { ok: true, transaction } : { ok: false, reason: "a compra não pôde ser concluída" };
  }
  playerInteractWithPerson(targetId, kind = "talk", options = {}) {
    const person = this.player(), target = this.people.find((candidate) => candidate.id === targetId), place = this.buildings.find((building) => building.id === person?.locationId);
    if (!person?.alive || !target?.alive || target.id === person.id) return { ok: false, reason: "pessoa indisponível" };
    if (person.currentTrip || target.currentTrip || person.locationId !== target.locationId) return { ok: false, reason: "vocês precisam estar no mesmo local" };
    if (kind === "flirt" && (person.age < 18 || target.age < 18 || !this.canFormRomance(person, target) || !this.orientationCompatible(person, target))) return { ok: false, reason: "o flerte não é apropriado ou compatível neste contexto" };
    const interaction = this.performSocialInteraction(person, target, place, { macro: false }), link = this.ensureSocialRelationship(person, target, {});
    if (!interaction || !link) return { ok: false, reason: "a interação não pôde acontecer agora" };
    const effects = {
      talk: { affinity: 1, trust: 1, tension: -1, label: `Você conversou com ${target.firstName}.` },
      compliment: { affinity: 5, trust: 1.5, tension: -1, label: `${target.firstName} recebeu bem o elogio.` },
      support: { affinity: 3, trust: 6, tension: -3, label: `Você ofereceu apoio a ${target.firstName}.` },
      flirt: { affinity: 4, trust: 1, tension: 0, attraction: 10, label: `Você flertou com ${target.firstName}.` },
      argue: { affinity: -6, trust: -4, tension: 12, label: `Você discutiu com ${target.firstName}.` },
    }[kind] || { affinity: 1, trust: 1, tension: 0, label: `Você interagiu com ${target.firstName}.` };
    link.affinity = clamp((link.affinity || 0) + effects.affinity, -100, 100);
    link.trust = clamp((link.trust || 0) + effects.trust, 0, 100);
    link.tension = clamp((link.tension || 0) + effects.tension, 0, 100);
    if (effects.attraction) {
      link.views ||= {};
      link.views[person.id] ||= { affection: link.affinity, trust: link.trust, attraction: 0, resentment: 0 };
      link.views[person.id].attraction = clamp((link.views[person.id].attraction || 0) + effects.attraction, 0, 100);
    }
    person.needs.social = clamp(person.needs.social + (kind === "argue" ? -3 : 9), 0, 100);
    target.needs.social = clamp(target.needs.social + (kind === "argue" ? -2 : 5), 0, 100);
    this.setPlayerCommandResult(person, options.commandId, true, effects.label, { targetId, kind, affinity: link.affinity, trust: link.trust, tension: link.tension });
    return { ok: true, interaction, link, message: effects.label };
  }
  playerApplyForJob(businessId, role, options = {}) {
    const person = this.player(), business = this.businesses.find((candidate) => candidate.id === businessId);
    if (!person?.alive || person.age < 18) return { ok: false, reason: "é preciso ter 18 anos para este vínculo" };
    if (!business || business.closed || person.locationId !== business.buildingId) return { ok: false, reason: "vá ao estabelecimento para se candidatar" };
    const chosenRole = (business.requiredRoles || []).includes(role) ? role : business.requiredRoles?.[0] || `${business.sector} · atendimento`;
    if (!this.assignWorkerToBusiness(person, business, chosenRole, business.employees.length)) return { ok: false, reason: "a contratação não pôde ser concluída" };
    const message = `Você foi contratado por ${business.name} como ${chosenRole}.`;
    this.setPlayerCommandResult(person, options.commandId, true, message, { businessId, role: chosenRole });
    return { ok: true, business, role: chosenRole, message };
  }
  playerEnroll(institutionId, course, options = {}) {
    const person = this.player(), institution = this.buildings.find((building) => building.id === institutionId && building.type === "school");
    if (!person?.alive || !institution || person.locationId !== institution.id) return { ok: false, reason: "vá à instituição para solicitar a matrícula" };
    const college = institution.name === "Faculdade Municipal";
    if (college && person.age < 18) return { ok: false, reason: "o ensino superior exige idade mínima de 18 anos" };
    const stage = college ? educationStages.find((entry) => entry.id === "college") : stageForAge(person.age) || educationStages.find((entry) => entry.id === "secondary");
    person.education ||= emptyEducation();
    Object.assign(person.education, { stage: stage.id, institution: institution.name, course: college ? (courses.includes(course) ? course : courses[0]) : null, enrolled: true, attendance: Math.max(70, person.education.attendance || 100), performance: person.education.performance || 50 });
    person.education.history.unshift({ week: this.week, text: `Matriculou-se em ${stage.name}${college ? ` · ${person.education.course}` : ""}.` });
    if (!person.shift) { person.role = "Estudante"; person.workplace = institution.name; }
    person.routine = buildRoutine(person);
    const message = `Matrícula confirmada em ${institution.name}.`;
    this.setPlayerCommandResult(person, options.commandId, true, message, { institutionId, course: person.education.course });
    return { ok: true, institution, message };
  }
  playerSeekHealthcare(institutionId, options = {}) {
    const person = this.player(), institution = this.buildings.find((building) => building.id === institutionId && building.type === "health");
    if (!person?.alive || !institution || person.locationId !== institution.id) return { ok: false, reason: "vá a uma unidade de saúde para solicitar atendimento" };
    if (person.currentTrip) return { ok: false, reason: "conclua o deslocamento antes do atendimento" };
    const active = person.medical.conditions.slice().sort((a, b) => b.severity - a.severity)[0], condition = active && conditionById(active.id);
    let message;
    if (!active) {
      person.medical.visits++;
      person.health = clamp(person.health + 3, 0, 100);
      message = `Avaliação preventiva concluída em ${institution.name}; nenhum quadro ativo foi identificado.`;
    } else if (active.severity >= 55 && institution.name === "Hospital São Lucas") {
      const visitsBefore = person.medical.visits;
      this.admit(person, condition || { id: active.id, name: active.id, treatment: "Observação clínica", severity: active.severity });
      if (!person.medical.admitted) person.medical.visits = visitsBefore + 1;
      message = person.medical.admitted ? `Atendimento de urgência realizado por ${condition?.name || active.id}; internação iniciada.` : `Triagem de ${condition?.name || active.id} concluída; você entrou na fila de atendimento.`;
    } else {
      person.medical.visits++;
      active.severity = clamp(active.severity - 9, 0, 100);
      person.health = clamp(person.health + 6, 0, 100);
      message = `Consulta realizada por ${condition?.name || active.id}; o tratamento foi atualizado.`;
    }
    person.medical.history.unshift({ week: this.week, text: message });
    person.actionLog.unshift({ week: this.week, day: this.day, time: this.time, activity: message, place: institution.name });
    person.actionLog = person.actionLog.slice(0, 24);
    this.setPlayerCommandResult(person, options.commandId, true, message, { institutionId, conditionId: active?.id || null, admitted: person.medical.admitted });
    return { ok: true, institution, message, admitted: person.medical.admitted };
  }
  playerContext() {
    const person = this.player();
    if (!person) return null;
    const place = this.buildings.find((building) => building.id === person.locationId), business = this.businesses.find((candidate) => candidate.buildingId === place?.id);
    return {
      person,
      place,
      business,
      nearbyPeople: this.people.filter((candidate) => candidate.alive && candidate.id !== person.id && !candidate.currentTrip && candidate.locationId === person.locationId),
      workplace: this.buildings.find((building) => building.name === person.workplace),
      institution: this.buildings.find((building) => building.name === person.education?.institution),
      home: this.buildings.find((building) => building.id === person.homeId),
    };
  }
  weeklyTransport(){this.vehicles.filter(v=>["private","public","delivery","taxi"].includes(v.use)).forEach(v=>{v.value=Math.max(1500,Math.round(v.value*.997));if(["public","taxi"].includes(v.use)&&(v.status==="broken"||v.condition<40||v.fuel<25)){const cost=Math.round((100-v.condition)*85+(v.fuelCapacity-v.fuel)*6.15);v.condition=Math.min(100,v.condition+55);v.fuel=v.fuelCapacity;v.status="active";v.maintenanceDue=false;this.transportSystem.maintenanceCost+=cost;this.money-=cost;}});this.transportSystem.routes.forEach(r=>{r.punctuality=clamp(r.punctuality+(this.governance.budget.transport-16)*.08,35,99);r.waiting=0;});this.taxiSummary=summarizeTaxiSystem(this.taxiSystem);}
  roadPenaltyAt(x,y) {
    let nearest=null,distance=Infinity;
    this.city.streets.forEach((street)=>{const current=Math.abs((street.axis==="v"?x:y)-street.at);if(current<distance){nearest=street;distance=current;}});
    if(!nearest)return 0;
    return (nearest.surface === "terra" ? 0.42 : nearest.surface === "cascalho" ? 0.18 : 0) + (nearest.constructionStatus && nearest.constructionStatus !== "complete" ? 0.32 : 0) + Math.max(0, 55 - (nearest.condition || 70)) * 0.006;
  }
  congestionAt(p) {
    let nearest = null, nearestDistance = Infinity;
    this.city.streets.forEach((street) => {
      const distance = Math.abs((street.axis === "v" ? p.x : p.y) - street.at);
      if (distance < nearestDistance) { nearest = street; nearestDistance = distance; }
    });
    return (this.transportSystem.streetLoad[nearest?.id]?.ratio || 0) + this.roadPenaltyAt(p.x,p.y);
  }
  weeklyVehicleMarket() {
    const buyers = this.people.filter(
      (p) =>
        p.alive &&
        !this.isPlayerControlled(p) &&
        p.mobility.license &&
        !p.mobility.vehicleIds.length &&
        p.money > 20000,
    );
    buyers.slice(0, 2).forEach((p) => {
      const listed = this.transportSystem.vehicleMarket.shift();
      const spec =
        listed ||
        vehicleModels[Math.floor(Math.random() * vehicleModels.length)];
      const price = listed?.value || spec.price;
      if (p.money >= price) {
        const v = listed || this.createVehicle(spec, p.id, "private");
        v.ownerId = p.id;
        v.status = "active";
        v.record.listed = false;
        p.mobility.vehicleIds.push(v.id);
        p.money -= price;
        this.log("veículos", `${p.name} comprou um ${v.model}.`, "money");
      }
    });
    const sellers = this.people.filter(
      (p) => !this.isPlayerControlled(p) && p.mobility.vehicleIds.length && Math.random() < 0.025,
    );
    sellers.forEach((p) => {
      const v = this.vehicleOf(p);
      if (!v) return;
      p.mobility.vehicleIds = p.mobility.vehicleIds.filter((id) => id !== v.id);
      v.status = "listed";
      v.record.listed = true;
      this.transportSystem.vehicleMarket.push(v);
    });
  }
  dailyVehicleCrime() {
    const targets = this.vehicles.filter(
      (v) => v.use === "private" && v.status === "active",
    );
    if (targets.length && Math.random() < 0.055) {
      const v = pick(targets);
      v.status = "stolen";
      v.record.stolen = true;
      v.record.history.unshift({ week: this.week, text: "Veículo roubado." });
      this.transportSystem.stolen.push(v.id);
      const owner = this.people.find((p) => p.id === v.ownerId);
      this.log(
        "roubo de veículo",
        `${v.model} de ${owner?.name || "um morador"} foi roubado.`,
        "civic",
      );
    }
    this.transportSystem.stolen.slice().forEach((id) => {
      if (Math.random() < 0.09) {
        const v = this.vehicles.find((x) => x.id === id),
          recovered = Math.random() < 0.78;
        if (recovered) {
          v.status = "active";
          v.record.recovered = true;
          v.record.history.unshift({
            week: this.week,
            text: "Recuperado pela polícia.",
          });
          this.transportSystem.recovered++;
          this.log(
            "recuperação",
            `A polícia recuperou o veículo ${v.plate}.`,
            "social",
          );
        } else {
          v.status = "scrapped";
          this.transportSystem.scrapped++;
          this.log(
            "desmanche",
            `O veículo ${v.plate} não foi recuperado e provavelmente foi desmontado.`,
            "civic",
          );
        }
        this.transportSystem.stolen = this.transportSystem.stolen.filter(
          (x) => x !== id,
        );
      }
    });
  }
  createEconomy() {
    Object.entries(businessCatalog).forEach(([name, data], index) => {
      const building = this.buildings.find((b) => b.name === name);
      if (!building) return;
      const owner = this.people.filter((p) => p.age >= 25)[
        (index * 9) % this.people.filter((p) => p.age >= 25).length
      ];
      const business = {
        id: uid("biz"),
        buildingId: building.id,
        name,
        ...structuredClone(data),
        ownerId: owner.id,
        cash: 18000 + index * 4200,
        revenue: 0,
        expenses: 0,
        sales: 0,
        employees: [],
        days: [0, 1, 2, 3, 4, 5, 6],
        presentCustomers: [],
        transactions: [],
        visits: 0,
        reputation: 65 + Math.floor(Math.random() * 25),
        serviceQuality: 58 + Math.floor(Math.random() * 35),
      };
      building.businessId = business.id;
      this.businesses.push(business);
    });
    const sectorProducts={Mercado:{hortifruti:{price:19,stock:180,target:240},laticínios:{price:16,stock:150,target:210},carnes:{price:38,stock:120,target:170},limpeza:{price:21,stock:140,target:190}},Cafeteria:{sobremesa:{price:14,stock:70,target:100},suco:{price:11,stock:90,target:120}},Farmácia:{cosmético:{price:36,stock:85,target:120},'primeiros socorros':{price:28,stock:65,target:90}},Restaurante:{sobremesa:{price:18,stock:65,target:90},bebida:{price:9,stock:120,target:170}},Livraria:{papelaria:{price:18,stock:100,target:140},revista:{price:16,stock:75,target:110}},'Serviços automotivos':{pneu:{price:380,stock:20,target:32},revisão:{price:320,stock:35,target:45}},Padaria:{doce:{price:12,stock:80,target:120},bolo:{price:42,stock:28,target:45}},'Comércio automotivo':{acessório:{price:190,stock:45,target:70}},'Serviços imobiliários':{vistoria:{price:260,stock:80,target:80}}};
    const sectorRoles={Mercado:["Gerente de loja","Operador de caixa","Repositor","Açougueiro"],Cafeteria:["Barista","Atendente","Cozinheiro"],Farmácia:["Farmacêutico","Balconista","Caixa"],Restaurante:["Chef de cozinha","Cozinheiro","Garçom","Caixa"],Livraria:["Livreiro","Caixa"],Hotelaria:["Recepcionista","Camareiro","Gerente hoteleiro"],Saúde:["Médico","Enfermeiro","Recepcionista"],Educação:["Professor","Coordenador pedagógico","Auxiliar escolar"]};
    this.businesses.forEach(b=>{Object.assign(b.products,structuredClone(sectorProducts[b.sector]||{}));b.requiredRoles||=sectorRoles[b.sector]||[`${b.sector} · gerente`,`${b.sector} · atendimento`];const scaledMinimum=Math.min(3,Math.max(1,Math.ceil(b.requiredRoles.length/2)));b.minimumStaff=Math.min(b.minimumStaff||scaledMinimum,scaledMinimum);b.management={pricing:"equilibrado",inventory:"demanda prevista",service:"qualidade",lastReviewWeek:1,decisions:[]};});
    this.people.forEach((p, index) => {
      if (p.age < 18 || p.role === "Estudante" || p.role === "Aposentado(a)" || p.lifeCourse?.retirement?.active) return;
      const publicEmployer = this.buildings.find((building) => building.name === p.workplace && ["civic", "health", "school"].includes(building.type));
      if (publicEmployer) {
        p.businessId = null;
        p.contract = "Serviço público";
        p.hourlyWage = Math.max(18, p.wage || 18);
        p.shift = /policial|legista|necropsia|enfermeir/i.test(p.role)
          ? structuredClone(shiftTemplates[(index % Math.max(1, shiftTemplates.length - 1)) + 1])
          : { name: "Expediente público", start: 8, end: 17, days: [0, 1, 2, 3, 4], hours: 40 };
        return;
      }
      let biz = this.businesses.find((b) => b.name === p.workplace);
      if (!biz) {
        biz = this.businesses[index % this.businesses.length];
        p.workplace = biz.name;
      }
      p.businessId = biz.id;
      p.shift = structuredClone(
        shiftTemplates[(index + p.age) % shiftTemplates.length],
      );
      p.hourlyWage = Math.max(12, p.wage || 18);
      p.contract =
        p.shift.hours <= 20
          ? "Meio período"
          : p.role === "Autônomo"
            ? "Prestador"
            : "CLT";
      biz.employees.push(p.id);
    });
    this.ensureBusinessStaffing();
    const pharmacy = this.businesses.find((b) => b.name === "Farmácia Popular");
    if (pharmacy)
      Object.entries(medicationCatalog).forEach(([name, med]) => {
        pharmacy.products[name] ||= {
          price: med.price,
          stock: 45,
          target: 70,
        };
      });
  }
  ensureBusinessStaffing() {
    this.workforceSystem ||= { vacancies: [], hires: 0, emergencyShifts: 0, laborImmigrants: 0, laborImmigrantsThisWeek: 0, immigrationWeek: this.week, turnover: 0, history: [] };
    this.businesses.forEach((business) => {
      business.minimumStaff ||= Math.max(1, Math.min(3, business.requiredRoles?.length || 1));
      while (business.employees.length < business.minimumStaff) {
        const donor = this.businesses.filter((b) => b.id !== business.id && b.employees.length > (b.minimumStaff || 1)).sort((a,b)=>b.employees.length-a.employees.length)[0], id = donor?.employees.pop();
        if (!id) break; const worker=this.people.find((p)=>p.id===id); worker.businessId=business.id;worker.workplace=business.name;business.employees.push(id);
      }
      (business.requiredRoles || []).forEach((role,i)=>{const worker=this.people.find((p)=>p.id===business.employees[i]);if(!worker)return;worker.role=role;worker.workplace=business.name;worker.hourlyWage=Math.max(worker.hourlyWage||0,18+i*2);if(business.nightlife)worker.shift={name:"Noturno de entretenimento",start:business.open,end:business.close,days:[3,4,5,6],hours:32};});
      business.agencyStaff=0;business.openVacancies=0;
    });
  }
  assignWorkerToBusiness(worker,business,role,index=0) {
    if(!worker?.alive||worker.age<18||worker.justice?.incarcerated||worker.lifeCourse?.retirement?.active||/aposentad/i.test(worker.role||"")||worker.localGovernmentAssignment||worker.politicalOffice)return false;
    const former=this.businessOf(worker);if(former)former.employees=former.employees.filter(id=>id!==worker.id);worker.businessId=business.id;worker.workplace=business.name;worker.role=role||business.requiredRoles?.[index%business.requiredRoles.length]||`${business.sector} · atendimento`;worker.hourlyWage=Math.max(18,worker.hourlyWage||18);worker.contract="CLT";
    worker.shift=business.nightlife?{name:"Noturno de entretenimento",start:business.open,end:business.close,days:[3,4,5,6],hours:32}:business.open===0&&business.close===24?structuredClone(shiftTemplates[index%3+1]):{name:"Turno do estabelecimento",start:business.open,end:business.close,days:business.days.slice(),hours:Math.min(44,Math.max(20,(business.close<business.open?24-business.open+business.close:business.close-business.open)*Math.min(5,business.days.length)))};
    if(!business.employees.includes(worker.id))business.employees.push(worker.id);worker.routine=buildRoutine(worker);worker.history.push({week:this.week,text:`Foi contratado por ${business.name} como ${worker.role}.`});if(this.characterSystem)this.recordCharacterMemory(worker,{kind:"trabalho",summary:`Começou a trabalhar em ${business.name} como ${worker.role}.`,placeId:business.buildingId,valence:62,importance:66,novelty:58,tags:["trabalho","contratação"]});this.workforceSystem.hires++;
    return true;
  }
  recruitForBusiness(business,count) {
    if(this.workforceSystem.immigrationWeek!==this.week){this.workforceSystem.immigrationWeek=this.week;this.workforceSystem.laborImmigrantsThisWeek=0;}
    for(let i=0;i<count;i++){let candidate=this.people.filter(p=>p.alive&&!this.isPlayerControlled(p)&&p.age>=18&&!p.justice.incarcerated&&!p.lifeCourse?.retirement?.active&&!/aposentad/i.test(p.role||"")&&!p.localGovernmentAssignment&&!p.politicalOffice&&p.role!=="Estudante"&&(p.role==="Desempregado"||(!p.businessId&&!["Serviço público","Mandato eletivo"].includes(p.contract)))).sort((a,b)=>b.personality.workEthic-a.personality.workEthic)[0];
      if(!candidate){const donor=this.businesses.filter(b=>b.id!==business.id&&b.employees.filter(id=>!this.isPlayerControlled(this.people.find(person=>person.id===id))).length>(b.minimumStaff||1)+1).sort((a,b)=>b.employees.length-a.employees.length)[0],id=donor?.employees.findLast(employeeId=>!this.isPlayerControlled(this.people.find(person=>person.id===employeeId)));if(donor&&id)donor.employees=donor.employees.filter(employeeId=>employeeId!==id);candidate=this.people.find(p=>p.id===id);}
      if(!candidate){this.workforceSystem.requestedMigrants=(this.workforceSystem.requestedMigrants||0)+1;break;}
      if(!candidate)break;if(!this.assignWorkerToBusiness(candidate,business,business.requiredRoles?.[business.employees.length],i))i--;
    }
  }
  maintainWorkforce() {
    this.workforceSystem.vacancies=[];this.businesses.filter(b=>!b.closed).forEach(b=>{b.employees=b.employees.filter(id=>{const p=this.people.find(x=>x.id===id);return p?.alive&&!p.justice.incarcerated&&!p.lifeCourse?.retirement?.active&&!p.localGovernmentAssignment&&!p.politicalOffice&&p.businessId===b.id;});b.minimumStaff||=1;const missing=Math.max(0,b.minimumStaff-b.employees.length);if(missing)this.recruitForBusiness(b,missing);const staff=this.businessStaffing(b),coverageMissing=this.isScheduledOpen(b)?Math.max(0,Math.ceil(b.minimumStaff*.4)-staff.onDuty):0;b.agencyStaff=coverageMissing;b.openVacancies=Math.max(0,b.minimumStaff-b.employees.length);if(b.openVacancies)this.workforceSystem.vacancies.push({businessId:b.id,count:b.openVacancies});if(coverageMissing){this.workforceSystem.emergencyShifts+=coverageMissing;b.cash-=coverageMissing*95;}});
  }
  weeklyWorkforce() {
    this.workforceSystem.requestedMigrants = 0;
    if(this.workforceSystem.immigrationWeek!==this.week){this.workforceSystem.immigrationWeek=this.week;this.workforceSystem.laborImmigrantsThisWeek=0;}this.maintainWorkforce();this.businesses.filter(b=>!b.closed).forEach(b=>{if(Math.random()<.012&&b.employees.length>b.minimumStaff){const id=b.employees.findLast(employeeId=>!this.isPlayerControlled(this.people.find(person=>person.id===employeeId))),worker=this.people.find(p=>p.id===id);if(worker){b.employees=b.employees.filter(employeeId=>employeeId!==id);worker.role="Desempregado";worker.workplace="—";worker.businessId=null;worker.shift=null;this.workforceSystem.turnover++;this.workforceSystem.history.unshift({week:this.week,text:`${worker.name} deixou ${b.name}; uma reposição foi iniciada.`});this.recruitForBusiness(b,1);}}});this.workforceSystem.history=this.workforceSystem.history.slice(0,40);
  }
  businessStaffing(business) {
    const employees=business.employees.map(id=>this.people.find(p=>p.id===id)).filter(p=>p?.alive&&!p.justice.incarcerated&&!p.lifeCourse?.retirement?.active&&!p.localGovernmentAssignment&&!p.politicalOffice&&p.businessId===business.id),onDuty=employees.filter(p=>isWorking(p,this.day,this.minute/60));
    const required=business.minimumStaff||1,needed=Math.max(0,Math.ceil(required*.4)-onDuty.length),agency=this.isScheduledOpen(business)?Math.max(business.agencyStaff||0,needed):0;return { total:employees.length,onDuty:onDuty.length,agency,required,operational:true,capacity:clamp((onDuty.length+agency)/Math.max(1,Math.ceil(required*.4)),.55,1) };
  }
  businessOf(person) {
    return this.businesses.find((b) => b.id === person.businessId);
  }
  coworkersOf(person) {
    const b = this.businessOf(person);
    return b
      ? b.employees
          .filter((id) => id !== person.id)
          .map((id) => this.people.find((p) => p.id === id))
          .slice(0, 6)
      : [];
  }
  relationshipsOf(person) {
    const links = this.relationshipAdjacency?.get(person.id) || this.relationships.filter((r) => r.a === person.id || r.b === person.id);
    return links
      .map((link) => ({
        link,
        person: this.personIndex?.get(link.a === person.id ? link.b : link.a) || otherPerson(link, person.id, this.people),
      }))
      .filter((entry) => entry.person)
      .sort((a, b) => b.link.affinity - a.link.affinity);
  }
  createDemographicSystem() {
    this.demographics = {
      births: 0,
      marriages: 0,
      separations: 0,
      divorces: 0,
      datingStarted: 0,
      casualRelationships: 0,
      reconciliations: 0,
      estates: 0,
      inheritance: 0,
      nativeBorn: 0,
      pregnancies: [],
      plannedPregnancies: 0,
      unplannedPregnancies: 0,
      pregnancyLosses: 0,
      engagements: 0,
      socialEvents: 0,
      cityFigures: [],
      probateCases: [],
      estateTaxes: 0,
      estateDisputes: 0,
      guardianshipCases: [],
      trustFunds: [],
    };
  }
  createFamilyLifeSystem() {
    this.familyEvents = [];
    this.familyBonds = {};
    this.familyTraditions = [];
    this.familyLife = {
      reunions: 0,
      celebrations: 0,
      birthdays: 0,
      lunches: 0,
      conflicts: 0,
      reconciliations: 0,
      contacts: 0,
      babyShowers: 0,
      anniversaries: 0,
      careCircles: 0,
      networkHistory: {},
      lastNetworkEvent: {},
    };
    this.rebuildKinship({ seedLinks: true });
  }
  characterContext(person, extra = {}) {
    return {
      person,
      trusted: true,
      week: this.week,
      day: this.day,
      absoluteDay: Math.max(0, (this.week - 1) * 7 + this.day),
      dayKey: `${this.week}:${this.day}`,
      actionCategory: person?.activityCategory || person?.currentAction?.category || person?.activity,
      ...extra,
    };
  }
  createCharacterSystem() {
    this.characterSystem = {
      interactions: 0,
      supportiveInteractions: 0,
      conflicts: 0,
      reconciliations: 0,
      newConnections: 0,
      completedGoals: 0,
      rememberedEpisodes: 0,
      rumors: [],
      notableMoments: [],
      dailyLogKey: null,
      dailyLogCount: 0,
      revision: 1,
    };
    this.people.forEach((person) => {
      this.ensureCharacterState(person);
      const household = this.familyOf(person), home = this.buildings.find((building) => building.id === person.homeId);
      const summary = person.age < 18
        ? `Cresceu em ${home?.name || "Vila Esperança"}, cercado pelas referências da família ${person.family}.`
        : person.age >= 60
          ? `Acompanhou transformações da cidade enquanto preservava as raízes ${household?.origin || "locais"} da família.`
          : `Construiu sua rotina em ${home?.name || "Vila Esperança"} a partir das raízes ${household?.origin || "locais"} da família.`;
      person.mind = recordMemory(person.mind, {
        kind: "história pessoal",
        summary,
        week: 1,
        day: 0,
        valence: clamp((person.happiness - 50) * 1.2, -45, 65),
        importance: person.age >= 60 ? 62 : 48,
        actorIds: [...(person.parents || []), person.partnerId].filter(Boolean),
        placeId: person.homeId,
        tags: ["origem", "família", "cidade"],
      }, this.characterContext(person));
    });
    this.relationships.forEach((link) => ensureRelationshipDepth(link));
    this.rebuildRelationshipIndex();
  }
  relationshipProfileFor(person) {
    if (person.relationshipProfile) return person.relationshipProfile;
    const dimensions = person.personality?.dimensions || {}, stability = dimensions.stability ?? 50, agreeableness = dimensions.agreeableness ?? 50, openness = dimensions.openness ?? 50, extraversion = dimensions.extraversion ?? 50, conscientiousness = dimensions.conscientiousness ?? 50;
    const attachmentStyle = stability >= 62 && agreeableness >= 48
      ? "seguro"
      : stability < 38 && extraversion >= 52
        ? "ansioso"
        : agreeableness < 42 || extraversion < 35
          ? "evitativo"
          : "oscilante";
    const conflictStyle = stability >= 62 && agreeableness >= 55
      ? "dialogar e reparar"
      : extraversion >= 68 && stability < 48
        ? "confrontar imediatamente"
        : extraversion < 38
          ? "evitar até se sentir seguro"
          : "precisar de tempo antes de conversar";
    const affectionPriorities = [
      { label: "tempo de qualidade", score: agreeableness + extraversion * .25 },
      { label: "apoio prático", score: conscientiousness + agreeableness * .2 },
      { label: "palavras de reconhecimento", score: extraversion + (person.personality?.empathy || 50) * .25 },
      { label: "autonomia com presença", score: openness + stability * .2 },
      { label: "gestos e lembranças", score: openness * .65 + extraversion * .35 },
    ].sort((a, b) => b.score - a.score).slice(0, 2).map((entry) => entry.label);
    const nonMonogamyPreference = openness >= 76 && conscientiousness < 58 && (person.personality?.riskTolerance || 50) >= 62;
    person.relationshipProfile = {
      attachmentStyle,
      conflictStyle,
      affectionPriorities,
      relationshipModelPreference: nonMonogamyPreference ? "não monogamia consensual" : "monogamia",
      needs: {
        affection: Math.round(clamp(42 + agreeableness * .38, 0, 100)),
        communication: Math.round(clamp(35 + extraversion * .3 + agreeableness * .25, 0, 100)),
        autonomy: Math.round(clamp(35 + openness * .48, 0, 100)),
        stability: Math.round(clamp(35 + conscientiousness * .32 + stability * .3, 0, 100)),
      },
      parenthood: {
        desiredChildren: person.reproductive?.childrenDesired ?? 0,
        desire: Math.round(clamp((person.reproductive?.childrenDesired || 0) * 23 + agreeableness * .22 + (person.personality?.values || []).includes("Família") * 15, 0, 100)),
        timing: person.age < 22 ? "mais tarde" : person.age > 43 ? "decisão sensível ao tempo" : "a conversar",
      },
    };
    return person.relationshipProfile;
  }
  romanticStageForLegacyLink(link) {
    return { casamento: "casamento", noivado: "noivado", viuvez: "viuvez", "união estável": "uniao_estavel", romance: "namoro", namoro: "namoro", ficante: "ficante_casual" }[link?.type] || "paquera";
  }
  sharedChildrenOf(a, b) {
    const bChildren = new Set(b?.children || []);
    return (a?.children || []).filter((id) => bChildren.has(id));
  }
  sharesHousehold(a, b) {
    if (!a || !b || !a.homeId || a.homeId !== b.homeId) return false;
    const householdA = a.householdId || a.familyId, householdB = b.householdId || b.familyId;
    return Boolean(householdA && householdB && householdA === householdB);
  }
  createRelationshipSystem() {
    this.relationshipSystem = {
      flirtations: 0,
      casualConnections: 0,
      datings: 0,
      civilUnions: 0,
      engagements: 0,
      marriages: 0,
      breakups: 0,
      separations: 0,
      divorces: 0,
      reconciliations: 0,
      familyPlanningConversations: 0,
      parentingSupport: 0,
      pendingCohabitation: [],
      transitions: [],
    };
    this.people.forEach((person) => this.relationshipProfileFor(person));
    this.relationships.forEach((link) => {
      if (!["romance", "namoro", "ficante", "união estável", "noivado", "casamento", "viuvez"].includes(link.type)) return;
      const a = this.people.find((person) => person.id === link.a), b = this.people.find((person) => person.id === link.b);
      if (!a || !b) return;
      const stage = this.romanticStageForLegacyLink(link), sharedChildren = this.sharedChildrenOf(a, b), cohabiting = this.sharesHousehold(a, b);
      const familyPlanning = {
        childrenIds: sharedChildren,
        desiredHouseholdChildren: Math.round(((a.reproductive?.childrenDesired || 0) + (b.reproductive?.childrenDesired || 0)) / 2),
        intentions: {
          [a.id]: { desiredChildren: a.reproductive?.childrenDesired || 0, desire: this.relationshipProfileFor(a).parenthood.desire, readiness: a.age >= 22 && a.age <= 44 ? 52 : 28 },
          [b.id]: { desiredChildren: b.reproductive?.childrenDesired || 0, desire: this.relationshipProfileFor(b).parenthood.desire, readiness: b.age >= 22 && b.age <= 44 ? 52 : 28 },
        },
      };
      link.lifecycle = initializeRelationshipLifecycle(a, b, {
        id: `relationship:${link.id}`,
        stage,
        week: Math.max(0, link.startedWeek || link.marriedWeek || 0),
        skipInitialMilestone: true,
        metrics: {
          trust: link.trust,
          attraction: ((link.views?.[a.id]?.attraction || 0) + (link.views?.[b.id]?.attraction || 0)) / 2 || Math.max(48, link.affinity),
          satisfaction: clamp(50 + link.affinity * .42, 0, 100),
          tension: link.tension || 0,
          intimacy: link.familiarity || (stage === "casamento" ? 78 : 55),
          commitment: stage === "casamento" ? 92 : stage === "noivado" ? 86 : 66,
        },
        familyPlanning,
        agreements: this.relationshipProfileFor(a).relationshipModelPreference === "não monogamia consensual" && this.relationshipProfileFor(b).relationshipModelPreference === "não monogamia consensual"
          ? { relationshipModel: "nao_monogamico_consensual", exclusivity: false, socialBoundaries: "acordos explícitos" }
          : undefined,
      });
      link.lifecycle = normalizeRelationshipLifecycle({
        ...link.lifecycle,
        startedWeek: Math.max(0, link.startedWeek || link.marriedWeek || 0),
        stageSinceWeek: Math.max(0, link.stageSinceWeek || link.marriedWeek || 0),
        cohabitation: { active: cohabiting && ["namoro", "uniao_estavel", "noivado", "casamento"].includes(stage), homeId: cohabiting ? a.homeId : null, sinceWeek: cohabiting ? 0 : null },
      }, [a, b], { week: this.week });
      this.syncRelationshipLifecycle(link, a, b);
    });
  }
  isRomanticLink(link) {
    return link?.domain === "romantic" || Boolean(link?.lifecycle) || ["romance", "namoro", "ficante", "união estável", "noivado", "casamento", "viuvez", "ex-relacionamento"].includes(link?.type);
  }
  romanticLinksOf(person, { activeOnly = false } = {}) {
    return this.relationshipsOf(person).filter(({ link }) => this.isRomanticLink(link) && (!activeOnly || link.lifecycle?.status === "active"));
  }
  ensureRelationshipLifecycle(link, a = null, b = null, stage = null) {
    if (!link) return null;
    a ||= this.people.find((person) => person.id === link.a);
    b ||= this.people.find((person) => person.id === link.b);
    if (!a || !b) return null;
    if (!link.lifecycle) link.lifecycle = initializeRelationshipLifecycle(a, b, {
      id: `relationship:${link.id}`,
      stage: stage || this.romanticStageForLegacyLink(link),
      week: this.week,
      metrics: { trust: link.trust, tension: link.tension, intimacy: link.familiarity, satisfaction: clamp(50 + link.affinity * .4, 0, 100) },
    });
    else link.lifecycle = normalizeRelationshipLifecycle(link.lifecycle, [a, b], { week: this.week });
    this.syncRelationshipLifecycle(link, a, b);
    return link.lifecycle;
  }
  syncRelationshipLifecycle(link, a = null, b = null) {
    if (!link?.lifecycle) return;
    a ||= this.people.find((person) => person.id === link.a);
    b ||= this.people.find((person) => person.id === link.b);
    const lifecycle = link.lifecycle, stage = lifecycle.stage;
    link.domain = "romantic";
    link.relationshipStage = stage;
    link.status = lifecycle.status;
    link.startedWeek = lifecycle.startedWeek;
    link.stageSinceWeek = lifecycle.stageSinceWeek;
    link.type = stage === "casamento" ? "casamento" : stage === "noivado" ? "noivado" : stage === "viuvez" ? "viuvez" : ["separado", "divorciado", "encerrado"].includes(stage) ? "ex-relacionamento" : stage === "uniao_estavel" ? "união estável" : "romance";
    link.trust = clamp(link.trust * .65 + lifecycle.metrics.trust * .35, 0, 100);
    link.tension = clamp(link.tension * .65 + lifecycle.metrics.tension * .35, 0, 100);
    link.affinity = clamp(link.affinity * .72 + (lifecycle.metrics.satisfaction * 2 - 100) * .28, -100, 100);
    if (stage === "casamento") link.marriedWeek = lifecycle.legal.marriageWeek ?? lifecycle.stageSinceWeek;
    const primaryStages = ["ficante_exclusivo", "namoro", "uniao_estavel", "noivado", "casamento"];
    if (primaryStages.includes(stage) && lifecycle.status === "active" && a && b) {
      if (!a.partnerId || a.partnerId === b.id) a.partnerId = b.id;
      if (!b.partnerId || b.partnerId === a.id) b.partnerId = a.id;
    }
    if (["separado", "divorciado", "viuvez", "encerrado"].includes(stage) && a && b) {
      if (a.partnerId === b.id) a.partnerId = null;
      if (b.partnerId === a.id) b.partnerId = null;
    }
  }
  recordRelationshipExperience(link, experience) {
    const a = this.people.find((person) => person.id === link?.a), b = this.people.find((person) => person.id === link?.b);
    if (!a || !b) return null;
    this.ensureRelationshipLifecycle(link, a, b);
    link.lifecycle = applyRelationshipExperience(link.lifecycle, { week: this.week, day: this.day, ...experience }, { people: [a, b], week: this.week, day: this.day });
    this.syncRelationshipLifecycle(link, a, b);
    return link.lifecycle;
  }
  legalPartnerOf(person) {
    return this.romanticLinksOf(person, { activeOnly: true })
      .find(({ link }) => link.lifecycle?.legal?.married || link.lifecycle?.legal?.civilUnion)?.person || null;
  }
  ensureCharacterState(person) {
    if (!person) return null;
    this.personIndex?.set(person.id, person);
    if (!person.mind) person.mind = initializeCharacterMind(person, this.characterContext(person));
    else if (!person.mind.emotional || !Array.isArray(person.mind.goals) || !Array.isArray(person.mind.memories)) person.mind = normalizeCharacterMind(person.mind, person, this.characterContext(person));
    person.pendingMindEvents ||= [];
    person.socialContext ||= null;
    person.socialInteractionAt ||= -Infinity;
    return person.mind;
  }
  relationshipKey(a, b) {
    return [a?.id || a, b?.id || b].sort().join(":");
  }
  rebuildRelationshipIndex() {
    this.relationshipIndex = new Map();
    this.relationshipDegree = new Map();
    this.relationshipAdjacency = new Map();
    this.personIndex = new Map(this.people.map((person) => [person.id, person]));
    this.relationships.forEach((link) => {
      this.relationshipIndex.set(this.relationshipKey(link.a, link.b), link);
      this.relationshipDegree.set(link.a, (this.relationshipDegree.get(link.a) || 0) + 1);
      this.relationshipDegree.set(link.b, (this.relationshipDegree.get(link.b) || 0) + 1);
      if (!this.relationshipAdjacency.has(link.a)) this.relationshipAdjacency.set(link.a, []);
      if (!this.relationshipAdjacency.has(link.b)) this.relationshipAdjacency.set(link.b, []);
      this.relationshipAdjacency.get(link.a).push(link);
      this.relationshipAdjacency.get(link.b).push(link);
    });
    return this.relationshipIndex;
  }
  indexNewRelationship(link) {
    if (!link || !this.relationshipIndex || this.relationshipIndex.has(this.relationshipKey(link.a, link.b))) return link;
    this.relationshipIndex.set(this.relationshipKey(link.a, link.b), link);
    this.relationshipDegree.set(link.a, this.relationshipCountFor(link.a) + 1);
    this.relationshipDegree.set(link.b, this.relationshipCountFor(link.b) + 1);
    [link.a, link.b].forEach((personId) => {
      if (!this.relationshipAdjacency.has(personId)) this.relationshipAdjacency.set(personId, []);
      this.relationshipAdjacency.get(personId).push(link);
    });
    return link;
  }
  relationshipCountFor(person) {
    return this.relationshipDegree?.get(person?.id || person) || 0;
  }
  indexedRelationship(a, b) {
    const key = this.relationshipKey(a, b), indexed = this.relationshipIndex?.get(key);
    if (indexed) return indexed;
    const found = relationBetween(this.relationships, a?.id || a, b?.id || b);
    if (found) this.indexNewRelationship(found);
    return found;
  }
  recordCharacterMemory(person, episode) {
    if (!person) return null;
    this.ensureCharacterState(person);
    person.mind = recordMemory(
      person.mind,
      {
        week: this.week,
        day: this.day,
        ...episode,
      },
      this.characterContext(person),
    );
    this.pruneSharedMemoryReferences(person);
    this.characterSystem.rememberedEpisodes++;
    this.characterSystem.revision++;
    return person.mind.memories[0] || null;
  }
  pruneSharedMemoryReferences(person) {
    if (!person) return;
    const links = this.relationshipAdjacency?.get(person.id) || this.relationships.filter((link) => link.a === person.id || link.b === person.id);
    links.forEach((link) => {
      if (!(link.sharedMemoryIds || []).length) return;
      const otherId = link.a === person.id ? link.b : link.a;
      const other = this.personIndex?.get(otherId) || this.people.find((candidate) => candidate.id === otherId);
      const retained = new Set([
        ...(person.mind?.memories || []).map((memory) => memory.id),
        ...(other?.mind?.memories || []).map((memory) => memory.id),
      ]);
      link.sharedMemoryIds = link.sharedMemoryIds.filter((id) => retained.has(id)).slice(0, 20);
    });
  }
  queueCharacterEvent(person, event) {
    if (!person) return;
    person.pendingMindEvents ||= [];
    person.pendingMindEvents.push({
      week: this.week,
      day: this.day,
      remember: false,
      ...event,
    });
    person.pendingMindEvents = person.pendingMindEvents.slice(-12);
  }
  clearSocialContext(person) {
    const context = person?.socialContext;
    if (!context) return;
    person.socialContext = null;
    const counterpart = this.people.find((candidate) => candidate.id === context.counterpartId);
    if (counterpart?.socialContext?.counterpartId === person.id && counterpart.socialContext.interactionId === context.interactionId) counterpart.socialContext = null;
  }
  updateCharacterDay(person, context = {}) {
    if (!person?.alive) return;
    this.ensureCharacterState(person);
    const previousMemoryIds = new Set(person.mind.memories.map((memory) => memory.id));
    const events = (person.pendingMindEvents || []).splice(0, 12);
    person.mind = updateCharacterMindDaily(
      person.mind,
      person,
      this.characterContext(person, { events, ...context }),
    );
    const emotional = person.mind.emotional;
    person.personality.lifeSatisfaction = clamp(
      person.personality.lifeSatisfaction * .92 + ((emotional.valence + 100) / 2) * .08,
      0,
      100,
    );
    if (person.medical) {
      person.medical.mentalHealth = clamp(
        (person.medical.mentalHealth ?? 75) + (emotional.stress >= 78 ? -.45 : emotional.stress <= 34 ? .14 : 0),
        0,
        100,
      );
    }
    if (person.socialContext?.expiresAt <= this.absoluteMinute()) this.clearSocialContext(person);
    if (person.socialIntent?.expiresAt <= this.absoluteMinute()) person.socialIntent = null;
    if (previousMemoryIds.size !== person.mind.memories.length || person.mind.memories.some((memory) => !previousMemoryIds.has(memory.id))) this.pruneSharedMemoryReferences(person);
  }
  planCharacterSocialSupport() {
    const supportCandidates = this.people
      .filter((person) => person.alive && !person.justice.incarcerated && !person.medical.admitted && !person.socialIntent && (person.mind?.emotional?.stress >= 68 || person.needs.social < 30 || person.mind?.goals?.some((goal) => goal.status === "active" && ["belonging", "relationship", "family_care"].includes(goal.type))))
      .sort((a, b) => (b.mind?.emotional?.stress || 0) - (a.mind?.emotional?.stress || 0))
      .slice(0, Math.max(4, Math.ceil(this.people.filter((person) => person.alive).length / 28)));
    const planned = new Set();
    supportCandidates.forEach((person) => {
      if (planned.has(person.id)) return;
      const connection = this.relationshipsOf(person)
        .filter(({ person: other, link }) => other.alive && !other.justice.incarcerated && !other.medical.admitted && !planned.has(other.id) && (person.age >= 16 || link.type === "família") && link.trust >= 48)
        .sort((a, b) => b.link.trust + b.link.affinity * .35 - (a.person.homeId === person.homeId ? 12 : 0) - (a.person.mind?.emotional?.stress || 0) * .12)[0];
      if (!connection || Math.random() > .58) return;
      const familyMeeting = connection.link.type === "família", café = this.buildings.find((building) => building.name === "Café do Largo"), park = this.buildings.find((building) => building.type === "park");
      const meetingPlace = familyMeeting ? this.buildings.find((building) => building.id === connection.person.homeId) : (Math.random() < .58 ? café : park);
      if (!meetingPlace) return;
      const intentId = uid("social-plan"), reason = person.mind.emotional.stress >= 68 ? "buscar apoio e conversar" : "fortalecer o vínculo";
      person.socialIntent = { id:intentId, counterpartId:connection.person.id, placeId:meetingPlace.id, reason, createdWeek:this.week, createdDay:this.day, expiresAt:this.absoluteMinute()+1380 };
      person.needsDestinationDecision = true;
      if (!connection.person.socialIntent) {
        connection.person.socialIntent = { id:intentId, counterpartId:person.id, placeId:meetingPlace.id, reason:`encontrar ${person.firstName}`, createdWeek:this.week, createdDay:this.day, expiresAt:this.absoluteMinute()+1380 };
        connection.person.needsDestinationDecision = true;
      }
      planned.add(person.id); planned.add(connection.person.id);
    });
    this.characterSystem.rumors = this.characterSystem.rumors
      .filter((rumor) => this.week - rumor.week <= 8)
      .slice(0, 80);
  }
  dailyCharacterLife() {
    this.people.filter((person) => person.alive).forEach((person) => this.updateCharacterDay(person));
    this.planCharacterSocialSupport();
  }
  queueDailyCharacterLife() {
    this.characterDailyQueue = {
      ids: this.people.filter((person) => person.alive).map((person) => person.id),
      context: {
        week: this.week,
        day: Math.min(6, this.day),
        absoluteDay: Math.max(0, (this.week - 1) * 7 + Math.min(6, this.day)),
        dayKey: `${this.week}:${Math.min(6, this.day)}`,
      },
    };
  }
  processCharacterDailyQueue(limit = 40) {
    if (!this.characterDailyQueue?.ids?.length) return 0;
    const batch = this.characterDailyQueue.ids.splice(0, limit);
    batch.forEach((id) => this.updateCharacterDay(this.people.find((person) => person.id === id), this.characterDailyQueue.context));
    if (!this.characterDailyQueue.ids.length) {
      this.characterDailyQueue = null;
      this.planCharacterSocialSupport();
    }
    return batch.length;
  }
  updateCharacterWeek(person, queue) {
    this.ensureCharacterState(person);
    const previousCompleted = new Set(person.mind.goals.filter((goal) => goal.status === "completed").map((goal) => goal.id));
    person.mind = updateCharacterMindWeekly(
      person.mind,
      person,
      this.characterContext(person),
    );
    const newlyCompleted = person.mind.goals.filter((goal) => goal.status === "completed" && !previousCompleted.has(goal.id));
    newlyCompleted.forEach((goal) => {
      this.characterSystem.completedGoals++;
      person.history.push({ week: this.week, text: `Alcançou um objetivo pessoal: ${goal.title}.` });
      if (queue.announcements < 2 && goal.priority >= 68) {
        this.log("trajetória", `${person.name} alcançou o objetivo pessoal “${goal.title.toLowerCase()}”.`, "social");
        queue.announcements++;
      }
    });
  }
  finishCharacterWeek() {
    const retainedMemoryIds = new Set(this.people.flatMap((person) => (person.mind?.memories || []).map((memory) => memory.id)));
    this.relationships.forEach((link) => {
      link.sharedMemoryIds = (link.sharedMemoryIds || []).filter((id) => retainedMemoryIds.has(id)).slice(0, 20);
    });
    this.relationships.forEach((link) => decayRelationship(link, this.week));
    this.pruneDormantRelationships();
    this.trimLongHistories();
    this.rebuildRelationshipIndex();
    this.weeklyRemoteContacts();
    this.characterSystem.revision++;
  }
  weeklyCharacterLife({ defer = false } = {}) {
    this.characterWeeklyQueue = {
      ids: this.people.filter((person) => person.alive).map((person) => person.id),
      announcements: 0,
      week: this.week,
    };
    if (defer) return;
    this.processCharacterWeeklyQueue(Infinity);
  }
  processCharacterWeeklyQueue(limit = 32) {
    if (!this.characterWeeklyQueue) return 0;
    const batch = this.characterWeeklyQueue.ids.splice(0, limit);
    batch.forEach((id) => {
      const person = this.people.find((candidate) => candidate.id === id);
      if (person?.alive) this.updateCharacterWeek(person, this.characterWeeklyQueue);
    });
    if (!this.characterWeeklyQueue.ids.length) {
      this.finishCharacterWeek();
      this.characterWeeklyQueue = null;
    }
    return batch.length;
  }
  pruneDormantRelationships() {
    const removable = new Set(["conhecido", "vizinhança", "colega"]);
    this.relationships = this.relationships.filter((link) => {
      const inactiveWeeks = this.week - (link.lastInteractionWeek || 1);
      if (
        link.type === "amizade" &&
        inactiveWeeks >= 52 &&
        link.trust < 38 &&
        link.affinity < 34 &&
        !(link.sharedMemoryIds || []).length
      ) link.type = "conhecido";
      if (!removable.has(link.type)) return true;
      const a = this.people.find((person) => person.id === link.a), b = this.people.find((person) => person.id === link.b);
      const stillCoworkers = a?.businessId && a.businessId === b?.businessId;
      const stillClassmates = a?.education?.enrolled && b?.education?.enrolled && a.education.institution === b.education.institution && a.education.stage === b.education.stage;
      if (link.type === "colega" && (stillCoworkers || stillClassmates)) return true;
      const inactivityThreshold = (link.interactions || 0) === 0 ? 26 : 52;
      return !(inactiveWeeks >= inactivityThreshold && link.trust < 30 && link.affinity < 32 && !(link.sharedMemoryIds || []).length);
    });
  }
  trimLongHistories() {
    const newest = (entries, limit) => {
      if (!Array.isArray(entries) || entries.length <= limit) return entries || [];
      return entries
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => (b.entry?.week || 0) - (a.entry?.week || 0) || a.index - b.index)
        .slice(0, limit)
        .map(({ entry }) => entry);
    };
    this.people.forEach((person) => {
      person.history = newest(person.history, 180);
      if (person.justice) person.justice.history = newest(person.justice.history, 140);
      if (person.medical) person.medical.history = newest(person.medical.history, 140);
      if (person.education) person.education.history = newest(person.education.history, 100);
    });
    this.families.forEach((family) => (family.milestones = newest(family.milestones, 80)));
  }
  weeklyRemoteContacts() {
    this.relationships
      .filter((link) => {
        const a = this.people.find((person) => person.id === link.a), b = this.people.find((person) => person.id === link.b);
        ensureRelationshipDepth(link);
        return a?.alive && b?.alive && !a.justice.incarcerated && !b.justice.incarcerated &&
          a.homeId !== b.homeId && link.trust >= 58 && (link.interactions || 0) === 0 && Math.random() < .13;
      })
      .slice(0, Math.max(4, Math.ceil(this.people.filter((person) => person.alive).length / 35)))
      .forEach((link) => {
        const a = this.people.find((person) => person.id === link.a), b = this.people.find((person) => person.id === link.b);
        const text = link.type === "família" ? "mantiveram contato por telefone e atualizaram as notícias da família" : "trocaram mensagens e mantiveram o vínculo apesar da distância";
        const interaction = {
          id: "remote-contact",
          tone: "positive",
          text,
          effects: { affinity: 1, trust: .8, respect: .2, tension: -1.2, happiness: .2, social: 2, stress: -.5 },
          memory: { emotion: "proximidade", valence: .3, salience: 20 },
          notable: false,
        };
        applyInteractionEffects(a, b, link, interaction, { week: this.week, day: 0, time: "contato remoto", placeId: null });
        [a, b].forEach((person, index) => {
          const other = index ? a : b;
          person.actionLog.unshift({ week:this.week, day:0, time:"contato remoto", activity:`Contato com ${other.name}`, place:"À distância", peopleIds:[other.id], interactionId:"remote-contact" });
          person.actionLog = person.actionLog.slice(0, 24);
          this.queueCharacterEvent(person, { kind:"social", summary:text, valence:interaction.memory.valence, importance:interaction.memory.salience, stressImpact:interaction.effects.stress || 0 });
        });
      });
  }
  dominantGoal(person) {
    this.ensureCharacterState(person);
    return person.mind.goals.filter((goal) => goal.status === "active").sort((a, b) => b.priority - a.priority)[0] || null;
  }
  orientationCompatible(a, b) {
    const attracted = (person, other) => {
      if (person.orientation === "bissexual") return true;
      if (person.orientation === "homossexual") return person.identity === other.identity;
      if (person.orientation === "heterossexual") return person.identity !== other.identity;
      return true;
    };
    return attracted(a, b) && attracted(b, a);
  }
  rebuildKinship({ seedLinks = false } = {}) {
    const previousNetworks = this.familyNetworks || [];
    if (this.kinship) this.kinship.rebuild(this.people, this.relationships);
    else this.kinship = buildKinshipIndex(this.people, this.relationships);
    if (seedLinks) {
      if (this.ensureKinshipRelationshipLinks()) this.kinship.rebuild(this.people, this.relationships);
    }
    const usedNetworkIds = new Set();
    this.people.forEach((person) => (person.familyNetworkId = null));
    this.familyNetworks = this.kinship.extendedFamilyGroups({ includePartners: true, livingOnly: false, minSize: 2 }).map((group, index) => {
      const living = group.members.filter((person) => person.alive);
      const oldest = living.slice().sort((a, b) => b.age - a.age)[0] || group.members[0];
      const surname = oldest?.family || group.surnames[0] || `Rede ${index + 1}`;
      const previous = previousNetworks
        .map((network) => ({ network, overlap: network.memberIds.filter((id) => group.memberIds.includes(id)).length }))
        .filter((entry) => entry.overlap > 0 && !usedNetworkIds.has(entry.network.id))
        .sort((a, b) => b.overlap - a.overlap || b.network.memberIds.length - a.network.memberIds.length)[0]?.network;
      let networkId = previous?.id || (group.rootIds.length ? `family-network-${group.rootIds.slice().sort().join("-")}` : `family-network-${index + 1}`);
      while (usedNetworkIds.has(networkId)) networkId = `${networkId}-${index + 1}`;
      usedNetworkIds.add(networkId);
      const network = {
        ...group,
        id: networkId,
        name: `Família ${surname}`,
        livingMembers: living,
        elderId: oldest?.id || null,
        householdCount: new Set(living.map((person) => person.householdId || person.familyId).filter(Boolean)).size,
      };
      living.forEach((person) => (person.familyNetworkId = network.id));
      return network;
    });
    if (previousNetworks.length) {
      const networkIdRemap = new Map();
      previousNetworks.forEach((previous) => {
        const replacement = this.familyNetworks
          .map((network) => ({ network, overlap: previous.memberIds.filter((id) => network.memberIds.includes(id)).length }))
          .sort((a, b) => b.overlap - a.overlap || b.network.memberIds.length - a.network.memberIds.length)[0];
        if (replacement?.overlap) networkIdRemap.set(previous.id, replacement.network.id);
      });
      const currentIds = new Set(this.familyNetworks.map((network) => network.id));
      (this.familyEvents || []).forEach((event) => {
        if (!event.familyNetworkId || currentIds.has(event.familyNetworkId)) return;
        const remapped = networkIdRemap.get(event.familyNetworkId);
        if (remapped) event.familyNetworkId = remapped;
        else {
          event.legacyFamilyNetworkId = event.familyNetworkId;
          event.familyNetworkId = null;
        }
      });
      (this.familyTraditions || []).forEach((tradition) => {
        if (!tradition.familyNetworkId || currentIds.has(tradition.familyNetworkId)) return;
        const remapped = networkIdRemap.get(tradition.familyNetworkId);
        if (remapped) tradition.familyNetworkId = remapped;
        else {
          tradition.legacyFamilyNetworkId = tradition.familyNetworkId;
          tradition.familyNetworkId = null;
        }
      });
      if (this.familyLife?.networkHistory) {
        const migratedHistory = {};
        Object.entries(this.familyLife.networkHistory).forEach(([networkId, entries]) => {
          const targetId = networkIdRemap.get(networkId) || networkId;
          migratedHistory[targetId] = [...(migratedHistory[targetId] || []), ...entries]
            .sort((a, b) => b.week - a.week)
            .slice(0, 20);
        });
        this.familyLife.networkHistory = migratedHistory;
      }
      if (this.familyLife?.lastNetworkEvent) {
        const migratedEvents = {};
        Object.entries(this.familyLife.lastNetworkEvent).forEach(([networkId, value]) => {
          const targetId = networkIdRemap.get(networkId) || networkId;
          if (!migratedEvents[targetId] || (value?.week || 0) >= (migratedEvents[targetId]?.week || 0)) migratedEvents[targetId] = value;
        });
        this.familyLife.lastNetworkEvent = migratedEvents;
      }
    }
    this.kinshipDirty = false;
    return this.kinship;
  }
  ensureKinshipRelationshipLinks() {
    const visited = new Set();
    let changed = false;
    this.people.forEach((person) => {
      this.kinship.relativesOf(person, { includePartners: false, maxDistance: 6 }).forEach((entry) => {
        const relative = entry.person, relation = entry.relation;
        if (!relative || !relation?.consanguineous) return;
        if ((relation.distance || entry.distance || 99) > 4 && !["ancestor", "descendant"].includes(relation.kind)) return;
        const key = [person.id, relative.id].sort().join(":");
        if (visited.has(key)) return;
        visited.add(key);
        let link = this.indexedRelationship(person, relative);
        const affinity = ["parent", "child"].includes(relation.kind) ? 88 : ["sibling", "half-sibling"].includes(relation.kind) ? 78 : relation.distance <= 2 ? 72 : 58;
        if (!link) {
          link = { id: uid("rel"), a: person.id, b: relative.id, type: "família", affinity, trust: Math.max(54, affinity - 4), interactions: 0, lastEvent: "Vínculo genealógico reconhecido", history: [] };
          this.relationships.push(link);
          this.indexNewRelationship(link);
          changed = true;
        } else if (["amizade", "romance", "namoro", "ficante", "união estável", "noivado", "casamento"].includes(link.type) || link.lifecycle?.status === "active") {
          link.type = "família";
          link.domain = "family";
          link.lifecycle = null;
          link.relationshipStage = null;
          link.affinity = Math.max(link.affinity, affinity);
          link.trust = Math.max(link.trust, affinity - 4);
          link.history ||= [];
          link.history.unshift({ week: this.week, text: `Parentesco reconhecido: ${relation.label}.` });
          if (person.partnerId === relative.id) person.partnerId = null;
          if (relative.partnerId === person.id) relative.partnerId = null;
          changed = true;
        }
      });
    });
    return changed;
  }
  kinshipOf(person) {
    if (!person || !this.kinship) return [];
    return this.kinship.relativesOf(person, { includePartners: true, livingOnly: false, maxDistance: 8 }).map((entry) => ({
      person: entry.person,
      relation: entry.relation,
      label: entry.relation?.label || "parente",
      degree: entry.relation?.degree ?? null,
      blood: Boolean(entry.relation?.consanguineous),
      byAffinity: Boolean(entry.relation?.byAffinity),
      genealogicalDistance: entry.distance,
      distance: (() => {
        const home = this.buildings.find((building) => building.id === entry.person.homeId), subjectHome = this.buildings.find((building) => building.id === person.homeId);
        return home && subjectHome ? Math.hypot(home.x - subjectHome.x, home.y - subjectHome.y) : undefined;
      })(),
      sameHousehold: entry.person.householdId === person.householdId,
      proximity: this.familyProximity(person, entry.person),
    }));
  }
  extendedFamilyOf(person) {
    return this.familyNetworks?.find((network) => network.memberIds.includes(person?.id)) || null;
  }
  familyNetworkOf(person) {
    return this.extendedFamilyOf(person);
  }
  familyBondKey(a, b) {
    return [a?.id || a, b?.id || b].sort().join(":");
  }
  ensureFamilyBond(a, b, relation = null) {
    if (!a || !b || a.id === b.id) return null;
    const key = this.familyBondKey(a, b), kind = relation?.kind || this.kinship?.relationBetween(a, b)?.kind || "extended-family";
    if (!this.familyBonds[key]) {
      const baseline = ["parent", "child"].includes(kind) ? 84 : ["sibling", "half-sibling"].includes(kind) ? 74 : ["ancestor", "descendant"].includes(kind) ? 68 : ["uncle-aunt", "nephew-niece"].includes(kind) ? 58 : kind === "cousin" ? 50 : kind === "partner" ? 86 : 44;
      this.familyBonds[key] = { personIds: [a.id, b.id], kind, proximity: baseline, trust: Math.max(40, baseline - 5), tension: Math.max(0, 18 - Math.round(baseline / 8)), contactFrequency: this.sharesHousehold(a, b) ? "diário" : baseline >= 68 ? "semanal" : "mensal", lastContactWeek: 0, sharedEvents: 0, history: [] };
    }
    return this.familyBonds[key];
  }
  familyProximity(a, b) {
    const existing = this.familyBonds?.[this.familyBondKey(a, b)];
    if (existing) return Math.round(existing.proximity);
    const relation = this.kinship?.relationBetween(a, b);
    return relation ? this.ensureFamilyBond(a, b, relation)?.proximity || 0 : 0;
  }
  canFormRomance(a, b) {
    if (!a?.alive || !b?.alive || a.id === b.id || a.age < 18 || b.age < 18) return false;
    const relation = this.kinship?.relationBetween(a, b, { includeAffinity: true });
    if (!relation) return true;
    if (["step-parent", "step-child", "parent-in-law", "child-in-law"].includes(relation.kind)) return false;
    if (!relation.consanguineous) return true;
    if (["parent", "child", "sibling", "half-sibling", "ancestor", "descendant", "uncle-aunt", "nephew-niece"].includes(relation.kind)) return false;
    if (relation.kind === "cousin" && (relation.degree || 1) <= 2) return false;
    return (relation.distance || Infinity) > 6;
  }
  scheduleFamilyEvent({ network, type, name, participantIds, hostId = null, location = "Parque das Mangueiras", day = 6, start = 11, end = 16, importance = "cotidiano" }) {
    const participants = [...new Set(participantIds || [])].filter((id) => this.people.find((person) => person.id === id)?.alive);
    if (participants.length < 2 || this.familyEvents.some((event) => event.week === this.week && event.type === type && event.hostId === hostId && event.familyNetworkId === network?.id)) return null;
    const accepted = participants.filter((id) => id === hostId || Math.random() < (type === "birthday" ? .82 : .7));
    const event = {
      id: uid("family-event"), familyEvent: true, familyNetworkId: network?.id || null, type, name, week: this.week, day, start, end, location,
      hostId, participantIds: participants, participants: accepted, invitedIds: participants, attendedIds: [], attendance: 0, status: "scheduled", importance,
      rsvp: { acceptedIds: accepted, declinedIds: participants.filter((id) => !accepted.includes(id)), pendingIds: [] },
      remaining: 1, duration: 1, season: this.events.season, consequencesApplied: false, outcome: null,
    };
    this.familyEvents.unshift(event);
    this.events.active.push(event);
    if (["sazonal", "marco familiar"].includes(importance)) this.log("evento", `${name} entrou na agenda e mobiliza ${accepted.length} familiar(es).`, "social");
    return event;
  }
  scheduleFamilyEvents() {
    const birthdayPeople = this.people.filter((person) => person.alive && person.birthdayWeek === ((this.week - 1) % 52) + 1 && person.bornWeek !== this.week);
    birthdayPeople.forEach((host) => {
      const network = this.extendedFamilyOf(host), family = this.kinshipOf(host).filter((entry) => entry.person.alive).sort((a, b) => b.proximity - a.proximity).slice(0, 14).map((entry) => entry.person.id);
      const friends = this.relationshipsOf(host).filter((entry) => entry.person.alive && entry.link.type === "amizade" && entry.link.affinity > 42).slice(0, 6).map((entry) => entry.person.id);
      const home = this.buildings.find((building) => building.id === host.homeId);
      const event = this.scheduleFamilyEvent({ network, type: "birthday", name: `Aniversário de ${host.firstName}`, participantIds: [host.id, ...family, ...friends], hostId: host.id, location: host.age < 16 ? home?.name || "Residência" : "Café do Largo", day: 5, start: host.age < 12 ? 15 : 19, end: host.age < 12 ? 19 : 23, importance: "pessoal" });
      if (event) this.familyLife.birthdays++;
    });
    this.demographics.pregnancies
      .filter((pregnancy) => pregnancy.status === "active" && pregnancy.weeks >= 22 && pregnancy.weeks <= 32 && !pregnancy.celebrationEventId)
      .slice(0, 2)
      .forEach((pregnancy) => {
        const parents = pregnancy.parentIds.map((id) => this.people.find((person) => person.id === id)).filter((person) => person?.alive);
        const host = this.people.find((person) => person.id === pregnancy.carrierId) || parents[0];
        if (!host || parents.length < 2) return;
        const network = this.extendedFamilyOf(host);
        const relatives = parents.flatMap((parent) => this.kinshipOf(parent).filter((entry) => entry.person.alive).sort((a, b) => b.proximity - a.proximity).slice(0, 10).map((entry) => entry.person.id));
        const friends = parents.flatMap((parent) => this.relationshipsOf(parent).filter((entry) => entry.person.alive && entry.link.type === "amizade" && entry.link.affinity > 48).slice(0, 4).map((entry) => entry.person.id));
        const home = this.buildings.find((building) => building.id === host.homeId);
        const event = this.scheduleFamilyEvent({ network, type: "baby-shower", name: `Encontro de boas-vindas ao bebê de ${parents.map((parent) => parent.firstName).join(" e ")}`, participantIds: [...parents.map((parent) => parent.id), ...relatives, ...friends], hostId: host.id, location: home?.name || "Parque das Mangueiras", day: 5, start: 15, end: 19, importance: "marco familiar" });
        if (event) {
          event.pregnancyId = pregnancy.id;
          pregnancy.celebrationEventId = event.id;
          this.familyLife.babyShowers++;
        }
      });
    const anniversaryLinks = this.relationships
      .filter((link) => link.type === "casamento" && link.lifecycle?.status === "active" && Number.isFinite(link.marriedWeek) && this.week > link.marriedWeek && (this.week - link.marriedWeek) % 52 === 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    const anniversaryOffset = anniversaryLinks.length ? (Math.floor(this.week / 52) * 2) % anniversaryLinks.length : 0;
    Array.from({ length: Math.min(2, anniversaryLinks.length) }, (_, index) => anniversaryLinks[(anniversaryOffset + index) % anniversaryLinks.length])
      .forEach((link) => {
        const couple = [link.a, link.b].map((id) => this.people.find((person) => person.id === id)).filter((person) => person?.alive);
        if (couple.length < 2) return;
        const network = this.extendedFamilyOf(couple[0]);
        const guests = couple.flatMap((person) => this.relationshipsOf(person).filter((entry) => entry.person.alive && entry.link.affinity > 52).slice(0, 8).map((entry) => entry.person.id));
        const event = this.scheduleFamilyEvent({ network, type: "relationship-anniversary", name: `Aniversário de união de ${couple[0].firstName} e ${couple[1].firstName}`, participantIds: [...couple.map((person) => person.id), ...guests], hostId: couple[0].id, location: "Restaurante Sabor da Vila", day: 5, start: 19, end: 23, importance: "pessoal" });
        if (event) {
          event.relationshipId = link.id;
          this.familyLife.anniversaries++;
        }
      });
    this.people
      .filter((person) => person.alive && person.medical.admitted && this.extendedFamilyOf(person)?.livingMembers.length >= 3 && !this.familyEvents.some((event) => event.type === "care-circle" && event.patientId === person.id && this.week - event.week < 4))
      .sort((a, b) => {
        const lastA = this.familyEvents.find((event) => event.type === "care-circle" && event.patientId === a.id)?.week ?? -Infinity;
        const lastB = this.familyEvents.find((event) => event.type === "care-circle" && event.patientId === b.id)?.week ?? -Infinity;
        return lastA - lastB || a.id.localeCompare(b.id);
      })
      .slice(0, 1)
      .forEach((patient) => {
        const network = this.extendedFamilyOf(patient);
        const event = this.scheduleFamilyEvent({ network, type: "care-circle", name: `Rede de cuidado de ${patient.firstName}`, participantIds: network.livingMembers.slice(0, 14).map((person) => person.id), hostId: patient.partnerId || network.elderId, location: "Hospital São Lucas", day: 5, start: 16, end: 19, importance: "familiar" });
        if (event) {
          event.patientId = patient.id;
          this.familyLife.careCircles++;
        }
      });
    const eligible = (this.familyNetworks || []).filter((network) => network.livingMembers.length >= 3);
    if (eligible.length) {
      const count = Math.min(2, eligible.length), offset = (this.week * count) % eligible.length;
      for (let index = 0; index < count; index++) {
        const network = eligible[(offset + index) % eligible.length], elder = this.people.find((person) => person.id === network.elderId), home = this.buildings.find((building) => building.id === elder?.homeId);
        const event = this.scheduleFamilyEvent({ network, type: "family-lunch", name: `Almoço da ${network.name}`, participantIds: network.livingMembers.slice(0, 18).map((person) => person.id), hostId: elder?.id, location: home?.name || "Parque das Mangueiras", day: 6, start: 11, end: 16, importance: "familiar" });
        if (event) this.familyLife.lunches++;
      }
      if (this.week % 13 === 0) {
        const network = eligible[(this.week / 13) % eligible.length | 0];
        const event = this.scheduleFamilyEvent({ network, type: "family-reunion", name: `Grande encontro da ${network.name}`, participantIds: network.livingMembers.map((person) => person.id), hostId: network.elderId, location: "Parque das Mangueiras", day: 6, start: 10, end: 18, importance: "marco familiar" });
        if (event) this.familyLife.reunions++;
      }
      const seasonal = { 1: ["Ano-Novo em família", "new-year"], 15: ["Almoço de Páscoa", "easter"], 19: ["Celebração de quem cuida", "caregivers"], 25: ["Arraiá das famílias", "june-party"], 32: ["Encontro entre gerações", "generations"], 51: ["Ceia de fim de ano", "year-end"] }[((this.week - 1) % 52) + 1];
      if (seasonal) Array.from({ length: Math.min(4, eligible.length) }, (_, index) => eligible[(this.week * 4 + index) % eligible.length]).forEach((network, index) => {
        const event = this.scheduleFamilyEvent({ network, type: seasonal[1], name: `${seasonal[0]} — ${network.name}`, participantIds: network.livingMembers.slice(0, 24).map((person) => person.id), hostId: network.elderId, location: index % 2 ? "Parque das Mangueiras" : this.buildings.find((building) => building.id === this.people.find((person) => person.id === network.elderId)?.homeId)?.name || "Residência", day: 6, start: seasonal[1] === "year-end" ? 19 : 11, end: seasonal[1] === "year-end" ? 24 : 17, importance: "sazonal" });
        if (event) {
          this.familyLife.celebrations++;
          if (!this.familyTraditions.some((tradition) => tradition.familyNetworkId === network.id && tradition.type === seasonal[1])) this.familyTraditions.push({ id: uid("tradition"), familyNetworkId: network.id, type: seasonal[1], name: seasonal[0], foundedWeek: this.week, editions: 1 });
          else this.familyTraditions.find((tradition) => tradition.familyNetworkId === network.id && tradition.type === seasonal[1]).editions++;
        }
      });
    }
    this.familyEvents = this.familyEvents.slice(0, 240);
    this.demographics.socialEvents += this.familyEvents.filter((event) => event.week === this.week).length;
  }
  weeklyFamilyLife() {
    this.normalizeHouseholds();
    if (this.kinshipDirty) this.rebuildKinship({ seedLinks: true });
    Object.values(this.familyBonds).forEach((bond) => {
      const people = bond.personIds.map((id) => this.people.find((person) => person.id === id));
      if (people.some((person) => !person?.alive)) return;
      if (bond.lastContactWeek < this.week - 4) bond.proximity = clamp(bond.proximity - .8, 0, 100);
      if (this.sharesHousehold(people[0], people[1])) {
        bond.proximity = clamp(bond.proximity + .4, 0, 100);
        bond.lastContactWeek = this.week;
      }
    });
    (this.familyNetworks || []).forEach((network) => {
      const members = network.livingMembers;
      if (members.length < 2) return;
      const a = members[this.week % members.length], b = members[(this.week * 3 + 1) % members.length];
      if (a.id === b.id) return;
      const link = relationBetween(this.relationships, a.id, b.id);
      const actualContact = this.sharesHousehold(a, b) || (link?.lastInteractionWeek === Math.max(0, this.week - 1));
      if (!actualContact) return;
      const bond = this.ensureFamilyBond(a, b, this.kinship.relationBetween(a, b));
      bond.proximity = clamp(bond.proximity + 1.2, 0, 100); bond.lastContactWeek = this.week; this.familyLife.contacts++;
    });
  }
  dailyFamilyLife() {
    this.familyEvents.filter((event) => event.status === "finished" && !event.consequencesApplied).forEach((event) => {
      if (!(event.attendedIds || []).length && this.predictiveMode) {
        const eligible = (event.rsvp?.acceptedIds || event.participants || []).filter((id) => {
          const person = this.people.find((candidate) => candidate.id === id);
          return person?.alive && !this.isPlayerControlled(person) && !person.justice?.incarcerated && !person.medical?.admitted;
        });
        const target = Math.max(2, Math.round(eligible.length * (.62 + Math.random() * .22)));
        event.attendedIds = eligible.sort(() => Math.random() - .5).slice(0, target);
      }
      const attended = [...new Set(event.attendedIds || [])].map((id) => this.people.find((person) => person.id === id)).filter((person) => person?.alive);
      event.attendance = attended.length;
      if (!attended.length) {
        event.outcome = "cancelado por ausência de participantes disponíveis";
        event.status = "cancelled";
        event.consequencesApplied = true;
        const host = this.people.find((person) => person.id === event.hostId);
        if (host?.alive) host.history.push({ week: this.week, text: `${event.name} foi cancelado por falta de presença.` });
        if (event.familyNetworkId) {
          this.familyLife.networkHistory[event.familyNetworkId] ||= [];
          this.familyLife.networkHistory[event.familyNetworkId].unshift({ week: this.week, eventId: event.id, text: `${event.name} foi cancelado por falta de presença.` });
          this.familyLife.networkHistory[event.familyNetworkId] = this.familyLife.networkHistory[event.familyNetworkId].slice(0, 20);
        }
        return;
      }
      for (let i = 0; i < attended.length; i++) for (let j = i + 1; j < Math.min(attended.length, i + 7); j++) {
        const a = attended[i], b = attended[j], relation = this.kinship.relationBetween(a, b);
        if (!relation) continue;
        const bond = this.ensureFamilyBond(a, b, relation);
        bond.proximity = clamp(bond.proximity + (event.type === "family-reunion" ? 3 : 1.5), 0, 100); bond.trust = clamp(bond.trust + .7, 0, 100); bond.tension = clamp(bond.tension - 1, 0, 100); bond.lastContactWeek = this.week; bond.sharedEvents++;
        const socialLink = this.indexedRelationship(a, b);
        if (socialLink?.lifecycle?.status === "active") this.recordRelationshipExperience(socialLink, { kind: "evento_familiar", text: `Participaram juntos de ${event.name}.`, tone: "positive", valence: 42, importance: 38, placeId: this.buildings.find((building) => building.name === event.location)?.id || null });
      }
      attended.forEach((person) => { person.needs.social = clamp(person.needs.social + 12, 0, 100); person.happiness = clamp(person.happiness + 2, 0, 100); });
      if (event.type === "baby-shower") {
        const pregnancy = this.demographics.pregnancies.find((candidate) => candidate.id === event.pregnancyId);
        if (pregnancy?.status === "active") {
          pregnancy.health = clamp(pregnancy.health + Math.min(6, 2 + attended.length * .18), 0, 100);
          pregnancy.supportNetworkIds = [...new Set([...(pregnancy.supportNetworkIds || []), ...attended.map((person) => person.id)])].slice(0, 24);
          pregnancy.babySupplies = (pregnancy.babySupplies || 0) + Math.max(2, Math.round(attended.length * .7));
          event.systemicEffect = `${pregnancy.supportNetworkIds.length} pessoas passaram a integrar a rede de apoio da gestação`;
        }
      }
      if (event.type === "relationship-anniversary") {
        const link = this.relationships.find((candidate) => candidate.id === event.relationshipId);
        if (link) {
          ensureRelationshipDepth(link);
          link.affinity = clamp(link.affinity + 3, -100, 100);
          link.trust = clamp(link.trust + 2, 0, 100);
          link.tension = clamp(link.tension - 4, 0, 100);
          if (link.lifecycle) this.recordRelationshipExperience(link, { kind: "celebracao", text: "Celebraram a história construída e renovaram compromissos.", tone: "positive", valence: 78, importance: 70, milestone: true });
          event.systemicEffect = "o vínculo do casal foi reforçado pela celebração";
        }
      }
      if (event.type === "care-circle") {
        const patient = this.people.find((person) => person.id === event.patientId);
        if (patient?.alive) {
          patient.happiness = clamp(patient.happiness + 5, 0, 100);
          patient.medical.mentalHealth = clamp((patient.medical.mentalHealth ?? 70) + 4, 0, 100);
          patient.bereavement ||= { active: [], leaveDays: 0, visitToday: null };
          event.systemicEffect = `${patient.name} recebeu apoio prático e emocional da família`;
        }
      }
      const conflict = attended.length > 3 && Math.random() < attended.reduce((sum, person) => sum + (person.personality?.dimensions?.stability < 38 ? .015 : .003), 0);
      if (conflict) {
        event.outcome = "houve tensão, seguida de conversa entre parentes"; this.familyLife.conflicts++;
        const pair = attended.slice().sort((a, b) => (a.personality?.dimensions?.stability || 50) - (b.personality?.dimensions?.stability || 50)).slice(0, 2);
        if (pair.length === 2) {
          const bond = this.ensureFamilyBond(pair[0], pair[1], this.kinship.relationBetween(pair[0], pair[1]));
          bond.tension = clamp(bond.tension + 8, 0, 100); bond.trust = clamp(bond.trust - 2.5, 0, 100); bond.proximity = clamp(bond.proximity - 3, 0, 100);
          let link = this.indexedRelationship(pair[0], pair[1]);
          if (link) { ensureRelationshipDepth(link); link.tension = clamp(link.tension + 8, 0, 100); link.affinity = clamp(link.affinity - 3, -100, 100); if (link.lifecycle?.status === "active") this.recordRelationshipExperience(link, { kind: "discussao", text: `Uma tensão familiar veio à tona durante ${event.name}.`, tone: "negative", valence: -58, importance: 62 }); }
          pair.forEach((person, index) => this.recordCharacterMemory(person, { kind:"conflito familiar", summary:`Teve uma conversa tensa com ${pair[index ? 0 : 1].name} durante ${event.name}.`, actorIds:[pair[index ? 0 : 1].id], placeId:this.buildings.find((building)=>building.name===event.location)?.id||null, valence:-58, importance:62, stressImpact:7, tags:["família","conflito",event.type] }));
        }
      }
      else { event.outcome = attended.length >= Math.max(2, event.rsvp.acceptedIds.length * .6) ? "encontro muito presente e afetivo" : "encontro íntimo entre os presentes"; if (event.type === "family-reunion") this.familyLife.reconciliations++; }
      if (!conflict && (["sazonal", "marco familiar"].includes(event.importance) || event.type === "birthday")) {
        attended.slice(0, 18).forEach((person) => this.recordCharacterMemory(person, {
          kind: "celebração familiar",
          summary: `Participou de ${event.name}; ${event.outcome}.`,
          actorIds: attended.filter((other) => other.id !== person.id).slice(0, 6).map((other) => other.id),
          placeId: this.buildings.find((building) => building.name === event.location)?.id || null,
          valence: 76,
          importance: event.type === "birthday" ? 68 : 74,
          novelty: event.type === "family-reunion" ? 62 : 42,
          tags: ["família", "celebração", event.type],
          mergeWindowDays: 21,
        }));
      }
      const host = this.people.find((person) => person.id === event.hostId); if (host) host.history.push({ week: this.week, text: `${event.name}: ${event.outcome}.` });
      if (event.familyNetworkId) {
        this.familyLife.networkHistory[event.familyNetworkId] ||= [];
        this.familyLife.networkHistory[event.familyNetworkId].unshift({ week: this.week, eventId: event.id, text: `${event.name} reuniu ${attended.length} pessoas; ${event.outcome}${event.systemicEffect ? `; ${event.systemicEffect}` : ""}.` });
        this.familyLife.networkHistory[event.familyNetworkId] = this.familyLife.networkHistory[event.familyNetworkId].slice(0, 20);
      }
      event.consequencesApplied = true;
      event.status = "completed";
    });
    this.familyEvents = this.familyEvents.slice(0, 240);
  }
  canBeginRomanticConnection(a, b) {
    if (!this.canFormRomance(a, b) || !this.orientationCompatible(a, b)) return false;
    const openness = ((a.personality?.dimensions?.openness || 50) + (b.personality?.dimensions?.openness || 50)) / 2;
    if (Math.abs(a.age - b.age) > 10 + openness * .28) return false;
    const links = [...this.romanticLinksOf(a, { activeOnly: true }), ...this.romanticLinksOf(b, { activeOnly: true })];
    const committed = links.filter(({ link }) => ["ficante_exclusivo", "namoro", "uniao_estavel", "noivado", "casamento"].includes(link.lifecycle?.stage));
    if (committed.some(({ link }) => link.lifecycle?.agreements?.relationshipModel !== "nao_monogamico_consensual")) return false;
    return this.romanticLinksOf(a, { activeOnly: true }).length < 3 && this.romanticLinksOf(b, { activeOnly: true }).length < 3;
  }
  beginRomanticConnection(link, a, b) {
    link.lifecycle = initializeRelationshipLifecycle(a, b, {
      id: `relationship:${link.id}`,
      stage: "paquera",
      week: this.week,
      metrics: {
        trust: link.trust,
        attraction: Math.max(45, ((link.views?.[a.id]?.attraction || 0) + (link.views?.[b.id]?.attraction || 0)) / 2),
        satisfaction: clamp(48 + link.affinity * .35, 0, 100),
        intimacy: link.familiarity,
        tension: link.tension,
      },
    });
    link.domain = "romantic";
    this.recordRelationshipExperience(link, { kind: "flerte", text: "A amizade ganhou interesse afetivo e uma paquera começou.", valence: 58, importance: 48, milestone: true });
    this.relationshipSystem.flirtations++;
    this.demographics.casualRelationships++;
    link.history.unshift({ week: this.week, text: "A proximidade se transformou em paquera." });
  }
  closeCompetingRomances(person, keptLink) {
    this.romanticLinksOf(person, { activeOnly: true })
      .filter(({ link }) => link.id !== keptLink.id && !["casamento", "uniao_estavel"].includes(link.lifecycle?.stage))
      .forEach(({ link, person: other }) => {
        link.lifecycle = transitionRelationshipStage(link.lifecycle, "encerrado", { people: [person, other], week: this.week, text: `${person.firstName} assumiu outro vínculo exclusivo e encerrou esta aproximação.` });
        this.syncRelationshipLifecycle(link, person, other);
        link.history.unshift({ week: this.week, text: "A aproximação foi encerrada antes de se tornar compromisso." });
      });
  }
  scheduleRelationshipMilestoneEvent(link, a, b, type) {
    const network = this.extendedFamilyOf(a) || this.extendedFamilyOf(b);
    const closePeople = [a, b].flatMap((person) => this.relationshipsOf(person).filter((entry) => entry.person.alive && entry.link.affinity > 50).slice(0, 8).map((entry) => entry.person.id));
    const wedding = type === "wedding";
    const event = this.scheduleFamilyEvent({
      network,
      type,
      name: wedding ? `Celebração do casamento de ${a.firstName} e ${b.firstName}` : `Celebração do noivado de ${a.firstName} e ${b.firstName}`,
      participantIds: [a.id, b.id, ...closePeople],
      hostId: a.id,
      location: wedding ? "Casa de Shows Estação" : "Restaurante Sabor da Vila",
      day: 5,
      start: wedding ? 17 : 19,
      end: 23,
      importance: "marco familiar",
    });
    if (event) event.relationshipId = link.id;
  }
  applyRelationshipTransition(link, a, b, transition) {
    const { from, to } = transition;
    const positive = !["separado", "divorciado", "encerrado"].includes(to), label = relationshipStageLabel(to);
    this.relationshipSystem.transitions.unshift({ week: this.week, relationshipId: link.id, personIds: [a.id, b.id], from, to, reason: transition.reason });
    this.relationshipSystem.transitions = this.relationshipSystem.transitions.slice(0, 100);
    if (["ficante_casual", "ficante_recorrente"].includes(to)) this.relationshipSystem.casualConnections++;
    if (["ficante_exclusivo", "namoro"].includes(to)) {
      this.closeCompetingRomances(a, link); this.closeCompetingRomances(b, link);
      a.partnerId = b.id; b.partnerId = a.id;
      if (to === "namoro") { this.relationshipSystem.datings++; this.demographics.datingStarted++; }
    }
    if (["uniao_estavel", "noivado", "casamento"].includes(to)) {
      a.partnerId = b.id; b.partnerId = a.id; this.kinshipDirty = true;
    }
    if (to === "uniao_estavel") {
      const moved = this.mergeHouseholds(a, b);
      link.lifecycle = normalizeRelationshipLifecycle({ ...link.lifecycle, cohabitation: { ...link.lifecycle.cohabitation, active: moved, homeId: moved ? a.homeId : null, sinceWeek: moved ? this.week : null } }, [a, b], { week: this.week });
      if (!moved) this.relationshipSystem.pendingCohabitation.push({ relationshipId: link.id, sinceWeek: this.week, reason: "aguardando moradia adequada" });
      this.relationshipSystem.civilUnions++;
    }
    if (to === "noivado") {
      this.relationshipSystem.engagements++; this.demographics.engagements++;
      this.scheduleRelationshipMilestoneEvent(link, a, b, "engagement");
    }
    if (to === "casamento") {
      const moved = this.sharesHousehold(a, b) || this.mergeHouseholds(a, b);
      this.relationshipSystem.marriages++; this.demographics.marriages++; link.marriedWeek = this.week;
      link.lifecycle = normalizeRelationshipLifecycle({ ...link.lifecycle, cohabitation: { ...link.lifecycle.cohabitation, active: moved, homeId: moved ? a.homeId : null } }, [a, b], { week: this.week });
      this.scheduleRelationshipMilestoneEvent(link, a, b, "wedding");
    }
    if (["separado", "encerrado"].includes(to)) {
      [a, b].forEach((person, index) => { if (person.partnerId === (index ? a.id : b.id)) person.partnerId = null; person.previousPartnerIds ||= []; if (!person.previousPartnerIds.includes(index ? a.id : b.id)) person.previousPartnerIds.push(index ? a.id : b.id); });
      const housingResolved = this.processHouseholdSeparation(a, b);
      link.separationHousingPending = housingResolved === false;
      this.relationshipSystem.breakups++; this.relationshipSystem.separations++; this.demographics.separations++; this.kinshipDirty = true;
    }
    if (to === "divorciado") {
      this.relationshipSystem.divorces++; this.demographics.divorces++; this.kinshipDirty = true;
    }
    if (from === "separado" && positive) {
      a.partnerId = b.id; b.partnerId = a.id; this.relationshipSystem.reconciliations++; this.demographics.reconciliations++;
      if (link.lifecycle.cohabitation.active && !this.sharesHousehold(a, b)) this.mergeHouseholds(a, b);
    }
    this.syncRelationshipLifecycle(link, a, b);
    const message = `${a.name} e ${b.name}: ${label.toLowerCase()} — ${transition.reason}.`;
    link.history.unshift({ week: this.week, text: message });
    this.log(positive ? "relacionamento" : to === "divorciado" ? "divórcio" : "separação", message, positive ? "social" : "civic");
    [a, b].forEach((person, index) => this.recordCharacterMemory(person, {
      kind: positive ? "relacionamento" : "separação",
      summary: `${label} com ${index ? a.name : b.name}: ${transition.reason}.`,
      actorIds: [index ? a.id : b.id],
      placeId: person.homeId,
      valence: positive ? 76 : -78,
      importance: ["casamento", "divorciado", "separado"].includes(to) ? 92 : 66,
      stressImpact: positive ? -3 : 16,
      core: ["casamento", "divorciado"].includes(to),
      tags: ["relacionamento", to],
    }));
  }
  reviewRelationshipAgreements(link, a, b) {
    const lifecycle = this.ensureRelationshipLifecycle(link, a, b);
    if (lifecycle.stage !== "namoro" || lifecycle.agreements.cohabitationIntent !== "a_conversar") return;
    const duration = this.week - lifecycle.stageSinceWeek, lastReview = lifecycle.agreements.lastReviewedWeek ?? lifecycle.stageSinceWeek;
    if (duration < 16 || this.week - lastReview < 13 || (duration < 40 && Math.random() > .24)) return;
    const stability = ((a.personality?.dimensions?.stability || 50) + (b.personality?.dimensions?.stability || 50)) / 2;
    const housingRoom = [a, b].some((person) => { const home = this.buildings.find((building) => building.id === person.homeId); return home && home.capacity - home.occupied >= 1; });
    const readiness = lifecycle.metrics.satisfaction * .4 + lifecycle.metrics.commitment * .28 + lifecycle.metrics.communication * .14 + stability * .12 + (housingRoom ? 8 : -8) - lifecycle.metrics.tension * .16;
    const wantsCohabitation = readiness >= 59 || (readiness >= 50 && Math.random() < .42);
    this.recordRelationshipExperience(link, {
      kind: "conversa_sobre_futuro",
      text: wantsCohabitation ? "Conversaram sobre rotina, despesas e decidiram planejar um lar compartilhado." : "Conversaram sobre moradia e decidiram preservar casas separadas por enquanto.",
      valence: wantsCohabitation ? 58 : 22,
      importance: 62,
      agreementChanges: {
        cohabitationIntent: wantsCohabitation ? "sim" : "manter_casas_separadas",
        financialArrangement: wantsCohabitation ? "planejamento_compartilhado" : "separado",
      },
    });
  }
  reviewRelationshipFamilyPlanning(link, a, b) {
    const lifecycle = this.ensureRelationshipLifecycle(link, a, b), planning = lifecycle.familyPlanning;
    const sharedChildren = this.sharedChildrenOf(a, b), household = this.familyOf(a), income = household ? this.householdIncome(household) : 0, home = this.buildings.find((building) => building.id === a.homeId);
    const intentions = {};
    [a, b].forEach((person) => {
      const profile = this.relationshipProfileFor(person), current = planning.intentions[person.id] || {};
      const healthReadiness = person.health * .28 + (person.age >= 22 && person.age <= 42 ? 24 : person.age <= 48 ? 10 : 0);
      const stabilityReadiness = (person.personality?.dimensions?.stability || 50) * .18 + (income > Math.max(800, (household?.housingCost || 0) * 2) ? 18 : 4) + (home && home.occupied < home.capacity ? 14 : 0);
      intentions[person.id] = { ...current, desire: profile.parenthood.desire, desiredChildren: person.reproductive?.childrenDesired || 0, readiness: clamp(healthReadiness + stabilityReadiness - sharedChildren.length * 5, 0, 100), preferredTiming: person.age < 22 ? "mais_tarde" : "em_breve" };
    });
    const livedCareLoad = ((a.parenting?.careLoad || 0) + (b.parenting?.careLoad || 0)) / 2;
    link.lifecycle = normalizeRelationshipLifecycle({ ...lifecycle, familyPlanning: { ...planning, childrenIds: sharedChildren, desiredHouseholdChildren: Math.round((intentions[a.id].desiredChildren + intentions[b.id].desiredChildren) / 2), parentingLoad: clamp(sharedChildren.length * 16 + livedCareLoad * .35 + (planning.postpartumUntilWeek >= this.week ? 26 : 0), 0, 100) } }, [a, b], { week: this.week });
    if (this.week - (planning.lastDiscussionWeek ?? -20) >= 13) {
      link.lifecycle = applyRelationshipExperience(link.lifecycle, { kind: "planejamento_familiar", text: "Conversaram sobre desejo, limites e momento adequado para ter filhos.", intentions, valence: 20, importance: 55 }, { people: [a, b], week: this.week });
      this.relationshipSystem.familyPlanningConversations++;
    }
    const updated = link.lifecycle.familyPlanning, activeStage = ["namoro", "uniao_estavel", "noivado", "casamento"].includes(link.lifecycle.stage), desired = updated.desiredHouseholdChildren > sharedChildren.length;
    if (activeStage && updated.consensus === "aligned" && desired && !updated.pregnancyIds.length && !updated.trying && Object.values(updated.intentions).every((intent) => intent.desire >= 48 && intent.readiness >= 48) && Math.random() < .08) {
      link.lifecycle = applyRelationshipExperience(link.lifecycle, { kind: "iniciar_tentativas", text: "Decidiram iniciar tentativas de concepção de forma planejada.", valence: 45, importance: 64, milestone: true }, { people: [a, b], week: this.week });
    }
  }
  processRelationshipSignals(link, a, b, signals) {
    signals.forEach((signal) => {
      if (signal.kind === "family_planning_conversation") {
        this.recordRelationshipExperience(link, { kind: "planejamento_familiar", text: "Uma divergência sobre parentalidade exigiu uma conversa cuidadosa.", valence: -22, importance: 58 });
      }
      if (signal.kind === "conception_opportunity" && signal.selected && !this.demographics.pregnancies.some((pregnancy) => pregnancy.status === "active" && pregnancy.parentIds.includes(a.id) && pregnancy.parentIds.includes(b.id))) {
        this.startPregnancy(a, b, { planned: true, bypassFertility: true, relationshipId: link.id });
      }
      if (signal.kind === "parenting_support_needed") {
        link.parentingSupportNeeded = true; this.relationshipSystem.parentingSupport++;
        this.recordRelationshipExperience(link, { kind: "sobrecarga_parental", text: "A sobrecarga com filhos exigiu redistribuição de cuidados.", valence: -35, importance: 54 });
      }
      if (signal.kind === "postpartum_care") {
        [a, b].forEach((person) => { person.energy = clamp(person.energy - 2, 0, 100); person.needs.social = clamp(person.needs.social - 1, 0, 100); });
      }
    });
  }
  retryPendingCohabitation() {
    this.relationshipSystem.pendingCohabitation = this.relationshipSystem.pendingCohabitation.filter((pending) => {
      const link = this.relationships.find((candidate) => candidate.id === pending.relationshipId), a = this.people.find((person) => person.id === link?.a), b = this.people.find((person) => person.id === link?.b);
      if (!link?.lifecycle || !a?.alive || !b?.alive || link.lifecycle.status !== "active") return false;
      if (this.sharesHousehold(a, b) || this.mergeHouseholds(a, b)) {
        link.lifecycle = normalizeRelationshipLifecycle({ ...link.lifecycle, cohabitation: { active: true, homeId: a.homeId, sinceWeek: this.week, endedWeek: null } }, [a, b], { week: this.week });
        this.syncRelationshipLifecycle(link, a, b); return false;
      }
      if (this.week - pending.sinceWeek >= 4 && this.housingSystem.construction.length < 3) this.startConstruction();
      return true;
    });
  }
  retryPendingSeparations() {
    this.relationships.filter((link) => link.separationHousingPending).forEach((link) => {
      const a = this.people.find((person) => person.id === link.a), b = this.people.find((person) => person.id === link.b);
      if (!a?.alive || !b?.alive || !this.sharesHousehold(a, b)) { link.separationHousingPending = false; return; }
      if (this.processHouseholdSeparation(a, b)) link.separationHousingPending = false;
      else if (this.housingSystem.construction.length < 3) this.startConstruction();
    });
  }
  weeklyRelationships() {
    let formed = 0;
    this.relationships
      .filter((link) => link.type === "amizade" && !link.lifecycle && !this.isPlayerControlled(this.people.find((person) => person.id === link.a)) && !this.isPlayerControlled(this.people.find((person) => person.id === link.b)) && link.affinity > 52 && link.trust > 42 && link.lastInteractionWeek >= this.week - 6)
      .sort((x, y) => (y.affinity + y.trust) - (x.affinity + x.trust))
      .forEach((link) => {
        if (formed >= 3) return;
        const a = this.people.find((person) => person.id === link.a), b = this.people.find((person) => person.id === link.b);
        if (!a?.alive || !b?.alive || !this.canBeginRomanticConnection(a, b)) return;
        ensureRelationshipDepth(link);
        const attraction = ((link.views?.[a.id]?.attraction || 0) + (link.views?.[b.id]?.attraction || 0)) / 2, positive = (link.sharedExperiences || []).filter((experience) => experience.tone !== "negative" && this.week - experience.week <= 8).length;
        if (positive < 1 || attraction < 18 || Math.random() > clamp(.012 + attraction / 900 + positive * .008, .01, .18)) return;
        this.beginRomanticConnection(link, a, b); formed++;
      });
    this.relationships.filter((link) => this.isRomanticLink(link) && link.lifecycle).forEach((link) => {
      const a = this.people.find((person) => person.id === link.a), b = this.people.find((person) => person.id === link.b);
      if (!a?.alive || !b?.alive || this.isPlayerControlled(a) || this.isPlayerControlled(b) || ["divorciado", "viuvez", "encerrado"].includes(link.lifecycle.stage)) return;
      if (link.lifecycle.startedWeek === this.week) { this.syncRelationshipLifecycle(link, a, b); return; }
      this.reviewRelationshipAgreements(link, a, b);
      this.reviewRelationshipFamilyPlanning(link, a, b);
      const completedWeek = Math.max(0, this.week - 1), currentExperiences = link.lifecycle.experiences.filter((experience) => experience.week === completedWeek), positive = currentExperiences.filter((experience) => experience.tone === "positive" || experience.tone === "support" || experience.valence > 15).length;
      const familyA = this.familyOf(a), familyB = this.familyOf(b), financialStress = clamp((familyA?.arrears || 0) * 14 + (familyB?.arrears || 0) * 14 + (a.money < 0 ? 18 : 0) + (b.money < 0 ? 18 : 0), 0, 100);
      const carrier = [a, b].find((person) => person.reproductive?.canGestate && person.age <= 48), conceptionChance = carrier ? clamp((carrier.reproductive.fertility / 100) * (carrier.health / 100) * .22, .015, .24) : 0;
      const sharedHousehold = this.sharesHousehold(a, b), sharedBuilding = a.homeId && a.homeId === b.homeId;
      const result = evaluateRelationshipWeekly(link.lifecycle, [a, b], {
        week: this.week,
        weeklyContact: link.lastInteractionWeek === completedWeek ? Math.max(1, currentExperiences.length) : sharedHousehold ? 3 : sharedBuilding ? 1 : 0,
        qualityTime: clamp(positive * 18 + (sharedHousehold ? 18 : sharedBuilding ? 5 : 0), 0, 100),
        financialStress,
        parentingStress: link.lifecycle.familyPlanning.parentingLoad,
        externalStress: ((a.mind?.emotional?.stress || 0) + (b.mind?.emotional?.stress || 0)) / 2,
        conceptionChance,
      }, Math.random);
      link.lifecycle = result.relationship;
      if (result.transition) this.applyRelationshipTransition(link, a, b, result.transition);
      else this.syncRelationshipLifecycle(link, a, b);
      this.processRelationshipSignals(link, a, b, result.signals);
      const planning = link.lifecycle.familyPlanning, unplannedEligible = ["ficante_recorrente", "ficante_exclusivo", "namoro", "uniao_estavel", "noivado", "casamento"].includes(link.lifecycle.stage) && !planning.trying && !planning.pregnancyIds.length && ["none", "unknown", "fertility_awareness"].includes(planning.contraception);
      if (unplannedEligible && Math.random() < (["ficante_recorrente", "ficante_exclusivo"].includes(link.lifecycle.stage) ? .005 : .0025)) this.startPregnancy(a, b, { planned: false, relationshipId: link.id });
    });
    this.retryPendingCohabitation();
    this.retryPendingSeparations();
  }
  establishJointHousehold(a, b, home) {
    if (!a?.alive || !b?.alive || !home) return false;
    const dependentIds = [...new Set([...(a.children || []), ...(b.children || [])])];
    const dependents = dependentIds.map((id) => this.people.find((person) => person.id === id)).filter((child) => child?.alive && child.age < 18 && [a.homeId, b.homeId].includes(child.homeId) && child.parents?.some((id) => id === a.id || id === b.id));
    const movers = [...new Map([a, b, ...dependents].map((person) => [person.id, person])).values()];
    const arriving = movers.filter((person) => person.homeId !== home.id).length;
    if (home.occupied + arriving > home.capacity) return false;
    const oldFamilies = new Set(movers.map((person) => this.familyOf(person)).filter(Boolean));
    const creditScores = [...oldFamilies].map((family) => family.creditScore || 620);
    const household = this.createHousehold({
      surname: a.family || b.family,
      homeId: home.id,
      memberIds: [],
      wealth: movers.filter((person) => person.age >= 18).reduce((sum, person) => sum + Math.max(0, person.money), 0),
      tenure: "rent",
      creditScore: creditScores.length ? Math.round(creditScores.reduce((sum, value) => sum + value, 0) / creditScores.length) : 620,
      milestones: [{ week: this.week, text: `${a.name} e ${b.name} formaram um novo domicílio em ${home.name}.` }],
    });
    movers.forEach((person) => {
      const oldFamily = this.familyOf(person), oldHome = this.buildings.find((building) => building.id === person.homeId), wasAtHome = !person.currentTrip && person.locationId === person.homeId;
      if (oldFamily) oldFamily.memberIds = oldFamily.memberIds.filter((id) => id !== person.id);
      if (oldHome && oldHome.id !== home.id) oldHome.occupied = Math.max(0, oldHome.occupied - 1);
      if (oldHome?.id !== home.id) home.occupied = (home.occupied || 0) + 1;
      household.memberIds.push(person.id);
      person.familyId = household.id; person.householdId = household.id; person.homeId = home.id; person.housing = "rent";
      if (wasAtHome) { person.locationId = home.id; person.x = home.x + home.w / 2; person.y = home.y + home.h / 2; }
      person.history.push({ week: this.week, text: `Formou um novo domicílio com ${person.id === a.id ? b.name : a.name} em ${home.name}.` });
    });
    household.memberIds = [...new Set(household.memberIds)];
    this.housingSystem.moves++;
    this.syncHousingOccupancy();
    return true;
  }
  mergeHouseholds(a, b) {
    if (this.sharesHousehold(a, b)) return true;
    const target = this.buildings.find((h) => h.id === a.homeId),
      old = this.buildings.find((h) => h.id === b.homeId);
    const oldFamily = this.familyOf(b),
      newFamily = this.familyOf(a);
    if (!target || !old || !oldFamily || !newFamily) return false;
    const dependents = (b.children || []).map((id) => this.people.find((person) => person.id === id)).filter((child) => child?.alive && child.age < 18 && child.homeId === old.id && oldFamily.memberIds.includes(child.id));
    const movers = [b, ...dependents];
    if (target.occupied + movers.length > target.capacity) {
      const jointDependents = [...new Set([...(a.children || []), ...(b.children || [])])].map((id) => this.people.find((person) => person.id === id)).filter((child) => child?.alive && child.age < 18 && [a.homeId, b.homeId].includes(child.homeId));
      const jointMovers = [...new Map([a, b, ...jointDependents].map((person) => [person.id, person])).values()];
      const alternative = this.buildings
        .filter((home) => home.type === "home" && home.id !== this.housingSystem.hotelId && home.occupied + jointMovers.filter((person) => person.homeId !== home.id).length <= home.capacity)
        .sort((x, y) => (x.rent || 0) - (y.rent || 0) || (y.capacity - y.occupied) - (x.capacity - x.occupied))[0];
      return alternative ? this.establishJointHousehold(a, b, alternative) : false;
    }
    movers.forEach((person) => {
      old.occupied = Math.max(0, old.occupied - 1); target.occupied++;
      person.homeId = target.id;
      if (!person.currentTrip && person.locationId === old.id) { person.locationId = target.id; person.x = target.x + .5; person.y = target.y + .5; }
      oldFamily.memberIds = oldFamily.memberIds.filter((id) => id !== person.id);
      if (!newFamily.memberIds.includes(person.id)) newFamily.memberIds.push(person.id);
      person.familyId = newFamily.id; person.householdId = newFamily.id;
      person.history.push({ week: this.week, text: `Passou a morar com ${a.name} em ${target.name}.` });
    });
    newFamily.milestones ||= []; newFamily.milestones.push({ week: this.week, text: `${a.name} e ${b.name} uniram seus domicílios com ${dependents.length} dependente(s).` });
    this.housingSystem.moves++;
    return true;
  }
  processHouseholdSeparation(a,b) {
    if (!this.sharesHousehold(a, b)) return true;
    const mover = a.money < b.money ? a : b, stayer = mover.id === a.id ? b : a, shared = Math.max(0, (a.money + b.money) * .18);
    a.money = Math.max(0, a.money - shared / 2); b.money = Math.max(0, b.money - shared / 2); mover.money += shared;
    const dependents = [...new Set([...(a.children || []), ...(b.children || [])])].map((id) => this.people.find((person) => person.id === id)).filter((child) => child?.alive && child.age < 18 && child.homeId === mover.homeId),
      children = dependents.filter((child) => child.parents.includes(a.id) && child.parents.includes(b.id)),
      moverDependents = dependents.filter((child) => child.parents.includes(mover.id) && !child.parents.includes(stayer.id));
    const guardian = a.personality.dimensions.stability >= b.personality.dimensions.stability ? a : b;
    const movingChildren = [...new Map([...moverDependents, ...(guardian.id === mover.id ? children : [])].map((child) => [child.id, child])).values()];
    const rental = this.buildings.filter((home) => home.type === "home" && home.occupied + 1 + movingChildren.length <= home.capacity && home.id !== stayer.homeId).sort((x, y) => (x.rent || 0) - (y.rent || 0))[0], oldHome = this.buildings.find((home) => home.id === mover.homeId), target = rental || this.buildings.find((home) => home.id === this.housingSystem.hotelId);
    if (!target || target.occupied + 1 + movingChildren.length > target.capacity) return false;
    const oldFamily = this.familyOf(mover);
    const newFamily = this.createHousehold({ surname: mover.family, homeId: target.id, memberIds: [], wealth: mover.money, tenure: rental ? "rent" : "temporary", creditScore: Math.max(420, (oldFamily?.creditScore || 620) - 20), milestones: [{ week: this.week, text: `Novo domicílio após separação de ${stayer.name}.` }] });
    [mover, ...movingChildren].forEach((person) => {
      if (oldFamily) oldFamily.memberIds = oldFamily.memberIds.filter((id) => id !== person.id);
      if (!newFamily.memberIds.includes(person.id)) newFamily.memberIds.push(person.id);
      if (oldHome) oldHome.occupied = Math.max(0, oldHome.occupied - 1); target.occupied = (target.occupied || 0) + 1;
      person.familyId = newFamily.id; person.householdId = newFamily.id; person.homeId = target.id; person.locationId = target.id; person.x = target.x + .5; person.y = target.y + .5; person.housing = rental ? "rent" : "temporary";
    });
    children.forEach((child) => {
      child.guardianship = { guardianId: guardian.id, coGuardianId: guardian.id === a.id ? b.id : a.id, caseId: uid("guard"), reason: "Guarda após separação", placement: "guarda familiar", startedWeek: this.week, active: true };
      this.demographics.guardianshipCases.push({ id: child.guardianship.caseId, childId: child.id, guardianId: guardian.id, reason: "separação dos responsáveis", placement: "guarda familiar", status: "acompanhamento ativo", pensionWeekly: 0, startedWeek: this.week });
    });
    moverDependents.forEach((child) => { child.guardianship ||= { guardianId: mover.id, reason: "Responsabilidade parental", placement: "família de origem", startedWeek: this.week, active: true }; });
    mover.history.push({ week: this.week, text: `Mudou-se para ${target.name} após a separação.` }); this.housingSystem.moves++; this.syncHousingOccupancy();
    return true;
  }
  startPregnancy(a, b, { planned = true, bypassFertility = false, relationshipId = null } = {}) {
    const eligible = [a, b].filter((person) => person?.alive && person.age >= 18 && person.age <= 48 && !person.reproductive?.pregnancyId && (person.reproductive?.canGestate ?? person.identity === "mulher"));
    const carrier = eligible.sort((x, y) => (y.reproductive?.fertility || 0) - (x.reproductive?.fertility || 0) || x.age - y.age)[0];
    if (!carrier) return false;
    const ageFactor = carrier.age <= 34 ? 1 : carrier.age <= 39 ? .76 : carrier.age <= 44 ? .43 : .2;
    const fertility = clamp(((carrier.reproductive?.fertility || 50) / 100) * ageFactor * (carrier.health / 100), .04, .92);
    if (!bypassFertility && Math.random() > fertility) return false;
    const pregnancy =
      {
        id: uid("pregnancy"),
        parentIds: [a.id, b.id],
        carrierId: carrier.id,
        relationshipId,
        planned,
        conceptionContext: planned ? "decisão compartilhada" : "gestação não planejada",
        startedWeek: this.week,
        weeks: 0,
        dueWeek: this.week + 40,
        health: 78 + Math.floor(Math.random() * 20),
        appointments: 0,
        trimester: 1,
        risk: carrier.age>40?"alto":carrier.health<55?"moderado":"habitual",
        exams: [],
        birthPlan: Math.random()<.32?"cesariana":"parto vaginal",
        prenatalUnit: "UBS Vila Esperança",
        supportNetworkIds: [a.id, b.id],
        babySupplies: 0,
        status: "active",
      };
    this.demographics.pregnancies.push(pregnancy);
    if (planned) this.demographics.plannedPregnancies++;
    else this.demographics.unplannedPregnancies++;
    carrier.reproductive.pregnancyId = pregnancy.id;
    [a, b].forEach((parent) => {
      parent.reproductive.expectingPregnancyIds ||= [];
      if (!parent.reproductive.expectingPregnancyIds.includes(pregnancy.id)) parent.reproductive.expectingPregnancyIds.push(pregnancy.id);
      parent.history.push({ week: this.week, text: planned ? "Iniciou uma gestação planejada com acompanhamento pré-natal." : "Recebeu a notícia de uma gestação não planejada." });
    });
    const relationship = this.relationships.find((link) => link.id === relationshipId) || this.indexedRelationship(a, b);
    if (relationship && this.isRomanticLink(relationship)) this.recordRelationshipExperience(relationship, { kind: "gravidez", pregnancyId: pregnancy.id, text: planned ? "Uma gestação planejada começou." : "Uma gestação não planejada mudou os planos do vínculo.", valence: planned ? 72 : 18, importance: 86, milestone: true });
    this.log(
      "gestação",
      `${a.name} e ${b.name} estão esperando um filho${planned ? " após uma decisão compartilhada" : " em uma gestação não planejada"}.`,
      "social",
    );
    return true;
  }
  updatePregnancyRelationship(pregnancy, parents, kind, extra = {}) {
    parents.filter(Boolean).forEach((parent) => {
      if (parent.reproductive.pregnancyId === pregnancy.id) parent.reproductive.pregnancyId = null;
      parent.reproductive.expectingPregnancyIds = (parent.reproductive.expectingPregnancyIds || []).filter((id) => id !== pregnancy.id);
    });
    const link = this.relationships.find((candidate) => candidate.id === pregnancy.relationshipId) || (parents.length >= 2 ? this.indexedRelationship(parents[0], parents[1]) : null);
    if (link && this.isRomanticLink(link)) this.recordRelationshipExperience(link, { kind, pregnancyId: pregnancy.id, ...extra });
  }
  weeklyPregnancies() {
    this.demographics.pregnancies
      .filter((p) => p.status === "active")
      .forEach((pregnancy) => {
        if (pregnancy.startedWeek >= this.week) return;
        pregnancy.weeks++;
        pregnancy.trimester=pregnancy.weeks<14?1:pregnancy.weeks<28?2:3;
        const carrier = this.people.find((p) => p.id === pregnancy.carrierId),
          parents = pregnancy.parentIds.map((id) =>
            this.people.find((p) => p.id === id),
          );
        if (!carrier?.alive || parents.some((parent) => !parent)) {
          pregnancy.status = "interrupted";
          this.updatePregnancyRelationship(pregnancy, parents, "perda_gestacional", { text: "A gestação foi interrompida após uma emergência familiar.", valence: -88, importance: 90, milestone: true });
          this.demographics.pregnancyLosses++;
          this.log("saúde", `Uma gestação foi interrompida após uma emergência familiar.`, "civic");
          return;
        }
        if (pregnancy.weeks % 8 === 0) {
          pregnancy.appointments++;
          pregnancy.health = clamp(
            pregnancy.health + (carrier.health > 60 ? 3 : -3),
            0,
            100,
          );
          carrier.medical.history.unshift({
            week: this.week,
            text: `Consulta pré-natal na ${pregnancy.weeks}ª semana.`,
          });
          pregnancy.exams.push(pregnancy.weeks<=16?"ultrassonografia obstétrica":pregnancy.weeks<=28?"avaliação morfológica":"monitoramento fetal");
          this.healthSystem.procedures.exams++;
        }
        const relationship = this.relationships.find((link) => link.id === pregnancy.relationshipId), relationshipSupport = relationship?.lifecycle?.metrics?.satisfaction || 50;
        pregnancy.health = clamp(pregnancy.health + Math.min(1.2, (pregnancy.supportNetworkIds?.length || 0) * .04) + (relationshipSupport >= 68 ? .2 : relationshipSupport < 36 ? -.35 : 0), 0, 100);
        if(pregnancy.weeks>=36&&carrier.shift){carrier.medical.sickLeave=Math.max(carrier.medical.sickLeave,Math.min(28,41-pregnancy.weeks));pregnancy.maternityLeave=true;}
        const lossRisk =
          0.0008 +
          (carrier.health < 40 ? 0.008 : 0) +
          (carrier.age > 42 ? 0.004 : 0);
        if (Math.random() < lossRisk) {
          pregnancy.status = "loss";
          this.updatePregnancyRelationship(pregnancy, parents, "perda_gestacional", { text: "Sofreram uma perda gestacional e iniciaram acompanhamento de luto.", valence: -95, importance: 96, milestone: true });
          parents.forEach((parent) => {
            parent.happiness = clamp(parent.happiness - 14, 0, 100);
            this.recordCharacterMemory(parent, { kind: "perda gestacional", summary: "Viveu uma perda gestacional e iniciou um período de luto.", actorIds: parents.filter((other) => other.id !== parent.id).map((other) => other.id), valence: -96, importance: 96, stressImpact: 24, core: true, tags: ["luto", "família", "gestação"] });
          });
          this.demographics.pregnancyLosses++;
          this.log(
            "saúde",
            `${parents[0].name} e ${parents[1].name} sofreram uma perda gestacional.`,
            "civic",
          );
          return;
        }
        if (pregnancy.weeks >= 40) {
          pregnancy.status = "completed";
          pregnancy.delivery={week:this.week,unit:"Hospital São Lucas",type:pregnancy.birthPlan,complications:pregnancy.health<55||pregnancy.risk==="alto"?pick(["observação neonatal","hemorragia controlada","parto prolongado"]):null};
          this.healthSystem.procedures.surgeries+=pregnancy.birthPlan==="cesariana"?1:0;
          const child = this.createChild(parents[0], parents[1], { carrierId: carrier.id, pregnancyId: pregnancy.id, relationshipId: pregnancy.relationshipId });
          this.updatePregnancyRelationship(pregnancy, parents, "nascimento", { childId: child.id, text: `${child.name} nasceu e transformou a rotina familiar.`, valence: 92, importance: 98, milestone: true });
          carrier.reproductive.postpartumUntilWeek = this.week + 12;
          carrier.medical.sickLeave = Math.max(carrier.medical.sickLeave, 12);
          parents.filter((parent) => parent.id !== carrier.id).forEach((parent) => { parent.medical.sickLeave = Math.max(parent.medical.sickLeave, 3); });
        }
      });
  }
  scheduleSocialEvents() {
    return this.scheduleFamilyEvents();
  }
  weeklyNotability() {
    const candidates = this.people.filter((p) => p.alive && !this.isPlayerControlled(p) && p.age >= 16);
    candidates.forEach((p) => {
      const business = this.businesses.find((b) => b.ownerId === p.id),
        civicRole = ["Professora", "Enfermeiro", "Policial", "Comerciante"].includes(
          p.role,
        ),
        baseChance =
          0.002 +
          p.personality.dimensions.openness / 25000 +
          p.personality.dimensions.extraversion / 30000;
      p.notability.score += business?.reputation > 80 ? 0.35 : 0;
      p.notability.score += civicRole ? 0.08 : 0;
      p.notability.score += p.justice.convictions ? 0.04 : 0;
      if (Math.random() < baseChance) {
        let action, title, gain;
      if (["Enfermeiro", "Farmacêutico"].includes(p.role)) {
        action = "ajudou a salvar um morador em uma emergência";
        title = "Referência na saúde";
          gain = 18;
        } else if (p.role === "Policial") {
        action = "teve papel decisivo na solução de um caso importante";
        title = "Figura da segurança local";
          gain = 14;
        } else if (business) {
        action = `transformou ${business.name} em uma referência regional`;
          title = "Empreendedor de destaque";
          gain = 16;
        } else if (p.personality.talent === "criatividade") {
          action = "produziu uma obra cultural celebrada na cidade";
          title = "Artista local";
          gain = 20;
        } else {
        action = "liderou uma ação comunitária que mobilizou moradores";
        title = "Liderança comunitária";
          gain = 12;
        }
        p.notability.score += gain;
        p.notability.notableActions.unshift({ week: this.week, text: action });
        p.notability.followers += Math.round(gain * (2 + Math.random() * 5));
        if (p.notability.score >= 60 && !p.notability.famous) {
          p.notability.famous = true;
          p.notability.title = title;
          this.demographics.cityFigures.push(p.id);
          this.log(
            "personalidade",
          `${p.name} tornou-se ${title.toLowerCase()} em Vila Esperança.`,
            "social",
          );
        } else if (gain >= 16)
          this.log("destaque", `${p.name} ${action}.`, "social");
      }
    });
  }
  scheduleVenueEvents() {
    const venues=this.businesses.filter(b=>b.nightlife&&!b.closed&&this.businessStaffing(b).total>=b.minimumStaff),count=Math.min(3,1+Math.floor(this.people.filter(p=>p.alive).length/120));
    venues.sort(()=>Math.random()-.5).slice(0,count).forEach((venue,i)=>{
      const names=venue.sector==="Casa de shows"?["Show de artistas locais","Festival independente"]:venue.sector==="Clube social"?["Festa temática","Encontro da comunidade"]:["Noite dançante","Celebração de fim de semana"],participants=this.people.filter(p=>p.alive&&p.age>=(venue.adultOnly?18:16)&&!p.justice.incarcerated&&p.energy>35).sort(()=>Math.random()-.5).slice(0,18+Math.floor(Math.random()*28)).map(p=>p.id);
      this.events.active.push({id:uid("venue-event"),name:pick(names),season:this.events.season,location:venue.name,start:venue.open,end:venue.close,remaining:1,duration:1,participants,attendance:0,status:"active",collective:true,businessId:venue.id});
      venue.collectiveInteractions ||= [];venue.collectiveInteractions.unshift({week:this.week,day:5,time:`${venue.open}:00`,interaction:names[0],hostId:venue.ownerId,participants});
      if(i===0)this.log("cultura",`${pick(names)} reúne ${participants.length} moradores em ${venue.name}.`,"social");
    });
  }
  createChild(a, b, { carrierId = null, pregnancyId = null, relationshipId = null } = {}) {
    const carrier = this.people.find((person) => person.id === carrierId && person.alive),
      residentParent = carrier || (a.alive ? a : b),
      family = this.familyOf(residentParent);
    this.syncHousingOccupancy();
    let home = this.buildings.find((building) => building.id === residentParent.homeId);
    const householdSize = this.livingHouseholdMembers(family).length;
    if (home && home.occupied + 1 > home.capacity) {
      const destination = this.buildings
        .filter((candidate) => {
          if (candidate.type !== "home" || candidate.id === home.id) return false;
          const otherResidents = this.people.filter(
            (person) => person.alive && person.homeId === candidate.id && !family.memberIds.includes(person.id),
          ).length;
          return otherResidents + householdSize + 1 <= candidate.capacity;
        })
        .sort((x, y) => (x.rent || 0) - (y.rent || 0) || y.capacity - y.occupied - (x.capacity - x.occupied))[0];
      if (destination && this.moveFamilyToHome(family, destination)) home = destination;
      else {
        const hotel = this.buildings.find((building) => building.id === this.housingSystem.hotelId);
        const otherGuests = this.people.filter(
          (person) => person.alive && person.homeId === hotel?.id && !family.memberIds.includes(person.id),
        ).length;
        if (hotel && otherGuests + householdSize + 1 <= hotel.capacity) {
          const previousTenure = family.tenure;
          family.tenure = "temporary";
          if (this.moveFamilyToHome(family, hotel)) home = hotel;
          else family.tenure = previousTenure;
        }
      }
    }
    const childIdentity=randomIdentity(),firstName = firstNameForIdentity(childIdentity),
      child = {
        id: uid("p"),
        name: `${firstName} ${residentParent.family}`,
        firstName,
        family: residentParent.family,
        age: 0,
        role: "Bebê",
        workplace: "Em casa",
        wage: 0,
        homeId: home.id,
        traits: inheritTraits(a.traits, b.traits),
        health: 82 + Math.floor(Math.random() * 18),
        happiness: 85,
        energy: 75,
        money: 0,
        x: home.x + 0.5,
        y: home.y + 0.5,
        target: null,
        activity: "Em casa",
        currentAction: { text: "Sob os cuidados da família", phase: "present", placeId: home.id, destinationId: null, mode: null, sinceWeek: this.week, sinceDay: this.day, sinceMinute: this.minute },
        actionLog: [],
        color: `hsl(${Math.floor(Math.random() * 360)} 45% 55%)`,
        friends: 0,
        parents: [a.id, b.id],
        parentRoles: { [a.id]: a.id === carrierId ? "gestante e responsável legal" : "coparente legal", [b.id]: b.id === carrierId ? "gestante e responsável legal" : "coparente legal" },
        children: [],
        partnerId: null,
        history: [
          {
            week: this.week,
            text: `Nasceu em Vila Esperança, filho de ${a.name} e ${b.name}.`,
          },
        ],
        housing: family.tenure,
        alive: true,
        bereavement: { active: [], leaveDays: 0, visitToday: null },
        guardianship: { guardianId: a.id, coGuardianId: b.id, reason: "Responsabilidade parental", placement: "família de origem", startedWeek: this.week, active: true },
        medical: newMedicalRecord(),
        education: emptyEducation(),
        justice: emptyJusticeRecord(),
        mobility: emptyMobility(),
        needs: { hunger: 90, social: 90, hygiene: 90, comfort: 90 },
        reproductive: {
          childrenDesired: Math.floor(Math.random() * 4),
          pregnancyId: null,
          expectingPregnancyIds: [],
          postpartumUntilWeek: null,
          fertility: 45 + Math.floor(Math.random() * 50),
          canGestate: Math.random() < .49,
        },
        identity: childIdentity,
        pronouns:pronounsForIdentity(childIdentity),
        orientation: randomOrientation(),
        genetics: inheritGenetics(a.genetics, b.genetics),
        personality: generatePersonality(inheritTraits(a.traits, b.traits)),
        notability: generateNotability(),
        bornWeek: this.week,
        birthdayWeek: ((this.week - 1) % 52) + 1,
        familyId: family.id,
        householdId: family.id,
        lifeStage:lifeStageForAge(0).id,
        lifeCourse:initializeLifeCourse({age:0,role:"Bebê"},this.week),
      };
    child.routine = buildRoutine(child);
    child.locationId = home.id;
    child.path = [];
    child.destinationId = null;
    child.scheduleKey = null;
    this.people.push(child);
    this.ensureCharacterState(child);
    this.relationshipProfileFor(child);
    family.memberIds.push(child.id);
    a.children.push(child.id);
    b.children.push(child.id);
    home.occupied++;
    this.syncHousingOccupancy();
    const parentLinks = [
      {
        id: uid("rel"),
        a: a.id,
        b: child.id,
        type: "família",
        affinity: 92,
        trust: 90,
        interactions: 0,
        lastEvent: "Nascimento",
        history: [],
      },
      {
        id: uid("rel"),
        a: b.id,
        b: child.id,
        type: "família",
        affinity: 92,
        trust: 90,
        interactions: 0,
        lastEvent: "Nascimento",
        history: [],
      },
    ];
    this.relationships.push(...parentLinks);
    parentLinks.forEach((link) => this.indexNewRelationship(link));
    const romanticLink = this.relationships.find((link) => link.id === relationshipId) || this.indexedRelationship(a, b);
    if (romanticLink?.lifecycle && !pregnancyId) romanticLink.lifecycle = applyRelationshipExperience(romanticLink.lifecycle, { kind: "nascimento", childId: child.id, text: `${child.name} passou a integrar a família.`, valence: 88, importance: 96, milestone: true }, { people: [a, b], week: this.week });
    this.demographics.births++;
    this.demographics.nativeBorn++;
    this.log(
      "nascimento",
      `${child.name} nasceu no Hospital São Lucas.`,
      "social",
    );
    [a, b].filter((parent) => parent?.alive).forEach((parent) => {
      this.recordCharacterMemory(parent, {
        kind: "nascimento",
        summary: `${child.name} nasceu e passou a fazer parte de sua vida.`,
        actorIds: [child.id],
        placeId: this.buildings.find((building) => building.name === "Hospital São Lucas")?.id || null,
        valence: 92,
        importance: 96,
        novelty: 90,
        core: true,
        tags: ["nascimento", "família", "filho"],
      });
    });
    this.rebuildKinship({ seedLinks: true });
    return child;
  }
  settleEstate(person) {
    const existing = this.demographics.probateCases.find((estate) => estate.personId === person.id && !["concluído", "sem herdeiros"].includes(estate.status));
    if (existing) return existing;
    return this.openEstate(person);
    /* Compatibilidade histórica: a partilha efetiva é processada por dailyProbate. */
    const heirs = [
      this.people.find((p) => p.id === person.partnerId),
      ...person.children.map((id) => this.people.find((p) => p.id === id)),
    ].filter((p) => p?.alive);
    if (!heirs.length)
      heirs.push(
        ...person.parents
          .map((id) => this.people.find((p) => p.id === id))
          .filter((p) => p?.alive),
      );
    const estate = Math.max(0, person.money);
    if (heirs.length) {
      const share = estate / heirs.length;
      heirs.forEach((h) => {
        h.money += share;
        h.history.push({
          week: this.week,
          text: `Recebeu R$ ${Math.round(share).toLocaleString("pt-BR")} de herança de ${person.name}.`,
        });
      });
      this.demographics.inheritance += estate;
    } else this.money += estate;
    person.money = 0;
    this.buildings
      .filter((b) => b.ownerId === person.id)
      .forEach(
        (asset, i) => (asset.ownerId = heirs[i % heirs.length]?.id || null),
      );
    this.businesses
      .filter((b) => b.ownerId === person.id)
      .forEach(
        (asset, i) => (asset.ownerId = heirs[i % heirs.length]?.id || null),
      );
    person.mobility.vehicleIds.forEach((id, i) => {
      const v = this.vehicles.find((x) => x.id === id);
      if (heirs.length) {
        v.ownerId = heirs[i % heirs.length].id;
        heirs[i % heirs.length].mobility.vehicleIds.push(v.id);
      } else {
        v.ownerId = "municipality";
      }
    });
    person.mobility.vehicleIds = [];
    this.demographics.estates++;
  }
  estateHeirs(person) {
    const living = (id) => this.people.find((candidate) => candidate.id === id && candidate.alive);
    const branch = (id, weight = 1, visited = new Set()) => {
      if (!id || visited.has(id)) return [];
      const node = this.people.find((candidate) => candidate.id === id);
      if (!node) return [];
      if (node.alive) return [{ person: node, weight }];
      const nextVisited = new Set(visited).add(id), childBranches = (node.children || []).map((childId) => branch(childId, 1, nextVisited)).filter((items) => items.length);
      if (!childBranches.length) return [];
      return childBranches.flatMap((items) => {
        const total = items.reduce((sum, item) => sum + item.weight, 0) || 1;
        return items.map((item) => ({ ...item, weight: weight / childBranches.length * item.weight / total }));
      });
    };
    const normalize = (entries, share = 1, heirClass = "família extensa") => {
      const merged = new Map();
      entries.forEach(({ person: heir, weight = 1 }) => {
        if (!heir?.alive) return;
        const current = merged.get(heir.id) || { person: heir, weight: 0 };
        current.weight += weight; merged.set(heir.id, current);
      });
      const total = [...merged.values()].reduce((sum, item) => sum + item.weight, 0) || 1;
      return [...merged.values()].map((item) => ({ person: item.person, share: share * item.weight / total, heirClass }));
    };
    const partner = this.legalPartnerOf(person), childLines = (person.children || []).map((id) => branch(id)).filter((items) => items.length);
    if (childLines.length) {
      const descendantPool = partner ? .5 : 1, descendants = childLines.flatMap((items) => {
        const total = items.reduce((sum, item) => sum + item.weight, 0) || 1;
        return items.map((item) => ({ ...item, weight: item.weight / total / childLines.length }));
      });
      return [...(partner ? [{ person: partner, share: .5, heirClass: "cônjuge sobrevivente" }] : []), ...normalize(descendants, descendantPool, "descendente por estirpe")];
    }
    const parents = (person.parents || []).map(living).filter(Boolean);
    if (parents.length) return [...(partner ? [{ person: partner, share: .5, heirClass: "cônjuge sobrevivente" }] : []), ...normalize(parents.map((heir) => ({ person: heir })), partner ? .5 : 1, "ascendente")];
    const siblingLines = (this.kinship?.siblingsOf(person, { livingOnly: false }) || []).map(({ person: sibling }) => branch(sibling.id)).filter((items) => items.length);
    if (siblingLines.length) {
      const collateral = siblingLines.flatMap((items) => {
        const total = items.reduce((sum, item) => sum + item.weight, 0) || 1;
        return items.map((item) => ({ ...item, weight: item.weight / total / siblingLines.length }));
      });
      return [...(partner ? [{ person: partner, share: .5, heirClass: "cônjuge sobrevivente" }] : []), ...normalize(collateral, partner ? .5 : 1, "colateral por representação")];
    }
    if (partner) return [{ person: partner, share: 1, heirClass: "cônjuge sobrevivente" }];
    const extended = (this.kinship?.relativesOf(person, { includePartners: false, livingOnly: true, maxDistance: 6 }) || []).filter((entry) => entry.relation?.consanguineous).sort((a, b) => a.distance - b.distance), nearest = extended[0]?.distance;
    return normalize(extended.filter((entry) => entry.distance === nearest).map((entry) => ({ person: entry.person })), 1, "parente colateral");
  }
  resolveProbateHeirs(estate, deceased) {
    const descendantRepresentatives = (person, visited = new Set()) => {
      if (!person || visited.has(person.id)) return [];
      const nextVisited = new Set(visited).add(person.id), branches = (person.children || [])
        .map((id) => this.people.find((candidate) => candidate.id === id))
        .map((child) => {
          if (!child) return [];
          if (child.alive) return [{ person: child, weight: 1 }];
          return descendantRepresentatives(child, nextVisited);
        })
        .filter((branch) => branch.length);
      if (!branches.length) return [];
      return branches.flatMap((branch) => {
        const total = branch.reduce((sum, entry) => sum + entry.weight, 0) || 1;
        return branch.map((entry) => ({ ...entry, weight: entry.weight / total / branches.length }));
      });
    };
    const resolved = [];
    (estate.heirs || []).forEach((entry) => {
      const heir = this.people.find((person) => person.id === entry.personId);
      if (heir?.alive) {
        resolved.push({ person: heir, share: entry.share, heirClass: entry.heirClass });
        return;
      }
      const representatives = descendantRepresentatives(heir);
      const total = representatives.reduce((sum, representative) => sum + representative.weight, 0) || 1;
      representatives.forEach((representative) => resolved.push({
        person: representative.person,
        share: entry.share * representative.weight / total,
        heirClass: `${entry.heirClass || "herdeiro"} por transmissão`,
      }));
    });
    if (!resolved.length) return this.estateHeirs(deceased);
    const merged = new Map();
    resolved.forEach((entry) => {
      const current = merged.get(entry.person.id) || { ...entry, share: 0 };
      current.share += entry.share;
      if (current.heirClass !== entry.heirClass) current.heirClass = "sucessão acumulada";
      merged.set(entry.person.id, current);
    });
    const total = [...merged.values()].reduce((sum, entry) => sum + entry.share, 0) || 1;
    return [...merged.values()].map((entry) => ({ ...entry, share: entry.share / total }));
  }
  openEstate(person) {
    const succession = this.estateHeirs(person), heirs = succession.map((entry) => entry.person),
      properties = this.buildings.filter((b) => b.ownerId === person.id),
      businesses = this.businesses.filter((b) => b.ownerId === person.id),
      vehicles = person.mobility.vehicleIds.map((id) => this.vehicles.find((v) => v.id === id)).filter(Boolean),
      gross = Math.max(0, person.money) + properties.reduce((n, a) => n + (a.value || 0), 0) + businesses.reduce((n, a) => n + Math.max(0, a.cash || 0), 0) + vehicles.reduce((n, a) => n + (a.value || 0), 0),
      debts = Math.max(0, person.justice.fines || 0) + Math.max(0, this.familyOf(person)?.arrears || 0) * 900,
      disputed = heirs.length > 2 && Math.random() < .12 + heirs.length * .035,
      probate = {
        id: uid("estate"), personId: person.id, openedWeek: this.week, status: "levantamento patrimonial",
        daysRemaining: 12 + heirs.length * 3 + (disputed ? 28 : 0), gross: Math.round(gross), debts: Math.round(debts),
        tax: Math.round(Math.max(0, gross - debts) * .04),
        heirs: succession.map((entry) => ({ personId: entry.person.id, share: entry.share, heirClass: entry.heirClass, received: 0 })),
        properties: properties.map((a) => a.id), businesses: businesses.map((a) => a.id), vehicles: vehicles.map((a) => a.id), disputed,
        history: [{ week: this.week, text: "Inventário aberto e bens bloqueados para transferência." }],
      };
    this.demographics.probateCases.unshift(probate);
    if (disputed) this.demographics.estateDisputes++;
    return probate;
  }
  dailyProbate() {
    this.demographics.probateCases.filter((e) => !["concluído", "sem herdeiros"].includes(e.status)).forEach((estate) => {
      estate.daysRemaining--;
      if (estate.daysRemaining === 7) estate.status = estate.disputed ? "mediação entre herdeiros" : "cálculo de impostos";
      if (estate.daysRemaining > 0) return;
      const deceased = this.people.find((p) => p.id === estate.personId), net = Math.max(0, estate.gross - estate.debts - estate.tax), liquid = Math.max(0, deceased.money - estate.debts - estate.tax), resolvedHeirs = this.resolveProbateHeirs(estate, deceased), heirs = resolvedHeirs.map((entry) => ({ personId: entry.person.id, share: entry.share, heirClass: entry.heirClass, received: 0, person: entry.person }));
      estate.heirs = heirs.map(({ person, ...entry }) => entry);
      if (!heirs.length) {
        estate.status = "sem herdeiros"; this.money += liquid;
        estate.properties.forEach((id) => { const a = this.buildings.find((x) => x.id === id); if (a) a.ownerId = null; });
        estate.businesses.forEach((id) => { const a = this.businesses.find((x) => x.id === id); if (a) a.ownerId = "municipality"; });
        estate.vehicles.forEach((id) => { const v = this.vehicles.find((x) => x.id === id); if (v) v.ownerId = "municipality"; });
      }
      else {
        heirs.forEach((h) => {
          h.received = Math.round(liquid * h.share); const original = estate.heirs.find((x) => x.personId === h.personId);
          if (h.person.age < 18) {
            const fund = { id: uid("trust"), beneficiaryId: h.person.id, estateId: estate.id, custodianId: h.person.guardianship?.guardianId || null, balance: h.received, status: "bloqueado até 18 anos", createdWeek: this.week };
            this.demographics.trustFunds.push(fund); if (original) { original.received = 0; original.heldInTrust = h.received; }
            h.person.history.push({ week: this.week, text: `Herança de R$ ${h.received.toLocaleString("pt-BR")} reservada em fundo protegido.` });
          } else {
            if (original) original.received = h.received; h.person.money += h.received;
            h.person.history.push({ week: this.week, text: `Recebeu R$ ${h.received.toLocaleString("pt-BR")} e sua parte dos bens no inventário de ${deceased.name}.` });
          }
        });
        const receiver = (i) => heirs[i % heirs.length].person;
        estate.properties.forEach((id, i) => { const a = this.buildings.find((x) => x.id === id); if (a) a.ownerId = receiver(i).id; });
        estate.businesses.forEach((id, i) => { const a = this.businesses.find((x) => x.id === id); if (a) a.ownerId = receiver(i).id; });
        estate.vehicles.forEach((id, i) => { const v = this.vehicles.find((x) => x.id === id), h = receiver(i); if (v) { v.ownerId = h.id; if (!h.mobility.vehicleIds.includes(v.id)) h.mobility.vehicleIds.push(v.id); } });
        deceased.mobility.vehicleIds = [];
        estate.status = "concluído";
        this.demographics.inheritance += net;
      }
      deceased.money = 0;
      this.demographics.estateTaxes += estate.tax; this.money += estate.tax; this.demographics.estates++;
      estate.history.unshift({ week: this.week, text: estate.status === "concluído" ? "Partilha homologada e bens transferidos." : "Patrimônio incorporado pelo município." });
      const death = this.funeralSystem.records.find((r) => r.personId === estate.personId), step = death?.bureaucracy.find((s) => s.step.includes("Inventário"));
      if (step) step.status = "concluído";
    });
  }
  handleDependents(person, deathRecord) {
    const dependentIds = new Set([
      ...(person.children || []),
      ...this.people
        .filter((child) => child.alive && child.age < 18 && child.guardianship?.active && child.guardianship.guardianId === person.id)
        .map((child) => child.id),
    ]);
    [...dependentIds].map((id) => this.people.find((p) => p.id === id)).filter((p) => p?.alive && p.age < 18).forEach((child) => {
      const canReceive = (candidate) =>
        candidate?.alive &&
        candidate.id !== person.id &&
        candidate.age >= 21 &&
        this.hasHousingRoom(candidate, 1, [child.id]);
      const otherParent = child.parents
          .map((id) => this.people.find((p) => p.id === id))
          .find((candidate) => canReceive(candidate)),
        relatives = this.relativesOf(child)
          .filter((candidate) => canReceive(candidate))
          .sort((a, b) => b.personality.dimensions.stability - a.personality.dimensions.stability),
        familyAdults = (this.familyOf(child)?.memberIds || [])
          .map((id) => this.people.find((p) => p.id === id))
          .filter((candidate) => canReceive(candidate)),
        communityAdults = this.people
          .filter((candidate) => canReceive(candidate) && candidate.age >= 25)
          .sort((a, b) => b.personality.empathy - a.personality.empathy),
        guardian = otherParent || relatives[0] || familyAdults[0] || communityAdults[0];
      if (!guardian || child.guardianship?.guardianId === guardian.id) return;
      const oldFamily = this.familyOf(child), newFamily = this.familyOf(guardian), oldHome = this.buildings.find((b) => b.id === child.homeId), newHome = this.buildings.find((b) => b.id === guardian.homeId), placement = otherParent ? "genitor sobrevivente" : relatives.includes(guardian) ? "família extensa" : "acolhimento familiar";
      child.guardianship = { guardianId: guardian.id, caseId: uid("guard"), reason: `Falecimento de ${person.name}`, placement, startedWeek: this.week, active: true };
      if (newFamily && oldFamily?.id !== newFamily.id) { oldFamily.memberIds = oldFamily.memberIds.filter((id) => id !== child.id); if (!newFamily.memberIds.includes(child.id)) newFamily.memberIds.push(child.id); child.familyId = newFamily.id; child.householdId = newFamily.id; }
      if (newHome && child.homeId !== newHome.id) { if (oldHome) oldHome.occupied = Math.max(0, oldHome.occupied - 1); newHome.occupied++; child.homeId = newHome.id; child.locationId = newHome.id; child.x = newHome.x + .5; child.y = newHome.y + .5; }
      const record = { id: child.guardianship.caseId, childId: child.id, guardianId: guardian.id, deathRecordId: deathRecord.id, placement, status: "acompanhamento ativo", pensionWeekly: 75, startedWeek: this.week };
      this.demographics.guardianshipCases.push(record); child.history.push({ week: this.week, text: `${guardian.name} assumiu sua tutela (${placement}).` }); guardian.history.push({ week: this.week, text: `Assumiu a tutela de ${child.name}.` });
    });
    this.syncHousingOccupancy();
  }
  weeklyDependentCare() {
    this.demographics.guardianshipCases.filter((c) => c.status === "acompanhamento ativo").forEach((c) => {
      const child = this.people.find((p) => p.id === c.childId), guardian = this.people.find((p) => p.id === c.guardianId);
      if (!child?.alive || child.age >= 18 || !guardian?.alive) {
        const replacement = this.demographics.guardianshipCases.find((other) => other.id !== c.id && other.childId === c.childId && other.status === "acompanhamento ativo" && this.people.find((person) => person.id === other.guardianId)?.alive);
        c.status = child?.age >= 18 ? "encerrado por maioridade" : replacement ? "substituído por nova tutela" : "reavaliação necessária";
        if (child?.guardianship && (child.guardianship.caseId === c.id || (!child.guardianship.caseId && child.guardianship.guardianId === c.guardianId))) child.guardianship.active = false;
        return;
      }
      guardian.money += c.pensionWeekly; this.money -= c.pensionWeekly;
    });
    this.demographics.trustFunds.filter((f) => f.status.startsWith("bloqueado")).forEach((fund) => {
      const beneficiary = this.people.find((p) => p.id === fund.beneficiaryId);
      fund.balance *= 1.001; if (beneficiary?.alive && beneficiary.age >= 18) { beneficiary.money += fund.balance; fund.status = "liberado"; fund.releasedWeek = this.week; beneficiary.history.push({ week: this.week, text: `Recebeu R$ ${Math.round(fund.balance).toLocaleString("pt-BR")} de seu fundo de herança.` }); }
    });
    this.people.filter((person) => person.alive).forEach((person) => {
      if (!(person.children || []).length) {
        person.parenting ||= { dependentIds: [], youngDependentIds: [], coParentIds: [], residentDependents: 0, careLoad: 0, supportLevel: 0, updatedWeek: this.week };
        person.parenting.updatedWeek = this.week;
        person.youngDependentCount = 0;
        return;
      }
      const dependents = (person.children || [])
        .map((id) => this.personIndex?.get(id) || this.people.find((candidate) => candidate.id === id))
        .filter((child) => child?.alive && child.age < 18);
      const young = dependents.filter((child) => child.age < 6);
      const coParents = [...new Set(dependents.flatMap((child) => child.parents || []).filter((id) => id !== person.id))]
        .map((id) => this.personIndex?.get(id) || this.people.find((candidate) => candidate.id === id))
        .filter((candidate) => candidate?.alive);
      const sameHomeYoung = young.filter((child) => child.homeId === person.homeId);
      const residentRelatives = dependents.length ? this.relativesOf(person).filter((candidate) => candidate.alive && this.sharesHousehold(person, candidate)) : [];
      person.parenting = {
        dependentIds: dependents.map((child) => child.id),
        youngDependentIds: young.map((child) => child.id),
        coParentIds: coParents.map((candidate) => candidate.id),
        residentDependents: dependents.filter((child) => child.homeId === person.homeId).length,
        careLoad: clamp(dependents.length * 12 + sameHomeYoung.length * 18 + (person.reproductive?.postpartumUntilWeek >= this.week ? 22 : 0), 0, 100),
        supportLevel: clamp(coParents.filter((candidate) => this.sharesHousehold(person, candidate)).length * 24 + residentRelatives.length * 8, 0, 100),
        updatedWeek: this.week,
      };
      person.youngDependentCount = sameHomeYoung.length;
    });
  }
  createCommunityReactivitySystem() {
    const population = this.people.filter((person) => person.alive).length;
    this.communitySystem = {
      state: createCommunityReactivityState({
        week: this.week,
        capacities: {
          daycare: Math.max(20, Math.ceil(population * .12)),
          familyMediation: Math.max(6, Math.ceil(population * .03)),
          elderHomeSupport: Math.max(10, Math.ceil(population * .055)),
          transitionalHousing: Math.max(12, Math.ceil(population * .08)),
        },
      }),
      interventions: 0,
      capacityExpansions: 0,
      lastCapacityReviewWeek: this.week,
      latestSummary: null,
    };
    this.communityCare = this.communitySystem.state;
  }
  weeklyCommunityReactivity({ initial = false } = {}) {
    if (!this.communitySystem) this.createCommunityReactivitySystem();
    const previous = this.communitySystem.state;
    const result = runCommunityReactivityWeek(previous, {
      week: this.week,
      people: this.people,
      relationships: this.relationships,
      families: this.families,
      housing: this.buildings,
    }, { week: this.week });
    this.communitySystem.state = result.state;
    this.communityCare = result.state;
    const currentCaseIds = Object.fromEntries(Object.keys(result.state.activeCases).map((service) => [service, new Set([...(result.state.activeCases[service] || []), ...(result.state.waitlists[service] || [])].map((entry) => entry.id))]));
    Object.keys(previous.activeCases || {}).forEach((service) => [...(previous.activeCases?.[service] || []), ...(previous.waitlists?.[service] || [])].forEach((entry) => {
      if (currentCaseIds[service]?.has(entry.id)) return;
      if (service === "daycare") {
        const child = this.people.find((person) => person.id === entry.details.childId);
        if (child?.childcare?.caseId === entry.id) { child.childcare = { ...child.childcare, status: "atendimento encerrado", endedWeek: this.week }; child.routine = buildRoutine(child); }
      }
      if (service === "familyMediation") {
        const link = this.relationships.find((candidate) => candidate.id === entry.details.relationshipId);
        if (link?.communityMediation?.caseId === entry.id) link.communityMediation = { ...link.communityMediation, status: "acompanhamento encerrado", endedWeek: this.week };
      }
      if (service === "elderHomeSupport") {
        const elder = this.people.find((person) => person.id === entry.details.elderId);
        if (elder?.communitySupport?.caseId === entry.id) elder.communitySupport = { ...elder.communitySupport, status: "acompanhamento encerrado", endedWeek: this.week };
      }
      if (service === "transitionalHousing") {
        const family = this.families.find((candidate) => candidate.id === entry.details.householdId || candidate.id === entry.applicantId);
        if (family?.housingAssistance?.caseId === entry.id) family.housingAssistance = { ...family.housingAssistance, status: "acompanhamento encerrado", endedWeek: this.week };
      }
    }));
    const newlyAllocated = [];
    const previousAllocated = new Set(Object.values(previous.activeCases || {}).flat().map((entry) => entry.id));
    Object.entries(result.state.activeCases).forEach(([service, cases]) => cases.forEach((entry) => {
      const isNew = !previousAllocated.has(entry.id);
      if (isNew) newlyAllocated.push(entry);
      if (service === "daycare") {
        const child = this.people.find((person) => person.id === entry.details.childId);
        if (!child) return;
        const daycare = this.buildings.find((building) => building.name === "Creche Municipal Sementinha");
        child.childcare = { providerId: daycare?.id || "creche-municipal", providerName: daycare?.name || "Creche Municipal Sementinha", caseId: entry.id, status: "vaga ativa", startedWeek: entry.startedWeek };
        child.routine = buildRoutine(child);
        (entry.details.guardianIds || []).map((id) => this.people.find((person) => person.id === id)).filter(Boolean).forEach((guardian) => {
          guardian.workReliability = clamp((guardian.workReliability ?? 70) + 2.5, 0, 100);
          guardian.parenting ||= {};
          guardian.parenting.careLoad = clamp((guardian.parenting.careLoad || 0) - 7, 0, 100);
          if (isNew) guardian.history.push({ week: this.week, text: `${child.firstName} recebeu uma vaga na creche municipal, estabilizando a rotina de trabalho da família.` });
        });
      }
      if (service === "familyMediation") {
        const link = this.relationships.find((candidate) => candidate.id === entry.details.relationshipId);
        const adults = (entry.details.adultIds || []).map((id) => this.people.find((person) => person.id === id)).filter(Boolean);
        if (!link || adults.length < 2 || !link.lifecycle) return;
        this.recordRelationshipExperience(link, { kind: "tentativa_de_reparo", text: "Participaram de mediação familiar e revisaram comunicação, guarda e coparentalidade.", valence: 42, importance: 58 });
        link.communityMediation = { status: "em acompanhamento", caseId: entry.id, startedWeek: entry.startedWeek, reviewWeek: entry.reviewWeek };
        link.lifecycle = normalizeRelationshipLifecycle({ ...link.lifecycle, familyPlanning: { ...link.lifecycle.familyPlanning, coparentingQuality: clamp((link.lifecycle.familyPlanning.coparentingQuality || 50) + 4, 0, 100) } }, adults, { week: this.week });
        this.syncRelationshipLifecycle(link, adults[0], adults[1]);
      }
      if (service === "elderHomeSupport") {
        const elder = this.people.find((person) => person.id === entry.details.elderId);
        if (!elder) return;
        elder.communitySupport = { service: "apoio domiciliar", caseId: entry.id, status: "visitas semanais", reviewWeek: entry.reviewWeek };
        elder.health = clamp(elder.health + .35, 0, 100);
        elder.happiness = clamp(elder.happiness + 1.2, 0, 100);
        elder.medical.mentalHealth = clamp((elder.medical.mentalHealth ?? 70) + .8, 0, 100);
        if (isNew) elder.history.push({ week: this.week, text: "Passou a receber visitas domiciliares, apoio com medicamentos e contato da rede comunitária." });
      }
      if (service === "transitionalHousing") {
        const family = this.families.find((candidate) => candidate.id === entry.details.householdId || candidate.id === entry.applicantId);
        if (!family) return;
        family.housingAssistance = { caseId: entry.id, status: "acompanhamento habitacional", startedWeek: entry.startedWeek, reviewWeek: entry.reviewWeek, priority: entry.priorityScore };
        family.arrears = Math.max(0, (family.arrears || 0) - .5);
        family.milestones ||= [];
        if (isNew) family.milestones.push({ week: this.week, text: "A rede municipal iniciou acompanhamento para estabilização da moradia." });
      }
    }));
    Object.entries(result.state.waitlists).forEach(([service, cases]) => cases.forEach((entry) => {
      if (service === "daycare") {
        const child = this.people.find((person) => person.id === entry.details.childId);
        if (child) { child.childcare = { caseId: entry.id, status: "fila prioritária", requestedWeek: entry.requestedWeek, waitWeeks: entry.waitWeeks }; child.routine = buildRoutine(child); }
        (entry.details.guardianIds || []).map((id) => this.people.find((person) => person.id === id)).filter(Boolean).forEach((guardian) => { guardian.workReliability = clamp((guardian.workReliability ?? 70) - .8, 0, 100); });
      }
      if (service === "familyMediation") {
        const link = this.relationships.find((candidate) => candidate.id === entry.details.relationshipId);
        if (link?.lifecycle) { link.communityMediation = { status: "aguardando mediação", caseId: entry.id, requestedWeek: entry.requestedWeek, waitWeeks: entry.waitWeeks }; link.lifecycle = normalizeRelationshipLifecycle({ ...link.lifecycle, metrics: { ...link.lifecycle.metrics, tension: clamp(link.lifecycle.metrics.tension + .7, 0, 100) } }, [this.people.find((person) => person.id === link.a), this.people.find((person) => person.id === link.b)], { week: this.week }); }
      }
      if (service === "elderHomeSupport") {
        const elder = this.people.find((person) => person.id === entry.details.elderId);
        if (elder) { elder.communitySupport = { service: "apoio domiciliar", caseId: entry.id, status: "aguardando visita", requestedWeek: entry.requestedWeek, waitWeeks: entry.waitWeeks }; elder.happiness = clamp(elder.happiness - .35, 0, 100); }
      }
      if (service === "transitionalHousing") {
        const family = this.families.find((candidate) => candidate.id === entry.details.householdId || candidate.id === entry.applicantId);
        if (family) family.housingAssistance = { caseId: entry.id, status: "fila habitacional", requestedWeek: entry.requestedWeek, waitWeeks: entry.waitWeeks, priority: entry.priorityScore };
      }
    }));
    this.communitySystem.interventions += newlyAllocated.length;
    if (!initial && newlyAllocated.length >= 2) this.log("proteção social", `${newlyAllocated.length} novas famílias ou moradores entraram na rede municipal de cuidado nesta semana.`, "civic");
    if (!initial && result.state.waitlists.transitionalHousing.length >= 3 && this.housingSystem.construction.length < 3) {
      const housing = this.housingStats(), queuedResidents = result.state.waitlists.transitionalHousing.reduce((sum, entry) => sum + entry.units, 0), projectedVacancy = housing.vacant + this.housingSystem.construction.reduce((sum, project) => sum + project.capacity, 0);
      if (queuedResidents > projectedVacancy) this.startConstruction();
    }
    if (!initial && this.week - this.communitySystem.lastCapacityReviewWeek >= 13) {
      const costs = { daycare: 8500, familyMediation: 5200, elderHomeSupport: 6800, transitionalHousing: 14000 };
      result.responses.structuralResponses.filter((response) => response.urgency === "high").sort((a, b) => (b.affectedCases / Math.max(1, this.communitySystem.state.capacities[b.service])) - (a.affectedCases / Math.max(1, this.communitySystem.state.capacities[a.service]))).slice(0, 2).forEach((response) => {
        const delta = Math.min(8, response.recommendedCapacityDelta), cost = delta * costs[response.service];
        if (delta < 1 || this.money < cost * 1.25) return;
        this.money -= cost;
        this.governance.extraordinarySpending = (this.governance.extraordinarySpending || 0) + cost;
        this.communitySystem.state.capacities[response.service] += delta;
        this.communitySystem.capacityExpansions++;
        this.governance.history.unshift({ week: this.week, text: `A rede de ${response.service} ganhou ${delta} nova(s) unidade(s) de atendimento por pressão da fila.` });
        this.log("política pública", `A prefeitura ampliou a capacidade de ${response.service} após crescimento da demanda.`, "civic");
      });
      this.communitySystem.lastCapacityReviewWeek = this.week;
    }
    this.communitySystem.latestSummary = summarizeCommunityReactivity(this.communitySystem.state);
    return result;
  }
  createHealthSystem() {
    this.healthSystem = {
      beds: 36,
      admitted: [],
      waiting: [],
      treated: 0,
      emergencies: 0,
      primaryCareCapacity: 60,
      mentalCareCapacity: 36,
      primaryCareVisits: 0,
      therapySessions: 0,
      sickLeaves: 0,
      prescriptionsFilled: 0,
      clinicalCases: [],
      triageQueue: [],
      procedures: { consultations: 0, exams: 0, surgeries: 0, therapies: 0 },
      averageWaitMinutes: 18,
      occupancyHistory: [],
    };
    this.funeralSystem = {
      pending: [],
      records: [],
      graves: [],
      capacity: 120,
      sections: 3,
      visits: 0,
      memorials: [],
      morgueCapacity: 8,
      morgueOccupied: 0,
      removals: 0,
      delayedServices: 0,
      hearseIds: [],
      totalCosts: 0,
      certificates: 0,
    };
    this.forensicSystem = { cases: [], capacity: 3, active: 0, autopsies: 0, toxicologyTests: 0, averageDelay: 0 };
    const pharmacy = this.businesses.find((b) => b.name === "Farmácia Popular");
    if (pharmacy)
      Object.entries(medicationCatalog).forEach(([name, med]) => {
        pharmacy.products[name] ||= {
          price: med.price,
          stock: 45,
          target: 70,
        };
      });
    this.people
      .filter((p) => p.age > 48)
      .slice(0, 6)
      .forEach((p, i) =>
        this.addCondition(p, i % 2 ? "hypertension" : "migraine", false),
      );
  }
  addCondition(person, id, announce = true) {
    const c = conditionById(id);
    if (!person.alive || person.medical.conditions.some((x) => x.id === id))
      return;
    person.medical.conditions.push({
      id,
      remaining: c.duration,
      severity: c.severity,
      diagnosed: this.week,
    });
    const priority=c.severity>=75?"vermelho":c.severity>=55?"laranja":c.severity>=34?"amarelo":"verde",careUnit=c.kind==="mental"?"CAPS Bem Viver":c.severity>=45?"Hospital São Lucas":"UBS Vila Esperança",clinicalCase={id:uid("clinical"),personId:person.id,conditionId:id,openedWeek:this.week,openedDay:this.day,priority,careUnit,status:c.severity>=45?"em triagem":"acompanhamento ambulatorial",appointments:1,exams:[],procedures:[],evolution:[]};
    this.healthSystem.clinicalCases.unshift(clinicalCase);this.healthSystem.clinicalCases=this.healthSystem.clinicalCases.slice(0,240);person.medical.triage={priority,caseId:clinicalCase.id,openedAt:this.time};person.medical.carePlan=[c.treatment];
    if (c.medication) {
      const prescription = {
        id: uid("rx"),
        medication: c.medication,
        conditionId: c.id,
        prescribedWeek: this.week,
        remaining: medicationCatalog[c.medication]?.days || 30,
        filled: false,
      };
      person.medical.prescriptions.push(prescription);
    }
    if (c.severity >= 34 && person.shift) {
      person.medical.sickLeave = Math.max(
        person.medical.sickLeave,
        Math.min(35, c.duration),
      );
      this.healthSystem.sickLeaves++;
      person.medical.history.unshift({
        week: this.week,
          text: `Licença médica por ${person.medical.sickLeave} dias.`,
      });
    }
    person.medical.history.unshift({
      week: this.week,
      text: `Diagnóstico: ${c.name}. ${c.treatment}.`,
    });
    person.health = Math.max(5, person.health - c.severity * 0.15);
    if (this.characterSystem && (c.severity >= 34 || c.kind === "mental")) this.recordCharacterMemory(person, {
      kind: c.kind === "mental" ? "saúde mental" : "diagnóstico",
      summary: `Recebeu diagnóstico de ${c.name} e iniciou ${c.treatment.toLowerCase()}.`,
      placeId: this.buildings.find((building) => building.name === careUnit)?.id || null,
      valence: -Math.min(88, 34 + c.severity * .65),
      importance: Math.min(92, 42 + c.severity * .58),
      stressImpact: Math.round(c.severity * .16),
      core: c.severity >= 72,
      tags: ["saúde", c.kind, id],
    });
    if (announce)
      this.log(
        "saúde",
        `${person.name} recebeu diagnóstico de ${c.name}.`,
        "civic",
        {
          peopleIds: [person.id],
          placeIds: [this.buildings.find((building) => building.name === careUnit)?.id].filter(Boolean),
          cause: `avaliação clínica confirmou ${c.name.toLowerCase()}`,
          consequences: [c.treatment, person.medical.sickLeave > 0 ? `licença médica de ${person.medical.sickLeave} dias` : "acompanhamento ambulatorial"],
          facts: [`Gravidade clínica ${Math.round(c.severity)}/100.`, `Unidade responsável: ${careUnit}.`],
          section: "Saúde",
          dedupeKey: `saude-${person.id}`,
          headline: `${person.name} inicia tratamento para ${c.name}`,
        },
      );
    if (c.severity >= 45) this.admit(person, c);
  }
  admit(person, condition) {
    if (person.medical.admitted) return;
    if (this.healthSystem.admitted.length < this.healthSystem.beds) {
      person.medical.admitted = true;
      person.medical.admittedDay = this.week * 7 + this.day;
      person.medical.visits++;
      this.healthSystem.admitted.push(person.id);
      this.healthSystem.emergencies++;
      const clinicalCase=this.healthSystem.clinicalCases.find(x=>x.personId===person.id&&x.conditionId===condition.id&&x.status!=="encerrado");if(clinicalCase){clinicalCase.status="internado";clinicalCase.admittedAt=this.time;clinicalCase.procedures.push(condition.id==="appendicitis"?"cirurgia":condition.severity>=70?"monitoramento intensivo":"observação clínica");}
      person.activity = "Internado";
      this.placePersonAt(person,"Hospital São Lucas");
      this.log(
        "emergência",
        `${person.name} deu entrada no Hospital São Lucas por ${condition.name}.`,
        "civic",
        {
          peopleIds: [person.id],
          placeIds: [person.locationId],
          cause: `quadro de ${condition.name.toLowerCase()} exigiu cuidado hospitalar`,
          consequences: ["internação registrada", "rotina e compromissos temporariamente suspensos", condition.treatment],
          facts: [`Gravidade clínica ${Math.round(condition.severity)}/100.`, `Leitos ocupados: ${this.healthSystem.admitted.length}/${this.healthSystem.beds}.`],
          section: "Saúde",
          dedupeKey: `saude-${person.id}`,
          priority: condition.severity >= 70 ? "destaque" : "normal",
          headline: `${person.name} é internado após agravamento clínico`,
        },
      );
      if (this.characterSystem) this.recordCharacterMemory(person, { kind:"internação", summary:`Foi internado no Hospital São Lucas por ${condition.name}.`, placeId:person.locationId, valence:-76, importance:84, stressImpact:16, core:condition.severity>=70, tags:["saúde","internação",condition.id] });
    } else {
      this.healthSystem.waiting.push(person.id);
      this.log(
        "saúde",
        "O Hospital São Lucas atingiu sua capacidade de leitos.",
        "civic",
      );
    }
  }
  discharge(person) {
    person.medical.admitted = false;
    person.medical.discharged++;
    this.placePersonAt(person,person.homeId);person.activity="Em casa após alta hospitalar";
    this.healthSystem.admitted = this.healthSystem.admitted.filter(
      (id) => id !== person.id,
    );
    person.medical.history.unshift({
      week: this.week,
      text: "Recebeu alta do Hospital São Lucas.",
    });
    this.healthSystem.treated++;
    this.log(
      "alta",
      `${person.name} recebeu alta e voltou para casa.`,
      "social",
    );
    const next = this.healthSystem.waiting.shift();
    if (next) {
      const p = this.people.find((x) => x.id === next),
        c = conditionById(p.medical.conditions[0]?.id);
      if (c) this.admit(p, c);
    }
  }
  fillPrescription(person) {
    const pharmacy = this.businesses.find((b) => b.name === "Farmácia Popular");
    if (!pharmacy || pharmacy.closed) return;
    person.medical.prescriptions.filter((rx) => !rx.filled).forEach((rx) => {
      const product = pharmacy.products[rx.medication], price = medicationCatalog[rx.medication]?.price || 20;
      if (!product || product.stock <= 0 || person.money < price) return;
      product.stock--;person.money -= price;pharmacy.cash += price;pharmacy.sales++;rx.filled = true;
      person.medical.medications.push({ name: rx.medication, remaining: rx.remaining, conditionId: rx.conditionId });
      this.healthSystem.prescriptionsFilled++;
      person.medical.history.unshift({ week: this.week, text: `Iniciou tratamento com ${rx.medication}.` });
    });
  }
  updateMentalHealth(person) {
    const workStress = person.shift?.hours > 40 || person.energy < 25 ? 1.2 : 0, socialProtection = person.needs.social > 60 ? 0.45 : 0;
    person.medical.mentalHealth = clamp(person.medical.mentalHealth - workStress + socialProtection + (Math.random() - .48), 0, 100);
    if (person.medical.mentalHealth < 32 && !person.medical.conditions.some((c) => ["depression", "anxiety"].includes(c.id))) this.addCondition(person, person.medical.mentalHealth < 20 ? "depression" : "anxiety");
    if (person.shift?.hours >= 40 && person.energy < 18 && Math.random() < .012) this.addCondition(person, "burnout");
  }
  dailyHealth() {
    const alive = this.people.filter((p) => p.alive);
    alive.forEach((p) => {
      let burden = 0;
      p.medical.conditions.forEach((active) => {
        const c = conditionById(active.id);
        burden += active.severity;
        const medicated = p.medical.medications.some(
          (m) => m.conditionId === active.id && m.remaining > 0,
        );
        p.health = Math.max(
          0,
          p.health -
            active.severity / (medicated ? 390 : 250) +
            (p.medical.admitted ? 0.45 : medicated ? 0.24 : 0.12),
        );
        if (c.duration < 9999) active.remaining--;
      });
      const recovered = p.medical.conditions.filter(
        (a) => conditionById(a.id).duration < 9999 && a.remaining <= 0,
      );
      recovered.forEach((a) => {
        const c = conditionById(a.id);
        p.medical.history.unshift({
          week: this.week,
          text: `Recuperou-se de ${c.name}.`,
        });
        p.health = Math.min(100, p.health + c.severity * 0.35);
      });
      p.medical.conditions = p.medical.conditions.filter(
        (a) => !recovered.includes(a),
      );
      p.medical.medications.forEach((m) => m.remaining--);
      p.medical.medications = p.medical.medications.filter((m) => m.remaining > 0);
      if (p.medical.sickLeave > 0) p.medical.sickLeave--;
      this.fillPrescription(p);
      this.updateMentalHealth(p);
      if (p.medical.admitted && burden < 38) this.discharge(p);
      if (Math.random() < healthRisk(p) * 0.035) {
        const pool = conditions.filter(
          (c) => c.kind !== "crônica" || p.age > 35,
        );
        this.addCondition(p, pool[Math.floor(Math.random() * pool.length)].id);
      }
      const mortality =
        (p.age > 82 ? (p.age - 80) * 0.00018 : 0) +
        (p.health < 20 ? 0.005 : 0) +
        (burden > 70 ? 0.0028 : 0) +
        (p.medical.conditions.some((a) => a.id === "heart_disease") ? 0.0008 : 0);
      if (Math.random() < mortality) {
        const primary = p.medical.conditions.slice().sort((a, b) => b.severity - a.severity)[0];
        this.die(
          p,
          primary
            ? conditionById(primary.id).name
            : p.age > 82
              ? "causas naturais associadas à idade"
              : "complicações de saúde",
        );
      }
      else if (!p.medical.conditions.length)
        p.health = Math.min(100, p.health + 0.18);
    });
    this.healthSystem.clinicalCases.filter(c=>c.status!=="encerrado").forEach(c=>{const person=this.people.find(p=>p.id===c.personId),condition=person?.medical.conditions.find(x=>x.id===c.conditionId);if(!person?.alive){c.status="óbito";c.closedWeek=this.week;return;}if(!condition){c.status="encerrado";c.closedWeek=this.week;c.evolution.unshift({week:this.week,text:"Alta clínica após recuperação."});return;}if(person.medical.admitted)c.status="internado";else c.status="acompanhamento ambulatorial";if(Math.random()<.22){c.exams.push(pick(["hemograma","imagem diagnóstica","avaliação clínica","painel metabólico"]));this.healthSystem.procedures.exams++;}c.evolution.unshift({week:this.week,day:this.day,text:`Saúde ${Math.round(person.health)}% · gravidade ${Math.round(condition.severity)}.`});c.evolution=c.evolution.slice(0,12);});
    this.healthSystem.procedures.consultations+=Math.min(this.healthSystem.primaryCareCapacity,alive.filter(p=>p.medical.conditions.length&&!p.medical.admitted).length);this.healthSystem.procedures.therapies+=alive.filter(p=>p.medical.conditions.some(c=>conditionById(c.id)?.kind==="mental")).length;this.healthSystem.occupancyHistory.unshift({week:this.week,day:this.day,admitted:this.healthSystem.admitted.length,beds:this.healthSystem.beds,waiting:this.healthSystem.waiting.length});this.healthSystem.occupancyHistory=this.healthSystem.occupancyHistory.slice(0,35);this.healthSystem.averageWaitMinutes=Math.round(12+this.healthSystem.waiting.length*9+this.healthSystem.admitted.length/Math.max(1,this.healthSystem.beds)*16);
    alive.filter((p) => p.alive).forEach((p) => {
      const contagious = p.medical.conditions.find((a) => conditionById(a.id).contagious > 0);
      if (!contagious) return;
      const condition = conditionById(contagious.id), contacts = this.people.filter((x) => x.alive && x.id !== p.id && x.homeId === p.homeId);
      contacts.forEach((contact) => {
        if (Math.random() < condition.contagious * .08) this.addCondition(contact, condition.id, false);
      });
    });
  }
  die(person, cause) {
    if (!person.alive) return;
    if (this.isPlayerControlled(person) && (person.currentTrip || person.playerControl?.travelCommand || person.playerControl?.activeAction)) this.cancelPlayerAction("ação interrompida pelo falecimento");
    else if (person.currentTrip) this.abandonTrip(person, "deslocamento interrompido pelo falecimento");
    const householdAtDeath = this.familyOf(person), survivingPartnerships = this.romanticLinksOf(person, { activeOnly: true }).filter((entry) => entry.person.alive);
    const mourners = this.relationshipsOf(person)
      .filter((x) => x.person.alive && x.link.affinity > 12)
      .map((x) => ({ person: x.person, affinity: x.link.affinity }));
    person.alive = false;
    person.activity = "Falecido";
    person.target = null;
    if (person.justice?.incarcerated) {
      this.justiceSystem.prisoners = this.justiceSystem.prisoners.filter((id) => id !== person.id);
      this.justiceSystem.prisonWings.forEach((wing) => (wing.inmates = wing.inmates.filter((id) => id !== person.id)));
      person.justice.incarcerated = false;
      person.justice.pretrial = false;
      person.justice.incarcerationEndedBy = "falecimento";
      person.justice.incarcerationEndWeek = this.week;
      person.justice.prisonWing = null;
      person.justice.securityLevel = null;
      person.justice.cell = null;
      this.justiceSystem.overcrowding = Math.max(0, this.justiceSystem.prisoners.length - this.justiceSystem.prisonCapacity);
    }
    const home = this.buildings.find((b) => b.id === person.homeId);
    if (home) home.occupied = Math.max(0, home.occupied - 1);
    this.healthSystem.admitted = this.healthSystem.admitted.filter(
      (id) => id !== person.id,
    );
    const location = this.buildings.find((b) => b.id === person.locationId),
      activeConditions = person.medical.conditions
        .map((c) => conditionById(c.id)?.name)
        .filter(Boolean),
      physician = this.people.find(
        (p) => p.alive && ["Enfermeiro", "Farmacêutico"].includes(p.role),
      ),
      funeralPackage = person.money > 18000 ? { name: "cerimonial", cost: 6900, preparationHours: 12 } : person.money > 6000 ? { name: "tradicional", cost: 4700, preparationHours: 8 } : { name: "básico", cost: 2800, preparationHours: 5 },
      causeLower = cause.toLowerCase(),
      manner = /homic|assassin|violência|crime/.test(causeLower) ? "homicídio" : /suic|autoinflig/.test(causeLower) ? "autoinfligida" : /acidente|atropel|colisão|queda|incêndio/.test(causeLower) ? "acidental" : /desconhecida|súbita|suspeita/.test(causeLower) ? "indeterminada" : "natural",
      needsForensics = manner !== "natural",
      deathRecord = {
        id: uid("death"),
        personId: person.id,
        cause,
        primaryCause: cause,
        contributing: activeConditions.filter((name) => name !== cause),
        manner,
        provisionalCause: needsForensics,
        forensicCaseId: null,
        place: location?.name || "Residência",
        age: person.age,
        week: this.week,
        day: this.day,
        time: this.time,
        declaredBy: physician?.name || "Equipe do Hospital São Lucas",
        certificate: null,
        familyNotified: true,
        logistics: { status: "aguardando remoção", provider: "Funerária Serenidade", package: funeralPackage.name, removalDay: null, preparationHours: funeralPackage.preparationHours, hearseId: null, morgue: false, delays: 0 },
        bureaucracy: [
          { step: "Declaração médica", status: "concluído" },
          { step: "Certidão de óbito", status: "pendente" },
          { step: "Autorização de sepultamento", status: "pendente" },
          { step: "Inventário patrimonial", status: "iniciado" },
        ],
        funeral: {
          status: "preparação",
          daysUntil: 2,
          type: Math.random() < 0.12 ? "cremação" : "sepultamento",
          cost: funeralPackage.cost,
          attendees: [],
          graveId: null,
        },
      };
    this.funeralSystem.pending.push(deathRecord.id);
    this.funeralSystem.records.push(deathRecord);
    if (needsForensics) {
      const forensicCase = { id: uid("forensic"), deathRecordId: deathRecord.id, personId: person.id, status: "aguardando necropsia", daysRemaining: manner === "indeterminada" ? 3 : 2, toxicology: ["homicídio", "autoinfligida", "indeterminada"].includes(manner), findings: [], finalCause: null, investigatorId: null, openedWeek: this.week };
      deathRecord.forensicCaseId = forensicCase.id; deathRecord.logistics.status = "aguardando liberação do IML";
      this.forensicSystem.cases.unshift(forensicCase);
      this.placePersonAt(person, "Instituto Médico-Legal");
    }
    mourners.forEach(({ person: mourner, affinity }) => {
      const family = this.familyOf(person)?.memberIds.includes(mourner.id),
        intensity = clamp(Math.round(affinity * 0.72 + (family ? 24 : 0)), 18, 100),
        days = Math.max(7, Math.round(intensity * 0.8));
      mourner.bereavement ||= { active: [], leaveDays: 0, visitToday: null };
      mourner.bereavement.active.unshift({
        personId: person.id,
        recordId: deathRecord.id,
        intensity,
        daysRemaining: days,
        stage: intensity > 72 ? "choque" : "saudade",
        visits: 0,
      });
      mourner.bereavement.leaveDays = Math.max(
        mourner.bereavement.leaveDays,
        family ? Math.min(5, Math.ceil(intensity / 22)) : intensity > 70 ? 1 : 0,
      );
      mourner.happiness = clamp(mourner.happiness - intensity * 0.12, 0, 100);
      mourner.history.push({ week: this.week, text: `Entrou em luto por ${person.name}.` });
      this.recordCharacterMemory(mourner, {
        kind: "luto",
        summary: `Recebeu a notícia do falecimento de ${person.name} e entrou em luto.`,
        actorIds: [person.id],
        placeId: mourner.locationId,
        valence: -96,
        importance: intensity,
        stressImpact: Math.round(intensity * .24),
        core: intensity >= 58,
        tags: ["morte", "luto", family ? "família" : "amizade"],
      });
    });
    this.deaths.push({
      personId: person.id,
      cause,
      week: this.week,
      day: this.day,
      recordId: deathRecord.id,
    });
    deathRecord.estateId = this.openEstate(person).id;
    this.handleDependents(person, deathRecord);
    const activePregnancy = this.demographics.pregnancies.find((pregnancy) => pregnancy.status === "active" && pregnancy.parentIds.includes(person.id));
    if (activePregnancy && activePregnancy.carrierId === person.id) {
      activePregnancy.status = "interrupted"; activePregnancy.interruptedByDeathId = person.id; this.demographics.pregnancyLosses++;
      this.updatePregnancyRelationship(activePregnancy, activePregnancy.parentIds.map((id) => this.people.find((candidate) => candidate.id === id)).filter(Boolean), "perda_gestacional", { text: "A gestação foi interrompida pelo falecimento da pessoa gestante.", valence: -100, importance: 100, milestone: true });
    }
    survivingPartnerships.forEach(({ person: partner, link }) => {
      const previousStage = link.lifecycle?.stage || this.romanticStageForLegacyLink(link);
      link.lifecycle = transitionRelationshipStage(this.ensureRelationshipLifecycle(link, person, partner), ["casamento", "uniao_estavel", "noivado"].includes(previousStage) ? "viuvez" : "encerrado", { people: [person, partner], week: this.week, partnerDied: true, text: `O falecimento de ${person.name} encerrou a convivência afetiva.` });
      this.syncRelationshipLifecycle(link, person, partner);
      if (partner.partnerId === person.id) partner.partnerId = null;
      partner.previousPartnerIds ||= []; if (!partner.previousPartnerIds.includes(person.id)) partner.previousPartnerIds.push(person.id);
      partner.history.push({ week: this.week, text: link.lifecycle.stage === "viuvez" ? `Ficou viúvo(a) após o falecimento de ${person.name}.` : `Perdeu ${person.name}, com quem mantinha ${relationshipStageLabel(previousStage).toLowerCase()}.` });
      link.endedWeek = this.week; link.history ||= []; link.history.unshift({ week: this.week, text: `Vínculo afetivo encerrado pelo falecimento de ${person.name}.` });
    });
    person.previousPartnerIds ||= []; if (person.partnerId) person.previousPartnerIds.push(person.partnerId); person.partnerId = null;
    if (householdAtDeath) householdAtDeath.memberIds = householdAtDeath.memberIds.filter((id) => id !== person.id);
    person.formerHouseholdId = person.householdId || person.familyId; person.householdId = null;
    person.history.push({ week: this.week, text: `Faleceu por ${cause}.` });
    this.log("falecimento", `${person.name} faleceu por ${cause}.`, "civic");
    this.rebuildKinship();
  }
  dailyForensics() {
    const open = this.forensicSystem.cases.filter((c) => !["laudo concluído", "corpo liberado"].includes(c.status));
    let slots = this.forensicSystem.capacity;
    open.forEach((c) => {
      if (slots-- <= 0) return;
      const record = this.funeralSystem.records.find((r) => r.id === c.deathRecordId), person = this.people.find((p) => p.id === c.personId), legist = this.people.find((p) => p.alive && p.role === "Médico-legista");
      c.status = "necropsia em andamento"; c.investigatorId ||= legist?.id || null; c.daysRemaining--;
      if (c.daysRemaining > 0) return;
      if (c.toxicology) { this.forensicSystem.toxicologyTests++; c.findings.push(Math.random() < .18 ? "substância tóxica detectada" : "toxicologia sem achados relevantes"); }
      c.findings.push(record.manner === "acidental" ? "lesões compatíveis com evento acidental" : record.manner === "homicídio" ? "lesões compatíveis com ação de terceiro" : "exame anatomopatológico concluído");
      c.finalCause = record.manner === "indeterminada" ? (Math.random() < .5 ? "Evento cardíaco súbito" : "Intoxicação aguda") : record.primaryCause;
      c.status = "laudo concluído"; c.closedWeek = this.week; record.primaryCause = c.finalCause; record.provisionalCause = false; record.logistics.status = "aguardando remoção";
      record.bureaucracy.unshift({ step: "Laudo de necropsia", status: "concluído" }); this.forensicSystem.autopsies++;
      if (record.manner === "homicídio") { this.justiceSystem.investigations ||= []; this.justiceSystem.investigations.unshift({ id: uid("investigation"), victimId: person.id, forensicCaseId: c.id, status: "investigação aberta", openedWeek: this.week, evidence: c.findings.slice() }); }
      this.log("medicina legal", `O IML concluiu o laudo de ${person.name}: ${c.finalCause}.`, "civic");
    });
    this.forensicSystem.active = open.filter((c) => c.status === "necropsia em andamento").length;
    this.forensicSystem.averageDelay = this.forensicSystem.cases.length ? Math.round(this.forensicSystem.cases.reduce((n, c) => n + Math.max(0, c.daysRemaining), 0) / this.forensicSystem.cases.length * 10) / 10 : 0;
  }
  dailyFunerals() {
    this.funeralSystem.pending.slice().forEach((recordId) => {
      const record = this.funeralSystem.records.find((r) => r.id === recordId),
        person = this.people.find((p) => p.id === record.personId);
      if (record.forensicCaseId && record.provisionalCause) { record.funeral.status = "aguardando liberação do IML"; return; }
      if (record.logistics?.status === "aguardando remoção") {
        const hearse = this.funeralSystem.hearseIds.map((id) => this.vehicles.find((v) => v.id === id)).find((v) => v?.status === "active");
        if (!hearse || this.funeralSystem.morgueOccupied >= this.funeralSystem.morgueCapacity) {
          record.logistics.delays++; this.funeralSystem.delayedServices++;
          record.funeral.status = "aguardando vaga no necrotério";
          return;
        }
        hearse.status = "funeral_service"; hearse.record.history.unshift({ week: this.week, text: `Remoção de ${person.name}.` });
        record.logistics.status = "preparação do corpo"; record.logistics.removalDay = this.day; record.logistics.hearseId = hearse.id; record.logistics.morgue = true;
        this.placePersonAt(person, "Funerária Serenidade");
        this.funeralSystem.morgueOccupied++; this.funeralSystem.removals++;
        this.log("funerária", `O corpo de ${person.name} foi removido para preparação na Funerária Serenidade.`, "civic");
        return;
      }
      if (record.logistics?.status === "preparação do corpo") {
        const removalVehicle = this.vehicles.find((v) => v.id === record.logistics.hearseId); if (removalVehicle) removalVehicle.status = "active";
        record.logistics.preparationHours -= 24;
        if (record.logistics.preparationHours > 0) return;
        record.logistics.status = "liberado para cerimônia";
      }
      record.funeral.daysUntil--;
      if (record.funeral.daysUntil === 1) {
        record.certificate = `CV-${String(this.funeralSystem.certificates + 1).padStart(6, "0")}`;
        this.funeralSystem.certificates++;
        record.bureaucracy.find((s) => s.step.includes("Certidão")).status =
          "concluído";
        record.bureaucracy.find((s) => s.step.includes("Autorização")).status =
          "concluído";
        record.funeral.status = "velório";
        this.placePersonAt(person, "Cemitério da Paz");
        const attendees = this.relationshipsOf(person)
          .filter((x) => x.person.alive && x.link.affinity > 20)
          .map((x) => x.person.id);
        record.funeral.attendees = attendees;
        this.events.active.push({
          id: uid("funeral-event"),
          name: `Velório de ${person.name}`,
          season: this.events.season,
          location: "Cemitério da Paz",
          start: 14,
          end: 18,
          remaining: 1,
          duration: 1,
          participants: attendees,
          attendance: 0,
          status: "active",
          funeral: true,
        });
      }
      if (record.funeral.daysUntil <= 0) {
        if (this.funeralSystem.graves.length >= this.funeralSystem.capacity) {
          this.funeralSystem.sections++;
          this.funeralSystem.capacity += 80;
          this.money -= 85000;
          this.log("obras", `O cemitério ganhou a quadra ${this.funeralSystem.sections}.`, "civic");
        }
        const grave = {
          id: uid("grave"),
          code: `Q${1 + Math.floor(this.funeralSystem.graves.length / 40)}-${String(this.funeralSystem.graves.length + 1).padStart(3, "0")}`,
          personId: person.id,
          recordId: record.id,
          epitaph: `${person.name} · ${person.age} anos`,
        };
        record.funeral.graveId = grave.id;
        record.funeral.status =
          record.funeral.type === "cremação" ? "cremado" : "sepultado";
        this.placePersonAt(person, "Cemitério da Paz");
        record.bureaucracy.find((s) => s.step.includes("Inventário")).status =
          "em andamento";
        this.funeralSystem.graves.push(grave);
        this.funeralSystem.pending = this.funeralSystem.pending.filter(
          (id) => id !== record.id,
        );
        this.funeralSystem.totalCosts += record.funeral.cost;
        if (record.logistics?.morgue) { this.funeralSystem.morgueOccupied = Math.max(0, this.funeralSystem.morgueOccupied - 1); record.logistics.morgue = false; }
        const hearse = this.vehicles.find((v) => v.id === record.logistics?.hearseId); if (hearse) { hearse.status = "active"; hearse.mileage += 18; hearse.fuel = Math.max(0, hearse.fuel - 3); }
        record.logistics.status = "serviço concluído";
        const provider = this.businesses.find((b) => b.name === record.logistics.provider); if (provider) { provider.cash += record.funeral.cost; provider.revenue += record.funeral.cost; provider.sales++; }
        const family = this.familyOf(person),
          payers = family?.memberIds
            .map((id) => this.people.find((p) => p.id === id))
            .filter((p) => p?.alive && p.age >= 18);
        payers?.forEach(
          (p) => (p.money -= record.funeral.cost / Math.max(1, payers.length)),
        );
        this.log(
          "sepultamento",
          `${person.name} foi ${record.funeral.status} após cerimônia com ${record.funeral.attendees.length} familiares e amigos.`,
          "civic",
        );
      }
    });
  }
  dailyBereavement() {
    this.people.filter((p) => p.alive).forEach((p) => {
      p.bereavement ||= { active: [], leaveDays: 0, visitToday: null };
      p.bereavement.visitToday = null;
      if (p.bereavement.leaveDays > 0) p.bereavement.leaveDays--;
      p.bereavement.active.forEach((grief) => {
        grief.daysRemaining--;
        grief.intensity = clamp(grief.intensity - (0.35 + p.personality.dimensions.stability * 0.006), 0, 100);
        grief.stage = grief.intensity > 70 ? "choque" : grief.intensity > 38 ? "adaptação" : "saudade";
        p.happiness = clamp(p.happiness - grief.intensity * 0.002, 0, 100);
        const grave = this.funeralSystem.graves.find((g) => g.recordId === grief.recordId);
        if (grave && Math.random() < 0.015 + grief.intensity * 0.0007) {
          p.bereavement.visitToday = grief.recordId;
          grief.visits++;
          this.funeralSystem.visits++;
        }
      });
      p.bereavement.active = p.bereavement.active.filter((g) => g.daysRemaining > 0 || g.intensity > 12);
    });
    this.funeralSystem.records.forEach((record) => {
      const ageWeeks = this.week - record.week;
      if (ageWeeks > 0 && ageWeeks % 52 === 0 && !this.funeralSystem.memorials.some((m) => m.recordId === record.id && m.week === this.week)) {
        const person = this.people.find((p) => p.id === record.personId);
        this.funeralSystem.memorials.unshift({ recordId: record.id, week: this.week, name: `Memorial de ${person.name}` });
        this.funeralSystem.memorials = this.funeralSystem.memorials.slice(0, 30);
      }
    });
  }
  createEducationSystem() {
    this.educationSystem = {
      schoolCapacity: 260,
      collegeCapacity: 180,
      graduates: 0,
      dropouts: 0,
    };
    this.people.forEach((p, index) => {
      const stage = stageForAge(p.age);
      if (!stage) return;
      if (stage.id === "college" && p.role !== "Estudante" && index % 4 !== 0)
        return;
      p.education.stage = stage.id;
      p.education.institution = stage.institution;
      p.education.enrolled = true;
      p.education.performance = 42 + Math.floor(Math.random() * 48);
      p.education.attendance = 82 + Math.floor(Math.random() * 19);
      p.education.course =
        stage.id === "college" ? courses[index % courses.length] : null;
      p.education.semester = stage.id === "college" ? 1 + (index % 8) : 1;
      p.education.history.push({
        week: 1,
        text: `Matriculado em ${stage.name}.`,
      });
      p.role = "Estudante";
      p.workplace = stage.institution;
    });
  }
  studentsAt(institution) {
    return this.people.filter(
      (p) =>
        p.alive &&
        p.education.enrolled &&
        p.education.institution === institution,
    );
  }
  weeklyEducation() {
    this.people
      .filter((p) => p.alive && !this.isPlayerControlled(p) && p.education.enrolled)
      .forEach((p) => {
        const e = p.education,
          absence =
            p.medical.admitted || p.medical.conditions.length
              ? Math.random() * 8
              : Math.random() * 2;
        e.attendance = Math.max(0, Math.min(100, e.attendance - absence + 0.8));
        const study =
          p.traits.includes("curioso") || p.traits.includes("metódico")
            ? 2.2
            : 1.1;
        const educationQuality = (this.educationSystem.quality || 70) / 70;
        e.performance = Math.max(
          0,
          Math.min(
            100,
            e.performance +
              study * educationQuality -
              Math.random() * 2 -
              (e.attendance < 70 ? 2 : 0),
          ),
        );
        const skill = skillNames[Math.floor(Math.random() * skillNames.length)];
        e.skills[skill] = Math.min(100, e.skills[skill] + 0.6);
        e.credits += e.attendance > 70 ? 1 : 0;
        if (e.attendance < 45 && Math.random() < 0.08) {
          e.enrolled = false;
          this.educationSystem.dropouts++;
          e.history.unshift({
            week: this.week,
            text: "Abandonou os estudos por baixa frequência.",
          });
          this.log("educação", `${p.name} abandonou os estudos.`, "civic");
        }
      });
    if (this.week % 26 === 0)
      this.people
        .filter(
          (p) =>
            p.alive && !this.isPlayerControlled(p) && p.education.enrolled && p.education.stage === "college",
        )
        .forEach((p) => {
          p.education.semester++;
          if (p.education.semester > 8) this.graduate(p);
        });
  }
  graduate(p) {
    const e = p.education;
    e.enrolled = false;
    e.degree = e.course || "Ensino médio";
    e.history.unshift({ week: this.week, text: `Concluiu ${e.degree}.` });
    this.educationSystem.graduates++;
    p.role =
      e.stage === "college"
        ? "Profissional recém-formado"
        : "Em busca de emprego";
    p.workplace = "—";
    p.shift = null;
    this.log("formatura", `${p.name} concluiu ${e.degree}.`, "social");
    this.recordCharacterMemory(p, { kind:"formatura", summary:`Concluiu ${e.degree} e encerrou uma etapa importante dos estudos.`, placeId:this.buildings.find((building)=>building.name===e.institution)?.id||null, valence:88, importance:90, novelty:76, core:true, tags:["formatura","educação","conquista"] });
  }
  ensureSocialRelationship(a, b, context = {}) {
    let link = this.indexedRelationship(a, b);
    if (!link) {
      const structural = context.isFamily || context.isCoworker || context.isClassmate;
      const cap = structural ? 48 : 28;
      if (this.relationshipCountFor(a) >= cap || this.relationshipCountFor(b) >= cap) return null;
      link = {
        id: uid("rel"),
        a: a.id,
        b: b.id,
        type: context.isFamily ? "família" : context.isCoworker || context.isClassmate ? "colega" : context.isNeighbor ? "vizinhança" : "conhecido",
        affinity: context.isFamily ? 42 : 8,
        trust: context.isFamily ? 48 : 8,
        interactions: 0,
        lastEvent: "Conheceram-se recentemente",
        history: [],
      };
      this.relationships.push(link);
      this.indexNewRelationship(link);
      this.characterSystem.newConnections++;
    }
    return ensureRelationshipDepth(link);
  }
  spreadSocialRumor(a, b, place) {
    const subject = this.people
      .filter((person) => person.alive && ![a.id, b.id].includes(person.id) && (person.notability?.score > 24 || person.justice?.recordPoints > 2))
      .sort((x, y) => (y.notability?.score || 0) - (x.notability?.score || 0))[0];
    if (!subject) return null;
    const existing = this.characterSystem.rumors.find((rumor) => rumor.subjectId === subject.id && this.week - rumor.week <= 2);
    const rumor = existing || {
      id: uid("rumor"),
      subjectId: subject.id,
      originatorId: a.id,
      week: this.week,
      day: this.day,
      summary: subject.justice?.recordPoints > 2
        ? `comentários sobre a ficha e a conduta de ${subject.name}`
        : `comentários sobre o destaque recente de ${subject.name}`,
      credibility: clamp(42 + a.personality.empathy * .18 - a.personality.riskTolerance * .08, 18, 88),
      heardByIds: [],
      distortions: 0,
    };
    [a.id, b.id].forEach((id) => { if (!rumor.heardByIds.includes(id)) rumor.heardByIds.push(id); });
    if (existing) {
      rumor.credibility = clamp(rumor.credibility + (Math.random() - .48) * 6, 10, 95);
      if (Math.random() < .16) rumor.distortions++;
    } else this.characterSystem.rumors.unshift(rumor);
    [a, b].forEach((person) => {
      person.socialKnowledge ||= { rumorIds: [] };
      if (!person.socialKnowledge.rumorIds.includes(rumor.id)) person.socialKnowledge.rumorIds.unshift(rumor.id);
      person.socialKnowledge.rumorIds = person.socialKnowledge.rumorIds.slice(0, 20);
    });
    return rumor;
  }
  performSocialInteraction(a, b, place, { macro = false } = {}) {
    if (!a?.alive || !b?.alive || a.id === b.id || a.currentTrip || b.currentTrip || a.locationId !== b.locationId) return null;
    this.ensureCharacterState(a); this.ensureCharacterState(b);
    const business = this.businesses.find((candidate) => candidate.buildingId === place?.id);
    const existing = this.indexedRelationship(a, b);
    const isFamily = existing?.type === "família" || Boolean(this.kinship?.relationBetween(a, b, { includeAffinity: true }));
    const isCoworker = Boolean(a.businessId && a.businessId === b.businessId) || (!a.education?.enrolled && !b.education?.enrolled && a.workplace && a.workplace !== "—" && a.workplace === b.workplace);
    const isClassmate = Boolean(a.education?.enrolled && b.education?.enrolled && a.education.institution && a.education.institution === b.education.institution && a.education.stage === b.education.stage);
    const homeA = this.buildings.find((building) => building.id === a.homeId), homeB = this.buildings.find((building) => building.id === b.homeId);
    const isNeighbor = Boolean(homeA?.districtId && homeA.districtId === homeB?.districtId);
    const romanticLifecycle = existing && this.isRomanticLink(existing) ? this.ensureRelationshipLifecycle(existing, a, b) : null;
    const sharedChildren = this.sharedChildrenOf(a, b).length;
    const context = buildSocialContext(a, b, {
      building: place,
      business,
      hour: Math.floor(this.minute / 60),
      day: this.day,
      isFamily,
      isCoworker,
      isClassmate,
      romanceAllowed: this.canFormRomance(a, b) && this.orientationCompatible(a, b),
      isRomantic: romanticLifecycle?.status === "active",
      isCohabiting: romanticLifecycle?.cohabitation?.active || this.sharesHousehold(a, b),
      sharedChildren,
      relationshipStage: romanticLifecycle?.stage || null,
    });
    context.isNeighbor = isNeighbor;
    const link = this.ensureSocialRelationship(a, b, { isFamily, isCoworker, isClassmate, isNeighbor });
    if (!link) return null;
    const interaction = chooseSocialInteraction(a, b, link, context);
    applyInteractionEffects(a, b, link, interaction, {
      week: this.week,
      day: this.day,
      time: macro ? "dia resumido" : this.time,
      placeId: place?.id || null,
    });
    if (romanticLifecycle?.status === "active") {
      const lifecycleKinds = {
        flirt: "flerte",
        "couple-check-in": "apoio_emocional",
        "romantic-date": "tempo_de_qualidade",
        "future-planning": "conversa_sobre_futuro",
        "household-coordination": "tarefa_compartilhada",
        "parenting-teamwork": "cuidado_parental",
        "boundaries-conversation": "tentativa_de_reparo",
        "jealousy-friction": "ciume",
        "couple-repair": "tentativa_de_reparo",
        disagreement: "discussao",
        "public-argument": "discussao",
        reconciliation: "reconciliacao",
        "emotional-support": "apoio_emocional",
        "walk-and-talk": "tempo_de_qualidade",
      };
      this.recordRelationshipExperience(link, {
        kind: lifecycleKinds[interaction.id] || (interaction.tone === "negative" ? "desacordo" : interaction.tone === "support" ? "apoio_emocional" : "encontro"),
        text: interaction.text,
        tone: interaction.tone,
        valence: Math.abs(interaction.memory.valence || 0) <= 1 ? (interaction.memory.valence || 0) * 100 : interaction.memory.valence,
        importance: interaction.memory.salience,
        placeId: place?.id || null,
      });
    }
    const contextTag = isFamily ? "family" : isCoworker ? "work" : isClassmate ? "school" : business ? "commerce" : place?.type === "park" ? "leisure" : isNeighbor ? "neighborhood" : "community";
    link.contextCounts ||= {};
    link.contextCounts[contextTag] = (link.contextCounts[contextTag] || 0) + 1;
    link.views ||= {};
    [[a, b], [b, a]].forEach(([viewer, other]) => {
      const attractionSeed = context.romanceAllowed && !isFamily
        ? clamp((interaction.compatibility - 30) * .48 + ((other.genetics?.beauty || 50) - 50) * .12 + ((other.genetics?.charisma || 50) - 50) * .08, 0, 58)
        : 0;
      const previous = link.views[viewer.id] || { affection: link.affinity, trust: link.trust, attraction: attractionSeed, resentment: 0 };
      const attractionChange = interaction.id === "flirt"
        ? 10
        : interaction.tone === "negative"
          ? -1.2
          : context.romanceAllowed && interaction.compatibility > 50
            ? .65 + (interaction.compatibility - 50) / 32
            : 0;
      link.views[viewer.id] = {
        affection: clamp(previous.affection + (interaction.effects.affinity || 0) + (other.genetics?.charisma || 50) * .005, -100, 100),
        trust: clamp(previous.trust + (interaction.effects.trust || 0), 0, 100),
        attraction: clamp(previous.attraction + attractionChange, 0, 100),
        resentment: clamp(previous.resentment + (interaction.tone === "negative" ? Math.abs(interaction.effects.affinity || -2) : -1), 0, 100),
      };
    });
    this.clearSocialContext(a); this.clearSocialContext(b);
    const absoluteNow = this.absoluteMinute();
    [a, b].forEach((person, index) => {
      const other = index ? a : b;
      person.socialInteractionAt = absoluteNow;
      person.socialContext = {
        interactionId: interaction.id,
        counterpartId: other.id,
        personIds: [person.id, other.id],
        placeId: place?.id || null,
        label: `Com ${other.firstName}: ${interaction.text}`,
        tone: interaction.tone,
        sinceWeek: this.week,
        sinceDay: this.day,
        sinceMinute: this.minute,
        expiresAt: absoluteNow + (macro ? 30 : 55),
      };
      person.actionLog.unshift({
        week: this.week,
        day: this.day,
        time: macro ? "dia resumido" : this.time,
        activity: person.socialContext.label,
        place: place?.name || "Cidade",
        peopleIds: [other.id],
        interactionId: interaction.id,
      });
      person.actionLog = person.actionLog.slice(0, 24);
      let memory = null;
      const shouldRemember = interaction.memory.salience >= 32 || interaction.tone !== "positive" || ["flirt", "mentoring", "family-care"].includes(interaction.id);
      if (shouldRemember) memory = this.recordCharacterMemory(person, {
          kind: interaction.tone === "negative" ? "conflito social" : interaction.tone === "support" ? "apoio social" : "encontro social",
          summary: `${person.name} e ${other.name} ${interaction.text} em ${place?.name || "Vila Esperança"}.`,
          actorIds: [other.id],
          placeId: place?.id || null,
          valence: interaction.memory.valence,
          importance: interaction.memory.salience,
          stressImpact: interaction.effects.stress || 0,
          tags: ["social", contextTag, interaction.id],
          mergeWindowDays: interaction.id === "ordinary-conversation" ? 14 : 5,
        });
      if (memory?.id) {
        link.sharedMemoryIds ||= [];
        if (!link.sharedMemoryIds.includes(memory.id)) link.sharedMemoryIds.unshift(memory.id);
        link.sharedMemoryIds = link.sharedMemoryIds.slice(0, 20);
      }
      this.queueCharacterEvent(person, {
        kind: "social",
        summary: interaction.text,
        valence: interaction.memory.valence,
        importance: interaction.memory.salience,
        stressImpact: interaction.effects.stress || 0,
      });
    });
    if (isFamily) {
      const bond = this.ensureFamilyBond(a, b, this.kinship?.relationBetween(a, b));
      if (bond) {
        bond.proximity = clamp(bond.proximity + (interaction.effects.affinity || 0) * .45, 0, 100);
        bond.trust = clamp(bond.trust + (interaction.effects.trust || 0) * .4, 0, 100);
        bond.tension = clamp(bond.tension + (interaction.effects.tension || 0) * .55, 0, 100);
        bond.lastContactWeek = this.week;
      }
    }
    if (interaction.rumor) this.spreadSocialRumor(a, b, place);
    if (a.socialIntent?.counterpartId === b.id) a.socialIntent = null;
    if (b.socialIntent?.counterpartId === a.id) b.socialIntent = null;
    this.characterSystem.interactions++;
    if (interaction.tone === "support") this.characterSystem.supportiveInteractions++;
    if (interaction.tone === "negative") this.characterSystem.conflicts++;
    if (interaction.id === "reconciliation") this.characterSystem.reconciliations++;
    const dayKey = `${this.week}:${this.day}`;
    if (this.characterSystem.dailyLogKey !== dayKey) {
      this.characterSystem.dailyLogKey = dayKey;
      this.characterSystem.dailyLogCount = 0;
    }
    if (interaction.notable && this.characterSystem.dailyLogCount < 2) {
      this.log(
        interaction.tone === "negative" ? "conflito" : interaction.id === "reconciliation" ? "reconciliação" : "encontro",
        `${a.name} e ${b.name} ${interaction.text}${place ? ` em ${place.name}` : ""}.`,
        interaction.tone === "negative" ? "civic" : "social",
      );
      this.characterSystem.notableMoments.unshift({ week: this.week, day: this.day, personIds: [a.id, b.id], placeId: place?.id || null, interactionId: interaction.id, text: interaction.text });
      this.characterSystem.notableMoments = this.characterSystem.notableMoments.slice(0, 80);
      this.characterSystem.dailyLogCount++;
    }
    this.characterSystem.revision++;
    return interaction;
  }
  socialHour({ macro = false } = {}) {
    const now = this.absoluteMinute(), groups = new Map();
    this.people
      .filter((person) => person.alive && !this.isPlayerControlled(person) && person.age >= 4 && !person.currentTrip && person.locationId && now - (person.socialInteractionAt || -Infinity) >= (macro ? 1 : 45))
      .forEach((person) => {
        const spaceId = macro ? null : person.currentAction?.spaceId;
        const key = `${person.locationId}|${spaceId || "shared"}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(person);
      });
    const population = this.people.filter((person) => person.alive).length, intensity = this.cityDynamics?.state?.intensity || 48;
    const globalLimit = Math.max(5, Math.min(macro ? 10 : 8, Math.ceil(population / (macro ? 28 : 32)) + (intensity >= 68 ? 1 : 0)));
    let completed = 0;
    [...groups.values()]
      .filter((members) => members.length >= 2)
      .sort((a, b) => b.length - a.length)
      .forEach((members) => {
        if (completed >= globalLimit) return;
        const available = members
          .slice()
          .sort((a, b) => (a.socialInteractionAt || -Infinity) - (b.socialInteractionAt || -Infinity) || Math.random() - .5);
        while (available.length >= 2 && completed < globalLimit) {
          const a = available.shift();
          const candidates = available
            .map((person, index) => {
              const link = this.indexedRelationship(a, person);
              const repeatedRecently = link?.lastInteractionWeek === this.week && link?.lastInteractionDay === this.day;
              const score = (link?.trust || 0) * .22 + (link?.familiarity || 0) * .12 + Math.random() * 24 - (repeatedRecently ? 18 : 0);
              return { person, index, score };
            })
            .sort((x, y) => y.score - x.score)[0];
          if (!candidates) break;
          const [b] = available.splice(candidates.index, 1);
          const place = this.buildingIndex?.get(a.locationId) || this.buildings.find((building) => building.id === a.locationId);
          if (this.performSocialInteraction(a, b, place, { macro })) completed++;
        }
      });
    return completed;
  }
  consume(period) {
    const shoppers = this.people.filter(
      (p) =>
        p.alive &&
        !this.isPlayerControlled(p) &&
        !p.justice.incarcerated &&
        p.age >= 16 &&
        Math.random() < (period === "noite" ? 0.24 : 0.12),
    );
    shoppers.forEach((p) => {
      const wanted =
        period === "manhã"
          ? Math.random() > 0.55
            ? "café"
            : "alimentos"
          : period === "noite"
            ? Math.random() > 0.5
              ? "refeição"
              : "alimentos"
            : "refeição";
      const options = this.businesses.filter(
        (b) => b.products[wanted]?.stock > 0 && this.isOpen(b),
      );
      if (!options.length) return;
      const biz = pick(options),
        product = biz.products[wanted];
      product.stock--;
      biz.cash += product.price;
      biz.revenue += product.price;
      biz.sales++;
      p.money -= product.price;
      if (wanted === "refeição" || wanted === "café")
        p.happiness = clamp(p.happiness + 0.15, 0, 100);
    });
  }
  isOpen(business) {
    if (!business || business.closed || business.suspendedDays > 0 || !business.days.includes(this.day)) return false;
    return this.isScheduledOpen(business);
  }
  isScheduledOpen(business) {
    if(!business||business.closed||business.suspendedDays>0||!business.days.includes(this.day))return false;
    const h = this.minute / 60;
    const scheduled = business.open === 0 && business.close === 24 ? true : business.close < business.open
      ? h >= business.open || h < business.close
      : h >= business.open && h < business.close;
    return scheduled;
  }
  businessHours(business) {
    return business.open === 0 && business.close === 24
      ? "24 horas"
      : `${String(business.open).padStart(2, "0")}:00–${String(business.close).padStart(2, "0")}:00`;
  }
  weeklyBusinessLifecycle() {
    this.businesses.forEach((business) => {
      if (!business.closed && business.cash < -90000) business.distressWeeks = (business.distressWeeks || 0) + 1;
      else business.distressWeeks = 0;
      if (!business.closed && business.distressWeeks >= 8) {
        business.closed = true;
        business.closedWeek = this.week;
        business.employees.forEach((id) => {
          const p = this.people.find((x) => x.id === id);
          if (p?.alive) {
            p.role = "Desempregado";
      p.workplace = "—";
            p.shift = null;
          }
        });
        business.employees = [];
        this.log(
          "economia",
          `${business.name} encerrou as atividades por dificuldades financeiras.`,
          "money",
        );
      }
      if (business.closed && this.week - business.closedWeek >= 4 && Math.random() < 0.06) {
        const entrepreneur = this.people
          .filter((p) => p.alive && !this.isPlayerControlled(p) && p.age >= 23 && !p.justice.incarcerated)
          .sort((a, b) => b.money - a.money)[0];
        if (entrepreneur && entrepreneur.money > 12000) {
          entrepreneur.money -= 12000;
          business.ownerId = entrepreneur.id;
          business.cash = 16000;
          business.closed = false;
          business.distressWeeks = 0;
          this.log(
            "economia",
      `${entrepreneur.name} reabriu ${business.name} sob nova administração.`,
            "money",
          );
        }
      }
    });
    this.weeklyAssetMarket();
  }
  weeklyAssetMarket() {
    if(this.week%13===0){const candidates=this.businesses.filter(b=>!b.closed&&b.ownerId&&b.cash<9000);candidates.slice(0,2).forEach(b=>{const seller=this.people.find(p=>p.id===b.ownerId),buyer=this.people.filter(p=>p.alive&&!this.isPlayerControlled(p)&&p.age>=23&&!p.justice.incarcerated&&p.id!==seller?.id).sort((a,c)=>c.money-a.money)[0],building=this.buildings.find(x=>x.id===b.buildingId),price=Math.max(9000,Math.round((building?.value||60000)*.22+Math.max(0,b.cash)));if(!buyer||buyer.money<price)return;buyer.money-=price;if(seller?.alive)seller.money+=price;b.ownerId=buyer.id;b.cash+=price*.25;const tx={id:uid("business-sale"),week:this.week,businessId:b.id,sellerId:seller?.id||null,buyerId:buyer.id,price};this.urbanEvolution.businessTransactions.unshift(tx);buyer.history.push({week:this.week,text:`Adquiriu ${b.name} por R$ ${price.toLocaleString("pt-BR")}.`});seller?.history.push({week:this.week,text:`Vendeu ${b.name} para ${buyer.name}.`});this.log("economia",`${buyer.name} comprou ${b.name}${seller?` de ${seller.name}`:""} por R$ ${price.toLocaleString("pt-BR")}.`,"money");});}
    if(this.week%26===0){const business=this.businesses.filter(b=>!b.closed&&!b.frontBusiness).sort((a,b)=>{const da=this.buildings.find(x=>x.id===a.buildingId)?.districtId,db=this.buildings.find(x=>x.id===b.buildingId)?.districtId;return (this.urbanEvolution.districtMetrics[db]?.crimes||0)-(this.urbanEvolution.districtMetrics[da]?.crimes||0);})[0];if(business&&Math.random()<.42)this.relocateBusiness(business);}
  }
  relocateBusiness(business) {
    let lot=this.city.lots.find(l=>!l.occupied&&!l.reservedForDevelopment&&["urbanized","ready"].includes(l.status||"urbanized")&&l.zone==="mixed");if(!lot){this.expandCityGrid();lot=this.city.lots.find(l=>!l.occupied&&!l.reservedForDevelopment&&["urbanized","ready"].includes(l.status||"urbanized")&&l.zone==="mixed");}if(!lot)return;lot.occupied=true;const old=this.buildings.find(b=>b.id===business.buildingId),building={id:uid("b"),name:business.name,type:"shop",x:lot.x+.12,y:lot.y+.12,w:lot.w-.24,h:lot.h-.24,capacity:old?.capacity||35,occupied:0,value:(old?.value||90000)*1.08,districtId:lot.district,meter:emptyMeter()};building.address=addressFor(building,this.buildings.length,this.city);building.businessId=business.id;if(old)old.businessId=null;business.buildingId=building.id;this.buildings.push(building);this.urbanEvolution.relocations++;this.urbanEvolution.history.unshift({week:this.week,text:`${business.name} mudou-se para ${building.address.street}, ${building.address.number}.`});this.log("economia",`${business.name} transferiu sua sede para ${building.address.district}.`,"money");
  }
  chooseBusinessProduct(person, business) {
    const keys=Object.keys(business.products); if(!keys.length)return null;
    if(person.needs.hunger<58)return keys.find(k=>["refeição","alimentos","lanche","pão","petisco","café"].includes(k))||keys[0];
    if(business.sector.includes("automot")||business.sector.includes("Posto")){const vehicle=this.vehicleOf(person);if(vehicle&&vehicle.condition<65&&business.products.reparo)return"reparo";if(vehicle&&vehicle.fuel<vehicle.fuelCapacity*.45&&business.products.combustível)return"combustível";}
    if(business.sector.includes("Saúde")||business.sector.includes("Farmácia"))return keys.find(k=>["remédio","consulta","terapia"].includes(k))||keys[0];
    if(business.sector.includes("finance"))return"serviço";
    return pick(keys);
  }
  applyBusinessService(person,business,productName) {
    const vehicle=this.vehicleOf(person);let result="Atendimento concluído";
    if(["refeição","alimentos","lanche","pão","petisco"].includes(productName)){person.needs.hunger=clamp(person.needs.hunger+(["refeição","alimentos"].includes(productName)?35:20),0,100);result="Fome e conforto atendidos";}
    else if(productName==="café"){person.energy=clamp(person.energy+12,0,100);person.needs.hunger=clamp(person.needs.hunger+8,0,100);result="Energia recuperada";}
    else if(productName==="higiene"){person.needs.hygiene=clamp(person.needs.hygiene+22,0,100);result="Itens domésticos repostos";}
    else if(productName==="remédio"){const condition=person.medical.conditions.sort((a,b)=>b.severity-a.severity)[0];if(condition)condition.severity=clamp(condition.severity-7,0,100);person.health=clamp(person.health+3,0,100);result=condition?"Tratamento medicamentoso iniciado":"Medicamento preventivo adquirido";}
    else if(productName==="consulta"){person.health=clamp(person.health+5,0,100);person.medical.visits++;result="Avaliação clínica realizada";}
    else if(productName==="terapia"){person.happiness=clamp(person.happiness+6,0,100);person.medical.therapySessions++;result="Sessão terapêutica realizada";}
    else if(productName==="livro"){person.education.performance=clamp(person.education.performance+2,0,100);result="Conhecimento e desempenho ampliados";}
    else if(productName==="mensalidade"){person.health=clamp(person.health+2,0,100);person.energy=clamp(person.energy-4,0,100);result="Treino realizado";}
    else if(productName==="combustível"&&vehicle){vehicle.fuel=vehicle.fuelCapacity;result=`${vehicle.model} abastecido`;}
    else if(productName==="reparo"&&vehicle){vehicle.condition=clamp(vehicle.condition+28,0,100);vehicle.status="active";vehicle.maintenanceDue=false;result=`${vehicle.model} reparado`;}
    else if(productName==="peça"&&vehicle){vehicle.condition=clamp(vehicle.condition+10,0,100);result="Peça instalada no veículo";}
    else if(productName==="serviço"&&business.sector.includes("finance")){person.finance||={debt:0,credit:500};if(person.money<500&&person.finance.debt<3000){person.money+=1000;person.finance.debt+=1120;result="Microcrédito de R$ 1.000 liberado";}else{person.finance.debt=Math.max(0,person.finance.debt-120);result="Conta ou parcela financeira paga";}}
    else if(["ingresso","entrada"].includes(productName)){person.happiness=clamp(person.happiness+4,0,100);person.needs.social=clamp(person.needs.social+8,0,100);result="Participou da programação coletiva";}
    else if(productName==="bebida"){person.needs.social=clamp(person.needs.social+5,0,100);person.energy=clamp(person.energy-3,0,100);result="Consumiu bebida e socializou";}
    return result;
  }
  interactWithBusiness(person, business, requestedProduct = null) {
    if (!business || !this.isOpen(business)) return false;
    if (this.isPlayerControlled(person) && (person.currentTrip || person.locationId !== business.buildingId)) return false;
    if (business.adultOnly && person.age < 18) return false;
    business.visits++;
    if (!business.presentCustomers.includes(person.id))
      business.presentCustomers.push(person.id);
    if (business.interactions?.length) {
      const interaction=pick(business.interactions),companions=business.presentCustomers.filter(id=>id!==person.id).slice(-4);
      person.activity=interaction;person.needs.social=clamp(person.needs.social+4+companions.length*1.5,0,100);person.happiness=clamp(person.happiness+(business.nightlife?1.4:.7),0,100);
      business.collectiveInteractions ||= [];business.collectiveInteractions.unshift({week:this.week,day:this.day,time:this.time,interaction,hostId:person.id,participants:[person.id,...companions]});business.collectiveInteractions=business.collectiveInteractions.slice(0,20);
      companions.forEach(id=>{const other=this.people.find(p=>p.id===id),rel=relationBetween(this.relationships,person.id,id);if(rel){rel.affinity=clamp(rel.affinity+1.2,0,100);rel.interactions++;}if(other)other.needs.social=clamp(other.needs.social+2,0,100);});
      if(business.nightlife&&Math.random()<.035){person.energy=clamp(person.energy-8,0,100);person.medical.history.unshift({week:this.week,text:`Mal-estar após noite em ${business.name}.`});}
    }
    let wanted = requestedProduct && Object.prototype.hasOwnProperty.call(business.products || {}, requestedProduct) ? requestedProduct : this.chooseBusinessProduct(person,business);
    if (!wanted) return true;
    const product = business.products[wanted];
    if (!product || product.stock <= 0 || person.money < product.price)
      return true;
    product.stock--;
    person.money -= product.price;
    business.cash += product.price;
    business.revenue += product.price;
    business.sales++;
    const staffing=this.businessStaffing(business),worker=business.employees.map(id=>this.people.find(p=>p.id===id)).find(p=>p&&isWorking(p,this.day,this.minute/60)),campaignBonus=business.dynamicCampaign?.untilDay>=(this.week-1)*7+this.day?(business.dynamicCampaign.serviceBonus||0):0,wait = Math.max(
        2,
        Math.round(
          (business.presentCustomers.length /
            Math.max(1, staffing.onDuty)) *
            3,
        ),
      ),
      satisfaction = clamp(
          Math.round(business.serviceQuality + campaignBonus - wait + Math.random() * 20),
        0,
        100,
      );
    business.reputation = clamp(
      business.reputation + (satisfaction - 65) * 0.01,
      0,
      100,
    );
    const result=this.applyBusinessService(person,business,wanted);
    business.customerProfiles ||= {};
    const customerProfile = business.customerProfiles[person.id] ||= { visits: 0, spent: 0, satisfaction: 65, preferredProducts: {}, lastVisitWeek: this.week };
    customerProfile.visits++;
    customerProfile.spent += product.price;
    customerProfile.satisfaction = Math.round(customerProfile.satisfaction * .72 + satisfaction * .28);
    customerProfile.preferredProducts[wanted] = (customerProfile.preferredProducts[wanted] || 0) + 1;
    customerProfile.lastVisitWeek = this.week;
    person.commercePreferences ||= { favoriteBusinessIds: [], visits: {} };
    person.commercePreferences.visits[business.id] = (person.commercePreferences.visits[business.id] || 0) + 1;
    if (customerProfile.visits >= 4 && !person.commercePreferences.favoriteBusinessIds.includes(business.id)) person.commercePreferences.favoriteBusinessIds.unshift(business.id);
    person.commercePreferences.favoriteBusinessIds = person.commercePreferences.favoriteBusinessIds.slice(0, 6);
    business.transactions.unshift({
      personId: person.id,
      product: wanted,
      price: product.price,
      week: this.week,
      day: this.day,
      time: this.time,
      satisfaction,
      workerId:worker?.id||null,
      wait,
      result,
    });
    business.transactions = business.transactions.slice(0, 30);
    person.actionLog.unshift({
      week: this.week,
      day: this.day,
      time: this.time,
      activity: `Comprou ${wanted}`,
      place: business.name,
    });
    if (worker && worker.id !== person.id) {
      const existingServiceLink = this.indexedRelationship(person, worker);
      const relationshipWorthy = existingServiceLink || customerProfile.visits >= 3 || satisfaction >= 90 || satisfaction < 30;
      const serviceLink = relationshipWorthy ? this.ensureSocialRelationship(person, worker, { isCoworker: false, isNeighbor: false }) : null;
      if (serviceLink) {
        serviceLink.contextCounts.commerce = (serviceLink.contextCounts.commerce || 0) + 1;
        serviceLink.respect = clamp(serviceLink.respect + (satisfaction - 55) * .025, 0, 100);
        serviceLink.trust = clamp(serviceLink.trust + (satisfaction - 60) * .012, 0, 100);
        if (satisfaction < 38) serviceLink.tension = clamp(serviceLink.tension + 2.5, 0, 100);
        if (person.locationId === worker.locationId && Math.random() < .22) {
          const place = this.buildings.find((building) => building.id === business.buildingId);
          this.performSocialInteraction(person, worker, place, { macro: this.predictiveMode });
        }
      }
      this.queueCharacterEvent(worker, { kind:"trabalho", summary:`Atendeu ${person.name} em ${business.name}.`, valence:(satisfaction-50)/100, importance:24, stressImpact:satisfaction<40?2:-.3 });
    }
    return true;
  }
  createSupplyChain() {
    this.supplyChain = {
      suppliers: structuredClone(suppliers),
      orders: [],
      deliveries: [],
      delivered: 0,
      delayed: 0,
      spoiled: 0,
    };
    this.businesses.forEach((b) =>
      Object.entries(b.products).forEach(([name, p]) => {
        p.supplierId = supplierFor(name).id;
        p.shelfLife = productShelfLife[name] || 60;
      }),
    );
  }
  placeSupplyOrder(business, productName, product) {
    if (
      this.supplyChain.orders.some(
        (o) =>
          o.businessId === business.id &&
          o.product === productName &&
          !["delivered", "cancelled"].includes(o.status),
      )
    )
      return;
    const supplier = supplierFor(productName),
      quantity = Math.max(10, product.target - product.stock),
      cost = Math.round(quantity * product.price * supplier.markup);
    if (business.cash < cost) return;
    business.cash -= cost;
    const order = {
      id: uid("order"),
      businessId: business.id,
      supplierId: supplier.id,
      product: productName,
      quantity,
      cost,
      status: "ordered",
      placedWeek: this.week,
      placedDay: this.day,
      eta: 1 + Math.ceil(supplier.distance / 55),
      vehicleId: null,
    };
    this.supplyChain.orders.unshift(order);
    this.supplyChain.orders = this.supplyChain.orders.slice(0, 100);
  }
  dispatchOrder(order) {
    const supplier = this.supplyChain.suppliers.find(
        (s) => s.id === order.supplierId,
      ),
      business = this.businesses.find((b) => b.id === order.businessId),
      building = this.buildings.find((b) => b.id === business.buildingId);
    let truck=this.vehicles.find(v=>v.use==="delivery"&&v.ownerId===supplier.id&&v.status==="returned");
    if(!truck)truck = this.createVehicle(
        {
          model: "Caminhão de Entregas",
          type: "caminhão",
          price: 190000,
          seats: 2,
          efficiency: 6,
        },
        supplier.id,
        "delivery",
      );
    truck.x = 37;
    truck.y = 1;
    truck.status = "delivery";
    order.vehicleId = truck.id;
    order.status = "in_transit";
    const access = this.accessPoint(building);
    truck.path = [
      { x: 37, y: access.y },
      access,
      { x: building.x + building.w / 2, y: building.y + building.h / 2 },
    ];
    this.supplyChain.deliveries.push(order.id);
  }
  updateDeliveries(minutes = 10) {
    this.supplyChain.deliveries.slice().forEach((id) => {
      const order = this.supplyChain.orders.find((o) => o.id === id),
        truck = this.vehicles.find((v) => v.id === order.vehicleId),
        target = truck.path[0];
      if (!target) return this.deliverOrder(order);
      const dx = target.x - truck.x,
        dy = target.y - truck.y,
        d = Math.hypot(dx, dy),
        step = Math.min(d, 0.9 * (minutes / 10));
      if (d < 0.08) truck.path.shift();
      else {
        truck.x += (dx / d) * step;
        truck.y += (dy / d) * step;
      }
      if (!truck.path.length) this.deliverOrder(order);
    });
  }
  deliverOrder(order) {
    const supplier = this.supplyChain.suppliers.find(
      (s) => s.id === order.supplierId,
    );
    if (Math.random() > supplier.reliability && order.status !== "delayed") {
      order.status = "delayed";
      order.delayDays = 1 + Math.floor(Math.random() * 2);
      this.supplyChain.deliveries = this.supplyChain.deliveries.filter(
        (id) => id !== order.id,
      );
      const delayedTruck = this.vehicles.find((v) => v.id === order.vehicleId);
      if (delayedTruck) delayedTruck.status = "returned";
      this.supplyChain.delayed++;
      return;
    }
    const business = this.businesses.find((b) => b.id === order.businessId),
      product = business.products[order.product];
    product.stock += order.quantity;
    order.status = "delivered";
    order.deliveredWeek = this.week;
    this.supplyChain.deliveries = this.supplyChain.deliveries.filter(
      (id) => id !== order.id,
    );
    const truck = this.vehicles.find((v) => v.id === order.vehicleId);
    if (truck) truck.status = "returned";
    this.supplyChain.delivered++;
    this.log(
      "abastecimento",
      `${business.name} recebeu ${order.quantity} unidades de ${order.product}.`,
      "money",
    );
  }
  dailySupplyChain() {
    this.businesses.forEach((b) =>
      Object.entries(b.products).forEach(([name, p]) => {
        if (p.shelfLife < 100) {
          const spoiled = Math.floor((p.stock / p.shelfLife) * 0.07);
          p.stock = Math.max(0, p.stock - spoiled);
          this.supplyChain.spoiled += spoiled;
        }
        if (p.stock < p.target * 0.45) this.placeSupplyOrder(b, name, p);
      }),
    );
    this.supplyChain.orders
      .filter((o) => o.status === "ordered")
      .forEach((o) => {
        o.eta--;
        if (o.eta <= 0) this.dispatchOrder(o);
      });
    this.supplyChain.orders
      .filter((o) => o.status === "delayed")
      .forEach((o) => {
        o.delayDays--;
        if (o.delayDays <= 0) {
          o.status = "ordered";
          o.eta = 1;
        }
      });
  }
  get dayName() {
    return [
      "Segunda",
      "Terça",
      "Quarta",
      "Quinta",
      "Sexta",
      "Sábado",
      "Domingo",
    ][this.day];
  }
  get time() {
    return `${String(Math.floor(this.minute / 60)).padStart(2, "0")}:${String(this.minute % 60).padStart(2, "0")}`;
  }
  cityPulseText(hour) {
    const alive = this.people.filter((person) => person.alive), inTransit = alive.filter((person) => person.currentTrip);
    const presentAt = (buildingId) => alive.filter((person) => person.locationId === buildingId && !person.currentTrip);
    const activeEvent = this.events.active.find((event) => !event.suspended && (event.end > event.start ? hour >= event.start && hour < event.end : hour >= event.start || hour < event.end));
    if (activeEvent) {
      const attendee = this.people.find((person) => activeEvent.attendedIds?.includes(person.id));
      return `${activeEvent.name} movimenta ${activeEvent.location}${attendee ? `; ${attendee.name} está entre os participantes` : `, com ${activeEvent.participants?.length || 0} moradores convidados`}.`;
    }
    if (hour === 8) {
      const active = alive.filter((person) => !person.currentTrip && ["work", "study"].includes(person.activityCategory)), example = active[0] || inTransit[0], place = example && this.buildingIndex?.get(active.length ? example.locationId : example.currentTrip?.destinationId);
      return `A manhã ganhou ritmo com ${active.length} ${active.length === 1 ? "morador" : "moradores"} em trabalho ou estudo e ${inTransit.length} em deslocamento${example && place ? `; ${example.name} ${active.length ? "iniciou o dia em" : "segue para"} ${place.name}` : ""}.`;
    }
    if (hour === 12) {
      const foodProducts = new Set(["refeição", "alimentos", "lanche", "pão", "petisco", "café"]), busiest = this.businesses.filter((business) => this.isOpen(business) && Object.keys(business.products || {}).some((product) => foodProducts.has(product))).map((business) => ({ business, people: presentAt(business.buildingId) })).sort((a, b) => b.people.length - a.people.length)[0];
      const customer = busiest?.people[0];
      return busiest?.people.length ? `${busiest.business.name} concentra o movimento do almoço com ${busiest.people.length} cliente(s) presentes${customer ? `, incluindo ${customer.name}` : ""}.` : `${inTransit.length} moradores circulam pela cidade no horário do almoço.`;
    }
    if (hour === 18) {
      const passenger = inTransit[0], destination = passenger && this.buildingIndex?.get(passenger.currentTrip?.destinationId);
      return `O fim de tarde coloca ${inTransit.length} moradores em deslocamento${passenger ? `; ${passenger.name} segue para ${destination?.name || "seu próximo compromisso"}` : ""}.`;
    }
    const nightlife = this.businesses.filter((business) => business.nightlife && this.isOpen(business)).map((business) => ({ business, people: presentAt(business.buildingId) })).sort((a, b) => b.people.length - a.people.length)[0];
    const guest = nightlife?.people[0], atHome = alive.filter((person) => person.locationId === person.homeId && !person.currentTrip).length;
    return nightlife?.people.length ? `A noite segue ativa em ${nightlife.business.name}, com ${nightlife.people.length} frequentador(es)${guest ? `; ${guest.name} participa da programação` : ""}.` : `${atHome} moradores encerram o dia em casa, enquanto ${inTransit.length} ainda estão a caminho.`;
  }
  logCityPulse(hour) {
    this.log("pulso urbano", this.cityPulseText(hour), hour === 22 ? "night" : "social");
  }
  log(kind, text, tone = "neutral", details = {}) {
    const entry = {
      id: uid("l"),
      kind,
      text,
      tone,
      time: `Sem. ${this.week}, ${this.dayName} ${this.time}`,
      details: {
        peopleIds: [...new Set(Array.isArray(details.peopleIds) ? details.peopleIds : details.peopleIds ? [details.peopleIds] : [])],
        placeIds: [...new Set(Array.isArray(details.placeIds) ? details.placeIds : details.placeIds ? [details.placeIds] : [])],
        cause: details.cause || null,
        consequences: (Array.isArray(details.consequences) ? details.consequences : details.consequences ? [details.consequences] : []).filter(Boolean),
        facts: (Array.isArray(details.facts) ? details.facts : details.facts ? [details.facts] : []).filter(Boolean),
        section: details.section || null,
        dedupeKey: details.dedupeKey || null,
        priority: details.priority || "normal",
        headline: details.headline || null,
      },
    };
    this.logs.unshift(entry);
    this.logs = this.logs.slice(0, 70);
    if (this.cityDynamics) this.cityDynamics.logsToday++;
    this.considerNews(entry);
  }
  considerNews(entry) {
    if (!this.newsroom) return;
    const normalized=entry.kind.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(),sectionMap={"politica":"Política","prefeitura":"Política","eleicao":"Política","lei municipal":"Política","ocorrencia":"Segurança","investigacao":"Segurança","operacao policial":"Segurança","justica":"Justiça","julgamento":"Justiça","condenacao":"Justiça","absolvicao":"Justiça","medicina legal":"Saúde","falecimento":"Sociedade","sepultamento":"Sociedade","nascimento":"Sociedade","casamento":"Sociedade","noivado":"Sociedade","relacionamento":"Sociedade","aniversario":"Sociedade","destaque":"Sociedade","protecao social":"Sociedade","economia":"Economia","negocios":"Economia","mercado imobiliario":"Habitação","moradia":"Habitação","expansao urbana":"Cidade","loteamento":"Cidade","obras":"Cidade","cidade":"Cidade","transporte":"Mobilidade","veiculos":"Mobilidade","taxi":"Mobilidade","emprego":"Trabalho","desemprego":"Trabalho","aposentadoria":"Trabalho","formatura":"Sociedade","educacao":"Sociedade","funeraria":"Saúde","migracao":"Cidade","cultura":"Cultura","evento":"Cultura","emergencia":"Saúde","alta":"Saúde","saude":"Saúde","clima":"Meio Ambiente","ambiente":"Meio Ambiente"},section=entry.details?.section||sectionMap[normalized];
    if(!section)return;
    const explicitPeople=(entry.details?.peopleIds||[]).map(id=>this.people.find(person=>person.id===id)).filter(Boolean),exactPeople=this.people.filter(p=>entry.text.includes(p.name)),people=[...new Map([...explicitPeople,...exactPeople].map(person=>[person.id,person])).values()].slice(0,8),explicitPlaces=(entry.details?.placeIds||[]).map(id=>this.buildings.find(place=>place.id===id)).filter(Boolean),places=[...new Map([...explicitPlaces,...this.buildings.filter(b=>entry.text.includes(b.name))].map(place=>[place.id,place])).values()].slice(0,5),mandatory=["falecimento","politica"].includes(normalized)||["urgente","destaque"].includes(entry.details?.priority),urgent=["falecimento","ocorrencia","operacao policial","medicina legal"].includes(normalized)||entry.details?.priority==="urgente",systemic=["politica","prefeitura","transporte","expansao urbana","obras","clima","emprego","mercado imobiliario"].includes(normalized),causal=Boolean(entry.details?.cause||entry.details?.consequences?.length),score=2+(people.length?2:0)+(places.length?1:0)+(urgent?2:0)+(systemic?2:0)+(causal?1:0);
    if(score<3)return;
    const subject=entry.details?.dedupeKey||people[0]?.id||places[0]?.id||normalized,related=this.newsroom.articles.find(a=>a.subject===subject&&a.section===section&&this.week-a.week<=4);
    if(related&&related.kind!==normalized){related.updates.unshift({time:entry.time,text:entry.text});related.updatedAt=entry.time;related.body=this.composeNewsBody(entry,section,people,places,true);this.newsroom.updated++;return;}
    const weekCount=this.newsroom.publishedByWeek[this.week]||0,sectionKey=`${this.week}:${section}`,sectionCount=this.newsroom.publishedBySectionWeek[sectionKey]||0,sectionLimit=["Segurança","Política","Cidade"].includes(section)?3:section==="Cultura"?1:2;if(weekCount>=14&&normalized!=="falecimento")return;if(!mandatory&&(weekCount>=12||sectionCount>=sectionLimit))return;
    const duplicate=this.newsroom.articles.some(a=>a.kind===normalized&&a.subject===subject&&this.week-a.week<2);if(duplicate)return;
    const headline=entry.details?.headline||this.newsHeadline(entry,section,people,places),reporters={"Política":"Redação de Política","Segurança":"Núcleo de Segurança","Justiça":"Núcleo de Justiça","Economia":"Mesa de Economia","Trabalho":"Redação de Trabalho","Habitação":"Observatório Imobiliário","Sociedade":"Redação de Sociedade","Saúde":"Núcleo de Saúde","Mobilidade":"Cidade em Movimento","Meio Ambiente":"Observatório do Clima","Cidade":"Redação Local","Cultura":"Agenda Cultural"},article={id:uid("news"),kind:normalized,section,headline,lead:entry.text,body:this.composeNewsBody(entry,section,people,places,false),peopleIds:people.map(p=>p.id),placeIds:places.map(b=>b.id),subject,week:this.week,day:this.day,publishedAt:entry.time,updatedAt:null,priority:urgent?"urgente":entry.details?.priority==="destaque"||score>=5?"destaque":"normal",reporter:reporters[section]||"Redação Cidade Viva",dateline:`Vila Esperança · ${this.dayName}, ${entry.time}`,impactScore:score,cause:entry.details?.cause,consequences:entry.details?.consequences||[],facts:entry.details?.facts||[],updates:[]};
    this.newsroom.articles.unshift(article);this.newsroom.articles=this.newsroom.articles.slice(0,320);this.newsroom.publishedByWeek[this.week]=weekCount+1;this.newsroom.publishedBySectionWeek[sectionKey]=sectionCount+1;
  }
  newsHeadline(entry,section,people,places) {
    const name=people[0]?.name,place=places[0]?.name,kind=entry.kind.toLowerCase();
    if(kind.includes("falecimento"))return `Cidade se despede de ${name||"morador"}`;
    if(kind.includes("casamento"))return `${people.slice(0,2).map(p=>p.firstName).join(" e ")} celebram nova família`;
    if(kind.includes("nascimento"))return `${name||"Novo morador"} marca nova geração de Vila Esperança`;
    if(kind.includes("operação"))return `Operação policial altera rotina em ${place||"Vila Esperança"}`;
    if(kind.includes("ocorrência"))return `Polícia apura ocorrência envolvendo ${name||"moradores"}`;
    if(kind.includes("investigação"))return `Polícia abre inquérito${name?` envolvendo ${name}`:" para apurar nova ocorrência"}`;
    if(kind.includes("perícia"))return `Perícia atualiza caso${name?` envolvendo ${name}`:" em investigação"}`;
    if(kind.includes("expansão"))return `${place||"Novo bairro"} redesenha o mapa da cidade`;
    if(kind.includes("obras"))return `Prefeitura acompanha nova etapa de obra urbana`;
    if(kind.includes("clima"))return `${entry.text.includes("Alerta")?"Alerta meteorológico":"Tempo muda"} e afeta a rotina da cidade`;
    if(kind.includes("emprego"))return `Mercado de trabalho registra nova movimentação`;
    if(kind.includes("imobili"))return `Oferta e demanda alteram o mercado de moradia`;
    if(kind.includes("destaque"))return `${name||"Morador"} ganha projeção em Vila Esperança`;
    return `${section}: ${entry.text.replace(/\.$/,"")}`;
  }
  composeNewsBody(entry,section,people,places,isUpdate) {
    const population=this.people.filter(p=>p.alive).length,openCases=this.justiceSystem?.openCases?.filter(c=>!["condenado","absolvido","arquivado"].includes(c.status)).length||0,context={"Política":`A Prefeitura tem aprovação de ${Math.round(this.governance.approval)}% e ${this.localGovernmentSummary?.legislation?.inForceLaws||0} lei(s) local(is) em vigor.`,"Segurança":`A Delegacia acompanha ${this.investigationSummary?.totals?.active??openCases} investigação(ões) ativa(s), com ${this.justiceSystem?.patrols||0} patrulha(s).`,"Justiça":`${this.justiceSystem?.courtQueue?.filter(item=>!["condenado","absolvido"].includes(item.status)).length||0} processo(s) aguardam decisão judicial.`,"Economia":`${this.businesses.length} estabelecimentos conectam trabalho, fornecedores, consumo e arrecadação.`,"Trabalho":`O desemprego está em ${this.laborMarketSummary?.unemploymentRate||0}% e há ${this.laborMarketSummary?.vacancies||0} vaga(s) formalmente mapeada(s).`,"Habitação":`O mercado reúne ${this.realEstateSummary?.totalUnits||0} unidade(s), ${this.realEstateSummary?.vacantUnits||0} vaga(s) e ${this.realEstateSummary?.development?.unitsInPipeline||0} em produção.`,"Sociedade":`O registro integra a trajetória das famílias e redes sociais de uma população de ${population} moradores.`,"Saúde":`A rede pública acompanha ${this.healthSystem?.clinicalCases?.filter(c=>!["encerrado","óbito"].includes(c.status)).length||0} caso(s) clínico(s) ativo(s).`,"Mobilidade":`${this.transportSystem?.dailyRiders||0} passageiro(s) utilizaram a rede hoje; clima, vias e trânsito alteram o tempo de viagem.`,"Meio Ambiente":`O risco de alagamento está em ${Math.round(this.environment?.floodRisk||0)} e o índice de seca em ${Math.round(this.environment?.droughtIndex||0)}.`,"Cidade":`Vila Esperança possui ${this.buildings.length} edificações, ${this.city.districts.length} bairros e ${this.localGovernmentSummary?.publicWorks?.active||0} obra(s) municipal(is) ativa(s).`,"Cultura":`A programação coletiva conecta estabelecimentos, famílias e espaços públicos.`}[section]||`O fato integra os sistemas conectados da cidade.`;
    const named=people.length?`Pessoas citadas nos registros: ${people.map(p=>p.name).join(", ")}.`:"Não há outros moradores nominalmente citados no registro público.",located=places.length?` Locais relacionados: ${places.map(p=>p.name).join(", ")}.`:"";
    const sentence=(value)=>{const clean=String(value||"").trim();return !clean||/[.!?]$/.test(clean)?clean:`${clean}.`;};
    const cause=entry.details?.cause?`Causa registrada: ${sentence(entry.details.cause)}`:`A origem exata permanece limitada aos fatos confirmados no sistema.`,consequences=entry.details?.consequences?.length?`Consequências confirmadas: ${sentence(entry.details.consequences.map(item=>String(item).replace(/[.!?]+$/,"" )).join("; "))}`:`Ainda não há consequência adicional confirmada.`,facts=entry.details?.facts?.length?` Dados verificados: ${entry.details.facts.map(sentence).join(" ")}`:"";
    return `${isUpdate?"Em atualização, ":"Segundo os registros municipais, "}${entry.text} ${named}${located}\n\n${cause} ${consequences}${facts}\n\n${context} A matéria só será atualizada quando a simulação registrar uma mudança concreta.`;
  }
  resolveRoutinePlace(p, place) {
    if (place === "home") return this.buildingIndex?.get(p.homeId) || this.buildings.find((b) => b.id === p.homeId);
    if (place === "park") {
      const parks = this.buildingsByType?.get("park") || this.buildings.filter((b) => b.type === "park");
      return parks[Number(p.id.replace(/\D/g, "")) % Math.max(1, parks.length)];
    }
    if (place === "social") {
      const planned = this.buildingIndex?.get(p.socialIntent?.placeId);
      if (planned) return planned;
      const favorite = (p.commercePreferences?.favoriteBusinessIds || [])
        .map((id) => this.businessIndex?.get(id))
        .find((business) => business && !business.closed && this.isOpen(business));
      if (favorite) return this.buildingIndex?.get(favorite.buildingId);
      const socialBusinesses = this.businesses.filter((business) => !business.closed && this.isOpen(business) && (business.nightlife || ["Cafeteria", "Restaurante", "Clube social", "Casa de shows"].includes(business.sector)));
      const selected = socialBusinesses[Number(p.id.replace(/\D/g, "")) % Math.max(1, socialBusinesses.length)];
      return this.buildingIndex?.get(selected?.buildingId) || this.buildingsByType?.get("park")?.[0];
    }
    if (place === "shop") {
      const shops = this.buildingsByType?.get("shop") || this.buildings.filter((b) => b.type === "shop");
      return shops[Number(p.id.replace(/\D/g, "")) % Math.max(1, shops.length)];
    }
    if (place === "Centro")
      return this.buildingNameIndex?.get("Praça das Acácias") || this.buildings.find((b) => b.name === "Praça das Acácias");
    return (
      this.buildingNameIndex?.get(place) ||
      this.buildingsByType?.get("civic")?.[0]
    );
  }
  accessPoint(building) {
    const street = this.streetIndex?.get(building.address?.streetId) || this.city.streets.find((s) => s.id === building.address?.streetId);
    const cx = building.x + building.w / 2,
      cy = building.y + building.h / 2;
    return street?.axis === "v"
      ? { x: street.at, y: cy }
      : { x: cx, y: street?.at ?? cy };
  }
  routeTo(p, building, options = {}) {
    this.clearSocialContext(p);
    const previous = this.buildingIndex?.get(p.locationId),
      previousBusiness = this.businessByBuildingId?.get(previous?.id);
    if (previousBusiness)
      previousBusiness.presentCustomers =
        previousBusiness.presentCustomers.filter((id) => id !== p.id);
    const startBuilding =
        previous || this.buildingIndex?.get(p.homeId),
      a = this.accessPoint(startBuilding),
      z = this.accessPoint(building),
      sa = this.streetIndex?.get(startBuilding.address?.streetId),
      sz = this.streetIndex?.get(building.address?.streetId),
      path = [];
    if (Math.hypot(p.x - a.x, p.y - a.y) > 0.15) path.push(a);
    if (sa && sz && sa.axis !== sz.axis)
      path.push(
        sa.axis === "v" ? { x: sa.at, y: sz.at } : { x: sz.at, y: sa.at },
      );
    else if (sa?.axis === "v") path.push({ x: sa.at, y: z.y });
    else path.push({ x: z.x, y: sa?.at ?? z.y });
    path.push(z, {
      x: building.x + building.w / 2,
      y: building.y + building.h / 2,
    });
    p.path = path;
    p.target = p.path.shift();
    p.destinationId = building.id;
    this.chooseTransport(p, {
      x: building.x + building.w / 2,
      y: building.y + building.h / 2,
      buildingId: building.id,
      name: building.name,
    }, options);
    if(p.actionLog[0]&&p.actionLog[0].week===this.week&&p.actionLog[0].time===this.time){p.actionLog[0].activity=this.personStatus(p);p.actionLog[0].place=this.buildingIndex?.get(p.locationId)?.name||"Em trânsito";}
  }
  completeArrival(p) {
    const trip=p.currentTrip,destination=this.buildingIndex?.get(trip?.destinationId||p.destinationId),playerTravel=this.isPlayerControlled(p)?p.playerControl?.travelCommand:null;if(!destination)return;
    if(trip?.taxiRideId&&this.taxiSystem){const finished=finishTaxiRide(this.taxiSystem,trip.taxiRideId,{week:this.week,day:this.day,minute:this.minute});this.taxiSystem=finished.state;if(finished.ok){p.money-=finished.ride.fare;const driver=this.people.find(person=>person.id===finished.ride.driverId);if(driver)driver.money+=finished.ride.fare*.65;const taxi=this.vehicles.find(vehicle=>vehicle.id===finished.ride.vehicleId);if(taxi){taxi.status="active";taxi.x=destination.x+destination.w/2;taxi.y=destination.y+destination.h/2;taxi.mileage+=finished.ride.distance;taxi.fuel=Math.max(0,taxi.fuel-finished.ride.distance/Math.max(1,taxi.efficiency));}p.mobility.taxiTrips=(p.mobility.taxiTrips||0)+1;}this.taxiSummary=summarizeTaxiSystem(this.taxiSystem);}
    if(trip&&this.cityDynamics)this.cityDynamics.tripsCompletedToday++;
    p.x=destination.x+destination.w/2;p.y=destination.y+destination.h/2;p.locationId=destination.id;p.destinationId=null;p.target=null;p.path=[];p.currentTrip=null;p.destinationRecheckAt=null;p.activity=trip?.plannedActivity||p.activity;
    if(this.isPlayerControlled(p)){p.activity=`Em ${destination.name} · aguardando sua decisão`;p.activityCategory="leisure";p.playerControl.travelCommand=null;if(playerTravel)this.setPlayerCommandResult(p,playerTravel.commandId,true,`Você chegou a ${destination.name}.`,{buildingId:destination.id,mode:trip?.mode});}
    const arrivedBusiness=this.businessByBuildingId?.get(p.locationId);if(arrivedBusiness&&!this.isPlayerControlled(p))this.interactWithBusiness(p,arrivedBusiness);
    if(p.eventId){const event=this.events.active.find(e=>e.id===p.eventId);if(event){event.attendedIds||=[];const firstVisit=!event.attendedIds.includes(p.id);if(firstVisit){event.attendedIds.push(p.id);event.attendance++;this.events.attendance++;if(event.effect==="health_outreach"){const condition=p.medical.conditions.slice().sort((a,b)=>b.severity-a.severity)[0];if(condition)condition.severity=clamp(condition.severity-2,0,100);p.health=clamp(p.health+3,0,100);p.medical.visits++;p.medical.history.unshift({week:this.week,text:`Participou de triagem em ${event.location}.`});}if(event.effect==="housing_guidance"){const family=this.families.find(item=>item.memberIds?.includes(p.id));if(family)family.housingGuidance={week:this.week,day:this.day,status:"orientação realizada",eventId:event.id};}if(event.effect==="urban_care")p.happiness=clamp(p.happiness+1,0,100);if(event.effect==="civic_participation")this.governance.approval=clamp(this.governance.approval+.03,0,100);}p.happiness=clamp(p.happiness+2,0,100);}}
  }
  routineBlockFor(person) {
    const cached = person.routineBlockCache;
    if (cached?.routine === person.routine && cached.day === this.day && this.minute >= cached.block.start && this.minute < cached.block.end) return cached.block;
    const block = currentBlock(person, this.day, this.minute);
    person.routineBlockCache = { routine: person.routine, day: this.day, block };
    return block;
  }
  chooseDestination(p) {
    if (!p.alive) return;
    p.needsDestinationDecision = false;
    const routineDecision = this.routineBlockFor(p);
    const decisionEvent = this.activeEventFor(p);
    const decisionKey = [
      this.week,
      this.day,
      Math.floor(this.minute / 60),
      routineDecision.start,
      routineDecision.activity,
      decisionEvent?.id || "",
      p.locationId,
      Number(Boolean(p.justice.incarcerated)),
      Number(Boolean(p.medical.admitted)),
      Number(p.medical.sickLeave > 0),
      Number((p.bereavement?.leaveDays || 0) > 0),
      p.bereavement?.visitToday || "",
      p.socialIntent?.id || "",
      p.needOverride || "",
      Number(p.needs.hunger < 10),
      Number(p.needs.hunger >= 70),
      Number(p.needs.hygiene < 12),
      Number(p.needs.hygiene >= 70),
      Number(p.needs.social < 10),
      Number(p.needs.social >= 65),
      Number(Boolean(this.environment.current.rain)),
    ].join("|");
    if (!p.currentTrip && p.destinationDecisionKey === decisionKey && (p.target || p.locationId)) return;
    p.destinationDecisionKey = decisionKey;
    if (p.justice.incarcerated) {
      const prison = this.buildingNameIndex?.get("Presídio Municipal");
      if(p.locationId!==prison.id)this.placePersonAt(p,prison.id);else p.target=null;
      p.activity = "Cumprindo pena";
      return;
    }
    if (p.medical.admitted) {
      const h = this.buildingNameIndex?.get("Hospital São Lucas");
      if(p.locationId!==h.id)this.placePersonAt(p,h.id);else p.target=null;
      p.activity = "Internado";
      return;
    }
    if (p.bereavement?.visitToday) {
      const cemetery = this.buildingNameIndex?.get("Cemitério da Paz");
      if (cemetery) {
        p.activity="Visitando o cemitério";p.activityCategory="social";
        if(p.locationId!==cemetery.id&&p.currentTrip?.destinationId!==cemetery.id)this.routeTo(p,cemetery);
        return;
      }
    }
    let scheduled =
      p.bereavement?.leaveDays > 0
        ? { start: 0, activity: `Em licença por luto (${p.bereavement.leaveDays} dias)`, place: "home", category: "rest" }
        : p.medical.sickLeave > 0
        ? {
            start: 0,
          activity: `Em licença médica (${p.medical.sickLeave} dias)`,
            place: "home",
            category: "rest",
          }
        : routineDecision;
    if (p.needOverride === "meal" && p.needs.hunger >= 70)
      p.needOverride = null;
    if (p.needOverride === "hygiene" && p.needs.hygiene >= 70)
      p.needOverride = null;
    if (p.needOverride === "social" && p.needs.social >= 65)
      p.needOverride = null;
    if (!p.needOverride && scheduled.category !== "work") {
      if (p.needs.hunger < 10) p.needOverride = "meal";
      else if (p.needs.hygiene < 12 && scheduled.category === "leisure")
        p.needOverride = "hygiene";
      else if (p.needs.social < 10 && this.minute > 1020)
        p.needOverride = "social";
    }
    if (p.needOverride === "meal")
      scheduled = {
        ...scheduled,
        activity: "Fazendo uma refeição",
        place: "shop",
        category: "meal",
      };
    if (p.needOverride === "hygiene")
      scheduled = {
        ...scheduled,
        activity: "Cuidando da higiene",
        place: "home",
        category: "rest",
      };
    if (p.needOverride === "social")
      scheduled = {
        ...scheduled,
        activity: "Buscando companhia",
        place: "social",
        category: "social",
      };
    const socialIntent = p.socialIntent, socialCounterpart = this.personIndex?.get(socialIntent?.counterpartId), socialMeetingPlace = this.buildingIndex?.get(socialIntent?.placeId);
    if (socialIntent && socialCounterpart?.alive && socialMeetingPlace && this.minute >= 1020 && this.minute <= 1320 && ["rest", "leisure", "social", "meal"].includes(scheduled.category)) {
      scheduled = {
        ...scheduled,
        start: 17 * 60,
        end: 23 * 60,
        activity: `Encontrando ${socialCounterpart.firstName} para ${socialIntent.reason}`,
        place: socialMeetingPlace.name,
        category: "social",
        socialIntentId: socialIntent.id,
        supportIntent: /apoio/.test(socialIntent.reason),
      };
    }
    const cityEvent = decisionEvent;
    if (cityEvent)
      scheduled = {
        ...scheduled,
        start: cityEvent.start * 60,
        end: cityEvent.end * 60,
        activity: `Participando: ${cityEvent.name}`,
        place: cityEvent.location,
        category: "social",
        eventId: cityEvent.id,
      };
    const key = `${this.day}-${scheduled.start}-${scheduled.activity}`;
    let destination = this.resolveRoutinePlace(p, scheduled.place);
    if (
      this.environment.current.rain &&
      scheduled.place === "park" &&
      scheduled.category !== "work"
    ) {
      destination = this.buildingIndex?.get(p.homeId);
      scheduled = {
        ...scheduled,
        activity: "Lazer em casa por causa da chuva",
        place: "home",
      };
    }
    const destinationBusiness = this.businessByBuildingId?.get(destination.id);
    if (
      destinationBusiness &&
      !this.isOpen(destinationBusiness) &&
      !["work", "study"].includes(scheduled.category)
    ) {
      destination = this.buildingIndex?.get(p.homeId);
      scheduled = {
        ...scheduled,
        activity: `${destinationBusiness.name} estava fechado`,
        place: "home",
        category: "leisure",
      };
    }
    p.activity = scheduled.activity;
    p.activityCategory = scheduled.category;
    p.eventId = scheduled.eventId || null;
    const now=this.absoluteMinute(),priority=this.actionPriorityFor(p,scheduled,destination),deadline=scheduled.end??Math.min(1440,this.minute+120);p.actionPriority=priority;p.actionDeadlineAt=((this.week-1)*7+this.day)*1440+deadline;
    if(p.currentTrip){const trip=p.currentTrip,sameDestination=trip.destinationId===destination.id,expired=now>(trip.deadlineAt||trip.startedAt+180),superseded=priority>(trip.priority||0)+8;if(sameDestination&&!expired){trip.plannedActivity=scheduled.activity;trip.priority=Math.max(trip.priority||0,priority);trip.deadlineAt=Math.max(trip.deadlineAt||0,p.actionDeadlineAt);p.scheduleKey=key;return;}if(!expired&&!superseded){p.destinationRecheckAt=Math.min(trip.deadlineAt||now+60,now+60);return;}this.abandonTrip(p,expired?"o compromisso perdeu a validade":"uma necessidade mais importante surgiu");}
    if (p.scheduleKey === key && (p.target || p.locationId === destination.id))
      return;
    p.scheduleKey = key;
    p.actionLog.unshift({
      week: this.week,
      day: this.day,
      time: this.time,
      activity: scheduled.activity,
      place: destination.name,
    });
    p.actionLog = p.actionLog.slice(0, 20);
    if (p.locationId === destination.id && !p.target) return;
    this.routeTo(p, destination);
  }
  shouldReevaluateDestination(person, hourChanged = false) {
    if (!person?.alive) return false;
    const institutionalKey = `${Number(Boolean(person.justice.incarcerated))}:${Number(Boolean(person.medical.admitted))}`;
    const institutionalChanged = person.destinationInstitutionalKey !== institutionalKey;
    person.destinationInstitutionalKey = institutionalKey;
    if (institutionalChanged || person.needsDestinationDecision || !person.scheduleKey) return true;
    const routine = this.routineBlockFor(person);
    let expectedStart = person.bereavement?.leaveDays > 0 || person.medical.sickLeave > 0 ? 0 : routine.start;
    if (person.socialIntent && this.minute >= 1020 && this.minute <= 1320 && person.scheduleKey.includes("-1020-Encontrando ")) expectedStart = 1020;
    const event = person.eventId && (this.activeEventById?.get(person.eventId) || this.events.active.find((candidate) => candidate.id === person.eventId));
    if (event && this.activeEventFor(person)?.id === event.id) expectedStart = event.start * 60;
    const routineChanged = !person.scheduleKey.startsWith(`${this.day}-${expectedStart}-`);
    const deadlineDue = person.currentTrip && this.absoluteMinute() > (person.currentTrip.deadlineAt || person.currentTrip.startedAt + 180);
    const eventBoundary = hourChanged && (Boolean(this.activeEventByPerson?.get(person.id)) || Boolean(person.eventId && !event));
    const socialBoundary = Boolean(person.socialIntent) && (this.minute === 17 * 60 || this.minute === 22 * 60);
    if (routineChanged && person.currentTrip && this.absoluteMinute() < (person.destinationRecheckAt || 0) && !eventBoundary && !socialBoundary) return false;
    return routineChanged || deadlineDue || eventBoundary || socialBoundary;
  }
  updateNeeds(p, minutes) {
    const previousNeeds = { hunger: p.needs.hunger, social: p.needs.social, hygiene: p.needs.hygiene };
    const rate = minutes / 60,
      acting = !p.target,
      socialCompany = acting && p.locationId && (this.spatialSystem?.occupancy?.[p.locationId]?.present || 0) > 1;
    p.needs.hunger = clamp(p.needs.hunger - rate * 3.2, 0, 100);
    p.needs.social = clamp(p.needs.social - rate * 1.25, 0, 100);
    p.needs.hygiene = clamp(p.needs.hygiene - rate * 0.8, 0, 100);
    p.needs.comfort = clamp(p.needs.comfort - rate * 0.6, 0, 100);
    if (acting && p.activityCategory === "meal")
      p.needs.hunger = clamp(p.needs.hunger + rate * 28, 0, 100);
    if (acting && socialCompany && p.activityCategory === "social")
      p.needs.social = clamp(p.needs.social + rate * 16, 0, 100);
    if (acting && ["rest", "leisure"].includes(p.activityCategory)) {
      p.energy = clamp(p.energy + rate * 7, 0, 100);
      p.needs.comfort = clamp(p.needs.comfort + rate * 8, 0, 100);
    } else p.energy = clamp(p.energy - rate * 2.5, 0, 100);
    if (acting && p.locationId === p.homeId && p.activityCategory === "rest")
      p.needs.hygiene = clamp(p.needs.hygiene + rate * 12, 0, 100);
    const low = Object.values(p.needs).filter((v) => v < 20).length;
    if (low) p.happiness = clamp(p.happiness - rate * low * 0.7, 0, 100);
    if (
      (previousNeeds.hunger < 10) !== (p.needs.hunger < 10) ||
      (previousNeeds.hunger >= 70) !== (p.needs.hunger >= 70) ||
      (previousNeeds.hygiene < 12) !== (p.needs.hygiene < 12) ||
      (previousNeeds.hygiene >= 70) !== (p.needs.hygiene >= 70) ||
      (previousNeeds.social < 10) !== (p.needs.social < 10) ||
      (previousNeeds.social >= 65) !== (p.needs.social >= 65)
    ) p.needsDestinationDecision = true;
  }
  tick(minutes = 10) {
    const previousHour = Math.floor(this.minute / 60);
    this.minute += minutes;
    if (this.minute >= 1440) {
      this.minute -= 1440;
      this.day++;
      this.maintainWorkforce();
      this.dailyHealth();
      this.dailyForensics();
      this.dailyFunerals();
      this.dailyBereavement();
      this.dailyProbate();
      this.dailyJustice();
      this.dailyVehicleCrime();
      this.dailyInfrastructure();
      this.dailySupplyChain();
      this.dailyEnvironment();
      this.dailyLifeStages();
      this.dailyEvents();
      this.dailyFamilyLife();
      this.queueDailyCharacterLife();
      this.transportSystem.dailyRiders = 0;
      if (this.day > 6) {
        this.day = 0;
        this.week++;
        this.weeklyEconomy({ deferCharacter: true });
      }
      this.dailyCityDynamics();
    }
    const hour = Math.floor(this.minute / 60);
    if (hour !== previousHour) {
      if (hour === 12 || hour === 18) this.updateEnvironmentalMetrics();
    }
    this.updateTransit(minutes);
    if (hour !== previousHour) this.activeEventFor({ id: "__refresh__" });
    this.people
      .filter((p) => p.alive)
      .forEach((p) => {
        if (!this.isPlayerControlled(p) && this.shouldReevaluateDestination(p, hour !== previousHour)) this.chooseDestination(p);
        if(p.currentTrip)p.currentTrip.elapsedMinutes=(p.currentTrip.elapsedMinutes||0)+minutes;
        if(p.currentTrip&&(p.currentTrip.elapsedMinutes||0)>p.currentTrip.maxTripMinutes){if(p.currentTrip.mode==="ônibus")this.fallbackFromTransit(p,"trajeto excedeu o tempo previsto");else {const destination=this.buildings.find(b=>b.id===p.currentTrip.destinationId);if(destination){p.activity=`Chegando com atraso a ${destination.name}`;this.completeArrival(p);}else this.abandonTrip(p,"destino indisponível");}}
        if(p.currentTrip?.mode==="táxi"&&p.currentTrip.phase==="waiting_taxi"){
          const trip=p.currentTrip,taxi=this.vehicles.find(vehicle=>vehicle.id===trip.vehicleId&&["dispatching","active"].includes(vehicle.status));trip.waitRemaining-=minutes;trip.waitedMinutes=(trip.waitedMinutes||0)+minutes;
          if(!taxi||trip.waitedMinutes>trip.maxWait){if(trip.taxiRideId){const cancelled=cancelTaxiRide(this.taxiSystem,trip.taxiRideId,!taxi?"veículo indisponível":"espera excedida");this.taxiSystem=cancelled.state;if(taxi)taxi.status="active";}trip.taxiRideId=null;this.fallbackFromTransit(p,!taxi?"táxi indisponível":"espera do táxi acima do limite");this.taxiSummary=summarizeTaxiSystem(this.taxiSystem);}
          else {const dx=p.x-taxi.x,dy=p.y-taxi.y,distance=Math.hypot(dx,dy),step=Math.min(distance,32*(minutes/10)*this.environment.current.mobilityFactor);if(distance>.08){taxi.x+=dx/distance*step;taxi.y+=dy/distance*step;}if(distance<.35){const boarded=boardTaxiRide(this.taxiSystem,trip.taxiRideId);this.taxiSystem=boarded.state;taxi.status="taxi_service";trip.phase="onboard";p.x=taxi.x;p.y=taxi.y;const destination=this.buildings.find(building=>building.id===trip.destinationId);p.target=destination?{x:destination.x+destination.w/2,y:destination.y+destination.h/2}:null;p.path=[];this.taxiSummary=summarizeTaxiSystem(this.taxiSystem);}}
          p.activity=this.personStatus(p);this.updateNeeds(p,minutes);return;
        }
        if(p.currentTrip?.mode==="ônibus"){
          const trip=p.currentTrip;if(trip.phase==="waiting"){trip.waitRemaining-=minutes;trip.waitedMinutes=(trip.waitedMinutes||0)+minutes;const route=this.transportSystem.routes.find(r=>r.id===trip.routeId),serviceHour=this.minute/60,serviceActive=route&&serviceHour>=route.serviceStart&&serviceHour<route.serviceEnd;let bus=this.vehicles.find(v=>v.id===trip.vehicleId&&v.status==="active");if(!bus){bus=this.transportSystem.fleet.map(id=>this.vehicles.find(v=>v.id===id)).find(v=>v.routeId===trip.routeId&&v.status==="active");trip.vehicleId=bus?.id||null;}const stopServed=bus?.recentStops?.some(stop=>Math.hypot(stop[0]-trip.entryStop[0],stop[1]-trip.entryStop[1])<.12);if(!serviceActive||!bus||trip.waitedMinutes>trip.maxWait){this.fallbackFromTransit(p,!serviceActive?"serviço fora do horário":!bus?"linha sem veículo":"espera acima do limite");}else if(trip.waitRemaining<=0&&(stopServed||Math.hypot(bus.x-trip.entryStop[0],bus.y-trip.entryStop[1])<.75)){trip.phase="onboard";route.waiting=Math.max(0,route.waiting-1);p.target=null;p.path=[];p.x=bus.x;p.y=bus.y;}p.activity=this.personStatus(p);this.updateNeeds(p,minutes);return;}
          if(trip.phase==="onboard"){let bus=this.vehicles.find(v=>v.id===trip.vehicleId&&v.status==="active");if(!bus){trip.phase="waiting";trip.waitRemaining=5;p.activity=this.personStatus(p);this.updateNeeds(p,minutes);return;}p.x=bus.x;p.y=bus.y;trip.boardedMinutes+=minutes;p.activity=this.personStatus(p);const stopServed=bus.recentStops?.some(stop=>Math.hypot(stop[0]-trip.exitStop[0],stop[1]-trip.exitStop[1])<.12);if(trip.boardedMinutes>2&&(stopServed||Math.hypot(bus.x-trip.exitStop[0],bus.y-trip.exitStop[1])<.75)){const destination=this.buildings.find(b=>b.id===trip.destinationId);trip.mode="a pé";trip.phase="lastmile";p.x=trip.exitStop[0];p.y=trip.exitStop[1];p.path=[];p.target={x:destination.x+destination.w/2,y:destination.y+destination.h/2};p.activity=this.personStatus(p);}this.updateNeeds(p,minutes);return;}
        }
        if (p.target) {
          const dx = p.target.x - p.x,
            dy = p.target.y - p.y,
            d = Math.hypot(dx, dy),
            congestion = 1 + this.congestionAt(p),
            base =
              p.currentTrip?.mode === "carro" || p.currentTrip?.mode === "táxi"
                ? 18
                : p.currentTrip?.mode === "ônibus"
                  ? 3.2
                  : p.currentTrip?.mode === "bicicleta"
                    ? 6.5
                    : 3.2,
            mobilitySpeed =
              (base * (minutes / 10) * this.environment.current.mobilityFactor) /
              congestion,
            step = Math.min(d, mobilitySpeed);
          if (d > 0.08) {
            p.x += (dx / d) * step;
            p.y += (dy / d) * step;
            p.activity=this.personStatus(p);const vehicle=this.vehicles.find(v=>v.id===p.currentTrip?.vehicleId);if(vehicle){vehicle.x=p.x;vehicle.y=p.y;}
          } else if (p.path?.length) p.target = p.path.shift();
          else if(p.currentTrip?.mode==="ônibus"&&p.currentTrip.phase==="to_stop"){p.x=p.currentTrip.entryStop[0];p.y=p.currentTrip.entryStop[1];p.target=null;p.path=[];p.currentTrip.phase="waiting";p.currentTrip.waitedMinutes=0;}
          else this.completeArrival(p);
        }
        this.updateNeeds(p, minutes);
        if(this.isPlayerControlled(p))this.updatePlayerControl(p);
      });
    this.processCharacterDailyQueue();
    if (!this.characterDailyQueue) this.processCharacterWeeklyQueue();
    const worldStateSyncDue = hour !== previousHour || this.minute % 20 === 0 || !this.lastDetailedWorldSync;
    if (worldStateSyncDue) {
      this.synchronizeWorldState({ occupancy: hour !== previousHour || !this.spatialSystem?.lastSync });
      this.lastDetailedWorldSync = this.absoluteMinute();
    }
    if (hour !== previousHour && [8, 10, 12, 14, 16, 18, 20, 22].includes(hour)) {
      this.socialHour();
      this.synchronizeWorldState({ occupancy: false });
    }
    if (hour !== previousHour && [8, 12, 18, 22].includes(hour)) this.logCityPulse(hour);
  }
  simulateMacroCommerceDay() {
    this.businesses.forEach((b) => (b.presentCustomers = []));
    const consumers = this.people.filter(
      (p) => p.alive && !this.isPlayerControlled(p) && !p.justice.incarcerated && p.age >= 12,
    );
    consumers.forEach((p) => {
      if (Math.random() > (this.predictiveMode ? 0.72 : 0.42)) return;
      const nightlife=p.age>=18&&this.day>=3&&Math.random()<.22,visitHour=nightlife?(22+Math.floor(Math.random()*5))%24:(p.needs.hunger<60?12:18);this.minute=visitHour*60;
      const wanted = p.needs.hunger < 60 ? "food" : "general",
        options = this.businesses.filter(
          (b) =>
            !b.closed &&
            this.isOpen(b) &&
            (!nightlife||b.nightlife) &&
            (nightlife||!b.adultOnly||p.age>=18) &&
            Object.keys(b.products).length &&
            (wanted !== "food" ||
              b.products.alimentos ||
              b.products["refei\u00e7\u00e3o"] ||
              b.products["caf\u00e9"]),
        );
      if (options.length) this.interactWithBusiness(p, pick(options));
    });
    this.minute=12*60;
  }
  simulateMacroPopulationDay() {
    this.people
      .filter((p) => p.alive && !this.isPlayerControlled(p))
      .forEach((p) => {
        const worked = Boolean(
          p.shift?.days.includes(this.day) &&
            !p.justice.incarcerated &&
            p.medical.sickLeave <= 0,
        );
        p.activity = p.justice.incarcerated
          ? p.justice.prisonJob
            ? `Trabalho interno: ${p.justice.prisonJob}`
            : "Cumprindo pena"
          : p.medical.admitted
            ? "Internado"
            : worked
              ? `Trabalhando como ${p.role.toLowerCase()}`
              : p.education.enrolled && this.day < 5
                ? "Estudando"
                : "Tempo com a família";
        p.target = null;
        p.path = [];
        p.currentTrip = null;
        p.destinationId = null;
        p.locationId = worked
          ? this.buildings.find((b) => b.name === p.workplace)?.id || p.homeId
          : p.homeId;
        p.x =
          (this.buildings.find((b) => b.id === p.locationId)?.x || p.x) + 0.3;
        p.y =
          (this.buildings.find((b) => b.id === p.locationId)?.y || p.y) + 0.3;
        p.needs.hunger = clamp(62 + Math.random() * 30, 0, 100);
        p.needs.hygiene = clamp(65 + Math.random() * 30, 0, 100);
        p.needs.comfort = clamp(60 + Math.random() * 35, 0, 100);
        p.needs.social = clamp(
          55 + Math.random() * 35 + (p.traits.includes("sociável") ? 8 : 0),
          0,
          100,
        );
        p.energy = clamp(58 + Math.random() * 36, 0, 100);
        if (worked || p.education.enrolled) {
          const trips = 2 + (Math.random() < 0.35 ? 1 : 0);
          p.mobility.trips += trips;
          if (!this.vehicleOf(p) && p.mobility.preferred !== "bicicleta") {
            p.mobility.transitTrips += trips;
            this.transportSystem.totalRiders += trips;
            this.transportSystem.revenue +=
              trips * this.governance.policies.transitFare;
            p.money -= trips * this.governance.policies.transitFare;
          }
        }
        p.actionLog.unshift({
          week: this.week,
          day: this.day,
          time: "dia resumido",
          activity: p.activity,
          place:
            this.buildings.find((b) => b.id === p.locationId)?.name ||
            "Cidade",
        });
        p.actionLog = p.actionLog.slice(0, 20);
      });
    this.synchronizeWorldState();
  }
  simulateMacroDay() {
    this.maintainWorkforce();
    this.minute = 12 * 60;
    this.simulateMacroPopulationDay();
    this.socialHour({ macro: true });
    this.simulateMacroCommerceDay();
    this.events.active.forEach((event) => {
      if (event.suspended) return;
      if (event.familyEvent && (event.week !== this.week || event.day !== this.day)) return;
      const attending = Math.round(event.participants.length * (0.45 + Math.random() * 0.35));
      if (event.familyEvent) event.attendedIds = event.rsvp.acceptedIds.filter((id) => !this.isPlayerControlled(this.people.find((person) => person.id === id))).slice(0, attending);
      event.attendance += attending;
      this.events.attendance += attending;
    });
    this.dailyHealth();
    this.dailyForensics();
    this.dailyFunerals();
    this.dailyBereavement();
    this.dailyProbate();
    this.dailyJustice();
    this.dailyVehicleCrime();
    this.dailyInfrastructure();
    this.dailySupplyChain();
    this.updateDeliveries(1440);
    this.dailyEnvironment();
    this.dailyLifeStages();
    this.dailyEvents({ dayComplete: true });
    this.dailyFamilyLife();
    this.dailyCharacterLife();
    this.synchronizeWorldState();
  }
  advanceMacroDays(count = 1) {
    for (let n = 0; n < count; n++) {
      this.simulateMacroDay(); this.day++;
      if (this.day > 6) { this.day = 0; this.week++; this.weeklyEconomy(); }
      this.dailyCityDynamics();
    }
    this.macroTelemetry ||= { days: 0, startedWeek: this.week, startPopulation: this.people.filter(p=>p.alive).length, startDeaths: this.deaths.length, startBirths: this.demographics.births, startCases: this.justiceSystem.reported, startBuildings: this.buildings.length };
    this.macroTelemetry.days += count;
    this.minute = 12 * 60;
  }
  advancePredictiveWeeks(count = 1) {
    for(let n=0;n<count;n++){
      this.predictiveMode=true;this.maintainWorkforce();
      this.minute=18*60;
      for(let day=0;day<7;day++){
        this.day=day;this.dailyCityDynamics();this.simulateMacroPopulationDay();this.simulateMacroCommerceDay();this.socialHour({macro:true});this.dailyHealth();this.dailyForensics();this.dailyFunerals();this.dailyBereavement();this.dailyProbate();this.dailyJustice();this.dailyVehicleCrime();this.dailyInfrastructure();this.dailySupplyChain();this.updateDeliveries(1440);this.dailyEnvironment();this.dailyLifeStages();this.dailyEvents({dayComplete:true});this.dailyFamilyLife();this.dailyCharacterLife();
      }
      this.day=0;this.week++;this.weeklyEconomy();
      this.synchronizeWorldState();
      this.predictiveMode=false;
      this.macroTelemetry ||= {days:0,startedWeek:this.week,startPopulation:this.people.filter(p=>p.alive).length,startDeaths:this.deaths.length,startBirths:this.demographics.births,startCases:this.justiceSystem.reported,startBuildings:this.buildings.length};this.macroTelemetry.days+=7;
    }
    this.minute=12*60;
  }
  advanceMacroWeeks(count = 1) {
    this.advanceMacroDays(count * 7);
    this.day = 0;
    this.minute = 7 * 60 + 30;
    this.people
      .filter((p) => p.alive && !this.isPlayerControlled(p))
      .forEach((p) => {
        p.scheduleKey = null;
        p.currentTrip = null;
      });
  }
  forecastGrowth(weeks = 26) {
    if (this.cityDevelopment) {
      const snapshot = this.cityDevelopmentSnapshot(), forecast = forecastCityDevelopment(this.cityDevelopment, snapshot, weeks), recent = this.cityDevelopment.populationHistory.slice(-13);
      const weeklyBirths = recent.length ? recent.reduce((sum, item) => sum + (item.births || 0), 0) / recent.length : 0, weeklyDeaths = recent.length ? recent.reduce((sum, item) => sum + (item.deaths || 0), 0) / recent.length : 0, weeklyMigration = recent.length ? recent.reduce((sum, item) => sum + (item.arrivals || 0) - (item.departures || 0), 0) / recent.length : 0;
      return { weeks, population: forecast.population, births: Math.round(weeklyBirths * weeks), deaths: Math.round(weeklyDeaths * weeks), migration: Math.round(weeklyMigration * weeks), housingDeficit: forecast.housingDeficit, housingCapacity: forecast.housingCapacity, treasury: Math.round(this.money + (this.governance.weeklyRevenue - this.governance.weeklySpending) * weeks), confidence: forecast.confidence, weeklyNet: forecast.weeklyNet };
    }
    const elapsed = Math.max(1, this.week),
      birthRate = this.demographics.births / elapsed,
      deathRate = this.deaths.length / elapsed,
      migrationRate = this.housingSystem.immigrants / elapsed,
      potentialCouples = this.relationships.filter((r) => {
        const lifecycle = r.lifecycle;
        if (!lifecycle || lifecycle.status !== "active" || !["namoro", "uniao_estavel", "noivado", "casamento"].includes(lifecycle.stage)) return false;
        const a = this.people.find((p) => p.id === r.a),
          b = this.people.find((p) => p.id === r.b);
        return (
          a?.alive &&
          b?.alive &&
          a.age >= 20 &&
          b.age >= 20 &&
          a.age <= 48 &&
          b.age <= 48 &&
          (lifecycle.familyPlanning?.desiredHouseholdChildren || 0) > (lifecycle.familyPlanning?.childrenIds || []).length
        );
      }).length,
      projectedBirths = Math.round(
        birthRate * weeks +
          potentialCouples * 0.035 * weeks * 0.55 +
          this.demographics.pregnancies.filter((p) => p.status === "active")
            .length,
      ),
      elderlyRisk = this.people
        .filter((p) => p.alive && p.age > 78)
        .reduce((sum, p) => sum + (p.age - 76) * 0.0008 * 7 * weeks, 0),
      projectedDeaths = Math.round(deathRate * weeks + elderlyRisk),
      projectedMigration = Math.round(Math.max(0, migrationRate || 0.5) * weeks),
      population =
        this.people.filter((p) => p.alive).length +
        projectedBirths -
        projectedDeaths +
        projectedMigration,
      housing = this.housingStats();
    return {
      weeks,
      population,
      births: projectedBirths,
      deaths: projectedDeaths,
      migration: projectedMigration,
      housingDeficit: Math.max(0, population - housing.capacity),
      treasury: Math.round(
        this.money +
          (this.governance.weeklyRevenue - this.governance.weeklySpending) * weeks,
      ),
      confidence: this.week > 26 ? 82 : this.week > 8 ? 68 : 54,
    };
  }
  weeklyEconomy({ deferCharacter = false } = {}) {
    this.normalizeHouseholds();
    this.weeklyLifeStages();
    this.weeklyWorkforce();
    this.weeklyLaborMarket();
    let payroll = 0;
    this.people
      .filter((p) => p.alive)
      .forEach((p) => {
        p.money -= 180;
        p.happiness = clamp(p.happiness + (p.money > 500 ? 1 : -3), 0, 100);
        if (p.shift && !p.justice.incarcerated && !this.isPlayerControlled(p))
          payroll += Number(p.hourlyWage || 0) * Number(p.shift.hours || 0);
      });
    this.families.forEach((f) => {
      const livingMembers = this.livingHouseholdMembers(f),
        adults = livingMembers.filter((p) => p.age >= 18);
      if (!livingMembers.length) { f.status = "closed"; f.housingCost = 0; return; }
      f.status = "active";
      const home = this.buildings.find((b) => b.id === f.homeId);
      const housing =
        f.tenure === "rent"
          ? (home?.rent || 0) / 4
          : f.tenure === "mortgage"
            ? (home?.mortgagePayment || 620) / 4
            : 25;
      const livingCosts = livingMembers.length * 42;
      f.housingCost = housing * 4;
      const share = (housing + livingCosts) / Math.max(1, adults.length),
        canPay = adults.reduce((s, p) => s + Math.max(0, p.money), 0) >=
          housing + livingCosts;
      if (canPay) {
        adults.forEach((p) => (p.money -= share));
        f.arrears = Math.max(0, f.arrears - 1);
        f.creditScore = Math.min(900, f.creditScore + 2);
      } else {
        f.arrears++;
        f.creditScore = Math.max(200, f.creditScore - 18);
        if (f.arrears >= 5 && f.tenure === "rent") this.evictFamily(f);
      }
      f.wealth =
        livingMembers.reduce((sum, person) => sum + (Number.isFinite(person.money) ? person.money : 0), 0) + (f.tenure === "owned" ? home?.value || 0 : 0);
    });
    this.businesses.forEach((b) => {
      if (b.closed) return;
      const workers = b.employees
        .map((id) => this.people.find((x) => x.id === id))
        .filter((p) => p.alive && !this.isPlayerControlled(p) && p.shift && !p.justice.incarcerated);
      const wages = workers.reduce(
        (sum, p) => sum + Number(p.hourlyWage || 0) * Number(p.shift.hours || 0),
        0,
      );
      b.expenses = wages;
      b.cash -= wages;
      workers.forEach((p) => {
        p.money += Number(p.hourlyWage || 0) * Number(p.shift.hours || 0);
      });
    });
    this.weeklyEducation();
    this.weeklyHousing();
    this.weeklyRealEstateDynamics();
    this.weeklyUrbanEvolution();
    this.weeklyCityDevelopment();
    this.weeklyMarkets();
    this.weeklyTransport();
    this.weeklyRelationships();
    this.weeklyPregnancies();
    this.weeklyDependentCare();
    this.weeklyCommunityReactivity();
    this.weeklyFamilyLife();
    this.weeklyCharacterLife({ defer: deferCharacter });
    this.scheduleSocialEvents();
    this.scheduleVenueEvents();
    this.weeklyNotability();
    this.weeklyInfrastructure();
    this.weeklyEvents();
    this.weeklyJustice();
    this.weeklyBusinessLifecycle();
    this.people
      .filter((p) => p.alive)
      .forEach((p) => (p.routine = buildRoutine(p)));
    this.relationships.forEach((r) => {
      if (r.interactions === 0 && r.type === "amizade")
        r.affinity = Math.max(0, r.affinity - 0.5);
      r.interactions = 0;
    });
    this.weeklyGovernance(payroll);
    this.people.filter((person) => this.isPlayerControlled(person) && person.playerControl).forEach((person) => {
      person.playerControl.workMinutesLastWeek = person.playerControl.workMinutesThisWeek || 0;
      person.playerControl.studyMinutesLastWeek = person.playerControl.studyMinutesThisWeek || 0;
      person.playerControl.workMinutesThisWeek = 0;
      person.playerControl.studyMinutesThisWeek = 0;
    });
    this.weeklyPolitics();
    this.weeklyLocalGovernment();
    this.log(
      "economia",
      `A economia movimentou R$ ${Math.round(payroll).toLocaleString("pt-BR")} nesta semana.`,
      "money",
    );
    this.people
      .filter((p) => p.alive && p.bornWeek !== this.week && p.birthdayWeek === ((this.week - 1) % 52) + 1)
      .forEach((p) => {
        p.age++;
        const previousStage = p.lifeStage;
        const currentStage = lifeStageForAge(p.age);
        p.lifeStage = currentStage.id;
        if (p.lifeCourse) {
          p.lifeCourse.stageId = currentStage.id;
          p.lifeCourse.activityPreferences = [...currentStage.activities];
          if (previousStage !== currentStage.id) {
            p.lifeCourse.previousStages = [...(p.lifeCourse.previousStages || []), { id: previousStage, endedWeek: this.week }].slice(-12);
            p.lifeCourse.stageSinceWeek = this.week;
          }
        }
        p.history.push({ week: this.week, text: `Completou ${p.age} anos.` });
        this.log("aniversário", `${p.name} completou ${p.age} anos.`, "social");
        const next = stageForAge(p.age);
        if (next && next.id !== p.education.stage && !p.education.degree) {
          p.education.stage = next.id;
          p.education.institution = next.institution;
          p.education.enrolled = true;
          p.education.history.unshift({
            week: this.week,
            text: `Ingressou em ${next.name}.`,
          });
        }
        if (p.age >= 18 && p.guardianship?.reason === "Responsabilidade parental") p.guardianship.active = false;
        p.routine = buildRoutine(p);
      });
  }
}
