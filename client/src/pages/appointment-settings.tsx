import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Calendar, Plus, Trash2 } from "lucide-react";
import { useLocation } from "wouter";

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
  // America - USA
  { value: "America/New_York", label: "(UTC-05:00) EST, New York, Toronto", category: "America - USA" },
  { value: "America/Chicago", label: "(UTC-06:00) CST, Chicago, Mexico City", category: "America - USA" },
  { value: "America/Denver", label: "(UTC-07:00) MST, Denver, Phoenix", category: "America - USA" },
  { value: "America/Los_Angeles", label: "(UTC-08:00) PST, Los Angeles, Vancouver", category: "America - USA" },
  { value: "America/Anchorage", label: "(UTC-09:00) AKST, Anchorage", category: "America - USA" },
  { value: "Pacific/Honolulu", label: "(UTC-10:00) HST, Honolulu", category: "America - USA" },
  
  // Central and South America
  { value: "America/Argentina/Buenos_Aires", label: "(UTC-03:00) ART, Buenos Aires", category: "Central and South America" },
  { value: "America/Sao_Paulo", label: "(UTC-03:00) BRT, São Paulo, Rio de Janeiro", category: "Central and South America" },
  { value: "America/Santiago", label: "(UTC-03:00) CLT, Santiago", category: "Central and South America" },
  { value: "America/Bogota", label: "(UTC-05:00) COT, Bogotá", category: "Central and South America" },
  { value: "America/Lima", label: "(UTC-05:00) PET, Lima", category: "Central and South America" },
  { value: "America/Caracas", label: "(UTC-04:00) AST, Caracas", category: "Central and South America" },
  
  // Europe
  { value: "Europe/London", label: "(UTC+00:00) GMT, London, Dublin", category: "Europe" },
  { value: "Europe/Paris", label: "(UTC+01:00) CET, Paris, Madrid, Berlin", category: "Europe" },
  { value: "Europe/Istanbul", label: "(UTC+02:00) EET, Istanbul, Athens, Cairo", category: "Europe" },
  { value: "Europe/Moscow", label: "(UTC+03:00) MSK, Moscow, Saint Petersburg", category: "Europe" },
  
  // Africa
  { value: "Africa/Lagos", label: "(UTC+01:00) WAT, Lagos, Kinshasa", category: "Africa" },
  { value: "Africa/Johannesburg", label: "(UTC+02:00) SAST, Johannesburg, Cape Town", category: "Africa" },
  { value: "Africa/Nairobi", label: "(UTC+03:00) EAT, Nairobi, Addis Ababa", category: "Africa" },
  
  // Asia
  { value: "Asia/Kolkata", label: "(UTC+05:30) IST, Kolkata, New Delhi, Mumbai", category: "Asia" },
  { value: "Asia/Jakarta", label: "(UTC+07:00) WIB, Jakarta, Bangkok", category: "Asia" },
  { value: "Asia/Shanghai", label: "(UTC+08:00) CST, Shanghai, Beijing, Hong Kong", category: "Asia" },
  { value: "Asia/Hong_Kong", label: "(UTC+08:00) HKT, Hong Kong", category: "Asia" },
  { value: "Asia/Singapore", label: "(UTC+08:00) SGT, Singapore", category: "Asia" },
  { value: "Asia/Tokyo", label: "(UTC+09:00) JST, Tokyo, Osaka", category: "Asia" },
  { value: "Asia/Seoul", label: "(UTC+09:00) KST, Seoul", category: "Asia" },
  { value: "Asia/Manila", label: "(UTC+08:00) PHT, Manila", category: "Asia" },
  
  // Australia and Pacific
  { value: "Australia/Adelaide", label: "(UTC+09:30) ACST, Adelaide, Darwin", category: "Australia and Pacific" },
  { value: "Australia/Sydney", label: "(UTC+10:00) AEST, Sydney, Melbourne", category: "Australia and Pacific" },
  { value: "Pacific/Auckland", label: "(UTC+12:00) NZST, Auckland, Wellington", category: "Australia and Pacific" },
  { value: "Pacific/Chatham", label: "(UTC+12:45) Chatham Islands", category: "Australia and Pacific" },
  { value: "Pacific/Apia", label: "(UTC+13:00) Samoa, Apia", category: "Australia and Pacific" },
  { value: "Pacific/Kiritimati", label: "(UTC+14:00) Line Islands, Kiritimati", category: "Australia and Pacific" },
  
  // Middle East
  { value: "Asia/Riyadh", label: "(UTC+03:00) AST, Riyadh, Kuwait, Baghdad", category: "Middle East" },
  { value: "Asia/Dubai", label: "(UTC+04:00) GST, Dubai, Abu Dhabi", category: "Middle East" },
  
  // UTC
  { value: "UTC", label: "(UTC+00:00) UTC, Greenwich", category: "UTC (Coordinated Universal Time)" },
];

export default function AppointmentSettings() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [availability, setAvailability] = useState<AppointmentAvailability | null>(null);

  // Fetch current availability settings
  const { data, isLoading } = useQuery<{ availability: AppointmentAvailability }>({
    queryKey: ["/api/appointment-availability"],
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

  // Handle slot change
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

  // Handle add slot
  const handleAddSlot = (day: string) => {
    if (!availability) return;
    
    const dayAvailability = availability.weeklyAvailability[day as keyof WeeklyAvailability];
    const lastSlot = dayAvailability.slots[dayAvailability.slots.length - 1];
    const newSlot = lastSlot ? { start: lastSlot.end, end: '17:00' } : { start: '09:00', end: '17:00' };
    
    setAvailability({
      ...availability,
      weeklyAvailability: {
        ...availability.weeklyAvailability,
        [day]: {
          ...dayAvailability,
          slots: [...dayAvailability.slots, newSlot],
        },
      },
    });
  };

  // Handle remove slot
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
    return <LoadingSpinner message="Loading settings..." />;
  }

  if (!availability) return null;

  return (
    <div className="flex flex-col gap-4 min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="space-y-4">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  General Settings
                </CardTitle>
                <CardDescription>
                  Configure your availability and preferences for landing page appointments
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="duration">Appointment Duration</Label>
              <Select
                value={availability.appointmentDuration.toString()}
                onValueChange={(value) => setAvailability({ ...availability, appointmentDuration: parseInt(value) })}
              >
                <SelectTrigger id="duration" data-testid="select-appointment-duration">
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
                <SelectTrigger id="buffer" data-testid="select-buffer-time">
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
                <SelectTrigger id="advance" data-testid="select-min-advance-time">
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
                data-testid="input-max-advance-days"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={availability.timezone}
              onValueChange={(value) => setAvailability({ ...availability, timezone: value })}
            >
              <SelectTrigger id="timezone" data-testid="select-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">America - USA</div>
                {TIMEZONES.filter(tz => tz.category === "America - USA").map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Central and South America</div>
                {TIMEZONES.filter(tz => tz.category === "Central and South America").map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Europe</div>
                {TIMEZONES.filter(tz => tz.category === "Europe").map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Africa</div>
                {TIMEZONES.filter(tz => tz.category === "Africa").map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Asia</div>
                {TIMEZONES.filter(tz => tz.category === "Asia").map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Australia and Pacific</div>
                {TIMEZONES.filter(tz => tz.category === "Australia and Pacific").map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Middle East</div>
                {TIMEZONES.filter(tz => tz.category === "Middle East").map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">UTC (Coordinated Universal Time)</div>
                {TIMEZONES.filter(tz => tz.category === "UTC (Coordinated Universal Time)").map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </CardContent>
        </Card>

        {/* Weekly Availability */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Weekly Schedule
            </CardTitle>
            <CardDescription>
              Set your available hours for each day of the week
            </CardDescription>
          </CardHeader>
          <CardContent>
          
          <div className="space-y-4">
            {DAYS.map((day) => {
              const dayAvailability = availability.weeklyAvailability[day.key as keyof WeeklyAvailability];
              
              return (
                <div key={day.key} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`${day.key}-toggle`} className="text-base cursor-pointer font-medium">
                      {day.label}
                    </Label>
                    <Switch
                      id={`${day.key}-toggle`}
                      checked={dayAvailability.enabled}
                      onCheckedChange={(checked) => handleDayToggle(day.key, checked)}
                      data-testid={`switch-${day.key}`}
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
                            data-testid={`input-${day.key}-slot-${index}-start`}
                          />
                          <span className="text-muted-foreground">-</span>
                          <Input
                            type="time"
                            value={slot.end}
                            onChange={(e) => handleSlotChange(day.key, index, 'end', e.target.value)}
                            className="w-32"
                            data-testid={`input-${day.key}-slot-${index}-end`}
                          />
                          {dayAvailability.slots.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveSlot(day.key, index)}
                              data-testid={`button-remove-slot-${day.key}-${index}`}
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
                        data-testid={`button-add-slot-${day.key}`}
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
          </CardContent>
          <div className="flex justify-end gap-3 pt-0">
            <Button
              variant="outline"
              onClick={() => setLocation("/calendar")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              data-testid="button-save-settings"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
