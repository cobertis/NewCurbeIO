import { useState, useEffect } from "react";
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
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
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
  });

  // Sync availability state when data changes
  useEffect(() => {
    if (data?.availability) {
      setAvailability(data.availability);
    }
  }, [data]);

  // Update availability mutation
  const updateMutation = useMutation({
    mutationFn: async (updatedAvailability: AppointmentAvailability) => {
      return apiRequest("PUT", "/api/appointment-availability", updatedAvailability);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-availability"] });
      toast({
        description: "Availability settings updated successfully",
        duration: 3000,
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Error updating availability settings",
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
          <LoadingSpinner message="Loading settings..." />
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
            Appointment Settings
          </SheetTitle>
          <SheetDescription>
            Configure your availability and preferences for landing page appointments
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* General Settings */}
          <div className="space-y-4">
            <h3 className="font-medium text-lg">General Settings</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Appointment Duration</Label>
                <Select
                  value={availability.appointmentDuration.toString()}
                  onValueChange={(value) => setAvailability({ ...availability, appointmentDuration: parseInt(value) })}
                >
                  <SelectTrigger id="duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="buffer">Buffer Time Between Appointments</Label>
                <Select
                  value={availability.bufferTime.toString()}
                  onValueChange={(value) => setAvailability({ ...availability, bufferTime: parseInt(value) })}
                >
                  <SelectTrigger id="buffer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No break</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="advance">Minimum Notice Time</Label>
                <Select
                  value={availability.minAdvanceTime.toString()}
                  onValueChange={(value) => setAvailability({ ...availability, minAdvanceTime: parseInt(value) })}
                >
                  <SelectTrigger id="advance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No restriction</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                    <SelectItem value="1440">1 day</SelectItem>
                    <SelectItem value="2880">2 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxDays">Maximum Advance Booking Days</Label>
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
              <Label htmlFor="timezone">Timezone</Label>
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
            <h3 className="font-medium text-lg">Weekly Schedule</h3>
            
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
                          Add time slot
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
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}