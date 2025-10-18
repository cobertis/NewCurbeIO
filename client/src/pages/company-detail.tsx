import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Building2, Mail, Phone, MapPin, Globe, Edit, Users, Power, Trash2, UserPlus } from "lucide-react";
import { formatPhoneDisplay } from "@/lib/phone-formatter";
import type { Company, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { formatPhoneInput, formatPhoneE164 } from "@/lib/phone-formatter";
import { useState } from "react";

const userFormSchema = insertUserSchema.omit({ password: true }).extend({
  role: z.enum(["admin", "member", "viewer"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  preferredLanguage: z.string().optional(),
  address: z.string().optional(),
  companyId: z.string(),
});

type UserForm = z.infer<typeof userFormSchema>;

export default function CompanyDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [assignPlanOpen, setAssignPlanOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const companyId = params.id;

  const { data: companyData, isLoading: isLoadingCompany } = useQuery<{ company: Company }>({
    queryKey: ["/api/companies", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch company");
      return res.json();
    },
  });

  const { data: usersData, isLoading: isLoadingUsers } = useQuery<{ users: User[] }>({
    queryKey: ["/api/users"],
  });

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: subscriptionData } = useQuery<{ subscription: any }>({
    queryKey: ["/api/subscription", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/subscription?companyId=${companyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch subscription");
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: plansData } = useQuery<{ plans: any[] }>({
    queryKey: ["/api/plans"],
  });

  const company = companyData?.company;
  const allUsers = usersData?.users || [];
  const companyUsers = allUsers.filter(user => user.companyId === companyId);
  const currentUser = sessionData?.user;

  const createUserForm = useForm<UserForm>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      dateOfBirth: "",
      preferredLanguage: "en",
      address: "",
      role: "member",
      companyId: companyId || "",
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: UserForm) => {
      const phoneE164 = data.phone ? formatPhoneE164(data.phone) : null;
      return apiRequest("POST", "/api/users", { ...data, phone: phoneE164 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setCreateUserOpen(false);
      createUserForm.reset();
      toast({
        title: "User Created",
        description: "The user has been created and will receive an activation email.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("PATCH", `/api/users/${userId}/toggle-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Status Updated",
        description: "User status has been updated successfully",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Deleted",
        description: "User has been deleted successfully",
      });
    },
  });

  const assignPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      return apiRequest("POST", `/api/companies/${companyId}/subscription`, { planId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription", companyId] });
      setAssignPlanOpen(false);
      setSelectedPlanId("");
      toast({
        title: "Plan Assigned",
        description: "The plan has been successfully assigned to this company.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "superadmin":
        return { label: "Super Admin", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400" };
      case "admin":
        return { label: "Admin", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400" };
      case "member":
        return { label: "Member", className: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" };
      case "viewer":
        return { label: "Viewer", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400" };
      default:
        return { label: role, className: "bg-gray-100 text-gray-800" };
    }
  };

  if (isLoadingCompany) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h2 className="text-2xl font-bold">Company Not Found</h2>
        <Button onClick={() => setLocation("/companies")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Companies
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Company Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email, Phone, Website - Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</p>
                  <p className="text-sm text-gray-900 dark:text-white truncate">{company.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {company.phone ? formatPhoneDisplay(company.phone) : "Not provided"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Website</p>
                  {company.website ? (
                    <a 
                      href={company.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block"
                    >
                      {company.website}
                    </a>
                  ) : (
                    <p className="text-sm text-gray-900 dark:text-white">Not provided</p>
                  )}
                </div>
              </div>
            </div>

            {/* Address Section */}
            {(company.address || company.city || company.state || company.postalCode || company.country) && (
              <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                {/* Street Address */}
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Address</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {company.address || "Not provided"}
                    </p>
                  </div>
                </div>

                {/* City, State, Zip Code */}
                {(company.city || company.state || company.postalCode) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pl-8">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">City</p>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {company.city || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">State</p>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {company.state || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Zip Code</p>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {company.postalCode || "—"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscriptionData?.subscription && plansData?.plans ? (
              <>
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current Plan</p>
                    <p className="text-lg font-semibold">
                      {plansData.plans.find(p => p.id === subscriptionData.subscription.planId)?.name || "No plan"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Status: <span className="capitalize">{subscriptionData.subscription.status}</span>
                    </p>
                  </div>
                  <Button onClick={() => setAssignPlanOpen(true)} data-testid="button-change-plan">
                    Change Plan
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Current Plan</p>
                  <p className="text-lg font-semibold">No plan assigned</p>
                </div>
                <Button onClick={() => setAssignPlanOpen(true)} data-testid="button-assign-plan">
                  Assign Plan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setLocation("/companies")}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Company
            </Button>
            <Button variant="outline">
              <Users className="h-4 w-4 mr-2" />
              Manage Features
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Company Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Company Users ({companyUsers.length})
          </CardTitle>
          <Button onClick={() => setCreateUserOpen(true)} data-testid="button-create-user">
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-4 p-4 border rounded-lg">
                  <div className="w-10 h-10 bg-muted rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                    <div className="h-3 bg-muted rounded w-1/3"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : companyUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No users in this company yet. Add your first user above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      User
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      Phone
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      Role
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {companyUsers.map((user) => {
                    const roleBadge = getRoleBadge(user.role);
                    return (
                      <tr
                        key={user.id}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={user.avatar || undefined} alt={user.email} />
                              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                                {(user.firstName?.[0] || user.email.charAt(0)).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              {(user.firstName || user.lastName) ? (
                                <>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {user.firstName} {user.lastName}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {user.email}
                                  </span>
                                </>
                              ) : (
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {user.phone ? formatPhoneDisplay(user.phone) : <span className="text-gray-400 italic">No phone</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadge.className}`}>
                            {roleBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={user.isActive ? "default" : "destructive"} className="text-xs">
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleUserStatusMutation.mutate(user.id)}
                              disabled={toggleUserStatusMutation.isPending}
                              title={user.isActive ? "Disable User" : "Enable User"}
                            >
                              <Power className={`h-4 w-4 ${user.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteUserMutation.mutate(user.id)}
                              disabled={deleteUserMutation.isPending || user.id === currentUser?.id}
                              title={user.id === currentUser?.id ? "Cannot delete yourself" : "Delete User"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              Add a new user to the system.
            </DialogDescription>
          </DialogHeader>
          <Form {...createUserForm}>
            <form onSubmit={createUserForm.handleSubmit((data) => createUserMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createUserForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-create-firstName" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createUserForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-create-lastName" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createUserForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" data-testid="input-create-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createUserForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        type="tel"
                        placeholder="+1 (415) 555-2671"
                        onChange={(e) => {
                          const formatted = formatPhoneInput(e.target.value);
                          field.onChange(formatted);
                        }}
                        data-testid="input-create-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createUserForm.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} type="date" data-testid="input-create-dateOfBirth" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createUserForm.control}
                  name="preferredLanguage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Language</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-create-language">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createUserForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Office Address (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="123 Main St, City, State, ZIP" data-testid="input-create-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createUserForm.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled>
                      <FormControl>
                        <SelectTrigger data-testid="select-create-company">
                          <SelectValue placeholder="Select a company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={companyId || ""}>{company?.name}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-create-role">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateUserOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-create-user-submit">
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Assign Plan Dialog */}
      <Dialog open={assignPlanOpen} onOpenChange={setAssignPlanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Plan to Company</DialogTitle>
            <DialogDescription>
              Select a subscription plan to assign to this company. This will update the company's subscription.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Plan</label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger className="mt-2" data-testid="select-plan">
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plansData?.plans?.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - ${(plan.price / 100).toFixed(2)}/{plan.billingCycle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssignPlanOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => selectedPlanId && assignPlanMutation.mutate(selectedPlanId)} 
                disabled={!selectedPlanId || assignPlanMutation.isPending}
                data-testid="button-confirm-assign-plan"
              >
                {assignPlanMutation.isPending ? "Assigning..." : "Assign Plan"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
