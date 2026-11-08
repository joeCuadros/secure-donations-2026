import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { ArrowRight, HeartHandshake, LockKeyhole, ShieldCheck } from "lucide-react";

interface LoginRouteState {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
  error?: unknown;
}

const getReturnTo = (state: unknown): string => {
  if (!state || typeof state !== "object") return "/";

  const routeState = state as LoginRouteState;
  const path = routeState.from?.pathname;
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";

  const search = typeof routeState.from?.search === "string" ? routeState.from.search : "";
  const hash = typeof routeState.from?.hash === "string" ? routeState.from.hash : "";
  return `${path}${search}${hash}`;
};

export const Login = () => {
  const auth = useAuth();
  const location = useLocation();
  const returnTo = getReturnTo(location.state);
  const routeState = location.state as LoginRouteState | null;
  const routeError = routeState?.error ? String(routeState.error) : "";
  const isRedirecting = auth.activeNavigator === "signinRedirect";
  const [loginError, setLoginError] = useState("");

  if (auth.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center text-slate-600" role="status" aria-live="polite">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="font-medium">Preparando el acceso...</p>
        </div>
      </div>
    );
  }

  if (auth.isAuthenticated) return <Navigate to={returnTo} replace />;

  const handleLogin = async () => {
    setLoginError("");

    try {
      await auth.signinRedirect({ state: { returnTo } });
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : "No fue posible iniciar sesión. Inténtalo nuevamente."
      );
    }
  };

  const errorMessage = auth.error?.message || routeError || loginError;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-3 py-8 sm:px-5 sm:py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl md:grid-cols-[1.05fr_0.95fr] md:rounded-[2rem]">
        <div className="flex flex-col justify-between bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 p-6 text-white sm:p-10 md:p-12">
          <div>
            <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 sm:mb-10">
              <HeartHandshake size={30} aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-100">
              SecureDonations
            </p>
            <h1 className="mt-4 max-w-md text-3xl font-bold leading-tight sm:text-4xl">
              Apoya proyectos que generan un cambio positivo.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-blue-100 sm:text-base">
              Accede a tu espacio para consultar proyectos, revisar tus donaciones y dar seguimiento a cada aporte.
            </p>
          </div>

          <div className="mt-10 flex items-center gap-3 text-sm text-blue-100 md:mt-12">
            <ShieldCheck size={19} aria-hidden="true" />
            <span>Acceso protegido mediante Amazon Cognito</span>
          </div>
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-10 md:p-12">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 sm:mb-8">
            <LockKeyhole size={24} aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Bienvenido</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Inicia sesión para continuar. La validación de tus credenciales se realizará de forma segura.
          </p>

          {errorMessage && (
            <div
              className="mt-6 break-words rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={isRedirecting}
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRedirecting ? "Conectando..." : "Iniciar sesión"}
            {!isRedirecting && <ArrowRight size={19} aria-hidden="true" />}
          </button>

          <p className="mt-6 text-center text-xs leading-5 text-slate-400">
            Serás redirigido al servicio de autenticación para validar tu cuenta.
          </p>
        </div>
      </section>
    </main>
  );
};
