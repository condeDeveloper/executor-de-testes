/**
 * Descoberta dos arquivos de teste.
 *
 * O padrão é buscar por sufixo em vez de por pasta: `*.teste.js` em qualquer
 * lugar. Isso permite tanto manter os testes ao lado do código quanto isolá-los
 * numa pasta, sem o executor ter opinião sobre isso.
 */

import { readdir, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

/** Sufixos reconhecidos como arquivo de teste. */
export const SUFIXOS = ['.teste.js', '.teste.mjs', '.test.js'];

/** Pastas que nunca são percorridas. */
export const IGNORADAS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.cache']);

/** Indica se o caminho é um arquivo de teste. */
export function ehArquivoDeTeste(caminho) {
  return SUFIXOS.some((sufixo) => caminho.endsWith(sufixo));
}

/**
 * Procura arquivos de teste a partir de um caminho.
 *
 * Aceita tanto pasta quanto arquivo: passar o arquivo direto é o que permite
 * rodar um teste só sem precisar de filtro.
 */
export async function descobrir(alvo = '.', { sufixos = SUFIXOS, ignoradas = IGNORADAS } = {}) {
  const raiz = resolve(alvo);
  const informacao = await stat(raiz).catch(() => null);

  if (informacao === null) {
    throw new Error(`Caminho não encontrado: ${alvo}`);
  }

  if (informacao.isFile()) {
    return [raiz];
  }

  const achados = [];
  await percorrer(raiz, achados, sufixos, ignoradas);

  // Ordem alfabética para que a execução seja reproduzível entre máquinas: a
  // ordem do sistema de arquivos não é garantida.
  return achados.sort();
}

async function percorrer(pasta, achados, sufixos, ignoradas) {
  const entradas = await readdir(pasta, { withFileTypes: true }).catch(() => []);

  for (const entrada of entradas) {
    const caminho = join(pasta, entrada.name);

    if (entrada.isDirectory()) {
      if (!ignoradas.has(entrada.name) && !entrada.name.startsWith('.')) {
        await percorrer(caminho, achados, sufixos, ignoradas);
      }
      continue;
    }

    if (sufixos.some((sufixo) => entrada.name.endsWith(sufixo))) {
      achados.push(caminho);
    }
  }
}

/** Mostra o caminho relativo à raiz, para o relatório. */
export function relativo(caminho, raiz = process.cwd()) {
  const base = resolve(raiz);
  return caminho.startsWith(base + sep) ? caminho.slice(base.length + 1) : caminho;
}
