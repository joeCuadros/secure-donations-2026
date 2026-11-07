import React, { useEffect, useState } from 'react';
import { donationsApi } from '../services/donations/api';
import type { Donation } from '../services/donations/types';
import { useToast } from '../utils/ToastContext';
import { Loader } from 'lucide-react';

export const MyDonations: React.FC = () => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { toast } = useToast();

  const fetchDonations = async (token?: string) => {
    try {
      const isInitial = !token;
      if (isInitial) setLoading(true);
      else setLoadingMore(true);

      const res = await donationsApi.listMyDonations({ nextToken: token, limit: 10 });
      
      if (isInitial) {
        setDonations(res.items);
      } else {
        setDonations(prev => [...prev, ...res.items]);
      }
      setNextToken(res.nextToken);
    } catch (error) {
      toast('Error al cargar donaciones', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchDonations();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-700';
      case 'FAILED': return 'bg-red-100 text-red-700';
      default: return 'bg-amber-100 text-amber-700';
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-slate-800">Mis Donaciones</h2>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {donations.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Aún no has realizado ninguna donación.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium text-sm">
                  <th className="px-6 py-4">ID Donación</th>
                  <th className="px-6 py-4">ID Proyecto</th>
                  <th className="px-6 py-4">Monto</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {donations.map((d) => (
                  <tr key={d.donationId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{d.donationId.split('-')[0]}...</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{d.projectId}</td>
                    <td className="px-6 py-4 font-bold text-slate-800">${d.amount}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(d.status)}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{new Date(d.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {nextToken && (
        <div className="flex justify-center pt-4">
          <button 
            onClick={() => fetchDonations(nextToken)} 
            disabled={loadingMore}
            className="bg-white border border-slate-300 text-slate-700 px-6 py-2 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            {loadingMore ? <Loader className="animate-spin" size={16} /> : null}
            Cargar más
          </button>
        </div>
      )}
    </div>
  );
};