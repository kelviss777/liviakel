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
    pros: "",
    cons: ""
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
const venueDetailsToggle = document.querySelector("#venue-details-toggle");
const venueDetailsFields = document.querySelector("#venue-details-fields");
const venueDetailsDialog = document.querySelector("#venue-details-dialog");
const ratingInputs = [...document.querySelectorAll("input[name='rating']")];
const ratingLabels = [...document.querySelectorAll("[data-rating-value]")];
const clearRatingButton = document.querySelector("#clear-venue-rating");
const ratingStatus = document.querySelector("#venue-rating-status");
const budgetInput = document.querySelector("#venue-budget");
const depositInput = document.querySelector("#venue-deposit");
const depositError = document.querySelector("#venue-deposit-error");
const budgetRemaining = document.querySelector("#venue-budget-remaining");

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
        pros: normalizeText(venue.pros),
        cons: normalizeText(venue.cons)
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
        item.pros.trim() ||
        item.cons.trim()
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
    const venues = [...state.venues]
        .map(normalizeVenue)
        .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, "pt-BR"));

    document.querySelector("#venue-list").innerHTML = venues.length ? venues.map(venue => {
        const id = escapeHtml(String(venue.id));
        const name = escapeHtml(venue.name);
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`;
        const detailsButton = hasDetailedInfo(venue)
            ? `<button class="venue-details-button" data-action="view-venue-details" data-id="${id}" type="button">Ver detalhes</button>`
            : "";

        return `
            <article class="venue-card ${venue.favorite ? "favorite" : ""}">
                <div class="venue-card-top">
                    <span class="venue-type">${escapeHtml(venue.type)}</span>
                    <button class="favorite-button ${venue.favorite ? "active" : ""}" data-action="toggle-favorite" data-id="${id}" type="button" aria-label="${venue.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}" title="${venue.favorite ? "Remover dos favoritos" : "Favoritar"}">★</button>
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
                        <button class="delete-button" data-action="delete-venue" data-id="${id}" type="button" aria-label="Excluir ${name}">×</button>
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
        availableDate: String(data.get("availableDate") || ""),
        pros: String(data.get("pros") || "").trim(),
        cons: String(data.get("cons") || "").trim()
    };
}

function resetVenueForm() {
    venueForm.reset();
    venueForm.querySelectorAll("[aria-invalid='true']").forEach(clearFieldError);
    depositError.textContent = "";
    setRating(null);
    setDetailsExpanded(false);
    updateBudgetRemaining();
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

    appendDetailSection("Prós e contras", [
        ...(item.pros.trim() ? [{ label: "Prós", value: item.pros, full: true }] : []),
        ...(item.cons.trim() ? [{ label: "Contras", value: item.cons, full: true }] : [])
    ]);

    const mapLink = document.querySelector("#venue-details-map-link");
    mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`;

    const favoriteButton = document.querySelector("#venue-details-favorite");
    favoriteButton.dataset.id = String(item.id);
    favoriteButton.textContent = item.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos";
}

function openVenueDetails(id) {
    const venue = getVenueById(id);
    if (!venue || !hasDetailedInfo(venue)) return;

    renderVenueDetails(venue);
    if (!venueDetailsDialog.open) venueDetailsDialog.showModal();
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

venueForm.addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const mainFields = validateMainFields(data);
    if (!mainFields) return;

    updateBudgetRemaining();
    const detailedFields = validateDetailedFields(data);
    if (!detailedFields) return;

    state.venues.unshift({
        id: makeId(),
        ...mainFields,
        favorite: false,
        ...detailedFields
    });
    saveState();
    renderAll();
    resetVenueForm();
    document.querySelector("#venue-form-card").classList.add("hidden");
    showToast("Local adicionado.");
});

document.body.addEventListener("click", event => {
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

    if (action === "toggle-favorite") {
        const venue = getVenueById(id);
        if (!venue) return;
        venue.favorite = !venue.favorite;
        saveState();
        renderAll();
        if (venueDetailsDialog.open) renderVenueDetails(venue);
        return;
    }

    if (action === "delete-venue") {
        state.venues = state.venues.filter(item => String(item.id) !== String(id));
        if (venueDetailsDialog.open && document.querySelector("#venue-details-favorite").dataset.id === String(id)) {
            venueDetailsDialog.close();
        }
        saveState();
        renderAll();
    }
});

venueDetailsDialog.addEventListener("click", event => {
    if (event.target === venueDetailsDialog) venueDetailsDialog.close();
});

setRating(null);
setDetailsExpanded(false);
renderAll();
