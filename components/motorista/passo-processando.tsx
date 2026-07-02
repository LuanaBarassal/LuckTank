export default function PassoProcessando() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"
        aria-hidden
      />
      <p className="text-neutral-600">Lendo o comprovante...</p>
    </div>
  );
}
