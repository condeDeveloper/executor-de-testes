/**
 * O registro: onde `descrever` e `teste` guardam o que foi declarado.
 *
 * Um arquivo de teste não executa nada quando é carregado — ele só monta uma
 * árvore. Separar a declaração da execução é o que permite contar os testes
 * antes de rodar, filtrar por nome sem executar o que foi filtrado e garantir
 * que os hooks de um bloco valham para tudo que está dentro dele.
 */

/** Um nó da árvore: um bloco ou um teste. */
export class No {
  constructor(tipo, nome, corpo, opcoes = {}) {
    this.tipo = tipo;
    this.nome = nome;
    this.corpo = corpo;
    this.filhos = [];
    this.pai = null;

    this.pular = opcoes.pular ?? false;
    this.soEste = opcoes.soEste ?? false;
    this.limite = opcoes.limite;

    this.antesDeTodos = [];
    this.depoisDeTodos = [];
    this.antesDeCada = [];
    this.depoisDeCada = [];
  }

  acrescentar(filho) {
    filho.pai = this;
    this.filhos.push(filho);
    return filho;
  }

  /** O nome completo, com o dos blocos acima. */
  get caminho() {
    const partes = [];

    for (let atual = this; atual !== null; atual = atual.pai) {
      if (atual.nome) partes.unshift(atual.nome);
    }

    return partes.join(' › ');
  }

  /** Indica se este nó ou algum acima dele foi marcado para pular. */
  get pulado() {
    for (let atual = this; atual !== null; atual = atual.pai) {
      if (atual.pular) return true;
    }

    return false;
  }

  /** Os hooks que rodam antes de cada teste, do bloco mais externo ao mais interno. */
  get ganchosDeEntrada() {
    const cadeia = [];

    for (let atual = this.pai; atual !== null; atual = atual.pai) {
      cadeia.unshift(...atual.antesDeCada);
    }

    return cadeia;
  }

  /** Os hooks de saída, do bloco mais interno ao mais externo. */
  get ganchosDeSaida() {
    const cadeia = [];

    for (let atual = this.pai; atual !== null; atual = atual.pai) {
      cadeia.push(...atual.depoisDeCada);
    }

    return cadeia;
  }

  /** Todos os testes abaixo deste nó. */
  get testes() {
    if (this.tipo === 'teste') return [this];

    return this.filhos.flatMap((filho) => filho.testes);
  }
}

/** Guarda a árvore enquanto o arquivo de teste é carregado. */
export class Registro {
  constructor() {
    this.raiz = new No('bloco', '', null);
    this.atual = this.raiz;
    this.temExclusivo = false;
  }

  bloco(nome, corpo, opcoes = {}) {
    const no = this.atual.acrescentar(new No('bloco', nome, corpo, opcoes));

    if (opcoes.soEste) this.temExclusivo = true;

    const anterior = this.atual;
    this.atual = no;

    try {
      corpo();
    } finally {
      this.atual = anterior;
    }

    return no;
  }

  teste(nome, corpo, opcoes = {}) {
    if (typeof corpo !== 'function') {
      throw new TypeError(`O teste ${JSON.stringify(nome)} precisa de uma função.`);
    }

    if (opcoes.soEste) this.temExclusivo = true;

    return this.atual.acrescentar(new No('teste', nome, corpo, opcoes));
  }

  gancho(tipo, corpo) {
    const destinos = {
      antesDeTodos: this.atual.antesDeTodos,
      depoisDeTodos: this.atual.depoisDeTodos,
      antesDeCada: this.atual.antesDeCada,
      depoisDeCada: this.atual.depoisDeCada,
    };

    if (!(tipo in destinos)) {
      throw new TypeError(`Gancho desconhecido: ${tipo}.`);
    }

    destinos[tipo].push(corpo);
  }

  /** Quantos testes foram declarados. */
  get quantidade() {
    return this.raiz.testes.length;
  }
}

let corrente = new Registro();

/** O registro em uso. */
export function registroCorrente() {
  return corrente;
}

/** Começa um registro novo e devolve o anterior. */
export function reiniciarRegistro() {
  const anterior = corrente;
  corrente = new Registro();
  return anterior;
}
