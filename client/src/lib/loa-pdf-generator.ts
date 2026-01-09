import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Register fonts with pdfMake - in Vite, pdfFonts exports the vfs object directly
const pdfMakeAny = pdfMake as any;
const pdfFontsAny = pdfFonts as any;

// CRITICAL: Disable Web Worker - pdfmake 0.3.1 uses workers by default which don't work in Vite dev
pdfMakeAny.worker = null;

// Determine the correct vfs location based on what's exported
if (pdfFontsAny?.pdfMake?.vfs) {
  pdfMakeAny.vfs = pdfFontsAny.pdfMake.vfs;
} else if (pdfFontsAny?.vfs) {
  pdfMakeAny.vfs = pdfFontsAny.vfs;
} else if (typeof pdfFontsAny === 'object' && Object.keys(pdfFontsAny).some((k: string) => k.endsWith('.ttf'))) {
  pdfMakeAny.vfs = pdfFontsAny;
}

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

export function generateLOAPdf(data: LOAData): Promise<Blob> {
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

  const docDefinition: any = {
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
              { text: 'CUSTOMER INFORMATION', style: 'sectionHeader', margin: [0, 0, 0, 10] },
              {
                table: {
                  widths: ['35%', '65%'],
                  body: [
                    [
                      { text: 'Company/Entity:', style: 'label' },
                      { text: data.entityName, style: 'value' },
                    ],
                    [
                      { text: 'Contact Name:', style: 'label' },
                      { text: data.authPersonName, style: 'value' },
                    ],
                    [
                      { text: 'Address:', style: 'label' },
                      { text: fullAddress, style: 'value' },
                    ],
                    [
                      { text: 'Billing Phone:', style: 'label' },
                      { text: displayPhoneNumber(data.billingPhone), style: 'value' },
                    ],
                  ],
                },
                layout: 'noBorders',
              },
            ],
          },
          {
            width: '50%',
            stack: [
              { text: 'CARRIER INFORMATION', style: 'sectionHeader', margin: [0, 0, 0, 10] },
              {
                table: {
                  widths: ['40%', '60%'],
                  body: [
                    [
                      { text: 'Current Carrier:', style: 'label' },
                      { text: data.currentCarrier, style: 'value' },
                    ],
                    [
                      { text: 'BTN:', style: 'label' },
                      { text: displayPhoneNumber(data.billingTelephoneNumber), style: 'value' },
                    ],
                  ],
                },
                layout: 'noBorders',
              },
            ],
          },
        ],
        margin: [0, 0, 0, 25],
      },
      {
        text: 'TELEPHONE NUMBERS TO BE PORTED',
        style: 'sectionHeader',
        alignment: 'center',
        margin: [0, 10, 0, 10],
      },
      {
        table: {
          headerRows: 1,
          widths: ['15%', '85%'],
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
        margin: [0, 0, 0, 25],
      },
      {
        text: 'AUTHORIZATION STATEMENT',
        style: 'sectionHeader',
        margin: [0, 10, 0, 10],
      },
      {
        text: [
          'I, ',
          { text: data.authPersonName, bold: true },
          ', the undersigned, am an authorized representative of ',
          { text: data.entityName, bold: true },
          ' and hereby authorize Curbe.io to port the above-listed telephone number(s) from ',
          { text: data.currentCarrier, bold: true },
          ' to Curbe.io\'s network.',
        ],
        style: 'body',
        alignment: 'justify',
        margin: [0, 0, 0, 15],
      },
      {
        text: 'I certify that:',
        style: 'body',
        margin: [0, 0, 0, 8],
      },
      {
        ul: [
          'I am authorized to make this request on behalf of the above-named entity',
          'The information provided in this Letter of Authorization is true and correct',
          'I understand that porting my number(s) may result in service interruption and/or early termination fees from my current carrier',
          'I authorize Curbe.io to act as my agent in submitting this port request',
          'I understand that the port request cannot be processed without this signed authorization',
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
      console.log('[LOA PDF] Creating PDF document...');
      const pdfDoc = pdfMake.createPdf(docDefinition);
      console.log('[LOA PDF] PDF document created, getting blob...');
      pdfDoc.getBlob((blob: Blob) => {
        console.log('[LOA PDF] Blob generated successfully, size:', blob.size);
        resolve(blob);
      }, (error: Error) => {
        console.error('[LOA PDF] getBlob error:', error);
        reject(error);
      });
    } catch (error) {
      console.error('[LOA PDF] createPdf error:', error);
      reject(error);
    }
  });
}

export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: 'application/pdf' });
}
