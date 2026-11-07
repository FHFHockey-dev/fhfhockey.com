import { getServiceRoleClient } from "lib/supabase/server";
import type { IftttRpcClient } from "lib/sources/iftttRpcDeadline";
import { createLunaBindingProbe } from "lib/sources/lunaHosted/bindingProbe";

export const config = { api: { bodyParser: false } };
export default createLunaBindingProbe({ env: () => process.env,
  client: () => getServiceRoleClient() as unknown as IftttRpcClient });
