import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle, FolderOpen, Loader } from "lucide-react";
import { projectsApi } from "../services/projects/api";
import type { ProjectSummary } from "../services/projects/types";
import { useToast } from "../utils/ToastContext";
import { Can } from "../components/Can";

const formatMoney = (amountCents: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(amountCents / 100);

export const Projects = () => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { toast } = useToast();

  const fetchProjects = useCallback(async () => {
    try {
      const response = await projectsApi.list({ limit: 20 });
      setProjects(response.items);
      setNextToken(response.nextToken);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "No fue posible cargar los proyectos.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // Carga inicial de datos: la actualización de estado ocurre tras esperar la respuesta de la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProjects();
  }, [fetchProjects]);

  const loadMore = async () => {
    if (!nextToken || loadingMore) return;

    setLoadingMore(true);
    try {
      const response = await projectsApi.list({ limit: 20, nextToken });
      setProjects((current) => [...current, ...response.items]);
      setNextToken(response.nextToken);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "No fue posible cargar más proyectos.",
        "error"
      );
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Catálogo
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Proyectos activos
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Conoce las iniciativas disponibles y su avance de recaudación.
          </p>
        </div>

        <Can I="api/projects.write">
          <Link
            to="/projects/create"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 sm:w-auto"
          >
            <PlusCircle size={19} aria-hidden="true" />
            Crear proyecto
          </Link>
        </Can>
      </div>

      {loading ? (
        <div className="flex justify-center py-16" role="status" aria-live="polite">
          <Loader className="animate-spin text-blue-600" size={38} />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <FolderOpen className="mx-auto mb-3 text-slate-400" size={36} aria-hidden="true" />
          <h2 className="font-semibold text-slate-800">Todavía no hay proyectos publicados</h2>
          <p className="mt-2 text-sm text-slate-500">
            Los proyectos aparecerán aquí cuando hayan sido publicados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const progress = project.goalAmountCents > 0
              ? Math.min(
                  (project.confirmedAmountCents / project.goalAmountCents) * 100,
                  100
                )
              : 0;

            return (
              <article
                key={project.projectId}
                className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h2 className="min-w-0 break-words text-lg font-semibold text-slate-900">
                    {project.title}
                  </h2>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Publicado
                  </span>
                </div>

                <p className="mb-6 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-600">
                  {project.purpose}
                </p>

                <div className="mt-auto space-y-3">
                  <div className="flex items-end justify-between gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Recaudado</p>
                      <p className="font-bold text-blue-700">
                        {formatMoney(project.confirmedAmountCents)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Meta</p>
                      <p className="font-semibold text-slate-700">
                        {formatMoney(project.goalAmountCents)}
                      </p>
                    </div>
                  </div>

                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-label={`Avance de recaudación de ${project.title}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress)}
                  >
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-right text-xs font-medium text-slate-500">
                    {Math.round(progress)} % de la meta
                  </p>

                  <Link
                    to={`/projects/${project.projectId}`}
                    className="block w-full rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-center text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    Ver detalles
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
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
            {loadingMore ? "Cargando..." : "Cargar más proyectos"}
          </button>
        </div>
      )}
    </section>
  );
};
