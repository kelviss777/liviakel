const STORAGE_KEY = "nosso-casamento-v1";

const defaultState = {
    settings: { partnerOne: "", partnerTwo: "", weddingDate: "" },
    guests: [],
    venues: [],
    tasks: [],
    expenses: []
};

let state = loadState();
let activeTaskFilter = "all";

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return saved ? {
            settings: { ...defaultState.settings, ...saved.settings },
            guests: Array.isArray(saved.guests) ? saved.guests : [],
            venues: Array.isArray(saved.venues) ? saved.venues : [],
            tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
            expenses: Array.isArray(saved.expenses) ? saved.expenses : []
        } : structuredClone(defaultState);
    } catch {
        return structuredClone(defaultState);
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[char]);
}

function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
}

function parseLocalDate(value) {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function formatDate(value, fallback = "Sem prazo") {
    const date = parseLocalDate(value);
    return date ? new Intl.DateTimeFormat("pt-BR").format(date) : fallback;
}

function showToast(message) {
    const toast = document.querySelector("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2300);
}

function emptyState(message) {
    return `<div class="empty-state"><span>♡</span><p>${message}</p></div>`;
}

function navigate(pageId) {
    const titles = { inicio: "Visão geral", convidados: "Convidados", locais: "Locais", tarefas: "Checklist", orcamento: "Orçamento" };
    document.querySelectorAll(".page").forEach(page => page.classList.toggle("active", page.id === pageId));
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.page === pageId));
    document.querySelector("#page-title").textContent = titles[pageId];
    history.replaceState(null, "", `#${pageId}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSettings() {
    const { partnerOne, partnerTwo, weddingDate } = state.settings;
    const names = [partnerOne, partnerTwo].filter(Boolean);
    document.querySelector("#couple-title").textContent = names.length === 2 ? `${names[0]} & ${names[1]}` : names[0] || "Nosso grande dia";

    const date = parseLocalDate(weddingDate);
    const dateText = document.querySelector("#wedding-date-text");
    const daysElement = document.querySelector("#days-left");

    if (!date) {
        dateText.textContent = "Defina a data do casamento para começar a contagem.";
        daysElement.textContent = "—";
        return;
    }

    dateText.textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const difference = Math.ceil((date - today) / 86400000);
    daysElement.textContent = Math.max(0, difference);
}

function renderDashboard() {
    const confirmed = state.guests.filter(guest => guest.status === "confirmed").length;
    const done = state.tasks.filter(task => task.done).length;
    const taskPercent = state.tasks.length ? Math.round(done / state.tasks.length * 100) : 0;
    const total = state.expenses.reduce((sum, expense) => sum + Number(expense.value), 0);
    const paid = state.expenses.filter(expense => expense.paid).reduce((sum, expense) => sum + Number(expense.value), 0);

    document.querySelector("#stat-guests").textContent = state.guests.length;
    document.querySelector("#stat-confirmed").textContent = `${confirmed} confirmado${confirmed === 1 ? "" : "s"}`;
    document.querySelector("#stat-tasks").textContent = `${taskPercent}%`;
    document.querySelector("#stat-task-detail").textContent = `${done} de ${state.tasks.length} tarefas`;
    document.querySelector("#stat-budget").textContent = formatCurrency(total);
    document.querySelector("#stat-paid").textContent = `${formatCurrency(paid)} pagos`;
    document.querySelector("#progress-ring").style.setProperty("--progress", taskPercent);
    document.querySelector("#progress-value").textContent = `${taskPercent}%`;
    document.querySelector("#progress-message").textContent = state.tasks.length
        ? `${done} tarefa${done === 1 ? " concluída" : "s concluídas"}. ${state.tasks.length - done} ainda pela frente.`
        : "Adicione suas primeiras tarefas para acompanhar o progresso.";

    const upcoming = [...state.tasks]
        .filter(task => !task.done)
        .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))
        .slice(0, 4);
    document.querySelector("#upcoming-tasks").innerHTML = upcoming.length ? upcoming.map(task => `
        <div class="compact-item">
            <span class="compact-check"></span>
            <div><strong>${escapeHtml(task.name)}</strong><small>${formatDate(task.date)}</small></div>
            <span class="tag">${escapeHtml(task.category)}</span>
        </div>`).join("") : emptyState("Nenhuma tarefa pendente por aqui.");
}

function renderGuests() {
    const search = document.querySelector("#guest-search").value.trim().toLocaleLowerCase("pt-BR");
    const filter = document.querySelector("#guest-filter").value;
    const statusLabel = { confirmed: "Confirmado", pending: "Aguardando", declined: "Não vai" };
    const guests = state.guests.filter(guest =>
        guest.name.toLocaleLowerCase("pt-BR").includes(search) && (filter === "all" || guest.status === filter)
    );

    document.querySelector("#guest-list").innerHTML = guests.length ? guests.map(guest => `
        <div class="data-row">
            <div class="data-primary"><strong>${escapeHtml(guest.name)}</strong><small>Convidado</small></div>
            <span class="data-cell">${escapeHtml(guest.group)}</span>
            <button class="status ${guest.status}" data-action="cycle-guest" data-id="${guest.id}" type="button" title="Clique para alterar">${statusLabel[guest.status]}</button>
            <button class="delete-button" data-action="delete-guest" data-id="${guest.id}" type="button" aria-label="Excluir ${escapeHtml(guest.name)}">×</button>
        </div>`).join("") : emptyState(search || filter !== "all" ? "Nenhum convidado encontrado." : "Sua lista de convidados começa aqui.");
}

function renderTasks() {
    const tasks = state.tasks.filter(task => activeTaskFilter === "all" || (activeTaskFilter === "done" ? task.done : !task.done));
    document.querySelector("#task-list").innerHTML = tasks.length ? tasks.map(task => `
        <div class="data-row task-row ${task.done ? "completed" : ""}">
            <button class="task-toggle ${task.done ? "done" : ""}" data-action="toggle-task" data-id="${task.id}" type="button" aria-label="${task.done ? "Reabrir" : "Concluir"} tarefa">${task.done ? "✓" : ""}</button>
            <div class="data-primary"><strong>${escapeHtml(task.name)}</strong><small>${escapeHtml(task.category)}</small></div>
            <span class="data-cell">${formatDate(task.date)}</span>
            <span class="status ${task.done ? "confirmed" : "pending"}">${task.done ? "Concluída" : "Pendente"}</span>
            <button class="delete-button" data-action="delete-task" data-id="${task.id}" type="button" aria-label="Excluir ${escapeHtml(task.name)}">×</button>
        </div>`).join("") : emptyState("Nenhuma tarefa nesta categoria.");
}

function renderVenues() {
    const venues = [...state.venues].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, "pt-BR"));

    document.querySelector("#venue-list").innerHTML = venues.length ? venues.map(venue => {
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`;
        return `
            <article class="venue-card ${venue.favorite ? "favorite" : ""}">
                <div class="venue-card-top">
                    <span class="venue-type">${escapeHtml(venue.type)}</span>
                    <button class="favorite-button ${venue.favorite ? "active" : ""}" data-action="toggle-favorite" data-id="${venue.id}" type="button" aria-label="${venue.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}" title="${venue.favorite ? "Remover dos favoritos" : "Favoritar"}">★</button>
                </div>
                <h3>${escapeHtml(venue.name)}</h3>
                <a class="venue-address" href="${mapUrl}" target="_blank" rel="noopener noreferrer" title="Abrir no Google Maps">
                    <span>⌖</span> ${escapeHtml(venue.address)}
                </a>
                <div class="venue-card-footer">
                    <span class="favorite-label ${venue.favorite ? "" : "muted"}">${venue.favorite ? "Nosso favorito" : "Em avaliação"}</span>
                    <button class="delete-button" data-action="delete-venue" data-id="${venue.id}" type="button" aria-label="Excluir ${escapeHtml(venue.name)}">×</button>
                </div>
            </article>`;
    }).join("") : emptyState("Adicione o primeiro local que vocês estão considerando.");
}

function renderExpenses() {
    const total = state.expenses.reduce((sum, expense) => sum + Number(expense.value), 0);
    const paid = state.expenses.filter(expense => expense.paid).reduce((sum, expense) => sum + Number(expense.value), 0);
    document.querySelector("#budget-total").textContent = formatCurrency(total);
    document.querySelector("#budget-paid").textContent = formatCurrency(paid);
    document.querySelector("#budget-remaining").textContent = formatCurrency(total - paid);

    document.querySelector("#expense-list").innerHTML = state.expenses.length ? state.expenses.map(expense => `
        <div class="data-row">
            <div class="data-primary"><strong>${escapeHtml(expense.name)}</strong><small>${escapeHtml(expense.category)}</small></div>
            <span class="data-cell">${formatCurrency(expense.value)}</span>
            <button class="status ${expense.paid ? "paid" : "pending"}" data-action="toggle-paid" data-id="${expense.id}" type="button" title="Clique para alterar">${expense.paid ? "Pago" : "Pendente"}</button>
            <button class="delete-button" data-action="delete-expense" data-id="${expense.id}" type="button" aria-label="Excluir ${escapeHtml(expense.name)}">×</button>
        </div>`).join("") : emptyState("Nenhum gasto registrado ainda.");
}

function renderAll() {
    renderSettings();
    renderDashboard();
    renderGuests();
    renderVenues();
    renderTasks();
    renderExpenses();
}

document.querySelectorAll(".nav-item").forEach(item => item.addEventListener("click", () => navigate(item.dataset.page)));
document.querySelectorAll("[data-go-to]").forEach(item => item.addEventListener("click", () => navigate(item.dataset.goTo)));
document.querySelectorAll("[data-toggle-form]").forEach(button => button.addEventListener("click", () => {
    const card = document.querySelector(`#${button.dataset.toggleForm}`);
    card.classList.toggle("hidden");
    if (!card.classList.contains("hidden")) card.querySelector("input")?.focus();
}));

document.querySelector("#guest-form").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    state.guests.unshift({ id: makeId(), name: data.get("name").trim(), group: data.get("group"), status: data.get("status") });
    saveState(); renderAll(); event.currentTarget.reset();
    document.querySelector("#guest-form-card").classList.add("hidden");
    showToast("Convidado adicionado.");
});

document.querySelector("#task-form").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    state.tasks.unshift({ id: makeId(), name: data.get("name").trim(), category: data.get("category"), date: data.get("date"), done: false });
    saveState(); renderAll(); event.currentTarget.reset();
    document.querySelector("#task-form-card").classList.add("hidden");
    showToast("Tarefa adicionada.");
});

document.querySelector("#venue-form").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    state.venues.unshift({
        id: makeId(),
        name: data.get("name").trim(),
        type: data.get("type"),
        address: data.get("address").trim(),
        favorite: false
    });
    saveState(); renderAll(); event.currentTarget.reset();
    document.querySelector("#venue-form-card").classList.add("hidden");
    showToast("Local adicionado.");
});

document.querySelector("#expense-form").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    state.expenses.unshift({ id: makeId(), name: data.get("name").trim(), category: data.get("category"), value: Number(data.get("value")), paid: data.has("paid") });
    saveState(); renderAll(); event.currentTarget.reset();
    document.querySelector("#expense-form-card").classList.add("hidden");
    showToast("Gasto adicionado.");
});

document.querySelector("#guest-search").addEventListener("input", renderGuests);
document.querySelector("#guest-filter").addEventListener("change", renderGuests);

document.querySelector("#task-filters").addEventListener("click", event => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    activeTaskFilter = button.dataset.filter;
    document.querySelectorAll("#task-filters button").forEach(item => item.classList.toggle("active", item === button));
    renderTasks();
});

document.body.addEventListener("click", event => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const { action, id } = actionButton.dataset;

    if (action === "delete-guest") state.guests = state.guests.filter(item => item.id !== id);
    if (action === "cycle-guest") {
        const order = ["pending", "confirmed", "declined"];
        const guest = state.guests.find(item => item.id === id);
        guest.status = order[(order.indexOf(guest.status) + 1) % order.length];
    }
    if (action === "toggle-task") state.tasks.find(item => item.id === id).done = !state.tasks.find(item => item.id === id).done;
    if (action === "delete-task") state.tasks = state.tasks.filter(item => item.id !== id);
    if (action === "toggle-favorite") state.venues.find(item => item.id === id).favorite = !state.venues.find(item => item.id === id).favorite;
    if (action === "delete-venue") state.venues = state.venues.filter(item => item.id !== id);
    if (action === "toggle-paid") state.expenses.find(item => item.id === id).paid = !state.expenses.find(item => item.id === id).paid;
    if (action === "delete-expense") state.expenses = state.expenses.filter(item => item.id !== id);

    saveState();
    renderAll();
});

const settingsDialog = document.querySelector("#settings-dialog");
document.querySelector("#open-settings").addEventListener("click", () => {
    document.querySelector("#partner-one").value = state.settings.partnerOne;
    document.querySelector("#partner-two").value = state.settings.partnerTwo;
    document.querySelector("#wedding-date").value = state.settings.weddingDate;
    settingsDialog.showModal();
});
document.querySelector("#close-settings").addEventListener("click", () => settingsDialog.close());
settingsDialog.addEventListener("click", event => {
    if (event.target === settingsDialog) settingsDialog.close();
});
document.querySelector("#settings-form").addEventListener("submit", event => {
    const data = new FormData(event.currentTarget);
    state.settings = { partnerOne: data.get("partnerOne").trim(), partnerTwo: data.get("partnerTwo").trim(), weddingDate: data.get("weddingDate") };
    saveState(); renderAll(); showToast("Informações atualizadas.");
});

const initialPage = location.hash.slice(1);
navigate(["inicio", "convidados", "locais", "tarefas", "orcamento"].includes(initialPage) ? initialPage : "inicio");
renderAll();
