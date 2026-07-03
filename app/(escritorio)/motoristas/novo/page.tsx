import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import MotoristaForm from "@/components/escritorio/motorista-form";

export default async function NovoMotoristaPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  if (usuario.papel !== "gerente" && usuario.papel !== "administrador") {
    return (
      <div>
        <h1 className="mb-2 font-title text-2xl font-bold text-white">Novo motorista</h1>
        <p className="text-sm font-medium text-critico-400">
          Só gerente ou administrador podem cadastrar motoristas.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 font-title text-2xl font-bold text-white">Novo motorista</h1>
      <MotoristaForm />
    </div>
  );
}
