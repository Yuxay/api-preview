import { app } from 'electron';

export function getCurrentAppVersion(): string {
  return app.getVersion();
}
