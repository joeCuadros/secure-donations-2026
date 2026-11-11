import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, FileText, Loader, PlusCircle, Rocket } from "lucide-react";
import { ApiError } from "../services/apiClient";
import { projectsApi } from "../services/projects/api";
import type { ProjectSummary } from "../services/projects/types";
import { useToast } from "../utils/ToastContext";

const formatMoney = (amountCents: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(amountCents / 100);

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : date.toLocaleDateString("es-PE", { dateStyle: "medium" });
};

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

// El guard de la ruta es solo UX: el backend decide con scope y Verified Permissions (acción ListDraftProjects).
export const Drafts = () => {
  const [drafts, setDrafts] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadFirstPage = useCallback(async () => {
    try {
      const response = await projectsApi.listDrafts({ limit: 20 });
      setDrafts(response.items);
      setNextToken(response.nextToken);
      setLoadError("");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "No fue posible cargar los borradores."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carga inicial de datos: la actualización de estado ocurre tras esperar la respuesta de la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFirstPage();
  }, [loadFirstPage]);

  const retry = () => {
    setLoading(true);
    void loadFirstPage();
  };

  const loadMore = async () => {
    if (!nextToken || loadingMore) return;

    setLoadingMore(true);
    try {
      const response = await projectsApi.listDrafts({ limit: 20, nextToken });
      setDrafts((current) => [...current, ...response.items]);
      setNextToken(response.nextToken);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "No fue posible cargar más borradores.",
        "error"
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePublish = async (project: ProjectSummary) => {
    if (publishingId) return;

    setPublishingId(project.projectId);
    try {
      await projectsApi.publish(project.projectId);
      setDrafts((current) => current.filter((item) => item.projectId !== project.projectId));
      toast(`«${project.title}» se publicó y ya aparece en el catálogo.`, "success");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // Otra persona (o otra pestaña) ya lo publicó: se actualiza la lista en lugar de mostrar un error.
        toast(`«${project.title}» ya estaba publicado. Se actualizó la lista.`, "info");
        await loadFirstPage();
      } else {
        toast(
          error instanceof Error ? error.message : "No fue posible publicar el proyecto.",
          "error"
        );
      }
    } finally {
      setPublishingId(null);
    }
  };

  const renderBody = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center gap-3 py-16" role="status" aria-live="polite">
          <Loader className="animate-spin text-blue-600" size={38} aria-hidden="true" />
          <p className="text-sm font-medium text-slate-600">Cargando borradores...</p>
        </div>
      );
    }

    if (loadError) {
      return (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center"
        >
          <AlertTriangle className="mx-auto mb-3 text-red-600" size={34} aria-hidden="true" />
          <h2 className="font-semibold text-red-800">No se pudieron cargar los borradores</h2>
          <p className="mt-2 break-words text-sm text-red-700">{loadError}</p>
          <button
            type="button"
            onClick={retry}
            className={`mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 ${focusRing}`}
          >
            Reintentar
          </button>
        </div>
      );
    }

    if (drafts.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <FileText className="mx-auto mb-3 text-slate-400" size={36} aria-hidden="true" />
          <h2 className="font-semibold text-slate-800">No hay borradores pendientes</h2>
          <p className="mt-2 text-sm text-slate-500">
            Los proyectos creados aparecerán aquí hasta que sean publicados.
          </p>
        </div>
      );
    }

    return (
      <ul className="space-y-4" aria-label="Proyectos en borrador">
        {drafts.map((project) => {
          const isPublishing = publishingId === project.projectId;

          return (
            <li
              key={project.projectId}
              className="flex min-w-0 flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start gap-3">
                  <h2 className="min-w-0 break-words text-lg font-semibold text-slate-900">
                    {project.title}
                  </h2>
                  <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    Borrador
                  </span>
                </div>
                <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                  {project.purpose}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:max-w-md">
                  <div>
                    <dt className="text-xs text-slate-500">Meta</dt>
                    <dd className="mt-0.5 font-semibold text-slate-700">
                      {formatMoney(project.goalAmountCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Creado</dt>
                    <dd className="mt-0.5 font-semibold text-slate-700">
                      <time dateTime={project.createdAt}>{formatDate(project.createdAt)}</time>
                    </dd>
                  </div>
                </dl>
              </div>

              <button
                type="button"
                onClick={() => void handlePublish(project)}
                disabled={publishingId !== null}
                aria-label={`Publicar proyecto ${project.title}`}
                aria-busy={isPublishing}
                className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto ${focusRing}`}
              >
                {isPublishing ? (
                  <Loader size={18} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Rocket size={18} aria-hidden="true" />
                )}
                {isPublishing ? "Publicando..." : "Publicar"}
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Gestión de proyectos
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Borradores</h1>
          <p className="mt-2 text-sm text-slate-500">
            Proyectos creados que todavía no son visibles en el catálogo. Publícalos para habilitar
            las donaciones simuladas.
          </p>
        </div>

        <Link
          to="/projects/create"
          className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto ${focusRing}`}
        >
          <PlusCircle size={19} aria-hidden="true" />
          Crear proyecto
        </Link>
      </div>

      {renderBody()}

      {nextToken && !loading && !loadError && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
          >
            {loadingMore && <Loader size={16} className="animate-spin" aria-hidden="true" />}
            {loadingMore ? "Cargando..." : "Cargar más borradores"}
          </button>
        </div>
      )}
    </section>
  );
};
