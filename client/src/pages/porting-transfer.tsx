import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useLocation, Link, useSearch } from 'wouter';
import SignatureCanvas from 'react-signature-canvas';
import { 
  Phone, 
  CheckCircle, 
  XCircle, 
  Upload, 
  FileText, 
  Calendar,
  Building2,
  User,
  MapPin,
  AlertCircle,
  Loader2,
  Check,
  PenLine,
  Download,
  Eraser
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/loading-spinner';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

type WizardStep = 'enter-numbers' | 'check-portability' | 'create-order' | 'end-user-info' | 'upload-documents' | 'select-foc-date' | 'review-submit';

const WIZARD_STEPS: { id: WizardStep; label: string }[] = [
  { id: 'enter-numbers', label: 'Numbers' },
  { id: 'check-portability', label: 'Verify' },
  { id: 'create-order', label: 'Order' },
  { id: 'end-user-info', label: 'Info' },
  { id: 'upload-documents', label: 'Documents' },
  { id: 'select-foc-date', label: 'Date' },
  { id: 'review-submit', label: 'Review' },
];

const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' }, { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' }, { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' }, { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' }, { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' }, { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' }, { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' }, { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
];

interface PortabilityResult {
  phone_number: string;
  portable: boolean;
  fast_portable: boolean;
  not_portable_reason: string | null;
  carrier_name: string;
  phone_number_type: string;
}

interface PortingOrder {
  id: string;
  status: string;
  phone_numbers: string[];
  created_at: string;
  requirements_status: boolean;
}

interface FocWindow {
  started_at: string;
  ended_at: string;
}

const endUserInfoSchema = z.object({
  entityName: z.string().min(1, 'Entity name is required'),
  authPersonName: z.string().min(1, 'Authorized person name is required'),
  billingPhone: z.string().min(10, 'Valid phone number is required'),
  accountNumber: z.string().optional(),
  pin: z.string().optional(),
  streetAddress: z.string().min(1, 'Street address is required'),
  streetAddress2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postalCode: z.string().min(5, 'Postal code is required'),
});

type EndUserInfoFormData = z.infer<typeof endUserInfoSchema>;

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (cleaned.startsWith('+')) {
    return phone;
  }
  return `+${cleaned}`;
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

function PortingStepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between w-full mb-10">
      {WIZARD_STEPS.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2",
                  isCompleted
                    ? "bg-white dark:bg-gray-900 border-blue-600 text-blue-600"
                    : isCurrent
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500"
                )}
                data-testid={`step-indicator-${index + 1}`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium whitespace-nowrap",
                  isCompleted || isCurrent
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-400 dark:text-gray-500"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-4 mt-[-24px]",
                  isCompleted ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PortingTransfer() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const orderIdFromUrl = urlParams.get('orderId');
  const isEditMode = urlParams.get('edit') === 'true';
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>('enter-numbers');
  const [phoneNumbersInput, setPhoneNumbersInput] = useState('');
  const [isLoadingExistingOrder, setIsLoadingExistingOrder] = useState(!!orderIdFromUrl);

  const formatUsPhoneInput = (value: string): string => {
    const lines = value.split('\n');
    const formattedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const digits = line.replace(/\D/g, '');
      
      if (digits.length === 0) {
        if (line === '' && i < lines.length - 1) {
          continue;
        }
        formattedLines.push('');
      } else if (digits.length <= 3) {
        formattedLines.push(`(${digits}`);
      } else if (digits.length <= 6) {
        formattedLines.push(`(${digits.slice(0, 3)}) ${digits.slice(3)}`);
      } else if (digits.length <= 10) {
        formattedLines.push(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`);
      } else {
        const firstTen = digits.slice(0, 10);
        formattedLines.push(`(${firstTen.slice(0, 3)}) ${firstTen.slice(3, 6)}-${firstTen.slice(6, 10)}`);
        const remaining = digits.slice(10);
        if (remaining.length > 0) {
          if (remaining.length <= 3) {
            formattedLines.push(`(${remaining}`);
          } else if (remaining.length <= 6) {
            formattedLines.push(`(${remaining.slice(0, 3)}) ${remaining.slice(3)}`);
          } else {
            formattedLines.push(`(${remaining.slice(0, 3)}) ${remaining.slice(3, 6)}-${remaining.slice(6, 10)}`);
          }
        } else {
          formattedLines.push('');
        }
      }
    }
    
    return formattedLines.join('\n');
  };

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const formatted = formatUsPhoneInput(e.target.value);
    setPhoneNumbersInput(formatted);
  };
  const [parsedPhoneNumbers, setParsedPhoneNumbers] = useState<string[]>([]);
  const [portabilityResults, setPortabilityResults] = useState<PortabilityResult[]>([]);
  const [portableNumbers, setPortableNumbers] = useState<string[]>([]);
  const [portingOrder, setPortingOrder] = useState<PortingOrder | null>(null);
  const [endUserInfo, setEndUserInfo] = useState<EndUserInfoFormData | null>(null);
  const [loaFile, setLoaFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [selectedFocDate, setSelectedFocDate] = useState<string>('');
  const [focWindows, setFocWindows] = useState<FocWindow[]>([]);
  const loaInputRef = useRef<HTMLInputElement>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  const [loaDialogOpen, setLoaDialogOpen] = useState(false);
  const [loaCurrentCarrier, setLoaCurrentCarrier] = useState('');
  const [loaBillingTelephoneNumber, setLoaBillingTelephoneNumber] = useState('');
  const [isGeneratingLoa, setIsGeneratingLoa] = useState(false);
  const signatureRef = useRef<SignatureCanvas>(null);

  const endUserForm = useForm<EndUserInfoFormData>({
    resolver: zodResolver(endUserInfoSchema),
    defaultValues: {
      entityName: '',
      authPersonName: '',
      billingPhone: '',
      accountNumber: '',
      pin: '',
      streetAddress: '',
      streetAddress2: '',
      city: '',
      state: '',
      postalCode: '',
    },
  });

  const { data: existingOrderData, isLoading: isLoadingOrder } = useQuery({
    queryKey: ['/api/telnyx/porting/orders', orderIdFromUrl],
    queryFn: async () => {
      const response = await fetch(`/api/telnyx/porting/orders/${orderIdFromUrl}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch order');
      }
      return response.json();
    },
    enabled: !!orderIdFromUrl,
  });

  useEffect(() => {
    if (orderIdFromUrl && existingOrderData && !isLoadingOrder) {
      const { order, telnyxOrder } = existingOrderData;
      
      if (order) {
        const normalizedOrder = {
          ...(telnyxOrder || {}),
          id: order.telnyxPortingOrderId || order.id,
          localId: order.id,
          phone_numbers: order.phoneNumbers || [],
          statusText: typeof order.status === 'object' ? order.status.value : (order.status || 'draft'),
        };
        
        setPortingOrder(normalizedOrder as any);
        setPortableNumbers(order.phoneNumbers || []);
        
        if (order.endUserInfo) {
          const info = order.endUserInfo;
          endUserForm.reset({
            entityName: info.entityName || '',
            authPersonName: info.authPersonName || '',
            billingPhone: info.billingPhone || '',
            accountNumber: info.accountNumber || '',
            pin: info.pin || '',
            streetAddress: info.streetAddress || '',
            streetAddress2: info.extendedAddress || '',
            city: info.locality || '',
            state: info.administrativeArea || '',
            postalCode: info.postalCode || '',
          });
          setEndUserInfo({
            entityName: info.entityName || '',
            authPersonName: info.authPersonName || '',
            billingPhone: info.billingPhone || '',
            accountNumber: info.accountNumber || '',
            pin: info.pin || '',
            streetAddress: info.streetAddress || '',
            streetAddress2: info.extendedAddress || '',
            city: info.locality || '',
            state: info.administrativeArea || '',
            postalCode: info.postalCode || '',
          });
        }
        
        if (order.focDatetimeRequested) {
          setSelectedFocDate(order.focDatetimeRequested);
        }
        
        const status = order.status || 'draft';
        if (status === 'draft') {
          if (isEditMode) {
            setCurrentStep('end-user-info');
          } else if (order.endUserInfo) {
            setCurrentStep('upload-documents');
          } else if (order.phoneNumbers?.length > 0) {
            setCurrentStep('end-user-info');
          } else {
            setCurrentStep('enter-numbers');
          }
        } else {
          setCurrentStep('review-submit');
        }
      }
      
      setIsLoadingExistingOrder(false);
    }
  }, [orderIdFromUrl, existingOrderData, isLoadingOrder, isEditMode]);

  const checkPortabilityMutation = useMutation({
    mutationFn: async (phoneNumbers: string[]) => {
      return apiRequest('POST', '/api/telnyx/porting/check-portability', { phoneNumbers });
    },
    onSuccess: (data) => {
      if (data.results && Array.isArray(data.results)) {
        setPortabilityResults(data.results);
        const portable = data.results.filter((r: PortabilityResult) => r.portable).map((r: PortabilityResult) => r.phone_number);
        setPortableNumbers(portable);
        setCurrentStep('check-portability');
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to check portability',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to check portability',
        variant: 'destructive',
      });
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/telnyx/porting/orders', {
        phoneNumbers: portableNumbers,
        portabilityResults: portabilityResults.filter(r => r.portable),
      });
    },
    onSuccess: (data) => {
      if (data.order && data.telnyxOrder) {
        const normalizedOrder = {
          ...data.telnyxOrder,
          localId: data.order.id,
          statusText: typeof data.telnyxOrder.status === 'object' ? data.telnyxOrder.status.value : data.telnyxOrder.status,
        };
        setPortingOrder(normalizedOrder);
        setCurrentStep('create-order');
      } else if (data.order) {
        const normalizedOrder = {
          id: data.order.telnyxPortingOrderId || data.order.id,
          localId: data.order.id,
          statusText: typeof data.order.status === 'object' ? data.order.status.value : (data.order.status || 'draft'),
        } as any;
        setPortingOrder(normalizedOrder);
        setCurrentStep('create-order');
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to create porting order',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create porting order',
        variant: 'destructive',
      });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (data: { endUser?: any; documents?: any; focDatetime?: string }) => {
      const orderId = (portingOrder as any)?.localId || portingOrder?.id;
      return apiRequest('PATCH', `/api/telnyx/porting/orders/${orderId}`, data);
    },
    onSuccess: (data) => {
      if (data.order && data.telnyxOrder) {
        setPortingOrder({ ...data.telnyxOrder, localId: data.order.id });
      } else if (data.order) {
        setPortingOrder(prev => prev ? { ...prev, ...data.order } : data.order);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update order',
        variant: 'destructive',
      });
    },
  });

  const getFocDatesMutation = useMutation({
    mutationFn: async () => {
      const orderId = (portingOrder as any)?.localId || portingOrder?.id;
      const response = await fetch(`/api/telnyx/porting/orders/${orderId}/foc-dates`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch FOC dates');
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.focWindows) {
        setFocWindows(data.focWindows);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch available dates',
        variant: 'destructive',
      });
    },
  });

  const uploadDocumentToTelnyx = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/telnyx/porting/upload-document', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload document');
    }
    
    const data = await response.json();
    return data.documentId;
  };

  const submitOrderMutation = useMutation({
    mutationFn: async () => {
      const orderId = (portingOrder as any)?.localId || portingOrder?.id;
      
      // Upload documents first if they exist
      let loaDocumentId: string | null = null;
      let invoiceDocumentId: string | null = null;
      
      if (loaFile) {
        loaDocumentId = await uploadDocumentToTelnyx(loaFile);
      }
      
      if (invoiceFile) {
        invoiceDocumentId = await uploadDocumentToTelnyx(invoiceFile);
      }
      
      // Update order with document IDs if we have any
      if (loaDocumentId || invoiceDocumentId) {
        const documents: any = {};
        if (loaDocumentId) documents.loa = loaDocumentId;
        if (invoiceDocumentId) documents.invoice = invoiceDocumentId;
        
        await apiRequest('PATCH', `/api/telnyx/porting/orders/${orderId}`, { documents });
      }
      
      // Now submit
      return apiRequest('POST', `/api/telnyx/porting/orders/${orderId}/submit`, {});
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Porting order submitted successfully',
        });
        queryClient.invalidateQueries({ queryKey: ['/api/telnyx/porting/orders'] });
        setLocation('/getting-started');
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to submit order',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit order',
        variant: 'destructive',
      });
    },
  });

  const parseUsPhoneNumbers = (input: string): { valid: string[]; invalid: string[] } => {
    const lines = input.split(/[\n,;]+/).map(line => line.trim()).filter(Boolean);
    const valid: string[] = [];
    const invalid: string[] = [];
    
    for (const line of lines) {
      const cleaned = line.replace(/\D/g, '');
      if (cleaned.length === 10) {
        valid.push(`+1${cleaned}`);
      } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        valid.push(`+${cleaned}`);
      } else {
        invalid.push(line);
      }
    }
    
    return { valid, invalid };
  };

  const handleEnterNumbersNext = () => {
    const { valid, invalid } = parseUsPhoneNumbers(phoneNumbersInput);
    
    if (invalid.length > 0) {
      toast({
        title: 'Invalid US Phone Numbers',
        description: `The following are not valid US numbers: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? ` and ${invalid.length - 3} more` : ''}`,
        variant: 'destructive',
      });
      return;
    }
    
    if (valid.length === 0) {
      toast({
        title: 'No Numbers Entered',
        description: 'Please enter at least one valid US phone number (10 digits)',
        variant: 'destructive',
      });
      return;
    }
    
    setParsedPhoneNumbers(valid);
    checkPortabilityMutation.mutate(valid);
  };

  const handleCheckPortabilityNext = () => {
    if (portableNumbers.length === 0) {
      toast({
        title: 'No Portable Numbers',
        description: 'None of the entered numbers are portable. Please try different numbers.',
        variant: 'destructive',
      });
      return;
    }
    createOrderMutation.mutate();
  };

  const handleCreateOrderNext = () => {
    setCurrentStep('end-user-info');
  };

  const handleEndUserInfoNext = async (data: EndUserInfoFormData) => {
    setEndUserInfo(data);
    
    // Send flat structure that backend expects
    await updateOrderMutation.mutateAsync({
      endUser: {
        entityName: data.entityName,
        authPersonName: data.authPersonName,
        billingPhone: data.billingPhone,
        accountNumber: data.accountNumber || undefined,
        pin: data.pin || undefined,
        streetAddress: data.streetAddress,
        extendedAddress: data.streetAddress2 || undefined,
        locality: data.city,
        administrativeArea: data.state,
        postalCode: data.postalCode,
        countryCode: 'US',
      },
    });

    setCurrentStep('upload-documents');
  };

  const handleUploadDocumentsNext = async () => {
    setCurrentStep('select-foc-date');
    getFocDatesMutation.mutate();
  };

  const handleOpenLoaDialog = () => {
    if (portabilityResults.length > 0 && portabilityResults[0]?.carrier_name) {
      setLoaCurrentCarrier(portabilityResults[0].carrier_name);
    }
    if (endUserInfo?.billingPhone) {
      setLoaBillingTelephoneNumber(endUserInfo.billingPhone);
    }
    setLoaDialogOpen(true);
  };

  const handleClearSignature = () => {
    signatureRef.current?.clear();
  };

  const handleGenerateLoa = async () => {
    // Use form values directly to avoid null state issues
    const formData = endUserForm.getValues();
    const userInfo = endUserInfo || formData;
    
    if (!userInfo.entityName || !userInfo.authPersonName) {
      toast({
        title: 'Missing Information',
        description: 'Please complete the end user information first.',
        variant: 'destructive',
      });
      return;
    }

    if (!loaCurrentCarrier.trim()) {
      toast({
        title: 'Current Carrier Required',
        description: 'Please enter the current carrier name.',
        variant: 'destructive',
      });
      return;
    }

    if (!loaBillingTelephoneNumber.trim()) {
      toast({
        title: 'BTN Required',
        description: 'Please enter the billing telephone number.',
        variant: 'destructive',
      });
      return;
    }

    if (signatureRef.current?.isEmpty()) {
      toast({
        title: 'Signature Required',
        description: 'Please sign in the signature box.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingLoa(true);

    try {
      const signatureDataUrl = signatureRef.current?.getTrimmedCanvas().toDataURL('image/png') || '';

      const loaData = {
        entityName: userInfo.entityName,
        authPersonName: userInfo.authPersonName,
        billingPhone: userInfo.billingPhone || '',
        streetAddress: userInfo.streetAddress || '',
        streetAddress2: userInfo.streetAddress2 || '',
        city: userInfo.city || '',
        state: userInfo.state || '',
        postalCode: userInfo.postalCode || '',
        currentCarrier: loaCurrentCarrier,
        billingTelephoneNumber: loaBillingTelephoneNumber,
        phoneNumbers: portableNumbers,
        signatureDataUrl,
        signatureDate: format(new Date(), 'MMMM d, yyyy'),
      };

      console.log('[LOA] Sending data to server:', JSON.stringify(loaData, null, 2));

      const response = await fetch('/api/telnyx/porting/generate-loa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loaData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LOA] Server error:', response.status, errorText);
        throw new Error(`Failed to generate PDF: ${response.status}`);
      }

      const pdfBlob = await response.blob();
      const filename = `LOA_${userInfo.entityName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

      setLoaFile(pdfFile);
      setLoaDialogOpen(false);

      toast({
        title: 'LOA Generated',
        description: 'Your Letter of Authorization has been created and attached.',
      });

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate LOA:', error);
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate LOA. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingLoa(false);
    }
  };

  const handleSelectFocDateNext = async () => {
    if (selectedFocDate) {
      await updateOrderMutation.mutateAsync({
        focDatetime: selectedFocDate,
      });
    }
    setCurrentStep('review-submit');
  };

  const handleSubmit = () => {
    submitOrderMutation.mutate();
  };

  const goBack = () => {
    const stepIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(WIZARD_STEPS[stepIndex - 1].id);
    } else {
      setLocation('/getting-started');
    }
  };

  const currentStepIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);

  const isNextDisabled = () => {
    switch (currentStep) {
      case 'enter-numbers':
        return !phoneNumbersInput.trim() || checkPortabilityMutation.isPending;
      case 'check-portability':
        return portableNumbers.length === 0 || createOrderMutation.isPending;
      case 'create-order':
        return !portingOrder;
      case 'end-user-info':
        return updateOrderMutation.isPending;
      case 'upload-documents':
        return false;
      case 'select-foc-date':
        return updateOrderMutation.isPending;
      case 'review-submit':
        return submitOrderMutation.isPending;
      default:
        return false;
    }
  };

  const handleNext = () => {
    switch (currentStep) {
      case 'enter-numbers':
        handleEnterNumbersNext();
        break;
      case 'check-portability':
        handleCheckPortabilityNext();
        break;
      case 'create-order':
        handleCreateOrderNext();
        break;
      case 'end-user-info':
        endUserForm.handleSubmit(handleEndUserInfoNext)();
        break;
      case 'upload-documents':
        handleUploadDocumentsNext();
        break;
      case 'select-foc-date':
        handleSelectFocDateNext();
        break;
      case 'review-submit':
        handleSubmit();
        break;
    }
  };

  const isLoading = checkPortabilityMutation.isPending || 
    createOrderMutation.isPending || 
    updateOrderMutation.isPending || 
    getFocDatesMutation.isPending ||
    submitOrderMutation.isPending;

  const getCardTitle = () => {
    switch (currentStep) {
      case 'enter-numbers':
        return 'Enter your phone numbers';
      case 'check-portability':
        return 'Portability verification results';
      case 'create-order':
        return 'Porting order created';
      case 'end-user-info':
        return 'End user information';
      case 'upload-documents':
        return 'Upload required documents';
      case 'select-foc-date':
        return 'Select transfer date';
      case 'review-submit':
        return 'Review your order';
      default:
        return '';
    }
  };

  const getCardSubtitle = () => {
    switch (currentStep) {
      case 'enter-numbers':
        return 'Enter the phone numbers you want to transfer to Curbe.io';
      case 'check-portability':
        return 'We have verified which numbers can be transferred';
      case 'create-order':
        return 'Your porting order has been created successfully';
      case 'end-user-info':
        return 'Provide information about the current account holder';
      case 'upload-documents':
        return 'Upload the required documents for the transfer';
      case 'select-foc-date':
        return 'Choose when you want the transfer to complete';
      case 'review-submit':
        return 'Review your order details before submitting';
      default:
        return '';
    }
  };

  const getNextButtonText = () => {
    if (isLoading) {
      return 'Processing...';
    }
    switch (currentStep) {
      case 'enter-numbers':
        return 'Check portability';
      case 'check-portability':
        return 'Create order';
      case 'review-submit':
        return 'Submit order';
      default:
        return 'Continue';
    }
  };

  if (isLoadingExistingOrder || (orderIdFromUrl && isLoadingOrder)) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3" data-testid="text-page-title">
            Transfer your phone numbers
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            For more information about filling out this form, watch our{" "}
            <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium" data-testid="link-video-guide">
              video guide
            </a>
            {" "}or read our{" "}
            <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium" data-testid="link-support-article">
              support article
            </a>.
          </p>
        </div>

        {/* Step Indicator */}
        <PortingStepIndicator currentStep={currentStepIndex} />

        {/* Card */}
        <Card className="bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700">
          <CardContent className="p-10">
            {/* Card Header */}
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2" data-testid="text-step-title">
                {getCardTitle()}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm" data-testid="text-step-subtitle">
                {getCardSubtitle()}
              </p>
            </div>

            {/* Step Content */}
            <div className="max-w-2xl mx-auto">
              {currentStep === 'enter-numbers' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 text-right pt-2">
                      Phone Numbers
                    </Label>
                    <div>
                      <Textarea
                        data-testid="input-phone-numbers"
                        placeholder="(555) 123-4567"
                        value={phoneNumbersInput}
                        onChange={handlePhoneInputChange}
                        className="min-h-[180px] font-mono"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Type 10 digits and it will auto-format. Press Enter or keep typing for more numbers.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 'check-portability' && (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground mb-4 text-center">
                    {portableNumbers.length} of {portabilityResults.length} numbers can be transferred
                  </div>
                  
                  <div className="max-h-[350px] overflow-y-auto space-y-2">
                    {portabilityResults.map((result) => (
                      <div
                        key={result.phone_number}
                        data-testid={`portability-result-${result.phone_number}`}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border',
                          result.portable ? 'bg-background border-border' : 'bg-muted/50 border-muted'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {result.portable ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          <div>
                            <div className="font-medium">{displayPhoneNumber(result.phone_number)}</div>
                            <div className="text-sm text-muted-foreground">
                              {result.carrier_name} - {result.phone_number_type}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {result.portable ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Portable
                            </Badge>
                          ) : (
                            <div>
                              <Badge variant="outline" className="text-red-600 border-red-600">
                                Not Portable
                              </Badge>
                              {result.not_portable_reason && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {result.not_portable_reason}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {portableNumbers.length === 0 && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-medium">No portable numbers found</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        None of the entered numbers can be transferred at this time. Please go back and try different numbers.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 'create-order' && (
                <div className="space-y-4">
                  {portingOrder ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                          <CheckCircle className="h-5 w-5" />
                          <span className="font-medium">Order Created Successfully</span>
                        </div>
                        <p className="text-sm text-green-600 dark:text-green-500">
                          Your porting order has been created. Continue to provide the required information.
                        </p>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Order ID</span>
                          <span className="font-mono text-sm">{portingOrder.id}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Status</span>
                          <Badge variant="outline">{(portingOrder as any).statusText || (typeof portingOrder.status === 'object' ? (portingOrder.status as any).value : portingOrder.status)}</Badge>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Phone Numbers</span>
                          <span className="text-sm">{portingOrder.phone_numbers?.length || portableNumbers.length} numbers</span>
                        </div>
                      </div>

                      <div className="p-3 bg-muted/30 rounded-lg">
                        <div className="text-sm font-medium mb-2">Numbers to Transfer:</div>
                        <div className="flex flex-wrap gap-2">
                          {portableNumbers.map((num) => (
                            <Badge key={num} variant="secondary">{displayPhoneNumber(num)}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-8">
                      <LoadingSpinner fullScreen={false} className="h-6 w-6" />
                      <span className="ml-2 text-muted-foreground">Creating porting order...</span>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 'end-user-info' && (
                <Form {...endUserForm}>
                  <form onSubmit={endUserForm.handleSubmit(handleEndUserInfoNext)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={endUserForm.control}
                        name="entityName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              Entity Name
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                data-testid="input-entity-name"
                                placeholder="Company or individual name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={endUserForm.control}
                        name="authPersonName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Authorized Person
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                data-testid="input-auth-person"
                                placeholder="Full name of authorized person"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <FormField
                        control={endUserForm.control}
                        name="billingPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Billing Phone</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                data-testid="input-billing-phone"
                                placeholder="(555) 123-4567"
                                onChange={(e) => {
                                  const input = e.target.value.replace(/\D/g, '');
                                  let formatted = '';
                                  if (input.length > 0) {
                                    formatted = '(' + input.substring(0, 3);
                                  }
                                  if (input.length >= 3) {
                                    formatted += ') ' + input.substring(3, 6);
                                  }
                                  if (input.length >= 6) {
                                    formatted += '-' + input.substring(6, 10);
                                  }
                                  field.onChange(formatted);
                                }}
                                maxLength={14}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={endUserForm.control}
                        name="accountNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Number (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                data-testid="input-account-number"
                                placeholder="Carrier account number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={endUserForm.control}
                        name="pin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PIN (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                data-testid="input-pin"
                                placeholder="Account PIN"
                                type="password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator className="my-4" />
                    
                    <div className="flex items-center gap-2 text-sm font-medium mb-2">
                      <MapPin className="h-4 w-4" />
                      Service Address
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div className="md:col-span-3">
                        <FormField
                          control={endUserForm.control}
                          name="streetAddress"
                          render={({ field }) => (
                            <AddressAutocomplete
                              value={field.value}
                              onChange={field.onChange}
                              onAddressSelect={(address) => {
                                endUserForm.setValue('streetAddress', address.street);
                                endUserForm.setValue('city', address.city);
                                endUserForm.setValue('state', address.state);
                                endUserForm.setValue('postalCode', address.postalCode);
                              }}
                              label="Street Address"
                              placeholder="Start typing an address..."
                              testId="input-street-address"
                              error={endUserForm.formState.errors.streetAddress?.message}
                            />
                          )}
                        />
                      </div>
                      <FormField
                        control={endUserForm.control}
                        name="streetAddress2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Apt/Unit</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                data-testid="input-street-address-2"
                                placeholder="Apt #"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={endUserForm.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                data-testid="input-city"
                                placeholder="City"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={endUserForm.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-state">
                                  <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {US_STATES.map((state) => (
                                  <SelectItem key={state.value} value={state.value}>
                                    {state.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={endUserForm.control}
                        name="postalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal Code</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                data-testid="input-postal-code"
                                placeholder="12345"
                                maxLength={10}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <input type="submit" className="hidden" />
                  </form>
                </Form>
              )}

              {currentStep === 'upload-documents' && (
                <div className="space-y-6">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-medium mb-2">Required Documents</h4>
                    <p className="text-sm text-muted-foreground">
                      To complete the porting process, you need to upload:
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
                      <li>Letter of Authorization (LOA) signed by the authorized person</li>
                      <li>Recent carrier invoice showing the phone numbers to port</li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <div className="border border-dashed rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">Letter of Authorization (LOA)</div>
                            <div className="text-sm text-muted-foreground">
                              {loaFile ? loaFile.name : 'No file selected'}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={handleOpenLoaDialog}
                            data-testid="button-generate-loa"
                          >
                            <PenLine className="h-4 w-4 mr-2" />
                            Generate LOA
                          </Button>
                          <input
                            ref={loaInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            className="hidden"
                            onChange={(e) => setLoaFile(e.target.files?.[0] || null)}
                            data-testid="input-loa-file"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => loaInputRef.current?.click()}
                            data-testid="button-upload-loa"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {loaFile ? 'Change' : 'Upload'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="border border-dashed rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">Carrier Invoice</div>
                            <div className="text-sm text-muted-foreground">
                              {invoiceFile ? invoiceFile.name : 'No file selected'}
                            </div>
                          </div>
                        </div>
                        <div>
                          <input
                            ref={invoiceInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            className="hidden"
                            onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                            data-testid="input-invoice-file"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => invoiceInputRef.current?.click()}
                            data-testid="button-upload-invoice"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {invoiceFile ? 'Change' : 'Upload'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Documents can also be uploaded later via the porting order details page. 
                    Proceeding without documents may delay the porting process.
                  </p>
                </div>
              )}

              {currentStep === 'select-foc-date' && (
                <div className="space-y-4">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      FOC Date Selection
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      The FOC (Firm Order Commitment) date is when your numbers will be transferred to our system.
                      Select an available date window below.
                    </p>
                  </div>

                  {getFocDatesMutation.isPending ? (
                    <div className="flex items-center justify-center p-8">
                      <LoadingSpinner fullScreen={false} className="h-6 w-6" />
                      <span className="ml-2 text-muted-foreground">Loading available dates...</span>
                    </div>
                  ) : focWindows.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {focWindows.map((window, index) => (
                        <label
                          key={index}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                            selectedFocDate === window.started_at
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="foc-date"
                              value={window.started_at}
                              checked={selectedFocDate === window.started_at}
                              onChange={(e) => setSelectedFocDate(e.target.value)}
                              className="h-4 w-4"
                              data-testid={`radio-foc-date-${index}`}
                            />
                            <div>
                              <div className="font-medium">
                                {format(new Date(window.started_at), 'EEEE, MMMM d, yyyy')}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(window.started_at), 'h:mm a')} - {format(new Date(window.ended_at), 'h:mm a z')}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      <p>No FOC dates available yet. This typically becomes available after your order is reviewed.</p>
                      <p className="text-sm mt-2">You can proceed without selecting a date and update it later.</p>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 'review-submit' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium mb-3">Order Summary</h4>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Order ID:</span>
                          <span className="font-mono">{portingOrder?.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge variant="outline">{(portingOrder as any)?.statusText || (typeof portingOrder?.status === 'object' ? (portingOrder.status as any).value : portingOrder?.status)}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Numbers:</span>
                          <span>{portableNumbers.length} phone number(s)</span>
                        </div>
                        {selectedFocDate && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">FOC Date:</span>
                            <span>{format(new Date(selectedFocDate), 'PPP')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium mb-3">Phone Numbers</h4>
                      <div className="flex flex-wrap gap-2">
                        {portableNumbers.map((num) => (
                          <Badge key={num} variant="secondary">{displayPhoneNumber(num)}</Badge>
                        ))}
                      </div>
                    </div>

                    {endUserInfo && (
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-medium mb-3">End User Information</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="text-muted-foreground">Entity:</div>
                          <div>{endUserInfo.entityName}</div>
                          <div className="text-muted-foreground">Authorized Person:</div>
                          <div>{endUserInfo.authPersonName}</div>
                          <div className="text-muted-foreground">Billing Phone:</div>
                          <div>{endUserInfo.billingPhone}</div>
                          <div className="text-muted-foreground">Address:</div>
                          <div>
                            {endUserInfo.streetAddress}
                            {endUserInfo.streetAddress2 && `, ${endUserInfo.streetAddress2}`}
                            {`, ${endUserInfo.city}, ${endUserInfo.state} ${endUserInfo.postalCode}`}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium mb-3">Documents</h4>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          {loaFile ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>LOA: {loaFile ? loaFile.name : 'Not uploaded'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {invoiceFile ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>Invoice: {invoiceFile ? invoiceFile.name : 'Not uploaded'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex items-center justify-between mt-8">
          <span 
            onClick={goBack}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium cursor-pointer"
            data-testid="button-back"
          >
            Back
          </span>
          <Button
            className="bg-blue-600 hover:bg-blue-700 px-6"
            disabled={isNextDisabled()}
            onClick={handleNext}
            data-testid="button-next"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              getNextButtonText()
            )}
          </Button>
        </div>
      </div>

      <Dialog open={loaDialogOpen} onOpenChange={setLoaDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" />
              Generate Letter of Authorization
            </DialogTitle>
            <DialogDescription>
              Review the information below and sign to generate your LOA document.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="p-4 bg-muted/30 rounded-lg space-y-3">
              <h4 className="font-medium text-sm">Customer Information</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Entity Name:</div>
                <div>{endUserInfo?.entityName || '-'}</div>
                <div className="text-muted-foreground">Authorized Person:</div>
                <div>{endUserInfo?.authPersonName || '-'}</div>
                <div className="text-muted-foreground">Address:</div>
                <div>
                  {endUserInfo ? (
                    <>
                      {endUserInfo.streetAddress}
                      {endUserInfo.streetAddress2 && <>, {endUserInfo.streetAddress2}</>}
                      <br />
                      {endUserInfo.city}, {endUserInfo.state} {endUserInfo.postalCode}
                    </>
                  ) : '-'}
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Phone Numbers to Port</h4>
              <div className="flex flex-wrap gap-2">
                {portableNumbers.map((num) => (
                  <Badge key={num} variant="secondary">{displayPhoneNumber(num)}</Badge>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loa-current-carrier">Current Carrier *</Label>
                  <Input
                    id="loa-current-carrier"
                    placeholder="e.g., AT&T, Verizon"
                    value={loaCurrentCarrier}
                    onChange={(e) => setLoaCurrentCarrier(e.target.value)}
                    data-testid="input-loa-current-carrier"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loa-btn">Billing Telephone Number (BTN) *</Label>
                  <Input
                    id="loa-btn"
                    placeholder="(555) 123-4567"
                    value={loaBillingTelephoneNumber}
                    onChange={(e) => setLoaBillingTelephoneNumber(e.target.value)}
                    data-testid="input-loa-btn"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Signature *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSignature}
                  data-testid="button-clear-signature"
                >
                  <Eraser className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="border rounded-lg bg-white dark:bg-gray-900 p-1">
                <SignatureCanvas
                  ref={signatureRef}
                  canvasProps={{
                    className: 'w-full h-32 cursor-crosshair',
                    style: { width: '100%', height: '128px' },
                  }}
                  backgroundColor="transparent"
                  penColor="black"
                  data-testid="canvas-signature"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Sign above using your mouse or finger
              </p>
            </div>

            <div className="p-3 bg-muted/30 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-sm text-muted-foreground">Date:</span>
                <span className="text-sm font-medium ml-2">{format(new Date(), 'MMMM d, yyyy')}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLoaDialogOpen(false)}
              data-testid="button-cancel-loa"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleGenerateLoa}
              disabled={isGeneratingLoa}
              data-testid="button-create-loa"
            >
              {isGeneratingLoa ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate & Download
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
