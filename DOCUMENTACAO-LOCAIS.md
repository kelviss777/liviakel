# Documentação técnica — página de Locais

> Sistema: **Nosso Casamento**  
> Escopo: estado real da página `pages/locais/index.html` na data desta análise.  
> Objetivo: servir de base para planejar a futura persistência de locais no Supabase.  
> Esta documentação não representa uma migration nem uma alteração de banco. Todo conteúdo marcado como **recomendação** ainda não existe no schema confirmado do projeto.

## 1. Resumo da página

A página de Locais permite ao casal manter uma lista de locais considerados para o casamento. Ela oferece:

- cadastro com nome, tipo e endereço obrigatórios;
- um painel expansível com descrição, avaliação, orçamento, estrutura, disponibilidade, prós e contras;
- cartões ordenados com favoritos primeiro;
- abertura do endereço no Google Maps;
- modal com os detalhes preenchidos;
- edição sem criar uma cópia do registro;
- alternância de favorito;
- exclusão por um diálogo de confirmação próprio;
- persistência local no navegador.

Fluxo principal do usuário:

1. O usuário abre o formulário por **Adicionar local**.
2. Preenche os três campos principais e, se quiser, expande **Adicionar opções detalhadas**.
3. Ao salvar, o JavaScript valida os campos, cria um objeto e o insere no início de `state.venues`.
4. `saveState()` grava o estado no `localStorage` e `renderAll()` atualiza os cartões.
5. No cartão, o usuário pode abrir o endereço no Maps, ver detalhes quando existirem, editar, favoritar/desfavoritar ou solicitar a exclusão.
6. A exclusão só é efetivada depois da confirmação no diálogo próprio.

### Armazenamento atual

Os locais **não são lidos nem gravados no Supabase** pela página. A fonte persistente atual é a propriedade `venues` do JSON salvo sob a chave `nosso-casamento-v1` no `localStorage`. O Supabase já é usado no fluxo global para autenticação e dados do casamento, mas não para os locais.

## 2. Arquivos envolvidos

### Frontend diretamente envolvido

| Arquivo | Responsabilidade atual |
|---|---|
| `pages/locais/index.html` | Estrutura do formulário, cartões, modal de detalhes e diálogo de exclusão; ordem de carregamento dos scripts. |
| `pages/locais/style.css` | Layout, estrelas, cartões, editores de prós/contras, diálogos e regras responsivas da página. |
| `pages/locais/main.js` | Modelo em memória, normalização, validações, CRUD local, renderização e eventos da página. |
| `js/app.js` | Estado global, `localStorage`, utilitários, toast e inicialização global/autenticação. |
| `js/supabase.js` | Cliente Supabase, sessão, resolução do casamento corrente e leitura/edição dos dados básicos do casamento; não acessa `venues`. |
| `assets/global.css` | Tokens visuais e estilos globais de formulários, botões, diálogos, toast e layout. |
| `components/sidebar.js` | Busca o HTML da barra lateral, marca a página ativa e navega entre páginas. |
| `components/sidebar.html` | Marcação da navegação compartilhada. |
| `components/sidebar.css` | Layout lateral e transformação em navegação inferior nas larguras menores. |
| `tests/frontend-venues.test.js` | Testes automatizados do comportamento atual de Locais. |
| `tests/frontend-settings.test.js` | Confirma a separação entre configurações no Supabase e coleções ainda locais, inclusive `venues`. |

### Backend e contrato de banco analisados para comparação

| Arquivo | Informação relevante |
|---|---|
| `backend/src/database/database.types.ts` | Define o `VenueRow` atualmente esperado. |
| `backend/src/database/table-names.ts` | Confirma o nome de tabela `venues`. |
| `backend/src/modules/venues/venues.types.ts` | Define os seis valores aceitos em `VenueType`. |
| `backend/src/modules/venues/dto/create-venue.dto.ts` | Contrato atual de criação no backend. |
| `backend/src/modules/venues/dto/update-venue.dto.ts` | Contrato de atualização parcial. |
| `backend/src/modules/venues/dto/update-venue-favorite.dto.ts` | Contrato de favorito. |
| `backend/src/modules/venues/dto/list-venues-query.dto.ts` | Filtros e paginação da listagem. |
| `backend/src/modules/venues/venues.repository.ts` | SELECT/INSERT/UPDATE/DELETE esperados e filtros por `wedding_id`. |
| `backend/src/modules/venues/venues.service.ts` | Resolução do casamento antes das operações. |
| `backend/src/modules/venues/venues.controller.ts` | Rotas REST já previstas. |
| `backend/src/modules/members/wedding-context.service.ts` | Resolve o único vínculo do usuário em `wedding_members`. |
| `backend/src/modules/members/members.repository.ts` | Consulta os vínculos do usuário. |
| `backend/src/common/guards/supabase-auth.guard.ts` | Autentica o bearer token e preenche a requisição. |
| `backend/src/common/types/authenticated-user.type.ts` | Tipos do usuário e do casamento corrente. |
| `backend/src/common/types/authenticated-request.type.ts` | Estrutura da requisição autenticada. |
| `backend/src/infrastructure/supabase/supabase-user-client.factory.ts` | Cria um cliente com o token do usuário, mantendo RLS ativa. |
| `backend/src/infrastructure/supabase/supabase.service.ts` | Valida o token consultando o usuário no Supabase Auth. |
| `backend/src/main.ts` | Confirma validação estrita dos DTOs e prefixo `api/v1`. |
| `backend/README.md` | Documenta as suposições atuais de schema e endpoints. |
| `README.md` do workspace | Contexto histórico; contém descrições desatualizadas em relação ao código atual. |

Não foi encontrado no repositório um arquivo SQL ou migration que defina `public.venues`. Assim, a existência física de outras colunas no Supabase não pode ser confirmada por este código.

## 3. Modelo completo do objeto de local

### 3.1 Forma criada atualmente pelo formulário

Um local novo é criado com **19 propriedades**:

```js
{
    id: makeId(),
    name,
    type,
    address,
    favorite: false,
    description,
    rating,
    budgetValue,
    depositValue,
    decorationOption,
    hasBridalRoom,
    capacity,
    hasParking,
    spaceAvailability,
    startTime,
    endTime,
    availableDate,
    pros,
    cons
}
```

O código aceita registros antigos incompletos. `normalizeVenue()` os projeta para a mesma forma lógica e aplica valores padrão durante leitura/renderização. Essa normalização não grava automaticamente o resultado de volta no `localStorage`.

### 3.2 Propriedades, tipos e padrões

Na coluna “Obrigatório”, **sim (entrada)** significa que o usuário precisa preencher o campo; **gerado** significa que o JavaScript o fornece; e **não** significa que o campo aceita o valor vazio indicado. Todos os 19 nomes aparecem no objeto criado pelo fluxo atual.

| Propriedade | Tipo JavaScript normalizado | Obrigatório | Valor padrão | Descrição |
|---|---|---:|---|---|
| `id` | normalmente `string` | Gerado | sem padrão de normalização | Identificador produzido por `makeId()`; indispensável às ações de cartão. Registros antigos podem tecnicamente chegar sem ele. |
| `name` | `string` | Sim (entrada) | `""` na normalização | Nome do local. |
| `type` | `string` | Sim (entrada) | `""` na normalização | Tipo visual do local. |
| `address` | `string` | Sim (entrada) | `""` na normalização | Endereço e termo de busca do Maps. |
| `favorite` | `boolean` | Gerado | `false` | Estado de favorito. |
| `description` | `string` | Não | `""` | Descrição detalhada. |
| `rating` | `number` inteiro ou `null` | Não | `null` | Nota de 1 a 5. |
| `budgetValue` | `number` ou `null` | Não | `null` | Orçamento total. |
| `depositValue` | `number` ou `null` | Não | `null` | Valor da entrada. |
| `decorationOption` | `string` enumerada | Não | `"unknown"` | Situação da decoração. |
| `hasBridalRoom` | `boolean` | Não | `false` | Indica espaço para a noiva. |
| `capacity` | `number` inteiro ou `null` | Não | `null` | Capacidade máxima. |
| `hasParking` | `boolean` | Não | `false` | Indica estacionamento. |
| `spaceAvailability` | `string` enumerada | Não | `"unknown"` | Uso possível do espaço. |
| `startTime` | `string` | Não | `""` | Horário inicial no formato do `<input type="time">`. |
| `endTime` | `string` | Não | `""` | Horário final no formato do `<input type="time">`. |
| `availableDate` | `string` | Não | `""` | Data no formato do `<input type="date">`, normalmente `YYYY-MM-DD`. |
| `pros` | `Array<{id:string,title:string,description:string}>` | Não | `[]` | Lista estruturada de pontos positivos. |
| `cons` | `Array<{id:string,title:string,description:string}>` | Não | `[]` | Lista estruturada de pontos negativos. |

### 3.3 Onde as propriedades circulam

| Grupo | Criação | Leitura/exibição | Alteração |
|---|---|---|---|
| `id`, `name`, `type`, `address` | submit do `venueForm`; `id` vem de `makeId()` | `normalizeVenue()`, `renderVenues()`, detalhes e Maps | submit em edição; `id` é explicitamente preservado |
| `favorite` | `false` no cadastro | ordenação, cartão e modal | ação delegada `toggle-favorite` |
| campos detalhados escalares | `validateDetailedFields()` | `hasDetailedInfo()`, destaques, `renderVenueDetails()` | preenchidos por `fillVenueForm()` e substituídos no submit da edição |
| `pros`/`cons` | clones de `temporaryPros`/`temporaryCons` | normalização e modal | editor temporário; clones restaurados e salvos na edição |

Campos desconhecidos preexistentes, por exemplo `createdAt`, não fazem parte do modelo criado atualmente, mas são preservados na edição por `{ ...currentVenue, ... }` e por `{ ...venue }` em `normalizeVenue()`.

### 3.4 Exemplo completo válido

```json
{
  "id": "1721577600000-a1b2c3d4",
  "name": "Villa Jardim",
  "type": "Espaço para festa",
  "address": "Rua das Flores, 100, São Paulo - SP",
  "favorite": true,
  "description": "Salão amplo com área externa.",
  "rating": 5,
  "budgetValue": 12000,
  "depositValue": 2500,
  "decorationOption": "included",
  "hasBridalRoom": true,
  "capacity": 180,
  "hasParking": true,
  "spaceAvailability": "ceremony_and_reception",
  "startTime": "19:00",
  "endTime": "03:00",
  "availableDate": "2027-06-12",
  "pros": [
    {
      "id": "1721577600001-a1b2c3d5",
      "title": "Localização",
      "description": "Fácil acesso para os convidados."
    }
  ],
  "cons": [
    {
      "id": "1721577600002-a1b2c3d6",
      "title": "Vagas",
      "description": "Quantidade limitada."
    }
  ]
}
```

### 3.5 Exemplo mínimo aceito pela leitura atual

```json
{
  "id": "1721577600000-a1b2c3d4",
  "name": "Igreja Central",
  "type": "Igreja",
  "address": "Praça Central, 1"
}
```

Esse formato mínimo é compatível com registros legados/testes porque `normalizeVenue()` acrescenta os padrões em memória. Um cadastro novo pelo formulário, porém, grava as 19 propriedades, incluindo `favorite: false`, strings vazias, `null`, `false` e arrays vazios.

## 4. Campos principais

| Campo visual | Elemento HTML | Propriedade JS | Validação e padrão | Exibição/uso |
|---|---|---|---|---|
| Nome do local | `input#venue-name`, `name="name"` | `name` | Obrigatório; convertido em string, `trim()` e rejeitado se vazio. Sem `maxlength` no HTML. | `<h3>` do cartão; título do modal; nome no diálogo de exclusão. |
| Tipo | `select#venue-type`, `name="type"` | `type` | Obrigatório; string aparada e não vazia. Os valores vêm do texto das opções, pois elas não declaram `value`. | Etiqueta no cartão e subtítulo do modal. |
| Endereço | `input#venue-address`, `name="address"` | `address` | Obrigatório; string aparada e não vazia. | Link no cartão e no modal. |
| Favorito | sem campo no formulário | `favorite` | Novo local recebe `false`; leitura usa `Boolean(valor)`. | Estrela, classe visual, rótulo e prioridade na ordenação. |
| Identificador | sem campo no formulário | `id` | Gerado por `makeId()`; não é UUID. Comparações convertem ambos os lados com `String()`. | `data-id` das ações, busca, edição, favorito e exclusão. |

### Valores atuais de `type`

Os seis valores exatos do `<select>` e do enum backend são:

1. `Espaço para festa`
2. `Igreja`
3. `Cartório`
4. `Buffet`
5. `Hospedagem`
6. `Outro`

O frontend só exige que `type` não esteja vazio; ele não revalida contra essa lista no submit nem na normalização. Logo, um registro antigo pode conter outro texto. O backend, ao contrário, usa enum e rejeita outro valor.

### Google Maps

O endereço é interpolado somente depois de `encodeURIComponent(address)` em:

```text
https://www.google.com/maps/search/?api=1&query=<endereço codificado>
```

O link abre em nova aba com `target="_blank"` e `rel="noopener noreferrer"`. Não são armazenados latitude, longitude, `place_id` ou URL pronta.

## 5. Opções detalhadas e validações

O formulário tem `novalidate`, portanto o fluxo de submit depende das validações JavaScript, embora os tipos/min/step dos controles ainda forneçam `validity.badInput` e facilitem a entrada.

| Campo visual | Propriedade JS | Tipo | Valor padrão | Validação atual | Opcional |
|---|---|---|---|---|---:|
| Descrição detalhada | `description` | `string` | `""` | `String(...).trim()`; sem limite de tamanho. | Sim |
| Avaliação | `rating` | inteiro `number` ou `null` | `null` | Se presente, inteiro de 1 a 5. | Sim |
| Orçamento total | `budgetValue` | `number` ou `null` | `null` | Finito e maior ou igual a zero; HTML `min="0"`, `step="0.01"`. | Sim |
| Entrada | `depositValue` | `number` ou `null` | `null` | Finito, não negativo e, quando há orçamento, não maior que ele; `step="0.01"`. | Sim |
| Decoração | `decorationOption` | enum em `string` | `"unknown"` | Valor precisa existir em `DECORATION_LABELS`; caso contrário vira `unknown`. | Sim |
| Espaço para a noiva | `hasBridalRoom` | `boolean` | `false` | `true` apenas quando o `FormData` contém `"on"`. | Sim |
| Capacidade máxima | `capacity` | inteiro `number` ou `null` | `null` | Finito, inteiro e maior ou igual a zero; HTML `min="0"`, `step="1"`. | Sim |
| Estacionamento | `hasParking` | `boolean` | `false` | `true` apenas quando o `FormData` contém `"on"`. | Sim |
| Tipo de espaço | `spaceAvailability` | enum em `string` | `"unknown"` | Valor precisa existir em `SPACE_LABELS`; caso contrário vira `unknown`. | Sim |
| Horário de início | `startTime` | `string` | `""` | Pode ficar vazio; se ambos existirem, não pode ser igual ao final. | Sim |
| Horário de encerramento | `endTime` | `string` | `""` | Pode ficar vazio; igual ao início é rejeitado; menor que o início é aceito. | Sim |
| Data disponível | `availableDate` | `string` | `""` | Controle `type="date"`; código não faz validação adicional. | Sim |
| Prós | `pros` | array de objetos | `[]` | Cada novo item exige título e motivo; rascunho pendente bloqueia o local. | Sim |
| Contras | `cons` | array de objetos | `[]` | Mesma regra de `pros`. | Sim |

IDs/names HTML dos detalhes:

| Propriedade | `id` | `name` |
|---|---|---|
| `description` | `venue-description` | `description` |
| `rating` | `venue-rating-1` a `venue-rating-5` | `rating` |
| `budgetValue` | `venue-budget` | `budgetValue` |
| `depositValue` | `venue-deposit` | `depositValue` |
| `decorationOption` | `venue-decoration` | `decorationOption` |
| `hasBridalRoom` | `venue-bridal-room` | `hasBridalRoom` |
| `capacity` | `venue-capacity` | `capacity` |
| `hasParking` | `venue-parking` | `hasParking` |
| `spaceAvailability` | `venue-space-availability` | `spaceAvailability` |
| `startTime` | `venue-start-time` | `startTime` |
| `endTime` | `venue-end-time` | `endTime` |
| `availableDate` | `venue-available-date` | `availableDate` |

Os campos de rascunho de prós/contras (`venue-pro-title`, `venue-pro-description`, `venue-con-title`, `venue-con-description`) não têm atributo `name`; eles são administrados fora do `FormData`.

## 6. Avaliação por estrelas

- **Armazenamento:** `rating` é `number` inteiro; ausência de nota é `null`.
- **Valores aceitos:** `1`, `2`, `3`, `4` ou `5`.
- **Seleção:** cinco radios `name="rating"`, com valores textuais `"1"` a `"5"`; o evento `change` chama `setRating(Number(input.value))`.
- **Remoção:** o botão `#clear-venue-rating` chama `setRating(null)`.
- **Edição:** `fillVenueForm()` chama `setRating(item.rating)` depois da normalização.
- **Normalização:** valores não finitos, negativos, fracionários, maiores que 5, zero ou ausentes viram `null`. A validação do formulário rejeita valores presentes fora de 1–5.
- **Cartão:** aparece em `renderVenueHighlights()` somente quando `rating` é truthy; mostra estrelas e a nota sobre 5.
- **Detalhes:** a seção “Avaliação do casal” mostra estrelas repetidas, seguidas de “N de 5”.
- **Acessibilidade:** o grupo usa `role="radiogroup"` e rótulo acessível; cada radio tem label; há texto oculto para leitores de tela, estado textual com `aria-live`, foco nativo do radio e indicação visual por hover/seleção. O botão de limpar permite retornar ao estado sem nota.

## 7. Orçamento

- Total: `budgetValue`.
- Entrada: `depositValue`.
- Tipo em memória: `number` ou `null`.
- Conversão no submit: `parseFormNumber(input)` retorna `null` quando o valor está vazio, `NaN` para entrada inválida e `Number(input.value)` para valor preenchido válido.
- Normalização de registros existentes: `optionalNumber()` converte com `Number`; valores não finitos ou negativos viram `null`.
- Formatação: `formatCurrency()` em `js/app.js`, com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.
- Valores negativos: rejeitados no submit e convertidos para `null` na normalização de registro antigo.
- Entrada maior que orçamento: `updateBudgetRemaining()` define erro personalizado; `validateDetailedFields()` impede o submit.
- Valor restante: `budgetValue - depositValue`, calculado para a interface e para o modal. **Não é persistido.**
- Campos vazios: cada um vira `null`; o restante fica oculto se faltar qualquer um dos dois.
- Zero: é válido, é diferente de `null` e aparece no cartão/modal porque `hasValue(0)` é verdadeiro.

**Recomendação de banco:** `NUMERIC(12,2)` é mais compatível que ponto flutuante para valores monetários. Seriam adequados checks de não negatividade e de `deposit_value <= budget_value` quando ambos não forem nulos. Isso ainda não existe no schema confirmado.

## 8. Valores permitidos nos selects

### 8.1 Decoração

| Valor interno | Texto exibido |
|---|---|
| `included` | Decoração inclusa |
| `separate` | Decoração disponível à parte |
| `none` | Não possui decoração |
| `unknown` | Ainda não informado |

### 8.2 Tipo de espaço

| Valor interno | Texto exibido |
|---|---|
| `ceremony_and_reception` | Cerimônia e salão de festas |
| `ceremony_only` | Somente cerimônia |
| `reception_only` | Somente salão de festas |
| `unknown` | Ainda não informado |

Valores desconhecidos lidos de registros antigos são substituídos por `unknown` em memória. No modal, `unknown` é omitido em vez de exibir “Ainda não informado”.

## 9. Prós e contras

`pros` e `cons` são atualmente arrays de objetos com a mesma estrutura:

| Propriedade do item | Tipo | Papel |
|---|---|---|
| `id` | `string` | Identifica o item para editar/remover dentro da lista temporária. |
| `title` | `string` | Tópico do pró ou contra. |
| `description` | `string` | Motivo/explicação. |

Exemplos:

```js
pros: [
    {
        id: "1721577600001-a1b2c3d5",
        title: "Localização",
        description: "Perto da igreja"
    }
]

cons: [
    {
        id: "1721577600002-a1b2c3d6",
        title: "Estacionamento",
        description: "Poucas vagas"
    }
]
```

### Fluxo do editor

- `temporaryPros` e `temporaryCons` mantêm os itens antes do local ser salvo.
- `editingListItemIds = { pros: null, cons: null }` indica se cada editor está alterando um item.
- `validateListItem(type)` exige título e descrição, ambos aparados.
- `submitListItem(type)` cria um item com `makeId()` ou substitui o item que tem o mesmo `id`.
- `editListItem(type, itemId)` carrega somente o item selecionado nos dois inputs.
- `removeListItem(type, itemId)` remove somente o item selecionado.
- `resetListEditor()` limpa os inputs e sai do modo de edição do item.
- Um título ou descrição digitado e ainda não adicionado constitui rascunho. `hasPendingListDraft()` impede salvar o local para evitar perda silenciosa.
- Na edição do local, `fillVenueForm()` normaliza e clona os arrays para as variáveis temporárias. Alterações ficam temporárias até o submit do local.
- No modal, `appendProsConsSection()` cria grupos separados e usa `textContent`, evitando interpretar título/descrição como HTML.
- Arrays vazios não criam a seção de prós e contras; no editor aparece a mensagem de lista vazia.

### Compatibilidade legada

`normalizeStructuredList(value, type)` aceita:

- uma string não vazia: vira um item com `title: "Observação"` e a string aparada em `description`;
- um array de strings: cada string vira um item com título “Observação”;
- um array de objetos: preserva `id`, `title` e `description` válidos;
- qualquer outro valor: vira `[]`.

Se faltar `id`, ele recebe `legacy-pros-N` ou `legacy-cons-N`. IDs repetidos ganham sufixos `-2`, `-3` etc. Item sem título, mas com descrição, recebe “Observação”. Item sem título e sem descrição é descartado. A normalização por leitura não altera sozinha o valor persistido; uma edição/salvamento posterior grava a forma estruturada.

**Recomendação:** `JSONB` é compatível com o formato atual e preserva ordem e estrutura, desde que a aplicação ou o banco valide os três campos dos itens. Uma tabela filha seria uma alternativa se houver necessidade de consulta, ordenação e auditoria independente de cada tópico; não é necessária para apenas reproduzir o comportamento atual.

## 10. Cadastro de local

Fluxo e funções participantes:

1. Botões com `[data-toggle-form]` mostram/ocultam `#venue-form-card`.
2. O listener `venueForm.addEventListener("submit", ...)` impede o submit nativo e cria `FormData`.
3. `validateMainFields(data)` valida `name`, `type` e `address`.
4. `updateBudgetRemaining()` sincroniza a validação financeira visual.
5. `validateDetailedFields(data)` valida e monta os 12 campos detalhados escalares.
6. `hasPendingListDraft()` bloqueia o salvamento se houver pró/contra digitado e não adicionado.
7. `cloneStructuredList(temporaryPros/temporaryCons)` monta os dois arrays sem compartilhar os mesmos objetos temporários.
8. `makeId()` gera o identificador textual.
9. O objeto é inserido por `state.venues.unshift(...)`, portanto entra no início do array bruto.
10. `saveState()` persiste as coleções locais.
11. `renderAll()` chama `renderVenues()`; a ordenação visual pode mudar a posição.
12. `resetVenueForm()` limpa campos, nota, listas e modo de edição.
13. O cartão do formulário é ocultado.
14. `showToast("Local adicionado.")` informa o sucesso.

`markFieldInvalid()` expande os detalhes quando necessário, define `setCustomValidity`, `aria-invalid`, move o foco, chama `reportValidity()` e também mostra toast.

## 11. Edição de local

- O modo é identificado por `editingVenueId`; `null` significa cadastro, string/ID significa edição.
- `startVenueEdit(id)` busca com `getVenueById()`, fecha o modal de detalhes, chama `fillVenueForm()`, mostra o formulário, atualiza o texto de modo e leva a tela até ele.
- `fillVenueForm(venue)` usa `normalizeVenue()`, preenche os controles, chama `setRating(item.rating)`, clona `pros`/`cons`, renderiza as listas e atualiza o restante do orçamento.
- Os detalhes só são expandidos automaticamente se `hasDetailedInfo(item)` retornar verdadeiro.
- `updateVenueFormMode()` troca o botão para “Salvar alterações”, exibe cancelamento e aviso com o nome do local.
- No submit, o índice é encontrado comparando IDs como string. Se não existir, a operação é interrompida com toast.
- A substituição é `{ ...currentVenue, ...mainFields, ...structuredDetails, id: currentVenue.id }`; assim o ID original, `favorite` e campos extras preexistentes são preservados.
- Depois de salvar: `saveState()`, `renderAll()`, `resetVenueForm()`, formulário oculto e toast “Local atualizado com sucesso.”
- `cancelVenueEdit()` chama `resetVenueForm()` e oculta o formulário; o registro original não é alterado.
- `resetVenueForm()` volta `editingVenueId` a `null`, limpa os dois editores, nota, validações e valores, recolhe detalhes e chama `updateVenueFormMode()`.

Funções diretamente envolvidas: `getVenueById`, `normalizeVenue`, `hasDetailedInfo`, `fillVenueForm`, `startVenueEdit`, `updateVenueFormMode`, `cloneStructuredList`, `setRating`, `setDetailsExpanded`, `updateBudgetRemaining`, `validateMainFields`, `validateDetailedFields`, `resetVenueForm`, `cancelVenueEdit`, `saveState`, `renderAll` e `showToast`.

## 12. Favorito

- Propriedade: `favorite` (`boolean`).
- Padrão de cadastro: `false`.
- Alternância: não há uma função nomeada exclusiva; o branch `action === "toggle-favorite"` no listener delegado do `document.body` faz `venue.favorite = !venue.favorite`.
- Persistência: chama `saveState()` imediatamente.
- Ordenação: `renderVenues()` normaliza e ordena por `favorite` decrescente; dentro de cada grupo, usa `name.localeCompare(..., "pt-BR")`.
- Visual: cartão favorito recebe classe `favorite`; o botão estrela recebe `active`; `aria-label`/`title` alternam; o rótulo muda entre “Nosso favorito” e “Em avaliação”.
- Modal: o botão muda entre “Adicionar aos favoritos” e “Remover dos favoritos”. Se o modal estiver aberto, `renderVenueDetails(venue)` o atualiza depois da alternância.
- Edição: o formulário não possui controle de favorito. A edição preserva a propriedade existente pelo spread de `currentVenue`.

## 13. Exclusão

- Local pendente: `pendingDeleteVenueId`, armazenado como string.
- Gatilho: `deleteTriggerElement` guarda o botão que abriu o diálogo para restaurar foco.
- Proteção: `deleteInProgress` e o estado `disabled` do botão evitam confirmações duplicadas.
- `openVenueDeleteConfirmation(id, trigger)` busca o local, grava o estado temporário, insere o nome por `textContent`, abre o `<dialog>` e foca **Cancelar**.
- Cancelar chama `closeVenueDeleteConfirmation()`; nada é removido.
- Confirmar chama `confirmVenueDelete()`, filtra `state.venues`, fecha edição/detalhes se apontarem para o mesmo registro, salva, renderiza, fecha o diálogo e mostra “Local excluído com sucesso.”
- Esc usa o comportamento nativo do `<dialog>`; o evento `close` chama `clearDeleteDialogState()`.
- Clique no backdrop fecha somente se o alvo for o próprio diálogo e não houver exclusão em andamento.
- `clearDeleteDialogState()` limpa ID/flags, reabilita o botão e devolve o foco ao gatilho se ele ainda estiver conectado.

Funções: `openVenueDeleteConfirmation`, `closeVenueDeleteConfirmation`, `confirmVenueDelete`, `clearDeleteDialogState`, além de `getVenueById`, `normalizeVenue`, `resetVenueForm`, `saveState`, `renderAll` e `showToast`.

## 14. Cartões dos locais

Cada cartão mostra sempre:

- tipo;
- estrela de favorito;
- nome;
- endereço como link do Google Maps;
- rótulo “Nosso favorito” ou “Em avaliação”;
- botão **Editar**;
- botão discreto **×** de exclusão, com nome acessível e tooltip.

Conteúdo condicional:

| Conteúdo | Condição |
|---|---|
| Avaliação | `rating` normalizado é truthy, portanto 1–5. |
| Orçamento | `budgetValue` não é `null`, `undefined` ou string vazia; zero aparece. |
| Capacidade | `capacity` não é `null`, `undefined` ou string vazia; zero aparece. |
| **Ver detalhes** | `hasDetailedInfo()` encontra pelo menos um detalhe não vazio/não padrão ou item em `pros`/`cons`. |
| **Editar** | Sempre. |
| **Excluir** | Sempre, no grupo de ações do rodapé. |

`renderVenues()` aplica `escapeHtml()` a ID e textos interpolados. O endereço é codificado para o Maps. Quando a lista está vazia, `emptyState()` mostra “Adicione o primeiro local que vocês estão considerando.”

## 15. Modal de detalhes

`openVenueDetails(id)` só abre se o local existir e tiver detalhes. `renderVenueDetails()` normaliza o registro e monta somente seções com itens visíveis:

| Seção | Conteúdo e condição |
|---|---|
| Avaliação do casal | Descrição aparada e/ou nota de 1–5. |
| Orçamento | Total e entrada quando presentes; restante quando ambos existem e entrada não supera total. |
| Estrutura | Decoração diferente de `unknown`; sala da noiva somente se `true`; capacidade inclusive zero; estacionamento somente se `true`; tipo de espaço diferente de `unknown`. |
| Disponibilidade e horários | Início, fim e/ou data quando não vazios. |
| Prós e contras | Apenas se ao menos uma lista tiver itens; cada grupo vazio é omitido. |

Detalhes de apresentação:

- moeda: `formatCurrency()` em BRL/pt-BR;
- data: `formatDate(availableDate, "")`, interpretando `YYYY-MM-DD` como data local;
- horário: strings `HH:MM`; quando início e fim existem e o fim é lexicograficamente menor, o fim recebe “(dia seguinte)”;
- horários iguais são impedidos no formulário; um fim anterior é propositalmente aceito como virada de dia;
- título e subtítulo usam `textContent`; itens estruturados também usam nós DOM e `textContent`;
- ações: abrir Maps, editar, favoritar/desfavoritar e fechar;
- o backdrop fecha o diálogo e Esc segue o comportamento nativo.

Responsividade: o diálogo tem largura máxima de 700 px, altura limitada à viewport e conteúdo com rolagem vertical. Em até 620 px, grades internas e ações passam para uma coluna e os botões ocupam a largura disponível.

Funções responsáveis: `openVenueDetails`, `renderVenueDetails`, `createDetailItem`, `appendDetailSection`, `createStructuredDetailGroup` e `appendProsConsSection`.

## 16. Persistência atual em `localStorage`

### Chave e estado

`js/app.js` declara:

```js
const STORAGE_KEY = "nosso-casamento-v1";
```

Forma lógica do estado global:

```js
{
    settings: {
        partnerOne: "",
        partnerTwo: "",
        weddingDate: ""
    },
    guests: [],
    venues: [],
    tasks: [],
    expenses: []
}
```

`loadState()` executa durante `const state = loadState()`. Ele lê e faz `JSON.parse`, aceita cada coleção somente se for array e retorna defaults em caso de JSON inválido/erro. Para `settings`, o estado em memória é reiniciado vazio porque os dados atuais do casamento vêm do Supabase; coleções como `venues` continuam vindas do `localStorage`.

`saveState()` lê o JSON já salvo, preserva propriedades existentes com spread e substitui `guests`, `venues`, `tasks` e `expenses` pelos arrays em memória. Ele não persiste `state.settings` atual; um valor legado de `settings` já armazenado permanece por causa do spread.

### Uso por Locais

- `state.venues`: fonte direta do array.
- `loadState()`: usada **indiretamente**, na inicialização global de `state`; `pages/locais/main.js` não a chama.
- `saveState()`: chamada diretamente depois de cadastrar, editar, favoritar/desfavoritar e excluir.
- Não há transação, sincronização remota, tratamento de conflito entre abas nem escopo por `wedding_id`.

### Registros antigos

Na renderização/busca, `normalizeVenue()` acrescenta os padrões detalhados, converte booleanos, números, enums e listas. Textos antigos em `pros`/`cons` são convertidos em memória conforme a seção 9. Campos extras são preservados. A normalização não salva automaticamente; por isso o `localStorage` pode continuar heterogêneo até o registro ser editado.

Distinções relevantes:

- `""`: ausência nos campos textuais/data/horário;
- `null`: ausência de número/nota;
- `false`: resposta negativa para booleanos;
- `0`: número presente e válido, exibido como tal;
- `[]`: lista presente sem itens.

## 17. Dependências globais

`pages/locais/main.js` é um script clássico e depende de identificadores globais carregados antes dele.

| Identificador | Origem | Uso em Locais |
|---|---|---|
| `state` | `js/app.js` | Lê e substitui `state.venues`. |
| `loadState()` | `js/app.js` | Inicializa `state` antes do script da página; não é chamada diretamente. |
| `saveState()` | `js/app.js` | Persiste mutações do CRUD e favorito. |
| `makeId()` | `js/app.js` | IDs de locais e de itens novos de prós/contras. |
| `escapeHtml()` | `js/app.js` | Escapa strings interpoladas no HTML dos cartões. |
| `formatCurrency()` | `js/app.js` | Orçamento, entrada e restante no cartão/formulário/modal. |
| `formatDate()` | `js/app.js` | Data disponível no modal. |
| `parseLocalDate()` | `js/app.js` | Dependência interna de `formatDate()`; não é chamada diretamente por Locais. |
| `showToast()` | `js/app.js` | Erros de validação/operação e mensagens de sucesso. |
| `emptyState()` | `js/app.js` | Estado sem cartões. |
| `getCurrentWedding()` | `js/supabase.js` | Usada pelo fluxo global de `app.js`, não pelo CRUD de Locais. A autenticação/contexto global podem redirecionar a página. |
| `renderAll()` | `pages/locais/main.js` | É definida pela página e também pode ser chamada pelo fluxo de inicialização de `app.js`. |

Outras dependências:

- `components/sidebar.js` usa `fetch("../../components/sidebar.html")` e `window.location.href` para navegação;
- a página carrega `supabase.js`, depois `app.js`, `sidebar.js` e por fim `pages/locais/main.js`, todos com `defer`;
- CSS global, CSS da sidebar e CSS local compõem o layout;
- Google Fonts é uma dependência externa visual;
- Google Maps recebe somente o link de busca; não há API SDK nem chave do Maps.

## 18. Mapeamento recomendado para `public.venues`

> **Recomendação, não estado atual.** A tabela real não foi alterada. O desenho abaixo reproduz o objeto atual e adiciona somente campos técnicos necessários ao escopo multi-casamento/auditoria.

| Propriedade JavaScript | Coluna sugerida | Tipo PostgreSQL sugerido | Nulo permitido |
|---|---|---|---:|
| `id` | `id` | `UUID` | Não |
| — (contexto autenticado) | `wedding_id` | `UUID` | Não |
| `name` | `name` | `TEXT` | Não |
| `type` | `type` | `TEXT` | Não |
| `address` | `address` | `TEXT` | Não |
| `favorite` | `favorite` | `BOOLEAN` | Não |
| `description` | `description` | `TEXT` | Sim |
| `rating` | `rating` | `SMALLINT` | Sim |
| `budgetValue` | `budget_value` | `NUMERIC(12,2)` | Sim |
| `depositValue` | `deposit_value` | `NUMERIC(12,2)` | Sim |
| `decorationOption` | `decoration_option` | `TEXT` | Não, se default `unknown` |
| `hasBridalRoom` | `has_bridal_room` | `BOOLEAN` | Não |
| `capacity` | `capacity` | `INTEGER` | Sim |
| `hasParking` | `has_parking` | `BOOLEAN` | Não |
| `spaceAvailability` | `space_availability` | `TEXT` | Não, se default `unknown` |
| `startTime` | `start_time` | `TIME` | Sim |
| `endTime` | `end_time` | `TIME` | Sim |
| `availableDate` | `available_date` | `DATE` | Sim |
| `pros` | `pros` | `JSONB` | Não, se default `[]` |
| `cons` | `cons` | `JSONB` | Não, se default `[]` |
| — (metadado recomendado) | `created_at` | `TIMESTAMPTZ` | Não |
| — (metadado recomendado) | `updated_at` | `TIMESTAMPTZ` | Não |

### Defaults e restrições recomendados

- `favorite`, `has_bridal_room`, `has_parking`: default `false`;
- `decoration_option`, `space_availability`: default `unknown`;
- `pros`, `cons`: default JSON array vazio;
- `rating`: entre 1 e 5 ou nulo;
- `budget_value`, `deposit_value`: maiores ou iguais a zero ou nulos;
- `deposit_value <= budget_value` quando ambos existirem;
- `capacity`: inteiro maior ou igual a zero ou nulo;
- `type`: limitado aos seis valores confirmados na seção 4;
- `decoration_option`: limitado aos quatro valores da seção 8.1;
- `space_availability`: limitado aos quatro valores da seção 8.2;
- `pros` e `cons`: JSON do tipo array; idealmente itens com `id`, `title` e `description` textuais;
- `wedding_id`: chave estrangeira para o casamento e sempre derivada do contexto autenticado;
- não é recomendado um check simples `end_time > start_time`, pois a interface aceita encerramento após a meia-noite.

Conversão de nomes camelCase ↔ snake_case precisará ser explícita na camada de acesso.

## 19. Schema atual esperado e incompatibilidades

### Colunas confirmadas pelo projeto

`VenueRow` e `backend/README.md` confirmam somente:

| Coluna | Tipo TypeScript esperado | Observação |
|---|---|---|
| `id` | `string` | As rotas backend exigem formato UUID pelo `ParseUUIDPipe`. |
| `wedding_id` | `string` | Escopo multi-casamento. |
| `name` | `string` | DTO: 1–120 caracteres. |
| `type` | `VenueType`/`string` | Enum dos seis tipos. |
| `address` | `string` | DTO: 1–300 caracteres. |
| `favorite` | `boolean` | Opcional na criação, default lógico `false`. |

`created_at` e `updated_at` aparecem como ideia no README histórico do workspace, mas **não** aparecem em `VenueRow`, nas suposições do `backend/README.md` nem em uma migration localizada. Portanto, não são confirmados como schema atual.

### Campos do frontend ausentes no contrato confirmado

`description`, `rating`, `budgetValue`, `depositValue`, `decorationOption`, `hasBridalRoom`, `capacity`, `hasParking`, `spaceAvailability`, `startTime`, `endTime`, `availableDate`, `pros` e `cons`.

### Incompatibilidades objetivas

1. O ID local de `makeId()` combina timestamp e trecho aleatório; não é UUID e falharia no `ParseUUIDPipe` das rotas com `:id`.
2. O frontend usa camelCase; a sugestão relacional usa snake_case.
3. O DTO backend aceita somente `name`, `type`, `address` e `favorite`. Como o `ValidationPipe` usa `whitelist: true` e `forbidNonWhitelisted: true`, enviar os 14 detalhes no payload atual causaria erro de validação, não persistência silenciosa.
4. O frontend aceita qualquer string não vazia em `type`; o backend restringe ao enum.
5. O frontend não possui `wedding_id` no objeto local; backend/repositório o acrescentam a partir do contexto do usuário.
6. Strings vazias representam ausência de data/horário/texto; no banco recomenda-se converter data/horário vazio para `NULL`.
7. `pros`/`cons` podem estar em formatos legados heterogêneos no `localStorage`; o banco precisa receber uma forma canônica.
8. Não há confirmação de colunas detalhadas, timestamps, defaults ou constraints no banco físico porque não há migration SQL no repositório.

## 20. Operações futuras no banco

| Necessidade | Operação | Comportamento esperado |
|---|---|---|
| Listar locais | `SELECT` | Somente linhas do casamento corrente; favoritos primeiro, depois nome. Pode carregar básicos e detalhes juntos. |
| Carregar um local/detalhes | `SELECT` | Buscar por `id` e `wedding_id`; nunca apenas por ID sem escopo. |
| Cadastrar | `INSERT` | Inserir campos validados e `wedding_id` derivado da sessão/contexto. |
| Editar | `UPDATE` | Atualizar campos permitidos da linha que pertence ao casamento corrente. |
| Favoritar/desfavoritar | `UPDATE` | Alterar somente `favorite`; o backend já prevê `PATCH /venues/:id/favorite`. |
| Excluir | `DELETE` | Excluir por `id` e `wedding_id`. |
| Salvar prós/contras | `INSERT`/`UPDATE` | No modelo JSONB, fazem parte do payload do local; em tabelas filhas seriam operações próprias. |

O backend já prevê `GET /api/v1/venues`, `POST /api/v1/venues`, `PATCH /api/v1/venues/:id`, `PATCH /api/v1/venues/:id/favorite` e `DELETE /api/v1/venues/:id`. Os DTOs e tipos ainda precisam ser ampliados antes de aceitar os detalhes. Nenhuma dessas operações é chamada pelo frontend atual.

## 21. Segurança e RLS

Estado atual do desenho backend:

1. `SupabaseAuthGuard` extrai o bearer token, consulta o usuário no Supabase Auth e preenche `request.user`/`request.accessToken`.
2. `WeddingContextService` procura vínculos em `wedding_members` pelo `user_id` autenticado.
3. O serviço exige exatamente um vínculo; nenhum ou múltiplos vínculos geram erro.
4. `request.wedding.id` passa a ser o casamento corrente.
5. `venues.service` não aceita `wedding_id` do DTO; ele usa o ID resolvido.
6. O repositório filtra leitura, atualização e exclusão por `wedding_id`, e acrescenta esse campo na criação.
7. `SupabaseUserClientFactory` cria o cliente usando a publishable key e o token do usuário no header. Dessa forma, as políticas RLS continuam sendo aplicadas.

Requisitos para a integração futura:

- o navegador não deve enviar/escolher livremente o `wedding_id` de outro usuário;
- `SELECT`, `INSERT`, `UPDATE` e `DELETE` precisam de políticas RLS em `venues` baseadas na existência do vínculo em `wedding_members`;
- no `INSERT`, a policy deve validar que o `wedding_id` da nova linha pertence ao usuário autenticado;
- em `SELECT`/`UPDATE`/`DELETE`, a linha alvo deve pertencer a um casamento vinculado ao usuário;
- qualquer diferença de permissão entre papéis `owner` e `partner` precisa ser decisão explícita. O serviço de venues atual resolve ambos e não chama `requireOwner`, portanto o comportamento esperado hoje é permitir ambos, sujeito à RLS;
- a publishable key pode estar no navegador; chave secreta/service role não deve ser exposta;
- filtros por `wedding_id` no código ajudam, mas não substituem RLS.

Nenhuma policy foi criada ou alterada nesta análise.

## 22. Migração futura dos dados do `localStorage`

Uma migração posterior precisará ser planejada como processo explícito e idempotente:

1. Ler `localStorage["nosso-casamento-v1"]` e confirmar que `venues` é array.
2. Associar o lote ao casamento obtido pelo usuário autenticado via `wedding_members`, nunca por um ID livre digitado/fornecido pelo cliente.
3. Para cada registro, aplicar a mesma semântica de `normalizeVenue()` e registrar itens inválidos em vez de descartá-los silenciosamente.
4. Gerar UUIDs no banco para os locais; manter um mapa entre ID local antigo e UUID se for necessário retomar/repetir a migração.
5. Aparar `name`, `type` e `address`; decidir o tratamento de registros sem esses obrigatórios antes do INSERT.
6. Converter string vazia de descrição conforme a decisão do schema (`NULL` ou `TEXT ''`); manter `false` distinto de ausência e `0` distinto de `NULL`.
7. Converter `budgetValue`/`depositValue` para decimal de duas casas, rejeitando não finitos, negativos e entrada maior que total.
8. Converter `capacity` para inteiro não negativo.
9. Converter `availableDate` válida `YYYY-MM-DD` para `DATE`; vazia para `NULL`.
10. Converter `startTime`/`endTime` válidos para `TIME`; vazios para `NULL`; preservar a interpretação de virada de dia no aplicativo.
11. Restringir enums de decoração/espaço aos valores confirmados; valores desconhecidos viram `unknown`.
12. Normalizar `pros`/`cons`: strings antigas viram “Observação”, IDs ausentes/repetidos são corrigidos e itens totalmente vazios são removidos.
13. Decidir se os IDs internos de prós/contras permanecerão textuais no JSONB ou serão regenerados. Eles não precisam ser UUID para o comportamento atual.
14. Evitar duplicidade em novas tentativas, por exemplo com uma marca de migração ou uma chave de importação definida no projeto futuro.
15. Só remover dados locais depois de confirmação completa e verificável; esta análise não apaga nada.

Formato antigo conhecido: objetos podem conter apenas `id`, `name`, `type`, `address` e eventualmente `favorite`; `pros`/`cons` podem ser strings ou arrays de strings/objetos. Formato atual canônico: as 19 propriedades descritas na seção 3.

## 23. Arquivos que provavelmente precisarão ser alterados depois

> Lista prospectiva; nenhum desses arquivos foi alterado nesta tarefa.

| Arquivo | Responsabilidade futura provável |
|---|---|
| `backend/src/database/database.types.ts` | Acrescentar as colunas detalhadas ao tipo `VenueRow`. |
| DTOs em `backend/src/modules/venues/dto/` | Validar detalhes, enums, números, datas, horários e listas estruturadas. |
| `backend/src/modules/venues/venues.types.ts` | Adicionar tipos/enums dos detalhes e mapeamento de payload, se aplicável. |
| `backend/src/modules/venues/venues.repository.ts` | Mapear novos campos e preservar filtros por `wedding_id`. |
| `backend/src/modules/venues/venues.service.ts` | Aplicar regras de negócio compartilhadas e tratamento de conflitos. |
| migration futura ainda inexistente | Criar/adicionar colunas, defaults, checks, índices e RLS. |
| `js/supabase.js` ou novo cliente de API | Expor funções autenticadas de venues, caso o frontend fale diretamente com Supabase ou com a API. |
| `pages/locais/main.js` | Substituir mutações síncronas de `state.venues` por operações assíncronas, mapear nomes e tratar loading/erro. |
| `js/app.js` | Deixar de tratar `venues` como coleção persistida local, após migração e estratégia de compatibilidade. |
| `pages/locais/index.html` | Somente se forem necessários estados de carregamento/erro ou novos elementos acessíveis. |
| `pages/locais/style.css` | Somente para os novos estados visuais da integração. |
| `tests/frontend-venues.test.js` | Cobrir requisições, loading, falhas, concorrência e dados remotos. |
| testes backend de venues | Cobrir DTOs detalhados, escopo por casamento e respostas da API. |
| `backend/README.md` e documentação OpenAPI | Atualizar o contrato confirmado. |

Se a decisão arquitetural for acesso direto ao Supabase, parte do backend acima pode não participar do caminho de UI; ainda assim o schema/RLS e os tipos gerados deverão ser atualizados. Se a API Nest continuar sendo a camada escolhida, `pages/locais/main.js` deve consumir os endpoints, não executar consultas livres com `wedding_id` fornecido pelo navegador.

## 24. Riscos e inconsistências encontrados

1. **Dependência forte de globais e ordem de scripts:** `main.js` não é módulo e pressupõe `app.js` carregado antes.
2. **Persistência síncrona local:** não há loading, retry, tratamento de falha de rede, concorrência ou rollback visual, necessários numa integração remota.
3. **Sem escopo por casamento no dado local:** todos os locais estão num único array do navegador; trocar de usuário no mesmo perfil pode expor dados locais anteriores.
4. **ID incompatível:** `makeId()` não gera UUID, mas o backend exige UUID em rotas com ID.
5. **Contratos divergentes:** 14 campos detalhados do frontend não existem em `VenueRow`/DTOs.
6. **Payload estrito:** detalhes não autorizados são rejeitados pelo `ValidationPipe`, pois `forbidNonWhitelisted` está ativo.
7. **Validação divergente de `type`:** frontend aceita texto arbitrário em registros/submits manipulados; backend aceita somente o enum.
8. **Strings vazias versus `NULL`:** data, horários e descrição usam `""`; PostgreSQL `DATE`/`TIME` não deve receber string vazia.
9. **Números de formulário:** `FormData` fornece strings; conversão incorreta futura pode gerar `NaN` ou strings monetárias. JSON não representa `NaN` validamente.
10. **Normalização tolerante:** números antigos inválidos/negativos/fracionários podem virar `null` silenciosamente na renderização, escondendo problemas de origem.
11. **Dinheiro em `number`:** JavaScript usa ponto flutuante; operações de centavos podem sofrer precisão binária. O restante não é persistido.
12. **Horário após meia-noite:** `endTime < startTime` significa “dia seguinte” apenas na exibição; o banco não terá a informação explícita de dia/offset.
13. **Horários incompletos:** início e fim são independentes e opcionais; apenas igualdade quando ambos existem é rejeitada.
14. **Data sem validação de negócio:** não há regra de data passada, coerência com a data do casamento ou disponibilidade real.
15. **Booleano legado:** `favorite` usa `Boolean(value)`; por exemplo, a string `"false"` seria interpretada como `true`. Os outros booleanos exigem `=== true`, criando semânticas diferentes.
16. **Prós/contras heterogêneos:** formatos antigos continuam no armazenamento até uma edição; IDs legados são determinísticos e locais, não globais.
17. **Descrição vazia em item legado:** a normalização permite objeto com título e descrição vazia; o editor de novos itens exige ambos.
18. **Campos extras preservados:** spreads mantêm propriedades desconhecidas, o que ajuda compatibilidade, mas pode carregar dados obsoletos e exige payload explícito ao banco.
19. **Sem timestamps confirmados:** não é possível planejar sincronização incremental confiável com base no schema documentado atual.
20. **RLS não verificável neste repositório:** o backend pressupõe RLS, mas não há policies/migrations locais para confirmar a proteção real de `venues`.
21. **Múltiplos casamentos:** o contexto atual rejeita usuários com mais de um vínculo; isso é seguro contra escolha ambígua, mas limita uma futura funcionalidade multi-casamento.
22. **README histórico desatualizado:** o README do workspace afirma ausência de integração de autenticação/banco e descreve Locais de forma básica; o código atual já usa Supabase para autenticação/casamento e possui campos detalhados.
23. **Ausência de tratamento de erro em Locais:** operações locais dificilmente falham de forma observável; o código ainda não possui mensagens/estados adequados a SELECT/INSERT/UPDATE/DELETE remotos.

Não foi identificada duplicação de uma função CRUD de venues entre `main.js` e `supabase.js`: atualmente só existe o fluxo local. O problema é justamente a ausência da integração, não duas implementações concorrentes.

## 25. Próximos passos recomendados

As etapas abaixo são recomendações e não foram executadas:

1. Confirmar no painel/schema real do Supabase as seis colunas básicas, tipos, constraints e policies já existentes.
2. Decidir se o frontend consumirá a API Nest existente ou o Supabase diretamente; manter apenas uma fonte de verdade.
3. Fechar o schema dos 14 detalhes usando o mapeamento da seção 18 e decidir `JSONB` versus tabelas filhas para prós/contras.
4. Definir a representação de ausência (`NULL` versus defaults) e a semântica de horários após meia-noite.
5. Criar uma migration revisável com colunas, defaults, checks, índices, foreign key e timestamps escolhidos.
6. Criar/testar policies RLS para `SELECT`, `INSERT`, `UPDATE` e `DELETE` via `wedding_members`.
7. Atualizar tipos/DTOs/backend antes de enviar os campos detalhados.
8. Criar funções de acesso com transformação camelCase/snake_case e tratamento consistente de erros.
9. Implementar e testar a migração idempotente do `localStorage`, sem apagar dados antes de validar cada registro remoto.
10. Migrar a UI para operações assíncronas com loading, bloqueio de cliques duplicados, retry e mensagens de erro.
11. Após validação, retirar `venues` de `saveState()`/`loadState()` sem afetar convidados, tarefas e despesas.
12. Atualizar documentação e testes de frontend/backend.

## 26. Validação desta documentação

- [x] Os 19 nomes do objeto criado foram conferidos em `pages/locais/main.js`.
- [x] Os IDs e `name` dos controles foram conferidos no HTML.
- [x] Os seis tipos de local e os dois conjuntos de quatro valores internos foram conferidos.
- [x] `null`, string vazia, `false`, zero e array vazio foram diferenciados.
- [x] A estrutura `{ id, title, description }` de `pros`/`cons` e a normalização legada foram confirmadas.
- [x] Funções de cadastro, edição, favorito, exclusão, modal e persistência foram conferidas.
- [x] O uso indireto de `loadState()` e direto de `saveState()`/`state.venues` foi diferenciado.
- [x] O contrato backend foi comparado com o frontend sem presumir colunas não documentadas.
- [x] Recomendações de PostgreSQL/RLS/migração foram separadas do estado atual.
- [x] Nenhum SQL foi executado, nenhuma migration/policy foi criada e nenhum banco foi alterado.
- [x] Nesta tarefa, somente este arquivo de documentação foi criado; HTML, CSS, JavaScript, testes e backend não foram modificados.

