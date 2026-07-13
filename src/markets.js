/**
 * Mercados patrimoniais e gestão de negócios familiares.
 *
 * O módulo não depende da classe Simulation. Todas as operações recebem um
 * contexto semelhante à simulação ({ people, families, vehicles, buildings,
 * businesses, week, day, minute }) e um estado criado por createMarketsState.
 * Assim ele também pode ser usado em testes, saves antigos e saltos temporais.
 */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const asArray = (value) => (Array.isArray(value) ? value : []);
const pick = (items, rng = Math.random) => items[Math.floor(rng() * items.length)];

export const MARKET_STATE_VERSION = 1;

export const MARKET_COLLECTION_LIMITS = Object.freeze({
  listings: 480,
  contracts: 360,
  transactions: 360,
  actorHistory: 160,
});

export const vehicleMarketCatalog = [
  { id: "moto-urbana", model: "Brisa 160", type: "moto", price: 18600, seats: 2, efficiency: 31, annualDepreciation: .13, rentalDay: 78, segment: "popular" },
  { id: "scooter-eletrica", model: "Lume E2", type: "moto elétrica", price: 24400, seats: 2, efficiency: 48, annualDepreciation: .15, rentalDay: 92, segment: "elétrico" },
  { id: "hatch-popular", model: "Aurora Compact", type: "carro", price: 34800, seats: 5, efficiency: 14.8, annualDepreciation: .12, rentalDay: 128, segment: "popular" },
  { id: "hatch-medio", model: "Veloce City", type: "carro", price: 52900, seats: 5, efficiency: 13.2, annualDepreciation: .115, rentalDay: 168, segment: "médio" },
  { id: "sedan", model: "Horizonte Sedan", type: "carro", price: 74900, seats: 5, efficiency: 11.8, annualDepreciation: .105, rentalDay: 214, segment: "médio" },
  { id: "sedan-executivo", model: "Majestade Executive", type: "carro", price: 138000, seats: 5, efficiency: 10.4, annualDepreciation: .14, rentalDay: 410, segment: "luxo" },
  { id: "suv-compacto", model: "Trilha Cross", type: "carro", price: 96500, seats: 5, efficiency: 10.1, annualDepreciation: .12, rentalDay: 286, segment: "SUV" },
  { id: "suv-familiar", model: "Serra Família", type: "carro", price: 132000, seats: 7, efficiency: 8.9, annualDepreciation: .125, rentalDay: 375, segment: "SUV" },
  { id: "picape", model: "Trovão Cabine Dupla", type: "picape", price: 147000, seats: 5, efficiency: 8.2, annualDepreciation: .11, rentalDay: 398, segment: "utilitário" },
  { id: "van", model: "Utili Van", type: "van", price: 94000, seats: 8, efficiency: 9.1, annualDepreciation: .105, rentalDay: 324, segment: "utilitário" },
  { id: "furgão", model: "Entrega Pró", type: "furgão", price: 112000, seats: 3, efficiency: 8.6, annualDepreciation: .10, rentalDay: 348, segment: "comercial" },
  { id: "taxi", model: "Aurora Táxi", type: "carro", price: 63900, seats: 5, efficiency: 15.1, annualDepreciation: .14, rentalDay: 205, segment: "serviço" },
  { id: "carro-eletrico", model: "Lume E4", type: "carro elétrico", price: 124000, seats: 5, efficiency: 52, annualDepreciation: .15, rentalDay: 344, segment: "elétrico" },
  { id: "microonibus", model: "Integra Micro", type: "micro-ônibus", price: 286000, seats: 22, efficiency: 4.7, annualDepreciation: .09, rentalDay: 920, segment: "transporte" },
  { id: "onibus", model: "Integra Urbano", type: "ônibus", price: 418000, seats: 44, efficiency: 3.2, annualDepreciation: .085, rentalDay: 1420, segment: "transporte" },
];

export const dealershipCatalog = [
  { id: "revenda-central", name: "Autocidade Seminovos", specialty: ["popular", "médio", "SUV"], markup: .105, purchaseDiscount: .16, warrantyWeeks: 13, initialCash: 480000 },
  { id: "motores-do-vale", name: "Motores do Vale", specialty: ["utilitário", "comercial", "serviço"], markup: .12, purchaseDiscount: .19, warrantyWeeks: 8, initialCash: 620000 },
  { id: "mobilidade-verde", name: "Mobilidade Verde", specialty: ["elétrico"], markup: .09, purchaseDiscount: .14, warrantyWeeks: 18, initialCash: 390000 },
  { id: "locadora-horizonte", name: "Locadora Horizonte", specialty: ["popular", "médio", "SUV", "utilitário"], markup: .08, purchaseDiscount: .21, warrantyWeeks: 6, initialCash: 740000, rental: true },
];

export const vehicleMarketRules = Object.freeze({
  transferTaxRate: .025,
  defaultListingWeeks: 8,
  minimumDownPayment: .1,
  standardDownPayment: .2,
  annualInterest: .164,
  maximumFinanceMonths: 72,
  repossessionArrearsWeeks: 5,
  rentalDepositDays: 3,
  rentalLateLimitWeeks: 2,
  leaseMinimumWeeks: 26,
});

export const propertyTypeCatalog = [
  { id: "kitnet", name: "Kitnet", use: "residencial", buildingType: "home", capacity: 1, area: [22, 38], baseSqm: 3900, rentYield: .0068, maintenanceRate: .012 },
  { id: "apartamento", name: "Apartamento", use: "residencial", buildingType: "home", capacity: 4, area: [48, 110], baseSqm: 4300, rentYield: .0058, maintenanceRate: .009 },
  { id: "apartamento-luxo", name: "Apartamento de alto padrão", use: "residencial", buildingType: "home", capacity: 6, area: [95, 240], baseSqm: 7800, rentYield: .0047, maintenanceRate: .012 },
  { id: "casa-geminada", name: "Casa geminada", use: "residencial", buildingType: "home", capacity: 5, area: [58, 105], baseSqm: 3500, rentYield: .0061, maintenanceRate: .011 },
  { id: "casa", name: "Casa", use: "residencial", buildingType: "home", capacity: 6, area: [70, 180], baseSqm: 3900, rentYield: .0056, maintenanceRate: .013 },
  { id: "sobrado", name: "Sobrado", use: "residencial", buildingType: "home", capacity: 8, area: [105, 245], baseSqm: 4200, rentYield: .0054, maintenanceRate: .014 },
  { id: "condominio", name: "Casa em condomínio", use: "residencial", buildingType: "home", capacity: 7, area: [120, 300], baseSqm: 6600, rentYield: .0049, maintenanceRate: .016 },
  { id: "pensao", name: "Pensão", use: "residencial coletivo", buildingType: "home", capacity: 18, area: [160, 420], baseSqm: 3200, rentYield: .0074, maintenanceRate: .018 },
  { id: "terreno", name: "Terreno", use: "terreno", buildingType: "lot", capacity: 0, area: [90, 1000], baseSqm: 1700, rentYield: .001, maintenanceRate: .003 },
  { id: "loja", name: "Loja comercial", use: "comercial", buildingType: "shop", capacity: 20, area: [35, 180], baseSqm: 5100, rentYield: .0071, maintenanceRate: .014 },
  { id: "sala", name: "Sala comercial", use: "comercial", buildingType: "shop", capacity: 12, area: [22, 95], baseSqm: 4700, rentYield: .0073, maintenanceRate: .011 },
  { id: "predio-misto", name: "Prédio de uso misto", use: "misto", buildingType: "shop", capacity: 32, area: [180, 720], baseSqm: 5400, rentYield: .0064, maintenanceRate: .016 },
  { id: "galpao", name: "Galpão", use: "industrial", buildingType: "shop", capacity: 28, area: [250, 1800], baseSqm: 2600, rentYield: .0069, maintenanceRate: .015 },
  { id: "garagem", name: "Garagem e estacionamento", use: "comercial", buildingType: "shop", capacity: 35, area: [120, 900], baseSqm: 2200, rentYield: .0077, maintenanceRate: .008 },
  { id: "hotel", name: "Hotel ou pousada", use: "hotelaria", buildingType: "shop", capacity: 45, area: [300, 1600], baseSqm: 4800, rentYield: .0063, maintenanceRate: .021 },
  { id: "fazenda", name: "Propriedade rural", use: "rural", buildingType: "home", capacity: 10, area: [1000, 30000], baseSqm: 380, rentYield: .0038, maintenanceRate: .017 },
];

export const realEstateAgencyCatalog = [
  { id: "imobiliaria-acacias", name: "Imobiliária Acácias", districts: ["centro", "norte"], saleCommission: .05, rentCommission: .08, reputation: 78, cash: 180000 },
  { id: "lar-pioneiro", name: "Lar Pioneiro Negócios", districts: ["oeste", "sul"], saleCommission: .045, rentCommission: .075, reputation: 72, cash: 145000 },
  { id: "esperanca-imoveis", name: "Esperança Imóveis", districts: ["leste"], saleCommission: .048, rentCommission: .07, reputation: 75, cash: 132000 },
  { id: "cidade-comercial", name: "Cidade Comercial & Galpões", districts: ["centro", "sul", "leste", "oeste"], saleCommission: .055, rentCommission: .085, reputation: 81, cash: 265000, commercial: true },
];

export const realEstateMarketRules = Object.freeze({
  transferTaxRate: .03,
  registryFeeRate: .012,
  standardDepositMonths: 2,
  defaultLeaseWeeks: 52,
  minimumDownPayment: .15,
  standardDownPayment: .2,
  annualMortgageInterest: .112,
  maximumMortgageMonths: 360,
  foreclosureArrearsWeeks: 10,
  defaultListingWeeks: 16,
});

export const professionsByBusinessType = {
  "Mercado": ["Gerente de mercado", "Repositor", "Operador de caixa", "Açougueiro", "Estoquista", "Fiscal de prevenção"],
  "Padaria": ["Gerente de padaria", "Padeiro", "Confeiteiro", "Atendente", "Operador de caixa", "Auxiliar de cozinha"],
  "Restaurante": ["Gerente de restaurante", "Chef", "Cozinheiro", "Garçom", "Caixa", "Auxiliar de limpeza"],
  "Cafeteria": ["Gerente de cafeteria", "Barista", "Atendente", "Confeiteiro", "Caixa"],
  "Farmácia": ["Farmacêutico responsável", "Farmacêutico", "Balconista", "Caixa", "Estoquista"],
  "Hospitalidade": ["Gerente hoteleiro", "Recepcionista", "Camareiro", "Concierge", "Cozinheiro", "Segurança"],
  "Hotelaria": ["Gerente hoteleiro", "Recepcionista", "Camareiro", "Concierge", "Cozinheiro", "Segurança"],
  "Bar": ["Gerente de bar", "Bartender", "Garçom", "Cozinheiro", "Segurança", "Caixa"],
  "Pub": ["Gerente de pub", "Bartender", "Garçom", "Cozinheiro", "Músico", "Técnico de som"],
  "Boate": ["Gerente de casa noturna", "DJ", "Bartender", "Promotor de eventos", "Segurança", "Bilheteiro"],
  "Clube social": ["Administrador de clube", "Promotor de eventos", "Bartender", "Segurança", "Auxiliar de serviços"],
  "Serviços automotivos": ["Gerente de oficina", "Mecânico", "Eletricista automotivo", "Funileiro", "Atendente", "Estoquista de peças"],
  "Posto de combustível": ["Gerente de posto", "Frentista", "Operador de caixa", "Atendente de conveniência", "Trocador de óleo"],
  "Serviços financeiros": ["Gerente bancário", "Caixa bancário", "Analista de crédito", "Consultor financeiro", "Agente de cobrança"],
  "Livraria": ["Livreiro", "Vendedor", "Caixa", "Estoquista", "Mediador cultural"],
  "Entretenimento": ["Gerente cultural", "Bilheteiro", "Projecionista", "Atendente", "Segurança", "Técnico de manutenção"],
  "Bem-estar": ["Gerente de academia", "Educador físico", "Recepcionista", "Fisioterapeuta", "Auxiliar de limpeza"],
  "Imobiliária": ["Corretor de imóveis", "Avaliador imobiliário", "Administrador de locações", "Analista de crédito", "Assistente jurídico"],
  "Concessionária": ["Gerente de vendas", "Vendedor de veículos", "Avaliador automotivo", "Mecânico", "Analista de financiamento", "Despachante"],
  "Comércio local": ["Gerente de loja", "Vendedor", "Operador de caixa", "Estoquista", "Auxiliar de limpeza"],
};

export const familyBusinessStrategies = [
  { id: "conservadora", name: "Preservar o patrimônio", priceBias: .04, stockBias: .08, wageBias: -.02, expansionThreshold: 1.35, debtTolerance: .18 },
  { id: "crescimento", name: "Crescimento acelerado", priceBias: -.035, stockBias: .2, wageBias: .04, expansionThreshold: 1.05, debtTolerance: .48 },
  { id: "premium", name: "Qualidade e reputação", priceBias: .14, stockBias: .1, wageBias: .12, expansionThreshold: 1.22, debtTolerance: .3 },
  { id: "volume", name: "Preço e volume", priceBias: -.09, stockBias: .28, wageBias: 0, expansionThreshold: 1.12, debtTolerance: .38 },
  { id: "comunitaria", name: "Raízes comunitárias", priceBias: -.02, stockBias: .12, wageBias: .1, expansionThreshold: 1.3, debtTolerance: .2 },
];

export const familyBusinessDecisionCatalog = {
  price_review: { name: "Revisar preços", minimumCash: 0, cooldownWeeks: 2 },
  restock: { name: "Reforçar estoque", minimumCash: 1200, cooldownWeeks: 1 },
  cost_cut: { name: "Reduzir despesas", minimumCash: 0, cooldownWeeks: 4 },
  hiring: { name: "Contratar funcionários", minimumCash: 1800, cooldownWeeks: 2 },
  training: { name: "Treinar equipe", minimumCash: 2500, cooldownWeeks: 8 },
  marketing: { name: "Campanha de divulgação", minimumCash: 3200, cooldownWeeks: 6 },
  renovation: { name: "Reformar estabelecimento", minimumCash: 12000, cooldownWeeks: 26 },
  branch: { name: "Abrir filial", minimumCash: 45000, cooldownWeeks: 52 },
  relocate: { name: "Mudar de endereço", minimumCash: 18000, cooldownWeeks: 52 },
  succession: { name: "Formalizar sucessão", minimumCash: 800, cooldownWeeks: 26 },
};

function timeStamp(ctx = {}) {
  return { week: ctx.week || 1, day: ctx.day || 0, minute: ctx.minute || 0 };
}

function pushHistory(target, entry, limit = 160) {
  target.unshift(entry);
  if (target.length > limit) target.length = limit;
}

function marketId(state, prefix) {
  state.sequence = (state.sequence || 0) + 1;
  return `${prefix}-${state.sequence}`;
}

function success(data = {}) {
  return { ok: true, ...data };
}

function failure(error, code = "market_error") {
  return { ok: false, error, code };
}

function emit(ctx, category, text, tone = "money") {
  if (typeof ctx?.log === "function") ctx.log(category, text, tone);
}

function findVehicle(ctx, id) {
  return asArray(ctx?.vehicles).find((vehicle) => vehicle.id === id);
}

function findBuilding(ctx, id) {
  return asArray(ctx?.buildings).find((building) => building.id === id);
}

function findBusiness(ctx, id) {
  return asArray(ctx?.businesses).find((business) => business.id === id);
}

function findFamily(ctx, id) {
  return asArray(ctx?.families).find((family) => family.id === id);
}

function findPerson(ctx, id) {
  return asArray(ctx?.people).find((person) => person.id === id);
}

function findFamilyForPerson(ctx, person) {
  if (!person) return null;
  const directId = person.householdId || person.familyId;
  return findFamily(ctx, directId)
    || asArray(ctx?.families).find((family) => asArray(family.memberIds).includes(person.id))
    || null;
}

function householdMemberIds(ctx, family) {
  return new Set([
    ...asArray(family?.memberIds),
    ...asArray(ctx?.people)
      .filter((member) => family && (member.householdId || member.familyId) === family.id)
      .map((member) => member.id),
  ]);
}

function livingHouseholdMembers(ctx, family) {
  return [...householdMemberIds(ctx, family)]
    .map((memberId) => findPerson(ctx, memberId))
    .filter((member) => member && member.alive !== false);
}

function householdPropertyOccupancy(ctx, family, building) {
  const memberIds = householdMemberIds(ctx, family);
  const members = livingHouseholdMembers(ctx, family);
  const currentHouseholdResidents = members.filter((member) => member.homeId === building?.id).length;
  const otherResidents = asArray(ctx?.people).filter(
    (person) => person.alive !== false && person.homeId === building?.id && !memberIds.has(person.id),
  );
  const householdRefs = new Set([family?.id, ...memberIds].filter(Boolean));
  const otherOccupancyRefs = [...new Set([
    building?.property?.occupiedById,
    ...asArray(building?.property?.occupiedByIds),
  ].filter((occupantId) => occupantId && !householdRefs.has(occupantId)))];
  const reportedOtherResidents = Math.max(0, Number(building?.occupied || 0) - currentHouseholdResidents);
  return {
    memberIds,
    members,
    otherResidents,
    otherOccupancyRefs,
    otherResidentLoad: Math.max(otherResidents.length, reportedOtherResidents, otherOccupancyRefs.length),
  };
}

function householdFitsProperty(ctx, family, building) {
  if (!family || !building) return false;
  const occupancy = householdPropertyOccupancy(ctx, family, building);
  return !Number.isFinite(Number(building.capacity))
    || occupancy.otherResidentLoad + occupancy.members.length <= Number(building.capacity);
}

function householdCanTakeExclusivePossession(ctx, family, building) {
  if (!householdFitsProperty(ctx, family, building)) return false;
  const occupancy = householdPropertyOccupancy(ctx, family, building);
  return occupancy.otherResidentLoad === 0 && occupancy.otherOccupancyRefs.length === 0;
}

/**
 * Renda mensal recorrente baseada nos campos efetivamente usados pela
 * simulação. `salary` não faz parte do modelo de Person e, por isso, não deve
 * decidir aprovação de crédito.
 */
export function personMonthlyIncome(person = {}) {
  const explicit = Number(person.monthlyIncome ?? person.income);
  if (Number.isFinite(explicit) && explicit > 0) return roundMoney(explicit);
  const hourlyWage = Number(person.hourlyWage ?? person.wage ?? 0);
  const weeklyHours = Number(person.shift?.hours ?? person.weeklyHours ?? 0);
  const employmentIncome = Number.isFinite(hourlyWage) && Number.isFinite(weeklyHours)
    ? Math.max(0, hourlyWage) * Math.max(0, weeklyHours) * 52 / 12
    : 0;
  const pension = Number(
    person.lifeCourse?.retirement?.monthlyPension
      ?? person.retirement?.monthlyPension
      ?? person.monthlyPension
      ?? 0,
  );
  const benefits = Number(person.benefits?.monthly ?? person.monthlyBenefits ?? 0);
  return roundMoney(
    employmentIncome
      + (Number.isFinite(pension) ? Math.max(0, pension) : 0)
      + (Number.isFinite(benefits) ? Math.max(0, benefits) : 0),
  );
}

/** Resolve pessoa ou família e soma somente integrantes vivos do domicílio. */
export function householdMonthlyIncome(ctx, familyOrActor) {
  const id = typeof familyOrActor === "object" ? familyOrActor?.id : familyOrActor;
  const person = findPerson(ctx, id) || (familyOrActor && !familyOrActor.memberIds ? familyOrActor : null);
  const family = findFamily(ctx, id)
    || (familyOrActor?.memberIds ? familyOrActor : null)
    || findFamilyForPerson(ctx, person);
  if (!family) return person ? personMonthlyIncome(person) : 0;
  const explicit = Number(family.monthlyIncome ?? family.income);
  if (Number.isFinite(explicit) && explicit > 0) return roundMoney(explicit);
  const memberIds = householdMemberIds(ctx, family);
  return roundMoney(
    [...memberIds]
      .map((memberId) => findPerson(ctx, memberId))
      .filter((member) => member && member.alive !== false)
      .reduce((total, member) => total + personMonthlyIncome(member), 0),
  );
}

function resolveActor(ctx, state, id) {
  if (!id) return null;
  const person = findPerson(ctx, id);
  if (person) return { id, kind: "person", entity: person, field: "money" };
  const family = findFamily(ctx, id);
  if (family) return { id, kind: "family", entity: family, field: "wealth" };
  const business = findBusiness(ctx, id);
  if (business) return { id, kind: "business", entity: business, field: "cash" };
  const dealership = state?.vehicle?.dealerships?.find((item) => item.id === id);
  if (dealership) return { id, kind: "dealership", entity: dealership, field: "cash" };
  const agency = state?.realEstate?.agencies?.find((item) => item.id === id);
  if (agency) return { id, kind: "agency", entity: agency, field: "cash" };
  if (id === "municipality" && Number.isFinite(ctx?.money)) return { id, kind: "municipality", entity: ctx, field: "money" };
  return null;
}

export function actorBalance(ctx, state, actorId) {
  const actor = resolveActor(ctx, state, actorId);
  return actor ? Number(actor.entity[actor.field]) || 0 : 0;
}

function changeBalance(ctx, state, actorId, delta) {
  const actor = resolveActor(ctx, state, actorId);
  if (!actor) return false;
  actor.entity[actor.field] = roundMoney((Number(actor.entity[actor.field]) || 0) + delta);
  return true;
}

function charge(ctx, state, actorId, amount) {
  const value = roundMoney(amount);
  if (value < 0 || actorBalance(ctx, state, actorId) + .001 < value) return false;
  return changeBalance(ctx, state, actorId, -value);
}

function credit(ctx, state, actorId, amount) {
  return changeBalance(ctx, state, actorId, roundMoney(amount));
}

function ensureVehicleRecord(vehicle) {
  vehicle.record ||= {};
  vehicle.record.history = asArray(vehicle.record.history);
  vehicle.record.listed = Boolean(vehicle.record.listed);
  return vehicle.record;
}

function vehicleCatalogEntry(vehicle) {
  return vehicleMarketCatalog.find((entry) => entry.model === vehicle.model)
    || vehicleMarketCatalog.find((entry) => entry.type === vehicle.type)
    || vehicleMarketCatalog[2];
}

function propertyCatalogEntry(building) {
  const explicit = building?.property?.typeId || building?.propertyTypeId;
  if (explicit) return propertyTypeCatalog.find((entry) => entry.id === explicit) || propertyTypeCatalog[4];
  const name = String(building?.name || "").toLowerCase();
  if (name.includes("hotel") || name.includes("pousada")) return propertyTypeCatalog.find((entry) => entry.id === "hotel");
  if (name.includes("galpão") || name.includes("depósito")) return propertyTypeCatalog.find((entry) => entry.id === "galpao");
  if (building?.type === "shop" || building?.businessId) return propertyTypeCatalog.find((entry) => entry.id === "loja");
  return propertyTypeCatalog.find((entry) => entry.id === "casa");
}

export function createMarketsState(ctx = {}) {
  const state = {
    version: MARKET_STATE_VERSION,
    sequence: 0,
    vehicle: {
      listings: [],
      contracts: [],
      transactions: [],
      dealerships: dealershipCatalog.map((dealer) => ({ ...structuredClone(dealer), inventoryIds: [], sales: 0, purchases: 0, rentalIncome: 0, history: [] })),
      priceIndex: 100,
      demandIndex: 100,
      history: [],
      stats: { listed: 0, sold: 0, rented: 0, financed: 0, repossessed: 0, revenue: 0 },
    },
    realEstate: {
      listings: [],
      contracts: [],
      transactions: [],
      agencies: realEstateAgencyCatalog.map((agency) => ({ ...structuredClone(agency), agentIds: [], portfolioIds: [], sales: 0, leases: 0, history: [] })),
      priceIndex: 100,
      rentIndex: 100,
      vacancyRate: 0,
      averageSalePrice: 0,
      averageRent: 0,
      history: [],
      stats: { listed: 0, sold: 0, leased: 0, financed: 0, foreclosed: 0, commission: 0 },
    },
    familyBusiness: {
      profiles: [],
      decisions: [],
      expansionProjects: [],
      history: [],
      stats: { decisions: 0, hires: 0, branches: 0, successions: 0, failedBusinesses: 0 },
    },
    lastTickWeek: ctx.week || 1,
  };
  return state;
}

export function trimMarketCollections(state) {
  if (!state) return state;
  const trim = (entries, limit) => {
    const source = asArray(entries);
    if (source.length <= limit) return source;
    const active = source.filter((entry) => entry?.status === "active");
    const closed = source.filter((entry) => entry?.status !== "active");
    return [...active, ...closed].slice(0, limit);
  };
  if (state.vehicle) {
    state.vehicle.listings = trim(state.vehicle.listings, MARKET_COLLECTION_LIMITS.listings);
    state.vehicle.contracts = trim(state.vehicle.contracts, MARKET_COLLECTION_LIMITS.contracts);
    state.vehicle.transactions = asArray(state.vehicle.transactions).slice(0, MARKET_COLLECTION_LIMITS.transactions);
  }
  if (state.realEstate) {
    state.realEstate.listings = trim(state.realEstate.listings, MARKET_COLLECTION_LIMITS.listings);
    state.realEstate.contracts = trim(state.realEstate.contracts, MARKET_COLLECTION_LIMITS.contracts);
    state.realEstate.transactions = asArray(state.realEstate.transactions).slice(0, MARKET_COLLECTION_LIMITS.transactions);
  }
  return state;
}

export function ensureMarketsState(ctx, state) {
  const result = state || createMarketsState(ctx);
  result.version ||= MARKET_STATE_VERSION;
  result.sequence ||= 0;
  result.vehicle ||= createMarketsState(ctx).vehicle;
  result.realEstate ||= createMarketsState(ctx).realEstate;
  result.familyBusiness ||= createMarketsState(ctx).familyBusiness;
  result.vehicle.listings = asArray(result.vehicle.listings);
  result.vehicle.contracts = asArray(result.vehicle.contracts);
  result.vehicle.transactions = asArray(result.vehicle.transactions);
  result.realEstate.listings = asArray(result.realEstate.listings);
  result.realEstate.contracts = asArray(result.realEstate.contracts);
  result.realEstate.transactions = asArray(result.realEstate.transactions);
  result.familyBusiness.profiles = asArray(result.familyBusiness.profiles);
  result.familyBusiness.decisions = asArray(result.familyBusiness.decisions);
  result.familyBusiness.expansionProjects = asArray(result.familyBusiness.expansionProjects);
  return trimMarketCollections(result);
}

export function estimateVehicleValue(vehicle, options = {}) {
  if (!vehicle) return 0;
  const catalog = vehicleCatalogEntry(vehicle);
  const referenceYear = options.referenceYear || 2026;
  const year = Number(vehicle.year) || referenceYear;
  const age = Math.max(0, referenceYear - year);
  const originalPrice = Number(vehicle.originalPrice || catalog.price || vehicle.value) || 1;
  const depreciation = Number(catalog.annualDepreciation) || .12;
  const ageFactor = Math.pow(1 - depreciation, age);
  const conditionFactor = .58 + clamp(Number(vehicle.condition) || 65, 0, 100) * .0042;
  const mileage = Number(vehicle.mileage) || 0;
  const mileageFactor = clamp(1 - Math.max(0, mileage - 30000) / 700000, .58, 1.04);
  const record = ensureVehicleRecord(vehicle);
  const incidentFactor = record.stolen ? .88 : record.recovered ? .94 : 1;
  const marketFactor = (Number(options.priceIndex) || 100) / 100;
  return Math.max(1200, Math.round(originalPrice * ageFactor * conditionFactor * mileageFactor * incidentFactor * marketFactor));
}

export function registerVehicleHistory(vehicle, text, ctx = {}, extra = {}) {
  if (!vehicle) return null;
  const event = { ...timeStamp(ctx), text, ...extra };
  pushHistory(ensureVehicleRecord(vehicle).history, event, 100);
  return event;
}

export function createVehicleListing(ctx, stateInput, vehicleId, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const vehicle = findVehicle(ctx, vehicleId);
  if (!vehicle) return failure("Veículo não encontrado.", "vehicle_not_found");
  if (["stolen", "scrapped", "seized", "public"].includes(vehicle.status) || vehicle.use === "public") return failure("Este veículo não pode ser anunciado.", "vehicle_unavailable");
  if (state.vehicle.listings.some((item) => item.vehicleId === vehicleId && item.status === "active")) return failure("O veículo já possui anúncio ativo.", "already_listed");
  if (state.vehicle.contracts.some((item) => item.vehicleId === vehicleId && item.status === "active")) return failure("O veículo possui contrato ativo.", "active_contract");
  const kind = ["sale", "rental", "lease"].includes(options.kind) ? options.kind : "sale";
  const catalog = vehicleCatalogEntry(vehicle);
  const estimated = estimateVehicleValue(vehicle, { priceIndex: state.vehicle.priceIndex });
  const price = kind === "sale"
    ? roundMoney(options.price || estimated * (options.dealershipId ? 1.08 : 1.03))
    : roundMoney(options.price || catalog.rentalDay * (kind === "lease" ? 18 : 1));
  const listing = {
    id: marketId(state, "vehicle-listing"),
    vehicleId,
    sellerId: options.sellerId || vehicle.ownerId,
    dealershipId: options.dealershipId || null,
    kind,
    price,
    deposit: roundMoney(options.deposit ?? price * vehicleMarketRules.rentalDepositDays),
    minimumDuration: options.minimumDuration || (kind === "lease" ? vehicleMarketRules.leaseMinimumWeeks : 1),
    negotiable: options.negotiable !== false,
    status: "active",
    created: timeStamp(ctx),
    expiresWeek: (ctx.week || 1) + (options.durationWeeks || vehicleMarketRules.defaultListingWeeks),
    views: 0,
    offers: [],
  };
  state.vehicle.listings.unshift(listing);
  state.vehicle.stats.listed++;
  vehicle.status = "listed";
  ensureVehicleRecord(vehicle).listed = true;
  registerVehicleHistory(vehicle, kind === "sale" ? "Anunciado para venda." : kind === "lease" ? "Disponibilizado para leasing." : "Disponibilizado para locação.", ctx, { listingId: listing.id });
  return success({ state, listing });
}

export function submitVehicleOffer(ctx, stateInput, listingId, buyerId, amount, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const listing = state.vehicle.listings.find((item) => item.id === listingId);
  if (!listing || listing.status !== "active" || listing.kind !== "sale") return failure("Anúncio de venda não encontrado.", "listing_not_found");
  if (listing.sellerId === buyerId) return failure("O proprietário não pode ofertar no próprio veículo.", "same_owner");
  const value = roundMoney(Number(amount));
  if (value < listing.price * .65 || value > listing.price * 1.15) return failure("Oferta fora da faixa aceita pelo mercado.", "invalid_offer");
  const offer = {
    id: marketId(state, "vehicle-offer"), buyerId, amount: value,
    finance: options.finance || null, status: "pending", created: timeStamp(ctx), expiresWeek: (ctx.week || 1) + (options.validWeeks || 1),
  };
  listing.offers.unshift(offer);
  return success({ state, listing, offer });
}

export function respondVehicleOffer(ctx, stateInput, listingId, offerId, accepted) {
  const state = ensureMarketsState(ctx, stateInput);
  const listing = state.vehicle.listings.find((item) => item.id === listingId && item.status === "active");
  const offer = listing?.offers.find((item) => item.id === offerId && item.status === "pending");
  if (!offer) return failure("Oferta pendente não encontrada.", "offer_not_found");
  offer.status = accepted ? "accepted" : "rejected";
  offer.responded = timeStamp(ctx);
  if (accepted) {
    listing.acceptedBuyerId = offer.buyerId;
    listing.acceptedOfferId = offer.id;
    listing.price = offer.amount;
    listing.offers.filter((item) => item.id !== offer.id && item.status === "pending").forEach((item) => { item.status = "superseded"; });
  }
  return success({ state, listing, offer });
}

export function cancelVehicleListing(ctx, stateInput, listingId, reason = "Anúncio retirado pelo proprietário") {
  const state = ensureMarketsState(ctx, stateInput);
  const listing = state.vehicle.listings.find((item) => item.id === listingId);
  if (!listing || listing.status !== "active") return failure("Anúncio ativo não encontrado.", "listing_not_found");
  listing.status = "cancelled";
  listing.closed = timeStamp(ctx);
  listing.closeReason = reason;
  const vehicle = findVehicle(ctx, listing.vehicleId);
  if (vehicle) {
    vehicle.status = "active";
    ensureVehicleRecord(vehicle).listed = false;
    registerVehicleHistory(vehicle, reason, ctx);
  }
  return success({ state, listing });
}

export function quoteVehicleFinancing(ctx, stateInput, buyerId, price, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const actor = resolveActor(ctx, state, buyerId);
  if (!actor) return failure("Comprador não encontrado.", "buyer_not_found");
  const person = actor.kind === "person" ? actor.entity : null;
  const family = person ? findFamilyForPerson(ctx, person) : actor.kind === "family" ? actor.entity : null;
  const creditScore = Number(options.creditScore || family?.creditScore || person?.creditScore || 620);
  const downRate = clamp(Number(options.downPaymentRate ?? vehicleMarketRules.standardDownPayment), vehicleMarketRules.minimumDownPayment, .9);
  const months = clamp(Math.round(options.months || 48), 6, vehicleMarketRules.maximumFinanceMonths);
  const riskPremium = creditScore < 480 ? .13 : creditScore < 600 ? .07 : creditScore > 760 ? -.025 : 0;
  const annualRate = clamp(Number(options.annualRate ?? vehicleMarketRules.annualInterest) + riskPremium, .04, .42);
  const downPayment = roundMoney(price * downRate);
  const principal = roundMoney(price - downPayment);
  const monthlyRate = annualRate / 12;
  const monthlyPayment = roundMoney(principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / Math.max(.0001, Math.pow(1 + monthlyRate, months) - 1));
  const weeklyPayment = roundMoney(monthlyPayment * 12 / 52);
  const estimatedIncome = family ? householdMonthlyIncome(ctx, family) : personMonthlyIncome(person);
  const approved = creditScore >= 390
    && actorBalance(ctx, state, buyerId) >= downPayment
    && estimatedIncome > 0
    && monthlyPayment <= estimatedIncome * .38;
  return success({ approved, price: roundMoney(price), downPayment, principal, annualRate, months, monthlyPayment, weeklyPayment, creditScore });
}

function removeVehicleAccess(ctx, vehicleId) {
  asArray(ctx?.people).forEach((person) => {
    person.mobility ||= { vehicleIds: [] };
    person.mobility.vehicleIds = asArray(person.mobility.vehicleIds).filter((id) => id !== vehicleId);
  });
  asArray(ctx?.families).forEach((family) => {
    if (family.vehicleIds) family.vehicleIds = asArray(family.vehicleIds).filter((id) => id !== vehicleId);
  });
}

export function assignVehicleOwner(ctx, vehicle, ownerId, use = "private") {
  if (!vehicle) return false;
  removeVehicleAccess(ctx, vehicle.id);
  vehicle.ownerId = ownerId;
  vehicle.custodianId = null;
  vehicle.use = use;
  const person = findPerson(ctx, ownerId);
  if (person) {
    person.mobility ||= { vehicleIds: [] };
    person.mobility.vehicleIds = asArray(person.mobility.vehicleIds);
    if (!person.mobility.vehicleIds.includes(vehicle.id)) person.mobility.vehicleIds.push(vehicle.id);
  }
  const family = findFamily(ctx, ownerId);
  if (family) {
    family.vehicleIds = asArray(family.vehicleIds);
    if (!family.vehicleIds.includes(vehicle.id)) family.vehicleIds.push(vehicle.id);
  }
  return true;
}

export function purchaseVehicle(ctx, stateInput, listingId, buyerId, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const listing = state.vehicle.listings.find((item) => item.id === listingId);
  if (!listing || listing.status !== "active" || listing.kind !== "sale") return failure("Anúncio de venda não encontrado.", "listing_not_found");
  if (listing.sellerId === buyerId) return failure("O proprietário não pode comprar o próprio veículo.", "same_owner");
  if (listing.acceptedBuyerId && listing.acceptedBuyerId !== buyerId) return failure("O vendedor já aceitou a oferta de outro comprador.", "reserved_listing");
  const vehicle = findVehicle(ctx, listing.vehicleId);
  if (!vehicle) return failure("Veículo não encontrado.", "vehicle_not_found");
  const offer = clamp(Number(options.offer || listing.price), listing.price * .82, listing.price * 1.05);
  const price = roundMoney(listing.negotiable ? offer : listing.price);
  const dealer = state.vehicle.dealerships.find((item) => item.id === listing.dealershipId);
  const commission = roundMoney(price * (dealer ? dealer.markup * .45 : .018));
  const tax = roundMoney(price * vehicleMarketRules.transferTaxRate);
  let financeQuote = null;
  if (options.finance) {
    financeQuote = quoteVehicleFinancing(ctx, state, buyerId, price + tax, options.finance);
    if (!financeQuote.ok || !financeQuote.approved) return failure("Financiamento não aprovado.", "finance_denied");
    if (!charge(ctx, state, buyerId, financeQuote.downPayment)) return failure("Saldo insuficiente para a entrada.", "insufficient_funds");
  } else if (!charge(ctx, state, buyerId, price + tax)) return failure("Saldo insuficiente para a compra.", "insufficient_funds");
  credit(ctx, state, listing.sellerId, price - commission);
  if (dealer) dealer.cash = roundMoney(dealer.cash + commission);
  if (Number.isFinite(ctx?.money)) ctx.money = roundMoney(ctx.money + tax);
  assignVehicleOwner(ctx, vehicle, buyerId, "private");
  if (dealer) {
    dealer.inventoryIds = dealer.inventoryIds.filter((id) => id !== vehicle.id);
    dealer.sales++;
  }
  vehicle.status = "active";
  ensureVehicleRecord(vehicle).listed = false;
  listing.status = "sold";
  listing.closed = timeStamp(ctx);
  listing.buyerId = buyerId;
  listing.finalPrice = price;
  const transaction = { id: marketId(state, "vehicle-sale"), type: "sale", listingId, vehicleId: vehicle.id, sellerId: listing.sellerId, buyerId, price, tax, commission, financed: Boolean(financeQuote), ...timeStamp(ctx) };
  state.vehicle.transactions.unshift(transaction);
  state.vehicle.stats.sold++;
  state.vehicle.stats.revenue = roundMoney(state.vehicle.stats.revenue + price);
  if (financeQuote) {
    const contract = {
      id: marketId(state, "vehicle-finance"), type: "finance", vehicleId: vehicle.id, debtorId: buyerId,
      lenderId: listing.dealershipId || "municipality", originalPrincipal: financeQuote.principal,
      balance: financeQuote.principal, annualRate: financeQuote.annualRate, weeklyPayment: financeQuote.weeklyPayment,
      months: financeQuote.months, paid: 0, arrearsWeeks: 0, status: "active", started: timeStamp(ctx), history: [],
    };
    state.vehicle.contracts.unshift(contract);
    state.vehicle.stats.financed++;
    transaction.contractId = contract.id;
    vehicle.financeContractId = contract.id;
  }
  registerVehicleHistory(vehicle, `Comprado por ${buyerId} por R$ ${price.toLocaleString("pt-BR")}.`, ctx, { transactionId: transaction.id });
  emit(ctx, "mercado de veículos", `${findPerson(ctx, buyerId)?.name || "Um comprador"} adquiriu ${vehicle.model}.`, "money");
  return success({ state, transaction, vehicle, contract: financeQuote ? state.vehicle.contracts[0] : null });
}

export function rentVehicle(ctx, stateInput, listingId, renterId, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const listing = state.vehicle.listings.find((item) => item.id === listingId);
  if (!listing || listing.status !== "active" || !["rental", "lease"].includes(listing.kind)) return failure("Oferta de locação não encontrada.", "listing_not_found");
  const vehicle = findVehicle(ctx, listing.vehicleId);
  if (!vehicle) return failure("Veículo não encontrado.", "vehicle_not_found");
  const renter = findPerson(ctx, renterId);
  if (renter && !renter.mobility?.license) return failure("O locatário não possui habilitação.", "driver_unlicensed");
  const isLease = listing.kind === "lease";
  const durationWeeks = isLease ? Math.max(listing.minimumDuration, options.durationWeeks || 52) : Math.max(1, Math.ceil((options.durationDays || 7) / 7));
  const weeklyPayment = isLease ? roundMoney(listing.price * 12 / 52) : roundMoney(listing.price * 7);
  const deposit = roundMoney(options.deposit ?? listing.deposit);
  if (!charge(ctx, state, renterId, deposit + weeklyPayment)) return failure("Saldo insuficiente para caução e primeiro período.", "insufficient_funds");
  credit(ctx, state, listing.sellerId, weeklyPayment);
  const contract = {
    id: marketId(state, isLease ? "vehicle-lease" : "vehicle-rental"), type: listing.kind, listingId,
    vehicleId: vehicle.id, ownerId: listing.sellerId, renterId, weeklyPayment, deposit, durationWeeks,
    remainingWeeks: durationWeeks, mileageStart: vehicle.mileage || 0, conditionStart: vehicle.condition || 100,
    arrearsWeeks: 0, paid: weeklyPayment, status: "active", started: timeStamp(ctx), history: [],
  };
  state.vehicle.contracts.unshift(contract);
  listing.status = "contracted";
  listing.contractId = contract.id;
  vehicle.status = "active";
  vehicle.custodianId = renterId;
  vehicle.use = "rental";
  removeVehicleAccess(ctx, vehicle.id);
  if (renter) {
    renter.mobility ||= { vehicleIds: [] };
    renter.mobility.vehicleIds = asArray(renter.mobility.vehicleIds);
    if (!renter.mobility.vehicleIds.includes(vehicle.id)) renter.mobility.vehicleIds.push(vehicle.id);
  }
  state.vehicle.stats.rented++;
  registerVehicleHistory(vehicle, `${isLease ? "Leasing" : "Locação"} iniciado por ${renterId}.`, ctx, { contractId: contract.id });
  return success({ state, contract, vehicle });
}

export function returnRentedVehicle(ctx, stateInput, contractId, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const contract = state.vehicle.contracts.find((item) => item.id === contractId && ["rental", "lease"].includes(item.type));
  if (!contract || contract.status !== "active") return failure("Contrato de locação ativo não encontrado.", "contract_not_found");
  const vehicle = findVehicle(ctx, contract.vehicleId);
  if (!vehicle) return failure("Veículo não encontrado.", "vehicle_not_found");
  const conditionLoss = Math.max(0, contract.conditionStart - (vehicle.condition || 0));
  const excessiveMileage = Math.max(0, (vehicle.mileage || 0) - contract.mileageStart - contract.durationWeeks * 450);
  const damages = roundMoney(options.damages ?? conditionLoss * 85 + excessiveMileage * .35);
  const refund = Math.max(0, roundMoney(contract.deposit - damages - contract.arrearsWeeks * contract.weeklyPayment));
  if (refund) credit(ctx, state, contract.renterId, refund);
  if (damages) credit(ctx, state, contract.ownerId, Math.min(contract.deposit, damages));
  removeVehicleAccess(ctx, vehicle.id);
  assignVehicleOwner(ctx, vehicle, contract.ownerId, "private");
  vehicle.status = "active";
  contract.status = "completed";
  contract.ended = timeStamp(ctx);
  contract.depositRefund = refund;
  contract.damages = damages;
  const listing = state.vehicle.listings.find((item) => item.id === contract.listingId);
  if (listing) listing.status = "completed";
  registerVehicleHistory(vehicle, `Devolvido ao proprietário; encargos de R$ ${damages.toLocaleString("pt-BR")}.`, ctx, { contractId });
  return success({ state, contract, vehicle, refund, damages });
}

export function sellVehicleToDealership(ctx, stateInput, vehicleId, sellerId, dealershipId) {
  const state = ensureMarketsState(ctx, stateInput);
  const vehicle = findVehicle(ctx, vehicleId);
  const dealer = state.vehicle.dealerships.find((item) => item.id === dealershipId);
  if (!vehicle || vehicle.ownerId !== sellerId) return failure("Veículo ou proprietário inválido.", "invalid_vehicle_owner");
  if (!dealer) return failure("Concessionária não encontrada.", "dealer_not_found");
  const value = estimateVehicleValue(vehicle, { priceIndex: state.vehicle.priceIndex });
  const offer = roundMoney(value * (1 - dealer.purchaseDiscount));
  if (dealer.cash < offer) return failure("A concessionária não possui caixa para esta compra.", "dealer_insufficient_funds");
  dealer.cash = roundMoney(dealer.cash - offer);
  credit(ctx, state, sellerId, offer);
  assignVehicleOwner(ctx, vehicle, dealer.id, "dealership");
  vehicle.status = "inventory";
  dealer.inventoryIds.push(vehicle.id);
  dealer.purchases++;
  registerVehicleHistory(vehicle, `Vendido à ${dealer.name}.`, ctx);
  const listed = createVehicleListing(ctx, state, vehicle.id, { sellerId: dealer.id, dealershipId: dealer.id, price: value * (1 + dealer.markup) });
  return success({ state, vehicle, dealership: dealer, offer, listing: listed.listing });
}

export function applyVehicleDepreciation(ctx, stateInput, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const weeks = Math.max(1, options.weeks || 1);
  asArray(ctx?.vehicles).forEach((vehicle) => {
    const catalog = vehicleCatalogEntry(vehicle);
    const weeklyRate = 1 - Math.pow(1 - (catalog.annualDepreciation || .12), 1 / 52);
    const usagePenalty = Math.min(.004, ((vehicle.mileageDeltaWeek || 0) / 12000));
    const floor = Math.max(900, catalog.price * .045);
    vehicle.value = Math.max(floor, Math.round((vehicle.value || estimateVehicleValue(vehicle, { priceIndex: state.vehicle.priceIndex })) * Math.pow(1 - weeklyRate - usagePenalty, weeks)));
  });
  return state;
}

function processVehicleContracts(ctx, state) {
  state.vehicle.contracts.filter((contract) => contract.status === "active").forEach((contract) => {
    if (contract.type === "finance") {
      const weeklyInterest = contract.balance * contract.annualRate / 52;
      if (charge(ctx, state, contract.debtorId, contract.weeklyPayment)) {
        const principalPaid = Math.max(0, contract.weeklyPayment - weeklyInterest);
        contract.balance = roundMoney(Math.max(0, contract.balance - principalPaid));
        contract.paid = roundMoney(contract.paid + contract.weeklyPayment);
        contract.arrearsWeeks = 0;
        credit(ctx, state, contract.lenderId, contract.weeklyPayment);
        pushHistory(contract.history, { ...timeStamp(ctx), text: `Parcela de R$ ${contract.weeklyPayment.toLocaleString("pt-BR")} paga.`, balance: contract.balance }, 80);
      } else {
        contract.arrearsWeeks++;
        pushHistory(contract.history, { ...timeStamp(ctx), text: `Parcela em atraso (${contract.arrearsWeeks} semana(s)).` }, 80);
      }
      if (contract.balance <= 1) {
        contract.status = "completed";
        contract.ended = timeStamp(ctx);
        const vehicle = findVehicle(ctx, contract.vehicleId);
        if (vehicle) vehicle.financeContractId = null;
        pushHistory(contract.history, { ...timeStamp(ctx), text: "Financiamento quitado." }, 80);
      } else if (contract.arrearsWeeks >= vehicleMarketRules.repossessionArrearsWeeks) {
        contract.status = "repossessed";
        contract.ended = timeStamp(ctx);
        const vehicle = findVehicle(ctx, contract.vehicleId);
        if (vehicle) {
          assignVehicleOwner(ctx, vehicle, contract.lenderId, "dealership");
          vehicle.status = "inventory";
          registerVehicleHistory(vehicle, "Retomado por inadimplência do financiamento.", ctx, { contractId: contract.id });
          const dealer = state.vehicle.dealerships.find((item) => item.id === contract.lenderId);
          if (dealer && !dealer.inventoryIds.includes(vehicle.id)) dealer.inventoryIds.push(vehicle.id);
        }
        state.vehicle.stats.repossessed++;
        pushHistory(contract.history, { ...timeStamp(ctx), text: "Contrato encerrado com retomada do veículo." }, 80);
      }
      return;
    }
    const vehicle = findVehicle(ctx, contract.vehicleId);
    if (!vehicle) return;
    if (charge(ctx, state, contract.renterId, contract.weeklyPayment)) {
      credit(ctx, state, contract.ownerId, contract.weeklyPayment);
      contract.paid = roundMoney(contract.paid + contract.weeklyPayment);
      contract.arrearsWeeks = 0;
      pushHistory(contract.history, { ...timeStamp(ctx), text: "Período de locação pago." }, 80);
    } else {
      contract.arrearsWeeks++;
      pushHistory(contract.history, { ...timeStamp(ctx), text: `Locação em atraso (${contract.arrearsWeeks} semana(s)).` }, 80);
    }
    contract.remainingWeeks--;
    if (contract.remainingWeeks <= 0 || contract.arrearsWeeks >= vehicleMarketRules.rentalLateLimitWeeks) returnRentedVehicle(ctx, state, contract.id, {});
  });
}

export function tickVehicleMarket(ctx, stateInput, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const weeks = Math.max(1, options.weeks || 1);
  applyVehicleDepreciation(ctx, state, { weeks });
  for (let i = 0; i < weeks; i++) processVehicleContracts(ctx, state);
  state.vehicle.listings.filter((item) => item.status === "active" && item.expiresWeek <= (ctx.week || 1)).forEach((item) => cancelVehicleListing(ctx, state, item.id, "Anúncio expirado sem negócio"));
  const active = state.vehicle.listings.filter((item) => item.status === "active");
  const demand = asArray(ctx?.people).filter((person) => person.alive !== false && person.mobility?.license && !asArray(person.mobility.vehicleIds).length && (person.money || 0) > 9000).length;
  state.vehicle.demandIndex = clamp(80 + demand / Math.max(1, active.length) * 8, 70, 145);
  state.vehicle.priceIndex = clamp(state.vehicle.priceIndex * .995 + state.vehicle.demandIndex * .005, 72, 155);
  state.vehicle.stats.listed = active.length;
  return state;
}

export function ensurePropertyMetadata(building, index = 0) {
  if (!building) return null;
  const type = propertyCatalogEntry(building);
  const footprint = Math.max(18, (Number(building.w) || 2) * (Number(building.h) || 2) * 34);
  const area = Math.round(clamp(Number(building.area) || footprint, type.area[0], type.area[1]));
  building.property ||= {};
  Object.assign(building.property, {
    typeId: building.property.typeId || type.id,
    area,
    bedrooms: building.property.bedrooms ?? (type.use.startsWith("residencial") ? Math.max(1, Math.round(type.capacity / 2.2)) : 0),
    bathrooms: building.property.bathrooms ?? Math.max(1, Math.round(type.capacity / 4)),
    condition: building.property.condition ?? 72 + index % 24,
    furnished: Boolean(building.property.furnished),
    parkingSpaces: building.property.parkingSpaces ?? (type.use === "comercial" ? 3 : index % 3),
    ownerKind: building.property.ownerKind || (building.ownerId ? "person" : "unassigned"),
    ownerId: building.property.ownerId || building.ownerFamilyId || building.ownerId || null,
    occupiedById: building.property.occupiedById || null,
    occupiedByIds: [...new Set([
      ...asArray(building.property.occupiedByIds),
      building.property.occupiedById,
    ].filter(Boolean))].slice(0, 240),
    listingId: building.property.listingId || null,
    vacancyWeeks: building.property.vacancyWeeks || 0,
    improvements: asArray(building.property.improvements),
  });
  building.propertyTypeId = building.property.typeId;
  building.value ||= Math.round(area * type.baseSqm * (.72 + building.property.condition / 250));
  if (type.buildingType === "home") building.capacity ||= type.capacity;
  return building.property;
}

export function estimatePropertyValue(building, stateInput, options = {}) {
  if (!building) return 0;
  const state = stateInput?.realEstate ? stateInput : createMarketsState();
  const metadata = ensurePropertyMetadata(building);
  const type = propertyCatalogEntry(building);
  const districtFactor = Number(options.districtFactor || building.districtDesirability && (.65 + building.districtDesirability / 150) || 1);
  const conditionFactor = .62 + metadata.condition / 185;
  const amenityFactor = 1 + metadata.parkingSpaces * .018 + metadata.improvements.length * .025 + (metadata.furnished ? .035 : 0);
  const marketFactor = (state.realEstate.priceIndex || 100) / 100;
  const assessed = metadata.area * type.baseSqm * districtFactor * conditionFactor * amenityFactor * marketFactor;
  return Math.max(18000, Math.round((Number(building.value) || assessed) * .35 + assessed * .65));
}

export function estimatePropertyRent(building, stateInput, options = {}) {
  if (!building) return 0;
  const state = stateInput?.realEstate ? stateInput : createMarketsState();
  const type = propertyCatalogEntry(building);
  const value = estimatePropertyValue(building, state, options);
  return Math.max(280, Math.round(value * type.rentYield * ((state.realEstate.rentIndex || 100) / 100)));
}

function propertyRentalAvailability(ctx, building) {
  const type = propertyCatalogEntry(building);
  const residential = type.use.startsWith("residencial");
  const actualResidents = asArray(ctx?.people).filter((person) => person.alive !== false && person.homeId === building?.id).length;
  const occupied = Math.max(actualResidents, Number(building?.occupied || 0));
  const capacity = Number.isFinite(Number(building?.capacity)) ? Math.max(0, Number(building.capacity)) : null;
  const availableCapacity = capacity === null ? Number(!occupied) : Math.max(0, capacity - occupied);
  const analytical = asArray(ctx?.realEstateDynamics?.properties).find(
    (property) => property.buildingId === building?.id || property.id === building?.id,
  );
  const totalUnits = Math.max(1, Math.round(Number(analytical?.units ?? building?.units ?? 1) || 1));
  const analyticalVacancies = Math.max(0, Math.round(Number(
    analytical?.vacantUnits ?? Math.max(0, totalUnits - Number(analytical?.occupiedUnits || 0)),
  ) || 0));
  const availableUnits = Math.max(availableCapacity > 0 ? 1 : 0, analyticalVacancies);
  const unitCapacity = availableCapacity > 0
    ? Math.max(1, Math.floor(availableCapacity / Math.max(1, analyticalVacancies || 1)))
    : 0;
  return {
    residential,
    rentable: residential ? availableCapacity > 0 : occupied === 0,
    occupied,
    capacity,
    availableCapacity,
    totalUnits,
    availableUnits,
    unitCapacity,
    mode: occupied > 0 ? (totalUnits > 1 ? "unit" : "shared_unit") : (totalUnits > 1 ? "unit" : "whole_property"),
  };
}

function selectAgency(state, building, kind) {
  const commercial = !propertyCatalogEntry(building).use.startsWith("residencial");
  return state.realEstate.agencies
    .filter((agency) => !commercial || agency.commercial)
    .sort((a, b) => Number(b.districts.includes(building.districtId)) - Number(a.districts.includes(building.districtId)) || b.reputation - a.reputation)[0]
    || state.realEstate.agencies[0];
}

export function createPropertyListing(ctx, stateInput, buildingId, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const building = findBuilding(ctx, buildingId);
  if (!building) return failure("Imóvel não encontrado.", "property_not_found");
  const metadata = ensurePropertyMetadata(building);
  if (state.realEstate.listings.some((item) => item.buildingId === buildingId && item.status === "active")) return failure("O imóvel já possui anúncio ativo.", "already_listed");
  const kind = options.kind === "rent" ? "rent" : "sale";
  const rentalAvailability = propertyRentalAvailability(ctx, building);
  if (kind === "rent" && !rentalAvailability.rentable && !options.allowOccupied)
    return failure("O imóvel não possui unidade ou capacidade residencial vaga para locação.", "property_occupied");
  const agency = state.realEstate.agencies.find((item) => item.id === options.agencyId) || selectAgency(state, building, kind);
  const estimatedRent = estimatePropertyRent(building, state, options);
  const occupiedRentFactor = rentalAvailability.occupied > 0
    ? rentalAvailability.totalUnits > 1
      ? 1 / rentalAvailability.totalUnits
      : clamp(rentalAvailability.availableCapacity / Math.max(1, rentalAvailability.capacity || rentalAvailability.availableCapacity), .3, .7)
    : 1;
  const price = roundMoney(options.price || (kind === "sale" ? estimatePropertyValue(building, state, options) : estimatedRent * occupiedRentFactor));
  const listing = {
    id: marketId(state, "property-listing"), buildingId, sellerId: options.sellerId || metadata.ownerId || building.ownerFamilyId || building.ownerId || "municipality",
    agencyId: agency?.id || null, kind, price, negotiable: options.negotiable !== false,
    occupied: Boolean(metadata.occupiedById || building.occupied > 0), furnished: metadata.furnished,
    rentalUnit: kind === "rent" ? {
      mode: rentalAvailability.mode,
      capacity: rentalAvailability.unitCapacity,
      availableCapacityAtListing: rentalAvailability.availableCapacity,
      availableUnitsAtListing: rentalAvailability.availableUnits,
      totalUnits: rentalAvailability.totalUnits,
      shared: rentalAvailability.occupied > 0,
    } : null,
    status: "active", applications: [], offers: [], views: 0, created: timeStamp(ctx),
    expiresWeek: (ctx.week || 1) + (options.durationWeeks || realEstateMarketRules.defaultListingWeeks),
  };
  state.realEstate.listings.unshift(listing);
  state.realEstate.stats.listed++;
  metadata.listingId = listing.id;
  if (agency) agency.portfolioIds.push(listing.id);
  return success({ state, listing, agency });
}

export function submitPropertyOffer(ctx, stateInput, listingId, buyerId, amount, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const listing = state.realEstate.listings.find((item) => item.id === listingId);
  if (!listing || listing.status !== "active" || listing.kind !== "sale") return failure("Anúncio de venda não encontrado.", "listing_not_found");
  if (listing.sellerId === buyerId) return failure("O proprietário não pode ofertar no próprio imóvel.", "same_owner");
  const value = roundMoney(Number(amount));
  if (value < listing.price * .65 || value > listing.price * 1.15) return failure("Oferta fora da faixa aceita pelo mercado.", "invalid_offer");
  let mortgage = null;
  if (options.finance) {
    mortgage = quoteMortgage(ctx, state, buyerId, value, options.finance);
    if (!mortgage.ok || !mortgage.approved) return failure("A proposta não recebeu pré-aprovação de crédito.", "mortgage_denied");
  }
  const offer = {
    id: marketId(state, "property-offer"), buyerId, amount: value, finance: options.finance || null,
    preApproved: Boolean(mortgage), status: "pending", created: timeStamp(ctx), expiresWeek: (ctx.week || 1) + (options.validWeeks || 2),
  };
  listing.offers.unshift(offer);
  return success({ state, listing, offer, mortgage });
}

export function respondPropertyOffer(ctx, stateInput, listingId, offerId, accepted) {
  const state = ensureMarketsState(ctx, stateInput);
  const listing = state.realEstate.listings.find((item) => item.id === listingId && item.status === "active");
  const offer = listing?.offers.find((item) => item.id === offerId && item.status === "pending");
  if (!offer) return failure("Proposta pendente não encontrada.", "offer_not_found");
  offer.status = accepted ? "accepted" : "rejected";
  offer.responded = timeStamp(ctx);
  if (accepted) {
    listing.acceptedBuyerId = offer.buyerId;
    listing.acceptedOfferId = offer.id;
    listing.price = offer.amount;
    listing.offers.filter((item) => item.id !== offer.id && item.status === "pending").forEach((item) => { item.status = "superseded"; });
  }
  return success({ state, listing, offer });
}

export function applyForPropertyRental(ctx, stateInput, listingId, tenantId, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const listing = state.realEstate.listings.find((item) => item.id === listingId);
  if (!listing || listing.status !== "active" || listing.kind !== "rent") return failure("Anúncio de aluguel não encontrado.", "listing_not_found");
  if (listing.applications.some((item) => item.tenantId === tenantId && item.status === "pending")) return failure("Já existe uma candidatura pendente.", "duplicate_application");
  const actor = resolveActor(ctx, state, tenantId);
  if (!actor) return failure("Locatário não encontrado.", "tenant_not_found");
  const family = actor.kind === "family" ? actor.entity : findFamilyForPerson(ctx, actor.entity);
  const income = family ? householdMonthlyIncome(ctx, family) : personMonthlyIncome(actor.entity);
  const monthlyDebt = Number(options.monthlyDebt || family?.monthlyDebt || 0);
  const ratio = income > 0 ? (listing.price + monthlyDebt) / income : 1;
  const creditScore = Number(options.creditScore || family?.creditScore || actor.entity.creditScore || 600);
  const application = {
    id: marketId(state, "rental-application"), tenantId, income: roundMoney(income), creditScore,
    affordabilityRatio: ratio, guarantorId: options.guarantorId || null,
    score: clamp(Math.round(creditScore * .09 + (1 - clamp(ratio, 0, 1)) * 40 + (options.guarantorId ? 8 : 0)), 0, 100),
    status: "pending", created: timeStamp(ctx),
  };
  listing.applications.push(application);
  return success({ state, listing, application });
}

export function approvePropertyRental(ctx, stateInput, listingId, applicationId, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const listing = state.realEstate.listings.find((item) => item.id === listingId && item.status === "active");
  const application = listing?.applications.find((item) => item.id === applicationId && item.status === "pending");
  if (!application) return failure("Candidatura pendente não encontrada.", "application_not_found");
  if (application.score < (options.minimumScore || 42) && !options.override) return failure("A candidatura não atingiu o critério de renda e crédito.", "application_denied");
  application.status = "approved";
  application.responded = timeStamp(ctx);
  listing.applications.filter((item) => item.id !== application.id && item.status === "pending").forEach((item) => { item.status = "rejected"; });
  const result = rentProperty(ctx, state, listingId, application.tenantId, options);
  if (!result.ok) application.status = "payment_failed";
  return result.ok ? success({ ...result, application }) : result;
}

export function cancelPropertyListing(ctx, stateInput, listingId, reason = "Anúncio retirado") {
  const state = ensureMarketsState(ctx, stateInput);
  const listing = state.realEstate.listings.find((item) => item.id === listingId);
  if (!listing || listing.status !== "active") return failure("Anúncio ativo não encontrado.", "listing_not_found");
  listing.status = "cancelled";
  listing.closeReason = reason;
  listing.closed = timeStamp(ctx);
  const building = findBuilding(ctx, listing.buildingId);
  if (building?.property) building.property.listingId = null;
  return success({ state, listing });
}

export function quoteMortgage(ctx, stateInput, buyerId, price, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const actor = resolveActor(ctx, state, buyerId);
  if (!actor) return failure("Comprador não encontrado.", "buyer_not_found");
  const family = actor.kind === "family" ? actor.entity : findFamilyForPerson(ctx, actor.entity);
  const creditScore = Number(options.creditScore || family?.creditScore || actor.entity.creditScore || 620);
  const downRate = clamp(Number(options.downPaymentRate ?? realEstateMarketRules.standardDownPayment), realEstateMarketRules.minimumDownPayment, .85);
  const months = clamp(Math.round(options.months || 240), 24, realEstateMarketRules.maximumMortgageMonths);
  const riskPremium = creditScore < 480 ? .07 : creditScore < 610 ? .035 : creditScore > 770 ? -.018 : 0;
  const annualRate = clamp(Number(options.annualRate ?? realEstateMarketRules.annualMortgageInterest) + riskPremium, .035, .28);
  const downPayment = roundMoney(price * downRate);
  const principal = roundMoney(price - downPayment);
  const monthlyRate = annualRate / 12;
  const monthlyPayment = roundMoney(principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / Math.max(.0001, Math.pow(1 + monthlyRate, months) - 1));
  const weeklyPayment = roundMoney(monthlyPayment * 12 / 52);
  const familyIncome = family ? householdMonthlyIncome(ctx, family) : personMonthlyIncome(actor.entity);
  const approved = creditScore >= 420
    && actorBalance(ctx, state, buyerId) >= downPayment
    && familyIncome > 0
    && monthlyPayment <= familyIncome * .34;
  return success({ approved, price: roundMoney(price), downPayment, principal, annualRate, months, monthlyPayment, weeklyPayment, creditScore });
}

function compatibleOwnerId(ctx, buyerId) {
  const family = findFamily(ctx, buyerId);
  if (!family) return buyerId;
  return asArray(family.memberIds).map((id) => findPerson(ctx, id)).find((person) => person?.alive !== false && person.age >= 18)?.id || family.memberIds?.[0] || buyerId;
}

export function assignPropertyOwner(ctx, building, ownerId) {
  if (!building) return false;
  const metadata = ensurePropertyMetadata(building);
  const family = findFamily(ctx, ownerId);
  building.ownerId = compatibleOwnerId(ctx, ownerId);
  building.ownerFamilyId = family?.id || findPerson(ctx, ownerId)?.familyId || null;
  metadata.ownerId = ownerId;
  metadata.ownerKind = family ? "family" : findBusiness(ctx, ownerId) ? "business" : ownerId === "municipality" ? "municipality" : "person";
  return true;
}

export function moveFamilyIntoProperty(ctx, familyId, buildingId, tenure = "owned") {
  const family = findFamily(ctx, familyId);
  const building = findBuilding(ctx, buildingId);
  if (!family || !building) return false;
  const metadata = ensurePropertyMetadata(building);
  const previous = findBuilding(ctx, family.homeId);
  const memberIds = householdMemberIds(ctx, family);
  const members = livingHouseholdMembers(ctx, family);
  if (!householdFitsProperty(ctx, family, building)) return false;
  const moved = Boolean(previous && previous.id !== building.id);
  const existingTargetHouseholds = asArray(ctx?.people)
    .filter((person) => person.alive !== false && person.homeId === building.id && !memberIds.has(person.id))
    .map((person) => person.householdId || person.familyId)
    .filter(Boolean);
  if (moved && previous.property) {
    const previousOccupants = asArray(previous.property.occupiedByIds).filter((id) => id !== family.id);
    if (previous.property.occupiedById && previous.property.occupiedById !== family.id) previousOccupants.unshift(previous.property.occupiedById);
    previous.property.occupiedByIds = [...new Set(previousOccupants)].slice(0, 240);
    if (previous.property.occupiedById === family.id) previous.property.occupiedById = previous.property.occupiedByIds[0] || null;
    previous.property.vacancyWeeks = previous.property.occupiedByIds.length ? 0 : previous.property.vacancyWeeks || 0;
  }
  family.homeId = building.id;
  family.tenure = tenure;
  family.memberIds = [...new Set([...asArray(family.memberIds), ...members.map((person) => person.id)])];
  members.forEach((person) => {
    const wasAtPreviousHome = moved && person.locationId === previous.id && !person.currentTrip;
    person.homeId = building.id;
    person.housing = tenure;
    if (wasAtPreviousHome) {
      person.locationId = building.id;
      person.x = Number(building.x || 0) + Number(building.w || 0) / 2;
      person.y = Number(building.y || 0) + Number(building.h || 0) / 2;
      person.destinationId = null;
      person.target = null;
      person.path = [];
      person.activity = "Em casa";
      person.currentAction = {
        ...(person.currentAction || {}),
        text: "Em casa",
        phase: "present",
        placeId: building.id,
        destinationId: null,
        mode: null,
        sinceWeek: ctx?.week || 1,
        sinceDay: ctx?.day || 0,
        sinceMinute: ctx?.minute || 0,
      };
    }
    if (moved) {
      person.history = asArray(person.history);
      pushHistory(person.history, {
        week: ctx?.week || 1,
        text: `Mudou-se para ${building.name}.`,
        placeIds: [building.id],
      }, MARKET_COLLECTION_LIMITS.actorHistory);
    }
  });
  metadata.occupiedByIds = [...new Set([
    metadata.occupiedById,
    ...asArray(metadata.occupiedByIds),
    ...existingTargetHouseholds,
    family.id,
  ].filter(Boolean))].slice(0, 240);
  metadata.occupiedById = metadata.occupiedByIds[0] || family.id;
  metadata.vacancyWeeks = 0;
  building.tenure = tenure;
  if (ctx?.housingSystem) {
    ctx.housingSystem.hotelGuests = asArray(ctx.housingSystem.hotelGuests).filter((id) => !memberIds.has(id));
    if (moved) ctx.housingSystem.moves = Math.max(0, Number(ctx.housingSystem.moves) || 0) + 1;
  }
  if (moved) {
    family.milestones = asArray(family.milestones);
    pushHistory(family.milestones, {
      week: ctx?.week || 1,
      text: `O domicílio mudou-se para ${building.name}.`,
      placeIds: [building.id],
    }, 120);
  }
  if (typeof ctx?.syncHousingOccupancy === "function") ctx.syncHousingOccupancy();
  else {
    if (previous) previous.occupied = asArray(ctx?.people).filter((person) => person.alive !== false && person.homeId === previous.id).length;
    building.occupied = asArray(ctx?.people).filter((person) => person.alive !== false && person.homeId === building.id).length;
  }
  return true;
}

export function purchaseProperty(ctx, stateInput, listingId, buyerId, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const listing = state.realEstate.listings.find((item) => item.id === listingId);
  if (!listing || listing.status !== "active" || listing.kind !== "sale") return failure("Anúncio de venda não encontrado.", "listing_not_found");
  if (listing.sellerId === buyerId) return failure("O proprietário não pode comprar o próprio imóvel.", "same_owner");
  if (listing.acceptedBuyerId && listing.acceptedBuyerId !== buyerId) return failure("O vendedor já aceitou a proposta de outro comprador.", "reserved_listing");
  const building = findBuilding(ctx, listing.buildingId);
  if (!building) return failure("Imóvel não encontrado.", "property_not_found");
  const family = findFamily(ctx, buyerId) || findFamilyForPerson(ctx, findPerson(ctx, buyerId));
  const residential = propertyCatalogEntry(building).use.startsWith("residencial");
  if (options.occupy !== false && family && residential && !householdCanTakeExclusivePossession(ctx, family, building))
    return failure("O imóvel não está vago ou não comporta todos os integrantes do domicílio.", "property_capacity");
  const price = roundMoney(listing.negotiable ? clamp(options.offer || listing.price, listing.price * .82, listing.price * 1.05) : listing.price);
  const agency = state.realEstate.agencies.find((item) => item.id === listing.agencyId);
  const commission = roundMoney(price * (agency?.saleCommission || .035));
  const transferTax = roundMoney(price * realEstateMarketRules.transferTaxRate);
  const registryFee = roundMoney(price * realEstateMarketRules.registryFeeRate);
  let mortgage = null;
  if (options.finance) {
    mortgage = quoteMortgage(ctx, state, buyerId, price + transferTax + registryFee, options.finance);
    if (!mortgage.ok || !mortgage.approved) return failure("Financiamento imobiliário não aprovado.", "mortgage_denied");
    if (!charge(ctx, state, buyerId, mortgage.downPayment)) return failure("Saldo insuficiente para a entrada.", "insufficient_funds");
  } else if (!charge(ctx, state, buyerId, price + transferTax + registryFee)) return failure("Saldo insuficiente para compra e documentação.", "insufficient_funds");
  credit(ctx, state, listing.sellerId, price - commission);
  if (agency) {
    agency.cash = roundMoney(agency.cash + commission);
    agency.sales++;
  }
  if (Number.isFinite(ctx?.money)) ctx.money = roundMoney(ctx.money + transferTax + registryFee);
  assignPropertyOwner(ctx, building, buyerId);
  building.value = price;
  const metadata = ensurePropertyMetadata(building);
  metadata.listingId = null;
  listing.status = "sold";
  listing.buyerId = buyerId;
  listing.finalPrice = price;
  listing.closed = timeStamp(ctx);
  const transaction = { id: marketId(state, "property-sale"), type: "sale", listingId, buildingId: building.id, sellerId: listing.sellerId, buyerId, price, commission, transferTax, registryFee, financed: Boolean(mortgage), ...timeStamp(ctx) };
  state.realEstate.transactions.unshift(transaction);
  state.realEstate.stats.sold++;
  state.realEstate.stats.commission = roundMoney(state.realEstate.stats.commission + commission);
  if (mortgage) {
    const contract = {
      id: marketId(state, "mortgage"), type: "mortgage", buildingId: building.id, debtorId: buyerId, lenderId: options.finance?.lenderId || "municipality",
      originalPrincipal: mortgage.principal, balance: mortgage.principal, annualRate: mortgage.annualRate,
      weeklyPayment: mortgage.weeklyPayment, months: mortgage.months, paid: 0, arrearsWeeks: 0,
      status: "active", started: timeStamp(ctx), history: [],
    };
    state.realEstate.contracts.unshift(contract);
    state.realEstate.stats.financed++;
    transaction.contractId = contract.id;
    metadata.mortgageContractId = contract.id;
  }
  if (options.occupy !== false && family && residential) moveFamilyIntoProperty(ctx, family.id, building.id, mortgage ? "mortgage" : "owned");
  emit(ctx, "mercado imobiliário", `${family ? `A família ${family.surname}` : "Um comprador"} adquiriu ${building.name}.`, "money");
  trimMarketCollections(state);
  return success({ state, transaction, building, contract: mortgage ? state.realEstate.contracts[0] : null });
}

export function rentProperty(ctx, stateInput, listingId, tenantId, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const listing = state.realEstate.listings.find((item) => item.id === listingId);
  if (!listing || listing.status !== "active" || listing.kind !== "rent") return failure("Anúncio de aluguel não encontrado.", "listing_not_found");
  const building = findBuilding(ctx, listing.buildingId);
  if (!building) return failure("Imóvel não encontrado.", "property_not_found");
  const family = findFamily(ctx, tenantId) || findFamilyForPerson(ctx, findPerson(ctx, tenantId));
  const residential = propertyCatalogEntry(building).use.startsWith("residencial");
  if (family && residential && !householdFitsProperty(ctx, family, building))
    return failure("O imóvel não está vago ou não comporta todos os integrantes do domicílio.", "property_capacity");
  const durationWeeks = Math.max(13, options.durationWeeks || realEstateMarketRules.defaultLeaseWeeks);
  const monthlyRent = roundMoney(listing.price);
  const weeklyRent = roundMoney(monthlyRent * 12 / 52);
  const deposit = roundMoney(options.deposit ?? monthlyRent * realEstateMarketRules.standardDepositMonths);
  if (!charge(ctx, state, tenantId, deposit + weeklyRent)) return failure("Saldo insuficiente para caução e primeiro aluguel.", "insufficient_funds");
  const agency = state.realEstate.agencies.find((item) => item.id === listing.agencyId);
  const initialCommission = roundMoney(monthlyRent * (agency?.rentCommission || .06));
  credit(ctx, state, listing.sellerId, weeklyRent - Math.min(weeklyRent, initialCommission));
  if (agency) {
    agency.cash = roundMoney(agency.cash + initialCommission);
    agency.leases++;
  }
  const contract = {
    id: marketId(state, "property-lease"), type: "lease", listingId, buildingId: building.id,
    landlordId: listing.sellerId, tenantId, monthlyRent, weeklyRent, deposit, durationWeeks,
    rentalUnit: listing.rentalUnit ? { ...listing.rentalUnit } : null,
    remainingWeeks: durationWeeks, annualAdjustment: .055, paid: weeklyRent, arrearsWeeks: 0,
    status: "active", started: timeStamp(ctx), history: [],
  };
  state.realEstate.contracts.unshift(contract);
  const transaction = {
    id: marketId(state, "property-lease-transaction"), type: "lease", listingId,
    buildingId: building.id, sellerId: listing.sellerId, tenantId, price: monthlyRent,
    commission: initialCommission, transferTax: 0, registryFee: 0, financed: false,
    contractId: contract.id, ...timeStamp(ctx),
  };
  state.realEstate.transactions.unshift(transaction);
  listing.status = "leased";
  listing.tenantId = tenantId;
  listing.contractId = contract.id;
  listing.closed = timeStamp(ctx);
  const metadata = ensurePropertyMetadata(building);
  metadata.listingId = null;
  metadata.leaseContractId = contract.id;
  metadata.leaseContractIds = [...new Set([contract.id, ...asArray(metadata.leaseContractIds)])].slice(0, 120);
  if (family && residential) moveFamilyIntoProperty(ctx, family.id, building.id, "rent");
  else {
    metadata.occupiedById ||= tenantId;
    metadata.occupiedByIds = [...new Set([...asArray(metadata.occupiedByIds), tenantId])].slice(0, 240);
  }
  state.realEstate.stats.leased++;
  state.realEstate.stats.commission = roundMoney(state.realEstate.stats.commission + initialCommission);
  trimMarketCollections(state);
  return success({ state, contract, transaction, building });
}

export function terminatePropertyLease(ctx, stateInput, contractId, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const contract = state.realEstate.contracts.find((item) => item.id === contractId && item.type === "lease");
  if (!contract || contract.status !== "active") return failure("Contrato de aluguel ativo não encontrado.", "contract_not_found");
  const building = findBuilding(ctx, contract.buildingId);
  const repairs = roundMoney(options.repairs || 0);
  const overdue = roundMoney(contract.arrearsWeeks * contract.weeklyRent);
  const refund = Math.max(0, roundMoney(contract.deposit - repairs - overdue));
  if (refund) credit(ctx, state, contract.tenantId, refund);
  if (repairs) credit(ctx, state, contract.landlordId, Math.min(contract.deposit, repairs));
  contract.status = options.evicted ? "evicted" : "completed";
  contract.ended = timeStamp(ctx);
  contract.depositRefund = refund;
  if (building) {
    const metadata = ensurePropertyMetadata(building);
    metadata.leaseContractIds = asArray(metadata.leaseContractIds).filter((id) => id !== contract.id);
    metadata.leaseContractId = metadata.leaseContractIds[0] || null;
    metadata.vacancyWeeks = 0;
    building.occupied = asArray(ctx?.people).filter((person) => person.alive !== false && person.homeId === building.id).length;
  }
  return success({ state, contract, refund });
}

function processRealEstateContracts(ctx, state) {
  state.realEstate.contracts.filter((contract) => contract.status === "active").forEach((contract) => {
    if (contract.type === "mortgage") {
      const interest = contract.balance * contract.annualRate / 52;
      if (charge(ctx, state, contract.debtorId, contract.weeklyPayment)) {
        contract.balance = roundMoney(Math.max(0, contract.balance - Math.max(0, contract.weeklyPayment - interest)));
        contract.paid = roundMoney(contract.paid + contract.weeklyPayment);
        contract.arrearsWeeks = 0;
        credit(ctx, state, contract.lenderId, contract.weeklyPayment);
        pushHistory(contract.history, { ...timeStamp(ctx), text: `Prestação imobiliária de R$ ${contract.weeklyPayment.toLocaleString("pt-BR")} paga.`, balance: contract.balance }, 120);
      } else {
        contract.arrearsWeeks++;
        pushHistory(contract.history, { ...timeStamp(ctx), text: `Prestação em atraso (${contract.arrearsWeeks} semana(s)).` }, 120);
      }
      if (contract.balance <= 1) {
        contract.status = "completed";
        contract.ended = timeStamp(ctx);
        const building = findBuilding(ctx, contract.buildingId);
        if (building?.property) building.property.mortgageContractId = null;
        pushHistory(contract.history, { ...timeStamp(ctx), text: "Financiamento imobiliário quitado." }, 120);
      } else if (contract.arrearsWeeks >= realEstateMarketRules.foreclosureArrearsWeeks) {
        contract.status = "foreclosed";
        contract.ended = timeStamp(ctx);
        const building = findBuilding(ctx, contract.buildingId);
        if (building) {
          assignPropertyOwner(ctx, building, contract.lenderId);
          if (building.property?.occupiedById) building.property.occupiedById = null;
          building.occupied = 0;
          createPropertyListing(ctx, state, building.id, { kind: "sale", sellerId: contract.lenderId, price: estimatePropertyValue(building, state) * .9 });
        }
        state.realEstate.stats.foreclosed++;
        pushHistory(contract.history, { ...timeStamp(ctx), text: "Imóvel retomado pelo credor após inadimplência prolongada." }, 120);
      }
      return;
    }
    if (charge(ctx, state, contract.tenantId, contract.weeklyRent)) {
      credit(ctx, state, contract.landlordId, contract.weeklyRent);
      contract.paid = roundMoney(contract.paid + contract.weeklyRent);
      contract.arrearsWeeks = 0;
      pushHistory(contract.history, { ...timeStamp(ctx), text: "Aluguel pago." }, 120);
    } else {
      contract.arrearsWeeks++;
      pushHistory(contract.history, { ...timeStamp(ctx), text: `Aluguel em atraso (${contract.arrearsWeeks} semana(s)).` }, 120);
    }
    contract.remainingWeeks--;
    if (contract.remainingWeeks <= 0) terminatePropertyLease(ctx, state, contract.id);
    else if (contract.arrearsWeeks >= 5) terminatePropertyLease(ctx, state, contract.id, { evicted: true });
  });
}

export function updateVacancyMetrics(ctx, stateInput) {
  const state = ensureMarketsState(ctx, stateInput);
  const marketable = asArray(ctx?.buildings).filter((building) => ["home", "shop"].includes(building.type));
  let vacant = 0;
  marketable.forEach((building, index) => {
    const metadata = ensurePropertyMetadata(building, index);
    if (!metadata.occupiedById && !(building.occupied > 0) && !building.businessId) {
      vacant++;
      metadata.vacancyWeeks++;
    } else metadata.vacancyWeeks = 0;
  });
  state.realEstate.vacancyRate = marketable.length ? vacant / marketable.length : 0;
  const saleListings = state.realEstate.listings.filter((item) => item.status === "active" && item.kind === "sale");
  const rentListings = state.realEstate.listings.filter((item) => item.status === "active" && item.kind === "rent");
  state.realEstate.averageSalePrice = saleListings.length ? Math.round(saleListings.reduce((sum, item) => sum + item.price, 0) / saleListings.length) : 0;
  state.realEstate.averageRent = rentListings.length ? Math.round(rentListings.reduce((sum, item) => sum + item.price, 0) / rentListings.length) : 0;
  return state.realEstate.vacancyRate;
}

export function tickRealEstateMarket(ctx, stateInput, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const weeks = Math.max(1, options.weeks || 1);
  for (let i = 0; i < weeks; i++) processRealEstateContracts(ctx, state);
  state.realEstate.listings.filter((item) => item.status === "active" && item.expiresWeek <= (ctx.week || 1)).forEach((item) => cancelPropertyListing(ctx, state, item.id, "Anúncio expirado"));
  const previousVacancy = state.realEstate.vacancyRate;
  updateVacancyMetrics(ctx, state);
  const population = asArray(ctx?.people).filter((person) => person.alive !== false).length;
  const homes = asArray(ctx?.buildings).filter((building) => building.type === "home").length;
  const pressure = homes ? population / homes : 4;
  const vacancyChange = previousVacancy - state.realEstate.vacancyRate;
  state.realEstate.priceIndex = clamp(state.realEstate.priceIndex * (1 + clamp((pressure - 3.5) * .0007 + vacancyChange * .015, -.008, .012) * weeks), 65, 220);
  state.realEstate.rentIndex = clamp(state.realEstate.rentIndex * (1 + clamp((.09 - state.realEstate.vacancyRate) * .008, -.006, .009) * weeks), 65, 230);
  state.realEstate.stats.listed = state.realEstate.listings.filter((item) => item.status === "active").length;
  return state;
}

function inferFamilyForBusiness(ctx, business) {
  return findFamily(ctx, business.ownerFamilyId) || findFamily(ctx, findPerson(ctx, business.ownerId)?.familyId);
}

export function initializeFamilyBusinessProfile(ctx, stateInput, businessId, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const business = findBusiness(ctx, businessId);
  if (!business) return failure("Estabelecimento não encontrado.", "business_not_found");
  const existing = state.familyBusiness.profiles.find((profile) => profile.businessId === businessId);
  if (existing) return success({ state, profile: existing });
  const family = findFamily(ctx, options.familyId) || inferFamilyForBusiness(ctx, business);
  const strategy = familyBusinessStrategies.find((item) => item.id === options.strategyId)
    || familyBusinessStrategies[Math.abs(String(family?.id || business.id).length + state.familyBusiness.profiles.length) % familyBusinessStrategies.length];
  const products = Object.values(business.products || {});
  const profile = {
    id: marketId(state, "family-business"), businessId, familyId: family?.id || null,
    founderId: business.ownerId || null, controllingOwnerId: business.ownerId || null,
    strategyId: strategy.id, generation: 1, familyControl: family ? 1 : 0,
    policies: {
      priceMultiplier: roundMoney(1 + strategy.priceBias), targetStockMultiplier: roundMoney(1 + strategy.stockBias),
      wageMultiplier: roundMoney(1 + strategy.wageBias), reinvestmentRate: strategy.id === "crescimento" ? .42 : .24,
      minimumCashReserve: Math.max(6000, Math.round((business.expenses || 4000) * 2.5)), familyHiringPreference: family ? .25 : 0,
    },
    objectives: [strategy.name, "Manter operação contínua", "Preservar caixa e reputação"],
    kpis: { weeklyRevenue: business.revenue || 0, weeklyExpenses: business.expenses || 0, margin: 0, stockCoverage: products.length ? products.reduce((sum, product) => sum + (product.stock || 0) / Math.max(1, product.target || 1), 0) / products.length : 1, staffing: 1, customerSatisfaction: business.serviceQuality || 65 },
    lastDecisionWeek: {}, successionPlan: null, decisionIds: [], history: [],
  };
  state.familyBusiness.profiles.push(profile);
  business.ownerFamilyId = family?.id || null;
  business.managementProfileId = profile.id;
  return success({ state, profile });
}

function updateBusinessKpis(ctx, business, profile) {
  const products = Object.values(business.products || {});
  const livingEmployees = asArray(business.employees).filter((id) => findPerson(ctx, id)?.alive !== false).length;
  const required = Math.max(1, business.minimumStaff || business.requiredRoles?.length || 1);
  profile.kpis = {
    weeklyRevenue: roundMoney(business.revenue || 0),
    weeklyExpenses: roundMoney(business.expenses || 0),
    margin: (business.revenue || 0) ? ((business.revenue || 0) - (business.expenses || 0)) / business.revenue : 0,
    stockCoverage: products.length ? products.reduce((sum, product) => sum + (product.stock || 0) / Math.max(1, product.target || 1), 0) / products.length : 1,
    staffing: livingEmployees / required,
    customerSatisfaction: clamp((business.serviceQuality || 65) * .55 + (business.reputation || 65) * .45, 0, 100),
  };
  return profile.kpis;
}

function rolePoolFor(business) {
  return professionsByBusinessType[business.sector]
    || professionsByBusinessType[Object.keys(professionsByBusinessType).find((key) => String(business.sector || "").includes(key))]
    || professionsByBusinessType["Comércio local"];
}

export function hireForFamilyBusiness(ctx, stateInput, businessId, count = 1, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const business = findBusiness(ctx, businessId);
  if (!business) return failure("Estabelecimento não encontrado.", "business_not_found");
  const profileResult = initializeFamilyBusinessProfile(ctx, state, businessId);
  const profile = profileResult.profile;
  const roles = rolePoolFor(business);
  const family = findFamily(ctx, profile.familyId);
  const candidates = asArray(ctx?.people)
    .filter((person) => person.alive !== false && person.age >= 18 && !person.justice?.incarcerated && !person.businessId)
    .sort((a, b) => {
      const familyA = family?.memberIds?.includes(a.id) ? profile.policies.familyHiringPreference : 0;
      const familyB = family?.memberIds?.includes(b.id) ? profile.policies.familyHiringPreference : 0;
      return (familyB + (b.education?.skills?.length || 0) * .03 + (b.traits?.responsibility || 0) * .002) - (familyA + (a.education?.skills?.length || 0) * .03 + (a.traits?.responsibility || 0) * .002);
    });
  const hired = [];
  for (let i = 0; i < Math.max(0, count) && candidates.length; i++) {
    const person = candidates.shift();
    const role = options.role || roles[(business.employees?.length || 0) % roles.length];
    person.role = role;
    person.workplace = business.name;
    person.businessId = business.id;
    business.employees = asArray(business.employees);
    business.employees.push(person.id);
    hired.push(person);
  }
  state.familyBusiness.stats.hires += hired.length;
  return success({ state, business, profile, hired });
}

export function makeFamilyBusinessDecision(ctx, stateInput, businessId, type, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const business = findBusiness(ctx, businessId);
  const definition = familyBusinessDecisionCatalog[type];
  if (!business) return failure("Estabelecimento não encontrado.", "business_not_found");
  if (!definition) return failure("Decisão administrativa desconhecida.", "decision_unknown");
  const profile = initializeFamilyBusinessProfile(ctx, state, businessId, options).profile;
  const since = (ctx.week || 1) - (profile.lastDecisionWeek[type] || -999);
  if (since < definition.cooldownWeeks) return failure(`A família precisa aguardar ${definition.cooldownWeeks - since} semana(s) para repetir esta decisão.`, "decision_cooldown");
  if ((business.cash || 0) < definition.minimumCash) return failure("Caixa insuficiente para esta decisão.", "insufficient_business_cash");
  const strategy = familyBusinessStrategies.find((item) => item.id === profile.strategyId) || familyBusinessStrategies[0];
  let cost = 0;
  let resultText = definition.name;
  if (type === "price_review") {
    const multiplier = clamp(Number(options.multiplier || (1 + strategy.priceBias * .35)), .88, 1.18);
    Object.values(business.products || {}).forEach((product) => { product.price = Math.max(1, roundMoney(product.price * multiplier)); });
    profile.policies.priceMultiplier = roundMoney(profile.policies.priceMultiplier * multiplier);
    resultText = `Preços ${multiplier >= 1 ? "reajustados" : "reduzidos"} em ${Math.abs((multiplier - 1) * 100).toFixed(1)}%.`;
  } else if (type === "restock") {
    let available = Math.max(0, (business.cash || 0) - profile.policies.minimumCashReserve);
    Object.values(business.products || {}).forEach((product) => {
      const target = Math.round((product.target || 20) * profile.policies.targetStockMultiplier);
      const units = Math.max(0, target - (product.stock || 0));
      const unitCost = (product.price || 10) * .48;
      const affordable = Math.min(units, Math.floor(available / Math.max(1, unitCost)));
      product.stock = (product.stock || 0) + affordable;
      cost += affordable * unitCost;
      available -= affordable * unitCost;
    });
    resultText = `Estoque reforçado por R$ ${Math.round(cost).toLocaleString("pt-BR")}.`;
  } else if (type === "cost_cut") {
    profile.policies.reinvestmentRate = Math.max(.08, profile.policies.reinvestmentRate - .05);
    business.expenses = roundMoney((business.expenses || 0) * .94);
    business.serviceQuality = clamp((business.serviceQuality || 65) - 2, 25, 100);
    resultText = "Custos operacionais reduzidos em 6%, com pequeno impacto no serviço.";
  } else if (type === "hiring") {
    const affordableCount = Math.max(0, Math.floor((business.cash || 0) / 650));
    const hired = hireForFamilyBusiness(ctx, state, businessId, Math.min(options.count || 1, affordableCount), options).hired;
    cost = hired.length * 650;
    resultText = hired.length ? `${hired.map((person) => person.name).join(", ")} contratado(s).` : "Não havia candidato disponível.";
  } else if (type === "training") {
    cost = Math.max(2500, asArray(business.employees).length * 420);
    if ((business.cash || 0) < cost) return failure("Caixa insuficiente para treinar toda a equipe.", "insufficient_business_cash");
    business.serviceQuality = clamp((business.serviceQuality || 65) + 6, 0, 100);
    business.reputation = clamp((business.reputation || 65) + 2, 0, 100);
    resultText = "Equipe treinada; atendimento e reputação melhoraram.";
  } else if (type === "marketing") {
    cost = options.budget || 3200;
    if ((business.cash || 0) < cost) return failure("Caixa insuficiente para a campanha planejada.", "insufficient_business_cash");
    business.reputation = clamp((business.reputation || 65) + 4, 0, 100);
    business.marketingBoostWeeks = 6;
    resultText = "Campanha local lançada por seis semanas.";
  } else if (["renovation", "branch", "relocate"].includes(type)) {
    cost = Number(options.budget || ({ renovation: 12000, branch: 45000, relocate: 18000 }[type]));
    if ((business.cash || 0) < cost) return failure("Caixa insuficiente para financiar o projeto.", "insufficient_business_cash");
    const project = {
      id: marketId(state, "business-project"), businessId, familyId: profile.familyId, type,
      budget: cost, progress: 0, durationWeeks: options.durationWeeks || ({ renovation: 8, branch: 18, relocate: 10 }[type]),
      status: "active", targetBuildingId: options.targetBuildingId || null, started: timeStamp(ctx), history: [],
    };
    state.familyBusiness.expansionProjects.push(project);
    resultText = `${definition.name} aprovada; conclusão prevista em ${project.durationWeeks} semanas.`;
  } else if (type === "succession") {
    const succession = planBusinessSuccession(ctx, state, businessId, options.successorId);
    if (!succession.ok) return succession;
    cost = 800;
    resultText = `Sucessão formalizada em favor de ${findPerson(ctx, succession.successorId)?.name || succession.successorId}.`;
  }
  business.cash = roundMoney(Math.max(0, (business.cash || 0) - cost));
  const decision = {
    id: marketId(state, "business-decision"), businessId, familyId: profile.familyId, type,
    name: definition.name, cost: roundMoney(cost), result: resultText, status: "executed", ...timeStamp(ctx),
  };
  state.familyBusiness.decisions.unshift(decision);
  profile.decisionIds.unshift(decision.id);
  profile.lastDecisionWeek[type] = ctx.week || 1;
  pushHistory(profile.history, { ...timeStamp(ctx), text: resultText, decisionId: decision.id }, 80);
  state.familyBusiness.stats.decisions++;
  emit(ctx, "negócios", `A família proprietária de ${business.name} decidiu: ${resultText}`, "money");
  return success({ state, business, profile, decision });
}

export function planBusinessSuccession(ctx, stateInput, businessId, successorId = null) {
  const state = ensureMarketsState(ctx, stateInput);
  const business = findBusiness(ctx, businessId);
  if (!business) return failure("Estabelecimento não encontrado.", "business_not_found");
  const profile = initializeFamilyBusinessProfile(ctx, state, businessId).profile;
  const family = findFamily(ctx, profile.familyId);
  const candidates = asArray(family?.memberIds)
    .map((id) => findPerson(ctx, id))
    .filter((person) => person?.alive !== false && person.age >= 18 && person.id !== business.ownerId)
    .sort((a, b) => (b.education?.skills?.length || 0) - (a.education?.skills?.length || 0) || b.age - a.age);
  const successor = findPerson(ctx, successorId) || candidates[0];
  if (!successor || (family && !family.memberIds.includes(successor.id))) return failure("Não há sucessor familiar elegível.", "successor_not_found");
  profile.successionPlan = { successorId: successor.id, approvedWeek: ctx.week || 1, status: "planned" };
  return success({ state, profile, successorId: successor.id });
}

export function executeBusinessSuccession(ctx, stateInput, businessId, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const business = findBusiness(ctx, businessId);
  if (!business) return failure("Estabelecimento não encontrado.", "business_not_found");
  const profile = initializeFamilyBusinessProfile(ctx, state, businessId).profile;
  const owner = findPerson(ctx, business.ownerId);
  if (owner && owner.alive !== false && !options.force) return failure("O titular atual ainda está apto; use force para antecipar a sucessão.", "owner_still_active");
  const planned = findPerson(ctx, profile.successionPlan?.successorId);
  const fallback = planned && planned.alive !== false ? null : planBusinessSuccession(ctx, state, businessId);
  const selectedId = planned && planned.alive !== false ? planned.id : fallback?.successorId;
  const successor = findPerson(ctx, selectedId);
  if (!successor) return failure("Não há sucessor disponível.", "successor_not_found");
  const formerOwnerId = business.ownerId;
  business.ownerId = successor.id;
  business.ownerFamilyId = successor.familyId || profile.familyId;
  profile.controllingOwnerId = successor.id;
  profile.generation++;
  profile.successionPlan = { successorId: successor.id, status: "completed", completedWeek: ctx.week || 1 };
  pushHistory(profile.history, { ...timeStamp(ctx), text: `${successor.name} assumiu a administração após ${findPerson(ctx, formerOwnerId)?.name || "o antigo titular"}.` });
  state.familyBusiness.stats.successions++;
  emit(ctx, "sucessão empresarial", `${successor.name} assumiu ${business.name}, mantendo o negócio na família.`, "social");
  return success({ state, business, profile, successor });
}

function automaticBusinessDecision(ctx, state, business, profile, rng) {
  const kpis = updateBusinessKpis(ctx, business, profile);
  if (kpis.staffing < 1) return ["hiring", { count: Math.ceil((business.minimumStaff || 1) * (1 - kpis.staffing)) }];
  if (kpis.stockCoverage < .58 && business.cash > 4000) return ["restock", {}];
  if (kpis.margin < -.05) return ["cost_cut", {}];
  if (kpis.customerSatisfaction < 55 && business.cash > 6000) return ["training", {}];
  if (kpis.margin > .22 && business.cash > 65000 && rng() < .08) return ["branch", {}];
  if (business.reputation < 58 && business.cash > 5000) return ["marketing", {}];
  if (rng() < .12) return ["price_review", {}];
  return null;
}

export function advanceBusinessProjects(ctx, stateInput, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const weeks = Math.max(1, options.weeks || 1);
  state.familyBusiness.expansionProjects.filter((project) => project.status === "active").forEach((project) => {
    project.progress = clamp(project.progress + weeks / project.durationWeeks, 0, 1);
    if (project.progress < 1) return;
    const business = findBusiness(ctx, project.businessId);
    project.status = "completed";
    project.completed = timeStamp(ctx);
    if (!business) return;
    if (project.type === "renovation") {
      business.serviceQuality = clamp((business.serviceQuality || 65) + 12, 0, 100);
      business.reputation = clamp((business.reputation || 65) + 5, 0, 100);
      business.capacity = Math.round((business.capacity || business.minimumStaff * 8 || 16) * 1.18);
    } else if (project.type === "relocate") {
      if (project.targetBuildingId && findBuilding(ctx, project.targetBuildingId)) business.buildingId = project.targetBuildingId;
      business.reputation = clamp((business.reputation || 65) + 3, 0, 100);
      options.hooks?.onBusinessRelocated?.({ ctx, state, business, project });
    } else if (project.type === "branch") {
      const created = options.hooks?.createBusinessBranch?.({ ctx, state, business, project });
      project.createdBusinessId = created?.id || null;
      state.familyBusiness.stats.branches++;
    }
    emit(ctx, "negócios", `${business.name} concluiu: ${familyBusinessDecisionCatalog[project.type]?.name || project.type}.`, "money");
  });
  return state;
}

export function tickFamilyBusinesses(ctx, stateInput, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const rng = options.rng || Math.random;
  const weeks = Math.max(1, options.weeks || 1);
  asArray(ctx?.businesses).filter((business) => !business.closed).forEach((business) => {
    const profile = initializeFamilyBusinessProfile(ctx, state, business.id).profile;
    updateBusinessKpis(ctx, business, profile);
    const owner = findPerson(ctx, business.ownerId);
    if (owner?.alive === false) executeBusinessSuccession(ctx, state, business.id);
    if (business.marketingBoostWeeks > 0) {
      business.marketingBoostWeeks = Math.max(0, business.marketingBoostWeeks - weeks);
      business.visits = Math.round((business.visits || 0) * 1.04);
    }
    if (options.automaticDecisions === false) return;
    const recommendation = automaticBusinessDecision(ctx, state, business, profile, rng);
    if (recommendation) makeFamilyBusinessDecision(ctx, state, business.id, recommendation[0], recommendation[1]);
  });
  advanceBusinessProjects(ctx, state, { weeks, hooks: options.hooks });
  return state;
}

export function seedMarketListings(ctx, stateInput, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const rng = options.rng || Math.random;
  const vehicleLimit = options.vehicleListings ?? Math.min(10, Math.floor(asArray(ctx?.vehicles).length * .18));
  asArray(ctx?.vehicles)
    .filter((vehicle) => vehicle.use === "private" && vehicle.status === "active" && !state.vehicle.listings.some((item) => item.vehicleId === vehicle.id && item.status === "active"))
    .sort(() => rng() - .5)
    .slice(0, vehicleLimit)
    .forEach((vehicle, index) => createVehicleListing(ctx, state, vehicle.id, { kind: index % 4 === 3 ? "rental" : "sale" }));
  const propertyLimit = options.propertyListings ?? Math.min(14, Math.floor(asArray(ctx?.buildings).filter((item) => item.type === "home").length * .22));
  const activePropertyIds = new Set(
    state.realEstate.listings.filter((listing) => listing.status === "active").map((listing) => listing.buildingId),
  );
  const propertyCandidates = asArray(ctx?.buildings)
    .filter((building) => ["home", "shop"].includes(building.type) && !building.businessId && !activePropertyIds.has(building.id))
    .sort(() => rng() - .5);
  if (propertyLimit > 0 && propertyCandidates.length) {
    const selected = new Set();
    const rentTarget = propertyLimit > 1 ? Math.max(1, Math.round(propertyLimit * 2 / 3)) : 0;
    const saleTarget = Math.max(1, propertyLimit - rentTarget);
    propertyCandidates
      .filter((building) => propertyRentalAvailability(ctx, building).rentable)
      .sort((left, right) => {
        const leftAvailability = propertyRentalAvailability(ctx, left);
        const rightAvailability = propertyRentalAvailability(ctx, right);
        return Number(rightAvailability.mode === "unit") - Number(leftAvailability.mode === "unit")
          || rightAvailability.availableCapacity - leftAvailability.availableCapacity;
      })
      .slice(0, rentTarget)
      .forEach((building) => {
        const result = createPropertyListing(ctx, state, building.id, { kind: "rent" });
        if (result.ok) selected.add(building.id);
      });
    propertyCandidates
      .filter((building) => !selected.has(building.id))
      .sort((left, right) => Number(Boolean(left.occupied)) - Number(Boolean(right.occupied)))
      .slice(0, saleTarget)
      .forEach((building) => {
        const result = createPropertyListing(ctx, state, building.id, { kind: "sale" });
        if (result.ok) selected.add(building.id);
      });
    if (selected.size < propertyLimit) {
      propertyCandidates
        .filter((building) => !selected.has(building.id))
        .slice(0, propertyLimit - selected.size)
        .forEach((building) => {
          const result = createPropertyListing(ctx, state, building.id, { kind: "sale" });
          if (result.ok) selected.add(building.id);
        });
    }
  }
  return state;
}

export function initializeMarkets(ctx, stateInput = null, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  asArray(ctx?.buildings).forEach((building, index) => ensurePropertyMetadata(building, index));
  asArray(ctx?.vehicles).forEach((vehicle) => {
    ensureVehicleRecord(vehicle);
    vehicle.originalPrice ||= vehicleCatalogEntry(vehicle).price;
  });
  asArray(ctx?.businesses).forEach((business) => initializeFamilyBusinessProfile(ctx, state, business.id));
  if (options.seedListings !== false && !state.vehicle.listings.length && !state.realEstate.listings.length) seedMarketListings(ctx, state, options);
  updateVacancyMetrics(ctx, state);
  return state;
}

export function tickMarkets(ctx, stateInput, options = {}) {
  const state = ensureMarketsState(ctx, stateInput);
  const requestedWeeks = Math.max(1, options.weeks || Math.max(1, (ctx.week || 1) - (state.lastTickWeek || ctx.week || 1)));
  tickVehicleMarket(ctx, state, { ...options, weeks: requestedWeeks });
  tickRealEstateMarket(ctx, state, { ...options, weeks: requestedWeeks });
  tickFamilyBusinesses(ctx, state, { ...options, weeks: requestedWeeks });
  state.lastTickWeek = ctx.week || state.lastTickWeek + requestedWeeks;
  return state;
}

export function getMarketSnapshot(ctx, stateInput) {
  const state = ensureMarketsState(ctx, stateInput);
  const vehicleListings = state.vehicle.listings.filter((item) => item.status === "active");
  const propertyListings = state.realEstate.listings.filter((item) => item.status === "active");
  const activeBusinessProjects = state.familyBusiness.expansionProjects.filter((item) => item.status === "active");
  return {
    vehicles: {
      listings: vehicleListings.length,
      forSale: vehicleListings.filter((item) => item.kind === "sale").length,
      forRent: vehicleListings.filter((item) => item.kind !== "sale").length,
      contracts: state.vehicle.contracts.filter((item) => item.status === "active").length,
      priceIndex: roundMoney(state.vehicle.priceIndex),
      demandIndex: roundMoney(state.vehicle.demandIndex),
      stats: { ...state.vehicle.stats },
    },
    properties: {
      listings: propertyListings.length,
      forSale: propertyListings.filter((item) => item.kind === "sale").length,
      forRent: propertyListings.filter((item) => item.kind === "rent").length,
      activeLeases: state.realEstate.contracts.filter((item) => item.type === "lease" && item.status === "active").length,
      activeMortgages: state.realEstate.contracts.filter((item) => item.type === "mortgage" && item.status === "active").length,
      vacancyRate: state.realEstate.vacancyRate,
      priceIndex: roundMoney(state.realEstate.priceIndex),
      rentIndex: roundMoney(state.realEstate.rentIndex),
      averageSalePrice: state.realEstate.averageSalePrice,
      averageRent: state.realEstate.averageRent,
      stats: { ...state.realEstate.stats },
    },
    familyBusinesses: {
      managed: state.familyBusiness.profiles.length,
      activeProjects: activeBusinessProjects.length,
      pendingSuccessions: state.familyBusiness.profiles.filter((item) => item.successionPlan?.status === "planned").length,
      stats: { ...state.familyBusiness.stats },
    },
  };
}

export const marketsApi = Object.freeze({
  createMarketsState,
  ensureMarketsState,
  initializeMarkets,
  tickMarkets,
  getMarketSnapshot,
  trimMarketCollections,
  personMonthlyIncome,
  householdMonthlyIncome,
  createVehicleListing,
  cancelVehicleListing,
  submitVehicleOffer,
  respondVehicleOffer,
  purchaseVehicle,
  rentVehicle,
  returnRentedVehicle,
  sellVehicleToDealership,
  quoteVehicleFinancing,
  createPropertyListing,
  cancelPropertyListing,
  submitPropertyOffer,
  respondPropertyOffer,
  applyForPropertyRental,
  approvePropertyRental,
  purchaseProperty,
  rentProperty,
  terminatePropertyLease,
  quoteMortgage,
  initializeFamilyBusinessProfile,
  makeFamilyBusinessDecision,
  planBusinessSuccession,
  executeBusinessSuccession,
  tickFamilyBusinesses,
});
