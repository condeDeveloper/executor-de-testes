/**
 * As asserções.
 *
 * O que separa uma asserção útil de um `if (!condicao) throw` é a mensagem de
 * falha: ela precisa dizer o que se esperava, o que veio e — quando os dois
 * parecem iguais — por que não são. Um teste que falha com "esperava true"
 * manda você abrir o depurador; um que falha mostrando a diferença resolve na
 * própria linha.
 */

/** Uma asserção falhou. */
export class ErroDeAfirmacao extends Error {
  constructor({ mensagem, obtido, esperado, operador }) {
    super(mensagem);
    this.name = 'ErroDeAfirmacao';
    this.obtido = obtido;
    this.esperado = esperado;
    this.operador = operador;
  }
}

/** Mostra um valor de forma legível na mensagem de falha. */
export function mostrar(valor, profundidade = 0) {
  if (valor === null) return 'null';
  if (valor === undefined) return 'undefined';

  const tipo = typeof valor;

  if (tipo === 'string') return JSON.stringify(valor);
  if (tipo === 'bigint') return `${valor}n`;
  if (tipo === 'symbol' || tipo === 'function') return String(valor);
  if (tipo !== 'object') return String(valor);

  if (profundidade > 2) return Array.isArray(valor) ? '[...]' : '{...}';

  if (valor instanceof Date) return valor.toISOString();
  if (valor instanceof RegExp) return String(valor);
  if (valor instanceof Error) return `${valor.name}: ${valor.message}`;

  if (Array.isArray(valor)) {
    return `[${valor.map((item) => mostrar(item, profundidade + 1)).join(', ')}]`;
  }

  if (valor instanceof Set) {
    return `Set(${[...valor].map((item) => mostrar(item, profundidade + 1)).join(', ')})`;
  }

  if (valor instanceof Map) {
    const pares = [...valor].map(([c, v]) => `${mostrar(c, profundidade + 1)} => ${mostrar(v, profundidade + 1)}`);
    return `Map(${pares.join(', ')})`;
  }

  const chaves = Object.keys(valor);
  const corpo = chaves.map((chave) => `${chave}: ${mostrar(valor[chave], profundidade + 1)}`).join(', ');

  return `{ ${corpo} }`;
}

/**
 * Compara dois valores em profundidade.
 *
 * `NaN` é igual a `NaN` aqui, e `0` não é igual a `-0`: é a semântica de
 * `Object.is`, que é a que faz sentido em teste. Com `===` cru, um teste que
 * espera `NaN` nunca passaria.
 */
export function iguais(um, outro, vistos = new Map()) {
  if (Object.is(um, outro)) return true;

  if (typeof um !== 'object' || typeof outro !== 'object' || um === null || outro === null) {
    return false;
  }

  // Referência cíclica: se o par já está sendo comparado, assumir igual é o
  // que impede a recursão infinita sem inventar desigualdade.
  if (vistos.get(um) === outro) return true;
  vistos.set(um, outro);

  if (Object.getPrototypeOf(um) !== Object.getPrototypeOf(outro)) return false;

  if (um instanceof Date) return um.getTime() === outro.getTime();
  if (um instanceof RegExp) return String(um) === String(outro);

  if (Array.isArray(um)) {
    return um.length === outro.length && um.every((item, i) => iguais(item, outro[i], vistos));
  }

  if (um instanceof Set) {
    return um.size === outro.size && [...um].every((item) => outro.has(item));
  }

  if (um instanceof Map) {
    return um.size === outro.size && [...um].every(([c, v]) => outro.has(c) && iguais(v, outro.get(c), vistos));
  }

  const chavesDeUm = Reflect.ownKeys(um).filter((c) => typeof c === 'string');
  const chavesDoOutro = Reflect.ownKeys(outro).filter((c) => typeof c === 'string');

  if (chavesDeUm.length !== chavesDoOutro.length) return false;

  return chavesDeUm.every(
    (chave) => Object.hasOwn(outro, chave) && iguais(um[chave], outro[chave], vistos),
  );
}

function falhar(mensagem, obtido, esperado, operador) {
  throw new ErroDeAfirmacao({ mensagem, obtido, esperado, operador });
}

/** O conjunto de asserções. */
export const afirmar = {
  /** O valor é verdadeiro. */
  ok(valor, mensagem) {
    if (!valor) {
      falhar(mensagem ?? `Esperava algo verdadeiro, veio ${mostrar(valor)}.`, valor, true, 'ok');
    }
  },

  /** O valor é falso. */
  naoOk(valor, mensagem) {
    if (valor) {
      falhar(mensagem ?? `Esperava algo falso, veio ${mostrar(valor)}.`, valor, false, 'naoOk');
    }
  },

  /** Os dois são o mesmo valor, sem conversão. */
  igual(obtido, esperado, mensagem) {
    if (!Object.is(obtido, esperado)) {
      falhar(
        mensagem ?? `Esperava ${mostrar(esperado)}, veio ${mostrar(obtido)}.`,
        obtido,
        esperado,
        'igual',
      );
    }
  },

  /** Os dois são valores diferentes. */
  diferente(obtido, esperado, mensagem) {
    if (Object.is(obtido, esperado)) {
      falhar(mensagem ?? `Não esperava ${mostrar(esperado)}.`, obtido, esperado, 'diferente');
    }
  },

  /** Os dois são iguais em profundidade. */
  igualProfundo(obtido, esperado, mensagem) {
    if (!iguais(obtido, esperado)) {
      falhar(
        mensagem ?? `Esperava ${mostrar(esperado)}, veio ${mostrar(obtido)}.`,
        obtido,
        esperado,
        'igualProfundo',
      );
    }
  },

  /** A coleção contém o item. */
  contem(colecao, item, mensagem) {
    const tem =
      typeof colecao === 'string'
        ? colecao.includes(item)
        : Array.isArray(colecao)
          ? colecao.some((atual) => iguais(atual, item))
          : colecao instanceof Set
            ? colecao.has(item)
            : false;

    if (!tem) {
      falhar(mensagem ?? `${mostrar(colecao)} não contém ${mostrar(item)}.`, colecao, item, 'contem');
    }
  },

  /** O texto casa com a expressão. */
  casa(texto, expressao, mensagem) {
    if (!expressao.test(texto)) {
      falhar(
        mensagem ?? `${mostrar(texto)} não casa com ${expressao}.`,
        texto,
        expressao,
        'casa',
      );
    }
  },

  /** O número está perto do esperado. */
  perto(obtido, esperado, tolerancia = 1e-9, mensagem) {
    if (Math.abs(obtido - esperado) > tolerancia) {
      falhar(
        mensagem ?? `Esperava algo perto de ${esperado} (±${tolerancia}), veio ${obtido}.`,
        obtido,
        esperado,
        'perto',
      );
    }
  },

  /** A função lança. */
  lanca(acao, esperado, mensagem) {
    let lancou = false;
    let erro;

    try {
      acao();
    } catch (capturado) {
      lancou = true;
      erro = capturado;
    }

    if (!lancou) {
      falhar(mensagem ?? 'Esperava que lançasse, mas nada foi lançado.', undefined, esperado, 'lanca');
    }

    conferirErro(erro, esperado, mensagem);
    return erro;
  },

  /** A promessa é rejeitada. */
  async rejeita(acao, esperado, mensagem) {
    let lancou = false;
    let erro;

    try {
      await (typeof acao === 'function' ? acao() : acao);
    } catch (capturado) {
      lancou = true;
      erro = capturado;
    }

    if (!lancou) {
      falhar(mensagem ?? 'Esperava rejeição, mas a promessa foi cumprida.', undefined, esperado, 'rejeita');
    }

    conferirErro(erro, esperado, mensagem);
    return erro;
  },

  /** Falha sempre. Útil para marcar caminho que não deveria ser alcançado. */
  falhar(mensagem = 'Falha pedida pelo teste.') {
    falhar(mensagem, undefined, undefined, 'falhar');
  },
};

function conferirErro(erro, esperado, mensagem) {
  if (esperado === undefined) return;

  if (esperado instanceof RegExp) {
    if (!esperado.test(erro?.message ?? String(erro))) {
      falhar(
        mensagem ?? `A mensagem ${mostrar(erro?.message)} não casa com ${esperado}.`,
        erro,
        esperado,
        'lanca',
      );
    }
    return;
  }

  if (typeof esperado === 'function') {
    if (!(erro instanceof esperado)) {
      falhar(
        mensagem ?? `Esperava ${esperado.name}, veio ${erro?.constructor?.name}.`,
        erro,
        esperado,
        'lanca',
      );
    }
    return;
  }

  if (typeof esperado === 'string' && !(erro?.message ?? '').includes(esperado)) {
    falhar(
      mensagem ?? `A mensagem ${mostrar(erro?.message)} não contém ${mostrar(esperado)}.`,
      erro,
      esperado,
      'lanca',
    );
  }
}
