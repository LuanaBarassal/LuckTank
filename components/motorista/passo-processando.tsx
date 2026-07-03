export default function PassoProcessando() {
  return (
    <div className="flex flex-col items-center gap-4 py-14 text-center">
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-primary-100 border-t-cyan-500"
        aria-hidden
      />
      <div>
        <p className="font-medium text-neutral-900">Lendo o comprovante...</p>
        <p className="mt-1 text-sm text-neutral-500">Só um instante, estamos conferindo os dados.</p>
      </div>
    </div>
  );
}
