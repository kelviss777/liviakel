const pageRoutes = {
    inicio: "../visao-geral/index.html",
    convidados: "../convidados/index.html",
    locais: "../locais/index.html",
    tarefas: "../checklist/index.html",
    orcamento: "../orcamento/index.html"
};

function navigate(pageId) {
    window.location.href = pageRoutes[pageId];
}

async function loadSidebar() {
    const sidebar = document.querySelector("#sidebar-container");
    const response = await fetch("../../components/sidebar.html");
    sidebar.innerHTML = await response.text();

    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item.dataset.page === document.body.dataset.page);
        item.addEventListener("click", () => navigate(item.dataset.page));
    });
}

loadSidebar();
