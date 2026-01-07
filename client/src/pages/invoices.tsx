import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, Download, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import type { Invoice, Company } from "@shared/schema";

export default function InvoicesPage() {
  const { data: sessionData } = useQuery<{ user: { id: string; email: string; role: string; companyId: string | null } }>({
    queryKey: ["/api/session"],
  });

  const user = sessionData?.user;
  const isSuperadmin = user?.role === "superadmin";

  // Fetch invoices - superadmin gets all, others get their company's
  const { data, isLoading } = useQuery<{ invoices: Invoice[] }>({
    queryKey: isSuperadmin ? ["/api/invoices"] : ["/api/invoices", { companyId: user?.companyId }],
    enabled: !!user?.companyId || isSuperadmin,
  });

  // Fetch all companies for superadmin to show company names
  const { data: companiesData } = useQuery<{ companies: Company[] }>({
    queryKey: ["/api/companies"],
    enabled: isSuperadmin,
  });

  const invoices = data?.invoices || [];
  const companies = companiesData?.companies || [];
  
  // Create a map of companyId to company name for quick lookup
  const companyMap = companies.reduce((acc, company) => {
    acc[company.id] = company.name;
    return acc;
  }, {} as Record<string, string>);

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "paid":
        return "default";
      case "open":
        return "secondary";
      case "void":
      case "uncollectible":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Loading invoices...</p>
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No invoices found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Invoice History</CardTitle>
            <CardDescription>
              {isSuperadmin ? "All invoices from all companies" : "Your billing invoices and receipts"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {isSuperadmin && <TableHead>Company</TableHead>}
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                    {isSuperadmin && (
                      <TableCell className="font-medium" data-testid={`cell-company-${invoice.id}`}>
                        {companyMap[invoice.companyId] || "Unknown"}
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{format(new Date(invoice.invoiceDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      ${(invoice.total / 100).toFixed(2)} {invoice.currency.toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(invoice.status)} className="capitalize">
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {invoice.stripeHostedInvoiceUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            data-testid={`button-view-invoice-${invoice.id}`}
                          >
                            <a
                              href={invoice.stripeHostedInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View
                            </a>
                          </Button>
                        )}
                        {invoice.stripeInvoicePdf && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            data-testid={`button-download-invoice-${invoice.id}`}
                          >
                            <a
                              href={invoice.stripeInvoicePdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                            >
                              <Download className="h-4 w-4 mr-1" />
                              PDF
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
