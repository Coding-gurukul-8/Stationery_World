export function downloadCSV(filename = "report.csv", rows = []) {
  if (!rows || rows.length === 0) {
    const blob = new Blob(["No data"], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const headers = ["SKU", "Product Name", "Category", "Subcategory", "Quantity Sold", "Customers", "Orders", "Unit Price", "Unit Cost", "Revenue"];

  const csv = [headers.join(",")]
    .concat(
      rows.map((r) => {
        const rev = r.qtySold * r.unitPrice;
        return [
          r.sku,
          `"${r.name.replace(/"/g, '""')}"`,
          r.category,
          r.subcategory,
          r.qtySold,
          `"${r.customers.join("; ").replace(/"/g, '""')}"`,
          r.orders,
          r.unitPrice,
          r.unitCost,
          rev,
        ].join(",");
      })
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Export the selected DOM area as a PDF. Uses dynamic imports to avoid bundling until needed.
export async function downloadPDF(filename = "report.pdf", selector = ".reports-page") {
  try {
    const el = document.querySelector(selector);
    if (!el) {
      alert("No content found for PDF export.");
      return;
    }

    // Load libraries at runtime. First try global window objects, otherwise load from CDN.
    let html2canvas;
    let jsPDF;

    function loadScript(url) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${url}"]`);
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error(`Failed to load ${url}`)));
          return;
        }
        const s = document.createElement("script");
        s.src = url;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${url}`));
        document.head.appendChild(s);
      });
    }

    // Prefer already-loaded globals (e.g., if consumer bundled the libs).
    if (window.html2canvas) html2canvas = window.html2canvas;
    if (window.jspdf) jsPDF = window.jspdf.jsPDF || window.jspdf;

    if (!html2canvas || !jsPDF) {
      try {
        // Load html2canvas UMD from unpkg
        if (!window.html2canvas) await loadScript("https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js");
        // Load jspdf UMD (exposes window.jspdf)
        if (!window.jspdf) await loadScript("https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js");
        html2canvas = window.html2canvas;
        jsPDF = (window.jspdf && (window.jspdf.jsPDF || window.jspdf)) || window.jsPDF;
      } catch (err) {
        console.error("PDF export failed to load runtime dependencies:", err);
        alert("Failed to load PDF libraries from CDN. To fix: run in 'frontend' folder: npm install html2canvas jspdf, then restart dev server.");
        return;
      }
    }

    if (!html2canvas || !jsPDF) {
      alert("PDF export dependencies are not available. Install html2canvas and jspdf or enable network so CDN scripts can be loaded.");
      return;
    }

    // Provide immediate user feedback
    const originalTitle = document.title;

    // Render element to canvas
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    const pageHeight = pdf.internal.pageSize.getHeight();

    if (pdfHeight <= pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    } else {
      // Slice the canvas into multiple pages
      const totalPages = Math.ceil(pdfHeight / pageHeight);
      let offsetY = 0;
      for (let page = 0; page < totalPages; page++) {
        const sliceHeight = Math.floor((canvas.width * pageHeight) / pdfWidth);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, offsetY, pageCanvas.width, pageCanvas.height, 0, 0, pageCanvas.width, pageCanvas.height);
        const pageData = pageCanvas.toDataURL("image/png");
        if (page > 0) pdf.addPage();
        pdf.addImage(pageData, "PNG", 0, 0, pdfWidth, (pageCanvas.height * pdfWidth) / pageCanvas.width);
        offsetY += sliceHeight;
      }
    }

    pdf.save(filename);
    document.title = originalTitle;
  } catch (err) {
    console.error("Error during PDF export:", err);
    alert("An error occurred while generating the PDF. Check the console for details.");
  }
}
