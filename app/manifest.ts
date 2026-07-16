import type { MetadataRoute } from "next";

// Next.js detecta este arquivo especial e gera /manifest.webmanifest, além de
// injetar o <link rel="manifest"> automaticamente no <head>.
//
// `launch_handler` faz parte da Web App Manifest spec de verdade (e é
// respeitado pelos navegadores que o suportam), mas o tipo `Manifest` que
// o Next.js embute está desatualizado pra esse campo (espera um shape de
// `{ platform, url }` que não existe na spec real) — por isso o objeto é
// montado sem anotar o tipo de retorno da função inline, e só convertido
// pra `MetadataRoute.Manifest` no final (`as`, não checagem de literal),
// evitando o erro de "propriedade desconhecida" do `tsc` sem mascarar
// nenhum erro de tipo de verdade nos outros campos.
export default function manifest() {
  const config = {
    name: "LuckTank",
    short_name: "LuckTank",
    description: "Controle de combustível e anti-fraude para frotas",
    start_url: "/",
    // Achado 2026-07-16 (validação do fluxo de recuperação de senha): sem
    // isso, o comportamento padrão de várias implementações de PWA, ao
    // "capturar" um link externo (ex.: o link do e-mail de recuperação de
    // senha, aberto a partir do app de e-mail) que caia dentro do escopo
    // do app instalado, é reaproveitar a janela já aberta e navegar pro
    // `start_url` — descartando a URL real do link clicado (incluindo o
    // hash com o token de recuperação). `client_mode: "navigate-new"`
    // instrui o navegador a navegar de verdade pra URL do link recebido
    // em vez de cair no `start_url`. Suporte é só em navegadores
    // Chromium (Android/desktop) — Safari/iOS ainda não implementa a
    // Launch Handler API; nesses o caminho seguro continua sendo abrir o
    // link "no navegador" em vez de deixar abrir no app instalado.
    launch_handler: {
      client_mode: "navigate-new",
    },
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#0a1628",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };

  return config as MetadataRoute.Manifest;
}
