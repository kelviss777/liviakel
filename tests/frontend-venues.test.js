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

function createHarness(initialVenues = []) {
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
    const toastMessages = [];
    const context = vm.createContext({
        console,
        document,
        Intl,
        Number,
        Object,
        String,
        Boolean,
        Math,
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
        showToast(message) {
            toastMessages.push(message);
        }
    });

    vm.runInContext(venueSource, context);

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
        setFormValues(values) {
            formValues = new Map(Object.entries(values));
        },
        getSavedCount() {
            return savedCount;
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
    harness.form.listeners.submit[0]({
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

test("valida tópico e motivo antes de adicionar itens", () => {
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
    submitVenue(harness);
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

test("cadastra local básico e local com listas estruturadas", () => {
    const basicHarness = createHarness();
    basicHarness.setFormValues(baseFormValues());
    submitVenue(basicHarness);
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
    submitVenue(detailedHarness);

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

test("edita local completo sem duplicar e preserva id e data de criação", () => {
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
    submitVenue(harness);

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
});

test("edita local básico e abre detalhes apenas quando necessário", () => {
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
    submitVenue(harness);
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

test("exclusão personalizada cancela e confirma sem cliques duplicados", () => {
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

    vm.runInContext("openVenueDeleteConfirmation('one', trigger); confirmVenueDelete(); confirmVenueDelete()", harness.context);
    const venues = readValue(harness, "state.venues");
    assert.deepEqual(venues.map(item => item.id), ["two"]);
    assert.equal(harness.getSavedCount(), 1);
    assert.match(harness.toastMessages.at(-1), /excluído com sucesso/);
});

test("favorito e Google Maps continuam funcionando", () => {
    const harness = createHarness([{
        id: "favorite",
        name: "Zênite",
        type: "Igreja",
        address: "Praça da Sé, 1",
        favorite: true
    }]);
    assert.match(harness.venueList.innerHTML, /google\.com\/maps\/search/);

    const clickHandler = harness.body.listeners.click[0];
    clickHandler({
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
});
