import { PDFDocument, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  accountNumber?: string;
  pin?: string;
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
  console.log('[LOA PDF] Starting generation using official Telnyx template');
  
  const templatePath = path.join(__dirname, '../assets/telnyx-loa-template.pdf');
  
  if (!fs.existsSync(templatePath)) {
    throw new Error('LOA template not found');
  }
  
  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  
  const form = pdfDoc.getForm();
  
  const accountNameField = form.getTextField('Account Name');
  const streetField = form.getTextField('Street');
  const cityField = form.getTextField('City');
  const stateField = form.getTextField('State');
  const zipField = form.getTextField('Zip');
  const carrierNameField = form.getTextField('Carrier Name');
  const btnField = form.getTextField('BTN');
  const tnsField = form.getTextField('TNs');
  const dateField = form.getTextField('Date');
  const printNameField = form.getTextField('Print Name');
  
  const fullAddress = data.streetAddress + (data.streetAddress2 ? `, ${data.streetAddress2}` : '');
  accountNameField.setText(data.entityName || '');
  streetField.setText(fullAddress || '');
  cityField.setText(data.city || '');
  stateField.setText(data.state || '');
  zipField.setText(data.postalCode || '');
  
  let carrierInfo = data.currentCarrier || '';
  if (data.accountNumber) {
    carrierInfo += ` | Acct#: ${data.accountNumber}`;
  }
  if (data.pin) {
    carrierInfo += ` | PIN: ${data.pin}`;
  }
  carrierNameField.setText(carrierInfo);
  
  btnField.setText(data.billingTelephoneNumber || '');
  
  const phoneNumbersText = data.phoneNumbers.map(p => formatPhoneNumber(p)).join(', ');
  tnsField.setText(phoneNumbersText);
  
  dateField.setText(data.signatureDate || '');
  printNameField.setText(data.authPersonName || '');
  
  if (data.signatureDataUrl && data.signatureDataUrl.startsWith('data:image/png;base64,')) {
    try {
      const base64Data = data.signatureDataUrl.split(',')[1];
      const signatureBytes = Buffer.from(base64Data, 'base64');
      const signatureImage = await pdfDoc.embedPng(signatureBytes);
      
      const page = pdfDoc.getPage(0);
      const { height } = page.getSize();
      
      const sigWidth = 120;
      const sigHeight = 30;
      const sigX = 55;
      const sigY = height - 660;
      
      page.drawImage(signatureImage, {
        x: sigX,
        y: sigY,
        width: sigWidth,
        height: sigHeight,
      });
      
      console.log('[LOA PDF] Signature embedded at position:', { x: sigX, y: sigY });
    } catch (e) {
      console.error('[LOA PDF] Failed to embed signature:', e);
    }
  }
  
  form.flatten();
  
  const pdfBytes = await pdfDoc.save();
  console.log('[LOA PDF] Generated successfully using template, size:', pdfBytes.length);
  
  return Buffer.from(pdfBytes);
}
