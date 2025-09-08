"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ListaDeCifras() {
  const [charts, setCharts] = useState<any[]>([]);
  const router = useRouter();

  React.useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("cifras") || "[]");
    setCharts(stored);
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Minhas Cifras</h1>
      <ul className="space-y-2">
        {charts.length === 0 && <li className="text-slate-400">Nenhuma cifra salva.</li>}
        {charts.map((cifra) => (
          <li key={cifra.id} className="border rounded p-3 flex justify-between items-center">
            <div>
              <div className="font-semibold">{cifra.title || "Sem título"}</div>
              <div className="text-xs text-slate-500">{cifra.artist}</div>
            </div>
            <Button onClick={() => router.push(`/cifra/${cifra.id}`)}>Abrir</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}