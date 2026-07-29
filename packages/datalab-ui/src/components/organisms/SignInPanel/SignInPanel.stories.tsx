import type { Meta, StoryObj } from "@storybook/react-vite";
import { SignInPanel } from "./SignInPanel";

/** Every browser sign-in and callback-error state supported by Datadrop. */
const meta = {
  title: "Component Library/Organisms/SignInPanel",
  component: SignInPanel,
  parameters: { tile: { width: 460, height: 340 } },
  args: { returnPath: "/ui/" },
} satisfies Meta<typeof SignInPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OidcWithSignup: Story = {
  args: { signupEnabled: true, issuer: "http://zitadel.test:17070" },
};

/** Signup disabled — the ordinary state of a closed deployment. */
export const OidcWithoutSignup: Story = {
  args: { signupEnabled: false, issuer: "http://zitadel.test:17070" },
};

/** Callback errors are local codes rather than provider-controlled prose. */
export const ProviderRefused: Story = {
  args: { signupEnabled: true, errorCode: "provider_refused" },
};
