/**
 * Portal unificado do mercado imobiliário.
 *
 * `markets.realEstate` é o ledger transacional canônico. RealEstateDynamics
 * enriquece imóveis com avaliação, procura por bairro e projetos, mas seus
 * anúncios internos nunca são tratados como negociáveis por este módulo.
 */

import {
  actorBalance,
  householdMonthlyIncome,
  purchaseProperty,
  quoteMortgage,
  realEstateMarketRules,
  rentProperty,
  trimMarketCollections,
} from "./markets.js";

export const REAL_ESTATE_PORTAL_VERSION = 1;

export const REAL_ESTATE_PORTAL_LIMITS = Object.freeze({
  listings: 160,
  contracts: 100,
  transactions: 100,
  agencies: 24,
  districts: 32,
  projects: 60,
  priceHistory: 24,
  factors: 12,
  reasons: 12,
});

const asArray = (value) => (Array.isArray(value) ? value : []);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const money = (value) => Math.round(finite(value) * 100) / 100;
const clamp = (value, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, finite(value)));
const limited = (value, limit) => asArray(value).slice(0, Math.max(0, limit));
const normalized = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const addressSnapshot = (address) => address ? {
  streetId: address.streetId || null,
  street: address.street || null,
  number: address.number ?? null,
  district: address.district || null,
  postalCode: address.postalCode || null,
  accessSurface: address.accessSurface || null,
  label: [address.street, address.number].filter((value) => value !== null && value !== undefined && value !== "").join(", ") + (address.district ? ` · ${address.district}` : ""),
} : null;

function resolvePerson(sim, personInput) {
  const id = typeof personInput === "object" ? personInput?.id : personInput || sim?.playerId;
  return asArray(sim?.people).find((person) => person.id === id) || (personInput && typeof personInput === "object" ? personInput : null);
}

function resolveFamily(sim, person) {
  if (!person) return null;
  const directId = person.householdId || person.familyId;
  return asArray(sim?.families).find((family) => family.id === directId)
    || asArray(sim?.families).find((family) => asArray(family.memberIds).includes(person.id))
    || null;
}

function familyMembers(sim, family, person) {
  const ids = family
    ? new Set([...asArray(family.memberIds), person?.id].filter(Boolean))
    : new Set(person?.id ? [person.id] : []);
  return asArray(sim?.people).filter((candidate) => (
    ids.has(candidate.id)
      || (family && (candidate.householdId || candidate.familyId) === family.id)
  ) && candidate.alive !== false);
}

const buildingById = (sim, id) => sim?.buildingIndex?.get?.(id) || asArray(sim?.buildings).find((building) => building.id === id) || null;

function dynamicPropertyFor(sim, buildingId) {
  return asArray(sim?.realEstateDynamics?.properties).find((property) => property.buildingId === buildingId || property.id === buildingId) || null;
}

function districtMarketFor(sim, property, building) {
  const districtId = property?.districtId || building?.districtId;
  const district = sim?.realEstateDynamics?.districtMarkets?.[districtId] || null;
  const typeId = property?.typeId || building?.property?.typeId || building?.propertyTypeId;
  return { district, cell: district?.types?.[typeId] || null };
}

function actorContext(sim, personInput) {
  const person = resolvePerson(sim, personInput);
  const family = resolveFamily(sim, person);
  const members = familyMembers(sim, family, person);
  const actorId = family?.id || person?.id || null;
  const balance = actorId ? actorBalance(sim, sim?.markets, actorId) : 0;
  const monthlyIncome = actorId ? householdMonthlyIncome(sim, family || person) : 0;
  return {
    person,
    family,
    members,
    actorId,
    balance: money(balance),
    monthlyIncome: money(monthlyIncome),
    creditScore: finite(family?.creditScore ?? person?.creditScore, 620),
  };
}

function mortgageSnapshot(sim, actor, totalPrice, financeOptions = {}) {
  if (!actor.actorId) return null;
  const result = quoteMortgage(sim, sim.markets, actor.actorId, totalPrice, financeOptions);
  if (!result?.ok) return { approved: false, error: result?.error || "Não foi possível simular o financiamento." };
  return {
    approved: Boolean(result.approved),
    price: money(result.price),
    downPayment: money(result.downPayment),
    principal: money(result.principal),
    annualRate: finite(result.annualRate),
    months: finite(result.months),
    monthlyPayment: money(result.monthlyPayment),
    weeklyPayment: money(result.weeklyPayment),
    creditScore: finite(result.creditScore),
    incomeRatio: actor.monthlyIncome > 0 ? Math.round(result.monthlyPayment / actor.monthlyIncome * 1000) / 1000 : null,
  };
}

function listingCosts(sim, listing, actor) {
  const price = money(listing.price);
  if (listing.kind === "rent") {
    const deposit = money(price * realEstateMarketRules.standardDepositMonths);
    const firstWeeklyRent = money(price * 12 / 52);
    return {
      askingPrice: price,
      monthlyRent: price,
      deposit,
      firstWeeklyRent,
      upfrontTotal: money(deposit + firstWeeklyRent),
      transferTax: 0,
      registryFee: 0,
      cashTotal: 0,
      financing: null,
    };
  }
  const transferTax = money(price * realEstateMarketRules.transferTaxRate);
  const registryFee = money(price * realEstateMarketRules.registryFeeRate);
  const cashTotal = money(price + transferTax + registryFee);
  return {
    askingPrice: price,
    monthlyRent: 0,
    deposit: 0,
    firstWeeklyRent: 0,
    upfrontTotal: cashTotal,
    transferTax,
    registryFee,
    cashTotal,
    financing: mortgageSnapshot(sim, actor, cashTotal, {
      downPaymentRate: realEstateMarketRules.standardDownPayment,
      months: 240,
    }),
  };
}

function listingAccessibility(listing, building, costs, actor) {
  if (!actor.person) return {
    mode: "observer",
    eligible: false,
    canPayCash: false,
    canFinance: false,
    canRent: false,
    canOccupy: false,
    transactionMode: "observer",
    occupancyMode: "observer",
    reasons: ["Selecione uma pessoa para avaliar renda, crédito e capacidade familiar."],
  };
  const reasons = [];
  const familySize = Math.max(1, actor.members.length);
  const currentFamilyResidents = actor.members.filter((member) => member.homeId === building?.id).length;
  const actorRefs = new Set([actor.actorId, actor.family?.id, actor.person.id, ...actor.members.map((member) => member.id)].filter(Boolean));
  const otherOccupancyRefs = [...new Set([
    building?.property?.occupiedById,
    ...asArray(building?.property?.occupiedByIds),
  ].filter((occupantId) => occupantId && !actorRefs.has(occupantId)))];
  const reportedOtherResidents = Math.max(0, finite(building?.occupied) - currentFamilyResidents);
  const occupiedByOther = reportedOtherResidents > 0
    || otherOccupancyRefs.length > 0
    || (Boolean(listing.occupied) && currentFamilyResidents === 0);
  const otherResidentLoad = Math.max(reportedOtherResidents, otherOccupancyRefs.length, Number(occupiedByOther));
  const capacityAllows = !building || !Number.isFinite(Number(building.capacity))
    || otherResidentLoad + familySize <= Number(building.capacity);
  const listedUnitCapacity = Number(listing.rentalUnit?.capacity);
  const unitAllows = listing.kind !== "rent" || !Number.isFinite(listedUnitCapacity) || listedUnitCapacity <= 0 || familySize <= listedUnitCapacity;
  const canOccupy = capacityAllows && unitAllows && (listing.kind === "rent" || !occupiedByOther);
  if (actor.person.alive === false) reasons.push("A pessoa selecionada não está viva.");
  if (finite(actor.person.age) < 18) reasons.push("É necessário ser maior de idade.");
  if ([actor.actorId, actor.family?.id, actor.person.id, ...actor.members.map((member) => member.id)].includes(listing.sellerId)) reasons.push("O imóvel pertence ao próprio domicílio.");
  if (listing.kind === "rent" && !canOccupy) reasons.push("O imóvel não está vago ou não comporta todo o domicílio.");
  if (listing.status !== "active") reasons.push("O anúncio não está mais ativo.");
  if (listing.kind === "rent") {
    const incomeRatio = actor.monthlyIncome > 0 ? costs.monthlyRent / actor.monthlyIncome : Number.POSITIVE_INFINITY;
    const assetFallback = actor.balance >= costs.monthlyRent * 12;
    const canRent = actor.balance >= costs.upfrontTotal && (incomeRatio <= .38 || assetFallback) && actor.creditScore >= 390 && !reasons.length;
    if (actor.balance < costs.upfrontTotal) reasons.push("Saldo insuficiente para caução e primeiro aluguel.");
    if (incomeRatio > .38 && !assetFallback) reasons.push("O aluguel compromete mais de 38% da renda familiar.");
    if (actor.creditScore < 390) reasons.push("Pontuação de crédito abaixo do mínimo para locação.");
    return {
      mode: "player",
      eligible: canRent,
      canPayCash: false,
      canFinance: false,
      canRent,
      reasons: [...new Set(reasons)].slice(0, 8),
      familySize,
      balance: actor.balance,
      monthlyIncome: actor.monthlyIncome,
      creditScore: actor.creditScore,
      housingCostRatio: Number.isFinite(incomeRatio) ? Math.round(incomeRatio * 1000) / 1000 : null,
      canOccupy,
      transactionMode: "residence",
      occupancyMode: listing.rentalUnit?.mode || "whole_property",
    };
  }
  const canPayCash = actor.balance >= costs.cashTotal && !reasons.length;
  const canFinance = Boolean(costs.financing?.approved) && !reasons.length;
  if (!canPayCash && !canFinance) reasons.push("O domicílio não possui caixa ou financiamento aprovado para esta compra.");
  return {
    mode: "player",
    eligible: canPayCash || canFinance,
    canPayCash,
    canFinance,
    canRent: false,
    reasons: [...new Set(reasons)].slice(0, 8),
    familySize,
    balance: actor.balance,
    monthlyIncome: actor.monthlyIncome,
    creditScore: actor.creditScore,
    housingCostRatio: costs.financing?.incomeRatio ?? null,
    canOccupy,
    transactionMode: canOccupy ? "residence" : "investment",
    occupancyMode: canOccupy ? "exclusive" : "investment",
  };
}

function valuationSnapshot(dynamicProperty, building) {
  const valuation = dynamicProperty?.valuation || building?.marketValuation || {};
  return {
    evaluatedWeek: valuation.evaluatedWeek ?? building?.marketValuation?.week ?? null,
    saleValue: money(dynamicProperty?.currentValue ?? valuation.saleValue ?? building?.marketValuation?.sale ?? building?.value),
    monthlyRent: money(dynamicProperty?.estimatedRent ?? valuation.monthlyRent ?? building?.marketValuation?.rent ?? building?.rent),
    pricePerSquareMeter: money(valuation.pricePerSqm ?? valuation.pricePerSquareMeter ?? building?.marketValuation?.pricePerSquareMeter),
    confidence: finite(valuation.confidence),
    components: valuation.components ? {
      land: money(valuation.components.land),
      construction: money(valuation.components.construction),
      amenities: money(valuation.components.amenities),
    } : null,
    factors: Object.fromEntries(Object.entries(valuation.factors || {}).slice(0, REAL_ESTATE_PORTAL_LIMITS.factors)),
    reasons: limited(valuation.reasons || building?.marketValuation?.factors, REAL_ESTATE_PORTAL_LIMITS.reasons),
  };
}

function listingSnapshot(sim, listing, actor, agencies) {
  const building = buildingById(sim, listing.buildingId);
  const dynamicProperty = dynamicPropertyFor(sim, listing.buildingId);
  const { district, cell } = districtMarketFor(sim, dynamicProperty, building);
  const agency = agencies.get(listing.agencyId);
  const costs = listingCosts(sim, listing, actor);
  return {
    id: listing.id,
    ledger: "markets.realEstate",
    status: listing.status,
    kind: listing.kind,
    buildingId: listing.buildingId,
    name: building?.name || dynamicProperty?.name || "Imóvel",
    typeId: dynamicProperty?.typeId || building?.property?.typeId || building?.propertyTypeId || "property",
    use: dynamicProperty?.use || null,
    districtId: dynamicProperty?.districtId || building?.districtId || null,
    address: addressSnapshot(building?.address || dynamicProperty?.address),
    coordinates: building ? { x: finite(building.x) + finite(building.w) / 2, y: finite(building.y) + finite(building.h) / 2 } : null,
    capacity: finite(building?.capacity ?? dynamicProperty?.capacity),
    occupied: finite(building?.occupied ?? dynamicProperty?.residentCount),
    units: finite(dynamicProperty?.units ?? building?.units, 1),
    vacantUnits: listing.kind === "rent"
      ? Math.max(
        finite(dynamicProperty?.vacantUnits),
        finite(listing.rentalUnit?.availableUnitsAtListing, Math.max(0, 1 - Number(Boolean(building?.occupied)))),
      )
      : finite(dynamicProperty?.vacantUnits, Math.max(0, 1 - Number(Boolean(building?.occupied)))),
    rentalUnit: listing.kind === "rent" ? {
      mode: listing.rentalUnit?.mode || (finite(building?.occupied) > 0 ? "shared_unit" : "whole_property"),
      capacity: finite(listing.rentalUnit?.capacity, Math.max(0, finite(building?.capacity) - finite(building?.occupied))),
      availableCapacityAtListing: finite(listing.rentalUnit?.availableCapacityAtListing),
      availableUnitsAtListing: finite(listing.rentalUnit?.availableUnitsAtListing, 1),
      totalUnits: finite(listing.rentalUnit?.totalUnits, finite(dynamicProperty?.units, 1)),
      shared: Boolean(listing.rentalUnit?.shared ?? finite(building?.occupied) > 0),
    } : null,
    sellerId: listing.sellerId || null,
    agency: agency ? { id: agency.id, name: agency.name, reputation: finite(agency.reputation), saleCommission: finite(agency.saleCommission), rentCommission: finite(agency.rentCommission) } : null,
    negotiable: listing.negotiable !== false,
    furnished: Boolean(listing.furnished || building?.property?.furnished),
    created: listing.created ? { ...listing.created } : null,
    expiresWeek: listing.expiresWeek ?? null,
    views: finite(listing.views),
    offers: asArray(listing.offers).length,
    applications: asArray(listing.applications).length,
    valuation: valuationSnapshot(dynamicProperty, building),
    demand: {
      districtName: district?.name || building?.address?.district || null,
      priceIndex: finite(cell?.priceIndex, finite(district?.priceIndex, 100)),
      rentIndex: finite(cell?.rentIndex, finite(district?.rentIndex, 100)),
      pressure: finite(cell?.pressure, 1),
      vacancyRate: finite(cell?.vacancyRate, finite(district?.vacancyRate)),
      weeksOfSupply: finite(cell?.weeksOfSupply),
      demand: finite(cell?.demand),
    },
    costs,
    accessibility: listingAccessibility(listing, building, costs, actor),
    priceHistory: limited(listing.priceHistory, REAL_ESTATE_PORTAL_LIMITS.priceHistory).map((entry) => ({ ...entry })),
  };
}

const referencesForActor = (actor) => new Set([
  actor.actorId,
  actor.person?.id,
  actor.family?.id,
  ...actor.members.map((member) => member.id),
].filter(Boolean));

function contractSnapshot(contract, sim) {
  const building = buildingById(sim, contract.buildingId);
  return {
    id: contract.id,
    type: contract.type,
    status: contract.status,
    buildingId: contract.buildingId,
    buildingName: building?.name || "Imóvel",
    debtorId: contract.debtorId || null,
    lenderId: contract.lenderId || null,
    landlordId: contract.landlordId || null,
    tenantId: contract.tenantId || null,
    balance: money(contract.balance),
    monthlyRent: money(contract.monthlyRent),
    weeklyPayment: money(contract.weeklyPayment ?? contract.weeklyRent),
    deposit: money(contract.deposit),
    paid: money(contract.paid),
    arrearsWeeks: finite(contract.arrearsWeeks),
    remainingWeeks: contract.remainingWeeks ?? null,
    annualRate: finite(contract.annualRate),
    started: contract.started ? { ...contract.started } : null,
    ended: contract.ended ? { ...contract.ended } : null,
    history: limited(contract.history, 20).map((entry) => ({ ...entry })),
    rentalUnit: contract.rentalUnit ? { ...contract.rentalUnit } : null,
  };
}

function transactionSnapshot(transaction, sim) {
  const building = buildingById(sim, transaction.buildingId);
  return {
    id: transaction.id,
    type: transaction.type,
    listingId: transaction.listingId || null,
    buildingId: transaction.buildingId,
    buildingName: building?.name || "Imóvel",
    sellerId: transaction.sellerId || null,
    buyerId: transaction.buyerId || null,
    tenantId: transaction.tenantId || null,
    price: money(transaction.price),
    commission: money(transaction.commission),
    transferTax: money(transaction.transferTax),
    registryFee: money(transaction.registryFee),
    financed: Boolean(transaction.financed),
    contractId: transaction.contractId || null,
    week: transaction.week ?? transaction.created?.week ?? null,
    day: transaction.day ?? transaction.created?.day ?? null,
    minute: transaction.minute ?? transaction.created?.minute ?? null,
  };
}

export function getRealEstatePortal(sim, personInput = null) {
  const realEstate = sim?.markets?.realEstate;
  const dynamics = sim?.realEstateDynamics || {};
  const actor = actorContext(sim, personInput);
  if (!realEstate) return {
    version: REAL_ESTATE_PORTAL_VERSION,
    ok: false,
    error: "O mercado imobiliário ainda não foi inicializado.",
    actor: null,
    listings: [],
    contracts: [],
    transactions: [],
    agencies: [],
    districts: [],
    projects: [],
  };
  const agencies = new Map(asArray(realEstate.agencies).map((agency) => [agency.id, agency]));
  const actorRefs = referencesForActor(actor);
  const activeListings = asArray(realEstate.listings).filter((listing) => listing.status === "active");
  const listings = activeListings
    .map((listing) => listingSnapshot(sim, listing, actor, agencies))
    .sort((left, right) => Number(right.accessibility.eligible) - Number(left.accessibility.eligible) || right.demand.pressure - left.demand.pressure || left.costs.askingPrice - right.costs.askingPrice)
    .slice(0, REAL_ESTATE_PORTAL_LIMITS.listings);
  const relevantContract = (contract) => !actorRefs.size || [contract.debtorId, contract.lenderId, contract.landlordId, contract.tenantId].some((id) => actorRefs.has(id));
  const relevantTransaction = (transaction) => !actorRefs.size || [transaction.sellerId, transaction.buyerId, transaction.tenantId].some((id) => actorRefs.has(id));
  const contracts = asArray(realEstate.contracts).filter(relevantContract).slice(0, REAL_ESTATE_PORTAL_LIMITS.contracts).map((contract) => contractSnapshot(contract, sim));
  const transactions = asArray(realEstate.transactions).filter(relevantTransaction).slice(0, REAL_ESTATE_PORTAL_LIMITS.transactions).map((transaction) => transactionSnapshot(transaction, sim));
  const dynamicsAgencies = new Map(asArray(dynamics.agencies).map((agency) => [agency.id, agency]));
  const agencySnapshots = limited(realEstate.agencies, REAL_ESTATE_PORTAL_LIMITS.agencies).map((agency) => {
    const analytical = dynamicsAgencies.get(agency.id);
    return {
      id: agency.id,
      name: agency.name,
      reputation: finite(agency.reputation),
      activeListings: activeListings.filter((listing) => listing.agencyId === agency.id).length,
      portfolioSize: asArray(agency.portfolioIds).length,
      sales: finite(agency.sales),
      leases: finite(agency.leases),
      cash: money(agency.cash),
      commissionRevenue: money(analytical?.revenue),
      inquiries: finite(analytical?.inquiries),
    };
  });
  const districtSnapshots = Object.values(dynamics.districtMarkets || {}).slice(0, REAL_ESTATE_PORTAL_LIMITS.districts).map((district) => {
    const strongest = Object.values(district.types || {}).sort((left, right) => finite(right.pressure) - finite(left.pressure))[0];
    return {
      id: district.districtId,
      name: district.name,
      priceIndex: finite(district.priceIndex, 100),
      rentIndex: finite(district.rentIndex, 100),
      vacancyRate: finite(district.vacancyRate),
      stockUnits: finite(district.stockUnits),
      occupiedUnits: finite(district.occupiedUnits),
      vacantUnits: finite(district.vacantUnits),
      demand: finite(district.demand),
      strongestDemandType: strongest?.typeId || null,
      pressure: finite(strongest?.pressure, 1),
    };
  });
  const developers = new Map(asArray(dynamics.developers).map((developer) => [developer.id, developer]));
  const projects = asArray(dynamics.projects)
    .filter((project) => !["cancelled", "archived"].includes(project.status))
    .slice(0, REAL_ESTATE_PORTAL_LIMITS.projects)
    .map((project) => {
      const developer = developers.get(project.developerId);
      const phase = asArray(project.phases)[project.phaseIndex];
      return {
        id: project.id,
        name: project.name,
        status: project.status,
        developer: developer ? { id: developer.id, name: developer.name, reputation: finite(developer.reputation) } : null,
        districtId: project.districtId || null,
        lotId: project.lotId || null,
        typeId: project.typeId,
        units: finite(project.units),
        capacity: finite(project.capacity),
        phase: phase ? { id: phase.id, label: phase.label, progress: finite(phase.progress) } : null,
        progress: finite(project.progress),
        remainingWeeks: finite(project.remainingWeeks),
        totalCost: money(project.totalCost),
        spent: money(project.spent),
        projectedValue: money(project.projectedValue),
      };
    });
  const ownedBuildings = actorRefs.size ? asArray(sim?.buildings).filter((building) => actorRefs.has(building.ownerId) || actorRefs.has(building.ownerFamilyId) || actorRefs.has(building.property?.ownerId)).slice(0, 80).map((building) => ({
    buildingId: building.id,
    name: building.name,
    address: addressSnapshot(building.address),
    value: money(building.value),
    rent: money(building.rent),
    occupied: finite(building.occupied),
  })) : [];
  return {
    version: REAL_ESTATE_PORTAL_VERSION,
    ok: true,
    generatedAt: { week: finite(sim?.week, 1), day: finite(sim?.day), minute: finite(sim?.minute) },
    canonicalLedger: "markets.realEstate",
    actor: actor.person ? {
      personId: actor.person.id,
      name: actor.person.name,
      familyId: actor.family?.id || null,
      familyName: actor.family?.surname || actor.family?.name || null,
      actorId: actor.actorId,
      householdSize: actor.members.length,
      balance: actor.balance,
      monthlyIncome: actor.monthlyIncome,
      creditScore: actor.creditScore,
      currentHomeId: actor.family?.homeId || actor.person.homeId || null,
      tenure: actor.family?.tenure || actor.person.housing || null,
    } : null,
    market: {
      activeListings: activeListings.length,
      forSale: activeListings.filter((listing) => listing.kind === "sale").length,
      forRent: activeListings.filter((listing) => listing.kind === "rent").length,
      priceIndex: finite(realEstate.priceIndex, 100),
      rentIndex: finite(realEstate.rentIndex, 100),
      vacancyRate: finite(realEstate.vacancyRate),
      averageSalePrice: money(realEstate.averageSalePrice),
      averageRent: money(realEstate.averageRent),
      transactionStats: { ...(realEstate.stats || {}) },
      analyticalPriceIndex: finite(dynamics.cityMarket?.priceIndex, 100),
      analyticalRentIndex: finite(dynamics.cityMarket?.rentIndex, 100),
      analyticalDemand: finite(dynamics.cityMarket?.demand),
      analyticalSupply: finite(dynamics.cityMarket?.supply),
    },
    listings,
    contracts,
    transactions,
    ownedBuildings,
    agencies: agencySnapshots,
    districts: districtSnapshots,
    projects,
  };
}

const normalizeOperation = (operation, listing) => {
  const value = normalized(operation || listing?.kind);
  if (["rent", "lease", "alugar", "aluguel", "locar", "locacao"].includes(value)) return "rent";
  if (["buy", "purchase", "sale", "comprar", "compra", "financiar", "mortgage"].includes(value)) return "buy";
  return listing?.kind === "rent" ? "rent" : "buy";
};

function synchronizeAnalyticalOccupancy(sim, building, family, operation) {
  if (!building || !sim?.realEstateDynamics) return;
  const property = dynamicPropertyFor(sim, building.id);
  if (!property) return;
  const residents = asArray(sim.people).filter((person) => person.alive !== false && person.homeId === building.id);
  const householdIds = [...new Set(residents.map((person) => person.householdId || person.familyId).filter(Boolean))];
  property.residentCount = residents.length;
  property.occupiedUnits = Math.min(Math.max(1, finite(property.units, 1)), householdIds.length || Number(Boolean(residents.length)));
  property.vacantUnits = Math.max(0, finite(property.units, 1) - property.occupiedUnits);
  property.occupiedByIds = householdIds.slice(0, 240);
  property.status = residents.length ? "occupied" : "vacant";
  property.vacancyWeeks = residents.length ? 0 : finite(property.vacancyWeeks);
  property.lastOccupancyWeek = finite(sim.week, 1);
  if (operation === "buy" && family) {
    property.ownerId = family.id;
    property.ownerKind = "family";
  }
}

export function executePlayerPropertyTransaction(sim, personInput, listingId, operation, options = {}) {
  if (!sim?.markets?.realEstate) return { ok: false, code: "market_unavailable", error: "O mercado imobiliário não foi inicializado." };
  const actor = actorContext(sim, personInput);
  if (!actor.person) return { ok: false, code: "person_not_found", error: "Pessoa jogável não encontrada." };
  if (!actor.actorId) return { ok: false, code: "household_not_found", error: "O domicílio da pessoa não foi encontrado." };
  if (actor.person.alive === false || finite(actor.person.age) < 18) return { ok: false, code: "person_ineligible", error: "A pessoa precisa estar viva e ser maior de idade." };
  const listing = asArray(sim.markets.realEstate.listings).find((candidate) => candidate.id === listingId);
  if (!listing || listing.status !== "active") return { ok: false, code: "listing_not_found", error: "Anúncio imobiliário ativo não encontrado." };
  const normalizedOperation = normalizeOperation(operation, listing);
  if (normalizedOperation === "buy" && listing.kind !== "sale") return { ok: false, code: "operation_mismatch", error: "Este anúncio está disponível apenas para aluguel." };
  if (normalizedOperation === "rent" && listing.kind !== "rent") return { ok: false, code: "operation_mismatch", error: "Este anúncio está disponível apenas para venda." };
  const portalListing = getRealEstatePortal(sim, actor.person).listings.find((candidate) => candidate.id === listingId);
  if (!portalListing) return { ok: false, code: "listing_unavailable", error: "O imóvel não pôde ser avaliado para este domicílio." };
  if (normalizedOperation === "rent" && !portalListing.accessibility.canRent) return {
    ok: false,
    code: "rental_inaccessible",
    error: portalListing.accessibility.reasons[0] || "O domicílio não atende aos critérios desta locação.",
    accessibility: portalListing.accessibility,
  };
  let result;
  if (normalizedOperation === "buy") {
    const financeRequested = options.finance !== false;
    const householdOwnerIds = new Set([
      actor.actorId,
      actor.family?.id,
      actor.person.id,
      ...actor.members.map((member) => member.id),
    ].filter(Boolean));
    if (householdOwnerIds.has(listing.sellerId)) return {
      ok: false,
      code: "same_owner",
      error: "O domicílio não pode comprar o próprio imóvel.",
      accessibility: portalListing.accessibility,
    };
    const occupy = options.occupy === undefined
      ? Boolean(portalListing.accessibility.canOccupy)
      : Boolean(options.occupy);
    if (occupy && !portalListing.accessibility.canOccupy) return {
      ok: false,
      code: "occupancy_unavailable",
      error: "O imóvel não está vago ou não comporta todo o domicílio. Compre-o como investimento ou escolha outro imóvel.",
      accessibility: portalListing.accessibility,
    };
    const askingPrice = Math.max(0, finite(listing.price));
    const offeredPrice = listing.negotiable
      ? Math.max(askingPrice * .82, Math.min(askingPrice * 1.05, finite(options.offer, askingPrice)))
      : askingPrice;
    const transactionTotal = money(offeredPrice
      * (1 + realEstateMarketRules.transferTaxRate + realEstateMarketRules.registryFeeRate));
    const finance = financeRequested ? {
      downPaymentRate: realEstateMarketRules.standardDownPayment,
      months: 240,
      ...(typeof options.finance === "object" ? options.finance : {}),
    } : null;
    if (financeRequested) {
      const mortgage = quoteMortgage(sim, sim.markets, actor.actorId, transactionTotal, finance);
      if (!mortgage?.ok || !mortgage.approved) return {
        ok: false,
        code: "mortgage_inaccessible",
        error: "O financiamento não foi aprovado com a entrada e o prazo escolhidos.",
        accessibility: portalListing.accessibility,
        mortgage: mortgage?.ok ? {
          approved: false,
          downPayment: mortgage.downPayment,
          monthlyPayment: mortgage.monthlyPayment,
          annualRate: mortgage.annualRate,
          months: mortgage.months,
          creditScore: mortgage.creditScore,
        } : null,
      };
    }
    if (!financeRequested && actor.balance < transactionTotal) return {
      ok: false,
      code: "cash_inaccessible",
      error: "Saldo insuficiente para compra à vista, impostos e registro.",
      accessibility: portalListing.accessibility,
    };
    result = purchaseProperty(sim, sim.markets, listingId, actor.actorId, {
      offer: options.offer,
      finance,
      occupy,
    });
  } else {
    result = rentProperty(sim, sim.markets, listingId, actor.actorId, {
      durationWeeks: options.durationWeeks,
      deposit: options.deposit,
    });
  }
  if (!result?.ok) return {
    ok: false,
    code: result?.code || "transaction_failed",
    error: result?.error || "A transação imobiliária não foi concluída.",
  };
  sim.markets = trimMarketCollections(result.state || sim.markets);
  if (normalizedOperation === "rent" && result.building && result.contract) result.building.rent = money(result.contract.monthlyRent);
  if (typeof sim.syncHousingOccupancy === "function") sim.syncHousingOccupancy();
  synchronizeAnalyticalOccupancy(sim, result.building, actor.family, normalizedOperation);
  return {
    ok: true,
    operation: normalizedOperation,
    personId: actor.person.id,
    familyId: actor.family?.id || null,
    actorId: actor.actorId,
    listingId,
    buildingId: result.building?.id || listing.buildingId,
    transaction: result.transaction ? transactionSnapshot(result.transaction, sim) : null,
    contract: result.contract ? contractSnapshot(result.contract, sim) : null,
    portal: getRealEstatePortal(sim, actor.person),
  };
}

export const realEstateCoordinatorApi = Object.freeze({
  getRealEstatePortal,
  executePlayerPropertyTransaction,
});
