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

function renderAll() {
    renderGuests();
}

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

document.querySelector("#guest-search").addEventListener("input", renderGuests);
document.querySelector("#guest-filter").addEventListener("change", renderGuests);

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

    saveState();
    renderAll();
});

renderAll();
