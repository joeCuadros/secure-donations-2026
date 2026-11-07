import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '../services/projects/api';
import type { Project } from '../services/projects/types';
import { useToast } from '../utils/ToastContext';
import { Can } from '../components/Can';
import { PlusCircle } from 'lucide-react';

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await projectsApi.list();
        setProjects(res.items);
      } catch (error) {
        toast('Error al cargar proyectos', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [toast]);

  if (loading) return <div className="text-slate-500">Cargando proyectos...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-slate-800">Proyectos Activos</h2>
        <Can I="api/projects.write">
          <Link to="/projects/create" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
            <PlusCircle size={20} />
            Crear Proyecto
          </Link>
        </Can>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(project => (
          <div key={project.projectId} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-slate-900 line-clamp-1">{project.title}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${project.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {project.status}
              </span>
            </div>
            <p className="text-slate-600 text-sm mb-6 line-clamp-2">{project.description}</p>
            
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-blue-600">${project.currentAmount}</span>
                <span className="text-slate-500">de ${project.targetAmount}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min((project.currentAmount / project.targetAmount) * 100, 100)}%` }}></div>
              </div>
            </div>

            <Link to={`/projects/${project.projectId}`} className="block w-full text-center bg-slate-50 text-blue-600 border border-blue-100 font-semibold py-2 rounded-xl hover:bg-blue-50 transition-colors">
              Ver detalles
            </Link>
          </div>
        ))}
        {projects.length === 0 && <p className="text-slate-500 col-span-full">No hay proyectos disponibles.</p>}
      </div>
    </div>
  );
};