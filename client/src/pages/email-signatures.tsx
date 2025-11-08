import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { 
  Copy, 
  Download, 
  Palette, 
  Type,
  Briefcase,
  Building2,
  Mail,
  Phone,
  Smartphone,
  Globe,
  MapPin,
  Image as ImageIcon,
  Sparkles,
  Check,
  Eye,
  Code2,
  FileDown,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Github,
  Youtube,
  Shield,
  Clock,
  Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LoadingSpinner } from "@/components/loading-spinner";
import { formatPhoneInput } from "@shared/phone";

// Form schema for email signature data - Modern Professional Fields
const signatureFormSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  jobTitle: z.string().min(1, "Job title is required"),
  company: z.string().min(1, "Company is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  website: z.string().optional(),
  linkedinUrl: z.string().optional(),
  twitterUrl: z.string().optional(),
  facebookUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  githubUrl: z.string().optional(),
  youtubeUrl: z.string().optional(),
  tiktokUrl: z.string().optional(),
  pinterestUrl: z.string().optional(),
  behanceUrl: z.string().optional(),
  dribbbleUrl: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().optional(),
  profilePhotoUrl: z.string().optional(),
  bannerImageUrl: z.string().optional(),
  bannerText: z.string().optional(),
  bannerUrl: z.string().optional(),
  ctaText: z.string().optional(),
  ctaUrl: z.string().optional(),
  disclaimerText: z.string().optional(),
  companyTagline: z.string().optional(),
  department: z.string().optional(),
  pronouns: z.string().optional(),
  meetingLink: z.string().optional(),
  calendlyUrl: z.string().optional(),
  workingHours: z.string().optional(),
  timezone: z.string().optional(),
  certifications: z.string().optional(),
  awards: z.string().optional(),
  followerCount: z.string().optional(),
  subscriberCount: z.string().optional(),
});

type SignatureFormData = z.infer<typeof signatureFormSchema>;

// Template type
interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  colorSchemes: Array<{
    id: string;
    name: string;
    primaryColor: string;
    secondaryColor: string;
  }>;
  fonts: Array<{
    id: string;
    name: string;
    family: string;
  }>;
  generateHtml: (data: SignatureFormData, colorScheme: any, font: any) => string;
}

// Social media icon SVGs as base64 for email compatibility
const socialIcons = {
  linkedin: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0iIzAwNzdiNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE3LjA0IDE3LjA0M2gtMi45NnYtNC42NGMwLTEuMTA3LS4wMjMtMi41MzEtMS41NDQtMi41MzEtMS41NDQgMC0xLjc4IDEuMjEzLTEuNzggMi40NjJ2NC43MDloLTIuOTZWNy41aDIuODR2MS4zMDRoLjA0Yy4zOTctLjc1IDEuMzY0LTEuNTQ0IDIuODA3LTEuNTQ0IDMuMDA2IDAgMy41NTcgMS45NzcgMy41NTcgNC41NTN2NS4yM3pNNC40NDcgNi4xOTZjLS45NTQgMC0xLjcyLS43NzMtMS43Mi0xLjcyIDAtLjk0Ny43NzMtMS43MiAxLjcyLTEuNzIuOTQ3IDAgMS43Mi43NzMgMS43MiAxLjcyIDAgLjk0Ny0uNzczIDEuNzItMS43MiAxLjcyem0xLjQ4NCAxMC44NDdIMi45NjNWNy41aDIuOTY4djkuNTQzem0xNC4xMDgtMTdINy45NkExLjk2IDEuOTYgMCAwMDAgMS45NnYxNi4wOEExLjk2IDEuOTYgMCAwMDEuOTYgMjBoMTYuMDhBMS45NiAxLjk2IDAgMDAyMCAxOC4wNFYxLjk2QTEuOTYgMS45NiAwIDAwMTguMDQgMHoiLz4KPC9zdmc+",
  twitter: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0iIzFEQTFGMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE5LjcwMyA0LjExNGMtLjcyMi4zMi0xLjUuNTM3LTIuMzE1LjYzNS44MzItLjUgMS40Ny0xLjI5MiAxLjc3LTIuMjM1LS43NzguNDYyLTEuNjQuNzk3LTIuNTU2Ljk3N0E0LjA2MiA0LjA2MiAwIDAwMTMuNjMzIDJjLTIuMjIyIDAtNC4wMjUgMS44MDMtNC4wMjUgNC4wMjUgMCAuMzE2LjAzNi42MjIuMTA0LjkxNy0zLjM0NS0uMTY4LTYuMzEzLTEuNzctOC4yOTgtNC4zOTdhNC4wMzcgNC4wMzcgMCAwMC0uNTQ1IDIuMDI1YzAgMS4zOTcuNzExIDIuNjMgMS43OSAzLjM1M2E0LjAwOCA0LjAwOCAwIDAxLTEuODI0LS41MDN2LjA1MWMwIDEuOTUgMS4zODYgMy41NzggMy4yMjYgMy45NS0uMzM3LjA5Mi0uNjkyLjE0MS0xLjA1OC4xNDEtLjI1OSAwLS41MS0uMDI1LS43NTctLjA3My41MTEgMS42IDEuOTkxIDIuNzYzIDMuNzQ3IDIuNzk1LTEuMzczIDEuMDc2LTMuMTAzIDEuNzE3LTQuOTgzIDEuNzE3LS4zMjQgMC0uNjQ0LS4wMTktLjk1OC0uMDU2IDEuNzc0IDEuMTM3IDMuODggMS44MSA2LjE0MiAxLjgxIDcuMzcgMCAxMS40LTYuMTA2IDExLjQtMTEuNCAwLS4xNzQtLjAwNC0uMzQ3LS4wMTItLjUxOUE4LjE0IDguMTQgMCAwMDIwIDQuMTE0YS43OTYuNzk2IDAgMDEtLjI5NyAweiIvPgo8L3N2Zz4=",
  facebook: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0iIzE4NzdGMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIwIDEwLjA2MUMyMCA0LjUwNSAxNS41MiAwIDEwIDAgNC40OCAwIDAgNC41MDUgMCAxMC4wNjFjMCA1LjAyMiAzLjY1NyA5LjE4NCA4LjQzOCA5LjkzOXYtNy4wM0g1LjkwM3YtMi45MWgyLjUzNVY3LjgxN2MwLTIuNTE4IDEuNDkzLTMuOTE1IDMuNzc3LTMuOTE1IDEuMDk0IDAgMi4yMzguMTk1IDIuMjM4LjE5NXYyLjQ3NmgtMS4yNmMtMS4yNDMgMC0xLjYzLjc3NC0xLjYzIDEuNTY5djEuODg4aDIuNzczbC0uNDQzIDIuOTFoLTIuMzN2Ny4wNEMxNi4zNDMgMTkuMjQ1IDIwIDE1LjA4MyAyMCAxMC4wNjF6Ii8+Cjwvc3ZnPg==",
  instagram: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9ITAgMCAyMCAyMCIgZmlsbD0idXJsKCNpbnN0YWdyYW0tZ3JhZGllbnQpIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJpbnN0YWdyYW0tZ3JhZGllbnQiIHgxPSIwJSIgeTE9IjEwMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmRjNzVlIi8+CjxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjZjQ3MTMzIi8+CjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI2JjMWE4OCIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM+CjxwYXRoIGQ9Ik0xMCA2Ljg2NWEzLjEzNSAzLjEzNSAwIDEwMCA2LjI3IDMuMTM1IDMuMTM1IDAgMDAwLTYuMjd6bTAgNC44NjVhMS43MyAxLjczIDAgMTEwLTMuNDYgMS43MyAxLjczIDAgMDEwIDMuNDZ6bTMuMzU0LTQuOTgyYS43MzMuNzMzIDAgMTAwLTEuNDY1LjczMy43MzMgMCAwMDAgMS40NjV6bTEuNzY1Ljc0MmMtLjAzOS0uODQtLjIzMi0xLjU4NC0uODQ2LTIuMTk0LS42MS0uNjEtMS4zNTUtLjgwMy0yLjE5NS0uODQ2LTIuODUtLjE2Mi01LjI5Ni0uMTYyLTguMTQ2IDBDMy4wOTIgNC40ODkgMi4zNDcgNC42ODIgMS43MzcgNS4yOTZjLS42MS42MS0uODAzIDEuMzU0LS44NDYgMi4xOTQtLjE2MiAyLjg1LS4xNjIgNS4yOTYgMCA4LjE0Ni4wMzkuODQuMjMyIDEuNTg0Ljg0NiAyLjE5NC42MS42MSAxLjM1NS44MDMgMi4xOTUuODQ2IDIuODUuMTYyIDUuMjk2LjE2MiA4LjE0NiAwIC44NC0uMDM5IDEuNTg0LS4yMzIgMi4xOTUtLjg0Ni42MS0uNjEuODAzLTEuMzU0Ljg0Ni0yLjE5NC4xNjItMi44NS4xNjItNS4yOTYgMC04LjE0NnptLTEuNDM0IDEwLjA0NGMtLjU1NC4xMy0uOTk1LS4wMTYtMS4zMzYtLjM1Ny0uMzQxLS4zNDEtLjQ4Ny0uNzgyLS4zNTctMS4zMzZDMTEuODU3IDE0LjE0IDEyLjE0IDE0IDE0LjU3IDE0YzIuNDMgMCAyLjcxNC0uMTQgMy41NzktLjIwNS41NTQtLjEzLjk5NS4wMTYgMS4zMzYuMzU3LjM0MS4zNDEuNDg3Ljc4Mi4zNTcgMS4zMzYtLjEzNCAxLjExNi0uMjc0IDEuNC0uMjc0IDMuODMgMCAyLjQzLjE0IDIuNzE0LjIwNSAzLjU3OS4xMy41NTQtLjAxNi45OTUtLjM1NyAxLjMzNi0uMzQxLjM0MS0uNzgyLjQ4Ny0xLjMzNi4zNTctMS4xMTYtLjEzNC0xLjQtLjI3NC0zLjgzLS4yNzQtMi40MyAwLTIuNzE0LjE0LTMuNTc5LjIwNXoiLz4KPC9zdmc+",
  github: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0iIzMzMzMzMyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEwIDAuMjVDNC40NzcgMC4yNSAwIDQuNzI3IDAgMTAuMjVjMCA0LjQxOCAyLjg2NSA4LjE2NiA2Ljg0IDkuNDkuNS4wOTEuNjgyLS4yMTcuNjgyLS40ODMgMC0uMjM3LS4wMDgtLjg2Ny0uMDEzLTEuNzAzLTIuNzgyLjYwNS0zLjM2OS0xLjM0Mi0zLjM2OS0xLjM0Mi0uNDU0LTEuMTU1LTEuMTEtMS40NjItMS4xMS0xLjQ2Mi0uOTA4LS42Mi4wNjktLjYwOC4wNjktLjYwOCAxLjAwMy4wNyAxLjUzMSAxLjAzIDEuNTMxIDEuMDMuODkyIDEuNTI5IDIuMzQxIDEuMDg3IDIuOTEuODMyLjA5Mi0uNjQ3LjM0OS0xLjA4Ni42MzYtMS4zMzYtMi4yMi0uMjUzLTQuNTU1LTEuMTEtNC41NTUtNC45NDMgMC0xLjA5MS4zOS0xLjk4NCAxLjAyOS0yLjY4My0uMTAzLS4yNTMtLjQ0Ni0xLjI3LjA5OC0yLjY0NyAwIDAgLjg0LS4yNjkgMi43NSAxLjAyNUE5LjU3OCA5LjU3OCAwIDAxMTAgNS45NzljLjg1LjAwNCAxLjcwNS4xMTUgMi41MDQuMzM3IDEuOTA5LTEuMjk0IDIuNzQ3LTEuMDI1IDIuNzQ3LTEuMDI1LjU0NiAxLjM3Ny4yMDMgMi4zOTQuMSAyLjY0Ny42NC42OTkgMS4wMjggMS41OTIgMS4wMjggMi42ODMgMCAzLjg0Mi0yLjMzOSA0LjY4Ny00LjU2NiA0LjkzNS4zNTkuMzEuNjc4LjkyLjY3OCAxLjg1NSAwIDEuMzM4LS4wMTIgMi40MTktLjAxMiAyLjc0NyAwIC4yNjguMTguNTguNjg4LjQ4MkE5Ljk5NyA5Ljk5NyAwIDAwMjAgMTAuMjVDMjAgNC43MjcgMTUuNTIzIDAuMjUgMTAgMC4yNXoiLz4KPC9zdmc+",
  youtube: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0iI0ZGMDAwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE5LjYxNSA2LjAzNmMtLjIzLS44Ni0uOTA4LTEuNTM4LTEuNzY4LTEuNzY4QzE2LjI4OCAzLjkwOCAxMCAzLjkwOCAxMCAzLjkwOHMtNi4yODggMC03Ljg0Ny4zNmMtLjg2LjIzLTEuNTM4LjkwOC0xLjc2OCAxLjc2OC0uMzU5IDEuNTU5LS4zNTkgNC44MTQtLjM1OSA0LjgxNHMwIDMuMjU1LjM1OSA0LjgxNGMuMjMuODYuOTA4IDEuNTM4IDEuNzY4IDEuNzY4IDEuNTU5LjM2IDcuODQ3LjM2IDcuODQ3LjM2czYuMjg4IDAgNy44NDctLjM2Yy44Ni0uMjMgMS41MzgtLjkwOCAxLjc2OC0xLjc2OC4zNTktMS41NTkuMzU5LTQuODE0LjM1OS00LjgxNHMwLTMuMjU1LS4zNTktNC44MTR6TTggMTMuNjU0VjcuMzQ2bDUuMTM1IDMuMzA0TDggMTMuNjU0eiIvPgo8L3N2Zz4=",
  tiktok: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0iIzAwMDAwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2LjYgNC4yQzE2IDMuNiAxNS44IDMuMSAxNS41IDIuNUMxNSAyLjIgMTQuOCAyIDE0LjQgMkgxMS44VjEzLjRDMTEuOCAxNC4zIDExLjEgMTUgMTAuMiAxNUM5LjMgMTUgOC42IDE0LjMgOC42IDEzLjRDOC42IDEyLjUgOS4zIDExLjggMTAuMiAxMS44QzEwLjQgMTEuOCAxMC42IDExLjggMTAuOCAxMS45VjkuM0MxMC42IDkuMyAxMC40IDkuMiAxMC4yIDkuMkM3LjkgOS4yIDYgMTEuMSA2IDEzLjRDNiAxNS43IDcuOSAxNy42IDEwLjIgMTcuNkMxMi41IDE3LjYgMTQuNCAxNS43IDE0LjQgMTMuNFY3LjdDMTUuMiA4LjMgMTYgOC42IDE3IDguNlY2QzE3IDYgMTYuOCA1LjQgMTYuNiA0LjJ6Ii8+Cjwvc3ZnPg==",
  pinterest: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0iI0UxMjIyRiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEwIDBDNC40NzcgMCAwIDQuNDc3IDAgMTBjMCAzLjk5MSAyLjMzMyA3LjQzOCA1LjY5OCA5LjA1My0uMDc4LS43NDYtLjE0OS0xLjg4OS4wMzEtMi43MDMuMTYyLS43MzUgMS4wNDYtNC40MzggMS4wNDYtNC40MzhjLS4yNjItLjUwMi0uMjYyLTEuMjQ2LS4yNjItMS4yNDYgMC0xLjE2Ny43NzYtMi4wMzcgMS43MzItMi4wMzcuODE2IDAgMS4yMTEuNjEzIDEuMjExIDEuMzQ3IDAgLjgyLS41MjMgMi4wNDctLjc5MyAzLjE4NC0uMjI2Ljk1MS41NDcgMS43MjYgMS40OTggMS43MjYgMS44IDAgMy4xODUtMS41MDMgMy4xODUtMy42NzEgMC0xLjkyLTEuMzgtMy4yNjMtMy4zNDktMy4yNjMtMi4yOCAwLTMuNjE4IDEuNzEtMy42MTggMy40NzggMCAuNjg5LjI2NSAxLjQyNy42LjExLjI2Ny0uMTE4LjMyMy0uMzkxLjMyMy0uMzkxcy0uMDY0LS4yNzItLjEtLjQxN2MtLjA1OC0uMjI1LS4zNDUtMS40MzctLjM0NS0xLjQzNy0uMjQ1LS42ODUtMS4xMS0yLjE4NC0xLjExLTIuMTg0cy0uMjQ1LS40OS0uMjQ1LTEuMjEzYzAtMS4xMzQuNjU3LTEuOTc5IDEuNDczLTEuOTc5Ljc5NSAwIDEuMTQuNTg1IDEuMTQuNTg1cy42NzctMi44NzMuODA3LTMuNDU5Yy4xNzUtLjc4My42NDctMS40NzggMS40OC0xLjQ3OC45MDIgMCAxLjU0Ny45NDUgMS40OTcgMS44NC0uMDUuODk1LS40NzQgMS45ODMtLjQ3NCAxLjk4M3MuMjQ4LjUyMy43NTIuNTIzYy41MDQgMCAxLjExLS40NTggMS4xMS0xLjI5MyAwLTEuNTE1LTEuNTE1LTIuMzQzLTMuNDM5LTIuMzQzLTIuMDM2IDAtMy4zMSAxLjQ0OS0zLjMxIDMuMTE1IDAgLjU5Ni4xNTkgMS4wMzYuNDE3IDEuMzg3LjA1OS4wOC4wNjguMTUuMDQ5LjIzMWwtLjE1NS42MzdjLS4wNjMuMjU3LS4yMDQuMzEtLjQ3MS4xODYtLjk2NS0uNDUtMS41MTctMS41NS0xLjUxNy0yLjU2NSAwLTIuMDg0IDEuNTE1LTQuMDA0IDQuMzY5LTQuMDA0IDIuMjk0IDAgNC4wNzIgMS42MzQgNC4wNzIgMy44MTMgMCAuNzY0LS4xNTIgMS40OTYtLjQxOCAyLjE4MS0uMzM5LjIyLTEuMTA0LjYwNi0xLjEwNC42MDZzLS4yMDgtLjQxOC0uMjQ1LS45NjJjLS4wMzctLjU0NC4wNzUtMS4yMTQuMzU1LTEuOTY0LjI3OS0uNzUuNjU1LTEuNTkuNjU1LTEuNTlzLjM0NS43NzIuODk1Ljc3MmMuNTUgMCAuNzctLjQxOC43Ny0uODM3IDAtLjY1NS0uNTAyLTEuNjMtMS41NDctMS42My0xLjM0MiAwLTIuMTc3IDEuMTctMi4xNzcgMS4xN3MtLjIyMS0uMjc1LS41OTEtLjI3NWMtLjQ4OSAwLS45MDQuMjc1LS45MDQuODIxIDAgLjI5NC4xMDEuNTI3LjI0LjcwNS0uNDUgMS45OTItLjc3MiAzLjE3LS43NzIgMy4xN3MtLjE1NS42MjktLjE1NSAxLjU0N2MwIDEuMzE4LjE0NCAyLjUyNy40NTQgMy42MzJDMy42IDE2LjQzIDIgMTMuNDEgMiAxMCAyIDQuNDc3IDUuNDc3IDEgMTEgMXM5IDMuNDc3IDkgOS05IDMuNDc3LTkgOS05eiIvPgo8L3N2Zz4=",
  behance: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9ITAgMCAyMCAyMCIgZmlsbD0iIzEwNTNDQiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTguMTI1IDUuODMzVjguMzMzSDEyLjVDMTIuODQ1IDguMzMzIDEzLjEyNSA4LjA1MyAxMy4xMjUgNy43MDhDMTMuMTI1IDcuMzYzIDEyLjg0NSA3LjA4MyAxMi41IDcuMDgzSDguMTI1VjUuODMzWk0xMy43NSAxMC44MzNDMTMuNzUgMTAuNDg5IDEzLjQ3IDEwLjIwOCAxMy4xMjUgMTAuMjA4SDguMTI1VjEyLjVIMTMuMTI1QzEzLjQ3IDEyLjUgMTMuNzUgMTIuMTc4IDEzLjc1IDExLjgzM1YxMC44MzNaTTE1IDcuNzA4QzE1IDguNTI4IDE0LjQ3MSA5LjIyOSAxMy43NjIgOS41NDFDMTQUNAM2IDkuODQyIDE1IDEwLjI4NSAxNSAxMC44MzNDMTUgMTIuMjIyIDEzLjk1NSAxMy4zMzMgMTIuNjMzIDEzLjMzM0g2VjRIMTIuNUM0LjI5MiA0IDE1IDUuNzA4IDE1IDcuNzA4Wk0xNi42NjcgNy41SDE5VjYuNjY3SDE2LjY2N1Y3LjVaTTE4LjMzMyA5LjE2N0MxNy44NzUgOS4xNjcgMTcuNSA5LjU0MiAxNy41IDEwSDE5LjE2N0MxOS4xNjcgOS41NDIgMTguNzkyIDkuMTY3IDE4LjMzMyA5LjE2N1pNMTcuNSAxMS42NjdIMTQuMTY3QzE0LjE2NyAxMy4wNSAxNS4yODMgMTQuMTY3IDE2LjY2NyAxNC4xNjdDMTcuNjI1IDE0LjE2NyAxOC40MzkgMTMuNjIgMTguNzUgMTIuOTE3SDE5LjU4M0MxOS4yIDEzLjgwMiAxOC4yMDggMTQuNTgzIDE2LjY2NyAxNC41ODNDMTQuOTQyIDE0LjU4MyAxMy41ODMgMTMuMjI1IDEzLjU4MyAxMS41QzEzLjU4MyA5Ljc3NSAxNC45NDIgOC40MTcgMTYuNjY3IDguNDE3QzE4LjM5MiA4LjQxNyAxOS43NSA5Ljc3NSAxOS43NSAxMS41VjExLjY2N0gxNy41WiIvPgo8L3N2Zz4=",
  dribbble: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0iI0VBNDM4NSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEwIDBDNC40NzcgMCAwIDQuNDc3IDAgMTBzNC40NzcgMTAgMTAgMTAgMTAtNC40NzcgMTAtMTBTMTUuNTIzIDAgMTAgMHptNi41ODQgNC42MDdjLS40NTYtLjU3Mi0xLjAyOC0xLjA0Mi0xLjY5My0xLjM5NS0uNjY2LS4zNTMtMS40MTYtLjU3My0yLjIxMi0uNjM1LTEuMDM4IDIuMDQzLTIuMTg1IDQuMDEtMy40MzYgNS44OTcgMS40OSAwIC4xMDQuMTU3LjU1NC44NjcgMS40OTMgMi4zMzUgMi43OTQgNC44MTMgMy44ODcgNy40MzYgMy4wMDgtMS40NzIgNC45MzUtNC4xODMgNC45MzUtNy40MTkgMC0uNTg1LS4wNTktMS4xNTctLjE3NS0xLjcwOS0uMDM2LS4xNzItLjA3Ni0uMzQzLS4xMTktLjUxMy0xLjQ3Mi40Ni0zLjAxOC42OTgtNC42MjIuNjk4LS40MDQgMC0uODE2LS4wMTUtMS4yMzUtLjA0N3ptLTguMzUzLS45MmMtLjcyOS0uMTU1LTEuNDg0LS4yMzktMi4yNTgtLjIzOS0uNTYzIDAtMS4xMTMuMDQ2LTEuNjUxLjEzM0MyLjg1IDQuNTkyIDEuNjQyIDYuMzg3IDEuMDgzIDguNDI5YzEuNzEzLS4wMjIgMy4zOTQtLjM2OCA0Ljk1NC0xLjAwOEw4LjIzIDMuNjg3em0tNS4wODEgOC43MDVjLjEyMyAxLjAxMi40NDUgMS45NzkuOTQ5IDIuODU1LjUwNC44NzYgMS4xODEgMS42MzggMi4wMDUgMi4yMjYtLjA1NC0zLjA3Ni4xODEtNi4xMzYuNzAyLTkuMTQxQzMuOTQ2IDkuNzQgMy4wNjEgMTAuNDEzIDMuMTUgMTIuMzkyeiIvPgo8L3N2Zz4=",
};

// Modern Professional Email Signature Templates
const emailTemplates: EmailTemplate[] = [
  // 1. Modern Executive - Clean with profile photo circle, name prominent, social icons row
  {
    id: "modern-executive",
    name: "Modern Executive",
    description: "Clean with profile photo circle, name prominent, social icons",
    thumbnail: "👔",
    colorSchemes: [
      { id: "executive-blue", name: "Executive Blue", primaryColor: "#0066cc", secondaryColor: "#333333" },
      { id: "power-red", name: "Power Red", primaryColor: "#dc2626", secondaryColor: "#111111" },
      { id: "elegant-purple", name: "Elegant Purple", primaryColor: "#7c3aed", secondaryColor: "#1f2937" },
    ],
    fonts: [
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td style="padding: 20px;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align: top; padding-right: 20px;">
            ${data.profilePhotoUrl ? `
            <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 120px; height: 120px; border-radius: 60px; object-fit: cover;">
            ` : `
            <div style="width: 120px; height: 120px; border-radius: 60px; background: ${colorScheme.primaryColor}; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 48px; font-weight: bold;">${data.fullName.split(' ').map(n => n[0]).join('')}</span>
            </div>
            `}
          </td>
          <td style="vertical-align: middle;">
            <div style="font-size: 28px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 4px;">${data.fullName}</div>
            ${data.pronouns ? `<span style="font-size: 14px; color: #6b7280;">(${data.pronouns})</span>` : ''}
            <div style="font-size: 18px; color: ${colorScheme.secondaryColor}; margin-bottom: 2px;">${data.jobTitle}</div>
            ${data.department ? `<div style="font-size: 14px; color: #6b7280; margin-bottom: 2px;">${data.department}</div>` : ''}
            <div style="font-size: 16px; font-weight: 600; color: ${colorScheme.secondaryColor}; margin-bottom: 12px;">${data.company}</div>
            
            <div style="margin: 12px 0;">
              ${data.phone ? `<div style="font-size: 14px; color: #4b5563; margin: 2px 0;">📞 ${data.phone}</div>` : ''}
              ${data.mobile ? `<div style="font-size: 14px; color: #4b5563; margin: 2px 0;">📱 ${data.mobile}</div>` : ''}
              <div style="font-size: 14px; margin: 2px 0;">✉️ <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></div>
              ${data.website ? `<div style="font-size: 14px; margin: 2px 0;">🌐 <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a></div>` : ''}
            </div>
            
            ${data.ctaText && data.ctaUrl ? `
            <div style="margin: 16px 0;">
              <a href="${data.ctaUrl}" style="display: inline-block; padding: 10px 24px; background: ${colorScheme.primaryColor}; color: white; text-decoration: none; border-radius: 5px; font-size: 14px; font-weight: bold;">${data.ctaText}</a>
            </div>
            ` : ''}
            
            <div style="margin-top: 12px;">
              ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="margin-right: 10px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 24px; height: 24px;"></a>` : ''}
              ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="margin-right: 10px;"><img src="${socialIcons.twitter}" alt="Twitter" style="width: 24px; height: 24px;"></a>` : ''}
              ${data.githubUrl ? `<a href="${data.githubUrl}" style="margin-right: 10px;"><img src="${socialIcons.github}" alt="GitHub" style="width: 24px; height: 24px;"></a>` : ''}
              ${data.facebookUrl ? `<a href="${data.facebookUrl}" style="margin-right: 10px;"><img src="${socialIcons.facebook}" alt="Facebook" style="width: 24px; height: 24px;"></a>` : ''}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },

  // 2. Corporate Minimal - Simple text-based, company logo, clean lines
  {
    id: "corporate-minimal",
    name: "Corporate Minimal",
    description: "Simple text-based, company logo, clean lines",
    thumbnail: "📊",
    colorSchemes: [
      { id: "minimal-black", name: "Minimal Black", primaryColor: "#000000", secondaryColor: "#4b5563" },
      { id: "navy-gray", name: "Navy & Gray", primaryColor: "#1e3a8a", secondaryColor: "#6b7280" },
      { id: "forest-green", name: "Forest Green", primaryColor: "#14532d", secondaryColor: "#374151" },
    ],
    fonts: [
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "times", name: "Times New Roman", family: "Times New Roman, serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td style="padding: 20px;">
      ${data.logoUrl ? `<img src="${data.logoUrl}" alt="${data.company}" style="max-height: 40px; margin-bottom: 20px;">` : ''}
      <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
        <div style="font-size: 16px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 2px;">${data.fullName}</div>
        <div style="font-size: 14px; color: ${colorScheme.secondaryColor}; margin-bottom: 16px;">${data.jobTitle} | ${data.company}</div>
        
        <div style="font-size: 13px; line-height: 20px; color: #374151;">
          ${data.phone ? `<span>T: ${data.phone}</span> ` : ''}
          ${data.mobile ? `<span style="margin-left: 15px;">M: ${data.mobile}</span>` : ''}
          <br>
          <span>E: <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></span>
          ${data.website ? `<br><span>W: <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a></span>` : ''}
        </div>
        
        ${data.companyTagline ? `
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <div style="font-size: 12px; color: #6b7280; font-style: italic;">${data.companyTagline}</div>
        </div>` : ''}
      </div>
    </td>
  </tr>
</table>`
  },

  // 3. Business Professional - Photo left side, info right, social icons
  {
    id: "business-professional",
    name: "Business Professional",
    description: "Photo left side, info right, social icons",
    thumbnail: "👨‍💼",
    colorSchemes: [
      { id: "professional-blue", name: "Professional Blue", primaryColor: "#2563eb", secondaryColor: "#475569" },
      { id: "corporate-green", name: "Corporate Green", primaryColor: "#059669", secondaryColor: "#374151" },
      { id: "executive-burgundy", name: "Executive Burgundy", primaryColor: "#881337", secondaryColor: "#1f2937" },
    ],
    fonts: [
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "calibri", name: "Calibri", family: "Calibri, sans-serif" },
      { id: "verdana", name: "Verdana", family: "Verdana, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td style="padding: 20px; background: #ffffff;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          ${data.profilePhotoUrl ? `
          <td style="vertical-align: top; padding-right: 20px;">
            <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 100px; height: 100px; border-radius: 5px; object-fit: cover;">
          </td>` : ''}
          <td style="vertical-align: top;">
            <div style="font-size: 20px; font-weight: bold; color: ${colorScheme.primaryColor};">${data.fullName}</div>
            <div style="font-size: 14px; color: ${colorScheme.secondaryColor}; margin-bottom: 12px;">${data.jobTitle}</div>
            
            <div style="font-size: 13px; color: #4b5563; line-height: 22px;">
              <strong style="color: ${colorScheme.primaryColor};">${data.company}</strong>
              ${data.department ? `<br>${data.department}` : ''}
              ${data.phone ? `<br>☎ ${data.phone}` : ''}
              ${data.mobile ? `<br>📱 ${data.mobile}` : ''}
              <br>✉ <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a>
              ${data.website ? `<br>🌐 <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a>` : ''}
            </div>
            
            <div style="margin-top: 12px;">
              ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="margin-right: 8px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 20px; height: 20px;"></a>` : ''}
              ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="margin-right: 8px;"><img src="${socialIcons.twitter}" alt="Twitter" style="width: 20px; height: 20px;"></a>` : ''}
              ${data.facebookUrl ? `<a href="${data.facebookUrl}" style="margin-right: 8px;"><img src="${socialIcons.facebook}" alt="Facebook" style="width: 20px; height: 20px;"></a>` : ''}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },

  // 4. Tech Startup - Modern gradient accents, profile photo, GitHub/LinkedIn icons  
  {
    id: "tech-startup",
    name: "Tech Startup",
    description: "Modern gradient accents, GitHub/LinkedIn icons",
    thumbnail: "💻",
    colorSchemes: [
      { id: "startup-purple", name: "Startup Purple", primaryColor: "#8b5cf6", secondaryColor: "#7c3aed" },
      { id: "tech-blue", name: "Tech Blue", primaryColor: "#3b82f6", secondaryColor: "#2563eb" },
      { id: "modern-teal", name: "Modern Teal", primaryColor: "#14b8a6", secondaryColor: "#0d9488" },
    ],
    fonts: [
      { id: "system", name: "System", family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td style="padding: 20px;">
      <div style="background: linear-gradient(135deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); padding: 30px; border-radius: 10px; text-align: center;">
        ${data.profilePhotoUrl ? `
        <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 100px; height: 100px; border-radius: 50px; border: 4px solid white; margin-bottom: 15px;">
        ` : ''}
        <div style="color: white; font-size: 26px; font-weight: bold; margin-bottom: 4px;">${data.fullName}</div>
        <div style="color: rgba(255,255,255,0.9); font-size: 16px; margin-bottom: 2px;">${data.jobTitle}</div>
        <div style="color: rgba(255,255,255,0.8); font-size: 14px; margin-bottom: 20px;">${data.company}</div>
        
        <div style="background: white; padding: 15px; border-radius: 8px;">
          <div style="font-size: 14px; color: #374151; line-height: 24px;">
            ${data.email ? `<div>📧 <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></div>` : ''}
            ${data.phone ? `<div>📱 ${data.phone}</div>` : ''}
            ${data.website ? `<div>🌐 <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a></div>` : ''}
          </div>
          
          ${data.ctaText && data.ctaUrl ? `
          <a href="${data.ctaUrl}" style="display: inline-block; margin-top: 15px; padding: 10px 25px; background: ${colorScheme.primaryColor}; color: white; text-decoration: none; border-radius: 25px; font-size: 14px; font-weight: bold;">${data.ctaText}</a>
          ` : ''}
        </div>
        
        <div style="margin-top: 20px;">
          ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="margin: 0 5px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 28px; height: 28px;"></a>` : ''}
          ${data.githubUrl ? `<a href="${data.githubUrl}" style="margin: 0 5px;"><img src="${socialIcons.github}" alt="GitHub" style="width: 28px; height: 28px;"></a>` : ''}
          ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="margin: 0 5px;"><img src="${socialIcons.twitter}" alt="Twitter" style="width: 28px; height: 28px;"></a>` : ''}
        </div>
      </div>
    </td>
  </tr>
</table>`
  },

  // 5. Sales Professional - CTA button "Schedule a Meeting", photo, contact info
  {
    id: "sales-professional", 
    name: "Sales Professional",
    description: "CTA button 'Schedule a Meeting', photo, contact info",
    thumbnail: "💼",
    colorSchemes: [
      { id: "sales-blue", name: "Sales Blue", primaryColor: "#0ea5e9", secondaryColor: "#0284c7" },
      { id: "success-green", name: "Success Green", primaryColor: "#10b981", secondaryColor: "#059669" },
      { id: "energy-orange", name: "Energy Orange", primaryColor: "#f97316", secondaryColor: "#ea580c" },
    ],
    fonts: [
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "verdana", name: "Verdana", family: "Verdana, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td style="padding: 20px;">
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          ${data.profilePhotoUrl ? `
          <td style="vertical-align: top; padding-right: 20px;">
            <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 90px; height: 90px; border-radius: 10px; object-fit: cover;">
          </td>` : ''}
          <td style="vertical-align: top;">
            <div style="font-size: 22px; font-weight: bold; color: #111827; margin-bottom: 4px;">${data.fullName}</div>
            <div style="font-size: 16px; color: ${colorScheme.primaryColor}; margin-bottom: 2px;">${data.jobTitle}</div>
            <div style="font-size: 14px; color: #6b7280; margin-bottom: 12px;">${data.company}</div>
            
            <div style="margin-bottom: 16px;">
              ${data.phone ? `<div style="font-size: 14px; color: #4b5563; margin: 4px 0;">📞 ${data.phone}</div>` : ''}
              <div style="font-size: 14px; color: #4b5563; margin: 4px 0;">✉️ <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></div>
              ${data.website ? `<div style="font-size: 14px; color: #4b5563; margin: 4px 0;">🌐 <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a></div>` : ''}
            </div>
            
            ${data.calendlyUrl || data.meetingLink ? `
            <a href="${data.calendlyUrl || data.meetingLink}" style="display: inline-block; padding: 12px 24px; background: ${colorScheme.primaryColor}; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold;">📅 Schedule a Meeting</a>
            ` : data.ctaText && data.ctaUrl ? `
            <a href="${data.ctaUrl}" style="display: inline-block; padding: 12px 24px; background: ${colorScheme.primaryColor}; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold;">${data.ctaText}</a>
            ` : ''}
            
            <div style="margin-top: 16px;">
              ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="margin-right: 10px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 22px; height: 22px;"></a>` : ''}
              ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="margin-right: 10px;"><img src="${socialIcons.twitter}" alt="Twitter" style="width: 22px; height: 22px;"></a>` : ''}
            </div>
          </td>
        </tr>
      </table>
      ${data.companyTagline ? `
      <div style="margin-top: 20px; padding-top: 16px; border-top: 2px solid #e5e7eb;">
        <div style="font-size: 13px; color: #6b7280; font-style: italic;">"${data.companyTagline}"</div>
      </div>` : ''}
    </td>
  </tr>
</table>`
  },

  // 6. Creative Designer - Colorful banner, portfolio link, Behance/Dribbble icons
  {
    id: "creative-designer",
    name: "Creative Designer",
    description: "Colorful banner, portfolio link, Behance/Dribbble icons",
    thumbnail: "🎨",
    colorSchemes: [
      { id: "creative-gradient", name: "Creative Gradient", primaryColor: "#ec4899", secondaryColor: "#a855f7" },
      { id: "design-blue", name: "Design Blue", primaryColor: "#3b82f6", secondaryColor: "#06b6d4" },
      { id: "artist-orange", name: "Artist Orange", primaryColor: "#f97316", secondaryColor: "#fbbf24" },
    ],
    fonts: [
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td>
      ${data.bannerImageUrl ? `
      <img src="${data.bannerImageUrl}" alt="Banner" style="width: 100%; max-width: 600px; height: 150px; object-fit: cover;">
      ` : `
      <div style="background: linear-gradient(90deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); height: 120px; display: flex; align-items: center; justify-content: center;">
        <div style="color: white; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">CREATIVE</div>
      </div>
      `}
      
      <div style="padding: 20px; background: white;">
        <table cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            ${data.profilePhotoUrl ? `
            <td style="width: 80px; padding-right: 20px;">
              <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 80px; height: 80px; border-radius: 8px; border: 2px solid ${colorScheme.primaryColor};">
            </td>` : ''}
            <td>
              <div style="font-size: 24px; font-weight: bold; background: linear-gradient(90deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${data.fullName}</div>
              <div style="font-size: 16px; color: #4b5563; margin-bottom: 8px;">${data.jobTitle}</div>
              <div style="font-size: 14px; color: #6b7280;">${data.company}</div>
            </td>
          </tr>
        </table>
        
        <div style="margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 8px;">
          <div style="font-size: 14px; color: #374151; line-height: 22px;">
            <div>📧 <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></div>
            ${data.phone ? `<div>📱 ${data.phone}</div>` : ''}
            ${data.website ? `<div>🎨 <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">View Portfolio</a></div>` : ''}
          </div>
        </div>
        
        ${data.ctaText && data.ctaUrl ? `
        <div style="margin-top: 16px; text-align: center;">
          <a href="${data.ctaUrl}" style="display: inline-block; padding: 12px 30px; background: linear-gradient(90deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); color: white; text-decoration: none; border-radius: 25px; font-size: 14px; font-weight: bold;">${data.ctaText}</a>
        </div>
        ` : ''}
        
        <div style="margin-top: 20px; text-align: center;">
          ${data.behanceUrl ? `<a href="${data.behanceUrl}" style="margin: 0 8px;"><img src="${socialIcons.behance}" alt="Behance" style="width: 24px; height: 24px;"></a>` : ''}
          ${data.dribbbleUrl ? `<a href="${data.dribbbleUrl}" style="margin: 0 8px;"><img src="${socialIcons.dribbble}" alt="Dribbble" style="width: 24px; height: 24px;"></a>` : ''}
          ${data.instagramUrl ? `<a href="${data.instagramUrl}" style="margin: 0 8px;"><img src="${socialIcons.instagram}" alt="Instagram" style="width: 24px; height: 24px;"></a>` : ''}
          ${data.pinterestUrl ? `<a href="${data.pinterestUrl}" style="margin: 0 8px;"><img src="${socialIcons.pinterest}" alt="Pinterest" style="width: 24px; height: 24px;"></a>` : ''}
        </div>
      </div>
    </td>
  </tr>
</table>`
  },

  // 7. Marketing Expert - Gradient backgrounds, modern typography, social proof
  {
    id: "marketing-expert",
    name: "Marketing Expert",
    description: "Gradient backgrounds, modern typography, social proof",
    thumbnail: "📈",
    colorSchemes: [
      { id: "business-navy", name: "Business Navy", primaryColor: "#1e293b", secondaryColor: "#475569" },
      { id: "corporate-green", name: "Corporate Green", primaryColor: "#14532d", secondaryColor: "#166534" },
      { id: "professional-blue", name: "Professional Blue", primaryColor: "#1e3a8a", secondaryColor: "#1e40af" },
    ],
    fonts: [
      { id: "times", name: "Times New Roman", family: "Times New Roman, serif" },
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td style="padding: 20px;">
      <div style="background: linear-gradient(135deg, ${colorScheme.primaryColor}20, white); padding: 25px; border-radius: 10px;">
        <div style="font-size: 26px; font-weight: bold; background: linear-gradient(90deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 4px;">${data.fullName}</div>
        <div style="font-size: 18px; color: #4b5563; margin-bottom: 2px;">${data.jobTitle}</div>
        <div style="font-size: 15px; color: #6b7280; margin-bottom: 20px;">${data.company}</div>
        
        ${data.followerCount || data.subscriberCount ? `
        <div style="display: inline-block; padding: 8px 16px; background: ${colorScheme.primaryColor}; color: white; border-radius: 20px; font-size: 13px; font-weight: bold; margin-bottom: 20px;">
          ${data.followerCount ? `${data.followerCount} Followers` : `${data.subscriberCount} Subscribers`}
        </div>
        ` : ''}
        
        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="font-size: 14px; color: #374151; line-height: 24px;">
            📧 <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none; font-weight: 500;">${data.email}</a><br>
            ${data.phone ? `📱 ${data.phone}<br>` : ''}
            ${data.website ? `🌐 <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a><br>` : ''}
          </div>
        </div>
        
        ${data.ctaText && data.ctaUrl ? `
        <div style="margin-top: 20px; text-align: center;">
          <a href="${data.ctaUrl}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(90deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); color: white; text-decoration: none; border-radius: 25px; font-size: 15px; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">${data.ctaText}</a>
        </div>
        ` : ''}
        
        <div style="margin-top: 20px; text-align: center;">
          ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="margin: 0 8px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 28px; height: 28px;"></a>` : ''}
          ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="margin: 0 8px;"><img src="${socialIcons.twitter}" alt="Twitter" style="width: 28px; height: 28px;"></a>` : ''}
          ${data.instagramUrl ? `<a href="${data.instagramUrl}" style="margin: 0 8px;"><img src="${socialIcons.instagram}" alt="Instagram" style="width: 28px; height: 28px;"></a>` : ''}
          ${data.youtubeUrl ? `<a href="${data.youtubeUrl}" style="margin: 0 8px;"><img src="${socialIcons.youtube}" alt="YouTube" style="width: 28px; height: 28px;"></a>` : ''}
        </div>
      </div>
    </td>
  </tr>
</table>`
  },

  // 8. Content Creator - YouTube/Instagram focus, subscriber count, colorful
  {
    id: "content-creator",
    name: "Content Creator",
    description: "YouTube/Instagram focus, subscriber count, colorful",
    thumbnail: "📹",
    colorSchemes: [
      { id: "youtube-red", name: "YouTube Red", primaryColor: "#dc2626", secondaryColor: "#991b1b" },
      { id: "instagram-gradient", name: "Instagram Gradient", primaryColor: "#ec4899", secondaryColor: "#a855f7" },
      { id: "tiktok-black", name: "TikTok Black", primaryColor: "#000000", secondaryColor: "#374151" },
    ],
    fonts: [
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "system", name: "System", family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td style="padding: 20px;">
      <div style="text-align: center;">
        ${data.profilePhotoUrl ? `
        <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 120px; height: 120px; border-radius: 60px; border: 3px solid ${colorScheme.primaryColor}; margin-bottom: 15px;">
        ` : ''}
        <div style="font-size: 28px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 4px;">${data.fullName}</div>
        <div style="font-size: 16px; color: ${colorScheme.secondaryColor}; margin-bottom: 8px;">${data.jobTitle || 'Content Creator'}</div>
        
        ${data.subscriberCount || data.followerCount ? `
        <div style="margin: 20px 0;">
          <span style="display: inline-block; padding: 10px 20px; background: ${colorScheme.primaryColor}; color: white; border-radius: 25px; font-size: 14px; font-weight: bold;">
            ${data.subscriberCount ? `${data.subscriberCount} Subscribers` : `${data.followerCount} Followers`}
          </span>
        </div>
        ` : ''}
        
        <div style="margin: 25px 0;">
          ${data.youtubeUrl ? `<a href="${data.youtubeUrl}" style="display: inline-block; margin: 0 10px;"><img src="${socialIcons.youtube}" alt="YouTube" style="width: 40px; height: 40px;"></a>` : ''}
          ${data.instagramUrl ? `<a href="${data.instagramUrl}" style="display: inline-block; margin: 0 10px;"><img src="${socialIcons.instagram}" alt="Instagram" style="width: 40px; height: 40px;"></a>` : ''}
          ${data.tiktokUrl ? `<a href="${data.tiktokUrl}" style="display: inline-block; margin: 0 10px;"><img src="${socialIcons.tiktok}" alt="TikTok" style="width: 40px; height: 40px;"></a>` : ''}
          ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="display: inline-block; margin: 0 10px;"><img src="${socialIcons.twitter}" alt="Twitter" style="width: 40px; height: 40px;"></a>` : ''}
        </div>
        
        <div style="font-size: 14px; color: #4b5563; line-height: 22px; margin: 20px 0;">
          📧 <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a><br>
          ${data.website ? `🌐 <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a><br>` : ''}
        </div>
        
        ${data.ctaText && data.ctaUrl ? `
        <a href="${data.ctaUrl}" style="display: inline-block; margin-top: 15px; padding: 12px 35px; background: ${colorScheme.primaryColor}; color: white; text-decoration: none; border-radius: 5px; font-size: 14px; font-weight: bold; text-transform: uppercase;">
          ${data.ctaText}
        </a>
        ` : ''}
        
        ${data.companyTagline ? `
        <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #e5e7eb;">
          <div style="font-size: 13px; color: #6b7280; font-style: italic;">"${data.companyTagline}"</div>
        </div>
        ` : ''}
      </div>
    </td>
  </tr>
</table>`
  },

  // 9. Fashion Designer - Stylish layout, Instagram prominent, portfolio images
  {
    id: "fashion-designer",
    name: "Fashion Designer",
    description: "Stylish layout, Instagram prominent, portfolio images",
    thumbnail: "👗",
    colorSchemes: [
      { id: "chic-black", name: "Chic Black", primaryColor: "#000000", secondaryColor: "#374151" },
      { id: "rose-gold", name: "Rose Gold", primaryColor: "#be185d", secondaryColor: "#9f1239" },
      { id: "luxury-purple", name: "Luxury Purple", primaryColor: "#7c3aed", secondaryColor: "#6d28d9" },
    ],
    fonts: [
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
      { id: "playfair", name: "Playfair", family: "'Playfair Display', Georgia, serif" },
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td>
      <div style="background: ${colorScheme.primaryColor}; color: white; padding: 20px; text-align: center;">
        <div style="font-size: 32px; font-weight: 300; letter-spacing: 3px; margin-bottom: 5px;">${data.fullName}</div>
        <div style="font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">${data.jobTitle || 'Fashion Designer'}</div>
      </div>
      
      ${data.bannerImageUrl ? `
      <img src="${data.bannerImageUrl}" alt="Portfolio" style="width: 100%; height: 200px; object-fit: cover;">
      ` : ''}
      
      <div style="padding: 25px; background: #fafafa;">
        <table cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            ${data.profilePhotoUrl ? `
            <td style="width: 100px; padding-right: 25px;">
              <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 100px; height: 100px; object-fit: cover;">
            </td>` : ''}
            <td style="vertical-align: top;">
              <div style="font-size: 14px; color: #374151; line-height: 24px;">
                <div style="margin-bottom: 8px;">
                  <strong style="color: ${colorScheme.primaryColor};">Email:</strong> <a href="mailto:${data.email}" style="color: #374151; text-decoration: none;">${data.email}</a>
                </div>
                ${data.phone ? `
                <div style="margin-bottom: 8px;">
                  <strong style="color: ${colorScheme.primaryColor};">Phone:</strong> ${data.phone}
                </div>` : ''}
                ${data.website ? `
                <div style="margin-bottom: 8px;">
                  <strong style="color: ${colorScheme.primaryColor};">Portfolio:</strong> <a href="${data.website}" style="color: #374151; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a>
                </div>` : ''}
              </div>
              
              <div style="margin-top: 15px;">
                ${data.instagramUrl ? `<a href="${data.instagramUrl}" style="margin-right: 12px;"><img src="${socialIcons.instagram}" alt="Instagram" style="width: 26px; height: 26px;"></a>` : ''}
                ${data.pinterestUrl ? `<a href="${data.pinterestUrl}" style="margin-right: 12px;"><img src="${socialIcons.pinterest}" alt="Pinterest" style="width: 26px; height: 26px;"></a>` : ''}
                ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="margin-right: 12px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 26px; height: 26px;"></a>` : ''}
              </div>
            </td>
          </tr>
        </table>
        
        ${data.companyTagline ? `
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid ${colorScheme.primaryColor};">
          <div style="font-size: 13px; color: ${colorScheme.primaryColor}; font-style: italic; text-align: center;">${data.companyTagline}</div>
        </div>` : ''}
      </div>
    </td>
  </tr>
</table>`
  },

  // 10. Interior Designer - Elegant design, project gallery link, Pinterest
  {
    id: "interior-designer",
    name: "Interior Designer", 
    description: "Elegant design, project gallery link, Pinterest",
    thumbnail: "🏡",
    colorSchemes: [
      { id: "elegant-sage", name: "Elegant Sage", primaryColor: "#65a30d", secondaryColor: "#4d7c0f" },
      { id: "modern-gray", name: "Modern Gray", primaryColor: "#6b7280", secondaryColor: "#4b5563" },
      { id: "warm-terracotta", name: "Warm Terracotta", primaryColor: "#ea580c", secondaryColor: "#dc2626" },
    ],
    fonts: [
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td style="padding: 20px; background: #f9fafb;">
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          ${data.profilePhotoUrl ? `
          <td style="width: 110px; padding-right: 20px;">
            <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 110px; height: 110px; border-radius: 10px; object-fit: cover;">
          </td>` : ''}
          <td style="vertical-align: top;">
            <div style="border-left: 3px solid ${colorScheme.primaryColor}; padding-left: 15px;">
              <div style="font-size: 24px; color: ${colorScheme.primaryColor}; font-weight: 300; margin-bottom: 4px;">${data.fullName}</div>
              <div style="font-size: 15px; color: ${colorScheme.secondaryColor}; margin-bottom: 2px;">${data.jobTitle || 'Interior Designer'}</div>
              <div style="font-size: 14px; color: #6b7280; margin-bottom: 15px;">${data.company}</div>
              
              <div style="font-size: 13px; color: #4b5563; line-height: 20px;">
                <div>📧 <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></div>
                ${data.phone ? `<div>📞 ${data.phone}</div>` : ''}
                ${data.website ? `<div>🎨 <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">View Portfolio</a></div>` : ''}
              </div>
              
              ${data.ctaText && data.ctaUrl ? `
              <div style="margin-top: 15px;">
                <a href="${data.ctaUrl}" style="display: inline-block; padding: 8px 20px; background: ${colorScheme.primaryColor}; color: white; text-decoration: none; border-radius: 4px; font-size: 13px;">${data.ctaText}</a>
              </div>` : ''}
            </div>
          </td>
        </tr>
      </table>
      
      <div style="margin-top: 20px; text-align: center;">
        ${data.pinterestUrl ? `<a href="${data.pinterestUrl}" style="margin: 0 8px;"><img src="${socialIcons.pinterest}" alt="Pinterest" style="width: 24px; height: 24px;"></a>` : ''}
        ${data.instagramUrl ? `<a href="${data.instagramUrl}" style="margin: 0 8px;"><img src="${socialIcons.instagram}" alt="Instagram" style="width: 24px; height: 24px;"></a>` : ''}
        ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="margin: 0 8px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 24px; height: 24px;"></a>` : ''}
      </div>
      
      ${data.companyTagline ? `
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center;">
        <div style="font-size: 12px; color: #6b7280; font-style: italic;">${data.companyTagline}</div>
      </div>` : ''}
    </td>
  </tr>
</table>`
  },

  // 11. Real Estate Agent - Property image banner, "View Listings" CTA, photo
  {
    id: "real-estate-agent",
    name: "Real Estate Agent",
    description: "Property image banner, 'View Listings' CTA, photo",
    thumbnail: "🏘️",
    colorSchemes: [
      { id: "realty-blue", name: "Realty Blue", primaryColor: "#0284c7", secondaryColor: "#0369a1" },
      { id: "luxury-gold", name: "Luxury Gold", primaryColor: "#a16207", secondaryColor: "#854d0e" },
      { id: "modern-green", name: "Modern Green", primaryColor: "#059669", secondaryColor: "#047857" },
    ],
    fonts: [
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td>
      ${data.bannerImageUrl ? `
      <img src="${data.bannerImageUrl}" alt="Property" style="width: 100%; height: 150px; object-fit: cover;">
      ` : `
      <div style="background: linear-gradient(135deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); height: 100px; display: flex; align-items: center; justify-content: center;">
        <div style="color: white; font-size: 24px; font-weight: bold;">YOUR DREAM HOME AWAITS</div>
      </div>
      `}
      
      <div style="padding: 20px; background: white;">
        <table cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            ${data.profilePhotoUrl ? `
            <td style="width: 100px; padding-right: 20px;">
              <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid ${colorScheme.primaryColor};">
            </td>` : ''}
            <td>
              <div style="font-size: 22px; font-weight: bold; color: #111827; margin-bottom: 4px;">${data.fullName}</div>
              <div style="font-size: 16px; color: ${colorScheme.primaryColor}; margin-bottom: 2px;">${data.jobTitle || 'Real Estate Agent'}</div>
              <div style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">${data.company}</div>
              ${data.licenseNumber ? `<div style="font-size: 12px; color: #9ca3af;">License #${data.licenseNumber}</div>` : ''}
            </td>
          </tr>
        </table>
        
        <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px;">
          <div style="font-size: 14px; color: #374151; line-height: 22px;">
            📞 <strong>Call/Text:</strong> ${data.phone || 'N/A'}<br>
            ✉️ <strong>Email:</strong> <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a><br>
            ${data.website ? `🏠 <strong>Website:</strong> <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a><br>` : ''}
          </div>
        </div>
        
        <div style="text-align: center;">
          <a href="${data.ctaUrl || data.website || '#'}" style="display: inline-block; padding: 12px 30px; background: ${colorScheme.primaryColor}; color: white; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: bold;">
            ${data.ctaText || 'View Listings'}
          </a>
        </div>
        
        <div style="margin-top: 20px; text-align: center;">
          ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="margin: 0 10px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 24px; height: 24px;"></a>` : ''}
          ${data.facebookUrl ? `<a href="${data.facebookUrl}" style="margin: 0 10px;"><img src="${socialIcons.facebook}" alt="Facebook" style="width: 24px; height: 24px;"></a>` : ''}
          ${data.instagramUrl ? `<a href="${data.instagramUrl}" style="margin: 0 10px;"><img src="${socialIcons.instagram}" alt="Instagram" style="width: 24px; height: 24px;"></a>` : ''}
        </div>
        
        ${data.companyTagline ? `
        <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #e5e7eb; text-align: center;">
          <div style="font-size: 13px; color: #6b7280; font-style: italic;">"${data.companyTagline}"</div>
        </div>` : ''}
      </div>
    </td>
  </tr>
</table>`
  },

  // 12. Legal Professional - Conservative but modern, firm logo, credentials
  {
    id: "legal-professional",
    name: "Legal Professional",
    description: "Conservative but modern, firm logo, credentials",
    thumbnail: "⚖️",
    colorSchemes: [
      { id: "law-navy", name: "Law Navy", primaryColor: "#1e293b", secondaryColor: "#334155" },
      { id: "legal-burgundy", name: "Legal Burgundy", primaryColor: "#881337", secondaryColor: "#9f1239" },
      { id: "professional-gray", name: "Professional Gray", primaryColor: "#374151", secondaryColor: "#4b5563" },
    ],
    fonts: [
      { id: "times", name: "Times New Roman", family: "Times New Roman, serif" },
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td style="padding: 20px;">
      ${data.logoUrl ? `
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="${data.logoUrl}" alt="${data.company}" style="max-width: 180px; max-height: 60px;">
      </div>` : ''}
      
      <div style="border-top: 2px solid ${colorScheme.primaryColor}; border-bottom: 2px solid ${colorScheme.primaryColor}; padding: 15px 0; margin-bottom: 20px;">
        <div style="font-size: 20px; font-weight: bold; color: ${colorScheme.primaryColor}; text-align: center; margin-bottom: 4px;">${data.fullName}</div>
        <div style="font-size: 14px; color: ${colorScheme.secondaryColor}; text-align: center; margin-bottom: 2px;">${data.jobTitle || 'Attorney at Law'}</div>
        ${data.department ? `<div style="font-size: 13px; color: #6b7280; text-align: center;">${data.department}</div>` : ''}
        ${data.licenseNumber ? `<div style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 4px;">Bar #${data.licenseNumber}</div>` : ''}
      </div>
      
      <table cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 20px;">
        <tr>
          <td style="width: 50%; padding-right: 10px;">
            <div style="font-size: 13px; color: #374151;">
              <strong>Direct:</strong> ${data.phone || 'N/A'}<br>
              ${data.mobile ? `<strong>Mobile:</strong> ${data.mobile}<br>` : ''}
              <strong>Email:</strong> <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a>
            </div>
          </td>
          <td style="width: 50%; padding-left: 10px;">
            <div style="font-size: 13px; color: #374151;">
              <strong>${data.company}</strong><br>
              ${data.address || ''}
              ${data.website ? `<br><a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a>` : ''}
            </div>
          </td>
        </tr>
      </table>
      
      <div style="font-size: 11px; color: #6b7280; line-height: 16px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
        <em>This email message is for the sole use of the intended recipient(s) and may contain confidential and privileged information protected by law. Any unauthorized review, use, disclosure or distribution is prohibited.</em>
      </div>
    </td>
  </tr>
</table>`
  },

  // 13. Healthcare Provider - Medical icons, appointment booking link, clean  
  {
    id: "healthcare-provider",
    name: "Healthcare Provider",
    description: "Medical icons, appointment booking link, clean",
    thumbnail: "🏥",
    colorSchemes: [
      { id: "medical-blue", name: "Medical Blue", primaryColor: "#0891b2", secondaryColor: "#0e7490" },
      { id: "health-green", name: "Health Green", primaryColor: "#059669", secondaryColor: "#047857" },
      { id: "care-purple", name: "Care Purple", primaryColor: "#7c3aed", secondaryColor: "#6d28d9" },
    ],
    fonts: [
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "system", name: "System", family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td style="padding: 20px; background: #f8fafc;">
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          ${data.profilePhotoUrl ? `
          <td style="width: 90px; padding-right: 20px;">
            <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 90px; height: 90px; border-radius: 45px; object-fit: cover;">
          </td>` : ''}
          <td>
            <div style="font-size: 20px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 2px;">${data.fullName}</div>
            <div style="font-size: 15px; color: ${colorScheme.secondaryColor}; margin-bottom: 2px;">${data.jobTitle || 'Healthcare Professional'}</div>
            <div style="font-size: 14px; color: #6b7280;">${data.company}</div>
            ${data.department ? `<div style="font-size: 13px; color: #9ca3af; margin-top: 2px;">${data.department}</div>` : ''}
          </td>
        </tr>
      </table>
      
      <div style="margin: 20px 0; padding: 15px; background: white; border-radius: 8px;">
        <div style="font-size: 14px; color: #374151; line-height: 24px;">
          <div>📞 <strong>Phone:</strong> ${data.phone || 'N/A'}</div>
          <div>📧 <strong>Email:</strong> <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></div>
          ${data.officeHours ? `<div>🕐 <strong>Office Hours:</strong> ${data.officeHours}</div>` : ''}
          ${data.address ? `<div>📍 <strong>Location:</strong> ${data.address}</div>` : ''}
        </div>
      </div>
      
      ${data.calendlyUrl || data.ctaUrl ? `
      <div style="text-align: center; margin: 20px 0;">
        <a href="${data.calendlyUrl || data.ctaUrl}" style="display: inline-block; padding: 12px 28px; background: ${colorScheme.primaryColor}; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold;">
          📅 ${data.ctaText || 'Book Appointment'}
        </a>
      </div>` : ''}
      
      ${data.website ? `
      <div style="text-align: center; margin: 15px 0;">
        <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none; font-size: 14px;">Visit our website →</a>
      </div>` : ''}
      
      <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
        <div style="font-size: 12px; color: #6b7280;">Committed to Your Health and Well-being</div>
      </div>
    </td>
  </tr>
</table>`
  },

  // 14. Financial Advisor - Trust badges, calendar link, professional photo
  {
    id: "financial-advisor",
    name: "Financial Advisor",
    description: "Trust badges, calendar link, professional photo",
    thumbnail: "💼",
    colorSchemes: [
      { id: "finance-blue", name: "Finance Blue", primaryColor: "#1e40af", secondaryColor: "#1e3a8a" },
      { id: "wealth-green", name: "Wealth Green", primaryColor: "#15803d", secondaryColor: "#166534" },
      { id: "trust-gray", name: "Trust Gray", primaryColor: "#475569", secondaryColor: "#334155" },
    ],
    fonts: [
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td style="padding: 20px;">
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          ${data.profilePhotoUrl ? `
          <td style="width: 100px; padding-right: 20px;">
            <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 100px; height: 100px; border-radius: 8px; object-fit: cover;">
          </td>` : ''}
          <td>
            <div style="font-size: 22px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 4px;">${data.fullName}</div>
            <div style="font-size: 16px; color: ${colorScheme.secondaryColor}; margin-bottom: 2px;">${data.jobTitle || 'Financial Advisor'}</div>
            <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">${data.company}</div>
            ${data.certifications ? `
            <div style="display: inline-block; padding: 4px 10px; background: ${colorScheme.primaryColor}20; color: ${colorScheme.primaryColor}; border-radius: 4px; font-size: 12px; font-weight: bold;">
              ${data.certifications}
            </div>` : ''}
          </td>
        </tr>
      </table>
      
      <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-left: 3px solid ${colorScheme.primaryColor};">
        <div style="font-size: 14px; color: #374151; line-height: 22px;">
          <strong>Direct:</strong> ${data.phone || 'N/A'}<br>
          <strong>Email:</strong> <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a><br>
          ${data.website ? `<strong>Website:</strong> <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a><br>` : ''}
          ${data.address ? `<strong>Office:</strong> ${data.address}` : ''}
        </div>
      </div>
      
      ${data.calendlyUrl || data.meetingLink ? `
      <div style="text-align: center; margin: 20px 0;">
        <a href="${data.calendlyUrl || data.meetingLink}" style="display: inline-block; padding: 12px 30px; background: ${colorScheme.primaryColor}; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold;">
          📅 Schedule a Consultation
        </a>
      </div>` : ''}
      
      <div style="text-align: center; margin-top: 20px;">
        ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="margin: 0 10px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 24px; height: 24px;"></a>` : ''}
      </div>
      
      ${data.companyTagline ? `
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center;">
        <div style="font-size: 13px; color: #6b7280; font-style: italic;">"${data.companyTagline}"</div>
      </div>` : ''}
    </td>
  </tr>
</table>`
  },

  // 15. Insurance Agent (Modern Version) - Modern with photo, coverage icons, "Get Quote" CTA
  {
    id: "insurance-agent-modern",
    name: "Insurance Agent (Modern)",
    description: "Modern version with photo, coverage icons, 'Get Quote' CTA",
    thumbnail: "🛡️",
    colorSchemes: [
      { id: "insurance-blue", name: "Insurance Blue", primaryColor: "#2563eb", secondaryColor: "#1d4ed8" },
      { id: "secure-green", name: "Secure Green", primaryColor: "#16a34a", secondaryColor: "#15803d" },
      { id: "trust-purple", name: "Trust Purple", primaryColor: "#9333ea", secondaryColor: "#7c3aed" },
    ],
    fonts: [
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "system", name: "System", family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td style="padding: 20px;">
      <div style="background: linear-gradient(135deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); padding: 25px; border-radius: 10px; color: white;">
        <table cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            ${data.profilePhotoUrl ? `
            <td style="width: 100px; padding-right: 20px;">
              <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid white;">
            </td>` : ''}
            <td>
              <div style="font-size: 24px; font-weight: bold; margin-bottom: 4px;">${data.fullName}</div>
              <div style="font-size: 16px; opacity: 0.95; margin-bottom: 2px;">${data.jobTitle || 'Insurance Agent'}</div>
              <div style="font-size: 14px; opacity: 0.9;">${data.company}</div>
            </td>
          </tr>
        </table>
      </div>
      
      <div style="margin: 20px 0; text-align: center;">
        <span style="display: inline-block; margin: 5px; padding: 8px 15px; background: #f3f4f6; border-radius: 20px; font-size: 13px;">🏠 Home</span>
        <span style="display: inline-block; margin: 5px; padding: 8px 15px; background: #f3f4f6; border-radius: 20px; font-size: 13px;">🚗 Auto</span>
        <span style="display: inline-block; margin: 5px; padding: 8px 15px; background: #f3f4f6; border-radius: 20px; font-size: 13px;">☂️ Umbrella</span>
        <span style="display: inline-block; margin: 5px; padding: 8px 15px; background: #f3f4f6; border-radius: 20px; font-size: 13px;">💼 Business</span>
      </div>
      
      <div style="padding: 15px; background: #f9fafb; border-radius: 8px;">
        <div style="font-size: 14px; color: #374151; line-height: 24px;">
          📞 <strong>Call/Text:</strong> ${data.phone || 'N/A'}<br>
          📧 <strong>Email:</strong> <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a><br>
          ${data.website ? `🌐 <strong>Website:</strong> <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a>` : ''}
        </div>
      </div>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="${data.ctaUrl || '#'}" style="display: inline-block; padding: 12px 35px; background: ${colorScheme.primaryColor}; color: white; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: bold;">
          ${data.ctaText || 'Get a Free Quote'}
        </a>
      </div>
      
      <div style="text-align: center;">
        ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="margin: 0 8px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 24px; height: 24px;"></a>` : ''}
        ${data.facebookUrl ? `<a href="${data.facebookUrl}" style="margin: 0 8px;"><img src="${socialIcons.facebook}" alt="Facebook" style="width: 24px; height: 24px;"></a>` : ''}
      </div>
    </td>
  </tr>
</table>`
  },

  // 16. Gradient Modern - Purple/pink gradients, rounded corners, social icons
  {
    id: "gradient-modern",
    name: "Gradient Modern",
    description: "Purple/pink gradients, rounded corners, social icons",
    thumbnail: "🌈",
    colorSchemes: [
      { id: "purple-pink", name: "Purple Pink", primaryColor: "#a855f7", secondaryColor: "#ec4899" },
      { id: "blue-green", name: "Blue Green", primaryColor: "#3b82f6", secondaryColor: "#10b981" },
      { id: "orange-yellow", name: "Orange Yellow", primaryColor: "#f97316", secondaryColor: "#fbbf24" },
    ],
    fonts: [
      { id: "system", name: "System", family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td style="padding: 20px;">
      <div style="background: linear-gradient(135deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); padding: 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
        <div style="text-align: center;">
          ${data.profilePhotoUrl ? `
          <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 120px; height: 120px; border-radius: 60px; border: 4px solid white; margin-bottom: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
          ` : ''}
          <div style="color: white; font-size: 28px; font-weight: bold; margin-bottom: 4px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${data.fullName}</div>
          <div style="color: rgba(255,255,255,0.95); font-size: 16px; margin-bottom: 2px;">${data.jobTitle}</div>
          <div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 20px;">${data.company}</div>
          
          <div style="background: white; padding: 20px; border-radius: 15px; margin-bottom: 20px;">
            <div style="font-size: 14px; color: #374151; line-height: 24px;">
              📧 <a href="mailto:${data.email}" style="background: linear-gradient(90deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-decoration: none; font-weight: 600;">${data.email}</a><br>
              ${data.phone ? `📱 ${data.phone}<br>` : ''}
              ${data.website ? `🌐 <a href="${data.website}" style="background: linear-gradient(90deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-decoration: none; font-weight: 600;">${data.website.replace(/^https?:\/\//, '')}</a>` : ''}
            </div>
          </div>
          
          <div>
            ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="margin: 0 8px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 32px; height: 32px; filter: brightness(0) invert(1);"></a>` : ''}
            ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="margin: 0 8px;"><img src="${socialIcons.twitter}" alt="Twitter" style="width: 32px; height: 32px; filter: brightness(0) invert(1);"></a>` : ''}
            ${data.instagramUrl ? `<a href="${data.instagramUrl}" style="margin: 0 8px;"><img src="${socialIcons.instagram}" alt="Instagram" style="width: 32px; height: 32px; filter: brightness(0) invert(1);"></a>` : ''}
          </div>
        </div>
      </div>
    </td>
  </tr>
</table>`
  },

  // 17. Dark Mode - Black background, white text, colored accents
  {
    id: "dark-mode",
    name: "Dark Mode",
    description: "Black background, white text, colored accents",
    thumbnail: "🌙",
    colorSchemes: [
      { id: "dark-blue", name: "Dark Blue", primaryColor: "#3b82f6", secondaryColor: "#60a5fa" },
      { id: "dark-green", name: "Dark Green", primaryColor: "#10b981", secondaryColor: "#34d399" },
      { id: "dark-purple", name: "Dark Purple", primaryColor: "#a855f7", secondaryColor: "#c084fc" },
    ],
    fonts: [
      { id: "system", name: "System", family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "courier", name: "Courier", family: "'Courier New', Courier, monospace" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px; background: #000000;">
  <tr>
    <td style="padding: 30px;">
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          ${data.profilePhotoUrl ? `
          <td style="width: 80px; padding-right: 20px;">
            <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 80px; height: 80px; border-radius: 8px; border: 2px solid ${colorScheme.primaryColor};">
          </td>` : ''}
          <td>
            <div style="font-size: 24px; font-weight: bold; color: #ffffff; margin-bottom: 4px;">${data.fullName}</div>
            <div style="font-size: 16px; color: ${colorScheme.primaryColor}; margin-bottom: 2px;">${data.jobTitle}</div>
            <div style="font-size: 14px; color: #9ca3af;">${data.company}</div>
          </td>
        </tr>
      </table>
      
      <div style="margin: 25px 0; padding: 20px; background: #111111; border-left: 3px solid ${colorScheme.primaryColor}; border-radius: 4px;">
        <div style="font-size: 14px; color: #e5e7eb; line-height: 24px;">
          <div>📧 <a href="mailto:${data.email}" style="color: ${colorScheme.secondaryColor}; text-decoration: none;">${data.email}</a></div>
          ${data.phone ? `<div>📱 <span style="color: #e5e7eb;">${data.phone}</span></div>` : ''}
          ${data.website ? `<div>🌐 <a href="${data.website}" style="color: ${colorScheme.secondaryColor}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a></div>` : ''}
        </div>
      </div>
      
      ${data.ctaText && data.ctaUrl ? `
      <div style="margin: 25px 0;">
        <a href="${data.ctaUrl}" style="display: inline-block; padding: 12px 28px; background: ${colorScheme.primaryColor}; color: white; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: bold;">${data.ctaText}</a>
      </div>` : ''}
      
      <div style="margin-top: 25px;">
        ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="margin-right: 15px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 24px; height: 24px; filter: brightness(0) invert(1);"></a>` : ''}
        ${data.githubUrl ? `<a href="${data.githubUrl}" style="margin-right: 15px;"><img src="${socialIcons.github}" alt="GitHub" style="width: 24px; height: 24px; filter: brightness(0) invert(1);"></a>` : ''}
        ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="margin-right: 15px;"><img src="${socialIcons.twitter}" alt="Twitter" style="width: 24px; height: 24px; filter: brightness(0) invert(1);"></a>` : ''}
      </div>
      
      ${data.companyTagline ? `
      <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #374151;">
        <div style="font-size: 13px; color: #6b7280; font-style: italic;">"${data.companyTagline}"</div>
      </div>` : ''}
    </td>
  </tr>
</table>`
  },

  // 18. Minimalist Card - Card-style layout, subtle shadows, clean
  {
    id: "minimalist-card",
    name: "Minimalist Card",
    description: "Card-style layout, subtle shadows, clean",
    thumbnail: "🎴",
    colorSchemes: [
      { id: "minimal-blue", name: "Minimal Blue", primaryColor: "#3b82f6", secondaryColor: "#93c5fd" },
      { id: "minimal-gray", name: "Minimal Gray", primaryColor: "#4b5563", secondaryColor: "#9ca3af" },
      { id: "minimal-green", name: "Minimal Green", primaryColor: "#059669", secondaryColor: "#6ee7b7" },
    ],
    fonts: [
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 400px;">
  <tr>
    <td>
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        ${data.profilePhotoUrl ? `
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 80px; height: 80px; border-radius: 40px; object-fit: cover;">
        </div>` : ''}
        
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="font-size: 20px; font-weight: 600; color: #111827; margin-bottom: 4px;">${data.fullName}</div>
          <div style="font-size: 14px; color: ${colorScheme.primaryColor}; margin-bottom: 2px;">${data.jobTitle}</div>
          <div style="font-size: 13px; color: #6b7280;">${data.company}</div>
        </div>
        
        <div style="border-top: 1px solid #f3f4f6; border-bottom: 1px solid #f3f4f6; padding: 15px 0; margin-bottom: 20px;">
          <div style="font-size: 13px; color: #4b5563; line-height: 20px;">
            <div style="margin: 4px 0;"><a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></div>
            ${data.phone ? `<div style="margin: 4px 0;">${data.phone}</div>` : ''}
            ${data.website ? `<div style="margin: 4px 0;"><a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a></div>` : ''}
          </div>
        </div>
        
        <div style="text-align: center;">
          ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="margin: 0 6px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 20px; height: 20px;"></a>` : ''}
          ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="margin: 0 6px;"><img src="${socialIcons.twitter}" alt="Twitter" style="width: 20px; height: 20px;"></a>` : ''}
          ${data.instagramUrl ? `<a href="${data.instagramUrl}" style="margin: 0 6px;"><img src="${socialIcons.instagram}" alt="Instagram" style="width: 20px; height: 20px;"></a>` : ''}
        </div>
      </div>
    </td>
  </tr>
</table>`
  },

  // 19. Bold & Colorful - Bright colors, large photo, eye-catching
  {
    id: "bold-colorful",
    name: "Bold & Colorful",
    description: "Bright colors, large photo, eye-catching",
    thumbnail: "🎨",
    colorSchemes: [
      { id: "vibrant-red", name: "Vibrant Red", primaryColor: "#ef4444", secondaryColor: "#f87171" },
      { id: "electric-blue", name: "Electric Blue", primaryColor: "#0ea5e9", secondaryColor: "#38bdf8" },
      { id: "hot-pink", name: "Hot Pink", primaryColor: "#ec4899", secondaryColor: "#f9a8d4" },
    ],
    fonts: [
      { id: "system", name: "System", family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td>
      <div style="background: ${colorScheme.primaryColor}; padding: 30px; position: relative;">
        ${data.profilePhotoUrl ? `
        <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 150px; height: 150px; border-radius: 10px; border: 4px solid white; margin-bottom: 20px; box-shadow: 0 8px 20px rgba(0,0,0,0.3);">
        ` : ''}
        <div style="color: white;">
          <div style="font-size: 32px; font-weight: bold; margin-bottom: 4px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${data.fullName}</div>
          <div style="font-size: 20px; margin-bottom: 2px;">${data.jobTitle}</div>
          <div style="font-size: 16px; opacity: 0.9;">${data.company}</div>
        </div>
      </div>
      
      <div style="background: white; padding: 25px;">
        <div style="font-size: 15px; color: #374151; line-height: 26px;">
          <div style="margin-bottom: 10px;">
            <span style="display: inline-block; width: 30px; height: 30px; background: ${colorScheme.primaryColor}; color: white; border-radius: 15px; text-align: center; line-height: 30px; margin-right: 10px;">📧</span>
            <a href="mailto:${data.email}" style="color: #374151; text-decoration: none; font-weight: 500;">${data.email}</a>
          </div>
          ${data.phone ? `
          <div style="margin-bottom: 10px;">
            <span style="display: inline-block; width: 30px; height: 30px; background: ${colorScheme.primaryColor}; color: white; border-radius: 15px; text-align: center; line-height: 30px; margin-right: 10px;">📱</span>
            ${data.phone}
          </div>` : ''}
          ${data.website ? `
          <div style="margin-bottom: 10px;">
            <span style="display: inline-block; width: 30px; height: 30px; background: ${colorScheme.primaryColor}; color: white; border-radius: 15px; text-align: center; line-height: 30px; margin-right: 10px;">🌐</span>
            <a href="${data.website}" style="color: #374151; text-decoration: none; font-weight: 500;">${data.website.replace(/^https?:\/\//, '')}</a>
          </div>` : ''}
        </div>
        
        <div style="margin-top: 25px; text-align: center;">
          ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="display: inline-block; margin: 0 8px; padding: 8px; background: ${colorScheme.secondaryColor}; border-radius: 8px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 24px; height: 24px;"></a>` : ''}
          ${data.instagramUrl ? `<a href="${data.instagramUrl}" style="display: inline-block; margin: 0 8px; padding: 8px; background: ${colorScheme.secondaryColor}; border-radius: 8px;"><img src="${socialIcons.instagram}" alt="Instagram" style="width: 24px; height: 24px;"></a>` : ''}
          ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="display: inline-block; margin: 0 8px; padding: 8px; background: ${colorScheme.secondaryColor}; border-radius: 8px;"><img src="${socialIcons.twitter}" alt="Twitter" style="width: 24px; height: 24px;"></a>` : ''}
        </div>
      </div>
    </td>
  </tr>
</table>`
  },

  // 20. Trendy Influencer - Instagram/TikTok focus, follower counts, links
  {
    id: "trendy-influencer",
    name: "Trendy Influencer",
    description: "Instagram/TikTok focus, follower counts, links",
    thumbnail: "✨",
    colorSchemes: [
      { id: "insta-gradient", name: "Instagram Gradient", primaryColor: "#e1306c", secondaryColor: "#f56040" },
      { id: "tiktok-style", name: "TikTok Style", primaryColor: "#ff0050", secondaryColor: "#00f2ea" },
      { id: "youtube-vibe", name: "YouTube Vibe", primaryColor: "#ff0000", secondaryColor: "#282828" },
    ],
    fonts: [
      { id: "system", name: "System", family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td style="padding: 20px; background: linear-gradient(135deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor});">
      <div style="background: white; border-radius: 20px; padding: 25px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
        <div style="text-align: center;">
          ${data.profilePhotoUrl ? `
          <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 130px; height: 130px; border-radius: 65px; border: 3px solid ${colorScheme.primaryColor}; margin-bottom: 15px;">
          ` : ''}
          
          <div style="font-size: 26px; font-weight: bold; color: #111827; margin-bottom: 4px;">${data.fullName}</div>
          <div style="font-size: 16px; color: ${colorScheme.primaryColor}; margin-bottom: 15px;">@${data.username || data.fullName.toLowerCase().replace(/\s+/g, '')}</div>
          
          ${data.followerCount || data.subscriberCount ? `
          <div style="display: flex; justify-content: center; gap: 20px; margin: 20px 0;">
            ${data.followerCount ? `
            <div>
              <div style="font-size: 22px; font-weight: bold; color: #111827;">${data.followerCount}</div>
              <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Followers</div>
            </div>` : ''}
            ${data.subscriberCount ? `
            <div>
              <div style="font-size: 22px; font-weight: bold; color: #111827;">${data.subscriberCount}</div>
              <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Subscribers</div>
            </div>` : ''}
          </div>
          ` : ''}
          
          <div style="margin: 25px 0;">
            ${data.instagramUrl ? `<a href="${data.instagramUrl}" style="display: inline-block; margin: 0 10px;"><img src="${socialIcons.instagram}" alt="Instagram" style="width: 36px; height: 36px;"></a>` : ''}
            ${data.tiktokUrl ? `<a href="${data.tiktokUrl}" style="display: inline-block; margin: 0 10px;"><img src="${socialIcons.tiktok}" alt="TikTok" style="width: 36px; height: 36px;"></a>` : ''}
            ${data.youtubeUrl ? `<a href="${data.youtubeUrl}" style="display: inline-block; margin: 0 10px;"><img src="${socialIcons.youtube}" alt="YouTube" style="width: 36px; height: 36px;"></a>` : ''}
            ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="display: inline-block; margin: 0 10px;"><img src="${socialIcons.twitter}" alt="Twitter" style="width: 36px; height: 36px;"></a>` : ''}
          </div>
          
          ${data.ctaText && data.ctaUrl ? `
          <a href="${data.ctaUrl}" style="display: inline-block; padding: 12px 40px; background: linear-gradient(90deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); color: white; text-decoration: none; border-radius: 25px; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
            ${data.ctaText}
          </a>
          ` : ''}
          
          <div style="margin-top: 20px; font-size: 13px; color: #6b7280;">
            📧 <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a>
          </div>
          
          ${data.companyTagline ? `
          <div style="margin-top: 15px; font-size: 14px; color: #4b5563; font-style: italic;">
            "${data.companyTagline}"
          </div>` : ''}
        </div>
      </div>
    </td>
  </tr>
</table>`
  },

];

// Sample data removed - using empty form defaults

export default function EmailSignaturesPage() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>(emailTemplates[0]);
  const [selectedColorScheme, setSelectedColorScheme] = useState(emailTemplates[0].colorSchemes[0]);
  const [selectedFont, setSelectedFont] = useState(emailTemplates[0].fonts[0]);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [selectedTab, setSelectedTab] = useState("templates");

  // Form setup
  const form = useForm<SignatureFormData>({
    resolver: zodResolver(signatureFormSchema),
    defaultValues: {
      fullName: "",
      jobTitle: "",
      company: "",
      email: "",
      phone: "",
      mobile: "",
      website: "",
      linkedinUrl: "",
      twitterUrl: "",
      facebookUrl: "",
      instagramUrl: "",
      githubUrl: "",
      youtubeUrl: "",
      address: "",
      logoUrl: "",
      profilePhotoUrl: "",
      bannerText: "",
      bannerUrl: "",
      disclaimerText: "",
      companyTagline: "",
      licenseNumber: "",
      carriers: "",
      specializations: "",
      officeHours: "",
      emergencyContact: "",
      tiktokUrl: "",
      pinterestUrl: "",
      dribbbleUrl: "",
      behanceUrl: "",
      bannerImageUrl: "",
      ctaText: "",
      ctaUrl: "",
      calendlyUrl: "",
      meetingLink: "",
      username: "",
      certifications: "",
      department: "",
      pronouns: "",
      customField1Name: "",
      customField1Value: "",
      customField2Name: "",
      customField2Value: "",
      followerCount: "",
      subscriberCount: "",
    },
    mode: "onChange",
  });

  const watchedValues = form.watch();

  // Generate HTML when form values change
  useEffect(() => {
    const { fullName, jobTitle, company, email } = watchedValues;
    if (fullName && jobTitle && company && email) {
      const html = selectedTemplate.generateHtml(
        watchedValues,
        selectedColorScheme,
        selectedFont
      );
      setGeneratedHtml(html);
    }
  }, [watchedValues, selectedTemplate, selectedColorScheme, selectedFont]);

  // Template change handler
  const handleTemplateChange = (templateId: string) => {
    const template = emailTemplates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setSelectedColorScheme(template.colorSchemes[0]);
      setSelectedFont(template.fonts[0]);
    }
  };

  // Copy functionality
  const handleCopyHtml = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(generatedHtml);
      toast({
        title: "Copied!",
        description: "Email signature HTML copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsCopying(false);
    }
  };

  // Download functionality
  const handleDownloadHtml = () => {
    const blob = new Blob([generatedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "email-signature.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded!",
      description: "Email signature saved as HTML file",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Email Signature Generator</h1>
        <p className="text-gray-600">Create a professional email signature with our modern templates</p>
      </div>

      <Tabs defaultValue="templates" value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="w-full">
          <TabsTrigger value="templates" className="flex-1">Templates</TabsTrigger>
          <TabsTrigger value="customize" className="flex-1">Customize</TabsTrigger>
          <TabsTrigger value="preview" className="flex-1">Preview & Export</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {emailTemplates.map((template) => (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedTemplate.id === template.id ? "ring-2 ring-blue-500" : ""
                }`}
                onClick={() => handleTemplateChange(template.id)}
              >
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-2">{template.thumbnail}</div>
                  <div className="font-semibold">{template.name}</div>
                  <div className="text-sm text-gray-600 mt-1">{template.description}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="customize" className="space-y-6">
          <Form {...form}>
            <form className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name*</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} data-testid="input-fullName" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="jobTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Title*</FormLabel>
                          <FormControl>
                            <Input placeholder="Marketing Manager" {...field} data-testid="input-jobTitle" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company*</FormLabel>
                          <FormControl>
                            <Input placeholder="Tech Corp" {...field} data-testid="input-company" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email*</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+1 (555) 123-4567" {...field} data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mobile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mobile</FormLabel>
                          <FormControl>
                            <Input placeholder="+1 (555) 987-6543" {...field} data-testid="input-mobile" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com" {...field} data-testid="input-website" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St, City, State 12345" {...field} data-testid="input-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Branding & Visual</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="logoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Logo URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com/logo.png" {...field} data-testid="input-logoUrl" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="profilePhotoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profile Photo URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com/photo.jpg" {...field} data-testid="input-profilePhotoUrl" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bannerImageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Banner Image URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com/banner.jpg" {...field} data-testid="input-bannerImageUrl" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="companyTagline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Tagline</FormLabel>
                          <FormControl>
                            <Input placeholder="Your success is our priority" {...field} data-testid="input-companyTagline" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
        <div style="font-size: 13px; color: ${colorScheme.secondaryColor}; font-weight: bold; text-align: center;">
          "Leading Excellence in Insurance Services"
        </div>
        ${data.linkedinUrl ? `
        <div style="text-align: center; margin-top: 8px;">
          <a href="${data.linkedinUrl}" style="text-decoration: none;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 24px; height: 24px;"></a>
        </div>` : ''}
      </div>
    </td>
  </tr>
</table>`
  },

  // 10. Personal Lines Agent
  {
    id: "personal-lines",
    name: "Personal Lines Agent",
    description: "Friendly yet professional design",
    thumbnail: "🏠",
    colorSchemes: [
      { id: "friendly-blue", name: "Friendly Blue", primaryColor: "#0ea5e9", secondaryColor: "#0284c7" },
      { id: "warm-green", name: "Warm Green", primaryColor: "#22c55e", secondaryColor: "#16a34a" },
      { id: "trust-purple", name: "Trust Purple", primaryColor: "#8b5cf6", secondaryColor: "#7c3aed" },
    ],
    fonts: [
      { id: "verdana", name: "Verdana", family: "Verdana, sans-serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "calibri", name: "Calibri", family: "Calibri, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td>
      <div style="background: #ffffff; padding: 20px; border: 2px solid ${colorScheme.primaryColor}; border-radius: 10px;">
        <table cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            ${data.profilePhotoUrl ? `
            <td style="width: 90px; padding-right: 15px;">
              <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 90px; height: 90px; border-radius: 45px; border: 3px solid ${colorScheme.primaryColor};">
            </td>` : ''}
            <td>
              <div style="font-size: 22px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 4px;">${data.fullName}</div>
              <div style="font-size: 14px; color: ${colorScheme.secondaryColor}; margin-bottom: 2px;">${data.jobTitle}</div>
              <div style="font-size: 13px; color: #4b5563;">Personal Lines Insurance</div>
              ${data.licenseNumber ? `<div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">Lic: ${data.licenseNumber}</div>` : ''}
            </td>
          </tr>
        </table>
        
        <div style="margin: 15px 0; padding: 12px; background: ${colorScheme.primaryColor}10; border-radius: 6px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size: 13px; color: #374151; padding: 3px 0;">
                📞 <strong>Call/Text:</strong> <a href="tel:${data.phone}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.phone || 'N/A'}</a>
              </td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #374151; padding: 3px 0;">
                ✉️ <strong>Email:</strong> <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a>
              </td>
            </tr>
            ${data.officeHours ? `
            <tr>
              <td style="font-size: 13px; color: #374151; padding: 3px 0;">
                🕐 <strong>Available:</strong> ${data.officeHours}
              </td>
            </tr>` : ''}
            ${data.website ? `
            <tr>
              <td style="font-size: 13px; color: #374151; padding: 3px 0;">
                🌐 <strong>Web:</strong> <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website}</a>
              </td>
            </tr>` : ''}
          </table>
        </div>
        
        ${data.specializations ? `
        <div style="padding: 10px; background: #f0fdf4; border-left: 3px solid ${colorScheme.primaryColor}; margin-bottom: 12px;">
          <div style="font-size: 11px; color: ${colorScheme.primaryColor}; font-weight: bold; margin-bottom: 2px;">I SPECIALIZE IN</div>
          <div style="font-size: 12px; color: #374151;">${data.specializations}</div>
        </div>` : ''}
        
        ${data.companyTagline || data.bannerText ? `
        <div style="text-align: center; padding: 10px; background: ${colorScheme.primaryColor}; color: white; border-radius: 6px;">
          <div style="font-size: 14px; font-weight: bold;">${data.companyTagline || data.bannerText || 'Your Trusted Insurance Partner'}</div>
          ${data.bannerUrl ? `<a href="${data.bannerUrl}" style="color: white; font-size: 12px;">Get Your Free Quote →</a>` : ''}
        </div>` : ''}
        
        ${data.carriers ? `
        <div style="margin-top: 10px; font-size: 11px; color: #6b7280; text-align: center;">
          Representing: ${data.carriers}
        </div>` : ''}
      </div>
    </td>
  </tr>
</table>`
  },
];

export default function EmailSignaturesPage() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>(emailTemplates[0]);
  const [selectedColorScheme, setSelectedColorScheme] = useState(emailTemplates[0].colorSchemes[0]);
  const [selectedFont, setSelectedFont] = useState(emailTemplates[0].fonts[0]);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [selectedTab, setSelectedTab] = useState("templates");

  // Form setup
  const form = useForm<SignatureFormData>({
    resolver: zodResolver(signatureFormSchema),
    defaultValues: {
      fullName: "",
      jobTitle: "",
      company: "",
      email: "",
      phone: "",
      mobile: "",
      website: "",
      linkedinUrl: "",
      twitterUrl: "",
      facebookUrl: "",
      instagramUrl: "",
      githubUrl: "",
      youtubeUrl: "",
      address: "",
      logoUrl: "",
      profilePhotoUrl: "",
      bannerText: "",
      bannerUrl: "",
      disclaimerText: "",
      companyTagline: "",
      licenseNumber: "",
      carriers: "",
      specializations: "",
      officeHours: "",
      emergencyContact: "",
    },
    mode: "onChange",
  });

  const watchedValues = form.watch();

  // Generate HTML when form values change
  useEffect(() => {
    const { fullName, jobTitle, company, email } = watchedValues;
    if (fullName && jobTitle && company && email) {
      const html = selectedTemplate.generateHtml(
        watchedValues,
        selectedColorScheme,
        selectedFont
      );
      setGeneratedHtml(html);
    } else {
      setGeneratedHtml("");
    }
  }, [watchedValues, selectedTemplate, selectedColorScheme, selectedFont]);

  // Handle template selection
  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setSelectedColorScheme(template.colorSchemes[0]);
    setSelectedFont(template.fonts[0]);
  };

  // Copy HTML to clipboard
  const handleCopyHtml = async () => {
    if (!generatedHtml) {
      toast({
        title: "Error",
        description: "Please complete the required fields first",
        variant: "destructive",
      });
      return;
    }

    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(generatedHtml);
      toast({
        title: "Copied!",
        description: "HTML code has been copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy code",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setIsCopying(false), 1000);
    }
  };

  // Download HTML file
  const handleDownloadHtml = () => {
    if (!generatedHtml) {
      toast({
        title: "Error",
        description: "Please complete the required fields first",
        variant: "destructive",
      });
      return;
    }

    const blob = new Blob([generatedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "email-signature.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded!",
      description: "The HTML file has been downloaded",
    });
  };

  // Load sample data for testing - Insurance specific
  const loadSampleData = () => {
    form.setValue("fullName", "Michael Thompson");
    form.setValue("jobTitle", "Senior Insurance Advisor");
    form.setValue("company", "State Farm Insurance");
    form.setValue("email", "michael.thompson@statefarm.com");
    form.setValue("phone", "+1 (555) 123-4567");
    form.setValue("mobile", "+1 (555) 987-6543");
    form.setValue("website", "https://www.statefarm.com/agent/michael-thompson");
    form.setValue("linkedinUrl", "https://linkedin.com/in/michaelthompson");
    form.setValue("address", "123 Insurance Plaza, Suite 200, Chicago, IL 60601");
    form.setValue("companyTagline", "Protecting What Matters Most");
    form.setValue("bannerText", "Get Your Free Insurance Quote Today!");
    form.setValue("bannerUrl", "https://www.statefarm.com/quotes");
    form.setValue("licenseNumber", "IL-2024-987654");
    form.setValue("carriers", "State Farm, Allstate, Progressive, Liberty Mutual");
    form.setValue("specializations", "Auto, Home, Life, Business Insurance");
    form.setValue("officeHours", "Mon-Fri 9AM-6PM, Sat 10AM-2PM");
    form.setValue("emergencyContact", "+1 (800) 555-CLAIM");
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Insurance Agent Email Signature Generator</h1>
            <p className="text-muted-foreground">
              Create professional email signatures designed specifically for insurance professionals
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadSampleData}
            data-testid="button-load-sample"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Load Insurance Example
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Template Selector & Form */}
        <div className="lg:col-span-7">
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
              <TabsTrigger value="data" data-testid="tab-data">Information</TabsTrigger>
              <TabsTrigger value="customize" data-testid="tab-customize">Customize</TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Select an Insurance Template</CardTitle>
                  <CardDescription>
                    Choose from 10 professional insurance-focused designs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="grid grid-cols-2 gap-4">
                      {emailTemplates.map((template) => (
                        <div
                          key={template.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                            selectedTemplate.id === template.id
                              ? "border-primary bg-primary/5"
                              : "border-border"
                          }`}
                          onClick={() => handleTemplateSelect(template)}
                          data-testid={`template-${template.id}`}
                        >
                          <div className="text-3xl mb-2 text-center">{template.thumbnail}</div>
                          <div className="text-sm font-semibold">{template.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {template.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="data" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Agent Information</CardTitle>
                  <CardDescription>
                    Complete your insurance professional details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-4">
                      {/* Basic Info */}
                      <div className="space-y-4">
                        <div className="text-sm font-semibold text-muted-foreground mb-2">
                          Basic Information
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="fullName">Full Name *</Label>
                            <Input
                              id="fullName"
                              placeholder="John Smith"
                              {...form.register("fullName")}
                              data-testid="input-fullname"
                            />
                          </div>
                          <div>
                            <Label htmlFor="jobTitle">Job Title *</Label>
                            <Input
                              id="jobTitle"
                              placeholder="Insurance Agent"
                              {...form.register("jobTitle")}
                              data-testid="input-jobtitle"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="company">Company/Agency *</Label>
                            <Input
                              id="company"
                              placeholder="State Farm Insurance"
                              {...form.register("company")}
                              data-testid="input-company"
                            />
                          </div>
                          <div>
                            <Label htmlFor="email">Email *</Label>
                            <Input
                              id="email"
                              type="email"
                              placeholder="agent@insurance.com"
                              {...form.register("email")}
                              data-testid="input-email"
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Insurance-Specific Info */}
                      <div className="space-y-4">
                        <div className="text-sm font-semibold text-muted-foreground mb-2">
                          Insurance Information
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="licenseNumber">License Number</Label>
                            <Input
                              id="licenseNumber"
                              placeholder="IL-2024-123456"
                              {...form.register("licenseNumber")}
                              data-testid="input-license"
                            />
                          </div>
                          <div>
                            <Label htmlFor="emergencyContact">24/7 Emergency Line</Label>
                            <Input
                              id="emergencyContact"
                              placeholder="+1 (800) 555-HELP"
                              {...form.register("emergencyContact")}
                              data-testid="input-emergency"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="carriers">Insurance Carriers Represented</Label>
                          <Input
                            id="carriers"
                            placeholder="State Farm, Allstate, Progressive"
                            {...form.register("carriers")}
                            data-testid="input-carriers"
                          />
                        </div>
                        <div>
                          <Label htmlFor="specializations">Specializations</Label>
                          <Input
                            id="specializations"
                            placeholder="Auto, Home, Life, Business Insurance"
                            {...form.register("specializations")}
                            data-testid="input-specializations"
                          />
                        </div>
                        <div>
                          <Label htmlFor="officeHours">Office Hours</Label>
                          <Input
                            id="officeHours"
                            placeholder="Mon-Fri 9AM-6PM, Sat 10AM-2PM"
                            {...form.register("officeHours")}
                            data-testid="input-hours"
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Contact Info */}
                      <div className="space-y-4">
                        <div className="text-sm font-semibold text-muted-foreground mb-2">
                          Contact Information
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="phone">Office Phone</Label>
                            <Input
                              id="phone"
                              placeholder="+1 (555) 123-4567"
                              {...form.register("phone")}
                              onChange={(e) => {
                                const formatted = formatPhoneInput(e.target.value);
                                form.setValue("phone", formatted);
                              }}
                              data-testid="input-phone"
                            />
                          </div>
                          <div>
                            <Label htmlFor="mobile">Mobile</Label>
                            <Input
                              id="mobile"
                              placeholder="+1 (555) 987-6543"
                              {...form.register("mobile")}
                              onChange={(e) => {
                                const formatted = formatPhoneInput(e.target.value);
                                form.setValue("mobile", formatted);
                              }}
                              data-testid="input-mobile"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="website">Website</Label>
                          <Input
                            id="website"
                            placeholder="https://www.myinsuranceagency.com"
                            {...form.register("website")}
                            data-testid="input-website"
                          />
                        </div>
                        <div>
                          <Label htmlFor="address">Office Address</Label>
                          <Input
                            id="address"
                            placeholder="123 Insurance Plaza, Suite 200, Chicago, IL 60601"
                            {...form.register("address")}
                            data-testid="input-address"
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Social Media */}
                      <div className="space-y-4">
                        <div className="text-sm font-semibold text-muted-foreground mb-2">
                          Social Media (Optional)
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="linkedinUrl">LinkedIn</Label>
                            <Input
                              id="linkedinUrl"
                              placeholder="https://linkedin.com/in/yourname"
                              {...form.register("linkedinUrl")}
                              data-testid="input-linkedin"
                            />
                          </div>
                          <div>
                            <Label htmlFor="facebookUrl">Facebook</Label>
                            <Input
                              id="facebookUrl"
                              placeholder="https://facebook.com/agencypage"
                              {...form.register("facebookUrl")}
                              data-testid="input-facebook"
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Additional Info */}
                      <div className="space-y-4">
                        <div className="text-sm font-semibold text-muted-foreground mb-2">
                          Additional Information
                        </div>
                        <div>
                          <Label htmlFor="logoUrl">Company Logo URL</Label>
                          <Input
                            id="logoUrl"
                            placeholder="https://mycompany.com/logo.png"
                            {...form.register("logoUrl")}
                            data-testid="input-logo"
                          />
                        </div>
                        <div>
                          <Label htmlFor="profilePhotoUrl">Profile Photo URL</Label>
                          <Input
                            id="profilePhotoUrl"
                            placeholder="https://mycompany.com/photo.jpg"
                            {...form.register("profilePhotoUrl")}
                            data-testid="input-photo"
                          />
                        </div>
                        <div>
                          <Label htmlFor="companyTagline">Company Tagline</Label>
                          <Input
                            id="companyTagline"
                            placeholder="Protecting What Matters Most"
                            {...form.register("companyTagline")}
                            data-testid="input-tagline"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="bannerText">Call-to-Action Text</Label>
                            <Input
                              id="bannerText"
                              placeholder="Get Your Free Quote!"
                              {...form.register("bannerText")}
                              data-testid="input-banner-text"
                            />
                          </div>
                          <div>
                            <Label htmlFor="bannerUrl">CTA Link</Label>
                            <Input
                              id="bannerUrl"
                              placeholder="https://quote.myagency.com"
                              {...form.register("bannerUrl")}
                              data-testid="input-banner-url"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="customize" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Customization</CardTitle>
                  <CardDescription>
                    Adjust the colors and fonts of your signature
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Color Scheme Selection */}
                  <div>
                    <Label className="mb-3 block">Color Scheme</Label>
                    <RadioGroup
                      value={selectedColorScheme.id}
                      onValueChange={(value) => {
                        const scheme = selectedTemplate.colorSchemes.find(s => s.id === value);
                        if (scheme) setSelectedColorScheme(scheme);
                      }}
                    >
                      {selectedTemplate.colorSchemes.map((scheme) => (
                        <div key={scheme.id} className="flex items-center space-x-3 mb-3">
                          <RadioGroupItem value={scheme.id} id={scheme.id} />
                          <Label htmlFor={scheme.id} className="flex items-center gap-3 cursor-pointer">
                            <div className="flex gap-2">
                              <div
                                className="w-6 h-6 rounded border"
                                style={{ backgroundColor: scheme.primaryColor }}
                              />
                              <div
                                className="w-6 h-6 rounded border"
                                style={{ backgroundColor: scheme.secondaryColor }}
                              />
                            </div>
                            <span>{scheme.name}</span>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <Separator />

                  {/* Font Selection */}
                  <div>
                    <Label className="mb-3 block">Font</Label>
                    <RadioGroup
                      value={selectedFont.id}
                      onValueChange={(value) => {
                        const font = selectedTemplate.fonts.find(f => f.id === value);
                        if (font) setSelectedFont(font);
                      }}
                    >
                      {selectedTemplate.fonts.map((font) => (
                        <div key={font.id} className="flex items-center space-x-3 mb-3">
                          <RadioGroupItem value={font.id} id={`font-${font.id}`} />
                          <Label
                            htmlFor={`font-${font.id}`}
                            className="cursor-pointer"
                            style={{ fontFamily: font.family }}
                          >
                            {font.name}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <Separator />

                  {/* Preview Options */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="preview-mode">Preview Mode</Label>
                      <Switch
                        id="preview-mode"
                        checked={isPreviewMode}
                        onCheckedChange={setIsPreviewMode}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enable to see how the signature will look in a real email
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Preview & Code */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Live Preview</CardTitle>
                <Badge variant={generatedHtml ? "default" : "secondary"}>
                  {generatedHtml ? "Active" : "Complete the fields"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={`border rounded-lg p-4 min-h-[300px] ${
                  isPreviewMode ? "bg-white" : "bg-muted/10"
                }`}
              >
                {generatedHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: generatedHtml }} />
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    <div className="text-center">
                      <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Complete the required fields to see the preview</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Generated Code */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Generated HTML Code</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyHtml}
                    disabled={!generatedHtml || isCopying}
                    data-testid="button-copy"
                  >
                    {isCopying ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="ml-2">Copy</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadHtml}
                    disabled={!generatedHtml}
                    data-testid="button-download"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-muted/50">
                <pre className="text-xs">
                  <code>{generatedHtml || "// HTML code will appear here"}</code>
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How to Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. Select a professional insurance template</p>
              <p>2. Fill in your agent information and credentials</p>
              <p>3. Customize colors and fonts to match your brand</p>
              <p>4. Copy the HTML code or download the file</p>
              <p>5. Paste into your email client's signature settings</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}