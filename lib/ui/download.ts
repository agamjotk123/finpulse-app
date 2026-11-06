/** Saves a Blob as a file. Works in every modern browser without a server round-trip. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before freeing memory.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
