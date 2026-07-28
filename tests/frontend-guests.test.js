const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const guestSource = fs.readFileSync(path.join(projectRoot, "pages", "convidados", "main.js"), "utf8");
const guestHtml = fs.readFileSync(path.join(projectRoot, "pages", "convidados", "index.html"), "utf8");
const guestCss = fs.readFileSync(path.join(projectRoot, "pages", "convidados", "style.css"), "utf8");
const guestLogicSource = guestSource.slice(0, guestSource.indexOf("const guestListElement"));

function loadGuestLogic() {
    let id = 0;
    const context = vm.createContext({
        Date,
        Math,
        Object,
        String,
        Array,
        Intl,
        makeId() {
            id += 1;
            return `test-${id}`;
        }
    });
    vm.runInContext(guestLogicSource, context);
    return context;
}

function read(context, expression) {
    return JSON.parse(JSON.stringify(vm.runInContext(expression, context)));
}

test("normaliza convidados antigos por grupo sem perder nomes ou IDs", () => {
    const context = loadGuestLogic();
    context.rawGuests = [
        { id: "old-1", name: " Ana Silva ", group: " Igreja ", status: "confirmed" },
        { id: "old-2", name: "Bruno", guest_group: "igreja", status: "pending" },
        { id: "old-3", name: "Carla", group: " Trabalho " }
    ];

    const groups = read(context, "normalizeGuestGroups(rawGuests)");

    assert.equal(groups.length, 2);
    assert.equal(groups[0].category, "individual_group");
    assert.equal(groups[0].name, "Igreja");
    assert.deepEqual(groups[0].members, [
        { id: "old-1", name: "Ana Silva" },
        { id: "old-2", name: "Bruno" }
    ]);
    assert.equal(Object.hasOwn(groups[0], "status"), false);
    assert.deepEqual(groups[1].members, [{ id: "old-3", name: "Carla" }]);
});

test("conta pessoas reais em famílias, casais e padrinhos", () => {
    const context = loadGuestLogic();
    context.groups = [
        { category: "family", members: [{}, {}, {}] },
        { category: "couples", couples: [{}, {}] },
        { category: "godparents", couples: [{}, {}, {}], individuals: [{}, {}] },
        { category: "individual_group", members: [{}, {}] }
    ];

    assert.equal(vm.runInContext("countGroupPeople(groups[0])", context), 3);
    assert.equal(vm.runInContext("countGroupPeople(groups[1])", context), 4);
    assert.equal(vm.runInContext("countGroupPeople(groups[2])", context), 8);
    assert.equal(vm.runInContext("countAllPeople(groups)", context), 17);
});

test("monta nomes de família sem prefixos duplicados", () => {
    const context = loadGuestLogic();

    assert.equal(vm.runInContext("extractFamilyNameSuffix('Família Silva')", context), "Silva");
    assert.equal(vm.runInContext("extractFamilyNameSuffix('familia   Família  Oliveira')", context), "Oliveira");
    assert.equal(vm.runInContext("buildFamilyDisplayName(' Silva Oliveira ')", context), "Família Silva Oliveira");
    assert.equal(vm.runInContext("buildFamilyDisplayName('Família Família Silva')", context), "Família Silva");
    assert.equal(vm.runInContext("normalizeFamilyName('Família')", context), "");
});

test("completa sobrenome familiar sem duplicar nomes simples ou compostos", () => {
    const context = loadGuestLogic();
    const cases = [
        ["Eduardo", "Família Oliveira", "Eduardo Oliveira"],
        ["Eduardo Oliveira", "Família Oliveira", "Eduardo Oliveira"],
        ["Eduardo Oliveira Oliveira", "Família Oliveira", "Eduardo Oliveira"],
        ["Ana Clara", "Família Santos", "Ana Clara Santos"],
        ["Ana Clara Santos", "Família Santos", "Ana Clara Santos"],
        ["João", "Família Silva Oliveira", "João Silva Oliveira"],
        ["João Silva", "Família Silva Oliveira", "João Silva Oliveira"],
        ["João Silva Silva", "Família Silva Oliveira", "João Silva Oliveira"],
        ["João Oliveira", "Família Silva Oliveira", "João Oliveira"],
        ["João Oliveira Oliveira", "Família Silva Oliveira", "João Oliveira"],
        ["Clara", "Família dos Santos", "Clara dos Santos"],
        ["Clara dos Santos dos Santos", "Família dos Santos", "Clara dos Santos"]
    ];

    for (const [member, family, expected] of cases) {
        context.member = member;
        context.family = family;
        assert.equal(vm.runInContext("buildFamilyMemberFullName(member, family)", context), expected);
    }
});

test("normaliza família antiga preservando IDs, fechamento e capitalização do complemento", () => {
    const context = loadGuestLogic();
    context.oldFamily = {
        schemaVersion: 2,
        id: "family-old",
        category: "family",
        name: "familia silva",
        isClosed: true,
        members: [{ id: "member-old", name: "Eduardo" }]
    };

    const family = read(context, "normalizeStructuredGroup(oldFamily)");
    assert.equal(family.id, "family-old");
    assert.equal(family.name, "Família silva");
    assert.equal(family.isClosed, true);
    assert.deepEqual(family.members, [{ id: "member-old", name: "Eduardo silva" }]);
});

test("foco programático mantém campos vazios e leva o cursor ao fim de valores editados", () => {
    const context = loadGuestLogic();
    const filledControl = {
        tagName: "INPUT",
        type: "text",
        value: "Silva",
        focused: false,
        selection: null,
        focus(options) {
            this.focused = options.preventScroll;
        },
        setSelectionRange(start, end) {
            this.selection = [start, end];
        }
    };
    const emptyControl = {
        ...filledControl,
        value: "",
        focused: false,
        selection: null
    };
    context.filledControl = filledControl;
    context.emptyControl = emptyControl;

    vm.runInContext("focusControlNaturally(filledControl); focusControlNaturally(emptyControl)", context);

    assert.equal(filledControl.focused, true);
    assert.deepEqual(filledControl.selection, [5, 5]);
    assert.equal(emptyControl.focused, true);
    assert.equal(emptyControl.selection, null);
});

test("busca encontra grupo, origem, integrante e nomes de casal", () => {
    const context = loadGuestLogic();
    context.groups = [{
        category: "family",
        name: "Família Silva",
        relationshipGroup: "",
        isClosed: false,
        members: [{ name: "Márcia Silva" }],
        couples: [],
        individuals: []
    }, {
        category: "couples",
        name: "Casais",
        relationshipGroup: "",
        isClosed: true,
        members: [],
        couples: [{ firstPersonName: "João", secondPersonName: "Lívia" }],
        individuals: []
    }, {
        category: "individual_group",
        name: "Igreja",
        relationshipGroup: "Igreja",
        isClosed: false,
        members: [{ name: "Carlos" }],
        couples: [],
        individuals: []
    }];

    assert.deepEqual(read(context, "filterGuestGroups(groups, 'marcia', 'all', 'all').map(group => group.name)"), ["Família Silva"]);
    assert.deepEqual(read(context, "filterGuestGroups(groups, 'familia', 'all', 'all').map(group => group.name)"), ["Família Silva"]);
    assert.deepEqual(read(context, "filterGuestGroups(groups, 'livia', 'all', 'all').map(group => group.name)"), ["Casais"]);
    assert.deepEqual(read(context, "filterGuestGroups(groups, 'igreja', 'open', 'individual_group').map(group => group.name)"), ["Igreja"]);
    assert.deepEqual(read(context, "filterGuestGroups(groups, '', 'closed', 'all').map(group => group.name)"), ["Casais"]);
});

test("consolida grupos equivalentes e preserva o estado fechado", () => {
    const context = loadGuestLogic();
    context.rawGroups = [{
        schemaVersion: 2,
        id: "one",
        category: "individual_group",
        name: "  Faculdade ",
        relationshipGroup: "  Faculdade ",
        isClosed: true,
        members: [{ id: "p1", name: "Ana" }]
    }, {
        schemaVersion: 2,
        id: "two",
        category: "individual_group",
        name: "faculdade",
        relationshipGroup: "faculdade",
        isClosed: false,
        members: [{ id: "p2", name: "Bia" }]
    }];

    const groups = read(context, "normalizeGuestGroups(rawGroups)");
    assert.equal(groups.length, 1);
    assert.equal(groups[0].name, "Faculdade");
    assert.equal(groups[0].isClosed, true);
    assert.deepEqual(groups[0].members.map(member => member.id), ["p1", "p2"]);
});

test("interface remove presença e oferece fluxo, detalhes, filtros e confirmação próprios", () => {
    assert.match(guestHtml, /\+ Adicionar convidados/);
    assert.match(guestHtml, /id="guest-wizard-dialog"/);
    assert.match(guestHtml, /data-wizard-step="1"/);
    assert.match(guestHtml, /data-wizard-step="2"/);
    assert.match(guestHtml, /data-wizard-step="3"/);
    assert.match(guestHtml, /role="radiogroup"/);
    assert.match(guestHtml, /id="guest-details-dialog"/);
    assert.match(guestHtml, /id="complete-guest-list-dialog"/);
    assert.match(guestHtml, /Ver lista completa/);
    assert.match(guestHtml, /id="guest-confirm-dialog"/);
    assert.match(guestHtml, /Exportar em PDF/);
    assert.match(guestHtml, /Todas as categorias/);
    assert.doesNotMatch(guestHtml, /Aguardando|Confirmado|Recusado|guest-status|filtro por status/i);
    assert.doesNotMatch(guestSource, /window\.confirm/);
});

test("família usa prefixo fixo, complemento editável e foco estável", () => {
    assert.match(guestSource, /class="family-name-prefix" aria-hidden="true">Família<\/span>/);
    assert.match(guestSource, /placeholder="Ex\.: Silva"/);
    assert.doesNotMatch(guestSource, /placeholder="Ex\.: Família Silva"/);
    assert.match(guestSource, /value="\$\{escapeHtml\(familySuffix\)\}"/);
    assert.match(guestSource, /function focusControlNaturally\(control\)/);
    assert.match(guestSource, /setSelectionRange\?\.\(end, end\)/);
    assert.match(guestSource, /draftField && event\.target\.tagName !== "SELECT"/);
    assert.match(guestSource, /wizardFields\.addEventListener\("focusout"/);
    assert.match(guestCss, /\.family-name-control/);
    assert.match(guestCss, /\.family-name-prefix/);
});

test("lista completa usa a contagem central, mostra nomes e preserva grupos fechados", () => {
    assert.match(guestSource, /function renderCompleteGuestList\(\)/);
    assert.match(guestSource, /const totalPeople = countAllPeople\(state\.guests\)/);
    assert.match(guestSource, /visibleGroups\.map\(renderCompleteListGroup\)/);
    assert.match(guestSource, /getDetailsContent\(group\)/);
    assert.match(guestSource, /group\.isClosed \? '<span class="closed-badge/);
    assert.match(guestSource, /data-complete-action="view"/);
    assert.match(guestSource, /data-complete-action="edit"/);
    assert.match(guestCss, /\.complete-guest-list-dialog/);
});

test("cartão inteiro usa botão nativo para clique, Enter e Espaço sem conflitar com ações", () => {
    assert.match(guestSource, /<button class="card-open-surface" data-action="view-group"/);
    assert.match(guestSource, /const button = event\.target\.closest\("\[data-action\]"\)/);
    assert.match(guestSource, /if \(button\) \{[\s\S]*?if \(button\.dataset\.action === "edit-group"\)[\s\S]*?return;/);
    assert.doesNotMatch(guestSource, /touchstart/);
    assert.match(guestCss, /\.card-open-surface:focus-visible/);
    assert.match(guestCss, /\.card-actions \{[^}]*pointer-events: none/);
    assert.match(guestCss, /\.card-action \{ pointer-events: auto; \}/);
    assert.match(guestCss, /\.guest-card:active/);
});

test("estilos cobrem cartões fechados, celular, impressão e movimento reduzido", () => {
    assert.match(guestCss, /\.guest-card\.is-closed/);
    assert.match(guestCss, /\.closed-badge/);
    assert.match(guestCss, /@media \(max-width: 580px\)/);
    assert.match(guestCss, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(guestCss, /@media print/);
    assert.match(guestCss, /\.app-shell, dialog, \.toast \{ display: none !important; \}/);
});

test("persistência continua local e não chama Supabase ou backend", () => {
    assert.match(guestSource, /saveState\(\)/);
    assert.doesNotMatch(guestSource, /supabase|fetch\(|XMLHttpRequest|createCurrentWeddingGuest|updateCurrentWeddingGuest/i);
    assert.match(guestSource, /state\.guests = normalizeGuestGroups\(state\.guests\)/);
    assert.doesNotMatch(guestSource, /state\.guests = normalizeGuestGroups\(state\.guests\);\s*saveState\(\)/);
});
