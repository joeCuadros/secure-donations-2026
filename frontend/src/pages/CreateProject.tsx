import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, FileText, Loader, Rocket } from "lucide-react";
import { projectsApi } from "../services/projects/api";
import type { Project } from "../services/projects/types";
import { useToast } from "../utils/ToastContext";

interface ProjectFormData {
  title: string;
  description: string;
  purpose: string;
  targetAmount: string;
}

const initialFormData: ProjectFormData = {
  title: "",
  description: "",
  purpose: "",
  targetAmount: "",
};

const formatMoney = (amountCents: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(amountCents / 100);

export const CreateProject = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState<ProjectFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [createdProject, setCreatedProject] = useState<Project | null>(null);

  const updateField = (field: keyof ProjectFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const targetAmount = Number(formData.targetAmount);
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      toast("Ingresa una meta de recaudación válida.", "error");
      return;
    }

    setLoading(true);
    try {
      const project = await projectsApi.create({
        title: formData.title.trim(),
        description: formData.description.trim(),
        purpose: formData.purpose.trim(),
        goalAmountCents: Math.round(targetAmount * 100),
      });

      setCreatedProject(project);
      toast("Proyecto creado como borrador.", "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "No fue posible crear el proyecto.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!createdProject) return;

    setPublishing(true);
    try {
      await projectsApi.publish(createdProject.projectId);
      toast("Proyecto publicado exitosamente.", "success");
      navigate(`/projects/${createdProject.projectId}`);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "No fue posible publicar el proyecto.",
        "error"
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleAmountChange = (rawValue: string) => {
    const normalized = rawValue.replace(",", ".");

    // Permite vaciar el campo para poder borrar con Backspace
    if (normalized === "") {
      updateField("targetAmount", "");
      return;
    }

    // Solo permite numeros >= 1 con máximo 2 decimales
    if (!/^[1-9]\d*(\.\d{0,2})?$/.test(normalized)) return;

    updateField("targetAmount", normalized);
  };

  const handleAmountBlur = () => {
    if (!formData.targetAmount) return;

    const numericValue = Number(formData.targetAmount);
    if (Number.isNaN(numericValue) || numericValue < 1) {
      updateField("targetAmount", "1.00");
      return;
    }

    updateField("targetAmount", numericValue.toFixed(2));
  };

  if (createdProject) {
    return (
      <section className="mx-auto w-full max-w-2xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle size={32} aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Proyecto creado
          </p>
          <h1 className="mt-2 break-words text-2xl font-bold text-slate-900">
            {createdProject.title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            El proyecto quedó guardado como borrador con una meta de{" "}
            <strong className="text-slate-700">
              {formatMoney(createdProject.goalAmountCents)}
            </strong>
            .
          </p>
          <div
            role="note"
            className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm leading-6 text-amber-800"
          >
            Mientras no se publique, el proyecto no aparece en el catálogo y no recibe donaciones. Si
            no lo publicas ahora, el borrador permanece disponible en la sección «Borradores», desde
            donde podrás publicarlo más tarde.
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? (
                <Loader size={18} className="animate-spin" />
              ) : (
                <Rocket size={18} aria-hidden="true" />
              )}
              {publishing ? "Publicando..." : "Publicar proyecto"}
            </button>
            <Link
              to="/projects/drafts"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <FileText size={18} aria-hidden="true" />
              Ver borradores
            </Link>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Volver al catálogo
            </button>
          </div>
        </div>
      </section>
    );
  }

  const inputClassName =
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft size={19} aria-hidden="true" />
        Volver a proyectos
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Nueva iniciativa
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Crear proyecto</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Completa la información y establece la meta de recaudación en soles.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="title" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Título del proyecto
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              minLength={3}
              maxLength={150}
              value={formData.title}
              onChange={(event) => updateField("title", event.target.value)}
              className={inputClassName}
              placeholder="Ej. Apoyo escolar comunitario"
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Descripción
            </label>
            <textarea
              id="description"
              name="description"
              required
              minLength={10}
              rows={4}
              value={formData.description}
              onChange={(event) => updateField("description", event.target.value)}
              className={`${inputClassName} resize-y`}
              placeholder="Describe en qué consiste el proyecto..."
            />
          </div>

          <div>
            <label htmlFor="purpose" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Propósito
            </label>
            <textarea
              id="purpose"
              name="purpose"
              required
              minLength={5}
              rows={3}
              value={formData.purpose}
              onChange={(event) => updateField("purpose", event.target.value)}
              className={`${inputClassName} resize-y`}
              placeholder="Indica qué busca conseguir la iniciativa..."
            />
          </div>

          <div>
            <label
              htmlFor="targetAmount"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Meta de recaudación (PEN)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-semibold text-slate-400">
                S/
              </span>
              <input
                id="targetAmount"
                name="targetAmount"
                type="text"
                inputMode="decimal"
                required
                pattern="^[1-9]\d*(\.\d{1,2})?$"
                title="Ingresa un monto válido mayor o igual a 1.00 (máximo 2 decimales)"
                autoComplete="off"
                value={formData.targetAmount}
                onChange={(event) => handleAmountChange(event.target.value)}
                onBlur={handleAmountBlur}
                className={`${inputClassName} pl-11`}
                placeholder="1000.00"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader size={18} className="animate-spin" />}
            {loading ? "Creando proyecto..." : "Crear proyecto"}
          </button>
        </form>
      </div>
    </section>
  );
};
