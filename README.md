# executor-de-testes

Um executor de testes escrito do zero: descoberta de arquivos, `descrever`/`teste`,
asserções com mensagem útil, ganchos, limite de tempo e relatório. **Zero
dependências.**

```js
import { descrever, teste, afirmar, antesDeCada } from 'executor-de-testes';

descrever('carrinho', () => {
  let carrinho;

  antesDeCada(() => {
    carrinho = [];
  });

  teste('começa vazio', () => {
    afirmar.igual(carrinho.length, 0);
  });

  teste('soma os itens', () => {
    carrinho.push({ preco: 10 }, { preco: 5 });
    afirmar.igual(carrinho.reduce((t, i) => t + i.preco, 0), 15);
  });

  teste.pendente('aplicar cupom de desconto');
});
```

```bash
$ testar exemplos

exemplos/falha.teste.js
  ✖ um bloco com falha › este falha de propósito

Falhas:

  ✖ um bloco com falha › este falha de propósito
    a conta não fecha
    esperado: 5
    obtido:   4
    at No.corpo (exemplos/falha.teste.js:9:13)

1 passaram, 1 falharam — 2 no total em 1 ms
```

## Por que existe

Todo dev usa um executor de testes todo dia e quase nenhum abriu um. Por dentro
são cinco problemas separados, e cada um tem uma decisão que não é óbvia.

### 1. Declarar não é executar

Um arquivo de teste não roda nada ao ser carregado: ele **monta uma árvore**.
Separar as duas fases é o que permite contar os testes antes de rodar, filtrar
por nome sem executar o que foi filtrado, e garantir que um gancho declarado
depois do teste ainda valha para ele.

### 2. A mensagem de falha é o produto

O que separa uma asserção de um `if (!condicao) throw` é a mensagem. Um teste
que falha com "esperava true" manda você abrir o depurador; um que mostra
`esperado: 5` / `obtido: 4` resolve na própria linha.

E a pilha vem **sem os quadros do próprio executor**. Sem essa limpeza, as três
primeiras linhas são chamadas internas da asserção, e a linha que interessa —
a do seu teste — fica empurrada para baixo justamente quando você está com
pressa.

### 3. `NaN` precisa ser igual a `NaN`

A comparação usa a semântica de `Object.is`: `NaN` é igual a `NaN`, e `0` não é
igual a `-0`. Com `===` cru, um teste que espera `NaN` nunca passaria. A
comparação profunda também atravessa `Date`, `RegExp`, `Set`, `Map` e
**referência cíclica** sem entrar em recursão infinita.

### 4. `depoisDeCada` tem que rodar mesmo quando o teste falha

Se a limpeza só roda no caminho feliz, uma falha deixa o banco sujo e derruba os
testes seguintes — que passam a mentir sobre onde está o problema. E uma falha
**no gancho de saída** não pode apagar a falha do teste, senão o relatório
aponta para o lugar errado.

### 5. Teste travado não pode travar a suíte

Sem limite de tempo, um `await` que nunca resolve pendura tudo e a causa fica
invisível. O limite é configurável por teste, e o limite do teste tem
prioridade sobre o global.

## A API

```js
descrever(nome, corpo)      descrever.pular(...)   descrever.so(...)
teste(nome, corpo)          teste.pular(...)       teste.so(...)
teste.pendente(nome)        // aparece no relatório e cobra a volta

antesDeTodos  depoisDeTodos  antesDeCada  depoisDeCada
```

Asserções: `ok`, `naoOk`, `igual`, `diferente`, `igualProfundo`, `contem`,
`casa`, `perto`, `lanca`, `rejeita`, `falhar`.

`lanca` e `rejeita` aceitam classe, texto ou expressão regular — e devolvem o
erro capturado, para conferir o resto dele:

```js
const erro = afirmar.lanca(() => validar({}), /campo nome/);
afirmar.igual(erro.status, 422);
```

## Linha de comando

```bash
testar                          # procura *.teste.js a partir daqui
testar testes/                  # numa pasta
testar testes/soma.teste.js     # num arquivo só
testar -f "carrinho" -d         # filtrando, com os que passaram à mostra
testar -l 10000                 # limite de tempo por teste
testar --sem-cor                # para log de CI
```

O código de saída é **1 quando algo falhou** e 0 quando tudo passou. É por ele
que a integração contínua decide se o build quebrou — errar isso faz um
pipeline verde mentir.

## Estrutura

```
src/afirmacoes.js  asserções, comparação profunda e como um valor é mostrado
src/registro.js    a árvore de blocos e testes, montada na declaração
src/api.js         descrever, teste e os ganchos
src/executor.js    percorre a árvore, aplica limite de tempo e ganchos
src/relatorio.js   saída no terminal, cores e limpeza da pilha
src/descoberta.js  encontra os arquivos de teste
src/cli.js         argumentos e código de saída
```

## Rodando

```bash
npm test
```

75 testes, rodados com o `node:test` embutido — um executor de testes não pode
ser a única coisa validando a si mesmo. Node 20 ou mais novo, sem dependências.

## Limites conhecidos

- **Tudo no mesmo processo.** Não há isolamento entre arquivos além do registro
  limpo, então um teste que mexe em estado global afeta os seguintes.
- Sem execução em paralelo.
- Sem cobertura de código, sem *snapshot* e sem *mocks* — `node:test` e
  `node --experimental-test-coverage` cobrem isso melhor.
- Sem modo observador (`--watch`).
- A descoberta é por sufixo de arquivo; não há padrão glob configurável.

## Licença

MIT.
