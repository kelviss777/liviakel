# Convidados — organização local por grupos

## Escopo desta etapa

A página de Convidados usa somente HTML, CSS e JavaScript puro e continua persistindo em `localStorage`, pela chave global `nosso-casamento-v1` e pela propriedade `guests`. Não há leitura ou gravação de convidados no Supabase, chamadas ao backend, SQL, migrations ou mudanças de RLS.

## Modelo armazenado

Cada item de `state.guests` representa um grupo:

```json
{
  "schemaVersion": 2,
  "id": "group-...",
  "category": "family",
  "name": "Família Silva",
  "relationshipGroup": "",
  "isClosed": false,
  "members": [{ "id": "member-...", "name": "Carlos Silva" }],
  "couples": [],
  "individuals": [],
  "createdAt": "2026-07-27T12:00:00.000Z"
}
```

Categorias:

- `godparents`: cartão único “Padrinhos”, com `couples` e `individuals`;
- `family`: um cartão por família, com `members`;
- `individual_group`: um cartão por origem, com `members` e `relationshipGroup`;
- `couples`: cartão único “Casais”, com `couples`.

Um casal contém `id`, `firstPersonName` e `secondPersonName`. Uma pessoa contém `id` e `name`.

## Compatibilidade com registros antigos

Ao abrir a página, `normalizeGuestGroups()` aceita registros simples com `id`, `name`, `guest_group` ou `group`. Esses registros são agrupados como `individual_group`; comparações ignoram caixa e espaços externos, o nome e o ID da pessoa são preservados e qualquer propriedade antiga de presença deixa de ser usada.

A normalização inicial ocorre apenas em memória. A página não grava nem apaga dados automaticamente durante a carga. A estrutura normalizada só é persistida quando o usuário conclui uma inclusão, edição, exclusão ou alteração de aberto/fechado com sucesso.

## Contagem e fechamento

`countGroupPeople()` é a fonte única de contagem:

- membro de família ou grupo de avulsos: 1 pessoa;
- casal comum ou casal de padrinhos: 2 pessoas;
- padrinho ou madrinha avulso: 1 pessoa.

`isClosed` serve apenas para organização visual. Fechar não remove pessoas, não bloqueia visualização/edição e não exclui o grupo da impressão. Editar mantém o valor atual de `isClosed`; somente a ação “Reabrir” o altera para `false`.

## Nomes de família

O prefixo visual “Família” não faz parte do valor editável do input. A interface armazena o nome completo do grupo, mas apresenta apenas o complemento durante cadastro e edição.

As funções `extractFamilyNameSuffix()`, `normalizeFamilyName()` e `buildFamilyDisplayName()` centralizam a remoção de prefixos repetidos e a montagem do nome final. `buildFamilyMemberFullName()` acrescenta o complemento da família aos integrantes, remove repetições consecutivas e trata nomes compostos de forma conservadora.

## Lista completa e cartões

“Ver lista completa” abre uma visão linear de todos os grupos e nomes, incluindo grupos fechados, usando `countAllPeople()` para o total real. A busca do modal reutiliza `filterGuestGroups()`.

Cada cartão possui uma superfície de abertura implementada como botão nativo. Os botões de editar, fechar/reabrir e excluir são elementos irmãos, por isso mantêm suas ações isoladas sem criar botões aninhados ou eventos de toque duplicados.

## Impressão e PDF

“Exportar em PDF” monta uma lista linear própria para papel, inclui todos os grupos e o total real de pessoas, aplica estilos `@media print` e chama `window.print()`. O navegador oferece então a opção de salvar como PDF, sem dependência externa.
