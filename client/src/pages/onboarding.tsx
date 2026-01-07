import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowRight, ArrowLeft, Check, User, MapPin, Briefcase } from "lucide-react";
import logo from "@assets/logo no fondo_1760457183587.png";
import backgroundImage from "@assets/Curbe_SaaS_Brand_Illustration_1765854893427.png";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Phoenix", label: "Arizona Time (MST)" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "pt", label: "Portuguese" },
];

const INSTRUCTION_LEVELS = [
  { value: "Entry Level", label: "Entry Level" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Advanced" },
  { value: "Expert", label: "Expert" },
];

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  preferredLanguage: string;
  timezone: string;
  address: string;
  agentInternalCode: string;
  instructionLevel: string;
  nationalProducerNumber: string;
  federallyFacilitatedMarketplace: string;
  referredBy: string;
}

export default function Onboarding() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    phone: "",
    dateOfBirth: "",
    preferredLanguage: "en",
    timezone: "America/New_York",
    address: "",
    agentInternalCode: "",
    instructionLevel: "",
    nationalProducerNumber: "",
    federallyFacilitatedMarketplace: "",
    referredBy: "",
  });

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.firstName.trim() || !formData.lastName.trim()) {
        toast({
          title: "Required fields",
          description: "Please enter your first and last name.",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
    }
    setStep(prev => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to complete profile");
      }

      toast({
        title: "Profile completed",
        description: "Welcome to Curbe! Your workspace is ready.",
        duration: 3000,
      });

      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { number: 1, title: "Personal", icon: User },
    { number: 2, title: "Location", icon: MapPin },
    { number: 3, title: "Professional", icon: Briefcase },
  ];

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(145deg, #070B14 0%, #0B1220 50%, #0A1018 100%)',
      }}
    >
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 30%, rgba(59, 130, 246, 0.03) 0%, transparent 60%)',
        }}
      />

      <div 
        className="relative z-10 w-full flex overflow-hidden animate-in fade-in duration-300"
        style={{
          width: 'clamp(380px, 76vw, 1180px)',
          height: 'clamp(640px, 74vh, 760px)',
          borderRadius: '24px',
          boxShadow: '0 25px 80px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        }}
      >
        <div className="relative flex flex-col bg-white w-full lg:w-[45%]">
          <div className="shrink-0 px-8 lg:px-10 pt-8">
            <img src={logo} alt="Curbe" className="h-9 w-auto" />
          </div>

          <div className="flex-1 flex flex-col px-8 lg:px-10 py-6 min-h-0 overflow-y-auto">
            <div className="mb-6 shrink-0">
              <h1 className="text-[28px] lg:text-[32px] font-semibold text-gray-900 leading-tight tracking-[-0.025em] mb-1.5">
                Complete your profile
              </h1>
              <p className="text-gray-400 text-[14px] font-normal leading-relaxed">
                Just a few more details to personalize your experience.
              </p>
            </div>

            <div className="flex items-center gap-2 mb-8 shrink-0">
              {steps.map((s, idx) => (
                <div key={s.number} className="flex items-center">
                  <div
                    className={`
                      flex items-center justify-center w-9 h-9 rounded-full text-[13px] font-medium transition-all duration-200
                      ${step === s.number 
                        ? 'bg-gray-900 text-white' 
                        : step > s.number 
                          ? 'bg-gray-900 text-white' 
                          : 'bg-gray-100 text-gray-400'
                      }
                    `}
                    data-testid={`step-indicator-${s.number}`}
                  >
                    {step > s.number ? <Check className="w-4 h-4" /> : s.number}
                  </div>
                  <span className={`ml-2 text-[13px] font-medium ${step >= s.number ? 'text-gray-700' : 'text-gray-400'}`}>
                    {s.title}
                  </span>
                  {idx < steps.length - 1 && (
                    <div className={`w-8 h-px mx-3 ${step > s.number ? 'bg-gray-900' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-5 flex-1">
              {step === 1 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
                        First name *
                      </label>
                      <Input
                        type="text"
                        placeholder="John"
                        value={formData.firstName}
                        onChange={(e) => updateField("firstName", e.target.value)}
                        className="h-12 px-4 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                        required
                        data-testid="input-first-name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
                        Last name *
                      </label>
                      <Input
                        type="text"
                        placeholder="Doe"
                        value={formData.lastName}
                        onChange={(e) => updateField("lastName", e.target.value)}
                        className="h-12 px-4 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                        required
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
                      Phone number
                    </label>
                    <Input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={formData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      className="h-12 px-4 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                      data-testid="input-phone"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
                      Date of birth
                    </label>
                    <Input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => updateField("dateOfBirth", e.target.value)}
                      className="h-12 px-4 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                      data-testid="input-dob"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
                  <div className="space-y-1.5">
                    <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
                      Preferred language
                    </label>
                    <Select 
                      value={formData.preferredLanguage} 
                      onValueChange={(value) => updateField("preferredLanguage", value)}
                    >
                      <SelectTrigger 
                        className="h-12 px-4 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0"
                        data-testid="select-language"
                      >
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map(lang => (
                          <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
                      Timezone
                    </label>
                    <Select 
                      value={formData.timezone} 
                      onValueChange={(value) => updateField("timezone", value)}
                    >
                      <SelectTrigger 
                        className="h-12 px-4 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0"
                        data-testid="select-timezone"
                      >
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map(tz => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
                      Address
                    </label>
                    <Input
                      type="text"
                      placeholder="123 Main St, City, State ZIP"
                      value={formData.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      className="h-12 px-4 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                      data-testid="input-address"
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
                  <p className="text-[13px] text-gray-500 mb-4">
                    Optional: Complete these fields if you're an insurance agent.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
                        Agent Code
                      </label>
                      <Input
                        type="text"
                        placeholder="AGT-001"
                        value={formData.agentInternalCode}
                        onChange={(e) => updateField("agentInternalCode", e.target.value)}
                        className="h-12 px-4 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                        data-testid="input-agent-code"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
                        Instruction Level
                      </label>
                      <Select 
                        value={formData.instructionLevel} 
                        onValueChange={(value) => updateField("instructionLevel", value)}
                      >
                        <SelectTrigger 
                          className="h-12 px-4 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0"
                          data-testid="select-instruction-level"
                        >
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          {INSTRUCTION_LEVELS.map(level => (
                            <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
                      National Producer Number (NPN)
                    </label>
                    <Input
                      type="text"
                      placeholder="12345678"
                      value={formData.nationalProducerNumber}
                      onChange={(e) => updateField("nationalProducerNumber", e.target.value)}
                      className="h-12 px-4 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                      data-testid="input-npn"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
                      FFM ID
                    </label>
                    <Input
                      type="text"
                      placeholder="FFM123456"
                      value={formData.federallyFacilitatedMarketplace}
                      onChange={(e) => updateField("federallyFacilitatedMarketplace", e.target.value)}
                      className="h-12 px-4 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                      data-testid="input-ffm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
                      Referred by
                    </label>
                    <Input
                      type="text"
                      placeholder="Referrer name or code"
                      value={formData.referredBy}
                      onChange={(e) => updateField("referredBy", e.target.value)}
                      className="h-12 px-4 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                      data-testid="input-referred-by"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6 shrink-0">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="h-12 px-6 border-gray-200 text-gray-700 hover:bg-gray-50"
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              
              {step < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 h-12 bg-gray-900 text-white hover:bg-gray-800 text-[15px] font-medium rounded-lg transition-all duration-150"
                  data-testid="button-next"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 h-12 bg-gray-900 text-white hover:bg-gray-800 text-[15px] font-medium rounded-lg transition-all duration-150 disabled:opacity-50"
                  data-testid="button-submit"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <Check className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="shrink-0 mt-auto px-8 lg:px-10 py-5 border-t border-gray-100">
            <div className="text-center text-[13px] text-gray-500">
              Step {step} of 3
            </div>
          </div>
        </div>

        <div className="relative hidden lg:flex w-[55%] items-center">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${backgroundImage})`,
            }}
          />
          
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.5) 100%)',
            }}
          />

          <div className="relative z-10 w-full p-10 lg:p-14 flex flex-col justify-end h-full pb-14">
            <div className="flex flex-wrap gap-2 mb-6">
              {["Personalized", "Streamlined"].map((badge) => (
                <span
                  key={badge}
                  className="px-3.5 py-1.5 rounded-full text-[12px] font-medium"
                  style={{
                    background: 'rgba(255, 255, 255, 0.12)',
                    backdropFilter: 'blur(12px)',
                    color: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>

            <h2 
              className="text-[32px] lg:text-[38px] font-semibold leading-[1.15] tracking-[-0.02em] mb-4"
              style={{ color: 'rgba(255, 255, 255, 0.95)' }}
            >
              Your workspace,<br />your way.
            </h2>
            <p 
              className="text-[15px] lg:text-[16px] leading-relaxed max-w-md"
              style={{ color: 'rgba(255, 255, 255, 0.65)' }}
            >
              Customize your experience and get started in seconds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
