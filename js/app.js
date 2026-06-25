import removeBackground from "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm";

const els = {
  fileInput: document.getElementById("fileInput"),
  dropZone: document.getElementById("dropZone"),
  maxSide: document.getElementById("maxSide"),
  edgeClean: document.getElementById("edgeClean"),
  previewBg: document.getElementById("previewBg"),
  removeBtn: document.getElementById("removeBtn"),
  clearBtn: document.getElementById("clearBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  statusText: document.getElementById("statusText"),
  progressBar: document.getElementById("progressBar"),
  originalPreview: document.getElementById("originalPreview"),
  resultPreview: document.getElementById("resultPreview"),
  originalMeta: document.getElementById("originalMeta"),
  resultMeta: document.getElementById("resultMeta"),
  resultStage: document.getElementById("resultStage"),
};

let selectedFile = null;
let originalUrl = null;
let resultUrl = null;
let working = false;

const prettyBytes = (bytes) => {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const setStatus = (message, type = "normal") => {
  els.statusText.textContent = message;
  els.statusText.classList.remove("error-text", "success-text");
  if (type === "error") els.statusText.classList.add("error-text");
  if (type === "success") els.statusText.classList.add("success-text");
};

const setProgress = (value) => {
  const safeValue = Math.max(0, Math.min(100, value));
  els.progressBar.style.width = `${safeValue}%`;
};

const setWorking = (value) => {
  working = value;
  els.removeBtn.disabled = value || !selectedFile;
  els.removeBtn.textContent = value ? "Removing..." : "Remove Background";
  els.fileInput.disabled = value;
  els.maxSide.disabled = value;
  els.edgeClean.disabled = value;
};

const revokeUrl = (url) => {
  if (url) URL.revokeObjectURL(url);
};

const loadImageFromBlob = (blob) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the image file."));
    };
    image.src = url;
  });
};

const blobFromCanvas = (canvas, type = "image/png", quality = 0.95) => {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Canvas export failed."));
      else resolve(blob);
    }, type, quality);
  });
};

const resizeForProcessing = async (file, maxSide) => {
  const image = await loadImageFromBlob(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);

  if (longestSide <= maxSide) {
    return {
      blob: file,
      width: image.naturalWidth,
      height: image.naturalHeight,
      resized: false,
    };
  }

  const scale = maxSide / longestSide;
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);

  const resizedBlob = await blobFromCanvas(canvas, "image/png", 0.95);

  return { blob: resizedBlob, width, height, resized: true };
};

const cleanAlphaEdges = async (blob, threshold) => {
  if (!threshold || Number(threshold) <= 0) return blob;

  const image = await loadImageFromBlob(blob);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const cleanAmount = Number(threshold);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a <= cleanAmount) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
      continue;
    }

    const brightness = (r + g + b) / 3;
    if (brightness > 242 && a < 230) {
      data[i + 3] = Math.max(0, a - Math.round(cleanAmount * 0.65));
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return blobFromCanvas(canvas, "image/png", 1);
};

const setDownloadBlob = (blob, fileName) => {
  revokeUrl(resultUrl);
  resultUrl = URL.createObjectURL(blob);

  els.resultPreview.src = resultUrl;
  els.resultPreview.classList.add("has-image");
  els.downloadBtn.href = resultUrl;
  els.downloadBtn.download = fileName.replace(/\.[^/.]+$/, "") + "-transparent.png";
  els.downloadBtn.classList.remove("disabled");
  els.resultMeta.textContent = `${prettyBytes(blob.size)} PNG`;
};

const showOriginal = (file) => {
  revokeUrl(originalUrl);
  originalUrl = URL.createObjectURL(file);
  els.originalPreview.src = originalUrl;
  els.originalPreview.classList.add("has-image");
  els.originalMeta.textContent = `${file.name} • ${prettyBytes(file.size)}`;
};

const clearResult = () => {
  revokeUrl(resultUrl);
  resultUrl = null;
  els.resultPreview.removeAttribute("src");
  els.resultPreview.classList.remove("has-image");
  els.downloadBtn.removeAttribute("href");
  els.downloadBtn.classList.add("disabled");
  els.resultMeta.textContent = "Waiting";
  setProgress(0);
};

const selectFile = (file) => {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setStatus("Please choose a valid image file.", "error");
    return;
  }

  selectedFile = file;
  showOriginal(file);
  clearResult();
  els.removeBtn.disabled = false;
  setStatus("Image loaded. Press Remove Background.");
};

const removeSelectedBackground = async () => {
  if (!selectedFile || working) return;

  try {
    setWorking(true);
    clearResult();
    setProgress(4);
    setStatus("Preparing image...");

    const maxSide = Number(els.maxSide.value || 1536);
    const prepared = await resizeForProcessing(selectedFile, maxSide);

    setProgress(12);
    setStatus(prepared.resized ? `Resized to ${prepared.width}×${prepared.height}. Loading AI model...` : "Loading AI model...");

    const config = {
      device: "cpu",
      model: "isnet_fp16",
      output: {
        format: "image/png",
        type: "foreground",
      },
      progress: (key, current, total) => {
        if (!total) return;
        const percent = Math.round((current / total) * 60) + 15;
        setProgress(percent);
        setStatus(`Downloading model assets: ${key} ${Math.round((current / total) * 100)}%`);
      },
    };

    const rawResultBlob = await removeBackground(prepared.blob, config);

    setProgress(86);
    setStatus("Cleaning transparent edges...");

    const cleanedBlob = await cleanAlphaEdges(rawResultBlob, Number(els.edgeClean.value));

    setProgress(100);
    setDownloadBlob(cleanedBlob, selectedFile.name);
    setStatus("Done. Download your transparent PNG.", "success");
  } catch (error) {
    console.error(error);
    setProgress(0);
    setStatus(error?.message || "Something went wrong while removing the background.", "error");
  } finally {
    setWorking(false);
  }
};

const clearAll = () => {
  selectedFile = null;
  revokeUrl(originalUrl);
  originalUrl = null;
  clearResult();

  els.fileInput.value = "";
  els.originalPreview.removeAttribute("src");
  els.originalPreview.classList.remove("has-image");
  els.originalMeta.textContent = "No image selected";
  els.removeBtn.disabled = true;
  setStatus("Choose an image to begin.");
};

const updatePreviewBackground = () => {
  els.resultStage.classList.remove("preview-bg-checker", "preview-bg-white", "preview-bg-black", "preview-bg-green", "checker-stage");
  const value = els.previewBg.value;

  if (value === "checker") els.resultStage.classList.add("preview-bg-checker");
  if (value === "white") els.resultStage.classList.add("preview-bg-white");
  if (value === "black") els.resultStage.classList.add("preview-bg-black");
  if (value === "green") els.resultStage.classList.add("preview-bg-green");
};

els.fileInput.addEventListener("change", (event) => selectFile(event.target.files?.[0]));
els.removeBtn.addEventListener("click", removeSelectedBackground);
els.clearBtn.addEventListener("click", clearAll);
els.previewBg.addEventListener("change", updatePreviewBackground);

els.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.dropZone.classList.add("is-dragover");
});

els.dropZone.addEventListener("dragleave", () => {
  els.dropZone.classList.remove("is-dragover");
});

els.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.dropZone.classList.remove("is-dragover");
  selectFile(event.dataTransfer.files?.[0]);
});

window.addEventListener("beforeunload", () => {
  revokeUrl(originalUrl);
  revokeUrl(resultUrl);
});

updatePreviewBackground();
