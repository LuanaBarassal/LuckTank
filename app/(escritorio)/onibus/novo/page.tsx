import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import VeiculoForm from "@/components/escritorio/veiculo-form";

export default async function NovoVeiculoPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  if (usuario.papel !== "administrador") {
    return (
      <div>
        <h1 className="mb-2 font-title text-2xl font-bold text-white">Novo veículo</h1>
        <p className="text-sm font-medium text-critico-400">
          Só administradores podem cadastrar veículos.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 font-title text-2xl font-bold text-white">Novo veículo</h1>
      <VeiculoForm empresaId={usuario.empresa_id} />
    </div>
  );
}
