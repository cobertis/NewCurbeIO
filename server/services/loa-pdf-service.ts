import PdfPrinter from 'pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import path from 'path';
import fs from 'fs';

const fonts = {
  Roboto: {
    normal: path.join(process.cwd(), 'node_modules/pdfmake/build/vfs_fonts.js'),
    bold: path.join(process.cwd(), 'node_modules/pdfmake/build/vfs_fonts.js'),
    italics: path.join(process.cwd(), 'node_modules/pdfmake/build/vfs_fonts.js'),
    bolditalics: path.join(process.cwd(), 'node_modules/pdfmake/build/vfs_fonts.js'),
  },
};

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

function displayPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const areaCode = cleaned.slice(1, 4);
    const exchange = cleaned.slice(4, 7);
    const subscriber = cleaned.slice(7, 11);
    return `(${areaCode}) ${exchange}-${subscriber}`;
  }
  if (cleaned.length === 10) {
    const areaCode = cleaned.slice(0, 3);
    const exchange = cleaned.slice(3, 6);
    const subscriber = cleaned.slice(6, 10);
    return `(${areaCode}) ${exchange}-${subscriber}`;
  }
  return phone;
}

export async function generateLOAPdf(data: LOAData): Promise<Buffer> {
  const pdfmake = await import('pdfmake/build/pdfmake');
  const pdfFonts = await import('pdfmake/build/vfs_fonts');
  
  const pdfMake = pdfmake.default || pdfmake;
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).vfs || pdfFonts;

  const fullAddress = [
    data.streetAddress,
    data.streetAddress2,
    `${data.city}, ${data.state} ${data.postalCode}`,
  ]
    .filter(Boolean)
    .join('\n');

  const phoneNumberRows = data.phoneNumbers.map((phone, index) => [
    { text: (index + 1).toString(), alignment: 'center' as const },
    { text: displayPhoneNumber(phone), alignment: 'center' as const },
  ]);

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    pageMargins: [60, 60, 60, 60],
    content: [
      {
        text: 'LETTER OF AUTHORIZATION',
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 30],
      },
      {
        text: 'FOR LOCAL/TOLL-FREE NUMBER PORTABILITY',
        style: 'subheader',
        alignment: 'center',
        margin: [0, 0, 0, 30],
      },
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'Customer/Entity Name:', style: 'label' },
              { text: data.entityName, style: 'value', margin: [0, 2, 0, 10] },
              { text: 'Authorized Representative:', style: 'label' },
              { text: data.authPersonName, style: 'value', margin: [0, 2, 0, 10] },
              { text: 'Current Carrier:', style: 'label' },
              { text: data.currentCarrier, style: 'value', margin: [0, 2, 0, 10] },
            ],
          },
          {
            width: '50%',
            stack: [
              { text: 'Billing Telephone Number (BTN):', style: 'label' },
              { text: data.billingTelephoneNumber, style: 'value', margin: [0, 2, 0, 10] },
              { text: 'Contact Phone:', style: 'label' },
              { text: data.billingPhone, style: 'value', margin: [0, 2, 0, 10] },
              { text: 'Service Address:', style: 'label' },
              { text: fullAddress, style: 'value', margin: [0, 2, 0, 10] },
            ],
          },
        ],
        margin: [0, 0, 0, 20],
      },
      {
        text: 'PHONE NUMBERS TO BE PORTED',
        style: 'sectionHeader',
        margin: [0, 10, 0, 10],
      },
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*'],
          body: [
            [
              { text: '#', style: 'tableHeader', alignment: 'center' },
              { text: 'Phone Number', style: 'tableHeader', alignment: 'center' },
            ],
            ...phoneNumberRows,
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#cccccc',
          vLineColor: () => '#cccccc',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },
      {
        text: 'AUTHORIZATION',
        style: 'sectionHeader',
        margin: [0, 10, 0, 10],
      },
      {
        text: `I, ${data.authPersonName}, am authorized to act on behalf of ${data.entityName} (the "End User") and hereby authorize Telnyx LLC ("Telnyx") and its agents to:`,
        style: 'body',
        margin: [0, 0, 0, 15],
      },
      {
        ol: [
          'Port the telephone number(s) listed above from the current service provider to Telnyx;',
          'Act as agent for the End User in submitting requests to port the telephone number(s);',
          'Notify the current service provider that the End User has authorized the port of the telephone number(s) to Telnyx;',
          'Access any information necessary to facilitate the porting of the telephone number(s).',
        ],
        style: 'body',
        margin: [20, 0, 0, 15],
      },
      {
        text: 'I certify that:',
        style: 'body',
        margin: [0, 10, 0, 10],
      },
      {
        ul: [
          'I am authorized to request this port on behalf of the End User;',
          'The information provided is true and accurate;',
          'I understand that porting may result in early termination fees from the current service provider;',
          'I authorize Telnyx to take all necessary steps to complete this port request.',
        ],
        style: 'body',
        margin: [20, 0, 0, 25],
      },
      {
        columns: [
          {
            width: '60%',
            stack: [
              { text: 'AUTHORIZED SIGNATURE:', style: 'label', margin: [0, 0, 0, 5] },
              {
                image: data.signatureDataUrl,
                width: 200,
                height: 60,
                margin: [0, 0, 0, 5],
              },
              {
                canvas: [
                  { type: 'line', x1: 0, y1: 0, x2: 250, y2: 0, lineWidth: 0.5 },
                ],
              },
              { text: data.authPersonName, style: 'value', margin: [0, 5, 0, 0] },
              { text: 'Printed Name', style: 'smallLabel' },
            ],
          },
          {
            width: '40%',
            stack: [
              { text: 'DATE:', style: 'label', margin: [0, 0, 0, 5] },
              { text: '', margin: [0, 60, 0, 5] },
              {
                canvas: [
                  { type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 },
                ],
              },
              { text: data.signatureDate, style: 'value', margin: [0, 5, 0, 0] },
            ],
          },
        ],
        margin: [0, 10, 0, 0],
      },
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        color: '#1a1a1a',
      },
      subheader: {
        fontSize: 12,
        color: '#666666',
      },
      sectionHeader: {
        fontSize: 11,
        bold: true,
        color: '#333333',
      },
      label: {
        fontSize: 9,
        color: '#666666',
      },
      smallLabel: {
        fontSize: 8,
        color: '#999999',
        italics: true,
      },
      value: {
        fontSize: 10,
        color: '#1a1a1a',
      },
      body: {
        fontSize: 10,
        color: '#333333',
        lineHeight: 1.4,
      },
      tableHeader: {
        fontSize: 10,
        bold: true,
        color: '#333333',
        fillColor: '#f5f5f5',
      },
    },
    defaultStyle: {
      font: 'Roboto',
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = pdfMake.createPdf(docDefinition);
      pdfDoc.getBuffer((buffer: Buffer) => {
        resolve(buffer);
      });
    } catch (error) {
      console.error('[LOA PDF] Error generating PDF:', error);
      reject(error);
    }
  });
}
