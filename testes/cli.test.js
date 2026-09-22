import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ErroDeAfirmacao } from '../src/afirmacoes.js';
import { descobrir, ehArquivoDeTeste, relativo } from '../src/descoberta.js';
import { Relatorio, descreverFalha, limparPilha, pintar } from '../src/relatorio.js';
import { Resultado } from '../src/executor.js';
import { lerArgumentos, principal } from '../src/cli.js';
import { rodar } from '../src/index.js';

const EXEMPLOS = join(process.cwd(), 'exemplos');

describe('descoberta', () => {
  it('reconhece o sufixo de teste', () => {
    assert.equal(ehArquivoDeTeste('soma.teste.js'), true);
    assert.equal(ehArquivoDeTeste('soma.js'), false);
  });

  it('acha os arquivos de uma pasta', async () => {
    const achados = await descobrir(EXEMPLOS);

    assert.equal(achados.length, 2);
    assert.ok(achados.every(ehArquivoDeTeste));
  });

  it('a ordem é alfabética, para a execução ser reproduzível', async () => {
    const achados = await descobrir(EXEMPLOS);

    assert.deepEqual([...achados].sort(), achados);
  });

  it('aceita um arquivo em vez de pasta', async () => {
    const um = join(EXEMPLOS, 'soma.teste.js');

    assert.deepEqual(await descobrir(um), [um]);
  });

  it('caminho que não existe reclama', async () => {
    await assert.rejects(() => descobrir('./nao-existe'), /não encontrado/);
  });

  it('mostra o caminho relativo', () => {
    assert.equal(relativo(join(process.cwd(), 'a', 'b.js')), join('a', 'b.js'));
  });
});

describe('relatório', () => {
  it('tira da pilha os quadros do próprio executor', () => {
    // A linha que interessa é a do teste; as chamadas internas da asserção só
    // empurram ela para baixo.
    const pilha = [
      'Error: falhou',
      '    at falhar (/projeto/src/afirmacoes.js:106:9)',
      '    at Object.igual (/projeto/src/afirmacoes.js:128:7)',
      '    at teste (/projeto/testes/meu.teste.js:3:5)',
      '    at Executor.rodarTeste (/projeto/src/executor.js:120:7)',
      '    at node:internal/process/task_queues:95:5',
    ].join('\n');

    const limpa = limparPilha(pilha);

    assert.match(limpa, /meu\.teste\.js/);
    assert.ok(!limpa.includes('afirmacoes.js'));
    assert.ok(!limpa.includes('executor.js'));
    assert.ok(!limpa.includes('node:internal'));
  });

  it('a pilha limpa começa na linha do teste', () => {
    const pilha = [
      'Error: falhou',
      '    at falhar (/projeto/src/afirmacoes.js:106:9)',
      '    at teste (/projeto/testes/meu.teste.js:3:5)',
    ].join('\n');

    assert.match(limparPilha(pilha).split('\n')[1], /meu\.teste\.js/);
  });

  it('pilha ausente não quebra', () => {
    assert.equal(limparPilha(undefined), '');
  });

  it('a falha mostra o esperado e o obtido', () => {
    const erro = new ErroDeAfirmacao({
      mensagem: 'Esperava 5, veio 4.',
      obtido: 4,
      esperado: 5,
      operador: 'igual',
    });

    const texto = descreverFalha({ nome: 'soma › dois', erro }, false);

    assert.match(texto, /soma › dois/);
    assert.match(texto, /esperado: 5/);
    assert.match(texto, /obtido:   4/);
  });

  it('sem cor a saída sai limpa', () => {
    assert.equal(pintar('oi', 'verde', false), 'oi');
    assert.match(pintar('oi', 'verde', true), /\[32m/);
  });

  it('o resumo conta tudo', () => {
    const linhas = [];
    const relatorio = new Relatorio({ escrever: (l) => linhas.push(l), colorir: false });

    relatorio.resumo({
      passaram: 3,
      falharam: 1,
      pulados: 2,
      total: 6,
      duracao: 42,
      falhas: [{ nome: 'x', erro: new Error('quebrou') }],
    });

    const tudo = linhas.join('\n');

    assert.match(tudo, /3 passaram/);
    assert.match(tudo, /1 falharam/);
    assert.match(tudo, /2 pulados/);
    assert.match(tudo, /6 no total em 42 ms/);
  });

  it('o teste que passou só aparece no modo detalhado', () => {
    const calado = [];
    const falante = [];

    const noSilencio = new Relatorio({ escrever: (l) => calado.push(l), colorir: false });
    const noDetalhe = new Relatorio({ escrever: (l) => falante.push(l), colorir: false, detalhado: true });

    const passou = new Resultado({ caminho: 'a › b' }, 'passou', { duracao: 1 });

    noSilencio.teste(passou);
    noDetalhe.teste(passou);

    assert.equal(calado.length, 0);
    assert.equal(falante.length, 1);
  });
});

describe('rodar', () => {
  it('roda os exemplos e conta certo', async () => {
    const linhas = [];
    const resumo = await rodar({
      alvo: EXEMPLOS,
      relatorio: new Relatorio({ escrever: (l) => linhas.push(l), colorir: false }),
    });

    // soma.teste.js: 4 passam, 2 pulados. falha.teste.js: 1 passa, 1 falha.
    assert.equal(resumo.passaram, 5);
    assert.equal(resumo.falharam, 1);
    assert.equal(resumo.pulados, 2);
    assert.equal(resumo.verde, false);
  });

  it('cada arquivo ganha um registro limpo', async () => {
    // Sem isso, os testes de um arquivo apareceriam no relatório do seguinte.
    const primeira = await rodar({ alvo: EXEMPLOS, relatorio: new Relatorio({ escrever: () => {} }) });
    const segunda = await rodar({ alvo: EXEMPLOS, relatorio: new Relatorio({ escrever: () => {} }) });

    assert.equal(primeira.total, segunda.total);
  });

  it('o filtro corta pelo nome', async () => {
    const resumo = await rodar({
      alvo: EXEMPLOS,
      filtro: /assíncrono/,
      relatorio: new Relatorio({ escrever: () => {} }),
    });

    assert.equal(resumo.total, 1);
  });
});

describe('linha de comando', () => {
  it('lê as opções', () => {
    const opcoes = lerArgumentos(['testes/', '-f', 'soma', '-l', '100', '-d', '--sem-cor']);

    assert.equal(opcoes.alvo, 'testes/');
    assert.equal(opcoes.filtro.source, 'soma');
    assert.equal(opcoes.limite, 100);
    assert.equal(opcoes.detalhado, true);
    assert.equal(opcoes.cor, false);
  });

  it('usa os padrões quando nada é passado', () => {
    const opcoes = lerArgumentos([]);

    assert.equal(opcoes.alvo, '.');
    assert.equal(opcoes.filtro, null);
  });

  it('recusa opção desconhecida', () => {
    assert.throws(() => lerArgumentos(['--inventada']), /desconhecida/);
  });

  it('recusa filtro sem texto e limite inválido', () => {
    assert.throws(() => lerArgumentos(['-f']), /Faltou/);
    assert.throws(() => lerArgumentos(['-l', 'abc']), /número positivo/);
  });

  it('a ajuda sai com código zero', async () => {
    const linhas = [];

    assert.equal(await principal(['--ajuda'], (l) => linhas.push(l)), 0);
    assert.match(linhas.join('\n'), /executor de testes/);
  });

  it('suíte com falha sai com código 1, que é o que a CI lê', async () => {
    const codigo = await principal([EXEMPLOS, '--sem-cor'], () => {});

    assert.equal(codigo, 1);
  });

  it('suíte verde sai com código 0', async () => {
    const codigo = await principal([join(EXEMPLOS, 'soma.teste.js'), '--sem-cor'], () => {});

    assert.equal(codigo, 0);
  });

  it('caminho inexistente sai com código 2', async () => {
    const linhas = [];
    const codigo = await principal(['./nao-existe'], (l) => linhas.push(l));

    assert.equal(codigo, 2);
    assert.match(linhas.join('\n'), /Não consegui rodar/);
  });

  it('opção inválida sai com código 2', async () => {
    assert.equal(await principal(['--inventada'], () => {}), 2);
  });
});
