import { traits as traitCatalog } from "./data.js";
import { formatAddress } from "./city.js";
import { eyeColors, hairColors, identities, orientations, skinTones } from "./lifecycle.js";
import { interests as interestCatalog, values as valueCatalog } from "./personality.js";
import {
  GAME_MODES,
  bindPlayerPerson,
  beginNextPlayerCommand,
  cancelPlayerCommand,
  characterOriginCatalog,
  createCharacterDraft,
  createNewGame,
  enqueuePlayerCommand,
  gameModeCatalog,
  getSessionPaceMultiplier,
  playerGoalCatalog,
  relationshipPreferenceCatalog,
  resolvePlayerCommand,
  setGameSessionPaused,
  startGameSession,
  updatePlayerGoal,
} from "./gameplay.js";
import { derivePlayerGoalProgress, nextPlayerGoalMilestone, PLAYER_GOAL_MILESTONES } from "./playerObjectives.js";
import { executePlayerPropertyTransaction, getRealEstatePortal } from "./realEstateCoordinator.js";

const escapeHTML = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const escapeAttribute = escapeHTML;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const money = (value) => `R$ ${Math.round(Number(value) || 0).toLocaleString("pt-BR")}`;
const clockOf = (sim) => ({ week: sim?.week || 1, day: sim?.day || 0, minute: sim?.minute || 0 });
const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const dayNames = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
const actionIcons = { go_to: "⌖", go_home: "⌂", rest: "☾", eat: "◉", hygiene: "◇", wait: "◷", work: "▣", study: "✎", shop: "▤", talk: "◌", apply_job: "◆", enroll: "▧", seek_healthcare: "✚", buy_property: "⌂", rent_property: "⌑", cancel: "×" };
const goalByAction = { work: ["career", 2], apply_job: ["career", 10], study: ["education", 3], enroll: ["education", 8], socialize: ["social", 3], shop: ["wealth", 1], buy_property: ["wealth", 18], rent_property: ["wealth", 6] };
const skinPreview = { clara: "#e5bda5", média: "#c48f70", morena: "#9b705a", escura: "#654638" };

function actionButton({ action, title, subtitle, targetKind = "", targetId = "", icon, product = "", kind = "", role = "", course = "", operation = "", listingId = "", amount = 0, disabled = false, cost = "" }) {
  return `<button class="player-action" data-player-action="${escapeAttribute(action)}"${targetKind ? ` data-target-kind="${escapeAttribute(targetKind)}"` : ""}${targetId ? ` data-target-id="${escapeAttribute(targetId)}"` : ""}${product ? ` data-product="${escapeAttribute(product)}"` : ""}${kind ? ` data-interaction-kind="${escapeAttribute(kind)}"` : ""}${role ? ` data-role="${escapeAttribute(role)}"` : ""}${course ? ` data-course="${escapeAttribute(course)}"` : ""}${operation ? ` data-operation="${escapeAttribute(operation)}"` : ""}${listingId ? ` data-listing-id="${escapeAttribute(listingId)}"` : ""}${amount ? ` data-action-cost="${Number(amount)}"` : ""}${disabled ? " disabled" : ""}><i>${icon || actionIcons[action] || "•"}</i><span><b>${escapeHTML(title)}</b><small>${escapeHTML(subtitle || "")}</small></span>${cost ? `<em class="player-action-cost">${escapeHTML(cost)}</em>` : ""}</button>`;
}

export function createGameplayController(options = {}) {
  const getSimulation = options.getSimulation;
  let session = null;
  let draft = createCharacterDraft({ age: 22, originId: "city_native", goalIds: ["career", "social"] });
  let selectedMode = null;
  let selectedSlot = null;
  let activeSlot = null;
  let setupView = "modes";
  let mounted = false;
  let started = false;
  let busy = false;
  let savePromise = null;
  let pendingSlotAction = null;
  let panelTab = "context";
  let panelExpanded = true;
  let lastPanelSignature = "";
  let lastCriticalSignature = "";
  let lastCommandOutcomeId = "";
  let setupRoot;
  let hudRoot;
  let toastTimer = 0;

  const sim = () => getSimulation?.();
  const player = () => sim()?.player?.() || sim()?.people?.find((person) => person.id === sim()?.playerId) || null;
  const world = () => ({ clock: clockOf(sim()), people: sim()?.people || [], businesses: sim()?.businesses || [], buildings: sim()?.buildings || [], vehicles: sim()?.vehicles || [], playerPerson: player() });
  const isGameplay = () => started && session?.mode === GAME_MODES.GAMEPLAY;
  const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  const modeName = (mode) => mode === GAME_MODES.GAMEPLAY ? "Gameplay" : "Sandbox observador";
  const slotEntries = (mode) => {
    try {
      const entries = options.listSaveSlots?.(mode) || [];
      return [1, 2, 3].map((slot) => entries.find((entry) => Number(entry.slot) === slot) || { slot, mode, status: "empty", occupied: false });
    } catch (error) {
      return [1, 2, 3].map((slot) => ({ slot, mode, status: "unavailable", occupied: false, error: error?.message || String(error) }));
    }
  };
  const formatSaveDate = (value) => {
    if (!value) return "Nunca salvo";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Data indisponível";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
  };
  const setBusy = (visible, state = {}) => options.onBusy?.({ visible, ...state });

  function renderBrand(extra = "") {
    return `<div class="game-setup-topbar"><div class="game-setup-brand"><span class="game-setup-brand-mark">CV</span><span class="game-setup-brand-copy"><strong>Cidade Viva</strong><small>NOVA SIMULAÇÃO</small></span></div>${started ? `<button class="game-setup-continue" data-setup-resume>← Voltar à cidade</button>` : extra}</div>`;
  }

  function renderModeSelection() {
    const modeFeatures = {
      spectator: ["200 cidadãos com autonomia", "Cidade, economia e gerações em movimento", "Investigação livre de todos os sistemas"],
      gameplay: ["Crie e controle seu próprio cidadão", "Escolha onde ir, estudar e trabalhar", "Suas decisões convivem com 199 NPCs autônomos"],
    };
    setupView = "modes";
    const savesByMode = Object.fromEntries(gameModeCatalog.map((mode) => [mode.id, slotEntries(mode.id).filter((entry) => entry.status === "ready" || entry.occupied).length]));
    setupRoot.innerHTML = `<div class="game-setup-view game-setup-view-modes">${renderBrand()}<section class="game-setup-card"><header class="game-setup-card-head"><div><span class="game-setup-eyebrow">CIDADE VIVA</span><h1 class="game-setup-title">Como você quer viver esta cidade?</h1><p class="game-setup-subtitle">Cada modo mantém três cidades próprias neste navegador. Continue uma história existente ou escolha um slot para começar de novo.</p></div><span class="game-setup-step-count">6 SLOTS LOCAIS</span></header><div class="game-setup-mode-grid">${gameModeCatalog.map((mode) => `<button class="game-setup-mode ${selectedMode === mode.id ? "game-setup-selected" : ""}" data-select-mode="${mode.id}" aria-pressed="${selectedMode === mode.id}"><span class="game-setup-mode-visual"><i class="game-setup-mode-icon">${mode.id === GAME_MODES.SPECTATOR ? "◉" : "♙"}</i><em class="game-setup-mode-tag">${savesByMode[mode.id]}/3 SALVOS</em></span><span class="game-setup-mode-copy"><h2>${escapeHTML(mode.name)}</h2><p>${escapeHTML(mode.description)}</p><ul class="game-setup-mode-features">${modeFeatures[mode.id].map((feature) => `<li>${escapeHTML(feature)}</li>`).join("")}</ul></span></button>`).join("")}</div><footer class="game-setup-card-footer"><span class="game-setup-footer-note">Os saves ficam apenas neste navegador e são separados entre Sandbox observador e Gameplay.</span><button class="game-setup-button" data-confirm-mode ${selectedMode ? "" : "disabled"}>Ver 3 slots →</button></footer></section></div>`;
  }

  function renderSlotSelection(mode = selectedMode) {
    if (!mode) { renderModeSelection(); return; }
    setupView = "slots";
    selectedMode = mode;
    const definition = gameModeCatalog.find((entry) => entry.id === mode);
    const slots = slotEntries(mode);
    const cards = slots.map((entry) => {
      const slot = Number(entry.slot), meta = entry.meta || {}, ready = entry.status === "ready" || (entry.occupied && entry.status !== "corrupt"), corrupt = entry.status === "corrupt" && entry.occupied, unavailable = entry.status === "unavailable" || (entry.status === "corrupt" && !entry.occupied);
      const confirmOverwrite = pendingSlotAction === `overwrite:${mode}:${slot}`, confirmDelete = pendingSlotAction === `delete:${mode}:${slot}`;
      const title = ready ? (meta.playerName || meta.cityName || `Cidade do slot ${slot}`) : corrupt ? "Save corrompido" : unavailable ? "Armazenamento indisponível" : "Slot vazio";
      const clock = meta.clock || {}, detail = ready ? `Semana ${clock.week || meta.week || 1} · ${Number(meta.population || 0).toLocaleString("pt-BR")} habitantes` : corrupt ? "Os dados não puderam ser validados. Você pode apagar este slot." : unavailable ? escapeHTML(entry.error || "O navegador bloqueou o armazenamento local.") : `Uma nova história em ${modeName(mode)}.`;
      const actions = ready
        ? `<button class="game-setup-slot-primary" data-load-slot="${slot}">Continuar</button><button class="game-setup-slot-secondary ${confirmOverwrite ? "game-setup-slot-warning" : ""}" data-overwrite-slot="${slot}">${confirmOverwrite ? "Confirmar novo jogo" : "Novo jogo"}</button><button class="game-setup-slot-delete ${confirmDelete ? "game-setup-slot-warning" : ""}" data-delete-slot="${slot}" aria-label="${confirmDelete ? "Confirmar exclusão" : "Excluir save"}">${confirmDelete ? "Confirmar exclusão" : "Excluir"}</button>`
        : corrupt ? `<button class="game-setup-slot-delete ${confirmDelete ? "game-setup-slot-warning" : ""}" data-delete-slot="${slot}">${confirmDelete ? "Confirmar exclusão" : "Excluir dados"}</button>`
        : unavailable ? "" : `<button class="game-setup-slot-primary" data-new-slot="${slot}">Começar aqui</button>`;
      return `<article class="game-setup-save ${ready ? "game-setup-save-ready" : "game-setup-save-empty"} ${corrupt ? "game-setup-save-corrupt" : ""}"><div class="game-setup-save-preview" aria-hidden="true"><span>${ready ? (mode === GAME_MODES.GAMEPLAY ? initials(meta.playerName || "CV") : "◉") : corrupt ? "!" : "+"}</span><small>${String(slot).padStart(2, "0")}</small></div><div class="game-setup-save-copy"><small>SLOT ${slot} · ${escapeHTML(modeName(mode).toUpperCase())}</small><b>${escapeHTML(title)}</b><span>${detail}</span>${ready ? `<small>Salvo em ${escapeHTML(formatSaveDate(meta.updatedAt || meta.savedAt))}</small>` : ""}</div><span class="game-setup-save-meta">${ready ? "SALVO" : corrupt ? "REPARAR" : "LIVRE"}</span><div class="game-setup-save-actions">${actions}</div></article>`;
    }).join("");
    setupRoot.innerHTML = `<div class="game-setup-view">${renderBrand()}<section class="game-setup-card"><header class="game-setup-card-head"><div><span class="game-setup-eyebrow">${escapeHTML(modeName(mode))}</span><h1 class="game-setup-title">Escolha uma cidade</h1><p class="game-setup-subtitle">${escapeHTML(definition?.description || "")}</p></div><span class="game-setup-step-count">3 SLOTS</span></header><div class="game-setup-save-list">${cards}</div><footer class="game-setup-card-footer"><button class="game-setup-button game-setup-button-secondary" data-slots-back>← Trocar modo</button><span class="game-setup-footer-note">Salvar novamente atualiza somente o slot ativo deste modo.</span></footer></section></div>`;
  }

  function renderCreator(errors = [], warnings = []) {
    const availableOrigins = characterOriginCatalog.filter((origin) => draft.age >= origin.minAge && draft.age <= origin.maxAge);
    if (!availableOrigins.some((origin) => origin.id === draft.originId)) draft.originId = availableOrigins[0]?.id || "city_native";
    const selectedOrigin = characterOriginCatalog.find((origin) => origin.id === draft.originId);
    const fieldError = (field) => errors.find((error) => error.field === field)?.message || "";
    setupRoot.innerHTML = `<div class="game-setup-view">${renderBrand()}<section class="game-setup-card game-setup-creator"><aside class="game-setup-creator-nav"><h2>Seu cidadão</h2><div class="game-setup-progress"><span class="game-setup-progress-step game-setup-complete"><i>✓</i><span>Modo escolhido<small>Gameplay</small></span></span><span class="game-setup-progress-step game-setup-current"><i>2</i><span>Identidade e origem<small>Quem você será</small></span></span><span class="game-setup-progress-step"><i>3</i><span>Entrar na cidade<small>Sua história começa</small></span></span></div><div class="game-setup-creator-tip"><b>Nada acontece isoladamente</b>Sua origem define dinheiro, moradia e vínculos iniciais. Trabalho, estudo, saúde, relações e justiça continuarão ligados à mesma cidade.</div></aside><div class="game-setup-creator-main"><header class="game-setup-creator-head"><span class="game-setup-eyebrow">PERSONAGEM JOGÁVEL</span><h1>Quem você será em Vila Esperança?</h1><p>Crie uma pessoa coerente com o mundo. Depois, suas escolhas — e as consequências delas — serão suas.</p></header><form class="game-setup-form" id="characterCreator" novalidate><section class="game-setup-form-section"><h3>Identidade</h3><p>Nome, idade e como seu personagem se apresenta.</p><div class="game-setup-appearance"><div class="game-setup-avatar-preview" style="--game-setup-avatar:${escapeAttribute(draft.appearance?.skin || "#9b705a")}"><i>${escapeHTML(initials(`${draft.firstName} ${draft.family}`) || "CV")}</i><span>${escapeHTML(`${draft.firstName} ${draft.family}`)}</span></div><div class="game-setup-field-grid game-setup-field-grid-three"><label class="game-setup-field"><span>Primeiro nome</span><input name="firstName" maxlength="32" value="${escapeAttribute(draft.firstName)}" class="${fieldError("firstName") ? "game-setup-invalid" : ""}" required>${fieldError("firstName") ? `<small class="game-setup-field-error">${escapeHTML(fieldError("firstName"))}</small>` : ""}</label><label class="game-setup-field"><span>Sobrenome</span><input name="family" maxlength="40" value="${escapeAttribute(draft.family)}" class="${fieldError("family") ? "game-setup-invalid" : ""}" required>${fieldError("family") ? `<small class="game-setup-field-error">${escapeHTML(fieldError("family"))}</small>` : ""}</label><label class="game-setup-field"><span>Idade</span><input name="age" type="number" min="16" max="90" value="${draft.age}" class="${fieldError("age") ? "game-setup-invalid" : ""}" required>${fieldError("age") ? `<small class="game-setup-field-error">${escapeHTML(fieldError("age"))}</small>` : ""}</label><label class="game-setup-field"><span>Identidade</span><select name="identity">${identities.map((identity) => `<option value="${escapeAttribute(identity)}" ${identity === draft.identity ? "selected" : ""}>${escapeHTML(identity)}</option>`).join("")}</select></label><label class="game-setup-field"><span>Orientação</span><select name="orientation">${orientations.map((orientation) => `<option value="${escapeAttribute(orientation)}" ${orientation === draft.orientation ? "selected" : ""}>${escapeHTML(orientation)}</option>`).join("")}</select></label><label class="game-setup-field"><span>Profissão desejada</span><input name="professionPreference" maxlength="60" value="${escapeAttribute(draft.professionPreference || "")}" placeholder="Ex.: jornalista, motorista"></label></div></div></section><section class="game-setup-form-section"><h3>Origem</h3><p>Sua situação inicial muda recursos, moradia, contatos e reputação.</p><div class="game-setup-option-grid">${availableOrigins.map((origin) => `<button type="button" class="game-setup-option ${draft.originId === origin.id ? "game-setup-selected" : ""}" data-origin="${origin.id}"><b>${escapeHTML(origin.name)}</b><small>${escapeHTML(origin.description)}</small></button>`).join("")}</div>${fieldError("originId") ? `<small class="game-setup-field-error">${escapeHTML(fieldError("originId"))}</small>` : ""}</section><section class="game-setup-form-section"><h3>Personalidade</h3><p>Escolha de uma a quatro características. Elas influenciam afinidades e decisões futuras.</p><div class="game-setup-option-grid">${traitCatalog.map((trait) => `<button type="button" class="game-setup-option ${draft.traits.includes(trait) ? "game-setup-selected" : ""}" data-trait="${escapeAttribute(trait)}"><b>${escapeHTML(trait)}</b><small>${draft.traits.includes(trait) ? "Característica selecionada" : "Adicionar ao personagem"}</small></button>`).join("")}</div>${fieldError("traits") ? `<small class="game-setup-field-error">${escapeHTML(fieldError("traits"))}</small>` : ""}</section><section class="game-setup-form-section"><h3>Objetivos de vida</h3><p>Escolha de um a três. Eles não são regras: são trilhas de progresso para a sua história.</p><div class="game-setup-option-grid">${playerGoalCatalog.map((goal) => `<button type="button" class="game-setup-option ${draft.goalIds.includes(goal.id) ? "game-setup-selected" : ""}" data-goal="${goal.id}"><b>${escapeHTML(goal.name)}</b><small>${escapeHTML(goal.description)}</small></button>`).join("")}</div>${fieldError("goalIds") ? `<small class="game-setup-field-error">${escapeHTML(fieldError("goalIds"))}</small>` : ""}</section><section class="game-setup-form-section"><h3>Breve história</h3><div class="game-setup-field-grid"><label class="game-setup-field game-setup-field-wide"><span>Biografia opcional</span><textarea name="biography" maxlength="360" placeholder="O que trouxe você até aqui?">${escapeHTML(draft.biography || "")}</textarea></label></div></section>${warnings.length ? `<p class="player-action-message">${warnings.map((warning) => escapeHTML(warning.message)).join(" ")}</p>` : ""}<div class="game-setup-summary"><div class="game-setup-avatar-preview" style="--game-setup-avatar:${escapeAttribute(draft.appearance?.skin || "#9b705a")}"><i>${escapeHTML(initials(`${draft.firstName} ${draft.family}`) || "CV")}</i><span>${escapeHTML(`${draft.firstName} ${draft.family}`)}</span></div><div class="game-setup-summary-list"><span class="game-setup-summary-item"><small>Origem</small><b>${escapeHTML(selectedOrigin?.name || "A definir")}</b></span><span class="game-setup-summary-item"><small>Recursos</small><b>${money(selectedOrigin?.startingMoney || 0)}</b></span><span class="game-setup-summary-item"><small>Traços</small><b>${escapeHTML(draft.traits.join(", ") || "A definir")}</b></span><span class="game-setup-summary-item"><small>Objetivos</small><b>${draft.goalIds.length}</b></span></div></div></form><footer class="game-setup-creator-footer"><button class="game-setup-button game-setup-button-secondary" type="button" data-creator-back>← Escolher outro modo</button><span><button class="game-setup-button game-setup-button-secondary" type="button" data-randomize-character>Sortear personagem</button> <button class="game-setup-button" type="submit" form="characterCreator">Começar minha vida →</button></span></footer></div></section></div>`;
    const creator = setupRoot.querySelector("#characterCreator");
    const identitySection = [...creator.querySelectorAll(":scope > .game-setup-form-section")].find((section) => section.querySelector("h3")?.textContent === "Identidade");
    identitySection?.insertAdjacentHTML("beforeend", `<div class="game-setup-appearance-controls"><h4>Aparência e presença</h4><div class="game-setup-field-grid game-setup-field-grid-three"><label class="game-setup-field"><span>Tom de pele</span><select name="skin">${skinTones.map((tone) => `<option value="${escapeAttribute(tone)}" ${tone === draft.appearance?.skin ? "selected" : ""}>${escapeHTML(tone)}</option>`).join("")}</select></label><label class="game-setup-field"><span>Olhos</span><select name="eyes">${eyeColors.map((color) => `<option value="${escapeAttribute(color)}" ${color === draft.appearance?.eyes ? "selected" : ""}>${escapeHTML(color)}</option>`).join("")}</select></label><label class="game-setup-field"><span>Cabelo</span><select name="hair">${hairColors.map((color) => `<option value="${escapeAttribute(color)}" ${color === draft.appearance?.hair ? "selected" : ""}>${escapeHTML(color)}</option>`).join("")}</select></label><label class="game-setup-field"><span>Altura <b data-height-value>${Math.round(draft.appearance?.height || 170)} cm</b></span><input name="height" type="range" min="150" max="195" value="${Math.round(draft.appearance?.height || 170)}"></label><label class="game-setup-field"><span>Carisma <b data-charisma-value>${Math.round(draft.appearance?.charisma || 50)}%</b></span><input name="charisma" type="range" min="15" max="100" value="${Math.round(draft.appearance?.charisma || 50)}"></label></div></div>`);
    const originSection = [...creator.querySelectorAll(":scope > .game-setup-form-section")].find((section) => section.querySelector("h3")?.textContent === "Origem");
    originSection?.insertAdjacentHTML("beforebegin", `<section class="game-setup-form-section"><h3>Valores e interesses</h3><p>Essas escolhas moldam compatibilidade, conversas, decisões e a forma como outras pessoas reagem a você.</p><h4>Valores centrais · até 3</h4><div class="game-setup-option-grid game-setup-option-grid-compact">${valueCatalog.map((value) => `<button type="button" class="game-setup-option ${draft.values?.includes(value) ? "game-setup-selected" : ""}" data-value="${escapeAttribute(value)}"><b>${escapeHTML(value)}</b><small>${draft.values?.includes(value) ? "Valor central" : "Adicionar valor"}</small></button>`).join("")}</div>${fieldError("values") ? `<small class="game-setup-field-error">${escapeHTML(fieldError("values"))}</small>` : ""}<h4>Interesses · até 5</h4><div class="game-setup-option-grid game-setup-option-grid-compact">${interestCatalog.map((interest) => `<button type="button" class="game-setup-option ${draft.interests?.includes(interest) ? "game-setup-selected" : ""}" data-interest="${escapeAttribute(interest)}"><b>${escapeHTML(interest)}</b><small>${draft.interests?.includes(interest) ? "Interesse selecionado" : "Adicionar interesse"}</small></button>`).join("")}</div>${fieldError("interests") ? `<small class="game-setup-field-error">${escapeHTML(fieldError("interests"))}</small>` : ""}</section>`);
    const goalsSection = [...creator.querySelectorAll(":scope > .game-setup-form-section")].find((section) => section.querySelector("h3")?.textContent === "Objetivos de vida");
    goalsSection?.insertAdjacentHTML("beforebegin", `<section class="game-setup-form-section"><h3>Afetos e projeto familiar</h3><p>Preferências não garantem resultados: elas orientam conversas, limites e decisões reativas ao longo da vida.</p><div class="game-setup-option-grid">${relationshipPreferenceCatalog.map((preference) => `<button type="button" class="game-setup-option ${draft.relationshipPreferences?.model === preference.id ? "game-setup-selected" : ""}" data-relationship-model="${preference.id}"><b>${escapeHTML(preference.name)}</b><small>${escapeHTML(preference.description)}</small></button>`).join("")}</div><div class="game-setup-field-grid"><label class="game-setup-field"><span>Filhos desejados</span><input name="desiredChildren" type="number" min="0" max="6" value="${Number(draft.relationshipPreferences?.desiredChildren ?? 1)}"></label><label class="game-setup-field"><span>Momento imaginado</span><select name="familyTiming">${[["indefinido", "A conversar"], ["agora", "Agora"], ["em_breve", "Em breve"], ["mais_tarde", "Mais tarde"], ["nao_deseja", "Não deseja"]].map(([id, label]) => `<option value="${id}" ${draft.relationshipPreferences?.familyTiming === id ? "selected" : ""}>${label}</option>`).join("")}</select></label></div>${fieldError("relationshipModel") || fieldError("desiredChildren") ? `<small class="game-setup-field-error">${escapeHTML(fieldError("relationshipModel") || fieldError("desiredChildren"))}</small>` : ""}</section>`);
    setupRoot.querySelectorAll(".game-setup-avatar-preview").forEach((node) => node.style.setProperty("--game-setup-avatar", skinPreview[draft.appearance?.skin] || skinPreview.morena));
    bindCreatorInputs();
  }

  function syncDraftFromForm() {
    const form = setupRoot.querySelector("#characterCreator");
    if (!form) return;
    const data = new FormData(form);
    draft = {
      ...draft,
      firstName: String(data.get("firstName") || ""),
      family: String(data.get("family") || ""),
      age: Number(data.get("age")) || draft.age,
      identity: String(data.get("identity") || draft.identity),
      orientation: String(data.get("orientation") || draft.orientation),
      professionPreference: String(data.get("professionPreference") || ""),
      biography: String(data.get("biography") || ""),
      appearance: {
        ...draft.appearance,
        skin: String(data.get("skin") || draft.appearance?.skin || "morena"),
        eyes: String(data.get("eyes") || draft.appearance?.eyes || "castanhos"),
        hair: String(data.get("hair") || draft.appearance?.hair || "castanhos"),
        height: Number(data.get("height")) || draft.appearance?.height || 170,
        charisma: Number(data.get("charisma")) || draft.appearance?.charisma || 50,
      },
      relationshipPreferences: {
        ...(draft.relationshipPreferences || {}),
        desiredChildren: clamp(Number(data.get("desiredChildren") ?? draft.relationshipPreferences?.desiredChildren ?? 1), 0, 6),
        familyTiming: String(data.get("familyTiming") || draft.relationshipPreferences?.familyTiming || "indefinido"),
      },
    };
  }

  function bindCreatorInputs() {
    const form = setupRoot.querySelector("#characterCreator");
    form?.addEventListener("input", (event) => {
      syncDraftFromForm();
      if (["firstName", "family"].includes(event.target.name)) {
        const name = `${draft.firstName} ${draft.family}`.trim();
        setupRoot.querySelectorAll(".game-setup-avatar-preview i").forEach((node) => { node.textContent = initials(name) || "CV"; });
        setupRoot.querySelectorAll(".game-setup-avatar-preview span").forEach((node) => { node.textContent = name; });
      }
      if (event.target.name === "height") setupRoot.querySelector("[data-height-value]").textContent = `${Math.round(draft.appearance.height)} cm`;
      if (event.target.name === "charisma") setupRoot.querySelector("[data-charisma-value]").textContent = `${Math.round(draft.appearance.charisma)}%`;
      if (event.target.name === "skin") setupRoot.querySelectorAll(".game-setup-avatar-preview").forEach((node) => node.style.setProperty("--game-setup-avatar", skinPreview[draft.appearance.skin] || skinPreview.morena));
    });
    form?.addEventListener("change", (event) => {
      syncDraftFromForm();
      if (event.target.name === "age") renderCreator();
    });
    form?.addEventListener("submit", (event) => { event.preventDefault(); syncDraftFromForm(); startSelectedGame(GAME_MODES.GAMEPLAY); });
  }

  function showSetup() {
    if (!mounted) return;
    if (started) void saveCurrent({ silent: true, reason: "menu" });
    options.onSetupOpen?.();
    setupView = "modes";
    selectedMode = null;
    selectedSlot = null;
    pendingSlotAction = null;
    setupRoot.hidden = false;
    renderModeSelection();
  }

  function hideSetup(resume = false) {
    setupRoot.hidden = true;
    if (resume) options.onSetupClose?.();
  }

  function activateLoadedGame({ mode, slot, restoredSession }) {
    session = restoredSession;
    started = true;
    activeSlot = Number(slot);
    selectedSlot = activeSlot;
    selectedMode = mode;
    document.body.classList.toggle("gameplay-mode", mode === GAME_MODES.GAMEPLAY);
    document.body.classList.toggle("spectator-mode", mode === GAME_MODES.SPECTATOR);
    hideSetup();
    hudRoot.hidden = mode !== GAME_MODES.GAMEPLAY;
    hudRoot.classList.toggle("player-hidden", mode !== GAME_MODES.GAMEPLAY);
    lastPanelSignature = "";
    lastCriticalSignature = "";
    options.onActivated?.({ mode, slot: activeSlot, session });
    render(true);
  }

  async function startSelectedGame(mode) {
    if (busy || !selectedSlot) return;
    busy = true;
    setBusy(true, { kind: "new", progress: 8, eyebrow: `${modeName(mode)} · Slot ${selectedSlot}`, title: "Preparando uma nova cidade", detail: "Organizando ruas, serviços e histórias iniciais…" });
    await nextPaint();
    const created = createNewGame({ mode, characterDraft: mode === GAME_MODES.GAMEPLAY ? draft : undefined, autostart: false, clock: { week: 1, day: 0, minute: 390 } });
    if (!created.ok) {
      busy = false;
      setBusy(false);
      renderCreator(created.errors || [], created.warnings || []);
      setupRoot.querySelector(`[name="${created.errors?.[0]?.field || "firstName"}"]`)?.focus();
      return;
    }
    setBusy(true, { kind: "new", progress: 30, eyebrow: `${modeName(mode)} · Slot ${selectedSlot}`, title: "Dando vida a Vila Esperança", detail: mode === GAME_MODES.GAMEPLAY ? "Inserindo seu personagem entre os cidadãos…" : "Conectando famílias, economia e rotinas…" });
    await nextPaint();
    const startResult = options.onStart?.({ mode, character: created.character, session: created.state });
    const current = sim();
    if (!current || startResult === false) {
      busy = false;
      setBusy(false);
      return;
    }
    session = created.state;
    if (mode === GAME_MODES.GAMEPLAY) {
      const bound = bindPlayerPerson(session, current.playerId, clockOf(current));
      if (!bound.ok) { busy = false; setBusy(false); renderCreator([{ field: "firstName", message: "Não foi possível inserir o personagem na cidade." }]); return; }
      session = bound.state;
    }
    const running = startGameSession(session, clockOf(current));
    session = running.state;
    activateLoadedGame({ mode, slot: selectedSlot, restoredSession: session });
    setBusy(true, { kind: "save", progress: 82, eyebrow: `${modeName(mode)} · Slot ${selectedSlot}`, title: "Registrando o primeiro capítulo", detail: "Compactando o mundo no armazenamento local…" });
    await nextPaint();
    try {
      const saved = await options.onSave?.({ mode, slot: selectedSlot, simulation: current, session, reason: "new" });
      options.onSaved?.(saved?.meta || saved, { mode, slot: selectedSlot, reason: "new" });
    } catch (error) {
      options.onSaveError?.(error);
    }
    setBusy(true, { kind: "new", progress: 100, eyebrow: `${modeName(mode)} · Slot ${selectedSlot}`, title: "A cidade está pronta", detail: "Seu slot foi vinculado a esta história." });
    await wait(280);
    setBusy(false);
    busy = false;
    if (mode === GAME_MODES.GAMEPLAY) showToast("Sua vida em Vila Esperança começou.", "Escolha uma ação no painel à direita.");
    render(true);
  }

  async function loadSelectedGame(mode, slot) {
    if (busy) return;
    busy = true;
    setBusy(true, { kind: "load", progress: 10, eyebrow: `${modeName(mode)} · Slot ${slot}`, title: "Restaurando sua cidade", detail: "Lendo e verificando o save local…" });
    await nextPaint();
    try {
      setBusy(true, { kind: "load", progress: 38, eyebrow: `${modeName(mode)} · Slot ${slot}`, title: "Reconstruindo histórias", detail: "Reabrindo cidadãos, relações e serviços…" });
      const loaded = await options.onLoad?.({ mode, slot });
      if (!loaded?.session || !sim()) throw new Error("O save não trouxe uma sessão válida.");
      setBusy(true, { kind: "load", progress: 82, eyebrow: `${modeName(mode)} · Slot ${slot}`, title: "Sincronizando o mapa", detail: "Posicionando pessoas, veículos e eventos…" });
      await nextPaint();
      activateLoadedGame({ mode, slot, restoredSession: loaded.session });
      setBusy(true, { kind: "load", progress: 100, eyebrow: `${modeName(mode)} · Slot ${slot}`, title: "Cidade restaurada", detail: `Semana ${sim()?.week || 1} pronta para continuar.` });
      await wait(280);
      setBusy(false);
    } catch (error) {
      setBusy(false);
      renderSlotSelection(mode);
      options.onLoadError?.(error);
    } finally {
      busy = false;
    }
  }

  async function saveCurrent({ silent = false, reason = "manual" } = {}) {
    if (!started || !activeSlot || !session || !sim() || !options.onSave) return null;
    if (savePromise) return savePromise;
    const mode = session.mode, slot = activeSlot;
    savePromise = (async () => {
      if (!silent) {
        setBusy(true, { kind: "save", progress: 24, eyebrow: `${modeName(mode)} · Slot ${slot}`, title: "Salvando sua cidade", detail: "Capturando o estado de cada sistema…" });
        await nextPaint();
        setBusy(true, { kind: "save", progress: 68, eyebrow: `${modeName(mode)} · Slot ${slot}`, title: "Compactando histórias", detail: "Gravando com segurança neste navegador…" });
      }
      try {
        const saved = await options.onSave({ mode, slot, simulation: sim(), session, reason });
        options.onSaved?.(saved?.meta || saved, { mode, slot, reason });
        if (!silent) { setBusy(true, { kind: "save", progress: 100, eyebrow: `${modeName(mode)} · Slot ${slot}`, title: "Cidade salva", detail: "Tudo pronto para continuar." }); await wait(260); setBusy(false); }
        return saved;
      } catch (error) {
        if (!silent) setBusy(false);
        options.onSaveError?.(error);
        return null;
      } finally {
        savePromise = null;
      }
    })();
    return savePromise;
  }

  function showToast(title, detail = "", tone = "success") {
    if (!hudRoot || !isGameplay()) return;
    const stack = hudRoot.querySelector("#playerToastStack");
    const toast = document.createElement("div");
    toast.className = "player-toast";
    toast.style.setProperty("--player-toast-color", tone === "error" ? "#b85d54" : tone === "warning" ? "#c28a43" : "#79b08b");
    toast.innerHTML = `<i></i><span><b>${escapeHTML(title)}</b><small>${escapeHTML(detail)}</small></span>`;
    stack.append(toast);
    window.setTimeout(() => toast.remove(), 4200);
  }

  function resolveActive(result) {
    if (!session?.activeCommand) return;
    const command = session.activeCommand;
    const resolved = resolvePlayerCommand(session, command.id, { ok: result.ok, outcome: result.details || null, reason: result.ok ? null : result.message || result.reason }, { clock: clockOf(sim()) });
    if (!resolved.ok) return;
    session = resolved.state;
    const advanceGoal = (goalId, increment) => {
      const updated = updatePlayerGoal(session, goalId, increment, result.message, { clock: clockOf(sim()) });
      if (updated.ok) session = updated.state;
    };
    if (result.ok && goalByAction[command.actionId]) advanceGoal(...goalByAction[command.actionId]);
    if (result.ok && command.actionId === "talk" && result.details?.accepted !== false) {
      const kind = result.details?.kind || command.payload?.kind || "talk";
      if (["family_chat", "family_meal", "family_care"].includes(kind)) { advanceGoal("family", kind === "family_meal" ? 5 : 3); advanceGoal("social", 2); }
      else if (["define_exclusive", "define_dating", "move_in", "propose", "reconcile"].includes(kind)) { advanceGoal("family", kind === "move_in" || kind === "propose" ? 12 : 8); advanceGoal("social", 3); }
      else if (!["argue", "breakup"].includes(kind)) advanceGoal("social", ["date", "first_kiss", "affection", "flirt"].includes(kind) ? 4 : 2);
    }
    lastCommandOutcomeId = command.id;
    showToast(result.ok ? "Ação concluída" : "Ação não realizada", result.message || result.reason || "", result.ok ? "success" : "error");
    lastPanelSignature = "";
  }

  function executeCommand(command) {
    const current = sim(), actor = player();
    if (!current || !actor) return { ok: false, reason: "personagem indisponível" };
    const business = command.target?.kind === "business" ? current.businesses.find((item) => item.id === command.target.id) : null;
    const buildingId = command.actionId === "go_home" ? actor.homeId : business?.buildingId || command.target?.id;
    if (["go_to", "go_home", "use_transport"].includes(command.actionId)) return current.issuePlayerTravel(buildingId, { commandId: command.id, mode: command.payload?.mode || "auto" });
    if (["rest", "eat", "hygiene", "work", "study", "wait"].includes(command.actionId)) return current.startPlayerActivity(command.actionId, { commandId: command.id, durationMinutes: command.estimatedDurationMinutes });
    if (command.actionId === "shop") return current.playerPurchase(command.target?.id, command.payload?.productName, { commandId: command.id });
    if (["talk", "socialize"].includes(command.actionId)) return current.playerInteractWithPerson(command.target?.id, command.payload?.kind || "talk", { commandId: command.id });
    if (command.actionId === "apply_job") return current.playerApplyForJob(command.target?.id, command.payload?.role, { commandId: command.id });
    if (command.actionId === "enroll") return current.playerEnroll(command.target?.id, command.payload?.course, { commandId: command.id });
    if (command.actionId === "seek_healthcare") return current.playerSeekHealthcare(command.target?.id, { commandId: command.id });
    if (["buy_property", "rent_property"].includes(command.actionId)) {
      const operation = command.actionId === "buy_property" ? "buy" : "rent", result = executePlayerPropertyTransaction(current, actor, command.payload?.listingId, operation, { finance: operation === "buy" ? { downPaymentRate: .1, months: 240 } : undefined });
      if (!result.ok) return { ok: false, reason: result.error || "A transação imobiliária não pôde ser concluída." };
      const building = current.buildings.find((item) => item.id === result.buildingId), message = operation === "buy" ? `Compra de ${building?.name || "imóvel"} concluída; propriedade e financiamento foram atualizados.` : `Contrato de aluguel de ${building?.name || "imóvel"} concluído; seu domicílio foi atualizado.`;
      current.setPlayerCommandResult(actor, command.id, true, message, { operation, listingId: result.listingId, buildingId: result.buildingId, contractId: result.contract?.id || null });
      return { ok: true, immediate: true, result };
    }
    return { ok: false, reason: "essa interação ainda não possui execução direta" };
  }

  function pumpCommands() {
    if (!isGameplay()) return;
    const actor = player(), result = actor?.playerControl?.lastCommandResult;
    if (result && session.activeCommand?.id === result.commandId) {
      actor.playerControl.lastCommandResult = null;
      resolveActive({ ...result, message: result.message });
    }
    if (session.activeCommand || !session.commandQueue.length) return;
    const begun = beginNextPlayerCommand(session, { clock: clockOf(sim()) });
    if (!begun.ok) return;
    session = begun.state;
    const executed = executeCommand(begun.command);
    if (!executed?.ok) resolveActive({ ok: false, reason: executed?.reason || "ação indisponível", message: executed?.reason || "A ação não pôde ser iniciada." });
    else {
      const immediateResult = player()?.playerControl?.lastCommandResult;
      if (immediateResult?.commandId === begun.command.id) {
        player().playerControl.lastCommandResult = null;
        resolveActive({ ...immediateResult, message: immediateResult.message });
      }
    }
  }

  function queueAction(input) {
    if (!isGameplay()) return;
    const currentActive = session.activeCommand;
    if (input.actionId === "go_to" && currentActive?.category === "navigation") cancelCurrentAction("Destino substituído pelo jogador", true);
    const queued = enqueuePlayerCommand(session, input, world(), { clock: clockOf(sim()), replaceNavigation: true });
    if (!queued.ok) { showToast("Ação indisponível", queued.errors?.[0]?.message || queued.reason, "error"); return; }
    session = queued.state;
    lastPanelSignature = "";
    pumpCommands();
    render(true);
  }

  function cancelCurrentAction(reason = "Cancelada pelo jogador", silent = false) {
    const activeId = session?.activeCommand?.id;
    sim()?.cancelPlayerAction?.(reason);
    if (activeId) {
      const cancelled = cancelPlayerCommand(session, activeId, reason, { force: true, clock: clockOf(sim()) });
      if (cancelled.ok) session = cancelled.state;
    }
    player()?.playerControl && (player().playerControl.lastCommandResult = null);
    lastPanelSignature = "";
    if (!silent) showToast("Ação cancelada", reason, "warning");
  }

  function handleActionElement(button) {
    const current = sim(), actor = player(), actionId = button.dataset.playerAction;
    if (!current || !actor || !actionId) return;
    if (actionId === "cancel") { cancelCurrentAction(); render(true); return; }
    const targetId = button.dataset.targetId || "", targetKind = button.dataset.targetKind || "";
    const payload = {};
    if (button.dataset.product) payload.productName = button.dataset.product;
    if (button.dataset.interactionKind) payload.kind = button.dataset.interactionKind;
    if (button.dataset.role) payload.role = button.dataset.role;
    if (button.dataset.course) payload.course = button.dataset.course;
    if (button.dataset.listingId) payload.listingId = button.dataset.listingId;
    if (button.dataset.operation) payload.operation = button.dataset.operation;
    const travelMode = document.querySelector("#playerTravelMode")?.value;
    if (["go_to", "go_home"].includes(actionId)) payload.mode = button.dataset.mode || travelMode || "auto";
    const product = targetKind === "business" && payload.productName ? current.businesses.find((item) => item.id === targetId)?.products?.[payload.productName] : null;
    queueAction({ actionId, target: targetId ? { kind: targetKind, id: targetId, label: button.dataset.targetLabel || button.textContent.trim() } : null, payload, cost: Number(button.dataset.actionCost) || product?.price || 0, priority: ["go_to", "go_home"].includes(actionId) ? 90 : 75 });
  }

  function renderStates(actor) {
    const states = [];
    if (!actor.alive) states.push(["danger", "Falecido"]);
    if (actor.justice?.incarcerated) states.push(["danger", actor.justice.pretrial ? "Prisão provisória" : `${actor.justice.sentenceRemaining} dias de pena`]);
    if (actor.medical?.admitted) states.push(["danger", "Internado"]);
    else if (actor.medical?.conditions?.length) states.push(["warning", `${actor.medical.conditions.length} condição(ões) em tratamento`]);
    if (actor.education?.enrolled) states.push(["positive", `Matriculado · ${actor.education.institution}`]);
    if (actor.shift) states.push(["positive", `${actor.role} · ${actor.workplace}`]);
    if (!states.length) states.push(["positive", "Livre para decidir"]);
    return states.slice(0, 4).map(([tone, label]) => `<span class="player-state player-state-${tone}"><i></i><span>${escapeHTML(label)}</span></span>`).join("");
  }

  function syncPlayerGoalsFromWorld(actor) {
    const goals = session?.player?.character?.goals || [];
    goals.forEach((goal) => {
      const derived = Math.round(derivePlayerGoalProgress(goal.id, actor, sim()));
      if (derived <= (goal.progress || 0)) return;
      const crossed = (PLAYER_GOAL_MILESTONES[goal.id] || []).filter(([threshold]) => (goal.progress || 0) < threshold && derived >= threshold).at(-1);
      const updated = updatePlayerGoal(session, goal.id, derived - (goal.progress || 0), crossed?.[1] || null, { clock: clockOf(sim()) });
      if (updated.ok) session = updated.state;
    });
    actor.personalGoals = (session?.player?.character?.goals || []).map((goal) => ({ ...goal, milestones: [...(goal.milestones || [])] }));
  }

  function objectivesPanel(context) {
    const goals = session?.player?.character?.goals || [];
    return `<div class="player-goal-list">${goals.map((goal) => {
      const definition = playerGoalCatalog.find((item) => item.id === goal.id), [threshold, next] = nextPlayerGoalMilestone(goal.id, goal.progress || 0);
      return `<article class="player-goal-card ${goal.status === "completed" ? "player-goal-complete" : ""}"><header><span><small>${goal.status === "completed" ? "CONCLUÍDO" : `PRÓXIMO MARCO · ${threshold}%`}</small><b>${escapeHTML(definition?.name || goal.id)}</b></span><em>${Math.round(goal.progress || 0)}%</em></header><p>${escapeHTML(goal.status === "completed" ? "Esta aspiração já faz parte do legado do personagem." : next)}</p><div class="player-objective-progress" style="--player-value:${clamp(goal.progress || 0)}%"><i></i></div>${goal.milestones?.length ? `<small class="player-goal-latest">Último avanço: ${escapeHTML(goal.milestones.at(-1).text)}</small>` : ""}</article>`;
    }).join("")}</div>${goals.length ? "" : `<p class="player-action-message">Seu personagem ainda não escolheu uma aspiração.</p>`}`;
  }

  function nearbyDestinations(context) {
    const { person, place } = context;
    return sim().buildings.filter((building) => building.id !== place?.id).map((building) => ({ building, distance: Math.hypot((building.x + building.w / 2) - person.x, (building.y + building.h / 2) - person.y) })).sort((a, b) => a.distance - b.distance);
  }

  function contextPanel(context) {
    const { person: actor, place, business, home, workplace, institution, nearbyPeople } = context;
    const buttons = [];
    if (place?.id !== home?.id && home) buttons.push(actionButton({ action: "go_home", title: "Ir para casa", subtitle: formatAddress(home.address), targetKind: "home", targetId: home.id }));
    if (place?.id === home?.id) {
      buttons.push(actionButton({ action: "rest", title: "Descansar", subtitle: "Recupera energia e conforto", targetKind: "home", targetId: home.id }));
      buttons.push(actionButton({ action: "eat", title: "Preparar refeição", subtitle: "Reduz a fome", targetKind: "home", targetId: home.id }));
      buttons.push(actionButton({ action: "hygiene", title: "Cuidar da higiene", subtitle: "Recupera higiene e conforto", targetKind: "home", targetId: home.id }));
    }
    if (workplace?.id === place?.id && actor.shift) buttons.push(actionButton({ action: "work", title: "Iniciar expediente", subtitle: `${actor.role} · 2 horas`, targetKind: "building", targetId: place.id }));
    if (institution?.id === place?.id && actor.education?.enrolled) buttons.push(actionButton({ action: "study", title: "Estudar", subtitle: "Desempenho, frequência e créditos", targetKind: "building", targetId: place.id }));
    if (place?.type === "health") buttons.push(actionButton({ action: "seek_healthcare", title: "Solicitar atendimento", subtitle: actor.medical.conditions.length ? "Triagem e tratamento do quadro ativo" : "Consulta preventiva", targetKind: "building", targetId: place.id }));
    if (business) Object.entries(business.products || {}).slice(0, 8).forEach(([name, product]) => buttons.push(actionButton({ action: "shop", title: name, subtitle: `${product.stock} em estoque${sim().isOpen(business) ? "" : " · fechado"}`, targetKind: "business", targetId: business.id, product: name, cost: money(product.price), disabled: !sim().isOpen(business) || product.stock <= 0 || actor.money < product.price })));
    nearbyPeople.slice(0, 4).forEach((person) => buttons.push(actionButton({ action: "talk", title: `Conversar com ${person.firstName}`, subtitle: person.activity, targetKind: "person", targetId: person.id, kind: "talk" })));
    if (!buttons.length) buttons.push(actionButton({ action: "wait", title: "Observar o movimento", subtitle: "Esperar 15 minutos" }));
    return `<div class="player-action-grid">${buttons.join("")}</div>`;
  }

  function placesPanel(context) {
    const destinations = nearbyDestinations(context).filter(({ building }) => building.type !== "home" || building.id === context.home?.id);
    const essential = destinations.filter(({ building }) => building.id === context.home?.id || ["health", "school"].includes(building.type) || ["Agência Municipal de Emprego", "Prefeitura Municipal", "Delegacia"].includes(building.name));
    const categories = [...essential, ...destinations].filter((entry, index, all) => all.findIndex((candidate) => candidate.building.id === entry.building.id) === index).slice(0, 16);
    return `<label class="player-action-message">Como ir? <select id="playerTravelMode"><option value="auto">Melhor opção disponível</option><option value="a pé">A pé</option><option value="bicicleta">Bicicleta</option><option value="ônibus">Ônibus</option><option value="táxi">Táxi</option><option value="carro">Carro próprio</option></select></label><div class="player-action-grid">${categories.map(({ building, distance }) => actionButton({ action: "go_to", title: building.name, subtitle: `${formatAddress(building.address)} · ${distance.toFixed(1)} quadras`, targetKind: "building", targetId: building.id, icon: building.type === "school" ? "✎" : building.type === "home" ? "⌂" : "⌖" })).join("")}</div>`;
  }

  function peoplePanel(context) {
    const actor = context.person, nearbyIds = new Set(context.nearbyPeople.map((person) => person.id));
    const known = sim().relationshipsOf(actor)
      .filter(({ link, person }) => person.alive && ((link.familiarity || 0) > 0 || link.domain === "family" || link.type === "família"))
      .sort((left, right) => Number(nearbyIds.has(right.person.id)) - Number(nearbyIds.has(left.person.id)) || (right.link.lastInteractionWeek || 0) - (left.link.lastInteractionWeek || 0) || (right.link.affinity || 0) - (left.link.affinity || 0));
    const pendingDecisions = (sim().relationshipSystem?.playerPendingDecisions || []).filter((decision) => decision.status === "pending" && decision.personIds?.includes(actor.id));
    const decisions = pendingDecisions.length ? `<h4 class="player-panel-heading">Conversas importantes · ${pendingDecisions.length}</h4><div class="player-decision-list">${pendingDecisions.map((decision) => { const otherId = decision.personIds.find((id) => id !== actor.id), other = sim().people.find((person) => person.id === otherId); return `<button data-player-open-person="${otherId}"><span><b>${escapeHTML(other?.name || "Vínculo importante")}</b><small>${escapeHTML(decision.reason || (decision.proposedStage ? `A relação está pronta para conversar sobre ${decision.proposedStage.replaceAll("_", " ")}.` : "Há uma decisão familiar esperando sua atenção."))}</small></span><em>Abrir relação →</em></button>`; }).join("")}</div>` : "";
    const nearby = context.nearbyPeople.length
      ? `<h4 class="player-panel-heading">Perto de você</h4><div class="player-action-grid">${context.nearbyPeople.slice(0, 8).map((person) => actionButton({ action: "talk", title: person.name, subtitle: "Iniciar uma conversa", targetKind: "person", targetId: person.id, kind: "talk", icon: "◌" })).join("")}</div>`
      : `<p class="player-action-message">Não há ninguém disponível neste espaço agora. Seus contatos continuam acessíveis abaixo.</p>`;
    const contacts = known.length ? `<h4 class="player-panel-heading">Pessoas conhecidas · ${known.length}</h4><div class="player-contact-list">${known.slice(0, 30).map(({ link, person }) => {
      const stage = link.lifecycle?.stage ? link.lifecycle.stage.replaceAll("_", " ") : link.type || "conhecido", present = nearbyIds.has(person.id), location = sim().buildings.find((building) => building.id === person.locationId);
      return `<article class="player-contact-card"><i style="--player-contact:${escapeAttribute(person.color || "#78897d")}">${escapeHTML(initials(person.name))}</i><span><b>${escapeHTML(person.name)}</b><small>${escapeHTML(stage)} · afinidade ${Math.round(link.affinity || 0)} · confiança ${Math.round(link.trust || 0)}%</small><em>${present ? "Aqui agora" : escapeHTML(location?.name || "Em deslocamento")}</em></span><div><button data-player-open-person="${person.id}">Ficha</button><button data-player-locate-person="${person.id}">Localizar</button>${present ? `<button data-player-open-person="${person.id}">Interagir</button>` : ""}</div></article>`;
    }).join("")}</div>` : `<p class="player-action-message">Converse com alguém para começar sua agenda de conhecidos.</p>`;
    return `${decisions}${nearby}${contacts}`;
  }

  function careerPanel(context) {
    const actor = context.person, buttons = [];
    if (context.workplace) {
      if (context.place?.id === context.workplace.id) buttons.push(actionButton({ action: "work", title: "Trabalhar agora", subtitle: `${actor.role} · ${money(actor.hourlyWage || 0)}/h`, targetKind: "building", targetId: context.workplace.id }));
      else buttons.push(actionButton({ action: "go_to", title: `Ir ao trabalho`, subtitle: context.workplace.name, targetKind: "building", targetId: context.workplace.id }));
    }
    if (context.institution) {
      if (context.place?.id === context.institution.id) buttons.push(actionButton({ action: "study", title: "Estudar agora", subtitle: `${actor.education.performance.toFixed(0)}% de desempenho`, targetKind: "building", targetId: context.institution.id }));
      else buttons.push(actionButton({ action: "go_to", title: "Ir estudar", subtitle: context.institution.name, targetKind: "building", targetId: context.institution.id }));
    }
    if (!actor.shift && actor.age >= 18 && context.business) buttons.push(actionButton({ action: "apply_job", title: `Candidatar-se em ${context.business.name}`, subtitle: `${context.business.requiredRoles?.[0] || context.business.sector} · você já está no local`, targetKind: "business", targetId: context.business.id, role: context.business.requiredRoles?.[0] || "" }));
    if (!actor.shift && actor.age >= 18) sim().businesses.filter((business) => !business.closed && business.id !== context.business?.id).sort((a, b) => (b.openVacancies || 0) - (a.openVacancies || 0) || a.employees.length - b.employees.length).slice(0, 10).forEach((business) => {
      const building = sim().buildings.find((candidate) => candidate.id === business.buildingId), present = context.place?.id === business.buildingId;
      const opportunity = business.openVacancies ? `${business.openVacancies} vaga(s) aberta(s)` : "candidatura espontânea";
      buttons.push(actionButton({ action: present ? "apply_job" : "go_to", title: present ? `Candidatar-se em ${business.name}` : `Conhecer ${business.name}`, subtitle: `${business.requiredRoles?.[0] || business.sector} · ${opportunity}`, targetKind: present ? "business" : "building", targetId: present ? business.id : building?.id, role: business.requiredRoles?.[0] || "" }));
    });
    sim().buildings.filter((building) => building.type === "school").forEach((institution) => {
      if (context.place?.id === institution.id && context.institution?.id !== institution.id) buttons.push(actionButton({ action: "enroll", title: `Matricular-se`, subtitle: institution.name, targetKind: "building", targetId: institution.id, course: actor.age >= 18 ? "Administração" : "" }));
      else if (context.institution?.id !== institution.id) buttons.push(actionButton({ action: "go_to", title: `Ir a ${institution.name}`, subtitle: actor.age >= 18 && institution.name.includes("Faculdade") ? "Conhecer cursos e solicitar matrícula" : "Conhecer a instituição", targetKind: "building", targetId: institution.id, icon: "✎" }));
    });
    return `<div class="player-action-grid">${buttons.join("") || actionButton({ action: "wait", title: "Planejar próximos passos", subtitle: "A cidade seguirá oferecendo oportunidades" })}</div>`;
  }

  function propertyPanel(context) {
    const portal = getRealEstatePortal(sim(), context.person);
    if (!portal.ok) return `<p class="player-action-message">${escapeHTML(portal.error || "O portal imobiliário ainda não está disponível.")}</p>`;
    const activeContracts = portal.contracts.filter((contract) => contract.status === "active"), listings = portal.listings.filter((listing) => listing.use?.startsWith("residencial") || sim().buildings.find((building) => building.id === listing.buildingId)?.type === "home");
    const listingHTML = listings.slice(0, 16).map((listing) => {
      const building = sim().buildings.find((item) => item.id === listing.buildingId), rental = listing.kind === "rent", availableUnits = rental ? listing.rentalUnit?.availableUnitsAtListing || 1 : listing.vacantUnits, required = rental ? listing.costs.upfrontTotal : listing.costs.financing?.downPayment || listing.costs.cashTotal, eligible = rental ? listing.accessibility.canRent : listing.accessibility.canFinance;
      const detail = rental ? `${money(listing.costs.monthlyRent)}/mês · entrada ${money(required)}` : `${money(listing.costs.askingPrice)} · entrada ${money(required)} · ${listing.costs.financing ? `${listing.costs.financing.months} meses` : "à vista"}`;
      return `<article class="player-property-card ${eligible ? "player-property-eligible" : ""}"><header><span><b>${escapeHTML(listing.name)}</b><small>${escapeHTML(listing.address?.district || "Vila Esperança")} · capacidade ${listing.capacity} · ${availableUnits} unidade(s) disponível(is)</small></span><em>${rental ? "ALUGUEL" : "VENDA"}</em></header><p>${escapeHTML(detail)}</p><small>${eligible ? `Elegível · crédito ${portal.actor.creditScore} · comprometimento ${Math.round((listing.accessibility.housingCostRatio || 0) * 100)}%` : escapeHTML(listing.accessibility.reasons?.[0] || "Critérios não atendidos")}</small><div class="player-property-actions">${building ? actionButton({ action: "go_to", title: "Visitar", subtitle: building.name, targetKind: "building", targetId: building.id, icon: "⌖" }) : ""}${actionButton({ action: rental ? "rent_property" : "buy_property", title: rental ? "Alugar este imóvel" : "Comprar com financiamento", subtitle: eligible ? (listing.accessibility.transactionMode === "investment" ? "A propriedade entrará no patrimônio como investimento" : "Contrato e mudança serão processados") : listing.accessibility.reasons?.[0], targetKind: "building", targetId: listing.buildingId, listingId: listing.id, operation: rental ? "rent" : "buy", disabled: !eligible, cost: money(required) })}</div></article>`;
    }).join("");
    return `<div class="player-property-summary"><span><small>RECURSOS DO DOMICÍLIO</small><b>${money(portal.actor.balance)}</b></span><span><small>RENDA MENSAL</small><b>${money(portal.actor.monthlyIncome)}</b></span><span><small>CRÉDITO</small><b>${portal.actor.creditScore}</b></span><span><small>IMÓVEIS</small><b>${portal.ownedBuildings.length}</b></span></div>${activeContracts.length ? `<h4 class="player-panel-heading">Seus contratos</h4><div class="player-action-message">${activeContracts.map((contract) => `${contract.type === "mortgage" ? "Financiamento" : "Aluguel"}: ${money(contract.weeklyPayment)}/semana${contract.arrearsWeeks ? ` · ${contract.arrearsWeeks} atraso(s)` : ""}`).join("<br>")}</div>` : ""}<h4 class="player-panel-heading">Portal imobiliário · ${listings.length} anúncio(s)</h4><div class="player-property-list">${listingHTML || `<p class="player-action-message">Não há imóveis residenciais anunciados neste momento.</p>`}</div>`;
  }

  function renderPanel(context, force = false) {
    const actor = context.person, active = session.activeCommand, signature = [panelTab, panelExpanded, actor.locationId, actor.homeId, actor.workplace, actor.education?.institution, actor.shift?.name, Math.floor(actor.money), active?.id, session.commandQueue.length, context.business?.id, context.business ? sim().isOpen(context.business) : ""].join("|");
    if (!force && signature === lastPanelSignature) return;
    lastPanelSignature = signature;
    const panel = hudRoot.querySelector("#playerActionPanel");
    panel.classList.toggle("player-collapsed", !panelExpanded);
    const inTransit = Boolean(actor.currentTrip);
    panel.querySelector("#playerActionPlace").textContent = inTransit ? "Em deslocamento" : context.place?.name || "Local atual";
    panel.querySelector("#playerInteractionContext").innerHTML = inTransit
      ? `<i>⇄</i><span><b>Deslocamento em curso</b><small>${escapeHTML(sim().derivePersonAction(actor).text)}</small></span><em class="player-distance">${escapeHTML(actor.currentTrip.mode)}</em>`
      : `<i>${context.business ? "▣" : context.place?.type === "home" ? "⌂" : "⌖"}</i><span><b>${escapeHTML(context.place?.name || "Localização indisponível")}</b><small>${escapeHTML(context.place?.address ? formatAddress(context.place.address) : "Localização sendo atualizada")}</small></span><em class="player-distance">${context.nearbyPeople.length} pessoa(s)</em>`;
    const tabs = panel.querySelector("#playerActionTabs");
    tabs.innerHTML = [["context", "Agora"], ["places", "Lugares"], ["people", "Pessoas"], ["career", "Trabalho e estudo"], ["property", "Moradia"], ["objectives", "Objetivos"]].map(([id, label]) => `<button class="player-action-tab ${panelTab === id ? "player-active" : ""}" data-player-tab="${id}">${label}</button>`).join("");
    const content = panel.querySelector("#playerActionBody");
    content.innerHTML = inTransit && panelTab !== "places"
      ? `<p class="player-action-message">Você está em trânsito. Aguarde a chegada, escolha outro destino em “Lugares” ou cancele o trajeto atual.</p>`
      : panelTab === "places" ? placesPanel(context) : panelTab === "people" ? peoplePanel(context) : panelTab === "career" ? careerPanel(context) : panelTab === "property" ? propertyPanel(context) : panelTab === "objectives" ? objectivesPanel(context) : contextPanel(context);
    if (active) content.insertAdjacentHTML("beforeend", `<p class="player-action-message">Em andamento: <b>${escapeHTML(active.actionId.replaceAll("_", " "))}</b>. ${session.commandQueue.length ? `${session.commandQueue.length} decisão(ões) na fila.` : ""}</p>${actionButton({ action: "cancel", title: "Cancelar ação atual", subtitle: "Interrompe a decisão em andamento", icon: "×" })}`);
  }

  function render(force = false) {
    if (!isGameplay() || hudRoot.hidden) return;
    pumpCommands();
    const current = sim(), context = current.playerContext?.(), actor = context?.person;
    if (!actor) return;
    syncPlayerGoalsFromWorld(actor);
    const action = current.derivePersonAction(actor), place = context.place;
    hudRoot.querySelector("#playerAvatar").textContent = initials(actor.name);
    hudRoot.querySelector("#playerAvatar").style.setProperty("--player-avatar", actor.color || "#8e6b56");
    hudRoot.querySelector("#playerName").textContent = actor.name;
    hudRoot.querySelector("#playerRole").textContent = `${actor.age} anos · ${actor.role}`;
    hudRoot.querySelector("#playerLocation").textContent = actor.currentTrip ? `Em trânsito · ${action.mode || actor.currentTrip.mode}` : place?.name || "Localização indisponível";
    hudRoot.querySelector("#playerMoney").textContent = money(actor.money);
    hudRoot.querySelector("#playerClock").textContent = `${dayNames[current.day]} · ${current.time}`;
    hudRoot.querySelector("#playerWeather").textContent = `${current.weather} · ${current.temperature}°C`;
    hudRoot.querySelector("#playerActionText").textContent = action.text || actor.activity;
    const remaining = actor.playerControl?.activeAction ? Math.max(0, actor.playerControl.activeAction.endsAt - current.absoluteMinute()) : actor.currentTrip?.remainingMinutes;
    const actionMode = action.mode && action.mode !== "presencial" ? action.mode : "";
    hudRoot.querySelector("#playerActionTime").textContent = [actionMode, Number.isFinite(remaining) ? `${Math.ceil(remaining)} min` : session.activeCommand ? "em curso" : "livre"].filter(Boolean).join(" · ");
    const needs = { hunger: ["Fome", actor.needs.hunger], social: ["Social", actor.needs.social], hygiene: ["Higiene", actor.needs.hygiene], energy: ["Energia", actor.energy] };
    Object.entries(needs).forEach(([id, [label, value]]) => {
      const root = hudRoot.querySelector(`[data-player-need="${id}"]`), normalized = clamp(value);
      root.classList.toggle("player-warning", normalized < 40 && normalized >= 20);
      root.classList.toggle("player-critical", normalized < 20);
      root.querySelector("span").textContent = label;
      root.querySelector("b").textContent = `${Math.round(normalized)}%`;
      root.querySelector(".player-need-track").style.setProperty("--player-value", `${normalized}%`);
    });
    hudRoot.querySelector("#playerStateStrip").innerHTML = renderStates(actor);
    const goal = session.player?.character?.goals?.filter((item) => item.status === "active").sort((left, right) => (left.progress || 0) - (right.progress || 0))[0] || session.player?.character?.goals?.[0], definition = playerGoalCatalog.find((item) => item.id === goal?.id), nextMilestone = nextPlayerGoalMilestone(goal?.id, goal?.progress || 0);
    hudRoot.querySelector("#playerObjectiveName").textContent = definition?.name || "Viver sua própria história";
    hudRoot.querySelector("#playerObjectiveText").textContent = goal?.status === "completed" ? "Aspiração concluída — este legado já faz parte da sua história." : definition ? `Próximo marco: ${nextMilestone[1]}.` : "Suas escolhas constroem a trajetória do personagem.";
    hudRoot.querySelector("#playerObjectiveProgress").style.setProperty("--player-value", `${clamp(goal?.progress || 0)}%`);
    renderPanel(context, force);
    const critical = `${actor.alive}:${actor.justice?.incarcerated}:${actor.medical?.admitted}:${actor.medical?.conditions?.map((condition) => condition.id).join(",")}`;
    if (lastCriticalSignature && critical !== lastCriticalSignature) {
      if (!actor.alive) { showToast("Seu personagem faleceu", actor.death?.cause || "A ficha permanecerá aberta para acompanhar o desfecho.", "error"); options.onCriticalEvent?.("death", actor); }
      else if (actor.justice?.incarcerated) { showToast("Você foi preso", `${actor.justice.sentenceRemaining || 0} dias restantes.`, "error"); options.onCriticalEvent?.("prison", actor); }
      else if (actor.medical?.admitted) { showToast("Você foi internado", "O tratamento agora faz parte da sua história.", "warning"); options.onCriticalEvent?.("hospital", actor); }
      else if (actor.medical?.conditions?.length) showToast("Mudança na saúde", "Consulte sua ficha e procure atendimento se necessário.", "warning");
    }
    lastCriticalSignature = critical;
  }

  function decorateBuilding(root, building, business = null) {
    if (!isGameplay() || !root || !building) return;
    root.querySelector("[data-player-world-actions]")?.remove();
    const actor = player(), present = actor?.locationId === building.id && !actor.currentTrip, actions = [];
    if (!present) actions.push(actionButton({ action: "go_to", title: `Ir até ${building.name}`, subtitle: building.address ? formatAddress(building.address) : "Definir rota", targetKind: "building", targetId: building.id }));
    if (present && business) Object.entries(business.products || {}).slice(0, 6).forEach(([name, product]) => actions.push(actionButton({ action: "shop", title: `Comprar ${name}`, subtitle: `${product.stock} em estoque`, targetKind: "business", targetId: business.id, product: name, cost: money(product.price), disabled: !sim().isOpen(business) || !product.stock || actor.money < product.price })));
    if (present && business && !actor.shift && actor.age >= 18) actions.push(actionButton({ action: "apply_job", title: "Candidatar-se a uma vaga", subtitle: business.requiredRoles?.[0] || business.sector, targetKind: "business", targetId: business.id, role: business.requiredRoles?.[0] || "" }));
    if (present && building.type === "school" && actor.education?.institution !== building.name) actions.push(actionButton({ action: "enroll", title: "Solicitar matrícula", subtitle: building.name, targetKind: "building", targetId: building.id, course: actor.age >= 18 ? "Administração" : "" }));
    root.insertAdjacentHTML("afterbegin", `<section data-player-world-actions><small>SUAS AÇÕES NESTE LOCAL</small><div class="player-action-grid">${actions.join("") || actionButton({ action: "wait", title: "Observar o local", subtitle: "Aguardar alguns minutos" })}</div></section>`);
  }

  function decoratePerson(root, target) {
    if (!isGameplay() || !root || !target) return;
    root.querySelector("[data-player-world-actions]")?.remove();
    const actor = player();
    if (!actor || target.id === actor.id) return;
    const samePlace = !actor.currentTrip && !target.currentTrip && actor.locationId === target.locationId, actions = [];
    if (samePlace) {
      const relationshipActions = sim().playerRelationshipActions?.(target.id) || [];
      relationshipActions.forEach((entry) => actions.push(actionButton({
        action: "talk",
        title: entry.name,
        subtitle: entry.available ? `${entry.description}${entry.acceptanceChance < .99 ? ` · receptividade estimada ${Math.round(entry.acceptanceChance * 100)}%` : ""}` : entry.reason,
        targetKind: "person",
        targetId: target.id,
        kind: entry.id,
        disabled: !entry.available,
        icon: entry.category === "romance" ? "♡" : entry.category === "family" ? "⌂" : entry.category === "conflict" ? "!" : entry.category === "commitment" ? "◇" : "◌",
      })));
      if (!relationshipActions.length) [["talk", "Conversar"], ["compliment", "Elogiar"], ["support", "Oferecer apoio"], ["flirt", "Flertar"], ["argue", "Discutir"]].forEach(([kind, label]) => actions.push(actionButton({ action: "talk", title: `${label} com ${target.firstName}`, subtitle: "A relação reagirá ao contexto", targetKind: "person", targetId: target.id, kind })));
    }
    else if (!target.currentTrip && target.locationId) {
      const place = sim().buildings.find((building) => building.id === target.locationId);
      if (place) actions.push(actionButton({ action: "go_to", title: `Ir ao encontro de ${target.firstName}`, subtitle: place.name, targetKind: "building", targetId: place.id }));
    }
    const link = sim().relationshipsOf(actor).find((entry) => entry.person.id === target.id)?.link, stage = link?.lifecycle?.stage?.replaceAll("_", " ") || link?.type || "ainda não se conhecem";
    root.insertAdjacentHTML("afterbegin", `<section data-player-world-actions><small>INTERAGIR COMO ${escapeHTML(actor.firstName.toUpperCase())}</small><p class="player-action-message">Vínculo atual: <b>${escapeHTML(stage)}</b>${link ? ` · afinidade ${Math.round(link.affinity || 0)} · confiança ${Math.round(link.trust || 0)}% · tensão ${Math.round(link.tension || 0)}%` : ""}. A outra pessoa pode aceitar, recusar ou pedir mais tempo.</p><div class="player-action-grid">${actions.join("") || "<p class='player-action-message'>Essa pessoa está em deslocamento ou indisponível agora.</p>"}</div></section>`);
  }

  function mount(host = document.querySelector("#app")) {
    if (!host || mounted) return;
    host.insertAdjacentHTML("beforeend", `<div class="game-setup-shell" id="gameSetup" hidden></div><aside class="player-hud player-hidden" id="playerHud" hidden aria-label="Controles do personagem"><div class="player-topbar"><span class="player-topbar-item"><i>⌖</i><span><small>LOCAL</small><b id="playerLocation">—</b></span></span><span class="player-topbar-item"><i>◷</i><span><small>AGORA</small><b id="playerClock">—</b></span></span><span class="player-topbar-item"><i>¤</i><span><small>CARTEIRA</small><b id="playerMoney">—</b></span></span><span class="player-topbar-item"><i>☀</i><span><small>CLIMA</small><b id="playerWeather">—</b></span></span></div><section class="player-profile"><header class="player-profile-head"><i class="player-avatar" id="playerAvatar">CV</i><span class="player-profile-copy"><b id="playerName">Seu personagem</b><span id="playerRole">—</span></span><button class="player-profile-toggle" id="playerPanelToggle" title="Abrir ações">☰</button></header><div class="player-current-action"><i></i><span><small>AÇÃO ATUAL</small><b id="playerActionText">Aguardando sua decisão</b></span><time id="playerActionTime">livre</time></div><div class="player-needs">${["hunger", "social", "hygiene", "energy"].map((id) => `<div class="player-need" data-player-need="${id}"><div class="player-need-head"><span>${id}</span><b>100%</b></div><div class="player-need-track"><i></i></div></div>`).join("")}</div></section><div class="player-state-strip" id="playerStateStrip"></div><section class="player-objective"><small>OBJETIVO DE VIDA</small><b id="playerObjectiveName">Viver sua história</b><p id="playerObjectiveText"></p><div class="player-objective-progress" id="playerObjectiveProgress"><i></i></div></section><section class="player-action-panel" id="playerActionPanel"><header class="player-action-head"><span><small>O QUE FAZER?</small><b id="playerActionPlace">Local atual</b></span><button class="player-action-close" id="playerActionClose" title="Recolher painel">⌄</button></header><div class="player-interaction-context" id="playerInteractionContext"></div><div class="player-action-content"><div class="player-action-tabs" id="playerActionTabs"></div><div id="playerActionBody"></div></div></section><div class="player-toast-stack" id="playerToastStack" aria-live="polite"></div></aside>`);
    setupRoot = document.querySelector("#gameSetup");
    hudRoot = document.querySelector("#playerHud");
    mounted = true;
    renderModeSelection();
    setupRoot.addEventListener("click", (event) => {
      const mode = event.target.closest("[data-select-mode]");
      if (mode) { selectedMode = mode.dataset.selectMode; renderModeSelection(); return; }
      if (event.target.closest("[data-confirm-mode]")) { if (selectedMode) { pendingSlotAction = null; renderSlotSelection(selectedMode); setupRoot.scrollTop = 0; } return; }
      if (event.target.closest("[data-slots-back]")) { selectedSlot = null; pendingSlotAction = null; renderModeSelection(); setupRoot.scrollTop = 0; return; }
      if (event.target.closest("[data-creator-back]")) { setupView = "slots"; renderSlotSelection(GAME_MODES.GAMEPLAY); setupRoot.scrollTop = 0; return; }
      const newSlot = event.target.closest("[data-new-slot]");
      if (newSlot) { selectedSlot = Number(newSlot.dataset.newSlot); pendingSlotAction = null; if (selectedMode === GAME_MODES.GAMEPLAY) { setupView = "creator"; renderCreator(); setupRoot.scrollTop = 0; } else void startSelectedGame(selectedMode); return; }
      const loadSlot = event.target.closest("[data-load-slot]");
      if (loadSlot) { pendingSlotAction = null; void loadSelectedGame(selectedMode, Number(loadSlot.dataset.loadSlot)); return; }
      const overwriteSlot = event.target.closest("[data-overwrite-slot]");
      if (overwriteSlot) {
        const slot = Number(overwriteSlot.dataset.overwriteSlot), key = `overwrite:${selectedMode}:${slot}`;
        if (pendingSlotAction !== key) { pendingSlotAction = key; renderSlotSelection(selectedMode); return; }
        selectedSlot = slot; pendingSlotAction = null;
        if (selectedMode === GAME_MODES.GAMEPLAY) { setupView = "creator"; renderCreator(); setupRoot.scrollTop = 0; } else void startSelectedGame(selectedMode);
        return;
      }
      const deleteSlot = event.target.closest("[data-delete-slot]");
      if (deleteSlot) {
        const slot = Number(deleteSlot.dataset.deleteSlot), key = `delete:${selectedMode}:${slot}`;
        if (pendingSlotAction !== key) { pendingSlotAction = key; renderSlotSelection(selectedMode); return; }
        try { options.deleteSaveSlot?.(selectedMode, slot); options.onDeleted?.({ mode: selectedMode, slot }); } catch (error) { options.onSaveError?.(error); }
        pendingSlotAction = null; renderSlotSelection(selectedMode); return;
      }
      if (event.target.closest("[data-randomize-character]")) { draft = createCharacterDraft({ age: 22, goalIds: ["career", "social"] }); renderCreator(); return; }
      const origin = event.target.closest("[data-origin]");
      if (origin) { syncDraftFromForm(); draft.originId = origin.dataset.origin; renderCreator(); return; }
      const trait = event.target.closest("[data-trait]");
      if (trait) { syncDraftFromForm(); const value = trait.dataset.trait, has = draft.traits.includes(value); if (has) draft.traits = draft.traits.filter((item) => item !== value); else if (draft.traits.length < 4) draft.traits = [...draft.traits, value]; else { showSetupMessage("Escolha no máximo quatro características."); return; } renderCreator(); return; }
      const valueOption = event.target.closest("[data-value]");
      if (valueOption) { syncDraftFromForm(); const value = valueOption.dataset.value, has = draft.values.includes(value); if (has) draft.values = draft.values.filter((item) => item !== value); else if (draft.values.length < 3) draft.values = [...draft.values, value]; else { showSetupMessage("Escolha no máximo três valores centrais."); return; } renderCreator(); return; }
      const interestOption = event.target.closest("[data-interest]");
      if (interestOption) { syncDraftFromForm(); const value = interestOption.dataset.interest, has = draft.interests.includes(value); if (has) draft.interests = draft.interests.filter((item) => item !== value); else if (draft.interests.length < 5) draft.interests = [...draft.interests, value]; else { showSetupMessage("Escolha no máximo cinco interesses."); return; } renderCreator(); return; }
      const relationshipModel = event.target.closest("[data-relationship-model]");
      if (relationshipModel) { syncDraftFromForm(); draft.relationshipPreferences = { ...(draft.relationshipPreferences || {}), model: relationshipModel.dataset.relationshipModel }; renderCreator(); return; }
      const goal = event.target.closest("[data-goal]");
      if (goal) { syncDraftFromForm(); const value = goal.dataset.goal, has = draft.goalIds.includes(value); if (has) draft.goalIds = draft.goalIds.filter((item) => item !== value); else if (draft.goalIds.length < 3) draft.goalIds = [...draft.goalIds, value]; else { showSetupMessage("Escolha no máximo três objetivos."); return; } renderCreator(); return; }
      if (event.target.closest("[data-setup-resume]")) hideSetup(true);
    });
    hudRoot.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-player-tab]");
      if (tab) { panelTab = tab.dataset.playerTab; lastPanelSignature = ""; render(true); return; }
      if (event.target.closest("#playerPanelToggle")) { panelExpanded = true; lastPanelSignature = ""; render(true); return; }
      if (event.target.closest("#playerActionClose")) { panelExpanded = !panelExpanded; lastPanelSignature = ""; render(true); }
    });
    document.addEventListener("click", (event) => {
      const openPerson = event.target.closest("[data-player-open-person]");
      if (openPerson) { const person = sim()?.people.find((item) => item.id === openPerson.dataset.playerOpenPerson); if (person) options.onOpenPerson?.(person); return; }
      const locatePerson = event.target.closest("[data-player-locate-person]");
      if (locatePerson) { const person = sim()?.people.find((item) => item.id === locatePerson.dataset.playerLocatePerson); if (person) options.onLocatePerson?.(person); return; }
      const action = event.target.closest("[data-player-action]");
      if (action) handleActionElement(action);
    });
  }

  function showSetupMessage(message) {
    window.clearTimeout(toastTimer);
    const form = setupRoot.querySelector(".game-setup-form");
    if (!form) return;
    form.querySelector("[data-setup-message]")?.remove();
    form.insertAdjacentHTML("afterbegin", `<p class="player-action-message player-error" data-setup-message>${escapeHTML(message)}</p>`);
    toastTimer = window.setTimeout(() => form.querySelector("[data-setup-message]")?.remove(), 2600);
  }

  function setPaused(paused) {
    if (!session || !started) return;
    const updated = setGameSessionPaused(session, paused, clockOf(sim()));
    if (updated.ok) session = updated.state;
  }

  return {
    mount,
    showSetup,
    hideSetup,
    render,
    pumpCommands,
    queueAction,
    cancelCurrentAction,
    decorateBuilding,
    decoratePerson,
    setPaused,
    saveCurrent,
    activateLoadedGame,
    isGameplay,
    hasStarted: () => started,
    mode: () => session?.mode || null,
    activeSlot: () => activeSlot,
    session: () => session,
    paceMultiplier: () => isGameplay() ? getSessionPaceMultiplier(session) : 1,
  };
}
