import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { User as UserIcon, Building2, Bell, Shield, Mail, Pencil, Phone as PhoneIcon, AtSign, Briefcase } from "lucide-react";
import type { User, CompanySettings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { EmailTemplatesManager } from "@/components/email-templates-manager";
import { formatPhoneDisplay, formatPhoneE164, formatPhoneInput } from "@/lib/phone-formatter";

export default function Settings() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  const { data: userData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: preferencesData } = useQuery<{ preferences: any }>({
    queryKey: ["/api/settings/preferences"],
  });

  const { data: companySettingsData } = useQuery<{ settings: CompanySettings }>({
    queryKey: ["/api/settings/company"],
    enabled: userData?.user?.role === "admin" || userData?.user?.role === "superadmin",
  });

  const { data: subscriptionData } = useQuery<{ subscription: any }>({
    queryKey: ["/api/billing/subscription"],
  });

  const { data: plansData } = useQuery<{ plans: any[] }>({
    queryKey: ["/api/plans"],
  });

  const [emailTestAddress, setEmailTestAddress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const user = userData?.user;

  // Fetch company data if user has a companyId
  const { data: companyData } = useQuery<{ company: any }>({
    queryKey: ["/api/companies", user?.companyId],
    enabled: !!user?.companyId,
  });
  const isSuperAdmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Get current plan name
  const getCurrentPlanName = () => {
    if (!subscriptionData?.subscription) return "Free";
    const subscription = subscriptionData.subscription;
    
    // If subscription has plan object
    if (subscription.plan?.name) {
      return subscription.plan.name;
    }
    
    // Otherwise find plan by ID
    if (subscription.planId && plansData?.plans) {
      const plan = plansData.plans.find((p: any) => p.id === subscription.planId);
      return plan?.name || "Free";
    }
    
    return "Free";
  };

  // Determine active tab from URL
  const getCurrentTab = () => {
    if (location === "/settings" || location === "/settings/profile") return "profile";
    if (location === "/settings/preferences") return "preferences";
    if (location === "/settings/company") return "company";
    if (location === "/settings/system") return "system";
    if (location === "/settings/security") return "security";
    return "profile"; // default
  };

  const activeTab = getCurrentTab();

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  // Update form when user data changes
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone ? formatPhoneDisplay(user.phone) : "",
      });
    }
  }, [user]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string; phone?: string }) => {
      // Convert phone to E.164 format before sending
      const dataToSend = {
        ...data,
        phone: data.phone ? formatPhoneE164(data.phone) : undefined,
      };
      return apiRequest("PATCH", "/api/settings/profile", dataToSend);
    },
    onSuccess: () => {
      // Invalidate both session and users cache to keep data synced
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Perfil actualizado",
        description: "Tu perfil ha sido actualizado exitosamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el perfil.",
        variant: "destructive",
      });
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", "/api/settings/preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      toast({
        title: "Preferencias actualizadas",
        description: "Tus preferencias han sido guardadas.",
      });
    },
  });

  // Send test email mutation
  const sendTestEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest("POST", "/api/email/send-test", { to: email });
    },
    onSuccess: () => {
      toast({
        title: "Email de prueba enviado",
        description: "Revisa tu bandeja de entrada.",
      });
      setEmailTestAddress("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar el email de prueba. Verifica la configuración SMTP.",
        variant: "destructive",
      });
    },
  });

  const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileForm);
  };

  const handleSendTestEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailTestAddress) {
      sendTestEmailMutation.mutate(emailTestAddress);
    }
  };

  // Update avatar mutation
  const updateAvatarMutation = useMutation({
    mutationFn: async (avatar: string) => {
      const response = await apiRequest("PATCH", "/api/settings/profile", { avatar });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      toast({
        title: "Éxito",
        description: "Foto de perfil actualizada exitosamente",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar la foto de perfil",
      });
    },
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Archivo inválido",
        description: "Por favor selecciona un archivo de imagen (JPG, PNG, GIF, etc.)",
      });
      return;
    }

    // Validar tamaño (máx 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "Archivo muy grande",
        description: "Por favor selecciona una imagen menor a 5MB",
      });
      return;
    }

    // Leer archivo y convertir a data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      updateAvatarMutation.mutate(result);
    };
    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo leer el archivo de imagen",
      });
    };
    reader.readAsDataURL(file);
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return "U";
    const firstInitial = user.firstName?.[0] || "";
    const lastInitial = user.lastName?.[0] || "";
    return (firstInitial + lastInitial).toUpperCase() || "U";
  };

  // Get role display text
  const getRoleDisplay = () => {
    if (!user?.role) return "Usuario";
    const roleMap: { [key: string]: string } = {
      superadmin: "Super Administrador",
      admin: "Administrador",
      user: "Usuario",
    };
    return roleMap[user.role] || user.role;
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Profile Card */}
        <div className="lg:col-span-4 xl:col-span-3">
          <Card className="sticky top-6">
            <CardHeader className="text-center pb-4">
              <div className="flex flex-col items-center gap-4">
                <div 
                  className="relative group cursor-pointer"
                  onClick={handleAvatarClick}
                  data-testid="button-change-avatar"
                >
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={user?.avatar || ""} alt={user?.firstName || ""} />
                    <AvatarFallback className="text-2xl">{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  {/* Overlay con lápiz que aparece en hover */}
                  <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Pencil className="h-6 w-6 text-white" />
                  </div>
                  {/* Input de archivo oculto */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                <div className="text-center w-full">
                  <h2 className="text-xl font-semibold">
                    {user?.firstName} {user?.lastName}
                  </h2>
                  <Badge variant="secondary" className="mt-2">
                    {getRoleDisplay()}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 border-t">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <AtSign className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                  </div>
                </div>
                
                {user?.phone && (
                  <div className="flex items-start gap-3">
                    <PhoneIcon className="h-4 w-4 text-muted-foreground mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Teléfono</p>
                      <p className="text-sm font-medium">{formatPhoneDisplay(user.phone)}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Briefcase className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Rol</p>
                    <p className="text-sm font-medium">{getRoleDisplay()}</p>
                  </div>
                </div>

                {user?.companyId && (
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Empresa</p>
                      <p className="text-sm font-medium">{companyData?.company?.name || user.companyId}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">Activo</p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground">Plan</p>
                    <p className="text-sm font-semibold">{getCurrentPlanName()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Settings Tabs */}
        <div className="lg:col-span-8 xl:col-span-9">
          <Tabs value={activeTab} onValueChange={(value) => setLocation(`/settings/${value}`)} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 lg:w-auto">
              <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
                <UserIcon className="h-4 w-4" />
                Perfil
              </TabsTrigger>
              <TabsTrigger value="preferences" className="gap-2" data-testid="tab-preferences">
                <Bell className="h-4 w-4" />
                Preferencias
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="company" className="gap-2" data-testid="tab-company">
                  <Building2 className="h-4 w-4" />
                  Empresa
                </TabsTrigger>
              )}
              {isSuperAdmin && (
                <TabsTrigger value="system" className="gap-2" data-testid="tab-system">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
              )}
              <TabsTrigger value="security" className="gap-2" data-testid="tab-security">
                <Shield className="h-4 w-4" />
                Seguridad
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Información del Perfil</CardTitle>
                  <CardDescription>
                    Actualiza tu información personal y detalles de contacto.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Nombre</Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          value={profileForm.firstName}
                          onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                          data-testid="input-firstname"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Apellido</Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          value={profileForm.lastName}
                          onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                          data-testid="input-lastname"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        data-testid="input-email-settings"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Número de Teléfono</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="+1 (415) 555-2671"
                        value={profileForm.phone || ""}
                        onChange={(e) => {
                          const formatted = formatPhoneInput(e.target.value);
                          setProfileForm({ ...profileForm, phone: formatted });
                        }}
                        data-testid="input-phone-settings"
                      />
                      <p className="text-xs text-muted-foreground">Formato: +1 (415) 555-2671. Requerido para autenticación SMS de dos factores</p>
                    </div>
                    <Button
                      type="submit"
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      {updateProfileMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Preferencias de Notificaciones</CardTitle>
                  <CardDescription>
                    Elige qué notificaciones deseas recibir.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailNotifications" className="text-base">
                        Notificaciones por Email
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Recibe actualizaciones por email sobre la actividad de tu cuenta.
                      </p>
                    </div>
                    <Switch
                      id="emailNotifications"
                      checked={preferencesData?.preferences?.emailNotifications ?? true}
                      onCheckedChange={(checked) => {
                        updatePreferencesMutation.mutate({
                          ...preferencesData?.preferences,
                          emailNotifications: checked,
                        });
                      }}
                      disabled={updatePreferencesMutation.isPending}
                      data-testid="switch-email-notifications"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="marketingEmails" className="text-base">
                        Emails de Marketing
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Recibe emails sobre nuevas funcionalidades y actualizaciones.
                      </p>
                    </div>
                    <Switch
                      id="marketingEmails"
                      checked={preferencesData?.preferences?.marketingEmails || false}
                      onCheckedChange={(checked) => {
                        updatePreferencesMutation.mutate({
                          ...preferencesData?.preferences,
                          marketingEmails: checked,
                        });
                      }}
                      disabled={updatePreferencesMutation.isPending}
                      data-testid="switch-marketing-emails"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="invoiceAlerts" className="text-base">
                        Alertas de Facturas
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Recibe notificaciones cuando se generen nuevas facturas.
                      </p>
                    </div>
                    <Switch
                      id="invoiceAlerts"
                      checked={preferencesData?.preferences?.invoiceAlerts ?? true}
                      onCheckedChange={(checked) => {
                        updatePreferencesMutation.mutate({
                          ...preferencesData?.preferences,
                          invoiceAlerts: checked,
                        });
                      }}
                      disabled={updatePreferencesMutation.isPending}
                      data-testid="switch-invoice-alerts"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Company Settings Tab */}
            {isAdmin && (
              <TabsContent value="company" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Configuración de Empresa</CardTitle>
                    <CardDescription>
                      Gestiona la configuración y preferencias de tu empresa.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Nombre de la Empresa</Label>
                      <Input
                        value={companySettingsData?.settings?.companyId || ""}
                        disabled
                        className="bg-muted"
                        data-testid="input-company-name"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="primaryColor">Color Primario</Label>
                        <div className="flex gap-2">
                          <Input
                            id="primaryColor"
                            type="color"
                            defaultValue={companySettingsData?.settings?.primaryColor || "#2196F3"}
                            className="h-10 w-20"
                            data-testid="input-primary-color"
                          />
                          <Input
                            defaultValue={companySettingsData?.settings?.primaryColor || "#2196F3"}
                            className="flex-1"
                            readOnly
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secondaryColor">Color Secundario</Label>
                        <div className="flex gap-2">
                          <Input
                            id="secondaryColor"
                            type="color"
                            defaultValue={companySettingsData?.settings?.secondaryColor || "#1976D2"}
                            className="h-10 w-20"
                            data-testid="input-secondary-color"
                          />
                          <Input
                            defaultValue={companySettingsData?.settings?.secondaryColor || "#1976D2"}
                            className="flex-1"
                            readOnly
                          />
                        </div>
                      </div>
                    </div>
                    <Button data-testid="button-save-company">Guardar Configuración</Button>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* System Settings Tab (Superadmin only) */}
            {isSuperAdmin && (
              <TabsContent value="system" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Configuración de Email y SMTP</CardTitle>
                      <CardDescription>
                        Configura los ajustes de notificaciones por email del sistema.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div className="p-4 border border-border rounded-md bg-muted/50">
                          <h4 className="text-sm font-medium mb-2">Estado SMTP</h4>
                          <p className="text-sm text-muted-foreground mb-4">
                            Las credenciales SMTP están configuradas mediante variables de entorno.
                          </p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">SMTP Host:</span>
                              <span className="font-mono">Configurado</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">SMTP Port:</span>
                              <span className="font-mono">Configurado</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Email Remitente:</span>
                              <span className="font-mono">Configurado</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="testEmail">Probar Configuración de Email</Label>
                          <p className="text-sm text-muted-foreground mb-2">
                            Envía un email de prueba para verificar que tu configuración SMTP funciona.
                          </p>
                          <form onSubmit={handleSendTestEmail} className="flex gap-2">
                            <Input
                              id="testEmail"
                              type="email"
                              placeholder="test@example.com"
                              value={emailTestAddress}
                              onChange={(e) => setEmailTestAddress(e.target.value)}
                              data-testid="input-test-email"
                              required
                            />
                            <Button
                              type="submit"
                              disabled={sendTestEmailMutation.isPending}
                              data-testid="button-send-test-email"
                            >
                              {sendTestEmailMutation.isPending ? "Enviando..." : "Enviar Prueba"}
                            </Button>
                          </form>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Notificaciones del Sistema</CardTitle>
                      <CardDescription>
                        Configura el comportamiento de las notificaciones del sistema.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="systemNotifications" className="text-base">
                            Activar Notificaciones del Sistema
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Enviar notificaciones automáticas para eventos del sistema.
                          </p>
                        </div>
                        <Switch
                          id="systemNotifications"
                          checked={preferencesData?.preferences?.systemNotifications ?? true}
                          onCheckedChange={(checked) => {
                            updatePreferencesMutation.mutate({
                              ...preferencesData?.preferences,
                              systemNotifications: checked,
                            });
                          }}
                          disabled={updatePreferencesMutation.isPending}
                          data-testid="switch-system-notifications"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="batchNotifications" className="text-base">
                            Notificaciones en Lote
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Agrupar múltiples notificaciones en emails resumen.
                          </p>
                        </div>
                        <Switch
                          id="batchNotifications"
                          checked={preferencesData?.preferences?.batchNotifications ?? false}
                          onCheckedChange={(checked) => {
                            updatePreferencesMutation.mutate({
                              ...preferencesData?.preferences,
                              batchNotifications: checked,
                            });
                          }}
                          disabled={updatePreferencesMutation.isPending}
                          data-testid="switch-batch-notifications"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <EmailTemplatesManager />
              </TabsContent>
            )}

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cambiar Contraseña</CardTitle>
                  <CardDescription>
                    Actualiza tu contraseña para mantener tu cuenta segura.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Contraseña Actual</Label>
                      <Input
                        id="current-password"
                        type="password"
                        data-testid="input-current-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">Nueva Contraseña</Label>
                      <Input
                        id="new-password"
                        type="password"
                        data-testid="input-new-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmar Nueva Contraseña</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        data-testid="input-confirm-password"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="destructive"
                      data-testid="button-change-password"
                    >
                      Cambiar Contraseña
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Autenticación de Dos Factores</CardTitle>
                  <CardDescription>
                    Añade una capa adicional de seguridad a tu cuenta.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">SMS de Dos Factores</Label>
                      <p className="text-sm text-muted-foreground">
                        Recibe códigos de verificación por SMS.
                      </p>
                    </div>
                    <Switch data-testid="switch-2fa" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requiere un número de teléfono válido en tu perfil.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sesiones Activas</CardTitle>
                  <CardDescription>
                    Gestiona tus sesiones activas y dispositivos conectados.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-md">
                      <div>
                        <p className="font-medium">Sesión Actual</p>
                        <p className="text-sm text-muted-foreground">Este dispositivo</p>
                      </div>
                      <Button variant="outline" size="sm" data-testid="button-logout-current">
                        Cerrar Sesión
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
