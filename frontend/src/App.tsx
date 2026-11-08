import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuditLogs } from "./pages/AuditLogs";
import { AuthCallback } from "./pages/AuthCallback";
import { CreateProject } from "./pages/CreateProject";
import { Login } from "./pages/Login";
import { MyDonations } from "./pages/MyDonations";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Projects } from "./pages/Projects";
import { ToastProvider } from "./utils/ToastContext";

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/callback" element={<AuthCallback />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route element={<Layout />}>
              <Route index element={<Projects />} />
              <Route path="projects/:id" element={<ProjectDetail />} />

              <Route element={<ProtectedRoute requiredScope="api/projects.write" />}>
                <Route path="projects/create" element={<CreateProject />} />
              </Route>

              <Route element={<ProtectedRoute requiredScope="api/donations.read" />}>
                <Route path="donations" element={<MyDonations />} />
              </Route>

              <Route element={<ProtectedRoute requiredScope="api/audit.read" />}>
                <Route path="audit" element={<AuditLogs />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
