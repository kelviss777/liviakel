# Convidados — modelo local e preparação para persistência remota

## 1. Escopo atual

A página de Convidados usa HTML, CSS e JavaScript puro. Cadastro guiado, edição, exclusão, busca, filtros, fechamento, lista completa e impressão/PDF continuam disponíveis.

Os dados permanecem no `localStorage`, por meio do fluxo existente de `js/app.js`. Não há integração de Convidados com Supabase ou backend nesta etapa.

Arquivos da funcionalidade:

- `pages/convidados/index.html`: página e diálogos;
- `pages/convidados/style.css`: interface, responsividade e impressão;
- `pages/convidados/main.js`: modelo, normalização, contagens e fluxos;
- `tests/frontend-guests.test.js`: testes de modelo e interface;
- `js/app.js`: persistência local compartilhada, sem nova lógica específica.

## 2. Categorias

| `category` | Apresentação | Conteúdo |
|---|---|---|
| `godparents` | Padrinhos & Madrinhas | `couples` e `individuals`, somente adultos |
| `family` | Família | `members`, cada integrante pode ser adulto ou criança |
| `individual_group` | Grupo de avulsos | `members`, cada pessoa pode ser adulta ou criança |
| `couples` | Casais | um casal adulto e seu array `children` |

## 3. Estrutura local dos grupos

O modelo local está na versão 4:

```json
{
  "schemaVersion": 4,
  "id": "group-...",
  "category": "couples",
  "name": "Casais",
  "relationshipGroup": "",
  "isClosed": false,
  "isSystem": false,
  "systemKey": null,
  "sortOrder": null,
  "members": [],
  "couples": [],
  "individuals": [],
  "createdAt": "2026-07-28T12:00:00.000Z"
}
```

`systemKey`, e não o título visível, identifica grupos controlados pelo sistema. Padrinhos & Madrinhas usa `isSystem: true`, `systemKey: "godparents"` e `sortOrder: 0`.

## 4. Onde a opção Criança aparece

A classificação individual `isChild` aparece somente em:

- integrantes de Família;
- convidados avulsos de Amigos, Trabalho, Igreja, Faculdade, Outros ou grupos personalizados.

Estrutura dessas pessoas:

```json
{
  "id": "member-...",
  "name": "Eduardo Oliveira",
  "isChild": true
}
```

O padrão é `false`. A opção é editável junto ao nome da própria pessoa.

## 5. Onde a opção Criança não aparece

Não existe checkbox individual de criança:

- nos dois adultos da categoria Casais;
- nos casais de Padrinhos & Madrinhas;
- nos padrinhos ou madrinhas avulsos.

Padrinhos & Madrinhas também não possui botão “Tem criança?”, lista infantil, etiqueta ou contagem específica. Toda pessoa desse grupo é tratada como adulta.

## 6. Estrutura atual do casal

Casais comuns usam dois adultos e um array separado para acompanhantes infantis:

```json
{
  "id": "couple-...",
  "firstPerson": {
    "id": "couple-...-first",
    "name": "João"
  },
  "secondPerson": {
    "id": "couple-...-second",
    "name": "Maria"
  },
  "children": [
    {
      "id": "couple-child-...",
      "name": "Pedro",
      "isChild": true
    }
  ]
}
```

Os adultos não possuem classificação infantil. `children.length > 0` é a única fonte para determinar se há crianças; nenhum `hasChildren` é persistido.

## 7. Fluxo “Tem criança?”

O botão é um `button` real com `type="button"`, `aria-expanded` e `aria-controls`. Inicialmente a seção fica recolhida. Ao expandir, o usuário pode:

- adicionar uma ou várias crianças;
- editar uma criança preservando seu ID;
- cancelar a edição em andamento;
- remover somente a criança selecionada.

Nomes são limpos com `cleanGuestText()`. Nomes vazios não são aceitos. A lista temporária possui `aria-live="polite"`. Alterações permanecem no rascunho até a revisão final; cancelar o modal descarta a cópia editada.

Ao editar um casal com `children.length > 0`, a seção abre automaticamente e restaura todos os IDs e nomes.

Quando o cartão agregado contém vários casais, um seletor interno escolhe o casal ativo por ID. Assim, nomes e crianças são editados na unidade correta sem recriar ou duplicar os demais casais.

## 8. Família

Família mantém `isChild` por integrante. `buildFamilyMemberFullName()` acrescenta o sobrenome sem duplicá-lo e preserva ID e classificação.

Exemplo: nome `Lucas`, família `Oliveira` e opção marcada resultam em `name: "Lucas Oliveira"` e `isChild: true`.

## 9. Convidado avulso

Cada integrante de um grupo avulso possui seu próprio `isChild`. O grupo em `relationshipGroup` é preservado durante a edição. O botão de crianças vinculadas a casal não é usado nesse fluxo.

## 10. Padrinhos & Madrinhas

O grupo fixado continua identificado por `systemKey: "godparents"`, consolidado sem duplicações e ordenado primeiro quando corresponde aos filtros.

Casais de padrinhos possuem `id`, `firstPerson` e `secondPerson`, sem `children`. Avulsos possuem somente `id` e `name`. A normalização elimina qualquer classificação infantil antiga apenas no modelo em memória; a persistência só é atualizada após uma alteração confirmada pelo usuário.

## 11. Contagens centralizadas

As funções `countGroupPeople()`, `countChildrenInGroup()` e `countAdultsInGroup()` são reutilizadas por cartões, resumo, detalhes, lista completa e PDF.

Regras:

- Família: uma pessoa por integrante; `isChild` define a classificação;
- Avulsos: uma pessoa por integrante; `isChild` define a classificação;
- Casais: dois adultos mais uma pessoa por item de `children`;
- Padrinhos & Madrinhas: dois adultos por casal e um adulto por avulso; zero crianças;
- adultos = total de pessoas − crianças.

Assim, João + Maria + Pedro + Ana representam 4 pessoas, 2 adultos e 2 crianças.

## 12. Cartões, detalhes e revisão

O cartão Casais mostra quantidade de casais, total real de pessoas, quantidade de crianças quando maior que zero e estado aberto/fechado.

Revisão e modal de integrantes apresentam o casal como “João e Maria” e, abaixo, os nomes em “Crianças”. Família e avulsos continuam usando a etiqueta textual “Criança” ao lado da pessoa. Padrinhos & Madrinhas não exibe referência infantil.

## 13. Lista completa

“Ver lista completa” usa as mesmas contagens e ordenação. Crianças vinculadas ficam aninhadas sob o casal, com seus nomes visíveis. Grupos fechados continuam incluídos.

## 14. Impressão e PDF

A impressão mostra os dois adultos na linha do casal e, quando existir, uma lista “Crianças” com os nomes vinculados. O resumo final contém total de convidados, adultos e crianças.

Família e avulsos mantêm “— Criança” junto ao nome. Padrinhos & Madrinhas nunca mostra essa indicação. Nenhuma biblioteca externa é utilizada.

## 15. Busca e compatibilidade

`getGroupSearchText()` inclui nomes de grupos, adultos, avulsos e todas as crianças em `couple.children`. Buscar pelo nome de uma criança retorna o cartão Casais, sem criar cartão separado.

`normalizeGuestGroups()` aceita registros antigos. Para casais com `firstPersonName` e `secondPersonName`, os nomes e o ID do par são preservados e os IDs dos adultos são derivados de forma determinística quando ausentes.

Marcações antigas `firstPersonIsChild`, `secondPersonIsChild` ou `isChild` dentro de `firstPerson`/`secondPerson` são ignoradas. Os dois nomes continuam existindo como adultos; nenhuma criança sem nome é criada. `isClosed` e demais dados válidos do grupo são preservados. A leitura não grava automaticamente o estado normalizado.

## 16. Modelo futuro: `guest_groups`

Mapeamento conceitual futuro:

| JavaScript | Campo remoto | Tipo sugerido |
|---|---|---|
| `id` | `id` | UUID |
| casamento atual | `wedding_id` | UUID |
| `category` | `category` | texto |
| `name` | `name` | texto |
| `isClosed` | `is_closed` | booleano |
| `isSystem` | `is_system` | booleano |
| `systemKey` | `system_key` | texto anulável |
| `sortOrder` | `sort_order` | inteiro |
| `createdAt` | `created_at` | data/hora com fuso |
| futuro | `updated_at` | data/hora com fuso |

## 17. Modelo futuro: `guest_members`

Ao achatar o modelo local, cada pessoa será uma linha conceitual:

| Origem atual ou derivada | Campo remoto | Regra |
|---|---|---|
| `person.id` | `id` | ID da pessoa |
| `group.id` | `guest_group_id` | grupo pai |
| `person.name` | `name` | obrigatório |
| classificação | `is_child` | verdadeiro apenas para Família/Avulso marcados e `couple.children` |
| contexto | `member_type` | tipo conceitual abaixo |
| `couple.id` para adultos | `pair_id` | compartilhado pelos dois adultos |
| unidade do casal | `household_id` | compartilhado pelos adultos e crianças vinculadas |
| posição | `sort_order` | ordem no grupo/unidade |
| futuro | `created_at` / `updated_at` | datas remotas |

Tipos conceituais recomendados:

- `family_member`;
- `individual_guest`;
- `couple_adult`;
- `couple_child`;
- `godparent_couple`;
- `godparent_individual`.

## 18. Uso futuro de `pair_id`

Os dois adultos do casal compartilharão o `pair_id` derivado de `couple.id`. Crianças vinculadas terão `pair_id` nulo, pois não formam o par. O ID individual de cada adulto continua independente.

## 19. Uso futuro de `household_id`

Os dois adultos e todas as crianças de `couple.children` compartilharão o mesmo `household_id`. Esse campo representará a unidade que chega junta e permitirá recuperar o vínculo das crianças sem classificá-las como parte do par adulto.

## 20. Persistência e segurança futuras

Uma integração futura deverá associar grupos ao `wedding_id`, validar nomes não vazios, restringir uma chave de sistema por casamento e preservar a ordem. A RLS futura deverá autorizar grupos e integrantes por meio do casamento e de seus membros.

Nenhuma tabela, migration, política ou comando de banco foi criado ou executado nesta etapa.

## 21. Limites desta alteração

Não foram alterados sidebar, Locais, Checklist, Orçamento, Visão geral, autenticação, backend ou Supabase. `js/app.js` e `assets/global.css` foram apenas analisados; não precisaram de mudança.
