import React, { useEffect, useState } from 'react';
import { auditApi } from '../services/audit/api';
import type { AuditEvent } from '../services/audit/types';
import { useToast } from '../utils/ToastContext';
import { Loader, Activity } from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { toast } = useToast();

  const fetchLogs = async (token?: string) => {
    try {
      const isInitial = !token;
      if (isInitial) setLoading(true);
      else setLoadingMore(true);

      const res = await auditApi.list({ nextToken: token, limit: 15 });
      
      if (isInitial) {
        setLogs(res.items);
      } else {
        setLogs(prev => [...prev, ...res.items]);
      }
      setNextToken(res.nextToken);
    } catch (error) {
      toast('Error al cargar auditoría', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  if (loading) return <div className="flex justify-center p-12"><Loader className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-slate-800 text-white rounded-xl"><Activity size={24} /></div>
        <h2 className="text-3xl font-bold text-slate-800">Registro de Auditoría</h2>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No hay eventos registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-slate-200 text-sm">
                  <th className="px-6 py-4 rounded-tl-xl">Tipo de Evento</th>
                  <th className="px-6 py-4">Actor (Sub)</th>
                  <th className="px-6 py-4">Detalles (Payload)</th>
                  <th className="px-6 py-4 rounded-tr-xl">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-sm">
                {logs.map((log) => {
                  // El ID tiene el formato: timestamp#uuid, extraemos el timestamp
                  const timestampStr = log.timestampEventId.split('#')[0];
                  const date = new Date(timestampStr).toLocaleString();
                  
                  return (
                    <tr key={log.timestampEventId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-blue-600">{log.eventType}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs truncate max-w-[150px]" title={log.actorSub}>{log.actorSub}</td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        <pre className="bg-slate-100 p-2 rounded max-w-xs overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{date}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {nextToken && (
        <div className="flex justify-center pt-4">
          <button 
            onClick={() => fetchLogs(nextToken)} 
            disabled={loadingMore}
            className="bg-white border border-slate-300 text-slate-700 px-6 py-2 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            {loadingMore ? <Loader className="animate-spin" size={16} /> : null}
            Cargar más eventos
          </button>
        </div>
      )}
    </div>
  );
};