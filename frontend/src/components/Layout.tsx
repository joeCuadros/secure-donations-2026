import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { LayoutDashboard, List, Shield, LogOut } from 'lucide-react';
import { Can } from './Can';

export const Layout: React.FC = () => {
  const auth = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Mis Donaciones', path: '/donations', icon: List, scope: 'api/donations.read' },
    { name: 'Auditoría', path: '/audit', icon: Shield, scope: 'api/audit.read' },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600 tracking-tight">SecureDonations</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const linkContent = (
              <Link key={item.name} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}>
                <item.icon size={20} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                {item.name}
              </Link>
            );

            return item.scope ? <Can key={item.name} I={item.scope}>{linkContent}</Can> : linkContent;
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="mb-4 px-4 text-sm text-slate-500 truncate">
            {auth.user?.profile.email}
          </div>
          <button 
            onClick={() => auth.removeUser().then(() => auth.signoutRedirect())}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={20} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 p-4 md:hidden flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">SecureDonations</h1>
          <button onClick={() => auth.removeUser().then(() => auth.signoutRedirect())} className="text-slate-500">
            <LogOut size={24} />
          </button>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};