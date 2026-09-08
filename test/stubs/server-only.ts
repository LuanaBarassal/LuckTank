// Stub para o pacote real "server-only", que lança incondicionalmente fora
// do build do Next.js (o alias no dev/prod normal é feito pelo webpack do
// Next; aqui é feito pelo Vitest, ver vitest.config.ts). Sem isso, qualquer
// módulo de lib/ que importa "server-only" não pode ser testado por vitest.
export {};
