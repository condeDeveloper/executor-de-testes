#!/usr/bin/env node
/**
 * A linha de comando.
 *
 * O código de saída é o que importa aqui: 1 quando algo falhou, 0 quando tudo
 * passou. É por ele que a integração contínua decide se o build quebrou, e
 * errar isso faz um pipeline verde mentir.
 */

import { Relatorio } from './relatorio.js';
import { LIMITE_PADRAO } from './executor.js';
import { rodar } from './index.js';

const AJUDA = `
testar — executor de testes

  testar [caminho] [opções]

Opções:
  -f, --filtro <texto>   roda só os testes cujo nome casa
  -l, --limite <ms>      limite de tempo por teste (padrão: ${LIMITE_PADRAO})
  -d, --detalhado        mostra também os testes que passaram
  --sem-cor              saída sem cor
  -h, --ajuda            mostra esta ajuda

Exemplos:
  testar
  testar testes/
  testar testes/soma.teste.js
  testar -f "soma" -d
`.trim();

/** Lê os argumentos da linha de comando. */
export function lerArgumentos(argumentos) {
  const opcoes = {
    alvo: '.',
    filtro: null,
    limite: LIMITE_PADRAO,
    detalhado: false,
    cor: true,
    ajuda: false,
  };

  for (let i = 0; i < argumentos.length; i += 1) {
    const atual = argumentos[i];

    if (atual === '-h' || atual === '--ajuda') {
      opcoes.ajuda = true;
    } else if (atual === '-d' || atual === '--detalhado') {
      opcoes.detalhado = true;
    } else if (atual === '--sem-cor') {
      opcoes.cor = false;
    } else if (atual === '-f' || atual === '--filtro') {
      i += 1;
      if (argumentos[i] === undefined) throw new Error('Faltou o texto depois de --filtro.');
      opcoes.filtro = new RegExp(argumentos[i], 'i');
    } else if (atual === '-l' || atual === '--limite') {
      i += 1;
      const valor = Number(argumentos[i]);
      if (!Number.isFinite(valor) || valor <= 0) throw new Error('O limite precisa ser um número positivo.');
      opcoes.limite = valor;
    } else if (atual.startsWith('-')) {
      throw new Error(`Opção desconhecida: ${atual}. Use --ajuda.`);
    } else {
      opcoes.alvo = atual;
    }
  }

  return opcoes;
}

/** Ponto de entrada. Devolve o código de saída. */
export async function principal(argumentos = process.argv.slice(2), escrever = console.log) {
  let opcoes;

  try {
    opcoes = lerArgumentos(argumentos);
  } catch (erro) {
    escrever(erro.message);
    return 2;
  }

  if (opcoes.ajuda) {
    escrever(AJUDA);
    return 0;
  }

  try {
    const resumo = await rodar({
      alvo: opcoes.alvo,
      filtro: opcoes.filtro,
      limite: opcoes.limite,
      relatorio: new Relatorio({ escrever, colorir: opcoes.cor, detalhado: opcoes.detalhado }),
    });

    return resumo.verde ? 0 : 1;
  } catch (erro) {
    escrever(`Não consegui rodar: ${erro.message}`);
    return 2;
  }
}

// Só roda quando o arquivo é o programa, não quando é importado pelos testes.
// Comparar o caminho real dos dois lados evita tanto o falso positivo de
// comparar só o nome do arquivo quanto o falso negativo de link simbólico,
// que é como o npm instala um `bin`.
if (process.argv[1]) {
  const { realpathSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');

  const executado = realpathSync(process.argv[1]);
  const esteArquivo = fileURLToPath(import.meta.url);

  if (executado === esteArquivo) {
    process.exitCode = await principal();
  }
}
