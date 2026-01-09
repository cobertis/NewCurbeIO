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

  const fullAddress = data.streetAddress + (data.streetAddress2 ? `, ${data.streetAddress2}` : '');
  const phoneNumbersText = data.phoneNumbers.map(p => displayPhoneNumber(p)).join(', ');

  const docDefinition: any = {
    pageSize: 'LETTER',
    pageMargins: [50, 40, 50, 40],
    content: [
      {
        text: 'For TFs release to RESPORG ID: QIT01',
        alignment: 'right',
        fontSize: 9,
        color: '#666666',
        margin: [0, 0, 0, 10],
      },
      {
        text: 'Letter of Agency (LOA)',
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 15],
      },
      {
        text: 'This letter authorizes Telnyx to initiate a port request. All information must be entered exactly as shown on the customer service record (CSR) of the current carrier. In addition to completing this form, you will need to provide a copy of your latest bill/invoice.',
        style: 'body',
        margin: [0, 0, 0, 20],
      },
      {
        text: 'Account or Company Name:',
        style: 'label',
        margin: [0, 0, 0, 3],
      },
      {
        table: {
          widths: ['*'],
          body: [[{ text: data.entityName, style: 'fieldValue', margin: [5, 8, 5, 8] }]],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 20],
      },
      {
        text: 'From The Customer Service Record (CSR)',
        style: 'sectionHeader',
        margin: [0, 0, 0, 3],
      },
      {
        text: 'Use the Service Address, not the Billing Address (unless they are the same)',
        style: 'hint',
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          widths: ['*', 100, 60, 80],
          body: [
            [
              { text: 'Street w/ Number (Required for Toll Free #s):', style: 'tableLabel' },
              { text: 'City:', style: 'tableLabel' },
              { text: 'State:', style: 'tableLabel' },
              { text: 'Zip/Postal Code:', style: 'tableLabel' },
            ],
            [
              { text: fullAddress, style: 'fieldValue', margin: [3, 5, 3, 5] },
              { text: data.city, style: 'fieldValue', margin: [3, 5, 3, 5] },
              { text: data.state, style: 'fieldValue', margin: [3, 5, 3, 5] },
              { text: data.postalCode, style: 'fieldValue', margin: [3, 5, 3, 5] },
            ],
          ],
        },
        layout: {
          hLineWidth: (i: number) => (i === 2 ? 1 : 0),
          vLineWidth: () => 0,
          hLineColor: () => '#cccccc',
        },
        margin: [0, 0, 0, 20],
      },
      {
        text: 'Current Carrier Information',
        style: 'sectionHeader',
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              { text: 'Carrier Name:', style: 'tableLabel' },
              { text: 'Billing Telephone Number (BTN):', style: 'tableLabel' },
            ],
            [
              { text: data.currentCarrier, style: 'fieldValue', margin: [3, 5, 3, 5] },
              { text: data.billingTelephoneNumber, style: 'fieldValue', margin: [3, 5, 3, 5] },
            ],
          ],
        },
        layout: {
          hLineWidth: (i: number) => (i === 2 ? 1 : 0),
          vLineWidth: () => 0,
          hLineColor: () => '#cccccc',
        },
        margin: [0, 0, 0, 20],
      },
      {
        text: 'Numbers to Be Ported:',
        style: 'sectionHeader',
        margin: [0, 0, 0, 3],
      },
      {
        text: 'Separate with commas. For ranges, use a dash (i.e. 2163215000-2163215999).',
        style: 'hint',
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          widths: ['*'],
          body: [[{ text: phoneNumbersText, style: 'fieldValue', margin: [5, 8, 5, 8] }]],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 20],
      },
      {
        text: [
          'This Letter of Agency ("LOA") hereby authorizes release of all customer proprietary network information ("CPNI"), as defined in 47 U.S.C. §222, to Telnyx LLC. Such CPNI shall include but not be limited to customer name and number, billing records, service records and network and equipment records for the purpose of providing telecommunications or information services. This LOA will become effective on signature date and will remain in effect unless revoked in writing prior to that date.',
        ],
        style: 'legal',
        margin: [0, 0, 0, 10],
      },
      {
        ol: [
          { text: `Parties acknowledge that ${data.entityName} has obtained customer proprietary network information ("CPNI") as that term is defined in 47 U.S.C.§222.`, style: 'legal' },
          { text: `${data.entityName} authorizes Telnyx to use, disclose or access such CPNI as needed for the provision of telecommunications services to ${data.entityName}'s end user customers.`, style: 'legal' },
          { text: 'Parties acknowledge that pursuant to 47 C.F.R. §64.2005, the Company may use, disclose, or permit access to CPNI for the purpose of providing service without authorization from its customers.', style: 'legal' },
          { text: 'The Company agrees that it will not require Telnyx to use, disclose or access CPNI for any reason other than for the provision of telecommunications or information services.', style: 'legal' },
          { text: 'Telnyx agrees to take all reasonable steps to protect CPNI provided to it in compliance with 47 U.S.C. §222.', style: 'legal' },
        ],
        margin: [10, 0, 0, 20],
      },
      {
        columns: [
          {
            width: '40%',
            stack: [
              { text: 'Authorized Signature:', style: 'label', margin: [0, 0, 0, 5] },
              {
                image: data.signatureDataUrl,
                width: 150,
                height: 50,
              },
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.5 }],
                margin: [0, 5, 0, 0],
              },
            ],
          },
          {
            width: '35%',
            stack: [
              { text: 'Print Name:', style: 'label', margin: [0, 0, 0, 5] },
              { text: data.authPersonName, style: 'fieldValue', margin: [0, 30, 0, 0] },
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 }],
                margin: [0, 5, 0, 0],
              },
            ],
          },
          {
            width: '25%',
            stack: [
              { text: 'Date:', style: 'label', margin: [0, 0, 0, 5] },
              { text: data.signatureDate, style: 'fieldValue', margin: [0, 30, 0, 0] },
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, lineWidth: 0.5 }],
                margin: [0, 5, 0, 0],
              },
            ],
          },
        ],
        margin: [0, 10, 0, 20],
      },
      {
        text: 'Please Note: For Toll Free numbers the signature is visually compared to what is on file and must match exactly',
        style: 'warning',
        alignment: 'center',
        margin: [0, 10, 0, 20],
      },
      {
        text: 'All fields must be completed. Any invalid or missing information will result in delays and/or rejected orders.',
        style: 'footer',
        alignment: 'center',
        margin: [0, 0, 0, 5],
      },
      {
        columns: [
          { text: 'Letter of Agency', style: 'footer', alignment: 'left' },
          { text: '311 W. Superior St – Suite 504 – Chicago IL 60654\n312-945-7420 – porting@telnyx.com', style: 'footer', alignment: 'center' },
          { text: 'Version 2.2 June 2017', style: 'footer', alignment: 'right' },
        ],
      },
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        color: '#1a1a1a',
      },
      sectionHeader: {
        fontSize: 11,
        bold: true,
        color: '#333333',
      },
      label: {
        fontSize: 10,
        color: '#333333',
      },
      tableLabel: {
        fontSize: 9,
        color: '#666666',
      },
      hint: {
        fontSize: 8,
        italics: true,
        color: '#666666',
      },
      fieldValue: {
        fontSize: 10,
        color: '#1a1a1a',
      },
      body: {
        fontSize: 10,
        color: '#333333',
        lineHeight: 1.3,
      },
      legal: {
        fontSize: 8,
        color: '#444444',
        lineHeight: 1.2,
      },
      warning: {
        fontSize: 9,
        italics: true,
        color: '#666666',
      },
      footer: {
        fontSize: 8,
        color: '#666666',
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
