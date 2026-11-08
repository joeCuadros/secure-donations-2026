import { Navigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { Loader } from "lucide-react";

const getReturnTo = (state: unknown): string => {
  if (!state || typeof state !== "object" || !("returnTo" in state)) return "/";

  const path = (state as { returnTo?: unknown }).returnTo;
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//")
    ? path
    : "/";
};

export const AuthCallback = () => {
  const auth = useAuth();

  if (auth.isLoading || auth.activeNavigator) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center" role="status" aria-live="polite">
          <Loader className="mx-auto mb-4 animate-spin text-blue-600" size={38} />
          <p className="font-medium text-slate-600">Validando tu acceso...</p>
        </div>
      </div>
    );
  }

  if (auth.isAuthenticated) {
    return <Navigate to={getReturnTo(auth.user?.state)} replace />;
  }

  return <Navigate to="/login" replace state={{ error: auth.error?.message }} />;
};
