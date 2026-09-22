/**
 * O executor: percorre a árvore e roda o que precisa rodar.
 *
 * Dois cuidados carregam quase todo o peso aqui. O primeiro é o limite de
 * tempo: um teste que trava sem ele trava a suíte inteira, e a causa fica
 * invisível. O segundo é o `depoisDeCada` rodar mesmo quando o teste falha —
 * senão uma falha deixa o banco sujo e derruba os testes seguintes, que passam
 * a mentir sobre onde está o problema.
 */

import { ErroDeAfirmacao } from './afirmacoes.js';

/** Limite de tempo padrão de um teste. */
export const LIMITE_PADRAO = 5000;

/** O que aconteceu com um teste. */
export class Resultado {
  constructor(no, situacao, { erro = null, duracao = 0 } = {}) {
    this.nome = no.caminho;
    this.situacao = situacao;
    this.erro = erro;
    this.duracao = duracao;
  }

  get passou() {
    return this.situacao === 'passou';
  }

  get falhou() {
    return this.situacao === 'falhou';
  }

  get pulado() {
    return this.situacao === 'pulado';
  }
}

/** O resumo de uma execução. */
export class Resumo {
  constructor(resultados, duracao) {
    this.resultados = resultados;
    this.duracao = duracao;
  }

  get passaram() {
    return this.resultados.filter((r) => r.passou).length;
  }

  get falharam() {
    return this.resultados.filter((r) => r.falhou).length;
  }

  get pulados() {
    return this.resultados.filter((r) => r.pulado).length;
  }

  get total() {
    return this.resultados.length;
  }

  get falhas() {
    return this.resultados.filter((r) => r.falhou);
  }

  get verde() {
    return this.falharam === 0;
  }
}

/** Roda uma função com limite de tempo. */
export async function comLimite(acao, limite, nome) {
  if (!Number.isFinite(limite) || limite <= 0) {
    return acao();
  }

  let temporizador;

  const estouro = new Promise((_, rejeitar) => {
    temporizador = setTimeout(
      () => rejeitar(new Error(`O teste ${JSON.stringify(nome)} passou de ${limite} ms.`)),
      limite,
    );
  });

  try {
    return await Promise.race([acao(), estouro]);
  } finally {
    clearTimeout(temporizador);
  }
}

export class Executor {
  constructor({ limite = LIMITE_PADRAO, filtro = null, aoTerminarTeste = null } = {}) {
    this.limite = limite;
    this.filtro = filtro;
    this.aoTerminarTeste = aoTerminarTeste;
  }

  /** Roda a árvore de um registro. */
  async rodar(registro) {
    const comeco = Date.now();
    const resultados = [];

    await this.rodarBloco(registro.raiz, registro.temExclusivo, resultados);

    return new Resumo(resultados, Date.now() - comeco);
  }

  async rodarBloco(bloco, temExclusivo, resultados) {
    const selecionados = bloco.filhos.filter((filho) => this.interessa(filho, temExclusivo));

    if (selecionados.length === 0) {
      return;
    }

    // Os ganchos de bloco só rodam se sobrou algo para rodar: montar um banco
    // para depois pular todos os testes é desperdício, e às vezes erro.
    const algumRoda = selecionados.some((filho) => !filho.pulado);

    if (algumRoda) {
      for (const gancho of bloco.antesDeTodos) {
        await gancho();
      }
    }

    try {
      for (const filho of selecionados) {
        if (filho.tipo === 'bloco') {
          await this.rodarBloco(filho, temExclusivo, resultados);
        } else {
          resultados.push(await this.rodarTeste(filho));
        }
      }
    } finally {
      if (algumRoda) {
        for (const gancho of bloco.depoisDeTodos) {
          await gancho();
        }
      }
    }
  }

  async rodarTeste(no) {
    if (no.pulado) {
      return this.registrar(new Resultado(no, 'pulado'));
    }

    const comeco = Date.now();

    try {
      for (const gancho of no.ganchosDeEntrada) {
        await gancho();
      }

      await comLimite(() => no.corpo(), no.limite ?? this.limite, no.caminho);

      return this.registrar(new Resultado(no, 'passou', { duracao: Date.now() - comeco }));
    } catch (erro) {
      return this.registrar(new Resultado(no, 'falhou', { erro, duracao: Date.now() - comeco }));
    } finally {
      // Sai mesmo com falha: deixar o estado sujo faz os testes seguintes
      // mentirem sobre onde está o problema.
      for (const gancho of no.ganchosDeSaida) {
        try {
          await gancho();
        } catch {
          // Falha em gancho de saída não pode apagar a falha do teste.
        }
      }
    }
  }

  /** Decide se um nó entra nesta execução. */
  interessa(no, temExclusivo) {
    if (temExclusivo && !this.temExclusivoDentro(no)) {
      return false;
    }

    if (this.filtro === null) {
      return true;
    }

    if (no.tipo === 'teste') {
      return this.filtro.test(no.caminho);
    }

    return no.testes.some((teste) => this.filtro.test(teste.caminho));
  }

  temExclusivoDentro(no) {
    if (no.soEste) return true;

    return no.tipo === 'bloco' && no.filhos.some((filho) => this.temExclusivoDentro(filho));
  }

  registrar(resultado) {
    this.aoTerminarTeste?.(resultado);
    return resultado;
  }
}

/** Indica se o erro veio de uma asserção, e não de um defeito no teste. */
export function ehDeAfirmacao(erro) {
  return erro instanceof ErroDeAfirmacao;
}
