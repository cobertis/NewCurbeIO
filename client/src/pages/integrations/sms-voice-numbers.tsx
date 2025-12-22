import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loading-spinner";
import { 
  Phone, 
  Mail, 
  Settings, 
  Building, 
  CreditCard, 
  Users, 
  Zap, 
  Plug, 
  User as UserIcon,
  MessageSquare,
  AlertTriangle,
  Ticket,
  ListTodo,
  DollarSign,
  Sparkles,
  ArrowLeft,
  Plus,
  Search,
  MoreHorizontal,
  PhoneForwarded,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { SiWhatsapp, SiFacebook, SiInstagram } from "react-icons/si";
import { cn } from "@/lib/utils";
import { format, addMonths } from "date-fns";
import { formatPhoneNumber, type SmsVoiceNumber } from "@/pages/sms-voice";

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  hasWarning?: boolean;
}

function NavigationLink({ item, onClick }: { item: NavigationItem; onClick: (href: string) => void }) {
  return (
    <button
      onClick={() => onClick(item.href)}
      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
        item.active && "border-l-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
      )}
    >
      <item.icon className="h-4 w-4" />
      <span className="flex-1 text-left">{item.label}</span>
      {item.hasWarning && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
    </button>
  );
}

function USFlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 18" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="18" fill="#B22234"/>
      <rect y="1.38" width="24" height="1.38" fill="white"/>
      <rect y="4.15" width="24" height="1.38" fill="white"/>
      <rect y="6.92" width="24" height="1.38" fill="white"/>
      <rect y="9.69" width="24" height="1.38" fill="white"/>
      <rect y="12.46" width="24" height="1.38" fill="white"/>
      <rect y="15.23" width="24" height="1.38" fill="white"/>
      <rect width="9.6" height="9.69" fill="#3C3B6E"/>
    </svg>
  );
}

export default function SmsVoiceNumbers() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: numbersData, isLoading } = useQuery<{ numbers: SmsVoiceNumber[] }>({
    queryKey: ["/api/sms-voice/numbers"],
  });

  const numbers = numbersData?.numbers || [];

  const filteredNumbers = useMemo(() => {
    if (!searchQuery.trim()) return numbers;
    const query = searchQuery.toLowerCase();
    return numbers.filter(n => 
      n.phoneNumber.toLowerCase().includes(query) ||
      n.displayName?.toLowerCase().includes(query) ||
      formatPhoneNumber(n.phoneNumber).toLowerCase().includes(query)
    );
  }, [numbers, searchQuery]);

  const totalNumbers = filteredNumbers.length;
  const totalPages = Math.ceil(totalNumbers / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalNumbers);
  const paginatedNumbers = filteredNumbers.slice(startIndex, endIndex);

  const menuItems: { channels: NavigationItem[]; features: NavigationItem[]; administration: NavigationItem[] } = {
    channels: [
      { label: "SMS & voice", href: "/integrations/sms-voice", icon: Phone, active: true },
      { label: "Email", href: "/settings/email", icon: Mail },
      { label: "Chat widget", href: "/integrations", icon: MessageSquare },
      { label: "WhatsApp", href: "/integrations", icon: SiWhatsapp },
      { label: "Facebook", href: "/integrations", icon: SiFacebook },
      { label: "Instagram", href: "/integrations", icon: SiInstagram },
    ],
    features: [
      { label: "Messenger", href: "/inbox", icon: MessageSquare },
      { label: "Contacts", href: "/contacts", icon: Users },
      { label: "API & Integrations", href: "/integrations", icon: Plug },
      { label: "Email to SMS", href: "/settings/email-to-sms", icon: Mail },
      { label: "Auto-responders", href: "/campaigns", icon: Zap },
      { label: "Tickets", href: "/tickets", icon: Ticket },
      { label: "Tasks", href: "/tasks", icon: ListTodo },
      { label: "Deals", href: "/deals", icon: DollarSign },
      { label: "Point AI", href: "/ai-assistant", icon: Sparkles },
    ],
    administration: [
      { label: "Workspace", href: "/settings/company", icon: Building },
      { label: "Billing", href: "/billing", icon: CreditCard },
      { label: "My account", href: "/settings/profile", icon: UserIcon },
    ],
  };

  const handleNavigation = (href: string) => {
    setLocation(href);
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen={true} message="Loading numbers..." />;
  }

  return (
    <div className="flex gap-6" data-testid="page-sms-voice-numbers">
      <div className="w-60 shrink-0 hidden lg:block">
        <div className="sticky top-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Settings</span>
          </div>

          <div className="py-2">
            <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Channels</p>
            {menuItems.channels.map((item) => (
              <NavigationLink key={item.label} item={item} onClick={handleNavigation} />
            ))}
          </div>

          <div className="py-2">
            <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Features</p>
            {menuItems.features.map((item) => (
              <NavigationLink key={item.label} item={item} onClick={handleNavigation} />
            ))}
          </div>

          <div className="py-2 pb-3">
            <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Administration</p>
            {menuItems.administration.map((item) => (
              <NavigationLink key={item.label} item={item} onClick={handleNavigation} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/integrations/sms-voice" className="hover:text-slate-700 dark:hover:text-slate-300">
            Settings
          </Link>
          <span>&gt;</span>
          <span className="text-slate-700 dark:text-slate-300">SMS & voice</span>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100" data-testid="text-page-title">
            Numbers
          </h1>
          <Link href="/phone/buy">
            <Button size="sm" className="gap-2" data-testid="button-buy-number">
              <Plus className="h-4 w-4" />
              Buy a new number
            </Button>
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search numbers..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10 max-w-sm"
            data-testid="input-search-numbers"
          />
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            {paginatedNumbers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Phone className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                  {searchQuery ? "No matching numbers" : "No numbers yet"}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {searchQuery 
                    ? "Try adjusting your search terms." 
                    : "Purchase your first number to start sending messages."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-800">
                    <TableHead className="text-xs font-medium text-slate-500">Number</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">Label</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">Price / month</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">Next renewal</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">Forward calls to</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedNumbers.map((number) => (
                    <TableRow 
                      key={number.id} 
                      className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      data-testid={`row-number-${number.id}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <USFlagIcon className="h-4 w-5 rounded-sm shadow-sm" />
                          <span data-testid={`text-phone-${number.id}`}>
                            {formatPhoneNumber(number.phoneNumber)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {number.displayName ? (
                          <span data-testid={`text-label-${number.id}`}>{number.displayName}</span>
                        ) : (
                          <button 
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm hover:underline"
                            data-testid={`button-add-label-${number.id}`}
                          >
                            Add
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400" data-testid={`text-price-${number.id}`}>
                        ${number.monthlyFee || "10.00"}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400" data-testid={`text-renewal-${number.id}`}>
                        {number.purchasedAt 
                          ? format(addMonths(new Date(number.purchasedAt), 1), "d MMM yyyy")
                          : format(addMonths(new Date(), 1), "d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-7 text-xs"
                          data-testid={`button-activate-forward-${number.id}`}
                        >
                          Activate
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              data-testid={`button-actions-${number.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem data-testid={`menu-edit-label-${number.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit label
                            </DropdownMenuItem>
                            <DropdownMenuItem data-testid={`menu-forward-calls-${number.id}`}>
                              <PhoneForwarded className="h-4 w-4 mr-2" />
                              Forward calls
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600 dark:text-red-400"
                              data-testid={`menu-release-${number.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Release number
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {totalNumbers > 0 && (
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-4">
              <span data-testid="text-pagination-info">
                {startIndex + 1}-{endIndex} of {totalNumbers} number{totalNumbers !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <span>Show on page</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-16 h-8" data-testid="select-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
