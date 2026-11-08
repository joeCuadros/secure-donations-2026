import { useEffect, useState } from "react";
import { Activity, Loader, ShieldCheck } from "lucide-react";
import { auditApi } from "../services/audit/api";
import type { AuditEvent } from "../services/audit/types";
import { useToast } from "../utils/ToastContext";

type AuditEventType = "DONATION_EVENT" | "PROJECT_EVENT";

const eventLabels: Record<AuditEventType, string> = {
  DONATION_EVENT: "Eventos de donaciones",
  PROJECT_EVENT: "Eventos de proyectos",
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : date.toLocaleString("es-PE");
};

const OutcomeBadge = ({ outcome }: { outcome: AuditEvent["outcome"] }) => (
  <span
    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
      outcome === "SUCCESS"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-red-50 text-red-700"
    }`}
  >
    {outcome === "SUCCESS" ? "Correcto" : "Fallido"}
  </span>
);

export const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [eventType, setEventType] = useState<AuditEventType>("DONATION_EVENT");
  const [loading, setLoading] = useState(true);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;

    const fetchLogs = async () => {
      setLoading(true);
      setLogs([]);
      setNextToken(null);

      try {
        const response = await auditApi.list({ eventType, limit: 15 });
        if (active) {
          setLogs(response.items);
          setNextToken(response.nextToken);
        }
      } catch (error) {
        if (active) {
          toast(
            error instanceof Error ? error.message : "No fue posible cargar la auditoría.",
            "error"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchLogs();
    return () => {
      active = false;
    };
  }, [eventType, toast]);

  const loadMore = async () => {
    if (!nextToken || loadingMore) return;

    setLoadingMore(true);
    try {
      const response = await auditApi.list({
        eventType,
        nextToken,
        limit: 15,
      });
      setLogs((current) => [...current, ...response.items]);
      setNextToken(response.nextToken);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "No fue posible cargar más eventos.",
        "error"
      );
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white">
            <Activity size={22} aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Trazabilidad
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Registro de auditoría
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Consulta las acciones registradas por los servicios de la plataforma.
          </p>
        </div>

        <div className="w-full sm:max-w-xs">
          <label htmlFor="eventType" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Tipo de evento
          </label>
          <select
            id="eventType"
            value={eventType}
            onChange={(event) => setEventType(event.target.value as AuditEventType)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {Object.entries(eventLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16" role="status" aria-live="polite">
          <Loader className="animate-spin text-blue-600" size={38} />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <ShieldCheck className="mx-auto mb-3 text-slate-400" size={36} aria-hidden="true" />
          <h2 className="font-semibold text-slate-800">No hay eventos registrados</h2>
          <p className="mt-2 text-sm text-slate-500">
            No se encontraron eventos para este tipo de registro.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {logs.map((log) => (
              <article
                key={log.timestampEventId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="break-all font-semibold text-blue-700">{log.action}</p>
                  <OutcomeBadge outcome={log.outcome} />
                </div>
                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-400">Actor</dt>
                    <dd className="mt-1 break-all font-mono text-slate-600">{log.actorRef}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Recurso</dt>
                    <dd className="mt-1 break-all font-mono text-slate-600">{log.resourceRef}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Solicitud</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-slate-500">{log.requestId}</dd>
                  </div>
                </dl>
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {formatDate(log.timestamp)}
                </p>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-200">
                  <tr>
                    <th className="px-5 py-4">Acción</th>
                    <th className="px-5 py-4">Actor</th>
                    <th className="px-5 py-4">Recurso</th>
                    <th className="px-5 py-4">Resultado</th>
                    <th className="px-5 py-4">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.timestampEventId} className="transition hover:bg-slate-50">
                      <td className="px-5 py-4 text-sm font-semibold text-blue-700">
                        {log.action}
                      </td>
                      <td className="max-w-[180px] truncate px-5 py-4 font-mono text-xs text-slate-500" title={log.actorRef}>
                        {log.actorRef}
                      </td>
                      <td className="max-w-[220px] truncate px-5 py-4 font-mono text-xs text-slate-500" title={log.resourceRef}>
                        {log.resourceRef}
                      </td>
                      <td className="px-5 py-4">
                        <OutcomeBadge outcome={log.outcome} />
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {formatDate(log.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {nextToken && !loading && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore && <Loader size={16} className="animate-spin" />}
            {loadingMore ? "Cargando..." : "Cargar más eventos"}
          </button>
        </div>
      )}
    </section>
  );
};
