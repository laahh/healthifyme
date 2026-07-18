import Swal from "sweetalert2";

/** Modal sukses/gagal seragam untuk seluruh app (tema WELL). */
const base = Swal.mixin({
  confirmButtonColor: "#006a3f",
  cancelButtonColor: "#94a3b8",
  customClass: {
    popup: "rounded-2xl",
    confirmButton: "rounded-xl",
    cancelButton: "rounded-xl",
  },
});

export function showSuccess(title, text = "") {
  return base.fire({
    icon: "success",
    title: title || "Berhasil",
    text: text || undefined,
    timer: 1800,
    timerProgressBar: true,
    showConfirmButton: false,
  });
}

export function showError(title, text = "") {
  return base.fire({
    icon: "error",
    title: title || "Gagal",
    text: text || undefined,
    confirmButtonText: "OK",
  });
}

export function showWarning(title, text = "") {
  return base.fire({
    icon: "warning",
    title: title || "Perhatian",
    text: text || undefined,
    confirmButtonText: "OK",
  });
}

/** @returns {Promise<boolean>} true jika user menekan tombol konfirmasi */
export async function showConfirm(title, text = "", confirmText = "Ya") {
  const res = await base.fire({
    icon: "question",
    title,
    text: text || undefined,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Batal",
  });
  return Boolean(res.isConfirmed);
}

/** Toast kecil di atas (untuk aksi ringan). */
export function showToast(title, icon = "success") {
  return Swal.fire({
    toast: true,
    position: "top",
    icon,
    title,
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
  });
}
