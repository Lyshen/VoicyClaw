import { AccountPage } from "../../../components/account-page"
import { getAccountSummary } from "../../../lib/account-summary"

export default async function AccountRoute() {
  const summary = await getAccountSummary()
  return <AccountPage summary={summary} />
}
