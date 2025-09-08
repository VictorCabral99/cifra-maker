"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Download, ArrowUpRight, Music, Settings2, FileText, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";

// ==========================
// Types & Domain Model
// ==========================

type TimeSignature = {
  numerator: number;
  denominator: number;
};

type KeySignature = {
  tonic: NoteName | "none"; // "none" = sem tom definido
  mode: Mode; // major/minor only for now
};

type Mode = "major" | "minor";

type Bar = {
  id: string;
  chords: {
    chord: ChordToken;
    beats: number; // quantos tempos ocupa (1 a 4)
  }[];
};

type Section = {
  id: string;
  title: string;
  keyShiftSemitones: number; // aumento de tom por seção
  bars: Bar[];
};

type Chart = {
  id: string;
  title: string;
  artist: string;
  time: TimeSignature;
  key: KeySignature;
  sections: Section[];
  notes?: string; // observações gerais
};

type Quality = "maj" | "min" | "dim" | "aug" | "dom7" | "maj7" | "min7" | "sus2" | "sus4";

type NoteName =
  | "C"
  | "C#"
  | "Db"
  | "D"
  | "D#"
  | "Eb"
  | "E"
  | "E#"
  | "Fb"
  | "F"
  | "F#"
  | "Gb"
  | "G"
  | "G#"
  | "Ab"
  | "A"
  | "A#"
  | "Bb"
  | "B"
  | "B#"
  | "Cb";

type ChordToken = {
  id: string;
  root: NoteName;
  quality: Quality;
  label?: string; // ex.: "bVII"
  baseKey?: NoteName;
};

// ==========================
// Music theory helpers (simplificados)
// ==========================

const PC: Record<NoteName, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  "E#": 5,
  Fb: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

const NATURAL_SHARPS: NoteName[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NATURAL_FLATS: NoteName[] = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const MAJOR_STEPS = [2, 2, 1, 2, 2, 2, 1];
const MINOR_STEPS = [2, 1, 2, 2, 1, 2, 2]; // natural minor (aeolian)

const KEY_SIGNATURE_SPELLINGS: Record<NoteName, Partial<Record<number, NoteName>>> = {
  "Gb": {
    11: "Cb", // B vira Cb
    4: "Fb",  // E vira Fb
  },
  "Db": {
    11: "Cb",
  },
  "Cb": {
    11: "Cb",
    4: "Fb",
    9: "Ab",
    2: "Db",
    7: "Gb",
  },
  "F#": {
    5: "E#", // F vira E#
    0: "B#", // C vira B#
  },
  "C#": {
    5: "E#",
    0: "B#",
    10: "A#",
    3: "D#",
    8: "G#",
  },
};

function normalizePc(n: number) {
  return ((n % 12) + 12) % 12;
}

function chooseSpelling(pc: number, preferSharps: boolean, keyTonic?: NoteName): NoteName {
  if (keyTonic && KEY_SIGNATURE_SPELLINGS[keyTonic] && KEY_SIGNATURE_SPELLINGS[keyTonic]![pc]) {
    return KEY_SIGNATURE_SPELLINGS[keyTonic]![pc]!;
  }
  const arr = preferSharps ? NATURAL_SHARPS : NATURAL_FLATS;
  return arr[pc] as NoteName;
}

function buildScale(tonic: NoteName, mode: Mode, preferSharps: boolean, keyTonic?: NoteName): number[] {
  const steps = mode === "major" ? MAJOR_STEPS : MINOR_STEPS;
  const start = PC[tonic];
  const pcs = [start];
  let cur = start;
  for (const s of steps.slice(0, 6)) {
    cur += s;
    pcs.push(normalizePc(cur));
  }
  return pcs; // 7 graus
}

function diatonicTriads(tonic: NoteName, mode: Mode, preferSharps: boolean, keyTonic?: NoteName) {
  const scale = buildScale(tonic, mode, preferSharps, keyTonic);
  const qualitiesMajor: Quality[] = ["maj", "min", "min", "maj", "maj", "min", "dim"];
  const qualitiesMinor: Quality[] = ["min", "dim", "maj", "min", "min", "maj", "maj"];
  const q = mode === "major" ? qualitiesMajor : qualitiesMinor;
  return scale.map((pc, idx) => {
    const root = chooseSpelling(pc, preferSharps, keyTonic);
    return { root, quality: q[idx], label: romanLabel(idx, mode) } as ChordToken;
  });
}

function romanLabel(i: number, mode: Mode) {
  const major = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
  const minor = ["i", "ii°", "III", "iv", "v", "VI", "VII"]; // natural minor baseline
  return (mode === "major" ? major : minor)[i];
}

// Common modal interchange from parallel minor/major (simplificado para tom maior)
const BORROWED_MAJOR: { semitonesFromTonic: number; quality: Quality; label: string }[] = [
  { semitonesFromTonic: 3, quality: "maj", label: "bIII" },
  { semitonesFromTonic: 5, quality: "min", label: "iv" },
  { semitonesFromTonic: 8, quality: "maj", label: "bVI" },
  { semitonesFromTonic: 10, quality: "maj", label: "bVII" },
  { semitonesFromTonic: 1, quality: "dim", label: "ii° (harm.)" }, // da harmônica
];

// borrowedChords também passa o tom
function borrowedChords(tonic: NoteName, mode: Mode, preferSharps: boolean, keyTonic?: NoteName): ChordToken[] {
  if (mode === "minor") {
    const tonicPc = PC[tonic];
    const entries = [
      { st: 7, q: "maj" as Quality, label: "V (harm.)" },
      { st: 10, q: "maj" as Quality, label: "bVII" },
      { st: 5, q: "maj" as Quality, label: "bIII+ (melód.)" },
    ];
    return entries.map(({ st, q, label }) => ({
      id: crypto.randomUUID(),
      root: chooseSpelling(normalizePc(tonicPc + st), preferSharps, keyTonic),
      quality: q,
      label,
    }));
  }
  const tonicPc = PC[tonic];
  return BORROWED_MAJOR.map(({ semitonesFromTonic, quality, label }) => ({
    id: crypto.randomUUID(),
    root: chooseSpelling(normalizePc(tonicPc + semitonesFromTonic), preferSharps, keyTonic),
    quality,
    label,
  }));
}

function transposeNote(root: NoteName, semitones: number, preferSharps: boolean, keyTonic?: NoteName): NoteName {
  return chooseSpelling(normalizePc(PC[root] + semitones), preferSharps, keyTonic);
}

function chordToString(c: ChordToken): string {
  const q = c.quality;
  switch (q) {
    case "maj":
      return c.root;
    case "min":
      return c.root + "m";
    case "dim":
      return c.root + "°";
    case "aug":
      return c.root + "+";
    case "dom7":
      return c.root + "7";
    case "maj7":
      return c.root + "maj7";
    case "min7":
      return c.root + "m7";
    case "sus2":
      return c.root + "sus2";
    case "sus4":
      return c.root + "sus4";
    default:
      return c.root;
  }
}

// ==========================
// UI Helpers
// ==========================

const ALL_TONICS: NoteName[] = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
];

const DEFAULT_NUM_BARS = 4;
const DEFAULT_NUM_SECTIONS = 3;

const DEFAULT_CHART: Chart = {
  id: crypto.randomUUID(),
  title: "",
  artist: "",
  time: { numerator: 4, denominator: 4 },
  key: { tonic: "C", mode: "major" },
  sections: Array.from({ length: DEFAULT_NUM_SECTIONS }, (_, i) => ({
    id: crypto.randomUUID(),
    title: ["Intro", "Verso", "Refrão"][i] || `Seção ${i + 1}`,
    keyShiftSemitones: 0,
    bars: Array.from({ length: DEFAULT_NUM_BARS }, () => ({
      id: crypto.randomUUID(),
      chords: []
    }))
  })),
  notes: "",
};

// ==========================
// PDF (via window.print da versão simplificada) — você pode trocar por @react-pdf/renderer se preferir
// ==========================
function exportSimplePDF() {
  // Simplificado: abre uma janela de impressão do próprio browser.
  // Em produção, use @react-pdf/renderer ou jsPDF + html2canvas para um PDF mais fiel.
  window.print();
}

// ==========================
// Component
// ==========================

export default function CriadorDeCifras() {
  const [chart, setChart] = useState<Chart>(DEFAULT_CHART);
  const [preferSharps, setPreferSharps] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState(chart.sections[0].id);
  const router = useRouter();

  const activeSection = useMemo(
    () => chart.sections.find((s) => s.id === activeSectionId)!,
    [chart.sections, activeSectionId]
  );

  const diatonic = useMemo(() => {
    if (chart.key.tonic === "none") return [] as ChordToken[];
    return diatonicTriads(
      chart.key.tonic as NoteName,
      chart.key.mode,
      preferSharps,
      chart.key.tonic !== "none" ? (chart.key.tonic as NoteName) : undefined
    ).map((c) => ({
      ...c,
      id: crypto.randomUUID(),
    }));
  }, [chart.key, preferSharps]);

  const borrowed = useMemo(() => {
    if (chart.key.tonic === "none") return [] as ChordToken[];
    return borrowedChords(
      chart.key.tonic as NoteName,
      chart.key.mode,
      preferSharps,
      chart.key.tonic !== "none" ? (chart.key.tonic as NoteName) : undefined
    );
  }, [chart.key, preferSharps]);

  const anyKeyPalette = useMemo(() => {
    // quando sem tom definido, oferece paleta com 12 notas e qualidades comuns
    const qualities: Quality[] = ["maj", "min", "dom7", "maj7", "min7", "dim", "sus4"];
    const items: ChordToken[] = [];
    for (const n of (preferSharps ? NATURAL_SHARPS : NATURAL_FLATS) as NoteName[]) {
      for (const q of qualities) {
        items.push({ id: crypto.randomUUID(), root: n, quality: q });
      }
    }
    return items;
  }, [preferSharps]);

  function updateSection(id: string, patch: Partial<Section>) {
    setChart((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  const [activeBarIdx, setActiveBarIdx] = useState(0);

  function addBarToActiveSection() {
    if (!activeSection) return;
    updateSection(activeSection.id, {
      bars: [
        ...activeSection.bars,
        { id: crypto.randomUUID(), chords: [] }
      ]
    });
    setActiveBarIdx(activeSection.bars.length); // seleciona o novo compasso
  }

  function addChordToActiveBar(c: ChordToken, beats = 4) {
    if (!activeSection) return;
    const bars = [...activeSection.bars];
    bars[activeBarIdx] = {
      ...bars[activeBarIdx],
      chords: [
        ...bars[activeBarIdx].chords,
        { chord: { ...c, id: crypto.randomUUID(), baseKey: chart.key.tonic === "none" ? undefined : chart.key.tonic as NoteName }, beats }
      ]
    };
    updateSection(activeSection.id, { bars });
  }

  function removeChordFromBar(barIdx: number, chordIdx: number) {
    if (!activeSection) return;
    const bars = [...activeSection.bars];
    bars[barIdx] = {
      ...bars[barIdx],
      chords: bars[barIdx].chords.filter((_, i) => i !== chordIdx)
    };
    updateSection(activeSection.id, { bars });
  }

  function setChordBeats(barIdx: number, chordIdx: number, beats: number) {
    if (!activeSection) return;
    const bars = [...activeSection.bars];
    bars[barIdx] = {
      ...bars[barIdx],
      chords: bars[barIdx].chords.map((item, i) =>
        i === chordIdx ? { ...item, beats } : item
      )
    };
    updateSection(activeSection.id, { bars });
  }

  // function addChordToActive(c: ChordToken) {
  //   if (!activeSection) return;
  //   updateSection(activeSection.id, { chords: [...activeSection.chords, { ...c, id: crypto.randomUUID() }] });
  // }

  // function addChordToActive(c: ChordToken) {
  //   if (!activeSection) return;
  //   updateSection(activeSection.id, {
  //     chords: [
  //       ...activeSection.chords,
  //       { ...c, id: crypto.randomUUID(), baseKey: chart.key.tonic === "none" ? undefined : chart.key.tonic as NoteName }
  //     ]
  //   });
  // }

  function addChordToActive(c: ChordToken, beats = 4) {
    if (!activeSection) return;
    const bars = [...activeSection.bars];
    // Adiciona no compasso (bar) atualmente selecionado (activeBarIdx)
    bars[activeBarIdx] = {
      ...bars[activeBarIdx],
      chords: [
        ...bars[activeBarIdx].chords,
        { chord: { ...c, id: crypto.randomUUID(), baseKey: chart.key.tonic === "none" ? undefined : chart.key.tonic as NoteName }, beats }
      ]
    };
    updateSection(activeSection.id, { bars });
  }

  // function removeChord(sectionId: string, chordId: string) {
  //   const s = chart.sections.find((x) => x.id === sectionId);
  //   if (!s) return;
  //   updateSection(sectionId, { chords: s.chords.filter((c) => c.id !== chordId) });
  // }

  function removeChordFromBarById(sectionId: string, barId: string, chordId: string) {
    const section = chart.sections.find((x) => x.id === sectionId);
    if (!section) return;
    const bars = section.bars.map((bar) =>
      bar.id === barId
        ? { ...bar, chords: bar.chords.filter((item) => item.chord.id !== chordId) }
        : bar
    );
    updateSection(sectionId, { bars });
  }

  function addSection() {
    const bars = Array.from({ length: DEFAULT_NUM_BARS }, () => ({
      id: crypto.randomUUID(),
      chords: []
    }));
    const s: Section = {
      id: crypto.randomUUID(),
      title: `Seção ${chart.sections.length + 1}`,
      keyShiftSemitones: 0,
      bars
    };
    setChart((prev) => ({ ...prev, sections: [...prev.sections, s] }));
    setActiveSectionId(s.id);
    setActiveBarIdx(0);
  }

  function getCommonInversions(tonic: NoteName, mode: Mode, preferSharps: boolean, keyTonic?: NoteName): ChordToken[] {
    const scale = buildScale(tonic, mode, preferSharps, keyTonic);
    const triads = diatonicTriads(tonic, mode, preferSharps, keyTonic);
    const inversions: { chord: ChordToken; bass: NoteName }[] = [];
    for (let i = 0; i < triads.length; i++) {
      const bassIdx = (i + 2) % 7;
      inversions.push({
        chord: triads[i],
        bass: chooseSpelling(scale[bassIdx], preferSharps, keyTonic),
      });
    }
    return inversions.map(({ chord, bass }) => ({
      ...chord,
      id: crypto.randomUUID(),
      label: `${chordToString(chord)}/${bass}`,
    }));
  }

  function deleteSection(id: string) {
    if (chart.sections.length === 1) return;
    const idx = chart.sections.findIndex((s) => s.id === id);
    const nextIdx = Math.max(0, idx - 1);
    setChart((prev) => ({ ...prev, sections: prev.sections.filter((s) => s.id !== id) }));
    setActiveSectionId(chart.sections[nextIdx].id);
  }

  function saveChartToLocal() {
    const charts = JSON.parse(localStorage.getItem("cifras") || "[]");
    // Se já existe uma cifra com o mesmo id, substitui
    const idx = charts.findIndex((c: any) => c.id === chart.id);
    if (idx >= 0) {
      charts[idx] = chart;
    } else {
      charts.push(chart);
    }
    localStorage.setItem("cifras", JSON.stringify(charts));
    router.push("/");
  }

  function displayedChord(c: ChordToken, keyShift: number): string {
    // Se baseKey está presente, transpõe do baseKey para o tom atual
    if (c.baseKey && chart.key.tonic !== "none") {
      const from = PC[c.baseKey];
      const to = PC[chart.key.tonic as NoteName];
      const diff = to - from;
      const transposed = transposeNote(
        c.root,
        diff + keyShift,
        preferSharps,
        chart.key.tonic !== "none" ? (chart.key.tonic as NoteName) : undefined
      );
      // Se for inversão, monta label transposto
      if (c.label && c.label.includes("/")) {
        const [main, bass] = c.label.split("/");
        const transposedMain = chordToString({ ...c, root: transposed });
        // Transpor baixo também
        const bassNote = transposeNote(
          bass as NoteName,
          diff + keyShift,
          preferSharps,
          chart.key.tonic !== "none" ? (chart.key.tonic as NoteName) : undefined
        ); return `${transposedMain}/${bassNote}`;
      }
      return chordToString({ ...c, root: transposed });
    }
    // fallback antigo
    if (c.label) return c.label;
    const transposed = transposeNote(c.root, keyShift, preferSharps);
    return chordToString({ ...c, root: transposed });
  }
  const chordBank = chart.key.tonic === "none" ? anyKeyPalette : diatonic;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-3 justify-between mb-6">
        <div className="flex items-center gap-3">
          <Music className="w-8 h-8" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Criador de Cifras</h1>
            <p className="text-slate-500 text-sm">Campos harmônicos, empréstimo modal e seções com aumento de tom</p>
          </div>
        </div>
        <div className="flex">
          <Button variant="secondary" onClick={() => exportSimplePDF()}>
            <Download className="w-4 h-4 mr-2" /> Exportar PDF
          </Button>
          <Button variant="default" onClick={saveChartToLocal}>Salvar cifra</Button>
        </div>
      </div>

      {/* Meta */}
      <Card className="max-w-6xl mx-auto mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2"><FileText className="w-4 h-4" /> Metadados</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="text-sm text-slate-600">Título</label>
            <Input value={chart.title} onChange={(e) => setChart({ ...chart, title: e.target.value })} placeholder="Ex.: Deus é o nosso refúgio" />
          </div>
          <div>
            <label className="text-sm text-slate-600">Artista/Cantor</label>
            <Input value={chart.artist} onChange={(e) => setChart({ ...chart, artist: e.target.value })} placeholder="Ex.: Ministério XYZ" />
          </div>
          <div>
            <label className="text-sm text-slate-600">Compasso</label>
            <div className="flex gap-2">
              <Input type="number" min={1} value={chart.time.numerator} onChange={(e) => setChart({ ...chart, time: { ...chart.time, numerator: parseInt(e.target.value || "4") } })} />
              <span className="self-center">/</span>
              <Input type="number" min={1} value={chart.time.denominator} onChange={(e) => setChart({ ...chart, time: { ...chart.time, denominator: parseInt(e.target.value || "4") } })} />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-600">Preferência de notação</label>
            <Select value={preferSharps ? "sharps" : "flats"} onValueChange={(v) => setPreferSharps(v === "sharps")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sharps">Sustenidos (C, C#, D...)</SelectItem>
                <SelectItem value="flats">Bemóis (C, Db, D...)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-slate-600">Tom</label>
            <Select value={chart.key.tonic} onValueChange={(v) => setChart({ ...chart, key: { ...chart.key, tonic: v as KeySignature["tonic"] } })}>
              <SelectTrigger><SelectValue placeholder="Tom" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem tom definido</SelectItem>
                {ALL_TONICS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-slate-600">Modo</label>
            <Select value={chart.key.mode} onValueChange={(v) => setChart({ ...chart, key: { ...chart.key, mode: v as Mode } })}>
              <SelectTrigger><SelectValue placeholder="Modo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="major">Maior</SelectItem>
                <SelectItem value="minor">Menor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-slate-600">Observações</label>
            <Textarea value={chart.notes} onChange={(e) => setChart({ ...chart, notes: e.target.value })} placeholder="Observações gerais da cifra" />
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
        {/* Banco de acordes */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-1">
            <CardTitle className="text-base flex items-center gap-2"><Settings2 className="w-4 h-4" /> Banco de Acordes</CardTitle>
            <p className="text-xs text-slate-500">
              {chart.key.tonic === "none" ? "Sem tom: paleta completa" : "7 acordes do campo harmônico"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {chordBank.map((c) => (
                <motion.button
                  key={c.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => addChordToActive(c)}
                  className="px-3 py-2 rounded-2xl shadow-sm border text-sm hover:shadow bg-white"
                  title={c.label || "Adicionar"}
                >
                  {c.label ? <span className="text-[10px] text-slate-500 mr-1">{c.label}</span> : null}
                  {chordToString(c)}
                </motion.button>
              ))}
              {activeSection && (
                <button
                  type="button"
                  className="px-3 py-2 rounded-2xl border text-sm bg-slate-100 hover:bg-slate-200 ml-2 flex items-center gap-1"
                  title="Próximo compasso"
                  onClick={() => {
                    if (activeBarIdx === activeSection.bars.length - 1) {
                      // Cria um novo compasso se já está no último
                      addBarToActiveSection();
                    } else {
                      setActiveBarIdx(activeBarIdx + 1);
                    }
                  }}
                >
                  Próx. compasso →
                </button>
              )}

              {/* Botão para pular para a próxima seção */}
              {activeSection && (
                <button
                  type="button"
                  className="px-3 py-2 rounded-2xl border text-sm bg-slate-100 hover:bg-slate-200 ml-2 flex items-center gap-1"
                  title="Próxima seção"
                  onClick={() => {
                    const idx = chart.sections.findIndex(s => s.id === activeSection.id);
                    if (idx === chart.sections.length - 1) {
                      // Cria uma nova seção se já está na última
                      addSection();
                      // O useEffect/setState do addSection já seleciona a nova seção e zera o compasso
                    } else {
                      setActiveSectionId(chart.sections[idx + 1].id);
                      setActiveBarIdx(0);
                    }
                  }}
                >
                  Próx. seção →
                </button>
              )}
            </div>

            {chart.key.tonic !== "none" && (
              <div className="mt-4">
                <div className="text-xs text-slate-500 mb-1">Empréstimo modal</div>
                <div className="flex flex-wrap gap-2">
                  {borrowed.map((c) => (
                    <motion.button
                      key={c.id}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => addChordToActive(c)}
                      className="px-3 py-2 rounded-2xl shadow-sm border text-sm hover:shadow bg-white"
                      title="Adicionar empréstimo modal"
                    >
                      <span className="text-[10px] text-rose-500 mr-1">{c.label}</span>
                      {chordToString(c)}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {chart.key.tonic !== "none" && (
              <div className="mt-4">
                <div className="text-xs text-slate-500 mb-1">Inversões comuns</div>
                <div className="flex flex-wrap gap-2">
                  {getCommonInversions(
                    chart.key.tonic as NoteName,
                    chart.key.mode,
                    preferSharps,
                    chart.key.tonic !== "none" ? (chart.key.tonic as NoteName) : undefined
                  ).map((inv) => (
                    <motion.button
                      key={inv.id}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => addChordToActive(inv)}
                      className="px-3 py-2 rounded-2xl shadow-sm border text-sm hover:shadow bg-white"
                      title="Adicionar inversão"
                    >
                      {inv.label}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Editor de seções */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Wand2 className="w-4 h-4" /> Seções</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Tabs simples */}
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              {/* Seções */}
              <div className="flex gap-2">
                {chart.sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveSectionId(s.id);
                      setActiveBarIdx(0); // sempre começa no primeiro compasso ao trocar de seção
                    }}
                    className={`px-3 py-1.5 rounded-full border text-sm ${s.id === activeSectionId ? "bg-slate-900 text-white" : "bg-white"}`}
                  >
                    {s.title}
                  </button>
                ))}
                <Button size="sm" variant="secondary" onClick={addSection}>
                  <Plus className="w-4 h-4 mr-1" /> Nova seção
                </Button>
              </div>
              {/* Compassos da seção ativa */}
              {activeSection && (
                <div className="flex gap-2 ml-6">
                  {activeSection.bars.map((bar, idx) => (
                    <div key={bar.id} className="relative flex items-center">
                      <button
                        className={`px-2 py-1 rounded ${idx === activeBarIdx ? "bg-slate-900 text-white" : "bg-white border"}`}
                        onClick={() => setActiveBarIdx(idx)}
                      >
                        Compasso {idx + 1}
                      </button>
                      {/* Botão de deletar compasso */}
                      {activeSection.bars.length > 1 && (
                        <button
                          className="ml-1 text-xs text-red-500 hover:text-red-700 px-1"
                          title="Remover compasso"
                          onClick={() => {
                            const newBars = activeSection.bars.filter((b) => b.id !== bar.id);
                            updateSection(activeSection.id, { bars: newBars });
                            // Ajusta o índice do compasso ativo se necessário
                            if (activeBarIdx >= newBars.length) setActiveBarIdx(Math.max(0, newBars.length - 1));
                          }}
                          type="button"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <Button size="sm" variant="secondary" onClick={addBarToActiveSection}>+ Compasso</Button>
                </div>
              )}
            </div>

            {activeSection && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-slate-600">Título da seção</label>
                    <Input
                      value={activeSection.title}
                      onChange={(e) => updateSection(activeSection.id, { title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600">Aumento de tom (semitons)</label>
                    <Input
                      type="number"
                      value={activeSection.keyShiftSemitones}
                      onChange={(e) => updateSection(activeSection.id, { keyShiftSemitones: parseInt(e.target.value || "0") })}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button variant="destructive" onClick={() => deleteSection(activeSection.id)}>
                      <Trash2 className="w-4 h-4 mr-1" /> Remover seção
                    </Button>
                  </div>
                </div>

                {/* Grade de acordes da seção */}
                <div className="rounded-2xl border p-3 bg-white">
                  <div className="text-xs text-slate-500 mb-2">Clique para remover um acorde</div>
                  <div className="flex flex-wrap gap-2">
                    {activeSection.bars[activeBarIdx].chords.length === 0 && (
                      <div className="text-sm text-slate-400">
                        Sem acordes ainda. Clique nos botões do banco para adicionar.
                      </div>
                    )}
                    {activeSection.bars[activeBarIdx].chords.map((item, chordIdx) => (
                      <motion.button
                        whileHover={{ y: -2 }}
                        key={item.chord.id}
                        onClick={() => removeChordFromBar(activeBarIdx, chordIdx)}
                        className={`px-3 py-2 rounded-2xl border shadow-sm bg-white text-sm relative ${item.beats === 1 ? "underline" : ""}`}
                        title="Remover"
                      >
                        {displayedChord(item.chord, activeSection.keyShiftSemitones)}
                        <span
                          className="ml-2 text-xs cursor-pointer"
                          onClick={e => {
                            e.stopPropagation();
                            setChordBeats(activeBarIdx, chordIdx, item.beats % 4 + 1);
                          }}
                        >
                          {item.beats}t
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Preview simples da cifra completa */}
                <div className="rounded-2xl border p-4 bg-slate-50" id="pdf-preview">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold">Prévia da Cifra</div>
                      <div className="text-xs text-slate-500">{chart.title || "(Sem título)"} — {chart.artist || "(Artista)"} • {chart.time.numerator}/{chart.time.denominator} • {chart.key.tonic === "none" ? "Sem tom" : `${chart.key.tonic} ${chart.key.mode === "major" ? "maior" : "menor"}`}</div>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> PDF usa a visualização</div>
                  </div>
                  <div className="space-y-3">
                    {chart.sections.map((s) => (
                      <div key={s.id}>
                        <div className="text-sm font-semibold mb-1">{s.title} {s.keyShiftSemitones !== 0 && <span className="text-slate-500 text-xs">(+{s.keyShiftSemitones} st)</span>}</div>
                        <div className="flex flex-wrap gap-2">
                          {s.bars.map((bar, barIdx) => (
                            <span key={bar.id} className="flex items-center">
                              {bar.chords.map((item, chordIdx) => (
                                <span
                                  key={item.chord.id}
                                  className={`px-2 py-1 rounded-md bg-white border text-sm ${item.beats === 1 ? "underline" : ""}`}
                                >
                                  {displayedChord(item.chord, s.keyShiftSemitones)}
                                </span>
                              ))}
                              <span className="mx-1 text-slate-400 font-bold">|</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {chart.notes && (
                    <div className="mt-3 text-xs text-slate-600 whitespace-pre-wrap">{chart.notes}</div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rodapé */}
      <div className="max-w-6xl mx-auto text-xs text-slate-400 mt-8">
        Dica: defina o Tom para ver os 7 acordes do campo harmônico. Marque "Sem tom definido" para paleta completa.
      </div>
    </div>
  );
}
