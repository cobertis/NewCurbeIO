import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface AppointmentBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landingPageId: number;
  agentName: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

function formatPhoneInput(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  
  if (cleaned.length === 0) return "";
  if (cleaned.length <= 3) return `(${cleaned}`;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}

function stripPhoneFormatting(value: string): string {
  return value.replace(/\D/g, "");
}

export function AppointmentBookingDialog({
  open,
  onOpenChange,
  landingPageId,
  agentName,
}: AppointmentBookingDialogProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    notes: "",
    appointmentDate: "",
    appointmentTime: "",
  });
  const { toast } = useToast();

  const today = new Date();
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const { data: slotsData, isLoading: slotsLoading } = useQuery<TimeSlot[]>({
    queryKey: ["/api/landing/appointments/slots", landingPageId, formData.appointmentDate],
    enabled: step === 3 && !!formData.appointmentDate,
    queryFn: async () => {
      const res = await fetch(
        `/api/landing/appointments/slots?landingPageId=${landingPageId}&date=${formData.appointmentDate}&duration=30`
      );
      if (!res.ok) throw new Error("Failed to fetch slots");
      return res.json();
    },
  });

  const bookingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/landing/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          landingPageId,
          fullName: formData.fullName,
          email: formData.email,
          phone: stripPhoneFormatting(formData.phone),
          appointmentDate: formData.appointmentDate,
          appointmentTime: formData.appointmentTime,
          notes: formData.notes,
          status: "pending",
        }),
      });
      if (!res.ok) throw new Error("Failed to book appointment");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "¡Cita agendada!",
        description: "Te enviaremos una confirmación por email.",
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/landing/appointments/slots"] });
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo agendar la cita. Intenta de nuevo.",
        duration: 3000,
      });
    },
  });

  const resetForm = () => {
    setStep(1);
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      notes: "",
      appointmentDate: "",
      appointmentTime: "",
    });
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const isStep1Valid = () => {
    return (
      formData.fullName.trim() !== "" &&
      formData.email.trim() !== "" &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
      stripPhoneFormatting(formData.phone).length === 10
    );
  };

  const isStep2Valid = () => {
    return formData.appointmentDate !== "";
  };

  const isStep3Valid = () => {
    return formData.appointmentTime !== "";
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setFormData({ ...formData, phone: formatted });
  };

  const handleNext = () => {
    if (step === 1 && isStep1Valid()) setStep(2);
    else if (step === 2 && isStep2Valid()) setStep(3);
    else if (step === 3 && isStep3Valid()) setStep(4);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleConfirm = () => {
    bookingMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="appointment-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold" data-testid="dialog-title">
            {step === 1 && "Información de contacto"}
            {step === 2 && "Selecciona una fecha"}
            {step === 3 && "Selecciona un horario"}
            {step === 4 && "Confirma tu cita"}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="Nombre completo"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full"
                  data-testid="input-fullname"
                />
              </div>
              <div>
                <Input
                  type="email"
                  placeholder="Correo electrónico"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full"
                  data-testid="input-email"
                />
              </div>
              <div>
                <Input
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  className="w-full"
                  maxLength={14}
                  data-testid="input-phone"
                />
              </div>
              <div>
                <Textarea
                  placeholder="¿Algo que debamos saber?"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full resize-none"
                  rows={3}
                  data-testid="input-notes"
                />
              </div>
              <Button
                onClick={handleNext}
                disabled={!isStep1Valid()}
                className="w-full"
                data-testid="button-next-step1"
              >
                Continuar →
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-2">
                {weekDates.map((date) => {
                  const dateStr = format(date, "yyyy-MM-dd");
                  const isSelected = formData.appointmentDate === dateStr;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setFormData({ ...formData, appointmentDate: dateStr })}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all hover:border-primary ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                      data-testid={`date-${dateStr}`}
                    >
                      <span className="text-xs font-medium text-gray-600">
                        {format(date, "EEE", { locale: es })}
                      </span>
                      <span className="text-lg font-bold mt-1">
                        {format(date, "d")}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-back-step2"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Atrás
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!isStep2Valid()}
                  className="flex-1"
                  data-testid="button-next-step2"
                >
                  Ver horarios →
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {slotsLoading ? (
                <div className="py-8">
                  <LoadingSpinner message="Cargando horarios..." fullScreen={false} />
                </div>
              ) : slotsData && slotsData.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {slotsData.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() =>
                        slot.available &&
                        setFormData({ ...formData, appointmentTime: slot.time })
                      }
                      disabled={!slot.available}
                      className={`p-3 rounded-lg border-2 font-medium transition-all ${
                        formData.appointmentTime === slot.time
                          ? "border-primary bg-primary/10"
                          : slot.available
                          ? "border-gray-200 hover:border-primary hover:bg-gray-50"
                          : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                      }`}
                      data-testid={`timeslot-${slot.time}`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <p>No hay horarios disponibles para esta fecha.</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-back-step3"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Atrás
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!isStep3Valid()}
                  className="flex-1"
                  data-testid="button-next-step3"
                >
                  Confirmar cita →
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Cita con</p>
                  <p className="font-semibold text-lg" data-testid="summary-agent">
                    {agentName}
                  </p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm text-gray-600">Fecha</p>
                  <p className="font-medium" data-testid="summary-date">
                    {formData.appointmentDate &&
                      format(new Date(formData.appointmentDate + "T00:00:00"), "EEEE, d 'de' MMMM", {
                        locale: es,
                      })}
                  </p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm text-gray-600">Hora</p>
                  <p className="font-medium" data-testid="summary-time">
                    {formData.appointmentTime}
                  </p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm text-gray-600">Contacto</p>
                  <p className="font-medium" data-testid="summary-contact">
                    {formData.fullName}
                  </p>
                  <p className="text-sm text-gray-600" data-testid="summary-email">
                    {formData.email}
                  </p>
                  <p className="text-sm text-gray-600" data-testid="summary-phone">
                    {formData.phone}
                  </p>
                </div>
                {formData.notes && (
                  <div className="border-t pt-3">
                    <p className="text-sm text-gray-600">Notas</p>
                    <p className="text-sm" data-testid="summary-notes">
                      {formData.notes}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-back-step4"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Editar
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={bookingMutation.isPending}
                  className="flex-1"
                  data-testid="button-confirm"
                >
                  {bookingMutation.isPending ? "Agendando..." : "Agendar cita"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
