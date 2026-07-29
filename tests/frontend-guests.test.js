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
        { id: "old-1", name: "Ana Silva", isChild: false },
        { id: "old-2", name: "Bruno", isChild: false }
    ]);
    assert.equal(Object.hasOwn(groups[0], "status"), false);
    assert.deepEqual(groups[1].members, [{ id: "old-3", name: "Carla", isChild: false }]);
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
    assert.deepEqual(family.members, [{ id: "member-old", name: "Eduardo silva", isChild: false }]);
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
        firstPerson: { id: "pair-old-first", name: "João" },
        secondPerson: { id: "pair-old-second", name: "Maria" },
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
        firstPerson: { id: "adult-1", name: "João" },
        secondPerson: { id: "adult-2", name: "Maria" },
        children: [
            { id: "child-1", name: "Pedro", isChild: true },
            { id: "child-2", name: "Ana", isChild: true }
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
    vm.runInContext("saveCoupleChild(draftCouple, null, ' Pedro '); saveCoupleChild(draftCouple, null, 'Ana')", context);
    const beforeEdit = read(context, "draftCouple.children");
    assert.equal(beforeEdit.length, 2);
    assert.equal(beforeEdit[0].name, "Pedro");
    assert.equal(beforeEdit[0].isChild, true);

    context.preservedChildId = beforeEdit[0].id;
    vm.runInContext("saveCoupleChild(draftCouple, preservedChildId, 'Pedro Henrique')", context);
    const afterEdit = read(context, "draftCouple.children");
    assert.equal(afterEdit.length, 2);
    assert.equal(afterEdit[0].id, beforeEdit[0].id);
    assert.equal(afterEdit[0].name, "Pedro Henrique");

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
    assert.match(guestSource, /saveCoupleChild\(couple, wizardState\.editingChildId, name\)/);
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

test("modelo local prepara grupo de sistema e pessoas para o banco futuro", () => {
    assert.match(guestSource, /isSystem: isGodparentsGroup \|\| Boolean\(group\.isSystem\)/);
    assert.match(guestSource, /systemKey: isGodparentsGroup \? "godparents" : null/);
    assert.match(guestSource, /sortOrder: isGodparentsGroup \? 0/);
    assert.match(guestSource, /firstPerson: normalizeAdultPerson/);
    assert.match(guestSource, /secondPerson: normalizeAdultPerson/);
    assert.match(guestSource, /normalized\.children =/);
    assert.match(guestSource, /isChild: true/);
    assert.match(guestSource, /function findGuestSystemGroup\(groups, systemKey\)/);
});

test("documentação descreve o modelo local e o mapeamento futuro sem executar SQL", () => {
    assert.match(guestDocumentation, /Padrinhos & Madrinhas/);
    assert.match(guestDocumentation, /`isChild`/);
    assert.match(guestDocumentation, /`systemKey`/);
    assert.match(guestDocumentation, /## 16\. Modelo futuro: `guest_groups`/);
    assert.match(guestDocumentation, /## 17\. Modelo futuro: `guest_members`/);
    assert.match(guestDocumentation, /`pair_id`/);
    assert.match(guestDocumentation, /`household_id`/);
    assert.match(guestDocumentation, /`couple_child`/);
    assert.doesNotMatch(guestDocumentation, /`child_couple`/);
    assert.match(guestDocumentation, /RLS futura/);
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

test("persistência continua local e não chama Supabase ou backend", () => {
    assert.match(guestSource, /saveState\(\)/);
    assert.doesNotMatch(guestSource, /supabase|fetch\(|XMLHttpRequest|createCurrentWeddingGuest|updateCurrentWeddingGuest/i);
    assert.match(guestSource, /state\.guests = normalizeGuestGroups\(state\.guests\)/);
    assert.doesNotMatch(guestSource, /state\.guests = normalizeGuestGroups\(state\.guests\);\s*saveState\(\)/);
});
