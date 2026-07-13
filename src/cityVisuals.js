/*
 * Canvas rendering helpers for the city map.
 *
 * Typical integration:
 *   const visuals = createCityVisuals();
 *   const frame = visuals.beginFrame(sim, now, {
 *     tickProgress: simulationAccumulator / speedProfile.step,
 *     speedProfile,
 *   });
 *   visuals.drawDynamic(ctx, sim, viewport, { frame, selectedId });
 *
 * The module has no DOM or asset dependency. All decoration is deterministic
 * from entity ids, so a save looks the same after every load.
 */

const TAU = Math.PI * 2;
const EPSILON = 1e-5;
const DEFAULT_SPEED_PROFILES = Object.freeze({
  1: { minutesPerSecond: 1, step: 1 },
  24: { minutesPerSecond: 24, step: 2 },
  96: { minutesPerSecond: 96, step: 5 },
});

export const CITY_VISUAL_PALETTE = Object.freeze({
  asphalt: "#737a76",
  asphaltEdge: "#5f6763",
  gravel: "#aa9671",
  dirt: "#997653",
  sidewalk: "#c9c7bb",
  curb: "#e0ded2",
  lane: "rgba(248,244,220,.72)",
  shadow: "rgba(37,43,39,.2)",
  window: "#9ab8bd",
  windowLight: "#d9c47c",
  treeDark: "#456d50",
  treeMid: "#64885b",
  treeLight: "#829e68",
  trunk: "#72533b",
  grass: "#83a574",
  grassDark: "#668b61",
  selection: "#fff8d8",
});

const BUILDING_STYLES = Object.freeze({
  home: { wall: "#d5ad79", roof: "#a7654f", trim: "#f0d6ad", accent: "#76564a" },
  shop: { wall: "#cf725b", roof: "#87534b", trim: "#f3d2ac", accent: "#5b4741" },
  park: { wall: "#7da370", roof: "#587c57", trim: "#b9c991", accent: "#6c8052" },
  school: { wall: "#d8b958", roof: "#8e7049", trim: "#f4e2a0", accent: "#715c42" },
  health: { wall: "#dc827d", roof: "#9e5e62", trim: "#f4d8cd", accent: "#a93e43" },
  civic: { wall: "#7598be", roof: "#526e8b", trim: "#d9e0df", accent: "#394f68" },
  default: { wall: "#b59672", roof: "#755e50", trim: "#e4d5bd", accent: "#554b43" },
});

const SKIN_COLORS = Object.freeze({
  clara: "#efc9a9",
  media: "#d8a276",
  morena: "#b97855",
  escura: "#754831",
});

const HAIR_COLORS = Object.freeze({
  pretos: "#292725",
  castanhos: "#604537",
  loiros: "#c5a15e",
  ruivos: "#9e503b",
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const entityId = (entity) => String(entity?.id ?? entity?.plate ?? entity?.name ?? "anonymous");
const normalizeText = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Stable FNV-1a hash used by every procedural visual choice. */
export function hashVisualId(...parts) {
  let hash = 2166136261;
  const text = parts.map((part) => String(part ?? "")).join(":");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic number in [0, 1), useful instead of Math.random(). */
export function visualUnit(id, salt = 0) {
  return hashVisualId(id, salt) / 4294967296;
}

export function visualChoice(values, id, salt = 0) {
  if (!values?.length) return undefined;
  return values[Math.floor(visualUnit(id, salt) * values.length) % values.length];
}

/** Normalizes the map's {w,h,cell,ox,oy} camera object. */
export function createViewport(viewport = {}) {
  return {
    w: Math.max(1, finite(viewport.w ?? viewport.width, 1)),
    h: Math.max(1, finite(viewport.h ?? viewport.height, 1)),
    cell: Math.max(.001, finite(viewport.cell, 1)),
    ox: finite(viewport.ox ?? viewport.offsetX, 0),
    oy: finite(viewport.oy ?? viewport.offsetY, 0),
    padding: Math.max(0, finite(viewport.padding, 24)),
  };
}

export function worldToScreen(viewport, x, y) {
  const view = createViewport(viewport);
  return { x: view.ox + finite(x) * view.cell, y: view.oy + finite(y) * view.cell };
}

/** Four-level LOD. 0 is overview; 3 enables facade and character details. */
export function lodForCell(cell) {
  const size = finite(cell, 1);
  if (size < 6) return 0;
  if (size < 11) return 1;
  if (size < 20) return 2;
  return 3;
}

export function isWorldRectVisible(viewport, x, y, width = 0, height = 0, padding = null) {
  const view = createViewport(viewport);
  const pad = padding == null ? view.padding : Math.max(0, padding);
  const left = view.ox + x * view.cell;
  const top = view.oy + y * view.cell;
  const right = left + width * view.cell;
  const bottom = top + height * view.cell;
  return right >= -pad && bottom >= -pad && left <= view.w + pad && top <= view.h + pad;
}

export function isScreenPointVisible(viewport, x, y, padding = 16) {
  const view = createViewport(viewport);
  return x >= -padding && y >= -padding && x <= view.w + padding && y <= view.h + padding;
}

function simulationTickKey(sim) {
  return `${finite(sim?.week)}:${finite(sim?.day)}:${finite(sim?.minute)}:${finite(sim?.speed)}`;
}

function positionOf(entity) {
  return { x: finite(entity?.x), y: finite(entity?.y) };
}

function tripSignature(person) {
  const trip = person?.currentTrip;
  return trip ? `${trip.mode || ""}:${trip.phase || ""}:${trip.vehicleId || ""}:${trip.destinationId || ""}` : "";
}

/** True when a person should visually travel with a vehicle, not as a map pedestrian. */
export function isPersonEmbarked(person) {
  const trip = person?.currentTrip;
  if (!trip?.vehicleId) return false;
  if (trip.phase === "onboard") return true;
  if (["carro", "taxi", "táxi"].includes(normalizeText(trip.mode))) {
    return !["waiting", "waiting_taxi", "dispatching", "to_stop", "lastmile"].includes(trip.phase);
  }
  return false;
}

function transitionDuration(sim, options, previousChangeAt, now) {
  if (Number.isFinite(options.transitionMs)) return clamp(options.transitionMs, 16, 1600);
  const profile = options.speedProfile || DEFAULT_SPEED_PROFILES[sim?.speed] || DEFAULT_SPEED_PROFILES[1];
  const ideal = finite(profile?.step, 1) / Math.max(EPSILON, finite(profile?.minutesPerSecond, 1)) * 1000;
  const observed = previousChangeAt ? now - previousChangeAt : ideal;
  return clamp(Number.isFinite(observed) && observed > 12 ? Math.min(ideal * 1.2, observed) : ideal, 36, 1100);
}

function stateOutput(state, type) {
  if (!state.output) {
    state.output = {
      id: state.id,
      type,
      x: state.displayX,
      y: state.displayY,
      worldX: state.displayX,
      worldY: state.displayY,
      visualX: state.displayX,
      visualY: state.displayY,
      visualOffsetX: 0,
      visualOffsetY: 0,
      dispersed: false,
      vx: 0,
      vy: 0,
      speed: 0,
      heading: 0,
      moving: false,
      teleported: false,
      onboard: false,
      hidden: false,
      vehicleId: null,
    };
  }
  return state.output;
}

/**
 * Smooths discrete simulation coordinates. Pass tickProgress (0..1) when
 * available; otherwise it derives wall-clock interpolation from the speed.
 */
export class CityMotionInterpolator {
  constructor(options = {}) {
    this.options = {
      personTeleportDistance: 12,
      movingPersonTeleportDistance: 42,
      vehicleTeleportDistance: 34,
      boardingBlendMs: 220,
      stationaryDispersion: true,
      stationaryRadius: .54,
      staleFrameCount: 3,
      ...options,
    };
    this.people = new Map();
    this.vehicles = new Map();
    this.stationarySlots = new Map();
    this.simulation = null;
    this.frameNumber = 0;
    this.lastFrame = null;
  }

  reset(simulation = null) {
    this.people.clear();
    this.vehicles.clear();
    this.stationarySlots.clear();
    this.simulation = simulation;
    this.frameNumber = 0;
    this.lastFrame = null;
  }

  _ensureState(map, entity, now, tickKey, type) {
    const id = entityId(entity);
    let state = map.get(id);
    if (!state) {
      const raw = positionOf(entity);
      state = {
        id,
        rawX: raw.x,
        rawY: raw.y,
        fromX: raw.x,
        fromY: raw.y,
        toX: raw.x,
        toY: raw.y,
        displayX: raw.x,
        displayY: raw.y,
        previousDisplayX: raw.x,
        previousDisplayY: raw.y,
        lastFrameAt: now,
        changeAt: now,
        duration: 0,
        transitionTickKey: tickKey,
        locationId: entity?.locationId ?? null,
        tripSignature: type === "person" ? tripSignature(entity) : "",
        bindingVehicleId: null,
        heading: visualUnit(id, "heading") * TAU,
        seenFrame: this.frameNumber,
        teleported: false,
      };
      map.set(id, state);
      stateOutput(state, type);
    }
    state.seenFrame = this.frameNumber;
    return state;
  }

  _resolveProgress(state, now, tickProgress, tickKey) {
    if (state.duration <= 0) return 1;
    if (Number.isFinite(tickProgress) && state.transitionTickKey === tickKey) return clamp(tickProgress, 0, 1);
    return clamp((now - state.changeAt) / state.duration, 0, 1);
  }

  _resolveState(state, now, tickProgress, tickKey, type, flags = {}) {
    const progress = this._resolveProgress(state, now, tickProgress, tickKey);
    const previousX = state.displayX;
    const previousY = state.displayY;
    state.displayX = lerp(state.fromX, state.toX, progress);
    state.displayY = lerp(state.fromY, state.toY, progress);
    const elapsedSeconds = Math.max(.001, (now - state.lastFrameAt) / 1000);
    const vx = (state.displayX - state.previousDisplayX) / elapsedSeconds;
    const vy = (state.displayY - state.previousDisplayY) / elapsedSeconds;
    const speed = Math.hypot(vx, vy);
    if (speed > .002) state.heading = Math.atan2(vy, vx);
    const output = stateOutput(state, type);
    Object.assign(output, {
      x: state.displayX,
      y: state.displayY,
      worldX: state.displayX,
      worldY: state.displayY,
      visualX: state.displayX,
      visualY: state.displayY,
      visualOffsetX: 0,
      visualOffsetY: 0,
      dispersed: false,
      vx,
      vy,
      speed,
      heading: state.heading,
      moving: speed > .015 || Math.hypot(state.toX - state.displayX, state.toY - state.displayY) > .002,
      teleported: state.teleported,
      onboard: Boolean(flags.onboard),
      hidden: Boolean(flags.hidden),
      vehicleId: flags.vehicleId || null,
      progress,
      changed: Math.abs(previousX - state.displayX) > EPSILON || Math.abs(previousY - state.displayY) > EPSILON,
    });
    state.previousDisplayX = state.displayX;
    state.previousDisplayY = state.displayY;
    state.lastFrameAt = now;
    state.teleported = false;
    return output;
  }

  _isTeleport(entity, state, distance, type) {
    if (entity?.visualTeleport || entity?.teleported || entity?.forceMapSnap) return true;
    if (type === "vehicle") return distance > this.options.vehicleTeleportDistance;
    const moving = Boolean(entity?.currentTrip || entity?.target);
    if (distance > (moving ? this.options.movingPersonTeleportDistance : this.options.personTeleportDistance)) return true;
    const changedLocation = state.locationId != null && entity?.locationId != null && state.locationId !== entity.locationId;
    return changedLocation && !moving && !state.tripSignature && distance > 1.5;
  }

  _retarget(state, entity, sim, now, tickKey, options, type, forceFromDisplay = false) {
    const raw = positionOf(entity);
    const distance = Math.hypot(raw.x - state.rawX, raw.y - state.rawY);
    if (distance <= EPSILON && !forceFromDisplay) {
      if (state.transitionTickKey !== tickKey && Number.isFinite(options.tickProgress)) {
        state.fromX = state.toX;
        state.fromY = state.toY;
        state.displayX = state.toX;
        state.displayY = state.toY;
        state.duration = 0;
      }
      return false;
    }
    const teleport = this._isTeleport(entity, state, distance, type);
    if (teleport) {
      state.fromX = raw.x;
      state.fromY = raw.y;
      state.toX = raw.x;
      state.toY = raw.y;
      state.displayX = raw.x;
      state.displayY = raw.y;
      // A real teleport is a positional snap, not one very fast movement.
      // Reset the derivative baseline while retaining the previous heading.
      state.previousDisplayX = raw.x;
      state.previousDisplayY = raw.y;
      state.lastFrameAt = now;
      state.duration = 0;
      state.teleported = true;
    } else {
      state.fromX = state.displayX;
      state.fromY = state.displayY;
      state.toX = raw.x;
      state.toY = raw.y;
      state.duration = transitionDuration(sim, options, state.changeAt, now);
      state.changeAt = now;
      state.transitionTickKey = tickKey;
    }
    state.rawX = raw.x;
    state.rawY = raw.y;
    return true;
  }

  _updateRegular(map, entity, sim, now, tickKey, tickProgress, options, type, forceFromDisplay = false) {
    const state = this._ensureState(map, entity, now, tickKey, type);
    this._retarget(state, entity, sim, now, tickKey, options, type, forceFromDisplay);
    state.locationId = entity?.locationId ?? null;
    state.tripSignature = type === "person" ? tripSignature(entity) : "";
    return this._resolveState(state, now, tickProgress, tickKey, type);
  }

  _updateEmbarked(person, vehiclePosition, sim, now, tickKey, tickProgress, options) {
    const state = this._ensureState(this.people, person, now, tickKey, "person");
    const vehicleId = person.currentTrip.vehicleId;
    if (state.bindingVehicleId !== vehicleId) {
      state.bindingVehicleId = vehicleId;
      state.bindingAt = now;
      state.bindingFromX = state.displayX;
      state.bindingFromY = state.displayY;
    }
    const blend = clamp((now - state.bindingAt) / Math.max(1, this.options.boardingBlendMs), 0, 1);
    state.displayX = lerp(state.bindingFromX, vehiclePosition.x, blend);
    state.displayY = lerp(state.bindingFromY, vehiclePosition.y, blend);
    state.fromX = state.displayX;
    state.fromY = state.displayY;
    state.toX = state.displayX;
    state.toY = state.displayY;
    state.rawX = finite(person.x, vehiclePosition.x);
    state.rawY = finite(person.y, vehiclePosition.y);
    state.duration = 0;
    state.locationId = person.locationId ?? null;
    state.tripSignature = tripSignature(person);
    state.heading = vehiclePosition.heading;
    return this._resolveState(state, now, tickProgress, tickKey, "person", {
      onboard: true,
      hidden: true,
      vehicleId,
    });
  }

  _prune(map) {
    for (const [id, state] of map) {
      if (this.frameNumber - state.seenFrame > this.options.staleFrameCount) map.delete(id);
    }
  }

  _applyStationaryDispersion(sim, positions) {
    // Outputs are stable objects reused between frames. Always restore their
    // physical position before applying this frame's optional visual offset.
    for (const output of positions.values()) {
      output.x = output.worldX;
      output.y = output.worldY;
      output.visualX = output.worldX;
      output.visualY = output.worldY;
      output.visualOffsetX = 0;
      output.visualOffsetY = 0;
      output.dispersed = false;
    }
    if (this.options.stationaryDispersion === false) {
      this.stationarySlots.clear();
      return;
    }

    const groups = new Map();
    const stationaryIds = new Set();
    for (const person of sim.people || []) {
      const id = entityId(person), output = positions.get(id);
      // Trips and active paths always retain their exact simulation position.
      if (!output || output.hidden || person.currentTrip || person.target || output.moving || person.alive === false) continue;
      const coordinateKey = `${Math.round(output.worldX * 20)}:${Math.round(output.worldY * 20)}`;
      const key = `${person.locationId || "world"}:${coordinateKey}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ id, person, output });
      stationaryIds.add(id);
    }
    for (const id of this.stationarySlots.keys()) if (!stationaryIds.has(id)) this.stationarySlots.delete(id);

    const buildingById = new Map((sim.buildings || []).map((building) => [String(building.id), building]));
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (const [key, entries] of groups) {
      if (entries.length < 2) continue;
      const used = new Set();
      for (const entry of entries) {
        const assignment = this.stationarySlots.get(entry.id);
        if (assignment?.key === key && !used.has(assignment.slot)) used.add(assignment.slot);
        else this.stationarySlots.delete(entry.id);
      }
      const newcomers = entries.filter((entry) => !this.stationarySlots.has(entry.id))
        .sort((a, b) => hashVisualId(a.id, "stationary-order") - hashVisualId(b.id, "stationary-order") || a.id.localeCompare(b.id));
      for (const entry of newcomers) {
        let slot = 0;
        while (used.has(slot)) slot += 1;
        used.add(slot);
        this.stationarySlots.set(entry.id, { key, slot });
      }

      const building = buildingById.get(String(entries[0].person.locationId || ""));
      const availableRadius = building
        ? Math.max(.2, Math.min(finite(building.w, 1), finite(building.h, 1)) * .24)
        : finite(this.options.stationaryRadius, .54);
      const maxRadius = Math.min(finite(this.options.stationaryRadius, .54), availableRadius);
      const rotation = visualUnit(key, "stationary-rotation") * TAU;
      for (const entry of entries) {
        const slot = this.stationarySlots.get(entry.id)?.slot || 0;
        const radius = Math.min(maxRadius, .31 + Math.sqrt(slot + 1) * .075);
        const angle = rotation + slot * goldenAngle;
        const offsetX = Math.cos(angle) * radius;
        const offsetY = Math.sin(angle) * radius;
        Object.assign(entry.output, {
          x: entry.output.worldX + offsetX,
          y: entry.output.worldY + offsetY,
          visualX: entry.output.worldX + offsetX,
          visualY: entry.output.worldY + offsetY,
          visualOffsetX: offsetX,
          visualOffsetY: offsetY,
          dispersed: true,
        });
      }
    }
  }

  update(sim, now = globalThis.performance?.now?.() ?? Date.now(), options = {}) {
    if (!sim) throw new TypeError("CityMotionInterpolator.update requires a simulation object.");
    if (this.simulation !== sim) this.reset(sim);
    this.frameNumber += 1;
    const tickKey = options.tickKey ?? simulationTickKey(sim);
    const tickProgress = Number.isFinite(options.tickProgress) ? clamp(options.tickProgress, 0, 1) : null;
    const vehiclePositions = new Map();
    const personPositions = new Map();

    for (const vehicle of sim.vehicles || []) {
      const output = this._updateRegular(this.vehicles, vehicle, sim, now, tickKey, tickProgress, options, "vehicle");
      vehiclePositions.set(entityId(vehicle), output);
    }
    for (const person of sim.people || []) {
      const state = this.people.get(entityId(person));
      const vehicleId = isPersonEmbarked(person) ? String(person.currentTrip.vehicleId) : null;
      const vehiclePosition = vehicleId ? vehiclePositions.get(vehicleId) : null;
      let output;
      if (vehiclePosition) output = this._updateEmbarked(person, vehiclePosition, sim, now, tickKey, tickProgress, options);
      else {
        const wasBound = Boolean(state?.bindingVehicleId);
        if (state) state.bindingVehicleId = null;
        output = this._updateRegular(this.people, person, sim, now, tickKey, tickProgress, options, "person", wasBound);
      }
      personPositions.set(entityId(person), output);
    }
    this._applyStationaryDispersion(sim, personPositions);
    this._prune(this.people);
    this._prune(this.vehicles);

    const peopleById = new Map((sim.people || []).map((person) => [entityId(person), person]));
    const hitTestPeople = (x, y, hitOptions = {}) => {
      const radius = Math.max(0, finite(hitOptions.radius, .35));
      const allowed = normalizeIdSelection(hitOptions.ids ?? hitOptions.people);
      const hits = [];
      // Reverse array order matches the painter's topmost-first order.
      for (let index = (sim.people || []).length - 1; index >= 0; index -= 1) {
        const person = sim.people[index], id = entityId(person), position = personPositions.get(id);
        if (!position || position.hidden && hitOptions.includeHidden !== true) continue;
        if (allowed === false || allowed instanceof Set && !allowed.has(id)) continue;
        if (typeof hitOptions.predicate === "function" && !hitOptions.predicate(person, position)) continue;
        const distance = Math.hypot(position.x - finite(x), position.y - finite(y));
        if (distance <= radius) hits.push({ person: peopleById.get(id) || person, position, distance, drawIndex: index });
      }
      hits.sort((a, b) => a.distance - b.distance || b.drawIndex - a.drawIndex);
      return hits;
    };
    const frame = {
      now,
      tickKey,
      tickProgress,
      people: personPositions,
      visiblePeople: new Map([...personPositions].filter(([, position]) => !position.hidden)),
      vehicles: vehiclePositions,
      person: (personOrId) => personPositions.get(typeof personOrId === "object" ? entityId(personOrId) : String(personOrId)),
      vehicle: (vehicleOrId) => vehiclePositions.get(typeof vehicleOrId === "object" ? entityId(vehicleOrId) : String(vehicleOrId)),
      hitTestPeople,
      hitTestPerson: (x, y, hitOptions = {}) => hitTestPeople(x, y, hitOptions)[0] || null,
    };
    this.lastFrame = frame;
    return frame;
  }

  person(personOrId) {
    return this.lastFrame?.person(personOrId) || null;
  }

  vehicle(vehicleOrId) {
    return this.lastFrame?.vehicle(vehicleOrId) || null;
  }
}

export const createMotionInterpolator = (options) => new CityMotionInterpolator(options);

function roadLine(ctx, street, view) {
  ctx.beginPath();
  if (street.axis === "v") {
    const x = view.ox + finite(street.at) * view.cell;
    ctx.moveTo(x, -view.padding);
    ctx.lineTo(x, view.h + view.padding);
  } else {
    const y = view.oy + finite(street.at) * view.cell;
    ctx.moveTo(-view.padding, y);
    ctx.lineTo(view.w + view.padding, y);
  }
}

/** Detailed road with curb, sidewalk, markings, condition and construction state. */
export function drawDetailedRoad(ctx, street, viewport, options = {}) {
  if (!ctx || !street) return false;
  const view = createViewport(viewport);
  const lod = options.lod ?? lodForCell(view.cell);
  const avenue = street.kind === "avenue" || finite(street.lanes) >= 4;
  const roadWidth = Math.max(2, view.cell * (avenue ? .52 : .4));
  const asphalt = street.surface === "asfalto" || !street.surface;
  const gravel = street.surface === "cascalho";
  const roadColor = asphalt ? CITY_VISUAL_PALETTE.asphalt : gravel ? CITY_VISUAL_PALETTE.gravel : CITY_VISUAL_PALETTE.dirt;
  const incomplete = ![undefined, "complete", "completed", "concluída", "concluida"].includes(street.constructionStatus);
  ctx.save();
  ctx.lineCap = "butt";

  if (street.sidewalk !== false && lod >= 1) {
    ctx.strokeStyle = CITY_VISUAL_PALETTE.sidewalk;
    ctx.lineWidth = roadWidth + Math.max(3, view.cell * .18);
    roadLine(ctx, street, view);
    ctx.stroke();
    ctx.strokeStyle = CITY_VISUAL_PALETTE.curb;
    ctx.lineWidth = roadWidth + Math.max(1.5, view.cell * .07);
    roadLine(ctx, street, view);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(73,66,54,.2)";
    ctx.lineWidth = roadWidth + Math.max(2, view.cell * .1);
    roadLine(ctx, street, view);
    ctx.stroke();
  }

  ctx.strokeStyle = roadColor;
  ctx.lineWidth = roadWidth;
  roadLine(ctx, street, view);
  ctx.stroke();

  if (asphalt && lod >= 1) {
    ctx.strokeStyle = "rgba(250,248,229,.62)";
    ctx.lineWidth = Math.max(.65, Math.min(1.35, view.cell * .055));
    ctx.setLineDash(avenue ? [Math.max(5, view.cell * .36), Math.max(5, view.cell * .3)] : [Math.max(4, view.cell * .28), Math.max(6, view.cell * .45)]);
    roadLine(ctx, street, view);
    ctx.stroke();
    ctx.setLineDash([]);
    if (avenue && lod >= 2) {
      const laneOffset = roadWidth * .24;
      ctx.strokeStyle = "rgba(244,242,225,.27)";
      ctx.lineWidth = .75;
      for (const sign of [-1, 1]) {
        ctx.save();
        if (street.axis === "v") ctx.translate(sign * laneOffset, 0);
        else ctx.translate(0, sign * laneOffset);
        roadLine(ctx, street, view);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  if (lod >= 3 && asphalt && finite(street.condition, 100) < 74) {
    const count = clamp(Math.round((78 - finite(street.condition, 78)) / 8), 1, 5);
    ctx.strokeStyle = "rgba(45,48,45,.25)";
    ctx.lineWidth = .7;
    for (let index = 0; index < count; index += 1) {
      const unit = visualUnit(street.id, `crack:${index}`);
      const along = (street.axis === "v" ? view.h : view.w) * (.1 + unit * .8);
      const across = (visualUnit(street.id, `side:${index}`) - .5) * roadWidth * .55;
      ctx.beginPath();
      if (street.axis === "v") {
        const x = view.ox + finite(street.at) * view.cell + across;
        ctx.moveTo(x - 2, along - 3); ctx.lineTo(x + 1, along); ctx.lineTo(x - 1, along + 4);
      } else {
        const y = view.oy + finite(street.at) * view.cell + across;
        ctx.moveTo(along - 3, y - 2); ctx.lineTo(along, y + 1); ctx.lineTo(along + 4, y - 1);
      }
      ctx.stroke();
    }
  }

  if (incomplete) {
    ctx.strokeStyle = "rgba(239,173,63,.9)";
    ctx.lineWidth = Math.max(2, roadWidth * .28);
    ctx.setLineDash([5, 5]);
    roadLine(ctx, street, view);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
  return true;
}

function drawCrosswalk(ctx, x, y, size, vertical) {
  ctx.save();
  ctx.fillStyle = "rgba(244,241,218,.58)";
  const stripe = Math.max(1, size * .075);
  const span = size * .48;
  for (let index = -2; index <= 2; index += 1) {
    if (vertical) ctx.fillRect(x - span / 2, y + index * stripe * 2.1 - stripe / 2, span, stripe);
    else ctx.fillRect(x + index * stripe * 2.1 - stripe / 2, y - span / 2, stripe, span);
  }
  ctx.restore();
}

export function drawRoadNetwork(ctx, streets = [], viewport, options = {}) {
  const view = createViewport(viewport);
  for (const street of streets) drawDetailedRoad(ctx, street, view, options);
  if ((options.lod ?? lodForCell(view.cell)) >= 2 && options.crosswalks !== false) {
    const vertical = streets.filter((street) => street.axis === "v");
    const horizontal = streets.filter((street) => street.axis !== "v");
    for (const vStreet of vertical) for (const hStreet of horizontal) {
      const x = view.ox + finite(vStreet.at) * view.cell;
      const y = view.oy + finite(hStreet.at) * view.cell;
      if (!isScreenPointVisible(view, x, y, view.cell)) continue;
      if (visualUnit(`${vStreet.id}:${hStreet.id}`, "crosswalk") < .58) {
        drawCrosswalk(ctx, x, y - view.cell * .33, view.cell, false);
        drawCrosswalk(ctx, x + view.cell * .33, y, view.cell, true);
      }
    }
  }
}

function buildingStyle(building, options) {
  const base = BUILDING_STYLES[building?.type] || BUILDING_STYLES.default;
  return { ...base, ...(options.styles?.[building?.type] || {}), ...(options.style || {}) };
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawParkPlot(ctx, building, rect, style, lod) {
  const { x, y, width, height } = rect;
  ctx.fillStyle = style.wall;
  roundedRectPath(ctx, x, y, width, height, Math.min(5, width * .08));
  ctx.fill();
  ctx.strokeStyle = "rgba(54,91,55,.28)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (lod >= 1) {
    ctx.strokeStyle = "rgba(224,208,164,.75)";
    ctx.lineWidth = clamp(Math.min(width, height) * .12, 1.4, 5);
    ctx.lineCap = "round";
    ctx.beginPath();
    if (visualUnit(building.id, "park-path") > .5) {
      ctx.moveTo(x + width * .08, y + height * .78);
      ctx.bezierCurveTo(x + width * .35, y + height * .3, x + width * .66, y + height * .76, x + width * .94, y + height * .2);
    } else {
      ctx.moveTo(x + width * .1, y + height * .45);
      ctx.bezierCurveTo(x + width * .38, y + height * .12, x + width * .62, y + height * .9, x + width * .92, y + height * .52);
    }
    ctx.stroke();
  }
  if (lod >= 2 && Math.min(width, height) > 18 && visualUnit(building.id, "water") > .62) {
    ctx.fillStyle = "rgba(111,157,165,.7)";
    ctx.beginPath();
    ctx.ellipse(x + width * .68, y + height * .32, width * .13, height * .1, -.25, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(232,225,178,.55)";
    ctx.stroke();
  }
}

function drawFacadeWindows(ctx, building, rect, style, lod) {
  if (lod < 2 || rect.width < 14 || rect.height < 11) return;
  const floors = clamp(Math.round(finite(building.floors, 1)), 1, lod >= 3 ? 7 : 3);
  const columns = clamp(Math.floor(rect.width / (lod >= 3 ? 8 : 11)), 2, lod >= 3 ? 9 : 5);
  const windowWidth = clamp(rect.width / (columns * 2.8), 1.2, 4);
  const windowHeight = clamp(rect.height / (floors * 4), 1.1, 3.5);
  const litBase = visualUnit(building.id, "lights");
  for (let floor = 0; floor < floors; floor += 1) {
    const wy = rect.y + rect.height * (.24 + floor * .52 / Math.max(1, floors - 1));
    for (let column = 0; column < columns; column += 1) {
      const wx = rect.x + rect.width * (.14 + column * .72 / Math.max(1, columns - 1));
      const lit = (litBase + visualUnit(building.id, `window:${floor}:${column}`)) % 1 > .74;
      ctx.fillStyle = lit ? CITY_VISUAL_PALETTE.windowLight : CITY_VISUAL_PALETTE.window;
      ctx.fillRect(wx - windowWidth / 2, wy - windowHeight / 2, windowWidth, windowHeight);
      if (lod >= 3) {
        ctx.strokeStyle = "rgba(47,63,66,.35)";
        ctx.lineWidth = .5;
        ctx.strokeRect(wx - windowWidth / 2, wy - windowHeight / 2, windowWidth, windowHeight);
      }
    }
  }
}

function drawBuildingSymbol(ctx, building, rect, style, lod) {
  if (lod < 1) return;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const size = clamp(Math.min(rect.width, rect.height) * .2, 2.5, 8);
  if (building.type === "health") {
    ctx.fillStyle = style.accent;
    ctx.fillRect(cx - size * .22, cy - size, size * .44, size * 2);
    ctx.fillRect(cx - size, cy - size * .22, size * 2, size * .44);
  } else if (building.type === "school") {
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = Math.max(1, size * .17);
    ctx.beginPath();
    ctx.moveTo(cx - size, cy - size * .25); ctx.lineTo(cx, cy - size); ctx.lineTo(cx + size, cy - size * .25);
    ctx.moveTo(cx - size * .72, cy); ctx.lineTo(cx, cy + size * .72); ctx.lineTo(cx + size * .72, cy);
    ctx.stroke();
  } else if (building.type === "civic" && lod >= 2) {
    ctx.fillStyle = style.trim;
    const columns = clamp(Math.floor(rect.width / 8), 3, 7);
    for (let index = 0; index < columns; index += 1) {
      const px = rect.x + rect.width * (.2 + index * .6 / Math.max(1, columns - 1));
      ctx.fillRect(px - .75, rect.y + rect.height * .28, 1.5, rect.height * .42);
    }
  }
}

/** Draws a top-down building with deterministic roof/facade detail and culling. */
export function drawDetailedBuilding(ctx, building, viewport, options = {}) {
  if (!ctx || !building) return false;
  const view = createViewport(viewport);
  const bx = finite(building.x), by = finite(building.y);
  const bw = Math.max(.08, finite(building.w, 1)), bh = Math.max(.08, finite(building.h, 1));
  if (!isWorldRectVisible(view, bx, by, bw, bh, options.cullPadding)) return false;
  const x = view.ox + bx * view.cell;
  const y = view.oy + by * view.cell;
  const width = bw * view.cell;
  const height = bh * view.cell;
  if (width < .7 || height < .7) return false;
  const lod = options.lod ?? lodForCell(view.cell);
  const style = buildingStyle(building, options);
  const rect = { x, y, width, height };
  ctx.save();

  if (building.type === "park") drawParkPlot(ctx, building, rect, style, lod);
  else {
    const shadow = lod === 0 ? 1.5 : clamp(view.cell * .11, 2, 7);
    ctx.fillStyle = CITY_VISUAL_PALETTE.shadow;
    roundedRectPath(ctx, x + shadow, y + shadow * .8, width, height, lod >= 2 ? 2 : .5);
    ctx.fill();
    ctx.fillStyle = style.wall;
    roundedRectPath(ctx, x, y, width, height, lod >= 2 ? Math.min(3, width * .06) : .5);
    ctx.fill();

    const inset = lod >= 2 ? clamp(Math.min(width, height) * .075, 1.3, 5) : 1;
    ctx.fillStyle = style.roof;
    roundedRectPath(ctx, x + inset, y + inset, Math.max(1, width - inset * 2), Math.max(1, height - inset * 2), lod >= 2 ? 1.5 : 0);
    ctx.fill();
    ctx.strokeStyle = "rgba(42,45,43,.24)";
    ctx.lineWidth = lod >= 2 ? 1 : .6;
    ctx.stroke();

    const roofStyle = hashVisualId(building.id, "roof") % 3;
    if (lod >= 1 && roofStyle !== 0) {
      ctx.strokeStyle = "rgba(255,241,212,.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if ((roofStyle === 1) === (width >= height)) {
        ctx.moveTo(x + width / 2, y + inset); ctx.lineTo(x + width / 2, y + height - inset);
      } else {
        ctx.moveTo(x + inset, y + height / 2); ctx.lineTo(x + width - inset, y + height / 2);
      }
      ctx.stroke();
    }
    drawFacadeWindows(ctx, building, rect, style, lod);
    drawBuildingSymbol(ctx, building, rect, style, lod);

    if (lod >= 2 && width > 13 && height > 10) {
      const doorWidth = clamp(width * .09, 2, 5);
      const doorHeight = clamp(height * .14, 2.5, 6);
      ctx.fillStyle = style.accent;
      ctx.fillRect(x + width / 2 - doorWidth / 2, y + height - doorHeight, doorWidth, doorHeight);
      ctx.fillStyle = "rgba(245,219,142,.85)";
      ctx.fillRect(x + width / 2 + doorWidth * .2, y + height - doorHeight * .5, .8, .8);
    }
  }

  if (options.labels && building.name && lod >= (options.labelLod ?? 2)) {
    const label = building.type === "home" && building.address?.number ? `Nº ${building.address.number}` : building.name;
    const fontSize = clamp(view.cell * .16, 7, 10);
    ctx.font = `700 ${fontSize}px ${options.fontFamily || "DM Sans, sans-serif"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const metrics = ctx.measureText(label);
    const labelWidth = Math.min(Math.max(12, metrics.width + 7), Math.max(14, width - 3));
    const labelX = x + width / 2;
    const labelY = y + height - Math.max(6, fontSize * .72);
    ctx.fillStyle = "rgba(250,247,235,.78)";
    ctx.fillRect(labelX - labelWidth / 2, labelY - fontSize * .62, labelWidth, fontSize * 1.18);
    ctx.fillStyle = "#26322d";
    ctx.fillText(label, labelX, labelY, Math.max(8, labelWidth - 4));
  }
  ctx.restore();
  return true;
}

export function drawBuildingLayer(ctx, buildings = [], viewport, options = {}) {
  let drawn = 0;
  const ordered = options.sort === false ? buildings : [...buildings].sort((a, b) => finite(a.y) - finite(b.y) || finite(a.x) - finite(b.x));
  for (const building of ordered) if (drawDetailedBuilding(ctx, building, viewport, options)) drawn += 1;
  return drawn;
}

function pointInsideBuilding(x, y, building, margin = .12) {
  return x >= finite(building.x) - margin && x <= finite(building.x) + finite(building.w, 1) + margin
    && y >= finite(building.y) - margin && y <= finite(building.y) + finite(building.h, 1) + margin;
}

function nearStreet(x, y, streets, clearance) {
  return streets.some((street) => Math.abs((street.axis === "v" ? x : y) - finite(street.at)) < clearance);
}

/** Creates a deterministic, world-space vegetation layout; safe to cache. */
export function createVegetationLayout(source, options = {}) {
  const city = source?.city || source || {};
  const buildings = options.buildings || source?.buildings || [];
  const streets = options.streets || city.streets || [];
  const bounds = options.bounds || city.bounds || { width: 38, height: 32 };
  const spacing = clamp(finite(options.spacing, 1.45), .65, 4);
  const density = clamp(finite(options.density, .34), 0, 1);
  const clearance = finite(options.roadClearance, .52);
  const layout = [];
  const columns = Math.ceil(finite(bounds.width, 38) / spacing);
  const rows = Math.ceil(finite(bounds.height, 32) / spacing);
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const id = `vegetation-${column}-${row}`;
    if (visualUnit(id, "density") > density) continue;
    const x = (column + .16 + visualUnit(id, "x") * .68) * spacing;
    const y = (row + .16 + visualUnit(id, "y") * .68) * spacing;
    if (x <= .25 || y <= .25 || x >= finite(bounds.width, 38) - .25 || y >= finite(bounds.height, 32) - .25) continue;
    const containing = buildings.find((building) => pointInsideBuilding(x, y, building, .08));
    if (containing && containing.type !== "park") continue;
    if (!containing && nearStreet(x, y, streets, clearance)) continue;
    const kindRoll = visualUnit(id, "kind");
    layout.push({
      id,
      x,
      y,
      kind: kindRoll > .9 ? "flowerbed" : kindRoll > .72 ? "palm" : "tree",
      scale: .78 + visualUnit(id, "scale") * .48,
      hue: visualUnit(id, "hue"),
      parkId: containing?.id || null,
    });
  }

  // Parks receive a recognizable line of trees even when global density is low.
  for (const park of buildings.filter((building) => building.type === "park")) {
    const count = clamp(Math.round((finite(park.w, 1) + finite(park.h, 1)) * 1.35), 4, 14);
    for (let index = 0; index < count; index += 1) {
      const id = `${park.id}-park-tree-${index}`;
      const edge = index % 4;
      const along = .12 + visualUnit(id, "along") * .76;
      const x = edge === 0 ? finite(park.x) + finite(park.w) * along : edge === 2 ? finite(park.x) + finite(park.w) * along : finite(park.x) + finite(park.w) * (edge === 1 ? .12 : .88);
      const y = edge === 1 ? finite(park.y) + finite(park.h) * along : edge === 3 ? finite(park.y) + finite(park.h) * along : finite(park.y) + finite(park.h) * (edge === 0 ? .12 : .88);
      layout.push({ id, x, y, kind: visualUnit(id, "kind") > .8 ? "palm" : "tree", scale: .82 + visualUnit(id, "scale") * .38, hue: visualUnit(id, "hue"), parkId: park.id });
    }
  }
  return layout;
}

/** Draws an identifiable tree/palm/flowerbed rather than an abstract green dot. */
export function drawDetailedVegetation(ctx, item, viewport, options = {}) {
  if (!ctx || !item) return false;
  const view = createViewport(viewport);
  if (!isWorldRectVisible(view, finite(item.x) - .5, finite(item.y) - .5, 1, 1, options.cullPadding)) return false;
  const lod = options.lod ?? lodForCell(view.cell);
  if (lod === 0 && options.hideAtOverview !== false) return false;
  const point = worldToScreen(view, item.x, item.y);
  const scale = clamp(finite(item.scale, 1), .5, 1.8);
  const radius = clamp(view.cell * .14 * scale, lod === 1 ? 1.6 : 2.3, lod >= 3 ? 7 : 5.2);
  ctx.save();
  ctx.translate(point.x, point.y);
  if (item.kind === "flowerbed") {
    ctx.fillStyle = "rgba(71,91,56,.18)";
    ctx.beginPath(); ctx.ellipse(1.2, 1.5, radius * 1.3, radius * .62, 0, 0, TAU); ctx.fill();
    const colors = ["#d99a69", "#d8c66d", "#bd7891", "#e7d5a4"];
    for (let index = 0; index < (lod >= 3 ? 6 : 3); index += 1) {
      const angle = visualUnit(item.id, `flower:${index}`) * TAU;
      const distance = radius * visualUnit(item.id, `distance:${index}`);
      ctx.fillStyle = colors[index % colors.length];
      ctx.fillRect(Math.cos(angle) * distance - .7, Math.sin(angle) * distance - .7, 1.4, 1.4);
    }
    ctx.restore();
    return true;
  }

  ctx.fillStyle = "rgba(37,55,40,.2)";
  ctx.beginPath(); ctx.ellipse(radius * .35, radius * .6, radius * 1.05, radius * .48, -.15, 0, TAU); ctx.fill();
  ctx.fillStyle = CITY_VISUAL_PALETTE.trunk;
  ctx.fillRect(-Math.max(.65, radius * .13), -radius * .05, Math.max(1.3, radius * .26), radius * 1.05);
  if (item.kind === "palm") {
    ctx.strokeStyle = item.hue > .5 ? CITY_VISUAL_PALETTE.treeMid : CITY_VISUAL_PALETTE.treeDark;
    ctx.lineWidth = Math.max(1, radius * .25);
    ctx.lineCap = "round";
    for (let index = 0; index < (lod >= 3 ? 7 : 5); index += 1) {
      const angle = index / (lod >= 3 ? 7 : 5) * TAU + visualUnit(item.id, "rotation") * .4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(angle) * radius * .55, Math.sin(angle) * radius * .55, Math.cos(angle) * radius * 1.2, Math.sin(angle) * radius * 1.2); ctx.stroke();
    }
  } else {
    const colors = [CITY_VISUAL_PALETTE.treeDark, CITY_VISUAL_PALETTE.treeMid, CITY_VISUAL_PALETTE.treeLight];
    const lobes = lod >= 3 ? 5 : 3;
    for (let index = 0; index < lobes; index += 1) {
      const angle = index / lobes * TAU + visualUnit(item.id, "rotation") * TAU;
      const lobeRadius = radius * (.62 + visualUnit(item.id, `lobe:${index}`) * .22);
      ctx.fillStyle = colors[(index + Math.floor(finite(item.hue) * 3)) % colors.length];
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * radius * .38, Math.sin(angle) * radius * .32 - radius * .35, lobeRadius, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  return true;
}

export function drawVegetationLayer(ctx, layout = [], viewport, options = {}) {
  let drawn = 0;
  for (const item of layout) if (drawDetailedVegetation(ctx, item, viewport, options)) drawn += 1;
  return drawn;
}

function skinColor(person) {
  const value = normalizeText(person?.genetics?.skin || person?.appearance?.skin);
  return SKIN_COLORS[value] || SKIN_COLORS.media;
}

function hairColor(person) {
  const value = normalizeText(person?.genetics?.hair || person?.appearance?.hair);
  return HAIR_COLORS[value] || HAIR_COLORS.castanhos;
}

/** Draws a small animated human silhouette; no generic person bubble is used. */
export function drawPersonSilhouette(ctx, person, screenPosition, options = {}) {
  if (!ctx || !person || !screenPosition || screenPosition.hidden && !options.force) return false;
  const lod = options.lod ?? 2;
  const selected = options.selected || options.selectedId === person.id;
  const ageScale = finite(person.age, 25) < 12 ? .72 : finite(person.age, 25) < 18 ? .86 : 1;
  const size = (lod <= 0 ? 3.5 : lod === 1 ? 4.5 : lod === 2 ? 5.7 : 6.8) * ageScale * finite(options.scale, 1);
  const moving = options.moving ?? screenPosition.moving;
  const phase = moving ? Math.sin(finite(options.now, 0) * .012 + visualUnit(person.id, "walk") * TAU) : 0;
  const outfit = person.alive === false ? "#4b5350" : person.color || "#8f6b73";
  const skin = person.alive === false ? "#858985" : skinColor(person);
  const heading = finite(screenPosition.heading, 0);
  ctx.save();
  ctx.translate(screenPosition.x, screenPosition.y);

  if (selected) {
    ctx.strokeStyle = options.selectionColor || CITY_VISUAL_PALETTE.selection;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 1, size * 1.25, size * .72, 0, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = "rgba(25,33,29,.2)";
  ctx.beginPath(); ctx.ellipse(size * .18, size * .63, size * .72, size * .3, -.08, 0, TAU); ctx.fill();

  // Billboard body with heading used only for the gait direction.
  ctx.strokeStyle = outfit;
  ctx.lineWidth = Math.max(1.1, size * .22);
  ctx.lineCap = "round";
  const direction = Math.cos(heading) >= 0 ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(-size * .19, size * .22);
  ctx.lineTo(-size * (.27 + phase * .12 * direction), size * .68);
  ctx.moveTo(size * .19, size * .22);
  ctx.lineTo(size * (.27 + phase * .12 * direction), size * .68);
  ctx.stroke();

  ctx.fillStyle = outfit;
  ctx.beginPath();
  ctx.moveTo(-size * .42, -size * .24);
  ctx.quadraticCurveTo(0, -size * .48, size * .42, -size * .24);
  ctx.lineTo(size * .3, size * .3);
  ctx.quadraticCurveTo(0, size * .44, -size * .3, size * .3);
  ctx.closePath();
  ctx.fill();

  if (lod >= 2) {
    ctx.strokeStyle = skin;
    ctx.lineWidth = Math.max(1, size * .16);
    ctx.beginPath();
    ctx.moveTo(-size * .3, -size * .08); ctx.lineTo(-size * (.5 - phase * .12), size * .2);
    ctx.moveTo(size * .3, -size * .08); ctx.lineTo(size * (.5 - phase * .12), size * .2);
    ctx.stroke();
  }

  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, -size * .62, size * .3, 0, TAU); ctx.fill();
  if (lod >= 2) {
    ctx.fillStyle = hairColor(person);
    ctx.beginPath(); ctx.arc(0, -size * .7, size * .3, Math.PI, TAU); ctx.fill();
    if (normalizeText(person.identity).includes("mulher") || visualUnit(person.id, "hair-length") > .72) {
      ctx.fillRect(-size * .3, -size * .72, size * .11, size * .35);
      ctx.fillRect(size * .19, -size * .72, size * .11, size * .35);
    }
  }
  ctx.restore();
  return true;
}

function vehicleKind(vehicle) {
  const type = normalizeText(`${vehicle?.type || ""} ${vehicle?.use || ""} ${vehicle?.model || ""}`);
  if (type.includes("onibus") || type.includes("public")) return "bus";
  if (type.includes("entrega") || type.includes("delivery") || type.includes("caminhao")) return "truck";
  if (type.includes("funer")) return "hearse";
  if (type.includes("taxi")) return "taxi";
  return "car";
}

function routeColor(sim, vehicle) {
  return sim?.transportSystem?.routes?.find((route) => route.id === vehicle.routeId)?.color;
}

/** Detailed oriented vehicle for bus, taxi, delivery and private traffic. */
export function drawDetailedVehicle(ctx, vehicle, screenPosition, options = {}) {
  if (!ctx || !vehicle || !screenPosition) return false;
  const lod = options.lod ?? 2;
  const kind = vehicleKind(vehicle);
  const baseLength = kind === "bus" ? 13 : kind === "truck" || kind === "hearse" ? 11 : 8.5;
  const baseWidth = kind === "bus" ? 5.5 : kind === "truck" ? 5.3 : 4.7;
  const zoomScale = lod === 0 ? .74 : lod === 1 ? .86 : lod >= 3 ? 1.12 : 1;
  const length = baseLength * zoomScale;
  const width = baseWidth * zoomScale;
  const colors = ["#58778d", "#8d5f55", "#6f8064", "#927d54", "#6d667f"];
  const fill = options.color || (kind === "bus" ? routeColor(options.sim, vehicle) : null) || (kind === "taxi" ? "#d5aa38" : kind === "truck" ? "#8c694d" : kind === "hearse" ? "#444a48" : visualChoice(colors, vehicle.id, "paint"));
  const heading = finite(screenPosition.heading, visualUnit(vehicle.id, "heading") * TAU);
  ctx.save();
  ctx.translate(screenPosition.x, screenPosition.y);
  ctx.rotate(heading);
  ctx.fillStyle = "rgba(28,34,31,.22)";
  roundedRectPath(ctx, -length / 2 + 1.3, -width / 2 + 1.5, length, width, 1.5);
  ctx.fill();

  ctx.fillStyle = fill;
  roundedRectPath(ctx, -length / 2, -width / 2, length, width, kind === "bus" ? 1.1 : 1.8);
  ctx.fill();
  ctx.strokeStyle = "rgba(37,43,42,.42)";
  ctx.lineWidth = .75;
  ctx.stroke();

  if (lod >= 1) {
    ctx.fillStyle = "#a8c0c2";
    if (kind === "bus") {
      ctx.fillRect(-length * .35, -width * .36, length * .18, width * .22);
      ctx.fillRect(-length * .08, -width * .36, length * .18, width * .22);
      ctx.fillRect(length * .18, -width * .36, length * .18, width * .22);
      ctx.fillStyle = "#d9e2dc";
      ctx.fillRect(length * .32, -width * .31, length * .12, width * .62);
    } else {
      ctx.beginPath();
      ctx.moveTo(-length * .18, -width * .38); ctx.lineTo(length * .25, -width * .38);
      ctx.lineTo(length * .32, width * .38); ctx.lineTo(-length * .18, width * .38); ctx.closePath(); ctx.fill();
    }
    if (kind === "taxi") {
      ctx.fillStyle = "#303733";
      ctx.fillRect(-1.5, -width * .62, 3, 1.4);
    }
  }

  ctx.fillStyle = "#2d302e";
  ctx.fillRect(-length * .3, -width * .62, length * .2, width * .18);
  ctx.fillRect(length * .17, -width * .62, length * .2, width * .18);
  ctx.fillRect(-length * .3, width * .44, length * .2, width * .18);
  ctx.fillRect(length * .17, width * .44, length * .2, width * .18);
  ctx.fillStyle = "#f2d985";
  ctx.fillRect(length / 2 - 1, -width * .32, 1, width * .2);
  ctx.fillRect(length / 2 - 1, width * .12, 1, width * .2);
  ctx.restore();
  return true;
}

function activeVehicleIds(sim) {
  const ids = new Set(sim?.transportSystem?.fleet || []);
  for (const person of sim?.people || []) if (isPersonEmbarked(person)) ids.add(String(person.currentTrip.vehicleId));
  for (const vehicle of sim?.vehicles || []) {
    if (vehicle.use === "delivery" && vehicle.status === "delivery") ids.add(String(vehicle.id));
    if (vehicle.use === "taxi" && ["dispatching", "taxi_service", "active"].includes(vehicle.status)) ids.add(String(vehicle.id));
    if (vehicle.use === "funeral" && vehicle.status !== "inactive") ids.add(String(vehicle.id));
  }
  return ids;
}

function normalizeIdSelection(selection) {
  if (selection === false) return false;
  if (selection == null || selection === true) return null;
  let values;
  if (typeof selection === "string" || typeof selection === "number") values = [selection];
  else if (selection instanceof Set || Array.isArray(selection)) values = selection;
  else if (typeof selection?.[Symbol.iterator] === "function") values = [...selection];
  else values = [selection];
  return new Set([...values].map((value) => typeof value === "object" ? entityId(value) : String(value)));
}

/** Draws interpolated vehicles and people with culling; onboard people are hidden. */
export function drawDynamicCityLayer(ctx, sim, viewport, frame, options = {}) {
  if (!ctx || !sim) return { people: 0, vehicles: 0 };
  const view = createViewport(viewport);
  const lod = options.lod ?? lodForCell(view.cell);
  const currentFrame = frame || options.frame;
  const vehiclesToDraw = options.vehicleIds ? new Set(options.vehicleIds.map(String)) : activeVehicleIds(sim);
  const peopleToDraw = normalizeIdSelection(options.people);
  let vehicles = 0;
  let people = 0;
  if (options.vehicles !== false) for (const vehicle of sim.vehicles || []) {
    if (!vehiclesToDraw.has(String(vehicle.id))) continue;
    const position = currentFrame?.vehicle?.(vehicle) || { ...positionOf(vehicle), heading: visualUnit(vehicle.id, "heading") * TAU };
    const screen = { ...position, ...worldToScreen(view, position.x, position.y) };
    if (!isScreenPointVisible(view, screen.x, screen.y, 20)) continue;
    if (drawDetailedVehicle(ctx, vehicle, screen, { ...options, lod, sim })) vehicles += 1;
  }
  if (peopleToDraw !== false) for (const person of sim.people || []) {
    if (peopleToDraw instanceof Set && !peopleToDraw.has(entityId(person))) continue;
    if (person.alive === false && options.showDeceased !== true && options.selectedId !== person.id) continue;
    const position = currentFrame?.person?.(person) || { ...positionOf(person), heading: 0, moving: Boolean(person.target), hidden: isPersonEmbarked(person) };
    const screenPoint = worldToScreen(view, position.x, position.y);
    const screen = { ...position, ...screenPoint };
    if (position.hidden) {
      if (options.selectedId === person.id) {
        ctx.save();
        ctx.strokeStyle = options.selectionColor || CITY_VISUAL_PALETTE.selection;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(screen.x, screen.y, 9, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      continue;
    }
    if (!isScreenPointVisible(view, screen.x, screen.y, 14)) continue;
    if (drawPersonSilhouette(ctx, person, screen, { ...options, lod, now: currentFrame?.now, selected: options.selectedId === person.id })) people += 1;
  }
  return { people, vehicles };
}

/**
 * Facade that keeps interpolation and cached vegetation together. Its methods
 * are intentionally small so app.js can adopt static and dynamic rendering
 * independently.
 */
export function createCityVisuals(options = {}) {
  const motion = new CityMotionInterpolator(options.motion);
  let vegetationSimulation = null;
  let vegetationSignature = "";
  let vegetation = [];
  const vegetationFor = (sim, layoutOptions = {}) => {
    const signature = `${sim?.buildings?.length || 0}:${sim?.city?.streets?.length || 0}:${layoutOptions.density ?? options.vegetation?.density ?? "default"}`;
    if (vegetationSimulation !== sim || vegetationSignature !== signature) {
      vegetationSimulation = sim;
      vegetationSignature = signature;
      vegetation = createVegetationLayout(sim, { ...options.vegetation, ...layoutOptions });
    }
    return vegetation;
  };
  return {
    motion,
    beginFrame: (sim, now, frameOptions) => motion.update(sim, now, frameOptions),
    personPosition: (personOrId) => motion.person(personOrId),
    vehiclePosition: (vehicleOrId) => motion.vehicle(vehicleOrId),
    hitTestPerson: (x, y, hitOptions) => motion.lastFrame?.hitTestPerson(x, y, hitOptions) || null,
    hitTestPeople: (x, y, hitOptions) => motion.lastFrame?.hitTestPeople(x, y, hitOptions) || [],
    vegetationFor,
    reset(sim = null) {
      motion.reset(sim);
      vegetationSimulation = null;
      vegetationSignature = "";
      vegetation = [];
    },
    drawStatic(ctx, sim, viewport, drawOptions = {}) {
      const result = { roads: 0, buildings: 0, vegetation: 0 };
      if (drawOptions.roads !== false) {
        drawRoadNetwork(ctx, sim?.city?.streets || [], viewport, { ...options.roads, ...drawOptions });
        result.roads = sim?.city?.streets?.length || 0;
      }
      if (drawOptions.buildings !== false) result.buildings = drawBuildingLayer(ctx, sim?.buildings || [], viewport, { ...options.buildings, ...drawOptions });
      if (drawOptions.vegetation !== false) result.vegetation = drawVegetationLayer(ctx, vegetationFor(sim, drawOptions.vegetationOptions), viewport, { ...options.vegetation, ...drawOptions });
      return result;
    },
    drawDynamic(ctx, sim, viewport, drawOptions = {}) {
      return drawDynamicCityLayer(ctx, sim, viewport, drawOptions.frame || motion.lastFrame, { ...options.dynamic, ...drawOptions });
    },
  };
}
