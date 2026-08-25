# Convidados — modelo local e integração com Supabase

## 1. Escopo atual

A página de Convidados usa HTML, CSS e JavaScript puro. Cadastro guiado, edição, exclusão, busca, filtros, fechamento, lista completa e impressão/PDF continuam disponíveis.

O Supabase é a fonte de verdade de Convidados. `guest_groups` guarda os grupos e `guest_members` guarda as pessoas. O modelo versão 6 continua existindo em memória para renderização, busca, filtros, detector de duplicados, lista completa e PDF, mas não é regravado por `saveState()`.

O `localStorage` é lido somente para a migração automática dos dados anteriores. Depois do carregamento remoto, nenhum cartão depende do armazenamento do dispositivo.

Arquivos da funcionalidade:

- `pages/convidados/index.html`: página e diálogos;
- `pages/convidados/style.css`: interface, responsividade e impressão;
- `pages/convidados/main.js`: modelo, normalização, reconstrução, migração e fluxos assíncronos;
- `tests/frontend-guests.test.js`: testes de modelo, interface, mapeamentos e mocks do Supabase;
- `js/supabase.js`: acesso remoto centralizado a `guest_groups` e `guest_members`;
- `js/app.js`: preserva a leitura dos convidados antigos para migração e deixa de gravar convidados remotos.

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

## 16. Modelo remoto: `guest_groups`

`mapGuestGroupRowToLocal()` converte a linha remota para camelCase. `mapGuestGroupToDatabase()` faz o caminho inverso e omite arrays, IDs técnicos, datas e estado temporário de UI:

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
| atualização remota | `updated_at` | data/hora com fuso |

## 17. Modelo remoto: `guest_members`

`mapGuestMemberRow()` converte linhas do banco. `flattenGuestGroupMembersForDatabase()` achata o modelo local; cada pessoa é uma linha:

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
| banco | `created_at` / `updated_at` | datas remotas |

Valores de `member_type` utilizados exatamente como suportados pelo banco:

- `family_member`;
- `individual_guest`;
- `couple_adult`;
- `couple_child`;
- `godparent_couple`;
- `godparent_individual`.

## 18. Uso de `pair_id`

Os dois adultos do casal compartilham um `pair_id` UUID. Crianças vinculadas têm `pair_id` nulo, pois não formam o par. O ID individual de cada adulto continua independente. Em novos casais e na migração, IDs locais como `couple-...` nunca são enviados: `crypto.randomUUID()` cria o vínculo remoto. Na edição, o UUID existente é preservado.

## 19. Uso de `household_id`

Os dois adultos e todas as crianças de `couple.children` compartilham o mesmo `household_id` UUID. Esse campo representa a unidade que chega junta e permite reconstruir as crianças dentro do casal correto. Casais de padrinhos também compartilham um `household_id`, embora não aceitem crianças.

## 20. Persistência e segurança

Todas as operações chamam a camada de `js/supabase.js`. Ela resolve o contexto pelo fluxo Supabase Auth → `wedding_members` → `wedding_id`. A interface nunca fornece nem escolhe livremente o casamento. O `wedding_id` é acrescentado somente pela função autenticada de criação do grupo.

As policies RLS existentes autorizam grupos e integrantes pelo casamento. Erros de permissão são registrados integralmente no console e traduzidos para mensagem amigável; o código não tenta contornar RLS, não usa `service_role` e não acessa `auth.users`.

Nenhuma tabela, migration, policy ou comando SQL foi criado ou executado nesta integração.

## 21. Limites desta integração

Não foram alterados sidebar, Locais, Checklist, Orçamento, Visão geral, autenticação, backend, schema ou policies RLS. `public.guests` não é consultada, inserida, atualizada, excluída nem apagada. A nova tela usa exclusivamente `guest_groups` e `guest_members`.

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

## 23. Persistência de `notes`

Os destinos remotos são distintos:

| Modelo local | Destino remoto | Operação |
|---|---|---|
| `group.notes` | `guest_groups.notes` | UPDATE isolado de `notes` |
| `person.notes` | `guest_members.notes` | UPDATE incremental da pessoa por ID |

Valores `NULL` vindos do banco viram `""` no modelo em memória. Ao salvar uma observação de grupo, somente `guest_groups.notes` é enviada; integrantes e `is_closed` não são alterados. Observações individuais seguem no payload da pessoa correta, preservando ID, `member_type`, `pair_id`, `household_id` e `is_child`.

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

## 29. Funcionamento com o Supabase

O fluxo em produção é:

```text
Supabase Auth -> wedding_members -> guest_groups + guest_members
              -> estado normalizado em memória
              -> getAllGuestPeople() -> detector/lista/PDF
```

`initializeGuests()` mostra o estado de carregamento, consulta os dois conjuntos de linhas, chama `rebuildGuestGroupsFromRows()`, normaliza os grupos e só então libera os controles. Busca e filtros continuam locais e não fazem requisição a cada tecla. Recarregar a página ou entrar em outro dispositivo reconstrói a mesma lista a partir do casamento autenticado.

No cadastro, o grupo é criado antes dos integrantes. O estado e o modal só são concluídos depois dos dois sucessos. Se a criação de integrantes falhar, o frontend tenta excluir o grupo recém-criado como compensação, registra qualquer falha adicional e mantém o formulário.

Na edição, `replaceOrSyncGuestGroupMembers()` compara IDs remotos: atualiza apenas pessoas alteradas, insere pessoas sem UUID remoto e exclui somente IDs removidos. Não existe “delete tudo e reinsere”. Depois da operação, a lista é recarregada do Supabase. Uma falha intermediária também dispara tentativa de recarga sem apagar o rascunho.

Fechar/Reabrir usa um UPDATE isolado de `is_closed`. A observação do grupo usa um UPDATE isolado de `notes`. A exclusão comum remove apenas `guest_groups`; o `ON DELETE CASCADE` já existente cuida de `guest_members`. Para `system_key = "godparents"`, a ação remove os integrantes e mantém o grupo de sistema vazio, evitando perder sua identidade fixa.

## 30. Verificação desta versão

Os testes em `tests/frontend-guests.test.js` cobrem modelo antigo, mapeamentos banco ↔ JavaScript, os seis `member_type`, IDs UUID, reconstrução por `pair_id` e `household_id`, famílias, avulsos, casais, crianças, Padrinhos & Madrinhas, busca, filtros, contagens, impressão, duplicados, observações, acesso autenticado, RLS e sincronização incremental com mocks. Nenhum teste chama o projeto Supabase real.

Os contratos responsivos cobrem viewports de 375 px, 390 px, 430 px e desktop. Em telas pequenas, ações podem quebrar linha, os diálogos respeitam a altura dinâmica e `safe-area-inset-bottom`, e observações longas usam quebra natural sem rolagem horizontal.

A funcionalidade de capacidade da lista versus capacidade do local não foi implementada. SQL, migrations, schema, policies RLS, backend, Locais, Visão Geral, sidebar e demais páginas permaneceram fora do escopo.

## 31. Posicionamento dos dialogs e bloqueio de scroll

Todos os dialogs abertos na página de Convidados usam a mesma responsabilidade de scroll. `lockPageScroll()` salva `window.scrollX` e `window.scrollY`, fixa o `body` nessa posição, bloqueia `overflow` e `overscroll` e adiciona compensação equivalente à largura da scrollbar no desktop. `unlockPageScroll()` restaura os estilos anteriores e volta exatamente à posição salva.

`syncPageScrollLock()` consulta `dialog[open]`. Portanto, fechar uma confirmação ou aviso sobre outro modal não libera o fundo enquanto ainda existir outro dialog aberto. Um `MutationObserver` e o evento `beforetoggle` também incluem dialogs globais presentes nesta página, como “Editar casamento”, sem duplicar lógica em `js/app.js`.

Os dialogs abertos usam posição fixa, margens automáticas e `max-height` baseado em `100dvh`, descontando margens de segurança e `safe-area`. O `margin-bottom` isolado que empurrava alguns modais para a parte inferior foi removido. O backdrop permanece fixo e conserva o escurecimento e o desfoque globais.

No dialog “Observação do grupo”, o formulário usa as linhas `cabeçalho / conteúdo / ações`. Apenas `.group-notes-content` recebe `overflow-y: auto` quando necessário; cabeçalho e ações continuam acessíveis. O textarea mantém gesto vertical próprio. A página de fundo permanece fixa durante wheel, toque, trackpad e navegação por página, e a compensação da scrollbar evita deslocamento horizontal no desktop.

## 32. Migração do `localStorage`

`loadLegacyGuests()` preserva a leitura da chave `nosso-casamento-v1`, mas `saveState()` não grava mais `state.guests`. A migração roda silenciosamente depois da primeira leitura remota e não abre o detector visual de duplicados.

Para cada casamento são usadas duas chaves:

- `nosso-casamento-guests-backup:<weddingId>`: cópia da estrutura local anterior à primeira tentativa;
- `nosso-casamento-guests-migrated:<weddingId>`: marca criada somente depois do sucesso de todas as operações.

A identidade conservadora usa `category` + nome normalizado + `relationshipGroup` normalizado. Padrinhos & Madrinhas usa exclusivamente `system_key = "godparents"`; pessoas locais ainda ausentes são anexadas ao grupo remoto, sem criar um segundo grupo. Para outra identidade já presente, a migração não sobrescreve dados remotos ambíguos. Grupos ausentes são criados com IDs do banco, e os vínculos de casal recebem novos UUIDs seguros.

Se uma tentativa falhar, a marca não é criada, o backup e os dados originais permanecem, e a próxima carga pode tentar novamente. Grupos concluídos antes da falha são reconhecidos pela identidade e não são duplicados. Não há `localStorage.clear()` e a tabela antiga `public.guests` permanece intocada.

Durante carregamento, salvamento, alteração de estado, observação e exclusão, os controles relacionados ficam desabilitados para impedir clique duplo. Em erro, o console recebe o objeto completo, a interface mostra mensagem amigável e não apresenta sucesso nem fecha o formulário incorretamente.
