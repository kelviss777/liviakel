const VENUE_DETAIL_DEFAULTS = Object.freeze({
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
    pros: [],
    cons: []
});

const DECORATION_LABELS = {
    included: "Decoração inclusa",
    separate: "Decoração disponível à parte",
    none: "Não possui decoração",
    unknown: "Ainda não informado"
};

const SPACE_LABELS = {
    ceremony_and_reception: "Cerimônia e salão de festas",
    ceremony_only: "Somente cerimônia",
    reception_only: "Somente salão de festas",
    unknown: "Ainda não informado"
};

const venueForm = document.querySelector("#venue-form");
const venueFormCard = document.querySelector("#venue-form-card");
const venueDetailsToggle = document.querySelector("#venue-details-toggle");
const venueDetailsFields = document.querySelector("#venue-details-fields");
const venueDetailsDialog = document.querySelector("#venue-details-dialog");
const venueDeleteDialog = document.querySelector("#venue-delete-dialog");
const ratingInputs = [...document.querySelectorAll("input[name='rating']")];
const ratingLabels = [...document.querySelectorAll("[data-rating-value]")];
const clearRatingButton = document.querySelector("#clear-venue-rating");
const ratingStatus = document.querySelector("#venue-rating-status");
const budgetInput = document.querySelector("#venue-budget");
const depositInput = document.querySelector("#venue-deposit");
const depositError = document.querySelector("#venue-deposit-error");
const budgetRemaining = document.querySelector("#venue-budget-remaining");
const venueSubmitButton = document.querySelector("#venue-submit-button");
const cancelVenueEditButton = document.querySelector("#cancel-venue-edit");
const venueEditNotice = document.querySelector("#venue-edit-notice");
const confirmVenueDeleteButton = document.querySelector("#confirm-venue-delete");

const LIST_EDITOR_CONFIG = {
    pros: {
        singular: "pró",
        emptyMessage: "Nenhum pró adicionado.",
        titleInput: document.querySelector("#venue-pro-title"),
        descriptionInput: document.querySelector("#venue-pro-description"),
        submitButton: document.querySelector("#submit-pro-item"),
        cancelButton: document.querySelector("#cancel-pro-edit"),
        list: document.querySelector("#venue-pros-list")
    },
    cons: {
        singular: "contra",
        emptyMessage: "Nenhum contra adicionado.",
        titleInput: document.querySelector("#venue-con-title"),
        descriptionInput: document.querySelector("#venue-con-description"),
        submitButton: document.querySelector("#submit-con-item"),
        cancelButton: document.querySelector("#cancel-con-edit"),
        list: document.querySelector("#venue-cons-list")
    }
};

let temporaryPros = [];
let temporaryCons = [];
let editingVenueId = null;
let editingListItemIds = { pros: null, cons: null };
let pendingDeleteVenueId = null;
let deleteTriggerElement = null;
let deleteInProgress = false;
let venuesLoading = true;
let venueSaveInProgress = false;
const favoriteVenueIds = new Set();

function optionalNumber(value, { integer = false, maximum = Infinity } = {}) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > maximum) return null;
    if (integer && !Number.isInteger(number)) return null;
    return number;
}

function normalizeText(value) {
    return typeof value === "string" ? value : "";
}

function normalizeStructuredList(value, type) {
    const source = typeof value === "string"
        ? (value.trim() ? [{ title: "Observação", description: value.trim() }] : [])
        : (Array.isArray(value) ? value : []);
    const usedIds = new Set();

    return source.map((entry, index) => {
        const rawEntry = typeof entry === "string"
            ? { title: "Observação", description: entry }
            : (entry && typeof entry === "object" ? entry : {});
        const title = normalizeText(rawEntry.title).trim();
        const description = normalizeText(rawEntry.description).trim();
        if (!title && !description) return null;

        const baseId = normalizeText(rawEntry.id).trim() || `legacy-${type}-${index + 1}`;
        let id = baseId;
        let suffix = 2;
        while (usedIds.has(id)) {
            id = `${baseId}-${suffix}`;
            suffix += 1;
        }
        usedIds.add(id);

        return {
            id,
            title: title || "Observação",
            description
        };
    }).filter(Boolean);
}

function cloneStructuredList(items) {
    return items.map(item => ({ ...item }));
}

function normalizeVenue(venue = {}) {
    const rating = optionalNumber(venue.rating, { integer: true, maximum: 5 });
    const decorationOption = Object.hasOwn(DECORATION_LABELS, venue.decorationOption)
        ? venue.decorationOption
        : VENUE_DETAIL_DEFAULTS.decorationOption;
    const spaceAvailability = Object.hasOwn(SPACE_LABELS, venue.spaceAvailability)
        ? venue.spaceAvailability
        : VENUE_DETAIL_DEFAULTS.spaceAvailability;

    return {
        ...VENUE_DETAIL_DEFAULTS,
        ...venue,
        name: normalizeText(venue.name),
        type: normalizeText(venue.type),
        address: normalizeText(venue.address),
        favorite: Boolean(venue.favorite),
        description: normalizeText(venue.description),
        rating: rating && rating >= 1 ? rating : null,
        budgetValue: optionalNumber(venue.budgetValue),
        depositValue: optionalNumber(venue.depositValue),
        decorationOption,
        hasBridalRoom: venue.hasBridalRoom === true,
        capacity: optionalNumber(venue.capacity, { integer: true }),
        hasParking: venue.hasParking === true,
        spaceAvailability,
        startTime: normalizeText(venue.startTime),
        endTime: normalizeText(venue.endTime),
        availableDate: normalizeText(venue.availableDate),
        pros: normalizeStructuredList(venue.pros, "pros"),
        cons: normalizeStructuredList(venue.cons, "cons")
    };
}

function hasValue(value) {
    return value !== null && value !== undefined && value !== "";
}

function hasDetailedInfo(venue) {
    const item = normalizeVenue(venue);
    return Boolean(
        item.description.trim() ||
        item.rating ||
        hasValue(item.budgetValue) ||
        hasValue(item.depositValue) ||
        item.decorationOption !== "unknown" ||
        item.hasBridalRoom ||
        hasValue(item.capacity) ||
        item.hasParking ||
        item.spaceAvailability !== "unknown" ||
        item.startTime ||
        item.endTime ||
        item.availableDate ||
        item.pros.length ||
        item.cons.length
    );
}

function getVenueById(id) {
    return state.venues.find(item => String(item.id) === String(id));
}

function renderVenueHighlights(venue) {
    const highlights = [];

    if (venue.rating) {
        highlights.push(`<span class="venue-highlight rating" aria-label="${venue.rating} de 5 estrelas">★ ${venue.rating}/5</span>`);
    }
    if (hasValue(venue.budgetValue)) {
        highlights.push(`<span class="venue-highlight">${escapeHtml(formatCurrency(venue.budgetValue))}</span>`);
    }
    if (hasValue(venue.capacity)) {
        highlights.push(`<span class="venue-highlight">Até ${escapeHtml(new Intl.NumberFormat("pt-BR").format(venue.capacity))} pessoas</span>`);
    }

    return highlights.length ? `<div class="venue-highlights">${highlights.join("")}</div>` : "";
}

function renderVenues() {
    const venueList = document.querySelector("#venue-list");
    venueList.setAttribute("aria-busy", String(venuesLoading));

    if (venuesLoading) {
        venueList.innerHTML = emptyState("Carregando locais...");
        return;
    }

    const venues = [...state.venues]
        .map(normalizeVenue)
        .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, "pt-BR"));

    venueList.innerHTML = venues.length ? venues.map(venue => {
        const id = escapeHtml(String(venue.id));
        const name = escapeHtml(venue.name);
        const favoriteUpdating = favoriteVenueIds.has(String(venue.id));
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`;
        const detailsButton = hasDetailedInfo(venue)
            ? `<button class="venue-details-button" data-action="view-venue-details" data-id="${id}" type="button">Ver detalhes</button>`
            : "";

        return `
            <article class="venue-card ${venue.favorite ? "favorite" : ""}">
                <div class="venue-card-top">
                    <span class="venue-type">${escapeHtml(venue.type)}</span>
                    <button class="favorite-button ${venue.favorite ? "active" : ""}" data-action="toggle-favorite" data-id="${id}" type="button" aria-label="${venue.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}" title="${venue.favorite ? "Remover dos favoritos" : "Favoritar"}" ${favoriteUpdating ? 'disabled aria-busy="true"' : ""}>★</button>
                </div>
                <h3>${name}</h3>
                <a class="venue-address" href="${mapUrl}" target="_blank" rel="noopener noreferrer" title="Abrir no Google Maps">
                    <span aria-hidden="true">⌖</span> ${escapeHtml(venue.address)}
                </a>
                ${renderVenueHighlights(venue)}
                <div class="venue-card-footer">
                    <span class="favorite-label ${venue.favorite ? "" : "muted"}">${venue.favorite ? "Nosso favorito" : "Em avaliação"}</span>
                    <div class="venue-card-actions">
                        ${detailsButton}
                        <button class="venue-edit-button" data-action="edit-venue" data-id="${id}" type="button">Editar</button>
                        <button class="delete-button" data-action="request-delete-venue" data-id="${id}" type="button" aria-label="Excluir ${name}" title="Excluir local">×</button>
                    </div>
                </div>
            </article>`;
    }).join("") : emptyState("Adicione o primeiro local que vocês estão considerando.");
}

function renderAll() {
    renderVenues();
}

function setDetailsExpanded(expanded) {
    venueDetailsToggle.setAttribute("aria-expanded", String(expanded));
    venueDetailsToggle.querySelector(".details-toggle-label").textContent = expanded
        ? "Ocultar opções detalhadas"
        : "Adicionar opções detalhadas";
    venueDetailsFields.hidden = !expanded;
}

function updateRatingVisual(previewValue = null) {
    const selectedValue = Number(ratingInputs.find(input => input.checked)?.value || 0);
    const visibleValue = previewValue === null ? selectedValue : Number(previewValue);

    ratingLabels.forEach(label => {
        const value = Number(label.dataset.ratingValue);
        label.classList.toggle("selected", previewValue === null && value <= selectedValue);
        label.classList.toggle("preview", previewValue !== null && value <= visibleValue);
    });
}

function setRating(value) {
    const normalizedValue = optionalNumber(value, { integer: true, maximum: 5 });

    ratingInputs.forEach(input => {
        input.checked = normalizedValue !== null && Number(input.value) === normalizedValue;
    });
    clearRatingButton.disabled = normalizedValue === null;
    ratingStatus.textContent = normalizedValue === null
        ? "Sem avaliação selecionada."
        : `${normalizedValue} de 5 ${normalizedValue === 1 ? "estrela selecionada" : "estrelas selecionadas"}.`;
    updateRatingVisual();
}

function getTemporaryItems(type) {
    return type === "pros" ? temporaryPros : temporaryCons;
}

function setTemporaryItems(type, items) {
    if (type === "pros") temporaryPros = items;
    else temporaryCons = items;
}

function resetListEditor(type, { focus = false } = {}) {
    const config = LIST_EDITOR_CONFIG[type];
    editingListItemIds[type] = null;
    config.titleInput.value = "";
    config.descriptionInput.value = "";
    clearFieldError(config.titleInput);
    clearFieldError(config.descriptionInput);
    config.submitButton.textContent = type === "pros" ? "Adicionar pró" : "Adicionar contra";
    config.cancelButton.hidden = true;
    if (focus) config.titleInput.focus();
}

function renderStructuredList(type) {
    const config = LIST_EDITOR_CONFIG[type];
    const items = getTemporaryItems(type);
    config.list.replaceChildren();

    if (!items.length) {
        const empty = document.createElement("p");
        empty.className = "structured-list-empty";
        empty.textContent = config.emptyMessage;
        config.list.append(empty);
        return;
    }

    items.forEach(item => {
        const article = document.createElement("article");
        const title = document.createElement("strong");
        const description = document.createElement("p");
        const footer = document.createElement("footer");
        const editButton = document.createElement("button");
        const removeButton = document.createElement("button");

        article.className = "structured-list-item";
        article.classList.toggle("editing", editingListItemIds[type] === item.id);
        title.textContent = item.title;
        description.textContent = item.description;

        editButton.className = "structured-item-action";
        editButton.type = "button";
        editButton.textContent = "Editar";
        editButton.dataset.listAction = "edit";
        editButton.dataset.listType = type;
        editButton.dataset.itemId = item.id;
        editButton.setAttribute("aria-label", `Editar ${config.singular} ${item.title}`);

        removeButton.className = "structured-item-action remove";
        removeButton.type = "button";
        removeButton.textContent = "Remover";
        removeButton.dataset.listAction = "remove";
        removeButton.dataset.listType = type;
        removeButton.dataset.itemId = item.id;
        removeButton.setAttribute("aria-label", `Remover ${config.singular} ${item.title}`);

        footer.append(editButton, removeButton);
        article.append(title, description, footer);
        config.list.append(article);
    });
}

function validateListItem(type) {
    const config = LIST_EDITOR_CONFIG[type];
    const title = config.titleInput.value.trim();
    const description = config.descriptionInput.value.trim();

    if (!title) {
        markFieldInvalid(config.titleInput, `Informe o tópico do ${config.singular}.`);
        return null;
    }
    if (!description) {
        markFieldInvalid(config.descriptionInput, `Informe o motivo do ${config.singular}.`);
        return null;
    }

    return { title, description };
}

function submitListItem(type) {
    const draft = validateListItem(type);
    if (!draft) return;

    const items = getTemporaryItems(type);
    const editingId = editingListItemIds[type];
    if (editingId) {
        setTemporaryItems(type, items.map(item => item.id === editingId ? { ...item, ...draft } : item));
    } else {
        setTemporaryItems(type, [...items, { id: makeId(), ...draft }]);
    }

    resetListEditor(type, { focus: true });
    renderStructuredList(type);
}

function editListItem(type, itemId) {
    const config = LIST_EDITOR_CONFIG[type];
    const item = getTemporaryItems(type).find(entry => entry.id === itemId);
    if (!item) return;

    editingListItemIds[type] = item.id;
    config.titleInput.value = item.title;
    config.descriptionInput.value = item.description;
    config.submitButton.textContent = "Salvar alteração";
    config.cancelButton.hidden = false;
    renderStructuredList(type);
    config.titleInput.focus();
}

function removeListItem(type, itemId) {
    setTemporaryItems(type, getTemporaryItems(type).filter(item => item.id !== itemId));
    if (editingListItemIds[type] === itemId) resetListEditor(type);
    renderStructuredList(type);
}

function hasPendingListDraft() {
    return Object.entries(LIST_EDITOR_CONFIG).find(([, config]) =>
        config.titleInput.value.trim() || config.descriptionInput.value.trim()
    );
}

function parseFormNumber(input) {
    if (input.validity?.badInput) return NaN;
    if (!input.value) return null;
    const number = Number(input.value);
    return Number.isFinite(number) ? number : NaN;
}

function clearFieldError(input) {
    input.setCustomValidity("");
    input.removeAttribute("aria-invalid");
}

function markFieldInvalid(input, message) {
    setDetailsExpanded(venueDetailsFields.contains(input) || !venueDetailsFields.hidden);
    input.setCustomValidity(message);
    input.setAttribute("aria-invalid", "true");
    input.focus();
    input.reportValidity();
    showToast(message);
    return false;
}

function updateBudgetRemaining() {
    const budget = parseFormNumber(budgetInput);
    const deposit = parseFormNumber(depositInput);
    clearFieldError(depositInput);
    depositError.textContent = "";
    budgetRemaining.hidden = true;

    if (budget === null || deposit === null || !Number.isFinite(budget) || !Number.isFinite(deposit)) return;

    if (deposit > budget) {
        const message = "A entrada não pode ser maior que o orçamento total.";
        depositInput.setCustomValidity(message);
        depositInput.setAttribute("aria-invalid", "true");
        depositError.textContent = message;
        return;
    }

    budgetRemaining.querySelector("strong").textContent = formatCurrency(budget - deposit);
    budgetRemaining.hidden = false;
}

function validateMainFields(data) {
    const name = String(data.get("name") || "").trim();
    const type = String(data.get("type") || "").trim();
    const address = String(data.get("address") || "").trim();

    if (!name) return markFieldInvalid(document.querySelector("#venue-name"), "Informe o nome do local.");
    if (!type) return markFieldInvalid(document.querySelector("#venue-type"), "Selecione o tipo do local.");
    if (!address) return markFieldInvalid(document.querySelector("#venue-address"), "Informe o endereço do local.");

    return { name, type, address };
}

function validateDetailedFields(data) {
    const budgetValue = parseFormNumber(budgetInput);
    const depositValue = parseFormNumber(depositInput);
    const capacityInput = document.querySelector("#venue-capacity");
    const capacity = parseFormNumber(capacityInput);
    const ratingValue = data.get("rating");
    const rating = ratingValue === null ? null : Number(ratingValue);
    const startTime = String(data.get("startTime") || "");
    const endTime = String(data.get("endTime") || "");
    const endTimeInput = document.querySelector("#venue-end-time");

    if (Number.isNaN(budgetValue) || (budgetValue !== null && budgetValue < 0)) {
        return markFieldInvalid(budgetInput, "Informe um orçamento igual ou maior que zero.");
    }
    if (Number.isNaN(depositValue) || (depositValue !== null && depositValue < 0)) {
        return markFieldInvalid(depositInput, "Informe uma entrada igual ou maior que zero.");
    }
    if (budgetValue !== null && depositValue !== null && depositValue > budgetValue) {
        return markFieldInvalid(depositInput, "A entrada não pode ser maior que o orçamento total.");
    }
    if (Number.isNaN(capacity) || (capacity !== null && (!Number.isInteger(capacity) || capacity < 0))) {
        return markFieldInvalid(capacityInput, "Informe a capacidade com um número inteiro igual ou maior que zero.");
    }
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
        return markFieldInvalid(ratingInputs[0], "Selecione uma avaliação de uma a cinco estrelas.");
    }
    if (startTime && endTime && startTime === endTime) {
        return markFieldInvalid(endTimeInput, "O horário de encerramento precisa ser diferente do horário de início.");
    }

    return {
        description: String(data.get("description") || "").trim(),
        rating,
        budgetValue,
        depositValue,
        decorationOption: Object.hasOwn(DECORATION_LABELS, data.get("decorationOption"))
            ? data.get("decorationOption")
            : "unknown",
        hasBridalRoom: data.get("hasBridalRoom") === "on",
        capacity,
        hasParking: data.get("hasParking") === "on",
        spaceAvailability: Object.hasOwn(SPACE_LABELS, data.get("spaceAvailability"))
            ? data.get("spaceAvailability")
            : "unknown",
        startTime,
        endTime,
        availableDate: String(data.get("availableDate") || "")
    };
}

function updateVenueFormMode() {
    const editingVenue = editingVenueId === null ? null : getVenueById(editingVenueId);
    venueEditNotice.hidden = !editingVenue;
    venueFormCard.classList.toggle("editing", Boolean(editingVenue));
    cancelVenueEditButton.hidden = !editingVenue;
    cancelVenueEditButton.disabled = venueSaveInProgress;
    venueSubmitButton.disabled = venueSaveInProgress;
    venueSubmitButton.textContent = venueSaveInProgress
        ? (editingVenue ? "Atualizando..." : "Salvando...")
        : (editingVenue ? "Salvar alterações" : "Salvar");
    venueForm.setAttribute("aria-busy", String(venueSaveInProgress));
    document.querySelector("#venue-edit-name").textContent = editingVenue ? normalizeVenue(editingVenue).name : "";
}

function resetVenueForm() {
    venueForm.reset();
    venueForm.querySelectorAll("[aria-invalid='true']").forEach(clearFieldError);
    depositError.textContent = "";
    temporaryPros = [];
    temporaryCons = [];
    editingVenueId = null;
    resetListEditor("pros");
    resetListEditor("cons");
    renderStructuredList("pros");
    renderStructuredList("cons");
    setRating(null);
    setDetailsExpanded(false);
    updateBudgetRemaining();
    updateVenueFormMode();
}

function fillVenueForm(venue) {
    const item = normalizeVenue(venue);
    document.querySelector("#venue-name").value = item.name;
    document.querySelector("#venue-type").value = item.type;
    document.querySelector("#venue-address").value = item.address;
    document.querySelector("#venue-description").value = item.description;
    budgetInput.value = hasValue(item.budgetValue) ? item.budgetValue : "";
    depositInput.value = hasValue(item.depositValue) ? item.depositValue : "";
    document.querySelector("#venue-decoration").value = item.decorationOption;
    document.querySelector("#venue-bridal-room").checked = item.hasBridalRoom;
    document.querySelector("#venue-capacity").value = hasValue(item.capacity) ? item.capacity : "";
    document.querySelector("#venue-parking").checked = item.hasParking;
    document.querySelector("#venue-space-availability").value = item.spaceAvailability;
    document.querySelector("#venue-start-time").value = item.startTime;
    document.querySelector("#venue-end-time").value = item.endTime;
    document.querySelector("#venue-available-date").value = item.availableDate;
    temporaryPros = cloneStructuredList(item.pros);
    temporaryCons = cloneStructuredList(item.cons);
    resetListEditor("pros");
    resetListEditor("cons");
    renderStructuredList("pros");
    renderStructuredList("cons");
    setRating(item.rating);
    updateBudgetRemaining();
    setDetailsExpanded(hasDetailedInfo(item));
}

function startVenueEdit(id) {
    const venue = getVenueById(id);
    if (!venue) return;

    editingVenueId = String(venue.id);
    fillVenueForm(venue);
    updateVenueFormMode();
    venueFormCard.classList.remove("hidden");
    if (venueDetailsDialog.open) venueDetailsDialog.close();
    venueFormCard.scrollIntoView?.({ behavior: "smooth", block: "start" });
    document.querySelector("#venue-name").focus();
}

function cancelVenueEdit() {
    if (venueSaveInProgress) return;
    resetVenueForm();
    venueFormCard.classList.add("hidden");
}

function createDetailItem(label, value, full = false) {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");

    wrapper.className = `venue-detail-item${full ? " full" : ""}`;
    term.textContent = label;
    description.textContent = value;
    wrapper.append(term, description);
    return wrapper;
}

function appendDetailSection(title, items) {
    if (!items.length) return;

    const section = document.createElement("section");
    const heading = document.createElement("h3");
    const list = document.createElement("dl");

    section.className = "venue-detail-section";
    heading.textContent = title;
    list.className = "venue-detail-list";
    items.forEach(item => list.append(createDetailItem(item.label, item.value, item.full)));
    section.append(heading, list);
    document.querySelector("#venue-details-content").append(section);
}

function createStructuredDetailGroup(title, items) {
    const group = document.createElement("div");
    const heading = document.createElement("h4");
    const list = document.createElement("ul");

    group.className = "venue-pros-cons-group";
    heading.textContent = title;
    items.forEach(item => {
        const listItem = document.createElement("li");
        const itemTitle = document.createElement("strong");
        itemTitle.textContent = item.title;
        listItem.append(itemTitle);
        if (item.description) {
            const description = document.createElement("p");
            description.textContent = item.description;
            listItem.append(description);
        }
        list.append(listItem);
    });
    group.append(heading, list);
    return group;
}

function appendProsConsSection(pros, cons) {
    if (!pros.length && !cons.length) return;

    const section = document.createElement("section");
    const heading = document.createElement("h3");
    const content = document.createElement("div");
    section.className = "venue-detail-section";
    heading.textContent = "Prós e contras";
    content.className = "venue-pros-cons";
    if (pros.length) content.append(createStructuredDetailGroup("Prós", pros));
    if (cons.length) content.append(createStructuredDetailGroup("Contras", cons));
    section.append(heading, content);
    document.querySelector("#venue-details-content").append(section);
}

function renderVenueDetails(venue) {
    const item = normalizeVenue(venue);
    const content = document.querySelector("#venue-details-content");
    const numberFormatter = new Intl.NumberFormat("pt-BR");
    const formattedEndTime = item.endTime && item.startTime && item.endTime < item.startTime
        ? `${item.endTime} (dia seguinte)`
        : item.endTime;

    document.querySelector("#venue-details-title").textContent = item.name;
    document.querySelector("#venue-details-subtitle").textContent = item.type;
    content.replaceChildren();

    appendDetailSection("Avaliação do casal", [
        ...(item.description.trim() ? [{ label: "Descrição", value: item.description, full: true }] : []),
        ...(item.rating ? [{ label: "Avaliação", value: `${"★".repeat(item.rating)} ${item.rating} de 5` }] : [])
    ]);

    appendDetailSection("Orçamento", [
        ...(hasValue(item.budgetValue) ? [{ label: "Orçamento total", value: formatCurrency(item.budgetValue) }] : []),
        ...(hasValue(item.depositValue) ? [{ label: "Entrada", value: formatCurrency(item.depositValue) }] : []),
        ...(hasValue(item.budgetValue) && hasValue(item.depositValue) && item.depositValue <= item.budgetValue
            ? [{ label: "Valor restante", value: formatCurrency(item.budgetValue - item.depositValue) }]
            : [])
    ]);

    appendDetailSection("Estrutura", [
        ...(item.decorationOption !== "unknown" ? [{ label: "Decoração", value: DECORATION_LABELS[item.decorationOption] }] : []),
        ...(item.hasBridalRoom ? [{ label: "Espaço para a noiva", value: "Possui espaço para a noiva" }] : []),
        ...(hasValue(item.capacity) ? [{ label: "Capacidade máxima", value: `Até ${numberFormatter.format(item.capacity)} pessoas` }] : []),
        ...(item.hasParking ? [{ label: "Estacionamento", value: "Possui estacionamento" }] : []),
        ...(item.spaceAvailability !== "unknown" ? [{ label: "Tipo de espaço", value: SPACE_LABELS[item.spaceAvailability], full: true }] : [])
    ]);

    appendDetailSection("Disponibilidade e horários", [
        ...(item.startTime ? [{ label: "Horário de início", value: item.startTime }] : []),
        ...(formattedEndTime ? [{ label: "Horário de encerramento", value: formattedEndTime }] : []),
        ...(item.availableDate ? [{ label: "Data disponível", value: formatDate(item.availableDate, "") }] : [])
    ]);

    appendProsConsSection(item.pros, item.cons);

    const mapLink = document.querySelector("#venue-details-map-link");
    mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`;

    const editButton = document.querySelector("#venue-details-edit");
    editButton.dataset.id = String(item.id);

    const favoriteButton = document.querySelector("#venue-details-favorite");
    favoriteButton.dataset.id = String(item.id);
    favoriteButton.textContent = item.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos";
    favoriteButton.disabled = favoriteVenueIds.has(String(item.id));
    favoriteButton.setAttribute("aria-busy", String(favoriteButton.disabled));
}

function openVenueDetails(id) {
    const venue = getVenueById(id);
    if (!venue || !hasDetailedInfo(venue)) return;

    renderVenueDetails(venue);
    if (!venueDetailsDialog.open) venueDetailsDialog.showModal();
}

function openVenueDeleteConfirmation(id, trigger) {
    const venue = getVenueById(id);
    if (!venue || deleteInProgress) return;

    pendingDeleteVenueId = String(venue.id);
    deleteTriggerElement = trigger;
    document.querySelector("#venue-delete-name").textContent = `“${normalizeVenue(venue).name}”`;
    confirmVenueDeleteButton.disabled = false;
    if (!venueDeleteDialog.open) venueDeleteDialog.showModal();
    document.querySelector("#cancel-venue-delete").focus();
}

function closeVenueDeleteConfirmation() {
    if (venueDeleteDialog.open) venueDeleteDialog.close();
}

async function confirmVenueDelete() {
    if (!pendingDeleteVenueId || deleteInProgress) return;

    deleteInProgress = true;
    confirmVenueDeleteButton.disabled = true;
    const id = pendingDeleteVenueId;

    try {
        await callVenueApi("deleteCurrentWeddingVenue", id);
        state.venues = state.venues.filter(item => String(item.id) !== id);

        if (editingVenueId === id) {
            resetVenueForm();
            venueFormCard.classList.add("hidden");
        }
        if (venueDetailsDialog.open && document.querySelector("#venue-details-edit").dataset.id === id) {
            venueDetailsDialog.close();
        }

        renderAll();
        closeVenueDeleteConfirmation();
        showToast("Local excluído com sucesso.");
    } catch (error) {
        reportVenueOperationError("excluir o local", error);
    } finally {
        deleteInProgress = false;
        confirmVenueDeleteButton.disabled = false;
    }
}

function clearDeleteDialogState() {
    const trigger = deleteTriggerElement;
    pendingDeleteVenueId = null;
    deleteTriggerElement = null;
    deleteInProgress = false;
    confirmVenueDeleteButton.disabled = false;
    if (trigger?.isConnected !== false) trigger?.focus?.();
}

function reportVenueOperationError(action, error) {
    console.error(`[Locais] Não foi possível ${action}.`, error);
    if (error?.cause) console.error("[Locais] Causa original da operação:", error.cause);

    if (error?.code === "AUTH_REQUIRED" && typeof redirectToLogin === "function") {
        redirectToLogin();
        return;
    }

    showToast(error?.message || `Não foi possível ${action}. Tente novamente.`);
}

function getVenueApiFunction(name) {
    const operation = globalThis[name];
    if (typeof operation === "function") return operation;

    const error = new Error(
        "Os recursos de locais não foram carregados corretamente. Atualize a página para buscar a versão mais recente."
    );
    error.code = "VENUE_API_UNAVAILABLE";
    return () => Promise.reject(error);
}

function callVenueApi(name, ...args) {
    return getVenueApiFunction(name)(...args);
}

function upsertVenueInMemory(venue, { prepend = false } = {}) {
    const normalizedVenue = normalizeVenue(venue);
    const venueIndex = state.venues.findIndex(
        item => String(item.id) === String(normalizedVenue.id)
    );

    if (venueIndex >= 0) {
        state.venues[venueIndex] = normalizedVenue;
    } else if (prepend) {
        state.venues.unshift(normalizedVenue);
    } else {
        state.venues.push(normalizedVenue);
    }
}

async function reloadVenueStateFromSupabase() {
    const { venues } = await callVenueApi("listCurrentWeddingVenues");
    state.venues = venues.map(normalizeVenue);
    renderAll();
}

async function finishVenueSaveAfterRemoteSuccess(venue, { prepend, successMessage }) {
    try {
        upsertVenueInMemory(venue, { prepend });
        renderAll();
        resetVenueForm();
        venueFormCard.classList.add("hidden");
        showToast(successMessage);
        return;
    } catch (interfaceError) {
        console.error(
            "[Locais] O Supabase confirmou a gravação, mas a interface falhou ao aplicar a resposta.",
            interfaceError
        );
    }

    let reloadFailed = false;
    try {
        await reloadVenueStateFromSupabase();
    } catch (reloadError) {
        reloadFailed = true;
        console.error(
            "[Locais] Não foi possível recarregar os locais depois da gravação confirmada.",
            reloadError
        );
    }

    try {
        resetVenueForm();
        venueFormCard.classList.add("hidden");
    } catch (resetError) {
        console.error("[Locais] Não foi possível finalizar o formulário após a gravação.", resetError);
    }

    try {
        showToast(reloadFailed
            ? "O local foi salvo no banco. Atualize a página para recarregar a lista."
            : successMessage);
    } catch (toastError) {
        console.error("[Locais] Não foi possível exibir a confirmação da gravação.", toastError);
    }
}

function refreshOpenVenueDetails() {
    if (!venueDetailsDialog.open) return;
    const openVenueId = document.querySelector("#venue-details-edit").dataset.id;
    const openVenue = getVenueById(openVenueId);
    if (openVenue) renderVenueDetails(openVenue);
}

async function toggleVenueFavorite(id) {
    const venueIndex = state.venues.findIndex(item => String(item.id) === String(id));
    if (venueIndex < 0 || favoriteVenueIds.has(String(id))) return;

    const venue = state.venues[venueIndex];
    const nextFavorite = !normalizeVenue(venue).favorite;
    favoriteVenueIds.add(String(id));
    renderAll();
    refreshOpenVenueDetails();

    try {
        const updatedVenue = await callVenueApi("updateCurrentWeddingVenueFavorite", venue.id, nextFavorite);
        const currentIndex = state.venues.findIndex(item => String(item.id) === String(id));
        if (currentIndex >= 0) state.venues[currentIndex] = normalizeVenue(updatedVenue);
    } catch (error) {
        reportVenueOperationError("atualizar o favorito", error);
    } finally {
        favoriteVenueIds.delete(String(id));
        renderAll();
        refreshOpenVenueDetails();
    }
}

function venueMigrationKeyPart(value) {
    return String(value ?? "").trim().toLocaleLowerCase("pt-BR");
}

function getVenueMigrationIdentity(venue) {
    const item = normalizeVenue(venue);
    return [item.name, item.type, item.address].map(venueMigrationKeyPart).join("\u0000");
}

function createVenueMigrationError(message, cause = null) {
    const error = new Error(message);
    error.code = "VENUE_MIGRATION_FAILED";
    if (cause) error.cause = cause;
    return error;
}

async function migrateLegacyVenues(weddingId, remoteVenues) {
    const markerKey = `nosso-casamento-venues-migrated:${weddingId}`;
    const backupKey = `nosso-casamento-venues-backup:${weddingId}`;
    if (localStorage.getItem(markerKey)) {
        return { venues: remoteVenues, importedCount: 0 };
    }

    const legacyVenues = loadLegacyVenues();
    if (!legacyVenues.length) {
        localStorage.setItem(markerKey, JSON.stringify({
            completedAt: new Date().toISOString(),
            importedCount: 0
        }));
        return { venues: remoteVenues, importedCount: 0 };
    }

    if (localStorage.getItem(backupKey) === null) {
        try {
            localStorage.setItem(backupKey, JSON.stringify(legacyVenues));
        } catch (error) {
            throw createVenueMigrationError(
                "Não foi possível criar a cópia de segurança dos locais antigos. Nenhum dado foi migrado.",
                error
            );
        }
    }

    const knownVenues = new Set(remoteVenues.map(getVenueMigrationIdentity));
    let importedCount = 0;

    for (const legacyVenue of legacyVenues) {
        const normalizedVenue = normalizeVenue(legacyVenue);
        if (!normalizedVenue.name.trim() || !normalizedVenue.type.trim() || !normalizedVenue.address.trim()) {
            throw createVenueMigrationError(
                "Um local antigo não possui nome, tipo ou endereço. A migração foi interrompida sem apagar os dados locais."
            );
        }

        const identity = getVenueMigrationIdentity(normalizedVenue);
        if (knownVenues.has(identity)) continue;

        try {
            const createdVenue = normalizeVenue(await callVenueApi("createCurrentWeddingVenue", normalizedVenue));
            remoteVenues.push(createdVenue);
            knownVenues.add(identity);
            importedCount += 1;
        } catch (error) {
            throw createVenueMigrationError(
                "Não foi possível migrar todos os locais antigos. A cópia local foi preservada para uma nova tentativa.",
                error
            );
        }
    }

    removeLegacyVenues();
    localStorage.setItem(markerKey, JSON.stringify({
        completedAt: new Date().toISOString(),
        importedCount
    }));
    return { venues: remoteVenues, importedCount };
}

async function initializeVenues() {
    venuesLoading = true;
    renderAll();
    let remoteLoaded = false;

    try {
        const { weddingId, venues } = await callVenueApi("listCurrentWeddingVenues");
        state.venues = venues.map(normalizeVenue);
        remoteLoaded = true;

        const migration = await migrateLegacyVenues(weddingId, state.venues);
        state.venues = migration.venues;
        if (migration.importedCount > 0) {
            showToast(`${migration.importedCount} ${migration.importedCount === 1 ? "local antigo foi migrado" : "locais antigos foram migrados"} com sucesso.`);
        }
    } catch (error) {
        if (!remoteLoaded) state.venues = [];
        reportVenueOperationError(
            error?.code === "VENUE_MIGRATION_FAILED" ? "concluir a migração dos locais" : "carregar os locais",
            error
        );
    } finally {
        venuesLoading = false;
        renderAll();
    }
}

document.querySelectorAll("[data-toggle-form]").forEach(button => button.addEventListener("click", () => {
    const card = document.querySelector(`#${button.dataset.toggleForm}`);
    card.classList.toggle("hidden");
    if (!card.classList.contains("hidden")) card.querySelector("input")?.focus();
}));

venueDetailsToggle.addEventListener("click", () => {
    setDetailsExpanded(venueDetailsToggle.getAttribute("aria-expanded") !== "true");
});

ratingInputs.forEach(input => input.addEventListener("change", () => setRating(Number(input.value))));
ratingLabels.forEach(label => {
    label.addEventListener("mouseenter", () => updateRatingVisual(label.dataset.ratingValue));
});
document.querySelector(".rating-options").addEventListener("mouseleave", () => updateRatingVisual());
clearRatingButton.addEventListener("click", () => {
    setRating(null);
    ratingInputs[0].focus();
});

[budgetInput, depositInput].forEach(input => input.addEventListener("input", () => {
    clearFieldError(input);
    updateBudgetRemaining();
}));

venueForm.addEventListener("input", event => {
    if (
        event.target.matches("input, select, textarea") &&
        event.target !== budgetInput &&
        event.target !== depositInput
    ) {
        clearFieldError(event.target);
    }
});

venueForm.addEventListener("click", event => {
    const actionButton = event.target.closest("[data-list-action]");
    if (!actionButton) return;

    const { listAction, listType, itemId } = actionButton.dataset;
    if (!LIST_EDITOR_CONFIG[listType]) return;
    if (listAction === "submit") submitListItem(listType);
    if (listAction === "edit") editListItem(listType, itemId);
    if (listAction === "remove") removeListItem(listType, itemId);
    if (listAction === "cancel") {
        resetListEditor(listType, { focus: true });
        renderStructuredList(listType);
    }
});

cancelVenueEditButton.addEventListener("click", cancelVenueEdit);

venueForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (venueSaveInProgress) return;

    const data = new FormData(event.currentTarget);
    const mainFields = validateMainFields(data);
    if (!mainFields) return;

    updateBudgetRemaining();
    const detailedFields = validateDetailedFields(data);
    if (!detailedFields) return;

    const pendingDraft = hasPendingListDraft();
    if (pendingDraft) {
        const [type, config] = pendingDraft;
        setDetailsExpanded(true);
        markFieldInvalid(
            config.titleInput,
            `Adicione ou cancele o ${LIST_EDITOR_CONFIG[type].singular} que está sendo preenchido antes de salvar o local.`
        );
        return;
    }

    const structuredDetails = {
        ...detailedFields,
        pros: cloneStructuredList(temporaryPros),
        cons: cloneStructuredList(temporaryCons)
    };

    venueSaveInProgress = true;
    updateVenueFormMode();

    if (editingVenueId !== null) {
        const venueIndex = state.venues.findIndex(item => String(item.id) === String(editingVenueId));
        if (venueIndex < 0) {
            showToast("Não foi possível localizar o local para edição.");
            venueSaveInProgress = false;
            updateVenueFormMode();
            return;
        }

        const currentVenue = state.venues[venueIndex];
        const venueDraft = {
            ...currentVenue,
            ...mainFields,
            ...structuredDetails,
            id: currentVenue.id
        };

        try {
            const updatedVenue = await callVenueApi("updateCurrentWeddingVenue", currentVenue.id, venueDraft);
            await finishVenueSaveAfterRemoteSuccess(updatedVenue, {
                prepend: false,
                successMessage: "Local atualizado com sucesso."
            });
        } catch (error) {
            reportVenueOperationError("atualizar o local", error);
        } finally {
            venueSaveInProgress = false;
            updateVenueFormMode();
        }
        return;
    }

    const venueDraft = {
        ...mainFields,
        favorite: false,
        ...structuredDetails
    };

    try {
        const createdVenue = await callVenueApi("createCurrentWeddingVenue", venueDraft);
        await finishVenueSaveAfterRemoteSuccess(createdVenue, {
            prepend: true,
            successMessage: "Local adicionado."
        });
    } catch (error) {
        reportVenueOperationError("adicionar o local", error);
    } finally {
        venueSaveInProgress = false;
        updateVenueFormMode();
    }
});

document.body.addEventListener("click", async event => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const { action, id } = actionButton.dataset;

    if (action === "view-venue-details") {
        openVenueDetails(id);
        return;
    }
    if (action === "close-venue-details") {
        venueDetailsDialog.close();
        return;
    }
    if (action === "edit-venue") {
        startVenueEdit(id);
        return;
    }
    if (action === "request-delete-venue") {
        openVenueDeleteConfirmation(id, actionButton);
        return;
    }
    if (action === "cancel-venue-delete") {
        closeVenueDeleteConfirmation();
        return;
    }
    if (action === "confirm-venue-delete") {
        await confirmVenueDelete();
        return;
    }
    if (action === "toggle-favorite") {
        await toggleVenueFavorite(id);
    }
});

venueDetailsDialog.addEventListener("click", event => {
    if (event.target === venueDetailsDialog) venueDetailsDialog.close();
});

venueDeleteDialog.addEventListener("click", event => {
    if (event.target === venueDeleteDialog && !deleteInProgress) closeVenueDeleteConfirmation();
});
venueDeleteDialog.addEventListener("close", clearDeleteDialogState);

resetVenueForm();
const venuesInitializationPromise = initializeVenues();
