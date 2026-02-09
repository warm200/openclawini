export interface BrowserLauncherState {
  port: number;
  url: string;
  opening: boolean;
  error: string | null;
}
