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

O modelo local está na versão 6:

```json
{
  "schemaVersion": 6,
  "id": "group-...",
  "category": "couples",
  "name": "Casais",
  "relationshipGroup": "",
  "notes": "",
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
  "notes": "Precisa de cadeira próxima à saída.",
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
    "name": "João",
    "notes": "Vem de outra cidade."
  },
  "secondPerson": {
    "id": "couple-...-second",
    "name": "Maria",
    "notes": ""
  },
  "children": [
    {
      "id": "couple-child-...",
      "name": "Pedro",
      "notes": "3 anos.",
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

Ao editar um casal com `children.length > 0`, a seção abre automaticamente e restaura todos os IDs, nomes e observações individuais.

Quando o cartão agregado contém vários casais, um seletor interno escolhe o casal ativo por ID. Assim, nomes e crianças são editados na unidade correta sem recriar ou duplicar os demais casais.

## 8. Família

Família mantém `isChild` e `notes` por integrante. `buildFamilyMemberFullName()` acrescenta o sobrenome sem duplicá-lo e preserva ID, classificação e observação.

Exemplo: nome `Lucas`, família `Oliveira` e opção marcada resultam em `name: "Lucas Oliveira"` e `isChild: true`.

## 9. Convidado avulso

Cada integrante de um grupo avulso possui seu próprio `isChild` e `notes`. O grupo em `relationshipGroup` é preservado durante a edição. A observação da pessoa não é confundida com a origem do grupo. O botão de crianças vinculadas a casal não é usado nesse fluxo.

## 10. Padrinhos & Madrinhas

O grupo fixado continua identificado por `systemKey: "godparents"`, consolidado sem duplicações e ordenado primeiro quando corresponde aos filtros.

Casais de padrinhos possuem `id`, `firstPerson` e `secondPerson`, sem `children`; cada adulto tem seu próprio `notes`. Avulsos possuem `id`, `name` e `notes`. A normalização elimina qualquer classificação infantil antiga apenas no modelo em memória; a persistência só é atualizada após uma alteração confirmada pelo usuário.

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

Revisão e modal de integrantes mantêm os casais agrupados, mas exibem cada adulto em uma linha própria para associar corretamente sua observação. Crianças permanecem aninhadas e usam a etiqueta textual “Criança”, separada de `notes`. Em desktop, nome e observação ficam em colunas; no celular, a observação desce abaixo do nome. Padrinhos & Madrinhas não exibe referência infantil.

## 13. Lista completa

“Ver lista completa” usa as mesmas contagens e ordenação. Crianças vinculadas ficam aninhadas sob o casal, com nomes e observações individuais visíveis. `group.notes` aparece separadamente com o rótulo “Observação do grupo”. Grupos fechados continuam incluídos.

## 14. Impressão e PDF

A impressão mantém os dois adultos agrupados como casal, mas cada pessoa ganha uma linha própria; `person.notes`, quando preenchido, aparece abaixo do nome em fonte menor. Crianças seguem em uma lista vinculada, também com observação individual opcional. `group.notes` aparece separadamente como “Observação do grupo”. O resumo final contém total de convidados, adultos e crianças.

Família e avulsos mantêm “— Criança” junto ao nome. Padrinhos & Madrinhas nunca mostra essa indicação. Nenhuma biblioteca externa é utilizada.

## 15. Busca e compatibilidade

`getGroupSearchText()` inclui nomes de grupos, adultos, avulsos e todas as crianças em `couple.children`. Buscar pelo nome de uma criança retorna o cartão Casais, sem criar cartão separado.

`normalizeGuestGroups()` aceita registros antigos. Para casais com `firstPersonName` e `secondPersonName`, os nomes e o ID do par são preservados e os IDs dos adultos são derivados de forma determinística quando ausentes.

Pessoas antigas sem `notes` recebem `notes: ""` somente no estado normalizado em memória. Valores existentes de `group.notes` e `person.notes` são limpos e preservados. A leitura, por si só, não regrava o `localStorage`.

Marcações antigas `firstPersonIsChild`, `secondPersonIsChild` ou `isChild` dentro de `firstPerson`/`secondPerson` são ignoradas. Os dois nomes continuam existindo como adultos; nenhuma criança sem nome é criada. `isClosed` e demais dados válidos do grupo são preservados. A leitura não grava automaticamente o estado normalizado.

## 16. Modelo futuro: `guest_groups`

Mapeamento conceitual futuro:

| JavaScript | Campo remoto | Tipo sugerido |
|---|---|---|
| `id` | `id` | UUID |
| casamento atual | `wedding_id` | UUID |
| `category` | `category` | texto |
| `name` | `name` | texto |
| `relationshipGroup` | `relationship_group` | texto anulável |
| `notes` | `notes` | texto não nulo com padrão vazio |
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
| `person.notes` | `notes` | texto não nulo com padrão vazio |
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

## 22. Dois níveis de observação

Há dois dados independentes, ambos sempre normalizados como `string` e com padrão `""`:

- `group.notes`: pertence ao grupo inteiro;
- `person.notes`: pertence somente à pessoa cujo objeto contém o campo.

Uma observação de casal inteiro deve ser salva em `group.notes`. As observações de `firstPerson`, `secondPerson` e de cada item de `children` nunca são combinadas entre si. O detector de possíveis duplicados continua comparando nomes e ignora os dois campos de observação.

### Observação do grupo

O campo continua disponível na seção expansível da revisão. Além disso, cada cartão possui a ação “+ Adicionar observação ao grupo” ou “Editar observação do grupo”. Essa ação abre um diálogo pequeno e altera somente `group.notes`; integrantes, IDs, categoria, `isClosed`, `systemKey` e ordem são preservados. Editar a observação não reabre um grupo fechado.

Quando preenchido, `group.notes` aparece:

- por inteiro na seção inferior “Observações” do diálogo “Ver integrantes”;
- como “Observação do grupo” na lista completa;
- como “Observação do grupo” abaixo dos metadados na impressão/PDF.

O texto completo não é exibido no cartão. Apagar o conteúdo e salvar produz `group.notes: ""`.

### Observação individual

Ao criar ou editar qualquer pessoa, “+ Adicionar observação” expande um campo discreto. Ele existe para:

- integrantes de Família;
- convidados avulsos e integrantes de grupos personalizados;
- cada um dos dois adultos de Casais;
- cada criança vinculada ao casal;
- cada adulto de casal de Padrinhos & Madrinhas;
- padrinho ou madrinha avulso.

Na edição, o campo abre preenchido quando há conteúdo e pode ser alterado ou apagado sem trocar o ID da pessoa. Em “Ver integrantes” e na lista completa, o nome fica à esquerda e a observação à direita em desktop. Abaixo de 580 px, a observação passa para baixo do nome, aceita múltiplas linhas e não usa corte ou `ellipsis`. No PDF, aparece abaixo do nome em fonte menor.

`normalizeGuestPerson()` centraliza `id`, `name`, `notes` e, quando aplicável, `isChild`. Os wrappers de adulto e criança reutilizam essa função, evitando regras duplicadas entre categorias.

## 23. Mapeamento futuro de `notes`

Os destinos conceituais são distintos:

| Modelo local | Destino futuro | Tipo PostgreSQL sugerido |
|---|---|---|
| `group.notes` | `guest_groups.notes` | `TEXT NOT NULL DEFAULT ''` |
| `person.notes` | `guest_members.notes` | `TEXT NOT NULL DEFAULT ''` |

O padrão vazio evita dois estados equivalentes para “sem observação” (`NULL` e string vazia). Esta é somente uma decisão de modelagem documentada. Nenhum SQL, tabela, migration, política RLS ou integração remota foi criado nesta etapa.

## 24. Percurso central de pessoas

`getAllGuestPeople(groups)` recebe grupos já disponíveis em memória e devolve cada pessoa individualmente com contexto:

```js
{
  id,
  name,
  notes,
  isChild,
  groupId,
  groupName,
  category,
  pairId,
  householdId,
  memberType
}
```

A função percorre integrantes de famílias, avulsos e grupos personalizados, os dois adultos de cada casal, crianças vinculadas, casais de Padrinhos & Madrinhas e padrinhos/madrinhas avulsos. Busca, contagens e detector usam esse percurso central, evitando regras diferentes para cada visualização.

Para casais comuns, os adultos compartilham `pairId` e `householdId`; a criança tem `pairId: null` e compartilha o `householdId` do casal. Para casal de padrinhos, os dois adultos compartilham ambos os identificadores. Esses contextos já preparam o achatamento futuro em `guest_members`.

## 25. Normalização usada pelo detector

`normalizeGuestNameForComparison(name)` existe somente para comparação. Ela:

- remove espaços no início e no fim;
- reduz espaços duplicados;
- converte para minúsculas;
- remove diacríticos simples, como o acento de “João”;
- transforma pontuação em separadores de palavras.

O nome visual continua sendo salvo conforme digitado depois da limpeza normal já existente. Portanto, `João Silva`, ` JOÃO  SILVA ` e `joao silva` são equivalentes para o detector, sem transformar o nome exibido em caixa baixa.

## 26. Detector de possíveis duplicados

`findPotentialGuestDuplicates(candidates, groups, ignoredPersonIds)` é desacoplada de `localStorage`, Supabase ou qualquer requisição. Ela recebe candidatos e grupos normalizados em memória, usa `getAllGuestPeople()` e retorna os resultados com seu grupo de origem.

Há dois níveis:

1. `exact`: nomes equivalentes após a normalização;
2. `similar`: nomes com alta confiança, mesma quantidade de palavras, primeiro e último termos iguais e diferença intermediária limitada a inicial versus nome completo. Exemplo: `João Pedro Silva` e `João P. Silva`.

Uma palavra coincidente ou somente o mesmo sobrenome não gera alerta. Não foi instalada biblioteca de busca aproximada.

O detector é executado antes da operação. Se não houver resultado, a inclusão ou o salvamento segue normalmente. Se houver, abre o diálogo “Possível convidado duplicado”, que mostra o candidato, os nomes encontrados e seus grupos.

“Voltar e revisar” fecha o aviso, mantém o texto no rascunho e devolve o foco ao campo apropriado. “Adicionar mesmo assim” registra a aceitação apenas para aquele ID e nome durante o modal atual e executa a operação original uma única vez. Duplicados nunca são bloqueados.

O diálogo usa `<dialog>`, botões nativos e tratamento de `cancel`; funciona com toque, fecha com Esc e direciona/restaura o foco. A ação pendente é anulada antes de ser executada para impedir clique duplo de repetir a inclusão.

## 27. Detector durante edição

Cada pessoa possui ID estável. Ao verificar uma edição, o ID do candidato é ignorado, impedindo que o registro seja comparado consigo mesmo. Outra pessoa com nome equivalente, inclusive no mesmo grupo ou em outro grupo, continua sendo encontrada.

O estado do assistente também guarda os nomes originais por ID. Isso permite verificar mudanças feitas diretamente nos campos dos adultos de Casais e alterações de sobrenome provocadas pela edição do nome de uma Família antes de salvar o grupo.

## 28. Regras por fluxo

- Família: o nome completo resultante, já com o sobrenome familiar, é verificado ao adicionar ou editar integrante. Renomear a família também verifica os nomes completos alterados antes do salvamento.
- Avulsos e grupos personalizados: cada integrante é verificado ao clicar em adicionar ou salvar a pessoa.
- Casais: primeira e segunda pessoa são candidatas separadas e são comparadas com a lista existente antes de salvar. Elas não são comparadas uma contra a outra apenas por fazerem parte do mesmo novo casal. Se uma tiver resultado, aparece uma seção; se as duas tiverem, aparecem as duas no mesmo aviso.
- Crianças de casal: a criança é verificada antes de entrar em `couple.children`; se o casal aceitar o alerta, ela mantém o ID e o `householdId` corretos e é incluída uma vez.
- Padrinhos & Madrinhas: os dois integrantes de um casal são verificados separadamente; padrinho ou madrinha avulso usa a mesma rotina. O fato de ser grupo de sistema não cria exceções.

## 29. Funcionamento depois do Supabase

O fluxo planejado permanece:

```text
Supabase -> estado normalizado em memória -> getAllGuestPeople() -> detector
```

Somente a origem e o salvamento do estado mudarão. Normalização, percurso, comparação, contexto de grupo e diálogo não dependem da persistência local, portanto não precisarão ser reescritos para a futura integração.

## 30. Verificação desta versão

Os testes em `tests/frontend-guests.test.js` cobrem modelo antigo, IDs, famílias, casais, crianças, Padrinhos & Madrinhas, busca, filtros, contagens, impressão, normalização de nomes, correspondência exata e semelhante, exclusão do próprio ID, homônimo em outro grupo, `group.notes`, `person.notes`, separação entre os dois níveis, edição isolada pelo cartão e estrutura acessível/responsiva dos diálogos.

Os contratos responsivos cobrem viewports de 375 px, 390 px, 430 px e desktop. Em telas pequenas, ações podem quebrar linha, os diálogos respeitam a altura dinâmica e `safe-area-inset-bottom`, e observações longas usam quebra natural sem rolagem horizontal.

A funcionalidade de capacidade da lista versus capacidade do local não foi implementada. Banco, SQL, migrations, RLS, Supabase, backend, Locais, Visão Geral, sidebar e demais páginas permaneceram fora do escopo.

## 31. Posicionamento dos dialogs e bloqueio de scroll

Todos os dialogs abertos na página de Convidados usam a mesma responsabilidade de scroll. `lockPageScroll()` salva `window.scrollX` e `window.scrollY`, fixa o `body` nessa posição, bloqueia `overflow` e `overscroll` e adiciona compensação equivalente à largura da scrollbar no desktop. `unlockPageScroll()` restaura os estilos anteriores e volta exatamente à posição salva.

`syncPageScrollLock()` consulta `dialog[open]`. Portanto, fechar uma confirmação ou aviso sobre outro modal não libera o fundo enquanto ainda existir outro dialog aberto. Um `MutationObserver` e o evento `beforetoggle` também incluem dialogs globais presentes nesta página, como “Editar casamento”, sem duplicar lógica em `js/app.js`.

Os dialogs abertos usam posição fixa, margens automáticas e `max-height` baseado em `100dvh`, descontando margens de segurança e `safe-area`. O `margin-bottom` isolado que empurrava alguns modais para a parte inferior foi removido. O backdrop permanece fixo e conserva o escurecimento e o desfoque globais.

No dialog “Observação do grupo”, o formulário usa as linhas `cabeçalho / conteúdo / ações`. Apenas `.group-notes-content` recebe `overflow-y: auto` quando necessário; cabeçalho e ações continuam acessíveis. O textarea mantém gesto vertical próprio. A página de fundo permanece fixa durante wheel, toque, trackpad e navegação por página, e a compensação da scrollbar evita deslocamento horizontal no desktop.
