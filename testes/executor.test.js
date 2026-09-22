import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { afirmar } from '../src/afirmacoes.js';
import { Executor, comLimite } from '../src/executor.js';
import { Registro } from '../src/registro.js';

/** Monta uma árvore usando um registro isolado, sem tocar no global. */
function arvore(montar) {
  const registro = new Registro();
  const anterior = { bloco: null };

  const descrever = (nome, corpo) => registro.bloco(nome, corpo);
  const teste = (nome, corpo, opcoes) => registro.teste(nome, corpo, opcoes);
  const gancho = (tipo, corpo) => registro.gancho(tipo, corpo);

  montar({ descrever, teste, gancho, registro, anterior });
  return registro;
}

describe('registro', () => {
  it('monta a árvore sem executar os testes', () => {
    let rodou = false;

    const registro = arvore(({ descrever, teste }) => {
      descrever('bloco', () => {
        teste('um', () => {
          rodou = true;
        });
      });
    });

    assert.equal(rodou, false);
    assert.equal(registro.quantidade, 1);
  });

  it('o caminho junta os nomes dos blocos', () => {
    const registro = arvore(({ descrever, teste }) => {
      descrever('fora', () => {
        descrever('dentro', () => {
          teste('folha', () => {});
        });
      });
    });

    assert.equal(registro.raiz.testes[0].caminho, 'fora › dentro › folha');
  });

  it('pular no bloco pula tudo que está dentro', () => {
    const registro = new Registro();
    registro.bloco('pulado', () => registro.teste('dentro', () => {}), { pular: true });

    assert.equal(registro.raiz.testes[0].pulado, true);
  });

  it('o bloco de fora pulado alcança o de dentro', () => {
    const registro = new Registro();
    registro.bloco(
      'fora',
      () => registro.bloco('dentro', () => registro.teste('folha', () => {})),
      { pular: true },
    );

    assert.equal(registro.raiz.testes[0].pulado, true);
  });

  it('teste sem função reclama', () => {
    assert.throws(() => new Registro().teste('sem corpo'), TypeError);
  });

  it('gancho desconhecido reclama', () => {
    assert.throws(() => new Registro().gancho('aoAcaso', () => {}), TypeError);
  });
});

describe('executor', () => {
  it('conta o que passou e o que falhou', async () => {
    const registro = arvore(({ descrever, teste }) => {
      descrever('b', () => {
        teste('passa', () => afirmar.ok(true));
        teste('falha', () => afirmar.falhar('de propósito'));
      });
    });

    const resumo = await new Executor().rodar(registro);

    assert.equal(resumo.passaram, 1);
    assert.equal(resumo.falharam, 1);
    assert.equal(resumo.total, 2);
    assert.equal(resumo.verde, false);
  });

  it('teste pulado não roda e conta como pulado', async () => {
    let rodou = false;

    const registro = arvore(({ descrever, teste }) => {
      descrever('b', () => {
        teste(
          'pulado',
          () => {
            rodou = true;
          },
          { pular: true },
        );
      });
    });

    const resumo = await new Executor().rodar(registro);

    assert.equal(rodou, false);
    assert.equal(resumo.pulados, 1);
  });

  it('os ganchos rodam na ordem certa', async () => {
    const passos = [];

    const registro = new Registro();
    registro.bloco('b', () => {
      registro.gancho('antesDeTodos', () => passos.push('antesDeTodos'));
      registro.gancho('antesDeCada', () => passos.push('antesDeCada'));
      registro.gancho('depoisDeCada', () => passos.push('depoisDeCada'));
      registro.gancho('depoisDeTodos', () => passos.push('depoisDeTodos'));
      registro.teste('um', () => passos.push('um'));
      registro.teste('dois', () => passos.push('dois'));
    });

    await new Executor().rodar(registro);

    assert.deepEqual(passos, [
      'antesDeTodos',
      'antesDeCada',
      'um',
      'depoisDeCada',
      'antesDeCada',
      'dois',
      'depoisDeCada',
      'depoisDeTodos',
    ]);
  });

  it('os ganchos do bloco de fora valem no de dentro', async () => {
    const passos = [];

    const registro = new Registro();
    registro.bloco('fora', () => {
      registro.gancho('antesDeCada', () => passos.push('fora'));
      registro.bloco('dentro', () => {
        registro.gancho('antesDeCada', () => passos.push('dentro'));
        registro.teste('t', () => passos.push('teste'));
      });
    });

    await new Executor().rodar(registro);

    assert.deepEqual(passos, ['fora', 'dentro', 'teste']);
  });

  it('depoisDeCada roda mesmo quando o teste falha', async () => {
    // Sem isso, uma falha deixa o estado sujo e os testes seguintes mentem
    // sobre onde está o problema.
    let limpou = false;

    const registro = new Registro();
    registro.bloco('b', () => {
      registro.gancho('depoisDeCada', () => {
        limpou = true;
      });
      registro.teste('falha', () => afirmar.falhar());
    });

    await new Executor().rodar(registro);

    assert.equal(limpou, true);
  });

  it('falha no gancho de saída não apaga a falha do teste', async () => {
    const registro = new Registro();
    registro.bloco('b', () => {
      registro.gancho('depoisDeCada', () => {
        throw new Error('o gancho também quebrou');
      });
      registro.teste('falha', () => afirmar.falhar('a falha de verdade'));
    });

    const resumo = await new Executor().rodar(registro);

    assert.equal(resumo.falharam, 1);
    assert.match(resumo.falhas[0].erro.message, /a falha de verdade/);
  });

  it('antesDeTodos não roda se tudo no bloco for pulado', async () => {
    // Montar um banco para depois pular todos os testes é desperdício, e às
    // vezes erro.
    let montou = false;

    const registro = new Registro();
    registro.bloco('b', () => {
      registro.gancho('antesDeTodos', () => {
        montou = true;
      });
      registro.teste('t', () => {}, { pular: true });
    });

    await new Executor().rodar(registro);

    assert.equal(montou, false);
  });

  it('o limite de tempo interrompe o teste travado', async () => {
    const registro = new Registro();
    registro.bloco('b', () => {
      registro.teste('trava', () => new Promise(() => {}));
    });

    const resumo = await new Executor({ limite: 50 }).rodar(registro);

    assert.equal(resumo.falharam, 1);
    assert.match(resumo.falhas[0].erro.message, /passou de 50 ms/);
  });

  it('o limite por teste tem prioridade sobre o global', async () => {
    const registro = new Registro();
    registro.bloco('b', () => {
      registro.teste('devagar', () => new Promise((cumprir) => setTimeout(cumprir, 80)), { limite: 400 });
    });

    const resumo = await new Executor({ limite: 20 }).rodar(registro);

    assert.equal(resumo.passaram, 1);
  });

  it('o filtro seleciona pelo caminho completo', async () => {
    const registro = arvore(({ descrever, teste }) => {
      descrever('soma', () => teste('dois números', () => {}));
      descrever('divisão', () => teste('por zero', () => {}));
    });

    const resumo = await new Executor({ filtro: /soma/ }).rodar(registro);

    assert.equal(resumo.total, 1);
    assert.match(resumo.resultados[0].nome, /soma/);
  });

  it('o exclusivo faz o resto ser ignorado', async () => {
    const registro = new Registro();
    registro.bloco('a', () => registro.teste('normal', () => {}));
    registro.bloco('b', () => registro.teste('escolhido', () => {}, { soEste: true }));

    const resumo = await new Executor().rodar(registro);

    assert.equal(resumo.total, 1);
    assert.match(resumo.resultados[0].nome, /escolhido/);
  });

  it('avisa a cada teste terminado', async () => {
    const vistos = [];

    const registro = arvore(({ descrever, teste }) => {
      descrever('b', () => {
        teste('um', () => {});
        teste('dois', () => {});
      });
    });

    await new Executor({ aoTerminarTeste: (r) => vistos.push(r.nome) }).rodar(registro);

    assert.equal(vistos.length, 2);
  });

  it('mede a duração', async () => {
    const registro = new Registro();
    registro.bloco('b', () => {
      registro.teste('espera', () => new Promise((cumprir) => setTimeout(cumprir, 20)));
    });

    const resumo = await new Executor().rodar(registro);

    assert.ok(resumo.resultados[0].duracao >= 15);
  });
});

describe('comLimite', () => {
  it('deixa passar o que termina a tempo', async () => {
    assert.equal(await comLimite(() => Promise.resolve(7), 500, 't'), 7);
  });

  it('interrompe o que demora', async () => {
    await assert.rejects(() => comLimite(() => new Promise(() => {}), 20, 't'), /passou de 20 ms/);
  });

  it('limite zero ou inválido desliga a trava', async () => {
    assert.equal(await comLimite(() => Promise.resolve(1), 0, 't'), 1);
  });
});
