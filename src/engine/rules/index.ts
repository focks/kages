// THE list of lint rules. Order here is only the order rules run in; output is
// sorted by severity, location and id, so it never depends on it. To add a rule:
// one file in this directory, one line here, fixtures in __fixtures__/<id>.json.
import type { Rule } from "./types.ts";
import { deadButton } from "./dead-button.ts";
import { formUnwired } from "./form-unwired.ts";
import { modalUnreachable } from "./modal-unreachable.ts";
import { tocMissingAnchor } from "./toc-missing-anchor.ts";
import { tabPanelExtraSlot, tabPanelEmpty } from "./tab-panel.ts";
import { duplicateItemId } from "./duplicate-item-id.ts";
import { insecureMedia } from "./insecure-media.ts";
import { emptyChart, selectionUnused } from "./charts.ts";
import { calendarMonth } from "./calendar-month.ts";
import { tplMissingBlock, tplPrivateRead, tplUndeclaredState } from "./templates.ts";
import { unreachableBlock } from "./unreachable-block.ts";
import { briefInvalid } from "./brief-invalid.ts";
import { nestedSections } from "./nested-sections.ts";
import { deprecatedUsage } from "./deprecated-usage.ts";
import { unsourcedClaim, statLiteralUnsourced } from "./unsourced-claim.ts";

export const RULES: readonly Rule[] = [
  tplMissingBlock, tplPrivateRead, tplUndeclaredState,
  deadButton, formUnwired, modalUnreachable, tocMissingAnchor, tabPanelExtraSlot, tabPanelEmpty,
  duplicateItemId, insecureMedia, emptyChart, selectionUnused, calendarMonth, unreachableBlock, briefInvalid, nestedSections, deprecatedUsage, unsourcedClaim, statLiteralUnsourced,
];

export const ruleById = (id: string): Rule | undefined => RULES.find((r) => r.id === id);
export type { Rule, Severity, Tier, Mode, Category, Finding, LintContext } from "./types.ts";
