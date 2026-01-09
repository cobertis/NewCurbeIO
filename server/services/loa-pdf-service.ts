import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface LOAData {
  entityName: string;
  authPersonName: string;
  billingPhone: string;
  streetAddress: string;
  streetAddress2?: string;
  city: string;
  state: string;
  postalCode: string;
  currentCarrier: string;
  billingTelephoneNumber: string;
  phoneNumbers: string[];
  signatureDataUrl: string;
  signatureDate: string;
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export async function generateLOAPdf(data: LOAData): Promise<Buffer> {
  console.log('[LOA PDF] Starting generation with pdf-lib');
  
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - 40;
  
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  
  // Header - RESPORG ID
  page.drawText('For TFs release to RESPORG ID: QIT01', {
    x: width - margin - 200,
    y,
    size: 9,
    font: helvetica,
    color: gray,
  });
  y -= 25;
  
  // Title
  const title = 'Letter of Agency (LOA)';
  const titleWidth = helveticaBold.widthOfTextAtSize(title, 18);
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y,
    size: 18,
    font: helveticaBold,
    color: black,
  });
  y -= 25;
  
  // Intro text
  const introText = 'This letter authorizes Telnyx to initiate a port request. All information must be entered exactly as shown on the customer service record (CSR) of the current carrier. In addition to completing this form, you will need to provide a copy of your latest bill/invoice.';
  const introLines = wrapText(introText, 70);
  for (const line of introLines) {
    page.drawText(line, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: black,
    });
    y -= 14;
  }
  y -= 10;
  
  // Account or Company Name
  page.drawText('Account or Company Name:', {
    x: margin,
    y,
    size: 10,
    font: helveticaBold,
    color: black,
  });
  y -= 18;
  
  page.drawText(data.entityName, {
    x: margin + 10,
    y,
    size: 11,
    font: helvetica,
    color: black,
  });
  y -= 5;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: gray,
  });
  y -= 25;
  
  // From The Customer Service Record
  page.drawText('From The Customer Service Record (CSR)', {
    x: margin,
    y,
    size: 11,
    font: helveticaBold,
    color: black,
  });
  y -= 14;
  
  page.drawText('Use the Service Address, not the Billing Address (unless they are the same)', {
    x: margin,
    y,
    size: 8,
    font: helvetica,
    color: gray,
  });
  y -= 20;
  
  // Address fields in columns
  const col1 = margin;
  const col2 = 280;
  const col3 = 380;
  const col4 = 460;
  
  page.drawText('Street w/ Number:', { x: col1, y, size: 9, font: helvetica, color: gray });
  page.drawText('City:', { x: col2, y, size: 9, font: helvetica, color: gray });
  page.drawText('State:', { x: col3, y, size: 9, font: helvetica, color: gray });
  page.drawText('Zip:', { x: col4, y, size: 9, font: helvetica, color: gray });
  y -= 14;
  
  const fullAddress = data.streetAddress + (data.streetAddress2 ? `, ${data.streetAddress2}` : '');
  page.drawText(fullAddress.substring(0, 35), { x: col1, y, size: 10, font: helvetica, color: black });
  page.drawText(data.city || '', { x: col2, y, size: 10, font: helvetica, color: black });
  page.drawText(data.state || '', { x: col3, y, size: 10, font: helvetica, color: black });
  page.drawText(data.postalCode || '', { x: col4, y, size: 10, font: helvetica, color: black });
  y -= 5;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: gray });
  y -= 25;
  
  // Current Carrier Information
  page.drawText('Current Carrier Information', {
    x: margin,
    y,
    size: 11,
    font: helveticaBold,
    color: black,
  });
  y -= 20;
  
  const midPoint = width / 2;
  page.drawText('Carrier Name:', { x: col1, y, size: 9, font: helvetica, color: gray });
  page.drawText('Billing Telephone Number (BTN):', { x: midPoint, y, size: 9, font: helvetica, color: gray });
  y -= 14;
  
  page.drawText(data.currentCarrier || '', { x: col1, y, size: 10, font: helvetica, color: black });
  page.drawText(data.billingTelephoneNumber || '', { x: midPoint, y, size: 10, font: helvetica, color: black });
  y -= 5;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: gray });
  y -= 25;
  
  // Numbers to Be Ported
  page.drawText('Numbers to Be Ported:', {
    x: margin,
    y,
    size: 11,
    font: helveticaBold,
    color: black,
  });
  y -= 14;
  
  page.drawText('Separate with commas. For ranges, use a dash (i.e. 2163215000-2163215999).', {
    x: margin,
    y,
    size: 8,
    font: helvetica,
    color: gray,
  });
  y -= 18;
  
  const phoneNumbersText = data.phoneNumbers.map(p => formatPhoneNumber(p)).join(', ');
  const phoneLines = wrapText(phoneNumbersText, 80);
  for (const line of phoneLines) {
    page.drawText(line, {
      x: margin + 10,
      y,
      size: 10,
      font: helvetica,
      color: black,
    });
    y -= 14;
  }
  y -= 5;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: gray });
  y -= 20;
  
  // Legal text
  const legalText = `This Letter of Agency ("LOA") hereby authorizes release of all customer proprietary network information ("CPNI"), as defined in 47 U.S.C. §222, to Telnyx LLC. Such CPNI shall include but not be limited to customer name and number, billing records, service records and network and equipment records for the purpose of providing telecommunications or information services.`;
  const legalLines = wrapText(legalText, 95);
  for (const line of legalLines) {
    page.drawText(line, { x: margin, y, size: 8, font: helvetica, color: black });
    y -= 10;
  }
  y -= 10;
  
  // Numbered clauses
  const clauses = [
    `1. Parties acknowledge that ${data.entityName} has obtained CPNI as defined in 47 U.S.C.§222.`,
    `2. ${data.entityName} authorizes Telnyx to use, disclose or access such CPNI as needed.`,
    `3. Parties acknowledge that pursuant to 47 C.F.R. §64.2005, the Company may use CPNI.`,
    `4. The Company will not require Telnyx to use CPNI for purposes other than telecommunications.`,
    `5. Telnyx agrees to protect CPNI in compliance with 47 U.S.C. §222.`,
  ];
  
  for (const clause of clauses) {
    const clauseLines = wrapText(clause, 95);
    for (const line of clauseLines) {
      page.drawText(line, { x: margin + 10, y, size: 8, font: helvetica, color: black });
      y -= 10;
    }
    y -= 2;
  }
  y -= 15;
  
  // Signature section
  const sigCol1 = margin;
  const sigCol2 = 250;
  const sigCol3 = 420;
  
  page.drawText('Authorized Signature:', { x: sigCol1, y, size: 9, font: helvetica, color: gray });
  page.drawText('Print Name:', { x: sigCol2, y, size: 9, font: helvetica, color: gray });
  page.drawText('Date:', { x: sigCol3, y, size: 9, font: helvetica, color: gray });
  y -= 5;
  
  // Embed signature image
  if (data.signatureDataUrl && data.signatureDataUrl.startsWith('data:image/png;base64,')) {
    try {
      const base64Data = data.signatureDataUrl.split(',')[1];
      const signatureBytes = Buffer.from(base64Data, 'base64');
      const signatureImage = await pdfDoc.embedPng(signatureBytes);
      
      const sigWidth = 150;
      const sigHeight = 40;
      page.drawImage(signatureImage, {
        x: sigCol1,
        y: y - sigHeight,
        width: sigWidth,
        height: sigHeight,
      });
    } catch (e) {
      console.error('[LOA PDF] Failed to embed signature:', e);
    }
  }
  
  y -= 45;
  
  // Signature lines
  page.drawLine({ start: { x: sigCol1, y }, end: { x: sigCol1 + 180, y }, thickness: 0.5, color: black });
  page.drawLine({ start: { x: sigCol2, y }, end: { x: sigCol2 + 150, y }, thickness: 0.5, color: black });
  page.drawLine({ start: { x: sigCol3, y }, end: { x: sigCol3 + 100, y }, thickness: 0.5, color: black });
  
  // Print name and date values
  page.drawText(data.authPersonName, { x: sigCol2, y: y + 10, size: 10, font: helvetica, color: black });
  page.drawText(data.signatureDate, { x: sigCol3, y: y + 10, size: 10, font: helvetica, color: black });
  
  y -= 25;
  
  // Warning note
  const warning = 'Please Note: For Toll Free numbers the signature is visually compared to what is on file and must match exactly';
  const warningWidth = helvetica.widthOfTextAtSize(warning, 9);
  page.drawText(warning, {
    x: (width - warningWidth) / 2,
    y,
    size: 9,
    font: helvetica,
    color: gray,
  });
  y -= 20;
  
  // Footer warning
  const footerWarning = 'All fields must be completed. Any invalid or missing information will result in delays and/or rejected orders.';
  const fwWidth = helveticaBold.widthOfTextAtSize(footerWarning, 9);
  page.drawText(footerWarning, {
    x: (width - fwWidth) / 2,
    y,
    size: 9,
    font: helveticaBold,
    color: black,
  });
  y -= 15;
  
  // Footer with contact info
  page.drawText('Letter of Agency', { x: margin, y, size: 8, font: helvetica, color: gray });
  const contactInfo = '311 W. Superior St – Suite 504 – Chicago IL 60654 | 312-945-7420 | porting@telnyx.com';
  const ciWidth = helvetica.widthOfTextAtSize(contactInfo, 8);
  page.drawText(contactInfo, { x: (width - ciWidth) / 2, y, size: 8, font: helvetica, color: gray });
  page.drawText('Version 2.2', { x: width - margin - 50, y, size: 8, font: helvetica, color: gray });
  
  const pdfBytes = await pdfDoc.save();
  console.log('[LOA PDF] Generated successfully, size:', pdfBytes.length);
  
  return Buffer.from(pdfBytes);
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxChars) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines;
}
