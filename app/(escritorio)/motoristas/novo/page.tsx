import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import MotoristaForm from "@/components/escritorio/motorista-form";

export default async function NovoMotoristaPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  if (usuario.papel !== "gerente" && usuario.papel !== "administrador") {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-semibold">Novo motorista</h1>
        <p className="text-sm text-red-400">
          Só gerente ou administrador podem cadastrar motoristas.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Novo motorista</h1>
      <MotoristaForm />
    </div>
  );
}
