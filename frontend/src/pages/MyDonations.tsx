import { useCallback, useEffect, useState } from "react";
import { Loader, ReceiptText, Play } from "lucide-react";
import { donationsApi } from "../services/donations/api";
import type { Donation, DonationStatus } from "../services/donations/types";
import { SimulationBanner } from "../components/SimulationBanner";
import { useToast } from "../utils/ToastContext";

const formatMoney = (amountCents: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(amountCents / 100);

const statusLabels: Record<DonationStatus, string> = {
  PENDIENTE_SIMULACION: "Pendiente de simulación",
  CONFIRMADA_SIMULADA: "Confirmada (simulada)",
  RECHAZADA_SIMULADA: "Rechazada (simulada)",
};

const statusClasses: Record<DonationStatus, string> = {
  PENDIENTE_SIMULACION: "bg-amber-50 text-amber-700",
  CONFIRMADA_SIMULADA: "bg-emerald-50 text-emerald-700",
  RECHAZADA_SIMULADA: "bg-red-50 text-red-700",
};

const StatusBadge = ({ status }: { status: DonationStatus }) => (
  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[status]}`}>
    {statusLabels[status]}
  </span>
);

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : date.toLocaleString("es-PE");
};

export const MyDonations = () => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { toast } = useToast();
  const [simulatingId, setSimulatingId] = useState<string | null>(null);

  const fetchDonations = useCallback(async (token?: string) => {
    const isInitial = !token;
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const response = await donationsApi.listMyDonations({
        nextToken: token,
        limit: 10,
      });

      setDonations((current) =>
        isInitial ? response.items : [...current, ...response.items]
      );
      setNextToken(response.nextToken);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "No fue posible cargar tus donaciones.",
        "error"
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [toast]);

  useEffect(() => {
    // Carga inicial de datos: la actualización de estado ocurre tras esperar la respuesta de la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDonations();
  }, [fetchDonations]);

  const handleSimulate = async (donationId: string) => {
    setSimulatingId(donationId);
    try {
      const response = await donationsApi.simulate(donationId, { result: "CONFIRMADA_SIMULADA" });
      setDonations(current => current.map(d => 
        d.donationId === donationId ? { ...d, status: response.status } : d
      ));
      toast("Donación confirmada exitosamente en el entorno de simulación.", "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Error al simular la confirmación.",
        "error"
      );
    } finally {
      setSimulatingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
          Historial personal
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
          Mis donaciones
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Consulta los aportes que has registrado y su estado actual.
        </p>
      </div>

      <SimulationBanner>
        Utiliza el botón de simulación para confirmar tu intención de donación en el sistema.
      </SimulationBanner>

      {loading ? (
        <div className="flex justify-center py-16" role="status" aria-live="polite">
          <Loader className="animate-spin text-blue-600" size={38} />
        </div>
      ) : donations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <ReceiptText className="mx-auto mb-3 text-slate-400" size={36} aria-hidden="true" />
          <h2 className="font-semibold text-slate-800">Aún no tienes donaciones</h2>
          <p className="mt-2 text-sm text-slate-500">
            Cuando registres una donación, aparecerá en este historial.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {donations.map((donation) => (
              <article
                key={donation.donationId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Código de donación</p>
                    <p className="break-all font-mono text-sm font-semibold text-slate-700">
                      {donation.donationId}
                    </p>
                  </div>
                  <StatusBadge status={donation.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">Monto</p>
                    <p className="mt-1 font-bold text-slate-900">
                      {formatMoney(donation.amountCents)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Proyecto</p>
                    <p className="mt-1 break-all font-mono text-xs text-slate-600">
                      {donation.projectId}
                    </p>
                  </div>
                </div>
                
                {donation.status === 'PENDIENTE_SIMULACION' && (
                   <div className="mt-4 border-t border-slate-100 pt-3">
                     <button
                        onClick={() => handleSimulate(donation.donationId)}
                        disabled={simulatingId === donation.donationId}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                     >
                       {simulatingId === donation.donationId ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
                       Simular confirmación
                     </button>
                   </div>
                )}
                
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {formatDate(donation.createdAt)}
                </p>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">ID de donación</th>
                    <th className="px-5 py-4">ID de proyecto</th>
                    <th className="px-5 py-4">Monto</th>
                    <th className="px-5 py-4">Estado</th>
                    <th className="px-5 py-4">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {donations.map((donation) => (
                    <tr key={donation.donationId} className="transition hover:bg-slate-50">
                      <td className="px-5 py-4 font-mono text-xs text-slate-600">
                        {donation.donationId}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-500">
                        {donation.projectId}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        {formatMoney(donation.amountCents)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={donation.status} />
                      </td>
                      <td className="px-5 py-4">
                        {donation.status === 'PENDIENTE_SIMULACION' ? (
                          <button
                            onClick={() => handleSimulate(donation.donationId)}
                            disabled={simulatingId === donation.donationId}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                             {simulatingId === donation.donationId ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
                             Simular
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Completada</span>
                        )}
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
            onClick={() => void fetchDonations(nextToken)}
            disabled={loadingMore}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore && <Loader size={16} className="animate-spin" />}
            {loadingMore ? "Cargando..." : "Cargar más"}
          </button>
        </div>
      )}
    </section>
  );
};