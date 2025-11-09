export interface BirthdayMessageParams {
  clientFullName: string;
  agentFirstName: string;
  customMessage?: string | null;
}

const DEFAULT_BIRTHDAY_MESSAGE = "🎉 ¡Feliz Cumpleaños {CLIENT_NAME}! 🎂\n\nTe deseamos el mejor de los éxitos en este nuevo año de vida.\n\nTe saluda {AGENT_NAME}, tu agente de seguros.";

export function buildBirthdayMessage(params: BirthdayMessageParams): string {
  const clientFirstName = params.clientFullName.split(' ')[0];
  const agentFirstName = params.agentFirstName;
  
  const template = params.customMessage || DEFAULT_BIRTHDAY_MESSAGE;
  
  return template
    .replace('{CLIENT_NAME}', clientFirstName)
    .replace('{AGENT_NAME}', agentFirstName);
}
