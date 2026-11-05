
"use strict";

let uploadedFileText = "";
let summaryLength = "short";
let summaryFormat = "paragraph";

const $ = id => document.getElementById(id);

const fileInput = $("fileInput");
const uploadArea = $("uploadArea");
const fileBox = $("fileBox");
const fileName = $("fileName");
const fileSize = $("fileSize");
const removeFile = $("removeFile");
const fileStatus = $("fileStatus");

const textInput = $("textInput");
const charCount = $("charCount");
const summarizeBtn = $("summarizeBtn");

const results = $("results");
const resultContainer = $("resultContainer");
const emptyState = $("emptyState");

// PDF Worker
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

// ================= FILE UPLOAD =================

fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) {
        handleFile(fileInput.files[0]);
    }
});

// Drag and Drop
["dragenter", "dragover"].forEach(eventName => {
    uploadArea.addEventListener(eventName, e => {
        e.preventDefault();
        uploadArea.classList.add("drop-active");
    });
});

["dragleave", "drop"].forEach(eventName => {
    uploadArea.addEventListener(eventName, e => {
        e.preventDefault();
        uploadArea.classList.remove("drop-active");
    });
});

uploadArea.addEventListener("drop", e => {
    const file = e.dataTransfer.files[0];

    if (file) {
        handleFile(file);
    }
});

// File Handler
async function handleFile(file) {

    const allowed = [
        "pdf", "docx", "txt",
        "md", "csv", "json"
    ];

    const ext = file.name.split(".").pop().toLowerCase();

    if (!allowed.includes(ext)) {
        fileStatus.textContent = "Unsupported file type.";
        return;
    }

    fileName.textContent = file.name;

    fileSize.textContent =
        formatFileSize(file.size);

    fileBox.classList.remove("hidden");
    fileBox.classList.add("flex");

    fileStatus.textContent = "Reading your file...";

    uploadedFileText = "";

    try {

        uploadedFileText = await extractText(file);

        if (!uploadedFileText.trim()) {
            throw new Error("No readable text found.");
        }

        fileStatus.textContent =
            "✓ File loaded successfully!";

    } catch (error) {

        uploadedFileText = "";

        fileStatus.textContent =
            "⚠ " + error.message;
    }
}

// File Size
function formatFileSize(bytes) {

    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ================= EXTRACT FILE TEXT =================

async function extractText(file) {

    const ext = file.name.split(".").pop().toLowerCase();

    // TXT / MD / CSV / JSON
    if (["txt", "md", "csv", "json"].includes(ext)) {
        return await file.text();
    }

    // PDF
    if (ext === "pdf") {

        if (!window.pdfjsLib) {
            throw new Error("PDF library not loaded.");
        }

        const data = await file.arrayBuffer();

        const pdf = await pdfjsLib.getDocument({
            data
        }).promise;

        let text = "";

        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {

            const page = await pdf.getPage(pageNo);

            const content = await page.getTextContent();

            text += content.items
                .map(item => item.str)
                .join(" ") + "\n";
        }

        return text;
    }

    // DOCX
    if (ext === "docx") {

        if (!window.mammoth) {
            throw new Error("DOCX library not loaded.");
        }

        const data = await file.arrayBuffer();

        const result = await mammoth.extractRawText({
            arrayBuffer: data
        });

        return result.value;
    }

    throw new Error("Unsupported file format.");
}

// ================= REMOVE FILE =================

removeFile.addEventListener("click", () => {

    uploadedFileText = "";

    fileInput.value = "";

    fileBox.classList.add("hidden");
    fileBox.classList.remove("flex");

    fileStatus.textContent = "";
});

// ================= CHARACTER COUNT =================

textInput.addEventListener("input", () => {

    charCount.textContent =
        textInput.value.length.toLocaleString() +
        " characters";
});

// ================= SUMMARY SETTINGS =================

document.querySelectorAll("[data-length]")
    .forEach(button => {

        button.addEventListener("click", () => {

            document.querySelectorAll("[data-length]")
                .forEach(b => b.classList.remove("active"));

            button.classList.add("active");

            summaryLength = button.dataset.length;
        });
    });

document.querySelectorAll("[data-format]")
    .forEach(button => {

        button.addEventListener("click", () => {

            document.querySelectorAll("[data-format]")
                .forEach(b => b.classList.remove("active"));

            button.classList.add("active");

            summaryFormat = button.dataset.format;
        });
    });

// ================= SUMMARIZER =================

function summarize(input) {

    const text = input
        .replace(/\s+/g, " ")
        .trim();

    if (!text) return "";

    const sentences =
        text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];

    if (sentences.length <= 2) {

        if (summaryFormat === "bullets") {
            return sentences
                .map(s => "• " + s.trim())
                .join("\n\n");
        }

        return text;
    }

    const stopWords = new Set([
        "the", "and", "for", "are", "but",
        "not", "you", "your", "with", "that",
        "this", "was", "were", "from", "have",
        "has", "had", "will", "would", "could",
        "should", "into", "its", "their", "they",
        "them", "then", "than", "there", "when",
        "where", "what", "which", "while", "who",
        "why", "how", "can", "may", "might",
        "also", "been", "being", "our", "out",
        "all", "any", "his", "her", "she", "him",
        "it", "is", "in", "on", "of", "to",
        "as", "at", "by", "an", "a", "or",
        "if", "be", "we", "i"
    ]);

    function tokenize(value) {

        return value.toLowerCase()
            .match(/[a-z0-9']+/g)
            ?.filter(word =>
                word.length > 2 &&
                !stopWords.has(word)
            ) || [];
    }

    const frequency = {};

    tokenize(text).forEach(word => {

        frequency[word] =
            (frequency[word] || 0) + 1;
    });

    const scored = sentences.map((sentence, index) => {

        const words = tokenize(sentence);

        const score = words.reduce((total, word) => {
            return total + (frequency[word] || 0);
        }, 0);

        return {
            sentence: sentence.trim(),
            index,
            score: words.length
                ? score / Math.sqrt(words.length)
                : 0
        };
    });

    let percentage;

    if (summaryLength === "short") {
        percentage = 0.20;
    } else if (summaryLength === "medium") {
        percentage = 0.35;
    } else {
        percentage = 0.50;
    }

    const count = Math.max(
        1,
        Math.ceil(sentences.length * percentage)
    );

    const selected = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .sort((a, b) => a.index - b.index);

    if (summaryFormat === "bullets") {

        return selected
            .map(item => "• " + item.sentence)
            .join("\n\n");
    }

    return selected
        .map(item => item.sentence)
        .join(" ");
}

// ================= SUMMARIZE BUTTON =================

summarizeBtn.addEventListener("click", () => {

    const paragraph = textInput.value.trim();

    if (!paragraph && !uploadedFileText) {

        fileStatus.textContent =
            "Please enter text or upload a file.";

        textInput.focus();

        return;
    }

    resultContainer.replaceChildren();

    emptyState.classList.add("hidden");

    results.classList.remove("hidden");

    // Paragraph Summary
    if (paragraph) {

        createResult(
            "Paragraph Summary",
            summarize(paragraph)
        );
    }

    // File Summary
    if (uploadedFileText) {

        createResult(
            "File Summary",
            summarize(uploadedFileText)
        );
    }

    results.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
});

// ================= CREATE RESULT =================

function createResult(title, summary) {

    const card = document.createElement("article");

    card.className =
        "result-card overflow-hidden rounded-2xl border border-white/10 bg-slate-950/35";

    const heading = document.createElement("div");

    heading.className =
        "flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4";

    const headingText = document.createElement("h3");

    headingText.className = "text-sm font-bold";

    headingText.textContent = "✧ " + title;

    const tag = document.createElement("span");

    tag.className =
        "rounded-full bg-teal-300/10 px-3 py-1 text-xs text-teal-200";

    tag.textContent = summaryLength;

    heading.append(headingText, tag);

    const body = document.createElement("div");

    body.className =
        "whitespace-pre-wrap px-4 py-5 text-sm leading-7 text-slate-300";

    body.textContent = summary;

    const actions = document.createElement("div");

    actions.className =
        "flex flex-wrap gap-2 border-t border-white/10 px-4 py-3";

    // Copy
    actions.append(
        createButton("▣ Copy", () => copyText(summary))
    );

    // TXT
    actions.append(
        createButton("↓ TXT", () => downloadTXT(summary, title))
    );

    // Word
    actions.append(
        createButton("W Word", () => downloadWord(summary, title))
    );

    // PDF
    actions.append(
        createButton("↓ PDF", () => downloadPDF(summary, title))
    );

    card.append(heading, body, actions);

    resultContainer.appendChild(card);
}

// ================= BUTTON CREATOR =================

function createButton(text, action) {

    const button = document.createElement("button");

    button.type = "button";

    button.className =
        "rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-purple-400/50 hover:bg-purple-400/10 hover:text-white";

    button.textContent = text;

    button.addEventListener("click", action);

    return button;
}

// ================= COPY SUMMARY =================

async function copyText(text) {

    try {

        await navigator.clipboard.writeText(text);

        fileStatus.textContent =
            "✓ Summary copied successfully!";

    } catch {

        fileStatus.textContent =
            "Clipboard access was blocked by your browser.";
    }
}

// ================= TXT DOWNLOAD =================

function downloadTXT(text, title) {

    const blob = new Blob([text], {
        type: "text/plain;charset=utf-8"
    });

    downloadFile(blob, safeFilename(title) + ".txt");
}

// ================= WORD DOWNLOAD =================

function downloadWord(text, title) {

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body>
            <h2>${escapeHTML(title)}</h2>
            <p>${escapeHTML(text).replace(/\n/g, "<br>")}</p>
        </body>
        </html>
    `;

    const blob = new Blob(
        ["\ufeff", html],
        { type: "application/msword" }
    );

    downloadFile(blob, safeFilename(title) + ".doc");
}

// ================= PDF DOWNLOAD =================

function downloadPDF(text, title) {

    if (!window.jspdf) {

        fileStatus.textContent =
            "PDF library not loaded.";

        return;
    }

    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF();

    const pageWidth =
        pdf.internal.pageSize.getWidth();

    const pageHeight =
        pdf.internal.pageSize.getHeight();

    const margin = 18;

    const lines = pdf.splitTextToSize(
        text,
        pageWidth - margin * 2
    );

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);

    pdf.text(title, margin, 22);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    let y = 34;

    const lineHeight = 6;

    lines.forEach(line => {

        if (y > pageHeight - margin) {
            pdf.addPage();
            y = margin;
        }

        pdf.text(line, margin, y);

        y += lineHeight;
    });

    pdf.save(safeFilename(title) + ".pdf");
}

// ================= DOWNLOAD FILE =================

function downloadFile(blob, filename) {

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

// ================= SAFE FILENAME =================

function safeFilename(value) {

    return value.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "summary";
}

// ================= SECURITY =================

function escapeHTML(text) {

    return text.replace(/[&<>"']/g, char => ({

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"

    })[char]);
}
