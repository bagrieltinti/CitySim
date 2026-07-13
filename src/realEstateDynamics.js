/**
 * RealEstateDynamics
 *
 * Motor puro e serializável para estoque imobiliário, procura habitacional,
 * preços por micromercado e incorporação urbana. O módulo aceita snapshots da
 * simulação, mas nunca altera o estado ou o snapshot recebidos.
 */

export const REAL_ESTATE_DYNAMICS_VERSION = 1;

export const REAL_ESTATE_PROPERTY_TYPES = Object.freeze({
  HOUSE: "casa",
  APARTMENT: "apartamento",
  RESIDENTIAL_BUILDING: "predio_residencial",
  GATED_COMMUNITY: "condominio_fechado",
  LOT: "lote",
  COMMERCIAL: "comercial",
  MIXED_USE: "misto",
});

export const REAL_ESTATE_PROPERTY_CATALOG = Object.freeze([
  Object.freeze({ id: "casa", label: "Casa", use: "residential", buildingType: "home", baseConstructionSqm: 3900, baseLandSqm: 1550, rentYield: .0055, typicalCapacity: 5, typicalUnits: 1, minimumArea: 42, amenitySensitivity: 1 }),
  Object.freeze({ id: "apartamento", label: "Apartamento", use: "residential", buildingType: "home", baseConstructionSqm: 4450, baseLandSqm: 1850, rentYield: .0059, typicalCapacity: 4, typicalUnits: 1, minimumArea: 24, amenitySensitivity: 1.04 }),
  Object.freeze({ id: "predio_residencial", label: "Prédio residencial", use: "residential", buildingType: "home", baseConstructionSqm: 4200, baseLandSqm: 2100, rentYield: .0062, typicalCapacity: 28, typicalUnits: 10, minimumArea: 180, amenitySensitivity: .94 }),
  Object.freeze({ id: "condominio_fechado", label: "Condomínio fechado", use: "residential", buildingType: "home", baseConstructionSqm: 6200, baseLandSqm: 2450, rentYield: .0049, typicalCapacity: 7, typicalUnits: 1, minimumArea: 105, amenitySensitivity: 1.2 }),
  Object.freeze({ id: "lote", label: "Lote", use: "land", buildingType: "lot", baseConstructionSqm: 0, baseLandSqm: 1750, rentYield: .001, typicalCapacity: 0, typicalUnits: 0, minimumArea: 70, amenitySensitivity: .25 }),
  Object.freeze({ id: "comercial", label: "Imóvel comercial", use: "commercial", buildingType: "shop", baseConstructionSqm: 5050, baseLandSqm: 2250, rentYield: .0072, typicalCapacity: 20, typicalUnits: 1, minimumArea: 25, amenitySensitivity: .8 }),
  Object.freeze({ id: "misto", label: "Uso misto", use: "mixed", buildingType: "shop", baseConstructionSqm: 5450, baseLandSqm: 2350, rentYield: .0065, typicalCapacity: 32, typicalUnits: 8, minimumArea: 150, amenitySensitivity: .92 }),
]);

export const REAL_ESTATE_AMENITY_CATALOG = Object.freeze([
  Object.freeze({ id: "parking", label: "Garagem", valueWeight: .026, rentWeight: .018 }),
  Object.freeze({ id: "elevator", label: "Elevador", valueWeight: .042, rentWeight: .035 }),
  Object.freeze({ id: "security", label: "Portaria e segurança", valueWeight: .038, rentWeight: .03 }),
  Object.freeze({ id: "pool", label: "Piscina", valueWeight: .052, rentWeight: .036 }),
  Object.freeze({ id: "garden", label: "Jardim", valueWeight: .026, rentWeight: .014 }),
  Object.freeze({ id: "balcony", label: "Varanda", valueWeight: .019, rentWeight: .016 }),
  Object.freeze({ id: "solar", label: "Energia solar", valueWeight: .036, rentWeight: .021 }),
  Object.freeze({ id: "accessibility", label: "Acessibilidade", valueWeight: .027, rentWeight: .024 }),
  Object.freeze({ id: "furnished", label: "Mobiliado", valueWeight: .026, rentWeight: .072 }),
  Object.freeze({ id: "recreation", label: "Área de lazer", valueWeight: .041, rentWeight: .031 }),
  Object.freeze({ id: "transit", label: "Transporte próximo", valueWeight: .024, rentWeight: .027 }),
  Object.freeze({ id: "concierge", label: "Condomínio com serviços", valueWeight: .031, rentWeight: .029 }),
]);

export const REAL_ESTATE_LIMITS = Object.freeze({
  listings: 500,
  transactions: 360,
  searches: 320,
  history: 320,
  projects: 120,
  projectHistory: 48,
  listingHistory: 36,
  inquiriesPerListing: 40,
  districtHistory: 52,
});

export const REAL_ESTATE_DEVELOPMENT_PHASES = Object.freeze([
  Object.freeze({ id: "subdivision", label: "Loteamento e parcelamento", defaultWeeks: 3 }),
  Object.freeze({ id: "infrastructure", label: "Redes de água, energia e esgoto", defaultWeeks: 4 }),
  Object.freeze({ id: "paving", label: "Acesso viário e pavimentação", defaultWeeks: 2 }),
  Object.freeze({ id: "construction", label: "Construção", defaultWeeks: 12 }),
  Object.freeze({ id: "occupation", label: "Habite-se e ocupação", defaultWeeks: 1 }),
]);

export const DEFAULT_REAL_ESTATE_AGENCIES = Object.freeze([
  Object.freeze({ id: "imobiliaria-acacias", name: "Imobiliária Acácias", districtIds: ["centro", "norte"], specialties: ["casa", "apartamento", "predio_residencial"], saleCommission: .05, rentCommission: .08, reputation: 78, cash: 180000 }),
  Object.freeze({ id: "lar-pioneiro", name: "Lar Pioneiro Negócios", districtIds: ["oeste", "sul"], specialties: ["casa", "condominio_fechado", "lote"], saleCommission: .045, rentCommission: .075, reputation: 72, cash: 145000 }),
  Object.freeze({ id: "esperanca-imoveis", name: "Esperança Imóveis", districtIds: ["leste"], specialties: ["casa", "apartamento", "predio_residencial"], saleCommission: .048, rentCommission: .07, reputation: 75, cash: 132000 }),
  Object.freeze({ id: "cidade-comercial", name: "Cidade Comercial & Misto", districtIds: ["centro", "sul", "leste", "oeste"], specialties: ["comercial", "misto", "lote"], saleCommission: .055, rentCommission: .085, reputation: 81, cash: 265000 }),
]);

export const DEFAULT_REAL_ESTATE_DEVELOPERS = Object.freeze([
  Object.freeze({ id: "incorporadora-horizonte", name: "Incorporadora Horizonte", specialties: ["apartamento", "predio_residencial", "misto"], preferredDistrictIds: ["centro", "leste"], cash: 4200000, creditCapacity: 7800000, reputation: 76, riskTolerance: 58 }),
  Object.freeze({ id: "urbanizadora-pioneira", name: "Urbanizadora Pioneira", specialties: ["casa", "condominio_fechado", "lote"], preferredDistrictIds: ["oeste", "sul"], cash: 3150000, creditCapacity: 5200000, reputation: 72, riskTolerance: 49 }),
  Object.freeze({ id: "aurora-habitacao", name: "Aurora Habitação", specialties: ["casa", "apartamento", "predio_residencial"], preferredDistrictIds: ["norte", "leste", "oeste"], cash: 2800000, creditCapacity: 6100000, reputation: 79, riskTolerance: 43 }),
]);

const TYPE_BY_ID = new Map(REAL_ESTATE_PROPERTY_CATALOG.map((entry) => [entry.id, entry]));
const AMENITY_BY_ID = new Map(REAL_ESTATE_AMENITY_CATALOG.map((entry) => [entry.id, entry]));
const RESIDENTIAL_TYPES = new Set(["casa", "apartamento", "predio_residencial", "condominio_fechado"]);

const clamp = (value, minimum = 0, maximum = 100) => {
  const number = Number(value);
  return Math.max(minimum, Math.min(maximum, Number.isFinite(number) ? number : minimum));
};
const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};
const integer = (value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) =>
  Math.round(clamp(value, minimum, maximum));
const text = (value) => String(value ?? "").trim();
const slug = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const asArray = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const bounded = (entries, limit) => asArray(entries).slice(0, Math.max(0, limit));
const idOf = (value) => text(value && typeof value === "object" ? value.id ?? value.propertyId ?? value.buildingId : value);
const unique = (entries, limit = Infinity) => [...new Set(asArray(entries).map(idOf).filter(Boolean))].slice(0, limit);
const normalizedWeek = (value) => Math.max(0, Math.floor(Number(value) || 0));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sum = (entries, selector = (entry) => entry) => entries.reduce((total, entry) => total + finite(selector(entry)), 0);

const stableHash = (value) => {
  let hash = 2166136261;
  for (const character of text(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
};

const randomValue = (random, key) => {
  if (typeof random !== "function") return stableHash(key);
  const value = Number(random());
  return Number.isFinite(value) ? clamp(value, 0, .999999) : stableHash(key);
};

const aliases = Object.freeze({
  casa: "casa", house: "casa", sobrado: "casa", casa_geminada: "casa", home: "casa",
  kitnet: "apartamento", apartamento: "apartamento", apartment: "apartamento", apartamento_luxo: "apartamento",
  predio_residencial: "predio_residencial", residencial_multifamiliar: "predio_residencial", pensao: "predio_residencial", multifamily: "predio_residencial",
  condominio: "condominio_fechado", condominio_fechado: "condominio_fechado", gated_community: "condominio_fechado",
  terreno: "lote", lote: "lote", land: "lote", lot: "lote",
  loja: "comercial", sala: "comercial", galpao: "comercial", garagem: "comercial", hotel: "comercial", comercial: "comercial", shop: "comercial",
  predio_misto: "misto", uso_misto: "misto", misto: "misto", mixed: "misto", mixed_use: "misto",
});

export function classifyRealEstateProperty(source = {}) {
  const explicit = slug(source.typeId ?? source.propertyTypeId ?? source.property?.typeId ?? source.propertyType ?? source.useType);
  if (aliases[explicit]) return aliases[explicit];
  const name = slug(source.name ?? source.label);
  if (/condominio/.test(name)) return "condominio_fechado";
  if (/apartamento|kitnet/.test(name)) return "apartamento";
  if (/residencial|edificio|predio|pensao/.test(name) && !/comercial|misto/.test(name)) return "predio_residencial";
  if (/terreno|lote/.test(name) || source.buildingType === "lot") return "lote";
  if (/misto/.test(name) || source.zoning === "mixed" && (source.residentialUnits || source.businessId)) return "misto";
  if (source.type === "shop" || source.buildingType === "shop" || source.businessId || /loja|sala|galpao|hotel|comercial/.test(name)) return "comercial";
  if (finite(source.units ?? source.property?.units) >= 4 || finite(source.capacity) >= 14) return "predio_residencial";
  return "casa";
}

const propertyCatalogEntry = (property) => TYPE_BY_ID.get(classifyRealEstateProperty(property)) || TYPE_BY_ID.get("casa");

const amenityAliases = Object.freeze({
  garagem: "parking", estacionamento: "parking", parking: "parking",
  elevador: "elevator", elevator: "elevator",
  seguranca: "security", portaria: "security", security: "security",
  piscina: "pool", pool: "pool", jardim: "garden", garden: "garden",
  varanda: "balcony", balcony: "balcony", solar: "solar", energia_solar: "solar",
  acessibilidade: "accessibility", accessibility: "accessibility",
  mobiliado: "furnished", furnished: "furnished", lazer: "recreation", recreation: "recreation",
  transporte: "transit", transit: "transit", concierge: "concierge", servicos: "concierge",
});

const normalizeAmenities = (source = {}) => {
  const raw = [
    ...asArray(source.amenities),
    ...asArray(source.improvements),
    ...asArray(source.property?.amenities),
    ...asArray(source.property?.improvements),
  ];
  if (finite(source.parkingSpaces ?? source.property?.parkingSpaces) > 0) raw.push("parking");
  if (source.furnished || source.property?.furnished) raw.push("furnished");
  ["elevator", "security", "pool", "garden", "balcony", "solar", "accessibility", "recreation", "concierge"].forEach((key) => {
    if (source[key] || source.property?.[key]) raw.push(key);
  });
  return [...new Set(raw.map((entry) => amenityAliases[slug(typeof entry === "object" ? entry.id ?? entry.name : entry)]).filter(Boolean))];
};

const findLot = (snapshot, lotId) => asArray(snapshot?.lots ?? snapshot?.city?.lots).find((lot) => idOf(lot) === lotId);

function normalizeProperty(source = {}, previous = null, snapshot = {}, index = 0) {
  const propertyData = source.property || {};
  const id = idOf(source) || text(source.buildingId) || `property:${index + 1}`;
  const lotId = text(source.lotId ?? propertyData.lotId);
  const lot = findLot(snapshot, lotId);
  const typeId = classifyRealEstateProperty({ ...source, ...propertyData });
  const catalog = TYPE_BY_ID.get(typeId);
  const footprint = Math.max(0, finite(source.w) * finite(source.h));
  const explicitArea = finite(source.area ?? propertyData.area);
  const area = typeId === "lote" ? 0 : Math.round(Math.max(catalog.minimumArea, explicitArea || footprint * 34 || catalog.minimumArea));
  const lotArea = Math.round(Math.max(catalog.minimumArea, finite(source.lotArea ?? propertyData.lotArea ?? (typeId === "lote" ? source.area : null)) || finite(lot?.area) || finite(lot?.w) * finite(lot?.h) * 95 || area * (typeId === "apartamento" ? .24 : typeId === "predio_residencial" || typeId === "misto" ? .42 : 1.35)));
  const rawLotWidth = finite(source.lotWidth ?? source.frontage ?? propertyData.lotWidth) || finite(lot?.frontage ?? lot?.w) || Math.sqrt(lotArea);
  const rawLotDepth = finite(source.lotDepth ?? source.depth ?? propertyData.lotDepth) || finite(lot?.depth ?? lot?.h) || lotArea / rawLotWidth;
  const dimensionScale = rawLotWidth * rawLotDepth > 0 && rawLotWidth * rawLotDepth < lotArea * .45 ? Math.sqrt(lotArea / (rawLotWidth * rawLotDepth)) : 1;
  const lotWidth = round(Math.max(1, rawLotWidth * dimensionScale), 2);
  const lotDepth = round(Math.max(1, rawLotDepth * dimensionScale), 2);
  const infrastructureSource = source.infrastructure || propertyData.infrastructure || previous?.infrastructure || {};
  const serviceLevel = clamp(source.serviceLevel ?? propertyData.serviceLevel ?? previous?.serviceLevel ?? 0);
  const urbanized = ["urbanized", "serviced", "ready"].includes(slug(source.status ?? previous?.status));
  const slope = finite(source.slope ?? propertyData.slope, NaN);
  const topography = text(source.topography ?? propertyData.topography ?? previous?.topography) || (Number.isFinite(slope) ? slope <= 5 ? "level" : slope <= 12 ? "gentle_slope" : slope <= 22 ? "slope" : "steep" : "level");
  const capacity = integer(source.capacity ?? propertyData.capacity ?? catalog.typicalCapacity, 0, 5000);
  const residentCount = integer(source.residentCount ?? propertyData.residentCount ?? source.occupied, 0, 5000);
  const defaultUnits = typeId === "predio_residencial" ? Math.max(4, Math.round(capacity / 3)) : typeId === "misto" ? Math.max(2, integer(source.residentialUnits ?? propertyData.residentialUnits ?? Math.round(capacity / 5), 2)) : catalog.typicalUnits;
  const units = integer(source.units ?? propertyData.units ?? defaultUnits, 0, 500);
  const explicitOccupiedUnits = source.occupiedUnits ?? propertyData.occupiedUnits;
  const occupiedByIds = unique(source.occupiedByIds ?? propertyData.occupiedByIds ?? [source.occupiedById ?? propertyData.occupiedById]);
  const occupancyFromResidents = units > 1 && residentCount ? Math.ceil(residentCount / Math.max(1, capacity / units)) : residentCount || occupiedByIds.length ? 1 : 0;
  const preserveInternalOccupancy = previous?.lastOccupancyWeek != null && previous.lastOccupancyWeek >= normalizedWeek(snapshot.week);
  const occupiedUnits = integer(preserveInternalOccupancy ? previous.occupiedUnits : explicitOccupiedUnits ?? occupancyFromResidents, 0, units || 1);
  const condition = round(clamp(source.condition ?? propertyData.condition ?? previous?.condition ?? 78, 5, 100), 1);
  const ownerId = text(source.ownerFamilyId ?? source.ownerId ?? propertyData.ownerId ?? previous?.ownerId) || null;
  const status = text(source.status ?? propertyData.status ?? previous?.status) || (typeId === "lote" ? "available" : occupiedUnits ? "occupied" : "vacant");
  return {
    id,
    buildingId: text(source.buildingId ?? (source.type ? source.id : null) ?? previous?.buildingId) || (typeId === "lote" ? null : id),
    lotId: lotId || previous?.lotId || (typeId === "lote" ? id : null),
    name: text(source.name ?? previous?.name) || `${catalog.label} ${index + 1}`,
    typeId,
    use: catalog.use,
    districtId: text(source.districtId ?? source.district ?? propertyData.districtId ?? lot?.district ?? previous?.districtId) || "city",
    zoning: text(source.zoning ?? source.zone ?? lot?.zone ?? previous?.zoning) || (catalog.use === "residential" ? "residential" : catalog.use),
    developmentEligible: source.developmentEligible ?? propertyData.developmentEligible ?? previous?.developmentEligible ?? true,
    developmentRules: clone(source.developmentRules ?? propertyData.developmentRules ?? previous?.developmentRules ?? null),
    address: clone(source.address ?? previous?.address ?? null),
    x: round(source.x ?? lot?.x ?? previous?.x ?? 0, 3),
    y: round(source.y ?? lot?.y ?? previous?.y ?? 0, 3),
    area,
    lotArea,
    lotWidth,
    lotDepth,
    frontage: lotWidth,
    topography,
    slope: Number.isFinite(slope) ? round(slope, 1) : null,
    serviceLevel: round(serviceLevel, 1),
    infrastructure: {
      water: Boolean(infrastructureSource.water ?? source.waterConnected ?? source.meter?.connected ?? (urbanized && serviceLevel >= 55)),
      sewer: Boolean(infrastructureSource.sewer ?? source.sewerConnected ?? source.meter?.connected ?? (urbanized && serviceLevel >= 68)),
      power: Boolean(infrastructureSource.power ?? source.powerConnected ?? source.meter?.connected ?? (urbanized && serviceLevel >= 45)),
      roadAccess: Boolean(infrastructureSource.roadAccess ?? source.roadAccess ?? source.address ?? urbanized),
      paved: Boolean(infrastructureSource.paved ?? source.pavedAccess ?? source.address ?? (urbanized && serviceLevel >= 65)),
      transit: Boolean(infrastructureSource.transit ?? source.transitAccess),
    },
    units,
    occupiedUnits,
    vacantUnits: Math.max(0, units - occupiedUnits),
    capacity,
    residentCount,
    bedrooms: integer(source.bedrooms ?? propertyData.bedrooms ?? previous?.bedrooms ?? (RESIDENTIAL_TYPES.has(typeId) ? Math.max(1, Math.round(capacity / Math.max(1, units) / 2)) : 0), 0, 100),
    bathrooms: integer(source.bathrooms ?? propertyData.bathrooms ?? previous?.bathrooms ?? (typeId === "lote" ? 0 : Math.max(1, Math.round(capacity / Math.max(1, units) / 4))), 0, 100),
    parkingSpaces: integer(source.parkingSpaces ?? propertyData.parkingSpaces ?? previous?.parkingSpaces ?? 0, 0, 1000),
    yearBuilt: integer(source.yearBuilt ?? propertyData.yearBuilt ?? previous?.yearBuilt ?? 2000, 1800, 2200),
    condition,
    amenities: normalizeAmenities({ ...previous, ...source, property: { ...(previous?.property || {}), ...propertyData } }),
    ownerId,
    ownerKind: text(source.ownerKind ?? propertyData.ownerKind ?? previous?.ownerKind) || (ownerId ? "family" : "unassigned"),
    occupiedByIds: preserveInternalOccupancy ? unique(previous.occupiedByIds) : occupiedByIds,
    businessId: text(source.businessId ?? previous?.businessId) || null,
    status,
    listingId: text(source.listingId ?? propertyData.listingId ?? previous?.listingId) || null,
    vacancyWeeks: occupiedUnits ? 0 : integer(previous?.vacancyWeeks ?? propertyData.vacancyWeeks ?? 0, 0),
    currentValue: round(previous?.currentValue ?? source.value ?? propertyData.value ?? 0),
    estimatedRent: round(previous?.estimatedRent ?? source.rent ?? propertyData.rent ?? 0),
    valuation: clone(previous?.valuation ?? null),
    lastValuationWeek: previous?.lastValuationWeek ?? null,
    lastOccupancyWeek: previous?.lastOccupancyWeek ?? null,
    source: source.source || (typeId === "lote" ? "lot" : "building"),
    projectId: text(source.projectId ?? previous?.projectId) || null,
  };
}

const normalizeDistrict = (source = {}, metrics = {}, index = 0) => {
  const id = idOf(source) || `district:${index + 1}`;
  const desirability = clamp(metrics.desirability ?? source.desirability ?? 58);
  const services = clamp(metrics.services ?? source.services ?? 50);
  const transit = clamp(metrics.transit ?? metrics.mobility ?? source.transit ?? 55);
  const infrastructure = clamp(metrics.infrastructure ?? source.infrastructure ?? 70);
  const green = clamp(metrics.green ?? source.green ?? 45);
  const air = clamp(metrics.airQuality ?? source.airQuality ?? 76);
  const noise = clamp(metrics.noise ?? source.noise ?? 35);
  const crime = clamp(metrics.crimeIndex ?? metrics.crimes ?? source.crime ?? 18);
  const centrality = /centro|central/.test(slug(id + source.name)) ? 82 : clamp(source.centrality ?? 52);
  const locationScore = round(clamp(desirability * .28 + services * .16 + transit * .13 + infrastructure * .15 + green * .08 + air * .08 + centrality * .12 - noise * .08 - crime * .12));
  return {
    id,
    name: text(source.name) || id,
    desirability: round(desirability), services: round(services), transit: round(transit), infrastructure: round(infrastructure), green: round(green), airQuality: round(air), noise: round(noise), crime: round(crime), centrality: round(centrality), locationScore,
    landPricePerSqm: round(finite(source.landPricePerSqm ?? metrics.landPricePerSqm) || 850 + locationScore * 19),
  };
};

const residentsOf = (snapshot) => asArray(snapshot?.residents ?? snapshot?.people ?? snapshot?.population);

const normalizeHousehold = (source = {}, previous = null, snapshot = {}, propertyById = new Map(), index = 0) => {
  const id = idOf(source) || `household:${index + 1}`;
  const memberIds = unique(source.memberIds ?? source.residentIds ?? source.members);
  const peopleById = new Map(residentsOf(snapshot).map((person) => [idOf(person), person]));
  const members = memberIds.map((memberId) => peopleById.get(memberId)).filter(Boolean);
  const monthlyIncome = Math.max(0, finite(source.monthlyIncome ?? source.income) || sum(members, (person) => finite(person.monthlyIncome ?? person.income) || finite(person.hourlyWage ?? person.wage) * finite(person.shift?.hours, 0) * 52 / 12));
  const liquidAssets = Math.max(0, finite(source.liquidAssets ?? source.cash) || sum(members, (person) => Math.max(0, finite(person.money))) || finite(source.wealth) * .12);
  const preserveInternalMove = previous?.lastMoveWeek != null && previous.lastMoveWeek >= normalizedWeek(snapshot.week);
  const currentHomeId = text(preserveInternalMove ? previous.currentHomeId : source.homeId ?? source.propertyId ?? previous?.currentHomeId) || null;
  const current = propertyById.get(currentHomeId);
  const size = Math.max(1, memberIds.length || integer(source.size ?? source.residents, 1));
  const tenure = text(source.tenure ?? source.housing ?? previous?.tenure) || "unknown";
  const overcrowding = current ? Math.max(0, size - Math.max(1, current.capacity)) / size : currentHomeId ? 0 : 1;
  const temporary = /temporary|temporar|hotel|pousada|abrigo/.test(slug(tenure + " " + (current?.name || "")));
  const arrears = integer(source.arrears ?? source.rentArrears ?? 0, 0, 200);
  let urgency = !currentHomeId ? 92 : temporary ? 78 : overcrowding > 0 ? 55 + overcrowding * 35 : arrears >= 3 ? 48 : 12;
  if (source.mustMove || source.evicted || source.displaced) urgency = Math.max(urgency, 90);
  const wealthBand = liquidAssets > 180000 || monthlyIncome > 14000 ? "high" : liquidAssets > 45000 || monthlyIncome > 6000 ? "middle" : "low";
  const desiredTypes = unique(source.desiredTypes ?? source.preferences?.types ?? (wealthBand === "high" ? ["condominio_fechado", "casa", "apartamento"] : size >= 5 ? ["casa", "predio_residencial", "apartamento"] : size <= 2 ? ["apartamento", "casa"] : ["casa", "apartamento", "predio_residencial"]));
  return {
    id,
    name: text(source.surname ?? source.name) || id,
    memberIds,
    size,
    adults: integer(source.adults ?? members.filter((person) => finite(person.age) >= 18).length ?? 1, 0),
    monthlyIncome: round(monthlyIncome),
    liquidAssets: round(liquidAssets),
    wealth: round(Math.max(liquidAssets, finite(source.wealth))),
    creditScore: integer(source.creditScore ?? previous?.creditScore ?? 620, 200, 900),
    arrears,
    currentHomeId,
    currentDistrictId: current?.districtId || text(source.districtId ?? previous?.currentDistrictId) || null,
    tenure,
    temporary,
    overcrowding: round(overcrowding, 3),
    urgency: round(clamp(urgency)),
    maxRent: round(finite(source.maxRent) || monthlyIncome * (arrears ? .26 : .32)),
    maxPrice: round(finite(source.maxPrice) || Math.max(liquidAssets * 4.5, monthlyIncome * 50)),
    desiredTypes,
    preferredDistrictIds: unique(source.preferredDistrictIds ?? source.preferences?.districtIds ?? [current?.districtId]),
    desiredAmenities: unique(source.desiredAmenities ?? source.preferences?.amenities).map((entry) => amenityAliases[slug(entry)] || slug(entry)).filter((entry) => AMENITY_BY_ID.has(entry)),
    lastMoveWeek: previous?.lastMoveWeek ?? null,
  };
};

const normalizeAgency = (source = {}) => ({
  id: idOf(source), name: text(source.name), districtIds: unique(source.districtIds ?? source.districts), specialties: unique(source.specialties).map((entry) => aliases[slug(entry)] || slug(entry)).filter((entry) => TYPE_BY_ID.has(entry)),
  saleCommission: clamp(source.saleCommission ?? .05, 0, .2), rentCommission: clamp(source.rentCommission ?? .08, 0, .2), reputation: round(clamp(source.reputation ?? 65)), cash: round(Math.max(0, finite(source.cash))),
  portfolioIds: unique(source.portfolioIds, 500), sales: integer(source.sales), leases: integer(source.leases), inquiries: integer(source.inquiries), revenue: round(source.revenue), history: bounded(clone(source.history), 80),
});

const normalizeDeveloper = (source = {}) => ({
  id: idOf(source), name: text(source.name), specialties: unique(source.specialties).map((entry) => aliases[slug(entry)] || slug(entry)).filter((entry) => TYPE_BY_ID.has(entry)), preferredDistrictIds: unique(source.preferredDistrictIds),
  cash: round(Math.max(0, finite(source.cash))), creditCapacity: round(Math.max(0, finite(source.creditCapacity))), committedCapital: round(Math.max(0, finite(source.committedCapital))), reputation: round(clamp(source.reputation ?? 65)), riskTolerance: round(clamp(source.riskTolerance ?? 50)),
  activeProjectIds: unique(source.activeProjectIds, 100), completedProjects: integer(source.completedProjects), cancelledProjects: integer(source.cancelledProjects), history: bounded(clone(source.history), 80),
});

const normalizeListing = (source = {}, week = 0, index = 0) => ({
  id: idOf(source) || `listing:${index + 1}`,
  propertyId: text(source.propertyId ?? source.buildingId),
  kind: ["rent", "aluguel", "lease"].includes(slug(source.kind ?? source.type)) ? "rent" : "sale",
  sellerId: text(source.sellerId ?? source.ownerId) || null,
  agencyId: text(source.agencyId) || null,
  askingPrice: round(Math.max(1, finite(source.askingPrice ?? source.price))),
  originalPrice: round(Math.max(1, finite(source.originalPrice ?? source.askingPrice ?? source.price))),
  status: text(source.status) || "active",
  createdWeek: normalizedWeek(source.createdWeek ?? source.created?.week ?? week),
  expiresWeek: normalizedWeek(source.expiresWeek ?? week + 16),
  weeksOnMarket: integer(source.weeksOnMarket ?? Math.max(0, week - normalizedWeek(source.createdWeek ?? source.created?.week ?? week))),
  negotiable: source.negotiable !== false,
  occupied: Boolean(source.occupied),
  availableUnits: integer(source.availableUnits ?? 1, 0, 500),
  completedUnits: integer(source.completedUnits, 0, 500),
  views: integer(source.views),
  inquiries: bounded(clone(source.inquiries), REAL_ESTATE_LIMITS.inquiriesPerListing),
  offers: bounded(clone(source.offers), 24),
  applications: bounded(clone(source.applications), 24),
  priceHistory: bounded(clone(source.priceHistory), REAL_ESTATE_LIMITS.listingHistory),
  closedWeek: source.closedWeek == null ? null : normalizedWeek(source.closedWeek),
  closeReason: text(source.closeReason) || null,
});

const normalizeProject = (source = {}, week = 0, index = 0) => ({
  id: idOf(source) || `project:${index + 1}`,
  developerId: text(source.developerId), typeId: aliases[slug(source.typeId)] || classifyRealEstateProperty(source), districtId: text(source.districtId) || "city", lotId: text(source.lotId) || null,
  name: text(source.name) || `Projeto imobiliário ${index + 1}`, status: text(source.status) || "planning", startedWeek: normalizedWeek(source.startedWeek ?? week), approvedWeek: source.approvedWeek == null ? null : normalizedWeek(source.approvedWeek), completedWeek: source.completedWeek == null ? null : normalizedWeek(source.completedWeek),
  units: integer(source.units ?? 1, 1, 500), capacity: integer(source.capacity, 0, 5000), area: integer(source.area, 20, 100000), lotArea: integer(source.lotArea, 20, 200000), lotWidth: round(Math.max(1, finite(source.lotWidth) || Math.sqrt(Math.max(20, finite(source.lotArea)))), 2), lotDepth: round(Math.max(1, finite(source.lotDepth) || Math.sqrt(Math.max(20, finite(source.lotArea)))), 2), parcelCount: integer(source.parcelCount ?? (source.units > 1 && source.typeId === "casa" ? source.units : 1), 1, 500),
  durationWeeks: integer(source.durationWeeks ?? 12, 2, 260), remainingWeeks: integer(source.remainingWeeks ?? source.durationWeeks ?? 12, 0, 260), progress: round(clamp(source.progress, 0, 1), 4), phaseIndex: integer(source.phaseIndex, 0, REAL_ESTATE_DEVELOPMENT_PHASES.length - 1), phaseProgress: round(clamp(source.phaseProgress, 0, 1), 4), phases: asArray(source.phases).length ? clone(source.phases) : REAL_ESTATE_DEVELOPMENT_PHASES.map((phase) => ({ ...phase, status: phase.id === "subdivision" ? "active" : "pending", progress: 0, startedWeek: phase.id === "subdivision" ? normalizedWeek(source.startedWeek ?? week) : null, completedWeek: null })),
  totalCost: round(Math.max(0, finite(source.totalCost ?? source.cost))), spent: round(Math.max(0, finite(source.spent))), financing: round(Math.max(0, finite(source.financing))), projectedValue: round(Math.max(0, finite(source.projectedValue))), createdPropertyIds: unique(source.createdPropertyIds, 100), history: bounded(clone(source.history), REAL_ESTATE_LIMITS.projectHistory),
});

const emptyStats = () => ({ listingsCreated: 0, listingsExpired: 0, sales: 0, leases: 0, householdsMoved: 0, projectsStarted: 0, projectsCompleted: 0, unitsDelivered: 0, transactionVolume: 0, commissions: 0 });

const extractPropertySources = (snapshot = {}) => {
  const explicit = asArray(snapshot.properties ?? snapshot.realEstate?.properties);
  const buildings = asArray(snapshot.buildings).filter((building) => ["home", "shop"].includes(building.type) || building.property || building.propertyTypeId);
  const byId = new Map();
  [...explicit, ...buildings].forEach((source) => { const id = idOf(source) || text(source.buildingId); if (id && !byId.has(id)) byId.set(id, source); });
  const occupiedLots = new Set([...byId.values()].map((source) => text(source.lotId)).filter(Boolean));
  asArray(snapshot.lots ?? snapshot.city?.lots).filter((lot) => !lot.occupied && !occupiedLots.has(idOf(lot))).forEach((lot) => byId.set(idOf(lot), { ...lot, typeId: "lote", source: "lot", lotArea: finite(lot.lotArea ?? lot.area) || finite(lot.w) * finite(lot.h) * 95 }));
  return [...byId.values()];
};

const extractListings = (snapshot = {}) => asArray(snapshot.listings ?? snapshot.realEstate?.listings ?? snapshot.markets?.realEstate?.listings);

const freshState = (week = 0) => ({
  version: REAL_ESTATE_DYNAMICS_VERSION,
  sequence: 0,
  currentWeek: normalizedWeek(week),
  properties: [], households: [], listings: [], transactions: [], searches: [], projects: [],
  agencies: DEFAULT_REAL_ESTATE_AGENCIES.map(normalizeAgency),
  developers: DEFAULT_REAL_ESTATE_DEVELOPERS.map(normalizeDeveloper),
  districts: [], districtMarkets: {}, cityMarket: { priceIndex: 100, rentIndex: 100, vacancyRate: 0, supply: 0, demand: 0, transactionVolume: 0 },
  history: [], stats: emptyStats(), lastTickWeek: normalizedWeek(week),
});

export function normalizeRealEstateDynamics(stateInput = null, snapshot = {}, options = {}) {
  const week = normalizedWeek(options.week ?? snapshot.week ?? stateInput?.currentWeek ?? 0);
  const previous = stateInput ? clone(stateInput) : freshState(week);
  const state = freshState(week);
  state.sequence = integer(previous.sequence);
  state.currentWeek = week;
  const existingProperties = new Map(asArray(previous.properties).map((property) => [idOf(property), property]));
  const snapshotSources = extractPropertySources(snapshot);
  const sources = snapshotSources.length ? snapshotSources : asArray(previous.properties);
  const snapshotIds = new Set(sources.map(idOf));
  state.properties = sources.map((source, index) => normalizeProperty(source, existingProperties.get(idOf(source)), snapshot, index));
  asArray(previous.properties).filter((property) => !snapshotIds.has(idOf(property)) && (property.source === "project" || property.projectId)).forEach((property) => state.properties.push(normalizeProperty(property, property, snapshot, state.properties.length)));
  const districtSources = asArray(snapshot.districts ?? snapshot.city?.districts).length ? asArray(snapshot.districts ?? snapshot.city?.districts) : asArray(previous.districts);
  const environmentMetrics = snapshot.environment?.districts || {};
  const urbanMetrics = snapshot.urbanEvolution?.districtMetrics || snapshot.districtMetrics || {};
  const districtIds = new Set([...districtSources.map(idOf), ...state.properties.map((property) => property.districtId)]);
  state.districts = [...districtIds].filter(Boolean).map((districtId, index) => {
    const source = districtSources.find((district) => idOf(district) === districtId) || { id: districtId, name: districtId };
    return normalizeDistrict(source, { ...(environmentMetrics[districtId] || {}), ...(urbanMetrics[districtId] || {}) }, index);
  });
  const propertyById = new Map(state.properties.map((property) => [property.id, property]));
  const existingHouseholds = new Map(asArray(previous.households).map((household) => [idOf(household), household]));
  const householdSources = asArray(snapshot.households ?? snapshot.families).length ? asArray(snapshot.households ?? snapshot.families) : asArray(previous.households);
  state.households = householdSources.map((household, index) => normalizeHousehold(household, existingHouseholds.get(idOf(household)), snapshot, propertyById, index));
  const listingSources = asArray(previous.listings).length ? previous.listings : extractListings(snapshot);
  state.listings = listingSources.map((listing, index) => normalizeListing(listing, week, index)).filter((listing) => propertyById.has(listing.propertyId));
  const activeListingByProperty = new Map(state.listings.filter((listing) => listing.status === "active").map((listing) => [listing.propertyId, listing]));
  state.properties = state.properties.map((property) => ({ ...property, listingId: activeListingByProperty.get(property.id)?.id || (activeListingByProperty.has(property.id) ? property.listingId : null) }));
  const agencySources = asArray(previous.agencies).length ? previous.agencies : DEFAULT_REAL_ESTATE_AGENCIES;
  state.agencies = agencySources.map(normalizeAgency);
  const developerSources = asArray(previous.developers).length ? previous.developers : DEFAULT_REAL_ESTATE_DEVELOPERS;
  state.developers = developerSources.map(normalizeDeveloper);
  state.transactions = bounded(clone(previous.transactions), REAL_ESTATE_LIMITS.transactions);
  state.searches = bounded(clone(previous.searches), REAL_ESTATE_LIMITS.searches);
  state.projects = asArray(previous.projects).map((project, index) => normalizeProject(project, week, index));
  state.districtMarkets = clone(previous.districtMarkets || {});
  state.cityMarket = { ...freshState().cityMarket, ...(clone(previous.cityMarket) || {}) };
  state.history = bounded(clone(previous.history), REAL_ESTATE_LIMITS.history);
  state.stats = { ...emptyStats(), ...(clone(previous.stats) || {}) };
  state.lastTickWeek = normalizedWeek(previous.lastTickWeek ?? week);
  return state;
}

const nextId = (state, prefix) => `${prefix}:${state.currentWeek}:${++state.sequence}`;

const marketCell = (state, districtId, typeId) => state?.districtMarkets?.[districtId]?.types?.[typeId] || null;

export function evaluateRealEstateProperty(propertyInput, context = {}, options = {}) {
  const property = normalizeProperty(propertyInput, propertyInput, {}, 0);
  const catalog = TYPE_BY_ID.get(property.typeId);
  const state = context.state || (context.properties ? context : null);
  const district = context.district || state?.districts?.find((entry) => entry.id === property.districtId) || { locationScore: 55, landPricePerSqm: catalog.baseLandSqm };
  const market = context.market || marketCell(state, property.districtId, property.typeId) || {};
  const referenceYear = integer(options.referenceYear ?? context.referenceYear ?? 2026, 1900, 2400);
  const age = Math.max(0, referenceYear - property.yearBuilt);
  const conditionFactor = clamp(.57 + property.condition * .0061, .52, 1.2);
  const ageFactor = clamp(1.03 - Math.max(0, age - 8) * .0022, .72, 1.04);
  const locationFactor = clamp(.7 + finite(district.locationScore, 55) / 185, .68, 1.34);
  const amenityWeight = sum(property.amenities, (amenityId) => AMENITY_BY_ID.get(amenityId)?.valueWeight || 0) * catalog.amenitySensitivity;
  const amenityRentWeight = sum(property.amenities, (amenityId) => AMENITY_BY_ID.get(amenityId)?.rentWeight || 0) * catalog.amenitySensitivity;
  const amenityFactor = clamp(1 + amenityWeight + Math.min(.08, property.parkingSpaces * .009), 1, 1.38);
  const marketFactor = clamp(finite(market.priceIndex, finite(state?.cityMarket?.priceIndex, 100)) / 100, .6, 2.4);
  const rentMarketFactor = clamp(finite(market.rentIndex, finite(state?.cityMarket?.rentIndex, 100)) / 100, .6, 2.6);
  const landRate = finite(district.landPricePerSqm, catalog.baseLandSqm) * clamp(catalog.baseLandSqm / 1800, .72, 1.42);
  const landShare = property.typeId === "apartamento" ? .16 : ["predio_residencial", "misto"].includes(property.typeId) ? .42 : 1;
  const frontageRatio = property.frontage / Math.max(1, Math.sqrt(property.lotArea));
  const shapeFactor = clamp(.88 + Math.min(.16, frontageRatio * .08) - Math.max(0, property.lotDepth / Math.max(1, property.lotWidth) - 4) * .025, .76, 1.08);
  const topographyFactor = { level: 1, flat: 1, gentle_slope: .96, slope: .88, steep: .76, flood_prone: .7 }[slug(property.topography)] ?? .94;
  const infrastructureCount = Object.values(property.infrastructure || {}).filter(Boolean).length;
  const infrastructureFactor = clamp(.72 + infrastructureCount * .052, .68, 1.06);
  const landComponent = property.lotArea * landRate * landShare * shapeFactor * topographyFactor * infrastructureFactor;
  const constructionComponent = property.area * catalog.baseConstructionSqm * conditionFactor * ageFactor;
  const rawValue = property.typeId === "lote" ? landComponent * locationFactor : (landComponent + constructionComponent) * locationFactor * amenityFactor;
  const saleValue = Math.max(property.typeId === "lote" ? 12000 : 18000, Math.round(rawValue * marketFactor));
  const pressure = clamp(finite(market.pressure, 1), .4, 3.5);
  const monthlyRent = property.typeId === "lote" ? Math.max(120, Math.round(saleValue * catalog.rentYield)) : Math.max(280, Math.round(saleValue * catalog.rentYield * rentMarketFactor * clamp(.9 + pressure * .08 + amenityRentWeight, .88, 1.34)));
  const explicitSignals = [propertyInput.area, propertyInput.lotArea, propertyInput.condition, propertyInput.districtId, propertyInput.yearBuilt].filter((value) => value != null).length;
  return {
    propertyId: property.id,
    typeId: property.typeId,
    evaluatedWeek: normalizedWeek(options.week ?? state?.currentWeek ?? context.week),
    saleValue,
    monthlyRent,
    pricePerSqm: Math.round(saleValue / Math.max(1, property.area || property.lotArea)),
    confidence: integer(56 + explicitSignals * 7 + (market.stockUnits ? 7 : 0), 45, 96),
    components: { land: Math.round(landComponent), construction: Math.round(constructionComponent), amenities: Math.round(rawValue * Math.max(0, amenityFactor - 1)) },
    factors: { location: round(locationFactor, 3), condition: round(conditionFactor, 3), age: round(ageFactor, 3), amenities: round(amenityFactor, 3), market: round(marketFactor, 3), rentMarket: round(rentMarketFactor, 3), pressure: round(pressure, 3), lotShape: round(shapeFactor, 3), topography: round(topographyFactor, 3), infrastructure: round(infrastructureFactor, 3) },
    reasons: [
      `localização ${Math.round(finite(district.locationScore, 55))}/100`,
      `conservação ${Math.round(property.condition)}/100`,
      `${property.amenities.length} amenidade(s)`,
      `${infrastructureCount}/6 redes e acessos disponíveis`,
      `pressão de demanda ${round(pressure, 2)}`,
    ],
  };
}

const householdDemandWeight = (household) => {
  if (!household.currentHomeId) return 1.3;
  if (household.temporary) return 1.15;
  if (household.overcrowding > 0) return .8 + household.overcrowding;
  if (household.arrears >= 3) return .55;
  return .08 + household.urgency / 500;
};

const emptyMarketCell = (typeId, previous = null) => ({
  typeId,
  stockUnits: 0,
  occupiedUnits: 0,
  vacantUnits: 0,
  saleListings: 0,
  rentListings: 0,
  demand: 0,
  pressure: round(previous?.pressure ?? 1, 3),
  vacancyRate: 0,
  priceIndex: round(previous?.priceIndex ?? 100, 3),
  rentIndex: round(previous?.rentIndex ?? 100, 3),
  medianSalePrice: 0,
  medianRent: 0,
  weeksOfSupply: 0,
});

const median = (values) => {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return 0;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
};

function analyzeNormalizedRealEstateMarket(state, snapshot = {}, options = {}) {
  const listingsByProperty = new Map();
  state.listings.filter((listing) => listing.status === "active").forEach((listing) => {
    if (!listingsByProperty.has(listing.propertyId)) listingsByProperty.set(listing.propertyId, []);
    listingsByProperty.get(listing.propertyId).push(listing);
  });
  const districtMarkets = {};
  state.districts.forEach((district) => {
    const previousDistrict = state.districtMarkets?.[district.id];
    districtMarkets[district.id] = {
      districtId: district.id,
      name: district.name,
      locationScore: district.locationScore,
      landPricePerSqm: district.landPricePerSqm,
      stockUnits: 0, occupiedUnits: 0, vacantUnits: 0, demand: 0, vacancyRate: 0, priceIndex: previousDistrict?.priceIndex ?? 100, rentIndex: previousDistrict?.rentIndex ?? 100,
      types: Object.fromEntries(REAL_ESTATE_PROPERTY_CATALOG.map((catalog) => [catalog.id, emptyMarketCell(catalog.id, previousDistrict?.types?.[catalog.id])])),
      history: bounded(clone(previousDistrict?.history), REAL_ESTATE_LIMITS.districtHistory),
    };
  });
  if (!Object.keys(districtMarkets).length) districtMarkets.city = { districtId: "city", name: "Cidade", locationScore: 55, landPricePerSqm: 1800, stockUnits: 0, occupiedUnits: 0, vacantUnits: 0, demand: 0, vacancyRate: 0, priceIndex: 100, rentIndex: 100, types: Object.fromEntries(REAL_ESTATE_PROPERTY_CATALOG.map((catalog) => [catalog.id, emptyMarketCell(catalog.id)])), history: [] };
  state.properties.forEach((property) => {
    const district = districtMarkets[property.districtId] || districtMarkets.city || Object.values(districtMarkets)[0];
    const cell = district.types[property.typeId] || (district.types[property.typeId] = emptyMarketCell(property.typeId));
    const stock = property.typeId === "lote" ? 1 : Math.max(1, property.units);
    const occupied = property.typeId === "lote" ? (property.status === "available" || property.status === "vacant" ? 0 : 1) : Math.min(stock, property.occupiedUnits);
    cell.stockUnits += stock;
    cell.occupiedUnits += occupied;
    cell.vacantUnits += Math.max(0, stock - occupied);
    district.stockUnits += stock;
    district.occupiedUnits += occupied;
    district.vacantUnits += Math.max(0, stock - occupied);
    for (const listing of listingsByProperty.get(property.id) || []) {
      if (listing.kind === "rent") cell.rentListings++;
      else cell.saleListings++;
    }
  });
  const districtIds = Object.keys(districtMarkets);
  state.households.forEach((household) => {
    const weight = householdDemandWeight(household);
    const preferredDistricts = household.preferredDistrictIds.filter((districtId) => districtMarkets[districtId]);
    const targets = preferredDistricts.length ? preferredDistricts : household.currentDistrictId && districtMarkets[household.currentDistrictId] ? [household.currentDistrictId] : districtIds;
    const typeTargets = household.desiredTypes.filter((typeId) => RESIDENTIAL_TYPES.has(typeId));
    targets.forEach((districtId) => typeTargets.forEach((typeId) => {
      const share = weight / Math.max(1, targets.length * typeTargets.length);
      districtMarkets[districtId].types[typeId].demand += share;
      districtMarkets[districtId].demand += share;
    }));
  });
  const businesses = asArray(snapshot.businesses);
  const commercialDemand = businesses.filter((business) => !business.closed && (!business.buildingId || business.relocationPending || business.expansionPlanned)).length + finite(options.commercialDemand);
  if (commercialDemand > 0) districtIds.forEach((districtId) => ["comercial", "misto"].forEach((typeId) => {
    const share = commercialDemand / Math.max(1, districtIds.length * 2);
    districtMarkets[districtId].types[typeId].demand += share;
    districtMarkets[districtId].demand += share;
  }));
  const activeListings = state.listings.filter((listing) => listing.status === "active");
  Object.values(districtMarkets).forEach((district) => {
    Object.values(district.types).forEach((cell) => {
      const available = cell.vacantUnits + cell.saleListings * .35 + cell.rentListings * .5;
      const rawPressure = clamp((cell.demand + .4) / (available + .55), .35, 3.5);
      const previous = state.districtMarkets?.[district.districtId]?.types?.[cell.typeId];
      cell.pressure = round((previous?.pressure ?? rawPressure) * .55 + rawPressure * .45, 3);
      cell.vacancyRate = round(cell.stockUnits ? cell.vacantUnits / cell.stockUnits : 0, 4);
      const locationPremium = (district.locationScore - 55) * .16;
      const targetPrice = clamp(88 + cell.pressure * 13 + locationPremium - cell.vacancyRate * 28, 68, 188);
      const targetRent = clamp(84 + cell.pressure * 17 + locationPremium * .7 - cell.vacancyRate * 22, 65, 205);
      cell.priceIndex = round(clamp((previous?.priceIndex ?? 100) * .955 + targetPrice * .045, (previous?.priceIndex ?? 100) * .98, (previous?.priceIndex ?? 100) * 1.02), 3);
      cell.rentIndex = round(clamp((previous?.rentIndex ?? 100) * .95 + targetRent * .05, (previous?.rentIndex ?? 100) * .977, (previous?.rentIndex ?? 100) * 1.023), 3);
      const properties = state.properties.filter((property) => property.districtId === district.districtId && property.typeId === cell.typeId);
      const salePrices = [], rentPrices = [];
      properties.forEach((property) => {
        const listing = activeListings.find((entry) => entry.propertyId === property.id);
        if (listing?.kind === "sale") salePrices.push(listing.askingPrice);
        if (listing?.kind === "rent") rentPrices.push(listing.askingPrice);
        if (!listing && property.valuation) {
          salePrices.push(property.valuation.saleValue);
          rentPrices.push(property.valuation.monthlyRent);
        }
      });
      cell.medianSalePrice = median(salePrices);
      cell.medianRent = median(rentPrices);
      cell.weeksOfSupply = round(available / Math.max(.1, cell.demand), 1);
    });
    district.vacancyRate = round(district.stockUnits ? district.vacantUnits / district.stockUnits : 0, 4);
    const weighted = Object.values(district.types).filter((cell) => cell.stockUnits || cell.demand);
    const divisor = sum(weighted, (cell) => Math.max(1, cell.stockUnits)) || 1;
    district.priceIndex = round(sum(weighted, (cell) => cell.priceIndex * Math.max(1, cell.stockUnits)) / divisor, 3);
    district.rentIndex = round(sum(weighted, (cell) => cell.rentIndex * Math.max(1, cell.stockUnits)) / divisor, 3);
  });
  const allCells = Object.values(districtMarkets).flatMap((district) => Object.values(district.types)).filter((cell) => cell.stockUnits || cell.demand);
  const stock = sum(allCells, (cell) => cell.stockUnits) || 1;
  const cityMarket = {
    priceIndex: round(sum(allCells, (cell) => cell.priceIndex * Math.max(1, cell.stockUnits)) / sum(allCells, (cell) => Math.max(1, cell.stockUnits)), 3),
    rentIndex: round(sum(allCells, (cell) => cell.rentIndex * Math.max(1, cell.stockUnits)) / sum(allCells, (cell) => Math.max(1, cell.stockUnits)), 3),
    vacancyRate: round(sum(allCells, (cell) => cell.vacantUnits) / stock, 4),
    supply: sum(allCells, (cell) => cell.vacantUnits),
    demand: round(sum(allCells, (cell) => cell.demand), 2),
    activeListings: activeListings.length,
    transactionVolume: round(sum(state.transactions.filter((transaction) => state.currentWeek - transaction.week <= 13), (transaction) => transaction.price)),
  };
  return { districtMarkets, cityMarket, households: clone(state.households) };
}

export function analyzeRealEstateMarket(stateInput, snapshot = {}, options = {}) {
  return analyzeNormalizedRealEstateMarket(normalizeRealEstateDynamics(stateInput, snapshot, options), snapshot, options);
}

const chooseAgency = (state, property, kind) => state.agencies.slice().sort((a, b) => {
  const score = (agency) => (agency.districtIds.includes(property.districtId) ? 28 : 0) + (agency.specialties.includes(property.typeId) ? 20 : 0) + agency.reputation * .5 - (kind === "rent" ? agency.rentCommission : agency.saleCommission) * 80;
  return score(b) - score(a) || a.id.localeCompare(b.id);
})[0] || null;

function createListingMutable(state, property, options = {}) {
  if (!property || state.listings.some((listing) => listing.propertyId === property.id && listing.status === "active")) return null;
  const kind = options.kind === "rent" && property.typeId !== "lote" ? "rent" : "sale";
  if (kind === "rent" && property.occupiedUnits > 0 && !options.allowOccupied) return null;
  const agency = state.agencies.find((entry) => entry.id === options.agencyId) || chooseAgency(state, property, kind);
  const valuation = evaluateRealEstateProperty(property, { state }, { week: state.currentWeek });
  const basePrice = kind === "rent" ? valuation.monthlyRent : valuation.saleValue;
  const listing = normalizeListing({
    id: nextId(state, "real-estate-listing"), propertyId: property.id, kind,
    sellerId: options.sellerId || property.ownerId || "municipality", agencyId: agency?.id || null,
    askingPrice: round(Math.max(1, finite(options.price) || basePrice)), originalPrice: round(Math.max(1, finite(options.price) || basePrice)), negotiable: options.negotiable !== false,
    occupied: property.occupiedUnits > 0, status: "active", createdWeek: state.currentWeek, expiresWeek: state.currentWeek + integer(options.durationWeeks ?? 16, 4, 104),
    availableUnits: Math.max(1, property.vacantUnits), completedUnits: 0,
    priceHistory: [{ week: state.currentWeek, price: round(Math.max(1, finite(options.price) || basePrice)), reason: "listing_created" }],
  }, state.currentWeek, state.listings.length);
  state.listings.unshift(listing);
  state.listings = state.listings.slice(0, REAL_ESTATE_LIMITS.listings);
  property.listingId = listing.id;
  property.valuation = valuation;
  if (agency) {
    agency.portfolioIds = unique([listing.id, ...agency.portfolioIds], 500);
    agency.history.unshift({ week: state.currentWeek, text: `${property.name} entrou na carteira para ${kind === "rent" ? "locação" : "venda"}.`, listingId: listing.id });
    agency.history = agency.history.slice(0, 80);
  }
  state.stats.listingsCreated++;
  return listing;
}

export function createRealEstateListing(stateInput, propertyId, options = {}) {
  const state = normalizeRealEstateDynamics(stateInput, {}, { week: options.week ?? stateInput?.currentWeek });
  const property = state.properties.find((entry) => entry.id === propertyId || entry.buildingId === propertyId);
  if (!property) return { ok: false, state, reason: "property_not_found", listing: null };
  const listing = createListingMutable(state, property, options);
  if (!listing) return { ok: false, state, reason: "property_unavailable_or_already_listed", listing: null };
  return { ok: true, state, listing: clone(listing) };
}

export function cancelRealEstateListing(stateInput, listingId, options = {}) {
  const state = normalizeRealEstateDynamics(stateInput, {}, { week: options.week ?? stateInput?.currentWeek });
  const listing = state.listings.find((entry) => entry.id === listingId);
  if (!listing || listing.status !== "active") return { ok: false, state, reason: "active_listing_not_found" };
  listing.status = "cancelled";
  listing.closedWeek = state.currentWeek;
  listing.closeReason = text(options.reason) || "withdrawn";
  const property = state.properties.find((entry) => entry.id === listing.propertyId);
  if (property?.listingId === listing.id) property.listingId = null;
  return { ok: true, state, listing: clone(listing) };
}

export function scoreHousingMatch(householdInput, propertyInput, listingInput, context = {}) {
  const household = { ...householdInput, desiredTypes: unique(householdInput?.desiredTypes), preferredDistrictIds: unique(householdInput?.preferredDistrictIds), desiredAmenities: unique(householdInput?.desiredAmenities) };
  const property = normalizeProperty(propertyInput, propertyInput, {}, 0);
  const listing = normalizeListing(listingInput, context.week || 0, 0);
  const reasons = [];
  if (!RESIDENTIAL_TYPES.has(property.typeId)) reasons.push("not_residential");
  if (listing.status !== "active") reasons.push("listing_inactive");
  if (property.vacantUnits <= 0) reasons.push("no_vacancy");
  if (property.capacity > 0 && household.size > property.capacity) reasons.push("insufficient_capacity");
  const affordabilityLimit = listing.kind === "rent" ? Math.max(1, finite(household.maxRent)) : Math.max(1, finite(household.maxPrice));
  const affordabilityRatio = listing.askingPrice / affordabilityLimit;
  const downPayment = listing.kind === "sale" ? listing.askingPrice * .2 : listing.askingPrice * 2;
  if (listing.kind === "rent" && affordabilityRatio > 1.18) reasons.push("rent_unaffordable");
  if (listing.kind === "sale" && affordabilityRatio > 1.22) reasons.push("price_unaffordable");
  if (listing.kind === "sale" && finite(household.liquidAssets) < downPayment * .65) reasons.push("down_payment_shortfall");
  const typeFit = household.desiredTypes.includes(property.typeId) ? 100 : 48;
  const districtFit = !household.preferredDistrictIds.length || household.preferredDistrictIds.includes(property.districtId) ? 100 : 55;
  const capacityFit = property.capacity ? clamp(100 - Math.abs(property.capacity - household.size) * 8, 35, 100) : 50;
  const affordability = clamp(112 - affordabilityRatio * 72, 0, 100);
  const amenitiesMatched = household.desiredAmenities.filter((amenity) => property.amenities.includes(amenity)).length;
  const amenitiesFit = household.desiredAmenities.length ? amenitiesMatched / household.desiredAmenities.length * 100 : 72;
  const location = finite(context.district?.locationScore ?? context.locationScore, 58);
  const score = round(typeFit * .17 + districtFit * .15 + capacityFit * .18 + affordability * .3 + property.condition * .09 + amenitiesFit * .06 + location * .05);
  const fatal = reasons.some((reason) => ["not_residential", "listing_inactive", "no_vacancy", "insufficient_capacity", "rent_unaffordable", "price_unaffordable"].includes(reason));
  return {
    eligible: !fatal && score >= 45,
    score,
    affordabilityRatio: round(affordabilityRatio, 3),
    upfrontRequired: round(downPayment),
    reasons,
    breakdown: { type: round(typeFit), district: round(districtFit), capacity: round(capacityFit), affordability: round(affordability), condition: round(property.condition), amenities: round(amenitiesFit), location: round(location) },
  };
}

const rankHousingMatches = (state, household, options = {}) => state.listings.filter((listing) => listing.status === "active").map((listing) => {
    const property = state.properties.find((entry) => entry.id === listing.propertyId);
    if (!property) return null;
    const district = state.districts.find((entry) => entry.id === property.districtId);
    const assessment = scoreHousingMatch(household, property, listing, { week: state.currentWeek, district });
    return { listingId: listing.id, propertyId: property.id, propertyName: property.name, districtId: property.districtId, kind: listing.kind, price: listing.askingPrice, ...assessment };
  }).filter((entry) => entry?.eligible).sort((a, b) => b.score - a.score || a.price - b.price).slice(0, options.limit || 12);

export function findHousingMatches(stateInput, snapshot = {}, householdId, options = {}) {
  const state = normalizeRealEstateDynamics(stateInput, snapshot, options);
  const household = state.households.find((entry) => entry.id === householdId);
  if (!household) return { household: null, matches: [], reason: "household_not_found" };
  const matches = rankHousingMatches(state, household, options);
  return { household: clone(household), matches };
}

const projectDefaults = (typeId, units = 1) => {
  const catalog = TYPE_BY_ID.get(typeId) || TYPE_BY_ID.get("casa");
  const unitArea = { casa: 92, apartamento: 68, predio_residencial: 74, condominio_fechado: 145, comercial: 85, misto: 96, lote: 0 }[typeId] ?? Math.max(40, catalog.minimumArea);
  const effectiveUnits = typeId === "lote" ? Math.max(2, units) : Math.max(1, units);
  const area = Math.max(catalog.minimumArea, Math.round(unitArea * effectiveUnits));
  const capacityPerUnit = Math.max(0, catalog.typicalCapacity / Math.max(1, catalog.typicalUnits));
  return { area, capacity: Math.round(capacityPerUnit * effectiveUnits), units: effectiveUnits };
};

const developableLot = (property) => property?.typeId === "lote"
  && property.developmentEligible !== false
  && ["urbanized", "serviced", "ready"].includes(slug(property.status))
  && (property.serviceLevel >= 55 || property.infrastructure?.roadAccess && property.infrastructure?.water && property.infrastructure?.power)
  && !["civic", "park", "protected", "industrial"].includes(slug(property.zoning));

const buildProjectPhases = (lot, constructionWeeks, week) => {
  const infrastructure = lot?.infrastructure || {};
  const serviced = ["urbanized", "serviced", "ready"].includes(slug(lot?.status)) || finite(lot?.serviceLevel) >= 72;
  const phaseWeeks = {
    subdivision: ["subdivided", "urbanized", "serviced", "ready"].includes(slug(lot?.status)) ? 0 : Math.max(1, Math.ceil((lot?.lotArea || 500) / 900)),
    infrastructure: infrastructure.water && infrastructure.sewer && infrastructure.power ? 0 : 3,
    paving: serviced || infrastructure.roadAccess && infrastructure.paved ? 0 : 2,
    construction: constructionWeeks,
    occupation: 1,
  };
  let activated = false;
  return REAL_ESTATE_DEVELOPMENT_PHASES.map((phase) => {
    const skipped = phaseWeeks[phase.id] === 0;
    const active = !activated && !skipped;
    if (active) activated = true;
    return { id: phase.id, label: phase.label, durationWeeks: phaseWeeks[phase.id], remainingWeeks: phaseWeeks[phase.id], status: skipped ? "completed" : active ? "active" : "pending", progress: skipped ? 1 : 0, startedWeek: active ? week : skipped ? week : null, completedWeek: skipped ? week : null };
  });
};

function createProjectMutable(state, specification = {}, options = {}) {
  const typeId = aliases[slug(specification.typeId)] || classifyRealEstateProperty(specification);
  if (typeId === "lote" && specification.developmentKind !== "subdivision") return null;
  const developer = state.developers.find((entry) => entry.id === specification.developerId) || state.developers.find((entry) => entry.specialties.includes(typeId)) || state.developers[0];
  const lot = state.properties.find((property) => property.id === specification.lotId && developableLot(property));
  if (!developer || !lot) return null;
  const defaults = projectDefaults(typeId, specification.units ?? (typeId === "predio_residencial" ? 12 : typeId === "apartamento" ? 8 : typeId === "misto" ? 10 : 1));
  const units = integer(specification.units ?? defaults.units, 1, 500);
  const area = integer(specification.area ?? defaults.area, 20, 100000);
  const capacity = integer(specification.capacity ?? defaults.capacity, 0, 5000);
  const constructionWeeks = integer(specification.constructionWeeks ?? Math.ceil(5 + area / 95), 4, 104);
  const phases = buildProjectPhases(lot, constructionWeeks, state.currentWeek);
  const durationWeeks = sum(phases, (phase) => phase.durationWeeks);
  const catalog = TYPE_BY_ID.get(typeId);
  const landCost = Math.max(lot.currentValue || 0, lot.lotArea * catalog.baseLandSqm * .7);
  const infrastructureCost = sum(phases.filter((phase) => ["subdivision", "infrastructure", "paving"].includes(phase.id)), (phase) => phase.durationWeeks) * Math.max(42000, lot.lotArea * 68);
  const constructionCost = area * catalog.baseConstructionSqm * .62;
  const totalCost = round(finite(specification.totalCost) || landCost + infrastructureCost + constructionCost);
  const availableCapital = developer.cash + Math.max(0, developer.creditCapacity - developer.committedCapital);
  if (availableCapital < totalCost * .3) return null;
  const equity = Math.min(developer.cash, Math.max(totalCost * .18, Math.min(totalCost, finite(specification.equity))));
  const financing = Math.max(0, totalCost - equity);
  developer.cash = round(Math.max(0, developer.cash - equity));
  developer.committedCapital = round(developer.committedCapital + financing);
  const synthetic = normalizeProperty({ id: "project-assessment", typeId, districtId: lot.districtId, area, lotArea: lot.lotArea, lotWidth: lot.lotWidth, lotDepth: lot.lotDepth, units, capacity, condition: 100, yearBuilt: options.referenceYear || 2026, infrastructure: { water: true, sewer: true, power: true, roadAccess: true, paved: true, transit: lot.infrastructure?.transit }, amenities: specification.amenities || (typeId === "condominio_fechado" ? ["security", "recreation", "garden"] : typeId === "predio_residencial" ? ["elevator", "accessibility"] : []) }, null, {}, 0);
  const projectedValue = round(evaluateRealEstateProperty(synthetic, { state }, { week: state.currentWeek }).saleValue * clamp(finite(specification.salesPremium, 1.08), .8, 1.5));
  const activePhaseIndex = Math.max(0, phases.findIndex((phase) => phase.status === "active"));
  const project = normalizeProject({
    id: nextId(state, "development"), developerId: developer.id, typeId, districtId: lot.districtId, lotId: lot.id,
    name: text(specification.name) || `${TYPE_BY_ID.get(typeId).label} ${lot.name}`,
    status: "active", startedWeek: state.currentWeek, units, capacity, area, lotArea: lot.lotArea, lotWidth: lot.lotWidth, lotDepth: lot.lotDepth, parcelCount: specification.parcelCount ?? (typeId === "casa" && units > 1 ? units : 1),
    durationWeeks, remainingWeeks: durationWeeks, progress: 0, phaseIndex: activePhaseIndex, phaseProgress: 0, phases,
    totalCost, spent: equity, financing, projectedValue,
    history: [{ week: state.currentWeek, phase: phases[activePhaseIndex]?.id, text: `Projeto iniciado na fase de ${phases[activePhaseIndex]?.label.toLowerCase()}.` }],
  }, state.currentWeek, state.projects.length);
  state.projects.unshift(project);
  state.projects = state.projects.slice(0, REAL_ESTATE_LIMITS.projects);
  lot.status = "reserved";
  lot.projectId = project.id;
  developer.activeProjectIds = unique([project.id, ...developer.activeProjectIds], 100);
  developer.history.unshift({ week: state.currentWeek, projectId: project.id, text: `${project.name} entrou em desenvolvimento.` });
  state.stats.projectsStarted++;
  return project;
}

export function createRealEstateProject(stateInput, specification = {}, options = {}) {
  const state = normalizeRealEstateDynamics(stateInput, {}, { week: options.week ?? stateInput?.currentWeek });
  const project = createProjectMutable(state, specification, options);
  return project ? { ok: true, state, project: clone(project) } : { ok: false, state, project: null, reason: "lot_developer_or_financing_unavailable" };
}

const refreshValuations = (state) => {
  state.properties.forEach((property) => {
    const valuation = evaluateRealEstateProperty(property, { state }, { week: state.currentWeek });
    property.valuation = valuation;
    property.currentValue = valuation.saleValue;
    property.estimatedRent = valuation.monthlyRent;
    property.lastValuationWeek = state.currentWeek;
    if (property.typeId !== "lote" && property.occupiedUnits === 0 && !["construction", "reserved"].includes(property.status)) property.vacancyWeeks++;
    else if (property.occupiedUnits > 0) property.vacancyWeeks = 0;
  });
};

const refreshListings = (state, events) => {
  state.listings.filter((listing) => listing.status === "active").forEach((listing) => {
    const property = state.properties.find((entry) => entry.id === listing.propertyId);
    if (!property) {
      listing.status = "cancelled";
      listing.closedWeek = state.currentWeek;
      listing.closeReason = "property_missing";
      return;
    }
    listing.weeksOnMarket++;
    const cell = marketCell(state, property.districtId, property.typeId) || { pressure: 1 };
    const agency = state.agencies.find((entry) => entry.id === listing.agencyId);
    const weeklyViews = Math.max(0, Math.round(cell.pressure * 2 + (agency?.reputation || 60) / 35 + stableHash(`${listing.id}:${state.currentWeek}`) * 3 - 2));
    listing.views += weeklyViews;
    if (agency) agency.inquiries += weeklyViews;
    const valuationPrice = listing.kind === "rent" ? property.estimatedRent : property.currentValue;
    const staleDiscount = listing.weeksOnMarket >= 12 ? Math.min(.035, (listing.weeksOnMarket - 10) * .0025) : 0;
    const demandAdjustment = clamp((cell.pressure - 1) * (listing.kind === "rent" ? .009 : .006), -.012, .016);
    const target = valuationPrice * (1 + demandAdjustment - staleDiscount);
    const maximumChange = listing.kind === "rent" ? .02 : .016;
    const newPrice = round(clamp(listing.askingPrice * .72 + target * .28, listing.askingPrice * (1 - maximumChange), listing.askingPrice * (1 + maximumChange)));
    if (Math.abs(newPrice - listing.askingPrice) >= Math.max(5, listing.askingPrice * .002)) {
      listing.priceHistory.unshift({ week: state.currentWeek, price: newPrice, reason: staleDiscount ? "time_on_market" : demandAdjustment >= 0 ? "market_pressure" : "vacancy" });
      listing.priceHistory = listing.priceHistory.slice(0, REAL_ESTATE_LIMITS.listingHistory);
      listing.askingPrice = newPrice;
    }
    if (state.currentWeek >= listing.expiresWeek) {
      listing.status = "expired";
      listing.closedWeek = state.currentWeek;
      listing.closeReason = "listing_term_ended";
      property.listingId = null;
      state.stats.listingsExpired++;
      events.push({ kind: "listing_expired", week: state.currentWeek, listingId: listing.id, propertyId: property.id, text: `${property.name} saiu do mercado após ${listing.weeksOnMarket} semanas.` });
    }
  });
};

const seedVacantListings = (state, options, events) => {
  if (options.autoListings === false) return;
  const active = state.listings.filter((listing) => listing.status === "active").length;
  const marketable = state.properties.filter((property) => property.typeId !== "lote" && property.status !== "construction" && property.vacantUnits > 0 && !property.listingId);
  const target = integer(options.targetListings ?? Math.max(4, Math.ceil(state.properties.filter((property) => property.typeId !== "lote").length * .18)), 0, 80);
  marketable.sort((a, b) => b.vacancyWeeks - a.vacancyWeeks || b.currentValue - a.currentValue || a.id.localeCompare(b.id)).slice(0, Math.max(0, target - active)).forEach((property) => {
    const rentalBias = RESIDENTIAL_TYPES.has(property.typeId) ? .72 : .45;
    const kind = randomValue(options.random, `listing-kind:${state.currentWeek}:${property.id}`) < rentalBias ? "rent" : "sale";
    const listing = createListingMutable(state, property, { kind, durationWeeks: 12 + Math.floor(stableHash(property.id) * 9) });
    if (listing) events.push({ kind: "listing_created", week: state.currentWeek, propertyId: property.id, listingId: listing.id, text: `${property.name} foi anunciado para ${kind === "rent" ? "aluguel" : "venda"}.` });
  });
};

const ensureHousingSearches = (state, options) => {
  state.households.forEach((household) => {
    const existing = state.searches.find((search) => search.householdId === household.id && search.status === "active");
    const movingVoluntarily = randomValue(options.random, `move-interest:${state.currentWeek}:${household.id}`) < clamp(.018 + household.urgency / 600, .018, .18);
    if (existing) {
      existing.urgency = household.urgency;
      existing.maxRent = household.maxRent;
      existing.maxPrice = household.maxPrice;
      existing.weeksActive++;
      return;
    }
    if (household.urgency < 35 && !movingVoluntarily) return;
    state.searches.unshift({
      id: nextId(state, "housing-search"), householdId: household.id, status: "active", startedWeek: state.currentWeek, weeksActive: 0, urgency: household.urgency,
      preferredKinds: household.liquidAssets >= household.maxPrice * .12 && household.creditScore >= 540 ? ["sale", "rent"] : ["rent"],
      desiredTypes: household.desiredTypes, preferredDistrictIds: household.preferredDistrictIds, maxRent: household.maxRent, maxPrice: household.maxPrice,
      viewedListingIds: [], applications: 0, offers: 0, lastMatchScore: null,
    });
  });
  state.searches = state.searches.slice(0, REAL_ESTATE_LIMITS.searches);
};

const completeHousingTransactions = (state, options, events, effects) => {
  if (options.autoTransactions === false) return [];
  const transactions = [];
  const usedListings = new Map();
  const activeSearches = state.searches.filter((search) => search.status === "active").sort((a, b) => b.urgency - a.urgency || b.weeksActive - a.weeksActive || a.id.localeCompare(b.id));
  const limit = integer(options.transactionLimit ?? Math.max(1, Math.ceil(state.households.length / 45)), 0, 20);
  for (const search of activeSearches) {
    if (transactions.length >= limit) break;
    const household = state.households.find((entry) => entry.id === search.householdId);
    if (!household) continue;
    const matches = rankHousingMatches(state, household, { limit: 8 });
    const match = matches.find((candidate) => {
      if (!search.preferredKinds.includes(candidate.kind)) return false;
      const candidateListing = state.listings.find((entry) => entry.id === candidate.listingId);
      const weeklyCapacity = candidateListing?.kind === "rent" ? 3 : 1;
      return (candidateListing?.availableUnits ?? 1) > 0 && (usedListings.get(candidate.listingId) || 0) < weeklyCapacity;
    });
    if (!match) continue;
    search.lastMatchScore = match.score;
    search.viewedListingIds = unique([match.listingId, ...search.viewedListingIds], 50);
    const listing = state.listings.find((entry) => entry.id === match.listingId);
    const property = state.properties.find((entry) => entry.id === match.propertyId);
    if (!listing || !property) continue;
    listing.inquiries.unshift({ week: state.currentWeek, householdId: household.id, score: match.score });
    listing.inquiries = listing.inquiries.slice(0, REAL_ESTATE_LIMITS.inquiriesPerListing);
    const probability = clamp(.12 + match.score / 250 + household.urgency / 300 + search.weeksActive * .025, .18, .84);
    if (randomValue(options.random, `transaction:${state.currentWeek}:${search.id}:${listing.id}`) >= probability) continue;
    const type = listing.kind === "rent" ? "lease" : "sale";
    const price = round(listing.askingPrice * (listing.negotiable ? clamp(.965 + stableHash(`${household.id}:${listing.id}`) * .05, .94, 1.015) : 1));
    const agency = state.agencies.find((entry) => entry.id === listing.agencyId);
    const commission = round(price * (type === "lease" ? agency?.rentCommission || .07 : agency?.saleCommission || .05));
    const financed = type === "sale" && household.liquidAssets < price;
    const upfront = type === "lease" ? price * 2 : financed ? price * .2 : price;
    household.liquidAssets = round(Math.max(0, household.liquidAssets - upfront));
    household.currentHomeId = property.id;
    household.currentDistrictId = property.districtId;
    household.tenure = type === "lease" ? "rent" : financed ? "mortgage" : "owned";
    household.temporary = false;
    household.overcrowding = 0;
    household.urgency = 5;
    household.lastMoveWeek = state.currentWeek;
    property.occupiedUnits = Math.min(Math.max(1, property.units), property.occupiedUnits + 1);
    property.vacantUnits = Math.max(0, property.units - property.occupiedUnits);
    property.occupiedByIds = unique([household.id, ...property.occupiedByIds], 500);
    property.residentCount += household.size;
    property.status = "occupied";
    property.vacancyWeeks = 0;
    property.lastOccupancyWeek = state.currentWeek;
    if (type === "sale") { property.ownerId = household.id; property.ownerKind = "family"; }
    listing.completedUnits++;
    listing.availableUnits = Math.max(0, property.vacantUnits);
    const listingExhausted = type === "sale" || property.vacantUnits <= 0;
    if (listingExhausted) {
      property.listingId = null;
      listing.status = type === "sale" ? "sold" : "leased";
      listing.closedWeek = state.currentWeek;
      listing.closeReason = type;
    }
    const transaction = {
      id: nextId(state, "property-transaction"), week: state.currentWeek, type, listingId: listing.id, propertyId: property.id, districtId: property.districtId,
      sellerId: listing.sellerId, householdId: household.id, agencyId: agency?.id || null, price, commission, financed, downPayment: type === "sale" ? round(upfront) : null, deposit: type === "lease" ? round(price) : null,
    };
    state.transactions.unshift(transaction);
    transactions.push(transaction);
    usedListings.set(listing.id, (usedListings.get(listing.id) || 0) + 1);
    search.status = "completed";
    search.completedWeek = state.currentWeek;
    search.transactionId = transaction.id;
    if (agency) {
      agency.cash = round(agency.cash + commission);
      agency.revenue = round(agency.revenue + commission);
      if (type === "sale") agency.sales++; else agency.leases++;
      if (listingExhausted) agency.portfolioIds = agency.portfolioIds.filter((id) => id !== listing.id);
    }
    if (type === "sale") state.stats.sales++; else state.stats.leases++;
    state.stats.householdsMoved++;
    state.stats.transactionVolume = round(state.stats.transactionVolume + price);
    state.stats.commissions = round(state.stats.commissions + commission);
    events.push({ kind: type === "sale" ? "property_sale" : "property_lease", week: state.currentWeek, transactionId: transaction.id, householdId: household.id, propertyId: property.id, text: `${household.name} ${type === "sale" ? "comprou" : "alugou"} ${property.name} por R$ ${Math.round(price).toLocaleString("pt-BR")}${type === "lease" ? "/mês" : ""}.` });
    effects.push({ type: "settle_real_estate_transaction", week: state.currentWeek, transactionId: transaction.id, transactionType: type, householdId: household.id, sellerId: listing.sellerId, agencyId: agency?.id || null, price, upfront: round(upfront), commission, financed, recurringMonthlyPayment: type === "lease" ? price : financed ? round((price - upfront) * .0092) : 0 });
    effects.push({ type: "move_household", week: state.currentWeek, householdId: household.id, propertyId: property.id, buildingId: property.buildingId, tenure: household.tenure, transactionId: transaction.id, amount: price, financed });
  }
  state.transactions = state.transactions.slice(0, REAL_ESTATE_LIMITS.transactions);
  return transactions;
};

const projectParcels = (project) => {
  const count = Math.max(1, project.parcelCount || 1);
  const weights = Array.from({ length: count }, (_, index) => .78 + stableHash(`parcel-area:${index * 7919 + 17}:${project.id}`) * .44);
  const totalWeight = sum(weights) || 1;
  const areas = weights.map((weight) => Math.max(40, Math.round(project.lotArea * weight / totalWeight)));
  areas[areas.length - 1] = Math.max(40, areas[areas.length - 1] + project.lotArea - sum(areas));
  return weights.map((weight, index) => {
    const area = areas[index];
    const aspect = .52 + stableHash(`parcel-aspect:${index * 3571 + 29}:${project.id}`) * .46;
    const frontage = round(Math.sqrt(area * aspect), 2);
    return { id: `${project.id}:parcel:${index + 1}`, index: index + 1, area, frontage, depth: round(area / frontage, 2) };
  });
};

const phaseEffect = (project, phase, week) => {
  const base = { week, projectId: project.id, developerId: project.developerId, lotId: project.lotId, districtId: project.districtId };
  if (phase.id === "subdivision") return { ...base, type: "subdivide_lot", parcelCount: project.parcelCount, lotWidth: project.lotWidth, lotDepth: project.lotDepth, parcels: projectParcels(project) };
  if (phase.id === "infrastructure") return { ...base, type: "connect_infrastructure", systems: ["water", "sewer", "power"] };
  if (phase.id === "paving") return { ...base, type: "pave_access", roadAccess: true };
  if (phase.id === "construction") return { ...base, type: "create_building", propertyTypeId: project.typeId, units: project.units, capacity: project.capacity, area: project.area, parcels: project.typeId === "casa" && project.parcelCount > 1 ? projectParcels(project) : [] };
  return { ...base, type: "open_for_occupation", propertyTypeId: project.typeId, units: project.units };
};

const createCompletedProjectProperties = (state, project, lot) => {
  const parcels = project.typeId === "casa" && project.parcelCount > 1 ? projectParcels(project) : [{ id: lot.id, area: project.lotArea, frontage: project.lotWidth, depth: project.lotDepth }];
  return parcels.map((parcel, index) => {
    const id = nextId(state, "developed-property");
    const divided = parcels.length > 1;
    return normalizeProperty({
      id, buildingId: id, lotId: parcel.id, projectId: project.id, source: "project", name: divided ? `${project.name} · unidade ${index + 1}` : project.name, typeId: project.typeId, districtId: project.districtId,
      area: divided ? Math.max(42, Math.round(project.area / parcels.length)) : project.area, lotArea: parcel.area, lotWidth: parcel.frontage, lotDepth: parcel.depth, units: divided ? 1 : project.units, capacity: divided ? Math.max(1, Math.round(project.capacity / parcels.length)) : project.capacity, condition: 100, yearBuilt: 2026,
      status: "vacant", occupiedUnits: 0, ownerId: project.developerId, ownerKind: "developer", infrastructure: { water: true, sewer: true, power: true, roadAccess: true, paved: true, transit: lot.infrastructure?.transit },
      amenities: project.typeId === "condominio_fechado" ? ["security", "recreation", "garden"] : project.typeId === "predio_residencial" ? ["elevator", "accessibility"] : [],
    }, null, {}, state.properties.length + index);
  });
};

const advanceProjects = (state, options, events, effects) => {
  state.projects.filter((project) => project.status === "active").forEach((project) => {
    const developer = state.developers.find((entry) => entry.id === project.developerId);
    const lot = state.properties.find((entry) => entry.id === project.lotId);
    let phase = project.phases[project.phaseIndex];
    while (phase?.status === "completed" && project.phaseIndex < project.phases.length - 1) phase = project.phases[++project.phaseIndex];
    if (!phase || !developer || !lot) { project.status = "on_hold"; return; }
    if (phase.status === "pending") { phase.status = "active"; phase.startedWeek = state.currentWeek; }
    const weeklyCost = project.totalCost / Math.max(1, project.durationWeeks);
    project.spent = round(Math.min(project.totalCost, project.spent + weeklyCost));
    phase.remainingWeeks = Math.max(0, phase.remainingWeeks - 1);
    phase.progress = round(phase.durationWeeks ? 1 - phase.remainingWeeks / phase.durationWeeks : 1, 4);
    project.phaseProgress = phase.progress;
    project.remainingWeeks = Math.max(0, project.remainingWeeks - 1);
    project.progress = round(1 - project.remainingWeeks / Math.max(1, project.durationWeeks), 4);
    if (phase.remainingWeeks > 0) return;
    phase.status = "completed";
    phase.completedWeek = state.currentWeek;
    project.history.unshift({ week: state.currentWeek, phase: phase.id, text: `${phase.label} concluída.` });
    project.history = project.history.slice(0, REAL_ESTATE_LIMITS.projectHistory);
    effects.push(phaseEffect(project, phase, state.currentWeek));
    events.push({ kind: "development_phase", week: state.currentWeek, projectId: project.id, phase: phase.id, text: `${project.name}: ${phase.label.toLowerCase()} concluída.` });
    if (phase.id === "subdivision") { lot.status = "subdivided"; }
    if (phase.id === "infrastructure") lot.infrastructure = { ...lot.infrastructure, water: true, sewer: true, power: true };
    if (phase.id === "paving") lot.infrastructure = { ...lot.infrastructure, roadAccess: true, paved: true };
    if (phase.id === "construction" && !project.createdPropertyIds.length) {
      const properties = createCompletedProjectProperties(state, project, lot);
      properties.forEach((property) => { property.status = "awaiting_occupancy_permit"; state.properties.push(property); project.createdPropertyIds.push(property.id); });
    }
    if (phase.id === "occupation") {
      project.status = "completed";
      project.completedWeek = state.currentWeek;
      project.progress = 1;
      project.remainingWeeks = 0;
      project.createdPropertyIds.forEach((propertyId) => { const property = state.properties.find((entry) => entry.id === propertyId); if (property) property.status = "vacant"; });
      lot.status = "developed";
      developer.activeProjectIds = developer.activeProjectIds.filter((id) => id !== project.id);
      developer.completedProjects++;
      developer.committedCapital = round(Math.max(0, developer.committedCapital - project.financing));
      developer.reputation = round(clamp(developer.reputation + (project.projectedValue >= project.totalCost ? 1.2 : -.4)));
      state.stats.projectsCompleted++;
      state.stats.unitsDelivered += project.units;
      events.push({ kind: "development_completed", week: state.currentWeek, projectId: project.id, text: `${project.name} recebeu autorização de ocupação e entregou ${project.units} unidade(s).` });
    } else {
      const next = project.phases[project.phaseIndex + 1];
      if (next) { project.phaseIndex++; next.status = "active"; next.startedWeek = state.currentWeek; project.phaseProgress = 0; }
    }
  });
};

const proposeProjects = (state, options, events) => {
  if (options.autoProjects === false) return;
  const active = state.projects.filter((project) => project.status === "active");
  const maximum = integer(options.maximumActiveProjects ?? Math.max(1, Math.ceil(state.households.length / 80)), 0, 8);
  if (active.length >= maximum) return;
  const candidates = [];
  Object.values(state.districtMarkets).forEach((district) => Object.values(district.types).filter((cell) => RESIDENTIAL_TYPES.has(cell.typeId) && cell.pressure >= finite(options.minimumProjectPressure, 1.12)).forEach((cell) => candidates.push({ district, cell })));
  candidates.sort((a, b) => b.cell.pressure - a.cell.pressure || b.cell.demand - a.cell.demand || a.district.districtId.localeCompare(b.district.districtId));
  const candidate = candidates[0];
  if (!candidate) return;
  const lot = state.properties.filter((property) => developableLot(property) && property.districtId === candidate.district.districtId).sort((a, b) => b.lotArea - a.lotArea || a.id.localeCompare(b.id))[0]
    || state.properties.filter(developableLot).sort((a, b) => b.lotArea - a.lotArea || a.id.localeCompare(b.id))[0];
  if (!lot) return;
  const highDensity = lot.developmentRules?.density === "high";
  const typeId = highDensity ? "predio_residencial" : candidate.cell.typeId === "condominio_fechado" && lot.lotArea < 450 ? "casa" : candidate.cell.typeId;
  const densityUnits = highDensity ? Math.max(12, Math.floor(lot.lotArea / 115 * Math.min(8, lot.developmentRules?.maxFloors || 6))) : 0;
  const units = typeId === "predio_residencial" ? integer(highDensity ? densityUnits : 8 + candidate.cell.pressure * 5, 8, highDensity ? 48 : 28) : typeId === "apartamento" ? integer(4 + candidate.cell.pressure * 4, 4, 16) : typeId === "casa" && lot.lotArea > 700 ? integer(lot.lotArea / 260, 2, 12) : 1;
  const developer = state.developers.filter((entry) => entry.specialties.includes(typeId)).sort((a, b) => Number(b.preferredDistrictIds.includes(candidate.district.districtId)) - Number(a.preferredDistrictIds.includes(candidate.district.districtId)) || b.cash + b.creditCapacity - b.committedCapital - (a.cash + a.creditCapacity - a.committedCapital))[0];
  const project = createProjectMutable(state, { developerId: developer?.id, typeId, lotId: lot.id, units, parcelCount: typeId === "casa" ? units : 1 }, options);
  if (project) events.push({ kind: "development_started", week: state.currentWeek, projectId: project.id, districtId: project.districtId, text: `${project.name} iniciou expansão gradual, do loteamento à ocupação.` });
};

export function createRealEstateDynamics(snapshot = {}, options = {}) {
  const state = normalizeRealEstateDynamics(null, snapshot, options);
  const analysis = analyzeNormalizedRealEstateMarket(state, snapshot, options);
  state.districtMarkets = analysis.districtMarkets;
  state.cityMarket = analysis.cityMarket;
  refreshValuations(state);
  if (options.seedListings !== false) seedVacantListings(state, { ...options, autoListings: true }, []);
  state.lastTickWeek = state.currentWeek;
  return state;
}

export function runRealEstateDynamicsWeek(stateInput, snapshot = {}, options = {}) {
  const requestedWeek = normalizedWeek(options.week ?? snapshot.week ?? (stateInput?.currentWeek || 0) + 1);
  const snapshotHasEntities = asArray(snapshot.properties).length || asArray(snapshot.buildings).length || asArray(snapshot.households).length || asArray(snapshot.families).length || asArray(snapshot.lots ?? snapshot.city?.lots).length;
  const state = stateInput?.version === REAL_ESTATE_DYNAMICS_VERSION && !snapshotHasEntities
    ? clone(stateInput)
    : normalizeRealEstateDynamics(stateInput, snapshot, { ...options, week: requestedWeek });
  state.currentWeek = requestedWeek;
  const events = [], effects = [];
  let analysis = analyzeNormalizedRealEstateMarket(state, snapshot, { ...options, week: requestedWeek });
  state.districtMarkets = analysis.districtMarkets;
  state.cityMarket = analysis.cityMarket;
  refreshValuations(state);
  refreshListings(state, events);
  seedVacantListings(state, options, events);
  ensureHousingSearches(state, options);
  const transactions = completeHousingTransactions(state, options, events, effects);
  advanceProjects(state, options, events, effects);
  analysis = analyzeNormalizedRealEstateMarket(state, snapshot, { ...options, week: requestedWeek });
  state.districtMarkets = analysis.districtMarkets;
  state.cityMarket = { ...analysis.cityMarket, transactionVolume: round(sum(state.transactions.filter((transaction) => requestedWeek - transaction.week <= 13), (transaction) => transaction.price)) };
  refreshValuations(state);
  proposeProjects(state, options, events);
  Object.values(state.districtMarkets).forEach((district) => {
    district.history.unshift({ week: requestedWeek, priceIndex: district.priceIndex, rentIndex: district.rentIndex, vacancyRate: district.vacancyRate, demand: round(district.demand, 2), vacantUnits: district.vacantUnits });
    district.history = district.history.slice(0, REAL_ESTATE_LIMITS.districtHistory);
  });
  state.history = [...events, ...state.history].slice(0, REAL_ESTATE_LIMITS.history);
  state.lastTickWeek = requestedWeek;
  return { state, events: clone(events), effects: clone(effects), transactions: clone(transactions), summary: summarizeNormalizedRealEstateDynamics(state) };
}

export const advanceRealEstateWeek = runRealEstateDynamicsWeek;

function summarizeNormalizedRealEstateDynamics(state) {
  const activeListings = state.listings.filter((listing) => listing.status === "active");
  const occupiedUnits = sum(state.properties.filter((property) => property.typeId !== "lote"), (property) => property.occupiedUnits);
  const totalUnits = sum(state.properties.filter((property) => property.typeId !== "lote"), (property) => property.units);
  const activeSearches = state.searches.filter((search) => search.status === "active");
  const activeProjects = state.projects.filter((project) => project.status === "active");
  const phaseCounts = Object.fromEntries(REAL_ESTATE_DEVELOPMENT_PHASES.map((phase) => [phase.id, activeProjects.filter((project) => project.phases?.[project.phaseIndex]?.id === phase.id).length]));
  const districtPressure = Object.values(state.districtMarkets).map((district) => {
    const strongest = Object.values(district.types || {}).sort((a, b) => b.pressure - a.pressure)[0];
    return { districtId: district.districtId, name: district.name, priceIndex: round(district.priceIndex), rentIndex: round(district.rentIndex), vacancyRate: round(district.vacancyRate, 4), strongestDemandType: strongest?.typeId || null, pressure: round(strongest?.pressure || 0, 2) };
  }).sort((a, b) => b.pressure - a.pressure);
  return {
    version: state.version,
    week: state.currentWeek,
    properties: state.properties.length,
    lots: state.properties.filter((property) => property.typeId === "lote").length,
    totalUnits,
    occupiedUnits,
    vacantUnits: Math.max(0, totalUnits - occupiedUnits),
    occupancyRate: round(totalUnits ? occupiedUnits / totalUnits : 0, 4),
    listings: { active: activeListings.length, sale: activeListings.filter((listing) => listing.kind === "sale").length, rent: activeListings.filter((listing) => listing.kind === "rent").length, medianSalePrice: median(activeListings.filter((listing) => listing.kind === "sale").map((listing) => listing.askingPrice)), medianRent: median(activeListings.filter((listing) => listing.kind === "rent").map((listing) => listing.askingPrice)) },
    demand: { activeSearches: activeSearches.length, urgentHouseholds: state.households.filter((household) => household.urgency >= 70).length, cityDemand: state.cityMarket.demand },
    market: clone(state.cityMarket),
    development: { active: activeProjects.length, completed: state.projects.filter((project) => project.status === "completed").length, unitsInPipeline: sum(activeProjects, (project) => project.units), phases: phaseCounts },
    agencies: state.agencies.map((agency) => ({ id: agency.id, name: agency.name, activeListings: activeListings.filter((listing) => listing.agencyId === agency.id).length, sales: agency.sales, leases: agency.leases, reputation: agency.reputation, revenue: agency.revenue })),
    developers: state.developers.map((developer) => ({ id: developer.id, name: developer.name, activeProjects: developer.activeProjectIds.length, completedProjects: developer.completedProjects, committedCapital: developer.committedCapital, reputation: developer.reputation })),
    districts: districtPressure,
    stats: clone(state.stats),
  };
}

export function summarizeRealEstateDynamics(stateInput) {
  return summarizeNormalizedRealEstateDynamics(normalizeRealEstateDynamics(stateInput, {}, { week: stateInput?.currentWeek }));
}

export const realEstateDynamicsApi = Object.freeze({
  createRealEstateDynamics,
  normalizeRealEstateDynamics,
  classifyRealEstateProperty,
  evaluateRealEstateProperty,
  analyzeRealEstateMarket,
  createRealEstateListing,
  cancelRealEstateListing,
  scoreHousingMatch,
  findHousingMatches,
  createRealEstateProject,
  runRealEstateDynamicsWeek,
  advanceRealEstateWeek,
  summarizeRealEstateDynamics,
});
