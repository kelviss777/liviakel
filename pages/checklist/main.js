let activeTaskFilter = "all";

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

function renderAll() {
    renderTasks();
}

document.querySelectorAll("[data-toggle-form]").forEach(button => button.addEventListener("click", () => {
    const card = document.querySelector(`#${button.dataset.toggleForm}`);
    card.classList.toggle("hidden");
    if (!card.classList.contains("hidden")) card.querySelector("input")?.focus();
}));

document.querySelector("#task-form").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    state.tasks.unshift({ id: makeId(), name: data.get("name").trim(), category: data.get("category"), date: data.get("date"), done: false });
    saveState(); renderAll(); event.currentTarget.reset();
    document.querySelector("#task-form-card").classList.add("hidden");
    showToast("Tarefa adicionada.");
});

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

    if (action === "toggle-task") state.tasks.find(item => item.id === id).done = !state.tasks.find(item => item.id === id).done;
    if (action === "delete-task") state.tasks = state.tasks.filter(item => item.id !== id);

    saveState();
    renderAll();
});

renderAll();
