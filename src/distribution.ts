// The npm registry can lag deployment. Pin onboarding to the tested GitHub
// release asset so a new connection cannot launch an older MCP implementation.
import { VERSION } from './version.ts';
export const CLI_PACKAGE = `https://github.com/focks/kages/releases/download/v${VERSION}/ifocksh-kages-${VERSION}.tgz`;
export const CLI_INSTALL = `npm install -g ${CLI_PACKAGE}`;
export const CLI_RUN = `npx -y --package=${CLI_PACKAGE} kages`;
