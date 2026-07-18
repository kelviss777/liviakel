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

function renderAll() {
    renderSettings();
    renderDashboard();
}

document.querySelectorAll("[data-go-to]").forEach(item => item.addEventListener("click", () => navigate(item.dataset.goTo)));

renderAll();
