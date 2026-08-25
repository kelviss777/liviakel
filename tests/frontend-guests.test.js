const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const guestSource = fs.readFileSync(path.join(projectRoot, "pages", "convidados", "main.js"), "utf8");
const guestHtml = fs.readFileSync(path.join(projectRoot, "pages", "convidados", "index.html"), "utf8");
const guestCss = fs.readFileSync(path.join(projectRoot, "pages", "convidados", "style.css"), "utf8");
const guestDocumentation = fs.readFileSync(path.join(projectRoot, "DOCUMENTACAO-CONVIDADOS.md"), "utf8");
const supabaseSource = fs.readFileSync(path.join(projectRoot, "js", "supabase.js"), "utf8");
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

function loadGuestSupabaseLogic() {
    const context = vm.createContext({
        console,
        URL,
        Object,
        Number,
        String,
        Boolean,
        Set,
        Map,
        Error,
        window: { supabase: { createClient() { return {}; } } },
        document: { createElement: () => ({}), head: { appendChild() {} } }
    });
    vm.runInContext(supabaseSource, context);
    return context;
}

function createGuestSupabaseClient({ groupRows = [], memberRows = [], errors = {} } = {}) {
    const calls = [];
    let generatedMember = 0;
    const clone = value => value === undefined ? undefined : structuredClone(value);

    function builderFor(table) {
        const query = { table, operation: "list", payload: null, filters: [], inFilters: [], orders: [] };
        const builder = {
            select() { return this; },
            insert(payload) { query.operation = "insert"; query.payload = clone(payload); return this; },
            update(payload) { query.operation = "update"; query.payload = clone(payload); return this; },
            delete() { query.operation = "delete"; return this; },
            eq(column, value) { query.filters.push({ column, value }); return this; },
            in(column, values) { query.inFilters.push({ column, values: clone(values) }); return this; },
            order(column, options) { query.orders.push({ column, options: clone(options) }); return this; },
            async maybeSingle() {
                calls.push(clone(query));
                const error = errors[`${table}:${query.operation}`] || null;
                if (error) return { data: null, error };
                const id = query.filters.find(filter => filter.column === "id")?.value;
                if (table === "guest_groups" && query.operation === "insert") {
                    return { data: { id: "11111111-1111-4111-8111-111111111111", ...clone(query.payload) }, error: null };
                }
                if (table === "guest_groups" && query.operation === "update") {
                    return { data: { ...(groupRows.find(row => row.id === id) || {}), id, ...clone(query.payload) }, error: null };
                }
                if (query.operation === "delete") return { data: { id }, error: null };
                const rows = table === "guest_groups" ? groupRows : memberRows;
                return { data: clone(rows.find(row => row.id === id) || null), error: null };
            },
            then(resolve, reject) {
                calls.push(clone(query));
                const error = errors[`${table}:${query.operation}`] || null;
                if (error) return Promise.resolve({ data: null, error }).then(resolve, reject);
                let data;
                if (query.operation === "insert") {
                    const payloads = Array.isArray(query.payload) ? query.payload : [query.payload];
                    data = payloads.map(payload => ({ id: `member-${++generatedMember}`, ...clone(payload) }));
                } else {
                    data = clone(table === "guest_groups" ? groupRows : memberRows);
                }
                return Promise.resolve({ data, error: null }).then(resolve, reject);
            }
        };
        return builder;
    }

    return {
        calls,
        auth: { async getUser() { return { data: { user: { id: "user-1" } }, error: null }; } },
        from(table) {
            if (table === "wedding_members") {
                return {
                    select() { return this; },
                    eq() { return this; },
                    async limit() { return { data: [{ wedding_id: "wedding-1" }], error: null }; }
                };
            }
            if (["guest_groups", "guest_members"].includes(table)) return builderFor(table);
            throw new Error(`Tabela inesperada: ${table}`);
        }
    };
}

function loadGuestSupabaseWithClient(client) {
    const context = vm.createContext({
        console, URL, Object, Number, String, Boolean, Set, Map, Error,
        window: { supabase: { createClient: () => client } },
        document: { createElement: () => ({}), head: { appendChild() {} } }
    });
    vm.runInContext(supabaseSource, context);
    return context;
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
        { id: "old-1", name: "Ana Silva", notes: "", isChild: false },
        { id: "old-2", name: "Bruno", notes: "", isChild: false }
    ]);
    assert.equal(Object.hasOwn(groups[0], "status"), false);
    assert.deepEqual(groups[1].members, [{ id: "old-3", name: "Carla", notes: "", isChild: false }]);
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
    assert.deepEqual(family.members, [{ id: "member-old", name: "Eduardo silva", notes: "", isChild: false }]);
});

test("normaliza casal antigo como dois adultos e ignora classificações infantis incorretas", () => {
    const context = loadGuestLogic();
    context.oldCouple = {
        id: "pair-old",
        firstPersonName: "João",
        secondPersonName: "Maria",
        firstPersonIsChild: true,
        secondPersonIsChild: true
    };

    const couple = read(context, "normalizeCouple(oldCouple)");
    assert.deepEqual(couple, {
        id: "pair-old",
        firstPerson: { id: "pair-old-first", name: "João", notes: "" },
        secondPerson: { id: "pair-old-second", name: "Maria", notes: "" },
        children: []
    });
});

test("normaliza crianças vinculadas ao casal com IDs próprios e isChild verdadeiro", () => {
    const context = loadGuestLogic();
    context.coupleWithChildren = {
        id: "pair-children",
        firstPerson: { id: "adult-1", name: " João ", isChild: true },
        secondPerson: { id: "adult-2", name: " Maria ", isChild: true },
        children: [{ id: "child-1", name: " Pedro ", isChild: false }, { id: "child-2", name: "Ana" }, { id: "empty", name: " " }]
    };

    const couple = read(context, "normalizeCouple(coupleWithChildren)");
    assert.deepEqual(couple, {
        id: "pair-children",
        firstPerson: { id: "adult-1", name: "João", notes: "" },
        secondPerson: { id: "adult-2", name: "Maria", notes: "" },
        children: [
            { id: "child-1", name: "Pedro", notes: "", isChild: true },
            { id: "child-2", name: "Ana", notes: "", isChild: true }
        ]
    });
});

test("grupo Casais preserva fechamento e IDs de adultos, casal e crianças", () => {
    const context = loadGuestLogic();
    context.closedCouplesGroup = {
        schemaVersion: 3,
        id: "couples-group",
        category: "couples",
        name: "Casais",
        isClosed: true,
        couples: [{
            id: "pair-1",
            firstPerson: { id: "adult-1", name: "João", isChild: true },
            secondPerson: { id: "adult-2", name: "Maria", isChild: true },
            children: [{ id: "child-1", name: "Pedro", isChild: false }]
        }]
    };

    const group = read(context, "normalizeStructuredGroup(closedCouplesGroup)");
    assert.equal(group.id, "couples-group");
    assert.equal(group.isClosed, true);
    assert.equal(group.couples[0].id, "pair-1");
    assert.equal(group.couples[0].firstPerson.id, "adult-1");
    assert.equal(group.couples[0].secondPerson.id, "adult-2");
    assert.equal(group.couples[0].children[0].id, "child-1");
    assert.equal(Object.hasOwn(group.couples[0].firstPerson, "isChild"), false);
    assert.equal(group.couples[0].children[0].isChild, true);
});

test("grupo antigo de padrinhos vira sistema único sem perder ID, pessoas ou fechamento", () => {
    const context = loadGuestLogic();
    context.oldGodparents = [{
        schemaVersion: 2,
        id: "godparents-old",
        category: "godparents",
        name: "Padrinhos",
        isClosed: true,
        couples: [{ id: "pair-1", firstPersonName: "Ana", secondPersonName: "Bia" }],
        individuals: [{ id: "single-1", name: "Carlos" }]
    }, {
        schemaVersion: 2,
        id: "godparents-duplicate",
        category: "godparents",
        name: "Outro título",
        couples: [{ id: "pair-1", firstPersonName: "Ana", secondPersonName: "Bia" }],
        individuals: [{ id: "single-2", name: "Dora", isChild: true }]
    }];

    const groups = read(context, "normalizeGuestGroups(oldGodparents)");
    assert.equal(groups.length, 1);
    assert.equal(groups[0].id, "godparents-old");
    assert.equal(groups[0].name, "Padrinhos & Madrinhas");
    assert.equal(groups[0].category, "godparents");
    assert.equal(groups[0].isSystem, true);
    assert.equal(groups[0].systemKey, "godparents");
    assert.equal(groups[0].sortOrder, 0);
    assert.equal(groups[0].isClosed, true);
    assert.deepEqual(groups[0].couples.map(item => item.id), ["pair-1"]);
    assert.deepEqual(groups[0].individuals.map(item => item.id), ["single-1", "single-2"]);
    assert.equal(Object.hasOwn(groups[0].individuals[1], "isChild"), false);
    assert.equal(Object.hasOwn(groups[0].couples[0], "children"), false);
    assert.equal(Object.hasOwn(groups[0].couples[0].firstPerson, "isChild"), false);
});

test("ordenação fixa Padrinhos & Madrinhas sem ignorar busca ou filtros", () => {
    const context = loadGuestLogic();
    context.groupsToSort = [{ id: "family", category: "family", name: "Família Silva", isClosed: false, members: [{ name: "Ana" }] }, {
        id: "godparents", category: "godparents", name: "Padrinhos & Madrinhas", systemKey: "godparents", isClosed: true, couples: [], individuals: [{ name: "Bia" }]
    }, {
        id: "friends", category: "individual_group", name: "Amigos", isClosed: false, members: [{ name: "Caio" }]
    }, {
        id: "closed-family", category: "family", name: "Família Souza", isClosed: true, members: [{ name: "Dora" }]
    }];

    assert.deepEqual(read(context, "sortGuestGroups(groupsToSort).map(group => group.id)"), ["godparents", "family", "friends", "closed-family"]);
    assert.deepEqual(read(context, "sortGuestGroups(filterGuestGroups(groupsToSort, '', 'open', 'all')).map(group => group.id)"), ["family", "friends"]);
    assert.deepEqual(read(context, "sortGuestGroups(filterGuestGroups(groupsToSort, '', 'closed', 'all')).map(group => group.id)"), ["godparents", "closed-family"]);
    assert.deepEqual(read(context, "sortGuestGroups(filterGuestGroups(groupsToSort, 'Bia', 'all', 'all')).map(group => group.id)"), ["godparents"]);
});

test("conta pessoas, crianças e adultos em todas as categorias", () => {
    const context = loadGuestLogic();
    context.classifiedGroups = [{
        category: "family",
        members: [{ isChild: true }, { isChild: false }, {}]
    }, {
        category: "couples",
        couples: [{ firstPerson: {}, secondPerson: {}, children: [{ isChild: true }, { isChild: true }] }]
    }, {
        category: "godparents",
        couples: [{ firstPerson: { isChild: true }, secondPerson: { isChild: true } }],
        individuals: [{ isChild: false }]
    }];

    assert.equal(vm.runInContext("countAllPeople(classifiedGroups)", context), 10);
    assert.equal(vm.runInContext("countAllChildren(classifiedGroups)", context), 3);
    assert.equal(vm.runInContext("countAllAdults(classifiedGroups)", context), 7);
    assert.equal(vm.runInContext("countChildrenInGroup(classifiedGroups[0])", context), 1);
    assert.equal(vm.runInContext("countAdultsInGroup(classifiedGroups[0])", context), 2);
    assert.equal(vm.runInContext("countChildrenInGroup(classifiedGroups[2])", context), 0);
});

test("casal soma dois adultos mais cada criança vinculada", () => {
    const context = loadGuestLogic();
    context.withoutChildren = { category: "couples", couples: [{ children: [] }] };
    context.withOneChild = { category: "couples", couples: [{ children: [{ id: "c1" }] }] };
    context.withTwoChildren = { category: "couples", couples: [{ children: [{ id: "c1" }, { id: "c2" }] }] };

    assert.equal(vm.runInContext("countGroupPeople(withoutChildren)", context), 2);
    assert.equal(vm.runInContext("countGroupPeople(withOneChild)", context), 3);
    assert.equal(vm.runInContext("countGroupPeople(withTwoChildren)", context), 4);
    assert.equal(vm.runInContext("countAdultsInGroup(withTwoChildren)", context), 2);
    assert.equal(vm.runInContext("countChildrenInGroup(withTwoChildren)", context), 2);
});

test("adiciona, edita e remove crianças sem duplicar ou trocar IDs", () => {
    const context = loadGuestLogic();
    context.draftCouple = { id: "pair-1", firstPerson: { name: "João" }, secondPerson: { name: "Maria" }, children: [] };

    assert.equal(vm.runInContext("saveCoupleChild(draftCouple, null, '   ')", context), null);
    vm.runInContext("saveCoupleChild(draftCouple, null, ' Pedro ', null, ' 3 anos. '); saveCoupleChild(draftCouple, null, 'Ana')", context);
    const beforeEdit = read(context, "draftCouple.children");
    assert.equal(beforeEdit.length, 2);
    assert.equal(beforeEdit[0].name, "Pedro");
    assert.equal(beforeEdit[0].notes, "3 anos.");
    assert.equal(beforeEdit[0].isChild, true);

    context.preservedChildId = beforeEdit[0].id;
    vm.runInContext("saveCoupleChild(draftCouple, preservedChildId, 'Pedro Henrique', null, '')", context);
    const afterEdit = read(context, "draftCouple.children");
    assert.equal(afterEdit.length, 2);
    assert.equal(afterEdit[0].id, beforeEdit[0].id);
    assert.equal(afterEdit[0].name, "Pedro Henrique");
    assert.equal(afterEdit[0].notes, "");

    context.removedChildId = afterEdit[1].id;
    assert.equal(vm.runInContext("removeCoupleChildFromCouple(draftCouple, removedChildId)", context), true);
    assert.equal(vm.runInContext("removeCoupleChildFromCouple(draftCouple, removedChildId)", context), false);
    assert.deepEqual(read(context, "draftCouple.children.map(child => child.id)"), [beforeEdit[0].id]);
    assert.equal(vm.runInContext("removeCoupleChildFromCouple(draftCouple, preservedChildId)", context), true);
    assert.deepEqual(read(context, "draftCouple.children"), []);
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
        couples: [{ firstPersonName: "João", secondPersonName: "Lívia", children: [{ name: "Pedro" }] }],
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
    assert.deepEqual(read(context, "filterGuestGroups(groups, 'pedro', 'all', 'all').map(group => group.name)"), ["Casais"]);
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
    assert.match(guestHtml, /Padrinhos &amp; Madrinhas/);
    assert.doesNotMatch(guestHtml, /Padrinhos\/Madrinhas/);
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
    assert.match(guestSource, /const totalChildren = countAllChildren\(state\.guests\)/);
    assert.match(guestSource, /const totalAdults = countAllAdults\(state\.guests\)/);
    assert.match(guestSource, /visibleGroups\.map\(renderCompleteListGroup\)/);
    assert.match(guestSource, /getDetailsContent\(group\)/);
    assert.match(guestSource, /group\.isClosed \? '<span class="closed-badge/);
    assert.match(guestSource, /data-complete-action="view"/);
    assert.match(guestSource, /data-complete-action="edit"/);
    assert.match(guestCss, /\.complete-guest-list-dialog/);
});

test("opção Criança fica em família e avulsos, não nos adultos do casal ou padrinhos", () => {
    assert.match(guestSource, /data-buffer-boolean="personIsChild"/);
    assert.match(guestSource, /family-member-child/);
    assert.match(guestSource, /individual-member-child/);
    assert.doesNotMatch(guestSource, /firstPersonIsChild|secondPersonIsChild|coupleFirstIsChild|coupleSecondIsChild/);
    assert.doesNotMatch(guestSource, /godparent-first-child|godparent-second-child|godparent-individual-child/);
    assert.match(guestSource, /person\.isChild = Boolean\(wizardState\.buffer\.personIsChild\)/);
    assert.match(guestCss, /\.child-option/);
    assert.match(guestCss, /\.child-badge/);
});

test("casal oferece seção acessível para uma ou mais crianças", () => {
    assert.match(guestSource, /class="couple-children-toggle"/);
    assert.match(guestSource, /type="button" aria-expanded="\$\{expanded\}" aria-controls="couple-children-panel"/);
    assert.match(guestSource, /"Tem criança\?"/);
    assert.match(guestSource, /Crianças que acompanham o casal/);
    assert.match(guestSource, /for="couple-child-name"/);
    assert.match(guestSource, /data-buffer-field="childName"/);
    assert.match(guestSource, /data-couple-children-action="save"/);
    assert.match(guestSource, /data-child-action="edit"/);
    assert.match(guestSource, /data-child-action="remove"/);
    assert.match(guestSource, /aria-live="polite"/);
    assert.match(guestSource, /function addOrUpdateCoupleChild\(\)/);
    assert.match(guestSource, /function editCoupleChild\(childId\)/);
    assert.match(guestSource, /function removeCoupleChild\(childId\)/);
    assert.match(guestSource, /saveCoupleChild\(couple, wizardState\.editingChildId, name, childId, wizardState\.buffer\.childNotes\)/);
    assert.match(guestSource, /data-couple-action="select"/);
    assert.match(guestSource, /function selectDraftCouple\(coupleId\)/);
    assert.match(guestSource, /wizardState\.activeCoupleId = couple\.id/);
    assert.match(guestCss, /\.couple-children-toggle:focus-visible/);
    assert.match(guestCss, /\.couple-picker-button/);
    assert.match(guestCss, /\.couple-child-builder/);
});

test("cartões, detalhes, lista completa e PDF exibem crianças sem alterar o total", () => {
    assert.match(guestSource, /function countChildrenInGroup\(group\)/);
    assert.match(guestSource, /class="card-children"/);
    assert.match(guestSource, /renderPersonWithChildBadge/);
    assert.match(guestSource, /formatPersonForPrint/);
    assert.match(guestSource, /renderCouplePresentation\(couple, true\)/);
    assert.match(guestSource, /class="print-couple-children"/);
    assert.match(guestSource, /couple\.children\.map\(child/);
    assert.match(guestSource, /Adultos: \$\{countAllAdults\(state\.guests\)\}/);
    assert.match(guestSource, /Crianças: \$\{countAllChildren\(state\.guests\)\}/);
    assert.match(guestSource, /const sortedGroups = sortGuestGroups\(state\.guests\)/);
});

test("modelo local preserva grupo de sistema e vínculos usados pelo banco", () => {
    assert.match(guestSource, /isSystem: isGodparentsGroup \|\| Boolean\(group\.isSystem\)/);
    assert.match(guestSource, /systemKey: isGodparentsGroup \? "godparents" : null/);
    assert.match(guestSource, /sortOrder: isGodparentsGroup \? 0/);
    assert.match(guestSource, /firstPerson: normalizeAdultPerson/);
    assert.match(guestSource, /secondPerson: normalizeAdultPerson/);
    assert.match(guestSource, /normalized\.children =/);
    assert.match(guestSource, /isChild: true/);
    assert.match(guestSource, /function findGuestSystemGroup\(groups, systemKey\)/);
});

test("documentação descreve a integração real sem incluir SQL", () => {
    assert.match(guestDocumentation, /Padrinhos & Madrinhas/);
    assert.match(guestDocumentation, /`isChild`/);
    assert.match(guestDocumentation, /`systemKey`/);
    assert.match(guestDocumentation, /`guest_groups`/);
    assert.match(guestDocumentation, /`guest_members`/);
    assert.match(guestDocumentation, /`pair_id`/);
    assert.match(guestDocumentation, /`household_id`/);
    assert.match(guestDocumentation, /`couple_child`/);
    assert.match(guestDocumentation, /`guest_groups\.notes`/);
    assert.match(guestDocumentation, /`normalizeGuestNameForComparison\(name\)`/);
    assert.match(guestDocumentation, /`getAllGuestPeople\(groups\)`/);
    assert.match(guestDocumentation, /Duplicados nunca são bloqueados/);
    assert.doesNotMatch(guestDocumentation, /`child_couple`/);
    assert.match(guestDocumentation, /RLS/);
    assert.match(guestDocumentation, /nosso-casamento-guests-backup:/);
    assert.match(guestDocumentation, /nosso-casamento-guests-migrated:/);
    assert.doesNotMatch(guestDocumentation, /CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+POLICY/i);
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

test("Supabase é a fonte de verdade e convidados não voltam ao saveState", () => {
    assert.doesNotMatch(guestSource, /saveState\(\)/);
    assert.match(guestSource, /listCurrentWeddingGuestGroups/);
    assert.match(guestSource, /createCurrentWeddingGuestGroup/);
    assert.match(guestSource, /replaceOrSyncGuestGroupMembers/);
    assert.match(guestSource, /void initializeGuests\(\)/);
    assert.doesNotMatch(guestSource, /\.from\("guest_(?:groups|members)"\)/);
});

test("mapeia grupos nos dois sentidos sem aceitar campos técnicos da interface", () => {
    const context = loadGuestSupabaseLogic();
    const local = read(context, `mapGuestGroupRowToLocal({
        id: '11111111-1111-4111-8111-111111111111', category: 'family', name: 'Família Silva',
        relationship_group: null, notes: null, is_closed: null, is_system: false,
        system_key: null, sort_order: null, created_at: '2026-08-25T10:00:00Z'
    })`);
    assert.deepEqual(local, {
        id: "11111111-1111-4111-8111-111111111111",
        category: "family", name: "Família Silva", relationshipGroup: "", notes: "",
        isClosed: false, isSystem: false, systemKey: null, sortOrder: null,
        createdAt: "2026-08-25T10:00:00Z", updatedAt: ""
    });

    const payload = read(context, `mapGuestGroupToDatabase({
        id: 'local', weddingId: 'forjado', category: 'family', name: ' Família Silva ',
        relationshipGroup: '', notes: ' Lado da noiva ', isClosed: true,
        isSystem: false, systemKey: null, sortOrder: 4, members: [{ name: 'Ana' }],
        createdAt: 'ontem', modalOpen: true
    })`);
    assert.deepEqual(payload, {
        category: "family", name: "Família Silva", relationship_group: null,
        notes: "Lado da noiva", is_closed: true, is_system: false,
        system_key: null, sort_order: 4
    });
});

test("mapeia membros e limita member_type aos seis valores do banco", () => {
    const context = loadGuestSupabaseLogic();
    const local = read(context, `mapGuestMemberRow({
        id: 'member', guest_group_id: 'group', name: 'Pedro', notes: null,
        is_child: true, member_type: 'couple_child', pair_id: null,
        household_id: '22222222-2222-4222-8222-222222222222', sort_order: 3
    })`);
    assert.deepEqual(local, {
        id: "member", guestGroupId: "group", name: "Pedro", notes: "", isChild: true,
        memberType: "couple_child", pairId: null,
        householdId: "22222222-2222-4222-8222-222222222222", sortOrder: 3,
        createdAt: "", updatedAt: ""
    });
    assert.throws(
        () => vm.runInContext("mapGuestMemberToDatabase({ name: 'X', memberType: 'child_couple' })", context),
        error => error.code === "GUEST_MEMBER_TYPE_INVALID"
    );
    assert.throws(
        () => vm.runInContext("mapGuestMemberToDatabase({ name: 'X', memberType: 'couple_adult', pairId: 'couple-local' })", context),
        error => error.code === "GUEST_MEMBER_UUID_INVALID"
    );
});

test("reconstrói família, avulsos, casal com crianças e padrinhos pelos vínculos remotos", () => {
    const context = loadGuestLogic();
    context.remoteGroups = [
        { id: "family", category: "family", name: "Família Silva", relationshipGroup: "", notes: "Grupo", isClosed: false, isSystem: false, systemKey: null, sortOrder: 1, createdAt: "1" },
        { id: "friends", category: "individual_group", name: "Amigos", relationshipGroup: "Amigos", notes: "", isClosed: false, isSystem: false, systemKey: null, sortOrder: 2, createdAt: "2" },
        { id: "couples", category: "couples", name: "Casais", relationshipGroup: "", notes: "", isClosed: true, isSystem: false, systemKey: null, sortOrder: 3, createdAt: "3" },
        { id: "gods", category: "godparents", name: "Padrinhos & Madrinhas", relationshipGroup: "", notes: "", isClosed: false, isSystem: true, systemKey: "godparents", sortOrder: 0, createdAt: "0" }
    ];
    context.remoteMembers = [
        { id: "f1", guestGroupId: "family", name: "Ana Silva", notes: "Vegana", isChild: false, memberType: "family_member", pairId: null, householdId: null, sortOrder: 0 },
        { id: "i1", guestGroupId: "friends", name: "Bia", notes: "", isChild: true, memberType: "individual_guest", pairId: null, householdId: null, sortOrder: 0 },
        { id: "a1", guestGroupId: "couples", name: "Caio", notes: "", isChild: false, memberType: "couple_adult", pairId: "pair", householdId: "home", sortOrder: 0 },
        { id: "a2", guestGroupId: "couples", name: "Dora", notes: "", isChild: false, memberType: "couple_adult", pairId: "pair", householdId: "home", sortOrder: 1 },
        { id: "c1", guestGroupId: "couples", name: "Eva", notes: "3 anos", isChild: true, memberType: "couple_child", pairId: null, householdId: "home", sortOrder: 2 },
        { id: "g1", guestGroupId: "gods", name: "Fred", notes: "", isChild: false, memberType: "godparent_couple", pairId: "god-pair", householdId: "god-home", sortOrder: 0 },
        { id: "g2", guestGroupId: "gods", name: "Gabi", notes: "", isChild: false, memberType: "godparent_couple", pairId: "god-pair", householdId: "god-home", sortOrder: 1 },
        { id: "g3", guestGroupId: "gods", name: "Hugo", notes: "Sozinho", isChild: false, memberType: "godparent_individual", pairId: null, householdId: null, sortOrder: 2 }
    ];
    const groups = read(context, "rebuildGuestGroupsFromRows(remoteGroups, remoteMembers)");
    assert.equal(groups[0].systemKey, "godparents");
    assert.equal(groups.find(group => group.id === "family").members[0].notes, "Vegana");
    assert.equal(groups.find(group => group.id === "friends").members[0].isChild, true);
    const couple = groups.find(group => group.id === "couples").couples[0];
    assert.equal(couple.id, "pair");
    assert.equal(couple.householdId, "home");
    assert.equal(couple.children[0].id, "c1");
    assert.equal(couple.children[0].notes, "3 anos");
    const godparents = groups.find(group => group.id === "gods");
    assert.equal(godparents.couples.length, 1);
    assert.equal(godparents.individuals[0].id, "g3");
});

test("migração converte IDs locais em UUIDs novos e compartilha pair_id e household_id", () => {
    const context = loadGuestLogic();
    context.legacyCouples = {
        id: "group-local", category: "couples", name: "Casais", couples: [{
            id: "couple-local", firstPerson: { id: "adult-local-1", name: "João" },
            secondPerson: { id: "adult-local-2", name: "Maria" },
            children: [{ id: "child-local", name: "Pedro", isChild: true }]
        }]
    };
    context.uuidValues = [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222"
    ];
    const rows = read(context, "flattenGuestGroupMembersForDatabase(legacyCouples, () => uuidValues.shift())");
    assert.equal(rows.length, 3);
    assert.equal(rows.some(row => Object.hasOwn(row, "id")), false);
    assert.equal(rows[0].pairId, rows[1].pairId);
    assert.equal(rows[0].householdId, rows[1].householdId);
    assert.equal(rows[2].pairId, null);
    assert.equal(rows[2].householdId, rows[0].householdId);
    assert.equal(rows[2].memberType, "couple_child");
});

test("lista grupos e integrantes remotos somente no casamento autenticado", async () => {
    const client = createGuestSupabaseClient({
        groupRows: [{ id: "group-1", wedding_id: "wedding-1", category: "family", name: "Família Silva" }],
        memberRows: [{ id: "member-1", guest_group_id: "group-1", name: "Ana Silva", member_type: "family_member" }]
    });
    const context = loadGuestSupabaseWithClient(client);
    const result = await context.listCurrentWeddingGuestGroups();
    assert.equal(result.weddingId, "wedding-1");
    assert.equal(result.guestGroups[0].id, "group-1");
    assert.equal(result.guestMembers[0].guestGroupId, "group-1");
    const groupList = client.calls.find(call => call.table === "guest_groups" && call.operation === "list");
    assert.deepEqual(groupList.filters, [{ column: "wedding_id", value: "wedding-1" }]);
    assert.deepEqual(groupList.orders.map(order => order.column), ["is_system", "sort_order", "created_at"]);
    const memberList = client.calls.find(call => call.table === "guest_members" && call.operation === "list");
    assert.deepEqual(memberList.inFilters, [{ column: "guest_group_id", values: ["group-1"] }]);
});

test("cadastro de grupo injeta wedding_id autenticado e nunca envia ID local", async () => {
    const client = createGuestSupabaseClient();
    const context = loadGuestSupabaseWithClient(client);
    const created = await context.createCurrentWeddingGuestGroup({
        id: "group-local", weddingId: "forjado", category: "family", name: "Família Silva",
        members: [{ id: "member-local", name: "Ana" }]
    });
    const insert = client.calls.find(call => call.table === "guest_groups" && call.operation === "insert");
    assert.equal(insert.payload.wedding_id, "wedding-1");
    assert.equal(Object.hasOwn(insert.payload, "id"), false);
    assert.equal(Object.hasOwn(insert.payload, "members"), false);
    assert.equal(created.id, "11111111-1111-4111-8111-111111111111");
});

test("sincronização incremental atualiza alterados, insere novos e exclui apenas removidos", async () => {
    const groupId = "11111111-1111-4111-8111-111111111111";
    const memberOne = {
        id: "21111111-1111-4111-8111-111111111111", guestGroupId: groupId,
        name: "Ana", notes: "", isChild: false, memberType: "family_member",
        pairId: null, householdId: null, sortOrder: 0
    };
    const memberTwo = { ...memberOne, id: "31111111-1111-4111-8111-111111111111", name: "Bia", sortOrder: 1 };
    const removed = { ...memberOne, id: "41111111-1111-4111-8111-111111111111", name: "Caio", sortOrder: 2 };
    const client = createGuestSupabaseClient({
        groupRows: [{ id: groupId, wedding_id: "wedding-1", category: "family", name: "Família Silva" }],
        memberRows: [memberOne, memberTwo]
    });
    const context = loadGuestSupabaseWithClient(client);
    await context.replaceOrSyncGuestGroupMembers(groupId, [
        memberOne,
        { ...memberTwo, notes: "Vegetariana" },
        { name: "Dora", notes: "", isChild: true, memberType: "family_member", pairId: null, householdId: null, sortOrder: 3 }
    ], [memberOne, memberTwo, removed]);

    const updates = client.calls.filter(call => call.table === "guest_members" && call.operation === "update");
    const inserts = client.calls.filter(call => call.table === "guest_members" && call.operation === "insert");
    const deletes = client.calls.filter(call => call.table === "guest_members" && call.operation === "delete");
    assert.equal(updates.length, 1);
    assert.equal(updates[0].filters.find(filter => filter.column === "id").value, memberTwo.id);
    assert.equal(updates[0].payload.notes, "Vegetariana");
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].payload[0].name, "Dora");
    assert.deepEqual(deletes[0].inFilters, [{ column: "id", values: [removed.id] }]);
});

test("RLS é traduzida e não há qualquer acesso à tabela antiga guests", async () => {
    const client = createGuestSupabaseClient({
        groupRows: [{ id: "group-1", wedding_id: "wedding-1" }],
        errors: { "guest_groups:update": { code: "42501", message: "row-level security" } }
    });
    const context = loadGuestSupabaseWithClient(client);
    await assert.rejects(
        context.updateCurrentWeddingGuestGroupClosed("group-1", true),
        error => error.code === "GUEST_PERMISSION_DENIED"
    );
    assert.doesNotMatch(supabaseSource, /\.from\(["']guests["']\)/);
});

test("migração possui backup, marca por casamento e compensação de falha parcial", () => {
    assert.match(guestSource, /nosso-casamento-guests-backup:\$\{weddingId\}/);
    assert.match(guestSource, /nosso-casamento-guests-migrated:\$\{weddingId\}/);
    assert.match(guestSource, /if \(localStorage\.getItem\(markerKey\)\) return false/);
    assert.match(guestSource, /localStorage\.setItem\(markerKey, new Date\(\)\.toISOString\(\)\)/);
    assert.match(guestSource, /catch \(error\) \{[\s\S]*?deleteCurrentWeddingGuestGroup/);
    assert.match(guestSource, /system:godparents/);
});

test("normaliza nomes para comparação sem alterar o valor visual", () => {
    const context = loadGuestLogic();

    assert.equal(vm.runInContext("normalizeGuestNameForComparison('  João   Silva  ')", context), "joao silva");
    assert.equal(vm.runInContext("normalizeGuestNameForComparison('JOAO SILVA')", context), "joao silva");
    assert.equal(vm.runInContext("getGuestNameMatchLevel('João Silva', 'joao  silva')", context), "exact");
    assert.equal(vm.runInContext("getGuestNameMatchLevel('João Pedro Silva', 'Joao P. Silva')", context), "similar");
    assert.equal(vm.runInContext("getGuestNameMatchLevel('João Silva', 'Maria Silva')", context), null);
});

test("percorre todas as pessoas com contexto reutilizável", () => {
    const context = loadGuestLogic();
    context.allKinds = [{
        id: "family", name: "Família Silva", category: "family",
        members: [{ id: "family-person", name: "Ana Silva", isChild: false }]
    }, {
        id: "couples", name: "Casais", category: "couples",
        couples: [{
            id: "pair", firstPerson: { id: "adult-1", name: "Bia" }, secondPerson: { id: "adult-2", name: "Caio" },
            children: [{ id: "child", name: "Duda", isChild: true }]
        }]
    }, {
        id: "godparents", name: "Padrinhos & Madrinhas", category: "godparents",
        couples: [{ id: "god-pair", firstPerson: { id: "god-1", name: "Eva" }, secondPerson: { id: "god-2", name: "Fred" } }],
        individuals: [{ id: "god-3", name: "Gabi" }]
    }, {
        id: "friends", name: "Amigos", category: "individual_group",
        members: [{ id: "friend", name: "Hugo", isChild: false }]
    }];

    const people = read(context, "getAllGuestPeople(allKinds)");
    assert.equal(people.length, 8);
    assert.deepEqual(people.find(person => person.id === "child"), {
        id: "child", name: "Duda", isChild: true, pairId: null, householdId: "pair",
        memberType: "couple_child", groupId: "couples", groupName: "Casais", category: "couples"
    });
    assert.equal(people.find(person => person.id === "god-1").memberType, "godparent_couple");
    assert.equal(people.find(person => person.id === "friend").memberType, "individual_guest");
});

test("detector encontra equivalências, ignora a própria pessoa e mantém casais separados", () => {
    const context = loadGuestLogic();
    context.existingGroups = [{
        id: "family", name: "Família Silva", category: "family",
        members: [
            { id: "joao", name: "João Silva", isChild: false },
            { id: "maria", name: "Maria Souza", isChild: false }
        ]
    }];
    context.oneCandidate = [{ id: "new-joao", name: " JOAO   SILVA " }];
    context.pairWithOneMatch = [{ id: "pair-first", name: "João Silva" }, { id: "pair-second", name: "Beatriz Lima" }];
    context.twoCandidates = [{ id: "pair-first", name: "João Silva" }, { id: "pair-second", name: "Maria Souza" }];

    const oneResult = read(context, "findPotentialGuestDuplicates(oneCandidate, existingGroups)");
    assert.equal(oneResult.length, 1);
    assert.equal(oneResult[0].matches[0].id, "joao");
    assert.equal(oneResult[0].matches[0].level, "exact");

    const twoResults = read(context, "findPotentialGuestDuplicates(twoCandidates, existingGroups)");
    assert.deepEqual(read(context, "findPotentialGuestDuplicates(pairWithOneMatch, existingGroups).map(result => result.candidate.id)"), ["pair-first"]);
    assert.deepEqual(twoResults.map(result => result.candidate.id), ["pair-first", "pair-second"]);
    assert.deepEqual(read(context, "findPotentialGuestDuplicates([{ id: 'joao', name: 'João Silva' }], existingGroups)"), []);
    assert.equal(read(context, "findPotentialGuestDuplicates([{ id: 'first', name: 'Alex' }, { id: 'second', name: 'Alex' }], [])").length, 0);
});

test("edição ignora o próprio ID, mas encontra homônimo em outro grupo", () => {
    const context = loadGuestLogic();
    context.sameNames = [{
        id: "group-a", name: "Família A", category: "family",
        members: [{ id: "person-a", name: "Carlos Silva" }]
    }, {
        id: "group-b", name: "Igreja", category: "individual_group",
        members: [{ id: "person-b", name: "Carlos Silva" }]
    }];

    const results = read(context, "findPotentialGuestDuplicates([{ id: 'person-a', name: 'Carlos Silva' }], sameNames)");
    assert.equal(results.length, 1);
    assert.deepEqual(results[0].matches.map(match => match.id), ["person-b"]);
});

test("notes é opcional, retrocompatível e preservado em grupo fechado", () => {
    const context = loadGuestLogic();
    context.oldGroup = {
        schemaVersion: 4, id: "old", category: "family", name: "Silva", isClosed: true,
        members: [{ id: "member", name: "Ana" }]
    };
    context.notedGroup = { ...context.oldGroup, notes: "  Vêm de outra cidade.  " };

    assert.equal(read(context, "normalizeStructuredGroup(oldGroup)").notes, "");
    const noted = read(context, "normalizeStructuredGroup(notedGroup)");
    assert.equal(noted.notes, "Vêm de outra cidade.");
    assert.equal(noted.isClosed, true);
    assert.match(guestSource, /data-review-field="notes"/);
    assert.match(guestSource, /group\.notes\s*\? `<section class="details-section details-notes"/);
    assert.match(guestSource, /class="complete-list-notes"/);
    assert.match(guestSource, /class="print-group-notes"/);
});

test("normaliza notes de toda pessoa sem misturar com a observação do grupo", () => {
    const context = loadGuestLogic();
    context.family = {
        id: "family", category: "family", name: "Silva", notes: "  Parentes da noiva. ",
        members: [{ id: "member", name: "Beatriz", notes: " Vegetariana. " }, { id: "old-member", name: "Samira" }]
    };
    context.couples = {
        id: "couples", category: "couples", name: "Casais", notes: "",
        couples: [{
            id: "pair",
            firstPerson: { id: "first", name: "João", notes: " Vem de longe. " },
            secondPerson: { id: "second", name: "Maria", notes: "Prima da noiva." },
            children: [{ id: "child", name: "Pedro", notes: " 3 anos. " }]
        }]
    };
    context.godparents = {
        id: "godparents", category: "godparents", name: "Padrinhos & Madrinhas",
        couples: [{ id: "god-pair", firstPerson: { id: "god-1", name: "Eva", notes: "Amiga de infância." }, secondPerson: { id: "god-2", name: "Fred" } }],
        individuals: [{ id: "god-3", name: "Lucas", notes: " Entrará sozinho. " }]
    };

    const family = read(context, "normalizeStructuredGroup(family)");
    const couples = read(context, "normalizeStructuredGroup(couples)");
    const godparents = read(context, "normalizeStructuredGroup(godparents)");

    assert.equal(family.notes, "Parentes da noiva.");
    assert.equal(family.members[0].notes, "Vegetariana.");
    assert.equal(family.members[1].notes, "");
    assert.equal(couples.couples[0].firstPerson.notes, "Vem de longe.");
    assert.equal(couples.couples[0].secondPerson.notes, "Prima da noiva.");
    assert.equal(couples.couples[0].children[0].notes, "3 anos.");
    assert.equal(couples.couples[0].children[0].isChild, true);
    assert.equal(godparents.couples[0].firstPerson.notes, "Amiga de infância.");
    assert.equal(godparents.couples[0].secondPerson.notes, "");
    assert.equal(godparents.individuals[0].notes, "Entrará sozinho.");
    assert.equal(Object.hasOwn(godparents.individuals[0], "isChild"), false);
});

test("editar observação pelo cartão altera somente group.notes e mantém grupo fechado", () => {
    const context = loadGuestLogic();
    context.groups = [{
        id: "closed-group", name: "Família Silva", notes: "Antiga", isClosed: true,
        category: "family", members: [{ id: "member", name: "Ana Silva", notes: "Vegetariana.", isChild: false }]
    }];

    const updated = read(context, "updateGuestGroupNotes(groups, 'closed-group', '  Nova observação.  ')");
    assert.equal(updated.notes, "Nova observação.");
    assert.equal(updated.isClosed, true);
    assert.equal(updated.members[0].id, "member");
    assert.equal(updated.members[0].notes, "Vegetariana.");
    assert.equal(vm.runInContext("updateGuestGroupNotes(groups, 'missing', 'x')", context), null);

    const cleared = read(context, "updateGuestGroupNotes(groups, 'closed-group', '   ')");
    assert.equal(cleared.notes, "");
    assert.equal(cleared.isClosed, true);
});

test("interface oferece observação individual em todos os fluxos e observação de grupo isolada", () => {
    assert.match(guestSource, /function normalizeGuestPerson\(/);
    assert.match(guestSource, /data-buffer-field="personNotes"/);
    assert.match(guestSource, /data-buffer-field="firstPersonNotes"/);
    assert.match(guestSource, /data-buffer-field="secondPersonNotes"/);
    assert.match(guestSource, /data-draft-field="coupleFirstNotes"/);
    assert.match(guestSource, /data-draft-field="coupleSecondNotes"/);
    assert.match(guestSource, /data-buffer-field="childNotes"/);
    assert.match(guestSource, /editingPerson\.notes = cleanGuestText\(wizardState\.buffer\.personNotes\)/);
    assert.match(guestSource, /editingCouple\.firstPerson\.notes/);
    assert.match(guestSource, /editingCouple\.secondPerson\.notes/);
    assert.match(guestHtml, /<dialog class="group-notes-dialog" id="group-notes-dialog"/);
    assert.match(guestHtml, /Observação do grupo/);
    assert.match(guestSource, /data-action="edit-group-notes"/);
    assert.match(guestSource, /async function saveGroupNotes\(\)[\s\S]*?updateCurrentWeddingGuestGroupNotes/);
    assert.match(guestSource, /group\.notes \? "Editar observação do grupo" : "\+ Adicionar observação ao grupo"/);
});

test("detalhes, lista completa e PDF associam notes à pessoa e quebram no mobile", () => {
    assert.match(guestSource, /class="person-detail-notes"/);
    assert.match(guestSource, /renderPersonWithChildBadge\(couple\.firstPerson\)/);
    assert.match(guestSource, /renderPersonWithChildBadge\(couple\.secondPerson\)/);
    assert.match(guestSource, /class="print-person-notes"/);
    assert.match(guestSource, /Observação do grupo:<\/strong>/);
    assert.match(guestCss, /\.person-detail-row \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
    assert.match(guestCss, /@media \(max-width: 580px\)[\s\S]*?\.person-detail-row \{ grid-template-columns: 1fr;/);
    assert.match(guestCss, /\.person-detail-notes \{[^}]*overflow-wrap: anywhere;[^}]*white-space: pre-wrap;/);
    assert.match(guestCss, /\.group-notes-dialog footer \{ align-items: stretch; flex-direction: column-reverse;/);
});

test("bloqueio de scroll preserva posição, compensa scrollbar e só libera sem dialogs abertos", () => {
    const context = loadGuestLogic();
    const rootClasses = new Set();
    const bodyClasses = new Set();
    const makeClassList = values => ({
        add(value) { values.add(value); },
        remove(value) { values.delete(value); },
        contains(value) { return values.has(value); }
    });
    context.openDialog = { open: true };
    context.scrollCalls = [];
    context.document = {
        documentElement: { clientWidth: 1180, style: { overflow: "" }, classList: makeClassList(rootClasses) },
        body: {
            style: { position: "", top: "", left: "", right: "", width: "", overflow: "", paddingRight: "" },
            classList: makeClassList(bodyClasses)
        },
        querySelector() { return context.openDialog; }
    };
    context.window = {
        innerWidth: 1200, scrollX: 4, scrollY: 640,
        getComputedStyle() { return { paddingRight: "6px" }; },
        scrollTo(x, y) { context.scrollCalls.push([x, y]); }
    };

    vm.runInContext("lockPageScroll()", context);
    assert.equal(context.document.body.style.position, "fixed");
    assert.equal(context.document.body.style.top, "-640px");
    assert.equal(context.document.body.style.left, "-4px");
    assert.equal(context.document.body.style.paddingRight, "26px");
    assert.equal(rootClasses.has("guest-dialog-scroll-lock"), true);

    context.window.scrollY = 900;
    vm.runInContext("syncPageScrollLock()", context);
    assert.equal(context.document.body.style.top, "-640px");
    assert.equal(context.scrollCalls.length, 0);

    context.openDialog = null;
    vm.runInContext("syncPageScrollLock()", context);
    assert.deepEqual(context.scrollCalls, [[4, 640]]);
    assert.equal(context.document.body.style.position, "");
    assert.equal(context.document.body.style.paddingRight, "");
    assert.equal(rootClasses.has("guest-dialog-scroll-lock"), false);
});

test("todos os dialogs usam gerência central e ficam centralizados com scroll interno", () => {
    assert.match(guestSource, /function lockPageScroll\(\)/);
    assert.match(guestSource, /function unlockPageScroll\(\)/);
    assert.match(guestSource, /function syncPageScrollLock\(\)/);
    assert.match(guestSource, /document\.querySelector\("dialog\[open\]"\)/);
    assert.match(guestSource, /MutationObserver/);
    assert.match(guestSource, /attributeFilter: \["open"\]/);
    assert.match(guestSource, /touchmove[\s\S]*?passive: false/);
    assert.equal((guestSource.match(/\.showModal\(\)/g) || []).length, 1);
    assert.match(guestCss, /body\[data-page="convidados"\] dialog\[open\] \{[\s\S]*?position: fixed;[\s\S]*?100dvh[\s\S]*?margin: auto;/);
    assert.match(guestCss, /dialog::backdrop \{ position: fixed; inset: 0; \}/);
    assert.match(guestCss, /\.group-notes-dialog form \{[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto;[^}]*overflow: hidden;/);
    assert.match(guestCss, /\.group-notes-content \{[^}]*overflow-y: auto;[^}]*overscroll-behavior: contain;/);
    assert.doesNotMatch(guestCss, /margin-bottom: 8px/);
});

test("modal de duplicidade é nativo, acessível e permite revisar ou aceitar", () => {
    assert.match(guestHtml, /<dialog class="duplicate-dialog" id="guest-duplicate-dialog"/);
    assert.match(guestHtml, /aria-labelledby="duplicate-title"/);
    assert.match(guestHtml, /Possível convidado duplicado/);
    assert.match(guestHtml, /Voltar e revisar/);
    assert.match(guestHtml, /Adicionar mesmo assim/);
    assert.match(guestSource, /pendingDuplicateAction = null/);
    assert.match(guestSource, /duplicateDialog\.addEventListener\("cancel"/);
    assert.match(guestSource, /duplicateReturnFocus\?\.focus\?\.\(\)/);
    assert.match(guestSource, /runGuestOperationWithDuplicateCheck\(\[candidate\]/);
    assert.match(guestSource, /runGuestOperationWithDuplicateCheck\(candidates/);
    assert.match(guestSource, /function addOrUpdateCoupleChild\(\)[\s\S]*?runGuestOperationWithDuplicateCheck\(\[\{ id: childId, name \}\]/);
    assert.match(guestSource, /function addOrUpdateCouple\(\)[\s\S]*?runGuestOperationWithDuplicateCheck\(candidates/);
    assert.match(guestSource, /person\.memberType === "couple_adult"/);
    assert.match(guestSource, /savedGroup\.category === "family" && person\.memberType === "family_member"/);
    assert.doesNotMatch(guestSource, /window\.confirm\(/);
    assert.match(guestCss, /@media \(max-width: 760px\)/);
    assert.match(guestCss, /\.duplicate-dialog footer \{ align-items: stretch; flex-direction: column-reverse; \}/);
});

test("revisar mantém o rascunho e aceitar executa a operação somente uma vez", () => {
    const dialogLogic = guestSource.slice(
        guestSource.indexOf("function closeGuestDuplicateDialog"),
        guestSource.indexOf("function runGuestOperationWithDuplicateCheck")
    );
    const context = vm.createContext({
        pendingDuplicateAction: null,
        duplicateReviewAction: null,
        duplicateReturnFocus: null,
        duplicateDialog: { closeCalls: 0, close() { this.closeCalls += 1; } },
        closePageDialog(dialog) { dialog.close(); },
        wizardState: { buffer: { personName: "João Silva" } },
        focusCalls: 0,
        operationCalls: 0
    });
    vm.runInContext(dialogLogic, context);

    context.duplicateReturnFocus = { focus() { context.focusCalls += 1; } };
    vm.runInContext("closeGuestDuplicateDialog(true)", context);
    assert.equal(context.wizardState.buffer.personName, "João Silva");
    assert.equal(context.focusCalls, 1);

    context.pendingDuplicateAction = () => { context.operationCalls += 1; };
    vm.runInContext("confirmDuplicateGuestAction(); confirmDuplicateGuestAction();", context);
    assert.equal(context.operationCalls, 1);
});
