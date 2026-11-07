import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '../services/projects/api';
import { useToast } from '../utils/ToastContext';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CreateProject: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', targetAmount: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await projectsApi.create({
        title: formData.title,
        description: formData.description,
        targetAmount: Number(formData.targetAmount)
      });
      toast('Proyecto creado exitosamente', 'success');
      navigate('/');
    } catch (error) {
      toast('Error al crear el proyecto', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800">
        <ArrowLeft size={20} /> Volver
      </Link>
      
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Nuevo Proyecto</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
            <input required type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
            <textarea required rows={4} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Meta de Recaudación ($)</label>
            <input required type="number" min="1" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={formData.targetAmount} onChange={e => setFormData({...formData, targetAmount: e.target.value})} />
          </div>
          <div className="pt-4">
            <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white font-medium py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? 'Creando...' : 'Crear Proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};