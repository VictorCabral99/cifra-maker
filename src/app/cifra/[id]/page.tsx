"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// Funções utilitárias simples para transposição
const NOTE_ORDER_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_ORDER_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function noteToIndex(note) {
  // Procura em ambos os arrays para garantir que encontra qualquer nota
  let idx = NOTE_ORDER_SHARP.indexOf(note);
  if (idx !== -1) return idx;
  idx = NOTE_ORDER_FLAT.indexOf(note);
  if (idx !== -1) return idx;
  // bemol manual (ex: "Ab" -> "A" - 1)
  if (note.endsWith("b")) {
    const base = note[0];
    let baseIdx = NOTE_ORDER_SHARP.indexOf(base);
    if (baseIdx === -1) baseIdx = NOTE_ORDER_FLAT.indexOf(base);
    return (baseIdx + 11) % 12;
  }
  // sustenido manual (ex: "E#" -> "E" + 1)
  if (note.endsWith("#")) {
    const base = note[0];
    let baseIdx = NOTE_ORDER_SHARP.indexOf(base);
    if (baseIdx === -1) baseIdx = NOTE_ORDER_FLAT.indexOf(base);
    return (baseIdx + 1) % 12;
  }
  return 0;
}

function preferSharps(tonic) {
  // Tons com bemol: F, Bb, Eb, Ab, Db, Gb, Cb
  return !["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"].includes(tonic);
}

function indexToNote(idx, useSharps = true) {
  const arr = useSharps ? NOTE_ORDER_SHARP : NOTE_ORDER_FLAT;
  return arr[(idx + 12) % 12];
}

function transposeChordLabel(label, semitones, useSharps = true) {

  debugger;
  if (!label) return "";
  const [main, bass] = label.split("/");
  const mainNoteMatch = main.match(/[A-G][#b]?/);
  if (!mainNoteMatch) return label;
  const mainNote = mainNoteMatch[0];
  const mainRest = main.slice(mainNote.length);
  const transposedMain = indexToNote(noteToIndex(mainNote) + semitones, useSharps) + mainRest;
  if (bass) {
    const bassNoteMatch = bass.match(/[A-G][#b]?/);
    if (!bassNoteMatch) return `${transposedMain}/${bass}`;
    const bassNote = bassNoteMatch[0];
    const bassRest = bass.slice(bassNote.length);
    const transposedBass = indexToNote(noteToIndex(bassNote) + semitones, useSharps) + bassRest;
    return `${transposedMain}/${transposedBass}`;
  }
  return transposedMain;
}

export default function VisualizarCifra() {
  const params = useParams();
  const router = useRouter();
  const [cifra, setCifra] = useState<any>(null);
  const [keyShift, setKeyShift] = useState(0);

  useEffect(() => {
    if (params?.id) {
      const charts = JSON.parse(localStorage.getItem("cifras") || "[]");
      const found = charts.find((c: any) => c.id === params.id);
      setCifra(found || null);
    }
  }, [params?.id]);

  if (!cifra) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-4">Cifra não encontrada</h1>
        <button className="mt-4 px-4 py-2 rounded bg-slate-900 text-white" onClick={() => router.push("/")}>
          Voltar para lista
        </button>
      </div>
    );
  }

  // Tom atual transposto
  const useSharps = preferSharps(cifra.key?.tonic || "C");
  const tonicIdx = NOTE_ORDER_SHARP.indexOf(cifra.key?.tonic || "C");
  const transposedTonic = indexToNote(tonicIdx + keyShift, useSharps);


  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">{cifra.title || "Sem título"}</h1>
      <div className="text-slate-500 mb-4">{cifra.artist}</div>
      <div className="mb-6 flex items-center gap-4">
        <span className="inline-block bg-slate-100 rounded px-2 py-1 text-xs mr-2">
          Tom: {transposedTonic} {cifra.key?.mode === "major" ? "" : "m"}
        </span>
        <span className="inline-block bg-slate-100 rounded px-2 py-1 text-xs">
          {cifra.time?.numerator}/{cifra.time?.denominator}
        </span>
        {/* Botões para mudar o tom */}
        <div className="flex gap-1 ml-4">
          <button
            className="px-2 py-1 rounded bg-slate-200 text-xs"
            onClick={() => setKeyShift(keyShift - 1)}
            title="Descer 1 semitom"
          >-</button>
          <button
            className="px-2 py-1 rounded bg-slate-200 text-xs"
            onClick={() => setKeyShift(0)}
            title="Tom original"
          >0</button>
          <button
            className="px-2 py-1 rounded bg-slate-200 text-xs"
            onClick={() => setKeyShift(keyShift + 1)}
            title="Subir 1 semitom"
          >+</button>
        </div>
        {/* Botão imprimir */}
        <button
          className="ml-4 px-2 py-1 rounded bg-slate-900 text-white text-xs"
          onClick={() => window.print()}
        >
          Imprimir
        </button>
      </div>
      {cifra.sections.map((section: any) => (
        <div key={section.id} className="mb-6">
          <div className="font-semibold mb-1">{section.title}</div>
          <div className="flex flex-wrap items-center gap-2">
            {section.bars.map((bar: any, barIdx: number) => (
              <span key={bar.id} className="flex items-center">
                {bar.chords.map((item: any, chordIdx: number) => (
                  <span
                    key={item.chord.id}
                    className={`px-2 py-1 rounded bg-white border text-sm ${item.beats === 1 ? "underline" : ""}`}
                  >
                    {item.chord.label
                      ? transposeChordLabel(item.chord.root, keyShift, useSharps)
                      : transposeChordLabel(item.chord.root, keyShift, useSharps)}
                  </span>
                ))}
                <span className="mx-1 text-slate-400 font-bold">|</span>
              </span>
            ))}
          </div>
        </div>
      ))}
      <button className="mt-4 px-4 py-2 rounded bg-slate-900 text-white" onClick={() => router.push("/")}>
        Voltar para lista
      </button>
    </div>
  );
}