import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { projectsApi } from '../services/projects/api';
import { donationsApi } from '../services/donations/api';
import type { Project, ProjectStatsResponse } from '../services/projects/types';
import { useToast } from '../utils/ToastContext';
import { Can } from '../components/Can';
import { ArrowLeft, TrendingUp, Users, DollarSign, Loader, CheckCircle } from 'lucide-react';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  
  const [donationAmount, setDonationAmount] = useState('');
  const [donating, setDonating] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [projRes, statsRes] = await Promise.all([
        projectsApi.get(id),
        projectsApi.getStats(id)
      ]);
      setProject(projRes);
      setStats(statsRes);
    } catch (error) {
      toast('Error al cargar los detalles del proyecto', 'error');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handlePublish = async () => {
    if (!id) return;
    setPublishing(true);
    try {
      await projectsApi.publish(id);
      toast('Proyecto publicado exitosamente', 'success');
      fetchData();
    } catch (error: any) {
      toast(error.message || 'Error al publicar', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !donationAmount) return;
    setDonating(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      await donationsApi.create({ projectId: id, amount: Number(donationAmount) }, idempotencyKey);
      toast('Donación registrada (Pendiente de simulación)', 'success');
      setDonationAmount('');
      fetchData(); // Recargar para actualizar montos
    } catch (error: any) {
      toast(error.message || 'Error al donar', 'error');
    } finally {
      setDonating(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader className="animate-spin text-blue-600" size={40} /></div>;
  if (!project) return null;

  const progressPercentage = Math.min((project.currentAmount / project.targetAmount) * 100, 100);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft size={20} /> Volver a Proyectos
      </Link>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 md:p-10 border-b border-slate-100">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">{project.title}</h1>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${project.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                Estado: {project.status}
              </span>
            </div>
            
            <Can I="api/projects.write">
              {project.status === 'DRAFT' && (
                <button onClick={handlePublish} disabled={publishing} className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 font-medium">
                  {publishing ? <Loader className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                  Publicar Proyecto
                </button>
              )}
            </Can>
          </div>

          <p className="text-slate-600 text-lg leading-relaxed">{project.description}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-slate-50">
          <div className="p-8 md:p-10">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Progreso de Recaudación</h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-end">
                <span className="text-3xl font-bold text-blue-600">${project.currentAmount}</span>
                <span className="text-slate-500 font-medium pb-1">meta de ${project.targetAmount}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div className="bg-blue-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${progressPercentage}%` }}></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Users size={20} /></div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Donantes</p>
                  <p className="text-xl font-bold text-slate-800">{stats?.donorsCount || 0}</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><TrendingUp size={20} /></div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Aportes</p>
                  <p className="text-xl font-bold text-slate-800">{stats?.totalDonations || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-10 flex flex-col justify-center">
            {project.status === 'PUBLISHED' ? (
              <Can I="api/donations.write">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Haz una donación</h3>
                  <form onSubmit={handleDonate} className="space-y-4">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <DollarSign className="text-slate-400" size={20} />
                      </div>
                      <input 
                        type="number" min="1" required 
                        placeholder="Monto a donar"
                        className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg transition-all"
                        value={donationAmount} 
                        onChange={e => setDonationAmount(e.target.value)} 
                      />
                    </div>
                    <button disabled={donating} type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2">
                      {donating ? <Loader className="animate-spin" size={20} /> : 'Donar Ahora'}
                    </button>
                  </form>
                </div>
              </Can>
            ) : (
              <div className="text-center p-6 bg-slate-100 rounded-2xl text-slate-500">
                Las donaciones estarán habilitadas cuando el proyecto sea publicado.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};