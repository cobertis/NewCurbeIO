interface IntercomProviderProps {
  children: React.ReactNode;
}

export function IntercomProvider({ children }: IntercomProviderProps) {
  return <>{children}</>;
}

export default IntercomProvider;
