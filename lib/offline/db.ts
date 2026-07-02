import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// Só roda no browser (usa IndexedDB) — nunca importar isto de um Server
// Component. Guardado localmente até conseguir sincronizar com o servidor.
export interface ItemFila {
  registroUuid: string; // chave primária — mesmo uuid usado como idempotência no servidor
  qrToken: string;
  payload: Record<string, string>; // campos já como string, prontos pra virar FormData
  fotoBlob: Blob | null;
  fotoNome: string | null;
  criadoEm: number;
  status: "pendente" | "erro";
  erro: string | null;
  tentativas: number;
}

interface LuckTankOfflineDB extends DBSchema {
  fila_abastecimentos: {
    key: string;
    value: ItemFila;
  };
}

const NOME_DB = "lucktank-offline";
const VERSAO_DB = 1;
const NOME_STORE = "fila_abastecimentos";

let dbPromise: Promise<IDBPDatabase<LuckTankOfflineDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<LuckTankOfflineDB>(NOME_DB, VERSAO_DB, {
      upgrade(db) {
        db.createObjectStore(NOME_STORE, { keyPath: "registroUuid" });
      },
    });
  }
  return dbPromise;
}

export async function adicionarNaFila(item: ItemFila): Promise<void> {
  const db = await getDB();
  await db.put(NOME_STORE, item);
}

export async function listarFila(): Promise<ItemFila[]> {
  const db = await getDB();
  return db.getAll(NOME_STORE);
}

export async function removerDaFila(registroUuid: string): Promise<void> {
  const db = await getDB();
  await db.delete(NOME_STORE, registroUuid);
}

export async function atualizarItemFila(
  registroUuid: string,
  patch: Partial<ItemFila>
): Promise<void> {
  const db = await getDB();
  const atual = await db.get(NOME_STORE, registroUuid);
  if (!atual) return;
  await db.put(NOME_STORE, { ...atual, ...patch });
}
