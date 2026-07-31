import "./styles/reset.css";
import "./styles/tokens.css";
import "@hyperslop-systems/pbui/styles.css";
import "@hyperslop-systems/pbui/components.css";
// The shared presentation-part and chrome styles (PBUI-UNIFY-001): previously
// this package's own pbui.module.css carried the presentation/menu rules.
import "@hyperslop-systems/pbui/presentation-parts.css";
import "@hyperslop-systems/pbui/chrome.css";
import "./styles/pbui-extras.css";
import "@hyperslop-systems/plot/styles.css";
// After `components.css`, because it overrides that file's `:where(...)` rules
// for the dialog parts. Order is the whole mechanism here.
import "./styles/dialogs.css";
import "./styles/brand.css";
import "./styles/scrollbars.css";
