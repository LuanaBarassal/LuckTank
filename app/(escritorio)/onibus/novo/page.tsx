import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import VeiculoForm from "@/components/escritorio/veiculo-form";

export default async function NovoVeiculoPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  if (usuario.papel !== "administrador") {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-semibold">Novo veículo</h1>
        <p className="text-sm text-red-400">
          Só administradores podem cadastrar veículos.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Novo veículo</h1>
      <VeiculoForm empresaId={usuario.empresa_id} />
    </div>
  );
}
