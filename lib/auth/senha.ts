// Regras de qualidade mínima de senha (auditoria 2026-07-16: mínimo antigo
// era 6 caracteres, sem checagem nenhuma de trivialidade). Deliberadamente
// leve — comprimento maior é a alavanca com melhor evidência real (NIST
// 800-63B recomenda priorizar tamanho sobre exigir símbolo/maiúscula/dígito
// obrigatórios, que na prática só empurram o usuário a padrões previsíveis
// tipo "Senha123!"), então não exigimos regra de complexidade nenhuma além
// do comprimento — só barra o óbvio (lista trivial + caractere único
// repetido). Função pura, testável isoladamente — mesmo padrão de
// lib/validacao/regras.ts.

export const TAMANHO_MINIMO_SENHA = 8;

const SENHAS_TRIVIAIS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "senha123",
  "senha1234",
  "qwertyui",
  "11111111",
  "abcd1234",
  "administrador",
  "lucktank1",
  "lucktank123",
]);

export interface ResultadoValidacaoSenha {
  valida: boolean;
  erro?: string;
}

export function validarSenha(senha: string): ResultadoValidacaoSenha {
  if (senha.length < TAMANHO_MINIMO_SENHA) {
    return {
      valida: false,
      erro: `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`,
    };
  }

  if (SENHAS_TRIVIAIS.has(senha.toLowerCase())) {
    return { valida: false, erro: "Essa senha é muito comum — escolha outra." };
  }

  // "aaaaaaaa", "11111111" (já cai na lista acima, mas cobre variações
  // maiores/outros caracteres) — mesmo caractere repetido do começo ao fim.
  if (/^(.)\1+$/.test(senha)) {
    return { valida: false, erro: "A senha não pode ser o mesmo caractere repetido." };
  }

  return { valida: true };
}
