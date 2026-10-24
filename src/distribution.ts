// The registry can lag deployment and repository releases may be private.
// Ship a versioned CLI asset with the site so first-run setup is anonymous.
import { VERSION } from './version.ts';
export const CLI_PACKAGE = `https://app.getkages.com/downloads/ifocksh-kages-${VERSION}.tgz`;
export const CLI_INSTALL = `npm install -g ${CLI_PACKAGE}`;
export const CLI_RUN = `npx -y --package=${CLI_PACKAGE} kages`;
