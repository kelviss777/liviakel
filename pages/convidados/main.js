const GUEST_SCHEMA_VERSION = 2;
const GUEST_CATEGORIES = Object.freeze({
    godparents: { label: "Padrinhos", singular: "Padrinhos" },
    family: { label: "Família", singular: "Família" },
    individual_group: { label: "Grupo de avulsos", singular: "Convidado avulso" },
    couples: { label: "Casais", singular: "Casal" }
});
const INDIVIDUAL_ORIGINS = ["Amigos", "Trabalho", "Igreja", "Faculdade"];

function cleanGuestText(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function comparableGuestText(value) {
    return cleanGuestText(value).toLocaleLowerCase("pt-BR");
}

function searchableGuestText(value) {
    return comparableGuestText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extractFamilyNameSuffix(value) {
    let suffix = cleanGuestText(value);
    const familyPrefix = /^fam[ií]lia(?:\s+|$)/iu;

    while (familyPrefix.test(suffix)) {
        suffix = cleanGuestText(suffix.replace(familyPrefix, ""));
    }

    return suffix;
}

function normalizeFamilyName(value) {
    return cleanGuestText(extractFamilyNameSuffix(value));
}

function buildFamilyDisplayName(value) {
    const suffix = normalizeFamilyName(value);
    return suffix ? `Família ${suffix}` : "Família";
}

function wordsEndWith(words, ending) {
    if (!ending.length || words.length < ending.length) return false;
    const offset = words.length - ending.length;
    return ending.every((word, index) => comparableGuestText(words[offset + index]) === comparableGuestText(word));
}

function buildFamilyMemberFullName(memberName, familyName) {
    const cleanMemberName = cleanGuestText(memberName);
    const familySuffix = normalizeFamilyName(familyName);
    if (!cleanMemberName || !familySuffix) return cleanMemberName;

    const memberWords = cleanMemberName.split(" ");
    const suffixWords = familySuffix.split(" ");
    let completeSuffixCount = 0;

    while (wordsEndWith(memberWords, suffixWords)) {
        memberWords.splice(-suffixWords.length, suffixWords.length);
        completeSuffixCount += 1;
    }

    if (completeSuffixCount) return cleanGuestText([...memberWords, ...suffixWords].join(" "));

    for (let overlap = suffixWords.length - 1; overlap >= 1; overlap -= 1) {
        const prefixOverlap = suffixWords.slice(0, overlap);
        if (wordsEndWith(memberWords, prefixOverlap)) {
            while (wordsEndWith(memberWords, prefixOverlap)) {
                memberWords.splice(-prefixOverlap.length, prefixOverlap.length);
            }
            return cleanGuestText([...memberWords, ...suffixWords].join(" "));
        }
    }

    for (let overlap = suffixWords.length - 1; overlap >= 1; overlap -= 1) {
        const suffixOverlap = suffixWords.slice(-overlap);
        if (wordsEndWith(memberWords, suffixOverlap)) {
            while (wordsEndWith(memberWords, suffixOverlap)) {
                memberWords.splice(-suffixOverlap.length, suffixOverlap.length);
            }
            return cleanGuestText([...memberWords, ...suffixOverlap].join(" "));
        }
    }

    return cleanGuestText([...memberWords, ...suffixWords].join(" "));
}

function makeGuestId(prefix = "guest") {
    const generated = typeof makeId === "function"
        ? makeId()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${generated}`;
}

function safeGuestId(value, prefix) {
    return cleanGuestText(value) || makeGuestId(prefix);
}

function normalizePerson(person, prefix = "person") {
    if (typeof person === "string") {
        return { id: makeGuestId(prefix), name: cleanGuestText(person) };
    }

    return {
        id: safeGuestId(person?.id, prefix),
        name: cleanGuestText(person?.name)
    };
}

function normalizeCouple(couple, prefix = "couple") {
    return {
        id: safeGuestId(couple?.id, prefix),
        firstPersonName: cleanGuestText(couple?.firstPersonName ?? couple?.firstName),
        secondPersonName: cleanGuestText(couple?.secondPersonName ?? couple?.secondName)
    };
}

function isStructuredGuestGroup(item) {
    return Boolean(item && GUEST_CATEGORIES[item.category] && (
        item.schemaVersion === GUEST_SCHEMA_VERSION ||
        Array.isArray(item.members) ||
        Array.isArray(item.couples) ||
        Array.isArray(item.individuals)
    ));
}

function normalizeStructuredGroup(group) {
    const category = GUEST_CATEGORIES[group.category] ? group.category : "individual_group";
    const normalized = {
        schemaVersion: GUEST_SCHEMA_VERSION,
        id: safeGuestId(group.id, "group"),
        category,
        name: cleanGuestText(group.name) || GUEST_CATEGORIES[category].label,
        relationshipGroup: cleanGuestText(group.relationshipGroup),
        isClosed: Boolean(group.isClosed),
        members: [],
        couples: [],
        individuals: [],
        createdAt: cleanGuestText(group.createdAt) || new Date().toISOString()
    };

    normalized.members = (Array.isArray(group.members) ? group.members : [])
        .map(person => normalizePerson(person, "member"))
        .filter(person => person.name);
    normalized.couples = (Array.isArray(group.couples) ? group.couples : [])
        .map(couple => normalizeCouple(couple))
        .filter(couple => couple.firstPersonName && couple.secondPersonName);
    normalized.individuals = (Array.isArray(group.individuals) ? group.individuals : [])
        .map(person => normalizePerson(person, "godparent"))
        .filter(person => person.name);

    if (category === "godparents") normalized.name = "Padrinhos";
    if (category === "couples") normalized.name = "Casais";
    if (category === "family") {
        normalized.name = buildFamilyDisplayName(normalized.name);
        normalized.members = normalized.members.map(member => ({
            ...member,
            name: buildFamilyMemberFullName(member.name, normalized.name)
        }));
    }
    if (category === "individual_group") {
        normalized.relationshipGroup = normalized.relationshipGroup || normalized.name || "Outros";
        normalized.name = normalized.relationshipGroup;
    }

    return normalized;
}

function createLegacyGroupId(groupName, firstGuestId) {
    const slug = searchableGuestText(groupName).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "outros";
    return `legacy-group-${slug}-${cleanGuestText(firstGuestId) || "local"}`;
}

function mergeCompatibleGroups(groups) {
    const merged = [];

    groups.forEach(group => {
        const mergeKey = group.category === "individual_group"
            ? `${group.category}:${comparableGuestText(group.name)}`
            : ["godparents", "couples"].includes(group.category)
                ? group.category
                : null;
        const existing = mergeKey
            ? merged.find(item => item.mergeKey === mergeKey)?.group
            : null;

        if (!existing) {
            merged.push({ mergeKey, group });
            return;
        }

        existing.members.push(...group.members);
        existing.couples.push(...group.couples);
        existing.individuals.push(...group.individuals);
        existing.isClosed = existing.isClosed || group.isClosed;
    });

    return merged.map(item => item.group);
}

function normalizeGuestGroups(rawGuests) {
    const groups = [];
    const legacyGroups = new Map();

    (Array.isArray(rawGuests) ? rawGuests : []).forEach(item => {
        if (isStructuredGuestGroup(item)) {
            groups.push(normalizeStructuredGroup(item));
            return;
        }

        const name = cleanGuestText(item?.name);
        if (!name) return;
        const relationshipGroup = cleanGuestText(item?.guest_group ?? item?.group) || "Outros";
        const key = comparableGuestText(relationshipGroup);

        if (!legacyGroups.has(key)) {
            legacyGroups.set(key, {
                schemaVersion: GUEST_SCHEMA_VERSION,
                id: createLegacyGroupId(relationshipGroup, item?.id),
                category: "individual_group",
                name: relationshipGroup,
                relationshipGroup,
                isClosed: false,
                members: [],
                couples: [],
                individuals: [],
                createdAt: cleanGuestText(item?.createdAt) || new Date().toISOString()
            });
        }

        legacyGroups.get(key).members.push({
            id: safeGuestId(item?.id, "legacy-person"),
            name
        });
    });

    groups.push(...legacyGroups.values());
    return mergeCompatibleGroups(groups);
}

function countGroupPeople(group) {
    if (!group) return 0;
    if (group.category === "godparents") {
        return (group.couples?.length || 0) * 2 + (group.individuals?.length || 0);
    }
    if (group.category === "couples") return (group.couples?.length || 0) * 2;
    return group.members?.length || 0;
}

function countAllPeople(groups) {
    return (Array.isArray(groups) ? groups : []).reduce((total, group) => total + countGroupPeople(group), 0);
}

function pluralizeGuest(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
}

function getGroupSearchText(group) {
    const names = [group.name, group.relationshipGroup, GUEST_CATEGORIES[group.category]?.label];
    group.members?.forEach(member => names.push(member.name));
    group.individuals?.forEach(member => names.push(member.name));
    group.couples?.forEach(couple => names.push(couple.firstPersonName, couple.secondPersonName));
    return searchableGuestText(names.join(" "));
}

function filterGuestGroups(groups, search, stateFilter, categoryFilter) {
    const term = searchableGuestText(search);
    return groups.filter(group => {
        const matchesSearch = !term || getGroupSearchText(group).includes(term);
        const matchesState = stateFilter === "all" || (stateFilter === "closed" ? group.isClosed : !group.isClosed);
        const matchesCategory = categoryFilter === "all" || group.category === categoryFilter;
        return matchesSearch && matchesState && matchesCategory;
    });
}

function getGroupMeta(group) {
    if (group.category === "godparents") {
        return `${pluralizeGuest(group.couples.length, "casal", "casais")} · ${pluralizeGuest(group.individuals.length, "avulso", "avulsos")}`;
    }
    if (group.category === "couples") return pluralizeGuest(group.couples.length, "casal", "casais");
    return pluralizeGuest(group.members.length, "integrante", "integrantes");
}

function createEmptyGuestDraft(category = "") {
    return {
        schemaVersion: GUEST_SCHEMA_VERSION,
        id: makeGuestId("group"),
        category,
        name: category && category !== "family" ? GUEST_CATEGORIES[category].label : "",
        relationshipGroup: "",
        isClosed: false,
        members: [],
        couples: [],
        individuals: [],
        createdAt: new Date().toISOString()
    };
}

function focusControlNaturally(control) {
    if (!control) return;
    control.focus({ preventScroll: true });
    const isTextInput = control.tagName === "INPUT" && !["checkbox", "radio", "date"].includes(control.type);
    if (isTextInput && control.value) {
        const end = control.value.length;
        control.setSelectionRange?.(end, end);
    }
}

const guestListElement = document.querySelector("#guest-list");
const guestSearch = document.querySelector("#guest-search");
const guestStateFilter = document.querySelector("#guest-state-filter");
const guestCategoryFilter = document.querySelector("#guest-category-filter");
const wizardDialog = document.querySelector("#guest-wizard-dialog");
const wizardFields = document.querySelector("#wizard-fields");
const wizardNext = document.querySelector("#wizard-next");
const wizardBack = document.querySelector("#wizard-back");
const detailsDialog = document.querySelector("#guest-details-dialog");
const completeListDialog = document.querySelector("#complete-guest-list-dialog");
const completeListSearch = document.querySelector("#complete-list-search");
const completeListContent = document.querySelector("#complete-list-content");
const confirmDialog = document.querySelector("#guest-confirm-dialog");

let currentDetailsGroupId = null;
let pendingConfirmation = null;
let confirmationReturnFocus = null;
let wizardReturnFocus = null;
let detailsReturnFocus = null;
let completeListReturnFocus = null;
let wizardState = createWizardState();

function createWizardState() {
    return {
        mode: "create",
        step: 1,
        editingId: null,
        draft: createEmptyGuestDraft(),
        dirty: false,
        builderMode: "couples",
        originChoice: "Amigos",
        buffer: { personName: "", firstPersonName: "", secondPersonName: "" },
        editingEntry: null
    };
}

function renderGuestSummary() {
    const totalPeople = countAllPeople(state.guests);
    const closed = state.guests.filter(group => group.isClosed).length;
    document.querySelector("#summary-people").textContent = totalPeople;
    document.querySelector("#summary-groups").textContent = state.guests.length;
    document.querySelector("#summary-closed").textContent = closed;
    document.querySelector("#summary-open").textContent = state.guests.length - closed;
    document.querySelector("#guest-count-note").textContent = state.guests.length
        ? `${pluralizeGuest(totalPeople, "pessoa organizada", "pessoas organizadas")} em ${pluralizeGuest(state.guests.length, "grupo", "grupos")}.`
        : "Sua lista começa por aqui.";
}

function renderGuestCard(group) {
    const total = countGroupPeople(group);
    const safeId = escapeHtml(group.id);
    const closedState = group.isClosed
        ? `<span class="closed-badge"><span aria-hidden="true">✓</span> Fechado</span>`
        : `<span class="open-badge">Em aberto</span>`;

    return `
        <article class="guest-card${group.isClosed ? " is-closed" : ""}">
            <button class="card-open-surface" data-action="view-group" data-id="${safeId}" type="button" aria-label="Ver integrantes de ${escapeHtml(group.name)}"></button>
            <div class="card-topline">
                <span class="category-label">${escapeHtml(GUEST_CATEGORIES[group.category].label)}</span>
                ${closedState}
            </div>
            <h2 id="guest-card-${safeId}">${escapeHtml(group.name)}</h2>
            <p class="card-count">${pluralizeGuest(total, "pessoa", "pessoas")}</p>
            <p class="card-meta">${escapeHtml(getGroupMeta(group))}</p>
            <div class="card-actions">
                <button class="card-action primary" data-action="view-group" data-id="${safeId}" type="button">Ver integrantes</button>
                <button class="card-action" data-action="edit-group" data-id="${safeId}" type="button">Editar</button>
                <button class="card-action" data-action="toggle-group" data-id="${safeId}" type="button">${group.isClosed ? "Reabrir" : "Fechar"}</button>
                <button class="card-action delete" data-action="delete-group" data-id="${safeId}" type="button" aria-label="Excluir ${escapeHtml(group.name)}">Excluir</button>
            </div>
        </article>`;
}

function renderGuests() {
    const visibleGroups = filterGuestGroups(
        state.guests,
        guestSearch.value,
        guestStateFilter.value,
        guestCategoryFilter.value
    );
    const hasFilters = Boolean(guestSearch.value.trim()) || guestStateFilter.value !== "all" || guestCategoryFilter.value !== "all";

    document.querySelector("#guest-results-meta").textContent = hasFilters
        ? `${pluralizeGuest(visibleGroups.length, "grupo encontrado", "grupos encontrados")}`
        : "";

    if (visibleGroups.length) {
        guestListElement.innerHTML = visibleGroups.map(renderGuestCard).join("");
        return;
    }

    guestListElement.innerHTML = `
        <div class="guest-empty">
            <span aria-hidden="true">♡</span>
            <h2>${hasFilters ? "Nenhum grupo por aqui" : "Uma lista feita de histórias"}</h2>
            <p>${hasFilters ? "Tente outro nome ou ajuste os filtros para encontrar quem procura." : "Comece adicionando uma família, um casal, padrinhos ou alguém especial."}</p>
            ${hasFilters ? "" : '<button class="button button-primary" data-action="open-create" type="button">Adicionar primeiros convidados</button>'}
        </div>`;
}

function renderAll() {
    renderGuestSummary();
    renderGuests();
    if (detailsDialog.open && currentDetailsGroupId) renderGuestDetails(currentDetailsGroupId);
    if (completeListDialog.open) renderCompleteGuestList();
}

function categoryFieldsHeading(title, description) {
    return `<div class="details-intro"><h3>${title}</h3><p>${description}</p></div>`;
}

function renderMemberRows(items, type, formatter = item => item.name) {
    if (!items.length) return '<p class="list-placeholder">Os nomes adicionados aparecerão aqui.</p>';
    return `<div class="member-list">${items.map(item => `
        <div class="member-row">
            <span>${escapeHtml(formatter(item))}</span>
            <div class="member-row-actions">
                <button class="member-action" data-entry-action="edit" data-entry-type="${type}" data-entry-id="${escapeHtml(item.id)}" type="button">Editar</button>
                <button class="member-action remove" data-entry-action="remove" data-entry-type="${type}" data-entry-id="${escapeHtml(item.id)}" type="button">Remover</button>
            </div>
        </div>`).join("")}</div>`;
}

function renderFamilyFields() {
    const editingPerson = wizardState.editingEntry?.type === "members";
    const familySuffix = extractFamilyNameSuffix(wizardState.draft.name);
    return `${categoryFieldsHeading("Agora vamos adicionar os nomes", "Dê um nome à família e inclua cada pessoa no seu tempo.")}
        <div class="form-stack">
            <div class="wizard-field">
                <label for="family-name">Nome da família</label>
                <div class="family-name-control">
                    <span class="family-name-prefix" aria-hidden="true">Família</span>
                    <input id="family-name" data-draft-field="familyName" value="${escapeHtml(familySuffix)}" placeholder="Ex.: Silva" autocomplete="off" aria-label="Complemento do nome da família" aria-describedby="family-name-help family-name-error">
                </div>
                <span class="sr-only" id="family-name-help">O nome completo será iniciado pelo prefixo fixo Família.</span>
                <p class="field-error" id="family-name-error" data-error-for="familyName"></p>
            </div>
            <div class="inline-builder">
                <div class="builder-heading"><strong>Integrantes</strong><small>${pluralizeGuest(wizardState.draft.members.length, "pessoa", "pessoas")}</small></div>
                <div class="builder-actions">
                    <div class="wizard-field field-grow">
                        <label for="family-member-name">Nome da pessoa</label>
                        <input id="family-member-name" data-buffer-field="personName" value="${escapeHtml(wizardState.buffer.personName)}" placeholder="Ex.: Eduardo" autocomplete="off" aria-describedby="family-member-help">
                        <small class="field-help" id="family-member-help">O nome da família será acrescentado automaticamente.</small>
                    </div>
                    <button class="button button-ghost button-small" data-builder-action="add-person" data-entry-type="members" type="button">${editingPerson ? "Salvar integrante" : "+ Adicionar integrante"}</button>
                </div>
                <p class="field-error" id="builder-error"></p>
                ${renderMemberRows(wizardState.draft.members, "members")}
            </div>
            <span class="live-total">${pluralizeGuest(countGroupPeople(wizardState.draft), "pessoa na família", "pessoas na família")}</span>
        </div>`;
}

function renderIndividualFields() {
    const custom = wizardState.originChoice === "Outros";
    const editingPerson = wizardState.editingEntry?.type === "members";
    return `${categoryFieldsHeading("Agora vamos adicionar os nomes", "Conte de onde vocês se conhecem para manter a lista bem organizada.")}
        <div class="form-stack">
            <div class="form-row">
                <div class="wizard-field">
                    <label for="individual-origin">Origem ou grupo</label>
                    <select id="individual-origin" data-draft-field="originChoice">
                        ${[...INDIVIDUAL_ORIGINS, "Outros"].map(origin => `<option value="${origin}"${wizardState.originChoice === origin ? " selected" : ""}>${origin}</option>`).join("")}
                    </select>
                </div>
                <div class="wizard-field" id="custom-group-field"${custom ? "" : " hidden"}>
                    <label for="custom-group-name">Nome do grupo</label>
                    <input id="custom-group-name" data-draft-field="customGroup" value="${custom ? escapeHtml(wizardState.draft.relationshipGroup) : ""}" placeholder="Ex.: Vizinhos" autocomplete="off">
                    <p class="field-error" data-error-for="customGroup"></p>
                </div>
            </div>
            <div class="inline-builder">
                <div class="builder-heading"><strong>Convidados deste grupo</strong><small>${pluralizeGuest(wizardState.draft.members.length, "pessoa", "pessoas")}</small></div>
                <div class="builder-actions">
                    <div class="wizard-field field-grow">
                        <label for="individual-name">Nome da pessoa</label>
                        <input id="individual-name" data-buffer-field="personName" value="${escapeHtml(wizardState.buffer.personName)}" placeholder="Ex.: Amanda Pereira" autocomplete="off">
                    </div>
                    <button class="button button-ghost button-small" data-builder-action="add-person" data-entry-type="members" type="button">${editingPerson ? "Salvar pessoa" : "+ Adicionar pessoa"}</button>
                </div>
                <p class="field-error" id="builder-error"></p>
                ${renderMemberRows(wizardState.draft.members, "members")}
            </div>
            <span class="live-total">${pluralizeGuest(countGroupPeople(wizardState.draft), "pessoa neste grupo", "pessoas neste grupo")}</span>
        </div>`;
}

function renderCoupleFields() {
    const couple = wizardState.draft.couples[0] || { firstPersonName: "", secondPersonName: "" };
    return `${categoryFieldsHeading("Agora vamos adicionar os nomes", "Duas pessoas, um lugar especial na lista.")}
        <div class="form-stack">
            <div class="form-row">
                <div class="wizard-field">
                    <label for="couple-first-name">Nome da primeira pessoa</label>
                    <input id="couple-first-name" data-draft-field="coupleFirst" value="${escapeHtml(couple.firstPersonName)}" placeholder="Ex.: João" autocomplete="off">
                    <p class="field-error" data-error-for="coupleFirst"></p>
                </div>
                <div class="wizard-field">
                    <label for="couple-second-name">Nome da segunda pessoa</label>
                    <input id="couple-second-name" data-draft-field="coupleSecond" value="${escapeHtml(couple.secondPersonName)}" placeholder="Ex.: Maria" autocomplete="off">
                    <p class="field-error" data-error-for="coupleSecond"></p>
                </div>
            </div>
            <span class="live-total">2 pessoas neste casal</span>
        </div>`;
}

function renderGodparentsFields() {
    const addingCouple = wizardState.builderMode === "couples";
    const editingSameType = wizardState.editingEntry?.type === wizardState.builderMode;
    return `${categoryFieldsHeading("Agora vamos adicionar os nomes", "Alterne entre casais e avulsos para montar o grupo de padrinhos.")}
        <div class="form-stack">
            <div class="segmented-wrap">
                <span class="fieldset-label">Como deseja adicionar?</span>
                <div class="segmented-control" role="radiogroup" aria-label="Formato dos padrinhos">
                    <button class="segmented-button" data-builder-mode="couples" role="radio" aria-checked="${addingCouple}" type="button"><span aria-hidden="true">∞</span><strong>Casais</strong><small>Adicione duas pessoas juntas</small></button>
                    <button class="segmented-button" data-builder-mode="individuals" role="radio" aria-checked="${!addingCouple}" type="button"><span aria-hidden="true">○</span><strong>Avulsos</strong><small>Adicione uma pessoa por vez</small></button>
                </div>
            </div>
            <div class="inline-builder">
                <div class="builder-heading"><strong>${addingCouple ? "Adicionar um casal" : "Adicionar uma pessoa"}</strong><small>${pluralizeGuest(countGroupPeople(wizardState.draft), "pessoa", "pessoas")} no total</small></div>
                <div class="builder-actions">
                    ${addingCouple ? `
                        <div class="form-row field-grow">
                            <div class="wizard-field"><label for="godparent-first-name">Primeira pessoa</label><input id="godparent-first-name" data-buffer-field="firstPersonName" value="${escapeHtml(wizardState.buffer.firstPersonName)}" placeholder="Ex.: João" autocomplete="off"></div>
                            <div class="wizard-field"><label for="godparent-second-name">Segunda pessoa</label><input id="godparent-second-name" data-buffer-field="secondPersonName" value="${escapeHtml(wizardState.buffer.secondPersonName)}" placeholder="Ex.: Maria" autocomplete="off"></div>
                        </div>
                        <button class="button button-ghost button-small" data-builder-action="add-couple" type="button">${editingSameType ? "Salvar casal" : wizardState.draft.couples.length ? "+ Adicionar outro casal" : "+ Adicionar casal"}</button>` : `
                        <div class="wizard-field field-grow"><label for="godparent-name">Nome</label><input id="godparent-name" data-buffer-field="personName" value="${escapeHtml(wizardState.buffer.personName)}" placeholder="Ex.: Fernanda" autocomplete="off"></div>
                        <button class="button button-ghost button-small" data-builder-action="add-person" data-entry-type="individuals" type="button">${editingSameType ? "Salvar pessoa" : wizardState.draft.individuals.length ? "+ Adicionar outra pessoa" : "+ Adicionar pessoa"}</button>`}
                </div>
                <p class="field-error" id="builder-error"></p>
            </div>
            <div>
                <span class="fieldset-label">Casais</span>
                ${renderMemberRows(wizardState.draft.couples, "couples", couple => `${couple.firstPersonName} e ${couple.secondPersonName}`)}
            </div>
            <div>
                <span class="fieldset-label">Avulsos</span>
                ${renderMemberRows(wizardState.draft.individuals, "individuals")}
            </div>
            <span class="live-total">${pluralizeGuest(countGroupPeople(wizardState.draft), "pessoa em Padrinhos", "pessoas em Padrinhos")}</span>
        </div>`;
}

function renderWizardFields() {
    const renderers = {
        family: renderFamilyFields,
        individual_group: renderIndividualFields,
        couples: renderCoupleFields,
        godparents: renderGodparentsFields
    };
    wizardFields.innerHTML = renderers[wizardState.draft.category]?.() || "";
}

function renderReviewList(items, title, formatter) {
    if (!items.length) return "";
    return `<section class="review-section"><h4>${title}</h4><ul class="review-list">${items.map(item => `<li>${escapeHtml(formatter(item))}</li>`).join("")}</ul></section>`;
}

function renderGuestReview() {
    const group = normalizeStructuredGroup(wizardState.draft);
    const total = countGroupPeople(group);
    let lists = "";
    if (group.category === "godparents") {
        lists += renderReviewList(group.couples, "Casais", item => `${item.firstPersonName} e ${item.secondPersonName}`);
        lists += renderReviewList(group.individuals, "Avulsos", item => item.name);
    } else if (group.category === "couples") {
        lists = renderReviewList(group.couples, "Casal", item => `${item.firstPersonName} e ${item.secondPersonName}`);
    } else {
        lists = renderReviewList(group.members, group.category === "family" ? "Integrantes" : "Convidados", item => item.name);
    }
    document.querySelector("#guest-review").innerHTML = `
        <span class="category-label">${escapeHtml(GUEST_CATEGORIES[group.category].label)}</span>
        <h3>${escapeHtml(group.name)}</h3>
        <p class="review-total">${pluralizeGuest(total, "pessoa", "pessoas")}</p>
        ${lists}`;
}

function wizardHasPendingEntry() {
    return Boolean(
        cleanGuestText(wizardState.buffer.personName) ||
        cleanGuestText(wizardState.buffer.firstPersonName) ||
        cleanGuestText(wizardState.buffer.secondPersonName) ||
        wizardState.editingEntry
    );
}

function getDraftValidation() {
    const group = wizardState.draft;
    const errors = {};
    if (!group.category) errors.category = "Escolha uma categoria.";
    if (group.category === "family" && !normalizeFamilyName(group.name)) errors.familyName = "Informe o complemento do nome da família.";
    if (group.category === "individual_group" && !cleanGuestText(group.relationshipGroup)) errors.customGroup = "Informe o nome do grupo.";
    if (["family", "individual_group"].includes(group.category) && !group.members.length) errors.builder = "Adicione pelo menos uma pessoa.";
    if (group.category === "couples") {
        const couple = group.couples[0] || {};
        if (!cleanGuestText(couple.firstPersonName)) errors.coupleFirst = "Informe o primeiro nome.";
        if (!cleanGuestText(couple.secondPersonName)) errors.coupleSecond = "Informe o segundo nome.";
    }
    if (group.category === "godparents" && !group.couples.length && !group.individuals.length) errors.builder = "Adicione ao menos um casal ou uma pessoa.";
    if (wizardHasPendingEntry()) errors.builder = "Conclua a inclusão do nome que está sendo editado.";
    return errors;
}

function showDraftValidation(errors) {
    wizardFields.querySelectorAll("[data-error-for]").forEach(element => {
        const message = errors[element.dataset.errorFor] || "";
        element.textContent = message;
        const field = wizardFields.querySelector(`[data-draft-field="${element.dataset.errorFor}"]`);
        field?.setAttribute("aria-invalid", String(Boolean(message)));
    });
    const builderError = document.querySelector("#builder-error");
    if (builderError) builderError.textContent = errors.builder || "";
}

function updateWizardNextState() {
    if (wizardState.step === 1) wizardNext.disabled = !wizardState.draft.category;
    else if (wizardState.step === 2) wizardNext.disabled = Object.keys(getDraftValidation()).length > 0;
    else wizardNext.disabled = false;
}

function renderWizard() {
    const titles = {
        1: ["Quem vamos adicionar?", "Escolha como essas pessoas fazem parte da história de vocês."],
        2: ["Agora vamos adicionar os nomes", "Inclua cada pessoa com calma. Você poderá revisar tudo antes de salvar."],
        3: ["Tudo certo por aqui?", "Confira os nomes e volte se quiser ajustar algum detalhe."]
    };
    document.querySelector("#wizard-eyebrow").textContent = wizardState.mode === "edit" ? "Editar grupo" : "Adicionar convidados";
    document.querySelector("#wizard-title").textContent = titles[wizardState.step][0];
    document.querySelector("#wizard-subtitle").textContent = titles[wizardState.step][1];
    document.querySelectorAll("[data-wizard-step]").forEach(step => { step.hidden = Number(step.dataset.wizardStep) !== wizardState.step; });
    document.querySelectorAll("[data-progress-step]").forEach(item => {
        const number = Number(item.dataset.progressStep);
        item.classList.toggle("is-current", number === wizardState.step);
        item.classList.toggle("is-complete", number < wizardState.step);
        item.setAttribute("aria-current", number === wizardState.step ? "step" : "false");
    });
    document.querySelector("#wizard-progress-bar").style.width = `${(wizardState.step - 1) * 50}%`;
    document.querySelectorAll("[data-category]").forEach(card => {
        const selected = card.dataset.category === wizardState.draft.category;
        card.setAttribute("aria-checked", String(selected));
        card.setAttribute("aria-disabled", String(wizardState.mode === "edit" && !selected));
        card.disabled = wizardState.mode === "edit" && !selected;
    });
    wizardBack.hidden = wizardState.step === 1;
    document.querySelector("#cancel-guest-wizard").textContent = wizardState.mode === "edit" ? "Cancelar edição" : "Cancelar";
    wizardNext.textContent = wizardState.step === 3
        ? (wizardState.mode === "edit" ? "Salvar alterações" : "Adicionar à lista")
        : "Continuar";
    if (wizardState.step === 2) renderWizardFields();
    if (wizardState.step === 3) renderGuestReview();
    updateWizardNextState();
    document.querySelector("#wizard-content").scrollTop = 0;
}

function openGuestWizard(trigger) {
    wizardReturnFocus = trigger || document.activeElement;
    wizardState = createWizardState();
    renderWizard();
    wizardDialog.showModal();
    requestAnimationFrame(() => document.querySelector("[data-category]")?.focus());
}

function openGuestEdit(groupId, trigger) {
    const group = state.guests.find(item => item.id === groupId);
    if (!group) return;
    wizardReturnFocus = trigger || document.activeElement;
    wizardState = createWizardState();
    wizardState.mode = "edit";
    wizardState.step = 2;
    wizardState.editingId = group.id;
    wizardState.draft = structuredClone(group);
    if (group.category === "individual_group") {
        wizardState.originChoice = INDIVIDUAL_ORIGINS.includes(group.relationshipGroup) ? group.relationshipGroup : "Outros";
    }
    renderWizard();
    wizardDialog.showModal();
    requestAnimationFrame(() => focusControlNaturally(wizardFields.querySelector("input, select")));
}

function closeGuestWizard() {
    wizardState.dirty = false;
    wizardDialog.close();
    wizardReturnFocus?.focus?.();
}

function requestCloseGuestWizard() {
    if (!wizardState.dirty) {
        closeGuestWizard();
        return;
    }
    openGuestConfirmation({
        title: wizardState.mode === "edit" ? "Descartar alterações?" : "Sair sem adicionar?",
        message: "Os dados preenchidos neste modal ainda não foram salvos.",
        detail: "Você pode continuar de onde está ou descartar o que foi preenchido.",
        acceptLabel: "Descartar",
        onAccept: closeGuestWizard,
        returnFocus: document.querySelector("#cancel-guest-wizard")
    });
}

function selectGuestCategory(category) {
    if (!GUEST_CATEGORIES[category]) return;
    if (wizardState.mode === "edit" && wizardState.draft.category !== category) {
        showToast("A categoria do grupo é mantida durante a edição.");
        return;
    }
    if (wizardState.draft.category !== category) wizardState.draft = createEmptyGuestDraft(category);
    if (category === "godparents") wizardState.draft.name = "Padrinhos";
    if (category === "couples") wizardState.draft.name = "Casais";
    if (category === "individual_group") {
        wizardState.originChoice = "Amigos";
        wizardState.draft.name = "Amigos";
        wizardState.draft.relationshipGroup = "Amigos";
    }
    wizardState.dirty = true;
    renderWizard();
}

function ensureDraftCouple() {
    if (!wizardState.draft.couples.length) {
        wizardState.draft.couples.push({ id: makeGuestId("couple"), firstPersonName: "", secondPersonName: "" });
    }
    return wizardState.draft.couples[0];
}

function handleDraftField(field, value) {
    wizardState.dirty = true;
    if (field === "familyName") wizardState.draft.name = buildFamilyDisplayName(value);
    if (field === "originChoice") {
        wizardState.originChoice = value;
        if (value === "Outros") {
            wizardState.draft.name = "";
            wizardState.draft.relationshipGroup = "";
        } else {
            wizardState.draft.name = value;
            wizardState.draft.relationshipGroup = value;
        }
        renderWizardFields();
        requestAnimationFrame(() => focusControlNaturally(
            wizardFields.querySelector(value === "Outros" ? "#custom-group-name" : "#individual-origin")
        ));
    }
    if (field === "customGroup") {
        wizardState.draft.name = value;
        wizardState.draft.relationshipGroup = value;
    }
    if (field === "coupleFirst") ensureDraftCouple().firstPersonName = value;
    if (field === "coupleSecond") ensureDraftCouple().secondPersonName = value;
    updateWizardNextState();
}

function resetBuilder() {
    wizardState.buffer = { personName: "", firstPersonName: "", secondPersonName: "" };
    wizardState.editingEntry = null;
}

function addOrUpdatePerson(type) {
    const enteredName = cleanGuestText(wizardState.buffer.personName);
    if (!enteredName) {
        const error = document.querySelector("#builder-error");
        if (error) error.textContent = "Digite o nome antes de adicionar.";
        focusControlNaturally(wizardFields.querySelector("[data-buffer-field='personName']"));
        return;
    }
    const name = wizardState.draft.category === "family" && type === "members"
        ? buildFamilyMemberFullName(enteredName, wizardState.draft.name)
        : enteredName;
    const collection = wizardState.draft[type];
    if (wizardState.editingEntry?.type === type) {
        const person = collection.find(item => item.id === wizardState.editingEntry.id);
        if (person) person.name = name;
    } else {
        collection.push({ id: makeGuestId(type === "members" ? "member" : "godparent"), name });
    }
    wizardState.dirty = true;
    resetBuilder();
    renderWizardFields();
    updateWizardNextState();
    focusControlNaturally(wizardFields.querySelector("[data-buffer-field='personName']"));
}

function addOrUpdateCouple() {
    const firstPersonName = cleanGuestText(wizardState.buffer.firstPersonName);
    const secondPersonName = cleanGuestText(wizardState.buffer.secondPersonName);
    if (!firstPersonName || !secondPersonName) {
        const error = document.querySelector("#builder-error");
        if (error) error.textContent = "Preencha os dois nomes antes de adicionar o casal.";
        focusControlNaturally(wizardFields.querySelector("[data-buffer-field='firstPersonName']"));
        return;
    }
    if (wizardState.editingEntry?.type === "couples") {
        const couple = wizardState.draft.couples.find(item => item.id === wizardState.editingEntry.id);
        if (couple) Object.assign(couple, { firstPersonName, secondPersonName });
    } else {
        wizardState.draft.couples.push({ id: makeGuestId("couple"), firstPersonName, secondPersonName });
    }
    wizardState.dirty = true;
    resetBuilder();
    renderWizardFields();
    updateWizardNextState();
    focusControlNaturally(wizardFields.querySelector("[data-buffer-field='firstPersonName']"));
}

function editGuestEntry(type, id) {
    const collection = wizardState.draft[type];
    const item = collection.find(entry => entry.id === id);
    if (!item) return;
    wizardState.editingEntry = { type, id };
    wizardState.builderMode = type === "members" ? wizardState.builderMode : type;
    if (type === "couples") {
        wizardState.buffer.firstPersonName = item.firstPersonName;
        wizardState.buffer.secondPersonName = item.secondPersonName;
    } else {
        wizardState.buffer.personName = item.name;
    }
    renderWizardFields();
    focusControlNaturally(wizardFields.querySelector("[data-buffer-field]"));
}

function removeGuestEntry(type, id) {
    wizardState.draft[type] = wizardState.draft[type].filter(item => item.id !== id);
    if (wizardState.editingEntry?.id === id) resetBuilder();
    wizardState.dirty = true;
    renderWizardFields();
    updateWizardNextState();
}

function saveGuestDraft() {
    const savedGroup = normalizeStructuredGroup(wizardState.draft);
    if (wizardState.mode === "edit") {
        state.guests = state.guests.filter(group => group.id !== wizardState.editingId);
        const mergeTarget = savedGroup.category === "individual_group"
            ? state.guests.find(group => group.category === "individual_group" && comparableGuestText(group.name) === comparableGuestText(savedGroup.name))
            : null;
        if (mergeTarget) {
            mergeTarget.members.push(...savedGroup.members);
            mergeTarget.isClosed = mergeTarget.isClosed || savedGroup.isClosed;
        } else {
            state.guests.push(savedGroup);
        }
    } else if (["godparents", "couples"].includes(savedGroup.category)) {
        const existing = state.guests.find(group => group.category === savedGroup.category);
        if (existing) {
            existing.couples.push(...savedGroup.couples);
            existing.individuals.push(...savedGroup.individuals);
        } else {
            state.guests.unshift(savedGroup);
        }
    } else if (savedGroup.category === "individual_group") {
        const existing = state.guests.find(group => group.category === "individual_group" && comparableGuestText(group.name) === comparableGuestText(savedGroup.name));
        if (existing) existing.members.push(...savedGroup.members);
        else state.guests.unshift(savedGroup);
    } else {
        state.guests.unshift(savedGroup);
    }

    saveState();
    renderAll();
    wizardState.dirty = false;
    wizardDialog.close();
    wizardReturnFocus?.focus?.();
    showToast(wizardState.mode === "edit" ? "Alterações salvas." : "Convidados adicionados à lista.");
}

function goToWizardStep(step) {
    wizardState.step = Math.max(1, Math.min(3, step));
    renderWizard();
    requestAnimationFrame(() => {
        const target = wizardState.step === 1
            ? document.querySelector("[data-category][aria-checked='true']") || document.querySelector("[data-category]")
            : wizardState.step === 2
                ? wizardFields.querySelector("input, select, button")
                : document.querySelector("#guest-review");
        focusControlNaturally(target);
    });
}

function advanceGuestWizard() {
    if (wizardState.step === 1 && wizardState.draft.category) return goToWizardStep(2);
    if (wizardState.step === 2) {
        const errors = getDraftValidation();
        showDraftValidation(errors);
        if (!Object.keys(errors).length) goToWizardStep(3);
        return;
    }
    if (wizardState.step === 3) saveGuestDraft();
}

function getDetailsContent(group) {
    if (group.category === "godparents") {
        return `${group.couples.length ? `<section class="details-section"><h3>Casais</h3><ul class="details-list">${group.couples.map(couple => `<li>${escapeHtml(couple.firstPersonName)} e ${escapeHtml(couple.secondPersonName)}</li>`).join("")}</ul></section>` : ""}
            ${group.individuals.length ? `<section class="details-section"><h3>Avulsos</h3><ul class="details-list">${group.individuals.map(person => `<li>${escapeHtml(person.name)}</li>`).join("")}</ul></section>` : ""}`;
    }
    if (group.category === "couples") {
        return `<section class="details-section"><h3>Casais</h3><ul class="details-list">${group.couples.map(couple => `<li>${escapeHtml(couple.firstPersonName)} e ${escapeHtml(couple.secondPersonName)}</li>`).join("")}</ul></section>`;
    }
    return `<section class="details-section"><h3>${group.category === "family" ? "Integrantes" : "Convidados"}</h3><ul class="details-list">${group.members.map(person => `<li>${escapeHtml(person.name)}</li>`).join("")}</ul></section>`;
}

function renderGuestDetails(groupId) {
    const group = state.guests.find(item => item.id === groupId);
    if (!group) return;
    document.querySelector("#guest-details-category").textContent = `${GUEST_CATEGORIES[group.category].label} · ${group.isClosed ? "Fechado" : "Em aberto"}`;
    document.querySelector("#guest-details-title").textContent = group.name;
    document.querySelector("#guest-details-summary").textContent = `${pluralizeGuest(countGroupPeople(group), "pessoa", "pessoas")} · ${getGroupMeta(group)}`;
    document.querySelector("#guest-details-content").innerHTML = getDetailsContent(group);
    document.querySelector("#details-toggle-closed").textContent = group.isClosed ? "Reabrir" : "Fechar";
}

function openGuestDetails(groupId, trigger) {
    if (!state.guests.some(group => group.id === groupId)) return;
    currentDetailsGroupId = groupId;
    detailsReturnFocus = trigger || document.activeElement;
    renderGuestDetails(groupId);
    detailsDialog.showModal();
    requestAnimationFrame(() => document.querySelector("#close-guest-details").focus());
}

function closeGuestDetails() {
    detailsDialog.close();
    currentDetailsGroupId = null;
    detailsReturnFocus?.focus?.();
}

function renderCompleteListGroup(group) {
    const safeId = escapeHtml(group.id);
    return `
        <article class="complete-list-group">
            <header>
                <div>
                    <span class="category-label">${escapeHtml(GUEST_CATEGORIES[group.category].label)}</span>
                    <h3>${escapeHtml(group.name)}</h3>
                    <p>${pluralizeGuest(countGroupPeople(group), "pessoa", "pessoas")}</p>
                </div>
                ${group.isClosed ? '<span class="closed-badge"><span aria-hidden="true">✓</span> Fechado</span>' : ""}
            </header>
            <div class="complete-list-names">${getDetailsContent(group)}</div>
            <footer>
                <button class="button button-ghost button-small" data-complete-action="view" data-id="${safeId}" type="button">Abrir grupo</button>
                <button class="button button-text button-small" data-complete-action="edit" data-id="${safeId}" type="button">Editar grupo</button>
            </footer>
        </article>`;
}

function renderCompleteGuestList() {
    const totalPeople = countAllPeople(state.guests);
    const closedGroups = state.guests.filter(group => group.isClosed).length;
    const visibleGroups = filterGuestGroups(state.guests, completeListSearch.value, "all", "all");
    const hasSearch = Boolean(completeListSearch.value.trim());

    document.querySelector("#complete-list-summary").textContent = `${pluralizeGuest(totalPeople, "pessoa", "pessoas")} em ${pluralizeGuest(state.guests.length, "grupo", "grupos")}`;
    document.querySelector("#complete-list-stats").innerHTML = `
        <div><strong>${totalPeople}</strong><span>pessoas</span></div>
        <div><strong>${state.guests.length}</strong><span>grupos</span></div>
        <div><strong>${state.guests.length - closedGroups}</strong><span>em aberto</span></div>
        <div><strong>${closedGroups}</strong><span>fechados</span></div>`;
    document.querySelector("#complete-list-results").textContent = hasSearch
        ? pluralizeGuest(visibleGroups.length, "grupo encontrado", "grupos encontrados")
        : "";
    completeListContent.innerHTML = visibleGroups.length
        ? visibleGroups.map(renderCompleteListGroup).join("")
        : `<div class="complete-list-empty"><span aria-hidden="true">♡</span><p>${hasSearch ? "Nenhum grupo corresponde à busca." : "A lista ainda não possui convidados."}</p></div>`;
}

function openCompleteGuestList(trigger) {
    completeListReturnFocus = trigger || document.activeElement;
    completeListSearch.value = "";
    renderCompleteGuestList();
    completeListDialog.showModal();
    requestAnimationFrame(() => document.querySelector("#close-complete-guest-list").focus());
}

function closeCompleteGuestList(restoreFocus = true) {
    completeListDialog.close();
    if (restoreFocus) completeListReturnFocus?.focus?.();
}

function toggleGuestGroup(groupId) {
    const group = state.guests.find(item => item.id === groupId);
    if (!group) return;
    group.isClosed = !group.isClosed;
    saveState();
    renderAll();
    showToast(group.isClosed ? `“${group.name}” foi fechado.` : `“${group.name}” foi reaberto.`);
}

function openGuestConfirmation({ title, message, detail, acceptLabel, onAccept, returnFocus }) {
    pendingConfirmation = onAccept;
    confirmationReturnFocus = returnFocus || document.activeElement;
    document.querySelector("#confirm-title").textContent = title;
    document.querySelector("#confirm-message").textContent = message;
    document.querySelector("#confirm-detail").textContent = detail;
    document.querySelector("#confirm-accept").textContent = acceptLabel;
    confirmDialog.showModal();
    requestAnimationFrame(() => document.querySelector("#confirm-cancel").focus());
}

function closeGuestConfirmation() {
    pendingConfirmation = null;
    confirmDialog.close();
    confirmationReturnFocus?.focus?.();
}

function requestDeleteGuestGroup(groupId, trigger) {
    const group = state.guests.find(item => item.id === groupId);
    if (!group) return;
    openGuestConfirmation({
        title: "Excluir grupo?",
        message: `Tem certeza de que deseja excluir “${group.name}”?`,
        detail: "Todos os integrantes desse grupo serão removidos da lista.",
        acceptLabel: "Excluir grupo",
        returnFocus: trigger,
        onAccept: () => {
            state.guests = state.guests.filter(item => item.id !== group.id);
            saveState();
            if (detailsDialog.open) closeGuestDetails();
            renderAll();
            showToast("Grupo excluído com sucesso.");
        }
    });
}

function confirmGuestAction() {
    const action = pendingConfirmation;
    pendingConfirmation = null;
    confirmDialog.close();
    action?.();
}

function formatWeddingDateForPrint(value) {
    if (!value) return "";
    const date = typeof parseLocalDate === "function" ? parseLocalDate(value) : new Date(`${value}T00:00:00`);
    return date ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date) : "";
}

function renderPrintGroup(group, startNumber) {
    const closed = group.isClosed ? " · Fechado" : "";
    const header = `<h2>${escapeHtml(group.name)}</h2><p class="print-group-meta">${escapeHtml(GUEST_CATEGORIES[group.category].label)}${closed} · ${pluralizeGuest(countGroupPeople(group), "pessoa", "pessoas")}</p>`;
    let current = startNumber;
    let body = "";
    if (group.category === "godparents") {
        if (group.couples.length) {
            body += `<h3 class="print-subtitle">Casais</h3><ol start="${current}">${group.couples.map(couple => `<li>${escapeHtml(couple.firstPersonName)} e ${escapeHtml(couple.secondPersonName)}</li>`).join("")}</ol>`;
            current += group.couples.length;
        }
        if (group.individuals.length) {
            body += `<h3 class="print-subtitle">Avulsos</h3><ol start="${current}">${group.individuals.map(person => `<li>${escapeHtml(person.name)}</li>`).join("")}</ol>`;
            current += group.individuals.length;
        }
    } else if (group.category === "couples") {
        body = `<ol start="${current}">${group.couples.map(couple => `<li>${escapeHtml(couple.firstPersonName)} e ${escapeHtml(couple.secondPersonName)}</li>`).join("")}</ol>`;
        current += group.couples.length;
    } else {
        body = `<ol start="${current}">${group.members.map(person => `<li>${escapeHtml(person.name)}</li>`).join("")}</ol>`;
        current += group.members.length;
    }
    return { html: `<section class="print-group">${header}${body}</section>`, nextNumber: current };
}

function renderGuestPrintView() {
    const names = [state.settings.partnerOne, state.settings.partnerTwo].map(cleanGuestText).filter(Boolean);
    const title = names.length === 2 ? `${names[0]} & ${names[1]}` : names[0] || "Nosso Casamento";
    const weddingDate = formatWeddingDateForPrint(state.settings.weddingDate);
    const categoryOrder = ["godparents", "family", "couples", "individual_group"];
    const sortedGroups = [...state.guests].sort((a, b) => {
        const categoryDifference = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
        return categoryDifference || a.name.localeCompare(b.name, "pt-BR");
    });
    let number = 1;
    const sections = sortedGroups.map(group => {
        const rendered = renderPrintGroup(group, number);
        number = rendered.nextNumber;
        return rendered.html;
    }).join("");

    document.querySelector("#print-guest-list").innerHTML = `
        <header class="print-header">
            <p class="print-brand">${escapeHtml(title)}</p>
            <h1>Lista de convidados</h1>
            ${weddingDate ? `<p>${escapeHtml(weddingDate)}</p>` : ""}
        </header>
        ${sections || "<p>Nenhum convidado adicionado.</p>"}
        <p class="print-total">Total de convidados: ${pluralizeGuest(countAllPeople(state.guests), "pessoa", "pessoas")}</p>`;
}

function exportGuestsToPdf() {
    renderGuestPrintView();
    window.print();
}

document.querySelector("#open-guest-wizard").addEventListener("click", event => openGuestWizard(event.currentTarget));
document.querySelector("#open-complete-guest-list").addEventListener("click", event => openCompleteGuestList(event.currentTarget));
document.querySelector("#export-guests").addEventListener("click", exportGuestsToPdf);
guestSearch.addEventListener("input", renderGuests);
guestStateFilter.addEventListener("change", renderGuests);
guestCategoryFilter.addEventListener("change", renderGuests);

document.querySelector("#category-choices").addEventListener("click", event => {
    const choice = event.target.closest("[data-category]");
    if (choice) selectGuestCategory(choice.dataset.category);
});
document.querySelector("#category-choices").addEventListener("keydown", event => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
    if (wizardState.mode === "edit") return;
    const choices = [...document.querySelectorAll("[data-category]")];
    const currentIndex = choices.indexOf(event.target.closest("[data-category]"));
    if (currentIndex < 0) return;
    event.preventDefault();
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
    const nextChoice = choices[(currentIndex + direction + choices.length) % choices.length];
    nextChoice.focus();
    selectGuestCategory(nextChoice.dataset.category);
});

wizardFields.addEventListener("input", event => {
    const draftField = event.target.dataset.draftField;
    const bufferField = event.target.dataset.bufferField;
    if (draftField && event.target.tagName !== "SELECT") handleDraftField(draftField, event.target.value);
    if (bufferField) {
        wizardState.buffer[bufferField] = event.target.value;
        wizardState.dirty = true;
        updateWizardNextState();
    }
});
wizardFields.addEventListener("change", event => {
    if (event.target.tagName === "SELECT" && event.target.dataset.draftField) {
        handleDraftField(event.target.dataset.draftField, event.target.value);
    }
});
wizardFields.addEventListener("focusout", event => {
    if (event.target.dataset.draftField !== "familyName") return;
    const suffix = normalizeFamilyName(event.target.value);
    event.target.value = suffix;
    wizardState.draft.name = buildFamilyDisplayName(suffix);
});
wizardFields.addEventListener("click", event => {
    const modeButton = event.target.closest("[data-builder-mode]");
    if (modeButton) {
        wizardState.builderMode = modeButton.dataset.builderMode;
        resetBuilder();
        renderWizardFields();
        requestAnimationFrame(() => wizardFields.querySelector(`[data-builder-mode="${wizardState.builderMode}"]`)?.focus());
        updateWizardNextState();
        return;
    }
    const builderButton = event.target.closest("[data-builder-action]");
    if (builderButton?.dataset.builderAction === "add-person") addOrUpdatePerson(builderButton.dataset.entryType);
    if (builderButton?.dataset.builderAction === "add-couple") addOrUpdateCouple();
    const entryButton = event.target.closest("[data-entry-action]");
    if (entryButton?.dataset.entryAction === "edit") editGuestEntry(entryButton.dataset.entryType, entryButton.dataset.entryId);
    if (entryButton?.dataset.entryAction === "remove") removeGuestEntry(entryButton.dataset.entryType, entryButton.dataset.entryId);
});
wizardFields.addEventListener("keydown", event => {
    const modeButton = event.target.closest("[data-builder-mode]");
    if (modeButton && ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        const nextMode = modeButton.dataset.builderMode === "couples" ? "individuals" : "couples";
        wizardState.builderMode = nextMode;
        resetBuilder();
        renderWizardFields();
        wizardFields.querySelector(`[data-builder-mode="${nextMode}"]`)?.focus();
        updateWizardNextState();
        return;
    }
    if (event.key !== "Enter" || event.target.tagName === "SELECT") return;
    if (!event.target.dataset.bufferField) return;
    event.preventDefault();
    if (wizardState.draft.category === "godparents" && wizardState.builderMode === "couples") addOrUpdateCouple();
    else addOrUpdatePerson(wizardState.draft.category === "godparents" ? "individuals" : "members");
});

wizardNext.addEventListener("click", advanceGuestWizard);
wizardBack.addEventListener("click", () => goToWizardStep(wizardState.step - 1));
document.querySelector("#cancel-guest-wizard").addEventListener("click", requestCloseGuestWizard);
document.querySelector("#close-guest-wizard").addEventListener("click", requestCloseGuestWizard);
wizardDialog.addEventListener("cancel", event => { event.preventDefault(); requestCloseGuestWizard(); });
wizardDialog.addEventListener("click", event => { if (event.target === wizardDialog) requestCloseGuestWizard(); });

guestListElement.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (button) {
        if (button.dataset.action === "open-create") openGuestWizard(button);
        if (button.dataset.action === "view-group") openGuestDetails(button.dataset.id, button);
        if (button.dataset.action === "edit-group") openGuestEdit(button.dataset.id, button);
        if (button.dataset.action === "toggle-group") toggleGuestGroup(button.dataset.id);
        if (button.dataset.action === "delete-group") requestDeleteGuestGroup(button.dataset.id, button);
        return;
    }

});

document.querySelector("#close-guest-details").addEventListener("click", closeGuestDetails);
detailsDialog.addEventListener("click", event => { if (event.target === detailsDialog) closeGuestDetails(); });
detailsDialog.addEventListener("close", () => { currentDetailsGroupId = null; });
document.querySelector("#details-toggle-closed").addEventListener("click", () => toggleGuestGroup(currentDetailsGroupId));
document.querySelector("#details-edit").addEventListener("click", event => {
    const groupId = currentDetailsGroupId;
    const returnFocus = detailsReturnFocus;
    closeGuestDetails();
    openGuestEdit(groupId, returnFocus || event.currentTarget);
});
document.querySelector("#details-delete").addEventListener("click", event => requestDeleteGuestGroup(currentDetailsGroupId, event.currentTarget));

document.querySelector("#close-complete-guest-list").addEventListener("click", () => closeCompleteGuestList());
completeListDialog.addEventListener("cancel", event => { event.preventDefault(); closeCompleteGuestList(); });
completeListDialog.addEventListener("click", event => { if (event.target === completeListDialog) closeCompleteGuestList(); });
completeListSearch.addEventListener("input", renderCompleteGuestList);
completeListContent.addEventListener("click", event => {
    const button = event.target.closest("[data-complete-action]");
    if (!button) return;
    const returnFocus = completeListReturnFocus;
    closeCompleteGuestList(false);
    if (button.dataset.completeAction === "view") openGuestDetails(button.dataset.id, returnFocus);
    if (button.dataset.completeAction === "edit") openGuestEdit(button.dataset.id, returnFocus);
});

document.querySelector("#confirm-cancel").addEventListener("click", closeGuestConfirmation);
document.querySelector("#confirm-accept").addEventListener("click", confirmGuestAction);
confirmDialog.addEventListener("cancel", event => { event.preventDefault(); closeGuestConfirmation(); });
confirmDialog.addEventListener("click", event => { if (event.target === confirmDialog) closeGuestConfirmation(); });
window.addEventListener("beforeprint", renderGuestPrintView);

state.guests = normalizeGuestGroups(state.guests);
renderAll();
