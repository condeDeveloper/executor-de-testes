/**
 * O relatório.
 *
 * Relatório de teste é lido quando algo quebrou, quase sempre com pressa. Por
 * isso a falha vem com o caminho completo do teste, a diferença entre o
 * esperado e o obtido, e uma pilha já sem os quadros do próprio executor —
 * que só atrapalham quem está procurando a linha do erro.
 */

import { ErroDeAfirmacao, mostrar } from './afirmacoes.js';

const CORES = {
  verde: '[32m',
  vermelho: '[31m',
  amarelo: '[33m',
  cinza: '[90m',
  negrito: '[1m',
  fim: '[0m',
};

/** Aplica cor, ou devolve o texto cru quando a saída não é um terminal. */
export function pintar(texto, cor, colorir = true) {
  return colorir && CORES[cor] ? `${CORES[cor]}${texto}${CORES.fim}` : texto;
}

/** Arquivos do próprio executor, cujos quadros só atrapalham quem lê a falha. */
export const INTERNOS = ['afirmacoes.js', 'executor.js', 'index.js', 'relatorio.js'];

/**
 * Tira da pilha os quadros do próprio executor.
 *
 * Quem olha uma falha quer a linha do teste, não as três chamadas internas que
 * a asserção fez antes de lançar. Deixá-las ali empurra a informação útil para
 * baixo justamente quando se está com pressa.
 */
export function limparPilha(pilha, internos = INTERNOS) {
  if (typeof pilha !== 'string') return '';

  const ehInterno = (linha) =>
    internos.some((arquivo) => linha.includes(`/src/${arquivo}`) || linha.includes(`\\src\\${arquivo}`));

  return pilha
    .split('\n')
    .filter((linha) => !ehInterno(linha))
    .filter((linha) => !linha.includes('node:internal'))
    .slice(0, 6)
    .join('\n');
}

/** Descreve uma falha, com a diferença quando ela existe. */
export function descreverFalha(resultado, colorir = true) {
  const linhas = [pintar(`  ✖ ${resultado.nome}`, 'vermelho', colorir)];
  const erro = resultado.erro;

  linhas.push(`    ${erro?.message ?? String(erro)}`);

  if (erro instanceof ErroDeAfirmacao && erro.operador !== 'ok' && erro.operador !== 'falhar') {
    linhas.push(pintar(`    esperado: ${mostrar(erro.esperado)}`, 'cinza', colorir));
    linhas.push(pintar(`    obtido:   ${mostrar(erro.obtido)}`, 'cinza', colorir));
  }

  const pilha = limparPilha(erro?.stack);

  if (pilha) {
    linhas.push(pintar(pilha.split('\n').map((l) => `    ${l.trim()}`).join('\n'), 'cinza', colorir));
  }

  return linhas.join('\n');
}

/** Escreve o andamento e o resumo. */
export class Relatorio {
  constructor({ escrever = console.log, colorir = true, detalhado = false } = {}) {
    this.escrever = escrever;
    this.colorir = colorir;
    this.detalhado = detalhado;
  }

  arquivo(caminho) {
    this.escrever(pintar(`\n${caminho}`, 'negrito', this.colorir));
  }

  teste(resultado) {
    if (resultado.falhou) {
      this.escrever(pintar(`  ✖ ${resultado.nome}`, 'vermelho', this.colorir));
      return;
    }

    if (resultado.pulado) {
      this.escrever(pintar(`  - ${resultado.nome}`, 'amarelo', this.colorir));
      return;
    }

    if (this.detalhado) {
      const tempo = resultado.duracao > 0 ? ` (${resultado.duracao} ms)` : '';
      this.escrever(pintar(`  ✔ ${resultado.nome}${tempo}`, 'verde', this.colorir));
    }
  }

  resumo(resumo) {
    if (resumo.falharam > 0) {
      this.escrever(pintar('\nFalhas:', 'negrito', this.colorir));

      for (const falha of resumo.falhas) {
        this.escrever('');
        this.escrever(descreverFalha(falha, this.colorir));
      }
    }

    const partes = [pintar(`${resumo.passaram} passaram`, 'verde', this.colorir)];

    if (resumo.falharam > 0) partes.push(pintar(`${resumo.falharam} falharam`, 'vermelho', this.colorir));
    if (resumo.pulados > 0) partes.push(pintar(`${resumo.pulados} pulados`, 'amarelo', this.colorir));

    this.escrever(`\n${partes.join(', ')} — ${resumo.total} no total em ${resumo.duracao} ms`);
  }
}
