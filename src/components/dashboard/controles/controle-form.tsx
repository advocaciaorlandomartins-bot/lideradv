"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerIcon } from "@/components/icons";
import {
  createControleAction,
  updateControleAction,
  type ControleFormState,
} from "@/lib/controles-actions";
import {
  TIPOS_DEMANDA,
  STATUS_CONTROLE,
  getTipoConfig,
  type Controle,
  type ClienteOption,
  type ProcessoOption,
  type UsuarioOption,
  type LocalAudiencia,
} from "@/lib/controles-types";

function addDays(dateStr: string, days: number): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const inputCls =
  "w-full h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";
const labelCls = "block font-body text-sm font-semibold text-fg mb-1.5";
const selectCls =
  "w-full h-10 cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";

interface Props {
  controle?: Controle;
  tipoInicial: string;
  clientes: ClienteOption[];
  processos: ProcessoOption[];
  usuarios: UsuarioOption[];
  locais: LocalAudiencia[];
  locaisPericia: LocalAudiencia[];
}

export default function ControleForm({
  controle,
  tipoInicial,
  clientes,
  processos,
  usuarios,
  locais,
  locaisPericia,
}: Props) {
  const isEdit = !!controle;
  const router = useRouter();

  const action = isEdit ? updateControleAction : createControleAction;
  const [state, formAction, pending] = useActionState<
    ControleFormState,
    FormData
  >(action, null);

  const [tipo] = useState(controle?.tipo ?? tipoInicial);

  // ── Autocomplete de cliente ──
  const [clienteNome, setClienteNome] = useState(controle?.cliente_nome ?? "");
  const [clienteId, setClienteId] = useState(controle?.cliente_id ?? "");
  const [showDrop, setShowDrop] = useState(false);

  const clienteMatches =
    !clienteId && clienteNome.trim().length >= 1
      ? clientes.filter((c) => {
          const q = clienteNome.trim().toLowerCase();
          const matchNome = c.nome.toLowerCase().includes(q);
          const matchDoc =
            q.replace(/\D/g, "").length > 0 &&
            c.doc.replace(/\D/g, "").includes(q.replace(/\D/g, ""));
          return matchNome || matchDoc;
        })
      : [];

  // ── Dados salvos (audiência ou perícia) ──
  const savedDados = controle?.dados ?? null;
  const savedLocalId = savedDados?.local_id ?? null;
  const savedLocalTitulo = savedDados?.local_titulo ?? null;
  const initSelectedLocalId = savedLocalId
    ? savedLocalId
    : savedLocalTitulo && !savedLocalId
      ? "outro"
      : "";
  const [selectedLocalId, setSelectedLocalId] = useState(initSelectedLocalId);
  const [localMode, setLocalMode] = useState<"existente" | "novo">("existente");

  // ── Data do evento e prazo interno ──
  const [dataEvento, setDataEvento] = useState(controle?.data_evento ?? "");
  const [prazoInterno, setPrazoInterno] = useState(
    controle?.prazo_interno ?? ""
  );
  const todayISO = new Date().toISOString().split("T")[0];
  const dataPassada = dataEvento && dataEvento < todayISO;

  const tipoConfig = getTipoConfig(tipo);
  const isAudiencia = tipo === "audiencias";
  const isPericia = tipo === "pericias";
  const isImplantadosData = tipo === "implantados-data";
  const isDCB = tipo === "dcb";
  const hasHora = isAudiencia || isPericia;

  const processosDoCliente = clienteId
    ? processos.filter((p) => p.cliente_id === clienteId)
    : processos;

  if (state?.success) {
    router.push(`/dashboard/controles?tipo=${tipo}`);
  }

  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {isEdit && <input type="hidden" name="id" value={controle.id} />}
      <input type="hidden" name="tipo" value={tipo} />

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* ── Vínculos ── */}
      <div className="rounded-xl border border-border bg-white p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-fg">Vínculos</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Autocomplete de cliente */}
          <div className="sm:col-span-2">
            <label className={labelCls}>Cliente</label>
            <div className="relative">
              <input
                type="text"
                value={clienteNome}
                onChange={(e) => {
                  setClienteNome(e.target.value);
                  if (clienteId) setClienteId("");
                  setShowDrop(true);
                }}
                onFocus={() => setShowDrop(true)}
                onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                placeholder="Pesquisar por nome ou CPF / CNPJ..."
                autoComplete="off"
                className={inputCls + (clienteId ? " pr-8" : "")}
              />
              <input type="hidden" name="cliente_id" value={clienteId} />

              {clienteId && (
                <button
                  type="button"
                  onClick={() => {
                    setClienteId("");
                    setClienteNome("");
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none"
                  aria-label="Limpar cliente"
                >
                  ×
                </button>
              )}

              {showDrop && clienteMatches.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                  {clienteMatches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => {
                        setClienteId(c.id);
                        setClienteNome(c.nome);
                        setShowDrop(false);
                      }}
                      className="w-full text-left px-3 py-2 font-body text-sm text-fg hover:bg-slate-50 border-b border-border/50 last:border-0"
                    >
                      <span className="font-medium">{c.nome}</span>
                      {c.doc && (
                        <span className="ml-2 text-muted text-xs">{c.doc}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {showDrop &&
                !clienteId &&
                clienteNome.trim().length >= 1 &&
                clienteMatches.length === 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-muted shadow-lg">
                    Nenhum cliente encontrado.
                  </div>
                )}
            </div>
          </div>

          {/* Processo */}
          <div>
            <label className={labelCls}>Processo</label>
            <select
              name="processo_id"
              defaultValue={controle?.processo_id ?? ""}
              className={selectCls}
            >
              <option value="">— Nenhum —</option>
              {processosDoCliente.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numero}
                </option>
              ))}
            </select>
            {clienteId && processosDoCliente.length === 0 && (
              <p className="mt-1 font-body text-xs text-muted">
                Nenhum processo ativo para este cliente.
              </p>
            )}
          </div>

          {/* Responsável */}
          <div>
            <label className={labelCls}>Responsável</label>
            <select
              name="responsavel_id"
              defaultValue={controle?.responsavel_id ?? ""}
              className={selectCls}
            >
              <option value="">— Nenhum —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.login})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Identificação ── */}
      <div className="rounded-xl border border-border bg-white p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-fg">
          Identificação
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Tipo de Perícia — primeiro campo para perícias */}
          {isPericia && (
            <div className="sm:col-span-2">
              <label className={labelCls}>Tipo de Perícia</label>
              <select
                name="tipo_pericia"
                defaultValue={savedDados?.tipo_pericia ?? ""}
                className={selectCls}
              >
                <option value="">— Selecione —</option>
                <option value="Perícia Médica">Perícia Médica</option>
                <option value="Avaliação Social">Avaliação Social</option>
              </select>
            </div>
          )}

          {/* Data */}
          <div className={hasHora || isImplantadosData ? "" : "sm:col-span-2"}>
            <label className={labelCls}>{tipoConfig.col_data}</label>
            <input
              type="date"
              name="data_evento"
              value={dataEvento}
              onChange={(e) => setDataEvento(e.target.value)}
              className={`${inputCls} ${dataPassada ? "border-amber-400" : ""}`}
            />
            {dataPassada && (
              <p className="mt-1 font-body text-xs text-amber-600">
                Data no passado — este controle será registrado como vencido.
              </p>
            )}
          </div>

          {/* Hora — audiências e perícias */}
          {hasHora && (
            <div>
              <label className={labelCls}>Hora</label>
              <input
                type="time"
                name="hora"
                defaultValue={savedDados?.hora ?? ""}
                className={inputCls}
              />
            </div>
          )}

          {/* Prazo Interno — todos os tipos */}
          <div className={hasHora || isImplantadosData ? "" : "sm:col-span-2"}>
            <label className={labelCls}>Prazo Interno</label>
            <div className="flex gap-2">
              <input
                type="date"
                name="prazo_interno"
                value={prazoInterno}
                onChange={(e) => setPrazoInterno(e.target.value)}
                className="flex-1 h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() =>
                  setPrazoInterno(
                    isDCB ? addDays(dataEvento, -15) : addDays(dataEvento, 2)
                  )
                }
                disabled={!dataEvento}
                title={
                  isDCB
                    ? "Preencher com Prazo Prorrogação − 15 dias"
                    : "Preencher com data do evento + 2 dias"
                }
                className="shrink-0 h-10 rounded-lg border border-border px-3 font-body text-xs font-semibold text-fg hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isDCB ? "−15 dias" : "+2 dias"}
              </button>
            </div>
          </div>

          {/* ── Campos exclusivos: Benefícios Implantados ── */}
          {isImplantadosData && (
            <>
              <input
                type="hidden"
                name="implantados_id"
                value={savedDados?.implantados_id ?? ""}
              />
              <input
                type="hidden"
                name="dcb_id"
                value={savedDados?.dcb_id ?? ""}
              />

              <div>
                <label className={labelCls}>Previsão do 1° pagamento</label>
                <input
                  type="date"
                  name="data_1pag"
                  defaultValue={savedDados?.data_1pag ?? ""}
                  className={inputCls}
                />
                {!savedDados?.implantados_id && (
                  <p className="mt-1 font-body text-xs text-blue-600">
                    Ao preencher, cria automaticamente um registro em Benefícios
                    Implantados (1° Pag.).
                  </p>
                )}
                {savedDados?.implantados_id && (
                  <p className="mt-1 font-body text-xs text-emerald-600">
                    Registro de 1° Pag. já vinculado.
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>Data de Cessação</label>
                <input
                  type="date"
                  name="data_cessacao"
                  defaultValue={savedDados?.data_cessacao ?? ""}
                  className={inputCls}
                />
                {!savedDados?.dcb_id && (
                  <p className="mt-1 font-body text-xs text-blue-600">
                    Ao preencher, cria automaticamente um registro de
                    Prorrogação (DCB) com data 15 dias antes.
                  </p>
                )}
                {savedDados?.dcb_id && (
                  <p className="mt-1 font-body text-xs text-emerald-600">
                    Registro de DCB já vinculado.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Descrição / Tipo-Título — oculto para perícias, implantados-data e dcb */}
          {!isPericia && !isImplantadosData && !isDCB && (
            <div className="sm:col-span-2">
              <label className={labelCls}>
                {isAudiencia
                  ? "Tipo / Título da audiência"
                  : tipoConfig.col_evento}
                {!isAudiencia && <span className="text-red-500"> *</span>}
              </label>
              <textarea
                name="descricao"
                rows={isAudiencia ? 2 : 3}
                defaultValue={controle?.descricao ?? ""}
                placeholder={
                  isAudiencia
                    ? "Ex.: Instrução e julgamento"
                    : `Descreva ${tipoConfig.col_evento.toLowerCase()}...`
                }
                className="w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>
          )}

          {/* ── Campos exclusivos: Audiências ── */}
          {isAudiencia && (
            <>
              <div className="sm:col-span-2">
                <label className={labelCls}>
                  Link para participação virtual
                </label>
                <input
                  type="url"
                  name="link_virtual"
                  defaultValue={savedDados?.link_virtual ?? ""}
                  placeholder="https://"
                  className={inputCls}
                />
                <p className="mt-1 font-body text-xs text-muted">
                  Preencha apenas quando houver participação remota.
                </p>
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-body text-sm font-semibold text-fg">
                    Local
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setLocalMode(
                        localMode === "existente" ? "novo" : "existente"
                      )
                    }
                    className="font-body text-xs text-primary hover:underline"
                  >
                    {localMode === "existente"
                      ? "+ Cadastrar novo local"
                      : "← Selecionar da lista"}
                  </button>
                </div>

                <input type="hidden" name="local_mode" value={localMode} />

                {localMode === "existente" ? (
                  <div className="space-y-2">
                    <select
                      name="local_id"
                      value={selectedLocalId}
                      onChange={(e) => setSelectedLocalId(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">— Selecione um local —</option>
                      {locais.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.titulo}
                        </option>
                      ))}
                      <option value="outro">
                        Outro (digitar manualmente)...
                      </option>
                    </select>
                    {selectedLocalId === "outro" && (
                      <input
                        type="text"
                        name="local_outro_texto"
                        defaultValue={
                          savedLocalId ? "" : (savedLocalTitulo ?? "")
                        }
                        placeholder="Digite o nome do local..."
                        className={inputCls}
                        autoFocus
                      />
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      name="novo_local_titulo"
                      placeholder="Título do local"
                      className={inputCls}
                    />
                    <input
                      type="text"
                      name="novo_local_endereco"
                      placeholder="Endereço completo"
                      className={inputCls}
                    />
                    <input
                      type="url"
                      name="novo_local_mapa"
                      placeholder="Link do mapa (Google Maps...)"
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Campos exclusivos: Perícias ── */}
          {isPericia && (
            <>
              <div className="sm:col-span-2">
                <label className={labelCls}>Local</label>
                <div className="space-y-2">
                  <select
                    name="local_id"
                    value={selectedLocalId}
                    onChange={(e) => setSelectedLocalId(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">— Selecione um local —</option>
                    {locaisPericia.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.titulo}
                      </option>
                    ))}
                    <option value="outro">
                      Outro (digitar manualmente)...
                    </option>
                  </select>
                  {selectedLocalId === "outro" && (
                    <input
                      type="text"
                      name="local_outro_texto"
                      defaultValue={
                        savedLocalId ? "" : (savedLocalTitulo ?? "")
                      }
                      placeholder="Digite o nome do local..."
                      className={inputCls}
                      autoFocus
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Prioridade */}
          <div>
            <label className={labelCls}>Prioridade</label>
            <select
              name="prioridade"
              defaultValue={controle?.prioridade ?? "media"}
              className={selectCls}
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>

          {/* Tipo Demanda */}
          <div>
            <label className={labelCls}>Tipo de Demanda</label>
            <select
              name="tipo_demanda"
              defaultValue={controle?.tipo_demanda ?? ""}
              className={selectCls}
            >
              <option value="">— Selecione —</option>
              {TIPOS_DEMANDA.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div>
              <label className={labelCls}>Status</label>
              <select
                name="status"
                defaultValue={controle?.status ?? "pendente"}
                className={selectCls}
              >
                {Object.entries(STATUS_CONTROLE).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Observações ── */}
      <div className="rounded-xl border border-border bg-white p-5">
        <label className={labelCls}>Observações</label>
        <textarea
          name="observacoes"
          rows={4}
          defaultValue={controle?.observacoes ?? ""}
          placeholder="Informações adicionais..."
          className="w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 resize-none"
        />
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-6 font-body text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
        >
          {pending && <SpinnerIcon className="h-4 w-4" />}
          {isEdit ? "Salvar alterações" : "Criar controle"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/controles?tipo=${tipo}`)}
          className="h-10 rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors hover:border-primary hover:text-primary cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
