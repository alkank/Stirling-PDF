import { Group, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Banner, Button } from "@app/ui";
import type { LegacyBillingState } from "@app/types/legacyBilling";

/** Displays owner billing without claiming that a legacy plan grants current product allowances. */
export function LegacySubscriptionPlan({
  billing,
  walletTeamId,
}: {
  billing: LegacyBillingState;
  /** The main billing screen renders this team's allowance in its Users row. */
  walletTeamId?: number;
}) {
  const { t, i18n } = useTranslation();
  if (billing.loading)
    return (
      <Text role="status">
        {t("legacyBilling.loading", "Checking your subscription…")}
      </Text>
    );
  if (billing.loadError) {
    return (
      <Banner
        tone="warning"
        action={
          <Button onClick={billing.refresh}>
            {t("legacyBilling.retry", "Try again")}
          </Button>
        }
      >
        {t(
          "legacyBilling.loadError",
          "We couldn't check your existing subscription. Try again before purchasing another plan.",
        )}
      </Banner>
    );
  }
  if (!billing.subscriptions.length) return null;
  const statusLabels = {
    active: t("legacyBilling.status.active", "Active"),
    trialing: t("legacyBilling.status.trialing", "Trial"),
    past_due: t("legacyBilling.status.past_due", "Payment overdue"),
    unpaid: t("legacyBilling.status.unpaid", "Unpaid"),
    paused: t("legacyBilling.status.paused", "Paused"),
    incomplete: t("legacyBilling.status.incomplete", "Payment pending"),
  };
  return (
    <Stack gap="sm">
      {billing.subscriptions.map((subscription) => {
        const end = subscription.currentPeriodEnd
          ? new Date(subscription.currentPeriodEnd)
          : null;
        return (
          <div key={subscription.id}>
            <Group justify="space-between">
              <Text size="xl" fw={600}>
                {subscription.plan === "pro"
                  ? t("legacyBilling.pro", "Pro (legacy)")
                  : t("legacyBilling.team", "Team (legacy)")}
              </Text>
              <Text>{statusLabels[subscription.status]}</Text>
            </Group>
            {end && !Number.isNaN(end.getTime()) && (
              <Text size="sm">
                {t(
                  "legacyBilling.periodEnd",
                  "Current billing period ends {{date}}",
                  {
                    date: end.toLocaleDateString(i18n.language, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    }),
                  },
                )}
              </Text>
            )}
            <Text size="sm">
              {t(
                "legacyBilling.tools",
                "Unlimited manual PDF tools, advanced PDF tools and no watermarks",
              )}
            </Text>
            {subscription.plan === "team" &&
              (!subscription.teamAllowance ||
                subscription.teamId !== walletTeamId) && (
                <Text size="sm">
                  {subscription.teamAllowance
                    ? subscription.teamAllowance.maxUsers == null
                      ? t(
                          "legacyBilling.unlimitedUsers",
                          "Your team: unlimited users ({{used}} in use)",
                          { used: subscription.teamAllowance.usersInUse },
                        )
                      : t(
                          "legacyBilling.teamUsers",
                          "Your team: {{used}} of {{limit}} users",
                          {
                            used: subscription.teamAllowance.usersInUse,
                            limit: subscription.teamAllowance.maxUsers,
                          },
                        )
                    : t(
                        "legacyBilling.usersUnavailable",
                        "We couldn't confirm your team's user allowance. Contact support to check your legacy plan.",
                      )}
                </Text>
              )}
          </div>
        );
      })}
      <Text size="sm">
        {t(
          "legacyBilling.description",
          "View your subscription price, invoices and payment details, or cancel your subscription in Stripe.",
        )}
      </Text>
    </Stack>
  );
}
