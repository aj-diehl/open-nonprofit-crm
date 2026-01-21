import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";

export type DonationReceiptInput = {
  orgName: string;
  orgAddressLine?: string;
  orgEIN?: string;

  logoBytes?: Uint8Array;
  logoContentType?: string;
  logoUrl?: string;
  logoDataUri?: string;

  donorName?: string;
  donorEmail?: string;
  donorAddressLines?: string[];

  donationDate: string;
  amount: number;
  currency?: string;

  goodsOrServicesProvided: boolean;
  goodsOrServicesDescription?: string;
  goodsOrServicesValue?: number;

  receiptId?: string;
  issuedDate?: string;
  authorizedSignerName?: string;
  authorizedSignerTitle?: string;
};

function assert(condition: any, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function formatMoney(amount: number, currency = "USD") {
  return `${currency} ${amount.toFixed(2)}`;
}

function formatDate(value: string) {
  if (!value) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function isDataUri(s: string) {
  return /^data:image\/(png|jpeg);base64,/.test(s);
}

function getImageKindFromDataUri(dataUri: string): "png" | "jpeg" {
  if (dataUri.startsWith("data:image/png;base64,")) return "png";
  if (dataUri.startsWith("data:image/jpeg;base64,")) return "jpeg";
  throw new Error("logoDataUri must be data:image/png;base64,... or data:image/jpeg;base64,...");
}

async function fetchImageBytes(url: string): Promise<{ bytes: ArrayBuffer; contentType?: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch logoUrl (${res.status})`);
  const contentType = res.headers.get("content-type") ?? undefined;
  const bytes = await res.arrayBuffer();
  return { bytes, contentType };
}

async function embedOptionalLogo(pdfDoc: PDFDocument, input: DonationReceiptInput) {
  if (input.logoBytes) {
    const ct = (input.logoContentType ?? "").toLowerCase();
    if (ct.includes("png")) return await pdfDoc.embedPng(input.logoBytes);
    if (ct.includes("jpeg") || ct.includes("jpg")) return await pdfDoc.embedJpg(input.logoBytes);
    try {
      return await pdfDoc.embedPng(input.logoBytes);
    } catch {
      return await pdfDoc.embedJpg(input.logoBytes);
    }
  }

  if (input.logoDataUri) {
    assert(isDataUri(input.logoDataUri), "logoDataUri must be a PNG or JPEG data URI");
    const kind = getImageKindFromDataUri(input.logoDataUri);
    if (kind === "png") return await pdfDoc.embedPng(input.logoDataUri);
    return await pdfDoc.embedJpg(input.logoDataUri);
  }

  if (input.logoUrl) {
    const { bytes, contentType } = await fetchImageBytes(input.logoUrl);
    const ct = (contentType ?? "").toLowerCase();
    if (ct.includes("png")) return await pdfDoc.embedPng(bytes);
    if (ct.includes("jpeg") || ct.includes("jpg")) return await pdfDoc.embedJpg(bytes);
    try {
      return await pdfDoc.embedPng(bytes);
    } catch {
      return await pdfDoc.embedJpg(bytes);
    }
  }

  return null;
}

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number) {
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  paragraphs.forEach((para, idx) => {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";

    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(next, size);
      if (width <= maxWidth) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    });

    if (line) lines.push(line);
    if (idx < paragraphs.length - 1) lines.push("");
  });

  return lines;
}

export async function buildDonationReceiptPdf(input: DonationReceiptInput): Promise<Uint8Array> {
  assert(input.orgName, "orgName is required");
  assert(input.donationDate, "donationDate is required");
  assert(typeof input.amount === "number" && input.amount > 0, "amount must be > 0");
  assert(typeof input.goodsOrServicesProvided === "boolean", "goodsOrServicesProvided must be boolean");

  if (input.goodsOrServicesProvided) {
    assert(input.goodsOrServicesDescription, "goodsOrServicesDescription required when goodsOrServicesProvided=true");
    assert(typeof input.goodsOrServicesValue === "number", "goodsOrServicesValue required when goodsOrServicesProvided=true");
    assert(input.goodsOrServicesValue! >= 0, "goodsOrServicesValue must be >= 0");
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 54;
  const pageW = page.getWidth();
  const maxWidth = pageW - margin * 2;
  let y = page.getHeight() - margin;

  const drawLine = (text: string, size = 11, bold = false) => {
    const f = bold ? fontBold : font;
    page.drawText(text, { x: margin, y, size, font: f });
    y -= size + 6;
  };

  const drawParagraph = (text: string, size = 11, bold = false) => {
    const f = bold ? fontBold : font;
    const lines = wrapText(text, maxWidth, f, size);
    const lineHeight = size + 4;
    for (const line of lines) {
      if (line) page.drawText(line, { x: margin, y, size, font: f });
      y -= lineHeight;
    }
    y -= 4;
  };

  const issuedDate = input.issuedDate ?? new Date().toISOString().slice(0, 10);
  const currency = input.currency ?? "USD";

  const logo = await embedOptionalLogo(pdfDoc, input);
  if (logo) {
    const maxLogoW = 140;
    const maxLogoH = 60;
    const dims = logo.scale(1);
    const scale = Math.min(maxLogoW / dims.width, maxLogoH / dims.height, 1);
    const w = dims.width * scale;
    const h = dims.height * scale;

    page.drawImage(logo, {
      x: pageW - margin - w,
      y: page.getHeight() - margin - h + 10,
      width: w,
      height: h,
    });
  }

  drawLine(input.orgName, 18, true);

  if (input.orgAddressLine) {
    const lines = input.orgAddressLine
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    lines.forEach((line) => drawLine(line, 11, false));
  }
  if (input.orgEIN) drawLine(`EIN: ${input.orgEIN}`, 11, false);
  y -= 6;

  drawLine("Donation Receipt / Written Acknowledgment", 14, true);
  drawLine(`Issued: ${formatDate(issuedDate)}`, 11, false);
  if (input.receiptId) drawLine(`Receipt ID: ${input.receiptId}`, 11, false);
  y -= 10;

  if (input.donorName || input.donorEmail || (input.donorAddressLines && input.donorAddressLines.length > 0)) {
    drawLine("Donor", 12, true);
    if (input.donorName) drawLine(`Name: ${input.donorName}`, 11, false);
    if (input.donorEmail) drawLine(`Email: ${input.donorEmail}`, 11, false);
    if (input.donorAddressLines && input.donorAddressLines.length > 0) {
      drawLine("Address:", 11, false);
      input.donorAddressLines.forEach((line) => drawLine(line, 11, false));
    }
    y -= 8;
  }

  drawLine("Donation Details", 12, true);
  drawLine(`Date received: ${formatDate(input.donationDate)}`, 11, false);
  drawLine(`Cash contribution amount: ${formatMoney(input.amount, currency)}`, 11, false);
  y -= 10;

  drawLine("Goods or Services", 12, true);
  if (!input.goodsOrServicesProvided) {
    drawParagraph(
      "No goods or services were provided by the organization in exchange for this contribution.",
      11,
      false
    );
  } else {
    drawParagraph(
      "Goods or services were provided in exchange for part of this contribution.",
      11,
      false
    );
    drawLine(`Description: ${input.goodsOrServicesDescription}`, 11, false);
    drawLine(`Estimated fair market value: ${formatMoney(input.goodsOrServicesValue!, currency)}`, 11, false);

    const deductible = Math.max(0, input.amount - input.goodsOrServicesValue!);
    drawLine(`Estimated deductible amount: ${formatMoney(deductible, currency)}`, 11, false);
    drawParagraph(
      "For federal income tax purposes, the deductible amount may be limited to the excess of the contribution over the value of goods or services received.",
      11,
      false
    );
  }

  y -= 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageW - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 14;

  drawLine("Authorized Signature", 12, true);
  drawLine(input.authorizedSignerName ?? "________________________", 11, false);
  if (input.authorizedSignerTitle) drawLine(input.authorizedSignerTitle, 11, false);

  y -= 10;
  drawParagraph(
    "Note: This receipt is provided for substantiation purposes. Donors should consult a tax advisor.",
    9,
    false
  );

  return await pdfDoc.save();
}
