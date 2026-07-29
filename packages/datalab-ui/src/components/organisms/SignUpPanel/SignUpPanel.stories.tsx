import type { Meta, StoryObj } from "@storybook/react-vite";
import { SignUpPanel } from "./SignUpPanel";

/**
 * Every state of the sign-up tile.
 *
 * The story that matters most is `Closed`: a deployment that does not accept
 * registrations is reachable only by configuration, so it is the state most
 * likely to ship broken, and the failure it prevents is a "Create an account"
 * button that dies at the provider on a page that never mentions datadrop.
 */
const meta = {
  title: "Component Library/Organisms/SignUpPanel",
  component: SignUpPanel,
  parameters: { tile: { width: 460, height: 420 } },
  args: { returnPath: "/ui/" },
} satisfies Meta<typeof SignUpPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The invitation: what an account buys, in the brand's four phases. */
export const Invitation: Story = {
  args: { signupEnabled: true, issuer: "http://localhost:17071" },
};

/** No issuer configured yet — the prose degrades rather than printing "null". */
export const WithoutIssuer: Story = {
  args: { signupEnabled: true, issuer: null },
};

/** A closed deployment. Said plainly instead of offering a button that fails. */
export const Closed: Story = {
  args: { signupEnabled: false, issuer: "http://localhost:17071" },
};

/** Back from the provider with an account that did not exist before. */
export const JustSignedUp: Story = {
  args: { signupEnabled: true, justSignedUp: true, name: "Ada Lovelace" },
};

/** The same, for a provider that returned no display name. */
export const JustSignedUpAnonymous: Story = {
  args: { signupEnabled: true, justSignedUp: true, name: null },
};
