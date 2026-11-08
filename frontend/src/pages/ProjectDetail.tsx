import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader, TrendingUp, Wallet } from "lucide-react";
import { Can } from "../components/Can";
import { donationsApi } from "../services/donations/api";
import { projectsApi } from "../services/projects/api";
import type { Project, ProjectStatsResponse } from "../services/projects/types";
import { useToast } from "../utils/ToastContext";

const formatMoney = (amountCents: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(amountCents / 100);

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [donationAmount, setDonationAmount] = useState("");
  const [donating, setDonating] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) {
      navigate("/");
      return;
    }

    setLoading(true);
    try {
      const [projectResponse, statsResponse] = await Promise.all([
        projectsApi.get(id),
        projectsApi.getStats(id),
      ]);
      setProject(projectResponse);
      setStats(statsResponse);
    } catch (error) {
      toast(getErrorMessage(error, "No fue posible cargar el proyecto."), "error");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleDonate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(donationAmount);

    if (!id || !Number.isFinite(amount) || amount <= 0) {
      toast("Ingresa un monto de donación válido.", "error");
      return;
    }

    setDonating(true);
    try {
      await donationsApi.create(
        {
          projectId: id,
          amountCents: Math.round(amount * 100),
        },
        crypto.randomUUID()
      );
      toast("Intención de donación registrada. Está pendiente de simulación.", "success");
      setDonationAmount("");
    } catch (error) {
      toast(getErrorMessage(error, "No fue posible registrar la donación."), "error");
    } finally {
      setDonating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16" role="status" aria-live="polite">
        <Loader className="animate-spin text-blue-600" size={38} />
      </div>
    );
  }

  if (!project || !stats) return null;

  const progress = Math.min(Math.max(stats.progress, 0), 100);

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft size={19} aria-hidden="true" />
        Volver a proyectos
      </Link>

      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:p-8 md:p-10">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Proyecto publicado
            </span>
            <span className="text-xs text-slate-400">Código: {project.projectId}</span>
          </div>
          <h1 className="break-words text-2xl font-bold text-slate-900 sm:text-3xl">
            {project.title}
          </h1>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base">
            {project.description}
          </p>
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Propósito
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">{project.purpose}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-0 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="bg-slate-50 p-5 sm:p-8">
            <div className="mb-6 flex items-center gap-2">
              <TrendingUp className="text-blue-600" size={21} aria-hidden="true" />
              <h2 className="text-lg font-semibold text-slate-800">
                Progreso de recaudación
              </h2>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">Monto confirmado</p>
                  <p className="text-2xl font-bold text-blue-700 sm:text-3xl">
                    {formatMoney(stats.confirmedAmountCents)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Meta</p>
                  <p className="font-semibold text-slate-700">
                    {formatMoney(stats.goalAmountCents)}
                  </p>
                </div>
              </div>

              <div
                className="h-3 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-label="Avance de recaudación"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
              >
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-right text-sm font-semibold text-slate-600">
                {Math.round(progress)} % de la meta
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center p-5 sm:p-8">
            <Can I="api/donations.write">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5">
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                    Colabora
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Realizar una donación
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Registra el monto que deseas aportar en soles.
                  </p>
                </div>

                <form onSubmit={handleDonate} className="space-y-4">
                  <div>
                    <label
                      htmlFor="donationAmount"
                      className="mb-1.5 block text-sm font-semibold text-slate-700"
                    >
                      Monto (PEN)
                    </label>
                    <div className="relative">
                      <Wallet
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                        size={19}
                        aria-hidden="true"
                      />
                      <input
                        id="donationAmount"
                        name="donationAmount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        required
                        value={donationAmount}
                        onChange={(event) => setDonationAmount(event.target.value)}
                        placeholder="50.00"
                        className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={donating}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {donating && <Loader size={18} className="animate-spin" />}
                    {donating ? "Registrando..." : "Registrar donación"}
                  </button>
                </form>
                <p className="mt-4 text-xs leading-5 text-slate-400">
                  La donación se registra como pendiente de simulación. El monto confirmado del proyecto se actualiza cuando se confirma la simulación.
                </p>
              </div>
            </Can>

            <Can I="api/donations.read">
              <div className="mt-4 text-center">
                <Link
                  to="/donations"
                  className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                >
                  Consultar mis donaciones
                </Link>
              </div>
            </Can>
          </div>
        </div>
      </article>
    </section>
  );
};
