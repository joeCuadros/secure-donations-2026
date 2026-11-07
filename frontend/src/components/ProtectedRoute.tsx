import React, { useEffect } from "react";
import { useAuth, hasAuthParams } from "react-oidc-context";
import { Navigate, Outlet } from "react-router-dom";
import { hasPermission } from "../utils/permissions";
import { Loader, AlertTriangle } from "lucide-react";

export const ProtectedRoute: React.FC<{ requiredScope?: string }> = ({ requiredScope }) => {
  const auth = useAuth();

  useEffect(() => {
    if (
      !hasAuthParams() &&
      !auth.isAuthenticated &&
      !auth.activeNavigator &&
      !auth.isLoading &&
      !auth.error
    ) {
      auth.signinRedirect();
    }
  }, [auth.isAuthenticated, auth.activeNavigator, auth.isLoading, auth.error, auth.signinRedirect]);

  if (auth.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-6">
        <AlertTriangle className="text-red-600 mb-4" size={48} />
        <h2 className="text-2xl font-bold text-red-800 mb-2">Error de Autenticación</h2>
        <p className="text-red-600 text-center max-w-md">
          {auth.error.message}
        </p>
      </div>
    );
  }

  if (auth.isLoading || !auth.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader className="animate-spin text-blue-600 mx-auto mb-4" size={40} />
          <p className="text-slate-500 font-medium">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (requiredScope && !hasPermission(auth.user, requiredScope)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};