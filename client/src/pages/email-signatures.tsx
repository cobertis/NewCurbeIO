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
  Youtube
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LoadingSpinner } from "@/components/loading-spinner";
import { formatPhoneInput } from "@shared/phone";

// Form schema for email signature data
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
  address: z.string().optional(),
  logoUrl: z.string().optional(),
  profilePhotoUrl: z.string().optional(),
  bannerText: z.string().optional(),
  bannerUrl: z.string().optional(),
  disclaimerText: z.string().optional(),
  companyTagline: z.string().optional(),
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
  instagram: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0idXJsKCNpbnN0YWdyYW0tZ3JhZGllbnQpIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJpbnN0YWdyYW0tZ3JhZGllbnQiIHgxPSIwJSIgeTE9IjEwMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmRjNzVlIi8+CjxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjZjQ3MTMzIi8+CjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI2JjMWE4OCIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM+CjxwYXRoIGQ9Ik0xMCA2Ljg2NWEzLjEzNSAzLjEzNSAwIDEwMCA2LjI3IDMuMTM1IDMuMTM1IDAgMDAwLTYuMjd6bTAgNC44NjVhMS43MyAxLjczIDAgMTEwLTMuNDYgMS43MyAxLjczIDAgMDEwIDMuNDZ6bTMuMzU0LTQuOTgyYS43MzMuNzMzIDAgMTAwLTEuNDY1LjczMy43MzMgMCAwMDAgMS40NjV6bTEuNzY1Ljc0MmMtLjAzOS0uODQtLjIzMi0xLjU4NC0uODQ2LTIuMTk0LS42MS0uNjEtMS4zNTUtLjgwMy0yLjE5NS0uODQ2LTIuODUtLjE2Mi01LjI5Ni0uMTYyLTguMTQ2IDBDMy4wOTIgNC40ODkgMi4zNDcgNC42ODIgMS43MzcgNS4yOTZjLS42MS42MS0uODAzIDEuMzU0LS44NDYgMi4xOTQtLjE2MiAyLjg1LS4xNjIgNS4yOTYgMCA4LjE0Ni4wMzkuODQuMjMyIDEuNTg0Ljg0NiAyLjE5NC42MS42MSAxLjM1NS44MDMgMi4xOTUuODQ2IDIuODUuMTYyIDUuMjk2LjE2MiA4LjE0NiAwIC44NC0uMDM5IDEuNTg0LS4yMzIgMi4xOTUtLjg0Ni42MS0uNjEuODAzLTEuMzU0Ljg0Ni0yLjE5NC4xNjItMi44NS4xNjItNS4yOTYgMC04LjE0NnptLTEuNDM0IDEwLjA0NGMtLjU1NC4xMy0uOTk1LS4wMTYtMS4zMzYtLjM1Ny0uMzQxLS4zNDEtLjQ4Ny0uNzgyLS4zNTctMS4zMzZDMTEuODU3IDE0LjE0IDEyLjE0IDE0IDE0LjU3IDE0YzIuNDMgMCAyLjcxNC0uMTQgMy41NzktLjIwNS41NTQtLjEzLjk5NS4wMTYgMS4zMzYuMzU3LjM0MS4zNDEuNDg3Ljc4Mi4zNTcgMS4zMzYtLjEzNCAxLjExNi0uMjc0IDEuNC0uMjc0IDMuODMgMCAyLjQzLjE0IDIuNzE0LjIwNSAzLjU3OS4xMy41NTQtLjAxNi45OTUtLjM1NyAxLjMzNi0uMzQxLjM0MS0uNzgyLjQ4Ny0xLjMzNi4zNTctMS4xMTYtLjEzNC0xLjQtLjI3NC0zLjgzLS4yNzQtMi40MyAwLTIuNzE0LjE0LTMuNTc5LjIwNXoiLz4KPC9zdmc+",
  github: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0iIzE4MTcxNyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEwIDBDNC40NzcgMCAwIDQuNDg0IDAgMTAuMDE3YzAgNC40MjUgMi44NjUgOC4xOCA2Ljg0IDkuNTA0LjUuMDkyLjY4Mi0uMjE3LjY4Mi0uNDgyIDAtLjIzNy0uMDA4LS44NjUtLjAxMy0xLjY5OC0yLjc4Mi42MDQtMy4zNy0xLjM0Mi0zLjM3LTEuMzQyLS40NTQtMS4xNTUtMS4xMS0xLjQ2Mi0xLjExLTEuNDYyLS45MDgtLjYyLjA2OS0uNjA4LjA2OS0uNjA4IDEuMDAzLjA3IDEuNTMyIDEuMDMyIDEuNTMyIDEuMDMyLjg5MiAxLjUzIDIuMzQxIDEuMDg5IDIuOTEuODMyLjA5Mi0uNjQ3LjM1LTEuMDg5LjYzNi0xLjMzOC0yLjIyLS4yNTMtNC41NTUtMS4xMTMtNC41NTUtNC45NTEgMC0xLjA5My4zOS0xLjk4OCAxLjAyOS0yLjY4OC0uMTAzLS4yNTMtLjQ0Ni0xLjI3Mi4wOTgtMi42NSAwIDAgLjg0LS4yNyAyLjc1IDEuMDI2LjgtLjIyMiAxLjY1LS4zMzMgMi41LS4zMzcuODUuMDA0IDEuNzAxLjExNSAyLjUuMzM3IDEuOTA5LTEuMjk2IDIuNzQ3LTEuMDI3IDIuNzQ3LTEuMDI3LjU0NiAxLjM3OS4yMDMgMi4zOTguMSAyLjY1MS42NC43IDEuMDI4IDEuNTk1IDEuMDI4IDIuNjg4IDAgMy44NDgtMi4zMzkgNC42OTUtNC41NjYgNC45NDMuMzU5LjMxLjY3OC45Mi42NzggMS44NTUgMCAxLjMzOC0uMDEyIDIuNDE5LS4wMTIgMi43NDcgMCAuMjY4LjE4LjU4LjY4OC40ODJDMTcuMTM4IDE4LjE5NiAyMCAxNC40NCAyMCAxMC4wMTdDMjAgNC40ODQgMTUuNTIzIDAgMTAgMHoiLz4KPC9zdmc+",
  youtube: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0iI0ZGMDAwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE5LjU4MiA1LjE3NmExLjk3NCAxLjk3NCAwIDAwLTEuMzkyLTEuNDAxQzE2LjU3OCAzLjMzMyAxMCAzLjMzMyAxMCAzLjMzM3MtNi41NzggMC04LjE5LjQ0MkExLjk3NCAxLjk3NCAwIDAwLjQxOCA1LjE3NkMwIDYuODEzIDAgMTAgMCAxMHMwIDMuMTg3LjQxOCA0LjgyNGExLjk3NCAxLjk3NCAwIDAwMS4zOTIgMS40MDFDMy40MjIgMTYuNjY3IDEwIDE2LjY2NyAxMCAxNi42NjdzNi41NzggMCA4LjE5LS40NDJhMS45NzQgMS45NzQgMCAwMDEuMzkyLTEuNDAxQzIwIDEzLjE4NyAyMCAxMCAyMCAxMHMwLTMuMTg3LS40MTgtNC44MjR6TTcuOTE3IDEyLjkxN1Y3LjA4M0wxMy4zMzMgMTBsLTUuNDE2IDIuOTE3eiIvPgo8L3N2Zz4="
};

// Email signature templates
const emailTemplates: EmailTemplate[] = [
  // 1. Minimal Professional
  {
    id: "minimal",
    name: "Minimal Professional",
    description: "Simple and elegant for modern professionals",
    thumbnail: "📧",
    colorSchemes: [
      { id: "blue", name: "Blue", primaryColor: "#2563eb", secondaryColor: "#64748b" },
      { id: "black", name: "Black", primaryColor: "#000000", secondaryColor: "#6b7280" },
      { id: "green", name: "Green", primaryColor: "#16a34a", secondaryColor: "#64748b" },
    ],
    fonts: [
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; color: #333333;">
  <tr>
    <td style="padding-right: 15px; border-right: 2px solid ${colorScheme.primaryColor};">
      ${data.profilePhotoUrl ? `<img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 80px; height: 80px; border-radius: 50%;">` : ''}
    </td>
    <td style="padding-left: 15px;">
      <div style="font-size: 18px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 4px;">${data.fullName}</div>
      <div style="font-size: 14px; color: ${colorScheme.secondaryColor}; margin-bottom: 8px;">${data.jobTitle} | ${data.company}</div>
      ${data.phone ? `<div style="font-size: 13px; margin: 2px 0;"><span style="color: ${colorScheme.secondaryColor};">📞</span> ${data.phone}</div>` : ''}
      <div style="font-size: 13px; margin: 2px 0;"><span style="color: ${colorScheme.secondaryColor};">✉️</span> ${data.email}</div>
      ${data.website ? `<div style="font-size: 13px; margin: 2px 0;"><span style="color: ${colorScheme.secondaryColor};">🌐</span> ${data.website}</div>` : ''}
      <div style="margin-top: 10px;">
        ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="text-decoration: none; margin-right: 8px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 20px; height: 20px;"></a>` : ''}
        ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="text-decoration: none; margin-right: 8px;"><img src="${socialIcons.twitter}" alt="Twitter" style="width: 20px; height: 20px;"></a>` : ''}
        ${data.facebookUrl ? `<a href="${data.facebookUrl}" style="text-decoration: none; margin-right: 8px;"><img src="${socialIcons.facebook}" alt="Facebook" style="width: 20px; height: 20px;"></a>` : ''}
      </div>
    </td>
  </tr>
</table>`
  },
  
  // 2. Corporate Executive
  {
    id: "corporate",
    name: "Corporate Executive",
    description: "Traditional business style with logo",
    thumbnail: "🏢",
    colorSchemes: [
      { id: "navy", name: "Navy Blue", primaryColor: "#1e3a8a", secondaryColor: "#475569" },
      { id: "burgundy", name: "Burgundy", primaryColor: "#881337", secondaryColor: "#6b7280" },
      { id: "forest", name: "Forest Green", primaryColor: "#14532d", secondaryColor: "#64748b" },
    ],
    fonts: [
      { id: "times", name: "Times New Roman", family: "Times New Roman, serif" },
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
      { id: "verdana", name: "Verdana", family: "Verdana, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family};">
  <tr>
    <td>
      ${data.logoUrl ? `<img src="${data.logoUrl}" alt="${data.company}" style="width: 120px; margin-bottom: 15px;">` : ''}
      <div style="border-top: 3px solid ${colorScheme.primaryColor}; padding-top: 15px;">
        <div style="font-size: 20px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 2px;">${data.fullName}</div>
        <div style="font-size: 16px; color: ${colorScheme.secondaryColor}; margin-bottom: 4px;">${data.jobTitle}</div>
        <div style="font-size: 14px; font-weight: bold; color: #333333; margin-bottom: 12px;">${data.company}</div>
        ${data.companyTagline ? `<div style="font-size: 12px; font-style: italic; color: ${colorScheme.secondaryColor}; margin-bottom: 12px;">"${data.companyTagline}"</div>` : ''}
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size: 13px; color: #666666; width: 80px;">Phone:</td>
            <td style="font-size: 13px; color: #333333;">${data.phone || 'N/A'}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #666666; padding-top: 4px;">Email:</td>
            <td style="font-size: 13px; color: ${colorScheme.primaryColor}; padding-top: 4px;"><a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></td>
          </tr>
          ${data.website ? `
          <tr>
            <td style="font-size: 13px; color: #666666; padding-top: 4px;">Web:</td>
            <td style="font-size: 13px; color: ${colorScheme.primaryColor}; padding-top: 4px;"><a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website}</a></td>
          </tr>` : ''}
          ${data.address ? `
          <tr>
            <td style="font-size: 13px; color: #666666; padding-top: 4px;">Address:</td>
            <td style="font-size: 13px; color: #333333; padding-top: 4px;">${data.address}</td>
          </tr>` : ''}
        </table>
      </div>
    </td>
  </tr>
</table>`
  },
  
  // 3. Creative Designer
  {
    id: "creative",
    name: "Creative Designer",
    description: "Modern and colorful for creatives",
    thumbnail: "🎨",
    colorSchemes: [
      { id: "gradient1", name: "Sunset", primaryColor: "#f97316", secondaryColor: "#ec4899" },
      { id: "gradient2", name: "Ocean", primaryColor: "#0ea5e9", secondaryColor: "#8b5cf6" },
      { id: "gradient3", name: "Forest", primaryColor: "#10b981", secondaryColor: "#06b6d4" },
    ],
    fonts: [
      { id: "poppins", name: "Poppins", family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
      { id: "montserrat", name: "Montserrat", family: "Arial, sans-serif" },
      { id: "raleway", name: "Raleway", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family};">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0">
        <tr>
          ${data.profilePhotoUrl ? `
          <td style="padding-right: 20px;">
            <div style="width: 100px; height: 100px; border-radius: 10px; overflow: hidden; border: 3px solid ${colorScheme.primaryColor};">
              <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
          </td>` : ''}
          <td>
            <div style="background: linear-gradient(90deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-size: 24px; font-weight: bold; margin-bottom: 4px;">${data.fullName}</div>
            <div style="font-size: 16px; color: #666666; margin-bottom: 2px;">${data.jobTitle}</div>
            <div style="font-size: 14px; color: #999999; margin-bottom: 12px;">@ ${data.company}</div>
            <div style="display: inline-block; background: ${colorScheme.primaryColor}; color: white; padding: 8px 16px; border-radius: 20px; font-size: 13px; margin-bottom: 12px;">
              ${data.email}
            </div>
            <div style="font-size: 13px; color: #666666;">
              ${data.phone ? `📱 ${data.phone}<br>` : ''}
              ${data.website ? `🔗 ${data.website}<br>` : ''}
            </div>
            <div style="margin-top: 12px;">
              ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="text-decoration: none; margin-right: 8px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 24px; height: 24px;"></a>` : ''}
              ${data.instagramUrl ? `<a href="${data.instagramUrl}" style="text-decoration: none; margin-right: 8px;"><img src="${socialIcons.instagram}" alt="Instagram" style="width: 24px; height: 24px;"></a>` : ''}
              ${data.githubUrl ? `<a href="${data.githubUrl}" style="text-decoration: none; margin-right: 8px;"><img src="${socialIcons.github}" alt="Github" style="width: 24px; height: 24px;"></a>` : ''}
            </div>
          </td>
        </tr>
      </table>
      ${data.bannerText ? `
      <table cellpadding="0" cellspacing="0" style="margin-top: 20px;">
        <tr>
          <td style="background: linear-gradient(90deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); color: white; padding: 12px 20px; border-radius: 8px; text-align: center;">
            <div style="font-size: 14px; font-weight: bold;">${data.bannerText}</div>
            ${data.bannerUrl ? `<a href="${data.bannerUrl}" style="color: white; font-size: 12px;">Learn more →</a>` : ''}
          </td>
        </tr>
      </table>` : ''}
    </td>
  </tr>
</table>`
  },
  
  // 4. Real Estate Agent
  {
    id: "realestate",
    name: "Real Estate Agent",
    description: "Professional with property focus",
    thumbnail: "🏠",
    colorSchemes: [
      { id: "luxury", name: "Luxury", primaryColor: "#b8860b", secondaryColor: "#4a5568" },
      { id: "modern", name: "Modern", primaryColor: "#047857", secondaryColor: "#6b7280" },
      { id: "classic", name: "Classic", primaryColor: "#7c3aed", secondaryColor: "#64748b" },
    ],
    fonts: [
      { id: "playfair", name: "Playfair", family: "Georgia, serif" },
      { id: "roboto", name: "Roboto", family: "Arial, sans-serif" },
      { id: "opensans", name: "Open Sans", family: "Verdana, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="text-align: center; padding-bottom: 15px;">
            ${data.profilePhotoUrl ? `<img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 120px; height: 120px; border-radius: 60px; border: 4px solid ${colorScheme.primaryColor};">` : ''}
            <div style="font-size: 26px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-top: 10px;">${data.fullName}</div>
            <div style="font-size: 16px; color: ${colorScheme.secondaryColor}; margin: 4px 0;">${data.jobTitle}</div>
            <div style="font-size: 14px; color: #666666;">${data.company}</div>
          </td>
        </tr>
        <tr>
          <td>
            <table cellpadding="0" cellspacing="0" style="width: 100%; background: #f8f9fa; border-radius: 8px; padding: 15px;">
              <tr>
                <td style="text-align: center;">
                  <div style="font-size: 14px; color: #333333; margin: 5px 0;">
                    📞 <a href="tel:${data.phone}" style="color: ${colorScheme.primaryColor}; text-decoration: none; font-weight: bold;">${data.phone || 'N/A'}</a>
                  </div>
                  <div style="font-size: 14px; color: #333333; margin: 5px 0;">
                    ✉️ <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a>
                  </div>
                  ${data.website ? `
                  <div style="font-size: 14px; color: #333333; margin: 5px 0;">
                    🌐 <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website}</a>
                  </div>` : ''}
                  ${data.address ? `
                  <div style="font-size: 14px; color: #333333; margin: 5px 0;">
                    📍 ${data.address}
                  </div>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${data.bannerText ? `
        <tr>
          <td style="padding-top: 15px;">
            <table cellpadding="0" cellspacing="0" style="width: 100%; background: ${colorScheme.primaryColor}; border-radius: 8px; padding: 15px;">
              <tr>
                <td style="text-align: center; color: white;">
                  <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">🏡 ${data.bannerText}</div>
                  ${data.bannerUrl ? `<a href="${data.bannerUrl}" style="color: white; font-size: 14px;">View Available Properties →</a>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>` : ''}
      </table>
    </td>
  </tr>
</table>`
  },
  
  // 5. Tech Startup
  {
    id: "tech",
    name: "Tech Startup",
    description: "Modern tech style with code and minimalism",
    thumbnail: "💻",
    colorSchemes: [
      { id: "dark", name: "Dark Mode", primaryColor: "#000000", secondaryColor: "#4ade80" },
      { id: "electric", name: "Electric", primaryColor: "#3b82f6", secondaryColor: "#a855f7" },
      { id: "terminal", name: "Terminal", primaryColor: "#10b981", secondaryColor: "#f59e0b" },
    ],
    fonts: [
      { id: "mono", name: "Monospace", family: "'Courier New', monospace" },
      { id: "system", name: "System", family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
      { id: "roboto", name: "Roboto", family: "Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; background: #1a1a1a; padding: 20px; border-radius: 8px;">
  <tr>
    <td>
      <div style="color: ${colorScheme.secondaryColor}; font-size: 14px; margin-bottom: 8px;">// ${data.company}</div>
      <div style="color: white; font-size: 22px; font-weight: bold; margin-bottom: 4px;">${data.fullName}</div>
      <div style="color: ${colorScheme.primaryColor === '#000000' ? '#ffffff' : colorScheme.primaryColor}; font-size: 16px; margin-bottom: 15px;">&lt;${data.jobTitle}/&gt;</div>
      
      <table cellpadding="0" cellspacing="0" style="border-left: 2px solid ${colorScheme.secondaryColor}; padding-left: 15px;">
        <tr><td style="color: #999999; font-size: 13px; padding: 3px 0;">const contact = {</td></tr>
        <tr><td style="color: #999999; font-size: 13px; padding: 3px 0 3px 20px;">email: '<span style="color: ${colorScheme.secondaryColor};">${data.email}</span>',</td></tr>
        ${data.phone ? `<tr><td style="color: #999999; font-size: 13px; padding: 3px 0 3px 20px;">phone: '<span style="color: ${colorScheme.secondaryColor};">${data.phone}</span>',</td></tr>` : ''}
        ${data.website ? `<tr><td style="color: #999999; font-size: 13px; padding: 3px 0 3px 20px;">web: '<span style="color: ${colorScheme.secondaryColor};">${data.website}</span>',</td></tr>` : ''}
        ${data.githubUrl ? `<tr><td style="color: #999999; font-size: 13px; padding: 3px 0 3px 20px;">github: '<span style="color: ${colorScheme.secondaryColor};">${data.githubUrl}</span>',</td></tr>` : ''}
        <tr><td style="color: #999999; font-size: 13px; padding: 3px 0;">};</td></tr>
      </table>
      
      <div style="margin-top: 15px;">
        ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="text-decoration: none; margin-right: 10px;"><span style="color: ${colorScheme.secondaryColor}; font-size: 12px;">[LinkedIn]</span></a>` : ''}
        ${data.githubUrl ? `<a href="${data.githubUrl}" style="text-decoration: none; margin-right: 10px;"><span style="color: ${colorScheme.secondaryColor}; font-size: 12px;">[GitHub]</span></a>` : ''}
        ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="text-decoration: none;"><span style="color: ${colorScheme.secondaryColor}; font-size: 12px;">[Twitter]</span></a>` : ''}
      </div>
    </td>
  </tr>
</table>`
  },
  
  // 6. Healthcare Professional
  {
    id: "healthcare",
    name: "Healthcare Professional",
    description: "Clean and professional for doctors and nurses",
    thumbnail: "⚕️",
    colorSchemes: [
      { id: "medical", name: "Medical", primaryColor: "#0891b2", secondaryColor: "#0e7490" },
      { id: "health", name: "Health", primaryColor: "#059669", secondaryColor: "#10b981" },
      { id: "care", name: "Care", primaryColor: "#7c3aed", secondaryColor: "#8b5cf6" },
    ],
    fonts: [
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "calibri", name: "Calibri", family: "Calibri, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family};">
  <tr>
    <td style="border-top: 4px solid ${colorScheme.primaryColor}; padding-top: 15px;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right: 20px; border-right: 2px solid #e5e7eb;">
            <div style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 4px;">Dr. ${data.fullName}</div>
            <div style="font-size: 14px; color: ${colorScheme.primaryColor}; margin-bottom: 2px;">${data.jobTitle}</div>
            <div style="font-size: 13px; color: #6b7280;">${data.company}</div>
          </td>
          <td style="padding-left: 20px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 2px 0;">
                  <span style="color: ${colorScheme.primaryColor}; font-size: 14px;">📞</span>
                  <span style="font-size: 13px; color: #374151; margin-left: 8px;">${data.phone || 'N/A'}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 2px 0;">
                  <span style="color: ${colorScheme.primaryColor}; font-size: 14px;">✉️</span>
                  <a href="mailto:${data.email}" style="font-size: 13px; color: #374151; margin-left: 8px; text-decoration: none;">${data.email}</a>
                </td>
              </tr>
              ${data.address ? `
              <tr>
                <td style="padding: 2px 0;">
                  <span style="color: ${colorScheme.primaryColor}; font-size: 14px;">📍</span>
                  <span style="font-size: 13px; color: #374151; margin-left: 8px;">${data.address}</span>
                </td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>
      ${data.disclaimerText ? `
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
        <div style="font-size: 11px; color: #9ca3af; line-height: 1.4;">${data.disclaimerText}</div>
      </div>` : ''}
    </td>
  </tr>
</table>`
  },
  
  // 7. Legal Professional
  {
    id: "legal",
    name: "Legal Professional",
    description: "Formal and elegant for lawyers",
    thumbnail: "⚖️",
    colorSchemes: [
      { id: "classic", name: "Classic", primaryColor: "#1e293b", secondaryColor: "#475569" },
      { id: "burgundy", name: "Burgundy", primaryColor: "#7f1d1d", secondaryColor: "#991b1b" },
      { id: "navy", name: "Navy Blue", primaryColor: "#1e3a8a", secondaryColor: "#1e40af" },
    ],
    fonts: [
      { id: "times", name: "Times New Roman", family: "Times New Roman, serif" },
      { id: "garamond", name: "Garamond", family: "Garamond, serif" },
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family};">
  <tr>
    <td>
      <div style="text-align: center; margin-bottom: 20px;">
        ${data.logoUrl ? `<img src="${data.logoUrl}" alt="${data.company}" style="max-width: 200px; margin-bottom: 10px;">` : ''}
        <div style="font-size: 18px; font-weight: bold; color: ${colorScheme.primaryColor}; text-transform: uppercase; letter-spacing: 2px;">${data.company}</div>
      </div>
      <div style="border-top: 1px solid ${colorScheme.secondaryColor}; border-bottom: 1px solid ${colorScheme.secondaryColor}; padding: 15px 0; text-align: center;">
        <div style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 4px;">${data.fullName}</div>
        <div style="font-size: 14px; color: ${colorScheme.primaryColor}; text-transform: uppercase; letter-spacing: 1px;">${data.jobTitle}</div>
      </div>
      <table cellpadding="0" cellspacing="0" style="width: 100%; margin-top: 15px;">
        <tr>
          <td style="text-align: center;">
            <span style="font-size: 13px; color: #4b5563;">T: ${data.phone || 'N/A'}</span>
            <span style="margin: 0 10px; color: ${colorScheme.secondaryColor};">|</span>
            <span style="font-size: 13px; color: #4b5563;">E: <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></span>
            ${data.website ? `
            <span style="margin: 0 10px; color: ${colorScheme.secondaryColor};">|</span>
            <span style="font-size: 13px; color: #4b5563;">W: <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website}</a></span>` : ''}
          </td>
        </tr>
      </table>
      ${data.address ? `
      <div style="text-align: center; margin-top: 10px;">
        <span style="font-size: 12px; color: #6b7280;">${data.address}</span>
      </div>` : ''}
      ${data.disclaimerText ? `
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
        <div style="font-size: 10px; color: #9ca3af; line-height: 1.3; text-align: justify;">${data.disclaimerText}</div>
      </div>` : ''}
    </td>
  </tr>
</table>`
  },
  
  // 8. Marketing Expert
  {
    id: "marketing",
    name: "Marketing Expert",
    description: "Vibrant and eye-catching for digital marketing",
    thumbnail: "📈",
    colorSchemes: [
      { id: "vibrant", name: "Vibrant", primaryColor: "#ec4899", secondaryColor: "#f97316" },
      { id: "energy", name: "Energy", primaryColor: "#f59e0b", secondaryColor: "#ef4444" },
      { id: "fresh", name: "Fresh", primaryColor: "#10b981", secondaryColor: "#06b6d4" },
    ],
    fonts: [
      { id: "poppins", name: "Poppins", family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
      { id: "opensans", name: "Open Sans", family: "Verdana, sans-serif" },
      { id: "lato", name: "Lato", family: "Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family};">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); padding: 20px; border-radius: 10px;">
        <tr>
          <td>
            ${data.profilePhotoUrl ? `
            <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 80px; height: 80px; border-radius: 40px; border: 3px solid white; margin-right: 15px; float: left;">` : ''}
            <div style="color: white;">
              <div style="font-size: 24px; font-weight: bold; margin-bottom: 4px;">${data.fullName}</div>
              <div style="font-size: 16px; margin-bottom: 2px;">${data.jobTitle}</div>
              <div style="font-size: 14px; opacity: 0.9;">${data.company}</div>
            </div>
          </td>
        </tr>
      </table>
      
      <table cellpadding="0" cellspacing="0" style="margin-top: 15px;">
        <tr>
          <td>
            <div style="font-size: 14px; color: #374151; margin: 5px 0;">
              📧 <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none; font-weight: bold;">${data.email}</a>
            </div>
            ${data.phone ? `
            <div style="font-size: 14px; color: #374151; margin: 5px 0;">
              📱 <a href="tel:${data.phone}" style="color: #374151; text-decoration: none;">${data.phone}</a>
            </div>` : ''}
            ${data.website ? `
            <div style="font-size: 14px; color: #374151; margin: 5px 0;">
              🌐 <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website}</a>
            </div>` : ''}
          </td>
        </tr>
      </table>
      
      ${data.bannerText ? `
      <table cellpadding="0" cellspacing="0" style="margin-top: 20px;">
        <tr>
          <td style="background: #f3f4f6; padding: 15px; border-left: 4px solid ${colorScheme.primaryColor}; border-radius: 4px;">
            <div style="font-size: 16px; font-weight: bold; color: #111827; margin-bottom: 5px;">✨ ${data.bannerText}</div>
            ${data.bannerUrl ? `<a href="${data.bannerUrl}" style="color: ${colorScheme.primaryColor}; font-size: 14px; text-decoration: none; font-weight: bold;">Discover more →</a>` : ''}
          </td>
        </tr>
      </table>` : ''}
      
      <div style="margin-top: 15px; text-align: center;">
        ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="text-decoration: none; margin: 0 5px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 28px; height: 28px;"></a>` : ''}
        ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="text-decoration: none; margin: 0 5px;"><img src="${socialIcons.twitter}" alt="Twitter" style="width: 28px; height: 28px;"></a>` : ''}
        ${data.instagramUrl ? `<a href="${data.instagramUrl}" style="text-decoration: none; margin: 0 5px;"><img src="${socialIcons.instagram}" alt="Instagram" style="width: 28px; height: 28px;"></a>` : ''}
        ${data.youtubeUrl ? `<a href="${data.youtubeUrl}" style="text-decoration: none; margin: 0 5px;"><img src="${socialIcons.youtube}" alt="YouTube" style="width: 28px; height: 28px;"></a>` : ''}
      </div>
    </td>
  </tr>
</table>`
  },
  
  // 9. Consultant
  {
    id: "consultant",
    name: "Consultant",
    description: "Professional for business consulting",
    thumbnail: "💼",
    colorSchemes: [
      { id: "professional", name: "Professional", primaryColor: "#2563eb", secondaryColor: "#1e40af" },
      { id: "executive", name: "Executive", primaryColor: "#dc2626", secondaryColor: "#991b1b" },
      { id: "premium", name: "Premium", primaryColor: "#a855f7", secondaryColor: "#7c3aed" },
    ],
    fonts: [
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "calibri", name: "Calibri", family: "Calibri, sans-serif" },
      { id: "verdana", name: "Verdana", family: "Verdana, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 550px;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="width: 70%;">
            <div style="font-size: 22px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 4px;">${data.fullName}</div>
            <div style="font-size: 16px; color: #4b5563; margin-bottom: 2px;">${data.jobTitle}</div>
            <div style="font-size: 14px; color: #6b7280; margin-bottom: 12px;">${data.company}</div>
            ${data.companyTagline ? `<div style="font-size: 13px; font-style: italic; color: #9ca3af; margin-bottom: 12px;">"${data.companyTagline}"</div>` : ''}
          </td>
          ${data.profilePhotoUrl ? `
          <td style="width: 30%; text-align: right;">
            <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 100px; height: 100px; border-radius: 8px;">
          </td>` : ''}
        </tr>
      </table>
      
      <div style="border-top: 2px solid ${colorScheme.primaryColor}; margin: 15px 0;"></div>
      
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="width: 30px;"><span style="color: ${colorScheme.secondaryColor};">📞</span></td>
          <td style="font-size: 13px; color: #374151;">${data.phone || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding-top: 4px;"><span style="color: ${colorScheme.secondaryColor};">✉️</span></td>
          <td style="font-size: 13px; padding-top: 4px;"><a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></td>
        </tr>
        ${data.website ? `
        <tr>
          <td style="padding-top: 4px;"><span style="color: ${colorScheme.secondaryColor};">🌐</span></td>
          <td style="font-size: 13px; padding-top: 4px;"><a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website}</a></td>
        </tr>` : ''}
        ${data.linkedinUrl ? `
        <tr>
          <td style="padding-top: 4px;"><span style="color: ${colorScheme.secondaryColor};">💼</span></td>
          <td style="font-size: 13px; padding-top: 4px;"><a href="${data.linkedinUrl}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">LinkedIn Profile</a></td>
        </tr>` : ''}
      </table>
      
      ${data.bannerText ? `
      <div style="margin-top: 20px; padding: 12px; background: #f9fafb; border-radius: 6px;">
        <div style="font-size: 14px; color: #111827; font-weight: bold; margin-bottom: 4px;">💡 ${data.bannerText}</div>
        ${data.bannerUrl ? `<a href="${data.bannerUrl}" style="color: ${colorScheme.primaryColor}; font-size: 13px; text-decoration: none;">Schedule a consultation →</a>` : ''}
      </div>` : ''}
    </td>
  </tr>
</table>`
  },
  
  // 10. Academic/Professor
  {
    id: "academic",
    name: "Academic/Professor",
    description: "Educational and professional style",
    thumbnail: "🎓",
    colorSchemes: [
      { id: "university", name: "University", primaryColor: "#0c4a6e", secondaryColor: "#0369a1" },
      { id: "scholar", name: "Scholar", primaryColor: "#166534", secondaryColor: "#15803d" },
      { id: "classic", name: "Classic", primaryColor: "#713f12", secondaryColor: "#a16207" },
    ],
    fonts: [
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
      { id: "times", name: "Times New Roman", family: "Times New Roman, serif" },
      { id: "book", name: "Book Antiqua", family: "Book Antiqua, serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family};">
  <tr>
    <td>
      <div style="border-bottom: 3px double ${colorScheme.primaryColor}; padding-bottom: 15px; margin-bottom: 15px;">
        <div style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 4px;">${data.fullName}</div>
        <div style="font-size: 15px; color: ${colorScheme.primaryColor}; margin-bottom: 2px;">${data.jobTitle}</div>
        <div style="font-size: 14px; color: #4b5563; font-weight: bold;">${data.company}</div>
        ${data.companyTagline ? `<div style="font-size: 13px; color: #6b7280; font-style: italic; margin-top: 4px;">${data.companyTagline}</div>` : ''}
      </div>
      
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size: 13px; color: #4b5563; padding: 3px 0;">
            <strong>Office:</strong> ${data.address || 'N/A'}
          </td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #4b5563; padding: 3px 0;">
            <strong>Phone:</strong> ${data.phone || 'N/A'}
          </td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #4b5563; padding: 3px 0;">
            <strong>Email:</strong> <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a>
          </td>
        </tr>
        ${data.website ? `
        <tr>
          <td style="font-size: 13px; color: #4b5563; padding: 3px 0;">
            <strong>Web:</strong> <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website}</a>
          </td>
        </tr>` : ''}
      </table>
      
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
        <div style="font-size: 12px; color: #6b7280; font-style: italic;">
          "Education is the most powerful weapon which you can use to change the world" - Nelson Mandela
        </div>
      </div>
    </td>
  </tr>
</table>`
  },
  
  // 11. Sales Professional
  {
    id: "sales",
    name: "Sales Professional",
    description: "Focused on calls to action",
    thumbnail: "💰",
    colorSchemes: [
      { id: "action", name: "Action", primaryColor: "#ef4444", secondaryColor: "#dc2626" },
      { id: "success", name: "Success", primaryColor: "#16a34a", secondaryColor: "#15803d" },
      { id: "energy", name: "Energy", primaryColor: "#f97316", secondaryColor: "#ea580c" },
    ],
    fonts: [
      { id: "impact", name: "Impact", family: "Impact, Arial Black, sans-serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "tahoma", name: "Tahoma", family: "Tahoma, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family};">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" style="background: ${colorScheme.primaryColor}; color: white; padding: 15px; border-radius: 8px 8px 0 0;">
        <tr>
          <td>
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 4px;">${data.fullName}</div>
            <div style="font-size: 16px; opacity: 0.95;">${data.jobTitle} | ${data.company}</div>
          </td>
        </tr>
      </table>
      
      <table cellpadding="0" cellspacing="0" style="background: #f9fafb; padding: 15px;">
        <tr>
          <td>
            <div style="font-size: 14px; color: #374151; margin: 5px 0;">
              📱 <strong><a href="tel:${data.phone}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.phone || 'Call Me'}</a></strong>
            </div>
            <div style="font-size: 14px; color: #374151; margin: 5px 0;">
              ✉️ <a href="mailto:${data.email}" style="color: #374151; text-decoration: none;">${data.email}</a>
            </div>
            ${data.website ? `
            <div style="font-size: 14px; color: #374151; margin: 5px 0;">
              🌐 <a href="${data.website}" style="color: #374151; text-decoration: none;">${data.website}</a>
            </div>` : ''}
          </td>
        </tr>
      </table>
      
      ${data.bannerText ? `
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="background: ${colorScheme.secondaryColor}; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">🎯 ${data.bannerText}</div>
            ${data.bannerUrl ? `
            <a href="${data.bannerUrl}" style="display: inline-block; background: white; color: ${colorScheme.primaryColor}; padding: 10px 20px; border-radius: 25px; text-decoration: none; font-weight: bold; font-size: 14px;">
              Contact Now!
            </a>` : ''}
          </td>
        </tr>
      </table>` : ''}
      
      <div style="text-align: center; margin-top: 15px;">
        ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="text-decoration: none; margin: 0 8px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 30px; height: 30px;"></a>` : ''}
        ${data.facebookUrl ? `<a href="${data.facebookUrl}" style="text-decoration: none; margin: 0 8px;"><img src="${socialIcons.facebook}" alt="Facebook" style="width: 30px; height: 30px;"></a>` : ''}
        ${data.twitterUrl ? `<a href="${data.twitterUrl}" style="text-decoration: none; margin: 0 8px;"><img src="${socialIcons.twitter}" alt="Twitter" style="width: 30px; height: 30px;"></a>` : ''}
      </div>
    </td>
  </tr>
</table>`
  },
  
  // 12. Freelancer
  {
    id: "freelancer",
    name: "Freelancer",
    description: "Personal and creative for independent workers",
    thumbnail: "🚀",
    colorSchemes: [
      { id: "creative", name: "Creative", primaryColor: "#8b5cf6", secondaryColor: "#a78bfa" },
      { id: "bold", name: "Bold", primaryColor: "#e11d48", secondaryColor: "#f43f5e" },
      { id: "nature", name: "Natural", primaryColor: "#059669", secondaryColor: "#10b981" },
    ],
    fonts: [
      { id: "modern", name: "Modern", family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
      { id: "playful", name: "Playful", family: "Comic Sans MS, cursive" },
      { id: "clean", name: "Clean", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 500px;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="text-align: center;">
            ${data.profilePhotoUrl ? `
            <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 100px; height: 100px; border-radius: 50%; border: 4px solid ${colorScheme.primaryColor}; margin-bottom: 15px;">` : ''}
            <div style="font-size: 26px; font-weight: bold; background: linear-gradient(90deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 4px;">
              ${data.fullName}
            </div>
            <div style="font-size: 16px; color: #4b5563; margin-bottom: 4px;">${data.jobTitle}</div>
            ${data.company ? `<div style="font-size: 14px; color: #9ca3af;">@ ${data.company}</div>` : ''}
          </td>
        </tr>
      </table>
      
      <div style="text-align: center; margin: 20px 0;">
        <div style="display: inline-block; background: #f3f4f6; padding: 15px 25px; border-radius: 30px;">
          <div style="font-size: 13px; color: #4b5563; margin: 3px 0;">
            📧 <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none; font-weight: bold;">${data.email}</a>
          </div>
          ${data.phone ? `
          <div style="font-size: 13px; color: #4b5563; margin: 3px 0;">
            📱 ${data.phone}
          </div>` : ''}
          ${data.website ? `
          <div style="font-size: 13px; color: #4b5563; margin: 3px 0;">
            🔗 <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website.replace(/^https?:\/\//, '')}</a>
          </div>` : ''}
        </div>
      </div>
      
      ${data.bannerText ? `
      <div style="text-align: center; margin: 20px 0;">
        <div style="display: inline-block; background: linear-gradient(90deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); color: white; padding: 12px 24px; border-radius: 25px;">
          <div style="font-size: 14px; font-weight: bold;">✨ ${data.bannerText} ✨</div>
          ${data.bannerUrl ? `<a href="${data.bannerUrl}" style="color: white; font-size: 12px; text-decoration: underline;">Ver Portfolio</a>` : ''}
        </div>
      </div>` : ''}
      
      <div style="text-align: center; margin-top: 15px;">
        ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="text-decoration: none; margin: 0 6px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 28px; height: 28px;"></a>` : ''}
        ${data.githubUrl ? `<a href="${data.githubUrl}" style="text-decoration: none; margin: 0 6px;"><img src="${socialIcons.github}" alt="GitHub" style="width: 28px; height: 28px;"></a>` : ''}
        ${data.instagramUrl ? `<a href="${data.instagramUrl}" style="text-decoration: none; margin: 0 6px;"><img src="${socialIcons.instagram}" alt="Instagram" style="width: 28px; height: 28px;"></a>` : ''}
        ${data.youtubeUrl ? `<a href="${data.youtubeUrl}" style="text-decoration: none; margin: 0 6px;"><img src="${socialIcons.youtube}" alt="YouTube" style="width: 28px; height: 28px;"></a>` : ''}
      </div>
      
      ${data.disclaimerText ? `
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #e5e7eb; text-align: center;">
        <div style="font-size: 11px; color: #9ca3af; font-style: italic;">${data.disclaimerText}</div>
      </div>` : ''}
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
    },
  });

  // Watch form values for live preview
  const watchedValues = form.watch();

  // Update generated HTML whenever form values or template settings change
  useEffect(() => {
    if (watchedValues.fullName && watchedValues.jobTitle && watchedValues.company && watchedValues.email) {
      const html = selectedTemplate.generateHtml(watchedValues, selectedColorScheme, selectedFont);
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

  // Load sample data for testing
  const loadSampleData = () => {
    form.setValue("fullName", "John Smith");
    form.setValue("jobTitle", "Digital Marketing Director");
    form.setValue("company", "InnovaTech Solutions");
    form.setValue("email", "john.smith@innovatech.com");
    form.setValue("phone", "+1 (555) 123-4567");
    form.setValue("mobile", "+1 (555) 987-6543");
    form.setValue("website", "https://www.innovatech.com");
    form.setValue("linkedinUrl", "https://linkedin.com/in/johnsmith");
    form.setValue("twitterUrl", "https://twitter.com/jsmith");
    form.setValue("address", "123 Main Street, New York, NY 10001");
    form.setValue("companyTagline", "Innovation that transforms");
    form.setValue("bannerText", "Discover our digital solutions!");
    form.setValue("bannerUrl", "https://www.innovatech.com/solutions");
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Email Signature Generator</h1>
            <p className="text-muted-foreground">
              Create professional signatures for your email with modern and customizable designs
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadSampleData}
            data-testid="button-load-sample"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Load Example
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
              <TabsTrigger value="data" data-testid="tab-data">Data</TabsTrigger>
              <TabsTrigger value="customize" data-testid="tab-customize">Customize</TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Select a Template</CardTitle>
                  <CardDescription>
                    Choose from over 12 professional designs
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
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Complete your details to generate the signature
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
                              placeholder="Juan Pérez"
                              {...form.register("fullName")}
                              data-testid="input-fullname"
                            />
                          </div>
                          <div>
                            <Label htmlFor="jobTitle">Job Title *</Label>
                            <Input
                              id="jobTitle"
                              placeholder="Sales Director"
                              {...form.register("jobTitle")}
                              data-testid="input-jobtitle"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="company">Company *</Label>
                            <Input
                              id="company"
                              placeholder="My Company Ltd."
                              {...form.register("company")}
                              data-testid="input-company"
                            />
                          </div>
                          <div>
                            <Label htmlFor="email">Email *</Label>
                            <Input
                              id="email"
                              type="email"
                              placeholder="john@company.com"
                              {...form.register("email")}
                              data-testid="input-email"
                            />
                          </div>
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
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                              id="phone"
                              placeholder="+34 91 123 4567"
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
                              placeholder="+34 600 123 456"
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
                            placeholder="https://www.mycompany.com"
                            {...form.register("website")}
                            data-testid="input-website"
                          />
                        </div>
                        <div>
                          <Label htmlFor="address">Address</Label>
                          <Input
                            id="address"
                            placeholder="123 Main Street, New York 10001"
                            {...form.register("address")}
                            data-testid="input-address"
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Social Media */}
                      <div className="space-y-4">
                        <div className="text-sm font-semibold text-muted-foreground mb-2">
                          Social Media
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="linkedinUrl">LinkedIn</Label>
                            <Input
                              id="linkedinUrl"
                              placeholder="https://linkedin.com/in/juanperez"
                              {...form.register("linkedinUrl")}
                              data-testid="input-linkedin"
                            />
                          </div>
                          <div>
                            <Label htmlFor="twitterUrl">Twitter/X</Label>
                            <Input
                              id="twitterUrl"
                              placeholder="https://twitter.com/juanperez"
                              {...form.register("twitterUrl")}
                              data-testid="input-twitter"
                            />
                          </div>
                          <div>
                            <Label htmlFor="facebookUrl">Facebook</Label>
                            <Input
                              id="facebookUrl"
                              placeholder="https://facebook.com/juanperez"
                              {...form.register("facebookUrl")}
                              data-testid="input-facebook"
                            />
                          </div>
                          <div>
                            <Label htmlFor="instagramUrl">Instagram</Label>
                            <Input
                              id="instagramUrl"
                              placeholder="https://instagram.com/juanperez"
                              {...form.register("instagramUrl")}
                              data-testid="input-instagram"
                            />
                          </div>
                          <div>
                            <Label htmlFor="githubUrl">GitHub</Label>
                            <Input
                              id="githubUrl"
                              placeholder="https://github.com/juanperez"
                              {...form.register("githubUrl")}
                              data-testid="input-github"
                            />
                          </div>
                          <div>
                            <Label htmlFor="youtubeUrl">YouTube</Label>
                            <Input
                              id="youtubeUrl"
                              placeholder="https://youtube.com/@juanperez"
                              {...form.register("youtubeUrl")}
                              data-testid="input-youtube"
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
                          <Label htmlFor="logoUrl">Logo URL</Label>
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
                            placeholder="Innovation that transforms"
                            {...form.register("companyTagline")}
                            data-testid="input-tagline"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="bannerText">Banner/CTA Text</Label>
                            <Input
                              id="bannerText"
                              placeholder="Schedule a meeting!"
                              {...form.register("bannerText")}
                              data-testid="input-banner-text"
                            />
                          </div>
                          <div>
                            <Label htmlFor="bannerUrl">Banner URL</Label>
                            <Input
                              id="bannerUrl"
                              placeholder="https://calendly.com/johnsmith"
                              {...form.register("bannerUrl")}
                              data-testid="input-banner-url"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="disclaimerText">Disclaimer Text</Label>
                          <Textarea
                            id="disclaimerText"
                            placeholder="This message is confidential..."
                            rows={3}
                            {...form.register("disclaimerText")}
                            data-testid="input-disclaimer"
                          />
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
              <div className="relative">
                <ScrollArea className="h-[300px] w-full rounded-md border">
                  <pre className="p-4 text-xs">
                    <code className="language-html">
                      {generatedHtml || "// HTML code will appear here"}
                    </code>
                  </pre>
                </ScrollArea>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>How to use your signature:</strong>
                </p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Copy the generated HTML code</li>
                  <li>Open signature settings in your email client</li>
                  <li>Paste the code in the HTML editor</li>
                  <li>Save your changes</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Compatibility</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Gmail</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Outlook</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Apple Mail</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Thunderbird</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Yahoo Mail</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}