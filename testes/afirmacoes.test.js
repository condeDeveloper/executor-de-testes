import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ErroDeAfirmacao, afirmar, iguais, mostrar } from '../src/afirmacoes.js';

describe('iguais', () => {
  it('compara primitivos', () => {
    assert.equal(iguais(1, 1), true);
    assert.equal(iguais('a', 'a'), true);
    assert.equal(iguais(1, '1'), false);
  });

  it('NaN é igual a NaN, que é o que faz sentido em teste', () => {
    // Com === cru, um teste que espera NaN nunca passaria.
    assert.equal(iguais(NaN, NaN), true);
  });

  it('zero positivo não é zero negativo', () => {
    assert.equal(iguais(0, -0), false);
  });

  it('compara objetos em profundidade', () => {
    assert.equal(iguais({ a: { b: [1, 2] } }, { a: { b: [1, 2] } }), true);
    assert.equal(iguais({ a: 1 }, { a: 2 }), false);
  });

  it('quantidade de chaves diferente não é igual', () => {
    assert.equal(iguais({ a: 1 }, { a: 1, b: 2 }), false);
  });

  it('compara datas pelo instante', () => {
    assert.equal(iguais(new Date(0), new Date(0)), true);
    assert.equal(iguais(new Date(0), new Date(1)), false);
  });

  it('compara expressões regulares', () => {
    assert.equal(iguais(/a/g, /a/g), true);
    assert.equal(iguais(/a/g, /a/i), false);
  });

  it('compara Set e Map', () => {
    assert.equal(iguais(new Set([1, 2]), new Set([1, 2])), true);
    assert.equal(iguais(new Map([['a', 1]]), new Map([['a', 1]])), true);
    assert.equal(iguais(new Map([['a', 1]]), new Map([['a', 2]])), false);
  });

  it('protótipo diferente não é igual', () => {
    assert.equal(iguais(Object.create(null), {}), false);
  });

  it('referência cíclica não trava', () => {
    const um = { nome: 'a' };
    um.proprio = um;

    const outro = { nome: 'a' };
    outro.proprio = outro;

    assert.equal(iguais(um, outro), true);
  });
});

describe('mostrar', () => {
  it('põe aspas no texto, para distinguir de número', () => {
    assert.equal(mostrar('1'), '"1"');
    assert.equal(mostrar(1), '1');
  });

  it('mostra nulo e indefinido', () => {
    assert.equal(mostrar(null), 'null');
    assert.equal(mostrar(undefined), 'undefined');
  });

  it('mostra lista e objeto', () => {
    assert.equal(mostrar([1, 'a']), '[1, "a"]');
    assert.equal(mostrar({ a: 1 }), '{ a: 1 }');
  });

  it('mostra Set, Map e erro', () => {
    assert.equal(mostrar(new Set([1])), 'Set(1)');
    assert.equal(mostrar(new Map([['a', 1]])), 'Map("a" => 1)');
    assert.equal(mostrar(new TypeError('opa')), 'TypeError: opa');
  });

  it('corta o aninhamento fundo para a mensagem não virar um romance', () => {
    assert.match(mostrar({ a: { b: { c: { d: 1 } } } }), /\{\.\.\.\}/);
  });
});

describe('afirmar', () => {
  it('ok e naoOk', () => {
    afirmar.ok(1);
    afirmar.naoOk(0);
    assert.throws(() => afirmar.ok(false), ErroDeAfirmacao);
    assert.throws(() => afirmar.naoOk(true), ErroDeAfirmacao);
  });

  it('igual e diferente', () => {
    afirmar.igual(2, 2);
    afirmar.diferente(2, 3);
    assert.throws(() => afirmar.igual(2, 3), ErroDeAfirmacao);
    assert.throws(() => afirmar.diferente(2, 2), ErroDeAfirmacao);
  });

  it('igualProfundo', () => {
    afirmar.igualProfundo({ a: [1] }, { a: [1] });
    assert.throws(() => afirmar.igualProfundo({ a: 1 }, { a: 2 }), ErroDeAfirmacao);
  });

  it('contem funciona em texto, lista e Set', () => {
    afirmar.contem('abacaxi', 'caxi');
    afirmar.contem([1, 2], 2);
    afirmar.contem([{ a: 1 }], { a: 1 });
    afirmar.contem(new Set(['x']), 'x');
    assert.throws(() => afirmar.contem([1], 9), ErroDeAfirmacao);
  });

  it('casa com expressão regular', () => {
    afirmar.casa('pedido 42', /\d+/);
    assert.throws(() => afirmar.casa('abc', /\d/), ErroDeAfirmacao);
  });

  it('perto tolera a imprecisão do ponto flutuante', () => {
    afirmar.perto(0.1 + 0.2, 0.3);
    assert.throws(() => afirmar.perto(1, 2), ErroDeAfirmacao);
  });

  it('lanca confere que houve exceção', () => {
    afirmar.lanca(() => {
      throw new Error('opa');
    });

    assert.throws(() => afirmar.lanca(() => {}), ErroDeAfirmacao);
  });

  it('lanca confere a classe, a mensagem ou a expressão', () => {
    const acao = () => {
      throw new TypeError('faltou o campo nome');
    };

    afirmar.lanca(acao, TypeError);
    afirmar.lanca(acao, 'campo nome');
    afirmar.lanca(acao, /nome$/);

    assert.throws(() => afirmar.lanca(acao, RangeError), ErroDeAfirmacao);
    assert.throws(() => afirmar.lanca(acao, 'outra coisa'), ErroDeAfirmacao);
  });

  it('lanca devolve o erro capturado', () => {
    const erro = afirmar.lanca(() => {
      throw new Error('devolvido');
    });

    assert.equal(erro.message, 'devolvido');
  });

  it('rejeita confere a promessa rejeitada', async () => {
    await afirmar.rejeita(() => Promise.reject(new Error('caiu')), /caiu/);
    await afirmar.rejeita(Promise.reject(new Error('caiu')));

    await assert.rejects(() => afirmar.rejeita(() => Promise.resolve(1)), ErroDeAfirmacao);
  });

  it('falhar falha sempre', () => {
    assert.throws(() => afirmar.falhar('por aqui não'), /por aqui não/);
  });

  it('a falha carrega esperado, obtido e operador', () => {
    try {
      afirmar.igual(1, 2);
      assert.fail('deveria ter lançado');
    } catch (erro) {
      assert.equal(erro.obtido, 1);
      assert.equal(erro.esperado, 2);
      assert.equal(erro.operador, 'igual');
    }
  });

  it('a mensagem própria substitui a padrão', () => {
    assert.throws(() => afirmar.igual(1, 2, 'minha mensagem'), /minha mensagem/);
  });
});
