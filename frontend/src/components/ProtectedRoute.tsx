import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { AlertTriangle, ArrowLeft, Loader } from "lucide-react";
import { hasPermission } from "../utils/permissions";

interface ProtectedRouteProps {
  requiredScope?: string;
}

const LoadingScreen = () => (
  <div className="flex min-h-[60vh] items-center justify-center px-4">
    <div className="text-center" role="status" aria-live="polite">
      <Loader className="mx-auto mb-4 animate-spin text-blue-600" size={38} />
      <p className="font-medium text-slate-600">Comprobando tu sesión...</p>
    </div>
  </div>
);

const AccessDenied = () => (
  <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <AlertTriangle size={28} aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Acceso no permitido</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Tu cuenta no tiene el rol y los permisos necesarios para consultar esta sección.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Volver a proyectos
      </Link>
    </div>
  </div>
);

export const ProtectedRoute = ({ requiredScope }: ProtectedRouteProps) => {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading || auth.activeNavigator) return <LoadingScreen />;

  if (!auth.isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, error: auth.error?.message }}
      />
    );
  }

  if (requiredScope && !hasPermission(auth.user, requiredScope)) {
    return <AccessDenied />;
  }

  return <Outlet />;
};
