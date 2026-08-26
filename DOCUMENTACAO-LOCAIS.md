# Página de Locais — modelo funcional e financeiro

## 1. Escopo atual

A página `pages/locais` permite cadastrar, listar, visualizar, editar, favoritar e excluir locais vinculados ao casamento autenticado. Os dados são persistidos na tabela `venues` do Supabase e a interface mantém a migração única dos locais legados do `localStorage`.

O cadastro é dividido em três níveis:

1. dados principais: nome, tipo e endereço;
2. valores e cobrança: modelo financeiro opcional e destacado;
3. opções detalhadas recolhíveis: avaliação, estrutura, disponibilidade, prós e contras.

Esta evolução não calcula custo estimado do evento e não integra Locais com Convidados, Orçamento ou configurações gerais do casamento.

## 2. Aviso obrigatório antes de publicar

> **NÃO PUBLICAR ESTE FRONTEND ANTES DA MIGRAÇÃO DO BANCO.**

Os mapeadores do frontend já leem e enviam as colunas financeiras planejadas e a coluna `custom_type`. Essas colunas ainda não existem no banco atual. Um `INSERT` ou `UPDATE` real executado por esta versão antes da migração do schema falhará por coluna inexistente.

Não há fallback silencioso para remover campos do payload. Essa decisão evita gravar um local aparentemente com sucesso enquanto descarta dados financeiros preenchidos pelo usuário.

Nenhum SQL faz parte desta entrega e nenhuma alteração de schema ou RLS foi executada. A migração deve ser preparada, revisada e aplicada separadamente antes do deploy do frontend.

## 3. Modelo JavaScript normalizado

Além dos campos já existentes, todo local normalizado possui:

| Campo | Tipo normalizado | Padrão | Finalidade |
| --- | --- | --- | --- |
| `customType` | string ou null | `null` | Tipo livre usado quando `type` é `"Outro"` |
| `pricingType` | enum string | `"unknown"` | Forma de cobrança do local |
| `budgetValue` | number ou null | `null` | Valor fixo, do pacote ou valor base |
| `depositValue` | number ou null | `null` | Entrada solicitada |
| `pricePerAdult` | number ou null | `null` | Preço unitário por adulto |
| `childPricingType` | enum string | `"unknown"` | Regra de cobrança infantil |
| `pricePerChild` | number ou null | `null` | Preço unitário personalizado por criança |
| `childAgeLimit` | integer ou null | `null` | Idade máxima considerada na regra infantil |
| `includedGuests` | integer ou null | `null` | Quantidade de convidados incluída no pacote |
| `extraGuestPrice` | number ou null | `null` | Preço por convidado além do pacote |

### 3.1. Formas de cobrança

Valores válidos de `pricingType`:

- `fixed`: valor fixo ou pacote;
- `per_person`: cobrança por pessoa;
- `fixed_plus_per_person`: valor base mais preço por pessoa;
- `unknown`: ainda não informado.

Compatibilidade legada: quando `pricingType` não existe e `budgetValue` possui valor, o normalizador interpreta o registro como `fixed`. Um valor explicitamente válido sempre prevalece.

### 3.2. Regras infantis

Valores válidos de `childPricingType`:

- `free`: crianças não pagam;
- `same_as_adult`: mesmo valor do adulto;
- `custom`: valor infantil personalizado;
- `unknown`: ainda não informado.

Na normalização e no salvamento:

- `same_as_adult` e `unknown` limpam `pricePerChild` e `childAgeLimit` para `null`;
- `free` limpa `pricePerChild`, mas pode manter `childAgeLimit`;
- `custom` pode manter `pricePerChild` e `childAgeLimit`;
- `extraGuestPrice` vira `null` quando `includedGuests` é `null`.

Os valores digitados em controles apenas ocultos pela troca de modalidade permanecem no formulário durante a edição. A limpeza ocorre somente ao salvar regras semanticamente incompatíveis.

## 4. Colunas planejadas no Supabase

O contrato futuro da tabela `venues` deve contemplar as colunas abaixo. Esta seção descreve a migração necessária, mas não contém SQL executável.

| Coluna | Tipo esperado | Nulabilidade/padrão | Regra esperada |
| --- | --- | --- | --- |
| `custom_type` | text | nulo | texto personalizado somente quando `type = 'Outro'` |
| `pricing_type` | text/enum | não nulo, padrão `unknown` | `fixed`, `per_person`, `fixed_plus_per_person` ou `unknown` |
| `price_per_adult` | decimal/numeric | nulo | valor não negativo, duas casas decimais |
| `child_pricing_type` | text/enum | não nulo, padrão `unknown` | `free`, `same_as_adult`, `custom` ou `unknown` |
| `price_per_child` | decimal/numeric | nulo | valor não negativo, duas casas decimais |
| `child_age_limit` | integer | nulo | entre 0 e 17 |
| `included_guests` | integer | nulo | inteiro igual ou maior que zero |
| `extra_guest_price` | decimal/numeric | nulo | valor não negativo, duas casas decimais |

As colunas existentes `budget_value` e `deposit_value` permanecem. `budget_value` representa o valor fixo, do pacote ou a parcela base, conforme `pricing_type`.

A migração separada também deve tratar registros legados com `budget_value` preenchido e sem classificação financeira, definindo-os como cobrança fixa. As políticas RLS atuais não devem ser alteradas por esta entrega.

## 5. Mapeamento entre banco e interface

O arquivo `js/supabase.js` concentra os mapeadores.

### Banco → JavaScript

`mapVenueDatabaseRecord()` converte:

- `custom_type` → `customType`;
- `pricing_type` → `pricingType`;
- `price_per_adult` → `pricePerAdult`;
- `child_pricing_type` → `childPricingType`;
- `price_per_child` → `pricePerChild`;
- `child_age_limit` → `childAgeLimit`;
- `included_guests` → `includedGuests`;
- `extra_guest_price` → `extraGuestPrice`.

Valores numéricos ausentes ou inválidos são normalizados para `null`. Enums ausentes ou inválidos viram `unknown`, exceto a inferência fixa para o legado com orçamento.

### JavaScript → banco

`mapVenueToDatabasePayload()` produz as colunas em `snake_case`, elimina campos técnicos e aplica novamente os enums, limites inteiros e regras de coerência.

Os campos planejados são incluídos deliberadamente no payload. Por isso a migração do schema é pré-requisito de publicação.

## 6. Tipo personalizado do local

O select `type` mantém todas as opções anteriores. Quando o usuário seleciona `Outro`, o formulário revela o campo “Qual tipo de local?” sem criar uma nova seção.

O modelo preserva a compatibilidade esperada:

- `type` continua sendo `"Outro"`;
- `customType` recebe o texto livre com `trim`;
- espaços sem texto são recusados com a mensagem “Informe qual é o tipo do local.”;
- qualquer outro `type` oculta o campo e salva `customType: null`;
- registros antigos com `type: "Outro"` e sem `customType` continuam válidos na leitura.

Na edição de um local personalizado, o campo é aberto e preenchido automaticamente. Trocar o tipo para uma opção fixa mantém o texto somente no formulário durante aquela interação, mas o objeto salvo e o payload recebem `null`.

`getVenueDisplayType()` centraliza o texto apresentado. Cartões e modal mostram `customType` quando disponível, evitando exibir apenas “Outro”. A busca da página considera nome, tipo fixo, `customType`, tipo exibido e endereço; portanto, um local classificado como “Montanha” pode ser encontrado por esse texto.

A coluna futura necessária é `custom_type TEXT NULL`. Nenhum comando SQL ou arquivo de migration foi criado nesta tarefa.

## 7. Interface financeira

A seção “Valores e cobrança” fica logo após nome, tipo e endereço, antes das opções detalhadas recolhíveis.

Comportamento da forma de cobrança:

- `fixed`: exibe valor do pacote/base;
- `per_person`: exibe valor por adulto;
- `fixed_plus_per_person`: exibe ambos;
- `unknown`: mantém os campos específicos ocultos.

A entrada permanece disponível. O valor restante é apenas a diferença entre pacote/base e entrada, quando ambos existem em uma modalidade com parcela fixa. Ele não é persistido.

A política infantil controla a visibilidade do preço infantil e da idade-limite. A opção de convidados inclusos é um estado exclusivo da interface, derivado de `includedGuests`; nenhum booleano redundante é salvo no modelo ou no banco.

Configurações incompletas podem ser salvas como rascunho. A interface informa os dados ainda ausentes sem inventar estimativas e sem obrigar o usuário a conhecer todos os valores no primeiro cadastro.

## 8. Validações

As validações bloqueantes são:

- `customType` é obrigatório e não aceita somente espaços quando `type` é `"Outro"`;
- valores monetários não podem ser negativos e aceitam no máximo duas casas decimais;
- `childAgeLimit` deve ser inteiro entre 0 e 17;
- `includedGuests` deve ser inteiro igual ou maior que zero quando a opção estiver ativa;
- a entrada não pode superar o pacote/base nas modalidades com parcela fixa;
- as validações já existentes de nome, tipo, endereço, capacidade, avaliação e horários permanecem.

A ausência de preço numa modalidade selecionada gera aviso de rascunho, não bloqueio.

## 9. Exibição

Os cartões mantêm nome, tipo, endereço, favorito, avaliação e capacidade. Quando houver dados financeiros coerentes, exibem um resumo compacto com pacote/base, preço por adulto e/ou quantidade incluída.

O modal “Ver detalhes” possui a seção “Valores e cobrança”, que pode mostrar:

- forma de cobrança;
- valor do pacote/base;
- preço por adulto;
- entrada e valor restante aplicável;
- regra infantil formatada;
- convidados inclusos;
- preço por convidado excedente.

Nenhum total estimado do casamento é calculado.

As funções auxiliares usadas pela apresentação são:

- `formatVenuePricingType()`;
- `formatChildPricingRule()`;
- `getVenuePricingSummary()`;
- `hasDetailedInfo()`, agora incluindo todos os campos financeiros.

## 10. Migração do localStorage

O fluxo legado continua sendo uma importação única por casamento:

1. carrega os locais remotos;
2. lê a cópia antiga do `localStorage`;
3. normaliza cada local, incluindo os padrões financeiros;
4. evita duplicidade pela identidade existente;
5. cria os registros ausentes no Supabase;
6. só remove a chave legada e grava o marcador após sucesso integral.

Como o payload de migração também inclui as colunas planejadas, esse fluxo depende da mesma migração de schema anterior ao deploy.

## 11. Testes e limites desta entrega

Os testes automatizados cobrem:

- normalização, validação, cadastro, edição e limpeza de `customType`;
- apresentação do tipo personalizado em cartão e modal;
- busca por `customType` e estrutura responsiva do novo campo;
- mapeamento de `custom_type` nos dois sentidos;
- normalização padrão e compatibilidade legada;
- transformação `snake_case`/`camelCase` dos campos financeiros;
- coerência das regras infantis e do pacote;
- alternância visual sem perda silenciosa dos valores ocultos;
- salvamento do modelo financeiro completo;
- precisão monetária, idade e quantidade;
- resumo dos cartões e persistência remota simulada;
- regressões de CRUD, favorito, modal, prós/contras e migração local.

Os testes de Supabase usam mocks. Nenhum `INSERT`, `UPDATE`, `DELETE`, SQL ou alteração real de schema/RLS é executado por esta entrega.

Depois que a migração for aplicada em ambiente apropriado, ainda será necessário validar manualmente:

1. `INSERT` real de cada modalidade;
2. `UPDATE` real alternando modalidades;
3. recarga e leitura das colunas novas;
4. RLS com usuários de casamentos diferentes;
5. comportamento responsivo e acessibilidade no navegador.

## 12. Integrações futuras

Ficam explicitamente fora desta etapa:

- quantidade esperada de adultos e crianças vinda de Convidados;
- projeção automática do custo do local;
- lançamento ou conciliação com Orçamento;
- capacidade comparada ao total de convidados;
- preferências financeiras globais do casamento.

Essas integrações devem reutilizar o modelo desta página, sem duplicar os campos financeiros nem armazenar totais derivados.
