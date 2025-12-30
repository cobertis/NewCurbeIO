import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Eye, EyeOff, ChevronDown } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const COUNTRIES = [
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸", format: "(###) ###-####", maxLen: 10 },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦", format: "(###) ###-####", maxLen: 10 },
  { code: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽", format: "## #### ####", maxLen: 10 },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧", format: "#### ######", maxLen: 10 },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪", format: "### ########", maxLen: 11 },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷", format: "# ## ## ## ##", maxLen: 9 },
  { code: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸", format: "### ### ###", maxLen: 9 },
  { code: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹", format: "### ### ####", maxLen: 10 },
  { code: "PT", name: "Portugal", dialCode: "+351", flag: "🇵🇹", format: "### ### ###", maxLen: 9 },
  { code: "BR", name: "Brazil", dialCode: "+55", flag: "🇧🇷", format: "(##) #####-####", maxLen: 11 },
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷", format: "## ####-####", maxLen: 10 },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱", format: "# #### ####", maxLen: 9 },
  { code: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴", format: "### ### ####", maxLen: 10 },
  { code: "PE", name: "Peru", dialCode: "+51", flag: "🇵🇪", format: "### ### ###", maxLen: 9 },
  { code: "VE", name: "Venezuela", dialCode: "+58", flag: "🇻🇪", format: "###-###-####", maxLen: 10 },
  { code: "EC", name: "Ecuador", dialCode: "+593", flag: "🇪🇨", format: "## ### ####", maxLen: 9 },
  { code: "UY", name: "Uruguay", dialCode: "+598", flag: "🇺🇾", format: "## ### ###", maxLen: 8 },
  { code: "PY", name: "Paraguay", dialCode: "+595", flag: "🇵🇾", format: "### ### ###", maxLen: 9 },
  { code: "BO", name: "Bolivia", dialCode: "+591", flag: "🇧🇴", format: "# ### ####", maxLen: 8 },
  { code: "CR", name: "Costa Rica", dialCode: "+506", flag: "🇨🇷", format: "#### ####", maxLen: 8 },
  { code: "PA", name: "Panama", dialCode: "+507", flag: "🇵🇦", format: "####-####", maxLen: 8 },
  { code: "GT", name: "Guatemala", dialCode: "+502", flag: "🇬🇹", format: "#### ####", maxLen: 8 },
  { code: "HN", name: "Honduras", dialCode: "+504", flag: "🇭🇳", format: "####-####", maxLen: 8 },
  { code: "SV", name: "El Salvador", dialCode: "+503", flag: "🇸🇻", format: "#### ####", maxLen: 8 },
  { code: "NI", name: "Nicaragua", dialCode: "+505", flag: "🇳🇮", format: "#### ####", maxLen: 8 },
  { code: "DO", name: "Dominican Republic", dialCode: "+1", flag: "🇩🇴", format: "(###) ###-####", maxLen: 10 },
  { code: "PR", name: "Puerto Rico", dialCode: "+1", flag: "🇵🇷", format: "(###) ###-####", maxLen: 10 },
  { code: "CU", name: "Cuba", dialCode: "+53", flag: "🇨🇺", format: "# ### ####", maxLen: 8 },
  { code: "JM", name: "Jamaica", dialCode: "+1", flag: "🇯🇲", format: "(###) ###-####", maxLen: 10 },
  { code: "TT", name: "Trinidad and Tobago", dialCode: "+1", flag: "🇹🇹", format: "(###) ###-####", maxLen: 10 },
  { code: "HT", name: "Haiti", dialCode: "+509", flag: "🇭🇹", format: "## ## ####", maxLen: 8 },
  { code: "BS", name: "Bahamas", dialCode: "+1", flag: "🇧🇸", format: "(###) ###-####", maxLen: 10 },
  { code: "BB", name: "Barbados", dialCode: "+1", flag: "🇧🇧", format: "(###) ###-####", maxLen: 10 },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺", format: "### ### ###", maxLen: 9 },
  { code: "NZ", name: "New Zealand", dialCode: "+64", flag: "🇳🇿", format: "## ### ####", maxLen: 9 },
  { code: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵", format: "##-####-####", maxLen: 10 },
  { code: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷", format: "##-####-####", maxLen: 10 },
  { code: "CN", name: "China", dialCode: "+86", flag: "🇨🇳", format: "### #### ####", maxLen: 11 },
  { code: "HK", name: "Hong Kong", dialCode: "+852", flag: "🇭🇰", format: "#### ####", maxLen: 8 },
  { code: "TW", name: "Taiwan", dialCode: "+886", flag: "🇹🇼", format: "### ### ###", maxLen: 9 },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬", format: "#### ####", maxLen: 8 },
  { code: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾", format: "##-### ####", maxLen: 9 },
  { code: "TH", name: "Thailand", dialCode: "+66", flag: "🇹🇭", format: "## ### ####", maxLen: 9 },
  { code: "VN", name: "Vietnam", dialCode: "+84", flag: "🇻🇳", format: "### ### ####", maxLen: 10 },
  { code: "PH", name: "Philippines", dialCode: "+63", flag: "🇵🇭", format: "### ### ####", maxLen: 10 },
  { code: "ID", name: "Indonesia", dialCode: "+62", flag: "🇮🇩", format: "### ### ####", maxLen: 10 },
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳", format: "##### #####", maxLen: 10 },
  { code: "PK", name: "Pakistan", dialCode: "+92", flag: "🇵🇰", format: "### #######", maxLen: 10 },
  { code: "BD", name: "Bangladesh", dialCode: "+880", flag: "🇧🇩", format: "#### ######", maxLen: 10 },
  { code: "LK", name: "Sri Lanka", dialCode: "+94", flag: "🇱🇰", format: "## ### ####", maxLen: 9 },
  { code: "NP", name: "Nepal", dialCode: "+977", flag: "🇳🇵", format: "### ### ####", maxLen: 10 },
  { code: "MM", name: "Myanmar", dialCode: "+95", flag: "🇲🇲", format: "## ### ####", maxLen: 9 },
  { code: "KH", name: "Cambodia", dialCode: "+855", flag: "🇰🇭", format: "## ### ####", maxLen: 9 },
  { code: "LA", name: "Laos", dialCode: "+856", flag: "🇱🇦", format: "## ### ####", maxLen: 9 },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪", format: "## ### ####", maxLen: 9 },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦", format: "## ### ####", maxLen: 9 },
  { code: "QA", name: "Qatar", dialCode: "+974", flag: "🇶🇦", format: "#### ####", maxLen: 8 },
  { code: "KW", name: "Kuwait", dialCode: "+965", flag: "🇰🇼", format: "#### ####", maxLen: 8 },
  { code: "BH", name: "Bahrain", dialCode: "+973", flag: "🇧🇭", format: "#### ####", maxLen: 8 },
  { code: "OM", name: "Oman", dialCode: "+968", flag: "🇴🇲", format: "#### ####", maxLen: 8 },
  { code: "JO", name: "Jordan", dialCode: "+962", flag: "🇯🇴", format: "# #### ####", maxLen: 9 },
  { code: "LB", name: "Lebanon", dialCode: "+961", flag: "🇱🇧", format: "## ### ###", maxLen: 8 },
  { code: "IL", name: "Israel", dialCode: "+972", flag: "🇮🇱", format: "##-###-####", maxLen: 9 },
  { code: "TR", name: "Turkey", dialCode: "+90", flag: "🇹🇷", format: "### ### ####", maxLen: 10 },
  { code: "IR", name: "Iran", dialCode: "+98", flag: "🇮🇷", format: "### ### ####", maxLen: 10 },
  { code: "IQ", name: "Iraq", dialCode: "+964", flag: "🇮🇶", format: "### ### ####", maxLen: 10 },
  { code: "EG", name: "Egypt", dialCode: "+20", flag: "🇪🇬", format: "### ### ####", maxLen: 10 },
  { code: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦", format: "## ### ####", maxLen: 9 },
  { code: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬", format: "### ### ####", maxLen: 10 },
  { code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪", format: "### ######", maxLen: 9 },
  { code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭", format: "## ### ####", maxLen: 9 },
  { code: "TZ", name: "Tanzania", dialCode: "+255", flag: "🇹🇿", format: "### ### ###", maxLen: 9 },
  { code: "UG", name: "Uganda", dialCode: "+256", flag: "🇺🇬", format: "### ### ###", maxLen: 9 },
  { code: "ET", name: "Ethiopia", dialCode: "+251", flag: "🇪🇹", format: "## ### ####", maxLen: 9 },
  { code: "MA", name: "Morocco", dialCode: "+212", flag: "🇲🇦", format: "## #### ###", maxLen: 9 },
  { code: "DZ", name: "Algeria", dialCode: "+213", flag: "🇩🇿", format: "### ## ## ##", maxLen: 9 },
  { code: "TN", name: "Tunisia", dialCode: "+216", flag: "🇹🇳", format: "## ### ###", maxLen: 8 },
  { code: "LY", name: "Libya", dialCode: "+218", flag: "🇱🇾", format: "## ### ####", maxLen: 9 },
  { code: "SN", name: "Senegal", dialCode: "+221", flag: "🇸🇳", format: "## ### ## ##", maxLen: 9 },
  { code: "CI", name: "Ivory Coast", dialCode: "+225", flag: "🇨🇮", format: "## ## ## ## ##", maxLen: 10 },
  { code: "CM", name: "Cameroon", dialCode: "+237", flag: "🇨🇲", format: "# ## ## ## ##", maxLen: 9 },
  { code: "ZW", name: "Zimbabwe", dialCode: "+263", flag: "🇿🇼", format: "## ### ####", maxLen: 9 },
  { code: "RU", name: "Russia", dialCode: "+7", flag: "🇷🇺", format: "(###) ###-##-##", maxLen: 10 },
  { code: "UA", name: "Ukraine", dialCode: "+380", flag: "🇺🇦", format: "## ### ## ##", maxLen: 9 },
  { code: "PL", name: "Poland", dialCode: "+48", flag: "🇵🇱", format: "### ### ###", maxLen: 9 },
  { code: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱", format: "# ########", maxLen: 9 },
  { code: "BE", name: "Belgium", dialCode: "+32", flag: "🇧🇪", format: "### ## ## ##", maxLen: 9 },
  { code: "CH", name: "Switzerland", dialCode: "+41", flag: "🇨🇭", format: "## ### ## ##", maxLen: 9 },
  { code: "AT", name: "Austria", dialCode: "+43", flag: "🇦🇹", format: "### ######", maxLen: 9 },
  { code: "SE", name: "Sweden", dialCode: "+46", flag: "🇸🇪", format: "##-### ## ##", maxLen: 9 },
  { code: "NO", name: "Norway", dialCode: "+47", flag: "🇳🇴", format: "### ## ###", maxLen: 8 },
  { code: "DK", name: "Denmark", dialCode: "+45", flag: "🇩🇰", format: "## ## ## ##", maxLen: 8 },
  { code: "FI", name: "Finland", dialCode: "+358", flag: "🇫🇮", format: "## ### ####", maxLen: 9 },
  { code: "IE", name: "Ireland", dialCode: "+353", flag: "🇮🇪", format: "## ### ####", maxLen: 9 },
  { code: "CZ", name: "Czech Republic", dialCode: "+420", flag: "🇨🇿", format: "### ### ###", maxLen: 9 },
  { code: "SK", name: "Slovakia", dialCode: "+421", flag: "🇸🇰", format: "### ### ###", maxLen: 9 },
  { code: "RO", name: "Romania", dialCode: "+40", flag: "🇷🇴", format: "### ### ###", maxLen: 9 },
  { code: "HU", name: "Hungary", dialCode: "+36", flag: "🇭🇺", format: "## ### ####", maxLen: 9 },
  { code: "BG", name: "Bulgaria", dialCode: "+359", flag: "🇧🇬", format: "### ### ###", maxLen: 9 },
  { code: "HR", name: "Croatia", dialCode: "+385", flag: "🇭🇷", format: "## ### ####", maxLen: 9 },
  { code: "RS", name: "Serbia", dialCode: "+381", flag: "🇷🇸", format: "## ### ####", maxLen: 9 },
  { code: "SI", name: "Slovenia", dialCode: "+386", flag: "🇸🇮", format: "## ### ###", maxLen: 8 },
  { code: "GR", name: "Greece", dialCode: "+30", flag: "🇬🇷", format: "### ### ####", maxLen: 10 },
  { code: "CY", name: "Cyprus", dialCode: "+357", flag: "🇨🇾", format: "## ######", maxLen: 8 },
  { code: "MT", name: "Malta", dialCode: "+356", flag: "🇲🇹", format: "#### ####", maxLen: 8 },
  { code: "LU", name: "Luxembourg", dialCode: "+352", flag: "🇱🇺", format: "### ### ###", maxLen: 9 },
  { code: "IS", name: "Iceland", dialCode: "+354", flag: "🇮🇸", format: "### ####", maxLen: 7 },
  { code: "EE", name: "Estonia", dialCode: "+372", flag: "🇪🇪", format: "#### ####", maxLen: 8 },
  { code: "LV", name: "Latvia", dialCode: "+371", flag: "🇱🇻", format: "## ### ###", maxLen: 8 },
  { code: "LT", name: "Lithuania", dialCode: "+370", flag: "🇱🇹", format: "### #####", maxLen: 8 },
  { code: "BY", name: "Belarus", dialCode: "+375", flag: "🇧🇾", format: "## ### ## ##", maxLen: 9 },
  { code: "MD", name: "Moldova", dialCode: "+373", flag: "🇲🇩", format: "### ## ###", maxLen: 8 },
  { code: "GE", name: "Georgia", dialCode: "+995", flag: "🇬🇪", format: "### ### ###", maxLen: 9 },
  { code: "AM", name: "Armenia", dialCode: "+374", flag: "🇦🇲", format: "## ### ###", maxLen: 8 },
  { code: "AZ", name: "Azerbaijan", dialCode: "+994", flag: "🇦🇿", format: "## ### ## ##", maxLen: 9 },
  { code: "KZ", name: "Kazakhstan", dialCode: "+7", flag: "🇰🇿", format: "(###) ###-##-##", maxLen: 10 },
  { code: "UZ", name: "Uzbekistan", dialCode: "+998", flag: "🇺🇿", format: "## ### ## ##", maxLen: 9 },
  { code: "TM", name: "Turkmenistan", dialCode: "+993", flag: "🇹🇲", format: "## ######", maxLen: 8 },
  { code: "KG", name: "Kyrgyzstan", dialCode: "+996", flag: "🇰🇬", format: "### ### ###", maxLen: 9 },
  { code: "TJ", name: "Tajikistan", dialCode: "+992", flag: "🇹🇯", format: "## ### ####", maxLen: 9 },
  { code: "AF", name: "Afghanistan", dialCode: "+93", flag: "🇦🇫", format: "## ### ####", maxLen: 9 },
  { code: "MN", name: "Mongolia", dialCode: "+976", flag: "🇲🇳", format: "## ## ####", maxLen: 8 },
  { code: "BT", name: "Bhutan", dialCode: "+975", flag: "🇧🇹", format: "## ### ###", maxLen: 8 },
  { code: "MV", name: "Maldives", dialCode: "+960", flag: "🇲🇻", format: "### ####", maxLen: 7 },
  { code: "FJ", name: "Fiji", dialCode: "+679", flag: "🇫🇯", format: "### ####", maxLen: 7 },
  { code: "PG", name: "Papua New Guinea", dialCode: "+675", flag: "🇵🇬", format: "### ####", maxLen: 7 },
  { code: "WS", name: "Samoa", dialCode: "+685", flag: "🇼🇸", format: "## #####", maxLen: 7 },
  { code: "TO", name: "Tonga", dialCode: "+676", flag: "🇹🇴", format: "### ####", maxLen: 7 },
  { code: "VU", name: "Vanuatu", dialCode: "+678", flag: "🇻🇺", format: "### ####", maxLen: 7 },
  { code: "NC", name: "New Caledonia", dialCode: "+687", flag: "🇳🇨", format: "## ## ##", maxLen: 6 },
  { code: "PF", name: "French Polynesia", dialCode: "+689", flag: "🇵🇫", format: "## ## ##", maxLen: 6 },
  { code: "GU", name: "Guam", dialCode: "+1", flag: "🇬🇺", format: "(###) ###-####", maxLen: 10 },
  { code: "BZ", name: "Belize", dialCode: "+501", flag: "🇧🇿", format: "###-####", maxLen: 7 },
  { code: "GY", name: "Guyana", dialCode: "+592", flag: "🇬🇾", format: "### ####", maxLen: 7 },
  { code: "SR", name: "Suriname", dialCode: "+597", flag: "🇸🇷", format: "### ####", maxLen: 7 },
  { code: "GF", name: "French Guiana", dialCode: "+594", flag: "🇬🇫", format: "### ## ## ##", maxLen: 9 },
  { code: "FK", name: "Falkland Islands", dialCode: "+500", flag: "🇫🇰", format: "#####", maxLen: 5 },
  { code: "AW", name: "Aruba", dialCode: "+297", flag: "🇦🇼", format: "### ####", maxLen: 7 },
  { code: "CW", name: "Curacao", dialCode: "+599", flag: "🇨🇼", format: "### ####", maxLen: 7 },
  { code: "SX", name: "Sint Maarten", dialCode: "+1", flag: "🇸🇽", format: "(###) ###-####", maxLen: 10 },
  { code: "KY", name: "Cayman Islands", dialCode: "+1", flag: "🇰🇾", format: "(###) ###-####", maxLen: 10 },
  { code: "VI", name: "US Virgin Islands", dialCode: "+1", flag: "🇻🇮", format: "(###) ###-####", maxLen: 10 },
  { code: "BM", name: "Bermuda", dialCode: "+1", flag: "🇧🇲", format: "(###) ###-####", maxLen: 10 },
  { code: "AG", name: "Antigua and Barbuda", dialCode: "+1", flag: "🇦🇬", format: "(###) ###-####", maxLen: 10 },
  { code: "DM", name: "Dominica", dialCode: "+1", flag: "🇩🇲", format: "(###) ###-####", maxLen: 10 },
  { code: "GD", name: "Grenada", dialCode: "+1", flag: "🇬🇩", format: "(###) ###-####", maxLen: 10 },
  { code: "KN", name: "Saint Kitts and Nevis", dialCode: "+1", flag: "🇰🇳", format: "(###) ###-####", maxLen: 10 },
  { code: "LC", name: "Saint Lucia", dialCode: "+1", flag: "🇱🇨", format: "(###) ###-####", maxLen: 10 },
  { code: "VC", name: "Saint Vincent", dialCode: "+1", flag: "🇻🇨", format: "(###) ###-####", maxLen: 10 },
  { code: "TC", name: "Turks and Caicos", dialCode: "+1", flag: "🇹🇨", format: "(###) ###-####", maxLen: 10 },
  { code: "AI", name: "Anguilla", dialCode: "+1", flag: "🇦🇮", format: "(###) ###-####", maxLen: 10 },
  { code: "VG", name: "British Virgin Islands", dialCode: "+1", flag: "🇻🇬", format: "(###) ###-####", maxLen: 10 },
  { code: "MS", name: "Montserrat", dialCode: "+1", flag: "🇲🇸", format: "(###) ###-####", maxLen: 10 },
  { code: "GP", name: "Guadeloupe", dialCode: "+590", flag: "🇬🇵", format: "### ## ## ##", maxLen: 9 },
  { code: "MQ", name: "Martinique", dialCode: "+596", flag: "🇲🇶", format: "### ## ## ##", maxLen: 9 },
  { code: "RE", name: "Reunion", dialCode: "+262", flag: "🇷🇪", format: "### ## ## ##", maxLen: 9 },
  { code: "YT", name: "Mayotte", dialCode: "+262", flag: "🇾🇹", format: "### ## ## ##", maxLen: 9 },
  { code: "MU", name: "Mauritius", dialCode: "+230", flag: "🇲🇺", format: "#### ####", maxLen: 8 },
  { code: "SC", name: "Seychelles", dialCode: "+248", flag: "🇸🇨", format: "# ### ###", maxLen: 7 },
  { code: "MG", name: "Madagascar", dialCode: "+261", flag: "🇲🇬", format: "## ## ### ##", maxLen: 9 },
  { code: "MW", name: "Malawi", dialCode: "+265", flag: "🇲🇼", format: "## ### ####", maxLen: 9 },
  { code: "ZM", name: "Zambia", dialCode: "+260", flag: "🇿🇲", format: "## ### ####", maxLen: 9 },
  { code: "BW", name: "Botswana", dialCode: "+267", flag: "🇧🇼", format: "## ### ###", maxLen: 8 },
  { code: "NA", name: "Namibia", dialCode: "+264", flag: "🇳🇦", format: "## ### ####", maxLen: 9 },
  { code: "MZ", name: "Mozambique", dialCode: "+258", flag: "🇲🇿", format: "## ### ####", maxLen: 9 },
  { code: "AO", name: "Angola", dialCode: "+244", flag: "🇦🇴", format: "### ### ###", maxLen: 9 },
  { code: "CD", name: "DR Congo", dialCode: "+243", flag: "🇨🇩", format: "## ### ####", maxLen: 9 },
  { code: "CG", name: "Congo", dialCode: "+242", flag: "🇨🇬", format: "## ### ####", maxLen: 9 },
  { code: "GA", name: "Gabon", dialCode: "+241", flag: "🇬🇦", format: "# ## ## ##", maxLen: 7 },
  { code: "GQ", name: "Equatorial Guinea", dialCode: "+240", flag: "🇬🇶", format: "## ### ####", maxLen: 9 },
  { code: "CF", name: "Central African Rep.", dialCode: "+236", flag: "🇨🇫", format: "## ## ## ##", maxLen: 8 },
  { code: "TD", name: "Chad", dialCode: "+235", flag: "🇹🇩", format: "## ## ## ##", maxLen: 8 },
  { code: "NE", name: "Niger", dialCode: "+227", flag: "🇳🇪", format: "## ## ## ##", maxLen: 8 },
  { code: "ML", name: "Mali", dialCode: "+223", flag: "🇲🇱", format: "## ## ## ##", maxLen: 8 },
  { code: "BF", name: "Burkina Faso", dialCode: "+226", flag: "🇧🇫", format: "## ## ## ##", maxLen: 8 },
  { code: "BJ", name: "Benin", dialCode: "+229", flag: "🇧🇯", format: "## ## ## ##", maxLen: 8 },
  { code: "TG", name: "Togo", dialCode: "+228", flag: "🇹🇬", format: "## ## ## ##", maxLen: 8 },
  { code: "GN", name: "Guinea", dialCode: "+224", flag: "🇬🇳", format: "## ### ###", maxLen: 8 },
  { code: "SL", name: "Sierra Leone", dialCode: "+232", flag: "🇸🇱", format: "## ######", maxLen: 8 },
  { code: "LR", name: "Liberia", dialCode: "+231", flag: "🇱🇷", format: "## ### ####", maxLen: 9 },
  { code: "GM", name: "Gambia", dialCode: "+220", flag: "🇬🇲", format: "### ####", maxLen: 7 },
  { code: "GW", name: "Guinea-Bissau", dialCode: "+245", flag: "🇬🇼", format: "### ####", maxLen: 7 },
  { code: "CV", name: "Cape Verde", dialCode: "+238", flag: "🇨🇻", format: "### ## ##", maxLen: 7 },
  { code: "ST", name: "Sao Tome and Principe", dialCode: "+239", flag: "🇸🇹", format: "### ####", maxLen: 7 },
  { code: "MR", name: "Mauritania", dialCode: "+222", flag: "🇲🇷", format: "## ## ## ##", maxLen: 8 },
  { code: "DJ", name: "Djibouti", dialCode: "+253", flag: "🇩🇯", format: "## ## ## ##", maxLen: 8 },
  { code: "SO", name: "Somalia", dialCode: "+252", flag: "🇸🇴", format: "## ### ####", maxLen: 9 },
  { code: "ER", name: "Eritrea", dialCode: "+291", flag: "🇪🇷", format: "# ### ###", maxLen: 7 },
  { code: "SD", name: "Sudan", dialCode: "+249", flag: "🇸🇩", format: "## ### ####", maxLen: 9 },
  { code: "SS", name: "South Sudan", dialCode: "+211", flag: "🇸🇸", format: "## ### ####", maxLen: 9 },
  { code: "RW", name: "Rwanda", dialCode: "+250", flag: "🇷🇼", format: "### ### ###", maxLen: 9 },
  { code: "BI", name: "Burundi", dialCode: "+257", flag: "🇧🇮", format: "## ## ## ##", maxLen: 8 },
  { code: "KM", name: "Comoros", dialCode: "+269", flag: "🇰🇲", format: "### ## ##", maxLen: 7 },
  { code: "LS", name: "Lesotho", dialCode: "+266", flag: "🇱🇸", format: "#### ####", maxLen: 8 },
  { code: "SZ", name: "Eswatini", dialCode: "+268", flag: "🇸🇿", format: "#### ####", maxLen: 8 },
  { code: "SY", name: "Syria", dialCode: "+963", flag: "🇸🇾", format: "### ### ###", maxLen: 9 },
  { code: "YE", name: "Yemen", dialCode: "+967", flag: "🇾🇪", format: "### ### ###", maxLen: 9 },
  { code: "PS", name: "Palestine", dialCode: "+970", flag: "🇵🇸", format: "## ### ####", maxLen: 9 },
  { code: "AL", name: "Albania", dialCode: "+355", flag: "🇦🇱", format: "## ### ####", maxLen: 9 },
  { code: "BA", name: "Bosnia and Herzegovina", dialCode: "+387", flag: "🇧🇦", format: "## ### ###", maxLen: 8 },
  { code: "XK", name: "Kosovo", dialCode: "+383", flag: "🇽🇰", format: "## ### ###", maxLen: 8 },
  { code: "ME", name: "Montenegro", dialCode: "+382", flag: "🇲🇪", format: "## ### ###", maxLen: 8 },
  { code: "MK", name: "North Macedonia", dialCode: "+389", flag: "🇲🇰", format: "## ### ###", maxLen: 8 },
  { code: "MC", name: "Monaco", dialCode: "+377", flag: "🇲🇨", format: "## ## ## ##", maxLen: 8 },
  { code: "AD", name: "Andorra", dialCode: "+376", flag: "🇦🇩", format: "### ###", maxLen: 6 },
  { code: "SM", name: "San Marino", dialCode: "+378", flag: "🇸🇲", format: "## ## ## ##", maxLen: 8 },
  { code: "VA", name: "Vatican City", dialCode: "+39", flag: "🇻🇦", format: "### ### ####", maxLen: 10 },
  { code: "LI", name: "Liechtenstein", dialCode: "+423", flag: "🇱🇮", format: "### ####", maxLen: 7 },
  { code: "GL", name: "Greenland", dialCode: "+299", flag: "🇬🇱", format: "## ## ##", maxLen: 6 },
  { code: "FO", name: "Faroe Islands", dialCode: "+298", flag: "🇫🇴", format: "### ###", maxLen: 6 },
  { code: "GI", name: "Gibraltar", dialCode: "+350", flag: "🇬🇮", format: "### #####", maxLen: 8 },
  { code: "IM", name: "Isle of Man", dialCode: "+44", flag: "🇮🇲", format: "#### ######", maxLen: 10 },
  { code: "JE", name: "Jersey", dialCode: "+44", flag: "🇯🇪", format: "#### ######", maxLen: 10 },
  { code: "GG", name: "Guernsey", dialCode: "+44", flag: "🇬🇬", format: "#### ######", maxLen: 10 },
];

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  workspaceName: z.string().min(2, "Workspace name must be at least 2 characters"),
  phone: z.string().min(5, "Phone number is too short").regex(/^\d+$/, "Only numbers allowed"),
  email: z.string().email("Invalid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[^A-Za-z0-9]/, "Must contain a special character (!@#$%...)"),
  termsAccepted: z.boolean().refine((val) => val === true, "Required"),
});

const googleSSOSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  workspaceName: z.string().min(2, "Workspace name must be at least 2 characters"),
  termsAccepted: z.boolean().refine((val) => val === true, "Required"),
});

type RegisterForm = z.infer<typeof registerSchema>;
type GoogleSSOForm = z.infer<typeof googleSSOSchema>;

// Detect Google SSO params before component renders
function getGoogleSSOParams() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const sso = params.get('sso');
  const email = params.get('email');
  const name = params.get('name');
  const googleId = params.get('googleId');
  
  if (sso === 'google' && email && googleId) {
    return { email, name: name || '', googleId };
  }
  return null;
}

export default function Register() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Initialize Google SSO state from URL params
  const initialGoogleSSO = getGoogleSSOParams();
  const [googleSSO, setGoogleSSO] = useState<{
    email: string;
    name: string;
    googleId: string;
  } | null>(initialGoogleSSO);

  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const filteredCountries = COUNTRIES.filter(
    (country) =>
      country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      country.dialCode.includes(countrySearch) ||
      country.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const formatPhoneNumber = (value: string, format: string): string => {
    let result = "";
    let valueIndex = 0;
    for (let i = 0; i < format.length && valueIndex < value.length; i++) {
      if (format[i] === "#") {
        result += value[valueIndex];
        valueIndex++;
      } else {
        result += format[i];
      }
    }
    return result;
  };

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      workspaceName: "",
      phone: "",
      email: "",
      password: "",
      termsAccepted: false,
    },
  });

  const googleForm = useForm<GoogleSSOForm>({
    resolver: zodResolver(googleSSOSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      workspaceName: initialGoogleSSO?.name || "",
      termsAccepted: false,
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const slug = data.workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      const payload = {
        company: {
          name: data.workspaceName,
          slug: slug,
        },
        admin: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
          phone: `${selectedCountry.dialCode}${data.phone}`,
        },
      };
      
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error codes from the backend
        if (result.error === "PASSWORD_EXPOSED") {
          throw new Error("This password appears in known data breaches. Please choose a different password.");
        }
        if (result.error === "PASSWORD_CHECK_UNAVAILABLE") {
          throw new Error("Password validation service temporarily unavailable. Please try again.");
        }
        throw new Error(result.message || "Registration failed");
      }

      toast({
        title: "Workspace created!",
        description: "Please check your email to verify your account.",
        duration: 3000,
      });

      setLocation("/login");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogleSSOSubmit = async (data: GoogleSSOForm) => {
    if (!googleSSO) return;
    
    setIsLoading(true);
    try {
      const slug = data.workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      const payload = {
        company: {
          name: data.workspaceName,
          slug: slug,
        },
        admin: {
          email: googleSSO.email,
          googleId: googleSSO.googleId,
        },
      };
      
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Registration failed");
      }

      toast({
        title: "Workspace created!",
        description: "You can now sign in with Google.",
        duration: 3000,
      });

      setLocation("/login");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSSO = () => {
    window.location.href = "/api/auth/google";
  };

  if (googleSSO) {
    return (
      <AuthShell
        title="Complete your signup"
        subtitle={`Signing up as ${googleSSO.email}`}
        footer={
          <div className="text-center text-[13px] text-gray-500">
            Want to use a different account?{" "}
            <button
              type="button"
              onClick={() => {
                setGoogleSSO(null);
                window.history.replaceState({}, '', '/register');
              }}
              className="text-gray-900 hover:text-gray-700 font-medium transition-colors"
              data-testid="link-different-account"
            >
              Start over
            </button>
          </div>
        }
      >
        <Form {...googleForm}>
          <form onSubmit={googleForm.handleSubmit(onGoogleSSOSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] text-gray-500 font-medium tracking-wide uppercase">
                Workspace name
              </label>
              <FormField
                control={googleForm.control}
                name="workspaceName"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Your company or team name"
                        className="h-11 px-4 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                        {...field}
                        autoComplete="organization"
                        data-testid="input-workspace-name"
                      />
                    </FormControl>
                    <div className="h-4">
                      <FormMessage className="text-[10px]" />
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={googleForm.control}
              name="termsAccepted"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-2.5 space-y-0 pt-1">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="h-4 w-4 mt-0.5 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 rounded"
                      data-testid="checkbox-terms"
                    />
                  </FormControl>
                  <div className="leading-none">
                    <label className="text-[12px] text-gray-500 leading-relaxed cursor-pointer" onClick={() => field.onChange(!field.value)}>
                      I agree to the{" "}
                      <a href="https://curbe.io/terms" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Terms</a>
                      {" "}and{" "}
                      <a href="https://curbe.io/privacy" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Privacy Policy</a>
                    </label>
                    <div className="h-4">
                      <FormMessage className="text-[10px]" />
                    </div>
                  </div>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 text-[13px] font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all duration-150 shadow-sm hover:shadow disabled:opacity-70"
              data-testid="button-register"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create workspace"
              )}
            </Button>
          </form>
        </Form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create workspace"
      subtitle="Get started in minutes"
      onGoogleSSO={handleGoogleSSO}
      footer={
        <div className="text-center text-[13px] text-gray-500">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => setLocation("/login")}
            className="text-gray-900 hover:text-gray-700 font-medium transition-colors"
            data-testid="link-login"
          >
            Sign in
          </button>
        </div>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] text-gray-500 font-medium tracking-wide uppercase">
                First name
              </label>
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="John"
                        className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                        {...field}
                        autoComplete="given-name"
                        data-testid="input-first-name"
                      />
                    </FormControl>
                    <div className="h-3">
                      <FormMessage className="text-[10px]" />
                    </div>
                  </FormItem>
                )}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-gray-500 font-medium tracking-wide uppercase">
                Last name
              </label>
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Doe"
                        className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                        {...field}
                        autoComplete="family-name"
                        data-testid="input-last-name"
                      />
                    </FormControl>
                    <div className="h-3">
                      <FormMessage className="text-[10px]" />
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] text-gray-500 font-medium tracking-wide uppercase">
              Workspace name
            </label>
            <FormField
              control={form.control}
              name="workspaceName"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Your company or team name"
                      className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                      {...field}
                      autoComplete="organization"
                      data-testid="input-workspace-name"
                    />
                  </FormControl>
                  <div className="h-3">
                    <FormMessage className="text-[10px]" />
                  </div>
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] text-gray-500 font-medium tracking-wide uppercase">
              Phone number
            </label>
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex">
                      <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-1 h-10 px-2 bg-gray-50 border border-r-0 border-gray-200 rounded-l-lg text-[14px] text-gray-700 hover:bg-gray-100 transition-colors min-w-[80px]"
                            data-testid="button-country-selector"
                          >
                            <span className="text-lg">{selectedCountry.flag}</span>
                            <span className="text-[13px] font-medium">{selectedCountry.dialCode}</span>
                            <ChevronDown className="h-3 w-3 text-gray-400" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0" align="start">
                          <div className="p-2 border-b">
                            <Input
                              type="text"
                              placeholder="Search countries..."
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              className="h-8 text-[13px]"
                              data-testid="input-country-search"
                            />
                          </div>
                          <ScrollArea className="h-[260px]">
                            <div className="p-1">
                              {filteredCountries.length === 0 ? (
                                <div className="px-3 py-4 text-center text-[13px] text-gray-500">
                                  No countries found
                                </div>
                              ) : (
                                filteredCountries.map((country) => (
                                  <button
                                    key={country.code}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCountry(country);
                                      setCountryOpen(false);
                                      setCountrySearch("");
                                      form.setValue("phone", "");
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] rounded hover:bg-gray-100 transition-colors ${
                                      selectedCountry.code === country.code ? "bg-gray-100" : ""
                                    }`}
                                    data-testid={`country-option-${country.code}`}
                                  >
                                    <span className="text-lg">{country.flag}</span>
                                    <span className="flex-1 text-gray-900">{country.name}</span>
                                    <span className="text-gray-500">{country.dialCode}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                      <Input
                        type="tel"
                        placeholder={selectedCountry.format.replace(/#/g, "0")}
                        className="h-10 px-3 bg-white border border-gray-200 rounded-l-none rounded-r-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none flex-1"
                        value={formatPhoneNumber(field.value || "", selectedCountry.format)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '');
                          const limitedDigits = digits.slice(0, selectedCountry.maxLen);
                          field.onChange(limitedDigits);
                        }}
                        autoComplete="tel-national"
                        data-testid="input-phone"
                      />
                    </div>
                  </FormControl>
                  <div className="h-3">
                    <FormMessage className="text-[10px]" />
                  </div>
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] text-gray-500 font-medium tracking-wide uppercase">
              Work email
            </label>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@company.com"
                      className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                      {...field}
                      autoComplete="email"
                      data-testid="input-email"
                    />
                  </FormControl>
                  <div className="h-3">
                    <FormMessage className="text-[10px]" />
                  </div>
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] text-gray-500 font-medium tracking-wide uppercase">
              Password
            </label>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="8+ chars, uppercase, number, symbol"
                        className="h-10 px-3 pr-10 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                        {...field}
                        autoComplete="new-password"
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <div className="h-3">
                    <FormMessage className="text-[10px]" />
                  </div>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="termsAccepted"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="h-4 w-4 mt-0.5 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 rounded"
                    data-testid="checkbox-terms"
                  />
                </FormControl>
                <div className="leading-none">
                  <label className="text-[11px] text-gray-500 leading-relaxed cursor-pointer" onClick={() => field.onChange(!field.value)}>
                    By signing up or otherwise using our services, you agree to be bound by our{" "}
                    <a href="https://curbe.io/terms" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Terms of use</a>
                    {" "}and{" "}
                    <a href="https://curbe.io/privacy" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Privacy policy</a>.
                  </label>
                  <div className="h-3">
                    <FormMessage className="text-[10px]" />
                  </div>
                </div>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 text-[13px] font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all duration-150 shadow-sm hover:shadow disabled:opacity-70"
            data-testid="button-register"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create workspace"
            )}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
