import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Policy {
  id: string;
  effectiveDate: string;
  status: string;
  selectedPlan?: any;
  clientFirstName?: string;
  clientLastName?: string;
}

interface PolicyRenewalComparisonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalPolicy: Policy;
  renewedPolicy: Policy;
  plan2025: any;
  plans2026: any[];
  onRenewalComplete?: (renewedPolicyId: string) => void;
}

export function PolicyRenewalComparison({
  open,
  onOpenChange,
  originalPolicy,
  renewedPolicy,
  plan2025,
  plans2026,
  onRenewalComplete,
}: PolicyRenewalComparisonProps) {
  const { toast } = useToast();
  const [selectedPlan2026Id, setSelectedPlan2026Id] = useState<string>(
    plans2026[0]?.id || ""
  );

  const selectedPlan2026 = plans2026.find((p) => p.id === selectedPlan2026Id) || plans2026[0];

  const confirmPlanMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(
        "PATCH",
        `/api/policies/${renewedPolicy.id}/plan`,
        { selectedPlan: selectedPlan2026 }
      );
    },
    onSuccess: () => {
      toast({
        title: "Plan 2026 confirmado exitosamente",
        description: "El plan ha sido actualizado correctamente.",
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/policies/oep-stats"] });
      onOpenChange(false);
      
      // Navigate to the renewed policy
      if (onRenewalComplete) {
        onRenewalComplete(renewedPolicy.id);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error al confirmar plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: number | string | undefined) => {
    if (!value) return "$0.00";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const compareValues = (val2025: number, val2026: number) => {
    if (val2025 === val2026) return null;
    return val2026 > val2025 ? "increase" : "decrease";
  };

  const getPremiumDiff = () => {
    const premium2025 = parseFloat(plan2025?.premium || "0");
    const premium2026 = parseFloat(selectedPlan2026?.premium || "0");
    return premium2026 - premium2025;
  };

  const clientName = `${originalPolicy.clientFirstName || ""} ${originalPolicy.clientLastName || ""}`.trim() || "Cliente";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Renovación OEP 2026 - Comparar Planes</DialogTitle>
          <DialogDescription className="text-base">
            {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Policy Information Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Póliza 2025
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">ID:</span>
                  <span className="font-medium" data-testid="text-policy-2025-id">{originalPolicy.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Fecha Efectiva:</span>
                  <span className="font-medium" data-testid="text-policy-2025-date">
                    {new Date(originalPolicy.effectiveDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant="outline" data-testid="badge-policy-2025-status">
                    {originalPolicy.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Póliza 2026
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">ID:</span>
                  <span className="font-medium" data-testid="text-policy-2026-id">{renewedPolicy.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Fecha Efectiva:</span>
                  <span className="font-medium" data-testid="text-policy-2026-date">
                    {new Date(renewedPolicy.effectiveDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant="default" data-testid="badge-policy-2026-status">
                    {renewedPolicy.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Plan Comparison Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Plan 2025</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-muted-foreground">Carrier:</span>
                    <span className="font-medium text-right" data-testid="text-plan-2025-carrier">
                      {plan2025?.issuer?.name || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-muted-foreground">Plan Name:</span>
                    <span className="font-medium text-right" data-testid="text-plan-2025-name">
                      {plan2025?.marketing_name || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Metal Level:</span>
                    <Badge variant="outline" data-testid="badge-plan-2025-metal">
                      {plan2025?.metal_level || "N/A"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2 mt-2">
                    <span className="text-sm font-medium">Premium (mensual):</span>
                    <span className="font-bold text-lg" data-testid="text-plan-2025-premium">
                      {formatCurrency(plan2025?.premium)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Deductible:</span>
                    <span className="font-medium" data-testid="text-plan-2025-deductible">
                      {formatCurrency(plan2025?.deductibles?.[0]?.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Max Out of Pocket:</span>
                    <span className="font-medium" data-testid="text-plan-2025-moop">
                      {formatCurrency(plan2025?.moops?.[0]?.amount)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Plan Candidato 2026</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="mb-4">
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Seleccionar Plan:
                  </label>
                  <Select
                    value={selectedPlan2026Id}
                    onValueChange={setSelectedPlan2026Id}
                    data-testid="select-plan-2026"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans2026.map((plan) => (
                        <SelectItem 
                          key={plan.id} 
                          value={plan.id}
                          data-testid={`option-plan-2026-${plan.id}`}
                        >
                          {plan.marketing_name} - {formatCurrency(plan.premium)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-muted-foreground">Carrier:</span>
                    <span className="font-medium text-right" data-testid="text-plan-2026-carrier">
                      {selectedPlan2026?.issuer?.name || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-muted-foreground">Plan Name:</span>
                    <span className="font-medium text-right" data-testid="text-plan-2026-name">
                      {selectedPlan2026?.marketing_name || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Metal Level:</span>
                    <Badge variant="outline" data-testid="badge-plan-2026-metal">
                      {selectedPlan2026?.metal_level || "N/A"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2 mt-2">
                    <span className="text-sm font-medium">Premium (mensual):</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg" data-testid="text-plan-2026-premium">
                        {formatCurrency(selectedPlan2026?.premium)}
                      </span>
                      {(() => {
                        const diff = getPremiumDiff();
                        if (diff === 0) return null;
                        const isIncrease = diff > 0;
                        return (
                          <Badge 
                            variant={isIncrease ? "destructive" : "success"}
                            className="flex items-center gap-1"
                            data-testid="badge-premium-diff"
                          >
                            {isIncrease ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {isIncrease ? "+" : ""}{formatCurrency(Math.abs(diff))}
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Deductible:</span>
                    <span className="font-medium" data-testid="text-plan-2026-deductible">
                      {formatCurrency(selectedPlan2026?.deductibles?.[0]?.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Max Out of Pocket:</span>
                    <span className="font-medium" data-testid="text-plan-2026-moop">
                      {formatCurrency(selectedPlan2026?.moops?.[0]?.amount)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Premium Difference Alert */}
          {getPremiumDiff() !== 0 && (
            <Card className={getPremiumDiff() > 0 ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950" : "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className={`h-5 w-5 ${getPremiumDiff() > 0 ? "text-red-600" : "text-green-600"}`} />
                  <div className="flex-1">
                    <p className={`font-medium ${getPremiumDiff() > 0 ? "text-red-900 dark:text-red-100" : "text-green-900 dark:text-green-100"}`}>
                      {getPremiumDiff() > 0 ? "Aumento de Prima" : "Reducción de Prima"}
                    </p>
                    <p className={`text-sm ${getPremiumDiff() > 0 ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"}`}>
                      El plan seleccionado tiene {getPremiumDiff() > 0 ? "un aumento" : "una reducción"} de{" "}
                      <span className="font-semibold">{formatCurrency(Math.abs(getPremiumDiff()))}</span> por mes
                      comparado con el plan actual.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirmPlanMutation.isPending}
            data-testid="button-cancel-renewal"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => confirmPlanMutation.mutate()}
            disabled={confirmPlanMutation.isPending || !selectedPlan2026Id}
            data-testid="button-confirm-renewal"
          >
            {confirmPlanMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Confirmar Plan 2026
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
