import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Clock, Calendar, Plus, Trash2 } from "lucide-react";

interface TimeSlot {
  start: string;
  end: string;
}

interface DayAvailability {
  enabled: boolean;
  slots: TimeSlot[];
}

interface WeeklyAvailability {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

interface AppointmentAvailability {
  appointmentDuration: number;
  bufferTime: number;
  minAdvanceTime: number;
  maxAdvanceDays: number;
  timezone: string;
  weeklyAvailability: WeeklyAvailability;
  dateOverrides: any[];
}

const DAYS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona Time" },
  { value: "America/Anchorage", label: "Alaska Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" },
];

interface AppointmentConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AppointmentConfig({ open, onOpenChange }: AppointmentConfigProps) {
  const { toast } = useToast();
  const [availability, setAvailability] = useState<AppointmentAvailability | null>(null);

  // Fetch current availability settings
  const { data, isLoading } = useQuery<{ availability: AppointmentAvailability }>({
    queryKey: ["/api/appointment-availability"],
    enabled: open,
    onSuccess: (data) => {
      setAvailability(data.availability);
    },
  });

  // Update availability mutation
  const updateMutation = useMutation({
    mutationFn: async (updatedAvailability: AppointmentAvailability) => {
      return apiRequest("/api/appointment-availability", {
        method: "PUT",
        body: JSON.stringify(updatedAvailability),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-availability"] });
      toast({
        description: "Configuración de disponibilidad actualizada exitosamente",
        duration: 3000,
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Error al actualizar la configuración",
        duration: 3000,
      });
    },
  });

  // Handle day toggle
  const handleDayToggle = (day: string, enabled: boolean) => {
    if (!availability) return;
    
    setAvailability({
      ...availability,
      weeklyAvailability: {
        ...availability.weeklyAvailability,
        [day]: {
          ...availability.weeklyAvailability[day as keyof WeeklyAvailability],
          enabled,
        },
      },
    });
  };

  // Handle time slot change
  const handleSlotChange = (day: string, index: number, field: 'start' | 'end', value: string) => {
    if (!availability) return;
    
    const dayAvailability = availability.weeklyAvailability[day as keyof WeeklyAvailability];
    const newSlots = [...dayAvailability.slots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    
    setAvailability({
      ...availability,
      weeklyAvailability: {
        ...availability.weeklyAvailability,
        [day]: {
          ...dayAvailability,
          slots: newSlots,
        },
      },
    });
  };

  // Add time slot
  const handleAddSlot = (day: string) => {
    if (!availability) return;
    
    const dayAvailability = availability.weeklyAvailability[day as keyof WeeklyAvailability];
    
    setAvailability({
      ...availability,
      weeklyAvailability: {
        ...availability.weeklyAvailability,
        [day]: {
          ...dayAvailability,
          slots: [...dayAvailability.slots, { start: "09:00", end: "17:00" }],
        },
      },
    });
  };

  // Remove time slot
  const handleRemoveSlot = (day: string, index: number) => {
    if (!availability) return;
    
    const dayAvailability = availability.weeklyAvailability[day as keyof WeeklyAvailability];
    const newSlots = dayAvailability.slots.filter((_, i) => i !== index);
    
    setAvailability({
      ...availability,
      weeklyAvailability: {
        ...availability.weeklyAvailability,
        [day]: {
          ...dayAvailability,
          slots: newSlots,
        },
      },
    });
  };

  // Handle save
  const handleSave = () => {
    if (!availability) return;
    updateMutation.mutate(availability);
  };

  if (isLoading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="max-w-2xl overflow-y-auto">
          <LoadingSpinner message="Cargando configuración..." />
        </SheetContent>
      </Sheet>
    );
  }

  if (!availability) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuración de Citas
          </SheetTitle>
          <SheetDescription>
            Configura tu disponibilidad y preferencias para las citas del landing page
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* General Settings */}
          <div className="space-y-4">
            <h3 className="font-medium text-lg">Configuración General</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duración de cita</Label>
                <Select
                  value={availability.appointmentDuration.toString()}
                  onValueChange={(value) => setAvailability({ ...availability, appointmentDuration: parseInt(value) })}
                >
                  <SelectTrigger id="duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                    <SelectItem value="45">45 minutos</SelectItem>
                    <SelectItem value="60">1 hora</SelectItem>
                    <SelectItem value="90">1.5 horas</SelectItem>
                    <SelectItem value="120">2 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="buffer">Tiempo entre citas</Label>
                <Select
                  value={availability.bufferTime.toString()}
                  onValueChange={(value) => setAvailability({ ...availability, bufferTime: parseInt(value) })}
                >
                  <SelectTrigger id="buffer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sin descanso</SelectItem>
                    <SelectItem value="5">5 minutos</SelectItem>
                    <SelectItem value="10">10 minutos</SelectItem>
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="advance">Tiempo mínimo de anticipación</Label>
                <Select
                  value={availability.minAdvanceTime.toString()}
                  onValueChange={(value) => setAvailability({ ...availability, minAdvanceTime: parseInt(value) })}
                >
                  <SelectTrigger id="advance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sin restricción</SelectItem>
                    <SelectItem value="60">1 hora</SelectItem>
                    <SelectItem value="120">2 horas</SelectItem>
                    <SelectItem value="240">4 horas</SelectItem>
                    <SelectItem value="1440">1 día</SelectItem>
                    <SelectItem value="2880">2 días</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxDays">Días de anticipación máxima</Label>
                <Input
                  id="maxDays"
                  type="number"
                  min="1"
                  max="365"
                  value={availability.maxAdvanceDays}
                  onChange={(e) => setAvailability({ ...availability, maxAdvanceDays: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Zona horaria</Label>
              <Select
                value={availability.timezone}
                onValueChange={(value) => setAvailability({ ...availability, timezone: value })}
              >
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Weekly Availability */}
          <div className="space-y-4">
            <h3 className="font-medium text-lg">Disponibilidad Semanal</h3>
            
            <div className="space-y-3">
              {DAYS.map((day) => {
                const dayAvailability = availability.weeklyAvailability[day.key as keyof WeeklyAvailability];
                
                return (
                  <div key={day.key} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${day.key}-toggle`} className="text-base cursor-pointer">
                        {day.label}
                      </Label>
                      <Switch
                        id={`${day.key}-toggle`}
                        checked={dayAvailability.enabled}
                        onCheckedChange={(checked) => handleDayToggle(day.key, checked)}
                      />
                    </div>
                    
                    {dayAvailability.enabled && (
                      <div className="space-y-2">
                        {dayAvailability.slots.map((slot, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={slot.start}
                              onChange={(e) => handleSlotChange(day.key, index, 'start', e.target.value)}
                              className="w-32"
                            />
                            <span>-</span>
                            <Input
                              type="time"
                              value={slot.end}
                              onChange={(e) => handleSlotChange(day.key, index, 'end', e.target.value)}
                              className="w-32"
                            />
                            {dayAvailability.slots.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveSlot(day.key, index)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddSlot(day.key)}
                          className="mt-2"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Agregar horario
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}