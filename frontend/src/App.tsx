import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { ToastProvider } from './utils/ToastContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

// Páginas
import { Projects } from './pages/Projects';
import { CreateProject } from './pages/CreateProject';
import { ProjectDetail } from './pages/ProjectDetail';
import { MyDonations } from './pages/MyDonations';
import { AuditLogs } from './pages/AuditLogs';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Todas las rutas base requieren autenticación */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                {/* Listado de proyectos (Dashboard) */}
                <Route path="/" element={<Projects />} />
                
                {/* Detalle de proyecto */}
                <Route path="/projects/:id" element={<ProjectDetail />} />
                
                {/* Creación de proyecto - PROTEGIDO por Scope */}
                <Route element={<ProtectedRoute requiredScope="api/projects.write" />}>
                  <Route path="/projects/create" element={<CreateProject />} />
                </Route>

                {/* Mis donaciones - PROTEGIDO por Scope */}
                <Route element={<ProtectedRoute requiredScope="api/donations.read" />}>
                  <Route path="/donations" element={<MyDonations />} />
                </Route>

                {/* Auditoría - PROTEGIDO por Scope */}
                <Route element={<ProtectedRoute requiredScope="api/audit.read" />}>
                  <Route path="/audit" element={<AuditLogs />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;