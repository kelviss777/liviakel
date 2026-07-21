const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const venueSource = fs.readFileSync(
    path.join(projectRoot, "pages", "locais", "main.js"),
    "utf8"
);
const venueHtml = fs.readFileSync(
    path.join(projectRoot, "pages", "locais", "index.html"),
    "utf8"
);
const venueCss = fs.readFileSync(
    path.join(projectRoot, "pages", "locais", "style.css"),
    "utf8"
);

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
        this._queries = new Map();
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

    querySelectorAll() {
        return [];
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
        this.open = false;
    }

    contains() {
        return true;
    }

    matches(selector) {
        return selector === "input, select, textarea";
    }

    reset() {
        this.resetCalled = true;
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
    const detailsToggle = create("#venue-details-toggle");
    const toggleLabel = new FakeElement();
    detailsToggle._queries.set(".details-toggle-label", toggleLabel);
    const detailsFields = create("#venue-details-fields");
    const detailsDialog = create("#venue-details-dialog");
    const clearRating = create("#clear-venue-rating");
    const ratingStatus = create("#venue-rating-status");
    const budget = create("#venue-budget");
    const deposit = create("#venue-deposit");
    const depositError = create("#venue-deposit-error");
    const remaining = create("#venue-budget-remaining");
    const remainingValue = new FakeElement();
    remaining._queries.set("strong", remainingValue);
    const capacity = create("#venue-capacity");
    const endTime = create("#venue-end-time");
    const venueName = create("#venue-name");
    const venueType = create("#venue-type");
    const venueAddress = create("#venue-address");
    create("#venue-description");
    const venueList = create("#venue-list");
    const formCard = create("#venue-form-card");
    const detailsTitle = create("#venue-details-title");
    const detailsSubtitle = create("#venue-details-subtitle");
    const detailsContent = create("#venue-details-content");
    const mapLink = create("#venue-details-map-link");
    const modalFavorite = create("#venue-details-favorite");
    const ratingOptions = create(".rating-options");

    const ratingInputs = Array.from({ length: 5 }, (_, index) =>
        new FakeElement({ value: String(index + 1) })
    );
    const ratingLabels = Array.from({ length: 5 }, (_, index) =>
        new FakeElement({ dataset: { ratingValue: String(index + 1) } })
    );

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
        state: {
            venues: structuredClone(initialVenues)
        },
        FormData: class {
            get(name) {
                return formValues.has(name) ? formValues.get(name) : null;
            }
        },
        escapeHtml(value) {
            return String(value).replace(/[&<>'"]/g, character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                "'": "&#39;",
                '"': "&quot;"
            })[character]);
        },
        formatCurrency(value) {
            return new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL"
            }).format(Number(value) || 0);
        },
        formatDate(value, fallback = "Sem prazo") {
            if (!value) return fallback;
            const [year, month, day] = value.split("-").map(Number);
            return new Intl.DateTimeFormat("pt-BR").format(
                new Date(year, month - 1, day)
            );
        },
        emptyState(message) {
            return `<div>${message}</div>`;
        },
        makeId() {
            return "new-venue";
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
        detailsFields,
        detailsDialog,
        ratingInputs,
        ratingLabels,
        remaining,
        remainingValue,
        deposit,
        depositError,
        budget,
        capacity,
        endTime,
        venueList,
        detailsContent,
        modalFavorite,
        mapLink,
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
        pros: "",
        cons: "",
        ...overrides
    };
}

test("registros antigos recebem padrões sem perder os campos existentes", () => {
    const harness = createHarness([{
        id: "old",
        name: "Local antigo",
        type: "Igreja",
        address: "Praça Central",
        favorite: true
    }]);

    const normalized = vm.runInContext(
        "JSON.parse(JSON.stringify(normalizeVenue(state.venues[0])))",
        harness.context
    );

    assert.equal(normalized.name, "Local antigo");
    assert.equal(normalized.favorite, true);
    assert.equal(normalized.description, "");
    assert.equal(normalized.rating, null);
    assert.equal(normalized.decorationOption, "unknown");
    assert.equal(normalized.hasParking, false);
    assert.equal(
        vm.runInContext("hasDetailedInfo(state.venues[0])", harness.context),
        false
    );
    assert.doesNotMatch(harness.venueList.innerHTML, /Ver detalhes/);
});

test("salva cadastro básico e cadastro completo com o modelo esperado", () => {
    const basicHarness = createHarness();
    basicHarness.setFormValues(baseFormValues());
    basicHarness.form.listeners.submit[0]({
        preventDefault() {},
        currentTarget: basicHarness.form
    });

    const basic = JSON.parse(vm.runInContext(
        "JSON.stringify(state.venues[0])",
        basicHarness.context
    ));
    assert.deepEqual(basic, {
        id: "new-venue",
        name: "Villa Jardim",
        type: "Espaço para festa",
        address: "Rua das Flores, 100",
        favorite: false,
        description: "",
        rating: null,
        budgetValue: null,
        depositValue: null,
        decorationOption: "unknown",
        hasBridalRoom: false,
        capacity: null,
        hasParking: false,
        spaceAvailability: "unknown",
        startTime: "",
        endTime: "",
        availableDate: "",
        pros: "",
        cons: ""
    });
    assert.equal(basicHarness.getSavedCount(), 1);
    assert.equal(basicHarness.form.resetCalled, true);
    assert.equal(
        basicHarness.elements.get("#venue-details-toggle").getAttribute("aria-expanded"),
        "false"
    );

    const completeHarness = createHarness();
    completeHarness.budget.value = "18000.50";
    completeHarness.deposit.value = "3500.25";
    completeHarness.capacity.value = "220";
    completeHarness.ratingInputs[3].checked = true;
    completeHarness.setFormValues(baseFormValues({
        description: "Jardim bem cuidado e salão amplo.",
        rating: "4",
        budgetValue: "18000.50",
        depositValue: "3500.25",
        decorationOption: "included",
        hasBridalRoom: "on",
        capacity: "220",
        hasParking: "on",
        spaceAvailability: "ceremony_and_reception",
        startTime: "18:00",
        endTime: "02:00",
        availableDate: "2027-05-22",
        pros: "Equipe atenciosa",
        cons: "Acesso por estrada estreita"
    }));
    completeHarness.form.listeners.submit[0]({
        preventDefault() {},
        currentTarget: completeHarness.form
    });

    const complete = JSON.parse(vm.runInContext(
        "JSON.stringify(state.venues[0])",
        completeHarness.context
    ));
    assert.equal(complete.rating, 4);
    assert.equal(complete.budgetValue, 18000.5);
    assert.equal(complete.depositValue, 3500.25);
    assert.equal(complete.capacity, 220);
    assert.equal(complete.hasBridalRoom, true);
    assert.equal(complete.hasParking, true);
    assert.equal(complete.endTime, "02:00");
    assert.match(completeHarness.venueList.innerHTML, /Ver detalhes/);

    const partialHarness = createHarness();
    partialHarness.setFormValues(baseFormValues({
        pros: "Boa localização"
    }));
    partialHarness.form.listeners.submit[0]({
        preventDefault() {},
        currentTarget: partialHarness.form
    });
    const partial = JSON.parse(vm.runInContext(
        "JSON.stringify(state.venues[0])",
        partialHarness.context
    ));
    assert.equal(partial.pros, "Boa localização");
    assert.equal(partial.rating, null);
    assert.equal(partial.budgetValue, null);
    assert.match(partialHarness.venueList.innerHTML, /Ver detalhes/);
});

test("expansão e estrelas preservam valores e permitem remover a nota", () => {
    const harness = createHarness();
    const toggle = harness.elements.get("#venue-details-toggle");

    harness.detailsFields.hidden = true;
    toggle.listeners.click[0]();
    harness.elements.get("#venue-description").value = "Texto preservado";
    toggle.listeners.click[0]();

    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.equal(harness.elements.get("#venue-description").value, "Texto preservado");

    for (let value = 1; value <= 5; value += 1) {
        harness.ratingInputs[value - 1].listeners.change[0]();
        assert.equal(
            harness.elements.get("#venue-rating-status").textContent.includes(`${value} de 5`),
            true
        );
    }

    harness.elements.get("#clear-venue-rating").listeners.click[0]();
    assert.equal(harness.ratingInputs.some(input => input.checked), false);
    assert.equal(
        harness.elements.get("#venue-rating-status").textContent,
        "Sem avaliação selecionada."
    );
});

test("calcula restante e bloqueia entrada maior e capacidade decimal", () => {
    const harness = createHarness();
    harness.budget.value = "10000";
    harness.deposit.value = "2500.50";
    vm.runInContext("updateBudgetRemaining()", harness.context);

    assert.equal(harness.remaining.hidden, false);
    assert.match(harness.remainingValue.textContent, /7\.499,50/);

    harness.deposit.value = "12000";
    vm.runInContext("updateBudgetRemaining()", harness.context);
    assert.equal(harness.remaining.hidden, true);
    assert.match(harness.deposit.customValidity, /maior que o orçamento/);

    harness.deposit.value = "";
    harness.capacity.value = "120.5";
    harness.setFormValues(baseFormValues({ capacity: "120.5" }));
    const valid = vm.runInContext(
        "validateDetailedFields(new FormData(venueForm))",
        harness.context
    );
    assert.equal(valid, false);
    assert.match(harness.capacity.customValidity, /número inteiro/);

    const negativeHarness = createHarness();
    negativeHarness.budget.value = "-1";
    negativeHarness.setFormValues(baseFormValues({ budgetValue: "-1" }));
    const negativeBudget = vm.runInContext(
        "validateDetailedFields(new FormData(venueForm))",
        negativeHarness.context
    );
    assert.equal(negativeBudget, false);
    assert.match(negativeHarness.budget.customValidity, /igual ou maior que zero/);
});

test("aceita encerramento após meia-noite e rejeita horários idênticos", () => {
    const harness = createHarness();
    harness.setFormValues(baseFormValues({
        startTime: "20:00",
        endTime: "02:00"
    }));
    const overnight = vm.runInContext(
        "validateDetailedFields(new FormData(venueForm))",
        harness.context
    );
    assert.equal(overnight.endTime, "02:00");

    harness.setFormValues(baseFormValues({
        startTime: "20:00",
        endTime: "20:00"
    }));
    const sameTime = vm.runInContext(
        "validateDetailedFields(new FormData(venueForm))",
        harness.context
    );
    assert.equal(sameTime, false);
    assert.match(harness.endTime.customValidity, /precisa ser diferente/);
});

test("modal mostra apenas detalhes preenchidos e mantém mapa e favorito", () => {
    const harness = createHarness([{
        id: "details",
        name: "<Villa & Jardim>",
        type: "Buffet",
        address: "Av. Brasil, 50",
        favorite: false,
        description: "Salão iluminado",
        rating: 5,
        budgetValue: 10000,
        depositValue: 2500,
        capacity: 180,
        startTime: "20:00",
        endTime: "02:00",
        pros: "Boa equipe"
    }]);

    vm.runInContext("openVenueDetails('details')", harness.context);
    const modalText = allText(harness.detailsContent);

    assert.equal(harness.detailsDialog.open, true);
    assert.match(modalText, /Avaliação do casal/);
    assert.match(modalText, /Valor restante/);
    assert.match(modalText, /Até 180 pessoas/);
    assert.match(modalText, /02:00 \(dia seguinte\)/);
    assert.match(modalText, /Boa equipe/);
    assert.doesNotMatch(modalText, /undefined|null|NaN|Ainda não informado/);
    assert.match(harness.mapLink.href, /google\.com\/maps/);
    assert.equal(harness.modalFavorite.dataset.id, "details");

    const clickHandler = harness.body.listeners.click[0];
    clickHandler({
        target: {
            closest() {
                return { dataset: { action: "toggle-favorite", id: "details" } };
            }
        }
    });
    assert.equal(
        vm.runInContext("state.venues[0].favorite", harness.context),
        true
    );

    clickHandler({
        target: {
            closest() {
                return { dataset: { action: "delete-venue", id: "details" } };
            }
        }
    });
    assert.equal(vm.runInContext("state.venues.length", harness.context), 0);
});

test("favoritos permanecem ordenados e os endereços apontam para o Maps", () => {
    const harness = createHarness([
        {
            id: "regular",
            name: "Alameda",
            type: "Buffet",
            address: "Rua A, 10",
            favorite: false
        },
        {
            id: "favorite",
            name: "Zênite",
            type: "Igreja",
            address: "Praça da Sé, 1",
            favorite: true
        }
    ]);

    assert.ok(
        harness.venueList.innerHTML.indexOf("Zênite") <
        harness.venueList.innerHTML.indexOf("Alameda")
    );
    assert.match(
        harness.venueList.innerHTML,
        /google\.com\/maps\/search\/\?api=1&amp;query=Pra%C3%A7a%20da%20S%C3%A9%2C%201|google\.com\/maps\/search\/\?api=1&query=Pra%C3%A7a%20da%20S%C3%A9%2C%201/
    );

    harness.body.listeners.click[0]({
        target: {
            closest() {
                return {
                    dataset: {
                        action: "toggle-favorite",
                        id: "favorite"
                    }
                };
            }
        }
    });

    assert.equal(
        vm.runInContext("state.venues.find(item => item.id === 'favorite').favorite", harness.context),
        false
    );
});

test("HTML e CSS mantêm acessibilidade e responsividade solicitadas", () => {
    assert.match(venueHtml, /aria-expanded="false"/);
    assert.match(venueHtml, /role="radiogroup"/);
    assert.match(venueHtml, /type="number" min="0" step="0\.01"/);
    assert.match(venueHtml, /type="number" min="0" step="1"/);
    assert.match(venueHtml, /<dialog class="venue-details-dialog"/);
    assert.match(venueCss, /@media \(max-width: 620px\)/);
    assert.match(
        venueCss,
        /\.venue-primary-fields, \.detail-fields-grid \{ grid-template-columns: 1fr; \}/
    );
    assert.match(venueCss, /\.venue-details-dialog \{[^}]*calc\(100% - 32px\)/);
    assert.match(venueCss, /\.venue-dialog-content \{[^}]*overflow-y: auto/);
});
