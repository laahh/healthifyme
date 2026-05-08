/**
 * Kriteria skrining ringkas untuk konteks K3 / kewaspadaan kerja.
 * Bukan diagnosis medis — keputusan akhir tetap dokter / petugas kesehatan.
 *
 * Referensi umum PVT: respons lambat / kelalaian sering dikaitkan dengan penurunan kewaspadaan;
 * ambang 500 ms sering dipakai untuk klasifikasi "lapse" pada literatur PVT.
 *
 * Parameter diset konservatif: lebih sensitif mendeteksi penurunan (cenderung "waspada"
 * daripada false negative untuk tugas berisiko).
 */

/** @param {{ trials: number; validTrials: number; meanRtMs: number; medianRtMs: number; lapses: number; falseStarts: number }} r */
export function evaluatePvt(r) {
  const trials = Math.max(1, r.trials || 18);
  const validRate = (r.validTrials || 0) / trials;
  const meanRt = r.meanRtMs ?? 0;
  const medianRt = r.medianRtMs ?? 0;
  const lapses = r.lapses ?? 0;
  const falseStarts = r.falseStarts ?? 0;

  const reasonsPass = [];
  const reasonsFail = [];

  const validOk = validRate >= 0.78;
  if (validOk) reasonsPass.push("Proporsi respons valid memadai (≥78%).");
  else reasonsFail.push("Proporsi respons valid di bawah 78% — banyak percobaan tidak terjawab atau tidak valid.");

  const rtOk = meanRt > 0 && meanRt <= 580 && medianRt > 0 && medianRt <= 560;
  if (meanRt > 0 && medianRt > 0) {
    if (rtOk) reasonsPass.push("Waktu reaksi rata-rata & median dalam rentang skrining (≤580 ms / ≤560 ms).");
    else reasonsFail.push("Waktu reaksi relatif lambat untuk skrining kewaspadaan singkat.");
  }

  const lapseOk = lapses <= 6;
  if (lapseOk) reasonsPass.push("Jumlah kelalaian (respons sangat lambat / tidak ada) masih dalam batas skrining.");
  else reasonsFail.push("Kelalaian relatif banyak — tanda penurunan kewaspadaan atau kelelahan.");

  const fsOk = falseStarts <= 5;
  if (fsOk) reasonsPass.push("Impulsivitas ringan (ketukan terlalu cepat) masih dapat diterima.");
  else reasonsFail.push("Banyak ketukan sebelum sinyal — gangguan fokus atau terlalu terburu-buru.");

  const pass = validOk && rtOk && lapseOk && fsOk;

  return {
    pass,
    label: pass ? "Memenuhi skrining PVT" : "Di bawah ambang skrining PVT",
    reasonsPass,
    reasonsFail,
    thresholdsHint:
      "Ambang: respons valid ≥78%, RT mean ≤580 ms & median ≤560 ms, kelalaian ≤6/18, ketukan dini ≤5. Bukan standar klinis tunggal.",
  };
}

/** @param {{ rounds: number; roundsCorrect: number; maxSpan: number; score: number; task?: string }} r */
export function evaluateMemory(r) {
  const rounds = Math.max(1, r.rounds || 6);
  const correct = r.roundsCorrect ?? 0;
  const maxSpan = r.maxSpan ?? 0;
  const score = r.score ?? 0;

  const reasonsPass = [];
  const reasonsFail = [];

  const correctOk = correct >= 3;
  if (correctOk) reasonsPass.push(`Babak benar ${correct}/${rounds} — konsistensi memori kerja cukup.`);
  else reasonsFail.push(`Kurang dari 3 babak benar — kapasitas memori kerja singkat perlu perhatian.`);

  const spanOk = maxSpan >= 4;
  if (spanOk) {
    reasonsPass.push(`Kompleksitas pola maksimal (sel aktif, jawaban benar) ${maxSpan} — dalam target skrining (≥4).`);
  } else {
    reasonsFail.push("Kompleksitas pola yang dijawab benar masih di bawah target skrining (≥4 sel aktif).");
  }

  const scoreNote = score >= 100;
  if (scoreNote) reasonsPass.push("Skor gabungan tinggi — performa memori konsisten.");
  else if (correctOk && spanOk)
    reasonsPass.push("Skor gabungan cukup untuk skrining bila babak benar dan kompleksitas pola terpenuhi.");

  const pass = correctOk && spanOk;

  return {
    pass,
    label: pass ? "Memenuhi skrining memori kerja" : "Di bawah ambang skrining memori kerja",
    reasonsPass,
    reasonsFail,
    thresholdsHint:
      "Ambang skrining: ≥3 babak benar dari 6 (sama/berbeda, grid 4×4) dan kompleksitas pola benar maks. ≥4 sel. Skor = babak benar×20 + jumlah sel aktif pada babak benar.",
  };
}

/**
 * @param {{ pass: boolean }} pvtEval
 * @param {{ pass: boolean }} memEval
 */
export function evaluateFitnessForDuty(pvtEval, memEval) {
  const p = pvtEval.pass;
  const m = memEval.pass;

  if (p && m) {
    return {
      level: "layak",
      title: "Skrining: layak untuk bekerja (kewaspadaan & memori)",
      subtitle:
        "Hasil kedua tes berada di atas ambang skrining singkat. Tetap patuhi istirahat, shift kerja, dan prosedur K3 perusahaan.",
      recommendations: [
        "Lanjutkan pola tidur dan istirahat yang cukup sebelum shift.",
        "Jika menggunakan alat berat atau mengemudi, tetap evaluasi kondisi subjektif Anda.",
        "Ulangi skrining setelah malam begadang atau sakit ringan.",
      ],
      color: "emerald",
    };
  }

  if (!p && !m) {
    return {
      level: "tidak_layak",
      title: "Skrining: tidak disarankan tugas penuh berisiko tinggi",
      subtitle:
        "Kedua tes di bawah ambang skrining. Ini bukan diagnosis — disarankan istirahat dan pembicaraan dengan petugas kesehatan jika gejala berlanjut.",
      recommendations: [
        "Hindari mengemudi, mengoperasikan mesin berat, atau bekerja di ketinggian hingga kondisi membaik.",
        "Istirahat 20–30 menit di tempat tenang; hidrasi; ulangi skrining setelah beberapa jam jika diperlukan.",
        "Konsultasikan ke dokter atau dokter perusahaan jika keluhan mengantuk, pusing, atau sulit konsentrasi sering terjadi.",
      ],
      color: "red",
    };
  }

  return {
    level: "waspada",
    title: "Skrining: waspada — satu tes di bawah ambang",
    subtitle:
      "Salah satu domain (kewaspadaan atau memori kerja) belum memenuhi skrining. Pertimbangkan mengurangi beban risiko hingga evaluasi ulang.",
    recommendations: [
      "Tunda tugas yang membutuhkan konsentrasi ekstrem atau koordinasi halus jika memungkinkan.",
      "Catat faktor kontekstual (kurang tidur, obat, stres) dan beri tahu atasan / K3 sesuai kebijakan.",
      "Ulangi baterai tes setelah istirahat atau hari berikutnya; bandingkan dengan riwayat di aplikasi.",
    ],
    color: "amber",
  };
}
