export interface GatewayStatus {
  state: "stopped" | "starting" | "running" | "stopping" | "error";
  pid: number | null;
  port: number;
  uptime_secs: number | null;
  error: string | null;
}

export interface GatewayLog {
  line: string;
  level: "info" | "warn" | "error" | "stdout" | "stderr";
  timestamp: string;
}
