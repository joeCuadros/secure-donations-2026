import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { LayoutDashboard, List, LogOut, Shield } from "lucide-react";
import { hasPermission } from "../utils/permissions";
import { logout } from "../auth/logout";

const navItems = [
  { name: "Proyectos", path: "/", icon: LayoutDashboard, scope: undefined },
  { name: "Mis donaciones", path: "/donations", icon: List, scope: "api/donations.read" },
  { name: "Auditoría", path: "/audit", icon: Shield, scope: "api/audit.read" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition sm:px-4 ${
    isActive
      ? "bg-blue-50 text-blue-700"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
  }`;

export const Layout = () => {
  const auth = useAuth();
  const isAuthenticated = auth.isAuthenticated;
  const email =
    typeof auth.user?.profile.email === "string"
      ? auth.user.profile.email
      : "Sesión activa";

  const visibleNavItems = navItems.filter(
    (item) => !item.scope || hasPermission(auth.user, item.scope)
  );

  const handleLogout = async () => {
    if (auth.activeNavigator) return;

    try {
      await logout();
    } catch {
      window.location.replace("/login");
    }
  };

  const renderNavItems = () =>
    visibleNavItems.map(({ name, path, icon: Icon }) => (
      <NavLink key={path} to={path} end={path === "/"} className={navLinkClass}>
        <Icon size={18} aria-hidden="true" />
        <span>{name}</span>
      </NavLink>
    ));

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {isAuthenticated && (
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
          <div className="border-b border-slate-100 px-6 py-7">
            <Link to="/" className="text-2xl font-extrabold tracking-tight text-blue-700">
              SecureDonations
            </Link>
            <p className="mt-1 text-xs font-medium text-slate-400">
              Plataforma de donaciones
            </p>
          </div>

          <nav aria-label="Navegación principal" className="flex-1 space-y-1 px-4 py-6">
            {renderNavItems()}
          </nav>

          <div className="border-t border-slate-100 p-4">
            <p className="mb-3 truncate px-3 text-xs text-slate-500" title={email}>
              {email}
            </p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={Boolean(auth.activeNavigator)}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut size={19} aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </aside>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 md:px-8">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
            <Link
              to="/"
              className="min-w-0 truncate text-lg font-extrabold tracking-tight text-blue-700 md:hidden"
            >
              SecureDonations
            </Link>

            {!isAuthenticated && (
              <Link
                to="/"
                className="hidden text-xl font-extrabold tracking-tight text-blue-700 md:inline"
              >
                SecureDonations
              </Link>
            )}

            {isAuthenticated ? (
              <div className="ml-auto flex min-w-0 items-center gap-3">
                <span
                  className="hidden max-w-xs truncate text-sm text-slate-500 sm:block"
                  title={email}
                >
                  {email}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={Boolean(auth.activeNavigator)}
                  aria-label="Cerrar sesión"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 md:hidden"
                >
                  <LogOut size={18} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="ml-auto flex items-center gap-3">
                <span className="hidden text-sm text-slate-500 sm:inline">
                  ¿Ya tienes una cuenta?
                </span>
                <Link
                  to="/login"
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Iniciar sesión
                </Link>
              </div>
            )}
          </div>
        </header>

        {isAuthenticated && (
          <nav
            aria-label="Navegación móvil"
            className="border-b border-slate-200 bg-white px-3 py-2 md:hidden"
          >
            <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto pb-1">
              {renderNavItems()}
            </div>
          </nav>
        )}

        <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 md:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-400">
          SecureDonations · Plataforma de donaciones seguras
        </footer>
      </div>
    </div>
  );
};