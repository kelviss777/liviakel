const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const venueSource = fs.readFileSync(path.join(projectRoot, "pages", "locais", "main.js"), "utf8");
const venueHtml = fs.readFileSync(path.join(projectRoot, "pages", "locais", "index.html"), "utf8");
const venueCss = fs.readFileSync(path.join(projectRoot, "pages", "locais", "style.css"), "utf8");

class FakeClassList {
    constructor() {
        this.values = new Set();
    }

    add(value) {
        this.values.add(value);
    }

    remove(value) {
        this.values.delete(value);
    }

    toggle(value, force) {
        if (force === true) this.values.add(value);
        else if (force === false) this.values.delete(value);
        else if (this.values.has(value)) this.values.delete(value);
        else this.values.add(value);
        return this.values.has(value);
    }

    contains(value) {
        return this.values.has(value);
    }
}

class FakeElement {
    constructor({ id = "", value = "", dataset = {} } = {}) {
        this.id = id;
        this.value = value;
        this.dataset = { ...dataset };
        this.attributes = new Map();
        this.children = [];
        this.listeners = {};
        this.classList = new FakeClassList();
        this.textContent = "";
        this.innerHTML = "";
        this.checked = false;
        this.disabled = false;
        this.hidden = false;
        this.open = false;
        this.customValidity = "";
        this.href = "";
        this.focused = false;
        this.isConnected = true;
        this.type = "";
        this._queries = new Map();
        this._queryAll = () => [];
    }

    addEventListener(type, listener) {
        this.listeners[type] ||= [];
        this.listeners[type].push(listener);
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    append(...children) {
        this.children.push(...children);
    }

    replaceChildren(...children) {
        this.children = [...children];
    }

    querySelector(selector) {
        return this._queries.get(selector) || null;
    }

    querySelectorAll(selector) {
        return this._queryAll(selector);
    }

    setCustomValidity(message) {
        this.customValidity = message;
    }

    focus() {
        this.focused = true;
    }

    reportValidity() {
        return !this.customValidity;
    }

    showModal() {
        this.open = true;
    }

    close() {
        if (!this.open) return;
        this.open = false;
        (this.listeners.close || []).forEach(listener => listener({ target: this }));
    }

    contains() {
        return true;
    }

    matches(selector) {
        return selector === "input, select, textarea";
    }

    reset() {
        this.resetCalled = true;
        this.resetCount = (this.resetCount || 0) + 1;
        this._onReset?.();
    }

    scrollIntoView() {
        this.scrolledIntoView = true;
    }
}

function allText(element) {
    return [element.textContent, ...element.children.map(allText)]
        .filter(Boolean)
        .join(" ");
}

function createHarness(initialVenues = [], options = {}) {
    const elements = new Map();
    const create = (selector, options) => {
        const element = new FakeElement(options);
        elements.set(selector, element);
        return element;
    };

    const form = create("#venue-form");
    const formCard = create("#venue-form-card");
    const venueName = create("#venue-name");
    const venueType = create("#venue-type", { value: "Espaço para festa" });
    const venueAddress = create("#venue-address");
    const venueDescription = create("#venue-description");
    formCard._queries.set("input", venueName);

    const detailsToggle = create("#venue-details-toggle");
    const toggleLabel = new FakeElement();
    detailsToggle._queries.set(".details-toggle-label", toggleLabel);
    const detailsFields = create("#venue-details-fields");
    const detailsDialog = create("#venue-details-dialog");
    const deleteDialog = create("#venue-delete-dialog");
    const clearRating = create("#clear-venue-rating");
    const ratingStatus = create("#venue-rating-status");
    const budget = create("#venue-budget");
    const deposit = create("#venue-deposit");
    const depositError = create("#venue-deposit-error");
    const remaining = create("#venue-budget-remaining");
    const remainingValue = new FakeElement();
    remaining._queries.set("strong", remainingValue);
    const decoration = create("#venue-decoration", { value: "unknown" });
    const bridalRoom = create("#venue-bridal-room");
    const capacity = create("#venue-capacity");
    const parking = create("#venue-parking");
    const spaceAvailability = create("#venue-space-availability", { value: "unknown" });
    const startTime = create("#venue-start-time");
    const endTime = create("#venue-end-time");
    const availableDate = create("#venue-available-date");

    const proTitle = create("#venue-pro-title");
    const proDescription = create("#venue-pro-description");
    const proSubmit = create("#submit-pro-item");
    const proCancel = create("#cancel-pro-edit");
    const prosList = create("#venue-pros-list");
    const conTitle = create("#venue-con-title");
    const conDescription = create("#venue-con-description");
    const conSubmit = create("#submit-con-item");
    const conCancel = create("#cancel-con-edit");
    const consList = create("#venue-cons-list");

    const submitButton = create("#venue-submit-button");
    const cancelEditButton = create("#cancel-venue-edit");
    const editNotice = create("#venue-edit-notice");
    const editName = create("#venue-edit-name");
    const venueList = create("#venue-list");
    const detailsTitle = create("#venue-details-title");
    const detailsSubtitle = create("#venue-details-subtitle");
    const detailsContent = create("#venue-details-content");
    const mapLink = create("#venue-details-map-link");
    const modalEdit = create("#venue-details-edit");
    const modalFavorite = create("#venue-details-favorite");
    const deleteName = create("#venue-delete-name");
    const confirmDelete = create("#confirm-venue-delete");
    const cancelDelete = create("#cancel-venue-delete");
    const ratingOptions = create(".rating-options");

    const ratingInputs = Array.from({ length: 5 }, (_, index) =>
        new FakeElement({ value: String(index + 1) })
    );
    const ratingLabels = Array.from({ length: 5 }, (_, index) =>
        new FakeElement({ dataset: { ratingValue: String(index + 1) } })
    );

    const formControls = [
        venueName, venueType, venueAddress, venueDescription, budget, deposit,
        decoration, bridalRoom, capacity, parking, spaceAvailability, startTime,
        endTime, availableDate, proTitle, proDescription, conTitle, conDescription,
        ...ratingInputs
    ];
    form._onReset = () => {
        formControls.forEach(control => {
            control.value = "";
            control.checked = false;
        });
        venueType.value = "Espaço para festa";
        decoration.value = "unknown";
        spaceAvailability.value = "unknown";
    };
    form._queryAll = selector => selector === "[aria-invalid='true']"
        ? formControls.filter(control => control.getAttribute("aria-invalid") === "true")
        : [];

    const body = new FakeElement();
    const document = {
        body,
        querySelector(selector) {
            return elements.get(selector) || null;
        },
        querySelectorAll(selector) {
            if (selector === "input[name='rating']") return ratingInputs;
            if (selector === "[data-rating-value]") return ratingLabels;
            if (selector === "[data-toggle-form]") return [];
            return [];
        },
        createElement() {
            return new FakeElement();
        }
    };

    let formValues = new Map();
    let savedCount = 0;
    let idCounter = 0;
    let removedLegacyCount = 0;
    let legacyVenues = structuredClone(options.legacyVenues || []);
    const toastMessages = [];
    const consoleErrors = [];
    const remoteCalls = { create: [], update: [], favorite: [], delete: [], list: 0 };
    const storage = new Map(Object.entries(options.storage || {}));
    const localStorage = {
        getItem(key) {
            return storage.has(key) ? storage.get(key) : null;
        },
        setItem(key, value) {
            storage.set(key, String(value));
        }
    };
    let context;
    context = vm.createContext({
        console: {
            ...console,
            error(...args) {
                consoleErrors.push(args);
            }
        },
        document,
        Intl,
        Number,
        Object,
        String,
        Boolean,
        Math,
        Date,
        localStorage,
        state: { venues: structuredClone(initialVenues) },
        FormData: class {
            get(name) {
                return formValues.has(name) ? formValues.get(name) : null;
            }
        },
        escapeHtml(value) {
            return String(value).replace(/[&<>'"]/g, character => ({
                "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
            })[character]);
        },
        formatCurrency(value) {
            return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
        },
        formatDate(value, fallback = "Sem prazo") {
            if (!value) return fallback;
            const [year, month, day] = value.split("-").map(Number);
            return new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day));
        },
        emptyState(message) {
            return `<div>${message}</div>`;
        },
        makeId() {
            idCounter += 1;
            return `generated-${idCounter}`;
        },
        saveState() {
            savedCount += 1;
        },
        loadLegacyVenues() {
            return structuredClone(legacyVenues);
        },
        removeLegacyVenues() {
            legacyVenues = [];
            removedLegacyCount += 1;
        },
        listCurrentWeddingVenues() {
            remoteCalls.list += 1;
            if (options.listCurrentWeddingVenues) {
                return options.listCurrentWeddingVenues();
            }
            return new Promise(() => {});
        },
        async createCurrentWeddingVenue(venue) {
            remoteCalls.create.push(structuredClone(venue));
            if (options.createError) throw options.createError;
            if (options.createCurrentWeddingVenue) {
                return options.createCurrentWeddingVenue(venue, remoteCalls.create.length);
            }
            return {
                ...structuredClone(venue),
                id: options.createdId || `00000000-0000-4000-8000-${String(remoteCalls.create.length).padStart(12, "0")}`
            };
        },
        async updateCurrentWeddingVenue(id, venue) {
            remoteCalls.update.push({ id, venue: structuredClone(venue) });
            if (options.updateError) throw options.updateError;
            if (options.updateCurrentWeddingVenue) {
                return options.updateCurrentWeddingVenue(id, venue);
            }
            return { ...structuredClone(venue), id };
        },
        async updateCurrentWeddingVenueFavorite(id, favorite) {
            remoteCalls.favorite.push({ id, favorite });
            if (options.favoriteError) throw options.favoriteError;
            if (options.updateCurrentWeddingVenueFavorite) {
                return options.updateCurrentWeddingVenueFavorite(id, favorite);
            }
            const current = context.state.venues.find(item => String(item.id) === String(id));
            return { ...structuredClone(current), favorite };
        },
        async deleteCurrentWeddingVenue(id) {
            remoteCalls.delete.push(id);
            if (options.deleteError) throw options.deleteError;
            if (options.deleteCurrentWeddingVenue) {
                return options.deleteCurrentWeddingVenue(id);
            }
            return { id };
        },
        showToast(message) {
            toastMessages.push(message);
        }
    });

    vm.runInContext(venueSource, context);
    const initializationPromise = vm.runInContext("venuesInitializationPromise", context);
    if (!options.autoInitialize) {
        context.state.venues = structuredClone(initialVenues);
        vm.runInContext("venuesLoading = false; renderAll()", context);
    }

    return {
        context,
        elements,
        form,
        formCard,
        detailsFields,
        detailsDialog,
        deleteDialog,
        ratingInputs,
        remaining,
        remainingValue,
        deposit,
        budget,
        capacity,
        endTime,
        venueList,
        detailsContent,
        mapLink,
        modalEdit,
        modalFavorite,
        proTitle,
        proDescription,
        prosList,
        conTitle,
        conDescription,
        consList,
        submitButton,
        cancelEditButton,
        editNotice,
        deleteName,
        confirmDelete,
        cancelDelete,
        body,
        toastMessages,
        consoleErrors,
        remoteCalls,
        storage,
        initializationPromise,
        setFormValues(values) {
            formValues = new Map(Object.entries(values));
        },
        getSavedCount() {
            return savedCount;
        },
        getRemovedLegacyCount() {
            return removedLegacyCount;
        }
    };
}

function baseFormValues(overrides = {}) {
    return {
        name: "Villa Jardim",
        type: "Espaço para festa",
        address: "Rua das Flores, 100",
        description: "",
        decorationOption: "unknown",
        spaceAvailability: "unknown",
        startTime: "",
        endTime: "",
        availableDate: "",
        ...overrides
    };
}

function submitVenue(harness) {
    return harness.form.listeners.submit[0]({
        preventDefault() {},
        currentTarget: harness.form
    });
}

function readValue(harness, expression) {
    return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, harness.context));
}

test("adiciona vários prós e contras às listas temporárias", () => {
    const harness = createHarness();

    harness.proTitle.value = "Localização";
    harness.proDescription.value = "Perto da igreja";
    vm.runInContext("submitListItem('pros')", harness.context);
    harness.proTitle.value = "Decoração";
    harness.proDescription.value = "Já está inclusa";
    vm.runInContext("submitListItem('pros')", harness.context);

    harness.conTitle.value = "Estacionamento";
    harness.conDescription.value = "Poucas vagas";
    vm.runInContext("submitListItem('cons')", harness.context);
    harness.conTitle.value = "Horário";
    harness.conDescription.value = "Precisa terminar cedo";
    vm.runInContext("submitListItem('cons')", harness.context);

    const pros = readValue(harness, "temporaryPros");
    const cons = readValue(harness, "temporaryCons");
    assert.deepEqual(pros.map(item => item.title), ["Localização", "Decoração"]);
    assert.deepEqual(cons.map(item => item.title), ["Estacionamento", "Horário"]);
    assert.equal(harness.proTitle.value, "");
    assert.equal(harness.conDescription.value, "");
    assert.equal(harness.prosList.children.length, 2);
    assert.equal(harness.consList.children.length, 2);
});

test("edita e remove somente o pró ou contra selecionado", () => {
    const harness = createHarness();
    vm.runInContext(`
        temporaryPros = [
            { id: 'p1', title: 'Localização', description: 'Perto' },
            { id: 'p2', title: 'Equipe', description: 'Atenciosa' }
        ];
        temporaryCons = [
            { id: 'c1', title: 'Vagas', description: 'Poucas' },
            { id: 'c2', title: 'Som', description: 'Limitado' }
        ];
        renderStructuredList('pros');
        renderStructuredList('cons');
        editListItem('pros', 'p1');
    `, harness.context);

    assert.equal(harness.proTitle.value, "Localização");
    assert.equal(harness.elements.get("#submit-pro-item").textContent, "Salvar alteração");
    assert.equal(harness.elements.get("#cancel-pro-edit").hidden, false);

    harness.proTitle.value = "Acesso";
    harness.proDescription.value = "Muito fácil";
    vm.runInContext("submitListItem('pros'); editListItem('cons', 'c2')", harness.context);
    harness.conTitle.value = "Som ambiente";
    harness.conDescription.value = "Limite baixo";
    vm.runInContext("submitListItem('cons'); removeListItem('pros', 'p2'); removeListItem('cons', 'c1')", harness.context);

    assert.deepEqual(readValue(harness, "temporaryPros"), [
        { id: "p1", title: "Acesso", description: "Muito fácil" }
    ]);
    assert.deepEqual(readValue(harness, "temporaryCons"), [
        { id: "c2", title: "Som ambiente", description: "Limite baixo" }
    ]);

    vm.runInContext("editListItem('pros', 'p1')", harness.context);
    harness.proTitle.value = "Alteração cancelada";
    vm.runInContext("resetListEditor('pros'); renderStructuredList('pros')", harness.context);
    assert.equal(readValue(harness, "temporaryPros")[0].title, "Acesso");
    assert.equal(harness.elements.get("#submit-pro-item").textContent, "Adicionar pró");
});

test("valida tópico e motivo antes de adicionar itens", async () => {
    const harness = createHarness();

    harness.proDescription.value = "Descrição sem tópico";
    vm.runInContext("submitListItem('pros')", harness.context);
    assert.match(harness.proTitle.customValidity, /tópico/);
    assert.equal(readValue(harness, "temporaryPros").length, 0);

    harness.proTitle.value = "Localização";
    harness.proDescription.value = "";
    vm.runInContext("submitListItem('pros')", harness.context);
    assert.match(harness.proDescription.customValidity, /motivo/);
    assert.equal(readValue(harness, "temporaryPros").length, 0);

    harness.proTitle.value = "Rascunho não adicionado";
    harness.proDescription.value = "Não deve ser perdido silenciosamente";
    harness.setFormValues(baseFormValues());
    await submitVenue(harness);
    assert.equal(readValue(harness, "state.venues").length, 0);
    assert.match(harness.toastMessages.at(-1), /Adicione ou cancele/);
});

test("converte textos antigos de prós e contras sem apagar o conteúdo", () => {
    const harness = createHarness([{
        id: "old",
        name: "Local antigo",
        type: "Igreja",
        address: "Praça Central",
        favorite: true,
        pros: "Boa localização",
        cons: "Poucas vagas"
    }]);

    const normalized = readValue(harness, "normalizeVenue(state.venues[0])");
    assert.deepEqual(normalized.pros, [{
        id: "legacy-pros-1",
        title: "Observação",
        description: "Boa localização"
    }]);
    assert.deepEqual(normalized.cons, [{
        id: "legacy-cons-1",
        title: "Observação",
        description: "Poucas vagas"
    }]);
    assert.equal(vm.runInContext("typeof state.venues[0].pros", harness.context), "string");
    assert.match(harness.venueList.innerHTML, /Ver detalhes/);
});

test("cadastra local básico e local com listas estruturadas", async () => {
    const basicHarness = createHarness();
    basicHarness.setFormValues(baseFormValues());
    await submitVenue(basicHarness);
    const basic = readValue(basicHarness, "state.venues[0]");
    assert.deepEqual(basic.pros, []);
    assert.deepEqual(basic.cons, []);
    assert.equal(basic.name, "Villa Jardim");

    const detailedHarness = createHarness();
    detailedHarness.proTitle.value = "Localização";
    detailedHarness.proDescription.value = "Fácil acesso";
    vm.runInContext("submitListItem('pros')", detailedHarness.context);
    detailedHarness.conTitle.value = "Vagas";
    detailedHarness.conDescription.value = "São limitadas";
    vm.runInContext("submitListItem('cons')", detailedHarness.context);
    detailedHarness.setFormValues(baseFormValues({ description: "Salão amplo" }));
    await submitVenue(detailedHarness);

    const detailed = readValue(detailedHarness, "state.venues[0]");
    assert.equal(detailed.pros[0].title, "Localização");
    assert.equal(detailed.cons[0].description, "São limitadas");
    assert.match(detailedHarness.venueList.innerHTML, /Ver detalhes/);
});

test("modal exibe tópicos e motivos estruturados com segurança", () => {
    const harness = createHarness([{
        id: "details",
        name: "Villa Jardim",
        type: "Buffet",
        address: "Av. Brasil, 50",
        pros: [{ id: "p1", title: "<Localização>", description: "Perto da igreja" }],
        cons: [{ id: "c1", title: "Estacionamento", description: "Poucas vagas" }]
    }]);

    vm.runInContext("openVenueDetails('details')", harness.context);
    const modalText = allText(harness.detailsContent);
    assert.equal(harness.detailsDialog.open, true);
    assert.match(modalText, /Prós e contras/);
    assert.match(modalText, /<Localização>/);
    assert.match(modalText, /Perto da igreja/);
    assert.match(modalText, /Estacionamento/);
    assert.doesNotMatch(modalText, /undefined|null|NaN/);
    assert.equal(harness.modalEdit.dataset.id, "details");
});

test("edita local completo sem duplicar e preserva id e data de criação", async () => {
    const harness = createHarness([{
        id: "venue-1",
        createdAt: "2026-07-01T10:00:00Z",
        name: "Nome antigo",
        type: "Buffet",
        address: "Rua antiga",
        favorite: true,
        description: "Descrição antiga",
        rating: 4,
        budgetValue: 10000,
        depositValue: 2000,
        decorationOption: "included",
        hasBridalRoom: true,
        capacity: 150,
        hasParking: true,
        spaceAvailability: "ceremony_and_reception",
        startTime: "18:00",
        endTime: "02:00",
        availableDate: "2027-05-22",
        pros: [{ id: "p1", title: "Equipe", description: "Atenciosa" }],
        cons: [{ id: "c1", title: "Vagas", description: "Limitadas" }]
    }]);

    vm.runInContext("startVenueEdit('venue-1')", harness.context);
    assert.equal(harness.submitButton.textContent, "Salvar alterações");
    assert.equal(harness.cancelEditButton.hidden, false);
    assert.equal(harness.editNotice.hidden, false);
    assert.equal(harness.detailsFields.hidden, false);
    assert.equal(readValue(harness, "temporaryPros")[0].title, "Equipe");

    harness.budget.value = "12000";
    harness.deposit.value = "2500";
    harness.capacity.value = "180";
    harness.setFormValues(baseFormValues({
        name: "Nome atualizado",
        type: "Buffet",
        address: "Rua nova",
        description: "Descrição atualizada",
        rating: "5",
        budgetValue: "12000",
        depositValue: "2500",
        decorationOption: "included",
        hasBridalRoom: "on",
        capacity: "180",
        hasParking: "on",
        spaceAvailability: "ceremony_and_reception",
        startTime: "19:00",
        endTime: "03:00",
        availableDate: "2027-06-12"
    }));
    await submitVenue(harness);

    const venues = readValue(harness, "state.venues");
    assert.equal(venues.length, 1);
    assert.equal(venues[0].id, "venue-1");
    assert.equal(venues[0].createdAt, "2026-07-01T10:00:00Z");
    assert.equal(venues[0].name, "Nome atualizado");
    assert.equal(venues[0].favorite, true);
    assert.equal(venues[0].rating, 5);
    assert.equal(venues[0].pros[0].id, "p1");
    assert.match(harness.toastMessages.at(-1), /atualizado com sucesso/);
    assert.equal(vm.runInContext("editingVenueId", harness.context), null);
    assert.equal(harness.formCard.classList.contains("hidden"), true);
    assert.equal(harness.remoteCalls.update.length, 1);
    assert.equal(harness.remoteCalls.create.length, 0);
});

test("edita local básico e abre detalhes apenas quando necessário", async () => {
    const harness = createHarness([{
        id: "basic",
        name: "Igreja antiga",
        type: "Igreja",
        address: "Praça antiga"
    }]);
    vm.runInContext("startVenueEdit('basic')", harness.context);
    assert.equal(harness.elements.get("#venue-name").value, "Igreja antiga");
    assert.equal(harness.detailsFields.hidden, true);

    harness.setFormValues(baseFormValues({
        name: "Igreja atualizada",
        type: "Igreja",
        address: "Praça nova"
    }));
    await submitVenue(harness);
    assert.equal(readValue(harness, "state.venues").length, 1);
    assert.equal(readValue(harness, "state.venues[0]").name, "Igreja atualizada");
});

test("cancelar edição limpa o formulário e não altera o registro", () => {
    const original = {
        id: "cancel",
        name: "Original",
        type: "Buffet",
        address: "Rua original",
        pros: [{ id: "p1", title: "Equipe", description: "Boa" }]
    };
    const harness = createHarness([original]);
    vm.runInContext("startVenueEdit('cancel')", harness.context);
    harness.elements.get("#venue-name").value = "Não salvar";
    harness.proTitle.value = "Rascunho";
    vm.runInContext("cancelVenueEdit()", harness.context);

    assert.deepEqual(readValue(harness, "state.venues[0]"), original);
    assert.equal(vm.runInContext("editingVenueId", harness.context), null);
    assert.equal(readValue(harness, "temporaryPros").length, 0);
    assert.equal(harness.elements.get("#venue-name").value, "");
    assert.equal(harness.formCard.classList.contains("hidden"), true);
    assert.equal(harness.submitButton.textContent, "Salvar");
});

test("exclusão personalizada cancela e confirma sem cliques duplicados", async () => {
    const harness = createHarness([
        { id: "one", name: "Villa Um", type: "Buffet", address: "Rua 1" },
        { id: "two", name: "Villa Dois", type: "Igreja", address: "Rua 2" }
    ]);
    const trigger = new FakeElement();
    harness.context.trigger = trigger;

    vm.runInContext("openVenueDeleteConfirmation('one', trigger)", harness.context);
    assert.equal(harness.deleteDialog.open, true);
    assert.equal(readValue(harness, "state.venues").length, 2);
    assert.match(harness.deleteName.textContent, /Villa Um/);
    assert.equal(harness.cancelDelete.focused, true);
    vm.runInContext("closeVenueDeleteConfirmation()", harness.context);
    assert.equal(readValue(harness, "state.venues").length, 2);
    assert.equal(trigger.focused, true);

    trigger.focused = false;
    vm.runInContext("openVenueDeleteConfirmation('one', trigger)", harness.context);
    harness.deleteDialog.close();
    assert.equal(vm.runInContext("pendingDeleteVenueId", harness.context), null);
    assert.equal(trigger.focused, true);

    const deletionPromise = vm.runInContext("openVenueDeleteConfirmation('one', trigger); confirmVenueDelete()", harness.context);
    await vm.runInContext("confirmVenueDelete()", harness.context);
    await deletionPromise;
    const venues = readValue(harness, "state.venues");
    assert.deepEqual(venues.map(item => item.id), ["two"]);
    assert.deepEqual(harness.remoteCalls.delete, ["one"]);
    assert.equal(harness.getSavedCount(), 0);
    assert.match(harness.toastMessages.at(-1), /excluído com sucesso/);
});

test("favorito e Google Maps continuam funcionando", async () => {
    const harness = createHarness([{
        id: "favorite",
        name: "Zênite",
        type: "Igreja",
        address: "Praça da Sé, 1",
        favorite: true
    }]);
    assert.match(harness.venueList.innerHTML, /google\.com\/maps\/search/);

    const clickHandler = harness.body.listeners.click[0];
    await clickHandler({
        target: {
            closest() {
                return { dataset: { action: "toggle-favorite", id: "favorite" } };
            }
        }
    });
    assert.equal(vm.runInContext("state.venues[0].favorite", harness.context), false);
});

test("mantém validações financeiras, capacidade e horários", () => {
    const harness = createHarness();
    harness.budget.value = "10000";
    harness.deposit.value = "2500.50";
    vm.runInContext("updateBudgetRemaining()", harness.context);
    assert.equal(harness.remaining.hidden, false);
    assert.match(harness.remainingValue.textContent, /7\.499,50/);

    harness.deposit.value = "12000";
    vm.runInContext("updateBudgetRemaining()", harness.context);
    assert.match(harness.deposit.customValidity, /maior que o orçamento/);

    harness.deposit.value = "";
    harness.capacity.value = "120.5";
    harness.setFormValues(baseFormValues({ capacity: "120.5" }));
    assert.equal(vm.runInContext("validateDetailedFields(new FormData(venueForm))", harness.context), false);
    assert.match(harness.capacity.customValidity, /número inteiro/);

    harness.capacity.value = "";
    harness.setFormValues(baseFormValues({ startTime: "20:00", endTime: "02:00" }));
    assert.equal(
        vm.runInContext("validateDetailedFields(new FormData(venueForm)).endTime", harness.context),
        "02:00"
    );
});

test("carrega locais remotos, incluindo estado vazio, sem usar o estado local", async () => {
    const remoteVenue = {
        id: "remote-1",
        name: "Local remoto",
        type: "Buffet",
        address: "Rua remota",
        favorite: false,
        pros: [],
        cons: []
    };
    const harness = createHarness([{ id: "local-ignorado", name: "Local antigo" }], {
        autoInitialize: true,
        listCurrentWeddingVenues: async () => ({
            weddingId: "wedding-1",
            venues: [remoteVenue]
        })
    });

    assert.match(harness.venueList.innerHTML, /Carregando locais/);
    await harness.initializationPromise;
    assert.deepEqual(readValue(harness, "state.venues.map(item => item.id)"), ["remote-1"]);
    assert.match(harness.venueList.innerHTML, /Local remoto/);
    assert.equal(harness.consoleErrors.length, 0);

    const emptyHarness = createHarness([], {
        autoInitialize: true,
        listCurrentWeddingVenues: async () => ({ weddingId: "wedding-empty", venues: [] })
    });
    await emptyHarness.initializationPromise;
    assert.deepEqual(readValue(emptyHarness, "state.venues"), []);
    assert.match(emptyHarness.venueList.innerHTML, /Adicione o primeiro local/);
    assert.ok(emptyHarness.storage.has("nosso-casamento-venues-migrated:wedding-empty"));
});

test("mantém formulário e estado intactos quando o INSERT falha", async () => {
    const error = Object.assign(new Error("Não foi possível adicionar o local."), {
        code: "VENUE_CREATE_FAILED"
    });
    const harness = createHarness([], { createError: error });
    const resetCountBeforeSubmit = harness.form.resetCount;
    harness.setFormValues(baseFormValues());

    await submitVenue(harness);

    assert.deepEqual(readValue(harness, "state.venues"), []);
    assert.equal(harness.form.resetCount, resetCountBeforeSubmit);
    assert.equal(harness.formCard.classList.contains("hidden"), false);
    assert.equal(harness.submitButton.disabled, false);
    assert.equal(harness.remoteCalls.create.length, 1);
    assert.match(harness.toastMessages.at(-1), /Não foi possível adicionar/);
    assert.ok(harness.consoleErrors.length >= 1);
});

test("bloqueia INSERT duplicado e usa somente o UUID remoto", async () => {
    let releaseInsert;
    const pendingInsert = new Promise(resolve => {
        releaseInsert = resolve;
    });
    const harness = createHarness([], {
        createCurrentWeddingVenue: async venue => {
            await pendingInsert;
            return {
                ...venue,
                id: "22222222-2222-4222-8222-222222222222"
            };
        }
    });
    harness.setFormValues(baseFormValues());
    const resetCountBeforeSubmit = harness.form.resetCount;

    const firstSubmit = submitVenue(harness);
    const secondSubmit = submitVenue(harness);
    assert.equal(harness.remoteCalls.create.length, 1);
    assert.equal(harness.submitButton.disabled, true);

    releaseInsert();
    await Promise.all([firstSubmit, secondSubmit]);
    assert.equal(readValue(harness, "state.venues[0].id"), "22222222-2222-4222-8222-222222222222");
    assert.equal(harness.remoteCalls.create.length, 1);
    assert.equal(harness.submitButton.disabled, false);
    assert.equal(harness.form.resetCount, resetCountBeforeSubmit + 1);
    assert.equal(harness.formCard.classList.contains("hidden"), true);
    assert.equal(vm.runInContext("editingVenueId", harness.context), null);
    assert.deepEqual(readValue(harness, "temporaryPros"), []);
    assert.deepEqual(readValue(harness, "temporaryCons"), []);
    assert.equal(harness.detailsFields.hidden, true);
    assert.match(harness.venueList.innerHTML, /Villa Jardim/);
    assert.doesNotMatch(venueSource, /id:\s*makeId\(\),\s*\.\.\.mainFields/);
});

test("função remota ausente gera erro controlado antes do INSERT", async () => {
    const harness = createHarness();
    delete harness.context.createCurrentWeddingVenue;
    harness.setFormValues(baseFormValues());

    await submitVenue(harness);

    assert.deepEqual(readValue(harness, "state.venues"), []);
    assert.equal(harness.remoteCalls.create.length, 0);
    assert.equal(harness.formCard.classList.contains("hidden"), false);
    assert.equal(harness.submitButton.disabled, false);
    assert.match(harness.toastMessages.at(-1), /não foram carregados corretamente/);
    assert.notEqual(harness.consoleErrors[0][1]?.name, "ReferenceError");
});

test("falha visual após INSERT recarrega o Supabase sem repetir a gravação", async () => {
    let listCalls = 0;
    let createdRow = null;
    const harness = createHarness([], {
        listCurrentWeddingVenues() {
            listCalls += 1;
            if (listCalls === 1) return new Promise(() => {});
            return Promise.resolve({ weddingId: "wedding-recovery", venues: [createdRow] });
        },
        createCurrentWeddingVenue: async venue => {
            createdRow = {
                ...venue,
                id: "33333333-3333-4333-8333-333333333333"
            };
            return createdRow;
        }
    });
    vm.runInContext(`
        originalRenderAllForRecovery = renderAll;
        failNextRecoveryRender = true;
        renderAll = function () {
            if (failNextRecoveryRender) {
                failNextRecoveryRender = false;
                throw new Error('Falha visual simulada');
            }
            return originalRenderAllForRecovery();
        };
    `, harness.context);
    harness.setFormValues(baseFormValues());

    await submitVenue(harness);

    assert.equal(harness.remoteCalls.create.length, 1);
    assert.equal(listCalls, 2);
    assert.deepEqual(readValue(harness, "state.venues.map(item => item.id)"), [
        "33333333-3333-4333-8333-333333333333"
    ]);
    assert.equal(harness.formCard.classList.contains("hidden"), true);
    assert.equal(vm.runInContext("editingVenueId", harness.context), null);
    assert.equal(harness.submitButton.disabled, false);
    assert.match(harness.toastMessages.at(-1), /Local adicionado/);
    assert.ok(harness.consoleErrors.length >= 1);
});

test("preserva edição e estado quando o UPDATE falha", async () => {
    const original = {
        id: "venue-update-error",
        name: "Original",
        type: "Buffet",
        address: "Rua original",
        favorite: true
    };
    const harness = createHarness([original], {
        updateError: Object.assign(new Error("Não foi possível atualizar o local."), {
            code: "VENUE_UPDATE_FAILED"
        })
    });
    vm.runInContext("startVenueEdit('venue-update-error')", harness.context);
    harness.setFormValues(baseFormValues({ name: "Alterado", type: "Buffet" }));

    await submitVenue(harness);

    assert.deepEqual(readValue(harness, "state.venues[0]"), original);
    assert.equal(vm.runInContext("editingVenueId", harness.context), "venue-update-error");
    assert.equal(harness.formCard.classList.contains("hidden"), false);
    assert.equal(harness.submitButton.disabled, false);
    assert.equal(harness.remoteCalls.update.length, 1);
});

test("não antecipa favorito quando a atualização remota falha", async () => {
    const harness = createHarness([{
        id: "favorite-error",
        name: "Local",
        type: "Igreja",
        address: "Rua",
        favorite: false
    }], {
        favoriteError: Object.assign(new Error("Sem permissão para favoritar."), {
            code: "VENUE_PERMISSION_DENIED"
        })
    });

    await vm.runInContext("toggleVenueFavorite('favorite-error')", harness.context);

    assert.equal(vm.runInContext("state.venues[0].favorite", harness.context), false);
    assert.deepEqual(harness.remoteCalls.favorite, [{ id: "favorite-error", favorite: true }]);
    assert.match(harness.toastMessages.at(-1), /Sem permissão/);
    assert.equal(vm.runInContext("favoriteVenueIds.size", harness.context), 0);
});

test("mantém confirmação e cartão quando o DELETE falha", async () => {
    const harness = createHarness([{
        id: "delete-error",
        name: "Local",
        type: "Buffet",
        address: "Rua"
    }], {
        deleteError: Object.assign(new Error("Não foi possível excluir o local."), {
            code: "VENUE_DELETE_FAILED"
        })
    });
    const trigger = new FakeElement();
    harness.context.trigger = trigger;
    const deletion = vm.runInContext(
        "openVenueDeleteConfirmation('delete-error', trigger); confirmVenueDelete()",
        harness.context
    );
    await deletion;

    assert.equal(harness.deleteDialog.open, true);
    assert.equal(harness.confirmDelete.disabled, false);
    assert.deepEqual(readValue(harness, "state.venues.map(item => item.id)"), ["delete-error"]);
    assert.deepEqual(harness.remoteCalls.delete, ["delete-error"]);
});

test("migra localStorage uma vez, sem duplicar equivalentes e preservando backup", async () => {
    const legacyVenues = [
        {
            id: "local-1",
            name: "  VILLA JARDIM ",
            type: "Buffet",
            address: " Rua Um ",
            pros: "Boa equipe"
        },
        {
            id: "local-2",
            name: "Igreja Central",
            type: "Igreja",
            address: "Praça Central",
            startTime: "19:00",
            pros: [{ id: "p1", title: "Acesso", description: "Fácil" }],
            cons: []
        }
    ];
    const harness = createHarness([], {
        autoInitialize: true,
        legacyVenues,
        listCurrentWeddingVenues: async () => ({
            weddingId: "wedding-migration",
            venues: [{
                id: "remote-existing",
                name: "villa jardim",
                type: "buffet",
                address: "rua um",
                pros: [],
                cons: []
            }]
        })
    });

    await harness.initializationPromise;

    assert.equal(harness.remoteCalls.create.length, 1);
    assert.equal(harness.remoteCalls.create[0].name, "Igreja Central");
    assert.equal(harness.remoteCalls.create[0].startTime, "19:00");
    assert.deepEqual(harness.remoteCalls.create[0].pros, [
        { id: "p1", title: "Acesso", description: "Fácil" }
    ]);
    assert.equal(harness.getRemovedLegacyCount(), 1);
    assert.deepEqual(
        JSON.parse(harness.storage.get("nosso-casamento-venues-backup:wedding-migration")),
        legacyVenues
    );
    assert.ok(harness.storage.has("nosso-casamento-venues-migrated:wedding-migration"));
    assert.equal(readValue(harness, "state.venues.length"), 2);

    const refreshedHarness = createHarness([], {
        autoInitialize: true,
        legacyVenues,
        storage: Object.fromEntries(harness.storage),
        listCurrentWeddingVenues: async () => ({
            weddingId: "wedding-migration",
            venues: readValue(harness, "state.venues")
        })
    });
    await refreshedHarness.initializationPromise;
    assert.equal(refreshedHarness.remoteCalls.create.length, 0);
    assert.equal(refreshedHarness.getRemovedLegacyCount(), 0);
    assert.deepEqual(
        refreshedHarness.storage.get("nosso-casamento-venues-backup:wedding-migration"),
        harness.storage.get("nosso-casamento-venues-backup:wedding-migration")
    );
});

test("falha parcial de migração não cria marca nem remove dados locais", async () => {
    const harness = createHarness([], {
        autoInitialize: true,
        legacyVenues: [{ id: "old", name: "Local", type: "Buffet", address: "Rua" }],
        listCurrentWeddingVenues: async () => ({ weddingId: "wedding-failure", venues: [] }),
        createError: Object.assign(new Error("RLS bloqueou"), { code: "VENUE_PERMISSION_DENIED" })
    });

    await harness.initializationPromise;

    assert.equal(harness.getRemovedLegacyCount(), 0);
    assert.equal(harness.storage.has("nosso-casamento-venues-migrated:wedding-failure"), false);
    assert.ok(harness.storage.has("nosso-casamento-venues-backup:wedding-failure"));
    assert.equal(harness.remoteCalls.create.length, 1);
    assert.ok(harness.consoleErrors.length >= 1);
});

test("HTML e CSS mantêm acessibilidade, modais e responsividade", () => {
    assert.match(venueHtml, /aria-expanded="false"/);
    assert.match(venueHtml, /role="radiogroup"/);
    assert.match(venueHtml, /id="venue-pro-title"/);
    assert.match(venueHtml, /id="venue-con-description"/);
    assert.match(venueHtml, /id="cancel-venue-edit"/);
    assert.match(venueHtml, /<dialog class="venue-delete-dialog"/);
    assert.doesNotMatch(venueSource, /window\.confirm/);
    assert.match(venueCss, /\.pros-cons-editors \{[^}]*grid-template-columns: repeat\(2/);
    assert.match(venueCss, /\.button-danger/);
    assert.match(venueCss, /@media \(max-width: 620px\)/);
    assert.match(venueCss, /\.pros-cons-editors, \.venue-pros-cons \{ grid-template-columns: 1fr; \}/);
    assert.match(venueCss, /\.venue-dialog-content \{[^}]*overflow-y: auto/);
    assert.doesNotMatch(venueSource, /saveState\s*\(/);
    assert.doesNotMatch(venueSource, /await\s+createCurrentWeddingVenue\s*\(/);
    assert.match(venueHtml, /supabase\.js\?v=20260722-logout-1/);
    assert.match(venueHtml, /app\.js\?v=20260721-venues-2/);
    assert.match(venueHtml, /main\.js\?v=20260721-venues-2/);
});
