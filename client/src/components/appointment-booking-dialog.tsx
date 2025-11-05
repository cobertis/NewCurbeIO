import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, addDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
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

interface DaySlots {
  date: string;
  totalSlots: number;
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
  const [view, setView] = useState<"calendar" | "form" | "success">("calendar");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const { toast } = useToast();

  const today = startOfDay(new Date());
  const weekDates = Array.from({ length: 5 }, (_, i) => addDays(today, i + weekOffset * 5));

  // Fetch available slots for each day
  const { data: slotsData, isLoading: slotsLoading } = useQuery<TimeSlot[]>({
    queryKey: ["/api/landing/appointments/slots", landingPageId, selectedDate],
    enabled: !!selectedDate,
    queryFn: async () => {
      const res = await fetch(
        `/api/landing/appointments/slots?landingPageId=${landingPageId}&date=${selectedDate}&duration=30`
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
          appointmentDate: selectedDate,
          appointmentTime: selectedTime,
          notes: formData.notes,
          status: "pending",
        }),
      });
      if (!res.ok) throw new Error("Failed to book appointment");
      return res.json();
    },
    onSuccess: () => {
      setView("success");
      queryClient.invalidateQueries({ queryKey: ["/api/landing/appointments/slots"] });
      setTimeout(() => {
        resetForm();
        onOpenChange(false);
      }, 3000);
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
    setView("calendar");
    setSelectedDate("");
    setSelectedTime("");
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      notes: "",
    });
    setWeekOffset(0);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setFormData({ ...formData, phone: formatted });
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(format(date, "yyyy-MM-dd"));
    setSelectedTime("");
  };

  const handleTimeClick = (time: string) => {
    setSelectedTime(time);
    setView("form");
  };

  const handleBooking = () => {
    if (!formData.fullName.trim() || !formData.email.trim() || stripPhoneFormatting(formData.phone).length !== 10) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor completa todos los campos correctamente.",
        duration: 3000,
      });
      return;
    }
    bookingMutation.mutate();
  };

  const availableSlots = slotsData?.filter(slot => slot.available) || [];
  const selectedDayFormatted = selectedDate ? format(new Date(selectedDate + 'T00:00:00'), "EEEE, d 'de' MMMM", { locale: es }) : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="appointment-dialog">
        {view === "calendar" && (
          <>
            <DialogHeader className="space-y-3 pb-4">
              <DialogTitle className="text-2xl font-semibold" data-testid="dialog-title">
                Llamada de 30 minutos con {agentName}
              </DialogTitle>
              <p className="text-sm text-gray-600">
                Agenda una llamada rápida para discutir tus necesidades. Te mostraremos cómo podemos ayudarte.
              </p>
            </DialogHeader>

            {/* Month selector */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">
                {format(weekDates[0], "MMMM yyyy", { locale: es })}
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                  disabled={weekOffset === 0}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setWeekOffset(weekOffset + 1)}
                  className="h-8 w-8"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 5-day calendar */}
            <div className="grid grid-cols-5 gap-2 mb-6">
              {weekDates.map((date) => {
                const dateStr = format(date, "yyyy-MM-dd");
                const isSelected = selectedDate === dateStr;
                const isToday = format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
                
                return (
                  <button
                    key={dateStr}
                    onClick={() => handleDateClick(date)}
                    className={`
                      p-3 rounded-lg border-2 transition-all text-center
                      ${isSelected 
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20" 
                        : "border-gray-200 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }
                    `}
                    data-testid={`date-${dateStr}`}
                  >
                    <div className="text-xs font-medium text-gray-500 uppercase mb-1">
                      {format(date, "EEE", { locale: es })}
                    </div>
                    <div className={`text-2xl font-semibold mb-1 ${isSelected ? "text-blue-600" : "text-gray-900 dark:text-white"}`}>
                      {format(date, "d")}
                    </div>
                    {isToday && (
                      <div className="text-xs text-blue-600 font-medium">Hoy</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Time slots for selected date */}
            {selectedDate && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-base capitalize">{selectedDayFormatted}</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>30 min</span>
                  </div>
                </div>

                {slotsLoading ? (
                  <div className="py-8">
                    <LoadingSpinner message="Cargando horarios..." fullScreen={false} />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay horarios disponibles para este día.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot.time}
                        onClick={() => handleTimeClick(slot.time)}
                        variant="outline"
                        className="h-12 font-medium hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/20"
                        data-testid={`time-${slot.time}`}
                      >
                        {slot.time}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {view === "form" && (
          <>
            <DialogHeader>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView("calendar")}
                className="w-fit mb-2"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
              <DialogTitle className="text-xl font-semibold" data-testid="dialog-title">
                Ingresa tus datos
              </DialogTitle>
              <p className="text-sm text-gray-600">
                {selectedDayFormatted} a las {selectedTime}
              </p>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Nombre completo *</label>
                <Input
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Juan Pérez"
                  data-testid="input-fullname"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Correo electrónico *</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="juan@ejemplo.com"
                  data-testid="input-email"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Teléfono *</label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                  data-testid="input-phone"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Notas (opcional)</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="¿Algo que debamos saber?"
                  rows={3}
                  data-testid="input-notes"
                />
              </div>

              <Button
                onClick={handleBooking}
                disabled={bookingMutation.isPending}
                className="w-full h-12 text-base font-semibold"
                data-testid="button-confirm-booking"
              >
                {bookingMutation.isPending ? "Agendando..." : "Agendar cita"}
              </Button>
            </div>
          </>
        )}

        {view === "success" && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-2">¡Cita agendada!</h3>
            <p className="text-gray-600 mb-1">
              {selectedDayFormatted} a las {selectedTime}
            </p>
            <p className="text-sm text-gray-500">
              Te enviaremos una confirmación por email.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
