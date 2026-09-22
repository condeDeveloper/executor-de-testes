import { afirmar, antesDeCada, descrever, teste } from '../src/index.js';

descrever('soma', () => {
  let acumulado;

  antesDeCada(() => {
    acumulado = 0;
  });

  teste('soma dois números', () => {
    afirmar.igual(1 + 1, 2);
  });

  teste('o gancho zera antes de cada teste', () => {
    acumulado += 5;
    afirmar.igual(acumulado, 5);
  });

  teste('o gancho zerou de novo', () => {
    afirmar.igual(acumulado, 0);
  });

  teste.pular('este fica para depois', () => {
    afirmar.falhar('não deveria rodar');
  });

  teste.pendente('somar decimais sem erro de ponto flutuante');
});

descrever('assíncrono', () => {
  teste('espera a promessa', async () => {
    const valor = await Promise.resolve(42);
    afirmar.igual(valor, 42);
  });
});
