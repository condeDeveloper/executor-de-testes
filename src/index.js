/**
 * Executor de testes do zero.
 *
 *     import { descrever, teste, afirmar } from 'executor-de-testes';
 *
 *     descrever('soma', () => {
 *       teste('soma dois números', () => {
 *         afirmar.igual(1 + 1, 2);
 *       });
 *     });
 *
 * E na linha de comando: `testar` procura os `*.teste.js` e roda todos.
 */

import { pathToFileURL } from 'node:url';

import { Executor, LIMITE_PADRAO, Resumo } from './executor.js';
import { Relatorio } from './relatorio.js';
import { descobrir, relativo } from './descoberta.js';
import { reiniciarRegistro, registroCorrente } from './registro.js';

export { afirmar, iguais, mostrar, ErroDeAfirmacao } from './afirmacoes.js';
export { descrever, teste, antesDeTodos, depoisDeTodos, antesDeCada, depoisDeCada } from './api.js';
export { Executor, Resultado, Resumo, LIMITE_PADRAO, comLimite } from './executor.js';
export { Relatorio, descreverFalha, limparPilha, pintar } from './relatorio.js';
export { descobrir, ehArquivoDeTeste, relativo, SUFIXOS } from './descoberta.js';
export { Registro, No, registroCorrente, reiniciarRegistro } from './registro.js';

/**
 * Roda os testes de um caminho.
 *
 * Cada arquivo ganha um registro limpo: sem isso, o `descrever` de um arquivo
 * apareceria dentro do relatório do seguinte, e um `so` vazaria de um arquivo
 * para o outro.
 */
export async function rodar({
  alvo = '.',
  filtro = null,
  limite = LIMITE_PADRAO,
  relatorio = new Relatorio(),
  detalhado = false,
} = {}) {
  const arquivos = await descobrir(alvo);
  const todos = [];
  let duracao = 0;

  for (const arquivo of arquivos) {
    reiniciarRegistro();

    // A consulta na URL evita o cache de módulo do Node, que devolveria a
    // mesma instância se o arquivo fosse carregado duas vezes na mesma sessão.
    await import(`${pathToFileURL(arquivo).href}?carga=${Date.now()}`);

    const registro = registroCorrente();

    if (registro.quantidade === 0) {
      continue;
    }

    relatorio.arquivo(relativo(arquivo));

    const executor = new Executor({
      limite,
      filtro,
      aoTerminarTeste: (resultado) => relatorio.teste(resultado),
    });

    const resumo = await executor.rodar(registro);

    todos.push(...resumo.resultados);
    duracao += resumo.duracao;
  }

  const total = new Resumo(todos, duracao);
  relatorio.resumo(total);

  return total;
}
