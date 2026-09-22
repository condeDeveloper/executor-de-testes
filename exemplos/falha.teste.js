import { afirmar, descrever, teste } from '../src/index.js';

descrever('um bloco com falha', () => {
  teste('este passa', () => {
    afirmar.ok(true);
  });

  teste('este falha de propósito', () => {
    afirmar.igual(2 + 2, 5, 'a conta não fecha');
  });
});
