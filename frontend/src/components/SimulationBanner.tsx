import type { ReactNode } from "react";

interface SimulationBannerProps {
  children?: ReactNode;
}

// CA-06.4: aviso obligatorio de que las donaciones son una simulación académica.
export const SimulationBanner = ({ children }: SimulationBannerProps) => (
  <div
    role="note"
    className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800"
  >
    <p className="font-semibold">Simulación académica: no se ha realizado ningún cobro</p>
    {children && <p className="mt-1">{children}</p>}
  </div>
);
