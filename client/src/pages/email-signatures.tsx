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

// Form schema for email signature data - Enhanced for insurance professionals
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
  // Insurance-specific fields
  licenseNumber: z.string().optional(),
  carriers: z.string().optional(),
  specializations: z.string().optional(),
  officeHours: z.string().optional(),
  emergencyContact: z.string().optional(),
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
};

// Professional Insurance Agent Email Signature Templates
const emailTemplates: EmailTemplate[] = [
  // 1. Insurance Executive - Clean Corporate Style
  {
    id: "insurance-executive",
    name: "Insurance Executive",
    description: "Clean corporate style with company logo space",
    thumbnail: "🏢",
    colorSchemes: [
      { id: "corporate-blue", name: "Corporate Blue", primaryColor: "#1e40af", secondaryColor: "#475569" },
      { id: "professional-gray", name: "Professional Gray", primaryColor: "#374151", secondaryColor: "#6b7280" },
      { id: "trust-green", name: "Trust Green", primaryColor: "#166534", secondaryColor: "#64748b" },
    ],
    fonts: [
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family};">
  <tr>
    <td>
      ${data.logoUrl ? `<img src="${data.logoUrl}" alt="${data.company}" style="max-width: 150px; margin-bottom: 15px;">` : ''}
      <div style="border-top: 3px solid ${colorScheme.primaryColor}; padding-top: 15px;">
        <div style="font-size: 20px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 2px;">${data.fullName}</div>
        <div style="font-size: 16px; color: ${colorScheme.secondaryColor}; margin-bottom: 4px;">${data.jobTitle}</div>
        <div style="font-size: 14px; font-weight: bold; color: #333333; margin-bottom: 8px;">${data.company}</div>
        ${data.companyTagline ? `<div style="font-size: 13px; font-style: italic; color: ${colorScheme.secondaryColor}; margin-bottom: 12px;">"${data.companyTagline}"</div>` : ''}
        
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size: 13px; color: #666666; width: 100px; padding: 2px 0;">Direct:</td>
            <td style="font-size: 13px; color: #333333;">${data.phone || 'N/A'}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #666666; padding: 2px 0;">Mobile:</td>
            <td style="font-size: 13px; color: #333333;">${data.mobile || 'N/A'}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #666666; padding: 2px 0;">Email:</td>
            <td style="font-size: 13px; color: ${colorScheme.primaryColor};"><a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></td>
          </tr>
          ${data.licenseNumber ? `
          <tr>
            <td style="font-size: 13px; color: #666666; padding: 2px 0;">License:</td>
            <td style="font-size: 13px; color: #333333;">${data.licenseNumber}</td>
          </tr>` : ''}
          ${data.carriers ? `
          <tr>
            <td style="font-size: 13px; color: #666666; padding: 2px 0; vertical-align: top;">Carriers:</td>
            <td style="font-size: 13px; color: #333333;">${data.carriers}</td>
          </tr>` : ''}
          ${data.website ? `
          <tr>
            <td style="font-size: 13px; color: #666666; padding: 2px 0;">Web:</td>
            <td style="font-size: 13px; color: ${colorScheme.primaryColor};"><a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website}</a></td>
          </tr>` : ''}
        </table>
        
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
          <div style="font-size: 12px; color: ${colorScheme.secondaryColor}; font-weight: bold;">Protecting What Matters Most</div>
        </div>
      </div>
    </td>
  </tr>
</table>`
  },

  // 2. Independent Agent - Professional Personal Branding
  {
    id: "independent-agent",
    name: "Independent Agent",
    description: "Professional but personal branding",
    thumbnail: "💼",
    colorSchemes: [
      { id: "navy", name: "Navy Professional", primaryColor: "#1e3a8a", secondaryColor: "#64748b" },
      { id: "burgundy", name: "Burgundy", primaryColor: "#7f1d1d", secondaryColor: "#6b7280" },
      { id: "teal", name: "Teal Modern", primaryColor: "#0f766e", secondaryColor: "#475569" },
    ],
    fonts: [
      { id: "verdana", name: "Verdana", family: "Verdana, sans-serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          ${data.profilePhotoUrl ? `
          <td style="width: 100px; padding-right: 20px;">
            <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 100px; height: 100px; border-radius: 8px;">
          </td>` : ''}
          <td>
            <div style="font-size: 22px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 4px;">${data.fullName}</div>
            <div style="font-size: 14px; color: ${colorScheme.secondaryColor}; margin-bottom: 2px;">${data.jobTitle}</div>
            <div style="font-size: 14px; color: #333333; font-weight: bold; margin-bottom: 8px;">Independent Insurance Agent</div>
            ${data.licenseNumber ? `<div style="font-size: 12px; color: #666666;">License #: ${data.licenseNumber}</div>` : ''}
            
            <div style="margin-top: 10px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size: 13px; color: #333333; padding: 2px 0;">📞 ${data.phone || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #333333; padding: 2px 0;">📱 ${data.mobile || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; padding: 2px 0;">✉️ <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></td>
                </tr>
                ${data.website ? `
                <tr>
                  <td style="font-size: 13px; padding: 2px 0;">🌐 <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website}</a></td>
                </tr>` : ''}
              </table>
            </div>
            
            ${data.specializations ? `
            <div style="margin-top: 10px; padding: 8px; background: #f9fafb; border-left: 3px solid ${colorScheme.primaryColor};">
              <div style="font-size: 11px; color: #666666; text-transform: uppercase; margin-bottom: 2px;">Specializations</div>
              <div style="font-size: 12px; color: #333333;">${data.specializations}</div>
            </div>` : ''}
            
            ${data.carriers ? `
            <div style="margin-top: 8px;">
              <div style="font-size: 11px; color: #666666;">Representing: ${data.carriers}</div>
            </div>` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },

  // 3. Health Insurance Specialist
  {
    id: "health-specialist",
    name: "Health Insurance Specialist",
    description: "Medical/healthcare themed design",
    thumbnail: "🏥",
    colorSchemes: [
      { id: "medical-blue", name: "Medical Blue", primaryColor: "#0891b2", secondaryColor: "#0e7490" },
      { id: "health-green", name: "Health Green", primaryColor: "#059669", secondaryColor: "#10b981" },
      { id: "care-purple", name: "Care Purple", primaryColor: "#7c3aed", secondaryColor: "#8b5cf6" },
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
            <div style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 4px;">${data.fullName}</div>
            <div style="font-size: 14px; color: ${colorScheme.primaryColor}; margin-bottom: 2px;">${data.jobTitle}</div>
            <div style="font-size: 13px; color: #6b7280;">Health Insurance Specialist</div>
            ${data.licenseNumber ? `<div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">License: ${data.licenseNumber}</div>` : ''}
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
              ${data.officeHours ? `
              <tr>
                <td style="padding: 2px 0;">
                  <span style="color: ${colorScheme.primaryColor}; font-size: 14px;">🕐</span>
                  <span style="font-size: 13px; color: #374151; margin-left: 8px;">Hours: ${data.officeHours}</span>
                </td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
      </table>
      
      ${data.specializations ? `
      <div style="margin-top: 12px; padding: 10px; background: ${colorScheme.primaryColor}10; border-radius: 4px;">
        <div style="font-size: 11px; color: ${colorScheme.primaryColor}; font-weight: bold; margin-bottom: 4px;">SPECIALIZING IN</div>
        <div style="font-size: 12px; color: #374151;">${data.specializations}</div>
      </div>` : ''}
      
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
        <div style="font-size: 11px; color: #6b7280; font-style: italic;">Your Health Coverage Expert - Simplifying Healthcare Insurance</div>
      </div>
    </td>
  </tr>
</table>`
  },

  // 4. Life Insurance Advisor
  {
    id: "life-advisor",
    name: "Life Insurance Advisor",
    description: "Trust-focused professional design",
    thumbnail: "🛡️",
    colorSchemes: [
      { id: "trust-blue", name: "Trust Blue", primaryColor: "#2563eb", secondaryColor: "#64748b" },
      { id: "stable-gray", name: "Stable Gray", primaryColor: "#4b5563", secondaryColor: "#9ca3af" },
      { id: "secure-green", name: "Secure Green", primaryColor: "#047857", secondaryColor: "#6b7280" },
    ],
    fonts: [
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
      { id: "times", name: "Times New Roman", family: "Times New Roman, serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 600px;">
  <tr>
    <td>
      <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid ${colorScheme.primaryColor};">
        ${data.profilePhotoUrl ? `<img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 90px; height: 90px; border-radius: 45px; margin-bottom: 10px;">` : ''}
        <div style="font-size: 24px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 4px;">${data.fullName}</div>
        <div style="font-size: 16px; color: ${colorScheme.secondaryColor};">${data.jobTitle}</div>
        <div style="font-size: 14px; color: #666666; margin-top: 4px;">Life Insurance Advisor</div>
        ${data.licenseNumber ? `<div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">License #${data.licenseNumber}</div>` : ''}
      </div>
      
      <table cellpadding="0" cellspacing="0" style="width: 100%; margin-top: 15px;">
        <tr>
          <td style="text-align: center;">
            <div style="font-size: 13px; color: #374151; margin: 4px 0;">
              <strong>Direct:</strong> <a href="tel:${data.phone}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.phone || 'N/A'}</a>
              ${data.mobile ? ` | <strong>Mobile:</strong> <a href="tel:${data.mobile}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.mobile}</a>` : ''}
            </div>
            <div style="font-size: 13px; color: #374151; margin: 4px 0;">
              <strong>Email:</strong> <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a>
            </div>
            ${data.website ? `
            <div style="font-size: 13px; color: #374151; margin: 4px 0;">
              <strong>Web:</strong> <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website}</a>
            </div>` : ''}
            ${data.address ? `
            <div style="font-size: 13px; color: #374151; margin: 4px 0;">
              <strong>Office:</strong> ${data.address}
            </div>` : ''}
          </td>
        </tr>
      </table>
      
      ${data.companyTagline || data.carriers ? `
      <div style="margin-top: 15px; padding: 12px; background: #f9fafb; border-radius: 6px;">
        ${data.companyTagline ? `<div style="font-size: 14px; color: ${colorScheme.primaryColor}; font-weight: bold; text-align: center; margin-bottom: 4px;">${data.companyTagline}</div>` : ''}
        ${data.carriers ? `<div style="font-size: 11px; color: #6b7280; text-align: center;">Representing: ${data.carriers}</div>` : ''}
      </div>` : ''}
      
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
        <div style="font-size: 12px; color: #6b7280; text-align: center; font-style: italic;">
          "Securing Your Family's Future with Trusted Life Insurance Solutions"
        </div>
      </div>
    </td>
  </tr>
</table>`
  },

  // 5. Auto Insurance Agent
  {
    id: "auto-agent",
    name: "Auto Insurance Agent",
    description: "Modern design with contact emphasis",
    thumbnail: "🚗",
    colorSchemes: [
      { id: "auto-red", name: "Auto Red", primaryColor: "#dc2626", secondaryColor: "#7f1d1d" },
      { id: "speed-blue", name: "Speed Blue", primaryColor: "#2563eb", secondaryColor: "#1e40af" },
      { id: "safety-green", name: "Safety Green", primaryColor: "#16a34a", secondaryColor: "#166534" },
    ],
    fonts: [
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "tahoma", name: "Tahoma", family: "Tahoma, sans-serif" },
      { id: "verdana", name: "Verdana", family: "Verdana, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family};">
  <tr>
    <td>
      <div style="background: linear-gradient(90deg, ${colorScheme.primaryColor}, ${colorScheme.secondaryColor}); padding: 15px; border-radius: 8px 8px 0 0;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            ${data.profilePhotoUrl ? `
            <td style="padding-right: 15px;">
              <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 70px; height: 70px; border-radius: 35px; border: 3px solid white;">
            </td>` : ''}
            <td>
              <div style="color: white; font-size: 20px; font-weight: bold;">${data.fullName}</div>
              <div style="color: white; font-size: 14px; opacity: 0.9;">${data.jobTitle}</div>
              <div style="color: white; font-size: 13px; opacity: 0.8;">Auto Insurance Specialist</div>
            </td>
          </tr>
        </table>
      </div>
      
      <div style="background: #f9fafb; padding: 15px;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size: 14px; color: #374151; padding: 3px 0;">
              <strong style="color: ${colorScheme.primaryColor};">📞 Call/Text:</strong> ${data.phone || 'N/A'}
            </td>
          </tr>
          ${data.mobile ? `
          <tr>
            <td style="font-size: 14px; color: #374151; padding: 3px 0;">
              <strong style="color: ${colorScheme.primaryColor};">📱 Mobile:</strong> ${data.mobile}
            </td>
          </tr>` : ''}
          <tr>
            <td style="font-size: 14px; color: #374151; padding: 3px 0;">
              <strong style="color: ${colorScheme.primaryColor};">✉️ Email:</strong> <a href="mailto:${data.email}" style="color: #374151; text-decoration: none;">${data.email}</a>
            </td>
          </tr>
          ${data.licenseNumber ? `
          <tr>
            <td style="font-size: 14px; color: #374151; padding: 3px 0;">
              <strong style="color: ${colorScheme.primaryColor};">🆔 License:</strong> ${data.licenseNumber}
            </td>
          </tr>` : ''}
          ${data.officeHours ? `
          <tr>
            <td style="font-size: 14px; color: #374151; padding: 3px 0;">
              <strong style="color: ${colorScheme.primaryColor};">🕐 Hours:</strong> ${data.officeHours}
            </td>
          </tr>` : ''}
        </table>
        
        ${data.bannerText ? `
        <div style="margin-top: 12px; padding: 10px; background: ${colorScheme.primaryColor}; color: white; border-radius: 4px; text-align: center;">
          <div style="font-size: 14px; font-weight: bold;">${data.bannerText}</div>
          ${data.bannerUrl ? `<a href="${data.bannerUrl}" style="color: white; font-size: 12px;">Get a Quote →</a>` : ''}
        </div>` : ''}
        
        ${data.carriers ? `
        <div style="margin-top: 10px; font-size: 11px; color: #6b7280;">
          <strong>Carriers:</strong> ${data.carriers}
        </div>` : ''}
      </div>
      
      <div style="background: #1f2937; color: white; padding: 8px; text-align: center; border-radius: 0 0 8px 8px;">
        <div style="font-size: 12px;">🚗 Drive Safe, Save More! 🚗</div>
      </div>
    </td>
  </tr>
</table>`
  },

  // 6. Commercial Lines Agent
  {
    id: "commercial-agent",
    name: "Commercial Lines Agent",
    description: "Business-focused professional design",
    thumbnail: "🏭",
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
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family};">
  <tr>
    <td>
      <div style="border-left: 4px solid ${colorScheme.primaryColor}; padding-left: 15px;">
        <div style="font-size: 22px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 4px;">${data.fullName}</div>
        <div style="font-size: 16px; color: ${colorScheme.secondaryColor}; margin-bottom: 2px;">${data.jobTitle}</div>
        <div style="font-size: 14px; color: #4b5563; font-weight: bold;">Commercial Insurance Specialist</div>
        <div style="font-size: 14px; color: #6b7280; margin-top: 2px;">${data.company}</div>
        ${data.licenseNumber ? `<div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">License #${data.licenseNumber}</div>` : ''}
        
        <table cellpadding="0" cellspacing="0" style="margin-top: 15px;">
          <tr>
            <td style="width: 80px; font-size: 13px; color: #6b7280; padding: 3px 0;">Office:</td>
            <td style="font-size: 13px; color: #374151;">${data.phone || 'N/A'}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #6b7280; padding: 3px 0;">Mobile:</td>
            <td style="font-size: 13px; color: #374151;">${data.mobile || 'N/A'}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #6b7280; padding: 3px 0;">Email:</td>
            <td style="font-size: 13px;"><a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></td>
          </tr>
          ${data.website ? `
          <tr>
            <td style="font-size: 13px; color: #6b7280; padding: 3px 0;">Web:</td>
            <td style="font-size: 13px;"><a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website}</a></td>
          </tr>` : ''}
        </table>
        
        ${data.specializations ? `
        <div style="margin-top: 12px; padding: 10px; background: #f9fafb; border-radius: 4px;">
          <div style="font-size: 12px; color: ${colorScheme.primaryColor}; font-weight: bold; margin-bottom: 4px;">COMMERCIAL LINES EXPERTISE</div>
          <div style="font-size: 12px; color: #374151;">${data.specializations}</div>
        </div>` : ''}
        
        ${data.carriers ? `
        <div style="margin-top: 10px;">
          <div style="font-size: 11px; color: #6b7280;">
            <strong>Partner Carriers:</strong> ${data.carriers}
          </div>
        </div>` : ''}
        
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
          <div style="font-size: 12px; color: ${colorScheme.secondaryColor}; font-style: italic;">
            Protecting Your Business Assets & Operations
          </div>
        </div>
      </div>
    </td>
  </tr>
</table>`
  },

  // 7. Insurance Broker
  {
    id: "insurance-broker",
    name: "Insurance Broker",
    description: "Multi-carrier professional look",
    thumbnail: "🤝",
    colorSchemes: [
      { id: "broker-blue", name: "Broker Blue", primaryColor: "#0369a1", secondaryColor: "#0c4a6e" },
      { id: "neutral-gray", name: "Neutral Gray", primaryColor: "#52525b", secondaryColor: "#71717a" },
      { id: "professional-teal", name: "Professional Teal", primaryColor: "#0f766e", secondaryColor: "#134e4a" },
    ],
    fonts: [
      { id: "helvetica", name: "Helvetica", family: "Helvetica Neue, Helvetica, Arial, sans-serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "verdana", name: "Verdana", family: "Verdana, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family}; max-width: 650px;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="width: 70%;">
            <div style="font-size: 24px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 4px;">${data.fullName}</div>
            <div style="font-size: 16px; color: ${colorScheme.secondaryColor}; margin-bottom: 2px;">${data.jobTitle}</div>
            <div style="font-size: 14px; color: #4b5563; font-weight: bold;">Licensed Insurance Broker</div>
            ${data.licenseNumber ? `<div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">License: ${data.licenseNumber}</div>` : ''}
          </td>
          ${data.logoUrl ? `
          <td style="width: 30%; text-align: right;">
            <img src="${data.logoUrl}" alt="${data.company}" style="max-width: 120px;">
          </td>` : ''}
        </tr>
      </table>
      
      <div style="margin: 15px 0; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 30px;"><span style="color: ${colorScheme.primaryColor};">📞</span></td>
            <td style="font-size: 13px; color: #374151;">${data.phone || 'N/A'}</td>
            <td style="width: 40px;"></td>
            <td style="width: 30px;"><span style="color: ${colorScheme.primaryColor};">📱</span></td>
            <td style="font-size: 13px; color: #374151;">${data.mobile || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding-top: 6px;"><span style="color: ${colorScheme.primaryColor};">✉️</span></td>
            <td style="font-size: 13px; padding-top: 6px;" colspan="4"><a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a></td>
          </tr>
          ${data.website ? `
          <tr>
            <td style="padding-top: 6px;"><span style="color: ${colorScheme.primaryColor};">🌐</span></td>
            <td style="font-size: 13px; padding-top: 6px;" colspan="4"><a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website}</a></td>
          </tr>` : ''}
          ${data.officeHours ? `
          <tr>
            <td style="padding-top: 6px;"><span style="color: ${colorScheme.primaryColor};">🕐</span></td>
            <td style="font-size: 13px; padding-top: 6px;" colspan="4">Office Hours: ${data.officeHours}</td>
          </tr>` : ''}
        </table>
      </div>
      
      ${data.carriers ? `
      <div style="padding: 12px; background: ${colorScheme.primaryColor}10; border-left: 3px solid ${colorScheme.primaryColor};">
        <div style="font-size: 12px; color: ${colorScheme.primaryColor}; font-weight: bold; margin-bottom: 4px;">REPRESENTING MULTIPLE CARRIERS</div>
        <div style="font-size: 12px; color: #374151;">${data.carriers}</div>
      </div>` : ''}
      
      <div style="margin-top: 15px; text-align: center;">
        <div style="font-size: 13px; color: ${colorScheme.secondaryColor}; font-weight: bold;">
          "Your Independent Choice for Comprehensive Coverage"
        </div>
        ${data.linkedinUrl ? `<a href="${data.linkedinUrl}" style="text-decoration: none; margin: 0 5px;"><img src="${socialIcons.linkedin}" alt="LinkedIn" style="width: 20px; height: 20px; margin-top: 8px;"></a>` : ''}
      </div>
    </td>
  </tr>
</table>`
  },

  // 8. Claims Specialist
  {
    id: "claims-specialist",
    name: "Claims Specialist",
    description: "Service-oriented professional design",
    thumbnail: "📋",
    colorSchemes: [
      { id: "service-blue", name: "Service Blue", primaryColor: "#0284c7", secondaryColor: "#0369a1" },
      { id: "urgent-red", name: "Urgent Red", primaryColor: "#dc2626", secondaryColor: "#b91c1c" },
      { id: "calm-green", name: "Calm Green", primaryColor: "#16a34a", secondaryColor: "#15803d" },
    ],
    fonts: [
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "calibri", name: "Calibri", family: "Calibri, sans-serif" },
      { id: "verdana", name: "Verdana", family: "Verdana, sans-serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family};">
  <tr>
    <td>
      <div style="background: ${colorScheme.primaryColor}; color: white; padding: 12px; border-radius: 6px 6px 0 0;">
        <div style="font-size: 20px; font-weight: bold;">${data.fullName}</div>
        <div style="font-size: 14px; opacity: 0.95;">${data.jobTitle} - Claims Department</div>
      </div>
      
      <div style="padding: 15px; border: 1px solid #e5e7eb; border-top: none;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size: 14px; color: #374151; padding: 4px 0;">
              <strong>Direct Line:</strong> <a href="tel:${data.phone}" style="color: ${colorScheme.primaryColor}; text-decoration: none; font-weight: bold;">${data.phone || 'N/A'}</a>
            </td>
          </tr>
          ${data.emergencyContact ? `
          <tr>
            <td style="font-size: 14px; color: #374151; padding: 4px 0;">
              <strong>24/7 Emergency:</strong> <a href="tel:${data.emergencyContact}" style="color: #dc2626; text-decoration: none; font-weight: bold;">${data.emergencyContact}</a>
            </td>
          </tr>` : ''}
          <tr>
            <td style="font-size: 14px; color: #374151; padding: 4px 0;">
              <strong>Email:</strong> <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a>
            </td>
          </tr>
          ${data.licenseNumber ? `
          <tr>
            <td style="font-size: 14px; color: #374151; padding: 4px 0;">
              <strong>License #:</strong> ${data.licenseNumber}
            </td>
          </tr>` : ''}
          ${data.officeHours ? `
          <tr>
            <td style="font-size: 14px; color: #374151; padding: 4px 0;">
              <strong>Office Hours:</strong> ${data.officeHours}
            </td>
          </tr>` : ''}
        </table>
        
        ${data.specializations ? `
        <div style="margin-top: 12px; padding: 8px; background: #fef3c7; border-left: 3px solid #f59e0b;">
          <div style="font-size: 11px; color: #92400e; font-weight: bold;">CLAIMS EXPERTISE</div>
          <div style="font-size: 12px; color: #451a03; margin-top: 2px;">${data.specializations}</div>
        </div>` : ''}
        
        <div style="margin-top: 12px; padding: 10px; background: ${colorScheme.primaryColor}10; border-radius: 4px; text-align: center;">
          <div style="font-size: 13px; color: ${colorScheme.primaryColor}; font-weight: bold;">
            "Here to Help You Through Your Claim Process"
          </div>
          ${data.website ? `<a href="${data.website}" style="color: ${colorScheme.primaryColor}; font-size: 12px; text-decoration: none;">File a Claim Online →</a>` : ''}
        </div>
      </div>
    </td>
  </tr>
</table>`
  },

  // 9. Insurance Team Leader
  {
    id: "team-leader",
    name: "Insurance Team Leader",
    description: "Leadership-focused professional template",
    thumbnail: "👥",
    colorSchemes: [
      { id: "leadership-blue", name: "Leadership Blue", primaryColor: "#1e40af", secondaryColor: "#3730a3" },
      { id: "executive-gray", name: "Executive Gray", primaryColor: "#374151", secondaryColor: "#4b5563" },
      { id: "success-green", name: "Success Green", primaryColor: "#047857", secondaryColor: "#059669" },
    ],
    fonts: [
      { id: "georgia", name: "Georgia", family: "Georgia, serif" },
      { id: "arial", name: "Arial", family: "Arial, sans-serif" },
      { id: "times", name: "Times New Roman", family: "Times New Roman, serif" },
    ],
    generateHtml: (data, colorScheme, font) => `
<table cellpadding="0" cellspacing="0" style="font-family: ${font.family};">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          ${data.profilePhotoUrl ? `
          <td style="width: 110px; padding-right: 20px;">
            <img src="${data.profilePhotoUrl}" alt="${data.fullName}" style="width: 110px; height: 110px; border-radius: 8px;">
          </td>` : ''}
          <td>
            <div style="font-size: 26px; font-weight: bold; color: ${colorScheme.primaryColor}; margin-bottom: 4px;">${data.fullName}</div>
            <div style="font-size: 18px; color: ${colorScheme.secondaryColor}; margin-bottom: 2px;">${data.jobTitle}</div>
            <div style="font-size: 15px; color: #4b5563; font-weight: bold; margin-bottom: 4px;">${data.company}</div>
            ${data.licenseNumber ? `<div style="font-size: 12px; color: #9ca3af;">License: ${data.licenseNumber}</div>` : ''}
            
            <div style="margin-top: 10px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size: 13px; color: #374151; padding: 2px 0;">
                    <strong>Office:</strong> ${data.phone || 'N/A'} | <strong>Mobile:</strong> ${data.mobile || 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #374151; padding: 2px 0;">
                    <strong>Email:</strong> <a href="mailto:${data.email}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.email}</a>
                  </td>
                </tr>
                ${data.website ? `
                <tr>
                  <td style="font-size: 13px; color: #374151; padding: 2px 0;">
                    <strong>Web:</strong> <a href="${data.website}" style="color: ${colorScheme.primaryColor}; text-decoration: none;">${data.website}</a>
                  </td>
                </tr>` : ''}
              </table>
            </div>
          </td>
        </tr>
      </table>
      
      ${data.specializations || data.carriers ? `
      <div style="margin-top: 15px; padding: 12px; background: linear-gradient(90deg, ${colorScheme.primaryColor}10, ${colorScheme.secondaryColor}10); border-radius: 6px;">
        ${data.specializations ? `
        <div style="font-size: 12px; color: ${colorScheme.primaryColor}; font-weight: bold; margin-bottom: 4px;">TEAM SPECIALIZATIONS</div>
        <div style="font-size: 12px; color: #374151; margin-bottom: 8px;">${data.specializations}</div>` : ''}
        ${data.carriers ? `
        <div style="font-size: 11px; color: #6b7280;">
          <strong>Partner Network:</strong> ${data.carriers}
        </div>` : ''}
      </div>` : ''}
      
      <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid ${colorScheme.primaryColor};">
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