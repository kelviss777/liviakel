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
    renderExpenses();
}

document.querySelectorAll("[data-toggle-form]").forEach(button => button.addEventListener("click", () => {
    const card = document.querySelector(`#${button.dataset.toggleForm}`);
    card.classList.toggle("hidden");
    if (!card.classList.contains("hidden")) card.querySelector("input")?.focus();
}));

document.querySelector("#expense-form").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    state.expenses.unshift({ id: makeId(), name: data.get("name").trim(), category: data.get("category"), value: Number(data.get("value")), paid: data.has("paid") });
    saveState(); renderAll(); event.currentTarget.reset();
    document.querySelector("#expense-form-card").classList.add("hidden");
    showToast("Gasto adicionado.");
});

document.body.addEventListener("click", event => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const { action, id } = actionButton.dataset;

    if (action === "toggle-paid") state.expenses.find(item => item.id === id).paid = !state.expenses.find(item => item.id === id).paid;
    if (action === "delete-expense") state.expenses = state.expenses.filter(item => item.id !== id);

    saveState();
    renderAll();
});

renderAll();
