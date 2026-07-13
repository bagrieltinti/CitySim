import { traits as traitCatalog } from "./data.js";
import { formatAddress } from "./city.js";
import { identities, orientations } from "./lifecycle.js";
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
  resolvePlayerCommand,
  setGameSessionPaused,
  startGameSession,
  updatePlayerGoal,
} from "./gameplay.js";

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
const actionIcons = { go_to: "⌖", go_home: "⌂", rest: "☾", eat: "◉", hygiene: "◇", wait: "◷", work: "▣", study: "✎", shop: "▤", talk: "◌", apply_job: "◆", enroll: "▧", seek_healthcare: "✚", cancel: "×" };
const goalByAction = { work: ["career", 2], apply_job: ["career", 10], study: ["education", 3], enroll: ["education", 8], talk: ["social", 2], socialize: ["social", 3], shop: ["wealth", 1] };

function actionButton({ action, title, subtitle, targetKind = "", targetId = "", icon, product = "", kind = "", role = "", course = "", disabled = false, cost = "" }) {
  return `<button class="player-action" data-player-action="${escapeAttribute(action)}"${targetKind ? ` data-target-kind="${escapeAttribute(targetKind)}"` : ""}${targetId ? ` data-target-id="${escapeAttribute(targetId)}"` : ""}${product ? ` data-product="${escapeAttribute(product)}"` : ""}${kind ? ` data-interaction-kind="${escapeAttribute(kind)}"` : ""}${role ? ` data-role="${escapeAttribute(role)}"` : ""}${course ? ` data-course="${escapeAttribute(course)}"` : ""}${disabled ? " disabled" : ""}><i>${icon || actionIcons[action] || "•"}</i><span><b>${escapeHTML(title)}</b><small>${escapeHTML(subtitle || "")}</small></span>${cost ? `<em class="player-action-cost">${escapeHTML(cost)}</em>` : ""}</button>`;
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
    setupRoot.innerHTML = `<div class="game-setup-view">${renderBrand()}<section class="game-setup-card"><header class="game-setup-card-head"><div><span class="game-setup-eyebrow">CIDADE VIVA</span><h1 class="game-setup-title">Como você quer viver esta cidade?</h1><p class="game-setup-subtitle">Cada modo mantém três cidades próprias neste navegador. Continue uma história existente ou escolha um slot para começar de novo.</p></div><span class="game-setup-step-count">6 SLOTS LOCAIS</span></header><div class="game-setup-mode-grid">${gameModeCatalog.map((mode) => `<button class="game-setup-mode ${selectedMode === mode.id ? "game-setup-selected" : ""}" data-select-mode="${mode.id}" aria-pressed="${selectedMode === mode.id}"><span class="game-setup-mode-visual"><i class="game-setup-mode-icon">${mode.id === GAME_MODES.SPECTATOR ? "◉" : "♙"}</i><em class="game-setup-mode-tag">${savesByMode[mode.id]}/3 SALVOS</em></span><span class="game-setup-mode-copy"><h2>${escapeHTML(mode.name)}</h2><p>${escapeHTML(mode.description)}</p><ul class="game-setup-mode-features">${modeFeatures[mode.id].map((feature) => `<li>${escapeHTML(feature)}</li>`).join("")}</ul></span></button>`).join("")}</div><footer class="game-setup-card-footer"><span class="game-setup-footer-note">Os saves ficam apenas neste navegador e são separados entre Sandbox observador e Gameplay.</span><button class="game-setup-button" data-confirm-mode ${selectedMode ? "" : "disabled"}>Ver 3 slots →</button></footer></section></div>`;
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
    bindCreatorInputs();
  }

  function syncDraftFromForm() {
    const form = setupRoot.querySelector("#characterCreator");
    if (!form) return;
    const data = new FormData(form);
    draft = { ...draft, firstName: String(data.get("firstName") || ""), family: String(data.get("family") || ""), age: Number(data.get("age")) || draft.age, identity: String(data.get("identity") || draft.identity), orientation: String(data.get("orientation") || draft.orientation), professionPreference: String(data.get("professionPreference") || ""), biography: String(data.get("biography") || "") };
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
    if (result.ok && goalByAction[command.actionId]) {
      const [goalId, increment] = goalByAction[command.actionId];
      const updated = updatePlayerGoal(session, goalId, increment, result.message, { clock: clockOf(sim()) });
      if (updated.ok) session = updated.state;
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
    const travelMode = document.querySelector("#playerTravelMode")?.value;
    if (["go_to", "go_home"].includes(actionId)) payload.mode = button.dataset.mode || travelMode || "auto";
    const product = targetKind === "business" && payload.productName ? current.businesses.find((item) => item.id === targetId)?.products?.[payload.productName] : null;
    queueAction({ actionId, target: targetId ? { kind: targetKind, id: targetId, label: button.dataset.targetLabel || button.textContent.trim() } : null, payload, cost: product?.price || 0, priority: ["go_to", "go_home"].includes(actionId) ? 90 : 75 });
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
    if (!context.nearbyPeople.length) return `<p class="player-action-message">Não há ninguém disponível neste espaço agora. Vá a um comércio, escola, praça ou local de trabalho para encontrar outras pessoas.</p>`;
    return `<div class="player-action-grid">${context.nearbyPeople.slice(0, 12).flatMap((person) => [actionButton({ action: "talk", title: person.name, subtitle: "Conversar", targetKind: "person", targetId: person.id, kind: "talk", icon: "◌" }), actionButton({ action: "talk", title: `Interagir com ${person.firstName}`, subtitle: "Elogiar, apoiar ou flertar na ficha", targetKind: "person", targetId: person.id, kind: "compliment", icon: "♡" })]).join("")}</div>`;
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
    tabs.innerHTML = [["context", "Agora"], ["places", "Lugares"], ["people", "Pessoas"], ["career", "Trabalho e estudo"]].map(([id, label]) => `<button class="player-action-tab ${panelTab === id ? "player-active" : ""}" data-player-tab="${id}">${label}</button>`).join("");
    const content = panel.querySelector("#playerActionBody");
    content.innerHTML = inTransit && panelTab !== "places"
      ? `<p class="player-action-message">Você está em trânsito. Aguarde a chegada, escolha outro destino em “Lugares” ou cancele o trajeto atual.</p>`
      : panelTab === "places" ? placesPanel(context) : panelTab === "people" ? peoplePanel(context) : panelTab === "career" ? careerPanel(context) : contextPanel(context);
    if (active) content.insertAdjacentHTML("beforeend", `<p class="player-action-message">Em andamento: <b>${escapeHTML(active.actionId.replaceAll("_", " "))}</b>. ${session.commandQueue.length ? `${session.commandQueue.length} decisão(ões) na fila.` : ""}</p>${actionButton({ action: "cancel", title: "Cancelar ação atual", subtitle: "Interrompe a decisão em andamento", icon: "×" })}`);
  }

  function render(force = false) {
    if (!isGameplay() || hudRoot.hidden) return;
    pumpCommands();
    const current = sim(), context = current.playerContext?.(), actor = context?.person;
    if (!actor) return;
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
    const goal = session.player?.character?.goals?.find((item) => item.status === "active") || session.player?.character?.goals?.[0], definition = playerGoalCatalog.find((item) => item.id === goal?.id);
    hudRoot.querySelector("#playerObjectiveName").textContent = definition?.name || "Viver sua própria história";
    hudRoot.querySelector("#playerObjectiveText").textContent = definition?.description || "Suas escolhas constroem a trajetória do personagem.";
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
    if (samePlace) [["talk", "Conversar"], ["compliment", "Elogiar"], ["support", "Oferecer apoio"], ["flirt", "Flertar"], ["argue", "Discutir"]].forEach(([kind, label]) => actions.push(actionButton({ action: "talk", title: `${label} com ${target.firstName}`, subtitle: "A relação reagirá ao contexto", targetKind: "person", targetId: target.id, kind })));
    else if (!target.currentTrip && target.locationId) {
      const place = sim().buildings.find((building) => building.id === target.locationId);
      if (place) actions.push(actionButton({ action: "go_to", title: `Ir ao encontro de ${target.firstName}`, subtitle: place.name, targetKind: "building", targetId: place.id }));
    }
    root.insertAdjacentHTML("afterbegin", `<section data-player-world-actions><small>INTERAGIR COMO ${escapeHTML(actor.firstName.toUpperCase())}</small><div class="player-action-grid">${actions.join("") || "<p class='player-action-message'>Essa pessoa está em deslocamento ou indisponível agora.</p>"}</div></section>`);
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
