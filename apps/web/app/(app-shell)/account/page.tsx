import { AccountPage } from "../../../components/account-page"
import { getAccountSummaryState } from "../../../lib/account-summary"

export default async function AccountRoute() {
  const state = await getAccountSummaryState()
  return <AccountPage state={state} />
}
