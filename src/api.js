/**
 * A API que o arquivo de teste usa: `descrever`, `teste` e os ganchos.
 *
 * São só atalhos para o registro. Manter a API fina e o registro separado é o
 * que permite testar o executor sem precisar de um executor.
 */

import { registroCorrente } from './registro.js';

/** Declara um bloco. */
export function descrever(nome, corpo) {
  return registroCorrente().bloco(nome, corpo);
}

/** Declara um bloco que será pulado. */
descrever.pular = (nome, corpo) => registroCorrente().bloco(nome, corpo, { pular: true });

/** Declara o único bloco que deve rodar. */
descrever.so = (nome, corpo) => registroCorrente().bloco(nome, corpo, { soEste: true });

/** Declara um teste. */
export function teste(nome, corpo, opcoes) {
  return registroCorrente().teste(nome, corpo, opcoes);
}

/** Declara um teste que será pulado. */
teste.pular = (nome, corpo) => registroCorrente().teste(nome, corpo ?? (() => {}), { pular: true });

/** Declara o único teste que deve rodar. */
teste.so = (nome, corpo) => registroCorrente().teste(nome, corpo, { soEste: true });

/**
 * Declara um teste ainda por escrever.
 *
 * Um teste pendente é melhor que um comentário: ele aparece no relatório e
 * cobra a volta.
 */
teste.pendente = (nome) => registroCorrente().teste(nome, () => {}, { pular: true });

/** Roda uma vez antes de todos os testes do bloco. */
export function antesDeTodos(corpo) {
  registroCorrente().gancho('antesDeTodos', corpo);
}

/** Roda uma vez depois de todos os testes do bloco. */
export function depoisDeTodos(corpo) {
  registroCorrente().gancho('depoisDeTodos', corpo);
}

/** Roda antes de cada teste do bloco. */
export function antesDeCada(corpo) {
  registroCorrente().gancho('antesDeCada', corpo);
}

/** Roda depois de cada teste do bloco. */
export function depoisDeCada(corpo) {
  registroCorrente().gancho('depoisDeCada', corpo);
}
