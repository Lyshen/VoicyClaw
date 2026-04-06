import { ProductStudio } from "../../../components/product-studio"
import { getWebRequestContext } from "../../../lib/web-request-context"

export default async function StudioPage() {
  const { runtime } = await getWebRequestContext()

  return <ProductStudio initialRuntime={runtime} />
}
