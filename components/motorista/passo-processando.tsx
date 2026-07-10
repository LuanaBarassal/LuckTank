interface Props {
  titulo?: string;
  subtitulo?: string;
}

export default function PassoProcessando({
  titulo = "Lendo o comprovante...",
  subtitulo = "Só um instante, estamos conferindo os dados.",
}: Props) {
  return (
    <div className="flex flex-col items-center gap-4 py-14 text-center">
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-primary-100 border-t-cyan-500"
        aria-hidden
      />
      <div>
        <p className="font-medium text-neutral-900">{titulo}</p>
        <p className="mt-1 text-sm text-neutral-500">{subtitulo}</p>
      </div>
    </div>
  );
}
