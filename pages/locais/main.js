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

function renderAll() {
    renderVenues();
}

document.querySelectorAll("[data-toggle-form]").forEach(button => button.addEventListener("click", () => {
    const card = document.querySelector(`#${button.dataset.toggleForm}`);
    card.classList.toggle("hidden");
    if (!card.classList.contains("hidden")) card.querySelector("input")?.focus();
}));

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

document.body.addEventListener("click", event => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const { action, id } = actionButton.dataset;

    if (action === "toggle-favorite") state.venues.find(item => item.id === id).favorite = !state.venues.find(item => item.id === id).favorite;
    if (action === "delete-venue") state.venues = state.venues.filter(item => item.id !== id);

    saveState();
    renderAll();
});

renderAll();
